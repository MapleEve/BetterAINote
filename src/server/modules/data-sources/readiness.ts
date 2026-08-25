import "@/db";
import { waitForCoreDatabaseReady } from "@/db/core-ready";

export function waitForDataSourcesCoreReady() {
    return waitForCoreDatabaseReady();
}
