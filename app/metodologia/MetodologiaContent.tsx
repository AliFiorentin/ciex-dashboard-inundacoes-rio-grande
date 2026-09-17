import React from "react";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { Section, SubTitle, MathBlock, DataTable, Note, SectionSources } from "@/components/doc-kit";

const PRIMARY = "#1E404A";

const INDICE: [string, string][] = [
  ["#selecao",      "1. Seleção dos Atingidos"],
  ["#indicadores",  "2. Cálculo dos Indicadores por Setor"],
  ["#manchas",      "3. Manchas de Altura da Lâmina d'Água"],
  ["#formatos",     "4. Formatos de Arquivo e Desempenho"],
  ["#renderizacao", "5. Renderização e Z-Order"],
  ["#permalink",    "6. Permalink"],
];

export function MetodologiaContent() {
  return (
    <div className="min-h-screen bg-[#eef3f4] text-slate-800 font-sans">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="text-white px-6 py-10 print:py-5" style={{ backgroundColor: PRIMARY }}>
        <div className="max-w-[1200px] mx-auto">
          <div className="flex items-center gap-2 mb-5 print:hidden">
            <Link href="/" className="text-[10px] font-bold text-white/70 hover:text-white transition-colors px-3 py-1 rounded-full border border-white/20 hover:border-white/40 flex items-center gap-1.5">← Dashboard</Link>
          </div>
          <p className="text-[11px] uppercase tracking-[0.18em] font-semibold opacity-60 mb-2">
            CIEX · GPEA · FURG
          </p>
          <h1 className="text-4xl font-black leading-none mb-2 tracking-tight flex items-center gap-3">
            <BookOpen size={36} strokeWidth={2.5} className="opacity-80 shrink-0" />
            Metodologia
          </h1>
          <p className="text-base opacity-75 font-medium">
            Cruzamento Espacial e Cálculo de Indicadores — Painel de Vulnerabilidade Econômica
          </p>
          <p className="text-[11px] opacity-50 mt-3 font-mono">
            Junção espacial ponto/polígono-em-polígono · pré-computada offline (Python/GeoPandas)
          </p>
        </div>
      </header>

      <div className="max-w-[1200px] mx-auto px-6 py-10 print:py-5 flex gap-8 items-start print:block">
        {/* ── Sidebar (Índice fixo) ────────────────────────────────────────── */}
        <aside className="hidden lg:block w-52 shrink-0 print:hidden">
          <div className="sticky top-[24px] flex flex-col gap-3">
            <nav className="bg-white border border-[#c7d6d9] rounded-xl p-4 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-wider mb-2" style={{ color: PRIMARY }}>Índice</p>
              <ol className="flex flex-col gap-1">
                {INDICE.map(([href, label]) => (
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
          {/* ═══ SEÇÃO 1 — SELEÇÃO DOS ATINGIDOS ═══ */}
          <Section id="selecao" num="1" title="Seleção dos Atingidos (Python / GeoPandas)">
            <p>
              Todos os cruzamentos espaciais são <strong>pré-computados offline</strong> via junção espacial ponto-em-polígono
              (ou polígono-em-polígono), utilizando o predicado <code>intersects</code>:
            </p>
            <MathBlock exprs={[{ tex: "\\text{atingidos} = \\text{gpd.sjoin}(\\text{camada\\_base},\\ \\text{mancha\\_inundacao},\\ \\text{how=\"inner\"},\\ \\text{predicate=\"intersects\"})" }]} />
            <p>
              O resultado — apenas as feições que intersectam a mancha de inundação — é exportado como GeoJSON ou FlatGeobuf
              (<code>.fgb</code>) e servido estaticamente pelo Next.js. <strong>Não há processamento espacial no navegador.</strong>
            </p>
          </Section>

          {/* ═══ SEÇÃO 2 — INDICADORES POR SETOR ═══ */}
          <Section id="indicadores" num="2" title="Cálculo dos Indicadores por Setor">
            <p>
              Notação geral: <em>N</em> = conjunto total de feições no município; <em>N̂ ⊆ N</em> = conjunto das feições
              atingidas pelo cenário selecionado. O percentual de impacto para qualquer métrica <em>m</em> é:
            </p>
            <MathBlock exprs={[{ tex: "\\%\\,\\text{atingido} = \\frac{m_{\\hat{N}}}{m_N} \\times 100" }]} />

            <SubTitle>Empresas</SubTitle>
            <p>Cada feição é um estabelecimento com os campos <code>Empregados</code> (E), <code>Massa_Salarial</code> (W) e <code>Média Salarial</code> (S̄):</p>
            <MathBlock exprs={[
              { label: "Estabelecimentos", tex: "\\text{Estabelecimentos} = |\\hat{N}|" },
              { label: "Vínculos / Massa / Média", tex: "\\text{Vínculos} = \\sum_{i\\in\\hat{N}} E_i \\quad \\text{Massa} = \\sum_{i\\in\\hat{N}} W_i \\quad \\text{Média} = \\frac{1}{|\\hat{N}|}\\sum_{i\\in\\hat{N}} \\bar{S}_i" },
            ]} />

            <SubTitle>Educação</SubTitle>
            <p>Cada feição é uma escola com <code>qtd_prof</code> (p) e <code>qtd_matri_k</code> (m) por modalidade k ∈ {"{"}infantil, fundamental, médio, profissional, EJA, especial{"}"}:</p>
            <MathBlock exprs={[{ tex: "P = \\sum_{i\\in\\hat{N}} p_i \\qquad M_k = \\sum_{i\\in\\hat{N}} m_{k,i}" }]} />

            <SubTitle>Saúde</SubTitle>
            <p>Cada feição é uma unidade com categoria <code>co_tipo_estabelecimento</code> e colunas de staff por categoria k (médicos, enfermagem, farmácia etc.):</p>
            <MathBlock exprs={[
              { label: "Unidades por tipo", tex: "\\text{Unidades}_t = |\\{i \\in \\hat{N} : \\text{tipo}_i = t\\}|" },
              { label: "Staff / % staff", tex: "C_k = \\sum_{i\\in\\hat{N}} c_{k,i} \\qquad \\%\\,\\text{staff}_k = \\frac{C_{k,\\hat{N}}}{C_{k,N}} \\times 100" },
            ]} />

            <SubTitle>Logradouros</SubTitle>
            <p>Cada feição é um segmento de via; a chave de deduplicação é o par (<code>tipo</code>, <code>nome</code>):</p>
            <MathBlock exprs={[
              { label: "Ruas únicas", tex: "R = |\\{(t_i, n_i) : i \\in \\hat{N}\\}|" },
              { label: "Flags binários", tex: "F_s = |\\{i \\in \\hat{N} : s_i = 1\\}|,\\quad s \\in \\{\\text{drenagem}, \\text{iluminacao}\\}" },
            ]} />

            <SubTitle>Quadras e Terrenos</SubTitle>
            <p>Contagem simples de quadras; para terrenos os atributos de saneamento (<code>agua</code>, <code>coleta_lix</code>, <code>esgoto_plu</code>, <code>condominio</code>) são flags binários:</p>
            <MathBlock exprs={[{ tex: "\\text{Quadras} = |\\hat{N}| \\qquad F_s = |\\{i \\in \\hat{N} : s_i = 1\\}|" }]} />
            <Note type="info">
              O tipo de esgoto (<code>esgoto_clo</code>) é verificado por equivalência de string — cloacal: <code>&quot;esgoto_cloacal&quot;</code>, <code>&quot;cloacal&quot;</code>, <code>&quot;1&quot;</code>; fossa: <code>&quot;fossa_septica&quot;</code>, <code>&quot;fossa&quot;</code>.
            </Note>

            <SubTitle>Uso e Cobertura da Terra / Agricultura</SubTitle>
            <p>A área de cada feição vetorial é calculada pelo <code>@turf/turf</code> (elipsoide WGS 84, m²) e convertida para hectares:</p>
            <MathBlock exprs={[
              { label: "Área (ha)", tex: "a_i = \\frac{\\text{area}(f_i)}{10000}" },
              { label: "Área por classe/cultura", tex: "A_k = \\sum_{i\\in\\hat{N},\\ k_i=k,\\ a_i\\geq 0{,}5} a_i \\qquad \\%\\,\\text{área}_k = \\frac{A_{k,\\hat{N}}}{A_{k,N}} \\times 100" },
            ]} />
            <Note type="warning">Feições com área &lt; 0,5 ha são descartadas — ruído de vetorização do raster MapaBiomas.</Note>

            <SubTitle>Patrimônio Histórico</SubTitle>
            <p>
              Cada feição é um bem patrimonial (ponto) com <code>Nome</code>, <code>ENDEREÇO</code> e <code>Tipologia</code>, selecionado pela
              mesma junção ponto-em-polígono das demais camadas. O campo <code>Tipologia</code> é normalizado no cliente removendo o
              prefixo numérico de classificação (ex.: &quot;6- Arquitetura Civil Privada&quot; → &quot;Arquitetura Civil Privada&quot;).
            </p>
            <MathBlock exprs={[{ tex: "\\text{Total} = |\\hat{N}| \\qquad T_k = |\\{i \\in \\hat{N} : \\text{tipologia}_i = k\\}| \\qquad \\%\\,\\text{atingido} = \\frac{|\\hat{N}|}{|N|} \\times 100" }]} />

            <SubTitle>População</SubTitle>
            <p>
              Diferente das demais camadas, a população <strong>não</strong> é um recorte vetorial: é uma grade populacional
              (WorldPop) exibida como <em>heatmap raster</em> sobreposto ao mapa. Os valores de população total e atingida por
              cenário são pré-computados offline e servidos em <code>populacao_atingida.json</code>.
            </p>
            <MathBlock exprs={[{ tex: "\\%\\,\\text{pop. atingida} = \\frac{\\text{pop. atingida}}{\\text{pop. total}} \\times 100" }]} />
            <Note type="info">
              O KPI de população é lido diretamente do JSON (não recalculado no cliente). A camada não tem botão de alternância
              no cabeçalho: é um fundo permanente, identificado pela legenda (gradiente de densidade) e pelo KPI no painel.
            </Note>

            <SectionSources links={[
              ["RAIS (MTE) — vínculos empregatícios", ""],
              ["Censo Escolar (INEP)", ""],
              ["CNES — Ministério da Saúde", ""],
              ["MapaBiomas Coleção 10 (2024)", "https://mapbiomas.org/"],
              ["WorldPop — grade populacional", "https://www.worldpop.org/"],
            ]} />
          </Section>

          {/* ═══ SEÇÃO 3 — MANCHAS DE ALTURA ═══ */}
          <Section id="manchas" num="3" title="Manchas de Altura da Lâmina d'Água (Nível da Lagoa + Chuva Acumulada)">
            <p>
              Cenário adicional que combina duas simulações entregues como rasters de profundidade por bacia hidrográfica
              (plataforma Economia Azul — GPEA/FURG), tratado como um cenário comum no restante do pipeline — mesma junção
              espacial <code>intersects</code>/<code>overlay</code> e mesmos indicadores por setor da Seção 2. A área atingida
              final é a <strong>união</strong> das duas simulações.
            </p>

            <SubTitle>Nível da Lagoa – 16/05/2024, 20h</SubTitle>
            <p>Mosaico dos rasters de profundidade das bacias 1–5 e 7 (EPSG:31982, ~1 m/pixel). Rampa de cor (classificação discreta):</p>
            <DataTable rows={[
              ["Faixa (cm)", "Cor"],
              ["< 45", "transparente"],
              ["45 – 64", "#4b0082 (índigo)"],
              ["65 – 84", "#00ffff (ciano)"],
              ["85 – 104", "#00ff00 (verde)"],
              ["105 – 124", "#ffff00 (amarelo)"],
              ["125 – 144", "#ff7f00 (laranja)"],
              ["≥ 145", "#ff0000 (vermelho)"],
            ]} />
            <p>O limiar <strong>≥ 45 cm</strong> (primeira classe visível) entra na área atingida.</p>

            <SubTitle>Chuva Acumulada – 60,8 mm</SubTitle>
            <p>
              Simulação de acúmulo de água de chuva sobre a área urbana central. O pixel armazena um valor de saída do modelo
              (&quot;valor19&quot;), classificado de forma quase binária: valor &lt; 86 → transparente; <strong>86–253 → lilás
              #ba82e6 (visível)</strong>; ≥ 254 → transparente (interpretado como água pré-existente). O corte inferior (86)
              corresponde a ≈10 cm de lâmina d&apos;água.
            </p>

            <SubTitle>Combinação</SubTitle>
            <p>
              As duas simulações são reprojetadas para uma grade compartilhada. A área atingida final é a união booleana das
              duas máscaras (Lagoa ≥45cm OR Chuva 86–253) — vetorizada, dissolvida e simplificada. No raster visual, a
              classificação de profundidade da Lagoa tem <strong>prioridade</strong> onde as duas simulações se sobrepõem.
            </p>
          </Section>

          {/* ═══ SEÇÃO 4 — FORMATOS DE ARQUIVO ═══ */}
          <Section id="formatos" num="4" title="Formatos de Arquivo e Desempenho">
            <DataTable rows={[
              ["Formato", "Camadas", "Motivo"],
              [".geojson", "Empresas, Educação, Saúde, Patrimônio Histórico, Logradouros, Prédios Públicos, Segurança, Cenário", "Tamanho reduzido, parsing nativo"],
              [".fgb (FlatGeobuf)", "Cobertura, Agricultura, Quadras, Terrenos", "Streaming binário eficiente para arquivos grandes"],
              [".png + .json", "População", "Imagem raster (heatmap) posicionada por coordenadas de canto + métricas pré-computadas"],
            ]} />
            <p>
              O FlatGeobuf é carregado em stream via <code>flatgeobuf.geojson.deserialize</code>, sem necessidade de carregar o
              arquivo inteiro na memória antes de renderizar. Terrenos (~28 MB) solicita confirmação do usuário antes do carregamento.
            </p>
            <Note type="info">
              Dados de base são carregados uma única vez na inicialização. Dados atingidos são carregados sob demanda a cada
              troca de cenário, com <code>AbortController</code> para cancelar requisições em andamento.
            </Note>
          </Section>

          {/* ═══ SEÇÃO 5 — RENDERIZAÇÃO E Z-ORDER ═══ */}
          <Section id="renderizacao" num="5" title="Renderização e Z-Order">
            <p>Camadas renderizadas em ordem crescente de z-index (determinada pela posição no JSX, sem uso de <code>beforeId</code>):</p>
            <ol className="list-decimal list-inside space-y-1 ml-1">
              <li>Polígono de inundação (cenário)</li>
              <li>Heatmap de População (raster, ao fundo)</li>
              <li>Uso e cobertura da terra</li>
              <li>Agricultura</li>
              <li>Infraestrutura (geometrias fill/line/point selecionadas por filtro de tipo)</li>
              <li>Empresas, Saúde, Educação, Patrimônio Histórico (pontos clusterizados — renderizados por cima)</li>
            </ol>
            <p>
              Pontos são clusterizados automaticamente pelo MapLibre GL (raio 50 px). A bounding box da mancha ativa é
              calculada via <code>turf.bbox</code> para reposicionamento automático do mapa.
            </p>
          </Section>

          {/* ═══ SEÇÃO 6 — PERMALINK ═══ */}
          <Section id="permalink" num="6" title="Permalink">
            <p>
              O cenário ativo é persistido na URL via <code>?cenario=&lt;código&gt;</code> usando <code>history.replaceState</code>,
              junto com <code>lat</code>/<code>lng</code>/<code>zoom</code> para a posição do mapa. O código de cada cenário é um
              identificador curto e legível, independente do slug interno usado nos nomes de arquivo — desacoplando a estética
              do link compartilhável da convenção de nomenclatura dos dados. O código é lido por <code>ref</code> na
              inicialização (não em <code>useEffect</code>) para evitar re-renderizações desnecessárias e estar disponível a
              tempo de influenciar a primeira carga de dados.
            </p>
          </Section>

          <p className="text-[9px] italic mt-3 pt-2 border-t" style={{ color: PRIMARY, borderColor: "#c7d6d9" }}>
            Fonte: README do Dashboard CIEX — pipeline de dados e convenções técnicas.
          </p>
        </main>
      </div>
    </div>
  );
}
