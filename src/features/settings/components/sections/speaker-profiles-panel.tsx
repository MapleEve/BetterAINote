"use client";

import { AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useLanguage } from "@/components/language-provider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyTitle,
} from "@/components/ui/empty";
import {
    Field,
    FieldContent,
    FieldControl,
    FieldDescription,
    FieldLabel,
    FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SettingsListSkeleton } from "@/features/settings/components/settings-skeletons";
import { formatDateTime } from "@/lib/format-date";

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

const speakerAvatarFallbackClassName =
    "bg-accent text-[11px] font-bold text-primary";

const speakerStateBadgeVariantByTone = {
    danger: "destructive",
    neutral: "secondary",
    success: "default",
    warning: "outline",
} as const;

const speakerSettingsRowClassName = "border-b border-border py-3";

const speakerProfilesPanelClassName = "relative flex flex-col gap-2";

const speakerSectionGroupClassName = "relative mb-[22px]";

const speakerRowsListClassName = "m-0 flex list-none flex-col gap-1.5 p-0";

const speakerRowItemClassName =
    "grid min-w-0 grid-cols-[36px_minmax(0,1fr)_auto_auto] items-center gap-2.5 px-3 py-2.5";

const speakerRowMetaClassName = "flex min-w-0 flex-col gap-0.5";

const speakerRowSubClassName = "flex min-w-0 flex-wrap items-center gap-1.5";

function StatePill({
    children,
    tone = "neutral",
}: {
    children: ReactNode;
    tone?: "success" | "neutral" | "warning" | "danger";
}) {
    return (
        <Badge
            variant={speakerStateBadgeVariantByTone[tone]}
            data-sot-badge="speaker-state"
            data-sot-tone={tone}
        >
            {children}
        </Badge>
    );
}

function PanelNotice({
    action,
    children,
    panel,
    state,
    tone = "neutral",
}: {
    action?: ReactNode;
    children: ReactNode;
    panel?: string;
    state?: string;
    tone?: "danger" | "neutral";
}) {
    const Icon = tone === "danger" ? AlertCircle : CheckCircle2;
    const bannerTone = tone === "danger" ? "err" : "info";

    return (
        <Alert
            className="mb-4"
            density="comfortable"
            layout="default"
            variant={tone === "danger" ? "destructiveSoft" : "default"}
            data-sot-banner="speaker-profiles-notice"
            data-sot-panel={panel}
            data-sot-state={state}
            data-sot-tone={bannerTone}
        >
            <Icon aria-hidden="true" data-sot-banner-icon />
            <AlertDescription density="comfortable" data-sot-banner-body>
                <p data-sot-banner-sub>{children}</p>
                {action ? (
                    <div className="mt-2 flex items-center gap-2">{action}</div>
                ) : null}
            </AlertDescription>
        </Alert>
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
    const isCreatingSpeakerProfile = localSavingId === "new";
    const isNewSpeakerNameBlank = newName.trim().length === 0;
    const isCreateSpeakerDisabled =
        isCreatingSpeakerProfile || isNewSpeakerNameBlank;

    return (
        <div
            className={speakerProfilesPanelClassName}
            data-sot-panel="speaker-profiles"
            data-sot-section-group
            data-sot-state={profilesState}
            data-sot-voiceprints-state={voiceprintsState}
        >
            <div
                className={speakerSectionGroupClassName}
                data-sot-panel="speaker-profiles-local"
                data-sot-section-group
                data-sot-state={profilesState}
            >
                <Field
                    orientation="horizontal"
                    className={speakerSettingsRowClassName}
                >
                    <FieldContent>
                        <FieldTitle>
                            {isZh ? "已保存的说话人" : "Saved Speakers"}
                        </FieldTitle>
                        <FieldDescription>
                            {isZh
                                ? "维护可复用的说话人名称；远端声纹会在实际转录绑定时自动处理。"
                                : "Maintain reusable speaker names. Remote voiceprints are handled automatically during transcript binding."}
                        </FieldDescription>
                    </FieldContent>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void refreshProfiles()}
                        disabled={isProfilesLoading}
                        aria-busy={isProfilesLoading}
                        data-sot-control="speaker-profiles-refresh"
                        data-sot-state={isProfilesLoading ? "loading" : "idle"}
                    >
                        <RefreshCw
                            data-icon="inline-start"
                            data-icon-state={
                                isProfilesLoading ? "loading" : undefined
                            }
                        />
                        {isZh ? "刷新" : "Refresh"}
                    </Button>
                </Field>

                <Field
                    orientation="horizontal"
                    className={speakerSettingsRowClassName}
                >
                    <FieldContent className="min-w-0">
                        <FieldLabel htmlFor="new-speaker-name">
                            {isZh ? "说话人名称" : "Speaker name"}
                        </FieldLabel>
                        <Input
                            data-sot-control="speaker-profile-new-name"
                            id="new-speaker-name"
                            value={newName}
                            onChange={(event) => setNewName(event.target.value)}
                            placeholder={isZh ? "例如：Alex" : "e.g. Alex"}
                            disabled={isCreatingSpeakerProfile}
                        />
                    </FieldContent>
                    <span
                        id="new-speaker-create-description"
                        className="sr-only"
                    >
                        {isZh
                            ? "输入说话人名称后即可添加。"
                            : "Enter a speaker name to add a speaker."}
                    </span>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleCreate}
                        disabled={isCreateSpeakerDisabled}
                        aria-busy={isCreatingSpeakerProfile}
                        aria-describedby="new-speaker-create-description"
                        data-sot-control="speaker-profile-create"
                        data-sot-state={
                            isCreatingSpeakerProfile
                                ? "saving"
                                : isNewSpeakerNameBlank
                                  ? "disabled"
                                  : "idle"
                        }
                    >
                        {isZh ? "添加说话人" : "Add Speaker"}
                    </Button>
                </Field>

                {isProfilesLoading ? (
                    <SettingsListSkeleton rows={2} />
                ) : profilesError ? (
                    <PanelNotice
                        panel="speaker-profiles-notice"
                        state="error"
                        tone="danger"
                        action={
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => void refreshProfiles()}
                                data-sot-control="speaker-profiles-retry"
                                data-sot-state="idle"
                            >
                                {isZh ? "重试" : "Retry"}
                            </Button>
                        }
                    >
                        {profilesError}
                    </PanelNotice>
                ) : profiles.length === 0 ? (
                    <Empty
                        data-sot-panel="speaker-profiles-notice"
                        data-sot-part="speaker-profiles-empty"
                        data-sot-state="empty"
                    >
                        <EmptyHeader>
                            <EmptyTitle data-sot-part="speaker-profiles-empty-title">
                                {isZh
                                    ? "还没有已保存的说话人"
                                    : "No saved speakers yet"}
                            </EmptyTitle>
                            <EmptyDescription data-sot-part="speaker-profiles-empty-description">
                                {isZh
                                    ? "添加常用说话人后，可在录音整理时复用这些名称。"
                                    : "Add reusable speakers to keep names consistent while organizing recordings."}
                            </EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                ) : (
                    <div
                        className={speakerRowsListClassName}
                        data-sot-list="speaker-profile-rows"
                    >
                        {profiles.map((profile) => {
                            const isProfileSaving =
                                localSavingId === profile.id;
                            const profileNameInputId = `speaker-profile-${profile.id}-name`;
                            const profileNameDescriptionId = `speaker-profile-${profile.id}-description`;

                            return (
                                <div
                                    className={speakerRowItemClassName}
                                    key={profile.id}
                                    data-sot-item="speaker-profile-row"
                                    data-sot-speaker-profile-row=""
                                    data-sot-speaker-profile-busy={
                                        isProfileSaving ? "true" : "false"
                                    }
                                    data-sot-speaker-profile-id={profile.id}
                                    data-sot-state={
                                        isProfileSaving ? "saving" : "ready"
                                    }
                                >
                                    <Avatar data-sot-part="speaker-profile-avatar">
                                        <AvatarFallback
                                            className={
                                                speakerAvatarFallbackClassName
                                            }
                                        >
                                            {profile.displayName
                                                .trim()
                                                .slice(0, 1)
                                                .toUpperCase() || "#"}
                                        </AvatarFallback>
                                    </Avatar>
                                    <Field
                                        className={speakerRowMetaClassName}
                                        data-disabled={
                                            isProfileSaving ? "true" : undefined
                                        }
                                        data-sot-part="speaker-profile-row-meta"
                                    >
                                        <FieldLabel
                                            className="sr-only"
                                            htmlFor={profileNameInputId}
                                        >
                                            {isZh
                                                ? `说话人名称：${profile.displayName || profile.id}`
                                                : `Speaker profile name: ${profile.displayName || profile.id}`}
                                        </FieldLabel>
                                        <FieldControl className="w-full">
                                            <Input
                                                data-sot-control="speaker-profile-name"
                                                data-sot-speaker-profile-id={
                                                    profile.id
                                                }
                                                id={profileNameInputId}
                                                value={profile.displayName}
                                                onChange={(event) =>
                                                    setProfiles((prev) =>
                                                        prev.map((item) =>
                                                            item.id ===
                                                            profile.id
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
                                                disabled={isProfileSaving}
                                                aria-describedby={
                                                    profileNameDescriptionId
                                                }
                                            />
                                        </FieldControl>
                                        <FieldDescription
                                            className={speakerRowSubClassName}
                                            id={profileNameDescriptionId}
                                            data-sot-part="speaker-profile-row-sub"
                                        >
                                            <span>
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
                                                <span>
                                                    {isZh
                                                        ? "更新于 "
                                                        : "Updated "}
                                                    {formatTimestamp(
                                                        profile.updatedAt,
                                                        locale,
                                                    )}
                                                </span>
                                            ) : null}
                                        </FieldDescription>
                                    </Field>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleUpdate(profile)}
                                        disabled={isProfileSaving}
                                        aria-busy={isProfileSaving}
                                        data-sot-control="speaker-profile-save"
                                        data-sot-speaker-profile-id={profile.id}
                                        data-sot-state={
                                            isProfileSaving ? "saving" : "idle"
                                        }
                                    >
                                        {isZh ? "保存" : "Save"}
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="destructive"
                                        onClick={() => handleDelete(profile)}
                                        disabled={isProfileSaving}
                                        data-sot-control="speaker-profile-delete"
                                        data-sot-speaker-profile-id={profile.id}
                                        data-sot-state={
                                            isProfileSaving
                                                ? "disabled"
                                                : "idle"
                                        }
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
                className={speakerSectionGroupClassName}
                data-sot-panel="speaker-voiceprints"
                data-sot-section-group
                data-sot-state={voiceprintsState}
            >
                <Field
                    orientation="horizontal"
                    className={speakerSettingsRowClassName}
                >
                    <FieldContent>
                        <FieldTitle>
                            {isZh ? "声纹库" : "Voiceprints"}
                        </FieldTitle>
                        <FieldDescription>
                            {isZh
                                ? "查看已连接服务中的声纹。重命名和删除只影响声纹库，不会修改本地录音。"
                                : "View voiceprints from the connected service. Rename and delete actions affect the voiceprint library only and do not change local recordings."}
                        </FieldDescription>
                    </FieldContent>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void refreshVoiceprints()}
                        disabled={isVoiceprintsLoading}
                        aria-busy={isVoiceprintsLoading}
                        data-sot-control="speaker-voiceprints-refresh"
                        data-sot-state={
                            isVoiceprintsLoading ? "loading" : "idle"
                        }
                    >
                        <RefreshCw
                            data-icon="inline-start"
                            data-icon-state={
                                isVoiceprintsLoading ? "loading" : undefined
                            }
                        />
                        {isZh ? "刷新" : "Refresh"}
                    </Button>
                </Field>

                {isVoiceprintsLoading ? (
                    <SettingsListSkeleton rows={2} />
                ) : voiceprintsError ? (
                    <PanelNotice
                        panel="speaker-voiceprints-notice"
                        state="error"
                        tone="danger"
                        action={
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => void refreshVoiceprints()}
                                data-sot-control="speaker-voiceprints-retry"
                                data-sot-state="idle"
                            >
                                {isZh ? "重试" : "Retry"}
                            </Button>
                        }
                    >
                        {voiceprintsError}
                    </PanelNotice>
                ) : !voiceprintsAvailable ? (
                    <PanelNotice
                        panel="speaker-voiceprints-notice"
                        state="disabled"
                    >
                        {voiceprintsReason ||
                            (isZh
                                ? "请先在 VoScript 保存可用的服务连接。"
                                : "Save a working VoScript connection first.")}
                    </PanelNotice>
                ) : voiceprints.length === 0 ? (
                    <Empty
                        data-sot-panel="speaker-voiceprints-notice"
                        data-sot-part="speaker-voiceprints-empty"
                        data-sot-state="empty"
                    >
                        <EmptyHeader>
                            <EmptyTitle data-sot-part="speaker-voiceprints-empty-title">
                                {isZh
                                    ? "没有找到远端声纹"
                                    : "No remote voiceprints found"}
                            </EmptyTitle>
                            <EmptyDescription data-sot-part="speaker-voiceprints-empty-description">
                                {isZh
                                    ? "完成一次带声纹的转录后，远端声纹会显示在这里。"
                                    : "Remote voiceprints will appear here after a voiceprint-enabled transcription."}
                            </EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                ) : (
                    <div
                        className={speakerRowsListClassName}
                        data-sot-list="speaker-voiceprint-rows"
                    >
                        {voiceprints.map((voiceprint) => {
                            const isVoiceprintSaving =
                                voiceprintSavingId === voiceprint.id;
                            const voiceprintNameInputId = `voiceprint-${voiceprint.id}`;
                            const voiceprintNameDescriptionId = `voiceprint-${voiceprint.id}-description`;

                            return (
                                <div
                                    className={speakerRowItemClassName}
                                    key={voiceprint.id}
                                    data-sot-item="speaker-voiceprint-row"
                                    data-sot-state={
                                        isVoiceprintSaving ? "saving" : "ready"
                                    }
                                    data-sot-voiceprint-busy={
                                        isVoiceprintSaving ? "true" : "false"
                                    }
                                    data-sot-voiceprint-id={voiceprint.id}
                                    data-sot-voiceprint-row=""
                                >
                                    <Avatar data-sot-part="speaker-voiceprint-avatar">
                                        <AvatarFallback
                                            className={
                                                speakerAvatarFallbackClassName
                                            }
                                        >
                                            {voiceprint.displayName
                                                .trim()
                                                .slice(0, 1)
                                                .toUpperCase() || "V"}
                                        </AvatarFallback>
                                    </Avatar>

                                    <Field
                                        className={speakerRowMetaClassName}
                                        data-disabled={
                                            isVoiceprintSaving
                                                ? "true"
                                                : undefined
                                        }
                                        data-sot-part="speaker-voiceprint-row-meta"
                                    >
                                        <FieldLabel
                                            className="sr-only"
                                            htmlFor={voiceprintNameInputId}
                                        >
                                            {isZh
                                                ? `声纹名称：${voiceprint.displayName || voiceprint.id}`
                                                : `Voiceprint name: ${voiceprint.displayName || voiceprint.id}`}
                                        </FieldLabel>
                                        <FieldControl className="w-full">
                                            <Input
                                                data-sot-control="speaker-voiceprint-name"
                                                data-sot-voiceprint-id={
                                                    voiceprint.id
                                                }
                                                id={voiceprintNameInputId}
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
                                                disabled={isVoiceprintSaving}
                                                aria-describedby={
                                                    voiceprintNameDescriptionId
                                                }
                                            />
                                        </FieldControl>
                                        <FieldDescription
                                            className={speakerRowSubClassName}
                                            id={voiceprintNameDescriptionId}
                                            data-sot-part="speaker-voiceprint-row-sub"
                                        >
                                            <StatePill tone="success">
                                                {isZh ? "远端声纹" : "Remote"}
                                            </StatePill>
                                            <span>{voiceprint.id}</span>
                                            {formatTimestamp(
                                                voiceprint.updatedAt,
                                                locale,
                                            ) ? (
                                                <span>
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
                                                <span>
                                                    {isZh
                                                        ? "创建于 "
                                                        : "Created "}
                                                    {formatTimestamp(
                                                        voiceprint.createdAt,
                                                        locale,
                                                    )}
                                                </span>
                                            ) : null}
                                        </FieldDescription>
                                    </Field>

                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() =>
                                            handleRenameVoiceprint(voiceprint)
                                        }
                                        disabled={isVoiceprintSaving}
                                        aria-busy={isVoiceprintSaving}
                                        aria-label={
                                            isZh
                                                ? `重命名声纹 ${voiceprint.displayName || voiceprint.id}`
                                                : `Rename voiceprint ${voiceprint.displayName || voiceprint.id}`
                                        }
                                        data-sot-control="speaker-voiceprint-rename"
                                        data-sot-state={
                                            isVoiceprintSaving
                                                ? "saving"
                                                : "idle"
                                        }
                                        data-sot-voiceprint-id={voiceprint.id}
                                    >
                                        {isZh ? "重命名" : "Rename"}
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="destructive"
                                        onClick={() =>
                                            handleDeleteVoiceprint(voiceprint)
                                        }
                                        disabled={isVoiceprintSaving}
                                        aria-label={
                                            isZh
                                                ? `删除声纹 ${voiceprint.displayName || voiceprint.id}`
                                                : `Delete voiceprint ${voiceprint.displayName || voiceprint.id}`
                                        }
                                        data-sot-control="speaker-voiceprint-delete"
                                        data-sot-state={
                                            isVoiceprintSaving
                                                ? "disabled"
                                                : "idle"
                                        }
                                        data-sot-voiceprint-id={voiceprint.id}
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
