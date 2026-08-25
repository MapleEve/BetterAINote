import type { Client } from "@libsql/client";

const CORE_DATABASE_BUSY_TIMEOUT_MS = 2_000;

let coreClient: Client | null = null;
let coreDatabaseReady: Promise<void> | null = null;

export function configureCoreDatabaseReadiness(client: Client | null) {
    coreClient = client;
    coreDatabaseReady = null;
}

function createCoreDatabaseReadyPromise() {
    const client = coreClient;
    const attempt =
        client?.protocol === "file"
            ? client
                  .execute(
                      `PRAGMA busy_timeout = ${CORE_DATABASE_BUSY_TIMEOUT_MS}`,
                  )
                  .then(() =>
                      client.execute("SELECT name FROM sqlite_master LIMIT 1"),
                  )
                  .then(() => undefined)
            : Promise.resolve();

    let ready: Promise<void>;
    ready = attempt.then(
        () => {
            // A readiness probe only describes the instant it completed. Keep
            // concurrent callers on one probe, but require the next request
            // to observe a newly acquired SQLite lock.
            if (coreDatabaseReady === ready) {
                coreDatabaseReady = null;
            }
        },
        (error: unknown) => {
            // Clear only this failed attempt. A later caller may already have
            // started a replacement attempt after observing the same rejection.
            if (coreDatabaseReady === ready) {
                coreDatabaseReady = null;
            }
            throw error;
        },
    );

    return ready;
}

export function waitForCoreDatabaseReady() {
    if (!coreDatabaseReady) {
        coreDatabaseReady = createCoreDatabaseReadyPromise();
    }

    return coreDatabaseReady;
}
