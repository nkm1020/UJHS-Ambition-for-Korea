"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { PoseName } from "@/lib/types";
import { REST, SKELETON as S, stepJoints, type Joints } from "@/lib/motion/engine";

// Stick-figure body for the motion engine. Every joint is a group; the
// engine's angles go straight onto them. A real avatar replaces this file
// and reads the same Joints.

interface StickFigureProps {
  pose: PoseName;
  color?: string; // head color, so friends are told apart
  seed?: number;
  talkLevel?: () => number;
  lookYaw?: number;
}

const INK = "#1b1b20";

function Bone({ length, radius = 0.032 }: { length: number; radius?: number }) {
  return (
    <mesh position={[0, -length / 2, 0]} castShadow>
      <capsuleGeometry args={[radius, length - radius * 2, 4, 8]} />
      <meshStandardMaterial color={INK} roughness={0.6} />
    </mesh>
  );
}

export function StickFigure({ pose, color = "#f2d98a", seed = 0, talkLevel, lookYaw = 0 }: StickFigureProps) {
  const joints = useRef<Joints>({ ...REST });
  const pelvis = useRef<THREE.Group>(null);
  const spine = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const mouth = useRef<THREE.Mesh>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const elbowL = useRef<THREE.Group>(null);
  const elbowR = useRef<THREE.Group>(null);
  const hipL = useRef<THREE.Group>(null);
  const hipR = useRef<THREE.Group>(null);
  const kneeL = useRef<THREE.Group>(null);
  const kneeR = useRef<THREE.Group>(null);
  const offset = useMemo(() => seed * 1.37, [seed]);

  useFrame((state, dt) => {
    const talk = talkLevel ? talkLevel() : 0;
    const j = stepJoints(joints.current, { pose, time: state.clock.elapsedTime + offset, dt, talk, lookYaw });
    if (pelvis.current) pelvis.current.position.y = S.hipHeight + j.rootY;
    if (spine.current) spine.current.rotation.x = j.lean;
    if (head.current) head.current.rotation.set(j.headPitch, j.headYaw, 0);
    if (mouth.current) mouth.current.scale.y = 0.35 + talk * 2.2;
    if (armL.current) armL.current.rotation.set(j.armLX, 0, -j.armLOut);
    if (armR.current) armR.current.rotation.set(j.armRX, 0, j.armROut);
    if (elbowL.current) elbowL.current.rotation.x = j.elbowL;
    if (elbowR.current) elbowR.current.rotation.x = j.elbowR;
    if (hipL.current) hipL.current.rotation.x = j.hipLX;
    if (hipR.current) hipR.current.rotation.x = j.hipRX;
    if (kneeL.current) kneeL.current.rotation.x = j.kneeL;
    if (kneeR.current) kneeR.current.rotation.x = j.kneeR;
  });

  return (
    <group ref={pelvis} position={[0, S.hipHeight, 0]}>
      {/* legs */}
      {([-1, 1] as const).map((side) => (
        <group key={side} ref={side < 0 ? hipL : hipR} position={[side * S.hipWidth, 0, 0]}>
          <Bone length={S.thigh} />
          <group ref={side < 0 ? kneeL : kneeR} position={[0, -S.thigh, 0]}>
            <Bone length={S.shin} />
          </group>
        </group>
      ))}
      <mesh castShadow>
        <capsuleGeometry args={[0.035, S.hipWidth * 2, 4, 8]} />
        <meshStandardMaterial color={INK} roughness={0.6} />
      </mesh>

      {/* spine, arms, head */}
      <group ref={spine}>
        <mesh position={[0, S.spine / 2, 0]} castShadow>
          <capsuleGeometry args={[0.036, S.spine - 0.07, 4, 8]} />
          <meshStandardMaterial color={INK} roughness={0.6} />
        </mesh>
        <mesh position={[0, S.spine - 0.06, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <capsuleGeometry args={[0.032, S.shoulderWidth * 2 - 0.06, 4, 8]} />
          <meshStandardMaterial color={INK} roughness={0.6} />
        </mesh>
        {([-1, 1] as const).map((side) => (
          <group key={side} ref={side < 0 ? armL : armR} position={[side * S.shoulderWidth, S.spine - 0.06, 0]}>
            <Bone length={S.upperArm} radius={0.028} />
            <group ref={side < 0 ? elbowL : elbowR} position={[0, -S.upperArm, 0]}>
              <Bone length={S.forearm} radius={0.026} />
            </group>
          </group>
        ))}
        <group ref={head} position={[0, S.spine + 0.04, 0]}>
          <mesh position={[0, S.head, 0]} castShadow>
            <sphereGeometry args={[S.head, 28, 20]} />
            <meshStandardMaterial color={color} roughness={0.5} />
          </mesh>
          {/* face: two eyes and a mouth that opens with the voice */}
          {([-1, 1] as const).map((side) => (
            <mesh key={side} position={[side * 0.065, S.head + 0.03, S.head * 0.94]}>
              <sphereGeometry args={[0.022, 12, 10]} />
              <meshStandardMaterial color={INK} />
            </mesh>
          ))}
          <mesh ref={mouth} position={[0, S.head - 0.07, S.head * 0.92]}>
            <boxGeometry args={[0.07, 0.02, 0.01]} />
            <meshStandardMaterial color={INK} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
