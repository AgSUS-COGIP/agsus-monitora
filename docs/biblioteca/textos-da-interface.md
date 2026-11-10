---
tipo: regra
area: front
atualizado: 2026-11-10
---

# Textos da interface

A tela mostra o que a pessoa precisa para agir, e mais nada. Explicação é com a assistente Aya
(`docs/aya/`), não com parágrafo na tela.

## O que não entra

- Parágrafo de ajuda, subtítulo que descreve o óbvio, dica longa.
- Selo "Somente consulta": quem só lê não vê os controles de edição.
- Sobretítulo e dica em card de gráfico (`CardDeGrafico` não tem).
- Termo de banco ou de código na tela.

## O que fica

- Rótulos, erros, confirmações, estados vazios curtos e avisos que pedem ação.
- **Data de atualização: discreta e uma vez só** (`.status-discreto`, no `TopoDoPainel`).
- Título e área ficam no cabeçalho do app (vêm da navegação); a tela não repete.

## Linguagem (DESIGN.md, seção 11)

- Português do Brasil, com acentos. Sentence case: sem `text-transform: uppercase` em rótulos,
  títulos e botões.
- Verbos de ação: "Importar lista", "Publicar edital", "Tentar de novo".
- Erro diz o que aconteceu e o que fazer; o detalhe técnico fica no console, não na tela.
- Confirmação cita o objeto: "Excluir o edital 101/2026?".
- Número no formato brasileiro (`1.308`, `60,5%`), com `toLocaleString("pt-BR")` (ex.:
  `formatarNumero` em `src/lib/editais-do-nucleo.ts`).
- **Carregando não é zero**: enquanto o dado não chegou, skeleton (`LinhasEsqueleto`,
  `BlocosEsqueleto`, `Kpi` com `carregando`), nunca números zerados. Zero é sempre dado apurado.
- Primeira carga que falhou: `ErroAoCarregar` (aviso com "Tentar novamente").

## Onde a explicação mora

Cada tela tem as regras explicadas para a Aya em `docs/aya/regras-*.md` (por exemplo
`regras-dos-editais.md`, `regras-da-selecao.md`). Todo número que a Aya precisa dizer tem de estar
escrito lá: a Aya só responde com o que está no material ([[aya-base-de-conhecimento]]).

## Relacionadas

- [[design-e-tokens]] — o resto do guia de interface
- [[componentes-padrao]] — os componentes de estado (vazio, carregando, erro)
- [[acessibilidade]] — erros associados ao campo, `aria-live`
- [[modulo-aya]] — o painel que explica
