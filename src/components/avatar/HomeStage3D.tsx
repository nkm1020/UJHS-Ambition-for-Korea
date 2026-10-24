"use client";

import { useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import type { AvatarStandProps } from "@/lib/types";
import { StickFigure } from "./StickFigure";

// My Room: the avatar standing in a small, quiet room. The bottom sheet
// covers the lower fifth of the screen, so the camera aims below the figure
// to lift it into the open area between the header and the sheet. With
// `spin` (the wardrobe) the figure is framed head to toe and drags to turn.

function Aim({ y }: { y: number }) {
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    camera.lookAt(0, y, 0);
  }, [camera, y]);
  return null;
}

function Room() {
  return (
    <group>
      {/* floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[14, 14]} />
        <meshStandardMaterial color="#d6cfc4" roughness={1} />
      </mesh>
      {/* back wall and a side wall */}
      <mesh position={[0, 2.2, -2.4]} receiveShadow>
        <planeGeometry args={[14, 4.4]} />
        <meshStandardMaterial color="#ece7df" roughness={1} />
      </mesh>
      <mesh position={[-3.2, 2.2, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[8, 4.4]} />
        <meshStandardMaterial color="#e4ded5" roughness={1} />
      </mesh>
      {/* window light on the back wall */}
      <mesh position={[1.35, 1.85, -2.39]}>
        <planeGeometry args={[1.25, 1.55]} />
        <meshStandardMaterial color="#fffaf0" emissive="#fff3dc" emissiveIntensity={0.9} />
      </mesh>
      {/* rug */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0.1]} receiveShadow>
        <circleGeometry args={[1.05, 48]} />
        <meshStandardMaterial color="#c4b9a8" roughness={1} />
      </mesh>
      {/* a low bench and a plant so the room reads as a room */}
      <mesh position={[-1.75, 0.22, -1.55]} castShadow receiveShadow>
        <boxGeometry args={[1.5, 0.44, 0.55]} />
        <meshStandardMaterial color="#8d7b66" roughness={0.8} />
      </mesh>
      <group position={[2.2, 0, -1.6]}>
        <mesh position={[0, 0.22, 0]} castShadow>
          <cylinderGeometry args={[0.2, 0.16, 0.44, 24]} />
          <meshStandardMaterial color="#3a3a40" roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.78, 0]} castShadow>
          <sphereGeometry args={[0.38, 24, 18]} />
          <meshStandardMaterial color="#5f7a52" roughness={0.9} />
        </mesh>
      </group>
    </group>
  );
}

export default function HomeStage3D({ avatar, spin = false }: AvatarStandProps) {
  return (
    <Canvas shadows dpr={[1, 1.75]} camera={{ position: spin ? [0, 1.0, 4.3] : [0.45, 1.7, 7.6], fov: 34 }}>
      {spin ? (
        <OrbitControls
          enablePan={false}
          enableZoom={false}
          minPolarAngle={Math.PI / 2.6}
          maxPolarAngle={Math.PI / 2.05}
          target={[0, 0.95, 0]}
        />
      ) : (
        <Aim y={0.5} />
      )}
      <color attach="background" args={["#ece7df"]} />
      <ambientLight intensity={1.15} />
      <directionalLight position={[2.6, 4.5, 2.2]} intensity={1.9} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-3, 2.2, 1.5]} intensity={0.45} />
      <Room />
      <StickFigure pose="idle" color={avatar.body} seed={7} />
      <ContactShadows position={[0, 0.006, 0]} opacity={0.35} scale={4} blur={2.4} far={2} />
    </Canvas>
  );
}
