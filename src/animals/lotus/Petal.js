/**
 * Petal class - Procedural lotus petal rendering
 * Teardrop-shaped petal with central vein, supports alpha for fade-out
 * @module animals/lotus/Petal
 */

export class Petal {
  /**
   * @param {p5.Vector} origin - Starting position
   * @param {number} scale - Size scale factor
   * @param {p5.Color} petalColor - Petal fill color
   * @param {p5.Color} petalEdgeColor - Petal stroke/edge color
   * @param {number} layerIndex - Layer index (0=inner, 1=mid, 2=outer)
   */
  constructor(origin, scale, petalColor, petalEdgeColor, layerIndex) {
    this.scale = scale;
    this.position = origin.copy();
    this.angle = 0;

    this.layerIndex = layerIndex;

    // Outer layers get darker colors (inner=1.0, mid=0.9, outer=0.8)
    const darken = 1.0 - layerIndex * 0.1;
    this.petalColor = color(
      red(petalColor) * darken,
      green(petalColor) * darken,
      blue(petalColor) * darken
    );
    this.petalEdgeColor = color(
      red(petalEdgeColor) * darken,
      green(petalEdgeColor) * darken,
      blue(petalEdgeColor) * darken
    );

    // Petal dimensions scale with layer (outer petals are larger)
    this.petalLength = (50 + layerIndex * 18) * scale;
    this.petalWidth = (22 + layerIndex * 6) * scale;

    // Per-petal random variation for natural look
    this.tipBend = random(-0.06, 0.06);
    this.widthJitter = random(0.9, 1.1);

    // Alpha for fade-out (255 = fully opaque)
    this.alpha = 255;
  }

  /**
   * Update position and rotation angle
   * @param {p5.Vector} pos
   * @param {number} angle - Radial direction from center outward
   */
  resolveToPosition(pos, angle) {
    this.position = pos;
    this.angle = angle;
  }

  display() {
    if (this.alpha <= 0) return;

    const len = this.petalLength;
    const w = this.petalWidth * this.widthJitter;

    push();
    translate(this.position.x, this.position.y);
    rotate(this.angle - HALF_PI); // rotate so petal points outward

    // Petal fill with alpha
    const pc = this.petalColor;
    fill(red(pc), green(pc), blue(pc), this.alpha);
    const ec = this.petalEdgeColor;
    stroke(red(ec), green(ec), blue(ec), this.alpha);
    strokeWeight(1.2 * this.scale);

    // Teardrop shape using curveVertex
    beginShape();
    // Base (narrow)
    curveVertex(0, 0);
    curveVertex(0, 0);
    // Left side widens
    curveVertex(-w * 0.35, len * 0.25);
    curveVertex(-w * 0.5, len * 0.5);
    curveVertex(-w * 0.4, len * 0.75);
    // Tip
    curveVertex(this.tipBend * w, len);
    // Right side (mirror)
    curveVertex(w * 0.4, len * 0.75);
    curveVertex(w * 0.5, len * 0.5);
    curveVertex(w * 0.35, len * 0.25);
    // Back to base
    curveVertex(0, 0);
    curveVertex(0, 0);
    endShape(CLOSE);

    // Central vein line
    stroke(red(ec), green(ec), blue(ec), this.alpha * 0.4);
    strokeWeight(0.8 * this.scale);
    line(0, len * 0.1, this.tipBend * w * 0.5, len * 0.85);

    pop();
  }
}
