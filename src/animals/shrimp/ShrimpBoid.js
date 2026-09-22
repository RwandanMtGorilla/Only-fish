/**
 * ShrimpBoid class - 结合Boid群体行为物理和Shrimp渲染
 * 虾特有的boid行为：更慢的速度、更高的躲避倾向、更小的体型参数
 * 通用物理方法由BoidPhysics mixin提供
 * @module animals/shrimp/ShrimpBoid
 */

// 【关键修改1：导入虾的渲染类，替换鱼的渲染类】
import { Shrimp } from './Shrimp.js';
import { applyBoidPhysics } from '../../boids/BoidPhysics.js';

export class ShrimpBoid {
  /**
   * @param {Object} config
   * @param {number} config.id - 唯一标识
   * @param {string} config.group - 所属组名 (用于跨组分离)
   * @param {number} config.x - 初始x坐标
   * @param {number} config.y - 初始y坐标
   * @param {number} config.scale - 虾的尺寸缩放
   * @param {p5.Color} config.bodyColor - 虾身体颜色
   * @param {p5.Color} config.finColor - 虾步足/触角颜色
   * @param {number} config.colorId - 颜色组ID（用于多样性/分离）
   * @param {number} config.introversion - 基础内向值（躲避距离）
   * @param {number} config.introversionCoefficient - 个体内向系数
   * @param {number} config.quickness - 基础敏捷值
   * @param {number} config.quicknessCoefficient - 个体敏捷系数
   * @param {number} config.colorSeparation - 基础颜色分离值
   * @param {number} config.colorSeparationCoefficient - 个体颜色分离系数
   * @param {number} config.speedIndex - 基础速度因子
   * @param {number} config.reactionDelayMs - 速度同步反应延迟（毫秒）
   */
  constructor(config) {
    this.id = config.id;
    this.group = config.group;
    this.scale = config.scale;
    this.colorId = config.colorId;

    // 物理状态（和鱼一致）
    this.position = createVector(config.x, config.y);

    // 个体差异系数（和鱼一致）
    this.introversionCoefficient = config.introversionCoefficient;
    this.introversion = config.introversion * this.introversionCoefficient;
    this.quicknessCoefficient = config.quicknessCoefficient;
    this.quickness = config.quickness * this.quicknessCoefficient;
    this.colorSeparationCoefficient = config.colorSeparationCoefficient;
    this.colorSeparation = config.colorSeparation * this.colorSeparationCoefficient;

    // 【关键修改2：虾的速度参数（更慢、更迟钝）】
    this.speedIndex = config.speedIndex;
    this.maxSpeed = this.speedIndex * this.quickness;
    this.maxForce = config.maxForce;
    this.reactionDelayMs = Math.max(0, config.reactionDelayMs ?? 0);
    this.velocityHistory = [];

    // 【关键修改3：虾的有效半径（体型更小）】
    this.radius = this.scale * 120; // 鱼是scale*200，虾的碰撞/躲避半径更小
    this.mass = Math.pow(this.scale, 3) * 0.8; // 虾的质量更轻

    // 随机初始速度（和鱼一致，但maxSpeed已调小，实际速度更慢）
    const angle = random(-PI, PI);
    this.velocity = p5.Vector.fromAngle(angle).mult(this.maxSpeed * 0.5);

    // 【关键修改4：创建虾的渲染实例，替换鱼】
    this.shrimp = new Shrimp(this.position.copy(), this.scale, config.bodyColor, config.finColor);

    // 抓取状态（和鱼一致）
    this.isGrabbed = false;

    // 【关键修改5：虾的进食冷却（略短，更频繁进食）】
    this.lastEatTime = 0;
    this.eatCooldown = 250; // 鱼是300，虾的冷却时间更短
  }

  /**
   * 【关键修改6：虾的抓取判定中心（身体更短，偏移更小）】
   * 命中测试中心：从头部沿速度反方向偏移到虾身前段
   */
  get hitCenter() {
    const offset = this.scale * 60;  // 鱼是scale*96，虾的身体更短，偏移更小
    const heading = this.velocity.heading();
    return createVector(
      this.position.x - cos(heading) * offset,
      this.position.y - sin(heading) * offset
    );
  }

  // === 虾的群体行为（复用鱼的逻辑，仅微调力权重） ===

  /**
   * Separation: 远离附近boid，含colorSeparation额外排斥（和鱼逻辑一致）
   */
  separate(allBoids) {
    const sum = createVector(0, 0);
    let count = 0;
    for (let j = 0; j < allBoids.length; j++) {
      if (allBoids[j] === this) continue;
      const colorSeparationMultiplier = (this.colorId !== allBoids[j].colorId) ? this.colorSeparation : 0;
      const desiredSep = this.radius + allBoids[j].radius + (20 * this.introversion) + (40 * colorSeparationMultiplier);
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
   * Alignment: 趋向附近boid的平均速度方向（和鱼逻辑一致）
   */
  align(allBoids, updateTime = millis()) {
    const neighborDist = 250; // 鱼是300，虾的感知范围更小
    const targetTime = updateTime - this.reactionDelayMs;
    const sum = createVector(0, 0);
    let count = 0;
    for (let i = 0; i < allBoids.length; i++) {
      if (allBoids[i] === this) continue;
      if (allBoids[i].isGrabbed) continue;
      const dist = p5.Vector.dist(this.position, allBoids[i].position);
      if (dist > 0 && dist < neighborDist) {
        sum.add(allBoids[i].getVelocityAt(targetTime));
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
   * Cohesion: 趋向附近boid的平均位置（和鱼逻辑一致）
   */
  cohesion(allBoids) {
    const neighborDist = 250; // 鱼是300，虾的聚合范围更小
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
   * 计算并施加所有群体行为力（组内）
   * 【关键修改7：微调力权重，虾更胆小，躲避力更高】
   * @param {Array} sameGroupBoids - 同组的boid列表
   * @param {Object} settings - 全局设置
   */
  flock(sameGroupBoids, settings, updateTime = millis()) {
    const alignForce = this.align(sameGroupBoids, updateTime);
    const separateForce = this.separate(sameGroupBoids);
    const cohesionForce = this.cohesion(sameGroupBoids);

    // 鱼的权重：align(1.2)、separate(1.0)、cohesion(1.0)
    // 虾的权重：躲避力更高（1.5），对齐/聚合稍低（更独立）
    this.applyForce(alignForce, 1.0);
    this.applyForce(separateForce, 1.5);
    this.applyForce(cohesionForce, 0.8);

    // 鼠标跟随（和鱼一致，权重稍低）
    if (settings.mouseSeek) {
      const mouseForce = this.seek(settings.mousePos);
      this.applyForce(mouseForce, 0.15); // 鱼是0.2，虾更不跟随鼠标
    }

    // 觅食行为（和鱼一致，权重稍高，虾更贪吃）
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
        this.applyForce(foodForce, 0.9); // 鱼是0.8，虾的觅食力更高
      }
    }

    // 避墙行为（和鱼一致）
    if (settings.walls) {
      const wallForce = this.avoidWalls(settings.canvasW, settings.canvasH, settings.center);
      if (wallForce) this.applyForce(wallForce, 1.2);
    }
  }

  /**
   * 物理更新：位移 + 碰撞 + 边界 + IK解算（和鱼逻辑一致）
   * @param {Array} sameGroupBoids - 同组的boid列表
   * @param {Object} settings - 全局设置
   */
  physicsUpdate(sameGroupBoids, settings) {
    this.position.add(this.velocity);
    if (settings.collisions) this.detectCollision(sameGroupBoids);
    this.edgeCheck(settings.walls, settings.canvasW, settings.canvasH);
    // 驱动IK虾体动画，必须传copy
    this.shrimp.resolveToPosition(this.position.copy());
  }

  /**
   * 仅更新渲染位置（不做flock/碰撞，用于被抓取时）
   */
  resolveRenderPosition() {
    this.shrimp.resolveToPosition(this.position.copy());
  }

  /**
   * 渲染虾体（替换鱼的渲染）
   */
  display() {
    this.shrimp.display();
  }

  /**
   * 边界环绕：含resetSpine逻辑，覆盖BoidPhysics的默认borderWrap（和鱼一致）
   */
  borderWrap(w, h) {
    let wrapped = false;
    const margin = this.radius + 150; // 鱼是+200，虾的边界margin更小
    if (this.position.x < -margin) { this.position.x = w + margin; wrapped = true; }
    else if (this.position.x > w + margin) { this.position.x = -margin; wrapped = true; }
    if (this.position.y < -margin) { this.position.y = h + margin; wrapped = true; }
    else if (this.position.y > h + margin) { this.position.y = -margin; wrapped = true; }
    if (wrapped) {
      this.shrimp.resetSpine(this.position, this.velocity.heading());
    }
  }
}

// 混入通用物理方法（seek, applyForce, edgeCheck, wallBounce, collision等）
// ShrimpBoid已定义的方法不会被覆盖（如borderWrap）
applyBoidPhysics(ShrimpBoid);
