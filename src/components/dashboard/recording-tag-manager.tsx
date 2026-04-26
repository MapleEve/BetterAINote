"use client";

import { Loader2, Plus } from "lucide-react";
import { useMemo, useState } from "react";
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
import { cn } from "@/lib/utils";
import type { Recording } from "@/types/recording";
import {
    RecordingTagChip,
    RecordingTagIconGlyph,
    recordingTagColorClassName,
    recordingTagDotClassName,
} from "./recording-tag-visuals";

interface RecordingTagManagerProps {
    recording: Recording;
    availableTags: RecordingTag[];
    onAvailableTagsChange: (tags: RecordingTag[]) => void;
    onRecordingTagsChange: (recordingId: string, tags: RecordingTag[]) => void;
    variant?: "inline" | "popover";
    className?: string;
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

export function RecordingTagManager({
    recording,
    availableTags,
    onAvailableTagsChange,
    onRecordingTagsChange,
    variant = "inline",
    className,
}: RecordingTagManagerProps) {
    const { language } = useLanguage();
    const [name, setName] = useState("");
    const [color, setColor] = useState<RecordingTagColor>("orange");
    const [icon, setIcon] = useState<RecordingTagIcon>("tag");
    const [savingTagId, setSavingTagId] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    const selectedTagIds = useMemo(
        () => new Set(recording.tags.map((tag) => tag.id)),
        [recording.tags],
    );

    const sortedTags = useMemo(
        () => [...availableTags].sort((a, b) => a.name.localeCompare(b.name)),
        [availableTags],
    );
    const isPopover = variant === "popover";

    const upsertAvailableTag = (tag: RecordingTag) => {
        onAvailableTagsChange(
            [tag, ...availableTags.filter((item) => item.id !== tag.id)].sort(
                (a, b) => a.name.localeCompare(b.name),
            ),
        );
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
        setSavingTagId(tag.id);
        try {
            const nextTags = selectedTagIds.has(tag.id)
                ? recording.tags.filter((item) => item.id !== tag.id)
                : [...recording.tags, tag];
            await updateRecordingTags(nextTags);
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : language === "zh-CN"
                      ? "标签保存失败"
                      : "Failed to save tag",
            );
        } finally {
            setSavingTagId(null);
        }
    };

    const handleCreateTag = async () => {
        const nextName = name.trim();
        if (!nextName) {
            return;
        }

        setIsCreating(true);
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
            toast.error(
                error instanceof Error
                    ? error.message
                    : language === "zh-CN"
                      ? "标签创建失败"
                      : "Failed to create tag",
            );
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <div
            className={cn(
                "rounded-2xl border border-border/55 bg-card/35 p-3 backdrop-blur-xl",
                isPopover && "border-0 bg-transparent p-0 backdrop-blur-0",
                className,
            )}
        >
            <div
                className={cn(
                    "mb-3 flex items-start justify-between gap-3",
                    isPopover && "mb-2",
                )}
            >
                <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground">
                        {language === "zh-CN" ? "录音标签" : "Recording tags"}
                    </p>
                    {!isPopover ? (
                        <p className="text-[11px] text-muted-foreground">
                            {language === "zh-CN"
                                ? "图标、颜色和名称一起组成分类标签。"
                                : "Each tag combines icon, color, and name."}
                        </p>
                    ) : null}
                </div>
                <div
                    className={cn(
                        "flex max-w-[55%] flex-wrap justify-end gap-1.5",
                        isPopover &&
                            "max-w-[58%] flex-nowrap overflow-x-auto pb-1",
                    )}
                >
                    {recording.tags.length > 0 ? (
                        recording.tags.map((tag) => (
                            <RecordingTagChip key={tag.id} tag={tag} />
                        ))
                    ) : (
                        <span className="text-xs text-muted-foreground">
                            {language === "zh-CN" ? "未标记" : "Untagged"}
                        </span>
                    )}
                </div>
            </div>

            {sortedTags.length > 0 ? (
                <div
                    className={cn(
                        "mb-3 flex flex-wrap gap-2",
                        isPopover && "max-h-24 overflow-y-auto pr-1",
                    )}
                >
                    {sortedTags.map((tag) => {
                        const selected = selectedTagIds.has(tag.id);
                        const saving = savingTagId === tag.id;

                        return (
                            <button
                                key={tag.id}
                                type="button"
                                onClick={() => handleToggleTag(tag)}
                                disabled={Boolean(savingTagId) || isCreating}
                                aria-pressed={selected}
                                className={cn(
                                    "inline-flex max-w-full items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-[background-color,border-color,opacity] duration-300 ease-[var(--ease-sine)] disabled:opacity-60",
                                    isPopover && "max-w-[8.5rem]",
                                    selected
                                        ? recordingTagColorClassName[tag.color]
                                        : "border-border/65 bg-muted/20 text-muted-foreground hover:bg-muted/35",
                                )}
                            >
                                {saving ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                    <RecordingTagIconGlyph
                                        icon={tag.icon}
                                        className="h-3 w-3"
                                    />
                                )}
                                <span className="min-w-0 truncate">
                                    {tag.name}
                                </span>
                            </button>
                        );
                    })}
                </div>
            ) : null}

            <div className="grid gap-2 lg:grid-cols-[1fr_auto]">
                <Input
                    value={name}
                    maxLength={MAX_RECORDING_TAG_NAME_LENGTH}
                    onChange={(event) =>
                        setName(
                            Array.from(event.target.value)
                                .slice(0, MAX_RECORDING_TAG_NAME_LENGTH)
                                .join(""),
                        )
                    }
                    onKeyDown={(event) => {
                        if (event.key === "Enter") {
                            void handleCreateTag();
                        }
                    }}
                    placeholder={
                        language === "zh-CN"
                            ? "新标签，最多 12 字"
                            : "New tag, max 12 chars"
                    }
                    disabled={isCreating}
                />
                <Button
                    type="button"
                    variant="outline"
                    onClick={handleCreateTag}
                    disabled={!name.trim() || isCreating}
                >
                    {isCreating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Plus className="h-4 w-4" />
                    )}
                    {language === "zh-CN" ? "添加" : "Add"}
                </Button>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
                {RECORDING_TAG_COLORS.map((item) => (
                    <button
                        key={item}
                        type="button"
                        onClick={() => setColor(item)}
                        aria-pressed={color === item}
                        className={cn(
                            "h-6 w-6 rounded-full border border-white/30 transition-[border-color,box-shadow,opacity] duration-300 ease-[var(--ease-sine)]",
                            recordingTagDotClassName[item],
                            color === item &&
                                "ring-2 ring-ring/50 ring-offset-1 ring-offset-background",
                        )}
                    />
                ))}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
                {RECORDING_TAG_ICONS.map((item) => (
                    <button
                        key={item}
                        type="button"
                        onClick={() => setIcon(item)}
                        aria-pressed={icon === item}
                        className={cn(
                            "inline-flex h-8 w-8 items-center justify-center rounded-xl border text-muted-foreground transition-[background-color,border-color,color] duration-300 ease-[var(--ease-sine)]",
                            icon === item
                                ? "border-primary/55 bg-primary/18 text-foreground"
                                : "border-border/65 bg-muted/15 hover:bg-muted/35",
                        )}
                    >
                        <RecordingTagIconGlyph
                            icon={item}
                            className="h-4 w-4"
                        />
                    </button>
                ))}
            </div>
        </div>
    );
}
