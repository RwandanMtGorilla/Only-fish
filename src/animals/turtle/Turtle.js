/**
 * Turtle class - Scalable, colorable procedural turtle rendering
 * Four-legged walking animation with rigid shell
 * Based on animal-proc-anim Turtle.js, adapted for boids integration
 * @module animals/turtle/Turtle
 */

import { Chain } from '../../core/Chain.js';

// Pond-turtle scute layout, in shell-radius coordinates (head is at negative X).
// Reference: https://www.skullsunlimited.com/products/real-pond-turtle-shell-st-135
// Shared vertices keep the five vertebrals and four pairs of costals watertight.
const RIM_X = 0.9;
const RIM_Y = 0.84;
const rimPoint = angle => [RIM_X * Math.cos(angle), RIM_Y * Math.sin(angle)];
const rimArc = (from, to) => Array.from({ length: 13 }, (_, i) =>
  rimPoint(from + (to - from) * i / 12));
const scuteAngles = [2.58, 2.05, Math.PI / 2, 1.09, 0.56];
const scuteShoulders = [rimPoint(scuteAngles[0]), [-0.4, 0.38], [0, 0.4],
  [0.4, 0.37], rimPoint(scuteAngles[4])];
const scuteJunctions = [[-0.59, 0.23], [-0.2, 0.25], [0.2, 0.25], [0.59, 0.22]];
const mirror = points => points.map(([x, y]) => [x, -y]);
const SHELL_SCUTES = [];
for (let i = 0; i < 5; i++) {
  const upper = i === 0
    ? [...rimArc(Math.PI, scuteAngles[0]), scuteJunctions[0]]
    : i === 4
      ? [scuteJunctions[3], ...rimArc(scuteAngles[4], 0)]
      : [scuteJunctions[i - 1], scuteShoulders[i], scuteJunctions[i]];
  SHELL_SCUTES.push([...upper, ...mirror(upper).reverse()]);
}
for (let i = 0; i < 4; i++) {
  const costal = [scuteShoulders[i], scuteJunctions[i], scuteShoulders[i + 1],
    ...rimArc(scuteAngles[i + 1], scuteAngles[i])];
  SHELL_SCUTES.push(costal, mirror(costal));
}

// A faint inset follows each plate, suggesting growth rings without crowding it.
const SCUTE_GROWTH_RINGS = SHELL_SCUTES.map(points => {
  const xs = points.map(p => p[0]);
  const ys = points.map(p => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  return points.map(([x, y]) => [cx + (x - cx) * 0.76, cy + (y - cy) * 0.76]);
});

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
      const legSize = [Math.round(30 * scale), Math.round(40 * scale)];
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
    this.retractionProgress = 0;
    this.releaseDelayMs = 0;
  }

  /**
   * Drive the turtle spine to a new head position (called by TurtleBoid)
   * @param {p5.Vector} pos - New head position
   */
  resolveToPosition(pos, preservePose = this.isRetracted) {
    if (preservePose) {
      // Preserve the entire pose through mouse reversals and pauses.
      const delta = p5.Vector.sub(pos, this.spine.joints[0]);
      for (const joint of this.spine.joints) joint.add(delta);
      for (const arm of this.arms) {
        for (const joint of arm.joints) joint.add(delta);
      }
      for (const desired of this.armDesired) desired.add(delta);
      return;
    }
    // Fixed 60 Hz simulation: limit turns to PI radians per second.
    this.spine.resolve(pos, PI / 60);
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
   * Advance the grab/release animation in milliseconds.
   */
  updateRetraction(dt) {
    // Animate in render time, independently of the fixed-rate physics updates.
    // Reversing the target mid-animation continues from the current pose.
    if (this.isRetracted) {
      this.releaseDelayMs = 0;
      this.retractionProgress = Math.min(1, this.retractionProgress + dt / 140);
      return;
    }
    const waiting = Math.min(dt, this.releaseDelayMs);
    this.releaseDelayMs -= waiting;
    // Finish retracting even if the pointer was released during a quick grab.
    this.retractionProgress = Math.min(1, this.retractionProgress + waiting / 140);
    this.retractionProgress = Math.max(0, this.retractionProgress - (dt - waiting) / 200);
  }

  display() {
    this.updateRetraction(Math.min(Math.max(globalThis.deltaTime ?? 1000 / 60, 0), 50));
    if (this.retractionProgress === 1) {
      this._drawShell();
      return;
    }

    const s = this.scale;
    const progress = this.retractionProgress;
    const eased = progress * progress * (3 - 2 * progress);
    const bodyScale = 1 - 0.55 * eased;
    const shellCenter = p5.Vector.lerp(this.spine.joints[4], this.spine.joints[5], 0.5);

    // Only the visible skin retracts; the spine and grab anchor stay fixed.
    push();
    translate(shellCenter.x, shellCenter.y);
    scale(bodyScale);
    translate(-shellCenter.x, -shellCenter.y);

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
    pop();

    // Draw last so the head, eyes, feet and tail slide underneath the shell.
    this._drawShell();
  }

  /**
   * Draw the rigid shell with vertebral, costal and marginal scutes.
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

    const rx = this.shellLength / 2;
    const ry = this.shellWidth / 2;
    const drawPlate = points => {
      beginShape();
      for (const [x, y] of points) vertex(x * rx, y * ry);
      endShape(CLOSE);
    };

    // Closed, staggered plates replace the intersecting cross-shell lines.
    noFill();
    strokeWeight(2.4 * this.scale);
    stroke(this.shellPatternColor);
    for (const plate of SHELL_SCUTES) drawPlate(plate);

    // Eleven marginal plates on either side; seams stop inside the white outline.
    strokeWeight(1.8 * this.scale);
    for (let i = 0; i < 22; i++) {
      const angle = (i + 0.5) * Math.PI * 2 / 22;
      const [x, y] = rimPoint(angle);
      line(x * rx, y * ry, Math.cos(angle) * rx * 0.98, Math.sin(angle) * ry * 0.97);
    }

    strokeWeight(1.1 * this.scale);
    stroke(red(this.shellPatternColor), green(this.shellPatternColor), blue(this.shellPatternColor), 75);
    for (const ring of SCUTE_GROWTH_RINGS) drawPlate(ring);

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
