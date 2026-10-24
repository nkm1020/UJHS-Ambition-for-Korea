import { AvatarConfig, Room } from '@/lib/types';
import { DEFAULT_AVATAR } from '@/lib/avatar';

const av = (o: Partial<AvatarConfig>): AvatarConfig => ({ ...DEFAULT_AVATAR, ...o });

const MAYA = av({ body: '#C9B6E8', skin: '#C98A5C', legs: '#5FB4E8', shoes: '#F2669E', face: '#F2D98A', glasses: 'round', glassesColor: '#3D4466' });
const JUN  = av({ body: '#9BB4E8', skin: '#E0A878', legs: '#3D4466', shoes: '#FFFFFF', face: '#A8D8C4' });
const LEO  = av({ body: '#A8D8C4', skin: '#9B6440', legs: '#E8C45F', shoes: '#5FB4E8', face: '#F0C49C', bag: true, bagColor: '#F2669E' });
const SOO  = av({ body: '#D98A8A', skin: '#F0C49C', legs: '#B47DE8', shoes: '#7DC98A', face: '#7CC5E8', glasses: 'shutter', glassesColor: '#FFFFFF' });

/* ⚠ 자리표시 대본이다. 13:00 녹음 때 팀 실제 대화로 교체한다.
   오디오 경로는 미리 적어 뒀으니 파일만 같은 이름으로 커밋하면 붙는다. */
export const ROOMS: Room[] = [
  {
    id: 'friday',
    title: 'Friday plans',
    emoji: '🍕',
    preview: 'so are we doing this or not 💀',
    unread: 3,
    members: [
      { id: 'maya', name: 'Maya', avatar: MAYA, seat: 0, startsAs: 'watching' },
      { id: 'jun',  name: 'Jun',  avatar: JUN,  seat: 1, startsAs: 'away' },
      { id: 'me',   name: 'You',  avatar: DEFAULT_AVATAR, seat: 2, startsAs: 'watching' },
      { id: 'leo',  name: 'Leo',  avatar: LEO,  seat: 3, startsAs: 'away' },
      { id: 'soo',  name: 'Soo',  avatar: SOO,  seat: 4, startsAs: 'watching' },
    ],
    script: [
      { actorId: 'me',   action: 'walk_in' },
      { actorId: 'maya', action: 'talk', audio: '/audio/friday/01-maya.mp3', text: 'ok pizza at 8?' },
      { actorId: 'soo',  action: 'talk', audio: '/audio/friday/02-soo.mp3',  text: "I'm in!!",
        reactions: [{ actorId: 'jun', action: 'sit_up' }] },
      // 펀치라인: 읽고 답이 없다
      { actorId: 'leo',  action: 'read_ignore', caption: 'Read 9:41 PM',
        reactions: [{ actorId: 'maya', action: 'freeze' }, { actorId: 'soo', action: 'freeze' }] },
      { actorId: 'jun',  action: 'startle_up', caption: '3 hours later' },
      { actorId: 'jun',  action: 'talk', audio: '/audio/friday/03-jun.mp3', text: 'wait what did I miss' },
      { actorId: 'maya', action: 'laugh' },
      { actorId: 'soo',  action: 'stand_leave', caption: 'Soo left the chat' },
    ],
    onUserMessage: [
      [{ actorId: 'maya', action: 'talk', text: 'finally someone says it' },
       { actorId: 'leo',  action: 'slump' }],
      [{ actorId: 'jun',  action: 'heart' },
       { actorId: 'maya', action: 'slump' }],
      [{ actorId: 'leo',  action: 'read_ignore', caption: 'Read' }],
    ],
  },
  {
    id: 'family',
    title: 'Family',
    emoji: '👨‍👩‍👧',
    preview: '밥은 먹었니',
    unread: 12,
    members: [
      { id: 'mom', name: 'Mom', avatar: av({ body: '#F0F0F0', legs: '#D98A8A', face: '#F0C49C' }), seat: 1, startsAs: 'watching' },
      { id: 'me',  name: 'You', avatar: DEFAULT_AVATAR, seat: 2, startsAs: 'watching' },
      { id: 'sis', name: 'Sis', avatar: av({ body: '#E8A8C4', legs: '#7DC98A', face: '#F2D98A' }), seat: 3, startsAs: 'away' },
    ],
    script: [
      { actorId: 'me',  action: 'walk_in' },
      { actorId: 'mom', action: 'talk', text: '밥은 먹었니' },
      { actorId: 'me',  action: 'typing_stop' },
      { actorId: 'sis', action: 'laugh' },
    ],
    onUserMessage: [[{ actorId: 'mom', action: 'heart' }]],
  },
  {
    id: 'team',
    title: 'Team standup',
    emoji: '💼',
    preview: 'pushing now',
    unread: 0,
    members: [
      { id: 'lead', name: 'Lead', avatar: av({ body: '#3D4466', legs: '#9BB4E8', face: '#A8D8C4' }), seat: 1, startsAs: 'away' },
      { id: 'me',   name: 'You',  avatar: DEFAULT_AVATAR, seat: 2, startsAs: 'watching' },
      { id: 'dev',  name: 'Dev',  avatar: av({ body: '#7DC98A', legs: '#3D4466', face: '#F2D98A' }), seat: 3, startsAs: 'away' },
    ],
    script: [
      { actorId: 'me',   action: 'walk_in' },
      { actorId: 'lead', action: 'talk', text: 'standup in 2' },
      { actorId: 'dev',  action: 'cover_mouth', caption: 'Dev unsent a message' },
    ],
    onUserMessage: [[{ actorId: 'lead', action: 'slump' }]],
  },
];
