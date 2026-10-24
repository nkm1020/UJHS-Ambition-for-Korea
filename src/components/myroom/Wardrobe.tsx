"use client";

import { useState } from "react";
import type { AvatarConfig } from "@/lib/types";
import { AVATAR_OPTIONS, randomAvatar } from "@/lib/avatar";
import { AvatarStand } from "@/components/avatar";
import { IconShuffle } from "@/components/icons";

// Full-screen edit mode. The stick figure only shows a head color, so that is
// the only option for now; the real avatar brings back the other categories
// from AVATAR_OPTIONS. Nothing saves until Done.

interface WardrobeProps {
  avatar: AvatarConfig;
  onCancel: () => void;
  onDone: (avatar: AvatarConfig) => void;
}

export function Wardrobe({ avatar, onCancel, onDone }: WardrobeProps) {
  const [draft, setDraft] = useState(avatar);

  return (
    <div className="wardrobe" role="dialog" aria-modal="true" aria-label="Edit look">
      <header className="modal-bar">
        <button className="text-btn" onClick={onCancel}>
          Cancel
        </button>
        <h2>Edit look</h2>
        <button className="text-btn strong" onClick={() => onDone(draft)}>
          Done
        </button>
      </header>

      <div className="wardrobe-stage">
        <AvatarStand avatar={draft} spin />
      </div>

      <section className="wardrobe-panel" aria-label="Color">
        <h3 className="panel-label">Color</h3>
        <div className="options">
          {AVATAR_OPTIONS.body.map((c, i) => {
            const on = draft.body === c;
            return (
              <button
                key={c}
                aria-label={`Color ${i + 1}`}
                aria-pressed={on}
                className={`swatch ${on ? "is-on" : ""}`}
                style={{ "--c": c } as React.CSSProperties}
                onClick={() => setDraft({ ...draft, body: c })}
              />
            );
          })}
        </div>
        <button className="shuffle" onClick={() => setDraft(randomAvatar())}>
          <IconShuffle /> Shuffle
        </button>
      </section>
    </div>
  );
}
