import { withSerwist } from "@serwist/turbopack";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/ThingHome",
  assetPrefix: "/ThingHome/",
  images: {
    unoptimized: true,
  },
};

export default withSerwist(nextConfig);
