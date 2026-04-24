import { syncWorker } from "@/lib/sync/worker";

async function main() {
    console.info("[worker] starting BetterAINote sync worker");
    syncWorker.start();

    const shutdown = (signal: NodeJS.Signals) => {
        console.info(`[worker] received ${signal}, shutting down`);
        syncWorker.stop();
        process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

    await new Promise(() => {});
}

main().catch((error) => {
    console.error("[worker] fatal error:", error);
    process.exit(1);
});
