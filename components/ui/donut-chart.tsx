"use client";

import React, { useId, useState } from "react";
import { motion } from "framer-motion";

export interface DonutChartSegment {
  value: number;
  color: string;
  label: string;
  opacity?: number;
}

interface DonutChartProps {
  data: DonutChartSegment[];
  totalValue?: number;
  /** Viewport diâmetro (px) usado para o cálculo do SVG (stroke-dasharray etc). */
  size?: number;
  strokeWidth?: number;
  /** Tamanho CSS fluido (ex. `clamp(120px, 20vh, 170px)`) aplicado ao contêiner — o SVG escala dentro dele mantendo o viewBox de `size`. */
  cssSize?: string;
  centerContent?: React.ReactNode;
  highlightOnHover?: boolean;
  animationDelayPerSegment?: number;
  onSegmentClick?: (segment: DonutChartSegment, index: number) => void;
}

export function DonutChart({
  data,
  totalValue,
  size = 200,
  strokeWidth = 20,
  cssSize,
  centerContent,
  highlightOnHover = true,
  animationDelayPerSegment = 0.05,
  onSegmentClick,
}: DonutChartProps) {
  const uid = useId();
  const [hovered, setHovered] = useState<number | null>(null);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = totalValue ?? data.reduce((sum, d) => sum + d.value, 0);

  type Segment = DonutChartSegment & { index: number; dash: number; offset: number; fraction: number; cumulative: number };
  const segments = data.filter(d => d.value > 0).reduce<Segment[]>((acc, d, i) => {
    const priorCumulative = acc.length > 0 ? acc[acc.length - 1].cumulative : 0;
    const fraction = total > 0 ? d.value / total : 0;
    const dash = fraction * circumference;
    const offset = circumference - (priorCumulative / total) * circumference;
    return [...acc, { ...d, index: i, dash, offset, fraction, cumulative: priorCumulative + d.value }];
  }, []);

  return (
    <div
      className="relative shrink-0"
      style={cssSize ? { width: cssSize, height: cssSize } : { width: size, height: size }}
    >
      <svg width="100%" height="100%" viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={strokeWidth}
        />
        {segments.map((seg, i) => (
          <motion.circle
            key={`${uid}-${i}`}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={seg.color}
            strokeWidth={hovered === i && highlightOnHover ? strokeWidth * 1.08 : strokeWidth}
            strokeDasharray={`${seg.dash} ${circumference - seg.dash}`}
            strokeLinecap="butt"
            initial={{ strokeDashoffset: circumference, opacity: 0 }}
            animate={{
              strokeDashoffset: seg.offset,
              opacity: seg.opacity ?? 1,
              scale: hovered === i && highlightOnHover ? 1.03 : 1,
            }}
            transition={{
              strokeDashoffset: { duration: 0.6, delay: i * animationDelayPerSegment, ease: [0.23, 1, 0.32, 1] },
              opacity: { duration: 0.3, delay: i * animationDelayPerSegment },
              scale: { duration: 0.2 },
            }}
            style={{
              transformOrigin: "center",
              cursor: onSegmentClick ? "pointer" : "default",
              filter: hovered === i && highlightOnHover ? `drop-shadow(0 0 6px ${seg.color}) brightness(1.1)` : "none",
            }}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => onSegmentClick?.(seg, i)}
          />
        ))}
      </svg>
      {centerContent && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {centerContent}
        </div>
      )}
    </div>
  );
}
