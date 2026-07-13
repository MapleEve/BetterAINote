"use client";

import { Check, X } from "lucide-react";
import {
    type ComponentProps,
    Fragment,
    type ReactNode,
    useMemo,
    useState,
} from "react";
import { toast } from "sonner";
import { useLanguage } from "@/components/language-provider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    CardAction,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyTitle,
} from "@/components/ui/empty";
import {
    Field,
    FieldGroup,
    FieldLabel,
    FieldLegend,
    FieldSet,
} from "@/components/ui/field";
import {
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
    InputGroupInput,
} from "@/components/ui/input-group";
import {
    Popover,
    PopoverAnchor,
    PopoverContent,
} from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
    MAX_RECORDING_TAG_NAME_LENGTH,
    RECORDING_TAG_COLORS,
    RECORDING_TAG_ICONS,
    type RecordingTag,
    type RecordingTagColor,
    type RecordingTagIcon,
} from "@/lib/recording-tags";
import { cn } from "@/lib/utils";
import type { Recording } from "@/types/recording";
import {
    RecordingTagIconGlyph,
    recordingTagColorLabel,
    recordingTagSwatchColorClassName,
} from "./recording-tag-visuals";

interface RecordingTagManagerProps {
    recording: Recording;
    availableTags: RecordingTag[];
    onAvailableTagsChange: (tags: RecordingTag[]) => void;
    onRecordingTagsChange: (recordingId: string, tags: RecordingTag[]) => void;
    loadError?: string | null;
    onClose?: () => void;
}

type RecordingTagCreatePayload = Pick<RecordingTag, "color" | "icon" | "name">;
type RecordingTagAssignmentPayload = {
    tagIds: string[];
    tags: RecordingTag[];
};
type RecordingTagRetryAction =
    | {
          payload: RecordingTagAssignmentPayload;
          tag: RecordingTag;
          type: "toggle";
      }
    | { payload: RecordingTagCreatePayload; type: "create" }
    | { tag: RecordingTag; type: "delete" };

async function readJsonResponse(response: Response) {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(
            typeof data?.error === "string" ? data.error : "Request failed",
        );
    }
    return data;
}

const QUICK_RECORDING_TAG_COLORS = RECORDING_TAG_COLORS.filter(
    (item) => item !== "slate",
);

const RECORDING_TAG_MANAGER_ERROR_TEXT = "保存失败 · 请稍后再试";
const RECORDING_TAG_SWATCH_ITEM_CLASS_NAME =
    "tagm-swatch grid size-[18px] min-w-0 place-items-center rounded-[50%] border-2 border-transparent p-0 text-[13.3333px] font-normal text-foreground shadow-none transition-transform duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:scale-110 data-[state=on]:border-foreground";

const RECORDING_TAG_MANAGER_PANEL_CLASS_NAME =
    "tagm-panel max-h-[460px] w-[320px] max-w-[calc(100vw-2rem)] gap-0 overflow-hidden rounded-[12px] border-[var(--card-popover-border)] bg-[var(--card-popover-bg)] p-0 text-popover-foreground shadow-[var(--card-popover-shadow)] backdrop-blur-none max-md:w-[calc(100vw-24px)] max-md:max-w-none";
const RECORDING_TAG_MANAGER_HEADER_CLASS_NAME =
    "tagm-head flex flex-row items-center justify-between gap-[normal] [border-bottom:1px_solid_var(--card-popover-divider)] px-[12px] py-[10px]";
const RECORDING_TAG_MANAGER_TITLE_CLASS_NAME =
    "tagm-title text-xs font-semibold leading-tight text-foreground";
const RECORDING_TAG_MANAGER_FOOTER_CLASS_NAME =
    "min-h-[47px] gap-1.5 border-t border-[var(--card-popover-divider)] bg-[var(--card-popover-footer-bg)] px-3.5 py-2.5 !pt-2.5";
const RECORDING_TAG_MANAGER_TOGGLE_NOTE_CLASS_NAME =
    "tagm-note m-0 pb-3.5 text-[11px] leading-[1.45] text-[var(--fg-primary)]";
const RECORDING_TAG_MANAGER_CONTENT_CLASS_NAME =
    "flex flex-col gap-[14px] overflow-auto px-3.5 pb-3.5 pt-3";
const RECORDING_TAG_MANAGER_TAG_TOGGLE_CLASS_NAME =
    "tagm-opt relative h-6 justify-normal gap-[5px] rounded-[var(--radius-pill)] border border-[var(--line-hairline)] bg-[var(--bg-recessed)] px-2.5 [font:600_11.5px_var(--font-sans)] text-[var(--fg-secondary)] shadow-none transition-none hover:bg-[var(--bg-elevated)] hover:text-[var(--fg-primary)] has-[>svg]:px-2.5 disabled:opacity-70";
const RECORDING_TAG_MANAGER_SELECTED_BADGE_CLASS_NAME =
    "tagm-sel-chip h-[22px] justify-normal gap-[5px] rounded-[999px] border-[var(--line-hairline)] bg-[var(--bg-recessed)] py-0 pl-2 pr-1 [font:600_11px_var(--font-sans)] text-[var(--fg-primary)]";
const RECORDING_TAG_MANAGER_CHIP_REMOVE_BUTTON_CLASS_NAME =
    "x size-4 shrink-0 rounded-[50%] border-0 bg-transparent p-0 [font:600_11px_var(--font-sans)] text-[var(--fg-tertiary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--fg-primary)]";
const RECORDING_TAG_MANAGER_CHECK_BADGE_CLASS_NAME =
    "tagm-opt-check ml-0.5 size-3.5 inline-grid place-items-center rounded-[50%] border-0 bg-[color-mix(in_srgb,var(--accent)_70%,transparent)] p-0 [font:600_11.5px_var(--font-sans)] text-[var(--accent-on)]";
const RECORDING_TAG_MANAGER_SMALL_GHOST_BUTTON_CLASS_NAME =
    "h-[26px] shrink-0 justify-normal gap-[7px] rounded-[7px] border border-transparent bg-transparent px-2.5 py-0 text-xs ![line-height:normal] font-semibold text-[var(--fg-secondary)] shadow-none hover:bg-[var(--bg-recessed)] hover:text-[var(--fg-primary)]";
const RECORDING_TAG_MANAGER_SMALL_PRIMARY_BUTTON_CLASS_NAME =
    "h-[26px] shrink-0 justify-normal gap-[7px] rounded-[7px] border border-[var(--button-primary-border)] [background-color:transparent]! bg-[image:var(--button-primary-bg)] px-2.5 py-0 text-xs ![line-height:normal] font-semibold text-[var(--button-primary-fg)] shadow-[var(--button-primary-shadow)] hover:bg-[image:var(--button-primary-hover-bg)]";
const RECORDING_TAG_MANAGER_SMALL_DESTRUCTIVE_BUTTON_CLASS_NAME =
    "h-[26px] shrink-0 justify-normal gap-[7px] rounded-[7px] border border-[var(--button-destructive-border)] [background-color:transparent]! bg-[image:var(--button-destructive-bg)] px-2.5 py-0 text-xs ![line-height:normal] font-semibold text-[var(--button-destructive-fg)] shadow-[var(--button-destructive-shadow)] hover:bg-[image:var(--button-destructive-hover-bg)]";
const RECORDING_TAG_MANAGER_CLOSE_BUTTON_CLASS_NAME =
    "tagm-close shrink-0 text-muted-foreground hover:bg-muted hover:text-foreground";
const RECORDING_TAG_MANAGER_PICKER_FRAME_CLASS_NAME =
    "tagm-picker flex flex-col gap-2.5 rounded-md border border-border bg-muted px-3 py-2.5";
const RECORDING_TAG_MANAGER_PICKER_LABEL_CLASS_NAME =
    "tagm-picker-label m-0 p-0 font-mono text-[11px] font-semibold leading-none uppercase tracking-wide text-muted-foreground";
const RECORDING_TAG_MANAGER_ICON_OPTION_CLASS_NAME =
    "tg-pick ![width:28px] ![height:28px] ![min-width:28px] shrink-0 ![border-radius:8px] border-border bg-background p-0 text-muted-foreground shadow-none hover:border-border hover:bg-muted hover:text-foreground data-[state=on]:border-primary/50 data-[state=on]:bg-primary/15 data-[state=on]:text-primary";

type RecordingTagManagerContentVariant =
    | "compact"
    | "create"
    | "default"
    | "delete"
    | "empty"
    | "saving"
    | "tight";
type RecordingTagManagerBadgeAppearance = "pill" | "checkDot";

function recordingTagManagerContentClassName(
    contentVariant: RecordingTagManagerContentVariant,
) {
    return cn(
        RECORDING_TAG_MANAGER_CONTENT_CLASS_NAME,
        (contentVariant === "compact" || contentVariant === "default") &&
            "tagm-body",
        (contentVariant === "compact" || contentVariant === "saving") &&
            "min-h-[52px]",
    );
}

function recordingTagManagerBadgeClassName(
    appearance: RecordingTagManagerBadgeAppearance,
) {
    return appearance === "pill"
        ? RECORDING_TAG_MANAGER_SELECTED_BADGE_CLASS_NAME
        : RECORDING_TAG_MANAGER_CHECK_BADGE_CLASS_NAME;
}

function RecordingTagManagerHeader({
    className,
    ...props
}: Omit<ComponentProps<typeof CardHeader>, "variant">) {
    return (
        <CardHeader
            className={cn(RECORDING_TAG_MANAGER_HEADER_CLASS_NAME, className)}
            {...props}
        />
    );
}

function RecordingTagManagerTitle({
    className,
    ...props
}: Omit<ComponentProps<typeof CardTitle>, "variant">) {
    return (
        <CardTitle
            className={cn(RECORDING_TAG_MANAGER_TITLE_CLASS_NAME, className)}
            {...props}
        />
    );
}

function RecordingTagManagerContent({
    className,
    contentVariant,
    ...props
}: Omit<ComponentProps<typeof CardContent>, "variant"> & {
    contentVariant: RecordingTagManagerContentVariant;
}) {
    return (
        <CardContent
            className={cn(
                recordingTagManagerContentClassName(contentVariant),
                className,
            )}
            {...props}
        />
    );
}

function RecordingTagManagerFooter({
    className,
    ...props
}: Omit<ComponentProps<typeof CardFooter>, "variant">) {
    return (
        <CardFooter
            className={cn(RECORDING_TAG_MANAGER_FOOTER_CLASS_NAME, className)}
            {...props}
        />
    );
}

function RecordingTagManagerToggleNote({
    className,
    ...props
}: Omit<ComponentProps<typeof CardDescription>, "variant">) {
    return (
        <CardDescription
            className={cn(
                RECORDING_TAG_MANAGER_TOGGLE_NOTE_CLASS_NAME,
                className,
            )}
            {...props}
        />
    );
}

function RecordingTagManagerBadge({
    appearance,
    className,
    ...props
}: Omit<ComponentProps<typeof Badge>, "variant"> & {
    appearance: RecordingTagManagerBadgeAppearance;
}) {
    return (
        <Badge
            variant={appearance === "pill" ? "secondary" : "default"}
            className={cn(
                recordingTagManagerBadgeClassName(appearance),
                className,
            )}
            {...props}
        />
    );
}

function RecordingTagAlertIcon(props: ComponentProps<"svg">) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
            focusable="false"
            {...props}
        >
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
            <circle cx="12" cy="12" r="10" />
        </svg>
    );
}

function RecordingTagManagerIconGlyph({
    icon,
    ...props
}: ComponentProps<"svg"> & { icon: RecordingTagIcon }) {
    const glyph =
        icon === "grid" ? (
            <path d="M3 3h7v7H3z" />
        ) : icon === "user" ? (
            <circle cx="9" cy="7" r="4" />
        ) : icon === "heart" ? (
            <path d="M19 14c1.49-1.46 3-3.21 3-5.5" />
        ) : icon === "clock" ? (
            <circle cx="12" cy="12" r="10" />
        ) : null;

    if (!glyph) {
        return <RecordingTagIconGlyph icon={icon} {...props} />;
    }

    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
            focusable="false"
            {...props}
        >
            {glyph}
        </svg>
    );
}

function RecordingTagPickerIconGlyph({
    icon,
    ...props
}: ComponentProps<"svg"> & { icon: RecordingTagIcon }) {
    const glyph =
        icon === "grid" ? (
            <>
                <path d="M3 3h7v7H3z" />
                <path d="M14 3h7v7h-7z" />
                <path d="M14 14h7v7h-7z" />
                <path d="M3 14h7v7H3z" />
            </>
        ) : icon === "user" ? (
            <>
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21a8 8 0 0 1 16 0" />
            </>
        ) : icon === "heart" ? (
            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z" />
        ) : icon === "clock" ? (
            <>
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
            </>
        ) : icon === "tag" ? (
            <path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
        ) : icon === "star" ? (
            <polygon points="12 2 15 8.5 22 9.3 17 14.1 18.2 21 12 17.8 5.8 21 7 14.1 2 9.3 9 8.5 12 2" />
        ) : icon === "dialog" ? (
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        ) : icon === "flag" ? (
            <path d="M4 22V4a2 2 0 0 1 2-2h10l-2 4 2 4H6" />
        ) : icon === "book" ? (
            <>
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </>
        ) : icon === "bulb" ? (
            <>
                <path d="M9 18h6" />
                <path d="M10 22h4" />
                <path d="M12 2a7 7 0 0 0-4 12.7c.7.5 1 1.4 1 2.3v1h6v-1c0-.9.3-1.8 1-2.3A7 7 0 0 0 12 2Z" />
            </>
        ) : icon === "file" ? (
            <>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
            </>
        ) : (
            <>
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 1 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 1 1-14 0v-2" />
            </>
        );

    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
            focusable="false"
            {...props}
        >
            {glyph}
        </svg>
    );
}

export function RecordingTagManager({
    recording,
    availableTags,
    loadError,
    onAvailableTagsChange,
    onRecordingTagsChange,
    onClose,
}: RecordingTagManagerProps) {
    const { language } = useLanguage();
    const [name, setName] = useState("");
    const [color, setColor] = useState<RecordingTagColor>("purple");
    const [icon, setIcon] = useState<RecordingTagIcon>("grid");
    const [savingTagId, setSavingTagId] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [deletingTagId, setDeletingTagId] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<RecordingTag | null>(null);
    const [operationError, setOperationError] = useState<string | null>(null);
    const [showToggleState, setShowToggleState] = useState(false);
    const [retryAction, setRetryAction] =
        useState<RecordingTagRetryAction | null>(null);

    const selectedTagIds = useMemo(
        () => new Set(recording.tags.map((tag) => tag.id)),
        [recording.tags],
    );

    const sortedTags = availableTags;
    const tagDetailsById = useMemo(
        () => new Map(availableTags.map((tag) => [tag.id, tag])),
        [availableTags],
    );
    const selectedTags = useMemo(() => {
        const fromCatalog = availableTags.filter((tag) =>
            selectedTagIds.has(tag.id),
        );
        const seenTagIds = new Set(fromCatalog.map((tag) => tag.id));
        return [
            ...fromCatalog,
            ...recording.tags.filter((tag) => !seenTagIds.has(tag.id)),
        ];
    }, [availableTags, recording.tags, selectedTagIds]);
    const visibleError = operationError ?? loadError ?? null;
    const busy = Boolean(savingTagId) || isCreating || Boolean(deletingTagId);
    const canCreate = Boolean(name.trim()) && !isCreating;
    const isCreateMode = Boolean(name.trim()) || isCreating;
    const hasNoTags = sortedTags.length === 0 && recording.tags.length === 0;
    const savingPanelTags = savingTagId
        ? [
              sortedTags.find((tag) => tag.id === savingTagId) ??
                  recording.tags.find((tag) => tag.id === savingTagId),
              ...selectedTags.filter((tag) => tag.id !== savingTagId),
          ].filter((tag): tag is RecordingTag => Boolean(tag))
        : [];
    const errorPanelTags = sortedTags.slice(0, 1);
    const firstSelectedToggleTagId =
        sortedTags.find((tag) => selectedTagIds.has(tag.id))?.id ?? null;
    const shouldShowSavingState =
        Boolean(savingTagId) && !deleteTarget && !isCreateMode;
    const shouldShowErrorState =
        Boolean(visibleError) &&
        !deleteTarget &&
        !isCreateMode &&
        !shouldShowSavingState;
    const shouldShowToggleState =
        showToggleState &&
        !deleteTarget &&
        !isCreateMode &&
        !visibleError &&
        !shouldShowSavingState &&
        sortedTags.length > 0;
    const title = shouldShowToggleState
        ? "为这条录音切换标签"
        : shouldShowErrorState
          ? "管理标签"
          : deleteTarget
            ? `删除标签 · ${deleteTarget.name}`
            : isCreateMode
              ? "新建标签"
              : "管理标签";
    const showCloseButton =
        Boolean(onClose) &&
        !deleteTarget &&
        !visibleError &&
        !isCreating &&
        !savingTagId &&
        !deletingTagId &&
        !shouldShowToggleState;
    const upsertAvailableTag = (tag: RecordingTag) => {
        onAvailableTagsChange([
            tag,
            ...availableTags.filter((item) => item.id !== tag.id),
        ]);
    };

    const updateRecordingTags = async ({
        tagIds,
        tags: nextTags,
    }: RecordingTagAssignmentPayload) => {
        const response = await fetch(`/api/recordings/${recording.id}/tags`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tagIds }),
        });
        const data = await readJsonResponse(response);
        const tags = Array.isArray(data.tags) ? data.tags : nextTags;
        onRecordingTagsChange(recording.id, tags);
        return tags as RecordingTag[];
    };

    const handleToggleTag = async (
        tag: RecordingTag,
        retryPayload?: RecordingTagAssignmentPayload,
    ) => {
        if (busy) {
            return;
        }

        const payload =
            retryPayload ??
            (() => {
                const nextTags = selectedTagIds.has(tag.id)
                    ? recording.tags.filter((item) => item.id !== tag.id)
                    : [...recording.tags, tag];
                return {
                    tagIds: nextTags.map((item) => item.id),
                    tags: nextTags,
                };
            })();

        setSavingTagId(tag.id);
        setOperationError(null);
        setRetryAction(null);
        setShowToggleState(false);
        try {
            await updateRecordingTags(payload);
            setShowToggleState(true);
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : language === "zh-CN"
                      ? "标签保存失败"
                      : "Failed to save tag";
            setOperationError(message);
            setRetryAction({ payload, tag, type: "toggle" });
            setShowToggleState(false);
            toast.error(message);
        } finally {
            setSavingTagId(null);
        }
    };

    const handleCreateTag = async (payload?: RecordingTagCreatePayload) => {
        const createPayload = payload ?? {
            color,
            icon,
            name: name.trim(),
        };
        if (!createPayload.name || isCreating) {
            return;
        }

        setIsCreating(true);
        setOperationError(null);
        setRetryAction(null);
        setShowToggleState(false);
        try {
            const response = await fetch("/api/recording-tags", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(createPayload),
            });
            const data = await readJsonResponse(response);
            const tag = data.tag as RecordingTag;
            upsertAvailableTag(tag);
            const nextTags = [...recording.tags, tag];
            await updateRecordingTags({
                tagIds: nextTags.map((item) => item.id),
                tags: nextTags,
            });
            setName("");
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : language === "zh-CN"
                      ? "标签创建失败"
                      : "Failed to create tag";
            setOperationError(message);
            setRetryAction({ payload: createPayload, type: "create" });
            toast.error(message);
        } finally {
            setIsCreating(false);
        }
    };

    const handleDeleteTag = async (target = deleteTarget) => {
        if (!target || deletingTagId) {
            return;
        }

        setDeletingTagId(target.id);
        setOperationError(null);
        setRetryAction(null);
        setShowToggleState(false);
        try {
            const response = await fetch(`/api/recording-tags/${target.id}`, {
                method: "DELETE",
            });
            await readJsonResponse(response);
            onAvailableTagsChange(
                availableTags.filter((tag) => tag.id !== target.id),
            );
            if (selectedTagIds.has(target.id)) {
                onRecordingTagsChange(
                    recording.id,
                    recording.tags.filter((tag) => tag.id !== target.id),
                );
            }
            setDeleteTarget(null);
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : language === "zh-CN"
                      ? "标签删除失败"
                      : "Failed to delete tag";
            setOperationError(message);
            setRetryAction({ tag: target, type: "delete" });
            toast.error(message);
        } finally {
            setDeletingTagId(null);
        }
    };

    const handleRetry = () => {
        const action = retryAction;
        if (!action) {
            return;
        }

        if (action.type === "toggle") {
            void handleToggleTag(action.tag, action.payload);
            return;
        }

        if (action.type === "create") {
            void handleCreateTag(action.payload);
            return;
        }

        void handleDeleteTag(action.tag);
    };

    const tagNameInputId = "recording-tag-name-input";
    const tagColorPickerLabelId = "recording-tag-color-picker-label";
    const tagIconPickerLabelId = "recording-tag-icon-picker-label";

    const renderErrorAlert = ({
        message = RECORDING_TAG_MANAGER_ERROR_TEXT,
        onRetry = handleRetry,
    }: {
        message?: string;
        onRetry?: () => void;
    }) => (
        <Alert
            density="compact"
            layout="inline"
            variant="statusError"
            className="tagm-error rounded-[var(--radius-sm)] border-[var(--alert-destructive-soft-border)] bg-[var(--alert-destructive-soft-bg)] px-2.5"
        >
            <RecordingTagAlertIcon
                aria-hidden="true"
                className="!size-3.5 shrink-0"
            />
            <AlertDescription
                density="compact"
                className="!contents !text-current"
            >
                <span className="flex-1">
                    {RECORDING_TAG_MANAGER_ERROR_TEXT}
                </span>
                {message === RECORDING_TAG_MANAGER_ERROR_TEXT ? null : (
                    <span className="sr-only">{message}</span>
                )}
                <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    className={
                        RECORDING_TAG_MANAGER_SMALL_GHOST_BUTTON_CLASS_NAME
                    }
                    onClick={onRetry}
                >
                    重试
                </Button>
            </AlertDescription>
        </Alert>
    );

    const renderTagToggle = ({
        interactive,
        saving = false,
        selected,
        showCheck = false,
        showIcon = true,
        tag,
    }: {
        interactive: boolean;
        saving?: boolean;
        selected: boolean;
        showCheck?: boolean;
        showIcon?: boolean;
        tag: RecordingTag;
    }) => (
        <Button
            key={tag.id}
            type="button"
            variant="outline"
            size="xs"
            className={cn(
                RECORDING_TAG_MANAGER_TAG_TOGGLE_CLASS_NAME,
                "relative whitespace-nowrap",
                (saving || !interactive) &&
                    "pointer-events-none disabled:opacity-100",
                saving && "before:hidden",
            )}
            onClick={interactive ? () => void handleToggleTag(tag) : undefined}
            disabled={saving || !interactive || busy}
            aria-pressed={selected}
            aria-disabled={saving || !interactive || busy ? "true" : undefined}
            aria-busy={saving ? "true" : undefined}
            data-busy={saving ? "true" : "false"}
        >
            {saving ? (
                <Spinner
                    size="xs"
                    placement="inlineStart"
                    className="btn-spinner"
                    data-icon="inline-start"
                    aria-hidden="true"
                />
            ) : showIcon ? (
                <RecordingTagManagerIconGlyph
                    data-icon="inline-start"
                    icon={tag.icon}
                    className="size-[11px]"
                />
            ) : null}
            {tag.name}
            {showCheck ? (
                <RecordingTagManagerBadge
                    appearance="checkDot"
                    aria-hidden="true"
                >
                    <Check
                        data-icon="inline-end"
                        className="size-[9px] [stroke-linecap:butt] [stroke-linejoin:miter]"
                        strokeWidth={3}
                        aria-hidden="true"
                    />
                </RecordingTagManagerBadge>
            ) : null}
        </Button>
    );

    const handleNameChange = (value: string) => {
        setShowToggleState(false);
        setName(
            Array.from(value).slice(0, MAX_RECORDING_TAG_NAME_LENGTH).join(""),
        );
    };

    const renderNameField = ({
        disabled = false,
        enableEnterCreate = false,
        placeholder,
        withInlineAction = false,
    }: {
        disabled?: boolean;
        enableEnterCreate?: boolean;
        placeholder: string;
        withInlineAction?: boolean;
    }) => (
        <Field data-disabled={disabled || undefined}>
            <FieldLabel htmlFor={tagNameInputId} className="sr-only">
                标签名
            </FieldLabel>
            <InputGroup variant="compact" className="tagm-create-row">
                <InputGroupInput
                    variant="compact"
                    id={tagNameInputId}
                    type="text"
                    className="field-input min-w-0"
                    value={name}
                    maxLength={MAX_RECORDING_TAG_NAME_LENGTH}
                    onChange={(event) => handleNameChange(event.target.value)}
                    onKeyDown={
                        enableEnterCreate
                            ? (event) => {
                                  if (event.key === "Enter" && canCreate) {
                                      void handleCreateTag();
                                  }
                              }
                            : undefined
                    }
                    placeholder={placeholder}
                    disabled={disabled}
                />
                {withInlineAction ? (
                    <InputGroupAddon
                        align="inline-end"
                        className="m-0 shrink-0 p-0"
                    >
                        <InputGroupButton
                            type="button"
                            aria-label="添加"
                            variant="default"
                            size="icon-compact"
                            className={cn(
                                "tagm-add-btn",
                                "shrink-0 border border-primary text-primary disabled:!opacity-100",
                            )}
                            disabled={!canCreate}
                            onClick={() => void handleCreateTag()}
                        >
                            <span aria-hidden="true">+</span>
                        </InputGroupButton>
                    </InputGroupAddon>
                ) : null}
            </InputGroup>
        </Field>
    );

    const renderColorToggleGroup = (
        items: readonly RecordingTagColor[],
        picker: "full" | "quick",
    ) => (
        <ToggleGroup
            type="single"
            value={color}
            onValueChange={(value) => {
                if (value && !isCreating) {
                    setColor(value as RecordingTagColor);
                }
            }}
            disabled={isCreating}
            aria-disabled={isCreating}
            variant="default"
            size="sm"
            className={cn(
                "tagm-swatches ![align-items:normal] flex-wrap rounded-none",
                picker === "quick" ? "gap-1" : "gap-2",
            )}
            spacing={picker === "quick" ? 1 : 2}
            aria-label="颜色"
        >
            {items.map((item) => (
                <ToggleGroupItem
                    key={item}
                    value={item}
                    aria-label={recordingTagColorLabel[item]}
                    className={cn(
                        RECORDING_TAG_SWATCH_ITEM_CLASS_NAME,
                        recordingTagSwatchColorClassName[item],
                        color === item && "is-selected",
                    )}
                />
            ))}
        </ToggleGroup>
    );

    const renderColorPicker = () => (
        <FieldSet
            className={cn(
                RECORDING_TAG_MANAGER_PICKER_FRAME_CLASS_NAME,
                "min-h-[59px]",
            )}
        >
            <FieldLegend
                id={tagColorPickerLabelId}
                variant="label"
                className={RECORDING_TAG_MANAGER_PICKER_LABEL_CLASS_NAME}
            >
                颜色
            </FieldLegend>
            <div>{renderColorToggleGroup(RECORDING_TAG_COLORS, "full")}</div>
        </FieldSet>
    );

    const renderIconPicker = () => (
        <FieldSet
            className={cn(
                RECORDING_TAG_MANAGER_PICKER_FRAME_CLASS_NAME,
                "min-h-[103px]",
            )}
        >
            <FieldLegend
                id={tagIconPickerLabelId}
                variant="label"
                className={RECORDING_TAG_MANAGER_PICKER_LABEL_CLASS_NAME}
            >
                图标
            </FieldLegend>
            <div>
                <ToggleGroup
                    type="single"
                    value={icon}
                    onValueChange={(value) => {
                        if (value && !isCreating) {
                            setIcon(value as RecordingTagIcon);
                        }
                    }}
                    disabled={isCreating}
                    aria-disabled={isCreating}
                    variant="default"
                    size="sm"
                    layout="iconGrid"
                    className="tagm-icon-grid ![align-items:normal] rounded-none"
                    spacing={1.5}
                    aria-label="图标"
                >
                    {RECORDING_TAG_ICONS.map((item) => (
                        <ToggleGroupItem
                            key={item}
                            value={item}
                            aria-label={`选择图标 ${item}`}
                            variant="outline"
                            size="sm"
                            className={cn(
                                RECORDING_TAG_MANAGER_ICON_OPTION_CLASS_NAME,
                                icon === item && "is-selected",
                            )}
                        >
                            <RecordingTagPickerIconGlyph
                                data-icon="inline-start"
                                icon={item}
                            />
                        </ToggleGroupItem>
                    ))}
                </ToggleGroup>
            </div>
        </FieldSet>
    );

    let panelContent: ReactNode;
    let panelAfterBody: ReactNode = null;
    let panelFooter: ReactNode = null;
    const contentVariant: RecordingTagManagerContentVariant =
        hasNoTags && !isCreateMode
            ? "empty"
            : deleteTarget
              ? "delete"
              : isCreateMode
                ? "create"
                : shouldShowSavingState
                  ? "saving"
                  : shouldShowErrorState
                    ? "tight"
                    : shouldShowToggleState
                      ? "compact"
                      : "default";

    if (shouldShowSavingState) {
        panelContent = (
            <div>
                {savingPanelTags.slice(0, 2).map((tag, index, tags) => (
                    <Fragment key={tag.id}>
                        {renderTagToggle({
                            interactive: false,
                            saving: tag.id === savingTagId,
                            selected: selectedTagIds.has(tag.id),
                            showIcon: false,
                            tag,
                        })}
                        {index < tags.length - 1 ? " " : null}
                    </Fragment>
                ))}
            </div>
        );
    } else if (shouldShowErrorState) {
        panelContent = (
            <>
                {renderErrorAlert({ message: visibleError ?? undefined })}
                <div>
                    {errorPanelTags.map((tag, index, tags) => (
                        <Fragment key={tag.id}>
                            {renderTagToggle({
                                interactive: false,
                                selected: false,
                                showIcon: false,
                                tag,
                            })}
                            {index < tags.length - 1 ? " " : null}
                        </Fragment>
                    ))}
                </div>
            </>
        );
    } else if (shouldShowToggleState) {
        panelContent = (
            <div>
                {sortedTags.map((tag, index) => (
                    <Fragment key={tag.id}>
                        {renderTagToggle({
                            interactive: true,
                            selected: selectedTagIds.has(tag.id),
                            showCheck: tag.id === firstSelectedToggleTagId,
                            tag,
                        })}
                        {index < sortedTags.length - 1 ? " " : null}
                    </Fragment>
                ))}
            </div>
        );
        panelAfterBody = (
            <RecordingTagManagerToggleNote>
                aria-pressed=&quot;true&quot; → 标签已应用 ·
                点击再次切换为「未应用」。
            </RecordingTagManagerToggleNote>
        );
    } else if (deleteTarget) {
        panelContent = (
            <>
                <div className="tagm-delete-confirm flex w-full items-center gap-2 rounded-[var(--radius-md)] border border-[var(--alert-destructive-soft-strong-border)] bg-[var(--alert-destructive-soft-strong-bg)] px-3 py-2.5 text-[13px] text-[var(--fg-primary)]">
                    <RecordingTagAlertIcon
                        aria-hidden="true"
                        className="size-3.5 shrink-0"
                    />
                    <div className="tagm-delete-msg flex-1 text-[var(--fg-primary)] [font:inherit]">
                        <strong>{deleteTarget.name}</strong> 将从{" "}
                        {tagDetailsById.get(deleteTarget.id)?.recordingCount ??
                            deleteTarget.recordingCount ??
                            (selectedTagIds.has(deleteTarget.id) ? 1 : 0)}{" "}
                        条录音上移除。标签本身会从所有人的录音侧栏消失，无法撤销。
                    </div>
                </div>
                {visibleError
                    ? renderErrorAlert({
                          message: visibleError,
                      })
                    : null}
            </>
        );
        panelFooter = (
            <>
                <span className="tagm-spacer flex-1" />
                <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    className={
                        RECORDING_TAG_MANAGER_SMALL_GHOST_BUTTON_CLASS_NAME
                    }
                    disabled={Boolean(deletingTagId)}
                    onClick={() => {
                        setDeleteTarget(null);
                        setOperationError(null);
                        setRetryAction(null);
                    }}
                >
                    取消
                </Button>
                <Button
                    type="button"
                    variant="destructive"
                    size="xs"
                    className={
                        RECORDING_TAG_MANAGER_SMALL_DESTRUCTIVE_BUTTON_CLASS_NAME
                    }
                    aria-busy={
                        deletingTagId === deleteTarget.id ? "true" : undefined
                    }
                    disabled={Boolean(deletingTagId)}
                    onClick={() => void handleDeleteTag()}
                >
                    {deletingTagId === deleteTarget.id ? (
                        <Spinner
                            size="xs"
                            className="btn-spinner"
                            data-icon="inline-start"
                            aria-hidden="true"
                        />
                    ) : null}
                    删除标签
                </Button>
            </>
        );
    } else if (isCreateMode) {
        panelContent = (
            <FieldGroup className="gap-[14px]">
                {renderNameField({
                    disabled: isCreating,
                    enableEnterCreate: true,
                    placeholder: "标签名",
                })}
                {visibleError
                    ? renderErrorAlert({
                          message: visibleError,
                      })
                    : null}
                {renderColorPicker()}
                {renderIconPicker()}
            </FieldGroup>
        );
        panelFooter = (
            <>
                <span className="flex-1" />
                <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    className={
                        RECORDING_TAG_MANAGER_SMALL_GHOST_BUTTON_CLASS_NAME
                    }
                    disabled={isCreating}
                    onClick={() => {
                        setName("");
                        setOperationError(null);
                        setRetryAction(null);
                    }}
                >
                    取消
                </Button>
                <Button
                    type="button"
                    variant="default"
                    size="xs"
                    className={
                        RECORDING_TAG_MANAGER_SMALL_PRIMARY_BUTTON_CLASS_NAME
                    }
                    aria-busy={isCreating ? "true" : undefined}
                    disabled={!canCreate}
                    onClick={() => void handleCreateTag()}
                >
                    {isCreating ? (
                        <Spinner
                            size="xs"
                            className="btn-spinner"
                            data-icon="inline-start"
                            aria-hidden="true"
                        />
                    ) : null}
                    创建
                </Button>
            </>
        );
    } else {
        panelContent = (
            <>
                {hasNoTags ? (
                    <Empty variant="popover">
                        <EmptyHeader variant="popover">
                            <EmptyTitle variant="popover">
                                还没有任何标签
                            </EmptyTitle>
                            <EmptyDescription
                                variant="popover"
                                className="leading-[1.5]"
                            >
                                在下方为这条录音创建第一个标签。
                            </EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                ) : (
                    <>
                        <fieldset
                            aria-label={`已选 · ${selectedTags.length}`}
                            className="tagm-sec flex flex-col gap-2"
                        >
                            <div className="tagm-sec-label mb-0">
                                已选 · {selectedTags.length}
                            </div>
                            <div className="tagm-chips flex flex-wrap gap-1">
                                {selectedTags.map((tag) => {
                                    const catalogTag =
                                        tagDetailsById.get(tag.id) ?? tag;

                                    return (
                                        <RecordingTagManagerBadge
                                            key={tag.id}
                                            appearance="pill"
                                            className="min-w-0 max-w-full"
                                        >
                                            <RecordingTagManagerIconGlyph
                                                data-icon="inline-start"
                                                icon={tag.icon}
                                                className="size-[11px]"
                                            />
                                            {tag.name}
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon-xs"
                                                className={
                                                    RECORDING_TAG_MANAGER_CHIP_REMOVE_BUTTON_CLASS_NAME
                                                }
                                                aria-label="移除"
                                                disabled={Boolean(
                                                    deletingTagId,
                                                )}
                                                onClick={() => {
                                                    setOperationError(null);
                                                    setRetryAction(null);
                                                    setShowToggleState(false);
                                                    setDeleteTarget(catalogTag);
                                                }}
                                            >
                                                <X
                                                    data-icon="inline-start"
                                                    aria-hidden="true"
                                                    className="size-[11px]"
                                                />
                                            </Button>
                                        </RecordingTagManagerBadge>
                                    );
                                })}
                            </div>
                        </fieldset>

                        <fieldset
                            aria-label="全部标签"
                            className="tagm-sec flex flex-col gap-2"
                        >
                            <div className="tagm-sec-label mb-0">全部标签</div>
                            <div className="tagm-opts">
                                {sortedTags.map((tag, index) => (
                                    <Fragment key={tag.id}>
                                        {renderTagToggle({
                                            interactive: true,
                                            saving: savingTagId === tag.id,
                                            selected: selectedTagIds.has(
                                                tag.id,
                                            ),
                                            tag,
                                        })}
                                        {index < sortedTags.length - 1
                                            ? " "
                                            : null}
                                    </Fragment>
                                ))}
                            </div>
                        </fieldset>
                    </>
                )}

                {visibleError
                    ? renderErrorAlert({
                          message: visibleError,
                      })
                    : null}

                <FieldGroup className="tagm-create gap-2">
                    {renderNameField({
                        placeholder: "新建标签…",
                        withInlineAction: true,
                    })}
                    {hasNoTags ? null : (
                        <div className="tagm-meta-row flex flex-wrap items-center gap-2">
                            {renderColorToggleGroup(
                                QUICK_RECORDING_TAG_COLORS,
                                "quick",
                            )}
                        </div>
                    )}
                </FieldGroup>
            </>
        );
    }

    return (
        <Popover
            open
            modal={false}
            onOpenChange={(open) => {
                if (!open) {
                    onClose?.();
                }
            }}
        >
            <PopoverAnchor asChild>
                <span className="inline-flex size-0" aria-hidden="true" />
            </PopoverAnchor>
            <PopoverContent
                align="end"
                side="bottom"
                sideOffset={8}
                avoidCollisions={false}
                onOpenAutoFocus={(event) => {
                    event.preventDefault();
                }}
                onFocusOutside={(event) => {
                    event.preventDefault();
                }}
                aria-label="管理标签"
                aria-busy={busy ? "true" : undefined}
                data-open="true"
                className={cn(
                    RECORDING_TAG_MANAGER_PANEL_CLASS_NAME,
                    isCreateMode && "h-[342px] overflow-hidden",
                )}
            >
                <RecordingTagManagerHeader>
                    <RecordingTagManagerTitle>{title}</RecordingTagManagerTitle>
                    {showCloseButton ? (
                        <CardAction className="self-center">
                            <Button
                                variant="ghost"
                                size="icon-xs"
                                className={
                                    RECORDING_TAG_MANAGER_CLOSE_BUTTON_CLASS_NAME
                                }
                                type="button"
                                aria-label="关闭"
                                onClick={() => onClose?.()}
                            >
                                <X
                                    data-icon="inline-start"
                                    aria-hidden="true"
                                />
                            </Button>
                        </CardAction>
                    ) : null}
                </RecordingTagManagerHeader>
                <RecordingTagManagerContent contentVariant={contentVariant}>
                    {panelContent}
                </RecordingTagManagerContent>
                {panelAfterBody}
                {panelFooter ? (
                    <RecordingTagManagerFooter className="tagm-actions">
                        {panelFooter}
                    </RecordingTagManagerFooter>
                ) : null}
            </PopoverContent>
        </Popover>
    );
}
