"use client";

import type { AvatarConfig } from "@/lib/types";
import { AVATAR_OPTIONS, randomAvatar } from "@/lib/avatar";
import { IconShuffle } from "@/components/icons";

// Edit mode controls, laid over My Room. There is no second canvas: the
// figure being edited is the one in the room, framed close by the home
// camera, and drags pass through this layer to turn it. The stick figure
// era only exposed the head color, so that is the only option for now; the
// other categories in AVATAR_OPTIONS come back with the shop. Nothing saves
// until Done.

interface WardrobeProps {
  open: boolean;
  draft: AvatarConfig;
  onChange: (avatar: AvatarConfig) => void;
  onCancel: () => void;
  onDone: () => void;
}

export function Wardrobe({ open, draft, onChange, onCancel, onDone }: WardrobeProps) {
  return (
    <div className={`wardrobe ${open ? "is-open" : ""}`} role="dialog" aria-modal="true" aria-label="Edit look" inert={!open}>
      <header className="wardrobe-bar">
        <button className="glass-btn" onClick={onCancel}>
          Cancel
        </button>
        <h2>Edit look</h2>
        <button className="glass-btn is-primary" onClick={onDone}>
          Done
        </button>
      </header>

      <p className="wardrobe-hint" aria-hidden>
        Drag to turn
      </p>

      <section className="wardrobe-panel" aria-label="Color">
        <div className="panel-head">
          <h3 className="panel-label">Color</h3>
          <button className="shuffle" onClick={() => onChange(randomAvatar())}>
            <IconShuffle /> Shuffle
          </button>
        </div>
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
                onClick={() => onChange({ ...draft, body: c })}
              />
            );
          })}
        </div>
      </section>
    </div>
  );
}
