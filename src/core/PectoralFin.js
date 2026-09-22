import { Chain } from './Chain.js';
import { angleDelta } from './FishSpine.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** An anchored IK branch with a travelling bend layered over passive trailing. */
export class PectoralFin extends Chain {
  constructor(origin, linkSize) {
    super(origin, 5, linkSize, Math.PI / 3);
    // Keep passive history separate so active bends never feed back and accumulate.
    this.trail = new Chain(origin, 5, linkSize, Math.PI / 3);
  }

  update(root, heading, side, locomotion, attachment, dt, reset, grabbed) {
    if (reset) {
      for (const chain of [this, this.trail]) {
        for (let i = 0; i < chain.joints.length; i++) {
          chain.joints[i].set(root.x - Math.cos(heading) * this.linkSize * i,
            root.y - Math.sin(heading) * this.linkSize * i);
          chain.angles[i] = heading;
        }
      }
      return;
    }
    if (grabbed) {
      for (const chain of [this, this.trail]) {
        const oldRoot = chain.joints[0].copy();
        const turn = angleDelta(heading, chain.angles[0]);
        const c = Math.cos(turn), s = Math.sin(turn);
        for (let i = 0; i < chain.joints.length; i++) {
          const x = chain.joints[i].x - oldRoot.x, y = chain.joints[i].y - oldRoot.y;
          chain.joints[i].set(root.x + c * x - s * y, root.y + s * x + c * y);
          chain.angles[i] += turn;
        }
      }
      return;
    }
    if (!(dt > 0)) return;
    const turn = angleDelta(heading, this.angles[0]);
    this.trail.angles[0] = heading;
    this.trail.resolve(root, 0);
    this.joints[0].set(root);
    this.angles[0] = heading;
    const gait = locomotion.gait;
    const phase = gait.phase - Math.PI * 2 * gait.waveNum * attachment;
    const activity = clamp(gait.tipAmplitude / gait.tipAmpMax, 0, 1);
    const amplitude = 0.16 + 0.18 * activity;
    for (let i = 1; i < this.joints.length; i++) {
      const u = i / (this.joints.length - 1);
      const passive = clamp(angleDelta(this.trail.angles[i], heading), -0.4, 0.4);
      // Mirrored strokes spread outward; phase delay carries the ripple to the tip.
      const wave = amplitude * u * Math.sin(phase - Math.PI * 1.3 * u);
      const target = heading + passive * 0.45
        - side * (0.18 + locomotion.brake * 0.4 + wave);
      const previous = this.angles[i] + turn;
      const blend = 1 - Math.exp(-Math.min(dt, 0.05) / (0.055 + 0.065 * u));
      const angle = previous + angleDelta(target, previous) * blend;
      this.angles[i] = this.angles[i - 1]
        + clamp(angleDelta(angle, this.angles[i - 1]), -this.angleConstraint, this.angleConstraint);
      this.joints[i].set(this.joints[i - 1].x - Math.cos(this.angles[i]) * this.linkSize,
        this.joints[i - 1].y - Math.sin(this.angles[i]) * this.linkSize);
    }
  }
}

export function updatePectoralFins(body, grabbed, reset = false, dt = 0) {
  const index = body.pectoralJoint ?? 2;
  const joint = body.spine.joints[index], heading = body.spine.angles[index];
  for (const [chain, side] of [[body.leftPecFin, 1], [body.rightPecFin, -1]]) {
    const angle = heading + side * Math.PI * 5 / 12;
    const root = createVector(joint.x + Math.cos(angle) * body.bodyWidth[index],
      joint.y + Math.sin(angle) * body.bodyWidth[index]);
    chain.update(root, heading, side, body.locomotion,
      index / (body.spine.joints.length - 1), dt, reset, grabbed);
  }
}

export function pectoralFinOutline(body, chain, side) {
  const points = [], heading = body.spine.angles[body.pectoralJoint ?? 2];
  for (const edge of [1, -1]) {
    for (let n = 0; n < chain.joints.length - (edge === -1 ? 1 : 0); n++) {
      const i = edge === 1 ? n : chain.joints.length - 2 - n;
      const normal = chain.angles[i] + edge * side * Math.PI / 2;
      const shift = edge === -1 && i < 3 ? body.finWidths[0] * 0.75 * (1 - i * 0.3) : 0;
      points.push({ x: chain.joints[i].x + Math.cos(normal) * body.finWidths[i] + Math.cos(heading) * shift,
        y: chain.joints[i].y + Math.sin(normal) * body.finWidths[i] + Math.sin(heading) * shift });
    }
  }
  return points;
}

export function drawPectoralFin(body, chain, side) {
  const points = pectoralFinOutline(body, chain, side);
  beginShape();
  for (const point of [points.at(-1), ...points, points[0], points[1]]) curveVertex(point.x, point.y);
  endShape(CLOSE);
}
