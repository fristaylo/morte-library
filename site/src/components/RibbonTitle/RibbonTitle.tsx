import { useEffect, useRef } from "react";
import "./RibbonTitle.scss";

const TITLE = "Библиотека Морте";

export default function RibbonTitle() {
    const svgRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        const svg = svgRef.current;
        const title = svg?.parentElement;
        const stage = title?.parentElement;
        if (!svg || !title || !stage) return;
        const [tl, tr] = svg.querySelectorAll<SVGPathElement>(".hero-tail");
        const [fl, fr] = svg.querySelectorAll<SVGPathElement>(".hero-fold");
        const band = svg.querySelector<SVGPathElement>(".hero-band");
        const text = svg.querySelector<SVGTextElement>(".hero-text");
        const measureEl = svg.querySelector<SVGTextElement>(".hero-measure");
        if (!band || !text || !measureEl) return;
        const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
        let g: Geom | null = null;
        let start = 0;
        let raf = 0;
        let cancelled = false;
        let observer: ResizeObserver | null = null;

        const measure = () => {
            const fs = parseFloat(getComputedStyle(svg).fontSize);
            const H = 1.45 * fs;
            const L = measureEl.getComputedTextLength() + 1.3 * fs;
            g = {
                H,
                L,
                o: 0.36 * fs,
                f: 0.36 * fs,
                tw: 1.6 * fs,
                n: 0.42 * fs,
                amp: 0.6 * fs,
            };
            const w = L + 2 * g.tw + 16;
            const h = H + g.o + 2 * g.amp + 16;
            svg.setAttribute(
                "viewBox",
                `${-w / 2} ${-H / 2 - g.amp - 8} ${w} ${h}`,
            );
            svg.setAttribute("width", String(w));
            svg.setAttribute("height", String(h));
            text.setAttribute("y", String(0.33 * fs));
        };

        const draw = (tau: number) => {
            if (!g) return;
            const { H, L, o, f, tw, n, amp } = g;
            const x0 = -L / 2;
            const x1 = L / 2;
            const h = H / 2;
            const bend = (s: number, t: number) =>
                -amp * s ** 1.6 * wave(t - s * 0.12);
            const yl = (x: number) =>
                bend(Math.min(1, Math.max(0, (x0 - x) / tw)), tau);
            const yr = (x: number) =>
                bend(Math.min(1, Math.max(0, (x - x1) / tw)), tau - 0.07);
            band.setAttribute(
                "d",
                path([
                    [x0, -h],
                    [x1, -h],
                    [x1, h],
                    [x0, h],
                ]),
            );
            fl.setAttribute(
                "d",
                path([
                    [x0, h],
                    [x0 + f, h],
                    [x0 + f, h + o],
                ]),
            );
            fr.setAttribute(
                "d",
                path([
                    [x1 - f, h],
                    [x1, h],
                    [x1 - f, h + o],
                ]),
            );
            const lx = range(x0 - tw, x0 + f, 16);
            const rx = range(x1 - f, x1 + tw, 16);
            tl.setAttribute(
                "d",
                path([
                    ...lx.map((x): Point => [x, yl(x) + o - h]),
                    ...[...lx].reverse().map((x): Point => [x, yl(x) + o + h]),
                    [x0 - tw + n, yl(x0 - tw) + o],
                ]),
            );
            tr.setAttribute(
                "d",
                path([
                    ...rx.map((x): Point => [x, yr(x) + o - h]),
                    [x1 + tw - n, yr(x1 + tw) + o],
                    ...[...rx].reverse().map((x): Point => [x, yr(x) + o + h]),
                ]),
            );
        };

        const frame = (now: number) => {
            const tau = (now - start) / 1000;
            draw(tau);
            raf = tau < 2.5 ? requestAnimationFrame(frame) : 0;
        };

        const onEnter = () => {
            start = performance.now();
            if (!raf) raf = requestAnimationFrame(frame);
        };

        document.fonts.ready.then(() => {
            if (cancelled) return;
            observer = new ResizeObserver(() => {
                measure();
                draw(raf ? 0 : 99);
                title.classList.add("is-ready");
            });
            observer.observe(stage);
        });
        const onRise = (e: AnimationEvent) => {
            if (e.animationName === "hero-rise") onEnter();
        };
        title.addEventListener("animationend", onRise);
        if (!reduced) svg.addEventListener("pointerenter", onEnter);

        return () => {
            cancelled = true;
            cancelAnimationFrame(raf);
            observer?.disconnect();
            svg.removeEventListener("pointerenter", onEnter);
            title.removeEventListener("animationend", onRise);
        };
    }, []);

    return (
        <h1 className="hero-title" aria-label={TITLE}>
            <svg ref={svgRef} aria-hidden="true">
                <text className="hero-measure" visibility="hidden">
                    {TITLE}
                </text>
                <path className="hero-tail" />
                <path className="hero-tail" />
                <path className="hero-fold" />
                <path className="hero-fold" />
                <path className="hero-band" />
                <text className="hero-text" textAnchor="middle">
                    {TITLE}
                </text>
            </svg>
        </h1>
    );
}

type Point = [number, number];

type Geom = {
    H: number;
    L: number;
    o: number;
    f: number;
    tw: number;
    n: number;
    amp: number;
};

function path(pts: Point[]) {
    return `M${pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join("L")}Z`;
}

function range(from: number, to: number, n: number) {
    return Array.from(
        { length: n + 1 },
        (_, i) => from + ((to - from) * i) / n,
    );
}

function wave(t: number) {
    return t < 0 ? 0 : Math.exp(-2.8 * t) * Math.sin(2 * Math.PI * 1.7 * t);
}
