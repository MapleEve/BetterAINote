import type { SourceProvider, SourceProviderManifest } from "../types";
import { dingtalkA1ProviderManifest } from "./dingtalk-a1/manifest";
import { feishuMinutesProviderManifest } from "./feishu-minutes/manifest";
import { iflyrecProviderManifest } from "./iflyrec/manifest";
import { plaudProviderManifest } from "./plaud/manifest";
import { ticnoteProviderManifest } from "./ticnote/manifest";

export const SOURCE_PROVIDER_MANIFESTS: Record<
    SourceProvider,
    SourceProviderManifest
> = {
    plaud: plaudProviderManifest,
    ticnote: ticnoteProviderManifest,
    "feishu-minutes": feishuMinutesProviderManifest,
    "dingtalk-a1": dingtalkA1ProviderManifest,
    iflyrec: iflyrecProviderManifest,
};
