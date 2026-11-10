---
tipo: modulo
area: modulo
atualizado: 2026-11-10
---

# Módulo: Triagem

Página do Processo seletivo (antes "Pré-classificação"), rota `/<área>/triagem` (`src/lib/rotas.ts`),
sob o mesmo recurso de permissão da Avaliação documental (`src/app/telas.tsx`). A tela mora em
`src/modulos/avaliacao-documental/pre-classificacao.tsx`; a pasta `src/modulos/triagem/` guarda a
regra própria da Triagem. Mostra, por vaga, a Lista Geral de Classificação Provisória por ART e o lote.

## Pasta `src/modulos/triagem/`

```
editor-da-regra.tsx       a regra da Triagem do edital: etapa 1 das Regras do edital (Editais ›
                          Regras do edital), aberta também pelo "Editar nas Regras do edital"
resumo-da-regra.tsx       resumo só-leitura no topo da Triagem: versão, situação (conferida ou a
                          conferir) e as regras em uma linha cada; o botão leva às Regras do edital
usar-regra-da-triagem.ts  lê obter_regra_triagem ao abrir o edital (resumo, conferência que libera
                          o Recalcular, lote por vaga, que grava versão nova por salvar_regra_triagem)
triagem.css               só tokens
```

Regras puras em `src/lib/triagem/regra-da-triagem.ts` (`obterRegraDaTriagem`,
`salvarRegraDaTriagem`, `conferirRegraDaTriagem`, `errosDaRegraDaTriagem`).

## A regra da Triagem

- Regra própria, com versões, separada das regras da Avaliação documental e da Classificação:
  requisitos e eliminação automática, nota da lista (declarada ou ART) e tolerância, desempate,
  modalidade das cotas, nível da vaga e lote (conta o cadastro reserva, lote por modalidade,
  empatados no corte entram, a linha anda, publica a reposição).
- Requisitos, nota, desempate e lote saíram da regra da Avaliação documental em 29/10/2026
  (`TB_REGRA_TRIAGEM`/`TH_REGRA_TRIAGEM`, migration `20261029160000_regras_proprias_da_triagem`).
- Quem coordena o edital (ou o administrador global) grava versão nova com motivo; a versão nova
  fica "a conferir" e outra pessoa da coordenação confere (dupla conferência, no banco). Quem não
  coordena vê só para ler.
- Salvar não recalcula: a Triagem roda no fim do robô da Empregare ou no "Recalcular" (edital com
  inscrições congeladas, como o 114/2026, não recalcula).

## A tela (fase F2 da Avaliação documental)

- A Provisória por ART e o lote de cada vaga, como o job Python gravou
  (`scripts/pre_classificacao/`, `python/monitora/avaliacao_documental/`); contadores (inscritos,
  eliminados, ranqueados, lote "N de M", divergência ART × declarada), linha de corte, eliminados
  com o motivo e avisos da vaga. Cabeçalho com Pessoas, Por vaga e Regra; listas oficiais na Regra.
- Aba Pessoas (`pessoas-da-triagem.tsx`): busca por código ou nome no edital todo, vaga e situação,
  50 por vez do banco; regras em `src/lib/avaliacao-documental/pessoas-da-triagem.ts`.
- "Recalcular" (coordenação): RPC `disparar_robo` com o edital (o banco pede ao GitHub), travado com
  a regra não conferida ou o job rodando; o resultado do pedido fica na aba (motivo da recusa ou
  "pedido"); a aba acompanha por `obter_situacao_pre_classificacao` (~0,4 KB a cada 15 s) e relê o
  resultado só quando termina.
- Cargo, lotação e nível de cada vaga vêm do quadro de vagas
  (`private."FC_QUADRO_DA_VAGA_EMPREGARE"`): pelo nome da vaga na planilha e, com análise do
  MONITORA (114/2026), pelo título da vaga na Empregare — o número do CARGO e, com o mesmo cargo em
  mais de uma lotação, a UF dos inscritos de cada vaga irmã (`20261013140000_quadro_da_vaga_pelo_titulo`);
  o nível sai do "(Nível …)" do cargo.
- Tamanho do lote por vaga: o campo vira `lote.por_vaga` numa versão nova da regra (com motivo).
- Listas oficiais PROVISORIA e LOTE (cada reposição, se a regra publica): registradas no banco
  (`registrar_lista_pre_classificacao`) e exportadas pelo gerador da Classificação.
- Inclusão no lote por decisão da coordenação e os comunicados de eliminação em lote também ficam
  aqui (ver [[modulo-avaliacao-documental]]).

## Quem calcula

A conta é do job Python; `src/lib/avaliacao-documental/pre-classificacao.ts` só faz a prévia
(tamanho sugerido do lote), conferida com o Python pelos casos de
`tests/fixtures/avaliacao-documental/casos-de-pre-classificacao.json`. A aba não recalcula ninguém:
lê o que o job gravou (`src/lib/avaliacao-documental/tela-da-pre-classificacao.ts`). Explicações para
quem usa: `docs/aya/regras-da-avaliacao-documental.md` (Abas, Regras e Provisória da Triagem).

Testes: `tests/modulos/avaliacao-documental-pre-classificacao.test.js`,
`tests/python/test_pre_classificacao.py`,
`tests/python/test_pre_classificacao_job.py`.

## Relacionadas

- [[modulo-avaliacao-documental]] — a etapa seguinte; a tela da Triagem mora na pasta dela
- [[modulo-regras-do-edital]] — onde a regra da Triagem se edita (etapa 1)
- [[modulo-classificacao]] — exporta as listas PROVISORIA e LOTE
- [[python-e-jobs]] — o job da triagem
- [[robos-e-agenda]] — robô da Empregare e o "Recalcular"
- [[modulo-automacao]] — chave "Triagem automática"
