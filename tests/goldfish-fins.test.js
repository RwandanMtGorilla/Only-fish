import './helpers/p5.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Goldfish } from '../src/animals/goldfish/Goldfish.js';
import { AnimalRegistry } from '../src/registry/AnimalRegistry.js';
import { goldfishConfig } from '../src/animals/goldfish/goldfish.config.js';
import { angleDelta } from '../src/core/FishSpine.js';

const fins = body => [body.leftPecFin, body.rightPecFin];
function localPose(body, chain) {
  const a = body.spine.angles[2], root = chain.joints[0];
  return chain.joints.map((p, i) => {
    const x = p.x - root.x, y = p.y - root.y;
    return [x * Math.cos(a) + y * Math.sin(a), -x * Math.sin(a) + y * Math.cos(a),
      angleDelta(chain.angles[i], a)];
  }).flat();
}
function checkGeometry(body) {
  fins(body).forEach((chain, index) => {
    const heading = body.spine.angles[2];
    const rootAngle = heading + (index === 0 ? 1 : -1) * Math.PI * 5 / 12;
    const joint = body.spine.joints[2];
    assert.ok(Math.hypot(chain.joints[0].x - joint.x - Math.cos(rootAngle) * body.bodyWidth[2],
      chain.joints[0].y - joint.y - Math.sin(rootAngle) * body.bodyWidth[2]) < 1e-6);
    assert.ok(Math.abs(angleDelta(chain.angles[0], heading)) < 1e-6);
    for (let i = 1; i < chain.joints.length; i++) {
      const delta = p5.Vector.sub(chain.joints[i - 1], chain.joints[i]);
      assert.ok(Math.abs(delta.mag() - chain.linkSize) < 1e-6);
      // These angles also determine the ribbon normals used by _drawPecFin.
      assert.ok(Math.abs(angleDelta(delta.heading(), chain.angles[i])) < 1e-6);
    }
  });
}

test('goldfish fin reset agrees with IK directions and attachment points at every heading', () => {
  const body = new Goldfish(createVector(500, 400), 0.3);
  checkGeometry(body);
  for (const heading of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    body.resetSpine(createVector(100, 200), heading);
    checkGeometry(body);
    const before = fins(body).map(chain => localPose(body, chain));
    body._updatePectoralFins(false);
    checkGeometry(body);
    fins(body).forEach((chain, f) => localPose(body, chain).forEach((v, i) => {
      assert.ok(Math.abs(v - before[f][i]) < 1e-6);
    }));
  }
});

test('grabbed goldfish transports both fin ribbons through reversals, pauses and release', () => {
  const registry = new AnimalRegistry();
  registry.register({ ...goldfishConfig, defaultCount: 1 });
  registry.init({});
  const boid = registry._allBoids[0], body = boid.goldfish;
  for (let i = 0; i < 90; i++) {
    boid.velocity = p5.Vector.fromAngle(i * 0.01).mult(2);
    boid.position.add(boid.velocity);
    body.resolveToPosition(boid.position, boid.velocity, 1 / 60);
  }
  boid.isGrabbed = true;
  const before = fins(body).map(chain => localPose(body, chain));
  for (const [x, y] of [[500, 400], [500, 410], [500, 390], [900, 100], [100, 700], [100, 700]]) {
    boid.position.set(x, y);
    boid.velocity = p5.Vector.fromAngle(0.9).mult(0.01);
    boid.resolveRenderPosition();
    checkGeometry(body);
    fins(body).forEach((chain, f) => localPose(body, chain).forEach((v, i) => {
      assert.ok(Math.abs(v - before[f][i]) < 1e-6);
    }));
  }
  boid.isGrabbed = false;
  for (let i = 0; i < 60; i++) {
    boid.velocity = p5.Vector.fromAngle(0.9).mult(2);
    boid.position.add(boid.velocity);
    boid.resolveRenderPosition();
    checkGeometry(body);
  }
});
