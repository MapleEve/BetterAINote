import { env } from "../env";
import { LocalStorage } from "./local-storage";
import type { StorageProvider } from "./types";

/**
 * Create storage provider based on local filesystem configuration.
 * BetterAINote currently supports mounted local storage.
 */
export function createStorageProvider(): StorageProvider {
    void env.LOCAL_STORAGE_PATH;
    return new LocalStorage();
}

/**
 * Create storage provider for a user
 * Uses the instance-level storage configuration from environment
 */
export async function createUserStorageProvider(
    _userId: string,
): Promise<StorageProvider> {
    return createStorageProvider();
}

export { LocalStorage } from "./local-storage";
// Export everything
export * from "./types";
