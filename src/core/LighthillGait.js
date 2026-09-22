/**
 * Lighthill travelling-wave gait in body-length units.
 * Pure logic: deliberately independent of p5 so the gait can be unit tested.
 */

const TAU = Math.PI * 2;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const saturate = value => clamp(value, 0, 1);

function smoothstep(min, max, value) {
  const t = saturate((value - min) / (max - min));
  return t * t * (3 - 2 * t);
}

export class LighthillGait {
  constructor(options = {}) {
    this.beta = options.beta ?? 0.88;
    this.waveNum = options.waveNum ?? 0.65;
    this.mitigate = options.mitigate ?? 0.95;
    this.rigidA = options.rigidA ?? 0.10;
    this.rigidB = options.rigidB ?? 0.42;

    this.tipAmpMax = options.tipAmpMax ?? 0.10;
    this.tipAmpMin = options.tipAmpMin ?? 0.015;
    this.uHalf = options.uHalf ?? 0.60;
    this.strouhal = options.strouhal ?? 0.30;
    this.idleFrequency = options.idleFrequency ?? 0.50;
    this.maxFrequency = options.maxFrequency ?? 4.50;
    this.burstGain = options.burstGain ?? 0.50;
    this.accelReference = options.accelReference ?? 2.0;

    this.camberGain = options.camberGain ?? 0.25;
    this.camberMax = options.camberMax ?? 0.90;
    // Small stroke asymmetry for ordinary turns, independent of forward speed.
    this.turnAsymmetryMax = options.turnAsymmetryMax ?? 0.22;
    this.turnYawReference = options.turnYawReference ?? 0.45;
    this.tauTurn = options.tauTurn ?? 0.25;
    this.tauAmplitude = options.tauAmplitude ?? 0.25;
    this.tauCamber = options.tauCamber ?? 0.18;
    this.tauWave = options.tauWave ?? 0.35;
    this.cruiseSpeed = options.cruiseSpeed ?? 2.0;

    this.phase = options.phase ?? Math.random() * TAU;
    this.omega = 0;
    this.tipAmplitude = this.tipAmpMin;
    this.amplitude = 0;
    this.camber = 0;
    this.turnAsymmetry = 0;
  }

  get tipGain() {
    const wave = TAU * this.waveNum;
    return Math.hypot(
      Math.sin(wave),
      this.mitigate * (1 - this.beta) - Math.cos(wave),
    );
  }

  /** Update from speed/acceleration in BL units and yaw rate in radians/s. */
  update(dt, speedBL, accelBL, yawRate) {
    dt = clamp(dt, 0, 0.05);

    // Slow manoeuvres recruit more of the body; fast cruising stiffens it.
    const waveTarget = 0.82 + (0.55 - 0.82) * saturate(speedBL / this.cruiseSpeed);
    this.waveNum += (waveTarget - this.waveNum) * (1 - Math.exp(-dt / this.tauWave));

    const burst = clamp(accelBL / this.accelReference, -0.8, 1.5) * this.burstGain;
    const speedEnvelope = speedBL / (speedBL + this.uHalf);
    const tipTarget = clamp(
      this.tipAmpMax * speedEnvelope * (1 + burst),
      this.tipAmpMin,
      this.tipAmpMax * 1.6,
    );
    this.tipAmplitude += (tipTarget - this.tipAmplitude)
      * (1 - Math.exp(-dt / this.tauAmplitude));
    this.amplitude = this.tipAmplitude / Math.max(this.tipGain, 1e-6);

    // St = f(2a)/U. Integrating phase keeps the body continuous as f changes.
    const swimFrequency = this.strouhal * speedBL / (2 * this.tipAmplitude);
    const hoverFrequency = this.idleFrequency * (1 - saturate(speedBL / this.uHalf));
    const frequency = clamp(Math.max(swimFrequency, hoverFrequency), 0, this.maxFrequency);
    this.omega = TAU * frequency;
    this.phase = (this.phase + this.omega * dt) % TAU;

    const camberTarget = clamp(
      -this.camberGain * (speedBL > 1e-4 ? yawRate / speedBL : 0),
      -this.camberMax,
      this.camberMax,
    );
    this.camber += (camberTarget - this.camber)
      * (1 - Math.exp(-dt / this.tauCamber));

    const turnTarget = -this.turnAsymmetryMax
      * Math.tanh(yawRate / this.turnYawReference)
      * smoothstep(0, this.uHalf, speedBL);
    this.turnAsymmetry += (turnTarget - this.turnAsymmetry)
      * (1 - Math.exp(-dt / this.tauTurn));
  }

  slope(u) {
    const wave = TAU * this.waveNum;
    const envelope = (1 - this.beta) * u + this.beta * u * u;
    const envelopeSlope = (1 - this.beta) + 2 * this.beta * u;
    const localPhase = wave * u - this.phase;
    const slope = this.amplitude * (
      envelopeSlope * Math.sin(localPhase)
      + envelope * wave * Math.cos(localPhase)
      + this.mitigate * (1 - this.beta) * Math.sin(this.phase)
    );
    // Deform the travelling displacement y into y + b*y²/a. Its derivative
    // makes one stroke broader and the opposite stroke smaller, without a
    // phase reset or a discontinuity at the centre crossing. The sign follows
    // camber's head-to-tail convention; this is visual steering, not thrust.
    const displacement = this.amplitude * (
      envelope * Math.sin(localPhase)
      + this.mitigate * (1 - this.beta) * u * Math.sin(this.phase)
    );
    return slope * (1 + 2 * this.turnAsymmetry * displacement
      / Math.max(this.tipAmplitude, 1e-6));
  }

  /** Relative joint bends. Index zero is always locked to the navigation heading. */
  relativeAngles(count, output = new Float32Array(count)) {
    const inverse = 1 / (count - 1);
    let previous = Math.atan(this.slope(0));
    output[0] = 0;

    for (let i = 1; i < count; i++) {
      const u = i * inverse;
      const tangent = Math.atan(this.slope(u));
      const flexibility = smoothstep(this.rigidA, this.rigidB, u);
      output[i] = flexibility * ((tangent - previous) + this.camber * inverse);
      previous = tangent;
    }
    return output;
  }
}
