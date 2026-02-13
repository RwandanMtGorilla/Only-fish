/**
 * PetalBoid class - Lotus petal with spring attachment, detach, and fade-out
 * Three states: attached -> detached -> dead
 * @module animals/lotus/PetalBoid
 */

import { Petal } from './Petal.js';
import { applyBoidPhysics } from '../../boids/BoidPhysics.js';

export class PetalBoid {
  /**
   * @param {Object} config
   * @param {LotusCenterBoid} config.parentCenter - Parent lotus center boid
   * @param {number} config.angleOffset - Radial angle from center
   * @param {number} config.distanceFromCenter - Default distance from center
   * @param {number} config.layerIndex - Layer (0=inner, 1=mid, 2=outer)
   */
  constructor(config) {
    this.id = config.id;
    this.group = config.group;
    this.scale = config.scale;
    this.colorId = config.colorId;

    this.position = createVector(config.x, config.y);
    this.velocity = createVector(0, 0);

    // Interface compatibility coefficients
    this.introversionCoefficient = config.introversionCoefficient;
    this.introversion = config.introversion * this.introversionCoefficient;
    this.quicknessCoefficient = config.quicknessCoefficient;
    this.quickness = config.quickness * this.quicknessCoefficient;
    this.racismCoefficient = config.racismCoefficient;
    this.racism = config.racism * this.racismCoefficient;
    this.speedIndex = config.speedIndex;

    // Type marker
    this.isPetal = true;

    // Parent lotus center reference
    this.parentCenter = config.parentCenter;
    this.angleOffset = config.angleOffset;
    this.distanceFromCenter = config.distanceFromCenter;
    this.layerIndex = config.layerIndex;

    // State: attached / detached / dead
    this.isDetached = false;
    this.isDead = false;

    // Spring connection to center
    this.springK = 0.42;
    this.detachThreshold = this.distanceFromCenter * 3.4;

    // Fade-out timing (after detach)
    this.detachTime = 0;
    this.fadeDelay = 10000;    // Start fading 10s after detach
    this.fadeDuration = 8000;  // Fade over 8s

    // Physics
    this.radius = this.scale * 25;
    this.stemRadius = 0;  // Attached: no cross-group separation
    // hitRadius set after renderer init (needs petalLength)
    this.mass = 0.1;
    this.maxSpeed = 1.5;
    this.maxForce = 0.15;
    this.friction = 0.985;  // Low drag when detached (floats on water)

    // Grab state
    this.isGrabbed = false;
    this.grabThrash = false;

    // No eating
    // (eatCooldown undefined -> skipped in food collision)

    // Renderer
    this.petal = new Petal(
      this.position.copy(),
      this.scale,
      config.bodyColor,
      config.finColor,
      this.layerIndex
    );

    // Hit radius covers petal area (based on actual petal length)
    this.hitRadius = Math.max(this.petal.petalLength * 0.5, this.scale * 25);

    // Track current angle for hitCenter calculation
    this.angle = config.angleOffset;
  }

  /**
   * Collision center at petal geometric center (matches hitCenter)
   */
  get collisionCenter() {
    return this.hitCenter;
  }

  /**
   * Hit center at petal geometric center (not root)
   */
  get hitCenter() {
    const offset = this.petal.petalLength * 0.45;
    const a = this.angle || this.angleOffset;
    return createVector(
      this.position.x + cos(a) * offset,
      this.position.y + sin(a) * offset
    );
  }

  // === Petal Boid behaviors ===

  flock(sameGroupBoids, settings) {
    if (this.isDead) return;

    if (!this.isDetached) {
      // === Attached: spring force toward target position on center ===
      const target = this._getAttachPosition();
      const springForce = p5.Vector.sub(target, this.position).mult(this.springK);
      this.velocity.add(springForce);
      // Newton's third law: reaction force on center (attenuated by mass ratio)
      this.parentCenter.velocity.add(springForce.copy().mult(-0.3));
    } else {
      // === Detached: passive floating, only wall avoidance ===
      if (settings.walls) {
        const wallForce = this.avoidWalls(settings.canvasW, settings.canvasH, settings.center);
        if (wallForce) this.applyForce(wallForce, 0.3);
      }
    }
  }

  /**
   * Calculate target position on the lotus center
   */
  _getAttachPosition() {
    const cx = this.parentCenter.position.x;
    const cy = this.parentCenter.position.y;
    return createVector(
      cx + cos(this.angleOffset) * this.distanceFromCenter,
      cy + sin(this.angleOffset) * this.distanceFromCenter
    );
  }

  /**
   * Check if petal should detach from center
   */
  _checkDetach() {
    if (this.isDetached) return;
    const dist = p5.Vector.dist(this.position, this.parentCenter.position);
    if (dist > this.detachThreshold) {
      this._detach();
    }
  }

  _detach() {
    this.isDetached = true;
    this.stemRadius = this.radius; // Start participating in cross-group separation
    this.maxSpeed = 2.0;
    this.maxForce = 0.2;
    this.detachTime = millis();
    // Remove from parent's petal list
    const idx = this.parentCenter.petals.indexOf(this);
    if (idx >= 0) this.parentCenter.petals.splice(idx, 1);
  }

  /**
   * Cross-group separation: only when detached
   */
  separateFromOthers(allBoids, ownGroup) {
    if (!this.isDetached || this.isDead) return;
    const myCenter = this.position;
    const sum = createVector(0, 0);
    let count = 0;
    for (let j = 0; j < allBoids.length; j++) {
      const other = allBoids[j];
      if (other === this) continue;
      if (other.group === ownGroup) continue;
      const otherCenter = other.collisionCenter || other.position;
      const desiredSep = this.radius + (other.stemRadius ?? other.radius) + 30;
      const sep = p5.Vector.dist(myCenter, otherCenter);
      if (sep > 0 && sep < desiredSep) {
        const diff = p5.Vector.sub(myCenter, otherCenter).normalize().div(sep);
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
   * Collision detection: only when detached
   */
  detectCollision(allBoids) {
    if (!this.isDetached || this.isDead) return;
    const myCenter = this.position;
    for (let i = 0; i < allBoids.length; i++) {
      if (allBoids[i] === this) continue;
      if (allBoids[i].isGrabbed) continue;
      // Skip other attached petals
      if (allBoids[i].isPetal && !allBoids[i].isDetached) continue;
      const otherCenter = allBoids[i].collisionCenter || allBoids[i].position;
      const dist = p5.Vector.dist(myCenter, otherCenter);
      if (dist - (this.radius + allBoids[i].radius) < 0) {
        this.resolveCollision(this, allBoids[i]);
      }
    }
  }

  physicsUpdate(sameGroupBoids, settings) {
    if (this.isDead) return;

    // Check detach on every frame (catches release-after-drag)
    this._checkDetach();

    if (!this.isDetached) {
      // Attached: strong damping for quick convergence (less oscillation)
      this.velocity.mult(0.7);
      this.position.add(this.velocity);
    } else {
      // Detached: water surface floating
      this.velocity.mult(this.friction);
      if (this.velocity.mag() < 0.01) this.velocity.set(0, 0);
      this.position.add(this.velocity);

      if (settings.collisions) this.detectCollision(sameGroupBoids);

      // Fade-out timer
      const elapsed = millis() - this.detachTime;
      if (elapsed > this.fadeDelay) {
        const fadeProgress = elapsed - this.fadeDelay;
        this.petal.alpha = Math.max(0, map(fadeProgress, 0, this.fadeDuration, 255, 0));
        if (this.petal.alpha <= 0) {
          this.isDead = true;
          this.stemRadius = 0;
          return;
        }
      }
    }

    this.edgeCheck(settings.walls, settings.canvasW, settings.canvasH);

    // Update render position and angle
    const renderAngle = this.isDetached
      ? (this.angle || this.angleOffset)
      : atan2(
        this.position.y - this.parentCenter.position.y,
        this.position.x - this.parentCenter.position.x
      );
    this.angle = renderAngle;
    this.petal.resolveToPosition(this.position.copy(), renderAngle);
  }

  resolveRenderPosition() {
    if (!this.isDetached) {
      // Spring reaction force on center (flock() is skipped for grabbed boids)
      const target = this._getAttachPosition();
      const springForce = p5.Vector.sub(target, this.position).mult(this.springK);
      this.parentCenter.velocity.add(springForce.copy().mult(-0.3));
      // Check detach during grab (physicsUpdate is skipped for grabbed boids)
      this._checkDetach();
    }
    const renderAngle = !this.isDetached
      ? atan2(
        this.position.y - this.parentCenter.position.y,
        this.position.x - this.parentCenter.position.x
      )
      : (this.angle || this.angleOffset);
    this.angle = renderAngle;
    this.petal.resolveToPosition(this.position.copy(), renderAngle);
  }

  display() {
    if (this.isDead) return;
    this.petal.display();
  }

  borderWrap(w, h) {
    const margin = this.radius + 50;
    if (this.position.x < -margin) this.position.x = w + margin;
    else if (this.position.x > w + margin) this.position.x = -margin;
    if (this.position.y < -margin) this.position.y = h + margin;
    else if (this.position.y > h + margin) this.position.y = -margin;
  }
}

// Mixin common physics methods (won't override our custom separateFromOthers, detectCollision)
applyBoidPhysics(PetalBoid);
