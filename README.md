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
| **Patrimônio Histórico** | Levantamento de Patrimônio Histórico — Rio Grande/RS | Bens tombados/inventariados (355 pontos) com nome, endereço e tipologia arquitetônica |
| **Uso e Cobertura da Terra** | MapaBiomas Coleção 10 (2024) | Classes: Silvicultura, Campo Alagado, Formação Campestre, Mosaico de Usos, Restinga Arbórea, Restinga Herbácea |
| **Agricultura** | MapaBiomas Coleção 10 (2024) | Culturas: Soja, Arroz, Outras Lavouras Temporárias |
| **População** | WorldPop | Grade populacional (hab./pixel) renderizada como heatmap raster; população total e atingida por cenário pré-computadas |
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

Notação geral: $N$ = conjunto total de feições no município; $\hat{N} \subseteq N$ = conjunto das feições atingidas pelo cenário selecionado. O percentual de impacto para qualquer métrica $m$ é:

$$\%\,\text{atingido} = \frac{m_{\hat{N}}}{m_N} \times 100$$

#### Empresas

Cada feição é um estabelecimento com os campos `Empregados` ($E_i$), `Massa_Salarial` ($W_i$) e `Média Salarial` ($\bar{S}_i$):

$$\text{Estabelecimentos} = |\hat{N}|$$

$$\text{Vínculos} = \sum_{i \,\in\, \hat{N}} E_i \qquad \text{Massa salarial} = \sum_{i \,\in\, \hat{N}} W_i \qquad \text{Média salarial} = \frac{1}{|\hat{N}|}\sum_{i \,\in\, \hat{N}} \bar{S}_i$$

#### Educação

Cada feição é uma escola com os campos `qtd_prof` ($p_i$) e `qtd_matri_k` ($m_{k,i}$) para cada modalidade $k$ ∈ {infantil, fundamental, médio, profissional, EJA, especial}:

$$P = \sum_{i \,\in\, \hat{N}} p_i \qquad M_k = \sum_{i \,\in\, \hat{N}} m_{k,i}$$

#### Saúde

Cada feição é uma unidade com categoria `co_tipo_estabelecimento` e colunas de staff `staff_k` ($c_{k,i}$) para cada categoria $k$ (médicos, enfermagem, farmácia etc.):

$$\text{Unidades por tipo} \;t = |\{i \in \hat{N} : \text{tipo}_i = t\}|$$

$$C_k = \sum_{i \,\in\, \hat{N}} c_{k,i} \qquad \%\,\text{staff}_k = \frac{C_{k,\,\hat{N}}}{C_{k,\,N}} \times 100$$

#### Logradouros

Cada feição é um segmento de via. A chave de deduplicação é o par (campo `tipo`, campo `nome`):

$$R = |\{(t_i,\, n_i) : i \in \hat{N}\}|$$

onde $R$ é o número de ruas únicas atingidas. Os flags `drenagem` e `iluminacao` são atributos binários $\{0, 1\}$:

$$F_s = |\{i \in \hat{N} : s_i = 1\}|, \quad s \in \{\text{drenagem},\;\text{iluminacao}\}$$

#### Quadras e Terrenos

Cada feição é uma quadra ou um lote. Contagem simples:

$$\text{Quadras} = |\hat{N}|$$

Para terrenos, os atributos de saneamento são flags binários (`agua`, `coleta_lix`, `esgoto_plu`, `condominio`):

$$F_s = |\{i \in \hat{N} : s_i = 1\}|$$

O tipo de esgoto (`esgoto_clo`) é verificado por equivalência de string — valores aceitos como cloacal: `"esgoto_cloacal"`, `"cloacal"`, `"1"`; valores aceitos como fossa: `"fossa_septica"`, `"fossa"`.

#### Uso e Cobertura da Terra / Agricultura

A área de cada feição vetorial $f_i$ é calculada pelo `@turf/turf` (elipsoide WGS 84, m²) e convertida para hectares:

$$a_i = \frac{\text{area}(f_i)}{10000}$$

Feições com $a_i < 0{,}5\;\text{ha}$ são descartadas (ruído de vetorização do raster MapaBiomas). A área total atingida por classe ou cultura $k$ é:

$$A_k = \sum_{\substack{i \,\in\, \hat{N},\; k_i = k \\ a_i \,\geq\, 0{,}5}} a_i \qquad \%\,\text{área}_k = \frac{A_{k,\,\hat{N}}}{A_{k,\,N}} \times 100$$

#### Patrimônio Histórico

Cada feição é um bem patrimonial (ponto) com os campos `Nome`, `ENDEREÇO` e `Tipologia`. A seleção dos atingidos usa a mesma junção espacial ponto-em-polígono (`intersects`) das demais camadas de ponto. O campo `Tipologia` é normalizado no cliente removendo o prefixo numérico de classificação (ex.: `"6- Arquitetura Civil Privada"` → `"Arquitetura Civil Privada"`), de modo que categorias duplicadas por prefixo sejam agregadas. As métricas são a contagem total e a distribuição por tipologia:

$$\text{Total} = |\hat{N}| \qquad T_k = |\{i \in \hat{N} : \text{tipologia}_i = k\}| \qquad \%\,\text{atingido} = \frac{|\hat{N}|}{|N|} \times 100$$

#### População

Diferente das demais camadas, a população **não** é um recorte vetorial: é uma grade populacional (WorldPop) exibida como *heatmap raster* sobreposto ao mapa. Os valores de população total do município e população atingida por cenário são pré-computados offline e servidos em um único `populacao_atingida.json`:

$$\%\,\text{pop. atingida} = \frac{\text{pop. atingida}}{\text{pop. total}} \times 100$$

O KPI de população é lido diretamente desse JSON (não é recalculado no cliente). A imagem raster (`populacao.png`) é posicionada pelas quatro coordenadas de canto presentes no JSON.

### 3. Formatos de arquivo e desempenho

| Formato | Camadas | Motivo |
|---|---|---|
| `.geojson` | Empresas, Educação, Saúde, Patrimônio Histórico, Logradouros, Prédios Públicos, Segurança, Cenário | Tamanho reduzido, parsing nativo |
| `.fgb` (FlatGeobuf) | Cobertura, Agricultura, Quadras, Terrenos | Streaming binário eficiente para arquivos grandes |
| `.png` + `.json` | População | Imagem raster (heatmap) posicionada por coordenadas de canto + métricas pré-computadas por cenário |

O FlatGeobuf é carregado em stream via `flatgeobuf.geojson.deserialize`, sem necessidade de carregar o arquivo inteiro na memória antes de renderizar. Terrenos (~28 MB) solicita confirmação do usuário antes do carregamento.

Dados de base são carregados uma única vez na inicialização. Dados atingidos são carregados sob demanda a cada troca de cenário, com `AbortController` para cancelar requisições em andamento.

### 4. Renderização e z-order

Camadas renderizadas em ordem crescente de z-index (determinada pela posição no JSX, sem uso de `beforeId`):

1. Polígono de inundação (cenário)
2. Heatmap de População (raster, ao fundo)
3. Uso e cobertura da terra
4. Agricultura
5. Infraestrutura (geometrias fill/line/point selecionadas por filtro de tipo)
6. Empresas, Saúde, Educação, Patrimônio Histórico (pontos clusterizados — renderizados por cima)

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
                      (inclui converter_patrimonio_rio_grande.py)
public/
  dados_convertidos/
    populacao_atingida.json — População total/atingida por cenário + coordenadas do raster
    rio_grande/     — GeoJSON, FGB e populacao.png prontos para consumo pelo browser
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
Dados de grade populacional: [WorldPop](https://www.worldpop.org/).
