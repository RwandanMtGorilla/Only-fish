/**
 * Boid 物理行为公共方法集合
 * 作为 mixin 混入各动物的 Boid 类
 * 要求目标类实例上存在: position, velocity, maxSpeed, maxForce, radius, mass
 * @module boids/BoidPhysics
 */

const BoidPhysics = {

  /**
   * Seek 目标位置, 含到达减速
   * @param {p5.Vector} target
   * @returns {p5.Vector} 转向力
   */
  seek(target) {
    const diff = p5.Vector.sub(target, this.position);
    const desired = diff.copy();
    const buffer = this.radius * 2 + 1;
    const dist = diff.mag();

    if (dist <= 0) {
      desired.set(0, 0);
    } else if (dist < buffer) {
      desired.normalize().mult(this.maxSpeed * dist / buffer);
    } else if (dist <= 200) {
      desired.normalize().mult(this.maxSpeed * dist / 200);
    } else {
      desired.limit(this.maxSpeed);
    }
    desired.sub(this.velocity);
    desired.limit(this.maxForce);
    return desired;
  },

  /**
   * 施加带权重的力
   * @param {p5.Vector} force
   * @param {number} coefficient - 权重系数
   */
  applyForce(force, coefficient = 1) {
    const f = force.copy().mult(coefficient);
    this.velocity.add(f);
    this.velocity.limit(this.maxSpeed);
  },

  /**
   * 边界处理: walls 时反弹, 否则环绕
   */
  edgeCheck(walls, w, h) {
    if (walls) {
      this.wallBounce(w, h);
    } else {
      this.borderWrap(w, h);
    }
  },

  /**
   * 墙壁反弹
   */
  wallBounce(w, h) {
    if (this.position.x <= this.radius) {
      this.position.x = this.radius;
    } else if (this.position.x >= w - this.radius) {
      this.position.x = w - this.radius;
    }
    if (this.position.y <= this.radius) {
      this.position.y = this.radius;
    } else if (this.position.y >= h - this.radius) {
      this.position.y = h - this.radius;
    }
    if (this.distanceFromHorWall(h) <= this.radius) {
      this.velocity.y *= -1;
    }
    if (this.distanceFromVertWall(w) <= this.radius) {
      this.velocity.x *= -1;
    }
  },

  /**
   * 到垂直墙壁(左或右)的距离
   */
  distanceFromVertWall(w) {
    if (this.velocity.x > 0) {
      return w - this.position.x;
    }
    return this.position.x;
  },

  /**
   * 到水平墙壁(上或下)的距离
   */
  distanceFromHorWall(h) {
    if (this.velocity.y > 0) {
      return h - this.position.y;
    }
    return this.position.y;
  },

  /**
   * 避墙力: 靠近墙壁时趋向画布中心
   */
  avoidWalls(w, h, center) {
    const buffer = 15;
    if (this.distanceFromHorWall(h) < this.radius * buffer ||
        this.distanceFromVertWall(w) < this.radius * buffer) {
      return this.seek(center);
    }
    return null;
  },

  /**
   * 碰撞检测: 遍历 boid 列表, 发现重叠时解算弹性碰撞
   * @param {Array} allBoids
   */
  detectCollision(allBoids) {
    for (let i = 0; i < allBoids.length; i++) {
      if (allBoids[i] === this) continue;
      if (allBoids[i].isGrabbed) continue;
      const dist = p5.Vector.dist(this.position, allBoids[i].position);
      if (dist - (this.radius + allBoids[i].radius) < 0) {
        this.resolveCollision(this, allBoids[i]);
      }
    }
  },

  /**
   * 旋转速度向量
   */
  rotate(velocity, angle) {
    return {
      x: velocity.x * Math.cos(angle) - velocity.y * Math.sin(angle),
      y: velocity.x * Math.sin(angle) + velocity.y * Math.cos(angle)
    };
  },

  /**
   * 弹性碰撞解算 (基于质量的动量守恒)
   */
  resolveCollision(boid, otherBoid) {
    const xVelocityDiff = boid.velocity.x - otherBoid.velocity.x;
    const yVelocityDiff = boid.velocity.y - otherBoid.velocity.y;
    const xDist = otherBoid.position.x - boid.position.x;
    const yDist = otherBoid.position.y - boid.position.y;

    if (xVelocityDiff * xDist + yVelocityDiff * yDist >= 0) {
      const angle = -Math.atan2(otherBoid.position.y - boid.position.y, otherBoid.position.x - boid.position.x);
      const m1 = boid.mass;
      const m2 = otherBoid.mass;

      const u1 = this.rotate(boid.velocity, angle);
      const u2 = this.rotate(otherBoid.velocity, angle);

      const v1 = { x: u1.x * (m1 - m2) / (m1 + m2) + u2.x * 2 * m2 / (m1 + m2), y: u1.y };
      const v2 = { x: u2.x * (m1 - m2) / (m1 + m2) + u1.x * 2 * m2 / (m1 + m2), y: u2.y };

      const vFinal1 = this.rotate(v1, -angle);
      const vFinal2 = this.rotate(v2, -angle);

      boid.velocity.x = vFinal1.x;
      boid.velocity.y = vFinal1.y;
      boid.velocity.limit(boid.maxSpeed);

      otherBoid.velocity.x = vFinal2.x;
      otherBoid.velocity.y = vFinal2.y;
      otherBoid.velocity.limit(otherBoid.maxSpeed);
    }
  },

  /**
   * 跨组 separation: 只对不同组的 boid 做排斥, 同组跳过(已在 flock 中处理)
   * @param {Array} allBoids - 所有组的 boid 扁平列表
   * @param {string} ownGroup - 自己所属的组名
   */
  separateFromOthers(allBoids, ownGroup) {
    const sum = createVector(0, 0);
    let count = 0;
    for (let j = 0; j < allBoids.length; j++) {
      const other = allBoids[j];
      if (other === this) continue;
      if (other.group === ownGroup) continue;
      const desiredSep = this.radius + other.radius + 30;
      const sep = p5.Vector.dist(this.position, other.position);
      if (sep > 0 && sep < desiredSep) {
        const diff = p5.Vector.sub(this.position, other.position).normalize().div(sep);
        sum.add(diff);
        count++;
      }
    }
    if (count > 0) {
      sum.div(count);
      sum.normalize();
      sum.mult(this.maxSpeed);
      sum.sub(this.velocity);
      sum.limit(this.maxForce);
      this.applyForce(sum, 1.0);
    }
  },
};

/**
 * 将 BoidPhysics 的所有方法混入目标类的 prototype
 * 如果目标类已定义同名方法, 不覆盖 (允许动物特化)
 * @param {Function} TargetClass
 */
export function applyBoidPhysics(TargetClass) {
  for (const [key, fn] of Object.entries(BoidPhysics)) {
    if (!TargetClass.prototype[key]) {
      TargetClass.prototype[key] = fn;
    }
  }
}
