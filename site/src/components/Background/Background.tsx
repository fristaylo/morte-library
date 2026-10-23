import { useEffect, useRef, useState } from "react";
import { useHour } from "../../hooks/useHour";
import "./Background.scss";
import {
    DARK,
    GLOW,
    MEADOW,
    R6,
    type Rgb,
    RIDGES,
    SHADE,
    useDaylight,
} from "./daylight";

type Light = NonNullable<ReturnType<typeof useDaylight>>;

type Renderer = NonNullable<ReturnType<typeof createRenderer>>;

type Job = NonNullable<ReturnType<typeof startLink>>;

const STAR_DRIFT = 1600 / 12;
const ROWS = 24;
const Y0 = 384;
const PAR_STRENGTH = 120;
const PAR_EASE = 3;
const RENDER_SCALE = 0.5;
const DEPTH = [0.05, 0.12, 0.22, 0.36, 0.52, 0.76, 1];

export default function Background() {
    const { hour, dialOpen } = useHour();
    const light = useDaylight(hour);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rendererRef = useRef<Renderer | null>(null);
    const shiftRef = useRef(starShift(hour));
    const [ready, setReady] = useState(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const renderer = createRenderer(canvas, setReady);
        if (!renderer) return;
        rendererRef.current = renderer;
        return () => {
            rendererRef.current = null;
            renderer.dispose();
        };
    }, []);

    useEffect(() => {
        if (!light) return;
        if (dialOpen) shiftRef.current = starShift(hour);
        rendererRef.current?.set(light, hour, shiftRef.current);
    }, [light, hour, dialOpen]);

    return (
        <>
            {/* biome-ignore lint/a11y/noAriaHiddenOnFocusable: canvas is not focusable */}
            <canvas ref={canvasRef} className="site-bg" aria-hidden="true" />
            {!ready && light && (
                <div
                    className="site-bg"
                    aria-hidden="true"
                    style={{ background: skyGradient(light.sky) }}
                />
            )}
        </>
    );
}

function starShift(hour: number) {
    return (hour * STAR_DRIFT) % 1600;
}

function skyGradient(sky: Rgb[]) {
    const [a, b, c] = sky.map((s) => `rgb(${s.join(" ")})`);
    return `linear-gradient(180deg, ${a} 0%, ${b} 26%, ${c} 45%, ${c} 100%)`;
}

function smooth(e0: number, e1: number, x: number) {
    const u = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1);
    return u * u * (3 - 2 * u);
}

function pack(...colors: Rgb[]) {
    return new Float32Array(colors.flat().map((v) => v / 255));
}

function createRenderer(
    canvas: HTMLCanvasElement,
    onState: (ok: boolean) => void,
) {
    const gl = canvas.getContext("webgl2", { antialias: false });
    if (!gl) return null;
    const job = startLink(gl);
    if (!job) return null;
    const ext = gl.getExtension("KHR_parallel_shader_compile");
    let inner: ReturnType<typeof start> | null = null;
    let queued: [Light, number, number] | null = null;
    let poll = 0;

    const finish = () => {
        const program = finishLink(gl, job);
        if (!program) return;
        inner = start(gl, canvas, program, onState);
        if (queued) inner.set(...queued);
    };
    const check = () => {
        if (
            ext &&
            !gl.getProgramParameter(job.program, ext.COMPLETION_STATUS_KHR)
        ) {
            poll = requestAnimationFrame(check);
        } else {
            finish();
        }
    };
    check();

    return {
        set(l: Light, hour: number, shift: number) {
            if (inner) inner.set(l, hour, shift);
            else queued = [l, hour, shift];
        },
        dispose() {
            cancelAnimationFrame(poll);
            if (inner) {
                inner.dispose();
                return;
            }
            gl.deleteProgram(job.program);
            for (const s of job.shaders) gl.deleteShader(s);
        },
    };
}

function start(
    gl: WebGL2RenderingContext,
    canvas: HTMLCanvasElement,
    program: WebGLProgram,
    onState: (ok: boolean) => void,
) {
    const u = (n: string) => gl.getUniformLocation(program, n);
    const rows = buildRows();
    const texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.R16F,
        1600,
        ROWS,
        0,
        gl.RED,
        gl.HALF_FLOAT,
        rows.data,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // biome-ignore lint/correctness/useHookAtTopLevel: gl.useProgram is not a hook
    gl.useProgram(program);
    gl.uniform1i(u("uH"), 0);
    gl.uniform1fv(u("uTop"), rows.top);
    const uView = u("uView");
    const uPar = u("uPar");

    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const par = new Float32Array(14);
    let ready = false;
    let drawn = false;
    let lost = false;
    let raf = 0;
    let last = 0;
    let mv = scrollRatio();
    let tg = mv;

    const wake = () => {
        if (!raf && !lost) raf = requestAnimationFrame(frame);
    };
    const resize = () => {
        const r = canvas.getBoundingClientRect();
        const k = Math.min(devicePixelRatio || 1, 2) * RENDER_SCALE;
        canvas.width = Math.max(1, Math.round(r.width * k));
        canvas.height = Math.max(1, Math.round(r.height * k));
        gl.viewport(0, 0, canvas.width, canvas.height);
        wake();
    };
    const onScroll = () => {
        tg = scrollRatio();
        wake();
    };
    const onContextLost = (e: Event) => {
        e.preventDefault();
        lost = true;
        onState(false);
    };
    const frame = (now: number) => {
        raf = 0;
        const dt = last ? Math.min((now - last) / 1000, 0.25) : 1 / 60;
        last = now;
        mv += (tg - mv) * (reduced ? 1 : 1 - Math.exp(-dt * PAR_EASE));
        if (Math.abs(tg - mv) * PAR_STRENGTH < 0.3) mv = tg;
        draw();
        if (mv !== tg) wake();
        else last = 0;
    };
    const draw = () => {
        if (!ready || lost) return;
        const w = canvas.width;
        const h = canvas.height;
        gl.uniform3f(uView, w, h, Math.max(w / 1600, h / 900));
        DEPTH.forEach((d, i) => {
            par[2 * i + 1] = -mv * PAR_STRENGTH * d;
        });
        gl.uniform2fv(uPar, par);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        if (!drawn) {
            drawn = true;
            onState(true);
        }
    };

    canvas.addEventListener("webglcontextlost", onContextLost);
    window.addEventListener("resize", resize);
    window.addEventListener("scroll", onScroll, { passive: true });
    resize();

    return {
        set(l: Light, hour: number, shift: number) {
            const ts = (hour - 6.5) / 13;
            const sunE = ts > 0 && ts < 1 ? Math.sin(ts * Math.PI) : 0;
            const tm = ((hour - 19 + 24) % 24) / 12;
            const moonE = tm < 1 ? Math.sin(tm * Math.PI) : 0;
            const sunVis = smooth(0, 0.12, sunE);
            const moonVis = smooth(0, 0.12, moonE);
            gl.uniform1f(u("uStars"), l.stars);
            gl.uniform1f(u("uFog"), l.hazeOpacity);
            gl.uniform1f(u("uShift"), shift);
            gl.uniform3fv(u("uSky"), pack(...l.sky));
            gl.uniform3fv(u("uHaze"), pack(l.haze));
            gl.uniform3fv(
                u("uRA"),
                pack(...RIDGES.map(([top]) => l.grade(top)), l.grade(R6[0])),
            );
            gl.uniform3fv(
                u("uRB"),
                pack(
                    ...RIDGES.map(([, bottom]) => l.grade(bottom)),
                    l.grade(R6[1]),
                ),
            );
            gl.uniform3fv(u("uRC"), pack(l.grade(R6[2])));
            gl.uniform3fv(
                u("uAcc"),
                pack(l.tone(SHADE), l.tone(MEADOW), l.tone(GLOW), l.tone(DARK)),
            );
            gl.uniform3fv(u("uSun"), [
                800 - Math.cos(ts * Math.PI) * 680,
                450 - sunE * 330,
                sunVis,
            ]);
            gl.uniform3fv(u("uMoon"), [
                800 - Math.cos(tm * Math.PI) * 680,
                450 - moonE * 320,
                moonVis,
            ]);
            gl.uniform2fv(u("uGlow"), [
                sunVis * (0.3 + 0.7 * (1 - sunE)),
                moonVis * 0.3 * l.stars,
            ]);
            gl.uniform3fv(u("uSunCol"), pack(l.light));
            gl.uniform3fv(
                u("uCl"),
                pack(l.tone([252, 248, 242]), l.tone([170, 182, 208])),
            );
            ready = true;
            wake();
        },
        dispose() {
            cancelAnimationFrame(raf);
            canvas.removeEventListener("webglcontextlost", onContextLost);
            window.removeEventListener("resize", resize);
            window.removeEventListener("scroll", onScroll);
            gl.deleteTexture(texture);
            gl.deleteProgram(program);
        },
    };
}

function scrollRatio() {
    const root = document.documentElement;
    const max = root.scrollHeight - root.clientHeight;
    return scrollY / Math.max(1, max);
}

function startLink(gl: WebGL2RenderingContext) {
    const vs = gl.createShader(gl.VERTEX_SHADER);
    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    const program = gl.createProgram();
    if (!vs || !fs) return null;
    gl.shaderSource(vs, VERT);
    gl.shaderSource(fs, FRAG);
    gl.compileShader(vs);
    gl.compileShader(fs);
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    return { program, shaders: [vs, fs] };
}

function finishLink(gl: WebGL2RenderingContext, job: Job) {
    let ok = true;
    for (const s of job.shaders) {
        if (gl.getShaderParameter(s, gl.COMPILE_STATUS)) continue;
        console.error(`compile: ${gl.getShaderInfoLog(s)}`);
        ok = false;
    }
    for (const s of job.shaders) gl.deleteShader(s);
    if (ok && gl.getProgramParameter(job.program, gl.LINK_STATUS)) {
        return job.program;
    }
    console.error(`link: ${gl.getProgramInfoLog(job.program)}`);
    gl.deleteProgram(job.program);
    return null;
}

function pathPts(d: string) {
    const t = d.match(/[A-Z]|-?[\d.]+/g) ?? [];
    const pts: [number, number][] = [];
    let i = 0;
    let cmd = "";
    while (i < t.length) {
        if (/[A-Z]/.test(t[i])) {
            cmd = t[i++];
        } else if (cmd === "Q") {
            const [x1, y1, x, y] = t.slice(i, i + 4).map(Number);
            const [x0, y0] = pts[pts.length - 1];
            i += 4;
            for (let k = 1; k <= 16; k++) {
                const u = k / 16;
                const p = (1 - u) ** 2;
                const q = 2 * u * (1 - u);
                const r = u * u;
                pts.push([p * x0 + q * x1 + r * x, p * y0 + q * y1 + r * y]);
            }
        } else {
            pts.push([Number(t[i]), Number(t[i + 1])]);
            i += 2;
        }
    }
    return pts;
}

function buildRows() {
    const rows: Float32Array[] = [];
    const top: number[] = [];
    const yAt = (pts: [number, number][], x: number) => {
        let j = 1;
        while (j < pts.length - 1 && pts[j][0] < x) j++;
        const [x0, y0] = pts[j - 1];
        const [x1, y1] = pts[j];
        return x1 === x0
            ? y1
            : y0 + (y1 - y0) * Math.min(1, Math.max(0, (x - x0) / (x1 - x0)));
    };
    const blur = (row: Float32Array, r: number) => {
        const out = new Float32Array(1600);
        for (let x = 0; x < 1600; x++) {
            let sum = 0;
            for (let k = -r; k <= r; k++) {
                sum += row[Math.min(1599, Math.max(0, x + k))];
            }
            out[x] = sum / (2 * r + 1);
        }
        return out;
    };
    const ridges = RIDGE_D.map((d) => {
        const pts = pathPts(d).slice(0, -2);
        const row = new Float32Array(1600);
        for (let x = 0; x < 1600; x++) row[x] = yAt(pts, x + 0.5);
        top.push(row.reduce((m, v) => Math.min(m, v), 999));
        return row;
    });
    rows.push(...ridges.map((r) => blur(blur(r, 45), 45)));
    for (const d of ZONE_D) {
        const pts = pathPts(d);
        const lo: (number | null)[] = new Array(1600).fill(null);
        const hi: number[] = new Array(1600).fill(0);
        for (let x = 0; x < 1600; x++) {
            const xc = x + 0.5;
            let a = Infinity;
            let b = -Infinity;
            for (let k = 0; k < pts.length; k++) {
                const [x0, y0] = pts[k];
                const [x1, y1] = pts[(k + 1) % pts.length];
                if ((x0 <= xc && xc < x1) || (x1 <= xc && xc < x0)) {
                    const y = y0 + ((y1 - y0) * (xc - x0)) / (x1 - x0);
                    a = Math.min(a, y);
                    b = Math.max(b, y);
                }
            }
            if (a !== Infinity) {
                lo[x] = a;
                hi[x] = b;
            }
        }
        const valid = lo.flatMap((v, x) => (v === null ? [] : [x]));
        const t = new Float32Array(1600);
        const bt = new Float32Array(1600);
        for (let x = 0; x < 1600; x++) {
            const v = lo[x];
            if (v === null) {
                const n = valid.reduce((best, c) =>
                    Math.abs(c - x) < Math.abs(best - x) ? c : best,
                );
                t[x] = bt[x] = lo[n] ?? 0;
            } else {
                t[x] = v;
                bt[x] = hi[x];
            }
        }
        rows.push(t, bt);
    }
    const data = new Uint16Array(1600 * ROWS);
    rows.forEach((row, r) => {
        row.forEach((v, x) => {
            data[r * 1600 + x] = half(v - Y0);
        });
    });
    return { data, top: new Float32Array(top) };
}

const HF32 = new Float32Array(1);
const HU32 = new Uint32Array(HF32.buffer);

function half(v: number) {
    HF32[0] = v;
    const x = HU32[0];
    const sign = (x >>> 16) & 0x8000;
    const e = ((x >>> 23) & 0xff) - 112;
    if (e <= 0) return sign;
    if (e >= 31) return sign | 0x7bff;
    return sign | ((e << 10) + (((x & 0x7fffff) + 0x1000) >>> 13));
}

const RIDGE_D = [
    "M0 431 Q110 423 210 420 Q330 415 440 420 Q560 425 660 418 Q780 410 890 407 Q990 403 1090 406 Q1200 409 1300 405 Q1420 401 1600 408 L1600 900 L0 900 Z",
    "M0 479 L70 469 L140 461 L200 456 L240 454 L280 458 L350 466 L430 476 L520 486 L630 494 L730 489 L830 481 L945 474 L1040 481 L1120 491 L1200 499 L1290 492 L1380 482 L1470 474 L1600 468 L1600 900 L0 900 Z",
    "M0 548 L90 538 L180 528 L280 520 L380 515 L470 512 L505 511 L545 514 L585 521 L612 519 L660 528 L702 526 L760 535 L830 543 L872 542 L940 551 L1010 559 L1080 565 L1122 564 L1200 572 L1280 577 L1360 581 L1440 584 L1520 587 L1600 589 L1600 900 L0 900 Z",
    "M0 586 L60 578 L120 572 L170 568 L212 567 L252 572 L300 580 L342 579 L400 589 L452 597 L492 595 L552 607 L620 617 L662 615 L722 626 L790 636 L862 646 L902 644 L972 656 L1042 664 L1112 672 L1182 679 L1224 677 L1292 687 L1362 694 L1442 700 L1522 705 L1600 709 L1600 900 L0 900 Z",
    "M0 756 L80 744 L170 729 L262 710 L302 703 L320 706 L380 691 L440 680 L502 670 L582 663 L662 660 L722 660 L762 664 L832 672 L902 684 L938 691 L956 689 L1042 710 L1112 723 L1182 735 L1252 747 L1322 756 L1392 762 L1462 765 L1532 767 L1600 765 L1600 900 L0 900 Z",
    "M0 774 L70 785 L140 798 L220 815 L302 834 L342 843 L360 839 L440 860 L520 880 L592 905 L1008 905 L1082 886 L1152 863 L1220 841 L1246 826 L1262 830 L1330 788 L1388 762 L1414 749 L1430 752 L1495 695 L1545 662 L1600 624 L1600 900 L0 900 Z",
];

const ZONE_D = [
    "M344 708 L500 678 L660 666 L636 690 L478 700 L374 720 Z",
    "M1046 716 L1182 741 L1296 758 L1246 772 L1120 752 L1004 730 Z",
    "M1600 629 L1548 667 L1497 700 L1388 767 L1284 821 L1236 840 L1284 859 L1372 810 L1478 747 L1560 690 L1600 662 Z",
    "M1600 624 L1545 662 L1495 695 L1430 752 L1414 749 L1388 762 L1330 788 L1262 830 L1246 826 L1254 838 L1268 842 L1336 800 L1394 774 L1420 761 L1436 764 L1501 707 L1551 674 L1600 636 Z",
    "M0 774 L70 785 L140 798 L220 815 L302 834 L342 843 L360 839 L440 860 L520 880 L578 900 L508 886 L432 868 L356 847 L338 851 L298 842 L216 823 L136 806 L66 793 L0 782 Z",
    "M0 790 L80 802 L180 822 L280 846 L380 866 L470 886 L540 902 L440 902 L330 878 L220 852 L110 824 L0 806 Z",
    "M1500 762 L1440 810 L1360 872 L1300 905 L1400 905 L1480 838 L1524 776 Z",
    "M1150 872 L1096 892 L1140 905 L1206 878 Z",
    "M150 806 L260 844 L350 874 L300 890 L190 852 L110 820 Z",
];

const VERT = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2. - 1., 0., 1.);
}`;

const FRAG = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;

uniform sampler2D uH;
uniform vec3 uView;
uniform float uStars;
uniform float uFog;
uniform float uShift;
uniform vec3 uSky[3];
uniform vec3 uHaze;
uniform vec3 uRA[6];
uniform vec3 uRB[6];
uniform vec3 uRC;
uniform float uTop[6];
uniform vec3 uAcc[4];
uniform vec2 uPar[7];
uniform vec3 uSun;
uniform vec3 uMoon;
uniform vec2 uGlow;
uniform vec3 uSunCol;
uniform vec3 uCl[2];
out vec4 oc;

const float ROWS = ${ROWS}.;
const float T = 40.;
const vec3 MOON = vec3(.8863, .9098, .9647);
const float OP[6] = float[6](.5, .6, .72, .85, .95, 1.);
const float AIR[6] = float[6](.5, .4, .3, .18, .07, 0.);
const float NA[6] = float[6](26., 30., 34., 34., 36., 26.);
const float NF[6] = float[6](.0038, .0045, .0052, .0062, .0071, .0091);
const int NO[6] = int[6](3, 3, 4, 4, 5, 5);

uint pcg(uint v) {
  uint s = v * 747796405u + 2891336453u;
  uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
  return (w >> 22u) ^ w;
}
float h1(int n) { return float(pcg(uint(n))) * (1. / 4294967295.); }
float h2(ivec2 p) { return float(pcg(uint(p.x) + pcg(uint(p.y)))) * (1. / 4294967295.); }
float vn1(float x) {
  float i = floor(x);
  float f = fract(x);
  f = f * f * (3. - 2. * f);
  return mix(h1(int(i)), h1(int(i) + 1), f);
}
float vn2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3. - 2. * f);
  ivec2 k = ivec2(i);
  return mix(mix(h2(k), h2(k + ivec2(1, 0)), f.x), mix(h2(k + ivec2(0, 1)), h2(k + ivec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) {
  float a = .5;
  float s = 0.;
  for (int o = 0; o < 4; o++) {
    s += a * vn2(p);
    p = p * 2.03 + vec2(17.1, 9.3);
    a *= .5;
  }
  return s;
}

float HT(int r, float x) {
  return textureLod(uH, vec2(x / 1600., (float(r) + .5) / ROWS), 0.).r + ${Y0}.;
}

float ridgeH(int k, float x) {
  float xx = x * NF[k] + float(k) * 17.3;
  float a = .5;
  float s = 0.;
  float m = 0.;
  for (int o = 0; o < 5; o++) {
    if (o >= NO[k]) break;
    float r = 1. - abs(2. * vn1(xx) - 1.);
    m += a * .5;
    s += a * r;
    xx = xx * 2.03 + 11.7;
    a *= .5;
  }
  return HT(k, x) + (s - m) * NA[k] * 2.;
}

vec3 skyGrad(float y) {
  float t = y / 900.;
  return t < .26 ? mix(uSky[0], uSky[1], clamp(t / .26, 0., 1.)) : mix(uSky[1], uSky[2], clamp((t - .26) / .19, 0., 1.));
}

float tStars(vec2 p, float px) {
  float x = mod(p.x - uShift, 1600.);
  ivec2 c = ivec2(int(x / 25.), int(floor(p.y / 25.)));
  if (c.y < 0 || c.y > 15) return 0.;
  float a = h2(c);
  if (a > .27) return 0.;
  float b = h2(c + ivec2(131, 17));
  float d = h2(c + ivec2(53, 211));
  float e = h2(c + ivec2(7, 77));
  vec2 ctr = (vec2(c) + vec2(.36 + .28 * b, .36 + .28 * d)) * 25.;
  float r = .5 + e * e * 1.5;
  float dist = length(vec2(x, p.y) - ctr);
  float core = 1. - smoothstep(r - px * .5, r + px * .8, dist);
  float glow = e > .82 ? pow(1. - clamp(dist / (r * 5.), 0., 1.), 2.) * .35 : 0.;
  return (core + glow) * (.4 + .6 * fract(a * 91.7));
}

vec3 night(vec3 col, vec2 p, float mask, float px) {
  col = mix(col, vec3(.0118, .0157, .0275), .32 * uStars * mask);
  if (uStars > 0.) col = mix(col, vec3(1.), clamp(tStars(p, px) * uStars * mask, 0., 1.));
  return col;
}

vec3 celestial(vec3 col, vec2 p, float px) {
  vec2 d = p - uSun.xy;
  float r = length(d);
  float g = exp(-pow((p.x - uSun.x) / 540., 2.)) * exp(-max(440. - p.y, 0.) / 120.) * uGlow.x;
  col = mix(col, uSunCol, clamp(g * .55, 0., 1.));
  float halo = exp(-r * r / (2. * 95. * 95.)) * .55 + exp(-r / 320.) * .25;
  col = mix(col, uSunCol, clamp(halo, 0., 1.) * uSun.z);
  col = mix(col, mix(uSunCol, vec3(1., .99, .94), .75), (1. - smoothstep(34. - px, 34. + px, r)) * uSun.z);
  vec2 m = p - uMoon.xy;
  float rm = length(m);
  float gm = exp(-pow((p.x - uMoon.x) / 540., 2.)) * exp(-max(440. - p.y, 0.) / 120.) * uGlow.y;
  col = mix(col, MOON, clamp(gm * .25, 0., 1.));
  col = mix(col, MOON * vec3(.7, .8, 1.), clamp(exp(-rm / 55.) * .35, 0., 1.) * uMoon.z);
  float disc = 1. - smoothstep(25. - px, 25. + px, rm);
  col = mix(col, MOON * (.84 + .16 * vn2(m * .11 + 3.)), disc * uMoon.z);
  return col;
}

vec3 clouds(vec3 col, vec2 p) {
  float dd = max(470. - p.y, 0.);
  if (dd <= 0.) return col;
  float q = 1. / (.2 + dd / 330.);
  vec2 cp = vec2((p.x - 800.) / 420. * q * .55 + T * .015, q * .9);
  float n = fbm(cp * vec2(1.4, 1.1) + vec2(3., 7.));
  float cov = smoothstep(.5, .72, n) * smoothstep(0., 70., dd);
  vec3 c = mix(uCl[0], uCl[1], smoothstep(.55, .95, n) * .7);
  float sd = exp(-pow((p.x - uSun.x) / 500., 2.)) * uSun.z * .5;
  c = mix(c, uSunCol, sd);
  return mix(col, c, cov * .85);
}

vec3 rcol(int i, vec2 q) {
  float v = clamp((q.y - uTop[i]) / (900. - uTop[i]), 0., 1.);
  if (i == 5) {
    float t = clamp((.18 * q.x / 1600. + clamp((q.y - uTop[5]) / (905. - uTop[5]), 0., 1.)) / 1.0324, 0., 1.);
    return t < .5 ? mix(uRA[5], uRB[5], t * 2.) : mix(uRB[5], uRC, (t - .5) * 2.);
  }
  return mix(uRA[i], uRB[i], v);
}

float zn(int r, vec2 q, float px) {
  float t = HT(r, q.x);
  float b = HT(r + 1, q.x);
  return clamp(.5 + min(q.y - t, b - q.y) / (1.5 * px), 0., 1.) * clamp((b - t) / px, 0., 1.);
}

vec3 surface(vec3 c, int k, float d, vec2 q, float sl, float px) {
  float pos = float(k);
  float far = 1. - smoothstep(2.6, 3.6, pos);
  float steep = smoothstep(.45, 1.5, abs(sl));
  c = mix(c, c * vec3(.8, .84, .92), far * .5);
  float rk = exp(-max(d, 0.) / 55.);
  c *= 1. - far * steep * rk * (.16 + .24 * vn2(vec2(q.x * .05, q.y * .11) + pos * 3.));
  float el = HT(k, q.x) - q.y;
  float L = 8. + 30. * steep - (vn1(q.x * .05 + pos * 3.) - .5) * 26. - (vn1(q.x * .21) - .5) * 8.;
  float lum = dot(uSky[2], vec3(.3, .6, .1));
  vec3 sn = mix(uHaze, vec3(1.), .6) * clamp(.35 + .75 * lum, 0., 1.);
  float fc = clamp(dot(normalize(vec2(sl, -1.)), normalize(vec2(clamp((uSun.x - q.x) / 380., -1., 1.), -.7))), 0., 1.);
  sn *= (.8 + .25 * fc) * (.96 + .08 * vn2(q * .12));
  float aa = max(2., px * 1.5);
  float m = smoothstep(L - aa, L + aa, el) * far;
  return mix(c, sn, m * .95);
}

vec3 mist(vec3 col, vec3 airC, int k, float cov, vec2 qn, float hn) {
  float pos = float(k);
  float delta = qn.y - hn;
  float hf = 55. * (1. + .35 * sin(T * .12 + pos * 2.));
  float a = exp(-abs(delta) / (delta < 0. ? hf : 70.)) * .55;
  float fn = fbm(vec2(qn.x * .0045 + T * .02 * (1. + .3 * pos), qn.y * .012 + pos * 3.7));
  a *= smoothstep(.28, .72, fn) * 1.5 + .15;
  return mix(col, airC, clamp(a * uFog * (.6 + .15 * pos), 0., .9) * cov);
}

void main() {
  float px = 1. / uView.z;
  vec2 p = vec2((gl_FragCoord.x - .5 * uView.x) * px + 800., 900. - gl_FragCoord.y * px);
  vec2 q[6];
  float h[6];
  float dh[6];
  for (int k = 0; k < 6; k++) {
    q[k] = p - uPar[1 + k];
    h[k] = ridgeH(k, q[k].x);
    dh[k] = dFdx(h[k]);
  }
  vec2 p0 = p - uPar[0];
  vec3 col = skyGrad(p0.y);
  float c0 = clamp(.5 + (q[0].y - h[0]) / (px + abs(dh[0])), 0., 1.);
  col = night(col, p0, 1. - c0, px);
  col = celestial(col, p0, px);
  col = clouds(col, p0);
  vec3 airC = mix(uHaze, uSky[2], .4);
  for (int k = 0; k < 6; k++) {
    vec2 qk = q[k];
    float d = qk.y - h[k];
    float cov = clamp(.5 + d / (px + abs(dh[k])), 0., 1.);
    float sl = dh[k] / px;
    vec3 lc = surface(rcol(k, qk), k, d, qk, sl, px);
    lc = mix(lc, airC, min(1., AIR[k] * uFog));
    col = mix(col, lc, OP[k] * cov);
    if (k < 5) col = mist(col, airC, k, cov, q[k + 1], HT(1 + k, q[k + 1].x));
    if (k == 4 && qk.y > 655. && qk.y < 780.) {
      col = mix(col, uAcc[1], .2 * zn(6, qk, px));
      col = mix(col, uAcc[1], .18 * zn(8, qk, px));
    }
    if (k == 5 && qk.y > 600.) {
      float t = clamp(dot(qk - vec2(1470., 660.), vec2(-180., 210.)) / (180. * 180. + 210. * 210.), 0., 1.);
      col = mix(col, uAcc[0], .45 * (1. - t) * zn(10, qk, px));
      col = mix(col, uAcc[2], .18 * zn(12, qk, px));
      col = mix(col, uAcc[2], .12 * zn(14, qk, px));
      col = mix(col, uAcc[0], .35 * clamp(1. - (qk.y - 790.) / 112., 0., 1.) * zn(16, qk, px));
      col = mix(col, uAcc[0], .35 * clamp(1. - (qk.y - 762.) / 143., 0., 1.) * zn(18, qk, px));
      col = mix(col, uAcc[3], .15 * zn(20, qk, px));
      col = mix(col, uAcc[3], .14 * zn(22, qk, px));
    }
  }
  oc = vec4(clamp(col, 0., 1.) + (h2(ivec2(gl_FragCoord.xy)) - .5) / 255., 1.);
}`;
