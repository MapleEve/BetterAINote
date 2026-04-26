import type { UiLanguage } from "@/lib/i18n";
import type {
    SourceAuthMode,
    SourceCapability,
    SourceCapabilitySet,
    SourceMaturityStage,
    SourceProvider,
} from "./catalog";

export interface DataSourceUiState {
    provider: SourceProvider;
    enabled: boolean;
    authMode: string;
    baseUrl: string | null;
    config: Record<string, unknown>;
    secretsConfigured: Record<string, boolean>;
}

export type SecretDraftState = Partial<
    Record<SourceProvider, Record<string, string>>
>;

export interface DataSourceDraft {
    authMode: string;
    baseUrl: string;
    config: Record<string, unknown>;
    secrets: Record<string, string>;
}

export type DataSourceDraftState = Record<SourceProvider, DataSourceDraft>;

export interface DataSourceProviderGroup<
    T extends { provider: SourceProvider },
> {
    stage: SourceMaturityStage;
    title: string;
    description: string;
    sources: T[];
}

export interface DataSourceFieldOption {
    value: string;
    label: string;
}

export interface DataSourceFormField {
    id: string;
    target: "root" | "config" | "secret";
    key: string;
    kind: "text" | "textarea" | "select" | "switch";
    label: string;
    value: string | boolean;
    description?: string;
    placeholder?: string;
    rows?: number;
    spellCheck?: boolean;
    className?: string;
    options?: DataSourceFieldOption[];
}

export interface SourceCapabilityDisplayItem {
    capability: SourceCapability;
    label: string;
    available: boolean;
    description: string;
}

export interface DataSourceDisplaySection<
    T extends { provider: SourceProvider },
> {
    connected: T[];
    available: T[];
}

export interface DataSourceSavePayload {
    provider: SourceProvider;
    enabled: boolean;
    authMode: SourceAuthMode;
    config: Record<string, unknown>;
    secrets: Record<string, string>;
    baseUrl?: string | null;
}

export interface ProviderPresentationDefinition {
    secretKeys: readonly string[];
    usesCustomServerSelector?: boolean;
    getFields: (
        state: DataSourceUiState,
        secretDraft: Record<string, string>,
        language: UiLanguage,
        context: "settings" | "onboarding",
    ) => DataSourceFormField[];
    normalizePayload?: (params: {
        state: DataSourceUiState;
        secretDraft: Record<string, string>;
        payload: DataSourceSavePayload;
        language: UiLanguage;
    }) => DataSourceSavePayload;
}

export interface DataSourceDisplayState {
    provider: SourceProvider;
    displayName: string;
    runtimeStatus: "active" | "planned";
    authModes: SourceAuthMode[];
    enabled: boolean;
    connected: boolean;
    authMode: string;
    baseUrl: string | null;
    config: Record<string, unknown>;
    capabilities: SourceCapabilitySet;
    secretsConfigured: Record<string, boolean>;
    lastSync: string | null;
}
