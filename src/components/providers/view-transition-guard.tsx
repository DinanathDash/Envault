"use client";

import { useEffect } from "react";

function getErrorNameAndMessage(reason: unknown): {
  name: string;
  message: string;
} | null {
  if (!reason || typeof reason !== "object") return null;
  const maybe = reason as { name?: unknown; message?: unknown };
  const name = typeof maybe.name === "string" ? maybe.name : "";
  const message = typeof maybe.message === "string" ? maybe.message : "";
  return { name, message };
}

function isIgnoredViewTransitionError(reason: unknown): boolean {
  const data = getErrorNameAndMessage(reason);
  if (!data) return false;

  const name = data.name.toLowerCase();
  const msg = data.message.toLowerCase();

  const isViewTransitionMessage =
    msg.includes("view transition") ||
    msg.includes("startviewtransition") ||
    msg.includes("update callback");

  if (!isViewTransitionMessage) return false;

  const hiddenStateError =
    name === "invalidstateerror" &&
    msg.includes("visibility state") &&
    msg.includes("hidden");

  const timeoutError = name === "timeouterror" && msg.includes("timed out");

  const rscFallbackError =
    msg.includes("failed to fetch rsc payload") || msg.includes("load failed");

  return hiddenStateError || timeoutError || rscFallbackError;
}

function createNoopTransition() {
  const done = Promise.resolve();
  return {
    ready: done,
    finished: done,
    updateCallbackDone: done,
    skipTransition: () => {},
  };
}

export function ViewTransitionGuard() {
  useEffect(() => {
    const doc = document as Document & {
      startViewTransition?: (update?: () => unknown) => {
        ready?: Promise<unknown>;
        finished?: Promise<unknown>;
        updateCallbackDone?: Promise<unknown>;
        skipTransition?: () => void;
      };
    };

    // In dev, route compiles can exceed native transition callback timeout.
    // Keep the provider/hooks active but disable browser-native transitions.
    if (process.env.NODE_ENV === "development") {
      const mutableDoc = doc as unknown as { startViewTransition?: unknown };
      const hadOwn = Object.prototype.hasOwnProperty.call(
        mutableDoc,
        "startViewTransition",
      );
      const ownValue = mutableDoc.startViewTransition;
      mutableDoc.startViewTransition = undefined;

      return () => {
        if (hadOwn) {
          mutableDoc.startViewTransition = ownValue;
        } else {
          delete mutableDoc.startViewTransition;
        }
      };
    }

    const originalStartViewTransition = doc.startViewTransition?.bind(document);

    if (originalStartViewTransition) {
      doc.startViewTransition = ((update?: () => unknown) => {
        // If tab is hidden, skip transitions entirely and run update directly.
        if (document.visibilityState !== "visible") {
          try {
            Promise.resolve(update?.()).catch(() => {});
          } catch {
            // swallow known transition update errors
          }
          return createNoopTransition();
        }

        try {
          const transition = originalStartViewTransition(update);
          // Prevent unhandled promise rejections from transition internals.
          transition?.ready?.catch(() => {});
          transition?.finished?.catch(() => {});
          transition?.updateCallbackDone?.catch(() => {});
          return transition;
        } catch (error) {
          if (isIgnoredViewTransitionError(error)) {
            try {
              Promise.resolve(update?.()).catch(() => {});
            } catch {
              // swallow known transition update errors
            }
            return createNoopTransition();
          }
          throw error;
        }
      }) as typeof doc.startViewTransition;
    }

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isIgnoredViewTransitionError(event.reason)) {
        // Known browser/runtime View Transition rejections for hidden tab/timeouts.
        event.preventDefault();
      }
    };

    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
      if (originalStartViewTransition) {
        doc.startViewTransition = originalStartViewTransition;
      }
    };
  }, []);

  return null;
}
