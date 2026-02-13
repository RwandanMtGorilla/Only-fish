/**
 * LotusCenter class - Procedural lotus center (stamen disk + carpel dots) rendering
 * Yellow disk with dense stamen dots, orange carpel dots in center
 * @module animals/lotus/LotusCenter
 */

export class LotusCenter {
  /**
   * @param {p5.Vector} origin - Starting position
   * @param {number} scale - Size scale factor
   * @param {p5.Color} centerColor - Base disk color (yellow-green)
   * @param {p5.Color} stamenColor - Stamen dot color (golden)
   */
  constructor(origin, scale, centerColor, stamenColor) {
    this.scale = scale;
    this.position = origin.copy();

    this.centerColor = centerColor;
    this.stamenColor = stamenColor;

    // Seed pod radius
    this.podRadius = 30 * scale;

    // Pre-generate stamen dots (outer ring, dense yellow)
    this.stamenDots = [];
    const stamenCount = Math.floor(random(40, 50));
    for (let i = 0; i < stamenCount; i++) {
      const angle = random(TWO_PI);
      const r = random(0.45, 0.9) * this.podRadius;
      this.stamenDots.push({
        x: cos(angle) * r,
        y: sin(angle) * r,
        size: random(3.0, 5.0) * scale,
      });
    }

    // Pre-generate carpel dots (center, dense orange)
    this.carpelDots = [];
    const carpelCount = Math.floor(random(24, 36));
    for (let i = 0; i < carpelCount; i++) {
      const angle = random(TWO_PI);
      const r = random(0.05, 0.45) * this.podRadius;
      this.carpelDots.push({
        x: cos(angle) * r,
        y: sin(angle) * r,
        size: random(3.5, 5.5) * scale,
      });
    }
  }

  resolveToPosition(pos) {
    this.position = pos;
  }

  resetSpine(pos, _angle) {
    this.position = pos;
  }

  display() {
    const pr = this.podRadius;

    push();
    translate(this.position.x, this.position.y);

    // === Yellow stamen disk (base) ===
    noStroke();
    fill(
      red(this.stamenColor),
      green(this.stamenColor),
      blue(this.stamenColor)
    );
    ellipse(0, 0, pr * 2, pr * 2);

    // === Dense stamen dots (outer ring, slightly lighter yellow) ===
    for (let i = 0; i < this.stamenDots.length; i++) {
      const dot = this.stamenDots[i];
      fill(
        min(255, red(this.stamenColor) * 1.1),
        min(255, green(this.stamenColor) * 1.05),
        blue(this.stamenColor) * 0.8
      );
      ellipse(dot.x, dot.y, dot.size, dot.size);
    }

    // === Dense orange carpel dots (center) ===
    for (let i = 0; i < this.carpelDots.length; i++) {
      const dot = this.carpelDots[i];
      fill(
        min(255, red(this.stamenColor) * 1.1),
        green(this.stamenColor) * 0.55,
        blue(this.stamenColor) * 0.2
      );
      ellipse(dot.x, dot.y, dot.size, dot.size);
    }

    pop();
  }
}
