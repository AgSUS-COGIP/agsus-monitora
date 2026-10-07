# Status das atualizações

Conjunto completo em React e TypeScript: saúde das cargas, detalhes, histórico,
acompanhamento dos pedidos, execução imediata e formulário de opções dos robôs.
O estado fica em `estado.ts`, lido pela tela com `useSyncExternalStore`; dados,
dependências e ações estão definidos em `tipos.ts`.

`src/lib/saude-das-cargas.ts` normaliza as cargas e calcula os selos e o resumo.
`src/lib/painel-dos-robos.ts` normaliza editais, vagas, histórico; também monta filtros, prévia e acompanhamento.
`src/lib/robos-de-carga.js` permanece compartilhado com a Avaliação documental, com contratos JSDoc.
O banco também confere os robôs, modos e opções permitidos.

As fronteiras recebem `unknown`, conferem objetos e listas, descartam entradas que
não são registros e tratam datas e números inválidos. Campos textuais não exibem
objetos serializados; rótulos de dicionários não vêm de propriedades herdadas.
Links das execuções aceitam somente URLs HTTP ou HTTPS. Esse tratamento não substitui
a autorização do banco nem verifica todas as regras de negócio.
Os consumidores que continuam em JavaScript não são todos verificados pelo compilador.

O módulo usa o cliente Supabase compartilhado. `disparar_robo` cria o pedido
e `situacao_do_disparo_robo` acompanha a resposta; a chave fica no Vault.
A agenda apresenta a última aceitação e as falhas recentes. A primeira conferência
ocorre após 3 segundos; os pedidos aguardam 20 segundos antes da releitura,
e o botão continua bloqueado enquanto houver execução ou pedido recente.

Testes de saúde, painel, treinamento, formulário e API verificam os fluxos existentes.
`tests/saude-das-cargas-fronteiras.test.js` cobre respostas malformadas e um disparo
completamente simulado. `tests/tipos/saude-das-cargas.tsx` confere contratos positivos
e rejeições do compilador. A rede fica bloqueada durante os testes.
