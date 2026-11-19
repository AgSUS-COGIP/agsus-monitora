// @vitest-environment node
import { bloco } from "./apoio/bloco.ts";
import { describe, expect, it, beforeAll, beforeEach, vi } from "vitest";
import {
  bancasDoPerfil,
  copiaParaOCampo,
  validadeDaCopia,
} from "../src/lib/entrevistas/conducao-para-o-campo.ts";
import {
  modeloDeReferencia,
  normalizarModelo,
  modeloEmBranco,
} from "../src/lib/aprovados/carta-de-convocacao/modelo-de-convocacao.ts";
import {
  derivarQuadro,
  montarConvocacaoDaVaga,
  sequenciaDeConvocacao,
  estaForaDaFila,
  jaFoiChamado,
  statusNaFila,
  montarListaDeConvocacao,
  quadroVazio,
} from "../src/lib/aprovados/lista-convocacao-rules.ts";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { erroDe, uma } from "./apoio/banco-dos-robos.ts";
import { moldeDeBanco } from "./apoio/molde-de-banco.ts";
import {
  agendaPorCandidato,
  conflitosDaAgenda,
  convocadosDaLista,
  diasDaRegra,
  gerarAgenda,
  gerarXlsxDaAgenda,
  horariosDaRegra,
  horariosLivres,
  itensParaSalvar,
  juntarComConvocados,
  lerDias,
  linhasDaAgenda,
  moverNaAgenda,
  normalizarRegraDaAgenda,
  ordenarConvocados,
  temAjusteManual,
  textoDaDuracao,
  trocarNaAgenda,
  validarRegraDaAgenda,
} from "../src/lib/entrevistas/agenda-das-entrevistas.ts";
import {
  type ConvocadoDaAgenda,
  type ItemDaAgenda,
} from "../src/lib/entrevistas/tipos-da-agenda.ts";
import { definido } from "./definido.ts";
import {
  acompanharCasamento,
  casamentoLido,
  numerosDoCasamento,
  pedidoLido,
  textoDoCasamentoParado,
  type CasamentoDaLista,
} from "../src/lib/aprovados/casamento-da-lista.ts";
import {
  lerModelosDoBanco,
  lerConfiguracoesDoBanco,
} from "../src/lib/aprovados/carta-de-convocacao/configuracao-de-convocacao.ts";
import { criarEstadoDaListaDeAprovados } from "../src/modulos/aprovados/estado.ts";
import {
  separarAprovados,
  vistaDoPedido,
} from "../src/lib/aprovados/ativos-e-historico-dos-aprovados.ts";
import { clienteDosAprovados } from "./clientes-falsos.ts";
import { expandirCandidatosCompactos } from "../src/lib/aprovados/candidatos-aprovados-compactos.ts";
import {
  STATUS_DO_CANDIDATO,
  matriculaNormalizada,
  outrasLinhasContratadasDaMatricula,
  statusEfetivo,
  statusGuardaMatricula,
  summarizeApprovedCandidates,
  tomDoStatus,
  filterApprovedCandidates,
} from "../src/lib/aprovados/lista-aprovados-rules.ts";
import { type CandidatoDasRegrasDeAprovados } from "../src/lib/aprovados/tipos-das-regras-de-aprovados.ts";
import { type CandidatoDaConvocacao } from "../src/lib/aprovados/tipos-da-lista-de-convocacao.ts";
import { dadosDaAgenda } from "../src/lib/entrevistas/dados-da-agenda.ts";
import {
  resultadoDaPublicacao,
  situacaoDaPublicacao,
} from "../src/lib/aprovados/dados-da-publicacao-de-aprovados.ts";
import {
  candidatosDaListaFinal,
  motivoValido,
  origemDaLista,
  resumoDasOrigens,
} from "../src/lib/aprovados/publicacao-de-aprovados.ts";
import { strFromU8, unzipSync, zipSync } from "fflate";
import { carregarBibliotecasDoPdf } from "../src/lib/avaliacao-documental/espelho-em-pdf.ts";
import {
  argumentosDoRegistro,
  COLUNAS_DA_EXPORTACAO,
  csvDaExportacao,
  identificacaoDaExportacao,
  linhasDaExportacao,
  nomeDoArquivoDaExportacao,
  planilhasDaExportacao,
  registroDaResposta,
  xlsxDaExportacao,
  type CandidatoDaExportacao,
  type PedidoDaExportacao,
  type RegistroDaExportacao,
} from "../src/lib/aprovados/exportacao/exportacao-da-lista-de-aprovados.ts";
import { pdfDaExportacao } from "../src/lib/aprovados/exportacao/exportacao-da-lista-de-aprovados-em-pdf.ts";
import {
  argumentosDoRegistroDoResumo,
  COLUNAS_DO_ARQUIVO_DO_RESUMO,
  csvDoResumo,
  identificacaoDoResumo,
  linhasDoArquivoDoResumo,
  nomeDoArquivoDoResumo,
  xlsxDoResumo,
} from "../src/lib/aprovados/exportacao/exportacao-do-resumo-por-cargo.ts";
import { pdfDoResumo } from "../src/lib/aprovados/exportacao/exportacao-do-resumo-por-cargo-em-pdf.ts";
import {
  montarResumoPorCargoEStatus,
  type CandidatoDoResumo,
  lerRegimeEJornada,
  categoriaDoVinculo,
  linhasPlanasDoResumo,
  reconcilia,
  resumoAteOLimite,
  situacoesNaFila,
  type ContagemDoResumo,
} from "../src/lib/aprovados/exportacao/resumo-por-cargo-e-status.ts";
import { cartasDoHistorico } from "../src/lib/aprovados/carta-de-convocacao/dados-da-carta.ts";
import { publicacaoDoEdital } from "../src/lib/aprovados/dados-do-historico-de-publicacoes.ts";
import { criarEstadoDaCarta } from "../src/modulos/aprovados/carta-de-convocacao/estado.ts";
import {
  cargoDaVaga,
  chaveDaLocalidade,
  localidadeDoCargo,
  naLocalidade,
  opcoesDeLocalidade,
} from "../src/lib/aprovados/localidade-da-vaga.ts";
import { acoesDaLinhaDoAprovado } from "../src/lib/aprovados/acoes-da-linha-dos-aprovados.ts";
import { ordenarAprovados } from "../src/lib/aprovados/ordem-dos-aprovados.ts";
import {
  chamadaDaDecisao,
  contarAbertas,
  editaisDasPendencias,
  filtrarPendencias,
  normalizarPendencia,
  normalizarResposta,
  textoDaAlteracao,
  textoDoDetalhe,
} from "../src/lib/aprovados/pendencias-do-edital.ts";
import { CONFLITO_DE_VERSAO } from "../src/lib/base/conflito-de-versao.ts";
import { criarEstadoDaConducao } from "../src/modulos/entrevistas/estado-da-conducao.ts";
import {
  type ClienteDaConducao,
  type CopiasDaConducao,
} from "../src/modulos/entrevistas/tipos-do-estado-da-conducao.ts";
import {
  entrevistaConcluida,
  MOTIVOS_DA_REABERTURA_DA_ENTREVISTA,
  podeConcluirAEntrevista,
  validarReaberturaDaEntrevista,
} from "../src/lib/entrevistas/reabertura-da-entrevista.ts";
import {
  LIMITE_DO_LOTE,
  SEM_STATUS_EM_LOTE,
  editaisDoLote,
  motivosDeFora,
  planejarStatusEmLote,
  resumoDoStatusAtual,
  statusDoLotePara,
  textoDaConfirmacaoDoLote,
} from "../src/lib/aprovados/status-em-lote-dos-aprovados.ts";

bloco("conducao-para-o-campo", () => {
  /*
  O que a condução guarda no aparelho: quem avalia leva só a sua banca; quem
  não tem banca no edital leva o edital inteiro; o cálculo da convocação não
  vai. Dados fictícios.
*/

  const EDITAL = {
    edital: { id: "E1" },
    meu_perfil: "p-ana",
    avaliadores: [
      { perfil: "p-ana", banca: 2, ativo: true },
      { perfil: "p-ana", banca: 3, ativo: false },
      { perfil: "p-bia", banca: 1, ativo: true },
    ],
    convocados: [
      { id: "c1", banca: 1 },
      { id: "c2", banca: 2 },
      { id: "c3", banca: null },
    ],
  };
  const AGENDA = { itens: [{ banca: 1 }, { banca: 2 }] };

  describe("o que a condução leva para o campo", () => {
    it("as bancas de quem está na tela são as ativas do seu perfil", () => {
      expect([...bancasDoPerfil(EDITAL)]).toEqual([2]);
      expect(bancasDoPerfil({ ...EDITAL, meu_perfil: "p-cid" }).size).toBe(0);
      expect(bancasDoPerfil(null).size).toBe(0);
    });

    it("quem avalia leva só os convocados e os horários da sua banca, sem o cálculo", () => {
      const copia = copiaParaOCampo({
        resposta: EDITAL,
        previsao: { situacao: "PREVISTA" },
        agenda: AGENDA,
      });
      expect(copia.soDaBanca).toBe(true);
      expect(copia.resposta).toMatchObject({ convocados: [{ id: "c2" }] });
      expect(copia.agenda).toEqual({ itens: [{ banca: 2 }] });
      expect(copia.calculo).toBeNull();
      expect(copia.formato).toBe(1);
    });

    it("quem não tem banca no edital (coordenação) leva o edital inteiro", () => {
      const resposta = { ...EDITAL, meu_perfil: "p-cid" };
      const copia = copiaParaOCampo({
        resposta,
        previsao: null,
        agenda: AGENDA,
      });
      expect(copia.soDaBanca).toBe(false);
      expect(copia.resposta).toBe(resposta);
      expect(copia.agenda).toBe(AGENDA);
      expect(copia.calculo).toBeNull();
    });

    it("diz até quando a cópia fica no aparelho (48 h)", () => {
      expect(
        validadeDaCopia(Date.UTC(2026, 10, 17, 13, 14), "America/Sao_Paulo"),
      ).toBe("19/11, 10:14");
    });
  });
});

bloco("convocacao-ampla-antes-da-cota", () => {
  /*
  Regra 2 do cabeçalho de lista-convocacao-rules.ts: ser chamado pela ampla
  não gasta a vaga da cota. A auditoria de 10/11/2026 achou o contrário quando
  a posição de reserva vem antes de uma de ampla na sequência: o cotista mais
  bem classificado ocupava a reserva, mesmo estando dentro das vagas da ampla,
  e a Convocação chamava uma pessoa diferente da que a Classificação publica.
*/
  const MGI = normalizarModelo(modeloDeReferencia("mgi-simulador"));

  const candidato = (nome: string, nota: number, modalidade: string) => ({
    candidato_id: nome,
    nome,
    nota,
    modalidade,
  });

  const CANDIDATOS = [
    candidato("B", 95, "Ampla concorrência"),
    candidato("A", 90, "Pretos e pardos"),
    candidato("C", 80, "Ampla concorrência"),
    candidato("E", 70, "Ampla concorrência"),
    candidato("D", 60, "Pretos e pardos"),
  ];

  describe("convocação: a ampla antes da cota nas vagas imediatas", () => {
    const quadro = derivarQuadro(4, MGI);
    const resultado = montarConvocacaoDaVaga({
      candidatos: CANDIDATOS,
      quadro,
      modelo: MGI,
    });
    const imediatas = resultado.linhas.filter((l) => l.imediata);

    it("o caso parte da sequência AC, PP, AC, AC", () => {
      const sequencia = sequenciaDeConvocacao(quadro, MGI);
      expect(sequencia).toHaveLength(4);
      expect(sequencia[1]).not.toBe(sequencia[0]);
      expect([sequencia[0], sequencia[2], sequencia[3]]).toEqual([
        sequencia[0],
        sequencia[0],
        sequencia[0],
      ]);
    });

    it("a cotista dentro das vagas da ampla não gasta a vaga da cota", () => {
      expect(imediatas.map((l) => l.candidato.nome).sort()).toEqual([
        "A",
        "B",
        "C",
        "D",
      ]);
      // E fica no cadastro de reserva.
      expect(
        resultado.linhas.find((l) => l.candidato.nome === "E")?.imediata,
      ).toBe(false);
    });

    it("a ordem de chamada segue a sequência: a ampla na ordem da classificação, a cota com D", () => {
      const sequencia = sequenciaDeConvocacao(quadro, MGI);
      expect(
        imediatas.map((l) => [l.posicao, l.candidato.nome, l.categoria]),
      ).toEqual([
        [1, "B", sequencia[0]],
        [2, "D", sequencia[1]],
        [3, "A", sequencia[2]],
        [4, "C", sequencia[3]],
      ]);
    });
  });

  describe("convocação: os outros casos do bloco imediato", () => {
    const quadro = derivarQuadro(4, MGI);
    const sequencia = sequenciaDeConvocacao(quadro, MGI);
    const ordem = (candidatos: ReturnType<typeof candidato>[]) =>
      montarConvocacaoDaVaga({ candidatos, quadro, modelo: MGI })
        .linhas.filter((l) => l.imediata)
        .map((l) => [l.candidato.nome, l.categoria]);

    it("cotista fora das vagas da ampla ocupa a reserva, como antes", () => {
      expect(
        ordem([
          candidato("B", 95, "Ampla concorrência"),
          candidato("C", 90, "Ampla concorrência"),
          candidato("E", 85, "Ampla concorrência"),
          candidato("A", 80, "Pretos e pardos"),
          candidato("D", 60, "Pretos e pardos"),
        ]),
      ).toEqual([
        ["B", sequencia[0]],
        ["A", sequencia[1]],
        ["C", sequencia[2]],
        ["E", sequencia[3]],
      ]);
    });

    it("reserva sem cotista reverte para a ampla e a chamada segue a nota", () => {
      const resultado = montarConvocacaoDaVaga({
        candidatos: [
          candidato("B", 95, "Ampla concorrência"),
          candidato("C", 90, "Ampla concorrência"),
          candidato("E", 85, "Ampla concorrência"),
          candidato("F", 80, "Ampla concorrência"),
          candidato("G", 70, "Ampla concorrência"),
        ],
        quadro,
        modelo: MGI,
      });
      const imediatas = resultado.linhas.filter((l) => l.imediata);
      expect(imediatas.map((l) => l.candidato.nome)).toEqual([
        "B",
        "C",
        "E",
        "F",
      ]);
      // A 2ª posição era da reserva e reverteu para a ampla.
      expect(imediatas[1]?.categoriaReservada).toBe(sequencia[1]);
    });

    it("com menos candidatos que vagas, chama todos", () => {
      expect(
        ordem([
          candidato("A", 90, "Pretos e pardos"),
          candidato("B", 80, "Ampla concorrência"),
        ]).map(([nome]) => nome),
      ).toEqual(["A", "B"]);
    });
  });
});

bloco("exportacao-de-aprovados-no-banco", () => {
  /*
  Migration 20261110190000 (exportação da Lista de aprovados, já aplicada; o SQL
  dela está em tests/fixtures/sql-do-banco/) num Postgres de verdade (PGlite).
  As tabelas da lista são as colunas que a RPC lê; a sessão e as permissões são
  imitações que leem configurações do teste (teste.uid, teste.nivel,
  teste.areas, teste.visiveis). Dados fictícios.
*/

  const NOME = "20261110190000_exportacao_da_lista_de_aprovados.sql";
  const ler = (caminho: string) =>
    readFileSync(caminho, "utf8").replace(/\r\n/g, "\n");
  const MIGRATION = ler(`tests/fixtures/sql-do-banco/${NOME}`);

  const USUARIO = "11111111-1111-1111-1111-111111111111";
  const EDITAL_A1 = "a0000000-0000-0000-0000-0000000000a1";
  const EDITAL_A2 = "a0000000-0000-0000-0000-0000000000a2";
  const EDITAL_TREINO = "a0000000-0000-0000-0000-0000000000a9";
  const EDITAL_SEM_LISTA = "a0000000-0000-0000-0000-0000000000a8";
  const EDITAL_B = "b0000000-0000-0000-0000-0000000000b1";

  const INFRAESTRUTURA = `
create role anon;
create role authenticated;
create schema private;
create schema auth;

create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('teste.uid', true), '')::uuid
$$;
create function private.pode_recurso(p_recurso text, p_minimo integer default 1) returns boolean
language sql stable as $$
  select p_recurso = 'aprovados'
     and coalesce(nullif(current_setting('teste.nivel', true), ''), '0')::integer >= greatest(p_minimo, 1)
$$;
create function private."FC_AREAS_USUARIO"() returns text[] language sql stable as $$
  select string_to_array(coalesce(current_setting('teste.areas', true), ''), ',')
$$;
create function private."FC_EDITAIS_VISIVEIS"() returns uuid[] language sql stable as $$
  select nullif(current_setting('teste.visiveis', true), '')::uuid[]
$$;
create function private."FC_EH_TREINAMENTO"(p_marca text) returns boolean
language sql immutable as $$ select coalesce(p_marca, 'N') = 'S' $$;
create function private.autor_da_sessao(out email text, out nome text) returns record
language sql stable as $$ select 'pessoa@exemplo.org'::text, 'Pessoa de Teste'::text $$;

create table public."TB_AREA" ("CO_AREA" text primary key);
create table public."TB_MONITORAMENTO_INDIGENA" (
  id uuid primary key, edital text, unidade text, "CO_AREA" text, "ST_TREINAMENTO" text
);
create table public."TB_LISTA_APROVADO" (
  id uuid primary key default gen_random_uuid(), edital_id text, vigente boolean, ativo boolean
);
create table public."TB_CANDIDATO_APROVADO" (
  id uuid primary key default gen_random_uuid(), lista_id uuid, nome text, cargo text,
  modalidade text, removido_em timestamptz
);

insert into public."TB_AREA" values ('saude-indigena'), ('sede');
insert into public."TB_MONITORAMENTO_INDIGENA" values
  ('${EDITAL_A1}', '01/2026', 'Unidade A', 'saude-indigena', 'N'),
  ('${EDITAL_A2}', '02/2026', 'Unidade B', 'saude-indigena', 'N'),
  ('${EDITAL_TREINO}', '99/2026', 'Treino', 'saude-indigena', 'S'),
  ('${EDITAL_SEM_LISTA}', '03/2026', 'Sem lista', 'saude-indigena', 'N'),
  ('${EDITAL_B}', '10/2026', 'Sede', 'sede', 'N');
`;

  async function montarBancoComLista(): Promise<PGlite> {
    const db = await PGlite.create();
    await db.exec(INFRAESTRUTURA);
    const lista = async (edital: string, vigente = true) =>
      (
        await db.query<{ id: string }>(
          `insert into public."TB_LISTA_APROVADO" (edital_id, vigente, ativo) values ($1, $2, true) returning id`,
          [edital, vigente],
        )
      ).rows[0]?.id;
    const candidatos = async (
      listaId: string | undefined,
      n: number,
      cargo: string,
      modalidade: string,
      removido = false,
    ) =>
      db.query(
        `insert into public."TB_CANDIDATO_APROVADO" (lista_id, nome, cargo, modalidade, removido_em)
       select $1, 'Pessoa ' || g, $2, $3, case when $4 then now() end from generate_series(1, $5) g`,
        [listaId, cargo, modalidade, removido, n],
      );
    const a1 = await lista(EDITAL_A1);
    await candidatos(a1, 6, "Enfermeiro", "Ampla concorrência");
    await candidatos(a1, 3, " Enfermeiro ", "Pessoas pretas e pardas");
    await candidatos(a1, 2, "Médico", "Ampla concorrência");
    await candidatos(a1, 4, "Médico", "Ampla concorrência", true); // removidos
    const antiga = await lista(EDITAL_A1, false); // substituída: não conta
    await candidatos(antiga, 50, "Enfermeiro", "Ampla concorrência");
    const a2 = await lista(EDITAL_A2);
    await candidatos(a2, 5, "Técnico", "Ampla concorrência");
    await candidatos(await lista(EDITAL_TREINO), 7, "Treino", "Ampla");
    await candidatos(await lista(EDITAL_B), 8, "Analista", "Ampla");
    return db;
  }

  const bancoComLista = moldeDeBanco(montarBancoComLista);

  async function como(
    db: PGlite,
    {
      uid = USUARIO,
      nivel = 1,
      areas = "saude-indigena",
      visiveis = "",
    }: { uid?: string; nivel?: number; areas?: string; visiveis?: string } = {},
  ) {
    await db.query(
      `select set_config('teste.uid', $1, false), set_config('teste.nivel', $2, false),
            set_config('teste.areas', $3, false), set_config('teste.visiveis', $4, false)`,
      [uid, String(nivel), areas, visiveis],
    );
  }

  type Pedido = {
    area?: string;
    formato?: string;
    editais?: string[];
    cargos?: string[];
    modalidades?: string[];
    situacoes?: string[];
    aviso?: boolean;
    total?: number | null;
    registros?: number | null;
  };
  const registrar = (db: PGlite, p: Pedido = {}) =>
    db.query<{
      r: {
        exportacao_id: string;
        emitida_em: string;
        recorte: number;
        registros: number;
      };
    }>(
      `select public.registrar_exportacao_aprovados($1, $2, $3::uuid[], $4, $5, $6, $7, $8, $9) as r`,
      [
        p.area ?? "saude-indigena",
        p.formato ?? "XLSX",
        p.editais ?? [EDITAL_A1, EDITAL_A2],
        p.cargos ?? [],
        p.modalidades ?? [],
        p.situacoes ?? [],
        p.aviso ?? false,
        p.total === undefined ? 16 : p.total,
        p.registros === undefined ? (p.total ?? 16) : p.registros,
      ],
    );

  describe("registrar_exportacao_aprovados (PGlite)", () => {
    let db: PGlite;
    /*
    A primeira chamada monta o molde do banco (lenta com a suíte em carga):
    fica aqui, com prazo próprio, fora do prazo de 10 s do beforeEach.
  */
    beforeAll(() => bancoComLista(), 60_000);
    beforeEach(async () => {
      db = await bancoComLista();
      await db.exec(MIGRATION);
      await como(db);
    });

    it("registra a exportação com o total da lista vigente contado no banco", async () => {
      const { rows } = await registrar(db, { formato: "csv" });
      const r = rows[0]?.r;
      expect(r?.recorte).toBe(16);
      expect(r?.registros).toBe(16);
      expect(r?.exportacao_id).toMatch(/^[0-9a-f-]{36}$/);
      expect(r?.emitida_em).toBeTruthy();
      const linha = await uma<Record<string, unknown>>(
        db,
        `select "CO_AREA", "TP_FORMATO", "DS_FILTRO", "QT_EDITAL", "QT_RECORTE", "QT_REGISTRO",
              "CO_USUARIO", "NO_USUARIO" from public."TL_EXPORTACAO_APROVADO"`,
      );
      expect(linha).toEqual({
        CO_AREA: "saude-indigena",
        TP_FORMATO: "CSV",
        DS_FILTRO: {
          editais: [EDITAL_A1, EDITAL_A2],
          cargos: [],
          modalidades: [],
          situacoes: [],
          recorte_do_aviso: false,
        },
        QT_EDITAL: 2,
        QT_RECORTE: 16,
        QT_REGISTRO: 16,
        CO_USUARIO: USUARIO,
        NO_USUARIO: "Pessoa de Teste",
      });
    });

    it("aplica cargo e modalidade no banco (sem espaço nas pontas) e aceita zero registros", async () => {
      const enf = await registrar(db, { cargos: ["Enfermeiro"], total: 9 });
      expect(enf.rows[0]?.r.recorte).toBe(9);
      const ppp = await registrar(db, {
        cargos: ["Enfermeiro"],
        modalidades: ["Pessoas pretas e pardas"],
        total: 3,
      });
      expect(ppp.rows[0]?.r.recorte).toBe(3);
      const nada = await registrar(db, {
        cargos: ["Cargo que não existe"],
        total: 0,
      });
      expect(nada.rows[0]?.r.recorte).toBe(0);
    });

    it("com situação ou recorte do aviso, os registros podem ser menos que o recorte, nunca mais", async () => {
      const parte = await registrar(db, {
        situacoes: ["Contratado", "__sem_status__"],
        registros: 4,
      });
      expect(parte.rows[0]?.r.registros).toBe(4);
      const aviso = await registrar(db, { aviso: true, registros: 1 });
      expect(aviso.rows[0]?.r.registros).toBe(1);
      expect(
        await erroDe(
          registrar(db, { situacoes: ["Contratado"], registros: 17 }),
        ),
      ).toMatchObject({
        codigo: "22023",
      });
      expect(await erroDe(registrar(db, { registros: 15 }))).toMatchObject({
        codigo: "22023",
      });
    });

    it("recusa quando a tela tem outro total (lista mudou)", async () => {
      const erro = await erroDe(registrar(db, { total: 15 }));
      expect(erro?.codigo).toBe("40001");
      expect(erro?.mensagem).toContain("15 na tela, 16 no banco");
      expect(
        (
          await uma<{ n: number }>(
            db,
            `select count(*)::int n from public."TL_EXPORTACAO_APROVADO"`,
          )
        )?.n,
      ).toBe(0);
    });

    it("confere sessão, perfil e área", async () => {
      await como(db, { uid: "" });
      expect((await erroDe(registrar(db)))?.codigo).toBe("28000");
      await como(db, { nivel: 0 });
      expect((await erroDe(registrar(db)))?.codigo).toBe("42501");
      await como(db, { areas: "sede" });
      expect((await erroDe(registrar(db)))?.codigo).toBe("42501");
      await como(db);
      expect(
        (await erroDe(registrar(db, { area: "nao-existe" })))?.codigo,
      ).toBe("22023");
    });

    it("não aceita edital de outra área, sem lista vigente, de treinamento ou fora da coordenação", async () => {
      for (const editais of [
        [EDITAL_A1, EDITAL_B],
        [EDITAL_SEM_LISTA],
        [EDITAL_TREINO],
        ["c0000000-0000-0000-0000-000000000000"],
      ])
        expect((await erroDe(registrar(db, { editais })))?.codigo).toBe(
          "42501",
        );
      await como(db, { visiveis: `{${EDITAL_A2}}` });
      expect((await erroDe(registrar(db)))?.codigo).toBe("42501");
      const so = await registrar(db, { editais: [EDITAL_A2], total: 5 });
      expect(so.rows[0]?.r.recorte).toBe(5);
    });

    it("valida formato, situação, quantidades e tamanho dos filtros", async () => {
      const casos: Pedido[] = [
        { formato: "XLS" },
        { formato: "" },
        { situacoes: ["Aprovado"] },
        { editais: [] },
        { total: null },
        { registros: -1 },
        { cargos: ["x".repeat(301)] },
        { cargos: Array.from({ length: 1001 }, (_, i) => `Cargo ${i}`) },
      ];
      for (const caso of casos)
        expect(
          (await erroDe(registrar(db, caso)))?.codigo,
          JSON.stringify(caso).slice(0, 80),
        ).toBe("22023");
    });

    it("deixa a tabela fechada para o app e a RPC só para authenticated", async () => {
      const r = await uma<Record<string, boolean>>(
        db,
        `select has_table_privilege('authenticated', 'public."TL_EXPORTACAO_APROVADO"', 'select') as ler,
              has_table_privilege('authenticated', 'public."TL_EXPORTACAO_APROVADO"', 'insert') as gravar,
              has_function_privilege('anon', 'public.registrar_exportacao_aprovados(text, text, uuid[], text[], text[], text[], boolean, integer, integer)', 'execute') as anon,
              has_function_privilege('authenticated', 'public.registrar_exportacao_aprovados(text, text, uuid[], text[], text[], text[], boolean, integer, integer)', 'execute') as autenticado,
              (select relrowsecurity from pg_class where oid = 'public."TL_EXPORTACAO_APROVADO"'::regclass) as rls`,
      );
      expect(r).toEqual({
        ler: false,
        gravar: false,
        anon: false,
        autenticado: true,
        rls: true,
      });
    });
  });
});

bloco("kpis-das-entrevistas-em-grade", () => {
  /*
  Os KPIs da tela de Entrevistas em grade equilibrada. Eram oito cards numa
  grade de sete colunas a partir de 1380px: sete na primeira linha e o
  último sozinho na segunda (11/11/2026). O jsdom não mede layout, então o
  teste confere no CSS de origem que cada corte da grade divide os oito
  cards por igual: 8 numa linha, 4 × 2 no meio e as 2 colunas de src/ui/ no
  celular.
*/

  const ler = (caminho: string) =>
    readFileSync(caminho, "utf8")
      .replace(/\r\n/g, "\n")
      .replace(/\/\*[\s\S]*?\*\//g, "");

  /** Colunas de `seletor` em cada `@media` (a condição como está no CSS). */
  function colunasPorMedia(css: string, seletor: string): Map<string, number> {
    const colunas = new Map<string, number>();
    for (const media of css.matchAll(/@media([^{]+)\{/g)) {
      // O corpo do @media vai até a chave que fecha a dele.
      let nivel = 1;
      let fim = (media.index ?? 0) + media[0].length;
      while (nivel > 0 && fim < css.length) {
        if (css[fim] === "{") nivel += 1;
        if (css[fim] === "}") nivel -= 1;
        fim += 1;
      }
      const corpo = css.slice((media.index ?? 0) + media[0].length, fim - 1);
      for (const [, seletores = "", declaracoes = ""] of corpo.matchAll(
        /([^{}]+)\{([^{}]*)\}/g,
      )) {
        const lista = seletores.split(",").map((s) => s.trim());
        const repeticao = /grid-template-columns:\s*repeat\((\d+),/.exec(
          declaracoes,
        );
        if (lista.includes(seletor) && repeticao)
          colunas.set(
            (media[1] ?? "").replace(/\s+/g, " ").trim(),
            Number(repeticao[1]),
          );
      }
    }
    return colunas;
  }

  /** Quantos <Kpi> a grade de Indicadores das Entrevistas monta. */
  function kpisDaGrade(): number {
    const jsx = ler("src/modulos/entrevistas/paineis.tsx");
    const grade =
      /<GradeDeKpis[\s\S]*?className="entrevistas-kpis"[\s\S]*?<\/GradeDeKpis>/.exec(
        jsx,
      );
    return grade ? (grade[0].match(/<Kpi\b/g) || []).length : 0;
  }

  describe("KPIs das Entrevistas em grade equilibrada", () => {
    const css = ler("src/modulos/entrevistas/entrevistas.css");
    const colunas = colunasPorMedia(css, ".entrevistas-kpis");
    const total = kpisDaGrade();

    it("monta os oito indicadores", () => {
      expect(total).toBe(8);
    });

    it("põe os oito numa fileira só em tela larga", () => {
      expect(colunas.get("(min-width: 1380px)")).toBe(total);
    });

    it("faz 4 × 2 nas telas médias, sem buraco entre o celular e a tela larga", () => {
      expect(colunas.get("(min-width: 641px) and (max-width: 1379px)")).toBe(4);
    });

    it("no celular, fica com as duas colunas de src/ui/", () => {
      const ui = ler("src/ui/ui.css");
      expect(colunasPorMedia(ui, ".ui-kpis").get("(max-width: 640px)")).toBe(2);
    });

    it("nenhum corte deixa um card sozinho na última linha", () => {
      expect(colunas.size).toBeGreaterThan(0);
      for (const [condicao, n] of colunas)
        expect({ condicao, sobra: total % n }).toEqual({ condicao, sobra: 0 });
    });
  });
});

bloco("lib/agenda-das-entrevistas", () => {
  /*
  O motor da agenda das entrevistas (src/lib/entrevistas/agenda-das-entrevistas.ts):
  dias da regra, horários (duração, intervalo, pausa, reserva), distribuição
  pelas bancas, ordem dos candidatos, agrupar por cargo, o aviso de que não
  cabe ou de que sobra muito, e o ajuste manual com conflitos.
*/

  const regra = (campos = {}) => ({
    datas: {
      modo: "INTERVALO",
      inicio: "2026-10-09", // sexta
      fim: "2026-10-13", // terça
      so_dias_uteis: true,
    },
    periodos: [{ inicio: "08:00", fim: "10:00" }],
    duracao_min: 30,
    intervalo_min: 0,
    bancas: 1,
    ...campos,
  });

  const c = (
    n: number,
    campos: Partial<ConvocadoDaAgenda> = {},
  ): ConvocadoDaAgenda => ({
    analiseId: `a${n}`,
    nome: `Candidato ${n}`,
    vaga: "V1",
    cargo: "Enfermeiro",
    posicao: n,
    modalidades: ["AC"],
    ...campos,
  });

  describe("regra da agenda: dias e validação", () => {
    it("intervalo com dias úteis pula sábado e domingo; feriado excluído sai", () => {
      expect(diasDaRegra(regra())).toEqual([
        "2026-10-09",
        "2026-10-12",
        "2026-10-13",
      ]);
      expect(
        diasDaRegra(
          regra({
            datas: { ...regra().datas, excluir: ["2026-10-12"] },
          }),
        ),
      ).toEqual(["2026-10-09", "2026-10-13"]);
      expect(
        diasDaRegra(
          regra({ datas: { ...regra().datas, so_dias_uteis: false } }),
        ),
      ).toHaveLength(5);
    });

    it("lista de dias aceita dd/mm/aaaa e ISO, sem repetir, e acusa os inválidos", () => {
      expect(lerDias("06/10/2026, 2026-10-05 6/10/2026 31/02/2026")).toEqual({
        dias: ["2026-10-05", "2026-10-06"],
        invalidos: ["31/02/2026"],
      });
      expect(
        diasDaRegra({ datas: { modo: "LISTA", dias: ["2026-10-10"] } }),
      ).toEqual(["2026-10-10"]);
    });

    it("recusa período invertido ou sobreposto, pausa invertida, duração e bancas fora dos limites", () => {
      expect(validarRegraDaAgenda(regra())).toEqual([]);
      const erros = validarRegraDaAgenda(
        regra({
          periodos: [
            { inicio: "08:00", fim: "12:00" },
            { inicio: "11:00", fim: "13:00" },
          ],
          pausa: { inicio: "13:00", fim: "12:00" },
          duracao_min: 2,
          bancas: 30,
        }),
      );
      expect(erros).toEqual([
        "Os períodos não podem se sobrepor.",
        "Duração de cada entrevista entre 5 e 240 minutos.",
        "A pausa precisa de início antes do fim (HH:MM).",
        "De 1 a 20 bancas simultâneas.",
      ]);
      expect(validarRegraDaAgenda({ datas: { modo: "INTERVALO" } })[0]).toBe(
        "Informe a data de início e a de fim.",
      );
    });

    it("normaliza o que falta com os padrões e fixa o fuso de Brasília", () => {
      const r = normalizarRegraDaAgenda({ ordem: "INVENTADA", fuso: "UTC" });
      expect(r.ordem).toBe("CLASSIFICACAO");
      expect(r.fuso).toBe("America/Sao_Paulo");
      expect(r.periodos).toEqual([
        { inicio: "08:00", fim: "12:00" },
        { inicio: "14:00", fim: "18:00" },
      ]);
    });
  });

  describe("horários: duração, intervalo, pausa e reserva", () => {
    it("de duração + intervalo em duração + intervalo, sem passar do fim do período", () => {
      const h = horariosDaRegra(
        regra({
          datas: { modo: "LISTA", dias: ["2026-10-13"] },
          duracao_min: 40,
          intervalo_min: 10,
        }),
      );
      expect(h.map((x) => `${x.inicio}-${x.fim}`)).toEqual([
        "08:00-08:40",
        "08:50-09:30",
      ]);
    });

    it("a pausa não recebe entrevista: a próxima começa no fim dela", () => {
      const h = horariosDaRegra(
        regra({
          datas: { modo: "LISTA", dias: ["2026-10-13"] },
          periodos: [{ inicio: "11:00", fim: "14:00" }],
          duracao_min: 45,
          pausa: { inicio: "12:00", fim: "13:00" },
        }),
      );
      expect(h.map((x) => x.inicio)).toEqual(["11:00", "13:00"]);
    });

    it("reservar o primeiro horário marca o primeiro de cada período, que não é distribuído", () => {
      const r = regra({
        datas: { modo: "LISTA", dias: ["2026-10-13"] },
        periodos: [
          { inicio: "08:00", fim: "09:00" },
          { inicio: "14:00", fim: "15:00" },
        ],
        reservar_primeiro_horario: true,
      });
      expect(
        horariosDaRegra(r)
          .filter((h) => h.reservado)
          .map((h) => h.inicio),
      ).toEqual(["08:00", "14:00"]);
      const { itens } = gerarAgenda([c(1), c(2), c(3)], r);
      expect(itens.map((i) => i.inicio)).toEqual(["08:30", "14:30"]);
    });
  });

  describe("distribuição pelas bancas", () => {
    it("no mesmo horário, banca 1, banca 2…; depois o próximo horário e o próximo dia", () => {
      const { itens, totais } = gerarAgenda(
        [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => c(n)),
        regra({ bancas: 2 }),
      );
      expect(
        itens.slice(0, 4).map((i) => [i.analiseId, i.data, i.inicio, i.banca]),
      ).toEqual([
        ["a1", "2026-10-09", "08:00", 1],
        ["a2", "2026-10-09", "08:00", 2],
        ["a3", "2026-10-09", "08:30", 1],
        ["a4", "2026-10-09", "08:30", 2],
      ]);
      expect(itens[8]).toMatchObject({
        data: "2026-10-12",
        inicio: "08:00",
        banca: 1,
        origem: "GERADA",
        fim: "08:30",
      });
      expect(totais).toMatchObject({
        convocados: 9,
        comHorario: 9,
        semHorario: 0,
        lugares: 24,
        diasNecessarios: 2,
      });
    });

    it("não cabe: avisa quantos ficaram sem horário e quanto tempo falta", () => {
      const r = regra({
        datas: { modo: "LISTA", dias: ["2026-10-13"] },
        intervalo_min: 10,
        bancas: 2,
      });
      // 08:00, 08:40, 09:20 → 3 horários × 2 bancas = 6 lugares.
      const res = gerarAgenda(
        [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => c(n)),
        r,
      );
      expect(res.semHorario.map((x) => x.analiseId)).toEqual([
        "a7",
        "a8",
        "a9",
      ]);
      expect(res.totais.faltaMin).toBe(80);
      expect(res.avisos).toEqual([
        expect.objectContaining({
          codigo: "NAO_CABE",
          texto:
            "3 convocados ficaram sem horário: faltam cerca de 1 h 20 min de entrevistas com 2 bancas. Acrescente dias, períodos ou bancas.",
        }),
      ]);
    });

    it("sobra muito: avisa os horários livres e quantos dias bastam", () => {
      const res = gerarAgenda([c(1), c(2)], regra());
      expect(res.avisos[0]).toMatchObject({
        codigo: "SOBRA",
        texto: "Sobram 10 horários livres: bastam 1 dos 3 dias.",
      });
    });
  });

  describe("ordem dos candidatos e agrupar por cargo", () => {
    const lista = [
      c(2, { nome: "Zeca", vaga: "V2", cargo: "Médico", modalidades: ["PP"] }),
      c(1, { nome: "Ana", vaga: "V2", cargo: "Médico" }),
      c(1, {
        analiseId: "b1",
        nome: "Bruno",
        vaga: "V1",
        cargo: "Enfermeiro",
        modalidades: ["PCD"],
      }),
      c(2, { analiseId: "b2", nome: "Ícaro", vaga: "V1", cargo: "Enfermeiro" }),
    ];
    const ordem = (o: string, extra: Record<string, unknown> = {}) =>
      ordenarConvocados(lista, { ordem: o, ...extra }).map((x) => x.nome);

    it("classificação: posição em todas as vagas, empate pela ordem da lista", () => {
      expect(ordem("CLASSIFICACAO")).toEqual(["Ana", "Bruno", "Zeca", "Ícaro"]);
    });
    it("vaga/cargo: pelo código da vaga e depois a posição", () => {
      expect(ordem("VAGA")).toEqual(["Bruno", "Ícaro", "Ana", "Zeca"]);
    });
    it("alfabética, sem diferenciar acentos", () => {
      expect(ordem("ALFABETICA")).toEqual(["Ana", "Bruno", "Ícaro", "Zeca"]);
    });
    it("modalidade: ampla primeiro, depois as cotas em ordem alfabética", () => {
      expect(ordem("MODALIDADE")).toEqual(["Ana", "Ícaro", "Bruno", "Zeca"]);
    });
    it("agrupar por cargo junta o cargo inteiro antes do próximo, na ordem escolhida", () => {
      expect(ordem("CLASSIFICACAO", { agrupar_por_cargo: true })).toEqual([
        "Ana",
        "Zeca",
        "Bruno",
        "Ícaro",
      ]);
    });
    it("com bancas, um cargo novo começa num horário novo", () => {
      const { itens } = gerarAgenda(
        [
          c(1, { cargo: "Médico" }),
          c(2, { analiseId: "e1", cargo: "Enfermeiro" }),
          c(3, { analiseId: "e2", cargo: "Enfermeiro" }),
        ],
        regra({ bancas: 2, agrupar_por_cargo: true }),
      );
      expect(itens.map((i) => [i.analiseId, i.inicio, i.banca])).toEqual([
        ["a1", "08:00", 1],
        ["e1", "08:30", 1],
        ["e2", "08:30", 2],
      ]);
    });
  });

  describe("convocados da lista de convocação", () => {
    it("lê o retrato (analise_id) e o resultado do motor (analiseId), sem repetir o cotista", () => {
      const retrato = {
        vagas: [
          {
            codigo: "169681",
            cargo: "Cirurgião Dentista",
            geral: [
              {
                analise_id: "x1",
                nome: "Ana",
                posicao: 1,
                modalidades: ["AC"],
              },
            ],
            listas: {
              PP: [
                { analise_id: "x1", nome: "Ana", posicao: 1 },
                {
                  analise_id: "x2",
                  nome: "Caio",
                  posicao: 1,
                  modalidades: ["PP"],
                },
              ],
            },
          },
        ],
      };
      expect(
        convocadosDaLista(retrato).map((x) => [x.analiseId, x.vaga]),
      ).toEqual([
        ["x1", "169681"],
        ["x2", "169681"],
      ]);
      const resultado = {
        vagas: [
          {
            codigo: "1",
            geral: [{ analiseId: "y1", nome: "Bia", posicao: 1 }],
            porModalidade: {},
          },
        ],
      };
      expect(convocadosDaLista(resultado)[0]?.analiseId).toBe("y1");
    });
  });

  describe("ajuste manual e conflitos", () => {
    const r = regra({ bancas: 2 });
    const base = () => gerarAgenda([c(1), c(2), c(3)], r).itens;

    it("mover para um horário livre vira ajuste manual; tirar o horário deixa sem horário", () => {
      const livre = horariosLivres(base(), r)[0];
      expect(livre).toMatchObject({
        data: "2026-10-09",
        inicio: "08:30",
        banca: 2,
      });
      const movido = moverNaAgenda(base(), "a1", definido(livre));
      expect(movido[0]).toMatchObject({
        inicio: "08:30",
        banca: 2,
        origem: "MANUAL",
      });
      expect(temAjusteManual(movido)).toBe(true);
      expect(temAjusteManual(base())).toBe(false);
      expect(itensParaSalvar(moverNaAgenda(base(), "a1", null))).toHaveLength(
        2,
      );
    });

    it("trocar dois de lugar troca horário e banca, os dois como manuais", () => {
      const trocado = trocarNaAgenda(base(), "a1", "a3");
      expect(trocado.find((i) => i.analiseId === "a1")).toMatchObject({
        inicio: "08:30",
        banca: 1,
        origem: "MANUAL",
      });
      expect(trocado.find((i) => i.analiseId === "a3")).toMatchObject({
        inicio: "08:00",
        banca: 1,
        origem: "MANUAL",
      });
      expect(conflitosDaAgenda(trocado)).toEqual([]);
    });

    it("acusa mesma banca e horário sobreposto, e candidato repetido", () => {
      const itens = moverNaAgenda(base(), "a3", {
        data: "2026-10-09",
        inicio: "08:15",
        fim: "08:45",
        banca: 1,
      });
      const conflitos = conflitosDaAgenda(
        [...itens, { ...definido(itens[1]) }],
        {
          nomes_das_bancas: ["Sala A"],
        },
      );
      expect(conflitos.map((x) => x.tipo).sort()).toEqual([
        "HORARIO",
        "REPETIDO",
      ]);
      expect(conflitos.find((x) => x.tipo === "HORARIO")?.texto).toBe(
        "Candidato 1 e Candidato 3: Sala A, 09/10/2026, 08:00.",
      );
    });

    it("acusa a entrevista longa que cobre outras além da vizinha", () => {
      const item = (n: number, inicio: string, fim: string): ItemDaAgenda => ({
        ...c(n),
        data: "2026-10-09",
        inicio,
        fim,
        banca: 1,
        origem: "GERADA",
      });
      const conflitos = conflitosDaAgenda([
        item(1, "08:00", "10:00"),
        item(2, "08:30", "08:45"),
        item(3, "09:00", "09:30"),
        item(4, "10:00", "10:30"),
      ]);
      expect(conflitos.map((x) => x.ids)).toEqual([
        ["a1", "a2"],
        ["a1", "a3"],
      ]);
    });

    it("o mapa do documento traz data, hora e banca por análise", () => {
      expect(agendaPorCandidato(base()).get("a2")).toEqual({
        data: "2026-10-09",
        inicio: "08:00",
        fim: "08:30",
        banca: 2,
      });
    });

    it("a agenda salva se junta à lista atual; quem saiu da lista fica marcado", () => {
      const salvos: ItemDaAgenda[] = [
        {
          ...c(1),
          data: "2026-10-09",
          inicio: "08:00",
          fim: "08:30",
          banca: 1,
          origem: "MANUAL",
        },
        {
          ...c(9),
          analiseId: "zz",
          nome: "Fora",
          data: "2026-10-09",
          inicio: "09:00",
          fim: "09:30",
          banca: 1,
          origem: "GERADA",
        },
      ];
      const itens = juntarComConvocados(salvos, [c(1), c(2)]);
      expect(
        itens.map((i) => [i.analiseId, i.inicio, Boolean(i.foraDaLista)]),
      ).toEqual([
        ["a1", "08:00", false],
        ["a2", null, false],
        ["zz", "09:00", true],
      ]);
      expect(itens[0]?.origem).toBe("MANUAL");
    });
  });

  describe("exportação", () => {
    it("planilha por dia, hora e banca, com o nome da banca e quem ficou sem horário no fim", () => {
      const itens = moverNaAgenda(
        gerarAgenda([c(1), c(2)], regra({ bancas: 2 })).itens,
        "a1",
        null,
      );
      const linhas = linhasDaAgenda(itens, {
        nomes_das_bancas: ["", "Sala B"],
      });
      expect(linhas[0]?.[2]).toBe("Início (Brasília)");
      expect(linhas[1]).toEqual([
        "09/10/2026",
        "sex",
        "08:00",
        "08:30",
        "Sala B",
        "Candidato 2",
        "V1",
        "Enfermeiro",
        "AC",
        "Gerada",
      ]);
      expect(linhas[2]?.[0]).toBe("Sem horário");
      const bytes = gerarXlsxDaAgenda(itens);
      expect(bytes[0]).toBe(0x50);
      expect(bytes[1]).toBe(0x4b);
    });

    it("duração por extenso", () => {
      expect(textoDaDuracao(45)).toBe("45 min");
      expect(textoDaDuracao(120)).toBe("2 h");
      expect(textoDaDuracao(150)).toBe("2 h 30 min");
    });
  });

  describe("agenda do dia (Entrevistas)", () => {
    it("hoje é o dia de Brasília, mesmo de madrugada em UTC", async () => {
      const { hojeEmBrasilia } =
        await import("../src/lib/entrevistas/agenda-das-entrevistas.ts");
      expect(hojeEmBrasilia(new Date("2026-10-06T02:30:00Z"))).toBe(
        "2026-10-05",
      );
    });

    it("abre em hoje, ou no próximo dia com entrevista, ou no último", async () => {
      const { diaInicialDaAgenda } =
        await import("../src/lib/entrevistas/agenda-das-entrevistas.ts");
      const dias = ["2026-10-08", "2026-10-06", "2026-10-06"];
      expect(diaInicialDaAgenda(dias, "2026-10-06")).toBe("2026-10-06");
      expect(diaInicialDaAgenda(dias, "2026-10-07")).toBe("2026-10-08");
      expect(diaInicialDaAgenda(dias, "2026-10-09")).toBe("2026-10-08");
      expect(diaInicialDaAgenda([], "2026-10-09")).toBe("");
    });
  });
});

bloco("lib/aprovados-colunas-e-acoes-da-linha", () => {
  /*
    Lista de aprovados, revisão de 17/11/2026: código da vaga, cargo, lotação e
    edital em colunas próprias (ordenáveis) e as ações da linha como uma
    principal com nome + "Mais ações". Dados fictícios.
  */
  const EDITOR = { permissoes: { aprovados: "editor" } };
  const LEITOR = { permissoes: { aprovados: "leitor" } };
  const ADMIN = { perfil: "admin" };

  const linha = (extra: Record<string, unknown> = {}) => ({
    candidato_id: "c1",
    nome: "Pessoa Fictícia",
    edital_id: "00000000-0000-4000-8000-000000000093",
    edital: "93/2026",
    unidade: "DSEI Exemplo",
    cargo: "Enfermeiro - Pacaraima/RR - 2 vagas",
    codigo_vaga: "179698",
    lista_ativa: true,
    status: "",
    ...extra,
  });

  describe("cargo e lotação em colunas separadas", () => {
    it("o cargo é o primeiro trecho; a lotação, o lugar", () => {
      const cargo =
        "Técnico de Enfermagem - Polo Base Exemplo - Cadastro Reserva";
      expect(cargoDaVaga(cargo)).toBe("Técnico de Enfermagem");
      expect(localidadeDoCargo(cargo)).toBe("Polo Base Exemplo");
      expect(cargoDaVaga("Analista")).toBe("Analista");
      expect(localidadeDoCargo("Analista")).toBe("");
    });

    it("vaga, lotação e edital ordenam", () => {
      const linhas = [
        linha({
          candidato_id: "a",
          codigo_vaga: "300",
          cargo: "X - Sede/DF",
          edital: "95/2026",
        }),
        linha({
          candidato_id: "b",
          codigo_vaga: "100",
          cargo: "X - Aldeia Alfa",
          edital: "93/2026",
        }),
        linha({
          candidato_id: "c",
          codigo_vaga: "200",
          cargo: "X",
          edital: "94/2026",
        }),
      ];
      const ids = (chave: "vaga" | "lotacao" | "edital") =>
        ordenarAprovados(linhas, { chave, sentido: "asc" }).map(
          (l) => l.candidato_id,
        );
      expect(ids("vaga")).toEqual(["b", "c", "a"]);
      // Sem lotação vai para o fim.
      expect(ids("lotacao")).toEqual(["b", "a", "c"]);
      expect(ids("edital")).toEqual(["b", "c", "a"]);
    });
  });

  describe("ações da linha: principal com nome e Mais ações", () => {
    it("quem edita: Mudar status à vista; o resto no menu", () => {
      const { principal, outras } = acoesDaLinhaDoAprovado(EDITOR, linha(), 2);
      expect(principal).toEqual({ id: "status", rotulo: "Mudar status" });
      expect(outras.map((a) => a.rotulo)).toEqual([
        "Ver detalhes",
        "Ver anexos (2)",
        "Carta de convocação",
        "Ver na Classificação",
      ]);
    });

    it("quem só lê: Abrir, e Ver na Classificação no menu", () => {
      const { principal, outras } = acoesDaLinhaDoAprovado(LEITOR, linha());
      expect(principal.rotulo).toBe("Abrir");
      expect(outras.map((a) => a.id)).toEqual(["classificacao"]);
    });

    it("status travado: aparece apagado, com o motivo", () => {
      const { principal, outras } = acoesDaLinhaDoAprovado(
        EDITOR,
        linha({ status: "Contratado" }),
      );
      expect(principal.id).toBe("candidato");
      expect(outras[0]).toEqual({
        id: "status",
        rotulo: "Mudar status (status já definido: só o admin altera)",
        desabilitado: true,
      });
    });

    it("o admin tem a decisão judicial e, no sub judice, remover", () => {
      const { outras } = acoesDaLinhaDoAprovado(
        ADMIN,
        linha({ sub_judice: true }),
      );
      expect(outras.map((a) => a.id)).toEqual(
        expect.arrayContaining(["alteracao-judicial", "remove-subjudice"]),
      );
    });
  });
});

bloco("lib/aprovados-ativos-e-historico", () => {
  /*
    Ativos (a lista de trabalho): edital vigente e lista ativa. Histórico: o
    edital concluído, cancelado ou desativado e a lista inativa.
  */
  const LINHAS = [
    { id: "e1", status: "Em andamento" },
    { id: "e2", status: "Concluído" },
    { id: "e3", status: "Em andamento", ativo: false },
    { id: "e4", status: "Suspenso" },
  ];
  const LISTAS = [
    { edital_id: "e1", ativo: true },
    { edital_id: "e2", ativo: true },
    { edital_id: "e3", ativo: true },
    { edital_id: "e4", ativo: false },
    { edital_id: "e9", ativo: true },
  ];
  const CANDIDATOS = [
    { candidato_id: "a", edital_id: "e1", lista_ativa: true },
    { candidato_id: "b", edital_id: "e2", lista_ativa: true },
    { candidato_id: "c", edital_id: "e3", lista_ativa: true },
    { candidato_id: "d", edital_id: "e4", lista_ativa: false },
    { candidato_id: "e", edital_id: "e9", lista_ativa: true },
  ];

  it("separa por edital vigente e lista ativa, com a contagem por situação", () => {
    const { ativos, historico } = separarAprovados(LISTAS, CANDIDATOS, LINHAS);
    expect(ativos.candidatos.map((c) => c.candidato_id)).toEqual(["a", "e"]);
    expect(ativos.listas.map((l) => l.edital_id)).toEqual(["e1", "e9"]);
    // Edital sem linha do monitoramento conta como vigente (sem situação).
    expect(ativos.editais).toBe(2);
    expect(ativos.situacoes).toEqual([
      { rotulo: "Em andamento", quantos: 1 },
      { rotulo: "Sem situação", quantos: 1 },
    ]);
    // Concluído, desativado e a lista inativa (mesmo de edital Suspenso).
    expect(historico.candidatos.map((c) => c.candidato_id)).toEqual([
      "b",
      "c",
      "d",
    ]);
    expect(historico.editais).toBe(3);
    expect(historico.situacoes.map((s) => s.rotulo).sort()).toEqual([
      "Concluído",
      "Desativado",
      "Suspenso",
    ]);
  });

  it("o pedido abre a vista onde o edital ou a pessoa está", () => {
    const separados = separarAprovados(LISTAS, CANDIDATOS, LINHAS);
    const id = (c: { candidato_id: string }) => c.candidato_id;
    expect(vistaDoPedido(separados, "ativos", { editalIds: ["e2"] }, id)).toBe(
      "historico",
    );
    expect(
      vistaDoPedido(separados, "historico", { editalIds: ["e1"] }, id),
    ).toBe("ativos");
    expect(
      vistaDoPedido(separados, "historico", { candidatoIds: ["d"] }, id),
    ).toBe("historico");
    // Fora das duas, ou sem pedido: fica onde está.
    expect(vistaDoPedido(separados, "ativos", { editalIds: ["x"] }, id)).toBe(
      "ativos",
    );
    expect(vistaDoPedido(separados, "historico", {}, id)).toBe("historico");
  });
});

bloco("lib/casamento-da-lista", () => {
  /* O que `acompanharCasamento` devolve: o casamento ou o erro. */
  type Acompanhamento = { casamento?: CasamentoDaLista; erro?: string };

  /*
  A prévia do casamento da lista de aprovados (migration 20261030090000): a
  conta é do job Python; a tela lê o plano, espera o job e mostra os números.
*/

  const P = "11111111-1111-4111-8111-111111111111";
  const C1 = "22222222-2222-4222-8222-222222222222";
  const C2 = "33333333-3333-4333-8333-333333333333";

  const calculado = (extra = {}) => ({
    pedido_id: P,
    origem: "XLSX",
    situacao: "CALCULADO",
    erro: null,
    disparo: "ACEITO",
    exige_motivo: true,
    pode_substituir: true,
    anteriores: 3,
    novos_total: 3,
    manuais: {},
    plano: {
      versao: 1,
      vinculos: [{ candidato_id: C1, chave: "1", forma: "NOME" }],
      resumo: {
        casados: 1,
        entram: 2,
        sem_par: 2,
        sem_dono: 1,
        preservados: 1,
        mudam: 0,
        sub_judice_mantidos: 1,
        ambiguos: 0,
      },
      pendencias: [
        {
          candidato_id: C2,
          nome: "Paulo",
          status: "Desistente",
          matricula: null,
        },
      ],
      mudam: [],
      revisar: [C2],
    },
    novos: null,
    revisar: [],
    ...extra,
  });

  describe("respostas do banco", () => {
    it("o pedido e o casamento calculado", () => {
      expect(pedidoLido({ pedido_id: P, situacao: "PENDENTE" })).toEqual({
        pedido_id: P,
        situacao: "PENDENTE",
      });
      const c = casamentoLido(calculado());
      expect(definido(c.plano).vinculos).toEqual([
        { candidato_id: C1, chave: "1", forma: "NOME" },
      ]);
      expect(definido(c.plano).pendencias[0]).toMatchObject({
        nome: "Paulo",
        status: "Desistente",
        matricula: "",
      });
      expect(numerosDoCasamento(c)).toEqual({
        casados: 1,
        entram: 2,
        semPar: 2,
        semDono: 1,
        preservados: 1,
        mudam: 0,
        subJudiceMantidos: 1,
      });
    });

    it("recusa o que vem fora do formato", () => {
      expect(() =>
        pedidoLido({ pedido_id: "x", situacao: "PENDENTE" }),
      ).toThrow();
      expect(() => casamentoLido(calculado({ plano: null }))).toThrow();
      expect(() =>
        casamentoLido(
          calculado({
            plano: {
              ...calculado().plano,
              vinculos: [{ candidato_id: C1, chave: "1", forma: "AUTOMATICO" }],
            },
          }),
        ),
      ).toThrow();
      expect(() => casamentoLido(calculado({ situacao: "OUTRA" }))).toThrow();
    });

    it("por que a prévia parou", () => {
      expect(
        textoDoCasamentoParado({
          situacao: "ERRO",
          erro: "A lista mudou.",
          disparo: "",
        }),
      ).toBe("A lista mudou.");
      expect(
        textoDoCasamentoParado({
          situacao: "DESCARTADO",
          erro: "",
          disparo: "",
        }),
      ).toBe("Outra prévia começou depois desta.");
      expect(
        textoDoCasamentoParado({
          situacao: "PENDENTE",
          erro: "",
          disparo: "SEM_TOKEN",
        }),
      ).toContain("não chegou ao GitHub");
    });
  });

  describe("acompanharCasamento", () => {
    const pendente = () => ({
      ...calculado(),
      situacao: "PENDENTE",
      plano: null,
    });

    it("espera o job e devolve o plano", async () => {
      const obter = vi
        .fn()
        .mockResolvedValueOnce(pendente())
        .mockResolvedValueOnce(pendente())
        .mockResolvedValueOnce(calculado());
      const esperar = vi.fn(async () => {});
      const r: Acompanhamento = await acompanharCasamento({
        pedidoId: P,
        obter,
        esperar,
        intervaloMs: 10,
      });
      expect(definido(r.casamento).situacao).toBe("CALCULADO");
      expect(obter).toHaveBeenCalledTimes(3);
      expect(esperar).toHaveBeenCalledWith(10);
    });

    it("o pedido não chegou ao GitHub: para na hora", async () => {
      const obter = vi
        .fn()
        .mockResolvedValue({ ...pendente(), disparo: "SEM_TOKEN" });
      const r: Acompanhamento = await acompanharCasamento({
        pedidoId: P,
        obter,
        esperar: async () => {},
      });
      expect(r.erro).toContain("não chegou ao GitHub");
      expect(obter).toHaveBeenCalledTimes(1);
    });

    it("o prazo passou", async () => {
      let t = 0;
      const r: Acompanhamento = await acompanharCasamento({
        pedidoId: P,
        obter: async () => pendente(),
        esperar: async (ms) => {
          t += ms;
        },
        agora: () => t,
        intervaloMs: 60000,
        prazoMs: 180000,
      });
      expect(r.erro).toBe(
        "O cálculo do casamento não chegou em 3 min. Tente de novo.",
      );
    });

    it("o job deu erro", async () => {
      const r: Acompanhamento = await acompanharCasamento({
        pedidoId: P,
        obter: async () => ({
          ...pendente(),
          situacao: "ERRO",
          erro: "A lista vigente mudou desde o pedido; peça a prévia de novo.",
        }),
        esperar: async () => {},
      });
      expect(r.erro).toContain("A lista vigente mudou");
    });

    it("a tela mudou: para sem aviso", async () => {
      const r: Acompanhamento = await acompanharCasamento({
        pedidoId: P,
        obter: async () => pendente(),
        esperar: async () => {},
        vigente: () => false,
      });
      expect(r).toEqual({ erro: "" });
    });
  });
});

bloco("lib/configuracao-da-convocacao-dados", () => {
  describe("dados da configuração de convocação", () => {
    it.each([
      {},
      [null],
      [{ nome: "Sem identidade" }],
      [{ modelo_id: "m1", categorias: [null] }],
      [{ modelo_id: "m1" }, { modelo_id: "m1" }],
    ])(
      "recusa modelos malformados sem aproveitar só parte da resposta: %j",
      (dados) => {
        expect(() => lerModelosDoBanco(dados)).toThrow(
          /Configuração de convocação inválida/,
        );
      },
    );
    it.each([
      {},
      [null],
      [{ edital_id: "e1", vagas: [null] }],
      [{ edital_id: "e1", vagas: [{ codigo_vaga: "v1", quadro: [] }] }],
      [{ edital_id: "e1" }, { edital_id: "e1" }],
      [
        {
          edital_id: "e1",
          vagas: [{ codigo_vaga: "v1" }, { codigo_vaga: "v1" }],
        },
      ],
    ])("recusa configurações malformadas e chaves duplicadas: %j", (dados) => {
      expect(() => lerConfiguracoesDoBanco(dados)).toThrow(
        /Configuração de convocação inválida/,
      );
    });
    it("mantém mapas vazios para respostas ausentes e aceita listas sem reservas nem vagas", () => {
      expect(lerModelosDoBanco(null).size).toBe(0);
      expect(lerConfiguracoesDoBanco(undefined).size).toBe(0);
      expect(
        definido(
          lerModelosDoBanco([{ modelo_id: "m1", categorias: [] }]).get("m1"),
        ).categorias,
      ).toHaveLength(1);
      expect(
        definido(
          lerConfiguracoesDoBanco([{ edital_id: "e1", vagas: [] }]).get("e1"),
        ).vagas.size,
      ).toBe(0);
    });
    it("uma atualização malformada preserva a configuração anterior e a nova tentativa pode atualizá-la", async () => {
      let modelos: unknown[] = [{ modelo_id: "m1", nome: "Original" }],
        configs: unknown[] = [
          { edital_id: "e1", modelo_id: "m1", padrao_imediata: 2 },
        ];
      const toast = vi.fn();
      const rpc = vi.fn(async (nome: string) => ({
        data: nome === "listar_modelos_convocacao" ? modelos : configs,
        error: null,
      }));
      const estado = criarEstadoDaListaDeAprovados({
        supabase: clienteDosAprovados(rpc),
        toast,
      });
      await estado.carregarConfiguracoes();
      const anterior = estado.obter();
      modelos = [{ modelo_id: "m2", nome: "Novo" }];
      configs = [{ edital_id: "e1", vagas: [null] }];
      await estado.carregarConfiguracoes();
      expect(estado.obter().modelos).toBe(anterior.modelos);
      expect(estado.obter().configs).toBe(anterior.configs);
      expect(toast).toHaveBeenCalledWith(
        expect.stringMatching(/Configuração de convocação inválida/),
        "warn",
      );
      configs = [{ edital_id: "e1", modelo_id: "m2", padrao_imediata: 3 }];
      await estado.carregarConfiguracoes();
      expect(estado.obter().modelos.has("m2")).toBe(true);
      expect(estado.obter().configs.get("e1")?.padraoImediata).toBe(3);
    });
  });
});

bloco("lib/contratado-em-outra-lista", () => {
  /*
  "Contratado em outra lista" (migration 20261024120000): o status explícito
  (fixado pela equipe) e a situação que o job Python decide e o pacote da
  Lista de aprovados traz no dicionário `contratacao`. Dados fictícios.
*/
  const linha = (
    extra: Partial<CandidatoDasRegrasDeAprovados>,
  ): CandidatoDasRegrasDeAprovados => ({
    candidato_id: "c",
    edital_id: "e1",
    status: "Contratado",
    matricula: "M-1",
    ...extra,
  });

  describe("o pacote traz a situação decidida pelo job", () => {
    it("dicionário contratacao vira contratacao_situacao e contratacao_motivo só nas linhas decididas", () => {
      const pacote = {
        colunas: ["candidato_id", "lista_id", "status"],
        colunas_da_lista: ["lista_id", "edital_id"],
        listas: [["L1", "e1"]],
        dicionarios: {
          status: ["Contratado"],
          contratacao: { b: ["OUTRA_LISTA", "Motivo."] },
        },
        linhas: [
          ["a", 0, 0],
          ["b", 0, 0],
        ],
      };
      const [a, b] = expandirCandidatosCompactos(pacote);
      expect(a).not.toHaveProperty("contratacao_situacao");
      expect(b).toMatchObject({
        status: "Contratado",
        contratacao_situacao: "OUTRA_LISTA",
        contratacao_motivo: "Motivo.",
      });
    });
  });

  describe("regras da tela", () => {
    it("o status efetivo: explícito, decidido pelo sistema ou o gravado", () => {
      expect(
        statusEfetivo(linha({ status: "Contratado em outra lista" })),
      ).toBe("Contratado em outra lista");
      expect(
        statusEfetivo(linha({ contratacao_situacao: "OUTRA_LISTA" })),
      ).toBe("Contratado em outra lista");
      expect(statusEfetivo(linha({ contratacao_situacao: "AMBIGUO" }))).toBe(
        "Contratado",
      );
      // Só vale sobre Contratado: com outro status gravado, a decisão antiga não pesa.
      expect(
        statusEfetivo(
          linha({ status: "Desistente", contratacao_situacao: "OUTRA_LISTA" }),
        ),
      ).toBe("Desistente");
    });

    it("não conta nos contratados: tem contagem própria", () => {
      const resumo = summarizeApprovedCandidates([
        linha({ candidato_id: "1" }),
        linha({ candidato_id: "2", contratacao_situacao: "OUTRA_LISTA" }),
        linha({ candidato_id: "3", status: "Contratado em outra lista" }),
      ]);
      expect(resumo).toMatchObject({
        total: 3,
        contratado: 1,
        contratadoEmOutraLista: 2,
      });
    });

    it("o status novo é opção da tela, guarda a matrícula sem exigi-la e tem tom neutro", () => {
      expect(STATUS_DO_CANDIDATO).toContain("Contratado em outra lista");
      expect(statusGuardaMatricula("Contratado em outra lista")).toBe(true);
      expect(tomDoStatus("Contratado em outra lista")).toBe("neutro");
    });

    it("a sugestão acha a mesma matrícula Contratado em outra linha do edital", () => {
      expect(matriculaNormalizada(" 00.12-3a ")).toBe("123A");
      const atual = linha({ candidato_id: "a", status: "" });
      const outras = outrasLinhasContratadasDaMatricula(
        [
          atual,
          linha({ candidato_id: "b", matricula: "0123a" }),
          linha({ candidato_id: "c", matricula: "123A", edital_id: "e2" }),
          linha({ candidato_id: "d", matricula: "123A", status: "Desistente" }),
          linha({
            candidato_id: "e",
            matricula: "123A",
            contratacao_situacao: "OUTRA_LISTA",
          }),
        ],
        atual,
        "123-a",
      );
      expect(outras.map((o) => o.candidato_id)).toEqual(["b"]);
      expect(outrasLinhasContratadasDaMatricula([atual], atual, "")).toEqual(
        [],
      );
    });
  });

  describe("convocação: não ocupa vaga", () => {
    it("explícito ou decidido pelo sistema, sai da fila", () => {
      for (const candidato of [
        linha({ status: "Contratado em outra lista" }),
        linha({ contratacao_situacao: "OUTRA_LISTA" }),
      ]) {
        expect(statusNaFila(candidato)).toBe("Contratado em outra lista");
        expect(estaForaDaFila(candidato)).toBe(true);
        expect(jaFoiChamado(candidato)).toBe(false);
      }
      const contratacao = linha({ contratacao_situacao: "CONTRATACAO" });
      expect(estaForaDaFila(contratacao)).toBe(false);
      expect(jaFoiChamado(contratacao)).toBe(true);
    });
  });
});

bloco("lib/convocacao-sub-judice-por-edital", () => {
  const calcular = (candidatos: CandidatoDaConvocacao[]) =>
    montarListaDeConvocacao(candidatos, () => ({
      modelo: modeloEmBranco(),
      quadro: { ampla: 1 },
    }));
  const candidato = (
    id: string,
    edital: string,
    codigo: string,
    nota = 90,
  ): CandidatoDaConvocacao => ({
    candidato_id: id,
    edital_id: edital,
    edital,
    cargo: "Enfermeiro",
    codigo_vaga: codigo,
    nome: id,
    nota,
    modalidade: "ampla",
    lista_ativa: true,
  });
  describe("vaga do sub judice no próprio edital", () => {
    it("as vagas de outro edital não tornam ambígua a vaga do cargo", () => {
      const grupos = calcular([
        candidato("a", "e1", "v1"),
        candidato("b", "e2", "v2"),
        candidato("sj", "e1", "", 100),
      ]);
      expect(grupos).toHaveLength(2);
      const e1 = definido(grupos.find((g) => g.editalId === "e1"));
      expect(e1.codigoVaga).toBe("v1");
      expect(e1.linhas.map((l) => l.candidato.candidato_id)).toEqual([
        "sj",
        "a",
      ]);
      expect(definido(e1.linhas[0]).imediata).toBe(true);
      expect(
        definido(grupos.find((g) => g.editalId === "e2")).candidatos.map(
          (c) => c.candidato_id,
        ),
      ).toEqual(["b"]);
    });
    it("uma vaga existente só em outro edital não é atribuída ao sub judice", () => {
      const grupos = calcular([
        candidato("a", "e2", "v2"),
        candidato("sj", "e1", ""),
      ]);
      expect(definido(grupos.find((g) => g.editalId === "e1")).codigoVaga).toBe(
        "",
      );
      expect(definido(grupos.find((g) => g.editalId === "e2")).codigoVaga).toBe(
        "v2",
      );
    });
    it("duas vagas do próprio cargo no edital continuam sem escolha automática", () => {
      const grupos = calcular([
        candidato("a", "e1", "v1"),
        candidato("b", "e1", "v2"),
        candidato("sj", "e1", ""),
      ]);
      expect(grupos).toHaveLength(3);
      expect(
        definido(grupos.find((g) => g.codigoVaga === "")).candidatos.map(
          (c) => c.candidato_id,
        ),
      ).toEqual(["sj"]);
    });
  });
});

bloco("lib/dados-da-agenda", () => {
  const base = {
    edital: { id: "A" },
    regra: { versao: 2, configuracao: {} },
    itens: [],
    bancas: [],
    historico: [],
  };
  describe("Dados tipados da agenda", () => {
    it("permissão é booleana e o registro visto é preservado para controle de concorrência", () => {
      expect(
        dadosDaAgenda({ ...base, pode_editar: "false", ultimo_registro: "h1" }),
      ).toMatchObject({
        pode_editar: false,
        ultimo_registro: "h1",
        regra: { versao: 2 },
      });
      expect(dadosDaAgenda({ ...base, pode_editar: true }).pode_editar).toBe(
        true,
      );
    });
    it.each([
      { itens: [null] },
      { itens: [{ analise_id: "" }] },
      { itens: [{ analise_id: "a1", data: "2026-10-14" }] },
      {
        itens: [
          {
            analise_id: "a1",
            data: "2026-10-14",
            inicio: "08:00",
            fim: "08:30",
            banca: "1",
          },
        ],
      },
      { bancas: {} },
      { regra: { versao: 0 } },
    ])("não usa coleções ou horários incompletos (%j)", (extra) => {
      expect(() => dadosDaAgenda({ ...base, ...extra })).toThrow();
    });
    it("não descarta linhas sem identidade para montar uma convocação parcial", () => {
      expect(() =>
        convocadosDaLista({
          vagas: [
            {
              geral: [
                { analise_id: "a1", nome: "Ana" },
                { nome: "Sem identidade" },
              ],
            },
          ],
        }),
      ).toThrow("identificação");
    });
  });
});

bloco("lib/dados-da-publicacao-de-aprovados", () => {
  const vigente = {
    lista_id: "l1",
    origem: "XLSX",
    candidatos: [
      {
        candidato_id: "c1",
        nome: "Ana",
        classificacao: "2",
        status: "Contratado",
        matricula: "M1",
        sub_judice: true,
      },
    ],
  };
  describe("Dados para a publicação de aprovados", () => {
    it("preserva os campos usados na revisão e aceita posição numérica da planilha", () => {
      expect(
        situacaoDaPublicacao({ vigente }).vigente?.candidatos[0],
      ).toMatchObject({
        candidato_id: "c1",
        classificacao: 2,
        status: "Contratado",
        matricula: "M1",
        sub_judice: true,
      });
      expect(situacaoDaPublicacao({ vigente: null })).toEqual({
        vigente: null,
        pode_substituir: true,
      });
      // pode_substituir vem do banco (20261030090000); sem ele, quem barra é o banco.
      expect(
        situacaoDaPublicacao({ vigente: null, pode_substituir: false })
          .pode_substituir,
      ).toBe(false);
    });
    it.each([
      {},
      { vigente: { ...vigente, candidatos: [vigente.candidatos[0], null] } },
      {
        vigente: {
          ...vigente,
          candidatos: [vigente.candidatos[0], vigente.candidatos[0]],
        },
      },
      {
        vigente: {
          ...vigente,
          candidatos: [{ candidato_id: "c1", sub_judice: "false" }],
        },
      },
      { vigente: { ...vigente, lista_id: "" } },
    ])(
      "não transforma dados incompletos em uma revisão parcial (%j)",
      (dados) => {
        expect(() => situacaoDaPublicacao(dados)).toThrow("Recarregue a lista");
      },
    );
    it.each([
      { vagas: [{ geral: {}, listas: {} }] },
      { vagas: [{ geral: [], listas: { PP: "inválida" } }] },
      { vagas: [null] },
    ])("recusa coleções malformadas do retrato (%j)", (retrato) => {
      expect(() => candidatosDaListaFinal(retrato)).toThrow(
        "Dados da publicação inválidos",
      );
    });
    it.each([
      null,
      {},
      { ok: false, candidatos: 3, pendencias: [] },
      { ok: true, candidatos: "3", pendencias: [] },
      { ok: true, candidatos: -1, pendencias: [] },
      { ok: true, candidatos: 3, pendencias: {} },
    ])("não confirma uma resposta de publicação inválida (%j)", (dados) => {
      expect(() => resultadoDaPublicacao(dados)).toThrow();
    });
    it("conserva a quantidade publicada e as pendências informadas pelo banco", () => {
      expect(
        resultadoDaPublicacao({
          ok: true,
          candidatos: 3,
          pendencias: [{ candidato_id: "c2", status: "Desistente" }],
        }),
      ).toEqual({
        candidatos: 3,
        pendencias: [{ candidato_id: "c2", status: "Desistente" }],
      });
    });
  });
});

bloco("lib/exportacao-da-lista-de-aprovados", () => {
  /* Dados fictícios. */
  const REGISTRO: RegistroDaExportacao = {
    id: "0f0e0d0c-0b0a-4000-8000-000000000001",
    emitidaEm: "2026-11-10T17:30:00Z",
  };

  const candidato = (
    id: number,
    extra: Partial<CandidatoDaExportacao> = {},
  ): CandidatoDaExportacao => ({
    candidato_id: `c${id}`,
    edital_id: "e1",
    edital: "01/2026",
    unidade: "Unidade A",
    codigo_vaga: "V01",
    cargo: "Enfermeiro",
    classificacao: id,
    nome: `Pessoa ${id}`,
    modalidade: "Ampla concorrência",
    nota: 80.5,
    status: "",
    ...extra,
  });

  const pedido = (
    candidatos: CandidatoDaExportacao[],
    extra: Partial<PedidoDaExportacao> = {},
  ): PedidoDaExportacao => ({
    area: "saude-indigena",
    rotuloDaArea: "Saúde Indígena",
    candidatos,
    totalDoRecorte: candidatos.length,
    editais: [{ id: "e1", rotulo: "01/2026 · Unidade A" }],
    todosOsEditais: true,
    cargos: [],
    modalidades: [],
    situacoes: [],
    recorteDoAviso: false,
    convocacoes: new Map(),
    dadosDe: "2026-11-10T16:00:00Z",
    ...extra,
  });

  const BOM_NO_INICIO = new RegExp(`^${String.fromCharCode(0xfeff)}`);

  /* Lê um CSV de `;` com aspas (o bastante para conferir o que escrevemos). */
  function lerCsv(csv: string): string[][] {
    const linhas: string[][] = [];
    let linha: string[] = [];
    let celula = "";
    let aspas = false;
    const t = csv.replace(BOM_NO_INICIO, "");
    for (let i = 0; i < t.length; i += 1) {
      const c = t[i];
      if (aspas) {
        if (c === '"' && t[i + 1] === '"') {
          celula += '"';
          i += 1;
        } else if (c === '"') aspas = false;
        else celula += c;
      } else if (c === '"') aspas = true;
      else if (c === ";") {
        linha.push(celula);
        celula = "";
      } else if (c === "\r") continue;
      else if (c === "\n") {
        linha.push(celula);
        linhas.push(linha);
        linha = [];
        celula = "";
      } else celula += c;
    }
    return linhas;
  }

  describe("linhasDaExportacao", () => {
    it("uma linha por candidato, sem repetir, na ordem edital → cargo → classificação → nome", () => {
      const linhas = linhasDaExportacao([
        candidato(3, { cargo: "Médico" }),
        candidato(2),
        candidato(2),
        candidato(10),
        candidato(1, { edital: "02/2026" }),
        candidato(9, { classificacao: null }),
      ]);
      expect(linhas.map((l) => [l[0], l[3], l[4]])).toEqual([
        ["01/2026", "Enfermeiro", 2],
        ["01/2026", "Enfermeiro", 10],
        ["01/2026", "Enfermeiro", ""],
        ["01/2026", "Médico", 3],
        ["02/2026", "Enfermeiro", 1],
      ]);
    });

    it("preserva modalidade e classificação, escreve a situação efetiva e o que a decisão judicial mudou", () => {
      const [linha] = linhasDaExportacao(
        [
          candidato(4, {
            modalidade: "Pessoas pretas e pardas",
            status: "Contratado",
            contratacao_situacao: "OUTRA_LISTA",
            sub_judice: true,
            alterado_judicialmente: true,
            nota_original: 70,
            classificacao_original: 9,
            modalidade_original: "Ampla concorrência",
          }),
        ],
        new Map([["c4", { data: "2026-11-03" }]]),
      );
      expect(
        Object.fromEntries(
          COLUNAS_DA_EXPORTACAO.map((c, i) => [c, linha?.[i]]),
        ),
      ).toEqual({
        Edital: "01/2026",
        Unidade: "Unidade A",
        "Código da vaga": "V01",
        Cargo: "Enfermeiro",
        Classificação: 4,
        Nome: "Pessoa 4",
        Modalidade: "Pessoas pretas e pardas",
        Nota: 80.5,
        Situação: "Contratado em outra lista",
        "Data da convocação": "03/11/2026",
        "Sub judice": "Sim",
        "Antes da decisão judicial":
          "Classificação 9; Nota 70; Modalidade Ampla concorrência",
      });
      expect(linhasDaExportacao([candidato(5)])[0]?.[8]).toBe("Sem status");
    });
  });

  describe("identificação, registro e nome do arquivo", () => {
    it("leva área, editais, filtros, registros de quantos, a data dos dados, a emissão e o registro", () => {
      const linhas = Object.fromEntries(
        identificacaoDaExportacao(
          pedido([candidato(1)], {
            totalDoRecorte: 5,
            todosOsEditais: false,
            cargos: ["Enfermeiro"],
            situacoes: ["__sem_status__", "Convocado"],
            recorteDoAviso: true,
          }),
          REGISTRO,
        ),
      );
      expect(linhas).toEqual({
        Documento: "Lista de aprovados",
        Área: "Saúde Indígena",
        Edital: "01/2026 · Unidade A",
        Cargo: "Enfermeiro",
        Modalidade: "Todas",
        Situação: "Sem status; Convocado",
        Recorte: "Só as vagas da pessoa do aviso",
        Registros: "1 de 5 da lista vigente no recorte",
        "Dados da lista de": "10/11/2026, 13:00",
        "Emitida em": "10/11/2026, 14:30",
        "Registro da exportação": REGISTRO.id,
      });
    });

    it("monta os parâmetros da RPC sem id de candidato", () => {
      const args = argumentosDoRegistro(
        pedido([candidato(1), candidato(1), candidato(2)], {
          totalDoRecorte: 7,
          situacoes: ["Contratado"],
        }),
        "PDF",
      );
      expect(args).toEqual({
        p_area: "saude-indigena",
        p_formato: "PDF",
        p_editais: ["e1"],
        p_cargos: [],
        p_modalidades: [],
        p_situacoes: ["Contratado"],
        p_recorte_do_aviso: false,
        p_total_na_tela: 7,
        p_registros: 2,
      });
      expect(JSON.stringify(args)).not.toContain("c1");
    });

    it("só gera com o registro confirmado pelo banco", () => {
      expect(
        registroDaResposta({
          exportacao_id: REGISTRO.id,
          emitida_em: REGISTRO.emitidaEm,
        }),
      ).toEqual(REGISTRO);
      for (const resposta of [
        null,
        {},
        { exportacao_id: "x", emitida_em: REGISTRO.emitidaEm },
        { exportacao_id: REGISTRO.id, emitida_em: "ontem" },
      ])
        expect(() => registroDaResposta(resposta)).toThrow("não confirmou");
    });

    it("nomeia o arquivo pela área, o edital (se um só) e a hora de Brasília", () => {
      const p = pedido([]);
      expect(nomeDoArquivoDaExportacao(p, "XLSX", REGISTRO.emitidaEm)).toBe(
        "lista-de-aprovados-saude-indigena-2026-11-10-1430.xlsx",
      );
      expect(
        nomeDoArquivoDaExportacao(
          { ...p, todosOsEditais: false },
          "CSV",
          REGISTRO.emitidaEm,
        ),
      ).toBe(
        "lista-de-aprovados-saude-indigena-01-2026-unidade-a-2026-11-10-1430.csv",
      );
    });
  });

  describe("CSV", () => {
    it("identificação no topo, cabeçalho, uma linha por candidato, `;`, BOM e CRLF", () => {
      const csv = csvDaExportacao(
        pedido([candidato(1), candidato(2, { nota: 7 })]),
        REGISTRO,
      );
      expect(csv.startsWith(String.fromCharCode(0xfeff))).toBe(true);
      expect(csv).toContain("\r\n");
      const linhas = lerCsv(csv);
      const inicio = linhas.findIndex(
        (l) => l[0] === "Edital" && l[1] === "Unidade",
      );
      expect(linhas[inicio - 1]).toEqual([""]);
      expect(linhas[0]).toEqual(["Documento", "Lista de aprovados"]);
      expect(linhas[inicio]).toEqual([...COLUNAS_DA_EXPORTACAO]);
      expect(linhas.slice(inicio + 1).map((l) => [l[5], l[7]])).toEqual([
        ["Pessoa 1", "80,5"],
        ["Pessoa 2", "7"],
      ]);
    });

    it("protege contra fórmula e mantém `;`, aspas e quebra de linha dentro da célula", () => {
      const csv = csvDaExportacao(
        pedido([
          candidato(1, {
            nome: '=HYPERLINK("http://x")',
            cargo: "Cargo; com ponto e vírgula",
          }),
          candidato(2, { nome: "+55 61", modalidade: '-1 "x"\nlinha' }),
          candidato(3, { nome: "@soma", cargo: "\t=1+1" }),
        ]),
        REGISTRO,
      );
      const porNome = new Map(
        lerCsv(csv)
          .filter((l) => l[0] === "01/2026")
          .map((l) => [l[5], l]),
      );
      expect([...porNome.keys()].sort()).toEqual([
        "'+55 61",
        '\'=HYPERLINK("http://x")',
        "'@soma",
      ]);
      expect(porNome.get('\'=HYPERLINK("http://x")')?.[3]).toBe(
        "Cargo; com ponto e vírgula",
      );
      expect(porNome.get("'+55 61")?.[6]).toBe('\'-1 "x"\nlinha');
      // As pontas em branco saem; a fórmula que sobra continua protegida.
      expect(porNome.get("'@soma")?.[3]).toBe("'=1+1");
    });

    it("zero registros: identificação e cabeçalho", () => {
      const linhas = lerCsv(csvDaExportacao(pedido([]), REGISTRO));
      expect(linhas.at(-1)).toEqual([...COLUNAS_DA_EXPORTACAO]);
      expect(
        Object.fromEntries(
          linhas.filter((l) => l.length === 2).map((l) => [l[0], l[1]]),
        ).Registros,
      ).toBe("0");
    });
  });

  describe("XLSX", () => {
    it("duas planilhas (Aprovados com filtro; Identificação), números como número e texto sem fórmula", () => {
      const bytes = xlsxDaExportacao(
        pedido([candidato(1, { nome: "=1+1" }), candidato(2)]),
        REGISTRO,
        zipSync,
      );
      const arquivos = unzipSync(bytes);
      const livro = strFromU8(arquivos["xl/workbook.xml"] as Uint8Array);
      expect(livro).toContain('name="Aprovados"');
      expect(livro).toContain('name="Identificação"');
      const folha = strFromU8(
        arquivos["xl/worksheets/sheet1.xml"] as Uint8Array,
      );
      expect(folha).toContain('<autoFilter ref="A1:L3"/>');
      expect(folha).toContain('<c r="E2"><v>1</v></c>');
      expect(folha).toContain('<c r="H2"><v>80.5</v></c>');
      // "=1+1" é texto (inlineStr), não fórmula (<f>).
      expect(folha).toContain('<t xml:space="preserve">=1+1</t>');
      expect(folha).not.toContain("<f>");
      const id = strFromU8(arquivos["xl/worksheets/sheet2.xml"] as Uint8Array);
      expect(id).toContain(REGISTRO.id);
      expect(id).toContain("10/11/2026, 14:30");
    });

    it("as planilhas trazem cabeçalho + linhas, também com zero registros", () => {
      const [aprovados, identificacao] = planilhasDaExportacao(
        pedido([]),
        REGISTRO,
      );
      expect(aprovados?.linhas).toEqual([[...COLUNAS_DA_EXPORTACAO]]);
      expect(identificacao?.linhas[0]).toEqual(["Campo", "Valor"]);
    });
  });

  describe("PDF", () => {
    it("tem a identificação, a tabela e o rodapé com a página", async () => {
      const libs = await carregarBibliotecasDoPdf();
      const bytes = await pdfDaExportacao(
        pedido([candidato(1, { nome: "Ana Lúcia" }), candidato(2)]),
        REGISTRO,
        libs,
        { comprimir: false },
        { ceder: async () => {} },
      );
      const texto = new TextDecoder("latin1").decode(bytes);
      expect(texto.startsWith("%PDF-")).toBe(true);
      for (const trecho of [
        "Lista de aprovados",
        "Ana L",
        "Pessoa 2",
        "Registro da exporta",
        REGISTRO.id,
        "gina 1 de 1",
      ])
        expect(texto).toContain(trecho);
    });
  });

  /*
  Os limites do navegador: a maior área tem 12.796 candidatos vigentes (issue
  #583). Com 13 mil, os três formatos saem em poucos segundos e o arquivo fica
  de tamanho razoável; o teste falha se algum passar do teto.
*/
  describe("13 mil registros", () => {
    const MUITOS = Array.from({ length: 13_000 }, (_, i) =>
      candidato(i + 1, {
        edital: `${String((i % 40) + 1).padStart(2, "0")}/2026`,
        cargo: [
          "Enfermeiro",
          "Médico",
          "Técnico de enfermagem",
          "Agente indígena de saúde",
        ][i % 4],
        modalidade: i % 3 ? "Ampla concorrência" : "Pessoas pretas e pardas",
        status: ["", "Convocado", "Contratado", "Desistente"][i % 4],
      }),
    );
    const p = pedido(MUITOS, {
      editais: Array.from({ length: 40 }, (_, i) => ({
        id: `e${i + 1}`,
        rotulo: `${String(i + 1).padStart(2, "0")}/2026 · Unidade ${i + 1}`,
      })),
    });

    it("CSV e XLSX", () => {
      let t = performance.now();
      const csv = csvDaExportacao(p, REGISTRO);
      const tempoCsv = performance.now() - t;
      expect(
        lerCsv(csv).filter((l) => l.length === COLUNAS_DA_EXPORTACAO.length)
          .length,
      ).toBe(13_001);
      t = performance.now();
      const xlsx = xlsxDaExportacao(p, REGISTRO, zipSync);
      const tempoXlsx = performance.now() - t;
      expect(csv.length).toBeLessThan(3_000_000);
      expect(xlsx.length).toBeLessThan(2_000_000);
      expect(tempoCsv).toBeLessThan(5_000);
      expect(tempoXlsx).toBeLessThan(10_000);
    }, 30_000);

    it("PDF", async () => {
      const libs = await carregarBibliotecasDoPdf();
      const t = performance.now();
      const progresso: number[] = [];
      let pausas = 0;
      const pdf = await pdfDaExportacao(
        p,
        REGISTRO,
        libs,
        {},
        {
          aoProgresso: (f) => progresso.push(f),
          ceder: async () => {
            pausas += 1;
          },
        },
      );
      const tempo = performance.now() - t;
      expect(new TextDecoder("latin1").decode(pdf.slice(0, 5))).toBe("%PDF-");
      expect(pdf.length).toBeLessThan(15_000_000);
      expect(tempo).toBeLessThan(45_000);
      // Cede a vez à tela a cada 300 linhas e informa o progresso até 100%.
      expect(pausas).toBe(43);
      expect(progresso.at(-1)).toBe(1);
      expect(progresso).toEqual([...progresso].sort((a, b) => a - b));
      console.info(
        `PDF de 13 mil linhas: ${(pdf.length / 1e6).toFixed(1)} MB em ${(tempo / 1000).toFixed(1)} s`,
      );
    }, 90_000);
  });
});

bloco("lib/exportacao-do-resumo-por-cargo", () => {
  /* Dados fictícios; o arquivo do resumo não leva nome nem id de candidato. */
  const REGISTRO: RegistroDaExportacao = {
    id: "0f0e0d0c-0b0a-4000-8000-000000000002",
    emitidaEm: "2026-11-11T15:00:00Z",
  };

  const vinculo = (
    id: string,
    extra: Partial<CandidatoDoResumo> = {},
  ): CandidatoDoResumo => ({
    candidato_id: id,
    nome: `Pessoa Fictícia ${id}`,
    edital_id: "e1",
    edital: "01/2099",
    cargo: "Cargo Fictício - Teletrabalho - 20h",
    codigo_vaga: "500",
    modalidade: "Ampla",
    lista_ativa: true,
    status: "",
    ...extra,
  });

  const CANDIDATOS = [
    vinculo("1", { status: "Contratado" }),
    vinculo("2", { status: "Desistente" }),
    vinculo("3"),
    vinculo("4", { modalidade: '=HYPERLINK("x")' }),
  ];
  const SITUACOES = new Map([
    ["3", "Cadastro de reserva"],
    ["4", "Cadastro de reserva"],
  ]);
  const resumo = () =>
    montarResumoPorCargoEStatus({
      candidatos: CANDIDATOS,
      situacoes: SITUACOES,
    });

  const pedido = (
    extra: Partial<PedidoDaExportacao> = {},
  ): PedidoDaExportacao => ({
    area: "projetos",
    rotuloDaArea: "Projetos",
    candidatos: CANDIDATOS,
    totalDoRecorte: CANDIDATOS.length,
    editais: [{ id: "e1", rotulo: "01/2099" }],
    todosOsEditais: false,
    cargos: [],
    modalidades: [],
    situacoes: [],
    recorteDoAviso: false,
    dadosDe: "2026-11-11T14:00:00Z",
    ...extra,
  });

  describe("arquivo do resumo", () => {
    it("registra como RESUMO, com os mesmos parâmetros da lista", () => {
      const args = argumentosDoRegistroDoResumo(pedido(), "CSV");
      expect(args.p_conteudo).toBe("RESUMO");
      expect(args.p_total_na_tela).toBe(4);
      expect(args.p_registros).toBe(4);
      expect(args.p_editais).toEqual(["e1"]);
    });

    it("as linhas são as da tela: vaga, subtotal e total; uma coluna só de Desistentes", () => {
      const linhas = linhasDoArquivoDoResumo(resumo());
      expect(linhas.map((l) => l[0])).toEqual([
        "Vaga",
        "Vaga",
        "Subtotal do grupo",
        "Total geral",
      ]);
      const total = linhas.at(-1)!;
      const col = (rotulo: string) =>
        COLUNAS_DO_ARQUIVO_DO_RESUMO.indexOf(rotulo);
      expect(total[col("Aprovados")]).toBe(4);
      expect(total[col("Contratados")]).toBe(1);
      expect(total[col("Desistentes")]).toBe(1);
      expect(COLUNAS_DO_ARQUIVO_DO_RESUMO.join(" ")).not.toMatch(
        /volunt|tácita|subtipo/i,
      );
      expect(total[col("Em reserva")]).toBe(2);
      expect(total[col("Outros")]).toBe(0);
    });

    it("CSV: identificação do resumo, protegido contra fórmula, sem nome de candidato", () => {
      const csv = csvDoResumo(pedido(), REGISTRO, resumo());
      expect(csv).toContain("Documento;Resumo por cargo e status");
      expect(csv).toContain("Unidade de contagem;");
      expect(csv).not.toMatch(/subtipo/i);
      expect(csv).toContain(REGISTRO.id);
      expect(csv).toContain("'=HYPERLINK");
      expect(csv).not.toMatch(/Pessoa Fictícia/);
    });

    it("a identificação avisa quando o filtro de situação restringe a base", () => {
      const linhas = identificacaoDoResumo(
        pedido({ situacoes: ["Contratado"] }),
        REGISTRO,
        resumo(),
      );
      expect(linhas.find(([r]) => r === "Base")?.[1]).toMatch(
        /restrita pelo filtro de situação/,
      );
      expect(linhas.some(([r]) => r === "Registros")).toBe(false);
    });

    it("XLSX com as planilhas Resumo e Identificação", () => {
      const zip = unzipSync(
        xlsxDoResumo(pedido(), REGISTRO, resumo(), zipSync),
      );
      const workbook = strFromU8(zip["xl/workbook.xml"]!);
      expect(workbook).toContain('name="Resumo"');
      expect(workbook).toContain('name="Identificação"');
      const todas = Object.values(zip)
        .map((b) => strFromU8(b))
        .join("");
      expect(todas).not.toMatch(/Pessoa Fictícia/);
    });

    it("nome do arquivo próprio do resumo", () => {
      expect(nomeDoArquivoDoResumo(pedido(), "XLSX", REGISTRO.emitidaEm)).toBe(
        "resumo-por-cargo-e-status-projetos-01-2099-2026-11-11-1200.xlsx",
      );
    });

    it("PDF com título, total e o registro", async () => {
      const libs = await carregarBibliotecasDoPdf();
      const bytes = pdfDoResumo(pedido(), REGISTRO, resumo(), libs, {
        comprimir: false,
      });
      const texto = new TextDecoder("latin1").decode(bytes);
      expect(texto.startsWith("%PDF-")).toBe(true);
      for (const trecho of [
        "Resumo por cargo e status",
        "Total geral",
        REGISTRO.id,
      ])
        expect(texto).toContain(trecho);
      expect(texto).not.toMatch(/Pessoa Fict/);
    });
  });

  describe("exportarResumoPorCargo: registro antes do arquivo", () => {
    it("registra com p_conteudo RESUMO e só então baixa", async () => {
      const { exportarResumoPorCargo } =
        await import("../src/modulos/aprovados/exportacao/exportar-resumo.ts");
      const chamadas: string[] = [];
      const baixados: string[] = [];
      const resultado = await exportarResumoPorCargo(
        pedido(),
        resumo(),
        "CSV",
        {
          supabase: {
            rpc: async (nome: string, args: Record<string, unknown>) => {
              chamadas.push(`${nome}:${String(args.p_conteudo)}`);
              return {
                data: {
                  exportacao_id: REGISTRO.id,
                  emitida_em: REGISTRO.emitidaEm,
                },
                error: null,
              };
            },
          } as never,
          baixar: (_arquivo, nome) => baixados.push(nome),
        },
      );
      expect(chamadas).toEqual(["registrar_exportacao_aprovados:RESUMO"]);
      expect(baixados).toEqual([resultado?.nome]);
    });

    it("banco sem a atualização: diz o que falta e não baixa nada", async () => {
      const { exportarResumoPorCargo } =
        await import("../src/modulos/aprovados/exportacao/exportar-resumo.ts");
      const baixados: string[] = [];
      await expect(
        exportarResumoPorCargo(pedido(), resumo(), "XLSX", {
          supabase: {
            rpc: async () => ({
              data: null,
              error: { code: "PGRST202", message: "x" },
            }),
          } as never,
          baixar: (_a, nome) => baixados.push(nome),
        }),
      ).rejects.toThrow(/exportação do resumo ainda não está disponível/);
      expect(baixados).toEqual([]);
    });
  });
});

bloco("lib/historicos-dos-aprovados", () => {
  type RespostaDaRpc = { data: unknown; error: unknown };

  describe("Históricos de Aprovados", () => {
    it("preserva ordem, nomes e campos adicionais das cartas e publicações", () => {
      const cartas = [
        { carta_id: "b", modelo: "Segunda", candidatos: 2, extra: true },
        { carta_id: "a", modelo: "Primeira", versao: "1" },
      ];
      expect(cartasDoHistorico(cartas)).toEqual([
        expect.objectContaining(cartas[0]),
        expect.objectContaining(cartas[1]),
      ]);
      const dados = definido(
        publicacaoDoEdital({
          resultado_final: { gerada_em: "2026-10-15", extra: true },
          tem_analises: true,
          publicacoes: [
            {
              id: "b",
              candidatos: 2,
              pendencias: [{ nome: "Ana", motivo: "Saiu" }],
            },
            { id: "a", pendencias: [] },
          ],
        }),
      );
      expect(dados.publicacoes.map((p) => p.id)).toEqual(["b", "a"]);
      expect(dados.publicacoes[0]?.pendencias[0]).toEqual({
        nome: "Ana",
        motivo: "Saiu",
      });
      expect(dados.resultado_final?.extra).toBe(true);
    });
    it.each([
      {},
      [null],
      [{ carta_id: "a", modelo: {} }],
      [{ carta_id: "a" }, { modelo: "Sem ID" }],
    ])("não exibe um histórico parcial de cartas: %j", (dados) => {
      expect(() => cartasDoHistorico(dados)).toThrow(/inválid/);
    });
    it.each([
      { publicacoes: {} },
      { publicacoes: [{ id: "a" }, {}] },
      { resultado_final: [] },
      { publicacoes: [{ id: "a", pendencias: [null] }] },
      { publicacoes: [{ id: "a", por: { nome: "Ana" } }] },
    ])(
      "recusa publicações inválidas antes de chegar à interface: %j",
      (dados) => {
        expect(() => publicacaoDoEdital(dados)).toThrow(/inválid/);
      },
    );
    it("aceita histórico vazio e campos opcionais nulos", () => {
      expect(cartasDoHistorico(null)).toEqual([]);
      expect(publicacaoDoEdital(null)).toBeNull();
      expect(
        publicacaoDoEdital({
          resultado_final: null,
          tem_analises: false,
          publicacoes: [],
        }),
      ).toMatchObject({ resultado_final: null, publicacoes: [] });
    });
    it("libera o carregamento após rejeição da RPC e permite tentar de novo", async () => {
      const rpc = vi
        .fn()
        .mockRejectedValueOnce(new Error("Sem rede"))
        .mockResolvedValue({
          data: { cartas: [{ carta_id: "c1", modelo: "Carta padrão" }] },
          error: null,
        });
      const estado = criarEstadoDaCarta({ supabase: { rpc } });
      await estado.carregarHistorico("ana");
      expect(estado.obter().historicos.get("ana")).toMatchObject({
        carregando: false,
        erro: "Sem rede",
        cartas: [],
      });
      await estado.carregarHistorico("ana", { forcar: true });
      expect(estado.obter().historicos.get("ana")).toMatchObject({
        carregando: false,
        erro: "",
        cartas: [expect.objectContaining({ carta_id: "c1" })],
      });
    });
    it("cargas concorrentes mantêm os históricos de ambas as pessoas", async () => {
      let responderAna: ((resposta: RespostaDaRpc) => void) | undefined;
      const rpc = vi.fn(
        (_nome: string, argumentos?: Record<string, unknown>) =>
          definido(argumentos).p_candidato === "ana"
            ? new Promise<RespostaDaRpc>((resolve) => {
                responderAna = resolve;
              })
            : Promise.resolve<RespostaDaRpc>({
                data: { cartas: [{ carta_id: "bia" }] },
                error: null,
              }),
      );
      const estado = criarEstadoDaCarta({ supabase: { rpc } });
      const ana = estado.carregarHistorico("ana");
      await estado.carregarHistorico("bia");
      definido(responderAna)({
        data: { cartas: [{ carta_id: "ana" }] },
        error: null,
      });
      await ana;
      expect(estado.obter().historicos.get("ana")?.cartas[0]?.carta_id).toBe(
        "ana",
      );
      expect(estado.obter().historicos.get("bia")?.cartas[0]?.carta_id).toBe(
        "bia",
      );
    });
  });
});

bloco("lib/localidade-da-vaga", () => {
  /* Textos de cargo como vêm das listas (sem dado pessoal). */
  describe("localidadeDoCargo", () => {
    it.each([
      ["Enfermeiro - Pacaraima/RR", "Pacaraima/RR"],
      ["TÉCNICO DE ENFERMAGEM - PACARAIMA/RR - PPIQ", "PACARAIMA/RR"],
      [
        "Técnico de Enfermagem - Polo Base Brasilândia - DSEI Mato Grosso do Sul - Cadastro Reserva",
        "Polo Base Brasilândia",
      ],
      [
        "Nutricionista - Cadastro Reserva - DSEI GUAMÁ TOCANTINS - CASAI PARAGOMINAS -",
        "CASAI PARAGOMINAS",
      ],
      [
        "Engenheiro Civil - Cadastro Reserva - CAMPO GRANDE/MS - DSEI/SEDE",
        "CAMPO GRANDE/MS",
      ],
      [
        "Auxiliar Administrativo - Abrangência do DSEI - DSEI Manaus - Cadastro Reserva",
        "Abrangência do DSEI",
      ],
      ["Técnico de Enfermagem - Açucena/MG - (1 vaga)", "Açucena/MG"],
      [
        "Auxiliar de Saúde Bucal (ASB) - PB Chapecó - 1 vaga AC + CR",
        "PB Chapecó",
      ],
      [
        "AGENTE DE REGIÃO/DISTRITO - DISTRITAL DE CACOAL - AMPLA CONCORRÊNCIA",
        "DISTRITAL DE CACOAL",
      ],
      [
        "ASSISTENTE DE REGIÃO/DISTRITO - QUALQUER ÁREA DE FORMAÇÃO - DISTRITAL DE ALTAMIRA - PPIQ",
        "DISTRITAL DE ALTAMIRA",
      ],
      ["CARGO 1: ASSISTENTE ADMINISTRATIVO DE CCE - CEARÁ", "CEARÁ"],
      [
        "Cargo 1: Médico - UBS móvel Palhoça/SC - Projeto Agora tem Especialistas - Cadastro Reserva",
        "UBS móvel Palhoça/SC",
      ],
      ["Técnico Químico - BAURU/SP/", "BAURU/SP"],
    ])("%s → %s", (cargo, localidade) => {
      expect(localidadeDoCargo(cargo)).toBe(localidade);
    });

    it.each([
      "Analista Especializado de Saúde Indígena",
      "Analista de Gestão - Área de Formação: Direito",
      "Médico de Família e Comunidade (MFC) - Teletrabalho - 40h - Ampla Concorrência",
      "Agente de Combate a Endemias (ACE) - Cadastro Reserva - DSEI MÉDIO RIO PURUS -",
      "Técnico em Saneamento - DSEI Yanomami 25 vagas - (15 AC + 2 PCD + CR)",
      "",
    ])("sem localidade: %s", (cargo) => {
      expect(localidadeDoCargo(cargo)).toBe("");
    });
  });

  describe("opções e filtro", () => {
    const candidatos = [
      {
        candidato_id: "1",
        edital_id: "e1",
        nome: "A",
        cargo: "Enfermeiro - Pacaraima/RR",
      },
      {
        candidato_id: "2",
        edital_id: "e1",
        nome: "B",
        cargo: "Enfermeiro - Boa Vista/RR",
      },
      {
        candidato_id: "3",
        edital_id: "e2",
        nome: "C",
        cargo: "TÉCNICO DE ENFERMAGEM - PACARAIMA/RR - PPIQ",
      },
      {
        candidato_id: "4",
        edital_id: "e2",
        nome: "D",
        cargo: "Assistente Social",
      },
    ];

    it("uma opção por lugar (sem repetir a grafia), em ordem", () => {
      expect(opcoesDeLocalidade(candidatos)).toEqual([
        "Boa Vista/RR",
        "Pacaraima/RR",
      ]);
      expect(chaveDaLocalidade("PACARAIMA/RR")).toBe(
        chaveDaLocalidade("Pacaraima/RR"),
      );
    });

    it("com uma localidade só não há o que filtrar", () => {
      expect(opcoesDeLocalidade(candidatos, ["e2"])).toEqual([]);
    });

    it("filtra pela chave: as duas grafias de Pacaraima entram, sem localidade fica fora", () => {
      expect(
        filterApprovedCandidates(candidatos, {
          localidade: ["Pacaraima/RR"],
        }).map((c) => c.candidato_id),
      ).toEqual(["1", "3"]);
      expect(naLocalidade("Assistente Social", [])).toBe(true);
      expect(naLocalidade("Assistente Social", ["Pacaraima/RR"])).toBe(false);
    });
  });

  describe("jornada colada ao nome do cargo", () => {
    it.each([
      ["Assistente Social 30h", "Assistente Social", "30h"],
      ["Cirurgião Dentista (40h)", "Cirurgião Dentista", "40h"],
      [
        "Médico 40h - Abrangência do DSEI",
        "Médico - Abrangência do DSEI",
        "40h",
      ],
      ["Médico de Família - Teletrabalho - 20h", "Médico de Família", "20h"],
      ["Enfermeiro", "Enfermeiro", null],
    ])("%s", (cargo, cargoBase, jornada) => {
      const lido = lerRegimeEJornada(cargo);
      expect(lido.cargoBase).toBe(cargoBase);
      expect(lido.jornada).toBe(jornada);
    });
  });
});

bloco("lib/pendencias-do-edital", () => {
  /* As regras puras da aba Pendências (src/lib/aprovados/pendencias-do-edital.ts), com dados fictícios. */

  const linha = (id: string, extra: Record<string, unknown> = {}) => ({
    id,
    nome: `Pessoa ${id}`,
    vaga: "100",
    modalidade: '"Ampla Concorrência"',
    posicao: 3,
    status: "",
    lista_ativa: true,
    ...extra,
  });
  const pendencia = (tipo: string, extra: Record<string, unknown> = {}) =>
    definido(
      normalizarPendencia({
        id: `p-${tipo}`,
        tipo,
        situacao: "ABERTA",
        edital_id: "e1",
        edital: "01/2026",
        unidade: "DSEI",
        detalhe: {},
        pode_decidir: true,
        linhas: [linha("a"), linha("b")],
        ...extra,
      }),
    );
  const HOJE = "2026-10-26";

  /* A alteração do histórico; o texto não usa o candidato. */
  type Alteracao = Parameters<typeof textoDaAlteracao>[0];
  const semCandidato = (a: Omit<Alteracao, "candidato">): Alteracao => ({
    candidato: "",
    ...a,
  });

  describe("normalização", () => {
    it("formato desconhecido é erro; tipo desconhecido sai", () => {
      expect(() => normalizarResposta({ pendencias: [] })).toThrow();
      const { pendencias } = normalizarResposta({
        schema_version: 1,
        pendencias: [
          { id: "x", tipo: "OUTRO" },
          { id: "y", tipo: "POSICAO_REPETIDA" },
        ],
      });
      expect(pendencias.map((p) => p.id)).toEqual(["y"]);
    });

    it("limpa as aspas da modalidade e lê os tipos", () => {
      const p = pendencia("POSICAO_REPETIDA");
      expect(p.linhas[0]?.modalidade).toBe("Ampla Concorrência");
      expect(p.linhas[0]?.listaAtiva).toBe(true);
      expect(p.podeDecidir).toBe(true);
    });
  });

  describe("textos, contagens e filtros", () => {
    it("o detalhe de cada tipo", () => {
      expect(
        textoDoDetalhe(
          pendencia("CONTRATADO_DUAS_MATRICULAS", {
            detalhe: { linhas: 3, vinculos: 2 },
          }),
        ),
      ).toBe("2 matrículas em 3 linhas deste edital");
      expect(
        textoDoDetalhe(
          pendencia("CONTRATADO_EM_DUAS_LISTAS", {
            detalhe: { linhas: 2, motivo: "NENHUMA_ALCANCADA" },
          }),
        ),
      ).toBe(
        "Mesma matrícula em 2 listas: nenhuma linha está dentro do que a convocação já chamou",
      );
      expect(
        textoDoDetalhe(
          pendencia("CONVOCADO_SEM_DESFECHO", {
            detalhe: { convocado_em: "2026-09-01", dias: 55 },
          }),
        ),
      ).toBe("Convocado em 01/09/2026, há 55 dias, sem desfecho");
    });

    it("conta e filtra as abertas por edital, tipo e situação", () => {
      const lista = [
        pendencia("POSICAO_REPETIDA"),
        pendencia("PESSOA_REPETIDA", {
          id: "p2",
          edital_id: "e2",
          edital: "02/2026",
        }),
        pendencia("PESSOA_REPETIDA", { id: "p3", situacao: "RESOLVIDA" }),
      ];
      expect(contarAbertas(lista).total).toBe(2);
      expect(contarAbertas(lista, "e1").porTipo.POSICAO_REPETIDA).toBe(1);
      expect(
        filtrarPendencias(lista, { tipo: "PESSOA_REPETIDA" }).map((p) => p.id),
      ).toEqual(["p2"]);
      expect(
        filtrarPendencias(lista, { situacao: "RESOLVIDA" }).map((p) => p.id),
      ).toEqual(["p3"]);
      expect(editaisDasPendencias(lista)).toEqual([
        { valor: "e1", rotulo: "01/2026 · DSEI", abertas: 1 },
        { valor: "e2", rotulo: "02/2026 · DSEI", abertas: 1 },
      ]);
    });

    it("a alteração do histórico em texto", () => {
      expect(
        textoDaAlteracao(
          semCandidato({ campo: "status", antes: "Contratado", depois: null }),
        ),
      ).toBe("Contratado → sem status");
      expect(
        textoDaAlteracao(
          semCandidato({ campo: "posicao", antes: 7, depois: 8 }),
        ),
      ).toBe("posição 7 → 8");
      expect(
        textoDaAlteracao(
          semCandidato({ campo: "removido", antes: false, depois: true }),
        ),
      ).toBe("saiu da lista");
    });
  });

  describe("a decisão vira a chamada certa", () => {
    const contratados = [
      linha("a", { status: "Contratado" }),
      linha("b", { status: "Contratado" }),
    ];

    it("motivo obrigatório em todo tipo", () => {
      for (const tipo of [
        "CONTRATADO_EM_DUAS_LISTAS",
        "POSICAO_REPETIDA",
        "CONVOCADO_SEM_DESFECHO",
      ])
        expect(
          chamadaDaDecisao(pendencia(tipo), { motivo: "  " }, HOJE).erro,
        ).toMatch(/motivo/);
    });

    it("duas matrículas: a linha que vale e o desfecho das outras", () => {
      const p = pendencia("CONTRATADO_DUAS_MATRICULAS", {
        linhas: contratados,
      });
      expect(
        chamadaDaDecisao(p, { motivo: "ok!", linha: "x" }, HOJE).erro,
      ).toMatch(/linha/);
      expect(
        chamadaDaDecisao(
          p,
          { motivo: "ok!", linha: "a", outras: "Desistente" },
          HOJE,
        ).chamada,
      ).toEqual({
        rpc: "escolher_vinculo_do_contratado",
        argumentos: {
          p_pendencia: p.id,
          p_motivo: "ok!",
          p_candidato: "a",
          p_status_das_outras: "Desistente",
        },
      });
      expect(
        chamadaDaDecisao(p, { motivo: "ok!", linha: "a" }, HOJE).chamada
          ?.argumentos.p_status_das_outras,
      ).toBe("Contratado em outra lista");
    });

    it("duas listas: só linha Contratado", () => {
      const p = pendencia("CONTRATADO_EM_DUAS_LISTAS", {
        linhas: [linha("a", { status: "Contratado" }), linha("b")],
      });
      expect(
        chamadaDaDecisao(p, { motivo: "ok!", linha: "b" }, HOJE).erro,
      ).toBeTruthy();
      expect(
        chamadaDaDecisao(p, { motivo: "ok!", linha: "a" }, HOJE).chamada?.rpc,
      ).toBe("escolher_lista_da_contratacao");
    });

    it("pessoa repetida: a linha que fica ou pessoas diferentes", () => {
      const p = pendencia("PESSOA_REPETIDA");
      expect(
        chamadaDaDecisao(p, { motivo: "ok!", pessoasDiferentes: true }, HOJE)
          .chamada,
      ).toEqual({
        rpc: "manter_linha_da_pessoa_repetida",
        argumentos: { p_pendencia: p.id, p_motivo: "ok!", p_candidato: null },
      });
      expect(
        chamadaDaDecisao(p, { motivo: "ok!", linha: "b" }, HOJE).chamada
          ?.argumentos.p_candidato,
      ).toBe("b");
    });

    it("posição: empate ou correção com número válido e diferente", () => {
      const p = pendencia("POSICAO_REPETIDA");
      expect(chamadaDaDecisao(p, { motivo: "ok!" }, HOJE).erro).toMatch(
        /empate/,
      );
      expect(
        chamadaDaDecisao(p, { motivo: "ok!", acao: "empate" }, HOJE).chamada
          ?.rpc,
      ).toBe("confirmar_empate_da_posicao");
      expect(
        chamadaDaDecisao(
          p,
          { motivo: "ok!", acao: "corrigir", linha: "a", posicao: "0" },
          HOJE,
        ).erro,
      ).toMatch(/posição/);
      expect(
        chamadaDaDecisao(
          p,
          { motivo: "ok!", acao: "corrigir", linha: "a", posicao: "3" },
          HOJE,
        ).erro,
      ).toMatch(/igual/);
      expect(
        chamadaDaDecisao(
          p,
          { motivo: "ok!", acao: "corrigir", linha: "a", posicao: "4" },
          HOJE,
        ).chamada,
      ).toEqual({
        rpc: "corrigir_posicao_da_pendencia",
        argumentos: {
          p_pendencia: p.id,
          p_motivo: "ok!",
          p_candidato: "a",
          p_posicao: 4,
        },
      });
    });

    it("convocado: matrícula no Contratado; nova data não futura nem igual", () => {
      const p = pendencia("CONVOCADO_SEM_DESFECHO", {
        linhas: [
          linha("c", { status: "Convocado", convocado_em: "2026-09-01" }),
        ],
      });
      expect(
        chamadaDaDecisao(p, { motivo: "ok!", status: "Contratado" }, HOJE).erro,
      ).toMatch(/matrícula/);
      expect(
        chamadaDaDecisao(
          p,
          { motivo: "ok!", status: "Convocado", data: "2026-09-01" },
          HOJE,
        ).erro,
      ).toMatch(/igual/);
      expect(
        chamadaDaDecisao(
          p,
          { motivo: "ok!", status: "Convocado", data: "2026-10-27" },
          HOJE,
        ).erro,
      ).toMatch(/futura/);
      expect(
        chamadaDaDecisao(
          p,
          { motivo: "ok!", status: "Desistente", data: "2026-10-01" },
          HOJE,
        ).chamada?.argumentos,
      ).toEqual({
        p_pendencia: p.id,
        p_motivo: "ok!",
        p_status: "Desistente",
        p_matricula: null,
        p_data_convocacao: null,
      });
    });
  });
});

bloco("lib/publicacao-de-aprovados", () => {
  const retrato = {
    tipo: "FINAL",
    modalidades: [{ codigo: "PP", nome: "Pretos e pardos" }],
    vagas: [
      {
        chave: "V1",
        codigo: "V1",
        cargo: "Enfermeiro",
        geral: [
          {
            posicao: 1,
            analise_id: "a1",
            nome: "Ana Souza",
            nota: 90,
            situacao: "VAGA",
            modalidades: ["AC"],
          },
          {
            posicao: 2,
            analise_id: "a2",
            nome: "Bruno Lima",
            nota: 80,
            situacao: "VAGA",
            modalidades: ["AC", "PP"],
          },
          {
            posicao: 3,
            analise_id: "a3",
            nome: "Carla Dias",
            nota: 70,
            situacao: "CR",
            modalidades: ["AC"],
          },
        ],
        listas: {
          PP: [
            {
              posicao: 1,
              analise_id: "a2",
              nome: "Bruno Lima",
              nota: 80,
              situacao: "VAGA",
              modalidades: ["AC", "PP"],
            },
            {
              posicao: 2,
              analise_id: "a4",
              nome: "Davi Rocha",
              nota: 60,
              situacao: "CR",
              modalidades: ["PP"],
            },
          ],
        },
      },
      {
        chave: "quadro:9",
        codigo: "",
        cargo: "Técnico",
        geral: [
          {
            posicao: 1,
            analise_id: "a5",
            nome: "Élio Nunes",
            nota: 75,
            situacao: "VAGA",
            modalidades: ["AC"],
          },
          {
            posicao: 2,
            analise_id: "a1",
            nome: "Ana Souza",
            nota: 70,
            situacao: "CR",
            modalidades: ["AC"],
          },
        ],
        listas: {},
      },
    ],
  };

  describe("candidatosDaListaFinal", () => {
    it("um por análise, com a posição da geral e a da modalidade para quem só está nela", () => {
      const linhas = candidatosDaListaFinal(retrato, {
        analises: new Map([["a5", { vaga: "T-01", cargo: "Técnico" }]]),
      });
      expect(
        linhas.map((l) => [l.analise_id, l.posicao, l.codigo_vaga]),
      ).toEqual([
        ["a1", 1, "V1"],
        ["a2", 2, "V1"],
        ["a3", 3, "V1"],
        ["a4", 2, "V1"],
        ["a5", 1, "T-01"],
      ]);
      expect(linhas[0]).toMatchObject({
        nome: "Ana Souza",
        nota: 90,
        situacao: "VAGA",
        cargo: "Enfermeiro",
      });
      expect(linhas[2]?.situacao).toBe("CR");
    });

    it("vaga sem código e sem análise conhecida usa a chave da vaga", () => {
      const [, , , , tecnico] = candidatosDaListaFinal(retrato);
      expect(tecnico?.codigo_vaga).toBe("quadro:9");
    });

    it("retrato vazio não quebra", () => {
      expect(candidatosDaListaFinal(null)).toEqual([]);
    });
  });

  describe("motivo", () => {
    it("motivo entre 3 e 500 caracteres", () => {
      expect(motivoValido("ok")).toBe(false);
      expect(motivoValido("Edital sem análise no sistema")).toBe(true);
      expect(motivoValido("x".repeat(501))).toBe(false);
    });
  });

  describe("origem da lista", () => {
    it("publicada da Classificação traz a data; planilha é manual", () => {
      expect(
        origemDaLista({
          origem: "CLASSIFICACAO",
          importado_em: "2026-10-05T15:00:00Z",
        }),
      ).toEqual({
        tipo: "CLASSIFICACAO",
        texto: "Publicada da Classificação em 05/10",
      });
      expect(origemDaLista({ origem: "XLSX" })?.texto).toBe(
        "Lista manual (planilha)",
      );
      expect(origemDaLista({})?.tipo).toBe("XLSX");
      expect(origemDaLista(null)).toBeNull();
    });

    it("várias listas: quantas de cada origem", () => {
      expect(resumoDasOrigens([])).toBe("");
      expect(resumoDasOrigens([{ origem: "XLSX" }])).toBe(
        "Lista manual (planilha)",
      );
      expect(
        resumoDasOrigens([
          { origem: "CLASSIFICACAO" },
          { origem: "XLSX" },
          { origem: "XLSX" },
        ]),
      ).toBe("Listas: 1 publicada da Classificação · 2 manuais (planilha)");
    });
  });
});

bloco("lib/resumo-por-cargo-e-status", () => {
  /*
  Dados fictícios. A fixture grande reproduz os SUBTOTAIS da imagem de
  referência da CORES (Edital 05/2026) com cargo e edital inventados: só para
  conferir a conta, nada disso fica no produto.
*/

  const EDITAL = "ed-1";
  const RESERVA = "Cadastro de reserva";

  let proximoId = 1;
  function vinculos(
    cargo: string,
    codigoVaga: string,
    modalidade: string,
    q: {
      contratado?: number;
      voluntaria?: number;
      tacita?: number;
      reserva?: number;
    },
    situacoes: Map<string, string>,
  ): CandidatoDoResumo[] {
    const linhas: CandidatoDoResumo[] = [];
    const mais = (
      n: number,
      extra: Partial<CandidatoDoResumo>,
      fila?: string,
    ) => {
      for (let i = 0; i < n; i += 1) {
        const id = `c-${proximoId++}`;
        if (fila) situacoes.set(id, fila);
        linhas.push({
          candidato_id: id,
          edital_id: EDITAL,
          edital: "Edital fictício 01/2099",
          cargo,
          codigo_vaga: codigoVaga,
          modalidade,
          lista_ativa: true,
          status: "",
          ...extra,
        });
      }
    };
    mais(q.contratado ?? 0, { status: "Contratado" }, "Já chamado");
    // Desistência é uma coluna só (16/11/2026): voluntária e tácita do quadro somam.
    mais((q.voluntaria ?? 0) + (q.tacita ?? 0), { status: "Desistente" });
    mais(q.reserva ?? 0, {}, RESERVA);
    return linhas;
  }

  function fixtureDaImagem() {
    const situacoes = new Map<string, string>();
    const AC = "Ampla Concorrência";
    const PCD = "Exclusiva p/ PcD";
    const PPIQ = "Exclusiva p/ PPIQ";
    const cargo = (resto: string) => `Cargo Fictício (CF) - ${resto}`;
    const candidatos = [
      ...vinculos(
        cargo("Presencial - 40h"),
        "901",
        AC,
        { contratado: 3, voluntaria: 7, tacita: 1, reserva: 9 },
        situacoes,
      ),
      ...vinculos(
        cargo("Presencial - 40h"),
        "901",
        PCD,
        { reserva: 1 },
        situacoes,
      ),
      ...vinculos(
        cargo("Presencial - 40h"),
        "901",
        PPIQ,
        { contratado: 2, voluntaria: 2 },
        situacoes,
      ),
      ...vinculos(
        cargo("Teletrabalho - 20h"),
        "902",
        PCD,
        { contratado: 1, reserva: 26 },
        situacoes,
      ),
      ...vinculos(
        cargo("Teletrabalho - 20h"),
        "902",
        AC,
        { contratado: 7, voluntaria: 2, reserva: 943 },
        situacoes,
      ),
      ...vinculos(
        cargo("Teletrabalho - 20h"),
        "902",
        PPIQ,
        { contratado: 3, voluntaria: 2, reserva: 95 },
        situacoes,
      ),
      ...vinculos(
        cargo("Teletrabalho - 30h"),
        "903",
        PCD,
        { reserva: 3 },
        situacoes,
      ),
      ...vinculos(
        cargo("Teletrabalho - 30h"),
        "903",
        AC,
        { reserva: 78 },
        situacoes,
      ),
      ...vinculos(
        cargo("Teletrabalho - 30h"),
        "903",
        PPIQ,
        { reserva: 5 },
        situacoes,
      ),
      ...vinculos(
        cargo("Teletrabalho - 40h"),
        "904",
        PCD,
        { contratado: 3, reserva: 12 },
        situacoes,
      ),
      ...vinculos(
        cargo("Teletrabalho - 40h"),
        "904",
        AC,
        { contratado: 25, voluntaria: 6, reserva: 283 },
        situacoes,
      ),
      ...vinculos(
        cargo("Teletrabalho - 40h"),
        "904",
        PPIQ,
        { contratado: 13, voluntaria: 3, reserva: 37 },
        situacoes,
      ),
    ];
    return { candidatos, situacoes };
  }

  const numeros = (c: ContagemDoResumo) => [
    c.aprovados,
    c.contratado,
    c.desistencia,
    c.reserva,
  ];

  describe("lerRegimeEJornada: regra explícita sobre o texto do cargo", () => {
    it("tira regime e jornada dos trechos separados por hífen", () => {
      expect(
        lerRegimeEJornada("Médico de Família - Teletrabalho - 20h"),
      ).toEqual({
        cargoBase: "Médico de Família",
        regime: "Teletrabalho",
        jornada: "20h",
      });
    });
    it("aceita meia-risca, 'horas', 'Híbrido' sem acento e ordem trocada", () => {
      expect(
        lerRegimeEJornada("Analista – 40 horas semanais – hibrido"),
      ).toEqual({
        cargoBase: "Analista",
        regime: "Híbrido",
        jornada: "40h",
      });
    });
    it("não arranca regime de dentro de um nome (só trecho inteiro)", () => {
      expect(lerRegimeEJornada("Apoio presencial ao DSEI")).toEqual({
        cargoBase: "Apoio presencial ao DSEI",
        regime: null,
        jornada: null,
      });
    });
    it("cargo vazio fica vazio, sem regime nem jornada", () => {
      expect(lerRegimeEJornada("")).toEqual({
        cargoBase: "",
        regime: null,
        jornada: null,
      });
    });
  });

  describe("categoriaDoVinculo", () => {
    const base: CandidatoDoResumo = { candidato_id: "x", status: "" };
    it("Contratado e Migração são contratados; Contratado em outra lista não", () => {
      expect(
        categoriaDoVinculo({ ...base, status: "Contratado" }, undefined)
          .categoria,
      ).toBe("contratado");
      expect(
        categoriaDoVinculo({ ...base, status: "Migração" }, undefined)
          .categoria,
      ).toBe("contratado");
      expect(
        categoriaDoVinculo(
          {
            ...base,
            status: "Contratado",
            contratacao_situacao: "OUTRA_LISTA",
          },
          undefined,
        ),
      ).toEqual({ categoria: "outras", motivo: "contratadoEmOutraLista" });
    });
    it("desistente cai em Desistentes, uma coluna só", () => {
      expect(
        categoriaDoVinculo({ ...base, status: "Desistente" }, RESERVA)
          .categoria,
      ).toBe("desistencia");
    });
    it("reserva vem da fila, nunca de 'sem status'", () => {
      expect(categoriaDoVinculo(base, RESERVA).categoria).toBe("reserva");
      expect(categoriaDoVinculo(base, "A convocar")).toEqual({
        categoria: "outras",
        motivo: "aConvocar",
      });
      expect(categoriaDoVinculo(base, undefined)).toEqual({
        categoria: "outras",
        motivo: "naoClassificado",
      });
      expect(
        categoriaDoVinculo({ ...base, status: "Convocado" }, RESERVA),
      ).toEqual({
        categoria: "outras",
        motivo: "convocado",
      });
      expect(
        categoriaDoVinculo(
          { ...base, status: "Documentação Rejeitada" },
          undefined,
        ),
      ).toEqual({
        categoria: "outras",
        motivo: "documentacaoRejeitada",
      });
    });
  });

  describe("montarResumoPorCargoEStatus", () => {
    it("reproduz os subtotais e o total da imagem de referência", () => {
      const { candidatos, situacoes } = fixtureDaImagem();
      const resumo = montarResumoPorCargoEStatus({ candidatos, situacoes });
      expect(resumo.editais).toHaveLength(1);
      const grupos = resumo.editais[0]!.grupos;
      expect(grupos.map((g) => g.rotulo)).toEqual([
        "Cargo Fictício (CF) · Presencial · 40h",
        "Cargo Fictício (CF) · Teletrabalho · 20h",
        "Cargo Fictício (CF) · Teletrabalho · 30h",
        "Cargo Fictício (CF) · Teletrabalho · 40h",
      ]);
      expect(grupos.map((g) => numeros(g.subtotal))).toEqual([
        [25, 5, 10, 10],
        [1079, 11, 4, 1064],
        [86, 0, 0, 86],
        [382, 41, 9, 332],
      ]);
      expect(numeros(resumo.total)).toEqual([1572, 57, 23, 1492]);
      expect(grupos.every((g) => g.linhas.length === 3)).toBe(true);
      expect(reconcilia(resumo.total)).toBe(true);
      expect(resumo.faltas).toEqual({
        semRegime: 0,
        semJornada: 0,
        semCodigoDaVaga: 0,
        semModalidade: 0,
      });
    });

    it("vagas distintas do mesmo cargo e modalidade ficam em linhas separadas (A)", () => {
      const situacoes = new Map<string, string>();
      const candidatos = [
        ...vinculos(
          "Enfermeiro - Presencial - 40h",
          "11",
          "Ampla",
          { reserva: 2 },
          situacoes,
        ),
        ...vinculos(
          "Enfermeiro - Presencial - 40h",
          "12",
          "Ampla",
          { reserva: 3 },
          situacoes,
        ),
      ];
      const resumo = montarResumoPorCargoEStatus({ candidatos, situacoes });
      const grupo = resumo.editais[0]!.grupos[0]!;
      expect(
        grupo.linhas.map((l) => [l.codigoVaga, l.contagem.aprovados]),
      ).toEqual([
        ["11", 2],
        ["12", 3],
      ]);
      expect(grupo.subtotal.aprovados).toBe(5);
    });

    it("não conta duas vezes o mesmo vínculo nem junta pessoas por nome (C)", () => {
      const comum = {
        edital_id: EDITAL,
        cargo: "Agente - 40h",
        codigo_vaga: "1",
        modalidade: "AC",
        lista_ativa: true,
      };
      const candidatos: CandidatoDoResumo[] = [
        {
          ...comum,
          candidato_id: "a",
          nome: "Pessoa Fictícia",
          status: "Contratado",
        },
        {
          ...comum,
          candidato_id: "a",
          nome: "Pessoa Fictícia",
          status: "Contratado",
        },
        {
          ...comum,
          candidato_id: "b",
          nome: "Pessoa Fictícia",
          status: "Contratado",
        },
      ];
      const resumo = montarResumoPorCargoEStatus({
        candidatos,
        situacoes: new Map(),
      });
      expect(resumo.total.aprovados).toBe(2);
      expect(resumo.total.contratado).toBe(2);
    });

    it("cota e ampla da mesma pessoa: contratada por uma linha, a outra vai a Outras (C, E)", () => {
      const comum = {
        edital_id: EDITAL,
        cargo: "Agente - 40h",
        codigo_vaga: "1",
        lista_ativa: true,
      };
      const candidatos: CandidatoDoResumo[] = [
        {
          ...comum,
          candidato_id: "a1",
          modalidade: "AC",
          status: "Contratado",
        },
        {
          ...comum,
          candidato_id: "a2",
          modalidade: "PcD",
          status: "Contratado",
          contratacao_situacao: "OUTRA_LISTA",
        },
      ];
      const resumo = montarResumoPorCargoEStatus({
        candidatos,
        situacoes: new Map(),
      });
      expect(resumo.total.aprovados).toBe(2);
      expect(resumo.total.contratado).toBe(1);
      expect(resumo.total.motivos.contratadoEmOutraLista).toBe(1);
      expect(reconcilia(resumo.total)).toBe(true);
    });

    it("lista inativa fica fora e é contada à parte; Migração conta e vai à parte", () => {
      const comum = {
        edital_id: EDITAL,
        cargo: "Agente",
        codigo_vaga: "",
        modalidade: "",
        status: "",
      };
      const candidatos: CandidatoDoResumo[] = [
        { ...comum, candidato_id: "1", lista_ativa: false },
        {
          ...comum,
          candidato_id: "2",
          lista_ativa: true,
          status: "Migração",
          sub_judice: true,
        },
        {
          ...comum,
          candidato_id: "3",
          lista_ativa: true,
          status: "Desistente",
        },
      ];
      const resumo = montarResumoPorCargoEStatus({
        candidatos,
        situacoes: new Map(),
      });
      expect(resumo.foraDaListaAtiva).toBe(1);
      expect(resumo.total.aprovados).toBe(2);
      expect(resumo.total.contratado).toBe(1);
      expect(resumo.total.migracao).toBe(1);
      expect(resumo.total.subJudice).toBe(1);
      expect(resumo.total.desistencia).toBe(1);
      expect(resumo.faltas).toEqual({
        semRegime: 2,
        semJornada: 2,
        semCodigoDaVaga: 2,
        semModalidade: 2,
      });
      expect(resumo.editais[0]!.grupos[0]!.rotulo).toBe("Agente");
    });

    it("os ids de cada coluna abrem o mesmo recorte do número (F)", () => {
      const { candidatos, situacoes } = fixtureDaImagem();
      const resumo = montarResumoPorCargoEStatus({ candidatos, situacoes });
      for (const edital of resumo.editais)
        for (const grupo of edital.grupos) {
          expect(grupo.ids.reserva).toHaveLength(grupo.subtotal.reserva);
          for (const linha of grupo.linhas)
            expect(linha.ids.contratado).toHaveLength(
              linha.contagem.contratado,
            );
        }
      expect(resumo.ids.aprovados).toHaveLength(resumo.total.aprovados);
    });

    it("linhas planas: vagas, subtotal por grupo, edital (com mais de um) e total", () => {
      const situacoes = new Map<string, string>();
      const candidatos = [
        ...vinculos("A - 20h", "1", "AC", { reserva: 1 }, situacoes),
        ...vinculos("A - 20h", "1", "AC", { reserva: 1 }, situacoes).map(
          (c) => ({
            ...c,
            edital_id: "ed-2",
          }),
        ),
      ];
      const resumo = montarResumoPorCargoEStatus({
        candidatos,
        situacoes,
        rotulosDosEditais: new Map([
          [EDITAL, "Edital 01"],
          ["ed-2", "Edital 02"],
        ]),
      });
      expect(
        linhasPlanasDoResumo(resumo).map((l) => `${l.nivel}:${l.edital}`),
      ).toEqual([
        "Vaga:Edital 01",
        "Subtotal:Edital 01",
        "Edital:Edital 01",
        "Vaga:Edital 02",
        "Subtotal:Edital 02",
        "Edital:Edital 02",
        "Total:",
      ]);
    });
  });

  describe("situacoesNaFila: a mesma conta da aba Convocação", () => {
    it("sem vagas imediatas, quem não tem status fica no cadastro de reserva", () => {
      const modelo = normalizarModelo(null);
      const candidatos = [1, 2, 3].map((i) => ({
        candidato_id: String(i),
        edital_id: EDITAL,
        cargo: "Agente - 40h",
        codigo_vaga: "7",
        modalidade: "Ampla Concorrência",
        classificacao: i,
        nota: 10 - i,
        status: i === 1 ? "Contratado" : i === 2 ? "Desistente" : "",
        lista_ativa: true,
      }));
      const situacoes = situacoesNaFila(candidatos, () => ({
        proporcionalidade: true,
        quadro: quadroVazio(modelo),
        modelo,
      }));
      expect(situacoes.get("3")).toBe(RESERVA);
      expect(situacoes.get("2")).toBe("Fora da fila");
      expect(situacoes.get("1")).toBe("Já chamado");
    });
  });

  describe("resumoAteOLimite: a tela desenha 50 linhas de vaga por vez", () => {
    // Edital 1: cargos A, B e C com 30 vagas cada; edital 2: cargo D com 10.
    const candidatos = [
      ...["A", "B", "C"].flatMap((cargo) =>
        Array.from({ length: 30 }, (_, i) => ({
          candidato_id: `1-${cargo}-${i}`,
          edital_id: "e1",
          edital: "Edital fictício 01/2099",
          cargo: `Cargo ${cargo}`,
          codigo_vaga: `${cargo}${i}`,
          modalidade: "Ampla Concorrência",
          lista_ativa: true,
          status: "",
        })),
      ),
      ...Array.from({ length: 10 }, (_, i) => ({
        candidato_id: `2-D-${i}`,
        edital_id: "e2",
        edital: "Edital fictício 02/2099",
        cargo: "Cargo D",
        codigo_vaga: `D${i}`,
        modalidade: "Ampla Concorrência",
        lista_ativa: true,
        status: "",
      })),
    ];
    const resumo = montarResumoPorCargoEStatus({
      candidatos,
      situacoes: new Map(),
      rotulosDosEditais: new Map([
        ["e1", "01/2099"],
        ["e2", "02/2099"],
      ]),
    });

    it("corta em grupos inteiros, e o edital só fecha quando todos os grupos entram", () => {
      const primeiras = resumoAteOLimite(resumo, 50);
      expect(primeiras.total).toBe(100);
      expect(primeiras.mostradas).toBe(60);
      expect(primeiras.editais).toHaveLength(1);
      expect(primeiras.editais[0]?.grupos.map((g) => g.linhas.length)).toEqual([
        30, 30,
      ]);
      expect(primeiras.editais[0]?.completo).toBe(false);

      const todas = resumoAteOLimite(resumo, 100);
      expect(todas.mostradas).toBe(100);
      expect(todas.editais.map((e) => e.completo)).toEqual([true, true]);
    });

    it("mostra pelo menos um grupo, mesmo maior que o limite", () => {
      const um = resumoAteOLimite(resumo, 10);
      expect(um.mostradas).toBe(30);
      expect(um.editais[0]?.grupos).toHaveLength(1);
    });
  });
});

bloco("modulos/conducao-nao-volta-ao-edital-antigo", () => {
  /*
  Gravar no edital A e trocar para o B enquanto a gravação corre (o seletor
  não trava durante a ação): quando a resposta de A chega, a tela fica no B.
  Antes, "Classificar etapa" e o conflito de versão do "Convocar" chamavam
  abrirEdital(A) e a tela pulava de volta para o edital anterior.
*/

  type Resposta = { data: unknown; error: unknown };
  type Pendente = {
    nome: string;
    argumentos: Record<string, unknown> | undefined;
    responder: (r: Resposta) => void;
  };

  function bancoControlado() {
    const pendentes: Pendente[] = [];
    const cliente: ClienteDaConducao = {
      rpc: (nome, argumentos) =>
        new Promise<Resposta>((responder) =>
          pendentes.push({ nome, argumentos, responder }),
        ),
    };
    return { cliente, pendentes };
  }

  const esperar = () => new Promise((r) => setTimeout(r, 0));

  const edital = (id: string) => ({
    edital: { id },
    pode_editar: true,
    lista_convocacao: { lista: { id: `lista-${id}` } },
    convocados: [],
  });
  const previsao = {
    situacao: "NAO_INFORMADA",
    motivo: null,
    pode_alterar: true,
  };

  /* Responde as leituras de abrir um edital (as escritas ficam na fila). */
  async function responderLeituras(pendentes: Pendente[]) {
    for (let volta = 0; volta < 5; volta += 1) {
      await esperar();
      for (const p of [...pendentes]) {
        const id = String(p.argumentos?.p_edital ?? "");
        const resposta =
          p.nome === "obter_entrevistas_do_edital"
            ? edital(id)
            : p.nome === "obter_previsao_entrevista_edital"
              ? previsao
              : p.nome === "obter_agenda_entrevista"
                ? null
                : undefined;
        if (resposta === undefined) continue;
        pendentes.splice(pendentes.indexOf(p), 1);
        p.responder({ data: resposta, error: null });
      }
    }
  }

  async function abrirNoEditalA() {
    const { cliente, pendentes } = bancoControlado();
    const conducao = criarEstadoDaConducao({
      supabase: cliente,
      toast: () => {},
      tempoLimiteMs: 10_000,
    });
    const abrindo = conducao.abrirEdital("A");
    await responderLeituras(pendentes);
    await abrindo;
    expect(conducao.obter().editalId).toBe("A");
    return { conducao, pendentes };
  }

  async function trocarParaB(
    conducao: ReturnType<typeof criarEstadoDaConducao>,
    pendentes: Pendente[],
  ) {
    const abrindo = conducao.abrirEdital("B");
    await responderLeituras(pendentes);
    await abrindo;
    expect(conducao.obter().editalId).toBe("B");
  }

  function gravacao(pendentes: Pendente[], nome: string) {
    const p = pendentes.find((x) => x.nome === nome);
    if (!p) throw new Error(`sem a chamada ${nome}`);
    pendentes.splice(pendentes.indexOf(p), 1);
    return p;
  }

  describe("Condução: gravar no edital A e trocar para o B no meio", () => {
    it("Classificar etapa: a resposta de A não reabre A", async () => {
      const { conducao, pendentes } = await abrirNoEditalA();
      const salvando = conducao.definirPrevisao("PREVISTA", "conferido");
      await esperar();
      const escrita = gravacao(pendentes, "definir_previsao_entrevista_edital");
      expect(escrita.argumentos?.p_edital).toBe("A");

      await trocarParaB(conducao, pendentes);
      escrita.responder({ data: null, error: null });
      await responderLeituras(pendentes);
      await salvando;

      expect(conducao.obter().editalId).toBe("B");
      expect(conducao.obter().edital?.edital?.id).toBe("B");
      expect(
        pendentes.filter((p) => p.argumentos?.p_edital === "A"),
      ).toHaveLength(0);
    });

    it("Convocar com conflito de versão: relê só se A ainda está na tela", async () => {
      const { conducao, pendentes } = await abrirNoEditalA();
      const convocando = conducao.convocar(["analise-1"]);
      await esperar();
      const escrita = gravacao(pendentes, "convocar_para_entrevista");

      await trocarParaB(conducao, pendentes);
      escrita.responder({
        data: null,
        error: { code: CONFLITO_DE_VERSAO, message: "lista mudou" },
      });
      await responderLeituras(pendentes);
      await convocando;

      expect(conducao.obter().editalId).toBe("B");
      expect(conducao.obter().edital?.edital?.id).toBe("B");
    });

    it("Classificar etapa sem trocar de edital continua relendo A", async () => {
      const { conducao, pendentes } = await abrirNoEditalA();
      const salvando = conducao.definirPrevisao("PREVISTA", "conferido");
      await esperar();
      gravacao(pendentes, "definir_previsao_entrevista_edital").responder({
        data: null,
        error: null,
      });
      await responderLeituras(pendentes);
      expect(await salvando).toEqual({ ok: true });
      expect(conducao.obter().editalId).toBe("A");
    });
  });
});

bloco("modulos/conducao-sem-rede-abre-a-copia", () => {
  /*
  Fila do dia e ficha sem rede: a cada leitura com rede, a lista de editais e o
  edital aberto (convocados, agenda, previsão) ficam no aparelho; sem rede, a
  condução abre dessa cópia, só para consulta, com a data dela (`copiaDe`).
  Outro erro (banco, permissão) continua erro: a cópia é só para a rede caída.
*/

  const SEM_REDE = { message: "TypeError: Failed to fetch", code: "" };
  const GUARDADO_EM = Date.UTC(2026, 10, 17, 13, 14);

  const EDITAIS = {
    admin_global: false,
    editais: [{ id: "E1", edital: "101/2026", unidade: "DSEI Xingu" }],
  };
  const EDITAL = {
    edital: { id: "E1", edital: "101/2026" },
    pode_editar: true,
    lista_convocacao: { lista: { id: "lista-E1" } },
    convocados: [{ id: "c1", candidato: "Ana Teste", banca: 1 }],
  };
  const PREVISAO = { situacao: "PREVISTA", motivo: null, pode_alterar: false };
  const AGENDA = { itens: [] };

  function banco(respostas: Record<string, unknown> | null, erro = SEM_REDE) {
    const cliente: ClienteDaConducao = {
      rpc: vi.fn(async (nome: string) =>
        respostas && nome in respostas
          ? { data: respostas[nome], error: null }
          : { data: null, error: respostas ? { code: "PGRST202" } : erro },
      ),
    };
    return cliente;
  }

  function copiasEmMemoria() {
    const dados = new Map<string, unknown>();
    const copias: CopiasDaConducao = {
      ler: async (chave) =>
        dados.has(chave)
          ? {
              payload: structuredClone(dados.get(chave)),
              guardadoEm: GUARDADO_EM,
            }
          : null,
      guardar: async (chave, payload) => {
        dados.set(chave, structuredClone(payload));
      },
    };
    return { dados, copias };
  }

  const COM_REDE = {
    listar_editais_entrevista: EDITAIS,
    obter_entrevistas_do_edital: EDITAL,
    obter_previsao_entrevista_edital: PREVISAO,
    obter_agenda_entrevista: AGENDA,
  };

  async function guardarComRede(copias: CopiasDaConducao) {
    const conducao = criarEstadoDaConducao({
      supabase: banco(COM_REDE),
      copias,
      toast: () => {},
    });
    await conducao.carregarEditais("saude-indigena");
    expect(await conducao.abrirEdital("E1")).toBe(true);
    expect(conducao.obter().copiaDe).toBeNull();
    await new Promise((r) => setTimeout(r, 0));
  }

  describe("condução de entrevistas sem rede", () => {
    it("com rede guarda a lista e o edital; sem rede abre deles, com a data", async () => {
      const { dados, copias } = copiasEmMemoria();
      await guardarComRede(copias);
      expect([...dados.keys()].sort()).toEqual([
        "editais:saude-indigena:janela",
        "edital:E1",
      ]);

      const toast = vi.fn();
      const semRede = criarEstadoDaConducao({
        supabase: banco(null),
        copias,
        toast,
      });
      const lista = await semRede.carregarEditais("saude-indigena");
      expect(lista.map((e) => e.id)).toEqual(["E1"]);
      expect(semRede.obter().editais.erro).toBe("");
      expect(semRede.obter().copiaDe).toBe(GUARDADO_EM);

      expect(await semRede.abrirEdital("E1")).toBe(true);
      const e = semRede.obter();
      expect(e.erroDoEdital).toBe("");
      expect(e.carregandoEdital).toBe(false);
      expect(e.copiaDe).toBe(GUARDADO_EM);
      expect(e.edital?.convocados?.[0]?.candidato).toBe("Ana Teste");
      expect(e.previsao?.situacao).toBe("PREVISTA");
      // A ficha abre do edital guardado.
      semRede.abrirFicha("c1");
      expect(semRede.obter().fichaAberta).toBe("c1");
      expect(toast).not.toHaveBeenCalled();
    });

    it("sem rede e sem cópia, o erro de sempre", async () => {
      const semRede = criarEstadoDaConducao({
        supabase: banco(null),
        copias: copiasEmMemoria().copias,
        toast: () => {},
      });
      expect(await semRede.carregarEditais("saude-indigena")).toEqual([]);
      expect(semRede.obter().editais.erro).toMatch(
        /^Não foi possível carregar os editais/,
      );
      expect(await semRede.abrirEdital("E1")).toBe(false);
      expect(semRede.obter().erroDoEdital).not.toBe("");
      expect(semRede.obter().copiaDe).toBeNull();
    });

    it("erro do banco (não de rede) não abre a cópia", async () => {
      const { copias } = copiasEmMemoria();
      await guardarComRede(copias);
      const comErro = criarEstadoDaConducao({
        supabase: banco(null, { message: "falhou", code: "P0001" }),
        copias,
        toast: () => {},
      });
      expect(await comErro.abrirEdital("E1")).toBe(false);
      expect(comErro.obter().edital).toBeNull();
      expect(comErro.obter().copiaDe).toBeNull();
    });

    it("Levar para o campo: relê com rede, guarda só a banca de quem avalia e confirma", async () => {
      const { dados, copias } = copiasEmMemoria();
      const EDITAL_COM_BANCAS = {
        ...EDITAL,
        meu_perfil: "perfil-ana",
        avaliadores: [
          { id: "a1", perfil: "perfil-ana", banca: 2, ativo: true },
          { id: "a2", perfil: "outro", banca: 1, ativo: true },
        ],
        convocados: [
          { id: "c1", candidato: "Pessoa da banca 1", banca: 1 },
          { id: "c2", candidato: "Pessoa da banca 2", banca: 2 },
        ],
      };
      const toast = vi.fn();
      const conducao = criarEstadoDaConducao({
        supabase: banco({
          ...COM_REDE,
          obter_entrevistas_do_edital: EDITAL_COM_BANCAS,
          obter_agenda_entrevista: {
            itens: [
              { analise_id: "x1", banca: 1 },
              { analise_id: "x2", banca: 2 },
            ],
          },
        }),
        copias,
        toast,
      });
      await conducao.abrirEdital("E1");
      // Na tela, o edital inteiro; no aparelho, só a banca 2.
      expect(conducao.obter().edital?.convocados).toHaveLength(2);
      expect(await conducao.levarParaOCampo()).toEqual({ ok: true });
      const guardado = dados.get("edital:E1") as {
        resposta: { convocados: { id: string }[] };
        agenda: { itens: { analise_id: string }[] };
        calculo: unknown;
      };
      expect(guardado.resposta.convocados.map((c) => c.id)).toEqual(["c2"]);
      expect(guardado.agenda.itens.map((i) => i.analise_id)).toEqual(["x2"]);
      expect(guardado.calculo).toBeNull();
      expect(toast).toHaveBeenLastCalledWith(
        expect.stringMatching(
          /^Pronto para o campo: a fila e as fichas da sua banca ficam neste aparelho até \d{2}\/\d{2}, \d{2}:\d{2}\.$/,
        ),
        "ok",
      );
    });

    it("Levar para o campo sem rede avisa que precisa de internet", async () => {
      const { copias } = copiasEmMemoria();
      await guardarComRede(copias);
      const toast = vi.fn();
      const semRede = criarEstadoDaConducao({
        supabase: banco(null),
        copias,
        toast,
      });
      await semRede.abrirEdital("E1");
      expect(semRede.obter().copiaDe).toBe(GUARDADO_EM);
      expect(await semRede.levarParaOCampo()).toEqual({
        erro: "Sem conexão: abra o edital com internet para levar ao campo.",
      });
      expect(toast).toHaveBeenCalledWith(
        "Sem conexão: abra o edital com internet para levar ao campo.",
        "warn",
      );
    });
  });
});

bloco("reabertura-da-entrevista", () => {
  /*
  Concluir e reabrir a entrevista (20261117050000): a lista de motivos da
  tela é a mesma do banco (private."FC_MOTIVO_REABERTURA_ENTREVISTA", lida no
  retrato de produção), as regras do texto são as da Avaliação documental e o
  Concluir só aparece com o resultado definido e tudo salvo.
*/

  const RETRATO = "supabase/esquema-atual.sql";

  describe("motivos da reabertura da entrevista", () => {
    it("a lista da tela é a do banco (códigos, rótulos e ordem)", () => {
      const sql = readFileSync(RETRATO, "utf8");
      const corpo = sql.slice(
        sql.indexOf(
          'CREATE FUNCTION private."FC_MOTIVO_REABERTURA_ENTREVISTA"',
        ),
      );
      const doBanco = [
        ...corpo
          .slice(0, corpo.indexOf("end;"))
          .matchAll(/when '([A-Z_]+)' then '([^']+)'/g),
      ].map(([, codigo, rotulo]) => ({ codigo, rotulo }));
      expect(doBanco.length).toBeGreaterThan(0);
      expect(
        MOTIVOS_DA_REABERTURA_DA_ENTREVISTA.map(({ codigo, rotulo }) => ({
          codigo,
          rotulo,
        })),
      ).toEqual(doBanco);
    });

    it("motivo obrigatório; complemento opcional; Outro pede a descrição", () => {
      expect(validarReaberturaDaEntrevista("", "")).toMatchObject({
        ok: false,
        campo: "motivo",
      });
      expect(validarReaberturaDaEntrevista("DOCUMENTO_NOVO", "")).toMatchObject(
        {
          ok: false,
          campo: "motivo",
        },
      );
      expect(validarReaberturaDaEntrevista("NOTA", "")).toEqual({
        ok: true,
        argumentos: { p_motivo: "NOTA", p_complemento: null },
        texto: "Correção de nota",
      });
      expect(
        validarReaberturaDaEntrevista("RECURSO", " recurso 12 deferido "),
      ).toEqual({
        ok: true,
        argumentos: {
          p_motivo: "RECURSO",
          p_complemento: "recurso 12 deferido",
        },
        texto: "Recurso deferido — recurso 12 deferido",
      });
      expect(validarReaberturaDaEntrevista("OUTRO", "curto")).toMatchObject({
        ok: false,
        campo: "complemento",
      });
      expect(
        validarReaberturaDaEntrevista("OUTRO", "pedido da banca para revisar"),
      ).toMatchObject({
        ok: true,
        texto: "Outro — pedido da banca para revisar",
      });
    });
  });

  describe("concluir a entrevista", () => {
    const pronta = {
      podeEditar: true,
      concluida: false,
      sujo: false,
      pendencia: "",
      compareceu: "S",
    };

    it("só com o resultado definido, tudo salvo e quem edita", () => {
      expect(podeConcluirAEntrevista(pronta)).toBe(true);
      expect(podeConcluirAEntrevista({ ...pronta, compareceu: "N" })).toBe(
        true,
      );
      expect(podeConcluirAEntrevista({ ...pronta, podeEditar: false })).toBe(
        false,
      );
      expect(podeConcluirAEntrevista({ ...pronta, concluida: true })).toBe(
        false,
      );
      expect(podeConcluirAEntrevista({ ...pronta, sujo: true })).toBe(false);
      expect(
        podeConcluirAEntrevista({ ...pronta, pendencia: "falta 1 nota" }),
      ).toBe(false);
      expect(podeConcluirAEntrevista({ ...pronta, compareceu: null })).toBe(
        false,
      );
    });

    it("concluída é quem tem a data da conclusão", () => {
      expect(
        entrevistaConcluida({ concluida_em: "2026-11-17T12:00:00Z" }),
      ).toBe(true);
      expect(entrevistaConcluida({ concluida_em: null })).toBe(false);
      expect(entrevistaConcluida(null)).toBe(false);
    });
  });
});

bloco("status-em-lote-dos-aprovados", () => {
  /*
  Status em lote na aba Aprovados (11/11/2026): quem muda e quem fica de fora
  segue as regras da mudança de um candidato (e o banco as repete).
*/

  const editor = { perfil: "usuario", permissoes: { aprovados: "editor" } };
  const admin = { perfil: "usuario", permissoes: { aprovados: "admin" } };
  const leitor = { perfil: "usuario", permissoes: { aprovados: "leitor" } };

  const c = (id: string, status: string | null, extra = {}) => ({
    candidato_id: id,
    nome: `Pessoa ${id}`,
    edital: "93/2026",
    status,
    lista_ativa: true,
    ...extra,
  });

  describe("status que cada perfil escolhe no lote", () => {
    it("editor: Convocado, Desistente e Documentação Rejeitada; admin também sem status", () => {
      expect(statusDoLotePara(editor)).toEqual([
        "Convocado",
        "Desistente",
        "Documentação Rejeitada",
      ]);
      expect(statusDoLotePara(admin)).toContain(SEM_STATUS_EM_LOTE);
      expect(statusDoLotePara(leitor)).toEqual([]);
    });

    it("Contratado e Migração nunca entram (pedem a matrícula de cada um)", () => {
      expect(statusDoLotePara(admin)).not.toContain("Contratado");
      expect(statusDoLotePara(admin)).not.toContain("Migração");
    });
  });

  describe("planejarStatusEmLote", () => {
    const selecao = [
      c("1", null),
      c("2", "Convocado"),
      c("3", "Desistente"),
      c("4", "Contratado"),
      c("5", null, { lista_ativa: false }),
    ];

    it("editor: muda quem está sem status ou Convocado; o resto fica de fora com o motivo", () => {
      const plano = planejarStatusEmLote(editor, selecao, "Desistente");
      expect(plano.alterar.map((x) => x.candidato_id)).toEqual(["1", "2"]);
      expect(plano.fora).toEqual([
        {
          candidato_id: "3",
          nome: "Pessoa 3",
          motivo: "Já está como Desistente",
        },
        {
          candidato_id: "4",
          nome: "Pessoa 4",
          motivo: "Status já definido (Contratado): só o admin muda",
        },
        {
          candidato_id: "5",
          nome: "Pessoa 5",
          motivo: "Lista inativa ou substituída",
        },
      ]);
    });

    it("admin muda status já definido; só não muda quem já está no status ou em lista inativa", () => {
      const plano = planejarStatusEmLote(admin, selecao, "Desistente");
      expect(plano.alterar.map((x) => x.candidato_id)).toEqual(["1", "2", "4"]);
      expect(plano.fora.map((f) => f.candidato_id)).toEqual(["3", "5"]);
    });

    it("sem status: só o admin, e quem já está sem status fica de fora", () => {
      expect(
        planejarStatusEmLote(editor, selecao, SEM_STATUS_EM_LOTE).alterar,
      ).toEqual([]);
      const plano = planejarStatusEmLote(admin, selecao, SEM_STATUS_EM_LOTE);
      expect(plano.alterar.map((x) => x.candidato_id)).toEqual(["2", "3", "4"]);
      expect(plano.fora[0]?.motivo).toBe("Já está sem status");
    });

    it("leitor: ninguém muda", () => {
      const plano = planejarStatusEmLote(leitor, selecao, "Convocado");
      expect(plano.alterar).toEqual([]);
      expect(
        plano.fora.every((f) => f.motivo.startsWith("Sem permissão")),
      ).toBe(true);
    });
  });

  describe("textos da confirmação", () => {
    it("resume o status de hoje e os motivos de fora", () => {
      expect(
        resumoDoStatusAtual([c("1", null), c("2", null), c("3", "Convocado")]),
      ).toBe("2 sem status · 1 Convocado");
      expect(
        motivosDeFora([
          { candidato_id: "1", nome: "", motivo: "Já está como Desistente" },
          { candidato_id: "2", nome: "", motivo: "Já está como Desistente" },
        ]),
      ).toEqual(["Já está como Desistente (2)"]);
    });

    it("o botão diz quantos e para onde; os editais da seleção", () => {
      expect(textoDaConfirmacaoDoLote(37, "Desistente")).toBe(
        "Mudar 37 candidatos para Desistente",
      );
      expect(textoDaConfirmacaoDoLote(1, "Convocado")).toBe(
        "Mudar 1 candidato para Convocado",
      );
      expect(textoDaConfirmacaoDoLote(1200, "")).toBe(
        "Deixar 1.200 candidatos sem status",
      );
      expect(editaisDoLote([c("1", null)])).toBe("Edital 93/2026");
      expect(
        editaisDoLote([c("1", null), c("2", null, { edital: "94/2026" })]),
      ).toBe("2 editais");
    });

    it("o teto é o do banco", () => {
      expect(LIMITE_DO_LOTE).toBe(500);
    });
  });
});
