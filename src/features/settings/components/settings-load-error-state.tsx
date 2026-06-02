"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

interface SettingsLoadErrorStateProps {
    description: string;
    error: string;
    errorTestId: string;
    errorTitle: string;
    headingIcon: ReactNode;
    retryLabel: string;
    retryTestId: string;
    section: string;
    title: string;
    onRetry: () => void;
}

export function SettingsLoadErrorState({
    description,
    error,
    errorTestId,
    errorTitle,
    headingIcon,
    retryLabel,
    retryTestId,
    section,
    title,
    onRetry,
}: SettingsLoadErrorStateProps) {
    return (
        <div
            className="flex min-h-0 flex-col gap-5"
            data-settings-load-state="error"
            data-settings-section={section}
        >
            <div className="flex flex-col gap-2">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                    {headingIcon}
                    {title}
                </h2>
                <p className="text-sm text-muted-foreground">{description}</p>
            </div>

            <Card className="border-destructive/30 bg-destructive/5">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base text-destructive">
                        <AlertCircle className="size-4" />
                        {errorTitle}
                    </CardTitle>
                    <CardDescription
                        className="text-destructive/80"
                        data-testid={errorTestId}
                        role="alert"
                    >
                        {error}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button
                        type="button"
                        variant="outline"
                        data-testid={retryTestId}
                        onClick={onRetry}
                    >
                        <RefreshCw className="mr-2 size-3.5" />
                        {retryLabel}
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
