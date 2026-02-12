/**
 * Fish class - Scalable, colorable procedural fish rendering
 * Based on animal-proc-anim Fish.js, adapted for boids integration
 * @module animals/fish/Fish
 */

import { Chain } from '../../core/Chain.js';
import { relativeAngleDiff } from '../../utils/geometry.js';

export class Fish {
  /**
   * @param {p5.Vector} origin - Starting position
   * @param {number} scale - Size scale factor (0.25 - 0.55 recommended)
   * @param {p5.Color} bodyColor - Body fill color
   * @param {p5.Color} finColor - Fin fill color
   */
  constructor(origin, scale = 1.0, bodyColor = null, finColor = null) {
    this.scale = scale;

    // Scaled spine: 12 segments, first 10 for body, last 2 for caudal fin
    this.linkSize = Math.round(64 * scale);
    this.spine = new Chain(origin, 12, this.linkSize, PI / 8);

    this.bodyColor = bodyColor || color(58, 124, 165);
    this.finColor = finColor || color(129, 195, 215);

    // Width of the fish at each vertebra, scaled
    this.bodyWidth = [68, 81, 84, 83, 77, 64, 51, 38, 32, 19].map(w => w * scale);
  }

  /**
   * Drive the fish spine to a new head position (called by FishBoid)
   * @param {p5.Vector} pos - New head position
   */
  resolveToPosition(pos) {
    this.spine.resolve(pos);
  }

  /**
   * Reinitialize the spine at a new position (used when wrapping around screen edges)
   * @param {p5.Vector} pos - New head position
   * @param {number} headingAngle - Direction the fish is facing (radians)
   */
  resetSpine(pos, headingAngle) {
    for (let i = 0; i < this.spine.joints.length; i++) {
      this.spine.joints[i].x = pos.x - cos(headingAngle) * this.linkSize * i;
      this.spine.joints[i].y = pos.y - sin(headingAngle) * this.linkSize * i;
      this.spine.angles[i] = headingAngle;
    }
  }

  /**
   * Render the fish with all body parts
   */
  display() {
    const s = this.scale;
    strokeWeight(4 * s);
    stroke(255);
    fill(this.finColor);

    const j = this.spine.joints;
    const a = this.spine.angles;

    const headToMid1 = relativeAngleDiff(a[0], a[6]);
    const headToMid2 = relativeAngleDiff(a[0], a[7]);
    const headToTail = headToMid1 + relativeAngleDiff(a[6], a[11]);

    // === PECTORAL FINS ===
    push();
    translate(this._getPosX(3, PI / 3, 0), this._getPosY(3, PI / 3, 0));
    rotate(a[2] - PI / 4);
    ellipse(0, 0, 160 * s, 64 * s);
    pop();
    push();
    translate(this._getPosX(3, -PI / 3, 0), this._getPosY(3, -PI / 3, 0));
    rotate(a[2] + PI / 4);
    ellipse(0, 0, 160 * s, 64 * s);
    pop();

    // === VENTRAL FINS ===
    push();
    translate(this._getPosX(7, PI / 2, 0), this._getPosY(7, PI / 2, 0));
    rotate(a[6] - PI / 4);
    ellipse(0, 0, 96 * s, 32 * s);
    pop();
    push();
    translate(this._getPosX(7, -PI / 2, 0), this._getPosY(7, -PI / 2, 0));
    rotate(a[6] + PI / 4);
    ellipse(0, 0, 96 * s, 32 * s);
    pop();

    // === CAUDAL FIN ===
    beginShape();
    for (let i = 8; i < 12; i++) {
      const tailWidth = 1.5 * headToTail * (i - 8) * (i - 8);
      curveVertex(j[i].x + cos(a[i] - PI / 2) * tailWidth, j[i].y + sin(a[i] - PI / 2) * tailWidth);
    }
    for (let i = 11; i >= 8; i--) {
      const tailWidth = max(-13 * s, min(13 * s, headToTail * 6));
      curveVertex(j[i].x + cos(a[i] + PI / 2) * tailWidth, j[i].y + sin(a[i] + PI / 2) * tailWidth);
    }
    endShape(CLOSE);

    fill(this.bodyColor);

    // === BODY ===
    beginShape();
    for (let i = 0; i < 10; i++) {
      curveVertex(this._getPosX(i, PI / 2, 0), this._getPosY(i, PI / 2, 0));
    }
    curveVertex(this._getPosX(9, PI, 0), this._getPosY(9, PI, 0));
    for (let i = 9; i >= 0; i--) {
      curveVertex(this._getPosX(i, -PI / 2, 0), this._getPosY(i, -PI / 2, 0));
    }
    curveVertex(this._getPosX(0, -PI / 6, 0), this._getPosY(0, -PI / 6, 0));
    curveVertex(this._getPosX(0, 0, 4 * s), this._getPosY(0, 0, 4 * s));
    curveVertex(this._getPosX(0, PI / 6, 0), this._getPosY(0, PI / 6, 0));
    curveVertex(this._getPosX(0, PI / 2, 0), this._getPosY(0, PI / 2, 0));
    curveVertex(this._getPosX(1, PI / 2, 0), this._getPosY(1, PI / 2, 0));
    curveVertex(this._getPosX(2, PI / 2, 0), this._getPosY(2, PI / 2, 0));
    curveVertex(this._getPosX(3, PI / 2, 0), this._getPosY(3, PI / 2, 0));
    endShape();

    fill(this.finColor);

    // === DORSAL FIN ===
    beginShape();
    vertex(j[4].x, j[4].y);
    bezierVertex(j[5].x, j[5].y, j[6].x, j[6].y, j[7].x, j[7].y);
    bezierVertex(
      j[6].x + cos(a[6] + PI / 2) * headToMid2 * 16 * s,
      j[6].y + sin(a[6] + PI / 2) * headToMid2 * 16 * s,
      j[5].x + cos(a[5] + PI / 2) * headToMid1 * 16 * s,
      j[5].y + sin(a[5] + PI / 2) * headToMid1 * 16 * s,
      j[4].x,
      j[4].y
    );
    endShape();

    // === EYES ===
    fill(255);
    ellipse(this._getPosX(0, PI / 2, -18 * s), this._getPosY(0, PI / 2, -18 * s), 24 * s, 24 * s);
    ellipse(this._getPosX(0, -PI / 2, -18 * s), this._getPosY(0, -PI / 2, -18 * s), 24 * s, 24 * s);
  }

  /**
   * Debug display showing spine structure
   */
  debugDisplay() {
    this.spine.display();
  }

  _getPosX(i, angleOffset, lengthOffset) {
    return this.spine.joints[i].x +
           cos(this.spine.angles[i] + angleOffset) *
           (this.bodyWidth[i] + lengthOffset);
  }

  _getPosY(i, angleOffset, lengthOffset) {
    return this.spine.joints[i].y +
           sin(this.spine.angles[i] + angleOffset) *
           (this.bodyWidth[i] + lengthOffset);
  }
}
