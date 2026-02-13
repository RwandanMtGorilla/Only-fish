/**
 * Lotus color palettes and petal layer definitions
 * body = seed pod, fin = stamen, petal/petalEdge = petal colors
 * @module animals/lotus/lotusPalettes
 */

export const LOTUS_PALETTES = [
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

// Petal layer definitions: inner to outer
export const PETAL_LAYERS = [
  { count: 5, distance: 18, size: 0.83 },
  { count: 8, distance: 20, size: 0.92 },
  { count: 13, distance: 22, size: 1.0 },
];
