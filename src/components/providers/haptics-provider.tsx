"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { setHapticsState } from "@/lib/utils/haptic";

const HAPTICS_STORAGE_KEY = "envault_haptics_enabled";

interface HapticsContextType {
  isHapticsEnabled: boolean;
  setIsHapticsEnabled: (enabled: boolean) => void;
}

const HapticsContext = createContext<HapticsContextType | undefined>(undefined);

export function HapticProvider({ children }: { children: React.ReactNode }) {
  const [isHapticsEnabled, setIsHapticsEnabledState] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }

    const stored = window.localStorage.getItem(HAPTICS_STORAGE_KEY);
    return stored === null ? true : stored === "true";
  });

  useEffect(() => {
    setHapticsState(isHapticsEnabled);
  }, [isHapticsEnabled]);

  const setIsHapticsEnabled = (enabled: boolean) => {
    setIsHapticsEnabledState(enabled);
    setHapticsState(enabled);
    localStorage.setItem(HAPTICS_STORAGE_KEY, String(enabled));
  };

  return (
    <HapticsContext.Provider value={{ isHapticsEnabled, setIsHapticsEnabled }}>
      {children}
    </HapticsContext.Provider>
  );
}

export function useHaptics() {
  const context = useContext(HapticsContext);
  if (context === undefined) {
    throw new Error("useHaptics must be used within a HapticProvider");
  }
  return context;
}
