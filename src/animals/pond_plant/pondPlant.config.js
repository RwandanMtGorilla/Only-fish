/**
 * Pond plant registration config (merged lilypad + lotus)
 * Single group for leaf-level elastic collision between lilypads and lotus centers
 * @module animals/pond_plant/pondPlant.config
 */

import { LilypadBoid } from '../lilypad/LilypadBoid.js';
import { LotusCenterBoid } from '../lotus/LotusCenterBoid.js';
import { PetalBoid } from '../lotus/PetalBoid.js';
import { gaussian } from '../../utils/gaussian.js';
import { LILYPAD_PALETTES } from '../lilypad/lilypadPalettes.js';
import { LOTUS_PALETTES, PETAL_LAYERS } from '../lotus/lotusPalettes.js';
import { PLANT_SLIDERS, PLANT_PHYSICS, PLANT_COEFFICIENTS, applyCommonPlantSlider } from './plantDefaults.js';

export const pondPlantConfig = {
  group: 'pond_plant',
  label: '水生植物',
  lilypadDefaultCount: 3,    // lilypad count
  lotusDefaultCount: 2,
  zIndex: 20,
  BoidClass: LilypadBoid,  // Nominal; customCreateBoids handles both types

  scaleRange: { min: 0.4, max: 0.95 },       // Lilypad scale range
  lotusScaleRange: { min: 0.3, max: 0.6 },

  sliders: PLANT_SLIDERS,
  palettes: LILYPAD_PALETTES,  // Nominal; customCreateBoids picks from separate palette arrays
  physics: PLANT_PHYSICS,
  coefficients: PLANT_COEFFICIENTS,

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
    const lilypadCount = config.lilypadDefaultCount;
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

        const s = random(config.scaleRange.min, config.scaleRange.max);
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
    const lotusCount = config.lotusDefaultCount;
    const lotusScaleRange = config.lotusScaleRange;

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
    if (applyCommonPlantSlider(boid, key, paramValue)) return;

    if (key === 'diversity') {
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
    }
  },
};
