// Docker/runtime compatibility entrypoint only.
// Keep this wrapper because the container build and entrypoint execute a single
// compiled file, but the actual migration logic lives in `src/db/migrate.ts`.
// New migration changes should go to `migrate.ts`, not here.
import "./migrate";
