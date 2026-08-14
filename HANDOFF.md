# Handoff — Perdas Operacionais (Agosto/2026)

Registro do que foi implementado na sessão de 05/08/2026 e do que ficou pendente. Escrito antes de uma formatação da máquina de desenvolvimento.

**Estado do repositório:** commit `de563f0` na branch `main`, já publicado em `origin/main`. Working tree limpo.

---

## ⚠️ Antes de formatar — o que NÃO está no Git

O `.gitignore` ignora o diretório `/scripts/` inteiro (linha 36). Tudo abaixo existe **apenas no disco local** e será perdido na formatação se não for copiado para outro lugar:

| Arquivo | Origem | Reconstruível? |
|---|---|---|
| `scripts/calcular_perdas_rio_grande.py` | Criado nesta sessão | Sim, mas exige reescrever ~250 linhas |
| `scripts/data/producao_sus_por_cnes_rio_grande.json` | Derivado do parquet do projeto BID | Só com o projeto BID em mãos |
| `scripts/converter_*.py` (6 arquivos) | Pré-existentes ao projeto | Não trivialmente |
| `scripts/data/*.tif`, `*.geojson` | Rasters MapBiomas e limite municipal | Sim, mas exige baixar de novo |

**Recomendação:** copiar `scripts/` inteiro (~6 MB) para backup externo antes de formatar.

O mesmo vale para o projeto irmão em `D:\Projetos\BID`, que foi a fonte dos dados desta atualização. Ele depende de caminhos externos absolutos que não estão versionados — `D:/RAIS/...`, planilhas em `C:\Users\...\Downloads\`, shapefiles das manchas em `data/raw/manchas/`. Sem esses insumos, o pipeline do BID não roda do zero.

---

## O que foi feito

### 1. Nova página `/perdas` — Perdas Operacionais

Estimativa de perdas econômicas operacionais pela metodologia DaLA (CEPAL/BID), adaptada da página `/danos` do projeto BID para o contexto de município único.

**Arquivos:** `app/perdas/page.tsx` (server component, lê o JSON do disco) e `app/perdas/PerdasClient.tsx` (~800 linhas, componente client autocontido).

Quatro componentes de perda, somados:

| Componente | Método | Fonte |
|---|---|---|
| Empresas (VAB) | Massa salarial invertida pelo *labor share* setorial × fator de interrupção | RAIS 2023, IBGE SCN 2021 Tab. 17 |
| Educação | Custo FUNDEB aluno/dia, contado em dobro (serviço não prestado + reposição obrigatória, LDB Art. 24) | Censo Escolar 2024, Portaria MEC/MF nº 9/2024 |
| Saúde (SUS) | Produção SIA + SIH anualizada por estabelecimento (CNES) | DataSUS |
| Agricultura | Área atingida × coeficiente R$/ha por cultura e período | MapBiomas Col. 10, CONAB |

Curva de recuperação linear: `dias_efetivos = dias_agudo + dias_recuperação / 2`, `f = dias_efetivos / 365`.

Resultados atuais (`public/dados_convertidos/perdas_operacionais.json`):

| Cenário | Dias ef. | Total |
|---|---|---|
| Maio 2024 | 60 | R$ 95,5 mi |
| Maio 2024 + 50% | 60 | R$ 544,0 mi |
| Setembro 2023 | 30 | R$ 12,7 mi |

A página tem análise de sensibilidade (30/45/60 dias, recalculada no cliente via `scaleTo()` — agricultura não escala, é custo fixo de produção), fórmulas em KaTeX, tabela de parâmetros com fontes, nota sobre CNAE 84 (Administração Pública) e nota sobre por que ICMS municipal não serve como proxy de VAB.

Botão de acesso no cabeçalho do painel, ao lado do seletor de cenário. Abre em nova aba.

### 2. Script de cálculo

`scripts/calcular_perdas_rio_grande.py` — portado de `D:\Projetos\BID\pipeline\07_danos.py`, removendo o laço sobre os 4 municípios do BID. Autocontido: não importa `config.py` nem `common.py` do BID, todas as constantes e helpers foram inlineados.

```bash
python scripts/calcular_perdas_rio_grande.py            # curva DaLA por período (padrão)
python scripts/calcular_perdas_rio_grande.py --dias 45  # interrupção plana, grava em arquivo separado
```

Lê de `public/dados_convertidos/rio_grande/cenarios/*_ATINGIDOS_*.geojson`, `agricultura_stats_*.json` e `scripts/data/producao_sus_por_cnes_rio_grande.json`. Escreve `public/dados_convertidos/perdas_operacionais.json`.

### 3. Atualização da base de dados

As camadas de Empresas, Educação e Saúde de Rio Grande foram substituídas pela versão do pipeline BID, que já traz os atributos exigidos pelo cálculo (`massa_salarial`, `cnae_classe`, `salario_medio`, matrículas por modalidade, quadro de pessoal por categoria CBO).

Único campo incompatível entre os dois schemas era `"Média Salarial"` (CIEX) contra `salario_medio` (BID) — corrigido em `calcEmp()` no `app/page.tsx`. Todo o resto (`CNAE_2`, `Empregados`, `Massa_Salarial`, `qtd_matri_*`, `staff_*`, `co_tipo_estabelecimento`) já coincidia.

A camada de Agricultura **não** teve o GeoJSON de mapa substituído — só foram adicionados os `agricultura_stats_*.json` (área por cultura), que é o único insumo que o cálculo de perdas consome.

### 4. Correções no mapa

- **`Cannot add layer before non-existing layer`** — camadas que usam `beforeId` (mancha, infraestrutura, agricultura, cobertura, heatmaps, prédios 3D) só montam depois do evento `load` do mapa, via a flag `mapReady`.
- **Ordem de empilhamento** — mancha → infraestrutura → agricultura → cobertura → prédios 3D → empresas/educação/saúde/patrimônio. Infra, agricultura e cobertura compartilham a âncora `anchor-buildings`, então a ordem no JSX define a pilha.
- **Prédios 3D** — `beforeId` passou de `anchor-pts` (marcador vazio, posição dependente da ordem de montagem) para `empresas-cluster` (camada real, sempre presente).
- **Câmera inicial** — fixada em `lng=-52.10339, lat=-32.03563, z=13.29, pitch=65, bearing=-12`, sobrescrita por parâmetros da URL quando presentes.
- **Reenquadramento ao trocar de cenário** — corrigida regressão introduzida durante esta sessão: o guard `hasFlownInitialRef` estava sendo reaproveitado no efeito de troca de cenário, travando o `fitBounds` permanentemente após a primeira execução.
- **Toggle 2D/3D** — aplica `easeTo` direto em vez de esperar o evento `load`, que dispara uma única vez e podia já ter passado, deixando a inclinação travada.
- **Painel e legenda de População** — voltaram a aparecer; ambos checavam `camadas.includes("População")`, condição que deixou de ser satisfeita quando População virou um toggle de heatmap independente.

### 5. Dependência adicionada

`katex@^0.17.0` para renderizar as fórmulas da página de perdas. O CSS foi importado em `app/globals.css`.

---

## O que falta

### Alta prioridade

1. **Mancha vetorial do Cenário Setembro 2023.** A página `/perdas` apresenta os três cenários, mas o mapa oferece apenas Maio 2024 e Maio 2024 + 50%. Falta copiar `rio_grande___cenario_setembro_2023.geojson` de `D:\Projetos\BID\Dashboard BID\public\dados_convertidos\rio_grande\cenarios\` e adicionar `"Cenário Setembro 2023"` ao array `CENARIOS` em `app/page.tsx` (~linha 82). As camadas ATINGIDOS de empresas/educação/saúde para esse cenário **já foram copiadas** e estão versionadas — falta a mancha e as camadas de infraestrutura/agricultura/cobertura/patrimônio.

2. **Backup do diretório `scripts/`.** Ver seção no topo.

### Média prioridade

3. **Confirmar visualmente o empilhamento dos prédios 3D.** A correção foi validada por inspeção do array `map.getStyle().layers`, mas não visualmente — o painel de navegador da sessão não compositava frames WebGL. Se os prédios ainda aparecerem por baixo da mancha após a correção, a causa provável não é ordem de camadas e sim *depth buffer*: extrusões 3D usam teste de profundidade real, e um `fill` 2D translúcido pode se sobrepor a elas independentemente da ordem no array. Nesse caso a saída é converter a mancha em `fill-extrusion` com altura baixa, ou reduzir a opacidade dela.

4. **Atualizar o `README.md`.** Ainda não menciona a página `/perdas` nem a metodologia DaLA. A seção "Funcionalidades" e a tabela "Base de Dados" precisam da entrada de perdas operacionais.

5. **Publicar a nota de atualização.** O texto pronto está no apêndice deste documento. O repositório não tem nenhuma tag ainda — criar um Release exige criar a tag junto (sugestão: `v1.1.0`). Não existe `CHANGELOG.md`.

### Baixa prioridade

6. **Versionar o script de perdas.** Hoje `scripts/` está inteiramente ignorado, seguindo a convenção do projeto. Vale considerar uma exceção no `.gitignore` para `calcular_perdas_rio_grande.py` e `producao_sus_por_cnes_rio_grande.json` (juntos < 20 KB), já que sem eles ninguém consegue recalcular as perdas a partir de um clone.

7. **Avaliar a nota de CNAE 84.** Os números na seção 7 da página `/perdas` foram recalculados para Rio Grande (5 estabelecimentos, 24,0% da massa salarial, ≈ R$ 58,5 mi de R$ 460,0 mi no cenário + 50%), mas vale conferir com quem domina a metodologia se a inclusão da Administração Pública deve mesmo permanecer no total apresentado.

---

## Verificações que passaram

`npm run typecheck`, `npm run lint` e `npm run build` — todos limpos no commit `de563f0`. Build de produção gera `/`, `/perdas` e `/_not-found` como estático. Sem erros de console no dashboard nem na página de perdas.

## Ambiente

- Node com Next.js 16.2.6 (Turbopack), `npm run dev` na porta 3000.
- Python 3.12 com `pandas` e `pyarrow` foi necessário apenas para gerar o `producao_sus_por_cnes_rio_grande.json` a partir do parquet do BID. O `calcular_perdas_rio_grande.py` em si usa só a biblioteca padrão.
- O shell da máquina é Windows PowerShell 5.1, onde `&&` não funciona como separador — usar `;`.

---

## Apêndice — Nota de atualização (pronta para publicar)

> Texto abaixo redigido para Release, Discussion ou base de um `CHANGELOG.md`. O GitHub renderiza LaTeX (`$...$`) nesses contextos; se aparecer cru em algum lugar, trocar por texto simples.

### Perdas Operacionais + correções do mapa

Esta atualização adiciona ao dashboard a estimativa de **perdas econômicas operacionais** decorrentes dos cenários de inundação, seguindo a metodologia DaLA (CEPAL/BID), e corrige um conjunto de problemas na renderização e no comportamento da câmera do mapa.

#### Nova página: Perdas Operacionais (`/perdas`)

Acessível pelo botão **Perdas Operacionais** no cabeçalho do painel. Apresenta a estimativa de fluxo de produção não realizado durante o período de interrupção e recuperação, decomposta em quatro componentes:

| Componente | Método | Fonte |
|---|---|---|
| **Empresas (VAB)** | Inversão da massa salarial pelo *labor share* setorial, ponderada pelo fator de interrupção | RAIS 2023 · IBGE SCN 2021 (Tab. 17) |
| **Educação** | Custo FUNDEB por aluno/dia, contado em dobro (serviço não prestado + reposição obrigatória, LDB Art. 24) | Censo Escolar 2024 · Portaria MEC/MF nº 9/2024 |
| **Saúde (SUS)** | Produção ambulatorial e hospitalar anualizada por estabelecimento | CNES · SIA/SIH DataSUS |
| **Agricultura** | Área atingida × coeficiente de custo de produção por cultura e período | MapBiomas Coleção 10 · CONAB |

A curva de recuperação linear DaLA define os dias efetivos como $d_{ef} = d_a + d_r/2$, com fator de interrupção $f = d_{ef}/365$.

**Resultados estimados**

| Cenário | Dias efetivos | Total estimado |
|---|---|---|
| Maio 2024 | 60 | R$ 95,5 mi |
| Maio 2024 + 50% | 60 | R$ 544,0 mi |
| Setembro 2023 | 30 | R$ 12,7 mi |

A página inclui ainda análise de sensibilidade por duração da interrupção (30/45/60 dias, recalculada no cliente), detalhamento das fórmulas, tabela de parâmetros com fontes, nota metodológica sobre a inclusão da Administração Pública (CNAE 84) e nota sobre por que o ICMS municipal não foi adotado como proxy de VAB.

#### Atualização da base de dados

As camadas de **Empresas**, **Educação** e **Saúde** de Rio Grande foram substituídas pela versão consolidada no pipeline do projeto BID, que já carrega os atributos necessários ao cálculo de perdas (`massa_salarial`, `cnae_classe`, `salario_medio`, matrículas por modalidade, quadro de pessoal por categoria CBO). Foram adicionadas as estatísticas de área agrícola por cultura e cenário.

#### Correções

- **Erro de renderização de camadas** — camadas que dependem de `beforeId` (mancha, infraestrutura, agricultura, cobertura, heatmaps e prédios 3D) passaram a ser montadas somente após o evento `load` do mapa, eliminando o erro `Cannot add layer before non-existing layer`.
- **Ordem de empilhamento** — reorganizada para: mancha → infraestrutura → agricultura → cobertura → prédios 3D → empresas/educação/saúde/patrimônio. Os prédios 3D passaram a referenciar uma camada real em vez de um marcador vazio cuja posição dependia da ordem de montagem.
- **Posição inicial da câmera** — o mapa agora abre em enquadramento fixo definido, sem depender de leitura de referência durante a renderização.
- **Reenquadramento ao trocar de cenário** — corrigida regressão que impedia o mapa de reajustar o enquadramento à nova mancha ao alternar entre cenários.
- **Alternância 2D/3D** — o retorno ao modo 2D agora zera a inclinação de forma confiável, sem depender de um evento que dispara apenas uma vez.
- **Painel e legenda de População** — voltaram a ser exibidos; ambos verificavam uma condição que deixou de ser satisfeita quando a camada de População foi convertida em alternador de heatmap independente.

#### Notas

- A página de Perdas apresenta os três cenários calculados, incluindo **Setembro 2023**. O mapa continua oferecendo apenas **Maio 2024** e **Maio 2024 + 50%**, pois a mancha vetorial de Setembro 2023 ainda não foi incorporada a este repositório.
- O script de cálculo (`scripts/calcular_perdas_rio_grande.py`) permanece fora do versionamento, seguindo a convenção do projeto para o diretório `scripts/`. O resultado que alimenta o dashboard (`public/dados_convertidos/perdas_operacionais.json`) está versionado, de modo que a aplicação funciona a partir de um clone limpo.
