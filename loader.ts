"use client";

import { absoluteUrl, isDev } from "@/lib/utils";

interface ImageLoaderProps {
    src: string;
    width?: number;
    quality?: number;
}

export default function imageLoader({
    src,
    width = 800,
    quality = 85,
}: ImageLoaderProps): string {
    const isLocal = !src.startsWith("http");

    // In development, return local images directly
    if (isLocal && isDev) {
        return src;
    }

    const query = new URLSearchParams();
    const imageOptimizationApi = "https://wsrv.nl";
    const fullSrc = isLocal ? absoluteUrl(src) : src;

    query.set("url", fullSrc);
    query.set("w", width.toString());
    query.set("q", quality.toString());
    query.set("output", "webp");

    return `${imageOptimizationApi}?${query.toString()}`;
}
