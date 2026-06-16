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
    return <span className={`sot-speaker-pill ${tone}`}>{children}</span>;
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

    return (
        <div
            className={tone === "danger" ? "sd-banner err" : "sd-banner"}
            data-sot-panel={panel}
            data-sot-state={state}
            data-sot-tone={tone}
        >
            <span className="b-ic">
                <Icon aria-hidden="true" />
            </span>
            <div>
                <p className="b-h">{children}</p>
                {action ? <div className="sm-row-ctrl">{action}</div> : null}
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

    return (
        <div
            className="sot-speaker-profiles sm-section"
            data-sot-panel="speaker-profiles"
            data-sot-speaker-profiles-panel=""
            data-sot-state={profilesState}
            data-sot-voiceprints-state={voiceprintsState}
        >
            <div
                className="sm-section"
                data-sot-panel="speaker-profiles-local"
                data-sot-state={profilesState}
            >
                <div className="sm-row">
                    <div className="sm-row-label">
                        <div className="sm-l-t">
                            {isZh ? "已保存的说话人" : "Saved Speakers"}
                        </div>
                        <div className="sm-l-h">
                            {isZh
                                ? "维护可复用的说话人名称；远端声纹会在实际转录绑定时自动处理。"
                                : "Maintain reusable speaker names. Remote voiceprints are handled automatically during transcript binding."}
                        </div>
                    </div>
                    <Button
                        type="button"
                        size="sm"
                        onClick={() => void refreshProfiles()}
                        disabled={isProfilesLoading}
                        aria-busy={isProfilesLoading}
                        className="btn"
                        data-sot-control="speaker-profiles-refresh"
                        data-sot-state={isProfilesLoading ? "loading" : "idle"}
                    >
                        <RefreshCw
                            data-icon-state={
                                isProfilesLoading ? "loading" : undefined
                            }
                        />
                        {isZh ? "刷新" : "Refresh"}
                    </Button>
                </div>

                <div className="sm-row">
                    <div className="sm-row-label">
                        <Label htmlFor="new-speaker-name">
                            {isZh ? "说话人名称" : "Speaker name"}
                        </Label>
                        <Input
                            data-sot-control="speaker-profile-new-name"
                            id="new-speaker-name"
                            value={newName}
                            onChange={(event) => setNewName(event.target.value)}
                            placeholder={isZh ? "例如：Alex" : "e.g. Alex"}
                            disabled={localSavingId === "new"}
                        />
                    </div>
                    <Button
                        type="button"
                        size="sm"
                        className="btn"
                        onClick={handleCreate}
                        disabled={localSavingId === "new"}
                        aria-busy={localSavingId === "new"}
                        data-sot-control="speaker-profile-create"
                        data-sot-state={
                            localSavingId === "new"
                                ? "saving"
                                : newName.trim()
                                  ? "idle"
                                  : "disabled"
                        }
                    >
                        {isZh ? "添加说话人" : "Add Speaker"}
                    </Button>
                </div>

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
                    <PanelNotice panel="speaker-profiles-notice" state="empty">
                        {isZh
                            ? "还没有已保存的说话人。"
                            : "No saved speakers yet."}
                    </PanelNotice>
                ) : (
                    <div className="sp-rows">
                        {profiles.map((profile) => {
                            const isProfileSaving =
                                localSavingId === profile.id;

                            return (
                                <div
                                    key={profile.id}
                                    className="sp-row"
                                    data-sot-speaker-profile-row=""
                                    data-sot-speaker-profile-busy={
                                        isProfileSaving ? "true" : "false"
                                    }
                                    data-sot-speaker-profile-id={profile.id}
                                    data-sot-state={
                                        isProfileSaving ? "saving" : "ready"
                                    }
                                >
                                    <span className="sot-speaker-avatar">
                                        {profile.displayName
                                            .trim()
                                            .slice(0, 1)
                                            .toUpperCase() || "#"}
                                    </span>
                                    <div className="sp-row-meta">
                                        <Input
                                            data-sot-control="speaker-profile-name"
                                            data-sot-speaker-profile-id={
                                                profile.id
                                            }
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
                                            disabled={isProfileSaving}
                                        />
                                        <div className="sp-row-sub">
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
                                        </div>
                                    </div>
                                    <Button
                                        type="button"
                                        size="sm"
                                        className="btn"
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
                                        className="btn danger"
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
                className="sm-section"
                data-sot-panel="speaker-voiceprints"
                data-sot-state={voiceprintsState}
            >
                <div className="sm-row">
                    <div className="sm-row-label">
                        <div className="sm-l-t">
                            {isZh ? "声纹库" : "Voiceprints"}
                        </div>
                        <div className="sm-l-h">
                            {isZh
                                ? "查看已连接服务中的声纹。重命名和删除只影响声纹库，不会修改本地录音。"
                                : "View voiceprints from the connected service. Rename and delete actions affect the voiceprint library only and do not change local recordings."}
                        </div>
                    </div>
                    <Button
                        type="button"
                        size="sm"
                        onClick={() => void refreshVoiceprints()}
                        disabled={isVoiceprintsLoading}
                        aria-busy={isVoiceprintsLoading}
                        className="btn"
                        data-sot-control="speaker-voiceprints-refresh"
                        data-sot-state={
                            isVoiceprintsLoading ? "loading" : "idle"
                        }
                    >
                        <RefreshCw
                            data-icon-state={
                                isVoiceprintsLoading ? "loading" : undefined
                            }
                        />
                        {isZh ? "刷新" : "Refresh"}
                    </Button>
                </div>

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
                    <PanelNotice
                        panel="speaker-voiceprints-notice"
                        state="empty"
                    >
                        {isZh
                            ? "没有找到远端声纹。"
                            : "No remote voiceprints found."}
                    </PanelNotice>
                ) : (
                    <div className="sp-rows">
                        {voiceprints.map((voiceprint) => {
                            const isVoiceprintSaving =
                                voiceprintSavingId === voiceprint.id;

                            return (
                                <div
                                    key={voiceprint.id}
                                    className="sp-row"
                                    data-sot-state={
                                        isVoiceprintSaving ? "saving" : "ready"
                                    }
                                    data-sot-voiceprint-busy={
                                        isVoiceprintSaving ? "true" : "false"
                                    }
                                    data-sot-voiceprint-id={voiceprint.id}
                                    data-sot-voiceprint-row=""
                                >
                                    <span className="sot-speaker-avatar">
                                        {voiceprint.displayName
                                            .trim()
                                            .slice(0, 1)
                                            .toUpperCase() || "V"}
                                    </span>

                                    <div className="sp-row-meta">
                                        <Label
                                            hidden
                                            htmlFor={`voiceprint-${voiceprint.id}`}
                                        >
                                            {isZh
                                                ? "声纹名称"
                                                : "Voiceprint name"}
                                        </Label>
                                        <Input
                                            data-sot-control="speaker-voiceprint-name"
                                            data-sot-voiceprint-id={
                                                voiceprint.id
                                            }
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
                                            disabled={isVoiceprintSaving}
                                        />
                                        <div className="sp-row-sub">
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
                                        </div>
                                    </div>

                                    <Button
                                        type="button"
                                        size="sm"
                                        className="btn"
                                        onClick={() =>
                                            handleRenameVoiceprint(voiceprint)
                                        }
                                        disabled={isVoiceprintSaving}
                                        aria-busy={isVoiceprintSaving}
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
                                        className="btn danger"
                                        onClick={() =>
                                            handleDeleteVoiceprint(voiceprint)
                                        }
                                        disabled={isVoiceprintSaving}
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
