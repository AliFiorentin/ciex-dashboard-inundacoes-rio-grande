"use client";

import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import Map, { Source, Layer, NavigationControl, MapRef, Popup } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import * as XLSX from "xlsx";
import * as turf from "@turf/turf";
import Image from "next/image";
import * as flatgeobuf from "flatgeobuf";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

import {
  Building2, GraduationCap, HeartPulse, Wrench, Leaf, Sprout, Landmark,
  Download, Printer, EyeOff, SlidersHorizontal, PanelLeft,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";

// ─── Constantes ──────────────────────────────────────────────────────────────

const COLORS = {
  empresas:    "#2563eb",
  educacao:    "#16a34a",
  saude:       "#dc2626",
  cenario:     "#1f77b4",
  infra:       "#f59e0b",
  agricultura: "#6B8E23",
  patrimonio:  "#a16207",
};

const INFRA_COLORS: Record<string, string> = {
  "Logradouros":      "#e67e22",
  "Quadras":          "#8e44ad",
  "Terrenos":         "#27ae60",
  "Prédios Públicos": "#2980b9",
  "Segurança":        "#c0392b",
};

// Coordenadas geográficas dos rasters MapaBiomas (EPSG:4326): [NW, NE, SE, SW]
// Agricultura e Cobertura usam o mesmo TIFF extent (município de Rio Grande)
const RASTER_COORDS: [[number,number],[number,number],[number,number],[number,number]] = [
  [-52.697780, -31.768830],
  [-52.058269, -31.768830],
  [-52.058269, -32.648461],
  [-52.697780, -32.648461],
];

// Paleta para gráficos de rosca
const DONUT_COLORS = ["#1e404a","#2563eb","#16a34a","#dc2626","#d97706","#7c3aed","#0891b2","#be185d","#059669","#b45309"];

// Cores por classe de cobertura (MapaBiomas Col.10) — sem classes agricolas
const COBERTURA_COLORS: Record<string, string> = {
  "Silvicultura":                   "#7a5900",
  "Campo Alagado e Area Pantanosa": "#519799",
  "Formacao Campestre":             "#d6bc74",
  "Mosaico de Usos":                "#E8C06B",
  "Restinga Arborea":               "#02d659",
  "Restinga Herbacea":              "#ad5100",
};

// Cores por cultura agricola
const AGRI_COLORS: Record<string, string> = {
  "Soja":                        "#D4A017",
  "Arroz":                       "#4FC3F7",
  "Outras Lavouras Temporarias": "#AED581",
};

// CIEX brand
const C = {
  primary:   "#1E404A",
  dark:      "#163037",
  field:     "#255362",
  bg:        "#ffffff",
  cardBg:    "#f8f9fa",
  border:    "#e2e5e2",
  muted:     "#6b7a69",
};

const CENARIOS = [
  "Cenário Maio 2024",
  "Cenário Maio 2024 + 50%",
];

const INFRA_LAYERS = [
  "Logradouros", "Quadras", "Terrenos",
  "Prédios Públicos", "Segurança",
];

const EMPTY_GEO: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

const INFRA_TAMANHOS_MB: Record<string, number> = {
  Terrenos: 28,
};

const STAFF_COLS = [
  "staff_acs_endemias", "staff_admin_gestao_apoio", "staff_diag_lab_imagem",
  "staff_enfermagem", "staff_farmacia", "staff_medicos", "staff_odontologia",
  "staff_outros", "staff_outros_superior_saude", "staff_servicos_gerais",
  "staff_transporte_urgencia",
];

const STAFF_LABELS: Record<string, string> = {
  staff_acs_endemias:          "ACS/Endemias",
  staff_admin_gestao_apoio:    "Admin/Gestão",
  staff_diag_lab_imagem:       "Diag/Imagem",
  staff_enfermagem:            "Enfermagem",
  staff_farmacia:              "Farmácia",
  staff_medicos:               "Médicos",
  staff_odontologia:           "Odontologia",
  staff_outros:                "Outros",
  staff_outros_superior_saude: "Outros (Sup.)",
  staff_servicos_gerais:       "Serviços Gerais",
  staff_transporte_urgencia:   "Transporte",
};

const DEP_LABELS: Record<string, string> = {
  "1": "Federal", "2": "Estadual", "3": "Municipal", "4": "Privada",
};

// ─── Utilitários ─────────────────────────────────────────────────────────────

async function loadFGB(url: string, signal?: AbortSignal): Promise<any> {
  const res = await fetch(url, signal ? { signal } : {});
  if (!res.ok || !res.body) return null;
  const features: any[] = [];
  for await (const f of flatgeobuf.geojson.deserialize(res.body)) {
    features.push(f);
  }
  return { type: "FeatureCollection", features };
}

const slugify = (str: string) =>
  str.normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const scenarioSlug = (cen: string) => `rio_grande___${slugify(cen)}`;

const normalizeDep = (val: string) => DEP_LABELS[val] || val;

// Remove prefixo numérico de classificação (ex.: "6- Arquitetura Civil Privada" → "Arquitetura Civil Privada")
const normalizeTipologia = (val: string) => val.replace(/^\d+-\s*/, "").trim();

const formatoBr = (num: number, casas = 0) =>
  num.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

const compactoBr = (n: number, casas = 1) => {
  if (n === undefined || n === null || isNaN(n)) return "0";
  const abs = Math.abs(n);
  const sinal = n < 0 ? "-" : "";
  if (abs >= 1e9) return `${sinal}${formatoBr(abs / 1e9, casas)} Bi`;
  if (abs >= 1e6) return `${sinal}${formatoBr(abs / 1e6, casas)} Mi`;
  if (abs >= 1e3) return `${sinal}${formatoBr(abs / 1e3, casas)} Mil`;
  return `${sinal}${formatoBr(abs, casas)}`;
};

const calcPct = (parte: number, total: number) =>
  !total ? "0%" : `${formatoBr((parte / total) * 100, 0)}%`;

const getLen = (feats: { properties?: Record<string, unknown>; geometry?: { coordinates?: unknown } }[]) => {
  if (!Array.isArray(feats)) return 0;
  const seen = new Set<string>();
  let s = 0;
  feats.forEach(x => {
    const h = JSON.stringify(x.geometry?.coordinates || []);
    if (!seen.has(h)) {
      seen.add(h);
      s += Number(x.properties?.LENGTH || x.properties?.length || x.properties?.shape_leng || 0);
    }
  });
  return s;
};

// ─── Métricas ────────────────────────────────────────────────────────────────

const calcEmp = (base: any) => {
  if (!base?.features) return { estab: 0, emp: 0, massa: 0, media: 0 };
  const estab = base.features.length;
  const emp   = base.features.reduce((a: number, f: any) => a + (f.properties?.Empregados    || 0), 0);
  const massa = base.features.reduce((a: number, f: any) => a + (f.properties?.Massa_Salarial || 0), 0);
  // Mean of per-company MédiaSalarial (same methodology as Streamlit)
  const mediaSum = base.features.reduce((a: number, f: any) => a + (f.properties?.["Média Salarial"] || 0), 0);
  const media = estab > 0 ? mediaSum / estab : 0;
  return { estab, emp, massa, media };
};

const calcEdu = (base: any) => {
  if (!base?.features) return { escolas: 0, prof: 0, inf: 0, fund: 0, med: 0, profis: 0, eja: 0, esp: 0 };
  const sum = (p: string) => base.features.reduce((a: number, f: any) => a + (f.properties?.[p] || 0), 0);
  return {
    escolas: base.features.length, prof: sum("qtd_prof"),
    inf: sum("qtd_matri_inf"), fund: sum("qtd_matri_fund"), med: sum("qtd_matri_med"),
    profis: sum("qtd_matri_prof"), eja: sum("qtd_matri_eja"), esp: sum("qtd_matri_esp"),
  };
};

const calcSau = (base: any) => {
  if (!base?.features) return { unidades: 0, tipos: {} as Record<string, number>, staff: {} as Record<string, number> };
  const tipos: Record<string, number> = {};
  const staff: Record<string, number> = {};
  STAFF_COLS.forEach(c => (staff[c] = 0));
  base.features.forEach((f: any) => {
    const t = f.properties?.co_tipo_estabelecimento;
    if (t && t !== "nan" && t !== "") tipos[t] = (tipos[t] || 0) + 1;
    STAFF_COLS.forEach(c => (staff[c] += f.properties?.[c] || 0));
  });
  return { unidades: base.features.length, tipos, staff };
};

const calcPatrimonio = (base: any) => {
  if (!base?.features) return { total: 0, tipos: {} as Record<string, number> };
  const tipos: Record<string, number> = {};
  base.features.forEach((f: any) => {
    const t = normalizeTipologia(String(f.properties?.Tipologia || ""));
    if (t) tipos[t] = (tipos[t] || 0) + 1;
  });
  return { total: base.features.length, tipos };
};

// Conta features onde prop numérica == 1 (flag 0/1) ou string "1"/"sim"/"true"
const countFlag = (feats: any[], prop: string): number => {
  if (!feats?.length) return 0;
  return feats.filter(f => {
    const v = f.properties?.[prop];
    if (v === null || v === undefined) return false;
    const n = Number(v);
    if (!isNaN(n)) return n === 1;
    return ["1","sim","true","yes"].includes(String(v).trim().toLowerCase());
  }).length;
};

// Conta features onde prop string está em um conjunto de valores
const countEquals = (feats: any[], prop: string, values: string[]): number => {
  if (!feats?.length) return 0;
  const set = new Set(values.map(v => v.toLowerCase()));
  return feats.filter(f => set.has(String(f.properties?.[prop] ?? "").trim().toLowerCase())).length;
};

// Ruas únicas pelo nome composto (tipo + nome)
const countRuasUnicas = (feats: any[]): number => {
  if (!feats?.length) return 0;
  const ids = new Set(feats.map(f => {
    const tipo = (f.properties?.tipo ?? f.properties?.Tipo ?? "").toString().trim();
    const nome = (f.properties?.nome ?? f.properties?.Nome ?? "").toString().trim();
    return tipo || nome ? `${tipo} ${nome}`.trim() : null;
  }).filter(Boolean));
  return ids.size || feats.length;
};

// ─── Dashboard ───────────────────────────────────────────────────────────────

export default function Dashboard() {
  const mapRef = useRef<MapRef>(null);
  const permalinkCenarioRef = useRef<string | null>(null);

  const [cenario, setCenario] = useState<string>("(nenhum)");

  const [camadas,     setCamadas]     = useState<string[]>(["Empresas", "Saúde", "Educação", "Agricultura", "Uso e Cobertura da Terra", "Infraestrutura"]);
  const [infraAtivas, setInfraAtivas] = useState<string[]>(["Logradouros", "Quadras", "Terrenos"]);
  const [tabAtiva,    setTabAtiva]    = useState("empresas");

  const [filtroSetor, setFiltroSetor] = useState("(todos)");
  const [filtroDep,   setFiltroDep]   = useState("(todas)");
  const [filtroTipo,  setFiltroTipo]  = useState("(todas)");

  const [showPainelAnalise,    setShowPainelAnalise]    = useState(true);
  const [showFiltros,          setShowFiltros]          = useState(true);
  const [isLoading,            setIsLoading]            = useState(false);
  const [showLegenda,          setShowLegenda]          = useState(false);
const [showMancha,           setShowMancha]           = useState(true);
const [showListaLogradouros, setShowListaLogradouros] = useState(false);
  const [showListaEscolas,     setShowListaEscolas]     = useState(false);
  const [showListaHospitais,   setShowListaHospitais]   = useState(false);
  const [showListaUBS,         setShowListaUBS]         = useState(false);
  const [showListaAmbulat,     setShowListaAmbulat]     = useState(false);

  const [baseEmpresas,  setBaseEmpresas]  = useState<any>(null);
  const [baseEducacao,  setBaseEducacao]  = useState<any>(null);
  const [baseSaude,     setBaseSaude]     = useState<any>(null);
  const [baseCobertura,    setBaseCobertura]    = useState<any>(null);
  const [baseAgricultura,  setBaseAgricultura]  = useState<any>(null);
  const [baseInfra,        setBaseInfra]        = useState<Record<string, any>>({});

  const [atingidosEmpresas,    setAtingidosEmpresas]    = useState<any>(null);
  const [atingidosEducacao,    setAtingidosEducacao]    = useState<any>(null);
  const [atingidosSaude,       setAtingidosSaude]       = useState<any>(null);
  const [atingidosCobertura,   setAtingidosCobertura]   = useState<any>(null);
  const [atingidosAgricultura, setAtingidosAgricultura] = useState<any>(null);
  const [atingidosInfra,    setAtingidosInfra]    = useState<Record<string, any>>({});
  const [manchaCenario,     setManchaCenario]     = useState<any>(null);

  const [baseReady, setBaseReady] = useState(false);
  // true = carga inicial ainda em andamento; cenário effect deve ser ignorado até o mount terminar
  const initialLoadDoneRef = useRef(false);

  const [cursor,    setCursor]    = useState("grab");
  const [popupInfo, setPopupInfo] = useState<{ lngLat: [number, number]; properties: any; source: string } | null>(null);

  // Carrega base + atingidos + mancha juntos para evitar flash de camadas
  useEffect(() => {
    const ctrl = new AbortController();
    const { signal } = ctrl;
    setIsLoading(true);

    const desired = permalinkCenarioRef.current;
    permalinkCenarioRef.current = null;
    const initialCenario = (desired && CENARIOS.includes(desired)) ? desired : CENARIOS[0];
    const sSlug = scenarioSlug(initialCenario);
    const defaultInfra = ["Logradouros", "Quadras", "Terrenos"];

    const infraAtingidosPromises = defaultInfra.map(infra => {
      const iSlug = slugify(infra);
      const useFgb = iSlug === "terrenos" || iSlug === "quadras";
      const url = `/dados_convertidos/rio_grande/cenarios/infra_${iSlug}_ATINGIDOS_${sSlug}.${useFgb ? "fgb" : "geojson"}`;
      return (useFgb ? loadFGB(url, signal) : fetch(url, { signal }).then(r => r.ok ? r.json() : null))
        .then((d: any) => ({ infra, d })).catch(() => ({ infra, d: null }));
    });

    Promise.all([
      // Base
      fetch("/dados_convertidos/rio_grande/empresas_BASE.geojson", { signal }).then(r => r.ok ? r.json() : null),
      fetch("/dados_convertidos/rio_grande/educacao_BASE.geojson", { signal }).then(r => r.ok ? r.json() : null),
      fetch("/dados_convertidos/rio_grande/saude_BASE.geojson",    { signal }).then(r => r.ok ? r.json() : null),
      loadFGB("/dados_convertidos/rio_grande/cobertura_BASE.fgb",   signal),
      loadFGB("/dados_convertidos/rio_grande/agricultura_BASE.fgb", signal),
      // Mancha
      fetch(`/dados_convertidos/rio_grande/cenarios/${sSlug}.geojson`, { signal }).then(r => r.ok ? r.json() : null),
      // Atingidos
      fetch(`/dados_convertidos/rio_grande/cenarios/empresas_ATINGIDOS_${sSlug}.geojson`, { signal }).then(r => r.ok ? r.json() : null),
      fetch(`/dados_convertidos/rio_grande/cenarios/educacao_ATINGIDOS_${sSlug}.geojson`, { signal }).then(r => r.ok ? r.json() : null),
      fetch(`/dados_convertidos/rio_grande/cenarios/saude_ATINGIDOS_${sSlug}.geojson`,    { signal }).then(r => r.ok ? r.json() : null),
      loadFGB(`/dados_convertidos/rio_grande/cenarios/cobertura_ATINGIDOS_${sSlug}.fgb`,   signal),
      loadFGB(`/dados_convertidos/rio_grande/cenarios/agricultura_ATINGIDOS_${sSlug}.fgb`, signal),
      Promise.all(infraAtingidosPromises),
    ]).then(([emp, edu, sau, cob, agr, mancha, aEmp, aEdu, aSau, aCob, aAgr, infraResults]) => {
      if (signal.aborted) return;

      setBaseEmpresas(emp); setBaseEducacao(edu); setBaseSaude(sau); setBaseCobertura(cob); setBaseAgricultura(agr);
      setManchaCenario(mancha);
      setAtingidosEmpresas(aEmp); setAtingidosEducacao(aEdu); setAtingidosSaude(aSau); setAtingidosCobertura(aCob); setAtingidosAgricultura(aAgr);
      const infraData: Record<string, any> = {};
      (infraResults as any[]).forEach(({ infra, d }) => { if (d) infraData[infra] = d; });
      setAtingidosInfra(infraData);

      setCenario(initialCenario);
      initialLoadDoneRef.current = true;
      setBaseReady(true);
      setIsLoading(false);

      requestAnimationFrame(() => {
        const map = mapRef.current?.getMap();
        if (map && mancha) {
          const bbox = turf.bbox(mancha) as [number, number, number, number];
          map.fitBounds(bbox, { padding: 40, maxZoom: 11.8, offset: [40, 60], duration: 1500, essential: true });
        }
      });
    }).catch(e => { if ((e as Error).name !== "AbortError") console.error(e); });

    return () => ctrl.abort();
  }, []);

  // Cenário → mancha + atingidos (pula todos os runs até o mount terminar)
  useEffect(() => {
    if (!initialLoadDoneRef.current) return;
    if (!cenario || cenario === "(nenhum)") {
      const map = mapRef.current?.getMap();
      if (map) map.flyTo({ center: [-52.22, -32.09], zoom: 10.8, duration: 5000 });
      setTimeout(() => {
        setManchaCenario(null); setAtingidosEmpresas(null); setAtingidosEducacao(null); setAtingidosSaude(null); setAtingidosCobertura(null); setAtingidosAgricultura(null);
        setAtingidosInfra(prev => Object.keys(prev).length === 0 ? prev : {});
      }, 5000);
      return;
    }
    const ctrl = new AbortController();
    const { signal } = ctrl;
    const sSlug = scenarioSlug(cenario);
    setIsLoading(true);

    fetch(`/dados_convertidos/rio_grande/cenarios/${sSlug}.geojson`, { signal })
      .then(r => r.ok ? r.json() : null)
      .then(mancha => {
        if (signal.aborted) return;
        
        if (mancha) {
          const map = mapRef.current?.getMap();
          if (map) {
            const bbox = turf.bbox(mancha) as [number, number, number, number];
            map.fitBounds(bbox, { padding: 40, maxZoom: 11.8, offset: [40, 60], duration: 5000, essential: true });
          }
        }

        return new Promise(res => setTimeout(() => res(mancha), 5000));
      })
      .then(mancha => {
        if (signal.aborted) return;

        const infraPromises = infraAtivas.map(infra => {
          const iSlug = slugify(infra);
          const useFgb = iSlug === "terrenos" || iSlug === "quadras";
          const ext = useFgb ? "fgb" : "geojson";
          const url = `/dados_convertidos/rio_grande/cenarios/infra_${iSlug}_ATINGIDOS_${sSlug}.${ext}`;
          return (useFgb ? loadFGB(url, signal) : fetch(url, { signal }).then(r => r.ok ? r.json() : null))
            .then((d: any) => ({ infra, d }))
            .catch(() => ({ infra, d: null }));
        });

        const dataPromises = Promise.all([
          fetch(`/dados_convertidos/rio_grande/cenarios/empresas_ATINGIDOS_${sSlug}.geojson`, { signal }).then(r => r.ok ? r.json() : null),
          fetch(`/dados_convertidos/rio_grande/cenarios/educacao_ATINGIDOS_${sSlug}.geojson`, { signal }).then(r => r.ok ? r.json() : null),
          fetch(`/dados_convertidos/rio_grande/cenarios/saude_ATINGIDOS_${sSlug}.geojson`,    { signal }).then(r => r.ok ? r.json() : null),
          loadFGB(`/dados_convertidos/rio_grande/cenarios/cobertura_ATINGIDOS_${sSlug}.fgb`,   signal),
          loadFGB(`/dados_convertidos/rio_grande/cenarios/agricultura_ATINGIDOS_${sSlug}.fgb`, signal),
          Promise.all(infraPromises)
        ]);

        return Promise.all([dataPromises, Promise.resolve(mancha)]);
      })
      .then((res) => {
        if (!res || signal.aborted) return;
        const [[emp, edu, sau, cob, agr, infraResults], mancha] = res;
        
        setManchaCenario(mancha);
        setAtingidosEmpresas(emp); 
        setAtingidosEducacao(edu); 
        setAtingidosSaude(sau); 
        setAtingidosCobertura(cob); 
        setAtingidosAgricultura(agr);
        
        const newInfraData: Record<string, any> = {};
        (infraResults as any[]).forEach(({ infra, d }) => { if (d) newInfraData[infra] = d; });
        setAtingidosInfra(prev => ({ ...prev, ...newInfraData }));

        setIsLoading(false);
      })
      .catch(e => { if ((e as Error).name !== "AbortError") console.error(e); });

    return () => ctrl.abort();
  }, [cenario]); // eslint-disable-line react-hooks/exhaustive-deps

  // Bases de infra
  useEffect(() => {
    const ctrl = new AbortController();
    const { signal } = ctrl;

    setBaseInfra(prev => {
      const u = { ...prev };
      Object.keys(u).forEach(k => { if (!infraAtivas.includes(k)) delete u[k]; });
      return u;
    });

    const toLoad = infraAtivas.filter(i => !baseInfra[i]);
    if (!toLoad.length) return;
    setIsLoading(true);

    Promise.all(toLoad.map(infra => {
      const iSlug = slugify(infra);
      const useFgb = iSlug === "terrenos" || iSlug === "quadras";
      const url = `/dados_convertidos/rio_grande/infraestrutura/${iSlug}_BASE.${useFgb ? "fgb" : "geojson"}`;
      const p = useFgb ? loadFGB(url, signal) : fetch(url, { signal }).then(r => r.ok ? r.json() : null);
      return p.then((d: any) => ({ infra, d })).catch(() => null);
    })).then(results => {
      if (signal.aborted) return;
      results.forEach(r => { if (r?.d) setBaseInfra(prev => ({ ...prev, [r.infra]: r.d })); });
      setIsLoading(false);
    });

    if (cenario && cenario !== "(nenhum)") {
      const sSlug = scenarioSlug(cenario);
      toLoad.forEach(infra => {
        const iSlug = slugify(infra);
        const useFgb = iSlug === "terrenos" || iSlug === "quadras";
        const ext = useFgb ? "fgb" : "geojson";
        const url = `/dados_convertidos/rio_grande/cenarios/infra_${iSlug}_ATINGIDOS_${sSlug}.${ext}`;
        (useFgb ? loadFGB(url, signal) : fetch(url, { signal }).then(r => r.ok ? r.json() : null))
          .then((d: any) => { if (d && !signal.aborted) setAtingidosInfra(prev => ({ ...prev, [infra]: d })); })
          .catch(() => null);
      });
    }

    return () => ctrl.abort();
  }, [infraAtivas]); // eslint-disable-line react-hooks/exhaustive-deps

  // Permalink
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const c = params.get("c");
    if (c) permalinkCenarioRef.current = c;
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (cenario !== "(nenhum)") params.set("c", slugify(cenario));
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [cenario]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const toggleCamada = (c: string) => {
    setCamadas(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
    setPopupInfo(null);
  };

  const toggleInfra = (infra: string) => {
    const ativando = !infraAtivas.includes(infra);
    if (ativando && INFRA_TAMANHOS_MB[infra]) {
      if (!window.confirm(`"${infra}" tem ~${INFRA_TAMANHOS_MB[infra]}MB. Carregar?`)) return;
    }
    setInfraAtivas(prev => prev.includes(infra) ? prev.filter(i => i !== infra) : [...prev, infra]);
    setCamadas(prev => prev.includes("Infraestrutura") ? prev : [...prev, "Infraestrutura"]);
    setPopupInfo(null);
  };

  const toggleMenuInfra = () =>
    setCamadas(camadas.includes("Infraestrutura") ? camadas.filter(c => c !== "Infraestrutura") : [...camadas, "Infraestrutura"]);

  // ─── Dados derivados ───────────────────────────────────────────────────────

  const isCenarioAtivo = cenario !== "(nenhum)" && manchaCenario != null;

  const showEmp  = baseReady ? (isCenarioAtivo ? atingidosEmpresas : baseEmpresas) : null;
  const showEdu  = baseReady ? (isCenarioAtivo ? atingidosEducacao : baseEducacao) : null;
  const showSau  = baseReady ? (isCenarioAtivo ? atingidosSaude    : baseSaude)    : null;
  const showCobertura   = baseReady ? (isCenarioAtivo ? atingidosCobertura   : baseCobertura)   : null;
  const showAgricultura = baseReady ? (isCenarioAtivo ? atingidosAgricultura : baseAgricultura) : null;

  const renderEmp = useMemo(() => {
    if (!showEmp?.features) return null;
    if (filtroSetor === "(todos)") return showEmp;
    return { ...showEmp, features: showEmp.features.filter((f: any) => String(f.properties?.CNAE_2 || "") === filtroSetor) };
  }, [showEmp, filtroSetor]);

  const renderEdu = useMemo(() => {
    if (!showEdu?.features) return null;
    if (filtroDep === "(todas)") return showEdu;
    return { ...showEdu, features: showEdu.features.filter((f: any) => normalizeDep(String(f.properties?.tp_dependencia || "")).toLowerCase() === filtroDep.toLowerCase()) };
  }, [showEdu, filtroDep]);

  const renderSau = useMemo(() => {
    if (!showSau?.features) return null;
    if (filtroTipo === "(todas)") return showSau;
    return { ...showSau, features: showSau.features.filter((f: any) => String(f.properties?.co_tipo_estabelecimento || "").toLowerCase() === filtroTipo.toLowerCase()) };
  }, [showSau, filtroTipo]);

  const metricasEmp = useMemo(() => ({ base: calcEmp(baseEmpresas), impacto: calcEmp(atingidosEmpresas) }), [baseEmpresas, atingidosEmpresas]);
  const metricasEdu = useMemo(() => ({ base: calcEdu(baseEducacao), impacto: calcEdu(atingidosEducacao) }), [baseEducacao, atingidosEducacao]);
  const metricasSau = useMemo(() => ({ base: calcSau(baseSaude),    impacto: calcSau(atingidosSaude)    }), [baseSaude,    atingidosSaude]);

  const featsFiltrados = (gdf: any): { f: any; ha: number }[] =>
    (gdf?.features ?? [])
      .map((f: any) => ({ f, ha: turf.area(f) / 10000 }))
      .filter(({ ha }: { ha: number }) => ha >= 0.5);

  const metricasAgri = useMemo(() => ({
    base:    featsFiltrados(baseAgricultura),
    impacto: featsFiltrados(atingidosAgricultura),
  }), [baseAgricultura, atingidosAgricultura]);  

  const metricasCob = useMemo(() => ({
    base:    featsFiltrados(baseCobertura),
    impacto: featsFiltrados(atingidosCobertura),
  }), [baseCobertura, atingidosCobertura]);  

  const setoresUnicos = useMemo(() => {
    if (!baseEmpresas?.features) return [];
    return Array.from(new Set(baseEmpresas.features.map((f: any) => String(f.properties?.CNAE_2 || "")).filter(Boolean))).sort() as string[];
  }, [baseEmpresas]);

  const depsUnicas = useMemo(() => {
    if (!baseEducacao?.features) return [];
    return Array.from(new Set(baseEducacao.features.map((f: any) => normalizeDep(String(f.properties?.tp_dependencia || ""))).filter(Boolean))).sort() as string[];
  }, [baseEducacao]);

  const tiposUnicos = useMemo(() => {
    if (!baseSaude?.features) return [];
    return Array.from(new Set(baseSaude.features.map((f: any) => String(f.properties?.co_tipo_estabelecimento || "")).filter(Boolean))).sort() as string[];
  }, [baseSaude]);

  const empPorSetor = useMemo(() => {
    const agrega = (gdf: any): Record<string, number> => {
      const r: Record<string, number> = {};
      gdf?.features?.forEach((f: any) => {
        const s = String(f.properties?.CNAE_2 || "Sem Setor");
        r[s] = (r[s] || 0) + (Number(f.properties?.Empregados) || 0);
      });
      return r;
    };
    return { base: agrega(baseEmpresas), impacto: agrega(atingidosEmpresas) };
  }, [baseEmpresas, atingidosEmpresas]);

  const profPorDep = useMemo(() => {
    const agrega = (gdf: any): Record<string, number> => {
      const r: Record<string, number> = {};
      gdf?.features?.forEach((f: any) => {
        const dep = normalizeDep(String(f.properties?.tp_dependencia || ""));
        if (dep) r[dep] = (r[dep] || 0) + (Number(f.properties?.qtd_prof) || 0);
      });
      return r;
    };
    return { base: agrega(baseEducacao), impacto: agrega(atingidosEducacao) };
  }, [baseEducacao, atingidosEducacao]);

  // Base filtrada pelo filtro ativo (para denominadores de KPI quando filtro está ativo)
  const baseEmpFiltrado = useMemo(() => {
    if (filtroSetor === "(todos)") return baseEmpresas;
    return baseEmpresas ? { ...baseEmpresas, features: (baseEmpresas.features || []).filter((f: any) => String(f.properties?.CNAE_2 || "") === filtroSetor) } : null;
  }, [baseEmpresas, filtroSetor]);
  const baseEduFiltrado = useMemo(() => {
    if (filtroDep === "(todas)") return baseEducacao;
    return baseEducacao ? { ...baseEducacao, features: (baseEducacao.features || []).filter((f: any) => normalizeDep(String(f.properties?.tp_dependencia || "")) === filtroDep) } : null;
  }, [baseEducacao, filtroDep]);
  const baseSauFiltrado = useMemo(() => {
    if (filtroTipo === "(todas)") return baseSaude;
    return baseSaude ? { ...baseSaude, features: (baseSaude.features || []).filter((f: any) => String(f.properties?.co_tipo_estabelecimento || "").toLowerCase() === filtroTipo.toLowerCase()) } : null;
  }, [baseSaude, filtroTipo]);

  // Métricas calculadas sobre o dado filtrado atualmente exibido no mapa
  const renderEmpMetrics  = useMemo(() => calcEmp(renderEmp),       [renderEmp]);
  const renderEduMetrics  = useMemo(() => calcEdu(renderEdu),       [renderEdu]);
  const renderSauMetrics  = useMemo(() => calcSau(renderSau),       [renderSau]);
  const baseEmpFiltMetrics = useMemo(() => calcEmp(baseEmpFiltrado), [baseEmpFiltrado]);
  const baseEduFiltMetrics = useMemo(() => calcEdu(baseEduFiltrado), [baseEduFiltrado]);
  const baseSauFiltMetrics = useMemo(() => calcSau(baseSauFiltrado), [baseSauFiltrado]);

  const setoresChart = useMemo(() => {
    const src = isCenarioAtivo ? atingidosEmpresas : baseEmpresas;
    if (!src?.features) return [] as [string, number][];
    const counts: Record<string, number> = {};
    src.features.forEach((f: any) => {
      const s = String(f.properties?.CNAE_2 || "");
      if (s) counts[s] = (counts[s] || 0) + 1;
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]) as [string, number][];
    const top = sorted.slice(0, 9);
    const outros = sorted.slice(9).reduce((s, [, c]) => s + c, 0);
    if (outros > 0) top.push(["Outros", outros]);
    return top;
  }, [isCenarioAtivo, atingidosEmpresas, baseEmpresas]);

  const interactiveLayerIds = useMemo(() => {
    const ids: string[] = [];
    if (camadas.includes("Empresas")    && renderEmp?.features)  ids.push("empresas-cluster", "empresas-point");
    if (camadas.includes("Educação")    && renderEdu?.features)  ids.push("educacao-cluster", "educacao-point");
    if (camadas.includes("Saúde")       && renderSau?.features)  ids.push("saude-cluster",    "saude-point");
    if (camadas.includes("Infraestrutura")) {
      Object.keys(baseInfra).forEach(nome => {
        const geo = isCenarioAtivo ? atingidosInfra[nome] : baseInfra[nome];
        if (geo?.features) {
          const sid = `infra-${slugify(nome)}`;
          ids.push(`${sid}-fill`, `${sid}-line`, `${sid}-point`);
        }
      });
    }
    return ids;
  }, [camadas, renderEmp, renderEdu, renderSau, baseInfra, atingidosInfra, isCenarioAtivo]);

  // Força ponto layers (empresas/educação/saúde) sempre no topo do z-order
  useEffect(() => {
    if (!baseReady) return;
    const map = mapRef.current?.getMap();
    if (!map) return;
    const ids = [
      "empresas-cluster","empresas-count","empresas-point",
      "educacao-cluster","educacao-count","educacao-point",
      "saude-cluster","saude-count","saude-point",
    ];
    requestAnimationFrame(() => {
      ids.forEach(id => { try { if (map.getLayer(id)) map.moveLayer(id); } catch {} });
    });
  }, [baseReady, camadas, renderEmp, renderEdu, renderSau]);

  // ─── Map click ────────────────────────────────────────────────────────────

  const handleMapClick = (event: any) => {
    const feature = event.features?.[0];
    if (!feature) { setPopupInfo(null); return; }

    if (feature.source?.startsWith("infra-")) {
      const n = feature.source.replace("infra-", "").toLowerCase();
      if (["terrenos"].includes(n)) { setPopupInfo(null); return; }
    }

    if (feature.properties?.cluster) {
      const map = mapRef.current?.getMap();
      if (!map) return;
      const source: any = map.getSource(feature.source);
      source?.getClusterExpansionZoom?.(feature.properties.cluster_id, (err: any, zoom: number) => {
        if (!err) map.easeTo({ center: feature.geometry.coordinates, zoom: zoom + 0.5, duration: 800 });
      });
      return;
    }

    const lngLat = ["Point", "MultiPoint"].includes(feature.geometry.type)
      ? [feature.geometry.coordinates[0], feature.geometry.coordinates[1]]
      : [event.lngLat.lng, event.lngLat.lat];

    // Switch panel tab to match clicked layer
    const srcToTab: Record<string, string> = { empresas: "empresas", educacao: "educacao", saude: "saude" };
    if (srcToTab[feature.source]) {
      setTabAtiva(srcToTab[feature.source]);
      setShowPainelAnalise(true);
    } else if (feature.source?.startsWith("infra-")) {
      setTabAtiva("infra");
      setShowPainelAnalise(true);
    }

    setPopupInfo({ lngLat: lngLat as [number, number], properties: feature.properties, source: feature.source });
  };

  // ─── Popup ────────────────────────────────────────────────────────────────

  const renderPopupContent = () => {
    if (!popupInfo) return null;
    const { source, properties: p } = popupInfo;

    if (source === "empresas") return (
      <div className="flex flex-col gap-1.5 p-3 w-56 bg-white rounded-xl shadow-lg border border-slate-100">
        <strong className="text-blue-700 uppercase tracking-wider text-[10px] border-b border-slate-100 pb-1">🏢 Empresa</strong>
        <span className="font-bold text-xs text-slate-800 leading-tight">{p.CNAE_2 || "Sem Setor"}</span>
        <div className="grid grid-cols-2 gap-2 mt-1">
          <div className="bg-slate-50 p-1.5 rounded border border-slate-100">
            <span className="block text-[9px] text-slate-500 uppercase font-bold">Empregados</span>
            <span className="text-xs font-black text-slate-800">{p.Empregados}</span>
          </div>
          <div className="bg-slate-50 p-1.5 rounded border border-slate-100">
            <span className="block text-[9px] text-slate-500 uppercase font-bold">Massa Sal.</span>
            <span className="text-xs font-black text-slate-800">R$ {compactoBr(p.Massa_Salarial, 1)}</span>
          </div>
        </div>
      </div>
    );

    if (source === "educacao") return (
      <div className="flex flex-col gap-1.5 p-3 w-56 bg-white rounded-xl shadow-lg border border-slate-100">
        <strong className="text-green-700 uppercase tracking-wider text-[10px] border-b border-slate-100 pb-1">🎓 Educação ({normalizeDep(String(p.tp_dependencia || "")) || "N/A"})</strong>
        <span className="font-bold text-xs text-slate-800 leading-tight">{p.no_entidade || "Escola"}</span>
        <div className="grid grid-cols-2 gap-2 mt-1">
          <div className="bg-slate-50 p-1.5 rounded border border-slate-100">
            <span className="block text-[9px] text-slate-500 uppercase font-bold">Professores</span>
            <span className="text-xs font-black text-slate-800">{p.qtd_prof || 0}</span>
          </div>
          <div className="bg-slate-50 p-1.5 rounded border border-slate-100">
            <span className="block text-[9px] text-slate-500 uppercase font-bold">Total Alunos</span>
            <span className="text-xs font-black text-slate-800">{(p.qtd_matri_inf || 0) + (p.qtd_matri_fund || 0) + (p.qtd_matri_med || 0)}</span>
          </div>
        </div>
      </div>
    );

    if (source === "saude") {
      const totalProf = STAFF_COLS.reduce((a, c) => a + (p[c] || 0), 0);
      return (
        <div className="flex flex-col gap-1.5 p-3 w-56 bg-white rounded-xl shadow-lg border border-slate-100">
          <strong className="text-red-700 uppercase tracking-wider text-[10px] border-b border-slate-100 pb-1">🏥 Saúde ({p.co_tipo_estabelecimento || "N/A"})</strong>
          <span className="font-bold text-xs text-slate-800 leading-tight">{p.no_fantasia || p.no_razao_social || "Unidade"}</span>
          <div className="grid grid-cols-2 gap-2 mt-1">
            <div className="bg-slate-50 p-1.5 rounded border border-slate-100">
              <span className="block text-[9px] text-slate-500 uppercase font-bold">Médicos</span>
              <span className="text-xs font-black text-slate-800">{p.staff_medicos || 0}</span>
            </div>
            <div className="bg-slate-50 p-1.5 rounded border border-slate-100">
              <span className="block text-[9px] text-slate-500 uppercase font-bold">Enfermagem</span>
              <span className="text-xs font-black text-slate-800">{p.staff_enfermagem || 0}</span>
            </div>
            <div className="bg-slate-50 p-1.5 rounded border border-slate-100 col-span-2">
              <span className="block text-[9px] text-slate-500 uppercase font-bold">Total Profissionais</span>
              <span className="text-xs font-black text-slate-800">{totalProf}</span>
            </div>
          </div>
        </div>
      );
    }

    if (source === "agricultura" && p.tipo_cultura) {
      const feat = (showAgricultura?.features ?? []).find((f: any) => f.properties?.tipo_cultura === p.tipo_cultura);
      const ha = feat ? turf.area(feat) / 10000 : null;
      const cor = AGRI_COLORS[p.tipo_cultura] ?? COLORS.agricultura;
      return (
        <div className="flex flex-col gap-1.5 p-3 w-52 bg-white rounded-xl shadow-lg border border-slate-100">
          <strong className="uppercase tracking-wider text-[10px] border-b border-slate-100 pb-1 flex items-center gap-1.5" style={{ color: cor }}>
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: cor }} />
            Agricultura
          </strong>
          <div className="text-[10px] flex justify-between gap-2">
            <span className="text-slate-500 uppercase font-bold">Cultura:</span>
            <span className="text-slate-800 font-medium">{p.tipo_cultura}</span>
          </div>
          {ha !== null && (
            <div className="text-[10px] flex justify-between gap-2">
              <span className="text-slate-500 uppercase font-bold">Área total:</span>
              <span className="text-slate-800 font-medium">{formatoBr(ha, 0)} ha</span>
            </div>
          )}
        </div>
      );
    }

    if (source === "cobertura" && p.tipo_classe) {
      const feat = (showCobertura?.features ?? []).find((f: any) => f.properties?.tipo_classe === p.tipo_classe);
      const ha = feat ? turf.area(feat) / 10000 : null;
      const cor = COBERTURA_COLORS[p.tipo_classe] ?? COLORS.agricultura;
      return (
        <div className="flex flex-col gap-1.5 p-3 w-52 bg-white rounded-xl shadow-lg border border-slate-100">
          <strong className="uppercase tracking-wider text-[10px] border-b border-slate-100 pb-1 flex items-center gap-1.5" style={{ color: cor }}>
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: cor }} />
            Uso e Cobertura da Terra
          </strong>
          <div className="text-[10px] flex justify-between gap-2">
            <span className="text-slate-500 uppercase font-bold">Classe:</span>
            <span className="text-slate-800 font-medium">{p.tipo_classe}</span>
          </div>
          {ha !== null && (
            <div className="text-[10px] flex justify-between gap-2">
              <span className="text-slate-500 uppercase font-bold">Área total:</span>
              <span className="text-slate-800 font-medium">{formatoBr(ha, 0)} ha</span>
            </div>
          )}
        </div>
      );
    }

    if (source?.startsWith("infra-")) {
      const nomeLower = source.replace("infra-", "");
      let content: React.ReactNode = null;
      if (nomeLower === "imoveis") content = (<><div className="text-[10px] flex justify-between gap-2 border-b border-slate-50 pb-0.5"><span className="text-slate-500 uppercase font-bold">Uso:</span><span className="text-slate-800 font-medium text-right">{p.Uso || "—"}</span></div><div className="text-[10px] flex justify-between gap-2 border-b border-slate-50 pb-0.5"><span className="text-slate-500 uppercase font-bold">Patrimônio:</span><span className="text-slate-800 font-medium text-right">{p.Patrim || "—"}</span></div><div className="text-[10px] flex justify-between gap-2"><span className="text-slate-500 uppercase font-bold">Condomínio:</span><span className="text-slate-800 font-medium text-right">{p.Condom || "—"}</span></div></>);
      else if (nomeLower === "predios_publicos") content = (<><div className="text-[10px] flex justify-between gap-2 border-b border-slate-50 pb-0.5"><span className="text-slate-500 uppercase font-bold">Nome:</span><span className="text-slate-800 font-medium text-right">{p.Nome || "—"}</span></div><div className="text-[10px] flex justify-between gap-2"><span className="text-slate-500 uppercase font-bold">Endereço:</span><span className="text-slate-800 font-medium text-right">{p["Endereço"] || "—"}</span></div></>);
      else if (nomeLower === "seguranca") content = (<><div className="text-[10px] flex justify-between gap-2 border-b border-slate-50 pb-0.5"><span className="text-slate-500 uppercase font-bold">Nome:</span><span className="text-slate-800 font-medium text-right">{p.Nome || "—"}</span></div><div className="text-[10px] flex justify-between gap-2"><span className="text-slate-500 uppercase font-bold">Endereço:</span><span className="text-slate-800 font-medium text-right">{p["Endereço"] || "—"}</span></div></>);
      else if (nomeLower === "logradouros" && (p.nome || p.tipo)) content = (<>{p.tipo && <div className="text-[10px] flex justify-between gap-2 border-b border-slate-50 pb-0.5"><span className="text-slate-500 uppercase font-bold">Tipo:</span><span className="text-slate-800 font-medium text-right">{p.tipo}</span></div>}{p.nome && String(p.nome).length > 1 && <div className="text-[10px] flex justify-between gap-2"><span className="text-slate-500 uppercase font-bold">Nome:</span><span className="text-slate-800 font-medium text-right">{p.nome}</span></div>}</>);
      else if (nomeLower === "quadras" && (p.codigo || p.Area_m2)) content = (<>{p.codigo && <div className="text-[10px] flex justify-between gap-2 border-b border-slate-50 pb-0.5"><span className="text-slate-500 uppercase font-bold">Código:</span><span className="text-slate-800 font-medium text-right">{p.codigo}</span></div>}{p.Area_m2 && <div className="text-[10px] flex justify-between gap-2"><span className="text-slate-500 uppercase font-bold">Área:</span><span className="text-slate-800 font-medium text-right">{Number(p.Area_m2).toFixed(1)} m²</span></div>}</>);
      if (!content) return null;
      return (
        <div className="flex flex-col gap-1.5 p-3 w-56 bg-white rounded-xl shadow-lg border border-slate-100">
          <strong className="text-orange-600 uppercase tracking-wider text-[10px] border-b border-slate-100 pb-1">🏗️ {nomeLower.replace(/_/g, " ")}</strong>
          <div className="flex flex-col gap-1 mt-1">{content}</div>
        </div>
      );
    }
    return null;
  };

  // ─── Exportação ───────────────────────────────────────────────────────────

  const exportarExcel = useCallback(() => {
    const wb = XLSX.utils.book_new();
    const add = (data: any, nome: string) => {
      if (data?.features?.length > 0)
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.features.map((f: any) => f.properties)), nome);
    };
    if (camadas.includes("Empresas")) add(atingidosEmpresas || baseEmpresas, "Empresas");
    if (camadas.includes("Educação")) add(atingidosEducacao || baseEducacao, "Educação");
    if (camadas.includes("Saúde"))    add(atingidosSaude    || baseSaude,    "Saúde");
    if (camadas.includes("Infraestrutura")) {
      infraAtivas.forEach(infra => {
        const src = isCenarioAtivo ? atingidosInfra[infra] : baseInfra[infra];
        if (src) add(src, `Infra-${infra.slice(0, 20)}`);
      });
    }
    const sufixo = cenario !== "(nenhum)" ? `_${slugify(cenario)}` : "";
    XLSX.writeFile(wb, `Impacto_Rio_Grande${sufixo}.xlsx`);
  }, [camadas, cenario, isCenarioAtivo, infraAtivas, atingidosEmpresas, baseEmpresas, atingidosEducacao, baseEducacao, atingidosSaude, baseSaude, atingidosInfra, baseInfra]);

  // ─── Helpers de layout ────────────────────────────────────────────────────

  const possuiInfra = true;
  const temCamadaTabular = camadas.includes("Empresas") || camadas.includes("Educação") || camadas.includes("Saúde") || camadas.includes("Agricultura") || camadas.includes("Uso e Cobertura da Terra") || camadas.includes("Infraestrutura");

  useEffect(() => {
    if (tabAtiva === "agricultura" && !camadas.includes("Agricultura"))              setTabAtiva("empresas");
    if (tabAtiva === "cobertura"   && !camadas.includes("Uso e Cobertura da Terra")) setTabAtiva("empresas");
    if (tabAtiva === "infra" && (!camadas.includes("Infraestrutura") || infraAtivas.length === 0)) setTabAtiva("empresas");
  }, [camadas, infraAtivas, tabAtiva]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="relative w-screen h-screen font-sans overflow-hidden text-slate-900 print:overflow-visible print:h-auto print:w-full" style={{ backgroundColor: C.bg }}>

      {/* ── Mapa (fundo) ─────────────────────────────────────────────── */}
      <div className="absolute inset-0 z-0">
        <style dangerouslySetInnerHTML={{ __html: `
          .maplibregl-popup-content { background-color: #fff !important; padding: 0 !important; border-radius: 0.75rem !important; box-shadow: 0 20px 25px -5px rgb(0 0 0/.1),0 8px 10px -6px rgb(0 0 0/.1) !important; }
          .maplibregl-popup-tip { border-top-color: #fff !important; border-bottom-color: #fff !important; }
          .maplibregl-popup-close-button { right:6px !important; top:6px !important; font-size:16px !important; color:#64748b !important; z-index:10 !important; }
          .maplibregl-popup-close-button:hover { background-color: transparent !important; color:#000 !important; }
        `}} />
        <Map
          ref={mapRef}
          initialViewState={{ longitude: -52.22, latitude: -32.13, zoom: 10.8 }}
          mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
          interactiveLayerIds={interactiveLayerIds}
          onClick={handleMapClick}
          cursor={cursor}
          onMouseEnter={() => setCursor("pointer")}
          onMouseLeave={() => setCursor("grab")}
        >
          <NavigationControl position="bottom-right" />

          {popupInfo && (
            <Popup longitude={popupInfo.lngLat[0]} latitude={popupInfo.lngLat[1]} anchor="bottom" onClose={() => setPopupInfo(null)} closeButton closeOnClick={false} className="z-50 !p-0" maxWidth="250px">
              {renderPopupContent()}
            </Popup>
          )}

          {/* Polygon/line layers rendered first (below point layers) */}
          {baseReady && manchaCenario && showMancha && (
            <Source id="cenario" type="geojson" data={manchaCenario}>
              <Layer id="cenario-fill" type="fill"  paint={{ "fill-color": COLORS.cenario, "fill-opacity": 0.18 }} />
              <Layer id="cenario-line" type="line"  paint={{ "line-color": COLORS.cenario, "line-width": 2, "line-opacity": 0.8 }} />
            </Source>
          )}

          {camadas.includes("Uso e Cobertura da Terra") && showCobertura?.features && (
            <Source id="cobertura" type="geojson" data={showCobertura}>
              <Layer id="cobertura-fill" type="fill" paint={{
                "fill-color": ["match", ["get", "tipo_classe"],
                  "Silvicultura",                   "#7a5900",
                  "Campo Alagado e Area Pantanosa", "#519799",
                  "Formacao Campestre",             "#d6bc74",
                  "Mosaico de Usos",                "#E8C06B",
                  "Restinga Arborea",               "#02d659",
                  "Restinga Herbacea",              "#ad5100",
                  "#888888"],
                "fill-opacity": 0.68
              }} />
              <Layer id="cobertura-line" type="line" paint={{
                "line-color": ["match", ["get", "tipo_classe"],
                  "Silvicultura",                   "#7a5900",
                  "Campo Alagado e Area Pantanosa", "#519799",
                  "Formacao Campestre",             "#d6bc74",
                  "Mosaico de Usos",                "#E8C06B",
                  "Restinga Arborea",               "#02d659",
                  "Restinga Herbacea",              "#ad5100",
                  "#888888"],
                "line-width": 1,
                "line-opacity": 0.45
              }} />
            </Source>
          )}

          {camadas.includes("Agricultura") && showAgricultura?.features && (
            <Source id="agricultura" type="geojson" data={showAgricultura}>
              <Layer id="agricultura-fill" type="fill" paint={{
                "fill-color": ["match", ["get", "tipo_cultura"],
                  "Soja",                        "#D4A017",
                  "Arroz",                       "#4FC3F7",
                  "Outras Lavouras Temporarias", "#AED581",
                  "#888888"],
                "fill-opacity": 0.72
              }} />
              <Layer id="agricultura-line" type="line" paint={{
                "line-color": ["match", ["get", "tipo_cultura"],
                  "Soja",                        "#D4A017",
                  "Arroz",                       "#4FC3F7",
                  "Outras Lavouras Temporarias", "#AED581",
                  "#888888"],
                "line-width": 1,
                "line-opacity": 0.45
              }} />
            </Source>
          )}

          {/* Infra em ordem z: Segurança → Prédios → Logradouros → Terrenos → Quadras (último=fundo) */}
          {baseReady && camadas.includes("Infraestrutura") && ["Segurança", "Prédios Públicos", "Logradouros", "Terrenos", "Quadras"].map(nome => {
            const total = baseInfra[nome];
            if (!total || !infraAtivas.includes(nome)) return null;
            const sid = `infra-${slugify(nome)}`;
            const geo = cenario !== "(nenhum)" ? (atingidosInfra[nome] ?? { type: "FeatureCollection", features: [] }) : total;
            const cor = INFRA_COLORS[nome] ?? COLORS.infra;
            const corContorno = INFRA_COLORS[nome] ?? "#d97706";
            return (
              <Source key={sid} id={sid} type="geojson" data={geo}>
                <Layer id={`${sid}-fill`}  type="fill"   filter={["any",["==",["geometry-type"],"Polygon"],   ["==",["geometry-type"],"MultiPolygon"]]}    paint={{ "fill-color": cor, "fill-opacity": 0.25, "fill-outline-color": corContorno }} />
                <Layer id={`${sid}-line`}  type="line"   filter={["any",["==",["geometry-type"],"LineString"],["==",["geometry-type"],"MultiLineString"]]}  paint={{ "line-color": cor, "line-width": 2.5 }} />
                <Layer id={`${sid}-point`} type="circle" filter={["any",["==",["geometry-type"],"Point"],     ["==",["geometry-type"],"MultiPoint"]]}        paint={{ "circle-color": cor, "circle-radius": 4.5, "circle-stroke-width": 1.5, "circle-stroke-color": "#fff" }} />
              </Source>
            );
          })}

          {/* Point layers rendered last (above polygon/line layers) */}
          <Source id="empresas" type="geojson" data={camadas.includes("Empresas") && renderEmp?.features ? renderEmp : EMPTY_GEO} cluster clusterMaxZoom={14} clusterRadius={40}>
            <Layer id="empresas-cluster" type="circle" filter={["has","point_count"]}       layout={{ visibility: (camadas.includes("Empresas") && !!renderEmp?.features) ? "visible" : "none" }} paint={{ "circle-color": COLORS.empresas, "circle-radius": ["step",["get","point_count"],14,50,20,200,26], "circle-stroke-width": 2, "circle-stroke-color": "#fff" }} />
            <Layer id="empresas-count"   type="symbol" filter={["has","point_count"]}       layout={{ visibility: (camadas.includes("Empresas") && !!renderEmp?.features) ? "visible" : "none", "text-field": "{point_count_abbreviated}", "text-size": 11 }} paint={{ "text-color": "#fff" }} />
            <Layer id="empresas-point"   type="circle" filter={["!",["has","point_count"]]} layout={{ visibility: (camadas.includes("Empresas") && !!renderEmp?.features) ? "visible" : "none" }} paint={{ "circle-color": COLORS.empresas, "circle-radius": 5, "circle-stroke-width": 1.5, "circle-stroke-color": "#fff" }} />
          </Source>
          <Source id="educacao" type="geojson" data={camadas.includes("Educação") && renderEdu?.features ? renderEdu : EMPTY_GEO} cluster clusterMaxZoom={14} clusterRadius={40}>
            <Layer id="educacao-cluster" type="circle" filter={["has","point_count"]}       layout={{ visibility: (camadas.includes("Educação") && !!renderEdu?.features) ? "visible" : "none" }} paint={{ "circle-color": COLORS.educacao, "circle-radius": ["step",["get","point_count"],14,50,20,200,26], "circle-stroke-width": 2, "circle-stroke-color": "#fff" }} />
            <Layer id="educacao-count"   type="symbol" filter={["has","point_count"]}       layout={{ visibility: (camadas.includes("Educação") && !!renderEdu?.features) ? "visible" : "none", "text-field": "{point_count_abbreviated}", "text-size": 11 }} paint={{ "text-color": "#fff" }} />
            <Layer id="educacao-point"   type="circle" filter={["!",["has","point_count"]]} layout={{ visibility: (camadas.includes("Educação") && !!renderEdu?.features) ? "visible" : "none" }} paint={{ "circle-color": COLORS.educacao, "circle-radius": 5, "circle-stroke-width": 1.5, "circle-stroke-color": "#fff" }} />
          </Source>
          <Source id="saude" type="geojson" data={camadas.includes("Saúde") && renderSau?.features ? renderSau : EMPTY_GEO} cluster clusterMaxZoom={14} clusterRadius={40}>
            <Layer id="saude-cluster" type="circle" filter={["has","point_count"]}       layout={{ visibility: (camadas.includes("Saúde") && !!renderSau?.features) ? "visible" : "none" }} paint={{ "circle-color": COLORS.saude, "circle-radius": ["step",["get","point_count"],14,50,20,200,26], "circle-stroke-width": 2, "circle-stroke-color": "#fff" }} />
            <Layer id="saude-count"   type="symbol" filter={["has","point_count"]}       layout={{ visibility: (camadas.includes("Saúde") && !!renderSau?.features) ? "visible" : "none", "text-field": "{point_count_abbreviated}", "text-size": 11 }} paint={{ "text-color": "#fff" }} />
            <Layer id="saude-point"   type="circle" filter={["!",["has","point_count"]]} layout={{ visibility: (camadas.includes("Saúde") && !!renderSau?.features) ? "visible" : "none" }} paint={{ "circle-color": COLORS.saude, "circle-radius": 5, "circle-stroke-width": 1.5, "circle-stroke-color": "#fff" }} />
          </Source>
        </Map>
      </div>

      {/* ── Loading ──────────────────────────────────────────────────── */}
      {isLoading && (
        <div className="absolute inset-0 z-50 pointer-events-none flex items-end justify-center pb-6">
          <div className="bg-white/90 backdrop-blur-md border border-slate-200/60 rounded-full px-4 py-2 flex items-center gap-2 shadow-lg">
            <svg className="animate-spin h-4 w-4" style={{ color: C.primary }} fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-xs font-bold text-slate-700">Carregando dados...</span>
          </div>
        </div>
      )}

      {/* ── Legenda ──────────────────────────────────────────────────── */}
      <div className={`absolute bottom-4 rounded-xl shadow-lg z-10 print:hidden transition-[left] duration-300 ${showPainelAnalise ? "left-[370px]" : "left-4"}`} style={{ backgroundColor: "#fff", border: `1px solid ${C.border}`, transitionTimingFunction: "var(--ease-out)" }}>
        <button
          onClick={() => setShowLegenda(p => !p)}
          className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-xl"
          style={{ color: C.muted }}
        >
          <span className="text-[8px] font-black uppercase tracking-wider">Legenda</span>
          <span style={{ fontSize: 7 }}>{showLegenda ? "▼" : "▲"}</span>
        </button>
        {showLegenda && (
          <div className="flex flex-col gap-1 px-2 pb-2">
            {camadas.includes("Empresas") && renderEmp?.features  && <LegendItem cor={COLORS.empresas} label="Empresas" />}
            {camadas.includes("Saúde")    && renderSau?.features  && <LegendItem cor={COLORS.saude}    label="Saúde" />}
            {camadas.includes("Educação") && renderEdu?.features  && <LegendItem cor={COLORS.educacao} label="Educação" />}
            {camadas.includes("Infraestrutura") && infraAtivas.map(nome => (
              <LegendItem key={`infra-${nome}`} cor={INFRA_COLORS[nome] ?? COLORS.infra} label={nome} area={["Quadras","Terrenos"].includes(nome)} />
            ))}
            {camadas.includes("Agricultura") && showAgricultura?.features && (
              Object.entries(AGRI_COLORS).map(([tipo, cor]) => (
                <LegendItem key={`agr-${tipo}`} cor={cor} label={tipo} area />
              ))
            )}
            {camadas.includes("Uso e Cobertura da Terra") && showCobertura?.features && (
              Object.entries(COBERTURA_COLORS).map(([tipo, cor]) => (
                <LegendItem key={`cob-${tipo}`} cor={cor} label={tipo} area />
              ))
            )}
            {manchaCenario && showMancha && <LegendItem cor={COLORS.cenario} label={cenario} area />}
          </div>
        )}
      </div>

      {/* ── Copyright ────────────────────────────────────────────────── */}
      <div className="absolute bottom-4 inset-x-0 flex justify-center z-10 print:hidden pointer-events-none">
        <div className="px-2.5 py-0.5 rounded-xl shadow-lg select-none leading-none text-center" style={{ backgroundColor: "#fff", border: `1px solid ${C.border}` }}>
          <span className="text-[9px] font-black uppercase tracking-wider" style={{ color: C.muted }}>© GPEa — Grupo de Pesquisa em Economia Azul</span>
          <span className="text-[9px]" style={{ color: C.muted }}> | Alisson T. G. Fiorentin</span>
        </div>
      </div>

      {/* ── Header — single row, original zip sizes, no flex-wrap → panels at top-[90px] */}
      <header className="absolute top-2 left-4 right-4 px-4 py-3 flex gap-4 items-center shadow-2xl z-20 rounded-xl print:hidden" style={{ backgroundColor: C.primary, border: `1px solid ${C.dark}` }}>

        {/* Logos CIEX + GPEA */}
        <div className="flex items-center gap-3 shrink-0 border-r pr-4" style={{ borderColor: "rgba(255,255,255,0.2)" }}>
          <Image src="/CIEX.png" alt="CIEX" width={80} height={36} className="object-contain" style={{ height: "2.25rem", width: "auto" }} onError={e => (e.currentTarget.style.display = "none")} />
          <Image src="/GPEA.png" alt="GPEA" width={80} height={32} className="object-contain" style={{ height: "2rem", width: "auto" }} onError={e => (e.currentTarget.style.display = "none")} />
          <div className="pl-3 flex flex-col justify-center">
            <h1 className="text-base font-black leading-tight text-white whitespace-nowrap">Painel de Vulnerabilidade Econômica</h1>
            <span className="text-[11px] font-medium tracking-wider uppercase text-white/70">Rio Grande, RS</span>
          </div>
        </div>

        {/* Cenário */}
        <div className="flex flex-col gap-0.5 shrink-0 border-r pr-4" style={{ borderColor: "rgba(255,255,255,0.2)" }}>
          <label className="text-[9px] font-bold uppercase tracking-wider text-white/70">Cenário de Inundação</label>
          <Select value={cenario} onValueChange={setCenario}>
            <SelectTrigger className="h-8 text-xs text-white border-white/20 w-44" style={{ backgroundColor: C.field }}><SelectValue placeholder="(nenhum)" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="(nenhum)">(Ver Total)</SelectItem>
              {CENARIOS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Camadas */}
        <div className="flex gap-2 items-center">
          {[
            { id: "Empresas",                 label: "Empresas",    icon: <Building2 size={12} strokeWidth={2.5} />,     activeClass: "bg-white text-[#1E404A] border-[#dce1d8]", ringClass: "focus-visible:ring-[#1E404A]/40" },
            { id: "Saúde",                    label: "Saúde",       icon: <HeartPulse size={12} strokeWidth={2.5} />,    activeClass: "bg-white text-[#1E404A] border-[#dce1d8]", ringClass: "focus-visible:ring-[#1E404A]/40" },
            { id: "Educação",                 label: "Educação",    icon: <GraduationCap size={12} strokeWidth={2.5} />, activeClass: "bg-white text-[#1E404A] border-[#dce1d8]", ringClass: "focus-visible:ring-[#1E404A]/40" },
            { id: "Agricultura",              label: "Agricultura", icon: <Sprout size={12} strokeWidth={2.5} />,        activeClass: "bg-white text-[#1E404A] border-[#dce1d8]", ringClass: "focus-visible:ring-[#1E404A]/40" },
            { id: "Uso e Cobertura da Terra", label: "Cobertura",   icon: <Leaf size={12} strokeWidth={2.5} />,          activeClass: "bg-white text-[#1E404A] border-[#dce1d8]", ringClass: "focus-visible:ring-[#1E404A]/40" },
          ].map(({ id, label, icon, activeClass, ringClass }) => (
            <button key={id} onClick={() => toggleCamada(id)}
              className={`h-8 px-3 rounded-md text-xs font-black active-press hover-lift flex items-center gap-1.5 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${ringClass} ${camadas.includes(id) ? activeClass : "text-white/80 border-white/20 hover:bg-white/10"}`}
              style={camadas.includes(id) ? {} : { backgroundColor: C.field }}>
              {icon}{label}
            </button>
          ))}

          {/* Infraestrutura dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger disabled={!possuiInfra}
              className={`h-8 px-3 flex items-center justify-between gap-2 rounded-md text-xs font-black active-press hover-lift whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed ${camadas.includes("Infraestrutura") && infraAtivas.length > 0 ? "bg-white text-[#1E404A] border-[#dce1d8]" : "text-white/80 border-white/20 hover:bg-white/10"}`}
              style={camadas.includes("Infraestrutura") && infraAtivas.length > 0 ? {} : { backgroundColor: C.field }}>
              <span className="flex items-center gap-1.5"><Wrench size={12} strokeWidth={2.5} />Infraestrutura {infraAtivas.length > 0 && `(${infraAtivas.length})`}</span>
              <span className="text-[8px] opacity-70">▼</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end">
              <button onClick={toggleMenuInfra} className="w-full text-left text-xs font-bold px-2 py-1 mb-1 text-slate-500 hover:bg-slate-100 border-b border-slate-200/60 transition-colors duration-150 focus-visible:outline-none">
                {camadas.includes("Infraestrutura") ? "Ocultar Camada" : "Exibir Camada"}
              </button>
              {INFRA_LAYERS.map(nome => (
                <DropdownMenuCheckboxItem key={nome} checked={infraAtivas.includes(nome)} onCheckedChange={() => toggleInfra(nome)} className="text-xs hover:bg-slate-100">
                  {nome}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* ── Filtros (direita) ─────────────────────────────────────────── */}
      {showFiltros && (temCamadaTabular || isCenarioAtivo) && (
        <div className="print:hidden absolute top-[90px] right-4 flex flex-col gap-1.5 p-2.5 rounded-xl shadow-2xl z-10 w-36 max-h-[calc(100vh-110px)] overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full" style={{ backgroundColor: "#fff", border: `1px solid ${C.border}`, ["--tw-scrollbar-thumb" as any]: C.border }}>
          <div className="flex justify-between items-center mb-0.5 border-b pb-1.5" style={{ borderColor: C.border }}>
            <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: C.primary }}>Filtros</span>
            <button onClick={() => setShowFiltros(false)} className="font-black text-xs px-1" style={{ color: C.muted }}>✖</button>
          </div>

          {camadas.includes("Empresas") && (
            <div className="flex flex-col gap-0.5 w-full overflow-hidden shrink-0">
              <label className="text-[8px] font-bold text-blue-700 uppercase tracking-wider">Setor (Empresas)</label>
              <Select value={filtroSetor} onValueChange={setFiltroSetor}>
                <SelectTrigger className="h-6 border-blue-200/60 bg-blue-50/50 text-[10px] w-full [&>span]:truncate"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="(todos)">(todos)</SelectItem>
                  {setoresUnicos.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {camadas.includes("Educação") && (
            <div className="flex flex-col gap-0.5 w-full overflow-hidden shrink-0">
              <label className="text-[8px] font-bold text-green-700 uppercase tracking-wider">Dependência (Escolas)</label>
              <Select value={filtroDep} onValueChange={setFiltroDep}>
                <SelectTrigger className="h-6 border-green-200/60 bg-green-50/50 text-[10px] w-full [&>span]:truncate"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="(todas)">(todas)</SelectItem>
                  {depsUnicas.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {camadas.includes("Saúde") && (
            <div className="flex flex-col gap-0.5 w-full overflow-hidden shrink-0">
              <label className="text-[8px] font-bold text-red-700 uppercase tracking-wider">Unidade (Saúde)</label>
              <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                <SelectTrigger className="h-6 border-red-200/60 bg-red-50/50 text-[10px] w-full [&>span]:truncate"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="(todas)">(todas)</SelectItem>
                  {tiposUnicos.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {camadas.includes("Infraestrutura") && infraAtivas.length > 0 && (
            <div className="flex flex-col gap-0.5 w-full overflow-hidden shrink-0">
              <label className="text-[8px] font-bold text-orange-700 uppercase tracking-wider">Infraestrutura</label>
              <DropdownMenu>
                <DropdownMenuTrigger className="h-6 border-orange-200/60 bg-orange-50/50 text-[10px] w-full flex justify-between items-center px-2 rounded transition-colors">
                  <span className="truncate">{infraAtivas.length} selecionada(s)</span>
                  <span className="text-[8px] opacity-70">▼</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-36" align="end">
                  {infraAtivas.map(nome => (
                    <DropdownMenuCheckboxItem key={nome} checked onCheckedChange={() => toggleInfra(nome)} className="text-[10px] hover:bg-slate-100">{nome}</DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
          {isCenarioAtivo && (
            <div className="flex flex-col gap-0.5 w-full shrink-0">
              <label className="text-[8px] font-bold uppercase tracking-wider" style={{ color: COLORS.cenario }}>Mancha de Inundação</label>
              <button
                onClick={() => setShowMancha(p => !p)}
                className="h-6 w-full rounded text-[10px] font-bold border transition-colors duration-150"
                style={{
                  backgroundColor: showMancha ? `${COLORS.cenario}20` : "transparent",
                  borderColor: showMancha ? COLORS.cenario : C.border,
                  color: showMancha ? COLORS.cenario : C.muted,
                }}
              >
                {showMancha ? "Visível" : "Oculta"}
              </button>
            </div>
          )}
        </div>
      )}
      {!showFiltros && (temCamadaTabular || isCenarioAtivo) && (
        <button onClick={() => setShowFiltros(true)}
          className="absolute top-[90px] right-4 text-xs font-black shadow-2xl px-4 py-2 rounded-xl z-20 hover:bg-slate-50 active-press hover-lift flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 print:hidden"
          style={{ backgroundColor: "#fff", border: `1px solid ${C.border}`, color: C.primary }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = C.cardBg)}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = "#fff")}>
          <SlidersHorizontal size={12} strokeWidth={2.5} />Filtros
        </button>
      )}

      {/* ── Painel de Análise (esquerda flutuante) ─────────────────────── */}
      {showPainelAnalise && (
        <div className="absolute top-[90px] left-4 bottom-4 w-[350px] flex flex-col backdrop-blur-md rounded-xl shadow-2xl p-4 overflow-hidden z-20 print:static print:w-full print:shadow-none print:max-h-none print:h-auto print:overflow-visible" style={{ backgroundColor: `${C.bg}f2`, border: `1px solid ${C.border}`, animation: "panelSlideIn 320ms var(--ease-drawer) both" }}>
          <div className="mb-3 shrink-0">
            <h2 className="text-base font-black tracking-tight flex items-center justify-between" style={{ color: C.primary }}>
              Painel
              <div className="flex gap-1">
                <button onClick={exportarExcel} className="flex items-center gap-1 text-[9px] text-white font-bold px-2 py-1 rounded-md active-press hover-lift cursor-pointer" style={{ backgroundColor: C.primary }}>
                  <Download size={10} strokeWidth={2.5} />Baixar
                </button>
                <button onClick={() => window.print()} className="flex items-center gap-1 text-[9px] bg-slate-200/80 hover:bg-slate-300 text-slate-700 font-bold px-2 py-1 rounded-md active-press hover-lift print:hidden">
                  <Printer size={10} strokeWidth={2.5} />Imprimir
                </button>
                <button onClick={() => setShowPainelAnalise(false)} className="flex items-center gap-1 text-[9px] bg-slate-200/80 hover:bg-slate-300 text-slate-700 font-bold px-2 py-1 rounded-md active-press hover-lift print:hidden">
                  <EyeOff size={10} strokeWidth={2.5} />Ocultar
                </button>
              </div>
            </h2>
            <p className="text-[10px] text-slate-500 font-medium mt-0.5 leading-tight">
              <strong className="text-slate-700">Rio Grande, RS</strong>{isCenarioAtivo && ` — ${cenario}`}
            </p>
          </div>

          <Tabs value={tabAtiva} className="w-full flex-1 flex flex-col overflow-hidden print:overflow-visible print:h-auto">
            <div className="flex flex-wrap gap-1.5 shrink-0 pb-3 border-b" style={{ borderColor: C.border }}>
              {([
                { value: "empresas",    label: "Empresas",    icon: <Building2     size={11} strokeWidth={2.5} /> },
                { value: "saude",       label: "Saúde",       icon: <HeartPulse    size={11} strokeWidth={2.5} /> },
                { value: "educacao",    label: "Educação",    icon: <GraduationCap size={11} strokeWidth={2.5} /> },
                ...( camadas.includes("Infraestrutura") && infraAtivas.length > 0 ? [{ value: "infra",       label: "Infraestrutura", icon: <Wrench  size={11} strokeWidth={2.5} /> }] : []),
                ...( camadas.includes("Agricultura")              ? [{ value: "agricultura", label: "Agricultura", icon: <Sprout  size={11} strokeWidth={2.5} /> }] : []),
                ...( camadas.includes("Uso e Cobertura da Terra") ? [{ value: "cobertura",   label: "Cobertura",   icon: <Leaf    size={11} strokeWidth={2.5} /> }] : []),
              ] as { value: string; label: string; icon: React.ReactNode }[]).map(({ value, label, icon }) => (
                <button
                  key={value}
                  onClick={() => setTabAtiva(value)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[10px] font-bold transition-[background-color,color,box-shadow] duration-150 border focus-visible:outline-none"
                  style={tabAtiva === value
                    ? { backgroundColor: C.primary, color: "#fff",  borderColor: C.dark, boxShadow: "0 1px 3px rgba(0,0,0,.18)" }
                    : { backgroundColor: "#fff",     color: C.muted, borderColor: C.border }}
                >
                  {icon}{label}
                </button>
              ))}
            </div>

            {/* Empresas */}
            <TabsContent value="empresas" className="flex-1 overflow-y-auto mt-4 pr-2 pb-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb]:rounded-full">
              {setoresChart.length > 0 && (() => {
                const totalBase = metricasEmp.base.estab;
                const total = setoresChart.reduce((s, [, c]) => s + (c as number), 0);
                const pieData = setoresChart.map(([name, value]) => ({ name, value }));
                return (
                  <>
                    <h3 className="text-[11px] font-black uppercase tracking-wider mb-1 border-b border-slate-200/60 pb-1" style={{ color: C.primary }}>Empresas</h3>
                    <div className="relative flex items-center justify-center">
                      <ResponsiveContainer width="100%" height={170}>
                        <PieChart>
                          <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={76} paddingAngle={2} dataKey="value" stroke="none" cursor="pointer"
                            onClick={(d: any) => setFiltroSetor(filtroSetor === d.name ? "(todos)" : d.name)}>
                            {pieData.map((entry, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} opacity={filtroSetor !== "(todos)" && filtroSetor !== entry.name ? 0.35 : 1} />)}
                          </Pie>
                          <Tooltip
                            formatter={(v: any) => [`${v} empresa${v !== 1 ? "s" : ""}`, ""]}
                            contentStyle={{ fontSize: 11, borderRadius: 8, border: `1px solid ${C.border}`, padding: "4px 10px" }}
                            itemStyle={{ color: C.primary }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute flex flex-col items-center pointer-events-none">
                        <span className="text-2xl font-black leading-none" style={{ color: C.primary }}>{total}</span>
                        {isCenarioAtivo
                          ? <><span className="text-[9px] font-medium" style={{ color: C.muted }}>{Math.round(total / totalBase * 100)}% empresas</span><span className="text-[9px]" style={{ color: C.muted }}>de {totalBase}</span></>
                          : <span className="text-[9px] font-medium" style={{ color: C.muted }}>empresas</span>}
                      </div>
                    </div>
                    <div className="flex flex-col gap-0.5 mb-3">
                      {setoresChart.map(([setor, count], i) => (
                        <div key={setor}
                          className="flex items-center gap-2 rounded-md px-1 py-0.5 cursor-pointer transition-colors"
                          style={{ backgroundColor: filtroSetor === setor ? `${DONUT_COLORS[i % DONUT_COLORS.length]}22` : "transparent", outline: filtroSetor === setor ? `1px solid ${DONUT_COLORS[i % DONUT_COLORS.length]}55` : "none" }}
                          onClick={() => setFiltroSetor(filtroSetor === setor ? "(todos)" : setor)}
                          title={filtroSetor === setor ? "Clique para remover filtro" : `Filtrar por ${setor}`}
                        >
                          <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                          <span className="text-[9px] flex-1 truncate" style={{ color: filtroSetor === setor ? C.primary : C.muted }} title={setor}>{setor}</span>
                          <span className="text-[9px] font-bold tabular-nums" style={{ color: C.primary }}>{count}</span>
                          <span className="text-[9px] w-8 text-right tabular-nums" style={{ color: C.muted }}>{Math.round((count as number / total) * 100)}%</span>
                        </div>
                      ))}
                      {filtroSetor !== "(todos)" && <button className="text-[9px] font-bold mt-1.5 px-2.5 py-1 rounded-md self-start" style={{ backgroundColor: `${C.primary}15`, color: C.primary, border: `1px solid ${C.primary}35` }} onClick={() => setFiltroSetor("(todos)")}>✕ Limpar filtro</button>}
                    </div>
                  </>
                );
              })()}
              <div className="flex flex-col gap-2 pb-2 animate-fade-in-up">
                <KPIRow isLoading={isLoading} titulo="Empregados" cor={COLORS.empresas}
                  valor={compactoBr(renderEmpMetrics.emp, 0)}
                  sub={isCenarioAtivo ? "Atingidos" : "Total"}
                  delta={isCenarioAtivo ? `de ${compactoBr(baseEmpFiltMetrics.emp, 0)} (${calcPct(renderEmpMetrics.emp, baseEmpFiltMetrics.emp)})` : undefined} />
              </div>
              {(() => {
                const setores = Object.keys(empPorSetor.base).sort((a, b) => (empPorSetor.base[b] || 0) - (empPorSetor.base[a] || 0)).slice(0, 9);
                if (setores.length === 0) return null;
                const maxBase = empPorSetor.base[setores[0]] || 1;
                return (
                  <>
                    <h3 className="text-[11px] font-black uppercase tracking-wider mt-3 mb-2 border-b border-slate-200/60 pb-1" style={{ color: C.primary }}>Empregados por Setor</h3>
                    <div className="flex flex-col gap-1.5 mb-3">
                      {setores.map((setor, i) => {
                        const baseVal = empPorSetor.base[setor] || 0;
                        const atgVal  = empPorSetor.impacto[setor] || 0;
                        const val  = isCenarioAtivo ? atgVal : baseVal;
                        const pct  = baseVal > 0 ? Math.round((atgVal / baseVal) * 100) : 0;
                        const isSelected = filtroSetor === setor;
                        return (
                          <div key={setor}
                            className="flex items-center gap-2 rounded-lg px-1 py-0.5 cursor-pointer transition-colors"
                            style={{ backgroundColor: isSelected ? `${DONUT_COLORS[i % DONUT_COLORS.length]}18` : "transparent", outline: isSelected ? `1px solid ${DONUT_COLORS[i % DONUT_COLORS.length]}44` : "none" }}
                            onClick={() => setFiltroSetor(isSelected ? "(todos)" : setor)}
                            title={isSelected ? "Clique para remover filtro" : `Filtrar por ${setor}`}
                          >
                            <span className="text-[9px] w-24 shrink-0 truncate" style={{ color: isSelected ? C.primary : C.muted }} title={setor}>{setor}</span>
                            <div className="flex-1 rounded-full h-2.5 overflow-hidden" style={{ backgroundColor: C.cardBg }}>
                              <div className="h-full rounded-full" style={{ width: `${isCenarioAtivo ? pct : Math.round((val/maxBase)*100)}%`, backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                            </div>
                            <span className="text-[9px] font-bold tabular-nums w-16 text-right shrink-0" style={{ color: C.primary }}>
                              {compactoBr(val, 0)}{isCenarioAtivo ? ` (${pct}%)` : ""}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              })()}
              <div className="flex flex-col gap-2 pb-2">
                <KPIRow isLoading={isLoading} titulo="Massa Salarial" cor={COLORS.empresas}
                  valor={`R$ ${compactoBr(renderEmpMetrics.massa, 1)}`} sub="Mensal Estimada"
                  delta={isCenarioAtivo ? `de R$ ${compactoBr(baseEmpFiltMetrics.massa, 1)} (${calcPct(renderEmpMetrics.massa, baseEmpFiltMetrics.massa)})` : undefined} />
                <KPIRow isLoading={isLoading} titulo="Média Salarial" cor={COLORS.empresas}
                  valor={`R$ ${compactoBr(renderEmpMetrics.media, 1)}`} sub="Por Estabelecimento" />
              </div>
              <p className="text-[9px] italic mt-3 pt-2 border-t" style={{ color: C.muted, borderColor: C.border }}>Fonte: RAIS — Relação Anual de Informações Sociais</p>
            </TabsContent>

            {/* Educação */}
            <TabsContent value="educacao" className="flex-1 overflow-y-auto mt-4 pr-2 pb-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb]:rounded-full">
              {(() => {
                const src = isCenarioAtivo ? atingidosEducacao : baseEducacao;
                if (!src?.features) return null;
                const counts: Record<string, number> = {};
                src.features.forEach((f: any) => {
                  const dep = normalizeDep(String(f.properties?.tp_dependencia || ""));
                  if (dep) counts[dep] = (counts[dep] || 0) + 1;
                });
                const pieData = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
                const totalDep = pieData.reduce((s, d) => s + d.value, 0);
                const baseTotalDep = isCenarioAtivo ? (baseEducacao?.features?.length ?? 0) : totalDep;
                if (pieData.length === 0) return null;
                const listaFeats = isCenarioAtivo
                  ? (atingidosEducacao?.features ?? []).filter((f: any) => filtroDep === "(todas)" || normalizeDep(String(f.properties?.tp_dependencia || "")) === filtroDep)
                  : [];
                const lista = listaFeats.map((f: any) => String(f.properties?.no_entidade ?? "").trim()).filter(Boolean).sort((a: string, b: string) => a.localeCompare(b, "pt-BR"));
                return (
                  <>
                    <h3 className="text-[11px] font-black uppercase tracking-wider mb-1 border-b border-slate-200/60 pb-1" style={{ color: C.primary }}>Escolas</h3>
                    <div className="relative flex items-center justify-center">
                      <ResponsiveContainer width="100%" height={160}>
                        <PieChart>
                          <Pie data={pieData} cx="50%" cy="50%" innerRadius={46} outerRadius={70} paddingAngle={2} dataKey="value" stroke="none" cursor="pointer"
                            onClick={(d: any) => setFiltroDep(filtroDep === d.name ? "(todas)" : d.name)}>
                            {pieData.map((d, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} opacity={filtroDep !== "(todas)" && filtroDep !== d.name ? 0.35 : 1} />)}
                          </Pie>
                          <Tooltip formatter={(v: any) => [`${v} escola${v !== 1 ? "s" : ""}`, ""]} contentStyle={{ fontSize: 11, borderRadius: 8, border: `1px solid ${C.border}`, padding: "4px 10px" }} itemStyle={{ color: C.primary }} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute flex flex-col items-center pointer-events-none">
                        <span className="text-2xl font-black leading-none" style={{ color: C.primary }}>{totalDep}</span>
                        {isCenarioAtivo
                          ? <><span className="text-[9px] font-medium" style={{ color: C.muted }}>{Math.round(totalDep / baseTotalDep * 100)}% escolas</span><span className="text-[9px]" style={{ color: C.muted }}>de {baseTotalDep}</span></>
                          : <span className="text-[10px] font-medium" style={{ color: C.muted }}>escolas</span>}
                      </div>
                    </div>
                    <div className="flex flex-col gap-0.5 mb-2">
                      {pieData.map((d, i) => (
                        <div key={d.name}
                          className="flex items-center gap-2 rounded-md px-1 py-0.5 cursor-pointer transition-colors"
                          style={{ backgroundColor: filtroDep === d.name ? `${DONUT_COLORS[i % DONUT_COLORS.length]}22` : "transparent", outline: filtroDep === d.name ? `1px solid ${DONUT_COLORS[i % DONUT_COLORS.length]}55` : "none" }}
                          onClick={() => setFiltroDep(filtroDep === d.name ? "(todas)" : d.name)}
                          title={filtroDep === d.name ? "Clique para remover filtro" : `Filtrar por ${d.name}`}
                        >
                          <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                          <span className="text-[11px] flex-1" style={{ color: filtroDep === d.name ? C.primary : C.muted }}>{d.name}</span>
                          <span className="text-[11px] font-bold tabular-nums" style={{ color: C.primary }}>{d.value}</span>
                          <span className="text-[11px] w-9 text-right tabular-nums" style={{ color: C.muted }}>{Math.round(d.value / totalDep * 100)}%</span>
                        </div>
                      ))}
                      {filtroDep !== "(todas)" && <button className="text-[9px] font-bold mt-1.5 px-2.5 py-1 rounded-md self-start" style={{ backgroundColor: `${C.primary}15`, color: C.primary, border: `1px solid ${C.primary}35` }} onClick={() => setFiltroDep("(todas)")}>✕ Limpar filtro</button>}
                    </div>
                    {lista.length > 0 && (
                      <div className="flex flex-col gap-1 mb-2">
                        <button onClick={() => setShowListaEscolas(p => !p)}
                          className="w-full flex items-center justify-between text-[10px] font-bold px-2.5 py-1.5 rounded-lg"
                          style={{ backgroundColor: C.cardBg, color: C.primary, border: `1px solid ${C.border}` }}>
                          <span>Escolas Atingidas ({lista.length})</span>
                          <span style={{ fontSize: 9 }}>{showListaEscolas ? "▲" : "▼"}</span>
                        </button>
                        {showListaEscolas && (
                          <div className="flex flex-col gap-0.5 max-h-52 overflow-y-auto rounded-lg p-1.5" style={{ backgroundColor: C.cardBg, border: `1px solid ${C.border}` }}>
                            {lista.map((nome: string, i: number) => (
                              <span key={i} className="text-[10px] px-1.5 py-0.5 rounded" style={{ color: C.muted }} title={nome}>{nome}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                );
              })()}
              <div className="flex flex-col gap-2 mt-2 animate-fade-in-up">
                <KPIRow isLoading={isLoading} titulo="Professores" cor={COLORS.educacao}
                  valor={compactoBr(renderEduMetrics.prof, 0)}
                  sub={isCenarioAtivo ? "Atingidos" : "Total"}
                  delta={isCenarioAtivo ? `de ${compactoBr(baseEduFiltMetrics.prof, 0)} (${calcPct(renderEduMetrics.prof, baseEduFiltMetrics.prof)})` : undefined} />
              </div>
              {(() => {
                const deps = Object.keys(profPorDep.base).sort((a, b) => (profPorDep.base[b] || 0) - (profPorDep.base[a] || 0));
                if (deps.length === 0) return null;
                const maxBase = profPorDep.base[deps[0]] || 1;
                return (
                  <>
                    <h3 className="text-[11px] font-black uppercase tracking-wider mt-4 mb-2 border-b border-slate-200/60 pb-1" style={{ color: C.primary }}>Professores por Dependência</h3>
                    <div className="flex flex-col gap-1.5 pb-2">
                      {deps.map((dep, i) => {
                        const baseVal = profPorDep.base[dep] || 0;
                        const atgVal  = profPorDep.impacto[dep] || 0;
                        const val = isCenarioAtivo ? atgVal : baseVal;
                        const pct = baseVal > 0 ? Math.round((atgVal / baseVal) * 100) : 0;
                        const isSelected = filtroDep === dep;
                        return (
                          <div key={dep}
                            className="flex items-center gap-2 rounded-lg px-1 py-0.5 cursor-pointer transition-colors"
                            style={{ backgroundColor: isSelected ? `${DONUT_COLORS[i % DONUT_COLORS.length]}18` : "transparent", outline: isSelected ? `1px solid ${DONUT_COLORS[i % DONUT_COLORS.length]}44` : "none" }}
                            onClick={() => setFiltroDep(isSelected ? "(todas)" : dep)}
                            title={isSelected ? "Clique para remover filtro" : `Filtrar por ${dep}`}
                          >
                            <span className="text-[9px] w-20 shrink-0 truncate" style={{ color: isSelected ? C.primary : C.muted }} title={dep}>{dep}</span>
                            <div className="flex-1 rounded-full h-2.5 overflow-hidden" style={{ backgroundColor: C.cardBg }}>
                              <div className="h-full rounded-full" style={{ width: `${isCenarioAtivo ? pct : Math.round((val/maxBase)*100)}%`, backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                            </div>
                            <span className="text-[9px] font-bold tabular-nums w-16 text-right shrink-0" style={{ color: C.primary }}>
                              {compactoBr(val, 0)}{isCenarioAtivo ? ` (${pct}%)` : ""}
                            </span>
                          </div>
                        );
                      })}
                      {filtroDep !== "(todas)" && <button className="text-[9px] font-bold mt-1.5 px-2.5 py-1 rounded-md self-start" style={{ backgroundColor: `${C.primary}15`, color: C.primary, border: `1px solid ${C.primary}35` }} onClick={() => setFiltroDep("(todas)")}>✕ Limpar filtro</button>}
                    </div>
                  </>
                );
              })()}
              {(() => {
                const NIVEIS = [
                  ["Infantil","inf"],["Fundamental","fund"],["Médio","med"],
                  ["Profissional","profis"],["EJA","eja"],["Especial","esp"],
                ] as [string,string][];
                const src = isCenarioAtivo ? metricasEdu.impacto : metricasEdu.base;
                const pieData = NIVEIS.map(([name, key]) => ({ name, value: (src as any)[key] as number })).filter(d => d.value > 0);
                const totalAlunos = pieData.reduce((s, d) => s + d.value, 0);
                const baseAlunos = NIVEIS.reduce((s, [, key]) => s + (((metricasEdu.base as any)[key] as number) || 0), 0);
                if (pieData.length === 0) return null;
                return (
                  <>
                    <h3 className="text-[11px] font-black uppercase tracking-wider mt-4 mb-1 border-b border-slate-200/60 pb-1" style={{ color: C.primary }}>Educação</h3>
                    <div className="relative flex items-center justify-center">
                      <ResponsiveContainer width="100%" height={170}>
                        <PieChart>
                          <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={76} paddingAngle={2} dataKey="value" stroke="none">
                            {pieData.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
                          </Pie>
                          <Tooltip formatter={(v: any) => [`${compactoBr(v, 0)} alunos`, ""]} contentStyle={{ fontSize: 11, borderRadius: 8, border: `1px solid ${C.border}`, padding: "4px 10px" }} itemStyle={{ color: C.primary }} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute flex flex-col items-center pointer-events-none">
                        <span className="text-2xl font-black leading-none" style={{ color: C.primary }}>{compactoBr(totalAlunos, 0)}</span>
                        {isCenarioAtivo
                          ? <><span className="text-[9px] font-medium" style={{ color: C.muted }}>{baseAlunos > 0 ? Math.round(totalAlunos / baseAlunos * 100) : 0}% alunos</span><span className="text-[9px]" style={{ color: C.muted }}>de {compactoBr(baseAlunos, 0)}</span></>
                          : <span className="text-[10px] font-medium" style={{ color: C.muted }}>alunos</span>}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 pb-2">
                      {pieData.map((d, i) => (
                        <div key={d.name} className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                          <span className="text-[11px] flex-1" style={{ color: C.muted }}>{d.name}</span>
                          <span className="text-[11px] font-bold tabular-nums" style={{ color: C.primary }}>{compactoBr(d.value, 0)}</span>
                          <span className="text-[11px] w-9 text-right tabular-nums" style={{ color: C.muted }}>{Math.round(d.value / totalAlunos * 100)}%</span>
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}
              <p className="text-[9px] italic mt-3 pt-2 border-t" style={{ color: C.muted, borderColor: C.border }}>Fonte: IBGE — Censo Escolar</p>
            </TabsContent>

            {/* Saúde */}
            <TabsContent value="saude" className="flex-1 overflow-y-auto mt-4 pr-2 pb-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb]:rounded-full">
              {(() => {
                const LISTAS: Record<string, { label: string; state: boolean; setState: (v: (p: boolean) => boolean) => void }> = {
                  "Hospital":                { label: "Hospitais",                state: showListaHospitais, setState: setShowListaHospitais },
                  "Unidade Básica de Saúde": { label: "Unidades Básicas de Saúde", state: showListaUBS,      setState: setShowListaUBS },
                  "Ambulatório":             { label: "Ambulatórios",              state: showListaAmbulat,  setState: setShowListaAmbulat },
                };
                const srcFeats = (isCenarioAtivo ? renderSau?.features : null) ?? [];
                const tipos = isCenarioAtivo ? metricasSau.impacto.tipos : metricasSau.base.tipos;
                const pieData = Object.entries(tipos).filter(([, v]) => (v as number) > 0).sort((a, b) => (b[1] as number) - (a[1] as number)).map(([name, value]) => ({ name, value: value as number }));
                const totalU = pieData.reduce((s, d) => s + d.value, 0);
                if (pieData.length === 0) return null;
                return (
                  <>
                    <h3 className="text-[11px] font-black uppercase tracking-wider mt-2 mb-1 border-b border-slate-200/60 pb-1" style={{ color: C.primary }}>Unidades por Tipo</h3>
                    <div className="relative flex items-center justify-center">
                      <ResponsiveContainer width="100%" height={170}>
                        <PieChart>
                          <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={76} paddingAngle={2} dataKey="value" stroke="none" cursor="pointer"
                            onClick={(d: any) => setFiltroTipo(filtroTipo === d.name ? "(todas)" : d.name)}>
                            {pieData.map((d, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} opacity={filtroTipo !== "(todas)" && filtroTipo !== d.name ? 0.35 : 1} />)}
                          </Pie>
                          <Tooltip formatter={(v: any) => [`${v} unidade${v !== 1 ? "s" : ""}`, ""]} contentStyle={{ fontSize: 11, borderRadius: 8, border: `1px solid ${C.border}`, padding: "4px 10px" }} itemStyle={{ color: C.primary }} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute flex flex-col items-center pointer-events-none">
                        <span className="text-2xl font-black leading-none" style={{ color: C.primary }}>{totalU}</span>
                        {isCenarioAtivo
                          ? <><span className="text-[9px] font-medium" style={{ color: C.muted }}>{Math.round(totalU / metricasSau.base.unidades * 100)}% unidades</span><span className="text-[9px]" style={{ color: C.muted }}>de {metricasSau.base.unidades}</span></>
                          : <span className="text-[10px] font-medium" style={{ color: C.muted }}>unidades</span>}
                      </div>
                    </div>
                    <div className="flex flex-col gap-0.5 mb-3">
                      {pieData.map((d, i) => (
                        <div key={d.name}
                          className="flex items-center gap-2 rounded-md px-1 py-0.5 cursor-pointer transition-colors"
                          style={{ backgroundColor: filtroTipo === d.name ? `${DONUT_COLORS[i % DONUT_COLORS.length]}22` : "transparent", outline: filtroTipo === d.name ? `1px solid ${DONUT_COLORS[i % DONUT_COLORS.length]}55` : "none" }}
                          onClick={() => setFiltroTipo(filtroTipo === d.name ? "(todas)" : d.name)}
                          title={filtroTipo === d.name ? "Clique para remover filtro" : `Filtrar por ${d.name}`}
                        >
                          <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                          <span className="text-[11px] flex-1 truncate" style={{ color: filtroTipo === d.name ? C.primary : C.muted }} title={d.name}>{d.name}</span>
                          <span className="text-[11px] font-bold tabular-nums" style={{ color: C.primary }}>{d.value}</span>
                          <span className="text-[11px] w-9 text-right tabular-nums" style={{ color: C.muted }}>{Math.round(d.value / totalU * 100)}%</span>
                        </div>
                      ))}
                      {filtroTipo !== "(todas)" && <button className="text-[9px] font-bold mt-1.5 px-2.5 py-1 rounded-md self-start" style={{ backgroundColor: `${C.primary}15`, color: C.primary, border: `1px solid ${C.primary}35` }} onClick={() => setFiltroTipo("(todas)")}>✕ Limpar filtro</button>}
                    </div>
                    {isCenarioAtivo && (
                      <div className="flex flex-col gap-2">
                        {Object.entries(LISTAS).map(([tipoKey, cfg]) => {
                          const feats = srcFeats.filter((f: any) => f.properties?.co_tipo_estabelecimento === tipoKey);
                          const lista = feats.map((f: any) => String(f.properties?.no_fantasia || f.properties?.no_razao_social || "").trim()).filter(Boolean).sort((a: string, b: string) => a.localeCompare(b, "pt-BR"));
                          if (lista.length === 0) return null;
                          return (
                            <div key={tipoKey}>
                              <button onClick={() => cfg.setState(p => !p)}
                                className="w-full flex items-center justify-between text-[10px] font-bold px-2.5 py-1.5 rounded-lg"
                                style={{ backgroundColor: C.cardBg, color: C.primary, border: `1px solid ${C.border}` }}>
                                <span>{cfg.label} ({lista.length})</span>
                                <span style={{ fontSize: 9 }}>{cfg.state ? "▲" : "▼"}</span>
                              </button>
                              {cfg.state && (
                                <div className="flex flex-col gap-0.5 mt-1 max-h-44 overflow-y-auto rounded-lg p-1.5" style={{ backgroundColor: C.cardBg, border: `1px solid ${C.border}` }}>
                                  {lista.map((nome: string, i: number) => (
                                    <span key={i} className="text-[10px] px-1.5 py-0.5 rounded" style={{ color: C.muted }} title={nome}>{nome}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                );
              })()}
              {(() => {
                const totalBase    = STAFF_COLS.reduce((a, c) => a + (baseSauFiltMetrics.staff[c]   || 0), 0);
                const totalImpacto = STAFF_COLS.reduce((a, c) => a + (renderSauMetrics.staff[c]     || 0), 0);
                return (
                  <div className="mt-4 mb-2">
                    <KPIRow isLoading={isLoading} titulo="Profissionais" cor={COLORS.saude}
                      valor={compactoBr(isCenarioAtivo ? totalImpacto : totalBase, 0)}
                      sub={isCenarioAtivo ? "Atingidos" : "Total"}
                      delta={isCenarioAtivo ? `de ${compactoBr(totalBase, 0)} (${calcPct(totalImpacto, totalBase)})` : undefined} />
                  </div>
                );
              })()}
              {(() => {
                const baseStaff    = baseSauFiltMetrics.staff;
                const impactoStaff = renderSauMetrics.staff;
                const staffData = STAFF_COLS
                  .map(c => ({ name: STAFF_LABELS[c], val: isCenarioAtivo ? (impactoStaff[c] || 0) : (baseStaff[c] || 0), tot: baseStaff[c] || 0 }))
                  .filter(d => d.tot > 0)
                  .sort((a, b) => b.tot - a.tot);
                const maxTot = staffData[0]?.tot || 1;
                return (
                  <>
                  <h3 className="text-[11px] font-black uppercase tracking-wider mb-2 border-b border-slate-200/60 pb-1" style={{ color: C.primary }}>Profissionais por Categoria</h3>
                  <div className="flex flex-col gap-1.5 pb-2">
                    {staffData.map((d, i) => {
                      const pct = isCenarioAtivo ? Math.round((d.val / d.tot) * 100) : Math.round((d.val / maxTot) * 100);
                      const barW = isCenarioAtivo ? pct : Math.round((d.val / maxTot) * 100);
                      return (
                        <div key={d.name} className="flex items-center gap-2">
                          <span className="text-[9px] w-20 shrink-0 truncate" style={{ color: C.muted }} title={d.name}>{d.name}</span>
                          <div className="flex-1 rounded-full h-2.5 overflow-hidden" style={{ backgroundColor: C.cardBg }}>
                            <div className="h-full rounded-full" style={{ width: `${barW}%`, backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                          </div>
                          <span className="text-[9px] font-bold tabular-nums w-14 text-right shrink-0" style={{ color: C.primary }}>
                            {compactoBr(d.val, 0)}{isCenarioAtivo ? ` (${pct}%)` : ""}
                          </span>
                        </div>
                      );
                    })}
                    {isCenarioAtivo && <p className="text-[8px] mt-1" style={{ color: C.muted }}>% = atingidos / total município por categoria</p>}
                  </div>
                  </>
                );
              })()}
              <p className="text-[9px] italic mt-3 pt-2 border-t" style={{ color: C.muted, borderColor: C.border }}>Fonte: CNES — Cadastro Nacional de Estabelecimentos de Saúde</p>
            </TabsContent>

            {/* Agricultura */}
            {camadas.includes("Agricultura") && (
              <TabsContent value="agricultura" className="flex-1 overflow-y-auto mt-4 pr-2 pb-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb]:rounded-full">
                {!baseAgricultura ? (
                  <div className="flex flex-col gap-3 p-2">
                    <div className="flex items-center justify-center py-4"><Skeleton className="h-[170px] w-[170px] rounded-full" /></div>
                    <Skeleton className="h-6 w-1/2 mx-auto mt-2" />
                    <div className="flex flex-col gap-2 mt-4">
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-16 w-full" />
                    </div>
                  </div>
                ) : (() => {
                  const feats    = isCenarioAtivo ? metricasAgri.impacto : metricasAgri.base;
                  const base     = metricasAgri.base;
                  const haTotal  = feats.reduce((acc, { ha }) => acc + ha, 0);
                  const haBase   = base.reduce((acc, { ha }) => acc + ha, 0);
                  return (
                    <>
                      {feats.length > 0 && (() => {
                        const pieData = feats.map(({ f, ha }, i) => ({ name: f.properties?.tipo_cultura ?? `cultura-${i}`, value: ha, cor: AGRI_COLORS[f.properties?.tipo_cultura] ?? COLORS.agricultura }));
                        return (
                          <>
                            <h3 className="text-[11px] font-black uppercase tracking-wider mb-1 border-b border-slate-200/60 pb-1" style={{ color: C.primary }}>Área por Cultura</h3>
                            <div className="relative flex items-center justify-center">
                              <ResponsiveContainer width="100%" height={170}>
                                <PieChart>
                                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={76} paddingAngle={2} dataKey="value" stroke="none">
                                    {pieData.map((d, i) => <Cell key={i} fill={d.cor} />)}
                                  </Pie>
                                  <Tooltip formatter={(v: any) => [`${formatoBr(v, 0)} ha`, ""]} contentStyle={{ fontSize: 11, borderRadius: 8, border: `1px solid ${C.border}`, padding: "4px 10px" }} itemStyle={{ color: C.primary }} />
                                </PieChart>
                              </ResponsiveContainer>
                              <div className="absolute flex flex-col items-center pointer-events-none">
                                <span className="text-xl font-black leading-none" style={{ color: C.primary }}>{compactoBr(haTotal, 1)}</span>
                                {isCenarioAtivo
                                  ? <><span className="text-[9px] font-medium" style={{ color: C.muted }}>{haBase > 0 ? (haTotal / haBase * 100).toFixed(2) : "0,00"}% da área</span><span className="text-[9px]" style={{ color: C.muted }}>de {compactoBr(haBase, 1)} ha</span></>
                                  : <span className="text-[9px] font-medium" style={{ color: C.muted }}>ha</span>}
                              </div>
                            </div>
                          </>
                        );
                      })()}
                      <h3 className="text-[11px] font-black uppercase tracking-wider mb-2 border-b border-slate-200/60 pb-1" style={{ color: C.primary }}>Culturas {isCenarioAtivo ? "Atingidas" : "no Município"}</h3>
                      <div className="flex flex-col gap-2 pb-2 animate-fade-in-up">
                        {feats.map(({ f, ha }, i) => {
                          const tipo    = f.properties?.tipo_cultura ?? `cultura-${i}`;
                          const cor     = AGRI_COLORS[tipo] ?? COLORS.agricultura;
                          const haBaseTipo = base.find(({ f: bf }) => bf.properties?.tipo_cultura === tipo)?.ha ?? 0;
                          return (
                            <KPIRow isLoading={isLoading} key={`agr-${tipo}-${i}`} titulo={tipo} cor={cor}
                              valor={`${formatoBr(ha, 0)} ha`} sub="Área"
                              delta={isCenarioAtivo && haBaseTipo > 0 ? `de ${formatoBr(haBaseTipo, 0)} ha (${formatoBr(ha / haBaseTipo * 100, 2)}%)` : undefined} />
                          );
                        })}
                        {feats.length === 0 && isCenarioAtivo && (
                          <p className="text-xs text-center py-2" style={{ color: C.muted }}>Nenhuma cultura atingida neste cenário.</p>
                        )}
                      </div>
                      <p className="text-[9px] italic mt-3 pt-2 border-t" style={{ color: C.muted, borderColor: C.border }}>Fonte: MapaBiomas — Coleção 10</p>
                    </>
                  );
                })()}
              </TabsContent>
            )}

            {/* Uso e Cobertura da Terra */}
            {camadas.includes("Uso e Cobertura da Terra") && (
              <TabsContent value="cobertura" className="flex-1 overflow-y-auto mt-4 pr-2 pb-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb]:rounded-full">
                {!baseCobertura ? (
                  <div className="flex flex-col gap-3 p-2">
                    <div className="flex items-center justify-center py-4"><Skeleton className="h-[170px] w-[170px] rounded-full" /></div>
                    <Skeleton className="h-6 w-1/2 mx-auto mt-2" />
                    <div className="flex flex-col gap-2 mt-4">
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-16 w-full" />
                    </div>
                  </div>
                ) : (() => {
                  const feats   = isCenarioAtivo ? metricasCob.impacto : metricasCob.base;
                  const base    = metricasCob.base;
                  const haTotal = feats.reduce((acc, { ha }) => acc + ha, 0);
                  const haBase  = base.reduce((acc, { ha }) => acc + ha, 0);
                  return (
                    <>
                      {feats.length > 0 && (() => {
                        const pieData = feats.map(({ f, ha }, i) => ({ name: f.properties?.tipo_classe ?? `classe-${i}`, value: ha, cor: COBERTURA_COLORS[f.properties?.tipo_classe] ?? COLORS.agricultura }));
                        return (
                          <>
                            <h3 className="text-[11px] font-black uppercase tracking-wider mb-1 border-b border-slate-200/60 pb-1" style={{ color: C.primary }}>Área por Classe</h3>
                            <div className="relative flex items-center justify-center">
                              <ResponsiveContainer width="100%" height={170}>
                                <PieChart>
                                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={76} paddingAngle={2} dataKey="value" stroke="none">
                                    {pieData.map((d, i) => <Cell key={i} fill={d.cor} />)}
                                  </Pie>
                                  <Tooltip formatter={(v: any) => [`${formatoBr(v, 0)} ha`, ""]} contentStyle={{ fontSize: 11, borderRadius: 8, border: `1px solid ${C.border}`, padding: "4px 10px" }} itemStyle={{ color: C.primary }} />
                                </PieChart>
                              </ResponsiveContainer>
                              <div className="absolute flex flex-col items-center pointer-events-none">
                                <span className="text-xl font-black leading-none" style={{ color: C.primary }}>{compactoBr(haTotal, 1)}</span>
                                {isCenarioAtivo
                                  ? <><span className="text-[9px] font-medium" style={{ color: C.muted }}>{haBase > 0 ? (haTotal / haBase * 100).toFixed(2) : "0,00"}% da área</span><span className="text-[9px]" style={{ color: C.muted }}>de {compactoBr(haBase, 1)} ha</span></>
                                  : <span className="text-[9px] font-medium" style={{ color: C.muted }}>ha</span>}
                              </div>
                            </div>
                            <div className="flex flex-col gap-2 mt-2 mb-1">
                              {pieData.map((d) => {
                                const haBaseClasse = base.find(({ f: bf }) => bf.properties?.tipo_classe === d.name)?.ha ?? 0;
                                return (
                                  <KPIRow key={d.name} isLoading={isLoading} titulo={d.name} cor={d.cor}
                                    valor={`${formatoBr(d.value, 0)} ha`} sub="Área"
                                    delta={isCenarioAtivo && haBaseClasse > 0 ? `de ${formatoBr(haBaseClasse, 0)} ha (${formatoBr(d.value / haBaseClasse * 100, 2)}%)` : undefined} />
                                );
                              })}
                            </div>
                          </>
                        );
                      })()}
                      {feats.length === 0 && isCenarioAtivo && (
                        <p className="text-xs text-center py-2" style={{ color: C.muted }}>Nenhuma classe atingida neste cenário.</p>
                      )}
                      <p className="text-[9px] italic mt-3 pt-2 border-t" style={{ color: C.muted, borderColor: C.border }}>Fonte: MapaBiomas — Coleção 10</p>
                    </>
                  );
                })()}
              </TabsContent>
            )}

            {/* Infraestrutura */}
            {camadas.includes("Infraestrutura") && infraAtivas.length > 0 && (
              <TabsContent value="infra" className="flex-1 overflow-y-auto mt-4 pr-2 pb-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb]:rounded-full">
                <div className="flex flex-col gap-5 pb-2 animate-fade-in-up">

                  {/* ── Logradouros ── */}
                  {infraAtivas.includes("Logradouros") && (() => {
                    const base    = baseInfra["Logradouros"];
                    const atg     = atingidosInfra["Logradouros"];
                    const baseF   = base?.features   ?? [];
                    const atgF    = atg?.features    ?? [];
                    const src     = isCenarioAtivo ? atgF : baseF;
                    const segBase = baseF.length;
                    const segAtg  = atgF.length;
                    const ruasBase = countRuasUnicas(baseF);
                    const ruasAtg  = countRuasUnicas(atgF);
                    const drenBase = countFlag(baseF, "drenagem");
                    const drenAtg  = countFlag(atgF,  "drenagem");
                    const ilumBase = countFlag(baseF, "iluminacao");
                    const ilumAtg  = countFlag(atgF,  "iluminacao");
                    return (
                      <div>
                        <h3 className="text-[11px] font-black uppercase tracking-wider pb-1 mb-2 flex items-center gap-1.5" style={{ color: INFRA_COLORS["Logradouros"], borderBottom: `1px solid ${C.border}` }}>
                          <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ backgroundColor: INFRA_COLORS["Logradouros"] }} />
                          Logradouros
                        </h3>
                        {!base ? <div className="flex flex-col gap-2"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div> : (
                          <>
                            <div className="flex flex-col gap-2 mb-2">
                              <KPIRow isLoading={isLoading} titulo="Segmentos" cor={INFRA_COLORS["Logradouros"]} valor={compactoBr(isCenarioAtivo ? segAtg  : segBase,  0)} sub={isCenarioAtivo ? "Atingidos" : "Total"} delta={isCenarioAtivo ? `de ${compactoBr(segBase,  0)} (${calcPct(segAtg,  segBase)})` : undefined} />
                              <div className="flex flex-col gap-1.5">
                                <KPIRow isLoading={isLoading} titulo="Ruas Únicas" cor={INFRA_COLORS["Logradouros"]} valor={compactoBr(isCenarioAtivo ? ruasAtg : ruasBase, 0)} sub={isCenarioAtivo ? "Atingidas" : "Total"} delta={isCenarioAtivo ? `de ${compactoBr(ruasBase, 0)} (${calcPct(ruasAtg, ruasBase)})` : undefined} />
                                {isCenarioAtivo && (() => {
                                  const seen = new Set<string>();
                                  const ruasLista: string[] = [];
                                  atgF.forEach((f: any) => {
                                    const tipo = String(f.properties?.tipo ?? "").trim().toUpperCase();
                                    const nome = String(f.properties?.nome ?? "").trim().toUpperCase();
                                    const label = [tipo, nome].filter(Boolean).join(" ");
                                    if (label && !seen.has(label)) { seen.add(label); ruasLista.push(label); }
                                  });
                                  ruasLista.sort((a, b) => a.localeCompare(b, "pt-BR"));
                                  return (
                                    <>
                                      <button onClick={() => setShowListaLogradouros(p => !p)}
                                        className="w-full flex items-center justify-between text-[10px] font-bold px-2.5 py-1.5 rounded-lg"
                                        style={{ backgroundColor: C.cardBg, color: C.primary, border: `1px solid ${C.border}` }}>
                                        <span>Ruas Atingidas ({ruasLista.length})</span>
                                        <span style={{ fontSize: 9 }}>{showListaLogradouros ? "▲" : "▼"}</span>
                                      </button>
                                      {showListaLogradouros && (
                                        <div className="flex flex-col gap-0.5 max-h-52 overflow-y-auto rounded-lg p-1.5" style={{ backgroundColor: C.cardBg, border: `1px solid ${C.border}` }}>
                                          {ruasLista.map((label, i) => (
                                            <span key={i} className="text-[10px] px-1.5 py-0.5 rounded" style={{ color: C.muted }} title={label}>{label}</span>
                                          ))}
                                        </div>
                                      )}
                                    </>
                                  );
                                })()}
                              </div>
                              {(isCenarioAtivo ? atgF.length : baseF.length) > 0 && (() => {
                                const cor   = INFRA_COLORS["Logradouros"];
                                return (
                                  <>
                                    <h3 className="text-[10px] font-bold uppercase tracking-wider pt-2 pb-1 border-t" style={{ color: INFRA_COLORS["Logradouros"], borderColor: C.border }}>
                                      Cobertura de Serviços <span className="normal-case font-normal text-[9px]" style={{ color: C.muted }}>— de {compactoBr(baseF.length,0)} segmentos</span>
                                    </h3>
                                    <div className="flex flex-col gap-2">
                                      <BarServico label="Drenagem"   value={isCenarioAtivo ? drenAtg : drenBase} total={isCenarioAtivo ? drenBase : baseF.length} cor={cor} />
                                      <BarServico label="Iluminação" value={isCenarioAtivo ? ilumAtg : ilumBase} total={isCenarioAtivo ? ilumBase : baseF.length} cor={cor} />
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })()}

                  {/* ── Quadras ── */}
                  {infraAtivas.includes("Quadras") && (() => {
                    const base  = baseInfra["Quadras"];
                    const atg   = atingidosInfra["Quadras"];
                    const total = base?.features?.length   ?? 0;
                    const totalAtg = atg?.features?.length ?? 0;
                    return (
                      <div>
                        <h3 className="text-[11px] font-black uppercase tracking-wider pb-1 mb-2 flex items-center gap-1.5" style={{ color: INFRA_COLORS["Quadras"], borderBottom: `1px solid ${C.border}` }}>
                          <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ backgroundColor: INFRA_COLORS["Quadras"] }} />
                          Quadras
                        </h3>
                        {!base ? <div className="flex flex-col gap-2"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div> : (
                          <div className="flex flex-col gap-2">
                            <KPIRow isLoading={isLoading} titulo="Quadras" cor={INFRA_COLORS["Quadras"]} valor={compactoBr(isCenarioAtivo ? totalAtg : total, 0)} sub={isCenarioAtivo ? "Atingidas" : "Total"} delta={isCenarioAtivo ? `de ${compactoBr(total, 0)} (${calcPct(totalAtg, total)})` : undefined} />
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* ── Terrenos ── */}
                  {infraAtivas.includes("Terrenos") && (() => {
                    const base  = baseInfra["Terrenos"];
                    const atg   = atingidosInfra["Terrenos"];
                    const baseF = base?.features   ?? [];
                    const atgF  = atg?.features    ?? [];
                    const total    = baseF.length;
                    const totalAtg = atgF.length;
                    const agua    = { b: countFlag(baseF,"agua"),       a: countFlag(atgF,"agua") };
                    const lixo    = { b: countFlag(baseF,"coleta_lix"), a: countFlag(atgF,"coleta_lix") };
                    const pluvial = { b: countFlag(baseF,"esgoto_plu"), a: countFlag(atgF,"esgoto_plu") };
                    const cloacal = { b: countEquals(baseF,"esgoto_clo",["esgoto_cloacal","cloacal","1"]), a: countEquals(atgF,"esgoto_clo",["esgoto_cloacal","cloacal","1"]) };
                    const fossa   = { b: countEquals(baseF,"esgoto_clo",["fossa_septica","fossa"]),        a: countEquals(atgF,"esgoto_clo",["fossa_septica","fossa"]) };
                    const condo   = { b: countFlag(baseF,"condominio"), a: countFlag(atgF,"condominio") };
                    return (
                      <div>
                        <h3 className="text-[11px] font-black uppercase tracking-wider pb-1 mb-2 flex items-center gap-1.5" style={{ color: INFRA_COLORS["Terrenos"], borderBottom: `1px solid ${C.border}` }}>
                          <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ backgroundColor: INFRA_COLORS["Terrenos"] }} />
                          Terrenos
                        </h3>
                        {!base ? <div className="flex flex-col gap-2"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div> : (
                          <div className="flex flex-col gap-2">
                            {isCenarioAtivo && total > 0 && (() => {
                              const cor = INFRA_COLORS["Terrenos"];
                              const pct = Math.round((totalAtg / total) * 100);
                              const pieData = [{ name: "Atingidos", value: totalAtg }, { name: "Não Atingidos", value: Math.max(0, total - totalAtg) }];
                              return (
                                <div className="relative flex items-center justify-center">
                                  <ResponsiveContainer width="100%" height={130}>
                                    <PieChart>
                                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={38} outerRadius={58} paddingAngle={2} dataKey="value" stroke="none">
                                        <Cell fill={cor} /><Cell fill={`${cor}25`} />
                                      </Pie>
                                      <Tooltip formatter={(v: any) => [compactoBr(v, 0), ""]} contentStyle={{ fontSize: 11, borderRadius: 8, border: `1px solid ${C.border}`, padding: "4px 10px" }} itemStyle={{ color: C.primary }} />
                                    </PieChart>
                                  </ResponsiveContainer>
                                  <div className="absolute flex flex-col items-center pointer-events-none">
                                    <span className="text-lg font-black leading-none" style={{ color: cor }}>{compactoBr(totalAtg, 0)}</span>
                                    <span className="text-[9px] font-medium" style={{ color: C.muted }}>{pct}% atingidos</span>
                                    <span className="text-[9px]" style={{ color: C.muted }}>de {compactoBr(total, 0)}</span>
                                  </div>
                                </div>
                              );
                            })()}
                            <h3 className="text-[10px] font-bold uppercase tracking-wider pt-2 pb-1 border-t" style={{ color: INFRA_COLORS["Terrenos"], borderColor: C.border }}>
                              Cobertura de Serviços <span className="normal-case font-normal text-[9px]" style={{ color: C.muted }}>— de {compactoBr(total,0)} terrenos</span>
                            </h3>
                            {(() => {
                              const cor = INFRA_COLORS["Terrenos"];
                              const items = [
                                { label: "Água",           val: isCenarioAtivo ? agua.a    : agua.b,    tot: isCenarioAtivo ? agua.b    : total },
                                { label: "Coleta de Lixo", val: isCenarioAtivo ? lixo.a    : lixo.b,    tot: isCenarioAtivo ? lixo.b    : total },
                                { label: "Esgoto Pluvial", val: isCenarioAtivo ? pluvial.a : pluvial.b, tot: isCenarioAtivo ? pluvial.b : total },
                                { label: "Esgoto Cloacal", val: isCenarioAtivo ? cloacal.a : cloacal.b, tot: isCenarioAtivo ? cloacal.b : total },
                                { label: "Fossa Séptica",  val: isCenarioAtivo ? fossa.a   : fossa.b,   tot: isCenarioAtivo ? fossa.b   : total },
                                { label: "Condomínios",    val: isCenarioAtivo ? condo.a   : condo.b,   tot: isCenarioAtivo ? condo.b   : total },
                              ];
                              return (
                                <div className="flex flex-col gap-2">
                                  {items.map(({ label, val, tot }) => <BarServico key={label} label={label} value={val} total={tot} cor={cor} />)}
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* ── Outras camadas (Prédios Públicos, Segurança) ── */}
                  {infraAtivas.filter(n => !["Logradouros","Quadras","Terrenos"].includes(n)).map(infraNome => {
                    const base     = baseInfra[infraNome];
                    const atg      = atingidosInfra[infraNome];
                    const totalBase = base?.features?.length ?? 0;
                    const totalAtg  = atg?.features?.length  ?? 0;
                    const titulo = infraNome === "Prédios Públicos" ? "Prédios Públicos" : "Equip. Segurança";
                    const cor = INFRA_COLORS[infraNome] ?? COLORS.infra;
                    return (
                      <div key={infraNome}>
                        <h3 className="text-[11px] font-black uppercase tracking-wider pb-1 mb-2 flex items-center gap-1.5" style={{ color: cor, borderBottom: `1px solid ${C.border}` }}>
                          <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ backgroundColor: cor }} />
                          {infraNome}
                        </h3>
                        {!base ? <div className="flex flex-col gap-2"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div> : (
                          <div className="flex flex-col gap-2">
                            <KPIRow isLoading={isLoading} titulo={titulo} cor={cor} valor={compactoBr(isCenarioAtivo ? totalAtg : totalBase, 0)} sub={isCenarioAtivo ? "Atingidos" : "Total"} delta={isCenarioAtivo ? `de ${compactoBr(totalBase, 0)} (${calcPct(totalAtg, totalBase)})` : undefined} />
                            {isCenarioAtivo && totalBase > 0 && (() => {
                              const pct = Math.round((totalAtg / totalBase) * 100);
                              const pieData = [{ name: "Atingidos", value: totalAtg }, { name: "Não Atingidos", value: Math.max(0, totalBase - totalAtg) }];
                              return (
                                <div className="relative flex items-center justify-center">
                                  <ResponsiveContainer width="100%" height={130}>
                                    <PieChart>
                                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={38} outerRadius={58} paddingAngle={2} dataKey="value" stroke="none">
                                        <Cell fill={cor} /><Cell fill={`${cor}25`} />
                                      </Pie>
                                      <Tooltip formatter={(v: any) => [compactoBr(v, 0), ""]} contentStyle={{ fontSize: 11, borderRadius: 8, border: `1px solid ${C.border}`, padding: "4px 10px" }} itemStyle={{ color: C.primary }} />
                                    </PieChart>
                                  </ResponsiveContainer>
                                  <div className="absolute flex flex-col items-center pointer-events-none">
                                    <span className="text-lg font-black leading-none" style={{ color: cor }}>{compactoBr(totalAtg, 0)}</span>
                                    <span className="text-[9px] font-medium" style={{ color: C.muted }}>{pct}% atingidos</span>
                                    <span className="text-[9px]" style={{ color: C.muted }}>de {compactoBr(totalBase, 0)}</span>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    );
                  })}

                </div>
                <p className="text-[9px] italic mt-3 pt-2 border-t" style={{ color: C.muted, borderColor: C.border }}>Fonte: Prefeitura Municipal de Rio Grande</p>
              </TabsContent>
            )}
          </Tabs>
        </div>
      )}

      {/* ── Botão abrir painel ────────────────────────────────────────── */}
      {!showPainelAnalise && (
        <button onClick={() => setShowPainelAnalise(true)}
          className="absolute top-[90px] left-4 text-xs font-black shadow-2xl px-4 py-2 rounded-xl z-20 active-press hover-lift bg-white flex items-center gap-1.5 focus-visible:outline-none print:hidden"
          style={{ backgroundColor: "#fff", border: `1px solid ${C.border}`, color: C.primary }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = C.cardBg)}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = "#fff")}>
          <PanelLeft size={12} strokeWidth={2.5} />Abrir Painel
        </button>
      )}
    </div>
  );
}

// ─── Componentes auxiliares ───────────────────────────────────────────────────

function KPIRow({ titulo, valor, sub, delta, cor, isLoading }: { titulo: string; valor: string | number; sub: string; delta?: string; cor?: string; isLoading?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg"
      style={{ backgroundColor: C.cardBg, border: `1px solid ${C.border}`, borderLeft: `3px solid ${cor ?? C.primary}` }}>
      <div className="flex flex-col min-w-0">
        <span className="text-[11px] font-bold uppercase tracking-wider leading-tight" style={{ color: C.muted }}>{titulo}</span>
        <span className="text-[10px] leading-none mt-0.5" style={{ color: C.muted }}>{sub}</span>
        {delta && (
          isLoading ? (
            <Skeleton className="h-4 w-16 mt-1.5" />
          ) : (
            <span className="text-[9px] font-semibold mt-1.5 inline-block px-1.5 py-0.5 rounded w-fit"
              style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.primary }}>{delta}</span>
          )
        )}
      </div>
      {isLoading ? (
        <Skeleton className="h-6 w-20 shrink-0" />
      ) : (
        <span className="text-2xl font-black shrink-0 leading-none" style={{ color: C.primary }}>{valor}</span>
      )}
    </div>
  );
}

function BarServico({ label, value, total, cor }: { label: string; value: number; total: number; cor: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between gap-1">
        <span className="text-[10px]" style={{ color: C.muted }}>{label}</span>
        <span className="text-[10px] font-bold shrink-0" style={{ color: C.primary }}>
          {value.toLocaleString("pt-BR")} <span className="font-normal" style={{ color: C.muted }}>({pct}%)</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: `${cor}25` }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: cor }} />
      </div>
    </div>
  );
}

function LegendItem({ cor, label, area }: { cor: string; label: string; area?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      {area
        ? <div className="w-3 h-2.5 rounded-sm border shrink-0" style={{ borderColor: cor, backgroundColor: `${cor}30` }} />
        : <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cor }} />}
      <span className="text-[9px] text-slate-700 font-medium leading-none truncate max-w-[110px]">{label}</span>
    </div>
  );
}

function KPICard({ titulo, valor, sub, delta, isLoading }: { titulo: string; valor: string | number; sub: string; delta?: string; isLoading?: boolean }) {
  return (
    <Card className="hover-lift" style={{ backgroundColor: C.cardBg, border: `1px solid ${C.border}` }}>
      <CardHeader className="px-3 pt-2 pb-0">
        <CardTitle className="text-[10px] font-bold uppercase tracking-wider leading-tight" style={{ color: C.muted }}>{titulo}</CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-2 pt-1 flex flex-col">
        {isLoading ? (
          <Skeleton className="h-6 w-24 mb-1" />
        ) : (
          <div className="text-lg font-black leading-tight" style={{ color: C.primary }}>{valor}</div>
        )}
        <div className="text-[10px] font-medium leading-none mb-1" style={{ color: C.muted }}>{sub}</div>
        {delta && (
          isLoading ? (
            <Skeleton className="h-4 w-16" />
          ) : (
            <div className="text-[10px] font-semibold inline-block px-1.5 py-0.5 rounded w-fit" style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.primary }}>{delta}</div>
          )
        )}
      </CardContent>
    </Card>
  );
}
