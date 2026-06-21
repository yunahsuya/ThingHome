import { withSerwist } from "@serwist/turbopack";
import type { NextConfig } from "next";
import { BASE_PATH } from "./lib/site";

const nextConfig: NextConfig = {
  output: "export",
  basePath: BASE_PATH,
  assetPrefix: `${BASE_PATH}/`,
  images: {
    unoptimized: true,
  },
  ...(process.env.NODE_ENV === "development"
    ? {
        async redirects() {
          return [
            {
              source: "/",
              destination: `${BASE_PATH}/`,
              permanent: false,
              basePath: false,
            },
          ];
        },
      }
    : {}),
};

export default withSerwist(nextConfig);
