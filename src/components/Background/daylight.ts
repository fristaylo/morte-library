import { useEffect, useReducer, useRef } from "react";

export type Rgb = [number, number, number];

type ThemeVar =
    | "--surface"
    | "--paper"
    | "--case-1"
    | "--case-2"
    | "--case-3"
    | "--case-edge"
    | "--ink"
    | "--ink-soft"
    | "--ink-faint"
    | "--accent"
    | "--sky";

export type Phase = {
    brightness: number;
    saturate: number;
    tint: Rgb;
    tintOpacity: number;
    stars: number;
    sky: [Rgb, Rgb, Rgb];
    haze: Rgb;
    hazeOpacity: number;
    ridge: Rgb;
    ridgeMix: number;
    vars: Record<ThemeVar, Rgb>;
};

const KEYS = [
    { at: 0, load: () => import("./phases/night") },
    { at: 7, load: () => import("./phases/morning") },
    { at: 13, load: () => import("./phases/day") },
    { at: 19, load: () => import("./phases/evening") },
];

const HOLD = 2;

export function segment(hour: number) {
    let i = KEYS.length - 1;
    while (i > 0 && KEYS[i].at > hour) i--;
    const j = (i + 1) % KEYS.length;
    const span = (KEYS[j].at - KEYS[i].at + 24) % 24;
    const elapsed = (hour - KEYS[i].at + 24) % 24;
    const t = Math.min(Math.max((elapsed - HOLD) / (span - 2 * HOLD), 0), 1);
    return { i, j, t };
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t;

export function blend(a: Phase, b: Phase, t: number) {
    const mixRgb = (x: Rgb, y: Rgb): Rgb =>
        x.map((c, n) => mix(c, y[n], t)) as Rgb;
    const str = (c: Rgb) => `rgb(${c.map((v) => Math.round(v)).join(" ")})`;
    const bright = mix(a.brightness, b.brightness, t);
    const sat = mix(a.saturate, b.saturate, t);
    const tintOpacity = mix(a.tintOpacity, b.tintOpacity, t);
    const wash = mixRgb(a.tint, b.tint).map(
        (v) => 1 - tintOpacity + (tintOpacity * v) / 255,
    );
    const tone = (c: Rgb) => {
        const [r, g, bl] = c.map((v) => Math.min(255, v * bright));
        const lum = 0.213 * r + 0.715 * g + 0.072 * bl;
        return str(
            [r, g, bl].map((v, n) =>
                Math.min(255, Math.max(0, (lum + sat * (v - lum)) * wash[n])),
            ) as Rgb,
        );
    };
    const lit = (x: Rgb, y: Rgb) => tone(mixRgb(x, y));
    return {
        tone,
        stars: mix(a.stars, b.stars, t),
        sky: a.sky.map((s, n) => lit(s, b.sky[n])),
        haze: lit(a.haze, b.haze),
        hazeOpacity: mix(a.hazeOpacity, b.hazeOpacity, t),
        ridge: mixRgb(a.ridge, b.ridge),
        ridgeMix: mix(a.ridgeMix, b.ridgeMix, t),
        vars: Object.fromEntries(
            (Object.keys(a.vars) as ThemeVar[]).map((k) => [
                k,
                str(mixRgb(a.vars[k], b.vars[k])),
            ]),
        ),
    };
}

const cache: (Phase | undefined)[] = [];

export function useDaylight(hour: number) {
    const [, bump] = useReducer((n: number) => n + 1, 0);
    const { i, j, t } = segment(hour);

    useEffect(() => {
        for (const k of [i, j]) {
            if (!cache[k]) {
                KEYS[k].load().then((m) => {
                    cache[k] = m.default;
                    bump();
                });
            }
        }
    }, [i, j]);

    const a = cache[i];
    const b = cache[j];
    const light = a && b ? blend(a, b, t) : null;
    const applied = useRef<Record<string, string>>({});

    useEffect(() => {
        if (!light) return;
        const style = document.documentElement.style;
        for (const [k, v] of Object.entries(light.vars)) {
            if (applied.current[k] !== v) {
                applied.current[k] = v;
                style.setProperty(k, v);
            }
        }
    });

    return light;
}
