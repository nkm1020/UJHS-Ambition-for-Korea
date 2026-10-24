import type { AvatarConfig, Room } from "@/lib/types";
import { DEFAULT_AVATAR } from "@/lib/avatar";
import { ROOMS } from "./rooms";

// Friends and 1:1 chats, derived from the group rooms so there is one source
// of people. Every friend gets a DM; its little scene matches their presence.

export interface Friend {
  id: string;
  name: string;
  avatar: AvatarConfig;
  presence: "watching" | "away";
  where: string; // the group they were last seen in
  dmId: string;
}

const firstSeen = new Map<string, { friend: Friend }>();
for (const room of ROOMS) {
  for (const m of room.members) {
    if (m.id === "me" || firstSeen.has(m.id)) continue;
    firstSeen.set(m.id, {
      friend: {
        id: m.id,
        name: m.name,
        avatar: m.avatar,
        presence: m.startsAs === "watching" ? "watching" : "away",
        where: room.title,
        dmId: `dm-${m.id}`,
      },
    });
  }
}

export const FRIENDS: Friend[] = [...firstSeen.values()]
  .map((x) => x.friend)
  .sort((a, b) => (a.presence === b.presence ? 0 : a.presence === "watching" ? -1 : 1));

function dmFor(f: Friend): Room {
  const away = f.presence === "away";
  return {
    id: f.dmId,
    kind: "dm",
    title: f.name,
    emoji: "",
    preview: away ? "Read 2:14 PM" : "hey 👋 you there?",
    unread: away ? 0 : 1,
    members: [
      { id: f.id, name: f.name, avatar: f.avatar, seat: 0, startsAs: f.presence },
      { id: "me", name: "You", avatar: DEFAULT_AVATAR, seat: 2, startsAs: "watching" },
    ],
    script: away
      ? [
          { actorId: "me", action: "walk_in" },
          { actorId: f.id, action: "read_ignore", caption: "Read 2:14 PM" },
          { actorId: f.id, action: "typing_stop", caption: `${f.name} is typing…` },
        ]
      : [
          { actorId: "me", action: "walk_in" },
          { actorId: f.id, action: "talk", text: "hey 👋 you there?" },
          { actorId: f.id, action: "heart" },
        ],
    onUserMessage: away
      ? [
          [{ actorId: f.id, action: "read_ignore", caption: "Read" }],
          [
            { actorId: f.id, action: "startle_up", caption: "2 hours later" },
            { actorId: f.id, action: "talk", text: "sorry!! was asleep" },
          ],
          [{ actorId: f.id, action: "laugh" }],
        ]
      : [
          [
            { actorId: f.id, action: "laugh" },
            { actorId: f.id, action: "talk", text: "lol same" },
          ],
          [{ actorId: f.id, action: "talk", text: "ok wait, I'm telling the group" }],
          [{ actorId: f.id, action: "heart" }],
        ],
  };
}

export const DMS: Room[] = FRIENDS.map(dmFor);

export const ALL_ROOMS: Room[] = [...ROOMS, ...DMS];
