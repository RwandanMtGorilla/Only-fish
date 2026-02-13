/**
 * Lotus registration config
 * Dual-type boids: LotusCenterBoid (seed pod) + PetalBoid (detachable petals)
 * @module animals/lotus/lotus.config
 */

import { LotusCenterBoid } from './LotusCenterBoid.js';
import { PetalBoid } from './PetalBoid.js';
import { gaussian } from '../../utils/gaussian.js';

// Petal layer definitions: inner to outer
const PETAL_LAYERS = [
  { count: 5, distance: 25, size: 0.7 },   // Inner: 5 petals, base at pod edge
  { count: 7, distance: 38, size: 0.85 },   // Mid: 7 petals, tight wrap
  { count: 9, distance: 50, size: 1.0 },    // Outer: 9 petals
];

export const lotusConfig = {
  group: 'lotus',
  label: 'Lotus',
  defaultCount: 2,
  zIndex: 21,   // Above lilypad (20)
  BoidClass: LotusCenterBoid,

  scaleRange: { min: 0.5, max: 0.8 },

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

  // Palettes: body = seed pod, fin = stamen, petal/petalEdge = petal colors
  palettes: [
    {
      body: [180, 200, 120], fin: [220, 200, 80],
      petal: [255, 182, 193], petalEdge: [230, 140, 160],
    },
    {
      body: [190, 210, 130], fin: [230, 210, 90],
      petal: [255, 240, 245], petalEdge: [240, 200, 210],
    },
    {
      body: [170, 190, 110], fin: [210, 190, 70],
      petal: [255, 200, 210], petalEdge: [220, 150, 170],
    },
    {
      body: [185, 205, 125], fin: [225, 205, 85],
      petal: [255, 220, 230], petalEdge: [235, 180, 195],
    },
    {
      body: [175, 195, 115], fin: [215, 195, 75],
      petal: [255, 250, 250], petalEdge: [240, 230, 230],
    },
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
   * Custom creation: each lotus = 1 center + 21 petals (3 layers)
   * Push order: outer petals first (render bottom), center last (render top)
   */
  customCreateBoids(groupState) {
    const config = groupState.config;
    const getCoeff = gaussian(config.coefficients.general.mean, config.coefficients.general.stdev);
    const getQuickCoeff = gaussian(config.coefficients.quickness.mean, config.coefficients.quickness.stdev);
    const diversity = groupState.sliderValues.diversity;

    const margin = 250;
    let boidId = 0;

    for (let c = 0; c < config.defaultCount; c++) {
      const cx = random(margin, width - margin);
      const cy = random(margin, height - margin);
      const s = random(config.scaleRange.min, config.scaleRange.max);
      const paletteIdx = c % diversity;
      const palette = config.palettes[paletteIdx % config.palettes.length];

      // Create center boid (don't push yet — push after petals for render order)
      const centerBoid = new LotusCenterBoid({
        id: boidId++,
        group: config.group,
        x: cx,
        y: cy,
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
      });

      // Create petals: outer layer first (renders at bottom), inner last (renders on top)
      for (let layerIdx = PETAL_LAYERS.length - 1; layerIdx >= 0; layerIdx--) {
        const layer = PETAL_LAYERS[layerIdx];
        // Stagger angle between layers for natural overlap
        const layerAngleShift = layerIdx * (PI / layer.count);

        for (let p = 0; p < layer.count; p++) {
          const angleOffset = (TWO_PI / layer.count) * p + layerAngleShift + random(-0.1, 0.1);
          const dist = layer.distance * s;

          const petalBoid = new PetalBoid({
            id: boidId++,
            group: config.group,
            x: cx + cos(angleOffset) * dist,
            y: cy + sin(angleOffset) * dist,
            scale: s * layer.size,
            parentCenter: centerBoid,
            angleOffset,
            distanceFromCenter: dist,
            layerIndex: layerIdx,
            bodyColor: color(palette.petal[0], palette.petal[1], palette.petal[2]),
            finColor: color(palette.petalEdge[0], palette.petalEdge[1], palette.petalEdge[2]),
            colorId: paletteIdx,
            introversion: groupState.sliderValues.introversion,
            introversionCoefficient: getCoeff() / 100,
            quickness: groupState.sliderValues.speed,
            quicknessCoefficient: getQuickCoeff() / 100,
            racism: groupState.sliderValues.racism,
            racismCoefficient: getCoeff() / 100,
            speedIndex: config.physics.speedIndex,
          });

          centerBoid.petals.push(petalBoid);
          groupState.boids.push(petalBoid);
        }
      }

      // Push center last (renders on top of all petals)
      groupState.boids.push(centerBoid);
    }
  },

  applySliderValue(boid, key, paramValue, groupState) {
    switch (key) {
      case 'introversion':
        boid.introversion = paramValue * boid.introversionCoefficient;
        break;
      case 'speed':
        boid.quickness = paramValue * boid.quicknessCoefficient;
        break;
      case 'racism':
        boid.racism = paramValue * boid.racismCoefficient;
        break;
      case 'diversity': {
        const paletteIdx = boid.id % paramValue;
        boid.colorId = paletteIdx;
        const palette = groupState.config.palettes[paletteIdx % groupState.config.palettes.length];
        if (boid.isCenter) {
          boid.renderer.centerColor = color(palette.body[0], palette.body[1], palette.body[2]);
          boid.renderer.stamenColor = color(palette.fin[0], palette.fin[1], palette.fin[2]);
        } else if (boid.isPetal) {
          boid.petal.petalColor = color(palette.petal[0], palette.petal[1], palette.petal[2]);
          boid.petal.petalEdgeColor = color(palette.petalEdge[0], palette.petalEdge[1], palette.petalEdge[2]);
        }
        break;
      }
    }
  },
};
