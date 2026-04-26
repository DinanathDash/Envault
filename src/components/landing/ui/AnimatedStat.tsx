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

  const numericValue = parseFloat(value.replace(/[^0-9.]/g, ""));
  const suffix = value.replace(/[0-9.]/g, "");

  const spring = useSpring(0, {
    damping: 50,
    stiffness: 200,
    mass: 1,
  });

  useEffect(() => {
    if (isInView) {
      spring.set(numericValue);
    }
  }, [isInView, numericValue, spring]);

  const [displayValue, setDisplayValue] = useState("0");

  useEffect(() => {
    const unsubscribe = spring.on("change", (latest) => {
      if (value.includes(".")) {
        setDisplayValue(latest.toFixed(1));
      } else {
        setDisplayValue(Math.round(latest).toLocaleString());
      }
    });
    return unsubscribe;
  }, [spring, value]);

  return (
    <div
      ref={ref}
      className="font-mono text-3xl font-bold text-foreground mb-2"
    >
      {displayValue}
      {suffix}
    </div>
  );
}
