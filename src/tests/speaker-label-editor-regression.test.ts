import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const OLD_UI_CONTRACT_RE =
    /uikit-|glass-surface|glass-control|bg-muted|text-muted-foreground|<LibrarySearch[\s/>]|<SourceFilterStackStrip[\s/>]|\.\/components\/library-search|\.\/components\/source-filter-stack-strip/;
const SPEAKER_REVIEW_PRIMITIVE_BUSINESS_RE = /\bspeakerReview[A-Za-z0-9_]*\b/;
const SPEAKER_REVIEW_RAW_REPAINT_RE =
    /\b(?:bg|border|shadow|text|decoration|ring|outline|rounded|fill|stroke)-\[[^\]]*var\(--[^)]*\)[^\]]*\]/;
const SPEAKER_REVIEW_FORCED_UTILITY_RE =
    /(?:^|\s)!(?:\[|bg-|border-|text-|font-|leading-|tracking-|shadow-|ring-|outline-|rounded-)/;
const SPEAKER_REVIEW_LOCAL_ICON_OVERRIDE_RE =
    /(?:strokeWidth=|\[&[^\]]*svg[^\]]*\]:(?:size|stroke)-|<(?:Check|Copy|FileText|Play|RefreshCw|Volume2|X)\b[^>]*\bclassName=)/;
const SPEAKER_REVIEW_RESIDUAL_GLOBAL_SELECTORS = [
    '[data-sot-list="speaker-review-meta"] > span',
    '[data-sot-part="speaker-review-section-description"]',
    '[data-sot-part="speaker-review-segment-title"]',
    '[data-sot-part="speaker-review-segment-text"]',
    '[data-sot-part="speaker-review-row-name"]',
    '[data-sot-part="speaker-review-section-title"]',
    '[data-sot-part="speaker-review-row-sub"]',
    '[data-sot-part="speaker-review-row-sub"][data-sot-tone="danger"]',
] as const;

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

    function extractSpeakerReviewConst(constName: string) {
        const start = source.indexOf(`const ${constName} =`);
        expect(start).toBeGreaterThanOrEqual(0);
        const end = source.indexOf(";", start);
        expect(end).toBeGreaterThan(start);
        return source.slice(start, end + 1);
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
        expect(source).toContain('variant="statusError"');
        expect(source).toContain("SPEAKER_REVIEW_ERROR_ALERT_CLASS_NAME");
        expect(source).toContain("SPEAKER_REVIEW_ERROR_TITLE_CLASS_NAME");
        expect(source).not.toContain('variant="speakerReviewError"');
        expect(source).not.toContain('density="speakerReviewError"');
        expect(source).not.toContain('layout="speakerReviewError"');
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
        expect(source).toContain("SPEAKER_REVIEW_GHOST_BUTTON_CLASS_NAME");
        expect(source).toContain("SPEAKER_REVIEW_PRIMARY_BUTTON_CLASS_NAME");
        expect(source).not.toContain('variant="speakerReviewGhostAction"');
        expect(source).not.toContain('variant="speakerReviewPrimaryAction"');
        expect(source).not.toContain('size="speakerReviewAction"');
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

    it("uses shadcn speaker review composition without local repaint residue", () => {
        expect(source).toContain('from "@/components/ui/button";');
        expect(source).toContain('from "@/components/ui/badge";');
        expect(source).toContain('from "@/components/ui/card";');
        expect(source).toContain('from "@/components/ui/alert";');
        expect(source).toContain('from "@/components/ui/toggle-group";');
        expect(source).toContain('from "@/components/ui/field";');
        expect(source).toContain('from "@/components/ui/input-group";');
        expect(source).toContain('from "@/components/ui/empty";');
        expect(source).toContain('from "@/components/ui/popover";');
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
            "<Popover",
            "<PopoverTrigger",
            "<PopoverContent",
        ]) {
            expect(source).toContain(primitive);
        }

        for (const selector of [
            '[data-sot-control="speaker-review-inline-name"][data-slot="input"]',
            '[data-sot-control="speaker-review-mapping-input"][data-slot="input"]',
            '[data-sot-panel="speaker-review"] [data-slot="card"]',
            '[data-sot-control="speaker-review-mode"]',
            '[data-sot-control="speaker-review-mode-option"]',
            '[data-sot-panel="speaker-review-merge"][data-slot="popover-content"]',
            '[data-sot-part="speaker-review-merge-empty"]',
            '[data-sot-part="speaker-review-merge-empty-icon"]',
            '[data-sot-part="speaker-review-merge-empty-title"]',
            '[data-sot-part="speaker-review-merge-empty-description"]',
            '[data-sot-control="speaker-review-suggestion"]',
            '[data-sot-part="speaker-review-empty"]',
            '[data-sot-part="speaker-review-voiceprint-pill"]',
            ...SPEAKER_REVIEW_RESIDUAL_GLOBAL_SELECTORS,
        ]) {
            expect(globalsSource).not.toContain(selector);
        }

        for (const primitiveSource of [
            alertPrimitiveSource,
            buttonPrimitiveSource,
            emptyPrimitiveSource,
            inputGroupPrimitiveSource,
            toggleGroupPrimitiveSource,
            globalsSource,
        ]) {
            expect(primitiveSource).not.toMatch(
                SPEAKER_REVIEW_PRIMITIVE_BUSINESS_RE,
            );
        }
        expect(inputGroupPrimitiveSource).not.toMatch(
            /\bdark:bg-\[var\(--[^)]+\)\]/,
        );
        expect(inputGroupPrimitiveSource).not.toContain(
            "svg:not([class*='size-'])",
        );
        expect(source).not.toContain("var(--");
        expect(source).not.toMatch(SPEAKER_REVIEW_RAW_REPAINT_RE);
        expect(source).not.toMatch(SPEAKER_REVIEW_FORCED_UTILITY_RE);
        expect(source).not.toMatch(/\bdark:/);
        expect(source).not.toMatch(SPEAKER_REVIEW_LOCAL_ICON_OVERRIDE_RE);
        expect(source).not.toContain("svg:not([class*='size-'])");
        expect(source).not.toContain("[&_svg]:stroke");
        expect(source).not.toContain("[&>svg]:stroke");
        expect(source).not.toContain("[&>svg]:size-[");
        for (const token of [
            "const SPEAKER_REVIEW_CARD_CLASS_NAMES =",
            "const SPEAKER_REVIEW_CARD_HEADER_CLASS_NAMES =",
            "const SPEAKER_REVIEW_CARD_TITLE_CLASS_NAMES =",
            "const SPEAKER_REVIEW_CARD_CONTENT_CLASS_NAMES =",
            "const SPEAKER_REVIEW_CARD_DESCRIPTION_CLASS_NAME =",
            "const SPEAKER_REVIEW_CARD_ACTION_CLASS_NAME =",
            "const SPEAKER_REVIEW_VOICEPRINT_BADGE_VARIANTS =",
            "const SPEAKER_REVIEW_ACTION_BUTTON_CLASS_NAME =",
            "const SPEAKER_REVIEW_PRIMARY_BUTTON_CLASS_NAME =",
            "const SPEAKER_REVIEW_GHOST_BUTTON_CLASS_NAME =",
            "const SPEAKER_REVIEW_DANGER_BUTTON_CLASS_NAME =",
            "const SPEAKER_REVIEW_SUGGESTION_BUTTON_CLASS_NAME =",
            "const SPEAKER_REVIEW_ICON_BUTTON_CLASS_NAME =",
            "const SPEAKER_REVIEW_MODE_ITEM_CLASS_NAME =",
            "const SPEAKER_REVIEW_ERROR_ALERT_CLASS_NAME =",
            "const SPEAKER_REVIEW_INLINE_EMPTY_CLASS_NAME =",
            "const SPEAKER_REVIEW_MAPPING_CLEAR_BUTTON_CLASS_NAME =",
            "const SPEAKER_REVIEW_META_ITEM_CLASS_NAME =",
            "const SPEAKER_REVIEW_SECTION_DESCRIPTION_CLASS_NAME =",
            "const SPEAKER_REVIEW_SEGMENT_TITLE_CLASS_NAME =",
            "const SPEAKER_REVIEW_SEGMENT_TEXT_CLASS_NAME =",
            "const SPEAKER_REVIEW_ROW_NAME_CLASS_NAME =",
            "const SPEAKER_REVIEW_SECTION_TITLE_CLASS_NAME =",
            "const SPEAKER_REVIEW_ROW_SUB_CLASS_NAME =",
            "function SpeakerReviewCard(",
            "function SpeakerReviewCardHeader(",
            "function SpeakerReviewCardTitle(",
            "function SpeakerReviewCardDescription(",
            "function SpeakerReviewCardAction(",
            "function SpeakerReviewCardContent(",
            "function SpeakerReviewVoiceprintBadge(",
        ]) {
            expect(source).toContain(token);
        }
        const voiceprintVariantConst = extractSpeakerReviewConst(
            "SPEAKER_REVIEW_VOICEPRINT_BADGE_VARIANTS",
        );
        expect(voiceprintVariantConst).toContain('missing: "secondary"');
        expect(voiceprintVariantConst).toContain('ready: "outline"');
        expect(voiceprintVariantConst).toContain('selected: "default"');
        expect(source).not.toContain(
            "SPEAKER_REVIEW_VOICEPRINT_BADGE_CLASS_NAME",
        );
        expect(source).not.toContain("data-[sot-tone=ready]");
        expect(source).not.toContain("data-[sot-tone=missing]");
        expect(source).not.toContain("data-[sot-tone=selected]");
        expect(source).not.toContain("[&>svg]:size-[11px]");
        expect(source).not.toContain("[&>svg]:stroke-2");
        for (const constName of [
            "SPEAKER_REVIEW_META_ITEM_CLASS_NAME",
            "SPEAKER_REVIEW_SECTION_DESCRIPTION_CLASS_NAME",
            "SPEAKER_REVIEW_SEGMENT_TITLE_CLASS_NAME",
            "SPEAKER_REVIEW_SEGMENT_TEXT_CLASS_NAME",
            "SPEAKER_REVIEW_ROW_NAME_CLASS_NAME",
            "SPEAKER_REVIEW_SECTION_TITLE_CLASS_NAME",
            "SPEAKER_REVIEW_ROW_SUB_CLASS_NAME",
        ]) {
            const ownerClass = extractSpeakerReviewConst(constName);
            expect(ownerClass).not.toContain("var(--");
            expect(ownerClass).not.toMatch(SPEAKER_REVIEW_RAW_REPAINT_RE);
            expect(ownerClass).not.toMatch(SPEAKER_REVIEW_FORCED_UTILITY_RE);
            expect(ownerClass).not.toMatch(/\bdark:/);
        }
        for (const legacyVariant of [
            "speakerReviewAction",
            "speakerReviewPrimaryAction",
            "speakerReviewGhostAction",
            "speakerReviewDangerAction",
            "speakerReviewSuggestion",
            "speakerReviewIconAction",
            "speakerReviewIcon",
            "speakerReviewError",
            "speakerReviewMode",
            "speakerReviewModeItem",
            "speakerReviewMappingClear",
            "speakerReviewMerge",
            "speakerReviewDetected",
            "speakerReviewInline",
            "speakerReviewState",
            "speakerReviewMergeIcon",
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
    });

    it("uses speaker review owner-local surfaces for this slice", () => {
        const modeToggle = extractElementSlice(
            'data-sot-control="speaker-review-mode"',
            "ToggleGroup",
        );
        expect(modeToggle).toContain('variant="default"');
        expect(modeToggle).toContain('size="sm"');
        expect(modeToggle).toContain('className="flex-nowrap"');
        expect(modeToggle).toContain("spacing={1}");
        expect(modeToggle).not.toContain('variant="speakerReviewMode"');
        expect(modeToggle).not.toContain('size="speakerReviewModeItem"');
        expect(modeToggle).not.toContain('layout="speakerReviewMode"');
        expect(modeToggle).not.toContain('spacing="speakerReviewMode"');

        const modeOptionOpenings = collectOpeningElements(
            "ToggleGroupItem",
        ).filter((opening) =>
            opening.includes('data-sot-control="speaker-review-mode-option"'),
        );
        expect(modeOptionOpenings).toHaveLength(2);
        for (const opening of modeOptionOpenings) {
            expect(opening).toContain(
                "className={SPEAKER_REVIEW_MODE_ITEM_CLASS_NAME}",
            );
            expect(opening).not.toContain('variant="speakerReviewModeItem"');
        }

        const buttonOpenings = collectSpeakerReviewButtonOpenings();
        expect(buttonOpenings.length).toBeGreaterThan(0);
        for (const opening of buttonOpenings) {
            expect(opening).not.toMatch(SPEAKER_REVIEW_PRIMITIVE_BUSINESS_RE);
        }

        for (const { control, variant, size, className } of [
            {
                control: 'data-sot-control="speaker-review-copy-raw"',
                variant: 'variant="default"',
                size: 'size="sm"',
                className: "SPEAKER_REVIEW_PRIMARY_BUTTON_CLASS_NAME",
            },
            {
                control: 'data-sot-control="speaker-review-refresh"',
                variant: 'variant="ghost"',
                size: 'size="sm"',
                className: "SPEAKER_REVIEW_GHOST_BUTTON_CLASS_NAME",
            },
            {
                control: 'data-sot-control="speaker-review-inline-save"',
                variant: 'variant="default"',
                size: 'size="sm"',
                className: "SPEAKER_REVIEW_PRIMARY_BUTTON_CLASS_NAME",
            },
            {
                control: 'data-sot-control="speaker-review-unlink"',
                variant: 'variant="destructive"',
                size: 'size="sm"',
                className: "SPEAKER_REVIEW_DANGER_BUTTON_CLASS_NAME",
            },
            {
                control: 'data-sot-control="speaker-review-suggestion"',
                variant: 'variant="outline"',
                size: 'size="default"',
                className: "SPEAKER_REVIEW_SUGGESTION_BUTTON_CLASS_NAME",
            },
        ]) {
            const opening = collectOpeningElements("Button").find((element) =>
                element.includes(control),
            );
            expect(opening).toBeDefined();
            expect(opening).toContain(variant);
            expect(opening).toContain(size);
            expect(opening).toContain(className);
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
        const popoverContentOpenings = collectOpeningElements("PopoverContent");
        const mergePopoverOpening = popoverContentOpenings.find((opening) =>
            opening.includes('data-sot-panel="speaker-review-merge"'),
        );
        expect(mergePopoverOpening).toBeDefined();
        expect(mergePopoverOpening).toContain("id={mergePopoverId}");
        expect(mergePopoverOpening).toContain("data-spk-merge-pop");
        expect(mergePopoverOpening).toContain(
            "data-open={String(isMergePopoverOpen)}",
        );
        expect(mergePopoverOpening).toContain(
            "SPEAKER_REVIEW_CARD_CLASS_NAMES.mergePopover",
        );
        expect(mergePopoverOpening).toContain('aria-label="合并相似说话人"');
        expect(mergePopoverOpening).not.toContain('role="dialog"');
        expect(mergePopoverOpening).not.toContain(
            "hidden={!isMergePopoverOpen}",
        );
        expect(mergePopoverOpening).not.toMatch(SPEAKER_REVIEW_RAW_REPAINT_RE);
        expect(mergePopoverOpening).not.toMatch(
            SPEAKER_REVIEW_FORCED_UTILITY_RE,
        );

        expect(source).toContain("onOpenChange={setIsMergePopoverOpen}");
        expect(source).toContain("<PopoverTrigger asChild>");
        const mergeTriggerOpening = collectOpeningElements("Button").find(
            (opening) =>
                opening.includes('data-sot-control="speaker-review-merge"'),
        );
        expect(mergeTriggerOpening).toContain("aria-controls={mergePopoverId}");
        expect(mergeTriggerOpening).toContain(
            "aria-expanded={isMergePopoverOpen}",
        );
        const mergeCloseSlice = extractElementSlice(
            "data-spk-merge-close",
            "Button",
        );
        expect(mergeCloseSlice).toContain('size="icon-sm"');
        expect(mergeCloseSlice).toMatch(
            /<X\s+data-icon="inline-start"\s+aria-hidden="true"\s+focusable="false"\s*\/>/,
        );
        expect(mergeCloseSlice).not.toContain("size-[17px]");
        expect(mergeCloseSlice).not.toContain("translate-x");
        expect(mergeCloseSlice).not.toContain("translate-y");
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
            expect(opening).not.toMatch(SPEAKER_REVIEW_RAW_REPAINT_RE);
            expect(opening).not.toMatch(SPEAKER_REVIEW_FORCED_UTILITY_RE);
        }

        const alertOpenings = collectOpeningElements("Alert").filter(
            (opening) =>
                opening.includes('data-sot-part="speaker-review-state"'),
        );
        expect(alertOpenings.length).toBeGreaterThan(0);
        for (const opening of alertOpenings) {
            expect(opening).toContain('variant="statusError"');
            expect(opening).toContain(
                "className={SPEAKER_REVIEW_ERROR_ALERT_CLASS_NAME}",
            );
            expect(opening).not.toContain('variant="speakerReviewError"');
            expect(opening).not.toContain('density="speakerReviewError"');
            expect(opening).not.toContain('layout="speakerReviewError"');
        }

        const voiceprintBadges = collectExactOpeningElements(
            "SpeakerReviewVoiceprintBadge",
        ).filter((opening) =>
            opening.includes('data-sot-part="speaker-review-voiceprint-pill"'),
        );
        expect(voiceprintBadges.length).toBeGreaterThan(0);
        for (const opening of voiceprintBadges) {
            expect(opening).not.toContain("variant=");
            expect(opening).not.toContain('variant="speakerReviewVoiceprint"');
        }
        const voiceprintBadgeHelperStart = source.indexOf(
            "function SpeakerReviewVoiceprintBadge(",
        );
        expect(voiceprintBadgeHelperStart).toBeGreaterThanOrEqual(0);
        const voiceprintBadgeHelperEnd = source.indexOf(
            "function formatSegmentWindow",
            voiceprintBadgeHelperStart,
        );
        expect(voiceprintBadgeHelperEnd).toBeGreaterThan(
            voiceprintBadgeHelperStart,
        );
        const voiceprintBadgeHelper = source.slice(
            voiceprintBadgeHelperStart,
            voiceprintBadgeHelperEnd,
        );
        expect(voiceprintBadgeHelper).toContain(
            "variant={SPEAKER_REVIEW_VOICEPRINT_BADGE_VARIANTS[tone]}",
        );
        expect(voiceprintBadgeHelper).toContain("data-sot-tone={tone}");
        expect(voiceprintBadgeHelper).not.toContain("className=");
        expect(source).toContain('data-sot-tone="missing"');
        expect(source).toContain('? "selected"');
        expect(source).toContain('? "ready"');
        expect(source).toContain(': "missing"');

        const metaItemClassRefs =
            source.match(/SPEAKER_REVIEW_META_ITEM_CLASS_NAME/g) ?? [];
        expect(metaItemClassRefs.length).toBeGreaterThanOrEqual(9);
        for (const { marker, ownerClassName } of [
            {
                marker: 'data-sot-part="speaker-review-segment-text"',
                ownerClassName: "SPEAKER_REVIEW_SEGMENT_TEXT_CLASS_NAME",
            },
            {
                marker: 'data-sot-part="speaker-review-row-name"',
                ownerClassName: "SPEAKER_REVIEW_ROW_NAME_CLASS_NAME",
            },
            {
                marker: 'data-sot-part="speaker-review-row-sub"',
                ownerClassName: "SPEAKER_REVIEW_ROW_SUB_CLASS_NAME",
            },
            {
                marker: 'data-sot-part="speaker-review-section-title"',
                ownerClassName: "SPEAKER_REVIEW_SECTION_TITLE_CLASS_NAME",
            },
            {
                marker: 'data-sot-part="speaker-review-section-description"',
                ownerClassName: "SPEAKER_REVIEW_SECTION_DESCRIPTION_CLASS_NAME",
            },
            {
                marker: 'data-sot-part="speaker-review-segment-title"',
                ownerClassName: "SPEAKER_REVIEW_SEGMENT_TITLE_CLASS_NAME",
            },
        ]) {
            const markerIndex = source.indexOf(marker);
            expect(markerIndex).toBeGreaterThanOrEqual(0);
            const openingStart = source.lastIndexOf("<", markerIndex);
            expect(openingStart).toBeGreaterThanOrEqual(0);
            const elementSlice = source.slice(openingStart, markerIndex);
            expect(elementSlice).toContain(ownerClassName);
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
        const mappingClear = collectOpeningElements("InputGroupButton").find(
            (opening) =>
                opening.includes(
                    'data-sot-control="speaker-review-mapping-clear"',
                ),
        );
        expect(mappingClear).toBeDefined();
        expect(mappingClear).toContain('size="icon-xs"');
        expect(mappingClear).toContain('variant="ghost"');
        expect(mappingClear).toMatch(
            /className=\{\s*SPEAKER_REVIEW_MAPPING_CLEAR_BUTTON_CLASS_NAME\s*\}/,
        );
        expect(mappingClear).not.toContain('size="speakerReviewMappingClear"');
        expect(mappingClear).not.toContain(
            'variant="speakerReviewMappingClear"',
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
        expect(mergeEmpty).toMatch(
            /<Empty\s+variant="compact"[\s\S]*?data-sot-part="speaker-review-merge-empty"/,
        );
        expect(mergeEmpty).toContain('<EmptyHeader variant="popover">');
        expect(mergeEmpty).toContain("<EmptyMedia");
        expect(mergeEmpty).toContain('variant="subtleIcon"');
        expect(mergeEmpty).toContain("<Check />");
        expect(mergeEmpty).not.toMatch(SPEAKER_REVIEW_LOCAL_ICON_OVERRIDE_RE);
        expect(mergeEmpty).toContain(
            'data-sot-part="speaker-review-merge-empty-icon"',
        );
        expect(mergeEmpty).toMatch(
            /<EmptyTitle\s+variant="compact"\s+data-sot-part="speaker-review-merge-empty-title"\s*>/,
        );
        expect(mergeEmpty).toMatch(
            /<EmptyDescription\s+variant="compact"\s+data-sot-part="speaker-review-merge-empty-description"\s*>/,
        );
        expect(mergeEmpty).not.toMatch(SPEAKER_REVIEW_PRIMITIVE_BUSINESS_RE);
        expect(mergeEmpty).not.toContain('className="max-w-none gap-0"');
        expect(mergeEmpty).not.toContain("<svg");
        expect(mergeEmpty).not.toContain("<p");

        for (const { state, ownerClassName } of [
            {
                state: "no-detected-speakers",
                ownerClassName: null,
            },
            {
                state: "no-samples",
                ownerClassName: "SPEAKER_REVIEW_INLINE_EMPTY_CLASS_NAME",
            },
            {
                state: "no-saved-speakers",
                ownerClassName: "SPEAKER_REVIEW_INLINE_EMPTY_CLASS_NAME",
            },
            {
                state: "no-matching-speakers",
                ownerClassName: "SPEAKER_REVIEW_INLINE_EMPTY_CLASS_NAME",
            },
        ]) {
            const emptySlice = extractElementSlice(
                `data-sot-state="${state}"`,
                "Empty",
            );
            expect(emptySlice).toContain(
                'data-sot-part="speaker-review-empty"',
            );
            expect(emptySlice).toContain('variant="default"');
            expect(emptySlice).toContain('<EmptyHeader variant="default">');
            expect(emptySlice).toContain('<EmptyTitle variant="default">');
            if (ownerClassName) {
                expect(emptySlice).toContain(ownerClassName);
            }
            expect(emptySlice).not.toContain('variant="speakerReview');
            expect(emptySlice).not.toContain('density="speakerReview');
            expect(emptySlice).not.toContain('layout="speakerReview');
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
            "onOpenChange={setIsMergePopoverOpen}",
        ]) {
            expect(source).toContain(anchor);
        }
        expect(source).not.toContain("hidden={!isMergePopoverOpen}");
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
        expect(source).toContain("SPEAKER_REVIEW_GHOST_BUTTON_CLASS_NAME");
        expect(source).toContain("SPEAKER_REVIEW_DANGER_BUTTON_CLASS_NAME");
        expect(source).not.toContain('variant="speakerReviewGhostAction"');
        expect(source).not.toContain('variant="speakerReviewDangerAction"');
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
