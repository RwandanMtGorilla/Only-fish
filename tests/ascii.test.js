import test from 'node:test';
import assert from 'node:assert/strict';
import { selectGlyph } from '../src/rendering/AsciiRenderer.js';
import { ROOT_SAMPLES, visitAsciiLeaves } from '../src/rendering/AsciiQuadtree.js';

function leavesFor(colorAt) {
  const pixels = new Uint8ClampedArray(ROOT_SAMPLES ** 2 * 4);
  for (let y = 0; y < ROOT_SAMPLES; y++) {
    for (let x = 0; x < ROOT_SAMPLES; x++) {
      pixels.set(colorAt(x, y), (y * ROOT_SAMPLES + x) * 4);
    }
  }
  const leaves = [];
  visitAsciiLeaves(pixels, ROOT_SAMPLES, 0, 0, leaf => leaves.push(leaf));
  return leaves;
}

test('quadtree skips water and keeps uniform bodies at the original maximum size', () => {
  assert.deepEqual(leavesFor(() => [255, 255, 255, 0]), []);
  const leaves = leavesFor(() => [30, 100, 180, 255]);
  assert.equal(leaves.length, 1);
  assert.equal(leaves[0].size, ROOT_SAMPLES);
  assert.equal(leaves[0].r, 30);
  assert.equal(leaves[0].alpha, 1);
});

test('four uniform color quadrants use half-sized characters without further subdivision', () => {
  const leaves = leavesFor((x, y) => [x < ROOT_SAMPLES / 2 ? 40 : 200, y < ROOT_SAMPLES / 2 ? 40 : 200, 80, 255]);
  assert.equal(leaves.length, 4);
  assert.ok(leaves.every(leaf => leaf.size === ROOT_SAMPLES / 2));
});

test('fine markings stop at half size and cover the root without overlaps', () => {
  const leaves = leavesFor((x, y) => (x + y) % 2 ? [230, 30, 30, 255] : [30, 180, 180, 255]);
  assert.equal(leaves.length, 4);
  const covered = new Set();
  for (const leaf of leaves) {
    assert.equal(leaf.size, ROOT_SAMPLES / 2);
    for (let y = leaf.y; y < leaf.y + leaf.size; y++) {
      for (let x = leaf.x; x < leaf.x + leaf.size; x++) {
        const key = `${x},${y}`;
        assert.ok(!covered.has(key));
        covered.add(key);
      }
    }
  }
  assert.equal(covered.size, ROOT_SAMPLES ** 2);
});

test('a single thin detail survives even when its root average is nearly transparent', () => {
  const leaves = leavesFor((x, y) => x === ROOT_SAMPLES - 1 && y === 0 ? [255, 200, 100, 255] : [0, 0, 0, 0]);
  assert.equal(leaves.length, 1);
  assert.deepEqual([leaves[0].x, leaves[0].y, leaves[0].size], [2, 0, 2]);
  assert.equal(leaves[0].alpha, 0.25);
  assert.equal(leaves[0].dx, 0.5);
  assert.equal(leaves[0].dy, -0.5);
});

test('sampling respects the image stride and root offset', () => {
  const pixels = new Uint8ClampedArray(16 * 16 * 4);
  for (let y = 8; y < 16; y++) {
    for (let x = 8; x < 16; x++) pixels.set([90, 130, 180, 255], (y * 16 + x) * 4);
  }
  const leaves = [];
  visitAsciiLeaves(pixels, 16, 8, 8, leaf => leaves.push(leaf));
  assert.equal(leaves.length, 1);
  assert.deepEqual([leaves[0].x, leaves[0].y, leaves[0].size, leaves[0].r], [8, 8, ROOT_SAMPLES, 90]);
});

test('empty water stays blank; thin silhouettes retain directional ASCII edges', () => {
  assert.equal(selectGlyph(0, 1, 0, 0), ' ');
  assert.equal(selectGlyph(0.5, 0.5, 1, 0), '|');
  assert.equal(selectGlyph(0.5, 0.5, 0, 1), '-');
  assert.equal(selectGlyph(0.5, 0.5, 0.5, 0.5), '/');
  assert.equal(selectGlyph(0.5, 0.5, 0.5, -0.5), '\\');
});

test('brightness increases glyph density, with stable mapping and ASCII-only output', () => {
  const ramp = '.,:;=+*#%@';
  let previous = -1;
  for (let i = 0; i <= 100; i++) {
    const glyph = selectGlyph(1, i / 100, 0, 0);
    const density = ramp.indexOf(glyph);
    assert.ok(density >= previous);
    assert.equal(selectGlyph(1, i / 100, 0, 0), glyph);
    assert.ok(glyph.charCodeAt(0) < 128);
    previous = density;
  }
});
