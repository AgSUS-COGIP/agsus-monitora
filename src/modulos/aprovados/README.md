# `src/modulos/aprovados/` — Lista de aprovados

A tela `#page-approved` (view `approved`): monta na própria `<section>` por
`montarListaAprovados()` (`src/main.js` → `window.aprovadosController`); o legado chama `render()` ao
navegar e `openImportModal(id, rótulo)` pelo botão de listas de Editais. Área = a atual do app.

Duas visões no topo: **Aprovados** (indicadores, filtros, tabela paginada) e **Convocação** (a ordem
de chamada de cada vaga, calculada pelo modelo de convocação e pelas vagas imediatas do edital). As
duas leem os mesmos candidatos: mudar um status redesenha as duas.

```
lista-aprovados.jsx        <ListaAprovados>, montarListaAprovados() e os modais abertos (ModalAberto)
estado.js                  store sem React: candidatos (pacote compacto por área, cópia no navegador),
                           listas, configuração de convocação, anexos, convocações (data da
                           convocação e cartas por candidato), ações que escrevem no banco e o estado
                           da carta (`estado.carta`)
aba-aprovados.jsx          visão Aprovados: KPIs (Convocados no lugar do antigo Fim de fila), filtros,
                           tabela, ações por linha (anexos, status, carta, decisão judicial, sub judice)
aba-convocacao.jsx         visão Convocação: KPIs (A convocar, Convocados…), filtros, escolha dos
                           candidatos para a carta, "Escolher os a convocar", Exportar CSV, uma tabela
                           por vaga
partes.jsx                 peças das duas abas: selo de status (com a data do Convocado), nome que abre
                           a gaveta, ações de status, carta e anexos, paginação, CampoEditavel
modais.jsx                 status (Convocado pede a data), anexos, sub judice
gaveta-do-candidato.jsx    a gaveta do candidato: dados, status e as cartas de convocação emitidas
modal-listas-do-edital.jsx listas do edital: origem, importar XLSX, publicar da Classificação
formulario-de-convocacao.jsx, editor-de-modelo.jsx, previa-da-convocacao.jsx
                           configuração da convocação do edital (modelo de reserva de vagas)
carta-de-convocacao/       a carta de convocação para contratação
  estado.js                store da carta: modelos da área, salvar versão, inativar, emitir (SEI,
                           DOCX, PDF) registrando a emissão uma vez por carta, histórico do candidato
  modal-da-carta.jsx       emitir para um ou vários: modelo, valores da emissão, um documento ou uma
                           carta por candidato, prévia "Como fica no SEI", saídas e "Marcar como
                           Convocado"
  modelos-da-carta.jsx     os modelos: lista, editor com os campos, prévia, versões, inativar/reativar
  carta.css                só desta parte (e da gaveta do candidato)
aprovados.css, convocacao.css
```

## Status do candidato

Convocado (com a data da convocação), Contratado, Desistente, Migração e Documentação Rejeitada.
"Fim de Fila" saiu (migration `20261005180000`). Status já definido só o admin de Aprovados muda,
exceto do Convocado para o status seguinte (quem edita faz); deixar sem status é sempre do admin.
Contratados (Seleção e KPIs) são só Contratado e Migração. Regras: `src/lib/lista-aprovados-rules.js`
(status, trava, resumo) e `src/lib/lista-convocacao-rules.js` (ordem, "a convocar", CSV).

## Carta de convocação

Modelos por área (e, se quiser, por edital), versionados no banco — motivo a partir da 2ª versão;
inativar com motivo, nada se apaga. Quem edita é quem tem Editor em Aprovados. O texto, o
preenchimento e a validação são de `src/lib/carta-de-convocacao.js`; o documento (HTML do SEI, texto,
página da prévia/PDF, DOCX e ZIP) é de `src/lib/carta-de-convocacao-documento.js`, que reaproveita o
documento oficial da Classificação (`src/lib/classificacao/documento-sei.js` — `paginaNoModeloDoSei`
— e `documento-docx.js` — `pacoteDocx`, `arquivosDoDocx`) e o que precisa do navegador
(`../classificacao/documento-no-navegador.js`: área de transferência, logo em PNG, impressão). O
cabeçalho é o de Configurações › Marca.

Campos: {NOME}, {CPF} (sempre mascarado; a lista não guarda CPF, então sai em branco e a emissão
avisa), {CARGO}, {VAGA}, {LOTACAO} / {LOTAÇÃO/UNIDADE}, {UNIDADE}, {EDITAL}, {POSICAO}, {MODALIDADE},
{DATA_LIMITE}, {LOCAL}, {DOCUMENTOS} (sozinho na linha vira a lista), {CONTATO} e {DATA}.

## Banco

`supabase/migrations/20261005180000_convocado_e_carta_de_convocacao.sql` (ensaio em
`supabase/ensaios/`, rollback em `supabase/rollback/`, com o mesmo nome): `DT_CONVOCACAO` no
candidato e no histórico do status, gatilho que leva a data na publicação da lista,
`TB_MODELO_CARTA_CONVOCACAO`, `TH_MODELO_CARTA_CONVOCACAO`, `TH_CARTA_CONVOCACAO`,
`RL_CARTA_CANDIDATO` e as RPCs `alterar_status_candidato_aprovado` (com `p_data_convocacao`),
`marcar_candidatos_convocados`, `listar_modelos_carta_convocacao`, `salvar_modelo_carta_convocacao`,
`definir_modelo_carta_ativo`, `registrar_carta_convocacao`, `listar_cartas_do_candidato` e
`listar_convocacoes_aprovados` (contrato em `src/lib/rpc-contrato.js`).

Histórias de usuário: `docs/historias-de-usuario/lista-de-aprovados.md`. Explicações para a Aya:
`docs/aya/regras-da-lista-de-aprovados.md`. Testes: `tests/componentes/lista-aprovados.test.js`,
`tests/componentes/lista-de-convocacao.test.js`, `tests/componentes/convocado-e-carta.test.js`,
`tests/lib/carta-de-convocacao.test.js`, `tests/lista-convocacao-rules.test.js`,
`tests/lista-aprovados-filtros-multiplos.test.js` e
`tests/convocado-e-carta-de-convocacao-migration.test.js`.
