"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { Lightformer, RoundedBox } from "@react-three/drei";
import { braidedRug, duskSky, paintedWood, plaster, weave, woodGrain } from "./textures";

// Furniture shared by My Room and the round table. Meters, with the avatar
// about 1.74 tall. Every surface carries a texture and every edge is rounded
// a little, so nothing reads as a bare box.

export const PALETTE = {
  oak: { light: "#d4ad80", dark: "#946b46" },
  walnut: { light: "#8a6040", dark: "#4a3222" },
  cream: "#efe7da",
  rust: "#b4623f",
  sage: "#93a487",
  terracotta: "#c27352",
  leaf: ["#4d7a4b", "#6a9a58", "#3f6a45"],
  brass: "#c9a35b",
};

/* ── lighting ─────────────────────────────────────────────── */

/** Soft studio reflections, rendered once from local light cards (no HDR download). */
export function RoomReflections() {
  return (
    <>
      <mesh scale={30}>
        <sphereGeometry args={[1, 16, 12]} />
        <meshBasicMaterial color="#7d6c5c" side={THREE.BackSide} />
      </mesh>
      <Lightformer form="rect" intensity={2.2} color="#fff1dc" position={[0, 6, 1]} rotation-x={Math.PI / 2} scale={[10, 10, 1]} />
      <Lightformer form="rect" intensity={1.1} color="#ffd2a6" position={[-6, 2, 1]} rotation-y={Math.PI / 2} scale={[8, 3, 1]} />
      <Lightformer form="rect" intensity={0.9} color="#d6ddff" position={[6, 2.5, -2]} rotation-y={-Math.PI / 2} scale={[5, 3, 1]} />
    </>
  );
}

/* ── seating ──────────────────────────────────────────────── */

/**
 * Sized for the avatar: the cushion top is at 0.34 (its hips sit at 0.40) and
 * the back stays low and far enough behind that leaning back to laugh doesn't
 * go through it. Faces +z.
 */
export function Chair({ fabric = PALETTE.rust }: { fabric?: string }) {
  const m = useMemo(() => {
    const cloth = weave([2, 2], fabric);
    const wood = woodGrain([1, 3], PALETTE.walnut.light, PALETTE.walnut.dark, true);
    return {
      cloth: new THREE.MeshStandardMaterial({ map: cloth.map, bumpMap: cloth.bump, bumpScale: 1.4, roughness: 0.92 }),
      wood: new THREE.MeshStandardMaterial({ map: wood.map, bumpMap: wood.bump, bumpScale: 0.6, roughness: 0.55 }),
    };
  }, [fabric]);

  return (
    <group>
      <RoundedBox args={[0.58, 0.07, 0.62]} radius={0.03} smoothness={3} position={[0, 0.305, -0.17]} material={m.cloth} castShadow receiveShadow />
      {[-0.25, 0.25].map((x) => (
        <group key={x}>
          {/* front leg */}
          <mesh position={[x, 0.135, 0.09]} material={m.wood} castShadow>
            <cylinderGeometry args={[0.02, 0.016, 0.27, 16]} />
          </mesh>
          {/* back leg runs up into the backrest post */}
          <mesh position={[x, 0.44, -0.5]} material={m.wood} castShadow>
            <cylinderGeometry args={[0.02, 0.017, 0.88, 16]} />
          </mesh>
        </group>
      ))}
      <RoundedBox args={[0.56, 0.3, 0.05]} radius={0.022} smoothness={3} position={[0, 0.7, -0.52]} material={m.cloth} castShadow />
    </group>
  );
}

export function Bench() {
  const m = useMemo(() => {
    const wood = woodGrain([2, 1], PALETTE.oak.light, PALETTE.oak.dark);
    const cloth = weave([4, 1.4], PALETTE.sage);
    return {
      wood: new THREE.MeshStandardMaterial({ map: wood.map, bumpMap: wood.bump, bumpScale: 0.5, roughness: 0.5 }),
      cloth: new THREE.MeshStandardMaterial({ map: cloth.map, bumpMap: cloth.bump, bumpScale: 1.4, roughness: 0.95 }),
    };
  }, []);
  return (
    <group>
      <RoundedBox args={[1.5, 0.06, 0.5]} radius={0.02} smoothness={3} position={[0, 0.39, 0]} material={m.wood} castShadow receiveShadow />
      <RoundedBox args={[1.4, 0.09, 0.44]} radius={0.04} smoothness={4} position={[0, 0.465, 0]} material={m.cloth} castShadow receiveShadow />
      {[-0.66, 0.66].flatMap((x) =>
        [-0.18, 0.18].map((z) => (
          <mesh key={`${x}${z}`} position={[x, 0.18, z]} material={m.wood} castShadow>
            <cylinderGeometry args={[0.024, 0.018, 0.36, 14]} />
          </mesh>
        )),
      )}
    </group>
  );
}

/* ── soft furnishings ─────────────────────────────────────── */

export function Rug({ radius = 1.05 }: { radius?: number }) {
  const mat = useMemo(() => {
    const t = braidedRug(["#d9c3a5", "#c28f6b", "#e8dcc6", "#a5b394", "#b98a68"]);
    return new THREE.MeshStandardMaterial({ map: t.map, bumpMap: t.bump, bumpScale: 2, roughness: 1 });
  }, []);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]} material={mat} receiveShadow>
      <circleGeometry args={[radius, 96]} />
    </mesh>
  );
}

const LEAF = new THREE.SphereGeometry(1, 20, 14);

/** A snake plant in a terracotta pot. `height` is the tallest leaf tip. */
export function Plant({ height = 1.05 }: { height?: number }) {
  const parts = useMemo(() => {
    const clay = plaster([1, 1], PALETTE.terracotta);
    const pot = new THREE.LatheGeometry(
      [
        [0, 0],
        [0.15, 0],
        [0.17, 0.05],
        [0.2, 0.34],
        [0.225, 0.35],
        [0.225, 0.41],
        [0.2, 0.41],
        [0.19, 0.38],
      ].map(([r, y]) => new THREE.Vector2(r, y)),
      40,
    );
    const leaves = Array.from({ length: 9 }, (_, i) => {
      const a = i * 2.4; // golden-angle spread
      const tall = 0.62 + ((i * 37) % 10) / 26;
      return {
        a,
        tall,
        tilt: 0.1 + ((i * 53) % 7) / 28,
        color: PALETTE.leaf[i % PALETTE.leaf.length],
      };
    });
    return {
      pot,
      clay: new THREE.MeshStandardMaterial({ map: clay.map, bumpMap: clay.bump, bumpScale: 1.2, roughness: 0.85 }),
      leaves,
    };
  }, []);
  const s = height / 1.05;

  return (
    <group scale={s}>
      <mesh geometry={parts.pot} material={parts.clay} castShadow receiveShadow />
      <mesh position={[0, 0.39, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.19, 32]} />
        <meshStandardMaterial color="#3b2a20" roughness={1} />
      </mesh>
      {parts.leaves.map((l, i) => (
        // turn to face outward, then tip away from the middle
        <group key={i} position={[Math.cos(l.a) * 0.06, 0.38, -Math.sin(l.a) * 0.06]} rotation={[0, l.a, -l.tilt]} rotation-order="YXZ">
          <mesh geometry={LEAF} position={[0, l.tall * 0.5, 0]} scale={[0.055, l.tall * 0.5, 0.016]} castShadow>
            <meshStandardMaterial color={l.color} roughness={0.55} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ── architecture ─────────────────────────────────────────── */

function archShape(w: number, h: number, inset = 0): THREE.Shape {
  const hw = w / 2 - inset;
  const r = hw;
  const top = h - w / 2; // where the straight sides end
  const s = new THREE.Shape();
  s.moveTo(-hw, inset);
  s.lineTo(hw, inset);
  s.lineTo(hw, top);
  s.absarc(0, top, r, 0, Math.PI, false);
  s.lineTo(-hw, inset);
  return s;
}

/** An arched window onto a dusk sky. Origin at the sill, facing +z. */
export function ArchWindow({ width = 1.1, height = 1.7 }: { width?: number; height?: number }) {
  const parts = useMemo(() => {
    const ft = 0.07;
    const pane = new THREE.ShapeGeometry(archShape(width, height, ft), 24);
    // map the sky across the pane: u by width, v by height
    const pos = pane.attributes.position;
    const uv = pane.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / width + 0.5, pos.getY(i) / height);
    const outer = archShape(width, height);
    outer.holes.push(archShape(width, height, ft));
    const frame = new THREE.ExtrudeGeometry(outer, { depth: 0.06, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 2, curveSegments: 32 });
    const paint = paintedWood([1, 1], "#f3ece0");
    return {
      pane,
      frame,
      sky: new THREE.MeshBasicMaterial({ map: duskSky(), toneMapped: false }),
      paint: new THREE.MeshStandardMaterial({ map: paint.map, bumpMap: paint.bump, bumpScale: 0.4, roughness: 0.6 }),
    };
  }, [width, height]);

  return (
    <group>
      <mesh geometry={parts.pane} material={parts.sky} position={[0, 0, 0.01]} />
      <mesh geometry={parts.frame} material={parts.paint} castShadow />
      {/* mullions */}
      <mesh position={[0, height / 2, 0.04]} material={parts.paint}>
        <boxGeometry args={[0.03, height - 0.1, 0.03]} />
      </mesh>
      <mesh position={[0, height * 0.42, 0.04]} material={parts.paint}>
        <boxGeometry args={[width - 0.1, 0.03, 0.03]} />
      </mesh>
      {/* sill */}
      <mesh position={[0, -0.015, 0.06]} material={parts.paint} castShadow receiveShadow>
        <boxGeometry args={[width + 0.18, 0.04, 0.16]} />
      </mesh>
    </group>
  );
}

/** A dome pendant with a warm bulb. Origin at the bottom of the shade. */
export function PendantLamp({ drop = 3 }: { drop?: number }) {
  const shade = useMemo(
    () =>
      new THREE.LatheGeometry(
        Array.from({ length: 14 }, (_, i) => {
          const t = i / 13;
          return new THREE.Vector2(0.34 * Math.cos(t * Math.PI * 0.5) + 0.02, 0.26 * Math.sin(t * Math.PI * 0.5));
        }),
        48,
      ),
    [],
  );
  return (
    <group>
      <mesh geometry={shade} castShadow>
        <meshStandardMaterial color="#efe3cf" roughness={0.45} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.27, 0]}>
        <cylinderGeometry args={[0.045, 0.06, 0.06, 24]} />
        <meshStandardMaterial color={PALETTE.brass} metalness={0.8} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.27 + drop / 2, 0]}>
        <cylinderGeometry args={[0.006, 0.006, drop, 6]} />
        <meshStandardMaterial color="#2a2522" />
      </mesh>
      <mesh position={[0, 0.08, 0]}>
        <sphereGeometry args={[0.07, 20, 14]} />
        <meshBasicMaterial color="#fff4dc" toneMapped={false} />
      </mesh>
    </group>
  );
}
