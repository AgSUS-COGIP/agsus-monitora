# Cronograma

Tela de leitura dos cronogramas de Editais, montada em `#page-calendario`.
O controlador de `src/main.js` chama `render()` ao abrir e `recarregar()` para
ignorar o cache. A área vem do app e recorta os editais já carregados.

| Arquivo                  | Responsabilidade                                                      |
| ------------------------ | --------------------------------------------------------------------- |
| `calendario-editais.tsx` | Tela, mês aberto, filtros, dia selecionado e edital da linha do tempo |
| `partes.tsx`             | Grade, seletor, próximas etapas, linha do tempo e modal do dia        |
| `estado.ts`              | Store externo, sessão, carga, cache e aviso de falhas parciais        |
| `tipos.ts`               | Cliente de leitura, snapshot, filtros, etapas e células normalizadas  |
| `cronograma.css`         | Estilos próprios do módulo                                            |

As regras puras estão em `src/lib/calendario-editais.ts`. Classificação de etapas e
plausibilidade das datas continuam nos helpers compartilhados `etapas-de-edital.js`
e `datas-do-cronograma.js`; estes mantêm suas regras existentes.

## Carregamento

O caminho principal usa duas RPCs: `get_nucleo_cronograma_resumo` e
`listar_etapas_do_cronograma`. Se a segunda não existir (`PGRST202`), usa
`get_monitoramento_cronograma` por edital, com no máximo seis pedidos simultâneos.
Uma falha individual mantém os outros editais e avisa que a carga ficou incompleta.
O cache de um minuto e a deduplicação de pedidos em voo evitam repetir consultas.
Salvar o cronograma em Editais invalida esse cache; trocar de área só recorta a carga.

As respostas entram como `unknown`. A leitura verifica objetos e listas; editais
precisam de ID textual ou numérico finito e contagem positiva. Textos aceitam valores
textuais/numéricos; campos malformados usam as reservas existentes. Datas são strings
normalizadas pelo parser já usado na tela; o tipo `string` não garante formato ou
plausibilidade. Etapas sem início interpretável ficam fora do calendário.

## Verificação

`npm run typecheck:frontend` inclui `tests/tipos/cronograma.tsx`. Os contratos compilados
conferem o cliente Supabase instalado, RPCs de leitura, filtros, datas, callbacks e
snapshots. `tests/componentes/calendario-editais.test.js` verifica navegação por mês,
área, cache, filtros, modal e foco. `tests/calendario-editais.test.js` cobre normalização,
intervalos, concorrência e falhas. As regras compartilhadas são verificadas também por
`tests/etapas-de-edital.test.js` e `tests/datas-do-cronograma.test.js`.
