---
tipo: modulo
area: modulo
atualizado: 2026-11-17
---

# Módulo: Editais (cadastro, regras e encerramento)

O ciclo do edital em três peças React: o cadastro com o cronograma (Equipe Núcleo), a página de
regras de cada etapa e a tela de encerramento quando o lote termina.

| Peça                 | Pasta                                 | Onde aparece                                   |
| -------------------- | ------------------------------------- | ---------------------------------------------- |
| Cadastro (Núcleo)    | `src/modulos/editais/`                | rota `/<área>/editais`                         |
| Regras do edital     | `src/modulos/regras-do-edital/`       | rota `/<área>/editais/<edital>/regras/<etapa>` |
| Encerramento e selos | `src/modulos/encerramento-do-edital/` | moldura (`src/app/sistema.ts`), menu da conta  |

## Cadastro do edital

Tabela, alertas, formulário e linha do tempo. A tela é `nucleo.tsx`; o estado fica fora do React em
`estado.ts` (trocar de usuário na mesma aba apaga o que era da sessão anterior).

- Cadastro do edital e do cronograma; importa cronograma e quadro de vagas do PDF de anexos.
- **Vagas ligadas ao quadro** (`vinculos-do-quadro.tsx`, `src/lib/editais/vinculos-do-quadro.ts`,
  migration `20261118120000`): no quadro salvo, a fila do vínculo de cada vaga com código com a
  linha do quadro (`TA_VAGA_QUADRO_EDITAL`): ambíguas (com as candidatas), ausentes (a linha
  escolhida que saiu do quadro primeiro) e confirmadas. Núcleo ou Calendário (editor) confirma a
  linha, marca "Sem linha" ou devolve à regra (`gravar_vinculo_do_quadro`); "Atualizar" refaz os
  automáticos (`atualizar_vinculos_do_quadro`). O preenchimento automático é a regra do nome
  (`FC_QUADRO_DA_VAGA`) e, sem ela, o "CARGO N" do título da Empregare; roda ao salvar o quadro e
  todo dia (`agsus_vinculos_do_quadro`, 05:30 de Brasília). Reimportar o quadro passa o vínculo
  para a linha de mesmo cargo e lotação; o manual cuja linha saiu vira ausente com pendência. A
  Classificação, a pré-classificação e as conferências (`CLASSIFICACAO_VAGA_QUADRO_AMBIGUO`)
  consultam o vínculo antes das palavras. Edital sem vaga com código: "não se aplica"
  (cancelado), "externo" (Seleção sem código) ou "pendente de integração".
- **Acompanhamento operacional** no topo da fila: oito indicadores (total, ativos, inativos, em
  andamento, sem cronograma, incompletos, próximos 7 dias, excepcionais); cada um filtra a fila.
  Vêm de `resumo.ts` (`get_nucleo_cronograma_resumo`, uma linha por edital): UMA carga, cache curto,
  invalidada ao salvar um cronograma; a mesma carga serve o "copiar cronograma".
- **Cronograma: etapas, cálculo e situação** (conferência de 17/11/2026, migration
  `20261117190000`). `private."FC_ESTADO_DO_CRONOGRAMA"` separa três coisas: há etapa
  (`tem_cronograma`), o cálculo (`calculo`: `automatico` ou `manual`; no manual valem o status e a
  etapa digitados, e percentual, próxima etapa e datas saem das etapas do mesmo jeito) e a
  situação excepcional (`situacao`: suspenso, paralisado ou cancelado, pelo status final). "Sem
  cronograma" é só edital sem etapa; o alerta do resumo é `excepcional` também para o suspenso
  digitado no manual.
- **Datas do cadastro pelas etapas**: com o automático ligado, `data_inicio`/`data_fim` do edital
  são o início da primeira etapa e o fim da última, por qualquer caminho (tela, script de errata,
  SQL Editor): gatilho `TG_DATAS_DO_CADASTRO` em `TB_CRONOGRAMA_MONIT_INDIG`, adiado ao fim da
  transação (o salvar apaga e reinsere etapa por etapa). Importa porque `data_fim` dá a validade
  das listas (`FC_VENCIMENTO_DO_EDITAL`). O manual mantém as datas digitadas.
- **Sequência entre etapas dependentes** (`src/lib/cronograma/sequencia-do-cronograma.ts`): recurso depois do
  resultado preliminar e até o resultado final da mesma fase (documental/curricular, títulos,
  conhecimentos, entrevista; sem o final da fase, vale o do processo seletivo). A fase é a da
  primeira palavra-chave da atividade. Aviso no formulário e ao salvar (`comSequencia` sobre
  `analisarCronograma`) e na linha do tempo do edital; não impede salvar. A regra fica fora do
  pacote de entrada: o formulário já baixa no clique, e o salvar e a linha do tempo a importam
  sob demanda (o orçamento de 320 KB estourou com ela dentro de `analisarCronograma`). Em 17/11/2026 avisava 4 editais: 120/2026 (recurso das entrevistas
  até 25/02/2027, final em 21/01) e 70, 71 e 74/2025 (recurso até 30/11, final em 03/11).
- Retificação do cronograma a partir do PDF da errata (`lancar-retificacao.tsx`).
- A atividade vai ao banco sem espaços repetidos (`cronogramaParaSalvar`): o texto colado do PDF
  da Cebraspe vinha com espaços duplos e escondia a etapa de resultado final (16/11/2026;
  migration `20261116150000` limpou 04/2026, 96/2025 e 97/2025).
- **Responsáveis** (`responsaveis-do-edital.tsx`, migration `20261104120000`): pessoas do sistema
  em `RL_RESPONSAVEL_EDITAL`; grava sozinho, à parte do "Salvar" do edital (que exige motivo para
  mexer no cronograma). A coluna antiga "responsavel" (USI/CORES) segue intocada. Quem edita vem do
  banco (`pode_editar`: gestor da área ou administrador global); banco sem as RPCs: o bloco some.
- **Edital crítico** (`critico-do-edital.tsx`, #721, migration `20261110150000`): gestor,
  coordenador ou administrador global marca, altera o motivo ou desmarca, sempre com motivo
  (10 a 500 caracteres) e histórico em `TH_EDITAL_CRITICO`. Grava à parte do "Salvar"; a permissão
  vem do banco (`obter_critico_do_edital` → `pode_marcar`). Conta nos críticos da
  [[modulo-visao-geral]].
- **Validade do processo seletivo** (#57, `src/lib/editais/validade-do-edital.ts`): anos (0 a 10), meses
  (0 a 11) e prorrogado, com o prazo calculado ao lado. O cálculo espelha
  `private."FC_VENCIMENTO_DO_EDITAL"` (data de encerramento + prazo em meses, em dobro se
  prorrogado; dia que não existe no mês de chegada vira o último dia dele; 0 = não vence) e
  "vencido" é o último dia antes de hoje em Brasília, como `FC_INATIVAR_LISTAS_VENCIDAS` (que
  inativa a lista vigente ao salvar e todo dia às 00:05). Ida: `nu_anos_validade`,
  `nu_meses_validade` e `st_prorrogado` no `p_payload` de `salvar_monitoramento_com_cronograma_v2`
  (cada chave só quando tem valor). Volta: `get_monitoramento_cronograma` → `monitoramento`, desde
  a migration `20261111200000`; sem ela, a validade fica "não lida": aviso, campos vazios e só vai o
  que a pessoa preencher (nada gravado é sobrescrito). Valor fora do limite mostra a mensagem no
  campo e o Salvar não envia.
- **Ordem da tabela** (`src/lib/editais/ordem-dos-editais.ts`): por padrão cronológica, do edital mais
  recente para o mais antigo (data de início e, sem ela, o NNN/AAAA). Clicar no cabeçalho ordena
  pela coluna: 1º clique crescente, 2º decrescente, alternando; números em ordem numérica, textos em
  alfabética, Risco pela gravidade; vazio sempre no fim.
- Abre o modal de listas da Lista de aprovados por `carregarTela("approved")`
  (`openImportModal(id, rótulo)`; ver [[modulo-aprovados]]).
- O botão de listas ganha aviso pelo status (`src/lib/editais/aprovados-por-edital.ts`): Cancelado ou
  Suspenso → vermelho, "Edital cancelado" / "Edital suspenso"; Concluído sem candidato aprovado
  (sem lista vigente ou com ela vazia, por `listar_listas_aprovados`, relida a cada abertura e no
  Atualizar) → amarelo, "Nenhum candidato foi aprovado neste edital". O aviso é a legenda do botão,
  e o clique o mostra num toast em vez de abrir as listas.

### Leitura do PDF (`api/anexos-do-edital.py`)

Função Python da Vercel (pdfplumber): lê o PDF de anexos e devolve cronograma (Anexo I) e quadro
de vagas (Anexo II) em JSON. Só usuário logado; não grava nada. Com `?tipo=retificacao`, lê a
retificação (nº, edital, SEI, assinatura, "Onde se lê" e "Leia-se", linhas em negrito e avisos das
datas). Ver [[deploy-e-vercel]].

## Regras do edital

Página aberta em Editais, no lugar da tabela: por edital, todas as regras do processo na ordem das
etapas — 1 Triagem, 2 Avaliação documental, 3 Entrevista, 4 Classificação e 5 Chamada para
contratação (lista em `ETAPAS_DAS_REGRAS`, `src/lib/regras-do-edital/regras-do-edital.ts`).

- Cada etapa usa o editor (e as RPCs) que já existia na tela da etapa, com a mesma loja; nada aqui
  calcula ou grava por conta própria. Salvar não recalcula nada (o 114/2026 segue congelado).
- A permissão é a de sempre, e o banco decide: coordenação do edital, gestor da classificação,
  quem configura a entrevista ou a convocação, ou o administrador global. Quem não pode vê a regra
  travada.
- A Entrevista edita o roteiro e a banca (`entrevistas/editor-da-configuracao.tsx`, loja de
  condução); a Chamada para contratação, a configuração de convocação
  (`aprovados/chamada-para-contratacao.tsx`, loja da Lista de aprovados). As etapas sem editor
  próprio, na pasta da Triagem, são montadas por `etapas.tsx`.
- `lojas.ts` cria as MESMAS lojas das telas (Avaliação documental, Entrevista, Classificação) uma
  vez por cliente do banco; cada loja escuta a troca de sessão, e o rascunho guardado também é o
  mesmo (tipos ANALISE e CLASSIFICACAO, `src/app/rascunho-da-regra.ts`).
- Carrega sob demanda: o pacote dos editores só baixa quando a página abre (`lazy()` em
  `editais/nucleo.tsx`). O "voltar" do navegador fecha a página (histórico, em `editais/estado.ts`).
- `abrir.ts` → `abrirRegrasDoEdital(edital, etapa)`: o "Editar nas Regras do edital" das telas das
  etapas; navega por `window.navigate("nucleo", {edital, regras})`, que confere a permissão de
  Editais e põe o endereço.
- `resumo-da-regra-da-etapa.tsx`: a regra só para ler no topo da tela da etapa (Avaliação
  documental, Classificação): versão, situação, uma linha por regra; sem regra, aviso curto e o
  mesmo botão. As linhas vêm de `src/lib/regras-do-edital/regras-do-edital-resumos.ts`, por `import()` na primeira
  vez (até lá, esqueleto).

## Encerramento do edital

Peça, não tela de rota: a tela de fim de edital (uma vez por pessoa e edital) e os selos no menu da
conta, avisados pelos marcos de `src/modulos/analises/marcos.ts`. Banco: migration
`20261021180000` (`obter_encerramentos_do_edital`, `marcar_encerramento_visto`).

- A tela abre quando o lote chega a 100% (regra e números do banco; o banco decide quando o edital
  está encerrado). Em cima, os totais do edital e o agradecimento à equipe; embaixo, só a parte de
  quem está vendo. Sem ranking, sem números de outras pessoas.
- Os fogos são os do catálogo ([[modulo-comemoracao]]): respeitam a configuração, a preferência
  pessoal e `prefers-reduced-motion`. A tela só abre com as comemorações ligadas no sistema;
  desligadas, nada é marcado e a tela aparece quando religarem.
- Selos no perfil (`selos-do-edital.tsx`): um por edital encerrado em que a pessoa concluiu ao menos
  uma ficha ("114/2026"); quem fechou o edital leva "fechou o 114". Sem edital encerrado, nada
  aparece; a marca no avatar só diz que há selo.
- `estado.ts` (sem React, lido por `useSyncExternalStore`): `verificar()` lê
  `obter_encerramentos_do_edital` ao abrir o sistema e quando os marcos de Análises avisam que um
  edital zerou (função ausente ou erro: nada a mostrar, sem aviso); `fechar()` grava o visto e abre
  o próximo. Leitura já a caminho não reabre o que a pessoa fechou.

## Código e testes

- Cadastro: `modal-do-edital.tsx` (formulário e payload), `editor-de-cronograma.tsx`,
  `importar-anexos.tsx`, `modal-linha-do-tempo.tsx`, `painel-operacional.tsx`, `editais.css`.
- Regras puras em `src/lib/`: `editais/editais-do-nucleo.ts` (a página sem DOM: ordem da fila, tons de
  status e risco também usados pelo mapa, unidades do formulário USI × CORES, rascunho, payload e
  filtro dos indicadores), `cronograma/cronograma-do-edital.ts` (estado pelas datas, validação, modelo padrão,
  datas coladas em lote), `cronograma/retificacao-do-cronograma.ts` (casa o "Leia-se" com as etapas gravadas:
  igual, data muda, nova, sumiu; número da errata e motivo com o SEI), `editais/validade-do-edital.ts`,
  `regras-do-edital/regras-do-edital.ts`, `encerramento-do-edital/encerramento-do-edital.ts` (leitura, tela a mostrar, selos e fogos).
- Testes: `tests/componentes/nucleo.test.ts` e `tests/editais-do-nucleo.test.js` citam as
  [histórias de usuário de Editais](../historias-de-usuario/editais.md) (ED-1, ED-2).
- Explicações para quem usa: [regras-dos-editais](../aya/regras-dos-editais.md) (a explicação mora
  lá, não na interface).

## Relacionadas

- [[modulo-cronograma]] — leitura dos cronogramas; salvar aqui invalida o cache de lá
- [[modulo-triagem]], [[modulo-avaliacao-documental]], [[modulo-entrevistas]],
  [[modulo-classificacao]] — as etapas cujos editores aparecem nas Regras do edital
- [[modulo-aprovados]] — modal de listas e Chamada para contratação
- [[modulo-analises]] — os marcos que avisam o encerramento
- [[modulo-configuracoes]] — liga e desliga as comemorações
- [[modulo-acessos]] — quem edita cada etapa
- [[deploy-e-vercel]] — `anexos-do-edital.py` e a API `/api/editais`
- [[arquitetura-do-front]] — o edital pertence a uma área; como a tela entra como rota
- [[aya-base-de-conhecimento]] — onde ficam as explicações da Aya
