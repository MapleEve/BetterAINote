"use client";

import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

type ToggleGroupLayout =
    | "default"
    | "iconGrid"
    | "recordingTagColorPicker"
    | "recordingTagIconPicker"
    | "speakerReviewMode"
    | "librarySearchScope"
    | "dashboardRecordingTimeFilter";
type ToggleGroupSemanticSpacing =
    | "recordingTagColorPicker"
    | "recordingTagQuickColorPicker"
    | "recordingTagIconPicker"
    | "speakerReviewMode"
    | "dashboardRecordingTimeFilter";
type ToggleGroupSpacing = number | ToggleGroupSemanticSpacing;

const toggleGroupSpacingValues: Record<ToggleGroupSemanticSpacing, number> = {
    dashboardRecordingTimeFilter: 1,
    recordingTagColorPicker: 2,
    recordingTagQuickColorPicker: 1,
    recordingTagIconPicker: 2,
    speakerReviewMode: 1,
};

function resolveToggleGroupSpacing(spacing: ToggleGroupSpacing) {
    return typeof spacing === "number"
        ? spacing
        : toggleGroupSpacingValues[spacing];
}

const toggleGroupItemVariants = cva(
    "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground [&>svg]:pointer-events-none [&>svg]:size-4",
    {
        variants: {
            variant: {
                default: "",
                outline: "border border-input bg-background shadow-xs",
                librarySearchScopeItem:
                    "border border-input bg-background shadow-xs data-[state=on]:border-primary/30 data-[state=on]:bg-primary/10 data-[state=on]:text-primary",
                dashboardRecordingTimeFilter:
                    "border border-input bg-background shadow-xs data-[state=on]:border-primary/30 data-[state=on]:bg-primary/10 data-[state=on]:text-primary data-[sot-state=selected]:border-primary/30 data-[sot-state=selected]:bg-primary/10 data-[sot-state=selected]:text-primary [&_[data-sot-part=dashboard-recording-time-filter-count]]:rounded-[4px] [&_[data-sot-part=dashboard-recording-time-filter-count]]:bg-[var(--dashboard-recording-time-filter-count-bg)] [&_[data-sot-part=dashboard-recording-time-filter-count]]:px-1 [&_[data-sot-part=dashboard-recording-time-filter-count]]:font-mono [&_[data-sot-part=dashboard-recording-time-filter-count]]:text-[10px] [&_[data-sot-part=dashboard-recording-time-filter-count]]:font-medium [&_[data-sot-part=dashboard-recording-time-filter-count]]:text-[var(--fg-tertiary)] [&_[data-sot-part=dashboard-recording-time-filter-count]]:opacity-70 data-[state=on]:[&_[data-sot-part=dashboard-recording-time-filter-count]]:bg-[var(--dashboard-recording-time-filter-count-selected-bg)] data-[state=on]:[&_[data-sot-part=dashboard-recording-time-filter-count]]:text-[var(--accent)] data-[sot-state=selected]:[&_[data-sot-part=dashboard-recording-time-filter-count]]:bg-[var(--dashboard-recording-time-filter-count-selected-bg)] data-[sot-state=selected]:[&_[data-sot-part=dashboard-recording-time-filter-count]]:text-[var(--accent)]",
                recordingTagColorPicker: "",
                recordingTagIconPicker: "",
                recordingTagIconOption:
                    "border border-input bg-background shadow-xs",
                sotSegmented: "border border-input bg-background shadow-xs",
                speakerReviewMode: "",
                swatch:
                    "group/swatch [display:grid] place-items-center rounded-[50%] border-2 border-transparent bg-[var(--toggle-swatch-color)] p-0 text-[13.3333px] font-normal leading-[0] text-[var(--fg-primary)] shadow-none hover:bg-[var(--toggle-swatch-color)] hover:text-[var(--fg-primary)] data-[state=on]:border-[var(--toggle-swatch-selected-border)] data-[state=on]:bg-[var(--toggle-swatch-color)] data-[state=on]:text-[var(--fg-primary)] data-[state=on]:shadow-[var(--toggle-swatch-selected-shadow)]",
            },
            tone: {
                default: "",
                blue: "",
                green: "",
                orange: "",
                purple: "",
                red: "",
                slate: "",
            },
            size: {
                default: "h-9 px-3",
                sm: "h-8 px-2",
                librarySearchScopeItem:
                    "h-6 rounded-full px-2.5 text-xs",
                dashboardRecordingTimeFilter: "h-8 px-2",
                recordingTagColorPicker: "h-8 px-2",
                recordingTagIconPicker: "h-8 px-2",
                recordingTagIconOption: "size-7 min-w-0 shrink-0 p-0",
                sotSegmentedSm: "h-8 px-2",
                speakerReviewModeItem: "h-8 px-2.5",
                swatch: "size-[18px] min-w-0 p-0",
                iconPicker: "size-7 min-w-0 shrink-0 p-0",
                lg: "h-10 px-4",
            },
        },
        defaultVariants: {
            variant: "default",
            tone: "default",
            size: "default",
        },
    },
);

type ToggleGroupContextValue = VariantProps<typeof toggleGroupItemVariants> & {
    spacing: ToggleGroupSpacing;
    spacingValue: number;
};

const ToggleGroupContext = React.createContext<ToggleGroupContextValue>({
    variant: "default",
    size: "default",
    tone: "default",
    spacing: 0,
    spacingValue: 0,
});

type ToggleGroupProps = React.ComponentProps<typeof ToggleGroupPrimitive.Root> &
    VariantProps<typeof toggleGroupItemVariants> & {
        layout?: ToggleGroupLayout;
        spacing?: ToggleGroupSpacing;
    };

function ToggleGroup({
    className,
    layout = "default",
    variant = "default",
    size = "default",
    tone = "default",
    spacing = 0,
    children,
    style,
    ...props
}: ToggleGroupProps) {
    const spacingValue = resolveToggleGroupSpacing(spacing);
    const contextValue = React.useMemo(
        () => ({ variant, size, tone, spacing, spacingValue }),
        [variant, size, tone, spacing, spacingValue],
    );

    return (
        <ToggleGroupPrimitive.Root
            data-slot="toggle-group"
            data-variant={variant}
            data-size={size}
            data-layout={layout}
            data-spacing={spacing}
            data-spacing-value={spacingValue}
            style={{ gap: `${spacingValue * 0.25}rem`, ...style }}
            className={cn(
                "group/toggle-group flex w-fit items-center rounded-md",
                layout === "iconGrid" && "grid grid-cols-6",
                layout === "recordingTagColorPicker" && "flex-wrap",
                layout === "recordingTagIconPicker" && "grid grid-cols-6",
                layout === "speakerReviewMode" && "flex-nowrap",
                layout === "librarySearchScope" &&
                    "w-full flex-wrap rounded-none border-b border-border bg-muted/40 p-2",
                layout === "dashboardRecordingTimeFilter" &&
                    "mt-2.5 flex-wrap",
                className,
            )}
            {...props}
        >
            <ToggleGroupContext.Provider value={contextValue}>
                {children}
            </ToggleGroupContext.Provider>
        </ToggleGroupPrimitive.Root>
    );
}

type ToggleGroupItemProps = React.ComponentProps<
    typeof ToggleGroupPrimitive.Item
> &
    VariantProps<typeof toggleGroupItemVariants>;

function ToggleGroupItem({
    className,
    tone,
    variant,
    size,
    ...props
}: ToggleGroupItemProps) {
    const context = React.useContext(ToggleGroupContext);
    const itemVariant = variant ?? context.variant;
    const itemSize = size ?? context.size;
    const itemTone = tone ?? context.tone;

    return (
        <ToggleGroupPrimitive.Item
            data-slot="toggle-group-item"
            data-variant={itemVariant}
            data-tone={itemTone}
            data-size={itemSize}
            data-spacing={context.spacing}
            className={cn(
                toggleGroupItemVariants({
                    variant: itemVariant,
                    tone: itemTone,
                    size: itemSize,
                }),
                context.spacingValue === 0 &&
                    "rounded-none first:rounded-l-md last:rounded-r-md data-[variant=outline]:border-l-0 first:data-[variant=outline]:border-l data-[variant=sotSegmented]:border-l-0 first:data-[variant=sotSegmented]:border-l",
                className,
            )}
            {...props}
        />
    );
}

function ToggleGroupSwatchDot({
    className,
    ...props
}: React.ComponentProps<"span">) {
    return (
        <span
            data-slot="toggle-group-swatch-dot"
            className={cn(
                "block size-[6px] rounded-full bg-[var(--swatch-selection-dot-bg)] opacity-0 group-data-[state=on]/swatch:opacity-100",
                className,
            )}
            {...props}
        />
    );
}

export {
    ToggleGroup,
    ToggleGroupItem,
    ToggleGroupSwatchDot,
    toggleGroupItemVariants,
};
