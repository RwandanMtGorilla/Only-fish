/**
 * Path-following fish spine with an active Lighthill bend layered on top.
 * `angles[0]` is assigned from navigation every frame, so gait never shakes the head.
 */

const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function angleDelta(angle, anchor) {
  let delta = (angle - anchor) % TAU;
  if (delta > Math.PI) delta -= TAU;
  if (delta <= -Math.PI) delta += TAU;
  return delta;
}

export class FishSpine {
  constructor(origin, jointCount, linkSize, maxBend = Math.PI / 6, options = {}) {
    this.linkSize = linkSize;
    this.maxBend = maxBend;
    // Per-joint radians relative to the preceding segment; index 0 is the head.
    // Missing entries retain the uniform limit for existing callers.
    this.bendLimits = Float64Array.from({ length: jointCount }, (_, i) => {
      const limit = options.bendLimits?.[i] ?? maxBend;
      if (!Number.isFinite(limit) || limit < 0) {
        throw new RangeError('Spine bend limits must be finite, non-negative radians');
      }
      return i === 0 ? 0 : limit;
    });
    this.joints = [];
    this.angles = new Float32Array(jointCount);
    this.pathJoints = [];
    this.pathAngles = new Float32Array(jointCount);

    for (let i = 0; i < jointCount; i++) {
      this.joints.push(origin.copy().add(0, i * linkSize));
      this.pathJoints.push(origin.copy().add(0, i * linkSize));
      this.angles[i] = Math.PI / 2;
      this.pathAngles[i] = Math.PI / 2;
    }

    this.relative = new Float32Array(jointCount);
    this.relativeVelocity = new Float32Array(jointCount);
    this.reference = new Float32Array(jointCount);
    this.gaitRelative = new Float32Array(jointCount);
    this.finAngles = new Float32Array(jointCount);

    this.fixedDt = options.fixedDt ?? 1 / 120;
    this.headResponse = options.headResponse ?? 120;
    this.tailLimp = options.tailLimp ?? 0.40;
    this.finTau = options.finTau ?? 0.05;
    this.response = new Float32Array(jointCount);
    this.decay = new Float32Array(jointCount);
    for (let i = 0; i < jointCount; i++) {
      this.response[i] = this.headResponse * (1 - this.tailLimp * i / (jointCount - 1));
      this.decay[i] = Math.exp(-this.response[i] * this.fixedDt);
    }

    this.accumulator = 0;
    this.initialized = false;
  }

  reset(position, heading) {
    for (let i = 0; i < this.joints.length; i++) {
      const x = position.x - Math.cos(heading) * this.linkSize * i;
      const y = position.y - Math.sin(heading) * this.linkSize * i;
      this.joints[i].set(x, y);
      this.pathJoints[i].set(x, y);
      this.angles[i] = heading;
      this.pathAngles[i] = heading;
      this.finAngles[i] = heading;
      this.relative[i] = 0;
      this.relativeVelocity[i] = 0;
      this.reference[i] = 0;
    }
    this.accumulator = 0;
    this.initialized = true;
  }

  update(position, heading, gait, dt) {
    if (!this.initialized) this.reset(position, heading);

    const count = this.joints.length;
    this.pathAngles[0] = heading;
    this.pathJoints[0].set(position.x, position.y);

    // Pass 1: retain the old follow-the-leader chain as the turning/camber path.
    for (let i = 1; i < count; i++) {
      const previous = this.pathJoints[i - 1];
      const current = this.pathJoints[i];
      const dx = previous.x - current.x;
      const dy = previous.y - current.y;
      let angle = dx * dx + dy * dy > 1e-8
        ? Math.atan2(dy, dx)
        : this.pathAngles[i];
      angle = this.pathAngles[i - 1] + clamp(
        angleDelta(angle, this.pathAngles[i - 1]),
        -this.bendLimits[i],
        this.bendLimits[i],
      );
      this.pathAngles[i] = angle;
      current.set(
        previous.x - Math.cos(angle) * this.linkSize,
        previous.y - Math.sin(angle) * this.linkSize,
      );
    }

    // Pass 2: path curvature plus active travelling-wave curvature.
    gait.relativeAngles(count, this.gaitRelative);
    this.reference[0] = 0;
    for (let i = 1; i < count; i++) {
      this.reference[i] = clamp(
        angleDelta(this.pathAngles[i], this.pathAngles[i - 1]) + this.gaitRelative[i],
        -this.bendLimits[i], this.bendLimits[i],
      );
    }

    // Pass 3: critically damped fixed-step joint response creates a soft tail lag.
    this.accumulator = Math.min(this.accumulator + Math.max(0, dt), 0.25);
    const finBlend = 1 - Math.exp(-this.fixedDt / this.finTau);
    while (this.accumulator >= this.fixedDt) {
      for (let i = 1; i < count; i++) {
        const response = this.response[i];
        const decay = this.decay[i];
        const error = this.relative[i] - this.reference[i];
        const velocity = this.relativeVelocity[i];
        const coefficient = velocity + response * error;
        this.relative[i] = this.reference[i]
          + (error + coefficient * this.fixedDt) * decay;
        this.relativeVelocity[i] = (velocity - response * coefficient * this.fixedDt) * decay;
        const limit = this.bendLimits[i];
        if (Math.abs(this.relative[i]) >= limit) {
          this.relative[i] = clamp(this.relative[i], -limit, limit);
          // Remove outward momentum at a stop so reversing never has to unwind it.
          if (limit === 0 || this.relative[i] * this.relativeVelocity[i] > 0) {
            this.relativeVelocity[i] = 0;
          }
        }
      }
      for (let i = 0; i < count; i++) {
        this.finAngles[i] += angleDelta(this.angles[i], this.finAngles[i]) * finBlend;
      }
      this.accumulator -= this.fixedDt;
    }

    // Pass 4: rebuild the render spine; the head is a hard navigation invariant.
    this.angles[0] = heading;
    this.joints[0].set(position.x, position.y);
    for (let i = 1; i < count; i++) {
      const angle = this.angles[i - 1]
        + clamp(this.relative[i], -this.bendLimits[i], this.bendLimits[i]);
      this.angles[i] = angle;
      this.joints[i].set(
        this.joints[i - 1].x - Math.cos(angle) * this.linkSize,
        this.joints[i - 1].y - Math.sin(angle) * this.linkSize,
      );
    }
  }

  get headToTail() {
    return this.angles[this.angles.length - 1] - this.angles[0];
  }

  display() {
    strokeWeight(8);
    stroke(255);
    for (let i = 0; i < this.joints.length - 1; i++) {
      line(this.joints[i].x, this.joints[i].y, this.joints[i + 1].x, this.joints[i + 1].y);
    }
    fill(42, 44, 53);
    for (const joint of this.joints) ellipse(joint.x, joint.y, 32, 32);
  }
}
