import { normalizeNullableServiceUrlSetting } from "@/lib/settings/validation";

export function normalizeTitleGenerationBaseUrlSetting(value: unknown) {
    return normalizeNullableServiceUrlSetting("titleGenerationBaseUrl", value);
}

export function normalizePrivateTranscriptionBaseUrlSetting(value: unknown) {
    return normalizeNullableServiceUrlSetting(
        "privateTranscriptionBaseUrl",
        value,
    );
}
