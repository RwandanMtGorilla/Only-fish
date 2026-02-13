/**
 * Pond plant registration config (merged lilypad + lotus)
 * Single group for leaf-level elastic collision between lilypads and lotus centers
 * @module animals/pond_plant/pondPlant.config
 */

import { LilypadBoid } from '../lilypad/LilypadBoid.js';
import { LotusCenterBoid } from '../lotus/LotusCenterBoid.js';
import { PetalBoid } from '../lotus/PetalBoid.js';
import { gaussian } from '../../utils/gaussian.js';

// Petal layer definitions: inner to outer
const PETAL_LAYERS = [
  { count: 5, distance: 18, size: 0.83 },
  { count: 8, distance: 20, size: 0.92 },
  { count: 13, distance: 22, size: 1.0 },
];

// Lilypad palettes: body = leaf surface, fin = vein color
const LILYPAD_PALETTES = [
  { body: [60, 140, 60],  fin: [35, 100, 35] },
  { body: [50, 120, 55],  fin: [30, 85, 30] },
  { body: [75, 150, 65],  fin: [45, 110, 40] },
  { body: [55, 125, 70],  fin: [32, 90, 45] },
  { body: [80, 140, 50],  fin: [50, 100, 30] },
];

// Lotus palettes: body = seed pod, fin = stamen, petal/petalEdge = petal colors
const LOTUS_PALETTES = [
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
];

export const pondPlantConfig = {
  group: 'pond_plant',
  label: '水生植物',
  defaultCount: 3,    // lilypad count (lotus count is separate below)
  zIndex: 20,
  BoidClass: LilypadBoid,  // Nominal; customCreateBoids handles both types

  scaleRange: { min: 0.4, max: 0.95 },  // Lilypad scale range (lotus uses its own)

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

  palettes: LILYPAD_PALETTES,  // Nominal; customCreateBoids picks from separate palette arrays

  physics: {
    speedIndex: 0.05,
    maxForce: 0.02,
  },

  coefficients: {
    general: { mean: 50, stdev: 5 },
    quickness: { mean: 50, stdev: 5 },
  },

  /**
   * Combined creation: lilypads (cluster-spawned) + lotus (center + petals)
   * Push order ensures correct render layering:
   *   lilypad leaves (bottom) -> outer petals -> inner petals -> centers (top)
   */
  customCreateBoids(groupState) {
    const config = groupState.config;
    const getCoeff = gaussian(config.coefficients.general.mean, config.coefficients.general.stdev);
    const getQuickCoeff = gaussian(config.coefficients.quickness.mean, config.coefficients.quickness.stdev);
    const diversity = groupState.sliderValues.diversity;

    let boidId = 0;

    // --- Phase 1: Lilypad cluster spawn ---
    const lilypadCount = 3;
    const clusterCount = Math.max(2, Math.floor(lilypadCount / 4) + 1);
    const margin = 250;
    const clusterCenters = [];
    for (let c = 0; c < clusterCount; c++) {
      clusterCenters.push({
        x: random(margin, width - margin),
        y: random(margin, height - margin),
      });
    }

    let lilypadIdx = 0;
    for (let c = 0; c < clusterCount; c++) {
      const clusterSize = (c < clusterCount - 1)
        ? Math.floor(lilypadCount / clusterCount)
        : lilypadCount - lilypadIdx;

      const cx = clusterCenters[c].x;
      const cy = clusterCenters[c].y;
      const spread = 220 + random(0, 40);

      for (let i = 0; i < clusterSize; i++) {
        const angle = random(TWO_PI);
        const dist = abs(randomGaussian(spread * 0.4, spread * 0.8));
        const x = constrain(cx + cos(angle) * dist, 80, width - 80);
        const y = constrain(cy + sin(angle) * dist, 80, height - 80);

        const s = random(0.4, 0.95);
        const paletteIdx = lilypadIdx % diversity;
        const palette = LILYPAD_PALETTES[paletteIdx % LILYPAD_PALETTES.length];

        groupState.boids.push(new LilypadBoid({
          id: boidId++,
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
        lilypadIdx++;
      }
    }

    // --- Phase 2: Lotus (center + petals) ---
    const lotusCount = 2;
    const lotusScaleRange = { min: 0.3, max: 0.6 };

    for (let c = 0; c < lotusCount; c++) {
      const cx = random(margin, width - margin);
      const cy = random(margin, height - margin);
      const s = random(lotusScaleRange.min, lotusScaleRange.max);
      const paletteIdx = c % diversity;
      const palette = LOTUS_PALETTES[paletteIdx % LOTUS_PALETTES.length];

      // Create center boid (push after petals for render order)
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
        if (boid.isLilypad) {
          const palette = LILYPAD_PALETTES[paletteIdx % LILYPAD_PALETTES.length];
          boid.lilypad.bodyColor = color(palette.body[0], palette.body[1], palette.body[2]);
          boid.lilypad.veinColor = color(palette.fin[0], palette.fin[1], palette.fin[2]);
        } else if (boid.isCenter) {
          const palette = LOTUS_PALETTES[paletteIdx % LOTUS_PALETTES.length];
          boid.renderer.centerColor = color(palette.body[0], palette.body[1], palette.body[2]);
          boid.renderer.stamenColor = color(palette.fin[0], palette.fin[1], palette.fin[2]);
        } else if (boid.isPetal) {
          const palette = LOTUS_PALETTES[paletteIdx % LOTUS_PALETTES.length];
          boid.petal.petalColor = color(palette.petal[0], palette.petal[1], palette.petal[2]);
          boid.petal.petalEdgeColor = color(palette.petalEdge[0], palette.petalEdge[1], palette.petalEdge[2]);
        }
        break;
      }
    }
  },
};
