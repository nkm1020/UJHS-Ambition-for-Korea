'use client';

import { Canvas } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei';
import { ReactNode } from 'react';
import * as THREE from 'three';

/** 조명·그림자 프리셋. 마이룸과 원탁이 같은 룩을 쓰도록 여기 한 곳에만 둔다. */
export function AvatarStage({
  children,
  /** 꾸미기 화면처럼 손가락으로 돌려보게 할 때만 켠다 */
  spin = false,
  camera = [0, 1.25, 2.6] as [number, number, number],
  fov = 32,
  className,
}: {
  children: ReactNode;
  spin?: boolean;
  camera?: [number, number, number];
  fov?: number;
  className?: string;
}) {
  return (
    <Canvas
      className={className}
      shadows="percentage"
      dpr={[1, 2]}
      camera={{ position: camera, fov }}
      // ACES는 파스텔을 탁하게 만든다. Neutral이 고른 색을 그대로 살린다.
      gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 1.05 }}
    >
      {/* 하늘은 차갑게, 바닥 반사는 따뜻하게 — 둥근 몸에 위아래 그라데이션이 생긴다 */}
      <hemisphereLight args={['#F2F8FF', '#EADCC6', 1.15]} />
      <directionalLight
        position={[2.2, 4.5, 3]}
        intensity={2.0}
        color="#FFF6EA"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-radius={5}
        shadow-bias={-0.0003}
        shadow-normalBias={0.025}
        shadow-camera-near={0.5}
        shadow-camera-far={14}
        shadow-camera-left={-2.5}
        shadow-camera-right={2.5}
        shadow-camera-top={2.5}
        shadow-camera-bottom={-2.5}
      />
      {/* 뒤에서 차가운 빛 → 실루엣 가장자리가 살아난다 */}
      <directionalLight position={[-3, 2.5, -3]} intensity={0.9} color="#DCEBFF" />

      {/* 은은한 반사광. 외부 HDR 없이 빛판 몇 장으로 한 번만 굽는다. */}
      <Environment resolution={128} frames={1} environmentIntensity={0.75}>
        <Lightformer form="rect" intensity={2.2} color="#FFFFFF" position={[0, 5, 1]} scale={[8, 8, 1]} />
        <Lightformer form="rect" intensity={1.1} color="#D6ECFF" position={[-5, 1.5, 2]} scale={[4, 5, 1]} />
        <Lightformer form="rect" intensity={0.9} color="#FFE8D0" position={[5, 1.5, -1]} scale={[4, 5, 1]} />
        <Lightformer form="circle" intensity={0.8} color="#FFFFFF" position={[0, 1.6, 6]} scale={3} />
        <Lightformer form="rect" intensity={0.5} color="#EADBC4" position={[0, -4, 0]} scale={[10, 10, 1]} />
      </Environment>

      {children}
      <ContactShadows position={[0, 0.002, 0]} opacity={0.42} scale={5} blur={2.2} far={1.4} resolution={512} color="#3A4660" />
      {spin && (
        <OrbitControls
          enablePan={false}
          enableZoom={false}
          minPolarAngle={Math.PI / 2.6}
          maxPolarAngle={Math.PI / 2.1}
          target={[0, 0.9, 0]}
        />
      )}
    </Canvas>
  );
}
