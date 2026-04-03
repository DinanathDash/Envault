export type HapticType =
  | "light"
  | "medium"
  | "heavy"
  | "cancel"
  | "success"
  | "error";

const HAPTIC_PATTERNS: Record<HapticType, number | number[]> = {
  light: 15,
  medium: 30,
  heavy: 50,
  cancel: [30, 40, 30],
  success: [20, 50, 20, 50, 50],
  error: [50, 50, 50, 50, 50],
};

const IOS_TICK_DELAYS: Record<HapticType, number[]> = {
  light: [0],
  medium: [0],
  heavy: [0],
  cancel: [0, 130],
  success: [0, 110, 220],
  error: [0, 100, 200, 300],
};

let iosFallbackInput: HTMLInputElement | null = null;
let iosFallbackLabel: HTMLLabelElement | null = null;

function getIOSFallbackElements(): {
  input: HTMLInputElement;
  label: HTMLLabelElement;
} | null {
  if (typeof document === "undefined") {
    return null;
  }

  if (
    iosFallbackInput &&
    iosFallbackLabel &&
    document.body.contains(iosFallbackLabel)
  ) {
    return { input: iosFallbackInput, label: iosFallbackLabel };
  }

  const label = document.createElement("label");
  label.setAttribute("aria-hidden", "true");
  label.style.position = "absolute";
  label.style.opacity = "0";
  label.style.pointerEvents = "none";
  label.style.width = "1px";
  label.style.height = "1px";
  label.style.overflow = "hidden";
  label.style.left = "-9999px";
  label.style.top = "0";

  const input = document.createElement("input");
  input.type = "checkbox";
  input.setAttribute("switch", "");
  input.tabIndex = -1;
  input.setAttribute("aria-hidden", "true");
  input.style.position = "absolute";
  input.style.opacity = "0";
  input.style.pointerEvents = "none";
  input.style.width = "1px";
  input.style.height = "1px";

  label.appendChild(input);

  const parent = document.body ?? document.documentElement;
  parent.appendChild(label);

  iosFallbackLabel = label;
  iosFallbackInput = input;
  return { input: iosFallbackInput, label: iosFallbackLabel };
}

function triggerIOSTick(elements: {
  input: HTMLInputElement;
  label: HTMLLabelElement;
}): void {
  // Ensure state changes each trigger to maximize native switch feedback reliability.
  elements.input.checked = !elements.input.checked;
  elements.label.click();
}

let isGlobalHapticsEnabled = true;

export function setHapticsState(enabled: boolean): void {
  isGlobalHapticsEnabled = enabled;
}

export function triggerHaptic(type: HapticType): void {
  if (!isGlobalHapticsEnabled) return;

  const pattern = HAPTIC_PATTERNS[type];

  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate(pattern);
    return;
  }

  if (typeof window !== "undefined" && !window.matchMedia("(pointer: coarse)").matches) {
    return;
  }

  const fallback = getIOSFallbackElements();
  if (!fallback) {
    return;
  }

  const tickDelays = IOS_TICK_DELAYS[type];
  for (const delay of tickDelays) {
    if (delay === 0) {
      triggerIOSTick(fallback);
      continue;
    }

    window.setTimeout(() => triggerIOSTick(fallback), delay);
  }
}

export const haptic = (): void => {
  triggerHaptic("medium");
};
