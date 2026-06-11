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

### 1. Seleção dos atingidos (Python / GeoPandas)

Todos os cruzamentos espaciais são **pré-computados offline** via junção espacial ponto-em-polígono (ou polígono-em-polígono), utilizando o predicado `intersects`:

```python
atingidos = gpd.sjoin(camada_base, mancha_inundacao, how="inner", predicate="intersects")
```

O resultado — apenas as feições que intersectam a mancha de inundação — é exportado como GeoJSON ou FlatGeobuf (`.fgb`) e servido estáticamente pelo Next.js. Não há processamento espacial no browser.

### 2. Cálculo dos indicadores por setor

#### Empresas

Sendo $N_{atg}$ o conjunto de estabelecimentos atingidos e $N_{base}$ o conjunto total:

$$\text{Estabelecimentos atingidos} = |N_{atg}|$$

$$\text{Vínculos atingidos} = \sum_{i \in N_{atg}} \text{Empregados}_i$$

$$\text{Massa salarial atingida} = \sum_{i \in N_{atg}} \text{Massa\_Salarial}_i$$

$$\text{Média salarial} = \frac{\sum_{i \in N_{atg}} \overline{\text{Salário}}_i}{|N_{atg}|}$$

O percentual de impacto para qualquer métrica $m$ é:

$$\%\text{atingido} = \frac{m_{atg}}{m_{base}} \times 100$$

#### Educação

Para cada modalidade $k \in \{\text{infantil, fundamental, médio, profissional, EJA, especial}\}$:

$$\text{Matrículas}_{k,\,atg} = \sum_{i \in N_{atg}} \text{qtd\_matri}_{k,\,i}$$

$$\text{Professores}_{atg} = \sum_{i \in N_{atg}} \text{qtd\_prof}_i$$

#### Saúde

$$\text{Unidades}_{tipo,\,atg} = \left|\{i \in N_{atg} : \text{tipo\_estabelecimento}_i = \text{tipo}\}\right|$$

Para cada categoria profissional $k$:

$$\text{Staff}_{k,\,atg} = \sum_{i \in N_{atg}} \text{staff}_{k,\,i}$$

$$\%\text{staff}_k = \frac{\text{Staff}_{k,\,atg}}{\text{Staff}_{k,\,base}} \times 100$$

#### Logradouros

Cada feição representa um **segmento** de logradouro. A deduplicação para contagem de ruas únicas usa o par (`tipo`, `nome`):

$$\text{Ruas únicas}_{atg} = \left|\left\{\text{tipo}_i \| \text{nome}_i : i \in N_{atg}\right\}\right|$$

A cobertura de serviços é calculada como contagem de feições com flag binário ativo ($v = 1$):

$$\text{Com drenagem}_{atg} = \left|\{i \in N_{atg} : \text{drenagem}_i = 1\}\right|$$

$$\text{Com iluminação}_{atg} = \left|\{i \in N_{atg} : \text{iluminacao}_i = 1\}\right|$$

#### Quadras e Terrenos

$$\text{Quadras atingidas} = |N_{atg}|$$

Para terrenos, cada atributo de saneamento é um flag $\in \{0, 1\}$:

$$\text{Com } s = \left|\{i \in N_{atg} : s_i = 1\}\right|, \quad s \in \{\text{água, coleta\_lixo, esgoto\_pluvial, condomínio}\}$$

O esgoto cloacal é verificado por equivalência de string (aceita variantes de nomenclatura):

$$\text{Com esgoto cloacal} = \left|\{i \in N_{atg} : \text{esgoto\_clo}_i \in \{\text{"esgoto\_cloacal", "cloacal", "1"}\}\}\right|$$

#### Uso e Cobertura da Terra / Agricultura

A área de cada feição vetorial $f$ é calculada pelo `@turf/turf` (WGS 84, resultado em m²) e convertida para hectares:

$$ha_f = \frac{\text{turf.area}(f)}{10\,000}$$

Feições com $ha_f < 0{,}5$ são descartadas (ruído de vetorização do raster MapaBiomas). A área total atingida por classe $k$ é:

$$Ha_{k,\,atg} = \sum_{\substack{i \in N_{atg} \\ \text{classe}_i = k}} ha_i, \quad ha_i \geq 0{,}5$$

$$\%\text{área}_k = \frac{Ha_{k,\,atg}}{Ha_{k,\,base}} \times 100$$

### 3. Formatos de arquivo e desempenho

| Formato | Camadas | Motivo |
|---|---|---|
| `.geojson` | Empresas, Educação, Saúde, Logradouros, Prédios Públicos, Segurança, Cenário | Tamanho reduzido, parsing nativo |
| `.fgb` (FlatGeobuf) | Cobertura, Agricultura, Quadras, Terrenos | Streaming binário eficiente para arquivos grandes |

O FlatGeobuf é carregado em stream via `flatgeobuf.geojson.deserialize`, sem necessidade de carregar o arquivo inteiro na memória antes de renderizar. Terrenos (~28 MB) solicita confirmação do usuário antes do carregamento.

Dados de base são carregados uma única vez na inicialização. Dados atingidos são carregados sob demanda a cada troca de cenário, com `AbortController` para cancelar requisições em andamento.

### 4. Renderização e z-order

Camadas renderizadas em ordem crescente de z-index (determinada pela posição no JSX, sem uso de `beforeId`):

1. Polígono de inundação (cenário)
2. Uso e cobertura da terra
3. Agricultura
4. Infraestrutura (geometrias fill/line/point selecionadas por filtro de tipo)
5. Empresas, Saúde, Educação (pontos clusterizados — renderizados por cima)

Pontos são clusterizados automaticamente pelo MapLibre GL (raio 50 px). A bounding box da mancha ativa é calculada via `turf.bbox` para reposicionamento automático do mapa.

### 5. Permalink

O cenário ativo é persistido na URL via `?c=<slug>` usando `history.replaceState`. O slug é lido por `ref` na inicialização para evitar re-renderizações desnecessárias.

---

## Dependências

### Aplicação (Node.js ≥ 18)

| Pacote | Versão | Função |
|---|---|---|
| `next` | ^16 | Framework React com SSR e servidor estático |
| `react` / `react-dom` | ^19 | Biblioteca de UI |
| `maplibre-gl` | ^5 | Motor de renderização de mapas vetoriais |
| `react-map-gl` | ^8 | Wrapper React para MapLibre GL |
| `@turf/turf` | ^7 | Cálculos geoespaciais (área, bounding box) |
| `flatgeobuf` | ^4 | Leitura em stream de arquivos `.fgb` |
| `recharts` | ^3 | Gráficos de rosca (donut charts) |
| `xlsx` | ^0.18 | Exportação de dados em formato XLSX |
| `radix-ui` | ^1 | Primitivos de UI acessíveis (base do shadcn/ui) |
| `lucide-react` | ^1 | Biblioteca de ícones |
| `tailwindcss` | ^4 | Framework CSS utilitário |
| `typescript` | ^5 | Tipagem estática |

Instalar com:
```bash
npm install
```

### Scripts de conversão (Python ≥ 3.10)

| Pacote | Função |
|---|---|
| `geopandas` | Leitura de shapefiles/GeoJSON e junção espacial (`sjoin`) |
| `shapely` | Operações geométricas (dependência do geopandas) |
| `pandas` | Manipulação tabular |
| `numpy` | Operações numéricas |
| `rasterio` | Leitura e vetorização de rasters GeoTIFF (MapaBiomas) |

Instalar com:
```bash
pip install geopandas shapely pandas numpy rasterio
```

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

1. Gere os arquivos `_ATINGIDOS_` via scripts Python para o novo cenário.
2. Adicione o nome do cenário ao array `CENARIOS` em `app/page.tsx`.
3. Coloque os arquivos em `public/dados_convertidos/rio_grande/cenarios/`.

---

## Estrutura do Projeto

```
app/
  page.tsx          — Componente único Dashboard (~2000 linhas): todo o estado, lógica e UI
  layout.tsx        — Layout raiz Next.js
  globals.css       — Estilos globais e Tailwind
components/ui/      — Componentes shadcn/ui + wrapper MapLibre
scripts/            — Conversores Python (GeoPandas/Rasterio) para geração dos dados
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
