import './helpers/p5.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Turtle } from '../src/animals/turtle/Turtle.js';
import { Shrimp } from '../src/animals/shrimp/Shrimp.js';
import { FishLocomotion } from '../src/core/FishLocomotion.js';
import { angleDelta } from '../src/core/FishSpine.js';
import { AnimalRegistry } from '../src/registry/AnimalRegistry.js';
import { turtleConfig } from '../src/animals/turtle/turtle.config.js';
import { UIController } from '../src/ui/UIController.js';

for (const Body of [Turtle, Shrimp]) {
  test(`${Body.name} preserves its pose while stationary`, () => {
    const body = new Body(createVector(500, 400), 0.2);
    body.resetSpine(createVector(500, 400), Math.PI);
    const before = body.spine.joints.map(p => [p.x, p.y]);
    for (let i = 0; i < 60; i++) body.resolveToPosition(createVector(500, 400));
    body.spine.joints.forEach((p, i) => {
      assert.ok(Math.hypot(p.x - before[i][0], p.y - before[i][1]) < 1e-8);
    });
  });

  test(`${Body.name} limits heading changes when reversing near food`, () => {
    const body = new Body(createVector(500, 400), 0.2);
    body.resetSpine(createVector(500, 400), Math.PI);
    for (let i = 0; i < 120; i++) {
      const previous = body.spine.angles[0];
      body.resolveToPosition(createVector(500 + (i % 2 ? 0 : 0.01), 400));
      assert.ok(Math.abs(angleDelta(body.spine.angles[0], previous)) <= Math.PI / 60 + 1e-8);
    }
  });
}

test('retracted turtle translates rigidly through drag reversals and pauses', () => {
  const body = new Turtle(createVector(500, 400), 0.2);
  body.resetSpine(createVector(500, 400), Math.PI);
  body.isRetracted = true;
  const before = body.spine.joints.map(p => [p.x - 500, p.y - 400]);
  for (const x of [510, 510, 490, 490, 600]) {
    body.resolveToPosition(createVector(x, 400));
    body.spine.joints.forEach((p, i) => {
      assert.ok(Math.hypot(p.x - x - before[i][0], p.y - 400 - before[i][1]) < 1e-8);
    });
  }
});

test('fish locomotion retains stationary heading and bounds reversals', () => {
  const motion = new FishLocomotion(createVector(500, 400), 12, 10, Math.PI);
  motion.update(createVector(500, 400), createVector(0, 0));
  assert.equal(motion.heading, Math.PI);
  motion.update(createVector(500.01, 400), createVector(0.01, 0));
  assert.ok(Math.abs(angleDelta(motion.heading, Math.PI)) <= 3 / 60 + 1e-8);
});

test('turtle interaction centers do not jump when steering velocity reverses', () => {
  const registry = new AnimalRegistry();
  registry.register({ ...turtleConfig, defaultCount: 1 });
  registry.init({});
  const turtle = registry._allBoids[0];
  turtle.turtle.resetSpine(turtle.position, Math.PI);
  turtle.velocity.set(-1, 0);
  const hit = turtle.hitCenter;
  const collision = turtle.collisionCenter;
  for (const vx of [1, 0, -1]) {
    turtle.velocity.set(vx, 0);
    assert.deepEqual(turtle.hitCenter, hit);
    assert.deepEqual(turtle.collisionCenter, collision);
  }
});

test('mouse grab preserves the clicked turtle point through dragging and re-grabbing', async t => {
  const registry = new AnimalRegistry();
  registry.register({ ...turtleConfig, defaultCount: 1 });
  registry.init({});
  const turtle = registry._allBoids[0];
  const globals = {
    window: {}, document: { elementFromPoint: () => null, getElementById: () => null },
    createCanvas: () => ({ parent() {} }), background() {},
    windowWidth: 1200, windowHeight: 800, mouseX: 0, mouseY: 0,
    deltaTime: 1000 / 60, frameCount: 1,
  };
  const previous = Object.fromEntries(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.assign(globalThis, globals);
  t.after(() => {
    for (const [key, descriptor] of Object.entries(previous)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  t.mock.method(UIController.prototype, 'init', () => {});
  for (const method of ['init', 'update', 'render', 'attractFoods', 'checkFoodCollisions']) {
    t.mock.method(AnimalRegistry.prototype, method, () => {});
  }
  t.mock.method(AnimalRegistry.prototype, 'hitTest', () => turtle);
  await import('../src/main.js');
  window.setup();
  for (const heading of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    turtle.position.set(600, 400);
    turtle.turtle.resetSpine(turtle.position, heading);
    turtle.velocity = p5.Vector.fromAngle(heading);
    const shell = p5.Vector.lerp(turtle.turtle.spine.joints[4], turtle.turtle.spine.joints[5], 0.5);
    mouseX = shell.x + 3;
    mouseY = shell.y - 2;
    const click = createVector(mouseX, mouseY);
    const before = turtle.turtle.spine.joints.map(p => p.copy());
    window.mousePressed();
    for (const [dx, dy] of [[0, 0], [40, -20], [40, -20], [-15, 10]]) {
      mouseX = click.x + dx;
      mouseY = click.y + dy;
      window.draw();
      turtle.turtle.spine.joints.forEach((p, i) => {
        assert.ok(Math.hypot(p.x - before[i].x - dx, p.y - before[i].y - dy) < 1e-8);
      });
    }
    window.mouseReleased();
    assert.equal(turtle.isGrabbed, false);
  }
});
