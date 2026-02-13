/**
 * Lilypad class - Procedural lilypad rendering
 * Flat circular leaf with V-notch, radial veins, and center stem
 * @module animals/lilypad/Lilypad
 */

export class Lilypad {
  /**
   * @param {p5.Vector} origin - Starting position
   * @param {number} scale - Size scale factor
   * @param {p5.Color} bodyColor - Leaf surface color
   * @param {p5.Color} veinColor - Vein color
   */
  constructor(origin, scale = 1.0, bodyColor = null, veinColor = null) {
    this.scale = scale;
    this.position = origin.copy();

    // Leaf visual radius
    this.leafRadius = 120 * scale;

    // Fixed random rotation (overall orientation)
    this.rotation = random(TWO_PI);
    // Notch direction relative to rotation
    this.notchAngle = random(TWO_PI);
    this.notchHalf = PI / 10; // half-width of notch (~18 degrees each side, 36 total)

    // Colors
    this.bodyColor = bodyColor || color(60, 140, 60);
    this.veinColor = veinColor || color(35, 100, 35);

    // Pre-generate edge irregularity
    this.edgeSteps = 32;
    this.edgeJitter = [];
    for (let i = 0; i < this.edgeSteps; i++) {
      this.edgeJitter.push(random(0.93, 1.05));
    }

    // Pre-generate vein curves
    this.veinCount = Math.floor(random(6, 9));
    this.veinCurves = [];
    for (let i = 0; i < this.veinCount; i++) {
      const baseAngle = i * TWO_PI / this.veinCount + random(-0.15, 0.15);
      this.veinCurves.push({
        angle: baseAngle,
        bend: random(-0.08, 0.08),
        length: random(0.75, 0.9),
      });
    }
  }

  /**
   * Normalize angle difference to [-PI, PI]
   */
  _angleDiff(a, b) {
    let d = a - b;
    while (d > PI) d -= TWO_PI;
    while (d < -PI) d += TWO_PI;
    return d;
  }

  resolveToPosition(pos) {
    this.position = pos;
  }

  resetSpine(pos, _angle) {
    this.position = pos;
  }

  display() {
    const r = this.leafRadius;
    const s = this.scale;

    push();
    translate(this.position.x, this.position.y);
    rotate(this.rotation);

    // === Leaf surface (pac-man shape with irregular edge) ===
    fill(this.bodyColor);
    stroke(
      red(this.bodyColor) * 0.55,
      green(this.bodyColor) * 0.65,
      blue(this.bodyColor) * 0.55
    );
    strokeWeight(3.5 * s);

    // Build vertices: start from notch end, go around, end at notch start, then center
    beginShape();

    // Start at center (notch tip)
    vertex(0, 0);

    // From notch-end edge, walk CCW around the full circle back to notch-start edge
    const startAngle = this.notchAngle + this.notchHalf;
    const endAngle = this.notchAngle - this.notchHalf + TWO_PI; // ensure we go the long way

    for (let i = 0; i <= this.edgeSteps; i++) {
      const t = i / this.edgeSteps;
      const angle = startAngle + t * (endAngle - startAngle);
      const idx = i % this.edgeJitter.length;
      const jitter = this.edgeJitter[idx];
      vertex(cos(angle) * r * jitter, sin(angle) * r * jitter);
    }

    // Back to center
    vertex(0, 0);

    endShape(CLOSE);

    // === Radial veins ===
    stroke(this.veinColor);
    strokeWeight(2.2 * s);
    noFill();
    for (let i = 0; i < this.veinCount; i++) {
      const v = this.veinCurves[i];
      // Skip veins through the notch
      if (abs(this._angleDiff(v.angle, this.notchAngle)) < this.notchHalf + 0.15) continue;

      const endR = r * v.length;
      const midR = endR * 0.55;
      const bendAngle = v.angle + v.bend;
      bezier(
        0, 0,
        cos(bendAngle) * midR * 0.5, sin(bendAngle) * midR * 0.5,
        cos(bendAngle) * midR * 1.1, sin(bendAngle) * midR * 1.1,
        cos(v.angle) * endR, sin(v.angle) * endR
      );
    }

    // === Center stem dot ===
    noStroke();
    fill(
      red(this.bodyColor) * 0.5,
      green(this.bodyColor) * 0.5,
      blue(this.bodyColor) * 0.5
    );
    ellipse(0, 0, 10 * s, 10 * s);

    pop();
  }
}
