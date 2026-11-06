/* Tours da Aya: os tours de cada tela e aba (API pública em ../aya-tours.ts). */

import {
  canAnalisarRecursos,
  canChangeCandidateStatus,
  canEditClassificacao,
  canEditRecursos,
  canManageEditais,
  isAdminGlobal,
} from "../access-roles.ts";
import {
  ABA,
  PASSO_DA_AYA,
  PUBLICAR,
  administraRecursos,
  analisaDocumentos,
  coordenaAvaliacao,
  editaEntrevistas,
  passo,
  t,
} from "./pedacos.ts";
import type { TourDaTela } from "./tipos.ts";

/* ---------- Tours de cada tela e aba ---------- */

export const TOURS: Readonly<Record<string, TourDaTela>> = Object.freeze({
  dashboard: Object.freeze({
    titulo: "Visão geral",
    passos: Object.freeze([
      passo(
        t("visao-geral-boas-vindas"),
        "Resumo da semana",
        "A saudação resume o que acontece nesta semana nos editais da área.",
      ),
      passo(
        t("visao-geral-ver-cronograma"),
        "Ver o cronograma",
        "Leva às etapas da semana no Cronograma.",
      ),
      passo(
        [t("visao-geral-filtros"), "#page-dashboard .visao-geral-filtros"],
        "Filtros",
        "Unidade, Edital e Status ficam à vista; Etapa, Risco e UF, em Mais opções. Cada filtro recorta a página inteira.",
      ),
      passo(
        [t("visao-geral-kpis"), "#page-dashboard .visao-geral-kpis"],
        "Indicadores",
        "Processos, Vagas, Contratações, Vagas ociosas, Críticos e Inscritos, contados nos editais do recorte.",
      ),
      passo(
        t("visao-geral-mapa-saude-indigena"),
        "Mapa dos DSEIs",
        "Escolher um DSEI no mapa recorta a página por ele; voltar ao Brasil tira esse filtro.",
        { areas: ["saude-indigena"] },
      ),
      passo(
        t("visao-geral-mapa-projetos"),
        "Mapa dos projetos",
        "O mapa mostra os municípios das vagas da área, tirados dos PDFs dos editais.",
        { areas: ["projetos"] },
      ),
      passo(
        t("visao-geral-mapa-tela-cheia"),
        "Mapa em tela cheia",
        "Abre o mapa na tela inteira; Esc volta.",
        { areas: ["saude-indigena", "projetos"] },
      ),
      passo(
        t("visao-geral-processos-por-projeto"),
        "Processos por projeto",
        "Quantos processos cada projeto tem no recorte.",
        { areas: ["projetos"] },
      ),
      passo(
        t("visao-geral-fases-e-pos-resultado"),
        "Fases e pós-resultado",
        "Em que fase estão os editais e o que vem depois do resultado: convocados, contratados e desistentes.",
      ),
      passo(
        [t("visao-geral-tabela"), "[aria-labelledby='visaoGeralTabelaTitulo']"],
        "Tabela de processos",
        "Cada linha é um edital, com o prazo e a próxima etapa coloridos pela urgência.",
      ),
      PASSO_DA_AYA,
    ]),
  }),
  nucleo: Object.freeze({
    titulo: "Editais",
    passos: Object.freeze([
      passo(
        [t("editais-kpis"), "#nucleoOperationalKpis"],
        "Cronogramas e alertas",
        "Os cartões (ativos, inativos, sem cronograma, próximos 7 dias…) filtram a tabela ao clicar.",
      ),
      passo(
        t("editais-filtro-ativo"),
        "Filtro aplicado",
        "Mostra o cartão que está filtrando a tabela; clique de novo para tirar.",
      ),
      passo("#nucleoSearch", "Busca", "Procure um edital da área atual."),
      passo(
        t("editais-novo"),
        "Novo edital",
        "Cadastra um edital da área atual, com cronograma, anexos em PDF e quadro de vagas.",
        { exige: canManageEditais },
      ),
      passo(
        [t("editais-tabela"), "#nucleoRows"],
        "Tabela de editais",
        "Com o cálculo automático ligado, o status e a etapa saem das datas do cronograma.",
      ),
      passo(
        t("editais-alerta-da-linha"),
        "Alerta do edital",
        "O que falta no edital, como cronograma ou quadro de vagas.",
      ),
      passo(
        t("editais-editar"),
        "Editar",
        "Abre o formulário: dados, cronograma, anexos em PDF e quadro de vagas.",
        { exige: canManageEditais },
      ),
      passo(
        t("editais-regras-do-edital"),
        "Regras do edital",
        "Todas as regras do edital numa página, por etapa: Triagem, Avaliação documental, Entrevista, Classificação e Chamada para contratação.",
      ),
      passo(
        t("editais-linha-do-tempo"),
        "Linha do tempo",
        "As etapas do edital de ponta a ponta e o histórico das mudanças.",
      ),
      PASSO_DA_AYA,
    ]),
  }),
  calendario: Object.freeze({
    titulo: "Cronograma",
    passos: Object.freeze([
      passo(
        t("cronograma-barra-do-mes"),
        "Mês",
        "Navegue entre os meses ou volte para hoje. As datas vêm dos cronogramas de Editais.",
      ),
      passo(
        t("cronograma-legenda"),
        "Tipos de etapa",
        "A cor de cada tipo. Clique num tipo para esconder ou mostrar as etapas dele.",
      ),
      passo(
        [t("cronograma-filtros"), "#page-calendario .cal-filtros"],
        "Filtros",
        "Recorte por unidade ou edital, pesquise e esconda as concluídas.",
      ),
      passo(
        [t("cronograma-grade"), "#calGrade"],
        "Calendário",
        "Cada etapa aparece no dia em que começa e no dia em que termina, com a unidade e o nome. Clique num dia para ver todas as etapas dele.",
      ),
      passo(
        [t("cronograma-proximas"), "#calProximas"],
        "Próximas etapas",
        "As etapas que vêm por aí, em ordem de data.",
      ),
      passo(
        [t("cronograma-linha-do-tempo"), "#calTimeline"],
        "Linha do tempo",
        "Escolha um edital para ver o cronograma dele de ponta a ponta.",
      ),
      PASSO_DA_AYA,
    ]),
  }),
  analises: Object.freeze({
    titulo: "Painel das análises",
    passos: Object.freeze([
      passo(
        t("analises-topo"),
        "Conferido e atualizar",
        "Quando a carga conferiu os dados e quando algo mudou; Atualizar relê e Exportar baixa o CSV.",
      ),
      passo(
        [t("analises-filtros"), "[aria-labelledby='analisesFiltrosTitulo']"],
        "Filtros",
        "Situação do processo (Ativo, Inativo, Todos), filtros, período e busca recortam a tela.",
      ),
      passo(
        [t("analises-kpis"), "#page-analises .analises-kpis"],
        "Indicadores",
        "Aptos para análise, realizadas, pendentes, em revisão, aprovados e reprovados; cada um filtra a lista.",
      ),
      passo(
        t("analises-pendencias"),
        "Pendências prioritárias",
        "Da mais grave para a menos grave; cada uma tem um atalho que aplica o filtro.",
      ),
      passo(
        "#chartTendencia",
        "Análises por dia",
        "Clicar num dia filtra a tela por ele; clicar em outro estende o período.",
      ),
      passo(
        "#chartResponsavel",
        "Por responsável",
        "A carga de cada responsável por status; clicar numa barra filtra.",
      ),
      passo(
        [t("analises-lista"), "[aria-labelledby='analisesFilaTitulo']"],
        "Lista",
        "As análises vindas das planilhas.",
      ),
      passo(
        t("analises-detalhes"),
        "Detalhes",
        "Abre a análise: parecer, pontuações, experiências e links.",
      ),
      PASSO_DA_AYA,
    ]),
  }),
  recursos: Object.freeze({
    titulo: "Painel de recursos",
    passos: Object.freeze([
      passo(
        t("recursos-analisar"),
        "Analisar",
        "Abre Analisar recursos com os mesmos filtros: é lá que se registra, decide e responde.",
        { exige: canAnalisarRecursos },
      ),
      passo(
        [t("recursos-filtros"), "[aria-labelledby='recursosFiltrosTitulo']"],
        "Filtros",
        "Recorte por edital, origem, analista, situação ou pendência, ou busque pelo candidato.",
      ),
      passo(
        [t("recursos-kpis"), "#page-recursos .recursos-kpis"],
        "Indicadores",
        "Aguardando parecer, Prazo vencido, Deferidos e Indeferidos; cada um filtra a tela.",
      ),
      passo(
        t("recursos-pendencias"),
        "Pendências prioritárias",
        "O que pede atenção, como prazo não encontrado ou mudança de nota; o atalho aplica o filtro.",
      ),
      passo(
        [t("recursos-fila"), "[aria-labelledby='recursosFilaTitulo']"],
        "Fila de recursos",
        "Cada recurso com situação, prazo e analista.",
      ),
      passo(
        t("recursos-detalhes"),
        "Detalhes",
        "O recurso inteiro, só para ler: dados, parecer, ajuste, etapas, resposta, anexos e histórico.",
      ),
      PASSO_DA_AYA,
    ]),
  }),
  "analisar-recursos": Object.freeze({
    titulo: "Analisar recursos",
    passos: Object.freeze([
      passo(
        t("analisar-recursos-painel"),
        "Ver no painel",
        "Volta ao Painel de recursos com os mesmos filtros, para acompanhar os números.",
      ),
      passo(
        t("recursos-novo"),
        "Novo recurso",
        "Registra o recurso com os dados do candidato e os anexos.",
        { exige: canEditRecursos },
      ),
      passo(
        t("recursos-modelos"),
        "Modelos de resposta",
        "Os textos prontos das respostas, para o administrador de Recursos.",
        { exige: administraRecursos },
      ),
      passo(
        [
          t("analisar-recursos-filtros"),
          "[aria-labelledby='analiseRecursosFiltrosTitulo']",
        ],
        "Filtros",
        "Recorte por edital, origem, analista, situação ou pendência, ou busque pelo candidato.",
      ),
      passo(
        [
          t("analisar-recursos-fila"),
          "[aria-labelledby='analiseRecursosFilaTitulo']",
        ],
        "Fila de recursos",
        "Cada recurso com situação, etapas, prazo e analista.",
      ),
      passo(
        t("analisar-recursos-abrir"),
        "Abrir o recurso",
        "Etapas, parecer e decisão, ajuste da pontuação, resposta ao candidato e anexos.",
      ),
      PASSO_DA_AYA,
    ]),
  }),
  entrevistas: Object.freeze({
    titulo: "Painel de entrevistas",
    passos: Object.freeze([
      passo(
        t("entrevistas-filtros"),
        "Filtros",
        "Recorte por edital, vaga, parecer, comparecimento e andamento.",
      ),
      passo(
        [t("entrevistas-kpis"), "#page-entrevistas .entrevistas-kpis"],
        "Indicadores",
        "Vagas com entrevista, candidatos, compareceram, aptos, inaptos e média das notas.",
      ),
      passo(
        t("entrevistas-agenda-proxima"),
        "Próximos dias",
        "Com um edital escolhido, a agenda salva na Classificação; Conduzir leva à fila.",
      ),
      passo(
        t("entrevistas-pendencias"),
        "Pendências",
        "Sem comparecimento, sem nota, sem parecer e o que não bate; cada uma filtra o painel.",
      ),
      passo(
        t("entrevistas-empates"),
        "Empates",
        "Mesma nota na mesma vaga: o desempate é feito na Classificação.",
      ),
      passo(
        [
          t("entrevistas-tabela"),
          "[aria-labelledby='entrevistasTabelaTitulo']",
        ],
        "Tabela de resultados",
        "O resultado de cada candidato entrevistado da área atual.",
      ),
      PASSO_DA_AYA,
    ]),
  }),
  "conduzir-entrevistas": Object.freeze({
    titulo: "Conduzir entrevistas · Fila",
    passos: Object.freeze([
      passo(
        t("conduzir-visoes"),
        "Fila e Preparar",
        "A Fila é o trabalho do dia; Preparar guia em quatro passos: roteiro, banca, convocação e agenda.",
      ),
      passo(
        [t("entrevistas-conduzir-seletor-edital"), "#entrevistasEdital"],
        "Edital",
        "Editais na janela da entrevista ou liberados; o último aberto volta sozinho. Edital de treinamento, quando houver, tem o selo Treinamento ao lado.",
      ),
      passo(
        t("conduzir-contador"),
        "Hoje",
        "Quantas das entrevistas de hoje já estão concluídas ou com falta.",
      ),
      passo(
        t("conduzir-recortes"),
        "Hoje, Próximos, Todos",
        "Hoje e Próximos seguem a agenda salva na Classificação; Todos traz todos os convocados.",
        { antes: ABA.fila },
      ),
      passo(
        t("conduzir-busca"),
        "Buscar",
        "Ache o candidato pelo nome ou pelo código; Esc limpa.",
        { antes: ABA.fila },
      ),
      passo(
        t("conduzir-situacoes"),
        "Situações",
        "Aguardando, em andamento, concluída e faltou; clicar filtra a fila.",
        { antes: ABA.fila },
      ),
      passo(
        t("conduzir-fila"),
        "Abrir a ficha",
        "Os cartões ficam agrupados por vaga, em ordem de horário. Clique para lançar comparecimento e notas; Salvar e abrir o próximo segue a ordem da tela.",
        { antes: ABA.fila },
      ),
      // Com a ficha de notas aberta (sem ela, os passos abaixo são pulados).
      passo(
        t("entrevistas-ficha-comparecimento"),
        "Comparecimento",
        "Compareceu ou Faltou. Com Faltou, a matriz some e fica o efeito no parecer.",
      ),
      passo(
        t("entrevistas-ficha-abas"),
        "Um avaliador por aba",
        "Passe a limpo a folha de cada avaliador; completa, a ficha vai sozinha ao próximo.",
      ),
      passo(
        t("entrevistas-ficha-matriz"),
        "Matriz de notas",
        "Digite a nota e a célula avança; setas e Enter andam. O chip mostra a média da linha.",
      ),
      passo(
        t("entrevistas-ficha-modo"),
        "Por avaliador ou competência",
        "Por competência serve para lançar ao vivo; a escolha fica guardada.",
      ),
      passo(
        t("entrevistas-ficha-previa"),
        "Resultado na hora",
        "Total, mínimo, competências e o parecer com os motivos, pelas regras do banco.",
      ),
      passo(
        t("entrevistas-ficha-justificativa"),
        "Justificativa da banca",
        "Obrigatória para Inapto e Faltou; entra no parecer. A observação de cada avaliador, opcional, fica embaixo da matriz dele.",
      ),
      passo(
        t("entrevistas-ficha-parecer-pronto"),
        "Parecer pronto",
        "Com tudo lançado, o parecer sai em texto pronto; Copiar parecer leva para o SEI ou o e-mail.",
      ),
      PASSO_DA_AYA,
    ]),
  }),
  "conduzir-entrevistas:preparar": Object.freeze({
    titulo: "Conduzir entrevistas · Preparar",
    passos: Object.freeze([
      passo(
        t("entrevistas-conduzir-liberacao"),
        "Liberar fora da janela",
        "O administrador global libera um edital fora da janela.",
        { exige: isAdminGlobal },
      ),
      passo(
        t("entrevistas-conduzir-regras"),
        "Regras da entrevista",
        "Quem é chamado, como a nota é calculada, quem avalia e o desempate, em linguagem simples; o Editar de cada bloco leva aonde se muda.",
      ),
      passo(
        t("entrevistas-preparar-passos"),
        "Quatro passos",
        "Roteiro, banca, convocação e agenda. O check verde é passo pronto; o que falta aparece em cada um, e Preparar abre no primeiro pendente.",
      ),
      passo(
        t("entrevistas-roteiros"),
        "1. Roteiro",
        "O roteiro do edital (a versão com nome) e os roteiros da área: editar grava uma versão nova; Duplicar cria outro.",
        { antes: ABA.roteiro },
      ),
      passo(
        t("entrevistas-roteiros-novo"),
        "Novo roteiro",
        "Cria um roteiro do zero, em seções; a lista do que falta fica ao lado do Salvar.",
        { exige: editaEntrevistas, antes: ABA.roteiro },
      ),
      passo(
        t("entrevistas-conduzir-editar-configuracao"),
        "2. Banca",
        "Membros, origem, banca nº e as competências que cada um avalia. Salvar configuração grava roteiro e banca juntos.",
        { exige: editaEntrevistas, antes: ABA.banca },
      ),
      passo(
        t("entrevistas-conduzir-convocacao"),
        "3. Convocação",
        "Quem é chamado, em linguagem simples, e a lista de convocação da Classificação, na ordem de cada vaga.",
        { antes: ABA.convocar },
      ),
      passo(
        t("entrevistas-conduzir-convocar"),
        "Convocar",
        "Confirma a convocação dos candidatos marcados.",
        { exige: editaEntrevistas, antes: ABA.convocar },
      ),
      passo(
        t("entrevistas-preparar"),
        "4. Agenda",
        "Dia, horário e banca de cada convocado, montados na Classificação › Agenda; aqui só se confere.",
        { antes: ABA.agendaDoEdital },
      ),
      PASSO_DA_AYA,
    ]),
  }),
  classificacao: Object.freeze({
    titulo: "Classificação · Listas",
    passos: Object.freeze([
      passo(
        t("classificacao-seletor-edital"),
        "Edital",
        "A regra de classificação é de cada edital, decidida pelo gestor dele.",
      ),
      passo(
        t("classificacao-abas"),
        "Listas, Agenda e Regra",
        "Listas mostra a classificação; Agenda, os horários da entrevista; Regra, o que vale no edital.",
      ),
      passo(
        t("classificacao-listas"),
        "Quatro listas",
        "Preliminar, convocação para entrevista, entrevista e resultado final.",
        { antes: ABA.listas },
      ),
      passo(
        t("classificacao-kpis"),
        "Indicadores",
        "Os números da lista escolhida; Nas listas, Eliminados e Aguardando filtram as tabelas.",
      ),
      passo(
        t("classificacao-filtros"),
        "Encontrar a pessoa",
        "Busca por nome ou código (a tecla / leva até ela), vaga, lista e situação. O filtro volta ao recarregar.",
      ),
      passo(
        "#page-classificacao .classificacao-avisos",
        "Avisos",
        "O que falta para a lista ficar certa, como empate esperando sorteio.",
      ),
      passo(
        t("classificacao-empates"),
        "Empates",
        "Empate que os critérios não resolvem vai para o sorteio registrado.",
      ),
      passo(
        t("classificacao-gerar"),
        "Gerar a lista",
        "Registra a lista com a versão da regra.",
        { exige: canEditClassificacao },
      ),
      passo(
        t("classificacao-exportar-lista"),
        "Exportar",
        "A lista sai em PDF, DOCX ou XLSX.",
      ),
      passo(
        t("classificacao-copiar-sei"),
        "Copiar para o SEI",
        "Copia o documento pronto para colar no SEI.",
      ),
      passo(
        t("classificacao-abrir-agenda"),
        "Agenda da entrevista",
        "Na convocação para entrevista, leva à agenda com os horários.",
      ),
      passo(
        t("classificacao-publicar-aprovados"),
        "Publicar como aprovados",
        "O resultado final vira a lista de aprovados do edital.",
        { exige: canEditClassificacao },
      ),
      passo(
        "#page-classificacao .classificacao-vaga",
        "Por vaga",
        "50 por vez. Ver posição explica o lugar do candidato; o ⋯ copia o código e registra o empate.",
      ),
      PASSO_DA_AYA,
    ]),
  }),
  "classificacao:agenda": Object.freeze({
    titulo: "Classificação · Agenda",
    passos: Object.freeze([
      passo(
        t("classificacao-agenda-regra"),
        "Regra dos horários",
        "Dias, horários, duração e intervalo das entrevistas.",
      ),
      passo(
        t("classificacao-agenda-salvar-regra"),
        "Salvar a regra",
        "Grava a regra para gerar os horários.",
        { exige: canEditClassificacao },
      ),
      passo(
        t("classificacao-agenda-convocados"),
        "Convocados",
        "Quem está na lista de convocação para entrevista.",
      ),
      passo(
        t("classificacao-agenda-gerar"),
        "Gerar horários",
        "Distribui os convocados pelos horários da regra; depois dá para ajustar.",
        { exige: canEditClassificacao },
      ),
      passo(
        t("classificacao-agenda-tabela"),
        "Agenda",
        "Cada convocado com dia e horário; ajuste aqui antes de salvar.",
      ),
      passo(
        t("classificacao-agenda-salvar"),
        "Salvar a agenda",
        "Grava os horários; eles aparecem na Agenda do dia em Conduzir entrevistas.",
        { exige: canEditClassificacao },
      ),
      passo(
        t("classificacao-agenda-xlsx"),
        "Planilha",
        "Baixa a agenda em XLSX para levar ao documento.",
      ),
      passo(
        t("classificacao-agenda-historico"),
        "Histórico",
        "As versões salvas da agenda.",
      ),
      PASSO_DA_AYA,
    ]),
  }),
  "classificacao:regra": Object.freeze({
    titulo: "Classificação · Regra",
    passos: Object.freeze([
      passo(
        t("classificacao-regra"),
        "Regra do edital",
        "O resumo da regra da Classificação: composição da nota, notas mínimas, desempate e cotas.",
      ),
      passo(
        "[data-tour='classificacao-regra'] [data-acao='editar-nas-regras-do-edital']",
        "Editar nas Regras do edital",
        "A regra se muda em Editais › Regras do edital, na etapa Classificação, com versão e motivo.",
      ),
      PASSO_DA_AYA,
    ]),
  }),
  approved: Object.freeze({
    titulo: "Lista de aprovados · Aprovados",
    passos: Object.freeze([
      passo(
        t("aprovados-visoes"),
        "Aprovados e Convocação",
        "Aprovados mostra a lista vigente de cada edital; Convocação, a ordem de convocação por vaga.",
      ),
      passo(
        t("aprovados-kpis"),
        "Indicadores",
        "Os números da lista no recorte dos filtros.",
        { antes: ABA.aprovados },
      ),
      passo(
        t("aprovados-origem-das-listas"),
        "Origem da lista",
        "Se a lista veio de planilha importada ou publicada da Classificação.",
      ),
      passo(
        t("aprovados-filtros"),
        "Filtros",
        "Escolha o edital e os demais filtros.",
      ),
      passo(
        t("aprovados-sub-judice"),
        "Sub judice",
        "Inclui candidato por decisão judicial, com o documento.",
        { exige: canChangeCandidateStatus },
      ),
      passo(
        [t("aprovados-tabela"), "#approvedRows"],
        "Candidatos",
        "Cada candidato com classificação, nota, modalidade e status.",
      ),
      passo(
        "[data-approved-action='status']",
        "Status do candidato",
        "Convocado, Contratado, Contratado em outra lista, Desistente, Migração ou Documentação rejeitada; status definido só o admin altera, exceto o Convocado.",
        { exige: canChangeCandidateStatus },
      ),
      PASSO_DA_AYA,
    ]),
  }),
  "approved:convocacao": Object.freeze({
    titulo: "Lista de aprovados · Convocação",
    passos: Object.freeze([
      passo(
        t("aprovados-convocacao-kpis"),
        "Indicadores",
        "Os números da convocação no recorte.",
        { antes: ABA.convocacao },
      ),
      passo(
        t("aprovados-convocacao-filtros"),
        "Filtros",
        "Escolha o edital e a vaga.",
      ),
      passo(
        t("aprovados-convocacao-acoes"),
        "Ações",
        "Modelo de convocação, carta e exportação.",
      ),
      passo(
        t("aprovados-escolher-a-convocar"),
        "Escolher quem convocar",
        "Marca os próximos da ordem de convocação de cada vaga.",
        { exige: canChangeCandidateStatus },
      ),
      passo(
        t("aprovados-carta-de-convocacao"),
        "Carta de convocação",
        "Gera a carta dos marcados a partir de um modelo e marca como Convocado.",
        { exige: canChangeCandidateStatus },
      ),
      passo(
        t("aprovados-modelos-da-carta"),
        "Modelos da carta",
        "Os textos das cartas, com os campos que se preenchem sozinhos.",
      ),
      passo(
        t("aprovados-exportar-csv"),
        "Exportar",
        "Baixa a ordem de convocação em CSV.",
      ),
      passo(
        [t("aprovados-tabela-convocacao"), "#convocacaoRows"],
        "Ordem de convocação",
        "A ordem por vaga, alternando ampla concorrência e reservas pela regra.",
      ),
      PASSO_DA_AYA,
    ]),
  }),
  selecao: Object.freeze({
    titulo: "Seleção",
    passos: Object.freeze([
      passo(
        [t("selecao-filtros"), "[aria-labelledby='selecaoFiltrosTitulo']"],
        "Filtros",
        "Unidade, edital, cargo e vaga, com várias escolhas em cada um.",
      ),
      passo(
        [t("selecao-kpis"), "#page-selecao .selecao-kpis"],
        "Funil por vaga",
        "Inscritos, aptos, triados, convocados, aprovados e contratados, da planilha Auditoria.",
      ),
      passo(
        "#page-selecao [data-kpi='taxa']",
        "Taxa de contratação",
        "Contratados divididos por aprovados, em porcentagem.",
      ),
      passo(
        "#chartDsei",
        "Ranking de unidades",
        "Clicar numa barra filtra pela unidade; clicar de novo tira.",
      ),
      passo(
        t("selecao-observacoes"),
        "Alertas do recorte",
        "As observações da planilha Auditoria, com quantas vagas têm cada uma.",
      ),
      passo(
        [t("selecao-tabela"), "[aria-labelledby='selecaoTabelaTitulo']"],
        "Tabela de vagas",
        "O funil de cada vaga; a carga roda de hora em hora.",
      ),
      PASSO_DA_AYA,
    ]),
  }),
  "avaliacao-documental": Object.freeze({
    titulo: "Avaliação documental",
    passos: Object.freeze([
      passo(
        t("avd-seletor-edital"),
        "Edital",
        "Aparecem os editais vigentes da área; a regra, a equipe e a fila são de cada edital.",
      ),
      passo(
        t("avd-todos-editais"),
        "Todos os editais",
        "Marque para ver também os concluídos e os cancelados.",
      ),
      passo(
        t("avd-entrada"),
        "Editais da área",
        "Um cartão por edital vigente, com a versão da regra; clique para abrir. A tela reabre no último edital aberto.",
      ),
      passo(
        t("avd-visoes"),
        "Fila, Documentos e Configurações",
        "Só quem coordena o edital vê Documentos e Configurações. Quem analisa vê só a Fila.",
      ),
      PASSO_DA_AYA,
    ]),
  }),
  "avaliacao-documental:regra": Object.freeze({
    titulo: "Avaliação documental · Regra",
    passos: Object.freeze([
      passo(
        t("avd-regra-resumo"),
        "Regra do edital",
        "O resumo da regra: documentos exigidos, o que pontua, como a experiência conta e a nota mínima.",
        {
          antes: `${t("avd-visoes")} [data-valor='configuracoes']`,
          exige: coordenaAvaliacao,
        },
      ),
      passo(
        "[data-tour='avd-regra-resumo'] [data-acao='editar-nas-regras-do-edital']",
        "Editar nas Regras do edital",
        "A regra (assistente ou modo avançado) se muda em Editais › Regras do edital, na etapa Avaliação documental.",
        { exige: coordenaAvaliacao },
      ),
      PASSO_DA_AYA,
    ]),
  }),
  "avaliacao-documental:fila": Object.freeze({
    titulo: "Avaliação documental · Fila",
    passos: Object.freeze([
      passo(
        t("avd-fila-etapas"),
        "Situação do lote",
        "Clique num número para filtrar a etapa. Embaixo, a barra do lote, o ritmo e a meta de hoje e quem está fora do lote.",
        { antes: `${t("avd-visoes")} [data-valor='fila']` },
      ),
      passo(
        t("avd-fila-andamento"),
        "Por vaga",
        "A lista de cada vaga (ordenável). Clique numa vaga para filtrar.",
      ),
      passo(
        t("avd-fila-filtros"),
        "Busca e filtros",
        "Código ou nome (tecla /; Enter com o código abre a ficha), vaga e responsável. Em Filtros, a modalidade e os filtros salvos.",
      ),
      passo(
        t("avd-fila-pegar"),
        "Pegar próxima ficha",
        "Dá a próxima ficha na ordem da Provisória e a reserva para você por 15 minutos.",
        { exige: analisaDocumentos },
      ),
      passo(
        t("avd-fila-acoes-coordenacao"),
        "Ações da coordenação",
        "No ⋯: distribuir as livres, abrir fichas e o relatório de motivos. Marque fichas para atribuir, liberar ou mandar para revisão.",
        { exige: coordenaAvaliacao },
      ),
      passo(
        t("avd-fila-tabela"),
        "As fichas",
        "50 por vez, agrupadas por vaga; o cabeçalho ordena e Exportar CSV baixa a etapa. Analisar ou Abrir mostra a ficha; o ⋯ tem o resto.",
      ),
      passo(
        t("avd-ficha-topo"),
        "Cabeçalho da ficha",
        'O candidato, a vaga e só os chips essenciais; situação, responsável, reserva e regra ficam no "i".',
      ),
      passo(
        t("avd-ficha-etapas"),
        "Passo a passo",
        'Um passo por item, com a marca do estado e a barra de progresso; clique para ir a um item. "Ver todos" mostra a lista completa e o "?", os atalhos.',
      ),
      passo(
        t("avd-ficha-decisoes"),
        "O documento confere?",
        "Confere aceita o declarado, Não confere pede o motivo e Editar nota (nos itens que pontuam) é para registrar o que foi comprovado (teclas 1, 2 e 3).",
      ),
      passo(
        t("avd-ficha-itens"),
        "Títulos, cursos e vínculos",
        "No Confere e no Editar nota, a primeira linha já vem aberta: registre o que o documento comprova.",
      ),
      passo(
        t("avd-ficha-nota"),
        "Pontuação",
        "Um só resumo: a pontuação e o declarado. No Editar nota, ajuste de meio em meio ponto ou use o calculado.",
      ),
      passo(
        t("avd-ficha-justificativa"),
        "Justificativa",
        "Pontuação diferente da declarada pede uma justificativa da lista; ela entra no parecer.",
      ),
      passo(
        t("avd-ficha-lateral"),
        "Nota",
        'A nota ao vivo e a composição por bloco; no "⋯", copiar o código, abrir a Empregare e compartilhar.',
      ),
      passo(
        t("avd-ficha-conclusao"),
        "Conclusão",
        "O resumo dos itens (clique para voltar a um), a nota final, as observações e o parecer, que sai com tudo conferido.",
      ),
      passo(
        t("avd-ficha-barra"),
        "Salvar e concluir",
        'O rascunho salva sozinho; Anterior / Próximo e o botão do momento ("Próximo pendente", "Revisar e concluir" e, na Conclusão, "Concluir e próxima").',
      ),
      passo(
        t("avd-ficha-reabrir"),
        "Reabrir",
        "A coordenação reabre uma ficha concluída, com o motivo da lista.",
        { exige: coordenaAvaliacao },
      ),
      PASSO_DA_AYA,
    ]),
  }),
  "config:marca": Object.freeze({
    titulo: "Configurações › Marca",
    passos: Object.freeze([
      passo(
        "[data-view='config'][data-secao='marca']",
        "Seções",
        "Cada seção de Configurações fica no menu, embaixo de Configurações.",
      ),
      passo(
        t("config-marca"),
        "Marca",
        "Nomes e identidade que aparecem em todo o sistema.",
      ),
      PUBLICAR,
      PASSO_DA_AYA,
    ]),
  }),
  "config:inicio": Object.freeze({
    titulo: "Configurações › Página inicial",
    passos: Object.freeze([
      passo(
        t("config-inicio"),
        "Página inicial",
        "Título, aviso global e rótulos dos indicadores.",
      ),
      PUBLICAR,
      PASSO_DA_AYA,
    ]),
  }),
  "config:acesso": Object.freeze({
    titulo: "Configurações › Tela de acesso",
    passos: Object.freeze([
      passo(
        t("config-acesso"),
        "Tela de acesso",
        "Saudação, login com Google e domínios que podem entrar.",
      ),
      PUBLICAR,
      PASSO_DA_AYA,
    ]),
  }),
  "config:aparencia": Object.freeze({
    titulo: "Configurações › Aparência",
    passos: Object.freeze([
      passo(
        t("config-aparencia"),
        "Aparência",
        "Arte de fundo, logo e cores, com o contraste de cada uma.",
      ),
      PUBLICAR,
      PASSO_DA_AYA,
    ]),
  }),
  "config:recursos": Object.freeze({
    titulo: "Configurações › Painéis externos",
    passos: Object.freeze([
      passo(
        t("config-recursos"),
        "Painéis externos",
        "Os painéis do menu: título, endereço e situação.",
      ),
      passo(
        t("config-recursos-tabela"),
        "Lista de painéis",
        "Edite, ponha em manutenção ou tire do menu.",
      ),
      PUBLICAR,
      PASSO_DA_AYA,
    ]),
  }),
  "config:operacao": Object.freeze({
    titulo: "Configurações › Operação",
    passos: Object.freeze([
      passo(
        t("config-operacao"),
        "Operação",
        "Versão, atualização em tempo real e Pessoas online.",
      ),
      passo(
        t("config-operacao-historico"),
        "Histórico",
        "As publicações anteriores; restaurar grava uma publicação nova.",
      ),
      PASSO_DA_AYA,
    ]),
  }),
  "config:modulos": Object.freeze({
    titulo: "Configurações › Módulos e abas",
    passos: Object.freeze([
      passo(
        t("config-modulos"),
        "Módulos e abas",
        "Ativa, desativa ou põe em manutenção o sistema e as áreas.",
      ),
      passo(
        t("config-modulos-abas"),
        "Abas",
        "Cada aba pode ficar ativa, em manutenção ou com selo BETA.",
      ),
      passo(
        t("config-modulos-paineis"),
        "Painéis",
        "A situação de cada painel externo.",
      ),
      passo(
        t("config-modulos-comemoracoes"),
        "Comemorações",
        "Liga ou desliga os avisos de parabéns.",
      ),
      passo(
        [t("config-modulos-revisar"), t("config-modulos-salvar")],
        "Revisar e salvar",
        "Confere o que muda antes de gravar.",
      ),
      PASSO_DA_AYA,
    ]),
  }),
  "config:cargas": Object.freeze({
    titulo: "Status das atualizações",
    passos: Object.freeze([
      passo(
        t("cargas-resumo"),
        "Resumo",
        "Se alguma atualização de dados falhou ou atrasou.",
      ),
      passo(t("cargas-atualizar"), "Atualizar", "Relê a situação das cargas."),
      passo(
        t("cargas-lista"),
        "Cada carga",
        "Análises, Seleção, Entrevistas, robô da Empregare e tarefas do banco, com a última execução.",
      ),
      passo(
        "[data-carga='selecao'] .saude-rodar, [data-carga='entrevistas'] .saude-rodar",
        "Rodar agora",
        "Dispara a carga fora do horário; Seleção e Entrevistas rodam de hora em hora.",
      ),
      passo(
        [t("cargas-rodar-empregare"), t("cargas-empregare")],
        "Robô da Empregare",
        "Não tem agenda: só roda quando um administrador clica em Rodar agora.",
      ),
      passo(
        t("robos-abrir-opcoes"),
        "Rodar com opções",
        "Escolhe editais, códigos de vaga, modo e limite, com a prévia antes de rodar.",
      ),
      PASSO_DA_AYA,
    ]),
  }),
  "config:acessos": Object.freeze({
    titulo: "Configurações › Acessos",
    passos: Object.freeze([
      passo(
        [t("acessos-aba-usuarios"), "#acessosApp .acessos-abas"],
        "Usuários, Grupos e Coordenações",
        "Grupos e Coordenações aparecem só para o administrador global.",
      ),
      passo(
        t("acessos-situacao"),
        "Ativos e Pendentes",
        "Em Pendentes ficam os pedidos de acesso de quem entrou sem perfil ativo.",
      ),
      passo(
        t("acessos-adicionar"),
        "Adicionar pessoa",
        "Informe e-mail institucional, nome, grupo, coordenação e motivo. A tela mostra o convite pronto.",
      ),
      passo(t("acessos-filtros"), "Filtros", "Busque por nome, grupo ou área."),
      passo(
        [t("acessos-lista"), t("acessos-por-modulo")],
        "Pessoas",
        "Abra uma pessoa para ver o grupo, a coordenação e como ela vê o menu.",
      ),
      passo(
        t("acessos-salvar"),
        "Salvar com motivo",
        "Alteração pendente se salva aqui, com motivo. Ninguém altera o próprio acesso.",
      ),
      PASSO_DA_AYA,
    ]),
  }),
});
