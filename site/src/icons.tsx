import { memo, type ReactNode } from "react";

type SvgProps = {
    d?: string;
    size?: number;
    fill?: string;
    viewBoxSize?: [number, number];
    className?: string;
    children?: ReactNode;
};

const Svg = memo(
    ({
        d,
        size = 16,
        fill,
        viewBoxSize = [20, 20],
        children,
        ...props
    }: SvgProps) => {
        const [viewBoxWidth, viewBoxHeight] = viewBoxSize;
        const viewBox = `0 0 ${viewBoxWidth} ${viewBoxHeight}`;
        const dx = (viewBoxWidth - 20) / 2;
        const dy = (viewBoxHeight - 20) / 2;
        const pathTransform =
            viewBoxWidth === viewBoxHeight
                ? `translate(${dx}, ${dy})`
                : undefined;

        return (
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width={size}
                height={size}
                fill={fill}
                viewBox={viewBox}
                aria-hidden="true"
                {...props}
            >
                {d && <path d={d} transform={pathTransform} />}
                {children}
            </svg>
        );
    },
);

export { Svg };

export type IconProps = {
    size?: number;
};

export function LogoIcon({ size }: IconProps) {
    return (
        <Svg size={size} viewBoxSize={[26, 26]}>
            <circle cx="13" cy="13" r="13" fill="var(--mist-2)" />
            <circle cx="19.5" cy="6.5" r="2.2" fill="#fff" />
            <path d="M3 19.5 L9.5 8.5 L16 19.5 Z" fill="#fff" />
            <path d="M11 19.5 L16.5 11 L23 19.5 Z" fill="var(--ridge-near)" />
        </Svg>
    );
}

export function EditIcon({ size }: IconProps) {
    return (
        <Svg size={size} viewBoxSize={[64, 64]}>
            <path
                d="M59.5 7c-.16-.09-11.93-6.6-27.01-.41-.39.84-.67 1.69-.87 2.5-.83 3.36-.32 6.2-.31 6.24.222 1.305-1.69 1.661-1.96.38-.03-.15-.46-2.44-.01-5.44.12-.8.3-1.64.57-2.51-4.23 2.1-8.68 5.25-13.17 9.82-.15.16-.25.36-.28.58l-1.06 8.66c-.65-.97-1.32-2.3-1.46-3.82-.046-.819-1.14-1.215-1.7-.62-.11.1-10.11 10.28-4.28 23.89.41-.76.83-1.5 1.28-2.24 9.34-15.39 27.81-27.19 28.83-27.82 1.103-.694 2.162.965 1.07 1.69-1.34.42-27.696 19.15-31.99 35.41-.61 2.02-1.02 4.07-1.16 6.14a1 1 0 0 0 1 1.07c.52 0 .96-.41.99-.93.27-3.96 1.6-7.89 3.58-11.65 3.729.647 8.303.712 12.21-.88.861-.333.797-1.664-.11-1.89-.03-.01-2.48-.73-3.51-2.5 2.135.762 6.38 1.476 10.64-.52l11.12-9.02c.35-.28.47-.77.28-1.18-.19-.42-.63-.65-1.07-.58-.03 0-2.33.35-4.63-1.37 2.4-.04 5.98-.37 8.24-1.75 2.3-1.4 6.92-6.25 10.57-11.45-1.856.41-7.473-.116-7.7-.3-1.288-.262-.883-2.2.39-1.96.05.01 3.08.59 6.19.36.91-.07 1.83-.21 2.68-.46 1.37-2.18 2.48-4.35 3.09-6.27A.99.99 0 0 0 59.5 7"
                fill="currentColor"
            />
        </Svg>
    );
}

export function ClockIcon({ size, hour }: IconProps & { hour: number }) {
    return (
        <Svg size={size}>
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
        </Svg>
    );
}

export function QuoteIcon({ size }: IconProps) {
    return (
        <Svg size={size} viewBoxSize={[24, 24]}>
            <g {...STROKE}>
                <path d="M7 7h4v4c0 2.2-1.8 4-4 4" />
                <path d="M15 7h4v4c0 2.2-1.8 4-4 4" />
            </g>
        </Svg>
    );
}

export function BulletListIcon({ size }: IconProps) {
    return (
        <Svg size={size} viewBoxSize={[24, 24]}>
            <g {...STROKE}>
                <circle
                    cx="5"
                    cy="7"
                    r="1.2"
                    fill="currentColor"
                    stroke="none"
                />
                <circle
                    cx="5"
                    cy="12"
                    r="1.2"
                    fill="currentColor"
                    stroke="none"
                />
                <circle
                    cx="5"
                    cy="17"
                    r="1.2"
                    fill="currentColor"
                    stroke="none"
                />
                <line x1="9" y1="7" x2="19" y2="7" />
                <line x1="9" y1="12" x2="19" y2="12" />
                <line x1="9" y1="17" x2="19" y2="17" />
            </g>
        </Svg>
    );
}

export function NumberedListIcon({ size }: IconProps) {
    return (
        <Svg size={size} viewBoxSize={[24, 24]}>
            <g {...STROKE}>
                <line x1="10" y1="6" x2="20" y2="6" />
                <line x1="10" y1="12" x2="20" y2="12" />
                <line x1="10" y1="18" x2="20" y2="18" />
                <text
                    x="3"
                    y="8.5"
                    fontSize="7"
                    stroke="none"
                    fill="currentColor"
                >
                    1
                </text>
                <text
                    x="3"
                    y="14.5"
                    fontSize="7"
                    stroke="none"
                    fill="currentColor"
                >
                    2
                </text>
                <text
                    x="3"
                    y="20.5"
                    fontSize="7"
                    stroke="none"
                    fill="currentColor"
                >
                    3
                </text>
            </g>
        </Svg>
    );
}

export function LineIcon({ size }: IconProps) {
    return (
        <Svg size={size} viewBoxSize={[24, 24]}>
            <g {...STROKE}>
                <line x1="4" y1="12" x2="20" y2="12" />
            </g>
        </Svg>
    );
}

export function LinkIcon({ size }: IconProps) {
    return (
        <Svg size={size} viewBoxSize={[24, 24]}>
            <g {...STROKE}>
                <path d="M9 15l6-6" />
                <path d="M10 6l1-1a4 4 0 015.5 5.5l-1.5 1.5" />
                <path d="M14 18l-1 1a4 4 0 01-5.5-5.5l1.5-1.5" />
            </g>
        </Svg>
    );
}

export function ImageIcon({ size }: IconProps) {
    return (
        <Svg size={size} viewBoxSize={[24, 24]}>
            <g {...STROKE}>
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <circle
                    cx="8.5"
                    cy="9.5"
                    r="1.5"
                    fill="currentColor"
                    stroke="none"
                />
                <path d="M21 16l-5.5-5.5a2 2 0 00-2.8 0L4 19" />
            </g>
        </Svg>
    );
}

const STROKE = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
} as const;
