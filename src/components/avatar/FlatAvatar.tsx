"use client";

import { useEffect, useRef } from "react";
import type { ActionName, AvatarConfig, FaceName, Presence } from "@/lib/types";

// 2D stand-in avatar. Everything is sized in em, so the root font-size
// (size / 10) scales the whole character.

const FX: Partial<Record<ActionName, string>> = {
  read_ignore: "👀",
  startle_up: "💦",
  heart: "🫶",
  laugh: "😂",
  freeze: "‼️",
};

// Actions that show open eyes even when the resting pose is slumped.
const EYES_OPEN: ActionName[] = ["read_ignore", "startle_up", "typing_stop", "talk", "cover_mouth", "walk_in"];

interface FlatAvatarProps {
  avatar: AvatarConfig;
  pose: "stand" | "sit";
  size: number;
  presence?: Presence;
  action?: ActionName | null;
  look?: -1 | 0 | 1;
  talkId?: string;
  getTalkLevel?: (memberId: string) => number;
  /** My Room's standing figure wears the picked expression; the table leaves it to the actions */
  expression?: FaceName;
}

export function FlatAvatar({
  avatar,
  pose,
  size,
  presence = "watching",
  action = null,
  look = 0,
  talkId,
  getTalkLevel,
  expression,
}: FlatAvatarProps) {
  const mouthRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!getTalkLevel || !talkId) return;
    let frame = 0;
    const tick = () => {
      const level = Math.max(0, Math.min(1, getTalkLevel(talkId)));
      if (mouthRef.current) mouthRef.current.style.transform = `scaleY(${0.35 + level * 1.9})`;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [getTalkLevel, talkId]);

  const eyesClosed = presence === "away" && !(action && EYES_OPEN.includes(action));
  const fx = action ? FX[action] : undefined;

  return (
    <div
      className={[
        "fa",
        `fa-${pose}`,
        `is-${presence}`,
        action ? `act-${action}` : "",
        eyesClosed ? "eyes-closed" : "",
        expression ? `ex-${expression}` : "",
      ].join(" ")}
      style={
        {
          fontSize: size / 10,
          "--body": avatar.body,
          "--face": avatar.face,
          "--skin": avatar.skin,
          "--legs": avatar.legs,
          "--shoes": avatar.shoes,
          "--glasses": avatar.glassesColor,
          "--bag": avatar.bagColor,
          "--hair": avatar.hairColor,
          "--hat": avatar.hatColor,
          "--look": look,
        } as React.CSSProperties
      }
    >
      <div className="fa-inner">
        {pose === "stand" && (
          <div className="fa-legs">
            <i />
            <i />
          </div>
        )}
        <div className="fa-body" />
        {avatar.bag !== "none" && <div className={`fa-bag b-${avatar.bag}`} />}
        <div className="fa-arm l" />
        <div className="fa-arm r" />
        <div className="fa-headwrap">
          <div className="fa-head">
            <div className="fa-face">
              <div className="fa-eyes">
                <i />
                <i />
                {avatar.glasses !== "none" && (
                  <div className={`fa-glasses g-${avatar.glasses}`}>
                    <span />
                    <span />
                  </div>
                )}
              </div>
              <div className="fa-cheeks">
                <i />
                <i />
              </div>
              <div className="fa-mouth" ref={mouthRef} />
            </div>
            {avatar.hair !== "none" && avatar.hat !== "beanie" && <div className={`fa-hair h-${avatar.hair}`} />}
            {avatar.hat !== "none" && <div className={`fa-hat t-${avatar.hat}`} />}
            <div className="fa-hand" />
          </div>
        </div>
        {presence === "away" && !action && (
          <div className="fa-zz" aria-hidden>
            <span>z</span>
            <span>z</span>
          </div>
        )}
        {fx && (
          <div className="fa-fx" aria-hidden>
            {fx}
          </div>
        )}
      </div>
    </div>
  );
}
