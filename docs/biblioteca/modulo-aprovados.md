---
tipo: modulo
area: modulo
atualizado: 2026-11-11
---

# Módulo: Lista de aprovados

Tela `#page-approved` (view `approved`, rota `/<área>/aprovados`), em `src/modulos/aprovados/`.
`criarListaAprovados()` devolve conteúdo e controlador; a rota chama `render()` a cada abertura, e
Editais chama `openImportModal(id, rótulo)` por `carregarTela("approved")`. Área = a atual do app.

Três visões: **Aprovados** (indicadores, filtros, tabela de rolagem contínua), **Convocação** (ordem
de chamada de cada vaga, pelo modelo de convocação e pelas vagas imediatas) e **Pendências**
(decisões do gestor com motivo e histórico, selo de abertas). As duas primeiras leem os mesmos
candidatos: mudar um status redesenha ambas; decidir uma pendência recarrega a lista.

## Arquivos

```
lista-aprovados.tsx         <ListaAprovados>, criarListaAprovados() e os modais (ModalAberto)
estado.ts                   store sem React: candidatos (pacote compacto por área, cópia no
                            navegador), listas, convocação, anexos, convocações, ações e estado.carta
aba-aprovados.tsx           KPIs (Convocados no lugar de Fim de fila), filtros, TabelaInfinita (50 por
                            vez), ações por linha (anexos, status, carta, decisão judicial, sub judice)
central-de-convocacoes.tsx  bloco Convocações no topo da aba Convocação (#581): "Para contratação"
                            (a aba de sempre) e "Para entrevistas" (só com acesso às Entrevistas e
                            com Conduzir entrevistas ligada na área, `usarConducaoLigada`):
                            a convocação da entrevista, só leitura, que o controlador de Conduzir
                            entrevistas entrega (`convocacaoParaLeitura`, a loja de lá, sem estado
                            próprio); a tela baixa só ao escolher essa visão
aba-convocacao.tsx          KPIs (A convocar, Convocados…), escolha para a carta, "Escolher os a
                            convocar", Exportar CSV, uma tabela por vaga
partes.tsx                  selo de status, nome que abre a gaveta, ações, paginação, CampoEditavel
modais.tsx                  status (Convocado pede a data), anexos, sub judice
status-em-lote.tsx          "Mudar status" da seleção da aba Aprovados (status em lote)
gaveta-do-candidato.tsx     dados, status e cartas emitidas
modal-listas-do-edital.tsx  origem, importar XLSX, publicar da Classificação; "Lista de convocação"
                            só resume, com "Editar nas Regras do edital"
previa-da-substituicao.tsx  prévia de "Substituir XLSX": casamento do job Python e o motivo
chamada-para-contratacao.tsx ResumoDaChamada e EditorDaChamada (Regras do edital, Chamada)
formulario-de-convocacao.tsx, editor-de-modelo.tsx, previa-da-convocacao.tsx  configuração da
                            convocação (modelo de reserva de vagas)
carta-de-convocacao/        estado.ts (modelos, versão, inativar, emitir SEI/DOCX/PDF registrando
                            uma vez por carta), modal-da-carta.tsx, modelos-da-carta.tsx, carta.css
pendencias/                 aba Pendências (migration 20261026190000; detecção em
                            scripts/aprovados/pendencias.py; regras em src/lib/pendencias-do-edital.ts)
exportacao/                 "Exportar" da aba Aprovados: modal-da-exportacao.tsx, exportar.ts
                            (registro no banco → arquivo → download) e pdf-no-worker.ts
aprovados.css, convocacao.css
```

## Status do candidato

Convocado (com a data), Contratado, Desistente, Migração e Documentação Rejeitada; "Fim de Fila" saiu
(migration `20261005180000`). Status definido só o admin de Aprovados muda, exceto do Convocado para
o seguinte (quem edita faz); deixar sem status é do admin. Contratados (Seleção e KPIs) = Contratado e
Migração. Regras: `src/lib/lista-aprovados-rules.ts` (status, trava, resumo) e
`src/lib/lista-convocacao-rules.ts` (ordem, "a convocar", CSV).

**Status em lote** (11/11/2026): na aba Aprovados, quem muda status marca linhas (ou "Selecionar os N
da tabela": os filtrados e buscados) e usa "Mudar status". Só Convocado (uma data para todos),
Desistente, Documentação Rejeitada e, para o admin, sem status; Contratado e Migração pedem a
matrícula de cada um e ficam na linha. A janela mostra quem muda, como está hoje e quem fica de fora
e por quê (`src/lib/status-em-lote-dos-aprovados.ts`); o banco repete as regras, um a um
(`alterar_status_candidatos_aprovados`, migration `20261111180000`, até 500, histórico em
`TH_CANDIDATO_APROVADO`). Mudar filtro ou busca limpa a seleção.

"Contratado em outra lista" (migration `20261024120000`): situação decidida pelo job Python
`scripts/aprovados/contratacao.py`, no dicionário `contratacao` do pacote; selo, indicadores e
filtro usam `statusEfetivo`, a Convocação usa `statusNaFila`.

## Exportar a lista (issue #583)

"Exportar", no topo da aba Aprovados, baixa a lista filtrada pela tela (edital, cargo, modalidade,
situação e o recorte do aviso; a busca da tabela não entra) em XLSX, CSV ou PDF, com área, editais,
filtros, registros, data dos dados, data de emissão e o número do registro. Não confundir com o
"Exportar CSV" da Convocação (ordem de chamada).

- **Primeiro, o banco:** `registrar_exportacao_aprovados` (migration `20261110190000`, para revisão)
  confere sessão, Aprovados leitor e área; aceita só editais da área com lista vigente, fora de
  treinamento e visíveis à coordenação (nenhum id de candidato); recalcula o total da lista vigente
  nos editais, cargos e modalidades e recusa (40001) se a tela tem outro número; grava
  `TL_EXPORTACAO_APROVADO` (sem dado de candidato) e devolve o id e a data de emissão.
- **Depois, o arquivo, no navegador:** conteúdo em `src/lib/exportacao-da-lista-de-aprovados.ts`
  (linhas sem repetir, CSV por `csv-security.ts`, XLSX pelo `arquivosDoXlsx` da Classificação zipado
  com o fflate) e o PDF em `exportacao-da-lista-de-aprovados-em-pdf.ts`, desenhado por lotes
  (cede a vez Ã  tela a cada 300 linhas e mostra o progresso no botÃ£o; um Web Worker duplicaria o
  jsPDF no build). Nada vai a Storage, artifact ou log. Medido com 13 mil linhas: CSV e XLSX em
  ~0,6 s; PDF em alguns segundos.
- **Job Python (fica para depois):** se a lista passar do que o navegador gera bem, o pedido vira
  job no GitHub Actions com Storage privado e link temporário, a partir da mesma RPC.

## Carta de convocação

Modelos por área (e, se quiser, por edital), versionados — motivo a partir da 2ª versão; inativar
com motivo, nada se apaga. Edita quem tem Editor em Aprovados. Texto, preenchimento e validação:
`src/lib/carta-de-convocacao.ts`; documento (HTML do SEI, texto, prévia/PDF, DOCX, ZIP):
`src/lib/carta-de-convocacao-documento.ts`, que reaproveita o documento da Classificação
(`classificacao/documento-sei.ts`, `documento-docx.ts`, `documento-no-navegador.ts`). Cabeçalho de
Configurações › Marca. Emissão sem identificador confirmado não gera saída nem repete o registro.

Campos: {NOME}, {CPF} (sempre mascarado; a lista não guarda CPF, sai em branco e a emissão avisa),
{CARGO}, {VAGA}, {LOTACAO} / {LOTAÇÃO/UNIDADE}, {UNIDADE}, {EDITAL}, {POSICAO}, {MODALIDADE},
{DATA_LIMITE}, {LOCAL}, {DOCUMENTOS} (sozinho na linha vira lista), {CONTATO} e {DATA}.

## Convocação e contratos (tudo em TypeScript)

- Configuração: `src/lib/modelo-de-convocacao.ts`, `configuracao-de-convocacao.ts`; tipos em
  `tipos-da-configuracao-de-convocacao.ts` (reusados pela Classificação). Precedência: quadro manual
  da vaga > total da vaga > padrão do edital; resposta malformada avisa e preserva os mapas.
- Convocação: `tipos-da-lista-de-convocacao.ts`, `tipos-da-aba-de-convocacao.ts`. Sub judice sem
  código só se associa ao cargo com uma única vaga desse cargo no próprio edital.
- Aprovados: `tipos-das-regras-de-aprovados.ts`, `tipos-da-aba-de-aprovados.ts`; campo editável não
  substitui o texto enquanto se digita. Estado e modais: `tipos-do-estado.ts`, `tipos-dos-modais.ts`,
  `src/lib/tipos-do-estado-de-aprovados.ts`; marcar convocados exige confirmação de todos os IDs.
- Carta: `src/lib/tipos-da-carta.ts`, `dados-da-carta.ts`; coleção de modelos malformada para a carga.
- Base: `aprovados-import.ts` (XLSX), `candidatos-aprovados-compactos.ts` (formatos 1 e 2),
  `anexos-do-candidato.ts` (PDFs: 2 MB, 5 por candidato; o banco repete), tipos em
  `tipos-da-importacao-de-aprovados.ts`.

## Banco

Abertura numa chamada: `abrir_lista_aprovados` (migration `20261029133000`): pacote da área, listas,
convocação, anexos, convocações e pendências; erro por parte em `erros.<parte>`; sem a função
(PGRST202), as chamadas de antes. Migration `20261005180000_convocado_e_carta_de_convocacao`:
`DT_CONVOCACAO`, gatilho na publicação, `TB_MODELO_CARTA_CONVOCACAO`, `TH_MODELO_CARTA_CONVOCACAO`,
`TH_CARTA_CONVOCACAO`, `RL_CARTA_CANDIDATO` e RPCs `alterar_status_candidato_aprovado` (em lote:
`alterar_status_candidatos_aprovados`, 20261111180000),
`marcar_candidatos_convocados`, `listar_modelos_carta_convocacao`, `salvar_modelo_carta_convocacao`,
`definir_modelo_carta_ativo`, `registrar_carta_convocacao`, `listar_cartas_do_candidato`,
`listar_convocacoes_aprovados`. Históricos validados; falha libera nova tentativa.

## Testes e histórias

`tests/componentes/lista-aprovados.test.ts`, `lista-de-convocacao.test.ts`,
`convocado-e-carta.test.ts`, `tests/lib/carta-de-convocacao.test.ts`,
`tests/lib/historicos-dos-aprovados.test.ts`, `tests/lib/importacao-xlsx-de-aprovados.test.ts`,
`tests/lib/exportacao-da-lista-de-aprovados.test.ts`, `tests/exportacao-de-aprovados-no-banco.test.ts`,
`tests/lista-convocacao-rules.test.js`, `tests/lista-aprovados-filtros-multiplos.test.js`,
`tests/tipos/modais-dos-aprovados.tsx`.
[Histórias de usuário](../historias-de-usuario/lista-de-aprovados.md); para a Aya,
`docs/aya/regras-da-lista-de-aprovados.md`.

## Relacionadas

- [[modulo-classificacao]] — publica a lista e empresta o documento SEI/DOCX
- [[modulo-regras-do-edital]] — Chamada para contratação
- [[python-e-jobs]] — contratação, casamento da lista e pendências
- [[dados-pessoais]] — CPF mascarado, anexos do candidato
- [[modulo-editais]] — abre o modal de listas
- [regras-da-lista-de-aprovados](../aya/regras-da-lista-de-aprovados.md) — o que a Aya responde sobre a tela (a explicação mora lá, não na interface)
