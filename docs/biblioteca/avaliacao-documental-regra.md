---
tipo: modulo
area: modulo
atualizado: 2026-11-10
---

# Avaliação documental: a regra

A aba Regra da [[modulo-avaliacao-documental]]. O editor é montado em Editais › Regras do edital,
etapa 2 ([[modulo-regras-do-edital]]); sem Provisória nem lote, que são da [[modulo-triagem]].

## Assistente da regra

A aba abre no **assistente** (`assistente/`, em TSX, contratos em `assistente/tipos.ts` e
`src/lib/avaliacao-documental/tipos-da-regra.ts`); o **Modo avançado** é o formulário inteiro de
`regra.tsx`. Os dois editam o mesmo rascunho e salvam o mesmo JSON (`regra.ts`) pelo
`salvar_regra_analise`. O rascunho é guardado a cada mudança (por edital e por pessoa, em
`TB_RASCUNHO_REGRA`, com cópia no navegador sem conexão: `src/app/rascunho-da-regra.ts`, hook
`src/app/usar-rascunho-da-regra.ts`) e volta ao abrir ("Continuar de onde parei" / "Descartar");
salvar a versão (`aoGravarVersao` do `estado.ts`) apaga. Cinco passos:

1. ponto de partida (`partida.tsx`): versão vigente, regra conferida de outro edital da área,
   modelo ou do zero — sempre cópia independente;
2. cardápio (`cardapio.tsx`): cartões que ligam ou desligam um bloco, uma eliminação automática ou
   o corte por pontos mínimos, com valores sugeridos das fontes (nenhum peso no código); o grupo
   "Na inscrição" vem primeiro (`GRUPOS_DO_CARDAPIO`);
3. perguntas da Empregare (`perguntas.tsx`): as colunas de cada vaga (`obter_apoio_regra_analise`)
   e as respostas da última carga (`obter_perguntas_carga_analise`, instantâneo calculado em Python
   pelo robô; pedidas só ao abrir este passo ou o formulário do modo avançado), ligação automática
   pelo enunciado, verde/amarelo/vermelho pela regra de `nota-declarada.ts`, e a nota declarada;
4. nota mínima e desempate (`nota-e-desempate.tsx`, `lista-ordenavel.tsx`,
   `seletor-de-criterios.tsx`): a regra de classificação (gravada por `salvar_regra_classificacao`,
   com a permissão dela; sem Editor, só leitura com aviso) e o desempate da Provisória;
   "Acrescentar critério" abre o catálogo inteiro de cada lista, em grupos e com busca
   (`src/lib/avaliacao-documental/catalogo-de-desempate.ts`);
5. testar e salvar (`conferir.tsx`), nesta ordem: o resumo de uma página (`resumo-da-regra.ts`,
   "Copiar para o SEI" e imprimir), a comparação de versões (`comparar-regras.ts`), `previa.tsx`
   (fechada) e nome + motivo + salvar, com a lista do que falta ao lado do botão
   (`pendencias-do-salvar.ts`; cada item leva ao passo e ao campo). No topo, o cartão de estado
   (`estado-do-passo-5.tsx`: sem mudanças, pronto, salvo — com "Marcar como conferida" quando pode)
   e, preso ao pé, o botão do que vai acontecer (salvar, concluir sem mudanças ou fechar). A aba
   remonta a cada versão; `regraSalvaAgora` (estado.ts) faz o assistente voltar ao passo 5.

"Conferida" é dupla conferência: quem salvou a versão não confere (o banco recusa em
`conferir_regra_analise`; o administrador global pode), e a regra vigente diz à tela
(`conferir_pede_outra_pessoa`). Migration `20261008120000_assistente_da_regra.sql`. O critério de
aceite (refazer a v7 do 93/2026 a partir do PROJ26) está em
`tests/lib/avaliacao-documental-assistente.test.js`.

Na fase F3 a aba ganhou o lote "Todos com a nota mínima" (item 8.2.6 do 93/2026) e os desempates da
Provisória (60 anos ou mais, experiência declarada com a pergunta, maior idade, candidatura) — hoje
na regra da Triagem. A convocação para a Análise Comportamental (93/2026, item 8.2.10.11: até 5× as
vagas imediatas e até a 10ª posição do cadastro reserva) é regra da lista CONVOCACAO da
Classificação, não do lote.

## Diferenças por cargo

A regra varia por nível (`por_nivel`) e, quando o edital pede, por cargo (`regra.por_cargo`;
formato, conta e validação em `src/lib/avaliacao-documental/regra-por-cargo.ts`). Cada diferença
vale para códigos de vaga da Empregare e/ou o começo do nome do cargo ("CARGO 15", palavras
inteiras) e muda, por bloco: CURSOS teto/faixas/extras, TITULOS teto/extras, VINCULOS teto/área
exigida e DOCUMENTO requisitos (rótulo, motivo da eliminação, termos e "não pontua em" do 8.2.7).
Precedência: cargo > nível > padrão; o código da vaga vale antes do nome. A regra da vaga
(`regraDaVaga`) é a mesma no JS, no Python (`regra_da_vaga` em `pontuacao.py`, casos dourados "por
cargo: …") e no banco (`private."FC_REGRA_DA_VAGA"`, `20261013130000_regra_por_cargo.sql`):
`salvar_rascunho_ficha` e `concluir_ficha` gravam a vaga e o cargo da ficha no lançamento e validam.

- assistente (passo 2) e modo avançado: `assistente/diferencas-por-cargo.tsx` (vagas e cargos do
  quadro vêm de `obter_apoio_regra_analise`);
- ficha: `ficha/diferencas-do-cargo.tsx` — os requisitos DAQUELE cargo com Confere / Não confere e o
  motivo pronto (o Não confere entra como motivo que elimina), as linhas extras (ex.: UMCQA, +5, até
  o teto do cargo; `blocos[X].extras`), o aviso do 8.2.7 e a área exigida da experiência; as faltas
  "requisito" e "extra" em `pendenciasDaFicha` (e `FC_PENDENCIAS_FICHA`);
- prévia: o seletor "Cargo" aplica uma diferença ao candidato fictício.

Testes: `tests/lib/avaliacao-documental-regra-por-cargo.test.js`,
`tests/modulos/avaliacao-documental-ficha-por-cargo.test.js`,
`tests/modulos/avaliacao-documental-diferencas-por-cargo.test.js`.

## Relacionadas

- [[modulo-avaliacao-documental]] — a tela
- [[modulo-classificacao]] — o passo 4 grava a regra de classificação
- [[python-e-jobs]] — perguntas da carga e conta oficial
