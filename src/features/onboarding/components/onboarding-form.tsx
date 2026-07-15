"use client";

import {
    CheckCircle2,
    Cloud,
    Database,
    Loader2,
    type LucideIcon,
    MessageSquare,
    Mic2,
    Radio,
    UserRound,
} from "lucide-react";
import Image from "next/image";
import { type ReactNode, useEffect, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Field,
    FieldContent,
    FieldControl,
    FieldDescription,
    FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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
        title: "连接来源",
        hint: "选择第一个录音来源并填写授权",
    },
    {
        id: "transcription",
        title: "选一个默认转写来源",
        hint: "未指定来源时，新录音从这里读取",
    },
    {
        id: "speakers",
        title: "说话人档案",
        hint: "先建一个常用说话人，之后可继续补充",
    },
    {
        id: "finish",
        title: "完成",
        hint: "保存配置并进入工作台",
    },
] as const;

type OnboardingStepId = (typeof ONBOARDING_STEPS)[number]["id"];
type DefaultTranscriptionSource = "dingtalk-a1" | "ticnote" | "feishu-minutes";

const DEFAULT_TRANSCRIPTION_SOURCE_OPTIONS = [
    {
        id: "dingtalk-a1",
        label: "钉钉 闪记",
        swatch: "accent",
    },
    {
        id: "ticnote",
        label: "TicNote",
        swatch: "empty",
    },
    {
        id: "feishu-minutes",
        label: "飞书妙记",
        swatch: "empty",
    },
] as const satisfies ReadonlyArray<{
    id: DefaultTranscriptionSource;
    label: string;
    swatch: "accent" | "empty";
}>;

function isDefaultTranscriptionSource(
    provider: SourceProvider,
): provider is DefaultTranscriptionSource {
    return DEFAULT_TRANSCRIPTION_SOURCE_OPTIONS.some(
        (option) => option.id === provider,
    );
}

const PROVIDER_ICONS: Record<SourceProvider, LucideIcon> = {
    "dingtalk-a1": Radio,
    ticnote: Mic2,
    plaud: Cloud,
    "feishu-minutes": MessageSquare,
    iflyrec: Database,
};

const PROVIDER_ASSETS: Partial<Record<SourceProvider, string>> = {
    "dingtalk-a1": "/assets/sources/dingtalk.svg",
    ticnote: "/assets/sources/ticnote.png",
    plaud: "/assets/sources/plaud.png",
    "feishu-minutes": "/assets/sources/feishu.jpeg",
};

const onboardingCardClassNames = {
    layout: "grid min-h-svh place-items-center bg-background px-8 pb-20 pt-7 text-foreground",
    surface:
        "block min-h-96 w-full max-w-md box-border gap-0 overflow-visible rounded-xl border border-border bg-card p-5 shadow-sm backdrop-blur-none",
    frame: "overflow-hidden rounded-xl border border-border bg-background p-5",
    speakerDraft:
        "flex flex-row items-center gap-3 border-primary/50 bg-primary/10 p-3.5",
    providerCard:
        "flex h-auto w-full flex-row items-center justify-start gap-3 rounded-md px-3.5 py-3 text-left whitespace-normal",
    providerList: "mb-5 flex w-full flex-col items-stretch gap-2",
    summaryList: "mb-5 flex flex-col gap-2",
    matrixRow:
        "m-0 flex min-h-8 items-baseline gap-2 border-b border-dashed border-border py-1.5",
    matrixLabel:
        "m-0 w-20 flex-none text-xs font-semibold text-muted-foreground",
    matrixValue:
        "m-0 min-w-0 flex-1 break-words text-xs font-medium text-foreground",
    sourceAuthModeGroup: "grid w-full grid-cols-2 items-stretch",
    sourceAuthModeOption:
        "h-auto flex-col items-start justify-start whitespace-normal px-3.5 py-3 text-left",
    sourceField: "flex-col gap-2",
    sourceFieldContent: "min-w-0 gap-1",
    sourceFieldDescription:
        "max-w-full text-xs leading-normal text-muted-foreground",
    sourceFieldControl: "min-w-0 flex-1",
    sourceProviderFields: "flex flex-col gap-0",
    header: "grid auto-rows-min gap-0 p-0",
    steps: "mb-3.5 flex gap-1.5",
    step: "h-1 flex-1 rounded-sm bg-muted p-0 hover:bg-muted disabled:cursor-not-allowed",
    stepHeader: "grid auto-rows-min gap-0 p-0",
    providerMeta: "grid min-w-0 auto-rows-min gap-0 p-0",
    heading: "mb-1 text-sm font-semibold text-foreground",
    sub: "mb-3.5 text-xs leading-normal text-muted-foreground",
    stepTitle: "text-sm font-semibold text-foreground",
    stepDescription: "mb-3.5 text-xs text-muted-foreground",
    errorMessage: "text-xs text-muted-foreground",
    stepBody: "flex flex-col gap-3 p-0",
    defaultSources: "flex w-full flex-col items-stretch gap-1.5",
    defaultSource:
        "h-auto w-full justify-start whitespace-normal px-3 py-2 text-left",
    actions: "mt-3.5 flex justify-end gap-2",
    providerIcon:
        "inline-flex size-9 flex-none items-center justify-center overflow-hidden rounded-md border border-border bg-card text-foreground",
    providerName: "text-sm font-semibold text-foreground",
    providerHint: "mt-0.5 text-xs font-medium text-muted-foreground",
} as const;

const DEFAULT_SOURCE_SWATCH_CLASS_NAMES = {
    accent: "size-5 flex-none rounded bg-primary",
    empty: "size-5 flex-none rounded bg-muted",
} as const;

function getStepIndex(step: OnboardingStepId) {
    return ONBOARDING_STEPS.findIndex((item) => item.id === step);
}

function OnboardingFieldRow({
    children,
    description,
    disabled = false,
    id,
    label,
}: {
    children: ReactNode;
    description: string;
    disabled?: boolean;
    id: string;
    label: string;
}) {
    return (
        <Field
            className={onboardingCardClassNames.sourceField}
            data-disabled={disabled ? "true" : undefined}
            orientation="responsive"
        >
            <FieldContent
                className={onboardingCardClassNames.sourceFieldContent}
            >
                <FieldLabel htmlFor={id}>{label}</FieldLabel>
                <FieldDescription
                    className={onboardingCardClassNames.sourceFieldDescription}
                >
                    {description}
                </FieldDescription>
            </FieldContent>
            <FieldControl
                className={onboardingCardClassNames.sourceFieldControl}
            >
                {children}
            </FieldControl>
        </Field>
    );
}

export function OnboardingForm({ onConnected }: OnboardingFormProps) {
    const router = useBrowserRouteController();
    const { language } = useLanguage();
    const isZh = language === "zh-CN";
    const [isMounted, setIsMounted] = useState(false);
    const [activeStep, setActiveStep] = useState<OnboardingStepId>("source");
    const [defaultTranscriptionSource, setDefaultTranscriptionSource] =
        useState<DefaultTranscriptionSource | null>(null);
    const [speakerName, setSpeakerName] = useState("");
    const [speakerVoiceprint, setSpeakerVoiceprint] = useState("");
    const [speakerState, setSpeakerState] = useState<
        "idle" | "saving" | "saved" | "error"
    >("idle");
    const [finishError, setFinishError] = useState<string | null>(null);
    const [isFinishing, setIsFinishing] = useState(false);
    const [transcriptionSaved, setTranscriptionSaved] = useState(false);
    const {
        connectedProvider,
        connectedProviders,
        connectedSourceLabel,
        connectSource,
        currentDraft,
        currentProviderCatalog,
        isSaving,
        provider,
        providerFields,
        providerOptions,
        selectProvider,
        setAuthMode,
        setBaseUrl,
        sourceLabel,
        updateField,
        usesCustomServerSelector,
    } = useOnboardingDataSource({
        endpoint: ONBOARDING_DATA_SOURCES_ENDPOINT,
        language,
    });

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const visibleStep = connectedProvider ? "finish" : activeStep;
    const visibleStepIndex = getStepIndex(visibleStep);
    const progressPct = [25, 40, 75, 100][visibleStepIndex] ?? 25;
    const selectedAuthModeLabel = getSourceAuthModeDisplayLabel(
        currentDraft.authMode,
        language,
    );
    const sourceServiceLabel = usesCustomServerSelector
        ? isZh
            ? "由来源登录方式决定"
            : "Handled by the source sign-in method"
        : currentDraft.baseUrl;
    const currentDraftTranscriptionSource = isDefaultTranscriptionSource(
        provider,
    )
        ? provider
        : null;
    const selectedDefaultTranscriptionSource =
        defaultTranscriptionSource &&
        (connectedProviders.includes(defaultTranscriptionSource) ||
            currentDraftTranscriptionSource === defaultTranscriptionSource)
            ? defaultTranscriptionSource
            : null;
    const controlsLocked = !isMounted || isSaving || isFinishing;
    const visibleStepTitle = `第 ${visibleStepIndex + 1} 步 · ${
        ONBOARDING_STEPS[visibleStepIndex].title
    }`;

    const goToStep = (step: OnboardingStepId) => {
        if (controlsLocked) return;
        setFinishError(null);
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

    const saveTranscriptionDefaults = async (
        defaultTranscriptionProvider: DefaultTranscriptionSource | null,
    ) => {
        const response = await fetch("/api/settings/transcription", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                autoTranscribe:
                    defaultTranscriptionProvider !== "feishu-minutes",
                defaultTranscriptionLanguage:
                    defaultTranscriptionProvider === "feishu-minutes"
                        ? null
                        : language === "zh-CN"
                          ? "zh"
                          : "en",
                defaultTranscriptionProvider,
            }),
        });

        if (!response.ok) {
            throw new Error("默认转写保存失败");
        }

        setTranscriptionSaved(true);
    };

    const saveSpeakerProfile = async () => {
        const trimmedName = speakerName.trim();
        if (!trimmedName || speakerState === "saved") {
            return;
        }

        setSpeakerState("saving");
        try {
            const response = await fetch("/api/speakers/profiles", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    displayName: trimmedName,
                    voiceprintRef: speakerVoiceprint.trim() || null,
                }),
            });

            if (!response.ok) {
                throw new Error("说话人档案保存失败");
            }

            setSpeakerState("saved");
        } catch (error) {
            setSpeakerState("error");
            throw error instanceof Error
                ? error
                : new Error("说话人档案保存失败");
        }
    };

    const handleFinish = async () => {
        if (!isMounted) return;

        setFinishError(null);
        setIsFinishing(true);

        try {
            const defaultTranscriptionProvider =
                selectedDefaultTranscriptionSource;
            const didConnect = connectedProvider ? true : await connectSource();
            if (!didConnect) {
                setActiveStep("source");
                setFinishError("来源连接失败，请检查授权信息后重试。");
                return;
            }

            await saveTranscriptionDefaults(defaultTranscriptionProvider);
            await saveSpeakerProfile();

            if (onConnected) {
                onConnected();
                return;
            }

            navigateAndRefreshBrowserRoute(router, "/dashboard");
        } catch (error) {
            setFinishError(error instanceof Error ? error.message : "保存失败");
        } finally {
            setIsFinishing(false);
        }
    };

    return (
        <main
            aria-busy={isSaving || isFinishing}
            aria-labelledby="onboarding-title"
            className={onboardingCardClassNames.layout}
        >
            <Card hasNoPadding className={onboardingCardClassNames.surface}>
                <CardHeader className={onboardingCardClassNames.header}>
                    <CardTitle
                        aria-level={1}
                        className={onboardingCardClassNames.heading}
                        id="onboarding-title"
                        role="heading"
                    >
                        上手 / Onboarding · 4 步
                    </CardTitle>
                    <CardDescription className={onboardingCardClassNames.sub}>
                        连接来源 → 选默认转写 → 设置说话人档案 → 完成
                    </CardDescription>
                </CardHeader>
                <section
                    aria-busy={isSaving || isFinishing}
                    aria-describedby="onboarding-step-description"
                    aria-labelledby="onboarding-step-title"
                    className={onboardingCardClassNames.frame}
                >
                    <Progress
                        aria-label={`配置进度：${visibleStepTitle}`}
                        className="mb-3.5"
                        value={progressPct}
                    />
                    <nav aria-label="上手步骤">
                        <ol
                            className={cn(
                                onboardingCardClassNames.steps,
                                "list-none p-0",
                            )}
                        >
                            {ONBOARDING_STEPS.map((step, index) => {
                                const isActive = step.id === visibleStep;
                                const isDone =
                                    connectedProvider !== null ||
                                    index < visibleStepIndex;

                                return (
                                    <li key={step.id}>
                                        <Button
                                            aria-current={
                                                isActive ? "step" : undefined
                                            }
                                            aria-label={`第 ${index + 1} 步 · ${step.title}`}
                                            className={cn(
                                                onboardingCardClassNames.step,
                                                (isDone || isActive) &&
                                                    "bg-primary hover:bg-primary/90",
                                            )}
                                            disabled={controlsLocked}
                                            onClick={() => goToStep(step.id)}
                                            size="xs"
                                            type="button"
                                            variant="ghost"
                                        />
                                    </li>
                                );
                            })}
                        </ol>
                    </nav>
                    <header className={onboardingCardClassNames.stepHeader}>
                        <h2
                            className={onboardingCardClassNames.stepTitle}
                            id="onboarding-step-title"
                        >
                            {visibleStepTitle}
                        </h2>
                        <p
                            className={onboardingCardClassNames.stepDescription}
                            id="onboarding-step-description"
                        >
                            {ONBOARDING_STEPS[visibleStepIndex].hint}
                        </p>
                    </header>
                    <CardContent className={onboardingCardClassNames.stepBody}>
                        {finishError ? (
                            <Alert
                                aria-live="assertive"
                                density="compact"
                                id="onboarding-finish-error"
                                variant="statusError"
                            >
                                <AlertDescription density="compact">
                                    {finishError}
                                </AlertDescription>
                            </Alert>
                        ) : null}

                        {visibleStep === "source" ? (
                            <SourceStep
                                currentDraft={currentDraft}
                                currentProviderCatalog={currentProviderCatalog}
                                isSaving={controlsLocked}
                                language={language}
                                onNext={goNext}
                                provider={provider}
                                providerFields={providerFields}
                                providerOptions={providerOptions}
                                selectedAuthModeLabel={selectedAuthModeLabel}
                                selectProvider={selectProvider}
                                setAuthMode={setAuthMode}
                                setBaseUrl={setBaseUrl}
                                sourceLabel={sourceLabel}
                                sourceServiceLabel={sourceServiceLabel}
                                updateField={updateField}
                                usesCustomServerSelector={
                                    usesCustomServerSelector
                                }
                            />
                        ) : null}

                        {visibleStep === "transcription" ? (
                            <TranscriptionStep
                                connectedProviders={connectedProviders}
                                currentDraftTranscriptionSource={
                                    currentDraftTranscriptionSource
                                }
                                defaultTranscriptionSource={
                                    selectedDefaultTranscriptionSource
                                }
                                isSaving={controlsLocked}
                                onBack={goBack}
                                onNext={goNext}
                                setDefaultTranscriptionSource={
                                    setDefaultTranscriptionSource
                                }
                            />
                        ) : null}

                        {visibleStep === "speakers" ? (
                            <SpeakersStep
                                isSaving={controlsLocked}
                                onBack={goBack}
                                onNext={goNext}
                                setSpeakerName={setSpeakerName}
                                setSpeakerVoiceprint={setSpeakerVoiceprint}
                                speakerName={speakerName}
                                speakerState={speakerState}
                                speakerVoiceprint={speakerVoiceprint}
                            />
                        ) : null}

                        {visibleStep === "finish" ? (
                            <FinishStep
                                connectedSourceLabel={connectedSourceLabel}
                                defaultTranscriptionSource={
                                    selectedDefaultTranscriptionSource
                                }
                                finishError={finishError}
                                isFinishing={isFinishing}
                                isSaving={controlsLocked}
                                onBack={goBack}
                                onFinish={() => void handleFinish()}
                                selectedAuthModeLabel={selectedAuthModeLabel}
                                sourceLabel={sourceLabel}
                                speakerName={speakerName}
                                speakerState={speakerState}
                                transcriptionSaved={transcriptionSaved}
                            />
                        ) : null}
                    </CardContent>
                </section>
            </Card>
        </main>
    );
}

function SourceStep({
    currentDraft,
    currentProviderCatalog,
    isSaving,
    language,
    onBack,
    onNext,
    provider,
    providerFields,
    providerOptions,
    selectedAuthModeLabel,
    selectProvider,
    setAuthMode,
    setBaseUrl,
    sourceLabel,
    sourceServiceLabel,
    updateField,
    usesCustomServerSelector,
}: {
    currentDraft: { authMode: string; baseUrl: string };
    currentProviderCatalog: { authModes: string[] };
    isSaving: boolean;
    language: "zh-CN" | "en";
    onBack?: () => void;
    onNext: () => void;
    provider: SourceProvider;
    providerFields: Parameters<typeof DataSourceFieldControl>[0]["field"][];
    providerOptions: Array<{ label: string; provider: SourceProvider }>;
    selectedAuthModeLabel: string;
    selectProvider: (provider: string) => void;
    setAuthMode: (authMode: string) => void;
    setBaseUrl: (baseUrl: string) => void;
    sourceLabel: string;
    sourceServiceLabel: string;
    updateField: (
        field: Parameters<typeof DataSourceFieldControl>[0]["field"],
        value: string | boolean,
    ) => void;
    usesCustomServerSelector: boolean;
}) {
    return (
        <>
            <OnboardingFieldRow
                description="未指定来源时，新录音从这里读取"
                disabled={isSaving}
                id="source-provider"
                label="来源"
            >
                <Select
                    aria-label="来源"
                    disabled={isSaving}
                    id="source-provider"
                    onValueChange={selectProvider}
                    options={providerOptions.map((item) => ({
                        label: item.label,
                        value: item.provider,
                    }))}
                    value={provider}
                />
            </OnboardingFieldRow>

            <ToggleGroup
                aria-label="来源"
                className={onboardingCardClassNames.providerList}
                disabled={isSaving}
                onValueChange={(value) => {
                    if (value) {
                        selectProvider(value);
                    }
                }}
                orientation="vertical"
                spacing={2}
                type="single"
                value={provider}
                variant="outline"
            >
                {providerOptions.map((item) => {
                    const isActive = item.provider === provider;
                    const ProviderIcon = PROVIDER_ICONS[item.provider];
                    const asset = PROVIDER_ASSETS[item.provider];

                    return (
                        <ToggleGroupItem
                            className={cn(
                                onboardingCardClassNames.providerCard,
                                isActive && "border-transparent",
                            )}
                            disabled={isSaving}
                            key={item.provider}
                            value={item.provider}
                        >
                            <span
                                aria-hidden="true"
                                className={
                                    onboardingCardClassNames.providerIcon
                                }
                            >
                                {asset ? (
                                    <Image
                                        src={asset}
                                        alt=""
                                        width={36}
                                        height={36}
                                        className={cn(
                                            "block size-full",
                                            item.provider === "feishu-minutes"
                                                ? "object-cover"
                                                : "object-contain",
                                        )}
                                    />
                                ) : (
                                    <ProviderIcon />
                                )}
                            </span>
                            <span
                                className={
                                    onboardingCardClassNames.providerMeta
                                }
                            >
                                <span
                                    className={
                                        onboardingCardClassNames.providerName
                                    }
                                >
                                    {item.label}
                                </span>
                                <span
                                    className={
                                        onboardingCardClassNames.providerHint
                                    }
                                >
                                    {isActive
                                        ? "将作为首次连接来源"
                                        : "可在后续设置里继续补充"}
                                </span>
                            </span>
                        </ToggleGroupItem>
                    );
                })}
            </ToggleGroup>

            {currentProviderCatalog.authModes.length > 1 ? (
                <OnboardingFieldRow
                    description="按来源支持的方式填写授权"
                    disabled={isSaving}
                    id="source-auth-mode"
                    label="登录方式"
                >
                    <ToggleGroup
                        aria-label="登录方式"
                        className={onboardingCardClassNames.sourceAuthModeGroup}
                        disabled={isSaving}
                        onValueChange={(mode) => {
                            if (!mode) {
                                return;
                            }
                            setAuthMode(mode);
                        }}
                        spacing={2}
                        type="single"
                        value={currentDraft.authMode}
                        variant="outline"
                    >
                        {currentProviderCatalog.authModes.map((mode) => {
                            const active = currentDraft.authMode === mode;

                            return (
                                <ToggleGroupItem
                                    aria-pressed={active}
                                    className={
                                        onboardingCardClassNames.sourceAuthModeOption
                                    }
                                    disabled={isSaving}
                                    key={mode}
                                    value={mode}
                                >
                                    <span>
                                        {getSourceAuthModeDisplayLabel(
                                            mode,
                                            language,
                                        )}
                                    </span>
                                    <span className="text-left">
                                        按来源支持的方式填写授权
                                    </span>
                                </ToggleGroupItem>
                            );
                        })}
                    </ToggleGroup>
                </OnboardingFieldRow>
            ) : (
                <MatrixRow label="登录方式" value={selectedAuthModeLabel} />
            )}

            {!usesCustomServerSelector ? (
                <OnboardingFieldRow
                    description="来源 API 或网页登录入口"
                    disabled={isSaving}
                    id="source-base-url"
                    label="服务地址"
                >
                    <Input
                        disabled={isSaving}
                        id="source-base-url"
                        onChange={(event) => setBaseUrl(event.target.value)}
                        value={currentDraft.baseUrl}
                    />
                </OnboardingFieldRow>
            ) : (
                <MatrixRow label="服务地址" value={sourceServiceLabel} />
            )}

            <div className={onboardingCardClassNames.sourceProviderFields}>
                {providerFields.map((field) => (
                    <DataSourceFieldControl
                        disabled={isSaving}
                        field={field}
                        fieldId={field.id}
                        key={field.id}
                        onValueChange={updateField}
                        variant="onboarding"
                    />
                ))}
            </div>

            <WizardActions
                isSaving={isSaving}
                onBack={onBack}
                onNext={onNext}
            />
            <MatrixRow label="当前来源" value={sourceLabel} />
        </>
    );
}

function TranscriptionStep({
    connectedProviders,
    currentDraftTranscriptionSource,
    defaultTranscriptionSource,
    isSaving,
    onBack,
    onNext,
    setDefaultTranscriptionSource,
}: {
    connectedProviders: SourceProvider[];
    currentDraftTranscriptionSource: DefaultTranscriptionSource | null;
    defaultTranscriptionSource: DefaultTranscriptionSource | null;
    isSaving: boolean;
    onBack: () => void;
    onNext: () => void;
    setDefaultTranscriptionSource: (
        value: DefaultTranscriptionSource | null,
    ) => void;
}) {
    const options = DEFAULT_TRANSCRIPTION_SOURCE_OPTIONS.map((option) => ({
        ...option,
        connected: connectedProviders.includes(option.id),
        isCurrentDraft: currentDraftTranscriptionSource === option.id,
        selectable:
            connectedProviders.includes(option.id) ||
            currentDraftTranscriptionSource === option.id,
        statusLabel: `${option.label} · ${
            connectedProviders.includes(option.id)
                ? "已连接"
                : currentDraftTranscriptionSource === option.id
                  ? "当前草稿（未连接）"
                  : "未连接"
        }`,
    }));

    return (
        <section aria-label="默认转写配置">
            <ToggleGroup
                aria-label="默认转写来源"
                className={onboardingCardClassNames.defaultSources}
                disabled={isSaving}
                onValueChange={(value) => {
                    if (isSaving) {
                        return;
                    }

                    if (!value) {
                        setDefaultTranscriptionSource(null);
                        return;
                    }

                    const selectedOption = options.find(
                        (option) => option.id === value,
                    );
                    if (!selectedOption?.selectable) {
                        return;
                    }

                    setDefaultTranscriptionSource(selectedOption.id);
                }}
                orientation="vertical"
                role="group"
                spacing={2}
                type="single"
                value={defaultTranscriptionSource ?? ""}
                variant="outline"
            >
                {options.map((option) => {
                    const isActive = option.id === defaultTranscriptionSource;

                    return (
                        <ToggleGroupItem
                            aria-label={option.statusLabel}
                            aria-disabled={isSaving || !option.selectable}
                            aria-pressed={isActive}
                            className={onboardingCardClassNames.defaultSource}
                            disabled={isSaving || !option.selectable}
                            key={option.id}
                            value={option.id}
                        >
                            <span
                                aria-hidden="true"
                                className={
                                    DEFAULT_SOURCE_SWATCH_CLASS_NAMES[
                                        option.swatch
                                    ]
                                }
                            />
                            {option.statusLabel}
                        </ToggleGroupItem>
                    );
                })}
            </ToggleGroup>
            <fieldset
                aria-label="默认转写操作"
                className={onboardingCardClassNames.actions}
            >
                <Button
                    disabled={isSaving}
                    onClick={onBack}
                    size="xs"
                    type="button"
                    variant="outline"
                >
                    返回
                </Button>
                <Button
                    disabled={isSaving}
                    onClick={onNext}
                    size="xs"
                    type="button"
                    variant="outline"
                >
                    跳过
                </Button>
                <Button
                    disabled={isSaving}
                    onClick={onNext}
                    size="xs"
                    type="button"
                    variant="default"
                >
                    下一步
                </Button>
            </fieldset>
        </section>
    );
}

function SpeakersStep({
    isSaving,
    onBack,
    onNext,
    setSpeakerName,
    setSpeakerVoiceprint,
    speakerName,
    speakerState,
    speakerVoiceprint,
}: {
    isSaving: boolean;
    onBack: () => void;
    onNext: () => void;
    setSpeakerName: (value: string) => void;
    setSpeakerVoiceprint: (value: string) => void;
    speakerName: string;
    speakerState: "idle" | "saving" | "saved" | "error";
    speakerVoiceprint: string;
}) {
    return (
        <>
            <section
                aria-labelledby="speaker-profile-title"
                className={onboardingCardClassNames.providerList}
            >
                <Card
                    hasNoPadding
                    className={onboardingCardClassNames.speakerDraft}
                >
                    <span
                        aria-hidden="true"
                        className={onboardingCardClassNames.providerIcon}
                    >
                        <UserRound />
                    </span>
                    <CardHeader
                        className={onboardingCardClassNames.providerMeta}
                    >
                        <CardTitle
                            aria-level={3}
                            className={onboardingCardClassNames.providerName}
                            id="speaker-profile-title"
                            role="heading"
                        >
                            第一个说话人
                        </CardTitle>
                        <CardDescription
                            className={onboardingCardClassNames.providerHint}
                        >
                            可先留空，工作台内继续校对
                        </CardDescription>
                    </CardHeader>
                </Card>
            </section>
            <OnboardingFieldRow
                description="例如主持人、自己或常见会议成员"
                disabled={isSaving || speakerState === "saving"}
                id="speaker-name"
                label="显示名称"
            >
                <Input
                    disabled={isSaving || speakerState === "saving"}
                    id="speaker-name"
                    onChange={(event) => setSpeakerName(event.target.value)}
                    value={speakerName}
                    placeholder="林梅"
                />
            </OnboardingFieldRow>
            <OnboardingFieldRow
                description="可选；后续也可在说话人校对里补"
                disabled={isSaving || speakerState === "saving"}
                id="speaker-voiceprint"
                label="语音档案引用"
            >
                <Input
                    disabled={isSaving || speakerState === "saving"}
                    id="speaker-voiceprint"
                    onChange={(event) =>
                        setSpeakerVoiceprint(event.target.value)
                    }
                    value={speakerVoiceprint}
                    placeholder="voiceprint-local-1"
                />
            </OnboardingFieldRow>
            <MatrixRow
                label="档案状态"
                value={
                    speakerName.trim()
                        ? `${speakerName.trim()} · 保存时创建`
                        : "未填写，跳过创建"
                }
            />
            <WizardActions
                isSaving={isSaving || speakerState === "saving"}
                onBack={onBack}
                onNext={onNext}
            />
        </>
    );
}

function FinishStep({
    connectedSourceLabel,
    defaultTranscriptionSource,
    finishError,
    isFinishing,
    isSaving,
    onBack,
    onFinish,
    selectedAuthModeLabel,
    sourceLabel,
    speakerName,
    speakerState,
    transcriptionSaved,
}: {
    connectedSourceLabel: string | null;
    defaultTranscriptionSource: DefaultTranscriptionSource | null;
    finishError: string | null;
    isFinishing: boolean;
    isSaving: boolean;
    onBack: () => void;
    onFinish: () => void;
    selectedAuthModeLabel: string;
    sourceLabel: string;
    speakerName: string;
    speakerState: "idle" | "saving" | "saved" | "error";
    transcriptionSaved: boolean;
}) {
    return (
        <>
            <section
                aria-label="配置摘要"
                className={onboardingCardClassNames.summaryList}
            >
                <MatrixRow
                    label="来源"
                    value={connectedSourceLabel ?? sourceLabel}
                />
                <MatrixRow label="授权" value={selectedAuthModeLabel} />
                <MatrixRow
                    label="默认转写"
                    status={transcriptionSaved ? "已保存" : "待保存"}
                    value={
                        defaultTranscriptionSource === null
                            ? "未选择"
                            : defaultTranscriptionSource === "ticnote"
                              ? "TicNote"
                              : defaultTranscriptionSource === "feishu-minutes"
                                ? "飞书妙记"
                                : "钉钉 闪记"
                    }
                />
                <MatrixRow
                    label="说话人"
                    status={
                        speakerState === "saved"
                            ? "已保存"
                            : speakerState === "saving"
                              ? "保存中"
                              : speakerState === "error"
                                ? "保存失败"
                                : "待保存"
                    }
                    value={
                        speakerName.trim() ? speakerName.trim() : "暂不创建档案"
                    }
                />
            </section>
            <fieldset
                aria-label="完成配置操作"
                className={onboardingCardClassNames.actions}
            >
                <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    disabled={isSaving}
                    onClick={onBack}
                >
                    返回
                </Button>
                <Button
                    type="button"
                    variant="default"
                    size="xs"
                    disabled={isSaving || isFinishing}
                    aria-busy={isSaving || isFinishing}
                    aria-describedby={
                        finishError ? "onboarding-finish-error" : undefined
                    }
                    onClick={onFinish}
                >
                    {isSaving || isFinishing ? (
                        <Loader2 aria-hidden="true" />
                    ) : (
                        <CheckCircle2 aria-hidden="true" />
                    )}
                    {isSaving || isFinishing ? "保存中..." : "保存并进入工作台"}
                </Button>
            </fieldset>
        </>
    );
}

function MatrixRow({
    label,
    status,
    value,
}: {
    label: string;
    status?: string;
    value: string;
}) {
    return (
        <dl
            aria-live={status ? "polite" : undefined}
            className={onboardingCardClassNames.matrixRow}
        >
            <dt className={onboardingCardClassNames.matrixLabel}>{label}</dt>
            <dd className={onboardingCardClassNames.matrixValue}>
                {value}
                {status ? <span className="sr-only">，{status}</span> : null}
            </dd>
        </dl>
    );
}

function WizardActions({
    isSaving,
    onBack,
    onNext,
}: {
    isSaving: boolean;
    onBack?: () => void;
    onNext: () => void;
}) {
    return (
        <fieldset
            aria-label="步骤操作"
            className={onboardingCardClassNames.actions}
        >
            {onBack ? (
                <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    disabled={isSaving}
                    onClick={onBack}
                >
                    返回
                </Button>
            ) : null}
            <Button
                type="button"
                variant="default"
                size="xs"
                disabled={isSaving}
                onClick={onNext}
            >
                下一步
            </Button>
        </fieldset>
    );
}
