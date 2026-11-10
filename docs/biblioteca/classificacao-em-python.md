---
tipo: modulo
area: modulo
atualizado: 2026-11-10
---

# Classificação em Python

Como a [[modulo-classificacao]] usa o job Python. Guia geral e histórico das etapas em
[python-no-monitora.md](../python-no-monitora.md) e [[python-e-jobs]].

## A cópia do motor

`python/monitora/classificacao/` é a cópia fiel do motor (`src/lib/classificacao/motor.ts`) e do
retrato, conferida pelos casos dourados `tests/fixtures/classificacao/casos-do-motor.json`, nos dois
lados. Os scripts `scripts/classificacao/` comparam o Python com o motor da tela.

## Etapa 2a: relatório de desempate

- Gerar a lista pede o relatório de desempate ao job (`registrar_lista_classificacao` → workflow
  `classificacao.yml`, chave da automação "Classificação em Python"); o job só grava o relatório
  quando o retrato que ele calcula é o da lista registrada.
- Na visão Listas, "Relatório de desempate sendo preparado…" até chegar (relê a cada 10 s, espera
  até 15 min); depois, "Relatório de desempate (XLSX)" e "(PDF)", com nome e inscrição.
- Versão 2 (`20261023230000_relatorio_de_desempate_versao_2.sql`): cabeçalho da lista, idade em anos
  na data de corte, resumo por critério, lista geral ou de cota no título do grupo; XLSX com Resumo,
  Grupos, Pares e Candidatos com filtro; PDF com índice por vaga e o cabeçalho da vaga repetido; a
  versão 1 continua abrindo.
- Se não conferir ou falhar, um aviso (`obter_desempate_da_lista`, `estadoDoRelatorio` em
  `src/lib/classificacao/relatorio-de-desempate.ts`).
- Banco: `20261023140000_classificacao_em_python_e_relatorio_de_desempate.sql` e
  `20261023170000_classificacao_em_python_etapa_2.sql`.

## Etapa 2b: "Gerar listas pelo Python"

Migration `20261023200000_classificacao_em_python_etapa_2b.sql`, atrás da chave da automação
"Gerar listas pelo Python" (`classificacao_calculo`), que nasce **desligada**: ligar só depois da
publicação do 114/2026; só vale com "Classificação em Python" (`classificacao`) também ligada
(`20261024110000`).

- Desligada, o "Gerar" é o de sempre (motor.ts + `registrar_lista_classificacao`; antes,
  `pedir_calculo_classificacao` só responde `{ligada: false}`).
- Ligada, `gerarLista` (`estado.ts`) pede o cálculo ao job, mostra "Calculando a lista… (até
  5 min)", relê o pedido a cada 3 s, recebe o retrato do Python e só registra
  (`registrar_lista_calculada`, que confere de novo no banco) quando ele é igual ao do motor.ts.
- Diferente: aviso e `registrar_divergencia_do_calculo` (só os caminhos). Falhou, não chegou ao
  GitHub ou passou do prazo: aviso com "Tentar de novo".
- Tela em `CalculoPeloPython` (`listas.tsx`); regras em `src/lib/classificacao/calculo-em-python.ts`.

## Relacionadas

- [[modulo-classificacao]] — a tela
- [[modulo-automacao]] — as duas chaves
- [[robos-e-agenda]] — como o banco dispara o workflow
- [[python-e-jobs]] — padrões do código Python
