/** Fixed 60 Hz simulation; cap catch-up after stalls/background tabs. */
export class FixedStepClock {
  constructor() {
    this.stepMs = 1000 / 60;
    this.accumulator = 0;
    this.time = 0;
  }

  advance(elapsedMs, update) {
    if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return;
    this.accumulator += Math.min(elapsedMs, 250);
    while (this.accumulator + 1e-9 >= this.stepMs) {
      this.accumulator = Math.max(0, this.accumulator - this.stepMs);
      this.time += this.stepMs;
      update(this.stepMs, this.time);
    }
  }
}
