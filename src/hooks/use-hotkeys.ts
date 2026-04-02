"use client";

import { useEffect, useRef } from "react";

type Modifier = "ctrl" | "shift" | "alt" | "meta" | "mod";

interface Options {
  enabled?: boolean;
  preventDefault?: boolean;
  enableOnContentEditable?: boolean;
  enableOnFormTags?: boolean;
}

const DEFAULT_OPTIONS: Options = {
  enabled: true,
  preventDefault: true,
  enableOnContentEditable: false,
  enableOnFormTags: false,
};

export function useHotkeys(
  keyCombo: string,
  callback: (e: KeyboardEvent) => void,
  options: Options = {},
) {
  const { enabled, preventDefault, enableOnContentEditable, enableOnFormTags } =
    {
      ...DEFAULT_OPTIONS,
      ...options,
    };

  // Keep a ref to the callback to avoid re-binding the event listener on every render
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;

    const isTypingTarget = (target: HTMLElement | null): boolean => {
      if (!target) return false;

      // Direct form controls
      const tag = target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
        return true;
      }

      // contenteditable regions
      if (target.isContentEditable) return true;

      // Nested within editable/form controls
      if (
        target.closest(
          "input, textarea, select, [contenteditable='true'], [contenteditable='']",
        )
      ) {
        return true;
      }

      return false;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Parse the key combo
      const keys = keyCombo
        .toLowerCase()
        .split("+")
        .map((k) => k.trim());
      const mainKey = keys[keys.length - 1];
      const requiredModifiers = keys.slice(0, -1) as Modifier[];
      const hasAnyRequiredModifier = requiredModifiers.length > 0;

      // Check modifiers
      // Check modifiers - STRICT MODE
      // We want to ensure that ONLY the required modifiers are pressed.
      const pressedModifiers: Modifier[] = [];
      if (e.ctrlKey) pressedModifiers.push("ctrl");
      if (e.shiftKey) pressedModifiers.push("shift");
      if (e.altKey) pressedModifiers.push("alt");
      if (e.metaKey) pressedModifiers.push("meta");

      // Special handling for 'mod' which maps to meta or ctrl depending on OS,
      // but in the parsed 'requiredModifiers', it appears as 'mod'.
      // We need to match what the user defined.

      // Actually, simpler approach:
      // 1. Check if all required modifiers are present.
      // 2. Check if NO other modifiers are present.

      const requiredSet = new Set(requiredModifiers);

      // Handle 'mod' alias: if 'mod' is required, we check for meta OR ctrl (platform dependent usually, but we define mod as meta||ctrl)
      // But for strict checking we need to know WHICH one was pressed to count it as "handled" and not "extra".

      const hasCtrl = e.ctrlKey;
      const hasShift = e.shiftKey;
      const hasAlt = e.altKey;
      const hasMeta = e.metaKey;

      // Check if required matches
      for (const req of requiredModifiers) {
        if (req === "shift" && !hasShift) return;
        if (req === "alt" && !hasAlt) return;
        if (req === "ctrl" && !hasCtrl) return;
        if (req === "meta" && !hasMeta) return;
        if (req === "mod") {
          if (!hasMeta && !hasCtrl) return;
        }
      }

      // Check for extras

      // If strict, we shouldn't allow extra modifiers.
      // E.g. if hotkey is 'k', and we press 'cmd+k', it should NOT match.
      // Currently our requiredModifiers for 'k' is empty.
      // So we just check if any modifier is pressed.

      // The only complexity is 'mod'. If 'mod' is required, then EITHER ctrl OR meta is allowed, but not both unless specified?
      // Usually 'mod' means primary modifier.

      const isModRequired = requiredSet.has("mod");

      if (hasShift && !requiredSet.has("shift")) return;
      if (hasAlt && !requiredSet.has("alt")) return;

      // For Ctrl and Meta, we need to be careful about 'mod'
      if (isModRequired) {
        // If mod is required, we expect either meta or ctrl.
        // If we have meta, ctrl is extra (unless ctrl is ALSO required explicitly, which is weird but possible)
        // If we have ctrl, meta is extra (unless meta is ALSO required)
        // Let's assume 'mod' covers the primary, and specific 'ctrl'/'meta' covers specific needs.

        // If keys has 'mod', we are good if hasMeta OR hasCtrl.
        // But if hasMeta AND hasCtrl, is that allowed? 'mod' matches one. The other is extra?
        // Standard behavior: 'mod+k' usually matches cmd+k. cmd+ctrl+k is usually NOT matched unless 'mod+ctrl+k'.

        if (
          hasMeta &&
          hasCtrl &&
          !requiredSet.has("ctrl") &&
          !requiredSet.has("meta")
        )
          return; // Both pressed but only mod required? questionable.
        // Let's keep it simple: if 'mod' is used, we treat the active one as "allowed".
      } else {
        if (hasCtrl && !requiredSet.has("ctrl")) return;
        if (hasMeta && !requiredSet.has("meta")) return;
      }

      // Check exact modifiers (ensure no EXTRA modifiers are pressed)
      // This is a simple implementation; complex one would check all possible modifiers
      // For now, if we ask for 'shift+k', we want shift+k.
      // If user holds 'ctrl+shift+k', it might trigger 'shift+k' which is usually fine,
      // but stricter checks might be needed for conflicts.
      // Let's stick to "required match" for now.

      // Check the main key
      // e.key is case sensitive (K vs k). We lower case everything for comparison.
      const keyMatch = e.key.toLowerCase() === mainKey;

      // On Mac, Option + Key often produces a different character (e.g. Option+X -> ~)
      // We check e.code as a fallback if Alt is involved.
      const codeFallbackMatch =
        e.altKey && e.code.toLowerCase() === `key${mainKey}`;

      if (!keyMatch && !codeFallbackMatch) return;

      // Check for input focus safety
      const target = e.target as HTMLElement | null;
      const activeEl = document.activeElement as HTMLElement | null;
      const inTypingContext = isTypingTarget(target) || isTypingTarget(activeEl);

      // Safety net: never fire plain alphabet shortcuts while user is typing.
      // Example: "v" should not toggle visibility while typing value text.
      const isSingleAlphabetShortcut = /^[a-z]$/.test(mainKey);
      if (inTypingContext && isSingleAlphabetShortcut && !hasAnyRequiredModifier) {
        return;
      }

      if (inTypingContext) {
        if (
          !enableOnFormTags &&
          (target?.tagName === "INPUT" ||
            target?.tagName === "TEXTAREA" ||
            target?.tagName === "SELECT" ||
            activeEl?.tagName === "INPUT" ||
            activeEl?.tagName === "TEXTAREA" ||
            activeEl?.tagName === "SELECT")
        )
          return;
        if (
          !enableOnContentEditable &&
          (target?.isContentEditable || activeEl?.isContentEditable)
        )
          return;
      }

      if (preventDefault) {
        e.preventDefault();
      }

      callbackRef.current(e);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    keyCombo,
    enabled,
    preventDefault,
    enableOnContentEditable,
    enableOnFormTags,
  ]);
}
