/**
 * Lilypad registration config
 * Cluster-spawned, static floating, leaf-level same-group collision
 * @module animals/lilypad/lilypad.config
 */

import { LilypadBoid } from './LilypadBoid.js';
import { gaussian } from '../../utils/gaussian.js';

export const lilypadConfig = {
  group: 'lilypad',
  label: 'Lilypad',
  defaultCount: 3,
  zIndex: 20,
  BoidClass: LilypadBoid,

  scaleRange: { min: 0.6, max: 1.2 },

  sliders: {
    introversion: {
      label: 'Introversion',
      min: 0, max: 20, step: 1, defaultValue: 10,
      toParam: (v) => v / 10,
      toUI: (v) => Math.round(v * 10),
    },
    speed: {
      label: 'Speed',
      min: 0, max: 20, step: 1, defaultValue: 1,
      toParam: (v) => v / 10 + 0.5,
      toUI: (v) => Math.round((v - 0.5) * 10),
    },
    racism: {
      label: 'Racism',
      min: 0, max: 20, step: 1, defaultValue: 0,
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

  // Green palettes: body = leaf surface, fin = vein color
  palettes: [
    { body: [60, 140, 60],  fin: [35, 100, 35] },   // Fresh green
    { body: [50, 120, 55],  fin: [30, 85, 30] },    // Dark green
    { body: [75, 150, 65],  fin: [45, 110, 40] },   // Light green
    { body: [55, 125, 70],  fin: [32, 90, 45] },    // Teal green
    { body: [80, 140, 50],  fin: [50, 100, 30] },   // Yellow-green
  ],

  physics: {
    speedIndex: 0.05,
    maxForce: 0.02,
  },

  coefficients: {
    general: { mean: 50, stdev: 5 },
    quickness: { mean: 50, stdev: 5 },
  },

  /**
   * Cluster-based spawn: lilypads appear in 2-4 clusters instead of uniform random
   */
  customCreateBoids(groupState) {
    const config = groupState.config;
    const getCoeff = gaussian(config.coefficients.general.mean, config.coefficients.general.stdev);
    const getQuickCoeff = gaussian(config.coefficients.quickness.mean, config.coefficients.quickness.stdev);
    const diversity = groupState.sliderValues.diversity;

    const totalCount = config.defaultCount;
    const clusterCount = Math.max(2, Math.floor(totalCount / 4) + 1);

    // Generate cluster centers (away from edges)
    const margin = 250;
    const clusterCenters = [];
    for (let c = 0; c < clusterCount; c++) {
      clusterCenters.push({
        x: random(margin, width - margin),
        y: random(margin, height - margin),
      });
    }

    // Distribute lilypads across clusters
    let boidId = 0;
    for (let c = 0; c < clusterCount; c++) {
      const clusterSize = (c < clusterCount - 1)
        ? Math.floor(totalCount / clusterCount)
        : totalCount - boidId;

      const cx = clusterCenters[c].x;
      const cy = clusterCenters[c].y;
      const spread = 80 + random(0, 40);

      for (let i = 0; i < clusterSize; i++) {
        // Gaussian-distributed offset from cluster center
        const angle = random(TWO_PI);
        const dist = abs(randomGaussian(0, spread * 0.5));
        const x = constrain(cx + cos(angle) * dist, 80, width - 80);
        const y = constrain(cy + sin(angle) * dist, 80, height - 80);

        const s = random(config.scaleRange.min, config.scaleRange.max);
        const paletteIdx = boidId % diversity;
        const palette = config.palettes[paletteIdx % config.palettes.length];

        groupState.boids.push(new config.BoidClass({
          id: boidId,
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
          racism: groupState.sliderValues.racism,
          racismCoefficient: getCoeff() / 100,
          speedIndex: config.physics.speedIndex,
        }));
        boidId++;
      }
    }
  },

  applySliderValue(boid, key, paramValue, groupState) {
    switch (key) {
      case 'introversion':
        boid.introversion = paramValue * boid.introversionCoefficient;
        break;
      case 'speed':
        boid.quickness = paramValue * boid.quicknessCoefficient;
        // maxSpeed stays fixed for collision response; friction handles deceleration
        break;
      case 'racism':
        boid.racism = paramValue * boid.racismCoefficient;
        break;
      case 'diversity': {
        const paletteIdx = boid.id % paramValue;
        boid.colorId = paletteIdx;
        const palette = groupState.config.palettes[paletteIdx % groupState.config.palettes.length];
        boid.lilypad.bodyColor = color(palette.body[0], palette.body[1], palette.body[2]);
        boid.lilypad.veinColor = color(palette.fin[0], palette.fin[1], palette.fin[2]);
        break;
      }
    }
  },
};
