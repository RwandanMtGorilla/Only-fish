// Deterministic contact sheet using production locomotion, without p5 or a CDN.
// node tools/turn-study.mjs --interval=8 --speed=1 --yaw=0.3
import { mkdirSync, writeFileSync } from 'node:fs';
import { FishLocomotion } from '../src/core/FishLocomotion.js';

const args = Object.fromEntries(process.argv.slice(2).map(s => s.replace(/^--/, '').split('=')));
const number = (key, fallback) => {
  const value = Number(args[key] ?? fallback);
  if (!Number.isFinite(value)) throw new Error(`Invalid ${key}`);
  return value;
};
const interval = number('interval', 8), speed = number('speed', 1), yaw = number('yaw', 0.3);
if (!Number.isInteger(interval) || interval < 1 || interval > 120 || speed <= 0 || Math.abs(yaw) > 3) {
  throw new Error('Use interval 1..120, speed > 0 BL/s, and yaw -3..3 rad/s');
}
class Vector {
  constructor(x = 0, y = 0) { this.x = x; this.y = y; }
  copy() { return new Vector(this.x, this.y); }
  add(x, y) { this.x += x; this.y += y; return this; }
  set(x, y) { this.x = x; this.y = y; return this; }
  mag() { return Math.hypot(this.x, this.y); }
}
const variants = [{ name: 'Symmetric strokes', gain: 0, color: '#7b8ea8' },
  { name: 'Previous', gain: 0.16, color: '#ce913b' },
  { name: 'Current', gain: new FishLocomotion(new Vector(), 12, 8, 0).gait.turnAsymmetryMax, color: '#21b6a8' }];
const histories = variants.map(v => {
  const pos = new Vector();
  const motion = new FishLocomotion(pos, 12, 8, 0, { gait: { phase: 0, turnAsymmetryMax: v.gain } });
  const frames = [];
  let heading = 0, clipped = 0, maxJointChange = 0, previous;
  for (let frame = -180; frame <= 480; frame++) {
    // Straight warmup, ease into a normal-speed turn, then ease back to straight.
    const ramp = t => { const x = Math.max(0, Math.min(1, t)); return x * x * (3 - 2 * x); };
    const rate = yaw * ramp(frame / 45) * (1 - ramp((frame - 330) / 45));
    heading += rate / 60;
    const velocity = new Vector(Math.cos(heading) * speed * 88 / 60, Math.sin(heading) * speed * 88 / 60);
    pos.add(velocity.x, velocity.y);
    motion.update(pos, velocity, 1 / 60);
    const spine = motion.spine;
    if (frame >= 0) {
      clipped += [...spine.relative].filter(a => Math.abs(a) > spine.maxBend).length;
      if (previous) for (let i = 1; i < 12; i++) maxJointChange = Math.max(maxJointChange, Math.abs(spine.relative[i] - previous[i]));
      frames.push({ frame, heading: motion.heading, phase: motion.gait.phase,
        joints: spine.joints.map(p => [p.x, p.y]), angles: [...spine.angles],
        asymmetry: motion.gait.turnAsymmetry });
      previous = [...spine.relative];
    }
  }
  return { ...v, frames, clipped, maxJointChange };
});
const f = n => n.toFixed(2);
const points = list => list.map(p => p.map(f).join(',')).join(' ');
function fish(sample, color, transform, opacity = 1) {
  const widths = [8.5, 10.125, 10.5, 10.375, 9.625, 8, 6.375, 4.75, 4, 2.375];
  const edge = (i, side) => {
    const p = sample.joints[i], a = sample.angles[i];
    return transform([p[0] - Math.sin(a) * widths[i] * side, p[1] + Math.cos(a) * widths[i] * side]);
  };
  const outline = widths.map((_, i) => edge(i, 1)).concat(widths.map((_, i) => edge(9 - i, -1)));
  const tail = sample.joints[11], a = sample.angles[11];
  const fin = [sample.joints[8], [tail[0] - Math.sin(a) * 13, tail[1] + Math.cos(a) * 13],
    sample.joints[10], [tail[0] + Math.sin(a) * 13, tail[1] - Math.cos(a) * 13]].map(transform);
  return `<g opacity="${opacity}"><polygon points="${points(fin)}" fill="${color}" fill-opacity=".22" stroke="${color}"/><polygon points="${points(outline)}" fill="${color}" fill-opacity=".15" stroke="${color}"/><polyline points="${points(sample.joints.map(transform))}" fill="none" stroke="${color}" stroke-width="1"/></g>`;
}
const text = (x, y, label, size = 14, color = '#c3cede') => `<text x="${x}" y="${y}" font-size="${size}" fill="${color}">${label}</text>`;
const parts = ['<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="1320" viewBox="0 0 1440 1320"><rect width="1440" height="1320" fill="#0e1725"/><g font-family="Segoe UI, sans-serif">',
  text(35, 42, 'Gentle turn / deterministic pose study', 27),
  text(35, 73, `${speed} BL/s · yaw ${yaw} rad/s · 60 Hz · same trajectory and initial phase · simplified fish outline`),
  text(35, 102, `Stroke strip: every ${interval} frames. All poses face right; dashed line = head axis. Original path camber retained.`)];
for (let row = 0; row < histories.length; row++) {
  const h = histories[row], top = 135 + row * 270;
  parts.push(text(35, top, `${h.name} / gain ${h.gain}`, 20, h.color));
  // One-second strip, sampled densely enough to see each stroke (default 8 frames).
  const samples = h.frames.filter(s => s.frame >= 150 && s.frame <= 210 && (s.frame - 150) % interval === 0);
  const spacing = 1350 / samples.length;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i], x = 35 + i * spacing, y = top + 77;
    const scale = Math.min(1.35, (spacing - 8) / 100);
    const local = p => { const dx = p[0] - s.joints[0][0], dy = p[1] - s.joints[0][1];
      return [x + 95 * scale + (dx * Math.cos(s.heading) + dy * Math.sin(s.heading)) * scale,
        y + (-dx * Math.sin(s.heading) + dy * Math.cos(s.heading)) * scale]; };
    parts.push(`<path d="M${x},${y}h${100 * scale}" stroke="#344359" stroke-dasharray="3 4"/>`, fish(s, h.color, local), text(x, top + 125, `f${s.frame}`, 11));
  }
  // Aligned snapshots remove path curvature from the viewing frame, not the simulation.
  const center = [170, top + 205];
  for (const s of samples) parts.push(fish(s, h.color, p => {
    const dx = p[0] - s.joints[0][0], dy = p[1] - s.joints[0][1];
    return [center[0] + 1.35 * (dx * Math.cos(s.heading) + dy * Math.sin(s.heading)), center[1] + 1.35 * (-dx * Math.sin(s.heading) + dy * Math.cos(s.heading))];
  }, 0.45));
  parts.push(text(220, top + 192, `Joint limit hits: ${h.clipped} · largest per-frame joint change: ${f(h.maxJointChange * 180 / Math.PI)} deg`, 13),
    text(220, top + 219, `Steady turn bias: ${f(h.frames[300].asymmetry)} · after recovery: ${h.frames[480].asymmetry.toExponential(2)}`, 13));
}
parts.push(text(35, 963, 'World path / current gait / every 30 frames (0.5 s)', 16));
const current = histories[2].frames;
const all = current.flatMap(s => s.joints), minX = Math.min(...all.map(p => p[0])), minY = Math.min(...all.map(p => p[1]));
const rangeX = Math.max(...all.map(p => p[0])) - minX, rangeY = Math.max(...all.map(p => p[1])) - minY;
const worldScale = Math.min(1300 / rangeX, 310 / Math.max(rangeY, 1));
const world = p => [50 + (p[0] - minX) * worldScale, 980 + (p[1] - minY) * worldScale];
parts.push(`<polyline points="${points(current.map(s => world(s.joints[0])))}" fill="none" stroke="#344359"/>`);
for (const s of current.filter(s => s.frame % 30 === 0)) parts.push(fish(s, '#21b6a8', world));
parts.push(text(650, 1010, '0.00-0.75 s: ease into turn'), text(650, 1040, '0.75-5.50 s: steady gentle turn'),
  text(650, 1070, '5.50-6.25 s: ease out'), text(650, 1100, '6.25-8.00 s: recover to straight swimming'));
parts.push('</g></svg>');
mkdirSync('screenshots', { recursive: true });
const svg = parts.join('\n');
writeFileSync('screenshots/turn-study.svg', svg);
writeFileSync('screenshots/turn-study.html', `<!doctype html><meta charset="utf-8"><title>Fish turn study</title><style>body{margin:0;background:#0e1725}svg{width:100%;height:auto}</style>${svg}`);
writeFileSync('screenshots/turn-study.json', JSON.stringify({ interval, speed, yaw, histories }));
console.log(JSON.stringify(histories.map(({ name, gain, clipped, maxJointChange }) => ({ name, gain, clipped, maxJointChangeDeg: maxJointChange * 180 / Math.PI })), null, 2));
console.log('Wrote screenshots/turn-study.{svg,html,json}');
