import { FixedStepClock } from './core/FixedStepClock.js';
/**
 * Fish Boids - Main entry point
 * 注册动物 + p5.js 生命周期 + 全局交互 (抓取状态机)
 * @module main
 */

import { AnimalRegistry } from './registry/AnimalRegistry.js';
import { UIController } from './ui/UIController.js';
import { FoodItem } from './entities/FoodItem.js';

// === 动物注册 (扩展时只需加一行 import + register) ===
import { fishConfig } from './animals/fish/fish.config.js';
import { turtleConfig } from './animals/turtle/turtle.config.js';
import { goldfishConfig } from './animals/goldfish/goldfish.config.js';
import { pondPlantConfig } from './animals/pond_plant/pondPlant.config.js';
import { shrimpConfig } from './animals/shrimp/shrimp.config.js';//虾米

// === 全局状态 ===
const registry = new AnimalRegistry();
const ui = new UIController();
const simulation = new FixedStepClock();
let foods = [];
let settings = {
  walls: false,
  mouseSeek: false,
  collisions: true,
  feedMode: true,
  grabFish: true,
  showRadii: false,
  foods: null,
  mousePos: null,
  center: null,
  canvasW: 0,
  canvasH: 0,
};

// === 抓取状态机 ===
let grabbedBoid = null;
let grabOffset = null;
let grabHeading = 0;
let grabThrashState = 'THRASH';
let grabThrashTimer = 0;
let grabThrashPhase = 0;

// === 注册动物 ===
registry.register(fishConfig);
registry.register(turtleConfig);
registry.register(goldfishConfig);
registry.register(pondPlantConfig);
registry.register(shrimpConfig);

// === p5.js Lifecycle ===

window.setup = function () {
  const cnv = createCanvas(windowWidth, windowHeight);
  cnv.parent('boids-wrapper');
  settings.center = createVector(width / 2, height / 2);
  settings.canvasW = width;
  settings.canvasH = height;
  settings.mousePos = createVector(width / 2, height / 2);
  settings.foods = foods;

  registry.init(settings);
  ui.init(registry, settings, { releaseGrabbedFish });
};

window.draw = function () {
  background(10, 22, 40);

  settings.mousePos.set(mouseX, mouseY);
  settings.canvasW = width;
  settings.canvasH = height;

  simulation.advance(deltaTime, (dt, time) => {
    if (grabbedBoid) {
      grabbedBoid.simulationTime = time;
      updateGrabbedBoid(grabbedBoid, dt);
    }
    registry.update(grabbedBoid, time);
    registry.attractFoods(foods, grabbedBoid);
    registry.checkFoodCollisions(foods, grabbedBoid, time);
  });

  // 渲染食物 (在动物下层)
  for (let i = 0; i < foods.length; i++) {
    foods[i].display();
  }

  // 渲染所有动物
  registry.render();

  // 调试: 显示碰撞/抓取半径
  if (settings.showRadii) {
    registry.renderDebugRadii();
  }

  // FPS 显示
  if (frameCount % 60 === 0) {
    const fpsEl = document.getElementById('fps-number');
    if (fpsEl) fpsEl.innerHTML = Math.round(frameRate());
  }
};

window.mousePressed = function () {
  if (mouseX < 0 || mouseX > width || mouseY < 0 || mouseY > height) return;
  const el = document.elementFromPoint(mouseX, mouseY);
  const controls = document.getElementById('boids-controls-container');
  const toggleBtn = document.getElementById('toggle-controls-btn');
  if (controls && controls.contains(el)) return;
  if (toggleBtn && toggleBtn.contains(el)) return;

  // 优先尝试抓取
  if (settings.grabFish) {
    const hit = registry.hitTest(mouseX, mouseY);
    if (hit) {
      grabbedBoid = hit;
      grabbedBoid.isGrabbed = true;
      // Keep the exact clicked point attached to the pointer for rigid dragging.
      grabOffset = hit.preserveGrabOffset
        ? p5.Vector.sub(hit.position, createVector(mouseX, mouseY))
        : null;
      grabHeading = hit.velocity.heading();
      grabThrashState = 'THRASH';
      grabThrashTimer = random(300, 800);
      grabThrashPhase = 0;
      return;
    }
  }

  // 未命中, 执行投食
  if (settings.feedMode) {
    foods.push(new FoodItem(mouseX, mouseY));
  }
};

window.mouseReleased = function () {
  releaseGrabbedFish();
};

window.windowResized = function () {
  resizeCanvas(windowWidth, windowHeight);
  settings.center = createVector(width / 2, height / 2);
};

// === 抓取相关函数 ===

function releaseGrabbedFish() {
  if (grabbedBoid) {
    grabbedBoid.isGrabbed = false;
    // Detached petals: throw outward instead of snapping back
    if (grabbedBoid.isPetal && grabbedBoid.isDetached) {
      grabbedBoid.velocity = p5.Vector.fromAngle(grabHeading).mult(grabbedBoid.maxSpeed * 0.5);
    } else {
      grabbedBoid.velocity = p5.Vector.fromAngle(grabHeading).mult(grabbedBoid.maxSpeed * 0.3);
    }
    grabbedBoid.onRelease?.();
    grabbedBoid = null;
    grabOffset = null;
  }
}

function updateGrabbedBoid(boid, dt) {

  // 挣扎状态机
  grabThrashTimer -= dt;
  if (grabThrashTimer <= 0) {
    if (grabThrashState === 'THRASH') {
      grabThrashState = 'PAUSE';
      grabThrashTimer = random(100, 400);
    } else {
      grabThrashState = 'THRASH';
      grabThrashTimer = random(300, 800);
    }
  }

  // 计算挣扎偏移 (部分动物不扭动, 如乌龟缩壳)
  let thrashOffset = 0;
  if (boid.grabThrash !== false) {
    if (grabThrashState === 'THRASH') {
      grabThrashPhase += dt * 0.025;
      const amplitude = boid.radius * 0.6;
      thrashOffset = sin(grabThrashPhase) * amplitude;
    } else {
      grabThrashPhase += dt * 0.005;
      thrashOffset = sin(grabThrashPhase) * boid.radius * 0.05;
    }
  }

  // 鼠标位置 + 垂直于朝向的偏移
  const perpAngle = grabHeading + HALF_PI;
  const finalX = mouseX + cos(perpAngle) * thrashOffset;
  const finalY = mouseY + sin(perpAngle) * thrashOffset;

  // 花瓣: 以几何中心对齐鼠标, 反算根部位置
  if (grabOffset) {
    boid.position.set(finalX + grabOffset.x, finalY + grabOffset.y);
  } else if (boid.isPetal && boid.hitCenter) {
    const hc = boid.hitCenter;
    const offsetX = hc.x - boid.position.x;
    const offsetY = hc.y - boid.position.y;
    boid.position.set(finalX - offsetX, finalY - offsetY);
  } else {
    boid.position.set(finalX, finalY);
  }
  // Dragging a lilypad moves its spring anchor too
  if (boid.anchor) {
    boid.anchor.set(finalX, finalY);
  }
  boid.velocity = p5.Vector.fromAngle(grabHeading).mult(0.01);
  boid.resolveRenderPosition();
}
