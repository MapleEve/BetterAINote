import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { sourceConnections, syncWorkerState } from "@/db/schema/core";
import {
    isSourceProvider,
    sourceConnectionSupportsWorkerSync,
} from "@/lib/data-sources";
import { env } from "@/lib/env";

async function main() {
    const enabledConnections = await db
        .select({
            provider: sourceConnections.provider,
            authMode: sourceConnections.authMode,
        })
        .from(sourceConnections)
        .where(eq(sourceConnections.enabled, true));

    const hasWorkerSyncSource = enabledConnections.some((connection) => {
        const provider = connection.provider;
        return (
            isSourceProvider(provider) &&
            sourceConnectionSupportsWorkerSync({
                provider,
                authMode: connection.authMode,
            })
        );
    });

    if (!hasWorkerSyncSource) {
        process.exit(0);
    }

    const [state] = await db
        .select({
            lastHeartbeatAt: syncWorkerState.lastHeartbeatAt,
        })
        .from(syncWorkerState)
        .orderBy(desc(syncWorkerState.lastHeartbeatAt))
        .limit(1);

    if (!state?.lastHeartbeatAt) {
        process.exit(1);
    }

    const maxAgeMs = Math.max(env.SYNC_WORKER_TICK_MS * 2, 60000);
    const ageMs = Date.now() - state.lastHeartbeatAt.getTime();
    process.exit(ageMs <= maxAgeMs ? 0 : 1);
}

main().catch((error) => {
    console.error("[worker] healthcheck failed:", error);
    process.exit(1);
});
