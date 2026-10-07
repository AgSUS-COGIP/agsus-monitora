# Conferências

Módulo completo em React e TypeScript: estado externo, cartão de avisos, selos dos
módulos, gaveta, busca de casos, paginação, justificativa para ignorar, navegação e CSV.
As regras puras estão em `../../lib/avisos-de-conferencia.ts` e os contratos em `tipos.ts`.

`estado.ts` usa o cliente Supabase compartilhado e as RPCs existentes
`listar_avisos_conferencia`, `listar_casos_aviso_conferencia` e
`ignorar_aviso_conferencia`. O snapshot é lido por `useSyncExternalStore`;
respostas antigas não substituem a leitura de outra área ou módulo.
O CSV lê páginas de 1000 casos, encerra quando não há novos casos e protege as células
contra fórmulas. A interface mantém busca com espera de 300 ms e páginas de 50 casos.

As respostas entram como `unknown`: objetos e listas são conferidos antes da leitura,
entradas de listas que não são registros são descartadas, números não finitos recebem
valor padrão, notas inválidas viram `null` e datas inválidas não são exibidas.
Gravidade desconhecida usa Atenção. Códigos de conferência desconhecidos permanecem
visíveis; conferências desconhecidas não ganham um destino de navegação.
Essa normalização não substitui a autorização do banco nem valida todas as regras
de negócio. Campos de identificação ausentes continuam vazios e a tipagem não verifica
todos os consumidores que permanecem em JavaScript.

Os testes de avisos, casos e troca de área preservam os fluxos existentes;
`tests/conferencias-fronteiras.test.js` cobre respostas malformadas e paginação repetida.
`tests/tipos/conferencias.tsx` verifica contratos válidos e rejeições do compilador.
Todas as RPCs dos testes são simuladas, com a rede bloqueada pelo setup da suíte.
