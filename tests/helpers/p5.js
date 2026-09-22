// Minimal deterministic p5 math adapter; drawing is intentionally outside unit tests.
export class Vector {
  constructor(x = 0, y = 0) { this.x = x; this.y = y; }
  copy() { return new Vector(this.x, this.y); }
  set(x, y) { if (typeof x === 'object') ({ x, y } = x); this.x = x; this.y = y; return this; }
  add(x, y) { if (typeof x === 'object') ({ x, y } = x); this.x += x; this.y += y; return this; }
  sub(v) { this.x -= v.x; this.y -= v.y; return this; }
  mult(n) { this.x *= n; this.y *= n; return this; }
  div(n) { return this.mult(1 / n); }
  mag() { return Math.hypot(this.x, this.y); }
  normalize() { const m = this.mag(); return m ? this.div(m) : this; }
  setMag(n) { return this.normalize().mult(n); }
  limit(n) { return this.mag() > n ? this.setMag(n) : this; }
  heading() { return Math.atan2(this.y, this.x); }
  static sub(a, b) { return a.copy().sub(b); }
  static add(a, b) { return a.copy().add(b); }
  static dist(a, b) { return Vector.sub(a, b).mag(); }
  static fromAngle(a) { return new Vector(Math.cos(a), Math.sin(a)); }
  static lerp(a, b, t) { return new Vector(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t); }
}
Object.assign(globalThis, {
  p5: { Vector }, createVector: (x, y) => new Vector(x, y),
  PI: Math.PI, TWO_PI: Math.PI * 2, HALF_PI: Math.PI / 2,
  sin: Math.sin, cos: Math.cos, atan2: Math.atan2, abs: Math.abs,
  sqrt: Math.sqrt, pow: Math.pow,
  constrain: (v, a, b) => Math.max(a, Math.min(b, v)),
  map: (v, a, b, c, d) => c + (v - a) / (b - a) * (d - c),
  random: (a = 1, b) => b === undefined ? a * 0.5 : (a + b) / 2,
  randomGaussian: (mean = 0) => mean,
  color: (...values) => values,
  red: c => c[0], green: c => c[1], blue: c => c[2],
  millis: () => 0, width: 1200, height: 800,
});
