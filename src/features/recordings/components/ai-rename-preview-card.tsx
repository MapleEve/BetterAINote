"use client";

import { Button } from "@/components/ui/button";

interface AiRenamePreviewCardProps {
    title: string;
    bodyLabel?: string;
    closeLabel?: string;
    filename?: string | null;
    hint?: string | null;
    originalFilename?: string | null;
    applyLabel?: string;
    cancelLabel?: string;
    isApplying: boolean;
    isRegenerating: boolean;
    message?: string | null;
    onApply?: () => void;
    onCancel?: () => void;
    onRegenerate?: () => void;
    regenerateLabel?: string;
    subtitle?: string;
    state?: "loading" | "preview" | "review" | "error" | "unavailable";
    className?: string;
}

function mergeAiRenameClassName(className?: string) {
    const extraClassName = className
        ?.split(/\s+/)
        .filter(
            (item) => item === "ai-rename-panel" || item.startsWith("airp-"),
        )
        .join(" ");

    return ["ai-rename-panel", extraClassName].filter(Boolean).join(" ");
}

function SotCloseIcon() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
        </svg>
    );
}

function SotRefreshIcon() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
            <path d="M3 21v-5h5" />
        </svg>
    );
}

function SotApplyIcon() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 6 9 17l-5-5" />
        </svg>
    );
}

function SotErrorIcon({ state }: { state: "error" | "unavailable" }) {
    if (state === "unavailable") {
        return (
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <path d="M4.93 4.93l14.14 14.14" />
            </svg>
        );
    }

    return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        </svg>
    );
}

export function AiRenamePreviewCard({
    applyLabel,
    bodyLabel,
    cancelLabel,
    className,
    closeLabel,
    filename,
    hint,
    isApplying,
    isRegenerating,
    message,
    onApply,
    onCancel,
    onRegenerate,
    originalFilename,
    regenerateLabel,
    state = "preview",
    subtitle,
    title,
}: AiRenamePreviewCardProps) {
    const isBusy = isApplying || isRegenerating;
    const canAct = state === "preview" || state === "review";
    const showRegenerate = Boolean(onRegenerate && regenerateLabel);
    const showCancel = Boolean(onCancel && cancelLabel);
    const showApply = Boolean(onApply && applyLabel);
    const isErrorState = state === "error" || state === "unavailable";
    const stateLabel = state === "review" ? "复核确认" : (bodyLabel ?? title);
    const reviewOldTitle = originalFilename?.trim() || "—";
    const reviewNewTitle = filename?.trim() || "—";

    return (
        <div
            className={mergeAiRenameClassName(className)}
            data-open="true"
            data-sot-panel="ai-rename-preview"
            data-sot-state={state}
            role="dialog"
            aria-label={title}
        >
            <header className="airp-head">
                <div className="airp-head-l">
                    <span className="airp-eyebrow">{title}</span>
                    <span className="airp-sub">{subtitle ?? ""}</span>
                </div>
                {onCancel ? (
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="airp-close"
                        onClick={onCancel}
                        disabled={isApplying}
                        aria-label={closeLabel ?? cancelLabel}
                        title={closeLabel ?? cancelLabel}
                        data-sot-control="ai-rename-close"
                        data-sot-state={isApplying ? "busy" : state}
                    >
                        <SotCloseIcon />
                    </Button>
                ) : null}
            </header>

            <div className="airp-body">
                {state === "loading" ? (
                    <div className="airp-state" data-airp-state="loading">
                        <span className="airp-spinner" aria-hidden="true" />
                        <p className="airp-msg">{message ?? title}</p>
                    </div>
                ) : isErrorState ? (
                    <div className="airp-state" data-airp-state={state}>
                        <div className="airp-error-icon" aria-hidden="true">
                            <SotErrorIcon state={state} />
                        </div>
                        <p className="airp-msg">{message ?? title}</p>
                        {hint ? <p className="airp-hint">{hint}</p> : null}
                    </div>
                ) : (
                    <div className="airp-state" data-airp-state={state}>
                        <div className="airp-label">{stateLabel}</div>
                        {state === "review" ? (
                            <div className="airp-review-row">
                                <div className="airp-review-line">
                                    <span className="airp-review-tag">
                                        原标题
                                    </span>
                                    <span
                                        className="airp-review-old"
                                        data-airp-old
                                    >
                                        {reviewOldTitle}
                                    </span>
                                </div>
                                <div className="airp-review-line">
                                    <span className="airp-review-tag is-new">
                                        新标题
                                    </span>
                                    <span
                                        className="airp-review-new"
                                        data-airp-title
                                    >
                                        {reviewNewTitle}
                                    </span>
                                </div>
                            </div>
                        ) : filename ? (
                            <div className="airp-title">{filename}</div>
                        ) : null}
                        {message ? (
                            <p className="airp-hint">{message}</p>
                        ) : null}
                    </div>
                )}
            </div>

            {showRegenerate || showCancel || showApply ? (
                <footer className="airp-actions">
                    {showRegenerate ? (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={onRegenerate}
                            disabled={isBusy || state === "unavailable"}
                            aria-busy={isRegenerating}
                            aria-disabled={
                                isBusy || state === "unavailable"
                                    ? "true"
                                    : "false"
                            }
                            aria-label={regenerateLabel}
                            title={regenerateLabel}
                            data-sot-control="ai-rename-regenerate"
                            data-sot-state={isRegenerating ? "loading" : state}
                        >
                            <SotRefreshIcon />
                            {regenerateLabel}
                        </Button>
                    ) : null}
                    <span className="airp-spacer" />
                    {showCancel ? (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={onCancel}
                            disabled={isApplying}
                            aria-label={cancelLabel}
                            title={cancelLabel}
                            data-sot-control="ai-rename-cancel"
                            data-sot-state={isApplying ? "busy" : state}
                        >
                            {cancelLabel}
                        </Button>
                    ) : null}
                    {showApply ? (
                        <Button
                            type="button"
                            variant="glass"
                            size="sm"
                            onClick={onApply}
                            disabled={isBusy || !canAct}
                            aria-disabled={isBusy || !canAct ? "true" : "false"}
                            aria-busy={isApplying}
                            aria-label={applyLabel}
                            title={applyLabel}
                            data-sot-control="ai-rename-apply"
                            data-sot-state={isApplying ? "loading" : state}
                        >
                            <SotApplyIcon />
                            {applyLabel}
                        </Button>
                    ) : null}
                </footer>
            ) : null}
        </div>
    );
}
