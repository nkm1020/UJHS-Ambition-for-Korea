'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { AvatarConfig, FaceName, PoseName } from '@/lib/types';
import { DEFAULT_AVATAR } from '@/lib/avatar';

/* ──────────────────────────────────────────────────────────────
   관절. 캐릭터는 뼈대(skeleton)가 없다. 프리미티브를 부모-자식으로
   묶고 group의 회전만 바꾼다. Coastal World도 결국 이 정도 자유도다.
   ────────────────────────────────────────────────────────────── */
type Joints = {
  rootY: number;    // 전체 높이 (앉으면 내려간다)
  rootRotY: number; // 몸 전체 돌리기 (등 돌리기)
  lean: number;     // 상체 앞으로 숙이기
  armLX: number; armLZ: number; // Z는 "바깥으로 벌림" = 양수
  armRX: number; armRZ: number;
  hipLX: number; hipRX: number;
  kneeLX: number; kneeRX: number;
};

const BASE: Joints = {
  rootY: 0, rootRotY: 0, lean: 0,
  armLX: 0, armLZ: 0.1, armRX: 0, armRZ: 0.1,
  hipLX: 0, hipRX: 0, kneeLX: 0, kneeRX: 0,
};

/** 앉은 자세 공통. 원탁 비트는 전부 여기서 출발한다. */
const SEATED = { rootY: -0.2, hipLX: 1.5, hipRX: 1.5, kneeLX: -1.5, kneeRX: -1.5 } as const;

/** 포즈 프리셋. 여기에 한 줄 추가하면 새 몸짓이 생긴다. */
const POSES: Record<PoseName, Partial<Joints>> = {
  idle: {},
  walk: {}, // 다리·팔은 useFrame에서 sin으로 덮어쓴다
  sit:     { ...SEATED, armLZ: 0.18, armRZ: 0.18 },
  sitTalk: { ...SEATED, lean: 0.2, armLX: -0.3, armRX: -0.3, armLZ: 0.25, armRZ: 0.25 },
  // 테이블에 얼굴을 묻고 엎드린다. away의 기본 자세.
  slump:   { ...SEATED, lean: 0.95, armLX: -1.55, armRX: -1.55, armLZ: 0.3, armRZ: 0.3 },
  stare:   { ...SEATED, lean: 0.12, armLZ: 0.12, armRZ: 0.12 },
  // 화들짝: 상체를 뒤로 젖히며 두 팔을 번쩍
  startle: { ...SEATED, rootY: -0.15, lean: -0.28, armLX: -1.25, armRX: -1.25, armLZ: 0.7, armRZ: 0.7 },
  coverMouth: { ...SEATED, lean: 0.1, armLX: -2.3, armLZ: -0.5, armRX: -0.2, armRZ: 0.15 },
  heart:   { ...SEATED, lean: 0.12, armLX: -2.0, armLZ: -0.32, armRX: -2.0, armRZ: -0.32 },
  laugh:   { ...SEATED, lean: -0.38, armLX: -0.9, armRX: -0.9, armLZ: 0.5, armRZ: 0.5 },
};

/* ──────────────────────────────────────────────────────────────
   표정. 눈·입을 "모양"으로 안 만들고 scale/rotation 숫자로만 바꾼다.
   Coastal World가 뼈 position.x로 스프라이트 칸을 고르던 것의 3D판.
   ────────────────────────────────────────────────────────────── */
type FaceSpec = {
  eyeArc: boolean;              // true면 ^^ 아치눈, false면 점눈
  eyeSX: number; eyeSY: number;
  eyeRot?: number;
  browY?: number;               // 눈 높이 (놀람은 위로)
  mouthArc: number;             // 토러스 호의 길이 (2π = 완전한 O)
  mouthRot: number;             // π = 아래로 볼록(웃음), 0 = 위로 볼록(울상)
  mouthSX: number; mouthSY: number;
  wink?: boolean;               // 한쪽 눈만 감기
};

const FACES: Record<FaceName, FaceSpec> = {
  neutral: { eyeArc: false, eyeSX: 1,   eyeSY: 1,   mouthArc: Math.PI * 0.75, mouthRot: Math.PI, mouthSX: 1,    mouthSY: 1 },
  happy:   { eyeArc: true,  eyeSX: 1.1, eyeSY: 1,   mouthArc: Math.PI * 0.9,  mouthRot: Math.PI, mouthSX: 1.25, mouthSY: 1.3 },
  shock:   { eyeArc: false, eyeSX: 1.7, eyeSY: 1.7, browY: 0.012,             mouthArc: Math.PI * 2, mouthRot: 0, mouthSX: 0.55, mouthSY: 0.75 },
  blank:   { eyeArc: false, eyeSX: 1,   eyeSY: 0.22, mouthArc: Math.PI * 0.8, mouthRot: Math.PI, mouthSX: 1.1,  mouthSY: 0.1 },
  sad:     { eyeArc: false, eyeSX: 1,   eyeSY: 1.15, browY: -0.01,            mouthArc: Math.PI * 0.7, mouthRot: 0, mouthSX: 1, mouthSY: 0.9 },
  smirk:   { eyeArc: false, eyeSX: 1,   eyeSY: 1,   wink: true,               mouthArc: Math.PI * 0.6, mouthRot: Math.PI * 1.18, mouthSX: 1.1, mouthSY: 1 },
};

export interface AvatarProps {
  config?: AvatarConfig;
  pose?: PoseName;
  face?: FaceName;
  /** 캐릭터마다 다른 값을 주면 숨쉬기·눈깜빡임이 서로 어긋나 "살아있어" 보인다. */
  seed?: number;
  /** 말하는 중이면 입이 움직인다 */
  talking?: boolean;
}

export function Avatar({
  config = DEFAULT_AVATAR,
  pose = 'idle',
  face = 'neutral',
  seed = 0,
  talking = false,
}: AvatarProps) {
  const root = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const hipL = useRef<THREE.Group>(null);
  const hipR = useRef<THREE.Group>(null);
  const kneeL = useRef<THREE.Group>(null);
  const kneeR = useRef<THREE.Group>(null);
  const eyeL = useRef<THREE.Group>(null);
  const eyeR = useRef<THREE.Group>(null);
  const mouth = useRef<THREE.Mesh>(null);

  // 현재 관절값. 목표값으로 매 프레임 damp 되면서 따라간다 = 크로스페이드.
  const cur = useRef<Joints>({ ...BASE });
  const blink = useRef({ next: 1 + Math.random() * 3, closing: 0 });
  const phase = useMemo(() => seed * 1.7 + (seed % 3) * 0.9, [seed]);

  const spec = FACES[face];

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime + phase;
    const d = Math.min(dt, 0.05); // 탭 전환 후 폭주 방지
    const target: Joints = { ...BASE, ...POSES[pose] };

    // 걷기: 다리와 팔을 교대로 스윙
    if (pose === 'walk') {
      const s = Math.sin(t * 7);
      target.hipLX = s * 0.7;
      target.hipRX = -s * 0.7;
      target.kneeLX = Math.min(0, -s) * 0.9;
      target.kneeRX = Math.min(0, s) * 0.9;
      target.armLX = -s * 0.5;
      target.armRX = s * 0.5;
    }

    // 관절 보간 — 어제 분석한 crossFadeTo(300ms)와 같은 역할
    const c = cur.current;
    for (const k of Object.keys(target) as (keyof Joints)[]) {
      c[k] = THREE.MathUtils.damp(c[k], target[k], 9, d);
    }

    if (root.current) {
      root.current.position.y = c.rootY;
      root.current.rotation.y = c.rootRotY;
    }
    if (torso.current) {
      torso.current.rotation.x = c.lean;
      // 숨쉬기. 이 2px이 "살아있음"의 8할이다.
      torso.current.position.y = Math.sin(t * 1.6) * 0.012;
      torso.current.scale.y = 1 + Math.sin(t * 1.6) * 0.008;
    }
    if (armL.current) { armL.current.rotation.x = c.armLX; armL.current.rotation.z = -c.armLZ; }
    if (armR.current) { armR.current.rotation.x = c.armRX; armR.current.rotation.z = c.armRZ; }
    if (hipL.current) hipL.current.rotation.x = c.hipLX;
    if (hipR.current) hipR.current.rotation.x = c.hipRX;
    if (kneeL.current) kneeL.current.rotation.x = c.kneeLX;
    if (kneeR.current) kneeR.current.rotation.x = c.kneeRX;

    // 눈 깜빡임 — 랜덤 간격, 아주 싸고 효과가 크다
    const b = blink.current;
    b.next -= d;
    if (b.next <= 0) { b.closing = 0.12; b.next = 1.8 + Math.random() * 4; }
    const closed = b.closing > 0 ? (b.closing -= d, 1) : 0;
    const blinkSY = closed ? 0.1 : 1;

    if (eyeL.current) {
      eyeL.current.scale.set(spec.eyeSX, spec.eyeSY * blinkSY, 1);
      eyeL.current.position.y = 0.025 + (spec.browY ?? 0);
    }
    if (eyeR.current) {
      const winkSY = spec.wink ? 0.12 : spec.eyeSY * blinkSY;
      eyeR.current.scale.set(spec.eyeSX, winkSY, 1);
      eyeR.current.position.y = 0.025 + (spec.browY ?? 0);
    }
    // 말할 때 입이 벌렁거린다 (TTS와 정확히 맞출 필요 없다)
    if (mouth.current) {
      const talk = talking ? 1 + Math.abs(Math.sin(t * 11)) * 0.9 : 1;
      mouth.current.scale.set(spec.mouthSX, spec.mouthSY * talk, 1);
      mouth.current.rotation.z = spec.mouthRot;
    }
  });

  const mat = (color: string) => (
    <meshStandardMaterial color={color} roughness={0.92} metalness={0} />
  );

  return (
    <group ref={root}>
      {/* 다리 — 엉덩이 pivot > 허벅지 > 무릎 pivot > 정강이 + 신발 */}
      {([['L', -0.1, hipL, kneeL], ['R', 0.1, hipR, kneeR]] as const).map(
        ([side, x, hipRef, kneeRef]) => (
          <group key={side} ref={hipRef} position={[x, 0.62, 0]}>
            <mesh position={[0, -0.155, 0]} castShadow>
              <capsuleGeometry args={[0.05, 0.21, 4, 10]} />
              {mat(config.legs)}
            </mesh>
            <group ref={kneeRef} position={[0, -0.31, 0]}>
              <mesh position={[0, -0.155, 0]} castShadow>
                <capsuleGeometry args={[0.05, 0.21, 4, 10]} />
                {mat(config.legs)}
              </mesh>
              {/* 신발: 둥근 덩어리를 앞으로 눌러 놓은 것뿐 */}
              <mesh position={[0, -0.3, 0.025]} scale={[1.25, 0.8, 1.7]} castShadow>
                <sphereGeometry args={[0.065, 16, 12]} />
                {mat(config.shoes)}
              </mesh>
            </group>
          </group>
        ),
      )}

      {/* 머리+몸통: 하나로 이어진 물방울. 이게 Coastal World 실루엣의 핵심이다. */}
      <group ref={torso}>
        <mesh position={[0, 1.04, 0]} castShadow>
          <cylinderGeometry args={[0.26, 0.17, 0.84, 24, 1, true]} />
          {mat(config.body)}
        </mesh>
        <mesh position={[0, 1.46, 0]} castShadow>
          <sphereGeometry args={[0.26, 24, 18]} />
          {mat(config.body)}
        </mesh>
        {/* 허리 마감 */}
        <mesh position={[0, 0.62, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.17, 20]} />
          {mat(config.body)}
        </mesh>

        {/* 팔 — 어깨에서 내려오는 국수 가락. 손은 없다. */}
        <group ref={armL} position={[-0.235, 1.28, 0]}>
          <mesh position={[0, -0.21, 0]} castShadow>
            <capsuleGeometry args={[0.045, 0.33, 4, 10]} />
            {mat(config.skin)}
          </mesh>
        </group>
        <group ref={armR} position={[0.235, 1.28, 0]}>
          <mesh position={[0, -0.21, 0]} castShadow>
            <capsuleGeometry args={[0.045, 0.33, 4, 10]} />
            {mat(config.skin)}
          </mesh>
        </group>

        {/* 얼굴 — 몸통 앞에 박힌 납작한 원판. 표정은 전부 여기서 난다. */}
        <group position={[0, 1.46, 0]}>
          <mesh position={[0, 0, 0.115]} scale={[1, 1, 0.3]}>
            <sphereGeometry args={[0.185, 24, 18]} />
            {mat(config.face)}
          </mesh>

          {([['L', -0.062, eyeL], ['R', 0.062, eyeR]] as const).map(([side, x, ref]) => (
            <group key={side} ref={ref} position={[x, 0.025, 0.175]}>
              {/* 점눈과 아치눈을 둘 다 두고 표정에 따라 토글한다 */}
              <mesh visible={!spec.eyeArc}>
                <capsuleGeometry args={[0.016, 0.014, 3, 8]} />
                <meshStandardMaterial color="#2B2B3D" roughness={0.6} />
              </mesh>
              <mesh visible={spec.eyeArc} rotation={[0, 0, 0]}>
                <torusGeometry args={[0.028, 0.009, 6, 14, Math.PI]} />
                <meshStandardMaterial color="#2B2B3D" roughness={0.6} />
              </mesh>
            </group>
          ))}

          <mesh ref={mouth} position={[0, -0.055, 0.175]}>
            <torusGeometry args={[0.032, 0.009, 6, 20, spec.mouthArc]} />
            <meshStandardMaterial color="#2B2B3D" roughness={0.6} />
          </mesh>

          {/* 볼터치 */}
          {[-0.118, 0.118].map((x) => (
            <mesh key={x} position={[x, -0.035, 0.155]}>
              <circleGeometry args={[0.028, 14]} />
              <meshStandardMaterial color="#F2A0A0" transparent opacity={0.65} roughness={1} />
            </mesh>
          ))}

          {/* 액세서리 — 상점에서 파는 것들 */}
          {config.glasses === 'shutter' && (
            <group position={[0, 0.03, 0.19]}>
              {[-0.085, 0.085].map((x) => (
                <group key={x} position={[x, 0, 0]}>
                  <mesh>
                    <boxGeometry args={[0.145, 0.085, 0.015]} />
                    {mat(config.glassesColor ?? '#F2669E')}
                  </mesh>
                  {[-0.022, 0.006, 0.034].map((y) => (
                    <mesh key={y} position={[0, y, 0.012]}>
                      <boxGeometry args={[0.145, 0.012, 0.008]} />
                      <meshStandardMaterial color="#FFFFFF" roughness={0.8} />
                    </mesh>
                  ))}
                </group>
              ))}
              <mesh>
                <boxGeometry args={[0.05, 0.02, 0.012]} />
                {mat(config.glassesColor ?? '#F2669E')}
              </mesh>
              {/* 관자놀이로 이어지는 띠 */}
              <mesh position={[0, 0, -0.08]} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.175, 0.011, 6, 20, Math.PI]} />
                {mat(config.glassesColor ?? '#F2669E')}
              </mesh>
            </group>
          )}
          {config.glasses === 'round' && (
            <group position={[0, 0.03, 0.19]}>
              {[-0.062, 0.062].map((x) => (
                <mesh key={x} position={[x, 0, 0]}>
                  <torusGeometry args={[0.045, 0.009, 8, 20]} />
                  {mat(config.glassesColor ?? '#2B2B3D')}
                </mesh>
              ))}
              <mesh>
                <boxGeometry args={[0.04, 0.009, 0.009]} />
                {mat(config.glassesColor ?? '#2B2B3D')}
              </mesh>
            </group>
          )}
        </group>

        {/* 패니팩 */}
        {config.bag && (
          <group position={[0, 0.72, 0]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.185, 0.016, 8, 24]} />
              {mat(config.bagColor ?? '#7CC5E8')}
            </mesh>
            <mesh position={[0, -0.02, 0.165]} scale={[1.5, 0.75, 0.7]}>
              <sphereGeometry args={[0.075, 16, 12]} />
              {mat(config.bagColor ?? '#7CC5E8')}
            </mesh>
          </group>
        )}
      </group>
    </group>
  );
}
