import type { AvatarConfig, HomeLook, Room } from "@/lib/types";
import { AI_ROOM, ROOMS } from "./rooms";

// Friends, derived from the group rooms so there is one source of people.
// The demo ships two chats: the group room and the 1:1 with the AI friend.

export interface Friend {
  id: string;
  name: string;
  avatar: AvatarConfig;
  presence: "watching" | "away";
  where: string; // the group they were last seen in
  roomId: string; // their room's "Join" button opens that group
  look?: HomeLook; // their room; without one it looks like yours
}

// Each friend's room, so visiting reads as their place: Maya plans the pizza,
// Leo "was at the gym".
const LOOKS: Record<string, HomeLook> = {
  maya: {
    wall: "#efe1dc",
    sideWall: "#e6d4ce",
    floor: "#cdbab0",
    rug: "#b8a5cf",
    bench: "#7d6170",
    plant: "#6c8a5a",
    prop: "pizza",
  },
  leo: {
    wall: "#dfe8e2",
    sideWall: "#d3ded7",
    floor: "#bfae94",
    rug: "#7fa292",
    bench: "#56646e",
    plant: "#4d7a4a",
    prop: "dumbbell",
  },
};

const firstSeen = new Map<string, Friend>();
for (const room of ROOMS) {
  for (const m of room.members) {
    if (m.id === "me" || firstSeen.has(m.id)) continue;
    firstSeen.set(m.id, {
      id: m.id,
      name: m.name,
      avatar: m.avatar,
      presence: m.startsAs === "watching" ? "watching" : "away",
      where: room.title,
      roomId: room.id,
      look: LOOKS[m.id],
    });
  }
}

export const FRIENDS: Friend[] = [...firstSeen.values()].sort((a, b) =>
  a.presence === b.presence ? 0 : a.presence === "watching" ? -1 : 1,
);

export const DMS: Room[] = [AI_ROOM];

export const ALL_ROOMS: Room[] = [...ROOMS, ...DMS];
