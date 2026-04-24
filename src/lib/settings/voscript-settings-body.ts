import { normalizePrivateTranscriptionBaseUrlSetting } from "@/lib/settings/service-url-settings";
import {
    buildVoScriptProviderUpdates,
    type NormalizedVoScriptProviderInput,
    normalizePrivateTranscriptionMaxInflightJobs,
    normalizePrivateTranscriptionNoRepeatNgramSize,
    normalizePrivateTranscriptionSnrThreshold,
    normalizeVoScriptDenoiseModel,
    resolveVoScriptSpeakerBounds,
} from "@/lib/settings/voscript-provider-settings";

interface ExistingVoScriptSettings {
    privateTranscriptionMinSpeakers?: number | null;
    privateTranscriptionMaxSpeakers?: number | null;
}

function buildVoScriptConnectionInput(body: Record<string, unknown>) {
    const normalized: NormalizedVoScriptProviderInput = {};

    if (body.privateTranscriptionBaseUrl !== undefined) {
        normalized.privateTranscriptionBaseUrl =
            normalizePrivateTranscriptionBaseUrlSetting(
                body.privateTranscriptionBaseUrl,
            );
    }

    return normalized;
}

function buildVoScriptSpeakerInput(
    body: Record<string, unknown>,
    existing: ExistingVoScriptSettings,
) {
    const normalized: NormalizedVoScriptProviderInput = {};
    const { nextMinSpeakers, nextMaxSpeakers } = resolveVoScriptSpeakerBounds({
        bodyMinSpeakers: body.privateTranscriptionMinSpeakers,
        bodyMaxSpeakers: body.privateTranscriptionMaxSpeakers,
        existingMinSpeakers: existing.privateTranscriptionMinSpeakers,
        existingMaxSpeakers: existing.privateTranscriptionMaxSpeakers,
    });

    if (body.privateTranscriptionMinSpeakers !== undefined) {
        normalized.privateTranscriptionMinSpeakers = nextMinSpeakers;
    }

    if (body.privateTranscriptionMaxSpeakers !== undefined) {
        normalized.privateTranscriptionMaxSpeakers = nextMaxSpeakers;
    }

    return normalized;
}

function buildVoScriptRuntimeInput(body: Record<string, unknown>) {
    const normalized: NormalizedVoScriptProviderInput = {};

    if (body.privateTranscriptionSnrThreshold !== undefined) {
        normalized.privateTranscriptionSnrThreshold =
            normalizePrivateTranscriptionSnrThreshold(
                body.privateTranscriptionSnrThreshold,
            );
    }

    if (body.privateTranscriptionMaxInflightJobs !== undefined) {
        normalized.privateTranscriptionMaxInflightJobs =
            normalizePrivateTranscriptionMaxInflightJobs(
                body.privateTranscriptionMaxInflightJobs,
            );
    }

    if (body.privateTranscriptionNoRepeatNgramSize !== undefined) {
        normalized.privateTranscriptionNoRepeatNgramSize =
            normalizePrivateTranscriptionNoRepeatNgramSize(
                body.privateTranscriptionNoRepeatNgramSize,
            );
    }

    return normalized;
}

function buildVoScriptProcessingInput(body: Record<string, unknown>) {
    const normalized: NormalizedVoScriptProviderInput = {};

    if (body.privateTranscriptionDenoiseModel !== undefined) {
        normalized.privateTranscriptionDenoiseModel =
            normalizeVoScriptDenoiseModel(
                body.privateTranscriptionDenoiseModel,
            );
    }

    return {
        ...normalized,
        ...buildVoScriptRuntimeInput(body),
    };
}

function buildVoScriptProviderInput(
    body: Record<string, unknown>,
    existing: ExistingVoScriptSettings,
) {
    return {
        ...buildVoScriptConnectionInput(body),
        ...buildVoScriptSpeakerInput(body, existing),
        ...buildVoScriptProcessingInput(body),
    };
}

export function buildVoScriptSettingsBodyUpdates(
    body: Record<string, unknown>,
    existing: ExistingVoScriptSettings,
) {
    return buildVoScriptProviderUpdates(
        buildVoScriptProviderInput(body, existing),
    );
}
