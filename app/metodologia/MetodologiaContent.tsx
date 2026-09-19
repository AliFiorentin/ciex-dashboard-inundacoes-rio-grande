import React from "react";
import Link from "next/link";
import { BookOpen, TrendingDown } from "lucide-react";
import { Section, SubTitle, MathBlock, DataTable, Note, SectionSources, ExtLink, Math, GeoCard, RefBlock, RefItem } from "@/components/doc-kit";
import { HeaderLogos } from "@/components/HeaderLogos";

const PRIMARY = "#1E404A";

const INDICE: [string, string][] = [
  ["#manchas",        "1. Manchas de Inundação"],
  ["#sobreposicao",   "2. Sobreposição Espacial"],
  ["#empresas",       "3. Empresas"],
  ["#agricultura",    "4. Agricultura e Cobertura da Terra"],
  ["#educacao",       "5. Educação"],
  ["#saude",          "6. Saúde"],
  ["#patrimonio",     "7. Patrimônio Histórico"],
  ["#infraestrutura", "8. Infraestrutura"],
  ["#populacao",      "9. População Exposta"],
  ["#perdas",         "10. Perdas Operacionais (DaLA)"],
  ["#fontes",         "11. Fontes e Referências"],
];

export function MetodologiaContent() {
  return (
    <div className="min-h-screen bg-[#eef3f4] text-slate-800 font-sans">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="text-white px-6 py-10 print:py-5" style={{ backgroundColor: PRIMARY }}>
        <div className="max-w-[1200px] mx-auto flex items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-5 print:hidden">
              <Link href="/" className="text-[10px] font-bold text-white/70 hover:text-white transition-colors px-3 py-1 rounded-full border border-white/20 hover:border-white/40 flex items-center gap-1.5">← Dashboard</Link>
              <Link href="/perdas" className="text-[10px] font-bold text-white/70 hover:text-white transition-colors px-3 py-1 rounded-full border border-white/20 hover:border-white/40 flex items-center gap-1.5">Perdas Operacionais →</Link>
            </div>
            <p className="text-[11px] uppercase tracking-[0.18em] font-semibold opacity-60 mb-2">
              CIEX · GPEA · FURG
            </p>
            <h1 className="text-4xl font-black leading-none mb-2 tracking-tight flex items-center gap-3">
              <BookOpen size={36} strokeWidth={2.5} className="opacity-80 shrink-0" />
              Metodologia
            </h1>
            <p className="text-base opacity-75 font-medium">
              Avaliação de Vulnerabilidade Econômica a Inundações: Rio Grande (RS)
            </p>
            <p className="text-[11px] opacity-50 mt-3 font-mono">
              Cenários de Maio/2024 e Setembro/2023 · Município de Rio Grande
            </p>
          </div>
          <HeaderLogos />
        </div>
      </header>

      <div className="max-w-[1200px] mx-auto px-6 py-10 print:py-5 flex gap-8 items-start print:block">
        {/* ── Sidebar (Índice fixo) ────────────────────────────────────────── */}
        <aside className="hidden lg:block w-52 shrink-0 print:hidden">
          <div className="sticky top-6 flex flex-col gap-3">
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

        <main className="flex-1 min-w-0 print:py-0">

          {/* ── Contexto ──────────────────────────────────────────────────── */}
          <div className="bg-white border border-[#c7d6d9] rounded-xl p-5 mb-8 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-wider mb-2" style={{ color: PRIMARY }}>Contexto</p>
            <p className="text-sm leading-relaxed text-slate-700 mt-2">
              A metodologia distingue dois planos analíticos: (a) a <strong>exposição física</strong>:
              identificação de estabelecimentos, escolas, unidades de saúde, bens de patrimônio histórico,
              infraestrutura urbana e áreas agrícolas dentro da mancha de inundação de cada cenário; e (b) as{" "}
              <strong>perdas econômicas operacionais</strong>: estimativa do fluxo de produção e serviços
              não realizado durante o período de interrupção, seguindo a abordagem DaLA (CEPAL/BID).
              Todo o processamento espacial é <strong>pré-computado offline</strong> em Python; o painel
              web apenas renderiza os arquivos estáticos resultantes.
            </p>
          </div>

          {/* ═══ 1. MANCHAS ═══ */}
          <Section id="manchas" num="1" title="Manchas de Inundação: Definição dos Cenários">
            <p>
              As manchas de inundação são <strong>polígonos vetoriais que delimitam a extensão geográfica
              de cada evento</strong> em Rio Grande/RS, elaborados a partir de modelagem hidrológica e
              hidráulica costeira pelo CIEX/FURG.
            </p>
            <DataTable rows={[
              ["Cenário", "Referência temporal", "Descrição"],
              ["Cenário Setembro 2023", "Setembro 2023", "Evento de menor magnitude, anterior ao de maio de 2024"],
              ["Cenário Maio 2024", "Maio 2024", "Extensão modelada para o evento de maio"],
              ["Cenário Maio 2024 + 50%", "Maio 2024, extensão ampliada", "Extensão hipotética com 50% de área adicional (análise de sensibilidade)"],
              ["Nível da Lagoa + Chuva Acumulada", "16/05/2024, 20h", "União de duas simulações por bacia hidrográfica (ver detalhe abaixo)"],
            ]} />

            <SubTitle>Nível da Lagoa + Chuva Acumulada: um cenário combinado</SubTitle>
            <p>
              Cenário adicional que combina duas simulações entregues como rasters de profundidade por
              bacia hidrográfica pelo GPEA/FURG, tratado como um cenário comum no restante do pipeline,
              mesma junção espacial e mesmos indicadores por setor das Seções seguintes. A área atingida
              final é a <strong>união</strong> das duas simulações.
            </p>
            <DataTable rows={[
              ["Simulação", "Fonte", "Limiar de área atingida"],
              ["Nível da Lagoa – 16/05/2024, 20h", "Mosaico de rasters de profundidade das bacias 1–5 e 7 (~1 m/pixel)", "≥ 45 cm (primeira classe visível do estilo QGIS)"],
              ["Chuva Acumulada – 60,8 mm", "Mosaico de rasters das bacias 1–5 (saída de modelo, não em cm)", "Valor 86–253 (≈ 10 cm de lâmina d'água)"],
            ]} />
            <Note type="info">
              No raster visual, a classificação de profundidade da Lagoa tem <strong>prioridade</strong> onde
              as duas simulações se sobrepõem: o lilás da Chuva Acumulada só aparece onde a Lagoa não tem
              cobertura. Este é o único cenário exibido como imagem raster colorida (preservando o gradiente
              de classificação), em vez de preenchimento de cor única + contorno.
            </Note>

            <SubTitle>Sistema de Referência de Coordenadas (CRS)</SubTitle>
            <DataTable rows={[
              ["CRS", "EPSG", "Uso no pipeline"],
              ["WGS 84 / Geográfico", "4326", "Manchas, GeoJSON de saída e renderização no MapLibre GL"],
              ["SIRGAS 2000 / UTM Zone 22S", "31982", "Shapefiles de origem da Prefeitura de Rio Grande (Logradouros, Quadras, Terrenos)"],
            ]} />
            <p className="text-[12px] text-slate-500">
              Diferente do cálculo de área em Python via reprojeção métrica, as camadas de polígono
              (Agricultura, Uso e Cobertura da Terra) têm a área calculada no cliente com{" "}
              <code>@turf/turf</code>, que opera diretamente sobre coordenadas geográficas (elipsoide
              WGS 84) sem necessidade de reprojeção para um CRS métrico.
            </p>
            <SectionSources links={[
              ["CIEX/FURG: Centro de Inteligência em Eventos Extremos", "https://ciex.furg.br"],
            ]} />
          </Section>

          {/* ═══ 2. SOBREPOSIÇÃO ESPACIAL ═══ */}
          <Section id="sobreposicao" num="2" title="Sobreposição Espacial: Cálculo dos Atingidos">
            <p>
              A identificação dos elementos atingidos é feita por <strong>sobreposição espacial</strong>{" "}
              entre cada camada de feições georreferenciadas <Math tex="F_i" /> e o polígono da mancha de
              inundação <Math tex="M" /> do cenário selecionado, via junção espacial (predicado{" "}
              <em>intersects</em>) com <ExtLink href="https://geopandas.org">GeoPandas</ExtLink> em
              Python, offline. O conjunto das feições atingidas é definido por:
            </p>
            <MathBlock exprs={[{ label: "Conjunto atingido", tex: "\\hat{N} = \\{\\, i \\in N \\;:\\; F_i \\cap M \\neq \\emptyset \\,\\}" }]} />
            <SubTitle>Método por tipo de geometria</SubTitle>
            <DataTable rows={[
              ["Geometria", "Camadas", "Predicado", "Resultado"],
              ["Ponto", "Empresas · Escolas · Unidades de Saúde · Patrimônio Histórico", "intersects", "Ponto dentro do polígono da mancha"],
              ["Polígono", "Quadras · Terrenos · Agricultura · Uso e Cobertura da Terra", "intersects + área()", "Área de interseção em ha (turf, WGS 84)"],
              ["Linha", "Logradouros", "intersects + dedup", "Segmentos e ruas únicas atingidas"],
            ]} />

            <GeoCard title="Pontos: Empresas · Escolas · Unidades de Saúde · Patrimônio Histórico" operation='geopandas.sjoin(predicate="intersects")'>
              <p className="text-sm mb-2" style={{ color: PRIMARY }}>
                Um ponto <Math tex="p_i" /> é atingido se está contido no polígono da mancha{" "}
                <Math tex="M" /> do cenário selecionado:
              </p>
              <MathBlock exprs={[{ tex: "\\text{atingido}(p_i) = \\mathbf{1}[\\,p_i \\in M\\,]" }]} />
            </GeoCard>
            <GeoCard title="Polígonos: Quadras · Terrenos · Agricultura · Uso e Cobertura da Terra" operation='sjoin(predicate="intersects") → area(F) em turf (WGS 84)'>
              <p className="text-sm mb-2" style={{ color: PRIMARY }}>
                Um polígono <Math tex="F_i" /> é atingido se sua interseção com a mancha é não vazia; a
                área atingida é calculada em hectares com <code>@turf/turf</code>:
              </p>
              <MathBlock exprs={[
                { tex: "\\text{atingido}(F_i) = \\mathbf{1}[\\,\\mathcal{A}(F_i \\cap M) > 0\\,]" },
                { label: "Área atingida [ha]", tex: "a_i = \\frac{\\mathcal{A}(F_i \\cap M)}{10000}" },
              ]} />
            </GeoCard>
            <GeoCard title="Linhas: Logradouros" operation='sjoin(predicate="intersects") → deduplicação por (tipo, nome)'>
              <p className="text-sm mb-2" style={{ color: PRIMARY }}>
                Um segmento <Math tex="L_i" /> é atingido se intersecta a mancha; a contagem de{" "}
                <em>ruas únicas</em> deduplica segmentos do mesmo logradouro pelo par (tipo, nome):
              </p>
              <MathBlock exprs={[
                { tex: "\\text{atingido}(L_i) = \\mathbf{1}[\\,L_i \\cap M \\neq \\emptyset\\,]" },
                { label: "Ruas únicas", tex: "R = |\\{(t_i, n_i) : i \\in \\hat{N}\\}|" },
              ]} />
            </GeoCard>

            <SubTitle>Notação geral</SubTitle>
            <p>
              <Math tex="N" /> = conjunto total de feições no município; <Math tex="\hat{N} \subseteq N" /> =
              conjunto das feições atingidas pelo cenário selecionado. O percentual de impacto para
              qualquer métrica <Math tex="m" /> é:
            </p>
            <MathBlock exprs={[{ tex: "\\%\\,\\text{atingido} = \\frac{m_{\\hat{N}}}{m_N} \\times 100" }]} />
            <SectionSources links={[
              ["GeoPandas Documentation", "https://geopandas.org/en/stable/docs.html"],
              ["Shapely Documentation", "https://shapely.readthedocs.io"],
              ["Turf.js Documentation", "https://turfjs.org"],
            ]} />
          </Section>

          {/* ═══ 3. EMPRESAS ═══ */}
          <Section id="empresas" num="3" title="Empresas: Estabelecimentos Formais Atingidos">
            <p>
              O painel quantifica a exposição física dos estabelecimentos do setor formal, com base na{" "}
              <ExtLink href="https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/estatisticas-trabalho/rais">
                RAIS: Relação Anual de Informações Sociais (MTE)
              </ExtLink>. Cada estabelecimento é georreferenciado a partir do endereço constante na
              própria RAIS, geocodificado via instância local do{" "}
              <ExtLink href="https://nominatim.org">Nominatim</ExtLink> (OpenStreetMap).
            </p>
            <SubTitle>Dados base</SubTitle>
            <p>
              Os vínculos ativos da RAIS são filtrados para o município de Rio Grande (código IBGE de
              6 dígitos). Variáveis extraídas por estabelecimento no GeoJSON processado:
            </p>
            <DataTable rows={[
              ["Campo", "Uso no painel"],
              ["Endereço (rua, número, bairro, CEP)", "Endereço do estabelecimento na RAIS → composição do endereço para geocodificação"],
              ["Endereço para geocodificação", "Endereço normalizado enviado ao geocodificador"],
              ["Setor (seção CNAE 2.0)", "Classificação setorial (donut e barras por setor)"],
              ["Empregados", "Vínculos ativos = empregados expostos"],
              ["Massa salarial", "Soma = folha salarial do estabelecimento"],
              ["Salário médio", "Salário médio do estabelecimento → média simples entre atingidos"],
            ]} />
            <SubTitle>Georreferenciação dos endereços</SubTitle>
            <p>
              O endereço de cada estabelecimento é composto a partir dos campos da RAIS no formato{" "}
              <code>rua, número, bairro, CEP, Rio Grande - RS</code> (campo <code>endereco_geocode</code>)
              e convertido em coordenadas geográficas (lat/lon, EPSG:4326) por uma instância local do{" "}
              <ExtLink href="https://nominatim.org">Nominatim</ExtLink> (OpenStreetMap). As coordenadas
              obtidas são validadas pelo <em>bounding box</em> do Rio Grande do Sul (lat ∈ [−34°, −27°],
              lon ∈ [−58°, −49°]) e armazenadas em cache para reuso.
            </p>
            <Note type="info">
              Estabelecimentos sem endereço geocodificável (endereços incompletos, caixas postais ou
              zona rural sem numeração) não são mapeados e ficam fora da contagem de estabelecimentos
              expostos: o painel representa, portanto, o universo geocodificado da RAIS, não o total
              de vínculos do município.
            </Note>
            <SubTitle>Indicadores calculados</SubTitle>
            <p>
              Cada feição é um estabelecimento com os campos <code>Empregados</code> (
              <Math tex="E_i" />), <code>Massa_Salarial</code> (<Math tex="W_i" />) e{" "}
              <code>Média Salarial</code> (<Math tex="\bar{S}_i" />).
            </p>
            <MathBlock exprs={[
              { label: "Estabelecimentos", tex: "\\text{Estabelecimentos} = |\\hat{N}|" },
              { label: "Vínculos / Massa / Média", tex: "\\text{Vínculos} = \\sum_{i\\in\\hat{N}} E_i \\quad \\text{Massa} = \\sum_{i\\in\\hat{N}} W_i \\quad \\text{Média} = \\frac{1}{|\\hat{N}|}\\sum_{i\\in\\hat{N}} \\bar{S}_i" },
            ]} />
            <SubTitle>Classificação setorial (CNAE 2.0)</SubTitle>
            <p>
              A distribuição de empresas e empregados por setor no painel usa as 19 seções da CNAE 2.0
              (ex.: Comércio; Reparação de Veículos, Indústrias de Transformação, Saúde Humana e Serviços
              Sociais), exibidas com acentuação e capitalização normalizadas a partir do valor bruto da RAIS.
            </p>
            <DataTable rows={[
              ["Fonte", "Referência", "Variáveis utilizadas"],
              ["RAIS (MTE)", "Ano-base mais recente disponível", "Empregados, massa salarial, salário médio, seção CNAE, endereço"],
              ["OpenStreetMap / Nominatim", "—", "Geocodificação dos endereços (instância local)"],
            ]} />
            <SectionSources links={[
              ["RAIS: Microdados MTE", "https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/estatisticas-trabalho/rais"],
              ["Nominatim: OpenStreetMap Geocoder", "https://nominatim.org"],
            ]} />
          </Section>

          {/* ═══ 4. AGRICULTURA E COBERTURA ═══ */}
          <Section id="agricultura" num="4" title="Agricultura e Uso e Cobertura da Terra">
            <p>
              A área de cada feição vetorial é calculada pelo <code>@turf/turf</code> (elipsoide WGS 84,
              m²) e convertida para hectares, a partir do{" "}
              <ExtLink href="https://brasil.mapbiomas.org/colecoes-mapbiomas-1/">
                MapaBiomas Coleção 10 (2024)
              </ExtLink>:
            </p>
            <MathBlock exprs={[
              { label: "Área (ha)", tex: "a_i = \\frac{\\text{area}(f_i)}{10000}" },
              { label: "Área por classe/cultura", tex: "A_k = \\sum_{i\\in\\hat{N},\\ k_i=k,\\ a_i\\geq 0{,}5} a_i \\qquad \\%\\,\\text{área}_k = \\frac{A_{k,\\hat{N}}}{A_{k,N}} \\times 100" },
            ]} />
            <Note type="warning">
              Feições com área &lt; 0,5 ha são descartadas: ruído de vetorização do raster MapaBiomas.
            </Note>
            <DataTable rows={[
              ["Camada", "Classes"],
              ["Agricultura", "Soja, Arroz, Outras Lavouras Temporárias"],
              ["Uso e Cobertura da Terra", "Silvicultura, Campo Alagado e Área Pantanosa, Formação Campestre, Mosaico de Usos, Restinga Arbórea, Restinga Herbácea"],
            ]} />
            <SectionSources links={[
              ["MapaBiomas: Coleção 10", "https://brasil.mapbiomas.org/colecoes-mapbiomas-1/"],
            ]} />
          </Section>

          {/* ═══ 5. EDUCAÇÃO ═══ */}
          <Section id="educacao" num="5" title="Educação: Estrutura Atingida">
            <p>
              O painel mapeia a infraestrutura educacional da educação básica, com base no{" "}
              <ExtLink href="https://www.gov.br/inep/pt-br/areas-de-atuacao/pesquisas-estatisticas-e-indicadores/censo-escolar">
                Censo Escolar (INEP)
              </ExtLink>. Cada feição é uma escola com <code>qtd_prof</code> (<Math tex="p" />) e{" "}
              <code>qtd_matri_k</code> (<Math tex="m" />) por modalidade <Math tex="k" /> ∈ {"{"}infantil,
              fundamental, médio, profissional, EJA, especial{"}"}.
            </p>
            <SubTitle>Indicadores de exposição</SubTitle>
            <DataTable rows={[
              ["Indicador", "Descrição"],
              ["Escolas atingidas", "Estabelecimentos com ponto geocodificado dentro da mancha"],
              ["Professores atingidos", "Soma do número de professores nas escolas atingidas"],
              ["Matrículas por modalidade", "Infantil, Fundamental, Médio, Profissional, EJA, Especial"],
              ["Dependência administrativa", "Federal / Estadual / Municipal / Privada"],
            ]} />
            <MathBlock exprs={[{ tex: "P = \\sum_{i\\in\\hat{N}} p_i \\qquad M_k = \\sum_{i\\in\\hat{N}} m_{k,i}" }]} />
            <SubTitle>Dependência administrativa</SubTitle>
            <DataTable rows={[
              ["Código", "Dependência"],
              ["1", "Federal"],
              ["2", "Estadual"],
              ["3", "Municipal"],
              ["4", "Privada"],
            ]} />
            <SubTitle>Georreferenciação das escolas</SubTitle>
            <p>
              O Censo Escolar fornece latitude e longitude para a maioria dos estabelecimentos. Para
              escolas sem coordenadas na base INEP, o endereço (<code>ds_endereco</code>,{" "}
              <code>nu_endereco</code>, <code>no_bairro</code>, <code>co_cep</code>) é composto no campo{" "}
              <code>endereco_geocode</code> e geocodificado via{" "}
              <ExtLink href="https://nominatim.org">Nominatim</ExtLink> (OpenStreetMap). As coordenadas
              são validadas pelo <em>bounding box</em> do Rio Grande do Sul antes do uso.
            </p>
            <SubTitle>Origem dos dados</SubTitle>
            <DataTable rows={[
              ["Fonte", "Referência temporal", "Variáveis"],
              ["INEP (Censo Escolar)", "Ano-base mais recente disponível", "Escolas, professores, matrículas por modalidade, dependência, coordenadas"],
              ["OpenStreetMap / Nominatim", "—", "Geocodificação de escolas sem coordenada na base INEP"],
            ]} />
            <SectionSources links={[
              ["INEP: Censo Escolar", "https://www.gov.br/inep/pt-br/areas-de-atuacao/pesquisas-estatisticas-e-indicadores/censo-escolar"],
              ["Nominatim: OpenStreetMap Geocoder", "https://nominatim.org"],
            ]} />
          </Section>

          {/* ═══ 6. SAÚDE ═══ */}
          <Section id="saude" num="6" title="Saúde: Capacidade Instalada Atingida">
            <p>
              O painel quantifica a capacidade instalada do sistema de saúde, com base no{" "}
              <ExtLink href="https://cnes.datasus.gov.br">
                CNES: Cadastro Nacional de Estabelecimentos de Saúde (DataSUS)
              </ExtLink>. Cada feição é uma unidade com categoria <code>co_tipo_estabelecimento</code> e
              colunas de staff por categoria <Math tex="k" />.
            </p>
            <SubTitle>Tipos de estabelecimento (Rio Grande)</SubTitle>
            <DataTable rows={[
              ["Tipo", "Observação"],
              ["Ambulatório", "Tipo mais frequente na base municipal"],
              ["Unidade Básica de Saúde", "Atenção primária"],
              ["Hospital", "Internação geral"],
              ["Unidade de Apoio Diagnóstico", "Exames e diagnósticos"],
              ["Unidade de Terapias Especiais", "Terapias especializadas"],
              ["Laboratório de Saúde Pública", "Análises clínicas"],
              ["Central de Gestão em Saúde", "Gestão/coordenação"],
              ["Unidade de Vigilância de Zoonoses", "Vigilância sanitária"],
            ]} />
            <MathBlock exprs={[
              { label: "Unidades por tipo", tex: "\\text{Unidades}_t = |\\{i \\in \\hat{N} : \\text{tipo}_i = t\\}|" },
              { label: "Staff / % staff", tex: "C_k = \\sum_{i\\in\\hat{N}} c_{k,i} \\qquad \\%\\,\\text{staff}_k = \\frac{C_{k,\\hat{N}}}{C_{k,N}} \\times 100" },
            ]} />
            <SubTitle>Categorias de profissionais</SubTitle>
            <DataTable rows={[
              ["Categoria no painel", "Exemplos de ocupações"],
              ["Médicos", "Clínicos, cirurgiões, especialistas"],
              ["Enfermagem", "Enfermeiros, técnicos e auxiliares"],
              ["Odontologia", "Cirurgiões-dentistas, técnicos em saúde bucal"],
              ["Farmácia", "Farmacêuticos e auxiliares"],
              ["Diag/Imagem", "Técnicos em radiologia, biomédicos, laboratoristas"],
              ["ACS/Endemias", "Agentes Comunitários de Saúde, agentes de endemias"],
              ["Transporte", "Socorristas, condutores de ambulância (urgência)"],
              ["Admin/Gestão", "Auxiliares administrativos, recepcionistas"],
              ["Serviços Gerais", "Higienização, limpeza, manutenção"],
              ["Outros (Sup.)", "Psicólogos, fisioterapeutas, nutricionistas"],
              ["Outros", "Ocupações não classificadas nas categorias anteriores"],
            ]} />
            <Note type="info">
              O CNES processado para o CIEX já traz o quadro de pessoal agrupado nessas 11 categorias
              (colunas <code>staff_*</code>), em vez dos códigos CBO de 4 dígitos individuais.
            </Note>
            <SubTitle>Georreferenciação das unidades</SubTitle>
            <p>
              O CNES registra a localização de cada estabelecimento por latitude/longitude, quando
              disponível diretamente na fonte. O endereço (<code>rua</code>, <code>numero</code>,{" "}
              <code>bairro</code>, <code>cep</code>) é mantido no campo <code>endereco_geocode</code> e,
              para unidades sem coordenada, é geocodificado via{" "}
              <ExtLink href="https://nominatim.org">Nominatim</ExtLink> (OpenStreetMap), com validação
              pelo <em>bounding box</em> do Rio Grande do Sul.
            </p>
            <SubTitle>Origem dos dados</SubTitle>
            <DataTable rows={[
              ["Fonte", "Referência temporal", "Variáveis"],
              ["CNES (DataSUS)", "Referência mais recente disponível", "Tipo de estabelecimento, coordenadas, quadro de pessoal por categoria"],
              ["OpenStreetMap / Nominatim", "—", "Geocodificação de unidades sem coordenada no CNES"],
            ]} />
            <SectionSources links={[
              ["CNES: DataSUS", "https://cnes.datasus.gov.br"],
            ]} />
          </Section>

          {/* ═══ 7. PATRIMÔNIO HISTÓRICO ═══ */}
          <Section id="patrimonio" num="7" title="Patrimônio Histórico">
            <p>
              Cada feição é um bem patrimonial (ponto) com <code>Nome</code>, <code>ENDEREÇO</code> e{" "}
              <code>Tipologia</code>, do Levantamento de Patrimônio Histórico de Rio Grande/RS (355
              pontos), selecionado pela mesma junção ponto-em-polígono das demais camadas de ponto.
            </p>
            <p>
              O campo <code>Tipologia</code> é normalizado no cliente removendo o prefixo numérico de
              classificação (ex.: &quot;6- Arquitetura Civil Privada&quot; → &quot;Arquitetura Civil
              Privada&quot;), de modo que categorias duplicadas por prefixo sejam agregadas.
            </p>
            <SubTitle>Georreferenciação</SubTitle>
            <p>
              Cada bem do levantamento é representado por um ponto (WGS 84), identificado por um código
              (<code>Label</code>, ex.: <code>PRS/03-0007.00001</code>) e associado ao endereço textual
              (<code>ENDEREÇO</code>, ex.: &quot;Rua General Abreu, 80&quot;).
            </p>
            <MathBlock exprs={[{ tex: "\\text{Total} = |\\hat{N}| \\qquad T_k = |\\{i \\in \\hat{N} : \\text{tipologia}_i = k\\}| \\qquad \\%\\,\\text{atingido} = \\frac{|\\hat{N}|}{|N|} \\times 100" }]} />
            <SectionSources links={[
              ["Levantamento de Patrimônio Histórico: Rio Grande/RS", ""],
            ]} />
          </Section>

          {/* ═══ 8. INFRAESTRUTURA ═══ */}
          <Section id="infraestrutura" num="8" title="Infraestrutura Urbana">
            <p>
              As camadas de Logradouros, Quadras e Terrenos são fornecidas pela Prefeitura Municipal de
              Rio Grande, em formato vetorial. Terrenos (~28 MB) solicita confirmação do usuário antes do
              carregamento por conta do tamanho do arquivo.
            </p>
            <SubTitle>Logradouros</SubTitle>
            <p>A chave de deduplicação para ruas únicas é o par (<code>tipo</code>, <code>nome</code>):</p>
            <MathBlock exprs={[
              { label: "Ruas únicas", tex: "R = |\\{(t_i, n_i) : i \\in \\hat{N}\\}|" },
              { label: "Flags binários", tex: "F_s = |\\{i \\in \\hat{N} : s_i = 1\\}|,\\quad s \\in \\{\\text{drenagem}, \\text{iluminacao}\\}" },
            ]} />
            <SubTitle>Quadras e Terrenos</SubTitle>
            <p>
              Contagem simples de quadras; para terrenos, os atributos de saneamento (<code>agua</code>,{" "}
              <code>coleta_lix</code>, <code>esgoto_plu</code>, <code>condominio</code>) são flags
              binários:
            </p>
            <MathBlock exprs={[{ tex: "\\text{Quadras} = |\\hat{N}| \\qquad F_s = |\\{i \\in \\hat{N} : s_i = 1\\}|" }]} />
            <Note type="info">
              O tipo de esgoto (<code>esgoto_clo</code>) é verificado por equivalência de string:
              cloacal: <code>&quot;esgoto_cloacal&quot;</code>, <code>&quot;cloacal&quot;</code>,{" "}
              <code>&quot;1&quot;</code>; fossa: <code>&quot;fossa_septica&quot;</code>,{" "}
              <code>&quot;fossa&quot;</code>.
            </Note>
            <SubTitle>Métricas calculadas</SubTitle>
            <ul className="list-disc list-inside space-y-1.5 text-sm">
              <li><strong>Segmentos atingidos</strong>: contagem de trechos de logradouro com interseção com a mancha.</li>
              <li><strong>Ruas únicas</strong>: deduplicação de segmentos do mesmo logradouro pelo par (tipo, nome).</li>
              <li><strong>Contagem atingida</strong> (Quadras/Terrenos): número de polígonos com interseção com a mancha.</li>
              <li><strong>Percentual atingido</strong>: razão entre o total atingido e o total da camada no município.</li>
            </ul>
            <SubTitle>Origem dos dados</SubTitle>
            <DataTable rows={[
              ["Fonte", "CRS de origem", "Camadas"],
              ["Prefeitura Municipal de Rio Grande", "SIRGAS 2000 / UTM 22S (EPSG:31982)", "Logradouros, Quadras, Terrenos"],
            ]} />
            <p className="text-[12px] text-slate-500">
              Os shapefiles da prefeitura chegam em EPSG:31982 e são reprojetados para EPSG:4326 no
              pipeline Python antes da publicação como GeoJSON.
            </p>
            <SectionSources links={[
              ["Prefeitura Municipal de Rio Grande", ""],
            ]} />
          </Section>

          {/* ═══ 9. POPULAÇÃO ═══ */}
          <Section id="populacao" num="9" title="População Exposta: WorldPop">
            <p>
              Diferente das demais camadas, a população <strong>não</strong> é um recorte vetorial: é uma
              grade populacional (<ExtLink href="https://www.worldpop.org/">WorldPop</ExtLink>) exibida
              como <em>heatmap raster</em> sobreposto ao mapa. Os valores de população total do município
              e atingida por cenário são pré-computados offline e servidos em um único{" "}
              <code>populacao_atingida.json</code>.
            </p>
            <SubTitle>Método de cálculo</SubTitle>
            <ol className="list-decimal list-inside space-y-1.5 ml-1">
              <li><strong>Recorte municipal</strong>: soma dos pixels do raster WorldPop dentro do limite de Rio Grande: população total do município.</li>
              <li><strong>Recorte pela mancha</strong>: soma dos pixels dentro do polígono de inundação do cenário selecionado: população atingida.</li>
              <li><strong>Heatmap</strong>: o raster recortado é convertido em imagem (<code>populacao.png</code>) e posicionado no mapa pelas quatro coordenadas de canto presentes no JSON.</li>
              <li><strong>Pré-computação</strong>: as duas somas (total e por cenário) são calculadas offline e servidas prontas em <code>populacao_atingida.json</code>; o cliente não reprocessa o raster.</li>
            </ol>
            <MathBlock exprs={[{ tex: "\\%\\,\\text{pop. atingida} = \\frac{\\text{pop. atingida}}{\\text{pop. total}} \\times 100" }]} />
            <Note type="info">
              O KPI de população é lido diretamente do JSON (não recalculado no cliente). A camada não tem
              botão de alternância no header: é um fundo permanente, identificado pela legenda (gradiente
              de densidade) e pelo KPI no painel.
            </Note>
            <SubTitle>Cenário combinado: estimativa por proxy</SubTitle>
            <p>
              O GeoTIFF WorldPop original e o script que gerou os valores de população atingida dos demais
              cenários não estão neste repositório. Para o cenário Nível da Lagoa + Chuva Acumulada, a
              população atingida foi <strong>estimada</strong> a partir do próprio raster de população já
              renderizado: o canal alfa da imagem correlaciona quase perfeitamente (r ≈ 0,998, testado
              empiricamente) com a posição de cada pixel na rampa de cor do heatmap, uma proxy contínua e
              monotônica da densidade populacional subjacente. O alfa é usado como peso por pixel,
              calibrado proporcionalmente contra a população total (valor real, conhecido):
            </p>
            <MathBlock exprs={[{ tex: "\\text{pop\\_atingida} \\approx \\text{pop\\_total} \\times \\frac{\\sum_{\\text{pixel} \\,\\in\\, \\text{mancha}} \\text{alfa}}{\\sum_{\\text{pixel}} \\text{alfa}}" }]} />
            <Note type="warning">
              É uma aproximação, sujeita à quantização de 256 níveis do PNG e a qualquer divergência
              entre o alfa exibido e a densidade real, não o mesmo método (resolução muito maior) dos
              demais cenários.
            </Note>
            <SectionSources links={[
              ["WorldPop: grade populacional", "https://www.worldpop.org/"],
            ]} />
          </Section>

          {/* ═══ 10. PERDAS OPERACIONAIS ═══ */}
          <Section id="perdas" num="10" title="Perdas Operacionais: Metodologia DaLA">
            <p>
              A estimativa de perdas econômicas segue a metodologia <strong>DaLA (Damage and Loss
              Assessment)</strong>, desenvolvida pela CEPAL em conjunto com o BID e o Banco Mundial. O DaLA
              distingue dois conceitos:
            </p>
            <DataTable rows={[
              ["Conceito", "Definição", "Exemplo"],
              ["Danos", "Destruição total ou parcial de ativos físicos (estoque)", "Edificação destruída, equipamento perdido"],
              ["Perdas", "Fluxo de produção ou serviço não realizado durante a interrupção", "VAB não gerado, aulas não ministradas, consultas não realizadas"],
            ]} />
            <p>
              Este painel estima apenas as <strong>perdas operacionais</strong>: o fluxo econômico que
              deixou de ocorrer. Não há estimativa de dano físico (destruição de estoque de ativos).
            </p>

            <SubTitle>Curva de Recuperação Linear</SubTitle>
            <p>
              Durante a fase aguda (d<sub>a</sub> dias) a produção cessa; na recuperação (d<sub>r</sub>{" "}
              dias) retorna gradualmente a 50% em média. O fator de interrupção efetivo é:
            </p>
            <MathBlock exprs={[
              { label: "Dias efetivos", tex: "d_{\\text{ef}} = d_a + \\dfrac{d_r}{2}" },
              { label: "Fator de interrupção", tex: "f = \\dfrac{d_{\\text{ef}}}{365}" },
            ]} />
            <DataTable rows={[
              ["Período",       "Fase aguda (dₐ)", "Recuperação (dᵣ)", "Dias ef.", "f",      "Referência"],
              ["Maio 2024",     "30 dias",         "60 dias",          "60 dias",  "0,1644", "DaLA RS, CEPAL, 2024"],
              ["Setembro 2023", "15 dias",         "30 dias",          "30 dias",  "0,0822", "DaLA RS, CEPAL, 2024"],
            ]} />

            <SubTitle>Componente 1 · Empresas: Perda de VAB</SubTitle>
            <p>
              A RAIS fornece a massa salarial mensal por estabelecimento, mas não o Valor Adicionado
              Bruto (VAB). O método utilizado é a <strong>inversão pelo labor share setorial</strong>:
              abordagem padrão da contabilidade nacional quando apenas o dado salarial está disponível.
            </p>
            <MathBlock exprs={[
              { label: "VAB anual (est.)", tex: "\\widehat{\\text{VAB}}_i = \\dfrac{w_{i,\\text{anual}}}{LS_s}" },
              { label: "Perda total", tex: "L_{\\text{emp}} = \\sum_{i \\in \\text{atingidos}} \\widehat{\\text{VAB}}_i \\times f" },
            ]} />
            <DataTable rows={[
              ["Setor (CNAE)",         "Labor share (LS)", "Fonte"],
              ["Agropecuária (01–03)", "17,6%",            "IBGE SCN 2021, Tab. 17"],
              ["Indústria (05–39)",    "33,8%",            "IBGE SCN 2021, Tab. 17"],
              ["Adm. Pública (84)",    "88,3%",            "IBGE SCN 2021, Tab. 17"],
              ["Serviços e demais",    "43,3%",            "IBGE SCN 2021, Tab. 17"],
            ]} />
            <Note type="info">
              Estabelecimentos CNAE 84 (Administração Pública) são incluídos no cálculo, ver a
              nota e a discussão sobre por que não usar ICMS como proxy na{" "}
              <Link href="/perdas#notas" target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline underline-offset-4">
                página de Perdas Operacionais, Seção 4 ↗
              </Link>.
            </Note>

            <SubTitle>Componente 2 · Educação: Custo de Reposição FUNDEB</SubTitle>
            <p>
              A LDB (Art. 24, I) exige mínimo de 200 dias letivos por ano; dias interrompidos por
              calamidade geram obrigação legal de reposição. O custo é estimado pelo Valor Anual por
              Aluno Total Mínimo (VAAT-MIN) do FUNDEB, em dois componentes com o mesmo custo
              unitário/aluno/dia:
            </p>
            <MathBlock exprs={[
              { label: "Custo/aluno/dia", tex: "c = \\dfrac{\\text{VAAT-MIN}}{D_{\\text{letivos}}}" },
              { label: "Perdas (serv. não prestado)", tex: "P_{\\text{edu}} = c \\times N_{\\text{alunos}} \\times d_a" },
              { label: "Custo adicional (reposição)", tex: "C_{\\text{adic}} = c \\times N_{\\text{alunos}} \\times d_a" },
              { label: "Total educação", tex: "L_{\\text{edu}} = P_{\\text{edu}} + C_{\\text{adic}} = 2\\,c\\,N\\,d_a" },
            ]} />
            <p className="text-[12px] text-slate-500 mt-1">
              Usa <em>d<sub>a</sub></em> (dias de fechamento real), não <em>d<sub>ef</sub></em>, porque
              escolas são obrigadas a compensar 100% dos dias perdidos: não há recuperação parcial como
              em firmas.
            </p>
            <DataTable rows={[
              ["Parâmetro",      "Valor",       "Fonte"],
              ["VAAT-MIN 2024",  "R$ 8.481,21", "Portaria Interministerial MEC/MF nº 9, 28/08/2024"],
              ["Dias letivos",   "200/ano",     "LDB, Art. 24, I"],
              ["dₐ (Maio 2024)", "30 dias",     "DaLA RS (CEPAL, 2024)"],
              ["dₐ (Set. 2023)", "15 dias",     "DaLA RS (CEPAL, 2024)"],
            ]} />

            <SubTitle>Componente 3 · Saúde: Perda de Produção SUS</SubTitle>
            <p>
              A perda de produção do SUS é estimada pela receita de procedimentos não realizada durante
              a interrupção, apurada por dois sistemas do DataSUS: SIA (Sistema de Informações
              Ambulatoriais) e SIH (Sistema de Informações Hospitalares), com produção disponível para 7
              meses e projetada linearmente para uma base anual:
            </p>
            <MathBlock exprs={[
              { label: "Produção anual CNES", tex: "P_k = \\bigl(P_{\\text{SIA},k} + P_{\\text{SIH},k}\\bigr) \\times \\dfrac{12}{7}" },
              { label: "Perda saúde", tex: "L_{\\text{sau}} = \\sum_{k \\in \\text{atingidos}} P_k \\times f" },
            ]} />

            <SubTitle>Componente 4 · Agricultura: Custo Direto de Produção</SubTitle>
            <MathBlock exprs={[
              { label: "Perda agrícola", tex: "L_{\\text{agr}} = \\sum_{c \\in \\text{culturas}} A_c\\,[\\text{ha}] \\times \\text{Coef}_c\\,[\\text{R}\\$/\\text{ha}]" },
            ]} />
            <p>Custo fixo por área, independente de <Math tex="f" />, incorrido no momento do evento, não um fluxo contínuo.</p>
            <DataTable rows={[
              ["Cultura",                     "Período",    "Status",                      "Coef. (R$/ha)"],
              ["Soja",                        "Maio 2024",  "Colhida (fev–abr/2024)",      "R$ 1.100"],
              ["Arroz",                       "Maio 2024",  "Colhido (fev–abr/2024)",      "R$ 1.100"],
              ["Outras Lavouras Temporárias", "Maio 2024",  "Plantio inicial (mai/2024)",  "R$ 1.400"],
              ["Soja",                        "Set. 2023",  "Pré-plantio",                 "R$ 250"],
              ["Arroz",                       "Set. 2023",  "Pré-plantio",                 "R$ 250"],
              ["Outras Lavouras Temporárias", "Set. 2023",  "Colheita (set–out/2023)",     "R$ 2.800"],
            ]} />

            <SubTitle>Perda total estimada</SubTitle>
            <MathBlock exprs={[{ label: "Total (por cenário)", tex: "L_{\\text{total}} = L_{\\text{emp}} + L_{\\text{edu}} + L_{\\text{sau}} + L_{\\text{agr}}" }]} />

            <p>
              Resultados calculados por cenário, com opção de simular 30/45/60 dias efetivos, na{" "}
              <Link href="/perdas" target="_blank" rel="noopener noreferrer"
                className="font-semibold hover:underline underline-offset-4" style={{ color: PRIMARY }}>
                <TrendingDown size={13} strokeWidth={2.5} className="inline mr-1 align-text-bottom" />página de Perdas Operacionais ↗
              </Link>.
            </p>

            <SectionSources links={[
              ["CEPAL (2024): Avaliação dos Efeitos e Impactos das Inundações no Rio Grande do Sul", "https://www.cepal.org/pt-br/publicacoes/81035-avaliacao-efeitos-impactos-inundacoes-rio-grande-sul-novembro-2024"],
              ["PDNA Guidelines Vol. A: GFDRR/UNDP/BM, 2013", "https://www.gfdrr.org/sites/default/files/2017-09/PDNA-Volume-A.pdf"],
              ["IBGE: SCN 2021, Tabela 17", "https://ftp.ibge.gov.br/Contas_Nacionais/Sistema_de_Contas_Nacionais/2021/tabelas_xls/sinoticas/"],
              ["Karabarbounis & Neiman (2014, QJE): The Global Decline of the Labor Share", "https://doi.org/10.1093/qje/qjt032"],
              ["LDB: Lei nº 9.394/1996, Art. 24", "https://www.planalto.gov.br/ccivil_03/leis/l9394.htm"],
              ["Portaria Interministerial MEC/MF nº 9, 28/08/2024 (VAAT-MIN FUNDEB 2024)", "https://www.fnde.gov.br"],
              ["DataSUS: Produção Hospitalar SIH/SUS", "https://datasus.saude.gov.br/acesso-a-informacao/producao-hospitalar-sih-sus"],
              ["DataSUS: Produção Ambulatorial SIA/SUS", "https://datasus.saude.gov.br/acesso-a-informacao/producao-ambulatorial-sia-sus"],
              ["CONAB: Preços Mínimos 2024", "https://www.conab.gov.br/politica-agricola/precos-minimos"],
            ]} />
          </Section>

          {/* ═══ 11. FONTES ═══ */}
          <Section id="fontes" num="11" title="Fontes e Referências">
            <div className="space-y-4">
              <RefBlock title="Manchas de Inundação">
                <RefItem href="https://ciex.furg.br"
                  label="CIEX/FURG: Centro de Inteligência em Eventos Extremos"
                  desc="Modelagem hidrológica e hidráulica costeira para Rio Grande: manchas de Maio 2024, Maio 2024 + 50% e Setembro 2023." />
                <RefItem href=""
                  label="GPEA/FURG: Grupo de Pesquisa em Economia Azul"
                  desc="Simulações de Nível da Lagoa e Chuva Acumulada usadas no cenário combinado, com estilo de visualização definido em QGIS." />
              </RefBlock>
              <RefBlock title="Dados Socioeconômicos">
                <RefItem href="https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/estatisticas-trabalho/rais"
                  label="RAIS: Relação Anual de Informações Sociais (MTE)"
                  desc="Microdados de vínculos ativos, estabelecimentos, CNAE e remuneração, base de Empresas." />
                <RefItem href="https://www.gov.br/inep/pt-br/areas-de-atuacao/pesquisas-estatisticas-e-indicadores/censo-escolar"
                  label="INEP: Censo Escolar"
                  desc="Estabelecimentos de educação básica, matrículas por modalidade e docentes." />
                <RefItem href="https://cnes.datasus.gov.br"
                  label="CNES: Cadastro Nacional de Estabelecimentos de Saúde (DataSUS)"
                  desc="Unidades de saúde, tipo de estabelecimento e quadro de pessoal por categoria." />
              </RefBlock>
              <RefBlock title="Dados Agrícolas e de Cobertura">
                <RefItem href="https://brasil.mapbiomas.org/colecoes-mapbiomas-1/"
                  label="MapaBiomas: Coleção 10"
                  desc="Mapeamento anual de uso e cobertura do solo em raster de 30 m, com classes de agricultura e cobertura da terra." />
              </RefBlock>
              <RefBlock title="Infraestrutura e Patrimônio">
                <RefItem href=""
                  label="Prefeitura Municipal de Rio Grande"
                  desc="Camadas de Logradouros, Quadras e Terrenos." />
                <RefItem href=""
                  label="Levantamento de Patrimônio Histórico: Rio Grande/RS"
                  desc="Bens tombados/inventariados (355 pontos) com nome, endereço e tipologia arquitetônica." />
              </RefBlock>
              <RefBlock title="População">
                <RefItem href="https://www.worldpop.org/"
                  label="WorldPop"
                  desc="Grade populacional (hab./pixel) renderizada como heatmap raster." />
              </RefBlock>
              <RefBlock title="Metodologia DaLA e Referências Econômicas">
                <RefItem href="https://www.cepal.org/pt-br/publicacoes/81035-avaliacao-efeitos-impactos-inundacoes-rio-grande-sul-novembro-2024"
                  label="CEPAL (2024): Avaliação dos Efeitos e Impactos das Inundações no Rio Grande do Sul"
                  desc="Referência metodológica para a curva de recuperação linear e parâmetros de interrupção." />
                <RefItem href="https://www.gfdrr.org/sites/default/files/2017-09/PDNA-Volume-A.pdf"
                  label="PDNA Vol. A Guidelines (GFDRR/UNDP/BM, 2013)"
                  desc="Guia metodológico para avaliação de pós-desastre: danos ao estoque e perdas de fluxo." />
              </RefBlock>
              <RefBlock title="Ferramentas e Infraestrutura Geoespacial">
                <RefItem href="https://geopandas.org/en/stable/docs.html"
                  label="GeoPandas"
                  desc="Biblioteca Python para operações de sobreposição espacial (sjoin, intersection)." />
                <RefItem href="https://nominatim.org"
                  label="Nominatim (OpenStreetMap)"
                  desc="Geocodificador de endereços baseado em dados OSM, instância local. Usado para estabelecimentos RAIS e unidades sem coordenadas próprias." />
                <RefItem href="https://turfjs.org"
                  label="Turf.js"
                  desc="Cálculos geoespaciais no cliente (área, bounding box) em JavaScript/TypeScript." />
                <RefItem href="https://maplibre.org/maplibre-gl-js/docs/"
                  label="MapLibre GL JS"
                  desc="Motor de renderização de mapas vetoriais no navegador." />
              </RefBlock>
            </div>
          </Section>

          {/* ── Rodapé ──────────────────────────────────────────────────────── */}
          <footer className="mt-12 pt-6 border-t border-[#c7d6d9] text-center print:mt-4">
            <p className="text-[11px]" style={{ color: PRIMARY }}>
              Painel desenvolvido pelo CIEX em parceria com o GPEA/FURG.
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: PRIMARY }}>
              © GPEA: Grupo de Pesquisa em Economia Azul · Alisson T. G. Fiorentin
            </p>
          </footer>

        </main>
      </div>
    </div>
  );
}
