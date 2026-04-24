"use client";

import { Clock, CloudOff, HardDrive, Play } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { Card, CardContent } from "@/components/ui/card";
import { useDisplaySettingsStore } from "@/features/settings/display-settings-store";
import { getUpstreamDeletedLabel } from "@/lib/data-sources/presentation";
import { formatDateTime } from "@/lib/format-date";
import { cn } from "@/lib/utils";
import type { Recording } from "@/types/recording";

interface RecordingListProps {
    recordings: Recording[];
    currentRecording: Recording | null;
    onSelect: (recording: Recording) => void;
}

export function RecordingList({
    recordings,
    currentRecording,
    onSelect,
}: RecordingListProps) {
    const { language, t } = useLanguage();
    const {
        settings: { dateTimeFormat, recordingListSortOrder, itemsPerPage },
    } = useDisplaySettingsStore();
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        const nextTotalPages = Math.max(
            1,
            Math.ceil(recordings.length / itemsPerPage),
        );
        setCurrentPage((page) => Math.min(page, nextTotalPages));
    }, [itemsPerPage, recordings.length]);

    const sortedAndPaginatedRecordings = useMemo(() => {
        const sorted = [...recordings];

        switch (recordingListSortOrder) {
            case "newest":
                sorted.sort(
                    (a, b) =>
                        new Date(b.startTime).getTime() -
                        new Date(a.startTime).getTime(),
                );
                break;
            case "oldest":
                sorted.sort(
                    (a, b) =>
                        new Date(a.startTime).getTime() -
                        new Date(b.startTime).getTime(),
                );
                break;
            case "name":
                sorted.sort((a, b) => a.filename.localeCompare(b.filename));
                break;
        }

        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        return sorted.slice(startIndex, endIndex);
    }, [currentPage, itemsPerPage, recordingListSortOrder, recordings]);

    const totalPages = Math.max(1, Math.ceil(recordings.length / itemsPerPage));

    const formatDuration = (ms: number) => {
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    };

    return (
        <Card hasNoPadding>
            <CardContent className="p-0">
                <div className="divide-y">
                    {sortedAndPaginatedRecordings.map((recording) => {
                        const isSelected =
                            currentRecording?.id === recording.id;

                        return (
                            <button
                                key={recording.id}
                                type="button"
                                onClick={() => onSelect(recording)}
                                className={cn(
                                    "w-full p-4 text-left transition-colors hover:bg-accent",
                                    isSelected && "bg-accent",
                                )}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="mb-1 flex items-center gap-2">
                                            <Play className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                                            <h3 className="truncate font-medium">
                                                {recording.filename}
                                            </h3>
                                            {recording.upstreamDeleted && (
                                                <span
                                                    className="inline-flex shrink-0 items-center gap-1 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-400"
                                                    title={getUpstreamDeletedLabel(
                                                        language,
                                                    )}
                                                >
                                                    <CloudOff className="h-2.5 w-2.5" />
                                                    {t("dashboard.localOnly")}
                                                </span>
                                            )}
                                        </div>

                                        <div className="ml-6 flex items-center gap-4 text-sm text-muted-foreground">
                                            <div className="flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                <span>
                                                    {formatDuration(
                                                        recording.duration,
                                                    )}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <HardDrive className="h-3 w-3" />
                                                <span>
                                                    {(
                                                        recording.filesize /
                                                        (1024 * 1024)
                                                    ).toFixed(1)}{" "}
                                                    MB
                                                </span>
                                            </div>
                                        </div>

                                        <p className="ml-6 mt-1 text-xs text-muted-foreground">
                                            {formatDateTime(
                                                recording.startTime,
                                                dateTimeFormat,
                                                language,
                                            )}
                                        </p>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>

                {totalPages > 1 && (
                    <div className="flex items-center justify-between border-t p-4">
                        <button
                            type="button"
                            onClick={() =>
                                setCurrentPage((page) => Math.max(1, page - 1))
                            }
                            disabled={currentPage === 1}
                            className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
                        >
                            Previous
                        </button>
                        <span className="text-sm text-muted-foreground">
                            Page {currentPage} of {totalPages}
                        </span>
                        <button
                            type="button"
                            onClick={() =>
                                setCurrentPage((page) =>
                                    Math.min(totalPages, page + 1),
                                )
                            }
                            disabled={currentPage === totalPages}
                            className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
                        >
                            Next
                        </button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
