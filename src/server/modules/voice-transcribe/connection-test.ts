import { VoiceTranscribeClient } from "@/lib/voice-transcribe/client";
import { getVoiceTranscribeAccessForUser } from "./access";

const TEST_PROVIDER_ID = "voscript-test";
const TEST_PROVIDER_NAME = "voice-transcribe";

export type VoiceTranscribeConnectionTestResult = {
    available: true;
    providerName: typeof TEST_PROVIDER_NAME;
    success: true;
    voiceprintCount: number;
};

async function resolveConnectionTestClient(params: {
    apiKey: string | null;
    baseUrl: string;
    userId: string;
}): Promise<VoiceTranscribeClient> {
    if (!params.apiKey) {
        const access = await getVoiceTranscribeAccessForUser(params.userId);
        if (
            access.client &&
            access.connection?.baseUrl.trim() === params.baseUrl
        ) {
            return access.client;
        }
    }

    return new VoiceTranscribeClient({
        apiKey: params.apiKey,
        baseUrl: params.baseUrl,
        providerId: TEST_PROVIDER_ID,
        providerName: TEST_PROVIDER_NAME,
    });
}

export async function testVoiceTranscribeConnectionForUser(params: {
    apiKey: string | null;
    baseUrl: string;
    userId: string;
}): Promise<VoiceTranscribeConnectionTestResult> {
    const client = await resolveConnectionTestClient(params);
    const voiceprints = await client.listVoiceprints();

    return {
        available: true,
        providerName: TEST_PROVIDER_NAME,
        success: true,
        voiceprintCount: voiceprints.length,
    };
}
