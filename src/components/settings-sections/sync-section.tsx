"use client";

import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useLanguage } from "@/components/language-provider";
import {
    SettingsCardSkeleton,
    SettingsSectionSkeleton,
} from "@/components/settings/settings-skeletons";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useSyncSettingsStore } from "@/features/settings/sync-settings-store";
import { MIN_SYNC_INTERVAL_SECONDS } from "@/services/sync-settings";

interface SyncSectionProps {
    embedded?: boolean;
}

export function SyncSection({ embedded = false }: SyncSectionProps) {
    const { language } = useLanguage();
    const {
        settings: { syncIntervalSeconds, autoSyncEnabled },
        hasLoaded,
        isLoading,
        isSaving,
        updateSyncSettings,
    } = useSyncSettingsStore();
    const [syncIntervalInput, setSyncIntervalInput] =
        useState(syncIntervalSeconds);

    const isZh = language === "zh-CN";

    useEffect(() => {
        setSyncIntervalInput(syncIntervalSeconds);
    }, [syncIntervalSeconds]);

    const showSaveError = () => {
        toast.error(
            isZh
                ? "保存设置失败，已回滚。"
                : "Failed to save settings. Changes reverted.",
        );
    };

    const handleSyncSettingChange = async (
        updates: Parameters<typeof updateSyncSettings>[0],
    ) => {
        try {
            await updateSyncSettings(updates);
        } catch {
            showSaveError();
        }
    };

    if (isLoading && !hasLoaded) {
        if (embedded) {
            return <SettingsCardSkeleton fields={2} />;
        }

        return <SettingsSectionSkeleton cards={1} fieldsPerCard={2} />;
    }

    const content = (
        <Card className="gap-5">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <RefreshCw />
                    {isZh ? "同步设置" : "Sync Settings"}
                </CardTitle>
                <CardDescription>
                    {isZh
                        ? "控制后台同步检查，不直接绑定某一个数据源。"
                        : "Controls background checks across configured data sources."}
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
                    <div className="flex flex-col gap-1">
                        <Label htmlFor="auto-sync" className="text-base">
                            {isZh ? "启用后台同步" : "Enable automatic checks"}
                        </Label>
                        <p className="text-sm text-muted-foreground">
                            {isZh
                                ? "系统会按设定间隔自动检查各数据源是否有新录音或更新。"
                                : "The app will automatically check configured data sources for new or updated recordings on the configured cadence."}
                        </p>
                    </div>
                    <Switch
                        id="auto-sync"
                        checked={autoSyncEnabled}
                        onCheckedChange={(checked) => {
                            void handleSyncSettingChange({
                                autoSyncEnabled: checked,
                            });
                        }}
                        disabled={isSaving}
                    />
                </div>

                {autoSyncEnabled ? (
                    <div className="flex flex-col gap-2 rounded-2xl border border-white/8 bg-white/5 p-4">
                        <Label htmlFor="sync-interval">
                            {isZh ? "自动检查间隔" : "Automatic check interval"}
                        </Label>
                        <Input
                            id="sync-interval"
                            type="number"
                            min={MIN_SYNC_INTERVAL_SECONDS}
                            step={1}
                            value={syncIntervalInput}
                            onChange={(event) => {
                                const nextValue = Number.parseInt(
                                    event.target.value,
                                    10,
                                );
                                setSyncIntervalInput(
                                    Number.isFinite(nextValue)
                                        ? nextValue
                                        : MIN_SYNC_INTERVAL_SECONDS,
                                );
                            }}
                            onBlur={() => {
                                const normalizedSeconds = Math.max(
                                    MIN_SYNC_INTERVAL_SECONDS,
                                    Number.isFinite(syncIntervalInput)
                                        ? Math.floor(syncIntervalInput)
                                        : MIN_SYNC_INTERVAL_SECONDS,
                                );
                                setSyncIntervalInput(normalizedSeconds);
                                void handleSyncSettingChange({
                                    syncIntervalSeconds: normalizedSeconds,
                                });
                            }}
                            disabled={isSaving}
                        />
                        <p className="text-xs text-muted-foreground">
                            {isZh
                                ? "单位为秒，最低 60 秒。手动同步不会受这个间隔限制。"
                                : "Measured in seconds, with a minimum of 60. Manual sync is not blocked by this interval."}
                        </p>
                    </div>
                ) : null}
            </CardContent>
        </Card>
    );

    if (embedded) {
        return content;
    }

    return <div className="flex flex-col gap-6">{content}</div>;
}
