"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { AvatarConfig, BagName } from "@/lib/types";
import {
  AVATAR_OPTIONS,
  STYLES,
  avatarFaceUrl,
  bagIconUrl,
  formatPrice,
  itemKey,
  lockedItems,
  randomAvatar,
  type StyleItem,
  type StyleSlot,
} from "@/lib/avatar";
import { useMe } from "@/lib/me";
import { IconShuffle } from "@/components/icons";

// Edit mode controls, laid over My Room. There is no second canvas: the
// figure being edited is the one in the room, framed by the home camera
// above this panel, and drags pass through this layer to turn it.
// The panel scrolls through the categories; the chips jump between them.
// Paid items try on for free: they go straight onto the figure with a
// price tag, and unlocking happens at checkout (Get, or Done with a paid
// item on). The demo is for judges, so checkout takes no payment.
// Nothing saves until Done.

interface WardrobeProps {
  open: boolean;
  draft: AvatarConfig;
  onChange: (avatar: AvatarConfig) => void;
  onCancel: () => void;
  onDone: () => void;
}

const CATEGORIES = [
  { id: "body", label: "Body" },
  { id: "hair", label: "Hair" },
  { id: "expression", label: "Expression" },
  { id: "hat", label: "Hats" },
  { id: "glasses", label: "Glasses" },
  { id: "bag", label: "Bags" },
  { id: "legs", label: "Pants" },
  { id: "shoes", label: "Shoes" },
] as const;

type CategoryId = (typeof CATEGORIES)[number]["id"];

type ColorKey = "body" | "face" | "skin" | "legs" | "shoes" | "hairColor" | "hatColor" | "glassesColor" | "bagColor";

const SLOT_LABEL: Record<StyleSlot, string> = {
  hair: "Hair",
  expression: "Expression",
  hat: "Hats",
  glasses: "Glasses",
  bag: "Bags",
};

/** The tile picture: your own face wearing that option, so you see it on you. */
function tileImage(slot: StyleSlot, id: string, draft: AvatarConfig): string | null {
  if (id === "none") return null;
  if (slot === "bag") return bagIconUrl(id as BagName, draft.bagColor);
  const look = { ...draft, [slot]: id } as AvatarConfig;
  if (slot === "hair") look.hat = "none"; // a hat would hide the hair
  if (slot === "expression") look.glasses = "none"; // shades would hide the eyes
  return avatarFaceUrl(look);
}

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function Wardrobe({ open, draft, onChange, onCancel, onDone }: WardrobeProps) {
  const { me, unlock } = useMe();
  const owned = me.owned;
  const [active, setActive] = useState<CategoryId>("body");
  const [checkout, setCheckout] = useState<"get" | "done" | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const tabs = useRef<HTMLElement>(null);
  const sections = useRef<Partial<Record<CategoryId, HTMLElement | null>>>({});
  const jumpingUntil = useRef(0);
  const getButton = useRef<HTMLButtonElement>(null);

  const locked = useMemo(() => lockedItems(draft, owned), [draft, owned]);
  const total = locked.reduce((sum, l) => sum + (l.item.price ?? 0), 0);

  const set = <K extends keyof AvatarConfig>(key: K, value: AvatarConfig[K]) => onChange({ ...draft, [key]: value });

  // Each visit starts at the top of the list.
  useEffect(() => {
    if (open) scroller.current?.scrollTo({ top: 0 });
  }, [open]);

  // Scroll spy: the chip follows whichever section is at the top.
  const onScroll = () => {
    const el = scroller.current;
    if (!el || Date.now() < jumpingUntil.current) return;
    let current: CategoryId = CATEGORIES[0].id;
    if (el.scrollTop > 0 && el.scrollTop + el.clientHeight >= el.scrollHeight - 4) {
      current = CATEGORIES[CATEGORIES.length - 1].id;
    } else {
      for (const c of CATEGORIES) {
        const s = sections.current[c.id];
        if (s && s.offsetTop <= el.scrollTop + 24) current = c.id;
      }
    }
    setActive(current);
  };

  const jump = (id: CategoryId) => {
    const el = scroller.current;
    const s = sections.current[id];
    if (!el || !s) return;
    setActive(id);
    jumpingUntil.current = Date.now() + 700;
    el.scrollTo({ top: s.offsetTop, behavior: reducedMotion() ? "auto" : "smooth" });
  };

  // Keep the active chip in view when the list scrolls past the visible chips.
  useEffect(() => {
    const row = tabs.current;
    const chip = row?.querySelector<HTMLElement>(`[data-cat="${active}"]`);
    if (!row || !chip) return;
    const left = chip.offsetLeft - (row.clientWidth - chip.offsetWidth) / 2;
    row.scrollTo({ left, behavior: reducedMotion() ? "auto" : "smooth" });
  }, [active]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!checkout) return;
    // The sheet slides up from below the frame; a plain focus (or autoFocus)
    // would scroll the whole app frame to reach the button mid-animation.
    getButton.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setCheckout(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [checkout]);

  const done = () => (locked.length ? setCheckout("done") : onDone());

  const confirm = () => {
    unlock(locked.map((l) => l.key));
    setCheckout(null);
    if (checkout === "done") onDone();
    else setToast(locked.length === 1 ? `${locked[0].item.name} unlocked` : `${locked.length} items unlocked`);
  };

  const section = (id: CategoryId, title: string, children: ReactNode) => (
    <section
      key={id}
      ref={(el) => {
        sections.current[id] = el;
      }}
      className="wardrobe-section"
      aria-labelledby={`wardrobe-${id}`}
    >
      <h3 className="panel-label" id={`wardrobe-${id}`}>
        {title}
      </h3>
      {children}
    </section>
  );

  const swatches = (label: string, key: ColorKey, colors: readonly string[]) => (
    <div className="options" role="group" aria-label={label}>
      {colors.map((c, i) => {
        const on = draft[key] === c;
        return (
          <button
            key={c}
            aria-label={`${label} ${i + 1}`}
            aria-pressed={on}
            className={`swatch ${on ? "is-on" : ""}`}
            style={{ "--c": c } as CSSProperties}
            onClick={() => set(key, c)}
          />
        );
      })}
    </div>
  );

  const subSwatches = (label: string, key: ColorKey, colors: readonly string[]) => (
    <>
      <h4 className="sub-label">{label}</h4>
      {swatches(label, key, colors)}
    </>
  );

  const styleTiles = (slot: StyleSlot) => {
    const items: readonly StyleItem[] = STYLES[slot];
    return (
      <div className="tiles">
        {items.map((it) => {
          const on = draft[slot] === it.id;
          const paid = !!it.price && !owned.includes(itemKey(slot, it.id));
          const img = tileImage(slot, it.id, draft);
          return (
            <button
              key={it.id}
              className={`tile ${on ? "is-on" : ""}`}
              aria-pressed={on}
              aria-label={paid ? `${it.name}, ${formatPrice(it.price!)}` : it.name}
              onClick={() => onChange({ ...draft, [slot]: it.id } as AvatarConfig)}
            >
              {img ? (
                <span className="tile-img" style={{ backgroundImage: `url("${img}")` }} aria-hidden />
              ) : (
                <span className="tile-none" aria-hidden />
              )}
              <span className="tile-name">{it.name}</span>
              {paid && <span className="tile-price">{formatPrice(it.price!)}</span>}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className={`wardrobe ${open ? "is-open" : ""}`} role="dialog" aria-modal="true" aria-label="Edit look" inert={!open}>
      <header className="wardrobe-bar">
        <button className="glass-btn" onClick={onCancel}>
          Cancel
        </button>
        <h2>Edit look</h2>
        <button className="glass-btn is-primary" onClick={done}>
          Done
        </button>
      </header>

      <p className="wardrobe-hint" aria-hidden>
        Drag to turn
      </p>

      {toast && (
        <div className="wardrobe-toast" role="status">
          {toast}
        </div>
      )}

      <section className="wardrobe-panel" aria-label="Customize">
        <div className="wardrobe-top">
          <nav ref={tabs} className="wardrobe-tabs" aria-label="Categories">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                data-cat={c.id}
                className={active === c.id ? "is-on" : ""}
                aria-current={active === c.id ? "true" : undefined}
                onClick={() => jump(c.id)}
              >
                {c.label}
              </button>
            ))}
          </nav>
          <button className="shuffle" onClick={() => onChange(randomAvatar(true))}>
            <IconShuffle /> Shuffle
          </button>
        </div>

        <div ref={scroller} className="wardrobe-scroll" onScroll={onScroll}>
          {section(
            "body",
            "Body",
            <>
              {swatches("Body color", "body", AVATAR_OPTIONS.body)}
              {subSwatches("Face", "face", AVATAR_OPTIONS.face)}
              {subSwatches("Arms", "skin", AVATAR_OPTIONS.skin)}
            </>,
          )}
          {section(
            "hair",
            "Hair",
            <>
              {styleTiles("hair")}
              {draft.hair !== "none" && subSwatches("Hair color", "hairColor", AVATAR_OPTIONS.hairColor)}
            </>,
          )}
          {section("expression", "Expression", styleTiles("expression"))}
          {section(
            "hat",
            "Hats",
            <>
              {styleTiles("hat")}
              {(draft.hat === "beanie" || draft.hat === "headphones") && subSwatches("Hat color", "hatColor", AVATAR_OPTIONS.accent)}
            </>,
          )}
          {section(
            "glasses",
            "Glasses",
            <>
              {styleTiles("glasses")}
              {draft.glasses !== "none" && subSwatches("Frame color", "glassesColor", AVATAR_OPTIONS.accent)}
            </>,
          )}
          {section(
            "bag",
            "Bags",
            <>
              {styleTiles("bag")}
              {draft.bag !== "none" && subSwatches("Bag color", "bagColor", AVATAR_OPTIONS.accent)}
            </>,
          )}
          {section("legs", "Pants", swatches("Pants color", "legs", AVATAR_OPTIONS.legs))}
          {section("shoes", "Shoes", swatches("Shoe color", "shoes", AVATAR_OPTIONS.shoes))}
        </div>

        {locked.length > 0 && (
          <div className="unlock-bar" role="region" aria-label="Paid items you are trying on">
            <div className="unlock-text">
              <strong>{locked.map((l) => l.item.name).join(", ")}</strong>
              <span>
                <s>{formatPrice(total)}</s> Free for judges
              </span>
            </div>
            <button className="unlock-btn" onClick={() => setCheckout("get")}>
              Get
            </button>
          </div>
        )}
      </section>

      {open && checkout && (
        <div className="checkout" role="dialog" aria-modal="true" aria-labelledby="checkout-title">
          <button className="checkout-scrim" aria-label="Close" onClick={() => setCheckout(null)} />
          <div className="checkout-sheet">
            <div className="checkout-grabber" aria-hidden />
            <h2 id="checkout-title">{checkout === "done" ? "Keep this look?" : locked.length === 1 ? "Unlock item" : "Unlock items"}</h2>
            {checkout === "done" && <p className="checkout-sub">It has items you haven&apos;t unlocked yet.</p>}
            <ul className="checkout-list">
              {locked.map((l) => (
                <li key={l.key}>
                  <span
                    className="checkout-thumb"
                    style={{ backgroundImage: `url("${tileImage(l.slot, l.item.id, draft)}")` }}
                    aria-hidden
                  />
                  <span className="checkout-name">
                    {l.item.name}
                    <small>{SLOT_LABEL[l.slot]}</small>
                  </span>
                  <span className="checkout-price">
                    <s>{formatPrice(l.item.price ?? 0)}</s> Free
                  </span>
                </li>
              ))}
            </ul>
            <div className="checkout-total">
              <span>Total</span>
              <span>
                <s>{formatPrice(total)}</s> $0.00
              </span>
            </div>
            <button ref={getButton} className="primary-btn" onClick={confirm}>
              {checkout === "done" ? "Get free and save" : "Get for free"}
            </button>
            <p className="checkout-note">Judges&apos; demo: everything is free and no payment is taken. The prices show what these cost in Scene.</p>
            <button className="text-btn quiet" onClick={() => setCheckout(null)}>
              Not now
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
