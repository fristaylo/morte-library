import type { ReactNode } from "react";
import { linkProps } from "../../lib/router";
import "./Header.scss";

export default function Header({
    clock,
    onRandom,
    right,
}: {
    clock?: ReactNode;
    onRandom?: () => void;
    right?: ReactNode;
}) {
    return (
        <header className="topbar">
            <a className="topbar-brand" {...linkProps("/")}>
                <svg
                    width="30"
                    height="30"
                    viewBox="0 0 26 26"
                    aria-hidden="true"
                >
                    <circle cx="13" cy="13" r="13" fill="var(--mist-2)" />
                    <circle cx="19.5" cy="6.5" r="2.2" fill="#fff" />
                    <path d="M3 19.5 L9.5 8.5 L16 19.5 Z" fill="#fff" />
                    <path
                        d="M11 19.5 L16.5 11 L23 19.5 Z"
                        fill="var(--ridge-near)"
                    />
                </svg>
                <span>Библиотека Морте</span>
            </a>
            <div className="topbar-actions">
                {clock}
                {onRandom && (
                    <button
                        type="button"
                        className="topbar-chip"
                        onClick={onRandom}
                    >
                        Случайное
                    </button>
                )}
                {right}
            </div>
        </header>
    );
}
