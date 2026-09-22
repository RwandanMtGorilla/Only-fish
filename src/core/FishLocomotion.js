import { LighthillGait } from './LighthillGait.js';
import { FishSpine, angleDelta } from './FishSpine.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/** Bridges this project's frame-based boid velocity to the time-based gait. */
export class FishLocomotion {
  constructor(origin, jointCount, linkSize, heading, options = {}) {
    this.bodyLength = linkSize * (jointCount - 1);
    this.heading = heading;
    this.maxYawRate = options.maxYawRate ?? 3.0;
    this.headingTau = options.headingTau ?? 0.10;
    this.nominalFrameRate = options.nominalFrameRate ?? 60;

    this.gait = new LighthillGait(options.gait);
    this.spine = new FishSpine(
      origin,
      jointCount,
      linkSize,
      options.maxBend ?? Math.PI / 6,
      options.spine,
    );

    this.previousSpeed = null;
    this.brake = 0;
  }

  update(position, velocity, dt = 1 / 60) {
    dt = clamp(dt, 1 / 240, 0.05);
    const speedPerFrame = velocity.mag();

    if (speedPerFrame > 1e-5) {
      const targetHeading = Math.atan2(velocity.y, velocity.x);
      let turn = angleDelta(targetHeading, this.heading);
      turn *= 1 - Math.exp(-dt / this.headingTau);
      turn = clamp(turn, -this.maxYawRate * dt, this.maxYawRate * dt);
      this.heading += turn;
    }

    const yawRate = angleDelta(this.heading, this._previousHeading ?? this.heading) / dt;
    this._previousHeading = this.heading;

    // Boid velocity is pixels per fixed 60 Hz tick; convert to px/s for gait.
    const speed = speedPerFrame * this.nominalFrameRate;
    const acceleration = this.previousSpeed === null ? 0 : (speed - this.previousSpeed) / dt;
    this.previousSpeed = speed;

    this.gait.update(
      dt,
      speed / this.bodyLength,
      acceleration / this.bodyLength,
      yawRate,
    );
    this.spine.update(position, this.heading, this.gait, dt);

    const brakeTarget = clamp(-acceleration / (this.bodyLength * 2), 0, 1);
    this.brake += (brakeTarget - this.brake) * (1 - Math.exp(-dt / 0.12));
  }

  reset(position, heading) {
    this.heading = heading;
    this._previousHeading = heading;
    this.previousSpeed = null;
    this.spine.reset(position, heading);
  }
}
