"use client";

import { Component, type ReactNode } from "react";
import dynamic from "next/dynamic";
import type { AvatarStageProps, AvatarStandProps } from "@/lib/types";
import { AvatarStage2D } from "./AvatarStage2D";
import { AvatarStand2D } from "./AvatarStand2D";

// Swap point for the avatar renderer. 3D when the device can make a WebGL
// context; the 2D stand-ins otherwise, or if the canvas throws at runtime.
// The app renders client-side only, so this check runs in the browser.

function detectWebGL(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export const STAGE_MODE: "3d" | "2d" = detectWebGL() ? "3d" : "2d";

const RoomStage3D = dynamic(() => import("./RoomStage3D"), { ssr: false });
const HomeStage3D = dynamic(() => import("./HomeStage3D"), { ssr: false });

class Fallback extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function AvatarStage(props: AvatarStageProps) {
  if (STAGE_MODE === "2d") return <AvatarStage2D {...props} />;
  return (
    <Fallback fallback={<AvatarStage2D {...props} />}>
      <RoomStage3D {...props} />
    </Fallback>
  );
}

/** My Room space (and the wardrobe preview when `spin`). */
export function AvatarStand(props: AvatarStandProps) {
  if (STAGE_MODE === "2d") return <AvatarStand2D {...props} />;
  return (
    <Fallback fallback={<AvatarStand2D {...props} />}>
      <HomeStage3D {...props} />
    </Fallback>
  );
}
