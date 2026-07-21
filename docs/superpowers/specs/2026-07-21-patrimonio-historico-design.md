# Camada Patrimônio Histórico — Design

Data: 2026-07-21

## Objetivo

Adicionar ao Dashboard CIEX uma nova camada de dados — "Patrimônio Histórico" — como setor de primeiro nível (mesmo padrão de Empresas/Saúde/Educação): botão dedicado no menu de camadas (header), aba própria no Painel de Análise, filtro dedicado e item de legenda. Inclui a conversão do shapefile de origem para os formatos estáticos consumidos pelo app.

## Dados de origem

`patrimHistRG_verificados.shp` (+ `.dbf`, `.shx`, `.prj`, `.cpg`, `.qmd`), em `C:\Users\Alisson Fiorentin\Downloads\`.

- 355 features, geometria `Point`, CRS `EPSG:4326` (sem necessidade de reprojeção).
- Colunas: `Label` (id único, ex. `PRS/03-0007.00001`), `ENDEREÇO` (sempre preenchido), `COMPLEMENT` (83 preenchidos / 272 nulos), `Tipologia` (sempre preenchido, 17 valores distintos com duplicidade por prefixo numérico), `Nome` (144 preenchidos / 211 nulos).
- `Tipologia` traz categorias como `"6- Arquitetura Civil Privada"` e `"Arquitetura Civil Privada"` representando a mesma categoria — normalização necessária (remover prefixo `^\d+-\s*`).
- Bounding box dentro do município de Rio Grande/RS.

## 1. Pipeline de conversão (Python)

Novo script: `scripts/converter_patrimonio_rio_grande.py`, no molde de `scripts/converter_infra_rio_grande.py`.

- Lê o shapefile de `Downloads/patrimHistRG_verificados.shp` (caminho hardcoded, consistente com os demais scripts do projeto).
- CRS já é EPSG:4326 — sem reprojeção.
- Mantém as colunas `Label`, `ENDEREÇO`, `COMPLEMENT`, `Tipologia`, `Nome` no GeoJSON de saída (sem normalizar `Tipologia` no Python — a normalização acontece no client, mesmo padrão do `normalizeDep` usado para Educação).
- Para os 2 cenários existentes (`Cenário Maio 2024`, `Cenário Maio 2024 + 50%`), roda `gpd.sjoin(gdf, mancha[["geometry"]], how="inner", predicate="intersects")`.
- Salva seguindo a convenção de nomes dos **setores principais** (não a de infraestrutura):
  - `public/dados_convertidos/rio_grande/patrimonio_BASE.geojson`
  - `public/dados_convertidos/rio_grande/cenarios/patrimonio_ATINGIDOS_rio_grande___cenario_maio_2024.geojson`
  - `public/dados_convertidos/rio_grande/cenarios/patrimonio_ATINGIDOS_rio_grande___cenario_maio_2024_50.geojson`
- Reaproveita `slugify`/`scenario_slug` e a lógica de carregar a mancha (`carregar_mancha`) já existentes em `converter_infra_rio_grande.py` (duplicar essas poucas funções auxiliares no novo script, já que os scripts de conversão deste projeto são todos independentes/sem módulo compartilhado).

## 2. Estado e carregamento de dados (`app/page.tsx`)

- Novos estados: `basePatrimonio`, `atingidosPatrimonio` (mesmo padrão de `baseSaude`/`atingidosSaude`).
- `camadas` (estado inicial) ganha `"Patrimônio Histórico"` — ativa por padrão, junto das demais.
- Carregamento integrado ao `useEffect` principal existente: base carregada uma vez na inicialização; atingidos recarregado a cada troca de cenário via fetch cancelável (`AbortController`), replicando exatamente o tratamento hoje dado a `baseSaude`/`atingidosSaude`.
- Nova função helper `normalizeTipologia(raw: string)`: remove o prefixo `^\d+-\s*` (regex) e retorna a categoria limpa. Usada em filtro, legenda/donut e popup — nunca se sobrescreve o dado bruto.
- Novo `calcPatrimonio(base)`: retorna `{ total: number, porTipologia: Record<string, number> }`, agregando por `normalizeTipologia(f.properties.Tipologia)`. Chamado uma vez para base e uma vez para atingidos, no mesmo padrão de `calcEmp`/`calcEdu`/`calcSau`.
- Novo filtro dedicado `filtroTipologia` (estado próprio — não reaproveita `filtroTipo`, que é de Saúde), com valor default `"(todas)"`.

## 3. Header — menu de camadas

Novo botão de primeiro nível na lista de camadas principais (ao lado de "Cobertura"), ícone `Landmark` (lucide-react), label "Patrimônio", mesmo componente/estilo de toggle já usado pelos demais botões (`toggleCamada`).

## 4. Filtros (painel direito)

Novo bloco de filtro, condicionado a `camadas.includes("Patrimônio Histórico")`, com dropdown de `Tipologia` normalizada (opções únicas derivadas de `basePatrimonio`), no mesmo estilo visual dos filtros existentes (label colorido + `Select`), com uma cor própria não usada pelos demais filtros.

## 5. Mapa

- Nova cor em `COLORS`: `patrimonio: "#a16207"` (dourado/terracota — não colide com azul=empresas, vermelho=saúde, verde=educação, laranja=infra padrão, tons de verde-oliva=cobertura, tons usados em agricultura).
- Nova `Source`/`Layer` clusterizada, replicando exatamente o padrão de `saude`/`educacao`/`empresas`: `patrimonio-cluster`, `patrimonio-count`, `patrimonio-point` (cluster radius 40, mesma lógica de step/raio dos demais pontos).
- Entra em `interactiveLayerIds` quando a camada estiver ativa e houver features.
- Entra no `renderPopupContent` como novo `source === "patrimonio"`: título com ícone 🏛 "Patrimônio Histórico (Tipologia normalizada)", `Nome` (fallback "Sem nome"), `Endereço`.
- Renderizado na mesma posição de z-order que os demais pontos (empresas/saúde/educação — acima de infraestrutura/cobertura/agricultura).

## 6. Legenda

Novo `LegendItem` (cor `COLORS.patrimonio`, label "Patrimônio Histórico"), condicionado a `camadas.includes("Patrimônio Histórico") && renderPatrimonio?.features`.

## 7. Aba do Painel

Nova aba "Patrimônio" (ícone `Landmark`, 11px, consistente com as demais abas), condicionada a `camadas.includes("Patrimônio Histórico")`, com:

1. KPI total (via `KPIRow`): atingidos/base com delta percentual, mesmo padrão das demais abas.
2. Donut por Tipologia normalizada (mesmo componente `PieChart`/`Pie`/`Cell` com `DONUT_COLORS`, replicando a seção "Unidades por Tipo" de Saúde) — clique em fatia ou item da legenda alterna `filtroTipologia`.
3. Lista expansível única (não agrupada por subtipo, diferente de Saúde) com os itens atingidos, formato `Nome — Endereço` (fallback "Sem nome" quando `Nome` for nulo), ordenada alfabeticamente por `Endereço` — no molde da lista "Ruas Atingidas" de Logradouros. Novo estado `showListaPatrimonio` para expandir/colapsar.
4. Rodapé com fonte: "Fonte: Levantamento de Patrimônio Histórico — Rio Grande/RS".

## 8. Exportação Excel

`exportarExcel` ganha mais uma chamada `add(atingidosPatrimonio || basePatrimonio, "Patrimônio Histórico")`, condicionada a `camadas.includes("Patrimônio Histórico")`, seguindo exatamente o padrão das demais camadas.

## Fora de escopo

- Não há criação de módulo Python compartilhado entre scripts de conversão — cada script deste projeto é independente, conforme convenção observada.
- Não há agrupamento da lista de atingidos por Tipologia (ficaria com ~9 grupos pequenos) — lista única ordenada.
- Não há alteração de cor por Tipologia no mapa (decidido: cor única para a camada toda).
- Não há testes automatizados — o projeto não possui suíte de testes.
