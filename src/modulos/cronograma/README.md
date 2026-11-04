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
mesmo popup do dia, que lista tudo o que está ativo naquele dia.

**Uma cor só: a do tipo de etapa** (a da legenda). A unidade é texto, sem cor
própria, e o rótulo do tipo vai escrito ao lado ("● Entrevistas") — a cor
nunca é o único sinal.

**A legenda é o filtro de tipo**, nas três vistas: cada tipo é um botão de
ligar/desligar (`aria-pressed`), no desenho dos itens de "Fases" da Visão
geral. Todos nascem ligados; "Mostrar todos" religa tudo, e "Limpar tudo" dos
filtros também. Os tipos desligados ficam neste navegador
(`agsus:cronograma:tipos-ocultos`), como os filtros da Visão geral. O filtro
entra em `filtrarEtapas`, então vale para as vistas, as contagens, "Próximas
etapas" e o popup do dia.

- **Mês**: chips curtos "unidade – etapa" (sem o "DSEI " da frente; o nome
  inteiro no `title`), fundo neutro e borda esquerda na cor do tipo, só nos
  marcos: o dia de uma etapa de um dia, e o início ("início") e o fim ("fim")
  de uma etapa com período. Os dias do meio ficam sem chip — não há faixa
  contínua (tirada em 04/11); o popup do dia mostra o que está "Em andamento
  neste dia". Até três chips por dia (`CHIPS_POR_DIA`); o resto vira "+N
  mais", e o clique no dia abre o popup. No celular os chips não cabem: o dia
  mostra as bolinhas dos tipos e o total de marcos. Embaixo, "Próximas etapas" (as 5 seguintes) com "Ver todas na Lista".
- **Lista**: um grupo por dia em que alguma etapa começa ou termina ("Ter, 3 de
  novembro"), com "início" e "último dia" em texto discreto à direita; dentro
  do dia, pela ordem da legenda e depois pela unidade. No mês de hoje ela
  começa hoje (os dias anteriores ficam atrás de um botão) e o que já está em
  andamento aparece uma vez, em "Acontecendo agora · N etapas", recolhido
  quando são mais de três. Rola com a página, sem rolagem dentro do card.
- **Semana**: sete dias, com o mesmo critério do Mês: a etapa com período
  aparece só no dia em que começa e no dia em que termina; nos dias do meio,
  só "N em andamento", que abre o dia. ‹ › andam de semana.
- Na Lista e na Semana, "Próximas etapas" sai (seria a mesma informação) e a
  linha do tempo ocupa a largura toda.

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
da Lista, da Semana e dos marcos do Mês (pontas do dia, "Acontecendo agora", ordem no dia, bordas de mês e de fuso). As regras compartilhadas são verificadas também por
`tests/etapas-de-edital.test.js` e `tests/datas-do-cronograma.test.js`.
