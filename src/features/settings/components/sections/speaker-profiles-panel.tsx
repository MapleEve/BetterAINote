"use client";

import { AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SettingsListSkeleton } from "@/features/settings/components/settings-skeletons";
import { formatDateTime } from "@/lib/format-date";
import { cn } from "@/lib/utils";

interface SpeakerProfile {
    id: string;
    displayName: string;
    voiceprintRef: string | null;
    createdAt: string;
    updatedAt: string;
    assignmentCount: number;
}

interface RemoteVoiceprint {
    id: string;
    displayName: string;
    createdAt: string | null;
    updatedAt: string | null;
}

function formatTimestamp(value: string | null, locale: string) {
    if (!value) {
        return null;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return formatDateTime(
        date,
        "absolute",
        locale === "zh-CN" ? "zh-CN" : "en",
    );
}

function StatePill({
    children,
    tone = "neutral",
}: {
    children: ReactNode;
    tone?: "success" | "neutral" | "warning";
}) {
    return (
        <span
            className={cn(
                "inline-flex h-6 max-w-full shrink-0 items-center gap-1 rounded-full border px-2 text-[0.68rem] font-semibold whitespace-nowrap",
                tone === "success" &&
                    "border-emerald-400/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-200",
                tone === "warning" &&
                    "border-amber-400/35 bg-amber-500/15 text-amber-700 dark:text-amber-200",
                tone === "neutral" &&
                    "border-border/70 bg-background/45 text-muted-foreground",
            )}
        >
            <span className="size-1.5 rounded-full bg-current" />
            {children}
        </span>
    );
}

function PanelNotice({
    action,
    children,
    tone = "neutral",
}: {
    action?: ReactNode;
    children: ReactNode;
    tone?: "danger" | "neutral";
}) {
    const Icon = tone === "danger" ? AlertCircle : CheckCircle2;

    return (
        <div
            className={cn(
                "grid grid-cols-[1.75rem_minmax(0,1fr)] items-start gap-3 rounded-xl border border-dashed px-4 py-3 text-sm",
                tone === "danger"
                    ? "border-destructive/35 bg-destructive/10 text-destructive dark:text-red-200"
                    : "border-border/75 bg-muted/20 text-muted-foreground",
            )}
        >
            <span className="flex size-7 items-center justify-center rounded-lg border border-current/20 bg-background/35">
                <Icon className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 space-y-3">
                <p className="text-sm text-muted-foreground">{children}</p>
                {action ? <div>{action}</div> : null}
            </div>
        </div>
    );
}

export function SpeakerProfilesPanel() {
    const { language } = useLanguage();
    const isZh = language === "zh-CN";
    const confirm = useConfirmDialog();
    const locale = isZh ? "zh-CN" : "en";

    const [profiles, setProfiles] = useState<SpeakerProfile[]>([]);
    const [voiceprints, setVoiceprints] = useState<RemoteVoiceprint[]>([]);
    const [isProfilesLoading, setIsProfilesLoading] = useState(true);
    const [isVoiceprintsLoading, setIsVoiceprintsLoading] = useState(true);
    const [localSavingId, setLocalSavingId] = useState<string | null>(null);
    const [voiceprintSavingId, setVoiceprintSavingId] = useState<string | null>(
        null,
    );
    const [newName, setNewName] = useState("");
    const [voiceprintsAvailable, setVoiceprintsAvailable] = useState(false);
    const [voiceprintsReason, setVoiceprintsReason] = useState<string | null>(
        null,
    );
    const [profilesError, setProfilesError] = useState<string | null>(null);
    const [voiceprintsError, setVoiceprintsError] = useState<string | null>(
        null,
    );

    const refreshProfiles = useCallback(async () => {
        setIsProfilesLoading(true);
        setProfilesError(null);
        try {
            const response = await fetch("/api/speakers/profiles", {
                cache: "no-store",
            });
            const data = await response.json();
            if (!response.ok) {
                const message =
                    data.error ||
                    (isZh
                        ? "加载说话人档案失败"
                        : "Failed to load speaker profiles");
                setProfilesError(message);
                toast.error(message);
                return;
            }
            setProfiles(data.profiles ?? []);
        } catch {
            setProfilesError(
                isZh ? "加载说话人档案失败" : "Failed to load speaker profiles",
            );
            toast.error(
                isZh ? "加载说话人档案失败" : "Failed to load speaker profiles",
            );
        } finally {
            setIsProfilesLoading(false);
        }
    }, [isZh]);

    const refreshVoiceprints = useCallback(async () => {
        setIsVoiceprintsLoading(true);
        setVoiceprintsError(null);

        try {
            const response = await fetch("/api/voiceprints", {
                cache: "no-store",
            });
            const data = await response.json();

            if (!response.ok) {
                setVoiceprints([]);
                setVoiceprintsAvailable(false);
                setVoiceprintsReason(null);
                setVoiceprintsError(
                    data.error ||
                        (isZh
                            ? "加载远端声纹失败"
                            : "Failed to load remote voiceprints"),
                );
                toast.error(
                    data.error ||
                        (isZh
                            ? "加载远端声纹失败"
                            : "Failed to load remote voiceprints"),
                );
                return;
            }

            setVoiceprints(data.voiceprints ?? []);
            setVoiceprintsAvailable(Boolean(data.available));
            setVoiceprintsReason(
                typeof data.reason === "string" ? data.reason : null,
            );
        } catch {
            setVoiceprints([]);
            setVoiceprintsAvailable(false);
            setVoiceprintsReason(null);
            setVoiceprintsError(
                isZh ? "加载远端声纹失败" : "Failed to load remote voiceprints",
            );
            toast.error(
                isZh ? "加载远端声纹失败" : "Failed to load remote voiceprints",
            );
        } finally {
            setIsVoiceprintsLoading(false);
        }
    }, [isZh]);

    useEffect(() => {
        void Promise.all([refreshProfiles(), refreshVoiceprints()]);
    }, [refreshProfiles, refreshVoiceprints]);

    const handleCreate = useCallback(async () => {
        const displayName = newName.trim();
        if (!displayName) {
            toast.error(
                isZh ? "必须填写说话人名称" : "Speaker name is required",
            );
            return;
        }

        setLocalSavingId("new");
        try {
            const response = await fetch("/api/speakers/profiles", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    displayName,
                }),
            });
            const data = await response.json();
            if (!response.ok) {
                toast.error(
                    data.error ||
                        (isZh
                            ? "创建说话人档案失败"
                            : "Failed to create speaker profile"),
                );
                return;
            }

            setNewName("");
            await refreshProfiles();
            toast.success(
                isZh ? "说话人档案已创建" : "Speaker profile created",
            );
        } catch {
            toast.error(
                isZh
                    ? "创建说话人档案失败"
                    : "Failed to create speaker profile",
            );
        } finally {
            setLocalSavingId(null);
        }
    }, [isZh, newName, refreshProfiles]);

    const handleUpdate = useCallback(
        async (profile: SpeakerProfile) => {
            const displayName = profile.displayName.trim();
            if (!displayName) {
                toast.error(
                    isZh ? "必须填写说话人名称" : "Speaker name is required",
                );
                return;
            }

            setLocalSavingId(profile.id);
            try {
                const response = await fetch(
                    `/api/speakers/profiles/${profile.id}`,
                    {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ displayName }),
                    },
                );
                const data = await response.json();
                if (!response.ok) {
                    toast.error(
                        data.error ||
                            (isZh
                                ? "更新说话人档案失败"
                                : "Failed to update speaker profile"),
                    );
                    return;
                }
                await refreshProfiles();
                toast.success(
                    isZh ? "说话人档案已更新" : "Speaker profile updated",
                );
            } catch {
                toast.error(
                    isZh
                        ? "更新说话人档案失败"
                        : "Failed to update speaker profile",
                );
            } finally {
                setLocalSavingId(null);
            }
        },
        [isZh, refreshProfiles],
    );

    const handleDelete = useCallback(
        async (profile: SpeakerProfile) => {
            const confirmed = await confirm({
                title: isZh ? "确认操作" : "Confirm action",
                description: isZh
                    ? `确定删除说话人“${profile.displayName}”吗？已有录音中的说话人标注不会自动重写。`
                    : `Delete speaker "${profile.displayName}"? Existing recording speaker labels will not be rewritten automatically.`,
                confirmLabel: isZh ? "确认" : "Confirm",
                cancelLabel: isZh ? "取消" : "Cancel",
                variant: "destructive",
            });
            if (!confirmed) {
                return;
            }

            setLocalSavingId(profile.id);
            try {
                const response = await fetch(
                    `/api/speakers/profiles/${profile.id}`,
                    {
                        method: "DELETE",
                    },
                );
                const data = await response.json();
                if (!response.ok) {
                    toast.error(
                        data.error ||
                            (isZh
                                ? "删除说话人档案失败"
                                : "Failed to delete speaker profile"),
                    );
                    return;
                }
                await refreshProfiles();
                toast.success(
                    isZh ? "说话人档案已删除" : "Speaker profile deleted",
                );
            } catch {
                toast.error(
                    isZh
                        ? "删除说话人档案失败"
                        : "Failed to delete speaker profile",
                );
            } finally {
                setLocalSavingId(null);
            }
        },
        [confirm, isZh, refreshProfiles],
    );

    const handleRenameVoiceprint = useCallback(
        async (voiceprint: RemoteVoiceprint) => {
            const displayName = voiceprint.displayName.trim();
            if (!displayName) {
                toast.error(
                    isZh ? "必须填写声纹名称" : "Voiceprint name is required",
                );
                return;
            }

            setVoiceprintSavingId(voiceprint.id);
            try {
                const response = await fetch(
                    `/api/voiceprints/${voiceprint.id}`,
                    {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ displayName }),
                    },
                );
                const data = await response.json();
                if (!response.ok) {
                    toast.error(
                        data.error ||
                            (isZh
                                ? "重命名远端声纹失败"
                                : "Failed to rename remote voiceprint"),
                    );
                    return;
                }

                await refreshVoiceprints();
                toast.success(
                    isZh ? "远端声纹已重命名" : "Remote voiceprint renamed",
                );
            } catch {
                toast.error(
                    isZh
                        ? "重命名远端声纹失败"
                        : "Failed to rename remote voiceprint",
                );
            } finally {
                setVoiceprintSavingId(null);
            }
        },
        [isZh, refreshVoiceprints],
    );

    const handleDeleteVoiceprint = useCallback(
        async (voiceprint: RemoteVoiceprint) => {
            const confirmed = await confirm({
                title: isZh ? "确认操作" : "Confirm action",
                description: isZh
                    ? `确定删除远端声纹“${voiceprint.displayName}”吗？本地说话人档案不会自动同步修改。`
                    : `Delete remote voiceprint "${voiceprint.displayName}"? Local speaker profiles will not be changed automatically.`,
                confirmLabel: isZh ? "确认" : "Confirm",
                cancelLabel: isZh ? "取消" : "Cancel",
                variant: "destructive",
            });
            if (!confirmed) {
                return;
            }

            setVoiceprintSavingId(voiceprint.id);
            try {
                const response = await fetch(
                    `/api/voiceprints/${voiceprint.id}`,
                    {
                        method: "DELETE",
                    },
                );
                const data = await response.json();
                if (!response.ok) {
                    toast.error(
                        data.error ||
                            (isZh
                                ? "删除远端声纹失败"
                                : "Failed to delete remote voiceprint"),
                    );
                    return;
                }

                await refreshVoiceprints();
                toast.success(
                    isZh ? "远端声纹已删除" : "Remote voiceprint deleted",
                );
            } catch {
                toast.error(
                    isZh
                        ? "删除远端声纹失败"
                        : "Failed to delete remote voiceprint",
                );
            } finally {
                setVoiceprintSavingId(null);
            }
        },
        [confirm, isZh, refreshVoiceprints],
    );

    const profilesState = isProfilesLoading
        ? "loading"
        : profilesError
          ? "error"
          : profiles.length === 0
            ? "empty"
            : "ready";
    const voiceprintsState = isVoiceprintsLoading
        ? "loading"
        : voiceprintsError
          ? "error"
          : !voiceprintsAvailable
            ? "disabled"
            : voiceprints.length === 0
              ? "empty"
              : "ready";

    return (
        <div
            className="flex min-h-0 flex-col gap-5 rounded-2xl border border-border/75 bg-background/25 p-4"
            data-speaker-profiles-panel=""
        >
            <div
                className="flex min-h-0 flex-col gap-4"
                data-profiles-state={profilesState}
            >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                        <p className="text-sm font-medium">
                            {isZh ? "已保存的说话人" : "Saved Speakers"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            {isZh
                                ? "维护可复用的说话人名称；远端声纹会在实际转录绑定时自动处理。"
                                : "Maintain reusable speaker names. Remote voiceprints are handled automatically during transcript binding."}
                        </p>
                    </div>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void refreshProfiles()}
                        disabled={isProfilesLoading}
                        data-testid="speaker-profiles-refresh"
                    >
                        <RefreshCw
                            className={`mr-2 h-3.5 w-3.5 ${isProfilesLoading ? "animate-spin" : ""}`}
                        />
                        {isZh ? "刷新" : "Refresh"}
                    </Button>
                </div>

                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                    <div className="space-y-2">
                        <Label htmlFor="new-speaker-name">
                            {isZh ? "说话人名称" : "Speaker name"}
                        </Label>
                        <Input
                            id="new-speaker-name"
                            value={newName}
                            onChange={(event) => setNewName(event.target.value)}
                            placeholder={isZh ? "例如：Alex" : "e.g. Alex"}
                            disabled={localSavingId === "new"}
                            data-testid="speaker-profile-new-name"
                        />
                    </div>
                    <Button
                        type="button"
                        size="sm"
                        className="self-end"
                        onClick={handleCreate}
                        disabled={localSavingId === "new"}
                        aria-busy={localSavingId === "new"}
                        data-testid="speaker-profile-create"
                    >
                        {isZh ? "添加说话人" : "Add Speaker"}
                    </Button>
                </div>

                {isProfilesLoading ? (
                    <SettingsListSkeleton rows={2} />
                ) : profilesError ? (
                    <PanelNotice
                        tone="danger"
                        action={
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => void refreshProfiles()}
                            >
                                {isZh ? "重试" : "Retry"}
                            </Button>
                        }
                    >
                        {profilesError}
                    </PanelNotice>
                ) : profiles.length === 0 ? (
                    <PanelNotice>
                        {isZh
                            ? "还没有已保存的说话人。"
                            : "No saved speakers yet."}
                    </PanelNotice>
                ) : (
                    <div className="max-h-[24rem] space-y-3 overflow-y-auto overscroll-contain pr-1">
                        {profiles.map((profile) => {
                            const isProfileSaving =
                                localSavingId === profile.id;

                            return (
                                <div
                                    key={profile.id}
                                    className="grid gap-3 rounded-xl border border-border/75 bg-muted/20 p-3 sm:grid-cols-[2rem_minmax(0,1fr)_auto_auto]"
                                    data-speaker-profile-row=""
                                    data-speaker-profile-busy={
                                        isProfileSaving ? "true" : "false"
                                    }
                                    data-speaker-profile-id={profile.id}
                                >
                                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-background/60 text-xs font-semibold text-foreground">
                                        {profile.displayName
                                            .trim()
                                            .slice(0, 1)
                                            .toUpperCase() || "#"}
                                    </span>
                                    <div className="min-w-0 space-y-2">
                                        <Input
                                            value={profile.displayName}
                                            onChange={(event) =>
                                                setProfiles((prev) =>
                                                    prev.map((item) =>
                                                        item.id === profile.id
                                                            ? {
                                                                  ...item,
                                                                  displayName:
                                                                      event
                                                                          .target
                                                                          .value,
                                                              }
                                                            : item,
                                                    ),
                                                )
                                            }
                                            className="min-w-0 truncate [word-break:keep-all]"
                                            disabled={isProfileSaving}
                                            data-testid="speaker-profile-name"
                                        />
                                        <div className="flex min-w-0 flex-wrap gap-2 text-xs text-muted-foreground">
                                            <span className="min-w-0 truncate">
                                                {isZh
                                                    ? `已用于 ${profile.assignmentCount} 条录音`
                                                    : `Used in ${profile.assignmentCount} recording${profile.assignmentCount === 1 ? "" : "s"}`}
                                            </span>
                                            <StatePill
                                                tone={
                                                    profile.voiceprintRef
                                                        ? "success"
                                                        : "neutral"
                                                }
                                            >
                                                {profile.voiceprintRef
                                                    ? isZh
                                                        ? "已关联声纹"
                                                        : "Voiceprint linked"
                                                    : isZh
                                                      ? "未关联声纹"
                                                      : "No voiceprint"}
                                            </StatePill>
                                            {formatTimestamp(
                                                profile.updatedAt,
                                                locale,
                                            ) ? (
                                                <span className="min-w-0 truncate">
                                                    {isZh
                                                        ? "更新于 "
                                                        : "Updated "}
                                                    {formatTimestamp(
                                                        profile.updatedAt,
                                                        locale,
                                                    )}
                                                </span>
                                            ) : null}
                                        </div>
                                    </div>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="shrink-0 whitespace-nowrap max-sm:col-start-2"
                                        onClick={() => handleUpdate(profile)}
                                        disabled={isProfileSaving}
                                        aria-busy={isProfileSaving}
                                        data-testid="speaker-profile-save"
                                    >
                                        {isZh ? "保存" : "Save"}
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="shrink-0 whitespace-nowrap text-destructive hover:text-destructive max-sm:col-start-2"
                                        onClick={() => handleDelete(profile)}
                                        disabled={isProfileSaving}
                                        data-testid="speaker-profile-delete"
                                    >
                                        {isZh ? "删除" : "Delete"}
                                    </Button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div
                className="flex min-h-0 flex-col gap-4 border-t border-border/70 pt-4"
                data-vs-state={voiceprintsState}
            >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                        <p className="text-sm font-medium">
                            {isZh ? "声纹库" : "Voiceprints"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            {isZh
                                ? "查看已连接服务中的声纹。重命名和删除只影响声纹库，不会修改本地录音。"
                                : "View voiceprints from the connected service. Rename and delete actions affect the voiceprint library only and do not change local recordings."}
                        </p>
                    </div>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void refreshVoiceprints()}
                        disabled={isVoiceprintsLoading}
                        data-testid="voiceprints-refresh"
                    >
                        <RefreshCw
                            className={`mr-2 h-3.5 w-3.5 ${isVoiceprintsLoading ? "animate-spin" : ""}`}
                        />
                        {isZh ? "刷新" : "Refresh"}
                    </Button>
                </div>

                {isVoiceprintsLoading ? (
                    <SettingsListSkeleton rows={2} />
                ) : voiceprintsError ? (
                    <PanelNotice
                        tone="danger"
                        action={
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => void refreshVoiceprints()}
                            >
                                {isZh ? "重试" : "Retry"}
                            </Button>
                        }
                    >
                        {voiceprintsError}
                    </PanelNotice>
                ) : !voiceprintsAvailable ? (
                    <PanelNotice>
                        {voiceprintsReason ||
                            (isZh
                                ? "请先在 VoScript 保存可用的服务连接。"
                                : "Save a working VoScript connection first.")}
                    </PanelNotice>
                ) : voiceprints.length === 0 ? (
                    <PanelNotice>
                        {isZh
                            ? "没有找到远端声纹。"
                            : "No remote voiceprints found."}
                    </PanelNotice>
                ) : (
                    <div className="max-h-[24rem] space-y-3 overflow-y-auto overscroll-contain pr-1">
                        {voiceprints.map((voiceprint) => {
                            const isVoiceprintSaving =
                                voiceprintSavingId === voiceprint.id;

                            return (
                                <div
                                    key={voiceprint.id}
                                    className="grid gap-3 rounded-xl border border-border/75 bg-muted/20 p-3 sm:grid-cols-[2rem_minmax(0,1fr)_auto_auto]"
                                    data-vs-profile-row=""
                                    data-vs-profile-busy={
                                        isVoiceprintSaving ? "true" : "false"
                                    }
                                    data-vs-profile-id={voiceprint.id}
                                >
                                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-background/60 text-xs font-semibold text-foreground">
                                        {voiceprint.displayName
                                            .trim()
                                            .slice(0, 1)
                                            .toUpperCase() || "V"}
                                    </span>

                                    <div className="min-w-0 space-y-2">
                                        <Label
                                            className="sr-only"
                                            htmlFor={`voiceprint-${voiceprint.id}`}
                                        >
                                            {isZh
                                                ? "声纹名称"
                                                : "Voiceprint name"}
                                        </Label>
                                        <Input
                                            id={`voiceprint-${voiceprint.id}`}
                                            value={voiceprint.displayName}
                                            onChange={(event) =>
                                                setVoiceprints((prev) =>
                                                    prev.map((item) =>
                                                        item.id ===
                                                        voiceprint.id
                                                            ? {
                                                                  ...item,
                                                                  displayName:
                                                                      event
                                                                          .target
                                                                          .value,
                                                              }
                                                            : item,
                                                    ),
                                                )
                                            }
                                            className="min-w-0 truncate [word-break:keep-all]"
                                            disabled={isVoiceprintSaving}
                                            data-testid="voiceprint-name"
                                        />
                                        <div className="flex min-w-0 flex-wrap gap-2 text-xs text-muted-foreground">
                                            <StatePill tone="success">
                                                {isZh ? "远端声纹" : "Remote"}
                                            </StatePill>
                                            <span className="min-w-0 truncate font-mono">
                                                {voiceprint.id}
                                            </span>
                                            {formatTimestamp(
                                                voiceprint.updatedAt,
                                                locale,
                                            ) ? (
                                                <span className="min-w-0 truncate">
                                                    {isZh
                                                        ? "更新于 "
                                                        : "Updated "}
                                                    {formatTimestamp(
                                                        voiceprint.updatedAt,
                                                        locale,
                                                    )}
                                                </span>
                                            ) : formatTimestamp(
                                                  voiceprint.createdAt,
                                                  locale,
                                              ) ? (
                                                <span className="min-w-0 truncate">
                                                    {isZh
                                                        ? "创建于 "
                                                        : "Created "}
                                                    {formatTimestamp(
                                                        voiceprint.createdAt,
                                                        locale,
                                                    )}
                                                </span>
                                            ) : null}
                                        </div>
                                    </div>

                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="shrink-0 whitespace-nowrap max-sm:col-start-2"
                                        onClick={() =>
                                            handleRenameVoiceprint(voiceprint)
                                        }
                                        disabled={isVoiceprintSaving}
                                        aria-busy={isVoiceprintSaving}
                                        data-testid="voiceprint-rename"
                                    >
                                        {isZh ? "重命名" : "Rename"}
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="shrink-0 whitespace-nowrap text-destructive hover:text-destructive max-sm:col-start-2"
                                        onClick={() =>
                                            handleDeleteVoiceprint(voiceprint)
                                        }
                                        disabled={isVoiceprintSaving}
                                        data-testid="voiceprint-delete"
                                    >
                                        {isZh ? "删除" : "Delete"}
                                    </Button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
