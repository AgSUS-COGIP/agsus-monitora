# Equipe Núcleo: estabilização complementar

Base: `AgSUS-COGIP/agsus-monitora`, `main` em
`c263f8b86abd7faeb342edb313d154ec7953cc9a`.

## Causa encontrada

A base já tinha cache de 30 segundos, single-flight para o painel e índice por
chave. O catálogo de cópia, porém, continuava chamando
`get_nucleo_cronograma_resumo` diretamente. Abrir o editor enquanto o painel
carregava produzia duas RPCs concorrentes. Agora ambos usam o mesmo store.

O store mantinha uma RPC por vez, mas `get` era `async`: cada chamada recebia
uma Promise diferente. Retornar a Promise ativa diretamente permite também
reutilizar a carga de interface, sem repetir estados e renderizações. Uma
consulta em andamento passa a ter prioridade sobre o cache antigo durante um
refresh explícito. A invalidação mantém a recarga sequencial já existente.

A busca agendava um `setTimeout` de 275 ms para cada entrada, competindo com o
debounce de 250 ms do legado. O evento `agsus:nucleo-rendered` era escutado,
mas não era emitido pela tabela. A tabela agora publica o evento após renderizar;
o timer compensatório e o listener de clique redundante saíram. O debounce real
da busca foi preservado. O módulo de refresh inicial já não era importado na
base e foi excluído como código morto: seus timers não entram na economia medida.

As reaberturas recriavam KPIs mesmo com dados idênticos, e cada passagem de
decoração reescrevia todos os badges. As assinaturas agora preservam esses nós.
O legado também preserva a tabela e o foco quando seu conteúdo não mudou. As
linhas recebem o ID do registro, evitando associar editais homônimos pelo texto.

## Antes e depois reproduzíveis

Ensaio em jsdom com os módulos reais e dependências simuladas: 100 registros,
RPC com latência fixa de 100 ms, catálogo aberto durante a carga, três
reaberturas com cache e cinco eventos de busca. Janela observada: 1.500 ms.
Nenhuma chamada ao Supabase real. O benchmark histórico lê a base acima pelo Git.

| Métrica nesse cenário | Antes | Depois |
| --- | ---: | ---: |
| RPCs do resumo, painel + catálogo | 2 | 1 |
| Pico de RPCs simultâneas | 2 | 1 |
| RPCs adicionais nas reaberturas com cache | 0 | 0 |
| Timers de aplicação para decorar a busca | 5 | 0 |
| Reconstruções da grade de KPIs | 6 | 2 |
| Escritas do conteúdo dos badges | 600 | 100 |
| Tempo simulado até todos os alertas aparecerem | 130 ms | 120 ms |

As duas escritas finais da grade são o estado de carregamento e os indicadores.
O tempo simulado inclui a latência artificial e o agendamento de frames; **não
mede o tempo de abertura em produção, pintura real, long tasks ou ganho percentual
percebido pelo usuário**. Os números da base pessoal antiga não se aplicam a esta
base e não são usados nesta comparação.

Reprodução (PowerShell):

```powershell
$env:NUCLEO_BENCHMARK = '1'
npx vitest run --disableConsoleIntercept --reporter verbose tests/nucleo-performance.test.js
```

É necessário ter o commit base no histórico local. Em checkouts rasos, o
benchmark histórico fica desativado por padrão; a regressão da versão atual roda
normalmente em `npm test`. No ambiente Windows desta execução, foi necessário
`--configLoader native` por restrição de leitura do esbuild em diretório ancestral.

## Instrumentação para validação com sessão

O evento `agsus:nucleo-metric` informa duração da RPC, número de linhas, tamanho
aproximado do JSON em bytes, disponibilidade do resumo e renderização da tabela
e decoração. O monitor existente guarda os últimos 100 eventos em memória,
acessíveis por `getNucleoPerformanceMetrics`. Não são enviados a telemetria externa.
A medida `agsus:nucleo-summary-rpc` já existente também foi preservada.

Para registrar uma abertura real no console do navegador:

```js
const nucleoMetrics = [];
const collect = (event) => nucleoMetrics.push(event.detail);
document.addEventListener("agsus:nucleo-metric", collect);
// Abrir Núcleo; repetir com cache; atualizar; salvar cronograma.
console.table(nucleoMetrics);
document.removeEventListener("agsus:nucleo-metric", collect);
```

## Riscos e limites

- Medição autenticada de produção e perfil SQL da RPC continuam pendentes.
  Não houve mudança de contrato, schema ou dados do Supabase.
- Cache em memória por aba, validade de 30 segundos. Alterações feitas em outra
  aba/dispositivo aparecem no próximo refresh ou depois desse prazo.
- Logout/troca de usuário invalida o cache e limpa painel e catálogo; respostas
  antigas não restauram os dados da identidade anterior na interface.
- Um salvamento durante uma carga pode exigir duas chamadas **sequenciais**:
  a antiga e a atualização posterior. Nunca duas ativas ao mesmo tempo.
- Mapas e OAuth permanecem fora desta alteração. O handoff de mapas do PR #10
  foi lido e fica para uma etapa separada.
