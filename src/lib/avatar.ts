import { AvatarConfig, BagName } from '@/lib/types';

export const DEFAULT_AVATAR: AvatarConfig = {
  body: '#F2D98A',
  skin: '#F0C49C',
  legs: '#E8846B',
  shoes: '#5FB4E8',
  face: '#7CC5E8',
  hair: 'none',
  hairColor: '#6B4530',
  expression: 'happy',
  hat: 'none',
  hatColor: '#3D4466',
  glasses: 'none',
  glassesColor: '#F2669E',
  bag: 'none',
  bagColor: '#7CC5E8',
};

/** 왕관·후광 색 */
export const GOLD = '#F2C14E';

/* ── 상점 ─────────────────────────────────────────────────────
   모양이 있는 슬롯(헤어·표정·모자·안경·가방)의 목록과 가격. 색은 전부 무료다.
   각 목록의 첫 항목이 기본값이고, price가 없으면 무료다.
   데모에서는 심사위원이 전부 무료로 "구매"한다 (Wardrobe의 결제 시트). */

export type StyleSlot = 'hair' | 'expression' | 'hat' | 'glasses' | 'bag';

export interface StyleItem<T extends string = string> {
  id: T;
  name: string;
  /** USD. 없으면 무료 */
  price?: number;
}

export const STYLES: { [S in StyleSlot]: readonly StyleItem<AvatarConfig[S]>[] } = {
  hair: [
    { id: 'none', name: 'None' },
    { id: 'tuft', name: 'Tuft' },
    { id: 'buns', name: 'Space buns' },
    { id: 'bob', name: 'Bob', price: 1.99 },
    { id: 'spiky', name: 'Spiky', price: 1.99 },
    { id: 'curls', name: 'Curls', price: 2.99 },
  ],
  expression: [
    { id: 'happy', name: 'Happy' },
    { id: 'neutral', name: 'Chill' },
    { id: 'smirk', name: 'Smirk', price: 0.99 },
    { id: 'blank', name: 'Unbothered', price: 0.99 },
    { id: 'shock', name: 'Shook', price: 0.99 },
    { id: 'sad', name: 'Pout', price: 0.99 },
  ],
  hat: [
    { id: 'none', name: 'None' },
    { id: 'beanie', name: 'Beanie', price: 1.99 },
    { id: 'headphones', name: 'Headphones', price: 2.99 },
    { id: 'halo', name: 'Halo', price: 3.99 },
    { id: 'crown', name: 'Crown', price: 4.99 },
  ],
  glasses: [
    { id: 'none', name: 'None' },
    { id: 'round', name: 'Round' },
    { id: 'shutter', name: 'Shutter shades', price: 1.99 },
  ],
  bag: [
    { id: 'none', name: 'None' },
    { id: 'fanny', name: 'Fanny pack' },
    { id: 'crossbody', name: 'Crossbody', price: 1.99 },
    { id: 'backpack', name: 'Backpack', price: 2.99 },
  ],
};

export const STYLE_SLOTS = Object.keys(STYLES) as StyleSlot[];

/** 산 아이템을 저장할 때 쓰는 키. 예: 'hat:crown' */
export const itemKey = (slot: StyleSlot, id: string) => `${slot}:${id}`;

export const formatPrice = (usd: number) => `$${usd.toFixed(2)}`;

export interface LockedItem {
  key: string;
  slot: StyleSlot;
  item: StyleItem;
}

/** 이 모습에 들어간 유료 아이템 중 아직 안 산 것 */
export function lockedItems(cfg: AvatarConfig, owned: readonly string[]): LockedItem[] {
  return STYLE_SLOTS.flatMap((slot) => {
    const list: readonly StyleItem[] = STYLES[slot];
    const item = list.find((i) => i.id === cfg[slot]);
    const key = itemKey(slot, cfg[slot]);
    return item?.price && !owned.includes(key) ? [{ key, slot, item }] : [];
  });
}

/** 꾸미기 패널이 그리는 색 목록. 상점 아이템을 늘리려면 STYLES나 여기에 값만 추가한다. */
export const AVATAR_OPTIONS = {
  body:  ['#F2D98A', '#C9B6E8', '#9BB4E8', '#A8D8C4', '#D98A8A', '#F0F0F0'],
  skin:  ['#F0C49C', '#E0A878', '#C98A5C', '#9B6440', '#6B4530'],
  legs:  ['#E8846B', '#5FB4E8', '#7DC98A', '#E8C45F', '#B47DE8', '#3D4466'],
  shoes: ['#5FB4E8', '#F2669E', '#FFFFFF', '#3D4466', '#7DC98A'],
  face:  ['#7CC5E8', '#F2D98A', '#F0C49C', '#A8D8C4', '#E8A8C4'],
  hairColor: ['#2B2B3D', '#6B4530', '#C98A5C', '#E8C45F', '#F2669E', '#7CC5E8'],
  /** 모자·안경·가방 색 */
  accent: ['#5FB4E8', '#F2669E', '#B47DE8', '#7DC98A', '#3D4466', '#FFFFFF'],
  glasses: STYLES.glasses.map((i) => i.id),
  hair: STYLES.hair.map((i) => i.id),
  hat: STYLES.hat.map((i) => i.id),
  bag: STYLES.bag.map((i) => i.id),
} as const;

const pick = <T,>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)];

/** 기본값(목록의 첫 항목)이 extraFirst번 더 들어간 제비뽑기 */
function pickStyle<S extends StyleSlot>(slot: S, paid: boolean, extraFirst: number): AvatarConfig[S] {
  const ids = STYLES[slot].filter((i) => paid || !i.price).map((i) => i.id);
  return pick([...ids, ...Array<AvatarConfig[S]>(extraFirst).fill(ids[0])]);
}

/** paid가 false면 무료 아이템만 고른다 (첫 방문 캐릭터). 꾸미기의 Shuffle은 유료도 입혀 본다. */
export function randomAvatar(paid = false): AvatarConfig {
  return {
    body: pick(AVATAR_OPTIONS.body),
    skin: pick(AVATAR_OPTIONS.skin),
    legs: pick(AVATAR_OPTIONS.legs),
    shoes: pick(AVATAR_OPTIONS.shoes),
    face: pick(AVATAR_OPTIONS.face),
    hair: pickStyle('hair', paid, 1),
    hairColor: pick(AVATAR_OPTIONS.hairColor),
    expression: pickStyle('expression', paid, 2),
    hat: pickStyle('hat', paid, 3),
    hatColor: pick(AVATAR_OPTIONS.accent),
    glasses: pickStyle('glasses', paid, 1),
    glassesColor: pick(AVATAR_OPTIONS.accent),
    bag: pickStyle('bag', paid, 2),
    bagColor: pick(AVATAR_OPTIONS.accent),
  };
}

const INK = '#2B2B3D';

const svgUrl = (body: string) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${body}</svg>`)}`;

function eyesAndMouth(cfg: AvatarConfig): string {
  const line = (d: string) => `<path d="${d}" stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
  const dots = (h = 7) =>
    `<rect x="23.5" y="${29.5 - h / 2}" width="4" height="${h}" rx="2" fill="${INK}"/>` +
    `<rect x="36.5" y="${29.5 - h / 2}" width="4" height="${h}" rx="2" fill="${INK}"/>`;
  switch (cfg.expression) {
    case 'happy':
      return line('M22.5 30.5 Q25.5 25.5 28.5 30.5') + line('M35.5 30.5 Q38.5 25.5 41.5 30.5') +
        `<path d="M25 38 Q32 47.5 39 38 Z" fill="${INK}" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>`;
    case 'smirk':
      return `<rect x="23.5" y="26" width="4" height="7" rx="2" fill="${INK}"/>` + line('M35.5 30 L41.5 30') +
        line('M27 40.5 Q34 42.5 38.5 37.5');
    case 'blank':
      return line('M23 29.5 L28 29.5') + line('M36 29.5 L41 29.5') + line('M28 40.5 L36 40.5');
    case 'shock':
      return `<rect x="22.5" y="24.5" width="5.5" height="10" rx="2.75" fill="${INK}"/>` +
        `<rect x="36" y="24.5" width="5.5" height="10" rx="2.75" fill="${INK}"/>` +
        `<ellipse cx="32" cy="41" rx="3.2" ry="4" fill="${INK}"/>`;
    case 'sad':
      return dots() + line('M27 42.5 Q32 37.5 37 42.5');
    default:
      return dots() + line('M26 39 Q32 44 38 39');
  }
}

function glassesSvg(cfg: AvatarConfig): string {
  if (cfg.glasses === 'shutter') return `<rect x="14" y="25" width="36" height="9" rx="2" fill="${cfg.glassesColor}"/>`;
  if (cfg.glasses === 'round')
    return `<circle cx="25" cy="29" r="6" stroke="${cfg.glassesColor}" stroke-width="2.2" fill="none"/><circle cx="39" cy="29" r="6" stroke="${cfg.glassesColor}" stroke-width="2.2" fill="none"/>`;
  return '';
}

function hairSvg(cfg: AvatarConfig): string {
  const c = cfg.hairColor;
  switch (cfg.hair) {
    case 'tuft':
      return `<path d="M32 10 C31 5 34 1.5 38.5 2 M31 10 C29 6 25.5 4.5 22.5 6" stroke="${c}" stroke-width="3.4" fill="none" stroke-linecap="round"/>`;
    case 'buns':
      return `<circle cx="14" cy="10" r="7.5" fill="${c}"/><circle cx="50" cy="10" r="7.5" fill="${c}"/>`;
    case 'bob':
      return `<path d="M3 44 C1 18 15 3 32 3 C49 3 63 18 61 44 L53.5 44 C55 26 46 14.5 32 14.5 C18 14.5 9 26 10.5 44 Z" fill="${c}"/>`;
    case 'spiky':
      return `<path d="M7 24 L8.5 11 L15 15.5 L18 4.5 L25 11 L32 1 L39 11 L46 4.5 L49 15.5 L55.5 11 L57 24 C50 15 42 12.5 32 12.5 C22 12.5 14 15 7 24 Z" fill="${c}" stroke="${c}" stroke-width="1.5" stroke-linejoin="round"/>`;
    case 'curls':
      return [[9, 24, 6.5], [12, 15, 7], [21, 8, 7.5], [32, 5.5, 8], [43, 8, 7.5], [52, 15, 7], [55, 24, 6.5]]
        .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`)
        .join('');
    default:
      return '';
  }
}

function hatSvg(cfg: AvatarConfig): string {
  const c = cfg.hatColor;
  switch (cfg.hat) {
    case 'beanie':
      return `<path d="M9 19 C9 5 20 0.5 32 0.5 C44 0.5 55 5 55 19 Z" fill="${c}"/>` +
        `<rect x="5" y="14" width="54" height="9" rx="4.5" fill="${c}"/>` +
        `<rect x="5" y="14" width="54" height="9" rx="4.5" fill="#000" opacity="0.12"/>`;
    case 'headphones':
      return `<path d="M7 30 C7 11 19 3.5 32 3.5 C45 3.5 57 11 57 30" stroke="${c}" stroke-width="4" fill="none" stroke-linecap="round"/>` +
        `<rect x="1" y="24" width="11" height="18" rx="5.5" fill="${c}"/><rect x="52" y="24" width="11" height="18" rx="5.5" fill="${c}"/>`;
    case 'crown':
      return `<path d="M18 15 L18 4 L24.5 9.5 L32 1.5 L39.5 9.5 L46 4 L46 15 Z" fill="${GOLD}" stroke="${GOLD}" stroke-width="1.5" stroke-linejoin="round"/>` +
        `<circle cx="32" cy="11" r="2.2" fill="#F2669E"/>`;
    case 'halo':
      return `<ellipse cx="32" cy="5" rx="14" ry="3.8" fill="none" stroke="${GOLD}" stroke-width="3"/>`;
    default:
      return '';
  }
}

/** 작은 아이콘용 얼굴 SVG data URI.
 *  채팅 멤버 목록이나 꾸미기 타일처럼 3D Canvas를 띄우기 아까운 곳에 쓴다.
 *  무대 위 캐릭터는 <Avatar /> 컴포넌트를 쓸 것. */
export function avatarFaceUrl(cfg: AvatarConfig): string {
  return svgUrl(
    `<circle cx="32" cy="32" r="31" fill="${cfg.body}"/>` +
      `<circle cx="32" cy="32" r="21" fill="${cfg.face}"/>` +
      `<circle cx="18.5" cy="37" r="4" fill="#F2A0A0" opacity="0.65"/>` +
      `<circle cx="45.5" cy="37" r="4" fill="#F2A0A0" opacity="0.65"/>` +
      eyesAndMouth(cfg) +
      glassesSvg(cfg) +
      hairSvg(cfg) +
      hatSvg(cfg),
  );
}

/** 가방 타일 아이콘. 얼굴에는 가방이 안 보이니 가방만 그린다. */
export function bagIconUrl(bag: BagName, color: string): string {
  const accent = color.toUpperCase() === '#FFFFFF' ? '#3D4466' : '#FFFFFF';
  const shade = (shape: string) => shape.replace('/>', ` fill="#000" opacity="0.12"/>`);
  switch (bag) {
    case 'fanny':
      return svgUrl(
        `<path d="M3 27 Q32 37 61 27" stroke="${color}" stroke-width="4.5" fill="none" stroke-linecap="round"/>` +
          `<rect x="13" y="27" width="38" height="22" rx="11" fill="${color}"/>` +
          shade(`<rect x="13" y="40" width="38" height="9" rx="4.5"/>`) +
          `<path d="M20 34.5 Q32 37.5 44 34.5" stroke="${accent}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,
      );
    case 'crossbody':
      return svgUrl(
        `<path d="M12 4 L44 40" stroke="${color}" stroke-width="4.5" stroke-linecap="round"/>` +
          `<rect x="31" y="33" width="27" height="23" rx="7" fill="${color}"/>` +
          shade(`<path d="M31 40 Q31 33 38 33 L51 33 Q58 33 58 40 L58 45 L31 45 Z"/>`) +
          `<circle cx="44.5" cy="45" r="2.4" fill="${accent}"/>`,
      );
    case 'backpack':
      return svgUrl(
        `<path d="M25 13 Q32 2 39 13" stroke="${color}" stroke-width="4" fill="none" stroke-linecap="round"/>` +
          `<rect x="13" y="11" width="38" height="47" rx="13" fill="${color}"/>` +
          shade(`<rect x="19" y="35" width="26" height="17" rx="6"/>`) +
          `<path d="M24 39 L40 39" stroke="${accent}" stroke-width="2.2" stroke-linecap="round"/>`,
      );
    default:
      return '';
  }
}
