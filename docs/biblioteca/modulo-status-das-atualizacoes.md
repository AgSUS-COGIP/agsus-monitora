---
tipo: modulo
area: modulo
atualizado: 2026-11-10
---

# Módulo: Status das atualizações (antes "Saúde das cargas")

Configurações, só admin global: última execução e atraso de cada carga e robô, detalhes, histórico,
acompanhamento dos pedidos, execução imediata ("Rodar agora") e formulário de opções dos robôs.
Pasta `src/componentes/saude-das-cargas/`, toda em React e TypeScript. Banco:
`supabase/migrations/20261001120000_saude_das_cargas.sql`. Explicações:
`docs/aya/regras-do-status-das-atualizacoes.md`.

## Arquivos e regras

- `estado.ts` — estado lido com `useSyncExternalStore`; `tipos.ts` — dados, dependências e ações.
- `src/lib/saude-das-cargas.ts` — normaliza as cargas, calcula selos e resumo.
- `src/lib/painel-dos-robos.ts` — normaliza editais, vagas, histórico; monta filtros, prévia e
  acompanhamento.
- `src/lib/robos-de-carga.ts` — compartilhado com a Avaliação documental.
- `src/lib/agenda-do-cron.ts` — prazo e horário de cada carga pela agenda do pg_cron.
- `src/lib/catalogo-dos-robos.ts` — nomes e qual tarefa agenda cada carga
  (`obter_catalogo_dos_robos`, lido uma vez por tela). O banco também confere robôs, modos e opções.

## Fronteiras

Recebem `unknown`, conferem objetos e listas, descartam o que não é registro e tratam datas e
números inválidos. Texto não exibe objeto serializado; rótulos de dicionário não vêm de propriedade
herdada. Links de execução só HTTP ou HTTPS. Isso não substitui a autorização do banco. Consumidores
que continuam em JavaScript não são todos verificados pelo compilador.

## Disparo e acompanhamento

`disparar_robo` cria o pedido e `situacao_do_disparo_robo` acompanha; a chave fica no Vault. A
agenda mostra a última aceitação e as falhas recentes. Primeira conferência após 3 s; os pedidos
esperam 60 s antes da releitura, que só sai com a seção aberta e a aba visível; o botão fica
bloqueado enquanto houver execução ou pedido recente. O cartão de avisos relê só quando muda a última
conferência (`marcaDasConferencias`).

## Testes

Saúde, painel, treinamento, formulário e API; `tests/saude-das-cargas-fronteiras.test.js` (respostas
malformadas e disparo simulado); `tests/tipos/saude-das-cargas.tsx` (contratos e rejeições). Rede
bloqueada.

## Relacionadas

- [[robos-e-agenda]] — agenda do pg_cron e disparo dos workflows
- [[modulo-automacao]] — chaves que ligam e desligam
- [[modulo-conferencias]] — avisos diários mostrados no cartão
- [[cargas-de-planilha]] — as cargas acompanhadas aqui
