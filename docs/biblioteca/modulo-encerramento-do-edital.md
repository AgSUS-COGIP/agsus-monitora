---
tipo: modulo
area: modulo
atualizado: 2026-11-10
---

# Módulo: Encerramento do edital

Peça, não tela: a tela de fim de edital (uma vez por pessoa e edital) e os selos no menu da conta,
montados pela moldura em `src/app/sistema.ts` e avisados por `src/modulos/analises/marcos.ts`.
Pasta `src/modulos/encerramento-do-edital/`; banco em
`supabase/migrations/20261021180000_encerramento_do_edital.sql`.

## Como funciona

- A tela abre quando o lote chega a 100% (regra e números do banco). Em cima, os totais do edital e
  o agradecimento à equipe; embaixo, só a parte de quem está vendo. Sem ranking, sem números de
  outras pessoas. O banco decide quando o edital está encerrado.
- Os fogos são os do catálogo (`src/modulos/comemoracao/`): respeitam a configuração, a preferência
  pessoal e `prefers-reduced-motion`. A tela só abre com as comemorações ligadas no sistema;
  desligadas, nada é marcado e a tela aparece quando religarem.
- Selos no perfil (`selos-do-edital.tsx`): um por edital encerrado em que a pessoa concluiu ao menos
  uma ficha ("114/2026"); quem fechou o edital leva "fechou o 114". Sem edital encerrado, nada
  aparece; a marca no avatar só diz que há selo.

## Arquivos

- `encerramento-do-edital.tsx` — a tela; `selos-do-edital.tsx`; `encerramento-do-edital.css`.
- `estado.ts` (sem React, lido por `useSyncExternalStore`): `verificar()` lê
  `obter_encerramentos_do_edital` ao abrir o sistema e quando os marcos de Análises avisam que um
  edital zerou (função ausente ou erro: nada a mostrar, sem aviso); `fechar()` grava o visto e abre
  o próximo. Leitura já a caminho não reabre o que a pessoa fechou.
- `src/lib/encerramento-do-edital.ts` — leitura de `obter_encerramentos_do_edital`, tela a mostrar,
  selos do perfil e fogos do encerramento (quem fechou o edital).

## Relacionadas

- [[modulo-configuracoes]] — catálogo de comemorações
- [[modulo-analises]] — os marcos que avisam
- [[modulo-avaliacao-documental]] — o lote e as fichas concluídas
