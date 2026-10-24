import * as THREE from "three";

// Surface textures for the rooms: floorboards, wood grain, limewashed
// plaster, woven fabric, a braided rug, a dusk sky. Each one is painted once
// on a canvas and cached, so there are no image files to fetch and nothing to
// fail on a slow connection. Every texture tiles seamlessly.

type RGB = [number, number, number];
type Rand = () => number;

function rng(seed: number): Rand {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Value noise on a px × py lattice that wraps, so it tiles over u, v ∈ [0, 1). */
function lattice(rand: Rand, px: number, py: number) {
  const g = new Float32Array(px * py);
  for (let i = 0; i < g.length; i++) g[i] = rand();
  return (u: number, v: number) => {
    const x = u * px;
    const y = v * py;
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = x - xi;
    const fy = y - yi;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const x0 = ((xi % px) + px) % px;
    const y0 = ((yi % py) + py) % py;
    const x1 = (x0 + 1) % px;
    const y1 = (y0 + 1) % py;
    const a = g[y0 * px + x0];
    const b = g[y0 * px + x1];
    const c = g[y1 * px + x0];
    const d = g[y1 * px + x1];
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
}

/** Fractal noise, 0..1. Each octave doubles the lattice so the sum still tiles. */
function fbm(rand: Rand, px: number, py: number, octaves: number) {
  const layers = Array.from({ length: octaves }, (_, o) => lattice(rand, px << o, py << o));
  return (u: number, v: number) => {
    let sum = 0;
    let amp = 0.5;
    let norm = 0;
    for (const n of layers) {
      sum += n(u, v) * amp;
      norm += amp;
      amp *= 0.5;
    }
    return sum / norm;
  };
}

const hex = (h: string): RGB => {
  const c = new THREE.Color(h);
  return [c.r * 255, c.g * 255, c.b * 255];
};
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Paints a color and a height channel per pixel, then wraps both as textures. */
function paint(size: number, fn: (u: number, v: number) => { c: RGB; h: number }) {
  const color = document.createElement("canvas");
  const height = document.createElement("canvas");
  color.width = color.height = height.width = height.height = size;
  const cctx = color.getContext("2d")!;
  const hctx = height.getContext("2d")!;
  const cimg = cctx.createImageData(size, size);
  const himg = hctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const { c, h } = fn(x / size, y / size);
      const i = (y * size + x) * 4;
      cimg.data[i] = c[0];
      cimg.data[i + 1] = c[1];
      cimg.data[i + 2] = c[2];
      cimg.data[i + 3] = 255;
      const hv = clamp01(h) * 255;
      himg.data[i] = himg.data[i + 1] = himg.data[i + 2] = hv;
      himg.data[i + 3] = 255;
    }
  }
  cctx.putImageData(cimg, 0, 0);
  hctx.putImageData(himg, 0, 0);
  return { map: wrap(color, true), bump: wrap(height, false) };
}

function wrap(canvas: HTMLCanvasElement, srgb: boolean) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export interface Surface {
  map: THREE.Texture;
  bump: THREE.Texture;
}

const cache = new Map<string, Surface>();

/** Each caller gets its own copy so it can set its own repeat; the pixels are shared. */
function cached(key: string, repeat: [number, number], make: () => Surface): Surface {
  let base = cache.get(key);
  if (!base) {
    base = make();
    cache.set(key, base);
  }
  const map = base.map.clone();
  const bump = base.bump.clone();
  map.repeat.set(...repeat);
  bump.repeat.set(...repeat);
  return { map, bump };
}

/* ── wood ─────────────────────────────────────────────────── */

/** Long grain along u: soft streaks, fine growth lines, and the odd darker band. */
function grain(rand: Rand, lines: number) {
  const streak = fbm(rand, 3, 48, 4);
  const warp = fbm(rand, 2, 6, 3);
  return (u: number, v: number, seed: number) => {
    const w = warp(u, v + seed) * 6;
    const rings = 0.5 + 0.5 * Math.sin((v * lines + w) * Math.PI * 2);
    const s = streak(u, v + seed * 0.37);
    return clamp01(0.45 * s + 0.55 * Math.pow(rings, 3) * (0.6 + 0.4 * s));
  };
}

/** Floorboards: `rows` boards across v, two boards per row along u, staggered joints. */
export function floorboards(repeat: [number, number], light = "#c9a27a", dark = "#8a6544") {
  return cached(`floor:${light}:${dark}`, repeat, () => {
    const rand = rng(11);
    const rows = 8;
    const g = grain(rand, 90);
    const offsets = Array.from({ length: rows }, () => rand());
    const tints = Array.from({ length: rows * 2 }, () => rand() * 0.22 - 0.11);
    const L = hex(light);
    const D = hex(dark);
    return paint(1024, (u, v) => {
      const row = Math.floor(v * rows);
      const fv = v * rows - row;
      const along = (u + offsets[row]) % 1;
      const board = row * 2 + (along < 0.5 ? 0 : 1);
      const t = g(along * 2 - Math.floor(along * 2), v, board * 0.173);
      let c = mix(D, L, t * 0.75 + 0.2);
      const k = 1 + tints[board];
      c = [c[0] * k, c[1] * k, c[2] * k];
      // seams between boards and at the butt joints
      const seam = Math.min(fv, 1 - fv) * rows * 1024; // px to the nearest long seam
      const joint = Math.min(Math.abs(along - 0.5), along, 1 - along) * 1024;
      const gap = Math.min(seam, joint);
      const shade = gap < 1.2 ? 0.45 : gap < 2.6 ? 0.8 : 1;
      return { c: [c[0] * shade, c[1] * shade, c[2] * shade], h: gap < 1.2 ? 0 : 0.35 + t * 0.5 };
    });
  });
}

/** Unbroken grain for solid pieces (table top, legs). `vertical` runs it along v. */
export function woodGrain(repeat: [number, number], light: string, dark: string, vertical = false) {
  return cached(`wood:${light}:${dark}:${vertical}`, repeat, () => {
    const rand = rng(23);
    const g = grain(rand, 60);
    const L = hex(light);
    const D = hex(dark);
    return paint(512, (u, v) => {
      const t = vertical ? g(v, u, 0) : g(u, v, 0);
      return { c: mix(D, L, 0.25 + t * 0.7), h: 0.3 + t * 0.6 };
    });
  });
}

/** Painted wood: the color is flat, the grain survives only in the bump. */
export function paintedWood(repeat: [number, number], color: string) {
  return cached(`painted:${color}`, repeat, () => {
    const rand = rng(31);
    const g = grain(rand, 40);
    const mottle = fbm(rand, 4, 4, 3);
    const C = hex(color);
    return paint(512, (u, v) => {
      const t = g(v, u, 0);
      const k = 0.94 + mottle(u, v) * 0.1 + t * 0.03;
      return { c: [C[0] * k, C[1] * k, C[2] * k], h: 0.4 + t * 0.35 };
    });
  });
}

/* ── walls ────────────────────────────────────────────────── */

/** Limewash: broad soft clouds of tone, and a fine trowel texture for the light to catch. */
export function plaster(repeat: [number, number], color: string) {
  return cached(`plaster:${color}`, repeat, () => {
    const rand = rng(47);
    const cloud = fbm(rand, 3, 3, 5);
    const fine = fbm(rand, 48, 48, 2);
    const C = hex(color);
    return paint(512, (u, v) => {
      const k = 0.95 + cloud(u, v) * 0.09;
      const f = fine(u, v);
      return { c: [C[0] * k, C[1] * k, C[2] * k], h: f * 0.7 + cloud(u, v) * 0.3 };
    });
  });
}

/** Tongue-and-groove paneling: vertical boards with a groove every 1/8. */
export function paneling(repeat: [number, number], color: string) {
  return cached(`panel:${color}`, repeat, () => {
    const rand = rng(53);
    const g = grain(rand, 30);
    const C = hex(color);
    return paint(512, (u, v) => {
      const fu = (u * 8) % 1;
      const edge = Math.min(fu, 1 - fu) * 64; // px to the groove
      const groove = edge < 1.5 ? 0.62 : edge < 3 ? 0.88 : 1;
      const k = groove * (0.97 + g(v, u, 0) * 0.05);
      return { c: [C[0] * k, C[1] * k, C[2] * k], h: edge < 1.5 ? 0 : 0.6 + g(v, u, 0) * 0.2 };
    });
  });
}

/* ── textiles ─────────────────────────────────────────────── */

/** Plain weave: warp and weft alternate over and under, with a little fiber fuzz. */
export function weave(repeat: [number, number], color: string) {
  return cached(`weave:${color}`, repeat, () => {
    const rand = rng(61);
    const fuzz = fbm(rand, 64, 64, 2);
    const slub = fbm(rand, 4, 64, 3);
    const C = hex(color);
    const N = 48;
    return paint(512, (u, v) => {
      const cu = Math.floor(u * N);
      const cv = Math.floor(v * N);
      const over = (cu + cv) % 2 === 0;
      const fu = u * N - cu;
      const fv = v * N - cv;
      const thread = over ? Math.sin(fv * Math.PI) : Math.sin(fu * Math.PI);
      const k = 0.8 + thread * 0.16 + fuzz(u, v) * 0.08 + (slub(u, v) - 0.5) * 0.08;
      return { c: [C[0] * k, C[1] * k, C[2] * k], h: thread * 0.8 + fuzz(u, v) * 0.2 };
    });
  });
}

/** A round braided rug for a circleGeometry: concentric braids in a few warm tones. */
export function braidedRug(colors: string[]) {
  return cached(`rug:${colors.join(",")}`, [1, 1], () => {
    const rand = rng(71);
    const fuzz = fbm(rand, 48, 48, 2);
    const C = colors.map(hex);
    const rings = 13;
    return paint(1024, (u, v) => {
      const dx = u - 0.5;
      const dy = v - 0.5;
      const r = Math.sqrt(dx * dx + dy * dy) * 2;
      const a = Math.atan2(dy, dx);
      const ring = Math.floor(r * rings);
      const fr = r * rings - ring;
      const base = C[(ring * 7 + (ring >> 1)) % C.length];
      // three strands twisting around each ring
      const braid = 0.5 + 0.5 * Math.sin(a * (40 + ring * 9) + (fr - 0.5) * 5 * (ring % 2 ? 1 : -1));
      const round = Math.sin(fr * Math.PI);
      const k = 0.72 + round * 0.2 + braid * 0.1 + fuzz(u, v) * 0.08;
      return { c: [base[0] * k, base[1] * k, base[2] * k], h: round * 0.7 + braid * 0.3 };
    });
  });
}

/* ── one-offs ─────────────────────────────────────────────── */

/** Dusk through the window: indigo overhead fading to peach at the horizon. */
export function duskSky(): THREE.Texture {
  const key = "sky";
  const hit = cache.get(key);
  if (hit) return hit.map;
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 512;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, "#2f3a78");
  g.addColorStop(0.45, "#7a6bb8");
  g.addColorStop(0.75, "#e79a9a");
  g.addColorStop(1, "#ffcf9e");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 512);
  // two soft clouds
  ctx.fillStyle = "rgba(255, 220, 210, 0.22)";
  for (const [x, y, w] of [
    [30, 300, 70],
    [90, 360, 50],
  ]) {
    ctx.beginPath();
    ctx.ellipse(x, y, w, 9, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, { map: t, bump: t });
  return t;
}

/** A small enamel plaque with the room's name, for the wall above the door. */
export function plaque(text: string): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#f4ede0";
  ctx.beginPath();
  ctx.roundRect(8, 8, 1008, 240, 120);
  ctx.fill();
  ctx.strokeStyle = "#b8925a";
  ctx.lineWidth = 10;
  ctx.stroke();
  ctx.fillStyle = "#2b2622";
  ctx.font = '600 104px -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 512, 136, 900);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
