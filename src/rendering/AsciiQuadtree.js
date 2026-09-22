// Each existing character cell is one quadtree root. One subdivision gives
// 1x and 1/2x characters, with 2x2 filtered samples per smallest leaf.
export const ROOT_SAMPLES = 4;
const MIN_SAMPLES = ROOT_SAMPLES / 2;
const DETAIL_THRESHOLD = 48;

export function visitAsciiLeaves(pixels, stride, x, y, visit, size = ROOT_SAMPLES) {
  // Most of the pond is empty. Reject roots with a cheap alpha-only pass before
  // calculating color ranges, gradients, or allocating any leaf objects.
  if (size === ROOT_SAMPLES) {
    let occupied = false;
    for (let row = 0; row < size && !occupied; row++) {
      let i = ((y + row) * stride + x) * 4 + 3;
      const end = i + size * 4;
      for (; i < end; i += 4) {
        if (pixels[i] >= 21) { occupied = true; break; }
      }
    }
    if (!occupied) return;
  }
  let coverage = 0, r = 0, g = 0, b = 0, dx = 0, dy = 0;
  let minA = 255, maxA = 0;
  let minR = 255, maxR = 0, minG = 255, maxG = 0, minB = 255, maxB = 0;
  const half = size / 2;
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const i = ((y + row) * stride + x + col) * 4;
      const alpha = pixels[i + 3];
      minA = Math.min(minA, alpha);
      maxA = Math.max(maxA, alpha);
      if (alpha === 0) continue;
      const a = alpha / 255;
      const pr = pixels[i] * a, pg = pixels[i + 1] * a, pb = pixels[i + 2] * a;
      coverage += a;
      r += pr; g += pg; b += pb;
      dx += col < half ? -a : a;
      dy += row < half ? -a : a;
      // Premultiplied color variation catches markings as well as silhouettes.
      minR = Math.min(minR, pr); maxR = Math.max(maxR, pr);
      minG = Math.min(minG, pg); maxG = Math.max(maxG, pg);
      minB = Math.min(minB, pb); maxB = Math.max(maxB, pb);
    }
  }
  // Use maximum alpha here: a thin antenna must survive a mostly empty root.
  if (maxA < 21) return;
  const detail = Math.max(maxA - minA, maxR - minR, maxG - minG, maxB - minB);
  if (size > MIN_SAMPLES && detail > DETAIL_THRESHOLD) {
    visitAsciiLeaves(pixels, stride, x, y, visit, half);
    visitAsciiLeaves(pixels, stride, x + half, y, visit, half);
    visitAsciiLeaves(pixels, stride, x, y + half, visit, half);
    visitAsciiLeaves(pixels, stride, x + half, y + half, visit, half);
    return;
  }
  const area = size * size;
  const alpha = coverage / area;
  if (alpha < 0.08) return;
  visit({ x, y, size, alpha, r: r / coverage, g: g / coverage, b: b / coverage,
    dx: size > 1 ? dx * 2 / area : 0, dy: size > 1 ? dy * 2 / area : 0 });
}
