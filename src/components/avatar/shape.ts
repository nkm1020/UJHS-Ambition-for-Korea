import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/* ──────────────────────────────────────────────────────────────
   아바타의 "모양"만 모아 둔 곳. 치수와 지오메트리를 여기서 정하고
   Avatar.tsx는 관절과 표정만 다룬다.

   몸통은 회전체 하나다. 얼굴판·눈·입·안경·벨트는 전부 이 곡면 위의
   점을 계산해서 붙이므로 머리에 "박혀" 보이고, 옆에서 봐도 뜨지 않는다.
   ────────────────────────────────────────────────────────────── */

/** 몸통을 앞뒤로 살짝 눌러 납작한 콩 모양으로 만든다 */
export const Z_SQUASH = 0.88;
/** 상체(머리+몸통)가 숙여지는 회전축 높이 = 엉덩이 */
export const HIP_Y = 0.68;
export const SHOULDER = { x: 0.292, y: 1.1 };
export const ARM = { upper: 0.3, fore: 0.26, r0: 0.045, r1: 0.039, r2: 0.034 };
/** 서 있을 때 발바닥이 정확히 y=0에 오도록 HIP_Y = thigh + shin + foot */
export const LEG = { x: 0.105, thigh: 0.3, shin: 0.3, foot: 0.08, r0: 0.064, r1: 0.05, r2: 0.04 };
/** 얼굴판: 정면에서 본 타원. a·b는 반지름 */
export const FACE = { y: 1.4, a: 0.232, b: 0.196 };
/** 앉은 포즈(sit·slump 등)의 팔이 올라가는 테이블 윗면 높이 (월드 y, 아바타 발이 y=0일 때) */
export const TABLE_TOP_Y = 0.62;
export const EYE = { x: 0.072, y: 1.432 };
export const MOUTH_Y = 1.346;
export const BLUSH = { x: 0.142, y: 1.37 };

/* 머리 꼭대기 → 어깨 → 엉덩이로 이어지는 옆선의 제어점 [y, r].
   반드시 아래 → 위 순서. 반대로 넣으면 LatheGeometry의 면이 안쪽을 향해서
   몸이 뒤집히고, 뒤에 있는 팔·얼굴이 몸을 뚫고 비쳐 보인다. */
const BODY_CTRL: [number, number][] = [
  [0.64, 0.0], [0.646, 0.105], [0.665, 0.185], [0.7, 0.236], [0.76, 0.266],
  [0.88, 0.289], [1.04, 0.311], [1.2, 0.331], [1.33, 0.342], [1.44, 0.338],
  [1.54, 0.315], [1.62, 0.272], [1.68, 0.205], [1.716, 0.126], [1.735, 0.055],
  [1.74, 0.0],
];

const bodyCurve = new THREE.SplineCurve(BODY_CTRL.map(([y, r]) => new THREE.Vector2(r, y)));
/** 렌더용 윤곽 (x = 반지름, y = 높이) */
const BODY_POINTS = bodyCurve.getSpacedPoints(96);
/** r(y) 조회용 촘촘한 표 */
const LOOKUP = bodyCurve.getSpacedPoints(600);

/** 높이 y에서 몸통 단면의 반지름 (눌리기 전) */
export function radiusAt(y: number): number {
  if (y <= LOOKUP[0].y) return 0;
  if (y >= LOOKUP[LOOKUP.length - 1].y) return 0;
  let lo = 0;
  let hi = LOOKUP.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (LOOKUP[mid].y < y) lo = mid;
    else hi = mid;
  }
  const a = LOOKUP[lo];
  const b = LOOKUP[hi];
  return THREE.MathUtils.lerp(a.x, b.x, (y - a.y) / (b.y - a.y || 1));
}

const slopeAt = (y: number) => (radiusAt(y + 0.002) - radiusAt(y - 0.002)) / 0.004;

/** 몸통 곡면 위의 점과 바깥 법선. phi = 0이 정면(+z). off만큼 법선 방향으로 띄운다. */
export function surfaceAt(phi: number, y: number, off = 0) {
  const r = radiusAt(y);
  const s = Math.sin(phi);
  const c = Math.cos(phi);
  // z를 눌렀으니 법선은 역행렬 전치로 z 성분이 커진다
  const normal = new THREE.Vector3(s, -slopeAt(y), c / Z_SQUASH).normalize();
  const point = new THREE.Vector3(r * s, y, r * c * Z_SQUASH).addScaledVector(normal, off);
  return { point, normal };
}

/** 정면에서 본 좌표 (x, y)에 해당하는 몸통 앞면의 점 */
export function surfaceFront(x: number, y: number, off = 0) {
  const r = Math.max(radiusAt(y), 1e-4);
  return surfaceAt(Math.asin(THREE.MathUtils.clamp(x / r, -1, 1)), y, off);
}

/** 곡면 위에 납작한 부품(눈·입·볼터치)을 붙일 위치와 방향. 로컬 +z가 법선, +y가 위쪽. */
export function placeOnFront(x: number, y: number, off: number) {
  const { point, normal } = surfaceFront(x, y, off);
  const right = new THREE.Vector3(0, 1, 0).cross(normal).normalize();
  const up = normal.clone().cross(right);
  const quaternion = new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(right, up, normal),
  );
  return { position: point, quaternion };
}

/* ── 지오메트리. 모양이 색과 무관하니 전부 한 번만 만들고 모든 아바타가 공유한다. ── */

function bodyGeometry() {
  const g = new THREE.LatheGeometry(BODY_POINTS, 72);
  g.scale(1, 1, Z_SQUASH);
  return g;
}

/** 얼굴판: 머리 곡면을 그대로 따라가는 타원 조각. 원판을 앞에 꽂으면 옆에서 떠 보인다. */
function facePatchGeometry(off: number) {
  const rings = 16;
  const segs = 72;
  const pos: number[] = [];
  const nrm: number[] = [];
  const idx: number[] = [];
  const push = (x: number, y: number) => {
    const { point, normal } = surfaceFront(x, y, off);
    pos.push(point.x, point.y, point.z);
    nrm.push(normal.x, normal.y, normal.z);
  };
  push(0, FACE.y);
  for (let k = 1; k <= rings; k++) {
    // 가장자리로 갈수록 링을 촘촘히 → 윤곽이 매끈하다
    const rho = Math.sin(((k / rings) * Math.PI) / 2);
    for (let s = 0; s < segs; s++) {
      const th = (s / segs) * Math.PI * 2;
      push(FACE.a * rho * Math.cos(th), FACE.y + FACE.b * rho * Math.sin(th));
    }
  }
  const at = (k: number, s: number) => 1 + (k - 1) * segs + (s % segs);
  for (let s = 0; s < segs; s++) idx.push(0, at(1, s), at(1, s + 1));
  for (let k = 1; k < rings; k++) {
    for (let s = 0; s < segs; s++) {
      const a = at(k, s), b = at(k, s + 1), c = at(k + 1, s + 1), d = at(k + 1, s);
      idx.push(a, d, c, a, c, b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setIndex(idx);
  return g;
}

/** 끝이 둥근 원뿔대 캡슐. 관절(0)에서 -y 방향으로 len만큼 뻗는다. */
function limbGeometry(r0: number, r1: number, len: number) {
  const pts: THREE.Vector2[] = [];
  const n = 10;
  for (let i = 0; i <= n; i++) {
    const a = -Math.PI / 2 + (i / n) * (Math.PI / 2);
    pts.push(new THREE.Vector2(r1 * Math.cos(a), -len + r1 * Math.sin(a)));
  }
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * (Math.PI / 2);
    pts.push(new THREE.Vector2(r0 * Math.cos(a), r0 * Math.sin(a)));
  }
  pts[0].x = 0;
  pts[pts.length - 1].x = 0;
  return new THREE.LatheGeometry(pts, 28);
}

/** 운동화 밑창: 모서리가 둥근 납작한 원판. 앞뒤로 늘려 쓴다. */
function soleGeometry() {
  const pts: THREE.Vector2[] = [new THREE.Vector2(0, -0.5)];
  for (let i = 0; i <= 8; i++) {
    const a = -Math.PI / 2 + (i / 8) * Math.PI;
    pts.push(new THREE.Vector2(0.78 + 0.22 * Math.cos(a), 0.5 * Math.sin(a)));
  }
  pts.push(new THREE.Vector2(0, 0.5));
  return new THREE.LatheGeometry(pts, 32);
}

/** 곡면을 따라가는 관(tube). 안경테·벨트처럼 머리에 감기는 부품에 쓴다. */
function tubeAlong(points: THREE.Vector3[], radius: number, closed = false) {
  const curve = new THREE.CatmullRomCurve3(points, closed, 'centripetal');
  return new THREE.TubeGeometry(curve, Math.max(24, points.length * 4), radius, 8, closed);
}

/** 관 끝을 막는 구 */
function cap(p: THREE.Vector3, radius: number) {
  return new THREE.SphereGeometry(radius, 10, 8).translate(p.x, p.y, p.z);
}

const GLASS_OFF = 0.03;

/** 둥근 사각형 윤곽을 정면 좌표로 뽑는다 */
function roundedRect(cx: number, cy: number, hw: number, hh: number, rad: number) {
  const out: [number, number][] = [];
  const corners: [number, number, number][] = [
    [cx + hw - rad, cy + hh - rad, 0],
    [cx - hw + rad, cy + hh - rad, Math.PI / 2],
    [cx - hw + rad, cy - hh + rad, Math.PI],
    [cx + hw - rad, cy - hh + rad, (Math.PI * 3) / 2],
  ];
  for (const [x, y, a0] of corners) {
    for (let i = 0; i <= 5; i++) {
      const a = a0 + (i / 5) * (Math.PI / 2);
      out.push([x + rad * Math.cos(a), y + rad * Math.sin(a)]);
    }
  }
  return out;
}

/** 안경다리: 렌즈 바깥 끝에서 머리 옆면을 따라 귀 쪽까지 */
function temples(y: number, fromX: number) {
  const parts: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    const phi0 = Math.asin(fromX / radiusAt(y));
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 10; i++) {
      const phi = phi0 + (i / 10) * (1.75 - phi0);
      pts.push(surfaceAt(side * phi, y, GLASS_OFF * (1 - i / 14)).point);
    }
    parts.push(tubeAlong(pts, 0.009), cap(pts[pts.length - 1], 0.009));
  }
  return parts;
}

/** 셔터 쉐이드: 테두리 + 가로 살. Coastal World 기본템 */
function shutterShadesGeometry() {
  const cy = EYE.y + 0.004;
  const parts: THREE.BufferGeometry[] = [];
  for (const cx of [-0.112, 0.112]) {
    const rim = roundedRect(cx, cy, 0.098, 0.06, 0.034).map(([x, y]) => surfaceFront(x, y, GLASS_OFF).point);
    parts.push(tubeAlong(rim, 0.011, true));
    for (const dy of [-0.03, -0.01, 0.01, 0.03]) {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 8; i++) pts.push(surfaceFront(cx - 0.09 + (i / 8) * 0.18, cy + dy, GLASS_OFF).point);
      parts.push(tubeAlong(pts, 0.0075));
    }
  }
  const bridge = [-0.016, 0, 0.016].map((x) => surfaceFront(x, cy + 0.012, GLASS_OFF + 0.004).point);
  parts.push(tubeAlong(bridge, 0.01));
  parts.push(...temples(cy + 0.02, 0.205));
  return mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)));
}

function roundGlassesGeometry() {
  const cy = EYE.y + 0.002;
  const parts: THREE.BufferGeometry[] = [];
  for (const cx of [-0.086, 0.086]) {
    const ring: THREE.Vector3[] = [];
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      ring.push(surfaceFront(cx + 0.064 * Math.cos(a), cy + 0.06 * Math.sin(a), GLASS_OFF * 0.75).point);
    }
    parts.push(tubeAlong(ring, 0.0095, true));
  }
  const bridge: THREE.Vector3[] = [];
  for (let i = 0; i <= 6; i++) {
    const x = -0.024 + (i / 6) * 0.048;
    bridge.push(surfaceFront(x, cy + 0.012 + 0.008 * Math.sin((i / 6) * Math.PI), GLASS_OFF * 0.75 + 0.004).point);
  }
  parts.push(tubeAlong(bridge, 0.008));
  parts.push(...temples(cy + 0.01, 0.15));
  return mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)));
}

const BELT_Y = 0.79;

/** 패니팩: 허리를 감는 벨트 + 앞쪽 주머니 + 지퍼 */
function bagGeometries() {
  const belt: THREE.Vector3[] = [];
  for (let i = 0; i < 48; i++) belt.push(surfaceAt((i / 48) * Math.PI * 2, BELT_Y, 0.012).point);
  const front = surfaceFront(0, BELT_Y - 0.022, 0.012);
  const c = front.point.clone().addScaledVector(front.normal, 0.012);
  const A = 0.135, B = 0.07, C = 0.062;
  const pouch = new THREE.SphereGeometry(1, 32, 20).scale(A, B, C).translate(c.x, c.y, c.z);
  const zip: THREE.Vector3[] = [];
  const v = 0.42;
  for (let i = 0; i <= 12; i++) {
    const u = -1.15 + (i / 12) * 2.3;
    zip.push(new THREE.Vector3(c.x + A * Math.cos(v) * Math.sin(u), c.y + B * Math.sin(v), c.z + C * Math.cos(v) * Math.cos(u)));
  }
  const zipper = mergeGeometries([
    tubeAlong(zip, 0.0055).toNonIndexed(),
    new THREE.CapsuleGeometry(0.008, 0.018, 3, 8).translate(zip[2].x, zip[2].y - 0.016, zip[2].z + 0.008).toNonIndexed(),
  ]);
  return { belt: tubeAlong(belt, 0.02, true), pouch, zipper };
}

const SHOE = { x: 0.062, y: 0.068, z: 0.104 };

function shoeUpperGeometry() {
  // 위쪽 반구만 → 밑창 위에 덮어씌운다
  return new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2).scale(SHOE.x, SHOE.y, SHOE.z);
}

/** 신발끈 두 줄: 앞코 곡면을 따라 가로로 감긴다 */
function lacesGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  for (const z of [0.042, 0.068]) {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 8; i++) {
      const x = -0.03 + (i / 8) * 0.06;
      const h = 1 - (x / SHOE.x) ** 2 - (z / SHOE.z) ** 2;
      pts.push(new THREE.Vector3(x, SHOE.y * Math.sqrt(Math.max(h, 0)) + 0.002, z));
    }
    parts.push(tubeAlong(pts, 0.0062).toNonIndexed(), cap(pts[0], 0.0062).toNonIndexed(), cap(pts[8], 0.0062).toNonIndexed());
  }
  return mergeGeometries(parts);
}

let cached: ReturnType<typeof build> | null = null;

function build() {
  return {
    body: bodyGeometry(),
    face: facePatchGeometry(0.0035),
    upperArm: limbGeometry(ARM.r0, ARM.r1, ARM.upper),
    foreArm: limbGeometry(ARM.r1, ARM.r2, ARM.fore),
    thigh: limbGeometry(LEG.r0, LEG.r1, LEG.thigh),
    shin: limbGeometry(LEG.r1, LEG.r2, LEG.shin),
    // 손: 납작한 벙어리장갑 + 엄지
    palm: new THREE.SphereGeometry(1, 20, 14).scale(0.026, 0.05, 0.04),
    thumb: new THREE.CapsuleGeometry(0.0145, 0.026, 4, 10),
    sole: soleGeometry(),
    shoeUpper: shoeUpperGeometry(),
    laces: lacesGeometry(),
    eyeDot: new THREE.CapsuleGeometry(0.0205, 0.03, 6, 14).scale(1, 1, 0.5),
    eyeArc: new THREE.TorusGeometry(0.033, 0.0105, 8, 20, Math.PI),
    eyeGlint: new THREE.SphereGeometry(0.0068, 10, 8),
    blush: new THREE.CircleGeometry(0.036, 24),
    shutter: shutterShadesGeometry(),
    round: roundGlassesGeometry(),
    ...bagGeometries(),
  };
}

/** 모든 아바타가 공유하는 지오메트리 묶음 (처음 부를 때 한 번 만든다) */
export function avatarGeometries() {
  if (!cached) cached = build();
  return cached;
}

const mouthCache = new Map<number, THREE.TorusGeometry>();
/** 입: 토러스 호. arc = 호의 길이 (2π면 동그란 O) */
export function mouthGeometry(arc: number) {
  let g = mouthCache.get(arc);
  if (!g) {
    g = new THREE.TorusGeometry(0.042, 0.0108, 8, 28, arc);
    mouthCache.set(arc, g);
  }
  return g;
}
