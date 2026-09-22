import './helpers/p5.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Fish } from '../src/animals/fish/Fish.js';
import { Goldfish } from '../src/animals/goldfish/Goldfish.js';
import { PectoralFin } from '../src/core/PectoralFin.js';
import { angleDelta } from '../src/core/FishSpine.js';

for (const Body of [Fish, Goldfish]) {
  test(`${Body.name}: stationary fins ripple with fixed roots and inextensible links`, () => {
    const body = new Body(createVector(0, 0), 0.4);
    body.locomotion.gait.phase = 0;
    const tips = [], roots = [];
    for (let frame = 0; frame < 600; frame++) {
      body.resolveToPosition(createVector(0, 0), createVector(0, 0), 1 / 60);
      const fin = body.leftPecFin;
      tips.push(fin.joints.at(-1).y - fin.joints[0].y);
      roots.push(fin.joints[0].copy());
      for (const chain of [fin, body.rightPecFin]) {
        for (let i = 1; i < chain.joints.length; i++) {
          assert.ok(Math.abs(p5.Vector.dist(chain.joints[i], chain.joints[i - 1]) - chain.linkSize) < 1e-6);
          assert.ok(Math.abs(angleDelta(chain.angles[i], chain.angles[i - 1])) <= chain.angleConstraint + 1e-6);
        }
      }
    }
    assert.ok(Math.max(...tips.slice(120)) - Math.min(...tips.slice(120)) > body.scale * 5);
    assert.ok(roots.every(p => p5.Vector.dist(p, roots[0]) < body.scale));
    body.resetSpine(createVector(1000, -1000), Math.PI);
    assert.ok(p5.Vector.dist(body.leftPecFin.joints[0], createVector(1000, -1000)) < 200);
  });
}

test('branch wave has spatial phase delay and mirrors across the body', () => {
  const peaks = [];
  for (let sample = 0; sample < 64; sample++) {
    const fins = [new PectoralFin(createVector(0, 0), 10), new PectoralFin(createVector(0, 0), 10)];
    const locomotion = { brake: 0, gait: { phase: sample * Math.PI * 2 / 64,
      waveNum: 0.65, tipAmplitude: 0.1, tipAmpMax: 0.1 } };
    fins.forEach((fin, side) => {
      fin.update(createVector(0, 0), 0, side ? -1 : 1, locomotion, 0.2, 0, true, false);
      for (let frame = 0; frame < 120; frame++) {
        fin.update(createVector(0, 0), 0, side ? -1 : 1, locomotion, 0.2, 1 / 60, false, false);
      }
    });
    fins[0].joints.forEach((p, i) => {
      assert.ok(Math.abs(p.x - fins[1].joints[i].x) < 1e-6);
      assert.ok(Math.abs(p.y + fins[1].joints[i].y) < 1e-6);
    });
    peaks.push([fins[0].angles[1], fins[0].angles[4]]);
  }
  const peak = i => peaks.reduce((best, p, n) => p[i] < peaks[best][i] ? n : best, 0);
  assert.ok((peak(1) - peak(0) + 64) % 64 > 20, 'tip reaches its stroke after the root');
});
