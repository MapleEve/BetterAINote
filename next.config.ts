import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    output: "standalone",
    allowedDevOrigins: ["127.0.0.1"],
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
