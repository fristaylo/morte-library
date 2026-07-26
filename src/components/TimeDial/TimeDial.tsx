import {
    type KeyboardEvent,
    type PointerEvent,
    useRef,
    useState,
} from "react";
import Dialog from "../Dialogs/Dialog";
import "./TimeDial.scss";

function fmt(hour: number) {
    const m = Math.round(hour * 60) % 1440;
    return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export default function TimeDial({
    hour,
    isOverride,
    onChange,
    onOpenChange,
}: {
    hour: number;
    isOverride: boolean;
    onChange: (hour: number | null) => void;
    onOpenChange?: (open: boolean) => void;
}) {
    const [open, setOpen] = useState(false);
    const show = (v: boolean) => {
        setOpen(v);
        onOpenChange?.(v);
    };
    const faceRef = useRef<SVGSVGElement>(null);
    const dragging = useRef(false);
    const rafRef = useRef(0);
    const pointer = useRef({ x: 0, y: 0 });

    const applyPointer = () => {
        rafRef.current = 0;
        const el = faceRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const x = pointer.current.x - (r.left + r.width / 2);
        const y = pointer.current.y - (r.top + r.height / 2);
        const h = ((Math.atan2(x, -y) * 12) / Math.PI + 36) % 24;
        onChange((Math.round(h * 60) % 1440) / 60);
    };

    const setFromPointer = (e: PointerEvent<SVGSVGElement>) => {
        pointer.current = { x: e.clientX, y: e.clientY };
        if (!rafRef.current) {
            rafRef.current = requestAnimationFrame(applyPointer);
        }
    };

    const onKeyDown = (e: KeyboardEvent<SVGSVGElement>) => {
        const step =
            e.key === "ArrowRight" || e.key === "ArrowUp"
                ? 0.5
                : e.key === "ArrowLeft" || e.key === "ArrowDown"
                  ? -0.5
                  : 0;
        if (!step) return;
        e.preventDefault();
        onChange((hour + step + 24) % 24);
    };

    return (
        <>
            <button
                type="button"
                className={`topbar-chip time-chip${isOverride ? " is-set" : ""}`}
                aria-label="Настроить время суток"
                aria-haspopup="dialog"
                onClick={() => show(true)}
            >
                <svg
                    width="19"
                    height="19"
                    viewBox="0 0 20 20"
                    aria-hidden="true"
                >
                    <circle
                        cx="10"
                        cy="10"
                        r="8.2"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                    />
                    <g stroke="currentColor" strokeLinecap="round">
                        <line
                            x1="10"
                            y1="10"
                            x2="10"
                            y2="6"
                            strokeWidth="1.6"
                            transform={`rotate(${((hour % 12) / 12) * 360} 10 10)`}
                        />
                        <line
                            x1="10"
                            y1="10"
                            x2="10"
                            y2="4.4"
                            strokeWidth="1.1"
                            transform={`rotate(${(hour % 1) * 360} 10 10)`}
                        />
                    </g>
                </svg>
            </button>
            <Dialog
                open={open}
                onClose={() => show(false)}
                title="Время суток"
            >
                <div className="time-dial">
                    <svg
                        ref={faceRef}
                        className="time-face"
                        viewBox="0 0 240 240"
                        role="slider"
                        aria-label="Час суток"
                        aria-valuemin={0}
                        aria-valuemax={24}
                        aria-valuenow={Math.round(hour * 10) / 10}
                        aria-valuetext={fmt(hour)}
                        tabIndex={0}
                        onKeyDown={onKeyDown}
                        onPointerDown={(e) => {
                            dragging.current = true;
                            e.currentTarget.setPointerCapture(e.pointerId);
                            setFromPointer(e);
                        }}
                        onPointerMove={(e) => {
                            if (dragging.current) setFromPointer(e);
                        }}
                        onPointerUp={() => {
                            dragging.current = false;
                        }}
                    >
                        <defs>
                            <radialGradient
                                id="dial-face"
                                cx="0.5"
                                cy="0.42"
                                r="0.75"
                            >
                                <stop offset="0" stopColor="#fffdf6" />
                                <stop offset="1" stopColor="#f0e8d6" />
                            </radialGradient>
                        </defs>
                        <circle
                            cx="120"
                            cy="120"
                            r="112"
                            fill="url(#dial-face)"
                            stroke="var(--case-edge)"
                            strokeWidth="2.5"
                        />
                        <circle
                            cx="120"
                            cy="120"
                            r="99"
                            fill="none"
                            stroke="var(--line)"
                        />
                        {Array.from({ length: 24 }, (_, k) => (
                            <line
                                key={k}
                                x1="120"
                                y1={k % 6 === 0 ? 13 : 16}
                                x2="120"
                                y2="23"
                                stroke="var(--ink-faint)"
                                strokeWidth={k % 6 === 0 ? 2.4 : 1.2}
                                strokeLinecap="round"
                                transform={`rotate(${k * 15} 120 120)`}
                            />
                        ))}
                        <text
                            x="44"
                            y="120"
                            textAnchor="middle"
                            dominantBaseline="central"
                            fontSize="15"
                            fontFamily="var(--font-display)"
                            fill="var(--ink-faint)"
                        >
                            6
                        </text>
                        <text
                            x="196"
                            y="120"
                            textAnchor="middle"
                            dominantBaseline="central"
                            fontSize="15"
                            fontFamily="var(--font-display)"
                            fill="var(--ink-faint)"
                        >
                            18
                        </text>
                        <g
                            stroke="var(--gold)"
                            strokeWidth="2"
                            strokeLinecap="round"
                        >
                            {Array.from({ length: 8 }, (_, k) => (
                                <line
                                    key={k}
                                    x1="120"
                                    y1="32"
                                    x2="120"
                                    y2="36"
                                    transform={`rotate(${k * 45} 120 46)`}
                                />
                            ))}
                        </g>
                        <circle cx="120" cy="46" r="6.5" fill="var(--gold)" />
                        <path
                            d="M123 204.5a8.5 8.5 0 1 1 0-17c-3.4 1.7-5.6 4.8-5.6 8.5s2.2 6.8 5.6 8.5z"
                            fill="var(--ink-soft)"
                        />
                        <g transform={`rotate(${hour * 15 + 180} 120 120)`}>
                            <line
                                x1="120"
                                y1="136"
                                x2="120"
                                y2="64"
                                stroke="var(--ink)"
                                strokeWidth="4"
                                strokeLinecap="round"
                            />
                            <circle cx="120" cy="64" r="3.5" fill="var(--gold)" />
                        </g>
                        <circle
                            cx="120"
                            cy="120"
                            r="6"
                            fill="var(--gold)"
                            stroke="#fff"
                            strokeWidth="2"
                        />
                    </svg>
                    <p className="time-readout">{fmt(hour)}</p>
                    <button
                        type="button"
                        className="btn btn-ghost"
                        disabled={!isOverride}
                        onClick={() => onChange(null)}
                    >
                        Вернуть текущее время
                    </button>
                </div>
            </Dialog>
        </>
    );
}
