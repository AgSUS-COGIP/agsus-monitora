---
tipo: modulo
area: modulo
atualizado: 2026-11-23
---

# Módulo: Lista de aprovados

Tela `#page-approved` (view `approved`, rota `/<área>/aprovados`), em `src/modulos/aprovados/`.
`criarListaAprovados()` devolve conteúdo e controlador; a rota chama `render()` a cada abertura, e
Editais chama `openImportModal(id, rótulo)` por `carregarTela("approved")`. Área = a atual do app.

Quatro visões: **Aprovados** (indicadores, filtros, tabela de rolagem contínua), **Resumo por
cargo** (contagem por cargo, regime, jornada, vaga e modalidade; pedido da CORES), **Convocação** (ordem
de chamada de cada vaga, pelo modelo de convocação e pelas vagas imediatas) e **Pendências**
(decisões do gestor com motivo e histórico, selo de abertas). As duas primeiras leem os mesmos
candidatos: mudar um status redesenha ambas; decidir uma pendência recarrega a lista.

**Tabela da aba Aprovados** (revisão de 17/11/2026): colunas próprias para Vaga (código), Cargo
(`cargoDaVaga`, o primeiro trecho do texto), Lotação (`localidadeDoCargo`) e Edital com a unidade,
todas ordenáveis. As ações da linha são uma principal com nome ("Mudar status" ou "Abrir") e o
"⋯ Mais ações de <nome>" (`src/lib/aprovados/acoes-da-linha-dos-aprovados.ts`, `AcoesDaLinha`), com
"Ver na Classificação" do edital. A gaveta do candidato tem a seção Origem (edital, unidade, a
lista importada e a data, e "Ver nota e classificação na Classificação").

**Ativos e Histórico** (19/11/2026, abas Aprovados e Resumo por cargo): a lista de trabalho
(**Ativos**, o padrão) tem os candidatos de lista ativa; a lista inativa e a de edital cancelado ou
desativado (pelo status das linhas do monitoramento) ficam no **Histórico**, a um clique. O edital
**concluído** fica nos Ativos: é a lista dele que está em convocação (com a regra de Editais, em
23/11/2026 os 85 editais foram para o Histórico e os Ativos ficaram vazios) (`AtivosEHistorico`, com a
contagem de editais por situação; a vista volta no F5). O filtro de Edital, os indicadores, a
contagem e a exportação partem da vista; trocar de vista recomeça os filtros. Um pedido de filtro
(faixa das etapas, Visão geral) de um edital do Histórico abre o Histórico nele. A Convocação, o
sub judice e os modais seguem com a área inteira. Regra: `src/lib/aprovados/ativos-e-historico-dos-aprovados.ts`.
Na aba Aprovados, o controle diz **Listas ativas N · Inativas N · Todas N** (contagem de listas,
como "Ativo / Inativo / Todos" do painel de Análises); Todas junta as duas. O recorte vai para o
endereço (`?listas=inativas`, `?listas=todas`; sem o parâmetro, as ativas) e o link abre nele.

**Filtros** (os mesmos nas abas Aprovados e Resumo por cargo): Edital, Localidade, Cargo, Modalidade
e Situação. A **Localidade** (16/11/2026) sai do texto do cargo (`src/lib/aprovados/localidade-da-vaga.ts`: o
trecho com UF depois de barra, Polo, PB, CASAI, Distrital, Regional, Abrangência, Sede… ou nome de
estado; "DSEI X" é a unidade, não a localidade). Só aparece quando os editais escolhidos têm duas ou
mais localidades (não aparece na SEDE, cujos cargos não trazem lugar); escolhida, o filtro Cargo
oferece só os cargos dela. Duas grafias do mesmo lugar contam como uma. Na exportação, a localidade
vai ao banco como os cargos dela (a conferência do total é por edital, cargo e modalidade).

## Arquivos

```
lista-aprovados.tsx         <ListaAprovados>, criarListaAprovados() e os modais (ModalAberto)
estado.ts                   store sem React: candidatos (pacote compacto por área, cópia no
                            navegador), listas, convocação, anexos, convocações, ações e estado.carta
aba-aprovados.tsx           KPIs (Convocados no lugar de Fim de fila; clicar filtra a Situação),
                            filtros, TabelaInfinita (50 por
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
                            scripts/aprovados/pendencias.py; regras em src/lib/aprovados/pendencias-do-edital.ts)
exportacao/                 "Exportar" da aba Aprovados: modal-da-exportacao.tsx, exportar.ts
                            (registro no banco → arquivo → download); exportar-resumo.ts, o
                            mesmo caminho para o Resumo por cargo (que mora em Relatórios)
recorte-dos-aprovados.ts    o recorte da lista (Ativos × Histórico, filtros e opções), o mesmo
                            da aba Aprovados e do Resumo por cargo de Relatórios
aprovados.css, convocacao.css
```

## Status do candidato

Convocado (com a data), Contratado, Desistente, Migração e Documentação Rejeitada; "Fim de Fila" saiu
(migration `20261005180000`). Status definido só o admin de Aprovados muda, exceto do Convocado para
o seguinte (quem edita faz); deixar sem status é do admin. Contratados (Seleção e KPIs) = Contratado e
Migração. Regras: `src/lib/aprovados/lista-aprovados-rules.ts` (status, trava, resumo) e
`src/lib/aprovados/lista-convocacao-rules.ts` (ordem, "a convocar", CSV).

**Status em lote** (11/11/2026): na aba Aprovados, quem muda status marca linhas e usa "Mudar
status". A barra da seleção (`BarraDeSelecao`, desde 17/11/2026) separa "Selecionar esta página (N)"
(as linhas desenhadas) de "Selecionar todos os N resultados" (os filtrados e buscados), e a janela
diz quantos serão afetados e se vão além da página. Só Convocado (uma data para todos),
Desistente, Documentação Rejeitada e, para o admin, sem status; Contratado e Migração pedem a
matrícula de cada um e ficam na linha. A janela mostra quem muda, como está hoje e quem fica de fora
e por quê (`src/lib/aprovados/status-em-lote-dos-aprovados.ts`); o banco repete as regras, um a um
(`alterar_status_candidatos_aprovados`, migration `20261111180000`, até 500, histórico em
`TH_CANDIDATO_APROVADO`). Mudar filtro ou busca limpa a seleção.

"Contratado em outra lista" (migration `20261024120000`): situação decidida pelo job Python
`scripts/aprovados/contratacao.py`, no dicionário `contratacao` do pacote; selo, indicadores e
filtro usam `statusEfetivo`, a Convocação usa `statusNaFila`. Regra versão 2 (16/11/2026,
migration `20261116170000`): quando a convocação não decide, vale a única linha com a admissão
conciliada com o RH (motivo `ADMISSAO_NO_RH`); só fica ambíguo se nenhuma ou mais de uma tiver.

## Exportar a lista (issue #583)

"Exportar", no topo da aba Aprovados, baixa a lista filtrada pela tela (edital, localidade, cargo,
modalidade, situação e o recorte do aviso; a busca da tabela não entra) em XLSX, CSV ou PDF, com área, editais,
filtros, registros, data dos dados, data de emissão e o número do registro. Não confundir com o
"Exportar CSV" da Convocação (ordem de chamada).

- **Primeiro, o banco:** `registrar_exportacao_aprovados` (migration `20261110190000`, para revisão)
  confere sessão, Aprovados leitor e área; aceita só editais da área com lista vigente, fora de
  treinamento e visíveis à coordenação (nenhum id de candidato); recalcula o total da lista vigente
  nos editais, cargos e modalidades e recusa (40001) se a tela tem outro número; grava
  `TL_EXPORTACAO_APROVADO` (sem dado de candidato) e devolve o id e a data de emissão.
- **Depois, o arquivo, no navegador:** conteúdo em `src/lib/aprovados/exportacao/exportacao-da-lista-de-aprovados.ts`
  (linhas sem repetir, CSV por `seguranca/csv-security.ts`, XLSX pelo `arquivosDoXlsx` da Classificação zipado
  com o fflate) e o PDF em `aprovados/exportacao/exportacao-da-lista-de-aprovados-em-pdf.ts`, desenhado por lotes
  (cede a vez à tela a cada 300 linhas e mostra o progresso no botão; um Web Worker duplicaria o
  jsPDF no build). Nada vai a Storage, artifact ou log. Medido com 13 mil linhas: CSV e XLSX em
  ~0,6 s; PDF em alguns segundos.
- **Job Python (fica para depois):** se a lista passar do que o navegador gera bem, o pedido vira
  job no GitHub Actions com Storage privado e link temporário, a partir da mesma RPC.

## Resumo por cargo e status (pedido da CORES)

Desde 23/11/2026 é um **cartão de Relatórios** (grupo Aprovados, [[modulo-paineis-de-dados]]); a
Lista de aprovados ficou com o atalho **Ver em Relatórios** (no topo da aba Aprovados), que abre o
relatório nos editais escolhidos. Continua a mesma lista vigente, com os mesmos filtros (o recorte de
`src/modulos/aprovados/recorte-dos-aprovados.ts`) e a mesma permissão (recurso `aprovados`), sobre o
estado da Lista (o controlador da tela `approved`). Tela em
`src/modulos/paineis-de-dados/resumo-por-cargo.tsx`; conta em
`src/lib/paineis/resumo-por-cargo-e-status.ts` (uma estrutura para a tabela, o detalhe e o arquivo);
arquivo em `src/lib/paineis/exportacao-do-resumo-por-cargo.ts`.

- **Grupos:** edital → cargo + regime + jornada → uma linha por vaga (código) e modalidade, subtotal
  do grupo, do edital (com mais de um) e total geral. Regime e jornada saem do texto do cargo por
  regra explícita (`lerRegimeEJornada`: trecho entre " - " que é só o regime ou só a jornada, e a
  jornada colada ao nome, como "Assistente Social 30h"). O rótulo do grupo leva só o que se sabe; o
  que falta é contado num aviso.
- **Unidade:** o vínculo (linha da lista: edital, vaga, modalidade); nada se junta por nome.
- **Colunas exclusivas, que fecham Aprovados** (títulos uniformes desde 16/11/2026, com a definição
  na dica do cabeçalho, `DICA_DA_COLUNA`): Contratados (Contratado e Migração), Desistentes (uma
  coluna só: o banco não guarda se foi voluntária ou tácita), Em reserva (cadastro de reserva, pela
  fila de convocação: na fila, fora das vagas imediatas, não chamado) e Outros (Convocado, A
  convocar, Documentação Rejeitada, Contratado em outra lista, Não classificado).
- **Congelada:** o cabeçalho fica no topo e a coluna "Cargo e vaga" à esquerda ao rolar (na tela
  larga; no celular a tabela vira cartões).
- **Desenho aos poucos:** 50 linhas de vaga por vez, em grupos inteiros (`resumoAteOLimite`), e mais
  50 ao rolar perto do fim ou em "Carregar mais"; o total geral e a exportação são do recorte todo.
  Desenhar tudo de uma vez travava a tela (13 mil vínculos na Saúde Indígena).
- **Lista inativa** fica no Histórico (Ativos e Histórico, acima); na vista Histórico, fica fora do
  resumo e é contada à parte. O filtro Situação restringe a base (aviso na aba).
- **Exportar** (XLSX, CSV, PDF): o mesmo registro no banco, com `p_conteudo = 'RESUMO'` (migration
  `20261111210000`, para revisão). Sem dado de candidato no arquivo.

## Carta de convocação

Modelos por área (e, se quiser, por edital), versionados — motivo a partir da 2ª versão; inativar
com motivo, nada se apaga. Edita quem tem Editor em Aprovados. Texto, preenchimento e validação:
`src/lib/aprovados/carta-de-convocacao/carta-de-convocacao.ts`; documento (HTML do SEI, texto, prévia/PDF, DOCX, ZIP):
`src/lib/aprovados/carta-de-convocacao/carta-de-convocacao-documento.ts`, que reaproveita o documento da Classificação
(`classificacao/documento-sei.ts`, `documento-docx.ts`, `documento-no-navegador.ts`). Cabeçalho de
Configurações › Marca. Emissão sem identificador confirmado não gera saída nem repete o registro.

Campos: {NOME}, {CPF} (sempre mascarado; a lista não guarda CPF, sai em branco e a emissão avisa),
{CARGO}, {VAGA}, {LOTACAO} / {LOTAÇÃO/UNIDADE}, {UNIDADE}, {EDITAL}, {POSICAO}, {MODALIDADE},
{DATA_LIMITE}, {LOCAL}, {DOCUMENTOS} (sozinho na linha vira lista), {CONTATO} e {DATA}.

## Convocação e contratos (tudo em TypeScript)

- Configuração: `src/lib/aprovados/carta-de-convocacao/modelo-de-convocacao.ts`, `aprovados/carta-de-convocacao/configuracao-de-convocacao.ts`; tipos em
  `aprovados/carta-de-convocacao/tipos-da-configuracao-de-convocacao.ts` (reusados pela Classificação). Precedência: quadro manual
  da vaga > total da vaga > padrão do edital; resposta malformada avisa e preserva os mapas.
- Convocação: `aprovados/tipos-da-lista-de-convocacao.ts`, `tipos-da-aba-de-convocacao.ts`. Sub judice sem
  código só se associa ao cargo com uma única vaga desse cargo no próprio edital.
- Aprovados: `aprovados/tipos-das-regras-de-aprovados.ts`, `tipos-da-aba-de-aprovados.ts`; campo editável não
  substitui o texto enquanto se digita. Estado e modais: `tipos-do-estado.ts`, `tipos-dos-modais.ts`,
  `src/lib/aprovados/tipos-do-estado-de-aprovados.ts`; marcar convocados exige confirmação de todos os IDs.
- Carta: `src/lib/aprovados/carta-de-convocacao/tipos-da-carta.ts`, `aprovados/carta-de-convocacao/dados-da-carta.ts`; coleção de modelos malformada para a carga.
- Base: `aprovados/aprovados-import.ts` (XLSX), `aprovados/candidatos-aprovados-compactos.ts` (formatos 1 e 2),
  `aprovados/anexos-do-candidato.ts` (PDFs: 2 MB, 5 por candidato; o banco repete), tipos em
  `aprovados/tipos-da-importacao-de-aprovados.ts`.

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

`tests/entrevistas-e-aprovados-na-tela.test.ts` (bloco `componentes/lista-aprovados`), `lista-de-convocacao.test.ts`,
`convocado-e-carta.test.ts`, `tests/entrevistas-e-aprovados-na-tela.test.ts` (bloco `lib/carta-de-convocacao`),
`tests/entrevistas-e-aprovados.test.ts` (bloco `lib/historicos-dos-aprovados`), `tests/demais-regras.test.ts` (bloco `lib/importacao-xlsx-de-aprovados`),
`tests/entrevistas-e-aprovados.test.ts` (bloco `lib/exportacao-da-lista-de-aprovados`), `tests/entrevistas-e-aprovados.test.ts` (bloco `exportacao-de-aprovados-no-banco`),
`tests/entrevistas-e-aprovados.test.ts` (bloco `lib/resumo-por-cargo-e-status`), `tests/entrevistas-e-aprovados.test.ts` (bloco `lib/exportacao-do-resumo-por-cargo`),
`tests/editais-cargas-e-paineis.test.ts` (bloco `exportacao-do-resumo-migration`),
`tests/entrevistas-e-aprovados.test.js` (bloco `lista-convocacao-rules`), `tests/entrevistas-e-aprovados.test.js` (bloco `lista-aprovados-filtros-multiplos`),
`tests/tipos/modais-dos-aprovados.tsx`.
[Histórias de usuário](../historias-de-usuario/lista-de-aprovados.md); para a Aya,
`docs/aya/regras-da-lista-de-aprovados.md`.

## Relacionadas

- [[modulo-classificacao]] — publica a lista e empresta o documento SEI/DOCX
- [[modulo-editais]] — Chamada para contratação e o modal de listas
- [[python-e-jobs]] — contratação, casamento da lista e pendências
- [[dados-pessoais]] — CPF mascarado, anexos do candidato
- [regras-da-lista-de-aprovados](../aya/regras-da-lista-de-aprovados.md) — o que a Aya responde sobre a tela (a explicação mora lá, não na interface)
