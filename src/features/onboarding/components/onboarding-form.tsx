"use client";

import { CheckCircle2, Database, Loader2, UserRound } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
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
import {
    getSourceAuthModeDisplayLabel,
    getSourceProviderLabel,
} from "@/lib/data-sources/presentation";
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
    },
    {
        id: "ticnote",
        label: "TicNote",
    },
    {
        id: "feishu-minutes",
        label: "飞书妙记",
    },
] as const satisfies ReadonlyArray<{
    id: DefaultTranscriptionSource;
    label: string;
}>;

function isDefaultTranscriptionSource(
    provider: SourceProvider,
): provider is DefaultTranscriptionSource {
    return DEFAULT_TRANSCRIPTION_SOURCE_OPTIONS.some(
        (option) => option.id === provider,
    );
}

function getStepIndex(step: OnboardingStepId) {
    return ONBOARDING_STEPS.findIndex((item) => item.id === step);
}

export function OnboardingForm({ onConnected }: OnboardingFormProps) {
    const router = useBrowserRouteController();
    const { language } = useLanguage();
    const isZh = language === "zh-CN";
    const [isRestoring, setIsRestoring] = useState(true);
    const [restoreError, setRestoreError] = useState<string | null>(null);
    const [existingSourceProvider, setExistingSourceProvider] =
        useState<SourceProvider | null>(null);
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
    const stepPanelRef = useRef<HTMLElement>(null);
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

    const restoreOnboarding = useCallback(async () => {
        setIsRestoring(true);
        setRestoreError(null);

        try {
            const [sourcesResponse, transcriptionResponse, speakersResponse] =
                await Promise.all([
                    fetch(ONBOARDING_DATA_SOURCES_ENDPOINT),
                    fetch("/api/settings/transcription"),
                    fetch("/api/speakers/profiles"),
                ]);

            if (
                !sourcesResponse.ok ||
                !transcriptionResponse.ok ||
                !speakersResponse.ok
            ) {
                throw new Error("无法读取现有配置，请重试。");
            }

            const sourcesPayload = (await sourcesResponse.json()) as {
                sources?: Array<{
                    connected?: boolean;
                    provider?: SourceProvider;
                }>;
            };
            const transcriptionPayload =
                (await transcriptionResponse.json()) as {
                    defaultTranscriptionProvider?: SourceProvider | null;
                };
            const speakersPayload = (await speakersResponse.json()) as {
                profiles?: Array<{ displayName?: string }>;
            };
            const savedProvider =
                transcriptionPayload.defaultTranscriptionProvider;
            const savedSource = sourcesPayload.sources?.find(
                (source) => source.connected && source.provider,
            );
            const hasConnectedSource = Boolean(savedSource);
            const hasSpeaker = Boolean(speakersPayload.profiles?.length);

            setExistingSourceProvider(savedSource?.provider ?? null);

            if (savedProvider && isDefaultTranscriptionSource(savedProvider)) {
                setDefaultTranscriptionSource(savedProvider);
                setTranscriptionSaved(true);
            }

            if (hasSpeaker) {
                setSpeakerName(
                    speakersPayload.profiles?.[0]?.displayName?.trim() ?? "",
                );
                setSpeakerState("saved");
            }

            if (!hasConnectedSource) {
                setActiveStep("source");
            } else if (!savedProvider) {
                setActiveStep("transcription");
            } else if (!hasSpeaker) {
                setActiveStep("speakers");
            } else {
                setActiveStep("finish");
            }
        } catch (error) {
            setRestoreError(
                error instanceof Error
                    ? error.message
                    : "无法读取现有配置，请重试。",
            );
        } finally {
            setIsRestoring(false);
        }
    }, []);

    useEffect(() => {
        void restoreOnboarding();
    }, [restoreOnboarding]);

    useEffect(() => {
        if (isRestoring) {
            return;
        }

        const focusTargetByStep: Record<OnboardingStepId, string> = {
            source: "#source-secret, button[aria-pressed]:not([disabled])",
            transcription:
                'button[aria-checked="true"]:not([disabled]), button[aria-checked="false"]:not([disabled])',
            speakers: "#speaker-name",
            finish: 'fieldset[aria-label="完成配置操作"] button:not([disabled])',
        };
        const animationFrame = window.requestAnimationFrame(() => {
            stepPanelRef.current
                ?.querySelector<HTMLElement>(focusTargetByStep[activeStep])
                ?.focus({ preventScroll: activeStep === "source" });
        });

        return () => window.cancelAnimationFrame(animationFrame);
    }, [activeStep, isRestoring]);

    useEffect(() => {
        if (!finishError) {
            return;
        }

        const errorTargetByStep: Record<OnboardingStepId, string> = {
            source: "#source-secret",
            transcription: "button[aria-checked]:not([disabled])",
            speakers: "#speaker-name",
            finish: 'button[aria-describedby="onboarding-finish-error"]:not([disabled])',
        };
        stepPanelRef.current
            ?.querySelector<HTMLElement>(errorTargetByStep[activeStep])
            ?.focus();
    }, [activeStep, finishError]);

    const visibleStep = activeStep;
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
    const controlsLocked = isRestoring || isSaving || isFinishing;
    const visibleStepTitle = `第 ${visibleStepIndex + 1} 步 · ${
        ONBOARDING_STEPS[visibleStepIndex].title
    }`;

    const goToStep = (step: OnboardingStepId) => {
        if (controlsLocked) return;
        setFinishError(null);
        setActiveStep(step);
    };

    const connectSourceAndContinue = async () => {
        setFinishError(null);
        const didConnect =
            connectedProvider || existingSourceProvider
                ? true
                : await connectSource();
        if (!didConnect) {
            setFinishError("来源连接失败，请检查必填信息后重试。");
            return;
        }
        if (!existingSourceProvider) {
            setExistingSourceProvider(provider);
        }
        setActiveStep("transcription");
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

    const continueFromTranscription = async (skip: boolean) => {
        if (!skip && !selectedDefaultTranscriptionSource) {
            setFinishError("请选择一个已连接的默认转写来源，或选择跳过。");
            return;
        }

        setFinishError(null);
        setIsFinishing(true);
        try {
            await saveTranscriptionDefaults(
                skip ? null : selectedDefaultTranscriptionSource,
            );
            if (skip) {
                setDefaultTranscriptionSource(null);
            }
            setActiveStep("speakers");
        } catch (error) {
            setFinishError(
                error instanceof Error ? error.message : "默认转写保存失败",
            );
        } finally {
            setIsFinishing(false);
        }
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

    const continueFromSpeakers = async (skip: boolean) => {
        setFinishError(null);
        if (skip) {
            setSpeakerName("");
            setSpeakerVoiceprint("");
            setSpeakerState("idle");
            setActiveStep("finish");
            return;
        }

        if (!speakerName.trim()) {
            setFinishError("请填写说话人显示名称，或选择跳过。");
            return;
        }

        setIsFinishing(true);
        try {
            await saveSpeakerProfile();
            setActiveStep("finish");
        } catch (error) {
            setFinishError(
                error instanceof Error ? error.message : "说话人档案保存失败",
            );
        } finally {
            setIsFinishing(false);
        }
    };

    const handleFinish = async () => {
        setFinishError(null);
        setIsFinishing(true);

        try {
            const responses = await Promise.all([
                fetch(ONBOARDING_DATA_SOURCES_ENDPOINT),
                fetch("/api/settings/transcription"),
                fetch("/api/speakers/profiles"),
            ]);
            if (responses.some((response) => !response.ok)) {
                throw new Error("配置已保存，但读取确认失败，请重试。");
            }

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
            aria-busy={isRestoring || isSaving || isFinishing}
            aria-labelledby="onboarding-title"
            className="grid min-h-svh place-items-center bg-background px-8 pt-7 pb-20 text-foreground"
        >
            <Card
                hasNoPadding
                className="block min-h-96 w-full max-w-md box-border overflow-visible p-5 backdrop-blur-none"
            >
                <CardHeader className="gap-0 p-0">
                    <CardTitle
                        aria-level={1}
                        className="mb-1 text-sm text-foreground"
                        id="onboarding-title"
                        role="heading"
                    >
                        上手 / Onboarding · 4 步
                    </CardTitle>
                    <CardDescription className="mb-3.5 text-xs leading-normal">
                        连接来源 → 选默认转写 → 设置说话人档案 → 完成
                    </CardDescription>
                </CardHeader>
                <section
                    aria-busy={isRestoring || isSaving || isFinishing}
                    aria-describedby="onboarding-step-description"
                    aria-labelledby="onboarding-step-title"
                    className="overflow-hidden rounded-xl border border-border bg-background p-5"
                    ref={stepPanelRef}
                >
                    <Progress
                        aria-label={`配置进度：${visibleStepTitle}`}
                        className="mb-3.5"
                        value={progressPct}
                    />
                    <nav aria-label="上手步骤">
                        <ol className="mb-3.5 flex list-none gap-1.5 p-0">
                            {ONBOARDING_STEPS.map((step, index) => {
                                const isActive = step.id === visibleStep;
                                const isDone =
                                    connectedProvider !== null ||
                                    index < visibleStepIndex;

                                return (
                                    <li className="flex-1" key={step.id}>
                                        <Button
                                            aria-current={
                                                isActive ? "step" : undefined
                                            }
                                            aria-label={`第 ${index + 1} 步 · ${step.title}`}
                                            className={cn(
                                                "h-1 flex-1 rounded-sm bg-muted p-0 hover:bg-muted disabled:cursor-not-allowed",
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
                    <header className="grid auto-rows-min gap-0 p-0">
                        <h2
                            className="text-sm font-semibold text-foreground"
                            id="onboarding-step-title"
                        >
                            {visibleStepTitle}
                        </h2>
                        <p
                            className="mb-3.5 text-xs text-muted-foreground"
                            id="onboarding-step-description"
                        >
                            {ONBOARDING_STEPS[visibleStepIndex].hint}
                        </p>
                    </header>
                    <CardContent className="flex flex-col gap-3 p-0">
                        {isRestoring ? (
                            <output
                                aria-live="polite"
                                className="flex min-h-32 items-center justify-center gap-2 text-sm text-muted-foreground"
                            >
                                <Loader2
                                    aria-hidden="true"
                                    className="size-4 animate-spin"
                                />
                                正在读取现有配置
                            </output>
                        ) : null}
                        {restoreError ? (
                            <Alert
                                aria-live="assertive"
                                density="compact"
                                variant="statusError"
                            >
                                <AlertDescription
                                    className="flex items-center justify-between gap-3"
                                    density="compact"
                                >
                                    <span>{restoreError}</span>
                                    <Button
                                        onClick={() => void restoreOnboarding()}
                                        size="sm"
                                        type="button"
                                        variant="outline"
                                    >
                                        重试
                                    </Button>
                                </AlertDescription>
                            </Alert>
                        ) : null}
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
                                onNext={() => void connectSourceAndContinue()}
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
                                onNext={() =>
                                    void continueFromTranscription(false)
                                }
                                onSkip={() =>
                                    void continueFromTranscription(true)
                                }
                                setDefaultTranscriptionSource={
                                    setDefaultTranscriptionSource
                                }
                            />
                        ) : null}

                        {visibleStep === "speakers" ? (
                            <SpeakersStep
                                isSaving={controlsLocked}
                                onBack={goBack}
                                onNext={() => void continueFromSpeakers(false)}
                                onSkip={() => void continueFromSpeakers(true)}
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
                                existingSourceLabel={
                                    existingSourceProvider
                                        ? getSourceProviderLabel(
                                              existingSourceProvider,
                                              language,
                                          )
                                        : null
                                }
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
            <Field
                className="gap-2"
                data-disabled={isSaving ? "true" : undefined}
                orientation="responsive"
            >
                <FieldContent className="min-w-0 gap-1">
                    <FieldLabel htmlFor="source-provider">来源</FieldLabel>
                    <FieldDescription className="max-w-full text-xs">
                        未指定来源时，新录音从这里读取
                    </FieldDescription>
                </FieldContent>
                <FieldControl className="min-w-0 flex-1">
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
                </FieldControl>
            </Field>

            <fieldset
                aria-label="来源选项"
                className="mb-5 flex w-full flex-col items-stretch gap-2"
            >
                {providerOptions.map((item) => {
                    const isActive = item.provider === provider;

                    return (
                        <Button
                            aria-pressed={isActive}
                            className={cn(
                                "h-auto w-full justify-start gap-3 px-3.5 py-3 text-left whitespace-normal",
                                isActive && "border-transparent",
                            )}
                            disabled={isSaving}
                            key={item.provider}
                            onClick={() => selectProvider(item.provider)}
                            type="button"
                            variant="outline"
                        >
                            <span
                                aria-hidden="true"
                                className="inline-flex size-9 flex-none items-center justify-center overflow-hidden rounded-md border border-border bg-card text-foreground"
                            >
                                <Database aria-hidden="true" />
                            </span>
                            <span className="grid min-w-0 auto-rows-min gap-0">
                                <span className="text-sm font-semibold text-foreground">
                                    {item.label}
                                </span>
                                <span className="mt-0.5 text-xs font-medium text-muted-foreground">
                                    {isActive
                                        ? "将作为首次连接来源"
                                        : "可在后续设置里继续补充"}
                                </span>
                            </span>
                        </Button>
                    );
                })}
            </fieldset>

            {currentProviderCatalog.authModes.length > 1 ? (
                <Field
                    className="gap-2"
                    data-disabled={isSaving ? "true" : undefined}
                    orientation="responsive"
                >
                    <FieldContent className="min-w-0 gap-1">
                        <FieldLabel>登录方式</FieldLabel>
                        <FieldDescription className="max-w-full text-xs">
                            按来源支持的方式填写授权
                        </FieldDescription>
                    </FieldContent>
                    <FieldControl className="min-w-0 flex-1">
                        <ToggleGroup
                            aria-label="登录方式"
                            className="grid w-full grid-cols-2 items-stretch"
                            disabled={isSaving}
                            onValueChange={(mode) => {
                                if (mode) {
                                    setAuthMode(mode);
                                }
                            }}
                            spacing={2}
                            type="single"
                            value={currentDraft.authMode}
                            variant="outline"
                        >
                            {currentProviderCatalog.authModes.map((mode) => (
                                <ToggleGroupItem
                                    aria-pressed={
                                        currentDraft.authMode === mode
                                    }
                                    className="h-auto flex-col items-start justify-start px-3.5 py-3 text-left whitespace-normal"
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
                            ))}
                        </ToggleGroup>
                    </FieldControl>
                </Field>
            ) : (
                <dl className="m-0 flex min-h-8 items-baseline gap-2 border-b border-dashed border-border py-1.5">
                    <dt className="m-0 w-20 flex-none text-xs font-semibold text-muted-foreground">
                        登录方式
                    </dt>
                    <dd className="m-0 min-w-0 flex-1 break-words text-xs font-medium text-foreground">
                        {selectedAuthModeLabel}
                    </dd>
                </dl>
            )}

            {!usesCustomServerSelector ? (
                <Field
                    className="gap-2"
                    data-disabled={isSaving ? "true" : undefined}
                    orientation="responsive"
                >
                    <FieldContent className="min-w-0 gap-1">
                        <FieldLabel htmlFor="source-base-url">
                            服务地址
                        </FieldLabel>
                        <FieldDescription className="max-w-full text-xs">
                            来源 API 或网页登录入口
                        </FieldDescription>
                    </FieldContent>
                    <FieldControl className="min-w-0 flex-1">
                        <Input
                            disabled={isSaving}
                            id="source-base-url"
                            onChange={(event) => setBaseUrl(event.target.value)}
                            value={currentDraft.baseUrl}
                        />
                    </FieldControl>
                </Field>
            ) : (
                <dl className="m-0 flex min-h-8 items-baseline gap-2 border-b border-dashed border-border py-1.5">
                    <dt className="m-0 w-20 flex-none text-xs font-semibold text-muted-foreground">
                        服务地址
                    </dt>
                    <dd className="m-0 min-w-0 flex-1 break-words text-xs font-medium text-foreground">
                        {sourceServiceLabel}
                    </dd>
                </dl>
            )}

            <div className="flex flex-col gap-0">
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

            <fieldset
                aria-label="来源步骤操作"
                className="mt-3.5 flex justify-end gap-2"
            >
                {onBack ? (
                    <Button
                        disabled={isSaving}
                        onClick={onBack}
                        size="xs"
                        type="button"
                        variant="outline"
                    >
                        返回
                    </Button>
                ) : null}
                <Button
                    disabled={isSaving}
                    onClick={onNext}
                    size="xs"
                    type="button"
                    variant="default"
                >
                    {isSaving ? (
                        <Loader2 aria-hidden="true" className="animate-spin" />
                    ) : null}
                    {isSaving ? "连接中..." : "下一步"}
                </Button>
            </fieldset>
            <dl className="m-0 flex min-h-8 items-baseline gap-2 border-b border-dashed border-border py-1.5">
                <dt className="m-0 w-20 flex-none text-xs font-semibold text-muted-foreground">
                    当前来源
                </dt>
                <dd className="m-0 min-w-0 flex-1 break-words text-xs font-medium text-foreground">
                    {sourceLabel}
                </dd>
            </dl>
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
    onSkip,
    setDefaultTranscriptionSource,
}: {
    connectedProviders: SourceProvider[];
    currentDraftTranscriptionSource: DefaultTranscriptionSource | null;
    defaultTranscriptionSource: DefaultTranscriptionSource | null;
    isSaving: boolean;
    onBack: () => void;
    onNext: () => void;
    onSkip: () => void;
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
                className="w-full flex-col items-stretch"
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
                spacing={1.5}
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
                            className="h-auto w-full justify-start py-2 text-left whitespace-normal"
                            disabled={isSaving || !option.selectable}
                            key={option.id}
                            value={option.id}
                        >
                            <span
                                aria-hidden="true"
                                className={cn(
                                    "size-5 flex-none rounded",
                                    option.id === "dingtalk-a1"
                                        ? "bg-primary"
                                        : "bg-muted",
                                )}
                            />
                            {option.statusLabel}
                        </ToggleGroupItem>
                    );
                })}
            </ToggleGroup>
            <fieldset
                aria-label="默认转写操作"
                className="mt-3.5 flex justify-end gap-2"
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
                    onClick={onSkip}
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
    onSkip,
    setSpeakerName,
    setSpeakerVoiceprint,
    speakerName,
    speakerState,
    speakerVoiceprint,
}: {
    isSaving: boolean;
    onBack: () => void;
    onNext: () => void;
    onSkip: () => void;
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
                className="mb-5 flex w-full flex-col items-stretch gap-2"
            >
                <Card
                    hasNoPadding
                    className="flex-row items-center gap-3 border-primary/50 bg-primary/10 p-3.5"
                >
                    <span
                        aria-hidden="true"
                        className="inline-flex size-9 flex-none items-center justify-center overflow-hidden rounded-md border border-border bg-card text-foreground"
                    >
                        <UserRound />
                    </span>
                    <CardHeader className="min-w-0 gap-0 p-0">
                        <CardTitle
                            aria-level={3}
                            className="text-sm text-foreground"
                            id="speaker-profile-title"
                            role="heading"
                        >
                            第一个说话人
                        </CardTitle>
                        <CardDescription className="mt-0.5 text-xs font-medium">
                            可先留空，工作台内继续校对
                        </CardDescription>
                    </CardHeader>
                </Card>
            </section>
            <Field
                className="gap-2"
                data-disabled={
                    isSaving || speakerState === "saving" ? "true" : undefined
                }
                orientation="responsive"
            >
                <FieldContent className="min-w-0 gap-1">
                    <FieldLabel htmlFor="speaker-name">显示名称</FieldLabel>
                    <FieldDescription className="max-w-full text-xs">
                        例如主持人、自己或常见会议成员
                    </FieldDescription>
                </FieldContent>
                <FieldControl className="min-w-0 flex-1">
                    <Input
                        disabled={isSaving || speakerState === "saving"}
                        id="speaker-name"
                        onChange={(event) => setSpeakerName(event.target.value)}
                        placeholder="林梅"
                        value={speakerName}
                    />
                </FieldControl>
            </Field>
            <Field
                className="gap-2"
                data-disabled={
                    isSaving || speakerState === "saving" ? "true" : undefined
                }
                orientation="responsive"
            >
                <FieldContent className="min-w-0 gap-1">
                    <FieldLabel htmlFor="speaker-voiceprint">
                        语音档案引用
                    </FieldLabel>
                    <FieldDescription className="max-w-full text-xs">
                        可选；后续也可在说话人校对里补
                    </FieldDescription>
                </FieldContent>
                <FieldControl className="min-w-0 flex-1">
                    <Input
                        disabled={isSaving || speakerState === "saving"}
                        id="speaker-voiceprint"
                        onChange={(event) =>
                            setSpeakerVoiceprint(event.target.value)
                        }
                        placeholder="voiceprint-local-1"
                        value={speakerVoiceprint}
                    />
                </FieldControl>
            </Field>
            <dl className="m-0 flex min-h-8 items-baseline gap-2 border-b border-dashed border-border py-1.5">
                <dt className="m-0 w-20 flex-none text-xs font-semibold text-muted-foreground">
                    档案状态
                </dt>
                <dd className="m-0 min-w-0 flex-1 break-words text-xs font-medium text-foreground">
                    {speakerName.trim()
                        ? `${speakerName.trim()} · 保存时创建`
                        : "未填写，跳过创建"}
                </dd>
            </dl>
            <fieldset
                aria-label="说话人步骤操作"
                className="mt-3.5 flex justify-end gap-2"
            >
                <Button
                    disabled={isSaving || speakerState === "saving"}
                    onClick={onBack}
                    size="xs"
                    type="button"
                    variant="outline"
                >
                    返回
                </Button>
                <Button
                    disabled={isSaving || speakerState === "saving"}
                    onClick={onSkip}
                    size="xs"
                    type="button"
                    variant="outline"
                >
                    跳过
                </Button>
                <Button
                    disabled={isSaving || speakerState === "saving"}
                    onClick={onNext}
                    size="xs"
                    type="button"
                    variant="default"
                >
                    {speakerState === "saving" ? (
                        <Loader2 aria-hidden="true" className="animate-spin" />
                    ) : null}
                    {speakerState === "saving" ? "保存中..." : "保存并继续"}
                </Button>
            </fieldset>
        </>
    );
}

function FinishStep({
    connectedSourceLabel,
    existingSourceLabel,
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
    existingSourceLabel: string | null;
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
            <section aria-label="配置摘要" className="mb-5 flex flex-col gap-2">
                <dl className="m-0 flex min-h-8 items-baseline gap-2 border-b border-dashed border-border py-1.5">
                    <dt className="m-0 w-20 flex-none text-xs font-semibold text-muted-foreground">
                        来源
                    </dt>
                    <dd className="m-0 min-w-0 flex-1 break-words text-xs font-medium text-foreground">
                        {connectedSourceLabel ??
                            existingSourceLabel ??
                            sourceLabel}
                    </dd>
                </dl>
                <dl className="m-0 flex min-h-8 items-baseline gap-2 border-b border-dashed border-border py-1.5">
                    <dt className="m-0 w-20 flex-none text-xs font-semibold text-muted-foreground">
                        授权
                    </dt>
                    <dd className="m-0 min-w-0 flex-1 break-words text-xs font-medium text-foreground">
                        {selectedAuthModeLabel}
                    </dd>
                </dl>
                <dl
                    aria-live="polite"
                    className="m-0 flex min-h-8 items-baseline gap-2 border-b border-dashed border-border py-1.5"
                >
                    <dt className="m-0 w-20 flex-none text-xs font-semibold text-muted-foreground">
                        默认转写
                    </dt>
                    <dd className="m-0 min-w-0 flex-1 break-words text-xs font-medium text-foreground">
                        {defaultTranscriptionSource === null
                            ? "未选择"
                            : defaultTranscriptionSource === "ticnote"
                              ? "TicNote"
                              : defaultTranscriptionSource === "feishu-minutes"
                                ? "飞书妙记"
                                : "钉钉 闪记"}
                        <span className="sr-only">
                            ，{transcriptionSaved ? "已保存" : "待保存"}
                        </span>
                    </dd>
                </dl>
                <dl
                    aria-live="polite"
                    className="m-0 flex min-h-8 items-baseline gap-2 border-b border-dashed border-border py-1.5"
                >
                    <dt className="m-0 w-20 flex-none text-xs font-semibold text-muted-foreground">
                        说话人
                    </dt>
                    <dd className="m-0 min-w-0 flex-1 break-words text-xs font-medium text-foreground">
                        {speakerName.trim()
                            ? speakerName.trim()
                            : "暂不创建档案"}
                        <span className="sr-only">
                            ，
                            {speakerState === "saved"
                                ? "已保存"
                                : speakerState === "saving"
                                  ? "保存中"
                                  : speakerState === "error"
                                    ? "保存失败"
                                    : "待保存"}
                        </span>
                    </dd>
                </dl>
            </section>
            <fieldset
                aria-label="完成配置操作"
                className="mt-3.5 flex justify-end gap-2"
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
