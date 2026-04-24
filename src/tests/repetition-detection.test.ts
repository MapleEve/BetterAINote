import { describe, expect, it } from "vitest";
import { truncateRepetitionLoop } from "@/lib/transcription/providers/google-speech-provider";

describe("truncateRepetitionLoop", () => {
    it("does not truncate normal text", () => {
        const text =
            "Speaker 1: Hello there.\n\nSpeaker 2: Hi, how are you?\n\nSpeaker 1: Good thanks.";
        const result = truncateRepetitionLoop(text);
        expect(result.wasTruncated).toBe(false);
        expect(result.text).toBe(text);
    });

    it("detects and truncates a long repeated phrase (exact match)", () => {
        const good =
            "Speaker 1: This is some real content about the meeting.\n\nSpeaker 2: Yes I agree with that point.";
        const repeated =
            " yeah, yeah, yeah. No, no, I know what I was just pulling your leg. Um,";
        const bad = repeated.repeat(50);
        const input = good + bad;

        const result = truncateRepetitionLoop(input);
        expect(result.wasTruncated).toBe(true);
        expect(result.text.length).toBeLessThan(input.length);
        expect(result.text).toContain("real content about the meeting");
    });

    it("detects repetition even when it starts mid-text", () => {
        const prefix =
            "Speaker 1: Let me explain the architecture.\n\nSpeaker 2: Sure, go ahead.\n\nSpeaker 1: So we have the frontend and backend.";
        const loop =
            " And then we repeat this process over and over again and keep on going until done.";
        const input = prefix + loop.repeat(20);

        const result = truncateRepetitionLoop(input);
        expect(result.wasTruncated).toBe(true);
        expect(result.text).toContain("Let me explain the architecture");
    });

    it("handles the exact pattern from real bug #1 (exact short phrase x2869)", () => {
        const good = [
            "Speaker 1: All right. Hello.",
            "",
            "Speaker 6: And, and I think Justin is not happy.",
            "",
            "Speaker 1: That's one for no.",
            "",
            "Speaker 6: No, no, I know what I was just pulling your leg.",
        ].join("\n");

        const loopPhrase =
            " Um, yeah, yeah, yeah. No, no, I know what I was just pulling your leg.";
        const input = good + loopPhrase.repeat(2869);

        const result = truncateRepetitionLoop(input);
        expect(result.wasTruncated).toBe(true);
        // 95%+ of the original garbage should be gone
        expect(result.text.length).toBeLessThan(input.length * 0.1);
        // Good content preserved
        expect(result.text).toContain("And, and I think Justin is not happy");
    });

    it("handles real bug #2: near-identical multi-speaker block with tiny variations", () => {
        // The real pattern: a ~639-char Speaker 4 + Speaker 5 exchange that repeats
        // with tiny variations ("trial" vs "trail") across repetitions
        const good = [
            "Speaker 1: Let's discuss the workflow.",
            "",
            "Speaker 2: I think we need proper approval.",
            "",
            "Speaker 3: Agreed, let's figure it out.",
        ].join("\n");

        // Block A (first occurrence - slightly different)
        const blockVariantA = [
            "",
            "",
            "Speaker 5: Cool. Uh right now, I think they are thinking of a of offline approval. So which could be tricky. I uh so so when A is in office this week and next week, so they are planning to discuss it further. So I'll also highlight again that we need to have a proper proper workflow around it so that it doesn't get lost somewhere and then we can't find it.",
            "",
            "Speaker 4: I yeah, my gut feel is that it should be an application level acceptance. That should be tracked and stored against that because if we ever need to audit for it, having to then go back and find an an email trial or something doesn't really add up to me. Um but yeah.",
        ].join("\n");

        // Block B (repeated ~394 times - slightly different word)
        const blockVariantB = [
            "",
            "",
            "Speaker 5: Cool. Uh right now, I think they are thinking of a of offline approval. So which could be tricky. I uh so so when A is in office this week and next week, so they are planning to discuss it further. So I'll also highlight again that we need to have a proper proper workflow around it so that it doesn't get lost somewhere and then we can't find it.",
            "",
            "Speaker 4: I yeah, my gut feel is that it should be an application level acceptance. That should be tracked and stored against that because if we ever need to audit for it, having to then go back and find an an email trail or something doesn't really add up to me. Um but yeah.",
        ].join("\n");

        const input = good + blockVariantA + blockVariantB.repeat(394);

        const result = truncateRepetitionLoop(input);
        expect(result.wasTruncated).toBe(true);
        // Should keep the good content and at most one copy of the block
        expect(result.text.length).toBeLessThan(
            good.length + blockVariantA.length + blockVariantB.length + 100,
        );
        expect(result.text).toContain("Let's discuss the workflow");
        expect(result.text).toContain("proper approval");
    });

    it("does not false-positive on short natural repetitions", () => {
        const text = [
            "Speaker 1: Yeah yeah yeah, I agree.",
            "",
            "Speaker 2: Yeah yeah, definitely.",
            "",
            "Speaker 1: So yeah, let's move on.",
        ].join("\n");

        const result = truncateRepetitionLoop(text);
        expect(result.wasTruncated).toBe(false);
        expect(result.text).toBe(text);
    });

    it("does not false-positive on repeated speaker labels with different content", () => {
        const topics = [
            "the quarterly revenue figures look promising this cycle",
            "our hiring pipeline needs attention before the freeze",
            "the infrastructure migration is ahead of schedule",
            "customer feedback on the new feature was overwhelmingly positive",
            "we should revisit the API rate-limiting strategy soon",
            "the design team presented three new mockups yesterday",
            "compliance requirements changed again last Friday",
            "staging environment performance has degraded noticeably",
            "the partnership deal with Acme Corp is moving forward",
            "we need better monitoring for the payment processing flow",
            "the mobile app crash rate spiked after Tuesday release",
            "documentation backlog is growing faster than we can address",
            "the security audit findings were mostly minor issues",
            "our NPS score improved by twelve points this quarter",
            "the data pipeline latency issue was root-caused to DNS",
            "marketing wants to launch the campaign two weeks early",
            "the support ticket volume doubled during the outage",
            "we are evaluating three vendor proposals for the CRM switch",
            "the onboarding flow conversion rate needs AB testing",
            "budget approvals for next quarter are due by Friday",
        ];
        const text = topics
            .map((t, i) => `Speaker ${(i % 3) + 1}: ${t}`)
            .join("\n\n");

        const result = truncateRepetitionLoop(text);
        expect(result.wasTruncated).toBe(false);
    });

    it("returns empty string info for empty input", () => {
        const result = truncateRepetitionLoop("");
        expect(result.wasTruncated).toBe(false);
        expect(result.text).toBe("");
    });

    it("handles repetition that starts very early", () => {
        const good =
            "Speaker 1: Hi. Speaker 2: Hello there, how are you today my friend?";
        const loop =
            " This is a repeated sentence that goes on and on and on and keeps repeating endlessly.";
        const input = good + loop.repeat(30);

        const result = truncateRepetitionLoop(input);
        expect(result.wasTruncated).toBe(true);
        expect(result.text).toContain("Hi.");
    });

    it("does not false-positive on a phrase that appears a few times naturally", () => {
        // "I think" might appear 5-6 times in a real meeting - should not trigger
        const turns = [
            "Speaker 1: I think we should start with the frontend. I think that's the priority.",
            "Speaker 2: I think so too. Let me check the timeline.",
            "Speaker 1: I think the backend can wait until next sprint.",
            "Speaker 3: I think we need more context. Can you elaborate?",
            "Speaker 1: I think the key issue is performance. I think we measured it last week.",
            "Speaker 2: I think you're right about that. Let me pull up the data.",
            "Speaker 3: I think the numbers speak for themselves actually.",
        ];
        const text = turns.join("\n\n");

        const result = truncateRepetitionLoop(text);
        expect(result.wasTruncated).toBe(false);
    });
});
