import "./Inkwell.scss";

export default function Inkwell({
    onClick,
    label = "Добавить книгу",
}: {
    onClick: () => void;
    label?: string;
}) {
    return (
        <button
            type="button"
            className="inkwell"
            aria-label={label}
            onClick={onClick}
        >
            <span className="inkwell-quill" aria-hidden="true">
                <svg
                    width="48"
                    height="185"
                    viewBox="0 0 26 100"
                    fill="none"
                    role="img"
                    aria-label="Перо"
                >
                    <path
                        d="M22.5 5 C 22.5 5, 6 22, 4 52 C 3 69, 6 81, 9.5 89"
                        stroke="var(--ink-soft)"
                        strokeWidth="2"
                        strokeLinecap="round"
                    />
                    <path
                        d="M21.5 8 C 13 16, 6 30, 4 48 C 11.5 42, 18 27, 21.5 13 Z"
                        fill="#8fa6bd"
                        opacity="0.9"
                    />
                    <path
                        d="M19 24 C 11 32, 5.5 45, 3.5 60 C 11 54, 16 41, 19 29 Z"
                        fill="#a8bacc"
                        opacity="0.85"
                    />
                    <path
                        d="M16 39 C 9 47, 4.5 58, 3.5 71 C 9.5 65, 13.5 54, 16 43 Z"
                        fill="#c6d3e1"
                        opacity="0.8"
                    />
                    <path
                        d="M8.5 89.4 C 9.2 88.4, 10 88.2, 10.6 88.6 L 12.4 96.4 Z"
                        fill="#2f3a52"
                    />
                </svg>
                <span className="inkwell-drop" aria-hidden="true" />
            </span>
            <span className="inkwell-pot" aria-hidden="true" />
        </button>
    );
}
