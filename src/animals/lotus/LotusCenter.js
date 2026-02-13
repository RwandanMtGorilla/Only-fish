/**
 * LotusCenter class - Procedural lotus center (seed pod + stamens) rendering
 * @module animals/lotus/LotusCenter
 */

export class LotusCenter {
  /**
   * @param {p5.Vector} origin - Starting position
   * @param {number} scale - Size scale factor
   * @param {p5.Color} centerColor - Seed pod color (yellow-green)
   * @param {p5.Color} stamenColor - Stamen/anther color (golden)
   */
  constructor(origin, scale, centerColor, stamenColor) {
    this.scale = scale;
    this.position = origin.copy();

    this.centerColor = centerColor;
    this.stamenColor = stamenColor;

    // Seed pod radius
    this.podRadius = 30 * scale;

    // Pre-generate seed dots on the pod surface
    this.dotCount = Math.floor(random(6, 11));
    this.dots = [];
    for (let i = 0; i < this.dotCount; i++) {
      const angle = random(TWO_PI);
      const r = random(0.15, 0.65) * this.podRadius;
      this.dots.push({ x: cos(angle) * r, y: sin(angle) * r });
    }

    // Pre-generate stamen data
    this.stamenCount = Math.floor(random(8, 13));
    this.stamens = [];
    for (let i = 0; i < this.stamenCount; i++) {
      const baseAngle = (TWO_PI / this.stamenCount) * i + random(-0.15, 0.15);
      this.stamens.push({
        angle: baseAngle,
        length: this.podRadius * random(0.55, 0.8),
        bend: random(-0.12, 0.12),
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
    const s = this.scale;
    const pr = this.podRadius;

    push();
    translate(this.position.x, this.position.y);

    // === Stamens (behind the pod) ===
    for (let i = 0; i < this.stamenCount; i++) {
      const st = this.stamens[i];
      const startR = pr * 0.85;
      const endR = pr + st.length;
      const sx = cos(st.angle) * startR;
      const sy = sin(st.angle) * startR;
      const bendAngle = st.angle + st.bend;
      const midR = (startR + endR) * 0.5;
      const ex = cos(st.angle) * endR;
      const ey = sin(st.angle) * endR;

      // Stamen filament
      stroke(red(this.stamenColor), green(this.stamenColor), blue(this.stamenColor));
      strokeWeight(1.2 * s);
      noFill();
      bezier(
        sx, sy,
        cos(bendAngle) * midR, sin(bendAngle) * midR,
        cos(bendAngle) * (midR + st.length * 0.3), sin(bendAngle) * (midR + st.length * 0.3),
        ex, ey
      );

      // Anther (small dot at tip)
      noStroke();
      fill(red(this.stamenColor), green(this.stamenColor), blue(this.stamenColor));
      ellipse(ex, ey, 3.5 * s, 3.5 * s);
    }

    // === Seed pod (on top of stamens) ===
    fill(this.centerColor);
    stroke(
      red(this.centerColor) * 0.6,
      green(this.centerColor) * 0.6,
      blue(this.centerColor) * 0.6
    );
    strokeWeight(2 * s);
    ellipse(0, 0, pr * 2, pr * 1.85);

    // === Seed dots ===
    noStroke();
    fill(
      red(this.centerColor) * 0.45,
      green(this.centerColor) * 0.45,
      blue(this.centerColor) * 0.45
    );
    for (let i = 0; i < this.dotCount; i++) {
      ellipse(this.dots[i].x, this.dots[i].y, 3.5 * s, 3.5 * s);
    }

    pop();
  }
}
