// Screen-space post-processing: species keep their existing p5 drawing code.
// Only this small sampling canvas is read back; the display stays at native DPI.
import { ROOT_SAMPLES, visitAsciiLeaves } from './AsciiQuadtree.js';
const GLYPHS = ' .,:;=+*#%@/\\|-';
const RAMP = '.,:;=+*#%@';
const BACKGROUND = '#0a1628';

export function selectGlyph(alpha, luminance, dx, dy) {
  if (alpha < 0.08) return ' ';
  if (Math.hypot(dx, dy) > 0.3 && alpha < 0.65) {
    if (Math.abs(dx) > Math.abs(dy) * 2) return '|';
    if (Math.abs(dy) > Math.abs(dx) * 2) return '-';
    return dx * dy > 0 ? '/' : '\\';
  }
  const density = Math.min(1, Math.max(0, luminance * 0.7 + alpha * 0.3));
  return RAMP[Math.round(density * (RAMP.length - 1))];
}

export class AsciiRenderer {
  constructor() {
    this.sample = document.createElement('canvas');
    this.sampleContext = this.sample.getContext('2d', { willReadFrequently: true });
    this.atlas = document.createElement('canvas');
    this.tiles = new Set();
    this.cellWidth = 0;
  }

  resize(width, height, pixelRatio) {
    // Bound readback and draw calls on large displays; preserve readable glyphs.
    const cellWidth = Math.max(5, Math.ceil(width / 320), Math.ceil(height / 180 / 1.6));
    const cellHeight = Math.round(cellWidth * 1.6);
    this.columns = Math.ceil(width / cellWidth);
    this.rows = Math.ceil(height / cellHeight);
    const sw = this.columns * ROOT_SAMPLES, sh = this.rows * ROOT_SAMPLES;
    if (this.sample.width !== sw || this.sample.height !== sh) {
      this.sample.width = sw;
      this.sample.height = sh;
    }
    if (cellWidth === this.cellWidth && pixelRatio === this.pixelRatio) return;
    this.cellWidth = cellWidth;
    this.cellHeight = cellHeight;
    this.pixelRatio = pixelRatio;
    this.tileWidth = Math.ceil(cellWidth * pixelRatio);
    this.tileHeight = Math.ceil(cellHeight * pixelRatio);
    this.atlas.width = 64 * this.tileWidth;
    this.atlas.height = Math.ceil(GLYPHS.length * 216 / 64) * this.tileHeight;
    this.atlasContext = this.atlas.getContext('2d');
    this.tiles.clear();
  }

  render(canvas, width, height) {
    const ratio = canvas.width / width;
    this.resize(width, height, ratio);
    const { columns, rows, cellWidth: cw, cellHeight: ch, sampleContext: sample } = this;
    sample.clearRect(0, 0, this.sample.width, this.sample.height);
    // Keep cells aligned with screen coordinates, including partial edge cells.
    sample.drawImage(canvas, 0, 0, width * ROOT_SAMPLES / cw, height * ROOT_SAMPLES / ch);
    const pixels = sample.getImageData(0, 0, this.sample.width, this.sample.height).data;
    const context = canvas.getContext('2d');
    context.save();
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.globalAlpha = 1;
    context.globalCompositeOperation = 'source-over';
    context.fillStyle = BACKGROUND;
    context.fillRect(0, 0, width, height);
    const drawLeaf = ({ x, y, size, alpha, r, g, b, dx, dy }) => {
        const glyph = selectGlyph(alpha, (r * 0.2126 + g * 0.7152 + b * 0.0722) / 255, dx, dy);
        // Six stable levels per channel avoid an unbounded per-color cache.
        const qr = Math.min(5, Math.round((r * 0.85 + 38) / 51));
        const qg = Math.min(5, Math.round((g * 0.85 + 38) / 51));
        const qb = Math.min(5, Math.round((b * 0.85 + 38) / 51));
        const tile = (qr * 36 + qg * 6 + qb) * GLYPHS.length + GLYPHS.indexOf(glyph);
        const tx = (tile % 64) * this.tileWidth;
        const ty = Math.floor(tile / 64) * this.tileHeight;
        if (!this.tiles.has(tile)) {
          const atlas = this.atlasContext;
          atlas.font = `bold ${Math.round(ch * ratio)}px monospace`;
          atlas.textAlign = 'center';
          atlas.textBaseline = 'middle';
          atlas.fillStyle = `rgb(${qr * 51},${qg * 51},${qb * 51})`;
          atlas.fillText(glyph, tx + this.tileWidth / 2, ty + this.tileHeight / 2, this.tileWidth);
          this.tiles.add(tile);
        }
        context.globalAlpha = Math.min(1, Math.sqrt(alpha * 2));
        // Scale the same cached glyph, preserving the largest character exactly.
        context.drawImage(this.atlas, tx, ty, this.tileWidth, this.tileHeight,
          x * cw / ROOT_SAMPLES, y * ch / ROOT_SAMPLES,
          size * cw / ROOT_SAMPLES, size * ch / ROOT_SAMPLES);
    };
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < columns; x++) {
        visitAsciiLeaves(pixels, this.sample.width, x * ROOT_SAMPLES, y * ROOT_SAMPLES, drawLeaf);
      }
    }
    context.restore();
  }
}
