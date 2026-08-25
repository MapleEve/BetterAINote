"use client";

import { LoaderCircle, Pencil, Plus, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
    MAX_RECORDING_TAG_NAME_LENGTH,
    RECORDING_TAG_COLORS,
    RECORDING_TAG_ICONS,
    type RecordingTag,
    type RecordingTagColor,
    type RecordingTagIcon,
} from "@/lib/recording-tags";
import type { Recording } from "@/types/recording";
import { RecordingTagIconGlyph } from "./recording-tag-visuals";

interface RecordingTagManagerProps {
    recording: Recording;
    availableTags: RecordingTag[];
    onAvailableTagsChange: (tags: RecordingTag[]) => void;
    onRecordingTagsChange: (recordingId: string, tags: RecordingTag[]) => void;
    loadError?: string | null;
    onClose?: () => void;
}

type TagPayload = Pick<RecordingTag, "color" | "icon" | "name">;
type AssignmentPayload = { tagIds: string[]; tags: RecordingTag[] };
type RetryAction =
    | { payload: AssignmentPayload; type: "assignment" }
    | { payload: TagPayload; type: "create" }
    | { payload: TagPayload; tag: RecordingTag; type: "update" }
    | { tag: RecordingTag; type: "delete" };

async function readJsonResponse(response: Response, fallback: string) {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(fallback);
    }
    return data;
}

function toErrorMessage(error: unknown, fallback: string) {
    return error instanceof Error && error.message ? error.message : fallback;
}

export function RecordingTagManager({
    recording,
    availableTags,
    loadError,
    onAvailableTagsChange,
    onRecordingTagsChange,
    onClose,
}: RecordingTagManagerProps) {
    const { t } = useLanguage();
    const [createName, setCreateName] = useState("");
    const [createColor, setCreateColor] = useState<RecordingTagColor>("purple");
    const [createIcon, setCreateIcon] = useState<RecordingTagIcon>("tag");
    const [editingTagId, setEditingTagId] = useState<string | null>(null);
    const [editName, setEditName] = useState("");
    const [editColor, setEditColor] = useState<RecordingTagColor>("purple");
    const [editIcon, setEditIcon] = useState<RecordingTagIcon>("tag");
    const [pending, setPending] = useState<string | null>(null);
    const [operationError, setOperationError] = useState<string | null>(null);
    const [retryAction, setRetryAction] = useState<RetryAction | null>(null);
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<RecordingTag | null>(null);

    const selectedTagIds = useMemo(
        () => new Set(recording.tags.map((tag) => tag.id)),
        [recording.tags],
    );
    const busy = pending !== null;
    const visibleError = operationError ?? loadError ?? null;

    const updateCatalog = (tag: RecordingTag) => {
        onAvailableTagsChange([
            tag,
            ...availableTags.filter((item) => item.id !== tag.id),
        ]);
    };

    const updateAssignments = async (payload: AssignmentPayload) => {
        const response = await fetch(`/api/recordings/${recording.id}/tags`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tagIds: payload.tagIds }),
        });
        const data = await readJsonResponse(
            response,
            t("recordingTagManager.assignmentFailed"),
        );
        const tags = Array.isArray(data.tags) ? data.tags : payload.tags;
        onRecordingTagsChange(recording.id, tags);
    };

    const runAssignment = async (payload: AssignmentPayload) => {
        if (busy) return;
        setPending("assignment");
        setOperationError(null);
        setRetryAction(null);
        try {
            await updateAssignments(payload);
        } catch (error) {
            setOperationError(
                toErrorMessage(
                    error,
                    t("recordingTagManager.assignmentFailed"),
                ),
            );
            setRetryAction({ payload, type: "assignment" });
        } finally {
            setPending(null);
        }
    };

    const toggleTag = (tag: RecordingTag) => {
        const nextTags = selectedTagIds.has(tag.id)
            ? recording.tags.filter((item) => item.id !== tag.id)
            : [...recording.tags, tag];
        void runAssignment({
            tagIds: nextTags.map((item) => item.id),
            tags: nextTags,
        });
    };

    const createTag = async (payload: TagPayload) => {
        if (busy || !payload.name.trim()) return;
        setPending("create");
        setOperationError(null);
        setRetryAction(null);
        try {
            const response = await fetch("/api/recording-tags", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await readJsonResponse(
                response,
                t("recordingTagManager.createFailed"),
            );
            const tag = data.tag as RecordingTag;
            updateCatalog(tag);
            const nextTags = [...recording.tags, tag];
            await updateAssignments({
                tagIds: nextTags.map((item) => item.id),
                tags: nextTags,
            });
            setCreateName("");
            setCreateDialogOpen(false);
        } catch (error) {
            setOperationError(
                toErrorMessage(error, t("recordingTagManager.createFailed")),
            );
            setRetryAction({ payload, type: "create" });
        } finally {
            setPending(null);
        }
    };

    const updateTag = async (tag: RecordingTag, payload: TagPayload) => {
        if (busy || !payload.name.trim()) return;
        setPending(`update-${tag.id}`);
        setOperationError(null);
        setRetryAction(null);
        try {
            const response = await fetch(`/api/recording-tags/${tag.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await readJsonResponse(
                response,
                t("recordingTagManager.updateFailed"),
            );
            const updatedTag = data.tag as RecordingTag;
            updateCatalog(updatedTag);
            onRecordingTagsChange(
                recording.id,
                recording.tags.map((item) =>
                    item.id === updatedTag.id ? updatedTag : item,
                ),
            );
            setEditingTagId(null);
        } catch (error) {
            setOperationError(
                toErrorMessage(error, t("recordingTagManager.updateFailed")),
            );
            setRetryAction({ payload, tag, type: "update" });
        } finally {
            setPending(null);
        }
    };

    const deleteTag = async (tag: RecordingTag) => {
        if (busy) return;
        setPending(`delete-${tag.id}`);
        setOperationError(null);
        setRetryAction(null);
        try {
            const response = await fetch(`/api/recording-tags/${tag.id}`, {
                method: "DELETE",
            });
            await readJsonResponse(
                response,
                t("recordingTagManager.deleteFailed"),
            );
            onAvailableTagsChange(
                availableTags.filter((item) => item.id !== tag.id),
            );
            onRecordingTagsChange(
                recording.id,
                recording.tags.filter((item) => item.id !== tag.id),
            );
            setEditingTagId(null);
        } catch (error) {
            setOperationError(
                toErrorMessage(error, t("recordingTagManager.deleteFailed")),
            );
            setRetryAction({ tag, type: "delete" });
        } finally {
            setPending(null);
        }
    };

    const confirmDelete = () => {
        if (!deleteTarget || busy) return;
        const tag = deleteTarget;
        setDeleteTarget(null);
        void deleteTag(tag);
    };

    const retry = () => {
        if (!retryAction) return;
        if (retryAction.type === "assignment") {
            void runAssignment(retryAction.payload);
        } else if (retryAction.type === "create") {
            void createTag(retryAction.payload);
        } else if (retryAction.type === "update") {
            void updateTag(retryAction.tag, retryAction.payload);
        } else {
            void deleteTag(retryAction.tag);
        }
    };

    const startEdit = (tag: RecordingTag) => {
        setEditingTagId(tag.id);
        setEditName(tag.name);
        setEditColor(tag.color);
        setEditIcon(tag.icon);
        setOperationError(null);
        setRetryAction(null);
    };

    const closeCreateDialog = () => {
        if (busy) return;
        setCreateDialogOpen(false);
        setCreateName("");
        setOperationError(null);
        setRetryAction(null);
    };

    const renderError = () =>
        visibleError ? (
            <Alert role="alert" variant="destructive">
                <AlertTitle>
                    {t("recordingTagManager.operationFailed")}
                </AlertTitle>
                <AlertDescription className="flex flex-wrap items-center gap-3">
                    <span>{visibleError}</span>
                    {retryAction ? (
                        <Button
                            disabled={busy}
                            onClick={retry}
                            size="sm"
                            type="button"
                            variant="outline"
                        >
                            {t("recordingTagManager.retry")}
                        </Button>
                    ) : null}
                </AlertDescription>
            </Alert>
        ) : null;

    const renderPicker = ({
        color,
        icon,
        onColorChange,
        onIconChange,
        prefix,
    }: {
        color: RecordingTagColor;
        icon: RecordingTagIcon;
        onColorChange: (value: RecordingTagColor) => void;
        onIconChange: (value: RecordingTagIcon) => void;
        prefix: string;
    }) => (
        <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
                <Label id={`${prefix}-color-label`}>
                    {t("recordingTagManager.color")}
                </Label>
                <ToggleGroup
                    aria-labelledby={`${prefix}-color-label`}
                    disabled={busy}
                    onValueChange={(value) => {
                        if (
                            RECORDING_TAG_COLORS.includes(
                                value as RecordingTagColor,
                            )
                        ) {
                            onColorChange(value as RecordingTagColor);
                        }
                    }}
                    size="sm"
                    type="single"
                    value={color}
                    variant="outline"
                >
                    {RECORDING_TAG_COLORS.map((item) => (
                        <ToggleGroupItem
                            aria-label={t(`recordingTagManager.colors.${item}`)}
                            key={item}
                            value={item}
                        >
                            {t(`recordingTagManager.colors.${item}`)}
                        </ToggleGroupItem>
                    ))}
                </ToggleGroup>
            </div>
            <div className="grid gap-2">
                <Label id={`${prefix}-icon-label`}>
                    {t("recordingTagManager.icon")}
                </Label>
                <ToggleGroup
                    aria-labelledby={`${prefix}-icon-label`}
                    disabled={busy}
                    layout="iconGrid"
                    onValueChange={(value) => {
                        if (
                            RECORDING_TAG_ICONS.includes(
                                value as RecordingTagIcon,
                            )
                        ) {
                            onIconChange(value as RecordingTagIcon);
                        }
                    }}
                    size="sm"
                    spacing={1}
                    type="single"
                    value={icon}
                    variant="outline"
                >
                    {RECORDING_TAG_ICONS.map((item) => (
                        <ToggleGroupItem
                            aria-label={t(`recordingTagManager.icons.${item}`)}
                            key={item}
                            value={item}
                        >
                            <RecordingTagIconGlyph icon={item} />
                        </ToggleGroupItem>
                    ))}
                </ToggleGroup>
            </div>
        </div>
    );

    return (
        <>
            <Card
                aria-busy={busy || undefined}
                className="w-full max-w-xl"
                data-control="recording-tag-manager"
                data-state={visibleError ? "error" : busy ? "saving" : "ready"}
            >
                <CardHeader className="flex flex-row items-center justify-between gap-4">
                    <CardTitle className="text-base">
                        {t("recordingTagManager.manageTitle")}
                    </CardTitle>
                    {onClose ? (
                        <Button
                            aria-label={t("recordingTagManager.close")}
                            disabled={busy}
                            onClick={onClose}
                            size="icon-sm"
                            type="button"
                            variant="ghost"
                        >
                            <X />
                        </Button>
                    ) : null}
                </CardHeader>
                <CardContent className="grid gap-5">
                    {!createDialogOpen ? renderError() : null}

                    <section
                        aria-labelledby="recording-tags-title"
                        className="grid gap-3"
                    >
                        <div className="flex items-center justify-between gap-3">
                            <Label id="recording-tags-title">
                                {t("recordingTagManager.currentTags")}
                            </Label>
                            <span className="text-sm text-muted-foreground">
                                {t("recordingTagManager.tagCount", {
                                    count: recording.tags.length,
                                })}
                            </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {availableTags.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    {t("recordingTagManager.empty")}
                                </p>
                            ) : (
                                availableTags.map((tag) => {
                                    const selected = selectedTagIds.has(tag.id);
                                    return (
                                        <Button
                                            aria-pressed={selected}
                                            data-control="recording-tag-toggle"
                                            data-tag-id={tag.id}
                                            disabled={busy}
                                            key={tag.id}
                                            onClick={() => toggleTag(tag)}
                                            size="sm"
                                            type="button"
                                            variant={
                                                selected
                                                    ? "secondary"
                                                    : "outline"
                                            }
                                        >
                                            {pending === "assignment" ? (
                                                <LoaderCircle className="animate-spin" />
                                            ) : (
                                                <RecordingTagIconGlyph
                                                    icon={tag.icon}
                                                />
                                            )}
                                            {tag.name}
                                        </Button>
                                    );
                                })
                            )}
                        </div>
                    </section>

                    <Separator />

                    <section
                        aria-labelledby="recording-tag-catalog-title"
                        className="grid gap-3"
                    >
                        <Label id="recording-tag-catalog-title">
                            {t("recordingTagManager.catalog")}
                        </Label>
                        <div className="grid gap-2">
                            {availableTags.map((tag) =>
                                editingTagId === tag.id ? (
                                    <div
                                        className="grid gap-3 rounded-md border p-3"
                                        key={tag.id}
                                    >
                                        <Input
                                            aria-label={t(
                                                "recordingTagManager.rename",
                                            )}
                                            disabled={busy}
                                            maxLength={
                                                MAX_RECORDING_TAG_NAME_LENGTH
                                            }
                                            onChange={(event) =>
                                                setEditName(event.target.value)
                                            }
                                            value={editName}
                                        />
                                        {renderPicker({
                                            color: editColor,
                                            icon: editIcon,
                                            onColorChange: setEditColor,
                                            onIconChange: setEditIcon,
                                            prefix: `edit-${tag.id}`,
                                        })}
                                        <div className="flex flex-wrap justify-end gap-2">
                                            <Button
                                                disabled={busy}
                                                onClick={() =>
                                                    setEditingTagId(null)
                                                }
                                                size="sm"
                                                type="button"
                                                variant="ghost"
                                            >
                                                {t(
                                                    "recordingTagManager.cancel",
                                                )}
                                            </Button>
                                            <Button
                                                disabled={
                                                    !editName.trim() || busy
                                                }
                                                onClick={() =>
                                                    void updateTag(tag, {
                                                        color: editColor,
                                                        icon: editIcon,
                                                        name: editName.trim(),
                                                    })
                                                }
                                                size="sm"
                                                type="button"
                                            >
                                                {pending ===
                                                `update-${tag.id}` ? (
                                                    <LoaderCircle className="animate-spin" />
                                                ) : null}
                                                {t("recordingTagManager.save")}
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div
                                        className="flex items-center justify-between gap-3 rounded-md border p-3"
                                        key={tag.id}
                                    >
                                        <div className="flex min-w-0 items-center gap-2">
                                            <RecordingTagIconGlyph
                                                icon={tag.icon}
                                            />
                                            <span className="truncate font-medium">
                                                {tag.name}
                                            </span>
                                            <span className="text-sm text-muted-foreground">
                                                {t(
                                                    "recordingTagManager.recordingCount",
                                                    {
                                                        count:
                                                            tag.recordingCount ??
                                                            0,
                                                    },
                                                )}
                                            </span>
                                        </div>
                                        <div className="flex shrink-0 gap-1">
                                            <Button
                                                aria-label={t(
                                                    "recordingTagManager.editTag",
                                                    { name: tag.name },
                                                )}
                                                disabled={busy}
                                                onClick={() => startEdit(tag)}
                                                size="icon-sm"
                                                type="button"
                                                variant="ghost"
                                            >
                                                <Pencil />
                                            </Button>
                                            <Button
                                                aria-label={t(
                                                    "recordingTagManager.deleteTagAria",
                                                    { name: tag.name },
                                                )}
                                                disabled={busy}
                                                onClick={() =>
                                                    setDeleteTarget(tag)
                                                }
                                                size="icon-sm"
                                                type="button"
                                                variant="ghost"
                                            >
                                                <Trash2 />
                                            </Button>
                                        </div>
                                    </div>
                                ),
                            )}
                        </div>
                    </section>
                </CardContent>
                <CardFooter className="border-t pt-5">
                    <Dialog
                        onOpenChange={(open) => {
                            if (open) {
                                setDeleteTarget(null);
                                setOperationError(null);
                                setRetryAction(null);
                                setCreateDialogOpen(true);
                                return;
                            }
                            closeCreateDialog();
                        }}
                        open={createDialogOpen}
                    >
                        <DialogTrigger asChild>
                            <Button
                                data-control="recording-tag-create"
                                type="button"
                            >
                                <Plus />
                                {t("recordingTagManager.newTag")}
                            </Button>
                        </DialogTrigger>
                        <DialogContent aria-describedby="recording-tag-create-description">
                            <DialogHeader>
                                <DialogTitle>
                                    {t("recordingTagManager.newTag")}
                                </DialogTitle>
                                <DialogDescription id="recording-tag-create-description">
                                    {t("recordingTagManager.newTagDescription")}
                                </DialogDescription>
                            </DialogHeader>
                            <form
                                className="grid gap-5"
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    void createTag({
                                        color: createColor,
                                        icon: createIcon,
                                        name: createName.trim(),
                                    });
                                }}
                            >
                                {renderError()}
                                <div className="grid gap-2">
                                    <Label htmlFor="recording-tag-create-name">
                                        {t("recordingTagManager.name")}
                                    </Label>
                                    <Input
                                        autoFocus
                                        disabled={busy}
                                        id="recording-tag-create-name"
                                        maxLength={
                                            MAX_RECORDING_TAG_NAME_LENGTH
                                        }
                                        onChange={(event) =>
                                            setCreateName(event.target.value)
                                        }
                                        placeholder={t(
                                            "recordingTagManager.namePlaceholder",
                                        )}
                                        value={createName}
                                    />
                                </div>
                                {renderPicker({
                                    color: createColor,
                                    icon: createIcon,
                                    onColorChange: setCreateColor,
                                    onIconChange: setCreateIcon,
                                    prefix: "create",
                                })}
                                <DialogFooter>
                                    <Button
                                        disabled={busy}
                                        onClick={closeCreateDialog}
                                        type="button"
                                        variant="outline"
                                    >
                                        {t("recordingTagManager.cancel")}
                                    </Button>
                                    <Button
                                        disabled={!createName.trim() || busy}
                                        type="submit"
                                    >
                                        {pending === "create" ? (
                                            <LoaderCircle className="animate-spin" />
                                        ) : (
                                            <Plus />
                                        )}
                                        {t("recordingTagManager.createTag")}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </CardFooter>
            </Card>
            <Dialog
                open={Boolean(deleteTarget)}
                onOpenChange={(open) => {
                    if (!open) {
                        setDeleteTarget(null);
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {t("recordingTagManager.deleteTitle")}
                        </DialogTitle>
                        <DialogDescription>
                            {deleteTarget
                                ? t("recordingTagManager.deleteDescription", {
                                      name: deleteTarget.name,
                                  })
                                : ""}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            onClick={() => setDeleteTarget(null)}
                            type="button"
                            variant="outline"
                        >
                            {t("recordingTagManager.cancel")}
                        </Button>
                        <Button
                            disabled={busy}
                            onClick={confirmDelete}
                            type="button"
                            variant="destructive"
                        >
                            {t("recordingTagManager.deleteConfirm")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
