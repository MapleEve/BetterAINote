import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const OLD_UI_CONTRACT_RE =
    /uikit-|glass-surface|glass-control|bg-muted|text-muted-foreground|<LibrarySearch[\s/>]|<SourceFilterStackStrip[\s/>]|\.\/components\/library-search|\.\/components\/source-filter-stack-strip/;
const SPEAKER_REVIEW_MERGE_POPOVER_PLACEMENT =
    "absolute right-0 top-[calc(100%+0.5rem)] z-[var(--z-popover-inline)] w-[320px] min-w-[280px]";

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
    const alertPrimitiveSource = readFileSync(
        path.join(process.cwd(), "src/components/ui/alert.tsx"),
        "utf8",
    );
    const buttonPrimitiveSource = readFileSync(
        path.join(process.cwd(), "src/components/ui/button.tsx"),
        "utf8",
    );
    const emptyPrimitiveSource = readFileSync(
        path.join(process.cwd(), "src/components/ui/empty.tsx"),
        "utf8",
    );
    const inputGroupPrimitiveSource = readFileSync(
        path.join(process.cwd(), "src/components/ui/input-group.tsx"),
        "utf8",
    );
    const toggleGroupPrimitiveSource = readFileSync(
        path.join(process.cwd(), "src/components/ui/toggle-group.tsx"),
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

    function collectOpeningElements(tagName: string) {
        const openings: string[] = [];
        let searchFrom = 0;

        while (searchFrom < source.length) {
            const start = source.indexOf(`<${tagName}`, searchFrom);
            if (start < 0) break;

            let braceDepth = 0;
            let quote: '"' | "'" | "`" | null = null;
            let end = -1;

            for (
                let index = start + tagName.length + 1;
                index < source.length;
                index += 1
            ) {
                const character = source[index];
                const previous = source[index - 1];

                if (quote) {
                    if (character === quote && previous !== "\\") {
                        quote = null;
                    }
                    continue;
                }

                if (
                    character === '"' ||
                    character === "'" ||
                    character === "`"
                ) {
                    quote = character;
                    continue;
                }

                if (character === "{") {
                    braceDepth += 1;
                    continue;
                }

                if (character === "}") {
                    braceDepth = Math.max(0, braceDepth - 1);
                    continue;
                }

                if (character === ">" && braceDepth === 0) {
                    end = index;
                    break;
                }
            }

            expect(end).toBeGreaterThan(start);
            openings.push(source.slice(start, end + 1));
            searchFrom = end + 1;
        }

        return openings;
    }

    function collectExactOpeningElements(tagName: string) {
        const exactTagPattern = new RegExp(`^<${tagName}(?:\\s|>)`);

        return collectOpeningElements(tagName).filter((opening) =>
            exactTagPattern.test(opening),
        );
    }

    function stripOwnerLocalSurfaceDefinitions(value: string) {
        const start = value.indexOf("const SPEAKER_REVIEW_CARD_CLASS_NAMES =");
        const end = value.indexOf("function formatSegmentWindow", start);

        expect(start).toBeGreaterThanOrEqual(0);
        expect(end).toBeGreaterThan(start);

        return value.slice(0, start) + value.slice(end);
    }

    function collectSpeakerReviewButtonOpenings() {
        return collectOpeningElements("Button").filter(
            (opening) =>
                opening.includes("speaker-review") ||
                opening.includes("data-sot-confirm-action") ||
                opening.includes("data-spk-merge-close"),
        );
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
        expect(stripOwnerLocalSurfaceDefinitions(source)).not.toMatch(
            OLD_UI_CONTRACT_RE,
        );
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
        expect(source).toContain('variant="speakerReviewError"');
        expect(source).toContain('density="speakerReviewError"');
        expect(source).toContain('layout="speakerReviewError"');
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
        expect(source).toContain('variant="speakerReviewGhostAction"');
        expect(source).toContain('variant="speakerReviewPrimaryAction"');
        expect(source).toContain('size="speakerReviewAction"');
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

        for (const token of [
            "speakerReviewAction:",
            "speakerReviewPrimaryAction:",
            "speakerReviewGhostAction:",
            "speakerReviewDangerAction:",
            "speakerReviewSuggestion:",
            "speakerReviewIconAction:",
            "speakerReviewAction:",
            "speakerReviewSuggestion:",
            "speakerReviewIcon:",
        ]) {
            expect(buttonPrimitiveSource).toContain(token);
        }
        for (const token of [
            "const SPEAKER_REVIEW_CARD_CLASS_NAMES =",
            "const SPEAKER_REVIEW_CARD_HEADER_CLASS_NAMES =",
            "const SPEAKER_REVIEW_CARD_TITLE_CLASS_NAMES =",
            "const SPEAKER_REVIEW_CARD_CONTENT_CLASS_NAMES =",
            "const SPEAKER_REVIEW_CARD_DESCRIPTION_CLASS_NAME =",
            "const SPEAKER_REVIEW_CARD_ACTION_CLASS_NAME =",
            "const SPEAKER_REVIEW_VOICEPRINT_BADGE_CLASS_NAME =",
            "function SpeakerReviewCard(",
            "function SpeakerReviewCardHeader(",
            "function SpeakerReviewCardTitle(",
            "function SpeakerReviewCardDescription(",
            "function SpeakerReviewCardAction(",
            "function SpeakerReviewCardContent(",
            "function SpeakerReviewVoiceprintBadge(",
            "data-[sot-tone=ready]",
            "data-[sot-tone=missing]",
            "data-[sot-tone=selected]",
        ]) {
            expect(source).toContain(token);
        }
        for (const legacyVariant of [
            "speakerReviewTranscript",
            "speakerReviewRow",
            "speakerReviewMergePopover",
            "speakerReviewConfirm",
            "speakerReviewTitle",
            "speakerReviewMergeTitle",
            "speakerReviewDescription",
            "speakerReviewActions",
            "speakerReviewVoiceprint",
        ]) {
            expect(source).not.toContain(`variant="${legacyVariant}"`);
        }
        expect(alertPrimitiveSource).toContain("speakerReviewError:");
        expect(toggleGroupPrimitiveSource).toContain("speakerReviewMode:");
        expect(toggleGroupPrimitiveSource).toContain("speakerReviewModeItem:");
        expect(inputGroupPrimitiveSource).toContain(
            "speakerReviewMappingClear:",
        );
        for (const token of [
            "speakerReviewMerge:",
            "speakerReviewDetected:",
            "speakerReviewInline:",
            "speakerReviewState:",
            "speakerReviewMergeIcon:",
        ]) {
            expect(emptyPrimitiveSource).toContain(token);
        }
    });

    it("uses speaker review owner-local surfaces for this slice", () => {
        const modeToggle = extractElementSlice(
            'data-sot-control="speaker-review-mode"',
            "ToggleGroup",
        );
        expect(modeToggle).toContain('variant="speakerReviewMode"');
        expect(modeToggle).toContain('size="speakerReviewModeItem"');
        expect(modeToggle).toContain('layout="speakerReviewMode"');
        expect(modeToggle).toContain('spacing="speakerReviewMode"');
        expect(modeToggle).not.toContain('size="sm"');
        expect(modeToggle).not.toContain("spacing={1}");
        expect(modeToggle).not.toContain('className="flex-nowrap"');

        const modeOptionOpenings = collectOpeningElements(
            "ToggleGroupItem",
        ).filter((opening) =>
            opening.includes('data-sot-control="speaker-review-mode-option"'),
        );
        expect(modeOptionOpenings).toHaveLength(2);
        for (const opening of modeOptionOpenings) {
            expect(opening).not.toContain('className="px-2.5"');
        }

        const buttonOpenings = collectSpeakerReviewButtonOpenings();
        expect(buttonOpenings.length).toBeGreaterThan(0);
        for (const opening of buttonOpenings) {
            expect(opening).not.toContain('variant="ghost"');
            expect(opening).not.toContain('variant="default"');
            expect(opening).not.toContain('variant="destructive"');
            expect(opening).not.toContain('variant="outline"');
            expect(opening).not.toContain('size="sm"');
        }

        for (const { control, variant, size } of [
            {
                control: 'data-sot-control="speaker-review-copy-raw"',
                variant: 'variant="speakerReviewPrimaryAction"',
                size: 'size="speakerReviewAction"',
            },
            {
                control: 'data-sot-control="speaker-review-refresh"',
                variant: 'variant="speakerReviewGhostAction"',
                size: 'size="speakerReviewAction"',
            },
            {
                control: 'data-sot-control="speaker-review-inline-save"',
                variant: 'variant="speakerReviewPrimaryAction"',
                size: 'size="speakerReviewAction"',
            },
            {
                control: 'data-sot-control="speaker-review-unlink"',
                variant: 'variant="speakerReviewDangerAction"',
                size: 'size="speakerReviewAction"',
            },
            {
                control: 'data-sot-control="speaker-review-suggestion"',
                variant: 'variant="speakerReviewSuggestion"',
                size: 'size="speakerReviewSuggestion"',
            },
        ]) {
            const opening = collectOpeningElements("Button").find((element) =>
                element.includes(control),
            );
            expect(opening).toBeDefined();
            expect(opening).toContain(variant);
            expect(opening).toContain(size);
        }

        const cardOpenings = collectExactOpeningElements("SpeakerReviewCard");
        expect(
            cardOpenings.find((opening) =>
                opening.includes(
                    'data-sot-part="speaker-review-transcript-card"',
                ),
            ),
        ).toContain('surface="transcript"');
        expect(
            cardOpenings.find((opening) =>
                opening.includes('data-sot-item="speaker-review-row"'),
            ),
        ).toContain('surface="row"');
        expect(
            cardOpenings.find((opening) =>
                opening.includes('data-sot-panel="speaker-review-merge"'),
            ),
        ).toContain('surface="mergePopover"');
        const mergePopoverOpening = cardOpenings.find((opening) =>
            opening.includes('data-sot-panel="speaker-review-merge"'),
        );
        expect(mergePopoverOpening).toBeDefined();
        expect(mergePopoverOpening).toContain("id={mergePopoverId}");
        expect(mergePopoverOpening).toContain("data-spk-merge-pop");
        expect(mergePopoverOpening).toContain(
            "data-open={String(isMergePopoverOpen)}",
        );
        expect(mergePopoverOpening).toContain("hidden={!isMergePopoverOpen}");
        expect(mergePopoverOpening).toContain('role="dialog"');
        expect(mergePopoverOpening).toContain('aria-label="合并相似说话人"');
        expect(mergePopoverOpening).not.toContain(
            `className="${SPEAKER_REVIEW_MERGE_POPOVER_PLACEMENT}"`,
        );
        expect(source).toContain(SPEAKER_REVIEW_MERGE_POPOVER_PLACEMENT);
        expect(source).not.toContain(
            `className="${SPEAKER_REVIEW_MERGE_POPOVER_PLACEMENT}"`,
        );

        // The feature keeps only the relative anchor shell; owner-local Card wrapper owns popover placement.
        const mergeAnchorOpening = collectOpeningElements("div").find(
            (opening) =>
                opening.includes('data-sot-part="speaker-review-merge-anchor"'),
        );
        expect(mergeAnchorOpening).toContain(
            'className="relative inline-flex"',
        );
        expect(mergeAnchorOpening).toContain("ref={mergeAnchorRef}");
        const mergeTriggerOpening = collectOpeningElements("Button").find(
            (opening) =>
                opening.includes('data-sot-control="speaker-review-merge"'),
        );
        expect(mergeTriggerOpening).toContain("aria-controls={mergePopoverId}");
        expect(mergeTriggerOpening).toContain(
            "aria-expanded={isMergePopoverOpen}",
        );
        expect(
            cardOpenings.find((opening) =>
                opening.includes('data-sot-confirm="speaker-unlink"'),
            ),
        ).toContain('surface="confirm"');
        for (const opening of cardOpenings.filter((element) =>
            /speaker-review|speaker-unlink/.test(element),
        )) {
            expect(opening).not.toContain('variant="elevated"');
            expect(opening).not.toContain('variant="popover"');
        }
        expect(source).not.toContain(
            'className="grid items-center gap-[10px] overflow-visible p-[10px_12px]"',
        );
        expect(source).not.toContain(
            'className="grid h-auto min-h-8 w-full grid-cols-[minmax(0,1fr)_auto] justify-stretch px-2 py-1.5 text-left"',
        );
        expect(source).not.toContain(
            'className="h-auto min-h-8 w-full justify-start px-2 py-1.5"',
        );

        const alertOpenings = collectOpeningElements("Alert").filter(
            (opening) =>
                opening.includes('data-sot-part="speaker-review-state"'),
        );
        expect(alertOpenings.length).toBeGreaterThan(0);
        for (const opening of alertOpenings) {
            expect(opening).toContain('variant="speakerReviewError"');
            expect(opening).toContain('density="speakerReviewError"');
            expect(opening).toContain('layout="speakerReviewError"');
            expect(opening).not.toContain('variant="destructive"');
        }

        const voiceprintBadges = collectExactOpeningElements(
            "SpeakerReviewVoiceprintBadge",
        ).filter((opening) =>
            opening.includes('data-sot-part="speaker-review-voiceprint-pill"'),
        );
        expect(voiceprintBadges.length).toBeGreaterThan(0);
        for (const opening of voiceprintBadges) {
            expect(opening).not.toContain("variant=");
        }
        expect(source).toContain('data-sot-tone="missing"');
        expect(source).toContain('? "selected"');
        expect(source).toContain('? "ready"');
        expect(source).toContain(': "missing"');
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
        const mappingClear = collectOpeningElements("InputGroupButton").find(
            (opening) =>
                opening.includes(
                    'data-sot-control="speaker-review-mapping-clear"',
                ),
        );
        expect(mappingClear).toBeDefined();
        expect(mappingClear).toContain('size="speakerReviewMappingClear"');
        expect(mappingClear).toContain('variant="speakerReviewMappingClear"');
        expect(mappingClear).not.toContain('size="icon-xs"');
        expect(mappingClear).not.toContain('variant="ghost"');
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
        expect(mergeEmpty).toMatch(
            /<Empty\s+variant="speakerReviewMerge"[\s\S]*?data-sot-part="speaker-review-merge-empty"/,
        );
        expect(mergeEmpty).toContain(
            '<EmptyHeader variant="speakerReviewMerge">',
        );
        expect(mergeEmpty).toContain("<EmptyMedia");
        expect(mergeEmpty).toContain('variant="speakerReviewMergeIcon"');
        expect(mergeEmpty).toContain("<Check strokeWidth={1.8} />");
        expect(mergeEmpty).toContain(
            'data-sot-part="speaker-review-merge-empty-icon"',
        );
        expect(mergeEmpty).toMatch(
            /<EmptyTitle\s+variant="speakerReviewMerge"\s+data-sot-part="speaker-review-merge-empty-title"\s*>/,
        );
        expect(mergeEmpty).toMatch(
            /<EmptyDescription\s+variant="speakerReviewMerge"\s+data-sot-part="speaker-review-merge-empty-description"\s*>/,
        );
        expect(mergeEmpty).not.toContain('variant="compact"');
        expect(mergeEmpty).not.toContain('variant="subtleIcon"');
        expect(mergeEmpty).not.toContain('className="max-w-none gap-0"');
        expect(mergeEmpty).not.toContain("<svg");
        expect(mergeEmpty).not.toContain("<p");

        for (const { state, variant } of [
            {
                state: "no-detected-speakers",
                variant: "speakerReviewDetected",
            },
            { state: "no-samples", variant: "speakerReviewInline" },
            { state: "no-saved-speakers", variant: "speakerReviewInline" },
            { state: "no-matching-speakers", variant: "speakerReviewInline" },
        ]) {
            const emptySlice = extractElementSlice(
                `data-sot-state="${state}"`,
                "Empty",
            );
            expect(emptySlice).toContain(
                'data-sot-part="speaker-review-empty"',
            );
            expect(emptySlice).toContain(`variant="${variant}"`);
            expect(emptySlice).toContain(
                '<EmptyHeader variant="speakerReviewState">',
            );
            expect(emptySlice).toContain(
                '<EmptyTitle variant="speakerReviewState">',
            );
            expect(emptySlice).not.toContain('className="py-6"');
            expect(emptySlice).not.toContain('className="py-4 md:p-4"');
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
        expect(source).toContain('variant="speakerReviewGhostAction"');
        expect(source).toContain('variant="speakerReviewDangerAction"');
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
        const confirmEnd = source.indexOf("</SpeakerReviewCard>", confirmStart);
        const confirmSlice = source.slice(
            confirmStart,
            confirmEnd + "</SpeakerReviewCard>".length,
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
