"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { AvatarStandProps, HomeLook } from "@/lib/types";
import { skyAt, skyClock, useWeather, type Weather } from "@/lib/weather";
import { Avatar } from "./Avatar";
import { WeatherWindow } from "./WeatherWindow";

// My Room: the avatar standing in a small, quiet room. The bottom sheet
// covers the lower fifth of the screen, so the camera aims below the figure
// to lift it into the open area between the header and the sheet. With
// `spin` (the wardrobe) the figure is framed head to toe and drags to turn.
// The window shows today's real weather, and the room light follows it:
// cooler under cloud, warm lamplight after dark. A friend's room is the same
// space in their colours, with one thing lying around that is theirs.

const MY_ROOM: HomeLook = {
  wall: "#ece7df",
  sideWall: "#e4ded5",
  floor: "#d6cfc4",
  rug: "#c4b9a8",
  bench: "#8d7b66",
  plant: "#5f7a52",
};

function Aim({ y }: { y: number }) {
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    camera.lookAt(0, y, 0);
  }, [camera, y]);
  return null;
}

function Dumbbell(props: { position: [number, number, number]; rotation: [number, number, number] }) {
  return (
    <group {...props}>
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.022, 0.022, 0.4, 12]} />
        <meshStandardMaterial color="#9a9aa2" metalness={0.6} roughness={0.35} />
      </mesh>
      {[-0.15, 0.15].map((x) => (
        <mesh key={x} position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.085, 0.085, 0.08, 20]} />
          <meshStandardMaterial color="#2f2f35" roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

function PizzaBoxes(props: { position: [number, number, number]; rotation: [number, number, number] }) {
  return (
    <group {...props}>
      {[0, 1].map((i) => (
        <mesh key={i} position={[0, 0.03 + i * 0.062, 0]} rotation={[0, i * 0.35, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.46, 0.06, 0.46]} />
          <meshStandardMaterial color={i ? "#d8b47e" : "#c9a26b"} roughness={0.95} />
        </mesh>
      ))}
    </group>
  );
}

function Room({ weather, look }: { weather: Weather | null; look: HomeLook }) {
  return (
    <group>
      {/* floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[14, 14]} />
        <meshStandardMaterial color={look.floor} roughness={1} />
      </mesh>
      {/* back wall and a side wall */}
      <mesh position={[0, 2.2, -2.4]} receiveShadow>
        <planeGeometry args={[14, 4.4]} />
        <meshStandardMaterial color={look.wall} roughness={1} />
      </mesh>
      <mesh position={[-3.2, 2.2, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[8, 4.4]} />
        <meshStandardMaterial color={look.sideWall} roughness={1} />
      </mesh>
      {/* upper right of the frame, clear of the header on a narrow phone */}
      <WeatherWindow weather={weather} position={[0.66, 2.12, -2.4]} />
      {/* rug */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0.1]} receiveShadow>
        <circleGeometry args={[1.05, 48]} />
        <meshStandardMaterial color={look.rug} roughness={1} />
      </mesh>
      {/* a low bench and a plant so the room reads as a room */}
      <mesh position={[-1.75, 0.22, -1.55]} castShadow receiveShadow>
        <boxGeometry args={[1.5, 0.44, 0.55]} />
        <meshStandardMaterial color={look.bench} roughness={0.8} />
      </mesh>
      <group position={[2.2, 0, -1.6]}>
        <mesh position={[0, 0.22, 0]} castShadow>
          <cylinderGeometry args={[0.2, 0.16, 0.44, 24]} />
          <meshStandardMaterial color="#3a3a40" roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.78, 0]} castShadow>
          <sphereGeometry args={[0.38, 24, 18]} />
          <meshStandardMaterial color={look.plant} roughness={0.9} />
        </mesh>
      </group>
      {/* beside the feet, inside the frame on a narrow phone */}
      {look.prop === "dumbbell" && <Dumbbell position={[0.62, 0.085, 0.3]} rotation={[0, 0.7, 0]} />}
      {look.prop === "pizza" && <PizzaBoxes position={[-0.68, 0, 0.28]} rotation={[0, -0.4, 0]} />}
    </group>
  );
}

function RoomLights({ weather }: { weather: Weather | null }) {
  const ambient = useRef<THREE.AmbientLight>(null);
  const key = useRef<THREE.DirectionalLight>(null);
  const C = useMemo(
    () => ({
      white: new THREE.Color("#ffffff"),
      overcast: new THREE.Color("#e9eef4"),
      dusk: new THREE.Color("#ffd8b0"),
      lamp: new THREE.Color("#ffeedc"),
      target: new THREE.Color(),
    }),
    [],
  );

  useFrame((_, dt) => {
    if (!ambient.current || !key.current) return;
    const { day, golden } = skyAt(weather, skyClock());
    const grey = weather ? Math.min(1, weather.cloud * 1.2) * day : 0;
    const k = 1 - Math.exp(-1.5 * Math.min(dt, 0.1));

    C.target.copy(C.lamp).lerp(C.white, day).lerp(C.overcast, grey * 0.8).lerp(C.dusk, golden * day * 0.7);
    ambient.current.color.lerp(C.target, k);
    key.current.color.lerp(C.target, k);
    ambient.current.intensity += (0.85 + 0.3 * day - 0.1 * grey - ambient.current.intensity) * k;
    key.current.intensity += (1.3 + 0.6 * day - 0.35 * grey - key.current.intensity) * k;
  });

  return (
    <>
      <ambientLight ref={ambient} intensity={1.15} />
      <directionalLight ref={key} position={[2.6, 4.5, 2.2]} intensity={1.9} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-3, 2.2, 1.5]} intensity={0.45} />
    </>
  );
}

export default function HomeStage3D({ avatar, spin = false, look = MY_ROOM, face = "happy" }: AvatarStandProps) {
  const weather = useWeather();
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
      <color attach="background" args={[look.wall]} />
      <RoomLights weather={weather} />
      <Room weather={weather} look={look} />
      <Avatar config={avatar} pose="idle" face={face} seed={7} />
      <ContactShadows position={[0, 0.006, 0]} opacity={0.35} scale={4} blur={2.4} far={2} />
    </Canvas>
  );
}
