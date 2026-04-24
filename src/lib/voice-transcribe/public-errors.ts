import type { VoiceTranscribeHttpError } from "./client";

export const PUBLIC_VOICEPRINT_SERVICE_ERROR = "声纹服务暂时不可用，请稍后重试";

export const PUBLIC_VOICEPRINT_NOT_FOUND_ERROR =
    "未找到对应的声纹，请刷新后重试";

export const PUBLIC_VOICEPRINT_REQUEST_ERROR = "声纹操作失败，请检查输入后重试";

export function getPublicVoiceTranscribeErrorMessage(
    error: VoiceTranscribeHttpError,
) {
    if (error.status === 404) {
        return PUBLIC_VOICEPRINT_NOT_FOUND_ERROR;
    }

    if (error.status === 400 || error.status === 422) {
        return PUBLIC_VOICEPRINT_REQUEST_ERROR;
    }

    return PUBLIC_VOICEPRINT_SERVICE_ERROR;
}
