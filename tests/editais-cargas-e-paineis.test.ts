// @vitest-environment node
import { bloco } from "./apoio/bloco.ts";
import { pedidoSobDemanda } from "../src/lib/carga/pedido-sob-demanda.ts";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import {
  describe,
  expect,
  it,
  beforeAll,
  vi,
  afterEach,
  beforeEach,
} from "vitest";
import {
  cicloPadronizado,
  numeroDoCiclo,
  opcoesDeCiclo,
} from "../src/lib/editais/ciclo-do-edital.ts";
import { editalParaSalvar } from "../src/lib/editais/editais-do-nucleo.ts";
import {
  ETAPA_PADRAO_DA_REATIVACAO,
  acaoDeReativarNaLinha,
  bloqueioDaReativacao,
  cronogramaDaReativacao,
  editalParaReativar,
  errosDaReativacao,
  etapasComReativacao,
  listaNaReativacao,
  listaVigenteDoEdital,
  motivoDaReativacao,
  semErros,
  textoDaReativacao,
} from "../src/lib/editais/reativar-edital.ts";
import {
  acompanhamentoDaResposta,
  COLUNAS_DA_TABELA,
  COLUNAS_INICIAIS,
  csvDaVisaoGeral,
  enriquecerLinhas,
  filtrosVazios,
  valorParaOrdenar,
  descricaoDoCronograma,
  prazoDoEdital,
  seloDoCronograma,
  temCronogramaCadastrado,
  urgenciaDoCronograma,
} from "../src/lib/visao-geral/visao-geral.ts";
import {
  descreverAgenda,
  lerAgenda,
  maiorIntervaloMin,
  proximaExecucao,
} from "../src/lib/automacao/agenda-do-cron.ts";
import { ROBOS_DE_CARGA } from "../src/lib/automacao/robos-de-carga.ts";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.ts";
import {
  MIGRATION,
  type Banco,
  bancoDeHoje,
  constraintsDe,
  entrar,
  erroDe,
  TAREFAS,
  estadoDoCron,
  rodarArquivo,
  uma,
  USUARIO_COMUM,
  USUARIO_MASTER,
} from "./apoio/banco-dos-robos.ts";
import { CATALOGO_DOS_ROBOS } from "./fixtures/catalogo-dos-robos.ts";
import {
  nomeDoWorkflow,
  normalizarCatalogo,
  tarefaDoCatalogo,
} from "../src/lib/automacao/catalogo-dos-robos.ts";
import {
  normalizarSaude,
  visaoSimples,
} from "../src/lib/automacao/saude-das-cargas.ts";
import { createNucleoSummaryStore } from "../src/modulos/editais/resumo.ts";
import {
  CHAVE_DO_DONO,
  VALIDADE_DO_CACHE_MS,
  criarCacheDePayload,
  registroVencido,
  type ArmazenamentoDoCache,
} from "../src/lib/carga/cache-de-payload";
import { rotuloDaCopia } from "../src/lib/carga/rotulo-da-copia.ts";
import { armazenamentoDePayload } from "../src/modules/cache-de-payload-indexeddb.ts";
import { apagarCopiasVencidas } from "../src/app/varredura-das-copias.ts";
import { indexedDBFalso } from "./indexeddb-falso.js";
import {
  analisarCronograma,
  atividadeLimpa,
  cronogramaParaSalvar,
  novaEtapa,
  type EtapaDoCronograma,
} from "../src/lib/cronograma/cronograma-do-edital.ts";
import {
  contarEtapasNoIntervalo,
  diasDaLista,
  editaisComCronograma,
  editaisDoFiltro,
  editalDaLinhaDoTempo,
  editalSuspenso,
  filtrarEtapas,
  montarEtapasDosEditais,
  montarGradeDoMes,
  proximasEtapas,
} from "../src/lib/cronograma/calendario-editais.ts";
import { criarEstadoDoCalendario } from "../src/modulos/cronograma/estado.ts";
import {
  ERRO_INESPERADO,
  SEM_PERMISSAO,
  SESSAO_VENCIDA,
  TEMPO_ESGOTADO_NO_BANCO,
  erroParaATela,
} from "../src/lib/base/erro-na-tela.ts";
import { SEM_SERVIDOR } from "../src/lib/carga/falha-de-rede.ts";
import {
  MENSAGEM_DE_VERSAO_NOVA,
  erroDeVersaoNova,
} from "../src/lib/carga/importar-com-recarga.ts";
import {
  type Banco as Banco__1,
  bancoDosPaineis,
  entrar as entrar__2,
  erroDe as erroDe__3,
  uma as uma__4,
  USUARIO_ADMIN,
  USUARIO_LEITOR,
  type Banco as Banco__5,
  bancoComRelatoriosProntos,
  uma as uma__6,
  type Banco as Banco__7,
  entrar as entrar__8,
  erroDe as erroDe__9,
  rollbackDosLimites,
  uma as uma__10,
  type Banco as Banco__11,
  uma as uma__12,
} from "./apoio/banco-dos-paineis.ts";
import { strFromU8, unzipSync, zipSync } from "fflate";
import {
  lerFontesDoPainel,
  lerFontesDoRelatorio,
} from "../src/lib/paineis/fontes-dos-paineis.ts";
import {
  definicaoDoRelatorio,
  linhasDoRelatorio,
  xlsxDoRelatorio,
  type ZiparRelatorio,
  RELATORIOS_DOS_PAINEIS,
  tabelaDoRelatorio,
  chaveDaPagina,
  larguraArrastada,
  linhasDaOrigem,
  lerPaginaDoRelatorio,
  nomeDoArquivoDoRelatorio,
  paginaDaTabela,
  planilhaDoRelatorio,
  textoDaCelula,
} from "../src/lib/paineis/relatorios-dos-paineis.ts";
import { canManagePaineisDeDados } from "../src/lib/acessos/access-roles.ts";
import { PGlite } from "@electric-sql/pglite";
import { moldeDeBanco } from "./apoio/molde-de-banco.ts";
import { lembrarBanco } from "./apoio/bancos-abertos.ts";
import {
  aprovadosPorEdital,
  avisoDaListaDoEdital,
} from "../src/lib/editais/aprovados-por-edital.ts";
import {
  ITENS_POR_VEZ,
  gruposAteOLimite,
  totalDosGrupos,
} from "../src/lib/carga/carga-continua.ts";
import {
  editaisDoEvento,
  encerramentoAMostrar,
  fogosDoEncerramento,
  formatarDia,
  formatarPercentual,
  lerEncerramentos,
  numeroCurto,
  selosDoPerfil,
  tituloDeQuemFechou,
} from "../src/lib/encerramento-do-edital/encerramento-do-edital.ts";
import { definido } from "./definido.ts";
import {
  numeroDoFunil,
  textoDaFonteDoFunil,
} from "../src/lib/editais/funil-do-edital.ts";
import {
  compararEntrevistas,
  entrevistaVigente,
} from "../src/lib/entrevistas/entrevista-vigente.ts";
import { numeroDoEdital } from "../src/lib/editais/numero-do-edital.ts";
import {
  ORDEM_PADRAO_DOS_EDITAIS,
  ordenarEditais,
  proximaOrdemDosEditais,
  type ChaveDaOrdemDosEditais,
  type LinhaParaOrdenar,
  type OrdemDosEditais,
} from "../src/lib/editais/ordem-dos-editais.ts";
import {
  apagarRascunho,
  chaveDoRascunho,
  estadoComparavel,
  guardarRascunho,
  horaDoRascunho,
  lerRascunho,
  usuarioDoPerfil,
} from "../src/lib/editais/rascunho-do-edital.ts";
import {
  VALIDADE_NAO_LIDA,
  VALIDADE_NOVA,
  errosDaValidade,
  prazoDaValidade,
  somarMesesComoNoBanco,
  validadeDoBanco,
  validadeParaSalvar,
  validadeValida,
  vencimentoDoEdital,
  type ValidadeDoFormulario,
} from "../src/lib/editais/validade-do-edital.ts";
import {
  AUTOMATICO,
  type Banco as Banco__DoCronograma,
  DIVERGENTE,
  MANUAL,
  MIGRATION as MIGRATION__2,
  SEM_ETAPAS,
  bancoDeHoje as bancoDeHoje__3,
  datasDoCadastro,
  estado,
  md5DoCorpo,
  valor,
} from "./apoio/banco-do-cronograma.ts";
import {
  avisosDeSequencia,
  comSequencia,
  marcarEtapas,
} from "../src/lib/cronograma/sequencia-do-cronograma.ts";
import {
  type Banco as Banco__DoVinculo,
  bancoDeHoje as bancoDeHoje__2,
  criarAnalise,
  criarEdital,
  criarVagaDaSelecao,
  EDITAL,
  EDITAL_CANCELADO,
  EDITAL_SEM_CODIGO,
  entrar as entrar__3,
  gravarQuadro,
  migration,
  vinculos,
} from "./apoio/banco-do-vinculo-do-quadro.ts";
import {
  filaDoQuadro,
  linhasParaEscolher,
  origemDoVinculo,
  pendentesDaFila,
  rotuloDaLinha,
  semLinhaConfirmado,
  separarFila,
  type VinculoDaVaga,
} from "../src/lib/editais/vinculos-do-quadro.ts";
import {
  contagemDasMarcas,
  editalDoEndereco,
  enderecoDoEdital,
  etapasNaLinhaDoTempo,
  numeroNoEndereco,
  retificacoesDoHistorico,
  situacaoDasVagas,
  situacaoDosCandidatos,
  situacaoExcepcional,
  somenteCadastroReserva,
  ehAbaDaPagina,
  andamentoDasEtapas,
  telasDoEdital,
  origemDoCronograma,
  historicoDoCronograma,
  quadroDaPagina,
} from "../src/lib/pagina-do-edital/pagina-do-edital.ts";
import {
  E as ENCERRADOS,
  USUARIO as USUARIO_DOS_ENCERRADOS,
  bancoMigrado as bancoDosEncerradosMigrado,
  concluir as concluirEncerrados,
  entrar as entrarNosEncerrados,
  erroDe as erroDosEncerrados,
  listar as listarEncerrados,
  migration as migrationDosEncerrados,
} from "./apoio/banco-dos-encerrados.ts";
import {
  dataDoFim,
  erroDoMotivoDoLote,
  escolhidosDaLista,
  lerListaDosEncerrados,
  lerResultadoDoLote,
  rotuloDaEntrada as rotuloDaEntradaDosEncerrados,
  rotuloDoEdital,
  semOsQueSairam,
  textoDoResultado,
} from "../src/lib/editais/encerrados-do-cronograma.ts";

bloco("admissao-e-ciclo-na-visao-geral", () => {
  /*
  A 1ª E A ÚLTIMA ADMISSÃO E O CICLO NA VISÃO GERAL (pedido de 13/11/2026)

  "Precisa ter mais uma coluna de data de admissão" e "os editais tiveram
  ciclos". As admissões vêm conciliadas com o RH (TB_ADMISSAO_CONCILIADA,
  migration 20261113210000), por edital: a 1ª e a última. O ciclo estava
  escrito de vários jeitos no banco e voltou ao formulário do edital. Dados
  fictícios.
*/

  const resposta = {
    etapas: [],
    listas: [],
    admissoes: [
      {
        monitoramento_id: "e1",
        primeira: "2025-05-12",
        ultima: "2026-06-11",
        quantidade: 111,
      },
      { monitoramento_id: "e3", primeira: null, ultima: null, quantidade: 0 },
    ],
  };

  const linhas = [
    { id: "e1", edital: "04/2025", ciclo: "1º CICLO", status: "Concluído" },
    { id: "e2", edital: "70/2025", ciclo: "", status: "Concluído" },
    { id: "e3", edital: "05/2026", ciclo: "4", status: "Concluído" },
  ];

  describe("ciclo do edital", () => {
    it("padroniza como 'Nº ciclo' e deixa o vazio vazio", () => {
      expect(
        ["1º CICLO", "4", "4º", " 5º ", "2º ciclo"].map(cicloPadronizado),
      ).toEqual(["1º ciclo", "4º ciclo", "4º ciclo", "5º ciclo", "2º ciclo"]);
      expect(cicloPadronizado("")).toBe("");
      expect(cicloPadronizado(null)).toBe("");
      expect(cicloPadronizado("Piloto")).toBe("Piloto");
      expect(numeroDoCiclo("3º ciclo")).toBe(3);
      expect(numeroDoCiclo("")).toBeNull();
    });

    it("o formulário oferece do 1º ao 9º ciclo e mantém um valor de fora", () => {
      expect(opcoesDeCiclo()).toHaveLength(9);
      expect(opcoesDeCiclo("12")).toContain("12º ciclo");
      expect(opcoesDeCiclo("Piloto").at(-1)).toBe("Piloto");
    });

    it("o edital sai para o banco com o ciclo padronizado", () => {
      const payload = editalParaSalvar(
        {
          id: "",
          processo: "",
          edital: "01/2026",
          responsavel: "",
          unidade: "",
          unidadeNova: "",
          idUnidade: "",
          siglaUnidade: "",
          tipoUnidade: "",
          uf: "",
          ciclo: "3",
          link: "",
          vagas: "0",
          dataInicio: "",
          dataFim: "",
          status: "",
          etapa: "",
          risco: "Baixo",
          observacoes: "",
          observacoesInternas: "",
        },
        null,
        { automatico: false, etapas: [] },
        { status: "", etapa: "" },
      );
      expect(payload.ciclo).toBe("3º ciclo");
    });

    it("o formulário do edital tem o campo Ciclo", () => {
      const tela = readFileSync(
        "src/modulos/editais/modal-do-edital.tsx",
        "utf8",
      );
      expect(tela).toContain('<Campo rotulo="Ciclo">');
      expect(tela).toContain("opcoesDeCiclo(formulario.ciclo)");
    });
  });

  describe("admissões e ciclo na Visão geral", () => {
    const acompanhamento = acompanhamentoDaResposta(resposta);
    const enriquecidas = enriquecerLinhas(linhas, {
      hoje: "2026-11-13",
      acompanhamento,
    });
    const comAdmissao = enriquecidas[0]!;
    const semAdmissao = enriquecidas[1]!;
    const semDatas = enriquecidas[2]!;

    it("a linha recebe a 1ª e a última admissão; sem admissão, nulas", () => {
      expect(comAdmissao).toMatchObject({
        primeira_admissao: "2025-05-12",
        ultima_admissao: "2026-06-11",
        admissoes: 111,
        ciclo: "1º ciclo",
      });
      expect(semAdmissao).toMatchObject({
        primeira_admissao: null,
        ultima_admissao: null,
        admissoes: 0,
        ciclo: "",
      });
      // Registro sem datas não vale como admissão.
      expect(semDatas).toMatchObject({
        primeira_admissao: null,
        ciclo: "4º ciclo",
      });
    });

    it("Ciclo, 1ª e Última admissão são colunas padrão; Ciclo é filtro", () => {
      const campos = COLUNAS_DA_TABELA.map((c) => c.campo);
      expect(campos.indexOf("ciclo")).toBe(campos.indexOf("edital") + 1);
      expect(campos.indexOf("primeira_admissao")).toBe(
        campos.indexOf("contratados") + 1,
      );
      expect(campos.indexOf("ultima_admissao")).toBe(
        campos.indexOf("primeira_admissao") + 1,
      );
      for (const campo of ["ciclo", "primeira_admissao", "ultima_admissao"])
        expect(COLUNAS_INICIAIS).toContain(campo);
      expect(Object.keys(filtrosVazios())).toContain("ciclo");
    });

    it("ordena o ciclo pelo número e as admissões pela data", () => {
      expect(valorParaOrdenar(comAdmissao, "ciclo")).toBe(1);
      expect(valorParaOrdenar(semAdmissao, "ciclo")).toBe(-1);
      expect(valorParaOrdenar(comAdmissao, "primeira_admissao")).toBe(
        Date.parse("2025-05-12"),
      );
      expect(valorParaOrdenar(semAdmissao, "ultima_admissao")).toBe(0);
    });

    it("o arquivo exportado leva as admissões", () => {
      const [cabecalho, linha] = csvDaVisaoGeral([comAdmissao]).split(/\r?\n/);
      expect(cabecalho).toContain(
        '"Primeira Admissão";"Última Admissão";"Admissões Conciliadas com o RH"',
      );
      expect(linha).toContain('"2025-05-12";"2026-06-11";"111"');
      expect(linha).toContain('"1º ciclo"');
    });
  });
});

bloco("agenda-do-cron", () => {
  /* "Agora" fixo: 22/10/2026 14:37 UTC (uma quinta-feira). */
  const AGORA = new Date("2026-10-22T14:37:00Z");

  describe("lerAgenda", () => {
    it("cinco campos válidos; o resto não tem regra", () => {
      expect(lerAgenda("*/5 * * * *")?.minutos).toHaveLength(12);
      expect(lerAgenda("0 9 * * 7")?.semana.has(0)).toBe(true);
      expect(lerAgenda("30 seconds")).toBeNull();
      expect(lerAgenda("61 * * * *")).toBeNull();
      expect(lerAgenda(null)).toBeNull();
    });
  });

  describe("maiorIntervaloMin (o ciclo inteiro da agenda)", () => {
    const intervalo = (agenda: string) => maiorIntervaloMin(agenda, AGORA);

    it("frequentes e de hora em hora", () => {
      expect(intervalo("*/5 * * * *")).toBe(5);
      expect(intervalo("1-59/2 * * * *")).toBe(2);
      expect(intervalo("25 * * * *")).toBe(60);
      expect(intervalo("20,50 * * * *")).toBe(30);
    });

    it("a noite sem carga e as faixas do dia contam", () => {
      // Seleção: 11h10, 16h10 e 21h10 UTC → a noite de 14 h.
      expect(intervalo("10 11,16,21 * * *")).toBe(14 * 60);
      // Entrevistas: 0–10, 15 e 21–23 UTC → de 10h05 a 15h05 e de 15h05 a 21h05.
      expect(intervalo("5 0-10,15,21-23 * * *")).toBe(6 * 60);
      expect(intervalo("*/5 8-18 * * *")).toBe(13 * 60 + 5);
    });

    it("diária, semanal (fim de semana) e mensal", () => {
      expect(intervalo("0 9 * * *")).toBe(24 * 60);
      expect(intervalo("0 9 * * 1-5")).toBe(3 * 24 * 60);
      expect(intervalo("0 6 1 * *")).toBe(31 * 24 * 60);
    });

    it("sem regra: nulo", () => {
      expect(intervalo("qualquer")).toBeNull();
    });
  });

  describe("descreverAgenda (horário de Brasília)", () => {
    it("passos regulares a toda hora", () => {
      expect(descreverAgenda("*/5 * * * *")).toBe("a cada 5 min");
      expect(descreverAgenda("20,50 * * * *")).toBe("a cada 30 min");
      expect(descreverAgenda("25 * * * *")).toBe("de hora em hora");
    });

    it("horários do dia", () => {
      expect(descreverAgenda("0 9 * * *")).toBe("todo dia às 6h");
      expect(descreverAgenda("10 11,16,21 * * *")).toBe(
        "às 8h10, 13h10 e 18h10",
      );
      // 2h UTC = 23h de Brasília do dia anterior.
      expect(descreverAgenda("30 2 * * *")).toBe("todo dia às 23h30");
    });

    it("muitas horas num minuto só: a faixa vira a meia-noite", () => {
      expect(descreverAgenda("5 0-10,15,21-23 * * *")).toBe(
        "de hora em hora das 18h05 às 7h05 e às 12h05",
      );
    });

    it("o que não cabe volta como está", () => {
      expect(descreverAgenda("0 6 1 * *")).toBe("0 6 1 * *");
      expect(descreverAgenda("0 9 * * 1-5")).toBe("0 9 * * 1-5");
      expect(descreverAgenda("7,9 * * * *")).toBe("7,9 * * * *");
      expect(descreverAgenda("qualquer")).toBe("qualquer");
    });
  });

  describe("proximaExecucao", () => {
    it("aceita a agenda já lida", () => {
      const lida = lerAgenda("0 9 * * *");
      expect(proximaExecucao(lida, AGORA)?.toISOString()).toBe(
        "2026-10-23T09:00:00.000Z",
      );
    });
  });
});

bloco("catalogo-dos-robos-migration", () => {
  /*
  O catálogo dos robôs (migration 20261109180000, já aplicada; o SQL em
  tests/fixtures/sql-do-banco/) e o resto do repositório: o que a tela pede,
  os .yml, a fixture dos testes da tela e o contrato cabem nele. O
  comportamento no banco está em tests/editais-cargas-e-paineis.test.ts (bloco catalogo-dos-robos-no-banco).
*/

  /* ── O catálogo, lido da migration ─────────────────────────────────────────── */
  interface LinhaDoWorkflow {
    workflow: string;
    chave: string | null;
    inputs: string[];
    disparavel: boolean;
    externo: boolean;
  }
  const CATALOGO: LinhaDoWorkflow[] = [
    ...MIGRATION.matchAll(
      /\('([a-z0-9-]+\.yml)', '[^']+', (null|'\w+'),\s*'\{([a-z_,]*)\}', '([SN])', '([SN])'\)/g,
    ),
  ].map(([, workflow = "", chave = "", inputs = "", disparavel, externo]) => ({
    workflow,
    chave: chave === "null" ? null : chave.slice(1, -1),
    inputs: inputs ? inputs.split(",") : [],
    disparavel: disparavel === "S",
    externo: externo === "S",
  }));
  const porWorkflow = new Map(CATALOGO.map((l) => [l.workflow, l]));
  interface LinhaDaTarefa {
    tarefa: string;
    prefixo: boolean;
    chave: string | null;
    workflow: string | null;
  }
  const TAREFAS: LinhaDaTarefa[] = [
    ...MIGRATION.matchAll(
      /\('(agsus_[a-z0-9_]+)', '([SN])', '[^']+', (null|'\w+'), (null|'[a-z0-9-]+\.yml')\)/g,
    ),
  ].map(([, tarefa = "", prefixo, chave = "", workflow = ""]) => ({
    tarefa,
    prefixo: prefixo === "S",
    chave: chave === "null" ? null : chave.slice(1, -1),
    workflow: workflow === "null" ? null : workflow.slice(1, -1),
  }));

  describe("tudo o que pede ou registra workflow cabe no catálogo", () => {
    it("as linhas foram lidas (11 workflows, 17 tarefas)", () => {
      expect(CATALOGO).toHaveLength(11);
      expect(TAREFAS).toHaveLength(17);
    });

    it("os robôs da tela (ROBOS_DE_CARGA) pedem workflows disparáveis", () => {
      for (const robo of ROBOS_DE_CARGA)
        expect(porWorkflow.get(robo.workflow)?.disparavel, robo.workflow).toBe(
          true,
        );
    });

    // Vale para as migrations que vierem: as aplicadas saíram do repositório.
    it("todo FC_DISPARAR_ROBO('x.yml' das migrations do repositório (tarefas do pg_cron e funções) está no catálogo", () => {
      const pasta = "supabase/migrations";
      const pedidos = new Set<string>();
      const arquivos = existsSync(pasta)
        ? readdirSync(pasta).filter((f) => f.endsWith(".sql"))
        : [];
      for (const arquivo of arquivos)
        for (const [, w = ""] of readFileSync(`${pasta}/${arquivo}`, "utf8")
          .replace(/\r\n/g, "\n")
          .matchAll(/"FC_DISPARAR_ROBO"\('{1,2}([a-z0-9-]+\.yml)'/g))
          pedidos.add(w);
      for (const w of pedidos) expect(porWorkflow.has(w), w).toBe(true);
    });

    it("todo workflow que o banco pede ou deixa registrar existe em .github/workflows", () => {
      for (const l of CATALOGO.filter((x) => x.disparavel || x.externo))
        expect(existsSync(`.github/workflows/${l.workflow}`), l.workflow).toBe(
          true,
        );
    });

    it("a fixture dos testes da tela (tests/fixtures/catalogo-dos-robos.ts) é o catálogo da migration", () => {
      expect(
        CATALOGO_DOS_ROBOS.workflows
          .map((w) => [w.workflow, w.chave, w.disparavel])
          .sort(),
      ).toEqual(
        CATALOGO.map((l) => [l.workflow, l.chave, l.disparavel]).sort(),
      );
      expect(
        CATALOGO_DOS_ROBOS.tarefas
          .map((t) => [t.tarefa, t.prefixo, t.chave, t.workflow])
          .sort(),
      ).toEqual(
        TAREFAS.map((t) => [t.tarefa, t.prefixo, t.chave, t.workflow]).sort(),
      );
      for (const w of CATALOGO_DOS_ROBOS.workflows)
        expect(MIGRATION).toContain(`('${w.workflow}', '${w.nome}',`);
      for (const t of CATALOGO_DOS_ROBOS.tarefas)
        expect(MIGRATION).toContain(
          `('${t.tarefa}', '${t.prefixo ? "S" : "N"}', '${t.rotulo}',`,
        );
    });

    it("o RPC do catálogo está no contrato, sem argumentos", () => {
      expect(CONTRATO_RPC.obter_catalogo_dos_robos?.argumentos).toEqual([]);
    });
  });
});

bloco("catalogo-dos-robos-no-banco", () => {
  /*
  Migration 20261109180000 (catálogo dos robôs e chave única, já aplicada) num
  Postgres de verdade (PGlite); o SQL dela está em tests/fixtures/sql-do-banco/.
  Duas metades:

  1. NADA QUEBRA. Dois bancos iguais ao de antes: um fica como está, o outro
     recebe a migration. As mesmas perguntas vão aos dois e as respostas têm de
     ser as mesmas: cada workflow × origem × entrada em FC_DISPARAR_ROBO (com o
     pedido que vai ao GitHub, letra por letra), com chave ligada e desligada,
     sem a chave do Vault e com o pg_net fora; registrar_disparo_externo;
     FC_CHAVE_DO_WORKFLOW e FC_CHAVE_DA_TAREFA de todo nome;
     alterar_chave_da_automacao numa sequência com todos os erros;
     obter_chaves_da_automacao; automacao_ligada; disparar_robo (Rodar agora).

  2. O QUE MUDA DE PROPÓSITO: o catálogo, a chave estrangeira, o alinhador da
     chave com o pg_cron, a tarefa nova e o RPC do catálogo.
*/

  const LONGO = 120_000;

  const WORKFLOWS = [
    "sincronizar-entrevistas.yml",
    "sincronizar-selecao.yml",
    "conferencias.yml",
    "expurgo-anexos-chat.yml",
    "robo-empregare.yml",
    "pre-classificacao.yml",
    "leitura-de-arquivos.yml",
    "classificacao.yml",
    "contratacao-dos-aprovados.yml",
    "pacotes-dos-paineis.yml",
    "casamento-da-lista.yml",
  ];
  const DISPARAVEIS = WORKFLOWS.filter(
    (w) => !["expurgo-anexos-chat.yml", "leitura-de-arquivos.yml"].includes(w),
  );
  const TODOS_OS_NOMES = [
    ...WORKFLOWS,
    "nao-existe.yml",
    "",
    "CONFERENCIAS.YML",
  ];
  const ENTRADAS: unknown[] = [
    {},
    { modo: "normal" },
    { editais: "93/2026" },
    { vagas: "179698" },
    { limite: "5" },
    { anexos: "true" },
    { candidatos: "1" },
    { seco: "true" },
    { forcar_congelado: "x" },
    { listas: "x" },
    { pedido: "x" },
    { disparado_por: "x" },
    { modo: 1 },
    { modo: null },
    [],
    "texto",
    { modo: "x".repeat(20001) },
    {
      modo: "normal",
      editais: "1/2026",
      vagas: "1",
      limite: "2",
      anexos: "false",
    },
  ];
  const ORIGENS = [
    ["MONITORA", USUARIO_MASTER, null],
    ["AGENDA", null, "AGENDA"],
    ["MANUAL", null, null],
  ] as const;
  const MOTIVO = "Teste de regressão da chave da automação no banco";

  interface Linha {
    [campo: string]: unknown;
  }

  /* Um pedido a FC_DISPARAR_ROBO: o que voltou, a linha gravada e o que foi ao pg_net. */
  async function disparo(
    db: Banco,
    workflow: string | null,
    entrada: unknown,
    usuario: string | null,
    origem: string | null,
  ) {
    const antes = await uma<{ n: number }>(
      db,
      `select count(*)::int as n from net."PEDIDO"`,
    );
    let resposta: string;
    let id: number | null = null;
    try {
      const r = await uma<{ id: number | null }>(
        db,
        `select private."FC_DISPARAR_ROBO"($1, $2::jsonb, $3::uuid, $4) as id`,
        [
          workflow,
          entrada === undefined ? null : JSON.stringify(entrada),
          usuario,
          origem,
        ],
      );
      id = r?.id ?? null;
      resposta = id === null ? "nulo" : "id";
    } catch (e) {
      const erro = e as { code?: string; message?: string };
      resposta = `erro ${erro.code}: ${erro.message}`;
    }
    const linha = id
      ? await uma<Linha>(
          db,
          `select "NO_WORKFLOW", "TP_ORIGEM", "CO_USUARIO", "TP_SITUACAO", "DS_MENSAGEM",
                "CO_PEDIDO_HTTP" is not null as tem_pedido, "DT_RESPOSTA" is not null as respondeu
           from public."TL_DISPARO_ROBO" where "CO_DISPARO" = $1`,
          [id],
        )
      : null;
    const pedidos = await db.query<Linha>(
      `select url, body, headers, timeout from net."PEDIDO" order by id offset $1`,
      [antes?.n ?? 0],
    );
    return { resposta, linha, pedidos: pedidos.rows };
  }

  /* Todos os pedidos, nas condições do banco de hoje e nas variações. */
  async function bateriaDeDisparos(db: Banco) {
    const saida: Record<string, unknown> = {};
    const rodar = async (rotulo: string, entradas: unknown[]) => {
      for (const workflow of [...TODOS_OS_NOMES, null])
        for (const [origem, usuario, pOrigem] of ORIGENS)
          for (const [i, entrada] of entradas.entries())
            saida[`${rotulo}|${workflow}|${origem}|${i}`] = await disparo(
              db,
              workflow,
              entrada,
              usuario,
              pOrigem,
            );
    };
    await rodar("hoje", ENTRADAS);
    // Todas as chaves invertidas: a agenda passa a pedir o que não pedia, e vice-versa.
    await db.exec(
      `update public."TB_CHAVE_AUTOMACAO" set "ST_LIGADA" = case "ST_LIGADA" when 'S' then 'N' else 'S' end`,
    );
    await rodar("chaves invertidas", ENTRADAS.slice(0, 3));
    await db.exec(
      `update public."TB_CHAVE_AUTOMACAO" set "ST_LIGADA" = case "ST_LIGADA" when 'S' then 'N' else 'S' end`,
    );
    // Sem a chave no Vault: SEM_TOKEN, nada vai ao GitHub.
    await db.exec(`update vault.secrets set name = 'outro_nome'`);
    await rodar("sem chave no vault", ENTRADAS.slice(0, 2));
    await db.exec(`update vault.secrets set name = 'github_disparo_robos'`);
    // pg_net fora: FALHOU com o código do erro.
    await db.exec(`select set_config('teste.net_falha', 'on', false)`);
    await rodar("pg_net fora", ENTRADAS.slice(0, 2));
    await db.exec(`select set_config('teste.net_falha', 'off', false)`);
    // Sessão do pg_cron: vira AGENDA mesmo sem p_origem.
    await db.exec(`set application_name = 'pg_cron'`);
    await rodar("sessão do pg_cron", ENTRADAS.slice(0, 2));
    await db.exec(`set application_name = ''`);
    // Origem que não existe.
    saida["origem inválida"] = await erroDe(
      db.query(
        `select private."FC_DISPARAR_ROBO"('conferencias.yml', '{}'::jsonb, null, 'GITHUB')`,
      ),
    );
    return saida;
  }

  async function bateriaDeChaves(db: Banco) {
    const saida: Record<string, unknown> = {};
    for (const w of [...TODOS_OS_NOMES, null])
      saida[`workflow ${w}`] = (
        await uma<{ c: string | null }>(
          db,
          `select private."FC_CHAVE_DO_WORKFLOW"($1) as c`,
          [w],
        )
      )?.c;
    for (const t of [
      ...TAREFAS.map(([nome]) => nome),
      "agsus_robo_inscricoes_120_2026",
      "agsus_robo_inscricoes_",
      "agsus_robo_inscricoes",
      "agsusXrobo_inscricoes_1",
      "agsus_robo_inscricoesX",
      "agsus_robo_inscricoes_%",
      "AGSUS_ROBO_CONFERENCIAS",
      "qualquer",
      "",
      null,
    ])
      saida[`tarefa ${t}`] = (
        await uma<{ c: string | null }>(
          db,
          `select private."FC_CHAVE_DA_TAREFA"($1) as c`,
          [t],
        )
      )?.c;
    for (const c of [
      "entrevistas",
      "paineis",
      "classificacao_calculo",
      "nao_existe",
      null,
    ])
      saida[`ligada ${c}`] = (
        await uma<{ l: boolean }>(
          db,
          `select public.automacao_ligada($1) as l`,
          [c],
        )
      )?.l;
    return saida;
  }

  async function bateriaDeRegistros(db: Banco) {
    const saida: Record<string, unknown> = {};
    let n = 0;
    const registrar = async (
      rotulo: string,
      workflow: unknown,
      ator: unknown,
      url: unknown,
    ) => {
      try {
        const r = await uma<{ id: number | null }>(
          db,
          `select public.registrar_disparo_externo($1, $2, $3, 'resumo') as id`,
          [workflow, ator, url],
        );
        saida[rotulo] = r?.id
          ? await uma(
              db,
              `select "NO_WORKFLOW", "TP_ORIGEM", "TP_SITUACAO", "NO_ATOR_GITHUB", "DS_URL_EXECUCAO", "DS_MENSAGEM"
               from public."TL_DISPARO_ROBO" where "CO_DISPARO" = $1`,
              [r.id],
            )
          : "nulo";
      } catch (e) {
        saida[rotulo] = `erro ${(e as { code?: string }).code}`;
      }
    };
    for (const w of [...TODOS_OS_NOMES, null]) {
      n += 1;
      await registrar(
        `registro ${w}`,
        w,
        "fulano",
        `https://github.com/AgSUS-COGIP/agsus-monitora/actions/runs/${1000 + n}`,
      );
    }
    await registrar(
      "repetido",
      "conferencias.yml",
      "outra-pessoa",
      "https://github.com/AgSUS-COGIP/agsus-monitora/actions/runs/1003",
    );
    await registrar(
      "url ruim",
      "conferencias.yml",
      "fulano",
      "https://exemplo.com/x",
    );
    await registrar(
      "ator ruim",
      "conferencias.yml",
      "não é login!",
      "https://github.com/AgSUS-COGIP/agsus-monitora/actions/runs/2000",
    );
    await registrar(
      "bot",
      "classificacao.yml",
      "github-actions[bot]",
      "https://github.com/AgSUS-COGIP/agsus-monitora/actions/runs/2001",
    );
    saida.total = (
      await uma<{ n: number }>(
        db,
        `select count(*)::int as n from public."TL_DISPARO_ROBO"`,
      )
    )?.n;
    return saida;
  }

  /*
  A única diferença de propósito que aparece nas respostas de hoje: a tarefa nova
  do alinhador (agsus_alinhar_chaves_da_automacao, sem chave) no pg_cron e, por
  isso, em "tarefas sem chave" de obter_chaves_da_automacao. Sai da comparação só
  ela; o teste "a única diferença é a tarefa do alinhador" confere que existe.
*/
  const ALINHADOR = "agsus_alinhar_chaves_da_automacao";
  function semAlinhador(valor: unknown): unknown {
    if (Array.isArray(valor))
      return valor
        .filter(
          (v) =>
            !(v && typeof v === "object" && (v as Linha).nome === ALINHADOR),
        )
        .map(semAlinhador);
    if (valor && typeof valor === "object")
      return Object.fromEntries(
        Object.entries(valor)
          .filter(([k]) => k !== ALINHADOR)
          .map(([k, v]) => [k, semAlinhador(v)]),
      );
    return valor;
  }

  /* Tira datas e horas (mudam a cada execução) de qualquer resposta. */
  function semHoras(valor: unknown): unknown {
    if (Array.isArray(valor)) return valor.map(semHoras);
    if (valor && typeof valor === "object")
      return Object.fromEntries(
        Object.entries(valor)
          .filter(
            ([k]) =>
              ![
                "gerado_em",
                "em",
                "inicio",
                "fim",
                "DT_EVENTO",
                "DT_ATUALIZACAO",
              ].includes(k),
          )
          .map(([k, v]) => [k, semHoras(v)]),
      );
    return valor;
  }

  async function retratoDasChaves(db: Banco) {
    return {
      chaves: (
        await db.query(
          `select "CO_CHAVE", "ST_LIGADA", "DS_MOTIVO", "CO_USUARIO_ATUALIZACAO"
           from public."TB_CHAVE_AUTOMACAO" order by 1`,
        )
      ).rows,
      historico: (
        await db.query(
          `select "CO_CHAVE", "ST_LIGADA", "DS_MOTIVO", "CO_USUARIO", "DS_TAREFAS"
           from public."TH_CHAVE_AUTOMACAO" order by "CO_EVENTO"`,
        )
      ).rows,
      cron: await estadoDoCron(db),
    };
  }

  async function bateriaDeAlterarChave(db: Banco) {
    const passos: Record<string, unknown> = {};
    const alterar = async (
      rotulo: string,
      chave: unknown,
      ligar: unknown,
      motivo: unknown,
    ) => {
      let resposta: unknown;
      try {
        resposta = semHoras(
          (
            await uma<{ r: unknown }>(
              db,
              `select public.alterar_chave_da_automacao($1, $2, $3) as r`,
              [chave, ligar, motivo],
            )
          )?.r,
        );
      } catch (e) {
        const erro = e as { code?: string; message?: string };
        resposta = `erro ${erro.code}: ${erro.message}`;
      }
      passos[rotulo] = { resposta, ...(await retratoDasChaves(db)) };
    };
    await entrar(db, null);
    await alterar("sem sessão", "paineis", false, MOTIVO);
    await entrar(db, USUARIO_COMUM, false);
    await alterar("sem permissão", "paineis", false, MOTIVO);
    await entrar(db, USUARIO_MASTER, true);
    await alterar("chave nula", null, false, MOTIVO);
    await alterar("ligar nulo", "paineis", null, MOTIVO);
    await alterar("motivo curto", "paineis", false, "curto");
    await alterar(
      "teclado batido",
      "paineis",
      false,
      "asdasdasd sdfsdfsdf qweqweqwe",
    );
    await alterar("chave desconhecida", "nao_existe", false, MOTIVO);
    await alterar("já desligada", "entrevistas", false, MOTIVO);
    await alterar("desliga os painéis", "paineis", false, MOTIVO);
    await alterar("religa os painéis", "paineis", true, `${MOTIVO} de novo`);
    await alterar(
      "liga as entrevistas",
      "entrevistas",
      true,
      `${MOTIVO}, entrevistas`,
    );
    await alterar(
      "desliga a manutenção",
      "manutencao",
      false,
      `${MOTIVO}, manutenção`,
    );
    await alterar(
      "desliga sem tarefa",
      "classificacao",
      false,
      `${MOTIVO}, classificação`,
    );
    await alterar("já ligada", "conferencias", true, MOTIVO);
    passos["obter_chaves_da_automacao"] = semHoras(
      (
        await uma<{ r: unknown }>(
          db,
          `select public.obter_chaves_da_automacao() as r`,
        )
      )?.r,
    );
    await entrar(db, USUARIO_COMUM, false);
    passos["obter sem permissão"] = await erroDe(
      db.query(`select public.obter_chaves_da_automacao()`),
    );
    return passos;
  }

  async function bateriaDoRodarAgora(db: Banco) {
    const saida: Record<string, unknown> = {};
    const rodar = async (rotulo: string, robo: unknown, entrada: unknown) => {
      try {
        const r = await uma<{ id: number }>(
          db,
          `select public.disparar_robo($1, $2::jsonb) as id`,
          [robo, JSON.stringify(entrada)],
        );
        saida[rotulo] = await uma(
          db,
          `select d."NO_WORKFLOW", d."TP_ORIGEM", d."CO_USUARIO", d."TP_SITUACAO",
                (select p.body from net."PEDIDO" p where p.id = d."CO_PEDIDO_HTTP") as corpo
           from public."TL_DISPARO_ROBO" d where d."CO_DISPARO" = $1`,
          [r?.id],
        );
      } catch (e) {
        const erro = e as { code?: string; message?: string };
        saida[rotulo] = `erro ${erro.code}: ${erro.message}`;
      }
    };
    await entrar(db, null);
    await rodar("sem sessão", "selecao", {});
    await entrar(db, USUARIO_COMUM, false);
    await rodar("sem permissão", "selecao", {});
    await entrar(db, USUARIO_MASTER, true);
    await rodar("seleção", "selecao", {});
    await rodar("seleção de novo em 2 min", "selecao", {});
    await rodar("entrevistas", "entrevistas", { modo: "normal" });
    await rodar("conferências seco", "conferencias", { modo: "seco" });
    await rodar("robô fumaça", "empregare", { modo: "fumaca", limite: 3 });
    await rodar("triagem seca", "pre_classificacao", {
      modo: "seco",
      editais: ["93/2026"],
    });
    await rodar("desempate", "classificacao_desempate", {});
    await rodar("robô desconhecido", "nao_existe", {});
    await rodar("modo inválido", "conferencias", { modo: "fumaca" });
    await rodar("opção que o robô não aceita", "selecao", { vagas: "1" });
    return saida;
  }

  async function todasAsBaterias(db: Banco) {
    return {
      chaves: await bateriaDeChaves(db),
      disparos: await bateriaDeDisparos(db),
      registros: await bateriaDeRegistros(db),
      rodarAgora: await bateriaDoRodarAgora(db),
      alterarChave: await bateriaDeAlterarChave(db),
    };
  }

  describe("nada quebra: hoje × depois da migration", () => {
    let hoje: Banco;
    let migrado: Banco;
    const fotos: Record<string, Record<string, unknown>> = {};

    beforeAll(async () => {
      hoje = await bancoDeHoje();
      migrado = await bancoDeHoje();
      await rodarArquivo(migrado, MIGRATION);
      for (const [nome, db] of [
        ["hoje", hoje],
        ["migrado", migrado],
      ] as const)
        fotos[nome] = await todasAsBaterias(db);
    }, 600_000);

    for (const parte of [
      "chaves",
      "disparos",
      "registros",
      "rodarAgora",
      "alterarChave",
    ]) {
      it(`${parte}: a migration responde igual a hoje`, () => {
        expect(semAlinhador(fotos.migrado?.[parte])).toEqual(
          fotos.hoje?.[parte],
        );
      });
    }

    it("a única diferença é a tarefa do alinhador, que aparece no pg_cron e em tarefas sem chave", () => {
      const passos = fotos.migrado?.alterarChave as Record<
        string,
        { cron?: Record<string, boolean> }
      >;
      expect(passos["sem sessão"]?.cron?.[ALINHADOR]).toBe(true);
      const obter = (
        fotos.migrado?.alterarChave as Record<string, { sem_chave?: Linha[] }>
      ).obter_chaves_da_automacao;
      expect(obter?.sem_chave?.map((t) => t.nome)).toContain(ALINHADOR);
      expect(JSON.stringify(fotos.hoje)).not.toContain(ALINHADOR);
    });

    it("a bateria cobre o que diz: cada workflow pedido ao GitHub com o corpo e os cabeçalhos", () => {
      const disparos = fotos.hoje?.disparos as Record<
        string,
        { resposta: string; pedidos: Linha[]; linha: Linha | null }
      >;
      const pedidos = Object.values(disparos).flatMap((d) => d.pedidos ?? []);
      const urls = new Set(pedidos.map((p) => p.url));
      for (const w of DISPARAVEIS)
        expect(urls).toContain(
          `https://api.github.com/repos/AgSUS-COGIP/agsus-monitora/actions/workflows/${w}/dispatches`,
        );
      expect(urls.size).toBe(DISPARAVEIS.length);
      expect(pedidos[0]?.headers).toMatchObject({
        Authorization: "Bearer token-de-teste",
      });
      // Cada situação aparece: o teste não passa por só olhar o caminho feliz.
      const situacoes = new Set(
        Object.values(disparos).map((d) => d.linha?.TP_SITUACAO ?? null),
      );
      for (const s of ["PEDIDO", "SEM_TOKEN", "FALHOU", null])
        expect(situacoes).toContain(s);
      const respostas = Object.values(disparos).map((d) => d.resposta);
      expect(respostas).toContain("nulo"); // agenda com chave desligada
      expect(respostas.some((r) => r.startsWith("erro 22023"))).toBe(true);
    });
  });

  describe("o que muda de propósito", () => {
    it(
      "catálogo dos workflows: as listas fixas de antes, linha por linha",
      async () => {
        const db = await bancoDeHoje();
        await rodarArquivo(db, MIGRATION);
        const r = await db.query(
          `select "NO_WORKFLOW", "CO_CHAVE", "DS_INPUT_ACEITO", "ST_DISPARAVEL", "ST_REGISTRO_EXTERNO"
         from public."TB_ROBO_WORKFLOW" order by 1`,
        );
        expect(r.rows).toEqual(
          [
            ["casamento-da-lista.yml", null, ["modo", "pedido"], "S", "N"],
            [
              "classificacao.yml",
              "classificacao",
              ["modo", "listas"],
              "S",
              "S",
            ],
            ["conferencias.yml", "conferencias", ["modo"], "S", "S"],
            [
              "contratacao-dos-aprovados.yml",
              "conferencias",
              ["modo"],
              "S",
              "N",
            ],
            ["expurgo-anexos-chat.yml", null, [], "N", "N"],
            ["leitura-de-arquivos.yml", null, [], "N", "S"],
            ["pacotes-dos-paineis.yml", "paineis", ["modo"], "S", "N"],
            [
              "pre-classificacao.yml",
              "pre_classificacao",
              ["modo", "editais", "forcar_congelado"],
              "S",
              "S",
            ],
            [
              "robo-empregare.yml",
              "robo_de_inscricoes",
              [
                "modo",
                "editais",
                "vagas",
                "limite",
                "anexos",
                "candidatos",
                "seco",
                "forcar_congelado",
              ],
              "S",
              "S",
            ],
            ["sincronizar-entrevistas.yml", "entrevistas", ["modo"], "S", "S"],
            ["sincronizar-selecao.yml", "selecao", ["modo"], "S", "S"],
          ].map(([w, c, i, d, e]) => ({
            NO_WORKFLOW: w,
            CO_CHAVE: c,
            DS_INPUT_ACEITO: i,
            ST_DISPARAVEL: d,
            ST_REGISTRO_EXTERNO: e,
          })),
        );
      },
      LONGO,
    );

    it(
      "o log dos pedidos: chave estrangeira no lugar do CHECK, com índice; recusa workflow fora e não deixa apagar do catálogo o que está em uso",
      async () => {
        const db = await bancoDeHoje();
        await rodarArquivo(db, MIGRATION);
        const constraints = await constraintsDe(db, "TL_DISPARO_ROBO");
        expect(
          constraints.some((c) => c.startsWith("CK_DISPROBO_NOWORKFLOW")),
        ).toBe(false);
        expect(constraints).toContain(
          'FK_DISPROBO_ROBOWKF FOREIGN KEY ("NO_WORKFLOW") REFERENCES "TB_ROBO_WORKFLOW"("NO_WORKFLOW") ON DELETE RESTRICT',
        );
        expect(
          await uma(
            db,
            `select 1 as ok from pg_indexes where indexname = 'IN_DISPROBO_NOWORKFLOW'`,
          ),
        ).toEqual({ ok: 1 });
        expect(
          (
            await erroDe(
              db.query(
                `insert into public."TL_DISPARO_ROBO" ("NO_WORKFLOW", "TP_ORIGEM", "TP_SITUACAO")
             values ('nao-existe.yml', 'MANUAL', 'FALHOU')`,
              ),
            )
          )?.codigo,
        ).toBe("23503");
        await db.query(
          `select private."FC_DISPARAR_ROBO"('conferencias.yml', '{}'::jsonb, null, null)`,
        );
        expect(
          (
            await erroDe(
              db.query(
                `delete from public."TB_ROBO_WORKFLOW" where "NO_WORKFLOW" = 'conferencias.yml'`,
              ),
            )
          )?.codigo,
        ).toBe("23001"); // restrict_violation: ON DELETE RESTRICT
      },
      LONGO,
    );

    it(
      "o catálogo recusa linha malformada (nome, disparado_por, S/N, input em workflow que o banco não pede, chave que não existe)",
      async () => {
        const db = await bancoDeHoje();
        await rodarArquivo(db, MIGRATION);
        const inserir = (
          w: string,
          chave: string | null,
          inputs: string,
          disparavel: string,
          externo: string,
        ) =>
          erroDe(
            db.query(
              `insert into public."TB_ROBO_WORKFLOW" ("NO_WORKFLOW", "NO_ROBO", "CO_CHAVE", "DS_INPUT_ACEITO", "ST_DISPARAVEL", "ST_REGISTRO_EXTERNO")
           values ($1, 'Teste', $2, $3::text[], $4, $5)`,
              [w, chave, inputs, disparavel, externo],
            ),
          );
        expect(
          (await inserir("Com Espaco.yml", null, "{modo}", "S", "N"))?.codigo,
        ).toBe("23514");
        expect(
          (await inserir("../fora.yml", null, "{modo}", "S", "N"))?.codigo,
        ).toBe("23514");
        expect(
          (await inserir("sem-extensao", null, "{modo}", "S", "N"))?.codigo,
        ).toBe("23514");
        expect(
          (await inserir("novo.yml", null, "{modo,disparado_por}", "S", "N"))
            ?.codigo,
        ).toBe("23514");
        expect(
          (await inserir("novo.yml", null, "{Modo}", "S", "N"))?.codigo,
        ).toBe("23514");
        expect(
          (await inserir("novo.yml", null, "{modo}", "X", "N"))?.codigo,
        ).toBe("23514");
        expect(
          (await inserir("novo.yml", null, "{modo}", "N", "N"))?.codigo,
        ).toBe("23514");
        expect(
          (await inserir("novo.yml", "nao_existe", "{modo}", "S", "N"))?.codigo,
        ).toBe("23503");
        expect(
          await inserir("novo.yml", "paineis", "{modo}", "S", "N"),
        ).toBeNull();
        const tarefa = (
          nome: string,
          prefixo: string,
          workflow: string | null,
        ) =>
          erroDe(
            db.query(
              `insert into public."TB_TAREFA_AGENDADA" ("NO_TAREFA", "ST_PREFIXO", "DS_ROTULO", "NO_WORKFLOW")
           values ($1, $2, 'Teste', $3)`,
              [nome, prefixo, workflow],
            ),
          );
        expect((await tarefa("outra_coisa", "N", null))?.codigo).toBe("23514");
        expect((await tarefa("agsus_x", "X", null))?.codigo).toBe("23514");
        expect((await tarefa("agsus_x", "N", "nao-existe.yml"))?.codigo).toBe(
          "23503",
        );
      },
      LONGO,
    );

    it(
      "workflow novo é um INSERT: o banco pede, aceita os inputs dele, respeita a chave e registra",
      async () => {
        const db = await bancoDeHoje();
        await rodarArquivo(db, MIGRATION);
        await db.exec(
          `insert into public."TB_ROBO_WORKFLOW" ("NO_WORKFLOW", "NO_ROBO", "CO_CHAVE", "DS_INPUT_ACEITO", "ST_DISPARAVEL", "ST_REGISTRO_EXTERNO")
       values ('robo-novo.yml', 'Robô novo', 'selecao', '{modo,lote}', 'S', 'S')`,
        );
        const pedir = (entrada: object, origem: string | null) =>
          db.query<{ id: number | null }>(
            `select private."FC_DISPARAR_ROBO"('robo-novo.yml', $1::jsonb, null, $2) as id`,
            [JSON.stringify(entrada), origem],
          );
        expect(
          (await pedir({ modo: "normal", lote: "3" }, null)).rows[0]?.id,
        ).toBeGreaterThan(0);
        expect((await erroDe(pedir({ vagas: "1" }, null)))?.codigo).toBe(
          "22023",
        );
        // Chave "selecao" desligada: a agenda não pede.
        expect((await pedir({}, "AGENDA")).rows[0]?.id).toBeNull();
        expect(
          (
            await uma<{ c: string }>(
              db,
              `select private."FC_CHAVE_DO_WORKFLOW"('robo-novo.yml') as c`,
            )
          )?.c,
        ).toBe("selecao");
        const pedido = await uma<{ body: { inputs: unknown } }>(
          db,
          `select body from net."PEDIDO" order by id desc limit 1`,
        );
        expect(pedido?.body.inputs).toEqual({
          modo: "normal",
          lote: "3",
          disparado_por: "manual",
        });
        expect(
          await erroDe(
            db.query(
              `select public.registrar_disparo_externo('robo-novo.yml', 'fulano', 'https://github.com/a/b/actions/runs/1')`,
            ),
          ),
        ).toBeNull();
        // Workflow só de registro (ST_DISPARAVEL = N) não é pedido.
        expect(
          (
            await erroDe(
              db.query(
                `select private."FC_DISPARAR_ROBO"('leitura-de-arquivos.yml', '{}'::jsonb)`,
              ),
            )
          )?.codigo,
        ).toBe("22023");
      },
      LONGO,
    );

    it(
      "tarefa: o nome exato ganha do prefixo; tarefa fora do catálogo não tem chave",
      async () => {
        const db = await bancoDeHoje();
        await rodarArquivo(db, MIGRATION);
        await db.exec(
          `insert into public."TB_TAREFA_AGENDADA" ("NO_TAREFA", "ST_PREFIXO", "DS_ROTULO", "CO_CHAVE")
       values ('agsus_robo_inscricoes_especial', 'N', 'Especial', 'paineis')`,
        );
        const chave = async (t: string) =>
          (
            await uma<{ c: string | null }>(
              db,
              `select private."FC_CHAVE_DA_TAREFA"($1) as c`,
              [t],
            )
          )?.c;
        expect(await chave("agsus_robo_inscricoes_especial")).toBe("paineis");
        expect(await chave("agsus_robo_inscricoes_especial_2")).toBe(
          "robo_de_inscricoes",
        );
        expect(await chave("agsus_tarefa_nova")).toBeNull();
      },
      LONGO,
    );

    describe("o alinhador: a chave manda no pg_cron", () => {
      let db: Banco;
      beforeAll(async () => {
        db = await bancoDeHoje({
          tarefasExtras: [
            ["agsus_robo_inscricoes_120_2026", "0 10 * * *", true],
            ["agsus_tarefa_sem_catalogo", "0 1 * * *", false],
          ],
          tarefas: { agsus_robo_conferir_disparos: false },
        });
        await rodarArquivo(db, MIGRATION);
      }, LONGO);

      it("chave desligada com tarefa religada por fora: o alinhador desliga e deixa no histórico, sem usuário", async () => {
        await db.exec(
          `update cron.job set active = true where jobname = 'agsus_robo_sincronizar_selecao'`,
        );
        const r = await uma<{ m: string[] }>(
          db,
          `select private."FC_ALINHAR_TAREFAS_DAS_CHAVES"() as m`,
        );
        expect(r?.m).toEqual(["agsus_robo_sincronizar_selecao"]);
        expect((await estadoDoCron(db)).agsus_robo_sincronizar_selecao).toBe(
          false,
        );
        const evento = await uma(
          db,
          `select "CO_CHAVE", "ST_LIGADA", "CO_USUARIO", "DS_TAREFAS", "DS_MOTIVO"
           from public."TH_CHAVE_AUTOMACAO" order by "CO_EVENTO" desc limit 1`,
        );
        expect(evento).toMatchObject({
          CO_CHAVE: "selecao",
          ST_LIGADA: "N",
          CO_USUARIO: null,
          DS_TAREFAS: ["agsus_robo_sincronizar_selecao"],
        });
      });

      it("chave ligada com tarefa parada por fora: religa; várias chaves de uma vez, um evento por chave, em ordem", async () => {
        await db.exec(
          `update cron.job set active = false where jobname in ('agsus_analises_cache_do_painel', 'agsus_fila_estatisticas', 'agsus_aprovados_cache_por_area')`,
        );
        const antes =
          (
            await uma<{ n: number }>(
              db,
              `select count(*)::int as n from public."TH_CHAVE_AUTOMACAO"`,
            )
          )?.n ?? 0;
        const r = await uma<{ m: string[] }>(
          db,
          `select private."FC_ALINHAR_TAREFAS_DAS_CHAVES"() as m`,
        );
        expect(r?.m).toEqual([
          "agsus_analises_cache_do_painel",
          "agsus_aprovados_cache_por_area",
          "agsus_fila_estatisticas",
        ]);
        const eventos = await db.query(
          `select "CO_CHAVE", "DS_TAREFAS" from public."TH_CHAVE_AUTOMACAO" order by "CO_EVENTO" offset $1`,
          [antes],
        );
        expect(eventos.rows).toEqual([
          { CO_CHAVE: "manutencao", DS_TAREFAS: ["agsus_fila_estatisticas"] },
          {
            CO_CHAVE: "paineis",
            DS_TAREFAS: [
              "agsus_analises_cache_do_painel",
              "agsus_aprovados_cache_por_area",
            ],
          },
        ]);
      });

      it("tarefa sem chave (ou fora do catálogo) nunca é tocada; prefixo das inscrições segue a chave", async () => {
        const cron = await estadoDoCron(db);
        expect(cron.agsus_robo_conferir_disparos).toBe(false);
        expect(cron.agsus_tarefa_sem_catalogo).toBe(false);
        expect(cron.agsus_robo_inscricoes_120_2026).toBe(true);
        await db.exec(
          `update public."TB_CHAVE_AUTOMACAO" set "ST_LIGADA" = 'N' where "CO_CHAVE" = 'robo_de_inscricoes'`,
        );
        await db.query(`select private."FC_ALINHAR_TAREFAS_DAS_CHAVES"()`);
        expect((await estadoDoCron(db)).agsus_robo_inscricoes_120_2026).toBe(
          false,
        );
        await db.exec(
          `update public."TB_CHAVE_AUTOMACAO" set "ST_LIGADA" = 'S' where "CO_CHAVE" = 'robo_de_inscricoes'`,
        );
        await db.query(`select private."FC_ALINHAR_TAREFAS_DAS_CHAVES"()`);
      });

      it("alinhado, não mexe em nada nem grava histórico; com p_chave, só aquela chave e sem histórico", async () => {
        const antes = await uma<{ n: number }>(
          db,
          `select count(*)::int as n from public."TH_CHAVE_AUTOMACAO"`,
        );
        expect(
          (
            await uma<{ m: string[] }>(
              db,
              `select private."FC_ALINHAR_TAREFAS_DAS_CHAVES"() as m`,
            )
          )?.m,
        ).toEqual([]);
        await db.exec(
          `update cron.job set active = true where jobname in ('agsus_robo_sincronizar_entrevistas', 'agsus_robo_sincronizar_selecao')`,
        );
        expect(
          (
            await uma<{ m: string[] }>(
              db,
              `select private."FC_ALINHAR_TAREFAS_DAS_CHAVES"('selecao') as m`,
            )
          )?.m,
        ).toEqual(["agsus_robo_sincronizar_selecao"]);
        expect(
          (await estadoDoCron(db)).agsus_robo_sincronizar_entrevistas,
        ).toBe(true);
        expect(
          await uma(
            db,
            `select count(*)::int as n from public."TH_CHAVE_AUTOMACAO"`,
          ),
        ).toEqual(antes);
        await db.query(`select private."FC_ALINHAR_TAREFAS_DAS_CHAVES"()`);
      });

      it("a tarefa agsus_alinhar_chaves_da_automacao: a cada 5 min, ativa, sem chave, e o comando roda", async () => {
        const tarefa = await uma<{
          schedule: string;
          command: string;
          active: boolean;
        }>(
          db,
          `select schedule, command, active from cron.job where jobname = 'agsus_alinhar_chaves_da_automacao'`,
        );
        expect(tarefa).toMatchObject({ schedule: "*/5 * * * *", active: true });
        expect(tarefa?.command).toContain("pg_try_advisory_xact_lock");
        expect(
          (
            await uma<{ c: string | null }>(
              db,
              `select private."FC_CHAVE_DA_TAREFA"('agsus_alinhar_chaves_da_automacao') as c`,
            )
          )?.c,
        ).toBeNull();
        await db.exec(
          `update cron.job set active = true where jobname = 'agsus_robo_sincronizar_selecao'`,
        );
        await db.exec(tarefa?.command ?? "");
        expect((await estadoDoCron(db)).agsus_robo_sincronizar_selecao).toBe(
          false,
        );
      });
    });

    it(
      "obter_catalogo_dos_robos: só o administrador global; nomes dos workflows e das tarefas",
      async () => {
        const db = await bancoDeHoje();
        await rodarArquivo(db, MIGRATION);
        await entrar(db, null);
        expect(
          (await erroDe(db.query(`select public.obter_catalogo_dos_robos()`)))
            ?.codigo,
        ).toBe("28000");
        await entrar(db, USUARIO_COMUM, false);
        expect(
          (await erroDe(db.query(`select public.obter_catalogo_dos_robos()`)))
            ?.codigo,
        ).toBe("42501");
        await entrar(db, USUARIO_MASTER, true);
        const r = await uma<{ c: { workflows: Linha[]; tarefas: Linha[] } }>(
          db,
          `select public.obter_catalogo_dos_robos() as c`,
        );
        expect(r?.c.workflows).toHaveLength(11);
        expect(r?.c.workflows).toContainEqual({
          workflow: "conferencias.yml",
          nome: "Conferências",
          chave: "conferencias",
          disparavel: true,
        });
        expect(r?.c.tarefas).toContainEqual({
          tarefa: "agsus_robo_inscricoes_",
          prefixo: true,
          rotulo: "Agenda das inscrições: pedir o robô da Empregare",
          chave: "robo_de_inscricoes",
          workflow: "robo-empregare.yml",
        });
        expect(r?.c.tarefas).toHaveLength(17);
        // A fixture dos testes da tela é a resposta de verdade do banco.
        expect(r?.c).toEqual(CATALOGO_DOS_ROBOS);
      },
      LONGO,
    );
  });
});

bloco("catalogo-dos-robos", () => {
  const CATALOGO = normalizarCatalogo(CATALOGO_DOS_ROBOS);

  describe("normalizarCatalogo", () => {
    it("lê workflows e tarefas", () => {
      expect(CATALOGO?.workflows.size).toBe(11);
      expect(CATALOGO?.workflows.get("conferencias.yml")).toEqual({
        workflow: "conferencias.yml",
        nome: "Conferências",
        chave: "conferencias",
        disparavel: true,
      });
      expect(CATALOGO?.tarefas).toHaveLength(17);
    });

    it("sem as duas listas não é catálogo (RPC ausente, erro ou outro payload)", () => {
      expect(normalizarCatalogo(null)).toBeNull();
      expect(normalizarCatalogo([])).toBeNull();
      expect(normalizarCatalogo({ tarefas: [] })).toBeNull();
      expect(normalizarCatalogo({ workflows: [] })).toBeNull();
    });

    it("descarta entradas malformadas sem quebrar", () => {
      const c = normalizarCatalogo({
        workflows: [
          null,
          1,
          { workflow: "" },
          { workflow: "a.yml", nome: 3, chave: {} },
        ],
        tarefas: [
          { tarefa: "" },
          "x",
          { tarefa: "agsus_x", prefixo: "sim", workflow: 2 },
        ],
      });
      expect([...(c?.workflows.values() ?? [])]).toEqual([
        { workflow: "a.yml", nome: "a.yml", chave: null, disparavel: false },
      ]);
      expect(c?.tarefas).toEqual([
        {
          tarefa: "agsus_x",
          prefixo: false,
          rotulo: "",
          chave: null,
          workflow: null,
        },
      ]);
    });
  });

  describe("nomes e tarefas pelo catálogo", () => {
    it("nome do workflow; sem catálogo ou fora dele, o arquivo", () => {
      expect(nomeDoWorkflow(CATALOGO, "robo-empregare.yml")).toBe(
        "Robô da Empregare",
      );
      expect(nomeDoWorkflow(CATALOGO, "novo.yml")).toBe("novo.yml");
      expect(nomeDoWorkflow(null, "conferencias.yml")).toBe("conferencias.yml");
    });

    it("tarefa: nome exato ganha do prefixo; prefixo mais longo ganha (a regra do banco)", () => {
      expect(
        tarefaDoCatalogo(CATALOGO, "agsus_robo_conferencias")?.workflow,
      ).toBe("conferencias.yml");
      expect(
        tarefaDoCatalogo(CATALOGO, "agsus_robo_inscricoes_120_2026")?.chave,
      ).toBe("robo_de_inscricoes");
      expect(tarefaDoCatalogo(CATALOGO, "agsus_robo_inscricoes")).toBeNull();
      expect(tarefaDoCatalogo(CATALOGO, "outra")).toBeNull();
      expect(tarefaDoCatalogo(null, "agsus_robo_conferencias")).toBeNull();
      const comExata = normalizarCatalogo({
        workflows: [],
        tarefas: [
          { tarefa: "agsus_a_", prefixo: true, rotulo: "curto" },
          { tarefa: "agsus_a_b_", prefixo: true, rotulo: "longo" },
          { tarefa: "agsus_a_b_c", prefixo: false, rotulo: "exato" },
        ],
      });
      expect(tarefaDoCatalogo(comExata, "agsus_a_b_c")?.rotulo).toBe("exato");
      expect(tarefaDoCatalogo(comExata, "agsus_a_b_cd")?.rotulo).toBe("longo");
      expect(tarefaDoCatalogo(comExata, "agsus_a_x")?.rotulo).toBe("curto");
    });
  });

  describe("Status das atualizações com e sem o catálogo", () => {
    const AGORA = new Date("2026-11-09T12:00:00Z");
    const ha = (min: number) =>
      new Date(AGORA.getTime() - min * 60000).toISOString();
    const PAYLOAD = {
      entrevistas: [],
      selecao: [],
      conferencias: [
        { inicio: ha(27 * 60 + 1), fim: ha(27 * 60), situacao: "CONCLUIDA" },
      ],
      agenda_dos_robos: {
        chave_cadastrada: true,
        ultimo_aceito: ha(27 * 60),
        falhas_24h: 0,
        sem_chave_24h: 0,
        disparos: [
          {
            workflow: "conferencias.yml",
            inicio: ha(27 * 60),
            fim: ha(27 * 60),
            situacao: "ACEITO",
            http: 204,
          },
          {
            workflow: "novo.yml",
            inicio: ha(28 * 60),
            fim: ha(28 * 60),
            situacao: "ACEITO",
          },
        ],
      },
      tarefas: [
        {
          nome: "agsus_robo_conferencias",
          agenda: "0 9 * * *",
          ativa: true,
          execucoes: [],
        },
        {
          nome: "agsus_robo_inscricoes_120_2026",
          agenda: "0 10 * * *",
          ativa: false,
          execucoes: [],
        },
        {
          nome: "agsus_tarefa_nova",
          agenda: "0 1 * * *",
          ativa: true,
          execucoes: [],
        },
      ],
    };
    const carga = (payload: object, id: string) =>
      normalizarSaude(payload, AGORA)
        .grupos.flatMap((g) => g.cargas)
        .find((c) => c.id === id);

    it("com o catálogo: Conferências atrasa pela tarefa que pede conferencias.yml; nomes de gente", () => {
      const comCatalogo = {
        ...PAYLOAD,
        catalogo_dos_robos: CATALOGO_DOS_ROBOS,
      };
      expect(carga(comCatalogo, "conferencias")).toMatchObject({
        prazoMin: 26 * 60,
        esperado: "todo dia às 6h",
        situacao: "atrasada",
      });
      const agenda = carga(comCatalogo, "agenda_dos_robos");
      expect(agenda?.situacao).toBe("atrasada");
      expect(agenda?.esperado).toBe("Conferências: todo dia às 6h");
      expect(agenda?.historico.map((e) => e.mensagem)).toEqual([
        "Conferências · HTTP 204",
        "novo.yml",
      ]);
      expect(
        carga(comCatalogo, "tarefa:agsus_robo_inscricoes_120_2026")?.nome,
      ).toBe("Agenda das inscrições: pedir o robô da Empregare");
      expect(carga(comCatalogo, "tarefa:agsus_tarefa_nova")?.nome).toBe(
        "agsus_tarefa_nova",
      );
      expect(
        visaoSimples(normalizarSaude(comCatalogo, AGORA)).atencao.map(
          (l) => l.id,
        ),
      ).toContain("conferencias");
    });

    it("sem o catálogo: nomes do banco e nenhuma carga com agenda conhecida (não acusa atraso falso)", () => {
      expect(carga(PAYLOAD, "conferencias")).toMatchObject({
        prazoMin: null,
        esperado: "só pelo Rodar agora",
        situacao: "em_dia",
      });
      const agenda = carga(PAYLOAD, "agenda_dos_robos");
      expect(agenda?.situacao).toBe("em_dia");
      expect(agenda?.historico[0]?.mensagem).toBe(
        "conferencias.yml · HTTP 204",
      );
      expect(carga(PAYLOAD, "tarefa:agsus_robo_conferencias")?.nome).toBe(
        "agsus_robo_conferencias",
      );
    });
  });
});

bloco("componentes/resumo-do-nucleo", () => {
  function deferred<T = unknown>() {
    // O executor da Promise roda na hora: os dois são trocados antes do return.
    let resolve: (valor: T) => void = () => {};
    let reject: (erro: unknown) => void = () => {};
    const promise = new Promise<T>((ok, fail) => {
      resolve = ok;
      reject = fail;
    });
    return { promise, resolve, reject };
  }

  describe("Núcleo summary store", () => {
    it("cache vazio é válido e consulta ativa prevalece sobre cache anterior", async () => {
      const pending = deferred();
      const loader = vi
        .fn()
        .mockResolvedValueOnce([])
        .mockReturnValueOnce(pending.promise);
      const store = createNucleoSummaryStore({ loader });
      await store.get();
      await store.get();
      expect(loader).toHaveBeenCalledTimes(1);
      const refreshing = store.get({ force: true });
      expect(store.get()).toBe(refreshing);
      pending.resolve([{ id: "new" }]);
      expect(await refreshing).toEqual([{ id: "new" }]);
    });
    it("compartilha uma única carga entre chamadas concorrentes", async () => {
      const pending = deferred();
      const loader = vi.fn(() => pending.promise);
      const store = createNucleoSummaryStore({ loader, ttlMs: 30_000 });

      const first = store.get();
      const second = store.get();
      const third = store.get({ force: true });
      expect(first).toBe(second);
      expect(first).toBe(third);

      await Promise.resolve();
      expect(loader).toHaveBeenCalledTimes(1);
      expect(store.snapshot().inFlight).toBe(true);

      pending.resolve([{ id: "1" }]);
      await expect(Promise.all([first, second, third])).resolves.toEqual([
        [{ id: "1" }],
        [{ id: "1" }],
        [{ id: "1" }],
      ]);
      expect(loader).toHaveBeenCalledTimes(1);
    });

    it("usa cache válido e permite zero chamadas numa nova abertura", async () => {
      let now = 1_000;
      const loader = vi.fn(async () => [{ id: "cache" }]);
      const store = createNucleoSummaryStore({
        loader,
        ttlMs: 30_000,
        now: () => now,
      });

      await expect(store.get()).resolves.toEqual([{ id: "cache" }]);
      now += 10_000;
      await expect(store.get()).resolves.toEqual([{ id: "cache" }]);

      expect(loader).toHaveBeenCalledTimes(1);
      expect(store.snapshot().hasFreshCache).toBe(true);
    });

    it("expira o cache após o TTL", async () => {
      let now = 0;
      const loader = vi
        .fn()
        .mockResolvedValueOnce([{ id: "old" }])
        .mockResolvedValueOnce([{ id: "new" }]);
      const store = createNucleoSummaryStore({
        loader,
        ttlMs: 30_000,
        now: () => now,
      });

      await expect(store.get()).resolves.toEqual([{ id: "old" }]);
      now = 30_001;
      await expect(store.get()).resolves.toEqual([{ id: "new" }]);
      expect(loader).toHaveBeenCalledTimes(2);
    });

    it("invalida o cache após salvar e busca dados novos", async () => {
      const loader = vi
        .fn()
        .mockResolvedValueOnce([{ id: "before" }])
        .mockResolvedValueOnce([{ id: "after" }]);
      const store = createNucleoSummaryStore({ loader });

      await expect(store.get()).resolves.toEqual([{ id: "before" }]);
      store.invalidate();
      await expect(store.get({ force: true })).resolves.toEqual([
        { id: "after" },
      ]);
      expect(loader).toHaveBeenCalledTimes(2);
    });

    it("não deixa uma resposta antiga repovoar o cache após invalidação", async () => {
      const first = deferred();
      const second = deferred();
      const loader = vi
        .fn()
        .mockImplementationOnce(() => first.promise)
        .mockImplementationOnce(() => second.promise);
      const store = createNucleoSummaryStore({ loader });

      const oldRequest = store.get();
      store.invalidate();
      const freshRequest = store.get({ force: true });

      await Promise.resolve();
      expect(loader).toHaveBeenCalledTimes(1);
      first.resolve([{ id: "stale" }]);
      await expect(oldRequest).resolves.toEqual([{ id: "stale" }]);

      await vi.waitFor(() => expect(loader).toHaveBeenCalledTimes(2));
      second.resolve([{ id: "fresh" }]);
      await expect(freshRequest).resolves.toEqual([{ id: "fresh" }]);
      expect(store.peek()).toEqual([{ id: "fresh" }]);
    });

    it("libera a fila depois de erro para permitir nova tentativa", async () => {
      const loader = vi
        .fn()
        .mockRejectedValueOnce(new Error("rede indisponível"))
        .mockResolvedValueOnce([{ id: "ok" }]);
      const store = createNucleoSummaryStore({ loader });

      await expect(store.get()).rejects.toThrow("rede indisponível");
      expect(store.snapshot().inFlight).toBe(false);
      await expect(store.get()).resolves.toEqual([{ id: "ok" }]);
      expect(loader).toHaveBeenCalledTimes(2);
    });
  });
});

/*
  Confirmação em lote dos editais com cronograma encerrado (20261119120000): a lista da tela de
  Editais tem o recorte da conferência EDITAL_CRONOGRAMA_ENCERRADO; concluir grava "Concluído" só
  onde o estado calculado é Concluído e o gravado é outro, recusa os demais com o motivo e registra
  no histórico do cronograma.
*/
bloco("concluir-encerrados-no-banco", () => {
  const C = ENCERRADOS;
  const MOTIVO = "Conferido com a equipe em 19/11";
  const ids = (lista: { id: string }[]) => lista.map((e) => e.id).sort();

  it("a migration (aplicada) deixa a CHECK da ação com nome MAD e roda de novo sem erro", async () => {
    const db = await bancoDosEncerradosMigrado();
    await db.exec(migrationDosEncerrados());
    const r = await db.query<{ conname: string; def: string }>(
      `select conname, pg_get_constraintdef(oid) as def from pg_constraint
        where conrelid = 'public."TH_CRONOGRAMA_MONIT_INDIG"'::regclass and contype = 'c'`,
    );
    expect(r.rows).toEqual([
      {
        conname: "CK_HISTCRONOGRAMA_ACAO",
        def: "CHECK ((acao = ANY (ARRAY['salvar'::text, 'errata'::text, 'status'::text])))",
      },
    ]);
  });

  it("a lista tem só o recorte da conferência, com o aviso e as outras pendências abertas", async () => {
    const db = await bancoDosEncerradosMigrado();
    await entrarNosEncerrados(db, { gestor: true });
    const lista = await listarEncerrados(db);
    expect(lista.pode_concluir).toBe(true);
    expect(ids(lista.editais)).toEqual([C.encerrado, C.comAviso].sort());
    const comAviso = lista.editais.find((e) => e.id === C.comAviso);
    expect(comAviso).toMatchObject({
      numero: "42/2099",
      status: "Em andamento",
      etapa: "Resultado final do Processo Seletivo",
      fim: "2020-03-31",
      aviso: { tratamento: "PENDENTE", pode_dispensar: true },
    });
    // A pendência dispensada fica de fora; o próprio aviso do cronograma também.
    expect(comAviso?.pendencias).toEqual([
      {
        conferencia: "APROVADOS_SEM_STATUS",
        gravidade: "CRITICA",
        quantidade: 3,
        tratamento: "EM_ANALISE",
      },
    ]);
    expect(lista.editais.find((e) => e.id === C.encerrado)?.aviso).toBeNull();
  });

  it("quem só lê vê a lista sem poder concluir e não conclui", async () => {
    const db = await bancoDosEncerradosMigrado();
    await entrarNosEncerrados(db, { nivel: 1 });
    const lista = await listarEncerrados(db);
    expect(lista.pode_concluir).toBe(false);
    expect(
      lista.editais.find((e) => e.id === C.comAviso)?.aviso?.pode_dispensar,
    ).toBe(false);
    const erro = await erroDosEncerrados(
      concluirEncerrados(db, [C.encerrado], MOTIVO),
    );
    expect(erro.code).toBe("42501");
    await entrarNosEncerrados(db, { nivel: 0 });
    expect((await erroDosEncerrados(listarEncerrados(db))).code).toBe("42501");
  });

  it("o edital de fora da área some da lista e é recusado como não encontrado", async () => {
    const db = await bancoDosEncerradosMigrado();
    await entrarNosEncerrados(db, { esconder: C.encerrado });
    expect(ids((await listarEncerrados(db)).editais)).toEqual([C.comAviso]);
    const r = await concluirEncerrados(db, [C.encerrado], MOTIVO);
    expect(r.concluidos).toEqual([]);
    expect(r.recusados).toEqual([
      { id: C.encerrado, edital: null, motivo: "Edital não encontrado" },
    ]);
  });

  it("concluir marca os que passam, recusa os demais com o motivo e não para o lote", async () => {
    const db = await bancoDosEncerradosMigrado();
    await entrarNosEncerrados(db);
    const desconhecido = "aaaaaaaa-0000-4000-8000-0000000000ff";
    const r = await concluirEncerrados(
      db,
      [
        C.encerrado,
        C.comAviso,
        C.dispensado,
        C.emAndamento,
        C.concluido,
        C.cancelado,
        C.suspenso,
        C.manual,
        C.semEtapas,
        desconhecido,
        C.encerrado,
      ],
      `  ${MOTIVO}  `,
    );
    expect(ids(r.concluidos)).toEqual(
      [C.encerrado, C.comAviso, C.dispensado].sort(),
    );
    expect(
      r.concluidos.every((c) => c.status_anterior === "Em andamento"),
    ).toBe(true);
    const motivos = Object.fromEntries(
      r.recusados.map((x) => [x.id, x.motivo]),
    );
    expect(motivos).toEqual({
      [C.emAndamento]:
        'Pelo cronograma, o edital está "Em andamento", não concluído',
      [C.concluido]: "O status já é Concluído",
      [C.cancelado]: 'O status gravado é "Cancelado": decida no próprio edital',
      [C.suspenso]: 'Pelo cronograma, o edital está "Suspenso", não concluído',
      [C.manual]:
        'Pelo cronograma, o edital está "Em andamento", não concluído',
      [C.semEtapas]: "Edital sem cronograma",
      [desconhecido]: "Edital não encontrado",
    });

    // O status e a etapa que o salvar do edital gravaria; quem e quando.
    const linha = await db.query<Record<string, unknown>>(
      `select status, etapa, updated_by from public."TB_MONITORAMENTO_INDIGENA" where id = $1`,
      [C.encerrado],
    );
    expect(linha.rows[0]).toEqual({
      status: "Concluído",
      etapa: "Resultado final do Processo Seletivo",
      updated_by: USUARIO_DOS_ENCERRADOS,
    });

    // O histórico do cronograma: um registro 'status' por edital, com o motivo e quem fez.
    const historico = await db.query<Record<string, unknown>>(
      `select monitoramento_id, motivo, created_by, created_by_email, total_alteracoes, alteracoes,
              cronograma_antes = cronograma_depois as mesmo_cronograma
         from public."TH_CRONOGRAMA_MONIT_INDIG" where acao = 'status' order by monitoramento_id`,
    );
    expect(historico.rows).toHaveLength(3);
    expect(historico.rows[0]).toEqual({
      monitoramento_id: C.encerrado,
      motivo: MOTIVO,
      created_by: USUARIO_DOS_ENCERRADOS,
      created_by_email: "equipe@teste",
      total_alteracoes: 1,
      alteracoes: [
        {
          tipo: "status",
          campo: "status",
          antes: "Em andamento",
          depois: "Concluído",
        },
      ],
      mesmo_cronograma: true,
    });

    // Concluídos saem da lista; concluir de novo é recusado.
    expect((await listarEncerrados(db)).editais).toEqual([]);
    const outraVez = await concluirEncerrados(db, [C.encerrado], MOTIVO);
    expect(outraVez.recusados[0]?.motivo).toBe("O status já é Concluído");
  });

  it("o motivo e a lista de editais são conferidos antes de gravar", async () => {
    const db = await bancoDosEncerradosMigrado();
    await entrarNosEncerrados(db);
    for (const [lista, motivo, mensagem] of [
      [[C.encerrado], "curto", /10 a 500/],
      [[C.encerrado], "x".repeat(501), /10 a 500/],
      [[C.encerrado], "Conferido com fulano@teste.gov", /CPF nem e-mail/],
      [[C.encerrado], "Conferido no 12345678901 hoje", /CPF nem e-mail/],
      [[], MOTIVO, /ao menos um edital/],
      [
        Array.from(
          { length: 201 },
          (_, i) => `aaaaaaaa-0000-4000-8000-${String(i).padStart(12, "0")}`,
        ),
        MOTIVO,
        /Até 200/,
      ],
    ] as [string[], string, RegExp][]) {
      const erro = await erroDosEncerrados(
        concluirEncerrados(db, lista, motivo),
      );
      expect(erro.code).toBe("22023");
      expect(erro.message).toMatch(mensagem);
    }
    await db.exec(`select set_config('teste.uid', '', false)`);
    expect(
      (await erroDosEncerrados(concluirEncerrados(db, [C.encerrado], MOTIVO)))
        .code,
    ).toBe("42501");
    const status = await db.query<{ status: string }>(
      `select status from public."TB_MONITORAMENTO_INDIGENA" where id = $1`,
      [C.encerrado],
    );
    expect(status.rows[0]?.status).toBe("Em andamento");
  });
});

bloco("copias-no-aparelho", () => {
  /*
  As cópias de payload no aparelho levam nomes e notas de candidatos: valem
  48 h e, vencidas, saem do aparelho (na leitura e na varredura da abertura).
*/

  const HORA = 60 * 60 * 1000;

  const TIPO = Object.freeze({
    nome: "teste",
    chave: ({ area }: { area: string }) => `teste:${area}`,
    esquema: () => 1,
    esquemas: Object.freeze([1]),
    valido: (payload: unknown) => Boolean(payload),
  });

  function emMemoria() {
    const dados = new Map<string, unknown>();
    const armazenamento: ArmazenamentoDoCache = {
      ler: async (chave) => structuredClone(dados.get(chave) ?? null),
      guardar: async (chave, valor) => {
        dados.set(chave, structuredClone(valor));
      },
      apagarTudo: async () => dados.clear(),
      apagar: async (chave) => dados.delete(chave),
    };
    return { dados, armazenamento };
  }

  const U1 = { usuarioId: "u1", area: "sede" };

  describe("cópias de payload no aparelho", () => {
    const indexedDBDeAntes = globalThis.indexedDB;
    afterEach(() => {
      Object.assign(globalThis, { indexedDB: indexedDBDeAntes });
    });

    it("valem 48 h", () => {
      expect(VALIDADE_DO_CACHE_MS).toBe(48 * HORA);
      expect(registroVencido({ guardadoEm: 0 }, 48 * HORA)).toBe(false);
      expect(registroVencido({ guardadoEm: 0 }, 48 * HORA + 1)).toBe(true);
      expect(registroVencido({ guardadoEm: "lixo" }, 1)).toBe(true);
      // O registro do dono (o id do usuário, um texto) não vence.
      expect(registroVencido("u1", 99 * HORA)).toBe(false);
    });

    it("diz a data da cópia: dia, mês e hora, sem o ano", () => {
      const guardadoEm = Date.UTC(2026, 10, 17, 13, 14);
      expect(rotuloDaCopia(guardadoEm, "America/Sao_Paulo")).toBe(
        "Dados de 17/11, 10:14",
      );
      expect(rotuloDaCopia(guardadoEm, "America/Manaus")).toBe(
        "Dados de 17/11, 09:14",
      );
      expect(rotuloDaCopia(0)).toBe("");
      expect(rotuloDaCopia("lixo")).toBe("");
    });

    it("devolve a cópia com a hora em que foi guardada", async () => {
      let agora = 10 * HORA;
      const { armazenamento } = emMemoria();
      const cache = criarCacheDePayload({
        armazenamento,
        versao: "v1",
        tipo: TIPO,
        relogio: () => agora,
      });
      await cache.guardar(U1, { linhas: [1] });
      agora += 3 * HORA;
      expect(await cache.lerComData(U1)).toEqual({
        payload: { linhas: [1] },
        guardadoEm: 10 * HORA,
      });
      expect(await cache.ler(U1)).toEqual({ linhas: [1] });
    });

    it("a cópia vencida sai do aparelho na leitura", async () => {
      let agora = 0;
      const { dados, armazenamento } = emMemoria();
      const cache = criarCacheDePayload({
        armazenamento,
        versao: "v1",
        tipo: TIPO,
        relogio: () => agora,
      });
      await cache.guardar(U1, { linhas: [1] });
      expect(dados.has("teste:sede")).toBe(true);
      agora = 48 * HORA + 1;
      expect(await cache.lerComData(U1)).toBeNull();
      expect(dados.has("teste:sede")).toBe(false);
      expect(dados.get(CHAVE_DO_DONO)).toBe("u1");
    });

    it("a varredura da abertura apaga as vencidas de todas as telas e deixa as outras", async () => {
      const falso = indexedDBFalso();
      Object.assign(globalThis, { indexedDB: falso });
      await armazenamentoDePayload.guardar(CHAVE_DO_DONO, "u1");
      await armazenamentoDePayload.guardar("aprovados:sede", { guardadoEm: 0 });
      await armazenamentoDePayload.guardar("entrevistas:sede", {
        guardadoEm: 40 * HORA,
      });

      expect(await apagarCopiasVencidas(50 * HORA)).toBe(1);
      expect(await armazenamentoDePayload.ler("aprovados:sede")).toBeNull();
      expect(await armazenamentoDePayload.ler("entrevistas:sede")).toEqual({
        guardadoEm: 40 * HORA,
      });
      expect(await armazenamentoDePayload.ler(CHAVE_DO_DONO)).toBe("u1");
    });

    it("a varredura não cria o banco que não existe e nunca lança", async () => {
      const falso = indexedDBFalso();
      Object.assign(globalThis, { indexedDB: falso });
      expect(await apagarCopiasVencidas(1)).toBe(0);
      expect(falso.bancos.size).toBe(0);

      Object.assign(globalThis, { indexedDB: undefined });
      expect(await apagarCopiasVencidas(1)).toBe(0);
    });
  });
});

bloco("cronograma-com-espacos-duplos", () => {
  /*
  O cronograma colado do PDF da Cebraspe chega com espaços duplos
  ("Divulgação  do  edital  de  resultado  final"): o aviso dizia que faltava
  a etapa de resultado final (Rio Doce 04/2026, 16/11/2026).
*/

  const EDITAL = {
    edital: "04/2026",
    unidade: "Rio Doce",
    cronograma_automatico: true,
  };
  const etapas = [
    novaEtapa(
      {
        atividade: "Período  de  inscrições",
        data_inicio: "2026-02-10",
        data_fim: "2026-02-17",
      },
      1,
    ),
    novaEtapa(
      {
        atividade:
          "Divulgação  do  edital  de  resultado  final  no  processo  seletivo",
        data_inicio: "2026-04-17",
      },
      2,
    ),
  ];

  describe("atividade com espaços duplos", () => {
    it("limpa os espaços repetidos, inclusive quebra de linha e tabulação", () => {
      expect(atividadeLimpa("  Resultado \n final\t do  edital ")).toBe(
        "Resultado final do edital",
      );
      expect(atividadeLimpa(null)).toBe("");
    });

    it("acha a etapa de resultado final com espaços duplos", () => {
      const { avisos } = analisarCronograma(EDITAL, etapas, "ajuste", {
        exigirMotivo: false,
      });
      expect(avisos).not.toContain(
        "O cronograma não possui uma etapa de resultado final.",
      );
    });

    it("acusa atividade repetida mesmo com espaços diferentes", () => {
      const repetidas = [
        ...etapas,
        novaEtapa(
          { atividade: "Período de inscrições", data_inicio: "2026-02-18" },
          3,
        ),
      ];
      const { erros } = analisarCronograma(EDITAL, repetidas, "ajuste", {
        exigirMotivo: false,
      });
      expect(erros.some((e) => e.includes("atividade duplicada"))).toBe(true);
    });

    it("grava a atividade limpa e renumerada", () => {
      const salvas = cronogramaParaSalvar([etapas[1]!, etapas[0]!]);
      expect(salvas.map((e) => [e.ordem, e.atividade])).toEqual([
        [1, "Divulgação do edital de resultado final no processo seletivo"],
        [2, "Período de inscrições"],
      ]);
      expect(salvas[0]?.data_inicio).toBe("2026-04-17");
    });
  });
});

bloco("cronograma-sem-suspensos", () => {
  /*
  Cartão #59: edital suspenso aparecia no cronograma. O banco devolve só os
  editais com `ativo = true`, e o suspenso continua ativo (suspenso não é
  encerrado). Fixtures fictícias: dois editais ativos com etapas nos mesmos
  dias, um em andamento e outro com o status excepcional "Suspenso".
*/

  const NORMAL = {
    id: "edital-normal",
    unidade: "DSEI Fictício Norte",
    edital: "900/2099",
    ativo: true,
    status: "Em andamento",
    status_override: null,
    cronograma_total: 2,
  };
  const SUSPENSO = {
    id: "edital-suspenso",
    unidade: "DSEI Fictício Sul",
    edital: "901/2099",
    ativo: true,
    status: "Suspenso",
    status_override: "Suspenso",
    cronograma_total: 2,
  };
  const RESUMO = [NORMAL, SUSPENSO];

  const etapa = (
    edital: string,
    ordem: number,
    atividade: string,
    inicio: string,
    fim = inicio,
  ) => ({
    monitoramento_id: edital,
    ordem,
    atividade,
    data_inicio: inicio,
    data_fim: fim,
  });
  const ETAPAS_DO_BANCO = [
    etapa(NORMAL.id, 1, "Período de Entrevistas", "2099-03-10", "2099-03-12"),
    etapa(NORMAL.id, 2, "Resultado final do Processo Seletivo", "2099-03-20"),
    etapa(SUSPENSO.id, 1, "Período de Entrevistas", "2099-03-10", "2099-03-12"),
    etapa(SUSPENSO.id, 2, "Resultado final do Processo Seletivo", "2099-03-20"),
  ];
  const etapasDe = (id: string) =>
    ETAPAS_DO_BANCO.filter((e) => e.monitoramento_id === id);

  const auth = {
    getSession: async () => ({
      data: { session: { access_token: "token-falso" } },
      error: null,
    }),
  };

  describe("editalSuspenso", () => {
    it("reconhece o status excepcional e as grafias da planilha", () => {
      expect(editalSuspenso(SUSPENSO)).toBe(true);
      expect(editalSuspenso({ status: "SUSPENSO" })).toBe(true);
      expect(editalSuspenso({ status: "Suspensa" })).toBe(true);
      expect(editalSuspenso({ status: "  suspenso " })).toBe(true);
      // Resumo sem o status efetivo: o status excepcional basta.
      expect(
        editalSuspenso({ status: null, status_override: "Suspenso" }),
      ).toBe(true);
    });

    it("não tira os outros status, nem o que vem malformado", () => {
      for (const status of [
        "Em andamento",
        "Planejado",
        "Concluído",
        "Paralisado",
        "Cancelado",
        "Cronograma pendente",
        "",
        null,
        undefined,
        42,
        { toString: () => "Suspenso" },
      ])
        expect(editalSuspenso({ status, status_override: null })).toBe(false);
      expect(editalSuspenso(null)).toBe(false);
      expect(editalSuspenso("Suspenso")).toBe(false);
    });
  });

  describe("edital suspenso fora do cronograma", () => {
    const editais = editaisComCronograma(RESUMO);
    const { etapas, editais: doCalendario } = montarEtapasDosEditais(
      editais,
      editais.map((e) => etapasDe(String(e.id))),
    );
    const hoje = new Date(2099, 2, 1);

    it("o resumo só pede o cronograma do edital não suspenso", () => {
      expect(editais.map((e) => e.id)).toEqual([NORMAL.id]);
      expect(doCalendario).toEqual([
        { id: NORMAL.id, unidade: NORMAL.unidade, edital: NORMAL.edital },
      ]);
      expect(etapas.every((e) => e.editalId === NORMAL.id)).toBe(true);
      expect(etapas).toHaveLength(2);
    });

    it("Mês: os dias só contam as etapas do edital não suspenso", () => {
      const grade = montarGradeDoMes(new Date(2099, 2, 1), etapas, { hoje });
      const dia10 = grade.find((c) => c.chave === "2099-03-10");
      expect(dia10?.total).toBe(1);
      expect(dia10?.marcos.map((m) => m.etapa.editalId)).toEqual([NORMAL.id]);
    });

    it("Semana e Lista: nenhuma etapa do suspenso", () => {
      expect(contarEtapasNoIntervalo(etapas, "2099-03-08", "2099-03-14")).toBe(
        1,
      );
      const dias = diasDaLista(etapas, "2099-03-01", "2099-03-31", 2099);
      const ids = dias.flatMap((d) => d.itens.map((i) => i.etapa.editalId));
      expect(ids.length).toBeGreaterThan(0);
      expect(ids).not.toContain(SUSPENSO.id);
    });

    it("Próximas etapas e linha do tempo: só o edital não suspenso", () => {
      expect(proximasEtapas(etapas, hoje).map((e) => e.editalId)).toEqual([
        NORMAL.id,
        NORMAL.id,
      ]);
      const visiveis = editaisDoFiltro(doCalendario, filtrarEtapas(etapas));
      expect(visiveis.map((e) => e.id)).toEqual([NORMAL.id]);
      // Um link antigo que apontava para o suspenso cai no primeiro que restou.
      expect(editalDaLinhaDoTempo(SUSPENSO.id, visiveis)).toBe(NORMAL.id);
    });
  });

  describe("carga do cronograma com edital suspenso", () => {
    it("a RPC das etapas devolve o suspenso (só filtra ativo): a tela o tira, também do cache", async () => {
      const rpc = vi.fn(async (nome: string) => ({
        data:
          nome === "get_nucleo_cronograma_resumo"
            ? RESUMO
            : nome === "listar_etapas_do_cronograma"
              ? ETAPAS_DO_BANCO
              : [],
        error: null,
      }));
      let agora = 1_000;
      const estado = criarEstadoDoCalendario({
        supabase: { auth, rpc } as never,
        relogio: () => agora,
      });
      await estado.carregar();
      const primeira = estado.obter();
      expect(primeira.editais.map((e) => e.id)).toEqual([NORMAL.id]);
      expect(primeira.etapas.map((e) => e.editalId)).toEqual([
        NORMAL.id,
        NORMAL.id,
      ]);

      // Reabrir dentro do minuto usa o cache: continua sem o suspenso e sem pedir de novo.
      agora += 10_000;
      await estado.carregar();
      expect(rpc).toHaveBeenCalledTimes(3);
      expect(estado.obter().etapas).toBe(primeira.etapas);
    });

    it("caminho antigo, por edital (PGRST202): nem pede o cronograma do suspenso", async () => {
      const rpc = vi.fn(async (nome: string, argumentos?: unknown) => {
        if (nome === "get_nucleo_cronograma_resumo")
          return { data: RESUMO, error: null };
        if (nome === "listar_etapas_do_cronograma")
          return { data: null, error: { code: "PGRST202" } };
        if (nome === "get_monitoramento_cronograma") {
          const id = (argumentos as { p_monitoramento_id: string })
            .p_monitoramento_id;
          return { data: { etapas: etapasDe(id) }, error: null };
        }
        return { data: [], error: null };
      });
      const estado = criarEstadoDoCalendario({
        supabase: { auth, rpc } as never,
      });
      await estado.carregar();
      const pedidos = rpc.mock.calls.filter(
        ([nome]) => nome === "get_monitoramento_cronograma",
      );
      expect(pedidos).toEqual([
        ["get_monitoramento_cronograma", { p_monitoramento_id: NORMAL.id }],
      ]);
      expect(estado.obter().etapas.map((e) => e.editalId)).toEqual([
        NORMAL.id,
        NORMAL.id,
      ]);
    });
  });
});

bloco("erro-na-tela", () => {
  /*
  Auditoria das telas (10/11/2026): os avisos de erro mostravam o texto cru
  ("Failed to fetch dynamically imported module", "(código 42501)", "JWT
  expired"). A frase em português das RPCs passa igual; o técnico vira frase
  fixa que diz o que fazer.
*/
  describe("erro na tela", () => {
    it("frase em português das RPCs passa igual", () => {
      for (const frase of [
        "Sem acesso a esta área",
        "Edital da agenda inválido.",
        "Sem permissão para Seleção",
        "A lista mudou desde que a tela foi carregada (4 na tela, 5 no banco). Clique em Atualizar e exporte de novo.",
      ]) {
        expect(erroParaATela(new Error(frase))).toBe(frase);
        expect(erroParaATela({ message: frase, code: "42501" })).toBe(frase);
      }
    });

    it("sem conexão, versão nova, sessão, tempo e permissão viram frase fixa", () => {
      expect(erroParaATela(new TypeError("Failed to fetch"))).toBe(
        SEM_SERVIDOR,
      );
      expect(
        erroParaATela(
          new TypeError(
            "Failed to fetch dynamically imported module: https://x/assets/mapa-1.js",
          ),
        ),
      ).toBe(MENSAGEM_DE_VERSAO_NOVA);
      expect(erroParaATela({ message: "JWT expired", code: "PGRST301" })).toBe(
        SESSAO_VENCIDA,
      );
      expect(
        erroParaATela({
          message: "canceling statement due to statement timeout",
          code: "57014",
        }),
      ).toBe(TEMPO_ESGOTADO_NO_BANCO);
      expect(
        erroParaATela({
          message: "permission denied for function x",
          code: "42501",
        }),
      ).toBe(SEM_PERMISSAO);
    });

    it("outro texto técnico vira erro inesperado", () => {
      for (const tecnico of [
        'relation "public.TB_X" does not exist',
        "Could not find the function public.y in the schema cache",
        "duplicate key value violates unique constraint",
        "Cannot read properties of undefined (reading 'map')",
        "Unexpected token < in JSON at position 0",
      ])
        expect(erroParaATela(new Error(tecnico))).toBe(ERRO_INESPERADO);
      expect(erroParaATela(null)).toBe(ERRO_INESPERADO);
      expect(erroParaATela("")).toBe(ERRO_INESPERADO);
    });
  });
});

bloco("exportacao-do-resumo-migration", () => {
  /*
  Migration 20261111210000 (exportação do Resumo por cargo e status), já
  aplicada: o registro da exportação ganhou p_conteudo (LISTA ou RESUMO), e o
  contrato do front o declara.
*/

  describe("migration 20261111210000", () => {
    it("o contrato declara p_conteudo", () => {
      expect(CONTRATO_RPC.registrar_exportacao_aprovados?.argumentos).toContain(
        "p_conteudo",
      );
    });
  });
});

bloco("fontes-dos-paineis-no-banco", () => {
  type Banco = Banco__1;
  const entrar = entrar__2;
  const erroDe = erroDe__3;
  const uma = uma__4;
  /*
  Fontes das colunas dos Painéis (migration 20261113220000, já aplicada; o SQL
  em tests/fixtures/sql-do-banco/) num Postgres de verdade (PGlite): o catálogo
  de fontes lido do próprio banco, a troca de valores por área com SQL montado
  só a partir do catálogo, as guardas contra nome forjado, chave repetida e
  fonte que sumiu, e as RPCs de listar e salvar.
*/

  const LONGO = 60_000;
  const EDITAL = "aaaaaaaa-0000-0000-0000-000000000001";
  const EDITAL_2 = "aaaaaaaa-0000-0000-0000-000000000002";
  const SI = "saude-indigena";

  const FONTES_DE_TESTE = `
create table public.fonte_vaga (edital uuid, vaga text, qt integer, qt_texto text, quando timestamptz);
insert into public.fonte_vaga values
  ('${EDITAL}', '100', 7, 'sete', '2026-11-13 02:30:00+00'),
  ('${EDITAL}', '200', 3, 'tres', null);

create view painel."VW_VAGA_TESTE" as
  select edital as "CO_MONITORAMENTO", vaga as "CO_VAGA", qt as "QT_VAGA",
         qt_texto as "DS_VAGA", quando as "DT_REGISTRO"
    from public.fonte_vaga;
comment on view painel."VW_VAGA_TESTE" is 'Fonte de teste';
comment on column painel."VW_VAGA_TESTE"."QT_VAGA" is 'Vagas de teste';
comment on column painel."VW_VAGA_TESTE"."DS_VAGA" is 'Texto de teste';

create view painel."VW_VAGA_SEM_COMENTARIO" as
  select edital as "CO_MONITORAMENTO", vaga as "CO_VAGA", qt as "QT_VAGA" from public.fonte_vaga;
comment on column painel."VW_VAGA_SEM_COMENTARIO"."QT_VAGA" is 'Visão sem comentário';

create view painel."VW_EDITAL_TESTE" as
  select edital as "CO_MONITORAMENTO", sum(qt)::integer as "QT_TOTAL", max(quando) as "DT_REGISTRO"
    from public.fonte_vaga group by edital;
comment on view painel."VW_EDITAL_TESTE" is 'Fonte de edital de teste';
comment on column painel."VW_EDITAL_TESTE"."QT_TOTAL" is 'Total de teste';
comment on column painel."VW_EDITAL_TESTE"."DT_REGISTRO" is 'Registro de teste';

create view public."VW_VAGA_FORA" as
  select edital as "CO_MONITORAMENTO", vaga as "CO_VAGA", qt as "QT_VAGA" from public.fonte_vaga;
comment on view public."VW_VAGA_FORA" is 'Fora do schema painel';
comment on column public."VW_VAGA_FORA"."QT_VAGA" is 'Fora';
`;

  const LINHAS_POR_VAGA = [
    {
      edital_id: EDITAL,
      codigo_vaga: "100",
      vagas_imediatas: 2,
      inscritos: 10,
      aprovados: 1,
    },
    {
      edital_id: EDITAL,
      codigo_vaga: "200",
      vagas_imediatas: null,
      inscritos: 20,
      aprovados: 0,
    },
    {
      edital_id: EDITAL,
      codigo_vaga: null,
      vagas_imediatas: 5,
      inscritos: 30,
      aprovados: null,
    },
    {
      edital_id: EDITAL_2,
      codigo_vaga: "100",
      vagas_imediatas: 4,
      inscritos: 40,
      aprovados: 2,
    },
  ];

  type Fonte = {
    padrao: boolean;
    visao: string | null;
    coluna: string | null;
    rotulo: string;
  };
  type Aplicado = {
    linhas: Record<string, unknown>[];
    fontes: Record<string, Fonte>;
    avisos: string[];
  };
  type Fontes = {
    pode_editar: boolean;
    colunas: {
      coluna: string;
      rotulo: string;
      tipo: string;
      padrao: string;
      escolha: { visao: string; coluna: string } | null;
      opcoes: {
        visao: string;
        rotulo: string;
        colunas: { coluna: string; rotulo: string }[];
      }[];
    }[];
    historico: {
      em: string;
      nome: string;
      coluna: string;
      antes: string;
      depois: string;
      motivo: string;
    }[];
  };

  let db: Banco;
  /*
  A primeira chamada monta o molde do banco (lenta com a suíte em carga):
  fica aqui, com prazo próprio, fora do prazo de 10 s do beforeEach.
*/
  beforeAll(() => bancoDosPaineis(), 60_000);
  beforeEach(async () => {
    db = await bancoDosPaineis();
    await db.exec(FONTES_DE_TESTE);
    await entrar(db, {
      uid: USUARIO_ADMIN,
      nivel: 3,
      areas: [SI, "sede", "projetos"],
    });
  }, LONGO);

  async function aplicar(area: string, relatorio: string, linhas: unknown[]) {
    const r = await uma<{ j: Aplicado }>(
      db,
      `select private."FC_APLICAR_FONTES_DO_PAINEL"($1, $2, $3::jsonb) as j`,
      [area, relatorio, JSON.stringify(linhas)],
    );
    return r!.j;
  }
  async function listar(area: string, relatorio: string) {
    const r = await uma<{ j: Fontes }>(
      db,
      `select public.listar_fontes_do_painel($1, $2) as j`,
      [area, relatorio],
    );
    return r!.j;
  }
  function salvar(
    area: string,
    relatorio: string,
    coluna: string,
    visao: string | null,
    colunaDaVisao: string | null,
    motivo = "Troca para conferir a fonte nova.",
  ) {
    return db.query<{ j: Fontes }>(
      `select public.salvar_fonte_da_coluna($1, $2, $3, $4, $5, $6) as j`,
      [area, relatorio, coluna, visao, colunaDaVisao, motivo],
    );
  }
  const coluna = (a: Aplicado, campo: string) => a.linhas.map((l) => l[campo]);

  describe("catálogo de fontes", () => {
    it("lista só visões do grão, com comentário e tipo compatível", async () => {
      const r = await db.query(
        `select * from private."FC_OPCOES_DE_FONTE_DO_PAINEL"('editais-por-cargo', 'vagas_imediatas')`,
      );
      expect(r.rows).toEqual([
        {
          no_visao: "VW_VAGA_TESTE",
          ds_rotulo_visao: "Fonte de teste",
          no_coluna: "QT_VAGA",
          ds_rotulo_coluna: "Vagas de teste",
        },
      ]);
      const datas = await db.query(
        `select no_visao, no_coluna from private."FC_OPCOES_DE_FONTE_DO_PAINEL"('resumo-dos-editais', 'data_divulgacao')`,
      );
      expect(datas.rows).toEqual([
        { no_visao: "VW_EDITAL_TESTE", no_coluna: "DT_REGISTRO" },
      ]);
      const nada = await db.query(
        `select * from private."FC_OPCOES_DE_FONTE_DO_PAINEL"('aprovados', 'status')`,
      );
      expect(nada.rows).toEqual([]);
    });

    it("as 11 colunas editáveis, com o grão de cada relatório", async () => {
      const r = await db.query<{
        co_relatorio: string;
        tp_grao: string;
        co_coluna: string;
        tp_coluna: string;
      }>(
        `select co_relatorio, tp_grao, co_coluna, tp_coluna from private."FC_COLUNAS_EDITAVEIS_DO_PAINEL"()`,
      );
      expect(
        r.rows.map(
          (c) => `${c.co_relatorio}/${c.tp_grao}/${c.co_coluna}/${c.tp_coluna}`,
        ),
      ).toEqual([
        "resumo-dos-editais/EDITAL/vagas_imediatas/inteiro",
        "resumo-dos-editais/EDITAL/data_divulgacao/data",
        "resumo-dos-editais/EDITAL/data_final/data",
        "editais-por-cargo/VAGA/vagas_imediatas/inteiro",
        "editais-por-cargo/VAGA/inscritos/inteiro",
        "editais-por-cargo/VAGA/aprovados/inteiro",
        "aprovados/APROVADO/nota/decimal",
        "aprovados/APROVADO/classificacao/inteiro",
        "aprovados/APROVADO/status/texto",
        "aprovados/APROVADO/matricula/texto",
        "aprovados/APROVADO/data_contratacao/data",
      ]);
    });

    it("o schema painel não é alcançável pela API", async () => {
      const r = await uma<{ anon: boolean; logado: boolean }>(
        db,
        `select has_schema_privilege('anon', 'painel', 'USAGE') as anon,
              has_schema_privilege('authenticated', 'painel', 'USAGE') as logado`,
      );
      expect(r).toEqual({ anon: false, logado: false });
    });
  });

  describe("aplicar as fontes", () => {
    it(
      "sem configuração, aplicar devolve as linhas iguais e fontes padrão",
      async () => {
        const a = await aplicar(SI, "editais-por-cargo", LINHAS_POR_VAGA);
        expect(a.linhas).toEqual(LINHAS_POR_VAGA);
        expect(a.avisos).toEqual([]);
        // jsonb guarda as chaves do objeto na ordem dele (mais curtas primeiro).
        expect(Object.keys(a.fontes).sort()).toEqual([
          "aprovados",
          "inscritos",
          "vagas_imediatas",
        ]);
        expect(a.fontes.vagas_imediatas).toEqual({
          padrao: true,
          visao: null,
          coluna: null,
          rotulo: expect.stringMatching(/^Padrão/),
        });
      },
      LONGO,
    );

    it(
      "troca só a coluna escolhida e só na área escolhida",
      async () => {
        await salvar(
          SI,
          "editais-por-cargo",
          "vagas_imediatas",
          "VW_VAGA_TESTE",
          "QT_VAGA",
        );
        const a = await aplicar(SI, "editais-por-cargo", LINHAS_POR_VAGA);
        expect(coluna(a, "vagas_imediatas")).toEqual([7, 3, null, null]);
        expect(coluna(a, "inscritos")).toEqual([10, 20, 30, 40]);
        expect(a.fontes.vagas_imediatas).toEqual({
          padrao: false,
          visao: "VW_VAGA_TESTE",
          coluna: "QT_VAGA",
          rotulo: "Fonte de teste › Vagas de teste",
        });
        expect(a.fontes.inscritos?.padrao).toBe(true);
      },
      LONGO,
    );

    it(
      "a escolha de uma área não muda a outra",
      async () => {
        await salvar(
          SI,
          "editais-por-cargo",
          "vagas_imediatas",
          "VW_VAGA_TESTE",
          "QT_VAGA",
        );
        const sede = await aplicar(
          "sede",
          "editais-por-cargo",
          LINHAS_POR_VAGA,
        );
        expect(sede.linhas).toEqual(LINHAS_POR_VAGA);
        expect(sede.fontes.vagas_imediatas?.padrao).toBe(true);
      },
      LONGO,
    );

    it(
      "chave repetida esvazia a célula e avisa",
      async () => {
        await salvar(
          SI,
          "editais-por-cargo",
          "vagas_imediatas",
          "VW_VAGA_TESTE",
          "QT_VAGA",
        );
        await db.exec(
          `insert into public.fonte_vaga values ('${EDITAL}', '100', 9, 'nove', null)`,
        );
        const a = await aplicar(SI, "editais-por-cargo", LINHAS_POR_VAGA);
        expect(a.linhas).toHaveLength(LINHAS_POR_VAGA.length);
        expect(coluna(a, "vagas_imediatas")).toEqual([null, 3, null, null]);
        expect(a.avisos).toEqual([
          expect.stringMatching(/1 chave repetida.*Vagas imediatas/),
        ]);
      },
      LONGO,
    );

    it(
      "recusa nome fora do catálogo",
      async () => {
        const forjada = 'VW_VAGA_TESTE"; drop table public.fonte_vaga; --';
        await db.query(
          `insert into public."TB_FONTE_COLUNA_PAINEL"
           ("CO_AREA", "CO_RELATORIO", "CO_COLUNA", "NO_VISAO", "NO_COLUNA_VISAO", "DS_MOTIVO", "CO_USUARIO_ATUALIZACAO")
         values ($1, 'editais-por-cargo', 'vagas_imediatas', $2, 'QT_VAGA', 'Linha forjada no teste.', $3),
                ($1, 'editais-por-cargo', 'inscritos', 'VW_VAGA_FORA', 'QT_VAGA', 'Visão fora do schema.', $3)`,
          [SI, forjada, USUARIO_ADMIN],
        );
        const a = await aplicar(SI, "editais-por-cargo", LINHAS_POR_VAGA);
        expect(coluna(a, "vagas_imediatas")).toEqual([null, null, null, null]);
        expect(coluna(a, "inscritos")).toEqual([null, null, null, null]);
        expect(a.avisos).toHaveLength(2);
        expect(a.avisos.every((t) => /não está disponível/.test(t))).toBe(true);
        expect(
          await uma(
            db,
            `select to_regclass('public.fonte_vaga') is not null as existe`,
          ),
        ).toEqual({
          existe: true,
        });
      },
      LONGO,
    );

    it(
      "fonte que sumiu deixa a coluna vazia e avisa",
      async () => {
        await salvar(
          SI,
          "editais-por-cargo",
          "vagas_imediatas",
          "VW_VAGA_TESTE",
          "QT_VAGA",
        );
        await db.exec(`drop view painel."VW_VAGA_TESTE"`);
        const a = await aplicar(SI, "editais-por-cargo", LINHAS_POR_VAGA);
        expect(coluna(a, "vagas_imediatas")).toEqual([null, null, null, null]);
        expect(a.avisos).toEqual([
          expect.stringMatching(/não está disponível/),
        ]);
      },
      LONGO,
    );

    it(
      "data timestamptz sai na data de Brasília",
      async () => {
        await salvar(
          SI,
          "resumo-dos-editais",
          "data_divulgacao",
          "VW_EDITAL_TESTE",
          "DT_REGISTRO",
        );
        const a = await aplicar(SI, "resumo-dos-editais", [
          { edital_id: EDITAL, data_divulgacao: "2026-01-01" },
        ]);
        expect(coluna(a, "data_divulgacao")).toEqual(["2026-11-12"]);
      },
      LONGO,
    );
  });

  describe("listar e salvar", () => {
    it(
      "salvar exige Administrador em Painéis e a área",
      async () => {
        await entrar(db, { uid: USUARIO_LEITOR, nivel: 1, areas: [SI] });
        expect(
          (
            await erroDe(
              salvar(
                SI,
                "editais-por-cargo",
                "vagas_imediatas",
                "VW_VAGA_TESTE",
                "QT_VAGA",
              ),
            )
          )?.codigo,
        ).toBe("42501");
        await entrar(db, { uid: USUARIO_ADMIN, nivel: 3, areas: ["sede"] });
        expect(
          (
            await erroDe(
              salvar(
                SI,
                "editais-por-cargo",
                "vagas_imediatas",
                "VW_VAGA_TESTE",
                "QT_VAGA",
              ),
            )
          )?.codigo,
        ).toBe("42501");
      },
      LONGO,
    );

    it(
      "salvar recusa coluna fixa, fonte fora das opções, motivo curto e troca sem mudança",
      async () => {
        const codigo = async (p: Promise<unknown>) => (await erroDe(p))?.codigo;
        expect(await codigo(salvar(SI, "aprovados", "nome", null, null))).toBe(
          "22023",
        );
        expect(
          await codigo(
            salvar(
              SI,
              "editais-por-cargo",
              "vagas_imediatas",
              "VW_VAGA_SEM_COMENTARIO",
              "QT_VAGA",
            ),
          ),
        ).toBe("22023");
        expect(
          await codigo(
            salvar(
              SI,
              "editais-por-cargo",
              "vagas_imediatas",
              "VW_VAGA_TESTE",
              "QT_VAGA",
              "ok",
            ),
          ),
        ).toBe("22023");
        expect(
          await codigo(
            salvar(SI, "editais-por-cargo", "vagas_imediatas", null, null),
          ),
        ).toBe("22023");
      },
      LONGO,
    );

    it(
      "salvar grava o histórico com o nome e p_visao nulo volta ao padrão",
      async () => {
        const salvo = (
          await salvar(
            SI,
            "editais-por-cargo",
            "vagas_imediatas",
            "VW_VAGA_TESTE",
            "QT_VAGA",
          )
        ).rows[0]!.j;
        const vagas = salvo.colunas.find(
          (c) => c.coluna === "vagas_imediatas",
        )!;
        expect(vagas.escolha).toEqual({
          visao: "VW_VAGA_TESTE",
          coluna: "QT_VAGA",
        });
        expect(salvo.historico[0]).toMatchObject({
          nome: "Pessoa Administradora",
          coluna: "Vagas imediatas (título da vaga)",
          antes: expect.stringMatching(/^Padrão/),
          depois: "Fonte de teste › Vagas de teste",
          motivo: "Troca para conferir a fonte nova.",
        });
        const voltou = (
          await salvar(
            SI,
            "editais-por-cargo",
            "vagas_imediatas",
            null,
            null,
            "Voltar ao padrão.",
          )
        ).rows[0]!.j;
        expect(
          voltou.colunas.find((c) => c.coluna === "vagas_imediatas")!.escolha,
        ).toBeNull();
        expect(voltou.historico).toHaveLength(2);
        expect(voltou.historico[0]!.depois).toMatch(/^Padrão/);
        const a = await aplicar(SI, "editais-por-cargo", LINHAS_POR_VAGA);
        expect(a.linhas).toEqual(LINHAS_POR_VAGA);
      },
      LONGO,
    );

    it(
      "listar mostra as opções a quem lê e só deixa editar o Administrador",
      async () => {
        await entrar(db, { uid: USUARIO_LEITOR, nivel: 1, areas: [SI] });
        const f = await listar(SI, "editais-por-cargo");
        expect(f.pode_editar).toBe(false);
        expect(f.colunas.map((c) => c.coluna)).toEqual([
          "vagas_imediatas",
          "inscritos",
          "aprovados",
        ]);
        expect(f.colunas[0]!.opcoes).toEqual([
          {
            visao: "VW_VAGA_TESTE",
            rotulo: "Fonte de teste",
            colunas: [{ coluna: "QT_VAGA", rotulo: "Vagas de teste" }],
          },
        ]);
        await entrar(db, { uid: USUARIO_LEITOR, nivel: 0, areas: [SI] });
        expect((await erroDe(listar(SI, "editais-por-cargo")))?.codigo).toBe(
          "42501",
        );
        await entrar(db, { uid: USUARIO_ADMIN, nivel: 3, areas: [SI] });
        expect((await listar(SI, "editais-por-cargo")).pode_editar).toBe(true);
        expect((await erroDe(listar(SI, "outro")))?.codigo).toBe("22023");
      },
      LONGO,
    );
  });
});

bloco("fontes-dos-paineis", () => {
  /*
  Fontes das colunas dos Painéis no front: a leitura tolerante do que as RPCs
  devolvem ("fontes" e "avisos" nos relatórios; o editor de fontes), quem pode
  trocar a fonte e a aba "Fontes" do XLSX. Dados fictícios.
*/

  describe("fontes na resposta do relatório", () => {
    it("lê a fonte de cada coluna e só os avisos de texto", () => {
      expect(
        lerFontesDoRelatorio({
          linhas: [],
          fontes: {
            vagas_imediatas: {
              padrao: false,
              visao: "VW_VAGA_CONVOCACAO",
              coluna: "QT_VAGA_IMEDIATA",
              rotulo: "Vagas da convocação › Vagas imediatas configuradas",
            },
            inscritos: {
              padrao: true,
              visao: null,
              coluna: null,
              rotulo: "Padrão: inscritos da Seleção",
            },
            estranha: "não é objeto",
          },
          avisos: ["A fonte sumiu.", 3, null],
        }),
      ).toEqual({
        fontes: {
          vagas_imediatas: {
            padrao: false,
            visao: "VW_VAGA_CONVOCACAO",
            coluna: "QT_VAGA_IMEDIATA",
            rotulo: "Vagas da convocação › Vagas imediatas configuradas",
          },
          inscritos: {
            padrao: true,
            visao: null,
            coluna: null,
            rotulo: "Padrão: inscritos da Seleção",
          },
        },
        avisos: ["A fonte sumiu."],
      });
    });

    it("resposta sem fontes (banco antigo ou estranha) vira vazio", () => {
      expect(lerFontesDoRelatorio({ linhas: [] })).toEqual({
        fontes: {},
        avisos: [],
      });
      expect(lerFontesDoRelatorio(null)).toEqual({ fontes: {}, avisos: [] });
    });
  });

  describe("o editor de fontes", () => {
    const RESPOSTA = {
      pode_editar: true,
      colunas: [
        {
          coluna: "vagas_imediatas",
          rotulo: "Vagas imediatas (título da vaga)",
          tipo: "inteiro",
          padrao: "Padrão: número no título da vaga",
          escolha: { visao: "VW_VAGA_CONVOCACAO", coluna: "QT_VAGA_IMEDIATA" },
          opcoes: [
            {
              visao: "VW_VAGA_CONVOCACAO",
              rotulo: "Vagas da convocação",
              colunas: [
                {
                  coluna: "QT_VAGA_IMEDIATA",
                  rotulo: "Vagas imediatas configuradas",
                },
              ],
            },
          ],
        },
        { coluna: "sem rótulo" },
      ],
      historico: [
        {
          em: "2026-11-13T15:00:00Z",
          nome: "Pessoa",
          coluna: "Vagas imediatas (título da vaga)",
          antes: "Padrão: número no título da vaga",
          depois: "Vagas da convocação › Vagas imediatas configuradas",
          motivo: "Conferência.",
        },
      ],
    };

    it("lê colunas, opções, escolha e histórico", () => {
      const f = lerFontesDoPainel(RESPOSTA);
      expect(f?.podeEditar).toBe(true);
      expect(f?.colunas).toHaveLength(1);
      expect(f?.colunas[0]).toEqual({
        coluna: "vagas_imediatas",
        rotulo: "Vagas imediatas (título da vaga)",
        tipo: "inteiro",
        padrao: "Padrão: número no título da vaga",
        escolha: { visao: "VW_VAGA_CONVOCACAO", coluna: "QT_VAGA_IMEDIATA" },
        opcoes: [
          {
            visao: "VW_VAGA_CONVOCACAO",
            rotulo: "Vagas da convocação",
            colunas: [
              {
                coluna: "QT_VAGA_IMEDIATA",
                rotulo: "Vagas imediatas configuradas",
              },
            ],
          },
        ],
      });
      expect(f?.historico[0]?.motivo).toBe("Conferência.");
    });

    it("sem pode_editar verdadeiro, só leitura; não objeto, nulo", () => {
      expect(
        lerFontesDoPainel({ ...RESPOSTA, pode_editar: "sim" })?.podeEditar,
      ).toBe(false);
      expect(lerFontesDoPainel("x")).toBeNull();
    });
  });

  describe("quem troca a fonte", () => {
    const perfil = (nivel: string) => ({
      id: "u1",
      ativo: true,
      permissoes: { paineis_dados: nivel },
    });
    it("só o Administrador em Painéis", () => {
      expect(canManagePaineisDeDados(perfil("admin"))).toBe(true);
      expect(canManagePaineisDeDados(perfil("editor"))).toBe(false);
      expect(canManagePaineisDeDados(perfil("leitor"))).toBe(false);
      expect(canManagePaineisDeDados({ id: "u1", ativo: true })).toBe(false);
    });
  });

  describe("a aba Fontes do XLSX", () => {
    const porCargo = definicaoDoRelatorio("editais-por-cargo");
    const linhas = linhasDoRelatorio(porCargo, [
      { edital: "39/2026", unidade: "DSEI Teste", codigo_vaga: "178962" },
    ]);
    const zipar: ZiparRelatorio = (arquivos, opcoes) =>
      zipSync(arquivos, opcoes);
    const quando = new Date("2026-11-13T15:00:00Z");

    it("com as fontes, a 2ª aba diz a fonte de cada coluna", () => {
      const arquivos = unzipSync(
        xlsxDoRelatorio(porCargo, linhas, zipar, quando, {
          vagas_imediatas: {
            padrao: false,
            visao: "VW_VAGA_CONVOCACAO",
            coluna: "QT_VAGA_IMEDIATA",
            rotulo: "Vagas da convocação › Vagas imediatas configuradas",
          },
        }),
      );
      expect(strFromU8(arquivos["xl/workbook.xml"]!)).toContain(
        'name="Fontes"',
      );
      const aba = strFromU8(arquivos["xl/worksheets/sheet2.xml"]!);
      expect(aba).toContain(
        "Vagas da convocação › Vagas imediatas configuradas",
      );
      expect(aba).toContain("Padrão");
    });

    it("sem as fontes, uma aba só", () => {
      const arquivos = unzipSync(
        xlsxDoRelatorio(porCargo, linhas, zipar, quando),
      );
      expect(arquivos["xl/worksheets/sheet2.xml"]).toBeUndefined();
    });
  });
});

bloco("historico-do-edital-sem-carimbo", () => {
  /*
  O gatilho do histórico do edital ignora o UPDATE que só muda o carimbo
  (migration 20261116234000, já aplicada), num Postgres de verdade (PGlite).

  O que é de verdade: public.fn_registrar_historico como está no retrato de
  produção (supabase/esquema-atual.sql) e o gatilho. O que é imitação:
  auth.uid() (lê teste.uid), auth.users e as colunas de
  TB_MONITORAMENTO_INDIGENA e TH_MONITORAMENTO que o gatilho usa.

  A limpeza dos registros só de carimbo já gravados (20261116235000) foi uma
  correção de dados de uso único, aplicada: o teste dela saiu com ela.
*/

  const LONGO = 60_000;
  const RETRATO = readFileSync("supabase/esquema-atual.sql", "utf8").replace(
    /\r\n/g,
    "\n",
  );

  const E1 = "eeeeeeee-0000-0000-0000-000000000001";
  const HUMANO = "11111111-1111-1111-1111-111111111111";

  /** O corpo vigente, do retrato de produção. */
  const funcaoDeHoje = () => {
    const inicio = RETRATO.indexOf(
      "CREATE FUNCTION public.fn_registrar_historico()",
    );
    if (inicio < 0) throw new Error("Sem fn_registrar_historico no retrato");
    return RETRATO.slice(inicio, RETRATO.indexOf("\n$$;", inicio) + 4);
  };

  async function montar() {
    const db = lembrarBanco(new PGlite());
    await db.exec(`
    create schema auth;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('teste.uid', true), '')::uuid $$;
    create table public."TB_MONITORAMENTO_INDIGENA" (
      id uuid primary key, ativo boolean not null default true, observacoes text,
      inscritos integer, updated_at timestamptz default now(), updated_by uuid,
      "DT_FONTE_FUNIL" timestamptz);
    create table public."TH_MONITORAMENTO" (
      id uuid primary key default gen_random_uuid(), id_registro uuid, usuario_id uuid,
      usuario_email text, evento text check (evento in ('criado', 'atualizado', 'desativado')),
      campo_alterado text, valor_anterior text, valor_novo text, snapshot_json jsonb,
      created_at timestamptz default now());
    insert into auth.users values ('${HUMANO}', 'pessoa@exemplo.org');
    ${funcaoDeHoje()}
    create trigger trg_historico_monitoramento after insert or update
      on public."TB_MONITORAMENTO_INDIGENA" for each row execute function fn_registrar_historico();
  `);
    return db;
  }
  const bancoDoHistorico = moldeDeBanco(montar);

  let db: PGlite;
  beforeAll(() => bancoDoHistorico(), LONGO);
  beforeEach(async () => {
    db = await bancoDoHistorico();
  }, LONGO);

  const contar = async (onde = "true") =>
    Number(
      (
        await db.query<{ n: number }>(
          `select count(*)::integer as n from public."TH_MONITORAMENTO" where ${onde}`,
        )
      ).rows[0]?.n,
    );

  describe("gatilho ignora a mudança só de carimbo (20261116234000)", () => {
    it(
      "o UPDATE só de carimbo não grava; a mudança de conteúdo e a desativação, sim",
      async () => {
        await db.exec(
          `insert into public."TB_MONITORAMENTO_INDIGENA" (id, inscritos) values ('${E1}', 10)`,
        );
        expect(await contar("evento = 'criado'")).toBe(1);
        await db.exec(`update public."TB_MONITORAMENTO_INDIGENA"
        set updated_at = clock_timestamp(), "DT_FONTE_FUNIL" = clock_timestamp(),
            updated_by = '${HUMANO}' where id = '${E1}'`);
        expect(await contar()).toBe(1);

        await db.exec(
          `update public."TB_MONITORAMENTO_INDIGENA" set inscritos = 11, updated_at = clock_timestamp() where id = '${E1}'`,
        );
        expect(await contar("evento = 'atualizado'")).toBe(1);
        expect(
          await contar(
            `evento = 'atualizado' and (snapshot_json ->> 'inscritos')::integer = 11`,
          ),
        ).toBe(1);

        await db.exec(`select set_config('teste.uid', '${HUMANO}', false)`);
        await db.exec(
          `update public."TB_MONITORAMENTO_INDIGENA" set ativo = false where id = '${E1}'`,
        );
        expect(
          await contar(
            `evento = 'desativado' and usuario_email = 'pessoa@exemplo.org'`,
          ),
        ).toBe(1);
      },
      LONGO,
    );
  });
});

bloco("lib/aprovados-por-edital", () => {
  const SEM = {
    tom: "aviso",
    texto: "Nenhum candidato foi aprovado neste edital",
  };

  describe("aprovados por edital", () => {
    it("conta os candidatos da lista vigente de cada edital", () => {
      const mapa = aprovadosPorEdital([
        { edital_id: "10", total_candidatos: 3 },
        { edital_id: "11", total_candidatos: "0" },
        { edital_id: "", total_candidatos: 5 },
      ]);
      expect(mapa.get("10")).toBe(3);
      expect(mapa.get("11")).toBe(0);
      expect(mapa.size).toBe(2);
    });

    it("resposta que não é lista vira mapa vazio", () => {
      expect(aprovadosPorEdital(null).size).toBe(0);
    });

    it("concluído sem lista ou com lista vazia: amarelo, sem aprovados", () => {
      const mapa = aprovadosPorEdital([
        { edital_id: "10", total_candidatos: 3 },
        { edital_id: "11", total_candidatos: 0 },
      ]);
      expect(avisoDaListaDoEdital(mapa, "10", "Concluído")).toBeNull();
      expect(avisoDaListaDoEdital(mapa, 11, "Concluído")).toEqual(SEM);
      expect(avisoDaListaDoEdital(mapa, "12", " CONCLUIDO ")).toEqual(SEM);
    });

    it("cancelado ou suspenso: vermelho, com o status na legenda", () => {
      const mapa = aprovadosPorEdital([
        { edital_id: "10", total_candidatos: 3 },
      ]);
      expect(avisoDaListaDoEdital(mapa, "10", "Cancelado")).toEqual({
        tom: "perigo",
        texto: "Edital cancelado",
      });
      expect(avisoDaListaDoEdital(null, "12", "Suspenso")).toEqual({
        tom: "perigo",
        texto: "Edital suspenso",
      });
    });

    it("edital ainda em curso nunca tem aviso", () => {
      const mapa = aprovadosPorEdital([]);
      expect(avisoDaListaDoEdital(mapa, "12", "Em andamento")).toBeNull();
      expect(avisoDaListaDoEdital(mapa, "12", "Planejado")).toBeNull();
    });

    it("concluído sem as listas carregadas: sem aviso", () => {
      expect(avisoDaListaDoEdital(null, "12", "Concluído")).toBeNull();
    });
  });
});

bloco("lib/pedido-sob-demanda", () => {
  /*
    O pedaço baixado sob demanda (editor de coordenadas, mascote, contornos
    do mapa): falhou uma vez, o próximo pedido baixa de novo; deu certo, não
    baixa mais.
  */
  it("esquece a promessa rejeitada e baixa de novo no próximo pedido", async () => {
    const modulo = { pronto: true };
    const importar = vi
      .fn<() => Promise<typeof modulo>>()
      .mockRejectedValueOnce(
        new TypeError("Failed to fetch dynamically imported module"),
      )
      .mockResolvedValue(modulo);
    const carregar = pedidoSobDemanda(importar);
    await expect(carregar()).rejects.toThrow("Failed to fetch");
    await expect(carregar()).resolves.toBe(modulo);
    await expect(carregar()).resolves.toBe(modulo);
    expect(importar).toHaveBeenCalledTimes(2);
  });

  it("pedidos ao mesmo tempo dividem um download só", async () => {
    const importar = vi.fn(async () => ({ pronto: true }));
    const carregar = pedidoSobDemanda(importar);
    const [a, b] = await Promise.all([carregar(), carregar()]);
    expect(a).toBe(b);
    expect(importar).toHaveBeenCalledTimes(1);
  });
});

bloco("lib/carga-continua", () => {
  /*
  O recorte das listas em blocos (agenda por dia, convocação por vaga,
  aprovados sem entrevista por vaga): até o limite de itens, cortando o grupo
  que passa dele. Desenhar tudo de uma vez travava a tela com milhares.
*/

  interface Grupo {
    chave: string;
    itens: number[];
  }

  const grupo = (chave: string, quantos: number): Grupo => ({
    chave,
    itens: Array.from({ length: quantos }, (_, i) => i),
  });
  const contar = (g: Grupo) => g.itens.length;
  const cortar = (g: Grupo, quantos: number) => ({
    ...g,
    itens: g.itens.slice(0, quantos),
  });

  describe("gruposAteOLimite", () => {
    it("50 por vez", () => {
      expect(ITENS_POR_VEZ).toBe(50);
    });

    it("devolve os grupos inteiros que cabem e corta o que passa do limite", () => {
      const grupos = [grupo("a", 30), grupo("b", 30), grupo("c", 30)];
      const recorte = gruposAteOLimite(grupos, 50, { contar, cortar });
      expect(recorte.grupos.map((g) => [g.chave, g.itens.length])).toEqual([
        ["a", 30],
        ["b", 20],
      ]);
      expect(recorte.mostrados).toBe(50);
      expect(recorte.total).toBe(90);
    });

    it("um grupo só com milhares desenha só o limite", () => {
      const recorte = gruposAteOLimite([grupo("a", 13_000)], 100, {
        contar,
        cortar,
      });
      expect(recorte.grupos[0]!.itens).toHaveLength(100);
      expect(recorte.mostrados).toBe(100);
      expect(recorte.total).toBe(13_000);
    });

    it("sem `cortar`, o grupo que passa do limite vem inteiro", () => {
      const grupos = [grupo("a", 40), grupo("b", 30), grupo("c", 5)];
      const recorte = gruposAteOLimite(grupos, 50, { contar });
      expect(recorte.grupos.map((g) => g.chave)).toEqual(["a", "b"]);
      expect(recorte.mostrados).toBe(70);
      expect(recorte.total).toBe(75);
    });

    it("grupo vazio conta como um (o cabeçalho dele aparece e entra na conta)", () => {
      const grupos = [grupo("a", 0), grupo("b", 2)];
      expect(totalDosGrupos(grupos, contar)).toBe(3);
      const recorte = gruposAteOLimite(grupos, 1, { contar, cortar });
      expect(recorte.grupos.map((g) => g.chave)).toEqual(["a"]);
      expect(recorte.total).toBe(3);
    });

    it("com o limite acima do total, tudo vem e nada é cortado", () => {
      const grupos = [grupo("a", 3), grupo("b", 4)];
      const recorte = gruposAteOLimite(grupos, 50, { contar, cortar });
      expect(recorte.grupos).toEqual(grupos);
      expect(recorte.mostrados).toBe(recorte.total);
    });
  });
});

bloco("lib/encerrados-do-cronograma", () => {
  it("lê a lista sem confiar na forma e descarta o que não tem id", () => {
    const lida = lerListaDosEncerrados({
      pode_concluir: true,
      editais: [
        {
          id: "e1",
          edital: "06/2099 (sanitarista)",
          numero: "6/2099",
          unidade: "DSEI Fictício",
          area: "saude-indigena",
          status: "Em andamento",
          fim: "2026-03-31",
          aviso: { id: "a1", tratamento: "EM_ANALISE", pode_dispensar: true },
          pendencias: [
            {
              conferencia: "CARGA_VARIACAO_BRUSCA",
              gravidade: "CRITICA",
              quantidade: 2,
            },
            { conferencia: "" },
          ],
        },
        { id: "", edital: "sem id" },
        null,
        { id: "e2", edital: "7/2099", aviso: null, pendencias: "x" },
      ],
    });
    expect(lida.podeConcluir).toBe(true);
    expect(lida.editais).toEqual([
      {
        id: "e1",
        edital: "06/2099 (sanitarista)",
        numero: "6/2099",
        unidade: "DSEI Fictício",
        area: "saude-indigena",
        status: "Em andamento",
        fim: "2026-03-31",
        aviso: { id: "a1", tratamento: "EM_ANALISE", podeDispensar: true },
        pendencias: [
          {
            conferencia: "CARGA_VARIACAO_BRUSCA",
            gravidade: "CRITICA",
            quantidade: 2,
          },
        ],
      },
      {
        id: "e2",
        edital: "7/2099",
        numero: "7/2099",
        unidade: "",
        area: "",
        status: "",
        fim: "",
        aviso: null,
        pendencias: [],
      },
    ]);
    expect(lerListaDosEncerrados(null)).toEqual({
      podeConcluir: false,
      editais: [],
    });
  });

  it("lê o resultado do lote e diz o que foi feito", () => {
    const resultado = lerResultadoDoLote({
      concluidos: [{ id: "e1", edital: "1/2099" }, { id: "e2" }, {}],
      recusados: [
        { id: "e3", edital: "3/2099", motivo: "O status já é Concluído" },
        { id: "e4" },
      ],
    });
    expect(resultado).toEqual({
      concluidos: [
        { id: "e1", edital: "1/2099" },
        { id: "e2", edital: "" },
      ],
      recusados: [
        { id: "e3", edital: "3/2099", motivo: "O status já é Concluído" },
        { id: "e4", edital: "", motivo: "Recusado" },
      ],
    });
    expect(textoDoResultado(resultado)).toBe(
      "2 editais marcados como concluídos · 2 recusados",
    );
    expect(
      textoDoResultado({
        concluidos: [{ id: "e1", edital: "" }],
        recusados: [],
      }),
    ).toBe("1 edital marcado como concluído");
  });

  it("o motivo segue a regra do banco: 10 a 500 caracteres, sem CPF nem e-mail", () => {
    expect(erroDoMotivoDoLote("  curto   ")).toMatch(/pelo menos 10/);
    expect(erroDoMotivoDoLote("x".repeat(501))).toMatch(/passa de 500/);
    expect(erroDoMotivoDoLote("falei com pessoa@teste.gov")).toMatch(
      /CPF nem e-mail/,
    );
    expect(erroDoMotivoDoLote("CPF 123.456.789-09 conferido")).toMatch(/CPF/);
    expect(erroDoMotivoDoLote("Conferido com a equipe em 19/11")).toBe("");
  });

  it("textos da entrada e da linha", () => {
    expect(rotuloDaEntradaDosEncerrados(1234)).toBe(
      "Cronograma encerrado (1.234)",
    );
    expect(dataDoFim("2026-03-31")).toBe("31/03/2026");
    expect(dataDoFim("")).toBe("");
    expect(rotuloDoEdital({ numero: "6/2099", unidade: "DSEI Fictício" })).toBe(
      "Edital 6/2099 · DSEI Fictício",
    );
  });

  it("tira da lista e da seleção os que saíram", () => {
    const e = (id: string) =>
      lerListaDosEncerrados({ editais: [{ id }] }).editais[0]!;
    const { editais, marcados } = semOsQueSairam(
      [e("a"), e("b"), e("c")],
      new Set(["a", "b"]),
      ["a"],
    );
    expect(editais.map((x) => x.id)).toEqual(["b", "c"]);
    expect([...marcados]).toEqual(["b"]);
    expect(
      escolhidosDaLista([e("a"), e("b"), e("c")], new Set(["c", "a"])).map(
        (x) => x.id,
      ),
    ).toEqual(["a", "c"]);
  });

  it("o histórico do cronograma reconhece o status marcado em lote", () => {
    const registros = historicoDoCronograma([
      {
        acao: "status",
        motivo: "Conferido com a equipe",
        created_at: "2026-11-19T12:00:00Z",
        created_by_email: "equipe@teste",
        total_alteracoes: 1,
      },
    ]);
    expect(registros[0]).toMatchObject({
      tipo: "status",
      titulo: "Status marcado como Concluído",
      alteracoes: 0,
    });
    expect(retificacoesDoHistorico([{ acao: "status" }]).retificacoes).toEqual(
      [],
    );
  });
});

bloco("lib/encerramento-do-edital", () => {
  /*
  Encerramento do edital: a leitura da RPC, a tela a mostrar (uma por vez, a
  mais antiga não vista), os selos e que fogos soltar.
*/

  const bruto = (parte = {}) => ({
    id: "e114",
    edital: "114/2026",
    numero: "114/2026",
    area: "projetos",
    concluido_em: "2026-10-22T18:00:00Z",
    inscritos: 7726,
    fichas: 1512,
    dias: 9,
    visto: false,
    minha: {
      fichas: 50,
      percentual: 3.3,
      melhor_dia: { dia: "2026-10-21", qt: 20 },
      fechou: false,
    },
    ...parte,
  });

  describe("leitura da RPC", () => {
    it("normaliza números, datas e a contribuição", () => {
      const [e] = lerEncerramentos({ editais: [bruto()] });
      expect(e).toEqual({
        id: "e114",
        edital: "114/2026",
        numero: "114/2026",
        area: "projetos",
        concluidoEm: "2026-10-22T18:00:00Z",
        inscritos: 7726,
        fichas: 1512,
        dias: 9,
        visto: false,
        minha: {
          fichas: 50,
          percentual: 3.3,
          melhorDia: { dia: "2026-10-21", qt: 20 },
          fechou: false,
        },
      });
    });

    it("resposta ruim vira lista vazia; descarta edital sem id, número ou ficha da pessoa", () => {
      expect(lerEncerramentos(null)).toEqual([]);
      expect(lerEncerramentos({ editais: "x" })).toEqual([]);
      expect(
        lerEncerramentos({
          editais: [
            bruto({ id: "" }),
            bruto({ numero: "", edital: "sem número" }),
            bruto({ minha: { fichas: 0 } }),
            null,
          ],
        }),
      ).toEqual([]);
    });

    it("sem percentual, calcula; nunca passa de 100% nem do total", () => {
      const [e] = lerEncerramentos({
        editais: [bruto({ fichas: 3, minha: { fichas: 9, percentual: null } })],
      });
      expect(e?.minha.fichas).toBe(3);
      expect(e?.minha.percentual).toBe(100);
      expect(e?.minha.melhorDia).toBeNull();
    });

    it("ordena pelo encerramento; mostra o mais antigo não visto", () => {
      const lista = lerEncerramentos({
        editais: [
          bruto({ id: "b", numero: "120/2026", concluido_em: "2026-11-02" }),
          bruto({ id: "a", visto: true, concluido_em: "2026-10-22" }),
          bruto({ id: "c", numero: "93/2026", concluido_em: "2026-10-30" }),
        ],
      });
      expect(lista.map((e) => e.id)).toEqual(["a", "c", "b"]);
      expect(encerramentoAMostrar(lista)?.id).toBe("c");
      expect(
        encerramentoAMostrar(lista.map((e) => ({ ...e, visto: true }))),
      ).toBeNull();
    });
  });

  describe("selos e quem fechou", () => {
    it("um selo por edital, genérico pelo número; quem fechou leva o título", () => {
      const lista = lerEncerramentos({
        editais: [
          bruto(),
          bruto({
            id: "e93",
            numero: "093/2026",
            concluido_em: "2026-10-23",
            minha: { fichas: 1, fechou: true },
          }),
        ],
      });
      expect(selosDoPerfil(lista)).toEqual([
        {
          id: "e114",
          numero: "114/2026",
          fechou: false,
          titulo: "Edital 114/2026: você analisou 50 fichas",
        },
        {
          id: "e93",
          numero: "93/2026",
          fechou: true,
          titulo: "Edital 93/2026: você fechou o 93",
        },
      ]);
      expect(numeroCurto("114/2026")).toBe("114");
      expect(tituloDeQuemFechou("114/2026")).toBe("fechou o 114");
    });
  });

  describe("fogos da tela", () => {
    const [comum] = lerEncerramentos({ editais: [bruto()] });
    const [fechou] = lerEncerramentos({
      editais: [bruto({ minha: { fichas: 2, fechou: true } })],
    });

    it("quem entra depois ganha os fogos do marco edital-concluido", () => {
      expect(fogosDoEncerramento(definido(comum), new Set())).toEqual({
        marco: "edital-concluido",
        forma: "coracao",
        texto: "Edital 114/2026 concluído.",
      });
    });

    it("quem viu o edital zerar na tela não ganha os fogos de novo", () => {
      expect(
        fogosDoEncerramento(definido(comum), new Set(["114/2026"])),
      ).toBeNull();
      expect(
        editaisDoEvento({ editais: ["114/2026", "Edital 114/2026", ""] }),
      ).toEqual(["114/2026"]);
      expect(editaisDoEvento(null)).toEqual([]);
    });

    it("quem fechou ganha a animação própria, mesmo depois dos fogos do marco", () => {
      expect(
        fogosDoEncerramento(definido(fechou), new Set(["114/2026"])),
      ).toEqual({
        marco: "edital-fechado",
        forma: "estrela",
        texto: "Você concluiu a última ficha do edital 114/2026.",
      });
    });

    it("formatos", () => {
      expect(formatarDia("2026-10-21")).toBe("21/10");
      expect(formatarDia("")).toBe("");
      expect(formatarPercentual(3.3)).toBe("3,3%");
      expect(formatarPercentual(100)).toBe("100%");
    });
  });
});

bloco("lib/funil-do-edital", () => {
  /*
  O funil do edital vem de uma fonte só (migration 20261022200000): a tela
  mostra de onde e de quando, e o campo que a fonte não tem como "—".
  E a regra única de qual entrevista vale (a mesma de FC_ENTREVISTAS_VIGENTES).
*/

  describe("funil do edital na tela", () => {
    const agora = new Date("2026-10-22T18:00:00Z");

    it("diz a fonte e a data dos dados", () => {
      expect(
        textoDaFonteDoFunil(
          { TP_FONTE_FUNIL: "SELECAO", DT_FONTE_FUNIL: "2026-10-16T11:10:14Z" },
          agora,
        ),
      ).toBe("Fonte: Seleção, em 16/10, 08:10");
      expect(
        textoDaFonteDoFunil(
          {
            TP_FONTE_FUNIL: "AVALIACAO_DOCUMENTAL",
            DT_FONTE_FUNIL: "2026-10-22T13:00:00Z",
          },
          agora,
        ),
      ).toBe("Fonte: Avaliação documental, às 10:00");
      expect(textoDaFonteDoFunil({ TP_FONTE_FUNIL: "ANALISES" }, agora)).toBe(
        "Fonte: Análises curriculares",
      );
    });

    it("sem fonte gravada (carga original), nada", () => {
      expect(textoDaFonteDoFunil({ TP_FONTE_FUNIL: null })).toBeNull();
      expect(textoDaFonteDoFunil(null)).toBeNull();
      expect(textoDaFonteDoFunil({ TP_FONTE_FUNIL: "OUTRA" })).toBeNull();
    });

    it("nulo é —, zero é 0", () => {
      expect(numeroDoFunil(null)).toBe("—");
      expect(numeroDoFunil(undefined)).toBe("—");
      expect(numeroDoFunil(0)).toBe("0");
      expect(numeroDoFunil(7726)).toBe("7.726");
    });
  });

  describe("qual entrevista vale (regra única)", () => {
    const planilha = {
      id: "a",
      parecer: "APTO",
      nota: 14,
      origem: "planilha",
      atualizadoEm: "2026-10-01T10:00:00Z",
    };
    const sistemaSemParecer = {
      id: "b",
      parecer: "SEM_PARECER",
      nota: null,
      origem: "sistema",
      atualizadoEm: "2026-10-22T10:00:00Z",
    };

    it("a de parecer vence a convocação nova do sistema", () => {
      expect(entrevistaVigente([sistemaSemParecer, planilha])).toBe(planilha);
    });

    it("com parecer nas duas, a do sistema; depois a mais recente; depois o maior id", () => {
      const sistema = { ...sistemaSemParecer, parecer: "INAPTO", nota: 9 };
      expect(entrevistaVigente([planilha, sistema])).toBe(sistema);
      const nova = {
        ...planilha,
        id: "c",
        atualizadoEm: "2026-10-02T10:00:00Z",
      };
      expect(entrevistaVigente([planilha, nova])).toBe(nova);
      const mesmaHora = { ...planilha, id: "z" };
      expect(entrevistaVigente([planilha, mesmaHora])).toBe(mesmaHora);
    });

    it("sem parecer, a que tem nota", () => {
      const comNota = {
        ...sistemaSemParecer,
        id: "n",
        origem: "planilha",
        nota: 10,
      };
      expect(compararEntrevistas(comNota, sistemaSemParecer)).toBeLessThan(0);
      expect(entrevistaVigente([])).toBeNull();
    });
  });
});

bloco("lib/numero-do-edital", () => {
  describe("número do edital", () => {
    it("o primeiro N/AAAA, sem zeros à esquerda (como FC_NUMERO_EDITAL)", () => {
      expect(numeroDoEdital("Edital 091/2026")).toBe("91/2026");
      expect(numeroDoEdital("Edital nº 091/2026 - Projetos")).toBe("91/2026");
      expect(numeroDoEdital("Edital 06/2026 (sanitarista)")).toBe("6/2026");
      expect(numeroDoEdital("114 / 2026")).toBe("114/2026");
    });

    it("sem número, vazio", () => {
      expect(numeroDoEdital("sem número")).toBe("");
      expect(numeroDoEdital(null)).toBe("");
      expect(numeroDoEdital(undefined)).toBe("");
      expect(numeroDoEdital({ edital: "93/2026" })).toBe("");
    });
  });
});

bloco("lib/ordem-dos-editais", () => {
  type Linha = LinhaParaOrdenar & { id: string };

  const LINHAS: Linha[] = [
    {
      id: "a",
      edital: "10/2025",
      data_inicio: "2025-03-01",
      unidade: "DSEI Xavante",
      status: "Concluído",
      etapa: "Resultado final",
      vagas_total: 40,
      contratados: 30,
      vagas_ociosas: 10,
      risco: "Baixo",
    },
    {
      id: "b",
      edital: "120/2026",
      data_inicio: "2026-08-10",
      unidade: "DSEI Alto Rio Purus",
      status: "Em andamento",
      etapa: "Entrevistas",
      vagas_total: 5,
      contratados: 0,
      vagas_ociosas: 5,
      risco: "Alto",
    },
    {
      id: "c",
      edital: "88/2026",
      data_inicio: "2026-02-15",
      unidade: "CASAI Brasília",
      status: "Cancelado",
      etapa: "",
      vagas_total: 12,
      contratados: 2,
      vagas_ociosas: 10,
      risco: "Médio",
    },
    // Sem data de início: vale o número do edital.
    {
      id: "d",
      edital: "9/2026",
      unidade: "dsei amapá",
      status: "Em andamento",
      etapa: "Análise",
      vagas_total: 5,
      contratados: 1,
      vagas_ociosas: 4,
      risco: "Baixo",
    },
  ];

  const ids = (ordem: OrdemDosEditais) =>
    ordenarEditais(LINHAS, ordem, (l) => l).map((l) => l.id);
  const por = (chave: ChaveDaOrdemDosEditais, sentido: "asc" | "desc") =>
    ids({ chave, sentido });

  describe("ordem da tabela de Editais", () => {
    it("o padrão é cronológico, do mais recente para o mais antigo", () => {
      expect(ids(ORDEM_PADRAO_DOS_EDITAIS)).toEqual(["b", "c", "a", "d"]);
    });

    it("Edital crescente: do mais antigo para o mais novo", () => {
      expect(por("edital", "asc")).toEqual(["a", "c", "b", "d"]);
    });

    it("sem data, ordena pelo ano e pelo número do edital", () => {
      const semData = LINHAS.map(({ data_inicio: _sem, ...resto }) => resto);
      const ordem = ordenarEditais(
        semData,
        ORDEM_PADRAO_DOS_EDITAIS,
        (l) => l,
      ).map((l) => l.id);
      expect(ordem).toEqual(["b", "c", "d", "a"]);
    });

    it("texto em ordem alfabética, sem caixa nem acento", () => {
      expect(por("unidade", "asc")).toEqual(["c", "b", "d", "a"]);
      expect(por("unidade", "desc")).toEqual(["a", "d", "b", "c"]);
    });

    it("número em ordem numérica; empate fica no mais recente primeiro", () => {
      expect(por("vagas", "asc")).toEqual(["b", "d", "c", "a"]);
      expect(por("ociosas", "desc")).toEqual(["c", "a", "b", "d"]);
    });

    it("risco pela gravidade", () => {
      expect(por("risco", "asc")).toEqual(["a", "d", "c", "b"]);
      expect(por("risco", "desc")).toEqual(["b", "c", "a", "d"]);
    });

    it("vazio fica no fim nos dois sentidos", () => {
      expect(por("etapa", "asc").at(-1)).toBe("c");
      expect(por("etapa", "desc").at(-1)).toBe("c");
    });

    it("1º clique crescente, 2º decrescente, e alterna; outra coluna recomeça", () => {
      let ordem = proximaOrdemDosEditais(ORDEM_PADRAO_DOS_EDITAIS, "vagas");
      expect(ordem).toEqual({ chave: "vagas", sentido: "asc" });
      ordem = proximaOrdemDosEditais(ordem, "vagas");
      expect(ordem).toEqual({ chave: "vagas", sentido: "desc" });
      ordem = proximaOrdemDosEditais(ordem, "vagas");
      expect(ordem).toEqual({ chave: "vagas", sentido: "asc" });
      expect(proximaOrdemDosEditais(ordem, "status")).toEqual({
        chave: "status",
        sentido: "asc",
      });
      // A coluna do padrão (Edital, decrescente) vai para crescente no clique.
      expect(
        proximaOrdemDosEditais(ORDEM_PADRAO_DOS_EDITAIS, "edital"),
      ).toEqual({
        chave: "edital",
        sentido: "asc",
      });
    });

    it("não muda a lista recebida", () => {
      const copia = [...LINHAS];
      ordenarEditais(LINHAS, { chave: "unidade", sentido: "asc" }, (l) => l);
      expect(LINHAS).toEqual(copia);
    });
  });
});

bloco("lib/rascunho-do-edital", () => {
  /* Rascunho do formulário do edital no navegador: chave, validade e falhas do armazenamento. */

  function armazenamentoFalso() {
    const dados = new Map<string, string>();
    return {
      getItem: (chave: string) => dados.get(chave) ?? null,
      setItem: (chave: string, valor: unknown) =>
        dados.set(chave, String(valor)),
      removeItem: (chave: string) => dados.delete(chave),
      dados,
    };
  }

  const HOJE = new Date(2026, 8, 28, 14, 32);

  describe("rascunho do edital", () => {
    it("a chave separa usuário, edital e, no edital novo, a área", () => {
      expect(chaveDoRascunho({ usuario: "u1", id: "7" })).toBe(
        "agsus_monitora_rascunho_edital_v1:u1:edital-7",
      );
      expect(chaveDoRascunho({ usuario: "u1", id: "", area: "sede" })).toBe(
        "agsus_monitora_rascunho_edital_v1:u1:novo-sede",
      );
      expect(usuarioDoPerfil({ user_id: "abc", email: "A@x" })).toBe("abc");
      expect(usuarioDoPerfil({ email: "Ana@Agsus" })).toBe("ana@agsus");
      expect(usuarioDoPerfil(null)).toBe("anonimo");
    });

    it("guarda, lê e apaga só o formulário e as partes editáveis do cronograma", () => {
      const armazenamento = armazenamentoFalso();
      guardarRascunho(
        "k",
        {
          formulario: { edital: "20/2026" },
          cronograma: { automatico: true, etapas: [], historico: [{}, {}, {}] },
        },
        HOJE,
        armazenamento,
      );
      const lido = lerRascunho("k", armazenamento, HOJE);
      expect(lido?.formulario).toEqual({ edital: "20/2026" });
      expect(lido?.cronograma.automatico).toBe(true);
      expect(lido?.cronograma).not.toHaveProperty("historico");
      apagarRascunho("k", armazenamento);
      expect(lerRascunho("k", armazenamento, HOJE)).toBeNull();
    });

    it("rascunho velho ou estragado é ignorado e apagado", () => {
      const armazenamento = armazenamentoFalso();
      guardarRascunho(
        "velho",
        { formulario: {}, cronograma: {} },
        new Date(2026, 7, 1),
        armazenamento,
      );
      expect(lerRascunho("velho", armazenamento, HOJE)).toBeNull();
      expect(armazenamento.dados.has("velho")).toBe(false);
      armazenamento.setItem("ruim", "{não é json");
      expect(lerRascunho("ruim", armazenamento, HOJE)).toBeNull();
    });

    it("armazenamento bloqueado não quebra nada", () => {
      const bloqueado = {
        getItem: () => {
          throw new Error("SecurityError");
        },
        setItem: () => {
          throw new Error("QuotaExceeded");
        },
        removeItem: () => {
          throw new Error("SecurityError");
        },
      };
      expect(lerRascunho("k", bloqueado, HOJE)).toBeNull();
      expect(
        guardarRascunho(
          "k",
          { formulario: {}, cronograma: {} },
          HOJE,
          bloqueado,
        ),
      ).toBe(false);
      expect(() => apagarRascunho("k", bloqueado)).not.toThrow();
    });

    it("enquanto o cronograma carrega, só o formulário conta como mudança", () => {
      const carregando = { carregando: true, etapas: [] };
      expect(estadoComparavel({ a: 1 }, carregando)).toBe(
        estadoComparavel({ a: 1 }, { carregando: true, etapas: [novaEtapa()] }),
      );
      expect(estadoComparavel({ a: 1 }, { etapas: [] })).not.toBe(
        estadoComparavel({ a: 1 }, { etapas: [novaEtapa()] }),
      );
    });

    it("a hora do rascunho: só a hora se foi hoje, com a data se foi antes", () => {
      expect(horaDoRascunho(new Date(2026, 8, 28, 9, 5), HOJE)).toBe("09:05");
      expect(horaDoRascunho(new Date(2026, 8, 27, 18, 0), HOJE)).toBe(
        "27/09 às 18:00",
      );
      expect(horaDoRascunho("lixo", HOJE)).toBe("");
    });
  });
});

bloco("pdf-depois-de-publicacao-nova", () => {
  /*
  Depois de uma publicação nova, a página que já estava aberta pede o arquivo
  antigo do jsPDF, que não existe mais. A ficha mostrava "Não foi possível
  gerar o PDF: Failed to fetch dynamically imported module:
  https://…/assets/jspdf.es.min-COHpUqfX.js" (relato de 10/11/2026). Agora
  `carregarBibliotecasDoPdf` passa a falha por `erroDeVersaoNova` e a tela diz
  o que fazer.
*/
  describe("PDF depois de uma publicação nova", () => {
    it("a falha de carregamento vira a frase de recarregar a página", () => {
      for (const mensagem of [
        "Failed to fetch dynamically imported module: https://x/assets/jspdf.es.min-COHpUqfX.js",
        "Importing a module script failed.",
        "error loading dynamically imported module",
      ]) {
        const original = new TypeError(mensagem);
        const traduzido = erroDeVersaoNova(original);
        expect(traduzido).toBeInstanceOf(Error);
        expect((traduzido as Error).message).toBe(MENSAGEM_DE_VERSAO_NOVA);
        expect((traduzido as Error).cause).toBe(original);
      }
    });

    it("outro erro passa igual", () => {
      const outro = new Error("Sem permissão");
      expect(erroDeVersaoNova(outro)).toBe(outro);
    });
  });
});

bloco("relatorios-dos-paineis-gravam-so-o-que-mudou", () => {
  type Banco = Banco__5;
  const uma = uma__6;
  /*
  Migration 20261116235500 (já aplicada; o SQL em tests/fixtures/sql-do-banco/)
  num Postgres de verdade (PGlite): o recálculo dos relatórios dos Painéis
  grava só a posição que mudou. As linhas guardadas depois do recálculo são as
  mesmas que o delete + insert de antes deixaria (o que o painel mostra não
  muda), e a linha igual não ganha versão nova (ctid igual). O cálculo é a imitação de tests/apoio/banco-dos-paineis.ts
  (lê public.linha_de_teste).
*/

  const LONGO = 60_000;
  const NOME =
    "20261116235500_relatorios_dos_paineis_gravam_so_o_que_mudou.sql";
  const ler = (caminho: string) =>
    readFileSync(caminho, "utf8").replace(/\r\n/g, "\n");
  const migration = () => ler(`tests/fixtures/sql-do-banco/${NOME}`);

  const SI = "saude-indigena";
  const REL = "editais-por-cargo";
  const A = "aaaaaaaa-0000-0000-0000-00000000000a";
  const B = "aaaaaaaa-0000-0000-0000-00000000000b";

  type Guardada = { n: number; edital: string; linha: Record<string, unknown> };

  let db: Banco;
  beforeAll(() => bancoComRelatoriosProntos(), 60_000);
  beforeEach(async () => {
    db = await bancoComRelatoriosProntos();
    // 10 linhas: as 5 primeiras do edital A, as outras do B.
    await db.query(
      `insert into public.linha_de_teste (area, relatorio, n, linha)
     select $1, $2, n, jsonb_build_object('edital_id', case when n <= 5 then $3 else $4 end, 'posicao', n)
       from generate_series(1, 10) n`,
      [SI, REL, A, B],
    );
  }, LONGO);

  const calcular = () =>
    db.query(
      `select private."FC_CALCULAR_RELATORIO_PAINEL"($1, $2, null, null)`,
      [SI, REL],
    );
  const guardadas = async () =>
    (
      await db.query<Guardada>(
        `select "NU_POSICAO" as n, "CO_MONITORAMENTO"::text as edital, "DS_LINHA" as linha
         from public."TB_LINHA_RELATORIO_PAINEL"
        where "CO_AREA" = $1 and "CO_RELATORIO" = $2 order by 1`,
        [SI, REL],
      )
    ).rows;
  const versoes = async () =>
    new Map(
      (
        await db.query<{ n: number; v: string }>(
          `select "NU_POSICAO" as n, ctid::text as v from public."TB_LINHA_RELATORIO_PAINEL"
          where "CO_AREA" = $1 and "CO_RELATORIO" = $2`,
          [SI, REL],
        )
      ).rows.map((r) => [r.n, r.v]),
    );
  /** O que o delete + insert de antes deixaria: as linhas de teste na ordem, de 1 em diante. */
  const esperado = async () =>
    (
      await db.query<Guardada>(
        `select (row_number() over (order by n))::integer as n, linha ->> 'edital_id' as edital, linha
         from public.linha_de_teste where area = $1 and relatorio = $2 order by n`,
        [SI, REL],
      )
    ).rows;

  describe("recálculo grava só o que mudou", () => {
    it(
      "sem mudança, nenhuma linha é regravada",
      async () => {
        await db.exec(migration());
        await calcular();
        const antes = await versoes();
        await calcular();
        expect(await versoes()).toEqual(antes);
        expect(await guardadas()).toEqual(await esperado());
      },
      LONGO,
    );

    it(
      "linha mudada, sumida e nova: o guardado é o cálculo, e só elas mudam",
      async () => {
        await db.exec(migration());
        await calcular();
        const antes = await versoes();
        await db.query(
          `update public.linha_de_teste set linha = linha || '{"inscritos": 3}' where n = 3`,
        );
        await db.query(`delete from public.linha_de_teste where n = 6`);
        await calcular();
        // Sem a 6, as posições 6 a 9 recebem as linhas 7 a 10 e a posição 10 sai.
        expect(await guardadas()).toEqual(await esperado());
        const depois = await versoes();
        expect(depois.size).toBe(9);
        const mudaram = [...depois].filter(([n, v]) => antes.get(n) !== v);
        expect(mudaram.map(([n]) => n)).toEqual([3, 6, 7, 8, 9]);

        await db.query(
          `insert into public.linha_de_teste values ($1, $2, 11, jsonb_build_object('edital_id', $3::text, 'posicao', 11))`,
          [SI, REL, A],
        );
        await calcular();
        expect(await guardadas()).toEqual(await esperado());
        expect((await versoes()).size).toBe(10);
      },
      LONGO,
    );

    it(
      "relatório que fica vazio perde todas as linhas",
      async () => {
        await db.exec(migration());
        await calcular();
        await db.query(`delete from public.linha_de_teste`);
        await calcular();
        expect(await guardadas()).toEqual([]);
        expect(
          await uma(
            db,
            `select "QT_LINHA" as qt from public."TB_CALCULO_RELATORIO_PAINEL"
            where "CO_AREA" = $1 and "CO_RELATORIO" = $2`,
            [SI, REL],
          ),
        ).toEqual({ qt: 0 });
      },
      LONGO,
    );
  });
});

bloco("relatorios-dos-paineis", () => {
  /*
  Os relatórios dos Painéis (bloco Dados): as colunas pedidas, a leitura da
  resposta das RPCs, o texto da tela e os arquivos CSV e XLSX. Dados fictícios.
*/

  const resumo = definicaoDoRelatorio("resumo-dos-editais");
  const porCargo = definicaoDoRelatorio("editais-por-cargo");
  const aprovados = definicaoDoRelatorio("aprovados");
  const zipar: ZiparRelatorio = (arquivos, opcoes) => zipSync(arquivos, opcoes);

  describe("as colunas de cada relatório", () => {
    it("são as três seções, na ordem pedida", () => {
      expect(RELATORIOS_DOS_PAINEIS.map((r) => r.rotulo)).toEqual([
        "Resumo dos editais",
        "Editais por cargo",
        "Aprovados",
      ]);
    });

    it("Resumo dos editais: número, DSEI, vagas imediatas e as duas datas", () => {
      expect(resumo.colunas.map((c) => c.rotulo)).toEqual([
        "Número do edital",
        "DSEI / Unidade",
        "Total de vagas imediatas",
        "Data da divulgação do edital",
        "Data final do processo seletivo",
      ]);
    });

    it("Editais por cargo: uma linha por vaga, com o código dela", () => {
      expect(porCargo.colunas.map((c) => c.campo)).toEqual([
        "edital",
        "unidade",
        "codigo_vaga",
        "cargo",
        "vagas_imediatas",
        "inscritos",
        "aprovados",
      ]);
    });

    it("Aprovados: a data de admissão diz que é o registro no sistema", () => {
      expect(aprovados.colunas.map((c) => c.rotulo)).toEqual([
        "Edital",
        "DSEI / Unidade",
        "Cargo da vaga",
        "Nota",
        "Classificação",
        "Nome",
        "Status",
        "Matrícula",
        "Data de admissão (registro no sistema)",
      ]);
    });

    it("id desconhecido cai no primeiro relatório", () => {
      expect(definicaoDoRelatorio("outro").id).toBe("resumo-dos-editais");
    });
  });

  describe("leitura da resposta", () => {
    it("tipa cada campo e deixa nulo o que falta", () => {
      const linhas = linhasDoRelatorio(aprovados, {
        gerado_em: "2026-11-13T15:00:00Z",
        linhas: [
          {
            edital: " 39/2026 ",
            unidade: "DSEI Teste",
            cargo: "Enfermeiro",
            nota: "87.5",
            classificacao: 2,
            nome: "Pessoa Fictícia",
            status: "Contratado",
            matricula: 12345,
            data_contratacao: "2026-10-01",
          },
          { nome: "Sem nota", nota: "", data_contratacao: "ontem" },
          "não é linha",
          null,
        ],
      });
      expect(linhas).toEqual([
        {
          edital: "39/2026",
          unidade: "DSEI Teste",
          cargo: "Enfermeiro",
          nota: 87.5,
          classificacao: 2,
          nome: "Pessoa Fictícia",
          status: "Contratado",
          matricula: "12345",
          data_contratacao: "2026-10-01",
        },
        {
          edital: null,
          unidade: null,
          cargo: null,
          nota: null,
          classificacao: null,
          nome: "Sem nota",
          status: null,
          matricula: null,
          data_contratacao: null,
        },
      ]);
    });

    it("resposta estranha vira lista vazia", () => {
      expect(linhasDoRelatorio(resumo, null)).toEqual([]);
      expect(linhasDoRelatorio(resumo, { linhas: "x" })).toEqual([]);
      expect(linhasDoRelatorio(resumo, [{ edital: "1/2026" }])).toHaveLength(1);
    });

    it("lê a página: linhas, total, página, tamanho e data do cálculo", () => {
      expect(
        lerPaginaDoRelatorio(resumo, {
          calculado_em: "2026-11-13T15:00:00Z",
          total: 120,
          pagina: 2,
          por_pagina: 50,
          linhas: [{ edital: "51/2026" }],
        }),
      ).toEqual({
        linhas: [expect.objectContaining({ edital: "51/2026" })],
        total: 120,
        pagina: 2,
        porPagina: 50,
        calculadoEm: "2026-11-13T15:00:00Z",
      });
    });

    it("a página tolera resposta vazia ou estranha", () => {
      expect(lerPaginaDoRelatorio(resumo, null)).toEqual({
        linhas: [],
        total: 0,
        pagina: 1,
        porPagina: null,
        calculadoEm: null,
      });
      expect(
        lerPaginaDoRelatorio(resumo, {
          calculado_em: "x",
          total: "dez",
          pagina: -3,
          linhas: [{ edital: "1/2026" }],
        }),
      ).toMatchObject({ total: 1, pagina: 1, calculadoEm: null });
    });

    it("a chave da página junta área, relatório, página e tamanho", () => {
      expect(chaveDaPagina("sede", "aprovados", 2, 25)).toBe(
        "sede|aprovados|2|25",
      );
    });
  });

  describe("largura das colunas", () => {
    it("arrastar soma o deslocamento, arredonda e não passa de 60 px para baixo", () => {
      expect(larguraArrastada(120, -100)).toBe(60);
      expect(larguraArrastada(120, 35.6)).toBe(156);
    });
  });

  describe("origem dos dados", () => {
    it("sem fonte trocada, só o texto fixo do relatório", () => {
      expect(linhasDaOrigem(porCargo, {})).toEqual([
        "Uma linha por vaga. Vaga, cargo e inscritos: Seleção (planilha da Auditoria, aba Resultado). Aprovados: lista de aprovados vigente, casada pelo código da vaga. Vagas imediatas: quadro de vagas do edital; sem ele, a convocação da Lista de aprovados, o local da vaga publicado no edital ou o número no título da vaga. Vagas que só estão na lista e editais sem Seleção também aparecem.",
      ]);
    });

    it("com fonte trocada na área, uma linha por coluna fora do padrão", () => {
      expect(
        linhasDaOrigem(porCargo, {
          vagas_imediatas: {
            padrao: false,
            visao: "VW_EDITAL_QUADRO_DE_VAGAS",
            coluna: "QT_VAGA_IMEDIATA",
            rotulo:
              "Quadro de vagas do edital › Vagas imediatas (soma do quadro)",
          },
          inscritos: {
            padrao: true,
            visao: null,
            coluna: null,
            rotulo: "Padrão",
          },
        })[1],
      ).toBe(
        "Fonte trocada nesta área: Vagas imediatas → Quadro de vagas do edital › Vagas imediatas (soma do quadro)",
      );
    });
  });

  describe("texto da célula", () => {
    const [, , vagas, divulgacao] = resumo.colunas;
    const nota = aprovados.colunas[3]!;

    it("número em pt-BR, data dd/mm/aaaa e vazio como travessão", () => {
      expect(textoDaCelula(vagas!, 1200)).toBe("1.200");
      expect(textoDaCelula(nota, 87.25)).toBe("87,25");
      expect(textoDaCelula(divulgacao!, "2026-03-05")).toBe("05/03/2026");
      expect(textoDaCelula(vagas!, null)).toBe("—");
    });
  });

  describe("arquivos", () => {
    const linhas = linhasDoRelatorio(porCargo, [
      {
        edital: "39/2026",
        unidade: "DSEI Teste",
        codigo_vaga: "178962",
        cargo: "=CMD()",
        vagas_imediatas: 3,
        inscritos: 120,
        aprovados: null,
      },
    ]);

    it("PDF: a mesma tabela do arquivo, com o texto como veio", () => {
      const { colunas, linhas: tabela } = tabelaDoRelatorio(porCargo, linhas);
      expect(colunas).toEqual([
        "Número do edital",
        "DSEI / Unidade",
        "Código da vaga",
        "Cargo",
        "Vagas imediatas",
        "Total de inscritos",
        "Total de aprovados",
      ]);
      expect(tabela).toEqual([
        ["39/2026", "DSEI Teste", "178962", "=CMD()", 3, 120, ""],
      ]);
    });

    it("PDF: data dd/mm/aaaa e número como número", () => {
      const { linhas: tabela } = tabelaDoRelatorio(
        aprovados,
        linhasDoRelatorio(aprovados, [
          { nota: 87.5, nome: "A; B", data_contratacao: "2026-10-01" },
        ]),
      );
      expect(tabela[0]).toContain(87.5);
      expect(tabela[0]).toContain("A; B");
      expect(tabela[0]).toContain("01/10/2026");
    });

    it("XLSX: uma aba com o nome do relatório, cabeçalho e números", () => {
      const planilha = planilhaDoRelatorio(porCargo, linhas);
      expect(planilha.nome).toBe("Editais por cargo");
      expect(planilha.filtro).toBe(true);
      expect(planilha.linhas[1]).toEqual([
        "39/2026",
        "DSEI Teste",
        "178962",
        "=CMD()",
        3,
        120,
        "",
      ]);
      const arquivos = unzipSync(
        xlsxDoRelatorio(
          porCargo,
          linhas,
          zipar,
          new Date("2026-11-13T15:00:00Z"),
        ),
      );
      expect(Object.keys(arquivos)).toContain("xl/worksheets/sheet1.xml");
      expect(strFromU8(arquivos["xl/workbook.xml"]!)).toContain(
        'name="Editais por cargo"',
      );
    });

    it("nome do arquivo: relatório, área e a hora de Brasília", () => {
      expect(
        nomeDoArquivoDoRelatorio(
          aprovados,
          "saude-indigena",
          "XLSX",
          new Date("2026-11-13T15:04:00Z"),
        ),
      ).toBe("aprovados-saude-indigena-2026-11-13-1204.xlsx");
    });
  });

  describe("paginação", () => {
    it("recorta a lista em páginas", () => {
      expect(paginaDaTabela(120, 1, 50)).toEqual({
        pagina: 1,
        paginas: 3,
        inicio: 0,
        fim: 50,
        total: 120,
      });
      expect(paginaDaTabela(120, 3, 50)).toMatchObject({
        inicio: 100,
        fim: 120,
      });
    });

    it("página fora do intervalo volta para a que existe", () => {
      expect(paginaDaTabela(120, 9, 50).pagina).toBe(3);
      expect(paginaDaTabela(120, 0, 50).pagina).toBe(1);
      expect(paginaDaTabela(0, 4, 50)).toEqual({
        pagina: 1,
        paginas: 1,
        inicio: 0,
        fim: 0,
        total: 0,
      });
    });

    it("tamanho inválido vale o padrão (50)", () => {
      expect(paginaDaTabela(120, 1, 0)).toMatchObject({ paginas: 3, fim: 50 });
    });
  });
});

bloco("relatorios-prontos-dos-paineis-no-banco", () => {
  type Banco = Banco__7;
  const entrar = entrar__8;
  const erroDe = erroDe__9;
  const uma = uma__10;
  /*
  Relatórios prontos dos Painéis (migration 20261116160000, já aplicada; o SQL
  em tests/fixtures/sql-do-banco/) num Postgres de verdade (PGlite): o resultado calculado fica guardado por área e relatório,
  a leitura pagina e aplica o recorte da coordenação, o Sincronizar recalcula
  no máximo uma vez por minuto, a troca de fonte recalcula na mesma transação
  e o cálculo de todos (o cron de hora em hora) segue quando um falha. O
  cálculo em si é imitado (as tabelas dos editais não existem aqui).
*/

  const LONGO = 60_000;
  const SI = "saude-indigena";
  const A = "aaaaaaaa-0000-0000-0000-00000000000a";
  const B = "aaaaaaaa-0000-0000-0000-00000000000b";
  const C = "aaaaaaaa-0000-0000-0000-00000000000c";
  const POR_CARGO = "editais-por-cargo";

  const FONTE_DE_TESTE = `
create table public.fonte_vaga (edital uuid, vaga text, qt integer);
insert into public.fonte_vaga values ('${A}', '1', 7);
create view painel."VW_VAGA_TESTE" as
  select edital as "CO_MONITORAMENTO", vaga as "CO_VAGA", qt as "QT_VAGA" from public.fonte_vaga;
comment on view painel."VW_VAGA_TESTE" is 'Fonte de teste';
comment on column painel."VW_VAGA_TESTE"."QT_VAGA" is 'Vagas de teste';
`;

  type Pagina = {
    schema_version: number;
    calculado_em: string;
    total: number;
    pagina: number;
    por_pagina: number | null;
    linhas: { edital_id: string; posicao: number }[];
    fontes: Record<string, { padrao: boolean }>;
    avisos: string[];
  };

  let db: Banco;
  /*
  A primeira chamada monta o molde do banco (lenta com a suíte em carga):
  fica aqui, com prazo próprio, fora do prazo de 10 s do beforeEach.
*/
  beforeAll(() => bancoComRelatoriosProntos(), 60_000);
  beforeEach(async () => {
    db = await bancoComRelatoriosProntos();
    await db.exec(FONTE_DE_TESTE);
    // 120 linhas em Editais por cargo da Saúde indígena: 40 de cada edital, na ordem A, B, C.
    await db.query(
      `insert into public.linha_de_teste (area, relatorio, n, linha)
     select $1, $2, n, jsonb_build_object(
              'edital_id', (array[$3, $4, $5])[(n - 1) / 40 + 1],
              'codigo_vaga', n::text, 'vagas_imediatas', n, 'inscritos', 0, 'aprovados', 0,
              'posicao', n)
       from generate_series(1, 120) n`,
      [SI, POR_CARGO, A, B, C],
    );
    await entrar(db, {
      uid: USUARIO_ADMIN,
      nivel: 3,
      areas: [SI, "sede", "projetos"],
    });
  }, LONGO);

  async function ler(pagina: number | null, porPagina: number | null) {
    const r = await uma<{ j: Pagina }>(
      db,
      `select public.ler_relatorio_do_painel($1, $2, $3, $4) as j`,
      [SI, POR_CARGO, pagina, porPagina],
    );
    return r!.j;
  }
  async function sincronizar() {
    const r = await uma<{ j: { calculado_em: string; recalculado: boolean } }>(
      db,
      `select public.sincronizar_relatorio_do_painel($1, $2) as j`,
      [SI, POR_CARGO],
    );
    return r!.j;
  }
  const envelhecer = () =>
    db.exec(
      `update public."TB_CALCULO_RELATORIO_PAINEL" set "DT_CALCULO" = "DT_CALCULO" - interval '2 minutes'`,
    );

  describe("leitura paginada", () => {
    it(
      "lê a página pedida, na ordem do cálculo, com o total",
      async () => {
        const p = await ler(2, 50);
        expect(p.schema_version).toBe(4);
        expect(p.linhas).toHaveLength(50);
        expect(p.linhas[0]?.posicao).toBe(51);
        expect(p.total).toBe(120);
        expect(p.pagina).toBe(2);
        expect(p.por_pagina).toBe(50);
        expect(p.calculado_em).toEqual(expect.any(String));
      },
      LONGO,
    );

    it(
      "sem tamanho de página, devolve todas as linhas",
      async () => {
        const p = await ler(1, null);
        expect(p.linhas).toHaveLength(120);
        expect(p.por_pagina).toBeNull();
      },
      LONGO,
    );

    it(
      "tamanho de página fora de 25/50/100 é recusado",
      async () => {
        expect((await erroDe(ler(1, 10)))?.codigo).toBe("22023");
      },
      LONGO,
    );

    it(
      "o recorte da coordenação vale na página, no total e no download",
      async () => {
        await entrar(db, {
          uid: USUARIO_ADMIN,
          nivel: 3,
          areas: [SI],
          editais: [A],
        });
        const p = await ler(1, 50);
        expect(p.total).toBe(40);
        expect(p.linhas.every((l) => l.edital_id === A)).toBe(true);
        const tudo = await ler(1, null);
        expect(tudo.linhas).toHaveLength(40);
        expect(tudo.linhas.every((l) => l.edital_id === A)).toBe(true);
      },
      LONGO,
    );

    it(
      "página além da última volta para a última",
      async () => {
        const p = await ler(9, 50);
        expect(p.pagina).toBe(3);
        expect(p.linhas).toHaveLength(20);
      },
      LONGO,
    );

    it(
      "sem cálculo, a primeira leitura calcula",
      async () => {
        expect(
          await uma(
            db,
            `select count(*)::int as n from public."TB_CALCULO_RELATORIO_PAINEL"`,
          ),
        ).toEqual({ n: 0 });
        expect((await ler(1, 50)).total).toBe(120);
        expect(
          await uma(
            db,
            `select "QT_LINHA" as n from public."TB_CALCULO_RELATORIO_PAINEL"
            where "CO_AREA" = $1 and "CO_RELATORIO" = $2`,
            [SI, POR_CARGO],
          ),
        ).toEqual({ n: 120 });
      },
      LONGO,
    );

    it(
      "sem acesso à área, leitura e sincronizar são recusados",
      async () => {
        await entrar(db, { uid: USUARIO_ADMIN, nivel: 0, areas: [SI] });
        expect((await erroDe(ler(1, 50)))?.codigo).toBe("42501");
        expect((await erroDe(sincronizar()))?.codigo).toBe("42501");
      },
      LONGO,
    );

    it(
      "a API não lê as tabelas prontas",
      async () => {
        await ler(1, 50);
        await db.exec("set role authenticated");
        const erro = await erroDe(
          db.query(`select count(*) from public."TB_LINHA_RELATORIO_PAINEL"`),
        );
        await db.exec("reset role");
        expect(erro?.codigo).toBe("42501");
      },
      LONGO,
    );
  });

  describe("recálculo", () => {
    it(
      "sincronizar recalcula, mas não duas vezes no mesmo minuto",
      async () => {
        await ler(1, 50);
        await db.exec(
          `insert into public.linha_de_teste values ('${SI}', '${POR_CARGO}', 121,
           jsonb_build_object('edital_id', '${C}', 'posicao', 121))`,
        );
        expect((await ler(1, 50)).total).toBe(120);
        await envelhecer();
        expect((await sincronizar()).recalculado).toBe(true);
        expect((await ler(1, 50)).total).toBe(121);
        expect((await sincronizar()).recalculado).toBe(false);
        await envelhecer();
        expect((await sincronizar()).recalculado).toBe(true);
      },
      LONGO,
    );

    it(
      "troca de fonte recalcula na mesma transação",
      async () => {
        await db.query(
          `select public.salvar_fonte_da_coluna($1, $2, 'vagas_imediatas', 'VW_VAGA_TESTE', 'QT_VAGA', 'Conferir a fonte nova.')`,
          [SI, POR_CARGO],
        );
        expect(
          await uma(
            db,
            `select "DS_FONTES" -> 'vagas_imediatas' ->> 'padrao' as padrao
             from public."TB_CALCULO_RELATORIO_PAINEL" where "CO_AREA" = $1 and "CO_RELATORIO" = $2`,
            [SI, POR_CARGO],
          ),
        ).toEqual({ padrao: "false" });
        expect((await ler(1, 50)).fontes.vagas_imediatas?.padrao).toBe(false);
      },
      LONGO,
    );

    it(
      "troca de fonte com recálculo que falha é desfeita",
      async () => {
        await db.query(`select set_config('teste.falhar', $1, false)`, [SI]);
        const erro = await erroDe(
          db.query(
            `select public.salvar_fonte_da_coluna($1, $2, 'vagas_imediatas', 'VW_VAGA_TESTE', 'QT_VAGA', 'Conferir a fonte nova.')`,
            [SI, POR_CARGO],
          ),
        );
        expect(erro?.mensagem).toContain("Falha de teste");
        expect(
          await uma(
            db,
            `select (select count(*) from public."TB_FONTE_COLUNA_PAINEL")::int as escolhas,
                  (select count(*) from public."TH_FONTE_COLUNA_PAINEL")::int as historico`,
          ),
        ).toEqual({ escolhas: 0, historico: 0 });
      },
      LONGO,
    );

    it(
      "o cálculo de todos segue quando um falha",
      async () => {
        await db.query(`select set_config('teste.falhar', 'sede', false)`);
        expect(
          await uma(db, `select private."FC_CALCULAR_PAINEIS"() as n`),
        ).toEqual({ n: 6 });
        expect(
          await uma(
            db,
            `select count(*) filter (where "CO_AREA" = 'sede')::int as sede,
                  count(*)::int as todos
             from public."TB_CALCULO_RELATORIO_PAINEL"`,
          ),
        ).toEqual({ sede: 0, todos: 6 });
      },
      LONGO,
    );
  });

  describe("limites de tempo (20261116170000)", () => {
    const RPCS = [
      "public.ler_relatorio_do_painel(text, text, integer, integer)",
      "public.sincronizar_relatorio_do_painel(text, text)",
      "public.salvar_fonte_da_coluna(text, text, text, text, text, text)",
    ];
    const config = (assinatura: string) =>
      uma<{ c: string[] | null }>(
        db,
        `select proconfig as c from pg_proc where oid = to_regprocedure($1)`,
        [assinatura],
      );

    it(
      "as RPCs que recalculam esperam o cron e calculam sem cair no limite do papel",
      async () => {
        for (const rpc of RPCS)
          expect((await config(rpc))?.c).toEqual(
            expect.arrayContaining([
              "statement_timeout=30s",
              "lock_timeout=15s",
            ]),
          );
      },
      LONGO,
    );

    it(
      "o rollback tira os limites e mantém o resto",
      async () => {
        await db.exec(rollbackDosLimites());
        for (const rpc of RPCS)
          expect((await config(rpc))?.c ?? []).toEqual(['search_path=""']);
        const erro = await erroDe(db.exec(rollbackDosLimites()));
        await db.exec("rollback");
        expect(erro?.mensagem).toMatch(/não está aplicada/);
      },
      LONGO,
    );
  });
});

bloco("vagas-imediatas-dos-paineis-no-banco", () => {
  type Banco = Banco__11;
  const uma = uma__12;
  /*
  Vagas imediatas de Painéis › Editais por cargo (migration 20261116180000, já
  aplicada; o SQL em tests/fixtures/sql-do-banco/) num Postgres de verdade
  (PGlite), com o cálculo de verdade
  (private."FC_LINHAS_POR_CARGO_DO_PAINEL") lendo tabelas mínimas dos editais,
  da Seleção, do quadro de vagas, da convocação e dos locais das vagas.

  A ordem: quadro de vagas do edital (ligado pelo nome da vaga) > convocação
  (vaga ou padrão do edital, abaixo de 10000) > local da vaga (um só casa com
  o cargo) > número no título da vaga ("Cadastro Reserva" = 0).

  Imitação: private."FC_QUADRO_DA_VAGA" (a ligação de verdade compara
  palavras do cargo e da lotação) liga a vaga à linha do quadro cujo cargo
  aparece no nome da vaga, quando só uma aparece.
*/

  const LONGO = 60_000;
  const SI = "saude-indigena";
  const NOME = "20261116180000_vagas_imediatas_dos_paineis_pelo_quadro.sql";
  const ler = (caminho: string) =>
    readFileSync(caminho, "utf8").replace(/\r\n/g, "\n");
  const migration = () => ler(`tests/fixtures/sql-do-banco/${NOME}`);

  const COM_QUADRO = "bbbbbbbb-0000-0000-0000-000000000001";
  const SEM_QUADRO = "bbbbbbbb-0000-0000-0000-000000000002";
  const COM_LOCAIS = "bbbbbbbb-0000-0000-0000-000000000003";

  const TABELAS_DOS_EDITAIS = `
create function private."FC_EH_TREINAMENTO"(p_marca text) returns boolean
language sql immutable as $$ select coalesce(p_marca, 'N') = 'S' $$;

create function private."FC_TEXTO_BUSCA_RECURSO"(p_texto text) returns text
language sql immutable as $$
  select btrim(regexp_replace(
    translate(lower(coalesce(p_texto, '')), 'áàâãäåéèêëíìîïóòôõöúùûüçñ', 'aaaaaaeeeeiiiiooooouuuucn'),
    '\\s+', ' ', 'g'))
$$;

create table public."TB_MONITORAMENTO_INDIGENA" (
  id uuid primary key, edital text, unidade text, inscritos integer,
  "CO_AREA" text, ativo boolean default true, "ST_TREINAMENTO" text default 'N');
create table public."TB_SELECAO_VAGA" (
  "CO_SELECAO_VAGA" uuid primary key default gen_random_uuid(), "CO_MONITORAMENTO" uuid,
  "CO_VAGA" text, "NO_CARGO" text, "NO_UNIDADE" text, "QT_INSCRITO" integer,
  "DS_CHAVE_ORIGEM" text default 'chave', "DS_VAGA_PLANILHA" text default '',
  "ST_REGISTRO_ATIVO" text default 'S');
create table public."TB_LISTA_APROVADO" (id uuid primary key, edital_id text, vigente boolean, ativo boolean);
create table public."TB_CANDIDATO_APROVADO" (lista_id uuid, codigo_vaga text, cargo text, removido_em timestamptz);
create table public."TB_ENTREVISTA" ("CO_AREA" text, "CO_VAGA" text, "NO_CARGO" text);
create table public."TB_QUADRO_VAGA_EDITAL" (
  "CO_QUADRO_VAGA" uuid primary key default gen_random_uuid(), "CO_MONITORAMENTO" uuid,
  "NO_CARGO" text, "QT_VAGA_IMEDIATA" integer, "ST_REGISTRO_ATIVO" text default 'S');
create table public."TB_VAGA_IMEDIATA" ("CO_EDITAL" text, "CO_VAGA" text, "QT_VAGA_IMEDIATA" integer);
create table public."TB_CONVOCACAO_EDITAL" ("CO_EDITAL" text, "QT_PADRAO_IMEDIATA" integer);
create table public."TB_LOCAL_VAGA_EDITAL" (
  "CO_MONITORAMENTO" uuid, "NO_CARGO" text, "QT_VAGA" integer, "ST_REGISTRO_ATIVO" text default 'S');

create function private."FC_QUADRO_DA_VAGA"(p_edital uuid, p_nome_vaga text) returns uuid
language sql stable as $$
  select case when count(*) = 1 then min(q."CO_QUADRO_VAGA"::text)::uuid end
    from public."TB_QUADRO_VAGA_EDITAL" q
   where q."CO_MONITORAMENTO" = p_edital and q."ST_REGISTRO_ATIVO" = 'S'
     and position(lower(q."NO_CARGO") in lower(p_nome_vaga)) > 0
$$;
`;

  const DADOS = `
insert into public."TB_MONITORAMENTO_INDIGENA" (id, edital, unidade, inscritos, "CO_AREA") values
  ('${COM_QUADRO}', '01/2099', 'DSEI Teste', 10, '${SI}'),
  ('${SEM_QUADRO}', '02/2099', 'DSEI Teste', 10, '${SI}'),
  ('${COM_LOCAIS}', '03/2099', 'DSEI Teste', 10, '${SI}');

insert into public."TB_SELECAO_VAGA" ("CO_MONITORAMENTO", "CO_VAGA", "NO_CARGO", "QT_INSCRITO") values
  -- quadro (3) ganha do título (2)
  ('${COM_QUADRO}', '101', 'Enfermeiro - Polo Base A - 2 vagas (2 AC)', 5),
  -- no quadro, sem número no título
  ('${COM_QUADRO}', '102', 'Psicólogo - Polo Base A', 5),
  -- quadro só cadastro reserva: 0
  ('${COM_QUADRO}', '103', 'Nutricionista - Polo Base A', 5),
  -- fora do quadro, com convocação da vaga
  ('${COM_QUADRO}', '104', 'Médico - Polo Base A', 5),
  -- fora do quadro: o padrão da convocação do edital
  ('${COM_QUADRO}', '105', 'Dentista - Polo Base A', 5),
  -- sem quadro: convocação "chamar todos" (10000) não vale; cai no título
  ('${SEM_QUADRO}', '201', 'Agente - Polo B - 4 vagas', 5),
  -- sem quadro e sem nada: vazio
  ('${SEM_QUADRO}', '202', 'Assistente - Polo B', 5),
  -- sem quadro: título com Cadastro Reserva
  ('${SEM_QUADRO}', '203', 'Motorista - Cadastro Reserva', 5),
  -- locais: um só casa com o cargo
  ('${COM_LOCAIS}', '301', 'Agente de Projeto - Escritório X', 5),
  -- locais: dois casam (ambíguo) — vazio
  ('${COM_LOCAIS}', '302', 'Assistente de Projeto - Escritório X', 5);

insert into public."TB_QUADRO_VAGA_EDITAL" ("CO_MONITORAMENTO", "NO_CARGO", "QT_VAGA_IMEDIATA") values
  ('${COM_QUADRO}', 'Enfermeiro', 3),
  ('${COM_QUADRO}', 'Psicólogo', 1),
  ('${COM_QUADRO}', 'Nutricionista', 0);
insert into public."TB_QUADRO_VAGA_EDITAL" ("CO_MONITORAMENTO", "NO_CARGO", "QT_VAGA_IMEDIATA", "ST_REGISTRO_ATIVO") values
  ('${COM_QUADRO}', 'Médico', 9, 'N');

insert into public."TB_VAGA_IMEDIATA" values
  ('${COM_QUADRO}', '104', 7),
  ('${SEM_QUADRO}', '201', 10000);
insert into public."TB_CONVOCACAO_EDITAL" values
  ('${COM_QUADRO}', 2),
  ('${SEM_QUADRO}', 10000);

insert into public."TB_LOCAL_VAGA_EDITAL" ("CO_MONITORAMENTO", "NO_CARGO", "QT_VAGA") values
  ('${COM_LOCAIS}', 'Agente de Projeto', 6),
  ('${COM_LOCAIS}', 'Assistente de Projeto', 4),
  ('${COM_LOCAIS}', 'Assistente', 2),
  ('${COM_LOCAIS}', null, 40);
`;

  type Linha = { codigo_vaga: string | null; vagas_imediatas: number | null };

  let db: Banco;
  beforeAll(() => bancoComRelatoriosProntos(), 60_000);
  beforeEach(async () => {
    db = await bancoComRelatoriosProntos();
    await db.exec(TABELAS_DOS_EDITAIS);
    await db.exec(DADOS);
  }, LONGO);

  async function vagasPorCodigo() {
    const r = await uma<{ j: { linhas: Linha[] } }>(
      db,
      `select private."FC_LINHAS_POR_CARGO_DO_PAINEL"($1) as j`,
      [SI],
    );
    return Object.fromEntries(
      (r?.j.linhas ?? []).map((l) => [l.codigo_vaga, l.vagas_imediatas]),
    );
  }

  describe("depois da migration", () => {
    it(
      "quadro > convocação > local > título",
      async () => {
        await db.exec(migration());
        expect(await vagasPorCodigo()).toEqual({
          "101": 3, // quadro ganha do título
          "102": 1, // quadro
          "103": 0, // quadro só com cadastro reserva
          "104": 7, // linha do quadro desativada: convocação da vaga
          "105": 2, // padrão da convocação do edital
          "201": 4, // 10000 é "chamar todos": título
          "202": null, // nada
          "203": 0, // título com Cadastro Reserva
          "301": 6, // um local só casa com o cargo
          "302": null, // dois locais casam: ambíguo
        });
      },
      LONGO,
    );

    it(
      "renomeia a coluna no catálogo e recalcula o relatório",
      async () => {
        await db.exec(migration());
        const c = await uma<{ no_rotulo: string; ds_padrao: string }>(
          db,
          `select no_rotulo, ds_padrao from private."FC_COLUNAS_EDITAVEIS_DO_PAINEL"() where nu_ordem = 4`,
        );
        expect(c?.no_rotulo).toBe("Vagas imediatas");
        expect(c?.ds_padrao).toContain("quadro de vagas do edital");
        const k = await uma<{ n: number }>(
          db,
          `select count(*)::integer as n from public."TB_CALCULO_RELATORIO_PAINEL" where "CO_RELATORIO" = 'editais-por-cargo'`,
        );
        expect(k?.n).toBe(3);
      },
      LONGO,
    );
  });
});

bloco("validade-do-edital", () => {
  /*
  Cartão #57: validade do processo seletivo no formulário do edital. As
  contas espelham private."FC_VENCIMENTO_DO_EDITAL" (data_fim + make_interval
  em meses, em dobro se prorrogado; NULL sem data ou sem prazo) e a regra de
  FC_INATIVAR_LISTAS_VENCIDAS (vencido = último dia antes de hoje em Brasília).
  Os resultados esperados são os do PostgreSQL para as mesmas somas.
*/

  const validade = (
    anos: string,
    meses: string,
    prorrogado: ValidadeDoFormulario["prorrogado"] = "nao",
    lida = true,
  ): ValidadeDoFormulario => ({ anos, meses, prorrogado, lida });

  describe("somarMesesComoNoBanco (date + interval 'N months' do PostgreSQL)", () => {
    it("fim de mês: 31/01 + 1 mês cai no último dia de fevereiro", () => {
      expect(somarMesesComoNoBanco("2027-01-31", 1)).toBe("2027-02-28");
      expect(somarMesesComoNoBanco("2028-01-31", 1)).toBe("2028-02-29");
      expect(somarMesesComoNoBanco("2026-03-31", 1)).toBe("2026-04-30");
      expect(somarMesesComoNoBanco("2026-01-30", 1)).toBe("2026-02-28");
    });

    it("bissexto: 29/02 + 1 ano cai em 28/02; + 4 anos volta a 29/02", () => {
      expect(somarMesesComoNoBanco("2028-02-29", 12)).toBe("2029-02-28");
      expect(somarMesesComoNoBanco("2028-02-29", 48)).toBe("2032-02-29");
    });

    it("vira o ano e aceita o prazo máximo em dobro (240 meses)", () => {
      expect(somarMesesComoNoBanco("2026-11-15", 2)).toBe("2027-01-15");
      expect(somarMesesComoNoBanco("2026-12-31", 14)).toBe("2028-02-29");
      expect(somarMesesComoNoBanco("2026-11-11", 240)).toBe("2046-11-11");
    });

    it("data ilegível ou impossível: null", () => {
      for (const data of ["", "11/11/2026", "2026-02-30", "2026-13-01", "abc"])
        expect(somarMesesComoNoBanco(data, 1)).toBeNull();
      expect(somarMesesComoNoBanco("2026-01-01", 1.5)).toBeNull();
      // Timestamp: vale o dia (como data_fim::date).
      expect(somarMesesComoNoBanco("2026-01-31T00:00:00", 1)).toBe(
        "2026-02-28",
      );
    });
  });

  describe("vencimentoDoEdital (FC_VENCIMENTO_DO_EDITAL)", () => {
    it("limites: 0 ano e 0 mês não vence; 10 anos e 11 meses somam", () => {
      expect(vencimentoDoEdital("2026-11-11", 0, 0, false)).toBeNull();
      expect(vencimentoDoEdital("2026-11-11", 0, 0, true)).toBeNull();
      expect(vencimentoDoEdital("2026-11-11", 10, 0, false)).toBe("2036-11-11");
      expect(vencimentoDoEdital("2026-11-11", 0, 11, false)).toBe("2027-10-11");
      expect(vencimentoDoEdital("2026-11-11", 10, 11, false)).toBe(
        "2037-10-11",
      );
    });

    it("prorrogado conta em dobro", () => {
      expect(vencimentoDoEdital("2026-11-11", 2, 0, true)).toBe("2030-11-11");
      expect(vencimentoDoEdital("2026-01-31", 0, 1, true)).toBe("2026-03-31");
      expect(vencimentoDoEdital("2026-11-11", 10, 11, true)).toBe("2048-09-11");
    });

    it("sem data de encerramento: null", () => {
      expect(vencimentoDoEdital(null, 2, 0, false)).toBeNull();
      expect(vencimentoDoEdital("", 2, 0, false)).toBeNull();
    });
  });

  describe("prazoDaValidade (o que o formulário mostra)", () => {
    it("vigente até o último dia; vencido no dia seguinte, em Brasília", () => {
      const v = validade("1", "0");
      // Último dia 11/11/2027. 23h30 de 11/11 em Brasília = 02h30 de 12/11 em UTC.
      const ultimoDiaQuaseMeiaNoite = new Date("2027-11-12T02:30:00Z");
      expect(
        prazoDaValidade(v, "2026-11-11", ultimoDiaQuaseMeiaNoite),
      ).toMatchObject({ tipo: "vigente", vencimento: "2027-11-11" });
      // 00h30 de 12/11 em Brasília (03h30 UTC): venceu.
      const diaSeguinte = new Date("2027-11-12T03:30:00Z");
      const vencido = prazoDaValidade(v, "2026-11-11", diaSeguinte);
      expect(vencido).toMatchObject({
        tipo: "vencido",
        vencimento: "2027-11-11",
      });
      expect(vencido.texto).toBe(
        "Venceu em 11/11/2027: ao salvar, a lista de aprovados vigente fica inativa.",
      );
    });

    it("perto da meia-noite UTC, vale o dia de Brasília (não o UTC)", () => {
      // 21h de 10/11 em Brasília = 00h de 11/11 em UTC: ainda é 10/11, último dia.
      const agora = new Date("2026-11-11T00:00:00Z");
      expect(
        prazoDaValidade(validade("0", "1"), "2026-10-10", agora),
      ).toMatchObject({ tipo: "vigente", vencimento: "2026-11-10" });
    });

    it("valor inválido pede correção em vez do prazo", () => {
      const hoje = new Date("2026-11-11T15:00:00Z");
      expect(prazoDaValidade(validade("0", "12"), "2026-11-11", hoje)).toEqual({
        tipo: "incompleto",
        texto: "Corrija a validade para calcular o prazo.",
      });
    });

    it("textos: válida até, sem prazo, sem data e incompleto", () => {
      const hoje = new Date("2026-11-11T15:00:00Z");
      expect(
        prazoDaValidade(validade("2", "0"), "2026-11-11", hoje).texto,
      ).toBe("Válida até 11/11/2028.");
      expect(prazoDaValidade(validade("0", "0"), "2026-11-11", hoje)).toEqual({
        tipo: "nao-vence",
        texto: "Sem prazo: a lista não vence.",
      });
      expect(prazoDaValidade(validade("2", "0"), "", hoje).tipo).toBe(
        "sem-data",
      );
      expect(
        prazoDaValidade(validade("2", "", "", false), "2026-11-11", hoje).tipo,
      ).toBe("incompleto");
    });
  });

  describe("validação dos campos", () => {
    it("aceita 0 e 10 anos, 0 e 11 meses", () => {
      for (const [anos, meses] of [
        ["0", "0"],
        ["10", "0"],
        ["0", "11"],
        ["10", "11"],
      ])
        expect(validadeValida(validade(anos!, meses!))).toBe(true);
    });

    it("recusa 11 anos, 12 meses, negativo, decimal e texto, com mensagem", () => {
      expect(errosDaValidade(validade("11", "0")).anos).toBe(
        "Use um número inteiro de 0 a 10 anos.",
      );
      expect(errosDaValidade(validade("0", "12")).meses).toBe(
        "Use um número inteiro de 0 a 11 meses.",
      );
      expect(errosDaValidade(validade("-1", "0")).anos).not.toBe("");
      expect(errosDaValidade(validade("1.5", "0")).anos).not.toBe("");
      expect(errosDaValidade(validade("dois", "0")).anos).not.toBe("");
    });

    it("validade lida exige os três; não lida aceita vazio", () => {
      expect(errosDaValidade(validade("", "", ""))).toEqual({
        anos: "Informe os anos (0 a 10).",
        meses: "Informe os meses (0 a 11).",
        prorrogado: "Diga se o prazo foi prorrogado.",
      });
      expect(validadeValida(VALIDADE_NAO_LIDA)).toBe(true);
      expect(validadeValida({ ...VALIDADE_NAO_LIDA, meses: "12" })).toBe(false);
    });
  });

  describe("ida e volta com o banco", () => {
    it("lê os três campos do monitoramento de get_monitoramento_cronograma", () => {
      expect(
        validadeDoBanco({
          nu_anos_validade: 2,
          nu_meses_validade: 6,
          st_prorrogado: true,
        }),
      ).toEqual({ anos: "2", meses: "6", prorrogado: "sim", lida: true });
      expect(
        validadeDoBanco({
          nu_anos_validade: 0,
          nu_meses_validade: 0,
          st_prorrogado: false,
        }),
      ).toEqual(VALIDADE_NOVA);
    });

    it("RPC de antes da migration (sem os campos): não lida", () => {
      expect(validadeDoBanco({ cronograma_automatico: true })).toEqual(
        VALIDADE_NAO_LIDA,
      );
      expect(validadeDoBanco(null)).toEqual(VALIDADE_NAO_LIDA);
      expect(
        validadeDoBanco({ nu_anos_validade: 1, nu_meses_validade: 0 }),
      ).toEqual(VALIDADE_NAO_LIDA);
    });

    it("payload: lida manda as três; não lida só o que foi preenchido", () => {
      expect(validadeParaSalvar(validade("10", "11", "sim"))).toEqual({
        nu_anos_validade: 10,
        nu_meses_validade: 11,
        st_prorrogado: true,
      });
      expect(validadeParaSalvar(validade("0", "0", "nao"))).toEqual({
        nu_anos_validade: 0,
        nu_meses_validade: 0,
        st_prorrogado: false,
      });
      expect(validadeParaSalvar(VALIDADE_NAO_LIDA)).toEqual({});
      expect(validadeParaSalvar({ ...VALIDADE_NAO_LIDA, anos: "3" })).toEqual({
        nu_anos_validade: 3,
      });
      // Valor inválido nunca vai (a tela bloqueia o Salvar antes).
      expect(validadeParaSalvar(validade("12", "0", "nao"))).toEqual({
        nu_meses_validade: 0,
        st_prorrogado: false,
      });
      expect(validadeParaSalvar(null)).toEqual({});
    });

    it("editalParaSalvar leva as chaves no p_payload de salvar_monitoramento_com_cronograma_v2", () => {
      const formulario = { id: "e1", edital: "900/2099" } as Parameters<
        typeof editalParaSalvar
      >[0];
      const previa = { status: "", etapa: "" };
      const comValidade = editalParaSalvar(
        formulario,
        null,
        { automatico: false, etapas: [], validade: validade("2", "3", "sim") },
        previa,
      );
      expect(comValidade).toMatchObject({
        nu_anos_validade: 2,
        nu_meses_validade: 3,
        st_prorrogado: true,
      });
      const semLeitura = editalParaSalvar(
        formulario,
        null,
        { automatico: false, etapas: [], validade: VALIDADE_NAO_LIDA },
        previa,
      );
      expect("nu_anos_validade" in semLeitura).toBe(false);
      expect("nu_meses_validade" in semLeitura).toBe(false);
      expect("st_prorrogado" in semLeitura).toBe(false);
    });

    it("mexer na validade conta como alteração do formulário (rascunho)", () => {
      const antes = estadoComparavel({}, { validade: validade("1", "0") });
      const depois = estadoComparavel({}, { validade: validade("2", "0") });
      expect(depois).not.toBe(antes);
    });
  });
});

bloco("cronograma-manual-e-datas-do-cadastro-no-banco", () => {
  type Banco = Banco__DoCronograma;
  const MIGRATION = MIGRATION__2;
  const bancoDeHoje = bancoDeHoje__3;
  /*
  Migration 20261117190000 (aplicada em 18/11/2026; o SQL em
  tests/fixtures/sql-do-banco/) num Postgres de verdade (PGlite), antes × depois. Conferência de 17/11/2026:
  1. O edital com cálculo manual e etapas (caso do 120/2026: 13 etapas, status
     "Suspenso" digitado) não é "sem cronograma": o estado traz percentual,
     próxima etapa e datas; o status e a etapa digitados continuam valendo.
  2. As datas do cadastro acompanham as etapas quando o automático está ligado
     (gatilho adiado ao fim da transação), e o acerto pontual refaz as que
     divergem; o manual mantém as suas.
*/

  const LONGO = 60_000;
  const DIA = "2026-11-17";
  const ESTADO = 'private."FC_ESTADO_DO_CRONOGRAMA"(uuid, date)';
  const RESUMO = "public.get_nucleo_cronograma_resumo()";

  let db: Banco;
  beforeAll(() => bancoDeHoje(), LONGO);
  beforeEach(async () => {
    db = await bancoDeHoje();
  }, LONGO);

  const migrar = () => db.exec(MIGRATION);
  const semChavesNovas = (e: Record<string, unknown>) => {
    const { calculo: _c, situacao: _s, ...resto } = e;
    return resto;
  };

  describe("antes (o defeito da conferência)", () => {
    it("o edital manual com 13 etapas sai como sem cronograma", async () => {
      const e = await estado(db, MANUAL, DIA);
      expect(e.tem_cronograma).toBe(false);
      expect(e.percentual).toBe(0);
      expect(e.proxima_atividade).toBeNull();
    });

    it("a guarda da migration reconhece os corpos de antes", async () => {
      expect(await md5DoCorpo(db, ESTADO)).toBe(
        "f1a2b05143c74861b1a4971f937ac9cf",
      );
      expect(await md5DoCorpo(db, RESUMO)).toBe(
        "436e0e97170a4d8ee43e01705ff574fb",
      );
    });
  });

  describe("depois", () => {
    beforeEach(() => migrar(), LONGO);

    it("120/2026: etapas cadastradas, cálculo manual, suspenso", async () => {
      const e = await estado(db, MANUAL, DIA);
      expect(e).toMatchObject({
        tem_cronograma: true,
        calculo: "manual",
        situacao: "suspenso",
        status: "Suspenso",
        total_etapas: 13,
        etapas_concluidas: 2,
        percentual: 15.4,
        proxima_atividade: "Período de inscrição",
        proxima_data: "2026-11-19",
        dias_para_proxima: 2,
        data_inicio: "2026-10-21",
        data_fim: "2027-02-25",
      });
      // Sem etapa digitada, a calculada.
      expect(e.etapa).toBe("Aguardando: Período de inscrição");
    });

    it("o status excepcional vale por cima do digitado", async () => {
      await db.query(
        `update public."TB_MONITORAMENTO_INDIGENA" set status_override = 'Paralisado' where id = $1`,
        [MANUAL],
      );
      const e = await estado(db, MANUAL, DIA);
      expect(e.status).toBe("Paralisado");
      expect(e.situacao).toBe("paralisado");
    });

    it("o automático tem o mesmo estado de antes (mais cálculo e situação)", async () => {
      const hoje = await bancoDeHoje();
      for (const edital of [AUTOMATICO, DIVERGENTE]) {
        const antes = await estado(hoje, edital, DIA);
        const depois = await estado(db, edital, DIA);
        expect(semChavesNovas(depois)).toEqual(antes);
        expect(depois.calculo).toBe("automatico");
        expect(depois.situacao).toBeNull();
      }
    });

    it("sem etapas continua sem cronograma, com o status digitado", async () => {
      const e = await estado(db, SEM_ETAPAS, DIA);
      expect(e).toMatchObject({
        tem_cronograma: false,
        calculo: "manual",
        situacao: null,
        status: "Em andamento",
        etapa: "Inscrições",
        percentual: 0,
      });
    });

    it("resumo do Núcleo: o manual suspenso é excepcional, não sem cronograma", async () => {
      const resumo = await valor<Record<string, unknown>[]>(db, RESUMO);
      const porId = new Map(resumo.map((r) => [r.id, r]));
      expect(porId.get(MANUAL)).toMatchObject({
        alerta_tipo: "excepcional",
        tem_cronograma: true,
        calculo: "manual",
        situacao: "suspenso",
      });
      expect(porId.get(SEM_ETAPAS)).toMatchObject({
        alerta_tipo: "sem_cronograma",
        tem_cronograma: false,
      });
    });

    it("o acerto refaz as datas do automático que divergiam, e só elas", async () => {
      expect(await datasDoCadastro(db, DIVERGENTE)).toEqual({
        inicio: "2026-09-08",
        fim: "2026-12-03",
      });
      expect(await datasDoCadastro(db, AUTOMATICO)).toEqual({
        inicio: "2026-06-16",
        fim: "2026-08-12",
      });
      // O manual mantém as datas do cadastro, mesmo com etapas até 25/02/2027.
      expect(await datasDoCadastro(db, MANUAL)).toEqual({
        inicio: "2026-10-21",
        fim: "2026-12-10",
      });
    });

    it("o gatilho leva as datas do automático às etapas, por qualquer caminho", async () => {
      // Errata: a última etapa muda de data.
      await db.query(
        `update public."TB_CRONOGRAMA_MONIT_INDIG" set data_fim = '2026-08-26', data_inicio = '2026-08-26'
        where monitoramento_id = $1 and ordem = 2`,
        [AUTOMATICO],
      );
      expect((await datasDoCadastro(db, AUTOMATICO))?.fim).toBe("2026-08-26");
      // Etapa nova antes da primeira.
      await db.query(
        `insert into public."TB_CRONOGRAMA_MONIT_INDIG" (monitoramento_id, ordem, atividade, data_inicio, data_fim)
       values ($1, 0, 'Aviso prévio', '2026-06-01', '2026-06-02')`,
        [AUTOMATICO],
      );
      expect((await datasDoCadastro(db, AUTOMATICO))?.inicio).toBe(
        "2026-06-01",
      );
      // Sem etapas, as datas ficam.
      await db.query(
        `delete from public."TB_CRONOGRAMA_MONIT_INDIG" where monitoramento_id = $1`,
        [AUTOMATICO],
      );
      expect(await datasDoCadastro(db, AUTOMATICO)).toEqual({
        inicio: "2026-06-01",
        fim: "2026-08-26",
      });
    });

    it("o gatilho não toca o manual", async () => {
      await db.query(
        `update public."TB_CRONOGRAMA_MONIT_INDIG" set data_fim = '2027-03-01' where monitoramento_id = $1 and ordem = 13`,
        [MANUAL],
      );
      expect((await datasDoCadastro(db, MANUAL))?.fim).toBe("2026-12-10");
    });

    it("apaga e reinsere numa transação (o salvar) grava as datas uma vez, no fim", async () => {
      await db.exec(`
      create table public.gravacoes (fim date);
      create function public.contar() returns trigger language plpgsql as $$
      begin insert into public.gravacoes values (new.data_fim); return null; end $$;
      create trigger contar after update on public."TB_MONITORAMENTO_INDIGENA"
        for each row execute function public.contar();
    `);
      await db.exec(`
      begin;
      delete from public."TB_CRONOGRAMA_MONIT_INDIG" where monitoramento_id = '${AUTOMATICO}';
      insert into public."TB_CRONOGRAMA_MONIT_INDIG" (monitoramento_id, ordem, atividade, data_inicio, data_fim) values
        ('${AUTOMATICO}', 1, 'Publicação do Edital', '2026-06-16', '2026-06-16');
      insert into public."TB_CRONOGRAMA_MONIT_INDIG" (monitoramento_id, ordem, atividade, data_inicio, data_fim) values
        ('${AUTOMATICO}', 2, 'Resultado', '2026-07-01', '2026-07-01');
      insert into public."TB_CRONOGRAMA_MONIT_INDIG" (monitoramento_id, ordem, atividade, data_inicio, data_fim) values
        ('${AUTOMATICO}', 3, 'Resultado final do Processo Seletivo', '2026-09-30', '2026-09-30');
      commit;
    `);
      const gravacoes = await db.query<{ fim: string }>(
        `select fim::text as fim from public.gravacoes`,
      );
      expect(gravacoes.rows).toEqual([{ fim: "2026-09-30" }]);
    });

    it("a guarda recusa aplicar de novo", async () => {
      await expect(migrar()).rejects.toThrow(/md5/);
    });
  });
});

bloco("cronograma-manual-na-visao-geral", () => {
  /*
  Conferência de 17/11/2026: a Visão geral tratava "cálculo manual" como "sem
  etapas". O caso é o do 120/2026 (13 etapas, cálculo automático desligado,
  status "Suspenso" digitado), que aparecia como "Sem cronograma" e "Cronograma
  ainda não cadastrado". Com a migration 20261117190000, o banco devolve
  percentual e próxima etapa também no manual. E "Concluído" (status calculado
  pelas datas) não prova que o resultado saiu: o rótulo é "Cronograma
  encerrado".
*/

  const HOJE = "2026-11-17";

  // A linha do 120/2026 como listar_monitoramento_operacional a devolve depois da migration.
  const MANUAL_SUSPENSO = {
    edital: "120/2026",
    status: "Suspenso",
    cronograma_automatico: false,
    cronograma_percentual: 15.4,
    cronograma_proxima_atividade: "Período de inscrição",
    cronograma_proxima_data: "2026-11-19",
    cronograma_dias_para_proxima: 2,
    cronograma_atividade_atual: undefined,
    data_inicio: "2026-10-21",
    data_fim: "2027-02-25",
  };

  describe("cálculo manual não é falta de etapas", () => {
    it("120/2026: cronograma cadastrado, cálculo manual, suspenso", () => {
      expect(temCronogramaCadastrado(MANUAL_SUSPENSO)).toBe(true);
      expect(descricaoDoCronograma(MANUAL_SUSPENSO)).toBe(
        "Cronograma cadastrado · cálculo manual · suspenso",
      );
      expect(urgenciaDoCronograma(MANUAL_SUSPENSO, HOJE)).toEqual({
        tom: "warning",
        rotulo: "Processo suspenso",
      });
      expect(seloDoCronograma(MANUAL_SUSPENSO, HOJE)?.rotulo).toBe(
        "Processo suspenso",
      );
    });

    it("suspenso não vira etapa atrasada quando o fim passa", () => {
      expect(
        urgenciaDoCronograma(
          { ...MANUAL_SUSPENSO, data_fim: "2026-11-01" },
          HOJE,
        ).rotulo,
      ).toBe("Processo suspenso");
    });

    it("manual em andamento com etapas segue a próxima etapa", () => {
      const linha = { ...MANUAL_SUSPENSO, status: "Em andamento" };
      expect(descricaoDoCronograma(linha)).toBe(
        "Cronograma cadastrado · cálculo manual",
      );
      expect(urgenciaDoCronograma(linha, HOJE)).toEqual({
        tom: "danger",
        rotulo: "Próxima etapa em 2 dia(s)",
      });
    });

    it("manual com etapas: qualquer um dos sinais basta", () => {
      const vazio = {
        cronograma_automatico: false,
        cronograma_percentual: 0,
        cronograma_proxima_data: undefined,
        cronograma_atividade_atual: undefined,
      };
      expect(temCronogramaCadastrado(vazio)).toBe(false);
      expect(
        temCronogramaCadastrado({ ...vazio, cronograma_percentual: 100 }),
      ).toBe(true);
      expect(
        temCronogramaCadastrado({
          ...vazio,
          cronograma_atividade_atual: "Entrevistas",
        }),
      ).toBe(true);
      expect(
        temCronogramaCadastrado({
          ...vazio,
          cronograma_proxima_data: "2026-12-01",
        }),
      ).toBe(true);
    });

    it("manual sem etapas continua sem cronograma", () => {
      const linha = {
        status: "Em andamento",
        cronograma_automatico: false,
        cronograma_percentual: 0,
        data_fim: "2026-12-31",
      };
      expect(descricaoDoCronograma(linha)).toBeNull();
      expect(seloDoCronograma(linha, HOJE)?.rotulo).toBe("Sem cronograma");
    });

    it("automático: cálculo automático na descrição", () => {
      expect(
        descricaoDoCronograma({
          status: "Em andamento",
          cronograma_automatico: true,
        }),
      ).toBe("Cronograma cadastrado · cálculo automático");
    });
  });

  describe("a data passar não prova o resultado", () => {
    it("concluído pelo cronograma diz 'Cronograma encerrado'", () => {
      expect(prazoDoEdital({ status: "Concluído" }, HOJE)?.rotulo).toBe(
        "Cronograma encerrado",
      );
      expect(urgenciaDoCronograma({ status: "Concluído" }, HOJE)).toEqual({
        tom: "done",
        rotulo: "Cronograma encerrado",
      });
    });
  });
});

bloco("sequencia-do-cronograma", () => {
  /*
  A sequência entre etapas dependentes (src/lib/cronograma/sequencia-do-cronograma.ts).
  Caso da conferência de 17/11/2026: no 120/2026 o recurso das entrevistas
  (etapa 11) vai de 14/01 a 25/02/2027, depois do resultado final (21/01).
*/

  const e = (
    atividade: string,
    data_inicio: string,
    data_fim = data_inicio,
  ) => ({
    atividade,
    data_inicio,
    data_fim,
  });

  const DO_120 = [
    e("Publicação do Edital", "2026-10-21"),
    e("Impugnação do Edital", "2026-11-14", "2026-11-16"),
    e(
      "Período de inscrição e Envio dos Documentos Comprobatórios de Requisitos",
      "2026-11-19",
      "2026-11-23",
    ),
    e("Publicação da Lista Geral de Classificação Provisória", "2026-11-25"),
    e(
      "Resultado Preliminar da Avaliação Documental e de Títulos",
      "2026-12-08",
    ),
    e(
      "Prazo de recurso referente ao resultado preliminar da Avaliação Documental e de Títulos",
      "2026-12-09",
      "2026-12-10",
    ),
    e("Resultado Final da Avaliação Documental e de Títulos", "2026-12-17"),
    e("Convocação para a Entrevista", "2026-12-18"),
    e("Período de Entrevistas", "2027-01-05", "2027-01-11"),
    e("Resultado Preliminar das Entrevistas", "2027-01-13"),
    e(
      "Prazo para recursos referentes ao resultado preliminar das entrevistas",
      "2027-01-14",
      "2027-02-25",
    ),
    e("Resultado final da Entrevista", "2027-01-21"),
    e("Resultado final do Processo Seletivo", "2027-01-21"),
  ];

  describe("sequência do cronograma", () => {
    it("120/2026: o recurso das entrevistas termina depois do resultado final", () => {
      expect(avisosDeSequencia(DO_120)).toEqual([
        "A etapa 11 (recurso) termina em 25/02/2027, depois da etapa 12 (resultado final, 21/01/2027).",
      ]);
    });

    it("corrigido, nenhum aviso", () => {
      const corrigido = DO_120.map((etapa, i) =>
        i === 10 ? { ...etapa, data_fim: "2027-01-15" } : etapa,
      );
      expect(avisosDeSequencia(corrigido)).toEqual([]);
    });

    it("recurso antes do preliminar e final antes do preliminar", () => {
      expect(
        avisosDeSequencia([
          e("Resultado Preliminar da Análise Curricular", "2026-08-10"),
          e(
            "Recurso contra o Resultado Preliminar da Análise Curricular",
            "2026-08-08",
            "2026-08-09",
          ),
          e("Resultado final da análise curricular", "2026-08-05"),
        ]),
      ).toEqual([
        "A etapa 3 (resultado final) vem em 05/08/2026, antes da etapa 1 (resultado preliminar, 10/08/2026).",
        "A etapa 2 (recurso) começa em 08/08/2026, antes da etapa 1 (resultado preliminar, 10/08/2026).",
        "A etapa 2 (recurso) termina em 09/08/2026, depois da etapa 3 (resultado final, 05/08/2026).",
      ]);
    });

    it("sem resultado final da fase, vale o do processo seletivo", () => {
      expect(
        avisosDeSequencia([
          e("Resultado Preliminar da Entrevista", "2026-09-01"),
          e(
            "Análise e resposta aos recursos — entrevistas",
            "2026-09-02",
            "2026-09-20",
          ),
          e("Divulgação do resultado final do Processo Seletivo", "2026-09-15"),
        ]),
      ).toEqual([
        "A etapa 2 (análise dos recursos) termina em 20/09/2026, depois da etapa 3 (resultado final, 15/09/2026).",
      ]);
    });

    it("preliminar com abertura do prazo de recurso conta como preliminar", () => {
      const [etapa] = marcarEtapas([
        e(
          "Resultado preliminar da análise curricular e abertura do prazo de recurso",
          "2026-07-01",
        ),
      ]);
      expect(etapa).toMatchObject({ papel: "preliminar", fase: "documental" });
    });

    it("a fase é a da primeira palavra-chave; títulos sozinho é fase própria", () => {
      expect(
        marcarEtapas([
          e(
            "Resultado Final da Avaliação Curricular e convocação para a Entrevista",
            "2025-07-25",
          ),
          e(
            "Resultado Preliminar da Avaliação Documental e de Títulos",
            "2026-12-08",
          ),
          e(
            "Divulgação do edital de resultado provisório na avaliação de títulos",
            "2027-01-12",
          ),
        ]).map(({ fase, papel }) => [fase, papel]),
      ).toEqual([
        ["documental", "final"],
        ["documental", "preliminar"],
        ["titulos", "preliminar"],
      ]);
      // O recurso dos títulos se mede pelo resultado final dos títulos, não pelo da documental.
      expect(
        avisosDeSequencia([
          e(
            "Divulgação do edital de resultado final na análise documental",
            "2026-12-29",
          ),
          e(
            "Divulgação do edital de resultado provisório na avaliação de títulos",
            "2027-01-12",
          ),
          e(
            "Prazo para a interposição de recursos contra o resultado provisório na avaliação de títulos",
            "2027-01-13",
            "2027-01-14",
          ),
          e(
            "Divulgação do edital de resultado final na avaliação de títulos e de resultado final no processo seletivo",
            "2027-01-26",
          ),
        ]),
      ).toEqual([]);
    });

    it("etapa sem data ou fora do padrão não entra", () => {
      expect(
        marcarEtapas([
          e("Análise Curricular", "2026-07-01"),
          { atividade: "Resultado final da Entrevista", data_inicio: "" },
        ]),
      ).toEqual([]);
    });

    it("comSequencia soma os avisos à análise do formulário, sem repetir", () => {
      const edital = { edital: "120/2026", unidade: "DSEI Fictício" };
      const etapas: EtapaDoCronograma[] = DO_120.map((etapa, i) => ({
        ...etapa,
        ordem: i + 1,
        origem: "MANUAL",
        observacao: "",
        concluida: null,
        confianca_extracao: null,
      }));
      const base = analisarCronograma(edital, etapas, "Errata");
      expect(base.avisos.join(" ")).not.toContain("etapa 11 (recurso)");
      const analise = comSequencia(base, etapas);
      expect(analise.erros).toEqual(base.erros);
      expect(analise.avisos).toContain(
        "A etapa 11 (recurso) termina em 25/02/2027, depois da etapa 12 (resultado final, 21/01/2027).",
      );
      expect(comSequencia(analise, etapas).avisos).toEqual(analise.avisos);
    });
  });
});

bloco("vinculo-do-quadro-no-banco", () => {
  type Banco = Banco__DoVinculo;
  const bancoDeHoje = bancoDeHoje__2;
  const entrar = entrar__3;
  /*
  O vínculo da vaga com a linha do quadro (migration 20261118120000, aplicada em 18/11/2026)
  num Postgres de verdade (PGlite): o banco de antes (corpos copiados do retrato de produção) com
  a migration aplicada, as RPCs da fila e quem consulta o vínculo. A guarda, o ensaio e o
  rollback saíram com a migration (regra do #712).
*/

  const EDITAL_EXTERNO = "aaaaaaaa-0000-0000-0000-000000000004";

  /*
  O edital 105/2026: o mesmo cargo em duas lotações (nome cortado), um cargo com "40h" que o
  nome não traz, a lotação que contradiz a linha e uma vaga só da Empregare, pelo "CARGO N".
*/
  const QUADRO = [
    { cargo: "Enfermeiro", lotacao: "Polo Base Alfa" },
    { cargo: "Enfermeiro", lotacao: "Polo Base Beta" },
    { cargo: "Médico", lotacao: "Polo Base Alfa" },
    { cargo: "Cirurgião Dentista 40h", lotacao: "Polo Base Gama" },
    { cargo: "CARGO 7 - Técnico de Enfermagem", lotacao: "Polo Base Alfa" },
  ];

  type Linhas = { l1: string; l2: string; l3: string; l4: string; l5: string };
  let linhas: Linhas;

  async function dados(db: Banco): Promise<void> {
    await criarEdital(db, EDITAL, "105/2026");
    await criarEdital(db, EDITAL_SEM_CODIGO, "99/2026");
    await criarEdital(db, EDITAL_CANCELADO, "88/2026", "Cancelado");
    await criarEdital(db, EDITAL_EXTERNO, "77/2026");
    const [l1, l2, l3, l4, l5] = await gravarQuadro(db, EDITAL, QUADRO);
    linhas = { l1: l1!, l2: l2!, l3: l3!, l4: l4!, l5: l5! };
    for (const e of [EDITAL_SEM_CODIGO, EDITAL_CANCELADO, EDITAL_EXTERNO])
      await gravarQuadro(db, e, [{ cargo: "Enfermeiro" }]);
    await criarVagaDaSelecao(
      db,
      EDITAL_EXTERNO,
      null,
      "Enfermeiro (banca externa)",
    );

    await criarAnalise(db, "105/2026", "1001", "Enfermeiro - Polo Base Alfa");
    await criarAnalise(db, "105/2026", "1002", "Enfermeiro");
    await criarAnalise(db, "105/2026", "1003", "Médico");
    await criarAnalise(
      db,
      "105/2026",
      "1004",
      "Cirurgião Dentista - Polo Base Gama",
    );
    await criarAnalise(db, "105/2026", "1005", "Médico - Polo Base Zeta");
    await db.query(
      `insert into public."TB_EMPREGARE_VAGA" ("CO_VAGA", "CO_MONITORAMENTO", "NO_ARQUIVO")
     values ('2001', $1, 'Candidatos da vaga 2001 - CARGO 07 - TEC ENF em Excel')`,
      [EDITAL],
    );
  }

  const bancoAntesComDados = moldeDeBanco(async () => {
    const db = await bancoDeHoje();
    await dados(db);
    return db;
  });
  const bancoMigrado = moldeDeBanco(async () => {
    const db = await bancoAntesComDados();
    await db.exec(migration());
    return db;
  });

  async function erroDe(p: Promise<unknown>): Promise<string> {
    try {
      await p;
    } catch (e) {
      return String((e as { code?: string }).code ?? e);
    }
    return "sem erro";
  }

  const gravar = (
    db: Banco,
    vaga: string,
    acao: string,
    quadro: string | null = null,
  ) =>
    db.query(`select public.gravar_vinculo_do_quadro($1, $2, $3, $4)`, [
      EDITAL,
      vaga,
      acao,
      quadro,
    ]);

  describe("a migration aplicada", () => {
    it("agenda a rodada diária e a põe no catálogo das tarefas", async () => {
      const db = await bancoMigrado();
      const { rows } = await db.query<{ jobname: string; command: string }>(
        `select jobname, command from cron.job`,
      );
      expect(rows).toEqual([
        expect.objectContaining({
          jobname: "agsus_vinculos_do_quadro",
          command: expect.stringContaining(
            `FC_PREENCHER_TODOS_VINCULOS_QUADRO`,
          ),
        }),
      ]);
      const t = await db.query(
        `select 1 from public."TB_TAREFA_AGENDADA" where "NO_TAREFA" = 'agsus_vinculos_do_quadro'`,
      );
      expect(t.rows).toHaveLength(1);
    });
  });

  describe("o preenchimento automático", () => {
    it("separa confirmadas, ambíguas (com as candidatas) e ausentes", async () => {
      const db = await bancoMigrado();
      const { l1, l2, l3, l5 } = linhas;
      expect(await vinculos(db, EDITAL)).toEqual([
        {
          vaga: "1001",
          situacao: "CONFIRMADO",
          origem: "AUTOMATICO",
          regra: "NOME",
          quadro: l1,
          candidatas: [],
          pendencia: null,
        },
        {
          vaga: "1002",
          situacao: "AMBIGUO",
          origem: "AUTOMATICO",
          regra: "NOME",
          quadro: null,
          candidatas: [l1, l2],
          pendencia: null,
        },
        {
          vaga: "1003",
          situacao: "CONFIRMADO",
          origem: "AUTOMATICO",
          regra: "NOME",
          quadro: l3,
          candidatas: [],
          pendencia: null,
        },
        // "Cirurgião Dentista 40h": o cargo do quadro não está no nome.
        {
          vaga: "1004",
          situacao: "AUSENTE",
          origem: "AUTOMATICO",
          regra: "NOME",
          quadro: null,
          candidatas: [],
          pendencia: null,
        },
        // A lotação do nome contradiz a única linha do cargo: candidata, não vínculo.
        {
          vaga: "1005",
          situacao: "AMBIGUO",
          origem: "AUTOMATICO",
          regra: "NOME",
          quadro: null,
          candidatas: [l3],
          pendencia: null,
        },
        // Só na Empregare: o "CARGO 07" do título.
        {
          vaga: "2001",
          situacao: "CONFIRMADO",
          origem: "AUTOMATICO",
          regra: "TITULO",
          quadro: l5,
          candidatas: [],
          pendencia: null,
        },
      ]);
    });

    it("não inventa vaga nos editais sem código", async () => {
      const db = await bancoMigrado();
      for (const e of [EDITAL_SEM_CODIGO, EDITAL_CANCELADO, EDITAL_EXTERNO])
        expect(await vinculos(db, e)).toEqual([]);
    });

    it("confirma exatamente o que FC_QUADRO_DA_VAGA devolve (casos guardados do banco)", async () => {
      const db = await bancoMigrado();
      const casos = JSON.parse(
        readFileSync(
          "tests/fixtures/quadro-da-vaga/casos-do-banco.json",
          "utf8",
        ),
      ) as {
        quadros: { id: string; cargo: string; lotacao: string | null }[];
        casos: [string, string | null][];
      };
      const edital = "bbbbbbbb-0000-0000-0000-000000000001";
      await criarEdital(db, edital, "500/2026");
      for (const [i, q] of casos.quadros.entries())
        await db.query(
          `insert into public."TB_QUADRO_VAGA_EDITAL" ("CO_QUADRO_VAGA", "CO_MONITORAMENTO", "NU_ORDEM", "NO_CARGO", "NO_LOTACAO")
         values ($1, $2, $3, $4, $5)`,
          [q.id, edital, i + 1, q.cargo, q.lotacao],
        );
      for (const [nome, esperado] of casos.casos) {
        const { rows } = await db.query<{
          hoje: string | null;
          v: { situacao: string; quadro: string | null; candidatas: string[] };
        }>(
          `select private."FC_QUADRO_DA_VAGA"($1, $2) as hoje, private."FC_CANDIDATAS_DO_QUADRO"($1, $2) as v`,
          [edital, nome],
        );
        const { hoje, v } = rows[0]!;
        expect(hoje, nome).toBe(esperado);
        expect(v.quadro, nome).toBe(esperado);
        expect(v.situacao === "CONFIRMADO", nome).toBe(esperado !== null);
        if (v.situacao === "AMBIGUO")
          expect(v.candidatas.length, nome).toBeGreaterThan(0);
      }
    });

    it("a vaga só da Seleção casa pelo título da planilha (NO_CARGO, não o código)", async () => {
      const db = await bancoMigrado();
      await entrar(db, 2);
      await criarVagaDaSelecao(
        db,
        EDITAL,
        "3001",
        "Médico - Polo Base Alfa - 1 vaga",
      );
      await db.query(`select public.atualizar_vinculos_do_quadro($1)`, [
        EDITAL,
      ]);
      const { rows } = await db.query<{ nome: string }>(
        `select "NO_VAGA" as nome from public."TA_VAGA_QUADRO_EDITAL" where "CO_VAGA" = '3001'`,
      );
      expect(rows).toEqual([{ nome: "Médico - Polo Base Alfa - 1 vaga" }]);
      expect(
        (await vinculos(db, EDITAL)).find((v) => v.vaga === "3001"),
      ).toMatchObject({
        situacao: "CONFIRMADO",
        regra: "NOME",
        quadro: linhas.l3,
      });
    });

    it("a vaga que sai do edital sai do vínculo, com histórico", async () => {
      const db = await bancoMigrado();
      await entrar(db, 2);
      await db.query(
        `update public."TB_ANALISE_CURRICULAR" set ativo = false where codigo_vaga = '1003'`,
      );
      await db.query(`select public.atualizar_vinculos_do_quadro($1)`, [
        EDITAL,
      ]);
      expect((await vinculos(db, EDITAL)).map((v) => v.vaga)).toEqual([
        "1001",
        "1002",
        "1004",
        "1005",
        "2001",
      ]);
      const h = await db.query(
        `select 1 from public."TH_VAGA_QUADRO_EDITAL" where "CO_VAGA" = '1003' and "TP_EVENTO" = 'REMOCAO'`,
      );
      expect(h.rows).toHaveLength(1);
    });

    it("atualizar pela tela mantém o achado pelo título (que fica para a rodada diária)", async () => {
      const db = await bancoMigrado();
      await entrar(db, 2);
      await db.query(`select public.atualizar_vinculos_do_quadro($1)`, [
        EDITAL,
      ]);
      expect(
        (await vinculos(db, EDITAL)).find((v) => v.vaga === "2001"),
      ).toMatchObject({ situacao: "CONFIRMADO", regra: "TITULO" });
    });
  });

  describe("a fila: gravar_vinculo_do_quadro", () => {
    it("só Núcleo ou Calendário com edição", async () => {
      const db = await bancoMigrado();
      await entrar(db, 1);
      expect(await erroDe(gravar(db, "1002", "CONFIRMAR", linhas.l2))).toBe(
        "42501",
      );
    });

    it("recusa linha de outro edital, vaga que não é do edital e ação desconhecida", async () => {
      const db = await bancoMigrado();
      await entrar(db, 2);
      const outra = await db.query<{ id: string }>(
        `select "CO_QUADRO_VAGA" as id from public."TB_QUADRO_VAGA_EDITAL" where "CO_MONITORAMENTO" = $1`,
        [EDITAL_EXTERNO],
      );
      expect(
        await erroDe(gravar(db, "1002", "CONFIRMAR", outra.rows[0]!.id)),
      ).toBe("22023");
      expect(await erroDe(gravar(db, "9999", "SEM_LINHA"))).toBe("22023");
      expect(await erroDe(gravar(db, "1002", "APAGAR"))).toBe("22023");
    });

    it("confirmar, marcar sem linha e devolver à regra, com quem e quando", async () => {
      const db = await bancoMigrado();
      await entrar(db, 2);
      await gravar(db, "1002", "CONFIRMAR", linhas.l2);
      await gravar(db, "1004", "SEM_LINHA");
      let v = await vinculos(db, EDITAL);
      expect(v.find((x) => x.vaga === "1002")).toMatchObject({
        situacao: "CONFIRMADO",
        origem: "MANUAL",
        quadro: linhas.l2,
      });
      expect(v.find((x) => x.vaga === "1004")).toMatchObject({
        situacao: "AUSENTE",
        origem: "MANUAL",
        pendencia: null,
      });

      const { rows } = await db.query<{
        obter: { vinculos: Record<string, unknown>[]; pode_editar: boolean };
      }>(`select public.obter_quadro_de_vagas($1)::jsonb as obter`, [EDITAL]);
      expect(rows[0]!.obter.pode_editar).toBe(true);
      expect(
        rows[0]!.obter.vinculos.find((x) => x["vaga"] === "1002"),
      ).toMatchObject({
        situacao: "CONFIRMADO",
        origem: "MANUAL",
        cargo: "Enfermeiro",
        cargo_quadro: "Enfermeiro",
        lotacao_quadro: "Polo Base Beta",
        confirmado_por: "Pessoa da Equipe",
      });

      // A rodada automática não mexe no que a equipe decidiu.
      await db.query(`select private."FC_PREENCHER_TODOS_VINCULOS_QUADRO"()`);
      v = await vinculos(db, EDITAL);
      expect(v.find((x) => x.vaga === "1002")).toMatchObject({
        origem: "MANUAL",
        quadro: linhas.l2,
      });

      await gravar(db, "1002", "AUTOMATICO");
      v = await vinculos(db, EDITAL);
      expect(v.find((x) => x.vaga === "1002")).toMatchObject({
        situacao: "AMBIGUO",
        origem: "AUTOMATICO",
      });
      const h = await db.query<{ evento: string; usuario: string | null }>(
        `select "TP_EVENTO" as evento, "CO_USUARIO"::text as usuario from public."TH_VAGA_QUADRO_EDITAL"
        where "CO_VAGA" = '1002' order by "SQ_HISTORICO"`,
      );
      expect(h.rows.map((r) => r.evento)).toEqual([
        "PREENCHIMENTO",
        "CONFIRMACAO",
        "RETORNO_AUTOMATICO",
      ]);
    });
  });

  describe("a reimportação do quadro", () => {
    it("passa o vínculo para a linha de mesmo cargo e lotação; o manual cuja linha saiu fica com pendência", async () => {
      const db = await bancoMigrado();
      await entrar(db, 2);
      await gravar(db, "1002", "CONFIRMAR", linhas.l2);
      await gravar(db, "1004", "CONFIRMAR", linhas.l4);
      await db.query(`select public.salvar_quadro_de_vagas($1, $2)`, [
        EDITAL,
        JSON.stringify({
          linhas: [
            { cargo: "ENFERMEIRO", lotacao: "Polo base Alfa." },
            { cargo: "Enfermeiro", lotacao: "Polo Base Beta" },
            { cargo: "Médico", lotacao: "Polo Base Alfa" },
            { cargo: "Odontólogo", lotacao: "Polo Base Gama" },
            {
              cargo: "CARGO 7 - Técnico de Enfermagem",
              lotacao: "Polo Base Alfa",
            },
          ],
        }),
      ]);
      const novas = await db.query<{ id: string }>(
        `select "CO_QUADRO_VAGA" as id from public."TB_QUADRO_VAGA_EDITAL"
        where "CO_MONITORAMENTO" = $1 and "ST_REGISTRO_ATIVO" = 'S' order by "NU_ORDEM"`,
        [EDITAL],
      );
      const [n1, n2, n3, , n5] = novas.rows.map((r) => r.id);
      const v = await vinculos(db, EDITAL);
      expect(v.find((x) => x.vaga === "1001")).toMatchObject({
        situacao: "CONFIRMADO",
        origem: "AUTOMATICO",
        quadro: n1,
      });
      expect(v.find((x) => x.vaga === "1002")).toMatchObject({
        situacao: "CONFIRMADO",
        origem: "MANUAL",
        quadro: n2,
      });
      expect(v.find((x) => x.vaga === "1003")).toMatchObject({
        situacao: "CONFIRMADO",
        quadro: n3,
      });
      expect(v.find((x) => x.vaga === "2001")).toMatchObject({
        situacao: "CONFIRMADO",
        regra: "TITULO",
        quadro: n5,
      });
      const sumiu = v.find((x) => x.vaga === "1004");
      expect(sumiu).toMatchObject({
        situacao: "AUSENTE",
        origem: "MANUAL",
        quadro: null,
      });
      expect(sumiu?.pendencia).toMatch(
        /^A linha escolhida \(Cirurgião Dentista 40h — Polo Base Gama\) saiu do quadro em \d\d\/\d\d\/\d{4}\.$/,
      );

      const h = await db.query<{ vaga: string }>(
        `select "CO_VAGA" as vaga from public."TH_VAGA_QUADRO_EDITAL" where "TP_EVENTO" = 'REIMPORTACAO' order by 1`,
      );
      expect(h.rows.map((r) => r.vaga)).toEqual([
        "1001",
        "1002",
        "1003",
        "1004",
        "2001",
      ]);
    });
  });

  describe("quem consulta o vínculo", () => {
    async function quadroDaClassificacao(
      db: Banco,
    ): Promise<Record<string, string | null>> {
      const { rows } = await db.query<{
        dados: { candidatos: { vaga: string; quadro: string | null }[] };
      }>(
        `select private."FC_DADOS_CLASSIFICACAO_EDITAL"($1, 'saude-indigena')::jsonb as dados`,
        [EDITAL],
      );
      return Object.fromEntries(
        rows[0]!.dados.candidatos.map((c) => [c.vaga, c.quadro]),
      );
    }

    it("a Classificação usa a linha confirmada e respeita o 'sem linha'", async () => {
      const db = await bancoMigrado();
      expect(await quadroDaClassificacao(db)).toEqual({
        "1001": linhas.l1,
        "1002": null,
        "1003": linhas.l3,
        "1004": null,
        "1005": null,
      });
      await entrar(db, 2);
      await gravar(db, "1002", "CONFIRMAR", linhas.l2);
      await gravar(db, "1001", "SEM_LINHA");
      expect(await quadroDaClassificacao(db)).toMatchObject({
        "1001": null,
        "1002": linhas.l2,
        "1003": linhas.l3,
      });
    });

    it("a Classificação de hoje e a migrada dão o mesmo quadro sem decisão da equipe", async () => {
      const antes = await bancoAntesComDados();
      const depois = await bancoMigrado();
      const ler = async (db: Banco) =>
        (
          await db.query(
            `select private."FC_DADOS_CLASSIFICACAO_EDITAL"($1, 'saude-indigena')::jsonb -> 'candidatos' as c`,
            [EDITAL],
          )
        ).rows;
      expect(await ler(depois)).toEqual(await ler(antes));
    });

    it("a pré-classificação (FC_QUADRO_DA_VAGA_EMPREGARE) consulta o vínculo antes da regra", async () => {
      const db = await bancoMigrado();
      // Função sql que devolve uma linha composta: sem linha do quadro, vem uma linha toda nula (como hoje).
      const linha = async (vaga: string) =>
        (
          await db.query<{ id: string | null }>(
            `select "CO_QUADRO_VAGA" as id from private."FC_QUADRO_DA_VAGA_EMPREGARE"($1, $2)`,
            [EDITAL, vaga],
          )
        ).rows
          .map((r) => r.id)
          .filter((id) => id !== null);
      expect(await linha("1002")).toEqual([]);
      expect(await linha("2001")).toEqual([linhas.l5]);
      await entrar(db, 2);
      await gravar(db, "1002", "CONFIRMAR", linhas.l2);
      await gravar(db, "2001", "SEM_LINHA");
      expect(await linha("1002")).toEqual([linhas.l2]);
      expect(await linha("2001")).toEqual([]);
    });

    it("a conferência recebe os vínculos com as candidatas", async () => {
      const db = await bancoMigrado();
      const { rows } = await db.query<{
        v: { vaga: string; situacao: string; candidatas: { id: string }[] }[];
      }>(`select public.conferencia_ler_listas_e_quadros() -> 'vinculos' as v`);
      const ambigua = rows[0]!.v.find((x) => x.vaga === "1002");
      expect(ambigua).toMatchObject({ situacao: "AMBIGUO" });
      expect(ambigua?.candidatas.map((c) => c.id)).toEqual([
        linhas.l1,
        linhas.l2,
      ]);
    });

    it("o edital sem vaga com código diz por quê", async () => {
      const db = await bancoMigrado();
      await entrar(db, 1);
      const situacao = async (e: string) =>
        (
          await db.query<{ s: string }>(
            `select public.obter_quadro_de_vagas($1)::jsonb ->> 'vagas_do_edital' as s`,
            [e],
          )
        ).rows[0]!.s;
      expect(await situacao(EDITAL)).toBe("COM_CODIGO");
      expect(await situacao(EDITAL_CANCELADO)).toBe("NAO_SE_APLICA");
      expect(await situacao(EDITAL_EXTERNO)).toBe("EXTERNO");
      expect(await situacao(EDITAL_SEM_CODIGO)).toBe("PENDENTE_INTEGRACAO");
    });
  });
});

bloco("vinculos-do-quadro", () => {
  const L1 = { id: "l1", cargo: "Enfermeiro", lotacao: "Polo Base Alfa" };
  const L2 = { id: "l2", cargo: "Enfermeiro", lotacao: "Polo Base Beta" };
  const L3 = {
    id: "l3",
    cargo: "Cirurgião Dentista 40h",
    lotacao: "Polo Base Vilhena",
  };
  const L4 = { id: "l4", cargo: "Médico", lotacao: null };

  const payload = {
    linhas: [L1, L2, L3, L4, { id: "sem-cargo" }],
    vagas_do_edital: "COM_CODIGO",
    pode_editar: true,
    vinculos: [
      {
        vaga: "1003",
        cargo: "Médico",
        situacao: "CONFIRMADO",
        origem: "AUTOMATICO",
        regra: "NOME",
        quadro: "l4",
        cargo_quadro: "Médico",
      },
      {
        vaga: "1002",
        cargo: "Enfermeiro",
        situacao: "AMBIGUO",
        origem: "AUTOMATICO",
        regra: "NOME",
        candidatas: [L1, L2],
      },
      {
        vaga: "1004",
        cargo: "Cirurgião Dentista - Polo Base Vilhena",
        situacao: "AUSENTE",
        origem: "AUTOMATICO",
        regra: "NOME",
      },
      {
        vaga: "1005",
        cargo: "Agente",
        situacao: "AUSENTE",
        origem: "MANUAL",
        confirmado_por: "Pessoa",
        confirmado_em: "2026-11-18T10:00:00Z",
      },
      {
        vaga: "1006",
        cargo: "Enfermeiro - Polo Base Gama",
        situacao: "AUSENTE",
        origem: "MANUAL",
        pendencia:
          "A linha escolhida (Enfermeiro — Polo Base Gama) saiu do quadro em 18/11/2026.",
        cargo_quadro: "Enfermeiro",
        lotacao_quadro: "Polo Base Gama",
      },
      {
        vaga: "2001",
        cargo: "CARGO 07 - TEC ENF",
        situacao: "CONFIRMADO",
        origem: "AUTOMATICO",
        regra: "TITULO",
        quadro: "l1",
      },
      { vaga: "lixo", situacao: "OUTRA" },
    ],
  };

  describe("filaDoQuadro", () => {
    it("lê o payload e descarta o que não tem forma", () => {
      const fila = filaDoQuadro(payload);
      expect(fila.linhas.map((l) => l.id)).toEqual(["l1", "l2", "l3", "l4"]);
      expect(fila.vinculos.map((v) => v.vaga)).toEqual([
        "1003",
        "1002",
        "1004",
        "1005",
        "1006",
        "2001",
      ]);
      expect(fila.podeEditar).toBe(true);
      expect(fila.vagasDoEdital).toBe("COM_CODIGO");
      expect(fila.vinculos[1]?.candidatas).toEqual([L1, L2]);
    });

    it("sem payload ou com o do banco de antes da migration: sem fila e sem edição", () => {
      expect(filaDoQuadro(null)).toEqual({
        linhas: [],
        vinculos: [],
        vagasDoEdital: null,
        podeEditar: false,
      });
      // O obter_quadro_de_vagas de antes: vínculos sem situação, sem vagas_do_edital.
      expect(
        filaDoQuadro({
          vinculos: [{ vaga: "1", cargo: "Enfermeiro", quadro: null }],
        }),
      ).toMatchObject({ vinculos: [], vagasDoEdital: null });
      expect(filaDoQuadro({ vagas_do_edital: "EXTERNO" }).vagasDoEdital).toBe(
        "EXTERNO",
      );
    });
  });

  describe("separarFila", () => {
    it("três situações; nas ausentes, a linha que saiu primeiro e o 'sem linha' confirmado por último", () => {
      const fila = separarFila(filaDoQuadro(payload).vinculos);
      expect(fila.confirmadas.map((v) => v.vaga)).toEqual(["2001", "1003"]);
      expect(fila.ambiguas.map((v) => v.vaga)).toEqual(["1002"]);
      expect(fila.ausentes.map((v) => v.vaga)).toEqual([
        "1006",
        "1004",
        "1005",
      ]);
      expect(pendentesDaFila(fila)).toBe(3);
    });

    it("'sem linha' confirmado é só o manual sem pendência", () => {
      const [, , v1004, v1005, v1006] = filaDoQuadro(payload)
        .vinculos as VinculoDaVaga[];
      expect([v1004, v1005, v1006].map((v) => semLinhaConfirmado(v!))).toEqual([
        false,
        true,
        false,
      ]);
    });
  });

  describe("linhasParaEscolher", () => {
    it("candidatas primeiro, na ordem do quadro", () => {
      const v = filaDoQuadro(payload).vinculos.find((x) => x.vaga === "1002")!;
      expect(linhasParaEscolher(v, [L4, L3, L2, L1]).map((l) => l.id)).toEqual([
        "l2",
        "l1",
        "l4",
        "l3",
      ]);
    });

    it("sem candidata, a de mais palavras em comum com o nome (o cargo com '40h' que o nome não traz)", () => {
      const v = filaDoQuadro(payload).vinculos.find((x) => x.vaga === "1004")!;
      expect(linhasParaEscolher(v, [L1, L2, L3, L4])[0]).toEqual(L3);
    });
  });

  describe("textos", () => {
    it("rótulo da linha e origem", () => {
      expect(rotuloDaLinha(L1)).toBe("Enfermeiro — Polo Base Alfa");
      expect(rotuloDaLinha(L4)).toBe("Médico");
      const [v1003, , , v1005, , v2001] = filaDoQuadro(payload)
        .vinculos as VinculoDaVaga[];
      expect([v1003, v1005, v2001].map((v) => origemDoVinculo(v!))).toEqual([
        "Pela regra do nome",
        "Pela equipe",
        "Pelo título da Empregare",
      ]);
    });
  });
});

bloco("lib/pagina-do-edital", () => {
  /*
  A página do edital (src/lib/pagina-do-edital/): o endereço pelo número do
  edital, as vagas e os candidatos com as contas da Visão geral e a linha do
  tempo pelas datas de hoje.
*/

  const ID = "0b7c9a52-2d55-4c4e-9f7a-1c3d5e7f9a1b";
  const OUTRO = "7d1e2c3b-4a5f-4e6d-8c7b-9a0f1e2d3c4b";
  const LINHAS = [
    { id: ID, edital: "Edital nº 105/2026", unidade: "DSEI Yanomami" },
    { id: "e2", edital: "Edital 91/2026", unidade: "DSEI Leste" },
    { id: OUTRO, edital: "Edital 120/2026", unidade: "Escritório Distrital" },
    { id: "e4", edital: "Edital 120/2026", unidade: "CCE Norte" },
  ];

  describe("o edital no endereço", () => {
    it("o número vira o pedaço do endereço", () => {
      expect(numeroNoEndereco("Edital nº 105/2026 - DSEI")).toBe("105-2026");
      expect(numeroNoEndereco("Edital 091/2026")).toBe("91-2026");
      expect(numeroNoEndereco("Sem número")).toBe("");
    });

    it("acha o edital pelo número (com ou sem zero à esquerda) ou pelo id", () => {
      expect(editalDoEndereco("105-2026", LINHAS)).toEqual({
        tipo: "um",
        linha: LINHAS[0],
      });
      expect(editalDoEndereco("091-2026", LINHAS)).toEqual({
        tipo: "um",
        linha: LINHAS[1],
      });
      expect(editalDoEndereco(OUTRO, LINHAS)).toEqual({
        tipo: "um",
        linha: LINHAS[2],
      });
    });

    it("dois editais de mesmo número na área: a escolha; nenhum: nenhum", () => {
      expect(editalDoEndereco("120-2026", LINHAS)).toEqual({
        tipo: "varios",
        linhas: [LINHAS[2], LINHAS[3]],
      });
      expect(editalDoEndereco("7-2030", LINHAS)).toEqual({ tipo: "nenhum" });
      expect(editalDoEndereco("", LINHAS)).toEqual({ tipo: "nenhum" });
      expect(editalDoEndereco("qualquer-coisa", LINHAS)).toEqual({
        tipo: "nenhum",
      });
    });

    it("o endereço de um edital: o número, se for só dele na área; senão o id", () => {
      expect(enderecoDoEdital(LINHAS[0]!, LINHAS)).toBe("105-2026");
      expect(enderecoDoEdital(LINHAS[2]!, LINHAS)).toBe(OUTRO);
      expect(enderecoDoEdital({ id: "x", edital: "Sem número" }, LINHAS)).toBe(
        "x",
      );
      // O endereço volta para o mesmo edital.
      for (const linha of LINHAS)
        expect(
          editalDoEndereco(enderecoDoEdital(linha, LINHAS), LINHAS),
        ).toEqual({ tipo: "um", linha });
    });
  });

  describe("vagas e candidatos", () => {
    it("só confirma cadastro reserva com quadro completo e sem imediatas", () => {
      const linha = {
        cargo: "Químico",
        vagas_imediatas: 0,
        cadastro_reserva: true,
      };
      expect(somenteCadastroReserva({ linhas: [linha] })).toBe(true);
      for (const dados of [
        null,
        { linhas: [] },
        { linhas: [{ ...linha, vagas_imediatas: null }] },
        { linhas: [{ ...linha, vagas_imediatas: "" }] },
        { linhas: [{ ...linha, vagas_imediatas: 1 }] },
        { linhas: [linha, { ...linha, cadastro_reserva: false }] },
        { linhas: [linha, {}] },
      ])
        expect(somenteCadastroReserva(dados)).toBe(false);
    });

    it("0 de 70 preenchidas, com as reabertas e o cadastro reserva à parte", () => {
      expect(situacaoDasVagas({ vagas_total: 70, contratados: 0 })).toEqual({
        imediatas: 70,
        preenchidas: 0,
        reabertas: 0,
        abertas: 70,
        cadastroReserva: 0,
        texto: "0 de 70 preenchidas",
      });
      expect(
        situacaoDasVagas({
          vagas_total: 10,
          contratados: 13,
          vagas_reabertas: 0,
        }),
      ).toMatchObject({ preenchidas: 10, abertas: 0, cadastroReserva: 3 });
      expect(
        situacaoDasVagas({
          vagas_total: 10,
          contratados: 4,
          vagas_reabertas: 2,
        }),
      ).toMatchObject({ preenchidas: 4, reabertas: 2, abertas: 4 });
      expect(situacaoDasVagas({ vagas_total: 1 }).texto).toBe(
        "0 de 1 preenchida",
      );
    });

    it("candidatos: aprovados, contratados, aguardando e demais", () => {
      expect(
        situacaoDosCandidatos({
          aprovados: 30,
          cadastro_reserva: 12,
          contratados: 10,
          desistentes: 3,
        }),
      ).toEqual({
        temLista: true,
        aprovados: 30,
        contratados: 10,
        aguardando: 12,
        desistentes: 3,
        demais: 5,
      });
      // Sem lista vigente: só os contratados.
      expect(
        situacaoDosCandidatos({ aprovados: null, contratados: 2 }),
      ).toMatchObject({ temLista: false, contratados: 2, demais: 0 });
    });
  });

  describe("linha do tempo", () => {
    const ETAPAS = [
      { ordem: 1, atividade: "Publicação", data_inicio: "2026-10-01" },
      {
        ordem: 2,
        atividade: "Inscrições",
        data_inicio: "2026-10-02",
        data_fim: "2026-11-30",
      },
      { ordem: 3, atividade: "Resultado", data_inicio: "2026-12-10" },
      { ordem: 4, atividade: "Homologação", data_inicio: "2026-12-20" },
    ];

    it("concluída, etapa atual e prevista, pelas datas de hoje", () => {
      const etapas = etapasNaLinhaDoTempo(ETAPAS, "2026-11-18");
      expect(etapas.map((e) => [e.atividade, e.marca, e.proxima])).toEqual([
        ["Publicação", "concluida", false],
        ["Inscrições", "atual", false],
        ["Resultado", "prevista", true],
        ["Homologação", "prevista", false],
      ]);
      expect(etapas[0]).toMatchObject({
        inicio: "2026-10-01",
        fim: "2026-10-01",
      });
      expect(contagemDasMarcas(etapas)).toEqual({
        concluida: 1,
        atual: 1,
        prevista: 2,
      });
      expect(etapasNaLinhaDoTempo(null, "2026-11-18")).toEqual([]);
    });

    it("retificações: só as erratas, da mais recente para a mais antiga", () => {
      expect(
        retificacoesDoHistorico([
          { acao: "salvar", created_at: "2026-11-01T10:00:00Z" },
          {
            acao: "errata",
            numero_errata: "Errata nº 1",
            motivo: "SEI 123",
            total_alteracoes: 2,
            created_at: "2026-10-01T10:00:00Z",
          },
          { acao: "errata", created_at: "2026-11-10T10:00:00Z" },
        ]),
      ).toEqual({
        retificacoes: [
          {
            chave: "2026-11-10T10:00:00Z:1",
            titulo: "Retificação",
            quando: "2026-11-10T10:00:00Z",
            motivo: "",
            alteracoes: 0,
          },
          {
            chave: "2026-10-01T10:00:00Z:0",
            titulo: "Errata nº 1",
            quando: "2026-10-01T10:00:00Z",
            motivo: "SEI 123",
            alteracoes: 2,
          },
        ],
        outrasAlteracoes: 1,
      });
    });
  });

  describe("situação excepcional", () => {
    it("a gravada no cronograma, com motivo e retomada", () => {
      expect(
        situacaoExcepcional(
          {
            status_override: "Suspenso",
            status_override_motivo: "Decisão judicial",
            status_override_data: "2026-11-01",
            status_override_previsao_retomada: "2027-01-10",
          },
          "Em andamento",
        ),
      ).toEqual({
        status: "Suspenso",
        motivo: "Decisão judicial",
        data: "2026-11-01",
        retomada: "2027-01-10",
      });
    });

    it("sem a gravada, a do status; edital normal, nenhuma", () => {
      expect(situacaoExcepcional(null, "Processo paralisado")).toEqual({
        status: "Paralisado",
        motivo: "",
        data: "",
        retomada: "",
      });
      expect(situacaoExcepcional({}, "Cancelado")?.status).toBe("Cancelado");
      expect(situacaoExcepcional(null, "Em andamento")).toBeNull();
    });
  });

  describe("abas, telas, fontes e quadro", () => {
    it("as abas da página; a que não existe não vale", () => {
      expect(ehAbaDaPagina("etapas")).toBe(true);
      expect(ehAbaDaPagina("qualquer")).toBe(false);
    });

    it("andamento: as etapas atuais e a próxima prevista", () => {
      const etapas = etapasNaLinhaDoTempo(
        [
          { atividade: "A", data_inicio: "2026-10-01" },
          { atividade: "B", data_inicio: "2026-11-01", data_fim: "2026-11-30" },
          { atividade: "C", data_inicio: "2026-12-01" },
          { atividade: "D", data_inicio: "2026-12-10" },
        ],
        "2026-11-18",
      );
      const { atuais, proxima } = andamentoDasEtapas(etapas);
      expect(atuais.map((e) => e.atividade)).toEqual(["B"]);
      expect(proxima?.atividade).toBe("C");
    });

    it("telas da seleção na ordem do processo, só as que o perfil abre", () => {
      expect(
        telasDoEdital((view) => view !== "selecao").map((t) => t.view),
      ).toEqual([
        "pre-classificacao",
        "avaliacao-documental",
        "analisar-recursos",
        "conduzir-entrevistas",
        "classificacao",
        "approved",
      ]);
      expect(telasDoEdital(() => false)).toEqual([]);
    });

    it("origem do cronograma e histórico inteiro, do mais recente ao mais antigo", () => {
      expect(origemDoCronograma("pdf")).toBe("importado do PDF de anexos");
      expect(origemDoCronograma("")).toBe("");
      expect(origemDoCronograma("OUTRA")).toBe("outra");
      expect(
        historicoDoCronograma([
          { acao: "salvar", created_at: "2026-10-01T10:00:00Z", motivo: "x" },
          {
            acao: "errata",
            numero_errata: "Errata nº 2",
            created_at: "2026-11-01T10:00:00Z",
            created_by_email: "pessoa@exemplo.org",
            total_alteracoes: 1,
          },
        ]).map((r) => [r.tipo, r.titulo, r.quem, r.alteracoes]),
      ).toEqual([
        ["retificacao", "Errata nº 2", "pessoa@exemplo.org", 1],
        ["alteracao", "Alteração", "", 0],
      ]);
    });

    it("o quadro de vagas sem confiar no formato", () => {
      const quadro = quadroDaPagina({
        linhas: [
          {
            id: "q1",
            cargo: "Enfermeiro",
            lotacao: null,
            modalidades: { Ampla: 2, PcD: null },
            vagas_imediatas: 2,
            cadastro_reserva: false,
          },
          { id: "q2", cargo: "" },
          "lixo",
        ],
        origem: { tipo: "MANUAL", arquivo: null },
        vinculos: [],
        vagas_do_edital: "PENDENTE_INTEGRACAO",
      });
      expect(quadro.linhas).toEqual([
        {
          id: "q1",
          cargo: "Enfermeiro",
          lotacao: "",
          imediatas: 2,
          cadastroReserva: false,
          modalidades: [{ nome: "Ampla", valor: "2" }],
        },
      ]);
      expect(quadro.origem).toEqual({
        tipo: "MANUAL",
        arquivo: "",
        gravadoEm: "",
      });
      expect(quadro.fila.vagasDoEdital).toBe("PENDENTE_INTEGRACAO");
      expect(quadroDaPagina(null)).toMatchObject({ linhas: [], origem: null });
    });
  });
});

bloco("lib/reativar-edital", () => {
  /*
    Reativar edital (Editais, Histórico): a etapa nova de hoje até a data de
    fim, a validação, quem pode ser reativado e o payload da mesma RPC do
    formulário. "Agora" é 24/11/2026 às 02:00 UTC — ainda 23/11 em Brasília.
  */
  const AGORA = new Date("2026-11-24T02:00:00Z");
  const ETAPAS_DO_BANCO = [
    {
      ordem: 1,
      atividade: "Publicação do Edital",
      data_inicio: "2025-03-01",
      data_fim: "2025-03-01",
    },
    {
      ordem: 2,
      atividade: "Resultado final do Processo Seletivo",
      data_inicio: "2025-06-10",
      data_fim: "2025-06-10",
    },
  ];
  const lido = (monitoramento: Record<string, unknown> = {}) =>
    cronogramaDaReativacao({
      monitoramento: {
        cronograma_automatico: true,
        nu_anos_validade: 1,
        nu_meses_validade: 0,
        st_prorrogado: false,
        ...monitoramento,
      },
      etapas: ETAPAS_DO_BANCO,
    });
  const LINHA = {
    id: "ed-15",
    edital: "15/2025",
    unidade: "DSEI Fictício",
    id_unidade: "U9",
    sigla_unidade: "DSEI-FIC",
    tipo_unidade: "DSEI",
    uf: "MT",
    responsavel: "USI",
    processo: "25000.000000/2025-00",
    vagas_total: 12,
    status: "Concluído",
    etapa: "Resultado final do Processo Seletivo",
    risco: "Baixo",
    link_edital: "https://exemplo.invalid/edital.pdf",
    data_inicio: "2025-03-01",
    data_fim: "2025-06-10",
    CO_AREA: "saude-indigena",
  };
  const DADOS = {
    motivo: "Convocar os remanescentes da lista",
    dataFim: "2027-01-31",
    atividade: ETAPA_PADRAO_DA_REATIVACAO,
  };

  it("o ⋯ oferece a ação no concluído e no cancelado, nunca no ativo ou desativado", () => {
    expect(acaoDeReativarNaLinha({ status: "Concluído" })).toBe("reativar");
    expect(acaoDeReativarNaLinha({ status: "Cancelado" })).toBe("cancelado");
    expect(acaoDeReativarNaLinha({ status: "Em andamento" })).toBeNull();
    expect(
      acaoDeReativarNaLinha({ status: "Concluído", ativo: false }),
    ).toBeNull();
    expect(acaoDeReativarNaLinha(null)).toBeNull();
  });

  it("só reativa o concluído pelo cronograma, com cálculo automático e sem status excepcional", () => {
    expect(bloqueioDaReativacao(lido(), AGORA)).toBeNull();
    expect(
      bloqueioDaReativacao(
        lido({
          status_override: "Cancelado",
          status_override_motivo: "x",
          status_override_data: "2025-07-01",
        }),
        AGORA,
      ),
    ).toMatchObject({ motivo: "excepcional", peloFormulario: true });
    expect(
      bloqueioDaReativacao(lido({ cronograma_automatico: false }), AGORA),
    ).toMatchObject({ motivo: "manual", peloFormulario: true });
    expect(
      bloqueioDaReativacao(cronogramaDaReativacao({ etapas: [] }), AGORA),
    ).toMatchObject({ motivo: "sem-cronograma" });
    const andando = cronogramaDaReativacao({
      etapas: [
        ...ETAPAS_DO_BANCO,
        {
          atividade: "Etapa nova",
          data_inicio: "2026-11-01",
          data_fim: "2026-12-31",
        },
      ],
    });
    expect(bloqueioDaReativacao(andando, AGORA)).toMatchObject({
      motivo: "nao-concluido",
      peloFormulario: false,
    });
  });

  it("exige motivo de 10 a 500, data depois de hoje em Brasília e nome de etapa que não se repete", () => {
    const etapas = lido().etapas;
    expect(semErros(errosDaReativacao(DADOS, etapas, AGORA))).toBe(true);
    expect(
      errosDaReativacao({ ...DADOS, motivo: " curto " }, etapas, AGORA).motivo,
    ).toContain("de 10 a 500");
    expect(
      errosDaReativacao({ ...DADOS, motivo: "x".repeat(501) }, etapas, AGORA)
        .motivo,
    ).toBeTruthy();
    expect(
      errosDaReativacao({ ...DADOS, dataFim: "" }, etapas, AGORA).dataFim,
    ).toBe("Informe a nova data de fim.");
    // 23/11 é hoje em Brasília (02:00 UTC do dia 24): hoje não é futuro; amanhã é.
    expect(
      errosDaReativacao({ ...DADOS, dataFim: "2026-11-23" }, etapas, AGORA)
        .dataFim,
    ).toBe("A data de fim precisa ser depois de hoje.");
    expect(
      errosDaReativacao({ ...DADOS, dataFim: "2026-11-24" }, etapas, AGORA)
        .dataFim,
    ).toBeUndefined();
    expect(
      errosDaReativacao({ ...DADOS, dataFim: "2202-01-01" }, etapas, AGORA)
        .dataFim,
    ).toContain("ano até 2100");
    expect(
      errosDaReativacao({ ...DADOS, atividade: "   " }, etapas, AGORA)
        .atividade,
    ).toBe("Informe o nome da etapa.");
    expect(
      errosDaReativacao(
        { ...DADOS, atividade: "publicação  do edital" },
        etapas,
        AGORA,
      ).atividade,
    ).toContain("Já existe uma etapa");
  });

  it("a etapa nova vai de hoje (Brasília) até a data de fim, no fim do cronograma", () => {
    const etapas = etapasComReativacao(
      lido().etapas,
      { atividade: "  Convocação   de remanescentes ", dataFim: "2027-01-31" },
      AGORA,
    );
    expect(etapas).toHaveLength(3);
    expect(etapas[2]).toMatchObject({
      ordem: 3,
      atividade: "Convocação de remanescentes",
      data_inicio: "2026-11-23",
      data_fim: "2027-01-31",
      origem: "MANUAL",
    });
    expect(etapas.map((e) => e.ordem)).toEqual([1, 2, 3]);
  });

  it("o payload é o edital gravado com o cronograma novo: Em andamento até a data de fim", () => {
    const cronograma = lido();
    const etapas = etapasComReativacao(cronograma.etapas, DADOS, AGORA);
    const edital = editalParaReativar(
      LINHA,
      cronograma,
      etapas,
      "saude-indigena",
      AGORA,
    );
    expect(edital).toMatchObject({
      id: "ed-15",
      edital: "15/2025",
      unidade: "DSEI Fictício",
      id_unidade: "U9",
      sigla_unidade: "DSEI-FIC",
      tipo_unidade: "DSEI",
      uf: "MT",
      processo: "25000.000000/2025-00",
      vagas_total: 12,
      link_edital: "https://exemplo.invalid/edital.pdf",
      status: "Em andamento",
      etapa: "Convocação de remanescentes",
      data_inicio: "2025-03-01",
      data_fim: "2027-01-31",
      cronograma_automatico: true,
      status_override: null,
      nu_anos_validade: 1,
      nu_meses_validade: 0,
      st_prorrogado: false,
      co_area: "saude-indigena",
    });
    // Sem a validade no banco (RPC antiga), nada dela vai: o gravado fica.
    const semValidade = editalParaReativar(
      LINHA,
      cronogramaDaReativacao({ etapas: ETAPAS_DO_BANCO }),
      etapas,
      "saude-indigena",
      AGORA,
    );
    expect(semValidade).not.toHaveProperty("nu_anos_validade");
    expect(semValidade).not.toHaveProperty("st_prorrogado");
  });

  it("o motivo vai ao histórico dizendo que foi uma reativação", () => {
    expect(motivoDaReativacao("  Convocar remanescentes ")).toBe(
      "Reativação do edital: Convocar remanescentes",
    );
  });

  it("acha a lista vigente do edital nas linhas de listar_listas_aprovados", () => {
    const linhas = [
      { lista_id: "l-outra", edital_id: "ed-99", ativo: true },
      { lista_id: "l-15", edital_id: "ed-15", ativo: false },
    ];
    expect(listaVigenteDoEdital(linhas, "ed-15")).toEqual({
      id: "l-15",
      ativa: false,
    });
    expect(listaVigenteDoEdital(linhas, "ed-1")).toBeNull();
    expect(listaVigenteDoEdital({ erro: true }, "ed-15")).toBeNull();
    expect(listaVigenteDoEdital([{ edital_id: "ed-15" }], "ed-15")).toBeNull();
  });

  it("a lista inativa volta a ficar ativa com a nova validade; sem Importação, diz quem ativa", () => {
    const validade = lido().validade;
    const inativa = { id: "l-15", ativa: false };
    // Fim novo 31/01/2027 + 1 ano: validade até 31/01/2028.
    expect(
      listaNaReativacao({
        lista: inativa,
        podeAtivar: true,
        validade,
        dataFim: "2027-01-31",
        agora: AGORA,
      }),
    ).toEqual({
      tipo: "ativar",
      texto:
        "A lista de aprovados, hoje inativa, volta a ficar ativa, com validade até 31/01/2028.",
    });
    // Sem data ainda, ou sem a validade lida: sem a data da validade.
    expect(
      listaNaReativacao({
        lista: inativa,
        podeAtivar: true,
        validade,
        dataFim: "",
        agora: AGORA,
      })?.texto,
    ).toBe("A lista de aprovados, hoje inativa, volta a ficar ativa.");
    expect(
      listaNaReativacao({
        lista: inativa,
        podeAtivar: false,
        validade,
        dataFim: "2027-01-31",
        agora: AGORA,
      }),
    ).toMatchObject({
      tipo: "sem-permissao",
      texto: expect.stringContaining(
        "quem a ativa é quem tem nível Editor em Importação e convocação, ou o administrador global",
      ),
    });
    expect(
      listaNaReativacao({
        lista: "nao-lida",
        podeAtivar: false,
        validade,
        dataFim: "2027-01-31",
        agora: AGORA,
      })?.tipo,
    ).toBe("nao-lida");
    // Lista ativa ou nenhuma lista: nada a dizer.
    for (const lista of [{ id: "l-15", ativa: true }, null])
      expect(
        listaNaReativacao({
          lista,
          podeAtivar: true,
          validade,
          dataFim: "2027-01-31",
          agora: AGORA,
        }),
      ).toBeNull();
  });

  it("diz em uma frase o que vai acontecer", () => {
    expect(textoDaReativacao(DADOS, AGORA)).toBe(
      'O edital volta para Ativos, com status "Em andamento" até 31/01/2027. A etapa "Convocação de remanescentes" entra no cronograma a partir de hoje (23/11/2026), e o motivo fica no histórico do edital.',
    );
    expect(textoDaReativacao({ atividade: "", dataFim: "" }, AGORA)).toContain(
      "até a data informada",
    );
  });
});
