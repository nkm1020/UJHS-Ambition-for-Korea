import { AvatarConfig, GlassesName } from '@/lib/types';

export const DEFAULT_AVATAR: AvatarConfig = {
  body: '#F2D98A',
  skin: '#F0C49C',
  legs: '#E8846B',
  shoes: '#5FB4E8',
  face: '#7CC5E8',
  glasses: 'none',
  glassesColor: '#F2669E',
  bag: false,
  bagColor: '#7CC5E8',
};

/** 꾸미기 패널이 그리는 목록. 상점 아이템을 늘리려면 여기에 값만 추가한다. */
export const AVATAR_OPTIONS = {
  body:  ['#F2D98A', '#C9B6E8', '#9BB4E8', '#A8D8C4', '#D98A8A', '#F0F0F0'],
  skin:  ['#F0C49C', '#E0A878', '#C98A5C', '#9B6440', '#6B4530'],
  legs:  ['#E8846B', '#5FB4E8', '#7DC98A', '#E8C45F', '#B47DE8', '#3D4466'],
  shoes: ['#5FB4E8', '#F2669E', '#FFFFFF', '#3D4466', '#7DC98A'],
  face:  ['#7CC5E8', '#F2D98A', '#F0C49C', '#A8D8C4', '#E8A8C4'],
  glasses: ['none', 'shutter', 'round'] as GlassesName[],
} as const;

const pick = <T,>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)];

export function randomAvatar(): AvatarConfig {
  return {
    body: pick(AVATAR_OPTIONS.body),
    skin: pick(AVATAR_OPTIONS.skin),
    legs: pick(AVATAR_OPTIONS.legs),
    shoes: pick(AVATAR_OPTIONS.shoes),
    face: pick(AVATAR_OPTIONS.face),
    glasses: pick(['none', 'none', 'shutter', 'round'] as GlassesName[]),
    glassesColor: pick(AVATAR_OPTIONS.shoes),
    bag: Math.random() > 0.6,
    bagColor: pick(AVATAR_OPTIONS.shoes),
  };
}

/** 작은 아이콘용 얼굴 SVG data URI.
 *  바텀시트 카드의 미니 원탁처럼 3D Canvas를 띄우기 아까운 곳에 쓴다.
 *  무대 위 캐릭터는 <Avatar /> 컴포넌트를 쓸 것. */
export function avatarFaceUrl(cfg: AvatarConfig): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<circle cx="32" cy="32" r="31" fill="${cfg.body}"/>
<circle cx="32" cy="32" r="21" fill="${cfg.face}"/>
<circle cx="18.5" cy="37" r="4" fill="#F2A0A0" opacity="0.65"/>
<circle cx="45.5" cy="37" r="4" fill="#F2A0A0" opacity="0.65"/>
<rect x="23.5" y="26" width="4" height="7" rx="2" fill="#2B2B3D"/>
<rect x="36.5" y="26" width="4" height="7" rx="2" fill="#2B2B3D"/>
<path d="M26 39 Q32 44 38 39" stroke="#2B2B3D" stroke-width="2.6" fill="none" stroke-linecap="round"/>
${cfg.glasses === 'shutter'
  ? `<rect x="14" y="25" width="36" height="9" rx="2" fill="${cfg.glassesColor}"/>`
  : cfg.glasses === 'round'
  ? `<circle cx="25" cy="29" r="6" stroke="${cfg.glassesColor}" stroke-width="2.2" fill="none"/><circle cx="39" cy="29" r="6" stroke="${cfg.glassesColor}" stroke-width="2.2" fill="none"/>`
  : ''}
</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
