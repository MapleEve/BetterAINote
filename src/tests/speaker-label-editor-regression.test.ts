import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const OLD_UI_CONTRACT_RE =
    /uikit-|glass-surface|glass-control|bg-muted|text-muted-foreground|CardContent|<LibrarySearch[\s/>]|<SourceFilterStackStrip[\s/>]|\.\/components\/library-search|\.\/components\/source-filter-stack-strip/;

describe("dashboard speaker label editor regressions", () => {
    const source = readFileSync(
        path.join(
            process.cwd(),
            "src/features/recordings/components/speaker-label-editor.tsx",
        ),
        "utf8",
    );
    const i18nSource = readFileSync(
        path.join(process.cwd(), "src/lib/i18n.ts"),
        "utf8",
    );

    it("keeps transcript review visible when there are no saved speaker mappings", () => {
        expect(source).not.toContain(
            "if (speakers.length === 0) {\n        return null;",
        );
        expect(source).toContain("speakerReview.noDetectedSpeakers");
    });

    it("keeps speaker sample cards on stable review semantics", () => {
        expect(source).toContain('data-sot-panel="speaker-review"');
        expect(source).toContain(
            "data-sot-speaker-has-playable-sample={String(",
        );
        expect(source).toContain("speaker.sampleSegments.map");
        expect(source).toContain("handlePlaySample(");
        expect(source).toContain("speakerReview.samplesTitle");
        expect(source).toContain("speakerReview.playSample");
        expect(source).not.toMatch(/\bbg-(background|card|muted)\b/);
        expect(source).not.toMatch(OLD_UI_CONTRACT_RE);
    });

    it("uses the muted transcript preview surface during speaker review", () => {
        const previewMarker = "{activeReview.text}";
        const previewIndex = source.indexOf(previewMarker);
        expect(previewIndex).toBeGreaterThan(-1);

        const previewSlice = source.slice(
            previewIndex - 520,
            previewIndex + 260,
        );

        expect(previewSlice).toContain(previewMarker);
        expect(source).toContain("speakerReview.wordCount");
        expect(source).toContain("speakerReview.characterCount");
        expect(source).toContain("speakerReview.mappedNamesCount");
        expect(source).toContain('data-sot-panel="speaker-review"');
        expect(source).toContain("<section");
        expect(previewSlice).not.toMatch(/\bbg-(background|card|muted)\b/);
        expect(previewSlice).not.toMatch(OLD_UI_CONTRACT_RE);
    });

    it("uses the shared speaker review card surface without dropping interactions", () => {
        const labelMarker = "data-sot-speaker-label={speaker.rawLabel}";
        const createOptionMarker = "speakerReview.createSpeaker";
        const labelIndex = source.indexOf(labelMarker);
        const createOptionIndex = source.indexOf(createOptionMarker);

        expect(labelIndex).toBeGreaterThan(-1);
        expect(createOptionIndex).toBeGreaterThan(labelIndex);

        const cardStart = source.lastIndexOf("<div", labelIndex);
        const cardOpeningSlice = source.slice(cardStart, labelIndex + 360);
        const cardInteractionSlice = source.slice(
            cardStart,
            createOptionIndex + createOptionMarker.length,
        );

        expect(cardOpeningSlice).toContain(labelMarker);
        expect(cardOpeningSlice).toContain("data-sot-speaker-mapped={String(");
        expect(cardOpeningSlice).toContain(
            "data-sot-speaker-has-playable-sample={String(",
        );
        expect(cardOpeningSlice).toContain(
            "data-sot-speaker-has-voiceprint={String(",
        );
        expect(cardOpeningSlice).not.toMatch(/\bbg-(background|card|muted)\b/);
        expect(cardOpeningSlice).not.toMatch(OLD_UI_CONTRACT_RE);

        expect(cardInteractionSlice).toContain("setOpenPickerFor(");
        expect(cardInteractionSlice).toContain("profile.displayName");
        expect(cardInteractionSlice).toContain(createOptionMarker);
        expect(cardInteractionSlice).toContain("normalizedQuery");
        expect(cardInteractionSlice).toContain("speakerReview.createSpeaker");
    });

    it("keeps speaker list load failures distinct from empty state", () => {
        expect(source).toContain("speakerLoadError");
        expect(source).toContain('role="alert"');
        expect(source).toContain("onClick={() => void refreshSpeakers()}");
        expect(source).toContain("speakerLoadError ? (");
        expect(source).toContain(") : speakers.length === 0 ? (");
    });

    it("disables mapping inputs and picker options while a speaker mapping is saving", () => {
        expect(source).toContain("const isSpeakerSaving =");
        const inputMarker = "speakerReview.searchOrCreateSpeakerPlaceholder";
        const profileOptionMarker = "speaker.matchedProfileId ===";
        const createOptionMarker = "speakerReview.createSpeaker";
        const inputIndex = source.indexOf(inputMarker);
        const profileOptionIndex = source.indexOf(profileOptionMarker);
        const createOptionIndex = source.indexOf(createOptionMarker);
        const inputSlice = source.slice(inputIndex - 360, inputIndex + 620);

        expect(inputIndex).toBeGreaterThan(-1);
        expect(profileOptionIndex).toBeGreaterThan(-1);
        expect(createOptionIndex).toBeGreaterThan(-1);
        expect(inputSlice).toMatch(/disabled=\{\s*isSpeakerSaving\s*\}/);
        expect(source).toMatch(
            /disabled=\{\s*isSpeakerSaving\s*\|\|\s*speaker\.matchedProfileId ===\s*profile\.id\s*\}[\s\S]*?handleAssignProfile\(\s*speaker\.rawLabel,\s*profile\.id/,
        );
        expect(source).toMatch(
            /disabled=\{\s*isSpeakerSaving\s*\}[\s\S]*?handleAssignProfile\(\s*speaker\.rawLabel,\s*null,\s*normalizedQuery/,
        );
    });

    it("exposes a reachable live no-match row state for unmapped open selections", () => {
        expect(source).toContain("const getSpeakerRowState = useCallback(");
        expect(source).toContain("data-state={getSpeakerRowState(speaker)}");
        expect(source).toContain('return hasLiveNoMatch ? "no-match" : undefined;');
        expect(source).toContain("speakerReview.noMatchingSpeakers");
        const rowSubIndex = source.indexOf('className="sp-row-sub mono"');
        expect(rowSubIndex).toBeGreaterThan(-1);
        const rowSubEndIndex = source.indexOf("</div>", rowSubIndex);
        expect(rowSubEndIndex).toBeGreaterThan(rowSubIndex);
        const rowSubSlice = source.slice(rowSubIndex, rowSubEndIndex);
        expect(rowSubSlice).toContain("hasLiveNoMatch");
        expect(rowSubSlice).toContain("speakerReview.noMatchingSpeakers");
        expect(rowSubSlice).toContain("speakerReview.notMappedYet");
        expect(source).not.toMatch(
            /filteredProfiles\.length ===\s*0\s*&&\s*normalizedQuery\s*&&\s*hasExactMatch/,
        );

        const predicateIndex = source.indexOf("filteredProfiles.length === 0");
        expect(predicateIndex).toBeGreaterThan(-1);
        const predicateSlice = source.slice(
            predicateIndex - 520,
            predicateIndex + 120,
        );
        expect(predicateSlice).toContain("const hasLiveNoMatch =");
        expect(predicateSlice).toContain("isPickerOpen");
        expect(predicateSlice).toContain("!speaker.matchedProfileId");
        expect(predicateSlice).toContain("normalizedQuery.length > 0");
        expect(predicateSlice).toContain("profiles.length > 0");
        expect(predicateSlice).not.toContain("hasExactMatch");
    });

    it("keeps saved-speaker no-match copy localized", () => {
        expect(i18nSource).toContain(
            'noMatchingSpeakers: "没有匹配的已保存说话人"',
        );
        expect(i18nSource).toContain(
            'noMatchingSpeakers: "No matching saved speakers"',
        );
    });

    it("keeps the SOT inline rename row wired to the speaker PATCH path", () => {
        expect(source).toContain("editingSpeakerFor");
        expect(source).toContain("speakerNameDrafts");
        expect(source).toContain("const openInlineRename = useCallback(");
        expect(source).toContain("const closeInlineRename = useCallback(");
        expect(source).toContain("const handleSaveInlineRename = useCallback(");
        expect(source).toContain('return "editing";');
        expect(source).toContain('return "saving";');
        expect(source).toContain("data-spk-rename");
        expect(source).toContain("data-spk-input");
        expect(source).toContain("data-spk-cancel");
        expect(source).toContain("data-spk-save");
        expect(source).toContain('variant="primary"');
        expect(source).toContain('t("common.cancel")');
        expect(source).toContain('t("common.save")');
        expect(source).toMatch(/event\.key ===\s*"Escape"/);
        expect(source).toMatch(/event\.key ===\s*"Enter"/);
        expect(source).toMatch(
            /<div className="sp-row-meta">[\s\S]*?<Input[\s\S]*?data-spk-input[\s\S]*?<\/div>\s*<div className="sp-edit-actions">[\s\S]*?data-spk-cancel[\s\S]*?data-spk-save/,
        );
        expect(source).toMatch(
            /handleAssignProfile\(\s*speaker\.rawLabel,\s*nextProfileId,\s*nextName,\s*\)/,
        );
        expect(source).toMatch(
            /setEditingSpeakerFor\(\(current\) =>\s*current === rawLabel \? null : current,\s*\)/,
        );
    });

    it("keeps live speaker save failures on a row-level error state", () => {
        expect(source).toContain("interface SpeakerSaveError");
        expect(source).toContain("profileName: string | undefined;");
        expect(source).toMatch(
            /const \[speakerSaveErrors, setSpeakerSaveErrors\] = useState</,
        );
        expect(source).toContain("Record<string, SpeakerSaveError>");
        expect(source).toContain("[rawLabel]: failedPayload");
        expect(source).toContain('return "error";');
        expect(source).toContain("<ul className=\"sp-rows sp-rows-review\">");
        expect(source).toContain("<li");
        expect(source).toContain('className="sp-row-sub is-danger"');
        expect(source).toContain("speakerReview.saveFailedRetry");
        expect(source).toContain('t("common.retry")');
        expect(source).toMatch(
            /handleAssignProfile\(\s*saveError\.rawLabel,\s*saveError\.profileId,\s*saveError\.profileName,/,
        );
    });

    it("keeps speaker patch failures from being toast-only", () => {
        const handlerStart = source.indexOf(
            "const handleAssignProfile = useCallback(",
        );
        const handlerEnd = source.indexOf(
            "const handleCopyRawTranscript = useCallback",
            handlerStart,
        );
        const handlerSlice = source.slice(handlerStart, handlerEnd);
        const nonOkIndex = handlerSlice.indexOf("if (!response.ok)");
        const nonOkSlice = handlerSlice.slice(nonOkIndex, nonOkIndex + 420);
        const catchIndex = handlerSlice.indexOf("} catch {");
        const catchSlice = handlerSlice.slice(catchIndex, catchIndex + 180);

        expect(handlerStart).toBeGreaterThan(-1);
        expect(handlerEnd).toBeGreaterThan(handlerStart);
        expect(nonOkIndex).toBeGreaterThan(-1);
        expect(nonOkSlice).toContain("markSaveError();");
        expect(nonOkSlice).toContain("toast.error(");
        expect(handlerSlice).toContain("setOpenPickerFor((current)");
        expect(handlerSlice).toContain("setConfirmUnlinkFor((current)");
        expect(catchSlice).toContain("markSaveError();");
        expect(catchSlice).toContain("toast.error(");
    });

    it("keeps speaker save failure retry copy localized", () => {
        expect(i18nSource).toContain('retry: "重试"');
        expect(i18nSource).toContain('retry: "Retry"');
        expect(i18nSource).toContain(
            'saveFailedRetry: "保存失败 · 请重试"',
        );
        expect(i18nSource).toContain('saveFailedRetry: "Save failed · retry"');
    });

    it("opens the SOT confirm-unlink state before patching a matched speaker", () => {
        expect(source).toContain("confirmUnlinkFor");
        expect(source).toContain('data-state={');
        expect(source).toContain('"confirm-unlink"');
        expect(source).toContain('className="sp-confirm"');
        expect(source).toContain('className="sp-confirm-msg"');
        expect(source).toContain("<em>{matchedName}</em>");
        expect(source).toContain("speakerReview.confirmUnlinkMessagePrefix");
        expect(source).toContain("speakerReview.confirmUnlinkMessageSuffix");
        expect(source).toContain('variant="ghost"');
        expect(source).toContain('variant="danger"');

        const confirmStart = source.indexOf('className="sp-confirm"');
        const confirmEnd = source.indexOf("</div>", confirmStart);
        const confirmSlice = source.slice(confirmStart, confirmEnd + 6);
        const openConfirmIndex = source.indexOf(
            "setConfirmUnlinkFor(\n                                                                    speaker.rawLabel",
            confirmEnd,
        );
        const directPatchIndex = source.indexOf(
            "void handleAssignProfile(\n                                                                speaker.rawLabel,\n                                                                null,",
            openConfirmIndex,
        );

        expect(confirmSlice).toContain(
            "handleAssignProfile(\n                                                                    speaker.rawLabel,\n                                                                    null,",
        );
        expect(openConfirmIndex).toBeGreaterThan(confirmEnd);
        expect(directPatchIndex).toBe(-1);
    });
});
