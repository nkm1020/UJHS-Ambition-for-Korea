"use client";

import type { AvatarStandProps } from "@/lib/types";
import { FlatAvatar } from "./FlatAvatar";

// 2D placeholder for the standing avatar in My Room.

export function AvatarStand2D({ avatar }: AvatarStandProps) {
  const look = Object.values(avatar).join("|");
  return (
    <div className="stand2d">
      <div key={look} className="stand2d-pop">
        <FlatAvatar avatar={avatar} pose="stand" size={150} />
      </div>
      <div className="stand2d-shadow" />
    </div>
  );
}
