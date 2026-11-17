---
tipo: modulo
area: modulo
atualizado: 2026-11-16
---

# Módulo: Painéis (bloco Dados)

Relatórios de conferência da área escolhida, em tabela, para baixar em CSV e XLSX: Resumo dos
editais, Editais por cargo e Aprovados, um por aba. Rota `/<área>/paineis-de-dados`, pasta
`src/modulos/paineis-de-dados/`. No menu, é o item Painéis do bloco **Dados**, abaixo de Processo
seletivo (`BLOCO_DE_DADOS` em `src/lib/menu-lateral.ts`). Não confundir com os painéis externos
(`panel:<código>`, [[modulo-paineis-externos]]).

## Arquivos

```
paineis-de-dados.tsx  abas, tabela paginada, alça de largura, ⓘ da origem e botões; criarPaineisDeDados()
estado.ts             store sem React: relatório ativo, página lida por relatório e área, cache em memória,
                      larguras, download, gaveta de fontes
fontes-dos-dados.tsx  a gaveta "Fontes dos dados" (uma coluna por bloco: Origem, Coluna, Motivo)
paineis-de-dados.css  a alça de largura e o painel do ⓘ
```

Regras puras em `src/lib/relatorios-dos-paineis.ts` (colunas, leitura da página, CSV, XLSX, nome do
arquivo, largura arrastada e texto da origem) e `src/lib/fontes-dos-paineis.ts` (leitura das fontes).
RPCs no contrato (`src/lib/rpc-contrato.ts`): `ler_relatorio_do_painel`,
`sincronizar_relatorio_do_painel`, `listar_fontes_do_painel` e `salvar_fonte_da_coluna`.

## Regras e contratos

- Permissão: recurso `paineis_dados` (Painéis (Dados)), liberado em Acessos; aba
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
  cálculo. O download pede todas as linhas (CSV com `;`, BOM e células protegidas; XLSX com o
  gerador de `src/lib/classificacao/exportacao.ts` e `fflate` sob demanda).
- **Montar relatório** (16/11/2026; antes no menu da conta): o botão no topo abre o montador da
  Visão geral (`src/modulos/visao-geral/montador-de-relatorio.tsx`, [[modulo-visao-geral]]) com
  todos os editais da área, sem os filtros da Visão geral (`recorteDaAreaInteira`, em
  `src/lib/relatorio-da-visao-geral.ts`). As linhas são as do estado da Visão geral, lidas no
  clique; "Aprovados" só para quem tem acesso à Lista de aprovados.
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
  migration. Só o Administrador em Painéis troca (`TB_FONTE_COLUNA_PAINEL`, histórico em
  `TH_FONTE_COLUNA_PAINEL`). O cálculo dos relatórios monta o padrão e passa as linhas por
  `private."FC_APLICAR_FONTES_DO_PAINEL"`, que só usa nomes achados no catálogo: fonte que sumiu
  ou chave repetida deixam a célula vazia e avisam. Coluna fora do padrão tem `*` no cabeçalho
  (a fonte na dica) e o XLSX ganha a aba "Fontes". Nada de SQL digitado.

## Testes

`tests/modulos/paineis-de-dados.test.ts` (tela, permissão, rota, paginação no banco, cache,
Sincronizar, downloads, gaveta de fontes, largura das colunas, ⓘ e Montar relatório), `tests/relatorios-dos-paineis.test.ts`
(colunas, página lida, arquivos, largura, origem), `tests/fontes-dos-paineis.test.ts` (leitura das
fontes, permissão, aba Fontes), `tests/fontes-dos-paineis-no-banco.test.ts` (o núcleo das fontes em
PGlite), `tests/relatorios-prontos-dos-paineis-no-banco.test.ts` (resultado pronto em PGlite: página,
recorte da coordenação, Sincronizar 1/min, troca de fonte que falha, cálculo de todos) e
`tests/vagas-imediatas-dos-paineis-no-banco.test.ts` (a ordem das fontes das vagas imediatas, de
`20261116180000`). As migrations aplicadas que montam esses bancos ficam em
`tests/fixtures/sql-do-banco/`.

## Relacionadas

- [[nova-tela-e-legado]] — como a tela entra no app
- [[modulo-acessos]] — quem vê
- [[modulo-barra-lateral]] — o bloco Dados do menu
- [regras-dos-paineis](../aya/regras-dos-paineis.md) — o que a Aya responde sobre a tela
- [Desenho das fontes das colunas](../_arquivo/planos/2026-11-13-fontes-das-colunas-dos-paineis-design.md) e [plano](../_arquivo/planos/2026-11-13-fontes-das-colunas-dos-paineis.md) — feito no #829
- [Desenho do carregamento rápido](../_arquivo/planos/2026-11-16-paineis-carregamento-e-tabela-design.md) e [plano](../_arquivo/planos/2026-11-16-paineis-carregamento-e-tabela.md) — feito no #836
