"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

/**
 * Small reveal-on-mount wrapper: fades/rises its children in, staggered by
 * `index`. Respects `prefers-reduced-motion` (renders static when reduced).
 */
export function Reveal({
  children,
  index = 0,
  className,
}: {
  children: ReactNode;
  index?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();

  if (reduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

export default Reveal;
