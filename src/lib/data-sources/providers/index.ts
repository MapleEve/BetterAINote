import {
    DATA_SOURCE_PROVIDERS,
    type ResolvedSourceConnection,
    type SourceProvider,
    type SourceProviderClient,
    type SourceProviderDefinition,
} from "../types";
import { dingtalkA1ProviderDefinition } from "./dingtalk-a1/definition";
import { feishuMinutesProviderDefinition } from "./feishu-minutes/definition";
import { iflyrecProviderDefinition } from "./iflyrec/definition";
import { plaudProviderDefinition } from "./plaud/definition";
import { ticnoteProviderDefinition } from "./ticnote/definition";

export const SOURCE_PROVIDER_DEFINITIONS: Record<
    SourceProvider,
    SourceProviderDefinition
> = {
    plaud: plaudProviderDefinition,
    ticnote: ticnoteProviderDefinition,
    "feishu-minutes": feishuMinutesProviderDefinition,
    "dingtalk-a1": dingtalkA1ProviderDefinition,
    iflyrec: iflyrecProviderDefinition,
};

export function getSourceProviderDefinition(provider: SourceProvider) {
    return SOURCE_PROVIDER_DEFINITIONS[provider];
}

export function getSourceProviderDefinitions() {
    return DATA_SOURCE_PROVIDERS.map((provider) =>
        getSourceProviderDefinition(provider),
    );
}

export function getSourceProvidersWithTitleWriteback() {
    return DATA_SOURCE_PROVIDERS.filter((provider) =>
        Boolean(getSourceProviderDefinition(provider).titleWriteback),
    );
}

export function createSourceProviderClient(
    connection: ResolvedSourceConnection,
): SourceProviderClient {
    return getSourceProviderDefinition(connection.provider).createClient(
        connection,
    );
}
