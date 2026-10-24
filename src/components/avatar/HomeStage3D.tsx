"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment } from "@react-three/drei";
import * as THREE from "three";
import type { AvatarStandProps, HomeLook } from "@/lib/types";
import { skyAt, skyClock, useWeather, type Weather } from "@/lib/weather";
import { Avatar } from "./Avatar";
import { Bench, PALETTE, Plant, RoomReflections, Rug } from "./furniture";
import { floorboards, paneling, plaster } from "./textures";
import { WeatherWindow } from "./WeatherWindow";

// My Room: the avatar standing in a small, quiet room. The bottom sheet
// covers the lower fifth of the screen, so the home shot aims below the
// figure to lift it into the open area between the header and the sheet.
// With `focus` (editing the look) the camera moves on an S-curve to set the
// figure in the space between the edit bar and the wardrobe panel, and a
// horizontal drag turns the figure.
// The window shows today's real weather, and the room light follows it:
// cooler under cloud, warm lamplight after dark. A friend's room is the same
// space in their colours, with one thing lying around that is theirs.
// The face is the expression picked in the wardrobe unless the caller sets one.

// Only the plaster colours change between rooms; the wood, paneling, rug and
// plant are the same furniture everywhere.
const MY_ROOM: HomeLook = {
  wall: PALETTE.cream,
  sideWall: "#e6ddcf",
  floor: "#d6cfc4",
  rug: "#c4b9a8",
  bench: "#8d7b66",
  plant: "#5f7a52",
};

interface Shot {
  pos: THREE.Vector3;
  look: THREE.Vector3;
}

const HOME: Shot = { pos: new THREE.Vector3(0.45, 1.7, 7.6), look: new THREE.Vector3(0, 0.5, 0) };
// The wardrobe panel covers the lower 40% of the screen, so the edit shot
// aims low to set the figure (and a hat) in the space above it.
const EDIT: Shot = { pos: new THREE.Vector3(0, 1.0, 7.7), look: new THREE.Vector3(0, -0.04, 0) };
const ZOOM_S = 1.05;

// S-curve: slow out, fast through the middle, slow in. Same curve as the room camera.
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function CameraRig({ focus }: { focus: boolean }) {
  const p = useRef(focus ? 1 : 0);
  const look = useRef(new THREE.Vector3());
  useFrame(({ camera }, dt) => {
    const target = focus ? 1 : 0;
    const step = Math.min(dt, 0.05) / ZOOM_S;
    p.current = target > p.current ? Math.min(target, p.current + step) : Math.max(target, p.current - step);
    const e = easeInOut(p.current);
    camera.position.lerpVectors(HOME.pos, EDIT.pos, e);
    look.current.lerpVectors(HOME.look, EDIT.look, e);
    camera.lookAt(look.current);
  });
  return null;
}

/** Drag sideways to turn the figure while editing; it eases home when editing ends. */
function Turntable({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  const g = useRef<THREE.Group>(null);
  const yaw = useRef(0);
  const drag = useRef<{ x: number; yaw: number } | null>(null);
  const canvas = useThree((s) => s.gl.domElement);

  useEffect(() => {
    if (!enabled) return;
    const down = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId);
      drag.current = { x: e.clientX, yaw: yaw.current };
    };
    const move = (e: PointerEvent) => {
      if (drag.current) yaw.current = drag.current.yaw + (e.clientX - drag.current.x) * 0.012;
    };
    const up = () => {
      drag.current = null;
    };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    return () => {
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      drag.current = null;
    };
  }, [canvas, enabled]);

  useFrame((_, dt) => {
    if (!g.current) return;
    if (!enabled) yaw.current = THREE.MathUtils.damp(yaw.current, 0, 4, dt);
    g.current.rotation.y = THREE.MathUtils.damp(g.current.rotation.y, yaw.current, 14, dt);
  });
  return <group ref={g}>{children}</group>;
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
  const m = useMemo(() => {
    const floor = floorboards([8.75, 8.75]);
    const wall = plaster([3.5, 1.1], look.wall);
    const side = plaster([2, 1.1], look.sideWall);
    const wainscot = paneling([6, 1], PALETTE.sage);
    const std = (s: { map: THREE.Texture; bump: THREE.Texture }, bumpScale: number, roughness: number) =>
      new THREE.MeshStandardMaterial({ map: s.map, bumpMap: s.bump, bumpScale, roughness });
    return {
      floor: std(floor, 0.8, 0.62),
      wall: std(wall, 1.2, 0.95),
      side: std(side, 1.2, 0.95),
      wainscot: std(wainscot, 1, 0.7),
      trim: new THREE.MeshStandardMaterial({ color: "#f4eee3", roughness: 0.55 }),
    };
  }, [look.wall, look.sideWall]);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={m.floor} receiveShadow>
        <planeGeometry args={[14, 14]} />
      </mesh>
      {/* back wall: limewash over sage paneling, a chair rail between */}
      <mesh position={[0, 2.2, -2.4]} material={m.wall} receiveShadow>
        <planeGeometry args={[14, 4.4]} />
      </mesh>
      <mesh position={[0, 0.45, -2.39]} material={m.wainscot} receiveShadow>
        <planeGeometry args={[14, 0.9]} />
      </mesh>
      <mesh position={[0, 0.91, -2.37]} material={m.trim} castShadow>
        <boxGeometry args={[14, 0.04, 0.05]} />
      </mesh>
      <mesh position={[0, 0.05, -2.38]} material={m.trim}>
        <boxGeometry args={[14, 0.1, 0.03]} />
      </mesh>
      {/* side wall */}
      <mesh position={[-3.2, 2.2, 0]} rotation={[0, Math.PI / 2, 0]} material={m.side} receiveShadow>
        <planeGeometry args={[8, 4.4]} />
      </mesh>
      <mesh position={[-3.19, 0.45, 0]} rotation={[0, Math.PI / 2, 0]} material={m.wainscot} receiveShadow>
        <planeGeometry args={[8, 0.9]} />
      </mesh>
      <mesh position={[-3.17, 0.91, 0]} rotation={[0, Math.PI / 2, 0]} material={m.trim}>
        <boxGeometry args={[8, 0.04, 0.05]} />
      </mesh>

      {/* upper right of the frame, clear of the header on a narrow phone */}
      <WeatherWindow weather={weather} position={[0.66, 2.12, -2.4]} />
      <group position={[0, 0, 0.1]}>
        <Rug radius={1.1} />
      </group>
      <group position={[-1.75, 0, -1.8]}>
        <Bench />
      </group>
      <group position={[2.35, 0, -1.75]}>
        <Plant height={1.15} />
      </group>
      {/* beside the feet, inside the frame on a narrow phone */}
      {look.prop === "dumbbell" && <Dumbbell position={[0.62, 0.085, 0.3]} rotation={[0, 0.7, 0]} />}
      {look.prop === "pizza" && <PizzaBoxes position={[-0.68, 0, 0.28]} rotation={[0, -0.4, 0]} />}
    </group>
  );
}

// Key and fill follow the real sky: daylight, grey under cloud, gold near
// sunset, warm lamplight after dark. Levels sit under the environment light.
function RoomLights({ weather }: { weather: Weather | null }) {
  const ambient = useRef<THREE.AmbientLight>(null);
  const key = useRef<THREE.DirectionalLight>(null);
  const C = useMemo(
    () => ({
      day: new THREE.Color("#fff4e6"),
      overcast: new THREE.Color("#e9eef4"),
      dusk: new THREE.Color("#ffd8b0"),
      lamp: new THREE.Color("#ffe6c8"),
      target: new THREE.Color(),
    }),
    [],
  );

  useFrame((_, dt) => {
    if (!ambient.current || !key.current) return;
    const { day, golden } = skyAt(weather, skyClock());
    const grey = weather ? Math.min(1, weather.cloud * 1.2) * day : 0;
    const k = 1 - Math.exp(-1.5 * Math.min(dt, 0.1));

    C.target.copy(C.lamp).lerp(C.day, day).lerp(C.overcast, grey * 0.8).lerp(C.dusk, golden * day * 0.7);
    ambient.current.color.lerp(C.target, k);
    key.current.color.lerp(C.target, k);
    ambient.current.intensity += (0.45 + 0.15 * day - 0.08 * grey - ambient.current.intensity) * k;
    key.current.intensity += (1.5 + 0.6 * day - 0.4 * grey - key.current.intensity) * k;
  });

  return (
    <>
      <ambientLight ref={ambient} intensity={0.55} />
      <directionalLight
        ref={key}
        position={[2.6, 4.5, 2.2]}
        intensity={2}
        color="#fff4e6"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />
    </>
  );
}

export default function HomeStage3D({ avatar, focus = false, look = MY_ROOM, face }: AvatarStandProps) {
  const weather = useWeather();
  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      camera={{ position: HOME.pos.toArray(), fov: 34 }}
      style={{ touchAction: focus ? "none" : "auto", cursor: focus ? "grab" : "default" }}
    >
      <CameraRig focus={focus} />
      <color attach="background" args={["#e9e1d4"]} />
      <fog attach="fog" args={["#e9e1d4", 9, 16]} />
      <Environment resolution={64} environmentIntensity={0.45}>
        <RoomReflections />
      </Environment>
      <RoomLights weather={weather} />
      <directionalLight position={[-3, 2.2, 1.5]} intensity={0.35} color="#dfe6ff" />
      <Room weather={weather} look={look} />
      <Turntable enabled={focus}>
        <Avatar config={avatar} pose="idle" face={face ?? avatar.expression} seed={7} />
      </Turntable>
      <ContactShadows position={[0, 0.008, 0]} opacity={0.38} scale={4} blur={2.4} far={2} />
    </Canvas>
  );
}
