import { AvatarConfig, Room } from '@/lib/types';
import { DEFAULT_AVATAR } from '@/lib/avatar';

/** Ari의 첫인사. 서버도 이 문장을 알아야 대화가 이어지므로 따로 꺼내 둔다. */
export const AGENT_GREETING = "oh hey 👋 I'm Ari, the AI at this table. say anything, I actually answer";

const av = (o: Partial<AvatarConfig>): AvatarConfig => ({ ...DEFAULT_AVATAR, ...o });

const MAYA = av({ body: '#C9B6E8', skin: '#C98A5C', legs: '#5FB4E8', shoes: '#F2669E', face: '#F2D98A', glasses: 'round', glassesColor: '#3D4466' });
const LEO  = av({ body: '#A8D8C4', skin: '#9B6440', legs: '#E8C45F', shoes: '#5FB4E8', face: '#F0C49C', bag: 'fanny', bagColor: '#F2669E' });
const ARI  = av({ body: '#F0F0F0', skin: '#E0A878', legs: '#B47DE8', shoes: '#7DC98A', face: '#7CC5E8', glasses: 'shutter', glassesColor: '#B47DE8' });

/* 데모의 기본 방은 두 개다.
   1) ROOMS의 friday: 심사위원이 안 읽은 사이 쌓인 대화를 다시 보는 단톡. 끝나면 AI 요약이 원탁 위에 뜬다.
   2) AI_ROOM: 심사위원과 Ari(Sonnet)의 1:1. social.ts가 Direct 맨 위에 둔다.
   ⚠ friday 대사는 자리표시다. 녹음 파일은 적힌 경로에 같은 이름으로 커밋하면 붙고, 없으면 말풍선만 뜬다. */
export const ROOMS: Room[] = [
  {
    id: 'friday',
    title: 'Friday plans',
    emoji: '🍕',
    preview: 'Maya: and you?? are you coming 👀',
    unread: 7,
    lastActive: 0,
    members: [
      { id: 'maya', name: 'Maya', avatar: MAYA, seat: 1, startsAs: 'watching' },
      { id: 'me',   name: 'You',  avatar: DEFAULT_AVATAR, seat: 2, startsAs: 'watching' },
      { id: 'leo',  name: 'Leo',  avatar: LEO,  seat: 3, startsAs: 'away' },
    ],
    script: [
      { actorId: 'me',   action: 'walk_in' },
      { actorId: 'maya', action: 'talk', audio: '/audio/friday/01-maya.mp3', text: 'pizza friday?? 🍕', caption: '6:02 PM · 7 unread' },
      { actorId: 'maya', action: 'talk', audio: '/audio/friday/02-maya.mp3', text: "8pm at Tony's. I'll book" },
      // 펀치라인: 읽고 답이 없다
      { actorId: 'leo',  action: 'read_ignore', caption: 'Read 6:03 PM',
        reactions: [{ actorId: 'maya', action: 'freeze' }] },
      { actorId: 'maya', action: 'talk', audio: '/audio/friday/03-maya.mp3', text: 'leo I can literally see you read it' },
      { actorId: 'leo',  action: 'startle_up', caption: '3 hours later' },
      { actorId: 'leo',  action: 'talk', audio: '/audio/friday/04-leo.mp3', text: "sorry was at the gym 💪 I'm in but can we do 9" },
      { actorId: 'maya', action: 'cover_mouth', text: "you don't even go to the gym", caption: 'Maya unsent a message' },
      { actorId: 'maya', action: 'talk', audio: '/audio/friday/05-maya.mp3', text: "fine. 9. you're paying for garlic bread",
        reactions: [{ actorId: 'leo', action: 'laugh' }] },
      { actorId: 'leo',  action: 'typing_stop', caption: 'Leo stopped typing' },
      { actorId: 'maya', action: 'talk', audio: '/audio/friday/06-maya.mp3', text: 'and you?? are you coming 👀' },
    ],
    onUserMessage: [
      [{ actorId: 'maya', action: 'talk', text: 'FINALLY someone answers 🙌' },
       { actorId: 'leo',  action: 'slump' }],
      [{ actorId: 'leo',  action: 'startle_up' },
       { actorId: 'leo',  action: 'talk', text: 'wait what did I miss' }],
      [{ actorId: 'leo',  action: 'read_ignore', caption: 'Read' }],
    ],
    // API가 실패하거나 키가 없을 때 보여줄 요약
    catchUp: {
      headline: "Pizza Friday is on, at 9 now, not 8",
      points: [
        "Maya proposed Tony's at 8 and offered to book.",
        'Leo left her on read for 3 hours, then pushed it to 9 ("was at the gym").',
        'Maya unsent a reply, agreed to 9, and said Leo pays for the garlic bread. Leo started typing, then went quiet.',
      ],
      forYou: "Maya asked if you're coming.",
    },
  },
];

export const AI_ROOM: Room = {
  id: 'dm-ari',
  kind: 'dm',
  title: 'Ari',
  emoji: '✨',
  preview: 'AI · say anything, I actually answer',
  unread: 1,
  lastActive: 1,
  agentId: 'ari',
  members: [
    { id: 'ari', name: 'Ari', avatar: ARI, seat: 0, startsAs: 'watching' },
    { id: 'me',  name: 'You', avatar: DEFAULT_AVATAR, seat: 2, startsAs: 'watching' },
  ],
  script: [
    { actorId: 'me',  action: 'walk_in' },
    { actorId: 'ari', action: 'talk', text: AGENT_GREETING },
  ],
  onUserMessage: [],
};
