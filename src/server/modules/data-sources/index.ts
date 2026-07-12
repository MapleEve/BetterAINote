import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { sourceConnections } from "@/db/schema/core";
import { isSourceProvider } from "@/lib/data-sources/catalog";
import {
    type DataSourcesRequestBody,
    SourceProviderSettingsError,
} from "@/lib/data-sources/types";
import { persistSourceDevicesForUser } from "./devices";
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
        await persistSourceDevicesForUser({
            userId,
            provider: body.provider,
            devices: next.sourceDevices,
        });
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
    await persistSourceDevicesForUser({
        userId,
        provider: body.provider,
        devices: next.sourceDevices,
    });
}

export async function disconnectDataSourceForUser(
    userId: string,
    body: Pick<DataSourcesRequestBody, "provider">,
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

    if (!existing) {
        return;
    }

    await db
        .update(sourceConnections)
        .set({
            enabled: false,
            secretConfig: null,
            syncStatus: "idle",
            lastSyncError: null,
            lastSyncStartedAt: null,
            lastSyncFinishedAt: null,
            updatedAt: new Date(),
        })
        .where(eq(sourceConnections.id, existing.id));
}

export async function reconnectDataSourceForUser(
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
        body: {
            ...body,
            enabled: true,
        },
        forceValidate: true,
    });
    const now = new Date();
    const resetSyncState = {
        syncStatus: "idle" as const,
        lastSyncError: null,
        lastSyncStartedAt: null,
        lastSyncFinishedAt: null,
    };

    if (existing) {
        await db
            .update(sourceConnections)
            .set({
                enabled: true,
                authMode: next.authMode,
                baseUrl: next.baseUrl,
                config: next.config,
                secretConfig: next.secretConfig,
                ...resetSyncState,
                updatedAt: now,
            })
            .where(eq(sourceConnections.id, existing.id));
        await persistSourceDevicesForUser({
            userId,
            provider: body.provider,
            devices: next.sourceDevices,
        });
        return;
    }

    await db.insert(sourceConnections).values({
        userId,
        provider: body.provider,
        enabled: true,
        authMode: next.authMode,
        baseUrl: next.baseUrl,
        config: next.config,
        secretConfig: next.secretConfig,
        ...resetSyncState,
        createdAt: now,
        updatedAt: now,
    });
    await persistSourceDevicesForUser({
        userId,
        provider: body.provider,
        devices: next.sourceDevices,
    });
}

export async function testDataSourceForUser(
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

    await prepareSourceConnectionWrite({
        userId,
        provider: body.provider,
        existing: existing ?? null,
        body: {
            ...body,
            enabled: true,
        },
        forceValidate: true,
    });
}
