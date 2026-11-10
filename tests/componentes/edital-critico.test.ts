import { act, createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  erroDoMotivoDoCritico,
  motivosDeAtencao,
} from "../../src/lib/criticos-da-visao-geral.ts";
import {
  acompanhamentoDaResposta,
  enriquecerLinhas,
} from "../../src/lib/visao-geral.ts";
import {
  buscarAcompanhamentoNoSupabase,
  RPC_ACOMPANHAMENTO,
  RPC_CRITICOS_MANUAIS,
} from "../../src/modulos/visao-geral/estado.ts";
import type { ClienteDoAcompanhamento } from "../../src/modulos/visao-geral/tipos.ts";
import {
  CriticoDoEdital,
  lerCriticoDoEdital,
} from "../../src/modulos/editais/critico-do-edital.tsx";
import type { ClienteDoCritico } from "../../src/modulos/editais/critico-do-edital.tsx";
import { clicar, digitar, esperar } from "./interacoes.ts";
import { desenharNoTeste } from "../montar-tela.ts";

/*
  Edital crítico marcado à mão (20261110150000): gestor, coordenador ou
  administrador global marca o edital como crítico, com motivo; a Visão geral
  conta a marcação junto com os motivos automáticos. Quem pode marcar o banco
  decide (`pode_marcar`).
*/

const HOJE = "2026-11-10";
const aberto = (extra: Record<string, unknown> = {}) => ({
  id: "e1",
  status: "Em andamento",
  etapa: "Entrevistas",
  inscritos: 100,
  vagas_total: 10,
  contratados: 0,
  data_fim: "2026-12-01",
  ...extra,
});

describe("a regra: marcação manual conta como crítico", () => {
  it("edital sem motivo automático fica crítico só pela marcação, com quem marcou", () => {
    expect(motivosDeAtencao(aberto(), { hoje: HOJE })).toEqual([]);
    const motivos = motivosDeAtencao(aberto(), {
      hoje: HOJE,
      marcacao: { motivo: "Banca sem quórum", quem: "Ana Souza" },
    });
    expect(motivos).toEqual([
      {
        codigo: "marcado",
        rotulo: "Marcado como crítico por Ana Souza: Banca sem quórum",
        tom: "perigo",
      },
    ]);
  });

  it("a marcação vem primeiro e os motivos automáticos continuam", () => {
    const codigos = motivosDeAtencao(aberto({ data_fim: "2026-11-01" }), {
      hoje: HOJE,
      marcacao: { motivo: "Banca sem quórum" },
    }).map((m) => m.codigo);
    expect(codigos).toEqual(["marcado", "atrasada"]);
  });

  it("edital concluído marcado também é crítico; cancelado nunca", () => {
    const concluido = aberto({ status: "Concluído", contratados: 10 });
    expect(
      motivosDeAtencao(concluido, {
        hoje: HOJE,
        marcacao: { motivo: "Contratação judicializada" },
      }).map((m) => m.codigo),
    ).toEqual(["marcado"]);
    expect(
      motivosDeAtencao(aberto({ status: "Cancelado" }), {
        hoje: HOJE,
        marcacao: { motivo: "Qualquer motivo" },
      }),
    ).toEqual([]);
  });

  it("o motivo segue a regra do banco: 10 a 500 caracteres e 2 palavras", () => {
    expect(erroDoMotivoDoCritico("curto")).toMatch(/10 a 500/);
    expect(erroDoMotivoDoCritico("x".repeat(501))).toMatch(/10 a 500/);
    expect(erroDoMotivoDoCritico("aaaaaaaaaaaa")).toMatch(/2 palavras/);
    expect(erroDoMotivoDoCritico("Banca sem quórum")).toBe("");
  });
});

describe("a Visão geral lê a marcação junto com o acompanhamento", () => {
  it("criticos_manuais vira a marcação de cada edital", () => {
    const acompanhamento = acompanhamentoDaResposta({
      etapas: [],
      listas: [],
      criticos_manuais: [
        {
          monitoramento_id: "e1",
          motivo: "Banca sem quórum",
          quem: "Ana Souza",
          quando: "2026-11-10T13:00:00Z",
        },
        { monitoramento_id: "e2", motivo: "" },
      ],
    });
    const [e1, e2] = enriquecerLinhas([aberto(), aberto({ id: "e2" })], {
      hoje: HOJE,
      acompanhamento,
    });
    expect(e1?.atencao.map((m) => m.codigo)).toEqual(["marcado"]);
    expect(e2?.atencao).toEqual([]);
  });

  function cliente(criticos: { data: unknown; error: unknown }) {
    const rpc = vi.fn(async (nome: string, _parametros?: object) =>
      nome === RPC_ACOMPANHAMENTO
        ? { data: { versao: "v1", etapas: [], listas: [] }, error: null }
        : criticos,
    );
    // Uma função com parâmetros mais largos serve às duas assinaturas do cliente.
    const supabase: ClienteDoAcompanhamento = { rpc };
    return { supabase, rpc };
  }

  it("busca as duas leituras da área e junta a marcação ao pacote", async () => {
    const { supabase, rpc } = cliente({
      data: [{ monitoramento_id: "e1", motivo: "Banca sem quórum" }],
      error: null,
    });
    const pacote = await buscarAcompanhamentoNoSupabase(supabase)("projetos");
    expect(rpc).toHaveBeenCalledWith(RPC_CRITICOS_MANUAIS, {
      p_area: "projetos",
    });
    expect(pacote).toMatchObject({
      versao: "v1",
      criticos_manuais: [{ monitoramento_id: "e1" }],
    });
  });

  it("sem mudança, o mesmo objeto; marcação nova, objeto novo", async () => {
    let marcados: unknown[] = [];
    const rpc = vi.fn(async (nome: string, _parametros?: object) =>
      nome === RPC_ACOMPANHAMENTO
        ? { data: { inalterado: true, versao: "v1" }, error: null }
        : { data: marcados, error: null },
    );
    const supabase: ClienteDoAcompanhamento = { rpc };
    const respostas = [
      { data: { versao: "v1", etapas: [], listas: [] }, error: null },
    ];
    rpc.mockImplementationOnce(async () => respostas[0]!);
    const buscar = buscarAcompanhamentoNoSupabase(supabase);
    const primeiro = await buscar("area-da-marcacao");
    expect(await buscar("area-da-marcacao")).toBe(primeiro);
    marcados = [{ monitoramento_id: "e1", motivo: "Banca sem quórum" }];
    const depois = await buscar("area-da-marcacao");
    expect(depois).not.toBe(primeiro);
    expect(depois).toMatchObject({ criticos_manuais: marcados });
  });

  it("se a leitura da marcação falhar, a Visão geral segue sem ela", async () => {
    const { supabase } = cliente({ data: null, error: { code: "PGRST202" } });
    const pacote = await buscarAcompanhamentoNoSupabase(supabase)("sede");
    expect(pacote).toMatchObject({ versao: "v1", criticos_manuais: [] });
  });
});

describe("o bloco Edital crítico no formulário do edital", () => {
  function clienteDoCritico(inicial: Record<string, unknown>) {
    let estado = { ...inicial };
    const rpc = vi.fn(
      async (
        nome: string,
        argumentos: {
          p_edital?: string;
          p_critico?: boolean;
          p_motivo?: string;
        } = {},
      ) => {
        if (nome === "obter_critico_do_edital")
          return { data: estado, error: null };
        if (nome === "marcar_edital_critico") {
          estado = argumentos.p_critico
            ? {
                ...estado,
                marcado: true,
                motivo: argumentos.p_motivo,
                quem: "Ana Souza",
                quando: "2026-11-10T13:00:00Z",
              }
            : { ...estado, marcado: false, motivo: null, quem: null };
          return { data: estado, error: null };
        }
        return { data: null, error: { code: "PGRST202" } };
      },
    );
    const cliente: ClienteDoCritico = { rpc };
    return Object.assign(cliente, { rpc });
  }

  let desmontar = () => {};
  afterEach(() => desmontar());
  const $ = (id: string) => document.getElementById(id);

  async function desenhar(supabase: ClienteDoCritico) {
    document.body.innerHTML = `<div id="raiz"></div>`;
    await act(async () => {
      ({ desmontar } = desenharNoTeste(
        $("raiz"),
        createElement(CriticoDoEdital, { editalId: "e1", supabase }),
      ));
    });
    await esperar();
  }

  it("quem não pode marcar e o edital não está marcado: o bloco não aparece", async () => {
    await desenhar(clienteDoCritico({ marcado: false, pode_marcar: false }));
    expect($("editalCritico")).toBeNull();
  });

  it("quem não pode marcar lê a marcação, sem botões", async () => {
    await desenhar(
      clienteDoCritico({
        marcado: true,
        motivo: "Banca sem quórum",
        quem: "Ana Souza",
        quando: "2026-11-10T13:00:00Z",
        pode_marcar: false,
      }),
    );
    expect($("editalCriticoMarcado")?.textContent).toBe(
      "Marcado como crítico por Ana Souza em 10/11/2026: Banca sem quórum",
    );
    expect($("editalCriticoMarcar")).toBeNull();
  });

  it("gestor marca com motivo; sem motivo válido, não grava", async () => {
    const supabase = clienteDoCritico({ marcado: false, pode_marcar: true });
    await desenhar(supabase);
    await clicar($("editalCriticoMarcar"));
    expect(
      supabase.rpc.mock.calls.filter(
        ([nome]) => nome === "marcar_edital_critico",
      ),
    ).toHaveLength(0);
    expect($("editalCritico")?.textContent).toMatch(/10 a 500/);

    await digitar($("editalCriticoMotivo"), "Banca sem quórum");
    await clicar($("editalCriticoMarcar"));
    await esperar();
    expect(supabase.rpc).toHaveBeenCalledWith("marcar_edital_critico", {
      p_edital: "e1",
      p_critico: true,
      p_motivo: "Banca sem quórum",
    });
    expect($("editalCriticoMarcado")?.textContent).toContain(
      "Banca sem quórum",
    );
    expect($("editalCriticoDesmarcar")).not.toBeNull();
  });

  it("desmarcar também pede motivo", async () => {
    const supabase = clienteDoCritico({
      marcado: true,
      motivo: "Banca sem quórum",
      pode_marcar: true,
    });
    await desenhar(supabase);
    await digitar(
      $("editalCriticoMotivo"),
      "Banca recomposta pela coordenação",
    );
    await clicar($("editalCriticoDesmarcar"));
    await esperar();
    expect(supabase.rpc).toHaveBeenCalledWith("marcar_edital_critico", {
      p_edital: "e1",
      p_critico: false,
      p_motivo: "Banca recomposta pela coordenação",
    });
    expect($("editalCriticoMarcado")).toBeNull();
  });

  it("a leitura do banco aceita campos ausentes", () => {
    expect(lerCriticoDoEdital(null)).toEqual({
      marcado: false,
      motivo: "",
      quem: "",
      quando: "",
      podeMarcar: false,
    });
  });
});
