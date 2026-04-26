import type { UiLanguage } from "@/lib/i18n";
import type {
    SourceCapability,
    SourceMaturity,
    SourceMaturityStage,
    SourceProvider,
} from "./catalog";
import type {
    LocalizedDisplayCopy,
    SourceCapabilityDisplayMetadataRegistry,
    SourceMaturityLevelDisplayMetadataRegistry,
    SourceMaturityStageDisplayMetadataRegistry,
    SourceProviderDisplayMetadataRegistry,
} from "./display-metadata-types";

const FORMAL_DATA_SOURCE_DOC_URL =
    "https://github.com/MapleEve/BetterAINote/blob/main/docs/DATA_SOURCES.md";

const SOURCE_MATURITY_LEVEL_COPY: SourceMaturityLevelDisplayMetadataRegistry = {
    validated: {
        zh: "推荐",
        en: "Recommended",
    },
    "near-usable": {
        zh: "可连接",
        en: "Connectable",
    },
    partial: {
        zh: "可连接",
        en: "Connectable",
    },
    verifiable: {
        zh: "可连接",
        en: "Connectable",
    },
};

const SOURCE_MATURITY_STAGE_COPY: SourceMaturityStageDisplayMetadataRegistry = {
    mainline: {
        title: {
            zh: "已验证来源",
            en: "Verified sources",
        },
        description: {
            zh: "已验证可优先连接的录音来源。",
            en: "Verified recording sources that are ready to connect first.",
        },
    },
    experimental: {
        title: {
            zh: "更多来源",
            en: "More sources",
        },
        description: {
            zh: "按需连接其它录音来源。",
            en: "Connect other recording sources as needed.",
        },
    },
};

const SOURCE_CAPABILITY_COPY: SourceCapabilityDisplayMetadataRegistry = {
    workerSync: {
        label: {
            zh: "自动导入",
            en: "Automatic import",
        },
        availableDescription: {
            zh: "可自动导入录音和详情。",
            en: "Recordings and details can be imported automatically.",
        },
        unavailableDescription: {
            zh: "请手动导入或稍后重试。",
            en: "Import manually or try again later.",
        },
    },
    audioDownload: {
        label: {
            zh: "本地音频下载",
            en: "Local audio download",
        },
        availableDescription: {
            zh: "可把原始音频落到 BetterAINote 本地，供播放和后续处理。",
            en: "Raw audio can be downloaded into BetterAINote for playback and follow-up processing.",
        },
        unavailableDescription: {
            zh: "请在来源平台查看音频。",
            en: "Review the audio on the source platform.",
        },
    },
    officialTranscript: {
        label: {
            zh: "来源逐字稿",
            en: "Source transcript",
        },
        availableDescription: {
            zh: "可读取来源逐字稿。",
            en: "Source transcripts can be shown.",
        },
        unavailableDescription: {
            zh: "请在来源平台查看逐字稿。",
            en: "Review transcripts on the source platform.",
        },
    },
    officialSummary: {
        label: {
            zh: "来源摘要/报告",
            en: "Source summary/report",
        },
        availableDescription: {
            zh: "可读取来源摘要或报告。",
            en: "Source summaries or reports can be shown.",
        },
        unavailableDescription: {
            zh: "请在来源平台查看摘要或报告。",
            en: "Review summaries or reports on the source platform.",
        },
    },
    privateTranscribe: {
        label: {
            zh: "本地私有转录",
            en: "Local private transcription",
        },
        availableDescription: {
            zh: "拿到本地音频后，可继续进入 BetterAINote 私有转录链。",
            en: "Once audio is available locally, it can continue into the BetterAINote private transcription flow.",
        },
        unavailableDescription: {
            zh: "请先确认本地音频已就绪。",
            en: "Check that local audio is ready first.",
        },
    },
    localRename: {
        label: {
            zh: "本地改名",
            en: "Local rename",
        },
        availableDescription: {
            zh: "允许在 BetterAINote 中修改本地录音文件名。",
            en: "Local recording filenames can be changed inside BetterAINote.",
        },
        unavailableDescription: {
            zh: "请在来源平台修改名称。",
            en: "Rename it on the source platform.",
        },
    },
    upstreamTitleWriteback: {
        label: {
            zh: "标题回写来源",
            en: "Upstream title write-back",
        },
        availableDescription: {
            zh: "本地改名或 AI Rename 可回写到来源平台。",
            en: "Local rename or AI Rename can write the title back to the upstream platform.",
        },
        unavailableDescription: {
            zh: "本地名称会单独保存。",
            en: "The local name is saved separately.",
        },
    },
};

const SOURCE_PROVIDER_DISPLAY_METADATA: SourceProviderDisplayMetadataRegistry =
    {
        plaud: {
            label: {
                zh: "Plaud",
                en: "Plaud",
            },
            helpDocAnchor: "#plaud",
            maturityHint: {
                zh: "连接后可导入 Plaud 录音。",
                en: "Connect to import Plaud recordings.",
            },
            capabilitySurfaceHint: {
                zh: "连接后可导入录音、查看内容并更新标题。",
                en: "Connect to import recordings, view content, and update titles.",
            },
        },
        ticnote: {
            label: {
                zh: "TicNote",
                en: "TicNote",
            },
            helpDocAnchor: "#ticnote",
            maturityHint: {
                zh: "连接后可导入 TicNote 录音。",
                en: "Connect to import TicNote recordings.",
            },
            capabilitySurfaceHint: {
                zh: "连接后可导入录音、查看内容并更新标题。",
                en: "Connect to import recordings, view content, and update titles.",
            },
        },
        "feishu-minutes": {
            label: {
                zh: "飞书妙记",
                en: "Feishu Minutes",
            },
            helpDocAnchor: "#feishu-minutes",
            maturityHint: {
                zh: "连接后可查看飞书妙记内容。",
                en: "Connect to view Feishu Minutes content.",
            },
            capabilitySurfaceHint: {
                zh: "连接后可查看飞书妙记内容。",
                en: "Connect to view Feishu Minutes content.",
            },
        },
        "dingtalk-a1": {
            label: {
                zh: "钉钉闪记/A1",
                en: "DingTalk A1",
            },
            helpDocAnchor: "#dingtalk-a1",
            maturityHint: {
                zh: "连接后可查看钉钉闪记内容。",
                en: "Connect to view DingTalk A1 content.",
            },
            capabilitySurfaceHint: {
                zh: "连接后可查看钉钉闪记内容。",
                en: "Connect to view DingTalk A1 content.",
            },
        },
        iflyrec: {
            label: {
                zh: "讯飞听见/录音笔",
                en: "iFLYTEK iflyrec",
            },
            maturityHint: {
                zh: "连接后可查看讯飞听见内容。",
                en: "Connect to view iFLYTEK content.",
            },
            capabilitySurfaceHint: {
                zh: "连接后可查看讯飞听见逐字稿。",
                en: "Connect to view iFLYTEK transcripts.",
            },
            sourceRecordDescriptionOverride: {
                zh: "这里显示讯飞听见/录音笔的逐字稿和详情。",
                en: "This view shows iFLYTEK transcripts and details.",
            },
        },
    };

function getLocalizedCopy(copy: LocalizedDisplayCopy, language: UiLanguage) {
    return language.startsWith("zh") ? copy.zh : copy.en;
}

export function getSourceProviderDisplayLabel(
    provider: string | null | undefined,
    language: UiLanguage,
) {
    if (provider === "local" || provider == null) {
        return language.startsWith("zh") ? "本地" : "Local";
    }

    return SOURCE_PROVIDER_DISPLAY_METADATA[provider as SourceProvider]
        ? getLocalizedCopy(
              SOURCE_PROVIDER_DISPLAY_METADATA[provider as SourceProvider]
                  .label,
              language,
          )
        : provider;
}

export function getDataSourceHelpDocUrlFromMetadata(
    provider: string | null | undefined,
) {
    const metadata = provider
        ? SOURCE_PROVIDER_DISPLAY_METADATA[provider as SourceProvider]
        : null;
    return metadata?.helpDocAnchor
        ? `${FORMAL_DATA_SOURCE_DOC_URL}${metadata.helpDocAnchor}`
        : null;
}

export function getSourceMaturityLevelLabelFromMetadata(
    maturity: SourceMaturity,
    language: UiLanguage,
) {
    return getLocalizedCopy(
        SOURCE_MATURITY_LEVEL_COPY[maturity.level],
        language,
    );
}

export function getSourceProviderGroupDisplayMetadata(
    stage: SourceMaturityStage,
    language: UiLanguage,
) {
    const metadata = SOURCE_MATURITY_STAGE_COPY[stage];
    return {
        title: getLocalizedCopy(metadata.title, language),
        description: getLocalizedCopy(metadata.description, language),
    };
}

export function getSourceProviderMaturityLabelFromMetadata(
    _provider: SourceProvider,
    maturity: SourceMaturity,
    language: UiLanguage,
) {
    const levelLabel = getSourceMaturityLevelLabelFromMetadata(
        maturity,
        language,
    );

    if (maturity.stage === "mainline") {
        return language.startsWith("zh")
            ? `已验证来源 / ${levelLabel}`
            : `Verified sources / ${levelLabel}`;
    }

    return language.startsWith("zh")
        ? `更多来源 / ${levelLabel}`
        : `More sources / ${levelLabel}`;
}

export function getSourceProviderMaturityHintFromMetadata(
    provider: SourceProvider,
    language: UiLanguage,
) {
    return getLocalizedCopy(
        SOURCE_PROVIDER_DISPLAY_METADATA[provider].maturityHint,
        language,
    );
}

export function getSourceCapabilityDisplayMetadata(
    capability: SourceCapability,
    available: boolean,
    language: UiLanguage,
) {
    const metadata = SOURCE_CAPABILITY_COPY[capability];

    return {
        label: getLocalizedCopy(metadata.label, language),
        description: getLocalizedCopy(
            available
                ? metadata.availableDescription
                : metadata.unavailableDescription,
            language,
        ),
    };
}

export function getSourceCapabilitySurfaceHintFromMetadata(
    provider: SourceProvider,
    language: UiLanguage,
) {
    return getLocalizedCopy(
        SOURCE_PROVIDER_DISPLAY_METADATA[provider].capabilitySurfaceHint,
        language,
    );
}

export function getSourceRecordAssetLabelFromMetadata(params: {
    provider: SourceProvider | null;
    hasOfficialTranscript: boolean;
    hasOfficialSummary: boolean;
    language: UiLanguage;
}) {
    const zh = params.language.startsWith("zh");

    if (params.hasOfficialTranscript && params.hasOfficialSummary) {
        return zh
            ? "逐字稿、摘要和详情缓存"
            : "transcript, summary, and detail cache";
    }

    if (params.hasOfficialTranscript) {
        return zh ? "逐字稿和详情缓存" : "transcript and detail cache";
    }

    if (params.hasOfficialSummary) {
        return zh ? "摘要和详情缓存" : "summary and detail cache";
    }

    return zh ? "详情缓存" : "detail cache";
}

export function getSourceRecordDescriptionFromMetadata(params: {
    provider: SourceProvider | null;
    providerLabel: string;
    assetLabel: string;
    language: UiLanguage;
}) {
    if (params.provider) {
        const override =
            SOURCE_PROVIDER_DISPLAY_METADATA[params.provider]
                .sourceRecordDescriptionOverride;
        if (override) {
            return getLocalizedCopy(override, params.language);
        }
    }

    if (params.language.startsWith("zh")) {
        return `这里显示 ${params.providerLabel} 平台原生${params.assetLabel}，不会覆盖本地私有转录。`;
    }

    return `This view shows the source-side ${params.assetLabel} from ${params.providerLabel}. It does not overwrite the local private transcript.`;
}
