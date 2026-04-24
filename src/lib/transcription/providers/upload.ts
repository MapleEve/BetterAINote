/**
 * Raw fetch-based audio upload to OpenAI-compatible transcription APIs.
 *
 * The OpenAI SDK's file upload handling breaks in Bun's standalone/Next.js
 * production build because it relies on the Web File API behaving in a specific
 * way that Bun's runtime does not match. Using native fetch + FormData works
 * reliably across all runtimes.
 */

import { detectAudioFormat } from "@/lib/audio/detect-format";
import type { TranscriptionResult } from "./types";

interface UploadOptions {
    apiKey: string;
    baseURL: string;
    model: string;
    language?: string;
    responseFormat?: string;
}

export async function uploadAudioForTranscription(
    audioBuffer: Buffer,
    filename: string,
    options: UploadOptions,
): Promise<TranscriptionResult> {
    const format = detectAudioFormat(audioBuffer);
    const baseName = filename.replace(/\.[^.]+$/, "");
    const audioFilename = `${baseName}${format.extension}`;
    const debugEnabled = process.env.DEBUG_TRANSCRIPTION_UPLOAD === "1";
    if (debugEnabled) {
        const sample = audioBuffer.subarray(0, 16).toString("hex");
        console.error(
            `[transcription-upload] filename=${audioFilename} contentType=${format.contentType} bytes=${audioBuffer.length} sample=${sample}`,
        );
    }

    const responseFormat = options.responseFormat ?? "verbose_json";

    const baseURL = options.baseURL.replace(/\/$/, "");
    const sendRequest = async (requestFormat: string) => {
        const requestForm = new FormData();
        requestForm.append("model", options.model);
        requestForm.append(
            "file",
            new Blob([new Uint8Array(audioBuffer)], {
                type: format.contentType,
            }),
            audioFilename,
        );
        requestForm.append("response_format", requestFormat);
        if (options.language) {
            requestForm.append("language", options.language);
        }
        return fetch(`${baseURL}/audio/transcriptions`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${options.apiKey}`,
            },
            body: requestForm,
        });
    };

    let effectiveResponseFormat = responseFormat;
    let response = await sendRequest(effectiveResponseFormat);

    if (!response.ok && effectiveResponseFormat === "diarized_json") {
        // Some providers (e.g. Azure Whisper) do not support diarized_json.
        // Fall back to verbose_json without failing the whole transcription.
        effectiveResponseFormat = "verbose_json";
        response = await sendRequest(effectiveResponseFormat);
    }

    if (!response.ok) {
        const text = await response.text();
        if (debugEnabled) {
            console.error(
                `[transcription-upload] upstream status=${response.status} body=${text.slice(0, 400)}`,
            );
        }
        throw new Error(`${response.status} ${text}`);
    }

    const data = (await response.json()) as {
        text?: string;
        language?: string;
        segments?: Array<{
            speaker?: string;
            text?: string;
            start?: number;
            end?: number;
        }>;
    };

    if (effectiveResponseFormat === "diarized_json" && data.segments?.length) {
        const diarizedText = data.segments
            .map((segment) => {
                const speaker = segment.speaker || "Speaker";
                return `${speaker}: ${segment.text ?? ""}`.trim();
            })
            .filter(Boolean)
            .join("\n");
        return {
            text: diarizedText || (data.text ?? ""),
            detectedLanguage: data.language ?? null,
            speakerSegments: data.segments.map((segment) => ({
                speaker: segment.speaker || "Speaker",
                startMs:
                    typeof segment.start === "number"
                        ? Math.round(segment.start * 1000)
                        : null,
                endMs:
                    typeof segment.end === "number"
                        ? Math.round(segment.end * 1000)
                        : null,
                text: segment.text ?? null,
            })),
        };
    }

    return {
        text: data.text ?? "",
        detectedLanguage: data.language ?? null,
    };
}
