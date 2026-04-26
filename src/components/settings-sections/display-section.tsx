"use client";

import { Monitor } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useLanguage } from "@/components/language-provider";
import { SettingsSectionSkeleton } from "@/components/settings/settings-skeletons";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useDisplaySettingsStore } from "@/features/settings/display-settings-store";
import type { UiLanguage } from "@/lib/i18n";
import {
    type BrowserTimeoutHandle,
    startBrowserTimeout,
    stopBrowserTimeout,
} from "@/lib/platform/browser-shell";
import type { RecordingListSortOrder } from "@/services/display-settings";
import type { DateTimeFormat } from "@/types/common";

export function DisplaySection() {
    const { t } = useLanguage();
    const {
        settings: {
            uiLanguage,
            dateTimeFormat,
            recordingListSortOrder,
            itemsPerPage,
            theme,
        },
        hasLoaded,
        isLoading,
        isSaving,
        updateDisplaySettings,
    } = useDisplaySettingsStore();
    const [itemsPerPageInput, setItemsPerPageInput] = useState(itemsPerPage);
    const saveTimeoutRef = useRef<BrowserTimeoutHandle>(null);

    const dateTimeFormatOptions = [
        {
            label: t("display.relative"),
            value: "relative",
            description: t("display.relativeDescription"),
        },
        {
            label: t("display.absolute"),
            value: "absolute",
            description: t("display.absoluteDescription"),
        },
    ];

    const sortOrderOptions = [
        { label: t("display.newestFirst"), value: "newest" },
        { label: t("display.oldestFirst"), value: "oldest" },
        { label: t("display.byName"), value: "name" },
    ];

    const themeOptions = [
        { label: t("display.light"), value: "light" },
        { label: t("display.dark"), value: "dark" },
        {
            label: t("display.system"),
            value: "system",
            description: t("display.systemDescription"),
        },
    ];

    useEffect(() => {
        setItemsPerPageInput(itemsPerPage);
    }, [itemsPerPage]);

    useEffect(() => {
        if (hasLoaded && dateTimeFormat === "iso") {
            void updateDisplaySettings({ dateTimeFormat: "absolute" }).catch(
                () => {
                    toast.error(t("common.saveFailed"));
                },
            );
        }
    }, [dateTimeFormat, hasLoaded, t, updateDisplaySettings]);

    useEffect(() => {
        return () => {
            if (saveTimeoutRef.current) {
                stopBrowserTimeout(saveTimeoutRef.current);
            }
        };
    }, []);

    const handleDisplaySettingChange = (
        updates: {
            uiLanguage?: UiLanguage;
            dateTimeFormat?: DateTimeFormat;
            recordingListSortOrder?: RecordingListSortOrder;
            itemsPerPage?: number;
            theme?: "system" | "light" | "dark";
        },
        debounceMs?: number,
    ) => {
        const persistSettings = () => {
            void updateDisplaySettings(updates).catch(() => {
                toast.error(t("common.saveFailed"));
            });
        };

        if (!debounceMs) {
            persistSettings();
            return;
        }

        if (saveTimeoutRef.current) {
            stopBrowserTimeout(saveTimeoutRef.current);
        }

        saveTimeoutRef.current = startBrowserTimeout(
            persistSettings,
            debounceMs,
        );
    };

    if (isLoading && !hasLoaded) {
        return <SettingsSectionSkeleton cards={4} fieldsPerCard={1} />;
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                    <Monitor />
                    {t("settingsDialog.sections.appearance")}
                </h2>
                <p className="text-sm text-muted-foreground">
                    {t("display.title")}
                </p>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
                <Card className="gap-5">
                    <CardHeader>
                        <CardTitle>{t("display.language")}</CardTitle>
                        <CardDescription>
                            {t("display.languageDescription")}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="ui-language">
                                {t("display.language")}
                            </Label>
                            <Select
                                value={uiLanguage}
                                onValueChange={(value) =>
                                    void handleDisplaySettingChange({
                                        uiLanguage: value as UiLanguage,
                                    })
                                }
                                disabled={isSaving}
                            >
                                <SelectTrigger
                                    id="ui-language"
                                    className="w-full"
                                >
                                    <SelectValue>
                                        {uiLanguage === "en"
                                            ? t("display.english")
                                            : t("display.chinese")}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        <SelectItem value="zh-CN">
                                            {t("display.chinese")}
                                        </SelectItem>
                                        <SelectItem value="en">
                                            {t("display.english")}
                                        </SelectItem>
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>

                <Card className="gap-5">
                    <CardHeader>
                        <CardTitle>{t("display.theme")}</CardTitle>
                        <CardDescription>
                            {t("display.systemDescription")}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2">
                        <Label htmlFor="theme">{t("display.theme")}</Label>
                        <Select
                            value={theme}
                            onValueChange={(value) =>
                                void handleDisplaySettingChange({
                                    theme: value as "system" | "light" | "dark",
                                })
                            }
                            disabled={isSaving}
                        >
                            <SelectTrigger id="theme" className="w-full">
                                <SelectValue>
                                    {themeOptions.find(
                                        (option) => option.value === theme,
                                    )?.label || t("display.system")}
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    {themeOptions.map((option) => (
                                        <SelectItem
                                            key={option.value}
                                            value={option.value}
                                        >
                                            <div className="flex flex-col gap-1">
                                                <span>{option.label}</span>
                                                {option.description ? (
                                                    <span className="text-xs text-muted-foreground">
                                                        {option.description}
                                                    </span>
                                                ) : null}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                    </CardContent>
                </Card>

                <Card className="gap-5">
                    <CardHeader>
                        <CardTitle>{t("display.dateTimeFormat")}</CardTitle>
                        <CardDescription>
                            {t("display.relativeDescription")}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2">
                        <Label htmlFor="date-time-format">
                            {t("display.dateTimeFormat")}
                        </Label>
                        <Select
                            value={
                                dateTimeFormat === "iso"
                                    ? "absolute"
                                    : dateTimeFormat
                            }
                            onValueChange={(value) =>
                                void handleDisplaySettingChange({
                                    dateTimeFormat: value as DateTimeFormat,
                                })
                            }
                            disabled={isSaving}
                        >
                            <SelectTrigger
                                id="date-time-format"
                                className="w-full"
                            >
                                <SelectValue>
                                    {dateTimeFormatOptions.find(
                                        (option) =>
                                            option.value ===
                                            (dateTimeFormat === "iso"
                                                ? "absolute"
                                                : dateTimeFormat),
                                    )?.label || t("display.relative")}
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    {dateTimeFormatOptions.map((option) => (
                                        <SelectItem
                                            key={option.value}
                                            value={option.value}
                                        >
                                            <div className="flex flex-col gap-1">
                                                <span>{option.label}</span>
                                                <span className="text-xs text-muted-foreground">
                                                    {option.description}
                                                </span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                    </CardContent>
                </Card>

                <Card className="gap-5">
                    <CardHeader>
                        <CardTitle>{t("display.sortOrder")}</CardTitle>
                        <CardDescription>
                            {t("display.itemsPerPage")}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="sort-order">
                                {t("display.sortOrder")}
                            </Label>
                            <Select
                                value={recordingListSortOrder}
                                onValueChange={(value) =>
                                    void handleDisplaySettingChange({
                                        recordingListSortOrder:
                                            value as RecordingListSortOrder,
                                    })
                                }
                                disabled={isSaving}
                            >
                                <SelectTrigger
                                    id="sort-order"
                                    className="w-full"
                                >
                                    <SelectValue>
                                        {sortOrderOptions.find(
                                            (option) =>
                                                option.value ===
                                                recordingListSortOrder,
                                        )?.label || t("display.newestFirst")}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        {sortOrderOptions.map((option) => (
                                            <SelectItem
                                                key={option.value}
                                                value={option.value}
                                            >
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex flex-col gap-2">
                            <Label htmlFor="items-per-page">
                                {t("display.itemsPerPage")}
                            </Label>
                            <Input
                                id="items-per-page"
                                type="number"
                                min={10}
                                max={100}
                                value={itemsPerPageInput}
                                disabled={isSaving}
                                onChange={(event) => {
                                    const value = Number.parseInt(
                                        event.target.value,
                                        10,
                                    );
                                    if (
                                        !Number.isNaN(value) &&
                                        value >= 10 &&
                                        value <= 100
                                    ) {
                                        setItemsPerPageInput(value);
                                        void handleDisplaySettingChange(
                                            { itemsPerPage: value },
                                            500,
                                        );
                                    }
                                }}
                            />
                            <p className="text-xs text-muted-foreground">
                                {t("display.itemsPerPage")} (10-100)
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
