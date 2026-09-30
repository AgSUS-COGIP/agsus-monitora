# `src/lib/` — lógica pura e testável

Regra do diretório: **sem DOM e sem estado global**. Entrada → saída, com teste em
`tests/<nome>.test.js` (ou `tests/lib/`). UI pertence a `src/modules/`.

Arquivos que exigem cuidado:
- `rpc-contrato.js` — contrato das RPCs. Mudou no banco, muda aqui (`npm run check:rpc-contract`).
- `sessao.js`, `session-lifecycle.js`, `supabaseClient.js`, `auth-flow.js` — único caminho de auth.
- `access-roles.js`, `permissoes-recursos.js` — matriz de permissão; costuma exigir migration junto.
  `access-roles.js` também é a regra única de páginas e seções liberadas (`paginasPermitidas`,
  `secaoDeConfiguracaoPermitida`), usada pela barra e pelo "Ver como".
- `matriz-de-acessos.js` (rascunho; grupo × individual), `teto-de-acessos.js` (teto do coordenador),
  `grupos-e-coordenacoes.js`, `ver-como.js`, `solicitacao-de-acesso.js` — Configurações › Acessos.
- `apresentacao-das-configuracoes.js` — grupos, dicas e resumos das seções legadas Página inicial, Tela de
  acesso e Recursos; o desenho é de `src/modules/config-apresentacao.js`.
- `publicacao-de-configuracoes.js` — publicação de Configurações sem DOM: chaves de cada seção (legado e
  React), comparação com o retrato do banco, validação de URL e domínio.
- `sanitize.js`, `html-security.js`, `csv-security.js` — fronteira de segurança. Não afrouxar.
- `localizacoes-validadas-gerado.js` — **201 KB, gerado.** Não editar nem ler inteiro; regenere com
  `node scripts/recompilar-vereditos.mjs`. A API legível é `localizacoes-validadas.js`.
- `reconciliacao-unidades.js`, `uf-ibge.js`, `brasil-bounds.js` — referência geográfica usada pelos
  scripts de auditoria; mudar aqui muda o veredito das coordenadas.
- `fabrica-do-leaflet.js` — único lugar que cria mapa Leaflet (as guardas preservam o namespace `L`).
- `filtros-do-mapa.js` — regra dos filtros da página do mapa: comparação sem acento, opções sem
  duplicata, poda até estabilizar. O `legacy-app.js` só guarda o estado e delega para cá.
- `planilhas.js` — **catálogo de todas as planilhas** (modelo de aprovados, bucket da lista importada,
  link da origem das análises, planilha de Lotações). Planilha nova entra aqui, com `usadaEm`.
- `contraste.js` — cálculo de contraste usado pelo aviso de branding; reutilize em vez de reescrever.
- `menu-lateral.js` — **catálogo dos grupos do menu lateral** (as áreas do usuário — Saúde
  Indígena, SEDE, Projetos —, Painéis e Administração), árvore por permissão e por área, página ativa
  (considera a área atual), áreas abertas por padrão e estado do painel flutuante. Área ou página nova entra aqui; o desenho é de `src/componentes/barra-lateral/`.
- `eventos-da-barra-lateral.js` — nomes dos eventos entre o legado e a barra lateral (React).
- `editais-do-nucleo.js` — a página Editais sem DOM: ordem da fila (risco, vagas ociosas), tons de
  status e risco (também usados pelo mapa), unidades do formulário (catálogo + as que só existem nos
  editais, USI × CORES), rascunho e payload do edital, índice do resumo e filtro dos indicadores.
- `cronograma-do-edital.js` — cronograma do edital: estado calculado pelas datas, validação antes de
  salvar (erros e avisos), modelo padrão, datas coladas em lote e situação na linha do tempo.
- `anexos-do-candidato.js` — anexos PDF do candidato aprovado (o PDF fica no banco, em bytea): base64 de ida e volta, limites (2 MB, 5 por
  candidato), validação antes do envio e agrupamento por candidato. O banco repete os limites.
- `calendario-editais.js` — o Calendário de Editais sem DOM: etapas por dia (conta no início e no
  fim, não no meio), filtros, grade de 42 células, próximas etapas. O desenho é de
  `src/componentes/calendario-editais/`.
- `configuracao-de-convocacao.js` — leitura do modelo e das vagas que o banco guarda, precedência do
  quadro (manual > total da vaga > padrão), rascunho do formulário e edição imutável do modelo. O
  cálculo da ordem é de `lista-convocacao-rules.js`; o desenho, de `src/componentes/lista-aprovados/`.
- `copia-da-sessao.js` — quando a cópia da sessão guardada no navegador pode abrir a tela (mesmo
  usuário, mesmo acesso, mesma versão publicada, dentro da validade) e o que mudou desde ela.
  Afrouxar uma regra daqui expõe dado a quem perdeu acesso.
- `env.js` — leitura de variáveis; nunca hardcode de chave.

Arquivo novo: nome em português, kebab-case, com teste junto.
Teste: `npx vitest run tests/<nome>.test.js`.
