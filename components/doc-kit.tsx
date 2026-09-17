import React from "react";
import katex from "katex";

// ─── Kit de componentes para páginas-documento (Perdas, Metodologia) ──────────
// Paleta CIEX por padrão; cada consumidor pode sobrescrever via prop `primary`.
export const DOC_PRIMARY = "#1E404A";

export function KpiRow({ label, value, sub, color }: {
  label: string; value: string; sub: string; color: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-1 text-[11px]">
      <div className="flex items-center gap-1 min-w-0">
        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <span className="text-slate-500 truncate">{label}</span>
      </div>
      <span className="font-bold text-slate-700 shrink-0">
        {value} <span className="text-[9px] font-normal text-slate-400">({sub})</span>
      </span>
    </div>
  );
}

export function Section({ id, num, title, primary = DOC_PRIMARY, children }: {
  id: string; num: string; title: string; primary?: string; children: React.ReactNode;
}) {
  return (
    <section id={id} className="mb-10 scroll-mt-20">
      <div className="flex items-center gap-2.5 mb-4">
        <span className="text-[10px] font-black text-white rounded-md px-2 py-1 shrink-0" style={{ backgroundColor: primary }}>
          {num}
        </span>
        <h2 className="text-lg font-black text-slate-800 tracking-tight">{title}</h2>
      </div>
      <div className="space-y-3 text-sm leading-relaxed">{children}</div>
      <div className="mt-8 border-b border-[#c7d6d9]" />
    </section>
  );
}

export function SubTitle({ primary = DOC_PRIMARY, children }: { primary?: string; children: React.ReactNode }) {
  return (
    <h3 className="text-[13px] font-black mt-5 mb-1.5 uppercase tracking-wide" style={{ color: primary }}>
      {children}
    </h3>
  );
}

export function MathBlock({ exprs, primary = DOC_PRIMARY }: { exprs: Array<{ label?: string; tex: string }>; primary?: string }) {
  return (
    <div className="my-3 px-5 py-4 bg-[#eef3f4] border border-[#c7d6d9] rounded-lg overflow-x-auto space-y-3">
      {exprs.map(({ label, tex }, i) => {
        const html = katex.renderToString(tex, { displayMode: true, throwOnError: false, trust: false });
        return (
          <div key={i} className="flex items-baseline gap-4 flex-wrap">
            {label && (
              <span className="text-[10px] font-bold uppercase tracking-wider shrink-0 w-44" style={{ color: primary }}>
                {label}
              </span>
            )}
            <span dangerouslySetInnerHTML={{ __html: html }} className="block my-1" />
          </div>
        );
      })}
    </div>
  );
}

export function DataTable({ rows, primary = DOC_PRIMARY }: { rows: React.ReactNode[][]; primary?: string }) {
  const [header, ...body] = rows;
  return (
    <div className="overflow-x-auto my-3 rounded-xl border border-[#c7d6d9] shadow-sm">
      <table className="w-full text-[12px] border-collapse">
        <thead>
          <tr style={{ backgroundColor: primary }} className="text-white">
            {header.map((h, i) => <th key={i} className="text-left px-3 py-2.5 font-bold">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {body.map((row, ri) => (
            <tr key={ri} className="border-t border-[#c7d6d9] hover:bg-[#eef3f4] transition-colors duration-100"
              style={{ backgroundColor: ri % 2 === 0 ? "#ffffff" : "#f7fafb" }}>
              {row.map((cell, ci) => <td key={ci} className="px-3 py-2 align-top">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Note({ type, children }: { type: "warning" | "info"; children: React.ReactNode }) {
  const cfg = {
    warning: { bg: "bg-amber-50",  border: "border-amber-300", text: "text-amber-900", icon: "⚠" },
    info:    { bg: "bg-[#eff6ff]", border: "border-[#93c5fd]", text: "text-[#1e40af]", icon: "ℹ" },
  }[type];
  return (
    <div className={`rounded-lg px-4 py-3 text-[12px] leading-relaxed my-3 border-l-[3px] ${cfg.bg} ${cfg.border} ${cfg.text}`}>
      <span className="font-bold mr-1.5">{cfg.icon}</span>{children}
    </div>
  );
}

export function SectionSources({ links, primary = DOC_PRIMARY }: { links: [string, string][]; primary?: string }) {
  return (
    <div className="mt-4 pt-3 border-t border-[#c7d6d9]">
      <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: primary }}>Fontes</p>
      <ul className="space-y-0.5">
        {links.map(([label, href]) => (
          <li key={label}>
            {href ? (
              <a href={href} target="_blank" rel="noopener noreferrer"
                className="text-[11px] hover:underline underline-offset-4 transition-colors duration-150" style={{ color: primary }}>
                ↗ {label}
              </a>
            ) : (
              <span className="text-[11px]" style={{ color: primary }}>— {label}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RefBlock({ title, primary = DOC_PRIMARY, children }: { title: string; primary?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-[#c7d6d9] rounded-xl p-4 shadow-sm">
      <p className="text-[11px] font-black uppercase tracking-wider mb-3" style={{ color: primary }}>{title}</p>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

export function RefItem({ href, label, desc, primary = DOC_PRIMARY }: { href: string; label: string; desc: string; primary?: string }) {
  return (
    <div>
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer"
          className="text-sm font-semibold hover:underline underline-offset-4 transition-colors duration-150" style={{ color: primary }}>
          {label} ↗
        </a>
      ) : (
        <span className="text-sm font-semibold text-slate-700">{label}</span>
      )}
      <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: primary }}>{desc}</p>
    </div>
  );
}
