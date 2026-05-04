"use client";

import { useEffect, useState, useRef } from "react";
import { useInView, useSpring } from "framer-motion";

interface AnimatedStatProps {
  value: string;
}

export function AnimatedStat({ value }: AnimatedStatProps) {
  const [isInView, setIsInView] = useState(false);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  useEffect(() => {
    if (inView && !isInView) {
      setIsInView(true);
    }
  }, [inView, isInView]);

  const trimmedValue = value.trim();
  const animatableMatch = trimmedValue.match(
    /^([^0-9]*)([0-9]+(?:\.[0-9]+)?)([^0-9]*)$/,
  );
  const isAnimatable = Boolean(animatableMatch) && !trimmedValue.includes("-");
  const prefix = animatableMatch?.[1] ?? "";
  const numericValue = animatableMatch ? parseFloat(animatableMatch[2]) : 0;
  const suffix = animatableMatch?.[3] ?? "";

  const spring = useSpring(0, {
    damping: 50,
    stiffness: 200,
    mass: 1,
  });

  useEffect(() => {
    if (isInView && isAnimatable) {
      spring.set(numericValue);
    }
  }, [isInView, isAnimatable, numericValue, spring]);

  const [displayValue, setDisplayValue] = useState(isAnimatable ? "0" : value);

  useEffect(() => {
    if (!isAnimatable) {
      setDisplayValue(value);
    }
  }, [isAnimatable, value]);

  useEffect(() => {
    if (!isAnimatable) {
      return;
    }
    const unsubscribe = spring.on("change", (latest) => {
      if (value.includes(".")) {
        setDisplayValue(latest.toFixed(1));
      } else {
        setDisplayValue(Math.round(latest).toLocaleString());
      }
    });
    return unsubscribe;
  }, [isAnimatable, spring, value]);

  return (
    <div
      ref={ref}
      className="font-mono text-3xl font-bold text-foreground mb-2"
    >
      {isAnimatable ? `${prefix}${displayValue}${suffix}` : displayValue}
    </div>
  );
}
