"use client";

import type * as React from "react";
import type { RecordingTag } from "@/lib/recording-tags";
import {
    RecordingTagIconGlyph,
    recordingTagColorClassName,
} from "./recording-tag-visuals";

const SOT_SOURCE_BADGES = {
    "dingtalk-a1": {
        label: "钉钉",
        icon: "/assets/sources/dingtalk.svg",
        cover: false,
        letter: "钉",
    },
    ticnote: {
        label: "TicNote",
        icon: "/assets/sources/ticnote.png",
        cover: false,
        letter: "T",
    },
    plaud: {
        label: "Plaud",
        icon: "/assets/sources/plaud.png",
        cover: true,
        letter: "P",
    },
    "feishu-minutes": {
        label: "飞书妙记",
        icon: "/assets/sources/feishu.jpeg",
        cover: true,
        letter: "飞",
    },
    iflyrec: {
        label: "讯飞听见",
        icon: null,
        cover: false,
        letter: "讯",
    },
} as const;

function pad2(value: number) {
    return String(value).padStart(2, "0");
}

function sourceFallbackLetter(provider: string, label: string) {
    const candidate = Array.from(label.trim())[0] ?? Array.from(provider)[0];
    return candidate?.toUpperCase() ?? "S";
}

export function formatSotPlayerDate(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} · ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function formatSotPlayerTime(value: number) {
    const seconds =
        value > 10_000 ? Math.floor(value / 1000) : Math.floor(value);
    if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${pad2(secs)}`;
}

export function formatSotPlaybackSpeed(value: number) {
    return `${Number.isInteger(value) ? value.toFixed(1) : value}×`;
}

export function SotPlayerSourceTag({
    label,
    provider,
}: {
    label?: string;
    provider: string;
}) {
    const badge =
        SOT_SOURCE_BADGES[provider as keyof typeof SOT_SOURCE_BADGES] ?? null;
    const sourceLabel = label ?? badge?.label ?? provider;
    const iconClassName = badge?.icon
        ? badge.cover
            ? "ico cover"
            : "ico"
        : "ico src-ico-letter";

    return (
        <span className="src-tag">
            <span className={iconClassName} aria-hidden="true">
                {badge?.icon ? (
                    <img src={badge.icon} alt="" />
                ) : (
                    (badge?.letter ??
                    sourceFallbackLetter(provider, sourceLabel))
                )}
            </span>
            {sourceLabel}
        </span>
    );
}

export function SotPlayerTagChip({
    count = 1,
    onClick,
    state = "idle",
    tag,
    trigger = false,
}: {
    count?: number;
    onClick?: () => void;
    state?: "idle" | "open";
    tag: RecordingTag | null;
    trigger?: boolean;
}) {
    const handleKeyDown = (event: React.KeyboardEvent<HTMLSpanElement>) => {
        if (!onClick) {
            return;
        }

        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onClick();
        }
    };

    if (!tag) {
        if (!trigger) {
            return null;
        }

        return (
            <button
                className="utag-add _is-h24"
                aria-expanded={trigger ? state === "open" : undefined}
                data-tagm-trigger="1"
                data-sot-control={trigger ? "recording-tag-manager" : undefined}
                data-sot-state={trigger ? state : undefined}
                onClick={onClick}
                type="button"
            >
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M12 5v14" />
                    <path d="M5 12h14" />
                </svg>
                <span>标签</span>
            </button>
        );
    }

    const className = `${recordingTagColorClassName[tag.color]} ${
        trigger ? "is-trigger _is-h24" : "_is-2"
    }`;

    if (!onClick) {
        return (
            <>
                <span
                    className={className}
                    data-tag-id={tag.id}
                    data-sot-tag-color={tag.color}
                    data-sot-tag-icon={tag.icon}
                    data-tagm-trigger={trigger ? "1" : undefined}
                    data-sot-control={
                        trigger ? "recording-tag-manager" : undefined
                    }
                    data-sot-state={trigger ? state : undefined}
                >
                    <RecordingTagIconGlyph icon={tag.icon} />
                    {tag.name}
                </span>
                {count > 1 ? (
                    <span
                        className={
                            trigger ? "utag-plus is-trigger" : "utag-plus"
                        }
                        data-tagm-trigger={trigger ? "1" : undefined}
                    >
                        +{count - 1}
                    </span>
                ) : null}
            </>
        );
    }

    return (
        <>
            {/* biome-ignore lint/a11y/useSemanticElements: SOT tag chip is a span; keyboard support is added without changing the element. */}
            <span
                className={className}
                data-tag-id={tag.id}
                data-sot-tag-color={tag.color}
                data-sot-tag-icon={tag.icon}
                data-tagm-trigger={trigger ? "1" : undefined}
                data-sot-control={trigger ? "recording-tag-manager" : undefined}
                data-sot-state={trigger ? state : undefined}
                onClick={onClick}
                onKeyDown={handleKeyDown}
                role="button"
                aria-expanded={trigger ? state === "open" : undefined}
                tabIndex={0}
            >
                <RecordingTagIconGlyph icon={tag.icon} />
                {tag.name}
            </span>
            {count > 1 ? (
                // biome-ignore lint/a11y/useSemanticElements: SOT tag overflow chip is a span; keyboard support is added without changing the element.
                <span
                    className={trigger ? "utag-plus is-trigger" : "utag-plus"}
                    data-tagm-trigger={trigger ? "1" : undefined}
                    onClick={onClick}
                    onKeyDown={handleKeyDown}
                    role="button"
                    aria-expanded={trigger ? state === "open" : undefined}
                    tabIndex={0}
                >
                    +{count - 1}
                </span>
            ) : null}
        </>
    );
}

export function SotPlayerStatusBadge({
    className = "b ok _is-3",
    dotClassName = "dot",
    label = "已更新",
}: {
    className?: string;
    dotClassName?: string;
    label?: string;
}) {
    return (
        <span className={className}>
            <span className={dotClassName} />
            {label}
        </span>
    );
}

export function SotPlayerBackIcon() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M19 20 9 12l10-8z" />
            <path d="M5 19V5" />
        </svg>
    );
}

export function SotPlayerForwardIcon() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="m5 4 10 8-10 8z" />
            <path d="M19 5v14" />
        </svg>
    );
}

export function SotPlayerPlayIcon() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
    );
}

export function SotPlayerPauseIcon() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <rect x="6" y="4" width="4" height="16" />
            <rect x="14" y="4" width="4" height="16" />
        </svg>
    );
}

export function sotPlayerVolumeLevel(volume: number) {
    return volume === 0
        ? "mute"
        : volume < 35
          ? "low"
          : volume < 70
            ? "mid"
            : "high";
}

export function SotPlayerVolumeIcon({
    className,
    volume,
}: {
    className?: string;
    volume: number;
}) {
    const level = sotPlayerVolumeLevel(volume);

    return (
        <svg
            className={className}
            viewBox="0 0 24 24"
            aria-hidden="true"
            focusable="false"
        >
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            {level === "mute" ? (
                <>
                    <line x1="22" y1="9" x2="16" y2="15" />
                    <line x1="16" y1="9" x2="22" y2="15" />
                </>
            ) : null}
            {level === "low" || level === "mid" || level === "high" ? (
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            ) : null}
            {level === "high" ? (
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            ) : null}
        </svg>
    );
}

export function SotPlayerNoAudioIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
        >
            <path d="M11 5 6 9H2v6h4l5 4V5z" />
            <line x1="23" y1="9" x2="17" y2="15" />
            <line x1="17" y1="9" x2="23" y2="15" />
        </svg>
    );
}
