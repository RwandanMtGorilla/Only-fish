/**
 * 动物注册中心 - 管理所有动物组的创建, 更新, 渲染
 * @module registry/AnimalRegistry
 */

import { gaussian } from '../utils/gaussian.js';

export class AnimalRegistry {
  constructor() {
    // 已注册的配置 Map<string, config>
    this.configs = new Map();
    // 各组的运行时状态 Map<string, GroupState>
    this.groups = new Map();
    // 所有组的 boid 扁平列表 (用于跨组 separation)
    this._allBoids = [];
    // 全局设置引用
    this.settings = null;
  }

  /**
   * 注册一种动物
   * @param {Object} config - 动物注册配置
   */
  register(config) {
    this.configs.set(config.group, config);
  }

  /**
   * 初始化所有已注册动物组, 创建 boid 实例
   * 在 p5 setup() 中调用
   * @param {Object} settings - 全局 settings 引用
   */
  init(settings) {
    this.settings = settings;
    for (const [group, config] of this.configs) {
      const groupState = {
        config,
        boids: [],
        sliderValues: {},
      };
      // 初始化滑块值 (将 UI 默认值转为内部参数值)
      for (const [key, slider] of Object.entries(config.sliders)) {
        groupState.sliderValues[key] = slider.toParam(slider.defaultValue);
      }
      // 创建 boid 实例
      this._createBoids(groupState);
      this.groups.set(group, groupState);
    }
    this._rebuildAllBoids();
    this._buildRenderOrder();
  }

  /**
   * 获取所有已注册的组名列表 (供 UI 下拉框使用)
   * @returns {Array<{group: string, label: string}>}
   */
  getGroupList() {
    const list = [];
    for (const [, config] of this.configs) {
      list.push({ group: config.group, label: config.label });
    }
    return list;
  }

  /**
   * 获取某组的当前滑块 UI 值 (用于下拉框切换时回显)
   * @param {string} group - 组名
   * @returns {Object} { introversion: uiValue, speed: uiValue, ... }
   */
  getSliderUIValues(group) {
    const gs = this.groups.get(group);
    if (!gs) return {};
    const result = {};
    for (const [key, slider] of Object.entries(gs.config.sliders)) {
      result[key] = slider.toUI(gs.sliderValues[key]);
    }
    return result;
  }

  /**
   * 获取某组的滑块 min/max/step 配置 (用于下拉框切换时同步 DOM 属性)
   * @param {string} group - 组名
   * @returns {Object} { introversion: {min, max, step}, ... }
   */
  getSliderConfigs(group) {
    const gs = this.groups.get(group);
    if (!gs) return {};
    const result = {};
    for (const [key, slider] of Object.entries(gs.config.sliders)) {
      result[key] = { min: slider.min, max: slider.max, step: slider.step, label: slider.label };
    }
    return result;
  }

  /**
   * 设置某组的滑块值, 立即影响该组所有现有实例
   * @param {string} group - 组名
   * @param {string} sliderKey - 滑块键名
   * @param {number} uiValue - UI 原始值
   */
  setSliderValue(group, sliderKey, uiValue) {
    const gs = this.groups.get(group);
    if (!gs) return;
    const slider = gs.config.sliders[sliderKey];
    if (!slider) return;
    const paramValue = slider.toParam(uiValue);
    gs.sliderValues[sliderKey] = paramValue;
    // 应用到该组所有 boid
    for (const boid of gs.boids) {
      gs.config.applySliderValue(boid, sliderKey, paramValue, gs);
    }
  }

  /**
   * 每帧更新: 组内完整 flock + 跨组 separation + 物理
   * @param {Object|null} grabbedBoid - 当前被抓住的 boid
   */
  update(grabbedBoid, updateTime = millis()) {
    // Stable traversal keeps sequential collision resolution reproducible.
    const groups = [...this.groups.entries()].sort(([a], [b]) => a.localeCompare(b));
    const ordered = groups.map(([group, gs]) => ({
      group, boids: [...gs.boids].filter(b => !b.isDead).sort((a, b) => a.id - b.id),
    }));
    const all = ordered.flatMap(gs => gs.boids);
    for (const boid of all) {
      boid.simulationTime = updateTime;
      boid.recordVelocitySample?.(updateTime);
      boid.pendingImpulse = createVector(0, 0);
    }
    const nextVelocities = new Map();
    // Hold positions fixed and restore velocities until every steering pass finishes.
    for (const { group, boids } of ordered) {
      for (const boid of boids) {
        if (boid === grabbedBoid) continue;
        const previous = boid.velocity.copy();
        boid.flock(boids, this.settings, updateTime);
        if (ordered.length > 1) boid.separateFromOthers(all, group);
        nextVelocities.set(boid, boid.velocity.copy());
        boid.velocity.set(previous);
      }
    }
    for (const [boid, velocity] of nextVelocities) {
      boid.velocity.set(velocity).add(boid.pendingImpulse);
    }
    for (const { boids } of ordered) {
      for (const boid of boids) {
        if (boid !== grabbedBoid) boid.physicsUpdate(boids, this.settings);
      }
    }
    this._purgeDeadBoids();
  }

  /**
   * 每帧渲染所有组的 boid (按 zIndex 从小到大, 小的在底层)
   */
  render() {
    const entries = [];
    for (const gs of this._renderOrder) {
      for (const boid of gs.boids) {
        if (!boid.isDead) entries.push({ boid, z: gs.config.getZIndex?.(boid) ?? gs.config.zIndex ?? 0 });
      }
    }
    entries.sort((a, b) => a.z - b.z);
    for (const { boid } of entries) boid.display();
  }

  /**
   * 调试渲染: 显示碰撞半径 (红) 和抓取判定半径 (绿)
   */
  renderDebugRadii() {
    push();
    noFill();
    strokeWeight(1);
    for (const boid of this._allBoids) {
      // 物理碰撞半径
      stroke(255, 100, 100, 80);
      const collCenter = boid.collisionCenter || boid.position;
      ellipse(collCenter.x, collCenter.y, boid.radius * 2);

      // 抓取判定半径
      stroke(100, 255, 100, 80);
      const center = boid.hitCenter || boid.position;
      const hitR = (boid.hitRadius || boid.radius) * 1.2;
      ellipse(center.x, center.y, hitR * 2);
    }
    pop();
  }

  attractFoods(foods, grabbedBoid) {
    for (let i = 0; i < foods.length; i++) {
      foods[i].attract(this._allBoids, grabbedBoid);
    }
  }

  /**
   * 所有组共享的食物碰撞检测
   * @param {Array} foods - 食物列表
   * @param {Object|null} grabbedBoid - 被抓住的 boid (跳过)
   */
  checkFoodCollisions(foods, grabbedBoid, now = millis()) {
    for (const boid of this._allBoids) {
      if (boid === grabbedBoid) continue;
      if (boid.eatCooldown == null) continue; // 该动物不参与进食
      for (let j = foods.length - 1; j >= 0; j--) {
        const boidCenter = boid.collisionCenter || boid.position;
        const dist = p5.Vector.dist(boidCenter, foods[j].position);
        if (dist < boid.radius * 0.5 + foods[j].radius) {
          if (now - boid.lastEatTime < boid.eatCooldown) break;
          if (!foods[j].tryConsume(now)) continue;
          boid.lastEatTime = now;
          if (foods[j].isDepleted()) {
            foods.splice(j, 1);
          }
          break;
        }
      }
    }
  }

  /**
   * 鼠标命中测试, 遍历所有组
   * @param {number} mx
   * @param {number} my
   * @returns {Object|null} 命中的 boid
   */
  hitTest(mx, my) {
    const mouseVec = createVector(mx, my);
    let closestBoid = null;
    let closestDist = Infinity;
    for (const boid of this._allBoids) {
      if (boid.isDead) continue;
      const center = boid.hitCenter || boid.position;
      const d = p5.Vector.dist(mouseVec, center);
      const hitR = (boid.hitRadius || boid.radius) * 1.2;
      if (d < hitR && d < closestDist) {
        closestDist = d;
        closestBoid = boid;
      }
    }
    return closestBoid;
  }

  // === 私有方法 ===

  /**
   * 根据配置创建某组的所有 boid 实例
   * @param {Object} groupState
   */
  _createBoids(groupState) {
    const { config } = groupState;

    // 如果配置提供了自定义创建逻辑，优先使用
    if (typeof config.customCreateBoids === 'function') {
      config.customCreateBoids(groupState);
      return;
    }

    const getCoeff = gaussian(config.coefficients.general.mean, config.coefficients.general.stdev);
    const getQuickCoeff = gaussian(config.coefficients.quickness.mean, config.coefficients.quickness.stdev);
    const diversity = groupState.sliderValues.diversity;

    for (let i = 0; i < config.defaultCount; i++) {
      const x = random(100, width - 100);
      const y = random(100, height - 100);
      const s = random(config.scaleRange.min, config.scaleRange.max);
      const paletteIdx = i % diversity;
      const palette = config.palettes[paletteIdx % config.palettes.length];

      const patchConfig = palette.patches ? {
        colors: palette.patches,
        density: palette.patchDensity || 'normal',
        seed: i,
      } : null;

      groupState.boids.push(new config.BoidClass({
        id: i,
        group: config.group,
        x,
        y,
        scale: s,
        bodyColor: color(palette.body[0], palette.body[1], palette.body[2]),
        finColor: color(palette.fin[0], palette.fin[1], palette.fin[2]),
        colorId: paletteIdx,
        introversion: groupState.sliderValues.introversion,
        introversionCoefficient: getCoeff() / 100,
        quickness: groupState.sliderValues.speed,
        quicknessCoefficient: getQuickCoeff() / 100,
        colorSeparation: groupState.sliderValues.colorSeparation,
        colorSeparationCoefficient: getCoeff() / 100,
        ...config.physics,
        reactionDelayMs: config.physics.reactionDelayMs,
        patchConfig,
      }));
    }
  }

  /**
   * 按 zIndex 排序构建渲染顺序 (init 时调用一次)
   */
  _buildRenderOrder() {
    this._renderOrder = [...this.groups.values()].sort(
      (a, b) => (a.config.zIndex ?? 0) - (b.config.zIndex ?? 0)
    );
  }

  /**
   * 重建所有组的 boid 扁平列表
   */
  _rebuildAllBoids() {
    this._allBoids = [];
    for (const [, gs] of this.groups) {
      this._allBoids.push(...gs.boids);
    }
  }

  /**
   * 从各组中移除 isDead 的 boid, 并重建扁平列表
   */
  _purgeDeadBoids() {
    let needsRebuild = false;
    for (const [, gs] of this.groups) {
      const before = gs.boids.length;
      gs.boids = gs.boids.filter(b => !b.isDead);
      if (gs.boids.length < before) needsRebuild = true;
    }
    if (needsRebuild) this._rebuildAllBoids();
  }
}
