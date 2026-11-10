---
tipo: regra
area: front
atualizado: 2026-11-10
---

# Planilhas (catálogo único)

**`src/lib/planilhas.ts` é o único lugar do código com link, caminho ou bucket de planilha.** Quem
consome uma planilha importa de lá; ninguém escreve o endereço de novo em outro arquivo.
`tests/planilhas.test.js` falha se um link de planilha aparecer fora dele.

## Regras

- Cada entrada diz o que a planilha é, onde mora e quem a usa (`usadaEm`): trocar um endereço é
  editar uma linha ali e nada mais. Planilha nova entra ali, com `usadaEm`.
- O que o catálogo tem hoje: o modelo de importação da lista de aprovados (arquivo estático
  `public/assets/modelo-importacao-lista-aprovados.xlsx`), o bucket `listas-aprovados` da lista
  importada (Supabase Storage), a regra do link da planilha de origem de cada análise e a planilha de
  Lotações.
- Duas planilhas não têm endereço fixo, e isso é do domínio: a lista de aprovados importada existe
  uma por edital, no Storage; a planilha de origem de cada análise vem do banco, linha a linha
  (`origem_arquivo_id`), e no catálogo fica só a regra que transforma o id em link.
- As planilhas lidas pelos robôs (Entrevistados, Auditoria) e as do Apps Script são operadas como
  cargas ([[cargas-de-planilha]]).

## Relacionadas

- [[regras-do-codigo]] — a regra geral
- [[modulo-aprovados]] — o modelo e o bucket da lista
- [[modulo-analises]] — o link da origem de cada análise
