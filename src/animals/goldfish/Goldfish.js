/**
 * Goldfish class - Procedural goldfish rendering with triple-forked tail fin
 * 14-segment IK spine (10 body + 4 tail), larger pectoral fins, flowing tri-lobe caudal fin
 * Supports optional koi-style color patches via canvas clip
 * @module animals/goldfish/Goldfish
 */

import { PectoralFin, updatePectoralFins, pectoralFinOutline, drawPectoralFin } from '../../core/PectoralFin.js';
import { FishLocomotion } from '../../core/FishLocomotion.js';

function mulberry32(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export class Goldfish {
  /**
   * @param {p5.Vector} origin - Starting position
   * @param {number} scale - Size scale factor
   * @param {p5.Color} bodyColor - Body fill color
   * @param {p5.Color} finColor - Fin fill color
   */
  constructor(origin, scale = 1.0, bodyColor = null, finColor = null, patchConfig = null, heading = 0) {
    this.scale = scale;

    // 15 joints: 10 body + 5 tail (14 links, with a flowing tri-lobe fin).
    this.linkSize = Math.round(48 * scale);
    this.locomotion = new FishLocomotion(origin, 15, this.linkSize, heading, {
      maxBend: PI / 5,
      maxYawRate: 3.5,
      gait: {
        beta: 0.78 + random(-0.035, 0.035),
        waveNum: 0.75 + random(-0.05, 0.05),
        tipAmpMax: 0.12 + random(-0.01, 0.01),
        strouhal: 0.31,
      },
      spine: {
        tailLimp: 0.55, finTau: 0.075,
        // The round forebody stays firm; the longer tail retains loose joints.
        bendLimits: [0, 2, 3, 4, 5, 7, 10, 14, 20, 26, 30, 33, 36, 36, 36]
          .map(degrees => degrees * Math.PI / 180),
      },
    });
    this.spine = this.locomotion.spine;

    this.bodyColor = bodyColor || color(200, 80, 40);
    this.finColor = finColor || color(230, 140, 80);

    // Rounder, shorter goldfish body profile (~75-80% of normal fish)
    this.bodyWidth = [52, 68, 72, 70, 62, 48, 36, 26, 22, 14].map(w => w * scale);

    // Pectoral fin IK chains (left/right, 5 joints each, loose angle constraint for flowing motion)
    const finLinkSize = 26 * scale;
    this.leftPecFin = new PectoralFin(origin, finLinkSize);
    this.rightPecFin = new PectoralFin(origin, finLinkSize);
    this.finWidths = [24, 28, 22, 12, 0].map(w => w * scale);
    this.resetSpine(origin, heading);

    // Koi-style color patches
    if (patchConfig && patchConfig.colors) {
      this.patches = this._generatePatches(patchConfig.colors, patchConfig.density, patchConfig.seed);
      this.patchColors = patchConfig.colors.map(c => color(c[0], c[1], c[2]));
    } else {
      this.patches = [];
      this.patchColors = [];
    }
  }

  /**
   * Drive the goldfish spine to a new head position
   * @param {p5.Vector} pos - New head position
   */
  resolveToPosition(pos, velocity, dt, isGrabbed = false) {
    this.locomotion.update(pos, velocity, dt);
    this._updatePectoralFins(isGrabbed, false, dt ?? 1 / 60);
  }

  /** Reinitialize body and fins together after a wrap or teleport. */
  resetSpine(pos, headingAngle) {
    this.locomotion.reset(pos, headingAngle);
    this._updatePectoralFins(false, true);
  }

  _updatePectoralFins(isGrabbed, reset = false, dt = 0) {
    updatePectoralFins(this, isGrabbed, reset, dt);
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

    const headToMid1 = a[6] - a[0];
    const headToMid2 = a[7] - a[0];
    const headToTail = this.spine.headToTail;

    // === PECTORAL FINS (IK chain-driven, flowing) ===
    this._drawPecFin(this.leftPecFin, 1);
    this._drawPecFin(this.rightPecFin, -1);

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
    this._drawFinLobe(j, this.spine.finAngles, headToTail, s, -1, 1.3, 40 * s);  // upper lobe
    this._drawFinLobe(j, this.spine.finAngles, headToTail, s, 1, 1.3, 40 * s);   // lower lobe
    this._drawFinLobe(j, this.spine.finAngles, headToTail, s, 0, 0.8, 55 * s);   // center lobe

    // === BODY (fill + optional patches + stroke) ===
    noStroke();
    fill(this.bodyColor);
    this._drawBodyShape();

    if (this.patches.length > 0) {
      const ctx = drawingContext;
      ctx.save();
      this._buildBodyClipPath(ctx);
      ctx.clip();
      noStroke();
      for (const patch of this.patches) {
        this._drawPatch(patch);
      }
      ctx.restore();
    }

    noFill();
    stroke(255);
    strokeWeight(4 * s);
    this._drawBodyShape();

    fill(this.finColor);

    // === DORSAL FIN ===
    beginShape();
    vertex(j[4].x, j[4].y);
    bezierVertex(j[5].x, j[5].y, j[6].x, j[6].y, j[7].x, j[7].y);
    bezierVertex(
      j[6].x + cos(a[6] + PI / 2) * (0.030 * this.locomotion.bodyLength + abs(headToMid2) * 20 * s),
      j[6].y + sin(a[6] + PI / 2) * (0.030 * this.locomotion.bodyLength + abs(headToMid2) * 20 * s),
      j[5].x + cos(a[5] + PI / 2) * (0.035 * this.locomotion.bodyLength + abs(headToMid1) * 20 * s),
      j[5].y + sin(a[5] + PI / 2) * (0.035 * this.locomotion.bodyLength + abs(headToMid1) * 20 * s),
      j[4].x,
      j[4].y
    );
    endShape();

    // === EYES ===
    fill(255);
    ellipse(this._getPosX(0, PI / 2, -20 * s), this._getPosY(0, PI / 2, -20 * s), 28 * s, 28 * s);
    ellipse(this._getPosX(0, -PI / 2, -20 * s), this._getPosY(0, -PI / 2, -20 * s), 28 * s, 28 * s);
  }

  /** Outline includes both attachment edges, with its inner root buried in the body. */
  _pectoralFinOutline(finChain, side) {
    return pectoralFinOutline(this, finChain, side);
  }

  _drawPecFin(finChain, side) {
    drawPectoralFin(this, finChain, side);
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
    const endJoint = 14;
    const jointCount = endJoint - startJoint + 1;

    // --- Compute offset centerline positions for this lobe ---
    // Base spread: constant lateral distance between forks
    const baseSpread = 35 * s;
    // Dynamic spread: body curvature opens / closes the fan
    const dynamicSpread = constrain(headToTail * 25 * s, -90 * s, 90 * s);
    const maxSpread = baseSpread + abs(dynamicSpread) * 0.7;

    // Pre-compute offset joint positions along the lobe centerline
    // Last joint gets extra forward extension via tipExtend
    const cx = [];
    const cy = [];
    for (let i = 0; i < jointCount; i++) {
      const ji = startJoint + i;
      const t = i / (jointCount - 1);
      const spread = sideAngle * maxSpread * t * t;
      const perpAngle = a[ji] + PI / 2;
      const extend = (i === jointCount - 1) ? tipExtend : 0;
      cx.push(j[ji].x + cos(perpAngle) * spread + cos(a[ji]) * extend);
      cy.push(j[ji].y + sin(perpAngle) * spread + sin(a[ji]) * extend);
    }

    // Lobe half-width profile: sin curve that doesn't fully close at the tip
    const halfWidths = [];
    for (let i = 0; i < jointCount; i++) {
      const t = i / (jointCount - 1);
      halfWidths.push(sin(t * 0.8 * PI) * 16 * s * widthScale);
    }

    beginShape();
    for (let i = 0; i < jointCount; i++) {
      const perpAngle = a[startJoint + i] + PI / 2;
      curveVertex(cx[i] + cos(perpAngle) * halfWidths[i],
                  cy[i] + sin(perpAngle) * halfWidths[i]);
    }
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

  _drawBodyShape() {
    beginShape();
    for (let i = 0; i < 10; i++) {
      curveVertex(this._getPosX(i, PI / 2, 0), this._getPosY(i, PI / 2, 0));
    }
    curveVertex(this._getPosX(9, PI, 0), this._getPosY(9, PI, 0));
    for (let i = 9; i >= 0; i--) {
      curveVertex(this._getPosX(i, -PI / 2, 0), this._getPosY(i, -PI / 2, 0));
    }
    curveVertex(this._getPosX(0, -PI / 6, 0), this._getPosY(0, -PI / 6, 0));
    curveVertex(this._getPosX(0, 0, 4 * this.scale), this._getPosY(0, 0, 4 * this.scale));
    curveVertex(this._getPosX(0, PI / 6, 0), this._getPosY(0, PI / 6, 0));
    curveVertex(this._getPosX(0, PI / 2, 0), this._getPosY(0, PI / 2, 0));
    curveVertex(this._getPosX(1, PI / 2, 0), this._getPosY(1, PI / 2, 0));
    curveVertex(this._getPosX(2, PI / 2, 0), this._getPosY(2, PI / 2, 0));
    curveVertex(this._getPosX(3, PI / 2, 0), this._getPosY(3, PI / 2, 0));
    endShape();
  }

  _buildBodyClipPath(ctx) {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      pts.push(this._getPosX(i, PI / 2, 0), this._getPosY(i, PI / 2, 0));
    }
    pts.push(this._getPosX(9, PI, 0), this._getPosY(9, PI, 0));
    for (let i = 9; i >= 0; i--) {
      pts.push(this._getPosX(i, -PI / 2, 0), this._getPosY(i, -PI / 2, 0));
    }
    pts.push(this._getPosX(0, -PI / 6, 0), this._getPosY(0, -PI / 6, 0));
    pts.push(this._getPosX(0, 0, 4 * this.scale), this._getPosY(0, 0, 4 * this.scale));
    pts.push(this._getPosX(0, PI / 6, 0), this._getPosY(0, PI / 6, 0));

    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) {
      ctx.lineTo(pts[i], pts[i + 1]);
    }
    ctx.closePath();
  }

  _drawPatch(patch) {
    const j = this.spine.joints;
    const a = this.spine.angles;
    const bw = this.bodyWidth;
    const ji = patch.jointIndex;

    const cx = j[ji].x + cos(a[ji] + PI / 2) * patch.lateralOffset * bw[ji];
    const cy = j[ji].y + sin(a[ji] + PI / 2) * patch.lateralOffset * bw[ji];

    const rx = patch.lengthRadius * this.linkSize;
    const ry = patch.widthRadius * bw[ji];

    const angle = a[ji] + patch.rotation;

    fill(this.patchColors[patch.colorIdx]);
    push();
    translate(cx, cy);
    rotate(angle);
    ellipse(0, 0, rx * 2, ry * 2);
    pop();
  }

  _generatePatches(colors, density, seed) {
    if (!colors || colors.length === 0) return [];

    const countRange = {
      sparse: [1, 3],
      normal: [2, 5],
      dense:  [4, 7],
    };
    const [minCount, maxCount] = countRange[density] || countRange.normal;

    const rng = mulberry32(seed * 13 + 37);
    const count = Math.floor(rng() * (maxCount - minCount + 1)) + minCount;

    const patches = [];
    for (let i = 0; i < count; i++) {
      patches.push({
        jointIndex: Math.floor(rng() * 8) + 1,
        lateralOffset: (rng() - 0.5) * 1.6,
        lengthRadius: 1.5 + rng() * 2.0,
        widthRadius: 0.6 + rng() * 0.6,
        colorIdx: Math.floor(rng() * colors.length),
        rotation: (rng() - 0.5) * 0.6,
      });
    }
    return patches;
  }
}
