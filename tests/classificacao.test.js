// @vitest-environment node
import { bloco } from "./apoio/bloco.ts";
import { readFileSync } from "node:fs";
import { describe, expect, it, afterEach, vi } from "vitest";
import {
  classificar,
  limiteDaConvocacao,
  prepararCandidatos,
} from "../src/lib/classificacao/motor.ts";
import {
  validarRegra,
  normalizarRegra,
  REGRA_VAZIA,
} from "../src/lib/classificacao/regra.ts";
import {
  horaBR,
  lerHora,
  segundosDeVida,
  arredondar,
  dataBR,
  escalar,
  formatarNota,
  idadeNaData,
  numeroBR,
} from "../src/lib/classificacao/numeros.ts";
import {
  CRITERIO_POR_CODIGO,
  TIPOS_DE_LISTA,
  CATALOGO_DE_CRITERIOS,
  codigosDaModalidade,
  simOuNao,
} from "../src/lib/classificacao/catalogo.ts";
import {
  MARCA_SEM_VALOR_OFICIAL,
  editalEscolhido,
  ehEditalDeTreinamento,
  semTreinamento,
  sufixoDeTreinamento,
} from "../src/lib/editais/edital-de-treinamento.ts";
import {
  normalizarPainel,
  opcoesDosEditais,
} from "../src/lib/automacao/painel-dos-robos.ts";
import {
  documentoOficial,
  chaveDoModelo,
  faseDaPublicacao,
  textoParaSei,
  htmlParaSei,
} from "../src/lib/classificacao/documento-sei.ts";
import {
  instantaneoDaLista,
  nomeDoArquivo,
  gerarXlsxDaLista,
  linhasDaPlanilha,
  gerarXlsx,
} from "../src/lib/classificacao/exportacao.ts";
import { editaisParaConduzir } from "../src/lib/entrevistas/conducao-de-entrevista.ts";
import { editaisDaEscolha } from "../src/lib/avaliacao-documental/editais.ts";
import { indicadoresDaVisaoGeral } from "../src/lib/visao-geral/visao-geral.ts";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.ts";
import { COLUNAS_DO_MONITORAMENTO } from "../src/app/carga.ts";
import { criarEstadoDaPreClassificacao } from "../src/modulos/avaliacao-documental/estado-da-pre-classificacao.ts";
import {
  contadoresDaPreClassificacao,
  declaradasCongeladas,
  lotesAPublicar,
  nota,
  regraComTamanhos,
  tamanhoDefinido,
  tamanhoSugerido,
  textoDoAviso,
  vagasDaTela,
} from "../src/lib/avaliacao-documental/tela-da-pre-classificacao.ts";
import {
  candidatoAtual,
  classificarEdital,
  itensDoAjuste,
  itensParaEnviar,
  listaDaOrigem,
  montarItens,
  previaDoAjuste,
  validarAjuste,
} from "../src/lib/classificacao/ajustes.ts";
import {
  listaDesatualizada,
  assinaturaDoRetrato,
  avisosAgrupados,
  dataDeCorteDoCronograma,
  geracaoDesatualizada,
  filtrosAtivosDoRecorte,
  listaDaFase,
  recortarResultado,
  RECORTE_VAZIO,
  chaveDoRecorte,
  normalizarRecorte,
  pessoasDoRecorte,
} from "../src/lib/classificacao/dados.ts";
import {
  calculoLido,
  caminhoSeguro,
  diferencasDosRetratos,
  esperaOJob,
  respostaDoPedido,
  textoDoPedidoParado,
} from "../src/lib/classificacao/calculo-em-python.ts";
import {
  convocacaoDoEdital,
  codigoDaCategoria,
  divergenciasDasCotas,
  modeloDaRegra,
  vagasDaConvocacao,
  vagasPelaConta,
} from "../src/lib/classificacao/convocacao-do-edital.ts";
import {
  retratoDaClassificacao,
  editaisDaClassificacao,
  dadosDaClassificacao,
  regraDaClassificacao,
  listaComRetrato,
  desempateRegistrado,
  listaRegistrada,
} from "../src/lib/classificacao/dados-do-estado.ts";
import {
  colunasDisponiveis,
  colunasEscolhidas,
  colunasPadrao,
  colunasParaGuardar,
  ehOPadrao,
} from "../src/lib/classificacao/colunas-do-documento.ts";
import {
  vagasPelosPercentuais,
  nivelDaVaga,
  textoDasVagas,
} from "../src/lib/classificacao/vagas.ts";
import { derivarQuadro } from "../src/lib/aprovados/lista-convocacao-rules.ts";
import { modeloDeReferencia } from "../src/lib/aprovados/carta-de-convocacao/modelo-de-convocacao.ts";
import {
  alterarCampoDaRegra,
  alterarGrupoDaRegra,
  alterarListaDaRegra,
  listaEmMaiusculas,
  niveisPorCargo,
  numeroOuNulo,
  textoDosNiveisPorCargo,
} from "../src/lib/classificacao/edicao-da-regra.ts";
import {
  ALTURA_DA_PAGINA,
  escalaParaLargura,
  LARGURA_DA_FOLHA,
  limitarEscala,
  proximoZoom,
  rotuloDoZoom,
  tamanhoEscalado,
} from "../src/lib/classificacao/escala-da-previa.ts";
import {
  gerarDocxOficial,
  tabelaXml,
} from "../src/lib/classificacao/documento-docx.ts";
import {
  hashDoRetrato,
  numeroCanonico,
  textoCanonicoDoRetrato,
} from "../src/lib/classificacao/hash-do-retrato.ts";
import {
  sha256Hex,
  chaveDoGrupo,
  ordemDoSorteio,
  conferirSorteio,
  sementeValida,
} from "../src/lib/classificacao/sorteio.ts";
import {
  acompanharPreparoDoDesempate,
  ESPERA_DO_RELATORIO_MS,
  estadoDoRelatorio,
  lerDesempateDaLista,
  lerRespostaDoDesempate,
  linhasDoCabecalho,
  momentoBR,
  nomeDaLista,
  paginaDoDesempate,
  planilhasDoDesempate,
  resumoDoDesempate,
  textoDoValor,
  VERSAO_DO_RELATORIO,
  VERSOES_LIDAS,
} from "../src/lib/classificacao/relatorio-de-desempate.ts";
import { createHash } from "node:crypto";
import {
  normalizarDadosDosAjustes,
  normalizarDadosParaPrevia,
  normalizarPreviaDoAjuste,
} from "../src/lib/classificacao/dados-dos-ajustes.ts";
import { criarEstadoDaAgenda } from "../src/modulos/classificacao/estado-da-agenda.ts";
import { criarEstadoDaClassificacao } from "../src/modulos/classificacao/estado.ts";
import { calcularClassificacao } from "../src/modulos/classificacao/classificacao.tsx";

bloco("classificacao-114-desempate", () => {
  /*
  Edital 114/2026 (Projetos, AGSUS/FUNASA PES Rio Doce): versão 2 da regra de
  classificação — o desempate do item 10.1 (a) 60 anos ou mais, b) maior tempo
  de experiência profissional comprovado, c) maior idade, com a hora da
  certidão, 6.11.3/6.11.4) também na lista preliminar (8.2.10.10, 9.1, 9.2).
  A regra é a do seed (v1, 02/10/2026) com o $patch$ da correção
  tests/fixtures/sql-de-dados/20261015-edital-114-classificacao-v2-desempate.sql.
  A data de corte da regra continua nula: vale o fim das inscrições do
  cronograma (14/10/2026), que a tela passa ao motor como `dataCorte`.
  Códigos e nomes fictícios, sem dado pessoal.
*/

  const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
  const SEED = ler(
    "tests/fixtures/sql-de-dados/20261002-regras-de-classificacao-todos-os-editais.sql",
  );
  const CORRECAO = ler(
    "tests/fixtures/sql-de-dados/20261015-edital-114-classificacao-v2-desempate.sql",
  );

  const REGRA_V1 = JSON.parse(
    /\('bcecfb08-88ef-4e06-8401-bcad6bf88fd0'::uuid, '114\/2026', 'projetos', '[^']+', \$r\$(.*?)\$r\$::jsonb\)/.exec(
      SEED,
    )[1],
  );
  const PATCH = JSON.parse(/\$patch\$(.*?)\$patch\$/.exec(CORRECAO)[1]);
  const REGRA_V2 = {
    ...REGRA_V1,
    listas: {
      ...REGRA_V1.listas,
      PRELIMINAR: { ...REGRA_V1.listas.PRELIMINAR, ...PATCH.listas.PRELIMINAR },
    },
  };
  const FIM_DAS_INSCRICOES = "2026-10-14";

  let n = 0;
  const id = () => `00000000-0000-4000-8114-${String(++n).padStart(12, "0")}`;
  const cand = (nome, nota, campos = {}) => ({
    analise_id: id(),
    codigo: String(11400000 + n),
    nome,
    vaga: "114001",
    cargo: "CARGO 1: ANALISTA DE GESTÃO -",
    modalidade: "Ampla concorrência",
    pcd: "NÃO",
    status: "Aprovado",
    etapa: "Triados",
    nota_documental: nota,
    data_nascimento: "1985-06-15",
    exp_profissional: 1500,
    quadro: "q1",
    ...campos,
  });
  const QUADRO = [
    {
      id: "q1",
      ordem: 1,
      cargo: "ANALISTA DE GESTÃO (Nível Superior)",
      modalidades: {},
      vagas_imediatas: 2,
      cadastro_reserva: true,
    },
  ];
  const lista = (
    candidatos,
    {
      regra = REGRA_V2,
      tipo = "PRELIMINAR",
      dataCorte = FIM_DAS_INSCRICOES,
    } = {},
  ) => classificar({ tipo, regra, candidatos, quadro: QUADRO, dataCorte });
  const geral = (r) =>
    r.vagas[0].geral.map((l) => `${l.posicao} ${l.nome}`).join(" | ");

  describe("regra do 114/2026: v1 → v2", () => {
    it("só a preliminar muda; critérios do 10.1 na ordem; data de corte segue nula", () => {
      expect(REGRA_V1.listas.PRELIMINAR.empate).toBe("MESMA_POSICAO");
      expect(REGRA_V1.listas.FINAL.empate).toBe("CRITERIOS");
      expect(REGRA_V2.desempate).toEqual([
        { criterio: "IDOSO_60", direcao: "SIM_PRIMEIRO" },
        { criterio: "EXP_PROFISSIONAL_TEMPO", direcao: "MAIOR_PRIMEIRO" },
        { criterio: "MAIOR_IDADE", direcao: "MAIOR_PRIMEIRO" },
      ]);
      expect(REGRA_V2.listas).toEqual({
        ...REGRA_V1.listas,
        PRELIMINAR: { empate: "CRITERIOS" },
      });
      expect(PATCH).toEqual({
        listas: { PRELIMINAR: { empate: "CRITERIOS" } },
      });
      expect(REGRA_V2.data_corte).toBeNull();
      expect(validarRegra(REGRA_V2)).toEqual([]);
      expect(CORRECAO).toContain(
        "if v_atual #>> '{listas,PRELIMINAR,empate}' = 'CRITERIOS' then",
      );
      expect(CORRECAO).toContain(
        'perform private."FC_VALIDAR_REGRA_CLASSIFICACAO"(v_nova);',
      );
      expect(CORRECAO).toContain("a01afddb-f64b-47d9-80e8-476a1ed14e43");
    });
  });

  describe("lista preliminar do 114/2026 — desempate do item 10.1", () => {
    it("v1: empatados na mesma posição; v2: a) 60+ primeiro, mesmo com menos experiência", () => {
      const candidatos = [
        cand("Ana", 40, {
          exp_profissional: 3000,
          data_nascimento: "1990-01-01",
        }),
        cand("Bia", 40, {
          exp_profissional: 200,
          data_nascimento: "1960-03-01",
        }),
        cand("Caio", 35),
      ];
      expect(geral(lista(candidatos, { regra: REGRA_V1 }))).toBe(
        "1 Ana | 1 Bia | 2 Caio",
      );
      const r = lista(candidatos);
      expect(geral(r)).toBe("1 Bia | 2 Ana | 3 Caio");
      expect(
        r.explicacoes[candidatos[1].analise_id].explicacao.join(" "),
      ).toContain("por 60+ (sim × não)");
      expect(r.pendencias).toEqual([]);
    });

    it("60 anos contados até o fim das inscrições (14/10/2026): quem faz 60 no dia 15 não é idoso", () => {
      const candidatos = [
        cand("Ana", 30, {
          exp_profissional: 5000,
          data_nascimento: "1966-10-15",
        }),
        cand("Bia", 30, {
          exp_profissional: 100,
          data_nascimento: "1966-10-14",
        }),
      ];
      expect(geral(lista(candidatos))).toBe("1 Bia | 2 Ana");
    });

    it("dois com 60+: b) a experiência decide", () => {
      const candidatos = [
        cand("Ana", 30, {
          exp_profissional: 1000,
          data_nascimento: "1950-01-01",
        }),
        cand("Bia", 30, {
          exp_profissional: 1001,
          data_nascimento: "1960-01-01",
        }),
      ];
      const r = lista(candidatos);
      expect(geral(r)).toBe("1 Bia | 2 Ana");
      expect(
        r.explicacoes[candidatos[1].analise_id].explicacao.join(" "),
      ).toContain("por tempo de experiência (1001 dias × 1000 dias)");
    });

    it("nenhum com 60+: b) mais experiência primeiro", () => {
      const candidatos = [
        cand("Ana", 30, {
          exp_profissional: 900,
          data_nascimento: "1970-01-01",
        }),
        cand("Bia", 30, {
          exp_profissional: 2400,
          data_nascimento: "1995-01-01",
        }),
      ];
      expect(geral(lista(candidatos))).toBe("1 Bia | 2 Ana");
    });

    it("mesma experiência: c) maior idade pela data de nascimento", () => {
      const candidatos = [
        cand("Ana", 30, { data_nascimento: "1990-01-02" }),
        cand("Bia", 30, { data_nascimento: "1980-01-02" }),
      ];
      const r = lista(candidatos);
      expect(geral(r)).toBe("1 Bia | 2 Ana");
      expect(
        r.explicacoes[candidatos[1].analise_id].explicacao.join(" "),
      ).toContain("por idade (nasc. 02/01/1980 × nasc. 02/01/1990)");
    });

    it("mesmo dia: a hora da certidão (6.11.3); sem certidão vale 23h59min59s (6.11.4)", () => {
      const candidatos = [
        cand("Ana", 30),
        cand("Bia", 30, { hora_nascimento: "22:10" }),
      ];
      const r = lista(candidatos);
      expect(geral(r)).toBe("1 Bia | 2 Ana");
      expect(
        r.explicacoes[candidatos[1].analise_id].explicacao.join(" "),
      ).toContain(
        "por idade (22h10min00s pela certidão × 23h59min59s, sem certidão)",
      );
    });

    it("empate em tudo (mesmo dia, sem certidão): mesma posição, o edital não define", () => {
      const r = lista([cand("Ana", 30), cand("Bia", 30)]);
      expect(geral(r)).toBe("1 Ana | 1 Bia");
    });

    it("a final não muda (já usava os critérios na v1)", () => {
      const candidatos = [
        cand("Ana", 40, {
          exp_profissional: 3000,
          data_nascimento: "1990-01-01",
        }),
        cand("Bia", 40, {
          exp_profissional: 200,
          data_nascimento: "1960-03-01",
        }),
      ];
      expect(geral(lista(candidatos, { regra: REGRA_V1, tipo: "FINAL" }))).toBe(
        geral(lista(candidatos, { tipo: "FINAL" })),
      );
      expect(geral(lista(candidatos, { tipo: "FINAL" }))).toBe("1 Bia | 2 Ana");
    });

    it("sem a data do cronograma, o motor avisa (a regra não tem data de corte)", () => {
      const r = lista([cand("Ana", 30), cand("Bia", 30)], { dataCorte: null });
      expect(r.avisos.some((a) => a.codigo === "SEM_DATA_CORTE")).toBe(true);
    });
  });
});

bloco("classificacao-93-desempate", () => {
  /*
  Auditoria do edital 93/2026 (Projetos, análise documental pela planilha):
  a lista "Avaliação documental — resultado preliminar" contra o edital
  (8.2.6 nota mínima 15; 8.2.1 eliminação; 8.2.10.10 e 9.3 ordem de
  classificação com desempate; 10.1 a) 60+, b) maior tempo de experiência,
  c) maior idade com a hora da certidão, 6.11.5/6.11.6; 4.1 vagas por
  modalidade). Casos montados a partir dos padrões reais do 93 (códigos e
  nomes fictícios, sem dado pessoal). A regra é a do seed (02/10/2026) com o
  $patch$ da correção tests/fixtures/sql-de-dados/20261009-classificacao-93-desempate-e-quadro.sql.
*/

  const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
  const SEED = ler(
    "tests/fixtures/sql-de-dados/20261002-regras-de-classificacao-todos-os-editais.sql",
  );
  const CORRECAO = ler(
    "tests/fixtures/sql-de-dados/20261009-classificacao-93-desempate-e-quadro.sql",
  );

  const REGRA_SEED = JSON.parse(
    /\('f57d77e1-7f6b-416c-9f9e-6e40c6d5bded'::uuid, '93\/2026', 'projetos', '[^']+', \$r\$(.*?)\$r\$::jsonb\)/.exec(
      SEED,
    )[1],
  );
  const PATCH = JSON.parse(/\$patch\$(.*?)\$patch\$/.exec(CORRECAO)[1]);
  const REGRA_93 = {
    ...REGRA_SEED,
    data_corte: PATCH.data_corte,
    listas: {
      ...REGRA_SEED.listas,
      PRELIMINAR: {
        ...REGRA_SEED.listas.PRELIMINAR,
        ...PATCH.listas.PRELIMINAR,
      },
    },
  };
  const QUADRO_DA_CORRECAO = [
    ...CORRECAO.matchAll(/\((\d), '([^']+)',\s+\$q\$(.*?)\$q\$::jsonb\)/g),
  ].map((m) => ({
    ordem: Number(m[1]),
    termo: m[2],
    modalidades: JSON.parse(m[3]),
  }));

  let n = 0;
  const id = () => `00000000-0000-4000-8093-${String(++n).padStart(12, "0")}`;
  /* Uma análise da planilha como o RPC devolve (vaga técnica de 6 vagas). */
  const cand = (nome, nota, campos = {}) => ({
    analise_id: id(),
    codigo: String(9300000 + n),
    nome,
    vaga: "900258",
    cargo: "CARGO 5: TÉCNICO DE SEGURANÇA DO TRABALHO -",
    modalidade: "Ampla concorrência",
    pcd: "NÃO",
    status: "Aprovado",
    etapa: "Triados",
    nota_documental: nota,
    data_nascimento: "1985-06-15",
    exp_profissional: 1500,
    quadro: "q5",
    ...campos,
  });
  const QUADRO = (modalidades, vagas = 6) => [
    {
      id: "q5",
      ordem: 5,
      cargo: "TÉCNICO DE SEGURANÇA DO TRABALHO (Nível Médio)",
      modalidades,
      vagas_imediatas: vagas,
      cadastro_reserva: true,
    },
  ];
  const preliminar = (candidatos, regra = REGRA_93, quadro = QUADRO({})) =>
    classificar({ tipo: "PRELIMINAR", regra, candidatos, quadro });
  const geral = (r) =>
    r.vagas[0].geral.map((l) => `${l.posicao} ${l.nome}`).join(" | ");

  describe("regra do 93/2026 depois da correção", () => {
    it("critérios do item 10.1, na ordem, e a preliminar passa a usá-los", () => {
      expect(REGRA_SEED.listas.PRELIMINAR.empate).toBe("MESMA_POSICAO");
      expect(REGRA_93.desempate).toEqual([
        { criterio: "IDOSO_60", direcao: "SIM_PRIMEIRO" },
        { criterio: "EXP_PROFISSIONAL_TEMPO", direcao: "MAIOR_PRIMEIRO" },
        { criterio: "MAIOR_IDADE", direcao: "MAIOR_PRIMEIRO" },
      ]);
      expect(REGRA_93.listas.PRELIMINAR.empate).toBe("CRITERIOS");
      expect(REGRA_93.data_corte).toBe("2026-09-29");
      expect(REGRA_93.documental.nota_minima).toBe(15);
      expect(validarRegra(REGRA_93)).toEqual([]);
      // A correção confere a ordem antes de gravar e só grava uma vez.
      expect(CORRECAO).toContain(
        `'["IDOSO_60", "EXP_PROFISSIONAL_TEMPO", "MAIOR_IDADE"]'::jsonb`,
      );
      expect(CORRECAO).toContain(
        "if v_atual #>> '{listas,PRELIMINAR,empate}' = 'CRITERIOS' then",
      );
      expect(CORRECAO).toContain(
        'perform private."FC_VALIDAR_REGRA_CLASSIFICACAO"(v_nova);',
      );
    });

    it("quadro do item 4.1: a soma de cada cargo bate com as vagas imediatas", () => {
      const total = (m) =>
        Object.values(m).reduce((s, v) => s + (Number(v) || 0), 0);
      expect(
        QUADRO_DA_CORRECAO.map((q) => [q.ordem, total(q.modalidades)]),
      ).toEqual([
        [1, 2],
        [2, 1],
        [3, 1],
        [4, 1],
        [5, 6],
      ]);
      expect(QUADRO_DA_CORRECAO[4].modalidades).toMatchObject({
        "Ampla Concorrência": 3,
        PcD: 1,
        "Pretos e Pardos": 2,
      });
    });
  });

  describe("lista preliminar do 93/2026 — desempate (item 10.1)", () => {
    it("antes: 8 empatados com 45 ficavam todos em 1º; agora saem na ordem do 10.1", () => {
      const candidatos = [
        cand("Ana", 45, {
          exp_profissional: 1678,
          data_nascimento: "1995-03-01",
        }),
        cand("Bia", 45, {
          exp_profissional: 5077,
          data_nascimento: "1987-03-01",
        }),
        cand("Caio", 45, {
          exp_profissional: 1499,
          data_nascimento: "1959-05-10",
        }),
        cand("Davi", 45, {
          exp_profissional: 1501,
          data_nascimento: "1965-02-10",
        }),
        cand("Eva", 44, { modalidade: "Pretos e pardos" }),
      ];
      expect(geral(preliminar(candidatos, REGRA_SEED))).toBe(
        "1 Ana | 1 Bia | 1 Caio | 1 Davi | 2 Eva",
      );
      const r = preliminar(candidatos);
      // a) os dois com 60+ primeiro; entre eles, b) a experiência (1501 × 1499 dias);
      // depois b) entre os demais.
      expect(geral(r)).toBe("1 Davi | 2 Caio | 3 Bia | 4 Ana | 5 Eva");
      const davi = r.explicacoes[candidatos[3].analise_id].explicacao.join(" ");
      expect(davi).toContain("por 60+ (sim × não)");
      expect(davi).toContain(
        "por tempo de experiência (1501 dias × 1499 dias)",
      );
      expect(r.pendencias).toEqual([]);
    });

    it("mesma experiência: c) maior idade pela data de nascimento", () => {
      const candidatos = [
        cand("Ana", 30, { data_nascimento: "1990-01-02" }),
        cand("Bia", 30, { data_nascimento: "1980-01-02" }),
      ];
      const r = preliminar(candidatos);
      expect(geral(r)).toBe("1 Bia | 2 Ana");
      expect(
        r.explicacoes[candidatos[1].analise_id].explicacao.join(" "),
      ).toContain("por idade (nasc. 02/01/1980 × nasc. 02/01/1990)");
      expect(r.avisos.filter((a) => a.codigo === "HORA_DE_NASCIMENTO")).toEqual(
        [],
      );
      expect(r.explicacoes[candidatos[0].analise_id].horaDecide).toBe(false);
    });

    it("mesmo dia de nascimento: decide a hora da certidão; sem certidão vale 23h59min59s", () => {
      const candidatos = [
        cand("Ana", 30, { data_nascimento: "1985-06-15" }),
        cand("Bia", 30, {
          data_nascimento: "1985-06-15",
          hora_nascimento: "22:10",
        }),
      ];
      const r = preliminar(candidatos);
      expect(geral(r)).toBe("1 Bia | 2 Ana");
      const bia = r.explicacoes[candidatos[1].analise_id];
      expect(bia.explicacao.join(" ")).toContain(
        "por idade (22h10min00s pela certidão × 23h59min59s, sem certidão)",
      );
      expect(bia.horaDecide).toBe(true);
      expect(bia.horaNascimento).toBe("22:10:00");
      expect(r.explicacoes[candidatos[0].analise_id].horaDecide).toBe(true);
      const aviso = r.avisos.filter((a) => a.codigo === "HORA_DE_NASCIMENTO");
      expect(aviso).toHaveLength(1);
      expect(aviso[0].tom).toBe("warning");
      expect(aviso[0].texto).toContain("15/06/1985");
    });

    it("mesmo dia e as duas sem certidão: empate até o fim, na mesma posição (o edital não define)", () => {
      const candidatos = [cand("Ana", 30), cand("Bia", 30)];
      const r = preliminar(candidatos);
      expect(geral(r)).toBe("1 Ana | 1 Bia");
      expect(
        r.explicacoes[candidatos[0].analise_id].explicacao.join(" "),
      ).toContain("Empate final: mesma posição.");
    });

    it("as duas com a hora da certidão: a mais velha (nasceu mais cedo) vem antes", () => {
      const candidatos = [
        cand("Ana", 30, { hora_nascimento: "08:00:00" }),
        cand("Bia", 30, { hora_nascimento: "07:59:59" }),
      ];
      const r = preliminar(candidatos);
      expect(geral(r)).toBe("1 Bia | 2 Ana");
      expect(r.avisos.find((a) => a.codigo === "HORA_DE_NASCIMENTO")?.tom).toBe(
        "info",
      );
    });
  });

  describe("lista preliminar do 93/2026 — nota mínima, eliminados e vagas", () => {
    it("nota mínima 15 (8.2.6): 15 fica; 14,99 sai; reprovado na planilha sai com o motivo", () => {
      const candidatos = [
        cand("Ana", 15),
        cand("Bia", "14,99"),
        cand("Caio", 10, { status: "Reprovado", etapa: "Reprovado" }),
        cand("Davi", 45, { status: "Reprovado", etapa: "Reprovado" }),
      ];
      const r = preliminar(candidatos);
      expect(geral(r)).toBe("1 Ana");
      const elim = Object.fromEntries(
        r.vagas[0].eliminados.map((e) => [e.nome, [e.motivo, e.detalhe]]),
      );
      expect(elim.Bia[0]).toBe("ABAIXO_NOTA_MINIMA_DOCUMENTAL");
      expect(elim.Caio).toEqual([
        "NAO_HABILITADO",
        "Situação na análise: Reprovado. Nota 10,00, abaixo do mínimo de 15,00.",
      ]);
      // Reprovado com nota alta: não comprovou o requisito (8.2.1).
      expect(elim.Davi).toEqual([
        "NAO_HABILITADO",
        "Situação na análise: Reprovado.",
      ]);
    });

    it("vaga de 2 vagas (1 AC + 1 PP) só com reprovado: sem aptos e 1 eliminado", () => {
      const r = classificar({
        tipo: "PRELIMINAR",
        regra: REGRA_93,
        candidatos: [
          cand("Ana", 40, {
            vaga: "900698",
            cargo: "CARGO 1: MÉDICO DO TRABALHO -",
            status: "Reprovado",
            etapa: "Reprovado",
            quadro: "q1",
          }),
        ],
        quadro: [
          {
            id: "q1",
            ordem: 1,
            cargo: "ANALISTA DE GESTÃO: MÉDICO DO TRABALHO (Nível Superior)",
            modalidades: QUADRO_DA_CORRECAO[0].modalidades,
            vagas_imediatas: 2,
            cadastro_reserva: true,
          },
        ],
      });
      const v = r.vagas[0];
      expect(v.geral).toEqual([]);
      expect(v.eliminados).toHaveLength(1);
      expect(v.vagasPorModalidade).toMatchObject({ AC: 1, PP: 1 });
      expect(v.cabecalho).toContain("2 vagas (1 AC + 1 Pretos e pardos + CR)");
    });

    it("Técnico de Segurança (6 vagas): a divisão publicada (3 AC + 1 PcD + 2 PP), não a dos percentuais", () => {
      const candidatos = [cand("Ana", 40)];
      const pelaRegra = preliminar(candidatos, REGRA_93, QUADRO({}));
      expect(pelaRegra.vagas[0].vagasPorModalidade).toEqual({ AC: 4, PP: 2 });
      const corrigido = preliminar(
        candidatos,
        REGRA_93,
        QUADRO(QUADRO_DA_CORRECAO[4].modalidades),
      );
      expect(corrigido.vagas[0].vagasPorModalidade).toMatchObject({
        AC: 3,
        PCD: 1,
        PP: 2,
      });
      expect(corrigido.vagas[0].origemDasVagas).toBe("QUADRO");
    });
  });

  describe("parciais × nota documental (o que a lista publica)", () => {
    it("avisa a vaga em que as parciais da planilha não somam a nota; a ordem segue a nota", () => {
      const candidatos = [
        // Como no 93: nota 45 pelo barema, colunas de pontuação 0 + 5 + 16.
        cand("Ana", 45, {
          pontuacao_formacao: 0,
          pontuacao_cursos: 5,
          pontuacao_experiencia: 16,
        }),
        cand("Bia", 21, {
          pontuacao_formacao: 0,
          pontuacao_cursos: 5,
          pontuacao_experiencia: 16,
        }),
        cand("Caio", 30),
      ];
      const r = preliminar(candidatos);
      expect(geral(r)).toBe("1 Ana | 2 Caio | 3 Bia");
      const avisos = r.avisos.filter(
        (a) => a.codigo === "PARCIAIS_DIFERENTES_DA_NOTA",
      );
      expect(avisos).toHaveLength(1);
      expect(avisos[0].texto).toContain("em 1 de 3 candidato(s)");
      expect(avisos[0].texto).toContain(
        "nota 45,00, parciais 0,00 + 5,00 + 16,00",
      );
      // Na final não há parciais publicadas: sem aviso.
      expect(
        classificar({
          tipo: "FINAL",
          regra: REGRA_93,
          candidatos,
          quadro: QUADRO({}),
        }).avisos.some((a) => a.codigo === "PARCIAIS_DIFERENTES_DA_NOTA"),
      ).toBe(false);
    });
  });

  describe("hora de nascimento (6.11.5 e 6.11.6)", () => {
    it("lê HH:MM e HH:MM:SS; inválida fica de fora", () => {
      expect(lerHora("8:05")).toBe("08:05:00");
      expect(lerHora("23:59:59")).toBe("23:59:59");
      expect(lerHora("24:00")).toBeNull();
      expect(lerHora("")).toBeNull();
      expect(horaBR("07:03:09")).toBe("07h03min09s");
    });

    it("sem hora vale 23:59:59: no mesmo dia, quem tem hora é mais velho", () => {
      const sem = segundosDeVida("1985-06-15", "", "2026-09-29");
      const com = segundosDeVida("1985-06-15", "23:59:58", "2026-09-29");
      expect(com - sem).toBe(1);
      // Um dia antes, mesmo sem hora, é mais velho que qualquer hora do dia seguinte.
      expect(segundosDeVida("1985-06-14", "", "2026-09-29")).toBeGreaterThan(
        segundosDeVida("1985-06-15", "00:00:00", "2026-09-29"),
      );
    });
  });
});

bloco("classificacao-regras-dos-editais", () => {
  /*
  O seed das regras de TODOS os editais (lidas dos PDFs oficiais em 02/10/2026)
  e um edital representativo de cada modelo passando pelo motor.

  Modelos (texto-base comum; ver scratchpad/classificacao/todos/relatorio-regras.md):
    SI26-83, SI26-ART, SI26-A, SI25-ENTREVISTA, SI25-CURRICULAR (Saúde Indígena);
    SEDE25-CORES, SEDE25-BAREMA, SEDE25-MEDIA, SEDE25-PROVA (Sede);
    PROJ26-CURRICULAR, PROJ26-MFC, PROJ25-PROVA, PROJ25-FRONTEIRAS (Projetos).
*/

  const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
  const NOME = "20261002-regras-de-classificacao-todos-os-editais.sql";
  const SEED = ler(`tests/fixtures/sql-de-dados/${NOME}`);
  const MOTIVO = "Regra lida do edital (PDF oficial) — conferir";

  const LINHA =
    /\('([0-9a-f-]{36})'::uuid, '([^']+)', '([^']+)', '([^']+)', \$r\$(.*?)\$r\$::jsonb\)/g;
  const REGRAS = [...SEED.matchAll(LINHA)].map((m) => ({
    id: m[1],
    edital: m[2],
    area: m[3],
    modelo: m[4],
    regra: JSON.parse(m[5]),
  }));
  const doModelo = (modelo) => REGRAS.find((r) => r.modelo === modelo).regra;

  const corpo = (sql) => {
    const inicio = sql.indexOf(
      "create function pg_temp.aplicar_regras_dos_editais()",
    );
    const fim = sql.indexOf("$seed$;", inicio) + "$seed$;".length;
    return sql.slice(inicio, fim);
  };

  describe("seed das regras de todos os editais", () => {
    it("131 regras, uma por edital, sem o 83/2026 e o 100/2026 (que já têm)", () => {
      expect(REGRAS).toHaveLength(131);
      expect(new Set(REGRAS.map((r) => r.id)).size).toBe(REGRAS.length);
      const daSaude = REGRAS.filter((r) => r.area === "saude-indigena").map(
        (r) => r.edital,
      );
      expect(daSaude).not.toContain("83/2026");
      expect(daSaude).not.toContain("100/2026");
    });

    it("toda regra é válida, já normalizada e só usa critérios do catálogo", () => {
      for (const { edital, area, regra } of REGRAS) {
        expect(validarRegra(regra), `${edital} ${area}`).toEqual([]);
        expect(normalizarRegra(regra), `${edital} ${area}`).toEqual(regra);
        for (const d of regra.desempate)
          expect(CRITERIO_POR_CODIGO[d.criterio], d.criterio).toBeTruthy();
        expect(regra.data_corte).toBeNull();
        expect(regra.importacao.modelo).toBeTruthy();
      }
    });

    it("idempotente: só cria regra para edital sem regra, conferindo número e área", () => {
      const c = corpo(SEED);
      expect(c).toContain(
        'if exists (select 1 from public."TB_REGRA_CLASSIFICACAO" x where x."CO_MONITORAMENTO" = r.edital_id) then',
      );
      expect(c).toContain(
        'private."FC_NUMERO_EDITAL"(v_edital.edital) is distinct from private."FC_NUMERO_EDITAL"(r.numero)',
      );
      expect(c).toContain(`'${MOTIVO}'`);
      expect(c).toContain(
        'perform private."FC_VALIDAR_REGRA_CLASSIFICACAO"(r.configuracao);',
      );
      expect(SEED).toMatch(
        /\nbegin;\n[\s\S]+\nselect pg_temp\.aplicar_regras_dos_editais\(\);\n\ncommit;\n$/,
      );
    });

    it("os 13 modelos estão no seed", () => {
      expect([...new Set(REGRAS.map((r) => r.modelo))].sort()).toEqual([
        "PROJ25-FRONTEIRAS",
        "PROJ25-PROVA",
        "PROJ26-CURRICULAR",
        "PROJ26-MFC",
        "SEDE25-BAREMA",
        "SEDE25-CORES",
        "SEDE25-MEDIA",
        "SEDE25-PROVA",
        "SI25-CURRICULAR",
        "SI25-ENTREVISTA",
        "SI26-83",
        "SI26-A",
        "SI26-ART",
      ]);
    });
  });

  /* ── Um edital representativo de cada modelo pelo motor ─────────────── */

  let n = 0;
  const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
  const cand = (nome, doc, campos = {}) => ({
    analise_id: id(),
    codigo: String(100 + n),
    nome,
    vaga: "900001",
    cargo: "Enfermeiro",
    modalidade: "Ampla concorrência",
    status: "Aprovado",
    nota_documental: doc,
    quadro: "q1",
    pontuacao_etnica: 0,
    ...campos,
  });
  const ent = (c, nota, campos = {}) => ({
    id: id(),
    analise_id: c.analise_id,
    nome: c.nome,
    vaga: c.vaga,
    nota,
    parecer: "APTO",
    compareceu: "S",
    ligacao: "codigo",
    origem: "sistema",
    notas: [],
    ...campos,
  });
  const quadro = (vagas, cargo = "Enfermeiro") => [
    {
      id: "q1",
      ordem: 1,
      cargo,
      vagas_imediatas: vagas,
      modalidades: {},
      cadastro_reserva: true,
    },
  ];
  const nomes = (linhas) => linhas.map((l) => `${l.posicao} ${l.nome}`);
  const motivos = (v) =>
    Object.fromEntries(v.eliminados.map((e) => [e.nome, e.motivo]));

  describe("SI26-83 (texto-base do 83/2026) — 36/2026 DSEI Potiguara", () => {
    const regra = doModelo("SI26-83");
    it("nota mínima por nível (superior 8, técnico 6) e entrevista ≥ 10 e ≥ 2,5 por competência", () => {
      const a = cand("Ana", 9);
      const b = cand("Bia", 7.9);
      const t = cand("Téo", 6, { cargo: "Técnico de Enfermagem" });
      const c = cand("Caio", 12);
      const r = classificar({
        tipo: "FINAL",
        regra,
        candidatos: [a, b, t, c],
        entrevistas: [
          ent(a, 15),
          ent(t, 12),
          ent(c, 14, {
            notas: [
              { ordem: 1, nota: 2 },
              { ordem: 2, nota: 4 },
              { ordem: 3, nota: 4 },
              { ordem: 4, nota: 4 },
            ],
          }),
        ],
        quadro: quadro(1),
        dataCorte: "2026-06-29",
      });
      const v = r.vagas[0];
      expect(nomes(v.geral)).toEqual(["1 Ana", "2 Téo"]);
      expect(motivos(v)).toMatchObject({
        Bia: "ABAIXO_NOTA_MINIMA_DOCUMENTAL",
        Caio: "COMPETENCIA_ABAIXO_MINIMO",
      });
      expect(regra.convocacao).toMatchObject({
        multiplo_vagas: 10,
        posicao_max_cr: 20,
      });
    });
  });

  describe("SI26-ART (texto-base do 100/2026: ART + lote) — 88/2026 DSEI Xavante", () => {
    const regra = doModelo("SI26-ART");
    it("sem mínimo documental; nota 1 numa competência elimina; preliminar desempata por critérios", () => {
      const ind = cand("Iara", 13, {
        modalidade: "Indígenas",
        pontuacao_etnica: 8,
      });
      const ac = cand("Ana", 13);
      const baixa = cand("Bruno", 2);
      const pre = classificar({
        tipo: "PRELIMINAR",
        regra,
        candidatos: [ac, ind, baixa],
        quadro: quadro(2),
        dataCorte: "2026-08-01",
      });
      expect(nomes(pre.vagas[0].geral)).toEqual(["1 Iara", "2 Ana", "3 Bruno"]);
      const fin = classificar({
        tipo: "FINAL",
        regra,
        candidatos: [ac, ind],
        entrevistas: [
          ent(ac, 15, {
            notas: [
              { ordem: 1, nota: 1 },
              { ordem: 2, nota: 5 },
              { ordem: 3, nota: 5 },
              { ordem: 4, nota: 4 },
            ],
          }),
          ent(ind, 9),
        ],
        quadro: quadro(2),
        dataCorte: "2026-08-01",
      });
      expect(motivos(fin.vagas[0]).Ana).toBe("COMPETENCIA_ELIMINATORIA");
      expect(nomes(fin.vagas[0].geral)).toEqual(["1 Iara"]);
    });
  });

  describe("SI26-A (Sanitarista, 100 pontos) — 34/2026", () => {
    const regra = doModelo("SI26-A");
    it("mínimo documental 40 (único) e convocação 5× / até a 10ª", () => {
      const r = classificar({
        tipo: "PRELIMINAR",
        regra,
        candidatos: [cand("Ana", 41), cand("Bia", 39.9)],
        quadro: quadro(1, "Sanitarista"),
      });
      expect(nomes(r.vagas[0].geral)).toEqual(["1 Ana"]);
      expect(motivos(r.vagas[0]).Bia).toBe("ABAIXO_NOTA_MINIMA_DOCUMENTAL");
      expect(regra.convocacao).toMatchObject({
        multiplo_vagas: 5,
        posicao_max_cr: 10,
        excecoes: [],
      });
    });
  });

  describe("SI25-ENTREVISTA (2025: reserva conjunta PPIQ 30%) — 11/2025", () => {
    const regra = doModelo("SI25-ENTREVISTA");
    it("quem declarou pretos e pardos, indígena ou quilombola entra na lista PPIQ", () => {
      const pp = cand("Paula", 20, { modalidade: "Pretos e pardos" });
      const pq = cand("Quitéria", 19, { modalidade: "Quilombola" });
      const ac = cand("Ana", 25);
      const r = classificar({
        tipo: "FINAL",
        regra,
        candidatos: [pp, pq, ac],
        entrevistas: [ent(pp, 15), ent(pq, 15), ent(ac, 15)],
        quadro: quadro(4),
      });
      const v = r.vagas[0];
      expect(nomes(v.porModalidade.PPIQ)).toEqual(["1 Paula", "2 Quitéria"]);
      expect(v.vagasPorModalidade).toEqual({ AC: 2, PCD: 1, PPIQ: 1 });
      expect(regra.desempate.map((d) => d.criterio)).not.toContain("IDOSO_60");
    });
  });

  describe("SI25-CURRICULAR (2025, só análise curricular) — 03/2025", () => {
    const regra = doModelo("SI25-CURRICULAR");
    it("sem entrevista: o resultado final é a nota documental, com mínimo 10", () => {
      const r = classificar({
        tipo: "FINAL",
        regra,
        candidatos: [cand("Ana", 50), cand("Bia", 9)],
        quadro: quadro(1),
      });
      expect(nomes(r.vagas[0].geral)).toEqual(["1 Ana"]);
      expect(r.vagas[0].geral[0]).toMatchObject({ nota: 50, situacao: "VAGA" });
      expect(regra.etapas.entrevista).toBe(false);
    });
  });

  describe("SEDE25-CORES (entrevista só apto/inapto) — 01/2025", () => {
    const regra = doModelo("SEDE25-CORES");
    it("apto sem nota não é eliminado; inapto e sem parecer saem; a final é a curricular", () => {
      const a = cand("Ana", 80);
      const b = cand("Bia", 90);
      const c = cand("Caio", 85);
      const d = cand("Duda", 75);
      const r = classificar({
        tipo: "FINAL",
        regra,
        candidatos: [a, b, c, d],
        entrevistas: [
          ent(a, null),
          ent(b, null, { parecer: "INAPTO" }),
          ent(c, null, { parecer: "" }),
          ent(d, null),
        ],
        quadro: quadro(1, "Analista"),
      });
      const v = r.vagas[0];
      expect(nomes(v.geral)).toEqual(["1 Ana", "2 Duda"]);
      expect(motivos(v)).toMatchObject({
        Bia: "INAPTO_ENTREVISTA",
        Caio: "SEM_PARECER_ENTREVISTA",
      });
      const lista = classificar({
        tipo: "ENTREVISTA",
        regra,
        candidatos: [a, d],
        entrevistas: [ent(a, null), ent(d, null)],
        quadro: quadro(1, "Analista"),
      });
      expect(nomes(lista.vagas[0].geral)).toEqual(["1 Ana", "2 Duda"]);
    });
  });

  describe("SEDE25-BAREMA — 08/2025", () => {
    it("mínimo 70 e desempate por maior idade", () => {
      const regra = doModelo("SEDE25-BAREMA");
      const velho = cand("Velho", 80, { data_nascimento: "1970-01-01" });
      const novo = cand("Novo", 80, { data_nascimento: "1990-01-01" });
      const r = classificar({
        tipo: "FINAL",
        regra,
        candidatos: [novo, velho],
        entrevistas: [ent(novo, null), ent(velho, null)],
        quadro: quadro(1, "Analista"),
        dataCorte: "2025-06-17",
      });
      expect(nomes(r.vagas[0].geral)).toEqual(["1 Velho", "2 Novo"]);
    });
  });

  describe("modelos com prova (SEDE25-PROVA, SEDE25-MEDIA, PROJ25-PROVA)", () => {
    it("a regra cobre a etapa curricular; a prova está em aberto (não modelada)", () => {
      for (const modelo of ["SEDE25-PROVA", "SEDE25-MEDIA", "PROJ25-PROVA"]) {
        const regra = doModelo(modelo);
        expect(regra.etapas.entrevista, modelo).toBe(false);
        expect(regra.importacao.em_aberto.join(" "), modelo).toMatch(/prova/i);
      }
      expect(
        doModelo("SEDE25-PROVA").modalidades.find((m) => m.codigo === "PP")
          .agrupa,
      ).toEqual(["PI", "PQ"]);
      expect(doModelo("PROJ25-PROVA").desempate.map((d) => d.criterio)).toEqual(
        ["IDOSO_60", "NOTA_CONHECIMENTOS_ESPECIFICOS", "MAIOR_IDADE"],
      );
    });
  });

  describe("PROJ26-MFC — 05/2026", () => {
    it("empate final por sorteio (lido no edital): sem registro, fica pendente", () => {
      const regra = doModelo("PROJ26-MFC");
      expect(regra.empate_final.metodo).toBe("SORTEIO");
      const r = classificar({
        tipo: "FINAL",
        regra,
        candidatos: [cand("Ana", 30), cand("Bia", 30)],
        quadro: quadro(1, "Médico"),
      });
      expect(r.pendencias).toHaveLength(1);
      expect(r.avisos.map((a) => a.codigo)).toContain("DADO_FALTANDO");
    });
  });

  describe("PROJ26-CURRICULAR — 114/2026, 93/2026, 30/2026", () => {
    it("só curricular, mínimo da regra e cotas com reversão PI ↔ PQ → PP", () => {
      const regra = doModelo("PROJ26-CURRICULAR");
      const r = classificar({
        tipo: "FINAL",
        regra,
        candidatos: [
          cand("Ana", regra.documental.nota_minima + 1),
          cand("Bia", regra.documental.nota_minima - 1),
        ],
        quadro: quadro(1, "Analista"),
      });
      expect(nomes(r.vagas[0].geral)).toEqual(["1 Ana"]);
    });
  });

  describe("PROJ25-FRONTEIRAS — 23/2025", () => {
    it("desempata também a lista preliminar (maior idade primeiro)", () => {
      const regra = doModelo("PROJ25-FRONTEIRAS");
      const r = classificar({
        tipo: "PRELIMINAR",
        regra,
        candidatos: [
          cand("Novo", 40, { data_nascimento: "1995-01-01" }),
          cand("Velho", 40, { data_nascimento: "1960-01-01" }),
        ],
        quadro: quadro(1, "Médico"),
        dataCorte: "2025-07-01",
      });
      expect(nomes(r.vagas[0].geral)).toEqual(["1 Velho", "2 Novo"]);
    });
  });
});

bloco("edital-de-treinamento", () => {
  /*
  O edital de treinamento (migration 20261007230000): fora da Visão geral,
  indicadores, painéis e robôs no modo padrão; com o selo "Treinamento" nas
  telas operacionais; documento oficial com "TREINAMENTO — SEM VALOR OFICIAL".
*/
  const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");

  const REAL = {
    id: "r1",
    edital: "93/2026",
    unidade: "DSEI Manaus",
    status: "Em andamento",
    ativo: true,
    vagas_total: 10,
    contratados: 4,
    vagas_ociosas: 6,
    CO_AREA: "saude-indigena",
    ST_TREINAMENTO: "N",
  };
  const TREINO = {
    id: "t1",
    edital: "Treinamento – Saúde Indígena (991/2099)",
    unidade: "DSEI Treinamento",
    status: "Em andamento",
    ativo: true,
    vagas_total: 7,
    contratados: 0,
    vagas_ociosas: 7,
    CO_AREA: "saude-indigena",
    ST_TREINAMENTO: "S",
  };

  describe("o predicado do front", () => {
    it("reconhece a marca da linha (ST_TREINAMENTO) e a das RPCs (treinamento)", () => {
      expect(ehEditalDeTreinamento(TREINO)).toBe(true);
      expect(ehEditalDeTreinamento({ treinamento: true })).toBe(true);
      expect(ehEditalDeTreinamento({ st_treinamento: "s" })).toBe(true);
      for (const outro of [REAL, { treinamento: false }, {}, null, "S"])
        expect(ehEditalDeTreinamento(outro)).toBe(false);
    });

    it("semTreinamento tira só o de treinamento (e devolve a mesma lista sem ele)", () => {
      const linhas = [REAL, TREINO];
      expect(semTreinamento(linhas)).toEqual([REAL]);
      const soReais = [REAL];
      expect(semTreinamento(soReais)).toBe(soReais);
      expect(semTreinamento(null)).toEqual([]);
    });

    it("sufixo do seletor e edital escolhido", () => {
      expect(sufixoDeTreinamento({ treinamento: true })).toBe(" · Treinamento");
      expect(sufixoDeTreinamento(REAL)).toBe("");
      expect(editalEscolhido([REAL, TREINO], "t1")).toBe(TREINO);
      expect(editalEscolhido([REAL], "")).toBeNull();
    });

    it("a coluna vem na carga do monitoramento", () => {
      expect(COLUNAS_DO_MONITORAMENTO.split(",")).toContain("ST_TREINAMENTO");
    });
  });

  describe("fora dos indicadores e da Visão geral", () => {
    it("os indicadores da Visão geral, sobre as linhas sem treinamento, não contam o edital", () => {
      const com = indicadoresDaVisaoGeral([REAL, TREINO]);
      const sem = indicadoresDaVisaoGeral(semTreinamento([REAL, TREINO]));
      expect(sem).toEqual(indicadoresDaVisaoGeral([REAL]));
      expect(sem).not.toEqual(com);
    });

    it("a Visão geral, a semana do cabeçalho e os indicadores de Editais aplicam o predicado", () => {
      expect(ler("src/modulos/visao-geral/estado.ts")).toContain(
        "semTreinamento(linhasDaArea(linhasDaResposta(linhas), areaAtual))",
      );
      // A semana do cabeçalho conta sobre as linhas da área do estado, já sem o treinamento.
      expect(ler("src/modulos/visao-geral/paineis.tsx")).toContain(
        "editaisComEtapaNaSemana(e.linhasDaArea, agora())",
      );
      expect(ler("src/modulos/editais/nucleo.tsx")).toContain(
        "resumoDasLinhas(doResumo.resumo, semTreinamento(linhas))",
      );
    });
  });

  describe("robôs: só quando pedido", () => {
    const painel = normalizarPainel({
      areas: [{ area: "saude-indigena", nome: "Saúde Indígena" }],
      editais: [
        { ...REAL, numero: "93/2026", area: "saude-indigena" },
        {
          ...TREINO,
          numero: "991/2099",
          area: "saude-indigena",
          treinamento: true,
        },
      ],
    });

    it("o de treinamento não está entre os vigentes; com 'mostrar todos' vem com o rótulo", () => {
      expect(opcoesDosEditais(painel.editais, painel.areas).opcoes).toEqual([
        { value: "r1", label: "93/2026 · DSEI Manaus (Saúde Indígena)" },
      ]);
      expect(
        opcoesDosEditais(painel.editais, painel.areas, { todos: true }).opcoes,
      ).toContainEqual({
        value: "t1",
        label: "991/2099 · DSEI Treinamento (Saúde Indígena) · Treinamento",
      });
    });
  });

  describe("telas operacionais: aparece, com a marca", () => {
    it("Entrevistas › Conduzir leva a marca do edital", () => {
      const [treino] = editaisParaConduzir(
        [{ id: "t1", edital: TREINO.edital, treinamento: true }],
        [],
      );
      expect(treino.treinamento).toBe(true);
      expect(
        editaisParaConduzir([{ id: "r1", edital: "93/2026" }], [])[0]
          .treinamento,
      ).toBe(false);
    });

    it("Avaliação documental: o de treinamento (em andamento) está entre os vigentes", () => {
      expect(
        editaisDaEscolha([{ ...TREINO, treinamento: true }]).lista,
      ).toHaveLength(1);
    });

    it("as três telas mostram o selo no seletor e no topo", () => {
      // O seletor compartilhado das telas da seleção (Triagem, Avaliação
      // documental, Classificação) leva o selo e o sufixo de cada opção.
      const seletor = "src/componentes/seletor-de-edital.tsx";
      expect(ler(seletor), seletor).toContain("<SeloDeTreinamento");
      expect(ler(seletor), seletor).toContain("sufixoDeTreinamento(");
      for (const arquivo of [
        "src/modulos/entrevistas/seletor-do-edital.tsx",
        "src/modulos/avaliacao-documental/avaliacao-documental.tsx",
        "src/modulos/avaliacao-documental/entrada-da-pre-classificacao.tsx",
      ]) {
        const fonte = ler(arquivo);
        if (fonte.includes("<SeletorDeEdital")) continue;
        expect(fonte, arquivo).toContain("<SeloDeTreinamento");
        expect(fonte, arquivo).toContain("sufixoDeTreinamento(");
      }
      // A Classificação não tem lista de opções: o selo vai no card do edital
      // (sem edital escolhido) e ao lado do nome, no cabeçalho.
      for (const arquivo of [
        "src/modulos/classificacao/classificacao.tsx",
        "src/modulos/classificacao/entrada-da-classificacao.tsx",
      ])
        expect(ler(arquivo), arquivo).toContain("<SeloDeTreinamento");
    });
  });

  describe("documento oficial do treinamento", () => {
    const retrato = (edital) => ({
      schema: 1,
      tipo: "CONVOCACAO",
      edital,
      casas: 2,
      modalidades: [],
      vagas: [
        {
          chave: "9909910001",
          codigo: "9909910001",
          cabecalho: "Vaga 9909910001 — Enfermeiro",
          geral: [
            {
              posicao: 1,
              nome: "Candidato Teste 01",
              nota: 82.5,
              modalidades: [],
            },
          ],
          listas: {},
          eliminados: [],
        },
      ],
    });

    it("título e nome com a marca; edital real sem a marca", () => {
      const doc = documentoOficial(
        retrato({ id: "t1", edital: TREINO.edital, treinamento: true }),
        { regra: {}, hoje: new Date("2026-10-07T12:00:00Z") },
      );
      expect(doc.titulo[0]).toBe(`**${MARCA_SEM_VALOR_OFICIAL}**`);
      expect(doc.nome.startsWith("TREINAMENTO - ")).toBe(true);
      expect(doc.treinamento).toBe(true);
      const real = documentoOficial(retrato({ id: "r1", edital: "93/2026" }), {
        regra: {},
        hoje: new Date("2026-10-07T12:00:00Z"),
      });
      expect(real.titulo.join(" ")).not.toContain("TREINAMENTO");
      expect(real.treinamento).toBe(false);
    });

    it("a opção explícita vale mesmo com retrato sem a marca", () => {
      const doc = documentoOficial(
        retrato({ id: "t1", edital: TREINO.edital }),
        {
          regra: {},
          treinamento: true,
        },
      );
      expect(doc.titulo[0]).toContain(MARCA_SEM_VALOR_OFICIAL);
    });

    it("o retrato só ganha a marca no treinamento e o arquivo começa com 'treinamento'", () => {
      const resultado = {
        tipo: "CONVOCACAO",
        casas: 2,
        vagas: [],
        avisos: [],
        pendencias: [],
        totais: {},
      };
      const treino = instantaneoDaLista(resultado, {
        edital: { id: "t1", edital: TREINO.edital, treinamento: true },
        regra: {},
      });
      const real = instantaneoDaLista(resultado, {
        edital: { id: "r1", edital: "93/2026" },
        regra: {},
      });
      expect(treino.edital.treinamento).toBe(true);
      expect(real.edital).not.toHaveProperty("treinamento");
      expect(nomeDoArquivo(treino)).toMatch(/^treinamento-classificacao-/);
      expect(nomeDoArquivo(real)).toMatch(/^classificacao-/);
    });
  });

  describe("contrato", () => {
    it("reiniciar_edital_treinamento está no contrato de RPC", () => {
      expect(CONTRATO_RPC.reiniciar_edital_treinamento?.argumentos).toEqual([
        "p_edital",
      ]);
    });
  });
});

bloco("lib/avaliacao-documental-tela-pre-classificacao", () => {
  /*
  A aba Triagem sem DOM (src/lib/avaliacao-documental/
  tela-da-pre-classificacao.ts) e o documento das listas PROVISORIA e LOTE no
  gerador da Classificação (src/lib/classificacao/documento-sei.ts) — AM-4.4,
  AM-5.0, AM-5.6 e AM-16.
*/

  const DADOS = {
    regra: { configuracao: { lote: { publica_reposicao: true } } },
    vagas: [
      {
        codigo: "1",
        inscritos: 4,
        eliminados: 1,
        ranqueados: 3,
        no_lote: 2,
        tamanho: 2,
        divergencias: 1,
      },
      {
        codigo: "2",
        inscritos: 3,
        eliminados: 0,
        ranqueados: 3,
        no_lote: 3,
        tamanho: 3,
        divergencias: 0,
      },
      { codigo: "3", inscritos: null, tamanho: null },
    ],
    candidatos: [
      {
        id: "a",
        vaga: "1",
        codigo: "10",
        situacao: "NO_LOTE",
        posicao: 2,
        lote: 2,
      },
      {
        id: "b",
        vaga: "1",
        codigo: "11",
        situacao: "NO_LOTE",
        posicao: 1,
        lote: 1,
      },
      { id: "c", vaga: "1", codigo: "12", situacao: "RANQUEADO", posicao: 3 },
      { id: "d", vaga: "1", codigo: "09", situacao: "ELIMINADO" },
      {
        id: "e",
        vaga: "2",
        codigo: "20",
        situacao: "ANALISADO",
        posicao: 1,
        lote: 1,
      },
    ],
    listas: [{ meta: { tipo: "LOTE" }, lote: 1 }],
  };

  describe("tela da triagem", () => {
    it("AM-4.4: contadores e 'N de M' só das vagas já pré-classificadas", () => {
      expect(contadoresDaPreClassificacao(DADOS)).toEqual({
        inscritos: 7,
        eliminados: 1,
        ranqueados: 6,
        noLote: 5,
        noLotePelaRegra: 5,
        noLotePorDecisao: 0,
        tamanho: 5,
        divergencias: 1,
        vagasSemPreClassificacao: 1,
      });
      const semQuadro = { vagas: [{ inscritos: 2, tamanho: null }] };
      expect(contadoresDaPreClassificacao(semQuadro).tamanho).toBeNull();
    });

    it("vagas com o lote em ordem, os de fora e os eliminados", () => {
      const [v1, v2] = vagasDaTela(DADOS);
      expect(v1.lote.map((c) => c.codigo)).toEqual(["11", "10"]);
      expect(v1.fora.map((c) => c.codigo)).toEqual(["12"]);
      expect(v1.eliminados.map((c) => c.codigo)).toEqual(["09"]);
      expect(v2.lote.map((c) => c.situacao)).toEqual(["ANALISADO"]);
    });

    it("AM-5.6: com 'publica cada reposição', os lotes sem lista; sem, só o inicial", () => {
      expect(lotesAPublicar(DADOS)).toEqual([{ lote: 2, quantidade: 1 }]);
      const naoPublica = {
        ...DADOS,
        regra: { configuracao: { lote: {} } },
        listas: [],
      };
      expect(lotesAPublicar(naoPublica)).toEqual([{ lote: 1, quantidade: 2 }]);
    });

    it("AM-5.0: tamanho sugerido pela regra, definido à mão e a regra com os tamanhos", () => {
      const config = {
        lote: {
          base: "MULTIPLO_VAGAS",
          multiplo: 3,
          inclui_cr: true,
          por_vaga: { 179698: 40 },
        },
      };
      expect(
        tamanhoSugerido(config, {
          codigo: "179698",
          vagas_imediatas: 11,
          cadastro_reserva: true,
        }),
      ).toMatchObject({ tamanho: 36, descricao: "3 × (11 + CR) = 36" });
      expect(tamanhoSugerido(config, { codigo: "1" }).aviso).toBe("SEM_QUADRO");
      expect(tamanhoDefinido(config, "179698")).toBe(40);
      expect(tamanhoDefinido(config, "1")).toBeNull();
      const nova = regraComTamanhos(config, {
        179698: "",
        180231: "12",
        x: "abc",
      });
      expect(nova.lote.por_vaga).toEqual({ 180231: 12 });
      expect(config.lote.por_vaga).toEqual({ 179698: 40 });
      expect(
        regraComTamanhos(config, { 179698: "" }).lote.por_vaga,
      ).toBeUndefined();
    });

    it("avisos e notas", () => {
      expect(textoDoAviso("SEM_QUADRO")).toMatch(/defina o tamanho/);
      expect(textoDoAviso("COLUNA_AUSENTE:TERMO")).toBe(
        "A coluna da regra TERMO não veio no arquivo.",
      );
      expect(textoDoAviso("PERGUNTA_AMBIGUA:EXPERIENCIA_DECLARADA")).toBe(
        "A pergunta de experiência do desempate casa com mais de uma coluna do arquivo: na regra, use um começo de enunciado que só ela tenha.",
      );
      expect(textoDoAviso("PERGUNTA_AMBIGUA:NOTA_ETNICO")).toMatch(
        /^A pergunta da nota declarada ETNICO casa/,
      );
      expect(textoDoAviso("PERGUNTA_AMBIGUA:MODALIDADE")).toMatch(
        /^A pergunta do sistema de concorrência casa/,
      );
      expect(textoDoAviso("PERGUNTA_AMBIGUA:TERMO")).toMatch(
        /^A pergunta da eliminação TERMO casa/,
      );
      expect(nota(24.5)).toBe("24,5");
      expect(nota(null)).toBe("—");
      expect(textoDoAviso("SEM_DECLARADA_COMPLETA")).toMatch(
        /sem nota declarada completa: o lote usou a ART/,
      );
    });

    it("as notas declaradas congeladas do edital: quantas e desde quando", () => {
      expect(declaradasCongeladas({})).toEqual({ quantidade: 0, em: null });
      expect(
        declaradasCongeladas({
          candidatos: [
            { declarada_congelada: 20, congelada_em: "2026-10-08T12:00:00Z" },
            { declarada_congelada: 15, congelada_em: "2026-10-07T12:00:00Z" },
            { declarada_congelada: null, congelada_em: null },
            { declarada: 10 },
          ],
        }),
      ).toEqual({ quantidade: 2, em: "2026-10-07T12:00:00Z" });
    });
  });

  describe("estado da aba: descongelar e recalcular", () => {
    const criar = (rpcs, pedidos) => {
      const toasts = [];
      const supabase = {
        rpc: (nome, args) => {
          rpcs.push([nome, args]);
          return Promise.resolve(
            nome === "descongelar_declarada_pre_classificacao"
              ? { data: { descongeladas: 3 }, error: null }
              : { data: { vagas: [], candidatos: [] }, error: null },
          );
        },
      };
      const pre = criarEstadoDaPreClassificacao({
        supabase,
        toast: (m, t) => toasts.push([m, t]),
        obterToken: async () => "t",
        buscar: async (url, opcoes) => {
          pedidos.push(JSON.parse(opcoes.body));
          return { status: 202, json: async () => ({}) };
        },
        agendar: () => {},
      });
      return { pre, toasts };
    };

    it("descongela o edital com o motivo e pede o recálculo", async () => {
      const rpcs = [];
      const pedidos = [];
      const { pre, toasts } = criar(rpcs, pedidos);
      await pre.carregar("ed-1");
      expect(
        await pre.descongelar("  Respostas corrigidas na Empregare  "),
      ).toBe(true);
      expect(rpcs).toContainEqual([
        "descongelar_declarada_pre_classificacao",
        {
          p_edital: "ed-1",
          p_motivo: "Respostas corrigidas na Empregare",
          p_vaga: null,
        },
      ]);
      // O recálculo agora é pedido pelo banco (disparar_robo), não pela Vercel.
      expect(rpcs).toContainEqual([
        "disparar_robo",
        { p_robo: "pre_classificacao", p_inputs: { editais: ["ed-1"] } },
      ]);
      expect(toasts[0]).toEqual([
        "3 notas declaradas descongeladas.",
        "success",
      ]);
    });

    it("recusa do banco: avisa e não recalcula", async () => {
      const pedidos = [];
      const toasts = [];
      const pre = criarEstadoDaPreClassificacao({
        supabase: {
          rpc: (nome) =>
            Promise.resolve(
              nome === "descongelar_declarada_pre_classificacao"
                ? { data: null, error: { message: "Diga o motivo" } }
                : { data: {}, error: null },
            ),
        },
        toast: (m, t) => toasts.push([m, t]),
        buscar: async (url, opcoes) => {
          pedidos.push(opcoes);
          return { status: 202, json: async () => ({}) };
        },
        agendar: () => {},
      });
      await pre.carregar("ed-1");
      expect(await pre.descongelar("curto")).toBe(false);
      expect(pedidos).toEqual([]);
      expect(toasts.at(-1)[1]).toBe("error");
    });
  });

  describe("documento das listas PROVISORIA e LOTE (AM-16)", () => {
    const retrato = (tipo, lote = null) => ({
      schema: 1,
      tipo,
      lote,
      edital: {
        id: "e93",
        edital: "Edital 93/2026",
        unidade: "Escritório de Boa Vista",
      },
      casas: 1,
      modalidades: [],
      vagas: [
        {
          chave: "179698",
          codigo: "179698",
          cabecalho:
            "VAGA 179698 - Técnico de Segurança do Trabalho - 1 vaga + CR",
          geral: [
            { posicao: 1, nome: "Ana Exemplo", nota: 26, modalidades: ["AC"] },
            {
              posicao: 2,
              nome: "Bia Exemplo",
              nota: 24.5,
              modalidades: ["AC"],
            },
          ],
          listas: {},
          eliminados:
            tipo === "PROVISORIA"
              ? [
                  {
                    nome: "Caio Exemplo",
                    motivo: "Cancelou a inscrição",
                    detalhe: "",
                  },
                ]
              : [],
        },
        {
          chave: "180231",
          codigo: "180231",
          cabecalho: "VAGA 180231",
          geral: [],
          listas: {},
          eliminados: [],
        },
      ],
    });

    it("sem fase no título e com o modelo próprio", () => {
      expect(faseDaPublicacao("PROVISORIA", "FINAL")).toBeNull();
      expect(faseDaPublicacao("LOTE", null)).toBeNull();
      expect(chaveDoModelo("PROVISORIA", null)).toBe("PROVISORIA");
      expect(chaveDoModelo("PROVISORIA", null, "eliminados")).toBe(
        "PROVISORIA_ELIMINADOS",
      );
      expect(chaveDoModelo("LOTE", null, "eliminados")).toBe("LOTE");
    });

    it("AM-16.1: a Provisória por vaga com a nota da ART e o item 8.3.1 (não valida documentos)", () => {
      const doc = documentoOficial(retrato("PROVISORIA"));
      expect(doc.titulo[0]).toBe(
        "LISTA GERAL DE CLASSIFICAÇÃO PROVISÓRIA - RANQUEAMENTO ELETRÔNICO",
      );
      const texto = textoParaSei(doc);
      expect(texto).toContain("item 8.3.1");
      expect(texto).toContain("não valida os documentos");
      expect(doc.blocos[0].tabelas[0].colunas.map((c) => c.rotulo)).toEqual([
        "Classificação",
        "Nome",
        "Nota da Autodeclaração de Requisitos e Títulos (ART)",
      ]);
      expect(doc.blocos[0].tabelas[0].linhas[1]).toEqual([
        "2º",
        "Bia Exemplo",
        "24,5",
      ]);
      expect(doc.blocos[1].tabelas[0].vazia).toBe(
        "Não houve candidatos classificados.",
      );
      const eliminados = documentoOficial(retrato("PROVISORIA"), {
        lista: "eliminados",
      });
      expect(eliminados.chave).toBe("PROVISORIA_ELIMINADOS");
      expect(eliminados.blocos[0].tabelas[0].linhas[0]).toEqual([
        "Caio Exemplo",
        "Cancelou a inscrição",
      ]);
    });

    it("AM-16.2: o lote de convocação (item 8.4) e o nome do arquivo com o número do lote", () => {
      const doc = documentoOficial(retrato("LOTE", 2));
      expect(doc.titulo[0]).toBe(
        "LOTE DE CONVOCAÇÃO - ETAPA DE AVALIAÇÃO DOCUMENTAL E DE TÍTULOS",
      );
      expect(textoParaSei(doc)).toContain("item 8.4");
      expect(doc.blocos[1].tabelas[0].vazia).toBe(
        "Não houve candidatos convocados.",
      );
      expect(nomeDoArquivo(retrato("LOTE", 2))).toBe(
        "classificacao-lote-lote-2-Edital-93-2026",
      );
      expect(nomeDoArquivo(retrato("PROVISORIA"))).toBe(
        "classificacao-provisoria-Edital-93-2026",
      );
    });

    it("AM-16.3: os textos podem ser trocados por edital (regra.documento.modelos)", () => {
      const regra = {
        documento: { modelos: { LOTE: { titulo: "LOTE {edital}" } } },
      };
      expect(documentoOficial(retrato("LOTE", 1), { regra }).titulo[0]).toBe(
        "LOTE 93/2026",
      );
    });
  });
});

bloco("lib/classificacao-ajustes", () => {
  /*
  O ajuste da pontuação aprovado em recurso (migration 20261005130000) no
  motor da Classificação: substitui o valor da análise sem tocar a planilha,
  marca o candidato e entra na explicação; a prévia mostra a nova posição e
  quem muda de lugar por causa dele.
*/

  const REGRA = {
    etapas: { documental: true, entrevista: true },
    documental: {
      situacoes_aptas: ["Aprovado"],
      parciais: ["FORMACAO", "EXPERIENCIA", "ETNICO"],
    },
    entrevista: {
      competencias: [
        { ordem: 1, nome: "Comunicação" },
        { ordem: 2, nome: "Trabalho em equipe" },
      ],
    },
    composicao: {
      componentes: [
        { codigo: "DOCUMENTAL", peso: 1 },
        { codigo: "ENTREVISTA", peso: 1 },
      ],
      casas: 2,
    },
  };

  const candidato = (id, nome, nota, parciais = {}) => ({
    analise_id: id,
    codigo: id,
    nome,
    vaga: "V1",
    cargo: "Enfermeiro",
    modalidade: "Ampla concorrência",
    status: "Aprovado",
    nota_documental: nota,
    pontuacao_formacao: parciais.formacao ?? 5,
    pontuacao_experiencia: parciais.experiencia ?? 10,
    pontuacao_etnica: parciais.etnico ?? 0,
  });

  const entrevista = (id, nota, notas = []) => ({
    id: `e-${id}`,
    analise_id: id,
    nome: id,
    vaga: "V1",
    nota,
    parecer: "APTO",
    compareceu: "S",
    ligacao: "codigo",
    origem: "sistema",
    notas,
  });

  function dadosDoEdital(extra = {}) {
    return {
      edital: { id: "ed1", unidade: "DSEI" },
      regra: { versao: 1, configuracao: REGRA },
      candidatos: [
        candidato("a", "Ana", 20),
        candidato("b", "Bruno", 18),
        candidato("c", "Carla", 15, { formacao: 3, experiencia: 9, etnico: 3 }),
      ],
      entrevistas: [],
      quadro: [],
      cronograma: [],
      desempates: [],
      ajustes: [],
      ...extra,
    };
  }

  const ajusteDaCarla = (itens, campos = {}) => ({
    id: "aj1",
    recurso_id: "r7",
    numero: 7,
    analise_id: "c",
    versao: 1,
    aprovado_em: "2026-10-05T12:00:00Z",
    itens,
    ...campos,
  });

  const posicoes = (resultado) =>
    resultado.vagas[0].geral.map((l) => `${l.posicao} ${l.nome}`);

  describe("ajuste aprovado no motor da Classificação", () => {
    it("o valor novo substitui o da análise: a candidata passa para 1º e a planilha não muda", () => {
      const dados = dadosDoEdital();
      expect(posicoes(classificarEdital(dados, "PRELIMINAR"))).toEqual([
        "1 Ana",
        "2 Bruno",
        "3 Carla",
      ]);
      const comAjuste = {
        ...dados,
        ajustes: [
          ajusteDaCarla([
            { codigo: "FORMACAO", anterior: 3, novo: 9 },
            { codigo: "DOCUMENTAL", anterior: 15, novo: 21 },
          ]),
        ],
      };
      const r = classificarEdital(comAjuste, "PRELIMINAR");
      expect(posicoes(r)).toEqual(["1 Carla", "2 Ana", "3 Bruno"]);
      const carla = r.vagas[0].geral[0];
      expect(carla.nota).toBe(21);
      expect(carla.recursos).toEqual([7]);
      expect(carla.parciais.FORMACAO).toBe(9);
      expect(r.vagas[0].geral[1]).not.toHaveProperty("recursos");
      expect(r.explicacoes.c.explicacao.join(" ")).toContain(
        "Nota alterada pelo recurso nº 7: formação acadêmica 3,00 → 9,00; nota documental 15,00 → 21,00.",
      );
      // A entrada (o json do banco) fica como veio.
      expect(comAjuste.candidatos[2].nota_documental).toBe(15);
      expect(comAjuste.candidatos[2].pontuacao_formacao).toBe(3);
    });

    it("sem ajuste aprovado (proposto não chega ao motor), a lista é a da análise", () => {
      const r = classificarEdital(dadosDoEdital(), "PRELIMINAR");
      expect(r.explicacoes.c).not.toHaveProperty("recursos");
      expect(r.avisos.some((a) => a.codigo.startsWith("AJUSTE_"))).toBe(false);
    });

    it("avisa quando a análise mudou depois do ajuste e aplica na ordem da aprovação", () => {
      const dados = dadosDoEdital({
        ajustes: [
          ajusteDaCarla([{ codigo: "DOCUMENTAL", anterior: 14, novo: 16 }], {
            aprovado_em: "2026-10-05T12:00:00Z",
          }),
          ajusteDaCarla([{ codigo: "DOCUMENTAL", anterior: 16, novo: 19 }], {
            id: "aj2",
            recurso_id: "r8",
            numero: 8,
            aprovado_em: "2026-10-06T12:00:00Z",
          }),
        ],
      });
      const r = classificarEdital(dados, "PRELIMINAR");
      expect(r.explicacoes.c.nota).toBe(19);
      expect(r.explicacoes.c.recursos).toEqual([7, 8]);
      const divergentes = r.avisos.filter(
        (a) => a.codigo === "AJUSTE_DIVERGENTE",
      );
      expect(divergentes).toHaveLength(1);
      expect(divergentes[0].texto).toContain("recurso nº 7");
    });

    it("entrevista: ajusta a nota da entrevista no resultado final; sem entrevista, avisa", () => {
      const dados = dadosDoEdital({
        entrevistas: [
          entrevista("a", 10),
          entrevista("b", 10),
          entrevista("c", 10),
        ],
        ajustes: [
          ajusteDaCarla([{ codigo: "ENTREVISTA", anterior: 10, novo: 20 }]),
        ],
      });
      const r = classificarEdital(dados, "FINAL");
      expect(r.explicacoes.c.nota).toBe(35);
      expect(posicoes(r)[0]).toBe("1 Carla");

      const semEntrevista = classificarEdital(
        dadosDoEdital({
          ajustes: [
            ajusteDaCarla([{ codigo: "COMPETENCIA_1", anterior: 5, novo: 8 }]),
          ],
        }),
        "PRELIMINAR",
      );
      expect(
        semEntrevista.avisos.some((a) => a.codigo === "AJUSTE_SEM_ENTREVISTA"),
      ).toBe(true);
    });

    it("o retrato da lista leva o número do recurso (para auditoria e documentos)", () => {
      const r = classificarEdital(
        dadosDoEdital({
          ajustes: [
            ajusteDaCarla([{ codigo: "DOCUMENTAL", anterior: 15, novo: 21 }]),
          ],
        }),
        "PRELIMINAR",
      );
      const retrato = instantaneoDaLista(r, { regra: REGRA, versao: 1 });
      expect(retrato.vagas[0].geral[0]).toMatchObject({
        nome: "Carla",
        recursos: [7],
      });
      expect(retrato.vagas[0].geral[1]).not.toHaveProperty("recursos");
    });
  });

  describe("componentes ajustáveis pela regra do edital", () => {
    it("parciais da regra, documental somada, competências e entrevista somada", () => {
      const dados = dadosDoEdital({
        entrevistas: [
          entrevista("c", 12, [
            { ordem: 1, criterio: "Comunicação", nota: 6 },
            { ordem: 2, criterio: "Equipe", nota: 6 },
          ]),
        ],
      });
      const c = candidatoAtual(dados, "c");
      const itens = itensDoAjuste(REGRA, c);
      expect(itens.map((i) => i.codigo)).toEqual([
        "FORMACAO",
        "EXPERIENCIA",
        "ETNICO",
        "DOCUMENTAL",
        "COMPETENCIA_1",
        "COMPETENCIA_2",
        "ENTREVISTA",
      ]);
      expect(itens.find((i) => i.codigo === "DOCUMENTAL")).toMatchObject({
        atual: 15,
        calculado: true,
      });
      expect(itens.find((i) => i.codigo === "COMPETENCIA_2").rotulo).toBe(
        "Trabalho em equipe",
      );
    });

    it("sem parciais na regra, a nota documental é editável; só parecer não tem entrevista; ART quando compõe a nota", () => {
      const regra = {
        ...REGRA,
        documental: { situacoes_aptas: ["Aprovado"], parciais: [] },
        entrevista: { so_parecer: true },
        composicao: {
          componentes: [
            { codigo: "DOCUMENTAL", peso: 1 },
            { codigo: "ART", peso: 1 },
          ],
        },
      };
      const dados = dadosDoEdital({ entrevistas: [entrevista("c", 10)] });
      const itens = itensDoAjuste(regra, candidatoAtual(dados, "c"));
      expect(itens.map((i) => [i.codigo, i.calculado])).toEqual([
        ["DOCUMENTAL", false],
        ["ART", false],
      ]);
    });

    it("o valor atual desconsidera o ajuste aprovado do próprio recurso (a nova versão o substitui)", () => {
      const dados = dadosDoEdital({
        ajustes: [
          ajusteDaCarla([{ codigo: "DOCUMENTAL", anterior: 15, novo: 21 }]),
        ],
      });
      expect(candidatoAtual(dados, "c").notaDocumental).toBe(21);
      expect(
        candidatoAtual(dados, "c", { semRecurso: "r7" }).notaDocumental,
      ).toBe(15);
    });

    it("monta o rascunho: o total soma as diferenças; valida e envia só o que mudou", () => {
      const itens = itensDoAjuste(REGRA, candidatoAtual(dadosDoEdital(), "c"));
      const montados = montarItens(itens, {
        valores: { FORMACAO: "9", EXPERIENCIA: "9,5" },
        justificativas: { FORMACAO: "Diploma de mestrado aceito." },
      });
      expect(montados.find((i) => i.codigo === "DOCUMENTAL").novo).toBe(21.5);
      expect(validarAjuste(montados, "")).toEqual([
        "Escreva a justificativa geral ou a de cada componente alterado (10 caracteres ou mais).",
      ]);
      expect(validarAjuste(montados, "Recurso deferido em parte.")).toEqual([]);
      expect(itensParaEnviar(montados)).toEqual([
        {
          codigo: "FORMACAO",
          anterior: 3,
          novo: 9,
          justificativa: "Diploma de mestrado aceito.",
        },
        { codigo: "EXPERIENCIA", anterior: 9, novo: 9.5 },
        {
          codigo: "DOCUMENTAL",
          anterior: 15,
          novo: 21.5,
          justificativa: "Soma das diferenças dos componentes ajustados.",
        },
      ]);
      expect(
        validarAjuste(montarItens(itens, {}), "Justificativa longa."),
      ).toEqual(["Altere ao menos um valor."]);
      expect(
        validarAjuste(
          montarItens(itens, { valores: { ETNICO: "abc" } }),
          "Justificativa longa.",
        )[0],
      ).toBe("Valor de 0 a 1000 em: Pertencimento étnico.");
    });
  });

  describe("prévia do ajuste", () => {
    it("nova nota, nova posição e quem muda de lugar por causa dele", () => {
      const previa = previaDoAjuste({
        dados: dadosDoEdital(),
        tipo: "PRELIMINAR",
        analiseId: "c",
        recursoId: "r7",
        numero: 7,
        itens: [{ codigo: "DOCUMENTAL", anterior: 15, novo: 21 }],
      });
      expect(previa).toMatchObject({
        tipo: "PRELIMINAR",
        vaga: "V1",
        mudou: true,
        antes: { posicao: 3, nota: 15 },
        depois: { posicao: 1, nota: 21 },
        totalAfetados: 2,
      });
      expect(previa.afetados).toEqual([
        expect.objectContaining({ nome: "Ana", antes: 1, depois: 2 }),
        expect.objectContaining({ nome: "Bruno", antes: 2, depois: 3 }),
      ]);
      // json pequeno, gravável
      expect(JSON.stringify(previa).length).toBeLessThan(2000);
    });

    it("ajuste que não muda a posição: mudou = false e ninguém afetado", () => {
      const previa = previaDoAjuste({
        dados: dadosDoEdital(),
        tipo: "PRELIMINAR",
        analiseId: "c",
        recursoId: "r7",
        itens: [{ codigo: "DOCUMENTAL", anterior: 15, novo: 16 }],
      });
      expect(previa.mudou).toBe(false);
      expect(previa.afetados).toEqual([]);
    });

    it("a versão nova substitui a aprovada do mesmo recurso no 'depois'; o 'antes' é a lista de agora", () => {
      const dados = dadosDoEdital({
        ajustes: [
          ajusteDaCarla([{ codigo: "DOCUMENTAL", anterior: 15, novo: 21 }]),
        ],
      });
      const previa = previaDoAjuste({
        dados,
        tipo: "PRELIMINAR",
        analiseId: "c",
        recursoId: "r7",
        itens: [{ codigo: "DOCUMENTAL", anterior: 15, novo: 19 }],
      });
      // Agora (v1 aprovada, 21) ela é a 1ª; com a v2 (19) fica atrás de Ana (20).
      expect(previa.antes).toMatchObject({ posicao: 1, nota: 21 });
      expect(previa.depois).toMatchObject({ posicao: 2, nota: 19 });
    });

    it("a lista da prévia segue a origem do recurso", () => {
      expect(listaDaOrigem("analise-curricular")).toBe("PRELIMINAR");
      expect(listaDaOrigem("entrevista")).toBe("ENTREVISTA");
      expect(listaDaOrigem("resultado-final")).toBe("FINAL");
      expect(listaDaOrigem("outra")).toBe("FINAL");
      for (const origem of [
        "toString",
        "constructor",
        "__proto__",
        null,
        undefined,
      ])
        expect(listaDaOrigem(origem)).toBe("FINAL");
    });
  });

  describe("lista desatualizada", () => {
    it("avisa quando um ajuste foi aprovado (ou cancelado) depois da geração", () => {
      const lista = { gerada_em: "2026-10-05T10:00:00Z" };
      expect(listaDesatualizada(lista, "2026-10-05T11:00:00Z")).toBe(true);
      expect(listaDesatualizada(lista, "2026-10-05T09:00:00Z")).toBe(false);
      expect(listaDesatualizada(lista, null)).toBe(false);
      expect(listaDesatualizada(null, "2026-10-05T11:00:00Z")).toBe(false);
    });
  });
});

bloco("lib/classificacao-calculo-em-python", () => {
  /*
  A lista calculada pelo Python (etapa 2b, src/lib/classificacao/calculo-em-python.ts):
  a leitura das respostas e a conferência do retrato do Python com o da tela.
  O retrato do Python chega do jsonb com as chaves em outra ordem e 3.0 como 3;
  isso não é diferença. Os casos dourados (tests/fixtures/classificacao/casos-do-motor.json,
  `retrato`, conferidos também pelo pytest) dão 0 diferença.
*/
  const P = "aaaaaaaa-1111-4111-8111-111111111111";
  const DOURADO = JSON.parse(
    readFileSync("tests/fixtures/classificacao/casos-do-motor.json", "utf8"),
  );

  /* As chaves em outra ordem, como o jsonb devolve. */
  function embaralhar(valor) {
    if (Array.isArray(valor)) return valor.map(embaralhar);
    if (valor && typeof valor === "object")
      return Object.fromEntries(
        Object.entries(valor)
          .reverse()
          .map(([k, v]) => [k, embaralhar(v)]),
      );
    return valor;
  }

  describe("as respostas do banco", () => {
    it("chave desligada (ou resposta vazia): sem pedido, o Gerar segue como antes", () => {
      expect(respostaDoPedido({ ligada: false })).toBeNull();
      expect(respostaDoPedido(null)).toBeNull();
      expect(respostaDoPedido(undefined)).toBeNull();
    });

    it("chave ligada: o pedido, com a situação e a mensagem; fora do formato, erro", () => {
      expect(
        respostaDoPedido({
          ligada: true,
          pedido: P,
          situacao: "SEM_DISPARO",
          mensagem: " O pedido ao GitHub não saiu (SEM_TOKEN). ",
        }),
      ).toEqual({
        pedido: P,
        situacao: "SEM_DISPARO",
        mensagem: "O pedido ao GitHub não saiu (SEM_TOKEN).",
      });
      expect(() =>
        respostaDoPedido({ ligada: true, pedido: "x", situacao: "PEDIDO" }),
      ).toThrow(/fora do formato/);
      expect(() =>
        respostaDoPedido({ ligada: true, pedido: P, situacao: "OUTRA" }),
      ).toThrow(/fora do formato/);
    });

    it("o pedido lido: o retrato só quando vem objeto; quem ainda espera o job", () => {
      const lido = calculoLido({
        pedido: P,
        situacao: "PRONTO",
        retrato: { tipo: "FINAL" },
      });
      expect(lido.retrato).toEqual({ tipo: "FINAL" });
      expect(
        calculoLido({ pedido: P, situacao: "PRONTO", retrato: null }).retrato,
      ).toBeNull();
      expect(() => calculoLido(null)).toThrow();
      expect(["PEDIDO", "CALCULANDO"].every(esperaOJob)).toBe(true);
      expect(
        ["PRONTO", "FALHOU", "NAO_CONFERE", "SEM_DISPARO"].some(esperaOJob),
      ).toBe(false);
    });

    it("o pedido parado diz o motivo (a mensagem do banco primeiro)", () => {
      expect(
        textoDoPedidoParado({ pedido: P, situacao: "FALHOU", mensagem: "" }),
      ).toBe("O cálculo em Python falhou.");
      expect(
        textoDoPedidoParado({
          pedido: P,
          situacao: "FALHOU",
          mensagem:
            "A regra do edital mudou desde o pedido; gere a lista de novo.",
        }),
      ).toContain("mudou desde o pedido");
    });
  });

  describe("a conferência: retrato do Python × retrato da tela", () => {
    it("ordem das chaves, 3.0 × 3 e campos undefined não são diferença", () => {
      const tela = { tipo: "FINAL", vagas: [{ total: 3, nome: undefined }] };
      const python = JSON.parse('{"vagas":[{"total":3.0}],"tipo":"FINAL"}');
      expect(diferencasDosRetratos(tela, python)).toEqual({
        total: 0,
        caminhos: [],
      });
    });

    it("acha valor, campo e posição de lista diferentes, com o caminho e sem o valor", () => {
      const tela = {
        vagas: [{ geral: [{ posicao: 1, nome: "Ana" }], listas: { PP: [] } }],
        totais: { elegiveis: 1 },
      };
      const python = {
        vagas: [
          {
            geral: [
              { posicao: 2, nome: "Ana" },
              { posicao: 3, nome: "Bia" },
            ],
            listas: { PP: [], PCD: [] },
          },
        ],
        totais: {},
      };
      const { total, caminhos } = diferencasDosRetratos(tela, python);
      expect(total).toBe(4);
      expect(caminhos).toEqual([
        "totais.elegiveis",
        "vagas[0].geral[0].posicao",
        "vagas[0].geral[1]",
        "vagas[0].listas.PCD",
      ]);
      expect(caminhos.join(" ")).not.toMatch(/Ana|Bia/);
    });

    it("guarda só os primeiros caminhos e só os seguros", () => {
      const tela = { x: Array.from({ length: 30 }, (_, i) => i) };
      const python = { x: Array.from({ length: 30 }, (_, i) => i + 1) };
      const { total, caminhos } = diferencasDosRetratos(tela, python);
      expect(total).toBe(30);
      expect(caminhos).toHaveLength(20);
      expect(caminhos.every(caminhoSeguro)).toBe(true);
      // Uma chave com espaço ou acento vira _ (o caminho nunca leva o valor).
      expect(
        diferencasDosRetratos({ "Pessoa com deficiência": 1 }, {}).caminhos,
      ).toEqual(["Pessoa_com_defici_ncia"]);
      expect(caminhoSeguro("vagas[0].nome=Fulana")).toBe(false);
      expect(caminhoSeguro("x.12345678901")).toBe(false);
    });

    it.each(DOURADO.casos.map((c, i) => [c.nome, c, i]))(
      "caso dourado: o retrato da tela é o do Python (%s)",
      (_nome, caso, i) => {
        const entrada = DOURADO.editais[caso.edital];
        const bruta = entrada.convocacao;
        const resultado = classificar({
          tipo: caso.tipo,
          ...entrada,
          convocacao: bruta
            ? convocacaoDoEdital(
                { configuracoes: bruta.configuracoes, modelos: bruta.modelos },
                bruta.edital_id,
              )
            : null,
        });
        const tela = retratoDaClassificacao(
          instantaneoDaLista(resultado, {
            edital: caso.editalDoRetrato,
            regra: entrada.regra,
            versao: Math.floor(i / 4) + 1,
          }),
        );
        expect(
          diferencasDosRetratos(tela, embaralhar(caso.retrato)).total,
        ).toBe(0);
      },
    );
  });
});

bloco("lib/classificacao-casos-do-motor", () => {
  /*
  Casos dourados da classificação, compartilhados com o pytest
  (tests/python/test_classificacao_motor.py): a classificação em Python
  (python/monitora/classificacao/) tem de dar a MESMA saída do motor da tela.
  Aqui o motor.ts confere que continua dando a saída gravada. Mudou o motor de
  propósito: rode `node scripts/classificacao/gerar-casos-do-motor.mjs` e acerte
  o Python até o pytest passar. Dados fictícios.
*/
  const DOURADO = JSON.parse(
    readFileSync("tests/fixtures/classificacao/casos-do-motor.json", "utf8"),
  );

  function classificarCaso({ edital, tipo }) {
    const entrada = DOURADO.editais[edital];
    const bruta = entrada.convocacao;
    return JSON.parse(
      JSON.stringify(
        classificar({
          tipo,
          ...entrada,
          convocacao: bruta
            ? convocacaoDoEdital(
                { configuracoes: bruta.configuracoes, modelos: bruta.modelos },
                bruta.edital_id,
              )
            : null,
        }),
      ),
    );
  }

  describe("casos dourados da classificação (motor.ts × Python)", () => {
    it("cobrem as quatro listas em cinco editais fictícios", () => {
      expect(DOURADO.casos).toHaveLength(20);
      expect(new Set(DOURADO.casos.map((c) => c.tipo))).toEqual(
        new Set(["PRELIMINAR", "CONVOCACAO", "ENTREVISTA", "FINAL"]),
      );
    });

    it.each(DOURADO.casos.map((c) => [c.nome, c]))(
      "o motor da tela dá a saída gravada: %s",
      (_nome, caso) => {
        expect(classificarCaso(caso)).toEqual(caso.saida);
      },
    );

    it.each(DOURADO.casos.map((c, i) => [c.nome, c, i]))(
      "o retrato que a tela grava ao gerar é o gravado: %s",
      (_nome, caso, i) => {
        const retrato = retratoDaClassificacao(
          instantaneoDaLista(classificarCaso(caso), {
            edital: caso.editalDoRetrato,
            regra: DOURADO.editais[caso.edital].regra,
            versao: Math.floor(i / 4) + 1,
          }),
        );
        expect(JSON.parse(JSON.stringify(retrato))).toEqual(caso.retrato);
      },
    );

    it("cobrem os empates que o relatório de desempate explica", () => {
      const final = DOURADO.casos.find(
        (c) => c.nome === "criterios-sorteio-maior-percentual · FINAL",
      ).saida;
      const codigos = new Set(final.avisos.map((a) => a.codigo));
      for (const codigo of [
        "HORA_DE_NASCIMENTO",
        "DADO_FALTANDO",
        "EMPATE_PENDENTE",
        "EMPATE_NO_LIMITE",
      ])
        expect(codigos).toContain(codigo);
      const explicacoes = Object.values(final.explicacoes).flatMap(
        (e) => e.explicacao,
      );
      expect(explicacoes.join(" ")).toContain("pela certidão");
      expect(explicacoes.join(" ")).toContain("resolvido por sorteio");
    });
  });
});

bloco("lib/classificacao-colunas-do-documento", () => {
  /*
  As colunas das tabelas do documento oficial que o gestor escolhe em "Como
  fica no SEI": o padrão enxuto, as disponíveis conforme o retrato e o que
  vai para a regra do edital.
*/
  const retrato = (tipo, extra = {}) => ({
    tipo,
    modalidades: [{ codigo: "PCD", nome: "Pessoas com Deficiência" }],
    parciais: ["FORMACAO", "CURSOS"],
    vagas: [{ eliminados: [{ nome: "X", nota: 1 }] }],
    ...extra,
  });
  const ids = (colunas) => colunas.map((c) => c.id);

  describe("colunas do documento oficial", () => {
    it("padrão enxuto por publicação; a convocação é fixa", () => {
      expect(colunasPadrao("PRELIMINAR_PRELIMINAR")).toEqual([
        "CLASSIFICACAO",
        "NOME",
        "MODALIDADE",
        "NOTA",
      ]);
      expect(colunasPadrao("ENTREVISTA_FINAL")).toEqual([
        "CLASSIFICACAO",
        "NOME",
        "NOTA",
      ]);
      expect(colunasPadrao("FINAL_FINAL_ELIMINADOS")).toEqual([
        "NOME",
        "NOTA",
        "JUSTIFICATIVA",
      ]);
      expect(colunasPadrao("CONVOCACAO")).toBeNull();
    });

    it("disponíveis: modalidade só com todas as listas; parciais só na documental; situação no final", () => {
      expect(ids(colunasDisponiveis(retrato("PRELIMINAR"), "todas"))).toEqual([
        "CLASSIFICACAO",
        "NOME",
        "MODALIDADE",
        "NOTA",
        "PARCIAL_FORMACAO",
        "PARCIAL_CURSOS",
      ]);
      expect(ids(colunasDisponiveis(retrato("PRELIMINAR"), "geral"))).toEqual([
        "CLASSIFICACAO",
        "NOME",
        "NOTA",
        "PARCIAL_FORMACAO",
        "PARCIAL_CURSOS",
      ]);
      expect(ids(colunasDisponiveis(retrato("FINAL"), "geral"))).toEqual([
        "CLASSIFICACAO",
        "NOME",
        "NOTA",
        "SITUACAO",
      ]);
      expect(
        ids(colunasDisponiveis(retrato("PRELIMINAR"), "eliminados")),
      ).toEqual([
        "NOME",
        "NOTA",
        "PARCIAL_FORMACAO",
        "PARCIAL_CURSOS",
        "JUSTIFICATIVA",
      ]);
      expect(colunasDisponiveis(retrato("CONVOCACAO"), "todas")).toBeNull();
      const [classificacao, nome, , nota] = colunasDisponiveis(
        retrato("PRELIMINAR"),
        "todas",
      );
      expect(classificacao.obrigatoria && nome.obrigatoria).toBe(true);
      expect(nota).toMatchObject({ rotulo: "Nota Final", obrigatoria: false });
    });

    it("escolhidas: as guardadas que a lista tem, com as obrigatórias", () => {
      const disponiveis = colunasDisponiveis(retrato("PRELIMINAR"), "geral");
      const chave = "PRELIMINAR_PRELIMINAR";
      expect(colunasEscolhidas(disponiveis, undefined, chave)).toEqual([
        "CLASSIFICACAO",
        "NOME",
        "NOTA",
      ]);
      expect(
        colunasEscolhidas(disponiveis, ["PARCIAL_CURSOS", "NOME"], chave),
      ).toEqual(["CLASSIFICACAO", "PARCIAL_CURSOS", "NOME"]);
    });

    it("guardar: mantém a Modalidade (que a lista geral não tem) no lugar dela", () => {
      const disponiveis = colunasDisponiveis(retrato("PRELIMINAR"), "geral");
      const chave = "PRELIMINAR_PRELIMINAR";
      expect(
        colunasParaGuardar(
          ["CLASSIFICACAO", "NOME", "NOTA", "PARCIAL_FORMACAO"],
          disponiveis,
          undefined,
          chave,
        ),
      ).toEqual([
        "CLASSIFICACAO",
        "NOME",
        "MODALIDADE",
        "NOTA",
        "PARCIAL_FORMACAO",
      ]);
      expect(
        ehOPadrao(
          colunasParaGuardar(
            ["CLASSIFICACAO", "NOME", "NOTA"],
            disponiveis,
            undefined,
            chave,
          ),
          chave,
        ),
      ).toBe(true);
      expect(ehOPadrao(["NOME", "CLASSIFICACAO"], chave)).toBe(false);
      expect(ehOPadrao(undefined, chave)).toBe(true);
    });
  });
});

bloco("lib/classificacao-convocacao-do-edital", () => {
  /*
  Uma conta só para as vagas por modalidade: a Classificação usa a mesma
  `derivarQuadro` da Lista de aprovados › Convocação, e lê a configuração de
  convocação do edital quando existir.
*/

  const REGRA = {
    modalidades: [
      { codigo: "AC" },
      {
        codigo: "PCD",
        nome: "PcD",
        percentual: 5,
        arredondamento: "PARA_CIMA",
      },
      { codigo: "PP", nome: "Pretos e Pardos", percentual: 25 },
      {
        codigo: "PI",
        nome: "Indígenas",
        percentual: 3,
        remanejar_para: ["PQ", "PP"],
      },
      {
        codigo: "PQ",
        nome: "Quilombolas",
        percentual: 2,
        remanejar_para: ["PI", "PP"],
      },
    ],
    cotas: { minimo_vagas_reserva: 2, acumulo: "MAIOR_PERCENTUAL" },
  };

  describe("modelo de convocação a partir da regra", () => {
    it("categorias, arredondamento, mínimo e cascata", () => {
      const modelo = modeloDaRegra(REGRA);
      const pcd = modelo.categorias.find((c) => c.sigla === "PCD");
      expect(pcd).toMatchObject({
        percentual: 5,
        arredondamento: "sempre_acima",
        minimo: 2,
      });
      expect(modelo.categorias.find((c) => c.sigla === "PI").cascata).toEqual([
        "pq",
        "pp",
      ]);
      expect(modelo.cotaMultipla).toBe("maior_percentual");
    });

    it("vagasPelosPercentuais = derivarQuadro (a mesma conta da convocação)", () => {
      for (const total of [0, 1, 2, 3, 4, 7, 10, 20, 40]) {
        const modelo = modeloDaRegra(REGRA);
        expect(vagasPelaConta(total, modelo)).toMatchObject(
          Object.fromEntries(
            Object.entries(derivarQuadro(total, modelo)).map(([id, n]) => [
              codigoDaCategoria(modelo.categorias.find((c) => c.id === id)),
              n,
            ]),
          ),
        );
      }
      // 1 vaga: abaixo do mínimo, tudo na ampla; 4 vagas: 1 PP e 1 PcD (sempre para cima).
      expect(vagasPelosPercentuais(1, REGRA)).toEqual({ AC: 1 });
      expect(vagasPelosPercentuais(4, REGRA)).toEqual({ AC: 2, PP: 1, PCD: 1 });
    });

    it("os códigos das categorias dos modelos de referência", () => {
      const modelo = modeloDeReferencia("saude-indigena-2026");
      expect(modelo.categorias.map(codigoDaCategoria)).toEqual([
        "AC",
        "PP",
        "PI",
        "PQ",
        "PCD",
      ]);
    });
  });

  const linhasDoBanco = (modelo, vagas, padrao = 0) => ({
    modelos: [
      {
        modelo_id: "m1",
        nome: modelo.nome,
        distribuicao: modelo.distribuicao,
        cota_multipla: modelo.cotaMultipla,
        categorias: modelo.categorias,
        editais: 1,
      },
    ],
    configuracoes: [
      {
        edital_id: "e1",
        proporcionalidade: true,
        modelo_id: "m1",
        padrao_imediata: padrao,
        vagas,
      },
    ],
  });

  describe("configuração de convocação do edital", () => {
    const modelo = modeloDeReferencia("saude-indigena-2026");

    it("sem configuração para o edital → null", () => {
      expect(convocacaoDoEdital(linhasDoBanco(modelo, []), "outro")).toBeNull();
      expect(convocacaoDoEdital({}, "e1")).toBeNull();
    });

    it("quadro manual da vaga vale; total derivado pelo modelo", () => {
      const conv = convocacaoDoEdital(
        linhasDoBanco(modelo, [
          {
            codigo_vaga: "169681",
            cargo: "Cirurgião Dentista",
            imediatas: 3,
            manual: true,
            quadro: { ampla: 2, pretos_pardos: 1 },
          },
          { codigo_vaga: "169682", cargo: "Enfermeiro", imediatas: 4 },
        ]),
        "e1",
      );
      expect(vagasDaConvocacao(conv, "169681")).toEqual({
        total: 3,
        porModalidade: { AC: 2, PP: 1, PI: 0, PQ: 0, PCD: 0 },
      });
      expect(vagasDaConvocacao(conv, "169682").total).toBe(4);
      expect(vagasDaConvocacao(conv, "999999")).toBeNull();
    });

    it("o motor usa a configuração quando o quadro do edital só tem o total", () => {
      const conv = convocacaoDoEdital(
        linhasDoBanco(modelo, [
          {
            codigo_vaga: "169681",
            imediatas: 3,
            manual: true,
            quadro: { ampla: 2, indigena: 1 },
          },
        ]),
        "e1",
      );
      const r = classificar({
        tipo: "FINAL",
        regra: {
          ...REGRA,
          documental: { situacoes_aptas: [] },
          etapas: { entrevista: false },
          composicao: { componentes: [{ codigo: "DOCUMENTAL", peso: 1 }] },
        },
        candidatos: [
          {
            analise_id: "a1",
            nome: "Ana",
            vaga: "169681",
            quadro: "q1",
            nota_documental: 20,
            modalidade: "Ampla",
          },
          {
            analise_id: "a2",
            nome: "Iara",
            vaga: "169681",
            quadro: "q1",
            nota_documental: 10,
            modalidade: "Indígena",
            pontuacao_etnica: 7,
          },
        ],
        quadro: [
          {
            id: "q1",
            cargo: "Cirurgião Dentista",
            vagas_imediatas: 3,
            modalidades: {},
          },
        ],
        convocacao: conv,
      });
      const v = r.vagas[0];
      expect(v.origemDasVagas).toBe("CONVOCACAO");
      expect(v.vagasPorModalidade).toMatchObject({ AC: 2, PI: 1 });
      expect(v.porModalidade.PI[0]).toMatchObject({
        nome: "Iara",
        situacao: "VAGA",
      });
    });

    it("total diferente do quadro do edital: vale o quadro e avisa", () => {
      const conv = convocacaoDoEdital(
        linhasDoBanco(modelo, [{ codigo_vaga: "169681", imediatas: 5 }]),
        "e1",
      );
      const r = classificar({
        tipo: "PRELIMINAR",
        regra: { ...REGRA, documental: { situacoes_aptas: [] } },
        candidatos: [
          {
            analise_id: "a1",
            nome: "Ana",
            vaga: "169681",
            quadro: "q1",
            nota_documental: 20,
          },
        ],
        quadro: [
          {
            id: "q1",
            cargo: "Cirurgião Dentista",
            vagas_imediatas: 3,
            modalidades: {},
          },
        ],
        convocacao: conv,
      });
      expect(r.vagas[0].origemDasVagas).toBe("REGRA");
      expect(r.avisos.map((a) => a.codigo)).toContain(
        "VAGAS_DIFERENTES_DA_CONVOCACAO",
      );
    });

    it("percentuais da regra × modelo da convocação: divergência vira aviso", () => {
      const conv = convocacaoDoEdital(linhasDoBanco(modelo, []), "e1");
      expect(divergenciasDasCotas(REGRA, conv)).toEqual([]);
      const outra = {
        ...REGRA,
        modalidades: REGRA.modalidades.map((m) =>
          m.codigo === "PP" ? { ...m, percentual: 20 } : m,
        ),
      };
      expect(divergenciasDasCotas(outra, conv)).toEqual([
        expect.stringContaining("PP: 20% na regra × 25%"),
      ]);
    });
  });
});

bloco("lib/classificacao-dados-da-tela", () => {
  /* O que a tela de Classificação precisa em volta do motor. */

  describe("data de corte pelo cronograma", () => {
    it("o fim do período de inscrição; com prorrogação, o fim mais tarde", () => {
      expect(
        dataDeCorteDoCronograma([
          {
            atividade: "Publicação do edital",
            inicio: "2026-06-20",
            fim: "2026-06-20",
          },
          {
            atividade:
              "Período de inscrição e envio dos documentos comprobatórios",
            inicio: "2026-06-21",
            fim: "2026-07-10",
          },
          {
            atividade: "Prorrogação das inscrições",
            inicio: "2026-07-11",
            fim: "2026-07-20",
          },
          {
            atividade: "Resultado das inscrições homologadas",
            inicio: "2026-07-30",
            fim: "2026-07-30",
          },
          {
            atividade: "Recurso contra o indeferimento da inscrição",
            inicio: "2026-08-01",
            fim: "2026-08-02",
          },
        ]),
      ).toBe("2026-07-20");
    });

    it("sem etapa de inscrição (ou sem datas), null", () => {
      expect(
        dataDeCorteDoCronograma([
          { atividade: "Entrevistas", fim: "2026-08-10" },
        ]),
      ).toBeNull();
      expect(
        dataDeCorteDoCronograma([{ atividade: "Inscrições", fim: null }]),
      ).toBeNull();
      expect(dataDeCorteDoCronograma(null)).toBeNull();
    });
  });

  describe("avisos e recorte", () => {
    it("avisos agrupados por tipo, os graves primeiro", () => {
      const grupos = avisosAgrupados([
        { codigo: "DADO_FALTANDO", tom: "warning", texto: "a" },
        { codigo: "EMPATE_PENDENTE", tom: "danger", texto: "b" },
        { codigo: "DADO_FALTANDO", tom: "warning", texto: "c" },
        { codigo: "ENTREVISTA_PELO_NOME", tom: "info", texto: "d" },
      ]);
      expect(grupos.map((g) => [g.codigo, g.itens.length])).toEqual([
        ["EMPATE_PENDENTE", 1],
        ["DADO_FALTANDO", 2],
        ["ENTREVISTA_PELO_NOME", 1],
      ]);
      expect(grupos[0].rotulo).toBe("Empate aguardando sorteio ou decisão");
    });

    const resultado = {
      vagas: [
        {
          chave: "1",
          geral: [{ nome: "José Ávila" }, { nome: "Maria" }],
          porModalidade: { PP: [{ nome: "Maria" }] },
          eliminados: [{ nome: "Zé Eliminado" }],
        },
        {
          chave: "2",
          geral: [{ nome: "Ana" }],
          porModalidade: { PP: [] },
          eliminados: [],
        },
      ],
    };

    it("recorte por vaga, lista e nome (sem acento)", () => {
      expect(
        recortarResultado(resultado, RECORTE_VAZIO).map((v) => v.linhas.length),
      ).toEqual([2, 1]);
      expect(
        recortarResultado(resultado, { ...RECORTE_VAZIO, lista: "PP" }).map(
          (v) => v.linhas.length,
        ),
      ).toEqual([1, 0]);
      const busca = recortarResultado(resultado, {
        ...RECORTE_VAZIO,
        busca: "avila",
      });
      expect(busca.map((v) => [v.chave, v.linhas.map((l) => l.nome)])).toEqual([
        ["1", ["José Ávila"]],
      ]);
      expect(
        recortarResultado(resultado, {
          ...RECORTE_VAZIO,
          busca: "eliminado",
        })[0].eliminadosFiltrados,
      ).toHaveLength(1);
      expect(
        filtrosAtivosDoRecorte({ vaga: "1", lista: "PP", busca: " " }),
      ).toBe(2);
      expect(recortarResultado(null)).toEqual([]);
    });
  });

  describe("listaDaFase", () => {
    it("abre no resultado final só quando já há nota de entrevista", () => {
      expect(listaDaFase(null)).toBe("PRELIMINAR");
      expect(listaDaFase({ entrevistas: [] })).toBe("PRELIMINAR");
      expect(
        listaDaFase({
          entrevistas: [{ nota: null }, { nota: "" }, { nota: "x" }],
        }),
      ).toBe("PRELIMINAR");
      expect(
        listaDaFase({ entrevistas: [{ nota: null }, { nota: "12,5" }] }),
      ).toBe("FINAL");
    });
  });

  describe("geração guardada desatualizada em relação aos dados de agora", () => {
    const resultado = (vagas, totais = {}) => ({
      tipo: "PRELIMINAR",
      dataCorte: null,
      casas: 2,
      vagas,
      explicacoes: {},
      pendencias: [],
      avisos: [],
      totais: {
        candidatos: 1,
        elegiveis: 0,
        eliminados: 0,
        aguardando: 1,
        vagas: 1,
        avisos: 0,
        pendencias: 0,
        ...totais,
      },
    });
    const vaga = (geral = [], eliminados = []) => ({
      chave: "182428",
      codigo: "182428",
      cargo: "CARGO 2: BIÓLOGO",
      lotacao: "Belo Horizonte - MG",
      cabecalho: "VAGA 182428 - CARGO 2: BIÓLOGO - Belo Horizonte - MG",
      total: 0,
      vagasPorModalidade: null,
      cadastroReserva: true,
      origemDasVagas: "QUADRO",
      limiteConvocacao: null,
      geral,
      porModalidade: {},
      eliminados,
      aguardando: [],
    });
    const eronilda = {
      analiseId: "a1",
      nome: "Eronilda Castro",
      nota: 45,
      posicao: 1,
      empatados: 1,
      modalidades: ["AC"],
      situacao: null,
      vagaPor: null,
    };
    const agora = resultado([vaga()]);

    it("13/10 com 1 nas listas e 1.576 eliminados × hoje 0 e 0: os dados mudaram", () => {
      expect(
        geracaoDesatualizada(
          { versao_regra: 1, elegiveis: 1, eliminados: 1576 },
          agora,
          1,
        ),
      ).toBe("os dados mudaram");
    });

    it("outra versão da regra: a regra mudou", () => {
      expect(
        geracaoDesatualizada(
          { versao_regra: 1, elegiveis: 0, eliminados: 0 },
          agora,
          2,
        ),
      ).toBe("a regra mudou");
    });

    it("com o retrato lido, compara o conteúdo (mesmas quantidades, outra pessoa)", () => {
      const retratoAntigo = instantaneoDaLista(resultado([vaga([eronilda])]));
      const atual = resultado([vaga([{ ...eronilda, analiseId: "a2" }])], {
        elegiveis: 1,
      });
      const lista = {
        versao_regra: 1,
        elegiveis: 1,
        eliminados: 0,
        retrato: retratoAntigo,
      };
      expect(geracaoDesatualizada(lista, atual, 1)).toBe("os dados mudaram");
      expect(
        geracaoDesatualizada(
          lista,
          resultado([vaga([eronilda])], { elegiveis: 1 }),
          1,
        ),
      ).toBeNull();
    });

    it("a assinatura ignora a ordem das vagas e das listas", () => {
      const a = { tipo: "X", vagas: [{ chave: "2" }, { chave: "1" }] };
      const b = { tipo: "X", vagas: [{ chave: "1" }, { chave: "2" }] };
      expect(assinaturaDoRetrato(a)).toBe(assinaturaDoRetrato(b));
    });

    it("sem geração ou sem resultado: nada a dizer", () => {
      expect(geracaoDesatualizada(null, agora, 1)).toBeNull();
      expect(geracaoDesatualizada({ versao_regra: 1 }, null, 1)).toBeNull();
    });
  });
});

bloco("lib/classificacao-dados-do-estado", () => {
  describe("dados do estado da Classificação", () => {
    it("valida os campos do seletor e não libera edição por um valor não booleano", () => {
      const d = editaisDaClassificacao({
        pode_editar: "true",
        editais: [
          null,
          { id: {} },
          {
            id: "e1",
            edital: {},
            unidade: [],
            candidatos: Infinity,
            extra: { valor: 1 },
          },
        ],
      });
      expect(d.pode_editar).toBe(false);
      expect(d.editais).toHaveLength(1);
      expect(d.editais[0]).toMatchObject({
        id: "e1",
        edital: "",
        unidade: "",
        candidatos: 0,
        extra: { valor: 1 },
      });
    });
    it("conserva a configuração e os campos usados pelas peças ainda em JSX", () => {
      const configuracao = { etapas: { documental: true } };
      const d = dadosDaClassificacao({
        regra: { versao: 2, nome: "Regra atual", configuracao },
        entrevistas: [{ analise_id: "a1" }],
        candidatos: [{ analise_id: "a1", nota_documental: 5 }],
        extra: { valor: 1 },
        pode_editar: true,
      });
      expect(d.regra.configuracao).toBe(configuracao);
      expect(d.extra).toEqual({ valor: 1 });
      expect(d.entrevistas).toEqual([{ analise_id: "a1" }]);
      expect(d.pode_editar).toBe(true);
      expect(regraDaClassificacao({ versao: Infinity })).toBeNull();
    });
    it("recusa coleções malformadas para não calcular uma lista com candidatos descartados", () => {
      for (const candidatos of [{}, [null], [[]], "texto"])
        expect(() => dadosDaClassificacao({ candidatos })).toThrow(
          "dados da classificação recebidos são inválidos",
        );
      expect(() =>
        dadosDaClassificacao({ regra: { versao: 1, configuracao: [] } }),
      ).toThrow("configuração da regra recebida é inválida");
    });
    it("só devolve registros de lista com retrato válido para reexportação", () => {
      const v = {
        lista: { id: "l1", hash: "hash" },
        resultado: {
          tipo: "FINAL",
          edital: { id: "e1", edital: "105/2026" },
          vagas: [],
          modalidades: [],
          extra: { valor: 1 },
        },
      };
      expect(listaComRetrato(v)).toMatchObject({
        id: "l1",
        hash: "hash",
        retrato: { tipo: "FINAL", extra: { valor: 1 } },
      });
      expect(
        listaComRetrato({ ...v, resultado: { ...v.resultado, vagas: [null] } }),
      ).toBeNull();
      expect(listaComRetrato({ ...v, lista: { id: {} } })).toBeNull();
    });
  });
});

bloco("lib/classificacao-edicao-da-regra", () => {
  describe("Edição tipada da regra de Classificação", () => {
    it("preserva texto não numérico no rascunho e converte vírgula decimal e campo vazio", () => {
      expect(numeroOuNulo("7,")).toBe(7);
      expect(numeroOuNulo("7,5")).toBe(7.5);
      expect(numeroOuNulo(" ")).toBeNull();
      expect(numeroOuNulo("em revisão")).toBe("em revisão");
    });
    it("altera só o campo escolhido, preservando documentos e exceções sem mudar a versão carregada", () => {
      const vigente = normalizarRegra({
        documento: {
          processo: "123",
          modelos: { FINAL_GERAL: { titulo: "Resultado" } },
        },
        convocacao: { excecoes: [{ termos: ["Médico"], multiplo_vagas: 5 }] },
      });
      const depois = alterarListaDaRegra(
        alterarGrupoDaRegra(
          alterarCampoDaRegra(vigente, "rodape", "Nova nota"),
          "composicao",
          { casas: "3" },
        ),
        "FINAL",
        { empate: "MESMA_POSICAO" },
      );
      expect(vigente.rodape).toBe("");
      expect(vigente.composicao.casas).toBe(2);
      expect(vigente.listas.FINAL.empate).toBe("CRITERIOS");
      expect(depois.documento).toEqual(vigente.documento);
      expect(depois.convocacao.excecoes).toEqual(vigente.convocacao.excecoes);
      expect(normalizarRegra(depois).composicao.casas).toBe(3);
      expect(validarRegra(depois)).toEqual([]);
    });
    it("a modalidade padrão de um edital não compartilha listas com a de outro", () => {
      const a = normalizarRegra(null),
        b = normalizarRegra(null);
      a.modalidades[0].remanejar_para.push("PP");
      a.modalidades[0].agrupa.push("PI");
      expect(b.modalidades[0].remanejar_para).toEqual([]);
      expect(b.modalidades[0].agrupa).toEqual([]);
      expect(normalizarRegra(null).modalidades[0].agrupa).toEqual([]);
    });
    it("mantém as listas de modalidades e os pares cargo/nível durante a edição", () => {
      expect(listaEmMaiusculas("pp, pi; pq")).toEqual(["PP", "PI", "PQ"]);
      const niveis = niveisPorCargo(
        "Técnico=tecnico; sem nível; Agente=fundamental",
      );
      expect(textoDosNiveisPorCargo(niveis)).toBe(
        "Técnico=tecnico; Agente=fundamental",
      );
    });
    it("preserva configuração, autoria, motivo e renomeações das versões", () => {
      const regra = regraDaClassificacao({
        versao: 2,
        configuracao: {},
        versoes: [
          {
            versao: 1,
            nome: "Inicial",
            em: "2026-10-13T12:00:00Z",
            por: "Gestora",
            motivo: "Primeira regra",
            configuracao: { rodape: "Texto anterior" },
            renomeacoes: [
              { de: "Antes", para: "Inicial", motivo: "Nome claro" },
            ],
          },
        ],
      });
      expect(regra.versoes[0]).toMatchObject({
        versao: 1,
        por: "Gestora",
        motivo: "Primeira regra",
        configuracao: { rodape: "Texto anterior" },
        renomeacoes: [{ de: "Antes", para: "Inicial" }],
      });
    });
    it.each([
      "inválido",
      [null],
      [{ versao: 0 }],
      [{ versao: 1, configuracao: "inválida" }],
    ])(
      "não oferece configuração inválida como versão anterior (%j)",
      (versoes) => {
        expect(() =>
          regraDaClassificacao({ versao: 2, configuracao: {}, versoes }),
        ).toThrow();
      },
    );
  });
});

bloco("lib/classificacao-escala-da-previa", () => {
  /* A escala da folha A4 na prévia "Como fica no SEI" (documento.tsx). */
  describe("escala da prévia do SEI", () => {
    it("Ajustar: a folha cabe na largura da mesa (1366 px, celular)", () => {
      // Notebook 1366: modal ~1340, painel de 400 → mesa ~940.
      expect(escalaParaLargura(940)).toBe(1.14);
      // Painel recolhido: a folha cresce (até o limite de 200%).
      expect(escalaParaLargura(1340)).toBe(1.65);
      // Celular de 375 px: a folha inteira cabe (~43%); o zoom amplia.
      expect(escalaParaLargura(375)).toBe(0.43);
      expect(escalaParaLargura(100)).toBe(0.3);
      expect(escalaParaLargura(0)).toBe(1);
    });

    it("zoom − / + anda pelos passos e para nos limites", () => {
      expect(proximoZoom(1, 1)).toBe(1.1);
      expect(proximoZoom(1, -1)).toBe(0.9);
      expect(proximoZoom(1.14, 1)).toBe(1.25);
      expect(proximoZoom(1.14, -1)).toBe(1.1);
      expect(proximoZoom(2, 1)).toBe(2);
      expect(proximoZoom(0.5, -1)).toBe(0.5);
      expect(proximoZoom(0.43, 1)).toBe(0.5);
      expect(limitarEscala(9)).toBe(2);
      expect(limitarEscala(Number.NaN)).toBe(1);
      expect(rotuloDoZoom(0.67)).toBe("67%");
    });

    it("a área escalada acompanha a folha (no mínimo uma página A4)", () => {
      expect(tamanhoEscalado(0, 1)).toEqual({
        largura: LARGURA_DA_FOLHA,
        altura: ALTURA_DA_PAGINA,
      });
      expect(tamanhoEscalado(3000, 0.5)).toEqual({
        largura: 397,
        altura: 1500,
      });
    });
  });
});

bloco("lib/classificacao-exportacao", () => {
  /*
  O retrato da lista (o que vai para o banco) e a exportação no padrão das
  publicações: só nome, cabeçalho da vaga, "Não houve candidatos aptos.",
  rodapé configurável; DOCX, XLSX e a página de impressão (PDF).
*/
  const SEED = readFileSync(
    "tests/fixtures/sql-de-dados/20261002-regras-de-classificacao-83-e-100.sql",
    "utf8",
  );
  const inicio = SEED.indexOf("$regra100$") + 10;
  const REGRA_100 = JSON.parse(
    SEED.slice(inicio, SEED.indexOf("$regra100$", inicio)),
  );

  const c = (id, nome, nota, campos = {}) => ({
    analise_id: `00000000-0000-4000-8000-00000000000${id}`,
    codigo: `98765${id}`,
    nome,
    vaga: "178529",
    cargo: "Analista Técnico de Saúde Indígena",
    modalidade: "Ampla concorrência",
    status: "Aprovado",
    nota_documental: nota,
    data_nascimento: "1970-01-01",
    quadro: "q",
    ...campos,
  });
  const QUADRO = [
    {
      id: "q",
      ordem: 1,
      cargo: "Analista Técnico de Saúde Indígena",
      lotacao: "CASAI Brasília",
      modalidades: { "Ampla Concorrência": 2 },
      vagas_imediatas: 2,
      cadastro_reserva: true,
    },
    {
      id: "q2",
      ordem: 2,
      cargo: "Nutricionista",
      lotacao: "CASAI Brasília",
      modalidades: {},
      vagas_imediatas: 0,
      cadastro_reserva: true,
    },
  ];
  const resultado = classificar({
    tipo: "PRELIMINAR",
    regra: REGRA_100,
    candidatos: [
      c(1, "Ana <img src=x onerror=alert(1)>", "15,5"),
      c(2, "Bruno Indígena", "13", {
        modalidade: "Indígenas",
        pontuacao_etnica: 8,
      }),
      c(3, "Carla Reprovada", "9", { status: "Reprovado" }),
    ],
    quadro: QUADRO,
    dataCorte: "2026-09-20",
  });
  const retrato = instantaneoDaLista(resultado, {
    edital: {
      id: "e1",
      edital: "100/2026",
      unidade: "CASAI Nacional Brasília",
    },
    regra: REGRA_100,
    versao: 3,
  });
  const texto = (bytes) => new TextDecoder().decode(bytes);

  describe("retrato da lista", () => {
    it("só nome: sem CPF, nascimento, código de inscrição ou contato", () => {
      const json = JSON.stringify(retrato);
      expect(json).not.toContain("1970-01-01");
      expect(json).not.toContain("987651");
      expect(json).not.toMatch(/cpf|email|telefone|nascimento/i);
      const linhas = retrato.vagas.flatMap((v) => [
        ...v.geral,
        ...Object.values(v.listas).flat(),
        ...v.eliminados,
      ]);
      expect(
        linhas.every((l) =>
          Object.keys(l).every((k) =>
            [
              "posicao",
              "analise_id",
              "nome",
              "nota",
              "modalidades",
              "situacao",
              "motivo",
              "detalhe",
            ].includes(k),
          ),
        ),
      ).toBe(true);
      expect(retrato).toMatchObject({
        schema: 1,
        tipo: "PRELIMINAR",
        regra_versao: 3,
        casas: 2,
      });
    });

    it("guarda listas, eliminados com motivo, avisos e totais", () => {
      const vaga = retrato.vagas[0];
      expect(vaga.geral.map((l) => [l.posicao, l.nome])).toEqual([
        [1, "Ana <img src=x onerror=alert(1)>"],
        [2, "Bruno Indígena"],
      ]);
      expect(vaga.listas.PI.map((l) => l.posicao)).toEqual([1]);
      expect(vaga.eliminados).toEqual([
        {
          analise_id: "00000000-0000-4000-8000-000000000003",
          nome: "Carla Reprovada",
          motivo: "NAO_HABILITADO",
          detalhe: "Situação na análise: Reprovado.",
        },
      ]);
      expect(retrato.totais).toMatchObject({ elegiveis: 2, eliminados: 1 });
    });
  });

  describe("documento no padrão das publicações (100/2026: modalidades no mesmo documento)", () => {
    const doc = documentoOficial(retrato, { regra: REGRA_100 });
    const rotulos = (t) => t.colunas.map((c) => c.rotulo);

    it("título, cabeçalho da vaga, geral com Modalidade e sublistas", () => {
      expect(doc.titulo).toEqual([
        "RESULTADO PRELIMINAR - ETAPA DE ANÁLISE CURRICULAR",
      ]);
      expect(doc.blocos.map((b) => b.cabecalho)).toEqual([
        "VAGA 178529 - Analista Técnico de Saúde Indígena - CASAI Brasília - 2 vagas (2 AC + CR)",
        "VAGA - Nutricionista - CASAI Brasília - Cadastro Reserva",
      ]);
      const [geral, pp, pi] = doc.blocos[0].tabelas;
      expect(geral.titulo).toBe("Classificação Geral");
      expect(rotulos(geral)).toEqual([
        "Classificação",
        "Nome",
        "Modalidade de Concorrência",
        "Nota Final",
        ...rotulos(geral).slice(4),
      ]);
      expect(geral.linhas.map((l) => l.slice(0, 4))).toEqual([
        ["1º", "Ana <img src=x onerror=alert(1)>", "AC", "15,50"],
        ["2º", "Bruno Indígena", "PI", "13,00"],
      ]);
      expect([pp.titulo, pp.linhas]).toEqual(["Pretos e Pardos", []]);
      expect(rotulos(pi).slice(0, 3)).toEqual([
        "Classificação",
        "Nome",
        "Nota Final",
      ]);
      expect(doc.preliminares[0].texto).toContain(
        "destinado à **Casa de Apoio à Saúde Indígena Nacional Brasília (CASAI Nacional Brasília)**",
      );
    });

    it("uma lista só (modalidade): sem a coluna Modalidade, texto das vagas reservadas", () => {
      const so = documentoOficial(retrato, { lista: "PI", regra: REGRA_100 });
      expect(so.blocos[0].tabelas).toHaveLength(1);
      expect(so.blocos[0].tabelas[0].titulo).toBe("");
      expect(so.preliminares[0].texto).toContain(
        "das Vagas Reservadas para Indígenas (PI)",
      );
      expect(so.nome).toBe(
        "Resultado Preliminar - Etapa de Análise Curricular - Indígenas",
      );
      expect(nomeDoArquivo(retrato, "PI")).toBe(
        "classificacao-preliminar-100-2026-pi",
      );
    });

    it("HTML do SEI e DOCX: nomes escapados, vazia = 'Não houve candidatos aptos.'", () => {
      const html = htmlParaSei(doc);
      expect(html).toContain("Ana &lt;img src=x onerror=alert(1)&gt;");
      expect(html).not.toContain("<img");
      expect(html).toContain("Não houve candidatos aptos.");
      const conteudo = texto(
        gerarDocxOficial(doc, { quando: new Date("2026-10-02T12:00:00") }),
      );
      expect([...conteudo.slice(0, 2)].join("")).toBe("PK");
      expect(conteudo).toContain("Ana &lt;img src=x onerror=alert(1)&gt;");
      expect(conteudo).not.toContain("<img");
      expect(conteudo).toContain("Não houve candidatos aptos.");
    });

    it("XLSX: duas planilhas (Classificação e Eliminados), números como número", () => {
      const { classificacao, eliminados } = linhasDaPlanilha(retrato);
      expect(classificacao[0]).toEqual([
        "Vaga",
        "Cargo",
        "Lista",
        "Classificação",
        "Nome",
        "Nota",
        "Modalidade",
        "Situação",
      ]);
      expect(classificacao[1]).toEqual([
        "178529",
        "Analista Técnico de Saúde Indígena",
        "Classificação Geral",
        1,
        "Ana <img src=x onerror=alert(1)>",
        15.5,
        "AC",
        "",
      ]);
      expect(eliminados[1][3]).toBe("Não habilitado na avaliação documental");
      const conteudo = texto(gerarXlsxDaLista(retrato));
      expect(conteudo).toContain('<sheet name="Eliminados"');
      expect(conteudo).toContain("<v>15.5</v>");
      expect(conteudo).not.toContain("<img");
    });
  });

  describe("colunas do documento: larguras ajustadas aos títulos (114/2026)", () => {
    const doc = documentoOficial(retrato, { regra: REGRA_100 });
    const [geral, , pi] = doc.blocos[0].tabelas;
    const colunas = (t) =>
      t.colunas
        .slice(0, 4)
        .map((c) => [c.rotulo, c.largura, c.alinhamento].join(" "));
    const soParciaisFora = (t) =>
      t.colunas.filter((c) => !/Formação|Cursos|Experiência/.test(c.rotulo));

    it("Classificação 12% e Nota Final 12% ao centro; Nome (60%) e Modalidade (16%) à esquerda", () => {
      const semParciais = documentoOficial(retrato, {
        regra: {
          ...REGRA_100,
          documental: { ...REGRA_100.documental, parciais: [] },
        },
      }).blocos[0].tabelas[0];
      expect(colunas(semParciais)).toEqual([
        "Classificação 12 centro",
        "Nome 60 esquerda",
        "Modalidade de Concorrência 16 esquerda",
        "Nota Final 12 centro",
      ]);
      expect(soParciaisFora(pi).map((c) => c.largura)).toEqual([12, 76, 12]);
      for (const t of [geral, pi])
        expect(t.colunas.reduce((s, c) => s + c.largura, 0)).toBe(100);
    });

    it("documento com as listas das cotas não diz 'das Vagas de Ampla Concorrência'", () => {
      expect(doc.preliminares[0].texto).not.toContain("Ampla Concorrência");
      expect(doc.preliminares[0].texto).toContain(
        "Avaliação Documental e de Títulos**",
      );
      const soGeral = documentoOficial(retrato, {
        lista: "geral",
        regra: REGRA_100,
      });
      expect(soGeral.preliminares[0].texto).toContain(
        "das Vagas de Ampla Concorrência",
      );
    });

    it("DOCX: título sem quebra, margens estreitas, mesma largura do quadro vazio", () => {
      const conteudo = texto(
        gerarDocxOficial(doc, { quando: new Date("2026-10-02T12:00:00") }),
      );
      expect(conteudo).toContain("<w:noWrap/>");
      expect(conteudo).toContain(
        '<w:tblCellMar><w:left w:w="57" w:type="dxa"/>',
      );
      const larguras = [...conteudo.matchAll(/<w:tblW w:w="(\d+)"/g)].map((m) =>
        Number(m[1]),
      );
      expect(Math.max(...larguras) - Math.min(...larguras)).toBeLessThanOrEqual(
        3,
      );
    });

    it("XLSX: larguras de coluna proporcionais", () => {
      const conteudo = texto(gerarXlsxDaLista(retrato));
      expect(conteudo).toContain(
        '<col min="5" max="5" width="40" customWidth="1"/>',
      );
    });
  });

  describe("aguardando análise no retrato e no XLSX", () => {
    const comPendente = classificar({
      tipo: "PRELIMINAR",
      regra: REGRA_100,
      candidatos: [
        c(1, "Ana Apta", "15,5"),
        c(4, "Davi Pendente", null, { status: "Pendente" }),
      ],
      quadro: QUADRO,
      dataCorte: "2026-09-20",
    });
    const r = instantaneoDaLista(comPendente, { regra: REGRA_100 });

    it("o retrato guarda quem aguarda (só nome e situação), fora dos eliminados", () => {
      expect(r.vagas[0].eliminados).toEqual([]);
      expect(r.vagas[0].aguardando).toEqual([
        {
          analise_id: "00000000-0000-4000-8000-000000000004",
          nome: "Davi Pendente",
          situacao: "Pendente",
        },
      ]);
      expect(r.totais).toMatchObject({ eliminados: 0, aguardando: 1 });
      expect(retrato.vagas[0].aguardando).toBeUndefined();
    });

    it("planilha 'Aguardando análise' só quando há alguém", () => {
      const { aguardando } = linhasDaPlanilha(r);
      expect(aguardando).toEqual([
        ["Vaga", "Cargo", "Nome", "Situação na análise"],
        [
          "178529",
          "Analista Técnico de Saúde Indígena",
          "Davi Pendente",
          "Pendente",
        ],
      ]);
      expect(texto(gerarXlsxDaLista(r))).toContain(
        '<sheet name="Aguardando análise"',
      );
      expect(texto(gerarXlsxDaLista(retrato))).not.toContain(
        "Aguardando análise",
      );
    });
  });
});

bloco("lib/classificacao-hash-do-retrato", () => {
  /*
  O hash do retrato pelo CONTEÚDO (20261024130000): a tela, o Python e o banco
  fazem a mesma conta. Aqui, o lado da tela: o motor.ts gera de novo cada lista
  dos casos dourados e o hash bate com tests/fixtures/classificacao/
  hash-dos-retratos.json — o pytest (tests/python/
  test_classificacao_hash_do_retrato.py) gera as mesmas listas com o motor
  Python (que escreve 35.0) e confere o MESMO hash; o ensaio da migration
  confere os exemplos no banco. Dados fictícios.
*/
  const DOURADO = JSON.parse(
    readFileSync("tests/fixtures/classificacao/casos-do-motor.json", "utf8"),
  );
  const HASHES = JSON.parse(
    readFileSync("tests/fixtures/classificacao/hash-dos-retratos.json", "utf8"),
  );

  function retratoDaTela(caso, i) {
    const entrada = DOURADO.editais[caso.edital];
    const bruta = entrada.convocacao;
    const resultado = JSON.parse(
      JSON.stringify(
        classificar({
          tipo: caso.tipo,
          ...entrada,
          convocacao: bruta
            ? convocacaoDoEdital(
                { configuracoes: bruta.configuracoes, modelos: bruta.modelos },
                bruta.edital_id,
              )
            : null,
        }),
      ),
    );
    return JSON.parse(
      JSON.stringify(
        retratoDaClassificacao(
          instantaneoDaLista(resultado, {
            edital: caso.editalDoRetrato,
            regra: entrada.regra,
            versao: Math.floor(i / 4) + 1,
          }),
        ),
      ),
    );
  }

  describe("hash do retrato pelo conteúdo", () => {
    it("35 e 35.0 dão o mesmo hash (o texto do jsonb sem zeros à direita)", () => {
      const python = JSON.parse('{"nota": 35.0, "parciais": [7.50, 0.0]}');
      const tela = { nota: 35, parciais: [7.5, 0] };
      expect(hashDoRetrato(python)).toBe(hashDoRetrato(tela));
      expect(textoCanonicoDoRetrato(tela)).toBe(
        '{"nota": 35, "parciais": [7.5, 0]}',
      );
      expect(hashDoRetrato({ nota: 35 })).toBe(sha256Hex('{"nota": 35}'));
      // Outro valor, outro hash; o texto "35.0" não é número e fica como está.
      expect(hashDoRetrato({ nota: 35.01 })).not.toBe(hashDoRetrato(tela));
      expect(textoCanonicoDoRetrato({ s: "35.0" })).toBe('{"s": "35.0"}');
    });

    it("o texto é o do jsonb do PostgreSQL: chaves por tamanho e bytes, escapes e números sem expoente", () => {
      expect(textoCanonicoDoRetrato({ bb: 1, a: 2, ab: [], c: {} })).toBe(
        '{"a": 2, "c": {}, "ab": [], "bb": 1}',
      );
      expect(textoCanonicoDoRetrato({ é: 1, z: 2 })).toBe('{"z": 2, "é": 1}');
      expect(textoCanonicoDoRetrato('a"b\\c\n\t\u0001/ç')).toBe(
        '"a\\"b\\\\c\\n\\t\\u0001/ç"',
      );
      expect(textoCanonicoDoRetrato([null, true, false, undefined])).toBe(
        "[null, true, false, null]",
      );
      expect(textoCanonicoDoRetrato({ x: undefined, y: 1 })).toBe('{"y": 1}');
      expect(numeroCanonico(1e-7)).toBe("0.0000001");
      expect(numeroCanonico(1e21)).toBe("1000000000000000000000");
      expect(numeroCanonico(-0)).toBe("0");
      expect(numeroCanonico(-2.5)).toBe("-2.5");
      expect(numeroCanonico(123.456)).toBe("123.456");
      expect(() => numeroCanonico(Number.NaN)).toThrow();
    });

    it("os exemplos da fixture (os mesmos que o ensaio confere no banco)", () => {
      for (const e of HASHES.exemplos)
        expect(hashDoRetrato(JSON.parse(e.texto))).toBe(e.hash);
    });

    it.each(DOURADO.casos.map((c, i) => [c.nome, c, i]))(
      "teste cruzado: a lista que a tela gera tem o hash da fixture (o mesmo do Python): %s",
      (nome, caso, i) => {
        expect(hashDoRetrato(retratoDaTela(caso, i))).toBe(HASHES.casos[nome]);
      },
    );

    it("a fixture cobre todos os casos dourados", () => {
      expect(Object.keys(HASHES.casos).sort()).toEqual(
        DOURADO.casos.map((c) => c.nome).sort(),
      );
    });
  });
});

bloco("lib/classificacao-listas-por-etapa", () => {
  /*
  As quatro listas por etapa, no padrão das publicações da AgSUS
  (scratchpad/classificacao/listas-publicadas.md): avaliação documental com as
  parciais e os eliminados com justificativa, convocação para entrevista,
  resultado da entrevista (empate na mesma posição, como o 83/2026 publicou) e
  resultado final com vaga imediata × cadastro reserva.
*/

  const SEED = readFileSync(
    "tests/fixtures/sql-de-dados/20261002-regras-de-classificacao-83-e-100.sql",
    "utf8",
  );
  const regraDoSeed = (marca) => {
    const inicio = SEED.indexOf(`$${marca}$`) + marca.length + 2;
    return JSON.parse(SEED.slice(inicio, SEED.indexOf(`$${marca}$`, inicio)));
  };
  const REGRA_83 = {
    ...regraDoSeed("regra83"),
    documental: {
      ...regraDoSeed("regra83").documental,
      parciais: ["FORMACAO", "CURSOS", "EXPERIENCIA", "ETNICO"],
    },
  };

  let n = 0;
  const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
  const cand = (nome, doc, campos = {}) => ({
    analise_id: id(),
    codigo: String(100 + n),
    nome,
    vaga: "169681",
    cargo: "Cirurgião Dentista - Área de abrangência DSEI Xingu",
    modalidade: "Ampla concorrência",
    pcd: "Não",
    status: "Aprovado",
    nota_documental: doc,
    quadro: "q1",
    pontuacao_formacao: 1,
    pontuacao_cursos: 2,
    pontuacao_experiencia: 10,
    pontuacao_etnica: 0,
    ...campos,
  });
  const ent = (c, nota, campos = {}) => ({
    id: id(),
    analise_id: c.analise_id,
    nome: c.nome,
    vaga: c.vaga,
    nota,
    parecer: "APTO",
    compareceu: "S",
    ligacao: "codigo",
    origem: "sistema",
    notas: [],
    ...campos,
  });
  const QUADRO = [
    {
      id: "q1",
      ordem: 1,
      cargo: "Cirurgião Dentista",
      lotacao: "Área de abrangência DSEI Xingu",
      modalidades: { "Ampla Concorrência": 1 },
      vagas_imediatas: 1,
      cadastro_reserva: true,
    },
  ];

  // Vaga com 1 vaga imediata: 83 convoca 5 × 1 = 5.
  const jucikely = cand("Jucikely", 14);
  const pedro = cand("Pedro", 13);
  const vanderlei = cand("Vanderlei", 12);
  const ana = cand("Ana", 11);
  const bia = cand("Bia", 10);
  const fora = cand("Fora do limite", 9);
  const reprovada = cand("Reprovada", 4, { pontuacao_experiencia: 1 });
  const candidatos = [jucikely, pedro, vanderlei, ana, bia, fora, reprovada];
  const entrevistas = [
    ent(jucikely, 17.3),
    ent(pedro, 17.3),
    ent(vanderlei, 16),
    ent(ana, 9), // abaixo de 10
    ent(bia, 12, { compareceu: "N" }),
    ent(fora, 20), // fora do limite: não é desta etapa
  ];
  const base = {
    regra: REGRA_83,
    candidatos,
    entrevistas,
    quadro: QUADRO,
    dataCorte: "2026-07-20",
  };
  const nomes = (linhas) => linhas.map((l) => `${l.posicao} ${l.nome}`);

  describe("tipos de lista", () => {
    it("as quatro etapas, na ordem das publicações", () => {
      expect(TIPOS_DE_LISTA.map(([v]) => v)).toEqual([
        "PRELIMINAR",
        "CONVOCACAO",
        "ENTREVISTA",
        "FINAL",
      ]);
    });
  });

  describe("avaliação documental: parciais e eliminados com justificativa", () => {
    const r = classificar({ ...base, tipo: "PRELIMINAR" });
    const retrato = instantaneoDaLista(r, {
      edital: { edital: "83/2026", unidade: "DSEI Xingu" },
      regra: REGRA_83,
    });

    it("a linha leva as parciais que a regra publica", () => {
      expect(retrato.parciais).toEqual([
        "FORMACAO",
        "CURSOS",
        "EXPERIENCIA",
        "ETNICO",
      ]);
      expect(retrato.vagas[0].geral[0]).toMatchObject({
        nome: "Jucikely",
        parciais: { FORMACAO: 1, CURSOS: 2, EXPERIENCIA: 10, ETNICO: 0 },
      });
    });

    const rotulos = (t) => t.colunas.map((c) => c.rotulo);
    // O 83/2026 publicou as parciais: o gestor as marca na aba Colunas.
    const PARCIAIS = [
      "PARCIAL_FORMACAO",
      "PARCIAL_CURSOS",
      "PARCIAL_EXPERIENCIA",
      "PARCIAL_ETNICO",
    ];
    const COMO_O_83 = {
      ...REGRA_83,
      documento: {
        colunas: {
          PRELIMINAR_PRELIMINAR: ["CLASSIFICACAO", "NOME", "NOTA", ...PARCIAIS],
          PRELIMINAR_PRELIMINAR_ELIMINADOS: ["NOME", "NOTA", ...PARCIAIS],
        },
      },
    };

    it("padrão enxuto: Classificação | Nome | Nota Final (parciais desmarcadas)", () => {
      const doc = documentoOficial(retrato, {
        lista: "geral",
        regra: REGRA_83,
      });
      expect(rotulos(doc.blocos[0].tabelas[0])).toEqual([
        "Classificação",
        "Nome",
        "Nota Final",
      ]);
    });

    it("documento como o 83/2026 (parciais marcadas): Classificação | Nome | Nota Final | parciais", () => {
      const doc = documentoOficial(retrato, {
        lista: "geral",
        regra: COMO_O_83,
      });
      expect(doc.titulo).toEqual([
        "RESULTADO PRELIMINAR - ETAPA DE ANÁLISE CURRICULAR",
      ]);
      expect(doc.preliminares[1].texto).toContain(
        "ordem decrescente de pontuação",
      );
      const [geral] = doc.blocos[0].tabelas;
      expect(rotulos(geral)).toEqual([
        "Classificação",
        "Nome",
        "Nota Final",
        "Formação Acadêmica",
        "Cursos de Aperfeiçoamento",
        "Experiência Profissional",
        "Pontuação Étnica",
      ]);
      expect(geral.linhas[0]).toEqual([
        "1º",
        "Jucikely",
        "14,0",
        "1,0",
        "2,0",
        "10,0",
        "0,0",
      ]);
    });

    it("fase final no título (depois dos recursos) e as disposições finais da convocação", () => {
      const doc = documentoOficial(retrato, { fase: "FINAL", regra: REGRA_83 });
      expect(doc.titulo).toEqual([
        "RESULTADO FINAL - ETAPA DE ANÁLISE CURRICULAR",
      ]);
      expect(doc.finais[0].texto).toContain("nos termos do item 8.24");
    });

    it("lista de eliminados: nome, nota, parciais e justificativa", () => {
      const doc = documentoOficial(retrato, {
        lista: "eliminados",
        regra: COMO_O_83,
      });
      expect(doc.nome).toBe(
        "Resultado Preliminar - Etapa de Análise Curricular - Eliminados",
      );
      expect(doc.preliminares[0].texto).toContain(
        "**Resultado Preliminar da Etapa de Avaliação Documental e de Títulos dos Candidatos Eliminados**",
      );
      const [t] = doc.blocos[0].tabelas;
      expect(rotulos(t).at(0)).toBe("Nome");
      expect(rotulos(t).at(-1)).toBe("Justificativa");
      expect(t.linhas).toEqual([
        [
          "Reprovada",
          "4,0",
          "1,0",
          "2,0",
          "1,0",
          "0,0",
          "Abaixo da nota mínima da avaliação documental. Nota 4,0; mínimo 7,0 (superior).",
        ],
      ]);
      expect(t.colunas.reduce((soma, c) => soma + c.largura, 0)).toBe(100);
    });
  });

  describe("convocação para entrevista", () => {
    it("5 × 1 vaga: os cinco primeiros; o 6º fica fora com o motivo", () => {
      const r = classificar({ ...base, tipo: "CONVOCACAO" });
      expect(nomes(r.vagas[0].geral)).toEqual([
        "1 Jucikely",
        "2 Pedro",
        "3 Vanderlei",
        "4 Ana",
        "5 Bia",
      ]);
      expect(
        r.vagas[0].eliminados.find((e) => e.nome === "Fora do limite").motivo,
      ).toBe("NAO_CONVOCADO");
    });
  });

  describe("resultado da entrevista", () => {
    const r = classificar({ ...base, tipo: "ENTREVISTA" });
    const v = r.vagas[0];

    it("só os convocados aptos, pela nota da entrevista; empate na mesma posição", () => {
      expect(nomes(v.geral)).toEqual(["1 Jucikely", "1 Pedro", "2 Vanderlei"]);
      expect(v.geral.every((l) => l.situacao === "APTO")).toBe(true);
      expect(r.pendencias).toEqual([]);
    });

    it("eliminados da entrevista com motivo; quem não foi convocado não aparece", () => {
      expect(v.eliminados.map((e) => [e.nome, e.motivo])).toEqual([
        ["Bia", "AUSENTE"],
        ["Ana", "ABAIXO_NOTA_MINIMA_ENTREVISTA"],
      ]);
      const todos = [...v.geral, ...v.eliminados].map((l) => l.nome);
      expect(todos).not.toContain("Fora do limite");
      expect(todos).not.toContain("Reprovada");
    });

    it("documento no padrão: RESULTADO PRELIMINAR - ETAPA DE ENTREVISTA, Classificação | Nome | Nota", () => {
      const retrato = instantaneoDaLista(r, {
        edital: { edital: "83/2026" },
        regra: REGRA_83,
      });
      expect(retrato.parciais).toBeUndefined();
      const doc = documentoOficial(retrato, {
        lista: "geral",
        regra: REGRA_83,
      });
      expect(doc.titulo).toEqual([
        "RESULTADO PRELIMINAR - ETAPA DE ENTREVISTA",
      ]);
      expect(doc.blocos[0].tabelas[0].colunas.map((c) => c.rotulo)).toEqual([
        "Classificação",
        "NOME",
        "NOTA",
      ]);
      expect(doc.blocos[0].tabelas[0].linhas.map((l) => l[0])).toEqual([
        "1º",
        "1º",
        "2º",
      ]);
      expect(linhasDaPlanilha(retrato).classificacao[1].at(-1)).toBe("Apto");
    });

    it("com critérios na lista da entrevista, o que sobra continua na mesma posição (sem sorteio)", () => {
      const regra = {
        ...REGRA_83,
        listas: { ...REGRA_83.listas, ENTREVISTA: { empate: "CRITERIOS" } },
        empate_final: { metodo: "SORTEIO", numeracao: "DENSA" },
      };
      const x = classificar({ ...base, regra, tipo: "ENTREVISTA" });
      // Jucikely tem nota documental maior (critério e): passa à frente.
      expect(nomes(x.vagas[0].geral).slice(0, 2)).toEqual([
        "1 Jucikely",
        "2 Pedro",
      ]);
      expect(x.pendencias).toEqual([]);
    });
  });

  describe("resultado final: vaga imediata e cadastro reserva", () => {
    it("documento como o 83/2026: CLASSIFICAÇÃO | NOME | NOTA FINAL (sem situação)", () => {
      const r = classificar({ ...base, tipo: "FINAL" });
      const retrato = instantaneoDaLista(r, {
        edital: { edital: "83/2026" },
        regra: REGRA_83,
      });
      const doc = documentoOficial(retrato, {
        lista: "geral",
        regra: REGRA_83,
      });
      expect(doc.titulo).toEqual(["RESULTADO FINAL - PROCESSO SELETIVO"]);
      const [t] = doc.blocos[0].tabelas;
      expect(t.colunas.map((c) => c.rotulo)).toEqual([
        "CLASSIFICAÇÃO",
        "NOME",
        "NOTA FINAL",
      ]);
      expect(t.linhas).toEqual([
        ["1º", "Jucikely", "31,3"],
        ["2º", "Pedro", "30,3"],
        ["3º", "Fora do limite", "29,0"],
        ["4º", "Vanderlei", "28,0"],
      ]);
      const planilha = linhasDaPlanilha(retrato).classificacao;
      expect(planilha[0].slice(-3)).toEqual([
        "Situação",
        "Nota da análise curricular",
        "Nota da entrevista",
      ]);
      expect(planilha[1].at(-3)).toBe("Dentro das vagas");
    });

    it("nota de cada etapa (16/11/2026): no retrato, como coluna à escolha no documento e na planilha", () => {
      const r = classificar({ ...base, tipo: "FINAL" });
      const primeira = r.vagas[0].geral[0];
      expect(primeira.notaDocumental).not.toBeUndefined();
      expect(primeira.notaEntrevista).not.toBeUndefined();
      const retrato = instantaneoDaLista(r, {
        edital: { edital: "83/2026" },
        regra: REGRA_83,
      });
      const linha = retrato.vagas[0].geral[0];
      expect(linha.nota_documental).toBe(primeira.notaDocumental);
      expect(linha.nota_entrevista).toBe(primeira.notaEntrevista);
      // Na regra que não as marca, o documento fica como antes (enxuto).
      const comEtapas = {
        ...REGRA_83,
        documento: {
          colunas: {
            FINAL_FINAL: [
              "CLASSIFICACAO",
              "NOME",
              "NOTA_DOCUMENTAL",
              "NOTA_ENTREVISTA",
              "NOTA",
            ],
          },
        },
      };
      const doc = documentoOficial(retrato, {
        lista: "geral",
        fase: "FINAL",
        regra: comEtapas,
      });
      const [tabela] = doc.blocos[0].tabelas;
      expect(tabela.colunas.map((c) => c.rotulo)).toEqual([
        "CLASSIFICAÇÃO",
        "NOME",
        "NOTA DA ANÁLISE CURRICULAR",
        "NOTA DA ENTREVISTA",
        "NOTA FINAL",
      ]);
      expect(tabela.linhas[0]).toHaveLength(5);
      expect(tabela.linhas[0].at(-1)).toBe("31,3");
    });

    it("entrevistado fora do limite de convocação vira aviso (não some, não entra calado)", () => {
      const r = classificar({ ...base, tipo: "FINAL" });
      expect(
        r.avisos.filter((a) => a.codigo === "ENTREVISTADO_NAO_CONVOCADO"),
      ).toHaveLength(1);
    });
  });
});

bloco("lib/classificacao-metadados-das-listas", () => {
  describe("Metadados das listas e desempates", () => {
    it("mantém o histórico, a versão e as pendências usados nos botões da lista", () => {
      expect(
        listaRegistrada({
          id: "l1",
          tipo: "FINAL",
          publicada: false,
          pendencias: 2,
          gerada_em: "2026-10-13T12:00:00Z",
          por: "Gestora",
          versao_regra: 3,
          hash: "abc",
          detalhe: "preservado",
        }),
      ).toMatchObject({
        id: "l1",
        publicada: false,
        pendencias: 2,
        versao_regra: 3,
        por: "Gestora",
        detalhe: "preservado",
      });
    });
    it.each(["2", -1, 1.5, NaN])(
      "uma contagem inválida não libera a publicação (%j)",
      (pendencias) => {
        expect(() => listaRegistrada({ id: "l1", pendencias })).toThrow(
          "pendências",
        );
      },
    );
    it("não trata a string false como o estado de publicação", () => {
      expect(() => listaRegistrada({ id: "l1", publicada: "false" })).toThrow(
        "Situação de publicação",
      );
    });
    it("preserva a ordem completa e os dados para conferência do sorteio", () => {
      expect(
        desempateRegistrado({
          chave: "FINAL|v1|a1,a2",
          metodo: "SORTEIO",
          ordem: ["a2", "a1"],
          semente: "abcd",
          origem_semente: "SERVIDOR",
        }),
      ).toMatchObject({
        ordem: ["a2", "a1"],
        semente: "abcd",
        origem_semente: "SERVIDOR",
      });
    });
    it.each([undefined, [], ["a1", null], ["a1", "a1"], ["a1", ""]])(
      "não retira entradas inválidas para aceitar uma ordem parcial (%j)",
      (ordem) => {
        expect(() =>
          desempateRegistrado({
            chave: "k1",
            metodo: "SORTEIO",
            semente: "abcd",
            ordem,
          }),
        ).toThrow();
      },
    );
    it("não confirma sorteio sem semente; decisão manual preserva a justificativa", () => {
      expect(() =>
        desempateRegistrado({
          chave: "k1",
          metodo: "SORTEIO",
          ordem: ["a1", "a2"],
        }),
      ).toThrow("incompleto");
      expect(
        desempateRegistrado({
          chave: "k1",
          metodo: "MANUAL",
          ordem: ["a2", "a1"],
          justificativa: "Decisão documentada",
        }),
      ).toMatchObject({
        metodo: "MANUAL",
        justificativa: "Decisão documentada",
        ordem: ["a2", "a1"],
      });
    });
  });
});

bloco("lib/classificacao-motor", () => {
  /*
  O motor da classificação com casos montados a partir das listas publicadas
  dos editais 83/2026 e 100/2026 (levantamento em
  scratchpad/classificacao/listas-publicadas.md e verificacao-desempate.md) e
  com as regras de exemplo dos seeds (tests/fixtures/sql-de-dados/20261002-…).
*/

  const SEED = readFileSync(
    "tests/fixtures/sql-de-dados/20261002-regras-de-classificacao-83-e-100.sql",
    "utf8",
  );
  const regraDoSeed = (marca) => {
    const inicio = SEED.indexOf(`$${marca}$`) + marca.length + 2;
    return JSON.parse(SEED.slice(inicio, SEED.indexOf(`$${marca}$`, inicio)));
  };
  const REGRA_83 = regraDoSeed("regra83");
  const REGRA_100 = regraDoSeed("regra100");

  let sequencia = 0;
  const uuid = () => {
    sequencia += 1;
    return `00000000-0000-4000-8000-${String(sequencia).padStart(12, "0")}`;
  };

  /* Um candidato da análise como o RPC devolve. */
  function candidato(nome, campos = {}) {
    return {
      analise_id: uuid(),
      codigo: String(1000 + sequencia),
      nome,
      vaga: "169681",
      cargo: "Cirurgião Dentista - Área de abrangência DSEI Xingu",
      modalidade: "Ampla concorrência",
      pcd: "Não",
      status: "Aprovado",
      pontuacao_etnica: 0,
      ...campos,
    };
  }
  const entrevista = (c, nota, campos = {}) => ({
    id: uuid(),
    analise_id: c.analise_id,
    nome: c.nome,
    vaga: c.vaga,
    nota,
    parecer: "APTO",
    compareceu: "S",
    ligacao: "codigo",
    origem: "planilha",
    notas: [],
    ...campos,
  });
  const nomes = (linhas) => linhas.map((l) => l.nome);
  const posicoes = (linhas) => linhas.map((l) => `${l.posicao} ${l.nome}`);
  const vagaDe = (r, chave) => r.vagas.find((v) => v.chave === chave);
  const avisosDe = (r, codigo) => r.avisos.filter((a) => a.codigo === codigo);

  const QUADRO_169681 = {
    id: "q1",
    ordem: 1,
    cargo: "Cirurgião Dentista",
    lotacao: "Área de abrangência DSEI Xingu",
    modalidades: { "Ampla Concorrência": 2, "Pretos e Pardos": 1, PcD: null },
    vagas_imediatas: 3,
    cadastro_reserva: true,
  };

  describe("edital 83/2026 — resultado final da vaga 169681 (Cirurgião Dentista)", () => {
    const kayanaku = candidato("Kayanaku Mehinako", {
      nota_documental: "14,6",
      modalidade: "Indígenas",
      pontuacao_etnica: 12,
      quadro: "q1",
    });
    const jucikely = candidato("Jucikely Miguel da Silva", {
      nota_documental: "13,0",
      quadro: "q1",
    });
    const vanderlei = candidato("Vanderlei Tadeu Bertanha", {
      nota_documental: "11,2",
      quadro: "q1",
    });
    const pedro = candidato("Pedro Alexandre Schmidt Passos", {
      nota_documental: "8,8",
      quadro: "q1",
    });
    const ercilio = candidato("Ercilio Faria Coronheiro", {
      nota_documental: "9,0",
      quadro: "q1",
    });
    // Aprovada na entrevista (12) e ausente da lista final publicada: aqui ela não some.
    const marquele = candidato("Marquele Sousa da Silva", {
      nota_documental: "11,3",
      quadro: "q1",
    });
    const candidatos = [
      jucikely,
      kayanaku,
      vanderlei,
      pedro,
      ercilio,
      marquele,
    ];
    const entrevistas = [
      entrevista(kayanaku, 20),
      entrevista(jucikely, 17.33),
      entrevista(vanderlei, 16.67),
      entrevista(pedro, 17.33),
      entrevista(ercilio, 10),
      entrevista(marquele, 12),
    ];
    const r = classificar({
      tipo: "FINAL",
      regra: REGRA_83,
      candidatos,
      entrevistas,
      quadro: [QUADRO_169681],
      unidade: "DSEI Xingu",
      dataCorte: "2026-07-20",
    });
    const vaga = vagaDe(r, "169681");

    it("nota final = documental + entrevista, com a casa decimal da publicação", () => {
      expect(vaga.geral.map((l) => [l.nome, l.nota])).toEqual([
        ["Kayanaku Mehinako", 34.6],
        ["Jucikely Miguel da Silva", 30.3],
        ["Vanderlei Tadeu Bertanha", 27.9],
        ["Pedro Alexandre Schmidt Passos", 26.1],
        ["Marquele Sousa da Silva", 23.3],
        ["Ercilio Faria Coronheiro", 19],
      ]);
    });

    it("ninguém aprovado some: a candidata ausente da publicação fica em 5º", () => {
      expect(posicoes(vaga.geral)).toContain("5 Marquele Sousa da Silva");
      expect(vaga.eliminados).toEqual([]);
    });

    it("a indígena aparece também na lista própria, recomeçando em 1º", () => {
      expect(posicoes(vaga.porModalidade.PI)).toEqual(["1 Kayanaku Mehinako"]);
      expect(vaga.porModalidade.PP).toEqual([]);
    });

    it("cabeçalho no padrão da publicação", () => {
      expect(vaga.cabecalho).toBe(
        "VAGA 169681 - Cirurgião Dentista - Área de abrangência DSEI Xingu - DSEI Xingu - 3 vagas (2 AC + 1 Pretos e Pardos + CR)",
      );
    });

    it("vagas: 2 AC aos primeiros; a de PP sem candidato vai para a ampla (remanejamento)", () => {
      expect(vaga.geral.map((l) => [l.nome, l.situacao, l.vagaPor])).toEqual([
        ["Kayanaku Mehinako", "VAGA", "AC"],
        ["Jucikely Miguel da Silva", "VAGA", "AC"],
        ["Vanderlei Tadeu Bertanha", "VAGA", "AC"],
        ["Pedro Alexandre Schmidt Passos", "CR", null],
        ["Marquele Sousa da Silva", "CR", null],
        ["Ercilio Faria Coronheiro", "CR", null],
      ]);
    });

    it("explicação da posição sem empate", () => {
      expect(r.explicacoes[jucikely.analise_id].explicacao[0]).toBe(
        "Nota 30,3 (documental 13,0 + entrevista 17,3).",
      );
    });
  });

  describe("edital 83/2026 — vaga 169682 (Enfermeiro): cotista nas duas listas (item 5.12)", () => {
    const q = {
      ...QUADRO_169681,
      id: "q2",
      cargo: "Enfermeiro",
      lotacao: "Polo Base Leonardo",
      modalidades: { "Ampla Concorrência": 3, "Pretos e Pardos": 1 },
      vagas_imediatas: 4,
    };
    const base = {
      vaga: "169682",
      cargo: "Enfermeiro - Polo Base Leonardo",
      quadro: "q2",
    };
    const mujugi = candidato("Mujugi Neymax Kalapalo Kuikuro", {
      ...base,
      nota_documental: 15.8,
      modalidade: "Indígenas",
      pontuacao_etnica: 12,
    });
    const ana = candidato("Ana Paula Fernandes Duarte", {
      ...base,
      nota_documental: 13,
    });
    const leticia = candidato("Letícia Rezende Pereira", {
      ...base,
      nota_documental: 13,
    });
    const marciano = candidato("Marciano Ribeiro Saraiva", {
      ...base,
      nota_documental: 13,
    });
    const claudiano = candidato("Claudiano da Conceição Lima", {
      ...base,
      nota_documental: 13,
      modalidade: "Pretos e pardos",
    });
    const r = classificar({
      tipo: "FINAL",
      regra: REGRA_83,
      candidatos: [mujugi, ana, leticia, marciano, claudiano],
      entrevistas: [
        entrevista(mujugi, 14.67),
        entrevista(ana, 17.33),
        entrevista(leticia, 16.67),
        entrevista(marciano, 14),
        entrevista(claudiano, 10),
      ],
      quadro: [q],
      dataCorte: "2026-07-20",
    });
    const vaga = vagaDe(r, "169682");

    it("o cotista de PP está na geral (5º) e na lista PP (1º) — a publicação o deixou só na PP", () => {
      expect(posicoes(vaga.geral)).toEqual([
        "1 Mujugi Neymax Kalapalo Kuikuro",
        "2 Ana Paula Fernandes Duarte",
        "3 Letícia Rezende Pereira",
        "4 Marciano Ribeiro Saraiva",
        "5 Claudiano da Conceição Lima",
      ]);
      expect(posicoes(vaga.porModalidade.PP)).toEqual([
        "1 Claudiano da Conceição Lima",
      ]);
    });

    it("a vaga reservada de PP é do cotista; o 4º da geral fica no cadastro reserva", () => {
      const situacao = Object.fromEntries(
        vaga.geral.map((l) => [l.nome, `${l.situacao}:${l.vagaPor}`]),
      );
      expect(situacao["Claudiano da Conceição Lima"]).toBe("VAGA:PP");
      expect(situacao["Marciano Ribeiro Saraiva"]).toBe("CR:null");
    });
  });

  describe("edital 83/2026 — preliminar documental com parciais idênticas (vaga 169682, nota 13)", () => {
    const base = { vaga: "169682", cargo: "Enfermeiro - Polo Base Leonardo" };
    const lista = [
      candidato("Mujugi Neymax Kalapalo Kuikuro", {
        ...base,
        nota_documental: "15,8",
        modalidade: "Indígenas",
        pontuacao_etnica: 12,
      }),
      ...[
        "Ana Paula Fernandes Duarte",
        "Andreia Medeiros",
        "Marciano Ribeiro Saraiva",
        "Letícia Rezende Pereira",
      ].map((n) => candidato(n, { ...base, nota_documental: "13" })),
      candidato("Claudiano da Conceição Lima", {
        ...base,
        nota_documental: "13",
        modalidade: "Pretos e pardos",
      }),
      candidato("Reprovada na nota mínima", {
        ...base,
        nota_documental: "6,9",
      }),
      candidato("Reprovado por requisito", {
        ...base,
        nota_documental: "10",
        status: "Reprovado",
      }),
    ];
    const r = classificar({
      tipo: "PRELIMINAR",
      regra: REGRA_83,
      candidatos: lista,
      dataCorte: "2026-07-20",
    });
    const vaga = vagaDe(r, "169682");

    it("a regra do 83 não desempata a preliminar: os cinco com 13 ficam na mesma posição", () => {
      expect(vaga.geral.map((l) => l.posicao)).toEqual([1, 2, 2, 2, 2, 2]);
      const explicacao =
        r.explicacoes[lista[1].analise_id].explicacao.join(" ");
      expect(explicacao).toContain("Empatado em 13,0 com 4.");
      expect(explicacao).toContain(
        "Nesta lista o empate fica na mesma posição.",
      );
    });

    it("nota mínima de nível superior (7) elimina; requisito não atendido elimina com o motivo", () => {
      expect(vaga.eliminados.map((e) => [e.nome, e.motivo])).toEqual([
        ["Reprovado por requisito", "NAO_HABILITADO"],
        ["Reprovada na nota mínima", "ABAIXO_NOTA_MINIMA_DOCUMENTAL"],
      ]);
      expect(vaga.eliminados[1].detalhe).toBe(
        "Nota 6,9; mínimo 7,0 (superior).",
      );
    });
  });

  describe("edital 100/2026 — preliminar com desempate (vaga 178529, nota 13,00)", () => {
    const base = {
      vaga: "178529",
      cargo: "Analista Técnico de Saúde Indígena - CASAI Brasília",
    };
    const primeiro = candidato("Primeira Colocada", {
      ...base,
      nota_documental: "15,00",
    });
    const eulalio = candidato("Eulálio Silva de Oliveira", {
      ...base,
      nota_documental: "13,00",
      modalidade: "Indígenas",
      pontuacao_etnica: 8,
    });
    const laudeci = candidato("Laudeci Cedraz de Oliveira", {
      ...base,
      nota_documental: "13,00",
    });
    const elida = candidato("Elida Calheira", {
      ...base,
      nota_documental: "13,00",
    });

    it("indígena comprovado antes (critério b), como na lista publicada; os outros dois ficam juntos", () => {
      const r = classificar({
        tipo: "PRELIMINAR",
        regra: REGRA_100,
        candidatos: [primeiro, laudeci, elida, eulalio],
        dataCorte: "2026-09-20",
      });
      expect(posicoes(vagaDe(r, "178529").geral)).toEqual([
        "1 Primeira Colocada",
        "2 Eulálio Silva de Oliveira",
        "3 Elida Calheira",
        "3 Laudeci Cedraz de Oliveira",
      ]);
      expect(r.explicacoes[eulalio.analise_id].explicacao.join(" ")).toContain(
        "à frente de Elida Calheira por indígena comprovado (sim × não)",
      );
      // Sem data de nascimento: o critério 60+ não decide e vira aviso.
      expect(avisosDe(r, "DADO_FALTANDO").length).toBeGreaterThan(0);
    });

    it("60 anos ou mais na data de corte vem ANTES de indígena (critério a) — o que o Apps Script não fazia", () => {
      const r = classificar({
        tipo: "PRELIMINAR",
        regra: REGRA_100,
        candidatos: [
          primeiro,
          { ...laudeci, data_nascimento: "1980-01-01" },
          { ...elida, data_nascimento: "1966-09-20" },
          { ...eulalio, data_nascimento: "1990-05-05" },
        ],
        dataCorte: "2026-09-20",
      });
      expect(nomes(vagaDe(r, "178529").geral)).toEqual([
        "Primeira Colocada",
        "Elida Calheira",
        "Eulálio Silva de Oliveira",
        "Laudeci Cedraz de Oliveira",
      ]);
      expect(r.explicacoes[elida.analise_id].explicacao.join(" ")).toContain(
        "por 60+ (sim × não)",
      );
    });

    it("vaga 178530: Iudemar (PI) antes de Thaylline (PP), ambos com 13,00", () => {
      const b = {
        vaga: "178530",
        cargo: "Apoiador Técnico em Saúde - CASAI Brasília",
      };
      const r = classificar({
        tipo: "PRELIMINAR",
        regra: REGRA_100,
        candidatos: [
          candidato("Thaylline Kellen da Silva Araújo", {
            ...b,
            nota_documental: 13,
            modalidade: "Pretos e pardos",
          }),
          candidato("Iudemar Ribeiro Beserra", {
            ...b,
            nota_documental: 13,
            modalidade: "Indígenas",
            pontuacao_etnica: 8,
          }),
        ],
        dataCorte: "2026-09-20",
      });
      const vaga = vagaDe(r, "178530");
      expect(posicoes(vaga.geral)).toEqual([
        "1 Iudemar Ribeiro Beserra",
        "2 Thaylline Kellen da Silva Araújo",
      ]);
      expect(posicoes(vaga.porModalidade.PP)).toEqual([
        "1 Thaylline Kellen da Silva Araújo",
      ]);
      expect(posicoes(vaga.porModalidade.PI)).toEqual([
        "1 Iudemar Ribeiro Beserra",
      ]);
    });
  });

  describe("números pt-BR: nota com vírgula não vira zero", () => {
    it("12,5 fica à frente de 9,8 e 1.234,5 é mil duzentos e trinta e quatro", () => {
      const r = classificar({
        tipo: "PRELIMINAR",
        regra: { documental: { situacoes_aptas: [] } },
        candidatos: [
          candidato("Nove e oito", { nota_documental: "9,8" }),
          candidato("Doze e meio", { nota_documental: "12,5" }),
          candidato("Milhar", { nota_documental: "1.234,5" }),
        ],
      });
      expect(vagaDe(r, "169681").geral.map((l) => [l.nome, l.nota])).toEqual([
        ["Milhar", 1234.5],
        ["Doze e meio", 12.5],
        ["Nove e oito", 9.8],
      ]);
    });

    it("texto que não é número vira aviso e o candidato sai por falta de nota (nunca 0 calado)", () => {
      const c = candidato("Nota ilegível", { nota_documental: "doze" });
      const r = classificar({ tipo: "PRELIMINAR", regra: {}, candidatos: [c] });
      expect(avisosDe(r, "NUMERO_INVALIDO")[0].texto).toContain('"doze"');
      expect(vagaDe(r, "169681").eliminados[0].motivo).toBe(
        "SEM_NOTA_DOCUMENTAL",
      );
    });
  });

  describe("entrevista ligada à análise SÓ pelo id (CO_ANALISE_CURRICULAR)", () => {
    const regra = { documental: { situacoes_aptas: [] } };
    const a = candidato("Maria da Silva", { nota_documental: 10 });
    const b = candidato("Maria da Silva", { nota_documental: 9 });

    it("homônimas na mesma vaga ficam cada uma com a sua entrevista", () => {
      const r = classificar({
        tipo: "FINAL",
        regra,
        candidatos: [a, b],
        entrevistas: [entrevista(a, 5), entrevista(b, 15)],
      });
      expect(
        vagaDe(r, "169681").geral.map((l) => [l.analiseId, l.nota]),
      ).toEqual([
        [b.analise_id, 24],
        [a.analise_id, 15],
      ]);
    });

    it("entrevista sem análise vira aviso (antes o candidato sumia sem aviso)", () => {
      const r = classificar({
        tipo: "FINAL",
        regra,
        candidatos: [a],
        entrevistas: [
          {
            ...entrevista(a, 18),
            analise_id: null,
            nome: "Fulano Sem Análise",
          },
        ],
      });
      expect(avisosDe(r, "ENTREVISTA_SEM_ANALISE")[0].texto).toContain(
        "Fulano Sem Análise",
      );
      expect(vagaDe(r, "169681").eliminados[0].motivo).toBe("SEM_ENTREVISTA");
    });

    it("ligação feita pelo nome na carga e entrevista repetida viram aviso", () => {
      const r = classificar({
        tipo: "FINAL",
        regra,
        candidatos: [a],
        entrevistas: [
          entrevista(a, 12, { ligacao: "nome" }),
          entrevista(a, 14, { origem: "sistema" }),
        ],
      });
      expect(avisosDe(r, "ENTREVISTA_PELO_NOME")).toHaveLength(1);
      expect(avisosDe(r, "ENTREVISTA_REPETIDA")).toHaveLength(1);
      expect(vagaDe(r, "169681").geral[0].nota).toBe(24);
    });

    it("convocação nova do sistema (sem parecer) não apaga o parecer e a nota da planilha", () => {
      // Antes a do sistema pesava mais que a de parecer: a nota 14 sumia da Classificação.
      const r = classificar({
        tipo: "FINAL",
        regra,
        candidatos: [a],
        entrevistas: [
          entrevista(a, 14),
          entrevista(a, null, {
            origem: "sistema",
            parecer: "SEM_PARECER",
            compareceu: null,
          }),
        ],
      });
      expect(avisosDe(r, "ENTREVISTA_REPETIDA")).toHaveLength(1);
      expect(vagaDe(r, "169681").geral[0].nota).toBe(24);
    });
  });

  describe("eliminação na entrevista, com motivo padronizado", () => {
    const notas = (valores) =>
      valores.map((nota, i) => ({ ordem: i + 1, criterio: `C${i + 1}`, nota }));
    const casos = [
      ["sem entrevista", null, "SEM_ENTREVISTA"],
      ["ausente", { compareceu: "N", nota: null }, "AUSENTE"],
      ["inapto", { parecer: "INAPTO", nota: 12 }, "INAPTO_ENTREVISTA"],
      ["sem nota", { nota: null }, "SEM_NOTA_ENTREVISTA"],
      ["abaixo de 10", { nota: 9.9 }, "ABAIXO_NOTA_MINIMA_ENTREVISTA"],
      [
        "competência abaixo de 2,5",
        { nota: 12, notas: notas([4, 4, 2.4, 1.6]) },
        "COMPETENCIA_ABAIXO_MINIMO",
      ],
    ];
    it.each(casos)("83: %s", (_, campos, motivo) => {
      const c = candidato("Candidata", { nota_documental: 10 });
      const r = classificar({
        tipo: "FINAL",
        regra: REGRA_83,
        candidatos: [c],
        entrevistas: campos ? [entrevista(c, campos.nota ?? null, campos)] : [],
        dataCorte: "2026-07-20",
      });
      expect(vagaDe(r, "169681").eliminados.map((e) => e.motivo)).toEqual([
        motivo,
      ]);
    });

    it("100: nota 1 numa competência elimina (9.12.1), mesmo com total acima de 8", () => {
      const c = candidato("Candidata", { nota_documental: 10, vaga: "178529" });
      const r = classificar({
        tipo: "FINAL",
        regra: REGRA_100,
        candidatos: [c],
        entrevistas: [entrevista(c, 13, { notas: notas([5, 5, 2, 1]) })],
        dataCorte: "2026-09-20",
      });
      const e = vagaDe(r, "178529").eliminados[0];
      expect(e.motivo).toBe("COMPETENCIA_ELIMINATORIA");
      expect(e.detalhe).toBe(
        "Habilidade interpessoal: 1,00 (elimina até 1,00).",
      );
    });

    it("sem as notas por competência: não elimina, mas avisa", () => {
      const c = candidato("Candidata", { nota_documental: 10 });
      const r = classificar({
        tipo: "FINAL",
        regra: REGRA_83,
        candidatos: [c],
        entrevistas: [entrevista(c, 15)],
        dataCorte: "2026-07-20",
      });
      expect(vagaDe(r, "169681").geral).toHaveLength(1);
      expect(avisosDe(r, "SEM_NOTAS_COMPETENCIA")).toHaveLength(1);
    });

    it("entrevistado que não passou na documental vira aviso", () => {
      const c = candidato("Sem habilitação", {
        nota_documental: 10,
        status: "Reprovado",
      });
      const r = classificar({
        tipo: "FINAL",
        regra: REGRA_83,
        candidatos: [c],
        entrevistas: [entrevista(c, 15)],
        dataCorte: "2026-07-20",
      });
      expect(avisosDe(r, "ENTREVISTADO_NAO_HABILITADO")).toHaveLength(1);
    });
  });

  describe("60 anos ou mais NA DATA DE CORTE (fim das inscrições)", () => {
    const regra = {
      documental: { situacoes_aptas: [] },
      listas: { PRELIMINAR: { empate: "CRITERIOS" } },
      desempate: [{ criterio: "IDOSO_60", direcao: "SIM_PRIMEIRO" }],
    };
    const fez60 = candidato("Fez 60 no último dia", {
      nota_documental: 10,
      data_nascimento: "1966-07-20",
    });
    const faz60depois = candidato("Faz 60 no dia seguinte", {
      nota_documental: 10,
      data_nascimento: "1966-07-21",
    });

    it("o aniversário no último dia de inscrição conta; o do dia seguinte, não", () => {
      const r = classificar({
        tipo: "PRELIMINAR",
        regra,
        candidatos: [faz60depois, fez60],
        dataCorte: "2026-07-20",
      });
      expect(posicoes(vagaDe(r, "169681").geral)).toEqual([
        "1 Fez 60 no último dia",
        "2 Faz 60 no dia seguinte",
      ]);
    });

    it("a data de corte da regra vale sobre a do cronograma", () => {
      const r = classificar({
        tipo: "PRELIMINAR",
        regra: { ...regra, data_corte: "2026-07-21" },
        candidatos: [fez60, faz60depois],
        dataCorte: "2026-07-20",
      });
      expect(vagaDe(r, "169681").geral.map((l) => l.posicao)).toEqual([1, 1]);
      expect(r.dataCorte).toBe("2026-07-21");
    });

    it("sem data de corte, avisa", () => {
      const r = classificar({ tipo: "PRELIMINAR", regra, candidatos: [fez60] });
      expect(avisosDe(r, "SEM_DATA_CORTE")).toHaveLength(1);
    });
  });

  describe("empate final: o gestor escolhe", () => {
    const empatados = () => [
      candidato("Bruna", { nota_documental: 10, codigo: "300" }),
      candidato("Ana", { nota_documental: 10, codigo: "20" }),
      candidato("Carla", { nota_documental: 9, codigo: "1" }),
    ];
    const regraCom = (metodo, numeracao = "DENSA") => ({
      documental: { situacoes_aptas: [] },
      listas: { PRELIMINAR: { empate: "CRITERIOS" } },
      desempate: [{ criterio: "INDIGENA_COMPROVADO", direcao: "SIM_PRIMEIRO" }],
      empate_final: { metodo, numeracao },
    });

    it("mesma posição: 1º, 1º, 2º (densa) ou 1º, 1º, 3º (saltando)", () => {
      const lista = empatados();
      const densa = classificar({
        tipo: "PRELIMINAR",
        regra: regraCom("MESMA_POSICAO"),
        candidatos: lista,
      });
      expect(posicoes(vagaDe(densa, "169681").geral)).toEqual([
        "1 Ana",
        "1 Bruna",
        "2 Carla",
      ]);
      const saltando = classificar({
        tipo: "PRELIMINAR",
        regra: regraCom("MESMA_POSICAO", "SALTANDO"),
        candidatos: lista,
      });
      expect(vagaDe(saltando, "169681").geral.map((l) => l.posicao)).toEqual([
        1, 1, 3,
      ]);
      expect(
        densa.explicacoes[lista[0].analise_id].explicacao.join(" "),
      ).toContain("Empate final: mesma posição.");
    });

    it("ordem de inscrição: o código numérico menor primeiro (20 antes de 300)", () => {
      const lista = empatados();
      const r = classificar({
        tipo: "PRELIMINAR",
        regra: regraCom("ORDEM_INSCRICAO"),
        candidatos: lista,
      });
      expect(posicoes(vagaDe(r, "169681").geral)).toEqual([
        "1 Ana",
        "2 Bruna",
        "3 Carla",
      ]);
      expect(r.explicacoes[lista[1].analise_id].explicacao.join(" ")).toContain(
        "ordem de inscrição (código 20)",
      );
    });

    it("sorteio sem registro: fica pendente, com aviso, e a lista não esconde o empate", () => {
      const lista = empatados();
      const r = classificar({
        tipo: "PRELIMINAR",
        regra: regraCom("SORTEIO"),
        candidatos: lista,
      });
      expect(r.pendencias).toHaveLength(1);
      expect(r.pendencias[0]).toMatchObject({
        metodo: "SORTEIO",
        tipoLista: "PRELIMINAR",
        vaga: "169681",
      });
      expect(r.pendencias[0].chave).toBe(
        chaveDoGrupo("PRELIMINAR", "169681", [
          lista[0].analise_id,
          lista[1].analise_id,
        ]),
      );
      expect(vagaDe(r, "169681").geral.map((l) => l.posicao)).toEqual([
        1, 1, 2,
      ]);
      expect(avisosDe(r, "EMPATE_PENDENTE")).toHaveLength(1);
    });

    it("sorteio registrado: vale a ordem da semente, e a explicação cita o sorteio", () => {
      const lista = empatados();
      const ids = [lista[0].analise_id, lista[1].analise_id];
      const chave = chaveDoGrupo("PRELIMINAR", "169681", ids);
      const ordem = ordemDoSorteio("semente-publica-123", ids);
      const r = classificar({
        tipo: "PRELIMINAR",
        regra: regraCom("SORTEIO"),
        candidatos: lista,
        desempates: [
          {
            id: "d1",
            tipo_lista: "PRELIMINAR",
            vaga: "169681",
            chave,
            metodo: "SORTEIO",
            semente: "semente-publica-123",
            ordem,
          },
        ],
      });
      const geral = vagaDe(r, "169681").geral;
      expect(geral.map((l) => l.analiseId).slice(0, 2)).toEqual(ordem);
      expect(geral.map((l) => l.posicao)).toEqual([1, 2, 3]);
      expect(r.pendencias).toEqual([]);
      expect(r.explicacoes[ordem[0]].explicacao.join(" ")).toContain(
        "resolvido por sorteio (semente semente-publ",
      );
    });

    it("decisão manual registrada: vale a ordem decidida, com a justificativa na explicação", () => {
      const lista = empatados();
      const ids = [lista[0].analise_id, lista[1].analise_id];
      const r = classificar({
        tipo: "PRELIMINAR",
        regra: regraCom("DECISAO_MANUAL"),
        candidatos: lista,
        desempates: [
          {
            id: "d2",
            tipo_lista: "PRELIMINAR",
            chave: chaveDoGrupo("PRELIMINAR", "169681", ids),
            metodo: "MANUAL",
            ordem: [ids[0], ids[1]],
            justificativa: "Decisão da comissão (ata 12).",
          },
        ],
      });
      expect(nomes(vagaDe(r, "169681").geral)).toEqual([
        "Bruna",
        "Ana",
        "Carla",
      ]);
      expect(r.explicacoes[ids[0]].explicacao.join(" ")).toContain(
        "decisão manual: Decisão da comissão (ata 12).",
      );
    });

    it("registro de um grupo que mudou não vale mais e avisa", () => {
      const lista = empatados();
      const r = classificar({
        tipo: "PRELIMINAR",
        regra: regraCom("SORTEIO"),
        candidatos: lista,
        desempates: [
          {
            id: "velho",
            tipo_lista: "PRELIMINAR",
            vaga: "169681",
            chave: "PRELIMINAR|169681|x,y",
            metodo: "SORTEIO",
            ordem: ["x", "y"],
          },
        ],
      });
      expect(avisosDe(r, "DESEMPATE_OBSOLETO")).toHaveLength(1);
      expect(r.pendencias).toHaveLength(1);
    });

    it("critérios decidem antes do empate final; a explicação diz quem e por quê", () => {
      const lista = [
        candidato("Indígena", { nota_documental: 52, pontuacao_etnica: 7 }),
        candidato("Não indígena", { nota_documental: 52 }),
        candidato("Outra", { nota_documental: 52 }),
      ];
      const r = classificar({
        tipo: "PRELIMINAR",
        regra: regraCom("MESMA_POSICAO"),
        candidatos: lista,
      });
      const texto = r.explicacoes[lista[0].analise_id].explicacao.join(" ");
      expect(texto).toContain("Empatado em 52,00 com 2.");
      expect(texto).toContain(
        "à frente de Não indígena por indígena comprovado (sim × não)",
      );
      expect(r.explicacoes[lista[1].analise_id].explicacao.join(" ")).toContain(
        "atrás de Indígena por indígena comprovado (não × sim)",
      );
    });
  });

  describe("convocação para entrevista", () => {
    const base = (n, nota, campos = {}) =>
      candidato(n, { nota_documental: nota, quadro: "qc", ...campos });
    const quadro = [
      {
        id: "qc",
        ordem: 1,
        cargo: "Cirurgião Dentista",
        lotacao: "",
        modalidades: { "Ampla Concorrência": 1 },
        vagas_imediatas: 1,
        cadastro_reserva: true,
      },
    ];
    const regra = {
      documental: { situacoes_aptas: [] },
      convocacao: {
        multiplo_vagas: 5,
        posicao_max_cr: 10,
        incluir_empatados: true,
      },
    };
    const lista = [
      base("A", 20),
      base("B", 19),
      base("C", 18),
      base("D", 17),
      base("E", 16),
      base("F", 16),
      base("G", 15),
    ];

    it("5 × 1 vaga = 5, com o empate do 5º incluído (6 convocados)", () => {
      const r = classificar({
        tipo: "CONVOCACAO",
        regra,
        candidatos: lista,
        quadro,
      });
      const vaga = vagaDe(r, "169681");
      expect(nomes(vaga.geral)).toEqual(["A", "B", "C", "D", "E", "F"]);
      expect(vaga.geral.every((l) => l.situacao === "CONVOCADO")).toBe(true);
      expect(vaga.eliminados).toEqual([
        {
          analiseId: lista[6].analise_id,
          nome: "G",
          motivo: "NAO_CONVOCADO",
          detalhe: "Limite: 5 × 1 vaga(s).",
        },
      ]);
    });

    it("sem incluir empatados, corta no limite e avisa", () => {
      const r = classificar({
        tipo: "CONVOCACAO",
        regra: {
          ...regra,
          convocacao: { ...regra.convocacao, incluir_empatados: false },
        },
        candidatos: lista,
        quadro,
      });
      expect(vagaDe(r, "169681").geral).toHaveLength(5);
      expect(avisosDe(r, "EMPATE_NO_LIMITE")).toHaveLength(1);
    });

    it("exceção por cargo (Enfermeiro 10×) e vaga só de cadastro reserva (até a k-ésima)", () => {
      const n = normalizarRegra(REGRA_83);
      expect(limiteDaConvocacao({ cargo: "Enfermeiro", total: 2 }, n)).toEqual({
        limite: 20,
        origem: "10 × 2 vaga(s) (exceção do cargo)",
      });
      expect(
        limiteDaConvocacao({ cargo: "Técnico de Enfermagem", total: 0 }, n)
          .limite,
      ).toBe(20);
      expect(
        limiteDaConvocacao({ cargo: "Cirurgião Dentista", total: 0 }, n),
      ).toEqual({ limite: 10, origem: "até a 10ª posição" });
      expect(
        limiteDaConvocacao(
          { cargo: "Cirurgião Dentista", total: 3 },
          normalizarRegra(REGRA_100),
        ).limite,
      ).toBe(18);
    });

    it("múltiplo fracionário: o erro do float não convoca um a mais e o texto não arredonda a regra", () => {
      const comMultiplo = (multiplo_vagas) => {
        const n = normalizarRegra(REGRA_100);
        return {
          ...n,
          convocacao: { ...n.convocacao, multiplo_vagas, excecoes: [] },
        };
      };
      // 2,2 × 25 = 55,000…01 no float: antes o limite subia para 56.
      expect(
        limiteDaConvocacao({ cargo: "Analista", total: 25 }, comMultiplo(2.2)),
      ).toEqual({ limite: 55, origem: "2,2 × 25 vaga(s)" });
      // 1,5 × 3 = 4,5 → 5; antes o texto dizia "2 × 3".
      expect(
        limiteDaConvocacao({ cargo: "Analista", total: 3 }, comMultiplo(1.5)),
      ).toEqual({ limite: 5, origem: "1,5 × 3 vaga(s)" });
      expect(
        limiteDaConvocacao({ cargo: "Analista", total: 25 }, comMultiplo(1.12))
          .limite,
      ).toBe(28);
      expect(
        limiteDaConvocacao({ cargo: "Analista", total: 4 }, comMultiplo(3)),
      ).toEqual({ limite: 12, origem: "3 × 4 vaga(s)" });
    });

    it("no resultado final, convocado sem entrevista lançada vira aviso", () => {
      const r = classificar({
        tipo: "FINAL",
        regra,
        candidatos: lista,
        quadro,
        entrevistas: [entrevista(lista[0], 10)],
      });
      expect(
        avisosDe(r, "CONVOCADO_SEM_ENTREVISTA").map((a) => a.analiseId),
      ).toEqual(lista.slice(1, 6).map((c) => c.analise_id));
    });
  });

  describe("modalidades, acúmulo e remanejamento", () => {
    it("cotista fora da geral quando a regra manda; posição da geral quando não recomeça", () => {
      const regra = {
        documental: { situacoes_aptas: [] },
        modalidades: [
          { codigo: "AC" },
          {
            codigo: "PP",
            nome: "Pretos e Pardos",
            lista_propria: true,
            recomeca_posicao: false,
          },
          {
            codigo: "PI",
            nome: "Indígenas",
            lista_propria: true,
            aparece_na_geral: false,
          },
        ],
      };
      const lista = [
        candidato("Ampla", { nota_documental: 20 }),
        candidato("Parda", {
          nota_documental: 15,
          modalidade: "Pretos e pardos",
        }),
        candidato("Indígena", { nota_documental: 18, modalidade: "Indígenas" }),
      ];
      const vaga = vagaDe(
        classificar({ tipo: "PRELIMINAR", regra, candidatos: lista }),
        "169681",
      );
      expect(nomes(vaga.geral)).toEqual(["Ampla", "Parda"]);
      expect(posicoes(vaga.porModalidade.PP)).toEqual(["2 Parda"]);
      expect(posicoes(vaga.porModalidade.PI)).toEqual(["1 Indígena"]);
    });

    it("acúmulo no 83: no final fica só na de maior percentual (PP 25% > PI 3%)", () => {
      const c = candidato("Duas cotas", {
        nota_documental: 10,
        modalidade: "Pretos e pardos / Indígenas",
      });
      const r = classificar({
        tipo: "FINAL",
        regra: REGRA_83,
        candidatos: [c],
        entrevistas: [entrevista(c, 15)],
        dataCorte: "2026-07-20",
      });
      const vaga = vagaDe(r, "169681");
      expect(nomes(vaga.porModalidade.PP)).toEqual(["Duas cotas"]);
      expect(vaga.porModalidade.PI).toEqual([]);
      // Na preliminar ela aparece nas duas.
      const p = classificar({
        tipo: "PRELIMINAR",
        regra: REGRA_83,
        candidatos: [c],
      });
      expect(nomes(vagaDe(p, "169681").porModalidade.PI)).toEqual([
        "Duas cotas",
      ]);
    });

    it("acúmulo no 100: PcD e mais uma", () => {
      const c = candidato("Três cotas", {
        nota_documental: 10,
        vaga: "178529",
        modalidade: "Pretos e pardos / Indígenas",
        pcd: "Sim",
      });
      const r = classificar({
        tipo: "FINAL",
        regra: REGRA_100,
        candidatos: [c],
        entrevistas: [entrevista(c, 15)],
        dataCorte: "2026-09-20",
      });
      const vaga = vagaDe(r, "178529");
      expect(
        Object.entries(vaga.porModalidade)
          .filter(([, l]) => l.length)
          .map(([m]) => m)
          .sort(),
      ).toEqual(["PCD", "PP"]);
    });

    it("100: a vaga de PcD sem candidato vai para indígena (4.1.1)", () => {
      const q = {
        id: "qp",
        ordem: 1,
        cargo: "Analista",
        lotacao: "CASAI Brasília",
        modalidades: { "Ampla Concorrência": 1, PcD: 1 },
        vagas_imediatas: 2,
        cadastro_reserva: true,
      };
      const b = { vaga: "178529", quadro: "qp" };
      const lista = [
        candidato("Ampla 1", { ...b, nota_documental: 20 }),
        candidato("Ampla 2", { ...b, nota_documental: 19 }),
        candidato("Indígena", {
          ...b,
          nota_documental: 10,
          modalidade: "Indígenas",
          pontuacao_etnica: 8,
        }),
      ];
      const r = classificar({
        tipo: "FINAL",
        regra: REGRA_100,
        candidatos: lista,
        quadro: [q],
        entrevistas: lista.map((c) => entrevista(c, 10)),
        dataCorte: "2026-09-20",
      });
      expect(
        vagaDe(r, "178529").geral.map(
          (l) => `${l.nome}:${l.situacao}:${l.vagaPor}`,
        ),
      ).toEqual(["Ampla 1:VAGA:AC", "Ampla 2:CR:null", "Indígena:VAGA:PI"]);
    });
  });

  describe("composição da nota, vagas e avisos de dados", () => {
    it("pesos e arredondamento da regra (2 × documental + entrevista, truncar em 1 casa)", () => {
      const c = candidato("Pesada", { nota_documental: "10,07" });
      const r = classificar({
        tipo: "FINAL",
        regra: {
          documental: { situacoes_aptas: [] },
          composicao: {
            componentes: [
              { codigo: "DOCUMENTAL", peso: 2 },
              { codigo: "ENTREVISTA", peso: 1 },
            ],
            casas: 1,
            arredondamento: "TRUNCAR",
          },
        },
        candidatos: [c],
        entrevistas: [entrevista(c, 5.09)],
      });
      expect(vagaDe(r, "169681").geral[0].nota).toBe(25.2);
      expect(r.explicacoes[c.analise_id].explicacao[0]).toBe(
        "Nota 25,2 (documental 10,1 × 2,00 + entrevista 5,1).",
      );
    });

    it("componente que falta (ART) não soma e avisa", () => {
      const c = candidato("Sem ART", { nota_documental: 10 });
      const r = classificar({
        tipo: "FINAL",
        regra: {
          documental: { situacoes_aptas: [] },
          composicao: {
            componentes: [
              { codigo: "DOCUMENTAL", peso: 1 },
              { codigo: "ART", peso: 1 },
            ],
          },
          etapas: { entrevista: false },
        },
        candidatos: [c],
      });
      expect(vagaDe(r, "169681").geral[0].nota).toBe(10);
      expect(avisosDe(r, "COMPONENTE_FALTANDO")).toHaveLength(1);
    });

    it("linha do quadro sem candidato aparece vazia; vaga sem quadro avisa", () => {
      const r = classificar({
        tipo: "PRELIMINAR",
        regra: {},
        candidatos: [
          candidato("Sozinha", { nota_documental: 10, vaga: "999" }),
        ],
        quadro: [
          {
            id: "qv",
            ordem: 1,
            cargo: "Nutricionista",
            lotacao: "Polo X",
            modalidades: {},
            vagas_imediatas: 0,
            cadastro_reserva: true,
          },
        ],
      });
      expect(r.vagas.map((v) => v.cabecalho)).toEqual([
        "VAGA 999 - Cirurgião Dentista - Área de abrangência DSEI Xingu",
        "VAGA - Nutricionista - Polo X - Cadastro Reserva",
      ]);
      expect(r.vagas[1].geral).toEqual([]);
      expect(avisosDe(r, "VAGA_SEM_QUADRO")).toHaveLength(1);
    });

    it("nível da vaga desconhecido com mínimo por nível: avisa e não elimina", () => {
      const r = classificar({
        tipo: "PRELIMINAR",
        regra: {
          documental: {
            situacoes_aptas: [],
            nota_minima_por_nivel: { superior: 7 },
          },
        },
        candidatos: [candidato("Sem nível", { nota_documental: 3 })],
      });
      expect(vagaDe(r, "169681").geral).toHaveLength(1);
      expect(avisosDe(r, "NIVEL_DESCONHECIDO")).toHaveLength(1);
    });

    it("totais batem com as listas", () => {
      const lista = [
        candidato("A", { nota_documental: 10 }),
        candidato("B", { nota_documental: 5, status: "Reprovado" }),
      ];
      const r = classificar({
        tipo: "PRELIMINAR",
        regra: { documental: { situacoes_aptas: ["Aprovado"] } },
        candidatos: lista,
      });
      expect(r.totais).toMatchObject({
        candidatos: 2,
        elegiveis: 1,
        eliminados: 1,
        vagas: 1,
        pendencias: 0,
      });
    });
  });

  describe("quem ainda não foi analisado aguarda a análise (114/2026: fichas pendentes)", () => {
    const candidatos = [
      candidato("Apta", { nota_documental: 30 }),
      candidato("Reprovada", { nota_documental: 5, status: "Reprovado" }),
      candidato("Pendente sem ficha", { status: "Pendente", etapa: null }),
      candidato("Ficha em análise", { status: "Em análise" }),
      candidato("Ficha em revisão", { status: "Revisar", nota_documental: 20 }),
      candidato("Etapa apta prevalece", {
        status: "Pendente",
        etapa: "Triado",
        nota_documental: 25,
      }),
    ];
    const r = classificar({
      tipo: "PRELIMINAR",
      regra: REGRA_83,
      candidatos,
      quadro: [QUADRO_169681],
      unidade: "DSEI Xingu",
      dataCorte: "2026-07-20",
    });
    const vaga = vagaDe(r, "169681");

    it("não entra nos eliminados nem nas listas", () => {
      expect(nomes(vaga.geral)).toEqual(["Apta", "Etapa apta prevalece"]);
      expect(vaga.eliminados.map((e) => e.nome)).toEqual(["Reprovada"]);
      expect(vaga.aguardando).toEqual([
        expect.objectContaining({
          nome: "Ficha em análise",
          situacao: "Em análise",
        }),
        expect.objectContaining({
          nome: "Ficha em revisão",
          situacao: "Revisar",
        }),
        expect.objectContaining({
          nome: "Pendente sem ficha",
          situacao: "Pendente",
        }),
      ]);
    });

    it("conta à parte, avisa uma vez e explica na gaveta", () => {
      expect(r.totais).toMatchObject({
        candidatos: 6,
        elegiveis: 2,
        eliminados: 1,
        aguardando: 3,
      });
      expect(avisosDe(r, "AGUARDANDO_ANALISE")).toHaveLength(1);
      expect(avisosDe(r, "AGUARDANDO_ANALISE")[0].texto).toContain(
        "3 candidato(s) aguardando a análise documental",
      );
      const id = candidatos[2].analise_id;
      expect(r.explicacoes[id]).toMatchObject({
        elegivel: false,
        aguardando: true,
      });
      expect(r.explicacoes[id].explicacao[0]).toBe(
        "Aguardando a análise documental (situação: Pendente).",
      );
    });

    it("todos pendentes: ninguém eliminado (antes, 1.512 'eliminados' no 114)", () => {
      const so = classificar({
        tipo: "PRELIMINAR",
        regra: REGRA_83,
        candidatos: [
          candidato("P1", { status: "Pendente" }),
          candidato("P2", { status: "Pendente" }),
        ],
        quadro: [QUADRO_169681],
        unidade: "DSEI Xingu",
      });
      expect(so.totais).toMatchObject({
        elegiveis: 0,
        eliminados: 0,
        aguardando: 2,
      });
    });
  });
});

bloco("lib/classificacao-preparo-do-desempate", () => {
  /*
  A releitura do relatório de desempate enquanto o Python o prepara
  (Classificação › Listas): espera crescente, só com a aba à frente e até o
  prazo; passado o prazo, a tela mostra o erro com "Tentar de novo".
*/

  const PREPARANDO = {
    preparo: { situacao: "PREPARANDO", pedidoEm: "" },
    desempate: null,
  };
  const PRONTO = { preparo: null, desempate: { grupos: [] } };

  function montar({ respostas = () => PREPARANDO } = {}) {
    vi.useFakeTimers();
    const documento = Object.assign(new EventTarget(), {
      visibilityState: "visible",
    });
    const ler = vi.fn(async () => respostas(ler.mock.calls.length));
    const aoLer = vi.fn();
    const aoEsgotar = vi.fn();
    const parar = acompanharPreparoDoDesempate({
      ler,
      aoLer,
      aoEsgotar,
      documento,
      espera: () => 60_000,
    });
    return { documento, ler, aoLer, aoEsgotar, parar };
  }

  afterEach(() => vi.useRealTimers());

  describe("acompanharPreparoDoDesempate", () => {
    it("relê enquanto prepara e para quando fica pronto", async () => {
      const { ler, aoLer, aoEsgotar } = montar({
        respostas: (n) => (n < 3 ? PREPARANDO : PRONTO),
      });
      await vi.advanceTimersByTimeAsync(0);
      expect(ler).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(60_000 * 5);
      expect(ler).toHaveBeenCalledTimes(3);
      expect(aoLer).toHaveBeenLastCalledWith(PRONTO);
      expect(aoEsgotar).not.toHaveBeenCalled();
    });

    it("passado o prazo, para de reler e avisa", async () => {
      const { ler, aoEsgotar } = montar();
      await vi.advanceTimersByTimeAsync(ESPERA_DO_RELATORIO_MS);
      expect(aoEsgotar).toHaveBeenCalledTimes(1);
      const lidas = ler.mock.calls.length;
      expect(lidas).toBe(ESPERA_DO_RELATORIO_MS / 60_000 + 1);
      await vi.advanceTimersByTimeAsync(ESPERA_DO_RELATORIO_MS * 4);
      expect(ler).toHaveBeenCalledTimes(lidas);
    });

    it("com a aba no fundo, espera a volta para reler", async () => {
      const { documento, ler } = montar();
      await vi.advanceTimersByTimeAsync(0);
      documento.visibilityState = "hidden";
      await vi.advanceTimersByTimeAsync(60_000 * 10);
      // A releitura marcada para o fundo não sai.
      expect(ler).toHaveBeenCalledTimes(1);
      documento.visibilityState = "visible";
      documento.dispatchEvent(new Event("visibilitychange"));
      await vi.advanceTimersByTimeAsync(0);
      expect(ler).toHaveBeenCalledTimes(2);
    });

    it("parar (desmontar) solta o temporizador e a escuta da aba", async () => {
      const { documento, ler, parar } = montar();
      await vi.advanceTimersByTimeAsync(0);
      parar();
      documento.dispatchEvent(new Event("visibilitychange"));
      await vi.advanceTimersByTimeAsync(60_000 * 10);
      expect(ler).toHaveBeenCalledTimes(1);
    });

    it("leitura que estoura não vira rejeição solta e conta como sem resposta", async () => {
      vi.useFakeTimers();
      const aoLer = vi.fn();
      acompanharPreparoDoDesempate({
        ler: () => Promise.reject(new Error("sem rede")),
        aoLer,
        aoEsgotar: vi.fn(),
        documento: null,
      });
      await vi.advanceTimersByTimeAsync(0);
      expect(aoLer).toHaveBeenCalledWith(null);
    });
  });
});

bloco("lib/classificacao-recorte-das-listas", () => {
  /*
  O recorte das listas da Classificação (dados.ts): busca pelo nome ou pelo
  código, situação, o recorte guardado na sessão e quantas pessoas ele mostra.
*/

  const linha = (analiseId, nome, situacao) => ({
    analiseId,
    nome,
    nota: 10,
    posicao: 1,
    empatados: 1,
    modalidades: ["AC"],
    situacao,
    vagaPor: null,
  });
  const vaga = (chave, campos) => ({
    chave,
    codigo: chave,
    cargo: "",
    lotacao: "",
    cabecalho: chave,
    total: 1,
    vagasPorModalidade: null,
    cadastroReserva: false,
    origemDasVagas: null,
    limiteConvocacao: null,
    geral: [],
    porModalidade: {},
    eliminados: [],
    aguardando: [],
    ...campos,
  });
  const RESULTADO = {
    vagas: [
      vaga("v1", {
        geral: [
          linha("a1", "Ana Lima", "VAGA"),
          linha("a2", "Bia Souza", "CR"),
        ],
        eliminados: [
          { analiseId: "a3", nome: "Caio Reis", motivo: "NOTA", detalhe: "" },
        ],
      }),
      vaga("v2", {
        geral: [linha("a4", "Davi Melo", "CR")],
        aguardando: [
          { analiseId: "a5", nome: "Eva Dias", situacao: "Pendente" },
        ],
      }),
    ],
  };
  const CODIGOS = new Map([
    ["a1", "7001"],
    ["a4", "7004"],
  ]);
  const nomes = (vagas) =>
    vagas.flatMap((v) => [
      ...v.linhas.map((l) => l.nome),
      ...v.eliminadosFiltrados.map((e) => e.nome),
      ...v.aguardandoFiltrados.map((a) => a.nome),
    ]);

  describe("recorte das listas da Classificação", () => {
    it("sem filtro, tudo; a busca acha pelo nome (sem acento) ou pelo código", () => {
      expect(nomes(recortarResultado(RESULTADO))).toHaveLength(5);
      const pelaBusca = (busca) =>
        nomes(
          recortarResultado(RESULTADO, { ...RECORTE_VAZIO, busca }, CODIGOS),
        );
      expect(pelaBusca("7004")).toEqual(["Davi Melo"]);
      expect(pelaBusca("SOUZA")).toEqual(["Bia Souza"]);
      // Sem o mapa de códigos, o código não acha ninguém.
      expect(
        nomes(
          recortarResultado(RESULTADO, { ...RECORTE_VAZIO, busca: "7004" }),
        ),
      ).toEqual([]);
    });

    it("a situação recorta as linhas, os eliminados ou quem aguarda; vaga vazia sai", () => {
      const pela = (situacao) =>
        recortarResultado(RESULTADO, { ...RECORTE_VAZIO, situacao }, CODIGOS);
      expect(nomes(pela("CR"))).toEqual(["Bia Souza", "Davi Melo"]);
      expect(nomes(pela("LISTA"))).toEqual([
        "Ana Lima",
        "Bia Souza",
        "Davi Melo",
      ]);
      expect(pela("ELIMINADOS").map((v) => v.chave)).toEqual(["v1"]);
      expect(nomes(pela("ELIMINADOS"))).toEqual(["Caio Reis"]);
      expect(nomes(pela("AGUARDANDO"))).toEqual(["Eva Dias"]);
      expect(pessoasDoRecorte(pela(""))).toBe(5);
      expect(pessoasDoRecorte(pela("CR"))).toBe(2);
    });

    it("conta a situação entre os filtros; o guardado volta no formato de agora", () => {
      expect(filtrosAtivosDoRecorte(RECORTE_VAZIO)).toBe(0);
      expect(
        filtrosAtivosDoRecorte({ ...RECORTE_VAZIO, situacao: "ELIMINADOS" }),
      ).toBe(1);
      expect(normalizarRecorte({ situacao: "QUALQUER", lista: "" })).toEqual(
        RECORTE_VAZIO,
      );
      expect(
        normalizarRecorte({
          vaga: "v1",
          lista: "PP",
          busca: "ana",
          situacao: "CR",
        }),
      ).toEqual({ vaga: "v1", lista: "PP", busca: "ana", situacao: "CR" });
      expect(chaveDoRecorte("e83")).toBe("monitora:classificacao:recorte:e83");
      expect(chaveDoRecorte("")).toBe("");
    });
  });
});

bloco("lib/classificacao-regra-e-numeros", () => {
  const SEED = readFileSync(
    "tests/fixtures/sql-de-dados/20261002-regras-de-classificacao-83-e-100.sql",
    "utf8",
  );
  const regraDoSeed = (marca) => {
    const inicio = SEED.indexOf(`$${marca}$`) + marca.length + 2;
    return JSON.parse(SEED.slice(inicio, SEED.indexOf(`$${marca}$`, inicio)));
  };

  describe("numeroBR", () => {
    it.each([
      ["12,5", 12.5],
      ["12.5", 12.5],
      ["1.234,5", 1234.5],
      ["1,234.5", 1234.5],
      ["1.234.567", 1234567],
      [" 13 ", 13],
      ["-2,5", -2.5],
      [7, 7],
      ["0", 0],
      ["", null],
      [null, null],
      [undefined, null],
      ["abc", null],
      ["1,2,3", null],
      ["12,5 pontos", null],
      [Number.NaN, null],
    ])("%j → %j", (entrada, saida) => {
      expect(numeroBR(entrada)).toBe(saida);
    });
  });

  describe("arredondamento e formato", () => {
    it("meio para cima sem erro de ponto flutuante (1,005 → 1,01; 30,25 → 30,3)", () => {
      expect(arredondar(1.005, 2)).toBe(1.01);
      expect(arredondar(30.25, 1)).toBe(30.3);
      expect(arredondar(13 + 17.33, 1)).toBe(30.3);
      expect(arredondar(2.675, 2, "TRUNCAR")).toBe(2.67);
      expect(arredondar(2.675, 2, "NENHUM")).toBe(2.675);
      expect(arredondar(null, 2)).toBeNull();
    });

    it("comparação na escala das casas", () => {
      expect(escalar(52.004, 2)).toBe(escalar(52, 2));
      expect(escalar(52.006, 2)).toBeGreaterThan(escalar(52, 2));
    });

    it("formato pt-BR com casas fixas", () => {
      expect(formatarNota(52, 2)).toBe("52,00");
      expect(formatarNota(1234.5, 1)).toBe("1234,5");
      expect(formatarNota(null)).toBe("—");
      expect(dataBR("2026-07-20")).toBe("20/07/2026");
    });

    it("idade na data de corte", () => {
      expect(idadeNaData("1966-07-20", "2026-07-20")).toBe(60);
      expect(idadeNaData("1966-07-21", "2026-07-20")).toBe(59);
      expect(idadeNaData("20/07/1966", "2026-07-20")).toBe(60);
      expect(idadeNaData("1966-02-30", "2026-07-20")).toBeNull();
      expect(idadeNaData("", "2026-07-20")).toBeNull();
    });
  });

  describe("modalidades do candidato", () => {
    it.each([
      ["Ampla concorrência", ["AC"]],
      ["Pretos e pardos", ["PP"]],
      ["Ampla Concorrência / Indígenas", ["AC", "PI"]],
      ["Quilombola", ["PQ"]],
      ["Pessoa com deficiência (PcD)", ["PCD"]],
      ["", []],
    ])("%s", (texto, codigos) => {
      expect(codigosDaModalidade(texto)).toEqual(codigos);
    });

    it("PcD sim ou não", () => {
      expect(["Sim", "S", "true", "1", "PcD"].map(simOuNao)).toEqual([
        true,
        true,
        true,
        true,
        true,
      ]);
      expect(["Não", "N", "", null, "false"].map(simOuNao)).toEqual([
        false,
        false,
        false,
        false,
        false,
      ]);
    });
  });

  describe("regra: nada de regra fixa", () => {
    it("a regra vazia é neutra: sem desempate, sem mínimo, empate na mesma posição", () => {
      const r = normalizarRegra({});
      expect(r.desempate).toEqual([]);
      expect(r.documental.nota_minima).toBeNull();
      expect(r.entrevista.nota_minima).toBeNull();
      expect(r.empate_final.metodo).toBe("MESMA_POSICAO");
      expect(r.modalidades.map((m) => m.codigo)).toEqual(["AC"]);
      expect(normalizarRegra(REGRA_VAZIA)).toEqual(r);
    });

    it("normalizar é idempotente e a ampla entra sempre", () => {
      const r = normalizarRegra({
        modalidades: [{ codigo: "pp", remanejar_para: "AC, pp" }],
      });
      expect(r.modalidades.map((m) => m.codigo)).toEqual(["AC", "PP"]);
      expect(r.modalidades[1].remanejar_para).toEqual(["AC"]);
      expect(normalizarRegra(r)).toEqual(r);
    });

    it("as regras de exemplo do 83 e do 100 são válidas e já vêm normalizadas", () => {
      // O seed já aplicado é anterior às parciais e à lista da entrevista: os
      // campos novos entram neutros (nada muda no que o seed gravou).
      for (const marca of ["regra83", "regra100"]) {
        const regra = regraDoSeed(marca);
        expect(validarRegra(regra), marca).toEqual([]);
        const normal = normalizarRegra(regra);
        expect(normal, marca).toMatchObject(regra);
        expect(normal.documental.parciais).toEqual([]);
        expect(normal.listas.ENTREVISTA).toEqual({ empate: "MESMA_POSICAO" });
      }
    });

    it.each([
      [{ desempate: [{ criterio: "INVENTADO" }] }, "desempate"],
      [
        { desempate: [{ criterio: "IDOSO_60" }, { criterio: "IDOSO_60" }] },
        "desempate",
      ],
      [{ etapas: { documental: false, entrevista: false } }, "etapas"],
      [
        { composicao: { componentes: [{ codigo: "DOCUMENTAL", peso: 500 }] } },
        "composicao.componentes",
      ],
      [{ etapas: { entrevista: false } }, "composicao.componentes"],
      [
        {
          modalidades: [
            { codigo: "AC" },
            { codigo: "PP", remanejar_para: ["PI"] },
          ],
        },
        "modalidades",
      ],
      [{ modalidades: [{ codigo: "PP", percentual: 120 }] }, "modalidades"],
      [{ convocacao: { multiplo_vagas: 1000 } }, "convocacao.multiplo_vagas"],
      [{ data_corte: "31/02/2026" }, "data_corte"],
      [{ rodape: "x".repeat(1001) }, "rodape"],
      [
        { entrevista: { competencias: [{ ordem: 1 }, { ordem: 1 }] } },
        "entrevista.competencias",
      ],
    ])("%j é recusada em %s", (regra, campo) => {
      expect(validarRegra(regra).map((e) => e.campo)).toContain(campo);
    });

    it("todo critério do catálogo tem leitura e dado faltante descritos", () => {
      for (const c of CATALOGO_DE_CRITERIOS) {
        expect(typeof c.ler, c.codigo).toBe("function");
        expect(c.falta({}, {}), c.codigo).toBeTruthy();
      }
    });
  });

  describe("nível e vagas", () => {
    const regra = regraDoSeed("regra83");
    it("o cargo COMEÇA com o termo: Técnico de Enfermagem é técnico; Analista Técnico não", () => {
      expect(
        nivelDaVaga({ cargo: "Técnico de Enfermagem - CASAI Sinop" }, regra),
      ).toBe("tecnico");
      expect(
        nivelDaVaga({ cargo: "Analista Técnico de Saúde Indígena" }, regra),
      ).toBe("superior");
      expect(
        nivelDaVaga({ cargo: "Agente de Combate a Endemias" }, regra),
      ).toBe("fundamental");
      expect(
        nivelDaVaga({ cargo: "Qualquer", categoria: "Nível Médio" }, {}),
      ).toBe("medio");
      expect(nivelDaVaga({ cargo: "Qualquer" }, {})).toBeNull();
    });

    it("reserva pelos percentuais só com o mínimo de vagas; PcD arredonda para cima", () => {
      expect(vagasPelosPercentuais(1, regra)).toEqual({ AC: 1 });
      expect(vagasPelosPercentuais(4, regra)).toEqual({ AC: 2, PCD: 1, PP: 1 });
      expect(
        textoDasVagas(
          { total: 3, porModalidade: { AC: 2, PP: 1 }, cadastroReserva: true },
          regra,
        ),
      ).toBe("3 vagas (2 AC + 1 Pretos e Pardos + CR)");
      expect(textoDasVagas({ total: 0, porModalidade: {} }, regra)).toBe(
        "Cadastro Reserva",
      );
    });
  });

  describe("limites de conversão numérica", () => {
    it("não introduz Infinity ao converter bigint grande", () => {
      expect(numeroBR(7n)).toBe(7);
      expect(numeroBR(10n ** 400n)).toBeNull();
      expect(numeroBR(-(10n ** 400n))).toBeNull();
    });
  });

  describe("sorteio reprodutível", () => {
    it("sha256 igual ao do Node (e ao sha256() do PostgreSQL)", () => {
      for (const texto of [
        "",
        "abc",
        "semente:00000000-0000-4000-8000-000000000001",
        "çãé",
        "x".repeat(200),
      ])
        expect(sha256Hex(texto)).toBe(
          createHash("sha256").update(texto, "utf8").digest("hex"),
        );
    });

    it("mesma semente, mesma ordem; outra semente, outra ordem possível", () => {
      const ids = ["b", "a", "c", "d"];
      const ordem = ordemDoSorteio("2026-10-02", ids);
      expect(ordemDoSorteio("2026-10-02", [...ids].reverse())).toEqual(ordem);
      expect([...ordem].sort()).toEqual(["a", "b", "c", "d"]);
      expect(conferirSorteio("2026-10-02", ordem)).toBe(true);
      expect(
        conferirSorteio("outra", ordem) &&
          conferirSorteio("2026-10-02", [...ordem].reverse()),
      ).toBe(false);
    });

    it("a ordem é a do hash crescente, como no banco", () => {
      const ids = ["x1", "x2", "x3"];
      const esperado = [...ids].sort((a, b) =>
        sha256Hex(`s:${a}`) < sha256Hex(`s:${b}`) ? -1 : 1,
      );
      expect(ordemDoSorteio("s", ids)).toEqual(esperado);
    });

    it("chave do grupo independe da ordem dos ids", () => {
      expect(chaveDoGrupo("FINAL", "169681", ["b", "a"])).toBe(
        "FINAL|169681|a,b",
      );
      expect(sementeValida("abc")).toBe(false);
      expect(sementeValida("abcd")).toBe(true);
    });
  });
});

bloco("lib/classificacao-relatorio-de-desempate", () => {
  /*
  A leitura do relatório de desempate na tela (src/lib/classificacao/
  relatorio-de-desempate.ts). O relatório dourado é o que o Python gera hoje
  (python/monitora/classificacao/desempate.py) para o edital fictício dos casos
  dourados — o pytest (tests/python/test_classificacao_desempate.py) confere
  que o arquivo continua igual ao que o Python gera; aqui, que a tela o lê.
  O da versão 1 (relatorio-de-desempate-v1.json) é o que o Python gravava antes
  do cabeçalho e da idade em anos: a tela continua lendo e exportando.
*/
  const ler = (arquivo) =>
    JSON.parse(readFileSync(`tests/fixtures/classificacao/${arquivo}`, "utf8"));
  const DOURADO = ler("relatorio-de-desempate.json");
  const DOURADO_V1 = ler("relatorio-de-desempate-v1.json");

  /* O conteúdo do zip (sem compressão) como texto. */
  const textoDoZip = (bytes) => new TextDecoder().decode(bytes);

  describe("relatório de desempate na tela", () => {
    it("lê a resposta de obter_desempate_da_lista gerada pelo Python", () => {
      const d = lerDesempateDaLista(DOURADO);
      expect(d).not.toBeNull();
      expect(d.listaId).toBe("lista-ficticia-final");
      expect(d.relatorio.versao).toBe(VERSAO_DO_RELATORIO);
      expect(d.relatorio.vagas.length).toBeGreaterThan(0);
      expect(d.grupos).toBe(
        d.relatorio.vagas.reduce((s, v) => s + v.grupos.length, 0),
      );
      expect(d.texto).toContain("RELATÓRIO DE DESEMPATE");
    });

    it("sem relatório, versão desconhecida ou resposta malformada: null (o botão não aparece)", () => {
      expect(lerDesempateDaLista(null)).toBeNull();
      expect(
        lerDesempateDaLista({
          ...DOURADO,
          relatorio: { ...DOURADO.relatorio, versao: 99 },
        }),
      ).toBeNull();
      const quebrado = structuredClone(DOURADO);
      quebrado.relatorio.vagas[0].grupos[0].candidatos[0] = { codigo: "x" };
      expect(lerDesempateDaLista(quebrado)).toBeNull();
      expect(lerDesempateDaLista({ ...DOURADO, lista_id: 5 })).toBeNull();
    });

    it("monta as planilhas Resumo, Grupos, Pares e Candidatos, com filtro nas três últimas", () => {
      const d = lerDesempateDaLista(DOURADO);
      const primeiro = d.relatorio.vagas[0].grupos[0].candidatos[0];
      expect(primeiro.nome).toBeTruthy();
      const planilhas = planilhasDoDesempate(d);
      expect(planilhas.map((p) => p.nome)).toEqual([
        "Resumo",
        "Grupos",
        "Pares",
        "Candidatos",
      ]);
      expect(planilhas.map((p) => p.filtro === true)).toEqual([
        false,
        true,
        true,
        true,
      ]);
      const [resumo, grupos, pares, candidatos] = planilhas;
      expect(resumo.linhas).toContainEqual(["Edital", "nº 999/2026"]);
      expect(resumo.linhas).toContainEqual(["Gerada por", "Maria Silva"]);
      expect(resumo.linhas).toContainEqual(["Grupos de empate", 16]);
      expect(resumo.linhas).toContainEqual(["60+", 3, 3]);
      expect(resumo.linhas).toContainEqual(["sorteio registrado", 1, 2]);
      expect(grupos.linhas.length).toBe(1 + 16);
      expect(grupos.linhas.map((l) => l[2])).toContain(
        "Lista de cota: Pretos, pardos, indígenas e quilombolas (PPIQ)",
      );
      expect(candidatos.linhas[0]).toContain("Decidido por");
      expect(candidatos.linhas[0]).toContain("60+");
      expect(candidatos.linhas[0]).toContain("Idade na data de corte");
      expect(candidatos.linhas.flat()).toContain(primeiro.nome);
      expect(candidatos.linhas.flat()).toContain(primeiro.codigo);
      expect(candidatos.linhas.flat()).toContain(primeiro.idade);
      expect(pares.linhas.flat()).toContain(
        `${primeiro.nome} (insc. ${primeiro.codigo})`,
      );
      expect(d.texto).toContain(`${primeiro.nome} (insc. ${primeiro.codigo})`);
      const porIdade = pares.linhas.find((l) =>
        String(l[6]).includes("hora da certidão"),
      );
      expect(porIdade?.[5]).toBe("idade");
      expect(porIdade?.[6]).toBe(
        "34 anos, 1º mais velho do grupo × 34 anos, 2º mais velho do grupo, sem certidão (mesma data; hora da certidão)",
      );
      expect(
        pares.linhas.some((l) => String(l[7]).includes("sorteio registrado")),
      ).toBe(true);
      expect(pares.linhas.some((l) => String(l[7]).includes("pendente"))).toBe(
        true,
      );
    });

    it("a idade de todos os candidatos de todos os grupos; sem data, —", () => {
      const d = lerDesempateDaLista(DOURADO);
      const candidatos = planilhasDoDesempate(d)[3];
      const coluna = candidatos.linhas[0].indexOf("Idade na data de corte");
      const idade = (nome) =>
        candidatos.linhas.find((l) => l[6] === nome)?.[coluna];
      // Decidido pelo 60+ e decidido pela idade: com a idade.
      expect(idade("Ana Exemplo")).toBe(60);
      expect(idade("Bruno Teste")).toBe(40);
      expect(idade("João Esboço")).toBe(44);
      // Decididos por exp. saúde indígena e indígena comprovado (o 60+ empatou): também com a idade.
      expect(idade("Elisa Amostra")).toBe(34);
      expect(idade("Carla Ficticia")).toBe(34);
      // Sem data de nascimento: —.
      expect(idade("Dario Sem Data")).toBe("—");
      const html = paginaDoDesempate(d, "Relatório de desempate");
      expect(html).toContain('<td>Elisa Amostra</td><td class="idade">34</td>');
      expect(html).toContain('<td>Ana Exemplo</td><td class="idade">60</td>');
      expect(html).toContain('<td>Dario Sem Data</td><td class="idade">—</td>');
      // A ordem de idade só onde o critério idade foi aplicado.
      const elisa = candidatos.linhas.find((l) => l[6] === "Elisa Amostra");
      expect(elisa.join(" ")).not.toContain("mais velho");
      // A tela é tolerante: mostra a idade que vier gravada, sem recalcular
      // (um relatório gravado antes de 26/10/2026 tem — onde a idade não pesou).
      const antigo = structuredClone(DOURADO);
      antigo.relatorio.vagas[0].grupos[2].candidatos[0].idade = null;
      const outra = planilhasDoDesempate(lerDesempateDaLista(antigo))[3];
      expect(outra.linhas.find((l) => l[6] === "Elisa Amostra")?.[coluna]).toBe(
        "—",
      );
    });

    it("a coluna da idade também numa regra sem critério de idade", () => {
      const semCriterio = structuredClone(DOURADO);
      semCriterio.relatorio.criterios = semCriterio.relatorio.criterios.filter(
        (c) => c.codigo !== "IDOSO_60" && c.codigo !== "MAIOR_IDADE",
      );
      const d = lerDesempateDaLista(semCriterio);
      expect(planilhasDoDesempate(d)[3].linhas[0]).toContain(
        "Idade na data de corte",
      );
      expect(paginaDoDesempate(d, "Relatório")).toContain(
        '<th class="idade">Idade</th>',
      );
      // Sem nenhuma idade gravada e sem critério de idade: sem a coluna.
      for (const v of semCriterio.relatorio.vagas)
        for (const g of v.grupos) for (const c of g.candidatos) c.idade = null;
      expect(
        planilhasDoDesempate(lerDesempateDaLista(semCriterio))[3].linhas[0],
      ).not.toContain("Idade na data de corte");
    });

    it("o XLSX leva o filtro e o cabeçalho fixo nas planilhas com filtro", () => {
      const xlsx = textoDoZip(
        gerarXlsx(planilhasDoDesempate(lerDesempateDaLista(DOURADO))),
      );
      expect(xlsx).toContain('<autoFilter ref="A1:J17"/>');
      expect(xlsx).toContain('state="frozen"');
      expect(xlsx).toContain(
        `<definedName name="_xlnm._FilterDatabase" localSheetId="1" hidden="1">'Grupos'!$A$1:$J$17</definedName>`,
      );
      // Sem filtro pedido, a planilha sai como antes.
      const simples = textoDoZip(gerarXlsx([{ nome: "X", linhas: [["a"]] }]));
      expect(simples).not.toContain("autoFilter");
      expect(simples).not.toContain("definedNames");
    });

    it("o resumo calculado na tela é o que o Python grava (totais e resumo)", () => {
      const d = lerDesempateDaLista(DOURADO);
      const { totais, resumo: doPython } = DOURADO.relatorio;
      expect(resumoDoDesempate(d)).toEqual({ ...totais, ...doPython });
      // E o nome de cada lista: o do Python, igual ao que a tela calcula das modalidades.
      const nomes = Object.fromEntries(
        DOURADO.relatorio.modalidades.map((m) => [m.codigo, m.nome]),
      );
      for (const v of DOURADO.relatorio.vagas)
        for (const g of v.grupos)
          expect(nomeDaLista(g.lista, nomes)).toBe(g.listaNome);
    });

    it("o cabeçalho: edital, unidade, lista, fase, geração, id, quando, quem, regra e data de corte", () => {
      const d = lerDesempateDaLista(DOURADO);
      expect(linhasDoCabecalho(d)).toEqual([
        ["Edital", "nº 999/2026"],
        ["Unidade", "DSEI Fictício"],
        ["Lista", "Final"],
        ["Fase", "Resultado final do processo seletivo"],
        ["Geração", "2ª desta lista"],
        ["Identificador da lista", "lista-ficticia-final"],
        ["Lista gerada em", "23/10/2026 10:00"],
        ["Gerada por", "Maria Silva"],
        ["Versão da regra", "3"],
        ["Data de corte (idade e 60+)", "28/02/2025"],
        ["Relatório preparado em", "23/10/2026 10:00"],
      ]);
      expect(momentoBR("2026-10-24T02:30:00Z")).toBe("23/10/2026 23:30");
      expect(momentoBR("ontem")).toBe("");
    });

    it("o relatório da versão 1 continua abrindo e exportando", () => {
      expect(VERSOES_LIDAS).toEqual([1, 2]);
      const d = lerDesempateDaLista(DOURADO_V1);
      expect(d).not.toBeNull();
      expect(d.relatorio.versao).toBe(1);
      expect(d.relatorio.cabecalho).toBeNull();
      const cota = d.relatorio.vagas
        .flatMap((v) => v.grupos)
        .find((g) => g.lista !== "GERAL");
      expect(cota?.listaNome).toBe("Lista de cota: PPIQ");
      expect(cota?.cota).toBe(true);
      expect(linhasDoCabecalho(d).map(([k]) => k)).toEqual([
        "Lista",
        "Identificador da lista",
        "Data de corte (idade e 60+)",
        "Relatório preparado em",
      ]);
      const planilhas = planilhasDoDesempate(d);
      expect(planilhas[3].linhas[0]).not.toContain("Idade na data de corte");
      expect(planilhas[3].linhas.flat()).toContain(
        "1º mais velho do grupo, sem certidão",
      );
      expect(resumoDoDesempate(d)).toEqual({
        ...DOURADO_V1.relatorio.totais,
        ...DOURADO.relatorio.resumo,
      });
      const pagina = paginaDoDesempate(d, "Relatório de desempate");
      expect(pagina).toContain('href="#vaga-1"');
      expect(pagina).not.toContain('<th class="idade">Idade</th>');
    });

    it("o valor de cada critério como texto, sem data de nascimento", () => {
      expect(textoDoValor(true, "IDOSO_60")).toBe("sim");
      expect(textoDoValor(true, "IDOSO_60", 61)).toBe("sim (61 anos)");
      expect(textoDoValor(false, "PCD", 40)).toBe("não");
      expect(
        textoDoValor(
          { idade: 44, ordemDeIdade: 1, certidao: true },
          "MAIOR_IDADE",
        ),
      ).toBe("44 anos, 1º mais velho do grupo");
      expect(
        textoDoValor(
          { idade: null, ordemDeIdade: null, certidao: false },
          "MAIOR_IDADE",
        ),
      ).toBe("sem data de nascimento, sem certidão");
      expect(textoDoValor(null, "EXP_SAUDE_INDIGENA")).toBe("sem dado");
      expect(textoDoValor(1500, "EXP_PROFISSIONAL_TEMPO")).toBe("1500 dias");
      expect(textoDoValor(2.5, "PONTUACAO_ETNICA")).toBe("2,50");
      expect(
        textoDoValor({ ordemDeIdade: 1, certidao: false }, "MAIOR_IDADE"),
      ).toBe("1º mais velho do grupo, sem certidão");
    });

    it("a página do PDF: cabeçalho, resumo, índice com links e o cabeçalho da vaga em cada tabela", () => {
      const d = lerDesempateDaLista(DOURADO);
      const html = paginaDoDesempate(d, "Relatório de desempate");
      expect(html).toContain("<dt>Gerada por</dt><dd>Maria Silva</dd>");
      expect(html).toContain("<dt>Edital</dt><dd>nº 999/2026</dd>");
      expect(html).toContain(
        '<td>60+</td><td class="num">3</td><td class="num">3</td>',
      );
      const vagas = d.relatorio.vagas.length;
      for (let i = 1; i <= vagas; i++) {
        expect(html).toContain(`href="#vaga-${i}"`);
        expect(html).toContain(`id="vaga-${i}"`);
      }
      // O cabeçalho da vaga fica no <thead>: o navegador o repete em cada página.
      expect(html.match(/<thead><tr><th class="vaga"/g)?.length).toBe(vagas);
      expect(html).toContain(
        '<span class="selo cota">Lista de cota: Pretos, pardos, indígenas e quilombolas (PPIQ)</span>',
      );
      expect(html).toContain('<th class="idade">Idade</th>');
      expect(html).toContain("decidiu a hora da certidão");
      expect(html).toContain('content:"Página " counter(page)');
    });

    it("a página do PDF escapa os textos do relatório", () => {
      const quebrado = structuredClone(DOURADO);
      quebrado.relatorio.vagas[0].grupos[0].candidatos[0].nome = "<b>Ana</b>";
      quebrado.relatorio.cabecalho.lista.geradaPor = "<i>x</i>";
      const html = paginaDoDesempate(
        lerDesempateDaLista(quebrado),
        "Relatório de desempate",
      );
      expect(html).toContain("&lt;b&gt;Ana&lt;/b&gt;");
      expect(html).toContain("&lt;i&gt;x&lt;/i&gt;");
      expect(html).not.toContain("<b>Ana");
      expect(html).not.toContain("<i>x");
    });

    it("lê o preparo junto do relatório (migration 20261023170000)", () => {
      const pedido = "2026-10-23T14:00:00Z";
      const so = lerRespostaDoDesempate({
        lista_id: "l1",
        preparo: { situacao: "PEDIDO", pedido_em: pedido },
      });
      expect(so).toEqual({
        preparo: { situacao: "PEDIDO", pedidoEm: pedido },
        desempate: null,
      });
      const pronta = lerRespostaDoDesempate({
        ...DOURADO,
        preparo: { situacao: "PRONTO", pedido_em: pedido },
      });
      expect(pronta.preparo?.situacao).toBe("PRONTO");
      expect(pronta.desempate?.listaId).toBe("lista-ficticia-final");
      expect(lerRespostaDoDesempate(null)).toEqual({
        preparo: null,
        desempate: null,
      });
      expect(
        lerRespostaDoDesempate({ preparo: { situacao: "OUTRA" } }).preparo,
      ).toBeNull();
    });

    it("o estado do relatório: pronto, preparando (até a espera), não confere, falhou ou nada", () => {
      const agora = Date.parse("2026-10-23T14:05:00Z");
      const com = (situacao, pedidoEm = "2026-10-23T14:00:00Z") => ({
        preparo: { situacao, pedidoEm },
        desempate: null,
      });
      expect(estadoDoRelatorio(null, agora)).toBe("nada");
      expect(estadoDoRelatorio({ preparo: null, desempate: null }, agora)).toBe(
        "nada",
      );
      expect(
        estadoDoRelatorio(
          { ...com("PEDIDO"), desempate: lerDesempateDaLista(DOURADO) },
          agora,
        ),
      ).toBe("pronto");
      expect(estadoDoRelatorio(com("PEDIDO"), agora)).toBe("preparando");
      expect(estadoDoRelatorio(com("PREPARANDO"), agora)).toBe("preparando");
      const velho = new Date(agora - ESPERA_DO_RELATORIO_MS).toISOString();
      expect(estadoDoRelatorio(com("PEDIDO", velho), agora)).toBe("falhou");
      expect(estadoDoRelatorio(com("NAO_CONFERE"), agora)).toBe("nao_confere");
      expect(estadoDoRelatorio(com("FALHOU"), agora)).toBe("falhou");
      expect(estadoDoRelatorio(com("SEM_DISPARO"), agora)).toBe("falhou");
      expect(estadoDoRelatorio(com("DESLIGADA"), agora)).toBe("nada");
      // Relatório lido mas preparo sem relatório legível (versão nova): nada.
      expect(estadoDoRelatorio(com("PRONTO"), agora)).toBe("nada");
    });
  });
});

bloco("lib/dados-dos-ajustes", () => {
  const versao = {
    id: "aj1",
    versao: 1,
    situacao: "PROPOSTO",
    lista: "PRELIMINAR",
    itens: [{ codigo: "FORMACAO", anterior: 3, novo: 7 }],
  };
  describe("dados do ajuste de pontuação", () => {
    it("conserva versões válidas e metadados adicionais sem liberar permissões não booleanas", () => {
      const d = normalizarDadosDosAjustes({
        ajustes: [versao],
        recurso_id: "r1",
        pode_propor: true,
        pode_aprovar: "true",
        pode_cancelar: 1,
      });
      expect(d.erro).toBeUndefined();
      expect(d.recurso_id).toBe("r1");
      expect(d.ajustes[0]).toMatchObject(versao);
      expect([d.pode_propor, d.pode_aprovar, d.pode_cancelar]).toEqual([
        true,
        false,
        false,
      ]);
    });
    it("sinaliza versões e itens inválidos sem permitir uma aprovação com itens descartados", () => {
      for (const ajustes of [
        {},
        [null],
        [{ ...versao, versao: Infinity }],
        [{ ...versao, situacao: "inventada" }],
        [{ ...versao, itens: [{ codigo: "FORMACAO", novo: "texto" }] }],
        [{ ...versao, itens: [null] }],
      ]) {
        expect(normalizarDadosDosAjustes({ ajustes }).erro).toContain(
          "versões do ajuste recebidas são inválidas",
        );
      }
    });
    it("preserva a configuração e todos os campos da Classificação para o motor", () => {
      const configuracao = {
        etapas: { documental: true },
        composicao: { componentes: [] },
      };
      const dados = {
        regra: { versao: 3, configuracao },
        candidatos: [{ analise_id: "a1", campo_extra: { valor: 1 } }],
        extra: { valor: 2 },
      };
      const d = normalizarDadosParaPrevia(dados);
      expect(d.erro).toBeUndefined();
      expect(d.regra.configuracao).toBe(configuracao);
      expect(d.candidatos).toEqual(dados.candidatos);
      expect(d.extra).toEqual(dados.extra);
    });
    it("recusa coleções malformadas antes de calcular uma lista", () => {
      for (const candidatos of [{}, "texto", [null], [[]]]) {
        expect(normalizarDadosParaPrevia({ candidatos }).erro).toContain(
          "dados da classificação recebidos são inválidos",
        );
        expect(() => classificarEdital({ candidatos }, "FINAL")).toThrow(
          "dados da classificação recebidos são inválidos",
        );
      }
      expect(normalizarDadosParaPrevia({ convocacao: [] }).erro).toBeTruthy();
      expect(
        normalizarDadosParaPrevia({ regra: { configuracao: [] } }).erro,
      ).toBeTruthy();
    });
    it("protege os campos exibidos das prévias e ignora elementos de afetados inválidos", () => {
      expect(
        normalizarPreviaDoAjuste({
          tipo: "FINAL",
          antes: { naLista: true, nota: Infinity },
          depois: { naLista: true, posicao: {} },
          afetados: [null, { nome: {}, antes: "1", depois: 2 }],
          mudou: "true",
        }),
      ).toMatchObject({
        antes: { nota: null },
        depois: { posicao: null },
        afetados: [{ nome: "", antes: null, depois: 2 }],
        mudou: false,
      });
      expect(normalizarPreviaDoAjuste({ antes: {} })).toBeNull();
    });
  });
});

bloco("lib/dados-dos-documentos-classificacao", () => {
  const retrato = () => ({
    tipo: "PRELIMINAR",
    edital: { edital: "83/2026", unidade: "DSEI Xingu" },
    modalidades: [],
    vagas: [
      {
        codigo: "123",
        cargo: "Analista",
        geral: [{ nome: "Ana", nota: 12.5, posicao: 1 }],
        listas: {},
        eliminados: [],
      },
    ],
  });
  describe("entrada dos documentos da Classificação", () => {
    it("uma linha inválida impede exportar uma planilha parcial", () => {
      const r = retrato();
      r.vagas[0].geral.push(null);
      expect(() => gerarXlsxDaLista(r)).toThrow(/Dados do documento inválidos/);
    });
    it("valida também as modalidades fora do recorte escolhido", () => {
      const r = retrato();
      r.vagas[0].listas.PCD = {};
      expect(() => documentoOficial(r, { lista: "geral" })).toThrow(
        /Dados do documento inválidos/,
      );
    });
    it.each(["12,5", Number.NaN, Number.POSITIVE_INFINITY])(
      "recusa nota não normalizada: %s",
      (nota) => {
        const r = retrato();
        r.vagas[0].geral[0].nota = nota;
        expect(() => linhasDaPlanilha(r)).toThrow(
          /Nota ou posição do documento inválida/,
        );
      },
    );
    it("não transforma a ausência do quadro em uma publicação vazia", () => {
      expect(() => documentoOficial({ tipo: "FINAL" })).toThrow(
        /Quadro de vagas/,
      );
      expect(() => gerarXlsxDaLista({ tipo: "FINAL" })).toThrow(
        /Quadro de vagas/,
      );
      expect(() =>
        documentoOficial({ tipo: "CONVOCACAO", vagas: [{}] }),
      ).toThrow(/Convocados/);
    });
    it("preserva a diferença entre nota ausente e nota nula nos eliminados", () => {
      const r = retrato();
      r.vagas[0].eliminados = [{ nome: "Ana", motivo: "SEM_NOTA_DOCUMENTAL" }];
      expect(colunasDisponiveis(r, "eliminados").map((c) => c.id)).toEqual([
        "NOME",
        "JUSTIFICATIVA",
      ]);
      r.vagas[0].eliminados[0].nota = null;
      expect(colunasDisponiveis(r, "eliminados").map((c) => c.id)).toEqual([
        "NOME",
        "NOTA",
        "JUSTIFICATIVA",
      ]);
    });
    it("recusa uma agenda com horários malformados", () => {
      expect(() =>
        documentoOficial(retrato(), {
          agenda: new Map([["a1", { data: 123, inicio: "08:30" }]]),
        }),
      ).toThrow(/Horário da agenda/);
    });
    it("recusa uma tabela com mais células do que colunas", () => {
      expect(() =>
        tabelaXml({
          colunas: [{ rotulo: "Nome", largura: 100, alinhamento: "esquerda" }],
          linhas: [["Ana", "extra"]],
          vazia: "",
        }),
      ).toThrow(/Tabela do documento inconsistente/);
    });
  });
});

bloco("lib/entrada-do-motor-classificacao", () => {
  const candidato = {
    analise_id: "a1",
    nome: "Ana",
    vaga: "123",
    nota_documental: "12,5",
  };
  const regra = {
    etapas: { entrevista: false },
    documental: { situacoes_aptas: [] },
  };
  const entrada = () => ({
    tipo: "CONVOCACAO",
    regra,
    candidatos: [{ ...candidato }],
  });
  const convocacao = () =>
    convocacaoDoEdital(
      {
        configuracoes: [
          { edital_id: "e1", modelo_id: "m1", padrao_imediata: 1, vagas: [] },
        ],
        modelos: [
          {
            modelo_id: "m1",
            nome: "Ampla",
            categorias: [
              { id: "ac", rotulo: "Ampla", sigla: "AC", ampla: true },
            ],
          },
        ],
      },
      "e1",
    );

  describe("fronteira do motor da classificação", () => {
    it("recusa uma ordem de desempate malformada", () => {
      expect(() =>
        classificar({
          ...entrada(),
          desempates: [{ chave: "grupo", ordem: "a1" }],
        }),
      ).toThrow(/Ordem de desempate inválida/);
    });
    it("convocação sem limite mantém null e inclui o candidato", () => {
      const resultado = classificar(entrada());
      expect(resultado.vagas[0].limiteConvocacao).toEqual({
        limite: null,
        origem: "sem limite na regra",
      });
      expect(resultado.vagas[0].geral[0]).toMatchObject({
        analiseId: "a1",
        nota: 12.5,
        situacao: "CONVOCADO",
      });
    });
    it("preparar e classificar preservam os dados brutos da análise", () => {
      const bruto = Object.freeze({ ...candidato });
      expect(prepararCandidatos([bruto])[0].notaDocumental).toBe(12.5);
      classificar({ ...entrada(), candidatos: [bruto] });
      expect(bruto).toEqual(candidato);
    });
    it("configuração normalizada mantém a distribuição da convocação", () => {
      expect(
        classificar({ ...entrada(), convocacao: convocacao() }).vagas[0],
      ).toMatchObject({
        total: 1,
        vagasPorModalidade: { AC: 1 },
        origemDasVagas: "CONVOCACAO",
      });
    });
    it.each([{}, { configs: {} }, { ...convocacao(), modelos: {} }])(
      "recusa estruturas incompletas de convocação",
      (convocacao) => {
        expect(() => classificar({ ...entrada(), convocacao })).toThrow(
          /convocação inválida/,
        );
      },
    );
    it("recusa um modelo com categoria incompleta antes de gerar a lista", () => {
      const conv = convocacao();
      conv.modelo.categorias = [null];
      expect(() => classificar({ ...entrada(), convocacao: conv })).toThrow(
        /convocação inválida/,
      );
    });
  });
});

bloco("modulos/agenda-contexto-de-gravacao", () => {
  function banco() {
    const pendentes = [];
    let auth;
    const supabase = {
      auth: {
        onAuthStateChange: (fn) => {
          auth = fn;
        },
      },
      rpc: vi.fn((nome, args) =>
        nome === "obter_agenda_entrevista"
          ? Promise.resolve({
              data: {
                edital: { id: args.p_edital },
                regra: { versao: 2 },
                itens: [],
              },
              error: null,
            })
          : new Promise((resolve) => pendentes.push(resolve)),
      ),
    };
    return {
      supabase,
      pendentes,
      autenticar: (id) => auth("SIGNED_IN", { user: { id } }),
    };
  }
  describe("Agenda após mudança de contexto", () => {
    it.each(["regra", "agenda"])(
      "uma gravação antiga de %s não altera flags nem avisos depois de sair e voltar ao edital",
      async (tipo) => {
        const b = banco(),
          toast = vi.fn(),
          e = criarEstadoDaAgenda({ supabase: b.supabase, toast });
        await e.carregar("A");
        const salvar = () =>
          tipo === "regra"
            ? e.salvarRegra({})
            : e.salvarAgenda({ acao: "GERAR", itens: [] });
        const antiga = salvar();
        await e.carregar("B");
        await e.carregar("A");
        const nova = salvar();
        b.pendentes[0]({
          data:
            tipo === "regra"
              ? { versao: 9 }
              : { edital: { id: "A" }, regra: { versao: 9 }, itens: [] },
          error: null,
        });
        expect(await antiga).toBe(false);
        expect(e.obter().salvando).toBe(true);
        expect(e.obter().dados.regra.versao).toBe(2);
        expect(toast).not.toHaveBeenCalled();
        b.pendentes[1]({
          data:
            tipo === "regra"
              ? { versao: 3 }
              : { edital: { id: "A" }, regra: { versao: 3 }, itens: [] },
          error: null,
        });
        expect(await nova).toBe(true);
        expect(e.obter().salvando).toBe(false);
      },
    );
    it.each([null, { message: "Falha antiga" }])(
      "a gravação não produz avisos após troca de usuário (%j)",
      async (error) => {
        const b = banco(),
          toast = vi.fn(),
          e = criarEstadoDaAgenda({ supabase: b.supabase, toast });
        b.autenticar("u1");
        await e.carregar("A");
        const p = e.salvarRegra({});
        b.autenticar("u2");
        b.pendentes[0]({ data: { versao: 3 }, error });
        expect(await p).toBe(false);
        expect(e.obter().dados).toBeNull();
        expect(e.obter().salvando).toBe(false);
        expect(toast).not.toHaveBeenCalled();
      },
    );
    it("uma agenda de outro edital não substitui a versão aberta", async () => {
      const b = banco(),
        toast = vi.fn(),
        e = criarEstadoDaAgenda({ supabase: b.supabase, toast });
      await e.carregar("A");
      const p = e.salvarAgenda({ acao: "AJUSTAR", itens: [] });
      b.pendentes[0]({ data: { edital: { id: "B" }, itens: [] }, error: null });
      expect(await p).toBe(false);
      expect(e.obter().dados.edital.id).toBe("A");
      expect(toast).toHaveBeenCalledWith(
        expect.stringContaining("outro edital"),
        "error",
      );
    });
  });
});

bloco("modulos/agenda-estado-troca-de-edital", () => {
  /*
  O estado da agenda das entrevistas (src/modulos/classificacao/estado-da-agenda.ts):
  gravar e trocar de edital antes da resposta não pode pôr a regra ou a agenda
  do edital A nos dados do edital B; e falha no "Atualizar" do mesmo edital
  mantém a agenda que já estava na tela.
*/

  function bancoFalso() {
    const pendentes = [];
    let falharObter = false;
    const supabase = {
      rpc(nome, argumentos) {
        if (nome === "obter_agenda_entrevista") {
          if (falharObter)
            return Promise.resolve({
              data: null,
              error: { message: "Tempo esgotado" },
            });
          const id = argumentos.p_edital;
          return Promise.resolve({
            data: {
              edital: { id },
              regra: { versao: id === "A" ? 7 : 2 },
              itens: [{ analise_id: `${id}1` }],
            },
            error: null,
          });
        }
        return new Promise((resolve) => pendentes.push({ nome, resolve }));
      },
    };
    return {
      supabase,
      pendentes,
      falhar: () => {
        falharObter = true;
      },
    };
  }

  const esperar = () => new Promise((r) => setTimeout(r, 0));

  describe("agenda: resposta de gravação depois de trocar de edital", () => {
    it("a agenda salva no edital A não entra nos dados do edital B", async () => {
      const { supabase, pendentes } = bancoFalso();
      const agenda = criarEstadoDaAgenda({ supabase, toast: () => {} });
      await agenda.carregar("A");
      const salvando = agenda.salvarAgenda({ acao: "GERAR", itens: [] });
      await esperar();
      await agenda.carregar("B");

      pendentes[0].resolve({
        data: { edital: { id: "A" }, regra: { versao: 7 }, itens: [] },
        error: null,
      });
      await salvando;
      expect(agenda.obter().editalId).toBe("B");
      expect(agenda.obter().dados.edital.id).toBe("B");
      expect(agenda.obter().dados.itens).toEqual([{ analise_id: "B1" }]);
      expect(agenda.obter().salvando).toBe(false);
    });

    it("a regra salva no edital A não entra nos dados do edital B", async () => {
      const { supabase, pendentes } = bancoFalso();
      const agenda = criarEstadoDaAgenda({ supabase, toast: () => {} });
      await agenda.carregar("A");
      const salvando = agenda.salvarRegra({});
      await esperar();
      await agenda.carregar("B");

      pendentes[0].resolve({ data: { versao: 8 }, error: null });
      await salvando;
      expect(agenda.obter().dados.regra.versao).toBe(2);
    });

    it("sem troca, a agenda e a regra salvas atualizam os dados", async () => {
      const { supabase, pendentes } = bancoFalso();
      const agenda = criarEstadoDaAgenda({ supabase, toast: () => {} });
      await agenda.carregar("A");
      const regra = agenda.salvarRegra({});
      await esperar();
      pendentes[0].resolve({ data: { versao: 8 }, error: null });
      await regra;
      expect(agenda.obter().dados.regra.versao).toBe(8);

      const salvando = agenda.salvarAgenda({ acao: "GERAR", itens: [] });
      await esperar();
      pendentes[1].resolve({
        data: { edital: { id: "A" }, regra: { versao: 8 }, itens: [] },
        error: null,
      });
      await salvando;
      expect(agenda.obter().dados.itens).toEqual([]);
    });
  });

  describe("agenda: falha ao atualizar", () => {
    it("no mesmo edital, mantém a agenda na tela e mostra o erro", async () => {
      const { supabase, falhar } = bancoFalso();
      const agenda = criarEstadoDaAgenda({ supabase, toast: () => {} });
      await agenda.carregar("A");
      falhar();
      await agenda.carregar("A");
      expect(agenda.obter().erro).toBe("Tempo esgotado");
      expect(agenda.obter().dados.itens).toEqual([{ analise_id: "A1" }]);
    });

    it("em outro edital, não sobra a agenda do anterior", async () => {
      const { supabase, falhar } = bancoFalso();
      const agenda = criarEstadoDaAgenda({ supabase, toast: () => {} });
      await agenda.carregar("A");
      falhar();
      await agenda.carregar("B");
      expect(agenda.obter().erro).toBe("Tempo esgotado");
      expect(agenda.obter().dados).toBeNull();
    });
  });
});

bloco("modulos/classificacao-calculo-em-python", () => {
  /*
  O estado da Classificação com a chave "Gerar listas pelo Python" ligada
  (20261023200000): o prazo da espera, a troca de edital no meio da espera e a
  falha de conexão que não derruba a espera. A tela inteira está em
  tests/classificacao-e-entrevistas-na-tela.test.js (bloco modulos/classificacao) ("Gerar com a lista calculada pelo Python").
*/
  const PEDIDO = "aaaaaaaa-1111-4111-8111-111111111111";

  function banco(respostas = {}) {
    return {
      rpc: vi.fn(async (nome, args) => {
        if (nome === "listar_editais_classificacao")
          return {
            data: { editais: [{ id: "A" }], pode_editar: true },
            error: null,
          };
        if (nome.startsWith("obter_classificacao_do_edital"))
          return {
            data: {
              edital: { id: args.p_edital },
              regra: { versao: 2, configuracao: {} },
              listas: [],
              candidatos: [],
              pode_editar: true,
            },
            error: null,
          };
        if (nome.startsWith("listar_")) return { data: [], error: null };
        if (nome === "pedir_calculo_classificacao")
          return {
            data: { ligada: true, pedido: PEDIDO, situacao: "PEDIDO" },
            error: null,
          };
        const resposta = respostas[nome];
        if (resposta instanceof Error) return { data: null, error: resposta };
        return { data: resposta?.(args) ?? null, error: null };
      }),
    };
  }

  describe("Gerar pelo Python: a espera", () => {
    it("o job não responde no prazo: aviso de prazo, nada registrado", async () => {
      let relogio = 0;
      const supabase = banco({
        obter_calculo_classificacao: () => ({
          pedido: PEDIDO,
          situacao: "PEDIDO",
        }),
      });
      const e = criarEstadoDaClassificacao({
        supabase,
        toast: vi.fn(),
        intervaloDoCalculoMs: 0,
        prazoDoCalculoMs: 300000,
        agora: () => (relogio += 60000),
      });
      await e.escolherEdital("A");
      const resultado = calcularClassificacao(e.obter().dados, "FINAL");
      expect(await e.gerarLista(resultado)).toBeNull();
      expect(e.obter().calculo).toMatchObject({
        tipo: "FINAL",
        pedido: PEDIDO,
        situacao: "prazo",
        mensagem: "O cálculo em Python não chegou em 5 min.",
      });
      expect(e.obter().gerando).toBe(false);
      const nomes = supabase.rpc.mock.calls.map(([n]) => n);
      expect(nomes).not.toContain("registrar_lista_calculada");
      expect(nomes).not.toContain("registrar_lista_classificacao");
    });

    it("a conexão caiu numa releitura: continua esperando; trocar de edital encerra sem aviso", async () => {
      let leituras = 0;
      const queda = Object.assign(new Error("Failed to fetch"), {
        name: "NetworkError",
      });
      const supabase = banco({
        obter_calculo_classificacao: () => {
          leituras += 1;
          return { pedido: PEDIDO, situacao: "CALCULANDO" };
        },
      });
      // A primeira releitura dá erro de rede (a resposta vira `error`).
      const rpc = supabase.rpc;
      supabase.rpc = vi.fn(async (nome, args) => {
        if (nome === "obter_calculo_classificacao" && leituras === 0) {
          leituras += 1;
          return { data: null, error: queda };
        }
        return rpc(nome, args);
      });
      const e = criarEstadoDaClassificacao({
        supabase,
        toast: vi.fn(),
        intervaloDoCalculoMs: 0,
      });
      await e.escolherEdital("A");
      const resultado = calcularClassificacao(e.obter().dados, "FINAL");
      const gerando = e.gerarLista(resultado);
      await vi.waitFor(() => expect(leituras).toBeGreaterThanOrEqual(3));
      expect(e.obter().calculo?.situacao).toBe("calculando");
      await e.escolherEdital("");
      expect(await gerando).toBeNull();
      expect(e.obter().calculo).toBeNull();
    });
  });
});

bloco("modulos/classificacao-contexto-de-gravacao", () => {
  function banco() {
    const pendentes = [];
    let auth;
    const supabase = {
      auth: {
        onAuthStateChange: (fn) => {
          auth = fn;
        },
      },
      rpc: vi.fn((nome, args) => {
        if (nome === "listar_editais_classificacao")
          return Promise.resolve({
            data: { editais: [{ id: "A" }], pode_editar: true },
            error: null,
          });
        // A leitura por versão (_se_mudou, 20261014230000) responde o mesmo payload.
        if (nome.startsWith("obter_classificacao_do_edital"))
          return Promise.resolve({
            data: {
              edital: { id: args.p_edital },
              regra: { versao: 2, configuracao: {} },
              listas: [],
              candidatos: [],
              pode_editar: true,
            },
            error: null,
          });
        if (nome.startsWith("listar_"))
          return Promise.resolve({ data: [], error: null });
        // Chave "Gerar listas pelo Python" desligada (20261023200000): o "Gerar" segue como antes.
        if (nome === "pedir_calculo_classificacao")
          return Promise.resolve({ data: { ligada: false }, error: null });
        return new Promise((resolve) =>
          pendentes.push({ nome, resolver: resolve }),
        );
      }),
    };
    return {
      supabase,
      pendentes,
      autenticar: (id) => auth("SIGNED_IN", { user: { id } }),
    };
  }
  describe("Classificação após mudança de contexto", () => {
    it("pede conferência da lista quando o banco não confirma uma publicação enviada", async () => {
      const b = banco(),
        toast = vi.fn(),
        e = criarEstadoDaClassificacao({ supabase: b.supabase, toast });
      await e.escolherEdital("A");
      const p = e.publicarComoListaDeAprovados({ pedidoId: "p1" });
      b.pendentes[0].resolver({ data: { ok: true }, error: null });
      expect(await p).toBeNull();
      expect(toast).toHaveBeenCalledWith(
        expect.stringContaining(
          "Confira a Lista de aprovados antes de tentar novamente",
        ),
        "warning",
      );
      expect(toast).not.toHaveBeenCalledWith(expect.anything(), "success");
    });

    it("descarta a confirmação de aprovados após sair e voltar ao mesmo edital", async () => {
      const b = banco(),
        toast = vi.fn(),
        e = criarEstadoDaClassificacao({ supabase: b.supabase, toast });
      await e.escolherEdital("A");
      const p = e.publicarComoListaDeAprovados({ pedidoId: "p1" });
      await e.escolherEdital("B");
      await e.escolherEdital("A");
      b.pendentes[0].resolver({
        data: { ok: true, candidatos: 3, pendencias: [] },
        error: null,
      });
      expect(await p).toBeNull();
      expect(toast).not.toHaveBeenCalled();
    });

    it("uma geração antiga não libera o botão nem insere uma lista no contexto novo", async () => {
      const b = banco(),
        toast = vi.fn(),
        e = criarEstadoDaClassificacao({ supabase: b.supabase, toast });
      await e.escolherEdital("A");
      const resultado = calcularClassificacao(e.obter().dados, "FINAL");
      const antiga = e.gerarLista(resultado);
      await e.escolherEdital("B");
      await e.escolherEdital("A");
      const nova = e.gerarLista(resultado);
      b.pendentes[0].resolver({ data: { id: "antiga" }, error: null });
      expect(await antiga).toBeNull();
      expect(e.obter().gerando).toBe(true);
      expect(e.obter().dados.listas).toEqual([]);
      expect(toast).not.toHaveBeenCalled();
      b.pendentes[1].resolver({ data: { id: "nova" }, error: null });
      expect(await nova).toMatchObject({ id: "nova" });
      expect(e.obter().gerando).toBe(false);
    });
    it("não inicia download do documento depois da troca de área durante a carga do logo", async () => {
      const b = banco(),
        baixar = vi.fn();
      let concluir;
      const logo = new Promise((resolve) => {
        concluir = resolve;
      });
      const e = criarEstadoDaClassificacao({
        supabase: b.supabase,
        baixar,
        carregarLogo: () => logo,
      });
      await e.carregar("a");
      await e.escolherEdital("A");
      const exportacao = e.exportar(
        {
          id: "l1",
          retrato: {
            tipo: "FINAL",
            edital: { id: "A", edital: "105/2026" },
            vagas: [],
            modalidades: [],
          },
        },
        "docx",
      );
      await Promise.resolve();
      await e.carregar("b");
      concluir(null);
      expect(await exportacao).toBe(false);
      expect(baixar).not.toHaveBeenCalled();
    });

    it.each([null, { message: "Falha antiga" }])(
      "uma regra antiga não muda dados, flags nem avisos depois de sair e voltar ao mesmo edital (%j)",
      async (error) => {
        const b = banco(),
          toast = vi.fn(),
          e = criarEstadoDaClassificacao({ supabase: b.supabase, toast });
        await e.carregar("a");
        await e.escolherEdital("A");
        const antiga = e.salvarRegra({});
        await e.escolherEdital("B");
        await e.escolherEdital("A");
        const nova = e.salvarRegra({});
        b.pendentes[0].resolver({ data: { versao: 9 }, error });
        expect(await antiga).toBe(false);
        expect(e.obter().dados.regra.versao).toBe(2);
        expect(e.obter().salvando).toBe(true);
        expect(toast).not.toHaveBeenCalled();
        b.pendentes[1].resolver({ data: { versao: 3 }, error: null });
        expect(await nova).toBe(true);
        expect(e.obter().dados.regra.versao).toBe(3);
        expect(e.obter().salvando).toBe(false);
      },
    );
    it("uma publicação antiga não mostra aviso após troca de área", async () => {
      const b = banco(),
        toast = vi.fn(),
        e = criarEstadoDaClassificacao({ supabase: b.supabase, toast });
      await e.carregar("a");
      await e.escolherEdital("A");
      const p = e.publicarLista({ id: "l1" }, null);
      await e.carregar("b");
      b.pendentes[0].resolver({ data: { id: "l1" }, error: null });
      expect(await p).toBeNull();
      expect(toast).not.toHaveBeenCalled();
      expect(e.obter().dados).toBeNull();
    });
    it("uma gravação antiga da hora não altera o estado após troca de usuário", async () => {
      const b = banco(),
        toast = vi.fn(),
        e = criarEstadoDaClassificacao({ supabase: b.supabase, toast });
      b.autenticar("u1");
      await e.escolherEdital("A");
      const p = e.salvarHoraDeNascimento("a1", "10:00:00");
      b.autenticar("u2");
      b.pendentes[0].resolver({
        data: { hora_nascimento: "10:00:00" },
        error: null,
      });
      expect(await p).toBe(false);
      expect(toast).not.toHaveBeenCalled();
      expect(e.obter().dados).toBeNull();
    });
  });
});

bloco("modulos/classificacao-estado-troca-de-edital", () => {
  /*
  Gravar e trocar de edital antes da resposta: a regra (com a versão) do
  edital A não pode cair nos dados do edital B — o próximo "Salvar regra" em B
  mandaria a versão de A.
*/

  function bancoFalso() {
    const pendentes = [];
    const supabase = {
      rpc(nome, argumentos) {
        // A leitura por versão (_se_mudou, 20261014230000) responde o mesmo payload.
        if (nome.startsWith("obter_classificacao_do_edital")) {
          const id = argumentos.p_edital;
          return Promise.resolve({
            data: { edital: { id }, regra: { versao: id === "A" ? 7 : 2 } },
            error: null,
          });
        }
        if (nome.startsWith("listar_")) {
          return Promise.resolve({ data: [], error: null });
        }
        return new Promise((resolve) => pendentes.push({ nome, resolve }));
      },
    };
    return { supabase, pendentes };
  }

  const esperar = () => new Promise((r) => setTimeout(r, 0));

  describe("classificação: resposta de gravação depois de trocar de edital", () => {
    it("a regra salva no edital A não entra nos dados do edital B", async () => {
      const { supabase, pendentes } = bancoFalso();
      const estado = criarEstadoDaClassificacao({
        supabase,
        toast: () => {},
      });
      await estado.escolherEdital("A");
      const salvando = estado.salvarRegra({});
      await esperar();
      await estado.escolherEdital("B");
      expect(estado.obter().dados.regra.versao).toBe(2);

      pendentes[0].resolve({ data: { versao: 8 }, error: null });
      await salvando;
      expect(estado.obter().editalId).toBe("B");
      expect(estado.obter().dados.regra.versao).toBe(2);
    });

    it("sem troca, a regra salva atualiza os dados", async () => {
      const { supabase, pendentes } = bancoFalso();
      const estado = criarEstadoDaClassificacao({
        supabase,
        toast: () => {},
      });
      await estado.escolherEdital("A");
      const salvando = estado.salvarRegra({});
      await esperar();
      pendentes[0].resolve({ data: { versao: 8 }, error: null });
      await salvando;
      expect(estado.obter().dados.regra.versao).toBe(8);
    });
  });

  describe("classificação: releituras", () => {
    function bancoContado() {
      const chamadas = [];
      const supabase = {
        rpc(nome, argumentos) {
          chamadas.push(nome);
          if (nome === "listar_editais_classificacao")
            return Promise.resolve({
              data: { editais: [{ id: "A" }, { id: "B" }], pode_editar: true },
              error: null,
            });
          if (nome.startsWith("obter_classificacao_do_edital"))
            return Promise.resolve({
              data: {
                edital: { id: argumentos.p_edital },
                regra: { versao: 1 },
              },
              error: null,
            });
          return Promise.resolve({ data: [], error: null });
        },
      };
      const contar = (prefixo) =>
        chamadas.filter((n) => n.startsWith(prefixo)).length;
      return { supabase, contar };
    }

    it("a configuração de convocação é lida uma vez por sessão; o Atualizar relê", async () => {
      const { supabase, contar } = bancoContado();
      const estado = criarEstadoDaClassificacao({ supabase, toast: () => {} });
      await estado.carregar("projetos");
      await estado.escolherEdital("A");
      await estado.escolherEdital("B");
      expect(contar("listar_configuracao_convocacao")).toBe(1);
      expect(contar("listar_modelos_convocacao")).toBe(1);
      await estado.carregar("projetos", { releitura: true });
      await esperar();
      expect(contar("listar_configuracao_convocacao")).toBe(2);
    });

    it("Atualizar lê o edital escolhido uma vez só", async () => {
      const { supabase, contar } = bancoContado();
      const estado = criarEstadoDaClassificacao({ supabase, toast: () => {} });
      await estado.carregar("projetos");
      await estado.escolherEdital("A");
      const antes = contar("obter_classificacao_do_edital");
      await estado.carregar("projetos", { releitura: true });
      await esperar();
      await esperar();
      expect(contar("obter_classificacao_do_edital") - antes).toBe(1);
      expect(estado.obter().editalId).toBe("A");
    });
  });
});
