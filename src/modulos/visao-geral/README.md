# Visão geral

Módulo React/TypeScript da página `dashboard`. `montarVisaoGeral` monta a tela com
`montarModulo`, dentro do ErrorBoundary do app. O bootstrap, a navegação e a carga do
monitoramento continuam em `src/app/`.

- `estado.ts`: recorte por área, filtros, busca, DSEI, atalhos, colunas, ordenação,
  exportação e acompanhamento dos editais. Não importa React.
- `visao-geral.tsx`: composição da tela e integração com os mapas.
- `paineis.tsx`, `tabela.tsx` e `gaveta.tsx`: filtros, indicadores, fases,
  pós-resultado, processos por projeto, tabela e detalhes.
- `boas-vindas.tsx` e `marcos.ts`: saudação, etapas da semana e marcos anuais da equipe.
- `tipos.ts`: contratos do estado, callbacks, dados de leitura e componentes.
- `src/lib/visao-geral.ts`: normalização, enriquecimento, recorte, ordenação e CSV.

## Dados e carregamento

As linhas vêm do store compartilhado de `dados-do-monitoramento.js`. A tela valida
os campos que utiliza, aplica o recorte da área e exclui o edital de treinamento.
Campos adicionais são preservados para os mapas. Indicadores, tabela, mapas e CSV
usam o mesmo recorte; as regras de críticos e provimento continuam nos helpers existentes.

`listar_acompanhamento_da_visao_geral({ p_area })` lê etapas e resumos das listas.
O estado evita repetir pedidos da mesma carga/área e descarta respostas de cargas
ou áreas anteriores. Se houver erro, a tela continua com as linhas disponíveis.
`obter_marcos_da_area({ p_area })` lê os números anuais da equipe. Respostas sem ano
inteiro ou contagem numérica finita e não negativa não geram comemoração.

Filtros e colunas são normalizados ao sair do armazenamento. A indisponibilidade
do armazenamento não impede o uso da página. O CSV mantém a proteção contra
fórmulas e o nome do arquivo usa a data de Brasília.

## Limites da tipagem

O snapshot e suas coleções de linhas, filtros e colunas têm contratos de leitura;
mudanças do recorte passam pelas ações do estado. Isso não congela todos os objetos
em tempo de execução. Datas continuam como texto, com as regras existentes de calendário.

Os mapas de Saúde Indígena e Projetos, seu carregador e os helpers compartilhados
continuam em JavaScript. JSDoc descreve as integrações consumidas pela tela;
`checkJs` permanece desligado. Os dados geográficos adicionais seguem como `unknown`:
esta migração não valida todo o schema dos mapas nem muda as permissões de edição.

## Verificação

`tests/modulos/visao-geral.test.js` cobre a tela e o estado, incluindo mapas e troca
de área. As regras ficam em `tests/visao-geral.test.js`. As fronteiras externas são
testadas em `tests/fronteiras-da-visao-geral.test.js`; contratos positivos e negativos
do compilador ficam em `tests/tipos/visao-geral.tsx`.
