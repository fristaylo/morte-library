import { expect, test } from "bun:test";
import { blend, type Phase, type Rgb, segment } from "./daylight";

test("segment picks surrounding phases and wraps midnight", () => {
    expect(segment(0)).toEqual({ i: 0, j: 1, t: 0 });
    expect(segment(3.5)).toEqual({ i: 0, j: 1, t: 0.5 });
    expect(segment(19)).toEqual({ i: 3, j: 0, t: 0 });
    expect(segment(21.5)).toEqual({ i: 3, j: 0, t: 0.5 });
    expect(segment(23.9).t).toBe(1);
});

test("peak values hold 1.5h to each side of a phase", () => {
    expect(segment(1.5).t).toBe(0);
    expect(segment(5.5).t).toBe(1);
    expect(segment(22.5).t).toBe(1);
});

const VAR_KEYS = Object.keys({
    "--surface": 0,
    "--paper": 0,
    "--case-1": 0,
    "--case-2": 0,
    "--case-3": 0,
    "--case-edge": 0,
    "--ink": 0,
    "--ink-soft": 0,
    "--ink-faint": 0,
    "--accent": 0,
    "--sky": 0,
} satisfies Record<keyof Phase["vars"], number>) as (keyof Phase["vars"])[];

const theme = <T>(value: T) =>
    Object.fromEntries(VAR_KEYS.map((k) => [k, value])) as Record<
        keyof Phase["vars"],
        T
    >;

test("blend interpolates phases", () => {
    const a: Phase = {
        brightness: 1,
        saturate: 1,
        tint: [255, 255, 255],
        tintOpacity: 0,
        stars: 0,
        sky: [
            [10, 10, 10],
            [20, 20, 20],
            [30, 30, 30],
        ],
        haze: [0, 0, 0],
        hazeOpacity: 1,
        ridge: [0, 0, 0],
        ridgeMix: 0,
        vars: theme<Rgb>([0, 0, 0]),
    };
    const b: Phase = {
        brightness: 0.6,
        saturate: 0.7,
        tint: [81, 101, 181],
        tintOpacity: 0.6,
        stars: 1,
        sky: [
            [110, 110, 110],
            [120, 120, 120],
            [130, 130, 130],
        ],
        haze: [200, 200, 200],
        hazeOpacity: 1.4,
        ridge: [100, 100, 100],
        ridgeMix: 0.4,
        vars: theme<Rgb>([100, 100, 100]),
    };
    const { tone, ...out } = blend(a, b, 0.5);
    expect(out).toEqual({
        stars: 0.5,
        sky: ["rgb(43 44 46)", "rgb(50 51 54)", "rgb(57 58 61)"],
        haze: "rgb(72 73 77)",
        hazeOpacity: 1.2,
        ridge: [50, 50, 50],
        ridgeMix: 0.2,
        vars: theme("rgb(50 50 50)"),
    });
    expect(tone([100, 200, 50])).toBe("rgb(79 142 52)");
});

test("tone folds the multiply tint: opaque white tint is a no-op", () => {
    const plain: Phase = {
        brightness: 1,
        saturate: 1,
        tint: [255, 255, 255],
        tintOpacity: 1,
        stars: 0,
        sky: [
            [10, 20, 30],
            [10, 20, 30],
            [10, 20, 30],
        ],
        haze: [0, 0, 0],
        hazeOpacity: 1,
        ridge: [0, 0, 0],
        ridgeMix: 0,
        vars: theme<Rgb>([0, 0, 0]),
    };
    expect(blend(plain, plain, 0).tone([120, 130, 140])).toBe(
        "rgb(120 130 140)",
    );
});
