---
tipo: modulo
area: modulo
atualizado: 2026-11-10
---

# Módulo: Visão geral

Página `dashboard`, rota `/<área>/visao-geral`, em React/TypeScript em `src/modulos/visao-geral/`.
`criarVisaoGeral` devolve o conteúdo, que a rota (`src/app/telas.tsx`) desenha no pacote principal,
dentro do ErrorBoundary da tela. O bootstrap, a navegação e a carga do monitoramento continuam em
`src/app/`. Liga os mapas: [[modulo-mapa-saude-indigena]] e [[modulo-mapa-de-projetos]].

## Arquivos

- `estado.ts`: recorte por área, filtros, busca, DSEI, atalhos, colunas, ordenação, exportação e
  acompanhamento dos editais. Não importa React.
- `visao-geral.tsx`: composição da tela e integração com os mapas.
- `paineis.tsx`, `tabela.tsx` e `gaveta.tsx`: filtros, indicadores, fases, pós-resultado,
  processos por projeto, tabela e detalhes.
- `boas-vindas.tsx` e `marcos.ts`: saudação, etapas da semana e marcos anuais da equipe.
- `tipos.ts`: contratos do estado, callbacks, dados de leitura e componentes.
- `src/lib/visao-geral.ts`: normalização, enriquecimento, recorte, ordenação e CSV.
- Filtros do mapa e da tabela: lógica pura em `src/lib/filtros-do-mapa.ts`; o estado fica aqui;
  o evento é `agsus:filtros-alterados`.

## Dados e carregamento

- As linhas vêm do store compartilhado de `src/componentes/dados-do-monitoramento.ts`. A tela
  valida os campos que usa, aplica o recorte da área e exclui o edital de treinamento. Campos
  adicionais são preservados para os mapas.
- Indicadores, tabela, mapas e CSV usam o mesmo recorte; as regras de críticos e provimento
  continuam nos helpers existentes (`src/lib/criticos-da-visao-geral.ts`).
- **Crítico marcado à mão** (#721, migration `20261110150000`): gestor, coordenador ou
  administrador global marca o edital como crítico, com motivo, no formulário de Editais
  ([[modulo-editais]]). A Visão geral lê `listar_editais_criticos_manuais(p_area)` junto com o
  acompanhamento (falha não derruba a tela; sem mudança, o mesmo objeto) e soma a marcação aos
  motivos automáticos como o mais grave (`marcado`).
- `listar_acompanhamento_da_visao_geral({ p_area })` lê etapas e resumos das listas. O estado
  evita repetir pedidos da mesma carga/área e descarta respostas de cargas ou áreas anteriores.
  Se houver erro, a tela continua com as linhas disponíveis.
- `obter_marcos_da_area({ p_area })` lê os números anuais da equipe. Resposta sem ano inteiro ou
  contagem numérica finita e não negativa não gera comemoração.
- Filtros e colunas são normalizados ao sair do armazenamento; a indisponibilidade do
  armazenamento não impede o uso da página.
- O CSV mantém a proteção contra fórmulas e o nome do arquivo usa a data de Brasília.

## Limites da tipagem

- O snapshot e suas coleções de linhas, filtros e colunas têm contratos de leitura; mudanças do
  recorte passam pelas ações do estado. Isso não congela os objetos em tempo de execução.
- Datas continuam como texto, com as regras existentes de calendário.
- Os dados geográficos adicionais seguem como `unknown`: a tipagem não valida todo o schema dos
  mapas nem muda as permissões de edição. `checkJs` segue desligado; JSDoc descreve as
  integrações em JavaScript que ainda restam (ver [[typescript-no-front]]).

## Verificação

- `tests/modulos/visao-geral.test.js`: a tela e o estado, incluindo mapas e troca de área.
- `tests/visao-geral.test.js`: as regras.
- `tests/fronteiras-da-visao-geral.test.js`: as fronteiras externas.
- `tests/tipos/visao-geral.tsx`: contratos positivos e negativos do compilador.
- Explicações para quem usa: `docs/aya/regras-da-visao-geral.md` (ver [[aya-base-de-conhecimento]]).

## Relacionadas

- [[modulo-mapa-saude-indigena]] — o mapa da área Saúde Indígena, ligado aqui
- [[modulo-mapa-de-projetos]] — o mapa da área Projetos, ligado aqui
- [[mapas-e-leaflet]] — regras comuns dos mapas
- [[areas-do-sistema]] — o recorte por área
- [[carga-da-entrada]] — de onde vêm as linhas do monitoramento
- [[arquitetura-do-front]] — rotas e telas do app único
