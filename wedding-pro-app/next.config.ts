// next.config.ts
import type { NextConfig } from "next";
import withPWA from "next-pwa";

const baseConfig: NextConfig = {
  // ✅ your shared Next.js settings
  experimental: {
    // example: scroll restoration, etc.
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        port: "",
        pathname: "/**",
      },
    ],
  },
};

/** next-pwa options — only for Webpack builds */
const pwaConfig = {
  dest: "public",
  register: false,
  skipWaiting: true,
  disable: false,      // we’ll override this below
  buildExcludes: [/middleware-manifest\.json$/, /_next\/app-build-manifest\.json$/],
  runtimeCaching: [
    {
      urlPattern: /^https?.*/,
      handler: "NetworkFirst",
      method: "GET",
      options: {
        cacheName: "offlineCache",
        expiration: { maxEntries: 200, maxAgeSeconds: 24 * 60 * 60 },
        networkTimeoutSeconds: 10,
        plugins: [
          {
            // cache only GET requests; fix opaqueredirect responses
            cacheWillUpdate: async ({ request, response }: { request: Request; response: Response }) => {
              if (request.method !== "GET") return null; // Changed false to null
              try {
                if (response && response.type === "opaqueredirect") {
                  const body = await response.clone().arrayBuffer();
                  return new Response(body, {
                    status: 200,
                    statusText: "OK",
                    headers: response.headers,
                  });
                }
              } catch (error) {
                console.error('[SW] cacheWillUpdate: Error processing opaqueredirect:', error, request.url);
                return null; // Return null on error
              }
              return response;
            },
          },
        ],
      },
    },
  ],
};

const isTurbopack = !!process.env.TURBOPACK;   // set automatically by `next dev --turbo`
const isDev      = process.env.NODE_ENV === "development";

// ⚡ When Turbopack (or plain dev) is running, return bare config.
// 🛞 When Webpack is used (prod build / prod start), enable next-pwa.
export default isTurbopack || isDev
  ? baseConfig
  : withPWA({ ...pwaConfig, disable: false })(baseConfig);
