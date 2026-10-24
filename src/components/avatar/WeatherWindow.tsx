"use client";

import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { skyAt, skyClock, type Weather } from "@/lib/weather";

// The My Room window. Outside is one shader plane: a sky that follows the
// real sun (sunrise, golden hour, night, today's moon phase), a hazy ridge
// and apartment blocks whose windows light up after dark, and on top the
// live weather — clouds drifting with the wind, rain, snow, fog, lightning.
// Values ease toward their targets, so the view crossfades when the forecast
// arrives instead of snapping. A light at the glass carries the outside
// colour (and the lightning) into the room.

const W = 0.84; // glass opening
const H = 1.04;
const F = 0.06; // frame bar
const D = 0.07; // frame depth off the wall

const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Colours are sRGB and written straight out (no tone mapping): it's outside
// light, it should read a touch brighter than the room.
const fragment = /* glsl */ `
  varying vec2 vUv;
  uniform float uTime;
  uniform float uAspect;
  uniform float uDay;
  uniform float uGolden;
  uniform float uCloud;
  uniform float uRain;
  uniform float uSnow;
  uniform float uFog;
  uniform float uFlash;
  uniform float uDrift;
  uniform vec2 uSun;
  uniform vec2 uMoon;
  uniform float uMoonPhase;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float hash1(float x) { return fract(sin(x * 127.1) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; }
    return v;
  }
  float over(float edge, float soft, float x) { return 1.0 - smoothstep(edge - soft, edge + soft, x); }

  // One row of apartment blocks. Returns 1 inside a block; facade gets the
  // face colour (lit windows at night, side wall shaded).
  float blocks(vec2 uv, float cells, float base, float range, float floors, float seed,
               vec3 wall, vec3 glass, vec3 lamp, out vec3 facade) {
    float x = uv.x * cells + seed;
    float id = floor(x);
    float fx = fract(x);
    float h = base + hash1(id + seed) * range;
    float inside = step(uv.y, h) * step(0.07, fx) * step(fx, 0.93);
    vec2 cell = vec2(floor(fx * 7.0), floor(uv.y * floors));
    vec2 f = vec2(fract(fx * 7.0), fract(uv.y * floors));
    float pane = step(0.3, f.x) * step(f.x, 0.75) * step(0.3, f.y) * step(f.y, 0.75)
               * step(0.2, fx) * step(fx, 0.88) * step(uv.y, h - 0.6 / floors);
    float on = step(0.55, hash(cell + id * 13.7 + seed)) * (1.0 - uDay);
    vec3 c = mix(wall, glass, pane);
    c = mix(c, lamp, pane * on);
    c *= mix(0.78, 1.0, step(0.2, fx)); // side wall in shade
    facade = c;
    return inside;
  }

  float rain(vec2 uv, float cols, float len, float speed, float seed) {
    uv.x += uv.y * 0.18; // slanted by the wind
    float x = uv.x * cols;
    float id = floor(x);
    float r = hash1(id + seed);
    float y = uv.y * cols * 0.12 + uTime * speed * (0.8 + 0.4 * r) + r * 7.0;
    float f = fract(y);
    float show = step(hash(vec2(id, floor(y)) + seed), uRain);
    float thin = over(0.05, 0.04, abs(fract(x) - 0.5 + (r - 0.5) * 0.5));
    return show * thin * over(len * 0.5, len * 0.5, f) * smoothstep(0.0, 0.04, f);
  }

  float snow(vec2 uv, float cells, float speed, float size, float seed) {
    vec2 p = vec2(uv.x * uAspect, uv.y) * cells;
    p.y += uTime * speed;
    p.x += 0.3 * sin(uTime * 1.3 + floor(p.y) * 2.1 + seed) + uTime * 0.12;
    vec2 id = floor(p);
    vec2 f = fract(p) - 0.5;
    vec2 at = (vec2(hash(id + seed + 1.7), hash(id + seed + 9.2)) - 0.5) * 0.6;
    float show = step(hash(id + seed), uSnow * 0.85);
    return show * over(size, size * 0.5, length(f - at));
  }

  void main() {
    vec2 uv = vUv;
    vec2 asp = vec2(uAspect, 1.0);
    float g = uGolden * smoothstep(0.0, 0.6, uDay);
    float overcast = smoothstep(0.45, 1.0, uCloud);

    // sky
    vec3 top = mix(vec3(0.03, 0.05, 0.13), vec3(0.30, 0.58, 0.88), uDay);
    vec3 low = mix(vec3(0.10, 0.14, 0.27), vec3(0.70, 0.86, 0.97), uDay);
    top = mix(top, vec3(0.38, 0.45, 0.72), g * 0.8);
    low = mix(low, vec3(1.0, 0.62, 0.40), g);
    top = mix(top, mix(vec3(0.09, 0.10, 0.12), vec3(0.58, 0.62, 0.67), uDay), overcast);
    low = mix(low, mix(vec3(0.15, 0.16, 0.19), vec3(0.79, 0.81, 0.84), uDay), overcast);
    vec3 col = mix(low, top, smoothstep(0.15, 1.0, uv.y));
    col *= 1.0 - 0.22 * uRain;
    float depth = 1.0; // 1 sky … 0 nearest block, for fog

    // clouds (worked out first: they hide the stars, sun and moon)
    // (thresholds fitted so the covered share of sky ≈ uCloud)
    vec2 cp = vec2(uv.x * uAspect * 2.8 + uDrift, uv.y * 4.0);
    float n = (fbm(cp) - 0.5) * 1.7 + 0.5 + (uv.y - 0.5) * 0.12;
    float thr = 0.72 - 0.64 * uCloud;
    float cloud = smoothstep(thr, thr + 0.12, n);
    float veil = 1.0 - overcast;

    // stars
    vec2 sp = uv * asp * 26.0;
    vec2 si = floor(sp);
    float sh = hash(si);
    vec2 sat = (vec2(hash(si + 3.1), hash(si + 7.7)) - 0.5) * 0.6;
    float star = step(0.93, sh) * over(0.1, 0.06, length(fract(sp) - 0.5 - sat));
    star *= 0.55 + 0.45 * sin(uTime * (1.0 + sh * 3.0) + sh * 40.0);
    col += star * (1.0 - smoothstep(0.0, 0.45, uDay)) * (1.0 - cloud) * veil * (1.0 - uFog) * smoothstep(0.35, 0.6, uv.y);

    // sun
    vec3 sunCol = mix(vec3(1.0, 0.97, 0.88), vec3(1.0, 0.72, 0.45), g);
    float ds = length((uv - uSun) * asp);
    float sunUp = smoothstep(0.0, 0.35, uDay) * veil;
    col += sunCol * (exp(-ds * 7.0) * 0.55 + exp(-ds * 2.5) * 0.15) * sunUp;
    col = mix(col, sunCol * 1.05, over(0.07, 0.004, ds) * sunUp * (1.0 - cloud * 0.9));

    // moon, with today's phase
    vec2 ml = (uv - uMoon) * asp / 0.05;
    float moonUp = (1.0 - smoothstep(0.1, 0.5, uDay)) * veil * (1.0 - cloud * 0.9);
    float k = cos(6.2831853 * uMoonPhase) * sqrt(max(0.0, 1.0 - ml.y * ml.y));
    float lit = uMoonPhase < 0.5 ? smoothstep(k - 0.08, k + 0.08, ml.x) : over(-k, 0.08, ml.x);
    float disk = over(1.0, 0.05, length(ml));
    col += vec3(0.75, 0.8, 0.95) * exp(-length(ml) * 0.6) * 0.12 * moonUp * (1.0 - abs(uMoonPhase - 0.5) * 1.6);
    col = mix(col, mix(col + 0.04, vec3(0.96, 0.94, 0.86), lit), disk * moonUp);

    // cloud colour: white by day, slate at night, peach at golden hour,
    // heavy and grey when it rains, darker bellies, silver toward the sun
    vec3 cc = mix(vec3(0.15, 0.17, 0.24), vec3(0.98, 0.98, 1.0), uDay);
    cc = mix(cc, vec3(1.0, 0.76, 0.64), g * 0.7);
    cc *= 1.0 - 0.38 * max(uRain, uSnow * 0.4) - 0.12 * overcast;
    cc *= mix(1.0, 0.8, smoothstep(thr + 0.15, thr + 0.6, n));
    cc += sunCol * exp(-ds * 5.0) * 0.25 * sunUp;
    col = mix(col, cc, cloud * 0.95);

    // the ridge behind the city
    float ridge = 0.25 + 0.1 * noise(vec2(uv.x * 2.4 + 4.0, 1.0)) + 0.035 * noise(vec2(uv.x * 9.0, 3.0));
    vec3 hill = mix(low, mix(vec3(0.05, 0.07, 0.12), vec3(0.47, 0.58, 0.62), uDay), 0.55);
    float onHill = step(uv.y, ridge);
    col = mix(col, hill, onHill);
    depth = mix(depth, 0.85, onHill);

    // two rows of apartment blocks, the far one hazy
    vec3 wall = mix(vec3(0.07, 0.08, 0.12), vec3(0.88, 0.86, 0.82), uDay);
    wall = mix(wall, wall * vec3(1.12, 0.88, 0.74), g * 0.6) * (1.0 - 0.18 * overcast);
    vec3 glass = mix(vec3(0.05, 0.06, 0.09), mix(low, vec3(0.45, 0.55, 0.62), 0.5), uDay);
    vec3 lamp = vec3(1.0, 0.8, 0.48);
    vec3 facade;
    float far = blocks(uv, 6.0, 0.17, 0.12, 64.0, 3.7, mix(wall, low, 0.45), mix(glass, low, 0.4), lamp * 0.8, facade);
    col = mix(col, facade, far);
    depth = mix(depth, 0.65, far);
    float near = blocks(uv, 3.4, 0.07, 0.15, 40.0, 11.3, wall, glass, lamp, facade);
    col = mix(col, facade, near);
    depth = mix(depth, 0.35, near);

    // fog, plus the haze that comes with rain and snow
    float haze = max(uFog, max(uRain * 0.35, uSnow * 0.4));
    vec3 fogCol = mix(vec3(0.13, 0.14, 0.17), vec3(0.84, 0.85, 0.86), uDay);
    col = mix(col, fogCol, haze * (0.3 + 0.6 * depth) * (1.0 - 0.3 * smoothstep(0.0, 0.8, uv.y)));

    // rain and snow
    vec3 dropCol = mix(vec3(0.45, 0.5, 0.6), vec3(0.88, 0.92, 0.96), uDay);
    float r = rain(uv, 28.0, 0.5, 15.0, 1.0) * 0.45 + rain(uv, 55.0, 0.4, 10.0, 5.0) * 0.25;
    col = mix(col, dropCol, r);
    float s = snow(uv, 9.0, 0.55, 0.085, 0.0) + snow(uv, 17.0, 0.35, 0.075, 4.0) * 0.6;
    col = mix(col, mix(vec3(0.75, 0.78, 0.85), vec3(1.0), uDay), min(1.0, s));

    // lightning lights the sky more than the blocks
    col += vec3(0.6, 0.65, 0.8) * uFlash * 0.55 * (0.3 + 0.7 * depth);

    // glass: a soft diagonal sheen, a faint room reflection at night, and
    // the frame's shadow around the edge (heaviest under the top bar)
    float d = uv.x * 0.8 + uv.y;
    col += (0.06 * over(0.0, 0.25, abs(d - 1.2)) + 0.04 * over(0.0, 0.07, abs(d - 1.45))) * (0.5 + 0.5 * uDay);
    col += vec3(0.05, 0.04, 0.03) * (1.0 - uDay);
    float edge = min(min(uv.x, 1.0 - uv.x) * uAspect, min(uv.y, (1.0 - uv.y) * 0.6));
    col *= mix(0.76, 1.0, smoothstep(0.0, 0.05, edge));

    gl_FragColor = vec4(col, 1.0);
  }
`;

const ease = (dt: number, rate = 1.5) => 1 - Math.exp(-rate * dt);

export function WeatherWindow({
  weather,
  position,
}: {
  weather: Weather | null;
  position: [number, number, number];
}) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const light = useRef<THREE.PointLight>(null);
  const snowCap = useRef<THREE.Mesh>(null);
  const strike = useRef({ next: 2, at: -10 });

  // start from the weather already known (back from a chat), not a clear sky
  const [uniforms] = useState(() => {
    const sky = skyAt(weather, skyClock());
    return {
      uTime: { value: 0 },
      uAspect: { value: W / H },
      uDay: { value: sky.day },
      uGolden: { value: sky.golden },
      uCloud: { value: weather?.cloud ?? 0.2 },
      uRain: { value: weather?.rain ?? 0 },
      uSnow: { value: weather?.snow ?? 0 },
      uFog: { value: weather?.fog ?? 0 },
      uFlash: { value: 0 },
      uDrift: { value: 0 },
      uSun: { value: new THREE.Vector2(...sky.sun) },
      uMoon: { value: new THREE.Vector2(...sky.moon) },
      uMoonPhase: { value: sky.moonPhase },
    };
  });

  const at = useMemo(() => new THREE.Vector2(), []);
  const tint = useMemo(() => new THREE.Color(), []);
  const DAY = useMemo(() => new THREE.Color("#dcebff"), []);
  const DUSK = useMemo(() => new THREE.Color("#ffbf8a"), []);
  const NIGHT = useMemo(() => new THREE.Color("#5b6c96"), []);

  useFrame((state, dt) => {
    const u = mat.current?.uniforms;
    if (!u) return;
    const d = Math.min(dt, 0.1);
    const t = state.clock.elapsedTime;
    const sky = skyAt(weather, skyClock());
    const k = ease(d);

    u.uTime.value = t;
    u.uDay.value += (sky.day - u.uDay.value) * k;
    u.uGolden.value += (sky.golden - u.uGolden.value) * k;
    u.uCloud.value += ((weather?.cloud ?? 0.2) - u.uCloud.value) * k;
    u.uRain.value += ((weather?.rain ?? 0) - u.uRain.value) * k;
    u.uSnow.value += ((weather?.snow ?? 0) - u.uSnow.value) * k;
    u.uFog.value += ((weather?.fog ?? 0) - u.uFog.value) * k;
    u.uDrift.value += d * (0.01 + (weather?.wind ?? 8) * 0.0012);
    u.uSun.value.lerp(at.set(...sky.sun), k);
    u.uMoon.value.lerp(at.set(...sky.moon), k);
    u.uMoonPhase.value = sky.moonPhase;

    // lightning: a strike every few seconds, a bright flash and a weaker echo
    const s = strike.current;
    if (weather?.storm && t > s.next) {
      s.at = t;
      s.next = t + 3 + Math.random() * 7;
    }
    const since = t - s.at;
    const flash = Math.exp(-since * 14) + (since > 0.16 ? 0.7 * Math.exp(-(since - 0.16) * 10) : 0);
    u.uFlash.value = weather?.storm ? flash : 0;

    // outside light through the glass
    if (light.current) {
      const day = u.uDay.value;
      const golden = u.uGolden.value * Math.min(1, day / 0.6);
      tint.copy(NIGHT).lerp(DAY, day).lerp(DUSK, golden * 0.8);
      tint.lerp(DAY, u.uFlash.value);
      light.current.color.copy(tint);
      light.current.intensity = (0.35 + 1.6 * day) * (1 - 0.45 * u.uCloud.value * u.uCloud.value) + 6 * u.uFlash.value;
    }
    // snow settles on the sill while it snows
    if (snowCap.current) {
      const cap = snowCap.current.scale.y;
      const want = (weather?.snow ?? 0) > 0 ? 1 : 0.001;
      snowCap.current.scale.y = cap + (want - cap) * ease(d, 0.4);
      snowCap.current.visible = snowCap.current.scale.y > 0.01;
    }
  });

  const frame = <meshStandardMaterial color="#f7f3ec" roughness={0.6} />;
  const sillY = -H / 2 - F - 0.0225;

  return (
    <group position={position}>
      <mesh position={[0, 0, 0.012]}>
        <planeGeometry args={[W, H]} />
        <shaderMaterial ref={mat} vertexShader={vertex} fragmentShader={fragment} uniforms={uniforms} />
      </mesh>

      {/* frame, then a cross of glazing bars */}
      <mesh position={[0, H / 2 + F / 2, D / 2]} castShadow receiveShadow>
        <boxGeometry args={[W + 2 * F, F, D]} />
        {frame}
      </mesh>
      <mesh position={[0, -H / 2 - F / 2, D / 2]} castShadow receiveShadow>
        <boxGeometry args={[W + 2 * F, F, D]} />
        {frame}
      </mesh>
      <mesh position={[-W / 2 - F / 2, 0, D / 2]} castShadow receiveShadow>
        <boxGeometry args={[F, H, D]} />
        {frame}
      </mesh>
      <mesh position={[W / 2 + F / 2, 0, D / 2]} castShadow receiveShadow>
        <boxGeometry args={[F, H, D]} />
        {frame}
      </mesh>
      <mesh position={[0, 0, 0.03]} castShadow>
        <boxGeometry args={[0.028, H, 0.036]} />
        {frame}
      </mesh>
      <mesh position={[0, H * 0.14, 0.03]} castShadow>
        <boxGeometry args={[W, 0.028, 0.036]} />
        {frame}
      </mesh>

      {/* sill, the snow that piles on it, and a small succulent */}
      <mesh position={[0, sillY, 0.065]} castShadow receiveShadow>
        <boxGeometry args={[W + 2 * F + 0.14, 0.045, 0.13]} />
        <meshStandardMaterial color="#efe9df" roughness={0.7} />
      </mesh>
      <mesh ref={snowCap} position={[0, sillY + 0.0225, 0.065]} scale={[1, 0.001, 1]} visible={false}>
        <boxGeometry args={[W + 2 * F + 0.12, 0.05, 0.11]} />
        <meshStandardMaterial color="#ffffff" roughness={1} />
      </mesh>
      <group position={[-W / 2 + 0.06, sillY + 0.0225, 0.075]}>
        <mesh position={[0, 0.045, 0]} castShadow>
          <cylinderGeometry args={[0.055, 0.042, 0.09, 20]} />
          <meshStandardMaterial color="#c8714c" roughness={0.85} />
        </mesh>
        {[
          [0, 0.115, 0, 0.05],
          [-0.035, 0.1, 0.01, 0.035],
          [0.035, 0.1, -0.005, 0.038],
          [0.01, 0.15, 0.005, 0.03],
        ].map(([x, y, z, r], i) => (
          <mesh key={i} position={[x, y, z]} castShadow>
            <sphereGeometry args={[r, 16, 12]} />
            <meshStandardMaterial color="#6f9460" roughness={0.9} />
          </mesh>
        ))}
      </group>

      <pointLight ref={light} position={[0, 0, 0.6]} distance={4.5} decay={1.6} intensity={1.2} />
    </group>
  );
}
