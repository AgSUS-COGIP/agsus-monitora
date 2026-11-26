// @vitest-environment jsdom
import { bloco } from "./apoio/bloco.ts";
import { act, createElement, type ReactElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  beforeAll,
} from "vitest";
import { definido } from "./definido.ts";
import {
  clicar,
  digitar,
  esperar,
  escolher,
  teclar,
} from "./componentes/interacoes.ts";
import {
  definirAreaAtual,
  definirAreasDoUsuario,
  redefinirDadosDoMonitoramento,
  publicarLinhasDoMonitoramento,
  publicarUnidadesDoCatalogo,
} from "../src/componentes/dados-do-monitoramento.ts";
import { criarCalendarioEditais } from "../src/modulos/cronograma/calendario-editais.tsx";
import { montarTela, desenharNoTeste } from "./montar-tela.ts";
import { type OpcoesDaTelaDoCalendario } from "../src/modulos/cronograma/tipos.ts";
import { consumirPedidoDeFiltro } from "../src/app/pedido-de-filtro.ts";
import {
  type EstadoDoResumoDoDia,
  criarEstadoDoResumoDoDia,
} from "../src/modulos/resumo-do-dia/estado.ts";
import {
  ResponsaveisDoEdital,
  type ClienteDosResponsaveis,
} from "../src/modulos/editais/responsaveis-do-edital.tsx";
import {
  criarNucleo,
  type OpcoesDaPaginaDoNucleo,
} from "../src/modulos/editais/nucleo.tsx";
import {
  authFalso,
  sessaoFalsa,
  type OuvinteDaSessao,
} from "./supabase-falso.ts";
import { type RespostaDaRpc } from "../src/modulos/editais/resumo.ts";
import {
  type ControladoresDasTelas,
  type ViewDeTela,
  registrarTelas,
} from "../src/app/registro-das-telas.ts";
import { type AuthChangeEvent } from "@supabase/supabase-js";
import { UNIDADES_CORES } from "../src/lib/editais/responsavel-do-edital.ts";
import { criarNavegacao } from "../src/app/navegacao.ts";
import { montarTelasNoTeste } from "./app/telas-no-teste.ts";
import {
  montarEtapasDosEditais,
  montarGradeDoMes,
} from "../src/lib/cronograma/calendario-editais.ts";
import { GradeDoMes } from "../src/modulos/cronograma/partes.tsx";
import {
  criarPaineisDeDados,
  type ApoioDoRelatorio,
} from "../src/modulos/paineis-de-dados/paineis-de-dados.tsx";
import { type LinhaDaVisaoGeral } from "../src/modulos/visao-geral/tipos.ts";
import {
  MENSAGEM_SEM_PERMISSAO,
  MENSAGEM_SEM_PUBLICACAO,
} from "../src/modulos/paineis-de-dados/estado.ts";
import { strFromU8, unzipSync } from "fflate";
import { paginasPermitidas } from "../src/lib/acessos/access-roles.ts";
import { bloqueioDaTela } from "../src/lib/navegacao/navegacao.ts";
import {
  caminhoDoDestino,
  destinoDoCaminho,
  telaDaRota,
} from "../src/lib/navegacao/rotas.ts";
import {
  catalogoPermitido,
  ehIdDoRelatorio,
  ehRelatorioDoEndereco,
  gruposDoCatalogo,
} from "../src/lib/paineis/catalogo-dos-relatorios.ts";
import {
  buscaDoRelatorio,
  editaisDoEndereco,
} from "../src/lib/paineis/endereco-dos-relatorios.ts";
import { abrirEmRelatorios } from "../src/componentes/ver-em-relatorios.tsx";
import { escolhaDaDiretoria } from "../src/modulos/paineis-de-dados/gerar-relatorio.ts";
import { recorteDaAreaInteira } from "../src/lib/paineis/relatorio-da-visao-geral.ts";
import type { IdDoRelatorio } from "../src/lib/paineis/relatorios-dos-paineis.ts";
import {
  type NiveisPorRecurso,
  type PerfilDeAcesso,
} from "../src/lib/acessos/tipos-dos-acessos.ts";
import fs from "node:fs";
import path from "node:path";
import {
  ESTILO_SOLIDO,
  ESTILO_VIDRO,
  avaliarCor,
  normalizarEstilo,
} from "../src/lib/base/contraste.ts";
import { mapearBrandingPublico } from "../src/lib/entrada/access-branding-publico.ts";
import { aplicarEstiloDoPainel } from "../src/app/entrada/marca.ts";
import {
  QuadroSalvo,
  type EstadoDaRetificacaoDoQuadro,
} from "../src/modulos/editais/retificar-quadro.tsx";
import {
  VinculosDoQuadro,
  type EstadoDosVinculos,
} from "../src/modulos/editais/vinculos-do-quadro.tsx";
import { ContextoDoApp } from "../src/app/contexto-do-app.ts";
import { avisar } from "../src/app/avisos.ts";
import { ESTADO_INICIAL_DA_NAVEGACAO } from "../src/app/navegacao.ts";
import type {
  EstadoDaNavegacao,
  LeituraDaNavegacao,
} from "../src/app/navegacao.ts";
import {
  PaginaDoEdital,
  criarPaginaDoEdital,
} from "../src/modulos/pagina-do-edital/pagina-do-edital.tsx";
import { criarEstadoDaPaginaDoEdital } from "../src/modulos/pagina-do-edital/estado.ts";
import { abrirPaginaDoEdital } from "../src/modulos/pagina-do-edital/abrir.ts";
import type { ClienteDaPaginaDoEdital } from "../src/modulos/pagina-do-edital/estado.ts";
import {
  EncerradosDoCronograma,
  type ClienteDosEncerrados,
} from "../src/modulos/editais/encerrados-do-cronograma.tsx";

bloco("componentes/avisos-de-conferencia", async () => {
  /*
    Avisos de conferência (React, src/modulos/conferencias/): o selo de cada
    tela pede só os avisos do módulo na área atual, some sem aviso e abre a
    gaveta; o cartão do Status das atualizações filtra por módulo e agrupa por
    edital; a central de avisos (20261118140000): dispensar exige justificativa e
    relê a lista; o gestor atribui responsável e prazo; evidência de um caso; o
    histórico.
  */

  const { SeloDeAvisos, CartaoDeAvisos } =
    await import("../src/modulos/conferencias/avisos-de-conferencia.tsx");
  const { esquecerAvisosGuardados, criarEstadoDosAvisos } =
    await import("../src/modulos/conferencias/estado.ts");

  const aviso = (extra: Record<string, unknown> = {}) => ({
    id: "a1",
    conferencia: "ANALISE_APROVADA_ABAIXO_DO_CORTE",
    escopo: "edital:e1",
    gravidade: "CRITICA",
    modulo: "analises",
    area: "saude-indigena",
    edital_id: "e1",
    edital: "101/2026",
    quantidade: 3,
    exemplos: ["00000000-0000-4000-a000-0000000000a1"],
    resumo: "3 análises aprovadas com nota abaixo de 60 no edital 101/2026.",
    situacao: "ABERTO",
    primeira_vez: "2026-10-05T09:00:00Z",
    ultima_vez: "2026-10-06T09:00:00Z",
    tratamento: "PENDENTE",
    pode_gerir: true,
    pode_tratar: true,
    ...extra,
  });

  /* Os parâmetros que as RPCs dos avisos recebem (o falso só lê a versão). */
  type ParametrosDosAvisos = {
    p_versao?: string | null;
    [parametro: string]: unknown;
  };

  function supabaseFalso(avisos: () => unknown[]) {
    return {
      rpc: vi.fn(async (nome: string, _argumentos?: ParametrosDosAvisos) => {
        if (nome === "listar_avisos_conferencia_se_mudou")
          return { data: { avisos: avisos() }, error: null };
        if (nome === "listar_responsaveis_aviso_conferencia")
          return {
            data: [{ id: "u1", nome: "Pessoa Fictícia" }],
            error: null,
          };
        if (nome === "listar_casos_aviso_conferencia")
          return {
            data: {
              total: 1,
              casos: [
                {
                  aviso_id: "a1",
                  ordem: 1,
                  conferencia: "ANALISE_APROVADA_ABAIXO_DO_CORTE",
                  analise_id: "an1",
                  codigo: "4512",
                  nome: "Pessoa Fictícia",
                },
              ],
            },
            error: null,
          };
        if (nome === "listar_historico_aviso_conferencia")
          return {
            data: {
              eventos: [
                {
                  id: 2,
                  evento: "TRATAMENTO",
                  tratamento: "DISPENSADO",
                  motivo: "Conferido com a banca.",
                  por: "Pessoa Fictícia",
                  em: "2026-10-06T10:00:00Z",
                },
                { id: 1, evento: "ACHADO", quantidade: 3, robo: true },
              ],
              evidencias: [],
            },
            error: null,
          };
        return { data: { id: "a1" }, error: null };
      }),
    };
  }

  const botao = (dentro: Element, texto: string) =>
    [...dentro.querySelectorAll("button")].find((b) =>
      b.textContent?.includes(texto),
    );

  let raiz: HTMLDivElement | undefined;
  let montagem: Root | undefined;

  async function montar(elemento: ReactElement) {
    const novaRaiz = document.createElement("div");
    raiz = novaRaiz;
    document.body.append(novaRaiz);
    const novaMontagem = createRoot(novaRaiz);
    montagem = novaMontagem;
    await act(async () => novaMontagem.render(elemento));
    await esperar();
  }

  beforeEach(() => {
    sessionStorage.clear();
    esquecerAvisosGuardados();
    definirAreasDoUsuario(["saude-indigena"]);
    definirAreaAtual("saude-indigena");
  });

  afterEach(async () => {
    await act(async () => montagem?.unmount());
    raiz?.remove();
    document.body.innerHTML = "";
    redefinirDadosDoMonitoramento();
  });

  describe("selo de avisos no topo da tela", () => {
    it("pede os avisos do módulo na área atual e abre a gaveta", async () => {
      const supabase = supabaseFalso(() => [aviso()]);
      await montar(
        createElement(SeloDeAvisos, { modulo: "analises", supabase }),
      );
      expect(supabase.rpc).toHaveBeenCalledWith(
        "listar_avisos_conferencia_se_mudou",
        { p_area: "saude-indigena", p_modulo: "analises", p_versao: null },
      );
      const selo = document.querySelector(".conf-selo-do-modulo");
      expect(selo?.textContent).toContain("1 aviso");
      expect(selo?.className).toContain("conf-selo-do-modulo--perigo");
      await clicar(selo);
      expect(document.body.textContent).toContain(
        "Aprovada com nota abaixo da mínima",
      );
      expect(document.body.textContent).toContain("Edital 101/2026");
    });

    it("sem aviso aberto, não aparece", async () => {
      const supabase = supabaseFalso(() => []);
      await montar(
        createElement(SeloDeAvisos, { modulo: "entrevistas", supabase }),
      );
      expect(document.querySelector(".conf-selo-do-modulo")).toBeNull();
    });
  });

  describe("cartão do Status das atualizações", () => {
    it("filtra por módulo, agrupa por edital e dispensa com justificativa", async () => {
      let dispensado = false;
      const supabase = supabaseFalso(() => [
        aviso(
          dispensado
            ? {
                tratamento: "DISPENSADO",
                motivo: "Conferido com a banca.",
              }
            : {},
        ),
        aviso({
          id: "a2",
          conferencia: "CARGA_VARIACAO_BRUSCA",
          escopo: "vaga:177979",
          gravidade: "ATENCAO",
          modulo: "cargas",
          area: null,
          edital_id: null,
          edital: null,
          pode_gerir: false,
          pode_tratar: false,
        }),
      ]);
      await montar(createElement(CartaoDeAvisos, { supabase }));
      expect(supabase.rpc).toHaveBeenCalledWith(
        "listar_avisos_conferencia_se_mudou",
        { p_area: null, p_modulo: null, p_versao: null },
      );
      expect(document.querySelectorAll(".conf-aviso")).toHaveLength(2);
      expect(
        [...document.querySelectorAll(".conf-grupo__titulo")].map(
          (t) => t.firstChild?.textContent,
        ),
      ).toEqual(["Edital 101/2026", "Vaga 177979"]);
      expect(document.body.textContent).toContain("rechecado em 06/10/2026");

      await clicar(document.querySelector('[data-valor="cargas"]'));
      expect(document.querySelectorAll(".conf-aviso")).toHaveLength(1);
      // Sem permissão, nada de "Tratar".
      expect(
        botao(definido(document.querySelector(".conf-aviso")), "Tratar"),
      ).toBeUndefined();
      await clicar(document.querySelector('[data-valor="todos"]'));

      const analise = definido(
        document.querySelector(
          '[data-conferencia="ANALISE_APROVADA_ABAIXO_DO_CORTE"]',
        ),
      );
      await clicar(botao(analise, "Tratar"));
      await escolher(analise.querySelector("select"), "DISPENSADO");
      await clicar(botao(analise, "Salvar situação"));
      expect(analise.textContent).toContain("pelo menos 10");
      expect(supabase.rpc).not.toHaveBeenCalledWith(
        "tratar_aviso_conferencia",
        expect.anything(),
      );

      await digitar(
        analise.querySelector("textarea"),
        "Conferido com a banca.",
      );
      dispensado = true;
      await clicar(botao(analise, "Salvar situação"));
      await esperar();
      expect(supabase.rpc).toHaveBeenCalledWith("tratar_aviso_conferencia", {
        p_id: "a1",
        p_tratamento: "DISPENSADO",
        p_motivo: "Conferido com a banca.",
      });
      expect(document.body.textContent).toContain("Dispensados (1)");
    });

    it("o gestor atribui responsável e prazo; prazo vencido em destaque", async () => {
      const supabase = supabaseFalso(() => [
        aviso({
          responsavel_id: "u1",
          responsavel: "Pessoa Fictícia",
          prazo: "2026-01-02",
        }),
      ]);
      await montar(createElement(CartaoDeAvisos, { supabase }));
      expect(
        document.querySelector(".conf-prazo--vencido")?.textContent,
      ).toContain("02/01/2026");
      const selo = document.querySelector(".ui-selo-de-prazo");
      expect(selo?.getAttribute("data-faixa")).toBe("vencido");
      expect(selo?.textContent).toMatch(/^Venceu há \d/);
      const item = definido(document.querySelector(".conf-aviso"));
      await clicar(botao(item, "Tratar"));
      await esperar();
      expect(supabase.rpc).toHaveBeenCalledWith(
        "listar_responsaveis_aviso_conferencia",
        { p_id: "a1" },
      );
      const [, pessoa] = item.querySelectorAll("select");
      await escolher(pessoa, "");
      await clicar(botao(item, "Salvar responsável"));
      expect(supabase.rpc).toHaveBeenCalledWith("atribuir_aviso_conferencia", {
        p_id: "a1",
        p_responsavel: null,
        p_prazo: null,
      });
    });

    it("evidência de um caso e o histórico, que não se apaga", async () => {
      const supabase = supabaseFalso(() => [aviso()]);
      await montar(createElement(CartaoDeAvisos, { supabase }));
      const item = definido(document.querySelector(".conf-aviso"));
      await clicar(botao(item, "3 casos"));
      await esperar();
      await clicar(item.querySelector(".conf-caso__evidencia"));
      await esperar();
      expect(item.textContent).toContain("Do caso 4512 · Pessoa Fictícia");
      expect(item.textContent).toContain("Conferido com a banca.");
      expect(item.textContent).toContain("Conferência automática");
      await digitar(
        item.querySelector('.conf-painel input[type="text"]'),
        "25000.000001/2026-01",
      );
      await clicar(botao(item, "Juntar evidência"));
      expect(supabase.rpc).toHaveBeenCalledWith(
        "incluir_evidencia_aviso_conferencia",
        {
          p_id: "a1",
          p_tipo: "SEI",
          p_descricao: "25000.000001/2026-01",
          p_url: null,
          p_chave_caso: "analise:an1",
        },
      );
    });
  });

  describe("pedidos iguais juntos", () => {
    it("dois selos do mesmo recorte ao mesmo tempo fazem uma leitura só", async () => {
      const supabase = supabaseFalso(() => [aviso()]);
      const um = criarEstadoDosAvisos({ supabase });
      const outro = criarEstadoDosAvisos({ supabase });
      await Promise.all([
        um.carregar({ area: "sede", modulo: "analises" }),
        outro.carregar({ area: "sede", modulo: "analises" }),
      ]);
      const leituras = supabase.rpc.mock.calls.filter(
        ([nome]) => nome === "listar_avisos_conferencia_se_mudou",
      );
      expect(leituras).toHaveLength(1);
      expect(um.obter().lista?.abertos).toHaveLength(1);
      expect(outro.obter().lista?.abertos).toHaveLength(1);
      // Outro recorte não espera a leitura deste.
      await um.carregar({ area: "sede", modulo: "entrevistas" });
      expect(
        supabase.rpc.mock.calls.filter(
          ([nome]) => nome === "listar_avisos_conferencia_se_mudou",
        ),
      ).toHaveLength(2);
    });
  });

  describe("releitura só quando muda", () => {
    it("o selo montado de novo manda a versão; sem mudança, a mesma lista sem baixar", async () => {
      const versoes: unknown[] = [];
      const supabase = {
        rpc: vi.fn(async (nome: string, argumentos: ParametrosDosAvisos) => {
          if (nome !== "listar_avisos_conferencia_se_mudou")
            return { data: null, error: null };
          versoes.push(argumentos.p_versao);
          if (argumentos.p_versao === "v1")
            return { data: { inalterado: true, versao: "v1" }, error: null };
          return { data: { avisos: [aviso()], versao: "v1" }, error: null };
        }),
      };
      await montar(
        createElement(SeloDeAvisos, { modulo: "analises", supabase }),
      );
      expect(
        document.querySelector(".conf-selo-do-modulo")?.textContent,
      ).toContain("1 aviso");
      await act(async () => definido(montagem).unmount());
      definido(raiz).remove();
      await montar(
        createElement(SeloDeAvisos, { modulo: "analises", supabase }),
      );
      expect(versoes).toEqual([null, "v1"]);
      expect(
        document.querySelector(".conf-selo-do-modulo")?.textContent,
      ).toContain("1 aviso");
    });

    it("o cartão relê quando a marca da conferência muda, e só então", async () => {
      const supabase = supabaseFalso(() => [aviso()]);
      await montar(createElement(CartaoDeAvisos, { supabase, marca: "a" }));
      const leituras = () =>
        supabase.rpc.mock.calls.filter(
          ([nome]) => nome === "listar_avisos_conferencia_se_mudou",
        ).length;
      expect(leituras()).toBe(1);
      await act(async () =>
        definido(montagem).render(
          createElement(CartaoDeAvisos, { supabase, marca: "a" }),
        ),
      );
      expect(leituras()).toBe(1);
      await act(async () =>
        definido(montagem).render(
          createElement(CartaoDeAvisos, { supabase, marca: "b" }),
        ),
      );
      await esperar();
      expect(leituras()).toBe(2);
    });
  });
});

bloco("componentes/calendario-editais", () => {
  /*
  A tela só mostra os editais da área atual (a padrão é a Saúde Indígena); os
  editais das fixtures precisam estar nas linhas do monitoramento. Registrado
  antes dos outros ganchos, o afterEach roda depois de desmontar.
*/
  beforeEach(() =>
    publicarLinhasDoMonitoramento(
      [1, 2, 3].map((id) => ({ id, CO_AREA: "saude-indigena" })),
    ),
  );
  afterEach(() => redefinirDadosDoMonitoramento());

  /*
  O Calendário de Editais em React: a costura entre o carregamento (1 + N
  RPCs), a lógica de `src/lib/cronograma/calendario-editais.ts` e o desenho. "Hoje" é fixo
  em 15/09/2026, uma terça-feira.
*/

  const HOJE = new Date(2026, 8, 15, 10);

  interface EtapaNoTeste {
    atividade: string;
    data_inicio: string;
    data_fim: string;
    ordem: number;
  }

  /* A RPC de mentira desta tela: o nome e, por edital, o id do monitoramento. */
  type RpcDoCalendario = (
    nome: string,
    argumentos?: {
      p_monitoramento_id?: string | number;
      p_demanda?: Record<string, unknown>;
      p_id?: string;
      p_concluida?: boolean;
      p_area?: string;
      p_edital?: string | null;
    },
  ) => Promise<{ data: unknown; error: unknown }>;

  const RESUMO = [
    { id: 1, unidade: "DSEI Manaus", edital: "10/2026", cronograma_total: 3 },
    {
      id: 2,
      unidade: "CASAI São Paulo",
      edital: "11/2026",
      cronograma_total: 2,
    },
    // Sem cronograma: não custa chamada nenhuma.
    { id: 3, unidade: "DSEI Xingu", edital: "12/2026", cronograma_total: 0 },
  ];

  const CRONOGRAMAS: Record<number, EtapaNoTeste[]> = {
    1: [
      // Já passou: escondida enquanto "Ocultar concluídas" está ligada.
      {
        atividade: "Entrevista com candidatos",
        data_inicio: "2026-09-10",
        data_fim: "2026-09-10",
        ordem: 1,
      },
      {
        atividade: "Prazo de recurso do resultado preliminar",
        data_inicio: "2026-09-14",
        data_fim: "2026-09-22",
        ordem: 2,
      },
      {
        atividade: "Homologação do resultado final",
        data_inicio: "2026-09-29T00:00:00",
        data_fim: "2026-09-29",
        ordem: 3,
      },
    ],
    2: [
      {
        atividade: "Inscrições",
        data_inicio: "2026-09-22",
        data_fim: "2026-09-22",
        ordem: 1,
      },
      {
        atividade: "Entrevista",
        data_inicio: "2026-10-05",
        data_fim: "2026-10-05",
        ordem: 2,
      },
    ],
  };

  function supabaseFalso({
    erroNoResumo = null,
    falhaNoEdital = null,
  }: { erroNoResumo?: string | null; falhaNoEdital?: number | null } = {}) {
    return {
      auth: {
        getSession: async () => ({
          data: { session: { access_token: "token" } },
          error: null,
        }),
      },
      rpc: vi.fn<RpcDoCalendario>(async (nome, argumentos) => {
        if (nome === "get_nucleo_cronograma_resumo")
          return erroNoResumo
            ? { data: null, error: { message: erroNoResumo } }
            : { data: RESUMO, error: null };
        /*
        Banco sem `listar_etapas_do_cronograma` (versão anterior): o teste
        simula PGRST202, e o componente cai no caminho antigo, por edital.
      */
        if (nome === "listar_etapas_do_cronograma")
          return { data: null, error: { code: "PGRST202" } };
        const id = definido(argumentos).p_monitoramento_id;
        if (id === falhaNoEdital)
          return { data: null, error: { message: "sem permissão" } };
        return { data: { etapas: CRONOGRAMAS[Number(id)] || [] }, error: null };
      }),
    };
  }

  type ControladorDoCalendario = ReturnType<typeof criarCalendarioEditais> & {
    raiz: Root | null;
  };
  let controlador: ControladorDoCalendario | null = null;

  /* A tela com as opções do teste (os tipos que montarTela recebe). */
  const montarCalendario = (
    opcoes: OpcoesDaTelaDoCalendario & { secao?: HTMLElement | null },
  ) =>
    montarTela<
      OpcoesDaTelaDoCalendario,
      ReturnType<typeof criarCalendarioEditais>
    >(criarCalendarioEditais, "page-calendario", opcoes);

  async function montar(
    opcoes: {
      supabase?: ReturnType<typeof supabaseFalso>;
      toast?: ReturnType<
        typeof vi.fn<(mensagem: string, tom?: "warn") => void>
      >;
    } = {},
  ) {
    document.body.innerHTML = `<section id="page-calendario" class="page active"></section>`;
    const supabase = opcoes.supabase || supabaseFalso();
    const toast = opcoes.toast || vi.fn();
    await act(async () => {
      controlador = montarCalendario({
        secao: document.getElementById("page-calendario"),
        supabase,
        toast,
        agora: () => new Date(HOJE),
      });
    });
    await esperar(() => definido(controlador).render());
    return { supabase, toast };
  }

  afterEach(async () => {
    await act(async () => controlador?.raiz?.unmount());
    controlador = null;
    document.body.innerHTML = "";
  });

  const $ = (id: string) => document.getElementById(id);
  const campo = (id: string) =>
    document.querySelector<HTMLInputElement>(`#${id}`);
  const seletor = (id: string) =>
    document.querySelector<HTMLSelectElement>(`#${id}`);
  const botao = (id: string) =>
    document.querySelector<HTMLButtonElement>(`#${id}`);
  const celula = (chave: string) =>
    document.querySelector<HTMLElement>(`[data-dia="${chave}"]`);
  /* Os chips do mês desenhados no dia: "Manaus – Prazo de recurso…". */
  const chips = (chave: string) =>
    [
      ...document.querySelectorAll<HTMLElement>(
        `[data-dia="${chave}"] .cal-chip-texto`,
      ),
    ].map((chip) => chip.textContent);
  const pontaDoChip = (chave: string) =>
    [
      ...document.querySelectorAll<HTMLElement>(
        `[data-dia="${chave}"] .cal-chip`,
      ),
    ].map(
      (chip) =>
        chip.querySelector<HTMLElement>(".cal-chip-ponta")?.textContent ?? "",
    );
  const tipoNaLegenda = (id: string) =>
    document.querySelector<HTMLElement>(`#calLegenda [data-tipo="${id}"]`);
  const RECURSO = "Manaus – Prazo de recurso do resultado preliminar";
  const contador = () => $("calContador")?.textContent;
  const etapasDaLinhaDoTempo = () =>
    [
      ...document.querySelectorAll<HTMLElement>(
        "#calTimeline .cal-passo strong",
      ),
    ].map((item) => item.textContent);

  describe("carregamento", () => {
    it("Atualizar ignora o cache do minuto e mantém o mês aberto", async () => {
      const { supabase } = await montar();
      await clicar($("calMesSeguinte"));
      const mes = $("calMesTitulo")?.textContent;
      const chamadas = supabase.rpc.mock.calls.length;
      await clicar(
        document.querySelector<HTMLElement>('[data-acao="atualizar"]'),
      );
      expect(supabase.rpc.mock.calls.length).toBeGreaterThan(chamadas);
      expect($("calMesTitulo")?.textContent).toBe(mes);
    });
    it("custa 3 + N chamadas quando o banco ainda não tem a RPC em lote", async () => {
      const { supabase } = await montar();
      const nomes = supabase.rpc.mock.calls.map(([nome, args]) =>
        args ? `${nome}:${args.p_monitoramento_id}` : nome,
      );
      expect(nomes).toEqual([
        "get_nucleo_cronograma_resumo",
        "listar_etapas_do_cronograma",
        "listar_demandas_internas",
        "get_monitoramento_cronograma:1",
        "get_monitoramento_cronograma:2",
      ]);
    });

    it("com a RPC em lote, custa 3 chamadas (com as demandas) — nenhuma por edital", async () => {
      const supabase = supabaseFalso();
      supabase.rpc.mockImplementation(async (nome) => {
        if (nome === "get_nucleo_cronograma_resumo")
          return { data: RESUMO, error: null };
        if (nome === "listar_etapas_do_cronograma")
          return {
            data: Object.entries(CRONOGRAMAS).flatMap(([id, etapas]) =>
              etapas.map((etapa) => ({
                ...etapa,
                monitoramento_id: Number(id),
              })),
            ),
            error: null,
          };
        throw new Error(`RPC inesperada: ${nome}`);
      });
      await montar({ supabase });
      // A terceira, listar_demandas_internas, falha aqui: o calendário segue sem demandas.
      expect(supabase.rpc).toHaveBeenCalledTimes(3);
    });

    it("reabrir dentro do minuto não repete as chamadas; salvar cronograma invalida", async () => {
      const { supabase } = await montar();
      await esperar(() => definido(controlador).render());
      expect(supabase.rpc).toHaveBeenCalledTimes(5);

      await act(async () =>
        document.dispatchEvent(
          new CustomEvent("agsus:nucleo-cronograma-saved"),
        ),
      );
      await esperar(() => definido(controlador).render());
      expect(supabase.rpc).toHaveBeenCalledTimes(10);
    });

    it("antes da primeira carga, a grade, as listas e o contador são skeleton", async () => {
      let entregar: ((valor?: unknown) => void) | undefined;
      const supabase = supabaseFalso();
      const rpc = definido(supabase.rpc.getMockImplementation());
      supabase.rpc.mockImplementation(async (nome, argumentos) => {
        if (nome === "get_nucleo_cronograma_resumo")
          await new Promise((resolver) => (entregar = resolver));
        return rpc(nome, argumentos);
      });
      document.body.innerHTML = `<section id="page-calendario" class="page active"></section>`;
      await act(async () => {
        controlador = montarCalendario({
          secao: document.getElementById("page-calendario"),
          supabase,
          toast: vi.fn(),
          agora: () => new Date(HOJE),
        });
      });
      const pendente = definido(controlador).render();
      await esperar();
      expect($("calGrade")?.getAttribute("aria-busy")).toBe("true");
      expect(
        $("calGrade")?.querySelectorAll<HTMLElement>(".cal-celula-esqueleto"),
      ).toHaveLength(35);
      expect(
        $("calGrade")?.querySelector<HTMLElement>("[data-dia]"),
      ).toBeNull();
      expect(
        $("calProximas")?.querySelectorAll<HTMLElement>(".ui-esqueleto").length,
      ).toBe(4);
      expect(
        $("calTimeline")?.querySelectorAll<HTMLElement>(".ui-esqueleto").length,
      ).toBe(4);
      expect(contador()).toBe("");
      expect(
        document.querySelector<HTMLElement>(
          "#page-calendario [data-status-da-carga]",
        )?.textContent,
      ).toBe("Carregando dados…");

      await esperar(async () => {
        definido(entregar)();
        await pendente;
      });
      expect(
        $("calGrade")?.querySelector<HTMLElement>(".cal-celula-esqueleto"),
      ).toBeNull();
      expect(contador()).toBe("3 etapas no mês");
      expect(
        document.querySelector<HTMLElement>(
          "#page-calendario [data-status-da-carga]",
        )?.textContent,
      ).toMatch(/^Atualizado em /);
    });

    it("os filtros nascem recolhidos em Refinar resultados, com os ids de sempre", async () => {
      await montar();
      const filtros = definido(
        document.querySelector<HTMLElement>("#page-calendario .cal-filtros"),
      );
      expect(filtros.classList.contains("ui-filtros")).toBe(true);
      expect(
        filtros.querySelector<HTMLElement>(".ui-filtros-corpo")?.hidden,
      ).toBe(true);
      expect(filtros.querySelector<HTMLElement>("#calBusca")).not.toBeNull();
      await clicar(
        filtros.querySelector<HTMLElement>('[data-acao="recolher-filtros"]'),
      );
      expect(
        filtros.querySelector<HTMLElement>(".ui-filtros-corpo")?.hidden,
      ).toBe(false);
      expect(
        document.querySelector<HTMLElement>(
          "#page-calendario .cal-barra #calHoje",
        ),
      ).not.toBeNull();
    });

    it("mostra o erro no lugar da grade, com Tentar novamente", async () => {
      const supabase = supabaseFalso({ erroNoResumo: "RPC fora do ar" });
      await montar({ supabase });
      const aviso = definido(
        $("calGrade")?.querySelector<HTMLElement>('[role="alert"]'),
      );
      expect(aviso.textContent).toContain(
        "Não foi possível carregar os cronogramas: RPC fora do ar",
      );
      supabase.rpc.mockClear();
      await clicar(
        aviso.querySelector<HTMLElement>('[data-acao="tentar-novamente"]'),
      );
      expect(supabase.rpc).toHaveBeenCalledWith("get_nucleo_cronograma_resumo");
    });

    it("avisa quando um edital não pôde ser lido, e mostra os outros", async () => {
      const toast = vi.fn();
      await montar({ supabase: supabaseFalso({ falhaNoEdital: 2 }), toast });
      expect(toast).toHaveBeenCalledWith(
        "1 edital(is) não puderam ser lidos. O calendário está incompleto.",
        "warn",
      );
      expect(chips("2026-09-14")).toEqual([RECURSO]);
      expect(chips("2026-09-22")).toEqual([RECURSO]);
    });
  });

  describe("grade do mês", () => {
    beforeEach(async () => {
      await montar();
    });

    it("abre no mês de hoje, com a contagem do que está desenhado", async () => {
      expect($("calMesTitulo")?.textContent).toBe("Setembro 2026");
      // A entrevista de 10/09 já passou e está escondida.
      expect(contador()).toBe("3 etapas no mês");
      expect(celula("2026-09-15")?.classList.contains("hoje")).toBe(true);
      // Somente os 30 dias de setembro, sem datas dos meses vizinhos.
      expect(
        document.querySelectorAll<HTMLElement>(".cal-celula"),
      ).toHaveLength(30);
      expect(celula("2026-08-31")).toBeNull();
      expect(celula("2026-10-05")).toBeNull();
    });

    /*
    Sem faixas contínuas: a etapa com período é um chip no dia em que começa
    ("início") e outro no dia em que termina ("fim"); os dias do meio ficam
    sem chip, mas o dia continua a dizer (e o popup a listar) o que está em
    andamento.
  */
    it("mostra a etapa com período só no início e no fim, nada nos dias do meio", async () => {
      expect(document.querySelector<HTMLElement>(".cal-faixa")).toBeNull();
      expect(chips("2026-09-14")).toEqual([RECURSO]);
      expect(pontaDoChip("2026-09-14")).toEqual(["início"]);
      for (const meio of ["2026-09-15", "2026-09-18", "2026-09-21"])
        expect(chips(meio)).toEqual([]);
      expect(celula("2026-09-18")?.getAttribute("aria-label")).toBe(
        "18 de setembro: 1 etapa, 1 em andamento",
      );
      expect(celula("2026-09-18")?.classList.contains("vazio")).toBe(false);
      // O dia do meio abre com a etapa em andamento: nada some de fato.
      await clicar(celula("2026-09-18"));
      expect(
        document.querySelector<HTMLElement>("#calDiaLista")?.textContent,
      ).toContain("Em andamento neste dia");
      expect(
        [
          ...document.querySelectorAll<HTMLElement>(
            "#calDiaLista .cal-item strong",
          ),
        ].map((item) => item.textContent),
      ).toEqual(["Prazo de recurso do resultado preliminar"]);
      // O fim do recurso e as inscrições; a unidade sem o "DSEI " da frente.
      expect(chips("2026-09-22")).toEqual([
        RECURSO,
        "CASAI São Paulo – Inscrições",
      ]);
      // "fim" no recurso; a etapa de um dia vai sem marca.
      expect(pontaDoChip("2026-09-22")).toEqual(["fim", ""]);
      expect(chips("2026-09-23")).toEqual([]);
      expect(celula("2026-09-23")?.classList.contains("vazio")).toBe(true);
      // A data que veio como timestamp cai no dia certo.
      expect(chips("2026-09-29")).toEqual([
        "Manaus – Homologação do resultado final",
      ]);
      // O nome inteiro e o tipo ficam no title.
      expect(
        document.querySelector<HTMLElement>('[data-dia="2026-09-29"] .cal-chip')
          ?.title,
      ).toContain("DSEI Manaus · Ed. 10/2026");
    });

    it("navega entre meses e volta a hoje", async () => {
      await clicar($("calMesSeguinte"));
      expect($("calMesTitulo")?.textContent).toBe("Outubro 2026");
      expect(contador()).toBe("1 etapa no mês");
      expect(
        document.querySelectorAll<HTMLElement>(".cal-celula"),
      ).toHaveLength(31);
      expect(celula("2026-09-30")).toBeNull();
      expect(chips("2026-10-05")).toEqual(["CASAI São Paulo – Entrevista"]);
      await clicar($("calHoje"));
      expect($("calMesTitulo")?.textContent).toBe("Setembro 2026");
      expect(
        document.querySelectorAll<HTMLElement>(".cal-celula"),
      ).toHaveLength(30);
      expect(celula("2026-10-05")).toBeNull();
    });
  });

  describe("dia cheio no mês", () => {
    it("mostra três chips e '+N mais'; o dia abre com todas", async () => {
      const supabase = supabaseFalso();
      const nomes = [
        "Entrevista A",
        "Entrevista B",
        "Entrevista C",
        "Entrevista D",
        "Entrevista E",
      ];
      supabase.rpc.mockImplementation(async (nome, argumentos) => {
        if (nome === "get_nucleo_cronograma_resumo")
          return { data: RESUMO, error: null };
        if (nome === "listar_etapas_do_cronograma")
          return { data: null, error: { code: "PGRST202" } };
        if (definido(argumentos).p_monitoramento_id !== 1)
          return { data: { etapas: [] }, error: null };
        return {
          data: {
            etapas: nomes.map((atividade, indice) => ({
              atividade,
              data_inicio: "2026-09-24",
              data_fim: "2026-09-24",
              ordem: indice + 1,
            })),
          },
          error: null,
        };
      });
      await montar({ supabase });
      expect(chips("2026-09-24")).toHaveLength(3);
      const mais = definido(
        celula("2026-09-24")?.querySelector<HTMLElement>(".cal-mais"),
      );
      expect(mais.textContent).toBe("+2 mais");
      // O "+N mais" deixa o clique passar para o dia, que é o botão.
      await clicar(celula("2026-09-24"));
      expect($("calDiaTitulo")?.textContent).toBe(
        "Quinta-feira, 24 de setembro — 5 etapas",
      );
      expect(
        document.querySelectorAll<HTMLElement>("#calDiaLista .cal-item"),
      ).toHaveLength(5);
    });
  });

  describe("filtros", () => {
    beforeEach(async () => {
      await montar();
    });

    it("busca cada palavra, em qualquer ordem, sem acento", async () => {
      await digitar($("calBusca"), "final homologacao");
      expect(contador()).toBe("1 etapa no mês");
      expect(chips("2026-09-29")).toHaveLength(1);
      expect(celula("2026-09-14")?.classList.contains("vazio")).toBe(true);
    });

    /*
    A legenda é o filtro de tipo: botões de ligar/desligar (aria-pressed),
    todos ligados à partida, que valem para o Mês, a Semana, a Lista e a
    contagem — e ficam guardados neste navegador, como as Fases da Visão geral.
  */
    describe("legenda como filtro de tipo", () => {
      afterEach(() => localStorage.clear());

      it("todos os tipos nascem ligados, e 'Mostrar todos' fica desativado", () => {
        const botoes = [
          ...document.querySelectorAll<HTMLElement>("#calLegenda [data-tipo]"),
        ];
        expect(botoes.length).toBeGreaterThan(5);
        expect(
          botoes.every(
            (botao) => botao.getAttribute("aria-pressed") === "true",
          ),
        ).toBe(true);
        expect(botao("calLegendaTodos")?.disabled).toBe(true);
        expect($("calTipo")).toBeNull();
      });

      it("desligar um tipo esconde as etapas dele e atualiza a contagem", async () => {
        await clicar(tipoNaLegenda("recursos"));
        expect(tipoNaLegenda("recursos")?.getAttribute("aria-pressed")).toBe(
          "false",
        );
        expect(contador()).toBe("2 etapas no mês");
        expect(chips("2026-09-14")).toEqual([]);
        expect(chips("2026-09-22")).toEqual(["CASAI São Paulo – Inscrições"]);
        // O dia do meio também deixa de ter o recurso em andamento.
        expect(celula("2026-09-18")?.classList.contains("vazio")).toBe(true);
        expect(localStorage.getItem("agsus:cronograma:tipos-ocultos")).toBe(
          '["recursos"]',
        );

        // Vale também para a Lista e a Semana.
        await clicar(
          document.querySelector<HTMLElement>(
            '.cal-visoes [data-valor="lista"]',
          ),
        );
        expect($("calGrade")?.textContent).not.toContain("Prazo de recurso");
        await clicar(
          document.querySelector<HTMLElement>(
            '.cal-visoes [data-valor="semana"]',
          ),
        );
        expect($("calGrade")?.textContent).not.toContain("Prazo de recurso");
        expect(contador()).toBe("0 etapas na semana");
        await clicar(
          document.querySelector<HTMLElement>('.cal-visoes [data-valor="mes"]'),
        );

        // Ligar de novo traz de volta.
        await clicar(tipoNaLegenda("recursos"));
        expect(contador()).toBe("3 etapas no mês");
        expect(chips("2026-09-14")).toEqual([RECURSO]);
        expect(
          localStorage.getItem("agsus:cronograma:tipos-ocultos"),
        ).toBeNull();
      });

      it("'Mostrar todos' e 'Limpar tudo' religam os tipos desligados", async () => {
        await clicar(tipoNaLegenda("recursos"));
        await clicar(tipoNaLegenda("inscricoes"));
        expect(contador()).toBe("1 etapa no mês");
        expect(botao("calLegendaTodos")?.disabled).toBe(false);
        await clicar($("calLegendaTodos"));
        expect(contador()).toBe("3 etapas no mês");
        expect(botao("calLegendaTodos")?.disabled).toBe(true);

        await clicar(tipoNaLegenda("recursos"));
        await clicar(
          document.querySelector<HTMLElement>(
            '.cal-filtros [data-acao="limpar-filtros"]',
          ),
        );
        expect(tipoNaLegenda("recursos")?.getAttribute("aria-pressed")).toBe(
          "true",
        );
      });
    });

    it("'Ocultar concluídas' começa ligada; 'Limpar' mostra tudo", async () => {
      expect(campo("calOcultarConcluidas")?.checked).toBe(true);
      expect(celula("2026-09-10")?.classList.contains("vazio")).toBe(true);

      await digitar($("calBusca"), "entrevista");
      await clicar(
        document.querySelector<HTMLElement>(
          '.cal-filtros [data-acao="limpar-filtros"]',
        ),
      );
      expect(campo("calBusca")?.value).toBe("");
      expect(campo("calOcultarConcluidas")?.checked).toBe(false);
      expect(chips("2026-09-10")).toEqual([
        "Manaus – Entrevista com candidatos",
      ]);
      expect(contador()).toBe("4 etapas no mês");
    });

    it("a linha do tempo só oferece os editais que restaram no filtro", async () => {
      const opcoes = () =>
        [...definido(seletor("calTimelineEdital")).options].map(
          (opcao) => opcao.value,
        );
      expect(opcoes()).toEqual(["", "1", "2"]);
      expect(seletor("calTimelineEdital")?.value).toBe("1");

      await escolher($("calUnidade"), "CASAI São Paulo");
      expect(opcoes()).toEqual(["", "2"]);
      // O escolhido saiu do filtro: passa ao primeiro que restou.
      expect(seletor("calTimelineEdital")?.value).toBe("2");
      expect(etapasDaLinhaDoTempo()).toEqual(["Inscrições", "Entrevista"]);
    });

    it("o edital da linha do tempo abre a página do edital", async () => {
      const navigate = vi.fn(() => true);
      vi.stubGlobal("navigate", navigate);
      const botao = [
        ...document.querySelectorAll<HTMLElement>(
          '[data-tour="cronograma-edital-da-linha-do-tempo"] button',
        ),
      ].find((b) => b.textContent?.includes("Abrir página do edital"));
      await clicar(botao);
      // As linhas do teste não têm número: o endereço leva o id.
      expect(navigate).toHaveBeenCalledWith("edital", { edital: "1" });
      vi.unstubAllGlobals();
    });
  });

  describe("popup do dia", () => {
    beforeEach(async () => {
      await montar();
    });

    it("abre com as etapas ativas no dia, marcando a célula", async () => {
      await clicar(celula("2026-09-22"));
      expect($("calDiaTitulo")?.textContent).toBe(
        "Terça-feira, 22 de setembro — 2 etapas",
      );
      const marcas = [
        ...document.querySelectorAll<HTMLElement>(
          "#calDiaLista .cal-item-marca",
        ),
      ].map((marca) => marca.textContent);
      expect(marcas).toEqual(["último dia"]);
      // O tipo vai escrito, não só na cor; a unidade é texto, sem bolinha própria.
      const linhas = [
        ...document.querySelectorAll<HTMLElement>(
          "#calDiaLista .cal-item small",
        ),
      ];
      expect(linhas.map((linha) => linha.textContent)).toEqual([
        "Recursos · DSEI Manaus · Ed. 10/2026 · 14/09 a 22/09 (9 dias)",
        "Inscrições · CASAI São Paulo · Ed. 11/2026 · 22/09",
      ]);
      expect(
        document.querySelector<HTMLElement>("#calDiaLista .cal-unidade"),
      ).toBeNull();
      expect(celula("2026-09-22")?.getAttribute("aria-current")).toBe("true");
      expect(document.activeElement).toBe($("calDiaFechar"));
    });

    it("Esc fecha, desmarca a célula e devolve o foco a ela", async () => {
      const dia = definido(celula("2026-09-22"));
      dia.focus();
      await clicar(dia);
      await teclar(document, "Escape");
      expect($("calDiaModal")).toBeNull();
      expect(celula("2026-09-22")?.hasAttribute("aria-current")).toBe(false);
      expect(document.activeElement).toBe(celula("2026-09-22"));
    });

    it("clique no fundo escuro ou dentro do cartão não fecha", async () => {
      await clicar(celula("2026-09-22"));
      await clicar($("calDiaTitulo"));
      expect($("calDiaModal")).not.toBeNull();
      await clicar($("calDiaModal"));
      expect($("calDiaModal")).not.toBeNull();
    });

    it("escolher uma etapa foca o edital dela na linha do tempo e fecha o popup", async () => {
      await clicar(celula("2026-09-22"));
      const inscricoes = [
        ...document.querySelectorAll<HTMLElement>("#calDiaLista .cal-item"),
      ].find((item) => item.textContent?.includes("Inscrições"));
      await clicar(inscricoes);
      expect($("calDiaModal")).toBeNull();
      expect(seletor("calTimelineEdital")?.value).toBe("2");
      expect(etapasDaLinhaDoTempo()).toEqual(["Inscrições", "Entrevista"]);
    });

    it("trocar de mês fecha o dia aberto", async () => {
      await clicar(celula("2026-09-22"));
      await teclar(document, "Escape");
      await clicar(celula("2026-09-29"));
      // O popup cobre a página; o botão do mês só é alcançável com ele fechado.
      await clicar($("calDiaFechar"));
      await clicar($("calMesSeguinte"));
      expect(
        document.querySelector<HTMLElement>(".cal-celula.selecionado"),
      ).toBeNull();
    });
  });

  describe("próximas etapas", () => {
    /*
    Pela próxima data que importa, não pelo início bruto: o Prazo de recurso
    começou em 14/09 e ainda está em andamento (hoje é 15/09) — o que importa
    é 22/09, quando ele termina, por isso vem depois de Inscrições (que só
    começa em 22/09, mesma data, mas ainda não começou).
  */
    it("lista o que ainda não terminou, pela data que importa, e foca o edital ao clicar", async () => {
      await montar();
      const itens = [
        ...document.querySelectorAll<HTMLElement>("#calProximas .cal-item"),
      ];
      expect(
        itens.map(
          (item) => item.querySelector<HTMLElement>("strong")?.textContent,
        ),
      ).toEqual([
        "Inscrições",
        "Prazo de recurso do resultado preliminar",
        "Homologação do resultado final",
        "Entrevista",
      ]);
      const prazoDeRecurso = definido(itens[1]);
      expect(
        prazoDeRecurso.querySelector<HTMLElement>(".cal-item-data")
          ?.textContent,
      ).toBe("22/09");
      expect(
        prazoDeRecurso.querySelector<HTMLElement>("small")?.textContent,
      ).toContain("14/09 a 22/09 (9 dias)");

      await clicar(itens[0]);
      expect(seletor("calTimelineEdital")?.value).toBe("2");
    });
  });

  describe("datas impossíveis (ano digitado errado)", () => {
    it("avisa quais editais têm etapa a revisar, e a etapa some da lista", async () => {
      const supabase = supabaseFalso();
      supabase.rpc.mockImplementation(async (nome, argumentos) => {
        if (nome === "get_nucleo_cronograma_resumo")
          return { data: RESUMO, error: null };
        if (nome === "listar_etapas_do_cronograma")
          return { data: null, error: { code: "PGRST202" } };
        const id = definido(argumentos).p_monitoramento_id;
        if (id === 1)
          return {
            data: {
              etapas: [
                // Ano 0202 em vez de 2026: gravado assim antes desta correção.
                {
                  atividade: "Etapa com ano errado",
                  data_inicio: "0202-10-09",
                  data_fim: "0202-10-10",
                  ordem: 1,
                },
                ...definido(CRONOGRAMAS[1]),
              ],
            },
            error: null,
          };
        return { data: { etapas: CRONOGRAMAS[Number(id)] || [] }, error: null };
      });
      await montar({ supabase });

      expect($("calProximas")?.textContent).toContain(
        "1 edital com data impossível no cronograma",
      );
      expect($("calProximas")?.textContent).toContain("10/2026");
      expect(
        [
          ...document.querySelectorAll<HTMLElement>(
            "#calProximas .cal-item strong",
          ),
        ].map((item) => item.textContent),
      ).not.toContain("Etapa com ano errado");
    });
  });

  /*
  A tela mostra só as etapas dos editais da área escolhida no menu: o recorte é
  pelo conjunto de ids das linhas do monitoramento daquela área.
*/
  describe("área atual", () => {
    beforeEach(async () => {
      publicarLinhasDoMonitoramento([
        { id: 1, CO_AREA: "saude-indigena" },
        { id: 2, CO_AREA: "sede" },
        { id: 3, CO_AREA: "sede" },
      ]);
      await montar();
    });

    it("troca de área sem recarregar, e só mostra os editais dela", async () => {
      expect(contador()).toBe("2 etapas no mês");

      await act(async () => definirAreaAtual("sede"));
      expect(contador()).toBe("1 etapa no mês");
      expect(chips("2026-09-14")).toEqual([]);

      await act(async () => definirAreaAtual("projetos"));
      expect(contador()).toBe("0 etapas no mês");
    });
  });

  /*
  Vistas Mês · Semana · Lista. As mesmas etapas filtradas da grade; a Lista
  agrupa por dia o que começa ou termina e põe o que atravessa o período num
  bloco "Em andamento", uma vez só.
*/
  describe("vistas Mês, Semana e Lista", () => {
    const visao = (valor: string) =>
      document.querySelector<HTMLElement>(
        `.cal-visoes [data-valor="${valor}"]`,
      );
    const titulosDaLista = () =>
      [...document.querySelectorAll<HTMLElement>(".cal-lista-dia-titulo")].map(
        (titulo) => titulo.textContent?.trim(),
      );
    const itensDoDia = (chave: string) =>
      [
        ...document.querySelectorAll<HTMLElement>(
          `.cal-lista-dia[data-dia="${chave}"] .cal-item`,
        ),
      ].map((item) => item.querySelector<HTMLElement>("strong")?.textContent);
    const marcasDoDia = (chave: string) =>
      [
        ...document.querySelectorAll<HTMLElement>(
          `.cal-lista-dia[data-dia="${chave}"] .cal-item-marca`,
        ),
      ].map((marca) => marca.textContent);

    beforeEach(() => localStorage.clear());
    afterEach(() => localStorage.clear());

    it("o seletor é um radiogroup e abre em Mês no computador", async () => {
      await montar();
      const grupo = definido(
        document.querySelector<HTMLElement>(".cal-visoes"),
      );
      expect(grupo.getAttribute("role")).toBe("radiogroup");
      expect(
        [...grupo.querySelectorAll<HTMLElement>('[role="radio"]')].map(
          (botao) => botao.textContent?.trim(),
        ),
      ).toEqual(["Mês", "Semana", "Lista"]);
      expect(visao("mes")?.getAttribute("aria-checked")).toBe("true");
      expect(
        document.querySelectorAll<HTMLElement>(".cal-celula"),
      ).toHaveLength(30);
    });

    it("Lista começa hoje, com 'Acontecendo agora' no topo e os dias anteriores recolhidos", async () => {
      await montar();
      await clicar(visao("lista"));
      expect($("calGrade")?.dataset.visao).toBe("lista");
      expect(document.querySelector<HTMLElement>(".cal-celula")).toBeNull();
      // A legenda fica: é o filtro de tipo, e vale também para a Lista.
      expect($("calLegenda")).not.toBeNull();
      expect(titulosDaLista()).toEqual([
        "Ter, 22 de setembro",
        "Ter, 29 de setembro",
      ]);
      // O recurso de 14 a 22/09 está acontecendo: uma vez só, até quando.
      const andamento = definido(
        document.querySelector<HTMLElement>(".cal-andamento"),
      );
      const cabeca = definido(
        andamento.querySelector<HTMLElement>(".cal-andamento-cabeca"),
      );
      expect(cabeca.textContent).toBe("Acontecendo agora · 1 etapa");
      expect(cabeca.getAttribute("aria-expanded")).toBe("true");
      expect(andamento.querySelector<HTMLElement>("strong")?.textContent).toBe(
        "Prazo de recurso do resultado preliminar",
      );
      expect(
        andamento.querySelector<HTMLElement>(".cal-item-marca")?.textContent,
      ).toBe("até 22/09");
      await clicar(cabeca);
      expect(
        andamento.querySelector<HTMLElement>(".cal-lista-itens")?.hidden,
      ).toBe(true);

      // 14/09 já passou: fica atrás do botão, sem rolagem dentro do card.
      const anteriores = definido(
        document.querySelector<HTMLElement>(".cal-anteriores"),
      );
      expect(anteriores.textContent).toBe("Ver 1 dia anterior deste mês");
      await clicar(anteriores);
      expect(titulosDaLista()[0]).toBe("Seg, 14 de setembro");
      expect(itensDoDia("2026-09-14")).toEqual([
        "Prazo de recurso do resultado preliminar",
      ]);
      expect(marcasDoDia("2026-09-14")).toEqual(["início"]);
      // Dentro do dia, pela ordem da legenda: Recursos antes de Inscrições.
      expect(itensDoDia("2026-09-22")).toEqual([
        "Prazo de recurso do resultado preliminar",
        "Inscrições",
      ]);
      expect(marcasDoDia("2026-09-22")).toEqual(["último dia"]);
      expect(
        document.querySelector<HTMLElement>(
          '.cal-lista-dia[data-dia="2026-09-22"] .cal-tipo',
        )?.textContent,
      ).toBe("Recursos");
      expect(document.querySelector<HTMLElement>(".cal-unidade")).toBeNull();
      // As próximas etapas só aparecem no Mês: aqui seriam a mesma lista.
      expect($("calProximas")).toBeNull();
      expect(localStorage.getItem("agsus:cronograma:visao")).toBe("lista");
    });

    it("'Acontecendo agora' nasce recolhido com mais de três etapas", async () => {
      const supabase = supabaseFalso();
      supabase.rpc.mockImplementation(async (nome, argumentos) => {
        if (nome === "get_nucleo_cronograma_resumo")
          return { data: RESUMO, error: null };
        if (nome === "listar_etapas_do_cronograma")
          return { data: null, error: { code: "PGRST202" } };
        if (definido(argumentos).p_monitoramento_id !== 1)
          return { data: { etapas: [] }, error: null };
        return {
          data: {
            etapas: [1, 2, 3, 4].map((ordem) => ({
              atividade: `Análise curricular ${ordem}`,
              data_inicio: "2026-09-10",
              data_fim: `2026-09-2${ordem}`,
              ordem,
            })),
          },
          error: null,
        };
      });
      localStorage.setItem("agsus:cronograma:visao", "lista");
      await montar({ supabase });
      const cabeca = definido(
        document.querySelector<HTMLElement>(".cal-andamento-cabeca"),
      );
      expect(cabeca.textContent).toBe("Acontecendo agora · 4 etapas");
      expect(cabeca.getAttribute("aria-expanded")).toBe("false");
      expect(
        document.querySelector<HTMLElement>(".cal-andamento .cal-lista-itens")
          ?.hidden,
      ).toBe(true);
    });

    it("'Ver todas na Lista' sai do Mês para a Lista no dia de hoje", async () => {
      await montar();
      expect(
        $("calProximas")?.querySelectorAll<HTMLElement>(".cal-item"),
      ).toHaveLength(4);
      await clicar($("calMesSeguinte"));
      await clicar($("calVerNaLista"));
      expect(visao("lista")?.getAttribute("aria-checked")).toBe("true");
      expect($("calMesTitulo")?.textContent).toBe("Setembro 2026");
      expect(titulosDaLista()[0]).toBe("Ter, 22 de setembro");
    });

    it("clicar numa linha abre o mesmo popup do dia", async () => {
      await montar();
      await clicar(visao("lista"));
      const inscricoes = [
        ...document.querySelectorAll<HTMLElement>(
          '.cal-lista-dia[data-dia="2026-09-22"] .cal-item',
        ),
      ].find((item) => item.textContent?.includes("Inscrições"));
      await clicar(inscricoes);
      expect($("calDiaTitulo")?.textContent).toBe(
        "Terça-feira, 22 de setembro — 2 etapas",
      );
      await clicar($("calDiaFechar"));
      // O bloco "Em andamento" abre o dia em que a etapa termina.
      await clicar(
        document.querySelector<HTMLElement>(".cal-andamento .cal-item"),
      );
      expect($("calDiaTitulo")?.textContent).toMatch(
        /^Terça-feira, 22 de setembro/,
      );
    });

    it("os filtros valem na Lista; mês sem etapa mostra o vazio; Hoje volta", async () => {
      await montar();
      await clicar(visao("lista"));
      await escolher($("calUnidade"), "CASAI São Paulo");
      expect(titulosDaLista()).toEqual(["Ter, 22 de setembro"]);

      await clicar($("calMesSeguinte"));
      await clicar($("calMesSeguinte"));
      expect($("calMesTitulo")?.textContent).toBe("Novembro 2026");
      expect($("calGrade")?.textContent).toContain(
        "Nenhuma etapa neste período com os filtros atuais",
      );
      await clicar($("calHoje"));
      expect($("calMesTitulo")?.textContent).toBe("Setembro 2026");
      expect(
        document
          .querySelector<HTMLElement>('.cal-lista-dia[data-dia="2026-09-22"]')
          ?.getAttribute("aria-current"),
      ).toBeNull();
    });

    it("lembra a última vista escolhida", async () => {
      localStorage.setItem("agsus:cronograma:visao", "lista");
      await montar();
      expect(visao("lista")?.getAttribute("aria-checked")).toBe("true");
      expect(document.querySelector<HTMLElement>(".cal-lista")).not.toBeNull();
    });

    it("Semana mostra 7 dias só com início e fim dos períodos e anda de semana em semana", async () => {
      await montar();
      // Pelo teclado: → de Mês vai para Semana, com o foco junto.
      visao("mes")?.focus();
      await teclar(definido(visao("mes")), "ArrowRight");
      expect(document.activeElement).toBe(visao("semana"));
      expect(visao("semana")?.getAttribute("aria-checked")).toBe("true");
      expect($("calMesTitulo")?.textContent).toBe(
        "13 a 19 de setembro de 2026",
      );
      expect(contador()).toBe("1 etapa na semana");
      const dias = document.querySelectorAll<HTMLElement>(".cal-semana-dia");
      expect(dias).toHaveLength(7);
      const hoje = definido(
        document.querySelector<HTMLElement>(
          '.cal-semana-dia[data-dia="2026-09-15"]',
        ),
      );
      expect(hoje.getAttribute("aria-current")).toBe("date");
      // Como no Mês: o recurso aparece no dia em que começa; no meio, só a conta.
      expect(hoje.querySelector<HTMLElement>(".cal-mini")).toBeNull();
      expect(
        hoje.querySelector<HTMLElement>(".cal-semana-andamento")?.textContent,
      ).toBe("1 em andamento");
      expect(
        hoje
          .querySelector<HTMLElement>(".cal-semana-cabeca")
          ?.getAttribute("aria-label"),
      ).toMatch(/0 etapas, 1 em andamento$/);
      expect(
        document.querySelector<HTMLElement>(
          '.cal-semana-dia[data-dia="2026-09-14"] .cal-mini',
        )?.dataset.marca,
      ).toBe("começa");
      expect($("calMesSeguinte")?.getAttribute("aria-label")).toBe(
        "Próxima semana",
      );

      await clicar($("calMesSeguinte"));
      expect($("calMesTitulo")?.textContent).toBe(
        "20 a 26 de setembro de 2026",
      );
      expect(contador()).toBe("2 etapas na semana");

      // O dia do meio não repete a etapa; "em andamento" abre o próprio dia.
      const dia21 = definido(
        document.querySelector<HTMLElement>(
          '.cal-semana-dia[data-dia="2026-09-21"]',
        ),
      );
      expect(dia21.querySelector<HTMLElement>(".cal-mini")).toBeNull();
      await clicar(dia21.querySelector<HTMLElement>(".cal-semana-andamento"));
      expect($("calDiaTitulo")?.textContent).toMatch(
        /^Segunda-feira, 21 de setembro/,
      );
    });
  });
});

bloco("componentes/casos-dos-avisos", async () => {
  /*
  Casos dos avisos de conferência na gaveta (src/modulos/conferencias/):
  todos os casos em páginas, com quem é, onde e o motivo (sem UUID); busca no
  aviso e em todos os avisos; "Mostrar mais"; CSV; o caso das análises leva o
  Painel das análises à análise (pedido de filtro).
*/

  const { SeloDeAvisos } =
    await import("../src/modulos/conferencias/avisos-de-conferencia.tsx");
  const { criarEstadoDosAvisos } =
    await import("../src/modulos/conferencias/estado.ts");

  const ANALISE = "00000000-0000-4000-a000-0000000000a1";
  const aviso = {
    id: "a1",
    conferencia: "ANALISE_DATA_INVALIDA",
    escopo: "edital:e1",
    gravidade: "ATENCAO",
    modulo: "analises",
    area: "saude-indigena",
    edital_id: "e1",
    edital: "101/2026",
    quantidade: 60,
    exemplos: [ANALISE],
    resumo:
      "60 análises com data no futuro ou antes da inscrição no edital 101/2026.",
    situacao: "ABERTO",
    primeira_vez: "2026-10-05T09:00:00Z",
    pode_ignorar: false,
  };

  const caso = (i: number) => ({
    aviso_id: "a1",
    conferencia: "ANALISE_DATA_INVALIDA",
    ordem: i,
    analise_id:
      i === 1
        ? ANALISE
        : `00000000-0000-4000-a000-0000000001${String(i).padStart(2, "0")}`,
    codigo: String(4500 + i),
    nome: `Pessoa ${i}`,
    edital: "Edital 101/2026",
    codigo_vaga: "177979",
    nome_vaga: "Enfermeiro",
    responsavel: "Ana Analista",
    status: "Aprovado",
    data_analise: "2026-09-01",
    detalhe: {
      data_analise: "2026-09-01",
      inscricao: "2026-09-10",
      motivo: "antes_da_inscricao",
    },
  });
  const TODOS = Array.from({ length: 60 }, (_, i) => caso(i + 1));

  /* Os parâmetros que as RPCs dos avisos recebem (o falso só lê estes). */
  type ParametrosDosAvisos = {
    p_busca?: string | null;
    p_limite?: number;
    p_deslocamento?: number;
    [parametro: string]: unknown;
  };

  function supabaseFalso() {
    return {
      rpc: vi.fn(async (nome: string, args: ParametrosDosAvisos) => {
        if (nome === "listar_avisos_conferencia_se_mudou")
          return { data: { avisos: [aviso] }, error: null };
        if (nome === "listar_casos_aviso_conferencia") {
          const termo = String(args.p_busca || "").toLowerCase();
          const achados = TODOS.filter(
            (c) =>
              !termo ||
              c.codigo.includes(termo) ||
              c.nome.toLowerCase().includes(termo),
          );
          return {
            data: {
              total: achados.length,
              casos: achados.slice(
                Number(args.p_deslocamento),
                Number(args.p_deslocamento) + Number(args.p_limite),
              ),
            },
            error: null,
          };
        }
        return { data: null, error: null };
      }),
    };
  }

  const respiro = () => esperar(() => new Promise((r) => setTimeout(r, 350)));

  let raiz: HTMLDivElement | undefined;
  let montagem: Root | undefined;

  async function montar(elemento: ReactElement) {
    raiz = document.createElement("div");
    document.body.append(raiz);
    const nova = createRoot(raiz);
    montagem = nova;
    await act(async () => nova.render(elemento));
    await esperar();
  }

  async function abrirCasos(
    props: Partial<Parameters<typeof SeloDeAvisos>[0]> = {},
  ) {
    const supabase = supabaseFalso();
    const baixar =
      vi.fn<(conteudo: Uint8Array, nome: string, tipo: string) => void>();
    const estado = criarEstadoDosAvisos({ supabase, baixar });
    await montar(
      createElement(SeloDeAvisos, {
        modulo: "analises",
        supabase,
        estado,
        ...props,
      }),
    );
    await clicar(document.querySelector(".conf-selo-do-modulo"));
    const botao = [...document.querySelectorAll(".conf-aviso button")].find(
      (b) => b.textContent?.includes("60 casos"),
    );
    await clicar(botao);
    await esperar();
    return { supabase, baixar };
  }

  beforeEach(() => {
    sessionStorage.clear();
    definirAreasDoUsuario(["saude-indigena"]);
    definirAreaAtual("saude-indigena");
  });

  afterEach(async () => {
    await act(async () => montagem?.unmount());
    raiz?.remove();
    document.body.innerHTML = "";
    redefinirDadosDoMonitoramento();
    consumirPedidoDeFiltro("analises");
  });

  describe("casos de um aviso", () => {
    it("mostra código, nome, edital, vaga, responsável e o motivo — não o UUID", async () => {
      const { supabase } = await abrirCasos();
      expect(supabase.rpc).toHaveBeenCalledWith(
        "listar_casos_aviso_conferencia",
        expect.objectContaining({ p_aviso: "a1", p_deslocamento: 0 }),
      );
      const itens = document.querySelectorAll(".conf-caso");
      expect(itens).toHaveLength(50);
      const primeiro = itens[0]?.textContent;
      expect(primeiro).toContain("4501 · Pessoa 1");
      expect(primeiro).toContain("Edital 101/2026 · 177979 · Enfermeiro");
      expect(primeiro).toContain("Resp. Ana Analista");
      expect(primeiro).toContain(
        "Análise em 01/09/2026, antes da inscrição em 10/09/2026",
      );
      expect(document.querySelector(".conf-casos")?.textContent).not.toContain(
        ANALISE,
      );
      expect(document.querySelector(".conf-casos__total")?.textContent).toBe(
        "50 de 60",
      );
    });

    it("Mostrar mais traz a página seguinte", async () => {
      const { supabase } = await abrirCasos();
      const mais = [...document.querySelectorAll(".conf-casos button")].find(
        (b) => b.textContent?.includes("Mostrar mais"),
      );
      expect(mais?.textContent).toContain("(10)");
      await clicar(mais);
      await esperar();
      expect(supabase.rpc).toHaveBeenLastCalledWith(
        "listar_casos_aviso_conferencia",
        expect.objectContaining({ p_aviso: "a1", p_deslocamento: 50 }),
      );
      expect(document.querySelectorAll(".conf-caso")).toHaveLength(60);
      expect(document.body.textContent).not.toContain("Mostrar mais");
    });

    it("busca no aviso por código", async () => {
      const { supabase } = await abrirCasos();
      await digitar(document.querySelector(".conf-casos__busca"), "4512");
      await respiro();
      expect(supabase.rpc).toHaveBeenLastCalledWith(
        "listar_casos_aviso_conferencia",
        expect.objectContaining({ p_aviso: "a1", p_busca: "4512" }),
      );
      const itens = document.querySelectorAll(".conf-caso");
      expect(itens).toHaveLength(1);
      expect(itens[0]?.textContent).toContain("Pessoa 12");
    });

    it("exporta a planilha com todos os casos", async () => {
      const { baixar } = await abrirCasos();
      const excel = [
        ...document.querySelectorAll(".conf-aviso__casos button"),
      ].find((b) => b.textContent?.trim() === "Exportar em Excel");
      await clicar(definido(excel));
      await esperar();
      expect(baixar).toHaveBeenCalledTimes(1);
      const planilha = new TextDecoder().decode(baixar.mock.calls[0]?.[0]);
      expect(planilha.match(/<row /g)).toHaveLength(61);
    });

    it("clicar no caso fecha a gaveta e pede ao Painel das análises a busca e a análise", async () => {
      const aoAbrirCaso = vi.fn();
      await abrirCasos({ aoAbrirCaso });
      await clicar(document.querySelector(".conf-caso--clicavel"));
      expect(aoAbrirCaso).toHaveBeenCalledWith(
        expect.objectContaining({ analiseId: ANALISE, nome: "Pessoa 1" }),
        { navegar: false },
      );
      expect(document.querySelector(".conf-gaveta")).toBeNull();
    });

    it("sem aoAbrirCaso, o clique deixa o pedido de filtro para as análises", async () => {
      await abrirCasos();
      await clicar(document.querySelector(".conf-caso--clicavel"));
      expect(consumirPedidoDeFiltro("analises")).toEqual({
        busca: "Pessoa 1",
        analise: ANALISE,
      });
    });
  });

  describe("busca em todos os avisos", () => {
    it("procura por nome em todos os avisos do recorte e mostra de qual aviso é", async () => {
      const supabase = supabaseFalso();
      await montar(
        createElement(SeloDeAvisos, { modulo: "analises", supabase }),
      );
      await clicar(document.querySelector(".conf-selo-do-modulo"));
      await digitar(document.querySelector(".conf-busca input"), "pessoa 3");
      await respiro();
      expect(supabase.rpc).toHaveBeenLastCalledWith(
        "listar_casos_aviso_conferencia",
        {
          p_aviso: null,
          p_busca: "pessoa 3",
          p_area: "saude-indigena",
          p_modulo: "analises",
          p_limite: 50,
          p_deslocamento: 0,
        },
      );
      expect(document.querySelector(".conf-aviso")).toBeNull();
      const itens = [...document.querySelectorAll(".conf-caso")];
      expect(itens.length).toBeGreaterThan(0);
      expect(itens[0]?.textContent).toContain(
        "Data da análise no futuro ou antes da inscrição",
      );
    });
  });
});

bloco("componentes/encerrados-do-cronograma", () => {
  /*
    "Cronograma encerrado (N)" em Editais (20261119120000): a lista, a seleção em lote com
    "Selecionar esta página" separado de "Selecionar todos os N", a confirmação com quantos e quais
    e o motivo, o resultado com os recusados e o atalho "Dispensar" da central de avisos.
  */
  const edital = (i: number, extra: Record<string, unknown> = {}) => ({
    id: `e${i}`,
    edital: `${i}/2099`,
    numero: `${i}/2099`,
    unidade: `DSEI Fictício ${i}`,
    area: "saude-indigena",
    status: "Em andamento",
    fim: "2026-03-31",
    aviso: { id: `a${i}`, tratamento: "PENDENTE", pode_dispensar: false },
    pendencias: [],
    ...extra,
  });
  const lista = (quantos: number, extra: Record<string, unknown> = {}) => ({
    pode_concluir: true,
    editais: Array.from({ length: quantos }, (_, i) => edital(i + 1)),
    ...extra,
  });

  type Chamada = [string, Record<string, unknown> | undefined];
  function cliente(
    responder: (nome: string, argumentos?: Record<string, unknown>) => unknown,
  ) {
    const chamadas: Chamada[] = [];
    const rpc = vi.fn(
      async (nome: string, argumentos?: Record<string, unknown>) => {
        chamadas.push([nome, argumentos]);
        return { data: responder(nome, argumentos), error: null };
      },
    );
    const supabase: ClienteDosEncerrados = { rpc };
    return { supabase, chamadas };
  }

  let desmontar = () => {};
  afterEach(() => {
    act(() => desmontar());
    document.body.innerHTML = "";
  });

  async function montar(
    supabase: ClienteDosEncerrados,
    extra: { aoConcluir?: () => void; toast?: (m: string) => void } = {},
  ) {
    document.body.innerHTML = `<div id="raiz"></div>`;
    act(() => {
      ({ desmontar } = desenharNoTeste(
        document.getElementById("raiz")!,
        createElement(EncerradosDoCronograma, { supabase, ...extra }),
      ));
    });
    await esperar();
  }

  const texto = () => document.body.textContent ?? "";
  const botao = (rotulo: string) =>
    [...document.querySelectorAll("button")].find(
      (b) => b.textContent?.trim() === rotulo,
    );
  const abrir = () =>
    clicar(document.querySelector('[data-acao="abrir-cronograma-encerrado"]'));

  it("sem edital na lista, a entrada não aparece", async () => {
    await montar(cliente(() => lista(0)).supabase);
    expect(texto()).toBe("");
  });

  it("a entrada conta os editais e a gaveta mostra 20 por vez, com o fim e o status gravado", async () => {
    await montar(cliente(() => lista(25)).supabase);
    expect(texto()).toBe("Cronograma encerrado (25)");
    await abrir();
    expect(document.querySelectorAll("[data-edital-encerrado]")).toHaveLength(
      20,
    );
    expect(texto()).toContain("Edital 1/2099 · DSEI Fictício 1");
    expect(texto()).toContain("Cronograma terminou em 31/03/2026");
    expect(texto()).toContain("Em andamento");
    await clicar(botao("Mostrar mais 5"));
    expect(document.querySelectorAll("[data-edital-encerrado]")).toHaveLength(
      25,
    );
  });

  it("selecionar esta página é separado de selecionar todos, e a confirmação diz quantos e quais", async () => {
    const { supabase, chamadas } = cliente((nome) =>
      nome === "listar_editais_com_cronograma_encerrado"
        ? lista(25)
        : {
            concluidos: Array.from({ length: 19 }, (_, i) => ({
              id: `e${i + 1}`,
              edital: `${i + 1}/2099`,
            })),
            recusados: [
              {
                id: "e20",
                edital: "20/2099",
                motivo:
                  'Pelo cronograma, o edital está "Em andamento", não concluído',
              },
            ],
          },
    );
    const aoConcluir = vi.fn();
    const toast = vi.fn();
    await montar(supabase, { aoConcluir, toast });
    await abrir();
    await clicar(document.querySelector('[data-acao="selecionar-pagina"]'));
    expect(texto()).toContain(
      "20 editais desta página selecionados (de 25 no resultado)",
    );
    expect(botao("Selecionar todos os 25 resultados")).toBeTruthy();
    await clicar(botao("Marcar como concluídos"));
    const modal = document.querySelector(".editais-encerrados-confirmacao")!;
    expect(modal.textContent).toContain(
      "20 editais serão afetados · só esta página",
    );
    expect(modal.querySelectorAll("li")).toHaveLength(20);

    // Motivo curto: avisa e não grava.
    await digitar(modal.querySelector("textarea"), "curto");
    await clicar(modal.querySelector('[data-acao="confirmar-conclusao"]'));
    expect(modal.textContent).toContain("pelo menos 10 caracteres");
    expect(
      chamadas.filter(
        ([nome]) => nome !== "listar_editais_com_cronograma_encerrado",
      ),
    ).toEqual([]);

    await digitar(
      modal.querySelector("textarea"),
      "  conferido com a equipe em 19/11 ",
    );
    await clicar(modal.querySelector('[data-acao="confirmar-conclusao"]'));
    await esperar();
    const [nome, argumentos] = chamadas.at(-1)!;
    expect(nome).toBe("concluir_editais_com_cronograma_encerrado");
    expect(argumentos).toEqual({
      p_editais: Array.from({ length: 20 }, (_, i) => `e${i + 1}`),
      p_motivo: "conferido com a equipe em 19/11",
    });
    // Os 19 marcados saem; o recusado fica, com o motivo à vista.
    expect(document.querySelectorAll("[data-edital-encerrado]")).toHaveLength(
      6,
    );
    expect(
      document.querySelector("[data-recusados-do-lote]")?.textContent,
    ).toContain(
      'Edital 20/2099: Pelo cronograma, o edital está "Em andamento"',
    );
    expect(toast).toHaveBeenCalledWith(
      "19 editais marcados como concluídos · 1 recusado",
      "warning",
    );
    expect(aoConcluir).toHaveBeenCalledTimes(1);
  });

  it("selecionar todos os N leva o lote inteiro e a confirmação diz que não é só a página", async () => {
    const { supabase } = cliente(() => lista(25));
    await montar(supabase);
    await abrir();
    await clicar(document.querySelector('[data-acao="selecionar-pagina"]'));
    await clicar(botao("Selecionar todos os 25 resultados"));
    expect(texto()).toContain("Todos os 25 editais do resultado selecionados");
    await clicar(botao("Marcar como concluídos"));
    expect(
      document.querySelector("[data-resumo-da-confirmacao]")?.textContent,
    ).toBe(
      "25 editais serão afetados · todos os resultados do filtro, não só os 20 desta página",
    );
  });

  it("quem só lê vê a lista, sem seleção nem marcação", async () => {
    await montar(cliente(() => lista(3, { pode_concluir: false })).supabase);
    await abrir();
    expect(document.querySelectorAll("[data-edital-encerrado]")).toHaveLength(
      3,
    );
    expect(
      document.querySelector('[data-acao="selecionar-pagina"]'),
    ).toBeNull();
    expect(document.querySelector(".editais-encerrados-item input")).toBeNull();
  });

  it("mostra as outras pendências do edital pelo título da conferência", async () => {
    await montar(
      cliente(() => ({
        pode_concluir: true,
        editais: [
          edital(1, {
            pendencias: [
              {
                conferencia: "CARGA_VARIACAO_BRUSCA",
                gravidade: "ATENCAO",
                quantidade: 2,
              },
            ],
          }),
        ],
      })).supabase,
    );
    await abrir();
    expect(
      document.querySelector('[data-pendencia="CARGA_VARIACAO_BRUSCA"]')
        ?.textContent,
    ).toBe("Variação brusca de candidatos na Empregare (2)");
  });

  it("Dispensar pede justificativa e usa a RPC da central; o edital sai da lista", async () => {
    const { supabase, chamadas } = cliente((nome) =>
      nome === "listar_editais_com_cronograma_encerrado"
        ? {
            pode_concluir: true,
            editais: [
              edital(1, {
                aviso: {
                  id: "a1",
                  tratamento: "EM_ANALISE",
                  pode_dispensar: true,
                },
              }),
              edital(2),
            ],
          }
        : { id: "a1", tratamento: "DISPENSADO" },
    );
    await montar(supabase);
    await abrir();
    expect(texto()).toContain("Em análise");
    // Só o edital com permissão tem o atalho.
    expect(
      document.querySelectorAll('[data-acao="dispensar-aviso"]'),
    ).toHaveLength(1);
    await clicar(document.querySelector('[data-acao="dispensar-aviso"]'));
    await clicar(document.querySelector('[data-acao="confirmar-dispensa"]'));
    expect(texto()).toContain("pelo menos 10 caracteres");
    await digitar(
      document.querySelector(".editais-encerrados-dispensa textarea"),
      "Homologação ainda não publicada",
    );
    await clicar(document.querySelector('[data-acao="confirmar-dispensa"]'));
    await esperar();
    expect(chamadas.at(-1)).toEqual([
      "tratar_aviso_conferencia",
      {
        p_id: "a1",
        p_tratamento: "DISPENSADO",
        p_motivo: "Homologação ainda não publicada",
      },
    ]);
    expect(
      [...document.querySelectorAll("[data-edital-encerrado]")].map((li) =>
        li.getAttribute("data-edital-encerrado"),
      ),
    ).toEqual(["e2"]);
  });
});

bloco("componentes/demandas-internas", () => {
  /*
  Demandas internas no Cronograma e responsáveis pelo edital (20261104120000).
  "Hoje" é 15/09/2026. A demanda d1 terminou em 10/09 sem ser concluída:
  atrasada. A d3 é da SEDE e não aparece na Saúde Indígena.
*/
  const HOJE = new Date(2026, 8, 15, 10);

  beforeEach(() =>
    publicarLinhasDoMonitoramento([
      {
        id: 1,
        CO_AREA: "saude-indigena",
        edital: "10/2026",
        unidade: "DSEI Manaus",
      },
    ]),
  );
  afterEach(() => {
    redefinirDadosDoMonitoramento();
    localStorage.clear();
  });

  const ANA = { id: "p1", nome: "Ana Souza" };
  const BRUNO = { id: "p2", nome: "Bruno Lima" };

  const demanda = (
    campos: Record<string, unknown>,
  ): Record<string, unknown> => ({
    area: "saude-indigena",
    edital_id: null,
    edital: null,
    unidade: null,
    descricao: null,
    concluida: false,
    concluida_em: null,
    concluida_por: null,
    responsaveis: [],
    pode_editar: true,
    criada_por: "Gestora",
    criada_em: "2026-09-01T12:00:00Z",
    ...campos,
  });

  const D1 = demanda({
    id: "d1",
    titulo: "Relatório mensal",
    data_inicio: "2026-09-08",
    data_fim: "2026-09-10",
    responsaveis: [ANA],
  });
  const D2 = demanda({
    id: "d2",
    titulo: "Reunião de alinhamento",
    data_inicio: "2026-09-18",
    data_fim: "2026-09-18",
    edital_id: "1",
    edital: "10/2026",
    unidade: "DSEI Manaus",
  });
  const D3 = demanda({
    id: "d3",
    area: "sede",
    titulo: "Demanda da SEDE",
    data_inicio: "2026-09-16",
    data_fim: "2026-09-16",
  });

  /* Os argumentos que as RPCs desta tela recebem. */
  type ArgumentosDoCronograma = {
    p_id?: string;
    p_concluida?: boolean;
    p_demanda?: Record<string, unknown>;
    p_area?: string;
    p_edital?: string | null;
    p_monitoramento_id?: string | number;
  };

  /* A lista que o teste sabe que veio (quebra como o JS ao chamar includes). */
  function lista(valor: unknown): unknown[] {
    if (!Array.isArray(valor)) throw new TypeError("não é uma lista");
    return valor;
  }

  interface OpcoesDoFalso {
    podeCriarEm?: string[];
    podeEditar?: boolean;
  }

  function supabaseFalso({
    podeCriarEm = ["saude-indigena"],
    podeEditar = true,
  }: OpcoesDoFalso = {}) {
    const demandas = [D1, D2, D3].map((item): Record<string, unknown> => ({
      ...item,
      pode_editar: podeEditar,
    }));
    return {
      auth: {
        getSession: async () => ({
          data: { session: { access_token: "token" } },
          error: null,
        }),
      },
      rpc: vi.fn(async (nome: string, argumentos?: ArgumentosDoCronograma) => {
        switch (nome) {
          case "get_nucleo_cronograma_resumo":
            return {
              data: [
                {
                  id: 1,
                  unidade: "DSEI Manaus",
                  edital: "10/2026",
                  cronograma_total: 1,
                },
              ],
              error: null,
            };
          case "listar_etapas_do_cronograma":
            return {
              data: [
                {
                  monitoramento_id: 1,
                  atividade: "Inscrições",
                  data_inicio: "2026-09-22",
                  data_fim: "2026-09-22",
                  ordem: 1,
                },
              ],
              error: null,
            };
          case "listar_demandas_internas":
            return {
              data: { pode_criar_em: podeCriarEm, demandas },
              error: null,
            };
          case "concluir_demanda_interna":
            return {
              data: {
                ...demandas.find(
                  (item) => item.id === definido(argumentos).p_id,
                ),
                concluida: definido(argumentos).p_concluida,
                concluida_em: definido(argumentos).p_concluida
                  ? "2026-09-15T13:00:00Z"
                  : null,
                concluida_por: definido(argumentos).p_concluida
                  ? "Gestora"
                  : null,
              },
              error: null,
            };
          case "listar_pessoas_da_area":
            return { data: [ANA, BRUNO], error: null };
          case "salvar_demanda_interna": {
            const p = definido(definido(argumentos).p_demanda);
            return {
              data: demanda({
                id: p.id || "nova",
                area: p.area,
                titulo: p.titulo,
                data_inicio: p.data_inicio,
                data_fim: p.data_fim,
                responsaveis: [ANA, BRUNO].filter((pessoa) =>
                  lista(p.responsaveis).includes(pessoa.id),
                ),
              }),
              error: null,
            };
          }
          case "excluir_demanda_interna":
            return {
              data: { ok: true, id: definido(argumentos).p_id },
              error: null,
            };
          default:
            return {
              data: null,
              error: { message: `RPC inesperada: ${nome}` },
            };
        }
      }),
    };
  }

  const $ = (id: string) => document.getElementById(id);
  const botao = (id: string) =>
    document.querySelector<HTMLButtonElement>(`#${id}`);
  const chamadas = (
    supabase: { rpc: { mock: { calls: unknown[][] } } },
    nome: string,
  ) => supabase.rpc.mock.calls.filter(([chamada]) => chamada === nome);

  async function montar(
    opcoes: OpcoesDoFalso & { resumo?: EstadoDoResumoDoDia } = {},
  ) {
    document.body.innerHTML = `<section id="page-calendario" class="page active"></section>`;
    const supabase = supabaseFalso(opcoes);
    let controlador:
      | (ReturnType<typeof criarCalendarioEditais> & { raiz: Root | null })
      | undefined;
    await act(async () => {
      controlador = montarTela<
        OpcoesDaTelaDoCalendario,
        ReturnType<typeof criarCalendarioEditais>
      >(criarCalendarioEditais, "page-calendario", {
        secao: $("page-calendario"),
        supabase,
        toast: vi.fn(),
        agora: () => new Date(HOJE),
        ...(opcoes.resumo ? { resumo: opcoes.resumo } : {}),
      });
    });
    await esperar(() => definido(controlador).render());
    return { supabase, controlador: definido(controlador) };
  }

  let atual: Awaited<ReturnType<typeof montar>> | null = null;
  afterEach(() => {
    atual?.controlador?.raiz?.unmount();
    atual = null;
  });

  describe("demandas internas no Cronograma", () => {
    it("entram no calendário como 'Demanda interna', com a atrasada à vista, e só as da área", async () => {
      atual = await montar();
      const tipo = document.querySelector(
        '#calLegenda [data-tipo="demanda-interna"]',
      );
      expect(tipo?.textContent).toContain("Demanda interna");
      // "Ocultar concluídas" (ligado) não esconde a atrasada.
      expect($("calGrade")?.textContent).toContain(
        "Relatório mensal · atrasada",
      );
      expect($("calGrade")?.textContent).toContain("Reunião de alinhamento");
      expect($("calGrade")?.textContent).not.toContain("Demanda da SEDE");

      const itens = [
        ...document.querySelectorAll<HTMLElement>(".demandas-item"),
      ];
      expect(itens.map((item) => item.dataset.demanda)).toEqual(["d1", "d2"]);
      expect(itens[0]?.querySelector(".demandas-atrasada")?.textContent).toBe(
        "Atrasada",
      );
      expect(itens[1]?.querySelector(".demandas-atrasada")).toBeNull();
      expect(itens[1]?.textContent).toContain("18/09/2026 · 10/2026");
    });

    it("na Semana, a demanda com período segue o critério do Mês: só início e fim", async () => {
      atual = await montar();
      await clicar(document.querySelector('.cal-visoes [data-valor="semana"]'));
      await clicar($("calMesAnterior")); // semana de 6 a 12/09; d1 vai de 8 a 10
      const nomes = [
        ...document.querySelectorAll(".cal-semana-vista .cal-mini-nome"),
      ]
        .map((item) => item.textContent)
        .filter((texto) => texto.includes("Relatório mensal"));
      expect(nomes).toHaveLength(2);
      const andamento = [
        ...document.querySelectorAll(".cal-semana-andamento"),
      ].map((botao) => botao.textContent);
      expect(andamento).toEqual(["1 em andamento"]);
    });

    it("desligar o tipo na legenda esconde as demandas do calendário", async () => {
      atual = await montar();
      await clicar(
        document.querySelector('#calLegenda [data-tipo="demanda-interna"]'),
      );
      expect($("calGrade")?.textContent).not.toContain("Relatório mensal");
      expect(localStorage.getItem("agsus:cronograma:tipos-ocultos")).toBe(
        '["demanda-interna"]',
      );
    });

    it("o detalhe mostra os responsáveis; Concluir grava e a demanda vai para as concluídas", async () => {
      const { supabase } = (atual = await montar());
      await clicar(document.querySelector('[data-demanda="d1"]'));
      expect($("demandaDetalhe")).not.toBeNull();
      expect($("demandaResponsaveisDetalhe")?.textContent).toBe("Ana Souza");

      await clicar($("demandaConcluir"));
      expect(chamadas(supabase, "concluir_demanda_interna")[0]?.[1]).toEqual({
        p_id: "d1",
        p_concluida: true,
      });
      expect($("demandaConcluir")?.textContent).toBe("Reabrir");
      expect($("demandaDetalhe")?.textContent).toContain("Concluída · Gestora");
      expect(
        [
          ...document.querySelectorAll<HTMLElement>(
            ".demandas-card > .demandas-lista .demandas-item",
          ),
        ].map((item) => item.dataset.demanda),
      ).toEqual(["d2"]);
      expect($("demandasVerConcluidas")?.textContent).toContain("(1)");
      // No calendário, deixa de ser atrasada.
      expect($("calGrade")?.textContent).not.toContain("· atrasada");
    });

    it("Nova demanda: valida o formulário e salva com área, data única e responsáveis", async () => {
      const { supabase } = (atual = await montar());
      await clicar($("demandaNova"));
      await clicar($("demandaSalvar"));
      expect($("demandaErro")?.textContent).toBe(
        "O título precisa ter ao menos 3 caracteres.",
      );
      expect(chamadas(supabase, "salvar_demanda_interna")).toHaveLength(0);

      await digitar($("demandaTitulo"), "  Conferir   documentos ");
      await digitar($("demandaInicio"), "2026-09-25");
      await esperar();
      expect(chamadas(supabase, "listar_pessoas_da_area")[0]?.[1]).toEqual({
        p_area: "saude-indigena",
        p_edital: null,
      });
      await clicar(
        document.querySelector(
          '#demandaFormulario input[type="checkbox"][value="p2"]',
        ),
      );
      await clicar($("demandaSalvar"));

      expect(chamadas(supabase, "salvar_demanda_interna")[0]?.[1]).toEqual({
        p_demanda: {
          area: "saude-indigena",
          edital_id: null,
          titulo: "Conferir documentos",
          descricao: null,
          data_inicio: "2026-09-25",
          data_fim: "2026-09-25",
          responsaveis: ["p2"],
        },
      });
      expect($("demandaFormulario")).toBeNull();
      // Abre o detalhe da nova, já na lista e no calendário.
      expect($("demandaResponsaveisDetalhe")?.textContent).toBe("Bruno Lima");
      expect(document.querySelector('[data-demanda="nova"]')).not.toBeNull();
    });

    it("Excluir pede confirmação e tira a demanda da lista", async () => {
      const { supabase } = (atual = await montar());
      await clicar(document.querySelector('[data-demanda="d2"]'));
      await clicar($("demandaExcluir"));
      expect($("demandaExcluirConfirmar")).not.toBeNull();
      await clicar($("demandaExcluirSim"));
      expect(chamadas(supabase, "excluir_demanda_interna")[0]?.[1]).toEqual({
        p_id: "d2",
      });
      expect(document.querySelector('[data-demanda="d2"]')).toBeNull();
      expect($("demandaDetalhe")).toBeNull();
      expect($("calGrade")?.textContent).not.toContain(
        "Reunião de alinhamento",
      );
    });

    it("quem só lê vê as demandas, sem Nova demanda nem ações", async () => {
      atual = await montar({ podeCriarEm: [], podeEditar: false });
      expect($("demandaNova")).toBeNull();
      await clicar(document.querySelector('[data-demanda="d1"]'));
      expect($("demandaResponsaveisDetalhe")?.textContent).toBe("Ana Souza");
      expect($("demandaConcluir")).toBeNull();
      expect($("demandaEditar")).toBeNull();
      expect($("demandaExcluir")).toBeNull();
    });
  });

  describe("Cronograma só com os da pessoa (?visao=meus, do resumo do dia)", () => {
    it("abrirVisao('meus') recorta nos editais e demandas dela; 'Ver todos' volta", async () => {
      const resumo = criarEstadoDoResumoDoDia({
        cliente: () => ({
          rpc: async () => ({
            data: {
              data: "2026-09-15",
              perfil: "p1",
              responsavel: true,
              editais: [],
              demandas: ["d1"],
              hoje: [],
              proximos: [],
              atrasadas: [],
            },
            error: null,
          }),
        }),
        armazenamento: () => null,
        podeAbrirSozinho: () => false,
      });
      await esperar(() => resumo.verificar());
      atual = await montar({ resumo });
      await esperar(() => atual?.controlador.abrirVisao("meus"));
      expect($("calSoOsMeus")).not.toBeNull();
      expect($("calGrade")?.textContent).toContain("Relatório mensal");
      expect($("calGrade")?.textContent).not.toContain(
        "Reunião de alinhamento",
      );
      expect($("calGrade")?.textContent).not.toContain("Inscrições");

      await clicar($("calSoOsMeus")?.querySelector("button"));
      expect($("calSoOsMeus")).toBeNull();
      expect($("calGrade")?.textContent).toContain("Reunião de alinhamento");
    });
  });

  describe("responsáveis pelo edital", () => {
    function clienteDosResponsaveis({ podeEditar }: { podeEditar: boolean }) {
      let responsaveis = [ANA];
      return {
        rpc: vi.fn(
          async (
            nome: string,
            argumentos?: {
              p_edital?: string | null;
              p_area?: string;
              p_responsaveis?: string[];
            },
          ) => {
            if (nome === "obter_responsaveis_do_edital")
              return {
                data: {
                  area: "saude-indigena",
                  pode_editar: podeEditar,
                  responsaveis,
                },
                error: null,
              };
            if (nome === "listar_pessoas_da_area")
              return { data: [ANA, BRUNO], error: null };
            if (nome === "salvar_responsaveis_do_edital") {
              responsaveis = [ANA, BRUNO].filter((pessoa) =>
                definido(definido(argumentos).p_responsaveis).includes(
                  pessoa.id,
                ),
              );
              return {
                data: {
                  area: "saude-indigena",
                  pode_editar: true,
                  responsaveis,
                },
                error: null,
              };
            }
            return { data: null, error: { code: "PGRST202" } };
          },
        ),
      };
    }

    let desmontar = () => {};
    afterEach(() => desmontar());

    async function desenhar(supabase: ClienteDosResponsaveis) {
      document.body.innerHTML = `<div id="raiz"></div>`;
      await act(async () => {
        ({ desmontar } = desenharNoTeste(
          $("raiz"),
          createElement(ResponsaveisDoEdital, { editalId: "1", supabase }),
        ));
      });
      await esperar();
    }

    it("quem só vê lê os nomes", async () => {
      const supabase = clienteDosResponsaveis({ podeEditar: false });
      await desenhar(supabase);
      expect($("editalResponsaveisLista")?.textContent).toBe("Ana Souza");
      expect($("editalResponsaveisSalvar")).toBeNull();
      expect(chamadas(supabase, "listar_pessoas_da_area")).toHaveLength(0);
    });

    it("o gestor escolhe as pessoas e salva a lista inteira", async () => {
      const supabase = clienteDosResponsaveis({ podeEditar: true });
      await desenhar(supabase);
      expect(botao("editalResponsaveisSalvar")?.disabled).toBe(true);
      await clicar(
        document.querySelector('#editalResponsaveis input[value="p2"]'),
      );
      expect(botao("editalResponsaveisSalvar")?.disabled).toBe(false);
      await clicar($("editalResponsaveisSalvar"));
      expect(
        chamadas(supabase, "salvar_responsaveis_do_edital")[0]?.[1],
      ).toEqual({
        p_edital: "1",
        p_responsaveis: ["p1", "p2"],
      });
      expect(
        document.querySelector(".edital-responsaveis-salvo")?.textContent,
      ).toBe("Responsáveis salvos.");
      expect(botao("editalResponsaveisSalvar")?.disabled).toBe(true);
    });

    it("banco sem as RPCs: o bloco não aparece", async () => {
      await desenhar({
        rpc: vi.fn(async () => ({ data: null, error: { code: "PGRST202" } })),
      });
      expect($("editalResponsaveis")).toBeNull();
    });
  });
});

bloco("componentes/nucleo-treinamento", () => {
  /*
  Editais com o edital de treinamento (migration 20261007230000): o selo
  "Treinamento" na linha, o botão "Reiniciar treinamento" só para o admin
  global e só no edital de treinamento, com a confirmação na própria linha, e
  os indicadores do painel sem o edital de treinamento.
*/

  const LINHAS = () => [
    {
      id: "real",
      unidade: "DSEI Manaus",
      edital: "10/2026",
      status: "Em andamento",
      etapa: "Análise curricular",
      risco: "Baixo",
      vagas_total: 10,
      ST_TREINAMENTO: "N",
    },
    {
      id: "treino",
      unidade: "DSEI Treinamento",
      edital: "Treinamento – Saúde Indígena (991/2099)",
      status: "Em andamento",
      etapa: "Entrevistas",
      risco: "Baixo",
      vagas_total: 7,
      ST_TREINAMENTO: "S",
    },
  ];

  const RESUMO = [
    {
      id: "real",
      alerta_tipo: "ok",
      status: "Em andamento",
      cronograma_total: 2,
    },
    {
      id: "treino",
      alerta_tipo: "ok",
      status: "Em andamento",
      cronograma_total: 12,
    },
  ];

  function supabaseFalso({
    erro = null,
  }: { erro?: { message: string } | null } = {}) {
    return {
      auth: authFalso("x"),
      rpc: vi.fn(async (nome: string, argumentos?: Record<string, unknown>) => {
        if (nome === "get_nucleo_cronograma_resumo")
          return { data: RESUMO, error: null };
        if (nome === "reiniciar_edital_treinamento")
          return erro
            ? { data: null, error: erro }
            : { data: { edital: definido(argumentos).p_edital }, error: null };
        return { data: null, error: { message: `RPC inesperada: ${nome}` } };
      }),
    };
  }

  type ControladorDoNucleo = ReturnType<typeof criarNucleo> & {
    raiz: Root | null;
  };
  let controlador: ControladorDoNucleo | null = null;

  async function montar({
    perfil,
    supabase = supabaseFalso(),
  }: { perfil?: unknown; supabase?: ReturnType<typeof supabaseFalso> } = {}) {
    document.body.innerHTML = `<section id="page-nucleo" class="page active"></section>`;
    const toast = vi.fn();
    const aoSalvar = vi.fn(async () => {});
    const confirmar = vi.fn(() => true);
    await act(async () => {
      controlador = montarTela<
        OpcoesDaPaginaDoNucleo,
        ReturnType<typeof criarNucleo>
      >(criarNucleo, "page-nucleo", {
        secao: document.getElementById("page-nucleo"),
        supabase,
        toast,
        loader: () => {},
        getProfile: () => perfil,
        confirmar,
        aoSalvar,
        agora: () => new Date(2026, 9, 7, 10),
      });
    });
    await act(async () => {
      publicarUnidadesDoCatalogo([]);
      publicarLinhasDoMonitoramento(LINHAS());
    });
    await esperar(() => definido(controlador).render());
    return { supabase, toast, aoSalvar, confirmar };
  }

  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    window.localStorage.clear();
  });

  afterEach(async () => {
    await act(async () => controlador?.raiz?.unmount());
    controlador?.estado.desligar();
    controlador = null;
    await act(async () => redefinirDadosDoMonitoramento());
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  const linha = (id: string) =>
    document.querySelector(`#nucleoRows tr[data-record-id="${id}"]`);
  const linhaDoEdital = (id: string) =>
    document.querySelector<HTMLElement>(
      `#nucleoRows tr[data-record-id="${id}"]`,
    );
  /* "Reiniciar treinamento" fica no "⋯" da linha (AcoesDaLinha). */
  const botaoReiniciar = async (id: string) => {
    const menu = linhaDoEdital(id)?.querySelector<HTMLElement>(
      '[aria-label^="Mais ações de"]',
    );
    if (menu && menu.getAttribute("aria-expanded") !== "true")
      await clicar(menu);
    return linhaDoEdital(id)?.querySelector<HTMLElement>(
      '[data-acao="reiniciar-treinamento"]',
    );
  };
  const ADMIN = { perfil: "admin", admin_global: true };

  describe("edital de treinamento em Editais", () => {
    it("a linha do treinamento tem o selo; a do edital real, não", async () => {
      await montar({ perfil: { perfil: "edital_gestor" } });
      await esperar(() => linha("treino"));
      expect(
        linha("treino")?.querySelector(".selo-de-treinamento")?.textContent,
      ).toBe("Treinamento");
      expect(linha("real")?.querySelector(".selo-de-treinamento")).toBeNull();
    });

    it("só o admin global vê 'Reiniciar treinamento', e só no edital de treinamento", async () => {
      await montar({ perfil: { perfil: "edital_gestor" } });
      await esperar(() => linha("treino"));
      expect(await botaoReiniciar("treino")).toBeFalsy();
      await act(async () => controlador?.raiz?.unmount());
      controlador?.estado.desligar();
      await act(async () => redefinirDadosDoMonitoramento());

      await montar({ perfil: ADMIN });
      await esperar(() => linha("treino"));
      expect(await botaoReiniciar("treino")).toBeTruthy();
      expect(await botaoReiniciar("real")).toBeFalsy();
    });

    it("confirma na própria linha (sem window.confirm) e chama o RPC com o edital", async () => {
      const { supabase, confirmar, aoSalvar, toast } = await montar({
        perfil: ADMIN,
      });
      await esperar(() => linha("treino"));
      await clicar(await botaoReiniciar("treino"));
      const grupo = definido(
        linha("treino")?.querySelector(".nucleo-confirma-reinicio"),
      );
      expect(grupo.getAttribute("role")).toBe("group");
      expect(grupo.textContent).toContain("Treinamento – Saúde Indígena");
      const chamadasAntes = supabase.rpc.mock.calls.filter(
        ([n]) => n === "reiniciar_edital_treinamento",
      );
      expect(chamadasAntes).toHaveLength(0);

      const [reiniciar] = [...grupo.querySelectorAll("button")].filter(
        (b) => b.textContent === "Reiniciar",
      );
      await clicar(reiniciar);
      await esperar(() =>
        supabase.rpc.mock.calls.some(
          ([n]) => n === "reiniciar_edital_treinamento",
        ),
      );
      expect(supabase.rpc).toHaveBeenCalledWith(
        "reiniciar_edital_treinamento",
        {
          p_edital: "treino",
        },
      );
      expect(confirmar).not.toHaveBeenCalled();
      await esperar(() => aoSalvar.mock.calls.length > 0);
      expect(toast).toHaveBeenCalledWith("Treinamento reiniciado.");
    });

    it("Cancelar fecha a confirmação sem chamar o banco", async () => {
      const { supabase } = await montar({ perfil: ADMIN });
      await esperar(() => linha("treino"));
      await clicar(await botaoReiniciar("treino"));
      const cancelar = [
        ...definido(linha("treino")).querySelectorAll(
          ".nucleo-confirma-reinicio button",
        ),
      ].find((b) => b.textContent === "Cancelar");
      await clicar(cancelar);
      expect(
        linha("treino")?.querySelector(".nucleo-confirma-reinicio"),
      ).toBeNull();
      expect(
        supabase.rpc.mock.calls.some(
          ([n]) => n === "reiniciar_edital_treinamento",
        ),
      ).toBe(false);
    });

    it("o estado recusa edital real e quem não é admin, sem ir ao banco", async () => {
      const { supabase, toast } = await montar({ perfil: ADMIN });
      const linhaReal = { id: "real", ST_TREINAMENTO: "N" };
      expect(
        await definido(controlador).estado.reiniciarTreinamento(linhaReal),
      ).toBe(false);
      expect(toast).toHaveBeenCalledWith(
        "Só o edital de treinamento pode ser reiniciado.",
        "warn",
      );
      expect(
        supabase.rpc.mock.calls.some(
          ([n]) => n === "reiniciar_edital_treinamento",
        ),
      ).toBe(false);
    });
  });
});

bloco("componentes/nucleo-reativar-edital", () => {
  /*
    Reativar edital: no "⋯" da linha do Histórico, só para quem edita
    editais. O modal lê o cronograma, pede motivo, nova data de fim e o nome
    da etapa, e grava pela mesma RPC do formulário
    (`salvar_monitoramento_com_cronograma_v2`), com o motivo no histórico.
    Cancelado e cálculo manual só explicam. "Agora" é 24/11/2026.
  */
  const AGORA = new Date("2026-11-24T15:00:00Z");

  beforeAll(() => import("../src/modulos/editais/reativar-edital.tsx"));

  const LINHAS = () => [
    {
      id: "ativo",
      unidade: "DSEI Fictício Norte",
      edital: "40/2026",
      status: "Em andamento",
      etapa: "Entrevistas",
      risco: "Baixo",
      vagas_total: 5,
    },
    {
      id: "concluido",
      unidade: "DSEI Fictício Sul",
      edital: "15/2025",
      id_unidade: "U15",
      sigla_unidade: "DSEI-FS",
      tipo_unidade: "DSEI",
      uf: "MT",
      responsavel: "USI",
      status: "Concluído",
      etapa: "Resultado final do Processo Seletivo",
      risco: "Baixo",
      vagas_total: 12,
      data_inicio: "2025-03-01",
      data_fim: "2025-06-10",
      CO_AREA: "saude-indigena",
    },
    {
      id: "cancelado",
      unidade: "DSEI Fictício Leste",
      edital: "16/2025",
      status: "Cancelado",
      etapa: "Cancelado",
      risco: "Baixo",
      vagas_total: 3,
    },
  ];

  const ETAPAS = [
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

  function supabaseFalso({
    manual = false,
    listaAtiva = false,
    listasComErro = false,
    ativarComErro = false,
  }: {
    manual?: boolean;
    listaAtiva?: boolean;
    listasComErro?: boolean;
    ativarComErro?: boolean;
  } = {}) {
    return {
      auth: authFalso("x"),
      rpc: vi.fn(
        async (nome: string, _argumentos?: Record<string, unknown>) => {
          if (nome === "get_nucleo_cronograma_resumo")
            return { data: [], error: null };
          if (nome === "listar_listas_aprovados")
            return listasComErro
              ? {
                  data: null,
                  error: { message: "Sem permissão para este recurso" },
                }
              : {
                  data: [
                    {
                      lista_id: "lista-15",
                      edital_id: "concluido",
                      ativo: listaAtiva,
                    },
                  ],
                  error: null,
                };
          if (nome === "definir_lista_aprovados_ativa")
            return ativarComErro
              ? {
                  data: null,
                  error: {
                    message: "O prazo de validade do processo seletivo venceu",
                  },
                }
              : { data: { ok: true }, error: null };
          if (nome === "get_monitoramento_cronograma")
            return {
              data: {
                monitoramento: {
                  cronograma_automatico: !manual,
                  nu_anos_validade: 1,
                  nu_meses_validade: 0,
                  st_prorrogado: false,
                },
                etapas: ETAPAS,
                historico: [],
              },
              error: null,
            };
          if (nome === "salvar_monitoramento_com_cronograma_v2")
            return {
              data: { ok: true, registro: { id: "concluido" } },
              error: null,
            };
          return { data: null, error: { message: `RPC inesperada: ${nome}` } };
        },
      ),
    };
  }

  type ControladorDoNucleo = ReturnType<typeof criarNucleo> & {
    raiz: Root | null;
  };
  let controlador: ControladorDoNucleo | null = null;

  const EDITOR = { perfil: "edital_gestor" };
  const LEITOR = { perfil: "leitor" };

  async function montar({
    perfil = EDITOR,
    supabase = supabaseFalso(),
  }: { perfil?: unknown; supabase?: ReturnType<typeof supabaseFalso> } = {}) {
    document.body.innerHTML = `<section id="page-nucleo" class="page active"></section>`;
    const toast = vi.fn();
    const aoSalvar = vi.fn(async () => {});
    const confirmar = vi.fn(() => true);
    await act(async () => {
      controlador = montarTela<
        OpcoesDaPaginaDoNucleo,
        ReturnType<typeof criarNucleo>
      >(criarNucleo, "page-nucleo", {
        secao: document.getElementById("page-nucleo"),
        supabase,
        toast,
        loader: () => {},
        getProfile: () => perfil,
        confirmar,
        aoSalvar,
        agora: () => AGORA,
      });
    });
    await act(async () => {
      publicarUnidadesDoCatalogo([]);
      publicarLinhasDoMonitoramento(LINHAS());
    });
    await esperar(() => definido(controlador).render());
    return { supabase, toast, aoSalvar, confirmar };
  }

  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    window.localStorage.clear();
  });

  afterEach(async () => {
    await act(async () => controlador?.raiz?.unmount());
    controlador?.estado.desligar();
    controlador = null;
    await act(async () => redefinirDadosDoMonitoramento());
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  const linha = (id: string) =>
    document.querySelector<HTMLElement>(
      `#nucleoRows tr[data-record-id="${id}"]`,
    );
  const vista = (valor: "ativos" | "historico") =>
    document.querySelector<HTMLElement>(
      `[data-tour="editais-ativos-e-historico"] [data-valor="${valor}"]`,
    );
  /* "Reativar edital" fica no "⋯" da linha (AcoesDaLinha). */
  const botaoReativar = async (id: string) => {
    const menu = linha(id)?.querySelector<HTMLElement>(
      '[aria-label^="Mais ações de"]',
    );
    if (menu && menu.getAttribute("aria-expanded") !== "true")
      await clicar(menu);
    return linha(id)?.querySelector<HTMLElement>(
      '[data-acao="reativar-edital"]',
    );
  };
  const modal = () => document.getElementById("reativarEdital");
  const chamadas = (supabase: ReturnType<typeof supabaseFalso>, nome: string) =>
    supabase.rpc.mock.calls.filter(([n]) => n === nome);

  it("só quem edita editais vê 'Reativar edital', e só nos editais do Histórico", async () => {
    await montar({ perfil: LEITOR });
    await clicar(vista("historico"));
    await esperar(() => linha("concluido"));
    expect(await botaoReativar("concluido")).toBeFalsy();
    await act(async () => controlador?.raiz?.unmount());
    controlador?.estado.desligar();
    await act(async () => redefinirDadosDoMonitoramento());

    await montar({ perfil: EDITOR });
    await esperar(() => linha("ativo"));
    expect(await botaoReativar("ativo")).toBeFalsy();
    await clicar(vista("historico"));
    await esperar(() => linha("concluido"));
    expect(await botaoReativar("concluido")).toBeTruthy();
    expect(await botaoReativar("cancelado")).toBeTruthy();
  });

  it("reativa: pede motivo e data futura, grava a etapa nova pela RPC do formulário e volta aos Ativos", async () => {
    const { supabase, toast, aoSalvar, confirmar } = await montar();
    await clicar(vista("historico"));
    await esperar(() => linha("concluido"));
    await clicar(await botaoReativar("concluido"));
    await esperar(() => document.getElementById("reativarMotivo"));
    expect(modal()?.textContent).toContain("Reativar edital 15/2025");
    expect(
      document.querySelector<HTMLInputElement>("#reativarEtapa")?.value,
    ).toBe("Convocação de remanescentes");
    expect(
      document.querySelector<HTMLInputElement>("#reativarDataFim")?.min,
    ).toBe("2026-11-25");
    // A lista vigente está inativa (a validade a inativou): volta a ficar ativa.
    await esperar(() => modal()?.querySelector("[data-lista-na-reativacao]"));
    expect(
      modal()?.querySelector('[data-lista-na-reativacao="ativar"]')
        ?.textContent,
    ).toBe("A lista de aprovados, hoje inativa, volta a ficar ativa.");

    // Sem motivo nem data: os erros aparecem e nada vai ao banco.
    await clicar(modal()?.querySelector('[data-acao="confirmar-reativacao"]'));
    expect(modal()?.textContent).toContain("Informe o motivo");
    expect(modal()?.textContent).toContain("Informe a nova data de fim.");
    expect(
      chamadas(supabase, "salvar_monitoramento_com_cronograma_v2"),
    ).toHaveLength(0);

    await digitar(
      document.getElementById("reativarMotivo"),
      "Convocar os remanescentes da lista",
    );
    await digitar(document.getElementById("reativarDataFim"), "2027-01-31");
    expect(modal()?.textContent).toContain(
      'O edital volta para Ativos, com status "Em andamento" até 31/01/2027.',
    );
    expect(modal()?.textContent).toContain(
      "volta a ficar ativa, com validade até 31/01/2028.",
    );
    await clicar(modal()?.querySelector('[data-acao="confirmar-reativacao"]'));
    await esperar(
      () => chamadas(supabase, "salvar_monitoramento_com_cronograma_v2").length,
    );
    const [, argumentos] = definido(
      chamadas(supabase, "salvar_monitoramento_com_cronograma_v2")[0],
    );
    const { p_payload, p_cronograma, p_motivo, p_numero_errata } =
      definido(argumentos);
    expect(p_motivo).toBe(
      "Reativação do edital: Convocar os remanescentes da lista",
    );
    expect(p_numero_errata).toBeNull();
    expect(p_payload).toMatchObject({
      id: "concluido",
      edital: "15/2025",
      unidade: "DSEI Fictício Sul",
      id_unidade: "U15",
      uf: "MT",
      status: "Em andamento",
      etapa: "Convocação de remanescentes",
      data_fim: "2027-01-31",
      cronograma_automatico: true,
      co_area: "saude-indigena",
    });
    expect(p_cronograma).toHaveLength(3);
    expect(definido((p_cronograma as unknown[])[2])).toMatchObject({
      ordem: 3,
      atividade: "Convocação de remanescentes",
      data_inicio: "2026-11-24",
      data_fim: "2027-01-31",
    });
    // Os avisos do cronograma (data fora do ano do edital) não perguntam de novo.
    expect(confirmar).not.toHaveBeenCalled();
    await esperar(() => aoSalvar.mock.calls.length > 0);
    // Depois de gravar o cronograma, a lista vigente volta a ficar ativa.
    expect(supabase.rpc).toHaveBeenCalledWith("definir_lista_aprovados_ativa", {
      p_lista_id: "lista-15",
      p_ativo: true,
    });
    const nomes = supabase.rpc.mock.calls.map(([n]) => n);
    expect(nomes.lastIndexOf("definir_lista_aprovados_ativa")).toBeGreaterThan(
      nomes.indexOf("salvar_monitoramento_com_cronograma_v2"),
    );
    expect(toast).toHaveBeenCalledWith(
      "15/2025 reativado: em andamento até 31/01/2027. A lista de aprovados voltou a ficar ativa.",
    );
    await esperar(() => !modal());
    expect(vista("ativos")?.getAttribute("aria-checked")).toBe("true");
  });

  it("edital cancelado: a ação explica que é no formulário e não lê nem grava nada", async () => {
    const { supabase } = await montar();
    await clicar(vista("historico"));
    await esperar(() => linha("cancelado"));
    await clicar(await botaoReativar("cancelado"));
    await esperar(() => modal());
    expect(modal()?.textContent).toContain("tire o status excepcional");
    expect(
      modal()?.querySelector('[data-acao="abrir-formulario"]'),
    ).toBeTruthy();
    expect(document.getElementById("reativarMotivo")).toBeNull();
    expect(chamadas(supabase, "get_monitoramento_cronograma")).toHaveLength(0);
    expect(
      chamadas(supabase, "salvar_monitoramento_com_cronograma_v2"),
    ).toHaveLength(0);
  });

  /* Preenche o modal do 15/2025 e confirma. */
  async function reativarO15() {
    await clicar(vista("historico"));
    await esperar(() => linha("concluido"));
    await clicar(await botaoReativar("concluido"));
    await esperar(() => document.getElementById("reativarMotivo"));
    await digitar(
      document.getElementById("reativarMotivo"),
      "Convocar os remanescentes da lista",
    );
    await digitar(document.getElementById("reativarDataFim"), "2027-01-31");
  }

  it("sem Editor em Importação: o modal diz quem ativa a lista, e ela não é ativada", async () => {
    const { supabase, toast, aoSalvar } = await montar({
      perfil: { permissoes: { nucleo: "editor", aprovados: "leitor" } },
    });
    await reativarO15();
    await esperar(() =>
      modal()?.querySelector('[data-lista-na-reativacao="sem-permissao"]'),
    );
    expect(modal()?.textContent).toContain(
      "quem a ativa é quem tem nível Editor em Importação e convocação, ou o administrador global, em Lista de aprovados › Listas do edital.",
    );
    await clicar(modal()?.querySelector('[data-acao="confirmar-reativacao"]'));
    await esperar(() => aoSalvar.mock.calls.length > 0);
    expect(chamadas(supabase, "definir_lista_aprovados_ativa")).toHaveLength(0);
    expect(toast).toHaveBeenCalledWith(
      "15/2025 reativado: em andamento até 31/01/2027.",
    );
  });

  it("lista já ativa: nada a dizer nem a ativar", async () => {
    const { supabase, aoSalvar } = await montar({
      supabase: supabaseFalso({ listaAtiva: true }),
    });
    await reativarO15();
    await esperar(() => chamadas(supabase, "listar_listas_aprovados").length);
    expect(modal()?.querySelector("[data-lista-na-reativacao]")).toBeNull();
    await clicar(modal()?.querySelector('[data-acao="confirmar-reativacao"]'));
    await esperar(() => aoSalvar.mock.calls.length > 0);
    expect(chamadas(supabase, "definir_lista_aprovados_ativa")).toHaveLength(0);
  });

  it("listas sem acesso: o modal avisa quem ativa; a ativação que falha não desfaz a reativação", async () => {
    const semAcesso = await montar({
      supabase: supabaseFalso({ listasComErro: true }),
    });
    await reativarO15();
    await esperar(() =>
      modal()?.querySelector('[data-lista-na-reativacao="nao-lida"]'),
    );
    expect(
      chamadas(semAcesso.supabase, "definir_lista_aprovados_ativa"),
    ).toHaveLength(0);
    await act(async () => controlador?.raiz?.unmount());
    controlador?.estado.desligar();
    await act(async () => redefinirDadosDoMonitoramento());

    const { toast, aoSalvar } = await montar({
      supabase: supabaseFalso({ ativarComErro: true }),
    });
    await reativarO15();
    await clicar(modal()?.querySelector('[data-acao="confirmar-reativacao"]'));
    await esperar(() => aoSalvar.mock.calls.length > 0);
    expect(toast).toHaveBeenCalledWith(
      "15/2025 reativado: em andamento até 31/01/2027. A lista de aprovados não foi ativada: O prazo de validade do processo seletivo venceu. Ative a lista em Listas do edital.",
      "warn",
    );
  });

  it("cálculo manual: explica que o status é digitado e leva ao formulário", async () => {
    const { supabase } = await montar({
      supabase: supabaseFalso({ manual: true }),
    });
    await clicar(vista("historico"));
    await esperar(() => linha("concluido"));
    await clicar(await botaoReativar("concluido"));
    await esperar(() => modal()?.textContent?.includes("cálculo manual"));
    expect(document.getElementById("reativarMotivo")).toBeNull();
    expect(
      modal()?.querySelector('[data-acao="abrir-formulario"]'),
    ).toBeTruthy();
    expect(
      chamadas(supabase, "salvar_monitoramento_com_cronograma_v2"),
    ).toHaveLength(0);
  });
});

bloco("componentes/nucleo", () => {
  /*
  A página "Editais" (Equipe Núcleo) em React: a tabela com as linhas que o
  legado publica, o painel operacional sobre o resumo dos cronogramas, o
  formulário do edital com o cronograma e a linha do tempo. "Hoje" é
  15/09/2026.
*/

  const HOJE = new Date(2026, 8, 15, 10);

  // O formulário do edital chega por import() (lazy): já baixado, abre no clique.
  beforeAll(() => import("../src/modulos/editais/modal-do-edital.tsx"));

  const UNIDADES = [
    {
      id_unidade: "U1",
      sigla: "DSEI-MAO",
      nome_oficial: "DSEI Manaus",
      tipo: "DSEI",
      uf_sede: "am",
    },
    {
      id_unidade: "U2",
      sigla: "CASAI-SP",
      nome_oficial: "CASAI São Paulo",
      tipo: "CASAI",
      uf_sede: "sp",
    },
  ];

  const LINHAS = () => [
    {
      id: "1",
      unidade: "DSEI Manaus",
      id_unidade: "U1",
      edital: "10/2026",
      processo: "00700.000001/2026-00",
      responsavel: "USI",
      status: "Em andamento",
      etapa: "Análise curricular",
      risco: "Baixo",
      vagas_total: 10,
      contratados: 4,
      vagas_ociosas: 6,
      inscritos: 1308,
      link_edital: "https://exemplo.gov.br/edital-10",
    },
    {
      id: "2",
      unidade: "CASAI São Paulo",
      edital: "11/2026",
      status: "Concluído",
      etapa: "Resultado final",
      risco: "Alto",
      vagas_total: 5,
      contratados: 5,
      vagas_ociosas: 0,
      link_edital: "javascript:alert(1)",
    },
    {
      id: "3",
      unidade: "DSEI Manaus",
      edital: "10/2026",
      status: "Planejado",
      risco: "Baixo",
      vagas_total: 3,
      vagas_ociosas: 9,
    },
  ];

  const RESUMO = [
    {
      id: "1",
      unidade: "DSEI Manaus",
      edital: "10/2026",
      alerta_tipo: "incompleto",
      status: "Em andamento",
      cronograma_total: 2,
    },
    {
      id: "2",
      unidade: "CASAI São Paulo",
      edital: "11/2026",
      alerta_tipo: "ok",
      status: "Concluído",
      cronograma_total: 3,
    },
    {
      id: "3",
      unidade: "DSEI Manaus",
      edital: "10/2026",
      alerta_tipo: "sem_cronograma",
      status: "Planejado",
      cronograma_total: 0,
    },
  ];

  const CRONOGRAMAS: Record<string, object> = {
    1: {
      monitoramento: {
        edital: "10/2026",
        unidade: "DSEI Manaus",
        cronograma_automatico: true,
      },
      estado: {
        status: "Em andamento",
        etapa: "Análise curricular",
        proxima_atividade: "Resultado",
        percentual: 50,
      },
      etapas: [
        {
          ordem: 1,
          atividade: "Inscrições",
          data_inicio: "2026-09-01",
          data_fim: "2026-09-10",
        },
        {
          ordem: 2,
          atividade: "Análise curricular",
          data_inicio: "2026-09-14",
          data_fim: "2026-09-20",
        },
      ],
      historico: [
        {
          acao: "alteracao",
          motivo: "Cadastro inicial",
          created_at: "2026-09-01T12:00:00Z",
          created_by_email: "ana@agenciasus.org.br",
          total_alteracoes: 2,
        },
      ],
    },
    2: {
      monitoramento: { edital: "11/2026", unidade: "CASAI São Paulo" },
      etapas: [
        {
          ordem: 1,
          atividade: "Publicação do Edital",
          data_inicio: "2026-03-01",
          data_fim: "2026-03-01",
          observacao: "DOU",
        },
        {
          ordem: 2,
          atividade: "Entrevistas",
          data_inicio: "2026-04-01",
          data_fim: "2026-04-05",
        },
        {
          ordem: 3,
          atividade: "Resultado final do Processo Seletivo",
          data_inicio: "2026-05-01",
          data_fim: "2026-05-01",
        },
      ],
      historico: [],
    },
  };

  /* TA_UNIDADE_AREA como está no banco (29/09/2026: CCE e Escritório passaram a Projetos). */
  const UNIDADES_POR_AREA = [
    { unidade: "CCE", area: "projetos" },
    { unidade: "Escritório Distrital e Regional", area: "projetos" },
    { unidade: "SEDE", area: "sede" },
    { unidade: "MFC", area: "projetos" },
    {
      unidade: "Projeto Agora Tem Especialistas Caminhoneiros",
      area: "projetos",
    },
    { unidade: "Rio Doce", area: "projetos" },
    { unidade: "Saúde nas Fronteiras", area: "projetos" },
  ];

  /* Os argumentos que as RPCs de Editais recebem neste teste. */
  type ArgumentosDoNucleo = {
    p_monitoramento_id?: string | number;
    p_id?: string;
    p_area?: string;
    p_edital?: string;
    p_payload?: Record<string, unknown>;
    p_motivo?: unknown;
    p_numero_errata?: unknown;
    p_cronograma?: Record<string, unknown>[];
    p_dados?: { linhas?: unknown[] };
  };

  type RpcDoNucleo = (
    nome: string,
    argumentos?: ArgumentosDoNucleo,
  ) => Promise<RespostaDaRpc>;

  function supabaseFalso({
    resumo = RESUMO,
    cronogramas = CRONOGRAMAS,
    listas = null,
  }: {
    resumo?: object[];
    cronogramas?: Record<string, object>;
    /* As listas vigentes de aprovados; `null` = RPC indisponível (nada marcado). */
    listas?: object[] | null;
  } = {}) {
    const auth: { ouvinte: OuvinteDaSessao | null } = { ouvinte: null };
    return {
      auth: authFalso("x", (ouvinte) => {
        auth.ouvinte = ouvinte;
      }),
      /* A sessão do teste só traz o usuário; o resto da Session é neutro. */
      trocarSessao: (
        evento: AuthChangeEvent,
        sessao: { user: { id: string } } | null,
      ) =>
        auth.ouvinte?.(
          evento,
          sessao && {
            ...sessaoFalsa("x"),
            user: { ...sessaoFalsa("x").user, ...sessao.user },
          },
        ),
      rpc: vi.fn<RpcDoNucleo>(async (nome, argumentos) => {
        if (nome === "get_nucleo_cronograma_resumo")
          return { data: resumo, error: null };
        if (nome === "get_monitoramento_cronograma")
          return {
            data:
              cronogramas[String(definido(argumentos).p_monitoramento_id)] ||
              {},
            error: null,
          };
        if (nome === "listar_unidades_por_area")
          return { data: UNIDADES_POR_AREA, error: null };
        if (nome === "listar_listas_aprovados" && listas)
          return { data: listas, error: null };
        if (nome === "mover_edital_de_area")
          return {
            data: {
              ok: true,
              id: definido(argumentos).p_id,
              para: definido(argumentos).p_area,
            },
            error: null,
          };
        if (nome === "salvar_monitoramento_com_cronograma_v2")
          return {
            data: {
              ok: true,
              registro: {
                id: definido(definido(argumentos).p_payload).id || "novo",
              },
            },
            error: null,
          };
        return { data: null, error: { message: `RPC inesperada: ${nome}` } };
      }),
    };
  }

  type ControladorDoNucleo = ReturnType<typeof criarNucleo> & {
    raiz: Pick<Root, "unmount"> | null;
  };
  let navegacao: ReturnType<typeof criarNavegacao> | null = null;

  /*
  Uma tela de mentira no registro: só o que o teste usa. O resto do
  controlador não existe (quem o chamar quebra, como no JavaScript).
*/
  type Parcial<T> = {
    [K in keyof T]?: T[K] extends (...argumentos: infer A) => unknown
      ? (...argumentos: A) => unknown
      : T[K] | null;
  };
  function telaDeMentira<V extends ViewDeTela>(
    parcial: Parcial<ControladoresDasTelas[V]>,
  ): ControladoresDasTelas[V] {
    return parcial as ControladoresDasTelas[V];
  }
  let controlador: ControladorDoNucleo | null = null;
  let perfilAtual: unknown = null;

  async function montar({
    perfil = { perfil: "edital_gestor" },
    supabase = supabaseFalso(),
    toast = vi.fn(),
    confirmar = vi.fn(() => true),
    aoSalvar = vi.fn(async () => {}),
    linhas = LINHAS(),
    publicar = true,
    abrir = true,
    relogio = true,
    comNavegacao = false,
  }: {
    perfil?: unknown;
    supabase?: ReturnType<typeof supabaseFalso>;
    toast?: ReturnType<typeof vi.fn<(mensagem: string, tom?: string) => void>>;
    confirmar?: ReturnType<typeof vi.fn<(mensagem: string) => boolean>>;
    aoSalvar?: ReturnType<typeof vi.fn<() => Promise<void>>>;
    linhas?: object[];
    publicar?: boolean;
    abrir?: boolean;
    relogio?: boolean;
    comNavegacao?: boolean;
  } = {}) {
    perfilAtual = perfil;
    if (comNavegacao) {
      /*
      Como no app: Editais é rota da raiz, e as Regras do edital ficam no
      endereço (src/app/navegacao.ts).
    */
      document.body.innerHTML = "";
      const criado = criarNucleo({
        supabase,
        toast,
        loader: () => {},
        getProfile: () => perfilAtual,
        confirmar,
        aoSalvar,
        agora: relogio ? () => new Date(HOJE) : undefined,
      });
      const montado = montarTelasNoTeste(
        criarNavegacao({
          janela: { location: { reload() {} } },
          obterPerfil: () => ({
            id: "g",
            ativo: true,
            perfil: "edital_gestor",
            areas: ["saude-indigena", "sede", "projetos"],
          }),
          confirmarSaida: () => true,
          aplicarAtualizacao: () => false,
        }),
        { nucleo: criado },
      );
      navegacao = montado.navegacao;
      definido(navegacao).irPara("nucleo");
      controlador = { ...criado, raiz: { unmount: () => montado.desmontar() } };
    } else {
      document.body.innerHTML = `<section id="page-nucleo" class="page active"></section>`;
    }
    if (!comNavegacao)
      await act(async () => {
        controlador = montarTela<
          OpcoesDaPaginaDoNucleo,
          ReturnType<typeof criarNucleo>
        >(criarNucleo, "page-nucleo", {
          secao: document.getElementById("page-nucleo"),
          supabase,
          toast,
          loader: () => {},
          getProfile: () => perfilAtual,
          confirmar,
          aoSalvar,
          // relogio: false monta como em produção, sem relógio injetado.
          agora: relogio ? () => new Date(HOJE) : undefined,
        });
      });
    if (publicar)
      await act(async () => {
        publicarUnidadesDoCatalogo(UNIDADES);
        publicarLinhasDoMonitoramento(linhas);
      });
    if (abrir) await esperar(() => definido(controlador).render());
    return { supabase, toast, confirmar, aoSalvar };
  }

  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(async () => {
    await act(async () => controlador?.raiz?.unmount());
    controlador?.estado.desligar();
    controlador = null;
    await act(async () => redefinirDadosDoMonitoramento());
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  const $ = (id: string) => document.getElementById(id);
  const campo = (id: string) =>
    document.querySelector<HTMLInputElement>(`#${id}`);
  const seletor = (id: string) =>
    document.querySelector<HTMLSelectElement>(`#${id}`);
  const areaDeTexto = (id: string) =>
    document.querySelector<HTMLTextAreaElement>(`#${id}`);
  const botaoPorId = (id: string) =>
    document.querySelector<HTMLButtonElement>(`#${id}`);
  const linhasDaTabela = () =>
    [
      ...document.querySelectorAll<HTMLElement>(
        "#nucleoRows tr[data-record-id]",
      ),
    ].map((tr) => tr.dataset.recordId);
  const linha = (id: string) =>
    document.querySelector<HTMLElement>(
      `#nucleoRows tr[data-record-id="${id}"]`,
    );
  /* A ação da linha no "⋯" (AcoesDaLinha): abre o menu e devolve o item. */
  const acaoDaLinha = async (id: string, acao: string) => {
    const menu = linha(id)?.querySelector<HTMLElement>(
      '[aria-label^="Mais ações de"]',
    );
    if (menu && menu.getAttribute("aria-expanded") !== "true")
      await clicar(menu);
    return linha(id)?.querySelector<HTMLElement>(`[data-acao="${acao}"]`);
  };
  /* O indicador clicável (o botão do Kpi); o skeleton não tem botão. */
  const cartao = (chave: string) =>
    document.querySelector<HTMLElement>(
      `#nucleoOperationalKpis [data-kpi="${chave}"] .ui-kpi-alvo`,
    );
  const indicadores = () => $("nucleoOperationalKpis");
  const atualizar = () =>
    document.querySelector<HTMLButtonElement>(
      '#page-nucleo [data-acao="atualizar"]',
    );
  const pedidosDoResumo = (supabase: ReturnType<typeof supabaseFalso>) =>
    supabase.rpc.mock.calls.filter(
      ([nome]) => nome === "get_nucleo_cronograma_resumo",
    );
  const abrirEdital = async (id: string) =>
    clicar(await acaoDaLinha(id, "editar"));
  /* A vista da tabela: Ativos (o padrão) ou Histórico (concluídos e cancelados). */
  const vista = (valor: "ativos" | "historico" | "todas") =>
    document.querySelector<HTMLElement>(
      `[data-tour="editais-ativos-e-historico"] [data-valor="${valor}"]`,
    );
  const verHistorico = () => clicar(vista("historico"));
  const verAtivos = () => clicar(vista("ativos"));

  describe("tabela de editais", () => {
    it("antes de o legado publicar as linhas, a tabela e os KPIs são skeleton", async () => {
      await montar({ publicar: false, abrir: false });
      expect($("nucleoRows")?.getAttribute("aria-busy")).toBe("true");
      expect(
        $("nucleoRows")?.querySelectorAll<HTMLElement>(".ui-esqueleto-tr")
          .length,
      ).toBe(8);
      expect($("nucleoRows")?.textContent).toBe("");
      expect(
        indicadores()?.querySelectorAll<HTMLElement>(
          '.ui-kpi[aria-busy="true"]',
        ),
      ).toHaveLength(8);
      // ED-1.4: os cartões de situação também nascem skeleton.
      expect(
        indicadores()
          ?.querySelector<HTMLElement>('[data-kpi="ativos"]')
          ?.getAttribute("aria-busy"),
      ).toBe("true");
      expect(
        document.querySelector<HTMLElement>(
          "#page-nucleo [data-status-da-carga]",
        )?.textContent,
      ).toBe("Carregando dados…");
    });

    it("por padrão, do edital mais recente para o mais antigo", async () => {
      await montar({
        linhas: LINHAS().map((linha, i) => ({
          ...linha,
          data_inicio: ["2026-05-01", "2026-03-01", "2026-07-01"][i],
        })),
      });
      expect(linhasDaTabela()).toEqual(["3", "1"]);
      const edital = document.querySelector<HTMLElement>(
        '#page-nucleo th[aria-sort="descending"]',
      );
      expect(edital?.textContent).toContain("Edital");
    });

    it("clicar na coluna ordena por ela: crescente, depois decrescente", async () => {
      await montar();
      const ordenar = (rotulo: string) =>
        clicar(
          document.querySelector<HTMLElement>(
            `#page-nucleo .ui-ordenar[title^="Ordenar por ${rotulo}"]`,
          ),
        );
      // Vagas: 10 (1), 3 (3); o 2 (Concluído) está no Histórico.
      await ordenar("Vagas");
      expect(linhasDaTabela()).toEqual(["3", "1"]);
      await ordenar("Vagas");
      expect(linhasDaTabela()).toEqual(["1", "3"]);
      // No Histórico, a mesma ordem vale.
      await verHistorico();
      expect(linhasDaTabela()).toEqual(["2"]);
    });

    it("colore status e risco, e só faz link de endereço http(s)", async () => {
      await montar();
      const selo = (id: string, tom: string) =>
        linha(id)?.querySelector<HTMLElement>(`.ui-selo[data-tom="${tom}"]`)
          ?.textContent;
      expect(selo("1", "info")).toBe("Em andamento");
      expect(
        linha("1")?.querySelector<HTMLElement>("a.link")?.getAttribute("href"),
      ).toBe("https://exemplo.gov.br/edital-10");
      expect(
        linha("1")?.querySelectorAll<HTMLElement>("td.num")[2]?.textContent,
      ).toBe("6");
      await verHistorico();
      expect(selo("2", "sucesso")).toBe("Concluído");
      expect(selo("2", "perigo")).toBe("Alto");
      expect(linha("2")?.querySelector<HTMLElement>("a")).toBeNull();
    });

    it("busca por edital, unidade, status, etapa, risco e processo", async () => {
      await montar();
      await verHistorico();
      await digitar($("nucleoSearch"), "casai");
      expect(linhasDaTabela()).toEqual(["2"]);
      await verAtivos();
      await digitar($("nucleoSearch"), "00700.000001");
      expect(linhasDaTabela()).toEqual(["1"]);
      await digitar($("nucleoSearch"), "nada disso");
      expect($("nucleoRows")?.textContent).toContain(
        "Nenhum resultado para os filtros aplicados",
      );
    });

    it("quem só consulta não vê Novo nem Editar", async () => {
      await montar({
        perfil: { perfil: "usuario" },
        supabase: supabaseFalso({ resumo: [] }),
      });
      expect($("newEditalBtn")).toBeNull();
      // Só o "Abrir": sem o que editar, a linha não tem o "⋯".
      expect(
        linha("1")?.querySelector('[data-acao="pagina-do-edital"]'),
      ).not.toBeNull();
      expect(
        linha("1")?.querySelector('[aria-label^="Mais ações de"]'),
      ).toBeNull();
      expect(document.querySelector('[data-acao="editar"]')).toBeNull();
    });

    it("o botão de listas abre o modal da Lista de Aprovados (pelo registro das telas)", async () => {
      const aprovados = {
        nome: "Lista de aprovados",
        conteudo: null,
        render() {},
        openImportModal: vi.fn(),
      };
      registrarTelas({
        approved: {
          carregar: async () => telaDeMentira<"approved">(aprovados),
        },
      });
      try {
        await montar();
        await clicar(await acaoDaLinha("1", "listas"));
        await vi.waitFor(() =>
          expect(aprovados.openImportModal).toHaveBeenCalledWith(
            "1",
            "10/2026 · DSEI Manaus",
          ),
        );
      } finally {
        registrarTelas({});
      }
    });

    it("edital concluído sem aprovados: botão amarelo com o aviso, e o clique abre as listas sem toast", async () => {
      const aprovados = {
        nome: "Lista de aprovados",
        conteudo: null,
        render() {},
        openImportModal: vi.fn(),
      };
      registrarTelas({
        approved: {
          carregar: async () => telaDeMentira<"approved">(aprovados),
        },
      });
      try {
        // 2 é Concluído com a lista vazia; 1 (Em andamento) e 3 (Planejado) não têm lista.
        const { toast } = await montar({
          supabase: supabaseFalso({
            listas: [{ edital_id: "2", total_candidatos: 0 }],
          }),
        });
        // Com aviso, o botão fica à vista; sem aviso, a lista vai para o "⋯".
        const botao = (id: string) =>
          linha(id)?.querySelector<HTMLElement>(".nucleo-listas");
        // Edital ainda não concluído não é marcado, mesmo sem lista.
        for (const id of ["1", "3"]) {
          expect(botao(id)).toBeNull();
          expect((await acaoDaLinha(id, "listas"))?.textContent).toContain(
            "Lista de aprovados",
          );
        }
        await verHistorico();
        expect(botao("2")?.classList.contains("nucleo-listas-aviso")).toBe(
          true,
        );
        expect(botao("2")?.getAttribute("title")).toBe(
          "Nenhum candidato foi aprovado neste edital",
        );
        await clicar(botao("2"));
        // O amarelo é só sinal: o clique abre o modal padrão das listas.
        await vi.waitFor(() =>
          expect(aprovados.openImportModal).toHaveBeenCalledWith(
            "2",
            expect.any(String),
          ),
        );
        expect(toast).not.toHaveBeenCalled();
      } finally {
        registrarTelas({});
      }
    });

    it("cada linha abre a página do edital (pelo id quando o número se repete na área)", async () => {
      const navigate = vi.fn(() => true);
      vi.stubGlobal("navigate", navigate);
      await montar();
      const botao = linha("1")?.querySelector<HTMLElement>(
        '[data-acao="pagina-do-edital"]',
      );
      expect(botao?.getAttribute("title")).toBe("Abrir página do edital");
      await clicar(botao);
      // 10/2026 está em duas linhas da área (1 e 3): o endereço leva o id.
      expect(navigate).toHaveBeenCalledWith("edital", { edital: "1" });
      await verHistorico();
      await clicar(
        linha("2")?.querySelector<HTMLElement>(
          '[data-acao="pagina-do-edital"]',
        ),
      );
      expect(navigate).toHaveBeenLastCalledWith("edital", {
        edital: "11-2026",
      });
      vi.unstubAllGlobals();
    });

    it("Regras do edital: abre no lugar da tabela, com o edital e a etapa no endereço, troca de etapa e volta", async () => {
      // O pacote da página baixa sob demanda; aqui, já em cache.
      await import("../src/modulos/regras-do-edital/regras-do-edital.tsx");
      await montar({ comNavegacao: true });
      const pagina = async () => {
        for (let i = 0; i < 200; i += 1) {
          const achada = document.querySelector<HTMLElement>(
            "[data-tour='regras-do-edital']",
          );
          if (achada) return achada;
          await act(async () => new Promise((r) => setTimeout(r, 25)));
        }
        return null;
      };
      await clicar(await acaoDaLinha("1", "regras"));
      const regras = await pagina();
      expect(regras).not.toBeNull();
      expect(regras?.dataset.etapa).toBe("triagem");
      expect(regras?.textContent).toContain("Regras do edital 10/2026");
      expect(location.pathname).toMatch(/\/editais\/1\/regras\/triagem$/);
      expect(
        [
          ...definido(regras).querySelectorAll<HTMLElement>(
            ".ui-segmentado button",
          ),
        ].map((b) => b.textContent?.trim()),
      ).toEqual([
        "1 Triagem",
        "2 Avaliação documental",
        "3 Entrevista",
        "4 Classificação",
        "5 Chamada para contratação",
      ]);
      expect(document.getElementById("nucleoRows")).toBeNull();

      // Outra etapa: troca o endereço sem empilhar.
      const tamanho = history.length;
      await clicar(
        [
          ...definido(regras).querySelectorAll<HTMLElement>(
            ".ui-segmentado button",
          ),
        ].find((b) => b.textContent?.includes("Classificação")),
      );
      expect((await pagina())?.dataset.etapa).toBe("classificacao");
      expect(location.pathname).toMatch(/\/editais\/1\/regras\/classificacao$/);
      expect(history.length).toBe(tamanho);

      // "← Editais": volta pelo histórico (sem entrada órfã) e a tabela volta.
      await act(async () => {
        const voltou = new Promise((r) =>
          window.addEventListener("popstate", r, { once: true }),
        );
        document
          .querySelector<HTMLElement>("[data-acao='voltar-aos-editais']")
          ?.click();
        await voltou;
      });
      expect(
        document.querySelector<HTMLElement>("[data-tour='regras-do-edital']"),
      ).toBeNull();
      expect(document.getElementById("nucleoRows")).not.toBeNull();
      expect(location.pathname).toMatch(/\/editais$/);
      expect(definido(navegacao).obter().regras).toBeNull();
    });

    it("Regras do edital no histórico: o voltar do navegador fecha a página, o avançar reabre", async () => {
      await import("../src/modulos/regras-do-edital/regras-do-edital.tsx");
      await montar({ comNavegacao: true });
      definido(navegacao).abrirEntrada();
      await clicar(await acaoDaLinha("1", "regras"));
      expect(definido(navegacao).obter().regras).toEqual({
        edital: "1",
        etapa: "triagem",
      });
      await act(async () => {
        const mudou = new Promise((r) =>
          window.addEventListener("popstate", r, { once: true }),
        );
        history.back();
        await mudou;
      });
      expect(definido(navegacao).obter().regras).toBeNull();
      expect(
        document.querySelector<HTMLElement>("[data-tour='regras-do-edital']"),
      ).toBeNull();
      await act(async () => {
        const mudou = new Promise((r) =>
          window.addEventListener("popstate", r, { once: true }),
        );
        history.forward();
        await mudou;
      });
      expect(definido(navegacao).obter().regras).toEqual({
        edital: "1",
        etapa: "triagem",
      });
    });
  });

  describe("painel operacional", () => {
    it("mostra os indicadores e o alerta de cada linha, pelo id", async () => {
      await montar();
      expect(cartao("todos")?.textContent).toContain("3");
      expect(cartao("incompleto")?.textContent).toContain("1");
      expect(cartao("andamento")?.textContent).toContain("2");
      // Dois registros com o mesmo edital e a mesma unidade: cada um tem o seu alerta.
      expect(
        linha("1")?.querySelector<HTMLElement>(".nucleo-row-alert")
          ?.textContent,
      ).toContain("incompleto");
      expect(
        linha("3")?.querySelector<HTMLElement>(".nucleo-row-alert")
          ?.textContent,
      ).toContain("Sem cronograma");
      await verHistorico();
      expect(
        linha("2")?.querySelector<HTMLElement>(".nucleo-row-alert"),
      ).toBeNull();
      await verAtivos();
      expect(linha("1")?.dataset.monitoramentoId).toBe("1");
    });

    it("o indicador filtra a tabela, é anunciado e pode ser limpo", async () => {
      await montar();
      await clicar(cartao("sem_cronograma"));
      expect(linhasDaTabela()).toEqual(["3"]);
      expect(cartao("sem_cronograma")?.getAttribute("aria-pressed")).toBe(
        "true",
      );
      expect(
        cartao("sem_cronograma")
          ?.closest(".ui-kpi")
          ?.classList.contains("is-ativo"),
      ).toBe(true);
      const tarja = definido($("nucleoActiveAlertFilter"));
      expect(tarja.getAttribute("role")).toBe("status");
      expect(tarja.textContent).toContain("Sem cronograma");

      // Tirar o filtro deixa a vista em que o indicador contou (Todos).
      await clicar(tarja.querySelector<HTMLElement>(".ui-chip"));
      expect(linhasDaTabela()).toEqual(["2", "3", "1"]);
      expect($("nucleoActiveAlertFilter")).toBeNull();
    });

    /* Histórias em docs/historias-de-usuario/editais.md. */
    it("ED-1.1 — mostra Editais ativos e inativos no formato dos outros cartões", async () => {
      await montar();
      const ativos = definido(cartao("ativos"));
      const inativos = definido(cartao("inativos"));
      expect(ativos.textContent).toContain("Editais ativos");
      expect(
        ativos.querySelector<HTMLElement>(".ui-kpi-valor")?.textContent,
      ).toBe("2");
      expect(inativos.textContent).toContain("Editais inativos");
      expect(
        inativos.querySelector<HTMLElement>(".ui-kpi-valor")?.textContent,
      ).toBe("1");
      expect(cartao("todos")?.textContent).toContain("Total de editais");
      expect(
        ativos.closest(".ui-kpi")?.querySelector<HTMLElement>(".ui-kpi-icone"),
      ).not.toBe(null);
    });

    it("ED-2.1/2.2/2.3/2.4 — clicar filtra, clicar de novo tira; o chip diz Situação", async () => {
      await montar();
      await clicar(cartao("inativos"));
      expect(linhasDaTabela()).toEqual(["2"]);
      // O cartão leva à vista dele: o Histórico.
      expect(vista("historico")?.getAttribute("aria-checked")).toBe("true");
      expect(cartao("inativos")?.getAttribute("aria-pressed")).toBe("true");
      expect($("nucleoActiveAlertFilter")?.textContent).toContain("Situação");
      expect($("nucleoActiveAlertFilter")?.textContent).toContain(
        "Editais inativos",
      );

      // ED-2.2: o mesmo cartão de novo tira o filtro (a vista fica).
      await clicar(cartao("inativos"));
      expect(linhasDaTabela()).toEqual(["2"]);
      expect($("nucleoActiveAlertFilter")).toBeNull();

      // ED-2.3: o "x" do chip tira.
      await clicar(cartao("ativos"));
      expect(linhasDaTabela()).toEqual(["3", "1"]);
      expect(vista("ativos")?.getAttribute("aria-checked")).toBe("true");
      await clicar(
        $("nucleoActiveAlertFilter")?.querySelector<HTMLElement>(".ui-chip"),
      );
      expect(linhasDaTabela()).toEqual(["3", "1"]);
      expect($("nucleoActiveAlertFilter")).toBeNull();

      // ED-2.4: outro indicador troca o filtro.
      await clicar(cartao("ativos"));
      await clicar(cartao("sem_cronograma"));
      expect(linhasDaTabela()).toEqual(["3"]);
      expect(cartao("ativos")?.getAttribute("aria-pressed")).toBe("false");
      expect($("nucleoActiveAlertFilter")?.textContent).toContain("Alerta");
    });

    it("o indicador leva a lista à vista em que ela mostra o mesmo número (Todos)", async () => {
      await montar();
      // No Histórico, um indicador que conta ativos e inativos leva a Todos.
      await verHistorico();
      await clicar(cartao("sem_cronograma"));
      expect(vista("todas")?.getAttribute("aria-checked")).toBe("true");
      expect(vista("todas")?.textContent).toBe("Todos3");
      expect(linhasDaTabela()).toHaveLength(
        Number(
          cartao("sem_cronograma")?.querySelector(".ui-kpi-valor")?.textContent,
        ),
      );
      // O Total de editais (que não filtra) também: a lista mostra todos.
      await clicar(cartao("sem_cronograma"));
      await verHistorico();
      await clicar(cartao("todos"));
      expect(vista("todas")?.getAttribute("aria-checked")).toBe("true");
      expect(linhasDaTabela()).toHaveLength(
        Number(cartao("todos")?.querySelector(".ui-kpi-valor")?.textContent),
      );
      // "Editais ativos" e "Editais inativos" seguem nas suas abas.
      await clicar(cartao("inativos"));
      expect(vista("historico")?.getAttribute("aria-checked")).toBe("true");
    });

    it("Ativos e Histórico: a tabela abre nos vigentes, o histórico a um clique, com a contagem por situação", async () => {
      await montar();
      const controle = definido(
        document.querySelector<HTMLElement>(
          '[data-tour="editais-ativos-e-historico"]',
        ),
      );
      const situacoes = () =>
        [...controle.querySelectorAll(".ui-ativos-situacoes li")].map(
          (li) => li.textContent,
        );
      expect(vista("ativos")?.textContent).toBe("Ativos2");
      expect(vista("historico")?.textContent).toBe("Histórico1");
      expect(vista("ativos")?.getAttribute("aria-checked")).toBe("true");
      expect(linhasDaTabela()).toEqual(["3", "1"]);
      expect(situacoes()).toEqual(["Em andamento 1", "Planejado 1"]);

      await verHistorico();
      expect(linhasDaTabela()).toEqual(["2"]);
      expect(situacoes()).toEqual(["Concluído 1"]);

      // Com o filtro "Editais ativos", ir ao Histórico tira o filtro contrário.
      await verAtivos();
      await clicar(cartao("ativos"));
      expect($("nucleoActiveAlertFilter")).not.toBeNull();
      await verHistorico();
      expect($("nucleoActiveAlertFilter")).toBeNull();
      expect(linhasDaTabela()).toEqual(["2"]);
    });

    it("reabrir a página com cache não chama a RPC nem recria os cartões", async () => {
      const { supabase } = await montar();
      const card = definido(cartao("incompleto"));
      const selo = linha("1")?.querySelector<HTMLElement>(".nucleo-row-alert");
      await esperar(() => definido(controlador).render());
      expect(cartao("incompleto")).toBe(card);
      expect(linha("1")?.querySelector<HTMLElement>(".nucleo-row-alert")).toBe(
        selo,
      );
      const pedidos = supabase.rpc.mock.calls.filter(
        ([nome]) => nome === "get_nucleo_cronograma_resumo",
      );
      expect(pedidos).toHaveLength(1);
    });

    it("aberturas simultâneas partilham uma carga", async () => {
      const supabase = supabaseFalso();
      await montar({ supabase, abrir: false });
      await esperar(() =>
        Promise.all([
          definido(controlador).render(),
          definido(controlador).render(),
        ]),
      );
      expect(pedidosDoResumo(supabase)).toHaveLength(1);
    });

    it("salvar um cronograma invalida o cache", async () => {
      const { supabase } = await montar();
      await act(async () =>
        document.dispatchEvent(
          new CustomEvent("agsus:nucleo-cronograma-saved"),
        ),
      );
      await esperar(() => definido(controlador).render());
      expect(pedidosDoResumo(supabase)).toHaveLength(2);
    });

    it("carregando não é zero (skeleton); vazio é curto", async () => {
      let entregar: ((resposta: RespostaDaRpc) => void) | undefined;
      const supabase = supabaseFalso();
      supabase.rpc.mockImplementationOnce(
        () => new Promise<RespostaDaRpc>((resolver) => (entregar = resolver)),
      );
      await montar({ supabase, abrir: false });
      const esqueleto = () =>
        indicadores()?.querySelectorAll<HTMLElement>(
          '.ui-kpi[aria-busy="true"]',
        );
      expect(esqueleto()).toHaveLength(8);
      expect(
        indicadores()?.querySelector<HTMLElement>("b.ui-kpi-valor"),
      ).toBeNull();
      expect(cartao("todos")).toBeNull();
      const pendente = definido(controlador).render();
      await esperar();
      expect(esqueleto()).toHaveLength(8);
      await esperar(async () => {
        definido(entregar)({ data: [], error: null });
        await pendente;
      });
      expect(indicadores()?.textContent).toContain("Nenhum edital nesta área.");
    });

    it("erro oferece Tentar de novo, sem mostrar a mensagem do banco", async () => {
      const supabase = supabaseFalso();
      supabase.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: "relation does not exist" },
      });
      await montar({ supabase });
      const grade = definido(indicadores());
      expect(
        grade.querySelector<HTMLElement>('[role="alert"]')?.textContent,
      ).toContain("Não foi possível carregar os alertas dos editais");
      expect(grade.textContent).not.toContain("relation does not exist");
      expect($("nucleoSummaryRetry")?.textContent).toContain(
        "Tentar novamente",
      );
      await clicar($("nucleoSummaryRetry"));
      expect(cartao("todos")).not.toBeNull();
    });

    it("trocar de usuário apaga o que era da sessão anterior, mesmo a resposta a caminho", async () => {
      let entregar: ((resposta: RespostaDaRpc) => void) | undefined;
      const supabase = supabaseFalso();
      await montar({ supabase, abrir: false });
      supabase.trocarSessao("SIGNED_IN", { user: { id: "ana" } });
      supabase.rpc.mockImplementationOnce(
        () => new Promise<RespostaDaRpc>((resolver) => (entregar = resolver)),
      );
      const pendente = definido(controlador).render();
      await esperar();
      await act(async () => supabase.trocarSessao("SIGNED_OUT", null));
      await esperar(async () => {
        definido(entregar)({ data: RESUMO, error: null });
        await pendente;
      });
      expect(
        document.querySelector<HTMLElement>(".nucleo-row-alert"),
      ).toBeNull();
      expect(cartao("todos")).toBeNull();
      expect(atualizar()?.disabled).toBe(false);
    });

    it("o primeiro SIGNED_IN só registra quem é, sem nova carga", async () => {
      const { supabase } = await montar();
      await act(async () =>
        supabase.trocarSessao("SIGNED_IN", { user: { id: "ana" } }),
      );
      expect(cartao("todos")).not.toBeNull();
      expect(pedidosDoResumo(supabase)).toHaveLength(1);
    });
  });

  describe("formulário do edital", () => {
    it("abre com o edital gravado, a unidade do catálogo e o cronograma", async () => {
      await montar();
      await abrirEdital("1");
      expect($("editModalTitle")?.textContent).toBe("Editar edital");
      expect(campo("mProcesso")?.value).toBe("00700.000001/2026-00");
      expect(seletor("mResponsavel")?.value).toBe("USI");
      expect(seletor("mUnidade")?.value).toBe("U1");
      expect(campo("mUf")?.value).toBe("AM");
      expect($("mAutoInscritos")?.textContent).toBe("1.308");
      expect(document.activeElement).toBe($("mProcesso"));
      expect(
        document.querySelectorAll<HTMLElement>(
          "#cronogramaRows tr[data-cronograma-index]",
        ),
      ).toHaveLength(2);
      expect($("cronogramaHistoryCount")?.textContent).toBe("1 registro");
      expect($("cronogramaHistory")?.textContent).toContain("Cadastro inicial");
    });

    it("Novo abre vazio, com o cálculo automático ligado", async () => {
      await montar();
      await clicar($("newEditalBtn"));
      expect($("editModalTitle")?.textContent).toBe("Novo edital");
      expect(campo("mEdital")?.value).toBe("");
      expect(campo("mCronogramaAutomatico")?.checked).toBe(true);
      expect($("cronogramaRows")?.textContent).toContain(
        "Nenhuma etapa cadastrada",
      );
    });

    it("o responsável troca o catálogo de unidades e limpa a escolhida", async () => {
      await montar();
      await abrirEdital("1");
      await escolher($("mResponsavel"), "CORES");
      const opcoes = () =>
        [...definido(seletor("mUnidade")).options]
          .map((opcao) => opcao.value)
          .filter((valor) => valor && valor !== "__nova__");
      // Edital da Saúde Indígena: as unidades do CORES são da SEDE ou de Projetos.
      expect(opcoes()).toEqual([]);
      expect(seletor("mUnidade")?.value).toBe("");
      expect(campo("mUf")?.value).toBe("");
      await escolher($("mResponsavel"), "USI");
      expect(opcoes()).toEqual(["U2", "U1"]);
    });

    it("sem área definida (a RPC falhou), o CORES mostra as sete unidades", async () => {
      const supabase = supabaseFalso();
      const original = definido(supabase.rpc.getMockImplementation());
      supabase.rpc.mockImplementation(async (nome, argumentos) =>
        nome === "listar_unidades_por_area"
          ? { data: null, error: { message: "ainda não existe" } }
          : original(nome, argumentos),
      );
      vi.spyOn(console, "warn").mockImplementation(() => {});
      await montar({ supabase });
      await abrirEdital("1");
      await escolher($("mResponsavel"), "CORES");
      expect(
        [...definido(seletor("mUnidade")).options]
          .map((opcao) => opcao.value)
          .filter((valor) => valor && valor !== "__nova__"),
      ).toEqual(UNIDADES_CORES);
    });

    it("com o automático, status e etapa são os das datas; sem ele, voltam a ser editáveis", async () => {
      await montar();
      await abrirEdital("1");
      expect(campo("mStatus")?.readOnly).toBe(true);
      expect(campo("mStatus")?.value).toBe("Em andamento");
      expect(campo("mEtapa")?.value).toBe("Análise curricular");
      expect($("cronogramaPercentualPreview")?.textContent).toBe("50%");

      await clicar($("mCronogramaAutomatico"));
      expect(campo("mStatus")?.readOnly).toBe(false);
      expect(campo("mStatus")?.value).toBe("Em andamento");
      expect($("cronogramaStatusPreview")?.textContent).toBe(
        "Cronograma pendente",
      );
    });

    it("valida enquanto se edita: o motivo é obrigatório", async () => {
      await montar();
      await abrirEdital("1");
      const caixa = definido($("cronogramaValidation"));
      // O motivo só é cobrado depois de mexer no cronograma, não ao abrir o modal.
      expect(caixa.textContent).not.toContain("Informe o motivo");
      await clicar($("cronogramaExample"));
      expect(caixa.hidden).toBe(false);
      expect(caixa.textContent).toContain(
        "Informe o motivo da alteração do cronograma.",
      );
      await digitar($("mCronogramaMotivo"), "Ajuste de datas");
      expect(caixa.textContent).not.toContain("Informe o motivo");
    });

    it("edital novo não pede justificativa, nem ao mexer no cronograma nem ao salvar", async () => {
      const { supabase, toast } = await montar();
      await clicar($("newEditalBtn"));
      expect($("editModalTitle")?.textContent).not.toBe("Editar edital");
      await digitar($("mEdital"), "20/2026");
      await escolher($("mUnidade"), "U1");
      // Mexer no cronograma (desligar o automático) é o que cobrava o motivo.
      await clicar($("mCronogramaAutomatico"));
      expect($("cronogramaValidation")?.textContent).not.toContain(
        "Informe o motivo",
      );
      supabase.rpc.mockClear();
      await clicar($("saveEditalBtn"));
      const chamada = supabase.rpc.mock.calls.find(
        ([nome]) => nome === "salvar_monitoramento_com_cronograma_v2",
      );
      expect(chamada, JSON.stringify(toast.mock.calls.slice(-1))).toBeTruthy();
      // Sem motivo: o banco registra "Cadastro do edital" no histórico.
      expect(chamada?.[1]?.p_motivo).toBe("");
      expect(chamada?.[1]?.p_payload?.id ?? "").toBe("");
    });

    it("status excepcional pede motivo e data da decisão", async () => {
      await montar();
      await abrirEdital("1");
      const detalhe = () =>
        $("mStatusOverrideMotivo")?.closest<HTMLElement>(
          ".cronograma-override-detail",
        );
      expect(detalhe()?.hidden).toBe(true);
      await escolher($("mStatusOverride"), "Suspenso");
      expect(detalhe()?.hidden).toBe(false);
      expect(campo("mStatus")?.value).toBe("Suspenso");
      expect($("cronogramaValidation")?.textContent).toContain(
        "Status excepcional exige motivo",
      );
    });

    it("o modelo padrão cria as doze etapas e abre o preenchimento em lote", async () => {
      const { confirmar } = await montar();
      await abrirEdital("1");
      await clicar($("cronogramaExample"));
      expect(confirmar).toHaveBeenCalledWith(
        "Substituir o cronograma atual pelo modelo padrão?",
      );
      expect(
        document.querySelectorAll<HTMLElement>(
          "#cronogramaRows tr[data-cronograma-index]",
        ),
      ).toHaveLength(12);
      expect($("cronogramaBulkDates")?.hidden).toBe(false);
      expect(document.activeElement).toBe($("cronogramaBulkInput"));

      await digitar($("cronogramaBulkInput"), "17/06/2026\n18 a 20/06/2026");
      await clicar($("cronogramaBulkApply"));
      const datas = (i: number) => [
        document.querySelectorAll<HTMLInputElement>(
          '[data-field="data_inicio"]',
        )[i]?.value,
        document.querySelectorAll<HTMLInputElement>('[data-field="data_fim"]')[
          i
        ]?.value,
      ];
      expect(datas(0)).toEqual(["2026-06-17", "2026-06-17"]);
      expect(datas(1)).toEqual(["2026-06-18", "2026-06-20"]);
      expect($("cronogramaBulkFeedback")?.textContent).toContain(
        "Ainda faltam 10 etapas",
      );

      await digitar($("cronogramaBulkInput"), "amanhã");
      await clicar($("cronogramaBulkApply"));
      expect($("cronogramaBulkFeedback")?.className).toContain("is-error");
    });

    it("copia o cronograma de outro edital e sugere o motivo", async () => {
      await montar();
      await abrirEdital("1");
      const opcoes = [...definido(seletor("cronogramaCopySource")).options].map(
        (opcao) => opcao.value,
      );
      // Nem o próprio edital, nem quem não tem etapas.
      expect(opcoes).toEqual(["", "2"]);
      expect(botaoPorId("cronogramaCopyApply")?.disabled).toBe(true);

      await escolher($("cronogramaCopySource"), "2");
      await clicar($("cronogramaCopyApply"));
      const atividades = [
        ...document.querySelectorAll<HTMLInputElement>(
          '[data-field="atividade"]',
        ),
      ].map((campo) => campo.value);
      expect(atividades).toEqual([
        "Publicação do Edital",
        "Entrevistas",
        "Resultado final do Processo Seletivo",
      ]);
      expect(areaDeTexto("mCronogramaMotivo")?.value).toBe(
        "Cronograma copiado do edital 11/2026 — CASAI São Paulo",
      );
      expect($("cronogramaCopyFeedback")?.textContent).toContain(
        "3 etapas copiadas",
      );
    });

    it("salva edital e cronograma numa RPC só, fecha e recarrega pelo legado", async () => {
      const salvo = vi.fn();
      document.addEventListener("agsus:nucleo-cronograma-saved", salvo);
      const { supabase, toast, aoSalvar } = await montar();
      await abrirEdital("1");
      await digitar($("mCronogramaMotivo"), "Ajuste de datas");
      supabase.rpc.mockClear();
      await clicar($("saveEditalBtn"));
      document.removeEventListener("agsus:nucleo-cronograma-saved", salvo);

      const [nome, argumentos] = definido(supabase.rpc.mock.calls[0]);
      expect(nome).toBe("salvar_monitoramento_com_cronograma_v2");
      expect(argumentos?.p_payload).toMatchObject({
        id: "1",
        edital: "10/2026",
        unidade: "DSEI Manaus",
        id_unidade: "U1",
        uf: "AM",
        status: "Em andamento",
        etapa: "Análise curricular",
        cronograma_automatico: true,
        cronograma_origem: "MANUAL",
        vagas_total: 10,
      });
      expect(argumentos?.p_cronograma?.map((etapa) => etapa.ordem)).toEqual([
        1, 2,
      ]);
      expect(argumentos?.p_motivo).toBe("Ajuste de datas");
      expect(argumentos?.p_numero_errata).toBeNull();
      expect($("editModal")).toBeNull();
      expect(aoSalvar).toHaveBeenCalledTimes(1);
      expect(salvo).toHaveBeenCalledTimes(1);
      expect(toast).toHaveBeenLastCalledWith(
        "10/2026 salvo. 2 etapa(s) registradas e histórico atualizado.",
      );
    });

    it("edital cadastrado: o quadro de vagas do PDF é salvo na hora, sem o Salvar do edital", async () => {
      const supabase = supabaseFalso();
      const original = definido(supabase.rpc.getMockImplementation());
      supabase.rpc.mockImplementation(async (nome, argumentos) =>
        nome === "salvar_quadro_de_vagas"
          ? {
              data: { linhas: definido(definido(argumentos).p_dados).linhas },
              error: null,
            }
          : original(nome, argumentos),
      );
      const resposta = {
        edital: "10/2026",
        cronograma: [],
        vagas: [
          {
            cargo: "Enfermeiro",
            lotacao: "Polo Base Leonardo",
            modalidades: { "Ampla Concorrência": 1 },
            vagas_imediatas: 1,
            cadastro_reserva: true,
          },
          {
            cargo: "Enfermeiro",
            lotacao: "Polo Base Pavuru",
            modalidades: { "Ampla Concorrência": null },
            vagas_imediatas: 0,
            cadastro_reserva: true,
          },
        ],
        modalidades: ["Ampla Concorrência"],
      };
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({
          ok: true,
          status: 200,
          json: async () => resposta,
        })),
      );
      try {
        await montar({ supabase });
        await abrirEdital("1");
        const entrada = definido($("anexosArquivo"));
        Object.defineProperty(entrada, "files", {
          value: [
            new File(["%PDF-1.4"], "anexos.pdf", { type: "application/pdf" }),
          ],
        });
        await act(async () => {
          entrada.dispatchEvent(new Event("change", { bubbles: true }));
        });
        await esperar();
        await clicar($("anexosSalvarQuadro"));
        await esperar();
        const [, argumentos] = definido(
          supabase.rpc.mock.calls.find(
            ([nome]) => nome === "salvar_quadro_de_vagas",
          ),
        );
        expect(argumentos?.p_edital).toBe("1");
        expect(argumentos?.p_dados?.linhas).toHaveLength(2);
        expect($("anexosDoEdital")?.textContent).toContain(
          "Quadro de vagas salvo: 2 linhas.",
        );
        expect($("anexosSalvarQuadro")?.textContent).toBe("Quadro salvo");
        expect($("editModal")).not.toBeNull();
      } finally {
        vi.unstubAllGlobals();
      }
    });

    it("erro de validação não chega ao banco", async () => {
      const { supabase, toast } = await montar();
      await clicar($("newEditalBtn"));
      supabase.rpc.mockClear();
      await clicar($("saveEditalBtn"));
      expect(supabase.rpc).not.toHaveBeenCalled();
      expect(toast).toHaveBeenLastCalledWith(
        "Informe pelo menos edital e unidade.",
        "warn",
      );
      expect($("editModal")).not.toBeNull();
    });

    it("aviso pede confirmação; sem ela, não salva", async () => {
      const confirmar = vi.fn(() => false);
      const { supabase } = await montar({ confirmar });
      await abrirEdital("1");
      await digitar($("mCronogramaMotivo"), "Ajuste");
      supabase.rpc.mockClear();
      await clicar($("saveEditalBtn"));
      expect(confirmar).toHaveBeenCalledWith(
        expect.stringContaining("ponto(s) para revisão"),
      );
      expect(supabase.rpc).not.toHaveBeenCalled();
    });

    it("falha ao ler o cronograma aparece no formulário", async () => {
      const supabase = supabaseFalso();
      supabase.rpc.mockImplementation(async (nome) =>
        nome === "get_monitoramento_cronograma"
          ? { data: null, error: { message: "sem permissão" } }
          : { data: RESUMO, error: null },
      );
      await montar({ supabase });
      await abrirEdital("1");
      expect($("cronogramaValidation")?.textContent).toContain(
        "Não foi possível carregar o cronograma: sem permissão",
      );
    });

    it("Esc fecha e devolve o foco ao botão que abriu (o ⋯ da linha)", async () => {
      await montar();
      const botao = definido(
        linha("1")?.querySelector<HTMLElement>('[aria-label^="Mais ações de"]'),
      );
      botao.focus();
      await clicar(await acaoDaLinha("1", "editar"));
      await teclar(document, "Escape");
      expect($("editModal")).toBeNull();
      expect(document.activeElement).toBe(botao);
    });
  });

  describe("não perder o edital", () => {
    const rascunhosGuardados = () =>
      Object.keys(window.localStorage).filter((chave) =>
        chave.startsWith("agsus_monitora_rascunho_edital_v1:"),
      );
    const pergunta = () =>
      document.querySelector<HTMLElement>("#editModal .ui-modal-descarte");
    const botaoDaPergunta = (texto: string) =>
      [
        ...document.querySelectorAll<HTMLElement>(
          "#editModal .ui-modal-descarte button",
        ),
      ].find((botao) => botao.textContent?.trim() === texto);
    const botaoDoRodape = (texto: string) =>
      [
        ...document.querySelectorAll<HTMLElement>(
          "#editModal .modal-body button",
        ),
      ].find((botao) => botao.textContent?.trim() === texto);

    it("clicar no fundo escuro não fecha o formulário", async () => {
      await montar();
      await clicar($("newEditalBtn"));
      await digitar($("mEdital"), "20/2026");
      await clicar($("editModal"));
      expect($("editModal")).not.toBeNull();
      expect(campo("mEdital")?.value).toBe("20/2026");
      expect(pergunta()).toBeNull();
    });

    it("sem mudança, Cancelar fecha direto, sem perguntar", async () => {
      await montar();
      await abrirEdital("1");
      await clicar(botaoDoRodape("Cancelar"));
      expect($("editModal")).toBeNull();
      expect(rascunhosGuardados()).toEqual([]);
    });

    it("com mudança, Esc pergunta; Esc de novo volta à edição; Descartar fecha e apaga o rascunho", async () => {
      await montar();
      await abrirEdital("1");
      await digitar($("mObs"), "Anotação que não pode sumir");
      expect(rascunhosGuardados()).toHaveLength(1);

      await teclar(document, "Escape");
      expect($("editModal")).not.toBeNull();
      const faixa = definido(pergunta());
      expect(faixa.getAttribute("role")).toBe("alertdialog");
      expect(faixa.textContent).toContain("Descartar as alterações?");
      expect(document.activeElement).toBe(
        botaoDaPergunta("Continuar editando"),
      );

      await teclar(document, "Escape");
      expect(pergunta()).toBeNull();
      expect(areaDeTexto("mObs")?.value).toBe("Anotação que não pode sumir");

      await clicar(botaoDoRodape("Cancelar"));
      await clicar(botaoDaPergunta("Continuar editando"));
      expect($("editModal")).not.toBeNull();

      await clicar(
        [
          ...document.querySelectorAll<HTMLElement>(
            "#editModal .modal-head button",
          ),
        ].find((botao) => botao.textContent?.trim() === "Fechar"),
      );
      await clicar(botaoDaPergunta("Descartar alterações"));
      expect($("editModal")).toBeNull();
      expect(rascunhosGuardados()).toEqual([]);
    });

    it("reabrir Novo oferece o rascunho: Retomar devolve o que foi digitado", async () => {
      await montar();
      await clicar($("newEditalBtn"));
      await digitar($("mEdital"), "20/2026");
      await escolher($("mUnidade"), "U1");
      // A aba fechou ou a página recarregou: o modal some sem perguntar.
      await act(async () => definido(controlador).estado.fecharModal());

      await clicar($("newEditalBtn"));
      expect(campo("mEdital")?.value).toBe("");
      expect($("editalRascunho")?.textContent).toContain(
        "Há um rascunho de 10:00.",
      );
      await clicar($("editalRascunhoRetomar"));
      expect($("editalRascunho")).toBeNull();
      expect(campo("mEdital")?.value).toBe("20/2026");
      expect(seletor("mUnidade")?.value).toBe("U1");
      expect(campo("mUf")?.value).toBe("AM");
    });

    it("Descartar o rascunho abre o formulário limpo e o apaga", async () => {
      await montar();
      await clicar($("newEditalBtn"));
      await digitar($("mEdital"), "20/2026");
      await act(async () => definido(controlador).estado.fecharModal());

      await clicar($("newEditalBtn"));
      await clicar($("editalRascunhoDescartar"));
      expect($("editalRascunho")).toBeNull();
      expect(campo("mEdital")?.value).toBe("");
      expect(rascunhosGuardados()).toEqual([]);
    });

    it("o rascunho de um edital não aparece em outro", async () => {
      await montar();
      await abrirEdital("1");
      await digitar($("mObs"), "Nota do edital 1");
      await act(async () => definido(controlador).estado.fecharModal());

      // Outro edital: o 3 (o 2, concluído, está no Histórico).
      await abrirEdital("3");
      expect($("editModal")).not.toBeNull();
      expect($("editalRascunho")).toBeNull();
      await act(async () => definido(controlador).estado.fecharModal());
      await abrirEdital("1");
      expect($("editalRascunho")).not.toBeNull();
    });

    it("salvar apaga o rascunho", async () => {
      await montar();
      await abrirEdital("1");
      await digitar($("mCronogramaMotivo"), "Ajuste de datas");
      expect(rascunhosGuardados()).toHaveLength(1);
      await clicar($("saveEditalBtn"));
      expect($("editModal")).toBeNull();
      expect(rascunhosGuardados()).toEqual([]);
    });
  });

  describe("edital sempre na área certa", () => {
    const valoresDaUnidade = () =>
      [...definido(seletor("mUnidade")).options]
        .map((opcao) => opcao.value)
        .filter(Boolean);
    const chamadaDe = (
      supabase: ReturnType<typeof supabaseFalso>,
      nome: string,
    ) =>
      definido(supabase.rpc.mock.calls.find(([chamada]) => chamada === nome));

    it("Novo mostra a área do menu; editar mostra a do edital", async () => {
      await montar();
      await act(async () => definirAreaAtual("sede"));
      await clicar($("newEditalBtn"));
      expect($("mArea")?.textContent).toBe("Área: SEDE");
      await act(async () => definido(controlador).estado.fecharModal());

      await act(async () => definirAreaAtual("saude-indigena"));
      await abrirEdital("1");
      expect($("mArea")?.textContent).toBe("Área: Saúde Indígena");
    });

    it("em Projetos, o CORES oferece CCE e Escritório Distrital e Regional", async () => {
      await montar();
      await act(async () => definirAreaAtual("projetos"));
      await clicar($("newEditalBtn"));
      await escolher($("mResponsavel"), "CORES");
      expect(valoresDaUnidade()).toEqual(
        expect.arrayContaining(["CCE", "Escritório Distrital e Regional"]),
      );
      expect(valoresDaUnidade()).not.toContain("SEDE");
    });

    it("em Projetos, CCE aparece mesmo sem edital e sem o responsável CORES", async () => {
      await montar();
      await act(async () => definirAreaAtual("projetos"));
      await clicar($("newEditalBtn"));
      expect(valoresDaUnidade()).toEqual(
        expect.arrayContaining(["CCE", "Escritório Distrital e Regional"]),
      );
      expect(valoresDaUnidade()).not.toContain("SEDE");
    });

    it("na SEDE, o CORES oferece só a unidade SEDE, e o payload leva a área", async () => {
      const { supabase } = await montar();
      await act(async () => definirAreaAtual("sede"));
      await clicar($("newEditalBtn"));
      await escolher($("mResponsavel"), "CORES");
      expect(valoresDaUnidade()).toEqual(["SEDE", "__nova__"]);
      await digitar($("mEdital"), "30/2026");
      await escolher($("mUnidade"), "SEDE");
      // Sem etapas, o cálculo automático não deixa salvar.
      await clicar($("mCronogramaAutomatico"));
      supabase.rpc.mockClear();
      await clicar($("saveEditalBtn"));
      const [, argumentos] = chamadaDe(
        supabase,
        "salvar_monitoramento_com_cronograma_v2",
      );
      expect(argumentos?.p_payload).toMatchObject({
        unidade: "SEDE",
        responsavel: "CORES",
        co_area: "sede",
      });
    });

    it("editar salva na área do próprio edital", async () => {
      const { supabase } = await montar();
      await act(async () => definirAreaAtual("sede"));
      await act(async () => definido(controlador).estado.abrirEdital("1"));
      expect($("mArea")?.textContent).toBe("Área: Saúde Indígena");
      await digitar($("mCronogramaMotivo"), "Ajuste");
      supabase.rpc.mockClear();
      await clicar($("saveEditalBtn"));
      const [, argumentos] = chamadaDe(
        supabase,
        "salvar_monitoramento_com_cronograma_v2",
      );
      expect(argumentos?.p_payload?.co_area).toBe("saude-indigena");
    });

    it("dá para digitar uma unidade nova, que vai no payload com a área", async () => {
      const { supabase } = await montar();
      await act(async () => definirAreaAtual("projetos"));
      await clicar($("newEditalBtn"));
      await digitar($("mEdital"), "31/2026");
      await escolher($("mUnidade"), "__nova__");
      expect($("mUnidadeNova")).not.toBeNull();
      expect(campo("mUf")?.readOnly).toBe(false);
      await digitar($("mUnidadeNova"), "Projeto Mais Médicos Especialistas");
      // Unidade da própria área: sem aviso.
      expect($("mUnidadeNovaAjuda")).toBeNull();
      await clicar($("mCronogramaAutomatico"));
      supabase.rpc.mockClear();
      await clicar($("saveEditalBtn"));
      const [, argumentos] = chamadaDe(
        supabase,
        "salvar_monitoramento_com_cronograma_v2",
      );
      expect(argumentos?.p_payload).toMatchObject({
        unidade: "Projeto Mais Médicos Especialistas",
        id_unidade: null,
        co_area: "projetos",
      });
    });

    it("unidade digitada que é de outra área avisa antes de salvar", async () => {
      await montar();
      await act(async () => definirAreaAtual("sede"));
      await clicar($("newEditalBtn"));
      await escolher($("mUnidade"), "__nova__");
      await digitar($("mUnidadeNova"), "rio doce");
      const ajuda = definido($("mUnidadeNovaAjuda"));
      expect(ajuda.className).toContain("is-erro");
      expect(ajuda.textContent).toContain("Esta unidade é da área Projetos");
    });

    it("só administrador vê Mover para outra área", async () => {
      await montar();
      await abrirEdital("1");
      expect($("editalMoverAbrir")).toBeNull();
      await act(async () => definido(controlador).estado.fecharModal());

      perfilAtual = { perfil: "admin" };
      await clicar($("newEditalBtn"));
      // Edital novo não tem de onde sair.
      expect($("editalMoverAbrir")).toBeNull();
    });

    it("administrador move o edital com motivo e confirmação", async () => {
      const { supabase, confirmar, aoSalvar, toast } = await montar({
        perfil: { perfil: "admin" },
      });
      await abrirEdital("1");
      await clicar($("editalMoverAbrir"));
      const areas = [...definido(seletor("mMoverArea")).options]
        .map((opcao) => opcao.value)
        .filter(Boolean);
      expect(areas).toEqual(["sede", "projetos"]);
      expect(botaoPorId("editalMoverConfirmar")?.disabled).toBe(true);

      await escolher($("mMoverArea"), "sede");
      await digitar($("mMoverMotivo"), "Cadastrado na área errada");
      supabase.rpc.mockClear();
      await clicar($("editalMoverConfirmar"));
      expect(confirmar).toHaveBeenCalledWith(
        "Mover o edital 10/2026 de Saúde Indígena para SEDE?",
      );
      const [, argumentos] = chamadaDe(supabase, "mover_edital_de_area");
      expect(argumentos).toEqual({
        p_id: "1",
        p_area: "sede",
        p_motivo: "Cadastrado na área errada",
      });
      expect($("editModal")).toBeNull();
      expect(aoSalvar).toHaveBeenCalledTimes(1);
      expect(toast).toHaveBeenLastCalledWith("10/2026 movido para SEDE.");
    });

    it("com o formulário mexido, mover fica bloqueado", async () => {
      await montar({ perfil: { perfil: "admin" } });
      await abrirEdital("1");
      await digitar($("mObs"), "mudança não salva");
      await clicar($("editalMoverAbrir"));
      await escolher($("mMoverArea"), "projetos");
      await digitar($("mMoverMotivo"), "motivo");
      expect($("editalMoverBloqueio")).not.toBeNull();
      expect(botaoPorId("editalMoverConfirmar")?.disabled).toBe(true);
    });
  });

  describe("linha do tempo", () => {
    it("mostra a situação de cada etapa e o histórico", async () => {
      await montar();
      await clicar(await acaoDaLinha("1", "cronograma"));
      expect($("nucleoTimelineTitle")?.textContent).toBe("10/2026");
      expect($("nucleoTimelineSubtitle")?.textContent).toBe("DSEI Manaus");
      const situacoes = [
        ...document.querySelectorAll<HTMLElement>(".nucleo-timeline-item"),
      ].map((item) =>
        [...item.classList].find((classe) => classe.startsWith("is-")),
      );
      expect(situacoes).toEqual(["is-done", "is-current"]);
      expect($("nucleoTimelineContent")?.textContent).toContain("50%");
      expect($("nucleoTimelineContent")?.textContent).toContain(
        "Cadastro inicial",
      );

      await clicar($("closeNucleoTimeline"));
      expect($("nucleoTimelineModal")).toBeNull();
    });
  });

  describe("padrão das telas (topo, tabela contínua, skeleton e erro)", () => {
    it("o topo traz a data do resumo, Atualizar e Novo edital", async () => {
      await montar();
      const topo = definido(
        document.querySelector<HTMLElement>("#page-nucleo .ui-topo"),
      );
      expect(
        topo.querySelector<HTMLElement>("[data-status-da-carga]")?.textContent,
      ).toMatch(/^Atualizado em /);
      expect(topo.querySelector<HTMLElement>("#nucleoOperationalRefresh")).toBe(
        atualizar(),
      );
      expect(
        topo.querySelector<HTMLElement>("#newEditalBtn")?.textContent,
      ).toContain("Novo edital");
      expect(
        document.querySelector<HTMLElement>(".nucleo-page-card #nucleoSearch"),
      ).not.toBe(null);
    });

    it("quem só lê não vê Novo edital", async () => {
      await montar({ perfil: { perfil: "usuario" } });
      expect($("newEditalBtn")).toBeNull();
    });

    it("a tabela mostra 50 por vez e o resto no Carregar mais", async () => {
      const muitas = Array.from({ length: 60 }, (_, indice) => ({
        id: `e${indice}`,
        unidade: `Unidade ${String(indice).padStart(2, "0")}`,
        edital: `${indice}/2026`,
        status: "Em andamento",
        etapa: "Inscrições",
        risco: "Baixo",
        vagas_total: 1,
        contratados: 0,
        vagas_ociosas: 1,
      }));
      await montar({ linhas: muitas });
      expect(linhasDaTabela()).toHaveLength(50);
      await clicar(
        document.querySelector<HTMLElement>(
          '.nucleo-page-card [data-acao="carregar-mais"]',
        ),
      );
      expect(linhasDaTabela()).toHaveLength(60);
    });

    it("linha do tempo: skeleton enquanto carrega e erro com Tentar novamente", async () => {
      const supabase = supabaseFalso();
      const original = definido(supabase.rpc.getMockImplementation());
      let modo = "pendente";
      let entregar: ((resposta: RespostaDaRpc) => void) | null = null;
      supabase.rpc.mockImplementation((nome, argumentos) => {
        if (nome !== "get_monitoramento_cronograma")
          return original(nome, argumentos);
        if (modo === "pendente")
          return new Promise<RespostaDaRpc>(
            (resolver) => (entregar = resolver),
          );
        if (modo === "erro")
          return Promise.resolve({ data: null, error: { message: "falhou" } });
        return original(nome, argumentos);
      });
      await montar({ supabase });

      await clicar(await acaoDaLinha("1", "cronograma"));
      const conteudo = () => $("nucleoTimelineContent");
      expect(
        conteudo()?.querySelector<HTMLElement>(
          '[aria-busy="true"] .ui-esqueleto-bloco',
        ),
      ).not.toBeNull();

      modo = "erro";
      await esperar(async () => {
        definido(entregar)({ data: null, error: { message: "falhou" } });
      });
      const alerta = definido(
        conteudo()?.querySelector<HTMLElement>('[role="alert"]'),
      );
      expect(alerta.textContent).toContain(
        "Não foi possível carregar o cronograma",
      );

      modo = "ok";
      await clicar(
        alerta.querySelector<HTMLElement>('[data-acao="tentar-novamente"]'),
      );
      await esperar();
      expect(
        conteudo()?.querySelector<HTMLElement>('[role="alert"]'),
      ).toBeNull();
      expect(conteudo()?.textContent).toContain("Cadastro inicial");
    });
  });

  describe("cronograma e rascunho sem efeitos colaterais", () => {
    it("digitar a data de início pelo teclado: o fim acompanha até a data completa", async () => {
      await montar();
      await clicar($("newEditalBtn"));
      await clicar($("cronogramaAddRow"));
      const inicio = () =>
        document.querySelector<HTMLInputElement>('[data-field="data_inicio"]');
      const fim = () =>
        document.querySelector<HTMLInputElement>('[data-field="data_fim"]');
      // O campo de data emite o ano parcial a cada tecla.
      await digitar(inicio(), "0002-06-17");
      await digitar(inicio(), "0020-06-17");
      await digitar(inicio(), "2026-06-17");
      expect(fim()?.value).toBe("2026-06-17");

      // Fim informado diferente do início: não acompanha mais.
      await digitar(fim(), "2026-06-20");
      await digitar(inicio(), "2026-06-18");
      expect(fim()?.value).toBe("2026-06-20");
    });

    it("sem relógio injetado, renderizar de novo não regrava o rascunho", async () => {
      await montar({ relogio: false });
      await clicar($("newEditalBtn"));
      await digitar($("mEdital"), "20/2026");
      const gravar = vi.spyOn(Storage.prototype, "setItem");
      const gravacoesDoRascunho = () =>
        gravar.mock.calls.filter(([chave]) =>
          chave.startsWith("agsus_monitora_rascunho_edital_v1:"),
        ).length;

      await act(async () => publicarLinhasDoMonitoramento(LINHAS()));
      await act(async () => publicarLinhasDoMonitoramento(LINHAS()));

      expect(gravacoesDoRascunho()).toBe(0);
    });
  });

  describe("retificação do cronograma por PDF", () => {
    /* O "Leia-se" lido pela função Python para o edital 10/2026 (id 1). */
    const RETIFICACAO = {
      tipo: "retificacao",
      numero: 1,
      rotulo: "1ª Retificação do Cronograma",
      edital: "10/2026",
      sei: "0001234",
      assinada_em: "2026-09-12",
      leia_se: [
        {
          atividade: "Inscrições",
          data_inicio: "2026-09-01",
          data_fim: "2026-09-10",
          negrito: false,
          avisos: [],
        },
        {
          atividade: "Análise curricular",
          data_inicio: "2026-09-14",
          data_fim: "2026-09-25",
          negrito: true,
          avisos: [],
        },
        {
          atividade: "Resultado final do Processo Seletivo",
          data_inicio: "2026-09-29",
          data_fim: "2026-10-02",
          texto_datas: "29/09 e 02/10",
          negrito: true,
          avisos: [
            '"29/09 e 02/10" são duas datas soltas; lido como o intervalo de 29/09/2026 a 02/10/2026. Confira.',
          ],
        },
      ],
      avisos: [],
    };

    async function lerPdf(resposta = RETIFICACAO) {
      const buscar = vi.fn(
        async (_endereco: RequestInfo | URL, _opcoes?: RequestInit) => ({
          ok: true,
          status: 200,
          json: async () => resposta,
        }),
      );
      vi.stubGlobal("fetch", buscar);
      await clicar($("cronogramaRetificacao"));
      const entrada = definido($("retificacaoArquivo"));
      Object.defineProperty(entrada, "files", {
        value: [
          new File(["%PDF-1.4"], "retificacao.pdf", {
            type: "application/pdf",
          }),
        ],
      });
      await act(async () => {
        entrada.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await esperar();
      return buscar;
    }

    const situacoes = () =>
      [
        ...document.querySelectorAll<HTMLElement>(
          "#retificacaoComparacao tbody tr",
        ),
      ].map((tr) => tr.dataset.situacao);

    afterEach(() => vi.unstubAllGlobals());

    it("só aparece em edital cadastrado", async () => {
      await montar();
      await clicar($("newEditalBtn"));
      expect($("cronogramaRetificacao")).toBeNull();
    });

    it("mostra a comparação etapa a etapa com os avisos, sem gravar nada", async () => {
      const { supabase } = await montar();
      await abrirEdital("1");
      supabase.rpc.mockClear();
      const buscar = await lerPdf();

      expect(buscar.mock.calls[0]?.[0]).toBe(
        "/api/anexos-do-edital?tipo=retificacao",
      );
      expect($("retificacaoDocumento")?.textContent).toContain(
        "1ª Retificação do Cronograma · Edital 10/2026 · SEI 0001234 · assinada em 12/09/2026",
      );
      expect(situacoes()).toEqual(["igual", "muda", "nova"]);
      expect($("retificacaoComparacao")?.textContent).toContain(
        "duas datas soltas",
      );
      expect($("retificacaoResumo")?.textContent).toBe(
        "1 com data nova · 1 nova(s) · 0 sai(em) · 1 igual(is)",
      );
      expect(campo("retificacaoErrata")?.value).toBe(
        "1ª Retificação do Cronograma",
      );
      expect(areaDeTexto("retificacaoMotivo")?.value).toContain("SEI 0001234");
      expect(botaoPorId("retificacaoAplicar")?.disabled).toBe(false);
      expect(
        supabase.rpc.mock.calls.filter(
          ([nome]) => nome === "salvar_monitoramento_com_cronograma_v2",
        ),
      ).toHaveLength(0);
    });

    it("PDF de outro edital bloqueia com aviso e não mostra o Aplicar", async () => {
      await montar();
      await abrirEdital("1");
      await lerPdf({ ...RETIFICACAO, edital: "105/2026" });
      expect($("retificacaoBloqueio")?.textContent).toBe(
        "O PDF é do edital 105/2026, e este é o 10/2026. Escolha a retificação deste edital.",
      );
      expect($("retificacaoComparacao")).toBeNull();
      expect($("retificacaoAplicar")).toBeNull();
    });

    it("formulário mexido impede aplicar até salvar ou descartar", async () => {
      await montar();
      await abrirEdital("1");
      await digitar($("mObs"), "Anotação");
      await lerPdf();
      expect($("retificacaoPendencias")?.textContent).toContain(
        "Salve ou descarte as alterações do formulário",
      );
      expect(botaoPorId("retificacaoAplicar")?.disabled).toBe(true);
    });

    it("ajusta e aplica: grava o cronograma novo com a errata e o SEI no motivo", async () => {
      const { supabase, aoSalvar, toast } = await montar();
      await abrirEdital("1");
      await lerPdf();
      // A etapa nova fica um dia a menos, corrigida à mão antes de aplicar.
      await digitar(
        document.querySelector<HTMLElement>(
          '[aria-label="Fim de Resultado final do Processo Seletivo"]',
        ),
        "2026-10-01",
      );
      supabase.rpc.mockClear();
      await clicar($("retificacaoAplicar"));
      await esperar();

      const [, argumentos] = definido(
        supabase.rpc.mock.calls.find(
          ([nome]) => nome === "salvar_monitoramento_com_cronograma_v2",
        ),
      );
      expect(argumentos?.p_numero_errata).toBe("1ª Retificação do Cronograma");
      expect(argumentos?.p_motivo).toBe(
        "Lançada pela 1ª Retificação do Cronograma (SEI 0001234, assinada em 12/09/2026): 1 etapa(s) com data nova, 1 incluída(s).",
      );
      expect(
        argumentos?.p_cronograma?.map((e) => [
          e.ordem,
          e.atividade,
          e.data_inicio,
          e.data_fim,
          e.origem,
        ]),
      ).toEqual([
        [1, "Inscrições", "2026-09-01", "2026-09-10", "MANUAL"],
        [2, "Análise curricular", "2026-09-14", "2026-09-25", "ERRATA"],
        [
          3,
          "Resultado final do Processo Seletivo",
          "2026-09-29",
          "2026-10-01",
          "ERRATA",
        ],
      ]);
      expect(argumentos?.p_payload).toMatchObject({
        id: "1",
        edital: "10/2026",
        data_inicio: "2026-09-01",
        data_fim: "2026-10-01",
      });
      expect($("editModal")).toBeNull();
      expect(aoSalvar).toHaveBeenCalledTimes(1);
      expect(toast).toHaveBeenLastCalledWith(
        "10/2026 salvo. 3 etapa(s) registradas e histórico atualizado.",
      );
    });
  });

  /*
  Cartão #57: validade do processo seletivo no formulário. A RPC de leitura
  (get_monitoramento_cronograma) só devolve os três campos depois da migration
  20261111200000; o fixture CRONOGRAMAS["1"] é o banco de antes.
*/
  describe("validade do processo seletivo", () => {
    const comValidade = (validade: object) =>
      supabaseFalso({
        cronogramas: {
          ...CRONOGRAMAS,
          1: {
            ...CRONOGRAMAS["1"],
            monitoramento: {
              ...(CRONOGRAMAS["1"] as { monitoramento: object }).monitoramento,
              ...validade,
            },
          },
        },
      });
    const payload = (supabase: ReturnType<typeof supabaseFalso>) =>
      supabase.rpc.mock.calls.find(
        ([nome]) => nome === "salvar_monitoramento_com_cronograma_v2",
      )?.[1]?.p_payload;

    it("lê a validade gravada, mostra o prazo e devolve as três chaves ao salvar", async () => {
      const supabase = comValidade({
        nu_anos_validade: 1,
        nu_meses_validade: 6,
        st_prorrogado: false,
      });
      await montar({ supabase });
      await abrirEdital("1");
      expect(campo("mValidadeAnos")?.value).toBe("1");
      expect(campo("mValidadeMeses")?.value).toBe("6");
      expect(seletor("mValidadeProrrogado")?.value).toBe("nao");
      expect($("mValidadeNaoLida")).toBeNull();
      // Encerramento pelas etapas: 20/09/2026 + 18 meses.
      expect($("mValidadePrazo")?.textContent).toBe("Válida até 20/03/2028.");

      await escolher($("mValidadeProrrogado"), "sim");
      expect($("mValidadePrazo")?.textContent).toBe("Válida até 20/09/2029.");
      await digitar($("mCronogramaMotivo"), "Prorrogação do edital");
      supabase.rpc.mockClear();
      await clicar($("saveEditalBtn"));
      expect(payload(supabase)).toMatchObject({
        nu_anos_validade: 1,
        nu_meses_validade: 6,
        st_prorrogado: true,
      });
    });

    it("valor fora do limite mostra a mensagem no campo e não salva", async () => {
      const supabase = comValidade({
        nu_anos_validade: 0,
        nu_meses_validade: 0,
        st_prorrogado: false,
      });
      await montar({ supabase });
      await abrirEdital("1");
      expect($("mValidadePrazo")?.textContent).toBe(
        "Sem prazo: a lista não vence.",
      );
      await digitar($("mValidadeMeses"), "12");
      expect(campo("mValidadeMeses")?.getAttribute("aria-invalid")).toBe(
        "true",
      );
      expect(document.body.textContent).toContain(
        "Use um número inteiro de 0 a 11 meses.",
      );
      await digitar($("mCronogramaMotivo"), "Ajuste");
      supabase.rpc.mockClear();
      await clicar($("saveEditalBtn"));
      expect(payload(supabase)).toBeUndefined();
      expect(document.activeElement?.id).toBe("mValidadeMeses");
    });

    it("banco sem a leitura: avisa, abre vazio e só manda o que foi preenchido", async () => {
      const { supabase } = await montar();
      await abrirEdital("1");
      expect($("mValidadeNaoLida")).not.toBeNull();
      expect(campo("mValidadeAnos")?.value).toBe("");
      expect(seletor("mValidadeProrrogado")?.value).toBe("");
      await digitar($("mCronogramaMotivo"), "Ajuste");
      supabase.rpc.mockClear();
      await clicar($("saveEditalBtn"));
      const semMexer = payload(supabase);
      expect(semMexer).toBeDefined();
      expect(semMexer).not.toHaveProperty("nu_anos_validade");
      expect(semMexer).not.toHaveProperty("nu_meses_validade");
      expect(semMexer).not.toHaveProperty("st_prorrogado");
    });

    it("banco sem a leitura: o campo preenchido vai sozinho", async () => {
      const { supabase } = await montar();
      await abrirEdital("1");
      await digitar($("mValidadeAnos"), "2");
      await digitar($("mCronogramaMotivo"), "Ajuste");
      supabase.rpc.mockClear();
      await clicar($("saveEditalBtn"));
      const enviado = payload(supabase);
      expect(enviado).toMatchObject({ nu_anos_validade: 2 });
      expect(enviado).not.toHaveProperty("nu_meses_validade");
      expect(enviado).not.toHaveProperty("st_prorrogado");
    });

    it("edital novo nasce com os padrões do banco (0, 0, não)", async () => {
      await montar();
      await clicar($("newEditalBtn"));
      expect(campo("mValidadeAnos")?.value).toBe("0");
      expect(campo("mValidadeMeses")?.value).toBe("0");
      expect(seletor("mValidadeProrrogado")?.value).toBe("nao");
    });
  });
});

bloco("cronograma-somente-mes-selecionado", () => {
  const HOJE = new Date(2026, 10, 6, 12);
  const etapas = montarEtapasDosEditais(
    [
      {
        id: "edital-do-teste",
        edital: "1/2026",
        unidade: "DSEI Manaus",
        cronograma_total: 4,
      },
    ],
    [
      [
        {
          atividade: "Resultado de outubro",
          data_inicio: "2026-10-31",
          data_fim: "2026-10-31",
          ordem: 1,
        },
        {
          atividade: "Resultado de novembro",
          data_inicio: "2026-11-06",
          data_fim: "2026-11-06",
          ordem: 2,
        },
        {
          atividade: "Inscrições entre novembro e dezembro",
          data_inicio: "2026-11-30",
          data_fim: "2026-12-02",
          ordem: 3,
        },
        {
          atividade: "Resultado de dezembro",
          data_inicio: "2026-12-04",
          data_fim: "2026-12-04",
          ordem: 4,
        },
      ],
    ],
  ).etapas;

  let raiz: Root | null = null;
  const escolher = vi.fn<(dia: string) => void>();

  beforeEach(() => {
    const alvo = document.createElement("div");
    document.body.append(alvo);
    raiz = createRoot(alvo);
    escolher.mockClear();
  });

  afterEach(async () => {
    await act(async () => raiz?.unmount());
    raiz = null;
    document.body.replaceChildren();
  });

  async function desenhar(mes: Date) {
    await act(async () => {
      definido(raiz).render(
        createElement(GradeDoMes, {
          celulas: montarGradeDoMes(mes, etapas, { hoje: HOJE }),
          selecionado: "",
          aoEscolherDia: escolher,
        }),
      );
    });
  }

  const dias = () => [
    ...document.querySelectorAll<HTMLButtonElement>(".cal-dias [data-dia]"),
  ];
  const dia = (chave: string) =>
    document.querySelector<HTMLButtonElement>(`[data-dia="${chave}"]`);

  describe("a vista Mês mostra apenas o mês selecionado", () => {
    it.each([
      { ano: 2026, mes: 1, prefixo: "2026-02", total: 28, coluna: "1" },
      { ano: 2028, mes: 1, prefixo: "2028-02", total: 29, coluna: "3" },
      { ano: 2026, mes: 4, prefixo: "2026-05", total: 31, coluna: "6" },
      { ano: 2026, mes: 8, prefixo: "2026-09", total: 30, coluna: "3" },
      { ano: 2026, mes: 10, prefixo: "2026-11", total: 30, coluna: "1" },
      { ano: 2026, mes: 11, prefixo: "2026-12", total: 31, coluna: "3" },
      { ano: 2027, mes: 0, prefixo: "2027-01", total: 31, coluna: "6" },
    ])(
      "$prefixo: todos os $total dias, sem vizinhos e com a coluna inicial correta",
      async ({ ano, mes, prefixo, total, coluna }) => {
        await desenhar(new Date(ano, mes, 1));
        const botoes = dias();
        expect(botoes.map((botao) => botao.dataset.dia)).toEqual(
          Array.from(
            { length: total },
            (_, indice) => `${prefixo}-${String(indice + 1).padStart(2, "0")}`,
          ),
        );
        expect(definido(botoes[0]).style.gridColumnStart).toBe(coluna);
        expect(
          botoes.slice(1).every((botao) => botao.style.gridColumnStart === ""),
        ).toBe(true);
        expect(document.querySelector(".fora-do-mes")).toBeNull();
        expect(document.querySelectorAll(".cal-dias button")).toHaveLength(
          total,
        );
      },
    );

    it("novembro não inclui as datas nem os eventos de outubro ou dezembro", async () => {
      await desenhar(new Date(2026, 10, 1));
      const grade = definido(document.querySelector(".cal-dias"));
      expect(grade.textContent).toContain("Resultado de novembro");
      expect(grade.textContent).not.toContain("Resultado de outubro");
      expect(grade.textContent).not.toContain("Resultado de dezembro");
      expect(dia("2026-10-31")).toBeNull();
      expect(dia("2026-12-01")).toBeNull();
      expect(dia("2026-12-12")).toBeNull();
      expect(definido(dia("2026-11-06")).classList.contains("hoje")).toBe(true);
      await act(async () => definido(dia("2026-11-06")).click());
      expect(escolher).toHaveBeenCalledExactlyOnceWith("2026-11-06");
    });

    it("preserva as etapas que atravessam meses e move os marcos ao navegar", async () => {
      await desenhar(new Date(2026, 10, 1));
      expect(
        dia("2026-11-30")?.querySelector(".cal-chip-ponta")?.textContent,
      ).toBe("início");
      expect(dia("2026-12-02")).toBeNull();

      await desenhar(new Date(2026, 11, 1));
      expect(dia("2026-11-30")).toBeNull();
      expect(dia("2026-12-01")?.getAttribute("aria-label")).toContain(
        "1 em andamento",
      );
      expect(
        dia("2026-12-02")?.querySelector(".cal-chip-ponta")?.textContent,
      ).toBe("fim");
      expect(dia("2026-12-04")?.textContent).toContain("Resultado de dezembro");

      await desenhar(new Date(2026, 10, 1));
      expect(dias()).toHaveLength(30);
      expect(dia("2026-12-02")).toBeNull();
      expect(dia("2026-11-30")?.textContent).toContain("início");
    });
  });
});

bloco("modulos/paineis-de-dados", () => {
  /*
  Relatórios (bloco Dados do menu; antes Painéis): o catálogo de cartões, a
  tela de um relatório, a permissão pelo recurso `paineis_dados`, a rota
  (com o caminho antigo), a paginação e os downloads.
*/

  globalThis.IS_REACT_ACT_ENVIRONMENT = true;

  let raiz: Root | undefined;
  let caixa: HTMLDivElement | undefined;
  afterEach(async () => {
    await act(async () => raiz?.unmount());
    caixa?.remove();
  });

  const perfil = (permissoes: NiveisPorRecurso) =>
    ({ id: "u1", ativo: true, permissoes }) satisfies PerfilDeAcesso;

  type Resposta = {
    data: unknown;
    error: { code: string; message?: string } | null;
  };

  /*
  Supabase falso: guarda as chamadas e responde por RPC. A leitura dos
  relatórios responde pelo relatório pedido (a chave é o id do relatório) e
  recorta a página como o banco: `total`, `pagina` e só as linhas dela.
*/
  function lerComoOBanco(
    resposta: Resposta | undefined,
    args: Record<string, unknown>,
  ): Resposta {
    if (!resposta) return { data: { linhas: [], total: 0 }, error: null };
    if (resposta.error || !resposta.data) return resposta;
    const dados = resposta.data as { linhas?: unknown[] };
    const todas = dados.linhas ?? [];
    const porPagina = args.p_por_pagina as number | null;
    if (!porPagina)
      return {
        data: { ...dados, total: todas.length, pagina: 1, por_pagina: null },
        error: null,
      };
    const paginas = Math.max(1, Math.ceil(todas.length / porPagina));
    const pagina = Math.min(paginas, Math.max(1, Number(args.p_pagina) || 1));
    return {
      data: {
        ...dados,
        total: todas.length,
        pagina,
        por_pagina: porPagina,
        linhas: todas.slice((pagina - 1) * porPagina, pagina * porPagina),
      },
      error: null,
    };
  }

  function supabaseFalso(respostas: Record<string, Resposta>) {
    const chamadas: { nome: string; args: unknown }[] = [];
    return {
      chamadas,
      rpc: vi.fn(
        async (
          nome: string,
          args: Record<string, unknown>,
        ): Promise<Resposta> => {
          chamadas.push({ nome, args });
          if (nome === LER)
            return lerComoOBanco(respostas[String(args.p_relatorio)], args);
          if (nome === "sincronizar_relatorio_do_painel")
            return (
              respostas[nome] ?? {
                data: {
                  calculado_em: "2026-11-13T15:00:00Z",
                  recalculado: true,
                },
                error: null,
              }
            );
          return respostas[nome] ?? { data: null, error: null };
        },
      ),
    };
  }

  const LER = "ler_relatorio_do_painel";
  /** Os relatórios pedidos ao banco, na ordem (`relatorio:pagina:porPagina`). */
  const leituras = (chamadas: { nome: string; args: unknown }[]) =>
    chamadas
      .filter((c) => c.nome === LER)
      .map((c) => {
        const a = c.args as Record<string, unknown>;
        return `${String(a.p_relatorio)}:${String(a.p_pagina)}:${String(a.p_por_pagina)}`;
      });

  const RESUMO: Resposta = {
    data: {
      calculado_em: "2026-11-13T15:00:00Z",
      linhas: [
        {
          edital: "39/2026",
          unidade: "DSEI Teste",
          vagas_imediatas: 12,
          data_divulgacao: "2026-03-05",
          data_final: "2026-06-30",
        },
      ],
    },
    error: null,
  };

  /* O mesmo objeto a cada leitura (useSyncExternalStore). */
  const SEM_CONFIGURACOES = {};

  /*
    `abrir`: o relatório já aberto na chegada (como o link
    `?relatorio=<id>`); `null` = a tela abre no catálogo.
  */
  async function montar(
    respostas: Record<string, Resposta> = {},
    relatorio: Partial<ApoioDoRelatorio> = {},
    { abrir = "resumo-dos-editais" }: { abrir?: IdDoRelatorio | null } = {},
  ) {
    const supabase = supabaseFalso(respostas);
    const salvos: { arquivo: Blob; nome: string }[] = [];
    const tela = criarPaineisDeDados({
      supabase,
      areaAtual: () => "saude-indigena",
      salvar: (arquivo, nome) => salvos.push({ arquivo, nome }),
      agora: () => new Date("2026-11-13T15:04:00Z"),
      relatorio: {
        linhasDaArea: () => [],
        configuracoes: {
          assinar: () => () => {},
          obter: () => SEM_CONFIGURACOES,
        },
        obterPerfil: () => null,
        agora: () => new Date("2026-11-13T15:04:00Z"),
        supabase: null,
        // A Lista de aprovados não baixa nestes testes: fica carregando.
        aprovados: () => new Promise(() => {}),
        // As linhas do monitoramento vêm de publicarLinhasDoMonitoramento.
        pedirLinhas: () => () => {},
        esperarLinhas: async () => {},
        ...relatorio,
      },
    });
    caixa = document.createElement("div");
    document.body.append(caixa);
    raiz = createRoot(caixa);
    await act(async () => raiz?.render(tela.conteudo));
    if (abrir) await esperar(() => tela.estado.abrir(abrir));
    await esperar(() => tela.render());
    return { tela, supabase, salvos, caixa };
  }

  const botao = (rotulo: string) =>
    [...(caixa?.querySelectorAll("button") ?? [])].find(
      (b) => b.textContent?.trim() === rotulo,
    );
  const cartao = (id: string) =>
    caixa?.querySelector<HTMLElement>(
      `[data-relatorio='${id}'].relatorios-cartao`,
    );
  const botaoEmCartao = (id: string, rotulo: string) =>
    [...(cartao(id)?.querySelectorAll("button") ?? [])].find(
      (b) => b.textContent?.trim() === rotulo,
    );

  describe("catálogo", () => {
    it("abre nos cartões, em grupos, com a data do cálculo de cada relatório", async () => {
      const { supabase } = await montar(
        {
          "resumo-dos-editais": RESUMO,
          aprovados: { data: { calculado_em: null, linhas: [] }, error: null },
        },
        {},
        { abrir: null },
      );
      // A primeira página de cada um, a mesma que a tabela usa depois.
      expect(leituras(supabase.chamadas)).toEqual([
        "resumo-dos-editais:1:50",
        "editais-por-cargo:1:50",
        "aprovados:1:50",
      ]);
      const grupos = [
        ...(caixa?.querySelectorAll(".relatorios-grupo") ?? []),
      ].map((g) => [
        g.querySelector("h2")?.textContent,
        [...g.querySelectorAll("h3")].map((h) => h.textContent),
      ]);
      /*
        Grupo sem relatório (Produtividade, por enquanto) não aparece; sem o
        recurso `aprovados`, o Resumo por cargo e status também não.
      */
      expect(grupos).toEqual([
        [
          "Editais",
          ["Resumo dos editais", "Editais por cargo", "Montar relatório"],
        ],
        ["Aprovados", ["Aprovados", "Relatório da diretoria"]],
      ]);
      // As duas versões da admissão dizem a regra de cada uma.
      expect(
        cartao("aprovados")?.querySelector("[data-regra]")?.textContent,
      ).toMatch(/virou Contratado no sistema/);
      expect(
        cartao("relatorio-da-diretoria")?.querySelector("[data-regra]")
          ?.textContent,
      ).toMatch(/conciliada com o RH/);
      expect(
        cartao("resumo-dos-editais")?.querySelector("[data-calculo]")
          ?.textContent,
      ).toMatch(/^Calculado em 13\/11\/2026,? 12:00 · 1 linha$/);
      expect(
        cartao("aprovados")?.querySelector("[data-calculo]")?.textContent,
      ).toBe("0 linhas");
      expect(caixa?.querySelector("table")).toBeNull();
      // A data fica nos cartões; o topo não repete.
      expect(caixa?.querySelector("[data-status-da-carga]")?.textContent).toBe(
        "",
      );
    });

    it("abrir um cartão mostra a tabela sem ler de novo, e Todos os relatórios volta", async () => {
      const { supabase } = await montar(
        { "resumo-dos-editais": RESUMO },
        {},
        { abrir: null },
      );
      await clicar(botaoEmCartao("resumo-dos-editais", "Abrir"));
      await esperar();
      expect(caixa?.querySelector(".relatorios-voltar h2")?.textContent).toBe(
        "Resumo dos editais",
      );
      expect(caixa?.querySelectorAll("tbody tr")).toHaveLength(1);
      expect(leituras(supabase.chamadas)).toHaveLength(3);
      await clicar(caixa?.querySelector("[data-acao='voltar-ao-catalogo']"));
      await esperar();
      expect(caixa?.querySelectorAll(".relatorios-cartao")).toHaveLength(5);
      expect(leituras(supabase.chamadas)).toHaveLength(3);
    });

    it("cada cartão exporta o seu relatório inteiro, em Excel e PDF", async () => {
      const { supabase, salvos } = await montar(
        { aprovados: { data: { linhas: [] }, error: null } },
        {},
        { abrir: null },
      );
      await clicar(botaoEmCartao("aprovados", "Exportar em Excel"));
      await esperar(() => new Promise((ok) => setTimeout(ok, 50)));
      await clicar(botaoEmCartao("aprovados", "Salvar em PDF"));
      await esperar(() => new Promise((ok) => setTimeout(ok, 200)));
      expect(leituras(supabase.chamadas).slice(-2)).toEqual([
        "aprovados:1:null",
        "aprovados:1:null",
      ]);
      expect(salvos.map((s) => s.nome)).toEqual([
        "aprovados-saude-indigena-2026-11-13-1204.xlsx",
        "aprovados-saude-indigena-2026-11-13-1204.pdf",
      ]);
    });

    it("Sincronizar no catálogo recalcula todos", async () => {
      const { supabase } = await montar({}, {}, { abrir: null });
      await clicar(botao("Sincronizar"));
      await esperar();
      expect(
        supabase.chamadas
          .filter((c) => c.nome === "sincronizar_relatorio_do_painel")
          .map((c) => (c.args as { p_relatorio: string }).p_relatorio),
      ).toEqual(["resumo-dos-editais", "editais-por-cargo", "aprovados"]);
    });

    it("a falha da leitura aparece uma vez, em cima dos cartões", async () => {
      const sem = { data: null, error: { code: "42501" } };
      await montar(
        { "resumo-dos-editais": sem, "editais-por-cargo": sem, aprovados: sem },
        {},
        { abrir: null },
      );
      expect(
        [...(caixa?.querySelectorAll("[role=alert]") ?? [])].map(
          (a) => a.textContent,
        ),
      ).toEqual([MENSAGEM_SEM_PERMISSAO]);
      expect(
        botaoEmCartao("aprovados", "Exportar em Excel")?.hasAttribute(
          "disabled",
        ),
      ).toBe(true);
    });

    it("abrir escreve ?relatorio= no endereço (entrada nova) e voltar tira", async () => {
      window.history.replaceState(null, "", "/sede/relatorios");
      try {
        await montar({}, {}, { abrir: null });
        const antes = window.history.length;
        await clicar(botaoEmCartao("aprovados", "Abrir"));
        await esperar();
        expect(window.location.pathname + window.location.search).toBe(
          "/sede/relatorios?relatorio=aprovados",
        );
        expect(window.history.length).toBe(antes + 1);
        await clicar(caixa?.querySelector("[data-acao='voltar-ao-catalogo']"));
        await esperar();
        expect(window.location.search).toBe("");
        // O voltar do navegador com ?relatorio= abre o relatório de novo.
        await act(async () => {
          window.history.pushState(
            null,
            "",
            "/sede/relatorios?relatorio=editais-por-cargo",
          );
          window.dispatchEvent(new PopStateEvent("popstate"));
        });
        await esperar();
        expect(caixa?.querySelector(".relatorios-voltar h2")?.textContent).toBe(
          "Editais por cargo",
        );
      } finally {
        window.history.replaceState(null, "", "/");
      }
    });

    it("o relatório aberto vai no endereço e o caminho antigo continua valendo", () => {
      expect(ehIdDoRelatorio("aprovados")).toBe(true);
      expect(ehIdDoRelatorio("painel-x")).toBe(false);
      // Os que abrem por cima do catálogo; a diretoria só gera o arquivo.
      expect(ehIdDoRelatorio("resumo-por-cargo")).toBe(false);
      expect(ehRelatorioDoEndereco("resumo-por-cargo")).toBe(true);
      expect(ehRelatorioDoEndereco("montar-relatorio")).toBe(true);
      expect(ehRelatorioDoEndereco("relatorio-da-diretoria")).toBe(false);
      expect(
        catalogoPermitido({ aprovados: false }).map((r) => r.id),
      ).not.toContain("resumo-por-cargo");
      expect(catalogoPermitido({ aprovados: true }).map((r) => r.id)).toContain(
        "resumo-por-cargo",
      );
      expect(
        buscaDoRelatorio("resumo-por-cargo", { editais: ["7", " 8", "7", ""] }),
      ).toBe("relatorio=resumo-por-cargo&edital=7%2C8");
      expect(
        buscaDoRelatorio("montar-relatorio", { origem: "visao-geral" }),
      ).toBe("relatorio=montar-relatorio&origem=visao-geral");
      expect(editaisDoEndereco(" 3, 4,,3 ")).toEqual(["3", "4"]);
      expect(gruposDoCatalogo().map((g) => g.id)).toEqual([
        "editais",
        "aprovados",
      ]);
      expect(
        destinoDoCaminho("/sede/paineis-de-dados", "?relatorio=aprovados"),
      ).toEqual({
        view: "paineis-de-dados",
        area: "sede",
        filtros: "relatorio=aprovados",
      });
      // O endereço escrito é sempre o novo.
      expect(
        caminhoDoDestino({
          view: "paineis-de-dados",
          area: "sede",
          filtros: "relatorio=aprovados",
        }),
      ).toBe("/sede/relatorios?relatorio=aprovados");
    });
  });

  describe("um relatório aberto", () => {
    it("aberto pelo link, lê só a página do relatório e desenha a tabela", async () => {
      const { supabase } = await montar({
        "resumo-dos-editais": RESUMO,
      });
      // Só a página visível é pedida ao banco.
      expect(supabase.chamadas).toEqual([
        {
          nome: LER,
          args: {
            p_area: "saude-indigena",
            p_relatorio: "resumo-dos-editais",
            p_pagina: 1,
            p_por_pagina: 50,
          },
        },
      ]);
      expect(
        caixa?.querySelector("[data-acao='voltar-ao-catalogo']")?.textContent,
      ).toContain("Todos os relatórios");
      expect(caixa?.querySelector(".relatorios-cartao")).toBeNull();
      const celulas = [...(caixa?.querySelectorAll("tbody td") ?? [])].map(
        (td) => td.textContent,
      );
      expect(celulas).toEqual([
        "39/2026",
        "DSEI Teste",
        "12",
        "05/03/2026",
        "30/06/2026",
      ]);
    });

    it("cada relatório é lido uma vez; Sincronizar recalcula só o aberto", async () => {
      const { supabase } = await montar();
      await clicar(caixa?.querySelector("[data-acao='voltar-ao-catalogo']"));
      await esperar();
      await clicar(botaoEmCartao("aprovados", "Abrir"));
      await esperar();
      expect(leituras(supabase.chamadas)).toEqual([
        "resumo-dos-editais:1:50",
        "editais-por-cargo:1:50",
        "aprovados:1:50",
      ]);
      // Sincronizar recalcula só o relatório aberto e relê a página dele.
      await clicar(botao("Sincronizar"));
      await esperar();
      expect(supabase.chamadas.map((c) => c.nome).slice(-2)).toEqual([
        "sincronizar_relatorio_do_painel",
        LER,
      ]);
      expect(supabase.chamadas.at(-2)?.args).toEqual({
        p_area: "saude-indigena",
        p_relatorio: "aprovados",
      });
      await clicar(caixa?.querySelector("[data-acao='voltar-ao-catalogo']"));
      await esperar();
      expect(leituras(supabase.chamadas)).toHaveLength(4);
    });

    it("o topo tem Sincronizar e a data da última leitura, uma vez só", async () => {
      await montar({ "resumo-dos-editais": RESUMO });
      const topo = caixa?.querySelector(".ui-topo");
      expect(
        topo?.querySelector("[data-acao='atualizar']")?.textContent,
      ).toContain("Sincronizar");
      expect(
        topo?.querySelector("[data-status-da-carga]")?.textContent,
      ).toMatch(/^Sincronizado em 13\/11\/2026,? 12:00$/);
      expect(caixa?.textContent?.match(/Sincronizado em/g)).toHaveLength(1);
      expect(botao("Atualizar")).toBeUndefined();
    });

    it("baixa o Excel e o PDF do que está na tabela", async () => {
      const { salvos } = await montar({
        "resumo-dos-editais": RESUMO,
      });
      await clicar(botao("Exportar em Excel"));
      await esperar(() => new Promise((ok) => setTimeout(ok, 50)));
      await clicar(botao("Salvar em PDF"));
      await esperar(() => new Promise((ok) => setTimeout(ok, 200)));
      expect(salvos.map((s) => s.nome)).toEqual([
        "resumo-dos-editais-saude-indigena-2026-11-13-1204.xlsx",
        "resumo-dos-editais-saude-indigena-2026-11-13-1204.pdf",
      ]);
      expect(salvos[0]!.arquivo.size).toBeGreaterThan(0);
      const pdf = await salvos[1]!.arquivo.text();
      expect(pdf.startsWith("%PDF")).toBe(true);
      expect(salvos[1]!.arquivo.type).toBe("application/pdf");
    });

    it("pagina a tabela: 50 por vez, setas e linhas por página", async () => {
      const linhas = Array.from({ length: 120 }, (_, i) => ({
        edital: `${i + 1}/2026`,
        unidade: "DSEI Teste",
        vagas_imediatas: i,
      }));
      await montar({
        "resumo-dos-editais": { data: { linhas }, error: null },
      });
      const primeiraCelula = () =>
        caixa?.querySelector("tbody tr td")?.textContent ?? "";
      const paginacao = () =>
        caixa?.querySelector("[data-paginacao]")?.textContent ?? "";
      expect(caixa?.querySelectorAll("tbody tr")).toHaveLength(50);
      // A paginação fica acima da tabela.
      const barra = caixa?.querySelector("[data-paginacao]");
      const tabela = caixa?.querySelector("table");
      expect(
        barra && tabela
          ? barra.compareDocumentPosition(tabela) &
              Node.DOCUMENT_POSITION_FOLLOWING
          : 0,
      ).toBeTruthy();
      expect(paginacao()).toContain("Mostrando 1–50 de 120");
      expect(paginacao()).toContain("Página 1 de 3");
      expect(
        caixa
          ?.querySelector("[aria-label='Página anterior']")
          ?.hasAttribute("disabled"),
      ).toBe(true);

      await clicar(caixa?.querySelector("[aria-label='Próxima página']"));
      await esperar();
      expect(primeiraCelula()).toBe("51/2026");
      expect(paginacao()).toContain("Mostrando 51–100 de 120");
      await clicar(caixa?.querySelector("[aria-label='Próxima página']"));
      await esperar();
      expect(caixa?.querySelectorAll("tbody tr")).toHaveLength(20);
      expect(
        caixa
          ?.querySelector("[aria-label='Próxima página']")
          ?.hasAttribute("disabled"),
      ).toBe(true);

      await escolher(caixa?.querySelector("[data-paginacao] select"), "25");
      await esperar();
      expect(primeiraCelula()).toBe("1/2026");
      expect(paginacao()).toContain("Página 1 de 5");
      expect(caixa?.querySelectorAll("tbody tr")).toHaveLength(25);
    });

    it("voltar a uma página já lida não chama o banco", async () => {
      const { supabase } = await montar({
        "resumo-dos-editais": CENTO_E_VINTE,
      });
      await clicar(caixa?.querySelector("[aria-label='Próxima página']"));
      await esperar();
      await clicar(caixa?.querySelector("[aria-label='Página anterior']"));
      await esperar();
      expect(leituras(supabase.chamadas)).toEqual([
        "resumo-dos-editais:1:50",
        "resumo-dos-editais:2:50",
      ]);
      expect(caixa?.querySelector("tbody tr td")?.textContent).toBe("1/2026");
    });

    it("sincronizar e trocar fonte limpam o cache do relatório", async () => {
      const { supabase } = await montar({
        "resumo-dos-editais": CENTO_E_VINTE,
        listar_fontes_do_painel: { data: FONTES_EDITAVEIS, error: null },
        salvar_fonte_da_coluna: { data: FONTES_EDITAVEIS, error: null },
      });
      await clicar(caixa?.querySelector("[aria-label='Próxima página']"));
      await esperar();
      await clicar(botao("Sincronizar"));
      await esperar();
      await clicar(caixa?.querySelector("[aria-label='Página anterior']"));
      await esperar();
      // A página 1, lida antes do Sincronizar, é pedida de novo.
      expect(leituras(supabase.chamadas)).toEqual([
        "resumo-dos-editais:1:50",
        "resumo-dos-editais:2:50",
        "resumo-dos-editais:2:50",
        "resumo-dos-editais:1:50",
      ]);
      await clicar(botao("Fontes dos dados"));
      await esperar();
      const linha = naGaveta("data_divulgacao");
      await digitar(
        linha?.querySelector("input[aria-label^='Motivo']"),
        "Voltar ao cronograma.",
      );
      await clicar(botaoEm(linha, "Voltar ao padrão"));
      await esperar();
      // Depois de trocar a fonte, a página aberta é relida e a outra também.
      await clicar(caixa?.querySelector("[aria-label='Próxima página']"));
      await esperar();
      expect(leituras(supabase.chamadas).slice(-2)).toEqual([
        "resumo-dos-editais:1:50",
        "resumo-dos-editais:2:50",
      ]);
    });

    it("o download pede todas as linhas", async () => {
      const { supabase, salvos } = await montar({
        "resumo-dos-editais": CENTO_E_VINTE,
      });
      await clicar(botao("Exportar em Excel"));
      await esperar(() => new Promise((ok) => setTimeout(ok, 50)));
      expect(leituras(supabase.chamadas).at(-1)).toBe(
        "resumo-dos-editais:1:null",
      );
      const arquivos = unzipSync(
        new Uint8Array(await salvos[0]!.arquivo.arrayBuffer()),
      );
      expect(
        strFromU8(arquivos["xl/worksheets/sheet1.xml"]!).match(/<row /g),
      ).toHaveLength(121);
    });

    it("as setas da paginação ficam travadas enquanto a página carrega", async () => {
      const { supabase } = await montar({
        "resumo-dos-editais": CENTO_E_VINTE,
      });
      let liberar = () => {};
      supabase.rpc.mockImplementationOnce(
        (_nome: string, args: Record<string, unknown>) =>
          new Promise<Resposta>((ok) => {
            liberar = () => ok(lerComoOBanco(CENTO_E_VINTE, args));
          }),
      );
      await clicar(caixa?.querySelector("[aria-label='Próxima página']"));
      const travada = (rotulo: string) =>
        caixa
          ?.querySelector(`[aria-label='${rotulo}']`)
          ?.hasAttribute("disabled");
      expect(travada("Próxima página")).toBe(true);
      expect(travada("Página anterior")).toBe(true);
      await esperar(async () => liberar());
      expect(travada("Página anterior")).toBe(false);
    });

    it("sem permissão ou sem a migration, o aviso no lugar da tabela", async () => {
      await montar({
        "resumo-dos-editais": {
          data: null,
          error: { code: "42501" },
        },
      });
      expect(caixa?.querySelector("[role=alert]")?.textContent).toBe(
        MENSAGEM_SEM_PERMISSAO,
      );
      expect(botao("Exportar em Excel")?.hasAttribute("disabled")).toBe(true);
      await act(async () => raiz?.unmount());
      caixa?.remove();
      await montar({
        "resumo-dos-editais": {
          data: null,
          error: { code: "PGRST202" },
        },
      });
      expect(caixa?.querySelector("[role=alert]")?.textContent).toBe(
        MENSAGEM_SEM_PUBLICACAO,
      );
    });

    it("abre só com o recurso paineis_dados", () => {
      expect(
        paginasPermitidas(perfil({ paineis_dados: "leitor" }))[
          "paineis-de-dados"
        ],
      ).toBe(true);
      expect(
        paginasPermitidas(perfil({ paineis_dados: "sem_acesso" }))[
          "paineis-de-dados"
        ],
      ).toBe(false);
      expect(paginasPermitidas(perfil({}))["paineis-de-dados"]).toBe(false);
      expect(
        bloqueioDaTela("paineis-de-dados", perfil({ paineis_dados: "leitor" })),
      ).toBe("");
      expect(bloqueioDaTela("paineis-de-dados", perfil({}))).toBe(
        "Sem permissão para Relatórios.",
      );
    });

    it("tem rota própria", () => {
      expect(telaDaRota("paineis-de-dados")).toMatchObject({
        caminho: "relatorios",
        titulo: "Relatórios",
        caminhosAntigos: ["paineis-de-dados"],
      });
    });
  });

  const FONTES_EDITAVEIS = {
    pode_editar: true,
    colunas: [
      {
        coluna: "vagas_imediatas",
        rotulo: "Total de vagas imediatas",
        tipo: "inteiro",
        padrao: "Padrão: vagas do cadastro do edital",
        escolha: null,
        opcoes: [
          {
            visao: "VW_EDITAL_QUADRO_DE_VAGAS",
            rotulo: "Quadro de vagas do edital",
            colunas: [
              {
                coluna: "QT_VAGA_IMEDIATA",
                rotulo: "Vagas imediatas (soma do quadro)",
              },
            ],
          },
        ],
      },
      {
        coluna: "data_divulgacao",
        rotulo: "Data da divulgação do edital",
        tipo: "data",
        padrao: "Padrão: início da 1ª etapa do cronograma",
        escolha: { visao: "VW_EDITAL_CADASTRO", coluna: "DT_INICIO" },
        opcoes: [
          {
            visao: "VW_EDITAL_CADASTRO",
            rotulo: "Cadastro do edital (sem o cronograma)",
            colunas: [
              { coluna: "DT_INICIO", rotulo: "Data de início do formulário" },
              { coluna: "DT_FIM", rotulo: "Data de fim do formulário" },
            ],
          },
        ],
      },
    ],
    historico: [
      {
        em: "2026-11-13T15:00:00Z",
        nome: "Pessoa Administradora",
        coluna: "Data da divulgação do edital",
        antes: "Padrão: início da 1ª etapa do cronograma",
        depois:
          "Cadastro do edital (sem o cronograma) › Data de início do formulário",
        motivo: "Conferência do cronograma.",
      },
    ],
  };

  const CENTO_E_VINTE: Resposta = {
    data: {
      calculado_em: "2026-11-13T15:00:00Z",
      linhas: Array.from({ length: 120 }, (_, i) => ({
        edital: `${i + 1}/2026`,
        unidade: "DSEI Teste",
        vagas_imediatas: i,
      })),
    },
    error: null,
  };

  const RESUMO_COM_FONTE: Resposta = {
    data: {
      ...(RESUMO.data as Record<string, unknown>),
      fontes: {
        vagas_imediatas: {
          padrao: false,
          visao: "VW_EDITAL_QUADRO_DE_VAGAS",
          coluna: "QT_VAGA_IMEDIATA",
          rotulo:
            "Quadro de vagas do edital › Vagas imediatas (soma do quadro)",
        },
        data_divulgacao: {
          padrao: true,
          visao: null,
          coluna: null,
          rotulo: "Padrão: início da 1ª etapa do cronograma",
        },
      },
      avisos: [
        'A fonte escolhida para "Data final do processo seletivo" não está disponível: a coluna ficou vazia.',
      ],
    },
    error: null,
  };

  const gaveta = () => document.querySelector("[role='dialog']");
  const naGaveta = (coluna: string) =>
    gaveta()?.querySelector(`[data-coluna='${coluna}']`) ?? null;
  const botaoEm = (onde: Element | null | undefined, rotulo: string) =>
    [...(onde?.querySelectorAll("button") ?? [])].find(
      (b) => b.textContent?.trim() === rotulo,
    );
  const chamadasDe = (
    chamadas: { nome: string; args: unknown }[],
    nome: string,
  ) => chamadas.filter((c) => c.nome === nome);

  describe("Fontes dos dados", () => {
    const respostas = (fontes: unknown = FONTES_EDITAVEIS) => ({
      "resumo-dos-editais": RESUMO,
      listar_fontes_do_painel: { data: fontes, error: null },
      salvar_fonte_da_coluna: { data: fontes, error: null },
    });

    it("o botão Fontes dos dados abre a gaveta do relatório e da área", async () => {
      const { supabase } = await montar(respostas());
      await clicar(botao("Fontes dos dados"));
      await esperar();
      expect(chamadasDe(supabase.chamadas, "listar_fontes_do_painel")).toEqual([
        {
          nome: "listar_fontes_do_painel",
          args: { p_area: "saude-indigena", p_relatorio: "resumo-dos-editais" },
        },
      ]);
      expect(gaveta()?.textContent).toContain("Fontes dos dados");
      expect(naGaveta("vagas_imediatas")?.textContent).toContain(
        "Total de vagas imediatas",
      );
      expect(gaveta()?.textContent).toContain("Conferência do cronograma.");
    });

    it("quem não é Administrador vê a gaveta sem os controles", async () => {
      await montar(respostas({ ...FONTES_EDITAVEIS, pode_editar: false }));
      await clicar(botao("Fontes dos dados"));
      await esperar();
      expect(gaveta()?.querySelector("select")).toBeNull();
      expect(botaoEm(gaveta(), "Salvar")).toBeUndefined();
      expect(naGaveta("data_divulgacao")?.textContent).toContain(
        "Cadastro do edital (sem o cronograma) › Data de início do formulário",
      );
      expect(naGaveta("vagas_imediatas")?.textContent).toContain(
        "Padrão: vagas do cadastro do edital",
      );
    });

    it("trocar de área enquanto a fonte salva não traz a área antiga", async () => {
      const { supabase, tela } = await montar(respostas());
      let liberar = () => {};
      await clicar(botao("Fontes dos dados"));
      await esperar();
      const linha = naGaveta("data_divulgacao");
      await digitar(
        linha?.querySelector("input[aria-label^='Motivo']"),
        "Voltar ao cronograma.",
      );
      // A próxima chamada (salvar) fica pendente; o mock de listar já respondeu.
      supabase.rpc.mockImplementationOnce(
        () =>
          new Promise<Resposta>((ok) => {
            liberar = () => ok({ data: FONTES_EDITAVEIS, error: null });
          }),
      );
      await clicar(botaoEm(linha, "Voltar ao padrão"));
      await esperar(() => tela.estado.carregar("sede"));
      await esperar(async () => liberar());
      const areas = supabase.chamadas
        .filter((c) => c.nome === LER)
        .map((c) => (c.args as { p_area: string }).p_area);
      expect(areas.at(-1)).toBe("sede");
      expect(tela.estado.obter().relatorios["resumo-dos-editais"].area).toBe(
        "sede",
      );
    });

    it("salvar manda a fonte e o motivo e relê o relatório", async () => {
      const { supabase } = await montar(respostas());
      await clicar(botao("Fontes dos dados"));
      await esperar();
      const linha = naGaveta("vagas_imediatas");
      await escolher(
        linha?.querySelector("select[aria-label^='Origem']"),
        "VW_EDITAL_QUADRO_DE_VAGAS",
      );
      expect(
        (
          linha?.querySelector(
            "select[aria-label^='Coluna']",
          ) as HTMLSelectElement | null
        )?.value,
      ).toBe("QT_VAGA_IMEDIATA");
      await digitar(
        linha?.querySelector("input[aria-label^='Motivo']"),
        "Usar o quadro do edital.",
      );
      await clicar(botaoEm(linha, "Salvar"));
      await esperar();
      expect(chamadasDe(supabase.chamadas, "salvar_fonte_da_coluna")).toEqual([
        {
          nome: "salvar_fonte_da_coluna",
          args: {
            p_area: "saude-indigena",
            p_relatorio: "resumo-dos-editais",
            p_coluna: "vagas_imediatas",
            p_visao: "VW_EDITAL_QUADRO_DE_VAGAS",
            p_coluna_visao: "QT_VAGA_IMEDIATA",
            p_motivo: "Usar o quadro do edital.",
          },
        },
      ]);
      // O banco recalculou ao salvar: a página é relida.
      expect(leituras(supabase.chamadas)).toEqual([
        "resumo-dos-editais:1:50",
        "resumo-dos-editais:1:50",
      ]);
    });

    it("Voltar ao padrão manda p_visao nulo", async () => {
      const { supabase } = await montar(respostas());
      await clicar(botao("Fontes dos dados"));
      await esperar();
      const linha = naGaveta("data_divulgacao");
      await digitar(
        linha?.querySelector("input[aria-label^='Motivo']"),
        "O cronograma foi revisado.",
      );
      await clicar(botaoEm(linha, "Voltar ao padrão"));
      await esperar();
      expect(
        chamadasDe(supabase.chamadas, "salvar_fonte_da_coluna")[0]?.args,
      ).toMatchObject({
        p_coluna: "data_divulgacao",
        p_visao: null,
        p_coluna_visao: null,
        p_motivo: "O cronograma foi revisado.",
      });
    });

    it("o erro do banco ao salvar aparece na gaveta", async () => {
      await montar({
        ...respostas(),
        salvar_fonte_da_coluna: {
          data: null,
          error: { code: "22023", message: "Motivo: de 3 a 500 caracteres." },
        },
      });
      await clicar(botao("Fontes dos dados"));
      await esperar();
      const linha = naGaveta("vagas_imediatas");
      await escolher(
        linha?.querySelector("select[aria-label^='Origem']"),
        "VW_EDITAL_QUADRO_DE_VAGAS",
      );
      await clicar(botaoEm(linha, "Salvar"));
      await esperar();
      expect(gaveta()?.querySelector("[role='alert']")?.textContent).toContain(
        "Motivo: de 3 a 500 caracteres.",
      );
    });

    it("coluna fora do padrão tem marcador no cabeçalho com a fonte na dica", async () => {
      await montar({ "resumo-dos-editais": RESUMO_COM_FONTE });
      const cabecalhos = [...(caixa?.querySelectorAll("thead th") ?? [])];
      const vagas = cabecalhos.find((th) =>
        th.textContent?.includes("Total de vagas imediatas"),
      );
      const divulgacao = cabecalhos.find((th) =>
        th.textContent?.includes("Data da divulgação"),
      );
      expect(vagas?.querySelector("[data-fonte-diferente]")).not.toBeNull();
      expect(vagas?.getAttribute("title")).toContain(
        "Quadro de vagas do edital › Vagas imediatas (soma do quadro)",
      );
      expect(divulgacao?.querySelector("[data-fonte-diferente]")).toBeNull();
    });

    it("avisos da resposta aparecem acima da tabela", async () => {
      await montar({ "resumo-dos-editais": RESUMO_COM_FONTE });
      expect(
        caixa?.querySelector("[data-tone='warning']")?.textContent,
      ).toContain(
        'A fonte escolhida para "Data final do processo seletivo" não está disponível',
      );
    });

    it("o XLSX baixado tem a aba Fontes", async () => {
      const { salvos } = await montar({
        "resumo-dos-editais": RESUMO_COM_FONTE,
      });
      await clicar(botao("Exportar em Excel"));
      await esperar(() => new Promise((ok) => setTimeout(ok, 50)));
      const arquivos = unzipSync(
        new Uint8Array(await salvos[0]!.arquivo.arrayBuffer()),
      );
      expect(strFromU8(arquivos["xl/workbook.xml"]!)).toContain(
        'name="Fontes"',
      );
      expect(strFromU8(arquivos["xl/worksheets/sheet2.xml"]!)).toContain(
        "Quadro de vagas do edital › Vagas imediatas (soma do quadro)",
      );
    });
  });

  describe("largura das colunas e origem dos dados", () => {
    const alca = (n = 0) =>
      caixa?.querySelectorAll<HTMLElement>("[data-alca-da-coluna]")[n] ?? null;
    const primeiroTh = () => caixa?.querySelector<HTMLElement>("thead th");
    async function arrastar(alvo: HTMLElement | null, de: number, ate: number) {
      await act(async () => {
        alvo?.dispatchEvent(
          new MouseEvent("pointerdown", { bubbles: true, clientX: de }),
        );
        window.dispatchEvent(
          new MouseEvent("pointermove", { bubbles: true, clientX: ate }),
        );
        window.dispatchEvent(
          new MouseEvent("pointerup", { bubbles: true, clientX: ate }),
        );
      });
    }

    it("arrastar a borda muda a largura da coluna e trocar de página mantém", async () => {
      await montar({ "resumo-dos-editais": CENTO_E_VINTE });
      expect(alca()?.getAttribute("role")).toBe("separator");
      expect(alca()?.getAttribute("aria-label")).toBe(
        "Largura — Número do edital",
      );
      await arrastar(alca(), 10, 210);
      // jsdom mede 0: a partida é o mínimo (60 px), e o arraste soma 200.
      expect(primeiroTh()?.style.width).toBe("260px");
      expect(
        caixa?.querySelector("table")?.hasAttribute("data-larguras-escolhidas"),
      ).toBe(true);
      await clicar(caixa?.querySelector("[aria-label='Próxima página']"));
      await esperar();
      expect(primeiroTh()?.style.width).toBe("260px");
    });

    it("seta para a esquerda na alça estreita a coluna", async () => {
      await montar({ "resumo-dos-editais": CENTO_E_VINTE });
      await arrastar(alca(), 10, 210);
      await teclar(alca()!, "ArrowLeft");
      expect(primeiroTh()?.style.width).toBe("244px");
    });

    it("uma tela nova volta às larguras originais", async () => {
      await montar({ "resumo-dos-editais": CENTO_E_VINTE });
      await arrastar(alca(), 10, 210);
      await act(async () => raiz?.unmount());
      caixa?.remove();
      await montar({ "resumo-dos-editais": CENTO_E_VINTE });
      expect(primeiroTh()?.style.width).toBe("");
    });

    it("o ⓘ mostra a origem e a fonte trocada", async () => {
      await montar({ "resumo-dos-editais": RESUMO_COM_FONTE });
      const info = caixa?.querySelector<HTMLButtonElement>(
        "button[aria-label='De onde vêm os dados']",
      );
      expect(info?.getAttribute("title")).toContain(
        "Uma linha por edital da área",
      );
      await clicar(info);
      const painel = caixa?.querySelector("[data-origem-dos-dados]");
      expect(painel?.textContent).toContain("Uma linha por edital da área");
      expect(painel?.textContent).toContain(
        "Fonte trocada nesta área: Total de vagas imediatas → Quadro de vagas do edital › Vagas imediatas (soma do quadro)",
      );
    });
  });

  describe("os relatórios gerados no navegador (23/11/2026)", () => {
    const linha = (id: string, edital: string): LinhaDaVisaoGeral => ({
      id,
      edital,
      unidade: "DSEI Teste",
      fase: "Concluído",
      atencao: [],
      pos_resultado: [],
      desistentes: 0,
      aprovados: null,
      cadastro_reserva: null,
      primeira_admissao: null,
      ultima_admissao: null,
      admissoes: 0,
    });
    const alertas = () =>
      [...(caixa?.querySelectorAll("[role=alert]") ?? [])].map(
        (a) => a.textContent,
      );
    const montador = () => document.getElementById("montadorDeRelatorio");

    // Os editais da área já lidos (o montador espera por eles).
    beforeEach(() => publicarLinhasDoMonitoramento([]));
    afterEach(() => {
      window.history.replaceState(null, "", "/");
      redefinirDadosDoMonitoramento();
    });

    it("sem os editais da área lidos, o montador os pede e espera por eles", async () => {
      redefinirDadosDoMonitoramento();
      window.history.replaceState(null, "", "/saude-indigena/relatorios");
      const devolver = vi.fn();
      const pedirLinhas = vi.fn(() => devolver);
      await montar(
        {},
        { linhasDaArea: () => [linha("e1", "01/2099")], pedirLinhas },
        { abrir: null },
      );
      expect(pedirLinhas).not.toHaveBeenCalled();
      await clicar(botaoEmCartao("montar-relatorio", "Montar"));
      await esperar();
      expect(pedirLinhas).toHaveBeenCalledTimes(1);
      expect(montador()).toBeNull();
      expect(caixa?.textContent).toContain("Carregando os editais da área");
      await act(async () => publicarLinhasDoMonitoramento([]));
      expect(montador()?.textContent).toContain("1 processo da área");
      // Fechar devolve o pedido (a leitura cara não fica ligada à toa).
      await clicar(
        [...(montador()?.querySelectorAll("button") ?? [])].find(
          (b) => b.textContent?.trim() === "Cancelar",
        ),
      );
      await esperar();
      expect(devolver).toHaveBeenCalledTimes(1);
    });

    it("o cartão Montar relatório abre o montador com a área inteira, e ele vai no endereço", async () => {
      window.history.replaceState(null, "", "/saude-indigena/relatorios");
      const linhasDaArea = vi.fn(() => [
        linha("e1", "01/2099"),
        linha("e2", "02/2099"),
      ]);
      await montar(
        { "resumo-dos-editais": RESUMO },
        { linhasDaArea },
        { abrir: null },
      );
      // O botão do topo saiu: o montador é um cartão.
      expect(caixa?.querySelector("[data-acao='montar-relatorio']")).toBeNull();
      expect(montador()).toBeNull();
      await clicar(botaoEmCartao("montar-relatorio", "Montar"));
      await esperar();
      expect(montador()?.textContent).toContain("2 processos da área");
      expect(linhasDaArea).toHaveBeenCalledTimes(1);
      expect(window.location.search).toBe("?relatorio=montar-relatorio");
      await clicar(
        [...(montador()?.querySelectorAll("button") ?? [])].find(
          (b) => b.textContent?.trim() === "Cancelar",
        ),
      );
      await esperar();
      expect(montador()).toBeNull();
      expect(window.location.search).toBe("");
    });

    it("o grupo Gráficos: os dos aprovados só com o recurso, e a miniatura ao marcar", async () => {
      const graficos = () =>
        [
          ...(montador()?.querySelectorAll(
            ".relatorios-montador-graficos label",
          ) ?? []),
        ].map((l) => l.textContent?.trim());
      const marcar = (rotulo: string) =>
        clicar(
          [
            ...(montador()?.querySelectorAll<HTMLLabelElement>(
              ".relatorios-montador-graficos label",
            ) ?? []),
          ]
            .find((l) => l.textContent?.trim() === rotulo)
            ?.querySelector("input"),
        );
      window.history.replaceState(null, "", "/saude-indigena/relatorios");
      await montar(
        {},
        {
          linhasDaArea: () => [{ ...linha("e1", "01/2099"), fase: "Recursos" }],
        },
        { abrir: null },
      );
      await clicar(botaoEmCartao("montar-relatorio", "Montar"));
      await esperar();
      expect(graficos()).toEqual([
        "Vagas × contratadas por unidade",
        "Editais por fase",
      ]);
      expect(
        montador()?.querySelector(".relatorios-montador-previa"),
      ).toBeNull();
      await marcar("Editais por fase");
      const miniatura = montador()?.querySelector(
        "figure[data-grafico='editais-por-fase']",
      );
      expect(miniatura?.querySelector("figcaption")?.textContent).toBe(
        "Editais em andamento, por fase",
      );
      expect(miniatura?.querySelector("canvas[role=img]")).not.toBeNull();
      // Desmarcar o único gráfico vale (o grupo pode ficar vazio).
      await marcar("Editais por fase");
      expect(
        montador()?.querySelector(".relatorios-montador-previa"),
      ).toBeNull();
    });

    it("com o recurso aprovados, os gráficos deles carregam a prévia só no botão", async () => {
      window.history.replaceState(null, "", "/saude-indigena/relatorios");
      await montar(
        {},
        {
          linhasDaArea: () => [linha("e1", "01/2099")],
          obterPerfil: () => ({ permissoes: { aprovados: "leitor" } }),
          aprovados: () => new Promise<never>(() => {}),
        },
        { abrir: null },
      );
      await clicar(botaoEmCartao("montar-relatorio", "Montar"));
      await esperar();
      const rotulos = [
        ...(montador()?.querySelectorAll<HTMLLabelElement>(
          ".relatorios-montador-graficos label",
        ) ?? []),
      ];
      expect(rotulos.map((l) => l.textContent?.trim())).toEqual([
        "Vagas × contratadas por unidade",
        "Editais por fase",
        "Contratações por mês",
        "Situação dos aprovados",
      ]);
      await clicar(rotulos[3]?.querySelector("input"));
      const miniatura = montador()?.querySelector(
        "figure[data-grafico='situacao-dos-aprovados']",
      );
      expect(miniatura?.querySelector("button")?.textContent).toBe(
        "Carregar prévia",
      );
      expect(montador()?.textContent).toContain(
        "O download dos aprovados fica registrado com o seu nome.",
      );
      // Sem banco, a leitura falha e a mensagem aparece.
      await clicar(miniatura?.querySelector("button"));
      await esperar();
      expect(
        montador()?.querySelector(".relatorios-montador-erro")?.textContent,
      ).toBe("Sem conexão com o banco.");
    });

    it("vindo da Visão geral (origem=visao-geral), o montador leva o recorte dela", async () => {
      window.history.replaceState(
        null,
        "",
        "/saude-indigena/relatorios?relatorio=montar-relatorio&origem=visao-geral",
      );
      const recorte = {
        ...recorteDaAreaInteira("saude-indigena", [linha("e1", "01/2099")]),
        carregado: true,
      };
      await montar(
        {},
        {
          linhasDaArea: () => [linha("e1", "01/2099"), linha("e2", "02/2099")],
          visaoGeral: () => recorte,
        },
        { abrir: null },
      );
      await esperar();
      expect(montador()?.textContent).toContain(
        "1 processo do recorte da Visão geral",
      );
    });

    it("o cartão da diretoria gera direto (sem Abrir) e mostra a falha", async () => {
      const esperarLinhas = vi.fn(async () => {});
      await montar(
        {},
        { linhasDaArea: () => [linha("e1", "01/2099")], esperarLinhas },
        { abrir: null },
      );
      expect(botaoEmCartao("relatorio-da-diretoria", "Abrir")).toBeUndefined();
      // Sem banco, as vagas por cargo (aba 2) não chegam.
      await clicar(
        botaoEmCartao("relatorio-da-diretoria", "Exportar em Excel"),
      );
      await esperar();
      expect(alertas()).toContain("Sem conexão com o banco.");
      // Gera só depois dos editais da área lidos.
      expect(esperarLinhas).toHaveBeenCalledTimes(1);
      const pdf = escolhaDaDiretoria("PDF");
      expect(pdf.secoes).toEqual(["editais", "cargos", "aprovados"]);
      expect(pdf.formato).toBe("PDF");
    });

    it("o Resumo por cargo e status só aparece com o recurso aprovados e abre no endereço", async () => {
      window.history.replaceState(null, "", "/saude-indigena/relatorios");
      const aprovados = vi.fn(() => new Promise<never>(() => {}));
      await montar(
        {},
        {
          obterPerfil: () => ({ permissoes: { aprovados: "leitor" } }),
          aprovados,
        },
        { abrir: null },
      );
      expect(
        [...(cartao("resumo-por-cargo")?.querySelectorAll("h3") ?? [])].map(
          (h) => h.textContent,
        ),
      ).toEqual(["Resumo por cargo e status"]);
      await clicar(botaoEmCartao("resumo-por-cargo", "Abrir"));
      await esperar();
      expect(window.location.search).toBe("?relatorio=resumo-por-cargo");
      expect(aprovados).toHaveBeenCalledTimes(1);
      expect(caixa?.querySelector(".relatorios-voltar h2")?.textContent).toBe(
        "Resumo por cargo e status",
      );
      expect(botao("Atualizar")).toBeDefined();
    });

    it("sem o recurso aprovados, o link do Resumo por cargo fica no catálogo", async () => {
      window.history.replaceState(
        null,
        "",
        "/saude-indigena/relatorios?relatorio=resumo-por-cargo",
      );
      const aprovados = vi.fn(() => new Promise<never>(() => {}));
      await montar({}, { aprovados }, { abrir: null });
      await esperar();
      expect(
        caixa?.querySelector("[data-catalogo-dos-relatorios]"),
      ).not.toBeNull();
      expect(aprovados).not.toHaveBeenCalled();
    });

    it("Ver em Relatórios com a tela já montada abre o relatório pedido, com os editais", async () => {
      window.history.replaceState(null, "", "/saude-indigena/relatorios");
      await montar(
        {},
        { obterPerfil: () => ({ permissoes: { aprovados: "leitor" } }) },
        { abrir: null },
      );
      const irPara = vi.fn();
      await act(async () =>
        abrirEmRelatorios("resumo-por-cargo", { editais: ["7"] }, irPara),
      );
      await esperar();
      expect(irPara).toHaveBeenCalledWith("paineis-de-dados");
      expect(window.location.search).toBe(
        "?relatorio=resumo-por-cargo&edital=7",
      );
      expect(caixa?.querySelector(".relatorios-voltar h2")?.textContent).toBe(
        "Resumo por cargo e status",
      );
    });
  });
});

bloco("vidro-no-painel-de-acesso", () => {
  /*
  O PAINEL DE VIDRO DA TELA DE ACESSO (pedido de 12/11/2026)

  Configurações › Tela de acesso › Estilo do painel: sólido (padrão) ou vidro.
  A chave `auth_access_painel_estilo` chega antes do login pela função pública
  (migration 20261112180000), vai para o cache da marca e vira a classe
  `login-panel-vidro` no #loginScreen. Desde 13/11/2026 o vidro não tem cor:
  o texto vai direto sobre a arte, que o sistema não mede.
*/

  const RAIZ = path.resolve(import.meta.dirname, "..");
  const ler = (relativo: string) =>
    fs.readFileSync(path.join(RAIZ, relativo), "utf8").replace(/\r\n/g, "\n");

  describe("o estilo do painel", () => {
    it("normaliza: só 'vidro' é vidro", () => {
      expect(normalizarEstilo("vidro")).toBe(ESTILO_VIDRO);
      expect(normalizarEstilo(" VIDRO ")).toBe(ESTILO_VIDRO);
      for (const valor of ["", "solido", "outro", null, undefined]) {
        expect(normalizarEstilo(valor)).toBe(ESTILO_SOLIDO);
      }
    });

    it("chega antes do login pela leitura pública", () => {
      expect(
        mapearBrandingPublico({
          auth_access_panel_color: "#12403f",
          auth_access_painel_estilo: "vidro",
        }),
      ).toEqual({ panelColor: "#12403f", painelEstilo: "vidro" });
    });

    it("vira a classe login-panel-vidro e sai dela", () => {
      const tela = document.createElement("section");
      aplicarEstiloDoPainel(tela, "vidro");
      expect(tela.classList.contains("login-panel-vidro")).toBe(true);
      aplicarEstiloDoPainel(tela, "solido");
      expect(tela.classList.contains("login-panel-vidro")).toBe(false);
    });

    it("o primeiro quadro aplica a classe guardada, sem esperar o JavaScript", () => {
      const html = ler("index.html");
      expect(html).toContain(
        'window.__agsusPainelVidro = marca.painelEstilo === "vidro";',
      );
      expect(html).toContain('.classList.add("login-panel-vidro");');
    });

    it("sem ajuste, o vidro não tem cor; e recua para o painel sólido", () => {
      const css = ler("src/styles/platform-shell.css");
      const bloco = css.slice(
        css.indexOf(".login-screen.login-panel-vidro .login-outer {"),
        css.indexOf(".login-screen.login-panel-vidro .login-card {"),
      );
      // A cor só entra na proporção escolhida (13/11/2026); sem escolha, 0%.
      expect(bloco).toContain("var(--vidro-cor, 0%)");
      expect(css).toContain("@media (prefers-reduced-transparency: reduce)");
      expect(css).toContain(
        "background: var(--login-panel-color, var(--color-bg-subtle));",
      );
    });
  });

  describe("contraste do vidro", () => {
    /*
    13/11/2026: "vidro mesmo, sem cor". Nem tinta, nem brilho branco, nem
    realce de saturação: o vidro se vê pela borda clara e pelo realce de luz.
  */
    it("vidro de verdade: sem brilho nem saturação; cor e desfoque só os escolhidos", () => {
      const css = ler("src/styles/platform-shell.css");
      const bloco = css.slice(
        css.indexOf(".login-screen.login-panel-vidro .login-outer {"),
        css.indexOf(".login-screen.login-panel-vidro .login-card {"),
      );
      expect(bloco).not.toContain("linear-gradient");
      expect(bloco).not.toContain("saturate");
      expect(bloco).toContain(
        "backdrop-filter: blur(var(--vidro-desfoque, 0px));",
      );
      expect(bloco).toContain(
        "border-color: color-mix(in srgb, var(--brilho-do-vidro)",
      );
      expect(bloco).toContain(
        "inset 0 1px 0 color-mix(in srgb, var(--brilho-do-vidro)",
      );
    });

    it("no vidro o contraste não é garantido, e o aviso diz que arte combina", () => {
      const escuro = avaliarCor("#002f2f", "auto", "vidro");
      expect(escuro?.passa).toBe(false);
      expect(escuro?.mensagem).toContain("texto claro");
      expect(escuro?.mensagem).toContain("precisa ser escura");
      expect(escuro?.mensagem).toContain("painel sólido");
      const claro = avaliarCor("#f2f2f2", "auto", "vidro");
      expect(claro?.mensagem).toContain("precisa ser clara");
    });

    it("no sólido a cor continua medida como antes", () => {
      const solido = avaliarCor("#002f2f", "auto", "solido");
      expect(solido?.passa).toBe(true);
      expect(solido?.mensagem).toContain("Acima do mínimo");
      expect(avaliarCor("#8fb3d9", "claro", "solido")?.passa).toBe(false);
    });
  });
});

bloco("componentes/retificar-quadro", () => {
  /*
  O quadro salvo do edital linha por linha (retificar-quadro.tsx, migration 20261126180000):
  Editar, Retirar e "Acrescentar vaga" abrem o modal; a prévia vem da simulação no banco
  (simular: true) e mostra a linha antes e depois e as vagas que seguem, ficam sem linha ou
  passam à linha; só "Salvar retificação" grava, com o motivo. Sem o banco novo, só se vê.
*/
  const linha = (
    id: string,
    ordem: number,
    cargo: string,
    lotacao: string,
    imediatas: number,
    extra: Record<string, unknown> = {},
  ) => ({
    id,
    ordem,
    cargo,
    lotacao,
    modalidades: { "Ampla Concorrência": imediatas },
    vagas_imediatas: imediatas,
    cadastro_reserva: true,
    origem: "PDF",
    arquivo: "anexos.pdf",
    ...extra,
  });
  const vinculo = (vaga: string, cargo: string, quadro: string | null) => ({
    vaga,
    cargo,
    quadro,
    situacao: quadro ? "CONFIRMADO" : "AUSENTE",
    origem: "MANUAL",
    candidatas: [],
  });
  const QUADRO = {
    linhas: [
      linha("a", 1, "Enfermeiro", "Polo Base Alfa", 2),
      linha("b", 2, "Médico", "Polo Base Alfa", 1),
    ],
    vinculos: [
      vinculo("1001", "Enfermeiro - Polo Base Alfa", "a"),
      vinculo("1002", "Médico", "b"),
      vinculo("1003", "Agente Indígena de Saúde", null),
    ],
    pode_editar: true,
    historico: [],
  };

  let desmontar = () => {};
  afterEach(() => {
    act(() => desmontar());
    document.body.innerHTML = "";
  });

  function montar(
    inicial: unknown,
    salvarQuadroDeVagas: EstadoDaRetificacaoDoQuadro["salvarQuadroDeVagas"],
  ) {
    document.body.innerHTML = `<div id="raiz"></div>`;
    function Casca() {
      const [dados, setDados] = useState<unknown>(inicial);
      return createElement(QuadroSalvo, {
        estado: { salvarQuadroDeVagas },
        idEdital: "e1",
        dados,
        aoMudar: setDados,
      });
    }
    act(() => {
      ({ desmontar } = desenharNoTeste(
        document.getElementById("raiz")!,
        createElement(Casca),
      ));
    });
  }

  const texto = () => document.body.textContent ?? "";
  const botao = (acao: string) =>
    document.querySelector<HTMLButtonElement>(`[data-acao="${acao}"]`);
  const campo = (nome: string) =>
    document.querySelector(`[data-campo="${nome}"]`);
  type Payload = {
    motivo: string;
    numero_errata?: string;
    simular?: boolean;
    linhas: Record<string, unknown>[];
  };
  const payloads = (fn: ReturnType<typeof vi.fn>) =>
    fn.mock.calls.map((c) => c[1] as Payload);

  it("editar: o total sai da soma, a prévia mostra antes e depois e a vaga que continua; grava com motivo", async () => {
    const depois = {
      ...QUADRO,
      linhas: [
        linha("a2", 1, "Enfermeiro", "Polo Base Alfa", 2),
        linha("b2", 2, "Médico", "Polo Base Alfa", 3, {
          modalidades: { "Ampla Concorrência": 3 },
          origem: "MANUAL",
        }),
      ],
      vinculos: [
        vinculo("1001", "Enfermeiro - Polo Base Alfa", "a2"),
        vinculo("1002", "Médico", "b2"),
        vinculo("1003", "Agente Indígena de Saúde", null),
      ],
    };
    const salvar = vi.fn(async () => depois);
    montar(QUADRO, salvar);
    const editar = document.querySelectorAll<HTMLButtonElement>(
      '[data-acao="editar-linha-do-quadro"]',
    );
    expect(editar).toHaveLength(2);
    await clicar(editar[1]!);
    expect(texto()).toContain("Editar vaga do quadro");
    await digitar(
      document.querySelector('[data-modalidade="Ampla Concorrência"]'),
      "3",
    );
    expect(document.querySelector("[data-total-da-linha]")?.textContent).toBe(
      "3",
    );
    await clicar(botao("conferir-retificacao-do-quadro"));
    await esperar();
    expect(payloads(salvar)[0]).toMatchObject({
      simular: true,
      linhas: [
        { cargo: "Enfermeiro", anterior: "a" },
        {
          cargo: "Médico",
          anterior: "b",
          origem: "MANUAL",
          vagas_imediatas: 3,
        },
      ],
    });
    const previa = document.querySelector("[data-previa-da-retificacao]")!;
    expect(
      previa.querySelector('[data-previa="antes"]')?.textContent,
    ).toContain("Médico");
    expect(
      previa.querySelector('[data-previa="depois"]')?.textContent,
    ).toContain("Manual");
    expect(
      previa.querySelector('tr[data-vaga="1002"]')?.getAttribute("data-efeito"),
    ).toBe("continua");

    // Sem motivo não grava.
    await clicar(botao("gravar-retificacao-do-quadro"));
    expect(salvar).toHaveBeenCalledTimes(1);
    expect(texto()).toContain("Diga o motivo da retificação");
    await digitar(campo("motivo"), "Retificação nº 2 do edital");
    await digitar(campo("errata"), "Retificação nº 2");
    await clicar(botao("gravar-retificacao-do-quadro"));
    await esperar();
    expect(salvar).toHaveBeenCalledTimes(2);
    expect(payloads(salvar)[1]).toMatchObject({
      motivo: "Retificação nº 2 do edital",
      numero_errata: "Retificação nº 2",
    });
    expect(payloads(salvar)[1]).not.toHaveProperty("simular");
    expect(document.querySelector("[data-previa-da-retificacao]")).toBeNull();
    expect(
      document.querySelector('[data-linha-do-quadro="b2"]')?.textContent,
    ).toContain("Manual");
  });

  it("retirar: a prévia diz que a vaga ligada fica sem linha e pede confirmação no botão", async () => {
    const simulado = {
      ...QUADRO,
      linhas: [linha("a2", 1, "Enfermeiro", "Polo Base Alfa", 2)],
      vinculos: [
        vinculo("1001", "Enfermeiro - Polo Base Alfa", "a2"),
        vinculo("1002", "Médico", null),
        vinculo("1003", "Agente Indígena de Saúde", null),
      ],
    };
    const salvar = vi.fn(async () => simulado);
    montar(QUADRO, salvar);
    await clicar(
      document.querySelector('[aria-label="Retirar Médico — Polo Base Alfa"]'),
    );
    await esperar();
    expect(payloads(salvar)[0]).toMatchObject({
      simular: true,
      linhas: [{ cargo: "Enfermeiro", anterior: "a" }],
    });
    expect(texto()).toContain("A vaga 1002 fica sem linha no quadro.");
    expect(
      document
        .querySelector('[data-vagas-da-previa] tr[data-vaga="1002"]')
        ?.getAttribute("data-efeito"),
    ).toBe("sem-linha");
    expect(
      document.querySelector('[data-previa="depois"]')?.textContent,
    ).toContain("Retirada do quadro");
    const gravar = botao("gravar-retificacao-do-quadro")!;
    expect(gravar.textContent).toBe("Retirar e deixar 1 vaga sem linha");
    await digitar(campo("motivo"), "Retificação nº 3: vaga cancelada");
    await clicar(gravar);
    await esperar();
    // A simulação pode correr duas vezes no StrictMode; a gravação, uma só.
    const gravacoes = payloads(salvar).filter((p) => !p.simular);
    expect(gravacoes).toHaveLength(1);
    expect(gravacoes[0]).toMatchObject({
      motivo: "Retificação nº 3: vaga cancelada",
      linhas: [{ anterior: "a" }],
    });
    expect(gravacoes[0]?.linhas).toHaveLength(1);
  });

  it("acrescentar: a prévia mostra a vaga que passa à linha nova", async () => {
    const simulado = {
      ...QUADRO,
      linhas: [
        linha("a2", 1, "Enfermeiro", "Polo Base Alfa", 2),
        linha("b2", 2, "Médico", "Polo Base Alfa", 1),
        linha("c2", 3, "Agente Indígena de Saúde", "Polo Base Alfa", 1, {
          origem: "MANUAL",
        }),
      ],
      vinculos: [
        vinculo("1001", "Enfermeiro - Polo Base Alfa", "a2"),
        vinculo("1002", "Médico", "b2"),
        {
          ...vinculo("1003", "Agente Indígena de Saúde", "c2"),
          origem: "AUTOMATICO",
        },
      ],
    };
    const salvar = vi.fn(async () => simulado);
    montar(QUADRO, salvar);
    await clicar(botao("acrescentar-linha-do-quadro"));
    // Linha repetida não segue.
    await digitar(campo("cargo"), "médico");
    await digitar(campo("lotacao"), "Polo Base Alfa");
    await digitar(
      document.querySelector('[data-modalidade="Ampla Concorrência"]'),
      "1",
    );
    await clicar(botao("conferir-retificacao-do-quadro"));
    expect(salvar).not.toHaveBeenCalled();
    expect(texto()).toContain("Já há a linha Médico — Polo Base Alfa");

    await digitar(campo("cargo"), "Agente Indígena de Saúde");
    await clicar(botao("conferir-retificacao-do-quadro"));
    await esperar();
    expect(payloads(salvar)[0]?.linhas[2]).toEqual({
      cargo: "Agente Indígena de Saúde",
      lotacao: "Polo Base Alfa",
      modalidades: { "Ampla Concorrência": 1 },
      vagas_imediatas: 1,
      cadastro_reserva: false,
      origem: "MANUAL",
    });
    expect(
      document.querySelector('[data-previa="antes"]')?.textContent,
    ).toContain("Linha nova");
    const vaga = document.querySelector(
      '[data-vagas-da-previa] tr[data-vaga="1003"]',
    );
    expect(vaga?.getAttribute("data-efeito")).toBe("passa");
    expect(vaga?.textContent).toContain("Passa a esta linha");
  });

  it("sem permissão ou sem o banco novo, o quadro só se mostra", () => {
    montar({ ...QUADRO, pode_editar: false }, vi.fn());
    expect(botao("editar-linha-do-quadro")).toBeNull();
    expect(botao("acrescentar-linha-do-quadro")).toBeNull();
    act(() => desmontar());
    montar({ ...QUADRO, historico: undefined }, vi.fn());
    expect(botao("editar-linha-do-quadro")).toBeNull();
    expect(texto()).toContain("Médico");
  });

  it("a falha da simulação aparece e não grava", async () => {
    const salvar = vi.fn(async () => {
      throw new Error("Sem permissão para este recurso");
    });
    montar(QUADRO, salvar);
    await clicar(botao("acrescentar-linha-do-quadro"));
    await digitar(campo("cargo"), "Psicólogo");
    await clicar(campo("cadastro-reserva"));
    await clicar(botao("conferir-retificacao-do-quadro"));
    await esperar();
    expect(texto()).toContain(
      "Não foi possível conferir: Sem permissão para este recurso",
    );
    expect(botao("gravar-retificacao-do-quadro")).toBeNull();
  });
});

bloco("componentes/vinculos-do-quadro", () => {
  /*
  A fila do vínculo vaga ↔ linha do quadro no quadro salvo do edital (20261118120000): as três
  situações, a equipe confirma ou marca "sem linha" pela RPC, e o edital sem vaga com código diz
  por quê, sem inventar vaga.
*/

  const L1 = { id: "l1", cargo: "Enfermeiro", lotacao: "Polo Base Alfa" };
  const L2 = { id: "l2", cargo: "Enfermeiro", lotacao: "Polo Base Beta" };

  const quadro = (
    vinculos: unknown[],
    extra: Record<string, unknown> = {},
  ) => ({
    linhas: [L1, L2],
    vagas_do_edital: "COM_CODIGO",
    pode_editar: true,
    vinculos,
    ...extra,
  });

  const AMBIGUA = {
    vaga: "1002",
    cargo: "Enfermeiro",
    situacao: "AMBIGUO",
    origem: "AUTOMATICO",
    regra: "NOME",
    candidatas: [L1, L2],
  };
  const CONFIRMADA = {
    vaga: "1001",
    cargo: "Enfermeiro - Polo Base Alfa",
    situacao: "CONFIRMADO",
    origem: "AUTOMATICO",
    regra: "NOME",
    quadro: "l1",
    cargo_quadro: "Enfermeiro",
    lotacao_quadro: "Polo Base Alfa",
  };

  let desmontar = () => {};
  afterEach(() => {
    act(() => desmontar());
    document.body.innerHTML = "";
  });

  function montar(inicial: unknown, estado: EstadoDosVinculos) {
    document.body.innerHTML = `<div id="raiz"></div>`;
    function Casca() {
      const [dados, setDados] = useState<unknown>(inicial);
      return createElement(VinculosDoQuadro, {
        estado,
        idEdital: "e1",
        dados,
        aoMudar: setDados,
      });
    }
    act(() => {
      ({ desmontar } = desenharNoTeste(
        document.getElementById("raiz")!,
        createElement(Casca),
      ));
    });
  }

  const texto = () => document.body.textContent ?? "";

  describe("VinculosDoQuadro", () => {
    it("resume as três situações e abre nas ambíguas", async () => {
      montar(quadro([CONFIRMADA, AMBIGUA]), { confirmar: () => true });
      await esperar();
      expect(texto()).toContain("1 confirmada · 1 ambígua · 0 ausentes");
      await clicar(document.getElementById("vinculosVer"));
      expect(document.querySelector('tr[data-vaga="1002"]')).not.toBeNull();
      expect(document.querySelector('tr[data-vaga="1001"]')).toBeNull();
      expect(texto()).toContain("2 linhas possíveis");
    });

    it("confirma a linha escolhida e mostra o quadro devolvido", async () => {
      const gravarVinculoDoQuadro = vi.fn(async () =>
        quadro([
          CONFIRMADA,
          {
            ...AMBIGUA,
            situacao: "CONFIRMADO",
            origem: "MANUAL",
            quadro: "l2",
            cargo_quadro: "Enfermeiro",
            lotacao_quadro: "Polo Base Beta",
          },
        ]),
      );
      montar(quadro([CONFIRMADA, AMBIGUA]), {
        confirmar: () => true,
        gravarVinculoDoQuadro,
      });
      await esperar();
      await clicar(document.getElementById("vinculosVer"));
      const linha = document.querySelector('tr[data-vaga="1002"]')!;
      await escolher(linha.querySelector("select"), "l2");
      const confirmar = [...linha.querySelectorAll("button")].find(
        (b) => b.textContent === "Confirmar",
      );
      await clicar(confirmar);
      await esperar();
      expect(gravarVinculoDoQuadro).toHaveBeenCalledWith(
        "e1",
        "1002",
        "CONFIRMAR",
        "l2",
      );
      expect(texto()).toContain("2 confirmadas · 0 ambíguas · 0 ausentes");
      expect(texto()).toContain("Vaga 1002 ligada à linha escolhida.");
    });

    it("'sem linha' pede confirmação antes de gravar", async () => {
      const gravarVinculoDoQuadro = vi.fn(async () => quadro([AMBIGUA]));
      const confirmar = vi.fn(() => false);
      montar(quadro([AMBIGUA]), { confirmar, gravarVinculoDoQuadro });
      await esperar();
      await clicar(document.getElementById("vinculosVer"));
      const sem = [...document.querySelectorAll("button")].find(
        (b) => b.textContent === "Sem linha",
      );
      await clicar(sem);
      expect(confirmar).toHaveBeenCalledWith(
        "A vaga 1002 não tem linha no quadro de vagas?",
      );
      expect(gravarVinculoDoQuadro).not.toHaveBeenCalled();
    });

    it("quem não edita só vê", async () => {
      montar(quadro([AMBIGUA], { pode_editar: false }), {
        confirmar: () => true,
        gravarVinculoDoQuadro: vi.fn(),
      });
      await esperar();
      await clicar(document.getElementById("vinculosVer"));
      expect(document.querySelector("tr[data-vaga] select")).toBeNull();
      expect(document.getElementById("vinculosAtualizar")).toBeNull();
    });

    it("banco antes da migration (sem vagas_do_edital): a fila não aparece", async () => {
      montar(
        {
          linhas: [L1],
          vinculos: [{ vaga: "1", cargo: "Enfermeiro", quadro: null }],
        },
        { confirmar: () => true },
      );
      await esperar();
      expect(texto()).toBe("");
    });

    it("edital sem vaga com código: o motivo, sem vaga inventada", async () => {
      montar(quadro([], { vagas_do_edital: "EXTERNO" }), {
        confirmar: () => true,
      });
      await esperar();
      expect(texto()).toContain("Externo: vagas de outra origem, sem código.");
      expect(document.getElementById("vinculosVer")).toBeNull();
    });
  });
});

bloco("modulos/pagina-do-edital", () => {
  /*
  A página do edital (src/modulos/pagina-do-edital/): o edital do endereço
  achado entre as linhas da área, o cabeçalho com a situação excepcional, as
  vagas, os candidatos, a linha do tempo e as retificações; o "Voltar" pela
  navegação. Dados fictícios.
*/

  const ID = "0b7c9a52-2d55-4c4e-9f7a-1c3d5e7f9a1b";
  const HOJE = new Date("2026-11-18T15:00:00Z");
  const LINHAS = [
    {
      id: ID,
      CO_AREA: "saude-indigena",
      edital: "Edital nº 105/2026",
      unidade: "DSEI Fictício",
      status: "Suspenso",
      vagas_total: 70,
      contratados: 0,
      data_inicio: "2026-10-01",
      data_fim: "2026-12-20",
      link_edital: "https://exemplo.org/edital-105.pdf",
    },
    {
      id: "outro",
      CO_AREA: "saude-indigena",
      edital: "Edital 120/2026",
      unidade: "DSEI A",
    },
    {
      id: "outro-2",
      CO_AREA: "saude-indigena",
      edital: "Edital 120/2026",
      unidade: "DSEI B",
    },
  ];
  const CRONOGRAMA = {
    monitoramento: {
      id: ID,
      status_override: "Suspenso",
      status_override_motivo: "Decisão judicial",
      status_override_data: "2026-11-05",
      cronograma_origem: "PDF",
    },
    estado: { status: "Suspenso", etapa: "Inscrições" },
    etapas: [
      {
        ordem: 1,
        atividade: "Publicação do edital",
        data_inicio: "2026-10-01",
      },
      {
        ordem: 2,
        atividade: "Inscrições",
        data_inicio: "2026-10-02",
        data_fim: "2026-11-30",
      },
      { ordem: 3, atividade: "Resultado final", data_inicio: "2026-12-20" },
    ],
    historico: [
      {
        acao: "errata",
        numero_errata: "Errata nº 1",
        motivo: "SEI 00000.000000/2026-00",
        total_alteracoes: 2,
        created_at: "2026-10-20T13:00:00Z",
      },
    ],
  };

  const QUADRO = {
    linhas: [
      {
        id: "q1",
        cargo: "Enfermeiro",
        lotacao: "Polo Base Fictício",
        modalidades: { Ampla: 3, PcD: 1 },
        vagas_imediatas: 4,
        cadastro_reserva: true,
      },
    ],
    origem: { tipo: "PDF", arquivo: "anexos-105.pdf", gravado_em: null },
    vinculos: [
      {
        vaga: "V1",
        cargo: "ENFERMEIRO - POLO FICTÍCIO",
        situacao: "CONFIRMADO",
        origem: "AUTOMATICO",
        regra: "NOME",
        quadro: "q1",
        cargo_quadro: "Enfermeiro",
        lotacao_quadro: "Polo Base Fictício",
      },
      {
        vaga: "V2",
        cargo: "TÉCNICO DE ENFERMAGEM",
        situacao: "AMBIGUO",
        origem: "AUTOMATICO",
        candidatas: [
          { id: "q1", cargo: "Enfermeiro", lotacao: null },
          { id: "q2", cargo: "Técnico", lotacao: null },
        ],
      },
    ],
    vagas_do_edital: "COM_CODIGO",
    pode_editar: false,
  };

  function clienteFalso(quadro = QUADRO) {
    const rpc = vi.fn(async (nome: string) =>
      nome === "obter_quadro_de_vagas"
        ? { data: quadro, error: null }
        : { data: CRONOGRAMA, error: null },
    );
    return {
      auth: {
        getSession: async () => ({
          data: { session: { access_token: "token" } },
          error: null,
        }),
      },
      rpc,
    };
  }

  function navegacaoFalsa(mudancas: Partial<EstadoDaNavegacao>) {
    const estado: EstadoDaNavegacao = {
      ...ESTADO_INICIAL_DA_NAVEGACAO,
      view: "edital",
      area: "saude-indigena",
      ...mudancas,
    };
    const voltarDaPaginaDoEdital = vi.fn(() => true);
    const navegacao: LeituraDaNavegacao = {
      obter: () => estado,
      assinar: () => () => {},
      esquecerEditalEVisao: () => {},
      abrirRegrasDoEdital: () => false,
      fecharRegrasDoEdital: () => {},
      voltarDaPaginaDoEdital,
      irParaInicio: () => {},
    };
    return { navegacao, voltarDaPaginaDoEdital };
  }

  let desmontar: (() => void) | null = null;

  async function montar(
    edital: string,
    {
      retorno = null,
      quadro = QUADRO,
      acompanhamento = {
        listas: [
          {
            monitoramento_id: ID,
            aprovados: 30,
            com_status: 18,
            desistentes: 3,
          },
        ],
      },
    }: {
      retorno?: EstadoDaNavegacao["retorno"];
      quadro?: typeof QUADRO;
      acompanhamento?: unknown;
    } = {},
  ) {
    const cliente = clienteFalso(quadro);
    const buscarAcompanhamento = vi.fn(async () => acompanhamento);
    const estado = criarEstadoDaPaginaDoEdital({
      supabase: cliente,
      buscarAcompanhamento,
    });
    const { navegacao, voltarDaPaginaDoEdital } = navegacaoFalsa({
      edital,
      retorno,
    });
    const elemento = document.createElement("section");
    document.body.append(elemento);
    const desenho = desenharNoTeste(
      elemento,
      createElement(
        ContextoDoApp.Provider,
        { value: { navegacao, avisar, pecas: null } },
        createElement(PaginaDoEdital, { estado, agora: () => HOJE }),
      ),
    );
    desmontar = desenho.desmontar;
    await esperar(() => new Promise((resolver) => setTimeout(resolver, 0)));
    return { elemento, cliente, buscarAcompanhamento, voltarDaPaginaDoEdital };
  }

  beforeEach(() => {
    act(() => {
      definirAreasDoUsuario(["saude-indigena"]);
      definirAreaAtual("saude-indigena");
      publicarLinhasDoMonitoramento(LINHAS);
    });
  });
  afterEach(() => {
    desmontar?.();
    desmontar = null;
    redefinirDadosDoMonitoramento();
    document.body.innerHTML = "";
  });

  describe("a página do edital", () => {
    it("confere o quadro no Resumo e identifica edital somente de cadastro reserva", async () => {
      act(() =>
        publicarLinhasDoMonitoramento(
          LINHAS.map((linha) => ({ ...linha, vagas_total: 0, contratados: 2 })),
        ),
      );
      const { elemento, cliente } = await montar("105-2026", {
        quadro: {
          ...QUADRO,
          linhas: QUADRO.linhas.map((linha) => ({
            ...linha,
            vagas_imediatas: 0,
          })),
        },
      });
      await vi.waitFor(() =>
        expect(elemento.textContent).toContain("Somente cadastro reserva"),
      );
      expect(cliente.rpc).toHaveBeenCalledWith("obter_quadro_de_vagas", {
        p_edital: ID,
      });
      expect(elemento.textContent).toContain("Sem vagas imediatas");
      expect(elemento.textContent).not.toContain("0 de 0 preenchidas");
      expect(elemento.textContent).toContain(
        "Contratações do cadastro reserva",
      );
      expect(elemento.textContent).not.toContain("Imediatas sem contratação");
    });

    it("acha o edital pelo número e mostra cabeçalho, vagas, candidatos e linha do tempo", async () => {
      const { elemento, cliente } = await montar("105-2026");
      const texto = elemento.textContent || "";
      expect(elemento.querySelector("h2")?.textContent).toBe(
        "Edital nº 105/2026",
      );
      expect(texto).toContain("DSEI Fictício");
      expect(texto).toContain(
        "Edital suspenso desde 05/11/2026: Decisão judicial",
      );
      expect(cliente.rpc).toHaveBeenCalledWith("get_monitoramento_cronograma", {
        p_monitoramento_id: ID,
      });
      // Vagas: 0 de 70.
      expect(
        elemento.querySelector('[title="0 de 70 preenchidas"]'),
      ).not.toBeNull();
      // Candidatos: 30 aprovados, 12 aguardando, 15 nas demais (3 desistentes à parte).
      expect(texto).toContain("Aguardando chamada");
      expect(texto).toContain("3 desistentes à parte");
      // Resumo: o andamento (a etapa atual e a próxima prevista).
      const marcas = () =>
        [...elemento.querySelectorAll("[data-marca]")].map((li) => [
          li.querySelector("strong")?.textContent,
          li.getAttribute("data-marca"),
        ]);
      expect(marcas()).toEqual([
        ["Inscrições", "atual"],
        ["Resultado final", "prevista"],
      ]);
      // Aba Etapas: a linha do tempo inteira, pelas datas de hoje.
      await clicar(elemento.querySelector('[role="tab"][data-aba="etapas"]'));
      expect(
        elemento.querySelector('[role="tab"][aria-selected="true"]')
          ?.textContent,
      ).toBe("Etapas");
      const etapas = marcas();
      expect(etapas).toEqual([
        ["Publicação do edital", "concluida"],
        ["Inscrições", "atual"],
        ["Resultado final", "prevista"],
      ]);
      expect(
        elemento.querySelector('[aria-current="step"] strong')?.textContent,
      ).toBe("Inscrições");
      // A retificação do histórico.
      expect(elemento.textContent).toContain("Errata nº 1");
      expect(elemento.textContent).toContain("SEI 00000.000000/2026-00");
      // O edital publicado (link da linha).
      expect(
        elemento.querySelector<HTMLAnchorElement>(
          'a[href^="https://exemplo.org"]',
        )?.textContent,
      ).toContain("Edital publicado");
    });

    it("Vagas e cargos: o quadro, só quando a aba abre, com o vínculo de cada vaga", async () => {
      const { elemento, cliente } = await montar("105-2026");
      expect(cliente.rpc).not.toHaveBeenCalledWith(
        "obter_quadro_de_vagas",
        expect.anything(),
      );
      await clicar(elemento.querySelector('[role="tab"][data-aba="vagas"]'));
      await esperar(() => new Promise((resolver) => setTimeout(resolver, 0)));
      expect(cliente.rpc).toHaveBeenCalledWith("obter_quadro_de_vagas", {
        p_edital: ID,
      });
      const celulas = [
        ...elemento.querySelectorAll(".pagina-do-edital-tabela tbody td"),
      ].map((td) => td.textContent);
      expect(celulas).toEqual([
        "Enfermeiro",
        "Polo Base Fictício",
        "4",
        "Sim",
        "Ampla: 3 · PcD: 1",
      ]);
      const texto = elemento.textContent || "";
      expect(texto).toContain("1 confirmada · 1 ambígua · 0 ausentes");
      expect(texto).toContain("Ambíguas (1)");
      expect(texto).toContain("2 linhas possíveis");
    });

    it("Candidatos: abre as telas da seleção já no edital (só as que o perfil abre)", async () => {
      const navigate = vi.fn(() => true);
      vi.stubGlobal("navigate", navigate);
      vi.stubGlobal("getMonitoraProfile", () => ({
        id: "p",
        ativo: true,
        permissoes: { selecao: "leitor", classificacao: "leitor" },
      }));
      const { elemento } = await montar("105-2026");
      await clicar(
        elemento.querySelector('[role="tab"][data-aba="candidatos"]'),
      );
      const telas = [...elemento.querySelectorAll("[data-tela]")].map((b) =>
        b.getAttribute("data-tela"),
      );
      expect(telas).toEqual(["selecao", "classificacao"]);
      await clicar(elemento.querySelector('[data-tela="classificacao"]'));
      expect(navigate).toHaveBeenLastCalledWith("classificacao", {
        edital: ID,
      });
      // A Seleção recorta pelo número: vai num pedido de filtro.
      await clicar(elemento.querySelector('[data-tela="selecao"]'));
      expect(navigate).toHaveBeenLastCalledWith("selecao");
      expect(consumirPedidoDeFiltro("selecao")).toEqual({
        edital: "105/2026",
        editalId: ID,
      });
      vi.unstubAllGlobals();
    });

    it("Fontes e histórico: de onde vem cada dado e o histórico do cronograma", async () => {
      const { elemento } = await montar("105-2026");
      await clicar(elemento.querySelector('[role="tab"][data-aba="fontes"]'));
      await esperar(() => new Promise((resolver) => setTimeout(resolver, 0)));
      const texto = elemento.textContent || "";
      expect(texto).toContain("importado do PDF de anexos");
      expect(texto).toContain("PDF de anexos · anexos-105.pdf");
      expect(texto).toContain("Histórico do cronograma");
      expect(texto).toContain("1 registro");
    });

    it("o Voltar diz para onde volta e chama a navegação", async () => {
      const { elemento, voltarDaPaginaDoEdital } = await montar("105-2026", {
        retorno: {
          view: "calendario",
          titulo: "Cronograma",
          edital: "105-2026",
        },
      });
      const voltar = elemento.querySelector<HTMLButtonElement>(
        ".pagina-do-edital-voltar",
      );
      expect(voltar?.textContent).toContain("Voltar para Cronograma");
      await clicar(voltar);
      expect(voltarDaPaginaDoEdital).toHaveBeenCalledTimes(1);
    });

    it("dois editais com o mesmo número: a escolha leva ao endereço de cada um", async () => {
      const navigate = vi.fn(() => true);
      vi.stubGlobal("navigate", navigate);
      const { elemento } = await montar("120-2026");
      const botoes = [
        ...elemento.querySelectorAll(".pagina-do-edital-escolha button"),
      ];
      expect(botoes.map((b) => b.textContent)).toEqual([
        "Edital 120/2026 · DSEI A",
        "Edital 120/2026 · DSEI B",
      ]);
      await clicar(botoes[1]);
      expect(navigate).toHaveBeenCalledWith("edital", { edital: "outro-2" });
      vi.unstubAllGlobals();
    });

    it("edital que não é da área: avisa sem pedir nada ao banco", async () => {
      const { elemento, cliente } = await montar("7-2030");
      expect(elemento.textContent).toContain("Edital 7/2030 não encontrado");
      expect(cliente.rpc).not.toHaveBeenCalled();
    });
  });

  describe("pela rota, sem a Visão geral ter carregado", () => {
    /* O banco inteiro que a página usa: cronograma, acompanhamento e avisos. */
    function bancoDaPagina() {
      const rpc = vi.fn(async (nome: string, _parametros?: unknown) => {
        if (nome === "get_monitoramento_cronograma")
          return { data: CRONOGRAMA, error: null };
        if (nome === "listar_acompanhamento_da_visao_geral_se_mudou")
          return {
            data: {
              versao: "v1",
              listas: [
                {
                  monitoramento_id: ID,
                  aprovados: 30,
                  com_status: 18,
                  desistentes: 3,
                },
              ],
            },
            error: null,
          };
        if (nome === "listar_avisos_conferencia_se_mudou")
          return { data: { avisos: [] }, error: null };
        return { data: [], error: null };
      });
      return {
        auth: {
          getSession: async () => ({
            data: { session: { access_token: "token" } },
            error: null,
          }),
        },
        rpc,
      };
    }

    it("abre por /saude-indigena/edital/105-2026 e lê candidatos e etapas sozinha", async () => {
      // A aba guardada por outro teste não vale aqui: a página abre no Resumo.
      sessionStorage.clear();
      history.replaceState(null, "", "/saude-indigena/edital/105-2026");
      const banco = bancoDaPagina();
      const pagina = criarPaginaDoEdital({
        supabase: banco,
        agora: () => HOJE,
      });
      const navegacao = criarNavegacao({
        janela: { location: { reload() {} } },
        obterPerfil: () => ({
          id: "g",
          ativo: true,
          perfil: "edital_gestor",
          areas: ["saude-indigena"],
        }),
        confirmarSaida: () => true,
        aplicarAtualizacao: () => false,
      });
      const montado = montarTelasNoTeste(navegacao, { edital: pagina });
      desmontar = () => montado.desmontar();
      act(() => navegacao.abrirEntrada());
      const secao = () => document.getElementById("page-edital");
      // Candidatos: os números da lista vigente, sem esqueleto.
      await vi.waitFor(() =>
        expect(
          secao()?.querySelectorAll('.ui-kpi[aria-busy="true"]').length,
        ).toBe(0),
      );
      expect(banco.rpc).toHaveBeenCalledWith(
        "listar_acompanhamento_da_visao_geral_se_mudou",
        expect.objectContaining({ p_area: "saude-indigena" }),
      );
      expect(secao()?.textContent).toContain("Aguardando chamada");
      expect(secao()?.textContent).toContain(
        "Contratações além das vagas imediatas",
      );
      expect(secao()?.textContent).toContain("3 desistentes à parte");
      /* Uma leitura de cada por abertura: o render() do registro não repete o
         que os efeitos da tela acabaram de pedir (auditoria de 26/11/2026, #4). */
      const pedidos = banco.rpc.mock.calls.map(([nome, parametros]) =>
        JSON.stringify([nome, parametros]),
      );
      expect(pedidos.length).toBeGreaterThan(0);
      expect(pedidos.filter((p, i) => pedidos.indexOf(p) !== i)).toEqual([]);
      // Etapas: a linha do tempo, sem esqueleto.
      await clicar(secao()?.querySelector('[role="tab"][data-aba="etapas"]'));
      await vi.waitFor(() =>
        expect(secao()?.querySelectorAll("[data-marca]").length).toBe(3),
      );
      expect(secao()?.querySelector('[aria-busy="true"]')).toBeNull();
    });
  });

  describe("abrir a página do edital", () => {
    it("vai pelo número do edital (ou pelo id, se o número se repete)", () => {
      const navigate = vi.fn(() => true);
      expect(abrirPaginaDoEdital(LINHAS[0]!, LINHAS, { navigate })).toBe(true);
      expect(navigate).toHaveBeenLastCalledWith("edital", {
        edital: "105-2026",
      });
      abrirPaginaDoEdital(LINHAS[1]!, LINHAS, { navigate });
      expect(navigate).toHaveBeenLastCalledWith("edital", { edital: "outro" });
      expect(abrirPaginaDoEdital(LINHAS[0]!, LINHAS, {})).toBe(false);
    });
  });
});
