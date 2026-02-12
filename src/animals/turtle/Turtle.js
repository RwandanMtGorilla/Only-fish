/**
 * Turtle class - Scalable, colorable procedural turtle rendering
 * Four-legged walking animation with rigid shell
 * Based on animal-proc-anim Turtle.js, adapted for boids integration
 * @module animals/turtle/Turtle
 */

import { Chain } from '../../core/Chain.js';

export class Turtle {
  /**
   * @param {p5.Vector} origin - Starting position
   * @param {number} scale - Size scale factor
   * @param {p5.Color} bodyColor - Skin color
   * @param {p5.Color} shellColor - Shell color
   */
  constructor(origin, scale = 1.0, bodyColor = null, shellColor = null) {
    this.scale = scale;

    // Spine: 10 joints, tighter angle constraint (shell limits bending)
    this.spine = new Chain(origin, 10, Math.round(48 * scale), PI / 12);

    // Four legs (front two uniform, back two non-uniform per-segment)
    this.arms = [];
    this.armDesired = [];
    for (let i = 0; i < 4; i++) {
      const legSize = i < 2
        ? Math.round(36 * scale)
        : [Math.round(30 * scale), Math.round(40 * scale)];
      this.arms.push(new Chain(origin, 3, legSize));
      this.armDesired.push(createVector(0, 0));
    }

    // Colors
    this.bodyColor = bodyColor || color(107, 142, 86);
    this.shellColor = shellColor || color(101, 83, 56);
    this.shellPatternColor = color(
      red(this.shellColor) * 0.7,
      green(this.shellColor) * 0.7,
      blue(this.shellColor) * 0.7
    );

    // Width of the turtle at each vertebra, scaled
    this.bodyWidth = [20, 24, 22, 52, 60, 60, 52, 20, 5, 3].map(w => w * scale);

    // Movement params (used by _updateLegs)
    this.footReach = 60 * scale;
    this.strideThreshold = 120 * scale;
    this.shoulderInset = -15 * scale;
    this.elbowCorrection = 30 * scale;

    // Shell dimensions
    this.shellLength = 280 * scale;
    this.shellWidth = 200 * scale;

    // Stroke weights
    this.legOuterStroke = 44 * scale;
    this.legInnerStroke = 36 * scale;
    this.bodyStroke = 4 * scale;
    this.eyeSize = 12 * scale;

    // 缩壳状态 (被抓取时头/四肢/尾巴全部缩进壳里)
    this.isRetracted = false;
  }

  /**
   * Drive the turtle spine to a new head position (called by TurtleBoid)
   * @param {p5.Vector} pos - New head position
   */
  resolveToPosition(pos) {
    this.spine.resolve(pos);
    this._updateLegs();
  }

  /**
   * Reinitialize the spine at a new position (used when wrapping around screen edges)
   * @param {p5.Vector} pos - New head position
   * @param {number} headingAngle - Direction the turtle is facing (radians)
   */
  resetSpine(pos, headingAngle) {
    const linkSize = this.spine.linkSize;
    for (let i = 0; i < this.spine.joints.length; i++) {
      this.spine.joints[i].x = pos.x - cos(headingAngle) * linkSize * i;
      this.spine.joints[i].y = pos.y - sin(headingAngle) * linkSize * i;
      this.spine.angles[i] = headingAngle;
    }
    // Reset legs to reasonable positions
    this._updateLegs();
    for (let i = 0; i < this.arms.length; i++) {
      this.armDesired[i] = this.arms[i].joints[0].copy();
    }
  }

  /**
   * Update leg positions using FABRIK IK
   * @private
   */
  _updateLegs() {
    for (let i = 0; i < this.arms.length; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const bodyIndex = i < 2 ? 3 : 6;
      const angle = i < 2 ? PI / 3 : PI / 2.5;

      const desiredPos = createVector(
        this._getPosX(bodyIndex, angle * side, this.footReach),
        this._getPosY(bodyIndex, angle * side, this.footReach)
      );

      if (p5.Vector.dist(desiredPos, this.armDesired[i]) > this.strideThreshold) {
        this.armDesired[i] = desiredPos;
      }

      const footPos = p5.Vector.lerp(this.arms[i].joints[0], this.armDesired[i], 0.25);
      const shoulderPos = createVector(
        this._getPosX(bodyIndex, PI / 2 * side, this.shoulderInset),
        this._getPosY(bodyIndex, PI / 2 * side, this.shoulderInset)
      );
      this.arms[i].fabrikResolve(footPos, shoulderPos);
    }
  }

  /**
   * Render the turtle
   */
  display() {
    // 缩壳状态: 只画壳
    if (this.isRetracted) {
      this._drawShell();
      return;
    }

    const s = this.scale;

    // === LEGS (drawn first, appear behind body and shell) ===
    noFill();
    for (let i = 0; i < this.arms.length; i++) {
      const shoulder = this.arms[i].joints[2];
      const foot = this.arms[i].joints[0];
      let elbow = this.arms[i].joints[1].copy();

      // Correct back leg elbow direction for physical accuracy
      const para = p5.Vector.sub(foot, shoulder);
      const perp = createVector(-para.y, para.x).setMag(this.elbowCorrection);
      if (i === 2) {
        elbow = p5.Vector.sub(elbow, perp);
      } else if (i === 3) {
        elbow = p5.Vector.add(elbow, perp);
      }

      // Draw white outline
      strokeWeight(this.legOuterStroke);
      stroke(255);
      bezier(shoulder.x, shoulder.y, elbow.x, elbow.y, elbow.x, elbow.y, foot.x, foot.y);

      // Draw colored fill
      strokeWeight(this.legInnerStroke);
      stroke(this.bodyColor);
      bezier(shoulder.x, shoulder.y, elbow.x, elbow.y, elbow.x, elbow.y, foot.x, foot.y);
    }

    // === BODY (curveVertex outline) ===
    strokeWeight(this.bodyStroke);
    stroke(255);
    fill(this.bodyColor);

    beginShape();

    // Right half of the turtle
    for (let i = 0; i < this.spine.joints.length; i++) {
      curveVertex(this._getPosX(i, PI / 2, 0), this._getPosY(i, PI / 2, 0));
    }

    // Left half of the turtle
    for (let i = this.spine.joints.length - 1; i >= 0; i--) {
      curveVertex(this._getPosX(i, -PI / 2, 0), this._getPosY(i, -PI / 2, 0));
    }

    // Top of the head (small and round)
    curveVertex(this._getPosX(0, -PI / 6, -2 * s), this._getPosY(0, -PI / 6, -2 * s));
    curveVertex(this._getPosX(0, 0, 0), this._getPosY(0, 0, 0));
    curveVertex(this._getPosX(0, PI / 6, -2 * s), this._getPosY(0, PI / 6, -2 * s));

    // Overlap vertices to close the curve smoothly
    curveVertex(this._getPosX(0, PI / 2, 0), this._getPosY(0, PI / 2, 0));
    curveVertex(this._getPosX(1, PI / 2, 0), this._getPosY(1, PI / 2, 0));
    curveVertex(this._getPosX(2, PI / 2, 0), this._getPosY(2, PI / 2, 0));
    curveVertex(this._getPosX(3, PI / 2, 0), this._getPosY(3, PI / 2, 0));

    endShape();

    // === SHELL (rigid body, does not deform with spine) ===
    this._drawShell();

    // === EYES ===
    fill(255);
    noStroke();
    ellipse(
      this._getPosX(0, 3 * PI / 5, 2 * s),
      this._getPosY(0, 3 * PI / 5, 2 * s),
      this.eyeSize, this.eyeSize
    );
    ellipse(
      this._getPosX(0, -3 * PI / 5, 2 * s),
      this._getPosY(0, -3 * PI / 5, 2 * s),
      this.eyeSize, this.eyeSize
    );
  }

  /**
   * Draw the rigid turtle shell as an ellipse with pattern lines
   * @private
   */
  _drawShell() {
    // Shell center: midpoint of joints[4] and joints[5]
    const shellCenter = p5.Vector.lerp(this.spine.joints[4], this.spine.joints[5], 0.5);
    // Shell angle: use joint[4]'s angle (points toward head)
    const shellAngle = this.spine.angles[4];

    push();
    translate(shellCenter.x, shellCenter.y);
    rotate(shellAngle + PI);

    // Shell outer shape
    strokeWeight(this.bodyStroke);
    stroke(255);
    fill(this.shellColor);
    ellipse(0, 0, this.shellLength, this.shellWidth);

    // Shell pattern lines
    noFill();
    strokeWeight(this.bodyStroke);
    stroke(this.shellPatternColor);

    // Center longitudinal line
    line(-this.shellLength * 0.38, 0, this.shellLength * 0.38, 0);

    // Transverse division lines (3 lines splitting the shell into sections)
    for (const t of [-0.18, 0, 0.18]) {
      const x = t * this.shellLength;
      const normalizedX = 2 * t;
      const halfH = (this.shellWidth / 2) * sqrt(max(0, 1 - normalizedX * normalizedX)) * 0.85;
      line(x, -halfH, x, halfH);
    }

    // Diagonal lines from center to edges (scute pattern)
    const diagonals = [
      { fromX: -0.18, toAngle: -PI / 3 },
      { fromX: -0.18, toAngle: PI / 3 },
      { fromX: 0.18, toAngle: -2 * PI / 3 },
      { fromX: 0.18, toAngle: 2 * PI / 3 },
    ];
    for (const d of diagonals) {
      const x1 = d.fromX * this.shellLength;
      const rx = cos(d.toAngle) * this.shellLength * 0.42;
      const ry = sin(d.toAngle) * this.shellWidth * 0.42;
      line(x1, 0, rx, ry);
    }

    pop();
  }

  /**
   * Debug display showing spine structure
   */
  debugDisplay() {
    this.spine.display();
  }

  /**
   * @private
   */
  _getPosX(i, angleOffset, lengthOffset) {
    return this.spine.joints[i].x +
           cos(this.spine.angles[i] + angleOffset) *
           (this.bodyWidth[i] + lengthOffset);
  }

  /**
   * @private
   */
  _getPosY(i, angleOffset, lengthOffset) {
    return this.spine.joints[i].y +
           sin(this.spine.angles[i] + angleOffset) *
           (this.bodyWidth[i] + lengthOffset);
  }
}
