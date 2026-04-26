export const DINGTALK_DEVICE_SIGNIN_AUTH_MODE = "device-signin";
export const DINGTALK_DEVICE_CREDENTIAL_KEY = "deviceCredential";
export const DINGTALK_LEGACY_DEVICE_SIGNIN_AUTH_MODE = ["ag", "ent-token"].join(
    "",
);
export const DINGTALK_LEGACY_DEVICE_CREDENTIAL_KEY = ["ag", "entToken"].join(
    "",
);

export function normalizeDingTalkAuthMode(value: unknown) {
    return value === DINGTALK_LEGACY_DEVICE_SIGNIN_AUTH_MODE
        ? DINGTALK_DEVICE_SIGNIN_AUTH_MODE
        : value;
}

export function getDingTalkDeviceCredential(secrets: Record<string, string>) {
    return (
        secrets[DINGTALK_DEVICE_CREDENTIAL_KEY] ??
        secrets[DINGTALK_LEGACY_DEVICE_CREDENTIAL_KEY] ??
        ""
    );
}
