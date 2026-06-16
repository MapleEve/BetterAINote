"use client";

import { Fragment, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    MAX_RECORDING_TAG_NAME_LENGTH,
    RECORDING_TAG_COLORS,
    RECORDING_TAG_ICONS,
    type RecordingTag,
    type RecordingTagColor,
    type RecordingTagIcon,
} from "@/lib/recording-tags";
import type { Recording } from "@/types/recording";
import {
    RecordingTagIconGlyph,
    recordingTagSotColorClassName,
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

function TagManagerXIcon() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M18 6 6 18M6 6l12 12" />
        </svg>
    );
}

function TagManagerAlertIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
            focusable="false"
        >
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
            <circle cx="12" cy="12" r="10" />
        </svg>
    );
}

function TagManagerCheckIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            width="12"
            height="12"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            aria-hidden="true"
            focusable="false"
        >
            <path d="M20 6 9 17l-5-5" />
        </svg>
    );
}

function TagManagerToggleIcon({ icon }: { icon: RecordingTagIcon }) {
    switch (icon) {
        case "grid":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M3 3h7v7H3z" />
                </svg>
            );
        case "user":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <circle cx="9" cy="7" r="4" />
                </svg>
            );
        case "heart":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M19 14c1.49-1.46 3-3.21 3-5.5" />
                </svg>
            );
        case "clock":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <circle cx="12" cy="12" r="10" />
                </svg>
            );
        default:
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M3 3h7v7H3z" />
                </svg>
            );
    }
}

const SOT_TAG_MANAGER_ERROR_TEXT = "保存失败 · 请稍后再试";

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

    return (
        <div
            className="tagm-panel"
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
        >
            <header className="tagm-head">
                <span className="tagm-title">{title}</span>
                {showCloseButton ? (
                    <button
                        className="icon-btn tagm-close"
                        type="button"
                        aria-label="关闭"
                        data-sot-control="recording-tag-manager-close"
                        data-sot-state="idle"
                        onClick={() => onClose?.()}
                    >
                        <TagManagerXIcon />
                    </button>
                ) : null}
            </header>

            {shouldShowSavingState ? (
                <div className="tagm-body">
                    <div
                        className="tagm-opts"
                        data-sot-list="recording-tag-saving-options"
                    >
                        {savingPanelTags.slice(0, 2).map((tag, index) => {
                            const saving = tag.id === savingTagId;
                            const renderedSavingCount = Math.min(
                                savingPanelTags.length,
                                2,
                            );

                            return (
                                <Fragment key={tag.id}>
                                    <button
                                        type="button"
                                        aria-pressed={selectedTagIds.has(
                                            tag.id,
                                        )}
                                        aria-busy={saving ? "true" : undefined}
                                        data-sot-control="recording-tag-toggle"
                                        data-sot-state={
                                            saving ? "saving" : "selected"
                                        }
                                        data-sot-tag-color={tag.color}
                                        data-sot-tag-icon={tag.icon}
                                        data-sot-tag-id={tag.id}
                                        data-sot-tag-name={tag.name}
                                        className={`tagm-opt ${recordingTagSotColorClassName[tag.color]}`}
                                    >
                                        {saving ? (
                                            <span
                                                className="btn-spinner"
                                                aria-hidden="true"
                                            />
                                        ) : null}
                                        {tag.name}
                                    </button>
                                    {index < renderedSavingCount - 1
                                        ? " "
                                        : null}
                                </Fragment>
                            );
                        })}
                    </div>
                </div>
            ) : shouldShowErrorState ? (
                <div className="tagm-body">
                    <div
                        className="tagm-error"
                        data-sot-panel="recording-tag-error"
                        data-sot-state="error"
                        data-sot-source-error={visibleError ?? undefined}
                        role="alert"
                    >
                        <TagManagerAlertIcon />
                        <span>{SOT_TAG_MANAGER_ERROR_TEXT}</span>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            data-sot-control="recording-tag-error-retry"
                            onClick={handleRetry}
                        >
                            重试
                        </Button>
                    </div>
                    <div
                        className="tagm-opts"
                        data-sot-list="recording-tag-error-options"
                    >
                        {errorPanelTags.map((tag) => (
                            <button
                                key={tag.id}
                                type="button"
                                aria-pressed={false}
                                data-sot-control="recording-tag-toggle"
                                data-sot-state="idle"
                                data-sot-tag-color={tag.color}
                                data-sot-tag-icon={tag.icon}
                                data-sot-tag-id={tag.id}
                                data-sot-tag-name={tag.name}
                                className={`tagm-opt ${recordingTagSotColorClassName[tag.color]}`}
                            >
                                {tag.name}
                            </button>
                        ))}
                    </div>
                </div>
            ) : shouldShowToggleState ? (
                <>
                    <div className="tagm-body">
                        <div
                            className="tagm-opts"
                            data-sot-list="recording-tag-toggle-options"
                        >
                            {sortedTags.map((tag, index) => {
                                const selected = selectedTagIds.has(tag.id);

                                return (
                                    <Fragment key={tag.id}>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                void handleToggleTag(tag)
                                            }
                                            disabled={busy}
                                            aria-pressed={selected}
                                            data-sot-control="recording-tag-toggle"
                                            data-sot-state={
                                                selected ? "selected" : "idle"
                                            }
                                            data-sot-tag-color={tag.color}
                                            data-sot-tag-icon={tag.icon}
                                            data-sot-tag-id={tag.id}
                                            data-sot-tag-name={tag.name}
                                            className={`tagm-opt ${recordingTagSotColorClassName[tag.color]}`}
                                        >
                                            <TagManagerToggleIcon
                                                icon={tag.icon}
                                            />
                                            {tag.name}
                                            {"\n                    "}
                                            {tag.id ===
                                            firstSelectedToggleTagId ? (
                                                <span
                                                    className="tagm-opt-check"
                                                    aria-hidden="true"
                                                >
                                                    <TagManagerCheckIcon />
                                                </span>
                                            ) : null}
                                        </button>
                                        {index < sortedTags.length - 1
                                            ? " "
                                            : null}
                                    </Fragment>
                                );
                            })}
                        </div>
                    </div>
                    <div className="cl-note">
                        aria-pressed=&quot;true&quot; → 标签已应用 ·
                        点击再次切换为「未应用」。
                    </div>
                </>
            ) : deleteTarget ? (
                <>
                    <div className="tagm-body">
                        <div
                            className="tagm-delete-confirm"
                            data-sot-panel="recording-tag-delete-confirm"
                            data-sot-state={
                                deletingTagId === deleteTarget.id
                                    ? "saving"
                                    : "ready"
                            }
                        >
                            <TagManagerAlertIcon />
                            <div className="tagm-delete-msg">
                                <strong>{deleteTarget.name}</strong> 将从{" "}
                                {tagDetailsById.get(deleteTarget.id)
                                    ?.recordingCount ??
                                    deleteTarget.recordingCount ??
                                    (selectedTagIds.has(deleteTarget.id)
                                        ? 1
                                        : 0)}{" "}
                                条录音上移除。标签本身会从所有人的录音侧栏消失，无法撤销。
                            </div>
                        </div>
                        {visibleError ? (
                            <div
                                className="tagm-error"
                                data-sot-panel="recording-tag-error"
                                data-sot-state="error"
                                role="alert"
                            >
                                <TagManagerAlertIcon />
                                <span>{visibleError}</span>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    data-sot-control="recording-tag-error-retry"
                                    onClick={() => setOperationError(null)}
                                >
                                    重试
                                </Button>
                            </div>
                        ) : null}
                    </div>
                    <footer className="airp-actions">
                        <span className="airp-spacer" />
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
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
                            data-sot-control="recording-tag-delete-confirm"
                            data-sot-state={
                                deletingTagId === deleteTarget.id
                                    ? "saving"
                                    : "idle"
                            }
                            aria-busy={
                                deletingTagId === deleteTarget.id
                                    ? "true"
                                    : undefined
                            }
                            disabled={Boolean(deletingTagId)}
                            onClick={() => void handleDeleteTag()}
                        >
                            {deletingTagId === deleteTarget.id ? (
                                <span
                                    className="btn-spinner"
                                    aria-hidden="true"
                                />
                            ) : null}
                            删除标签
                        </Button>
                    </footer>
                </>
            ) : isCreateMode ? (
                <>
                    <div className="tagm-body">
                        <div className="tagm-create">
                            <div className="tagm-create-row">
                                <Input
                                    type="text"
                                    value={name}
                                    maxLength={MAX_RECORDING_TAG_NAME_LENGTH}
                                    data-sot-control="recording-tag-name"
                                    onChange={(event) => {
                                        setShowToggleState(false);
                                        setName(
                                            Array.from(event.target.value)
                                                .slice(
                                                    0,
                                                    MAX_RECORDING_TAG_NAME_LENGTH,
                                                )
                                                .join(""),
                                        );
                                    }}
                                    onKeyDown={(event) => {
                                        if (
                                            event.key === "Enter" &&
                                            canCreate
                                        ) {
                                            void handleCreateTag();
                                        }
                                    }}
                                    placeholder="标签名"
                                    disabled={isCreating}
                                />
                            </div>
                        </div>

                        {visibleError ? (
                            <div
                                className="tagm-error"
                                data-sot-panel="recording-tag-error"
                                data-sot-state="error"
                                role="alert"
                            >
                                <TagManagerAlertIcon />
                                <span>{visibleError}</span>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    data-sot-control="recording-tag-error-retry"
                                    onClick={() => setOperationError(null)}
                                >
                                    重试
                                </Button>
                            </div>
                        ) : null}

                        <div className="tagm-picker">
                            <div className="tagm-picker-label">颜色</div>
                            <div className="tagm-swatches">
                                {RECORDING_TAG_COLORS.map((item) => (
                                    <button
                                        key={item}
                                        type="button"
                                        onClick={() => setColor(item)}
                                        aria-label={
                                            recordingTagSotColorLabel[item]
                                        }
                                        aria-pressed={color === item}
                                        data-sot-control="recording-tag-color"
                                        data-sot-state={
                                            color === item ? "selected" : "idle"
                                        }
                                        data-sot-tag-color={item}
                                        className={`tagm-swatch ${recordingTagSotColorClassName[item]}${
                                            color === item ? " is-selected" : ""
                                        }`}
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="tagm-picker">
                            <div className="tagm-picker-label">图标</div>
                            <div className="tagm-icon-grid">
                                {RECORDING_TAG_ICONS.map((item) => (
                                    <button
                                        key={item}
                                        type="button"
                                        onClick={() => setIcon(item)}
                                        aria-label={`选择图标 ${item}`}
                                        aria-pressed={icon === item}
                                        data-sot-control="recording-tag-icon"
                                        data-sot-state={
                                            icon === item ? "selected" : "idle"
                                        }
                                        data-sot-tag-icon={item}
                                        className={`tg-pick${
                                            icon === item ? " is-selected" : ""
                                        }`}
                                    >
                                        <RecordingTagIconGlyph icon={item} />
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                    <footer className="airp-actions">
                        <span className="airp-spacer" />
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
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
                            data-sot-control="recording-tag-create"
                            data-sot-state={isCreating ? "saving" : "idle"}
                            aria-busy={isCreating ? "true" : undefined}
                            disabled={!canCreate}
                            onClick={() => void handleCreateTag()}
                        >
                            {isCreating ? (
                                <span
                                    className="btn-spinner"
                                    aria-hidden="true"
                                />
                            ) : null}
                            创建
                        </Button>
                    </footer>
                </>
            ) : (
                <div className="tagm-body">
                    {hasNoTags ? (
                        <div
                            className="tagm-empty"
                            data-sot-panel="recording-tag-empty"
                            data-sot-state="empty"
                        >
                            <div className="tagm-empty-msg">还没有任何标签</div>
                            <div className="tagm-empty-sub">
                                在下方为这条录音创建第一个标签。
                            </div>
                        </div>
                    ) : (
                        <>
                            <section className="tagm-sec">
                                <div className="tagm-sec-label">
                                    已选 · {selectedTags.length}
                                </div>
                                <div
                                    className="tagm-chips"
                                    data-sot-list="recording-selected-tags"
                                    data-sot-state={
                                        selectedTags.length > 0
                                            ? "ready"
                                            : "empty"
                                    }
                                >
                                    {selectedTags.map((tag) => {
                                        const catalogTag =
                                            tagDetailsById.get(tag.id) ?? tag;

                                        return (
                                            <span
                                                key={tag.id}
                                                className={`tagm-sel-chip ${recordingTagSotColorClassName[tag.color]}`}
                                                data-sot-tag-color={tag.color}
                                                data-sot-tag-icon={tag.icon}
                                                data-sot-tag-id={tag.id}
                                                data-sot-tag-name={tag.name}
                                            >
                                                <RecordingTagIconGlyph
                                                    icon={tag.icon}
                                                    variant="manager"
                                                />
                                                {tag.name}
                                                <button
                                                    type="button"
                                                    className="x"
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
                                                        setShowToggleState(
                                                            false,
                                                        );
                                                        setDeleteTarget(
                                                            catalogTag,
                                                        );
                                                    }}
                                                >
                                                    <TagManagerXIcon />
                                                </button>
                                            </span>
                                        );
                                    })}
                                </div>
                            </section>

                            <section className="tagm-sec">
                                <div className="tagm-sec-label">全部标签</div>
                                <div
                                    className="tagm-opts"
                                    data-sot-list="recording-available-tags"
                                    data-sot-state="ready"
                                >
                                    {sortedTags.map((tag, index) => {
                                        const selected = selectedTagIds.has(
                                            tag.id,
                                        );
                                        const saving = savingTagId === tag.id;

                                        return (
                                            <Fragment key={tag.id}>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        void handleToggleTag(
                                                            tag,
                                                        )
                                                    }
                                                    disabled={busy}
                                                    aria-pressed={selected}
                                                    aria-busy={
                                                        saving
                                                            ? "true"
                                                            : undefined
                                                    }
                                                    data-busy={
                                                        saving
                                                            ? "true"
                                                            : "false"
                                                    }
                                                    data-sot-control="recording-tag-toggle"
                                                    data-sot-state={
                                                        saving
                                                            ? "saving"
                                                            : selected
                                                              ? "selected"
                                                              : "idle"
                                                    }
                                                    data-sot-tag-color={
                                                        tag.color
                                                    }
                                                    data-sot-tag-icon={tag.icon}
                                                    data-sot-tag-id={tag.id}
                                                    data-sot-tag-name={tag.name}
                                                    className={`tagm-opt ${recordingTagSotColorClassName[tag.color]}`}
                                                >
                                                    {saving ? (
                                                        <span
                                                            className="btn-spinner"
                                                            aria-hidden="true"
                                                        />
                                                    ) : (
                                                        <RecordingTagIconGlyph
                                                            icon={tag.icon}
                                                            variant="manager"
                                                        />
                                                    )}
                                                    {tag.name}
                                                </button>
                                                {index < sortedTags.length - 1
                                                    ? " "
                                                    : null}
                                            </Fragment>
                                        );
                                    })}
                                </div>
                            </section>
                        </>
                    )}

                    {visibleError ? (
                        <div
                            className="tagm-error"
                            data-sot-panel="recording-tag-error"
                            data-sot-state="error"
                            role="alert"
                        >
                            <TagManagerAlertIcon />
                            <span>{visibleError}</span>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                data-sot-control="recording-tag-error-retry"
                                onClick={() => setOperationError(null)}
                            >
                                重试
                            </Button>
                        </div>
                    ) : null}

                    <div className="tagm-create">
                        <div className="tagm-create-row">
                            <Input
                                type="text"
                                value={name}
                                maxLength={MAX_RECORDING_TAG_NAME_LENGTH}
                                data-sot-control="recording-tag-name"
                                onChange={(event) => {
                                    setShowToggleState(false);
                                    setName(
                                        Array.from(event.target.value)
                                            .slice(
                                                0,
                                                MAX_RECORDING_TAG_NAME_LENGTH,
                                            )
                                            .join(""),
                                    );
                                }}
                                placeholder="新建标签…"
                            />
                            <button
                                type="button"
                                aria-label="添加"
                                className="tagm-add-btn"
                                data-sot-control="recording-tag-create"
                                data-sot-state="idle"
                            >
                                +
                            </button>
                        </div>
                        {hasNoTags ? null : (
                            <div className="tagm-meta-row">
                                <div className="tagm-swatches">
                                    {QUICK_RECORDING_TAG_COLORS.map((item) => (
                                        <button
                                            key={item}
                                            type="button"
                                            onClick={() => setColor(item)}
                                            aria-label={
                                                recordingTagSotColorLabel[item]
                                            }
                                            aria-pressed={color === item}
                                            data-sot-control="recording-tag-color"
                                            data-sot-state={
                                                color === item
                                                    ? "selected"
                                                    : "idle"
                                            }
                                            data-sot-tag-color={item}
                                            className={`tagm-swatch ${recordingTagSotColorClassName[item]}${
                                                color === item
                                                    ? " is-selected"
                                                    : ""
                                            }`}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
