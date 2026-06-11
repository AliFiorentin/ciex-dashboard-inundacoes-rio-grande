# Dashboard CIEX — Análise de Impacto de Inundações em Rio Grande/RS

Dashboard web interativo para análise geoespacial do impacto socioeconômico e de infraestrutura de cenários de inundação no município de Rio Grande/RS, desenvolvido pelo **Centro de Inteligência em Eventos Extremos (CIEX)**.

---

## Objetivos

- Quantificar o impacto de cenários de inundação sobre empresas, estabelecimentos de saúde, escolas, infraestrutura urbana, agricultura e uso e cobertura da terra no município de Rio Grande/RS.
- Oferecer uma ferramenta visual e interativa para análise espacial de áreas atingidas, comparando cenários de diferentes magnitudes.
- Apoiar a tomada de decisão em gestão de riscos climáticos e formulação de políticas públicas.

---

## Descrição

A aplicação é um dashboard de página única construído com **Next.js + TypeScript**, exibindo dados geoespaciais sobre um mapa base vetorial (MapLibre GL). O usuário pode alternar entre cenários de inundação e visualizar, para cada camada, o total de pontos/áreas atingidos e indicadores agregados (KPIs) no painel lateral.

**Stack principal:** Next.js 16, TypeScript, MapLibre GL (`react-map-gl`), Tailwind CSS 4, shadcn/ui, Recharts, `@turf/turf`, `flatgeobuf`, `xlsx`.

**Funcionalidades:**
- Alternância entre cenários de inundação com carregamento assíncrono por demanda
- Painel de análise com abas por setor (Empresas, Saúde, Educação, Infraestrutura, Agricultura, Cobertura da Terra)
- Filtros por setor econômico (CNAE), dependência administrativa e tipo de estabelecimento
- Download dos dados filtrados em XLSX
- Impressão do painel via CSS dedicado
- Permalink via parâmetro `?c=<slug>` na URL

---

## Base de Dados

| Camada | Fonte | Descrição |
|---|---|---|
| **Empresas** | RAIS (MTE) | Microdados de vínculos empregatícios formais (empregados, massa salarial, CNAE) — pipeline BID |
| **Educação** | Censo Escolar (INEP) | Escolas, matrículas por modalidade, professores e dependência administrativa |
| **Saúde** | CNES (Ministério da Saúde) | Unidades de saúde, tipo de estabelecimento e quadro de pessoal por categoria |
| **Logradouros** | Prefeitura de Rio Grande | Arruamento com atributos de drenagem e iluminação pública |
| **Quadras** | Prefeitura de Rio Grande | Quadras urbanas com código e área |
| **Terrenos** | Prefeitura de Rio Grande | Lotes com informações de saneamento (água, esgoto, coleta de lixo) |
| **Prédios Públicos** | Prefeitura de Rio Grande | Equipamentos públicos municipais |
| **Segurança** | Prefeitura de Rio Grande | Postos e instalações de segurança pública |
| **Uso e Cobertura da Terra** | MapaBiomas Coleção 10 (2024) | Classes: Silvicultura, Campo Alagado, Formação Campestre, Mosaico de Usos, Restinga Arbórea, Restinga Herbácea |
| **Agricultura** | MapaBiomas Coleção 10 (2024) | Culturas: Soja, Arroz, Outras Lavouras Temporárias |
| **Cenários de inundação** | Modelagem hidrológica | Manchas de inundação vetoriais do evento de Maio de 2024 e cenário expandido (+50%) |

---

## Metodologia

### 1. Pré-processamento espacial (Python / GeoPandas)

Todos os cruzamentos espaciais são **pré-computados offline** — não há spatial join no browser. O pipeline gera, para cada camada e cenário, um arquivo `_ATINGIDOS_` contendo apenas as feições dentro da mancha de inundação.

```
sjoin(camada_base, mancha_inundacao, how="inner", predicate="intersects")
```

Os scripts estão em `scripts/`:

| Script | Função |
|---|---|
| `converter_infra_rio_grande.py` | Infraestrutura urbana (logradouros, quadras, terrenos, prédios públicos, segurança) → GeoJSON/FGB |
| `converter_cobertura_rio_grande.py` | Uso e cobertura da terra (MapaBiomas vetorial) → FGB |
| `converter_agricultura_rio_grande.py` | Agricultura (MapaBiomas vetorial) → FGB |
| `converter_cobertura_raster.py` | Cobertura MapaBiomas (TIFF) → PNG georreferenciado |
| `converter_agricultura_raster.py` | Agricultura MapaBiomas (TIFF) → PNG georreferenciado |

### 2. Formatos de arquivo

| Formato | Uso |
|---|---|
| `.geojson` | Camadas de pontos (empresas, saúde, educação) e polígonos pequenos |
| `.fgb` (FlatGeobuf) | Camadas de polígonos grandes (terrenos, quadras, cobertura, agricultura) — streaming eficiente |

O FlatGeobuf é carregado via `flatgeobuf.geojson.deserialize` em stream, sem necessidade de carregar o arquivo inteiro na memória antes de renderizar.

### 3. Convenção de nomenclatura dos arquivos

Os nomes dos arquivos seguem a função `slugify`: acentos removidos, letras minúsculas, sequências de caracteres não-alfanuméricos substituídas por `_`.

```
"Cenário Maio 2024 + 50%" → cenario_maio_2024_50
```

Padrão dos arquivos de cenário:
```
public/dados_convertidos/rio_grande/cenarios/
├── rio_grande___<slug>.geojson                          ← mancha de inundação
├── empresas_ATINGIDOS_rio_grande___<slug>.geojson
├── educacao_ATINGIDOS_rio_grande___<slug>.geojson
├── saude_ATINGIDOS_rio_grande___<slug>.geojson
├── cobertura_ATINGIDOS_rio_grande___<slug>.fgb
├── agricultura_ATINGIDOS_rio_grande___<slug>.fgb
└── infra_<camada>_ATINGIDOS_rio_grande___<slug>.(geojson|fgb)
```

### 4. Indicadores calculados (KPIs)

**Empresas**
- Estabelecimentos formais atingidos
- Vínculos empregatícios formais atingidos
- Massa salarial total (R$)
- Média salarial por empresa (R$)

**Educação**
- Escolas atingidas (por dependência: federal, estadual, municipal, privada)
- Professores
- Matrículas por modalidade: Educação Infantil, Ensino Fundamental, Ensino Médio, Profissional, EJA, Educação Especial

**Saúde**
- Unidades de saúde atingidas (por tipo de estabelecimento)
- Quadro de pessoal por categoria: médicos, enfermagem, farmácia, odontologia, ACS/endemias, diagnóstico/imagem, administração, serviços gerais, transporte de urgência, outros

**Infraestrutura**
- *Logradouros*: ruas únicas atingidas (deduplicadas por `tipo + nome`), com e sem drenagem, com e sem iluminação
- *Quadras*: quantidade e área total (m²)
- *Terrenos*: quantidade; acesso a água, coleta de lixo, esgoto pluvial e cloacal, condomínios (flags 0/1)
- *Prédios Públicos e Segurança*: contagem por nome

**Uso e Cobertura da Terra / Agricultura**
- Área atingida (ha) por classe de cobertura ou cultura agrícola, calculada via `@turf/turf`

### 5. Carregamento e desempenho

- **Dados de base** carregados uma única vez na inicialização do componente (`useEffect` sem dependências)
- **Dados atingidos** carregados sob demanda a cada troca de cenário, com `AbortController` para cancelar requisições em andamento
- **Terrenos** (~28 MB): solicita confirmação do usuário antes do carregamento por causa do tamanho
- Camadas de ponto são clusterizadas automaticamente pelo MapLibre GL (raio de 50px)

### 6. Renderização no mapa

Camadas renderizadas em ordem (z-order determinado pela posição no JSX, sem `beforeId`):

1. Polígono de inundação (cenário)
2. Uso e cobertura da terra
3. Agricultura
4. Infraestrutura (fill + line + point por geometry type)
5. Empresas, Saúde, Educação (pontos — renderizados por cima)

Cores de marcadores: Empresas `#2563eb`, Educação `#16a34a`, Saúde `#dc2626`.

### 7. Permalink

O cenário ativo é codificado na URL via `?c=<slug>`, definido por `history.replaceState` a cada troca. Na inicialização, o valor é lido via `ref` para evitar re-renderizações extras.

---

## Como Executar

```bash
npm install
npm run dev        # http://localhost:3000
```

```bash
npm run build      # Build de produção
npm run typecheck  # Verificação de tipos (tsc --noEmit)
npm run lint       # ESLint
npm run format     # Prettier
```

### Adicionando um novo cenário

1. Gere os arquivos `_ATINGIDOS_` via scripts Python para o novo slug de cenário.
2. Adicione o nome do cenário ao array `CENARIOS` em `app/page.tsx`.
3. Coloque os arquivos em `public/dados_convertidos/rio_grande/cenarios/` seguindo a convenção de nomenclatura.

---

## Estrutura do Projeto

```
app/
  page.tsx          — Componente único Dashboard (~2000 linhas): todo o estado, lógica e UI
  layout.tsx        — Layout raiz Next.js
  globals.css       — Estilos globais e Tailwind
components/ui/      — Componentes shadcn/ui + wrapper MapLibre
scripts/            — Conversores Python (GeoPandas) para geração dos dados
public/
  dados_convertidos/
    rio_grande/     — GeoJSON e FGB prontos para consumo pelo browser
```

---

## Autores e Instituições

**Grupo de Pesquisa em Economia Azul**
Instituto de Ciências Econômicas, Administrativas e Contábeis
Universidade Federal do Rio Grande — FURG
Av. Itália, KM 8, Rio Grande — RS

**Centro Interinstitucional de Observação e Previsão de Eventos Extremos (CIEX)**
Universidade Federal do Rio Grande — FURG
Av. Itália, KM 8, CIDEC-SUL, Rio Grande — RS

---

**Alisson Tallys Geraldo Fiorentin**
Doutorando em Economia Aplicada — Universidade Federal do Rio Grande do Sul (UFRGS)
✉ alisson.fiorentin@gmail.com

---

Desenvolvido com apoio do **BID (Banco Interamericano de Desenvolvimento)** e da **Prefeitura Municipal de Rio Grande/RS**.

Dados de uso e cobertura da terra: [MapaBiomas](https://mapbiomas.org/) — Coleção 10 (2024).
