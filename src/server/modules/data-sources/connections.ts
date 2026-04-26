import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { sourceConnections } from "@/db/schema/core";
import {
    DATA_SOURCE_CATALOG,
    type SourceAuthMode,
    type SourceProvider,
} from "@/lib/data-sources/catalog";
import { getSourceProviderDefinition } from "@/lib/data-sources/providers";
import { normalizeDingTalkAuthMode } from "@/lib/data-sources/providers/dingtalk-a1/constants";
import type { ResolvedSourceConnection } from "@/lib/data-sources/types";
import { decrypt } from "@/lib/encryption";

type SourceConfigRecord = Record<string, unknown>;

export function parseSourceSecretConfig(
    value: string | null,
): Record<string, string> {
    if (!value) {
        return {};
    }

    try {
        const parsed = JSON.parse(decrypt(value)) as Record<string, unknown>;
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            return {};
        }

        return Object.fromEntries(
            Object.entries(parsed).filter(
                (entry): entry is [string, string] =>
                    typeof entry[0] === "string" &&
                    typeof entry[1] === "string" &&
                    entry[1].trim().length > 0,
            ),
        );
    } catch {
        return {};
    }
}

export function resolveSourceConnectionConfig(
    provider: SourceProvider,
    baseUrl: string | null | undefined,
    config: SourceConfigRecord | null | undefined,
): SourceConfigRecord {
    const definition = getSourceProviderDefinition(provider);

    if (definition.resolveConnectionConfig) {
        return definition.resolveConnectionConfig({
            baseUrl,
            config,
        });
    }

    return config ?? {};
}

function resolveSourceAuthMode(
    provider: SourceProvider,
    authMode: string | null,
): SourceAuthMode {
    const normalizedAuthMode =
        provider === "dingtalk-a1"
            ? normalizeDingTalkAuthMode(authMode)
            : authMode;
    const supported = DATA_SOURCE_CATALOG[provider].authModes;
    if (
        typeof normalizedAuthMode === "string" &&
        supported.includes(normalizedAuthMode as SourceAuthMode)
    ) {
        return normalizedAuthMode as SourceAuthMode;
    }

    return supported[0];
}

export async function getResolvedSourceConnectionForUser(
    userId: string,
    provider: SourceProvider,
): Promise<ResolvedSourceConnection | null> {
    const [sourceConnection] = await db
        .select()
        .from(sourceConnections)
        .where(
            and(
                eq(sourceConnections.userId, userId),
                eq(sourceConnections.provider, provider),
            ),
        )
        .limit(1);

    if (!sourceConnection) {
        return null;
    }

    return {
        userId,
        provider,
        enabled: sourceConnection.enabled,
        authMode: resolveSourceAuthMode(provider, sourceConnection.authMode),
        baseUrl:
            sourceConnection.baseUrl ??
            DATA_SOURCE_CATALOG[provider].defaultBaseUrl,
        config: resolveSourceConnectionConfig(
            provider,
            sourceConnection.baseUrl ??
                DATA_SOURCE_CATALOG[provider].defaultBaseUrl,
            (sourceConnection.config as Record<string, unknown> | null) ?? {},
        ),
        secrets: parseSourceSecretConfig(sourceConnection.secretConfig),
        lastSync: sourceConnection.lastSync,
    };
}

export async function getEnabledSourceConnectionsForUser(userId: string) {
    const connections = await Promise.all(
        (Object.keys(DATA_SOURCE_CATALOG) as SourceProvider[]).map((provider) =>
            getResolvedSourceConnectionForUser(userId, provider),
        ),
    );

    return connections.filter(
        (connection): connection is ResolvedSourceConnection =>
            Boolean(connection?.enabled),
    );
}
