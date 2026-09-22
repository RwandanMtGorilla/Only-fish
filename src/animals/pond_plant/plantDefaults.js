/** Shared pond plant controls and physics. Plants do not flock or seek food. */
export const PLANT_SLIDERS = {
  diversity: {
    label: 'Diversity',
    min: 1, max: 5, step: 1, defaultValue: 3,
    toParam: v => v,
    toUI: v => v,
  },
};

export const PLANT_PHYSICS = {
  maxForce: 0.15,
  maxSpeed: 1.5,
  detachedMaxSpeed: 2.0,
  detachedMaxForce: 0.2,
};
