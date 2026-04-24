"use client";

import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { confirmInBrowser } from "@/lib/platform/browser-shell";

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

    return date.toLocaleString(locale);
}

export function SpeakerProfilesPanel() {
    const { language } = useLanguage();
    const isZh = language === "zh-CN";
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
    const [voiceprintsProviderName, setVoiceprintsProviderName] = useState<
        string | null
    >(null);
    const [voiceprintsReason, setVoiceprintsReason] = useState<string | null>(
        null,
    );
    const [voiceprintsError, setVoiceprintsError] = useState<string | null>(
        null,
    );

    const refreshProfiles = useCallback(async () => {
        setIsProfilesLoading(true);
        try {
            const response = await fetch("/api/speakers/profiles", {
                cache: "no-store",
            });
            const data = await response.json();
            if (!response.ok) {
                toast.error(
                    data.error ||
                        (isZh
                            ? "加载说话人档案失败"
                            : "Failed to load speaker profiles"),
                );
                return;
            }
            setProfiles(data.profiles ?? []);
        } catch {
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
                setVoiceprintsProviderName(null);
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
            setVoiceprintsProviderName(
                typeof data.providerName === "string"
                    ? data.providerName
                    : null,
            );
            setVoiceprintsReason(
                typeof data.reason === "string" ? data.reason : null,
            );
        } catch {
            setVoiceprints([]);
            setVoiceprintsAvailable(false);
            setVoiceprintsProviderName(null);
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
        async (profileId: string) => {
            setLocalSavingId(profileId);
            try {
                const response = await fetch(
                    `/api/speakers/profiles/${profileId}`,
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
        [isZh, refreshProfiles],
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
            const confirmed = confirmInBrowser(
                isZh
                    ? `确定删除远端声纹“${voiceprint.displayName}”吗？本地说话人档案不会自动同步修改。`
                    : `Delete remote voiceprint "${voiceprint.displayName}"? Local speaker profiles will not be changed automatically.`,
            );
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
        [isZh, refreshVoiceprints],
    );

    return (
        <div className="space-y-6 rounded-lg border p-4">
            <div className="space-y-4">
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
                        />
                    </div>
                    <Button
                        type="button"
                        size="sm"
                        className="self-end"
                        onClick={handleCreate}
                        disabled={localSavingId === "new"}
                    >
                        {isZh ? "添加说话人" : "Add Speaker"}
                    </Button>
                </div>

                {isProfilesLoading ? (
                    <div className="text-sm text-muted-foreground">
                        {isZh
                            ? "正在加载已保存的说话人..."
                            : "Loading saved speakers..."}
                    </div>
                ) : profiles.length === 0 ? (
                    <div className="text-sm text-muted-foreground">
                        {isZh
                            ? "还没有已保存的说话人。"
                            : "No saved speakers yet."}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {profiles.map((profile) => (
                            <div
                                key={profile.id}
                                className="grid gap-3 rounded-lg border bg-muted/20 p-3 md:grid-cols-[minmax(0,1fr)_auto_auto]"
                            >
                                <div className="md:col-span-full flex flex-wrap gap-3 text-xs text-muted-foreground">
                                    <span>
                                        {isZh
                                            ? `已用于 ${profile.assignmentCount} 条录音`
                                            : `Used in ${profile.assignmentCount} recording${profile.assignmentCount === 1 ? "" : "s"}`}
                                    </span>
                                    <span>
                                        {profile.voiceprintRef
                                            ? isZh
                                                ? "已关联声纹"
                                                : "Linked to a voiceprint"
                                            : isZh
                                              ? "未关联声纹"
                                              : "No voiceprint linked"}
                                    </span>
                                    {formatTimestamp(
                                        profile.updatedAt,
                                        locale,
                                    ) ? (
                                        <span>
                                            {isZh ? "更新于 " : "Updated "}
                                            {formatTimestamp(
                                                profile.updatedAt,
                                                locale,
                                            )}
                                        </span>
                                    ) : null}
                                </div>
                                <Input
                                    value={profile.displayName}
                                    onChange={(event) =>
                                        setProfiles((prev) =>
                                            prev.map((item) =>
                                                item.id === profile.id
                                                    ? {
                                                          ...item,
                                                          displayName:
                                                              event.target
                                                                  .value,
                                                      }
                                                    : item,
                                            ),
                                        )
                                    }
                                />
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleUpdate(profile)}
                                    disabled={localSavingId === profile.id}
                                >
                                    {isZh ? "保存" : "Save"}
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="text-destructive hover:text-destructive"
                                    onClick={() => handleDelete(profile.id)}
                                    disabled={localSavingId === profile.id}
                                >
                                    {isZh ? "删除" : "Delete"}
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="space-y-4 border-t pt-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                        <p className="text-sm font-medium">
                            {isZh ? "远端声纹库" : "Remote Voiceprints"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            {isZh
                                ? "浏览当前 voice-transcribe provider 背后的声纹库。重命名和删除只会影响远端数据库。"
                                : "Browse the voiceprint database behind your configured voice-transcribe provider. Rename and delete actions affect the remote database only."}
                        </p>
                        {voiceprintsProviderName ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                                {isZh ? "Provider：" : "Provider: "}
                                {voiceprintsProviderName}
                            </p>
                        ) : null}
                    </div>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void refreshVoiceprints()}
                        disabled={isVoiceprintsLoading}
                    >
                        <RefreshCw
                            className={`mr-2 h-3.5 w-3.5 ${isVoiceprintsLoading ? "animate-spin" : ""}`}
                        />
                        {isZh ? "刷新" : "Refresh"}
                    </Button>
                </div>

                {isVoiceprintsLoading ? (
                    <div className="text-sm text-muted-foreground">
                        {isZh
                            ? "正在加载远端声纹..."
                            : "Loading remote voiceprints..."}
                    </div>
                ) : voiceprintsError ? (
                    <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                        {voiceprintsError}
                    </div>
                ) : !voiceprintsAvailable ? (
                    <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                        {voiceprintsReason ||
                            (isZh
                                ? "当前没有为远端声纹配置 voice-transcribe provider。"
                                : "No voice-transcribe provider is configured for remote voiceprints.")}
                    </div>
                ) : voiceprints.length === 0 ? (
                    <div className="text-sm text-muted-foreground">
                        {isZh
                            ? "没有找到远端声纹。"
                            : "No remote voiceprints found."}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {voiceprints.map((voiceprint) => (
                            <div
                                key={voiceprint.id}
                                className="grid gap-3 rounded-lg border bg-muted/20 p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,240px)_auto_auto]"
                            >
                                <div className="space-y-2">
                                    <Label
                                        htmlFor={`voiceprint-${voiceprint.id}`}
                                    >
                                        {isZh ? "声纹名称" : "Voiceprint name"}
                                    </Label>
                                    <Input
                                        id={`voiceprint-${voiceprint.id}`}
                                        value={voiceprint.displayName}
                                        onChange={(event) =>
                                            setVoiceprints((prev) =>
                                                prev.map((item) =>
                                                    item.id === voiceprint.id
                                                        ? {
                                                              ...item,
                                                              displayName:
                                                                  event.target
                                                                      .value,
                                                          }
                                                        : item,
                                                ),
                                            )
                                        }
                                    />
                                </div>

                                <div className="space-y-2">
                                    <p className="text-xs font-medium text-muted-foreground">
                                        {isZh
                                            ? "声纹引用 ID"
                                            : "Voiceprint ref"}
                                    </p>
                                    <div className="rounded-md border bg-background px-3 py-2 font-mono text-xs break-all">
                                        {voiceprint.id}
                                    </div>
                                    {formatTimestamp(
                                        voiceprint.updatedAt,
                                        locale,
                                    ) ? (
                                        <p className="text-xs text-muted-foreground">
                                            {isZh ? "更新于 " : "Updated "}
                                            {formatTimestamp(
                                                voiceprint.updatedAt,
                                                locale,
                                            )}
                                        </p>
                                    ) : formatTimestamp(
                                          voiceprint.createdAt,
                                          locale,
                                      ) ? (
                                        <p className="text-xs text-muted-foreground">
                                            {isZh ? "创建于 " : "Created "}
                                            {formatTimestamp(
                                                voiceprint.createdAt,
                                                locale,
                                            )}
                                        </p>
                                    ) : null}
                                </div>

                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="self-end"
                                    onClick={() =>
                                        handleRenameVoiceprint(voiceprint)
                                    }
                                    disabled={
                                        voiceprintSavingId === voiceprint.id
                                    }
                                >
                                    {isZh ? "重命名" : "Rename"}
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="self-end text-destructive hover:text-destructive"
                                    onClick={() =>
                                        handleDeleteVoiceprint(voiceprint)
                                    }
                                    disabled={
                                        voiceprintSavingId === voiceprint.id
                                    }
                                >
                                    {isZh ? "删除" : "Delete"}
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
