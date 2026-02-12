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
  tryConsume() {
    const now = millis();
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
