import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    output: "standalone",
    turbopack: {
        root: process.cwd(),
    },
    images: {
        loader: "custom",
        loaderFile: "./loader.ts",
        remotePatterns: [],
    },
};

export default nextConfig;
