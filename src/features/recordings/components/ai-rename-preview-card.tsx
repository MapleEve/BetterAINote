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
            className={className}
            data-open="true"
            data-sot-panel="ai-rename-preview"
            data-sot-state={state}
            role="dialog"
            aria-label={title}
        >
            <CardHeader data-sot-part="head">
                <div data-sot-part="head-copy">
                    <CardTitle data-sot-part="eyebrow">{title}</CardTitle>
                    <CardDescription data-sot-part="subtitle">
                        {subtitle ?? ""}
                    </CardDescription>
                </div>
                {onCancel ? (
                    <CardAction data-sot-part="head-action">
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
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

            <CardContent data-sot-part="body">
                {state === "loading" ? (
                    <div data-sot-part="state" data-sot-state="loading">
                        <LoaderCircle
                            data-sot-part="loading-spinner"
                            aria-hidden="true"
                        />
                        <p data-sot-part="message">{message ?? title}</p>
                    </div>
                ) : isErrorState ? (
                    <Alert
                        variant={state === "error" ? "destructive" : "default"}
                        data-sot-part="state"
                        data-sot-state={state}
                    >
                        <span data-sot-part="error-icon" aria-hidden="true">
                            <ErrorIcon />
                        </span>
                        <AlertTitle className="sr-only">{title}</AlertTitle>
                        <AlertDescription data-sot-part="state-description">
                            <p data-sot-part="message">{message ?? title}</p>
                            {hint ? <p data-sot-part="hint">{hint}</p> : null}
                        </AlertDescription>
                    </Alert>
                ) : (
                    <div data-sot-part="state" data-sot-state={state}>
                        <div data-sot-part="label">{stateLabel}</div>
                        {state === "review" ? (
                            <div data-sot-part="review-row">
                                <div data-sot-part="review-line">
                                    <Badge
                                        variant="outline"
                                        data-sot-part="review-tag"
                                        data-sot-review-field="old"
                                    >
                                        原标题
                                    </Badge>
                                    <span
                                        data-sot-part="review-old"
                                        data-sot-review-value="old"
                                    >
                                        {reviewOldTitle}
                                    </span>
                                </div>
                                <div data-sot-part="review-line">
                                    <Badge
                                        variant="outline"
                                        data-sot-part="review-tag"
                                        data-sot-review-field="new"
                                    >
                                        新标题
                                    </Badge>
                                    <span
                                        data-sot-part="review-new"
                                        data-sot-review-value="new"
                                    >
                                        {reviewNewTitle}
                                    </span>
                                </div>
                            </div>
                        ) : filename ? (
                            <div data-sot-part="title">{filename}</div>
                        ) : null}
                        {message ? <p data-sot-part="hint">{message}</p> : null}
                    </div>
                )}
            </CardContent>

            {showRegenerate || showCancel || showApply ? (
                <CardFooter data-sot-part="actions">
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
                            <RefreshCw
                                data-icon="inline-start"
                                aria-hidden="true"
                            />
                            {regenerateLabel}
                        </Button>
                    ) : null}
                    <span data-sot-part="actions-spacer" />
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
