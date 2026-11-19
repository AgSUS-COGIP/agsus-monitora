---
tipo: modulo
area: modulo
atualizado: 2026-11-19
---

# Módulo: Classificação

A tela `#page-classificacao` (view `classificacao`, rota `/<área>/classificacao[/<edital>]`), em
`src/modulos/classificacao/`: `criarClassificacao()` devolve o conteúdo e o controlador; a rota
(`src/app/telas.tsx`) chama `render()` a cada abertura e `abrirEdital()` com o edital do endereço.
Área = a atual do app; sem edital, a entrada mostra a busca e os cards dos editais, Ativos e
Histórico separados (`AtivosEHistorico`; o status vem das linhas do monitoramento)
(`entrada-da-classificacao.tsx`); escolhido, o nome fica no cabeçalho com "Trocar". Os cards trazem
só os editais da área com análise curricular ativa (qualquer origem) ou com lista gerada, ativos e
em andamento primeiro (`listar_editais_classificacao`,
`20261023120000_classificacao_so_editais_analisados.sql`). Aberto pela navegação (a faixa das
etapas, a página do edital) antes de a lista chegar, o cabeçalho diz "Carregando…"; fora da lista,
"Edital fora desta lista" com "Trocar" e o aviso de que não há classificação gerada nem análise para
classificar, nunca o id (`src/lib/editais/edital-na-lista.ts`, o mesmo do seletor de edital).

Banco, contratos TypeScript, o job Python (relatório de desempate e "Gerar listas pelo Python") e
os testes: [[classificacao-por-dentro]].

## Regra e listas

- A regra de classificação é **de cada edital** (decidida pelo gestor, versionada no banco); nada é
  fixo no código. A conta é do motor puro `src/lib/classificacao/motor.ts`. O editor da regra é
  montado em Editais › Regras do edital, etapa 4; a visão "Regra" da tela mostra só o resumo.
- Listas (`TIPOS_DE_LISTA`), no padrão das publicações da AgSUS: `PRELIMINAR` (avaliação documental
  e de títulos, com as parciais e os eliminados — vale como preliminar ou final da etapa; a
  exportação escolhe o título), `CONVOCACAO`, `ENTREVISTA` (resultado da entrevista; empate na mesma
  posição) e `FINAL` (vagas imediatas e cadastro reserva).
- No `FINAL`, cada linha guarda também a nota de cada etapa (`nota_documental`, `nota_entrevista`;
  16/11/2026, no motor e no Python): a tela mostra as colunas Análise curricular, Entrevista e Nota
  final; o documento oferece "Nota da análise curricular" e "Nota da entrevista" para marcar em
  "Como fica no SEI"; a planilha XLSX traz as duas no fim.
- O resultado final explica a conta no fim do documento (`textoDaComposicao`, `documento-sei.ts`,
  17/11/2026), pela composição da regra: "A nota final é a média aritmética da nota da análise
  curricular e da nota da entrevista" (pesos iguais que somam 1), a soma (pesos 1) ou a porcentagem
  de cada nota; sem ela, a nota final abaixo da análise curricular parecia perda de pontos. Nos
  textos padrão (resultado final e resultado final da entrevista), a conta entra pelos campos
  `{frase_da_nota}` e `{conta_entre_virgulas}` (`contaDaNotaFinal`), no lugar do "soma… até 30…
  até 20" fixo que veio do 83/2026; a frase do fim só entra se nenhum texto já fala da conta.
- A lista `CONVOCACAO` gerada aqui é a única convocação para a entrevista: Conduzir entrevistas ›
  Preparar mostra a última gerada e registra para a ficha só quem está nela
  (`20261005150000_convocacao_unica_da_entrevista.sql`); o retrato guarda, por vaga, as vagas, a
  origem delas e o limite da convocação (`instantaneoDaLista`).
- Quem ainda não tem resultado na avaliação documental (ficha Pendente, Em análise ou Revisar;
  `SITUACOES_AGUARDANDO_ANALISE` em `catalogo.ts`) fica em "Aguardando análise" (`aguardando` por
  vaga e nos totais): fora das listas e dos eliminados, fora do documento do SEI, numa planilha à
  parte no XLSX.
- Visão "Lista" (`listas.tsx`): faixa de situação (cada número é o total da lista que abre), avisos e
  pendências, gerar/exportar, filtros (recorte na URL e na sessão por edital), tabela agrupada por
  vaga, eliminados, gaveta com a explicação e registro do empate (sorteio ou decisão). A hora da
  certidão (`hora-de-nascimento.tsx`) só aparece quando o empate chega à maior idade no mesmo dia
  (sem certidão = 23:59:59).

## Geração desatualizada

A geração guardada é conferida com os dados de agora (`geracaoDesatualizada` em
`src/lib/classificacao/dados.ts`: versão da regra, quantidades e, com o retrato lido, o conteúdo).
Desatualizada, a tela avisa "Esta geração é de …; os dados mudaram desde então — gere de novo.",
bloqueia "Marcar como publicada"/"Publicar como lista de aprovados" e as exportações pedem
confirmação. Os dois caminhos de publicar leem o retrato (`conferirAntesDePublicar` em `estado.ts`)
e só publicam se o conteúdo inteiro bater; senão, pedem para gerar de novo.

## Vagas por modalidade

Quadro do edital > configuração de convocação do edital (Lista de aprovados › Convocação,
`TB_CONVOCACAO_EDITAL`) > percentuais da regra — as duas últimas pela mesma `derivarQuadro` da
convocação (`src/lib/classificacao/convocacao-do-edital.ts`). A regra de classificação decide
listas, remanejamento e acúmulo; a ordem de chamada é da Convocação. Sem acesso à convocação (42501)
ou sem as RPCs no banco, vale a regra; outra falha (rede, banco) vira `erroDaConvocacao`: aviso com
"Tentar novamente" e "Gerar" bloqueado até ler de novo.

## Publicar como lista de aprovados

- O resultado FINAL é a fonte da Lista de aprovados. "Publicar como lista de aprovados"
  (`publicar-aprovados.tsx`, resultado final, editor) cria a lista vigente do edital
  (`TB_LISTA_APROVADO` com `TP_ORIGEM` = `CLASSIFICACAO`), levando status, matrícula, sub judice e
  anexos de quem já estava na lista. Mostra o que muda em relação à lista vigente (entram, saem,
  mudam de posição, preservados, sub judice mantidos) e a revisão de quem não casou.
- Casamento das pessoas, resumo e candidatos do retrato em `src/lib/aprovados/publicacao-de-aprovados.ts`; o
  banco confere os vínculos e grava `TH_PUBLICACAO_APROVADO`
  (`20261005160000_lista_de_aprovados_da_classificacao.sql`). A Lista de aprovados mostra a origem
  e, no modal do edital, oferece publicar daqui.
- A prévia exige os candidatos da lista vigente com identidades únicas e coleções válidas, sem
  descartar pessoas para montar uma revisão parcial; a confirmação valida quantidade e pendências
  retornadas pelo banco (`src/lib/aprovados/dados-da-publicacao-de-aprovados.ts`).

## Agenda das entrevistas

- Visão "Agenda" (`agenda.tsx`): regra da agenda (versões), gerar pela regra, avisos (não cabe,
  sobra), ajuste manual com conflito, XLSX; o botão "Agenda das entrevistas" da convocação abre esta
  visão. Store em `estado-da-agenda.ts` (`obter_agenda_entrevista`, `salvar_regra_agenda_entrevista`,
  `salvar_agenda_entrevista`); a agenda salva preenche DATA e HORA do documento da convocação
  (`agendaDoDocumento`) e faz Conduzir entrevistas abrir a fila em Hoje.
- Motor em `src/lib/entrevistas/agenda-das-entrevistas.ts`; banco em `20261005120000_agenda_das_entrevistas.sql`.
- Convocação inválida mostra erro e bloqueia a geração; a convocação registrada que não veio (rede,
  banco) mostra erro com "Tentar novamente", sem cair no cálculo atual. Falha ao atualizar o mesmo
  edital preserva a agenda aberta.
- A agenda é lida por GET (`obter_agenda_entrevista` é STABLE): o supabase-js repete sozinho quando a
  conexão cai; a falha que sobra diz o motivo (rede, permissão, edital) e vai ao console. Regra da
  agenda não salva e edital sem lista de convocação não são erro. A convocação registrada é lida uma
  vez por lista (e no "Tentar novamente"), não a cada releitura do edital.

## Documento oficial (SEI, DOCX, PDF, XLSX)

- "Como fica no SEI" (`documento.tsx`): quase tela cheia (ou tela cheia), folha A4 com zoom (escala
  em `src/lib/classificacao/escala-da-previa.ts`), painel recolhível com as abas Dados | Textos |
  Colunas e rodapé fixo; no celular, uma coluna. Aba Colunas (`colunas-do-documento.tsx`): marcar e
  ordenar (setas ou arrastar) as colunas, por publicação
  (`src/lib/classificacao/colunas-do-documento.ts`).
- `documento-sei.ts` (modelo das publicações do SEI, textos-padrão do 83/2026 e do 100/2026) e
  `documento-docx.ts` (Word com papel timbrado), em `src/lib/classificacao/`;
  `documento-no-navegador.ts`: área de transferência (HTML + texto), logo em PNG, impressão.
- Textos e colunas ajustados pelo gestor ficam na regra (`DS_CONFIGURACAO.documento`, `.colunas` por
  publicação, `.desempate` = a nota abaixo de cada tabela, geral ou de cota, com empate de nota
  resolvido; sem migration); o cabeçalho da agência, em Configurações › Marca
  (`documento_cabecalho`, `src/lib/base/cabecalho-dos-documentos.ts`).

## Explicações

Para a Aya (a explicação mora lá, não na interface):
[regras-da-classificacao](../aya/regras-da-classificacao.md),
[regras-da-lista-de-aprovados](../aya/regras-da-lista-de-aprovados.md) e
[regras-das-entrevistas](../aya/regras-das-entrevistas.md).

## Relacionadas

- [[classificacao-por-dentro]] — banco, contratos, motor em Python e testes
- [[modulo-avaliacao-documental]] — as notas que entram nas listas; o passo 4 do assistente grava a regra
- [[modulo-triagem]] — listas PROVISORIA e LOTE exportadas pelo gerador daqui
- [[modulo-entrevistas]] — usa a CONVOCACAO, o desempate e a agenda
- [[modulo-aprovados]] — o resultado FINAL vira a lista de aprovados
- [[modulo-recursos]] — ajustes da pontuação aprovados em recurso
- [[modulo-editais]] — etapa 4 das Regras do edital
- [[modulo-configuracoes]] — cabeçalho dos documentos (Marca)
