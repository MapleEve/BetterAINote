"use client";

import {
    AlertTriangle,
    Ban,
    Check,
    RefreshCw,
    X,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

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
    const ErrorIcon = state === "unavailable" ? Ban : AlertTriangle;

    return (
        <Card
            hasNoPadding
            className={cn(
                "w-[min(360px,calc(100vw-32px))] gap-0 !rounded-[var(--radius-lg)] !border-[var(--glass-border)] !bg-[rgb(23_25_27)] !font-sans !text-[var(--fg-primary)] ![box-shadow:0_18px_44px_rgb(0_0_0_/_0.4)]",
                className,
            )}
            data-open="true"
            data-sot-panel="ai-rename-preview"
            data-sot-state={state}
            role="dialog"
            aria-label={title}
        >
            <CardHeader
                className="!grid-cols-[1fr_auto] !items-start !gap-x-[10px] !gap-y-[2px] !border-b !border-[var(--glass-border-soft)] !px-[14px] !pt-[12px] !pb-[8px]"
                data-sot-part="head"
            >
                <div className="min-w-0" data-sot-part="head-copy">
                    <CardTitle
                        className="whitespace-normal break-words text-pretty !font-sans !text-[11px] !font-semibold !leading-[normal] !tracking-[0.02em] !text-[var(--fg-secondary)]"
                        data-sot-part="eyebrow"
                    >
                        {title}
                    </CardTitle>
                    <CardDescription
                        className="whitespace-normal break-words text-pretty !font-sans !text-[11px] !font-medium !leading-[normal] !text-[var(--fg-tertiary)]"
                        data-sot-part="subtitle"
                    >
                        {subtitle ?? ""}
                    </CardDescription>
                </div>
                {onCancel ? (
                    <CardAction
                        className="shrink-0"
                        data-sot-part="head-action"
                    >
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="!size-[24px] shrink-0 !rounded-[7px] !bg-transparent !p-0 !text-[var(--fg-tertiary)] !shadow-none hover:!bg-[var(--bg-recessed)] hover:!text-[var(--fg-primary)] [&_svg]:!size-[11px]"
                            onClick={onCancel}
                            disabled={isApplying}
                            aria-label={closeLabel ?? cancelLabel}
                            title={closeLabel ?? cancelLabel}
                            data-sot-control="ai-rename-close"
                            data-sot-state={isApplying ? "busy" : state}
                        >
                            <X data-icon="inline-start" aria-hidden="true" />
                        </Button>
                    </CardAction>
                ) : null}
            </CardHeader>

            <CardContent
                className="flex !min-h-[80px] flex-col !px-[14px] !py-[14px]"
                data-sot-part="body"
            >
                {state === "loading" ? (
                    <div
                        className="flex flex-col items-stretch gap-2"
                        data-sot-part="state"
                        data-sot-state="loading"
                    >
                        <span
                            className="mx-auto mb-[6px] inline-block !size-[16px] rounded-full border-2 border-[rgb(92_168_198_/_0.36)] border-t-[var(--accent)]"
                            data-sot-part="loading-spinner"
                            aria-hidden="true"
                        />
                        <p
                            className="m-0 whitespace-normal break-words text-pretty"
                            data-sot-part="message"
                        >
                            {message ?? title}
                        </p>
                    </div>
                ) : isErrorState ? (
                    <Alert
                        variant={state === "error" ? "destructive" : "default"}
                        className={cn(
                            "!grid !min-w-0 !grid-cols-1 !justify-items-center !gap-[8px] !border-0 !bg-transparent !px-[4px] !py-[3px] !text-center !shadow-none",
                            state === "unavailable" && "!py-[11px]",
                        )}
                        data-sot-part="state"
                        data-sot-state={state}
                    >
                        <span
                            className={cn(
                                "!m-0 inline-flex !size-[28px] items-center justify-center rounded-full !p-[7px]",
                                state === "unavailable"
                                    ? "!bg-[rgb(184_130_27_/_0.14)] !text-[var(--signal-warning)]"
                                    : "!bg-[rgb(210_65_53_/_0.14)] !text-[var(--signal-danger)]",
                            )}
                            data-sot-part="error-icon"
                            aria-hidden="true"
                        >
                            <ErrorIcon aria-hidden="true" />
                        </span>
                        <AlertTitle className="sr-only">{title}</AlertTitle>
                        <AlertDescription
                            className="!col-start-1 grid min-w-0 !justify-items-center gap-[8px] !text-center"
                            data-sot-part="state-description"
                        >
                            <p
                                className="m-0 whitespace-normal break-words text-pretty !font-sans !text-[12.5px] !font-medium !leading-[1.5] !text-[var(--fg-secondary)]"
                                data-sot-part="message"
                            >
                                {message ?? title}
                            </p>
                            {hint ? (
                                <p
                                    className="m-0 whitespace-normal break-words text-pretty !font-sans !text-[11.5px] !font-medium !leading-[1.5] !text-[var(--fg-tertiary)]"
                                    data-sot-part="hint"
                                >
                                    {hint}
                                </p>
                            ) : null}
                        </AlertDescription>
                    </Alert>
                ) : (
                    <div
                        className="flex flex-col items-stretch gap-2"
                        data-sot-part="state"
                        data-sot-state={state}
                    >
                        <div
                            className="!font-mono !text-[10.5px] !font-semibold !leading-none !tracking-[0.08em] !text-[var(--fg-tertiary)] uppercase"
                            data-sot-part="label"
                        >
                            {stateLabel}
                        </div>
                        {state === "review" ? (
                            <div
                                className="my-[6px] flex flex-col gap-[6px]"
                                data-sot-part="review-row"
                            >
                                <div
                                    className="flex min-w-0 items-baseline gap-[8px] rounded-[8px] border border-[var(--line-hairline)] bg-[var(--bg-recessed)] px-[10px] py-[8px]"
                                    data-sot-part="review-line"
                                >
                                    <Badge
                                        variant="outline"
                                        className="shrink-0 !min-w-[56px] !border-0 !bg-transparent !p-0 !font-sans !text-[10.5px] !font-semibold !leading-[normal] !tracking-[0.04em] !text-[var(--fg-tertiary)] uppercase !shadow-none"
                                        data-sot-part="review-tag"
                                        data-sot-review-field="old"
                                    >
                                        原标题
                                    </Badge>
                                    <span
                                        className="min-w-0 break-words !font-sans !text-[13px] !font-semibold !leading-[1.4] !text-[var(--fg-secondary)] line-through decoration-[var(--fg-tertiary)]/50"
                                        data-sot-part="review-old"
                                        data-sot-review-value="old"
                                    >
                                        {reviewOldTitle}
                                    </span>
                                </div>
                                <div
                                    className="flex min-w-0 items-baseline gap-[8px] rounded-[8px] border border-[var(--line-hairline)] bg-[var(--bg-recessed)] px-[10px] py-[8px]"
                                    data-sot-part="review-line"
                                >
                                    <Badge
                                        variant="ghost"
                                        className="shrink-0 !min-w-[56px] !border-0 !bg-transparent !p-0 !font-sans !text-[10.5px] !font-semibold !leading-[normal] !tracking-[0.04em] !text-[var(--accent)] uppercase !shadow-none"
                                        data-sot-part="review-tag"
                                        data-sot-review-field="new"
                                    >
                                        新标题
                                    </Badge>
                                    <span
                                        className="min-w-0 break-words !font-sans !text-[13px] !font-semibold !leading-[1.4] !text-[var(--fg-primary)]"
                                        data-sot-part="review-new"
                                        data-sot-review-value="new"
                                    >
                                        {reviewNewTitle}
                                    </span>
                                </div>
                            </div>
                        ) : filename ? (
                            <div
                                className="min-w-0 whitespace-normal break-words text-pretty rounded-[8px] border border-[var(--line-hairline)] bg-[var(--bg-recessed)] px-[10px] py-[8px] !font-display !text-[14.5px] !font-semibold !leading-[1.4] !tracking-[-0.012em] !text-[var(--fg-primary)]"
                                data-sot-part="title"
                            >
                                {filename}
                            </div>
                        ) : null}
                        {message ? (
                            <p
                                className="m-0 whitespace-normal break-words text-pretty !font-sans !text-[11.5px] !font-medium !leading-[1.5] !text-[var(--fg-tertiary)]"
                                data-sot-part="hint"
                            >
                                {message}
                            </p>
                        ) : null}
                    </div>
                )}
            </CardContent>

            {showRegenerate || showCancel || showApply ? (
                <CardFooter
                    className="flex items-center !gap-[6px] !border-t !border-[var(--glass-border-soft)] !px-[14px] !py-[10px] !bg-[rgb(30_32_34)]"
                    data-sot-part="actions"
                >
                    {showRegenerate ? (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="!h-[26px] shrink-0 !gap-[7px] !rounded-[7px] !border-transparent !bg-transparent !px-[10px] !text-[12px] !font-semibold !leading-[normal] !text-[var(--fg-secondary)] !shadow-none hover:!bg-[var(--bg-recessed)] hover:!text-[var(--fg-primary)] [&_svg]:!size-[11px]"
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
                            <RefreshCw
                                data-icon="inline-start"
                                aria-hidden="true"
                            />
                            {regenerateLabel}
                        </Button>
                    ) : null}
                    <span className="flex-1" data-sot-part="actions-spacer" />
                    {showCancel ? (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="!h-[26px] shrink-0 !gap-[7px] !rounded-[7px] !border-transparent !bg-transparent !px-[10px] !text-[12px] !font-semibold !leading-[normal] !text-[var(--fg-secondary)] !shadow-none hover:!bg-[var(--bg-recessed)] hover:!text-[var(--fg-primary)]"
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
                            variant="outline"
                            size="sm"
                            className="!h-[26px] shrink-0 !gap-[7px] !rounded-[7px] !border-[var(--line-hairline)] !bg-[var(--glass-tint-base)] !px-[10px] !text-[12px] !font-semibold !leading-[normal] !text-[var(--fg-primary)] !shadow-xs [&_svg]:!size-[11px]"
                            onClick={onApply}
                            disabled={isBusy || !canAct}
                            aria-disabled={isBusy || !canAct ? "true" : "false"}
                            aria-busy={isApplying}
                            aria-label={applyLabel}
                            title={applyLabel}
                            data-sot-control="ai-rename-apply"
                            data-sot-state={isApplying ? "loading" : state}
                        >
                            <Check
                                data-icon="inline-start"
                                aria-hidden="true"
                            />
                            {applyLabel}
                        </Button>
                    ) : null}
                </CardFooter>
            ) : null}
        </Card>
    );
}
