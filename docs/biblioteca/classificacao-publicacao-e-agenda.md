---
tipo: modulo
area: modulo
atualizado: 2026-11-10
---

# Classificação: publicação, agenda e documento

Partes da [[modulo-classificacao]] que levam o resultado para fora da tela.

## Publicar como lista de aprovados

- O resultado FINAL é a fonte da Lista de aprovados. "Publicar como lista de aprovados"
  (`publicar-aprovados.tsx`, resultado final, editor) cria a lista vigente do edital
  (`TB_LISTA_APROVADO` com `TP_ORIGEM` = `CLASSIFICACAO`), levando status, matrícula, sub judice e
  anexos de quem já estava na lista. Mostra o que muda em relação à lista vigente (entram, saem,
  mudam de posição, preservados, sub judice mantidos) e a revisão de quem não casou.
- Casamento das pessoas, resumo e candidatos do retrato em `src/lib/publicacao-de-aprovados.ts`; o
  banco confere os vínculos e grava `TH_PUBLICACAO_APROVADO`
  (`20261005160000_lista_de_aprovados_da_classificacao.sql`, ensaio e rollback com o mesmo nome).
  A Lista de aprovados mostra a origem e, no modal do edital, oferece publicar daqui.
- Modal e regras em TypeScript/TSX; contratos em `src/lib/tipos-da-publicacao-de-aprovados.ts` e
  validação das respostas em `src/lib/dados-da-publicacao-de-aprovados.ts`. A prévia exige os
  candidatos da lista vigente com identidades únicas e coleções válidas, sem descartar pessoas para
  montar uma revisão parcial. A confirmação valida quantidade e pendências retornadas pelo banco.
- Testes: `tests/lib/publicacao-de-aprovados.test.ts`,
  `tests/lib/dados-da-publicacao-de-aprovados.test.ts`, `tests/tipos/publicacao-da-classificacao.tsx`
  e o fluxo em `tests/modulos/classificacao.test.js`.

## Agenda das entrevistas

- Visão "Agenda" (`agenda.tsx`): regra da agenda (versões), gerar pela regra, avisos (não cabe,
  sobra), ajuste manual com conflito, XLSX; o botão "Agenda das entrevistas" da convocação abre esta
  visão. Store em `estado-da-agenda.ts` (`obter_agenda_entrevista`, `salvar_regra_agenda_entrevista`,
  `salvar_agenda_entrevista`); a agenda salva preenche DATA e HORA do documento da convocação
  (`agendaDoDocumento`).
- Motor em `src/lib/agenda-das-entrevistas.ts`; banco em
  `20261005120000_agenda_das_entrevistas.sql` (ensaio e rollback com o mesmo nome). Conduzir
  entrevistas abre a fila em Hoje pela agenda salva (`src/modulos/entrevistas/fila-do-dia.tsx`).
- Tela, estado e regras em TypeScript/TSX; contratos em `src/lib/tipos-da-agenda.ts`, validação em
  `src/lib/dados-da-agenda.ts`. Convocação inválida mostra erro e bloqueia a geração; a convocação
  registrada que não veio (rede, banco) mostra erro com "Tentar novamente", sem cair no cálculo
  atual. Respostas antigas de gravação não mudam dados, flags ou avisos depois de trocar de edital
  ou usuário (inclusive A → B → A). Falha ao atualizar o mesmo edital preserva a agenda aberta.
- A agenda é lida por GET (`obter_agenda_entrevista` é STABLE): o supabase-js repete sozinho quando a
  conexão cai; a falha que sobra diz o motivo (rede, permissão, edital) e vai ao console. Regra da
  agenda não salva e edital sem lista de convocação não são erro. A convocação registrada é lida uma
  vez por lista (e no "Tentar novamente"), não a cada releitura do edital.
- Testes: `tests/lib/dados-da-agenda.test.ts`, `tests/modulos/agenda-contexto-de-gravacao.test.js`,
  `tests/tipos/agenda-da-classificacao.tsx`, `tests/modulos/agenda-das-entrevistas.test.js`,
  `tests/lib/agenda-das-entrevistas.test.ts`.

## Documento oficial (SEI, DOCX, PDF, XLSX)

- "Como fica no SEI" (`documento.tsx`): quase tela cheia (ou tela cheia), folha A4 com zoom (escala
  em `src/lib/classificacao/escala-da-previa.ts`), painel recolhível com as abas Dados | Textos |
  Colunas e rodapé fixo; no celular, uma coluna. Aba Colunas (`colunas-do-documento.tsx`): marcar e
  ordenar (setas ou arrastar) as colunas, por publicação (`src/lib/classificacao/colunas-do-documento.ts`).
- `documento-sei.ts` (modelo das publicações do SEI, textos-padrão do 83/2026 e do 100/2026) e
  `documento-docx.ts` (Word com papel timbrado), em `src/lib/classificacao/`;
  `documento-no-navegador.ts`: área de transferência (HTML + texto), logo em PNG, impressão.
- Textos e colunas ajustados pelo gestor ficam na regra (`DS_CONFIGURACAO.documento`, `.colunas` por
  publicação, `.desempate` = a nota abaixo de cada tabela, geral ou de cota, com empate de nota
  resolvido; sem migration); o cabeçalho da agência, em Configurações › Marca
  (`documento_cabecalho`, `src/lib/cabecalho-dos-documentos.ts`).

## Relacionadas

- [[modulo-aprovados]] — onde a lista publicada aparece
- [[modulo-entrevistas]] — usa a agenda salva
- [[modulo-configuracoes]] — cabeçalho dos documentos (Marca)
- [[classificacao-contratos-e-testes]] — contratos dos documentos
