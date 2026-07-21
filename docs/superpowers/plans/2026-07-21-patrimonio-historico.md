# Camada Patrimônio Histórico Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "Patrimônio Histórico" as a first-class data layer in the CIEX Dashboard — header toggle, panel tab, filter, legend entry, map rendering, and the Python conversion pipeline that turns the source shapefile into the static GeoJSON files the app consumes.

**Architecture:** Follows the existing single-component architecture of `app/page.tsx` exactly, replicating the pattern already used for the "Saúde" sector (clustered point layer, own `useState` pair for base/atingidos, own metrics calculator, own filter, own panel tab). No new files are introduced in the app beyond the Python converter script, since the project's established convention is one monolithic `Dashboard` component.

**Tech Stack:** Next.js/TypeScript/React (existing), MapLibre GL via `react-map-gl` (existing), Python 3 + GeoPandas (existing `scripts/` convention). No test framework exists in this project — verification is via `npm run typecheck`, `npm run lint`, and manual check in a running dev server (per this project's own CLAUDE.md: "No test suite exists in this project").

## Global Constraints

- Source shapefile: `C:\Users\Alisson Fiorentin\Downloads\patrimHistRG_verificados.shp` (+ `.dbf/.shx/.prj/.cpg/.qmd`), 355 points, CRS EPSG:4326, columns `Label`, `ENDEREÇO`, `COMPLEMENT`, `Tipologia`, `Nome`.
- Python interpreter with GeoPandas available at `C:\Users\Alisson Fiorentin\miniconda3\python.exe` (verified: geopandas 1.1.0).
- Output file naming follows the **main-sector** convention (like Empresas/Saúde/Educação), not the infra convention: `patrimonio_BASE.geojson` and `cenarios/patrimonio_ATINGIDOS_<scenario_slug>.geojson`.
- `Tipologia` is normalized only in the client (`normalizeTipologia`), never mutated in the Python output — mirrors how `normalizeDep` handles Educação's `tp_dependencia`.
- Map color: `COLORS.patrimonio = "#a16207"`.
- Icon: `Landmark` from `lucide-react`.
- Layer is active by default (added to the initial `camadas` array).
- No test suite — every task's manual verification step is explicit; don't invent test files.

---

### Task 1: Python conversion script

**Files:**
- Create: `scripts/converter_patrimonio_rio_grande.py`
- Reads: `C:\Users\Alisson Fiorentin\Downloads\patrimHistRG_verificados.shp`
- Produces: `public/dados_convertidos/rio_grande/patrimonio_BASE.geojson`, `public/dados_convertidos/rio_grande/cenarios/patrimonio_ATINGIDOS_rio_grande___cenario_maio_2024.geojson`, `public/dados_convertidos/rio_grande/cenarios/patrimonio_ATINGIDOS_rio_grande___cenario_maio_2024_50.geojson`

**Interfaces:**
- Produces: three static GeoJSON files consumed by `app/page.tsx` fetches added in Task 3 (`/dados_convertidos/rio_grande/patrimonio_BASE.geojson` and `/dados_convertidos/rio_grande/cenarios/patrimonio_ATINGIDOS_${sSlug}.geojson`).

- [ ] **Step 1: Write the script**

```python
"""
Pipeline de conversão de Patrimônio Histórico — Rio Grande
BASE + ATINGIDOS por cenário, EPSG:4326, GeoJSON.
Fonte: patrimHistRG_verificados.shp (levantamento de patrimônio histórico).
"""

import os
import re
import unicodedata
import warnings

import geopandas as gpd

warnings.filterwarnings("ignore")

# ─── Paths ───────────────────────────────────────────────────────────────────

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHP_PATH = r"C:\Users\Alisson Fiorentin\Downloads\patrimHistRG_verificados.shp"
BASE_OUT = f"{ROOT}/public/dados_convertidos/rio_grande"
CENARIOS_DIR = f"{ROOT}/public/dados_convertidos/rio_grande/cenarios"

os.makedirs(BASE_OUT, exist_ok=True)
os.makedirs(CENARIOS_DIR, exist_ok=True)

# ─── Slugify (idêntico ao usado em converter_infra_rio_grande.py) ────────────

def slugify(s: str) -> str:
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = s.lower().strip()
    s = re.sub(r"[^a-z0-9]+", "_", s)
    return s.strip("_")

def scenario_slug(mun: str, cen: str) -> str:
    return f"{slugify(mun)}___{slugify(cen)}"

CENARIOS = {
    "Cenário Maio 2024":       scenario_slug("Rio Grande", "Cenário Maio 2024"),
    "Cenário Maio 2024 + 50%": scenario_slug("Rio Grande", "Cenário Maio 2024 + 50%"),
}

def carregar_mancha(slug: str) -> gpd.GeoDataFrame:
    path = f"{CENARIOS_DIR}/{slug}.geojson"
    gdf = gpd.read_file(path).to_crs("EPSG:4326")
    return gpd.GeoDataFrame(geometry=[gdf.union_all()], crs="EPSG:4326")

# ─── Salvar GeoJSON ──────────────────────────────────────────────────────────

def salvar_geojson(gdf: gpd.GeoDataFrame, path: str):
    if gdf is None or len(gdf) == 0:
        print(f"  ⚠ Vazio, não salvo: {os.path.basename(path)}")
        return
    gdf_out = gdf.to_crs("EPSG:4326").copy()
    for col in ["index_right", "index_left"]:
        if col in gdf_out.columns:
            gdf_out = gdf_out.drop(columns=[col])
    gdf_out.to_file(path, driver="GeoJSON")
    size_kb = os.path.getsize(path) / 1024
    print(f"  ✓ {os.path.basename(path)}  ({len(gdf_out)} feats, {size_kb:.1f} KB)")

# ─── MAIN ────────────────────────────────────────────────────────────────────

print("\n" + "=" * 60)
print("  PIPELINE: Patrimônio Histórico Rio Grande → Dashboard Next.js")
print("=" * 60)

gdf = gpd.read_file(SHP_PATH)
if gdf.crs is None:
    gdf = gdf.set_crs("EPSG:4326")
gdf = gdf.to_crs("EPSG:4326")
gdf = gdf[gdf.geometry.notna() & gdf.geometry.is_valid].copy()
print(f"\nCamada: Patrimônio Histórico ({len(gdf)} features, CRS: {gdf.crs})")

cols = [c for c in ["Label", "ENDEREÇO", "COMPLEMENT", "Tipologia", "Nome"] if c in gdf.columns]
gdf = gdf[cols + ["geometry"]].copy()

salvar_geojson(gdf, f"{BASE_OUT}/patrimonio_BASE.geojson")

for cen_nome, cen_slug in CENARIOS.items():
    mancha = carregar_mancha(cen_slug)
    atingidos = gpd.sjoin(gdf, mancha[["geometry"]], how="inner", predicate="intersects")
    atingidos = atingidos[cols + ["geometry"]].drop_duplicates()
    out_path = f"{CENARIOS_DIR}/patrimonio_ATINGIDOS_{cen_slug}.geojson"
    print(f"  {cen_nome}: {len(atingidos)} atingidos  ", end="")
    salvar_geojson(atingidos, out_path)

print("\n" + "=" * 60)
print("  Conversão concluída!")
print("=" * 60)
```

- [ ] **Step 2: Run the script**

Run: `"C:\Users\Alisson Fiorentin\miniconda3\python.exe" "scripts/converter_patrimonio_rio_grande.py"` (from the project root, `D:\Projetos\CIEX\Dashboard CIEX (Next.js)`)

Expected output: three `✓` lines, one for `patrimonio_BASE.geojson` (355 feats) and one for each of the two `patrimonio_ATINGIDOS_*.geojson` files with feature counts ≤ 355 (some may print `⚠ Vazio` if nothing intersects that scenario — that's a valid outcome, not a bug, given only the highest flood scenario may reach any of these points).

- [ ] **Step 3: Verify output files exist and are valid GeoJSON**

Run (PowerShell):
```powershell
Get-Item "public\dados_convertidos\rio_grande\patrimonio_BASE.geojson"
Get-ChildItem "public\dados_convertidos\rio_grande\cenarios\patrimonio_ATINGIDOS_*.geojson"
```
Expected: all files present with non-zero size (the `_50` scenario file may legitimately be small/absent if very few points are affected — confirm by opening the file and checking `"features"` is a non-empty array, or checking the printed feature count from Step 2).

- [ ] **Step 4: Commit**

```bash
git add scripts/converter_patrimonio_rio_grande.py public/dados_convertidos/rio_grande/patrimonio_BASE.geojson public/dados_convertidos/rio_grande/cenarios/patrimonio_ATINGIDOS_rio_grande___cenario_maio_2024.geojson public/dados_convertidos/rio_grande/cenarios/patrimonio_ATINGIDOS_rio_grande___cenario_maio_2024_50.geojson
git commit -m "Add Patrimônio Histórico conversion script and generated GeoJSON"
```

---

### Task 2: Constants, helpers, and metrics calculator

**Files:**
- Modify: `app/page.tsx:24-31` (COLORS), `app/page.tsx:12-15` (icon import), `app/page.tsx:118-121` (near DEP_LABELS — add normalizeTipologia), `app/page.tsx:198-209` (near calcSau — add calcPatrimonio)

**Interfaces:**
- Produces: `COLORS.patrimonio: string`, `normalizeTipologia(raw: string): string`, `calcPatrimonio(base: any): { total: number; tipos: Record<string, number> }` — consumed by Task 3 (state/metrics), Task 4 (map/legend/popup), Task 5 (panel tab).

- [ ] **Step 1: Add color constant**

In `app/page.tsx`, modify the `COLORS` object:

```typescript
const COLORS = {
  empresas:    "#2563eb",
  educacao:    "#16a34a",
  saude:       "#dc2626",
  cenario:     "#1f77b4",
  infra:       "#f59e0b",
  agricultura: "#6B8E23",
  patrimonio:  "#a16207",
};
```

- [ ] **Step 2: Add `Landmark` icon import**

Modify the lucide-react import:

```typescript
import {
  Building2, GraduationCap, HeartPulse, Wrench, Leaf, Sprout, Landmark,
  Download, Printer, EyeOff, SlidersHorizontal, PanelLeft,
} from "lucide-react";
```

- [ ] **Step 3: Add `normalizeTipologia` helper**

Add right after the `normalizeDep` function (near `DEP_LABELS`, ~line 143):

```typescript
// Remove prefixo numérico de classificação (ex.: "6- Arquitetura Civil Privada" → "Arquitetura Civil Privada")
const normalizeTipologia = (val: string) => val.replace(/^\d+-\s*/, "").trim();
```

- [ ] **Step 4: Add `calcPatrimonio` calculator**

Add right after `calcSau` (~line 209):

```typescript
const calcPatrimonio = (base: any) => {
  if (!base?.features) return { total: 0, tipos: {} as Record<string, number> };
  const tipos: Record<string, number> = {};
  base.features.forEach((f: any) => {
    const t = normalizeTipologia(String(f.properties?.Tipologia || ""));
    if (t) tipos[t] = (tipos[t] || 0) + 1;
  });
  return { total: base.features.length, tipos };
};
```

- [ ] **Step 5: Verify with typecheck**

Run: `npm run typecheck`
Expected: no new errors (the new symbols are unused until Task 3, so `no-unused-vars` would normally flag them — but this project's `eslint.config.mjs` disables `@typescript-eslint/no-unused-vars`, and `tsc --noEmit` does not fail on unused top-level consts). Confirm exit code 0.

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx
git commit -m "Add Patrimônio Histórico color, icon import, and metrics helpers"
```

---

### Task 3: State, data loading, and derived data

**Files:**
- Modify: `app/page.tsx:249` (camadas initial array), `app/page.tsx:268-280` (base/atingidos state), `app/page.tsx:310-334` (initial load `useEffect`), `app/page.tsx:398-422` (scenario-change `useEffect`), `app/page.tsx:510-516` (`showX` derived), `app/page.tsx:530-538` (renderX/metricasX), `app/page.tsx:565-568` (tiposUnicos-style), `app/page.tsx:603-614` (baseXFiltrado/renderXMetrics)

**Interfaces:**
- Consumes: `calcPatrimonio` from Task 2.
- Produces: `basePatrimonio`, `atingidosPatrimonio`, `filtroTipologia`/`setFiltroTipologia`, `showPatrimonio`, `renderPatrimonio`, `metricasPatrimonio`, `tipologiasUnicas`, `renderPatrimonioMetrics`, `baseHeritageFiltrado`, `baseHeritageFiltMetrics` — consumed by Task 4 (map/legend/popup/header/filters) and Task 5 (panel tab, export).

- [ ] **Step 1: Add layer to default `camadas` and add filter/list state**

Modify line 249 and add new state near the other filters/list-toggle state:

```typescript
const [camadas,     setCamadas]     = useState<string[]>(["Empresas", "Saúde", "Educação", "Agricultura", "Uso e Cobertura da Terra", "Infraestrutura", "Patrimônio Histórico"]);
```

Add next to `filtroTipo`:
```typescript
const [filtroTipologia, setFiltroTipologia] = useState("(todas)");
```

Add next to `showListaAmbulat`:
```typescript
const [showListaPatrimonio, setShowListaPatrimonio] = useState(false);
```

- [ ] **Step 2: Add base/atingidos state**

Modify the state blocks:

```typescript
const [baseEmpresas,  setBaseEmpresas]  = useState<any>(null);
const [baseEducacao,  setBaseEducacao]  = useState<any>(null);
const [baseSaude,     setBaseSaude]     = useState<any>(null);
const [baseCobertura,    setBaseCobertura]    = useState<any>(null);
const [baseAgricultura,  setBaseAgricultura]  = useState<any>(null);
const [baseInfra,        setBaseInfra]        = useState<Record<string, any>>({});
const [basePatrimonio,   setBasePatrimonio]   = useState<any>(null);

const [atingidosEmpresas,    setAtingidosEmpresas]    = useState<any>(null);
const [atingidosEducacao,    setAtingidosEducacao]    = useState<any>(null);
const [atingidosSaude,       setAtingidosSaude]       = useState<any>(null);
const [atingidosCobertura,   setAtingidosCobertura]   = useState<any>(null);
const [atingidosAgricultura, setAtingidosAgricultura] = useState<any>(null);
const [atingidosInfra,    setAtingidosInfra]    = useState<Record<string, any>>({});
const [atingidosPatrimonio, setAtingidosPatrimonio] = useState<any>(null);
const [manchaCenario,     setManchaCenario]     = useState<any>(null);
```

- [ ] **Step 3: Wire the initial-load `useEffect`**

In the `Promise.all` in the first data-loading `useEffect` (~line 310), add a fetch for the base file, and one for the atingidos file, keeping the existing array positions and adding new ones at the end so existing destructuring positions aren't disturbed:

```typescript
Promise.all([
  // Base
  fetch("/dados_convertidos/rio_grande/empresas_BASE.geojson", { signal }).then(r => r.ok ? r.json() : null),
  fetch("/dados_convertidos/rio_grande/educacao_BASE.geojson", { signal }).then(r => r.ok ? r.json() : null),
  fetch("/dados_convertidos/rio_grande/saude_BASE.geojson",    { signal }).then(r => r.ok ? r.json() : null),
  loadFGB("/dados_convertidos/rio_grande/cobertura_BASE.fgb",   signal),
  loadFGB("/dados_convertidos/rio_grande/agricultura_BASE.fgb", signal),
  fetch("/dados_convertidos/rio_grande/patrimonio_BASE.geojson", { signal }).then(r => r.ok ? r.json() : null),
  // Mancha
  fetch(`/dados_convertidos/rio_grande/cenarios/${sSlug}.geojson`, { signal }).then(r => r.ok ? r.json() : null),
  // Atingidos
  fetch(`/dados_convertidos/rio_grande/cenarios/empresas_ATINGIDOS_${sSlug}.geojson`, { signal }).then(r => r.ok ? r.json() : null),
  fetch(`/dados_convertidos/rio_grande/cenarios/educacao_ATINGIDOS_${sSlug}.geojson`, { signal }).then(r => r.ok ? r.json() : null),
  fetch(`/dados_convertidos/rio_grande/cenarios/saude_ATINGIDOS_${sSlug}.geojson`,    { signal }).then(r => r.ok ? r.json() : null),
  loadFGB(`/dados_convertidos/rio_grande/cenarios/cobertura_ATINGIDOS_${sSlug}.fgb`,   signal),
  loadFGB(`/dados_convertidos/rio_grande/cenarios/agricultura_ATINGIDOS_${sSlug}.fgb`, signal),
  fetch(`/dados_convertidos/rio_grande/cenarios/patrimonio_ATINGIDOS_${sSlug}.geojson`, { signal }).then(r => r.ok ? r.json() : null),
  Promise.all(infraAtingidosPromises),
]).then(([emp, edu, sau, cob, agr, patr, mancha, aEmp, aEdu, aSau, aCob, aAgr, aPatr, infraResults]) => {
  if (signal.aborted) return;

  setBaseEmpresas(emp); setBaseEducacao(edu); setBaseSaude(sau); setBaseCobertura(cob); setBaseAgricultura(agr); setBasePatrimonio(patr);
  setManchaCenario(mancha);
  setAtingidosEmpresas(aEmp); setAtingidosEducacao(aEdu); setAtingidosSaude(aSau); setAtingidosCobertura(aCob); setAtingidosAgricultura(aAgr); setAtingidosPatrimonio(aPatr);
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
```

- [ ] **Step 4: Wire the "no scenario" reset and the scenario-change `useEffect`**

In the `(!cenario || cenario === "(nenhum)")` branch (~line 360), add `setAtingidosPatrimonio(null);`:

```typescript
setTimeout(() => {
  setManchaCenario(null); setAtingidosEmpresas(null); setAtingidosEducacao(null); setAtingidosSaude(null); setAtingidosCobertura(null); setAtingidosAgricultura(null); setAtingidosPatrimonio(null);
  setAtingidosInfra(prev => Object.keys(prev).length === 0 ? prev : {});
}, 5000);
```

In the scenario-change `dataPromises` (~line 398) and its `.then` (~line 409-422), add the fetch and setter:

```typescript
const dataPromises = Promise.all([
  fetch(`/dados_convertidos/rio_grande/cenarios/empresas_ATINGIDOS_${sSlug}.geojson`, { signal }).then(r => r.ok ? r.json() : null),
  fetch(`/dados_convertidos/rio_grande/cenarios/educacao_ATINGIDOS_${sSlug}.geojson`, { signal }).then(r => r.ok ? r.json() : null),
  fetch(`/dados_convertidos/rio_grande/cenarios/saude_ATINGIDOS_${sSlug}.geojson`,    { signal }).then(r => r.ok ? r.json() : null),
  loadFGB(`/dados_convertidos/rio_grande/cenarios/cobertura_ATINGIDOS_${sSlug}.fgb`,   signal),
  loadFGB(`/dados_convertidos/rio_grande/cenarios/agricultura_ATINGIDOS_${sSlug}.fgb`, signal),
  fetch(`/dados_convertidos/rio_grande/cenarios/patrimonio_ATINGIDOS_${sSlug}.geojson`, { signal }).then(r => r.ok ? r.json() : null),
  Promise.all(infraPromises)
]);

return Promise.all([dataPromises, Promise.resolve(mancha)]);
})
.then((res) => {
  if (!res || signal.aborted) return;
  const [[emp, edu, sau, cob, agr, patr, infraResults], mancha] = res;

  setManchaCenario(mancha);
  setAtingidosEmpresas(emp);
  setAtingidosEducacao(edu);
  setAtingidosSaude(sau);
  setAtingidosCobertura(cob);
  setAtingidosAgricultura(agr);
  setAtingidosPatrimonio(patr);

  const newInfraData: Record<string, any> = {};
  (infraResults as any[]).forEach(({ infra, d }) => { if (d) newInfraData[infra] = d; });
  setAtingidosInfra(prev => ({ ...prev, ...newInfraData }));

  setIsLoading(false);
})
```

- [ ] **Step 5: Add derived `showPatrimonio`, `renderPatrimonio`, `metricasPatrimonio`, `tipologiasUnicas`**

Next to the other `showX` lines (~line 516):
```typescript
const showPatrimonio = baseReady ? (isCenarioAtivo ? atingidosPatrimonio : basePatrimonio) : null;
```

Next to `renderSau` (~line 534):
```typescript
const renderPatrimonio = useMemo(() => {
  if (!showPatrimonio?.features) return null;
  if (filtroTipologia === "(todas)") return showPatrimonio;
  return { ...showPatrimonio, features: showPatrimonio.features.filter((f: any) => normalizeTipologia(String(f.properties?.Tipologia || "")) === filtroTipologia) };
}, [showPatrimonio, filtroTipologia]);
```

Next to `metricasSau` (~line 538):
```typescript
const metricasPatrimonio = useMemo(() => ({ base: calcPatrimonio(basePatrimonio), impacto: calcPatrimonio(atingidosPatrimonio) }), [basePatrimonio, atingidosPatrimonio]);
```

Next to `tiposUnicos` (~line 568):
```typescript
const tipologiasUnicas = useMemo(() => {
  if (!basePatrimonio?.features) return [];
  return Array.from(new Set(basePatrimonio.features.map((f: any) => normalizeTipologia(String(f.properties?.Tipologia || ""))).filter(Boolean))).sort() as string[];
}, [basePatrimonio]);
```

- [ ] **Step 6: Add `baseHeritageFiltrado` and render/base metrics**

Next to `baseSauFiltrado` (~line 606):
```typescript
const baseHeritageFiltrado = useMemo(() => {
  if (filtroTipologia === "(todas)") return basePatrimonio;
  return basePatrimonio ? { ...basePatrimonio, features: (basePatrimonio.features || []).filter((f: any) => normalizeTipologia(String(f.properties?.Tipologia || "")) === filtroTipologia) } : null;
}, [basePatrimonio, filtroTipologia]);
```

Next to `renderSauMetrics`/`baseSauFiltMetrics` (~line 611-614):
```typescript
const renderPatrimonioMetrics    = useMemo(() => calcPatrimonio(renderPatrimonio),      [renderPatrimonio]);
const baseHeritageFiltMetrics    = useMemo(() => calcPatrimonio(baseHeritageFiltrado),  [baseHeritageFiltrado]);
```

- [ ] **Step 7: Verify with typecheck**

Run: `npm run typecheck`
Expected: exit code 0, no errors about missing/mismatched types.

- [ ] **Step 8: Commit**

```bash
git add app/page.tsx
git commit -m "Wire Patrimônio Histórico state, data loading, and derived metrics"
```

---

### Task 4: Map layer, header toggle, filter, legend, popup

**Files:**
- Modify: `app/page.tsx:631-646` (interactiveLayerIds), `app/page.tsx:648-661` (z-order effect), `app/page.tsx:689` (srcToTab), `app/page.tsx:~789` (popup content, after the `saude` block), `app/page.tsx:981-985` (Map Source/Layer, after `saude` Source), `app/page.tsx:1070-1082` (header camadas buttons), `app/page.tsx:1138-1149` (filters panel, after Saúde filter), `app/page.tsx:1014-1019` (legend)

**Interfaces:**
- Consumes: `COLORS.patrimonio`, `renderPatrimonio`, `filtroTipologia`/`setFiltroTipologia`, `tipologiasUnicas`, `normalizeTipologia` from Tasks 2–3.

- [ ] **Step 1: Add to `interactiveLayerIds`**

```typescript
const interactiveLayerIds = useMemo(() => {
  const ids: string[] = [];
  if (camadas.includes("Empresas")    && renderEmp?.features)  ids.push("empresas-cluster", "empresas-point");
  if (camadas.includes("Educação")    && renderEdu?.features)  ids.push("educacao-cluster", "educacao-point");
  if (camadas.includes("Saúde")       && renderSau?.features)  ids.push("saude-cluster",    "saude-point");
  if (camadas.includes("Patrimônio Histórico") && renderPatrimonio?.features) ids.push("patrimonio-cluster", "patrimonio-point");
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
}, [camadas, renderEmp, renderEdu, renderSau, renderPatrimonio, baseInfra, atingidosInfra, isCenarioAtivo]);
```

- [ ] **Step 2: Add to the z-order-forcing `useEffect`**

```typescript
useEffect(() => {
  if (!baseReady) return;
  const map = mapRef.current?.getMap();
  if (!map) return;
  const ids = [
    "empresas-cluster","empresas-count","empresas-point",
    "educacao-cluster","educacao-count","educacao-point",
    "saude-cluster","saude-count","saude-point",
    "patrimonio-cluster","patrimonio-count","patrimonio-point",
  ];
  requestAnimationFrame(() => {
    ids.forEach(id => { try { if (map.getLayer(id)) map.moveLayer(id); } catch {} });
  });
}, [baseReady, camadas, renderEmp, renderEdu, renderSau, renderPatrimonio]);
```

- [ ] **Step 3: Add to `srcToTab` in `handleMapClick`**

```typescript
const srcToTab: Record<string, string> = { empresas: "empresas", educacao: "educacao", saude: "saude", patrimonio: "patrimonio" };
```

- [ ] **Step 4: Add popup content block**

Insert immediately after the `saude` block closes (after line ~763, before the `agricultura` block) in `renderPopupContent`:

```typescript
if (source === "patrimonio") return (
  <div className="flex flex-col gap-1.5 p-3 w-56 bg-white rounded-xl shadow-lg border border-slate-100">
    <strong className="uppercase tracking-wider text-[10px] border-b border-slate-100 pb-1" style={{ color: COLORS.patrimonio }}>
      🏛 Patrimônio Histórico ({normalizeTipologia(String(p.Tipologia || "")) || "N/A"})
    </strong>
    <span className="font-bold text-xs text-slate-800 leading-tight">{p.Nome || "Sem nome"}</span>
    <div className="text-[10px] flex justify-between gap-2">
      <span className="text-slate-500 uppercase font-bold">Endereço:</span>
      <span className="text-slate-800 font-medium text-right">{p["ENDEREÇO"] || "—"}</span>
    </div>
  </div>
);
```

- [ ] **Step 5: Add map `Source`/`Layer`**

Insert immediately after the `saude` `Source` closes (~line 985), before `</Map>`:

```typescript
<Source id="patrimonio" type="geojson" data={camadas.includes("Patrimônio Histórico") && renderPatrimonio?.features ? renderPatrimonio : EMPTY_GEO} cluster clusterMaxZoom={14} clusterRadius={40}>
  <Layer id="patrimonio-cluster" type="circle" filter={["has","point_count"]}       layout={{ visibility: (camadas.includes("Patrimônio Histórico") && !!renderPatrimonio?.features) ? "visible" : "none" }} paint={{ "circle-color": COLORS.patrimonio, "circle-radius": ["step",["get","point_count"],14,50,20,200,26], "circle-stroke-width": 2, "circle-stroke-color": "#fff" }} />
  <Layer id="patrimonio-count"   type="symbol" filter={["has","point_count"]}       layout={{ visibility: (camadas.includes("Patrimônio Histórico") && !!renderPatrimonio?.features) ? "visible" : "none", "text-field": "{point_count_abbreviated}", "text-size": 11 }} paint={{ "text-color": "#fff" }} />
  <Layer id="patrimonio-point"   type="circle" filter={["!",["has","point_count"]]} layout={{ visibility: (camadas.includes("Patrimônio Histórico") && !!renderPatrimonio?.features) ? "visible" : "none" }} paint={{ "circle-color": COLORS.patrimonio, "circle-radius": 5, "circle-stroke-width": 1.5, "circle-stroke-color": "#fff" }} />
</Source>
```

- [ ] **Step 6: Add header toggle button**

Modify the camadas-button array (~line 1070-1076) to add an entry after "Uso e Cobertura da Terra":

```typescript
{[
  { id: "Empresas",                 label: "Empresas",    icon: <Building2 size={12} strokeWidth={2.5} />,     activeClass: "bg-white text-[#1E404A] border-[#dce1d8]", ringClass: "focus-visible:ring-[#1E404A]/40" },
  { id: "Saúde",                    label: "Saúde",       icon: <HeartPulse size={12} strokeWidth={2.5} />,    activeClass: "bg-white text-[#1E404A] border-[#dce1d8]", ringClass: "focus-visible:ring-[#1E404A]/40" },
  { id: "Educação",                 label: "Educação",    icon: <GraduationCap size={12} strokeWidth={2.5} />, activeClass: "bg-white text-[#1E404A] border-[#dce1d8]", ringClass: "focus-visible:ring-[#1E404A]/40" },
  { id: "Agricultura",              label: "Agricultura", icon: <Sprout size={12} strokeWidth={2.5} />,        activeClass: "bg-white text-[#1E404A] border-[#dce1d8]", ringClass: "focus-visible:ring-[#1E404A]/40" },
  { id: "Uso e Cobertura da Terra", label: "Cobertura",   icon: <Leaf size={12} strokeWidth={2.5} />,          activeClass: "bg-white text-[#1E404A] border-[#dce1d8]", ringClass: "focus-visible:ring-[#1E404A]/40" },
  { id: "Patrimônio Histórico",     label: "Patrimônio",  icon: <Landmark size={12} strokeWidth={2.5} />,      activeClass: "bg-white text-[#1E404A] border-[#dce1d8]", ringClass: "focus-visible:ring-[#1E404A]/40" },
].map(({ id, label, icon, activeClass, ringClass }) => (
```

- [ ] **Step 7: Add filter block**

Insert after the Saúde filter block closes (~line 1149), before the Infraestrutura filter:

```typescript
{camadas.includes("Patrimônio Histórico") && (
  <div className="flex flex-col gap-0.5 w-full overflow-hidden shrink-0">
    <label className="text-[8px] font-bold text-amber-700 uppercase tracking-wider">Tipologia (Patrimônio)</label>
    <Select value={filtroTipologia} onValueChange={setFiltroTipologia}>
      <SelectTrigger className="h-6 border-amber-200/60 bg-amber-50/50 text-[10px] w-full [&>span]:truncate"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="(todas)">(todas)</SelectItem>
        {tipologiasUnicas.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
      </SelectContent>
    </Select>
  </div>
)}
```

- [ ] **Step 8: Add legend item**

Insert after the Educação legend line (~line 1016), before the Infraestrutura legend block:

```typescript
{camadas.includes("Patrimônio Histórico") && renderPatrimonio?.features && <LegendItem cor={COLORS.patrimonio} label="Patrimônio Histórico" />}
```

- [ ] **Step 9: Verify with typecheck and lint**

Run: `npm run typecheck`
Expected: exit code 0.

Run: `npm run lint`
Expected: exit code 0 (or only pre-existing warnings unrelated to this change).

- [ ] **Step 10: Commit**

```bash
git add app/page.tsx
git commit -m "Add Patrimônio Histórico map layer, header toggle, filter, legend, popup"
```

---

### Task 5: Panel tab, tab-reset logic, and Excel export

**Files:**
- Modify: `app/page.tsx:856` (temCamadaTabular), `app/page.tsx:858-862` (tabAtiva reset effect), `app/page.tsx:1219-1226` (tab button list), `app/page.tsx` (new `TabsContent value="patrimonio"`, inserted after the `saude` `TabsContent` closes at line 1624), `app/page.tsx:834-851` (exportarExcel)

**Interfaces:**
- Consumes: `metricasPatrimonio`, `renderPatrimonioMetrics`, `baseHeritageFiltMetrics`, `filtroTipologia`/`setFiltroTipologia`, `showListaPatrimonio`/`setShowListaPatrimonio`, `isCenarioAtivo`, `renderPatrimonio`, `basePatrimonio`, `atingidosPatrimonio`, `DONUT_COLORS`, `KPIRow`, `compactoBr`, `calcPct`, `C` — all already defined by Tasks 2–3 or pre-existing in the file.

- [ ] **Step 1: Update `temCamadaTabular`**

```typescript
const temCamadaTabular = camadas.includes("Empresas") || camadas.includes("Educação") || camadas.includes("Saúde") || camadas.includes("Agricultura") || camadas.includes("Uso e Cobertura da Terra") || camadas.includes("Infraestrutura") || camadas.includes("Patrimônio Histórico");
```

- [ ] **Step 2: Update `tabAtiva` reset effect**

```typescript
useEffect(() => {
  if (tabAtiva === "agricultura" && !camadas.includes("Agricultura"))              setTabAtiva("empresas");
  if (tabAtiva === "cobertura"   && !camadas.includes("Uso e Cobertura da Terra")) setTabAtiva("empresas");
  if (tabAtiva === "infra" && (!camadas.includes("Infraestrutura") || infraAtivas.length === 0)) setTabAtiva("empresas");
  if (tabAtiva === "patrimonio" && !camadas.includes("Patrimônio Histórico")) setTabAtiva("empresas");
}, [camadas, infraAtivas, tabAtiva]);
```

- [ ] **Step 3: Add tab button**

Modify the tab list (~line 1219-1226) to add the entry after the fixed `saude` tab and before the infra conditional:

```typescript
{([
  { value: "empresas",    label: "Empresas",    icon: <Building2     size={11} strokeWidth={2.5} /> },
  { value: "saude",       label: "Saúde",       icon: <HeartPulse    size={11} strokeWidth={2.5} /> },
  { value: "educacao",    label: "Educação",    icon: <GraduationCap size={11} strokeWidth={2.5} /> },
  ...( camadas.includes("Patrimônio Histórico") ? [{ value: "patrimonio", label: "Patrimônio", icon: <Landmark size={11} strokeWidth={2.5} /> }] : []),
  ...( camadas.includes("Infraestrutura") && infraAtivas.length > 0 ? [{ value: "infra",       label: "Infraestrutura", icon: <Wrench  size={11} strokeWidth={2.5} /> }] : []),
  ...( camadas.includes("Agricultura")              ? [{ value: "agricultura", label: "Agricultura", icon: <Sprout  size={11} strokeWidth={2.5} /> }] : []),
  ...( camadas.includes("Uso e Cobertura da Terra") ? [{ value: "cobertura",   label: "Cobertura",   icon: <Leaf    size={11} strokeWidth={2.5} /> }] : []),
] as { value: string; label: string; icon: React.ReactNode }[]).map(({ value, label, icon }) => (
```

- [ ] **Step 4: Add the `TabsContent` for Patrimônio**

Insert immediately after the Saúde `TabsContent` closes (`</TabsContent>` at line ~1624) and before the `{/* Agricultura */}` comment:

```typescript
{/* Patrimônio Histórico */}
{camadas.includes("Patrimônio Histórico") && (
  <TabsContent value="patrimonio" className="flex-1 overflow-y-auto mt-4 pr-2 pb-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb]:rounded-full">
    <KPIRow isLoading={isLoading} titulo="Patrimônios" cor={COLORS.patrimonio}
      valor={compactoBr(isCenarioAtivo ? metricasPatrimonio.impacto.total : metricasPatrimonio.base.total, 0)}
      sub={isCenarioAtivo ? "Atingidos" : "Total"}
      delta={isCenarioAtivo ? `de ${compactoBr(metricasPatrimonio.base.total, 0)} (${calcPct(metricasPatrimonio.impacto.total, metricasPatrimonio.base.total)})` : undefined} />

    {(() => {
      const tipos = isCenarioAtivo ? metricasPatrimonio.impacto.tipos : metricasPatrimonio.base.tipos;
      const pieData = Object.entries(tipos).filter(([, v]) => (v as number) > 0).sort((a, b) => (b[1] as number) - (a[1] as number)).map(([name, value]) => ({ name, value: value as number }));
      const totalT = pieData.reduce((s, d) => s + d.value, 0);
      if (pieData.length === 0) return null;
      return (
        <>
          <h3 className="text-[11px] font-black uppercase tracking-wider mt-4 mb-1 border-b border-slate-200/60 pb-1" style={{ color: C.primary }}>Por Tipologia</h3>
          <div className="relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height={170}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={76} paddingAngle={2} dataKey="value" stroke="none" cursor="pointer"
                  onClick={(d: any) => setFiltroTipologia(filtroTipologia === d.name ? "(todas)" : d.name)}>
                  {pieData.map((d, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} opacity={filtroTipologia !== "(todas)" && filtroTipologia !== d.name ? 0.35 : 1} />)}
                </Pie>
                <Tooltip formatter={(v: any) => [`${v} item${v !== 1 ? "s" : ""}`, ""]} contentStyle={{ fontSize: 11, borderRadius: 8, border: `1px solid ${C.border}`, padding: "4px 10px" }} itemStyle={{ color: C.primary }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute flex flex-col items-center pointer-events-none">
              <span className="text-2xl font-black leading-none" style={{ color: C.primary }}>{totalT}</span>
              {isCenarioAtivo
                ? <><span className="text-[9px] font-medium" style={{ color: C.muted }}>{Math.round(totalT / metricasPatrimonio.base.total * 100)}% do total</span><span className="text-[9px]" style={{ color: C.muted }}>de {metricasPatrimonio.base.total}</span></>
                : <span className="text-[10px] font-medium" style={{ color: C.muted }}>itens</span>}
            </div>
          </div>
          <div className="flex flex-col gap-0.5 mb-3">
            {pieData.map((d, i) => (
              <div key={d.name}
                className="flex items-center gap-2 rounded-md px-1 py-0.5 cursor-pointer transition-colors"
                style={{ backgroundColor: filtroTipologia === d.name ? `${DONUT_COLORS[i % DONUT_COLORS.length]}22` : "transparent", outline: filtroTipologia === d.name ? `1px solid ${DONUT_COLORS[i % DONUT_COLORS.length]}55` : "none" }}
                onClick={() => setFiltroTipologia(filtroTipologia === d.name ? "(todas)" : d.name)}
                title={filtroTipologia === d.name ? "Clique para remover filtro" : `Filtrar por ${d.name}`}
              >
                <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                <span className="text-[11px] flex-1 truncate" style={{ color: filtroTipologia === d.name ? C.primary : C.muted }} title={d.name}>{d.name}</span>
                <span className="text-[11px] font-bold tabular-nums" style={{ color: C.primary }}>{d.value}</span>
                <span className="text-[11px] w-9 text-right tabular-nums" style={{ color: C.muted }}>{Math.round(d.value / totalT * 100)}%</span>
              </div>
            ))}
            {filtroTipologia !== "(todas)" && <button className="text-[9px] font-bold mt-1.5 px-2.5 py-1 rounded-md self-start" style={{ backgroundColor: `${C.primary}15`, color: C.primary, border: `1px solid ${C.primary}35` }} onClick={() => setFiltroTipologia("(todas)")}>✕ Limpar filtro</button>}
          </div>
        </>
      );
    })()}

    {isCenarioAtivo && (() => {
      const feats = renderPatrimonio?.features ?? [];
      const lista = feats
        .map((f: any) => {
          const nome = String(f.properties?.Nome || "Sem nome").trim();
          const end  = String(f.properties?.["ENDEREÇO"] || "").trim();
          return end ? `${nome} — ${end}` : nome;
        })
        .sort((a: string, b: string) => a.localeCompare(b, "pt-BR"));
      if (lista.length === 0) return null;
      return (
        <div className="mb-2">
          <button onClick={() => setShowListaPatrimonio(p => !p)}
            className="w-full flex items-center justify-between text-[10px] font-bold px-2.5 py-1.5 rounded-lg"
            style={{ backgroundColor: C.cardBg, color: C.primary, border: `1px solid ${C.border}` }}>
            <span>Itens Atingidos ({lista.length})</span>
            <span style={{ fontSize: 9 }}>{showListaPatrimonio ? "▲" : "▼"}</span>
          </button>
          {showListaPatrimonio && (
            <div className="flex flex-col gap-0.5 mt-1 max-h-52 overflow-y-auto rounded-lg p-1.5" style={{ backgroundColor: C.cardBg, border: `1px solid ${C.border}` }}>
              {lista.map((label: string, i: number) => (
                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded" style={{ color: C.muted }} title={label}>{label}</span>
              ))}
            </div>
          )}
        </div>
      );
    })()}

    <p className="text-[9px] italic mt-3 pt-2 border-t" style={{ color: C.muted, borderColor: C.border }}>Fonte: Levantamento de Patrimônio Histórico — Rio Grande/RS</p>
  </TabsContent>
)}

{/* Agricultura */}
```

(Note: the existing `{/* Agricultura */}` comment and the `TabsContent value="agricultura"` that follows it are unchanged — only prepend the block above immediately before that comment.)

- [ ] **Step 5: Add Excel export**

Modify `exportarExcel` (~line 834-851):

```typescript
const exportarExcel = useCallback(() => {
  const wb = XLSX.utils.book_new();
  const add = (data: any, nome: string) => {
    if (data?.features?.length > 0)
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.features.map((f: any) => f.properties)), nome);
  };
  if (camadas.includes("Empresas")) add(atingidosEmpresas || baseEmpresas, "Empresas");
  if (camadas.includes("Educação")) add(atingidosEducacao || baseEducacao, "Educação");
  if (camadas.includes("Saúde"))    add(atingidosSaude    || baseSaude,    "Saúde");
  if (camadas.includes("Patrimônio Histórico")) add(atingidosPatrimonio || basePatrimonio, "Patrimônio Histórico");
  if (camadas.includes("Infraestrutura")) {
    infraAtivas.forEach(infra => {
      const src = isCenarioAtivo ? atingidosInfra[infra] : baseInfra[infra];
      if (src) add(src, `Infra-${infra.slice(0, 20)}`);
    });
  }
  const sufixo = cenario !== "(nenhum)" ? `_${slugify(cenario)}` : "";
  XLSX.writeFile(wb, `Impacto_Rio_Grande${sufixo}.xlsx`);
}, [camadas, cenario, isCenarioAtivo, infraAtivas, atingidosEmpresas, baseEmpresas, atingidosEducacao, baseEducacao, atingidosSaude, baseSaude, atingidosPatrimonio, basePatrimonio, atingidosInfra, baseInfra]);
```

- [ ] **Step 6: Verify with typecheck and lint**

Run: `npm run typecheck`
Expected: exit code 0.

Run: `npm run lint`
Expected: exit code 0 (or only pre-existing warnings).

- [ ] **Step 7: Commit**

```bash
git add app/page.tsx
git commit -m "Add Patrimônio Histórico panel tab and Excel export"
```

---

### Task 6: Manual verification in the running app

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

Run: `npm run dev` (Turbopack, http://localhost:3000)

- [ ] **Step 2: Visual check — default state**

Open the app in a browser. Confirm:
- The "Patrimônio" button appears in the header layer row (after "Cobertura"), highlighted as active (white background) by default.
- Amber/gold clustered points are visible on the map matching the heritage site locations (concentrated in the historic center of Rio Grande).
- The "Patrimônio" tab appears in the left panel's tab row, showing a KPI count of 355 (or the deduplicated/cleaned feature count from Task 1) and a donut chart broken down by (normalized) Tipologia.

- [ ] **Step 3: Visual check — scenario active**

Select a scenario ("Cenário Maio 2024") from the top dropdown. Confirm:
- The Patrimônio KPI switches to "Atingidos" with a count ≤ base total and a percentage delta.
- The donut updates to reflect only affected items.
- "Itens Atingidos" list expands to show `Nome — Endereço` entries when clicked.
- Clicking a heritage point on the map opens a popup showing Tipologia, Nome (or "Sem nome"), and Endereço, and switches the panel to the "Patrimônio" tab.

- [ ] **Step 4: Filter and legend check**

- Open the Filtros panel, confirm the "Tipologia (Patrimônio)" dropdown lists normalized (deduplicated) categories.
- Selecting a category filters both the map points and the panel list/donut.
- Open the Legenda panel, confirm "Patrimônio Histórico" appears with the amber color swatch when the layer is active and has features.

- [ ] **Step 5: Export check**

Click "Baixar" (Excel export) and confirm the downloaded `.xlsx` includes a "Patrimônio Histórico" sheet with the expected columns (`Label`, `ENDEREÇO`, `COMPLEMENT`, `Tipologia`, `Nome`).

- [ ] **Step 6: Toggle-off check**

Click the "Patrimônio" header button to deactivate the layer. Confirm the map points disappear, the panel tab disappears (and if it was active, the panel falls back to the "Empresas" tab), and the legend/filter entries disappear.

- [ ] **Step 7: Final full verification**

Run: `npm run typecheck && npm run lint`
Expected: both exit code 0.

- [ ] **Step 8: Stop the dev server**

No commit needed for this task — it's verification only. If any issue is found, fix it in the relevant Task above and re-commit there (do not create a separate "fix" task).
