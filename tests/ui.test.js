import test from 'node:test';
import assert from 'node:assert/strict';
import { UIController } from '../src/ui/UIController.js';

test('render toggle switches both directions without resetting simulation settings', () => {
  const add = dom();
  const button = add('render-mode');
  const ui = new UIController();
  ui.settings = { asciiMode: true, feedMode: true, collisions: true };
  ui._initRenderMode();
  assert.equal(button.textContent, 'ASCII');
  button.onclick();
  assert.equal(ui.settings.asciiMode, false);
  assert.equal(button.textContent, 'Original');
  assert.equal(button.attributes['aria-pressed'], 'false');
  button.onclick();
  assert.equal(button.textContent, 'ASCII');
  assert.deepEqual(ui.settings, { asciiMode: true, feedMode: true, collisions: true });
});

function dom() {
  const elements = [];
  class Element {
    constructor() {
      this.children = []; this.dataset = {}; this.style = {}; this.attributes = {};
      const classes = new Set();
      this.classList = {
        add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c),
        toggle: (c, enabled) => { if (enabled ?? !classes.has(c)) classes.add(c); else classes.delete(c); },
      };
      elements.push(this);
    }
    append(...children) { this.children.push(...children); }
    appendChild(child) { this.append(child); }
    setAttribute(k, v) { this.attributes[k] = v; }
    remove() { this.removed = true; }
  }
  globalThis.document = {
    createElement: () => new Element(),
    getElementById: id => elements.find(e => !e.removed && e.id === id),
    querySelectorAll: () => elements.filter(e => !e.removed && 'speciesSlider' in e.dataset),
  };
  return id => { const e = new Element(); e.id = id; return e; };
}

test('desktop and mobile checkbox state stays consistent from initialization through repeated changes', () => {
  for (const initial of [false, true]) {
    const add = dom(); const desktop = add('desktop'), mobile = add('mobile');
    mobile.classList.toggle('boids-checkbox-on', !initial);
    const ui = new UIController(); ui.settings = { walls: initial };
    const changes = [];
    ui._bindCheckbox({ desktopId: 'desktop', mobileId: 'mobile', settingKey: 'walls', defaultChecked: !initial, onOff: v => changes.push(v) });
    const check = value => {
      assert.equal(ui.settings.walls, value); assert.equal(desktop.checked, value);
      assert.equal(mobile.dataset.checked, String(value));
      assert.equal(mobile.classList.contains('boids-checkbox-on'), value);
      assert.equal(mobile.attributes['aria-pressed'], String(value));
    };
    check(initial);
    mobile.onclick(); check(!initial);
    desktop.checked = initial; desktop.onchange(); check(initial);
    desktop.onchange(); check(initial);
    assert.deepEqual(changes, [!initial, initial, initial]);
  }
});

test('arbitrary species sliders generate labels, ranges, callbacks and mobile controls; switching removes obsolete controls', () => {
  const add = dom(); add('species-sliders'); const mobile = add('mobile-boids-controls');
  const ui = new UIController(); const updates = [];
  ui.registry = {
    getSliderConfigs: group => group === 'new' ? { curiosity: { label: 'Curiosity', min: 2, max: 9, step: 0.5 } } : {},
    getSliderUIValues: () => ({ curiosity: 4 }),
    setSliderValue: (...args) => updates.push(args),
  };
  ui._syncSlidersToGroup('new');
  const input = document.getElementById('species-sliders').children[0].children[1].children[1];
  assert.equal(input.id, 'curiosity'); assert.equal(input.min, 2); assert.equal(input.step, 0.5);
  input.value = '6.5'; input.oninput(); assert.deepEqual(updates, [['new', 'curiosity', 6.5]]);
  const button = document.getElementById('curiosity-mobile'); assert.equal(button.textContent, 'Curiosity');
  button.onclick(); assert.equal(mobile.style.display, 'none');
  document.getElementById('curiosity-control-container').children[0].onclick();
  assert.equal(mobile.style.display, '');
  ui._syncSlidersToGroup('empty');
  assert.equal(document.getElementById('curiosity-mobile'), undefined);
  assert.equal(document.getElementById('curiosity-control-container'), undefined);
});
