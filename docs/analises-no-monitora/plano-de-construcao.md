# Avaliação documental — plano de construção

Este é o plano para construir o que o [README](README.md) desenha, em fases pequenas. **Cada fase
vira um PR testável**, que pode ser mesclado sozinho. O piloto é o **edital 93/2026** (SESMT, área
Projetos), decidido em 05/10/2026. O modelo de dados está em [modelo-de-dados.md](modelo-de-dados.md)
e as histórias (códigos AM-n) em
[../historias-de-usuario/analises-no-monitora.md](../historias-de-usuario/analises-no-monitora.md).

## Ponto de partida do 93/2026 (banco em 05/10/2026, só contagens)

| O quê                                   | Hoje                                                                   |
| --------------------------------------- | ---------------------------------------------------------------------- |
| Análises ativas (planilha de Projetos)  | 86, em 5 vagas: 71 Pendentes e 15 em Revisar (com parecer e sem etapa) |
| Regra de classificação                  | cadastrada (1)                                                         |
| Quadro de vagas                         | 5 vagas, 11 vagas imediatas                                            |
| Vagas na Seleção (`TB_SELECAO_VAGA`)    | **0**                                                                  |
| Vagas e candidatos no robô da Empregare | **0** / **0**                                                          |

O robô liga cada vaga ao edital pela Seleção (`TB_EMPREGARE_VAGA.CO_MONITORAMENTO`). Por isso, o
**primeiro passo** é colocar as 5 vagas do 93/2026 na Seleção e rodar o robô para elas (fase F0).

## Regras para todas as fases

- Migrations no padrão MAD, com `ensaios/` e `rollback/`, a partir do timestamp `20261006…`, e
  revisadas pela skill `mad-ddl-review`.
- Toda RPC nova vai para `src/lib/rpc-contrato.js`.
- As telas são React em `src/modulos/avaliacao-documental/`, com o visual de `src/ui/` e a lógica
  pura em `src/lib/avaliacao-documental/` (com testes Vitest).
- Nada novo em `src/modules/`. Sem textos genéricos: as explicações vão para `docs/aya/`.
- A mesma conta existe em `src/lib` e no banco, e um arquivo de casos compartilhado (incluindo os do
  simulador) garante que as duas dão o mesmo número.
- **Python** (base comum `python/monitora/` da branch `feat/python-base-e-conferencias`: RPC,
  mascaramento, configuração e registro) entra onde há trabalho em lote ou com arquivos grandes:
  - o robô da Empregare (F0, F7);
  - o recálculo em massa da Provisória e do lote, e a comparação com a planilha (F2, F8);
  - a geração dos documentos grandes das listas, se o DOCX no navegador não der conta (F6).

  A regra de negócio continua no banco (RPCs). O Python orquestra, carrega e confere.

- **Conta pesada ou em lote não roda em função SQL a cada requisição nem no navegador por usuário**
  (orientação de 06/10/2026). Ela vai para a base Python (`python/monitora/`, jobs no GitHub
  Actions ou `api/*.py`), que grava o resultado pronto; o banco fica com gravação, validação,
  permissão e consultas leves. A lib pura de `src/lib/avaliacao-documental/` serve à prévia
  instantânea da tela e é a referência dos **casos dourados**
  (`tests/fixtures/avaliacao-documental/casos-de-pontuacao.json`), que o Python reproduz a partir da
  F2 (pré-classificação e nota declarada em lote).
- Cada fase termina com: testes verdes, `npm run build`, conferência no navegador e a Aya
  atualizada (`docs/aya/regras-da-avaliacao-documental.md`).

---

## F0 — Preparar o piloto: vagas do 93/2026 e robô

**Entrega:** as 5 vagas do 93/2026 aparecem na Seleção, e o robô traz os candidatos delas.

- As vagas entram na planilha Auditoria (a fonte da Seleção, com a carga diária). Alternativa sem
  código: rodar o robô com `vagas` = os 5 códigos e ligar as vagas ao edital por uma correção de
  dados revisada.
- Rodar o robô (modo `normal`, `editais` = 93/2026).

**Aceite:**

- `TB_EMPREGARE_VAGA` tem as 5 vagas com `CO_MONITORAMENTO` do 93/2026;
- `TB_EMPREGARE_CANDIDATO` tem os candidatos;
- os códigos casam com os `id_origem` das 86 análises (contagem).

**Migrations:** nenhuma (no máximo, uma correção de dados em `supabase/correcoes/`).
**Python:** o robô que já existe.
**Riscos:** o código das vagas na planilha diferente do da Empregare; o arquivo exportado vir
incompleto (a trava do robô recusa).
**O usuário:** incluir as vagas do 93/2026 na planilha Auditoria (ou autorizar a correção) e rodar
o robô em Configurações › Status das atualizações › Rodar agora.

## F1 — Menu, permissão e regra da avaliação por edital

**Situação: feita em 06/10/2026** (branch `feat/avaliacao-documental-f1`; migrations ainda por
aplicar). O que entrou:

- `20261006090000_avaliacao_documental_permissao_e_menu.sql`: o recurso (administrador global,
  edital_gestor e coordenador = Administrador; os demais grupos sem acesso no piloto), a aba
  "Avaliação documental" desligada na ordem 5 e o rótulo "Painel das análises";
  `20261006090500_liga_aba_avaliacao_documental.sql` liga a aba com o merge do front.
- `20261006100000_regra_da_analise.sql`: as tabelas da lista abaixo, a validação da regra no banco
  (`FC_VALIDAR_REGRA_ANALISE`, estrutura apenas — nenhuma conta de pontos em SQL) e as RPCs
  `listar_editais_avaliacao`, `obter_regra_analise`, `copiar_modelo_regra_analise`,
  `salvar_regra_analise`, `conferir_regra_analise`, `obter_equipe_edital`, `salvar_equipe_edital` e
  `salvar_aldeias_dsei`. A `simular_regra_analise` do desenho virou a prévia no navegador (lib pura,
  sem gravar); `salvar_aldeias_dsei` recebe a lista inteira do DSEI.
- `supabase/correcoes/20261006-modelos-da-regra-da-analise.sql`: os modelos PROJ26-CURRICULAR
  (lido do PDF do 93/2026), SI26-INTERIOR-SUL (simulador do 28/2026) e SI26-100, e o 93/2026 em
  `PLANILHA`. O SI26-83 ficou de fora (falta o questionário/regra para montá-lo).
- Tela `src/modulos/avaliacao-documental/` (abas Regra e Equipe, prévia com candidato fictício),
  lógica pura `src/lib/avaliacao-documental/` com os casos dourados e os verbetes da Aya.
- Fica para a F3: AM-2.3 (fichas afetadas por versão nova; a RPC já devolve a lista, vazia) e AM-3.3
  (fichas em análise de quem sai da equipe).

**Entrega (planejada):**

- o recurso de permissão `avaliacao_documental`;
- no menu, "Painel das análises" (o rótulo novo da tela de hoje) e "Avaliação documental" (a tela
  nova);
- a aba **Regra da avaliação**: cadastro a partir de um modelo, versões com motivo, lista das
  perguntas e respostas da última carga para ligar aos blocos, motivos padronizados, pontuação e a
  prévia com um candidato fictício;
- a aba **Equipe** (`RL_ANALISTA_EDITAL`; o gestor do edital já entra como coordenação);
- `TB_ORIGEM_ANALISE_EDITAL`, com o 93/2026 em `PLANILHA`.

**Aceite:** AM-1.1, AM-1.2, AM-2.1 a AM-2.7 e AM-3.1 a AM-3.3.

**Migrations:**

- `20261006090000_avaliacao_documental_permissao_e_menu.sql`: recurso, `CK_` das tabelas de
  permissão e grupos padrão;
- `20261006100000_regra_da_analise.sql`: `TB_REGRA_ANALISE`, `TH_REGRA_ANALISE`,
  `TB_REGRA_ANALISE_MODELO`, `TD_ALDEIA_DSEI`, `RL_ANALISTA_EDITAL`, `TB_ORIGEM_ANALISE_EDITAL` e
  `TH_`, com as RPCs `obter/salvar/simular/copiar_modelo_regra_analise`, `salvar_equipe_edital` e
  `salvar_aldeias_dsei`;
- correção de dados: os modelos PROJ26-CURRICULAR, SI26-100, SI26-83 e SI26-INTERIOR-SUL.

**Python:** nenhum.
**Riscos:** o formato da regra crescer demais. A mitigação é `FC_VALIDAR_REGRA_ANALISE` e a
validação em `src/lib`, com testes por bloco.
**O usuário:** conferir a regra do 93/2026 (blocos, motivos, pontos e nota mínima) e dizer quem
analisa e quem revisa.

## F2 — Provisória por ART, lote personalizável e as listas PROVISORIA e LOTE

**Situação: feita em 06/10/2026** (branch `feat/avaliacao-documental-f2`; migration ainda por
aplicar). Pela decisão de 06/10/2026, a conta pesada é do **Python**, não de função SQL:

- `20261006110000_pre_classificacao_e_lote.sql` (uma migration só, no lugar das duas previstas):
  `TB_PRE_CLASSIFICACAO`, `TB_PRE_CLASSIF_VAGA` (resumo por vaga), `TH_PRE_CLASSIFICACAO`
  (histórico de cada entrada e saída do lote, com o motivo) e o log `TL_PRE_CLASSIFICACAO`; as RPCs
  do job (só `service_role`: `pre_classificacao_ler_editais`, `pre_classificacao_ler_candidatos` —
  sem o cadastro —, `iniciar/gravar_pre_classificacao_vaga/finalizar`), que **validam** o resultado
  (forma, regra vigente e conferida, quem tem ficha não muda, quem está no lote só sai eliminado);
  `obter_pre_classificacao` e `registrar_lista_pre_classificacao` para a tela;
  `pode_recalcular_pre_classificacao` para o "Recalcular"; `PROVISORIA` e `LOTE` em
  `CK_LISTACLASSIF_TPLISTA`; um gatilho em `TH_REGRA_ANALISE` que confere os campos novos da regra
  (`provisoria.desempate` e `lote.por_vaga`); a linha nova no Status das atualizações. No lugar de
  `FC_PRE_CLASSIFICAR_VAGA`, `FC_TAMANHO_LOTE` e `FC_NOTA_DECLARADA`, a conta está em
  `python/monitora/avaliacao_documental/` (oficial) e `src/lib/avaliacao-documental/pre-classificacao.js`
  (prévia), conferidas pelos mesmos casos dourados
  (`tests/fixtures/avaliacao-documental/casos-de-pre-classificacao.json` e a nota declarada de
  `casos-de-pontuacao.json`, no vitest e no pytest).
- Job `scripts/pre_classificacao/` e workflow `pre-classificacao.yml` (editais, modo
  `normal`/`seco`/`refazer_lote`, `disparado_por`); roda sozinho no fim do robô da Empregare (passo
  novo em `robo-empregare.yml`, `--apos-robo`), pelo "Recalcular" da coordenação e pelo "Rodar
  agora" (`api/rodar-carga.js` aceita o robô por edital).
- Aba **Pré-classificação** (`src/modulos/avaliacao-documental/pre-classificacao.jsx`): contadores,
  tabela por vaga com a linha de corte, divergência ART × declarada, eliminados à parte, tamanho do
  lote por vaga (versão nova da regra) e o registro/exportação das listas PROVISORIA e LOTE com o
  gerador da Classificação (`documento-sei.js` ganhou os modelos dos itens 8.3.1 e 8.4). As abas
  Provisória, Eliminados e Lote do desenho viraram uma aba só, por vaga.
- "A linha anda", nesta fase, só pelo recálculo (quem sai eliminado do lote é reposto pelo próximo,
  num lote novo, com o motivo). A comparação com a aba APTOS PARA ANÁLISE da planilha fica para a
  F8 (precisa da leitura da planilha pelo job).

**Entrega (planejada):**

- `TB_PRE_CLASSIFICACAO`, recalculada no fim de cada carga do robô: eliminados automáticos com
  motivo, ordem pela ART e aviso de divergência com a nota declarada;
- o **lote** com o tamanho **sugerido e editável** por edital e vaga (ex.: 3 × 11 vagas imediatas +
  CR), geral ou por modalidade, com ou sem os empatados;
- "a linha anda" (por enquanto só pelo recálculo);
- a opção "publicar cada reposição";
- as abas **Provisória (ART)**, **Eliminados** e **Lote**, com a faixa de contadores;
- na Classificação, os tipos `PROVISORIA` e `LOTE`, com os modelos do SEI (itens 8.3.1 e 8.4) e o
  título padrão da etapa.

**Aceite:** AM-4.1 a AM-4.4, AM-5.0 a AM-5.6 e AM-16.1 a AM-16.3. O piloto em **comparação** já
compara a Provisória e o lote do 93/2026 com a aba APTOS PARA ANÁLISE.

**Migrations:**

- `20261006110000_pre_classificacao_e_lote.sql`: `TB_PRE_CLASSIFICACAO`, `FC_PRE_CLASSIFICAR_VAGA`,
  `FC_TAMANHO_LOTE`, `FC_NOTA_DECLARADA`, `obter_provisoria` e o gancho no fim da carga do robô;
- `20261006120000_listas_provisoria_e_lote.sql`: `CK_LISTACLASSIF_TPLISTA` e `gerar_lista_classificacao`.

**Python:** o recálculo em lote de todas as vagas do edital (um comando para conferir e reprocessar)
e o relatório de comparação com a planilha.
**Riscos:** a ART ausente ou mal formatada ("x/30"), que é tratada com aviso; o quadro de vagas
incompleto, que impede a sugestão do lote (a tela pede o número).
**O usuário:** definir o tamanho do lote do 93/2026 e se as reposições são publicadas.

## F3 — Fila, distribuição personalizável e reserva

**Situação: feita em 06/10/2026** (branch `feat/avaliacao-documental-f3`; migrations ainda por
aplicar). O que entrou:

- `20261006120000_fichas_fila_e_reserva.sql`: `TB_FICHA_ANALISE` (situação PENDENTE, EM_ANALISE,
  REVISAR, CONCLUIDA ou FORA_LOTE; responsável; reserva de 15 minutos; versão otimista),
  `TH_FICHA_ANALISE` (histórico de criar, pegar, reservar, liberar, distribuir, redistribuir,
  devolver, revisar, sair e voltar ao lote), `TL_ACESSO_FICHA_ANALISE` (LGPD) e
  `TB_FILTRO_FILA_ANALISE` (filtros salvos por pessoa); as RPCs da tela `obter_fila_avaliacao`,
  `pegar_proxima_ficha` (`for update skip locked`), `reservar_ficha`, `renovar_reserva`,
  `liberar_reserva`, `distribuir_fichas`, `mandar_fichas_revisao`, `abrir_fichas_do_edital`,
  `salvar_filtro_fila` e `excluir_filtro_fila`, e as do job (`service_role`)
  `pre_classificacao_ler_distribuicao` e `abrir_fichas_pre_classificacao`; as travas de quem tem
  ficha não sair do lote por "refazer" e de analista com fichas abertas não sair da equipe (AM-3.3).
  As fichas são abertas pelo **job da pré-classificação** no fim de cada edital (o banco valida e
  grava em `FC_ABRIR_FICHAS`); a distribuição dos que entram depois é calculada em Python
  (`python/monitora/avaliacao_documental/distribuicao.py`), com a mesma conta da prévia da tela
  (`src/lib/avaliacao-documental/distribuicao.js`) e casos dourados comuns. No lugar de
  `atribuir_fichas`, `distribuir_fichas` faz distribuir, redistribuir e devolver à fila.
- `20261006120500_lote_por_nota_minima.sql`: a base `NOTA_MINIMA` do lote (93/2026, item 8.2.6),
  os desempates `EXPERIENCIA_DECLARADA` e `MAIOR_IDADE` (item 10.1) e o status dos editais em
  `listar_editais_avaliacao` (o seletor mostra só os vigentes); correções
  `supabase/correcoes/20261006-modelo-proj26-nota-minima.sql` (o PROJ26-CURRICULAR só do 93/2026,
  com o lote, o desempate e as cotas PI e PQ dos itens 5.7.5 e 5.7.6).
- Aba **Fila** (`src/modulos/avaliacao-documental/fila.jsx`), lógica pura em
  `src/lib/avaliacao-documental/fila.js`, tours da Aya e verbetes.
- Ficam para a F4: o conteúdo da ficha (blocos, títulos, vínculos, nota), AM-2.3 (fichas
  concluídas afetadas por versão nova da regra) e AM-12.1/12.3 a 12.6. Fica para a F5: validar ou
  devolver a ficha em revisão.
- A convocação para a Análise Comportamental do 93/2026 (item 8.2.10.11: até 5× as vagas imediatas
  e até a 10ª posição do cadastro reserva) é regra da lista CONVOCACAO da Classificação, não do
  lote da avaliação documental.

**Entrega (planejada):**

- a fila do lote na ordem da Provisória;
- "Pegar próximo" ou distribuição inicial (escolha do gestor ou do coordenador) e a redistribuição
  com motivo;
- a **reserva** da ficha (15 minutos, renovável, liberável pela coordenação);
- a busca por código;
- `TB_FICHA_ANALISE` criada para quem está no lote (ainda sem os blocos).

**Aceite:** AM-6.1 a AM-6.4 e AM-12.2.

**Migrations:** `20261006130000_fichas_fila_e_reserva.sql` (`TB_FICHA_ANALISE`,
`abrir_fichas_do_edital`, `obter_fila_avaliacao`, `pegar_proxima_ficha`, `distribuir_fichas`,
`atribuir_fichas`, `reservar/renovar/liberar_reserva`, `TL_ACESSO_FICHA_ANALISE`).

**Python:** nenhum.
**Riscos:** concorrência. A mitigação é `for update skip locked`, com um teste de duas sessões no
ensaio.
**O usuário:** escolher o modo de distribuição do 93/2026.

## F4 — Ficha por documento gravando em `TB_ANALISE_CURRICULAR`

**Situação: feita em 07/10/2026** (branch `feat/avaliacao-documental-f4`; migration ainda por
aplicar; ensaio no banco real OK, desfeito). Pedido do usuário: "algo tranquilo para o analista
analisar… para sair das planilhas". O que entrou:

- `20261007130000_conteudo_da_ficha.sql`: no lugar de `TB_ITEM_FICHA_ANALISE`,
  `TB_TITULO_FICHA_ANALISE` e `TB_VINCULO_EXPERIENCIA`, o lançamento do analista fica em
  `TB_FICHA_ANALISE."DS_LANCAMENTO"` (jsonb no formato do candidato de `pontuacao.js`: situação,
  motivos, nota ajustada e justificativas de cada bloco; títulos, cursos e vínculos; observações),
  com `DS_RESULTADO`, `DS_PARECER`, `TP_RESULTADO`, as notas, o rascunho e a conclusão; o
  histórico (`TH_FICHA_ANALISE`) ganhou SALVAR, CONCLUIR e REABRIR com o retrato e o que mudou (de
  quanto para quanto, com a justificativa), no lugar de `TL_EVENTO_FICHA_ANALISE`. RPCs
  `obter_ficha_analise` (só as respostas das perguntas que a regra liga; nunca CPF ou contato),
  `salvar_rascunho_ficha`, `concluir_ficha`, `reabrir_ficha` e `registrar_acesso_ficha`;
  `obter_fila_avaliacao` traz resultado e nota e mostra ao analista só as vagas dele;
  `salvar_regra_analise` devolve as fichas concluídas com versão anterior (AM-2.3).
- **A conta:** a tela calcula com `src/lib/avaliacao-documental/pontuacao.js`; o banco **não refaz a
  conta** (revalida estrutura, limites e coerência: blocos e motivos da regra, teto, soma, bloco
  eliminatório ⇒ inapto, nota mínima, pendências e justificativa); o Python
  (`python/monitora/avaliacao_documental/pontuacao.py`, `conferir_ficha`) recalcula em lote, pelos
  mesmos casos dourados (incluindo os novos da ficha).
- **A versão da regra:** pendente e em análise seguem a vigente; concluir exige a vigente e
  conferida e grava a versão usada; a concluída não muda.
- Tela `src/modulos/avaliacao-documental/ficha/` dentro da gaveta da Fila: cartões por bloco com o
  declarado, Conforme/Não conforme/Não enviado (1/2/3), motivo em lista, itens que pontuam na hora,
  nota ajustável com justificativa, lateral com declarado × apurado e o parecer, rascunho
  automático, "Concluir e próxima", "Fechar e liberar"; concluída só leitura com o histórico e
  "Reabrir" (coordenação).
- `supabase/correcoes/20261007-perguntas-da-ficha-proj26.sql`: o modelo PROJ26-CURRICULAR com as
  perguntas ligadas aos blocos e a nota declarada de titulação e cursos (a regra do 93/2026 muda só
  quando a coordenação salvar a versão nova).
- **Ficam para a F5 e depois:** validar/devolver a revisão e o sorteio (F5); publicar em
  `TB_ANALISE_CURRICULAR` (junto da virada, F8); "a linha anda" pela conclusão (hoje pelo
  recálculo); a busca da aldeia na lista do DSEI; comparar duas versões do histórico; o job Python
  que roda `conferir_ficha` em todas as concluídas; a coordenação editar sem pegar a reserva.

O desenho original:

**Entrega:** a ficha completa.

- os blocos por documento ou pergunta, com o declarado, a situação, os motivos e o efeito;
- o critério étnico com aldeia (não se aplica ao 93/2026, mas já testado);
- os **títulos**, os **vínculos** (união das sobreposições, meses, teto, mínimo, estágio) e os
  desempates;
- o parecer automático e as observações;
- os atalhos, o rascunho automático e "Concluir e próxima";
- o histórico (`TH_`) e os eventos (`TL_EVENTO_`);
- "a linha anda" ao concluir;
- a **publicação** em `TB_ANALISE_CURRICULAR` (origem `monitora-projetos`), ligada só para os
  editais em `MONITORA`. Em `COMPARACAO`, a ficha não publica.

**Aceite:** AM-7 a AM-12, AM-14 e AM-15.

**Migrations:**

- `20261006140000_ficha_blocos_titulos_vinculos.sql`: `TB_ITEM_FICHA_ANALISE`,
  `TB_TITULO_FICHA_ANALISE`, `TB_VINCULO_EXPERIENCIA`, `TH_FICHA_ANALISE`,
  `TL_EVENTO_FICHA_ANALISE`, `obter_ficha`, `salvar_ficha`, `concluir_ficha` e `FC_*` de pontuação e
  parecer;
- `20261006150000_publicacao_da_ficha.sql`: origens `monitora-*` em `TB_PLANILHA_ANALISE`,
  `FC_PUBLICAR_FICHA` e a invalidação do cache do painel.

**Python:** nenhum na tela. Um conferidor dos casos do simulador × banco entra nos testes.
**Riscos:** a diferença de conta com a planilha; a chave natural em conflito com a planilha. A
mitigação é o dono único por edital, e a publicação só depois da F8.
**O usuário:** analisar 5 a 10 fichas do 93/2026 em comparação e apontar o que falta na ficha.

## F5 — Revisão personalizável

**Entrega:** a configuração combinável da revisão:

- amostra com X%, todas, só inaptos, divergentes, sinais, os que entraram pela linha, duplo-cego
  opcional;
- o sorteio com semente;
- validar ou devolver com motivo (quem analisou não valida);
- a aba "Para revisar".

**Aceite:** AM-13.1 a AM-13.4.

**Migrations:** `20261006160000_revisao_da_ficha.sql` (`FC_SORTEAR_REVISAO`, `pedir_revisao_ficha`,
`validar_ficha`, `devolver_ficha`, `reabrir_ficha`).

**Python:** nenhum.
**Riscos:** a revisão virar gargalo. A amostra é configurável e pode ser zerada.
**O usuário:** configurar a revisão do 93/2026.

## F6 — Listas PRELIMINAR e FINAL com o parecer e o título padrão

**Entrega:**

- na Classificação, a PRELIMINAR (fases Preliminar e Final) com o título "…ETAPA DE AVALIAÇÃO
  DOCUMENTAL E DE TÍTULOS";
- a coluna "Classificação na Modalidade" (se ainda faltar);
- a coluna de justificativa dos **inaptos** com o **parecer da ficha**;
- a gaveta do recurso com "Ver ficha da avaliação".

**Aceite:** AM-17.1 a AM-17.4 e AM-20.1.

**Migrations:** `20261006170000_listas_com_parecer_da_ficha.sql` (o
`obter_classificacao_do_edital` devolve o parecer da ficha quando a origem é MONITORA).

**Python:** só se o DOCX de um edital grande não couber no navegador (gerar no servidor com a base
Python).
**Riscos:** quebrar as listas dos editais antigos. Os testes cobrem as duas origens.
**O usuário:** conferir o documento do SEI do 93/2026 antes de publicar.

## F7 — Robô captura os endereços da Empregare

**Entrega:** a cada execução, o robô (`scripts/robo-empregare/navegador_empregare.py`):

- abre as candidaturas de cada vaga na aba **Todos** (o valor de `m` é confirmado nesta fase:
  provavelmente `-1` ou sem `m`);
- percorre a lista inteira, que carrega aos poucos;
- liga o código da vaga ao token pela página da vaga ("Código <número>");
- por candidato, lê `data-pessoa-id` (= `CO_CANDIDATO_EMPREGARE`), `data-tokencandidato`,
  `data-candidatura-id` e o link `/empresa/curriculo/detalhes?…`;
- grava `TB_EMPREGARE_VAGA.DS_URL_CANDIDATURAS` e `TB_EMPREGARE_CANDIDATO.DS_URL_CURRICULO`,
  sobrescrevendo, porque os tokens podem mudar.

Na tela, entram:

- o cadastro manual do endereço da vaga pelo gestor ou pelo coordenador;
- na ficha, "Abrir na Empregare" abre direto o currículo; sem ele, abre a vaga e mostra "Copiar
  código".

**Aceite:** AM-7.2, AM-7.2b e AM-18b.1 a AM-18b.4. Nenhum token aparece no log do Actions.

**Migrations:** `20261006180000_enderecos_da_empregare.sql` (as colunas novas, as `CK_`,
`gravar_urls_empregare` e `salvar_url_candidaturas_vaga`).

**Python:** sim, é o robô (Selenium), com a base comum (`python/monitora/`: RPC e mascaramento) e
testes com HTML de exemplo **fictício**.
**Riscos:**

- a Empregare mudar o HTML, o que é detectado pelo teste de fumaça;
- a lista longa demorar, o que pede um limite de tempo por vaga;
- os tokens mudarem, o que se resolve recapturando a cada execução.

Os links são dado restrito: só a RPC da ficha os devolve. Esta fase pode ir **em paralelo** com as
F2 a F6. Sem ela, a ficha funciona com "Copiar código".
**O usuário:** confirmar no portal o valor de `m` da aba Todos e rodar o robô.

## F8 — Corte do 93/2026: o dono passa a ser o MONITORA

**Entrega:**

- a virada (`definir_origem_analise`) com a **adoção** das 86 linhas ativas do 93/2026: o mesmo
  `id`, e `CO_PLANILHA` = `monitora-projetos`;
- as **15 em Revisar** viram fichas "importadas da planilha", com o parecer, em Revisar;
- as **71 Pendentes** viram fichas Pendentes, pré-preenchidas pela Empregare;
- o relatório final de comparação e o aviso no Painel das análises.

**Aceite:** AM-18.1 a AM-18.4.

- Depois do corte, a carga seguinte da planilha de Projetos é aceita: o 93/2026 está inativo na
  `DIM_EDITAIS` e as linhas dele já não pertencem à planilha.
- O painel continua mostrando as 86.
- A Classificação gera a PRELIMINAR do 93/2026 a partir das fichas.

**Migrations:** `20261006190000_virada_da_avaliacao.sql` (`definir_origem_analise`, a adoção e o
`obter_comparacao_analise`).

**Python:** o conferidor antes e depois do corte (contagens por situação e vaga, ids preservados,
entrevistas e recursos ligados), rodado pelo GitHub Actions com mascaramento.
**Riscos:**

- a planilha ainda enviar o 93/2026, o que recusaria a carga inteira de Projetos. A virada exige
  o edital inativo na planilha e nenhuma carga em andamento;
- as 15 em Revisar terem a nota digitada errada. Elas entram em Revisar, para um revisor validar.

**O usuário:** marcar o 93/2026 como inativo na `DIM_EDITAIS` da planilha de Projetos, esperar uma
carga, autorizar a virada e decidir a P18 (as 15 em Revisar).

---

## Ordem e paralelismo

```
F0 ─► F1 ─► F2 ─► F3 ─► F4 ─► F5 ─► F8 (corte do 93/2026)
                        └────► F6 ─┘
F7 (robô) em paralelo, a partir da F1
```

Depois do piloto, vêm:

- o segundo piloto, da Saúde Indígena (critério étnico, aldeias, cotas);
- todo edital novo nascendo em `MONITORA`;
- os editais em andamento, um a um;
- o desligamento das planilhas, do simulador e do web app (fase 5 do README).
