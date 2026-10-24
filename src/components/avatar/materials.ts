import * as THREE from 'three';

/* 재질. Coastal World 캐릭터가 "비싸 보이는" 건 실루엣 가장자리의 밝은 림(rim)
   때문이다. MeshStandardMaterial에 프레넬 림 한 줄을 끼워 넣는다.
   색·종류별로 한 번만 만들어 모든 아바타가 같이 쓴다 (팔레트가 유한하다). */

export type MatKind = 'clay' | 'face' | 'ink' | 'glint' | 'blush' | 'plastic' | 'gold' | 'glow';

const SPEC: Record<MatKind, { roughness: number; rim: number }> = {
  clay:    { roughness: 0.6,  rim: 0.55 }, // 몸·팔·다리
  face:    { roughness: 0.34, rim: 0.18 }, // 얼굴판은 살짝 반들 — 화면처럼 보인다
  ink:     { roughness: 0.22, rim: 0 },    // 눈·입
  glint:   { roughness: 0.4,  rim: 0 },    // 눈 하이라이트
  blush:   { roughness: 1,    rim: 0 },
  plastic: { roughness: 0.38, rim: 0.3 },  // 안경·밑창·가방
  gold:    { roughness: 0.3,  rim: 0.6 },  // 왕관
  glow:    { roughness: 0.5,  rim: 0 },    // 후광
};

function addRim(mat: THREE.MeshStandardMaterial, strength: number) {
  if (strength <= 0) return;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uRim = { value: strength };
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'uniform float uRim;\nvoid main() {')
      .replace(
        '#include <opaque_fragment>',
        /* glsl */ `
        {
          vec3 vDir = normalize( vViewPosition );
          float fres = 1.0 - saturate( dot( normal, vDir ) );
          // 위에서 오는 빛을 받는 쪽 가장자리가 더 밝다
          float rim = smoothstep( 0.45, 1.0, fres ) * ( 0.55 + 0.45 * saturate( normal.y + 0.35 ) );
          outgoingLight += mix( vec3( 1.0, 0.97, 0.9 ), diffuseColor.rgb, 0.35 ) * rim * uRim;
        }
        #include <opaque_fragment>`,
      );
  };
  mat.customProgramCacheKey = () => `avatar-rim`;
}

const cache = new Map<string, THREE.MeshStandardMaterial>();

export function avatarMaterial(kind: MatKind, color: string) {
  const key = `${kind}:${color}`;
  let m = cache.get(key);
  if (m) return m;
  const { roughness, rim } = SPEC[kind];
  m = new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });
  if (kind === 'face') {
    // 몸통 곡면에서 3.5mm 떠 있지만 멀리서 깜빡이지 않도록 한 번 더 앞으로
    m.polygonOffset = true;
    m.polygonOffsetFactor = -1;
    m.polygonOffsetUnits = -2;
  }
  if (kind === 'blush') {
    m.transparent = true;
    m.opacity = 0.5;
    m.depthWrite = false;
    m.polygonOffset = true;
    m.polygonOffsetFactor = -2;
    m.polygonOffsetUnits = -4;
  }
  if (kind === 'glint') m.emissive = new THREE.Color('#ffffff').multiplyScalar(0.6);
  if (kind === 'gold') {
    // 환경맵이 없어서 금속성을 올리면 검게 죽는다. 살짝만 + 자체 발광으로 금빛을 낸다
    m.metalness = 0.2;
    m.emissive = new THREE.Color(color).multiplyScalar(0.14);
    m.side = THREE.DoubleSide; // 왕관 테는 뚜껑 없는 원통이라 안쪽 면도 보여야 한다
  }
  if (kind === 'glow') m.emissive = new THREE.Color(color).multiplyScalar(0.8);
  addRim(m, rim);
  cache.set(key, m);
  return m;
}
