/**
 * Fish class - Scalable, colorable procedural fish rendering
 * Based on animal-proc-anim Fish.js, adapted for boids integration
 * @module animals/fish/Fish
 */

import { PectoralFin, updatePectoralFins, drawPectoralFin } from '../../core/PectoralFin.js';
import { FishLocomotion } from '../../core/FishLocomotion.js';

export class Fish {
  /**
   * @param {p5.Vector} origin - Starting position
   * @param {number} scale - Size scale factor (0.25 - 0.55 recommended)
   * @param {p5.Color} bodyColor - Body fill color
   * @param {p5.Color} finColor - Fin fill color
   */
  constructor(origin, scale = 1.0, bodyColor = null, finColor = null, heading = 0) {
    this.scale = scale;

    // Scaled spine: 12 segments, first 10 for body, last 2 for caudal fin
    this.linkSize = Math.round(64 * scale);
    this.locomotion = new FishLocomotion(origin, 12, this.linkSize, heading, {
      maxBend: PI / 6,
      gait: {
        beta: 0.88 + random(-0.025, 0.025),
        waveNum: 0.65 + random(-0.04, 0.04),
        tipAmpMax: 0.10 + random(-0.008, 0.008),
      },
      spine: {
        tailLimp: 0.40,
        // Head, firm forebody, flexible peduncle, then the two caudal-fin joints.
        bendLimits: [0, 3, 4, 5, 6, 8, 11, 15, 20, 25, 30, 30]
          .map(degrees => degrees * Math.PI / 180),
      },
    });
    this.spine = this.locomotion.spine;

    this.bodyColor = bodyColor || color(58, 124, 165);
    this.finColor = finColor || color(129, 195, 215);

    // Width of the fish at each vertebra, scaled
    this.bodyWidth = [68, 81, 84, 83, 77, 64, 51, 38, 32, 19].map(w => w * scale);
    this.pectoralJoint = 3;
    this.leftPecFin = new PectoralFin(origin, 21 * scale);
    this.rightPecFin = new PectoralFin(origin, 21 * scale);
    this.finWidths = [18, 23, 18, 10, 0].map(w => w * scale);
    this.resetSpine(origin, heading);
  }

  /**
   * Drive the fish spine to a new head position (called by FishBoid)
   * @param {p5.Vector} pos - New head position
   */
  resolveToPosition(pos, velocity, dt, isGrabbed = false) {
    this.locomotion.update(pos, velocity, dt);
    updatePectoralFins(this, isGrabbed, false, dt ?? 1 / 60);
  }

  /**
   * Reinitialize the spine at a new position (used when wrapping around screen edges)
   * @param {p5.Vector} pos - New head position
   * @param {number} headingAngle - Direction the fish is facing (radians)
   */
  resetSpine(pos, headingAngle) {
    this.locomotion.reset(pos, headingAngle);
    updatePectoralFins(this, false, true);
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

    const headToMid1 = a[6] - a[0];
    const headToMid2 = a[7] - a[0];
    const headToTail = this.spine.headToTail;

    // === PECTORAL FINS ===
    drawPectoralFin(this, this.leftPecFin, 1);
    drawPectoralFin(this, this.rightPecFin, -1);

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
    const finAngles = this.spine.finAngles;
    const finSpan = 0.16 * this.locomotion.bodyLength;
    const finCamber = 0.055 * this.locomotion.bodyLength;
    for (let i = 8; i < 12; i++) {
      const t = (i - 8) / 3;
      const tailWidth = max(2 * s, finSpan * pow(t, 1.3) + finCamber * headToTail * t * t);
      curveVertex(j[i].x + cos(finAngles[i] - PI / 2) * tailWidth,
                  j[i].y + sin(finAngles[i] - PI / 2) * tailWidth);
    }
    for (let i = 11; i >= 8; i--) {
      const t = (i - 8) / 3;
      const tailWidth = max(2 * s, finSpan * pow(t, 1.3) - finCamber * headToTail * t * t);
      curveVertex(j[i].x + cos(finAngles[i] + PI / 2) * tailWidth,
                  j[i].y + sin(finAngles[i] + PI / 2) * tailWidth);
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
      j[6].x + cos(a[6] + PI / 2) * (0.030 * this.locomotion.bodyLength + abs(headToMid2) * 16 * s),
      j[6].y + sin(a[6] + PI / 2) * (0.030 * this.locomotion.bodyLength + abs(headToMid2) * 16 * s),
      j[5].x + cos(a[5] + PI / 2) * (0.035 * this.locomotion.bodyLength + abs(headToMid1) * 16 * s),
      j[5].y + sin(a[5] + PI / 2) * (0.035 * this.locomotion.bodyLength + abs(headToMid1) * 16 * s),
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
