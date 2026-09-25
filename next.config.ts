import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * `@resvg/resvg-js` is a NATIVE binary, and a bundler cannot inline one (§6.91). Left to be bundled it
   * fails at runtime and the report quietly falls back to text where its charts should be — which is
   * exactly what happened: a plan with ten charts came out the same size as the one without them.
   */
  serverExternalPackages: ["@resvg/resvg-js"],

  /**
   * SECURITY HEADERS (§6.119).
   *
   * There were none. These four are the ones that cannot break a working app, which is why they go in now
   * and a Content-Security-Policy does not — Next's inline bootstrap needs a nonce, and a CSP added
   * carelessly fails in production in ways that never show up in development. That is its own job, done
   * deliberately, with `Content-Security-Policy-Report-Only` first.
   *
   * The valuable one here is X-Frame-Options. Without it a signed-in plan can be framed by another site,
   * and a business plan is exactly the sort of thing worth clickjacking somebody into sharing or deleting.
   *
   * HSTS is left out on purpose: Vercel already sends it for its own domains, and setting a long
   * max-age by hand is the kind of thing that is very hard to undo if the custom domain's certificate
   * ever goes wrong. It belongs with the domain (open item 9), not here.
   */
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        /* Nothing on this site should ever be rendered inside someone else's page. */
        { key: "X-Frame-Options", value: "DENY" },
        /* A response typed text/plain is text/plain, whatever the bytes look like to a sniffing browser. */
        { key: "X-Content-Type-Options", value: "nosniff" },
        /* A plan id in a path is not something to hand to every third-party host a client navigates to. */
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        /* This app asks for none of these, so nothing embedded in it should be able to either. */
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
      ],
    }];
  },
};

export default nextConfig;
