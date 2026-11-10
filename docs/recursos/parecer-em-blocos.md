---
tags:
  - tipo/desenho
  - area/recursos
---

# Parecer de recurso em blocos ("Montar parecer") — protótipo

Situação: **protótipo** (03/11/2026). Nada lê nem grava no banco; nenhuma migration. Serve para
mostrar à equipe da Saúde Indígena antes de ir ao ar.

O "Sistema automatizado de elaboração de pareceres" da equipe (um HTML avulso, que **não** fica no
repositório: o teste de paridade o lê de `SIMULADOR_DE_PARECERES`) vira uma tela do MONITORA, na gaveta do recurso
(Recursos › Analisar recursos). Decisões do usuário em 03/11/2026:

1. Só a **Avaliação documental** por enquanto. Cada bloco pertence a uma **etapa**: os blocos da
   Entrevista entram depois no mesmo catálogo, sem refazer a tela.
2. A **ordem das seções e os textos do simulador** são o **modelo padrão** do parecer, que o
   administrador poderá editar depois, como os modelos de resposta.
3. O que o MONITORA sabe vem **preenchido** (tabela abaixo).
4. Os **números de item e anexo do edital** vêm das Regras do edital, com os do simulador como padrão.
5. Protótipo primeiro.

## Onde está

| Arquivo                                         | O quê                                                                                                                                                                                                                                                                                                            |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/parecer-em-blocos.ts`                  | catálogo de blocos por etapa, modelo padrão (`TEXTOS_PADRAO`), referências do edital, composição do texto (`comporParecer`), meses (`calcularMesesCompletos`, portado do simulador), pré-preenchimento (`rascunhoInicial`) e a interface da fonte de dados (`FonteDoParecer`)                                    |
| `src/modulos/recursos/parecer-em-blocos/`       | a tela: `montar-parecer.tsx` (formulário em cartões + prévia + barra de ações), `blocos.tsx`, `documento.tsx` (prévia e impressão), `secao-montar-parecer.tsx` (a seção na gaveta), `dados-ficticios.ts` (a fonte do protótipo), `simulador.ts` (ponte com o simulador para a comparação e o teste)              |
| `prototipos/parecer-em-blocos/`                 | página avulsa (editor + comparação lado a lado com o simulador) e o empacotador num HTML só                                                                                                                                                                                                                      |
| `tests/parecer-em-blocos.test.js`               | texto esperado de 10 casos (fictícios, escrito no teste), meses numa grade de 4.000+ datas contra a função do simulador copiada no teste, referências, pré-preenchimento; com `SIMULADOR_DE_PARECERES` apontando para o HTML da equipe, também roda o simulador no jsdom e compara linha a linha (no CI, pulado) |
| `tests/modulos/recursos-montar-parecer.test.js` | a seção na gaveta, o modal por cima da gaveta e a prévia que acompanha o formulário                                                                                                                                                                                                                              |

Na gaveta, a seção só aparece com `?prototipo-parecer` no endereço ou
`localStorage["monitora:prototipo-parecer"] = "1"`, e mostra o caso fictício.

Para a página avulsa:

```bash
# a aba de comparação precisa do HTML da equipe (fora do repositório)
SIMULADOR_DE_PARECERES="…/SISTEMA AUTOMATIZADO DE ELABORAÇÃO DE PARECERES (2).html" \n  npx vite build --config prototipos/parecer-em-blocos/vite.config.mjs
node prototipos/parecer-em-blocos/empacotar.mjs   # dist/montar-parecer-prototipo.html (abre sem servidor)
```

## O rascunho e o documento

O rascunho (`RascunhoDoParecer`) é JSON puro: etapa, cabeçalho, alegações, admissibilidade, a lista
de blocos (cada um com `codigo` e os campos dele), conclusão, assinaturas, referências e pontos por
mês. É o que cada **versão** guardaria. `comporParecer(rascunho, textos)` devolve o documento em
linhas (título, parágrafo com trechos em negrito, lista, assinatura); `textoDoParecer` dá o texto
puro (para o "Parecer jurídico", o SEI e a cópia). Nada vira HTML cru.

Os textos aceitam `{marcador}` (preenchido uma vez, como texto) e `**negrito**`; as referências
entram como `{ref_<chave>}`. O negrito é separado antes de preencher: valor digitado com `**` não
vira negrito.

## O que vem preenchido, e de onde

| Campo                                                                         | Fonte hoje (RPC)                                                                                                             | Observação                                                                                        |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Candidato, código Empregare, edital, unidade (DSEI/CASAI), vaga, processo SEI | `get_recursos_da_area` (o recurso: `candidato`, `codigo`, `edital`, `unidade`, `vaga`, `processo_sei`)                       | já está na gaveta                                                                                 |
| Resumo das alegações                                                          | `get_recurso_candidato_detalhe` (`observacao`)                                                                               | ponto de partida; o analista resume                                                               |
| Prazo do recurso (de/até)                                                     | `get_recursos_da_area` (as etapas do cronograma) → `classificarCronograma` (`prazo-do-recurso.ts`) → `periodoDeInterposicao` | a atividade de **abertura** da origem; a de fim mais tardio (errata)                              |
| Data e hora de envio                                                          | **não existe**: hoje só `criado_em` (`DT_CRIACAO`, o cadastro)                                                               | aviso na tela; ver "Para produção"                                                                |
| Tempestividade                                                                | calculada: envio entre o início e o fim do prazo                                                                             | intempestivo leva a indeferimento, como no simulador                                              |
| Requisitos eliminatórios                                                      | `obter_ficha_analise` (resultado da ficha concluída: blocos com efeito `ELIMINA`)                                            | IDENTIDADE → identificação; ESCOLARIDADE/GRADUACAO → diploma; VINCULOS → experiência mínima       |
| Formação: nível e títulos                                                     | `obter_ficha_analise` (`lancamento.nivel`, `lancamento.titulos` aceitos, situação do bloco TITULOS)                          | os títulos da ficha (`TituloAcademico`) viram os itens do simulador (`TITULOS_POR_NIVEL.daFicha`) |
| Experiências (empresa, datas, atende/não atende, motivo)                      | `obter_ficha_analise` (`lancamento.vinculos`: `empregador`, `inicio`, `fim`, `aceito`, `motivo`)                             | os meses são contados pela regra do simulador; o "motivo da ficha" aparece só para quem escreve   |
| Laudo PcD, pertencimento indígena e aldeia, quilombola, heteroidentificação   | `obter_ficha_analise` (`lancamento.modalidades`, `indigena`, `mora_aldeia`; situação e efeito dos blocos COTA e PONTUACAO)   | bloco de cota que o candidato não optou sai do parecer (o analista pode pôr de volta)             |
| Pontos do item 6.5.1 (16/8/0)                                                 | regra da Avaliação documental (`obter_regra_analise`: bloco PONTUACAO `indigena` + `aldeia`)                                 | padrão 16                                                                                         |
| Pontos por mês de experiência                                                 | regra (bloco VINCULOS `pontos_por_mes`)                                                                                      | padrão 0,2 (o do simulador)                                                                       |
| Decisão (deferimento / parcial / indeferimento)                               | `get_recursos_da_area` (`situacao`: DEFERIDO, PARCIALMENTE_INDEFERIDO, INDEFERIDO)                                           |                                                                                                   |
| Manter/retificar, nota antiga e nova                                          | `obter_ajustes_pontuacao_recurso` (versão PROPOSTO ou APROVADO: `previa.antes.nota` → `previa.depois.nota`)                  | cancelado não conta                                                                               |
| Itens do edital citados                                                       | Regras do edital (abaixo)                                                                                                    | padrão do simulador                                                                               |
| Gestores que assinam                                                          | cargos e lotações do simulador; nomes em branco                                                                              | ver "Para produção"                                                                               |

A conta da ficha e a do simulador **não são a mesma**: a ficha conta dias ÷ 30 (une o dia seguinte e
soma o último dia); o simulador conta meses de calendário completos (o dia final não soma; intervalos
encostados não se unem). O parecer usa a do simulador e avisa quando as duas dão números diferentes
(no caso fictício: ficha 39, parecer 38).

## Onde ficam os números do edital

As Regras do edital (#620/#630) já têm `item_edital` na regra da Avaliação documental
(`TB_REGRA_ANALISE`/`TH_REGRA_ANALISE`, `DS_CONFIGURACAO`): em cada bloco, em cada motivo, em
`item_minimo`, no `corte`, no `lote` e nas observações prontas. O parecer já lê o `item_edital` dos
blocos **TITULOS** (formação, padrão 8.12) e **VINCULOS** (experiência, padrão 8.15).

Os demais números não têm lugar na regra hoje. Proposta: um objeto **`referencias_do_parecer`** na
configuração da regra da Avaliação documental (só o que difere do padrão), editado num cartão
"Itens do edital citados no parecer" da etapa 2 das Regras do edital, validado como os outros textos
curtos (`FC_JSON_TEXTO_OK`, até 40). As chaves são as de `REFERENCIAS_DO_EDITAL`:

| Chave                                                                          | Padrão                        | Onde aparece                     |
| ------------------------------------------------------------------------------ | ----------------------------- | -------------------------------- |
| `identificacao`, `identificacao_alinea`                                        | 6.4, c                        | requisitos eliminatórios         |
| `formacao` (bloco TITULOS)                                                     | 8.12                          | formação                         |
| `formacao_frente_verso`, `formacao_nato_digital`, `formacao_provavel_formando` | 8.12.2, 8.12.2.1, 8.12.2.2    | motivos da formação; residência  |
| `experiencia` (bloco VINCULOS)                                                 | 8.15                          | experiência que não atende       |
| `experiencia_quadro`                                                           | 8.8                           | quadros de experiência por nível |
| `experiencia_anterior`, `experiencia_indigena`, `ata_de_defesa`                | 8.15.1, 8.15.2.1, 8.14.5.2    | critérios "Outros"               |
| `indigena`, `indigena_alinea`, `aldeia_alinea`, `indigena_no_recurso`          | 6.4, h, i, 6.5.1              | pertencimento indígena           |
| `anexo_aldeia`, `anexo_pcd`, `anexo_quilombola`, `anexos_heteroidentificacao`  | VI, VIII, XI, IX e X          | anexos                           |
| `heteroidentificacao`                                                          | 5.5.1                         | heteroidentificação              |
| `recurso_forma`, `recurso_decisao_final`                                       | 11.1, 11.4, 11.6 e 11.8; 11.8 | conclusão                        |

`referenciasDoEdital(regra)` já resolve a precedência (gravada › item do bloco › padrão) e diz a fonte
de cada uma. Para a Entrevista, o mesmo objeto vai para a configuração da entrevista quando os blocos
dela existirem.

## Para produção (nada disto foi feito)

**Banco** (migrations novas, padrão MAD):

- `TB_PARECER_RECURSO` (o vigente) e `TH_PARECER_RECURSO` (as versões), no molde de
  `TB_RESPOSTA_RECURSO`/`TH_RESPOSTA_RECURSO`: `CO_PARECER_RECURSO`, `CO_RECURSO_CANDIDATO` (FK, um
  parecer por recurso e etapa), `TP_ETAPA` (`AVALIACAO`, depois `ENTREVISTA`), `NU_VERSAO`,
  `DS_RASCUNHO` (jsonb: o `RascunhoDoParecer`), `DS_TEXTO` (o texto composto, o que foi assinado),
  `CO_MODELO_PARECER` + `NU_VERSAO_MODELO` (que versão do modelo), `NU_VERSAO_REGRA` (a regra cujas
  referências valeram), `DT_CRIACAO`/`CO_USUARIO_CRIACAO`, `ST_VIGENTE`. Nada se apaga.
- `TB_MODELO_PARECER_RECURSO` (versões), como `TB_MODELO_RESPOSTA_RECURSO`: área, etapa, `DS_TEXTOS`
  (jsonb, só as diferenças de `TEXTOS_PADRAO`), ativo/arquivado. O banco recusa chave fora da lista.
- Coluna para a **data e hora de envio** do recurso pelo candidato em `TB_RECURSO_CANDIDATO`
  (ex.: `DT_ENVIO_RECURSO`), preenchida no cadastro (o e-mail ou a Empregare); sem ela, o parecer usa
  o cadastro e avisa.
- `referencias_do_parecer` na validação da regra da análise (`FC_VALIDAR_REGRA_ANALISE`).

**RPCs** (com `src/lib/rpc-contrato.ts`):

- `obter_dados_parecer_recurso(p_recurso)`: num pedido só, o recurso, o período de interposição, a
  ficha concluída do candidato no edital (`TB_FICHA_ANALISE` pela inscrição — `CO_MONITORAMENTO` +
  `CO_EMPREGARE_CANDIDATO` do recurso; só o lançamento e o resultado, sem CPF), o recorte da regra
  (blocos e `referencias_do_parecer`), a última versão do ajuste, o modelo vigente e os gestores.
  Mesma permissão de `get_recurso_candidato_detalhe`.
- `salvar_parecer_recurso(p_recurso, p_etapa, p_versao, p_rascunho, p_texto)`: grava a versão
  seguinte (conflito de versão = PT409), revalida o rascunho (estrutura, tamanhos) e registra no
  histórico do recurso. Quem edita Recursos ou dá o parecer jurídico.
- `listar_versoes_parecer_recurso(p_recurso)`, e os do modelo (`listar_`/`salvar_`/
  `arquivar_modelo_parecer_recurso`), como os dos modelos de resposta.
- Ligar ao fluxo existente: "Usar no parecer jurídico" leva `DS_TEXTO` para o texto do
  `transicionar_recurso_candidato` (deferir/indeferir), sem mudar as regras do parecer jurídico.

**Tela**: a fonte fictícia sai (`dados-ficticios.ts`) e entra a das RPCs atrás da mesma
`FonteDoParecer`; "Salvar versão" liga; a seção da gaveta perde a chave do protótipo; os gestores vêm
de uma configuração da área (hoje só os cargos do simulador, com os nomes a preencher); a Aya ganha o verbete do parecer.
Adaptar à raiz React única (#632) se ela entrar antes.

## Diferenças e dúvidas encontradas no simulador

Corrigidas no modelo padrão (o teste aplica as mesmas correções ao texto do simulador):

- "conforme modelo **established** no Anexo XI" (quilombola) e "Declaração conforme modelo
  **established** no Anexo VI" (aldeia) → "estabelecido".
- "Caso o pertencimento étnico **declared** não seja **confirmed**" → "declarado", "confirmado".

Mantidas como no simulador (para a equipe decidir no modelo):

- "alega, em síntese, que **:** …" (espaço antes dos dois-pontos).
- "não guarda relação direta **com na** área à qual concorre".
- "deve-se manter o resultado preliminar devido **a** exposição de motivos" (falta a crase).
- "conforme especificação **editalícias**" (concordância).
- "Quanto **a** formação acadêmica" (sem crase) em dois textos da formação e "Quanto **à**" nos outros dois.
- "conforme item 8.12**.** do edital" (ponto depois do número) e "(8.12.2**.**)".
- Formação comprovada sem título marcado diz que "o(a) candidato(a) **não selecionou** nenhum título
  válido" — quem não selecionou foi o analista.
- O texto do critério na prévia é diferente do rótulo da caixa em vários itens (atuação voluntária,
  "8.15.1" perde "ressalvadas as hipóteses previstas nos subitens 8.15.2", "8.14.5.2" é resumido). O
  parecer usa o texto da prévia (o que vai para o documento).
- Requisitos: as caixas 1 e 2 (identidade) dizem quase a mesma coisa.
- Intempestivo trava "não atendendo"; tempestivo permite "não atendendo" ao período, o que se
  contradiz no texto. Também permite **deferimento com "manter"** e **indeferimento com "retificar"**.
- O prazo compara só o dia (não a hora limite do último dia).
- Experiência: 0,2 ponto por mês **sem teto** (a regra do edital tem teto); intervalos encostados
  (fim 30/06, início 01/07) não se unem e cada um perde o mês do dia final; experiência "Atende" sem
  datas entra na lista de empresas com 0 mês; "Não atende" sem critério marcado termina em "visto que:".
- Formação: pontos cumulativos sem teto; o mapeamento dos títulos da ficha para os itens do nível
  técnico ("Especialização técnica" × graduação/pós) é uma suposição a confirmar.
- O cabeçalho do texto ("Etapa de Avaliação Documental e de Títulos", "Resultado Final da Avaliação
  Documental e de Títulos") vira o título da etapa; na Entrevista, "Etapa de Entrevista".
- O simulador insere o que se digita como HTML (um `<b>` digitado vira negrito); aqui é sempre texto.
- "Excluir bloco" no simulador não volta atrás (só recarregando a página); aqui o bloco volta pelo chip.
- As lotações das assinaturas (Núcleo, Unidade de Saúde Indígena, DAIS) são fixas no simulador; aqui
  fazem parte da assinatura (para outras áreas).
