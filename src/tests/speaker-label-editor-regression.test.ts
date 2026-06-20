import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const OLD_UI_CONTRACT_RE =
    /uikit-|glass-surface|glass-control|bg-muted|text-muted-foreground|<LibrarySearch[\s/>]|<SourceFilterStackStrip[\s/>]|\.\/components\/library-search|\.\/components\/source-filter-stack-strip/;

describe("dashboard speaker label editor regressions", () => {
    const source = readFileSync(
        path.join(
            process.cwd(),
            "src/features/recordings/components/speaker-label-editor.tsx",
        ),
        "utf8",
    );
    const globalsSource = readFileSync(
        path.join(process.cwd(), "src/app/globals.css"),
        "utf8",
    );
    const i18nSource = readFileSync(
        path.join(process.cwd(), "src/lib/i18n.ts"),
        "utf8",
    );

    function extractElementSlice(marker: string, tagName: string) {
        const markerIndex = source.indexOf(marker);
        expect(markerIndex).toBeGreaterThanOrEqual(0);
        const start = source.lastIndexOf(`<${tagName}`, markerIndex);
        const end = source.indexOf(`</${tagName}>`, markerIndex);
        expect(start).toBeGreaterThanOrEqual(0);
        expect(end).toBeGreaterThan(start);
        return source.slice(start, end + tagName.length + 3);
    }

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
        expect(source).not.toContain('className="t-pane"');
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

        const cardStart = source.lastIndexOf("<Card", labelIndex);
        const cardOpeningSlice = source.slice(cardStart, labelIndex + 360);
        const cardInteractionSlice = source.slice(
            cardStart,
            createOptionIndex + createOptionMarker.length,
        );

        expect(cardOpeningSlice).toContain(labelMarker);
        expect(cardOpeningSlice).toContain(
            'data-sot-item="speaker-review-row"',
        );
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
        expect(source).toContain("<Alert");
        expect(source).toContain('variant="destructive"');
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
        expect(source).toContain(
            'return hasLiveNoMatch ? "no-match" : undefined;',
        );
        expect(source).toContain("speakerReview.noMatchingSpeakers");
        const rowSubIndex = source.indexOf(
            'data-sot-part="speaker-review-row-sub"',
        );
        const noMatchBranchIndex = source.indexOf(
            "hasLiveNoMatch",
            rowSubIndex,
        );
        expect(rowSubIndex).toBeGreaterThan(-1);
        expect(noMatchBranchIndex).toBeGreaterThan(rowSubIndex);
        const rowSubSlice = source.slice(
            rowSubIndex,
            noMatchBranchIndex + 2_400,
        );
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
        expect(source).toContain(
            'data-sot-control="speaker-review-inline-name"',
        );
        expect(source).toContain(
            'data-sot-control="speaker-review-inline-cancel"',
        );
        expect(source).toContain(
            'data-sot-control="speaker-review-inline-save"',
        );
        expect(source).toContain('variant="default"');
        expect(source).toContain('t("common.cancel")');
        expect(source).toContain('t("common.save")');
        expect(source).toMatch(/event\.key ===\s*"Escape"/);
        expect(source).toMatch(/event\.key ===\s*"Enter"/);
        expect(source).toMatch(
            /<Field[\s\S]*?data-sot-part="speaker-review-row-meta"[\s\S]*?<FieldContent>[\s\S]*?<Input[\s\S]*?data-spk-input[\s\S]*?<\/FieldContent>\s*<\/Field>\s*<div[\s\S]*?data-sot-part="speaker-review-actions"[\s\S]*?data-spk-cancel[\s\S]*?data-spk-save/,
        );
        expect(source).toMatch(
            /handleAssignProfile\(\s*speaker\.rawLabel,\s*nextProfileId,\s*nextName,\s*\)/,
        );
        expect(source).toMatch(
            /setEditingSpeakerFor\(\(current\) =>\s*current === rawLabel \? null : current,\s*\)/,
        );
    });

    it("uses shadcn speaker review composition instead of globals repaint", () => {
        expect(source).toContain('from "@/components/ui/button";');
        expect(source).toContain('from "@/components/ui/badge";');
        expect(source).toContain('from "@/components/ui/card";');
        expect(source).toContain('from "@/components/ui/alert";');
        expect(source).toContain('from "@/components/ui/toggle-group";');
        expect(source).toContain('from "@/components/ui/field";');
        expect(source).toContain('from "@/components/ui/input-group";');
        expect(source).toContain('from "@/components/ui/empty";');
        for (const primitive of [
            "<Button",
            "<Badge",
            "<Card",
            "<Alert",
            "<ToggleGroup",
            "<Field",
            "<InputGroup",
            "<InputGroupInput",
            "<InputGroupAddon",
            "<InputGroupButton",
            "<Empty",
            "<EmptyHeader",
            "<EmptyMedia",
            "<EmptyTitle",
            "<EmptyDescription",
        ]) {
            expect(source).toContain(primitive);
        }

        for (const selector of [
            '[data-sot-control="speaker-review-inline-name"][data-slot="input"]',
            '[data-sot-control="speaker-review-mapping-input"][data-slot="input"]',
            '[data-sot-panel="speaker-review"] [data-slot="card"]',
            '[data-sot-control="speaker-review-mode"]',
            '[data-sot-control="speaker-review-mode-option"]',
            '[data-sot-panel="speaker-review-merge"][data-slot="card"]',
            '[data-sot-part="speaker-review-merge-empty"]',
            '[data-sot-part="speaker-review-merge-empty-icon"]',
            '[data-sot-part="speaker-review-merge-empty-title"]',
            '[data-sot-part="speaker-review-merge-empty-description"]',
            '[data-sot-control="speaker-review-suggestion"]',
            '[data-sot-part="speaker-review-empty"]',
            '[data-sot-part="speaker-review-voiceprint-pill"]',
        ]) {
            expect(globalsSource).not.toContain(selector);
        }
    });

    it("keeps inline rename and mapping controls wired through shadcn fields", () => {
        const inlineInputIndex = source.indexOf(
            'data-sot-control="speaker-review-inline-name"',
        );
        const mappingInputIndex = source.indexOf(
            'data-sot-control="speaker-review-mapping-input"',
        );
        expect(inlineInputIndex).toBeGreaterThan(-1);
        expect(mappingInputIndex).toBeGreaterThan(-1);

        const inlineSlice = source.slice(
            inlineInputIndex - 1_200,
            inlineInputIndex + 3_200,
        );
        expect(inlineSlice).toContain("<Field");
        expect(inlineSlice).toContain("<FieldLabel");
        expect(inlineSlice).toContain("<FieldContent>");
        expect(inlineSlice).toContain("<Input");
        expect(inlineSlice).toContain("data-spk-input");
        expect(inlineSlice).toContain("autoFocus");
        expect(inlineSlice).toContain("aria-busy={");
        expect(inlineSlice).toMatch(/disabled=\{\s*isSpeakerSaving\s*\}/);
        expect(inlineSlice).toMatch(/event\.key ===\s*"Escape"/);
        expect(inlineSlice).toMatch(/event\.key ===\s*"Enter"/);

        const mappingSlice = source.slice(
            mappingInputIndex - 500,
            mappingInputIndex + 7_000,
        );
        expect(mappingSlice).toContain("<InputGroup");
        expect(mappingSlice).toContain("<InputGroupInput");
        expect(mappingSlice).toContain("<InputGroupAddon");
        expect(mappingSlice).toContain("<InputGroupButton");
        expect(mappingSlice).toContain(
            'data-sot-control="speaker-review-mapping-clear"',
        );
        expect(mappingSlice).toContain("aria-busy={");
        expect(mappingSlice).toContain("disabled={");
        expect(mappingSlice).toContain("onFocus={() =>");
        expect(mappingSlice).toContain("onBlur={() =>");
        expect(mappingSlice).toContain("onChange={(event) =>");
        expect(mappingSlice).not.toContain('data-slot="input"');
    });

    it("uses shadcn Empty for speaker review empty states while keeping SOT anchors", () => {
        const mergeEmpty = extractElementSlice(
            'data-sot-part="speaker-review-merge-empty"',
            "Empty",
        );
        expect(mergeEmpty).toContain("<EmptyHeader>");
        expect(mergeEmpty).toContain("<EmptyMedia");
        expect(mergeEmpty).toContain('variant="icon"');
        expect(mergeEmpty).toContain("<CheckCircle2");
        expect(mergeEmpty).toContain(
            'data-sot-part="speaker-review-merge-empty-icon"',
        );
        expect(mergeEmpty).toContain(
            '<EmptyTitle data-sot-part="speaker-review-merge-empty-title">',
        );
        expect(mergeEmpty).toContain(
            '<EmptyDescription data-sot-part="speaker-review-merge-empty-description">',
        );
        expect(mergeEmpty).not.toContain("<svg");
        expect(mergeEmpty).not.toContain("<p");

        for (const state of [
            "no-detected-speakers",
            "no-samples",
            "no-saved-speakers",
            "no-matching-speakers",
        ]) {
            const emptySlice = extractElementSlice(
                `data-sot-state="${state}"`,
                "Empty",
            );
            expect(emptySlice).toContain(
                'data-sot-part="speaker-review-empty"',
            );
            expect(emptySlice).toContain("<EmptyHeader>");
            expect(emptySlice).toContain("<EmptyTitle>");
            expect(emptySlice).not.toContain("<Card");
        }
    });

    it("keeps speaker review controls and row states after shadcn migration", () => {
        for (const anchor of [
            'data-sot-state="loading"',
            'data-sot-state="error"',
            '? "empty"',
            ': "ready"',
            "data-state={getSpeakerRowState(speaker)}",
            '"confirm-unlink"',
            'data-sot-confirm="speaker-unlink"',
            'data-sot-control="speaker-review-copy-raw"',
            'data-sot-control="speaker-review-refresh"',
            'data-sot-control="speaker-review-play-sample"',
            'data-sot-control="speaker-review-unlink"',
            'data-sot-control="speaker-review-inline-cancel"',
            'data-sot-control="speaker-review-inline-save"',
            'data-sot-control="speaker-review-save-retry"',
            'data-sot-control="speaker-review-suggestion"',
            'data-sot-state="create"',
            'return hasLiveNoMatch ? "no-match" : undefined;',
            "data-open={String(isMergePopoverOpen)}",
            "hidden={!isMergePopoverOpen}",
        ]) {
            expect(source).toContain(anchor);
        }
        expect(source).toMatch(
            /disabled=\{\s*isSpeakerSaving\s*\|\|\s*speaker\.matchedProfileId ===\s*profile\.id\s*\}/,
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
        expect(source).toContain('data-sot-list="speaker-review-rows"');
        expect(source).toContain('data-sot-item="speaker-review-row"');
        expect(source).toContain('data-sot-tone="danger"');
        expect(source).toContain("speakerReview.saveFailedRetry");
        expect(source).toContain('t("common.retry")');
        expect(source).toContain(
            'data-sot-control="speaker-review-save-retry"',
        );
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
        expect(i18nSource).toContain('saveFailedRetry: "保存失败 · 请重试"');
        expect(i18nSource).toContain('saveFailedRetry: "Save failed · retry"');
    });

    it("opens the SOT confirm-unlink state before patching a matched speaker", () => {
        expect(source).toContain("confirmUnlinkFor");
        expect(source).toContain("data-state={");
        expect(source).toContain('"confirm-unlink"');
        expect(source).toContain('data-sot-confirm="speaker-unlink"');
        expect(source).toContain("data-sot-confirm-message");
        expect(source).toContain("data-sot-confirm-subject");
        expect(source).toContain('data-sot-confirm-action="cancel"');
        expect(source).toContain('data-sot-confirm-action="confirm"');
        expect(source).not.toContain('className="sp-confirm"');
        expect(source).not.toContain('className="sp-confirm-msg"');
        expect(source).toContain("speakerReview.confirmUnlinkMessagePrefix");
        expect(source).toContain("speakerReview.confirmUnlinkMessageSuffix");
        expect(source).toContain('variant="ghost"');
        expect(source).toContain('variant="destructive"');
        expect(source).toContain("<ToggleGroup");
        expect(source).toContain("<ToggleGroupItem");
        expect(source).toContain("<Badge");
        expect(source).toContain("<Alert");
        expect(source).toContain("<CardHeader");
        expect(source).not.toContain('className="sp-head"');
        expect(source).not.toContain('className="sp-rows sp-rows-review"');
        expect(source).not.toContain('className="sp-row"');
        expect(source).not.toContain('className="sp-row-meta"');
        expect(source).not.toContain('className="sp-edit-actions"');
        expect(source).not.toContain('className="sp-suggest-row"');
        expect(source).not.toContain('className="sp-vp-pill');
        expect(source).toContain('data-sot-list="speaker-review-meta"');
        expect(source).toContain(
            'data-sot-part="speaker-review-transcript-section"',
        );
        expect(source).toContain(
            'data-sot-list="speaker-review-sample-segments"',
        );
        expect(source).toContain(
            'data-sot-item="speaker-review-sample-segment"',
        );
        expect(source).not.toContain('className="sr-meta"');
        expect(source).not.toContain('className="sr-section"');
        expect(source).not.toContain('className="sr-section-head"');
        expect(source).not.toContain('className="sr-section-sub"');
        expect(source).not.toContain('className="sr-segments"');
        expect(source).not.toContain('className="sr-seg"');
        expect(source).not.toContain('className="sr-seg-speaker"');
        expect(source).not.toContain('className="sr-seg-text"');

        const confirmStart = source.indexOf(
            'data-sot-confirm="speaker-unlink"',
        );
        const confirmEnd = source.indexOf("</Card>", confirmStart);
        const confirmSlice = source.slice(
            confirmStart,
            confirmEnd + "</Card>".length,
        );
        const openConfirmIndex = source.indexOf(
            "setConfirmUnlinkFor(\n                                                                    speaker.rawLabel",
            confirmEnd,
        );
        const directPatchIndex = source.indexOf(
            "void handleAssignProfile(\n                                                                speaker.rawLabel,\n                                                                null,",
            openConfirmIndex,
        );

        expect(confirmSlice).toMatch(
            /<em\s+data-sot-confirm-subject\s*>\s*\{matchedName\}\s*<\/em>/,
        );
        expect(confirmSlice).toContain(
            "handleAssignProfile(\n                                                                    speaker.rawLabel,\n                                                                    null,",
        );
        expect(openConfirmIndex).toBeGreaterThan(confirmEnd);
        expect(directPatchIndex).toBe(-1);
    });
});
