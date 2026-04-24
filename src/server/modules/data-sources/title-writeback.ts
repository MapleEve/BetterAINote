import {
    isSourceProvider,
    type SourceProvider,
    sourceProviderSupportsCapability,
} from "@/lib/data-sources/catalog";
import { getResolvedSourceConnectionForUser } from "@/lib/data-sources/connections";
import {
    getSourceProviderDefinition,
    getSourceProvidersWithTitleWriteback,
} from "@/lib/data-sources/providers";
import type { SourceLinkedRecording } from "@/lib/data-sources/types";

export class SourceTitleWritebackError extends Error {
    status: number;

    constructor(message: string, status = 409) {
        super(message);
        this.name = "SourceTitleWritebackError";
        this.status = status;
    }
}

function getSourceTitleWritebackDriver(provider: string | null | undefined) {
    if (!isSourceProvider(provider)) {
        return null;
    }

    if (!sourceProviderSupportsCapability(provider, "upstreamTitleWriteback")) {
        return null;
    }

    return getSourceProviderDefinition(provider).titleWriteback ?? null;
}

export function getSourceTitleWritebackRuntimeProviders() {
    return getSourceProvidersWithTitleWriteback();
}

function isSourceTitleWritebackEnabled(params: {
    provider: SourceProvider;
    connectionConfig: Record<string, unknown> | null | undefined;
}) {
    if (
        !sourceProviderSupportsCapability(
            params.provider,
            "upstreamTitleWriteback",
        )
    ) {
        return false;
    }

    return params.connectionConfig?.syncTitleToSource === true;
}

export async function writeRecordingTitleToSourceOrThrow(params: {
    userId: string;
    recording: SourceLinkedRecording;
    title: string;
}) {
    const driver = getSourceTitleWritebackDriver(
        params.recording.sourceProvider,
    );
    if (!driver) {
        return false;
    }

    const connection = await getResolvedSourceConnectionForUser(
        params.userId,
        params.recording.sourceProvider as SourceProvider,
    );

    if (
        !connection ||
        !isSourceTitleWritebackEnabled({
            provider: connection.provider,
            connectionConfig: connection.config,
        })
    ) {
        return false;
    }

    const target = driver.resolveTarget(params.recording);
    if (!target) {
        throw new SourceTitleWritebackError(
            "This recording is not linked to an upstream source entry that can accept title write-back",
        );
    }

    try {
        await driver.writeTitle({
            connection,
            target,
            title: params.title,
        });
    } catch (error) {
        if (error instanceof SourceTitleWritebackError) {
            throw error;
        }

        console.error("Failed to write recording title back to source:", error);
        throw new SourceTitleWritebackError(
            "Failed to write the title back to the upstream source",
            502,
        );
    }

    return true;
}

export async function writeRecordingTitleToSource(params: {
    userId: string;
    recording: SourceLinkedRecording;
    title: string;
}) {
    try {
        return await writeRecordingTitleToSourceOrThrow(params);
    } catch {
        return false;
    }
}
