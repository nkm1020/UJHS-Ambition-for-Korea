'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { AvatarConfig, FaceName, PoseName } from '@/lib/types';
import { DEFAULT_AVATAR } from '@/lib/avatar';
import {
  ARM, BLUSH, EYE, HIP_Y, LEG, MOUTH_Y, SHOULDER,
  avatarGeometries, mouthGeometry, placeOnFront,
} from './shape';
import { avatarMaterial } from './materials';

/* ──────────────────────────────────────────────────────────────
   관절. 뼈대(skeleton) 없이 group 회전만 바꾼다.
   팔에는 팔꿈치·손목이, 다리에는 무릎·발목이 있다. 상체는 엉덩이를
   축으로 숙여지므로 엎드려도 다리에서 떨어지지 않는다.
   ────────────────────────────────────────────────────────────── */
type Joints = {
  rootY: number;    // 전체 높이 (앉으면 내려간다)
  rootRotY: number; // 몸 전체 돌리기 (등 돌리기)
  lean: number;     // 상체 앞(+)/뒤(-)로 숙이기
  tilt: number;     // 상체 옆으로 갸웃
  yaw: number;      // 상체를 돌려 쳐다보기 (+ = 캐릭터의 왼쪽). 머리와 몸통이 한 덩어리라 몸째 돈다
  // 팔: X 음수 = 앞으로 듦, Z 양수 = 바깥으로 벌림
  // 팔꿈치: X 음수 = 굽힘, Z 양수 = 바깥으로 꺾음 / 손목: 비틀기 (양쪽 같은 부호 = 대칭)
  armLX: number; armLZ: number; elbowLX: number; elbowLZ: number; wristL: number;
  armRX: number; armRZ: number; elbowRX: number; elbowRZ: number; wristR: number;
  // 다리: 엉덩이 X 음수 = 허벅지 앞으로, 무릎 X 양수 = 정강이 뒤로 (사람 무릎 방향)
  hipLX: number; hipRX: number; kneeLX: number; kneeRX: number;
};

const BASE: Joints = {
  rootY: 0, rootRotY: 0, lean: 0, tilt: 0, yaw: 0,
  armLX: 0.04, armLZ: 0.1, elbowLX: -0.16, elbowLZ: 0, wristL: 0,
  armRX: 0.04, armRZ: 0.1, elbowRX: -0.16, elbowRZ: 0, wristR: 0,
  hipLX: 0, hipRX: 0, kneeLX: 0, kneeRX: 0,
};

/** 앉은 자세 공통. 엉덩이 높이 0.40 = 의자 높이, 발바닥은 바닥에 닿는다. */
const SEATED = { rootY: -0.28, hipLX: -1.5, hipRX: -1.5, kneeLX: 1.5, kneeRX: 1.5 } as const;

type ArmSet = [x: number, z: number, elbowX: number, elbowZ: number, wrist: number];
const armL = ([x, z, ex, ez, w]: ArmSet) => ({ armLX: x, armLZ: z, elbowLX: ex, elbowLZ: ez, wristL: w });
const armR = ([x, z, ex, ez, w]: ArmSet) => ({ armRX: x, armRZ: z, elbowRX: ex, elbowRZ: ez, wristR: w });
const arms = (a: ArmSet) => ({ ...armL(a), ...armR(a) });

/* 팔 각도는 손이 닿아야 할 곳(테이블 위, 입, 가슴 앞)을 정해 두고
   몸통을 뚫지 않는 조건으로 역산한 값이다. 손대면 손이 몸에 박힐 수 있다.
   테이블 윗면은 TABLE_TOP_Y(shape.ts) 기준. */
const ON_TABLE: ArmSet = [-0.99, 0.23, -0.68, -0.84, 1.41];

/** 포즈 프리셋. 여기에 한 줄 추가하면 새 몸짓이 생긴다. */
const POSES: Record<PoseName, Partial<Joints>> = {
  idle: {},
  walk: {}, // 다리·팔은 useFrame에서 sin으로 덮어쓴다
  walkAway: { rootRotY: Math.PI }, // 등을 돌리고 걷는다
  sit: { ...SEATED, ...arms(ON_TABLE) },
  // 왼손은 테이블, 오른손은 들어서 말하는 손짓 (useFrame에서 흔든다)
  sitTalk: { ...SEATED, lean: 0.14, ...armL([-1.15, 0.21, -0.67, -0.94, 1.41]), ...armR([-0.85, 0.3, -1.3, -0.25, 0.7]) },
  // 테이블 위에 팔을 포개고 얼굴을 묻는다. away의 기본 자세.
  slump: { ...SEATED, lean: 0.5, tilt: 0.1, ...arms([-1.69, 0.08, -0.42, -1.2, 1.52]) },
  stare: { ...SEATED, lean: 0.1, tilt: -0.07, ...arms([-1.1, 0.21, -0.66, -0.85, 1.42]) },
  // 화들짝: 상체를 뒤로 젖히며 두 손을 번쩍 (튀어오름은 useFrame)
  startle: { ...SEATED, lean: -0.25, ...arms([-0.54, 2.58, -1.63, 0.05, -0.88]) },
  coverMouth: { ...SEATED, lean: 0.1, ...armL([-1.89, 0.14, -1.13, -1.2, -1.51]), ...armR(ON_TABLE) },
  heart: { ...SEATED, lean: 0.06, ...arms([-1.31, 0.15, -1.16, -1.2, -0.97]) },
  // 뒤로 젖히며 박수 (박수·들썩임은 useFrame)
  laugh: { ...SEATED, lean: -0.3, ...arms([-1.11, 0.15, -1.43, -1.2, -0.37]) },
};

/* ──────────────────────────────────────────────────────────────
   표정. 눈·입을 "모양"으로 안 만들고 scale/rotation 숫자로만 바꾼다.
   ────────────────────────────────────────────────────────────── */
type FaceSpec = {
  eyeArc: boolean;              // true면 ^^ 아치눈, false면 점눈
  eyeSX: number; eyeSY: number;
  browY?: number;               // 눈 높이 (놀람은 위로)
  mouthArc: number;             // 토러스 호의 길이 (2π = 완전한 O)
  mouthRot: number;             // π = 아래로 볼록(웃음), 0 = 위로 볼록(울상)
  mouthSX: number; mouthSY: number;
  wink?: boolean;               // 한쪽 눈만 감기
};

const FACES: Record<FaceName, FaceSpec> = {
  neutral: { eyeArc: false, eyeSX: 1,   eyeSY: 1,    mouthArc: Math.PI * 0.75, mouthRot: Math.PI, mouthSX: 1,    mouthSY: 1 },
  happy:   { eyeArc: true,  eyeSX: 1.1, eyeSY: 1,    mouthArc: Math.PI * 0.9,  mouthRot: Math.PI, mouthSX: 1.25, mouthSY: 1.3 },
  shock:   { eyeArc: false, eyeSX: 1.5, eyeSY: 1.5,  browY: 0.012,             mouthArc: Math.PI * 2, mouthRot: 0, mouthSX: 0.55, mouthSY: 0.75 },
  blank:   { eyeArc: false, eyeSX: 1,   eyeSY: 0.22, mouthArc: Math.PI * 0.8,  mouthRot: Math.PI, mouthSX: 1.1,  mouthSY: 0.1 },
  sad:     { eyeArc: false, eyeSX: 1,   eyeSY: 1.1,  browY: -0.01,             mouthArc: Math.PI * 0.7, mouthRot: 0, mouthSX: 1, mouthSY: 0.9 },
  smirk:   { eyeArc: false, eyeSX: 1,   eyeSY: 1,    wink: true,               mouthArc: Math.PI * 0.6, mouthRot: Math.PI * 1.18, mouthSX: 1.1, mouthSY: 1 },
};

// 얼굴 부품 자리: 머리 곡면 위의 점 + 그 점의 법선 방향
const EYE_SPOT = [placeOnFront(-EYE.x, EYE.y, 0.0075), placeOnFront(EYE.x, EYE.y, 0.0075)] as const;
const MOUTH_SPOT = placeOnFront(0, MOUTH_Y, 0.0068);
const BLUSH_SPOT = [placeOnFront(-BLUSH.x, BLUSH.y, 0.0052), placeOnFront(BLUSH.x, BLUSH.y, 0.0052)] as const;

const SOLE_COLOR = '#F7F4EE';
const INK = '#262636';

export interface AvatarProps {
  config?: AvatarConfig;
  pose?: PoseName;
  face?: FaceName;
  /** 캐릭터마다 다른 값을 주면 숨쉬기·눈깜빡임이 서로 어긋나 "살아있어" 보인다. */
  seed?: number;
  /** 말하는 중이면 입이 움직인다 */
  talking?: boolean;
  /** 입 벌림 0..1을 매 프레임 읽는다 (원탁 재생기의 getTalkLevel). 주면 talking보다 우선한다. */
  talkLevel?: () => number;
  /** 쳐다볼 방향, 라디안. + = 캐릭터의 왼쪽 (motion engine의 headYaw와 같은 규칙). 엎드려 있을 땐 무시 */
  lookYaw?: number;
}

type GroupRef = React.RefObject<THREE.Group | null>;

export function Avatar({
  config = DEFAULT_AVATAR,
  pose = 'idle',
  face = 'neutral',
  seed = 0,
  talking = false,
  talkLevel,
  lookYaw = 0,
}: AvatarProps) {
  const root = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);
  const shL = useRef<THREE.Group>(null);
  const shR = useRef<THREE.Group>(null);
  const elL = useRef<THREE.Group>(null);
  const elR = useRef<THREE.Group>(null);
  const handL = useRef<THREE.Group>(null);
  const handR = useRef<THREE.Group>(null);
  const hipL = useRef<THREE.Group>(null);
  const hipR = useRef<THREE.Group>(null);
  const kneeL = useRef<THREE.Group>(null);
  const kneeR = useRef<THREE.Group>(null);
  const ankleL = useRef<THREE.Group>(null);
  const ankleR = useRef<THREE.Group>(null);
  const eyeL = useRef<THREE.Group>(null);
  const eyeR = useRef<THREE.Group>(null);
  const mouth = useRef<THREE.Mesh>(null);

  // 현재 관절값. 목표값으로 매 프레임 damp 되면서 따라간다 = 크로스페이드.
  const cur = useRef<Joints>({ ...BASE });
  const blink = useRef({ next: 1 + ((seed * 0.618) % 1) * 3, closing: 0 });
  const poseClock = useRef({ pose, t: 0 }); // 지금 포즈에 들어온 뒤 흐른 시간 (튀어오름 등)
  const phase = useMemo(() => seed * 1.7 + (seed % 3) * 0.9, [seed]);

  const G = avatarGeometries();
  const M = useMemo(
    () => ({
      body: avatarMaterial('clay', config.body),
      skin: avatarMaterial('clay', config.skin),
      legs: avatarMaterial('clay', config.legs),
      shoes: avatarMaterial('clay', config.shoes),
      sole: avatarMaterial('plastic', SOLE_COLOR),
      laces: avatarMaterial('plastic', config.shoes.toUpperCase() === '#FFFFFF' ? '#3D4466' : '#FFFFFF'),
      face: avatarMaterial('face', config.face),
      ink: avatarMaterial('ink', INK),
      glint: avatarMaterial('glint', '#FFFFFF'),
      blush: avatarMaterial('blush', '#F28C8C'),
      glasses: avatarMaterial('plastic', config.glassesColor ?? '#F2669E'),
      bag: avatarMaterial('plastic', config.bagColor ?? '#7CC5E8'),
      zipper: avatarMaterial('plastic', config.bagColor === '#F2669E' ? '#FFFFFF' : '#F2669E'),
    }),
    [config.body, config.skin, config.legs, config.shoes, config.face, config.glassesColor, config.bagColor],
  );

  const spec = FACES[face];

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime + phase;
    const d = Math.min(dt, 0.05); // 탭 전환 후 폭주 방지
    const pc = poseClock.current;
    if (pc.pose !== pose) { pc.pose = pose; pc.t = 0; }
    pc.t += d;

    const target: Joints = { ...BASE, ...POSES[pose] };
    const walking = pose === 'walk' || pose === 'walkAway';
    const level = talkLevel ? THREE.MathUtils.clamp(talkLevel(), 0, 1) : 0;

    // 쳐다보기: 몸이 80%만 돌아도 충분히 "본다"로 읽힌다
    if (pose !== 'slump' && !walking) target.yaw = THREE.MathUtils.clamp(lookYaw, -1.2, 1.2) * 0.8;

    // 걷기: 다리와 팔을 교대로 스윙. 앞으로 나가는 다리의 무릎이 굽는다.
    const w = t * 7;
    if (walking) {
      const s = Math.sin(w);
      const c = Math.cos(w);
      target.hipLX = -s * 0.55;
      target.hipRX = s * 0.55;
      target.kneeLX = Math.max(0, c) * 0.95;
      target.kneeRX = Math.max(0, -c) * 0.95;
      target.armLX = s * 0.42;
      target.armRX = -s * 0.42;
      target.elbowLX = -0.25 - Math.max(0, -s) * 0.35;
      target.elbowRX = -0.25 - Math.max(0, s) * 0.35;
      target.lean = 0.06;
    }

    // 관절 보간 — 포즈 사이를 300ms쯤에 걸쳐 부드럽게 잇는다
    const cj = cur.current;
    for (const k of Object.keys(target) as (keyof Joints)[]) {
      cj[k] = THREE.MathUtils.damp(cj[k], target[k], 9, d);
    }

    // 보간 위에 얹는 몸짓 (리듬이 있어서 damp를 거치면 뭉개진다)
    let hop = 0, shake = 0, sway = 0;
    let elLZ = cj.elbowLZ, elRZ = cj.elbowRZ, elRX = cj.elbowRX, shRZ = cj.armRZ;
    let shLZ = cj.armLZ;
    if (pose === 'idle') {
      shLZ += Math.sin(t * 1.6) * 0.018;
      shRZ += Math.sin(t * 1.6 + 0.4) * 0.018;
    }
    if (pose === 'sitTalk') {
      elRX += Math.sin(t * 3.3) * 0.2;
      shRZ += Math.sin(t * 1.7) * 0.06;
    }
    if (pose === 'laugh') {
      const clap = Math.abs(Math.sin(t * 9));
      elLZ += clap * 0.38;
      elRZ += clap * 0.38;
      shake = Math.abs(Math.sin(t * 9)) * 0.014;
      sway = Math.sin(t * 4.5) * 0.04;
    }
    if (pose === 'heart') sway = Math.sin(t * 3) * 0.05;
    if (pose === 'startle') {
      // 의자에서 한 번 튀었다가 내려앉는다
      const k = pc.t * 7;
      hop = k < Math.PI ? Math.sin(k) * 0.09 : 0;
      shake = Math.sin(t * 40) * 0.004 * Math.exp(-pc.t * 2);
    }

    if (root.current) {
      root.current.position.y = cj.rootY + hop;
      root.current.rotation.y = cj.rootRotY;
    }
    if (torso.current) {
      // 숨쉬기. 이 2px이 "살아있음"의 8할이다.
      const breathe = Math.sin(t * 1.6) * 0.008;
      // 걸을 때 상하 바운스 + 좌우 흔들림이 없으면 미끄러지는 인형처럼 보인다.
      const bounce = walking ? (Math.abs(Math.cos(w)) - 0.5) * 0.03 : 0;
      torso.current.position.y = HIP_Y + breathe + bounce + shake;
      // 목소리에 맞춰 살짝 들썩인다
      torso.current.rotation.x = cj.lean + level * 0.05 * Math.sin(t * 9);
      torso.current.rotation.y = cj.yaw;
      torso.current.rotation.z = THREE.MathUtils.damp(
        torso.current.rotation.z,
        cj.tilt + sway + (walking ? Math.sin(w) * 0.05 : 0),
        9,
        d,
      );
      torso.current.scale.y = 1 + Math.sin(t * 1.6) * 0.007;
    }
    // 왼팔(x<0)은 바깥이 -z 회전, 오른팔은 +z 회전 → 포즈 값은 양쪽 같은 부호로 쓴다
    shL.current?.rotation.set(cj.armLX, 0, -shLZ);
    shR.current?.rotation.set(cj.armRX, 0, shRZ);
    elL.current?.rotation.set(cj.elbowLX, 0, -elLZ);
    elR.current?.rotation.set(elRX, 0, elRZ);
    handL.current?.rotation.set(0, cj.wristL, 0);
    handR.current?.rotation.set(0, -cj.wristR, 0);
    hipL.current?.rotation.set(cj.hipLX, 0, 0);
    hipR.current?.rotation.set(cj.hipRX, 0, 0);
    kneeL.current?.rotation.set(cj.kneeLX, 0, 0);
    kneeR.current?.rotation.set(cj.kneeRX, 0, 0);
    // 발바닥이 늘 바닥과 평행하도록
    ankleL.current?.rotation.set(-(cj.hipLX + cj.kneeLX) * 0.85, 0, 0);
    ankleR.current?.rotation.set(-(cj.hipRX + cj.kneeRX) * 0.85, 0, 0);

    // 눈 깜빡임 — 랜덤 간격, 아주 싸고 효과가 크다
    const b = blink.current;
    b.next -= d;
    if (b.next <= 0) { b.closing = 0.12; b.next = 1.8 + Math.random() * 4; }
    const closed = b.closing > 0 ? (b.closing -= d, 1) : 0;
    const blinkSY = closed ? 0.1 : 1;

    if (eyeL.current) {
      eyeL.current.scale.set(spec.eyeSX, spec.eyeSY * blinkSY, 1);
      eyeL.current.position.y = spec.browY ?? 0;
    }
    if (eyeR.current) {
      eyeR.current.scale.set(spec.eyeSX, spec.wink ? 0.12 : spec.eyeSY * blinkSY, 1);
      eyeR.current.position.y = spec.browY ?? 0;
    }
    // 말할 때 입이 벌렁거린다 (TTS와 정확히 맞출 필요 없다)
    if (mouth.current) {
      const talk = talkLevel ? 1 + level * 2.2 : talking ? 1 + Math.abs(Math.sin(t * 11)) * 0.9 : 1;
      mouth.current.scale.set(spec.mouthSX, spec.mouthSY * talk, 1);
      // 호의 가운데가 mouthRot 방향의 반대(아래=웃음)에 오도록 돌린다
      mouth.current.rotation.z = spec.mouthRot + Math.PI / 2 - spec.mouthArc / 2;
    }
  });

  /** 다리 한 쪽. 허벅지 → 무릎 → 정강이 → 발목 → 운동화 */
  const leg = (s: -1 | 1, hipRef: GroupRef, kneeRef: GroupRef, ankleRef: GroupRef) => (
    // 발끝은 바깥으로 살짝, 다리는 아주 살짝 벌려야 서 있는 자세가 자연스럽다
    <group position={[s * LEG.x, HIP_Y, 0]} rotation={[0, s * 0.12, s * 0.035]}>
      <group ref={hipRef}>
        <mesh geometry={G.thigh} material={M.legs} castShadow />
        <group ref={kneeRef} position={[0, -LEG.thigh, 0]}>
          <mesh geometry={G.shin} material={M.legs} castShadow />
          <group ref={ankleRef} position={[0, -LEG.shin, 0]}>
            <mesh geometry={G.sole} material={M.sole} position={[0, -LEG.foot + 0.013, 0.028]} scale={[0.066, 0.026, 0.108]} castShadow />
            <group position={[0, -LEG.foot + 0.022, 0.028]}>
              <mesh geometry={G.shoeUpper} material={M.shoes} castShadow />
              <mesh geometry={G.laces} material={M.laces} />
            </group>
          </group>
        </group>
      </group>
    </group>
  );

  /** 팔 한 쪽. 어깨 → 팔꿈치 → 손목 → 벙어리장갑 손 */
  const arm = (s: -1 | 1, shRef: GroupRef, elRef: GroupRef, handRef: GroupRef) => (
    <group ref={shRef} position={[s * SHOULDER.x, SHOULDER.y, 0]}>
      <mesh geometry={G.upperArm} material={M.skin} castShadow />
      <group ref={elRef} position={[0, -ARM.upper, 0]}>
        <mesh geometry={G.foreArm} material={M.skin} castShadow />
        <group ref={handRef} position={[0, -ARM.fore, 0]}>
          <mesh geometry={G.palm} material={M.skin} position={[0, -0.046, 0.004]} castShadow />
          {/* 엄지는 앞쪽·몸 안쪽으로 */}
          <mesh geometry={G.thumb} material={M.skin} position={[-s * 0.008, -0.04, 0.04]} rotation={[-0.7, 0, 0]} castShadow />
        </group>
      </group>
    </group>
  );

  return (
    <group ref={root}>
      {leg(-1, hipL, kneeL, ankleL)}
      {leg(1, hipR, kneeR, ankleR)}

      {/* 상체는 엉덩이 높이를 축으로 숙인다. 돌기(Y)를 먼저 해야 돈 방향으로 숙인다 */}
      <group ref={torso} position={[0, HIP_Y, 0]} rotation-order="YXZ">
        <group position={[0, -HIP_Y, 0]}>
          {/* 머리+어깨+몸통이 통짜 회전체 하나 */}
          <mesh geometry={G.body} material={M.body} castShadow receiveShadow />

          {/* 얼굴판 — 머리 곡면을 그대로 따라 붙은 조각. 표정은 전부 여기서 난다. */}
          <mesh geometry={G.face} material={M.face} receiveShadow />
          {EYE_SPOT.map((spot, i) => (
            <group key={i} position={spot.position} quaternion={spot.quaternion}>
              <group ref={i === 0 ? eyeL : eyeR}>
                <mesh geometry={G.eyeDot} material={M.ink} visible={!spec.eyeArc} />
                <mesh geometry={G.eyeGlint} material={M.glint} position={[0.0075, 0.014, 0.009]} visible={!spec.eyeArc} />
                <mesh geometry={G.eyeArc} material={M.ink} position={[0, -0.014, 0]} visible={spec.eyeArc} />
              </group>
            </group>
          ))}
          <group position={MOUTH_SPOT.position} quaternion={MOUTH_SPOT.quaternion}>
            <mesh ref={mouth} geometry={mouthGeometry(spec.mouthArc)} material={M.ink} />
          </group>
          {BLUSH_SPOT.map((spot, i) => (
            <mesh key={i} geometry={G.blush} material={M.blush} position={spot.position} quaternion={spot.quaternion} />
          ))}

          {/* 액세서리 — 머리·허리 곡면을 따라 감기도록 shape.ts에서 미리 휘어 둔 것 */}
          {config.glasses !== 'none' && (
            <mesh geometry={config.glasses === 'shutter' ? G.shutter : G.round} material={M.glasses} castShadow />
          )}
          {config.bag && (
            <>
              <mesh geometry={G.belt} material={M.bag} castShadow />
              <mesh geometry={G.pouch} material={M.bag} castShadow />
              <mesh geometry={G.zipper} material={M.zipper} />
            </>
          )}

          {arm(-1, shL, elL, handL)}
          {arm(1, shR, elR, handR)}
        </group>
      </group>
    </group>
  );
}
