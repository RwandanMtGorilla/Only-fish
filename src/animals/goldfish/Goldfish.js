/**
 * Goldfish class - Procedural goldfish rendering with triple-forked tail fin
 * 14-segment IK spine (10 body + 4 tail), larger pectoral fins, flowing tri-lobe caudal fin
 * @module animals/goldfish/Goldfish
 */

import { Chain } from '../../core/Chain.js';
import { relativeAngleDiff } from '../../utils/geometry.js';

export class Goldfish {
  /**
   * @param {p5.Vector} origin - Starting position
   * @param {number} scale - Size scale factor
   * @param {p5.Color} bodyColor - Body fill color
   * @param {p5.Color} finColor - Fin fill color
   */
  constructor(origin, scale = 1.0, bodyColor = null, finColor = null) {
    this.scale = scale;

    // 14 segments: 10 body + 4 tail (more tail joints for tri-lobe fin)
    this.linkSize = Math.round(48 * scale);
    this.spine = new Chain(origin, 14, this.linkSize, PI / 6);

    this.bodyColor = bodyColor || color(200, 80, 40);
    this.finColor = finColor || color(230, 140, 80);

    // Rounder, shorter goldfish body profile (~75-80% of normal fish)
    this.bodyWidth = [52, 68, 72, 70, 62, 48, 36, 26, 22, 14].map(w => w * scale);

    // Pectoral fin IK chains (left/right, 5 joints each, loose angle constraint for flowing motion)
    const finLinkSize = Math.round(40 * scale);
    this.leftPecFin = new Chain(origin, 5, finLinkSize, PI / 3);
    this.rightPecFin = new Chain(origin, 5, finLinkSize, PI / 3);
    this.finWidths = [20, 36, 30, 18, 6].map(w => w * scale);
  }

  /**
   * Drive the goldfish spine to a new head position
   * @param {p5.Vector} pos - New head position
   */
  resolveToPosition(pos) {
    this.spine.resolve(pos);
    // Update pectoral fin chains: root follows body joint 2
    const j2 = this.spine.joints[2];
    const a2 = this.spine.angles[2];
    const bw2 = this.bodyWidth[2];
    this.leftPecFin.resolve(createVector(
      j2.x + cos(a2 + PI / 3) * bw2,
      j2.y + sin(a2 + PI / 3) * bw2
    ));
    this.rightPecFin.resolve(createVector(
      j2.x + cos(a2 - PI / 3) * bw2,
      j2.y + sin(a2 - PI / 3) * bw2
    ));
  }

  /**
   * Reinitialize the spine at a new position (edge wrapping)
   * @param {p5.Vector} pos - New head position
   * @param {number} headingAngle - Direction facing (radians)
   */
  resetSpine(pos, headingAngle) {
    for (let i = 0; i < this.spine.joints.length; i++) {
      this.spine.joints[i].x = pos.x - cos(headingAngle) * this.linkSize * i;
      this.spine.joints[i].y = pos.y - sin(headingAngle) * this.linkSize * i;
      this.spine.angles[i] = headingAngle;
    }
    // Reset pectoral fin chains: fins trail backward from attachment point
    const j2 = this.spine.joints[2];
    const a2 = headingAngle;
    const bw2 = this.bodyWidth[2];
    const finAngle = headingAngle + PI; // fins point backward
    const finLink = this.leftPecFin.linkSize;
    const fins = [
      { chain: this.leftPecFin,  rootAngle: a2 + PI / 3 },
      { chain: this.rightPecFin, rootAngle: a2 - PI / 3 },
    ];
    for (const { chain, rootAngle } of fins) {
      const rx = j2.x + cos(rootAngle) * bw2;
      const ry = j2.y + sin(rootAngle) * bw2;
      for (let i = 0; i < chain.joints.length; i++) {
        chain.joints[i].x = rx + cos(finAngle) * finLink * i;
        chain.joints[i].y = ry + sin(finAngle) * finLink * i;
        chain.angles[i] = finAngle;
      }
    }
  }

  /**
   * Render the goldfish with all body parts
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
    const headToTail = headToMid1 + relativeAngleDiff(a[6], a[13]);

    // === PECTORAL FINS (IK chain-driven, flowing) ===
    this._drawPecFin(this.leftPecFin);
    this._drawPecFin(this.rightPecFin);

    // === VENTRAL FINS ===
    push();
    translate(this._getPosX(7, PI / 2, 0), this._getPosY(7, PI / 2, 0));
    rotate(a[6] - PI / 4);
    ellipse(0, 0, 110 * s, 40 * s);
    pop();
    push();
    translate(this._getPosX(7, -PI / 2, 0), this._getPosY(7, -PI / 2, 0));
    rotate(a[6] + PI / 4);
    ellipse(0, 0, 110 * s, 40 * s);
    pop();

    // === TRIPLE-FORKED CAUDAL FIN ===
    this._drawFinLobe(j, a, headToTail, s, -1, 1.3, 40 * s);  // upper lobe
    this._drawFinLobe(j, a, headToTail, s, 1, 1.3, 40 * s);   // lower lobe
    this._drawFinLobe(j, a, headToTail, s, 0, 0.8, 55 * s);   // center lobe

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
      j[6].x + cos(a[6] + PI / 2) * headToMid2 * 20 * s,
      j[6].y + sin(a[6] + PI / 2) * headToMid2 * 20 * s,
      j[5].x + cos(a[5] + PI / 2) * headToMid1 * 20 * s,
      j[5].y + sin(a[5] + PI / 2) * headToMid1 * 20 * s,
      j[4].x,
      j[4].y
    );
    endShape();

    // === EYES ===
    fill(255);
    ellipse(this._getPosX(0, PI / 2, -20 * s), this._getPosY(0, PI / 2, -20 * s), 28 * s, 28 * s);
    ellipse(this._getPosX(0, -PI / 2, -20 * s), this._getPosY(0, -PI / 2, -20 * s), 28 * s, 28 * s);
  }

  /**
   * Draw a pectoral fin using its IK chain joints.
   * Renders a flowing ribbon shape along the chain's joints.
   * @param {Chain} finChain - The pectoral fin IK chain
   */
  _drawPecFin(finChain) {
    const fj = finChain.joints;
    const fa = finChain.angles;
    const fw = this.finWidths;
    beginShape();
    for (let i = 0; i < fj.length; i++) {
      curveVertex(fj[i].x + cos(fa[i] + PI / 2) * fw[i],
                  fj[i].y + sin(fa[i] + PI / 2) * fw[i]);
    }
    for (let i = fj.length - 1; i >= 0; i--) {
      curveVertex(fj[i].x + cos(fa[i] - PI / 2) * fw[i],
                  fj[i].y + sin(fa[i] - PI / 2) * fw[i]);
    }
    endShape(CLOSE);
  }

  /**
   * Draw a single lobe of the triple-forked caudal fin.
   *
   * Each lobe's centerline is spatially offset from the spine perpendicular
   * to the swimming direction. The offset grows from 0 at the base (joint 9)
   * to maxSpread at the tip (joint 13), creating a visible fork.
   * headToTail curvature dynamically widens / narrows the fork.
   *
   * @param {Array} j - Spine joints
   * @param {Array} a - Spine angles
   * @param {number} headToTail - Head-to-tail angle difference (drives splay)
   * @param {number} s - Scale factor
   * @param {number} sideAngle - Which fork: -1 = upper, 0 = center, +1 = lower
   * @param {number} widthScale - Lobe thickness multiplier
   * @param {number} tipExtend - Extra length beyond the last joint
   */
  _drawFinLobe(j, a, headToTail, s, sideAngle, widthScale, tipExtend) {
    const startJoint = 9;
    const endJoint = 13;
    const jointCount = endJoint - startJoint + 1;

    // --- Compute offset centerline positions for this lobe ---
    // Base spread: constant lateral distance between forks
    const baseSpread = 28 * s;
    // Dynamic spread: body curvature opens / closes the fan
    const dynamicSpread = constrain(headToTail * 18 * s, -40 * s, 40 * s);
    const maxSpread = baseSpread + abs(dynamicSpread) * 0.5;

    // Pre-compute offset joint positions along the lobe centerline
    const cx = [];
    const cy = [];
    for (let i = 0; i < jointCount; i++) {
      const ji = startJoint + i;
      // t goes 0 -> 1 from base to tip
      const t = i / (jointCount - 1);
      // Lateral offset grows quadratically toward the tip
      const spread = sideAngle * maxSpread * t * t;
      // Perpendicular to spine direction at this joint
      const perpAngle = a[ji] + PI / 2;
      cx.push(j[ji].x + cos(perpAngle) * spread);
      cy.push(j[ji].y + sin(perpAngle) * spread);
    }

    // Lobe half-width profile: spindle shape (sin), narrow at base & tip
    const halfWidths = [];
    for (let i = 0; i < jointCount; i++) {
      const t = i / (jointCount - 1);
      halfWidths.push(sin(t * PI) * 16 * s * widthScale);
    }

    // Tip point: extend beyond last offset joint along spine direction
    const lastIdx = jointCount - 1;
    const lastJi = endJoint;
    const tipSpread = sideAngle * maxSpread * 1.15; // slightly beyond quadratic
    const tipPerpAngle = a[lastJi] + PI / 2;
    const tipX = j[lastJi].x + cos(a[lastJi]) * tipExtend + cos(tipPerpAngle) * tipSpread;
    const tipY = j[lastJi].y + sin(a[lastJi]) * tipExtend + sin(tipPerpAngle) * tipSpread;

    beginShape();
    // One side of the lobe
    for (let i = 0; i < jointCount; i++) {
      const perpAngle = a[startJoint + i] + PI / 2;
      curveVertex(cx[i] + cos(perpAngle) * halfWidths[i],
                  cy[i] + sin(perpAngle) * halfWidths[i]);
    }
    // Tip
    curveVertex(tipX, tipY);
    curveVertex(tipX, tipY);
    // Other side, reversed
    for (let i = jointCount - 1; i >= 0; i--) {
      const perpAngle = a[startJoint + i] - PI / 2;
      curveVertex(cx[i] + cos(perpAngle) * halfWidths[i],
                  cy[i] + sin(perpAngle) * halfWidths[i]);
    }
    endShape(CLOSE);
  }

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
