"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment } from "@react-three/drei";
import * as THREE from "three";
import type { AvatarStandProps } from "@/lib/types";
import { Avatar } from "./Avatar";
import { ArchWindow, Bench, PALETTE, Plant, RoomReflections, Rug } from "./furniture";
import { floorboards, paneling, plaster } from "./textures";

// My Room: the avatar standing in a small, quiet room. The bottom sheet
// covers the lower fifth of the screen, so the home shot aims below the
// figure to lift it into the open area between the header and the sheet.
// With `focus` (editing the look) the camera dollies in on an S-curve until
// the figure fills the space between the edit bar and the color panel, and
// a horizontal drag turns the figure.

interface Shot {
  pos: THREE.Vector3;
  look: THREE.Vector3;
}

const HOME: Shot = { pos: new THREE.Vector3(0.45, 1.7, 7.6), look: new THREE.Vector3(0, 0.5, 0) };
const EDIT: Shot = { pos: new THREE.Vector3(0, 1.18, 4.9), look: new THREE.Vector3(0, 0.74, 0) };
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

function Room() {
  const m = useMemo(() => {
    const floor = floorboards([8.75, 8.75]);
    const wall = plaster([3.5, 1.1], PALETTE.cream);
    const side = plaster([2, 1.1], "#e6ddcf");
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
  }, []);

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

      <group position={[1.4, 1.05, -2.36]}>
        <ArchWindow width={1.15} height={1.75} />
      </group>
      <group position={[0, 0, 0.1]}>
        <Rug radius={1.1} />
      </group>
      <group position={[-1.75, 0, -1.8]}>
        <Bench />
      </group>
      <group position={[2.35, 0, -1.75]}>
        <Plant height={1.15} />
      </group>
    </group>
  );
}

export default function HomeStage3D({ avatar, focus = false }: AvatarStandProps) {
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
      <ambientLight intensity={0.55} />
      <directionalLight
        position={[2.6, 4.5, 2.2]}
        intensity={2}
        color="#fff4e6"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />
      <directionalLight position={[-3, 2.2, 1.5]} intensity={0.35} color="#dfe6ff" />
      <Room />
      <Turntable enabled={focus}>
        <Avatar config={avatar} pose="idle" face="happy" seed={7} />
      </Turntable>
      <ContactShadows position={[0, 0.008, 0]} opacity={0.38} scale={4} blur={2.4} far={2} />
    </Canvas>
  );
}
