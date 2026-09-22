/**
 * GoldfishBoid class - Combines boid flocking physics with Goldfish rendering
 * Smaller, more social, faster-eating variant with stronger cohesion
 * @module animals/goldfish/GoldfishBoid
 */

import { Goldfish } from './Goldfish.js';
import { applyBoidPhysics } from '../../boids/BoidPhysics.js';

export class GoldfishBoid {
  /**
   * @param {Object} config
   * @param {number} config.id - Unique identifier
   * @param {string} config.group - Group name for cross-group separation
   * @param {number} config.x - Initial x position
   * @param {number} config.y - Initial y position
   * @param {number} config.scale - Size scale
   * @param {p5.Color} config.bodyColor - Body fill color
   * @param {p5.Color} config.finColor - Fin fill color
   * @param {number} config.colorId - Color group ID
   * @param {number} config.introversion - Base introversion value
   * @param {number} config.introversionCoefficient - Individual introversion multiplier
   * @param {number} config.quickness - Base quickness value
   * @param {number} config.quicknessCoefficient - Individual quickness multiplier
   * @param {number} config.colorSeparation - Base color-separation value
   * @param {number} config.colorSeparationCoefficient - Individual colorSeparation multiplier
   * @param {number} config.speedIndex - Base speed factor
   * @param {number} config.reactionDelayMs - Alignment reaction delay in milliseconds
   */
  constructor(config) {
    this.id = config.id;
    this.group = config.group;
    this.scale = config.scale;
    this.colorId = config.colorId;

    this.position = createVector(config.x, config.y);

    // Individual variation coefficients
    this.introversionCoefficient = config.introversionCoefficient;
    this.introversion = config.introversion * this.introversionCoefficient;
    this.quicknessCoefficient = config.quicknessCoefficient;
    this.quickness = config.quickness * this.quicknessCoefficient;
    this.colorSeparationCoefficient = config.colorSeparationCoefficient;
    this.colorSeparation = config.colorSeparation * this.colorSeparationCoefficient;

    // Speed
    this.speedIndex = config.speedIndex;
    this.maxSpeed = this.speedIndex * this.quickness;
    this.maxForce = config.maxForce;
    this.reactionDelayMs = Math.max(0, config.reactionDelayMs ?? 0);
    this.velocityHistory = [];

    // Smaller interaction radius
    this.radius = this.scale * 160;
    this.mass = Math.pow(this.scale, 3) * 0.8;

    // Random initial velocity
    const angle = random(-PI, PI);
    this.velocity = p5.Vector.fromAngle(angle).mult(this.maxSpeed * 0.5);

    // Renderer
    this.goldfish = new Goldfish(
      this.position.copy(),
      this.scale,
      config.bodyColor,
      config.finColor,
      config.patchConfig,
      this.velocity.heading(),
    );

    // Grab state
    this.isGrabbed = false;

    // Eating cooldown (faster than normal fish)
    this.lastEatTime = 0;
    this.eatCooldown = 250;
  }

  /**
   * Hit test center: offset from head toward body center
   */
  get hitCenter() {
    const offset = this.scale * 72;
    const heading = this.velocity.heading();
    return createVector(
      this.position.x - cos(heading) * offset,
      this.position.y - sin(heading) * offset
    );
  }

  // === Goldfish-specific Boid behaviors ===

  /**
   * Separation with colorSeparation logic
   */
  separate(allBoids) {
    const sum = createVector(0, 0);
    let count = 0;
    for (let j = 0; j < allBoids.length; j++) {
      if (allBoids[j] === this) continue;
      const colorSeparationMultiplier = (this.colorId !== allBoids[j].colorId) ? this.colorSeparation : 0;
      const desiredSep = this.radius + allBoids[j].radius + (20 * this.introversion) + (40 * colorSeparationMultiplier);
      const sep = p5.Vector.dist(this.position, allBoids[j].position);
      if (sep > 0 && sep < desiredSep) {
        const diff = p5.Vector.sub(this.position, allBoids[j].position).normalize().div(sep);
        sum.add(diff);
        count++;
      }
    }
    if (count > 0) {
      sum.div(count);
      sum.normalize();
      sum.mult(this.maxSpeed);
      sum.sub(this.velocity);
      sum.limit(this.maxForce);
    }
    return sum;
  }

  /**
   * Alignment: match nearby boids' heading
   */
  align(allBoids, updateTime = millis()) {
    const neighborDist = 250;
    const targetTime = updateTime - this.reactionDelayMs;
    const sum = createVector(0, 0);
    let count = 0;
    for (let i = 0; i < allBoids.length; i++) {
      if (allBoids[i] === this) continue;
      if (allBoids[i].isGrabbed) continue;
      const dist = p5.Vector.dist(this.position, allBoids[i].position);
      if (dist > 0 && dist < neighborDist) {
        sum.add(allBoids[i].getVelocityAt(targetTime));
        count++;
      }
    }
    if (count > 0) {
      sum.div(count);
      sum.normalize();
      sum.mult(this.maxSpeed);
      sum.sub(this.velocity);
      sum.limit(this.maxForce);
      return sum;
    }
    return createVector(0, 0);
  }

  /**
   * Cohesion: steer toward average position of neighbors
   */
  cohesion(allBoids) {
    const neighborDist = 250;
    const sum = createVector(0, 0);
    let count = 0;
    for (let i = 0; i < allBoids.length; i++) {
      if (allBoids[i] === this) continue;
      if (allBoids[i].isGrabbed) continue;
      const dist = p5.Vector.dist(this.position, allBoids[i].position);
      if (dist > 0 && dist < neighborDist) {
        sum.add(allBoids[i].position);
        count++;
      }
    }
    if (count > 0) {
      sum.div(count);
      return this.seek(sum);
    }
    return createVector(0, 0);
  }

  /**
   * Apply all flocking forces (within group)
   */
  flock(sameGroupBoids, settings, updateTime = millis()) {
    const alignForce = this.align(sameGroupBoids, updateTime);
    const separateForce = this.separate(sameGroupBoids);
    const cohesionForce = this.cohesion(sameGroupBoids);

    this.applyForce(alignForce, 1.4);
    this.applyForce(separateForce, 0.8);
    this.applyForce(cohesionForce, 1.2);

    if (settings.mouseSeek) {
      const mouseForce = this.seek(settings.mousePos);
      this.applyForce(mouseForce, 0.3);
    }

    if (settings.feedMode && settings.foods && settings.foods.length > 0) {
      let closestFood = null;
      let closestDist = Infinity;
      for (let i = 0; i < settings.foods.length; i++) {
        const d = p5.Vector.dist(this.position, settings.foods[i].position);
        if (d < closestDist) {
          closestDist = d;
          closestFood = settings.foods[i];
        }
      }
      if (closestFood) {
        const foodForce = this.seek(closestFood.position);
        this.applyForce(foodForce, 1.0);
      }
    }

    if (settings.walls) {
      const wallForce = this.avoidWalls(settings.canvasW, settings.canvasH, settings.center);
      if (wallForce) this.applyForce(wallForce, 1.2);
    }
  }

  /**
   * Physics update: movement + collision + boundary + IK
   */
  physicsUpdate(sameGroupBoids, settings) {
    this.position.add(this.velocity);
    if (settings.collisions) this.detectCollision(sameGroupBoids);
    this.edgeCheck(settings.walls, settings.canvasW, settings.canvasH);
    const dt = 1 / 60;
    this.goldfish.resolveToPosition(this.position.copy(), this.velocity, dt);
  }

  /**
   * Update render position only (for grabbed state)
   */
  resolveRenderPosition() {
    const dt = 1 / 60;
    this.goldfish.resolveToPosition(this.position.copy(), this.velocity, dt);
  }

  display() {
    this.goldfish.display();
  }

  /**
   * Border wrap with resetSpine (overrides BoidPhysics default)
   */
  borderWrap(w, h) {
    let wrapped = false;
    const margin = this.radius + 200;
    if (this.position.x < -margin) { this.position.x = w + margin; wrapped = true; }
    else if (this.position.x > w + margin) { this.position.x = -margin; wrapped = true; }
    if (this.position.y < -margin) { this.position.y = h + margin; wrapped = true; }
    else if (this.position.y > h + margin) { this.position.y = -margin; wrapped = true; }
    if (wrapped) {
      this.goldfish.resetSpine(this.position, this.velocity.heading());
    }
  }
}

// Mixin common physics methods (seek, applyForce, edgeCheck, collision, etc.)
applyBoidPhysics(GoldfishBoid);
