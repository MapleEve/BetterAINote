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
                sourceProviderTile:
                    "group/source-provider border border-solid border-transparent bg-transparent text-left shadow-none [box-shadow:none] data-[sot-dimmed=true]:opacity-[0.55] data-[state=idle]:hover:bg-[var(--source-provider-card-hover)] data-[state=selected]:border-[var(--line-hairline)] data-[state=selected]:bg-[var(--bg-elevated)] data-[state=selected]:shadow-xs dark:data-[state=selected]:border-[var(--glass-border)] dark:data-[state=selected]:bg-[rgb(255_255_255_/_0.06)] dark:data-[state=selected]:shadow-none dark:data-[state=selected]:[box-shadow:none]",
                sourceProviderAction:
                    "border border-transparent bg-transparent text-[var(--fg-secondary)] shadow-none hover:bg-[var(--bg-recessed)] hover:text-[var(--fg-primary)] data-[sot-state=error]:text-destructive data-[sot-state=success]:text-primary",
                sourceProviderActionPrimary:
                    "border border-[var(--source-provider-primary-border)] bg-[image:var(--source-provider-primary-bg)] text-[var(--accent-on)] shadow-[var(--source-provider-primary-shadow)] data-[sot-state=error]:text-[var(--signal-danger)]",
                sourceProviderActionDanger:
                    "border border-transparent bg-transparent text-[var(--signal-danger)] shadow-none hover:bg-[var(--bg-recessed)] hover:text-[var(--signal-danger)]",
                sourceReportAction:
                    "border border-input bg-background text-[var(--fg-primary)] shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:hover:bg-input/50",
                sourceReportPrimaryAction:
                    "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
                sourceReportGhostAction:
                    "border border-transparent bg-transparent text-[var(--fg-secondary)] shadow-none hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
                sourceReportCopyAction:
                    "border border-transparent bg-transparent text-[var(--fg-secondary)] shadow-none hover:bg-[var(--bg-recessed)] hover:text-[var(--fg-primary)] data-[copy-state=ok]:border-[var(--button-copy-success-border)] data-[copy-state=ok]:bg-[var(--button-copy-success-bg)] data-[copy-state=ok]:text-[var(--signal-success)] data-[copy-state=ok]:hover:bg-[var(--button-copy-success-bg)] data-[copy-state=ok]:hover:text-[var(--signal-success)] data-[copy-state=err]:border-[var(--button-copy-danger-border)] data-[copy-state=err]:text-[var(--signal-danger)] data-[copy-state=err]:hover:bg-transparent data-[copy-state=err]:hover:text-[var(--signal-danger)]",
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
                aiRenamePreviewClose:
                    "border border-transparent bg-transparent text-[var(--fg-secondary)] shadow-none hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
                aiRenamePreviewAction:
                    "border border-transparent bg-transparent text-[var(--fg-secondary)] shadow-none hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
                aiRenamePreviewPrimaryAction:
                    "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
                dashboardNav:
                    "relative border border-transparent bg-transparent text-left text-[var(--fg-secondary)] shadow-none hover:bg-accent hover:text-[var(--fg-primary)] focus-visible:text-[var(--fg-primary)] disabled:cursor-not-allowed disabled:opacity-50 data-[sot-state=selected]:border-[var(--line-hairline)] data-[sot-state=selected]:bg-[var(--bg-elevated)] data-[sot-state=selected]:text-[var(--fg-primary)] data-[sot-state=selected]:shadow-xs dark:data-[sot-state=selected]:border-[var(--glass-border)] dark:data-[sot-state=selected]:bg-[rgb(255_255_255_/_0.07)] dark:data-[sot-state=selected]:shadow-none",
                dashboardSource:
                    "relative border border-transparent bg-transparent text-left text-[var(--fg-secondary)] shadow-none hover:bg-accent hover:text-[var(--fg-primary)] focus-visible:text-[var(--fg-primary)] disabled:cursor-not-allowed disabled:opacity-50 data-[sot-state=selected]:border-[var(--line-hairline)] data-[sot-state=selected]:bg-[var(--bg-elevated)] data-[sot-state=selected]:text-[var(--fg-primary)] data-[sot-state=selected]:shadow-xs data-[sot-state=connected-active]:border-[var(--line-hairline)] data-[sot-state=connected-active]:bg-[var(--bg-elevated)] data-[sot-state=connected-active]:text-[var(--fg-primary)] data-[sot-state=connected-active]:shadow-xs data-[sot-state=connected-idle]:text-[var(--fg-secondary)] data-[sot-state=syncing]:text-[var(--fg-secondary)] data-[sot-state=expired]:text-[var(--fg-secondary)] data-[sot-state=sync-error]:text-[var(--fg-primary)] data-[sot-state=no-results]:text-[var(--fg-tertiary)] data-[sot-state=needs-setup]:text-[var(--fg-tertiary)] data-[sot-state=disabled]:text-[var(--fg-tertiary)] data-[sot-state=disabled]:opacity-[0.55] dark:data-[sot-state=selected]:border-[var(--glass-border)] dark:data-[sot-state=selected]:bg-[rgb(255_255_255_/_0.07)] dark:data-[sot-state=selected]:shadow-none dark:data-[sot-state=connected-active]:border-[var(--glass-border)] dark:data-[sot-state=connected-active]:bg-[rgb(255_255_255_/_0.07)] dark:data-[sot-state=connected-active]:shadow-none",
                dashboardSync:
                    "bg-transparent text-muted-foreground shadow-none hover:bg-accent hover:text-foreground dark:hover:bg-accent/50",
                dashboardSourceAction:
                    "bg-transparent shadow-none hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
                dashboardCopy:
                    "border border-transparent bg-transparent text-[var(--fg-secondary)] shadow-none hover:bg-[var(--bg-recessed)] hover:text-[var(--fg-primary)] data-[copy-state=ok]:border-[var(--button-copy-success-border)] data-[copy-state=ok]:bg-[var(--button-copy-success-bg)] data-[copy-state=ok]:text-[var(--signal-success)] data-[copy-state=ok]:hover:bg-[var(--button-copy-success-bg)] data-[copy-state=ok]:hover:text-[var(--signal-success)] data-[copy-state=err]:border-[var(--button-copy-danger-border)] data-[copy-state=err]:text-[var(--signal-danger)] data-[copy-state=err]:hover:bg-transparent data-[copy-state=err]:hover:text-[var(--signal-danger)]",
                dashboardCompactAction:
                    "border border-transparent bg-transparent text-[var(--fg-secondary)] shadow-none hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
                dashboardDrawerTrigger:
                    "bg-transparent text-[var(--fg-primary)] shadow-none hover:bg-[var(--bg-recessed)] hover:text-[var(--fg-primary)]",
                detailHeaderIconAction:
                    "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
                detailHeaderAction:
                    "border border-input bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:hover:bg-input/50",
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
                dashboardRecordingRow:
                    "grid w-full grid-cols-[1fr_auto] items-center gap-[14px] whitespace-normal border border-transparent bg-transparent text-left text-[13.3333px] font-normal shadow-none hover:bg-[var(--bg-recessed)] hover:text-[var(--fg-primary)] data-[sot-state=selected]:border-[var(--line-hairline)] data-[sot-state=selected]:bg-[var(--accent-soft)]",
                recordingListChipClear:
                    "border border-transparent bg-transparent p-0 text-[var(--fg-tertiary)] shadow-none hover:bg-[var(--bg-recessed)] hover:text-[var(--fg-primary)]",
                sourceFilterAction:
                    "border border-[var(--line-hairline)] bg-[var(--bg-elevated)] text-[var(--fg-secondary)] shadow-none hover:bg-[var(--bg-elevated)] hover:text-[var(--fg-primary)] disabled:cursor-not-allowed disabled:opacity-50 data-[sot-action=open-settings]:border-[var(--source-provider-primary-border)] data-[sot-action=open-settings]:bg-[var(--accent-soft)] data-[sot-action=open-settings]:text-[var(--accent)] data-[sot-action=retry]:border-[var(--alert-destructive-soft-border)] data-[sot-action=retry]:bg-[var(--alert-destructive-soft-bg)] data-[sot-action=retry]:text-[var(--signal-danger)] data-[sot-action=retry]:hover:bg-[var(--alert-destructive-soft-strong-bg)] data-[sot-action=widen]:border-[var(--source-provider-primary-border)] data-[sot-action=widen]:bg-[var(--accent-soft)] data-[sot-action=widen]:text-[var(--accent)] dark:border-[var(--glass-border)] dark:bg-[rgb(255_255_255_/_0.05)] dark:hover:bg-[rgb(255_255_255_/_0.1)]",
                sourceFilterClearAll:
                    "bg-transparent text-primary shadow-none underline-offset-4 hover:bg-transparent hover:text-primary hover:underline",
                systemBannerAction:
                    "cursor-pointer border border-transparent bg-transparent text-[var(--fg-secondary)] shadow-none hover:bg-[var(--bg-recessed)] hover:text-[var(--fg-primary)]",
                systemBannerPrimaryAction:
                    "cursor-pointer border border-[var(--line-hairline)] bg-[var(--glass-tint-base)] text-[var(--fg-primary)] shadow-[var(--shadow-xs)] backdrop-blur-[14px] backdrop-saturate-[140%] hover:bg-[var(--glass-tint-base)] hover:text-[var(--fg-primary)]",
                systemBannerDismissAction:
                    "cursor-pointer border border-transparent bg-transparent text-[var(--fg-secondary)] shadow-none hover:bg-[var(--bg-recessed)] hover:text-[var(--fg-primary)]",
                recordingListTagFilterTrigger:
                    "border border-input bg-background text-[var(--fg-primary)] shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:hover:bg-input/50",
                recordingListTagFilterOption:
                    "border border-transparent bg-transparent text-[var(--fg-secondary)] shadow-none hover:bg-accent hover:text-accent-foreground data-[sot-state=selected]:bg-secondary data-[sot-state=selected]:text-secondary-foreground data-[sot-state=selected]:hover:bg-secondary/80 dark:hover:bg-accent/50",
                recordingListStatePrimary:
                    "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
                recordingListStateAction:
                    "bg-transparent text-[var(--fg-secondary)] shadow-none hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
                recordingListPagination:
                    "bg-transparent text-[var(--fg-secondary)] shadow-none hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
                playerControl:
                    "border border-[var(--button-player-border)] bg-[var(--button-player-bg)] text-[var(--button-player-fg)] shadow-[var(--shadow-xs)] hover:bg-[var(--button-player-hover-bg)] hover:text-[var(--button-player-hover-fg)] active:scale-[0.96] [&_[data-player-control-icon]_svg]:fill-none [&_[data-player-control-icon]_svg]:stroke-current [&_[data-player-control-icon]_svg]:stroke-[1.8]",
                playerPrimary:
                    "border border-[var(--button-player-primary-border)] [background:var(--button-player-primary-bg)] text-white shadow-[var(--button-player-primary-shadow)] hover:text-white active:scale-[0.96]",
                playerSpeed:
                    "border border-transparent bg-transparent font-mono font-semibold leading-normal tabular-nums text-[var(--fg-secondary)] shadow-none hover:bg-[var(--bg-recessed)] hover:text-[var(--fg-primary)] active:translate-y-[0.5px]",
                playerTagAdd:
                    "border border-dashed border-[var(--line-hairline)] bg-transparent text-[var(--fg-tertiary)] shadow-none hover:border-[var(--line-strong)] hover:bg-transparent hover:text-[var(--fg-primary)] [&_svg]:stroke-current",
                playerTagChip:
                    "border border-[var(--line-hairline)] bg-[var(--bg-elevated)] text-[var(--fg-primary)] shadow-[var(--shadow-xs)] hover:bg-[var(--bg-elevated)] hover:text-[var(--fg-primary)] data-[sot-state=open]:border-[var(--line-strong)] data-[sot-state=open]:bg-[var(--bg-recessed)] data-[sot-tag-color=blue]:[--tag-c:var(--tag-blue)] data-[sot-tag-color=green]:[--tag-c:var(--tag-green)] data-[sot-tag-color=orange]:[--tag-c:var(--tag-amber)] data-[sot-tag-color=purple]:[--tag-c:var(--tag-violet)] data-[sot-tag-color=red]:[--tag-c:var(--tag-rose)] data-[sot-tag-color=slate]:[--tag-c:var(--tag-slate)] [--tag-c:var(--graphite-500)]",
                playerTagOverflow:
                    "border border-dashed border-[var(--line-hairline)] bg-[var(--bg-recessed)] text-[var(--fg-tertiary)] shadow-none hover:border-[var(--line-strong)] hover:bg-transparent hover:text-[var(--fg-primary)]",
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
                sourceProviderTile:
                    "grid h-auto w-full grid-cols-[28px_1fr_auto] items-center justify-start gap-[10px] rounded-[10px] p-[10px] whitespace-normal has-[>svg]:px-[10px]",
                sourceProviderAction:
                    "h-[26px] gap-[7px] rounded-[7px] px-[10px] text-[12px] font-semibold leading-[normal] has-[>svg]:px-[10px] [&_svg:not([class*='size-'])]:size-[11px]",
                sourceReportAction:
                    "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
                sourceReportCopyAction:
                    "h-[26px] gap-[6px] rounded-[7px] px-[10px] text-[12px] font-semibold leading-normal has-[>svg]:px-[10px] [&_svg:not([class*='size-'])]:size-[14px]",
                speakerReviewAction:
                    "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
                speakerReviewSuggestion:
                    "grid h-auto min-h-8 w-full grid-cols-[minmax(0,1fr)_auto] justify-stretch gap-2 whitespace-normal px-2 py-1.5 text-left has-[>svg]:px-2",
                speakerReviewIcon: "size-[32px]",
                aiRenamePreviewClose:
                    "size-6 rounded-md p-0 [&_svg:not([class*='size-'])]:size-3",
                aiRenamePreviewAction:
                    "h-6 shrink-0 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
                dashboardNav:
                    "h-auto w-full justify-start gap-2.5 rounded-[9px] px-2.5 py-[7px] text-[13px] font-medium has-[>svg]:px-2.5",
                dashboardSource:
                    "h-auto w-full justify-start gap-2.5 rounded-[9px] px-2.5 py-[7px] text-[13px] font-medium has-[>svg]:px-2.5",
                dashboardSync: "size-[32px]",
                dashboardSourceAction:
                    "h-[22px] gap-1 rounded-full px-[9px] text-[11px] font-semibold leading-normal has-[>svg]:px-[9px] [&_svg:not([class*='size-'])]:size-3",
                dashboardCopy:
                    "h-[26px] gap-[6px] rounded-[7px] px-[10px] text-[12px] font-semibold leading-normal has-[>svg]:px-[10px] [&_svg:not([class*='size-'])]:size-[14px]",
                dashboardCompactAction:
                    "h-[26px] gap-[7px] rounded-[7px] px-[10px] text-[12px] font-semibold has-[>svg]:px-[10px]",
                dashboardDrawerTrigger:
                    "h-auto w-auto rounded-md px-[6px] py-px",
                detailHeaderIconAction: "size-[32px]",
                detailHeaderAction:
                    "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
                sourceRecordCopyAction:
                    "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
                transcriptionAction:
                    "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
                dashboardSidebarCollapse: "size-[22px] rounded-full",
                dashboardSettingsAvatar:
                    "size-[30px] rounded-full text-xs font-semibold",
                dashboardRecordingRow:
                    "h-auto rounded-[10px] px-3 py-[11px] text-[13.3333px] leading-normal has-[>svg]:px-3",
                recordingListChipClear:
                    "size-4 rounded-full p-0 [&_svg:not([class*='size-'])]:size-[11px]",
                sourceFilterAction:
                    "ml-[6px] h-[22px] flex-none gap-1 rounded-full px-[9px] text-[11px] font-semibold leading-none whitespace-nowrap has-[>svg]:px-[9px] [&_svg:not([class*='size-'])]:size-[11px]",
                sourceFilterClearAll:
                    "h-6 rounded-md px-2 text-sm has-[>svg]:px-2",
                systemBannerAction:
                    "h-[26px] w-auto gap-[7px] rounded-[7px] px-[10px] text-[12px] font-semibold leading-normal has-[>svg]:px-[10px] [&_svg:not([class*='size-'])]:size-4 [&_svg]:stroke-[1.8]",
                systemBannerDismissAction:
                    "size-[26px] rounded-[7px] p-0 [&_svg:not([class*='size-'])]:size-4 [&_svg]:stroke-[1.8]",
                recordingListTagFilterTrigger:
                    "h-8 w-full justify-start gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
                recordingListTagFilterOption:
                    "h-8 w-full justify-start gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
                recordingListStateAction:
                    "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
                recordingListPagination:
                    "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
                playerControl:
                    "size-[36px] rounded-[50%] px-[6px] py-px text-[13.3333px] font-normal",
                playerControlSm:
                    "size-[30px] rounded-[50%] px-[6px] py-px text-[13.3333px] font-normal",
                playerControlLg:
                    "size-[44px] rounded-[50%] px-[6px] py-px text-[13.3333px] font-normal",
                playerSpeed:
                    "h-[32px] min-w-[50px] justify-center rounded-[9px] px-[12px] text-[12.5px]",
                playerTagAdd:
                    "h-[22px] gap-[5px] rounded-[6px] px-[8px] text-[11px] font-semibold leading-normal has-[>svg]:px-[8px] [&_svg:not([class*='size-'])]:size-3",
                playerTagChip:
                    "h-[22px] w-fit gap-[5px] rounded-[6px] py-0 pl-[7px] pr-[9px] text-[11.5px] font-semibold leading-normal [&_svg:not([class*='size-'])]:size-[11px] [&_svg]:stroke-2",
                playerTagOverflow:
                    "h-[22px] gap-[4px] rounded-[6px] px-[8px] text-[11px] font-semibold leading-normal",
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
