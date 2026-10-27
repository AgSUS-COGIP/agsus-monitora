# `src/modulos/aprovados/` — Lista de aprovados

A tela `#page-approved` (view `approved`): monta na própria `<section>` por
`montarListaAprovados()` (`src/main.ts` → `window.aprovadosController`); o legado chama `render()` ao
navegar e `openImportModal(id, rótulo)` pelo botão de listas de Editais. Área = a atual do app.

Três visões no topo: **Aprovados** (indicadores, filtros, tabela de rolagem contínua),
**Convocação** (a ordem de chamada de cada vaga, calculada pelo modelo de convocação e pelas vagas
imediatas do edital) e **Pendências** (decisões do gestor com motivo e histórico, com selo de abertas).
As duas primeiras leem os mesmos candidatos: mudar um status redesenha ambas; decidir uma pendência
recarrega a lista.

```
lista-aprovados.tsx        <ListaAprovados>, montarListaAprovados() e os modais abertos (ModalAberto)
estado.ts                  store sem React: candidatos (pacote compacto por área, cópia no navegador),
                           listas, configuração de convocação, anexos, convocações (data da
                           convocação e cartas por candidato), ações que escrevem no banco e o estado
                           da carta (`estado.carta`)
aba-aprovados.tsx          visão Aprovados: KPIs (Convocados no lugar do antigo Fim de fila), filtros,
                           tabela na TabelaInfinita de src/ui (50 por vez ao rolar, busca da tabela,
                           ordenação pelo cabeçalho, linha que abre a gaveta), ações por linha
                           (anexos, status, carta, decisão judicial, sub judice)
aba-convocacao.tsx         visão Convocação: KPIs (A convocar, Convocados…), filtros, escolha dos
                           candidatos para a carta, "Escolher os a convocar", Exportar CSV, uma tabela
                           por vaga
partes.tsx                 peças das duas abas: selo de status (com a data do Convocado), nome que abre
                           a gaveta, ações de status, carta e anexos, paginação (Convocação), CampoEditavel
modais.tsx                 status (Convocado pede a data), anexos, sub judice
gaveta-do-candidato.tsx    a gaveta do candidato: dados, status e as cartas de convocação emitidas
modal-listas-do-edital.tsx listas do edital: origem, importar XLSX, publicar da Classificação
formulario-de-convocacao.tsx, editor-de-modelo.tsx, previa-da-convocacao.tsx
                           configuração da convocação do edital (modelo de reserva de vagas)
carta-de-convocacao/       a carta de convocação para contratação
  estado.ts                store da carta: modelos da área, salvar versão, inativar, emitir (SEI,
                           DOCX, PDF) registrando a emissão uma vez por carta, histórico do candidato
  modal-da-carta.tsx       emitir para um ou vários: modelo, valores da emissão, um documento ou uma
                           carta por candidato, prévia "Como fica no SEI", saídas e "Marcar como
                           Convocado"
  modelos-da-carta.tsx     os modelos: lista, editor com os campos, prévia, versões, inativar/reativar
  carta.css                só desta parte (e da gaveta do candidato)
pendencias/                a aba Pendências (migration 20261026190000; detecção no job Python
                           scripts/aprovados/pendencias.py; regras em src/lib/pendencias-do-edital.ts)
  estado-das-pendencias.ts store: as pendências da área, o modal e a decisão (RPC por tipo)
  aba-pendencias.tsx       indicadores por tipo, edital e situação, cartões, histórico e o modal da decisão
aprovados.css, convocacao.css
```

## Status do candidato

Convocado (com a data da convocação), Contratado, Desistente, Migração e Documentação Rejeitada.
"Fim de Fila" saiu (migration `20261005180000`). Status já definido só o admin de Aprovados muda,
exceto do Convocado para o status seguinte (quem edita faz); deixar sem status é sempre do admin.
Contratados (Seleção e KPIs) são só Contratado e Migração. Regras: `src/lib/lista-aprovados-rules.ts`
(status, trava, resumo) e `src/lib/lista-convocacao-rules.ts` (ordem, "a convocar", CSV).

## Carta de convocação

Modelos por área (e, se quiser, por edital), versionados no banco — motivo a partir da 2ª versão;
inativar com motivo, nada se apaga. Quem edita é quem tem Editor em Aprovados. O texto, o
preenchimento e a validação são de `src/lib/carta-de-convocacao.ts`; o documento (HTML do SEI, texto,
página da prévia/PDF, DOCX e ZIP) é de `src/lib/carta-de-convocacao-documento.ts`, que reaproveita o
documento oficial da Classificação (`src/lib/classificacao/documento-sei.ts` — `paginaNoModeloDoSei`
— e `documento-docx.ts` — `pacoteDocx`, `arquivosDoDocx`) e o que precisa do navegador
(`../classificacao/documento-no-navegador.ts`: área de transferência, logo em PNG, impressão). O
cabeçalho é o de Configurações › Marca.

O módulo de cartas, seu estado e os geradores estão em TypeScript/TSX. Os contratos
compartilhados ficam em `src/lib/tipos-da-carta.ts`; `src/lib/dados-da-carta.ts` confere
as respostas usadas. Uma coleção de modelos malformada interrompe a carga. Uma emissão
sem identificador confirmado não gera a saída nem repete automaticamente o registro;
o aviso orienta conferir o histórico antes de tentar outra emissão.

Campos: {NOME}, {CPF} (sempre mascarado; a lista não guarda CPF, então sai em branco e a emissão
avisa), {CARGO}, {VAGA}, {LOTACAO} / {LOTAÇÃO/UNIDADE}, {UNIDADE}, {EDITAL}, {POSICAO}, {MODALIDADE},
{DATA_LIMITE}, {LOCAL}, {DOCUMENTOS} (sozinho na linha vira a lista), {CONTATO} e {DATA}.

A configuração de convocação também está em TypeScript/TSX: formulário, editor e prévia,
com regras em `src/lib/modelo-de-convocacao.ts` e `src/lib/configuracao-de-convocacao.ts`.
Os tipos compartilhados ficam em `src/lib/tipos-da-configuracao-de-convocacao.ts` e são
reutilizados pela Classificação. A leitura confere coleções, identidades e chaves duplicadas;
uma resposta malformada exibe aviso e preserva os mapas anteriores. A precedência permanece
quadro manual da vaga, total da vaga e padrão do edital.

O cálculo e a aba de Convocação também estão em TypeScript/TSX. Os contratos de
candidatos, linhas, grupos e CSV ficam em `src/lib/tipos-da-lista-de-convocacao.ts`;
a tela usa `tipos-da-aba-de-convocacao.ts`. Candidatos sub judice sem código são
associados ao cargo somente quando existe uma única vaga desse cargo no próprio
edital. Vagas de outros editais não participam dessa escolha.

A aba Aprovados, as peças compartilhadas e as regras de filtros/status também estão
em TypeScript/TSX. Os contratos ficam em `src/lib/tipos-das-regras-de-aprovados.ts`
e `tipos-da-aba-de-aprovados.ts`. Filtros e paginação preservam os campos adicionais
dos candidatos. Campos editáveis distinguem o valor recebido e o valor convertido,
sem substituir o texto enquanto se digita. A paginação garante ao menos
uma linha para tamanhos positivos menores que 1.

A entrada, o estado, os modais e a gaveta também estão em TypeScript/TSX: todos os
componentes e estados desta pasta estão tipados. Contratos em `tipos-do-estado.ts`,
`tipos-dos-modais.ts` e `src/lib/tipos-do-estado-de-aprovados.ts`. A carga valida
candidatos e listas antes de publicá-los. A marcação de convocados exige confirmação
completa dos IDs do pedido antes de mudar os status locais.

Os históricos de cartas e publicações são validados antes de chegar à interface.
Falha de rede ou resposta malformada libera uma nova tentativa na gaveta ou no modal
de listas; rejeição da chamada não deixa o histórico de cartas preso no carregamento.
Testes de contrato em `tests/tipos/modais-dos-aprovados.tsx` e regressões em
`tests/lib/historicos-dos-aprovados.test.js`.

A base compartilhada também está em TypeScript: `src/lib/aprovados-import.ts`
lê e valida o XLSX; `candidatos-aprovados-compactos.ts` expande os formatos 1 e 2;
`anexos-do-candidato.ts` confere os PDFs e converte seus bytes em base64.
Contratos em `src/lib/tipos-da-importacao-de-aprovados.ts`; testes da leitura real
da planilha em `tests/lib/importacao-xlsx-de-aprovados.test.js`.

## Banco

`supabase/migrations/20261005180000_convocado_e_carta_de_convocacao.sql` (ensaio em
`supabase/ensaios/`, rollback em `supabase/rollback/`, com o mesmo nome): `DT_CONVOCACAO` no
candidato e no histórico do status, gatilho que leva a data na publicação da lista,
`TB_MODELO_CARTA_CONVOCACAO`, `TH_MODELO_CARTA_CONVOCACAO`, `TH_CARTA_CONVOCACAO`,
`RL_CARTA_CANDIDATO` e as RPCs `alterar_status_candidato_aprovado` (com `p_data_convocacao`),
`marcar_candidatos_convocados`, `listar_modelos_carta_convocacao`, `salvar_modelo_carta_convocacao`,
`definir_modelo_carta_ativo`, `registrar_carta_convocacao`, `listar_cartas_do_candidato` e
`listar_convocacoes_aprovados` (contrato em `src/lib/rpc-contrato.js`).

"Contratado em outra lista" (`supabase/migrations/20261024120000_contratado_em_outra_lista.sql`):
o status explícito e a situação que o job Python (`scripts/aprovados/contratacao.py`) decide e
o pacote traz no dicionário `contratacao` (`contratacao_situacao`, `contratacao_motivo`); o selo
(`SeloDeStatus`), os indicadores e o filtro usam `statusEfetivo`, e a Convocação, `statusNaFila`.

Histórias de usuário: `docs/historias-de-usuario/lista-de-aprovados.md`. Explicações para a Aya:
`docs/aya/regras-da-lista-de-aprovados.md`. Testes: `tests/componentes/lista-aprovados.test.js`,
`tests/componentes/lista-de-convocacao.test.js`, `tests/componentes/convocado-e-carta.test.js`,
`tests/lib/carta-de-convocacao.test.js`, `tests/lista-convocacao-rules.test.js`,
`tests/lista-aprovados-filtros-multiplos.test.js` e
`tests/convocado-e-carta-de-convocacao-migration.test.js`.
