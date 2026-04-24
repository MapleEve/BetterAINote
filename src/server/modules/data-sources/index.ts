import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { sourceConnections } from "@/db/schema/core";
import { isSourceProvider } from "@/lib/data-sources/catalog";
import {
    type DataSourcesRequestBody,
    SourceProviderSettingsError,
} from "@/lib/data-sources/types";
import { serializeDataSources } from "./serialize";
import { prepareSourceConnectionWrite } from "./settings";

export {
    getEnabledSourceConnectionsForUser,
    getResolvedSourceConnectionForUser,
    parseSourceSecretConfig,
    resolveSourceConnectionConfig,
} from "./connections";
export type { SerializedSourceState } from "./serialize";
export { buildDataSourcesRouteErrorResponse } from "./serialize";
export {
    DEFAULT_SOURCE_STATE,
    getDataSourceSettingsErrorStatus,
    getSourceConnectionDefaults,
    getSourceDefaultBaseUrl,
    hasConfiguredSourceSecrets,
    prepareSourceConnectionWrite,
} from "./settings";
export {
    getDataSourceSyncStatusForUser,
    runManualDataSourceSyncForUser,
} from "./sync";
export {
    getSourceTitleWritebackRuntimeProviders,
    SourceTitleWritebackError,
    writeRecordingTitleToSource,
    writeRecordingTitleToSourceOrThrow,
} from "./title-writeback";

export async function getDataSourcesStateForUser(userId: string) {
    const rows = await db
        .select()
        .from(sourceConnections)
        .where(eq(sourceConnections.userId, userId));

    return serializeDataSources(rows);
}

export async function saveDataSourceForUser(
    userId: string,
    body: DataSourcesRequestBody,
) {
    if (!isSourceProvider(body.provider)) {
        throw new SourceProviderSettingsError(
            "provider must be one of the supported data sources",
            { status: 400 },
        );
    }

    const [existing] = await db
        .select()
        .from(sourceConnections)
        .where(
            and(
                eq(sourceConnections.userId, userId),
                eq(sourceConnections.provider, body.provider),
            ),
        )
        .limit(1);

    const next = await prepareSourceConnectionWrite({
        userId,
        provider: body.provider,
        existing: existing ?? null,
        body,
    });
    const now = new Date();

    if (existing) {
        await db
            .update(sourceConnections)
            .set({
                enabled: next.enabled,
                authMode: next.authMode,
                baseUrl: next.baseUrl,
                config: next.config,
                secretConfig: next.secretConfig,
                updatedAt: now,
            })
            .where(eq(sourceConnections.id, existing.id));
        return;
    }

    await db.insert(sourceConnections).values({
        userId,
        provider: body.provider,
        enabled: next.enabled,
        authMode: next.authMode,
        baseUrl: next.baseUrl,
        config: next.config,
        secretConfig: next.secretConfig,
        createdAt: now,
        updatedAt: now,
    });
}
