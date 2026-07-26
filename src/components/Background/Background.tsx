import { type CSSProperties, useRef } from "react";
import "./Background.scss";
import { useDaylight, type Rgb } from "./daylight";

const RIDGE_TOP =
    "M0 431 Q110 423 210 420 Q330 415 440 420 Q560 425 660 418 Q780 410 890 407 Q990 403 1090 406 Q1200 409 1300 405 Q1420 401 1600 408 L1600 900 L0 900 Z";

function mulberry32(seed: number) {
    let state = seed;
    return () => {
        state = (state + 0x6d2b79f5) | 0;
        let z = state;
        z = Math.imul(z ^ (z >>> 15), z | 1);
        z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
        return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
    };
}

const rng = mulberry32(20260726);
const STARS = Array.from({ length: 110 }, () => ({
    x: Math.round(rng() * 1600),
    y: Math.round(rng() * 385),
    r: +(0.5 + rng() * rng() * 1.4).toFixed(2),
    a: +(0.35 + rng() * 0.65).toFixed(2),
    halo: rng() < 0.1,
}));

const COMET_ANGLE = 25;
const COMET_DX = Math.cos((COMET_ANGLE * Math.PI) / 180);
const COMET_DY = Math.sin((COMET_ANGLE * Math.PI) / 180);
const COMETS = [
    { x: 220, y: 70, travel: 430, dur: 9, delay: 0, w: 1.5 },
    { x: 860, y: 140, travel: 340, dur: 13, delay: 5, w: 1.1 },
    { x: 1250, y: 40, travel: 380, dur: 16, delay: 9, w: 1.3 },
];

const STAR_DRIFT = 1600 / 12;

const SKY_MASK = `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1600 900'><path fill='#fff' fill-rule='evenodd' d='M0 0H1600V900H0Z ${RIDGE_TOP}'/></svg>`,
)}")`;

const STAR_LAYERS = [0, 1, 2].map((layer) =>
    STARS.filter((_, i) => i % 3 === layer).map((s, i) => (
        <g key={i}>
            {s.halo && (
                <circle
                    cx={s.x}
                    cy={s.y}
                    r={s.r * 6}
                    fill="url(#bg-star-halo)"
                    opacity="0.35"
                />
            )}
            <circle cx={s.x} cy={s.y} r={s.r} fill="#fff" fillOpacity={s.a} />
            {s.halo && (
                <circle
                    cx={s.x - 1600}
                    cy={s.y}
                    r={s.r * 6}
                    fill="url(#bg-star-halo)"
                    opacity="0.35"
                />
            )}
            <circle
                cx={s.x - 1600}
                cy={s.y}
                r={s.r}
                fill="#fff"
                fillOpacity={s.a}
            />
        </g>
    )),
);

const RIDGES: [string, Rgb, Rgb][] = [
    ["bg-r1", [240, 217, 204], [230, 202, 187]],
    ["bg-r2", [227, 200, 184], [210, 179, 164]],
    ["bg-r3", [182, 172, 158], [156, 146, 130]],
    ["bg-r4", [143, 154, 137], [111, 124, 107]],
    ["bg-r5", [100, 120, 106], [67, 86, 74]],
];
const R6: [Rgb, Rgb, Rgb] = [
    [77, 99, 85],
    [53, 73, 61],
    [32, 44, 36],
];
const MEADOW: Rgb = [58, 75, 64];
const GLOW: Rgb = [246, 216, 174];
const DARK: Rgb = [16, 26, 20];
const SHADE: Rgb = [15, 25, 19];

export default function Background({
    hour,
    drift = false,
}: {
    hour: number;
    drift?: boolean;
}) {
    const light = useDaylight(hour);
    const shiftRef = useRef((hour * STAR_DRIFT) % 1600);
    if (drift) shiftRef.current = (hour * STAR_DRIFT) % 1600;
    const shift = shiftRef.current;
    const tone = light ? light.tone : (c: Rgb) => `rgb(${c.join(" ")})`;
    const grade = (c: Rgb) =>
        tone(
            c.map((v, n) =>
                light ? v + (light.ridge[n] - v) * light.ridgeMix : v,
            ) as Rgb,
        );
    const haze = light?.haze ?? "#fdf0dc";
    const hazeOp = light?.hazeOpacity ?? 1;
    return (
        <div className="site-bg" aria-hidden="true">
            <svg
                className="site-bg-scene"
                viewBox="0 0 1600 900"
                preserveAspectRatio="xMidYMax slice"
            >
                <defs>
                    <linearGradient id="bg-sky" x1="0" y1="0" x2="0" y2="1">
                        <stop
                            offset="0"
                            stopColor={light?.sky[0] ?? "#f2cdb4"}
                        />
                        <stop
                            offset="0.26"
                            stopColor={light?.sky[1] ?? "#f6dbc2"}
                        />
                        <stop
                            offset="0.45"
                            stopColor={light?.sky[2] ?? "#fbeed9"}
                        />
                        <stop
                            offset="1"
                            stopColor={light?.sky[2] ?? "#fbeed9"}
                        />
                    </linearGradient>
                    {RIDGES.map(([id, top, bottom]) => (
                        <linearGradient
                            key={id}
                            id={id}
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                        >
                            <stop offset="0" stopColor={grade(top)} />
                            <stop offset="1" stopColor={grade(bottom)} />
                        </linearGradient>
                    ))}
                    <linearGradient
                        id="bg-r6"
                        x1="0"
                        y1="0"
                        x2="0.18"
                        y2="1"
                    >
                        <stop offset="0" stopColor={grade(R6[0])} />
                        <stop offset="0.5" stopColor={grade(R6[1])} />
                        <stop offset="1" stopColor={grade(R6[2])} />
                    </linearGradient>
                    <linearGradient
                        id="bg-m1"
                        gradientUnits="userSpaceOnUse"
                        x1="0"
                        y1="460"
                        x2="0"
                        y2="715"
                    >
                        <stop offset="0" stopColor={haze} stopOpacity="0" />
                        <stop
                            offset="0.47"
                            stopColor={haze}
                            stopOpacity={0.22 * hazeOp}
                        />
                        <stop offset="1" stopColor={haze} stopOpacity="0" />
                    </linearGradient>
                    <linearGradient
                        id="bg-m2"
                        gradientUnits="userSpaceOnUse"
                        x1="0"
                        y1="595"
                        x2="0"
                        y2="795"
                    >
                        <stop offset="0" stopColor={haze} stopOpacity="0" />
                        <stop
                            offset="0.48"
                            stopColor={haze}
                            stopOpacity={0.4 * hazeOp}
                        />
                        <stop offset="1" stopColor={haze} stopOpacity="0" />
                    </linearGradient>
                    <linearGradient
                        id="bg-m3"
                        gradientUnits="userSpaceOnUse"
                        x1="0"
                        y1="735"
                        x2="0"
                        y2="900"
                    >
                        <stop offset="0" stopColor={haze} stopOpacity="0" />
                        <stop
                            offset="0.76"
                            stopColor={haze}
                            stopOpacity={0.5 * hazeOp}
                        />
                        <stop
                            offset="1"
                            stopColor={haze}
                            stopOpacity={0.2 * hazeOp}
                        />
                    </linearGradient>
                    <linearGradient
                        id="bg-shade"
                        gradientUnits="userSpaceOnUse"
                        x1="1470"
                        y1="660"
                        x2="1290"
                        y2="870"
                    >
                        <stop
                            offset="0"
                            stopColor={tone(SHADE)}
                            stopOpacity="0.45"
                        />
                        <stop offset="1" stopColor={tone(SHADE)} stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id="bg-lshade" x1="0" y1="0" x2="0" y2="1">
                        <stop
                            offset="0"
                            stopColor={tone(SHADE)}
                            stopOpacity="0.35"
                        />
                        <stop offset="1" stopColor={tone(SHADE)} stopOpacity="0" />
                    </linearGradient>
                </defs>
                <rect width="1600" height="900" fill="url(#bg-sky)" />
                <path fill="url(#bg-r1)" opacity="0.5" d={RIDGE_TOP} />
                <path
                    fill="url(#bg-r2)"
                    opacity="0.6"
                    d="M0 479 L70 469 L140 461 L200 456 L240 454 L280 458 L350 466 L430 476 L520 486 L630 494 L730 489 L830 481 L945 474 L1040 481 L1120 491 L1200 499 L1290 492 L1380 482 L1470 474 L1600 468 L1600 900 L0 900 Z"
                />
                <path
                    fill="url(#bg-r3)"
                    opacity="0.72"
                    d="M0 548 L90 538 L180 528 L280 520 L380 515 L470 512 L505 511 L545 514 L585 521 L612 519 L660 528 L702 526 L760 535 L830 543 L872 542 L940 551 L1010 559 L1080 565 L1122 564 L1200 572 L1280 577 L1360 581 L1440 584 L1520 587 L1600 589 L1600 900 L0 900 Z"
                />
                <rect
                    x="0"
                    y="460"
                    width="1600"
                    height="255"
                    fill="url(#bg-m1)"
                />
                <path
                    fill="url(#bg-r4)"
                    opacity="0.85"
                    d="M0 586 L60 578 L120 572 L170 568 L212 567 L252 572 L300 580 L342 579 L400 589 L452 597 L492 595 L552 607 L620 617 L662 615 L722 626 L790 636 L862 646 L902 644 L972 656 L1042 664 L1112 672 L1182 679 L1224 677 L1292 687 L1362 694 L1442 700 L1522 705 L1600 709 L1600 900 L0 900 Z"
                />
                <rect
                    x="0"
                    y="595"
                    width="1600"
                    height="200"
                    fill="url(#bg-m2)"
                />
                <path
                    fill="url(#bg-r5)"
                    opacity="0.95"
                    d="M0 756 L80 744 L170 729 L262 710 L302 703 L320 706 L380 691 L440 680 L502 670 L582 663 L662 660 L722 660 L762 664 L832 672 L902 684 L938 691 L956 689 L1042 710 L1112 723 L1182 735 L1252 747 L1322 756 L1392 762 L1462 765 L1532 767 L1600 765 L1600 900 L0 900 Z"
                />
                <path
                    fill={tone(MEADOW)}
                    opacity="0.2"
                    d="M344 708 L500 678 L660 666 L636 690 L478 700 L374 720 Z"
                />
                <path
                    fill={tone(MEADOW)}
                    opacity="0.18"
                    d="M1046 716 L1182 741 L1296 758 L1246 772 L1120 752 L1004 730 Z"
                />
                <rect
                    x="0"
                    y="735"
                    width="1600"
                    height="165"
                    fill="url(#bg-m3)"
                />
                <path
                    fill="url(#bg-r6)"
                    d="M0 774 L70 785 L140 798 L220 815 L302 834 L342 843 L360 839 L440 860 L520 880 L592 905 L1008 905 L1082 886 L1152 863 L1220 841 L1246 826 L1262 830 L1330 788 L1388 762 L1414 749 L1430 752 L1495 695 L1545 662 L1600 624 L1600 900 L0 900 Z"
                />
                <path
                    fill="url(#bg-shade)"
                    d="M1600 629 L1548 667 L1497 700 L1388 767 L1284 821 L1236 840 L1284 859 L1372 810 L1478 747 L1560 690 L1600 662 Z"
                />
                <path
                    fill={tone(GLOW)}
                    opacity="0.18"
                    d="M1600 624 L1545 662 L1495 695 L1430 752 L1414 749 L1388 762 L1330 788 L1262 830 L1246 826 L1254 838 L1268 842 L1336 800 L1394 774 L1420 761 L1436 764 L1501 707 L1551 674 L1600 636 Z"
                />
                <path
                    fill={tone(GLOW)}
                    opacity="0.12"
                    d="M0 774 L70 785 L140 798 L220 815 L302 834 L342 843 L360 839 L440 860 L520 880 L578 900 L508 886 L432 868 L356 847 L338 851 L298 842 L216 823 L136 806 L66 793 L0 782 Z"
                />
                <path
                    fill="url(#bg-lshade)"
                    d="M0 790 L80 802 L180 822 L280 846 L380 866 L470 886 L540 902 L440 902 L330 878 L220 852 L110 824 L0 806 Z"
                />
                <path
                    fill="url(#bg-lshade)"
                    d="M1500 762 L1440 810 L1360 872 L1300 905 L1400 905 L1480 838 L1524 776 Z"
                />
                <path
                    fill={tone(DARK)}
                    opacity="0.15"
                    d="M1150 872 L1096 892 L1140 905 L1206 878 Z"
                />
                <path
                    fill={tone(DARK)}
                    opacity="0.14"
                    d="M150 806 L260 844 L350 874 L300 890 L190 852 L110 820 Z"
                />
            </svg>
            {light && light.stars > 0 && (
                <div
                    className="site-bg-stars"
                    style={
                        {
                            opacity: light.stars,
                            "--sky-mask": SKY_MASK,
                        } as CSSProperties
                    }
                >
                    {STAR_LAYERS.map((stars, n) => (
                        <svg
                            key={n}
                            className={`bg-star-${n}`}
                            viewBox="0 0 1600 900"
                            preserveAspectRatio="xMidYMax slice"
                        >
                            {n === 0 && (
                                <defs>
                                    <radialGradient id="bg-star-halo">
                                        <stop
                                            offset="0"
                                            stopColor="#fff"
                                            stopOpacity="0.9"
                                        />
                                        <stop
                                            offset="1"
                                            stopColor="#fff"
                                            stopOpacity="0"
                                        />
                                    </radialGradient>
                                </defs>
                            )}
                            <g transform={`translate(${shift.toFixed(1)} 0)`}>
                                {stars}
                            </g>
                        </svg>
                    ))}
                    <svg
                        className="site-bg-comets"
                        viewBox="0 0 1600 900"
                        preserveAspectRatio="xMidYMax slice"
                    >
                        <defs>
                            <linearGradient
                                id="bg-comet-tail"
                                gradientUnits="userSpaceOnUse"
                                x1="-120"
                                y1="0"
                                x2="0"
                                y2="0"
                            >
                                <stop
                                    offset="0"
                                    stopColor="#fff"
                                    stopOpacity="0"
                                />
                                <stop offset="1" stopColor="#fff" />
                            </linearGradient>
                        </defs>
                        {COMETS.map((c) => (
                            <g
                                key={c.x}
                                className="bg-comet"
                                style={
                                    {
                                        "--x0": `${c.x}px`,
                                        "--y0": `${c.y}px`,
                                        "--x1": `${c.x + c.travel * COMET_DX}px`,
                                        "--y1": `${c.y + c.travel * COMET_DY}px`,
                                        animationDuration: `${c.dur}s`,
                                        animationDelay: `${c.delay}s`,
                                    } as CSSProperties
                                }
                            >
                                <g transform={`rotate(${COMET_ANGLE})`}>
                                    <line
                                        x1="-120"
                                        y1="0"
                                        x2="0"
                                        y2="0"
                                        stroke="url(#bg-comet-tail)"
                                        strokeWidth={c.w}
                                        strokeLinecap="round"
                                    />
                                    <circle
                                        r={c.w * 5}
                                        fill="url(#bg-star-halo)"
                                        opacity="0.5"
                                    />
                                    <circle r={c.w * 1.2} fill="#fff" />
                                </g>
                            </g>
                        ))}
                    </svg>
                </div>
            )}
        </div>
    );
}
