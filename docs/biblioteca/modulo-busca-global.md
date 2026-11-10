---
tipo: modulo
area: modulo
atualizado: 2026-11-10
---

# Módulo: Busca global (Ctrl+K)

Busca nos editais do monitoramento, filha da raiz React. Pasta `src/componentes/busca-global/`
(`busca-global.tsx`: painel, atalhos, seleção por teclado e mouse, realce e montagem; contratos em
`tipos.ts`); regras puras em `src/lib/busca-global.ts`.

## Como funciona

- Ctrl+K ou Cmd+K abre a busca com sessão conectada. Pesquisa os nove campos do monitoramento, em
  todas as áreas, sem diferenciar maiúsculas e acentos; mantém a ordem da fonte e para em 12.
- O campo começa vazio; setas e Enter escolhem, Esc e o fundo fecham; o modal mantém e devolve o foco.
- A escolha publica `agsus:busca-global-escolhida` com `detail.id`. A navegação em `src/app/` cuida
  das permissões, da área e dos filtros da tela. A busca não concede acesso a dado que a carga ou a
  RLS não entregaram.

## Dados compartilhados do monitoramento

`src/componentes/dados-do-monitoramento.ts`, `tipos-do-monitoramento.ts` e `usar-area-atual.ts`
declaram o snapshot compartilhado (linhas de `TB_MONITORAMENTO_INDIGENA` e catálogo `TD_UNIDADE`),
sua assinatura e o recorte por área (`linhasDaArea`, `soDosEditais`). Listas só leitura. Carga sob
demanda: só as páginas de `src/lib/telas-com-linhas.ts` (via `src/app/pagina-aberta.ts`) ou
`usarLinhasDoMonitoramento` fazem a carga lê-las.

- A publicação valida com `src/lib/linhas-do-monitoramento.ts`: aceita registros, ids numéricos
  finitos ou texto não vazio, campos textuais conhecidos como texto ou ausentes. Nulos viram
  ausentes; registros malformados são descartados; colunas extras ficam `unknown`. Não substitui os
  contratos das consultas de cada módulo.
- Linhas sem id alimentam indicadores, mas não viram resultado selecionável nem id de recorte.
- A área usa `CO_AREA` e mantém a regra de Saúde Indígena para cache antigo sem a coluna. Sair limpa
  linhas e estado de carga, mantendo a área da aba; a área é corrigida quando chegam as permissões
  do próximo perfil.

## Testes

`tests/busca-global.test.js`, `tests/componentes/busca-global.test.ts`,
`tests/componentes/area-atual.test.ts`, `tests/componentes/dados-do-monitoramento.test.ts`;
contratos em `tests/tipos/busca-global.tsx` (typecheck do frontend).

## Relacionadas

- [[legado-fala-com-react]] — a escolha vai ao legado por evento
- [[carga-da-entrada]] — de onde vêm as linhas
- [[areas-do-sistema]] — recorte por área
- [[acessibilidade]] — foco e teclado no modal
