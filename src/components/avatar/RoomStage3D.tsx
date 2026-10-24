"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Html } from "@react-three/drei";
import * as THREE from "three";
import { ACTION_POSES } from "@/lib/types";
import type { AvatarStageProps, FaceName, PoseName, Seat as SeatNo, StageBubble, StageMember } from "@/lib/types";
import { Avatar } from "./Avatar";
import { TABLE_TOP_Y } from "./shape";

// First-person round table. I sit on the near side (the camera is my head);
// everyone else sits around the far arc facing the middle. The camera walks
// in from the door on entry, then turns toward whoever the player focuses.

const SEAT_R = 1.72;
// The avatar's seated poses rest the forearms exactly on TABLE_TOP_Y and reach
// about 0.25 forward, so the top sits there and its edge hugs every seat.
const TABLE_R = SEAT_R - 0.25;
const TABLE_Y = TABLE_TOP_Y - 0.03; // center of the 0.06-thick top
const EYE_Y = 1.3;
const HEAD_Y = 1.18; // seated head height, where the camera looks
const ARC = THREE.MathUtils.degToRad(68); // half-spread of the far arc
const DOOR = new THREE.Vector3(0, 1.55, 6.2);
const MY_SEAT = new THREE.Vector3(0, EYE_Y, SEAT_R + 0.1);
const TABLE_MIDDLE = new THREE.Vector3(0, 0.95, -0.35);
// Scene+ peek: head down on my arms, eyes just over the table edge.
const PEEK_EYE = new THREE.Vector3(0, TABLE_TOP_Y + 0.2, SEAT_R - 0.05);
const INTRO_MS = 2000; // the walk_in beat length in the player

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

export default function RoomStage3D({ members, getTalkLevel, focusId, focusGroup = [], bubbles = {}, peek = false }: AvatarStageProps) {
  const placed = useMemo(() => place(members), [members]);
  const me = members.find((m) => m.isMe);
  // Labels and bubbles mount here. Left to itself, drei's <Html> picks its
  // container from the event source, which connects after the first render;
  // the switch remounts its React root mid-render and the first seat's
  // bubbles never show.
  const overlay = useRef<HTMLDivElement>(null);

  return (
    <div className="stage3d" ref={overlay}>
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: DOOR.toArray(), fov: 58, near: 0.05, far: 40 }} gl={{ antialias: true }}>
        <Room />
        <ambientLight intensity={1.1} />
        <directionalLight position={[2.2, 5, 2.6]} intensity={2} castShadow shadow-mapSize={[1024, 1024]} />
        <directionalLight position={[-3, 2.5, -2]} intensity={0.55} />
        <pointLight position={[0, 2.6, 0]} intensity={6} distance={6} color="#fff1df" />
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
          peek={peek}
          introKey={me?.action === "walk_in" ? me.actionKey : 0}
        />
      </Canvas>
    </div>
  );
}

function Room() {
  return (
    <group>
      <mesh position={[0, 2.5, 0]}>
        <cylinderGeometry args={[5.6, 5.6, 5, 48, 1, true]} />
        <meshStandardMaterial color="#e9e4dc" side={THREE.BackSide} roughness={0.95} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[5.6, 48]} />
        <meshStandardMaterial color="#cfc7bb" roughness={1} />
      </mesh>
      {/* the door I came in through, behind me */}
      <mesh position={[0, 1.1, 5.55]}>
        <boxGeometry args={[1.1, 2.2, 0.06]} />
        <meshStandardMaterial color="#141418" roughness={0.6} />
      </mesh>
    </group>
  );
}

function Table() {
  return (
    <group>
      <mesh position={[0, TABLE_Y, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[TABLE_R, TABLE_R, 0.06, 64]} />
        <meshStandardMaterial color="#f4f1ea" roughness={0.55} />
      </mesh>
      <mesh position={[0, TABLE_Y / 2, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.12, TABLE_Y, 24]} />
        <meshStandardMaterial color="#141418" roughness={0.5} />
      </mesh>
      <ContactShadows position={[0, 0.002, 0]} opacity={0.4} scale={7} blur={2.6} far={2.5} />
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
  const cue = member.cue ?? null;
  const face: FaceName =
    (member.action && step?.face) || cue?.face || (member.presence === "away" ? "blank" : "neutral");
  const emoji = member.action ? step?.emoji : cue?.emoji;

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
          {emoji && (
            <span key={member.action ? member.actionKey : cue?.key} className="fx3d">
              {emoji}
            </span>
          )}
          {bubble && <Bubble3D bubble={bubble} />}
        </div>
      </Html>
      <Html portal={overlay as React.RefObject<HTMLElement>} position={[0, 0.66, 0.42]} center zIndexRange={[30, 0]} className="html3d">
        <span hidden={gone} className={`tag3d ${member.presence === "away" && !member.action ? "is-away" : ""}`}>
          {member.name}
        </span>
      </Html>
    </group>
  );
}

// Sized for the avatar: the seat top is at 0.34 (its hips sit at 0.40), and the
// back stays low and far enough behind that leaning back to laugh doesn't go
// through it.
function Chair() {
  return (
    <group>
      <mesh position={[0, 0.31, -0.165]} castShadow>
        <boxGeometry args={[0.6, 0.06, 0.67]} />
        <meshStandardMaterial color="#141418" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.6, -0.53]} castShadow>
        <boxGeometry args={[0.6, 0.52, 0.06]} />
        <meshStandardMaterial color="#141418" roughness={0.5} />
      </mesh>
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

// S-curve: slow out, fast through the middle, slow in. Every camera move
// (the walk-in and every change of shot) uses it.
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

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
// widen until everyone in the beat fits. Peeking keeps the same aim from just
// over the table edge.
function shotFor(targets: Placed[], peek: boolean): Shot {
  const shot = seatedShot(targets);
  if (!peek) return shot;
  const look = shot.look.clone();
  look.y = Math.max(look.y, HEAD_Y);
  return { pos: PEEK_EYE.clone(), look, fov: Math.max(shot.fov, BASE_FOV) };
}

function seatedShot(targets: Placed[]): Shot {
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
  peek,
  introKey,
}: {
  placed: Placed[];
  focusId: string | null;
  focusGroup: string[];
  peek: boolean;
  introKey: number;
}) {
  const introStart = useRef<number | null>(null);
  const from = useRef<Shot>({ pos: DOOR.clone(), look: TABLE_MIDDLE.clone(), fov: BASE_FOV });
  const to = useRef<Shot>({ pos: DOOR.clone(), look: TABLE_MIDDLE.clone(), fov: BASE_FOV });
  const cur = useRef<Shot>({ pos: DOOR.clone(), look: TABLE_MIDDLE.clone(), fov: BASE_FOV });
  const shotStart = useRef(0);
  const shotKey = useRef("");
  const shotMs = useRef(SHOT_MS);

  useEffect(() => {
    if (introKey) introStart.current = performance.now();
  }, [introKey]);

  useFrame(({ camera }) => {
    const now = performance.now();
    const start = introStart.current;
    const p = start === null ? 0 : Math.min(1, (now - start) / INTRO_MS);

    if (p < 1) {
      // walk in from the door to my chair
      const e = easeInOut(p);
      cur.current.pos.lerpVectors(DOOR, MY_SEAT, e);
      cur.current.pos.y += Math.sin(p * Math.PI * 6) * 0.025 * (1 - p);
      cur.current.look.copy(TABLE_MIDDLE);
      cur.current.fov = BASE_FOV;
      shotKey.current = "";
    } else {
      const ids = focusGroup.length > 0 ? focusGroup : focusId && focusId !== "me" ? [focusId] : [];
      const targets = placed.filter((x) => ids.includes(x.member.id) && x.member.presence !== "gone");
      const key = (peek ? "peek>" : "") + targets.map((t) => `${t.member.id}:${t.member.presence}`).join("|");
      if (key !== shotKey.current) {
        // new shot: tween from wherever the camera is now. Putting my head
        // down or popping it back up is quicker than turning it.
        const ducking = key.startsWith("peek>") !== shotKey.current.startsWith("peek>");
        shotKey.current = key;
        shotMs.current = ducking ? (peek ? 650 : 420) : SHOT_MS;
        from.current = { pos: cur.current.pos.clone(), look: cur.current.look.clone(), fov: cur.current.fov };
        to.current = shotFor(targets, peek);
        shotStart.current = now;
      }
      const e = easeInOut(Math.min(1, (now - shotStart.current) / shotMs.current));
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
