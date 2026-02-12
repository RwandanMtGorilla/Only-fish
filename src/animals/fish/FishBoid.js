/**
 * FishBoid class - Combines boid flocking physics with Fish rendering
 * 鱼特有的 boid 行为: flock 力权重, racism separation, borderWrap + resetSpine
 * 通用物理方法由 BoidPhysics mixin 提供
 * @module animals/fish/FishBoid
 */

import { Fish } from './Fish.js';
import { applyBoidPhysics } from '../../boids/BoidPhysics.js';

export class FishBoid {
  /**
   * @param {Object} config
   * @param {number} config.id - Unique identifier
   * @param {string} config.group - 所属组名 (用于跨组 separation)
   * @param {number} config.x - Initial x position
   * @param {number} config.y - Initial y position
   * @param {number} config.scale - Fish size scale
   * @param {p5.Color} config.bodyColor - Fish body color
   * @param {p5.Color} config.finColor - Fish fin color
   * @param {number} config.colorId - Color group ID for diversity/separation
   * @param {number} config.introversion - Base introversion value
   * @param {number} config.introversionCoefficient - Individual introversion multiplier
   * @param {number} config.quickness - Base quickness value
   * @param {number} config.quicknessCoefficient - Individual quickness multiplier
   * @param {number} config.racism - Base color-separation value
   * @param {number} config.racismCoefficient - Individual racism multiplier
   * @param {number} config.speedIndex - Base speed factor
   */
  constructor(config) {
    this.id = config.id;
    this.group = config.group;
    this.scale = config.scale;
    this.colorId = config.colorId;

    // 物理状态
    this.position = createVector(config.x, config.y);

    // 个体差异系数
    this.introversionCoefficient = config.introversionCoefficient;
    this.introversion = config.introversion * this.introversionCoefficient;
    this.quicknessCoefficient = config.quicknessCoefficient;
    this.quickness = config.quickness * this.quicknessCoefficient;
    this.racismCoefficient = config.racismCoefficient;
    this.racism = config.racism * this.racismCoefficient;

    // 速度
    this.speedIndex = config.speedIndex;
    this.maxSpeed = this.speedIndex * this.quickness;
    this.maxForce = 0.3;

    // 有效半径 (基于鱼体长度)
    this.radius = this.scale * 200;
    this.mass = Math.pow(this.scale, 3);

    // 随机初始速度
    const angle = random(-PI, PI);
    this.velocity = p5.Vector.fromAngle(angle).mult(this.maxSpeed * 0.5);

    // 渲染实例
    this.fish = new Fish(this.position.copy(), this.scale, config.bodyColor, config.finColor);

    // 抓取状态 (由外部设置)
    this.isGrabbed = false;

    // 进食冷却
    this.lastEatTime = 0;
    this.eatCooldown = 300;
  }

  // === 鱼特有的 Boid 行为 ===

  /**
   * Separation: 远离附近 boid, 含 racism 额外排斥逻辑
   */
  separate(allBoids) {
    const sum = createVector(0, 0);
    let count = 0;
    for (let j = 0; j < allBoids.length; j++) {
      if (allBoids[j] === this) continue;
      const racismMultiplier = (this.colorId !== allBoids[j].colorId) ? this.racism : 0;
      const desiredSep = this.radius + allBoids[j].radius + (20 * this.introversion) + (40 * racismMultiplier);
      const sep = p5.Vector.dist(this.position, allBoids[j].position);
      if (sep > 0 && sep < desiredSep) {
        const diff = p5.Vector.sub(this.position, allBoids[j].position).normalize().div(sep);
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
    }
    return sum;
  }

  /**
   * Alignment: 趋向附近 boid 的平均速度方向
   */
  align(allBoids) {
    const neighborDist = 300;
    const sum = createVector(0, 0);
    let count = 0;
    for (let i = 0; i < allBoids.length; i++) {
      if (allBoids[i] === this) continue;
      if (allBoids[i].isGrabbed) continue;
      const dist = p5.Vector.dist(this.position, allBoids[i].position);
      if (dist > 0 && dist < neighborDist) {
        sum.add(allBoids[i].velocity);
        count++;
      }
    }
    if (count > 0) {
      sum.div(count);
      sum.normalize();
      sum.mult(this.maxSpeed);
      sum.sub(this.velocity);
      sum.limit(this.maxForce);
      return sum;
    }
    return createVector(0, 0);
  }

  /**
   * Cohesion: 趋向附近 boid 的平均位置
   */
  cohesion(allBoids) {
    const neighborDist = 300;
    const sum = createVector(0, 0);
    let count = 0;
    for (let i = 0; i < allBoids.length; i++) {
      if (allBoids[i] === this) continue;
      if (allBoids[i].isGrabbed) continue;
      const dist = p5.Vector.dist(this.position, allBoids[i].position);
      if (dist > 0 && dist < neighborDist) {
        sum.add(allBoids[i].position);
        count++;
      }
    }
    if (count > 0) {
      sum.div(count);
      return this.seek(sum);
    }
    return createVector(0, 0);
  }

  /**
   * 计算并施加所有群体行为力 (组内)
   * @param {Array} sameGroupBoids - 同组的 boid 列表
   * @param {Object} settings - 全局设置
   */
  flock(sameGroupBoids, settings) {
    const alignForce = this.align(sameGroupBoids);
    const separateForce = this.separate(sameGroupBoids);
    const cohesionForce = this.cohesion(sameGroupBoids);

    this.applyForce(alignForce, 1.2);
    this.applyForce(separateForce, 1.0);
    this.applyForce(cohesionForce, 1.0);

    if (settings.mouseSeek) {
      const mouseForce = this.seek(settings.mousePos);
      this.applyForce(mouseForce, 0.2);
    }

    if (settings.feedMode && settings.foods && settings.foods.length > 0) {
      let closestFood = null;
      let closestDist = Infinity;
      for (let i = 0; i < settings.foods.length; i++) {
        const d = p5.Vector.dist(this.position, settings.foods[i].position);
        if (d < closestDist) {
          closestDist = d;
          closestFood = settings.foods[i];
        }
      }
      if (closestFood) {
        const foodForce = this.seek(closestFood.position);
        this.applyForce(foodForce, 0.8);
      }
    }

    if (settings.walls) {
      const wallForce = this.avoidWalls(settings.canvasW, settings.canvasH, settings.center);
      if (wallForce) this.applyForce(wallForce, 1.2);
    }
  }

  /**
   * 物理更新: 位移 + 碰撞 + 边界 + IK 解算
   * 由 AnimalRegistry.update() 在 flock + separateFromOthers 之后调用
   * @param {Array} sameGroupBoids - 同组的 boid 列表
   * @param {Object} settings - 全局设置
   */
  physicsUpdate(sameGroupBoids, settings) {
    this.position.add(this.velocity);
    if (settings.collisions) this.detectCollision(sameGroupBoids);
    this.edgeCheck(settings.walls, settings.canvasW, settings.canvasH);
    // 驱动 IK 鱼体动画, 必须传 copy
    this.fish.resolveToPosition(this.position.copy());
  }

  /**
   * 仅更新渲染位置 (不做 flock/碰撞, 用于被抓取时)
   */
  resolveRenderPosition() {
    this.fish.resolveToPosition(this.position.copy());
  }

  /**
   * 渲染鱼体
   */
  display() {
    this.fish.display();
  }

  /**
   * 边界环绕: 含 resetSpine 逻辑, 覆盖 BoidPhysics 的默认 borderWrap
   */
  borderWrap(w, h) {
    let wrapped = false;
    const margin = this.radius + 200;
    if (this.position.x < -margin) { this.position.x = w + margin; wrapped = true; }
    else if (this.position.x > w + margin) { this.position.x = -margin; wrapped = true; }
    if (this.position.y < -margin) { this.position.y = h + margin; wrapped = true; }
    else if (this.position.y > h + margin) { this.position.y = -margin; wrapped = true; }
    if (wrapped) {
      this.fish.resetSpine(this.position, this.velocity.heading());
    }
  }
}

// 混入通用物理方法 (seek, applyForce, edgeCheck, wallBounce, collision 等)
// FishBoid 已定义的方法不会被覆盖 (如 borderWrap)
applyBoidPhysics(FishBoid);
