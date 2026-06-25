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
import { type ReactNode, useEffect, useState } from "react";
import { useLanguage } from "@/components/language-provider";
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
    FieldDescription,
    FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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
    surface:
        "min-h-[375px] gap-0 w-[min(420px,100%)] overflow-visible rounded-[14px] border border-[var(--line-hairline)] bg-[var(--bg-elevated)] p-[18px] shadow-xs backdrop-blur-none",
    speakerDraft:
        "grid grid-cols-[36px_1fr_auto_auto] items-center gap-3 border-primary/50 bg-primary/10 p-3.5",
    providerCard:
        "grid h-auto w-full grid-cols-[36px_1fr_auto_auto] items-center justify-start gap-3 rounded-md px-3.5 py-3 text-left whitespace-normal data-[sot-state=selected]:border-transparent data-[sot-state=selected]:bg-secondary data-[sot-state=selected]:text-secondary-foreground data-[sot-state=selected]:hover:bg-secondary/80 dark:data-[sot-state=selected]:bg-secondary has-[>svg]:px-3.5",
    sourceAuthModeGroup: "grid w-full grid-cols-2 items-stretch",
    sourceAuthModeOption:
        "h-auto flex-col items-start justify-start whitespace-normal px-3.5 py-3 text-left",
    secondaryAction:
        "h-[26px] gap-[6px] rounded-[8px] border border-[var(--line-hairline)] bg-transparent px-[10px] py-0 text-[11px] font-semibold leading-[normal] text-[var(--fg-secondary)] shadow-none hover:bg-transparent hover:text-[var(--fg-secondary)] has-[>svg]:px-[10px]",
    primaryAction:
        "h-[26px] gap-[6px] rounded-[8px] border border-transparent bg-[var(--accent)] px-[10px] py-0 text-[11px] font-semibold leading-[normal] text-white shadow-none hover:bg-[var(--accent)] focus-visible:border-primary focus-visible:ring-0 has-[>svg]:px-[10px]",
    header: "grid auto-rows-min gap-0 p-0",
    stepHeader: "grid auto-rows-min gap-0 p-0",
    providerMeta: "grid auto-rows-min gap-0 p-0",
    heading:
        "mb-1 font-sans text-[13px] font-semibold text-[var(--fg-primary)]",
    sub: "mb-[12px] font-sans text-[12px] leading-[1.5] text-[var(--fg-tertiary)]",
    stepBody: "gap-0 p-0",
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
            data-disabled={disabled ? "true" : undefined}
            orientation="horizontal"
        >
            <FieldContent>
                <FieldLabel htmlFor={id}>{label}</FieldLabel>
                <FieldDescription>{description}</FieldDescription>
            </FieldContent>
            {children}
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
        useState<"dingtalk-a1" | "ticnote" | "feishu-minutes">("dingtalk-a1");
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
    const onboardingState = connectedProvider
        ? "connected"
        : isSaving
          ? "saving"
          : visibleStep;
    const progressPct = ["25", "40", "75", "100"][visibleStepIndex] ?? "25";
    const selectedAuthModeLabel = getSourceAuthModeDisplayLabel(
        currentDraft.authMode,
        language,
    );
    const sourceServiceLabel = usesCustomServerSelector
        ? isZh
            ? "由来源登录方式决定"
            : "Handled by the source sign-in method"
        : currentDraft.baseUrl;
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

    const saveTranscriptionDefaults = async () => {
        const response = await fetch("/api/settings/transcription", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                autoTranscribe: defaultTranscriptionSource !== "feishu-minutes",
                defaultTranscriptionLanguage:
                    defaultTranscriptionSource === "feishu-minutes"
                        ? null
                        : language === "zh-CN"
                          ? "zh"
                          : "en",
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
        const response = await fetch("/api/speakers/profiles", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                displayName: trimmedName,
                voiceprintRef: speakerVoiceprint.trim() || null,
            }),
        });

        if (!response.ok) {
            setSpeakerState("error");
            throw new Error("说话人档案保存失败");
        }

        setSpeakerState("saved");
    };

    const handleFinish = async () => {
        if (!isMounted) return;

        setFinishError(null);
        setIsFinishing(true);

        try {
            const didConnect = connectedProvider ? true : await connectSource();
            if (!didConnect) {
                setActiveStep("source");
                setFinishError("请先补全来源授权");
                return;
            }

            await saveTranscriptionDefaults();
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
            data-sot-layout="onboarding-workstation"
            data-sot-ready={isMounted ? "true" : "false"}
            data-sot-surface="onboarding"
        >
            <Card
                hasNoPadding
                className={onboardingCardClassNames.surface}
                data-sot-card="onboarding"
                style={{
                    backdropFilter: "none",
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--line-hairline)",
                    borderRadius: 14,
                    boxShadow: "var(--shadow-xs)",
                    boxSizing: "border-box",
                    display: "block",
                    minHeight: 375,
                    overflow: "visible",
                    padding: 18,
                    width: "min(420px, 100%)",
                }}
            >
                <div data-sot-part="onboarding-card-header">
                    <div
                        data-sot-part="card-heading"
                        style={{
                            color: "var(--fg-primary)",
                            font: "600 13px var(--font-sans)",
                            margin: "0 0 4px",
                        }}
                    >
                        上手 / Onboarding · 4 步
                    </div>
                    <div
                        data-sot-part="card-sub"
                        style={{
                            color: "var(--fg-tertiary)",
                            font: "12px/1.5 var(--font-sans)",
                            margin: "0 0 14px",
                        }}
                    >
                        连接来源 → 选默认转写 → 设置说话人档案 → 完成
                    </div>
                </div>
                <div
                    data-pct={progressPct}
                    data-sot-frame="onboarding"
                    data-sot-panel="onboarding-current"
                    data-sot-provider={provider}
                    data-sot-state={isFinishing ? "saving" : onboardingState}
                    style={{
                        background: "var(--bg-canvas)",
                        border: "1px solid var(--line-hairline)",
                        borderRadius: 12,
                        overflow: "hidden",
                        padding: 18,
                    }}
                >
                    <div
                        data-sot-panel="onboarding-steps"
                        data-sot-progress={visibleStep}
                    >
                        {ONBOARDING_STEPS.map((step, index) => {
                            const isActive = step.id === visibleStep;
                            const isDone =
                                connectedProvider !== null ||
                                index < visibleStepIndex;
                            const status = isDone
                                ? "complete"
                                : isActive
                                  ? "active"
                                  : "idle";

                            return (
                                <button
                                    aria-label={`第 ${index + 1} 步 · ${step.title}`}
                                    data-sot-control="onboarding-step"
                                    data-sot-step={step.id}
                                    data-sot-state={status}
                                    disabled={controlsLocked}
                                    key={step.id}
                                    onClick={() => goToStep(step.id)}
                                    style={{
                                        appearance: "none",
                                        background:
                                            status === "complete" ||
                                            status === "active"
                                                ? "var(--accent)"
                                                : "var(--bg-recessed)",
                                        border: 0,
                                        borderRadius: 2,
                                        cursor: controlsLocked
                                            ? "not-allowed"
                                            : "pointer",
                                        flex: 1,
                                        height: 4,
                                        padding: 0,
                                    }}
                                    type="button"
                                />
                            );
                        })}
                    </div>
                    <div data-sot-part="onboarding-step-header">
                        <div
                            data-sot-part="onboarding-step-title"
                            style={{
                                color: "var(--fg-primary)",
                                font: "600 14px var(--font-display)",
                            }}
                        >
                            {visibleStepTitle}
                        </div>
                        <div
                            data-sot-part="onboarding-step-description"
                            style={{
                                color: "var(--fg-tertiary)",
                                font: "12px var(--font-sans)",
                                marginBottom: 14,
                            }}
                        >
                            {ONBOARDING_STEPS[visibleStepIndex].hint}
                        </div>
                    </div>
                    <CardContent
                        className={onboardingCardClassNames.stepBody}
                        data-sot-part="onboarding-step-body"
                    >
                        {finishError ? (
                            <div
                                data-sot-part="onboarding-error"
                                data-sot-state="error"
                                role="alert"
                            >
                                {finishError}
                            </div>
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
                                defaultTranscriptionSource={
                                    defaultTranscriptionSource
                                }
                                isSaving={controlsLocked}
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
                                    defaultTranscriptionSource
                                }
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
                </div>
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
                    data-sot-control="source-provider"
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

            <div data-sot-list="provider-cards">
                {providerOptions.map((item) => {
                    const isActive = item.provider === provider;
                    const ProviderIcon = PROVIDER_ICONS[item.provider];
                    const asset = PROVIDER_ASSETS[item.provider];

                    return (
                        <Button
                            variant="outline"
                            className={onboardingCardClassNames.providerCard}
                            data-sot-control="provider-card"
                            data-sot-cover={
                                item.provider === "feishu-minutes"
                                    ? "true"
                                    : "false"
                            }
                            data-sot-provider={item.provider}
                            data-sot-state={isActive ? "selected" : "idle"}
                            disabled={isSaving}
                            key={item.provider}
                            onClick={() => selectProvider(item.provider)}
                            type="button"
                        >
                            <span
                                data-sot-part="provider-icon"
                                data-sot-cover={
                                    item.provider === "feishu-minutes"
                                        ? "true"
                                        : "false"
                                }
                            >
                                {asset ? (
                                    <img src={asset} alt="" />
                                ) : (
                                    <ProviderIcon />
                                )}
                            </span>
                            <span data-sot-part="provider-meta">
                                <span data-sot-part="provider-name">
                                    {item.label}
                                </span>
                                <span data-sot-part="provider-hint">
                                    {isActive
                                        ? "将作为首次连接来源"
                                        : "可在后续设置里继续补充"}
                                </span>
                            </span>
                        </Button>
                    );
                })}
            </div>

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
                        data-sot-control="source-auth-mode"
                        data-sot-list="source-auth-modes"
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
                                    data-sot-auth-mode={mode}
                                    data-sot-control="source-auth-mode"
                                    data-sot-state={
                                        active ? "selected" : "idle"
                                    }
                                    className={
                                        onboardingCardClassNames.sourceAuthModeOption
                                    }
                                    disabled={isSaving}
                                    key={mode}
                                    value={mode}
                                >
                                    <span data-sot-part="source-auth-mode-title">
                                        {getSourceAuthModeDisplayLabel(
                                            mode,
                                            language,
                                        )}
                                    </span>
                                    <span
                                        className="text-left"
                                        data-sot-part="source-auth-mode-description"
                                    >
                                        按来源支持的方式填写授权
                                    </span>
                                </ToggleGroupItem>
                            );
                        })}
                    </ToggleGroup>
                </OnboardingFieldRow>
            ) : (
                <MatrixRow
                    label="登录方式"
                    state="ready"
                    value={selectedAuthModeLabel}
                />
            )}

            {!usesCustomServerSelector ? (
                <OnboardingFieldRow
                    description="来源 API 或网页登录入口"
                    disabled={isSaving}
                    id="source-base-url"
                    label="服务地址"
                >
                    <Input
                        data-sot-control="source-base-url"
                        disabled={isSaving}
                        id="source-base-url"
                        onChange={(event) => setBaseUrl(event.target.value)}
                        value={currentDraft.baseUrl}
                    />
                </OnboardingFieldRow>
            ) : (
                <MatrixRow
                    label="服务地址"
                    state="ready"
                    value={sourceServiceLabel}
                />
            )}

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

            <WizardActions
                isSaving={isSaving}
                onBack={onBack}
                onNext={onNext}
            />
            <MatrixRow label="当前来源" state="selected" value={sourceLabel} />
        </>
    );
}

function TranscriptionStep({
    defaultTranscriptionSource,
    isSaving,
    onNext,
    setDefaultTranscriptionSource,
}: {
    defaultTranscriptionSource: "dingtalk-a1" | "ticnote" | "feishu-minutes";
    isSaving: boolean;
    onNext: () => void;
    setDefaultTranscriptionSource: (
        value: "dingtalk-a1" | "ticnote" | "feishu-minutes",
    ) => void;
}) {
    const options = [
        {
            id: "dingtalk-a1",
            label: "钉钉 闪记 · 已连接",
            connected: true,
            swatch: "accent",
        },
        {
            id: "ticnote",
            label: "TicNote · 已连接",
            connected: true,
            swatch: "empty",
        },
        {
            id: "feishu-minutes",
            label: "飞书妙记 · 未连接",
            connected: false,
            swatch: "empty",
        },
    ] as const;

    return (
        <div data-sot-panel="onboarding-default-source-step">
            <div data-sot-list="onboarding-default-sources">
                {options.map((option) => {
                    const isActive = option.id === defaultTranscriptionSource;

                    return (
                        <div
                            aria-disabled={
                                isSaving || !option.connected
                                    ? "true"
                                    : undefined
                            }
                            data-sot-control="onboarding-default-source"
                            data-sot-provider={option.id}
                            data-sot-state={
                                isActive
                                    ? "selected"
                                    : option.connected
                                      ? "idle"
                                      : "disabled"
                            }
                            key={option.id}
                            onKeyDown={(event) => {
                                if (
                                    isSaving ||
                                    !option.connected ||
                                    (event.key !== "Enter" && event.key !== " ")
                                ) {
                                    return;
                                }

                                event.preventDefault();
                                setDefaultTranscriptionSource(option.id);
                            }}
                            onClick={() => {
                                if (isSaving || !option.connected) {
                                    return;
                                }
                                setDefaultTranscriptionSource(option.id);
                            }}
                            role="button"
                            style={{
                                alignItems: "center",
                                appearance: "none",
                                background: isActive
                                    ? "color-mix(in oklab, var(--accent) 6%, transparent)"
                                    : "transparent",
                                border: `1px solid ${isActive ? "var(--accent)" : "var(--line-hairline)"}`,
                                borderRadius: 8,
                                color: "var(--fg-primary)",
                                cursor:
                                    isSaving || !option.connected
                                        ? "not-allowed"
                                        : "pointer",
                                display: "flex",
                                gap: 8,
                                opacity:
                                    !isActive && !option.connected
                                        ? 0.55
                                        : undefined,
                                padding: 8,
                                textAlign: "left",
                            }}
                            tabIndex={isSaving || !option.connected ? -1 : 0}
                        >
                            <span
                                data-sot-part="onboarding-default-source-swatch"
                                data-sot-swatch={option.swatch}
                            />
                            {option.label}
                        </div>
                    );
                })}
            </div>
            <div data-sot-part="onboarding-actions">
                <button
                    data-sot-control="onboarding-skip"
                    disabled={isSaving}
                    onClick={onNext}
                    style={{
                        alignItems: "center",
                        background: "transparent",
                        border: "1px solid var(--line-hairline)",
                        borderRadius: 8,
                        color: "var(--fg-secondary)",
                        cursor: "pointer",
                        display: "inline-flex",
                        font: "600 11px var(--font-sans)",
                        gap: 6,
                        height: 26,
                        padding: "0 10px",
                    }}
                    type="button"
                >
                    跳过
                </button>
                <button
                    data-sot-control="onboarding-next"
                    disabled={isSaving}
                    onClick={onNext}
                    style={{
                        alignItems: "center",
                        background: "var(--accent)",
                        border: "1px solid transparent",
                        borderRadius: 8,
                        color: "white",
                        cursor: "pointer",
                        display: "inline-flex",
                        font: "600 11px var(--font-sans)",
                        gap: 6,
                        height: 26,
                        padding: "0 10px",
                    }}
                    type="button"
                >
                    下一步
                </button>
            </div>
        </div>
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
            <div data-sot-list="speaker-profiles">
                <Card
                    hasNoPadding
                    className={onboardingCardClassNames.speakerDraft}
                    data-sot-control="speaker-profile-draft"
                    data-sot-state={speakerState}
                >
                    <span data-sot-part="provider-icon">
                        <UserRound />
                    </span>
                    <CardHeader
                        className={onboardingCardClassNames.providerMeta}
                        data-sot-part="provider-meta"
                    >
                        <CardTitle data-sot-part="provider-name">
                            第一个说话人
                        </CardTitle>
                        <CardDescription data-sot-part="provider-hint">
                            可先留空，工作台内继续校对
                        </CardDescription>
                    </CardHeader>
                </Card>
            </div>
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
                    data-sot-control="speaker-name"
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
                    data-sot-control="speaker-voiceprint"
                    placeholder="voiceprint-local-1"
                />
            </OnboardingFieldRow>
            <MatrixRow
                label="档案状态"
                state={speakerState}
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
    defaultTranscriptionSource: "dingtalk-a1" | "ticnote" | "feishu-minutes";
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
            <div data-sot-list="finish-summary">
                <MatrixRow
                    label="来源"
                    state={connectedSourceLabel ? "connected" : "ready"}
                    value={connectedSourceLabel ?? sourceLabel}
                />
                <MatrixRow
                    label="授权"
                    state="ready"
                    value={selectedAuthModeLabel}
                />
                <MatrixRow
                    label="默认转写"
                    state={transcriptionSaved ? "saved" : "ready"}
                    value={
                        defaultTranscriptionSource === "ticnote"
                            ? "TicNote"
                            : defaultTranscriptionSource === "feishu-minutes"
                              ? "飞书妙记"
                              : "钉钉 闪记"
                    }
                />
                <MatrixRow
                    label="说话人"
                    state={speakerState}
                    value={
                        speakerName.trim() ? speakerName.trim() : "暂不创建档案"
                    }
                />
            </div>
            <div data-sot-part="onboarding-actions">
                <Button
                    type="button"
                    variant="ghost"
                    className={onboardingCardClassNames.secondaryAction}
                    disabled={isSaving}
                    onClick={onBack}
                >
                    返回
                </Button>
                <Button
                    type="button"
                    variant="default"
                    className={onboardingCardClassNames.primaryAction}
                    disabled={isSaving || isFinishing}
                    aria-busy={isSaving || isFinishing}
                    data-sot-control="save-enter"
                    onClick={onFinish}
                >
                    {isSaving || isFinishing ? (
                        <Loader2 data-icon="inline-start" />
                    ) : (
                        <CheckCircle2 data-icon="inline-start" />
                    )}
                    {isSaving || isFinishing ? "保存中..." : "保存并进入工作台"}
                </Button>
            </div>
        </>
    );
}

function MatrixRow({
    label,
    state,
    value,
}: {
    label: string;
    state: string;
    value: string;
}) {
    return (
        <div data-sot-control="matrix-row" data-sot-state={state}>
            <span data-sot-part="matrix-label">{label}</span>
            <strong data-sot-part="matrix-value">{value}</strong>
        </div>
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
        <div data-sot-part="onboarding-actions">
            {onBack ? (
                <Button
                    type="button"
                    variant="ghost"
                    className={onboardingCardClassNames.secondaryAction}
                    disabled={isSaving}
                    onClick={onBack}
                >
                    返回
                </Button>
            ) : null}
            <Button
                type="button"
                variant="default"
                className={onboardingCardClassNames.primaryAction}
                disabled={isSaving}
                data-sot-control="onboarding-next"
                onClick={onNext}
            >
                下一步
            </Button>
        </div>
    );
}
