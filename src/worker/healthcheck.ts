import { count, desc } from "drizzle-orm";
import { db } from "@/db";
import { sourceConnections, syncWorkerState } from "@/db/schema/core";
import { env } from "@/lib/env";

async function main() {
    const [connectionCountRow] = await db
        .select({ count: count() })
        .from(sourceConnections);

    const connectionCount = connectionCountRow?.count ?? 0;
    if (connectionCount === 0) {
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
