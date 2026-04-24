/**
 * Speaker diarization wrapper.
 *
 * Calls the Python `diarize` library via child_process to get
 * voice-fingerprint-based speaker segments. These segments are then
 * used to guide Gemini's transcription for accurate speaker attribution.
 */
import { execFile } from "node:child_process";
import { access, constants } from "node:fs/promises";

export interface DiarizeSegment {
    start: number;
    end: number;
    speaker: string;
    duration: number;
}

export interface DiarizeResult {
    num_speakers: number;
    speakers: string[];
    audio_duration: number;
    segments: DiarizeSegment[];
}

const DIARIZE_SCRIPT = "./scripts/run-diarize.py";
const DIARIZE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes max

/**
 * Check whether the Python diarization runtime is available.
 * Returns false if python3 or the diarize script is missing.
 */
export async function isDiarizationAvailable(): Promise<boolean> {
    try {
        await access(DIARIZE_SCRIPT, constants.R_OK);
        return await new Promise((resolve) => {
            execFile(
                "python3",
                ["-c", "import diarize"],
                { timeout: 15_000 },
                (err) => {
                    resolve(!err);
                },
            );
        });
    } catch {
        return false;
    }
}

/**
 * Run speaker diarization on an audio file.
 *
 * @param audioPath Absolute path to the audio file on disk
 * @param options Optional speaker count hints
 * @returns Diarization result with speaker segments and timestamps
 */
export async function runDiarization(
    audioPath: string,
    options?: {
        minSpeakers?: number;
        maxSpeakers?: number;
        numSpeakers?: number;
    },
): Promise<DiarizeResult> {
    const args = [DIARIZE_SCRIPT, audioPath];

    if (options?.numSpeakers != null) {
        args.push("--num-speakers", String(options.numSpeakers));
    } else {
        if (options?.minSpeakers != null) {
            args.push("--min-speakers", String(options.minSpeakers));
        }
        if (options?.maxSpeakers != null) {
            args.push("--max-speakers", String(options.maxSpeakers));
        }
    }

    return new Promise((resolve, reject) => {
        execFile(
            "python3",
            args,
            { timeout: DIARIZE_TIMEOUT_MS, maxBuffer: 50 * 1024 * 1024 },
            (error, stdout, stderr) => {
                if (error) {
                    console.error("[Diarize] stderr:", stderr);
                    reject(new Error(`Diarization failed: ${error.message}`));
                    return;
                }

                try {
                    const result = JSON.parse(stdout) as DiarizeResult;
                    console.log(
                        `[Diarize] Found ${result.num_speakers} speakers ` +
                            `in ${result.audio_duration.toFixed(0)}s audio ` +
                            `(${result.segments.length} segments)`,
                    );
                    resolve(result);
                } catch (parseErr) {
                    reject(
                        new Error(
                            `Failed to parse diarization output: ${parseErr}`,
                        ),
                    );
                }
            },
        );
    });
}

/**
 * Format diarization segments into a prompt hint for Gemini.
 *
 * Produces a human-readable timeline that tells Gemini which speaker
 * is active at which timestamps, based on voice fingerprint analysis.
 */
export function formatDiarizeHint(result: DiarizeResult): string {
    if (result.segments.length === 0) return "";

    // Build per-speaker timeline
    const speakerTimeline = new Map<string, string[]>();
    for (const speaker of result.speakers) {
        speakerTimeline.set(speaker, []);
    }

    for (const seg of result.segments) {
        const startFmt = formatTimestamp(seg.start);
        const endFmt = formatTimestamp(seg.end);
        speakerTimeline.get(seg.speaker)?.push(`${startFmt}-${endFmt}`);
    }

    // Map SPEAKER_00 → Speaker 1, SPEAKER_01 → Speaker 2, etc.
    const lines: string[] = [];
    const sortedSpeakers = [...result.speakers].sort();
    for (let i = 0; i < sortedSpeakers.length; i++) {
        const spk = sortedSpeakers[i];
        const ranges = speakerTimeline.get(spk) ?? [];
        lines.push(`Speaker ${i + 1} (${spk}): ${ranges.join(", ")}`);
    }

    return [
        "SPEAKER TIMING FROM VOICE ANALYSIS (use these to assign speaker labels):",
        ...lines,
        "",
        "Follow these speaker boundaries strictly — they are based on voice",
        "fingerprint analysis and are more reliable than audio similarity alone.",
        `Map: ${sortedSpeakers.map((s, i) => `${s} → Speaker ${i + 1}`).join(", ")}`,
    ].join("\n");
}

function formatTimestamp(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
}
