/**
 * FoodItem class - Represents a piece of fish food placed by the user
 * @module entities/FoodItem
 */

export class FoodItem {
  /**
   * @param {number} x - X position on canvas
   * @param {number} y - Y position on canvas
   */
  constructor(x, y) {
    this.position = createVector(x, y);
    this.hp = Math.floor(random(1, 4));  // 随机 1-3 单位
    this.maxHp = this.hp;
    this.k = 1 / 16;  // r^2 * k = unit
    this.radius = Math.sqrt(this.hp / this.k);
    this.lastConsumeTime = 0;
    this.cooldown = 300;  // 0.3s
    this._buildVertices();
  }

  _buildVertices() {
    const sides = this.hp + 2 + Math.round(random(0, 1));
    this.vertices = [];
    for (let i = 0; i < sides; i++) {
      const angle = TWO_PI / sides * i;
      const jitter = random(0.7, 1.0);
      this.vertices.push({ angle, jitter });
    }
  }

  /**
   * 尝试消耗一单位鱼食
   * @returns {boolean} 是否成功消耗
   */
  tryConsume(now = millis()) {
    if (now - this.lastConsumeTime < this.cooldown) return false;
    this.hp -= 1;
    this.radius = Math.sqrt(this.hp / this.k);
    this._buildVertices();
    this.lastConsumeTime = now;
    return true;
  }

  isDepleted() {
    return this.hp <= 0;
  }

  attract(boids, grabbedBoid) {
    let closestBoid = null;
    let closestDist = Infinity;

    for (let i = 0; i < boids.length; i++) {
      const boid = boids[i];
      if (boid === grabbedBoid || boid.isGrabbed) continue;
      if (boid.eatCooldown == null) continue;

      const center = boid.position;
      const d = p5.Vector.dist(this.position, center);
      const attractRange = boid.radius * 3;

      if (d < attractRange && d < closestDist) {
        closestDist = d;
        closestBoid = boid;
      }
    }

    if (!closestBoid) return;
    const hpFactor = 1.5 / this.hp;
    const center = closestBoid.position;
    const attractRange = closestBoid.radius * 1.6 *  hpFactor;
    const t = closestDist / attractRange;
    const basePull = (1 - t) * (1 - t);

    const maxPullSpeed = 1.1 * hpFactor;
    const speed = basePull * hpFactor * maxPullSpeed;

    const dir = p5.Vector.sub(center, this.position);
    if (dir.mag() > 0.1) {
      dir.normalize().mult(speed);
      this.position.add(dir);
    }
  }

  display() {
    const r = this.radius;
    push();
    noStroke();
    fill(255, 200, 80, 200);
    beginShape();
    for (let i = 0; i < this.vertices.length; i++) {
      const v = this.vertices[i];
      const vx = this.position.x + cos(v.angle) * r * v.jitter;
      const vy = this.position.y + sin(v.angle) * r * v.jitter;
      vertex(vx, vy);
    }
    endShape(CLOSE);
    pop();
  }
}
