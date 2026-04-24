"use client";

import { CheckCircle2, Database } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { MetalButton } from "@/components/metal-button";
import { Panel } from "@/components/panel";
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
        <Panel className="w-full max-w-2xl space-y-6">
            <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
                    <Database className="size-5 text-primary" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">
                        {isZh
                            ? "连接第一个数据源"
                            : "Connect your first data source"}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        {isZh
                            ? "先保存一个录音平台连接，后续导入录音、读取来源内容和本地私有转写都会复用这一层。"
                            : "Save one recording-platform connection first. Importing recordings, reading source content, and local private transcription all build on this layer."}
                    </p>
                </div>
            </div>

            {connectedProvider ? (
                <div className="space-y-4">
                    <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
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
                    <MetalButton
                        onClick={handleContinue}
                        variant="cyan"
                        className="w-full"
                    >
                        {isZh ? "继续" : "Continue"}
                    </MetalButton>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="source-provider">
                            {isZh ? "数据源" : "Data source"}
                        </Label>
                        <Select value={provider} onValueChange={selectProvider}>
                            <SelectTrigger id="source-provider">
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
                        <p className="text-xs text-muted-foreground">
                            {isZh
                                ? `${sourceLabel} 会作为你的第一个录音数据源接入。`
                                : `${sourceLabel} will be saved as your first recording data source.`}
                        </p>
                    </div>

                    {currentProviderCatalog.authModes.length > 1 ? (
                        <div className="space-y-2">
                            <Label htmlFor="source-auth-mode">
                                {isZh ? "登录方式" : "Sign-in method"}
                            </Label>
                            <Select
                                value={currentDraft.authMode}
                                onValueChange={setAuthMode}
                            >
                                <SelectTrigger
                                    id="source-auth-mode"
                                    disabled={isSaving}
                                >
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="z-[200]">
                                    {currentProviderCatalog.authModes.map(
                                        (mode) => (
                                            <SelectItem key={mode} value={mode}>
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
                                {isZh ? "服务地址" : "Service address"}
                            </Label>
                            <Input
                                id="source-base-url"
                                value={currentDraft.baseUrl}
                                onChange={(event) =>
                                    setServiceAddress(event.target.value)
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

                    <MetalButton
                        onClick={connectSource}
                        variant="cyan"
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
                    </MetalButton>
                </div>
            )}
        </Panel>
    );
}
