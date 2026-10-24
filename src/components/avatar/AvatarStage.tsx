'use client';

import { Canvas } from '@react-three/fiber';
import { ContactShadows, OrbitControls } from '@react-three/drei';
import { ReactNode } from 'react';

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
      shadows
      dpr={[1, 2]}
      camera={{ position: camera, fov }}
      gl={{ antialias: true }}
    >
      <ambientLight intensity={1.5} />
      <directionalLight
        position={[2.5, 5, 3]}
        intensity={2.2}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-near={0.5}
        shadow-camera-far={12}
        shadow-camera-left={-2}
        shadow-camera-right={2}
        shadow-camera-top={2}
        shadow-camera-bottom={-2}
      />
      {/* 반대쪽에서 약하게 받쳐주면 점토 느낌이 산다 */}
      <directionalLight position={[-3, 2, -2]} intensity={0.6} />
      {children}
      <ContactShadows position={[0, 0.001, 0]} opacity={0.35} scale={4} blur={2.4} far={2} />
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
