---
tipo: modulo
area: modulo
atualizado: 2026-11-13
---

# Módulo: Painéis (bloco Dados)

Relatórios de conferência da área escolhida, em tabela, para baixar em CSV e XLSX: Resumo dos
editais, Editais por cargo e Aprovados, um por aba. Rota `/<área>/paineis-de-dados`, pasta
`src/modulos/paineis-de-dados/`. No menu, é o item Painéis do bloco **Dados**, abaixo de Processo
seletivo (`BLOCO_DE_DADOS` em `src/lib/menu-lateral.ts`). Não confundir com os painéis externos
(`panel:<código>`, [[modulo-paineis-externos]]).

## Arquivos

```
paineis-de-dados.tsx  abas, tabela e botões; criarPaineisDeDados() → { estado, conteudo, nome, render() }
estado.ts             store sem React: relatório ativo, leitura por relatório e área, download, gaveta de fontes
fontes-dos-dados.tsx  a gaveta "Fontes dos dados" (uma coluna por bloco: Origem, Coluna, Motivo)
```

Regras puras em `src/lib/relatorios-dos-paineis.ts` (colunas, leitura da resposta, CSV, XLSX e
nome do arquivo) e `src/lib/fontes-dos-paineis.ts` (leitura das fontes). RPCs no contrato
(`src/lib/rpc-contrato.ts`): `listar_resumo_dos_editais_do_painel`,
`listar_editais_por_cargo_do_painel`, `listar_aprovados_do_painel`, `listar_fontes_do_painel` e
`salvar_fonte_da_coluna`.

## Regras e contratos

- Permissão: recurso `paineis_dados` (Painéis (Dados)), liberado em Acessos; aba
  `paineis-de-dados` em `TB_ABA`, nas três áreas (migration `20261113200000_paineis_no_bloco_dados.sql`).
- As leituras (migration `20261113210000_relatorios_dos_paineis.sql`) exigem o recurso e a área e
  seguem o recorte da coordenação (`FC_EDITAIS_VISIVEIS`); só editais ativos e fora de treinamento,
  e só a lista de aprovados vigente e ativa.
- Cada relatório é lido na primeira vez que a aba aparece na área; "Sincronizar" (topo da página)
  relê o aberto e marca os outros para relerem. O download
  sai das linhas da tela (CSV com `;`, BOM e células protegidas; XLSX com o gerador de
  `src/lib/classificacao/exportacao.ts` e `fflate` sob demanda).
- Editais por cargo é uma linha por vaga: Seleção e lista de aprovados casam pelo código da vaga
  (as regras de `get_selecao_da_area`); as vagas imediatas saem do título da vaga ("N vagas";
  Cadastro Reserva = 0). O quadro de vagas do edital (`TB_QUADRO_VAGA_EDITAL`) não tem o código da
  vaga e escreve o cargo de outro jeito: na verificação de 13/11/2026, casar pelo nome deixou mais
  da metade das linhas desencontradas. Conferências da verificação: a soma dos aprovados por vaga
  é o total do relatório Aprovados, e a soma dos inscritos é a dos editais (edital sem vaga na
  Seleção sai numa linha só, com os inscritos dele).
- Lacunas conhecidas: o ciclo do edital ficou para depois (texto livre, sem domínio); não há data de
  admissão no banco — a coluna traz a data em que o status atual (Contratado ou Migração) foi
  registrado; vagas imediatas só onde o título da vaga diz (na Saúde Indígena, cerca de metade).
- Dado pessoal: a aba Aprovados traz nome e matrícula ([[dados-pessoais]]).
- Paginação: 50 linhas por página (25 ou 100), acima da tabela; o download leva todas as linhas.
- **Fontes dos dados** (migrations `20261113220000`, `20261113230000`, `20261113240000`; desenho em
  `docs/superpowers/specs/2026-11-13-fontes-das-colunas-dos-paineis-design.md`): as 11 colunas
  editáveis (vagas, datas, inscritos, aprovados, nota, classificação, status, matrícula, data de
  admissão) podem vir, **por área**, de outra fonte conferida — visões `VW_<EDITAL|VAGA|APROVADO>_*`
  do schema `painel` (sem grant para a API), com a chave do grão e `COMMENT` na visão e na coluna.
  O seletor lista essas visões lendo o catálogo do PostgreSQL; fonte nova = visão nova numa
  migration. Só o Administrador em Painéis troca (`TB_FONTE_COLUNA_PAINEL`, histórico em
  `TH_FONTE_COLUNA_PAINEL`). As RPCs dos relatórios montam o padrão e passam as linhas por
  `private."FC_APLICAR_FONTES_DO_PAINEL"`, que só usa nomes achados no catálogo: fonte que sumiu
  ou chave repetida deixam a célula vazia e avisam. Coluna fora do padrão tem `*` no cabeçalho
  (a fonte na dica) e o XLSX ganha a aba "Fontes". Nada de SQL digitado.

## Testes

`tests/modulos/paineis-de-dados.test.ts` (tela, permissão, rota, paginação, downloads e gaveta de
fontes), `tests/relatorios-dos-paineis.test.ts` (colunas e arquivos), `tests/fontes-dos-paineis.test.ts`
(leitura das fontes, permissão, aba Fontes) e `tests/fontes-dos-paineis-no-banco.test.ts` (o núcleo em
PGlite: catálogo, troca por área, nome forjado, chave repetida, fonte que sumiu, rollback).

## Relacionadas

- [[nova-tela-react]] — como a tela entra no app
- [[permissoes-e-perfis]] — quem vê
- [[modulo-barra-lateral]] — o bloco Dados do menu
