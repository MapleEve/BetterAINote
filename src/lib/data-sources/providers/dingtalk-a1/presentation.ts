import type {
    DataSourceFormField,
    DataSourceUiState,
    ProviderPresentationDefinition,
} from "@/lib/data-sources/presentation-definition-types";
import {
    buildTextareaField,
    buildTextField,
} from "@/lib/data-sources/presentation-field-builders";
import {
    buildSourceTitleSyncField,
    isZh,
} from "@/lib/data-sources/presentation-shared";
import { DINGTALK_DEVICE_CREDENTIAL_KEY } from "./constants";

const DINGTALK_BROWSER_AUTH_DISPLAY_KEY = "browserAuthorizationDisplay";
const DINGTALK_WEB_LOGIN_DISPLAY_KEY = "webLoginMaterialDisplay";
const DINGTALK_MASKED_VALUE = "••••••••••••••••";

function buildReadonlyDingTalkField(params: {
    id: string;
    key: string;
    label: string;
    description: string;
}): DataSourceFormField {
    return buildTextField({
        id: params.id,
        target: "config",
        key: params.key,
        label: params.label,
        value: DINGTALK_MASKED_VALUE,
        description: params.description,
        readOnly: true,
    });
}

function buildDingTalkFields(
    state: DataSourceUiState,
    secretDraft: Record<string, string>,
    language: import("@/lib/i18n").UiLanguage,
): DataSourceFormField[] {
    const zh = isZh(language);
    const deviceCredentialConfigured =
        state.secretsConfigured[DINGTALK_DEVICE_CREDENTIAL_KEY];

    return [
        buildReadonlyDingTalkField({
            id: "source-browser-authorization",
            key: DINGTALK_BROWSER_AUTH_DISPLAY_KEY,
            label: zh ? "浏览器授权" : "Browser authorization",
            description: zh
                ? "授权信息 · 已脱敏"
                : "Authorization details · masked",
        }),
        buildReadonlyDingTalkField({
            id: "source-web-login-material",
            key: DINGTALK_WEB_LOGIN_DISPLAY_KEY,
            label: zh ? "网页登录材料" : "Web sign-in materials",
            description: zh
                ? "登录材料 · 用于读取闪记列表"
                : "Sign-in materials · used to read Flash Notes",
        }),
        deviceCredentialConfigured
            ? buildTextField({
                  id: "source-device-identifier-display",
                  target: "config",
                  key: "deviceIdentifierDisplay",
                  label: zh ? "设备标识" : "Device identifier",
                  value: zh ? "已脱敏" : "Masked",
                  description: zh ? "本机设备标识" : "Local device identifier",
                  readOnly: true,
              })
            : buildTextareaField({
                  id: "source-secret",
                  target: "secret",
                  key: DINGTALK_DEVICE_CREDENTIAL_KEY,
                  label: zh ? "设备标识" : "Device identifier",
                  value: secretDraft[DINGTALK_DEVICE_CREDENTIAL_KEY] ?? "",
                  rows: 3,
                  className: "font-mono text-sm",
                  description: zh ? "本机设备标识" : "Local device identifier",
                  placeholder: zh ? "填写设备标识" : "Enter device identifier",
              }),
        buildSourceTitleSyncField(state, language),
    ].filter((field) => field !== null);
}

export const dingtalkA1PresentationDefinition: ProviderPresentationDefinition =
    {
        secretKeys: [DINGTALK_DEVICE_CREDENTIAL_KEY],
        getFields: buildDingTalkFields,
        normalizePayload: ({ state, secretDraft, payload }) => ({
            ...payload,
            authMode:
                state.authMode as import("@/lib/data-sources/catalog").SourceAuthMode,
            baseUrl: "https://meeting-ai-tingji.dingtalk.com",
            config: {
                syncTitleToSource: payload.config.syncTitleToSource === true,
            },
            secrets: {
                [DINGTALK_DEVICE_CREDENTIAL_KEY]:
                    secretDraft[DINGTALK_DEVICE_CREDENTIAL_KEY]?.trim() ?? "",
            },
        }),
    };
