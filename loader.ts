interface ImageLoaderProps {
    src: string;
    width?: number;
    quality?: number;
}

function isDevelopmentRuntime() {
    return process.env.NODE_ENV === "development";
}

function absoluteImageUrl(src: string) {
    const appUrl = process.env.APP_URL ?? "http://localhost:3001";
    const normalizedOrigin = appUrl.replace(/\/$/, "");
    const normalizedSrc = src.startsWith("/") ? src : `/${src}`;

    return `${normalizedOrigin}${normalizedSrc}`;
}

export default function imageLoader({
    src,
    width = 800,
    quality = 85,
}: ImageLoaderProps): string {
    const isLocal = !src.startsWith("http");

    // In development, return local images directly
    if (isLocal && isDevelopmentRuntime()) {
        return src;
    }

    const query = new URLSearchParams();
    const imageOptimizationApi = "https://wsrv.nl";
    const fullSrc = isLocal ? absoluteImageUrl(src) : src;

    query.set("url", fullSrc);
    query.set("w", width.toString());
    query.set("q", quality.toString());
    query.set("output", "webp");

    return `${imageOptimizationApi}?${query.toString()}`;
}
