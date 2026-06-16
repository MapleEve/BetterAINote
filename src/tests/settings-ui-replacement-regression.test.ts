import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSource(relativePath: string) {
    return readFileSync(path.join(ROOT, relativePath), "utf8");
}

function readCssBlock(source: string, marker: string) {
    const markerIndex = source.indexOf(marker);
    expect(markerIndex).toBeGreaterThanOrEqual(0);

    const openBraceIndex = source.indexOf("{", markerIndex);
    expect(openBraceIndex).toBeGreaterThanOrEqual(0);

    let depth = 0;
    for (let index = openBraceIndex; index < source.length; index += 1) {
        const character = source[index];

        if (character === "{") {
            depth += 1;
        }

        if (character === "}") {
            depth -= 1;
        }

        if (depth === 0) {
            return source.slice(openBraceIndex + 1, index);
        }
    }

    throw new Error(`Missing closing brace for ${marker}`);
}

function readCssBlocks(source: string, marker: string) {
    const blocks: string[] = [];
    let searchIndex = 0;

    while (searchIndex < source.length) {
        const markerIndex = source.indexOf(marker, searchIndex);

        if (markerIndex < 0) {
            break;
        }

        const openBraceIndex = source.indexOf("{", markerIndex);
        expect(openBraceIndex).toBeGreaterThanOrEqual(0);

        let depth = 0;
        for (let index = openBraceIndex; index < source.length; index += 1) {
            const character = source[index];

            if (character === "{") {
                depth += 1;
            }

            if (character === "}") {
                depth -= 1;
            }

            if (depth === 0) {
                blocks.push(source.slice(openBraceIndex + 1, index));
                searchIndex = index + 1;
                break;
            }
        }
    }

    expect(blocks.length).toBeGreaterThan(0);
    return blocks;
}

const OLD_UI_RE =
    /uikit-|glass-surface|glass-control|CardContent|from "@\/components\/ui\/card"|bg-muted/;

describe("settings SOT interaction regressions", () => {
    it("keeps the settings dialog as a fixed SOT shell with local scrolling and busy guards", () => {
        const dialog = readSource(
            "features/settings/components/settings-dialog.tsx",
        );
        const i18n = readSource("lib/i18n.ts");
        const baseDialog = readSource("components/ui/dialog.tsx");
        const globals = readSource("app/globals.css");
        const headerDisplaySetup = dialog.match(
            /const settingsUserName[\s\S]*?const isSettingsBusy/,
        )?.[0];

        expect(dialog).toContain('data-sot-surface="settings-shell"');
        expect(dialog).toContain("data-sot-busy=");
        expect(dialog).toContain("data-sot-section={activeSection}");
        expect(dialog).toContain("data-sot-state=");
        expect(dialog).toContain('className="settings-head"');
        expect(dialog).toContain('className="settings-body"');
        expect(dialog).toContain('className="settings-rail"');
        expect(dialog).toContain("<aside");
        expect(dialog).toContain('data-sot-control="settings-nav"');
        expect(dialog).toContain('data-sot-control="settings-close"');
        expect(dialog).toContain('data-sot-part="settings-user-summary"');
        expect(dialog).not.toContain(
            'data-sot-control="settings-section-selector"',
        );
        expect(dialog).not.toContain("settings-section-select");
        expect(dialog).not.toContain("@/components/ui/select");
        expect(dialog).toContain("SettingsBusyProvider");
        expect(dialog).toContain("isSettingsBusy");
        expect(dialog).toContain("returnFocusRef");
        expect(dialog).toContain("focus({ preventScroll: true })");
        expect(dialog).toContain("onInteractOutside");
        expect(dialog).toContain("normalizeSettingsSection");
        expect(dialog).toContain('documentElement.style.overflow = "hidden"');
        expect(dialog).toContain('body.style.overflow = "hidden"');
        expect(dialog).toContain('aria-label={t("settingsDialog.title")}');
        expect(dialog).not.toContain("DialogTitle hidden");
        expect(dialog).not.toContain("DialogDescription hidden");
        expect(dialog).not.toContain("legacySectionAliases");
        expect(dialog).not.toContain('display: "appearance"');
        expect(dialog).not.toContain('sync: "misc"');
        expect(dialog).not.toContain('playback: "misc"');
        expect(dialog).toContain("aria-busy={isSettingsBusy}");
        expect(dialog).toContain("aria-current={");
        expect(dialog).toContain('aria-label={t("settingsDialog.close")}');
        expect(headerDisplaySetup).toContain(
            't("settingsDialog.localDeployment")',
        );
        expect(headerDisplaySetup).toContain(
            't("settingsDialog.singleUserSelfHosted")',
        );
        expect(headerDisplaySetup).not.toContain("props.user");
        expect(dialog).not.toContain("user?.email?.trim()");
        expect(dialog).not.toContain("user?.name?.trim()");
        expect(i18n).toContain('localDeployment: "本地部署"');
        expect(i18n).toContain(
            'singleUserSelfHosted: "单租户 · self-hosted · 无登录账号"',
        );
        expect(dialog).not.toContain('aria-label="Close"');
        expect(dialog).not.toContain("SidebarProvider");
        expect(dialog).not.toContain("<Sidebar");
        expect(dialog).not.toContain("<Breadcrumb");
        expect(dialog).not.toContain("SelectTrigger");
        expect(dialog).not.toContain("SelectContent");
        expect(dialog).not.toContain("SelectItem");
        expect(dialog).not.toMatch(OLD_UI_RE);

        expect(baseDialog).toContain("DialogContext");
        expect(baseDialog).toContain('className="scrim"');
        expect(baseDialog).toContain('data-open="true"');
        expect(baseDialog).toContain('role="dialog"');
        expect(baseDialog).toContain('aria-modal="true"');
        expect(baseDialog).not.toContain("DialogPrimitive");
        expect(globals).toContain("--z-modal");
        expect(globals).toContain("--ease-sine");
        expect(globals).toContain("--z-modal");
        expect(globals).toContain("z-index: var(--z-modal)");
        expect(globals).not.toContain(".ui-select-content");
        expect(globals).not.toContain("z-index: 650");
    });

    it("uses the SOT monitor glyph for the local deployment header badge", () => {
        const dialog = readSource(
            "features/settings/components/settings-dialog.tsx",
        );
        const localBadge = dialog.match(
            /<span\s+className="local-badge"[\s\S]*?<\/span>/,
        )?.[0];

        expect(dialog).toContain("Monitor");
        expect(dialog).not.toContain("function getSettingsUserInitial");
        expect(dialog).not.toContain("settingsUserInitial");
        expect(localBadge).toContain('aria-hidden="true"');
        expect(localBadge).toContain('data-sot-part="settings-user-avatar"');
        expect(localBadge).toContain("<Monitor");
        expect(localBadge).not.toContain("{settingsUserName}");
        expect(localBadge).not.toContain("getSettingsUserInitial");
        expect(localBadge).not.toContain("settingsUserInitial");
        expect(dialog).not.toContain("playwright-admin@example.com");
        expect(dialog).not.toContain("Playwright Admin");
        expect(dialog).not.toContain("test@example.com");
        expect(dialog).not.toContain("Test User");
    });

    it("keeps the SOT settings rail visible on mobile without a section selector", () => {
        const dialog = readSource(
            "features/settings/components/settings-dialog.tsx",
        );
        const globals = readSource("app/globals.css");
        const baseBodyCss = readCssBlock(
            globals,
            ".settings-body {\n    display: grid;",
        );
        const baseRailCss = readCssBlock(globals, ".settings-rail");
        const mobileSettingsCss = readCssBlock(
            globals,
            "@media (max-width: 720px)",
        );
        const baseUserCss = readCssBlock(globals, ".settings-user");
        const baseUserTextCss = readCssBlock(globals, ".settings-user > div");
        const mobileHeaderCss = readCssBlock(
            mobileSettingsCss,
            ".settings-head",
        );
        const mobileTextCss = readCssBlock(
            mobileSettingsCss,
            ".su-name,\n    .su-mail",
        );

        expect(dialog).not.toContain(
            'wrapperClassName="settings-section-select"',
        );
        expect(dialog).not.toContain(
            'data-sot-control="settings-section-selector"',
        );
        expect(globals).not.toContain(".settings-section-select");
        expect(dialog).toContain('data-sot-part="settings-user-summary"');
        expect(dialog).toContain("<Monitor");
        expect(dialog).toContain("{settingsUserSubtitle}");

        expect(baseBodyCss).toContain("grid-template-columns: 200px 1fr;");
        expect(baseRailCss).toContain("display: flex;");
        expect(mobileHeaderCss).toContain("flex-wrap: wrap;");
        expect(mobileHeaderCss).toContain("align-items: flex-start;");
        expect(baseUserCss).toContain("min-width: 0;");
        expect(baseUserTextCss).toContain("min-width: 0;");
        expect(mobileTextCss).toContain("overflow: hidden;");
        expect(mobileTextCss).toContain("text-overflow: ellipsis;");
        expect(mobileTextCss).toContain("white-space: nowrap;");

        expect(mobileSettingsCss).not.toContain(".settings-section-select");
        expect(mobileSettingsCss).not.toMatch(
            /\.settings-body\s*{[\s\S]*?grid-template-columns:\s*1fr;[\s\S]*?}/,
        );
        expect(mobileSettingsCss).not.toMatch(
            /\.settings-rail\s*{[\s\S]*?display:\s*none;[\s\S]*?}/,
        );
    });

    it("keeps the data-source three-pane shell from stacking on mobile", () => {
        const globals = readSource("app/globals.css");
        const mobileBlocks = readCssBlocks(
            globals,
            "@media (max-width: 720px)",
        );

        for (const mobileBlock of mobileBlocks) {
            expect(mobileBlock).not.toMatch(
                /\.settings-main\.three-pane\s*{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/,
            );
            expect(mobileBlock).not.toMatch(
                /\.settings-main\.three-pane\s*{[^}]*grid-template-rows:\s*auto\s+minmax\(0,\s*1fr\)/,
            );
        }
    });

    it("keeps data-source settings wired to provider rows, detail states, save, and no-persist test", () => {
        const content = readSource(
            "features/settings/components/settings-content.tsx",
        );
        const settingFieldControl = readSource(
            "features/settings/components/setting-field-control.tsx",
        );
        const inputPrimitive = readSource("components/ui/input.tsx");
        const hook = readSource(
            "features/data-sources/use-data-sources-settings.ts",
        );
        const service = readSource("services/data-sources.ts");
        const providerTypes = readSource("lib/data-sources/types.ts");

        for (const provider of [
            "dingtalk-a1",
            "ticnote",
            "plaud",
            "feishu-minutes",
            "iflyrec",
        ]) {
            expect(providerTypes).toContain(provider);
            expect(content).toContain(provider);
        }

        expect(content).toContain("function DataSourcesSettingsPanel");
        expect(content).toContain("data-sot-load-state");
        expect(content).toContain('data-sot-surface="settings-data-sources"');
        const providersTitle = content.match(
            /<div className="sm-providers-title">[\s\S]*?<\/div>/,
        )?.[0];
        expect(providersTitle).toContain('{isZh ? "来源" : "Data Sources"}');
        expect(providersTitle).not.toContain('"数据源"');
        expect(content).toContain('data-sot-control="settings-save"');
        expect(content).toContain("data-sot-panel");
        expect(content).toContain("data-sot-provider=");
        expect(content).toContain("data-sot-state");
        expect(content).toContain("data-sot-panel");
        expect(content).toContain("data-sot-status");
        expect(content).toContain("data-sot-action-state");
        expect(content).toContain("data-sot-interaction-disabled");
        expect(content).toContain("ProviderActionMessage");
        expect(content).toContain('"testing"');
        expect(content).toContain('"test-success"');
        expect(content).toContain('"save-error"');
        expect(content).toContain("source.syncStatus");
        expect(content).toContain("source.lastSyncError");
        expect(content).toContain('"syncing"');
        expect(content).toContain('"同步中"');
        expect(content).toContain('"同步失败"');
        expect(content).toContain("来源更新失败，请检查登录信息后重试。");
        expect(content).toContain("connectionStatus");
        expect(content).toContain('"expired"');
        expect(content).toContain("useSettingsSectionBusy");
        expect(content).toContain("isDataSourcesBusy");
        expect(content).toContain('data-sot-list="source-auth-modes"');
        expect(content).toContain("data-sot-auth-mode={mode}");
        expect(content).toContain("authMode: mode");
        expect(content).toContain("SETTINGS_DATA_SOURCE_PROVIDER_STORAGE_KEY");
        expect(content).toContain('data-sot-part="source-provider-mark"');
        expect(content).toContain("getSourceProviderSettingsLabel");
        expect(content).toContain("handleTestSource");
        expect(content).toContain("testSourceSettings(source)");
        expect(content).toContain("handleSaveSource");
        expect(content).toContain("handleReconnectSource");
        expect(content).toContain("handleDisconnectSource");
        expect(content).toContain("reconnectSourceSettings(");
        expect(content).toContain("disconnectSourceSettings(");
        expect(content).toContain("DataSourceFieldControl");
        expect(content).toContain("updateField(");
        expect(content).toContain("secretDrafts");
        expect(content).toContain("Switch");
        expect(content).toContain("onCheckedChange");
        expect(content).toContain("enabled: checked");
        expect(content).toContain('className="sd-head"');
        expect(content).toContain('className="sd-title"');
        expect(content).toContain('className="sd-sub"');
        expect(content).toContain("sd-pill");
        expect(content).toContain("DataSourceFieldControl");
        expect(content).toContain('className="sm-section"');
        expect(content).toContain('className="sm-row"');
        expect(content).toContain('className="sm-row-ctrl"');
        expect(settingFieldControl).toContain("readOnly?: boolean");
        expect(settingFieldControl).toContain("readOnly={field.readOnly}");
        expect(settingFieldControl).toContain("field-row");
        expect(inputPrimitive).toContain("field-input");
        expect(content).toContain("sm-actions-state");
        expect(content).toContain('data-sot-control="source-test"');
        expect(content).toContain('data-sot-control="source-save"');
        expect(content).toContain('data-sot-control="source-reconnect"');
        expect(content).toContain('data-sot-control="source-disconnect"');
        expect(content).toContain('"重新连接"');
        expect(content).toContain('"断开连接"');
        expect(content).toContain('data-sot-panel="source-state-banner"');
        expect(content).toContain("getSourceProviderStatusHint");
        expect(content).toContain("getSourceProviderDetailSubtitle");
        expect(content).toContain("shouldShowProviderStateBanner");
        expect(content).not.toContain('className="sm-detail-head"');
        expect(content).not.toContain("className={`sm-detail-icon");
        expect(content).not.toContain('className="sm-detail-title"');
        expect(content).not.toContain('className="sm-detail-sub"');
        expect(content).not.toContain('className="modal-foot"');
        expect(content).not.toContain('className="sm-actions-spacer"');
        expect(content).not.toMatch(OLD_UI_RE);

        expect(service).toContain("DATA_SOURCES_TEST_API_PATH");
        expect(service).toContain('"/api/data-sources/test"');
        expect(service).toContain("DATA_SOURCES_DISCONNECT_API_PATH");
        expect(service).toContain('"/api/data-sources/disconnect"');
        expect(service).toContain("DATA_SOURCES_RECONNECT_API_PATH");
        expect(service).toContain('"/api/data-sources/reconnect"');
        expect(service).toContain('method: "POST"');
        expect(service).toContain(
            "export async function disconnectDataSource(",
        );
        expect(service).toContain("export async function reconnectDataSource(");
        expect(service).toMatch(
            /export async function disconnectDataSource\([\s\S]*?DATA_SOURCES_DISCONNECT_API_PATH[\s\S]*?method:\s*"POST"/,
        );
        expect(service).toMatch(
            /export async function reconnectDataSource\([\s\S]*?DATA_SOURCES_RECONNECT_API_PATH[\s\S]*?method:\s*"POST"/,
        );
        expect(hook).toContain("testDataSource(");
        expect(hook).toContain("testSourceSettings");
        expect(hook).toContain("saveSourceSettings");
        expect(hook).toContain("disconnectDataSource(");
        expect(hook).toContain("reconnectDataSource(");
        expect(hook).toContain("disconnectSourceSettings");
        expect(hook).toContain("reconnectSourceSettings");
        expect(hook).toMatch(
            /reconnectSourceSettings[\s\S]*?buildDataSourceSavePayload\(\s*\{\s*\.\.\.source,\s*enabled:\s*true,\s*\},\s*secretDrafts,\s*language,\s*\)/,
        );
        expect(hook).toMatch(
            /reconnectSourceSettings[\s\S]*?setSecretDrafts\([\s\S]*?\[source\.provider\]:\s*\{\}/,
        );
        expect(hook).toMatch(
            /reconnectSourceSettings[\s\S]*?await refreshSources\(\)/,
        );
        expect(hook).toMatch(/reconnectSourceSettings[\s\S]*?toast\.success/);
        expect(hook).toMatch(
            /disconnectSourceSettings[\s\S]*?await refreshSources\(\)/,
        );
        expect(hook).toMatch(/disconnectSourceSettings[\s\S]*?toast\.success/);
        expect(hook).not.toContain("@/server");
        expect(hook).not.toContain("@/db");
    });

    it("keeps data-source load retry on a stable SOT control hook", () => {
        const content = readSource(
            "features/settings/components/settings-content.tsx",
        );
        const sourceLoadError = content.match(
            /data-sot-panel="source-load-error"[\s\S]*?<\/Alert>/,
        )?.[0];
        const retryButton = sourceLoadError?.match(
            /<Button[\s\S]*?<\/Button>/,
        )?.[0];

        expect(sourceLoadError).toContain('data-sot-panel="source-load-error"');
        expect(retryButton).toContain('data-sot-control="source-load-retry"');
        expect(retryButton).toContain("onClick={() => void refreshSources()}");
    });

    it("keeps provider enable sync switch on stable SOT hooks and state contracts", () => {
        const content = readSource(
            "features/settings/components/settings-content.tsx",
        );
        const enableSwitch = content.match(
            /<Switch\s+id=\{`\$\{selectedSource\.provider\}-enabled`\}[\s\S]*?\/>/,
        )?.[0];

        expect(enableSwitch).toContain("data-ds-enable");
        expect(enableSwitch).toContain('data-sot-control="source-enable-sync"');
        expect(enableSwitch).toMatch(
            /data-sot-state=\{\s*selectedSource\.enabled\s*\?\s*"checked"\s*:\s*"unchecked"\s*\}/,
        );
        expect(enableSwitch).toMatch(
            /data-sot-enabled=\{\s*selectedSource\.enabled\s*\?\s*"true"\s*:\s*"false"\s*\}/,
        );
        expect(enableSwitch).toMatch(
            /data-sot-disabled=\{\s*interactionDisabled\s*\?\s*"true"\s*:\s*"false"\s*\}/,
        );
        expect(enableSwitch).toContain("checked={selectedSource.enabled}");
        expect(enableSwitch).toContain("disabled={interactionDisabled}");
        expect(enableSwitch).toContain("onCheckedChange={(checked) =>");
    });

    it("keeps data-source P0 detail rows explicit, safe, and wired to real actions", () => {
        const content = readSource(
            "features/settings/components/settings-content.tsx",
        );
        const dataSourcesPanel =
            content.match(
                /function DataSourcesSettingsPanel[\s\S]*?type SectionSaveState/,
            )?.[0] ?? "";
        const presentation = readSource("lib/data-sources/presentation.ts");

        expect(dataSourcesPanel).toContain("自动更新");
        expect(dataSourcesPanel).toContain("每 15 分钟读取一次新录音");
        expect(dataSourcesPanel).toContain(
            'data-sot-control="source-auto-update"',
        );
        expect(dataSourcesPanel).toContain("标题更新回来源");
        expect(dataSourcesPanel).toContain("关闭后不再从此来源读取任何新录音");
        expect(dataSourcesPanel).toContain('label: "base URL"');
        expect(dataSourcesPanel).toContain('"钉钉 API 域名"');
        expect(dataSourcesPanel).toContain('"https://alidocs.dingtalk.com"');
        expect(content).toContain('"m@example.com · 浏览器授权登录"');
        expect(presentation).toContain('"最近更新 · 12 分钟前 · 112 条录音"');
        expect(presentation).toContain('"正在同步 · 已读取 12 / 48"');
        expect(presentation).toContain('"上次同步失败 · 2 小时前"');
        expect(presentation).toContain('"待设置 · 两种接入方式"');
        expect(presentation).toContain('"登录已过期"');
        expect(dataSourcesPanel).toContain(
            'selectedSource.provider !== "dingtalk-a1"',
        );
        expect(dataSourcesPanel).toContain(
            'data-sot-control="source-enable-sync"',
        );
        expect(dataSourcesPanel).toContain('data-sot-control="source-test"');
        expect(dataSourcesPanel).toContain('data-sot-control="source-save"');
        expect(dataSourcesPanel).toContain(
            'data-sot-control="source-reconnect"',
        );
        expect(dataSourcesPanel).toContain(
            'data-sot-control="source-disconnect"',
        );
        expect(dataSourcesPanel).toContain('"重新连接"');
        expect(dataSourcesPanel).toContain('"断开连接"');

        for (const bannedTerm of [
            "HAR",
            "Cookie",
            "payload",
            "Bearer",
            "user_access_token",
            "X-Session-Id",
        ]) {
            expect(dataSourcesPanel).not.toContain(bannedTerm);
        }

        const authModeIndex = dataSourcesPanel.indexOf(
            'data-sot-list="source-auth-modes"',
        );
        const serviceAddressIndex = dataSourcesPanel.indexOf(
            "displayedServiceAddress &&",
        );
        const primaryFieldsIndex =
            dataSourcesPanel.indexOf("primaryFields.map");
        const advancedFieldsIndex = dataSourcesPanel.indexOf(
            "advancedFields.length",
        );
        const autoUpdateIndex = dataSourcesPanel.indexOf("自动更新");
        const titleWritebackIndex = dataSourcesPanel.indexOf(
            "titleWritebackFields.map",
        );
        const enableSyncIndex = dataSourcesPanel.indexOf(
            'data-sot-control="source-enable-sync"',
        );
        const footerIndex = dataSourcesPanel.indexOf(
            'data-sot-control="source-test"',
        );
        const reconnectRowIndex = dataSourcesPanel.indexOf(
            'data-sot-part="source-reconnect-row"',
        );
        const disconnectRowIndex = dataSourcesPanel.indexOf(
            'data-sot-part="source-disconnect-row"',
        );

        expect(authModeIndex).toBeGreaterThanOrEqual(0);
        expect(serviceAddressIndex).toBeGreaterThan(authModeIndex);
        expect(primaryFieldsIndex).toBeGreaterThan(serviceAddressIndex);
        expect(advancedFieldsIndex).toBeGreaterThan(primaryFieldsIndex);
        expect(autoUpdateIndex).toBeGreaterThan(advancedFieldsIndex);
        expect(titleWritebackIndex).toBeGreaterThan(autoUpdateIndex);
        expect(enableSyncIndex).toBeGreaterThan(titleWritebackIndex);
        expect(footerIndex).toBeGreaterThan(enableSyncIndex);
        expect(reconnectRowIndex).toBeGreaterThan(footerIndex);
        expect(disconnectRowIndex).toBeGreaterThan(reconnectRowIndex);

        const reconnectRow =
            dataSourcesPanel.match(
                /<div\s+className="sm-row"\s+data-sot-part="source-reconnect-row"[\s\S]*?<\/Button>\s*<\/div>\s*<\/div>/,
            )?.[0] ?? "";
        const disconnectRow =
            dataSourcesPanel.match(
                /<div\s+className="sm-row"\s+data-sot-part="source-disconnect-row"[\s\S]*?<\/Button>\s*<\/div>\s*<\/div>/,
            )?.[0] ?? "";

        expect(reconnectRow).toContain('className="sm-row"');
        expect(reconnectRow).toContain('className="sm-l-t"');
        expect(reconnectRow).toContain('"重新连接"');
        expect(reconnectRow).toContain('data-sot-control="source-reconnect"');
        expect(reconnectRow).toMatch(
            /handleReconnectSource\(\s*selectedSource,\s*\)/,
        );
        expect(reconnectRow).toContain(
            'aria-busy={actionState === "reconnecting"}',
        );
        expect(disconnectRow).toContain('className="sm-row"');
        expect(disconnectRow).toContain('className="sm-l-t"');
        expect(disconnectRow).toContain('"断开连接"');
        expect(disconnectRow).toContain('data-sot-control="source-disconnect"');
        expect(disconnectRow).toMatch(
            /handleDisconnectSource\(\s*selectedSource,\s*\)/,
        );
        expect(disconnectRow).toContain(
            'aria-busy={actionState === "disconnecting"}',
        );

        const actionFooter =
            dataSourcesPanel.match(
                /<footer[\s\S]*?className="sm-actions sm-actions-state"[\s\S]*?<\/footer>/,
            )?.[0] ?? "";
        const actionOrder = [
            ...actionFooter.matchAll(
                /data-sot-control="(source-test|source-save|source-reconnect|source-disconnect)"/g,
            ),
        ].map((match) => match[1]);

        expect(actionFooter).toContain("data-save-status");
        expect(actionOrder).toEqual(["source-test", "source-save"]);

        const stateBannerBlock =
            dataSourcesPanel.match(
                /\{shouldShowProviderStateBanner[\s\S]*?<ProviderStateBanner[\s\S]*?\/>\s*\)\s*:\s*null\}/,
            )?.[0] ?? "";
        const stateBannerHelper =
            content.match(
                /function shouldShowProviderStateBanner[\s\S]*?function getMissingConnectionFields/,
            )?.[0] ?? "";

        expect(stateBannerBlock).toContain("actionMessage");
        expect(stateBannerHelper).toContain("status.state");
        expect(stateBannerHelper).toContain('"connected"');
        expect(stateBannerHelper).toContain('"configured"');
        expect(stateBannerHelper).toContain('"needs-setup"');

        const globals = readSource("app/globals.css");
        const actionStateBaseCss = readCssBlock(
            globals,
            ".sm-actions-state {\n    align-items: center;",
        );
        expect(actionStateBaseCss).toContain("flex-direction: row-reverse;");
        expect(globals).not.toContain('data-sot-actions="source-actions"');
        expect([...actionOrder].reverse()).toEqual([
            "source-save",
            "source-test",
        ]);
    });

    it("keeps non-source settings panels connected to stores and save state boundaries", () => {
        const content = readSource(
            "features/settings/components/settings-content.tsx",
        );
        const displayPanel = content.match(
            /function DisplaySettingsPanel[\s\S]*?function TitleGenerationSettingsPanel/,
        )?.[0];
        const titleGenerationPanel = content.match(
            /function TitleGenerationSettingsPanel[\s\S]*?function VoScriptSettingsPanel/,
        )?.[0];
        const voscriptPanel = content.match(
            /function VoScriptSettingsPanel[\s\S]*?function TranscriptionSettingsPanel/,
        )?.[0];
        const denoiseOptions = voscriptPanel?.match(
            /const denoiseOptions:[\s\S]*?\];/,
        )?.[0];
        const transcriptionPanel = content.match(
            /function TranscriptionSettingsPanel[\s\S]*?function SyncSettingsRows/,
        )?.[0];
        const miscPanel = content.match(
            /function MiscSettingsPanel[\s\S]*?export function SettingsContent/,
        )?.[0];
        const playbackSettingsRows = content.match(
            /function PlaybackSettingsRows[\s\S]*?function MiscSettingsPanel/,
        )?.[0];
        const dataSourcesPanel = content.match(
            /function DataSourcesSettingsPanel[\s\S]*?type SectionSaveState/,
        )?.[0];
        const saveStatus = content.match(
            /function SaveStatus[\s\S]*?function SectionShell/,
        )?.[0];

        for (const section of [
            "appearance",
            "title-generation",
            "voscript",
            "transcription",
            "misc",
        ]) {
            expect(content).toContain(`section="${section}"`);
            expect(content).toContain(`case "${section}"`);
        }
        expect(content).not.toContain('case "display"');
        expect(content).not.toContain('case "sync"');
        expect(content).not.toContain('case "playback"');

        expect(content).toContain("function SectionShell");
        expect(content).toContain('data-sot-surface="settings-section"');
        expect(content).toContain('data-sot-panel="settings-scroll-body"');
        expect(content).toContain("data-sot-section={section}");
        expect(content).toContain("data-sot-state=");
        expect(content).toContain('className="sm-title"');
        expect(content).toContain('className="sm-section-head"');
        expect(content).toContain('className="sm-l-t"');
        expect(content).toContain('className="sm-l-h"');
        expect(content).not.toContain("sm-section-title");
        expect(content).not.toContain("sm-row-name");
        expect(content).toContain("function SaveActions");
        expect(saveStatus).toContain("data-save-status={saveState}");
        expect(content).toContain("data-save-id={saveId}");
        expect(content).toContain("data-save-state={saveState}");
        expect(content).toContain('aria-busy={saveState === "saving"}');
        expect(content).toContain('control="density"');
        expect(content).toContain('saveId="voscript-connection"');
        expect(content).toContain('data-save-test=""');
        expect(content).toContain('data-sot-control="voscript-test"');
        expect(content).toContain('saveId="voscript-params"');
        expect(content).toContain('data-voscript-unavail=""');
        expect(content).toContain('data-field="no-repeat-ngram"');
        expect(content).toContain("data-field-msg");
        expect(content).toContain("isVoScriptNoRepeatNgramInvalid");
        expect(content).toContain("testVoScriptConnection");
        expect(content).toContain("useDisplaySettingsStore");
        expect(content).toContain("useTitleGenerationSettingsStore");
        expect(content).toContain("useVoScriptSettingsStore");
        expect(content).toContain("useTranscriptionSettingsStore");
        expect(content).toContain("useSyncSettingsStore");
        expect(content).toContain("usePlaybackSettingsStore");
        expect(content).toContain("updateDisplaySettings");
        expect(content).toContain("updateTitleGenerationSettings");
        expect(content).toContain("updateVoScriptSettings");
        expect(content).toContain("updateTranscriptionSettings");
        expect(content).toContain("updateSyncSettings");
        expect(content).toContain("updatePlaybackSettings");
        expect(content).toContain("MIN_SYNC_INTERVAL_SECONDS");
        expect(content).toContain("PLAYBACK_SPEED_OPTIONS");
        expect(content).not.toMatch(OLD_UI_RE);

        expect(displayPanel).not.toContain("<SaveActions");
        expect(displayPanel).not.toContain('saveId="appearance"');
        expect(displayPanel).not.toContain("data-save-action");
        expect(displayPanel).not.toContain("sm-actions-state");
        expect(titleGenerationPanel).toContain("<SaveActions");
        expect(titleGenerationPanel).toContain('saveId="title-generation"');
        expect(voscriptPanel).toContain("<SaveActions");
        expect(denoiseOptions).toMatch(/label:\s*"不降噪",\s*value:\s*"none"/);
        expect(denoiseOptions).toMatch(
            /label:\s*"DeepFilterNet",\s*value:\s*"deepfilternet"/,
        );
        expect(denoiseOptions).toMatch(
            /label:\s*"noisereduce",\s*value:\s*"noisereduce"/,
        );
        expect(denoiseOptions).not.toContain('"关闭"');
        expect(denoiseOptions).not.toContain('"Noisereduce"');
        expect(dataSourcesPanel).toContain('data-sot-control="source-save"');
        expect(dataSourcesPanel).toContain(
            'className="sm-actions sm-actions-state"',
        );
        expect(dataSourcesPanel).toMatch(
            /data-save-id=\{`ds-\$\{selectedSource\.provider\}`\}/,
        );
        expect(dataSourcesPanel).toContain('data-save-test=""');
        expect(dataSourcesPanel).toContain('data-save-action=""');
        expect(miscPanel).not.toContain("<SaveActions");
        expect(miscPanel).not.toContain('saveId="misc"');
        expect(miscPanel).not.toContain("data-save-action");
        expect(miscPanel).not.toContain("sm-actions-state");
        expect(miscPanel).toContain("updateSyncSettings({");
        expect(miscPanel).toContain("autoSyncEnabled: checked");
        expect(miscPanel).toContain("onSyncIntervalBlur");
        expect(miscPanel).toContain("syncIntervalSeconds: normalizedInterval");
        expect(miscPanel).toContain("updatePlaybackSettings({");
        expect(miscPanel).toContain(
            "defaultPlaybackSpeed: defaultPlaybackSpeed",
        );
        expect(miscPanel).toContain("defaultVolume: defaultVolume");
        expect(miscPanel).toContain("autoPlayNext: checked");
        expect(playbackSettingsRows).toContain("当前录音结束后自动播放下一条");
        expect(playbackSettingsRows).not.toContain(
            "当前录音结束后自动播放下一条。",
        );
        expect(transcriptionPanel).toContain(
            "function TranscriptionSettingsPanel",
        );
        expect(transcriptionPanel).toContain("updateTranscriptionSettings({");
        expect(transcriptionPanel).toContain("autoTranscribe: checked");
        expect(transcriptionPanel).toMatch(
            /defaultTranscriptionLanguage:\s*nullableText\(\s*value,?\s*\)/,
        );
        expect(transcriptionPanel).not.toContain("<SaveActions");
        expect(transcriptionPanel).not.toContain("data-save-action");
        expect(transcriptionPanel).not.toContain("saveState");
        expect(transcriptionPanel).not.toContain("sm-actions-state");
    });

    it("keeps VoScript no-repeat n-gram validation inline before persistence", () => {
        const content = readSource(
            "features/settings/components/settings-content.tsx",
        );
        const voscriptPanel = content.match(
            /function VoScriptSettingsPanel[\s\S]*?function TranscriptionSettingsPanel/,
        )?.[0];
        const saveFunction = voscriptPanel?.match(
            /const save = async[\s\S]*?const testConnection = async/,
        )?.[0];
        const settingsRow = content.match(
            /function SettingsRow[\s\S]*?function SelectControl/,
        )?.[0];
        const noRepeatRow = voscriptPanel?.match(
            /data-field="no-repeat-ngram"[\s\S]*?<SaveActions/,
        )?.[0];

        expect(voscriptPanel).toContain(
            "function isVoScriptNoRepeatNgramInvalid",
        );
        expect(voscriptPanel).toContain(
            "draft.privateTranscriptionNoRepeatNgramSize > 0",
        );
        expect(voscriptPanel).toContain(
            "draft.privateTranscriptionNoRepeatNgramSize < 3",
        );
        expect(voscriptPanel).toContain(
            'const noRepeatNgramMessage = "只支持 0 或 ≥ 3"',
        );
        expect(noRepeatRow).toContain('data-field="no-repeat-ngram"');
        expect(noRepeatRow).toContain(
            'fieldState={noRepeatNgramInvalid ? "invalid" : undefined}',
        );
        expect(noRepeatRow).toContain("aria-invalid={noRepeatNgramInvalid}");
        expect(noRepeatRow).toContain("fieldMessage={");
        expect(noRepeatRow).toContain("noRepeatNgramMessage");
        expect(settingsRow).toContain("data-field-msg");
        expect(settingsRow).toContain("sm-field-msg");
        expect(settingsRow).toContain("{fieldMessage}");
        expect(noRepeatRow).toContain('placeholder={isZh ? "0 或 ≥ 3"');
        expect(saveFunction).toContain("if (noRepeatNgramInvalid)");
        expect(saveFunction).toContain('paramsSave.setSaveState("error")');
        expect(saveFunction).toContain("paramsSave.setSaveError");
        expect(saveFunction).toContain("noRepeatNgramMessage");
        expect(saveFunction).toContain("return;");
        expect(saveFunction).toMatch(
            /if \(noRepeatNgramInvalid\)[\s\S]*?return;[\s\S]*?const updates: VoScriptSettingsUpdate/,
        );
    });

    it("keeps VoScript speaker bounds validation inline before persistence", () => {
        const content = readSource(
            "features/settings/components/settings-content.tsx",
        );
        const voscriptPanel = content.match(
            /function VoScriptSettingsPanel[\s\S]*?function TranscriptionSettingsPanel/,
        )?.[0];
        const speakerRows = content.match(
            /function VoScriptSpeakerRows[\s\S]*?function VoScriptSettingsPanel/,
        )?.[0];
        const saveFunction = voscriptPanel?.match(
            /const save = async[\s\S]*?const testConnection = async/,
        )?.[0];
        const settingsRow = content.match(
            /function SettingsRow[\s\S]*?function SelectControl/,
        )?.[0];
        const minSpeakersRow = speakerRows?.match(
            /data-field="min-speakers"[\s\S]*?<\/SettingsRow>/,
        )?.[0];
        const maxSpeakersRow = speakerRows?.match(
            /data-field="max-speakers"[\s\S]*?<\/SettingsRow>/,
        )?.[0];
        const speakerBoundsGuard = saveFunction?.match(
            /if \(resolvedSpeakerBoundsMessage\)[\s\S]*?return;/,
        )?.[0];

        expect(voscriptPanel).toContain(
            'const speakerBoundsMessage = "不能为负数"',
        );
        expect(voscriptPanel).toContain(
            'const speakerRangeMessage = "最多说话人数必须 ≥ 最少说话人数"',
        );
        expect(voscriptPanel).toContain(
            "draft.privateTranscriptionMinSpeakers < 0",
        );
        expect(voscriptPanel).toContain(
            "draft.privateTranscriptionMaxSpeakers < 0",
        );
        expect(voscriptPanel).toContain(
            "draft.privateTranscriptionMaxSpeakers > 0",
        );
        expect(voscriptPanel).toMatch(
            /draft\.privateTranscriptionMaxSpeakers\s*<\s*draft\.privateTranscriptionMinSpeakers/,
        );
        expect(voscriptPanel).toContain(
            "const minSpeakersInvalid = minSpeakersNegative",
        );
        expect(voscriptPanel).toContain(
            "const maxSpeakersInvalid = maxSpeakersNegative || speakerRangeInvalid",
        );
        expect(voscriptPanel).toContain("const minSpeakersMessage =");
        expect(voscriptPanel).toContain("const maxSpeakersMessage =");
        expect(voscriptPanel).toMatch(
            /const resolvedSpeakerBoundsMessage\s*=\s*minSpeakersMessage\s*\?\?\s*maxSpeakersMessage/,
        );
        expect(minSpeakersRow).toContain('data-field="min-speakers"');
        expect(minSpeakersRow).toContain(
            'fieldState={minSpeakersInvalid ? "invalid" : undefined}',
        );
        expect(minSpeakersRow).toContain("fieldMessage={minSpeakersMessage}");
        expect(minSpeakersRow).toContain("aria-invalid={minSpeakersInvalid}");
        expect(maxSpeakersRow).toContain('data-field="max-speakers"');
        expect(maxSpeakersRow).toContain(
            'fieldState={maxSpeakersInvalid ? "invalid" : undefined}',
        );
        expect(maxSpeakersRow).toContain("fieldMessage={maxSpeakersMessage}");
        expect(maxSpeakersRow).toContain("aria-invalid={maxSpeakersInvalid}");
        expect(settingsRow).toContain("data-field-msg");
        expect(speakerBoundsGuard).toContain(
            'paramsSave.setSaveState("error")',
        );
        expect(speakerBoundsGuard).toContain(
            "paramsSave.setSaveError(resolvedSpeakerBoundsMessage)",
        );
        expect(saveFunction).toMatch(
            /if \(resolvedSpeakerBoundsMessage\)[\s\S]*?return;[\s\S]*?const updates: VoScriptSettingsUpdate[\s\S]*?await updateVoScriptSettings\(updates\)/,
        );
    });

    it("keeps appearance segmented controls on SOT-facing aliases without changing saved values", () => {
        const content = readSource(
            "features/settings/components/settings-content.tsx",
        );
        const segmentControl = content.match(
            /function SegmentControl[\s\S]*?function SaveActions/,
        )?.[0];
        const themeOptions = content.match(
            /const themeOptions:[\s\S]*?const languageOptions:/,
        )?.[0];
        const dateTimeOptions = content.match(
            /const dateTimeOptions:[\s\S]*?const densityOptions:/,
        )?.[0];
        const densityOptions = content.match(
            /const densityOptions:[\s\S]*?const sortOptions:/,
        )?.[0];

        expect(content).toContain("sotValue?: string");
        expect(segmentControl).toContain("data-sot-value={option.value}");
        expect(segmentControl).toContain(
            "data-v={option.sotValue ?? option.value}",
        );
        expect(segmentControl).toContain("value={option.value}");
        expect(themeOptions).toMatch(
            /label:\s*isZh \? "自动" : "Auto",\s*value:\s*"system",\s*sotValue:\s*"auto"/,
        );
        expect(themeOptions).toContain('value: "light"');
        expect(themeOptions).toContain('value: "dark"');
        expect(dateTimeOptions).toMatch(
            /label:\s*isZh \? "2 小时前" : "2 hours ago",\s*value:\s*"relative",\s*sotValue:\s*"rel"/,
        );
        expect(dateTimeOptions).toMatch(
            /label:\s*"14:00",\s*value:\s*"absolute",\s*sotValue:\s*"abs"/,
        );
        expect(densityOptions).toContain('value: "comfy"');
        expect(densityOptions).toContain('value: "compact"');
        expect(densityOptions).not.toContain("sotValue");
        expect(content).toContain('persistDisplaySetting("theme", value)');
        expect(content).toContain(
            'persistDisplaySetting("dateTimeFormat", value)',
        );
        expect(content).toContain(
            'persistDisplaySetting("displayDensity", value)',
        );
        expect(content).toMatch(
            /persistDisplaySetting\(\s*"uiLanguage",\s*value\s+as\s+UiLanguage,?\s*\)/,
        );
        expect(content).toMatch(
            /persistDisplaySetting\(\s*"itemsPerPage",\s*nextItemsPerPage,?\s*\)/,
        );
        expect(content).not.toContain('theme: "auto"');
        expect(content).not.toContain('dateTimeFormat: "rel"');
        expect(content).not.toContain('dateTimeFormat: "abs"');
    });

    it("keeps VoScript max inflight save payload aligned with unlimited zero semantics", () => {
        const content = readSource(
            "features/settings/components/settings-content.tsx",
        );
        const maxInflightClamp = content.match(
            /privateTranscriptionMaxInflightJobs:\s*clampInteger\(\s*draft\.privateTranscriptionMaxInflightJobs,\s*(\d+),\s*(\d+),\s*\)/,
        );

        expect(maxInflightClamp?.slice(1)).toEqual(["0", "20"]);
    });

    it("keeps section load failures as visual banners without alert role", () => {
        const content = readSource(
            "features/settings/components/settings-content.tsx",
        );
        const sectionLoadErrorBanner = content.match(
            /<Alert\s+className="sm-banner err"\s+data-sot-panel="settings-section-load-error"\s+data-sot-section=\{section\}[\s\S]*?>/,
        )?.[0];

        expect(sectionLoadErrorBanner).toBeDefined();
        expect(sectionLoadErrorBanner ?? "").not.toContain("role={undefined}");
        expect(sectionLoadErrorBanner ?? "").not.toContain('role="alert"');
        expect(sectionLoadErrorBanner ?? "").not.toMatch(/\srole=/);
    });

    it("keeps speaker profile and voiceprint management live without old UI surfaces", () => {
        const speakers = readSource(
            "features/settings/components/sections/speaker-profiles-panel.tsx",
        );

        expect(speakers).toContain("data-sot-speaker-profiles-panel");
        expect(speakers).toContain("data-sot-state={profilesState}");
        expect(speakers).toContain(
            "data-sot-voiceprints-state={voiceprintsState}",
        );
        expect(speakers).toContain('data-sot-panel="speaker-voiceprints"');
        expect(speakers).toContain("data-sot-speaker-profile-row");
        expect(speakers).toContain("data-sot-voiceprint-row");
        expect(speakers).toContain("sot-speaker-profiles");
        expect(speakers).toContain("sot-speaker-avatar");
        expect(speakers).not.toContain("data-profiles-state");
        expect(speakers).not.toContain("data-vs-state");
        expect(speakers).not.toMatch(/\bvs-profile/);
        expect(speakers).not.toContain("vs-avatar");
        expect(speakers).toContain('fetch("/api/speakers/profiles"');
        expect(speakers).toContain('fetch("/api/voiceprints"');
        expect(speakers).toContain("refreshProfiles");
        expect(speakers).toContain("refreshVoiceprints");
        expect(speakers).toContain("onClick={() => void refreshProfiles()}");
        expect(speakers).toContain("onClick={() => void refreshVoiceprints()}");
        expect(speakers).toContain("disabled={isProfilesLoading}");
        expect(speakers).toContain("disabled={isVoiceprintsLoading}");
        expect(speakers).toContain("data-icon-state={");
        expect(speakers).toContain("handleCreate");
        expect(speakers).toContain("handleUpdate");
        expect(speakers).toContain("handleDelete");
        expect(speakers).toContain("handleRenameVoiceprint");
        expect(speakers).toContain("handleDeleteVoiceprint");
        expect(speakers).toContain("useConfirmDialog");
        expect(speakers).toContain("toast.success");
        expect(speakers).toContain("toast.error");
        expect(speakers).not.toMatch(OLD_UI_RE);
    });

    it("keeps settings skeletons on SOT loading primitives", () => {
        const skeletons = readSource(
            "features/settings/components/settings-skeletons.tsx",
        );
        const skeletonPrimitive = readSource("components/ui/skeleton.tsx");

        expect(skeletons).toContain('data-sot-panel="settings-card-skeleton"');
        expect(skeletons).toContain(
            'data-sot-panel="settings-section-skeleton"',
        );
        expect(skeletons).toContain('data-sot-panel="settings-list-skeleton"');
        expect(skeletons).toContain('data-sot-part="settings-skeleton-row"');
        expect(skeletons).toContain('className="sm-row"');
        expect(skeletons).toContain('className="sm-row-label"');
        expect(skeletons).toContain('className="sm-row-ctrl"');
        expect(skeletons).toContain("makeSkeletonKeys(");
        expect(skeletons).toContain("<Skeleton");
        expect(skeletonPrimitive).toContain('React.ComponentProps<"div">');
        expect(skeletons).not.toContain('className="field-row"');
        expect(skeletons).not.toContain('className="field-name"');
        expect(skeletons).not.toContain('className="field-desc"');
        expect(skeletons).not.toMatch(OLD_UI_RE);
        expect(skeletons).not.toMatch(/\brounded-/);
        expect(skeletons).not.toMatch(/\bspace-y-/);
    });
});
