"use client";

import { useEffect } from "react";
import { generateHmacSignature } from "@/lib/utils/hmac";

export function HmacProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const originalFetch = window.fetch;

    window.fetch = async (...args) => {
      const [resource, configRaw] = args;

      // Ensure config object exists
      const config = configRaw || {};

      // Only sign mutating requests
      const method = (config.method || "GET").toUpperCase();
      if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
        const existingHeaders = new Headers(config.headers || {});

        // Respect route-specific signatures (e.g. HITL approve API) and do not overwrite.
        if (existingHeaders.has("X-Signature") || existingHeaders.has("x-signature")) {
          return originalFetch(resource, config);
        }

        const timestamp = Date.now().toString();
        const secret =
          process.env.NEXT_PUBLIC_API_SIGNATURE_SALT ||
          "default_dev_secret_so_it_works";

        // Extract payload
        let payload = "";
        if (config.body) {
          if (typeof config.body === "string") {
            payload = config.body;
          } else if (
            config.body instanceof FormData ||
            config.body instanceof URLSearchParams
          ) {
            // For complex bodies, we might not easily stringify without altering original Request setup
            // In Next.js Server Actions, Next passes heavily encoded FormData or strings.
            // For simple implementation, stringify if possible or just use a placeholder for FormData.
            // Ideally URLSearchParams can be toString()
            if (config.body instanceof URLSearchParams) {
              payload = config.body.toString();
            } else {
              // Note: strictly signing FormData requires intercepting the stream/boundary,
              // which is complex. For FormData, we might just sign an empty string and rely
              // on the timestamp to prevent replays, but this lowers the integrity check.
              payload = "";
            }
          } else {
            // Unhandled body types (Blob, ArrayBuffer, etc)
            payload = "";
          }
        }

        try {
          const signature = await generateHmacSignature(
            payload,
            timestamp,
            secret,
          );

          // Add headers
          const headers = existingHeaders;
          headers.set("X-Timestamp", timestamp);
          headers.set("X-Signature", signature);

          config.headers = headers;
        } catch (error) {
          console.error("Failed to generate HMAC signature:", error);
        }
      }

      return originalFetch(resource, config);
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return <>{children}</>;
}
