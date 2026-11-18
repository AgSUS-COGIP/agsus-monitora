---
tipo: modulo
area: modulo
atualizado: 2026-11-18
---

# Módulo: Conferências

Avisos diários de inconsistência entre análises, entrevistas, classificação, aprovados e cargas.
Módulo completo em React e TypeScript em `src/modulos/conferencias/`: estado externo, cartão de
avisos, selos dos módulos, gaveta, busca de casos, paginação, a central de avisos
(tratamento, responsável, prazo, evidência e histórico), navegação e CSV. Regras puras em `src/lib/conferencias/avisos-de-conferencia.ts`; contratos em `tipos.ts`.

As conferências são calculadas por um job Python no GitHub Actions (workflow `conferencias.yml`;
ver [[python-e-jobs]] e [[robos-e-agenda]]). As histórias de usuário (CF-1 a CF-6) estão em
[docs/historias-de-usuario/conferencias.md](../historias-de-usuario/conferencias.md).

## Estado e RPCs

- `estado.ts` usa o cliente Supabase compartilhado e as RPCs:
  - `listar_avisos_conferencia_se_mudou` (com versão, migration `20261015000000`): cada recorte
    lido na página guarda a versão e a releitura sem mudança recebe só `inalterado`;
  - `listar_casos_aviso_conferencia`;
  - da central de avisos (migration `20261118140000`): `tratar_aviso_conferencia`,
    `atribuir_aviso_conferencia`, `listar_responsaveis_aviso_conferencia`,
    `incluir_evidencia_aviso_conferencia`, `retirar_evidencia_aviso_conferencia` e
    `listar_historico_aviso_conferencia`.
- A central separa o que a conferência acha (`TP_SITUACAO`: aberto ou resolvido) do que a equipe
  fez (`TP_TRATAMENTO`: pendente, em análise, aguardando documento, corrigido, dispensado com
  justificativa; "rechecado sem problema" só a conferência põe). Tudo vai para
  `TH_AVISO_CONFERENCIA`, que só cresce: resolver não apaga o motivo de quem tratou. A evidência
  (`TB_EVIDENCIA_AVISO_CONFERENCIA`) aponta para o caso pela chave estável (`analise:`, `codigo:`
  ou `referencia:`), porque o número do caso muda a cada execução.
- Na tela, os abertos ficam agrupados por edital; dispensados e resolvidos dos últimos 30 dias,
  recolhidos. Dispensar e atribuir: o gestor do módulo ou o administrador global; tratar e juntar
  evidência: também o responsável. Prazo vencido só destaca.
- O snapshot é lido por `useSyncExternalStore`; respostas antigas não substituem a leitura de
  outra área ou módulo.
- O CSV lê páginas de 1000 casos, encerra quando não há casos novos e protege as células contra
  fórmulas.
- A interface tem busca com espera de 300 ms e páginas de 50 casos.

## Fronteira dos dados

- As respostas entram como `unknown`: objetos e listas são conferidos antes da leitura; entradas
  de listas que não são registros são descartadas.
- Números não finitos recebem valor padrão, notas inválidas viram `null` e datas inválidas não
  são exibidas.
- Gravidade desconhecida usa Atenção. Códigos de conferência desconhecidos continuam visíveis;
  conferências desconhecidas não ganham destino de navegação.
- Essa normalização não substitui a autorização do banco nem valida todas as regras de negócio.
  Campos de identificação ausentes continuam vazios, e a tipagem não verifica os consumidores que
  ainda estão em JavaScript.

## Testes

- Os testes de avisos, casos e troca de área preservam os fluxos existentes.
- `tests/conferencias-fronteiras.test.js`: respostas malformadas e paginação repetida.
- `tests/tipos/conferencias.tsx`: contratos válidos e rejeições do compilador.
- Todas as RPCs dos testes são simuladas, com a rede bloqueada pelo setup da suíte ([[testes]]).

## Relacionadas

- [[python-e-jobs]] — o job que gera os avisos
- [[robos-e-agenda]] — quando as conferências rodam
- [[dados-pessoais]] — um aviso por problema, sem dado pessoal
- [[testes]] — rede bloqueada e RPC simulada
- [regras-das-conferencias](../aya/regras-das-conferencias.md) — o que a Aya responde sobre a tela (a explicação mora lá, não na interface)
