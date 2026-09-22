/**
 * LilypadBoid class - Static floating lilypad with collision response
 * Does not actively move or eat; pushed by collisions, slows via friction
 * Dual collision radii: leaf-level (same group) vs stem-level (cross-group)
 * @module animals/lilypad/LilypadBoid
 */

import { Lilypad } from './Lilypad.js';
import { applyBoidPhysics } from '../../boids/BoidPhysics.js';

export class LilypadBoid {
  /**
   * @param {Object} config
   */
  constructor(config) {
    this.id = config.id;
    this.group = config.group;
    this.scale = config.scale;
    this.colorId = config.colorId;

    this.position = createVector(config.x, config.y);


    // Speed: high enough for collision response, friction keeps it still otherwise
    this.maxSpeed = config.maxSpeed;
    this.maxForce = config.maxForce;

    // Leaf-level radius (used for same-group collision between lilypads)
    this.radius = this.scale * 120;
    // Stem-level radius (used for cross-group separation with fish/turtles)
    this.stemRadius = this.scale * 7;
    // Hit test uses leaf radius
    this.hitRadius = this.scale * 100;

    // Heavy mass (hard to push)
    this.mass = Math.pow(this.scale, 2) * 8;

    // Start stationary
    this.velocity = createVector(0, 0);

    // Friction: velocity decays each frame
    this.friction = 0.96;

    // Spring anchor: lilypad returns to this point after being pushed
    this.anchor = this.position.copy();
    this.springK = 0.01;

    // Type marker
    this.isLilypad = true;

    // Renderer
    this.lilypad = new Lilypad(this.position.copy(), this.scale, config.bodyColor, config.finColor);

    // Grab state (no thrashing)
    this.isGrabbed = false;
    this.grabThrash = false;

    // No eating (eatCooldown undefined -> skipped in food collision)
  }

  // === Lilypad-specific Boid behaviors ===

  /**
   * Separation only (no alignment, cohesion, mouseSeek, foodSeek)
   */
  flock(sameGroupBoids, settings) {
    // Spring force: pull back toward anchor (F = k * displacement)
    const springForce = p5.Vector.sub(this.anchor, this.position).mult(this.springK);
    this.velocity.add(springForce);

    this.separate(sameGroupBoids);

    if (settings.walls) {
      const wallForce = this.avoidWalls(settings.canvasW, settings.canvasH, settings.center);
      if (wallForce) this.applyForce(wallForce, 0.5);
    }
  }

  /**
   * Linear spring repulsion between lilypads (leaf-level)
   * F = k * overlap, where overlap = desiredSep - distance
   */
  separate(allBoids) {
    const k = 0.01;
    for (let j = 0; j < allBoids.length; j++) {
      if (allBoids[j] === this) continue;
      if (allBoids[j].isPetal) continue;
      const desiredSep = this.radius + allBoids[j].radius;
      const sep = p5.Vector.dist(this.position, allBoids[j].position);
      if (sep > 0 && sep < desiredSep) {
        const overlap = desiredSep - sep;
        const force = p5.Vector.sub(this.position, allBoids[j].position).normalize().mult(overlap * k);
        this.velocity.add(force);
      }
    }
  }

  /**
   * Cross-group separation using stem radius (smaller, fish can swim under leaves)
   * Overrides BoidPhysics.separateFromOthers to use stemRadius instead of radius
   */
  separateFromOthers(allBoids, ownGroup) {
    const sum = createVector(0, 0);
    let count = 0;
    for (let j = 0; j < allBoids.length; j++) {
      const other = allBoids[j];
      if (other === this) continue;
      if (other.group === ownGroup) continue;
      const otherCenter = other.collisionCenter || other.position;
      // Use stemRadius for lilypad's contribution to desired separation
      const desiredSep = this.stemRadius + other.radius + 30;
      const sep = p5.Vector.dist(this.position, otherCenter);
      if (sep > 0 && sep < desiredSep) {
        const diff = p5.Vector.sub(this.position, otherCenter).normalize().div(sep);
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
      this.applyForce(sum, 1.0);
    }
  }

  /**
   * Collision detection: skip petals (both attached and detached)
   */
  detectCollision(allBoids) {
    const myCenter = this.position;
    for (let i = 0; i < allBoids.length; i++) {
      if (allBoids[i] === this) continue;
      if (allBoids[i].isGrabbed) continue;
      if (allBoids[i].isPetal) continue;
      const otherCenter = allBoids[i].collisionCenter || allBoids[i].position;
      const dist = p5.Vector.dist(myCenter, otherCenter);
      if (dist - (this.radius + allBoids[i].radius) < 0) {
        this.resolveCollision(this, allBoids[i]);
      }
    }
  }

  /**
   * Physics: friction decay + movement + collision + boundary
   */
  physicsUpdate(sameGroupBoids, settings) {
    // Friction: slow down each frame
    this.velocity.mult(this.friction);
    if (this.velocity.mag() < 0.01) {
      this.velocity.set(0, 0);
    }

    this.position.add(this.velocity);

    if (settings.collisions) this.detectCollision(sameGroupBoids);
    this.edgeCheck(settings.walls, settings.canvasW, settings.canvasH);

    this.lilypad.resolveToPosition(this.position.copy());
  }

  resolveRenderPosition() {
    this.lilypad.resolveToPosition(this.position.copy());
  }

  display() {
    this.lilypad.display();
  }

  /**
   * Border wrap (no spine to reset)
   */
  borderWrap(w, h) {
    const margin = this.radius + 50;
    if (this.position.x < -margin) this.position.x = w + margin;
    else if (this.position.x > w + margin) this.position.x = -margin;
    if (this.position.y < -margin) this.position.y = h + margin;
    else if (this.position.y > h + margin) this.position.y = -margin;
  }
}

// Mixin common physics methods (won't override separateFromOthers since we defined it above)
applyBoidPhysics(LilypadBoid);
