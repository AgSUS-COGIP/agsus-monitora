# Cronograma

Tela de leitura dos cronogramas de Editais, montada em `#page-calendario`.
O controlador de `src/main.ts` chama `render()` ao abrir e `recarregar()` para
ignorar o cache. A área vem do app e recorta os editais já carregados.

| Arquivo                  | Responsabilidade                                                      |
| ------------------------ | --------------------------------------------------------------------- |
| `calendario-editais.tsx` | Tela, mês aberto, filtros, dia selecionado e edital da linha do tempo |
| `partes.tsx`             | Grade, seletor, próximas etapas, linha do tempo e modal do dia        |
| `vistas.tsx`             | Vistas Lista e Semana do card do calendário                           |
| `estado.ts`              | Store externo, sessão, carga, cache e aviso de falhas parciais        |
| `tipos.ts`               | Cliente de leitura, snapshot, filtros, etapas e células normalizadas  |
| `cronograma.css`         | Estilos próprios do módulo                                            |

As regras puras estão em `src/lib/calendario-editais.ts`. Classificação de etapas e
plausibilidade das datas continuam nos helpers compartilhados `etapas-de-edital.ts`
e `datas-do-cronograma.ts`; estes mantêm suas regras existentes.

## Vistas do calendário

O card do calendário tem a alternância Mês · Semana · Lista (`Segmentado`, um
`radiogroup`). A escolha fica no `localStorage` deste navegador
(`agsus:cronograma:visao`); sem escolha guardada, abre em Mês no computador e
em Lista no celular. As três vistas usam as mesmas etapas filtradas e abrem o
mesmo popup do dia.

- **Lista**: um grupo por dia em que alguma etapa começa ou termina, com as
  marcas "começa" e "último dia". O que atravessa o primeiro dia mostrado (hoje,
  no mês corrente) aparece uma vez só, no bloco "Em andamento", com a data final.
  A lista rola dentro do card e abre em hoje; ‹ › andam de mês em mês.
- **Semana**: sete dias com as etapas ativas em cada um; ‹ › andam de semana.
- A bolinha antes da unidade tem a cor da unidade (`corDaUnidade`, hash do nome
  sobre `--series-1..6`). A cor do tipo de etapa continua na barra do item e nas
  bolinhas da grade do mês, que não mudaram de sentido.

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
intervalos, concorrência e falhas; `tests/calendario-editais-lista.test.js`, as regras
da Lista e da Semana (pontas do dia, "Em andamento", bordas de mês e de fuso). As regras compartilhadas são verificadas também por
`tests/etapas-de-edital.test.js` e `tests/datas-do-cronograma.test.js`.
