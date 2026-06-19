"use client";

import {
    AlertTriangle,
    Ban,
    Check,
    LoaderCircle,
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
            className={cn("w-[min(360px,calc(100vw-32px))] gap-0", className)}
            data-open="true"
            data-sot-panel="ai-rename-preview"
            data-sot-state={state}
            role="dialog"
            aria-label={title}
        >
            <CardHeader
                className="gap-2.5 px-3.5 pt-3 pb-2"
                data-sot-part="head"
            >
                <div className="min-w-0" data-sot-part="head-copy">
                    <CardTitle
                        className="whitespace-normal break-words text-pretty"
                        data-sot-part="eyebrow"
                    >
                        {title}
                    </CardTitle>
                    <CardDescription
                        className="whitespace-normal break-words text-pretty"
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
                            className="shrink-0"
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
                className="flex min-h-20 flex-col px-3.5 py-3.5"
                data-sot-part="body"
            >
                {state === "loading" ? (
                    <div
                        className="flex flex-col items-stretch gap-2"
                        data-sot-part="state"
                        data-sot-state="loading"
                    >
                        <LoaderCircle
                            className="size-4 animate-spin self-center"
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
                        className="min-w-0"
                        data-sot-part="state"
                        data-sot-state={state}
                    >
                        <ErrorIcon
                            data-sot-part="error-icon"
                            aria-hidden="true"
                        />
                        <AlertTitle className="sr-only">{title}</AlertTitle>
                        <AlertDescription
                            className="min-w-0 gap-2"
                            data-sot-part="state-description"
                        >
                            <p
                                className="m-0 whitespace-normal break-words text-pretty"
                                data-sot-part="message"
                            >
                                {message ?? title}
                            </p>
                            {hint ? (
                                <p
                                    className="m-0 whitespace-normal break-words text-pretty"
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
                        <div data-sot-part="label">{stateLabel}</div>
                        {state === "review" ? (
                            <div
                                className="flex flex-col gap-1.5"
                                data-sot-part="review-row"
                            >
                                <div
                                    className="flex min-w-0 items-baseline gap-2"
                                    data-sot-part="review-line"
                                >
                                    <Badge
                                        variant="outline"
                                        className="shrink-0"
                                        data-sot-part="review-tag"
                                        data-sot-review-field="old"
                                    >
                                        原标题
                                    </Badge>
                                    <span
                                        className="min-w-0 break-words"
                                        data-sot-part="review-old"
                                        data-sot-review-value="old"
                                    >
                                        {reviewOldTitle}
                                    </span>
                                </div>
                                <div
                                    className="flex min-w-0 items-baseline gap-2"
                                    data-sot-part="review-line"
                                >
                                    <Badge
                                        variant="outline"
                                        className="shrink-0"
                                        data-sot-part="review-tag"
                                        data-sot-review-field="new"
                                    >
                                        新标题
                                    </Badge>
                                    <span
                                        className="min-w-0 break-words"
                                        data-sot-part="review-new"
                                        data-sot-review-value="new"
                                    >
                                        {reviewNewTitle}
                                    </span>
                                </div>
                            </div>
                        ) : filename ? (
                            <div
                                className="min-w-0 whitespace-normal break-words text-pretty"
                                data-sot-part="title"
                            >
                                {filename}
                            </div>
                        ) : null}
                        {message ? (
                            <p
                                className="m-0 whitespace-normal break-words text-pretty"
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
                    className="flex items-center gap-1.5 px-3.5 py-2"
                    data-sot-part="actions"
                >
                    {showRegenerate ? (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="shrink-0"
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
                            className="shrink-0"
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
                            className="shrink-0"
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
