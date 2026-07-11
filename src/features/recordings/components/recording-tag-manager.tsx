"use client";

import { Check, CircleAlert, X } from "lucide-react";
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
    recordingTagSotColorLabel,
    recordingTagSwatchColorClassName,
    recordingTagTextColorClassName,
} from "./recording-tag-visuals";

interface RecordingTagManagerProps {
    recording: Recording;
    availableTags: RecordingTag[];
    onAvailableTagsChange: (tags: RecordingTag[]) => void;
    onRecordingTagsChange: (recordingId: string, tags: RecordingTag[]) => void;
    loadError?: string | null;
    onClose?: () => void;
    variant?: "popover";
}

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

const SOT_TAG_MANAGER_ERROR_TEXT = "保存失败 · 请稍后再试";
const RECORDING_TAG_SWATCH_ITEM_CLASS_NAME =
    "tagm-swatch grid size-[18px] min-w-0 place-items-center rounded-full border-2 border-transparent p-0 text-foreground shadow-none transition-transform duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:scale-110 data-[state=on]:border-foreground";

const RECORDING_TAG_MANAGER_PANEL_CLASS_NAME =
    "tagm-panel max-h-[460px] w-[320px] max-w-[calc(100vw-2rem)] gap-0 overflow-hidden rounded-[12px] border-[var(--card-popover-border)] bg-[var(--card-popover-bg)] p-0 text-popover-foreground shadow-[var(--card-popover-shadow)] backdrop-blur-none data-[sot-state=create]:h-[342px] data-[sot-state=create]:overflow-hidden max-md:w-[calc(100vw-24px)] max-md:max-w-none";
const RECORDING_TAG_MANAGER_HEADER_CLASS_NAME =
    "tagm-head flex flex-row items-center justify-between gap-[normal] [border-bottom:1px_solid_var(--card-popover-divider)] px-[12px] py-[10px] [&>[data-slot=card-action]]:self-center";
const RECORDING_TAG_MANAGER_TITLE_CLASS_NAME =
    "tagm-title text-xs font-semibold leading-tight text-foreground";
const RECORDING_TAG_MANAGER_FOOTER_CLASS_NAME =
    "min-h-[47px] gap-1.5 border-t border-[var(--card-popover-divider)] bg-[var(--card-popover-footer-bg)] px-3.5 py-2.5";
const RECORDING_TAG_MANAGER_TOGGLE_NOTE_CLASS_NAME =
    "tagm-note m-0 pb-3.5 text-xs leading-normal text-muted-foreground";
const RECORDING_TAG_MANAGER_CONTENT_CLASS_NAME =
    "flex flex-col gap-[14px] overflow-auto px-3.5 pb-3.5 pt-3";
const RECORDING_TAG_MANAGER_TAG_TOGGLE_CLASS_NAME =
    "tagm-opt relative h-6 justify-normal gap-[5px] rounded-[var(--radius-pill)] border border-[var(--line-hairline)] bg-[var(--bg-recessed)] px-2.5 [font:600_11.5px_var(--font-sans)] text-[var(--fg-secondary)] shadow-none transition-none hover:bg-[var(--bg-elevated)] hover:text-[var(--fg-primary)] has-[>svg]:px-2.5 disabled:opacity-70";
const RECORDING_TAG_MANAGER_SELECTED_BADGE_CLASS_NAME =
    "tagm-sel-chip justify-normal gap-1 rounded-full border-border pr-1";
const RECORDING_TAG_MANAGER_CHIP_REMOVE_BUTTON_CLASS_NAME =
    "x shrink-0 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground";
const RECORDING_TAG_MANAGER_CHECK_BADGE_CLASS_NAME =
    "tagm-opt-check ml-0.5 inline-grid place-items-center rounded-full border-0";
const RECORDING_TAG_MANAGER_CLOSE_BUTTON_CLASS_NAME =
    "tagm-close shrink-0 text-muted-foreground hover:bg-muted hover:text-foreground";
const RECORDING_TAG_MANAGER_PICKER_FRAME_CLASS_NAME =
    "tagm-picker flex flex-col gap-2.5 rounded-md border border-border bg-muted px-3 py-2.5";
const RECORDING_TAG_MANAGER_PICKER_LABEL_CLASS_NAME =
    "tagm-picker-label m-0 p-0 font-mono text-[11px] font-semibold leading-none uppercase tracking-wide text-muted-foreground";
const RECORDING_TAG_MANAGER_ICON_OPTION_CLASS_NAME =
    "tg-pick min-w-0 shrink-0 rounded-md border-border bg-background text-muted-foreground shadow-none hover:border-border hover:bg-muted hover:text-foreground data-[state=on]:border-primary/50 data-[state=on]:bg-primary/15 data-[state=on]:text-primary";

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

function RecordingTagManagerPopoverContent({
    className,
    onFocusOutside,
    onOpenAutoFocus,
    ...props
}: Omit<ComponentProps<typeof PopoverContent>, "variant">) {
    return (
        <PopoverContent
            align="end"
            side="bottom"
            sideOffset={8}
            avoidCollisions={false}
            onOpenAutoFocus={(event) => {
                event.preventDefault();
                onOpenAutoFocus?.(event);
            }}
            onFocusOutside={(event) => {
                event.preventDefault();
                onFocusOutside?.(event);
            }}
            className={cn(RECORDING_TAG_MANAGER_PANEL_CLASS_NAME, className)}
            {...props}
        />
    );
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

function RecordingTagAlertIcon(props: ComponentProps<typeof CircleAlert>) {
    return <CircleAlert focusable="false" {...props} />;
}

export function RecordingTagManager({
    recording,
    availableTags,
    loadError,
    onAvailableTagsChange,
    onRecordingTagsChange,
    onClose,
    variant = "popover",
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
    const [retryAction, setRetryAction] = useState<
        { tag: RecordingTag; type: "toggle" } | { type: "create" } | null
    >(null);

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
        Boolean(visibleError) && !deleteTarget && !shouldShowSavingState;
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
    const panelState = shouldShowSavingState
        ? "saving"
        : shouldShowErrorState
          ? "error"
          : deletingTagId
            ? "deleting"
            : deleteTarget
              ? "delete-confirm"
              : isCreating
                ? "creating"
                : isCreateMode
                  ? "create"
                  : shouldShowToggleState
                    ? "toggle"
                    : "ready";

    const upsertAvailableTag = (tag: RecordingTag) => {
        onAvailableTagsChange([
            tag,
            ...availableTags.filter((item) => item.id !== tag.id),
        ]);
    };

    const updateRecordingTags = async (nextTags: RecordingTag[]) => {
        const response = await fetch(`/api/recordings/${recording.id}/tags`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tagIds: nextTags.map((tag) => tag.id) }),
        });
        const data = await readJsonResponse(response);
        const tags = Array.isArray(data.tags) ? data.tags : nextTags;
        onRecordingTagsChange(recording.id, tags);
        return tags as RecordingTag[];
    };

    const handleToggleTag = async (tag: RecordingTag) => {
        if (busy) {
            return;
        }

        setSavingTagId(tag.id);
        setOperationError(null);
        setRetryAction(null);
        setShowToggleState(false);
        try {
            const nextTags = selectedTagIds.has(tag.id)
                ? recording.tags.filter((item) => item.id !== tag.id)
                : [...recording.tags, tag];
            await updateRecordingTags(nextTags);
            setShowToggleState(true);
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : language === "zh-CN"
                      ? "标签保存失败"
                      : "Failed to save tag";
            setOperationError(message);
            setRetryAction({ tag, type: "toggle" });
            setShowToggleState(false);
            toast.error(message);
        } finally {
            setSavingTagId(null);
        }
    };

    const handleCreateTag = async () => {
        const nextName = name.trim();
        if (!nextName || isCreating) {
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
                body: JSON.stringify({ name: nextName, color, icon }),
            });
            const data = await readJsonResponse(response);
            const tag = data.tag as RecordingTag;
            upsertAvailableTag(tag);
            await updateRecordingTags([...recording.tags, tag]);
            setName("");
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : language === "zh-CN"
                      ? "标签创建失败"
                      : "Failed to create tag";
            setOperationError(message);
            setRetryAction({ type: "create" });
            toast.error(message);
        } finally {
            setIsCreating(false);
        }
    };

    const handleDeleteTag = async () => {
        if (!deleteTarget || deletingTagId) {
            return;
        }

        setDeletingTagId(deleteTarget.id);
        setOperationError(null);
        setRetryAction(null);
        setShowToggleState(false);
        try {
            const response = await fetch(
                `/api/recording-tags/${deleteTarget.id}`,
                {
                    method: "DELETE",
                },
            );
            await readJsonResponse(response);
            onAvailableTagsChange(
                availableTags.filter((tag) => tag.id !== deleteTarget.id),
            );
            if (selectedTagIds.has(deleteTarget.id)) {
                onRecordingTagsChange(
                    recording.id,
                    recording.tags.filter((tag) => tag.id !== deleteTarget.id),
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
            toast.error(message);
        } finally {
            setDeletingTagId(null);
        }
    };

    const handleRetry = () => {
        const action = retryAction;
        setOperationError(null);

        if (!action) {
            return;
        }

        if (action.type === "toggle") {
            void handleToggleTag(action.tag);
            return;
        }

        void handleCreateTag();
    };

    const tagNameInputId = "recording-tag-name-input";
    const tagColorPickerLabelId = "recording-tag-color-picker-label";
    const tagIconPickerLabelId = "recording-tag-icon-picker-label";

    const renderErrorAlert = ({
        message = SOT_TAG_MANAGER_ERROR_TEXT,
        onRetry = handleRetry,
        sourceError,
    }: {
        message?: string;
        onRetry?: () => void;
        sourceError?: string | null;
    }) => (
        <Alert
            density="compact"
            layout="inline"
            variant="statusError"
            data-sot-panel="recording-tag-error"
            data-sot-part="error"
            data-sot-state="error"
            data-sot-source-error={sourceError ?? undefined}
        >
            <RecordingTagAlertIcon
                data-sot-part="alert-icon"
                aria-hidden="true"
                className="shrink-0"
            />
            <AlertDescription
                density="compact"
                className="flex-1"
                data-sot-part="error-description"
            >
                <span className="flex-1" data-sot-part="error-message">
                    {message}
                </span>
                <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    className="shrink-0"
                    data-sot-control="recording-tag-error-retry"
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
            data-sot-control="recording-tag-toggle"
            data-sot-part="tag-option"
            data-sot-state={saving ? "saving" : selected ? "selected" : "idle"}
            data-sot-tag-color={tag.color}
            data-sot-tag-icon={tag.icon}
            data-sot-tag-id={tag.id}
            data-sot-tag-name={tag.name}
        >
            {saving ? (
                <Spinner
                    size="xs"
                    placement="inlineStart"
                    className="btn-spinner"
                    data-icon="inline-start"
                    data-sot-part="tag-loading-icon"
                    aria-hidden="true"
                />
            ) : showIcon ? (
                <RecordingTagIconGlyph
                    data-icon="inline-start"
                    icon={tag.icon}
                    variant="manager"
                />
            ) : null}
            {tag.name}
            {showCheck ? (
                <RecordingTagManagerBadge
                    appearance="checkDot"
                    data-sot-part="tag-check"
                    aria-hidden="true"
                >
                    <Check data-icon="inline-end" aria-hidden="true" />
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
        <Field
            data-sot-part="create-field"
            data-disabled={disabled || undefined}
        >
            <FieldLabel htmlFor={tagNameInputId} className="sr-only">
                标签名
            </FieldLabel>
            <InputGroup
                variant="compact"
                className="tagm-create-row"
                data-sot-part="create-row"
            >
                <InputGroupInput
                    variant="compact"
                    id={tagNameInputId}
                    type="text"
                    className="field-input min-w-0"
                    value={name}
                    maxLength={MAX_RECORDING_TAG_NAME_LENGTH}
                    data-sot-control="recording-tag-name"
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
                                "shrink-0 text-primary-foreground disabled:opacity-50",
                            )}
                            data-sot-control="recording-tag-create"
                            data-sot-state="idle"
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
                if (value) {
                    setColor(value as RecordingTagColor);
                }
            }}
            variant="default"
            size="sm"
            className={cn(
                "tagm-swatches flex-wrap rounded-none",
                picker === "quick" ? "gap-1" : "gap-2",
            )}
            spacing={picker === "quick" ? 1 : 2}
            aria-label="颜色"
            data-sot-part="color-swatches"
            data-sot-picker={picker}
        >
            {items.map((item) => (
                <ToggleGroupItem
                    key={item}
                    value={item}
                    aria-label={recordingTagSotColorLabel[item]}
                    data-sot-control="recording-tag-color"
                    data-sot-part="color-swatch"
                    data-sot-state={color === item ? "selected" : "idle"}
                    data-sot-tag-color={item}
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
            data-sot-part="picker-frame"
            data-sot-picker="color"
        >
            <FieldLegend
                id={tagColorPickerLabelId}
                variant="label"
                className={RECORDING_TAG_MANAGER_PICKER_LABEL_CLASS_NAME}
                data-sot-part="picker-label"
            >
                颜色
            </FieldLegend>
            <div data-sot-part="picker" data-sot-picker="color">
                {renderColorToggleGroup(RECORDING_TAG_COLORS, "full")}
            </div>
        </FieldSet>
    );

    const renderIconPicker = () => (
        <FieldSet
            className={cn(
                RECORDING_TAG_MANAGER_PICKER_FRAME_CLASS_NAME,
                "min-h-[103px]",
            )}
            data-sot-part="picker-frame"
            data-sot-picker="icon"
        >
            <FieldLegend
                id={tagIconPickerLabelId}
                variant="label"
                className={RECORDING_TAG_MANAGER_PICKER_LABEL_CLASS_NAME}
                data-sot-part="picker-label"
            >
                图标
            </FieldLegend>
            <div data-sot-part="picker" data-sot-picker="icon">
                <ToggleGroup
                    type="single"
                    value={icon}
                    onValueChange={(value) => {
                        if (value) {
                            setIcon(value as RecordingTagIcon);
                        }
                    }}
                    variant="default"
                    size="sm"
                    layout="iconGrid"
                    className="tagm-icon-grid rounded-none"
                    spacing={1.5}
                    aria-label="图标"
                    data-sot-part="icon-grid"
                >
                    {RECORDING_TAG_ICONS.map((item) => (
                        <ToggleGroupItem
                            key={item}
                            value={item}
                            aria-label={`选择图标 ${item}`}
                            data-sot-control="recording-tag-icon"
                            data-sot-part="icon-option"
                            data-sot-state={icon === item ? "selected" : "idle"}
                            data-sot-tag-icon={item}
                            variant="outline"
                            size="sm"
                            className={cn(
                                RECORDING_TAG_MANAGER_ICON_OPTION_CLASS_NAME,
                                icon === item && "is-selected",
                            )}
                        >
                            <RecordingTagIconGlyph
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
            <div
                data-sot-list="recording-tag-saving-options"
                data-sot-part="tag-options"
            >
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
                {renderErrorAlert({ sourceError: visibleError })}
                <div
                    data-sot-list="recording-tag-error-options"
                    data-sot-part="tag-options"
                >
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
            <div
                data-sot-list="recording-tag-toggle-options"
                data-sot-part="tag-options"
            >
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
            <RecordingTagManagerToggleNote data-sot-part="toggle-note">
                aria-pressed=&quot;true&quot; → 标签已应用 ·
                点击再次切换为「未应用」。
            </RecordingTagManagerToggleNote>
        );
    } else if (deleteTarget) {
        panelContent = (
            <>
                <Alert
                    density="comfortable"
                    layout="inline"
                    variant="destructiveSoftNeutral"
                    className="tagm-delete-confirm"
                    data-sot-panel="recording-tag-delete-confirm"
                    data-sot-part="delete-confirm"
                    data-sot-state={
                        deletingTagId === deleteTarget.id ? "saving" : "ready"
                    }
                >
                    <RecordingTagAlertIcon
                        data-sot-part="alert-icon"
                        aria-hidden="true"
                        className="shrink-0"
                    />
                    <AlertDescription
                        density="comfortable"
                        className="tagm-delete-msg flex-1"
                        data-sot-part="delete-message"
                    >
                        <strong>{deleteTarget.name}</strong> 将从{" "}
                        {tagDetailsById.get(deleteTarget.id)?.recordingCount ??
                            deleteTarget.recordingCount ??
                            (selectedTagIds.has(deleteTarget.id) ? 1 : 0)}{" "}
                        条录音上移除。标签本身会从所有人的录音侧栏消失，无法撤销。
                    </AlertDescription>
                </Alert>
                {visibleError
                    ? renderErrorAlert({
                          message: visibleError,
                          onRetry: () => setOperationError(null),
                      })
                    : null}
            </>
        );
        panelFooter = (
            <>
                <span
                    className="tagm-spacer flex-1"
                    data-sot-part="footer-spacer"
                />
                <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    className="shrink-0"
                    data-sot-control="recording-tag-delete-cancel"
                    disabled={Boolean(deletingTagId)}
                    onClick={() => {
                        setDeleteTarget(null);
                        setOperationError(null);
                    }}
                >
                    取消
                </Button>
                <Button
                    type="button"
                    variant="destructive"
                    size="xs"
                    className="shrink-0"
                    data-sot-control="recording-tag-delete-confirm"
                    data-sot-state={
                        deletingTagId === deleteTarget.id ? "saving" : "idle"
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
                            data-sot-part="tag-loading-icon"
                            aria-hidden="true"
                        />
                    ) : null}
                    删除标签
                </Button>
            </>
        );
    } else if (isCreateMode) {
        panelContent = (
            <FieldGroup className="gap-[14px]" data-sot-part="create">
                {renderNameField({
                    disabled: isCreating,
                    enableEnterCreate: true,
                    placeholder: "标签名",
                })}
                {visibleError
                    ? renderErrorAlert({
                          message: visibleError,
                          onRetry: () => setOperationError(null),
                      })
                    : null}
                {renderColorPicker()}
                {renderIconPicker()}
            </FieldGroup>
        );
        panelFooter = (
            <>
                <span className="flex-1" data-sot-part="footer-spacer" />
                <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    className="shrink-0"
                    data-sot-control="recording-tag-create-cancel"
                    disabled={isCreating}
                    onClick={() => {
                        setName("");
                        setOperationError(null);
                    }}
                >
                    取消
                </Button>
                <Button
                    type="button"
                    variant="default"
                    size="xs"
                    className="shrink-0"
                    data-sot-control="recording-tag-create"
                    data-sot-state={isCreating ? "saving" : "idle"}
                    aria-busy={isCreating ? "true" : undefined}
                    disabled={!canCreate}
                    onClick={() => void handleCreateTag()}
                >
                    {isCreating ? (
                        <Spinner
                            size="xs"
                            className="btn-spinner"
                            data-icon="inline-start"
                            data-sot-part="tag-loading-icon"
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
                    <Empty
                        variant="popover"
                        data-sot-panel="recording-tag-empty"
                        data-sot-part="empty"
                        data-sot-state="empty"
                    >
                        <EmptyHeader variant="popover">
                            <EmptyTitle
                                variant="popover"
                                data-sot-part="empty-message"
                            >
                                还没有任何标签
                            </EmptyTitle>
                            <EmptyDescription
                                variant="popover"
                                data-sot-part="empty-description"
                            >
                                在下方为这条录音创建第一个标签。
                            </EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                ) : (
                    <>
                        <FieldSet
                            className="tagm-sec gap-2"
                            data-sot-part="section"
                        >
                            <FieldLegend
                                variant="label"
                                className="tagm-sec-label mb-0"
                                data-sot-part="section-label"
                            >
                                已选 · {selectedTags.length}
                            </FieldLegend>
                            <div
                                className="tagm-chips flex flex-wrap gap-1"
                                data-sot-list="recording-selected-tags"
                                data-sot-part="selected-chips"
                                data-sot-state={
                                    selectedTags.length > 0 ? "ready" : "empty"
                                }
                            >
                                {selectedTags.map((tag) => {
                                    const catalogTag =
                                        tagDetailsById.get(tag.id) ?? tag;

                                    return (
                                        <RecordingTagManagerBadge
                                            key={tag.id}
                                            appearance="pill"
                                            className={cn(
                                                "min-w-0 max-w-full",
                                                recordingTagTextColorClassName[
                                                    tag.color
                                                ],
                                            )}
                                            data-sot-part="selected-chip"
                                            data-sot-tag-color={tag.color}
                                            data-sot-tag-icon={tag.icon}
                                            data-sot-tag-id={tag.id}
                                            data-sot-tag-name={tag.name}
                                        >
                                            <RecordingTagIconGlyph
                                                data-icon="inline-start"
                                                icon={tag.icon}
                                                variant="manager"
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
                                                data-sot-control="recording-tag-delete-open"
                                                data-sot-state={
                                                    savingTagId === tag.id
                                                        ? "saving"
                                                        : "idle"
                                                }
                                                disabled={Boolean(
                                                    deletingTagId,
                                                )}
                                                onClick={() => {
                                                    setOperationError(null);
                                                    setShowToggleState(false);
                                                    setDeleteTarget(catalogTag);
                                                }}
                                            >
                                                <X
                                                    data-icon="inline-start"
                                                    aria-hidden="true"
                                                    className="invisible"
                                                />
                                            </Button>
                                        </RecordingTagManagerBadge>
                                    );
                                })}
                            </div>
                        </FieldSet>

                        <FieldSet
                            className="tagm-sec gap-2"
                            data-sot-part="section"
                        >
                            <FieldLegend
                                variant="label"
                                className="tagm-sec-label mb-0"
                                data-sot-part="section-label"
                            >
                                全部标签
                            </FieldLegend>
                            <div
                                className="tagm-opts"
                                data-sot-list="recording-available-tags"
                                data-sot-part="tag-options"
                                data-sot-state="ready"
                            >
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
                        </FieldSet>
                    </>
                )}

                {visibleError
                    ? renderErrorAlert({
                          message: visibleError,
                          onRetry: () => setOperationError(null),
                      })
                    : null}

                <FieldGroup
                    className="tagm-create gap-2"
                    data-sot-part="create"
                >
                    {renderNameField({
                        placeholder: "新建标签…",
                        withInlineAction: true,
                    })}
                    {hasNoTags ? null : (
                        <div
                            className="tagm-meta-row flex flex-wrap items-center gap-2"
                            data-sot-part="create-meta"
                        >
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
                <span
                    className="inline-flex size-0"
                    data-sot-part="recording-tag-manager-anchor"
                    aria-hidden="true"
                />
            </PopoverAnchor>
            <RecordingTagManagerPopoverContent
                aria-label="管理标签"
                aria-busy={busy ? "true" : undefined}
                data-open="true"
                data-state={visibleError ? "error" : undefined}
                data-sot-panel="recording-tag-manager"
                data-sot-create-state={isCreating ? "saving" : "idle"}
                data-sot-error={visibleError ? "true" : "false"}
                data-sot-error-message={visibleError ?? undefined}
                data-sot-state={panelState}
                data-sot-toggle-state={
                    savingTagId
                        ? "saving"
                        : shouldShowToggleState
                          ? "toggle"
                          : "idle"
                }
                data-sot-variant={variant}
            >
                <RecordingTagManagerHeader data-sot-part="head">
                    <RecordingTagManagerTitle data-sot-part="title">
                        {title}
                    </RecordingTagManagerTitle>
                    {showCloseButton ? (
                        <CardAction data-sot-part="head-action">
                            <Button
                                variant="ghost"
                                size="icon-xs"
                                className={
                                    RECORDING_TAG_MANAGER_CLOSE_BUTTON_CLASS_NAME
                                }
                                type="button"
                                aria-label="关闭"
                                data-sot-control="recording-tag-manager-close"
                                data-sot-state="idle"
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
                <RecordingTagManagerContent
                    contentVariant={contentVariant}
                    data-sot-part="body"
                >
                    {panelContent}
                </RecordingTagManagerContent>
                {panelAfterBody}
                {panelFooter ? (
                    <RecordingTagManagerFooter
                        className="tagm-actions"
                        data-sot-part="footer"
                    >
                        {panelFooter}
                    </RecordingTagManagerFooter>
                ) : null}
            </RecordingTagManagerPopoverContent>
        </Popover>
    );
}
