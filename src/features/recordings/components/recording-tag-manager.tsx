"use client";

import { Check, LoaderCircle, Plus, X } from "lucide-react";
import {
    type ComponentProps,
    type CSSProperties,
    Fragment,
    type ReactNode,
    useMemo,
    useState,
} from "react";
import { toast } from "sonner";
import { useLanguage } from "@/components/language-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardAction,
    CardContent,
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
const RECORDING_TAG_SWATCH_COLORS = {
    purple: "var(--tag-violet)",
    blue: "var(--tag-blue)",
    red: "var(--tag-rose)",
    orange: "var(--tag-amber)",
    green: "var(--tag-green)",
    slate: "var(--tag-slate)",
} satisfies Record<RecordingTagColor, string>;

function recordingTagSwatchStyle(color: RecordingTagColor): CSSProperties {
    return {
        "--recording-tag-swatch-color": RECORDING_TAG_SWATCH_COLORS[color],
    } as CSSProperties;
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
            variant="destructive"
            data-sot-panel="recording-tag-error"
            data-sot-part="error"
            data-sot-state="error"
            data-sot-source-error={sourceError ?? undefined}
            className="[display:flex] items-center gap-2"
        >
            <RecordingTagAlertIcon
                data-sot-part="alert-icon"
                aria-hidden="true"
                className="shrink-0"
            />
            <AlertTitle className="sr-only">标签操作失败</AlertTitle>
            <AlertDescription
                className="[display:flex] flex-1 items-center gap-2"
                data-sot-part="error-description"
            >
                <span className="flex-1" data-sot-part="error-message">
                    {message}
                </span>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
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
            variant={selected ? "secondary" : "outline"}
            size="xs"
            className={cn(
                "relative h-6 whitespace-nowrap",
                saving && "pointer-events-none",
            )}
            onClick={interactive ? () => void handleToggleTag(tag) : undefined}
            disabled={interactive ? busy : undefined}
            aria-pressed={selected}
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
                <LoaderCircle
                    data-icon="inline-start"
                    data-sot-part="tag-loading-icon"
                    aria-hidden="true"
                    className="animate-spin"
                />
            ) : showIcon ? (
                <RecordingTagIconGlyph icon={tag.icon} variant="manager" />
            ) : null}
            {tag.name}
            {showCheck ? (
                <Check
                    data-icon="inline-end"
                    data-sot-part="tag-check"
                    aria-hidden="true"
                />
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
            <InputGroup className="h-8 gap-1.5" data-sot-part="create-row">
                <InputGroupInput
                    id={tagNameInputId}
                    type="text"
                    className="h-8 min-w-0"
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
                            variant="primary"
                            size="icon-sm"
                            className="shrink-0"
                            data-sot-control="recording-tag-create"
                            data-sot-state="idle"
                            disabled={!canCreate}
                            onClick={() => void handleCreateTag()}
                        >
                            <Plus aria-hidden="true" />
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
            variant="outline"
            size="sm"
            spacing={picker === "quick" ? 1 : 2}
            className="flex-wrap"
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
                    className="size-6 min-w-0 shrink-0 p-0"
                >
                    <span
                        className="block size-3.5 rounded-full bg-[var(--recording-tag-swatch-color)]"
                        style={recordingTagSwatchStyle(item)}
                        data-sot-part="swatch-dot"
                        aria-hidden="true"
                    />
                </ToggleGroupItem>
            ))}
        </ToggleGroup>
    );

    const renderColorPicker = () => (
        <div
            className="flex min-h-[59px] flex-col gap-2.5 rounded-md border bg-muted/40 p-3"
            data-sot-part="picker-frame"
            data-sot-picker="color"
        >
            <FieldSet
                className="m-0 contents min-w-0 border-0 p-0"
                data-sot-part="picker"
                data-sot-picker="color"
            >
                <FieldLegend
                    className="m-0 p-0 font-mono text-[11px] leading-none font-semibold uppercase tracking-[0.06em] text-muted-foreground"
                    data-sot-part="picker-label"
                >
                    颜色
                </FieldLegend>
                {renderColorToggleGroup(RECORDING_TAG_COLORS, "full")}
            </FieldSet>
        </div>
    );

    const renderIconPicker = () => (
        <div
            className="flex min-h-[103px] flex-col gap-2.5 rounded-md border bg-muted/40 p-3"
            data-sot-part="picker-frame"
            data-sot-picker="icon"
        >
            <FieldSet
                className="m-0 contents min-w-0 border-0 p-0"
                data-sot-part="picker"
                data-sot-picker="icon"
            >
                <FieldLegend
                    className="m-0 p-0 font-mono text-[11px] leading-none font-semibold uppercase tracking-[0.06em] text-muted-foreground"
                    data-sot-part="picker-label"
                >
                    图标
                </FieldLegend>
                <ToggleGroup
                    type="single"
                    value={icon}
                    onValueChange={(value) => {
                        if (value) {
                            setIcon(value as RecordingTagIcon);
                        }
                    }}
                    variant="outline"
                    size="sm"
                    spacing={2}
                    className="[display:grid] grid-cols-6"
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
                            className="size-7 min-w-0 shrink-0 p-0"
                        >
                            <RecordingTagIconGlyph icon={item} />
                        </ToggleGroupItem>
                    ))}
                </ToggleGroup>
            </FieldSet>
        </div>
    );

    let panelContent: ReactNode;
    let panelAfterBody: ReactNode = null;
    let panelFooter: ReactNode = null;

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
            <div
                className="px-3.5 pb-3 text-xs leading-relaxed text-muted-foreground"
                data-sot-part="toggle-note"
            >
                aria-pressed=&quot;true&quot; → 标签已应用 ·
                点击再次切换为「未应用」。
            </div>
        );
    } else if (deleteTarget) {
        panelContent = (
            <>
                <Alert
                    variant="destructive"
                    data-sot-panel="recording-tag-delete-confirm"
                    data-sot-part="delete-confirm"
                    data-sot-state={
                        deletingTagId === deleteTarget.id ? "saving" : "ready"
                    }
                    className="[display:flex] items-center gap-2 px-3 py-2.5"
                >
                    <RecordingTagAlertIcon
                        data-sot-part="alert-icon"
                        aria-hidden="true"
                        className="shrink-0"
                    />
                    <AlertTitle className="sr-only">确认删除标签</AlertTitle>
                    <AlertDescription
                        className="flex-1"
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
                <span className="flex-1" data-sot-part="footer-spacer" />
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
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
                    variant="danger"
                    size="sm"
                    className="min-w-[70px] shrink-0"
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
                        <LoaderCircle
                            data-icon="inline-start"
                            data-sot-part="tag-loading-icon"
                            aria-hidden="true"
                            className="animate-spin"
                        />
                    ) : null}
                    删除标签
                </Button>
            </>
        );
    } else if (isCreateMode) {
        panelContent = (
            <FieldGroup className="gap-3.5" data-sot-part="create">
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
                    size="sm"
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
                    variant="primary"
                    size="sm"
                    className="min-w-[70px] shrink-0"
                    data-sot-control="recording-tag-create"
                    data-sot-state={isCreating ? "saving" : "idle"}
                    aria-busy={isCreating ? "true" : undefined}
                    disabled={!canCreate}
                    onClick={() => void handleCreateTag()}
                >
                    {isCreating ? (
                        <LoaderCircle
                            data-icon="inline-start"
                            data-sot-part="tag-loading-icon"
                            aria-hidden="true"
                            className="animate-spin"
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
                        className="flex-none p-4 md:p-4"
                        data-sot-panel="recording-tag-empty"
                        data-sot-part="empty"
                        data-sot-state="empty"
                    >
                        <EmptyHeader>
                            <EmptyTitle data-sot-part="empty-message">
                                还没有任何标签
                            </EmptyTitle>
                            <EmptyDescription data-sot-part="empty-description">
                                在下方为这条录音创建第一个标签。
                            </EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                ) : (
                    <>
                        <section
                            className="flex flex-col gap-2"
                            data-sot-part="section"
                        >
                            <div
                                className="mb-2 flex items-center gap-1.5 font-mono text-[10.5px] leading-none font-semibold uppercase tracking-[0.08em] text-muted-foreground"
                                data-sot-part="section-label"
                            >
                                已选 · {selectedTags.length}
                            </div>
                            <div
                                className="flex flex-wrap gap-1"
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
                                        <Badge
                                            key={tag.id}
                                            variant="secondary"
                                            className="min-w-0 max-w-full"
                                            data-sot-part="selected-chip"
                                            data-sot-tag-color={tag.color}
                                            data-sot-tag-icon={tag.icon}
                                            data-sot-tag-id={tag.id}
                                            data-sot-tag-name={tag.name}
                                        >
                                            <RecordingTagIconGlyph
                                                icon={tag.icon}
                                                variant="manager"
                                            />
                                            <span data-sot-part="selected-chip-label">
                                                {tag.name}
                                            </span>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon-xs"
                                                className="shrink-0 [&_svg]:invisible"
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
                                                <X aria-hidden="true" />
                                            </Button>
                                        </Badge>
                                    );
                                })}
                            </div>
                        </section>

                        <section
                            className="flex flex-col gap-2"
                            data-sot-part="section"
                        >
                            <div
                                className="mb-2 flex items-center gap-1.5 font-mono text-[10.5px] leading-none font-semibold uppercase tracking-[0.08em] text-muted-foreground"
                                data-sot-part="section-label"
                            >
                                全部标签
                            </div>
                            <div
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
                        </section>
                    </>
                )}

                {visibleError
                    ? renderErrorAlert({
                          message: visibleError,
                          onRetry: () => setOperationError(null),
                      })
                    : null}

                <FieldGroup className="gap-2" data-sot-part="create">
                    {renderNameField({
                        placeholder: "新建标签…",
                        withInlineAction: true,
                    })}
                    {hasNoTags ? null : (
                        <div
                            className="flex flex-wrap items-center gap-2"
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
        <Card
            hasNoPadding
            role="dialog"
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
            className="max-h-[460px] w-80 max-w-[calc(100vw-2rem)] gap-0 max-md:max-w-none"
        >
            <CardHeader
                className="items-center border-b px-3 py-2.5"
                data-sot-part="head"
            >
                <CardTitle className="text-sm" data-sot-part="title">
                    {title}
                </CardTitle>
                {showCloseButton ? (
                    <CardAction data-sot-part="head-action">
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            className="shrink-0"
                            type="button"
                            aria-label="关闭"
                            data-sot-control="recording-tag-manager-close"
                            data-sot-state="idle"
                            onClick={() => onClose?.()}
                        >
                            <X aria-hidden="true" />
                        </Button>
                    </CardAction>
                ) : null}
            </CardHeader>
            <CardContent
                className="flex min-h-0 flex-col gap-3.5 overflow-auto px-3.5 py-3.5"
                data-sot-part="body"
            >
                {panelContent}
            </CardContent>
            {panelAfterBody}
            {panelFooter ? (
                <CardFooter
                    className="justify-end gap-2 border-t px-3 py-2.5"
                    data-sot-part="footer"
                >
                    {panelFooter}
                </CardFooter>
            ) : null}
        </Card>
    );
}
