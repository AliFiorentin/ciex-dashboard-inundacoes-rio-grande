"use client";

import React, { useLayoutEffect, useRef, useState } from "react";

interface Props {
  children: React.ReactNode;
  /** Escala mínima/máxima aplicada ao conteúdo para caber na altura disponível. */
  min?: number;
  max?: number;
  className?: string;
}

/**
 * Ajusta o conteúdo à altura disponível (sem rolagem): mede a altura natural do filho e aplica
 * transform: scale para que ocupe o espaço do pai, respeitando [min, max]. A largura é compensada
 * para não encolher na horizontal. O pai precisa ter altura definida (flex-1 min-h-0).
 */
export function FitHeight({ children, min = 0.55, max = 1.25, className }: Props) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState(1);

  useLayoutEffect(() => {
    const o = outer.current, i = inner.current;
    if (!o || !i) return;
    const medir = () => {
      const natural = i.offsetHeight; // transform não altera o layout: altura natural
      if (!natural) return;
      const cs = getComputedStyle(o);
      const disponivel = o.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      const s = Math.min(max, Math.max(min, disponivel / natural));
      setEscala(prev => (Math.abs(prev - s) < 0.005 ? prev : s));
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(o); ro.observe(i);
    return () => ro.disconnect();
  }, [min, max]);

  return (
    <div ref={outer} className={`flex-1 min-h-0 overflow-hidden ${className ?? ""}`}>
      <div ref={inner} className="flow-root" style={{ transform: `scale(${escala})`, transformOrigin: "top left", width: `${100 / escala}%` }}>
        {children}
      </div>
    </div>
  );
}
