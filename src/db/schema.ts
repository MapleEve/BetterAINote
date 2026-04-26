/**
 * Compatibility/tooling barrel only.
 *
 * Source-of-truth schema definitions live in `src/db/schema/*`.
 *
 * This file still exists for two reasons only:
 * 1. `drizzle.config.ts` points here so tooling can load one aggregate entry.
 * 2. Short-term compatibility for any non-runtime callers that still expect
 *    `@/db/schema` to re-export every shard.
 *
 * Runtime boundary:
 * - Live app/runtime code must import from shard files such as
 *   `@/db/schema/core` or `@/db/schema/library`.
 * - `src/db/index.ts` imports shard files directly and no longer depends on
 *   this barrel for table routing or runtime schema truth.
 *
 * Do not add new table definitions or runtime logic here. New schema work
 * belongs in the shard files under `src/db/schema/*`.
 */
import * as commonSchemaExports from "./schema/common";
import * as coreSchemaExports from "./schema/core";
import * as librarySchemaExports from "./schema/library";
import * as searchSchemaExports from "./schema/search";
import * as transcriptsSchemaExports from "./schema/transcripts";
import * as voiceprintsSchemaExports from "./schema/voiceprints";

// Tooling-facing view of the shard export surfaces.
export const compatSchemaModules = {
    common: commonSchemaExports,
    core: coreSchemaExports,
    library: librarySchemaExports,
    search: searchSchemaExports,
    transcripts: transcriptsSchemaExports,
    voiceprints: voiceprintsSchemaExports,
} as const;

export * from "./schema/common";
export * from "./schema/core";
export * from "./schema/library";
export * from "./schema/search";
export * from "./schema/transcripts";
export * from "./schema/voiceprints";
