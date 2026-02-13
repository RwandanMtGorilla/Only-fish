/**
 * Shared defaults for all pond plant configs
 * (sliders, physics, coefficients, common slider handler)
 * @module animals/pond_plant/plantDefaults
 */

export const PLANT_SLIDERS = {
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
};

export const PLANT_PHYSICS = {
  speedIndex: 0.05,
  maxForce: 0.02,
};

export const PLANT_COEFFICIENTS = {
  general: { mean: 50, stdev: 5 },
  quickness: { mean: 50, stdev: 5 },
};

/**
 * Handle introversion/speed/racism slider changes (identical for all plant boid types).
 * @returns {boolean} true if key was handled, false if caller should handle (diversity)
 */
export function applyCommonPlantSlider(boid, key, paramValue) {
  switch (key) {
    case 'introversion':
      boid.introversion = paramValue * boid.introversionCoefficient;
      return true;
    case 'speed':
      boid.quickness = paramValue * boid.quicknessCoefficient;
      return true;
    case 'racism':
      boid.racism = paramValue * boid.racismCoefficient;
      return true;
    default:
      return false;
  }
}
