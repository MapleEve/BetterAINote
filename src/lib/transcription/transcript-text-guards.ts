/**
 * Minimum number of total occurrences of a substring across the full text
 * before we consider it a degenerate loop. Set conservatively to avoid
 * false positives on phrases that legitimately recur a few times.
 */
const REPETITION_COUNT_THRESHOLD = 8;

/**
 * The substring we search for must be long enough that normal filler or shared
 * structural patterns do not trigger detection.
 */
const NEEDLE_LEN = 100;

/**
 * Ensure exactly one blank line between each "Speaker N:" turn.
 */
export function ensureSpeakerBlankLines(text: string): string {
    const lines = text.split("\n");
    const result: string[] = [];

    for (const line of lines) {
        const isNewSpeakerTurn = /^Speaker\s+\d+:/i.test(line.trimStart());

        if (isNewSpeakerTurn && result.length > 0) {
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
 * Detect and truncate degenerate repetition loops that transcription models can
 * produce on long audio.
 */
export function truncateRepetitionLoop(text: string): {
    text: string;
    wasTruncated: boolean;
} {
    if (text.length < NEEDLE_LEN * REPETITION_COUNT_THRESHOLD) {
        return { text, wasTruncated: false };
    }

    const step = Math.max(1, Math.floor(NEEDLE_LEN / 2));

    for (let start = 0; start <= text.length - NEEDLE_LEN; start += step) {
        const needle = text.substring(start, start + NEEDLE_LEN);
        const secondOccurrence = text.indexOf(needle, start + 1);
        if (secondOccurrence === -1) continue;

        let count = 0;
        let pos = 0;
        while (pos <= text.length - NEEDLE_LEN) {
            const idx = text.indexOf(needle, pos);
            if (idx === -1) break;
            count++;
            pos = idx + 1;
            if (count >= REPETITION_COUNT_THRESHOLD) break;
        }

        if (count >= REPETITION_COUNT_THRESHOLD) {
            const firstIdx = text.indexOf(needle);
            let truncated = text.substring(0, secondOccurrence).trimEnd();

            const lastSpeakerTurn = truncated.lastIndexOf("\nSpeaker ");
            const lastSentenceEnd = Math.max(
                truncated.lastIndexOf(". "),
                truncated.lastIndexOf(".\n"),
                truncated.lastIndexOf("? "),
                truncated.lastIndexOf("?\n"),
            );
            const cutoff = Math.max(lastSpeakerTurn, lastSentenceEnd);
            if (cutoff > firstIdx) {
                truncated = truncated.substring(0, cutoff + 1).trimEnd();
            }

            console.warn(
                `[Transcription] Repetition loop detected: "${needle.replace(/\n/g, "\\n")}" ` +
                    `appeared ${count}+ times (first at char ${firstIdx}, second at ${secondOccurrence}). ` +
                    `Truncated output from ${text.length} to ${truncated.length} chars.`,
            );

            return { text: truncated, wasTruncated: true };
        }
    }

    return { text, wasTruncated: false };
}
