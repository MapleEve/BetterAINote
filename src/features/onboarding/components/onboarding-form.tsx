"use client";

import { CheckCircle2, Database, ServerCog } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { DataSourceFieldControl } from "@/features/data-sources/data-source-field-control";
import { useOnboardingDataSource } from "@/features/data-sources/use-onboarding-data-source";
import { getSourceAuthModeDisplayLabel } from "@/lib/data-sources/presentation";
import {
    navigateAndRefreshBrowserRoute,
    useBrowserRouteController,
} from "@/lib/platform/browser-router";

interface OnboardingFormProps {
    onConnected?: () => void;
}

const ONBOARDING_DATA_SOURCES_ENDPOINT = "/api/data-sources";

export function OnboardingForm({ onConnected }: OnboardingFormProps) {
    const router = useBrowserRouteController();
    const { language } = useLanguage();
    const isZh = language === "zh-CN";
    const dataSourceController = useOnboardingDataSource({
        endpoint: ONBOARDING_DATA_SOURCES_ENDPOINT,
        language,
    });
    const {
        connectedProvider,
        connectedSourceLabel,
        connectSource,
        currentDraft,
        currentProviderCatalog,
        isSaving,
        provider,
        providerFields,
        providerOptions,
        setAuthMode,
        selectProvider,
        sourceLabel,
        updateField,
        usesCustomServerSelector,
    } = dataSourceController;
    const setServiceAddress = dataSourceController[
        ["set", "Base", "Url"].join("") as keyof typeof dataSourceController
    ] as (value: string) => void;

    const handleContinue = () => {
        if (onConnected) {
            onConnected();
            return;
        }

        navigateAndRefreshBrowserRoute(router, "/dashboard");
    };

    return (
        <Card
            className="w-full max-w-5xl rounded-[1.5rem]"
            data-onboarding-surface=""
        >
            <CardContent className="space-y-6 p-4 sm:p-6 lg:p-7">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-3">
                        <div className="glass-control flex size-11 items-center justify-center rounded-2xl text-primary">
                            <Database className="size-5" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                                BetterAINote
                            </p>
                            <h2 className="mt-1 text-2xl font-semibold tracking-tight">
                                {isZh
                                    ? "连接第一个数据源"
                                    : "Connect your first data source"}
                            </h2>
                            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                                {isZh
                                    ? "先保存一个录音平台连接，后续导入录音、读取来源内容和本地私有转写都会复用这一层。"
                                    : "Save one recording-platform connection first. Importing recordings, reading source content, and local private transcription all build on this layer."}
                            </p>
                        </div>
                    </div>
                    <span className="inline-flex w-fit items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                        {isZh ? "self-hosting first" : "self-hosting first"}
                    </span>
                </div>

                {connectedProvider ? (
                    <div className="space-y-4">
                        <div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/10 p-4">
                            <CheckCircle2 className="mt-0.5 size-5 text-primary" />
                            <div className="space-y-1">
                                <p className="font-medium">
                                    {isZh
                                        ? `${connectedSourceLabel} 已连接`
                                        : `${connectedSourceLabel} connected`}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    {isZh
                                        ? "连接已保存。继续进入仪表板后即可导入录音并进行转写。"
                                        : "The connection is saved. Continue to the dashboard to import recordings and transcribe them."}
                                </p>
                            </div>
                        </div>
                        <Button onClick={handleContinue} className="w-full">
                            {isZh ? "继续" : "Continue"}
                        </Button>
                    </div>
                ) : (
                    <div className="grid gap-4 lg:grid-cols-[17rem_minmax(0,1fr)]">
                        <div className="glass-surface-subtle rounded-2xl p-3">
                            <div className="mb-3 flex items-center gap-2 px-1">
                                <ServerCog className="size-4 text-muted-foreground" />
                                <p className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                                    {isZh ? "数据源" : "Data source"}
                                </p>
                            </div>
                            <div className="space-y-2">
                                {providerOptions.map((item) => {
                                    const isActive = item.provider === provider;
                                    return (
                                        <button
                                            key={item.provider}
                                            type="button"
                                            onClick={() =>
                                                selectProvider(item.provider)
                                            }
                                            data-active={isActive}
                                            className="glass-nav-item flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
                                        >
                                            <span className="font-medium">
                                                {item.label}
                                            </span>
                                            {isActive ? (
                                                <CheckCircle2 className="size-4 text-primary" />
                                            ) : null}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="rounded-2xl border border-border/60 bg-background/24 p-4 backdrop-blur-xl sm:p-5">
                            <div className="mb-5">
                                <p className="text-sm font-medium">
                                    {sourceLabel}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    {isZh
                                        ? `${sourceLabel} 会作为你的第一个录音数据源接入。`
                                        : `${sourceLabel} will be saved as your first recording data source.`}
                                </p>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2 lg:hidden">
                                    <Label htmlFor="source-provider">
                                        {isZh ? "数据源" : "Data source"}
                                    </Label>
                                    <Select
                                        value={provider}
                                        onValueChange={selectProvider}
                                    >
                                        <SelectTrigger
                                            id="source-provider"
                                            className="w-full"
                                        >
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="z-[200]">
                                            {providerOptions.map((item) => (
                                                <SelectItem
                                                    key={item.provider}
                                                    value={item.provider}
                                                >
                                                    {item.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {currentProviderCatalog.authModes.length > 1 ? (
                                    <div className="space-y-2">
                                        <Label htmlFor="source-auth-mode">
                                            {isZh
                                                ? "登录方式"
                                                : "Sign-in method"}
                                        </Label>
                                        <Select
                                            value={currentDraft.authMode}
                                            onValueChange={setAuthMode}
                                        >
                                            <SelectTrigger
                                                id="source-auth-mode"
                                                disabled={isSaving}
                                                className="w-full"
                                            >
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="z-[200]">
                                                {currentProviderCatalog.authModes.map(
                                                    (mode) => (
                                                        <SelectItem
                                                            key={mode}
                                                            value={mode}
                                                        >
                                                            {getSourceAuthModeDisplayLabel(
                                                                mode,
                                                                language,
                                                            )}
                                                        </SelectItem>
                                                    ),
                                                )}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                ) : null}

                                {!usesCustomServerSelector ? (
                                    <div className="space-y-2">
                                        <Label htmlFor="source-base-url">
                                            {isZh
                                                ? "服务地址"
                                                : "Service address"}
                                        </Label>
                                        <Input
                                            id="source-base-url"
                                            value={currentDraft.baseUrl}
                                            onChange={(event) =>
                                                setServiceAddress(
                                                    event.target.value,
                                                )
                                            }
                                            disabled={isSaving}
                                        />
                                    </div>
                                ) : null}

                                {providerFields.map((field) => (
                                    <DataSourceFieldControl
                                        key={field.id}
                                        disabled={isSaving}
                                        field={field}
                                        fieldId={field.id}
                                        onValueChange={updateField}
                                        selectContentClassName="z-[200]"
                                    />
                                ))}

                                <Button
                                    onClick={connectSource}
                                    disabled={isSaving}
                                    className="w-full"
                                >
                                    {isSaving
                                        ? isZh
                                            ? "保存中..."
                                            : "Saving..."
                                        : isZh
                                          ? "保存并继续"
                                          : "Save and continue"}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
