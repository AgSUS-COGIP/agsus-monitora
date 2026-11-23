---
tipo: modulo
area: modulo
atualizado: 2026-11-23
---

# Módulo: Relatórios (bloco Dados; antes Painéis)

Os relatórios de **acompanhamento e gestão** da área escolhida, que cruzam editais, num catálogo:
a entrada é uma grade de cartões em grupos (Editais: Resumo dos editais, Editais por cargo e Montar
relatório; Aprovados: Aprovados, Resumo por cargo e status e Relatório da diretoria; Produtividade,
quando tiver relatório), cada um com o que mostra em uma linha, quando foi calculado e os botões.
Os calculados no banco têm "Abrir" (a tabela paginada, com "Todos os relatórios" para voltar) e a
exportação do relatório inteiro (Excel e PDF). No menu, é o
item Relatórios do bloco **Dados**, abaixo de Processo seletivo (`BLOCO_DE_DADOS` em
`src/lib/navegacao/menu-lateral.ts`). Não confundir com os painéis externos (`panel:<código>`,
[[modulo-paineis-externos]]).

- **Nomes**: só o que a pessoa lê mudou em 23/11/2026 (menu, título, Acessos, Aya, mensagens). A
  view, a aba do catálogo, a pasta e o recurso seguem `paineis-de-dados` / `paineis_dados`
  (permissões, `TB_ABA`, tours e `**abrir:**` da Aya continuam valendo). O nome no menu vem de
  `TB_ABA."NO_ABA"`: até a migration `20261123180000_aba_paineis_vira_relatorios.sql` ser aplicada,
  o menu mostra "Painéis" e o resto já diz Relatórios.
- **Endereço**: `/<área>/relatorios` (catálogo) e `/<área>/relatorios?relatorio=<id>` (um aberto:
  abrir é entrada nova no histórico, e o voltar do navegador volta aos cartões). O caminho antigo
  `/<área>/paineis-de-dados` é `caminhosAntigos` da rota (`src/lib/navegacao/rotas.ts`): abre a
  tela e a navegação troca o endereço pelo novo, sem nova entrada no histórico.
- **O que entra**: só relatório de gestão que cruza editais. Os documentos de uma etapa (resultado
  e relatório de desempate da Classificação, cartas de convocação, exportação da lista de
  aprovados) ficam na tela da etapa; ali entra, no máximo, um atalho "Ver em Relatórios" para o
  relatório de gestão correspondente.
- **Relatórios gerados no navegador** (23/11/2026, Parte 2: vieram da Visão geral e da Lista de
  aprovados, que ficaram com o atalho **Ver em Relatórios**, `src/componentes/ver-em-relatorios.tsx`):
  - **Montar relatório** (grupo Editais): o montador (`montador-de-relatorio.tsx`) com os editais
    da área; aberto pelo atalho da Visão geral (`?relatorio=montar-relatorio&origem=visao-geral`),
    com a Visão geral como estava (filtros, busca e atalho). Fica no endereço; fechar volta aos
    cartões. Era o botão "Montar relatório" do topo e o "Exportar" da Visão geral, que agora
    exporta só a tabela à vista ([[modulo-visao-geral]]).
  - **Relatório da diretoria** (grupo Aprovados): o modelo Diretoria do montador (editais, vagas
    por cargo e aprovados, com a admissão conciliada com o RH), gerado direto do cartão em Excel ou
    PDF (`gerar-relatorio.ts`, a mesma geração do montador). As duas versões da admissão ficam até
    a regra ser uma só: o cartão Aprovados diz "o dia em que virou Contratado no sistema", o da
    diretoria, "conciliada com o RH" (linha `regra` do catálogo).
  - **Resumo por cargo e status** (grupo Aprovados, só com o recurso `aprovados`): a contagem que
    era a aba da Lista de aprovados ([[modulo-aprovados]]), sobre o estado dela (o controlador da
    tela `approved`, pedido sob demanda) e o mesmo recorte (`src/modulos/aprovados/recorte-dos-aprovados.ts`).
    Os editais escolhidos ficam no endereço (`edital=7,8`); o atalho da Lista leva os dela.
  - O atalho deixa o endereço guardado (a tela ainda não montada o lê ao abrir) e faz um pedido
    de filtro (`src/app/pedido-de-filtro.ts`: a tela já montada abre o relatório pedido).
  - Os editais da área são as linhas do monitoramento, lidas só sob demanda
    (`pedirLinhasDoMonitoramento`): Relatórios as pede enquanto o montador ou o Resumo está aberto
    e espera por elas antes de gerar a diretoria (sem isso o montador abria com 0 processos).
- **Catálogo**: ao abrir, a tela lê a primeira página de cada relatório (a mesma que a tabela usa
  depois, do cache) para o cartão mostrar a data do cálculo e o total. A falha de leitura (sem
  permissão, sem a migration) aparece uma vez em cima dos cartões. Sincronizar no catálogo
  recalcula todos; com um relatório aberto, só ele. A data no topo ("Sincronizado em") só aparece
  com um relatório aberto; no catálogo, cada cartão tem a sua.

## Arquivos

```
paineis-de-dados.tsx  catálogo (cartões por grupo e tipo), relatório aberto (tabela paginada, alça de
                      largura, ⓘ da origem e botões), montador e Resumo por cima, o endereço e o
                      pedido de filtro do atalho; criarPaineisDeDados()
estado.ts             store sem React dos calculados: catálogo ou relatório aberto, página lida por
                      relatório e área, cache em memória, larguras, download, gaveta de fontes
fontes-dos-dados.tsx  a gaveta "Fontes dos dados" (uma coluna por bloco: Origem, Coluna, Motivo)
montador-de-relatorio.tsx  o montador (modelo, seções, colunas, formato; a escolha fica no navegador)
gerar-relatorio.ts    o PDF/Excel do montador e da diretoria (vagas por cargo e aprovados lidos na hora)
dados-da-diretoria.ts as RPCs das abas 2 e 3 da diretoria (a 3 registra o download)
resumo-por-cargo.tsx  o Resumo por cargo e status (filtros, tabela agrupada, gaveta, Exportar)
paineis-de-dados.css  a alça de largura, o painel do ⓘ, os cartões, a volta, o montador e o Resumo
```

Regras puras em `src/lib/paineis/catalogo-dos-relatorios.ts` (os cartões, o tipo, o grupo, o resumo e
a regra de cada um, quem vê o Resumo, os grupos com relatório, o que vale no endereço e a busca do
atalho), `relatorio-da-visao-geral.ts` (+ `-em-pdf`), `relatorio-da-diretoria.ts`,
`resumo-por-cargo-e-status.ts` e `exportacao-do-resumo-por-cargo.ts` (+ `-em-pdf`), todos em
`src/lib/paineis/`, `src/lib/paineis/relatorios-dos-paineis.ts` (colunas, leitura da página, XLSX, tabela do PDF, nome do
arquivo, largura arrastada e texto da origem) e `src/lib/paineis/fontes-dos-paineis.ts` (leitura das fontes).
RPCs no contrato (`src/lib/rpc-contrato.ts`): `ler_relatorio_do_painel`,
`sincronizar_relatorio_do_painel`, `listar_fontes_do_painel` e `salvar_fonte_da_coluna`.

## Regras e contratos

- Permissão: recurso `paineis_dados` (Relatórios, em Acessos), liberado em Acessos; aba
  `paineis-de-dados` em `TB_ABA`, nas três áreas (migration `20261113200000_paineis_no_bloco_dados.sql`).
- **Resultado pronto** (migration `20261116160000_relatorios_dos_paineis_prontos.sql`; desenho em
  `docs/_arquivo/planos/2026-11-16-paineis-carregamento-e-tabela-design.md`): o banco guarda o
  último cálculo de cada relatório por área (`TB_CALCULO_RELATORIO_PAINEL` e
  `TB_LINHA_RELATORIO_PAINEL`, sem grant para a API). O cálculo é o SQL das leituras de
  `20261113240000` (`private."FC_LINHAS_*_DO_PAINEL"`), para a área inteira: só editais ativos e
  fora de treinamento, e só a lista de aprovados vigente e ativa. Recalcula de hora em hora (cron
  `agsus_paineis_recalcular_relatorios`, minuto 17), no Sincronizar (no máximo uma vez por minuto
  por área e relatório; dentro do minuto devolve o que está pronto) e na troca de fonte (na mesma
  transação: se o recálculo falhar, a troca é desfeita). Medição de 16/11/2026: a página de 50
  sai em ~150–190 ms (antes, a leitura inteira levava até 5,5 s e 5,7 MB).
- **Grava só a linha que mudou** (migration `20261116235500_relatorios_dos_paineis_gravam_so_o_que_mudou.sql`):
  o recálculo compara o resultado com as linhas guardadas, posição por posição, e só apaga,
  atualiza ou insere a posição diferente; a linha igual não é regravada. Antes, cada cálculo
  apagava e regravava tudo (cerca de 34.700 linhas, 16 MB, de hora em hora). O que o painel lê
  é o mesmo; `DT_CALCULO` continua sendo a hora do último cálculo.
- Limites de tempo: `ler_relatorio_do_painel`, `sincronizar_relatorio_do_painel` e
  `salvar_fonte_da_coluna` têm `statement_timeout` 30s e `lock_timeout` 15s próprios (o papel
  `authenticated` tem 8s e 3s; no minuto 17 o cron segura os locks por ~6s). Migration
  `20261116170000_limites_de_tempo_dos_paineis.sql`, aplicada; saiu da pasta porque a main tem outra
  com o mesmo timestamp (o SQL está em `tests/fixtures/limites-de-tempo-dos-paineis.*.sql`).
- `ler_relatorio_do_painel(área, relatório, página, por página)` exige o recurso e a área e aplica o
  recorte da coordenação (`FC_EDITAIS_VISIVEIS`) na leitura: página, total e download só com os
  editais que a pessoa vê. As três RPCs antigas (`listar_*_do_painel`) saíram.
- A tela pede só a página à vista e guarda as páginas lidas **em memória** (nunca no disco: a aba
  Aprovados tem dado pessoal); o cache cai quando o banco responde com outra data de cálculo, no
  Sincronizar (recalcula o relatório aberto) e na troca de fonte. "Sincronizado em" é a data do
  cálculo. O download pede todas as linhas ("Exportar em Excel": XLSX com o gerador de
  `src/lib/classificacao/exportacao.ts` e `fflate` sob demanda; "Salvar em PDF":
  `src/lib/base/exportacao-da-tabela.ts`).
- **Montar relatório** (16/11/2026 no topo; cartão desde 23/11/2026): os editais da área, sem os
  filtros da Visão geral (`recorteDaAreaInteira`, em `src/lib/paineis/relatorio-da-visao-geral.ts`).
  As linhas são as do estado da Visão geral, lidas ao abrir; "Aprovados" só para quem tem acesso à
  Lista de aprovados, e o banco registra o download.
- Largura das colunas: a alça na borda direita do cabeçalho (arrastar, ou ←/→ com foco nela) muda
  a largura; no primeiro arraste a tabela vai a layout fixo. A largura fica só em memória:
  recarregar a página volta às originais.
- O ⓘ da barra do relatório diz de onde vêm os dados (`ORIGEM_DOS_DADOS`) e, quando houver, as
  colunas com fonte trocada na área.
- Editais por cargo é uma linha por vaga: Seleção e lista de aprovados casam pelo código da vaga
  (as regras de `get_selecao_da_area`). Vagas imediatas (migration `20261116180000`), na ordem da
  Classificação: a linha do quadro de vagas do edital (`TB_QUADRO_VAGA_EDITAL`) ligada pelo nome da
  vaga (`FC_QUADRO_DA_VAGA`, só quando a ligação é única); sem ela, a convocação (a vaga ou o padrão
  do edital, abaixo de 10000, que é "chamar todos"); sem ela, o local da vaga publicado
  (`TB_LOCAL_VAGA_EDITAL`) quando um só casa com o cargo; por último, o número no título da vaga
  ("N vagas"; Cadastro Reserva = 0). A ligação pelo código da Empregare ficou de fora (custo de
  ~10 s por cálculo para 36 linhas). Conferências da verificação: a soma dos aprovados por vaga
  é o total do relatório Aprovados, e a soma dos inscritos é a dos editais (edital sem vaga na
  Seleção sai numa linha só, com os inscritos dele).
- Lacunas conhecidas: o ciclo do edital ficou para depois (texto livre, sem domínio); não há data de
  admissão no banco — a coluna traz a data em que o status atual (Contratado ou Migração) foi
  registrado; vagas imediatas vazias onde o edital não tem quadro de vagas importado nem convocação
  (em 16/11/2026: 919 de 2863 linhas na Saúde Indígena, 375 de 413 em Projetos, todas as 237 da
  SEDE) — falta de cadastro, não de cálculo. Em Projetos, os locais das vagas valem para todos os
  cargos do lugar e não dão o número por cargo.
- Dado pessoal: a aba Aprovados traz nome e matrícula ([[dados-pessoais]]).
- Paginação no banco: 50 linhas por página (25 ou 100), acima da tabela; setas travadas enquanto a
  página carrega.
- **Fontes dos dados** (migrations `20261113220000`, `20261113230000`, `20261113240000`; desenho em
  `docs/_arquivo/planos/2026-11-13-fontes-das-colunas-dos-paineis-design.md`): as 11 colunas
  editáveis (vagas, datas, inscritos, aprovados, nota, classificação, status, matrícula, data de
  admissão) podem vir, **por área**, de outra fonte conferida — visões `VW_<EDITAL|VAGA|APROVADO>_*`
  do schema `painel` (sem grant para a API), com a chave do grão e `COMMENT` na visão e na coluna.
  O seletor lista essas visões lendo o catálogo do PostgreSQL; fonte nova = visão nova numa
  migration. Só o Administrador em Relatórios troca (`TB_FONTE_COLUNA_PAINEL`, histórico em
  `TH_FONTE_COLUNA_PAINEL`). O cálculo dos relatórios monta o padrão e passa as linhas por
  `private."FC_APLICAR_FONTES_DO_PAINEL"`, que só usa nomes achados no catálogo: fonte que sumiu
  ou chave repetida deixam a célula vazia e avisam. Coluna fora do padrão tem `*` no cabeçalho
  (a fonte na dica) e o XLSX ganha a aba "Fontes". Nada de SQL digitado.

## Testes

`tests/editais-cargas-e-paineis-na-tela.test.ts` (bloco `modulos/paineis-de-dados`) (catálogo: grupos, data do cálculo, abrir e
voltar sem reler, exportar do cartão, Sincronizar de todos, falha uma vez, o relatório no endereço e o caminho antigo; tela, permissão, rota, paginação no banco, cache,
Sincronizar, downloads, gaveta de fontes, largura das colunas e ⓘ; os gerados no navegador: o
montador no endereço e com o recorte da Visão geral, a diretoria direto do cartão, o Resumo só com
o recurso `aprovados` e o atalho com a tela já montada), `tests/entrevistas-e-aprovados-na-tela.test.ts`
(bloco `componentes/lista-aprovados`, "Resumo por cargo e status (em Relatórios)", sobre o estado da
Lista), `tests/demais-regras.test.ts` (blocos `lib/relatorio-da-visao-geral` e
`lib/relatorio-da-diretoria`), `tests/editais-cargas-e-paineis.test.ts` (bloco `relatorios-dos-paineis`)
(colunas, página lida, arquivos, largura, origem), `tests/editais-cargas-e-paineis.test.ts` (bloco `fontes-dos-paineis`) (leitura das
fontes, permissão, aba Fontes), `tests/editais-cargas-e-paineis.test.ts` (bloco `fontes-dos-paineis-no-banco`) (o núcleo das fontes em
PGlite), `tests/editais-cargas-e-paineis.test.ts` (bloco `relatorios-prontos-dos-paineis-no-banco`) (resultado pronto em PGlite: página,
recorte da coordenação, Sincronizar 1/min, troca de fonte que falha, cálculo de todos) e
`tests/editais-cargas-e-paineis.test.ts` (bloco `vagas-imediatas-dos-paineis-no-banco`) (a ordem das fontes das vagas imediatas, de
`20261116180000`). As migrations aplicadas que montam esses bancos ficam em
`tests/fixtures/sql-do-banco/`.

## Relacionadas

- [[nova-tela-e-legado]] — como a tela entra no app
- [[modulo-acessos]] — quem vê
- [[modulo-barra-lateral]] — o bloco Dados do menu
- [regras-dos-paineis](../aya/regras-dos-paineis.md) — o que a Aya responde sobre a tela
- [[modulo-visao-geral]] — de onde vem o "Montar relatório" (e o atalho com o recorte dela)
- [[modulo-aprovados]] — de onde vem o Resumo por cargo e status
- [Desenho das fontes das colunas](../_arquivo/planos/2026-11-13-fontes-das-colunas-dos-paineis-design.md) e [plano](../_arquivo/planos/2026-11-13-fontes-das-colunas-dos-paineis.md) — feito no #829
- [Desenho do carregamento rápido](../_arquivo/planos/2026-11-16-paineis-carregamento-e-tabela-design.md) e [plano](../_arquivo/planos/2026-11-16-paineis-carregamento-e-tabela.md) — feito no #836
