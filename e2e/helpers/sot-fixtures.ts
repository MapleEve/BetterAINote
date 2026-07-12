import path from "node:path";
import { pathToFileURL } from "node:url";

export const SOT_FIXTURE_PROJECT_ROOT = path.resolve(
    process.cwd(),
    "e2e/fixtures/sot-web/handoff-20260531/project",
);

export const SOT_FIXTURE_WEB_ROOT = path.join(
    SOT_FIXTURE_PROJECT_ROOT,
    "ui_kits/web",
);

export const SOT_FIXTURE_PREVIEW_ROOT = path.join(
    SOT_FIXTURE_PROJECT_ROOT,
    "preview",
);

export const SOT_FIXTURE_ASSET_ROOT = path.join(
    SOT_FIXTURE_PROJECT_ROOT,
    "assets",
);

export const SOT_SOURCE_ASSET_DIR = path.join(
    SOT_FIXTURE_ASSET_ROOT,
    "sources",
);

export function sotFixtureFileUrl(...segments: string[]) {
    return pathToFileURL(path.join(SOT_FIXTURE_PROJECT_ROOT, ...segments)).href;
}

export const SOT_COMPONENT_LIBRARY_URL = sotFixtureFileUrl(
    "ui_kits",
    "web",
    "component-library.html",
);

export const SOT_WORKSTATION_URL = sotFixtureFileUrl(
    "ui_kits",
    "web",
    "index.html",
);

export const SOT_SYSTEM_REFERENCE_URL = sotFixtureFileUrl(
    "preview",
    "19-system-reference.html",
);
