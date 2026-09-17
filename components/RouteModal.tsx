"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

export function RouteModal({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const close = () => router.back();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto py-6 px-4"
      style={{ backgroundColor: "rgba(9,26,31,0.6)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
      onClick={e => { if (e.target === e.currentTarget) close(); }}
    >
      <div className="relative w-full max-w-[1200px] rounded-2xl shadow-2xl overflow-hidden bg-white animate-scale-in">
        <button
          onClick={close}
          aria-label="Fechar"
          title="Fechar (Esc)"
          className="absolute top-3 right-3 z-10 flex items-center justify-center h-8 w-8 rounded-full bg-white shadow-md hover:bg-slate-100 transition-colors active-press"
          style={{ color: "#1E404A" }}
        >
          <X size={16} strokeWidth={2.5} />
        </button>
        {children}
      </div>
    </div>
  );
}
