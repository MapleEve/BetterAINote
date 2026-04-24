import type { SourceProvider } from "./catalog";
import type { ProviderPresentationDefinition } from "./presentation-definition-types";
import { dingtalkA1PresentationDefinition } from "./providers/dingtalk-a1/presentation";
import { feishuMinutesPresentationDefinition } from "./providers/feishu-minutes/presentation";
import { iflyrecPresentationDefinition } from "./providers/iflyrec/presentation";
import { plaudPresentationDefinition } from "./providers/plaud/presentation";
import { ticnotePresentationDefinition } from "./providers/ticnote/presentation";

export const SOURCE_PROVIDER_PRESENTATIONS: Record<
    SourceProvider,
    ProviderPresentationDefinition
> = {
    plaud: plaudPresentationDefinition,
    ticnote: ticnotePresentationDefinition,
    "feishu-minutes": feishuMinutesPresentationDefinition,
    "dingtalk-a1": dingtalkA1PresentationDefinition,
    iflyrec: iflyrecPresentationDefinition,
};
