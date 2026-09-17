import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * `@resvg/resvg-js` is a NATIVE binary, and a bundler cannot inline one (§6.91). Left to be bundled it
   * fails at runtime and the report quietly falls back to text where its charts should be — which is
   * exactly what happened: a plan with ten charts came out the same size as the one without them.
   */
  serverExternalPackages: ["@resvg/resvg-js"],
};

export default nextConfig;
