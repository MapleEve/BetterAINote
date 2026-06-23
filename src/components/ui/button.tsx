import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
    "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium outline-none transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
    {
        variants: {
            variant: {
                default:
                    "bg-primary text-primary-foreground hover:bg-primary/90",
                destructive:
                    "bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
                actionPrimary:
                    "border border-[var(--button-primary-border)] bg-[image:var(--button-primary-bg)] text-[var(--button-primary-fg)] shadow-[var(--button-primary-shadow)] hover:bg-[image:var(--button-primary-hover-bg)]",
                actionDestructive:
                    "border border-[var(--button-destructive-border)] bg-[image:var(--button-destructive-bg)] text-[var(--button-destructive-fg)] shadow-[var(--button-destructive-shadow)] hover:bg-[image:var(--button-destructive-hover-bg)] focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
                outline:
                    "border border-input bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:hover:bg-input/50",
                secondary:
                    "bg-secondary text-secondary-foreground hover:bg-secondary/80",
                ghost: "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
                accent:
                    "border border-transparent bg-[var(--accent)] text-white shadow-none hover:bg-[var(--accent)] focus-visible:border-primary focus-visible:ring-0",
                quietOutline:
                    "border border-[var(--line-hairline)] bg-transparent text-[var(--fg-secondary)] shadow-none hover:bg-transparent hover:text-[var(--fg-secondary)]",
                accentLink:
                    "text-[var(--accent)] underline underline-offset-auto hover:text-[var(--accent)] hover:underline",
                ghostNeutral:
                    "border border-transparent bg-transparent justify-normal [justify-content:normal] text-[var(--fg-secondary)] shadow-none hover:bg-[var(--bg-recessed)] hover:text-[var(--fg-primary)]",
                accentIcon:
                    "border border-[var(--accent)] bg-[var(--accent)] text-[var(--accent)] shadow-none hover:bg-[var(--accent-hover)] hover:text-[var(--accent)] disabled:opacity-100",
                ghostIcon:
                    "rounded-[8px] border border-transparent bg-transparent p-0 text-[var(--fg-secondary)] shadow-none hover:bg-[var(--bg-recessed)] hover:text-[var(--fg-primary)] [&_svg]:size-[16px] [&_svg]:-translate-x-[0.5px] [&_svg]:-translate-y-px [&_svg]:stroke-[1.8]",
                ghostIconCompact:
                    "border border-transparent bg-transparent p-0 text-[var(--fg-tertiary)] shadow-none hover:bg-[var(--bg-recessed)] hover:text-[var(--fg-primary)] [&_svg]:size-[11px] [&_svg]:stroke-2",
                chipRemove:
                    "border border-transparent bg-transparent p-0 text-[var(--fg-tertiary)] shadow-none hover:bg-[var(--bg-recessed)] hover:text-[var(--fg-primary)] [&_svg]:invisible [&_svg]:size-[11px] [&_svg]:stroke-2",
                recordingTagErrorRetry:
                    "border border-transparent bg-transparent justify-normal [justify-content:normal] text-[var(--fg-secondary)] shadow-none hover:bg-[var(--bg-recessed)] hover:text-[var(--fg-primary)]",
                recordingTagToggle:
                    "relative inline-flex rounded-[999px] border border-[var(--line-hairline)] bg-[var(--bg-recessed)] text-[var(--fg-secondary)] shadow-none hover:bg-[var(--bg-elevated)] hover:text-[var(--fg-primary)] disabled:opacity-100 [&_svg]:size-[11px] [&_svg]:stroke-2",
                recordingTagInlineCreate:
                    "border border-[var(--accent)] bg-[var(--accent)] text-[var(--accent)] shadow-none hover:bg-[var(--accent-hover)] hover:text-[var(--accent)] disabled:opacity-100",
                recordingTagCancel:
                    "border border-transparent bg-transparent justify-normal [justify-content:normal] text-[var(--fg-secondary)] shadow-none hover:bg-[var(--bg-recessed)] hover:text-[var(--fg-primary)]",
                recordingTagCreate:
                    "border border-[var(--button-primary-border)] bg-[image:var(--button-primary-bg)] text-[var(--button-primary-fg)] shadow-[var(--button-primary-shadow)] hover:bg-[image:var(--button-primary-hover-bg)]",
                recordingTagDelete:
                    "border border-[var(--button-destructive-border)] bg-[image:var(--button-destructive-bg)] text-[var(--button-destructive-fg)] shadow-[var(--button-destructive-shadow)] hover:bg-[image:var(--button-destructive-hover-bg)] focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
                recordingTagChipRemove:
                    "border border-transparent bg-transparent p-0 text-[var(--fg-tertiary)] shadow-none hover:bg-[var(--bg-recessed)] hover:text-[var(--fg-primary)] [&_svg]:invisible [&_svg]:size-[11px] [&_svg]:stroke-2",
                recordingTagPanelClose:
                    "border border-transparent bg-transparent p-0 text-[var(--fg-tertiary)] shadow-none hover:bg-[var(--bg-recessed)] hover:text-[var(--fg-primary)] [&_svg]:size-[11px] [&_svg]:stroke-2",
                sourceProviderTile:
                    "group/source-provider border border-solid border-transparent bg-transparent text-left shadow-none [box-shadow:none] data-[sot-dimmed=true]:opacity-[0.55] data-[state=idle]:hover:bg-[var(--source-provider-card-hover)] data-[state=selected]:border-[var(--line-hairline)] data-[state=selected]:bg-[var(--bg-elevated)] data-[state=selected]:shadow-xs dark:data-[state=selected]:border-[var(--glass-border)] dark:data-[state=selected]:bg-[rgb(255_255_255_/_0.06)] dark:data-[state=selected]:shadow-none dark:data-[state=selected]:[box-shadow:none] [&_[data-sot-part=source-provider-mark]]:flex [&_[data-sot-part=source-provider-mark]]:size-7 [&_[data-sot-part=source-provider-mark]]:shrink-0 [&_[data-sot-part=source-provider-mark]]:items-center [&_[data-sot-part=source-provider-mark]]:justify-center [&_[data-sot-part=source-provider-mark]]:overflow-hidden [&_[data-sot-part=source-provider-mark]]:rounded-[7px] [&_[data-sot-part=source-provider-mark]]:border [&_[data-sot-part=source-provider-mark]]:border-[var(--line-hairline)] [&_[data-sot-part=source-provider-mark]]:bg-white [&_[data-sot-part=source-provider-meta]]:flex [&_[data-sot-part=source-provider-meta]]:min-w-0 [&_[data-sot-part=source-provider-meta]]:flex-col [&_[data-sot-part=source-provider-meta]]:gap-[2px] [&_[data-sot-provider-name]]:truncate [&_[data-sot-provider-name]]:font-sans [&_[data-sot-provider-name]]:text-[13px] [&_[data-sot-provider-name]]:font-semibold [&_[data-sot-provider-name]]:leading-[normal] [&_[data-sot-provider-name]]:text-[var(--fg-primary)] [&_[data-sot-provider-hint]]:truncate [&_[data-sot-provider-hint]]:font-mono [&_[data-sot-provider-hint]]:text-[11.5px] [&_[data-sot-provider-hint]]:font-medium [&_[data-sot-provider-hint]]:leading-[normal] [&_[data-sot-provider-hint]]:text-[var(--fg-tertiary)]",
                sourceReportAction:
                    "border border-input bg-background text-[var(--fg-primary)] shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:hover:bg-input/50",
                sourceReportPrimaryAction:
                    "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
                sourceReportGhostAction:
                    "border border-transparent bg-transparent text-[var(--fg-secondary)] shadow-none hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
                settingsClose:
                    "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
                settingsNav:
                    "cursor-pointer border border-transparent bg-transparent text-left text-[var(--fg-secondary)] shadow-none hover:bg-[var(--bg-recessed)] hover:text-[var(--fg-primary)] focus-visible:border-transparent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] focus-visible:ring-0 data-[state=active]:border-[var(--line-hairline)] data-[state=active]:bg-[var(--bg-elevated)] data-[state=active]:text-[var(--fg-primary)] data-[state=active]:shadow-xs data-[state=active]:hover:bg-[var(--bg-elevated)] data-[state=active]:hover:text-[var(--fg-primary)] dark:data-[state=active]:border-[var(--glass-border)] dark:data-[state=active]:bg-[rgb(255_255_255_/_0.07)] dark:data-[state=active]:shadow-none dark:data-[state=active]:hover:bg-[rgb(255_255_255_/_0.07)] [&_svg]:fill-none [&_svg]:stroke-current [&_svg]:stroke-[1.8] [&_svg]:[stroke-linecap:round] [&_svg]:[stroke-linejoin:round]",
                settingsSave:
                    "bg-primary text-primary-foreground hover:bg-primary/90",
                settingsTestAction:
                    "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
                settingsSourceRetry:
                    "bg-primary text-primary-foreground hover:bg-primary/90",
                settingsSectionRetry:
                    "bg-primary text-primary-foreground hover:bg-primary/90",
                sourceReportCopyAction:
                    "border border-transparent bg-transparent text-[var(--fg-secondary)] shadow-none hover:bg-[var(--bg-recessed)] hover:text-[var(--fg-primary)] data-[copy-state=ok]:border-[var(--button-copy-success-border)] data-[copy-state=ok]:bg-[var(--button-copy-success-bg)] data-[copy-state=ok]:text-[var(--signal-success)] data-[copy-state=ok]:hover:bg-[var(--button-copy-success-bg)] data-[copy-state=ok]:hover:text-[var(--signal-success)] data-[copy-state=err]:border-[var(--button-copy-danger-border)] data-[copy-state=err]:text-[var(--signal-danger)] data-[copy-state=err]:hover:bg-transparent data-[copy-state=err]:hover:text-[var(--signal-danger)]",
                onboardingProviderCard:
                    "border border-input bg-background text-left shadow-xs hover:bg-accent hover:text-accent-foreground data-[sot-state=selected]:border-transparent data-[sot-state=selected]:bg-secondary data-[sot-state=selected]:text-secondary-foreground data-[sot-state=selected]:hover:bg-secondary/80 dark:bg-input/30 dark:hover:bg-input/50 dark:data-[sot-state=selected]:bg-secondary",
                onboardingDefaultSource:
                    "cursor-pointer appearance-none border border-[var(--line-hairline)] bg-transparent text-left text-[var(--fg-primary)] shadow-none hover:bg-transparent hover:text-[var(--fg-primary)] data-[sot-state=selected]:border-[var(--accent)] data-[sot-state=selected]:bg-[var(--accent-soft)] data-[sot-state=selected]:hover:bg-[var(--accent-soft)] data-[sot-state=disabled]:cursor-not-allowed data-[sot-state=disabled]:opacity-[0.55] disabled:cursor-not-allowed disabled:opacity-[0.55]",
                onboardingSecondaryAction:
                    "border border-[var(--line-hairline)] bg-transparent text-[var(--fg-secondary)] shadow-none hover:bg-transparent hover:text-[var(--fg-secondary)]",
                onboardingPrimaryAction:
                    "border border-transparent bg-[var(--accent)] text-white shadow-none hover:bg-[var(--accent)] focus-visible:border-primary focus-visible:ring-0",
                speakerReviewAction:
                    "border border-input bg-background text-[var(--fg-primary)] shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:hover:bg-input/50",
                speakerReviewPrimaryAction:
                    "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
                speakerReviewGhostAction:
                    "border border-transparent bg-transparent text-[var(--fg-secondary)] shadow-none hover:bg-[var(--bg-recessed)] hover:text-[var(--fg-primary)]",
                speakerReviewDangerAction:
                    "bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
                speakerReviewSuggestion:
                    "border border-input bg-background text-[var(--fg-primary)] shadow-xs hover:bg-accent hover:text-accent-foreground data-[sot-state=create]:text-[var(--fg-secondary)] dark:bg-input/30 dark:hover:bg-input/50",
                speakerReviewIconAction:
                    "rounded-[8px] border border-transparent bg-transparent p-0 text-[var(--fg-secondary)] shadow-none hover:bg-[var(--bg-recessed)] hover:text-[var(--fg-primary)] [&_svg]:size-[16px] [&_svg]:stroke-[1.8]",
                speakerSettingsAction:
                    "border border-input bg-background text-[var(--fg-primary)] shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:hover:bg-input/50",
                speakerSettingsDangerAction:
                    "bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
                dashboardNav:
                    "relative border border-transparent bg-transparent text-left text-[var(--fg-secondary)] shadow-none hover:bg-accent hover:text-[var(--fg-primary)] focus-visible:text-[var(--fg-primary)] disabled:cursor-not-allowed disabled:opacity-50 data-[sot-state=selected]:border-[var(--line-hairline)] data-[sot-state=selected]:bg-[var(--bg-elevated)] data-[sot-state=selected]:text-[var(--fg-primary)] data-[sot-state=selected]:shadow-xs dark:data-[sot-state=selected]:border-[var(--glass-border)] dark:data-[sot-state=selected]:bg-[rgb(255_255_255_/_0.07)] dark:data-[sot-state=selected]:shadow-none",
                dashboardSync:
                    "bg-transparent text-muted-foreground shadow-none hover:bg-accent hover:text-foreground dark:hover:bg-accent/50",
                dashboardCopy:
                    "border border-transparent bg-transparent text-[var(--fg-secondary)] shadow-none hover:bg-[var(--bg-recessed)] hover:text-[var(--fg-primary)] data-[copy-state=ok]:border-[var(--button-copy-success-border)] data-[copy-state=ok]:bg-[var(--button-copy-success-bg)] data-[copy-state=ok]:text-[var(--signal-success)] data-[copy-state=ok]:hover:bg-[var(--button-copy-success-bg)] data-[copy-state=ok]:hover:text-[var(--signal-success)] data-[copy-state=err]:border-[var(--button-copy-danger-border)] data-[copy-state=err]:text-[var(--signal-danger)] data-[copy-state=err]:hover:bg-transparent data-[copy-state=err]:hover:text-[var(--signal-danger)]",
                dashboardCompactAction:
                    "border border-transparent bg-transparent text-[var(--fg-secondary)] shadow-none hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
                dashboardSpeakersMerge:
                    "border border-transparent bg-transparent text-[var(--fg-secondary)] shadow-none hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
                dashboardDrawerTrigger:
                    "bg-transparent text-[var(--fg-primary)] shadow-none hover:bg-[var(--bg-recessed)] hover:text-[var(--fg-primary)]",
                detailHeaderIconAction:
                    "border border-transparent bg-transparent p-0 text-[var(--fg-secondary)] shadow-none hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50 [&_svg]:fill-none [&_svg]:stroke-current [&_svg]:stroke-[1.8] [&_svg]:[stroke-linecap:round] [&_svg]:[stroke-linejoin:round]",
                detailHeaderAction:
                    "border border-[var(--line-hairline)] bg-[var(--glass-tint-base)] font-sans font-semibold text-[var(--fg-primary)] shadow-[var(--shadow-xs)] hover:bg-[var(--glass-tint-base)] hover:text-[var(--fg-primary)] [&_svg]:fill-none [&_svg]:stroke-current [&_svg]:stroke-[1.8] [&_svg]:[stroke-linecap:round] [&_svg]:[stroke-linejoin:round]",
                recordingRoutePrimaryAction:
                    "bg-primary text-primary-foreground hover:bg-primary/90",
                recordingRouteGhostAction:
                    "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
                recordingDetailBack:
                    "relative border border-transparent bg-transparent text-left text-[var(--fg-secondary)] shadow-none hover:bg-accent hover:text-[var(--fg-primary)] focus-visible:text-[var(--fg-primary)] disabled:cursor-not-allowed disabled:opacity-50 data-[sot-state=selected]:border-[var(--line-hairline)] data-[sot-state=selected]:bg-[var(--bg-elevated)] data-[sot-state=selected]:text-[var(--fg-primary)] data-[sot-state=selected]:shadow-xs dark:data-[sot-state=selected]:border-[var(--glass-border)] dark:data-[sot-state=selected]:bg-[rgb(255_255_255_/_0.07)] dark:data-[sot-state=selected]:shadow-none [&_span]:min-w-0 [&_span]:flex-1 [&_span]:truncate [&_svg]:flex-none [&_svg]:fill-none [&_svg]:stroke-current [&_svg]:stroke-[1.7] [&_svg]:opacity-[0.85] [&_svg]:[stroke-linecap:round] [&_svg]:[stroke-linejoin:round]",
                sourceRecordCopyAction:
                    "border border-input bg-background text-[var(--fg-primary)] shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:hover:bg-input/50",
                transcriptionAction:
                    "border border-input bg-background text-[var(--fg-primary)] shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:hover:bg-input/50",
                transcriptionPrimaryAction:
                    "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
                transcriptionDangerAction:
                    "bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
                dashboardSidebarCollapse:
                    "border border-[var(--line-hairline)] bg-[var(--bg-elevated)] text-muted-foreground shadow-sm hover:bg-accent hover:text-foreground dark:hover:bg-accent/50",
                dashboardSettingsAvatar:
                    "border-0 bg-gradient-to-b from-[var(--steel-500)] to-[var(--steel-700)] text-white shadow-xs hover:scale-[1.04] hover:bg-gradient-to-b hover:from-[var(--steel-500)] hover:to-[var(--steel-700)] hover:text-white",
                recordingListStatePrimary:
                    "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
                recordingListStateAction:
                    "bg-transparent text-[var(--fg-secondary)] shadow-none hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
                recordingListPagination:
                    "bg-transparent text-[var(--fg-secondary)] shadow-none hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
                pill: "relative inline-flex rounded-[999px] border border-[var(--line-hairline)] bg-[var(--bg-recessed)] text-[var(--fg-secondary)] shadow-none hover:bg-[var(--bg-elevated)] hover:text-[var(--fg-primary)] disabled:opacity-100 [&_svg]:size-[11px] [&_svg]:stroke-2",
                link: "text-primary underline-offset-4 hover:underline",
            },
            size: {
                default: "h-9 px-4 py-2 has-[>svg]:px-3",
                xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
                "control-sm":
                    "h-[var(--button-compact-height)] justify-normal [justify-content:normal] gap-[7px] rounded-[7px] px-[10px] text-[12px] leading-[normal] font-semibold has-[>svg]:px-[10px] [&_svg:not([class*='size-'])]:size-[11px]",
                "control-xs":
                    "h-[26px] gap-[6px] rounded-[8px] px-[10px] text-[11px] font-semibold leading-[normal] has-[>svg]:px-[10px]",
                "form-submit":
                    "h-[38px] rounded-[8px] px-[12px] py-0 text-[12px] font-semibold leading-[normal] has-[>svg]:px-[12px]",
                "inline-link":
                    "h-auto min-h-0 rounded-none p-0 align-baseline text-[12px] font-normal leading-[normal]",
                sm: "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
                "pill-sm":
                    "h-[var(--button-pill-height)] justify-normal gap-[5px] px-[10px] py-0 font-sans text-[11.5px] font-semibold leading-[normal] has-[>svg]:px-[10px]",
                recordingTagAction:
                    "h-[var(--button-compact-height)] justify-normal [justify-content:normal] gap-[7px] rounded-[7px] px-[10px] text-[12px] leading-[normal] font-semibold has-[>svg]:px-[10px] [&_svg:not([class*='size-'])]:size-[11px]",
                recordingTagToggle:
                    "h-[var(--button-pill-height)] justify-normal gap-[5px] px-[10px] py-0 font-sans text-[11.5px] font-semibold leading-[normal] has-[>svg]:px-[10px]",
                recordingTagInlineCreate:
                    "size-[30px] rounded-[6px] p-0 text-[14px] leading-[0] font-semibold has-[>svg]:p-0 [&_svg:not([class*='size-'])]:size-[14px]",
                recordingTagChipRemove:
                    "size-[var(--icon-chip-size)] rounded-full",
                recordingTagPanelClose:
                    "size-[var(--icon-compact-size)] rounded-[6px]",
                sourceProviderTile:
                    "grid h-auto w-full grid-cols-[28px_1fr_auto] items-center justify-start gap-[10px] rounded-[10px] p-[10px] whitespace-normal has-[>svg]:px-[10px]",
                sourceReportAction:
                    "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
                sourceReportCopyAction:
                    "h-[26px] gap-[6px] rounded-[7px] px-[10px] text-[12px] font-semibold leading-normal has-[>svg]:px-[10px] [&_svg:not([class*='size-'])]:size-[14px]",
                settingsClose: "size-[32px]",
                settingsNav:
                    "h-auto w-full min-w-0 justify-start gap-[10px] truncate rounded-[8px] px-[10px] py-[8px] font-sans text-[13px] font-medium leading-[normal] tracking-normal has-[>svg]:px-[10px] [&_span]:min-w-0 [&_span]:truncate [&_svg:not([class*='size-'])]:size-[14px] [&_svg]:flex-none",
                settingsSave:
                    "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
                settingsTestAction:
                    "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
                settingsSourceRetry:
                    "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
                settingsSectionRetry:
                    "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
                onboardingProviderCard:
                    "grid h-auto w-full grid-cols-[36px_1fr_auto_auto] items-center justify-start gap-3 rounded-md px-3.5 py-3 whitespace-normal has-[>svg]:px-3.5",
                onboardingDefaultSource:
                    "h-auto w-full justify-start gap-2 rounded-[8px] p-2 font-normal leading-[23.25px] whitespace-normal has-[>svg]:px-2",
                onboardingAction:
                    "h-[26px] gap-[6px] rounded-[8px] px-[10px] text-[11px] font-semibold leading-[normal] has-[>svg]:px-[10px]",
                speakerReviewAction:
                    "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
                speakerReviewSuggestion:
                    "grid h-auto min-h-8 w-full grid-cols-[minmax(0,1fr)_auto] justify-stretch gap-2 whitespace-normal px-2 py-1.5 text-left has-[>svg]:px-2",
                speakerReviewIcon: "size-[32px]",
                speakerSettingsAction:
                    "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
                dashboardNav:
                    "h-auto w-full justify-start gap-2.5 rounded-[9px] px-2.5 py-[7px] text-[13px] font-medium has-[>svg]:px-2.5",
                dashboardSync: "size-[32px]",
                dashboardCopy:
                    "h-[26px] gap-[6px] rounded-[7px] px-[10px] text-[12px] font-semibold leading-normal has-[>svg]:px-[10px] [&_svg:not([class*='size-'])]:size-[14px]",
                dashboardCompactAction:
                    "h-[26px] gap-[7px] rounded-[7px] px-[10px] text-[12px] font-semibold has-[>svg]:px-[10px]",
                dashboardSpeakersMerge:
                    "h-[26px] gap-[7px] rounded-[7px] px-[10px] text-[12px] font-semibold has-[>svg]:px-[10px]",
                dashboardDrawerTrigger:
                    "h-auto w-auto rounded-md px-[6px] py-px",
                detailHeaderIconAction: "size-[32px]",
                detailHeaderAction:
                    "h-8 gap-[7px] rounded-[9px] px-3 text-[12.5px] leading-normal has-[>svg]:px-3 [&_svg:not([class*='size-'])]:size-4",
                recordingRouteAction: "h-9 px-4 py-2 has-[>svg]:px-3",
                recordingDetailBack:
                    "h-auto w-full justify-start gap-2.5 rounded-[9px] px-2.5 py-[7px] text-[13px] font-medium has-[>svg]:px-2.5",
                sourceRecordCopyAction:
                    "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
                transcriptionAction:
                    "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
                dashboardSidebarCollapse: "size-[22px] rounded-full",
                dashboardSettingsAvatar:
                    "size-[30px] rounded-full text-xs font-semibold",
                recordingListStateAction:
                    "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
                recordingListPagination:
                    "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
                lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
                icon: "size-9",
                "icon-2xs": "size-[var(--icon-compact-size)] rounded-[6px]",
                "icon-chip": "size-[var(--icon-chip-size)] rounded-full",
                "icon-xs":
                    "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
                "icon-sm": "size-[32px]",
                "icon-lg": "size-10",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    },
);

type ButtonProps = React.ComponentProps<"button"> &
    VariantProps<typeof buttonVariants> & {
        asChild?: boolean;
    };

function Button({
    className,
    variant = "default",
    size = "default",
    asChild = false,
    ...props
}: ButtonProps) {
    const Comp = asChild ? Slot : "button";

    return (
        <Comp
            data-slot="button"
            data-variant={variant}
            data-size={size}
            className={cn(buttonVariants({ variant, size, className }))}
            {...props}
        />
    );
}

function IconButton(props: Omit<ButtonProps, "size">) {
    return <Button size="icon" variant="ghost" {...props} />;
}

export { Button, IconButton, buttonVariants };
export type { ButtonProps };
