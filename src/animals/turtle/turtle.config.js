/**
 * 乌龟动物的注册配置
 * @module animals/turtle/turtle.config
 */

import { TurtleBoid } from './TurtleBoid.js';

export const turtleConfig = {
  // 组标识符
  group: 'turtle',

  // 下拉框中显示的名称
  label: 'Turtle',

  // 默认生成数量 (乌龟数量少些)
  defaultCount: 3,

  // 绘制层级 (越小越先绘制, 在底层)
  zIndex: 0,

  // Boid 行为类
  BoidClass: TurtleBoid,

  // 缩放范围 (乌龟比鱼大得多)
  scaleRange: { min: 0.08, max: 0.15 },

  // 4个滑块的配置
  sliders: {
    introversion: {
      label: 'Introversion',
      min: 0, max: 20, step: 1, defaultValue: 14,
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
      min: 0, max: 20, step: 1, defaultValue: 5,
      toParam: (v) => v / 5,
      toUI: (v) => Math.round(v * 5),
    },
    diversity: {
      label: 'Diversity',
      min: 1, max: 5, step: 1, defaultValue: 3,
      toParam: (v) => v,
      toUI: (v) => v,
    },
  },

  // 颜色调色板: body = 皮肤色, fin = 壳色 (复用 AnimalRegistry 字段名)
  palettes: [
    { body: [107, 142, 86],  fin: [101, 83, 56] },    // 橄榄绿 + 棕壳
    { body: [86, 130, 107],  fin: [83, 70, 56] },     // 青绿 + 深棕壳
    { body: [120, 142, 86],  fin: [110, 90, 60] },    // 黄绿 + 浅棕壳
    { body: [86, 107, 86],   fin: [85, 75, 50] },     // 暗绿 + 暗棕壳
    { body: [107, 120, 86],  fin: [95, 80, 55] },     // 灰绿 + 中棕壳
  ],

  // 物理参数 (乌龟速度约为鱼的 37%)
  physics: {
    speedIndex: 1.8,
    maxForce: 0.15,
  },

  // 高斯系数生成器配置
  coefficients: {
    general: { mean: 50, stdev: 9 },
    quickness: { mean: 75, stdev: 7.5 },
  },

  /**
   * 滑块值变更时应用到单个 boid 实例
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
        boid.turtle.bodyColor = color(palette.body[0], palette.body[1], palette.body[2]);
        boid.turtle.shellColor = color(palette.fin[0], palette.fin[1], palette.fin[2]);
        boid.turtle.shellPatternColor = color(
          palette.fin[0] * 0.7,
          palette.fin[1] * 0.7,
          palette.fin[2] * 0.7
        );
        break;
      }
    }
  },
};
