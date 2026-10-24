import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { HairName } from '@/lib/types';

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
  return { position: point, quaternion: frameAt(normal) };
}

function frameAt(normal: THREE.Vector3) {
  const right = new THREE.Vector3(0, 1, 0).cross(normal).normalize();
  const up = normal.clone().cross(right);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, normal));
}

/* 머리 꼭대기는 거의 평평해서 높이 y로는 점을 고를 수 없다. LOOKUP은 옆선을
   같은 길이로 나눈 점들이라, 인덱스(0 = 밑, ARC_N = 정수리)로 고르면
   정수리까지 고르게 덮인다. 헤어·모자 껍데기는 이걸 쓴다. */
const ARC_N = LOOKUP.length - 1;
const ARC_PER_M = ARC_N / bodyCurve.getLength();

/** 높이 y의 옆선 인덱스 (소수) */
function arcIndexAtY(y: number): number {
  if (y <= LOOKUP[0].y) return 0;
  if (y >= LOOKUP[ARC_N].y) return ARC_N;
  let lo = 0;
  let hi = ARC_N;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (LOOKUP[mid].y < y) lo = mid;
    else hi = mid;
  }
  return lo + (y - LOOKUP[lo].y) / (LOOKUP[hi].y - LOOKUP[lo].y || 1);
}

/** surfaceAt과 같지만 높이 대신 옆선 인덱스로 고른다. 정수리(ARC_N)에서도 법선이 위를 향한다. */
function surfaceArc(phi: number, i: number, off = 0) {
  const i0 = THREE.MathUtils.clamp(Math.floor(i), 0, ARC_N - 1);
  const t = THREE.MathUtils.clamp(i - i0, 0, 1);
  const a = LOOKUP[i0];
  const b = LOOKUP[i0 + 1];
  const pa = LOOKUP[Math.max(i0 - 1, 0)];
  const pb = LOOKUP[Math.min(i0 + 2, ARC_N)];
  const r = THREE.MathUtils.lerp(a.x, b.x, t);
  const y = THREE.MathUtils.lerp(a.y, b.y, t);
  // 옆선 접선 (dr, dy) → 바깥 법선 (dy, -dr)
  const len = Math.hypot(pb.x - pa.x, pb.y - pa.y) || 1;
  const nr = (pb.y - pa.y) / len;
  const ny = -(pb.x - pa.x) / len;
  const s = Math.sin(phi);
  const c = Math.cos(phi);
  const normal = new THREE.Vector3(nr * s, ny, (nr * c) / Z_SQUASH).normalize();
  const point = new THREE.Vector3(r * s, y, r * c * Z_SQUASH).addScaledVector(normal, off);
  return { point, normal };
}

const smooth = (e0: number, e1: number, x: number) => {
  const t = THREE.MathUtils.clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

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

/** 크로스백: 오른쪽 어깨에서 왼쪽 엉덩이로 비스듬히 감기는 끈 + 엉덩이의 작은 가방 */
function crossbodyGeometries() {
  // 캐릭터 기준 오른쪽(-x)이 높고 왼쪽(+x) 엉덩이로 내려간다
  const strapY = (phi: number) => 1.0 - 0.2 * Math.sin(phi);
  const strap: THREE.Vector3[] = [];
  for (let i = 0; i < 64; i++) {
    const phi = (i / 64) * Math.PI * 2;
    strap.push(surfaceAt(phi, strapY(phi), 0.012).point);
  }
  const at = surfaceAt(0.82, 0.8, 0.045);
  const q = frameAt(at.normal);
  const place = (g: THREE.BufferGeometry) => g.applyQuaternion(q).translate(at.point.x, at.point.y, at.point.z);
  const pouch = place(new RoundedBoxGeometry(0.17, 0.14, 0.06, 3, 0.026));
  const flap = place(new RoundedBoxGeometry(0.172, 0.06, 0.012, 2, 0.006).translate(0, 0.042, 0.03));
  const button = place(new THREE.SphereGeometry(0.013, 10, 8).scale(1, 1, 0.6).translate(0, 0.014, 0.038));
  return { crossStrap: tubeAlong(strap, 0.014, true), crossPouch: merge([pouch, flap]), crossButton: button };
}

/** (phi, y) 제어점을 매끈한 곡선으로 이은 뒤 곡면에 붙여 촘촘히 따라가는 점들 */
function surfacePath(ctrl: [number, number][], off: number, closed: boolean, samples = 96) {
  const curve = new THREE.CatmullRomCurve3(ctrl.map(([phi, y]) => new THREE.Vector3(phi, y, 0)), closed, 'centripetal');
  const pts = curve.getSpacedPoints(samples);
  if (closed) pts.pop(); // 닫힌 곡선은 끝점 = 시작점
  return pts.map((p) => surfaceAt(p.x, p.y, off).point);
}

/** 백팩: 등에 메는 가방 + 앞주머니 + 손잡이, 가슴 앞으로 보이는 멜빵 두 줄 */
function backpackGeometries() {
  const y = 1.0;
  const backZ = surfaceAt(Math.PI, y).point.z;
  const cz = backZ + 0.05 - 0.085; // 등 곡면에 살짝 묻혀야 옆에서 틈이 안 보인다
  const pack = new RoundedBoxGeometry(0.4, 0.44, 0.17, 4, 0.07).translate(0, y, cz);
  const pocket = new RoundedBoxGeometry(0.27, 0.17, 0.06, 3, 0.026).translate(0, y - 0.09, cz - 0.1);
  const handle = new THREE.TorusGeometry(0.05, 0.012, 8, 16, Math.PI).translate(0, y + 0.215, cz);
  const zip: THREE.Vector3[] = [];
  for (let i = 0; i <= 8; i++) zip.push(new THREE.Vector3(-0.1 + (i / 8) * 0.2, y - 0.02, cz - 0.131 - 0.004 * Math.sin((i / 8) * Math.PI)));
  // 멜빵: 팔이 붙은 자리를 한 바퀴 감는다. 어깨 위 → 가슴 → 겨드랑이 밑 → 등(가방 속) → 다시 어깨 위
  const straps = ([-1, 1] as const).map((sd) =>
    tubeAlong(
      surfacePath(
        [[sd * 0.95, 1.31], [sd * 0.64, 1.12], [sd * 0.62, 1.0], [sd * 1.35, 0.95], [sd * 2.6, 0.95], [sd * 2.6, 1.18], [sd * 1.6, 1.36]],
        0.014,
        true,
      ),
      0.016,
      true,
    ),
  );
  return {
    pack: merge([pack, pocket, handle]),
    packStraps: merge(straps),
    packZip: tubeAlong(zip, 0.0065),
  };
}

/* ── 헤어 ── */

/** 머리를 덮는 껍데기 (단발·비니). 아래 가장자리 높이 edge(phi)에서 정수리까지, 법선으로 off(t)만큼 띄운다. t: 0 = 가장자리, 1 = 정수리 */
function headShell(edge: (phi: number) => number, off: (t: number) => number, segs = 72, rows = 24) {
  const pos: number[] = [];
  const nrm: number[] = [];
  const idx: number[] = [];
  for (let j = 0; j <= rows; j++) {
    const t = j / rows;
    for (let k = 0; k <= segs; k++) {
      const phi = -Math.PI + (k / segs) * Math.PI * 2;
      const i0 = arcIndexAtY(edge(phi));
      const { point, normal } = surfaceArc(phi, i0 + (ARC_N - i0) * t, off(t));
      pos.push(point.x, point.y, point.z);
      nrm.push(normal.x, normal.y, normal.z);
    }
  }
  for (let j = 0; j < rows; j++) {
    for (let k = 0; k < segs; k++) {
      const a = j * (segs + 1) + k;
      const b = a + 1;
      const c = a + segs + 1;
      const d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setIndex(idx);
  return g;
}

/** 껍데기 가장자리를 따라 도는 고리. 두께가 있어 보이게 한다 */
function edgeRing(edge: (phi: number) => number, off: number, radius: number, lift = 0) {
  const pts: THREE.Vector3[] = [];
  for (let k = 0; k < 72; k++) {
    const phi = -Math.PI + (k / 72) * Math.PI * 2;
    pts.push(surfaceArc(phi, arcIndexAtY(edge(phi)) + lift * ARC_PER_M, off).point);
  }
  return tubeAlong(pts, radius, true);
}

/** 굵기가 줄어드는 관. 머리카락 가닥 */
function taperedTube(points: THREE.Vector3[], r0: number, r1: number, segs = 20, radial = 8) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const g = new THREE.TubeGeometry(curve, segs, 1, radial, false);
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const c = curve.getPointAt(i / segs);
    const r = THREE.MathUtils.lerp(r0, r1, i / segs);
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      v.fromBufferAttribute(pos, k).sub(c).multiplyScalar(r).add(c);
      pos.setXYZ(k, v.x, v.y, v.z);
    }
  }
  return g;
}

/** 단발: 앞머리는 얼굴판 위에서, 옆·뒤는 귀 아래까지 */
const bobEdge = (phi: number) => {
  const a = Math.abs(phi);
  return 1.6 - 0.3 * smooth(0.55, 1.6, a) + 0.01 * Math.sin(phi * 18) * (1 - smooth(0.3, 0.7, a));
};

/** 곱슬: 앞은 이마 위, 뒤로 갈수록 낮게 */
const curlEdge = (phi: number) => 1.62 - 0.26 * smooth(0.55, 2.4, Math.abs(phi));

/** 삐죽 머리: 짧게 깎은 밑머리 */
const spikyEdge = (phi: number) => 1.58 - 0.18 * smooth(0.55, 2.4, Math.abs(phi));

/** 비니 아랫단 */
const beanieEdge = (phi: number) => 1.575 - 0.05 * smooth(0.6, 2.6, Math.abs(phi));

function curlSpheres() {
  const out: { p: THREE.Vector3; r: number; phi: number }[] = [];
  const rows = 6;
  for (let j = 0; j <= rows; j++) {
    const t = j / rows;
    const iSide = arcIndexAtY(curlEdge(Math.PI / 2));
    const ring = LOOKUP[Math.round(iSide + (ARC_N - iSide) * t)].x;
    const n = Math.max(1, Math.round((2 * Math.PI * ring) / 0.1));
    for (let k = 0; k < n; k++) {
      const phi = -Math.PI + ((k + (j % 2) * 0.5) / n) * Math.PI * 2;
      const i0 = arcIndexAtY(curlEdge(phi));
      const jitter = Math.abs(Math.sin(j * 12.9898 + k * 78.233) * 43758.5453) % 1;
      out.push({ p: surfaceArc(phi, i0 + (ARC_N - i0) * t, 0.035).point, r: 0.06 + 0.014 * jitter, phi });
    }
  }
  return out;
}

function hairGeometries() {
  const tuft = merge(
    [
      [[0, 1.715, 0.02], [0.004, 1.8, 0.012], [0.036, 1.862, 0.042], [0.03, 1.874, 0.088]],
      [[-0.018, 1.715, 0], [-0.042, 1.785, -0.012], [-0.08, 1.812, 0.018]],
      [[0.02, 1.715, -0.022], [0.05, 1.776, -0.044], [0.088, 1.796, -0.024]],
    ].map((pts, i) => taperedTube(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)), i ? 0.024 : 0.03, 0.005)),
  );

  const buns = merge(
    ([-1, 1] as const).flatMap((sd) => {
      const { point, normal } = surfaceArc(sd * 1.75, arcIndexAtY(1.65), 0.05);
      const bun = new THREE.SphereGeometry(0.088, 24, 18).translate(point.x, point.y, point.z);
      // 머리끈: 경단 밑동을 감는 고리
      const tie = new THREE.TorusGeometry(0.072, 0.014, 8, 24)
        .applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal))
        .translate(point.x - normal.x * 0.036, point.y - normal.y * 0.036, point.z - normal.z * 0.036);
      return [bun, tie];
    }),
  );

  const bobOff = (t: number) => 0.022 + 0.014 * (1 - t) ** 2;
  const bob = merge([headShell(bobEdge, bobOff), edgeRing(bobEdge, bobOff(0) * 0.5, 0.02)]);

  // 삐죽 머리: 짧은 밑머리 위로 뿔이 정수리를 둘러 세 겹. 정면에서도 여러 개가 보인다
  const spikyOff = () => 0.018;
  const spikyCap = merge([headShell(spikyEdge, spikyOff), edgeRing(spikyEdge, 0.009, 0.011)]);
  const spikes: THREE.BufferGeometry[] = [];
  for (const [t, n, h, turn] of [[1, 1, 0.15, 0], [0.62, 5, 0.15, 0.5], [0.24, 8, 0.12, 0]] as const) {
    for (let k = 0; k < n; k++) {
      const phi = -Math.PI + ((k + turn) / n) * Math.PI * 2;
      const i0 = arcIndexAtY(spikyEdge(phi));
      const { point, normal } = surfaceArc(phi, i0 + (ARC_N - i0) * t, 0.005);
      const dir = normal.clone().add(new THREE.Vector3(0, 0.55, 0)).normalize(); // 위로 솟게
      const len = h * (0.85 + 0.3 * ((Math.sin(k * 7.3 + t * 11) + 1) / 2));
      spikes.push(
        new THREE.ConeGeometry(0.06, len, 12)
          .translate(0, len / 2, 0)
          .applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir))
          .translate(point.x, point.y, point.z),
      );
    }
  }

  const curls = curlSpheres();
  const ball = (c: { p: THREE.Vector3; r: number }) => new THREE.SphereGeometry(c.r, 12, 9).translate(c.p.x, c.p.y, c.p.z);

  return {
    tuft,
    buns,
    bob,
    spiky: merge([spikyCap, ...spikes]),
    // 비니를 쓰면 뿔은 눌리고 밑머리만 비니 아래로 보인다
    spikyUnderHat: spikyCap,
    curls: mergeGeometries(curls.map(ball)),
    // 비니를 쓰면 비니 아래로 삐져나오는 곱슬만
    curlsUnderHat: mergeGeometries(curls.filter((c) => c.p.y < beanieEdge(c.phi) - 0.03).map(ball)),
  } satisfies Record<Exclude<HairName, 'none'> | 'curlsUnderHat' | 'spikyUnderHat', THREE.BufferGeometry>;
}

/** 크라운·후광을 머리카락 위로 올리는 높이 */
export const HAIR_LIFT: Record<HairName, number> = { none: 0, tuft: 0, buns: 0, bob: 0.028, spiky: 0.06, curls: 0.09 };
/** 크라운 밑단 높이 (머리카락 없을 때) */
export const CROWN_Y = 1.712;
export const HALO_Y = 1.95;

/* ── 모자 ── */

function hatGeometries() {
  // 정수리 쪽으로 갈수록 머리에서 떠서 비니다운 돔이 된다 (머리 꼭대기가 납작해서)
  const beanieOff = (t: number) => 0.035 + 0.11 * t ** 1.6;
  const beanie = headShell(beanieEdge, beanieOff);
  // 접어 올린 밑단: 고리 두 줄
  const cuff = merge([edgeRing(beanieEdge, 0.036, 0.026), edgeRing(beanieEdge, 0.04, 0.026, 0.042)]);
  const top = surfaceArc(0, ARC_N, beanieOff(1) + 0.045).point;
  const pompom = new THREE.SphereGeometry(0.066, 20, 14).scale(1, 0.9, 1).translate(top.x, top.y, top.z);

  // 헤드폰: 정수리를 넘는 밴드 + 양쪽 귀 컵 (컵 안쪽은 어두운 쿠션)
  const cupY = 1.42;
  const iBand = arcIndexAtY(cupY + 0.06);
  const band: THREE.Vector3[] = [];
  for (let k = 0; k <= 16; k++) band.push(surfaceArc(Math.PI / 2, iBand + (ARC_N - iBand) * (k / 16), 0.06).point);
  for (let k = 15; k >= 0; k--) band.push(surfaceArc(-Math.PI / 2, iBand + (ARC_N - iBand) * (k / 16), 0.06).point);
  const side = radiusAt(cupY);
  const cups = ([-1, 1] as const).map((sd) =>
    new THREE.CylinderGeometry(0.085, 0.085, 0.06, 28).rotateZ(Math.PI / 2).translate(sd * (side + 0.065), cupY, 0),
  );
  const pads = ([-1, 1] as const).map((sd) =>
    new THREE.CylinderGeometry(0.074, 0.074, 0.03, 28).rotateZ(Math.PI / 2).translate(sd * (side + 0.026), cupY, 0),
  );

  // 왕관: 머리 위에 얹는 금테 + 뿔 다섯 + 끝의 구슬. 원점이 밑단 가운데
  const crownParts: THREE.BufferGeometry[] = [new THREE.CylinderGeometry(0.152, 0.138, 0.075, 40, 1, true).translate(0, 0.0375, 0)];
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    const x = 0.148 * Math.sin(a);
    const z = 0.148 * Math.cos(a);
    crownParts.push(new THREE.ConeGeometry(0.03, 0.075, 12).translate(x, 0.075 + 0.0375, z));
    crownParts.push(new THREE.SphereGeometry(0.015, 10, 8).translate(x, 0.155, z));
  }

  return {
    beanie: merge([beanie, cuff, pompom]),
    headphones: merge([tubeAlong(band, 0.02), ...cups]),
    headphonePads: merge(pads),
    crown: merge(crownParts),
    crownGem: new THREE.SphereGeometry(0.022, 14, 10).scale(1, 1, 0.55).translate(0, 0.04, 0.146),
    halo: new THREE.TorusGeometry(0.17, 0.02, 12, 48).rotateX(Math.PI / 2),
  };
}

/** 색 없는 지오메트리끼리 합친다 (uv는 안 쓴다) */
function merge(parts: THREE.BufferGeometry[]) {
  return mergeGeometries(
    parts.map((p) => {
      const g = p.index ? p.toNonIndexed() : p;
      g.deleteAttribute('uv');
      return g;
    }),
  );
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
    ...crossbodyGeometries(),
    ...backpackGeometries(),
    hair: hairGeometries(),
    ...hatGeometries(),
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
