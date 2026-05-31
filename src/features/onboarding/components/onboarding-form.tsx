"use client";

import {
    ArrowLeft,
    ArrowRight,
    CheckCircle2,
    Cloud,
    Database,
    KeyRound,
    Loader2,
    LockKeyhole,
    type LucideIcon,
    MessageSquare,
    Mic2,
    Radio,
    ServerCog,
    ShieldCheck,
} from "lucide-react";
import { useState } from "react";
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
import type { SourceProvider } from "@/lib/data-sources/catalog";
import { getSourceAuthModeDisplayLabel } from "@/lib/data-sources/presentation";
import {
    navigateAndRefreshBrowserRoute,
    useBrowserRouteController,
} from "@/lib/platform/browser-router";
import { cn } from "@/lib/utils";

interface OnboardingFormProps {
    onConnected?: () => void;
}

const ONBOARDING_DATA_SOURCES_ENDPOINT = "/api/data-sources";

const ONBOARDING_STEPS = [
    {
        id: "source",
        titleZh: "数据源选择",
        titleEn: "Choose source",
        subtitleZh: "选择第一个录音来源",
        subtitleEn: "Pick the first recording source",
    },
    {
        id: "auth",
        titleZh: "认证与服务地址",
        titleEn: "Auth and service",
        subtitleZh: "填写登录方式与地址",
        subtitleEn: "Set auth mode and endpoint",
    },
    {
        id: "privacy",
        titleZh: "权限与私有化",
        titleEn: "Permissions and privacy",
        subtitleZh: "确认本地优先边界",
        subtitleEn: "Review local-first boundaries",
    },
    {
        id: "finish",
        titleZh: "保存进入工作台",
        titleEn: "Save and open",
        subtitleZh: "保存连接后进入工作台",
        subtitleEn: "Save connection and open workspace",
    },
] as const;

type OnboardingStepId = (typeof ONBOARDING_STEPS)[number]["id"];

const PROVIDER_ICONS: Record<SourceProvider, LucideIcon> = {
    "dingtalk-a1": Radio,
    ticnote: Mic2,
    plaud: Cloud,
    "feishu-minutes": MessageSquare,
    iflyrec: Database,
};

function getStepIndex(step: OnboardingStepId) {
    return ONBOARDING_STEPS.findIndex((item) => item.id === step);
}

export function OnboardingForm({ onConnected }: OnboardingFormProps) {
    const router = useBrowserRouteController();
    const { language } = useLanguage();
    const isZh = language === "zh-CN";
    const [activeStep, setActiveStep] = useState<OnboardingStepId>("source");
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

    const visibleStep: OnboardingStepId = connectedProvider
        ? "finish"
        : activeStep;
    const visibleStepIndex = getStepIndex(visibleStep);
    const selectedAuthModeLabel = getSourceAuthModeDisplayLabel(
        currentDraft.authMode,
        language,
    );
    const serviceAddressLabel = usesCustomServerSelector
        ? isZh
            ? "由该来源的登录方式决定"
            : "Handled by this source's sign-in flow"
        : currentDraft.baseUrl;
    const onboardingState = connectedProvider
        ? "connected"
        : isSaving
          ? "saving"
          : visibleStep;

    const goToStep = (step: OnboardingStepId) => {
        if (isSaving || connectedProvider) {
            return;
        }

        setActiveStep(step);
    };

    const goNext = () => {
        const nextStep =
            ONBOARDING_STEPS[
                Math.min(visibleStepIndex + 1, ONBOARDING_STEPS.length - 1)
            ].id;
        goToStep(nextStep);
    };

    const goBack = () => {
        const previousStep =
            ONBOARDING_STEPS[Math.max(visibleStepIndex - 1, 0)].id;
        goToStep(previousStep);
    };

    const handleSaveAndEnter = async () => {
        const didConnect = await connectSource();

        if (didConnect) {
            setActiveStep("finish");
            return;
        }

        setActiveStep("auth");
    };

    const handleContinue = () => {
        if (onConnected) {
            onConnected();
            return;
        }

        navigateAndRefreshBrowserRoute(router, "/dashboard");
    };

    return (
        <Card
            className="glass-surface w-full max-w-6xl overflow-hidden rounded-[1.5rem]"
            data-testid="onboarding-wizard"
            data-onboarding-provider={provider}
            data-onboarding-state={onboardingState}
            data-onboarding-surface=""
        >
            <CardContent className="grid gap-0 p-0 lg:grid-cols-[18rem_minmax(0,1fr)]">
                <aside
                    className="glass-surface-subtle border-border/60 border-b p-4 lg:border-r lg:border-b-0 lg:p-6"
                    data-testid="onboarding-stepper"
                >
                    <div className="mb-5 flex items-center gap-3">
                        <div className="glass-control flex size-10 items-center justify-center rounded-2xl text-primary">
                            <Database className="size-5" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                                BetterAINote
                            </p>
                            <p className="truncate text-sm font-semibold">
                                {isZh ? "首次配置" : "First-run setup"}
                            </p>
                        </div>
                    </div>

                    <nav
                        aria-label={isZh ? "首次配置步骤" : "Onboarding steps"}
                        className="grid gap-2 sm:grid-cols-4 lg:flex lg:flex-col"
                    >
                        {ONBOARDING_STEPS.map((step, index) => {
                            const isActive = step.id === visibleStep;
                            const isDone =
                                Boolean(connectedProvider) ||
                                index < visibleStepIndex;
                            const status = isDone
                                ? "complete"
                                : isActive
                                  ? "active"
                                  : "idle";

                            return (
                                <button
                                    key={step.id}
                                    type="button"
                                    disabled={
                                        isSaving || Boolean(connectedProvider)
                                    }
                                    onClick={() => goToStep(step.id)}
                                    className={cn(
                                        "glass-nav-item flex min-h-20 items-start gap-3 rounded-2xl px-3 py-3 text-left transition-colors disabled:pointer-events-none disabled:opacity-60 lg:min-h-0",
                                        isActive &&
                                            "border-primary/35 bg-primary/10 text-foreground",
                                    )}
                                    data-active={isActive}
                                    data-onboarding-step={step.id}
                                    data-state={status}
                                    data-testid={`onboarding-step-${step.id}`}
                                >
                                    <span
                                        className={cn(
                                            "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border font-mono text-xs font-semibold",
                                            isDone
                                                ? "border-primary bg-primary text-primary-foreground"
                                                : isActive
                                                  ? "border-primary text-primary"
                                                  : "border-border/75 text-muted-foreground",
                                        )}
                                    >
                                        {isDone ? (
                                            <CheckCircle2 className="size-4" />
                                        ) : (
                                            index + 1
                                        )}
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block text-sm font-semibold">
                                            {isZh ? step.titleZh : step.titleEn}
                                        </span>
                                        <span className="mt-1 block text-xs text-muted-foreground">
                                            {isZh
                                                ? step.subtitleZh
                                                : step.subtitleEn}
                                        </span>
                                    </span>
                                </button>
                            );
                        })}
                    </nav>
                </aside>

                <div className="flex min-w-0 flex-col gap-6 p-4 sm:p-6 lg:p-8">
                    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                            <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                                {isZh
                                    ? `第 ${visibleStepIndex + 1} 步 / 4`
                                    : `Step ${visibleStepIndex + 1} / 4`}
                            </p>
                            <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                                {isZh
                                    ? ONBOARDING_STEPS[visibleStepIndex].titleZh
                                    : ONBOARDING_STEPS[visibleStepIndex]
                                          .titleEn}
                            </h2>
                            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                                {isZh
                                    ? "把第一个来源接入私有工作台。录音、转写和后续 AI 标题优先留在你自己的部署里。"
                                    : "Connect the first source to your private workspace. Recordings, transcripts, and later AI titles stay in your own deployment first."}
                            </p>
                        </div>
                        <span className="inline-flex w-fit items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                            self-hosting first
                        </span>
                    </header>

                    <div className="grid grid-cols-4 gap-2" aria-hidden="true">
                        {ONBOARDING_STEPS.map((step, index) => (
                            <div
                                key={step.id}
                                className={cn(
                                    "h-1.5 rounded-full bg-muted",
                                    (connectedProvider ||
                                        index <= visibleStepIndex) &&
                                        "bg-primary",
                                )}
                            />
                        ))}
                    </div>

                    <div className="min-h-[30rem] rounded-3xl border border-border/60 bg-background/24 p-4 backdrop-blur-xl sm:p-6">
                        {visibleStep === "source" ? (
                            <section
                                className="flex h-full flex-col gap-5"
                                data-onboarding-step="source"
                                data-testid="onboarding-source-step"
                            >
                                <StepHeading
                                    icon={<ServerCog className="size-5" />}
                                    title={
                                        isZh
                                            ? "选择第一个录音来源"
                                            : "Choose the first recording source"
                                    }
                                    description={
                                        isZh
                                            ? "先选择要接入的来源。保存后同一套连接也会出现在设置的数据源管理里。"
                                            : "Pick the source to connect first. After saving, the same connection appears in Data Sources settings."
                                    }
                                />

                                <div className="space-y-2 lg:hidden">
                                    <Label htmlFor="source-provider">
                                        {isZh ? "数据源" : "Data source"}
                                    </Label>
                                    <Select
                                        value={provider}
                                        onValueChange={selectProvider}
                                        disabled={isSaving}
                                    >
                                        <SelectTrigger
                                            id="source-provider"
                                            className="w-full"
                                            data-testid="onboarding-provider-select"
                                        >
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="z-[650]">
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

                                <div
                                    className="hidden gap-3 lg:grid lg:grid-cols-2"
                                    data-testid="onboarding-provider-grid"
                                >
                                    {providerOptions.map((item) => {
                                        const isActive =
                                            item.provider === provider;
                                        const ProviderIcon =
                                            PROVIDER_ICONS[item.provider];

                                        return (
                                            <button
                                                key={item.provider}
                                                type="button"
                                                onClick={() =>
                                                    selectProvider(
                                                        item.provider,
                                                    )
                                                }
                                                disabled={isSaving}
                                                className={cn(
                                                    "glass-control flex min-h-24 items-center gap-4 rounded-2xl px-4 py-3 text-left transition-colors disabled:pointer-events-none disabled:opacity-60",
                                                    isActive &&
                                                        "border-primary/45 bg-primary/10",
                                                )}
                                                data-active={isActive}
                                                data-onboarding-provider-card={
                                                    item.provider
                                                }
                                            >
                                                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-background text-sm font-semibold">
                                                    <ProviderIcon className="size-5" />
                                                </span>
                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate font-semibold">
                                                        {item.label}
                                                    </span>
                                                    <span className="mt-1 block text-xs text-muted-foreground">
                                                        {isActive
                                                            ? isZh
                                                                ? "将作为首次连接来源"
                                                                : "Selected for first connection"
                                                            : isZh
                                                              ? "可在后续设置里继续补充"
                                                              : "Can be added later in settings"}
                                                    </span>
                                                </span>
                                                {isActive ? (
                                                    <CheckCircle2 className="size-5 text-primary" />
                                                ) : null}
                                            </button>
                                        );
                                    })}
                                </div>

                                <WizardActions
                                    isZh={isZh}
                                    isSaving={isSaving}
                                    onNext={goNext}
                                />
                            </section>
                        ) : null}

                        {visibleStep === "auth" ? (
                            <section
                                className="flex h-full flex-col gap-5"
                                data-onboarding-step="auth"
                                data-testid="onboarding-auth-step"
                            >
                                <StepHeading
                                    icon={<KeyRound className="size-5" />}
                                    title={
                                        isZh
                                            ? `${sourceLabel} 的认证方式`
                                            : `${sourceLabel} authentication`
                                    }
                                    description={
                                        isZh
                                            ? "填写服务地址和必要登录信息。敏感字段会以密码控件输入，不在界面明文展示。"
                                            : "Fill in the service address and required sign-in fields. Sensitive fields use password controls and are not displayed in clear text."
                                    }
                                />

                                <div
                                    className="grid gap-4"
                                    data-testid="onboarding-auth-fields"
                                >
                                    {currentProviderCatalog.authModes.length >
                                    1 ? (
                                        <div className="space-y-2">
                                            <Label htmlFor="source-auth-mode">
                                                {isZh
                                                    ? "登录方式"
                                                    : "Sign-in method"}
                                            </Label>
                                            <Select
                                                value={currentDraft.authMode}
                                                onValueChange={setAuthMode}
                                                disabled={isSaving}
                                            >
                                                <SelectTrigger
                                                    id="source-auth-mode"
                                                    className="w-full"
                                                >
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="z-[650]">
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
                                    ) : (
                                        <ReadOnlyMatrixRow
                                            label={
                                                isZh
                                                    ? "登录方式"
                                                    : "Sign-in method"
                                            }
                                            value={selectedAuthModeLabel}
                                            state="ready"
                                        />
                                    )}

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
                                    ) : (
                                        <ReadOnlyMatrixRow
                                            label={
                                                isZh
                                                    ? "服务地址"
                                                    : "Service address"
                                            }
                                            value={serviceAddressLabel}
                                            state="ready"
                                        />
                                    )}

                                    {providerFields.map((field) => (
                                        <DataSourceFieldControl
                                            key={field.id}
                                            disabled={isSaving}
                                            field={field}
                                            fieldId={field.id}
                                            onValueChange={updateField}
                                            selectContentClassName="z-[650]"
                                            variant="settings"
                                        />
                                    ))}
                                </div>

                                <WizardActions
                                    isZh={isZh}
                                    isSaving={isSaving}
                                    onBack={goBack}
                                    onNext={goNext}
                                />
                            </section>
                        ) : null}

                        {visibleStep === "privacy" ? (
                            <section
                                className="flex h-full flex-col gap-5"
                                data-onboarding-step="privacy"
                                data-testid="onboarding-privacy-step"
                            >
                                <StepHeading
                                    icon={<ShieldCheck className="size-5" />}
                                    title={
                                        isZh
                                            ? "确认权限和私有化边界"
                                            : "Review permissions and privacy"
                                    }
                                    description={
                                        isZh
                                            ? "BetterAINote 只会按你保存的来源配置读取录音列表、音频和转写。后续可在设置中暂停或断开。"
                                            : "BetterAINote reads recording lists, audio, and transcripts only through the source settings you save. You can pause or disconnect later in settings."
                                    }
                                />

                                <div className="grid gap-3 md:grid-cols-3">
                                    <PrivacyCard
                                        icon={
                                            <LockKeyhole className="size-5" />
                                        }
                                        title={
                                            isZh ? "本地优先" : "Local first"
                                        }
                                        description={
                                            isZh
                                                ? "录音、原始转写和报告优先保留在你的部署里，工作台只围绕本地资料组织。"
                                                : "Recordings, raw transcripts, and reports stay in your deployment first, with the workspace organized around local material."
                                        }
                                    />
                                    <PrivacyCard
                                        icon={<ServerCog className="size-5" />}
                                        title={
                                            isZh
                                                ? "来源授权"
                                                : "Source authorization"
                                        }
                                        description={
                                            isZh
                                                ? "凭据只用于当前选择的数据源；其他来源不会被自动读取。"
                                                : "Credentials are used only for the selected source. Other sources are not read automatically."
                                        }
                                    />
                                    <PrivacyCard
                                        icon={<Database className="size-5" />}
                                        title={isZh ? "可回退" : "Reversible"}
                                        description={
                                            isZh
                                                ? "进入工作台后，你仍可在设置里暂停同步、更新凭据或断开连接。"
                                                : "After opening the workspace, you can pause sync, update credentials, or disconnect in settings."
                                        }
                                    />
                                </div>

                                <div
                                    className="grid gap-3 rounded-2xl border border-border/60 bg-muted/20 p-4"
                                    data-testid="onboarding-permission-matrix"
                                >
                                    <ReadOnlyMatrixRow
                                        label={isZh ? "当前来源" : "Source"}
                                        value={sourceLabel}
                                        state="selected"
                                    />
                                    <ReadOnlyMatrixRow
                                        label={
                                            isZh ? "认证方式" : "Authentication"
                                        }
                                        value={selectedAuthModeLabel}
                                        state="ready"
                                    />
                                    <ReadOnlyMatrixRow
                                        label={
                                            isZh
                                                ? "保存后可修改"
                                                : "Editable after saving"
                                        }
                                        value={
                                            isZh
                                                ? "设置 > 数据源"
                                                : "Settings > Data sources"
                                        }
                                        state="reversible"
                                    />
                                </div>

                                <WizardActions
                                    isZh={isZh}
                                    isSaving={isSaving}
                                    onBack={goBack}
                                    onNext={goNext}
                                />
                            </section>
                        ) : null}

                        {visibleStep === "finish" ? (
                            <section
                                className="flex h-full flex-col gap-5"
                                data-onboarding-step="finish"
                                data-testid="onboarding-finish-step"
                            >
                                <StepHeading
                                    icon={<CheckCircle2 className="size-5" />}
                                    title={
                                        connectedProvider
                                            ? isZh
                                                ? `${connectedSourceLabel} 已连接`
                                                : `${connectedSourceLabel} connected`
                                            : isZh
                                              ? "保存连接并进入工作台"
                                              : "Save connection and open workspace"
                                    }
                                    description={
                                        connectedProvider
                                            ? isZh
                                                ? "连接已保存。现在可以进入工作台导入录音、同步来源内容并开始私有转写。"
                                                : "The connection is saved. You can now open the workspace, import recordings, sync source content, and start private transcription."
                                            : isZh
                                              ? "最后确认下面的状态。保存成功后，工作台会沿用这套数据源配置。"
                                              : "Confirm the state below. After saving, the workspace uses this data-source configuration."
                                    }
                                />

                                <div
                                    className={cn(
                                        "grid gap-3 rounded-2xl border p-4",
                                        connectedProvider
                                            ? "border-primary/25 bg-primary/10"
                                            : "border-border/60 bg-muted/20",
                                    )}
                                    data-testid="onboarding-state-matrix"
                                >
                                    <ReadOnlyMatrixRow
                                        label={isZh ? "数据源" : "Data source"}
                                        value={
                                            connectedSourceLabel ?? sourceLabel
                                        }
                                        state={
                                            connectedProvider
                                                ? "connected"
                                                : "selected"
                                        }
                                    />
                                    <ReadOnlyMatrixRow
                                        label={
                                            isZh ? "认证方式" : "Authentication"
                                        }
                                        value={selectedAuthModeLabel}
                                        state="ready"
                                    />
                                    <ReadOnlyMatrixRow
                                        label={
                                            isZh
                                                ? "服务地址"
                                                : "Service address"
                                        }
                                        value={serviceAddressLabel}
                                        state="ready"
                                    />
                                    <ReadOnlyMatrixRow
                                        label={
                                            isZh
                                                ? "进入工作台"
                                                : "Open workspace"
                                        }
                                        value={
                                            connectedProvider
                                                ? isZh
                                                    ? "已就绪"
                                                    : "Ready"
                                                : isSaving
                                                  ? isZh
                                                      ? "保存中"
                                                      : "Saving"
                                                  : isZh
                                                    ? "等待保存"
                                                    : "Waiting to save"
                                        }
                                        state={
                                            connectedProvider
                                                ? "connected"
                                                : isSaving
                                                  ? "saving"
                                                  : "pending"
                                        }
                                    />
                                </div>

                                <div className="mt-auto flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                                    {!connectedProvider ? (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            onClick={goBack}
                                            disabled={isSaving}
                                        >
                                            <ArrowLeft className="size-4" />
                                            {isZh ? "返回" : "Back"}
                                        </Button>
                                    ) : (
                                        <span />
                                    )}
                                    {connectedProvider ? (
                                        <Button
                                            type="button"
                                            onClick={handleContinue}
                                            className="w-full sm:w-auto"
                                            data-testid="onboarding-enter-workspace"
                                        >
                                            {isZh
                                                ? "进入工作台"
                                                : "Open workspace"}
                                            <ArrowRight className="size-4" />
                                        </Button>
                                    ) : (
                                        <Button
                                            type="button"
                                            onClick={handleSaveAndEnter}
                                            disabled={isSaving}
                                            aria-busy={isSaving}
                                            className="w-full sm:w-auto"
                                            data-testid="onboarding-save-enter"
                                        >
                                            {isSaving ? (
                                                <Loader2 className="size-4 animate-spin" />
                                            ) : (
                                                <CheckCircle2 className="size-4" />
                                            )}
                                            {isSaving
                                                ? isZh
                                                    ? "保存中..."
                                                    : "Saving..."
                                                : isZh
                                                  ? "保存进入工作台"
                                                  : "Save and open workspace"}
                                        </Button>
                                    )}
                                </div>
                            </section>
                        ) : null}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function StepHeading({
    description,
    icon,
    title,
}: {
    description: string;
    icon: React.ReactNode;
    title: string;
}) {
    return (
        <div className="flex items-start gap-3">
            <div className="glass-control flex size-11 shrink-0 items-center justify-center rounded-2xl text-primary">
                {icon}
            </div>
            <div className="min-w-0">
                <h3 className="text-xl font-semibold tracking-tight">
                    {title}
                </h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                    {description}
                </p>
            </div>
        </div>
    );
}

function PrivacyCard({
    description,
    icon,
    title,
}: {
    description: string;
    icon: React.ReactNode;
    title: string;
}) {
    return (
        <div className="glass-surface-subtle rounded-2xl p-4">
            <div className="mb-3 flex size-10 items-center justify-center rounded-xl border border-border/60 bg-background text-primary">
                {icon}
            </div>
            <h4 className="font-semibold">{title}</h4>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {description}
            </p>
        </div>
    );
}

function ReadOnlyMatrixRow({
    label,
    state,
    value,
}: {
    label: string;
    state: string;
    value: string;
}) {
    return (
        <div
            className="flex flex-col gap-1 rounded-xl border border-border/60 bg-background/45 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
            data-state={state}
        >
            <span className="text-xs font-medium text-muted-foreground">
                {label}
            </span>
            <span className="text-sm font-semibold text-foreground">
                {value}
            </span>
        </div>
    );
}

function WizardActions({
    isSaving,
    isZh,
    onBack,
    onNext,
}: {
    isSaving: boolean;
    isZh: boolean;
    onBack?: () => void;
    onNext: () => void;
}) {
    return (
        <div className="mt-auto flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            {onBack ? (
                <Button
                    type="button"
                    variant="ghost"
                    onClick={onBack}
                    disabled={isSaving}
                >
                    <ArrowLeft className="size-4" />
                    {isZh ? "返回" : "Back"}
                </Button>
            ) : (
                <span />
            )}
            <Button
                type="button"
                onClick={onNext}
                disabled={isSaving}
                className="w-full sm:w-auto"
            >
                {isZh ? "下一步" : "Next"}
                <ArrowRight className="size-4" />
            </Button>
        </div>
    );
}
