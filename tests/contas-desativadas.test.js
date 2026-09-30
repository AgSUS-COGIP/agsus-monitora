import { describe, expect, it } from "vitest";
import {
  MOTIVO_NAO_REGISTRADO,
  argumentosDaReativacao,
  contasDaResposta,
  errosDaReativacao,
  grupoInicialDoPedido,
  linhaDaDesativacao,
  linhaDoPedidoDeReativacao,
  mensagemDaRecusaDeReativacao,
  mensagemDeContaReativada,
  motivoDaDesativacao,
  resumoDeContas,
  valoresIniciaisDaReativacao,
} from "../src/lib/contas-desativadas.js";

/*
  Contas desativadas: desativar fazia a conta sumir, sem reativar e sem o
  motivo. Agora a aba "Desativadas" diz quando, por quem e por quê, e
  reativa com as mesmas travas do banco (23514).
*/

const GRUPOS = [
  { codigo: "usuario", nome: "Usuário", niveis: { acessos: "sem_acesso" } },
  { codigo: "coordenador", nome: "Coordenador", niveis: { acessos: "editor" } },
  { codigo: "admin", nome: "Administrador", admin_global: true, niveis: {} },
];

const CONTA = {
  id: "p1",
  nome: "Ana",
  email: "ana@agenciasus.org.br",
  grupo: "coordenador",
  coordenacao: "norte",
  areas: ["saude-indigena"],
  desativada_em: "2026-09-30T15:00:00Z",
  desativada_por: "adm@agenciasus.org.br",
  motivo: "Saiu da equipe",
};

describe("lista de contas desativadas", () => {
  it("resposta vira lista, mesmo vazia ou estranha", () => {
    expect(contasDaResposta({ contas: [CONTA] })).toEqual([CONTA]);
    expect(contasDaResposta({ ok: true })).toEqual([]);
    expect(contasDaResposta(null)).toEqual([]);
  });

  it("quando e por quem; sem autor, sem 'por'", () => {
    expect(linhaDaDesativacao(CONTA)).toBe(
      "Desativada em 30/09/2026 por adm@agenciasus.org.br",
    );
    expect(linhaDaDesativacao({ ...CONTA, desativada_por: null })).toBe(
      "Desativada em 30/09/2026",
    );
  });

  it("motivo, ou 'motivo não registrado' nas antigas", () => {
    expect(motivoDaDesativacao(CONTA)).toBe("Saiu da equipe");
    expect(motivoDaDesativacao({ ...CONTA, motivo: null })).toBe(
      MOTIVO_NAO_REGISTRADO,
    );
    expect(MOTIVO_NAO_REGISTRADO).toBe("motivo não registrado");
  });

  it("resumo: '23 ativas · 2 desativadas' e singular", () => {
    expect(resumoDeContas({ ativas: 23, desativadas: 2 })).toBe(
      "23 ativas · 2 desativadas",
    );
    expect(resumoDeContas({ ativas: 1, desativadas: 1 })).toBe(
      "1 ativa · 1 desativada",
    );
    expect(resumoDeContas({ ativas: 1200, desativadas: null })).toBe(
      "1.200 ativas",
    );
  });
});

describe("reativação", () => {
  it("começa com o grupo, a coordenação e as áreas de antes", () => {
    expect(valoresIniciaisDaReativacao(CONTA, GRUPOS)).toEqual({
      grupo: "coordenador",
      coordenacao: "norte",
      areas: ["saude-indigena"],
      motivo: "",
    });
    // Grupo que não existe mais: volta para "usuario".
    expect(
      valoresIniciaisDaReativacao({ ...CONTA, grupo: "sumiu" }, GRUPOS).grupo,
    ).toBe("usuario");
  });

  it("travas: sem área e sem coordenação; quem gerencia acessos sem coordenação; motivo", () => {
    const base = { grupo: "usuario", coordenacao: "", areas: [], motivo: "" };
    expect(errosDaReativacao(base, GRUPOS)).toMatchObject({
      semArea: true,
      motivo: expect.stringContaining("motivo"),
    });
    expect(
      errosDaReativacao(
        { ...base, areas: ["saude-indigena"], motivo: "Voltou" },
        GRUPOS,
      ),
    ).toEqual({});
    expect(
      errosDaReativacao(
        {
          ...base,
          grupo: "coordenador",
          areas: ["saude-indigena"],
          motivo: "Voltou",
        },
        GRUPOS,
      ),
    ).toEqual({ semCoordenacao: true });
    expect(
      errosDaReativacao(
        {
          ...base,
          grupo: "coordenador",
          coordenacao: "norte",
          motivo: "Voltou",
        },
        GRUPOS,
      ),
    ).toEqual({});
    // Administrador global não precisa de área nem de coordenação.
    expect(
      errosDaReativacao({ ...base, grupo: "admin", motivo: "Voltou" }, GRUPOS),
    ).toEqual({});
    expect(
      errosDaReativacao(
        { ...base, grupo: "admin", motivo: "x".repeat(501) },
        GRUPOS,
      ).motivo,
    ).toBeTruthy();
  });

  it("argumentos: admin sem coordenação/áreas; com coordenação, sem áreas", () => {
    expect(
      argumentosDaReativacao(
        CONTA,
        {
          grupo: "usuario",
          coordenacao: "",
          areas: ["saude-indigena"],
          motivo: " Voltou ",
        },
        GRUPOS,
      ),
    ).toEqual({
      p_perfil_usuario_id: "p1",
      p_grupo: "usuario",
      p_coordenacao: null,
      p_areas: ["saude-indigena"],
      p_motivo: "Voltou",
    });
    expect(
      argumentosDaReativacao(
        CONTA,
        {
          grupo: "coordenador",
          coordenacao: "norte",
          areas: ["x"],
          motivo: "Voltou",
        },
        GRUPOS,
      ),
    ).toMatchObject({ p_coordenacao: "norte", p_areas: [] });
    expect(
      argumentosDaReativacao(
        CONTA,
        { grupo: "admin", coordenacao: "norte", areas: ["x"], motivo: "V1" },
        GRUPOS,
      ),
    ).toMatchObject({ p_grupo: "admin", p_coordenacao: null, p_areas: [] });
  });

  it("recusas do banco: 23514 e 22023 com a mensagem dele; 42501 explicada", () => {
    expect(
      mensagemDaRecusaDeReativacao({
        code: "23514",
        message: "Sem coordenação, escolha ao menos uma área",
      }),
    ).toBe("Sem coordenação, escolha ao menos uma área");
    expect(mensagemDaRecusaDeReativacao({ code: "42501", message: "x" })).toBe(
      "Só o administrador global pode reativar contas.",
    );
    expect(
      mensagemDaRecusaDeReativacao({
        code: "22023",
        message: "Esta conta já está ativa",
      }),
    ).toBe("Esta conta já está ativa");
  });

  it("toast com o nome", () => {
    expect(mensagemDeContaReativada(CONTA)).toBe(
      "Conta reativada. Na próxima entrada, Ana verá as boas-vindas de volta.",
    );
    expect(mensagemDeContaReativada({ email: "b@x.org" })).toContain("b@x.org");
  });
});

describe("pedido de reativação em Pendentes", () => {
  const PEDIDO = {
    reativacao: true,
    desativada_em: "2026-09-30T15:00:00Z",
    desativada_por: "adm@agenciasus.org.br",
    motivo_desativacao: "Saiu da equipe",
    grupo_anterior: "coordenador",
  };

  it("linha: quando, por quem e o motivo", () => {
    expect(linhaDoPedidoDeReativacao(PEDIDO)).toBe(
      "Desativada em 30/09 por adm@agenciasus.org.br · motivo: Saiu da equipe",
    );
    expect(
      linhaDoPedidoDeReativacao({
        ...PEDIDO,
        desativada_por: null,
        motivo_desativacao: null,
      }),
    ).toBe("Desativada em 30/09 · motivo: motivo não registrado");
  });

  it("grupo do Aprovar: o de antes, se quem aprova pode atribuir", () => {
    expect(grupoInicialDoPedido(PEDIDO, GRUPOS)).toBe("coordenador");
    expect(grupoInicialDoPedido(PEDIDO, GRUPOS.slice(0, 1))).toBe("usuario");
    expect(grupoInicialDoPedido({ grupo_anterior: "admin" }, GRUPOS)).toBe(
      "usuario",
    );
  });
});
