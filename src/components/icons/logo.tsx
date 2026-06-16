import type * as React from "react";

export function Logo(props: React.ComponentProps<"svg">) {
    return (
        <svg viewBox="0 0 64 64" aria-hidden="true" {...props}>
            <rect width="64" height="64" rx="16" fill="currentColor" />
            <path
                d="M32 12a7 7 0 0 0-7 7v18a7 7 0 0 0 14 0V19a7 7 0 0 0-7-7Z"
                fill="var(--bg-elevated)"
            />
            <path
                d="M47 29v7a15 15 0 0 1-30 0v-7M32 51v-8"
                fill="none"
                stroke="var(--bg-elevated)"
                strokeLinecap="round"
                strokeWidth="5"
            />
        </svg>
    );
}
