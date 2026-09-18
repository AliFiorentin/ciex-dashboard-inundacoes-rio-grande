"use client";

import React, { useState } from "react";
import Link from "next/link";
import { TrendingDown } from "lucide-react";
import { KpiRow, Section, SubTitle, DataTable, Note } from "@/components/doc-kit";
import { HeaderLogos } from "@/components/HeaderLogos";

// ─── Tipos ────────────────────────────────────────────────────────────────────
export interface CenarioPerdas {
  dias_agudo: number;
  dias_efetivos: number;
  f_interrup: number;
  empresas_vab: number;
  educacao_perdas: number;
  educacao_custo_adicional: number;
  saude_producao: number;
  agricultura_perdas: number;
  total: number;
}
// Mantém o formato {município: {cenário: valores}} gerado pelo script (hoje só
// "Rio Grande"), mas a UI abaixo já assume um único município.
export type PerdasData = Record<string, Record<string, CenarioPerdas>>;

// ─── Constantes visuais (paleta CIEX) ─────────────────────────────────────────
const PRIMARY = "#1E404A";
const CEN_COLORS: Record<string, string> = {
  "Cenário Maio 2024":                              "#2563eb",
  "Cenário Maio 2024 + 50%":                        "#dc2626",
  "Cenário Setembro 2023":                          "#16a34a",
  "Nível da Lagoa + Chuva Acumulada – 16/05/2024":  "#7c3aed",
};
const CEN_FALLBACK = "#3d7a94";
const COMP_COLORS = {
  empresas:    "#2563eb",
  educacao:    "#16a34a",
  saude:       "#dc2626",
  agricultura: "#6B8E23",
};
const DIAS_OPCOES = [30, 45, 60] as const;
type DiasOpcao = (typeof DIAS_OPCOES)[number];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtBRL(v: number): string {
  if (v >= 1e9) return `R$ ${(v / 1e9).toFixed(2).replace(".", ",")} bi`;
  if (v >= 1e6) return `R$ ${(v / 1e6).toFixed(1).replace(".", ",")} mi`;
  if (v >= 1e3) return `R$ ${(v / 1e3).toFixed(0)} mil`;
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`;
}

function pct(part: number, total: number): string {
  if (!total) return "0%";
  return `${((part / total) * 100).toFixed(1)}%`;
}

function scaleTo(v: CenarioPerdas, dias: number): CenarioPerdas {
  const s = dias / v.dias_efetivos;
  const emp = v.empresas_vab * s;
  const edu = v.educacao_perdas * s;
  const eduAdic = v.educacao_custo_adicional * s;
  const sau = v.saude_producao * s;
  const agr = v.agricultura_perdas; // custo fixo, independe da duração
  return {
    dias_agudo: v.dias_agudo,
    dias_efetivos: dias,
    f_interrup: dias / 365,
    empresas_vab: emp,
    educacao_perdas: edu,
    educacao_custo_adicional: eduAdic,
    saude_producao: sau,
    agricultura_perdas: agr,
    total: emp + edu + eduAdic + sau + agr,
  };
}

// ─── Componente principal ─────────────────────────────────────────────────────
export function PerdasClient({ dados }: { dados: PerdasData }) {
  const [dias, setDias] = useState<DiasOpcao>(30);

  const cenariosOriginais = dados["Rio Grande"] ?? {};
  const cenariosEscalados: Record<string, CenarioPerdas> = Object.fromEntries(
    Object.entries(cenariosOriginais).map(([cen, v]) => [cen, scaleTo(v, dias)])
  );
  const entradas = Object.entries(cenariosEscalados);
  const maxTotal = Math.max(...entradas.map(([, v]) => v.total), 1);

  // Cenário de maior impacto — usado como destaque no Resumo Geral
  const destaque = entradas.length
    ? entradas.reduce((acc, cur) => (cur[1].total > acc[1].total ? cur : acc))
    : null;

  return (
    <div className="min-h-screen bg-[#eef3f4] text-slate-800 font-sans">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="text-white px-6 py-10 print:py-5" style={{ backgroundColor: PRIMARY }}>
        <div className="max-w-[1200px] mx-auto flex items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-5 print:hidden">
              <Link href="/" className="text-[10px] font-bold text-white/70 hover:text-white transition-colors px-3 py-1 rounded-full border border-white/20 hover:border-white/40 flex items-center gap-1.5">← Dashboard</Link>
              <Link href="/metodologia" className="text-[10px] font-bold text-white/70 hover:text-white transition-colors px-3 py-1 rounded-full border border-white/20 hover:border-white/40 flex items-center gap-1.5">Metodologia →</Link>
            </div>
            <p className="text-[11px] uppercase tracking-[0.18em] font-semibold opacity-60 mb-2">
              CIEX · GPEA · FURG
            </p>
            <h1 className="text-4xl font-black leading-none mb-2 tracking-tight flex items-center gap-3">
              <TrendingDown size={36} strokeWidth={2.5} className="opacity-80 shrink-0" />
              Perdas Operacionais
            </h1>
            <p className="text-base opacity-75 font-medium">
              Estimativa de Perdas Econômicas — Cenários de Inundação em Rio Grande (RS)
            </p>
            <p className="text-[11px] opacity-50 mt-3 font-mono">
              Metodologia DaLA (CEPAL/BID) · Maio 2024 e Setembro 2023
            </p>
          </div>
          <HeaderLogos />
        </div>
      </header>

      {/* ── Seletor de duração (sticky) ──────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-white/90 border-b border-[#c7d6d9] shadow-sm print:hidden"
        style={{ backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}>
        <div className="max-w-[1200px] mx-auto px-6 py-2.5 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: PRIMARY }}>
              Duração da interrupção
            </span>
            <span className="text-[9px] text-slate-400">(dias efetivos)</span>
          </div>
          <div className="flex gap-1.5">
            {DIAS_OPCOES.map((d) => (
              <button
                key={d}
                onClick={() => setDias(d)}
                className="px-3 py-1 rounded-full text-[11px] font-black border transition-all duration-150"
                style={dias === d
                  ? { backgroundColor: PRIMARY, color: "#fff", borderColor: PRIMARY }
                  : { backgroundColor: "#fff", color: "#64748b", borderColor: "#e2e8f0" }}
              >
                {d} dias
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#16a34a] animate-pulse" />
            <span className="text-[10px] text-slate-500 font-medium">
              f = {(dias / 365).toFixed(4)} · Todos os resultados atualizados
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-6 py-10 print:py-5 flex gap-8 items-start print:block">

        {/* ── Sidebar (Índice fixo) ────────────────────────────────────────────── */}
        <aside className="hidden lg:block w-52 shrink-0 print:hidden">
          <div className="sticky top-[56px] flex flex-col gap-3">
            <nav className="bg-white border border-[#c7d6d9] rounded-xl p-4 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-wider mb-2" style={{ color: PRIMARY }}>Índice</p>
              <ol className="flex flex-col gap-1">
                {([
                  ["#resumo",      "1. Resumo Geral"],
                  ["#cenarios",    "2. Análise por Cenário"],
                  ["#sensib",      "3. Sensibilidade por Duração"],
                  ["#notas",       "4. Notas e Ressalvas"],
                ] as [string, string][]).map(([href, label]) => (
                  <li key={href}>
                    <a href={href} className="text-[11px] font-medium hover:underline underline-offset-4 transition-colors duration-150 leading-snug block py-0.5" style={{ color: PRIMARY }}>
                      {label}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          </div>
        </aside>

        <main className="flex-1 min-w-0">

        {/* ══════════════════════════════════════════════════════════════════════
            SEÇÃO 1 — RESUMO GERAL
        ══════════════════════════════════════════════════════════════════════ */}
        <Section id="resumo" num="1" title="Resumo Geral">
          <DiasBadge dias={dias} />

          {destaque && (
            <div className="bg-white border border-[#c7d6d9] rounded-xl overflow-hidden shadow-sm my-5">
              <div className="px-5 py-4" style={{ backgroundColor: CEN_COLORS[destaque[0]] ?? CEN_FALLBACK }}>
                <p className="text-[10px] font-black uppercase tracking-wider text-white/70 mb-0.5">Cenário de maior impacto</p>
                <p className="text-3xl font-black text-white leading-none">{fmtBRL(destaque[1].total)}</p>
                <p className="text-[10px] text-white/60 font-mono mt-1">{destaque[0]} · {dias} dias ef.</p>
              </div>
              <div className="px-5 pt-4 pb-1">
                <CompositionBar v={destaque[1]} />
              </div>
              <div className="px-5 pb-5 pt-3 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1.5">
                <KpiRow label="Empresas (VAB)" value={fmtBRL(destaque[1].empresas_vab)} sub={pct(destaque[1].empresas_vab, destaque[1].total)} color={COMP_COLORS.empresas} />
                <KpiRow label="Educação"       value={fmtBRL(destaque[1].educacao_perdas + destaque[1].educacao_custo_adicional)} sub={pct(destaque[1].educacao_perdas + destaque[1].educacao_custo_adicional, destaque[1].total)} color={COMP_COLORS.educacao} />
                <KpiRow label="Saúde (SUS)"    value={fmtBRL(destaque[1].saude_producao)} sub={pct(destaque[1].saude_producao, destaque[1].total)} color={COMP_COLORS.saude} />
                <KpiRow label="Agricultura"    value={fmtBRL(destaque[1].agricultura_perdas)} sub={pct(destaque[1].agricultura_perdas, destaque[1].total)} color={COMP_COLORS.agricultura} />
              </div>
            </div>
          )}

          {/* Gráfico de barras total por cenário */}
          <SubTitle>Total de Perdas por Cenário — {dias} dias ef.</SubTitle>
          <p>Comparação dos {entradas.length} cenários avaliados para Rio Grande (em R$ milhões).</p>
          <div className="bg-white border border-[#c7d6d9] rounded-xl p-5 shadow-sm mt-3">
            <TotaisBarChart entradas={entradas} maxTotal={maxTotal} />
            <div className="flex gap-4 flex-wrap mt-4 justify-center">
              {entradas.map(([cen]) => (
                <div key={cen} className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: CEN_COLORS[cen] ?? CEN_FALLBACK }} />
                  <span className="text-[10px] text-slate-500 font-medium">{cen}</span>
                </div>
              ))}
            </div>
          </div>

          <Note type="warning">
            Os cenários representam eventos independentes (extensões de mancha de inundação
            distintas) — os valores não devem ser somados entre si.
          </Note>
        </Section>

        {/* ══════════════════════════════════════════════════════════════════════
            SEÇÃO 2 — ANÁLISE POR CENÁRIO
        ══════════════════════════════════════════════════════════════════════ */}
        <Section id="cenarios" num="2" title="Análise por Cenário">
          <DiasBadge dias={dias} />

          <div className="grid gap-4 mt-3" style={{ gridTemplateColumns: `repeat(${Math.min(entradas.length, 3)}, 1fr)` }}>
            {entradas.map(([cen, v]) => (
              <div key={cen} className="bg-white border border-[#c7d6d9] rounded-xl overflow-hidden shadow-sm">
                <div className="px-4 py-2.5 bg-[#eef3f4] border-b border-[#c7d6d9] flex items-baseline justify-between">
                  <p className="text-[11px] font-black uppercase tracking-wide" style={{ color: PRIMARY }}>{cen}</p>
                  <p className="text-[9px] text-slate-400 font-mono">{dias}d ef. · f={v.f_interrup.toFixed(4)}</p>
                </div>
                <div className="px-4 pt-3 pb-4">
                  <p className="text-xl font-black text-slate-800 mb-3">{fmtBRL(v.total)}</p>
                  <CompositionBar v={v} />
                  <div className="mt-3 space-y-2">
                    {([
                      { label: "Empresas (VAB)", value: v.empresas_vab, color: COMP_COLORS.empresas },
                      { label: "Educação", value: v.educacao_perdas + v.educacao_custo_adicional, color: COMP_COLORS.educacao },
                      { label: "Saúde (SUS)", value: v.saude_producao, color: COMP_COLORS.saude },
                      { label: "Agricultura", value: v.agricultura_perdas, color: COMP_COLORS.agricultura },
                    ] as const).map(({ label, value, color }) => (
                      <div key={label}>
                        <div className="flex justify-between text-[10px] mb-0.5">
                          <div className="flex items-center gap-1">
                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                            <span className="text-slate-500">{label}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-700">{fmtBRL(value)}</span>
                            <span className="text-slate-400 w-8 text-right">{pct(value, v.total)}</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-[#e2edf0] rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500"
                            style={{ width: pct(value, v.total), backgroundColor: color }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* ══════════════════════════════════════════════════════════════════════
            SEÇÃO 3 — SENSIBILIDADE
        ══════════════════════════════════════════════════════════════════════ */}
        <Section id="sensib" num="3" title="Sensibilidade por Duração da Interrupção">
          <p>
            Comparação do total estimado para <strong>30, 45 e 60 dias efetivos</strong> em
            cada cenário. Perdas agrícolas refletem custo de produção no estágio da cultura
            no momento do evento — independem da duração.
          </p>

          <div className="bg-white border border-[#c7d6d9] rounded-xl p-5 shadow-sm mt-3">
            <p className="text-[11px] font-black uppercase tracking-wider mb-4" style={{ color: PRIMARY }}>
              Total por duração — todos os cenários
            </p>
            <SensibChart cenariosOriginais={cenariosOriginais} diasSelecionado={dias} />
          </div>

          {Object.entries(cenariosOriginais).map(([cen, v]) => (
            <div key={cen} className="mt-6">
              <SubTitle>{cen}</SubTitle>
              <DataTable rows={[
                ["Duração", "Empresas (VAB)", "Educação", "Saúde (SUS)", "Agricultura", "Total"],
                ...DIAS_OPCOES.map((d) => {
                  const sc = scaleTo(v, d);
                  const isSelected = d === dias;
                  return [
                    <span key="d" className="font-mono font-black" style={{ color: isSelected ? PRIMARY : "#64748b" }}>
                      {d} dias{isSelected ? " ◀" : ""}
                    </span>,
                    fmtBRL(sc.empresas_vab),
                    fmtBRL(sc.educacao_perdas + sc.educacao_custo_adicional),
                    fmtBRL(sc.saude_producao),
                    fmtBRL(sc.agricultura_perdas),
                    <span key="t" className="font-black" style={{ color: isSelected ? PRIMARY : "#334155" }}>
                      {fmtBRL(sc.total)}
                    </span>,
                  ];
                }),
              ]} />
            </div>
          ))}

          <Note type="info">
            Empresas, educação e saúde escalam linearmente com a duração. O marcador ◀ indica
            a duração atualmente selecionada no painel.
          </Note>
        </Section>

        {/* ══════════════════════════════════════════════════════════════════════
            SEÇÃO 4 — NOTAS E RESSALVAS
        ══════════════════════════════════════════════════════════════════════ */}
        <Section id="notas" num="4" title="Notas e Ressalvas">
          <Note type="info">
            A metodologia completa (curva de recuperação DaLA, fórmulas por componente, parâmetros e
            fontes) está na{" "}
            <Link href="/metodologia#perdas" className="font-semibold hover:underline underline-offset-4">
              página de Metodologia ↗
            </Link>. Esta seção reúne apenas as ressalvas de interpretação dos números acima.
          </Note>

          <SubTitle>Administração Pública (CNAE 84)</SubTitle>
          <p>
            Os estabelecimentos com CNAE 84 (<em>Administração Pública, Defesa e Seguridade Social</em>)
            são <strong>incluídos</strong> na estimativa — a interrupção de serviços governamentais
            representa perdas reais para a sociedade, conforme a metodologia DaLA (CEPAL, 2024).
          </p>
          <DataTable rows={[
            ["Indicador (Rio Grande / Maio 2024 + 50%)", "Valor"],
            ["Estabelecimentos CNAE 84",       "5"],
            ["Participação na massa salarial", "24,0%  (R$ 26,2 mi/mês)"],
            ["Contribuição ao total (60 dias)","≈ R$ 58,5 mi de R$ 460,0 mi"],
          ]} />
          <Note type="warning">
            O labor share de Adm. Pública (88,3%) é elevado, pois o VAB deste setor é
            predominantemente composto por remunerações. Leitores que desejam excluir o setor
            público devem subtrair a contribuição do CNAE 84 dos valores apresentados.
          </Note>

          <SubTitle>Por que não usar ICMS como alternativa?</SubTitle>
          <p>
            A arrecadação de ICMS municipal (SEFAZ-RS) foi avaliada como possível proxy de VAB perdido,
            seguindo abordagem similar à adotada pela CEPAL (2024) em nível estadual via série ARIMA.
            Em Rio Grande, o ICMS de maio/2024 apresentou alta de <strong>+43,8%</strong> em relação
            ao baseline, enquanto o evento de cheia afetou principalmente abril/2024 (−41,4%). O
            movimento positivo em maio reflete provavelmente a refinaria e o porto — atividades não
            atingidas pela mancha de inundação — gerando ICMS normalmente, além de demanda emergencial
            de combustíveis. O ICMS municipal, por ser agregado, não permite isolar a parcela gerada
            por estabelecimentos dentro da mancha.
          </p>
          <p>
            O método RAIS + <em>labor share</em> resolve essa limitação: opera no nível do
            estabelecimento (CNPJ), aplica o teste ponto-em-polígono para isolar apenas firmas dentro
            da mancha, e cobre todos os setores formais independentemente do tributo recolhido. O
            ICMS permanece útil apenas como sinal de validação de ordem de grandeza, não como
            metodologia de estimação.
          </p>
        </Section>

        <footer className="mt-12 pt-6 border-t border-[#c7d6d9] text-center print:mt-4">
          <p className="text-[11px]" style={{ color: PRIMARY }}>
            Painel desenvolvido por GPEA/FURG — Centro de Inteligência em Eventos Extremos (CIEX).
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: PRIMARY }}>Dados adaptados do projeto BID/GPEA de Avaliação de Impactos Socioeconômicos.</p>
        </footer>
        </main>
      </div>
    </div>
  );
}

// ─── Gráficos SVG ─────────────────────────────────────────────────────────────

function CompositionBar({ v }: { v: CenarioPerdas }) {
  const comps = [
    { value: v.empresas_vab,       color: COMP_COLORS.empresas },
    { value: v.educacao_perdas + v.educacao_custo_adicional, color: COMP_COLORS.educacao },
    { value: v.saude_producao,     color: COMP_COLORS.saude },
    { value: v.agricultura_perdas, color: COMP_COLORS.agricultura },
  ].filter((c) => c.value > 0);
  const total = comps.reduce((s, c) => s + c.value, 0);
  let offset = 0;
  return (
    <svg viewBox="0 0 400 14" className="w-full" style={{ height: 14 }}>
      {comps.map((c, i) => {
        const w = Math.max((c.value / total) * 400, 1);
        const x = offset;
        offset += w;
        return (
          <rect key={i} x={x} y={0} width={w} height={14} fill={c.color}
            rx={i === 0 || i === comps.length - 1 ? 3 : 0} ry={3} />
        );
      })}
    </svg>
  );
}

// Quebra o rótulo por palavra (sem limite de linhas — nomes de cenário longos,
// ex. "Nível da Lagoa + Chuva Acumulada – 16/05/2024", precisam de 3+ linhas
// para não colidir com a coluna vizinha nem cortar a data/valor no final).
// Quebra também no travessão " – ", isolando a data/valor na última linha.
function wordWrap(text: string, maxLen: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > maxLen && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = next;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function wrapLabel(text: string, maxLen: number): string[] {
  const idx = text.indexOf(" – ");
  if (idx === -1) return wordWrap(text, maxLen);
  return [...wordWrap(text.slice(0, idx), maxLen), text.slice(idx + 3)];
}

function TotaisBarChart({
  entradas,
  maxTotal,
}: {
  entradas: [string, CenarioPerdas][];
  maxTotal: number;
}) {
  const barW = 76;
  const gap = 32;
  const chartH = 140;
  const pL = 60;
  const pB = 64;
  const W = pL + entradas.length * (barW + gap) - gap + 10;

  return (
    <svg viewBox={`0 0 ${W} ${chartH + pB}`} className="w-full overflow-visible">
      {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
        const val = p * maxTotal;
        const y = chartH - p * chartH + 4;
        return (
          <g key={i}>
            <line x1={pL - 4} y1={y} x2={W} y2={y} stroke="#e2eef3" strokeWidth={i === 0 ? 1.5 : 0.75} />
            <text x={pL - 8} y={y + 3} textAnchor="end" fontSize="8" fill="#9ca3af">
              {val >= 1e9 ? `${(val / 1e9).toFixed(1)}bi` : val >= 1e6 ? `${(val / 1e6).toFixed(0)}mi` : "0"}
            </text>
          </g>
        );
      })}
      {entradas.map(([cen, v], i) => {
        const barH = Math.max((v.total / maxTotal) * chartH, 2);
        const x = pL + i * (barW + gap);
        const y = chartH - barH + 4;
        const color = CEN_COLORS[cen] ?? CEN_FALLBACK;
        return (
          <g key={cen}>
            <rect x={x} y={y} width={barW} height={barH} fill={color} rx="3" opacity="0.9" />
            <text x={x + barW / 2} y={y - 6} textAnchor="middle" fontSize="9" fill={color} fontWeight="bold">
              {v.total >= 1e9 ? `${(v.total / 1e9).toFixed(1)}bi` : `${(v.total / 1e6).toFixed(0)}mi`}
            </text>
            <text x={x + barW / 2} y={chartH + 18} textAnchor="middle" fontSize="8.5" fill="#374151" fontWeight="bold">
              {wrapLabel(cen.replace("Cenário ", ""), 17).map((line, li) => (
                <tspan key={li} x={x + barW / 2} dy={li === 0 ? 0 : 10}>{line}</tspan>
              ))}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function SensibChart({
  cenariosOriginais,
  diasSelecionado,
}: {
  cenariosOriginais: Record<string, CenarioPerdas>;
  diasSelecionado: DiasOpcao;
}) {
  const cenarios = Object.entries(cenariosOriginais);

  const allVals = cenarios.flatMap(([, v]) => DIAS_OPCOES.map((d) => scaleTo(v, d).total));
  const maxVal = Math.max(...allVals, 1);

  const bW = 20;
  const bGap = 4;
  const gGap = 26;
  const gW = DIAS_OPCOES.length * bW + (DIAS_OPCOES.length - 1) * bGap;
  const chartH = 120;
  const pL = 55;
  const pB = 58;
  const W = pL + cenarios.length * (gW + gGap) - gGap + 10;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${chartH + pB}`} className="w-full overflow-visible">
        {[0, 0.5, 1].map((p, i) => {
          const val = p * maxVal;
          const y = chartH - p * chartH + 4;
          return (
            <g key={i}>
              <line x1={pL - 4} y1={y} x2={W} y2={y} stroke="#e2eef3" strokeWidth={i === 0 ? 1.5 : 0.75} />
              <text x={pL - 8} y={y + 3} textAnchor="end" fontSize="7.5" fill="#9ca3af">
                {val >= 1e9 ? `${(val / 1e9).toFixed(1)}bi` : val >= 1e6 ? `${(val / 1e6).toFixed(0)}mi` : "0"}
              </text>
            </g>
          );
        })}
        {cenarios.map(([cen, v], gi) => {
          const gx = pL + gi * (gW + gGap);
          const color = CEN_COLORS[cen] ?? CEN_FALLBACK;
          return (
            <g key={cen}>
              {DIAS_OPCOES.map((d, di) => {
                const sc = scaleTo(v, d);
                const barH = Math.max((sc.total / maxVal) * chartH, 1);
                const bx = gx + di * (bW + bGap);
                const by = chartH - barH + 4;
                const isSel = d === diasSelecionado;
                return (
                  <g key={d}>
                    <rect x={bx} y={by} width={bW} height={barH}
                      fill={color}
                      opacity={isSel ? 1 : 0.3}
                      rx="2"
                      style={{ transition: "opacity 0.2s" }}
                    />
                    {isSel && (
                      <text x={bx + bW / 2} y={by - 4} textAnchor="middle" fontSize="6.5" fill={color} fontWeight="bold">
                        {sc.total >= 1e9 ? `${(sc.total / 1e9).toFixed(1)}bi` : `${(sc.total / 1e6).toFixed(0)}mi`}
                      </text>
                    )}
                  </g>
                );
              })}
              <text x={gx + gW / 2} y={chartH + 16} textAnchor="middle" fontSize="7.5" fill="#374151" fontWeight="bold">
                {wrapLabel(cen.replace("Cenário ", ""), 17).map((line, li) => (
                  <tspan key={li} x={gx + gW / 2} dy={li === 0 ? 0 : 9}>{line}</tspan>
                ))}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="flex gap-5 justify-center mt-2 flex-wrap">
        {DIAS_OPCOES.map((d) => (
          <div key={d} className="flex items-center gap-1.5">
            <div className="w-4 h-3 rounded-sm" style={{ backgroundColor: PRIMARY, opacity: d === diasSelecionado ? 1 : 0.3 }} />
            <span className="text-[10px] font-medium" style={{ color: d === diasSelecionado ? PRIMARY : "#94a3b8" }}>
              {d} dias{d === diasSelecionado ? " ◀" : ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Componentes UI ───────────────────────────────────────────────────────────

function DiasBadge({ dias }: { dias: number }) {
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full mb-2" style={{ backgroundColor: `${PRIMARY}1a`, border: `1px solid ${PRIMARY}33` }}>
      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: PRIMARY }} />
      <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: PRIMARY }}>
        {dias} dias efetivos selecionados · f = {(dias / 365).toFixed(4)}
      </span>
    </div>
  );
}

