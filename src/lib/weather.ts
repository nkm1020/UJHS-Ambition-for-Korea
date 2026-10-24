"use client";

import { useEffect, useState } from "react";

// Today's weather for the My Room window, from Open-Meteo (free, no key).
// Location comes from the browser; if that's refused or ignored, Seoul.
// One request is shared by every caller and reused for 15 minutes. Failures
// return null and the window falls back to a clear sky on the local clock.
//
// For demos: ?weather=clear|cloudy|overcast|fog|drizzle|rain|storm|snow
// swaps in those conditions (today's real sunrise and sunset stay), and
// ?hour=0-23 sets the window's clock.

export interface Weather {
  label: string; // "Light rain"
  tempC: number;
  cloud: number; // 0–1 cover
  rain: number; // 0–1 intensity
  snow: number; // 0–1 intensity
  fog: number; // 0–1
  storm: boolean; // lightning
  wind: number; // km/h, drifts the clouds
  sunrise: number; // ms since epoch, today
  sunset: number;
}

const SEOUL = { lat: 37.5665, lon: 126.978 };
const FRESH_MS = 15 * 60e3;
const HOUR = 3600e3;

// WMO weather code → [label, rain, snow, fog, lightning]
const CODES: Record<number, [string, number, number, number, boolean?]> = {
  0: ["Clear", 0, 0, 0],
  1: ["Mostly clear", 0, 0, 0],
  2: ["Partly cloudy", 0, 0, 0],
  3: ["Overcast", 0, 0, 0],
  45: ["Fog", 0, 0, 1],
  48: ["Freezing fog", 0, 0, 1],
  51: ["Light drizzle", 0.2, 0, 0.15],
  53: ["Drizzle", 0.3, 0, 0.2],
  55: ["Heavy drizzle", 0.4, 0, 0.25],
  56: ["Freezing drizzle", 0.3, 0, 0.2],
  57: ["Freezing drizzle", 0.4, 0, 0.25],
  61: ["Light rain", 0.45, 0, 0.1],
  63: ["Rain", 0.7, 0, 0.15],
  65: ["Heavy rain", 1, 0, 0.25],
  66: ["Freezing rain", 0.5, 0, 0.15],
  67: ["Freezing rain", 0.9, 0, 0.2],
  71: ["Light snow", 0, 0.4, 0.1],
  73: ["Snow", 0, 0.7, 0.15],
  75: ["Heavy snow", 0, 1, 0.3],
  77: ["Snow grains", 0, 0.3, 0.1],
  80: ["Showers", 0.5, 0, 0.1],
  81: ["Showers", 0.75, 0, 0.15],
  82: ["Heavy showers", 1, 0, 0.25],
  85: ["Snow showers", 0, 0.55, 0.15],
  86: ["Heavy snow showers", 0, 1, 0.3],
  95: ["Thunderstorm", 0.8, 0, 0.15, true],
  96: ["Thunderstorm", 0.9, 0, 0.2, true],
  99: ["Thunderstorm", 1, 0, 0.25, true],
};

function fromCode(code: number, tempC: number, cloud: number, wind: number, sunrise: number, sunset: number): Weather {
  const [label, rain, snow, fog, storm = false] = CODES[code] ?? CODES[3];
  // precipitation and fog come out of a covered sky whatever the cover reads
  const cover = Math.max(cloud, rain || snow ? 0.9 : 0, fog > 0.5 ? 0.6 : 0);
  return { label, tempC, cloud: cover, rain, snow, fog, storm, wind, sunrise, sunset };
}

/** Sunrise and sunset for today on the local clock, when there's no data. */
function localSun(): { sunrise: number; sunset: number } {
  const d = new Date();
  d.setHours(6, 30, 0, 0);
  return { sunrise: d.getTime(), sunset: d.getTime() + 12 * HOUR };
}

const PRESETS: Record<string, [code: number, tempC: number, cloud: number]> = {
  clear: [0, 21, 0.05],
  cloudy: [2, 18, 0.55],
  overcast: [3, 15, 1],
  fog: [45, 12, 0.7],
  drizzle: [53, 14, 0.9],
  rain: [63, 13, 1],
  storm: [95, 24, 1],
  snow: [73, -2, 1],
};

function withPreset(real: Weather | null): Weather | null {
  const p = PRESETS[new URLSearchParams(location.search).get("weather") ?? ""];
  if (!p) return real;
  const { sunrise, sunset } = real ?? localSun();
  return fromCode(p[0], p[1], p[2], real?.wind ?? 12, sunrise, sunset);
}

let clockShift: number | null = null;

/** Now, in ms, as the window sees it (moved by ?hour= when set). */
export function skyClock(): number {
  if (clockShift === null) {
    const hour = Number(new URLSearchParams(location.search).get("hour") ?? NaN);
    if (Number.isFinite(hour)) {
      const d = new Date();
      d.setHours(Math.floor(hour), (hour % 1) * 60, 0, 0);
      clockShift = d.getTime() - Date.now();
    } else {
      clockShift = 0;
    }
  }
  return Date.now() + clockShift;
}

function locate(): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve) => {
    // a permission prompt left unanswered never calls back
    const giveUp = setTimeout(() => resolve(SEOUL), 8000);
    const done = (p: { lat: number; lon: number }) => {
      clearTimeout(giveUp);
      resolve(p);
    };
    if (!("geolocation" in navigator)) return done(SEOUL);
    navigator.geolocation.getCurrentPosition(
      (pos) => done({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => done(SEOUL),
      { maximumAge: 30 * 60e3, timeout: 8000 },
    );
  });
}

interface Forecast {
  current: { temperature_2m: number; weather_code: number; cloud_cover: number; wind_speed_10m: number };
  daily: { sunrise: number[]; sunset: number[] };
}

let place: Promise<{ lat: number; lon: number }> | null = null;

async function fetchWeather(): Promise<Weather | null> {
  const { lat, lon } = await (place ??= locate());
  const query = new URLSearchParams({
    // ~1 km is plenty for weather and keeps the exact spot private
    latitude: lat.toFixed(2),
    longitude: lon.toFixed(2),
    current: "temperature_2m,weather_code,cloud_cover,wind_speed_10m",
    daily: "sunrise,sunset",
    forecast_days: "1",
    timezone: "auto",
    timeformat: "unixtime",
  });
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${query}`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const { current: c, daily } = (await res.json()) as Forecast;
    return fromCode(
      c.weather_code,
      c.temperature_2m,
      c.cloud_cover / 100,
      c.wind_speed_10m,
      daily.sunrise[0] * 1000,
      daily.sunset[0] * 1000,
    );
  } catch {
    return null;
  }
}

let shared: { at: number; weather: Promise<Weather | null> } | null = null;
let latest: Weather | null = null;

function getWeather(): Promise<Weather | null> {
  if (!shared || Date.now() - shared.at > FRESH_MS) {
    const request = { at: Date.now(), weather: fetchWeather().then(withPreset) };
    shared = request;
    request.weather.then((w) => {
      if (w) latest = w;
      else if (shared === request) shared = null; // try again next time
    });
  }
  return shared.weather;
}

/** Current weather, or null until the first answer (and if there's none). */
export function useWeather(): Weather | null {
  const [weather, setWeather] = useState<Weather | null>(latest);
  useEffect(() => {
    let alive = true;
    const load = () =>
      getWeather().then((w) => {
        if (alive && w) setWeather(w);
      });
    load();
    const timer = setInterval(load, FRESH_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);
  return weather;
}

// ---------- the sky at a moment ----------

export interface SkyState {
  day: number; // 0 night … 1 full daylight
  golden: number; // 0–1, strongest at sunrise and sunset
  sun: [number, number]; // position in the window, 0–1 (below ~0.3 is behind the skyline)
  moon: [number, number];
  moonPhase: number; // 0 new, 0.25 first quarter, 0.5 full, 0.75 last quarter
}

const TWILIGHT_MS = 40 * 60e3;
const NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);
const SYNODIC_MS = 29.530588853 * 24 * HOUR;

const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

export function skyAt(weather: Weather | null, t: number): SkyState {
  const { sunrise, sunset } = weather ?? localSun();
  const day = smooth(0.5 + Math.min(t - sunrise, sunset - t) / (2 * TWILIGHT_MS));
  const bump = (dt: number) => Math.exp(-((dt / (50 * 60e3)) ** 2));
  const golden = Math.max(bump(t - sunrise), bump(t - sunset));

  // the sun walks the window left to right and sets behind the skyline
  const p = (t - sunrise) / (sunset - sunrise);
  const sun: [number, number] = [0.1 + 0.8 * p, 0.3 + 0.55 * Math.sin(Math.PI * p)];

  // the moon takes the night shift on the same path
  const dusk = t < sunrise ? sunset - 24 * HOUR : sunset;
  const dawn = t < sunrise ? sunrise : sunrise + 24 * HOUR;
  const q = (t - dusk) / (dawn - dusk);
  const moon: [number, number] = [0.1 + 0.8 * q, 0.3 + 0.5 * Math.sin(Math.PI * q)];

  const moonPhase = ((((t - NEW_MOON) / SYNODIC_MS) % 1) + 1) % 1;
  return { day, golden, sun, moon, moonPhase };
}
