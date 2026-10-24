"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Environment, Html, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { ACTION_POSES } from "@/lib/types";
import type { AvatarStageProps, FaceName, PoseName, Seat as SeatNo, StageBubble, StageMember } from "@/lib/types";
import { Avatar } from "./Avatar";
import { TABLE_TOP_Y } from "./shape";
import { ArchWindow, Chair, PALETTE, PendantLamp, Plant, RoomReflections } from "./furniture";
import { floorboards, paintedWood, paneling, plaque, plaster, woodGrain } from "./textures";
import { useWeather, type Weather } from "@/lib/weather";
import { SkyGlow, makeSkyMaterial, useSkyUniforms, type SkyUniforms } from "./WeatherWindow";

// First-person round table. I sit on the near side (the camera is my head);
// everyone else sits around the far arc facing the middle. On entry I stand
// in the hallway facing a closed double door; it swings open and the camera
// walks through to my chair, then turns toward whoever the player focuses.

const SEAT_R = 1.72;
// The avatar's seated poses rest the forearms exactly on TABLE_TOP_Y and reach
// about 0.25 forward, so the top sits there and its edge hugs every seat.
const TABLE_R = SEAT_R - 0.25;
const TABLE_Y = TABLE_TOP_Y - 0.03; // center of the 0.06-thick top
const EYE_Y = 1.3;
const HEAD_Y = 1.18; // seated head height, where the camera looks
const ARC = THREE.MathUtils.degToRad(68); // half-spread of the far arc
const MY_SEAT = new THREE.Vector3(0, EYE_Y, SEAT_R + 0.1);
const TABLE_MIDDLE = new THREE.Vector3(0, 0.95, -0.35);
// The entrance: a wall across the back of the room with a double door in it.
const WALL_Z = 5.4; // centre plane of the entrance wall
const WALL_T = 0.16;
const OPENING = { w: 1.4, h: 2.3 };
const DOOR = new THREE.Vector3(0, 1.5, 7.6); // where I stand in the hallway
const DOOR_LOOK = new THREE.Vector3(0, 1.75, 4); // through the doorway, high enough to read the plaque

// The walk_in beat length in the player. The leaves swing first, then the
// walk starts slow while they finish, so I never clip a door.
const INTRO_MS = 3200;
const DOOR_OPEN = { start: 200, end: 1150 };
const WALK = { start: 300, end: INTRO_MS };
const DOOR_ANGLE = THREE.MathUtils.degToRad(102);

interface Placed {
  member: StageMember;
  pos: THREE.Vector3;
  rotY: number;
}

function place(members: StageMember[]): Placed[] {
  const others = members.filter((m) => !m.isMe).sort((a, b) => a.seat - b.seat);
  return others.map((member, i) => {
    const t = others.length === 1 ? 0.5 : i / (others.length - 1);
    const theta = -ARC + t * ARC * 2; // 0 = straight across the table
    const pos = new THREE.Vector3(Math.sin(theta) * SEAT_R, 0, -Math.cos(theta) * SEAT_R);
    return { member, pos, rotY: -theta };
  });
}

export default function RoomStage3D({
  members,
  getTalkLevel,
  focusId,
  focusGroup = [],
  bubbles = {},
  title = "",
}: AvatarStageProps) {
  const placed = useMemo(() => place(members), [members]);
  const me = members.find((m) => m.isMe);
  const weather = useWeather();
  // Labels and bubbles mount here. Left to itself, drei's <Html> picks its
  // container from the event source, which connects after the first render;
  // the switch remounts its React root mid-render and the first seat's
  // bubbles never show.
  const overlay = useRef<HTMLDivElement>(null);
  // When the entrance started. The camera starts the clock and the door reads
  // it, so the swing and the walk stay in step.
  const introStart = useRef<number | null>(null);
  const getIntroStart = useCallback(() => introStart.current, []);
  const setIntroStart = useCallback((t: number | null) => {
    introStart.current = t;
  }, []);
  const [ready, setReady] = useState(false);

  return (
    <div className={`stage3d ${ready ? "is-ready" : ""}`} ref={overlay}>
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ position: DOOR.toArray(), fov: 58, near: 0.05, far: 40 }}
        gl={{ antialias: true }}
        onCreated={() => setReady(true)}
      >
        <color attach="background" args={["#2a2623"]} />
        <Environment resolution={64} environmentIntensity={0.5}>
          <RoomReflections />
        </Environment>
        <Surroundings weather={weather} />
        <Entrance title={title} getIntroStart={getIntroStart} />
        <directionalLight position={[-3, 2.5, -2]} intensity={0.45} color="#dfe5ff" />
        {/* a warm sconce in the hallway so the door reads before it opens */}
        <pointLight position={[0, 3.1, WALL_Z + 1.4]} intensity={7} distance={5} decay={1.3} color="#ffd9a8" />
        <Table />
        {placed.map((p) => (
          <Seat
            key={p.member.id}
            placed={p}
            all={placed}
            focusId={focusId ?? null}
            getTalkLevel={getTalkLevel}
            bubble={bubbles[p.member.id] ?? null}
            overlay={overlay}
          />
        ))}
        <CameraRig
          placed={placed}
          focusId={focusId ?? null}
          focusGroup={focusGroup}
          onIntroStart={setIntroStart}
          introKey={me?.action === "walk_in" ? me.actionKey : 0}
        />
      </Canvas>
    </div>
  );
}

// S-curves. The cubic is every camera move's; the gentler sine paces the walk
// in, which covers almost six meters and would sprint through the middle on
// the cubic.
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeInOutSine = (t: number) => (1 - Math.cos(Math.PI * t)) / 2;

type Mats = Record<string, THREE.Material>;
const surface = (s: { map: THREE.Texture; bump: THREE.Texture }, bumpScale: number, roughness: number, side: THREE.Side = THREE.FrontSide) =>
  new THREE.MeshStandardMaterial({ map: s.map, bumpMap: s.bump, bumpScale, roughness, side });

const ROOM_R = 5.6;
const ROOM_H = 3.5;

// The three arched windows behind the far arc look out on today's real
// weather, the same sky as the My Room window. They share one panorama, a
// little wider than the three panes so the walls between them hide a slice:
// the skyline runs on from pane to pane and the sun crosses them in a day.
const WINDOW = { w: 1.1, h: 1.85 };
const WINDOW_DEG = [-34, 0, 34];
const PANE_STEP = 1.3; // window widths from one pane's left edge to the next
const PANORAMA = PANE_STEP * (WINDOW_DEG.length - 1) + 1;

/** The room and its light, both following today's sky outside. */
function Surroundings({ weather }: { weather: Weather | null }) {
  const sky = useSkyUniforms(weather, WINDOW.w / WINDOW.h);
  return (
    <>
      <Room sky={sky} />
      <RoomLights sky={sky} />
    </>
  );
}

// Same idea as My Room: daylight by day, greyer under cloud, gold near
// sunset; after dark the room dims and the pendant over the table takes over.
// Reads the window's eased sky, so the light changes as smoothly as the view.
function RoomLights({ sky }: { sky: SkyUniforms }) {
  const ambient = useRef<THREE.AmbientLight>(null);
  const key = useRef<THREE.DirectionalLight>(null);
  const lamp = useRef<THREE.PointLight>(null);
  const C = useMemo(
    () => ({
      day: new THREE.Color("#fff3e2"),
      overcast: new THREE.Color("#e9eef4"),
      dusk: new THREE.Color("#ffd8b0"),
      night: new THREE.Color("#ffdcb4"),
      mix: new THREE.Color(),
    }),
    [],
  );

  useFrame(({ scene }) => {
    if (!ambient.current || !key.current || !lamp.current) return;
    const day = sky.uDay.value;
    const grey = Math.min(1, sky.uCloud.value * 1.2) * day;
    const golden = sky.uGolden.value * day;
    C.mix.copy(C.night).lerp(C.day, day).lerp(C.overcast, grey * 0.8).lerp(C.dusk, golden * 0.7);
    ambient.current.color.copy(C.mix);
    key.current.color.copy(C.mix);
    ambient.current.intensity = 0.22 + 0.36 * day - 0.06 * grey;
    key.current.intensity = 0.45 + 1.35 * day - 0.35 * grey;
    lamp.current.intensity = 7 + 7 * (1 - day);
    // the soft reflections dim with the daylight too, or night never reads
    scene.environmentIntensity = 0.24 + 0.26 * day;
  });

  return (
    <>
      <ambientLight ref={ambient} intensity={0.55} />
      <directionalLight
        ref={key}
        position={[2.2, 5, 2.6]}
        intensity={1.7}
        color="#fff3e2"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />
      {/* the pendant over the table */}
      <pointLight ref={lamp} position={[0, 2.25, 0]} intensity={7} distance={6.5} decay={1.6} color="#ffe2b8" />
    </>
  );
}

function Room({ sky }: { sky: SkyUniforms }) {
  const panes = useMemo(() => WINDOW_DEG.map((_, i) => makeSkyMaterial(sky, i * PANE_STEP, PANORAMA)), [sky]);
  const m: Mats = useMemo(
    () => ({
      floor: surface(floorboards([7, 7]), 0.8, 0.6),
      wall: surface(plaster([10, 1.2], PALETTE.cream), 1.2, 0.95, THREE.BackSide),
      wainscot: surface(paneling([28, 1], PALETTE.sage), 1, 0.7, THREE.BackSide),
      trim: new THREE.MeshStandardMaterial({ color: "#f4eee3", roughness: 0.55 }),
      ceiling: new THREE.MeshStandardMaterial({ color: "#f1ebe1", roughness: 1 }),
    }),
    [],
  );

  return (
    <group>
      <mesh position={[0, ROOM_H / 2, 0]} material={m.wall} receiveShadow>
        <cylinderGeometry args={[ROOM_R, ROOM_R, ROOM_H, 96, 1, true]} />
      </mesh>
      {/* sage paneling to chair-rail height */}
      <mesh position={[0, 0.475, 0]} material={m.wainscot} receiveShadow>
        <cylinderGeometry args={[ROOM_R - 0.02, ROOM_R - 0.02, 0.95, 96, 1, true]} />
      </mesh>
      {/* chair rail, broken where it would cross the doorway */}
      <group rotation={[0, THREE.MathUtils.degToRad(260), 0]}>
        <mesh position={[0, 0.96, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.trim}>
          <torusGeometry args={[ROOM_R - 0.03, 0.022, 8, 160, THREE.MathUtils.degToRad(340)]} />
        </mesh>
      </group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={m.floor} receiveShadow>
        <circleGeometry args={[ROOM_R, 96]} />
      </mesh>
      <mesh position={[0, ROOM_H, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.ceiling}>
        <circleGeometry args={[ROOM_R, 96]} />
      </mesh>
      {WINDOW_DEG.map((deg, i) => {
        const a = THREE.MathUtils.degToRad(deg);
        return (
          <group key={deg} position={[Math.sin(a) * (ROOM_R - 0.08), 1.1, -Math.cos(a) * (ROOM_R - 0.08)]} rotation={[0, -a, 0]}>
            <ArchWindow width={WINDOW.w} height={WINDOW.h} sky={panes[i]} />
          </group>
        );
      })}
      {/* the outside light (and any lightning) falling in across the table */}
      <SkyGlow sky={sky} strength={1.6} position={[0, 2.1, -4.2]} distance={7.5} decay={1.4} />
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 3.3, 0, -3.7]} rotation={[0, s * 0.8, 0]}>
          <Plant height={1.5} />
        </group>
      ))}
      <group position={[0, 2.3, 0]}>
        <PendantLamp drop={ROOM_H - 2.3 - 0.27} />
      </group>
    </group>
  );
}

function Table() {
  const m: Mats = useMemo(
    () => ({
      top: surface(woodGrain([2.4, 2.4], "#cfa274", "#ad7f52"), 0.35, 0.42),
      base: surface(woodGrain([1, 2], PALETTE.walnut.light, PALETTE.walnut.dark, true), 0.5, 0.5),
    }),
    [],
  );
  return (
    <group>
      <mesh position={[0, TABLE_Y, 0]} material={m.top} castShadow receiveShadow>
        <cylinderGeometry args={[TABLE_R - 0.03, TABLE_R - 0.03, 0.06, 96]} />
      </mesh>
      {/* a rounded rim instead of a cut edge */}
      <mesh position={[0, TABLE_Y, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.top} castShadow>
        <torusGeometry args={[TABLE_R - 0.03, 0.03, 12, 160]} />
      </mesh>
      <mesh position={[0, TABLE_Y / 2, 0]} material={m.base} castShadow>
        <cylinderGeometry args={[0.09, 0.13, TABLE_Y, 32]} />
      </mesh>
      <mesh position={[0, 0.03, 0]} material={m.base} castShadow receiveShadow>
        <cylinderGeometry args={[0.5, 0.56, 0.06, 64]} />
      </mesh>
      <ContactShadows position={[0, 0.002, 0]} opacity={0.4} scale={7} blur={2.6} far={2.5} />
    </group>
  );
}

/* ── the entrance ─────────────────────────────────────────── */

const LEAF = { w: OPENING.w / 2 - 0.004, h: OPENING.h - 0.01, t: 0.045 };

/** One door leaf. `s` = 1 hangs on the left jamb and closes toward +x; -1 the mirror. */
function Leaf({ s, leaf, m }: { s: 1 | -1; leaf: React.RefObject<THREE.Group | null>; m: Mats }) {
  const cx = (s * LEAF.w) / 2;
  const face = LEAF.t / 2 + 0.007;
  return (
    <group ref={leaf} position={[-s * (OPENING.w / 2), 0, WALL_Z]}>
      <RoundedBox args={[LEAF.w, LEAF.h, LEAF.t]} radius={0.008} smoothness={2} position={[cx, LEAF.h / 2, 0]} material={m.door} />
      {/* raised panels on both faces */}
      {[1, -1].map((side) =>
        [
          [1.6, 1.0],
          [0.62, 0.74],
        ].map(([y, h]) => (
          <RoundedBox
            key={`${side}${y}`}
            args={[LEAF.w - 0.2, h, 0.014]}
            radius={0.006}
            smoothness={2}
            position={[cx, y, side * face]}
            material={m.door}
          />
        )),
      )}
      {/* brass lever by the meeting edge */}
      <mesh position={[s * (LEAF.w - 0.075), 1.05, face + 0.004]} rotation={[Math.PI / 2, 0, 0]} material={m.brass}>
        <cylinderGeometry args={[0.028, 0.028, 0.012, 24]} />
      </mesh>
      <RoundedBox
        args={[0.12, 0.018, 0.018]}
        radius={0.008}
        smoothness={2}
        position={[s * (LEAF.w - 0.125), 1.05, face + 0.03]}
        material={m.brass}
      />
    </group>
  );
}

/** The wall I enter through, its double door, and a plaque with the room's name. */
function Entrance({ title, getIntroStart }: { title: string; getIntroStart: () => number | null }) {
  const leafL = useRef<THREE.Group>(null);
  const leafR = useRef<THREE.Group>(null);
  const m: Mats = useMemo(
    () => ({
      hall: surface(plaster([2.5, 1.2], "#8a8f96"), 1.2, 0.95),
      floor: surface(floorboards([3, 3], "#8c6b4f", "#563f2d"), 0.8, 0.6),
      door: surface(paintedWood([1, 2], "#3d6455"), 0.5, 0.45),
      casing: surface(paintedWood([1, 3], PALETTE.cream), 0.4, 0.55),
      brass: new THREE.MeshStandardMaterial({ color: PALETTE.brass, metalness: 0.85, roughness: 0.3 }),
    }),
    [],
  );
  const sign = useMemo(() => (title ? plaque(title) : null), [title]);

  // Leaves swing into the room: the left one turns +y, the right one -y.
  useFrame(() => {
    const start = getIntroStart();
    const t = start === null ? 0 : (performance.now() - start - DOOR_OPEN.start) / (DOOR_OPEN.end - DOOR_OPEN.start);
    const a = easeInOut(THREE.MathUtils.clamp(t, 0, 1)) * DOOR_ANGLE;
    if (leafL.current) leafL.current.rotation.y = a;
    if (leafR.current) leafR.current.rotation.y = -a;
  });

  const side = 4 - OPENING.w / 2; // wall width either side of the opening
  const front = WALL_Z + WALL_T / 2; // the hallway face
  return (
    <group>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (OPENING.w / 2 + side / 2), ROOM_H / 2, WALL_Z]} material={m.hall}>
          <boxGeometry args={[side, ROOM_H, WALL_T]} />
        </mesh>
      ))}
      <mesh position={[0, (ROOM_H + OPENING.h) / 2, WALL_Z]} material={m.hall}>
        <boxGeometry args={[OPENING.w, ROOM_H - OPENING.h, WALL_T]} />
      </mesh>
      {/* hallway floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, front + 2.8]} material={m.floor}>
        <planeGeometry args={[6, 5.6]} />
      </mesh>
      {/* casing around the opening */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (OPENING.w / 2 + 0.05), (OPENING.h + 0.1) / 2, front + 0.015]} material={m.casing}>
          <boxGeometry args={[0.1, OPENING.h + 0.1, 0.03]} />
        </mesh>
      ))}
      <mesh position={[0, OPENING.h + 0.05, front + 0.015]} material={m.casing}>
        <boxGeometry args={[OPENING.w + 0.2, 0.1, 0.03]} />
      </mesh>
      {sign && (
        <mesh position={[0, OPENING.h + 0.34, front + 0.006]}>
          <planeGeometry args={[1.0, 0.25]} />
          <meshStandardMaterial map={sign} roughness={0.4} />
        </mesh>
      )}
      <Leaf s={1} leaf={leafL} m={m} />
      <Leaf s={-1} leaf={leafR} m={m} />
    </group>
  );
}

const FX_EMOJI: Partial<Record<string, string>> = { freeze: "‼️" };

// Yaw (in the member's own frame) that turns their head toward a point.
function yawToward(from: THREE.Vector3, facing: number, to: THREE.Vector3): number {
  let yaw = Math.atan2(to.x - from.x, to.z - from.z) - facing;
  yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
  return THREE.MathUtils.clamp(yaw, -1.2, 1.2);
}

function Seat({
  placed,
  all,
  focusId,
  getTalkLevel,
  bubble,
  overlay,
}: {
  placed: Placed;
  all: Placed[];
  focusId: string | null;
  getTalkLevel: (id: string) => number;
  bubble: StageBubble | null;
  overlay: React.RefObject<HTMLDivElement | null>;
}) {
  const { member, pos, rotY } = placed;
  const group = useRef<THREE.Group>(null);
  const leave = useRef(0);
  const [step, setStep] = useState<{ pose: PoseName; face?: FaceName; emoji?: string } | null>(null);
  const talkLevel = useCallback(() => getTalkLevel(member.id), [getTalkLevel, member.id]);

  // Walk through the action's pose steps whenever a new action starts.
  useEffect(() => {
    const action = member.action;
    if (!action || action === "walk_in") return;
    const steps = ACTION_POSES[action];
    let i = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const run = () => {
      const s = steps[i];
      setStep({ pose: s.pose, face: s.face, emoji: s.emoji ?? FX_EMOJI[action] });
      if (s.ms > 0 && i < steps.length - 1) {
        timer = setTimeout(() => {
          i += 1;
          run();
        }, s.ms);
      }
    };
    run();
    return () => clearTimeout(timer);
    // a new actionKey is a new action, even with the same name
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member.actionKey]);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    // stand_leave: once the walk step starts, head out past the edge of the room
    const leaving = member.action === "stand_leave" && (step?.pose === "walk" || step?.pose === "walkAway");
    leave.current = leaving ? Math.min(leave.current + dt * 1.6, 6) : member.presence === "gone" ? 6 : 0;
    const out = pos.clone().normalize().multiplyScalar(leave.current);
    g.position.set(pos.x + out.x, 0, pos.z + out.z);
    g.rotation.y = leaving ? rotY + Math.PI : rotY;
  });

  const gone = member.presence === "gone" && member.action !== "stand_leave";
  const rest: PoseName = member.presence === "away" ? "slump" : "sit";
  const pose: PoseName = member.action && step ? step.pose : rest;
  const face: FaceName = (member.action && step?.face) || (member.presence === "away" ? "blank" : "neutral");
  const emoji = member.action ? step?.emoji : undefined;

  // Watching members turn to whoever is acting; "me" sits where the camera is.
  const lookSeat = member.lookAt;
  const focus =
    lookSeat !== null && lookSeat !== member.seat
      ? all.find((x) => x.member.seat === (lookSeat as SeatNo))
      : all.find((x) => x.member.id === focusId && x.member.id !== member.id);
  const lookPoint = focus ? focus.pos : focusId === "me" || lookSeat !== null ? MY_SEAT : TABLE_MIDDLE;
  const lookYaw = yawToward(pos, rotY, lookPoint);

  return (
    <group ref={group} position={pos} rotation={[0, rotY, 0]} visible={!gone}>
      <Chair />
      <Avatar config={member.avatar} pose={pose} face={face} seed={member.seat + 1} talkLevel={talkLevel} lookYaw={lookYaw} />
      <Html portal={overlay as React.RefObject<HTMLElement>} position={[0, 1.72, 0]} center zIndexRange={[40, 0]} className="html3d">
        <div className="above" hidden={gone}>
          {emoji && <span className="fx3d">{emoji}</span>}
          {bubble && <Bubble3D bubble={bubble} />}
        </div>
      </Html>
      <Html portal={overlay as React.RefObject<HTMLElement>} position={[0, 0.66, 0.42]} center zIndexRange={[30, 0]} className="html3d">
        <span hidden={gone} className={`tag3d ${member.presence === "away" && !member.action ? "is-away" : ""}`}>
          <i className="tag-dot" aria-hidden />
          {member.name}
        </span>
      </Html>
    </group>
  );
}

function formatSec(sec = 0): string {
  return `0:${String(Math.max(1, Math.round(sec))).padStart(2, "0")}`;
}

function Bubble3D({ bubble }: { bubble: StageBubble }) {
  return (
    <div key={bubble.key} className={`bubble3d kind-${bubble.kind}`}>
      {bubble.kind === "typing" && (
        <span className="typing" aria-label="typing">
          <i />
          <i />
          <i />
        </span>
      )}
      {bubble.kind === "voice" && (
        <span className="voice">
          <span className="bars" aria-hidden>
            <i />
            <i />
            <i />
            <i />
            <i />
          </span>
          <span className="num">{formatSec(bubble.voiceSec)}</span>
        </span>
      )}
      {(bubble.kind === "text" || bubble.kind === "unsent") && <span className="text">{bubble.text}</span>}
      {bubble.kind === "unsent" && <span className="unsent-tag">Unsent</span>}
    </div>
  );
}

const SHOT_MS = 1150;
const BASE_FOV = 58;

interface Shot {
  pos: THREE.Vector3;
  look: THREE.Vector3;
  fov: number;
}

function headOf(p: Placed): THREE.Vector3 {
  const slumped = p.member.presence === "away" && !p.member.action;
  return new THREE.Vector3(p.pos.x * 0.92, slumped ? 0.85 : HEAD_Y, p.pos.z * 0.92);
}

// One person: stay in my seat and turn to them. Two or more: lean back and
// widen until everyone in the beat fits.
function shotFor(targets: Placed[]): Shot {
  if (targets.length === 0) return { pos: MY_SEAT.clone(), look: TABLE_MIDDLE.clone(), fov: BASE_FOV };
  if (targets.length === 1) return { pos: MY_SEAT.clone(), look: headOf(targets[0]), fov: BASE_FOV - 6 };
  const heads = targets.map(headOf);
  const look = heads.reduce((a, h) => a.add(h), new THREE.Vector3()).multiplyScalar(1 / heads.length);
  const spread = Math.max(...heads.map((h) => h.x)) - Math.min(...heads.map((h) => h.x));
  const back = 0.7 + spread * 0.35;
  return {
    pos: new THREE.Vector3(look.x * 0.15, EYE_Y + 0.25 + spread * 0.08, SEAT_R + 0.1 + back),
    look,
    fov: Math.min(76, BASE_FOV + 6 + spread * 5),
  };
}

function CameraRig({
  placed,
  focusId,
  focusGroup,
  onIntroStart,
  introKey,
}: {
  placed: Placed[];
  focusId: string | null;
  focusGroup: string[];
  onIntroStart: (t: number | null) => void;
  introKey: number;
}) {
  // The entrance clock starts once the scene has drawn a couple of frames,
  // so the door's swing isn't spent behind the first shader compile.
  const clock = useRef({ key: 0, frames: 0, start: null as number | null });
  const from = useRef<Shot>({ pos: DOOR.clone(), look: TABLE_MIDDLE.clone(), fov: BASE_FOV });
  const to = useRef<Shot>({ pos: DOOR.clone(), look: TABLE_MIDDLE.clone(), fov: BASE_FOV });
  const cur = useRef<Shot>({ pos: DOOR.clone(), look: TABLE_MIDDLE.clone(), fov: BASE_FOV });
  const shotStart = useRef(0);
  const shotKey = useRef("");

  useFrame(({ camera }) => {
    const now = performance.now();
    const c = clock.current;
    if (introKey && c.key !== introKey) {
      c.key = introKey;
      c.frames = 0;
      c.start = null;
      onIntroStart(null);
    }
    if (c.key && c.start === null && ++c.frames > 2) {
      c.start = now;
      onIntroStart(now);
    }
    const elapsed = c.start === null ? 0 : now - c.start;

    if (elapsed < INTRO_MS) {
      // stand at the door while it swings, then walk through it to my chair
      const w = THREE.MathUtils.clamp((elapsed - WALK.start) / (WALK.end - WALK.start), 0, 1);
      cur.current.pos.lerpVectors(DOOR, MY_SEAT, easeInOutSine(w));
      cur.current.pos.y += Math.sin(w * Math.PI * 7) * 0.02 * Math.sin(w * Math.PI);
      cur.current.look.lerpVectors(DOOR_LOOK, TABLE_MIDDLE, easeInOut(w));
      cur.current.fov = BASE_FOV;
      shotKey.current = "";
    } else {
      const ids = focusGroup.length > 0 ? focusGroup : focusId && focusId !== "me" ? [focusId] : [];
      const targets = placed.filter((x) => ids.includes(x.member.id) && x.member.presence !== "gone");
      const key = targets.map((t) => `${t.member.id}:${t.member.presence}`).join("|");
      if (key !== shotKey.current) {
        // new shot: tween from wherever the camera is now
        shotKey.current = key;
        from.current = { pos: cur.current.pos.clone(), look: cur.current.look.clone(), fov: cur.current.fov };
        to.current = shotFor(targets);
        shotStart.current = now;
      }
      const e = easeInOut(Math.min(1, (now - shotStart.current) / SHOT_MS));
      cur.current.pos.lerpVectors(from.current.pos, to.current.pos, e);
      cur.current.look.lerpVectors(from.current.look, to.current.look, e);
      cur.current.fov = from.current.fov + (to.current.fov - from.current.fov) * e;
    }

    camera.position.copy(cur.current.pos);
    camera.lookAt(cur.current.look);
    const persp = camera as THREE.PerspectiveCamera;
    if (Math.abs(persp.fov - cur.current.fov) > 0.01) {
      persp.fov = cur.current.fov;
      persp.updateProjectionMatrix();
    }
  });

  return null;
}
