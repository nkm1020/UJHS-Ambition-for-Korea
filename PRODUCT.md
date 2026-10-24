# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Global Gen Z friend groups who live in group chats. The evaluator today is a VC judge who opens the demo link alone, on a phone or a laptop, with no one there to explain it, and decides in about a minute whether the team earns a follow-up meeting. English UI.

## Product Purpose

A messenger where a chat room becomes a round table. Members who are watching sit up; members who are away are slumped face-down on the table. Messages are spoken in real voices by each person's 3D character, with speech bubbles. Chat signals that text UIs shrink to grey labels (left on read, a 3-hour-late reply, leaving the chat, an unsent message, typing then nothing) are performed as body language.

Success today: the judge understands the idea and laughs within 30 seconds, then believes this team can build.

## Positioning

The only messenger that shows who is actually watching right now, as posture in a shared space. KakaoTalk and iMessage show a number or "Read"; Bitmoji and Memoji are stickers inside the thread; Apple Persona is a face during a headset call; Sora cameo is prompt-made video.

## Operating Context

Mobile web, no install, opened from a link. First run: customize your character in My Room, open a room from an Apple Maps-style bottom sheet, sit at the table in first person, speak with the mic (or type).

## Capabilities and Constraints

- One submission, judged unattended. A load error or blank screen is disqualifying, so every path needs a fallback (no WebGL → 2D, no mic → text, missing audio → bubbles).
- Demo rooms are scripted, voiced by team recordings. The visitor's own voice is real and stays on the device.
- 3D characters come from the teammate's react-three-fiber component (`src/components/avatar/Avatar.tsx`); its look is fixed for this build.
- Realtime multi-user, importing real chats, and clip export are roadmap, not shipped.

## Evidence on Hand

No users, testimonials, metrics, or press. Do not fabricate any.

## Product Principles

1. Presence is the interface: who is watching must be readable at a glance, everywhere.
2. Familiar controls, unfamiliar space: iOS conventions for every control; the novelty lives only in the room.
3. Never a dead end: every capability degrades to something that still works and still lands the joke.
4. Warm, not childish, not corporate: a place friends hang out.
