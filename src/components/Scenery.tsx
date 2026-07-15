import { useEffect, useRef } from "react";
import { create } from "klouds";
import "./Scenery.scss";

/* Небо и дрейфующие облачные гряды — один WebGL-canvas (klouds, ~9кб,
   один fullscreen-quad шейдер): вся анимация на GPU, main thread пуст.
   Горы и туман — статичные: один SVG с градиентами + один div. */

/* ── горы (viewBox 1440×560, низ экрана) ─────────────────────── */

const RIDGE_FAR =
    "M0 296 L74 246 L128 272 L214 196 L306 258 L398 188 L470 242 " +
    "L556 210 L640 262 L724 186 L812 248 L896 222 L988 272 L1074 198 " +
    "L1160 252 L1252 226 L1336 268 L1440 214 L1440 560 L0 560 Z";

const RIDGE_MID =
    "M0 356 L92 284 L162 328 L250 222 L332 306 L420 268 L504 336 " +
    "L592 204 L682 316 L768 278 L856 344 L948 238 L1038 326 L1128 296 " +
    "L1224 364 L1326 292 L1440 348 L1440 560 L0 560 Z";

const SNOW_MID =
    "M216 263 L250 222 L282 260 L268 250 L252 266 L234 253 Z " +
    "M558 245 L592 204 L626 244 L612 234 L595 250 L578 238 Z " +
    "M914 279 L948 238 L982 278 L968 268 L951 284 L934 271 Z";

/* долина слева, массив с главным пиком справа — как на референсе */
const RIDGE_NEAR =
    "M0 432 L96 396 L208 428 L318 402 L428 438 L548 410 L668 442 " +
    "L790 416 L880 372 L968 300 L1056 220 L1150 148 L1226 214 " +
    "L1290 186 L1368 262 L1440 238 L1440 560 L0 560 Z";

const SNOW_NEAR =
    "M1108 184 L1150 148 L1192 186 L1176 174 L1156 192 L1132 178 Z " +
    "M1262 212 L1290 186 L1318 212 L1306 204 L1292 218 L1276 208 Z";

/* зубчатая кромка леса вдоль долины — один путь, строится один раз */
const TREELINE = (() => {
    const base = (x: number) =>
        500 - 26 * Math.sin(x / 210) - 14 * Math.sin(x / 87);
    let d = `M0 ${Math.round(base(0))}`;
    for (let x = 0; x < 1440; x += 22) {
        const h =
            18 +
            13 * Math.abs(Math.sin(x * 0.7)) +
            7 * Math.abs(Math.sin(x * 0.13));
        d +=
            ` L${x + 11} ${Math.round(base(x + 11) - h)}` +
            ` L${x + 22} ${Math.round(base(x + 22))}`;
    }
    return `${d} L1440 560 L0 560 Z`;
})();

export default function Scenery() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) {
            return;
        }
        const clouds = create({
            selector: canvas,
            speed: 0.2,
            layerCount: 3,
            bgColor: [180, 201, 219],
            cloudColor1: [219, 228, 238],
            cloudColor2: [255, 255, 255],
        });
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            /* один кадр отрисовать — и заморозить */
            requestAnimationFrame(() =>
                requestAnimationFrame(() => clouds.stop()),
            );
        }
        return () => clouds.stop();
    }, []);

    return (
        <div className="scenery" aria-hidden="true">
            <canvas className="scenery-sky" ref={canvasRef} />
            <svg
                className="scenery-mountains"
                viewBox="0 0 1440 560"
                preserveAspectRatio="none"
            >
                <defs>
                    <linearGradient id="sc-far" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor="#e6edf4" />
                        <stop offset="1" stopColor="#f4f7fa" />
                    </linearGradient>
                    <linearGradient id="sc-mid" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor="#c9d6e3" />
                        <stop offset="1" stopColor="#e4ebf2" />
                    </linearGradient>
                    <linearGradient id="sc-near" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor="#9fb3c6" />
                        <stop offset="0.55" stopColor="#a8bacc" />
                        <stop offset="1" stopColor="#bccabf" />
                    </linearGradient>
                    <linearGradient id="sc-belt" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor="#fff" stopOpacity="0" />
                        <stop offset="0.5" stopColor="#fff" stopOpacity="0.75" />
                        <stop offset="1" stopColor="#fff" stopOpacity="0" />
                    </linearGradient>
                </defs>
                <path fill="url(#sc-far)" d={RIDGE_FAR} />
                <path fill="url(#sc-mid)" d={RIDGE_MID} />
                <path fill="#fff" opacity="0.92" d={SNOW_MID} />
                {/* пояс тумана между хребтами */}
                <rect
                    fill="url(#sc-belt)"
                    x="0"
                    y="330"
                    width="1440"
                    height="150"
                />
                <path fill="url(#sc-near)" d={RIDGE_NEAR} />
                <path fill="#fff" opacity="0.92" d={SNOW_NEAR} />
                <path fill="#5f7a6e" opacity="0.3" d={TREELINE} />
            </svg>
            <div className="scenery-fog" />
        </div>
    );
}
