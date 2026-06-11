# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Servidor de desenvolvimento (Turbopack) → http://localhost:3000
npm run build      # Build de produção
npm run typecheck  # tsc --noEmit
npm run lint       # ESLint
npm run format     # Prettier
```

## Architecture

Single-file Next.js + TypeScript app. All logic lives in [app/page.tsx](app/page.tsx) (~2073 lines). No modules or extra components beyond `components/ui/` (shadcn/ui + a custom `map.tsx` wrapper) and four file-local helpers at the bottom of `page.tsx`: `KPIRow`, `KPICard`, `BarServico`, and `LegendItem`.

Stack: MapLibre GL via `react-map-gl`, Tailwind 4, shadcn/ui (Radix), `xlsx` for export, `@turf/turf` for area/bbox calculations, `flatgeobuf` for streaming large binary GeoJSON files, `recharts` for donut charts.

### Layout

Everything is absolutely positioned over a full-screen map (`absolute inset-0 z-0`):
- **Header** — `absolute top-2 left-4 right-4 z-20`: single `flex` row, `py-1.5`, total height ~36px. Left→right: logos (h-5/h-4) | title | cenário select (w-36, h-6) | layer toggle buttons (h-6). No `flex-wrap` — everything on one line always.
- **Analysis panel** — `absolute top-[52px] left-4 bottom-4 w-[340px] z-20 p-4`: KPI tabs (Empresas / Saúde / Educação / Infra / Agricultura / Cobertura), download, print
- **Filters panel** — `absolute top-[52px] right-4 z-10 w-44`: per-layer dropdowns
- **Legend** — `absolute bottom-4 z-10`: shifts to `left-[360px]` when analysis panel is open, else `left-4`

### State

All state lives in the single `Dashboard` component. Key state groups:
- `cenario` / `manchaCenario` — selected flood scenario and its polygon
- `camadas` / `infraAtivas` — active point layers and active infra sub-layers
- `baseEmpresas/Educacao/Saude/Cobertura/Agricultura` — GeoJSON/FGB loaded on mount
- `atingidosEmpresas/Educacao/Saude/Cobertura/Agricultura` — loaded on scenario change
- `baseInfra` / `atingidosInfra` — lazily loaded; Terrenos (~28MB) prompts user confirmation before loading

### Permalink

`?c=<slug>` encodes the active scenario. The slug is `slugify(cenario)` (not the full `scenarioSlug`). Example: `?c=cenario_maio_2024_50`. Set on `history.replaceState` whenever `cenario` changes; read once on mount via `permalinkCenarioRef`.

### Data (`public/dados_convertidos/rio_grande/`)

All GeoJSON/FGB files are pre-computed (no client-side spatial joins). Files ending in `.fgb` are FlatGeobuf format loaded via `loadFGB()`, which streams via `flatgeobuf.geojson.deserialize`. Files ending in `.geojson` are fetched directly.

```
rio_grande/
├── empresas_BASE.geojson / educacao_BASE.geojson / saude_BASE.geojson
├── cobertura_BASE.fgb / agricultura_BASE.fgb
├── cenarios/
│   ├── rio_grande___cenario_<slug>.geojson          ← flood polygon
│   ├── empresas_ATINGIDOS_rio_grande___<slug>.geojson
│   ├── educacao_ATINGIDOS_rio_grande___<slug>.geojson
│   ├── saude_ATINGIDOS_rio_grande___<slug>.geojson
│   ├── cobertura_ATINGIDOS_rio_grande___<slug>.fgb
│   ├── agricultura_ATINGIDOS_rio_grande___<slug>.fgb
│   └── infra_<layer>_ATINGIDOS_rio_grande___<slug>.(geojson|fgb)
└── infraestrutura/
    └── <layer>_BASE.(geojson|fgb)    ← Quadras and Terrenos use .fgb
```

Scenario slugs use the same `slugify` as the JS code: accents stripped, lowercase, non-alphanumeric sequences → single `_`. "Cenário Maio 2024 + 50%" → `cenario_maio_2024_50`.

### MapLibre layer IDs

Point layers: `<source>-cluster`, `<source>-count`, `<source>-point` (sources: `empresas`, `educacao`, `saude`).
Infra layers: source id = `infra-<slugify(nome)>`, layers = `${sid}-fill`, `${sid}-line`, `${sid}-point`. All three are always added; geometry-type filters select which renders.
Scenario polygon: source `cenario`, layers `cenario-fill` + `cenario-line`.
Cobertura/Agricultura: sources `cobertura` / `agricultura`, layers `*-fill` + `*-line`. Color driven by `["match", ["get", "tipo_classe"|"tipo_cultura"], ...]` expressions.

Polygon/line layers (cenário, cobertura, agricultura, infra) are rendered first in the JSX so they sit below point layers. Point layers (empresas, educacao, saude) are rendered last and appear on top. No `beforeId` is used — z-order is determined entirely by JSX render order.

### CIEX Colors

The `C` object in `page.tsx` holds all brand tokens:

| Key | Value | Usage |
|---|---|---|
| `C.primary` | `#1E404A` | Sidebar, buttons, text headings |
| `C.dark` | `#163037` | Header border |
| `C.field` | `#255362` | Input backgrounds in header |
| `C.bg` | `#ffffff` | App background |
| `C.cardBg` | `#f8f9fa` | Card backgrounds |
| `C.border` | `#e2e5e2` | All borders |
| `C.muted` | `#6b7a69` | Secondary text |

Map marker colors are in the `COLORS` object: `empresas` (#2563eb), `educacao` (#16a34a), `saude` (#dc2626), `cenario` (#1f77b4), `infra` (#f59e0b), `agricultura` (#6B8E23).

Infra sub-layer colors are in `INFRA_COLORS`: Logradouros (#e67e22), Quadras (#8e44ad), Terrenos (#27ae60), Prédios Públicos (#2980b9), Segurança (#c0392b).

Cobertura and Agricultura classes each have their own color maps: `COBERTURA_COLORS` and `AGRI_COLORS`.

### Active Infra Layers

`INFRA_LAYERS` contains: `["Logradouros", "Quadras", "Terrenos", "Prédios Públicos", "Segurança"]`. An `imoveis_BASE.geojson` file exists in the data directory and has popup handling, but Imóveis is not in `INFRA_LAYERS` so it is not toggleable from the UI.

### Scenarios

`CENARIOS` (hardcoded at the top of `page.tsx`) lists available flood scenarios: `["Cenário Maio 2024", "Cenário Maio 2024 + 50%"]`. Adding a new scenario means adding it here and supplying the corresponding pre-computed GeoJSON/FGB files under `public/dados_convertidos/rio_grande/cenarios/`.

### Key Utility Functions (module-level, before `Dashboard`)

- `loadFGB(url, signal?)` — streams a `.fgb` file via `flatgeobuf.geojson.deserialize`, returns a GeoJSON FeatureCollection.
- `slugify(str)` / `scenarioSlug(cen)` — normalizes strings for file name lookups; must stay in sync with the Python pipeline's naming convention.
- `formatoBr` / `compactoBr` — Brazilian locale number formatting (thousands/millions/billions).
- `calcEmp` / `calcEdu` / `calcSau` — derive KPI metrics from a GeoJSON FeatureCollection for each layer type.
- `countFlag(feats, prop)` — counts features where a 0/1 boolean property is truthy.
- `countEquals(feats, prop, values)` — counts features matching a set of string values.
- `countRuasUnicas(feats)` — deduplicates Logradouros by `tipo + nome`.

### GeoJSON Field Names

Point layers use lowercase snake_case (normalized during Python conversion):
- Empresas: `CNAE_2`, `Empregados`, `Massa_Salarial`, `Média Salarial`
- Educação: `no_entidade`, `tp_dependencia` (string "1"–"4"), `qtd_matri_*`, `qtd_prof`
- Saúde: `co_tipo_estabelecimento`, `no_fantasia`, `no_razao_social`, `staff_*`
- Imóveis: `Uso`, `Patrim`, `Condom`
- Prédios Públicos / Segurança: `Nome`, `Endereço`
- Logradouros: `tipo`, `nome`, `drenagem` (0/1 flag), `iluminacao` (0/1 flag)
- Quadras: `codigo`, `Area_m2`
- Terrenos: `agua`, `coleta_lix`, `esgoto_plu`, `esgoto_clo`, `condominio` (0/1 flags)
- Cobertura: `tipo_classe`
- Agricultura: `tipo_cultura`

## Re-converting data

All converter scripts require geopandas. Scripts in `scripts/`:

| Script | Purpose |
|---|---|
| `converter_infra_rio_grande.py` | Converts infrastructure shapefiles (Logradouros, Quadras, Terrenos, Prédios Públicos, Segurança) |
| `converter_cobertura_rio_grande.py` | Converts MapaBiomas land-cover vector data to FGB |
| `converter_cobertura_raster.py` | Converts MapaBiomas land-cover TIFF to a georeferenced raster for optional use |
| `converter_agricultura_rio_grande.py` | Converts MapaBiomas agriculture vector data to FGB |
| `converter_agricultura_raster.py` | Converts MapaBiomas agriculture TIFF to a georeferenced raster for optional use |

The empresas/educacao/saude BASE and ATINGIDOS GeoJSONs come from a separate BID pipeline. Cobertura and Agricultura originate from MapaBiomas Collection 10. Raster source TIFFs are stored in `scripts/data/`; `RASTER_COORDS` in `page.tsx` holds their bounding box in EPSG:4326.
