/**
 * Chain class for inverse kinematics simulation
 * Represents a chain of joints connected by links
 * Migrated from Processing Chain.pde
 * @module core/Chain
 */

import { constrainDistance, constrainAngle } from '../utils/geometry.js';

/**
 * A chain of joints connected by links, using IK for animation
 * Supports both angle-constrained resolution and FABRIK algorithm
 */
export class Chain {
  /**
   * @param {p5.Vector} origin - Starting position
   * @param {number} jointCount - Number of joints in the chain (must be >= 2)
   * @param {number|number[]} linkSize - Distance between joints (uniform or per-segment array)
   * @param {number} angleConstraint - Max angle difference between adjacent joints (default: TWO_PI = no constraint)
   */
  constructor(origin, jointCount, linkSize, angleConstraint = TWO_PI) {
    // Support per-segment link sizes: store as array
    if (Array.isArray(linkSize)) {
      this.linkSizes = linkSize;
      this.linkSize = linkSize[0]; // backward compat for spine resolve()
    } else {
      this.linkSize = linkSize;
      this.linkSizes = null;
    }
    this.angleConstraint = angleConstraint;
    this.joints = []; // Array of p5.Vector
    this.angles = []; // Array of floats

    // Add first joint
    this.joints.push(origin.copy());
    this.angles.push(0);

    // Add remaining joints
    for (let i = 1; i < jointCount; i++) {
      const size = this.linkSizes ? this.linkSizes[i - 1] : this.linkSize;
      this.joints.push(p5.Vector.add(
        this.joints[i - 1],
        createVector(0, size)
      ));
      this.angles.push(0);
    }
  }

  /**
   * Resolve chain position using angle constraints (forward kinematics)
   * @param {p5.Vector} pos - Target position for the head of the chain
   * @param {number} maxHeadTurn - Maximum heading change per simulation tick
   * @param {number} maxHeadTurn - Maximum heading change per simulation tick
   */
  resolve(pos, maxHeadTurn = TWO_PI) {
    const movement = p5.Vector.sub(pos, this.joints[0]);
    // A stationary head has no new direction. Ignore numerical arrival noise.
    if (movement.mag() > 1e-4) {
      this.angles[0] = constrainAngle(movement.heading(), this.angles[0], maxHeadTurn);
    }
    this.joints[0] = pos;

    for (let i = 1; i < this.joints.length; i++) {
      const size = this.linkSizes ? this.linkSizes[i - 1] : this.linkSize;
      const curAngle = p5.Vector.sub(this.joints[i - 1], this.joints[i]).heading();
      this.angles[i] = constrainAngle(curAngle, this.angles[i - 1], this.angleConstraint);
      this.joints[i] = p5.Vector.sub(
        this.joints[i - 1],
        p5.Vector.fromAngle(this.angles[i]).setMag(size)
      );
    }
  }

  /**
   * Resolve chain using FABRIK algorithm (Forward And Backward Reaching Inverse Kinematics)
   * @param {p5.Vector} pos - Target position for the head
   * @param {p5.Vector} anchor - Anchor position for the tail
   */
  fabrikResolve(pos, anchor) {
    // Forward pass - from head to tail
    this.joints[0] = pos;
    for (let i = 1; i < this.joints.length; i++) {
      const size = this.linkSizes ? this.linkSizes[i - 1] : this.linkSize;
      this.joints[i] = constrainDistance(this.joints[i], this.joints[i-1], size);
    }

    // Backward pass - from tail to head
    this.joints[this.joints.length - 1] = anchor;
    for (let i = this.joints.length - 2; i >= 0; i--) {
      const size = this.linkSizes ? this.linkSizes[i] : this.linkSize;
      this.joints[i] = constrainDistance(this.joints[i], this.joints[i+1], size);
    }
  }

  /**
   * Debug visualization of chain structure
   * Draws all joints and links
   */
  display() {
    strokeWeight(8);
    stroke(255);

    // Draw links
    for (let i = 0; i < this.joints.length - 1; i++) {
      const startJoint = this.joints[i];
      const endJoint = this.joints[i + 1];
      line(startJoint.x, startJoint.y, endJoint.x, endJoint.y);
    }

    // Draw joints
    fill(42, 44, 53);
    for (const joint of this.joints) {
      ellipse(joint.x, joint.y, 32, 32);
    }
  }
}
