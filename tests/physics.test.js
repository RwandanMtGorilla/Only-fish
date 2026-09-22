import './helpers/p5.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { FixedStepClock } from '../src/core/FixedStepClock.js';
import { AnimalRegistry } from '../src/registry/AnimalRegistry.js';
import { fishConfig } from '../src/animals/fish/fish.config.js';
import { shrimpConfig } from '../src/animals/shrimp/shrimp.config.js';
import { turtleConfig } from '../src/animals/turtle/turtle.config.js';
import { goldfishConfig } from '../src/animals/goldfish/goldfish.config.js';
import { pondPlantConfig } from '../src/animals/pond_plant/pondPlant.config.js';

function registry(configs = [fishConfig, shrimpConfig]) {
  let seed = 12345;
  const originalRandom = Math.random;
  Math.random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
  const r = new AnimalRegistry();
  for (const c of configs) r.register(c);
  try {
    r.init({ walls: false, collisions: false, foods: [], center: createVector(600, 400), canvasW: 1200, canvasH: 800 });
  } finally { Math.random = originalRandom; }
  // Spread the deterministic initial state to exercise neighbor interactions.
  r._allBoids.forEach((b, i) => { b.position.set(300 + i * 9, 300 + i % 3 * 13); b.velocity.set(0.2 + i * 0.1, 0.3); });
  return r;
}
const state = r => [...r._allBoids].sort((a, b) => a.group.localeCompare(b.group) || a.id - b.id)
  .map(b => [b.position.x, b.position.y, b.velocity.x, b.velocity.y]);

test('30/60/120/144 Hz and irregular frames produce identical flock trajectories', () => {
  const simulate = frames => {
    const r = registry(); const clock = new FixedStepClock();
    for (const dt of frames) clock.advance(dt, (_, t) => r.update(null, t));
    return state(r);
  };
  const baseline = simulate(Array(60).fill(1000 / 60));
  for (const hz of [30, 120, 144]) assert.deepEqual(simulate(Array(hz).fill(1000 / hz)), baseline);
  assert.deepEqual(simulate(Array(20).fill([7, 13, 30]).flat()), baseline);
});

test('stalls cap catch-up; invalid elapsed times do not advance simulation', () => {
  const clock = new FixedStepClock(); let steps = 0;
  for (const dt of [NaN, Infinity, -1, 0]) clock.advance(dt, () => steps++);
  assert.equal(steps, 0);
  clock.advance(10000, () => steps++);
  assert.equal(steps, 15);
});

test('reversing species and boid arrays preserves simulation, including collisions', () => {
  const a = registry(), b = registry();
  a.settings.collisions = b.settings.collisions = true;
  b.groups = new Map([...b.groups].reverse());
  for (const gs of b.groups.values()) gs.boids.reverse();
  b._rebuildAllBoids();
  for (let i = 1; i <= 20; i++) { a.update(null, i * 1000 / 60); b.update(null, i * 1000 / 60); }
  assert.deepEqual(state(a), state(b));
});

test('steering reads old neighbor velocities and positions before any integration', () => {
  const r = registry([fishConfig]); const boids = r._allBoids;
  const before = state(r); const seen = [];
  for (const b of boids) {
    b.flock = peers => {
      seen.push(peers.filter(p => p !== b).map(p => [p.id, p.position.x, p.velocity.x]));
      b.velocity.add(createVector(100, 0));
    };
  }
  r.update(null, 20);
  for (const row of seen) for (const [id, x, vx] of row) {
    assert.equal(x, before[id][0]); assert.equal(vx, before[id][2]);
  }
});

test('all moving species honor maxForce config and unchanged speed slider is idempotent', () => {
  for (const config of [fishConfig, shrimpConfig, turtleConfig, goldfishConfig]) {
    const custom = { ...config, physics: { ...config.physics, maxForce: 0.123 } };
    const r = registry([custom]); const boids = r._allBoids;
    const speeds = boids.map(b => b.maxSpeed);
    r.setSliderValue(config.group, 'speed', config.sliders.speed.defaultValue);
    assert.deepEqual(boids.map(b => b.maxSpeed), speeds);
    assert.ok(boids.every(b => b.maxForce === 0.123));
    r.setSliderValue(config.group, 'speed', 20);
    for (const b of boids) assert.ok(Math.abs(b.maxSpeed - config.physics.speedIndex * config.sliders.speed.toParam(20) * b.quicknessCoefficient) < 1e-12);
  }
});

test('pond plant spring reactions are staged and render layers are configurable', () => {
  const r = registry([pondPlantConfig]);
  r.update(null, 1000 / 60);
  for (const row of state(r)) assert.ok(row.every(Number.isFinite));
  const rendered = [];
  for (const b of r._allBoids) b.display = () => rendered.push(b);
  const petal = r._allBoids.find(b => b.isPetal);
  petal.isDetached = true;
  r.render();
  assert.equal(rendered[0], petal);
});
