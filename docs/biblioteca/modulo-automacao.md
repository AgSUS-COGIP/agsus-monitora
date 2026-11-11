---
tipo: modulo
area: modulo
atualizado: 2026-11-10
---

# Módulo: Automação (Configurações › Automação)

Só administrador global: chaves para ligar e desligar o que roda sozinho em cada aba, com motivo e
histórico. Pasta `src/modulos/automacao/`. Explicações: `docs/aya/regras-da-automacao.md`.

## Como funciona

- Uma chave por aba liga ou desliga as tarefas do pg_cron da chave e a agenda dos robôs.
- Cada linha mostra o estado, a última e a próxima execução e quem mudou, quando e por quê.
- Ligar ou desligar é uma chave por vez e pede motivo (`alterar_chave_da_automacao`); o banco grava
  o histórico e devolve a lista nova. Leitura: `obter_chaves_da_automacao`.
- O "Rodar agora" não fica aqui: fica no [[modulo-status-das-atualizacoes]].
- Horários e nomes não se escrevem à mão: vêm de `src/lib/agenda-do-cron.ts` (agenda do pg_cron) e
  `src/lib/catalogo-dos-robos.ts` (`obter_catalogo_dos_robos`).

## Arquivos

- `automacao.tsx` — a tela; `estado.ts` — chaves lidas, mudança em curso e aviso da última recusa
  (sem React); `automacao.css`.
- Regras puras: `src/lib/chaves-da-automacao.ts`.
- Banco: `supabase/migrations/20261022190000_chaves_da_automacao.sql`.
- Agenda e chaves explicadas em [docs/agenda-dos-robos.md](../agenda-dos-robos.md) (seção "Chaves
  da automação").

## Relacionadas

- [[robos-e-agenda]] — o banco pede ao GitHub
- [[modulo-status-das-atualizacoes]] — execução imediata e saúde das cargas
- [[modulo-configuracoes]] — a moldura das seções
- [regras-da-automacao](../aya/regras-da-automacao.md) — o que a Aya responde sobre a tela (a explicação mora lá, não na interface)
