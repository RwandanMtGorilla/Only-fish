/**
 * Goldfish registration config
 * @module animals/goldfish/goldfish.config
 */

import { GoldfishBoid } from './GoldfishBoid.js';

export const goldfishConfig = {
  group: 'goldfish',
  label: 'Goldfish',
  defaultCount: 22,
  zIndex: 15,
  BoidClass: GoldfishBoid,

  scaleRange: { min: 0.05, max: 0.12 },

  sliders: {
    introversion: {
      label: 'Introversion',
      min: 0, max: 20, step: 1, defaultValue: 3,
      toParam: (v) => v / 10,
      toUI: (v) => Math.round(v * 10),
    },
    speed: {
      label: 'Speed',
      min: 0, max: 20, step: 1, defaultValue: 16,
      toParam: (v) => v / 10 + 0.5,
      toUI: (v) => Math.round((v - 0.5) * 10),
    },
    racism: {
      label: 'Racism',
      min: 0, max: 20, step: 1, defaultValue: 3,
      toParam: (v) => v / 5,
      toUI: (v) => Math.round(v * 5),
    },
    diversity: {
      label: 'Diversity',
      min: 1, max: 10, step: 1, defaultValue: 7,
      toParam: (v) => v,
      toUI: (v) => v,
    },
  },

  // 7 goldfish-typical color palettes (some with koi-style patches)
  palettes: [
    { body: [200, 50, 30],   fin: [230, 100, 60] },                                                                    // Classic red
    { body: [220, 130, 40],  fin: [240, 180, 90] },                                                                    // Orange
    { body: [230, 225, 210], fin: [245, 240, 230], patches: [[200, 50, 30]], patchDensity: 'normal' },                  // Kohaku (red-white koi)
    { body: [200, 60, 40],   fin: [235, 220, 210] },                                                                    // Red-white
    { body: [210, 170, 50],  fin: [235, 210, 100] },                                                                    // Gold
    { body: [40, 35, 35],    fin: [70, 60, 60] },      // Black (ink dragon)
    { body: [220, 140, 50],  fin: [240, 235, 220] },   // Orange-white
    { body: [230, 225, 210], fin: [245, 240, 230] },   // White
    { body: [230, 225, 210], fin: [240, 235, 220], patches: [[200, 50, 30], [40, 35, 35]], patchDensity: 'normal' },    // Taisho Sanke (white + red/black)
    { body: [40, 35, 35],    fin: [70, 60, 60],    patches: [[200, 50, 30], [230, 225, 210]], patchDensity: 'dense' },  // Showa (black + red/white)
  ],

  physics: {
    speedIndex: 3.6,
    maxForce: 0.35,
  },

  coefficients: {
    general: { mean: 50, stdev: 10 },
    quickness: { mean: 80, stdev: 8 },
  },

  /**
   * Apply slider value to a single boid instance
   * @param {GoldfishBoid} boid
   * @param {string} key - Slider key
   * @param {number} paramValue - Converted internal parameter value
   * @param {Object} groupState - Runtime state of this group
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
        boid.goldfish.bodyColor = color(palette.body[0], palette.body[1], palette.body[2]);
        boid.goldfish.finColor = color(palette.fin[0], palette.fin[1], palette.fin[2]);
        if (palette.patches) {
          boid.goldfish.patches = boid.goldfish._generatePatches(palette.patches, palette.patchDensity, boid.id);
          boid.goldfish.patchColors = palette.patches.map(c => color(c[0], c[1], c[2]));
        } else {
          boid.goldfish.patches = [];
          boid.goldfish.patchColors = [];
        }
        break;
      }
    }
  },
};
