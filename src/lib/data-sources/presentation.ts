import type { UiLanguage } from "@/lib/i18n";
import {
    canRecordingRenameLocally,
    canRecordingSyncTitleUpstream,
    canRecordingUsePrivateTranscribe,
    DATA_SOURCE_CATALOG,
    DATA_SOURCE_PROVIDERS,
    getRecordingCapabilityState,
    getSourceCapabilitiesForAuthMode,
    getSourceProviderMaturity,
    isSourceProvider,
    SOURCE_CAPABILITY_ORDER,
    type SourceAuthMode,
    type SourceCapability,
    type SourceCapabilitySet,
    type SourceMaturity,
    type SourceMaturityStage,
    type SourceProvider,
} from "./catalog";
import {
    getDataSourceHelpDocUrlFromMetadata,
    getSourceCapabilityDisplayMetadata,
    getSourceCapabilitySurfaceHintFromMetadata,
    getSourceMaturityLevelLabelFromMetadata,
    getSourceProviderDisplayLabel,
    getSourceProviderGroupDisplayMetadata,
    getSourceProviderMaturityHintFromMetadata,
    getSourceProviderMaturityLabelFromMetadata,
    getSourceRecordAssetLabelFromMetadata,
    getSourceRecordDescriptionFromMetadata,
} from "./display-metadata";
import type {
    DataSourceDisplaySection,
    DataSourceDraftState,
    DataSourceFormField,
    DataSourceProviderGroup,
    DataSourceSavePayload,
    DataSourceUiState,
    SecretDraftState,
    SourceCapabilityDisplayItem,
} from "./presentation-definition-types";
import { SOURCE_PROVIDER_PRESENTATIONS } from "./presentation-provider-registry";
import {
    buildDraftSecrets,
    cloneProviderDefaultConfig,
    isZh,
} from "./presentation-shared";
import { SOURCE_PROVIDER_MANIFESTS } from "./providers/manifest";

export type {
    DataSourceDisplayState,
    DataSourceDraft,
    DataSourceDraftState,
    DataSourceFieldOption,
    DataSourceFormField,
    SecretDraftState,
} from "./presentation-definition-types";

export function getSourceProviderLabel(
    provider: string | null | undefined,
    language: UiLanguage,
) {
    return getSourceProviderDisplayLabel(provider, language);
}

export function getDataSourceHelpDocUrl(provider: string | null | undefined) {
    return getDataSourceHelpDocUrlFromMetadata(provider);
}

export function getSourceAuthModeDisplayLabel(
    mode: string,
    language: UiLanguage,
) {
    const labels: Record<string, { zh: string; en: string }> = {
        bearer: { zh: "访问令牌", en: "Access token" },
        cookie: { zh: "网页登录", en: "Web sign-in" },
        "oauth-device-flow": { zh: "访问令牌", en: "Access token" },
        "web-reverse": {
            zh: "网页登录信息",
            en: "Web sign-in details",
        },
        "session-header": {
            zh: "会话登录信息",
            en: "Session sign-in details",
        },
        "agent-token": { zh: "设备登录信息", en: "Device sign-in details" },
    };

    const label = labels[mode];
    return label ? (isZh(language) ? label.zh : label.en) : mode;
}

function getKnownSourceProvider(provider: string | null | undefined) {
    return isSourceProvider(provider) ? provider : null;
}

function _getSourceMaturityLevelLabel(
    maturity: SourceMaturity,
    language: UiLanguage,
) {
    return getSourceMaturityLevelLabelFromMetadata(maturity, language);
}

function getSourceProviderGroupTitle(
    stage: SourceMaturityStage,
    language: UiLanguage,
) {
    return getSourceProviderGroupDisplayMetadata(stage, language).title;
}

function getSourceProviderGroupDescription(
    stage: SourceMaturityStage,
    language: UiLanguage,
) {
    return getSourceProviderGroupDisplayMetadata(stage, language).description;
}

export function groupDataSourceProvidersByStage<
    T extends { provider: SourceProvider },
>(sources: readonly T[], language: UiLanguage): DataSourceProviderGroup<T>[] {
    const stages: SourceMaturityStage[] = ["mainline", "experimental"];

    return stages
        .map((stage) => {
            const groupedSources = sources.filter(
                (source) =>
                    getSourceProviderMaturity(source.provider).stage === stage,
            );

            if (groupedSources.length === 0) {
                return null;
            }

            return {
                stage,
                title: getSourceProviderGroupTitle(stage, language),
                description: getSourceProviderGroupDescription(stage, language),
                sources: groupedSources,
            };
        })
        .filter((group) => group !== null);
}

export function getSourceProviderMaturityLabel(
    provider: string | null | undefined,
    language: UiLanguage,
) {
    const knownProvider = getKnownSourceProvider(provider);
    if (!knownProvider) {
        return null;
    }

    const maturity = getSourceProviderMaturity(knownProvider);
    return getSourceProviderMaturityLabelFromMetadata(
        knownProvider,
        maturity,
        language,
    );
}

export function getSourceProviderMaturityHint(
    provider: string | null | undefined,
    language: UiLanguage,
) {
    const knownProvider = getKnownSourceProvider(provider);
    if (!knownProvider) {
        return null;
    }

    return getSourceProviderMaturityHintFromMetadata(knownProvider, language);
}

function getSourceRecordCapabilities(provider: string | null | undefined) {
    const knownProvider = getKnownSourceProvider(provider);
    if (!knownProvider) {
        return null;
    }

    return DATA_SOURCE_CATALOG[knownProvider].capabilities;
}

function getSourceCapabilityLabel(
    capability: SourceCapability,
    language: UiLanguage,
) {
    return getSourceCapabilityDisplayMetadata(capability, true, language).label;
}

function getSourceCapabilityDescription(
    capability: SourceCapability,
    available: boolean,
    language: UiLanguage,
) {
    return getSourceCapabilityDisplayMetadata(capability, available, language)
        .description;
}

export function getSourceCapabilityDisplayItems(
    provider: string | null | undefined,
    language: UiLanguage,
    authMode?: string | null,
) {
    const knownProvider = getKnownSourceProvider(provider);
    if (!knownProvider) {
        return [] satisfies SourceCapabilityDisplayItem[];
    }

    const capabilities = getSourceCapabilitiesForAuthMode(
        knownProvider,
        authMode,
    ) as SourceCapabilitySet;

    return SOURCE_CAPABILITY_ORDER.map((capability) => ({
        capability,
        label: getSourceCapabilityLabel(capability, language),
        available: capabilities[capability],
        description: getSourceCapabilityDescription(
            capability,
            capabilities[capability],
            language,
        ),
    })) satisfies SourceCapabilityDisplayItem[];
}

export function getSupportedSourceCapabilityDisplayItems(
    provider: string | null | undefined,
    language: UiLanguage,
    authMode?: string | null,
) {
    return getSourceCapabilityDisplayItems(provider, language, authMode).filter(
        (item) => item.available,
    );
}

export function buildDataSourceDisplaySection<
    T extends { provider: SourceProvider; connected?: boolean },
>(sources: readonly T[]): DataSourceDisplaySection<T> {
    const orderedSources = [...sources].sort(
        (left, right) =>
            DATA_SOURCE_PROVIDERS.indexOf(left.provider) -
            DATA_SOURCE_PROVIDERS.indexOf(right.provider),
    );

    const connected = orderedSources.filter((source) =>
        Boolean(source.connected),
    );
    const available = orderedSources.filter((source) => !source.connected);

    return {
        connected,
        available,
    };
}

export function getSourceCapabilitySurfaceHint(
    provider: string | null | undefined,
    language: UiLanguage,
) {
    const knownProvider = getKnownSourceProvider(provider);
    if (!knownProvider) {
        return null;
    }

    return getSourceCapabilitySurfaceHintFromMetadata(knownProvider, language);
}

export function sourceProviderHasOfficialRecord(
    provider: string | null | undefined,
) {
    const capabilities = getSourceRecordCapabilities(provider);
    return Boolean(
        capabilities &&
            (capabilities.officialTranscript || capabilities.officialSummary),
    );
}

export function canRecordingPrivateTranscribe(params: {
    sourceProvider: string | null | undefined;
    hasAudio: boolean;
}) {
    return canRecordingUsePrivateTranscribe(params);
}

export function canRecordingRename(sourceProvider: string | null | undefined) {
    return canRecordingRenameLocally(sourceProvider);
}

export function getRecordingRenameActionKey(
    sourceProvider: string | null | undefined,
) {
    return canRecordingSyncTitleUpstream(sourceProvider)
        ? "dashboard.renameAndSync"
        : "dashboard.renameRecording";
}

export function getPrivateTranscriptionUnavailableMessage(
    provider: string | null | undefined,
    hasAudio: boolean,
    language: UiLanguage,
) {
    const capabilityState = getRecordingCapabilityState({
        sourceProvider: provider,
        hasAudio,
    });
    const knownProvider = capabilityState.provider;

    if (knownProvider && !capabilityState.providerSupportsAudioDownload) {
        return isZh(language)
            ? "这个录音源当前不提供可下载到 BetterAINote 本地的音频文件，因此不能发起本地私有转录。你只能查看来源侧逐字稿或报告。"
            : "This source does not provide audio files that BetterAINote can download locally, so local private transcription is unavailable. You can only review the source-side transcript or report.";
    }

    if (knownProvider && !capabilityState.providerSupportsPrivateTranscribe) {
        return isZh(language)
            ? "这个录音源当前不支持在 BetterAINote 中发起本地私有转录。你只能查看来源侧逐字稿或报告。"
            : "This source does not currently support local private transcription in BetterAINote. You can only review the source-side transcript or report.";
    }

    if (!hasAudio) {
        return isZh(language)
            ? "这个数据源没有可下载到本地的音频文件，当前只能查看来源逐字稿或报告。"
            : "This source does not provide downloadable local audio. You can only review the source transcript or report for now.";
    }

    return null;
}

export function getLocalRenameUnavailableMessage(
    provider: string | null | undefined,
    language: UiLanguage,
) {
    const capabilityState = getRecordingCapabilityState({
        sourceProvider: provider,
        hasAudio: false,
    });

    if (capabilityState.canRenameLocally) {
        return null;
    }

    return isZh(language)
        ? "这个录音源当前不支持在 BetterAINote 中修改本地文件名，因此 AI 重命名和手动改名都会保持禁用。"
        : "This source does not currently support local filename changes in BetterAINote, so both AI rename and manual rename stay disabled.";
}

export function getAutoRenameBehaviorHint(
    provider: string | null | undefined,
    language: UiLanguage,
) {
    const capabilityState = getRecordingCapabilityState({
        sourceProvider: provider,
        hasAudio: false,
    });

    if (!capabilityState.canRenameLocally) {
        return getLocalRenameUnavailableMessage(provider, language);
    }

    if (!capabilityState.canSyncTitleUpstream) {
        return isZh(language)
            ? "这个录音源当前不支持把标题回写到来源平台。AI 重命名只会更新 BetterAINote 本地文件名。"
            : "This source cannot write titles back to the upstream platform right now. AI rename updates only the BetterAINote local filename.";
    }

    return null;
}

export function getSourceRecordLabel(
    provider: string | null | undefined,
    language: UiLanguage,
) {
    const label = getSourceProviderLabel(provider, language);
    return isZh(language) ? `${label} 平台记录` : `${label} source record`;
}

export function getSourceTabLabel(
    provider: string | null | undefined,
    language: UiLanguage,
) {
    if (sourceProviderHasOfficialRecord(provider)) {
        return isZh(language)
            ? `${getSourceProviderLabel(provider, language)} 来源原始记录`
            : `${getSourceProviderLabel(provider, language)} source record`;
    }

    return getSourceRecordLabel(provider, language);
}

function getSourceRecordAssetLabel(
    provider: string | null | undefined,
    language: UiLanguage,
) {
    const capabilities = getSourceRecordCapabilities(provider);
    return getSourceRecordAssetLabelFromMetadata({
        provider: getKnownSourceProvider(provider),
        hasOfficialTranscript: capabilities?.officialTranscript ?? false,
        hasOfficialSummary: capabilities?.officialSummary ?? false,
        language,
    });
}

export function getSourceRecordDescription(
    provider: string | null | undefined,
    language: UiLanguage,
) {
    const label = getSourceProviderLabel(provider, language);
    return getSourceRecordDescriptionFromMetadata({
        provider: getKnownSourceProvider(provider),
        providerLabel: label,
        assetLabel: getSourceRecordAssetLabel(provider, language),
        language,
    });
}

export function getSourceRecordEmptyHint(
    provider: string | null | undefined,
    language: UiLanguage,
) {
    if (isZh(language)) {
        return `点击右上角按钮加载${getSourceProviderLabel(provider, language)}的平台原生${getSourceRecordAssetLabel(provider, language)}。`;
    }

    return `Load the source-side ${getSourceRecordAssetLabel(provider, language)} from ${getSourceProviderLabel(provider, language)}.`;
}

export function getLocalTranscriptHint(
    provider: string | null | undefined,
    language: UiLanguage,
) {
    if (!sourceProviderHasOfficialRecord(provider)) {
        return null;
    }

    const assetLabel = getSourceRecordAssetLabel(provider, language);

    if (isZh(language)) {
        return `来源侧${assetLabel}请切到来源标签查看，这里只展示本地转录。`;
    }

    return `Source-side ${assetLabel} stays on the source tab. This panel only shows the local transcript.`;
}

export function getUpstreamDeletedLabel(language: UiLanguage) {
    return isZh(language)
        ? "已从上游平台删除，仅保留本地副本"
        : "Deleted from the upstream source — local copy only";
}

export function createDefaultSourceDrafts(): DataSourceDraftState {
    return Object.fromEntries(
        DATA_SOURCE_PROVIDERS.map((provider) => {
            const manifest = SOURCE_PROVIDER_MANIFESTS[provider];
            const presentation = SOURCE_PROVIDER_PRESENTATIONS[provider];

            return [
                provider,
                {
                    authMode: manifest.defaults.authMode,
                    baseUrl: manifest.metadata.defaultBaseUrl ?? "",
                    config: cloneProviderDefaultConfig(provider),
                    secrets: buildDraftSecrets(presentation.secretKeys),
                },
            ];
        }),
    ) as DataSourceDraftState;
}

function buildBaseSourcePayload(
    state: DataSourceUiState,
    secretDraft: Record<string, string>,
): DataSourceSavePayload {
    const manifest = SOURCE_PROVIDER_MANIFESTS[state.provider];
    const secretKeys = SOURCE_PROVIDER_PRESENTATIONS[state.provider].secretKeys;

    return {
        provider: state.provider,
        enabled: state.enabled,
        authMode: (state.authMode ||
            manifest.defaults.authMode) as SourceAuthMode,
        baseUrl: state.baseUrl ?? manifest.metadata.defaultBaseUrl ?? null,
        config: {
            ...cloneProviderDefaultConfig(state.provider),
            ...state.config,
        },
        secrets: Object.fromEntries(
            secretKeys.map((key) => [key, secretDraft[key]?.trim() ?? ""]),
        ),
    };
}

export function providerUsesCustomServerSelector(provider: SourceProvider) {
    return Boolean(
        SOURCE_PROVIDER_PRESENTATIONS[provider].usesCustomServerSelector,
    );
}

export function getProviderFormFields(
    state: DataSourceUiState,
    secretDrafts: SecretDraftState,
    language: UiLanguage,
    context: "settings" | "onboarding",
): DataSourceFormField[] {
    const secretDraft = secretDrafts[state.provider] ?? {};
    return SOURCE_PROVIDER_PRESENTATIONS[state.provider].getFields(
        state,
        secretDraft,
        language,
        context,
    );
}

export function buildDataSourceSavePayload(
    state: DataSourceUiState,
    secretDrafts: SecretDraftState,
    language: UiLanguage,
) {
    const secretDraft = secretDrafts[state.provider] ?? {};
    const payload = buildBaseSourcePayload(state, secretDraft);
    return (
        SOURCE_PROVIDER_PRESENTATIONS[state.provider].normalizePayload?.({
            state,
            secretDraft,
            payload,
            language,
        }) ?? payload
    );
}
