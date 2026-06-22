"use client";

import { Check, RefreshCw, X } from "lucide-react";
import type { SVGProps } from "react";
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
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";

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

function AiRenameUnavailableIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
            <circle cx="12" cy="12" r="10" />
            <path d="M4.93 4.93l14.14 14.14" />
        </svg>
    );
}

function AiRenameErrorIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
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
    const ErrorIcon =
        state === "unavailable" ? AiRenameUnavailableIcon : AiRenameErrorIcon;

    return (
        <Card
            hasNoPadding
            variant="aiRenamePreview"
            className={className}
            data-open="true"
            data-sot-panel="ai-rename-preview"
            data-sot-state={state}
            role="dialog"
            aria-label={title}
        >
            <CardHeader
                variant="aiRenamePreview"
                data-sot-part="head"
            >
                <div data-slot="card-head-copy" data-sot-part="head-copy">
                    <CardTitle
                        variant="aiRenamePreview"
                        data-sot-part="eyebrow"
                    >
                        {title}
                    </CardTitle>
                    <CardDescription
                        variant="aiRenamePreview"
                        data-sot-part="subtitle"
                    >
                        {subtitle ?? ""}
                    </CardDescription>
                </div>
                {onCancel ? (
                    <CardAction
                        variant="aiRenamePreview"
                        data-sot-part="head-action"
                    >
                        <Button
                            type="button"
                            variant="aiRenamePreviewClose"
                            size="aiRenamePreviewClose"
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
                variant="aiRenamePreview"
                data-sot-part="body"
            >
                {state === "loading" ? (
                    <div
                        data-slot="card-state"
                        data-sot-part="state"
                        data-sot-state="loading"
                    >
                        <Spinner
                            placement="centeredBlock"
                            data-sot-part="loading-spinner"
                            aria-hidden="true"
                        />
                        <p
                            data-slot="card-message"
                            data-sot-part="message"
                        >
                            {message ?? title}
                        </p>
                    </div>
                ) : isErrorState ? (
                    <Alert
                        variant={
                            state === "error"
                                ? "aiRenamePreviewError"
                                : "aiRenamePreviewUnavailable"
                        }
                        density="aiRenamePreview"
                        layout="aiRenamePreview"
                        data-sot-part="state"
                        data-sot-state={state}
                    >
                        <span
                            data-slot="alert-icon"
                            data-sot-part="error-icon"
                            aria-hidden="true"
                        >
                            <ErrorIcon aria-hidden="true" />
                        </span>
                        <AlertTitle className="sr-only">{title}</AlertTitle>
                        <AlertDescription
                            density="aiRenamePreview"
                            data-sot-part="state-description"
                        >
                            <p
                                data-slot="alert-message"
                                data-sot-part="message"
                            >
                                {message ?? title}
                            </p>
                            {hint ? (
                                <p
                                    data-slot="alert-hint"
                                    data-sot-part="hint"
                                >
                                    {hint}
                                </p>
                            ) : null}
                        </AlertDescription>
                    </Alert>
                ) : (
                    <div
                        data-slot="card-state"
                        data-sot-part="state"
                        data-sot-state={state}
                    >
                        <div
                            data-slot="card-state-label"
                            data-sot-part="label"
                        >
                            {stateLabel}
                        </div>
                        {state === "review" ? (
                            <div
                                data-slot="card-review-row"
                                data-sot-part="review-row"
                            >
                                <div
                                    data-slot="card-review-line"
                                    data-sot-part="review-line"
                                >
                                    <Badge
                                        variant="aiRenamePreviewOldTag"
                                        data-sot-part="review-tag"
                                        data-sot-review-field="old"
                                    >
                                        原标题
                                    </Badge>
                                    <span
                                        data-slot="card-review-value"
                                        data-review-tone="old"
                                        data-sot-part="review-old"
                                        data-sot-review-value="old"
                                    >
                                        {reviewOldTitle}
                                    </span>
                                </div>
                                <div
                                    data-slot="card-review-line"
                                    data-sot-part="review-line"
                                >
                                    <Badge
                                        variant="aiRenamePreviewNewTag"
                                        data-sot-part="review-tag"
                                        data-sot-review-field="new"
                                    >
                                        新标题
                                    </Badge>
                                    <span
                                        data-slot="card-review-value"
                                        data-review-tone="new"
                                        data-sot-part="review-new"
                                        data-sot-review-value="new"
                                    >
                                        {reviewNewTitle}
                                    </span>
                                </div>
                            </div>
                        ) : filename ? (
                            <div
                                data-slot="card-preview-title"
                                data-sot-part="title"
                            >
                                {filename}
                            </div>
                        ) : null}
                        {message ? (
                            <p
                                data-slot="card-hint"
                                data-sot-part="hint"
                            >
                                {message}
                            </p>
                        ) : null}
                    </div>
                )}
            </CardContent>

            {showRegenerate || showCancel || showApply ? (
                <>
                    <Separator className="mx-4" />
                    <CardFooter
                        variant="aiRenamePreview"
                        data-sot-part="actions"
                    >
                        {showRegenerate ? (
                            <Button
                                type="button"
                                variant="aiRenamePreviewAction"
                                size="aiRenamePreviewAction"
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
                                data-sot-state={
                                    isRegenerating ? "loading" : state
                                }
                            >
                                <RefreshCw
                                    data-icon="inline-start"
                                    aria-hidden="true"
                                />
                                {regenerateLabel}
                            </Button>
                        ) : null}
                        <span
                            className="flex-1"
                            data-sot-part="actions-spacer"
                        />
                        {showCancel ? (
                            <Button
                                type="button"
                                variant="aiRenamePreviewAction"
                                size="aiRenamePreviewAction"
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
                                variant="aiRenamePreviewPrimaryAction"
                                size="aiRenamePreviewAction"
                                onClick={onApply}
                                disabled={isBusy || !canAct}
                                aria-disabled={
                                    isBusy || !canAct ? "true" : "false"
                                }
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
                </>
            ) : null}
        </Card>
    );
}
