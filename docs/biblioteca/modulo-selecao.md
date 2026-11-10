---
tipo: modulo
area: modulo
atualizado: 2026-11-10
---

# Módulo: Seleção

A tela `#page-selecao` (view `selecao`, rota `/<área>/selecao`), em `src/modulos/selecao/`, módulo
do app desde a Etapa 2, sem iframe: `criarSelecao()` devolve o conteúdo e o controlador; a rota
(`src/app/telas.tsx`) desenha na própria `<section>` e chama `render()` a cada abertura. Área = a
atual do app; sessão, tema, aviso e tela cheia = os do app. Funil por vaga (inscritos, aptos,
eliminados), da aba Resultado da Auditoria da planilha; só leitura (`get_selecao_da_area`).

## Arquivos

```
selecao.tsx     <TelaDeSelecao> e criarSelecao() (área atual, troca de área, controlador)
estado.ts       store tipado sem React: carga da área (cópia guardada), sessão, CSV
tipos.ts        contratos do cliente, snapshot, dados normalizados e armazenamento
paineis.tsx     topo (status e ações), filtros de escolha múltipla, KPIs, recorte, gráficos,
                alertas da coluna Observação
tabela.tsx      base operacional consolidada (TabelaInfinita)
selecao.css     só o que é desta tela (tokens); o resto vem de src/ui/
```

Regras puras em `src/lib/selecao-do-painel.ts`. A carga: `src/lib/selecao-da-planilha.ts` e
`scripts/sincronizar-selecao.mjs` (`npm run sync:selecao`, diária pelo GitHub Actions; banco em
`supabase/migrations/20261001090000_selecao.sql`; operação em
[sincronizacao-das-planilhas.md](../sincronizacao-das-planilhas.md)). Explicações das regras para a
Aya: `docs/aya/regras-da-selecao.md`.

## TypeScript

Estado, componentes e regras puras foram migrados. Filtros têm quatro campos conhecidos com listas
de texto; indicadores, observações, linhas da tabela e callbacks são tipados. As opções e os plugins
dos gráficos usam os contratos do Chart.js instalado. O cliente real do Supabase é compatível com o
contrato de leitura do módulo; os testes de tipos também rejeitam nomes de RPC e argumentos
incorretos. Nenhuma permissão ou RPC mudou.

Respostas da RPC e do cache entram como `unknown`. O normalizador verifica objetos e a lista de
vagas antes de ler campos; entradas sem identificação são descartadas. Contagens normalizadas são
`number | null`, mantendo as conversões existentes. Datas e `edital_id` são preservados da origem,
continuam `unknown` e não recebem validação de formato.

## Testes

`tests/modulos/selecao.test.js` e `tests/selecao-do-painel.test.js` (filtros, sessão, troca de
área, cache, falhas e CSV, entradas malformadas e callbacks dos gráficos).
`npm run typecheck:frontend` inclui `tests/tipos/selecao.tsx`.

## Relacionadas

- [[cargas-de-planilha]] — a carga diária da planilha Auditoria
- [[planilhas]] — onde fica o endereço da planilha
- [[robos-e-agenda]] — quem dispara a carga
- [[modulo-automacao]] — a chave "Seleção"
- [[componentes-padrao]] — TabelaInfinita, Kpi, filtros
