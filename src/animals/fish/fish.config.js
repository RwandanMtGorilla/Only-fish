/**
 * 鱼类动物的注册配置
 * @module animals/fish/fish.config
 */

import { FishBoid } from './FishBoid.js';

export const fishConfig = {
  // 组标识符, 用于跨组识别
  group: 'fish',

  // 下拉框中显示的名称
  label: 'Fish',

  // 默认生成数量
  defaultCount: 5,

  // 绘制层级 (越小越先绘制, 在底层)
  zIndex: 10,

  // Boid 行为类
  BoidClass: FishBoid,

  // 缩放范围
  scaleRange: { min: 0.08, max: 0.18 },

  // 4个滑块的配置: UI范围 + 默认值 + 值转换
  sliders: {
    introversion: {
      label: 'Introversion',
      min: 0, max: 20, step: 1, defaultValue: 10,
      toParam: (v) => v / 10,
      toUI: (v) => Math.round(v * 10),
    },
    speed: {
      label: 'Speed',
      min: 0, max: 20, step: 1, defaultValue: 6,
      toParam: (v) => v / 10 + 0.5,
      toUI: (v) => Math.round((v - 0.5) * 10),
    },
    racism: {
      label: 'Racism',
      min: 0, max: 20, step: 1, defaultValue: 10,
      toParam: (v) => v / 5,
      toUI: (v) => Math.round(v * 5),
    },
    diversity: {
      label: 'Diversity',
      min: 1, max: 8, step: 1, defaultValue: 2,
      toParam: (v) => v,
      toUI: (v) => v,
    },
  },

  // 颜色调色板 (鲫鱼配色)
  palettes: [
    { body: [118, 118, 108], fin: [145, 140, 125] },  // 银灰鲫鱼
    { body: [100, 108, 85],  fin: [135, 132, 100] },  // 青灰鲫鱼
    { body: [148, 128, 90],  fin: [170, 145, 105] },  // 黄褐鲫鱼
  ],

  // 物理参数
  physics: {
    speedIndex: 3.1,
    maxForce: 0.3,
  },

  // 高斯系数生成器配置
  coefficients: {
    general: { mean: 50, stdev: 9 },
    quickness: { mean: 75, stdev: 7.5 },
  },

  /**
   * 滑块值变更时应用到单个 boid 实例
   * @param {FishBoid} boid
   * @param {string} key - 滑块键名
   * @param {number} paramValue - 转换后的内部参数值
   * @param {Object} groupState - 该组的运行时状态
   */
  applySliderValue(boid, key, paramValue, groupState) {
    switch (key) {
      case 'introversion':
        boid.introversion = paramValue * boid.introversionCoefficient;
        break;
      case 'speed':
        boid.quickness = paramValue * boid.quicknessCoefficient;
        boid.maxSpeed = groupState.config.physics.speedIndex * boid.quickness;
        break;
      case 'racism':
        boid.racism = paramValue * boid.racismCoefficient;
        break;
      case 'diversity': {
        const paletteIdx = boid.id % paramValue;
        boid.colorId = paletteIdx;
        const palette = groupState.config.palettes[paletteIdx % groupState.config.palettes.length];
        boid.fish.bodyColor = color(palette.body[0], palette.body[1], palette.body[2]);
        boid.fish.finColor = color(palette.fin[0], palette.fin[1], palette.fin[2]);
        break;
      }
    }
  },
};
