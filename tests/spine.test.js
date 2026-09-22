import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector } from './helpers/p5.js';
import { FishSpine, angleDelta } from '../src/core/FishSpine.js';
import { Fish } from '../src/animals/fish/Fish.js';
import { Goldfish } from '../src/animals/goldfish/Goldfish.js';

for (const Species of [Fish, Goldfish]) {
  test(`${Species.name}: tight turns and reversals respect regional limits and link lengths`, () => {
    const fish = new Species(new Vector(), 0.4);
    const motion = fish.locomotion, spine = fish.spine;
    const position = new Vector();
    let heading = 0;
    for (let frame = 0; frame < 1200; frame++) {
      heading += (frame < 600 ? 3 : -3) / 60;
      const speed = (frame < 800 ? 0.08 : 1) * motion.bodyLength / 60;
      const velocity = Vector.fromAngle(heading).mult(speed);
      position.add(velocity);
      motion.update(position, velocity, frame % 3 === 0 ? 1 / 120 : 1 / 60);
      assert.ok(Math.abs(angleDelta(spine.angles[0], motion.heading)) < 1e-5);
      assert.equal(Vector.dist(spine.joints[0], position), 0);
      for (let i = 1; i < spine.joints.length; i++) {
        const limit = spine.bendLimits[i] + 2e-6;
        assert.ok(Math.abs(angleDelta(spine.pathAngles[i], spine.pathAngles[i - 1])) <= limit);
        assert.ok(Math.abs(angleDelta(spine.angles[i], spine.angles[i - 1])) <= limit);
        assert.ok(Math.abs(spine.relative[i]) <= limit);
        assert.ok(Math.abs(Vector.dist(spine.joints[i], spine.joints[i - 1]) - spine.linkSize) < 1e-6);
      }
      // First half of the thick body cannot accumulate a snake-like fold.
      assert.ok(Math.abs(spine.angles[5] - spine.angles[0]) < 27 * Math.PI / 180);
    }
  });

  test(`${Species.name}: straight swimming retains substantial tail oscillation`, () => {
    const fish = new Species(new Vector(), 0.4);
    const motion = fish.locomotion, spine = fish.spine;
    motion.gait.phase = 0;
    const position = new Vector();
    const velocity = new Vector(motion.bodyLength / 60, 0);
    let min = Infinity, max = -Infinity;
    for (let frame = 0; frame < 600; frame++) {
      position.add(velocity);
      motion.update(position, velocity, 1 / 60);
      if (frame > 120) {
        const tail = spine.joints.at(-1).y - position.y;
        min = Math.min(min, tail);
        max = Math.max(max, tail);
      }
    }
    assert.ok(max - min > motion.bodyLength * 0.08);
    motion.reset(new Vector(20, 40), -2);
    assert.ok([...spine.relative, ...spine.relativeVelocity].every(v => v === 0));
  });
}

test('uniform fallback and locked joints work without storing outward momentum', () => {
  const spine = new FishSpine(new Vector(), 4, 10, 0.5, { bendLimits: [0, 0, 0.1] });
  assert.deepEqual([...spine.bendLimits], [0, 0, 0.1, 0.5]);
  const gait = { relativeAngles: (_, out) => out.fill(2) };
  spine.reset(new Vector(), 0);
  spine.relativeVelocity[1] = 100;
  spine.relativeVelocity[2] = 100;
  spine.update(new Vector(), 0, gait, 1 / 60);
  assert.equal(spine.relative[1], 0);
  assert.equal(spine.relativeVelocity[1], 0);
  assert.ok(spine.relative[2] <= 0.1 + 1e-7);
  assert.equal(spine.relativeVelocity[2], 0);
});
