import { GoogleGenAI } from "@google/genai";
import { detectAudioFormat } from "@/lib/audio/detect-format";
import {
    type DiarizeResult,
    formatDiarizeHint,
    isDiarizationAvailable,
    runDiarization,
} from "@/lib/transcription/diarize";
import type {
    TranscriptionOptions,
    TranscriptionProvider,
    TranscriptionResult,
    TranscriptionSpeakerSegment,
} from "./types";

const DEFAULT_MODEL = "gemini-3-flash-preview";
/** Gemini 3 models require the 'global' location on Vertex AI */
const GEMINI3_LOCATION = "global";
const DEFAULT_SPEAKER_COUNT = 2;

function mapSpeakerSegments(
    diarizeResult: DiarizeResult | undefined,
): TranscriptionSpeakerSegment[] {
    if (!diarizeResult?.segments.length) {
        return [];
    }

    const sortedSpeakers = [...diarizeResult.speakers].sort();
    const labelMap = new Map(
        sortedSpeakers.map((speaker, index) => [
            speaker,
            `Speaker ${index + 1}`,
        ]),
    );

    return diarizeResult.segments.map((segment) => ({
        speaker: labelMap.get(segment.speaker) ?? segment.speaker,
        startMs: Math.round(segment.start * 1000),
        endMs: Math.round(segment.end * 1000),
        text: null,
    }));
}

/**
 * Minimum number of total occurrences of a substring across the full text
 * before we consider it a degenerate loop. Set conservatively to avoid
 * false-positives on phrases that legitimately recur a few times.
 */
const REPETITION_COUNT_THRESHOLD = 8;
/**
 * The substring we search for must be at least this long so that normal
 * repeated filler ("yeah, yeah") or shared structural patterns (e.g.
 * "Speaker 1: " appearing in many turns) don't trigger detection.
 * 100 chars is long enough that varying content (names, numbers) will
 * differentiate legitimate turns, but short enough to land inside even
 * moderately-sized repeating blocks.
 */
const NEEDLE_LEN = 100;

function mimeTypeForGemini(contentType: string): string {
    const map: Record<string, string> = {
        "audio/ogg": "audio/ogg",
        "audio/mpeg": "audio/mp3",
        "audio/wav": "audio/wav",
        "audio/flac": "audio/flac",
    };
    return map[contentType] ?? "audio/mp3";
}

function buildPrompt(
    useDiarization: boolean,
    _speakerCount: number,
    language?: string,
    diarizeHint?: string,
): string {
    const langHint = language ? ` The audio is in ${language}.` : "";

    if (useDiarization) {
        const baseInstructions = [
            "Transcribe this audio recording accurately and completely.",
        ];

        if (diarizeHint) {
            // Two-pass mode: we have voice-analysis speaker segments
            baseInstructions.push(
                "",
                diarizeHint,
                "",
                "Use the speaker timing above to label speakers. When a speaker change occurs",
                "at a boundary listed above, start a new speaker turn with the correct label.",
            );
        } else {
            // Fallback: no diarization data, let Gemini guess
            baseInstructions.push(
                "Identify and label every distinct speaker consistently as Speaker 1, Speaker 2, Speaker 3, etc. Detect ALL speakers present — do NOT merge or combine different speakers.",
            );
        }

        baseInstructions.push(
            "",
            "CRITICAL FORMATTING RULES (you MUST follow these):",
            "- Each speaker turn MUST start on its own line as: Speaker N: <text>",
            "- There MUST be exactly one blank line between every speaker turn.",
            "- NEVER merge multiple speaker turns into a single paragraph.",
            "- Preserve this formatting even for very long recordings.",
            "",
            "Do NOT include timestamps, commentary, or analysis — only the verbatim transcription with speaker labels.",
            "IMPORTANT: If you notice yourself repeating the same text, STOP immediately. Never output the same phrase more than twice in a row.",
            `Maintain the original language of the recording.${langHint}`,
        );

        return baseInstructions.join("\n");
    }

    return [
        "Transcribe this audio recording accurately and completely.",
        "Output only the verbatim transcription text. Do NOT include timestamps, speaker labels, commentary, or analysis.",
        `Maintain the original language of the recording.${langHint}`,
    ].join("\n");
}

/**
 * Ensure exactly one blank line between each "Speaker N:" turn,
 * regardless of how Gemini formatted the raw output.
 */
export function ensureSpeakerBlankLines(text: string): string {
    const lines = text.split("\n");
    const result: string[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const isNewSpeakerTurn = /^Speaker\s+\d+:/i.test(line.trimStart());

        if (isNewSpeakerTurn && result.length > 0) {
            // Remove any trailing blank lines before adding exactly one
            while (
                result.length > 0 &&
                result[result.length - 1].trim() === ""
            ) {
                result.pop();
            }
            result.push("");
        }

        result.push(line);
    }

    return result.join("\n").trim();
}

/**
 * Detect and truncate degenerate repetition loops that Gemini sometimes
 * produces on long audio.
 *
 * Real-world loops come in two flavours:
 *   1. **Exact short phrase** repeated thousands of times consecutively
 *      (e.g. "yeah, yeah, yeah. No, no, I know…" ×2 869).
 *   2. **Near-identical multi-speaker block** (500-700 chars) repeated
 *      hundreds of times with tiny variations ("trial" ↔ "trail").
 *
 * The algorithm handles both by extracting a fixed-length needle from each
 * candidate position and counting how many times that needle appears in
 * the *entire* text.  A legitimate 60-char phrase almost never appears 8+
 * times in a real transcript; a looping one appears hundreds of times.
 * When a loop is found we truncate just before the second occurrence.
 *
 * Returns the (possibly truncated) text and a flag.
 */
export function truncateRepetitionLoop(text: string): {
    text: string;
    wasTruncated: boolean;
} {
    if (text.length < NEEDLE_LEN * REPETITION_COUNT_THRESHOLD) {
        return { text, wasTruncated: false };
    }

    // Step size: we don't need to check every single character offset.
    // Scanning every ~NEEDLE_LEN/2 chars is enough to guarantee we'll
    // land inside any repeated block at least once.
    const step = Math.max(1, Math.floor(NEEDLE_LEN / 2));

    for (let start = 0; start <= text.length - NEEDLE_LEN; start += step) {
        const needle = text.substring(start, start + NEEDLE_LEN);

        // Quick reject: if the needle doesn't even appear once more after
        // its first occurrence we can skip immediately.
        const secondOccurrence = text.indexOf(needle, start + 1);
        if (secondOccurrence === -1) continue;

        // Count total occurrences across the whole text.
        let count = 0;
        let pos = 0;
        while (pos <= text.length - NEEDLE_LEN) {
            const idx = text.indexOf(needle, pos);
            if (idx === -1) break;
            count++;
            pos = idx + 1;
            // Early exit once we've confirmed it's a loop
            if (count >= REPETITION_COUNT_THRESHOLD) break;
        }

        if (count >= REPETITION_COUNT_THRESHOLD) {
            // Find the first occurrence of the needle — the loop start
            const firstIdx = text.indexOf(needle);

            // Truncate just before the *second* occurrence so we keep one
            // copy of the content (it may be genuine speech that was then
            // repeated by the model).
            let truncated = text.substring(0, secondOccurrence).trimEnd();

            // Clean up: back up to the last complete speaker turn or
            // sentence boundary so we don't end mid-word.
            const lastSpeakerTurn = truncated.lastIndexOf("\nSpeaker ");
            const lastSentenceEnd = Math.max(
                truncated.lastIndexOf(". "),
                truncated.lastIndexOf(".\n"),
                truncated.lastIndexOf("? "),
                truncated.lastIndexOf("?\n"),
            );
            const cutoff = Math.max(lastSpeakerTurn, lastSentenceEnd);
            if (cutoff > firstIdx) {
                // Only trim back if we're not discarding everything
                truncated = truncated.substring(0, cutoff + 1).trimEnd();
            }

            console.warn(
                `[Gemini] Repetition loop detected: "${needle.replace(/\n/g, "\\n")}" ` +
                    `appeared ${count}+ times (first at char ${firstIdx}, second at ${secondOccurrence}). ` +
                    `Truncated output from ${text.length} → ${truncated.length} chars.`,
            );

            return { text: truncated, wasTruncated: true };
        }
    }

    return { text, wasTruncated: false };
}

/**
 * Vertex AI rejects inline audio payloads beyond roughly 20 MB.  For files
 * above this threshold we re-encode with ffmpeg to a compact 16 kHz mono MP3
 * before sending.  Speech-recognition quality is not meaningfully affected at
 * the bitrates used here.
 */
const LARGE_AUDIO_THRESHOLD_BYTES = 20 * 1024 * 1024; // 20 MB

async function compressAudioIfNeeded(
    audioBuffer: Buffer,
): Promise<{ buffer: Buffer; mimeType: string; wasCompressed: boolean }> {
    if (audioBuffer.length <= LARGE_AUDIO_THRESHOLD_BYTES) {
        return {
            buffer: audioBuffer,
            mimeType: detectAudioFormat(audioBuffer).contentType,
            wasCompressed: false,
        };
    }

    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const { writeFile, readFile, unlink } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const execFileAsync = promisify(execFile);

    const tag = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const inputPath = join(tmpdir(), `betterainote-ffmpeg-in-${tag}.mp3`);
    const outputPath = join(tmpdir(), `betterainote-ffmpeg-out-${tag}.mp3`);

    try {
        await writeFile(inputPath, audioBuffer);
        await execFileAsync(
            "ffmpeg",
            [
                "-i",
                inputPath,
                "-ar",
                "16000",
                "-ac",
                "1",
                "-b:a",
                "16k",
                "-y",
                outputPath,
            ],
            { timeout: 180_000 }, // 3 minutes max
        );
        const compressed = await readFile(outputPath);
        console.log(
            `[Gemini] Audio compressed for large recording: ` +
                `${(audioBuffer.length / 1024 / 1024).toFixed(1)} MB → ${(compressed.length / 1024 / 1024).toFixed(1)} MB`,
        );
        return {
            buffer: compressed,
            mimeType: "audio/mp3",
            wasCompressed: true,
        };
    } finally {
        await Promise.all([
            unlink(inputPath).catch(() => {}),
            unlink(outputPath).catch(() => {}),
        ]);
    }
}

export class GoogleSpeechTranscriptionProvider
    implements TranscriptionProvider
{
    private readonly projectId: string;
    private readonly defaultLocation: string;

    constructor(_apiKey: string, _baseURL?: string) {
        this.projectId = process.env.GOOGLE_PROJECT_ID || "";
        if (!this.projectId) {
            throw new Error(
                "GOOGLE_PROJECT_ID environment variable is required for Gemini provider",
            );
        }
        this.defaultLocation = process.env.GOOGLE_LOCATION || "us-central1";
    }

    /** Gemini 3+ models must use 'global' location on Vertex AI */
    private locationForModel(modelId: string): string {
        if (modelId.startsWith("gemini-3")) {
            return GEMINI3_LOCATION;
        }
        return this.defaultLocation;
    }

    async transcribe(
        audioBuffer: Buffer,
        _filename: string,
        options: TranscriptionOptions,
    ): Promise<TranscriptionResult> {
        // Compress oversized files so Vertex AI accepts them as inline data.
        // Diarization still uses the original on-disk file (options.audioPath).
        const {
            buffer: audioToSend,
            mimeType: effectiveMimeType,
            wasCompressed,
        } = await compressAudioIfNeeded(audioBuffer);

        const useDiarization = options.responseFormat === "diarized_json";

        // --- Pass 1: Voice-fingerprint diarization on the full file ---
        let diarizeResult: DiarizeResult | undefined;
        if (useDiarization && options.audioPath) {
            diarizeResult = await this.tryDiarizeRaw(options.audioPath);
        }

        const modelId = this.resolveModel(options.model);
        const location = this.locationForModel(modelId);
        const ai = new GoogleGenAI({
            vertexai: true,
            project: this.projectId,
            location,
        });

        const diarizeHint = diarizeResult
            ? formatDiarizeHint(diarizeResult)
            : undefined;
        const prompt = buildPrompt(
            useDiarization,
            options.diarizationSpeakers ?? DEFAULT_SPEAKER_COUNT,
            options.language,
            diarizeHint,
        );

        const response = await ai.models.generateContent({
            model: modelId,
            contents: [
                {
                    role: "user",
                    parts: [
                        {
                            inlineData: {
                                mimeType: mimeTypeForGemini(effectiveMimeType),
                                data: audioToSend.toString("base64"),
                            },
                        },
                        { text: prompt },
                    ],
                },
            ],
            config: {
                temperature: 0.15,
                maxOutputTokens: 65536,
                frequencyPenalty: 0.6,
                httpOptions: { timeout: 1_800_000 },
            },
        });

        const raw = response.text?.trim() ?? "";
        const { text: cleaned, wasTruncated } = truncateRepetitionLoop(raw);
        if (wasTruncated) {
            console.warn(
                `[Gemini] Repetition loop removed. Original: ${raw.length} → ${cleaned.length} chars`,
            );
        }
        const text = useDiarization
            ? ensureSpeakerBlankLines(cleaned)
            : cleaned;
        const compressionWarning = wasCompressed
            ? `This recording was large (>${Math.round(LARGE_AUDIO_THRESHOLD_BYTES / 1024 / 1024)} MB) and was automatically compressed to 16 kHz mono before transcription. Accuracy should be fine for speech, but audio quality artefacts or overlapping voices may be less precisely rendered.`
            : undefined;
        return {
            text,
            detectedLanguage: null,
            compressionWarning,
            speakerSegments: mapSpeakerSegments(diarizeResult),
        };
    }

    /**
     * Attempt to run voice-fingerprint diarization.
     * Returns the raw DiarizeResult (for chunk-level hint filtering), or
     * undefined if diarization is unavailable or fails.
     */
    private async tryDiarizeRaw(
        audioPath: string,
    ): Promise<DiarizeResult | undefined> {
        try {
            const available = await isDiarizationAvailable();
            if (!available) {
                console.log(
                    "[Gemini] Diarization runtime not available, falling back to Gemini-only speaker detection",
                );
                return undefined;
            }

            console.log(
                `[Gemini] Running voice-fingerprint diarization on ${audioPath}...`,
            );
            const start = Date.now();
            const result = await runDiarization(audioPath);
            const elapsed = ((Date.now() - start) / 1000).toFixed(1);
            console.log(
                `[Gemini] Diarization complete in ${elapsed}s: ` +
                    `${result.num_speakers} speakers, ${result.segments.length} segments`,
            );
            return result;
        } catch (err) {
            console.warn(
                "[Gemini] Diarization failed, falling back to Gemini-only:",
                err,
            );
            return undefined;
        }
    }

    private resolveModel(model: string): string {
        if (
            model &&
            model !== "latest_long" &&
            !model.includes("whisper") &&
            !model.includes("chirp")
        ) {
            return model;
        }
        return DEFAULT_MODEL;
    }
}
