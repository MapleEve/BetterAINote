import type {
    SourceCapability,
    SourceMaturityLevel,
    SourceMaturityStage,
    SourceProvider,
} from "./catalog";

export interface LocalizedDisplayCopy {
    zh: string;
    en: string;
}

export interface SourceCapabilityDisplayMetadata {
    label: LocalizedDisplayCopy;
    availableDescription: LocalizedDisplayCopy;
    unavailableDescription: LocalizedDisplayCopy;
}

export interface SourceProviderDisplayMetadata {
    label: LocalizedDisplayCopy;
    helpDocAnchor?: string;
    maturityHint: LocalizedDisplayCopy;
    capabilitySurfaceHint: LocalizedDisplayCopy;
    sourceRecordDescriptionOverride?: LocalizedDisplayCopy;
}

export type SourceProviderDisplayMetadataRegistry = Record<
    SourceProvider,
    SourceProviderDisplayMetadata
>;

export type SourceCapabilityDisplayMetadataRegistry = Record<
    SourceCapability,
    SourceCapabilityDisplayMetadata
>;

export type SourceMaturityLevelDisplayMetadataRegistry = Record<
    SourceMaturityLevel,
    LocalizedDisplayCopy
>;

export type SourceMaturityStageDisplayMetadataRegistry = Record<
    SourceMaturityStage,
    {
        title: LocalizedDisplayCopy;
        description: LocalizedDisplayCopy;
    }
>;
