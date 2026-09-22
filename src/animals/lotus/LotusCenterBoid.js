/**
 * LotusCenterBoid class - Lotus center (seed pod) with lilypad-like physics
 * Manages petal references, syncs petals on border wrap
 * @module animals/lotus/LotusCenterBoid
 */

import { LotusCenter } from './LotusCenter.js';
import { applyBoidPhysics } from '../../boids/BoidPhysics.js';

export class LotusCenterBoid {
  /**
   * @param {Object} config
   */
  constructor(config) {
    this.id = config.id;
    this.group = config.group;
    this.scale = config.scale;
    this.colorId = config.colorId;

    this.position = createVector(config.x, config.y);
    this.velocity = createVector(0, 0);


    // Type marker
    this.isCenter = true;

    // Collision radii
    this.radius = this.scale * 50;
    this.hitRadius = this.scale * 40;

    // Heavy mass (hard to push)
    this.mass = Math.pow(this.scale, 2) * 6;

    // Physics (lilypad-like)
    this.maxSpeed = config.maxSpeed;
    this.maxForce = config.maxForce;
    this.friction = 0.96;

    // Spring anchor
    this.anchor = this.position.copy();
    this.springK = 0.015;

    // Petals managed by this center (filled by customCreateBoids)
    this.petals = [];

    // Grab state (no thrashing)
    this.isGrabbed = false;
    this.grabThrash = false;

    // No eating
    // (eatCooldown undefined -> skipped in food collision)

    // Renderer
    this.renderer = new LotusCenter(
      this.position.copy(),
      this.scale,
      config.bodyColor,
      config.finColor
    );
  }

  // === Lotus center Boid behaviors ===

  flock(sameGroupBoids, settings) {
    // Spring force: pull back toward anchor
    const springForce = p5.Vector.sub(this.anchor, this.position).mult(this.springK);
    this.velocity.add(springForce);

    // Same-group separation (only against other centers, skip petals)
    this.separate(sameGroupBoids);

    if (settings.walls) {
      const wallForce = this.avoidWalls(settings.canvasW, settings.canvasH, settings.center);
      if (wallForce) this.applyForce(wallForce, 0.5);
    }
  }

  /**
   * Separation: only against other centers (skip petals)
   */
  separate(allBoids) {
    const k = 0.01;
    for (let j = 0; j < allBoids.length; j++) {
      if (allBoids[j] === this) continue;
      // Skip petals - only separate from other centers
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
   * Cross-group separation using stem radius (fish can swim under)
   */
  separateFromOthers(allBoids, ownGroup) {
    const sum = createVector(0, 0);
    let count = 0;
    for (let j = 0; j < allBoids.length; j++) {
      const other = allBoids[j];
      if (other === this) continue;
      if (other.group === ownGroup) continue;
      const otherCenter = other.collisionCenter || other.position;
      const desiredSep = this.radius + other.radius + 30;
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
      if (allBoids[i].isPetal) continue; // Never collide with petals
      const otherCenter = allBoids[i].collisionCenter || allBoids[i].position;
      const dist = p5.Vector.dist(myCenter, otherCenter);
      if (dist - (this.radius + allBoids[i].radius) < 0) {
        this.resolveCollision(this, allBoids[i]);
      }
    }
  }

  physicsUpdate(sameGroupBoids, settings) {
    this.velocity.mult(this.friction);
    if (this.velocity.mag() < 0.01) this.velocity.set(0, 0);
    this.position.add(this.velocity);
    if (settings.collisions) this.detectCollision(sameGroupBoids);
    this.edgeCheck(settings.walls, settings.canvasW, settings.canvasH);
    this.renderer.resolveToPosition(this.position.copy());
  }

  resolveRenderPosition() {
    this.renderer.resolveToPosition(this.position.copy());
  }

  display() {
    this.renderer.display();
  }

  /**
   * Border wrap: sync all attached petals when center wraps
   */
  borderWrap(w, h) {
    const prevX = this.position.x;
    const prevY = this.position.y;

    const margin = this.radius + 50;
    if (this.position.x < -margin) this.position.x = w + margin;
    else if (this.position.x > w + margin) this.position.x = -margin;
    if (this.position.y < -margin) this.position.y = h + margin;
    else if (this.position.y > h + margin) this.position.y = -margin;

    const dx = this.position.x - prevX;
    const dy = this.position.y - prevY;
    if (dx !== 0 || dy !== 0) {
      // Teleport all attached petals along with center
      for (const petal of this.petals) {
        if (!petal.isDetached) {
          petal.position.x += dx;
          petal.position.y += dy;
        }
      }
      this.anchor.set(this.position.x, this.position.y);
    }
  }
}

// Mixin common physics methods (won't override our custom separateFromOthers)
applyBoidPhysics(LotusCenterBoid);
