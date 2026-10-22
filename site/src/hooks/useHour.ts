import { useSyncExternalStore } from "react";

const HOUR_KEY = "morte:hour";

type HourState = {
    override: number | null;
    real: number;
    dialOpen: boolean;
};

let state: HourState = {
    override: storedHour(),
    real: nowHour(),
    dialOpen: false,
};
const listeners = new Set<() => void>();
let stopTick: (() => void) | null = null;

function update(patch: Partial<HourState>) {
    state = { ...state, ...patch };
    for (const notify of listeners) notify();
}

function tick() {
    if (document.hidden) return;
    const real = nowHour();
    if (real !== state.real) update({ real });
}

function subscribe(notify: () => void) {
    listeners.add(notify);
    if (!stopTick) {
        tick();
        const id = setInterval(tick, 60_000);
        document.addEventListener("visibilitychange", tick);
        stopTick = () => {
            clearInterval(id);
            document.removeEventListener("visibilitychange", tick);
        };
    }
    return () => {
        listeners.delete(notify);
        if (listeners.size === 0 && stopTick) {
            stopTick();
            stopTick = null;
        }
    };
}

function setOverride(next: number | null) {
    update({ override: next });
    if (next === null) localStorage.removeItem(HOUR_KEY);
    else localStorage.setItem(HOUR_KEY, String(next));
}

function setDialOpen(open: boolean) {
    update({ dialOpen: open });
}

export function useHour() {
    const { override, real, dialOpen } = useSyncExternalStore(
        subscribe,
        () => state,
    );
    return {
        hour: override ?? real,
        isOverride: override !== null,
        setOverride,
        dialOpen,
        setDialOpen,
    };
}

function nowHour() {
    const d = new Date();
    return d.getHours() + d.getMinutes() / 60;
}

function storedHour(): number | null {
    const raw = localStorage.getItem(HOUR_KEY);
    if (raw === null) return null;
    const h = Number(raw);
    return Number.isFinite(h) && h >= 0 && h < 24 ? h : null;
}
