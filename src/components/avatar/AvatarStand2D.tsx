"use client";

import type { AvatarStandProps } from "@/lib/types";
import { FlatAvatar } from "./FlatAvatar";

// 2D placeholder for the standing avatar in My Room. With `focus` it moves
// up, on the same S-curve as the 3D camera, into the space above the
// wardrobe panel.

export function AvatarStand2D({ avatar, focus = false, face }: AvatarStandProps) {
  const look = Object.values(avatar).join("|");
  return (
    <div className={`stand2d ${focus ? "is-focus" : ""}`}>
      <div key={look} className="stand2d-pop">
        <FlatAvatar avatar={avatar} pose="stand" size={150} expression={face ?? avatar.expression} />
      </div>
      <div className="stand2d-shadow" />
    </div>
  );
}
