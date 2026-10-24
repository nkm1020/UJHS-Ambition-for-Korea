"use client";

import type { AvatarStandProps } from "@/lib/types";
import { FlatAvatar } from "./FlatAvatar";

// 2D placeholder for the standing avatar in My Room. With `focus` it scales
// up on the same S-curve the 3D camera zooms on.

export function AvatarStand2D({ avatar, focus = false }: AvatarStandProps) {
  const look = Object.values(avatar).join("|");
  return (
    <div className={`stand2d ${focus ? "is-focus" : ""}`}>
      <div key={look} className="stand2d-pop">
        <FlatAvatar avatar={avatar} pose="stand" size={150} />
      </div>
      <div className="stand2d-shadow" />
    </div>
  );
}
