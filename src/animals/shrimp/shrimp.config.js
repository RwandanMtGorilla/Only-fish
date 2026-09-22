/**
 * 虾类动物的注册配置（最大尺寸进一步缩小）
 * 基于fish.config适配虾的特征：更小的尺寸、粉色系调色板、更慢的速度
 * @module animals/shrimp/shrimp.config
 */

import { ShrimpBoid } from './ShrimpBoid.js';

export const shrimpConfig = {
  group: 'shrimp',
  label: 'Shrimp',
  defaultCount: 8,
  zIndex: 10,
  BoidClass: ShrimpBoid,

  // ✨ 核心修改：最大尺寸从0.12 → 0.08，最大虾米变得更小
  // 范围说明：min=0.03（最小虾米），max=0.08（最大虾米），随机值在这个区间内
  scaleRange: { min: 0.03, max: 0.08 },

  sliders: {
    introversion: {
      label: 'Introversion',
      min: 0, max: 20, step: 1, defaultValue: 12,
      toParam: (v) => v / 10,
      toUI: (v) => Math.round(v * 10),
    },
    speed: {
      label: 'Speed',
      min: 0, max: 20, step: 1, defaultValue: 4,
      toParam: (v) => v / 10 + 0.5,
      toUI: (v) => Math.round((v - 0.5) * 10),
    },
    colorSeparation: {
      label: 'Color Separation',
      min: 0, max: 20, step: 1, defaultValue: 11,
      toParam: (v) => v / 5,
      toUI: (v) => Math.round(v * 5),
    },
    diversity: {
      label: 'Diversity',
      min: 1, max: 8, step: 1, defaultValue: 3,
      toParam: (v) => v,
      toUI: (v) => v,
    },
  },

  palettes: [
    { body: [240, 128, 128], fin: [220, 100, 100] },
    { body: [230, 90, 90],   fin: [210, 70, 70] },
    { body: [255, 182, 193], fin: [255, 192, 203] },
  ],

  physics: {
    speedIndex: 1.75, // Includes the original 0.7 shrimp speed factor
    maxForce: 0.2,
    reactionDelayMs: 250,
  },

  coefficients: {
    general: { mean: 50, stdev: 9 },
    quickness: { mean: 75, stdev: 7.5 },
  },

  applySliderValue(boid, key, paramValue, groupState) {
    switch (key) {
      case 'introversion':
        boid.introversion = paramValue * boid.introversionCoefficient;
        break;
      case 'speed':
        boid.quickness = paramValue * boid.quicknessCoefficient;
        boid.maxSpeed = groupState.config.physics.speedIndex * boid.quickness;
        break;
      case 'colorSeparation':
        boid.colorSeparation = paramValue * boid.colorSeparationCoefficient;
        break;
      case 'diversity': {
        const paletteIdx = boid.id % paramValue;
        boid.colorId = paletteIdx;
        const palette = groupState.config.palettes[paletteIdx % groupState.config.palettes.length];
        boid.shrimp.bodyColor = color(palette.body[0], palette.body[1], palette.body[2]);
        boid.shrimp.finColor = color(palette.fin[0], palette.fin[1], palette.fin[2]);
        break;
      }
    }
  },
};
