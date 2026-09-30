import { describe, expect, it, vi } from "vitest";
import {
  ASSUNTO_DO_CONVITE,
  copiarTexto,
  dataCurta,
  linkDoEmailDoConvite,
  mensagemDoConvite,
  situacaoDoAcesso,
} from "../src/lib/convite-de-acesso.js";
import {
  areasDaLinha,
  explicacaoDoGrupo,
  ficariaSemArea,
  linhaFicariaSemArea,
  pessoasSemAreaNoRascunho,
  registrarNoRascunho,
  ALVO_GRUPO,
} from "../src/lib/matriz-de-acessos.js";

/*
  Visão simples de Acessos: situação (convite pendente / último acesso),
  mensagem e mailto do convite, o grupo em uma frase e a trava "ficaria sem
  área" (espelho do 23514 de salvar_matriz_acessos).
*/

const ORIGEM = "https://monitora.agenciasus.org.br";

describe("situação do acesso", () => {
  it("convite pendente vence o resto", () => {
    expect(
      situacaoDoAcesso({
        convite_pendente: true,
        ultimo_acesso: "2026-09-01T12:00:00Z",
      }),
    ).toEqual({ tipo: "convite", rotulo: "Convidado · ainda não entrou" });
  });

  it("último acesso em dd/mm/aaaa, no horário de Brasília", () => {
    expect(
      situacaoDoAcesso({ ultimo_acesso: "2026-09-30T15:00:00Z" }).rotulo,
    ).toBe("Último acesso em 30/09/2026");
    // 01h UTC ainda é o dia anterior em Brasília.
    expect(dataCurta("2026-10-01T01:00:00Z")).toBe("30/09/2026");
  });

  it("sem data (ou data inválida) é 'Nunca'", () => {
    expect(situacaoDoAcesso({ ultimo_acesso: null })).toEqual({
      tipo: "nunca",
      rotulo: "Nunca",
    });
    expect(situacaoDoAcesso({ ultimo_acesso: "ontem" }).rotulo).toBe("Nunca");
    expect(situacaoDoAcesso(null).rotulo).toBe("Nunca");
  });
});

describe("mensagem do convite", () => {
  it("nome, endereço do sistema e a conta Google do e-mail", () => {
    expect(
      mensagemDoConvite({
        nome: "  Maria   Silva ",
        email: "maria@agenciasus.org.br",
        origem: `${ORIGEM}/`,
      }),
    ).toBe(
      `Olá, Maria Silva! Você foi convidado(a) para o MONITORA (AgSUS). Acesse ${ORIGEM} e entre com sua conta Google maria@agenciasus.org.br.`,
    );
    expect(mensagemDoConvite({ email: "x@y.z", origem: ORIGEM })).toMatch(
      /^Olá! /,
    );
  });

  it("mailto para o convidado, com assunto e corpo codificados", () => {
    const link = linkDoEmailDoConvite({
      nome: "João & Cia",
      email: "joao@agenciasus.org.br",
      origem: ORIGEM,
    });
    expect(link.startsWith("mailto:joao@agenciasus.org.br?subject=")).toBe(
      true,
    );
    const params = new URLSearchParams(link.slice(link.indexOf("?") + 1));
    expect(params.get("subject")).toBe(ASSUNTO_DO_CONVITE);
    expect(params.get("body")).toBe(
      mensagemDoConvite({
        nome: "João & Cia",
        email: "joao@agenciasus.org.br",
        origem: ORIGEM,
      }),
    );
    // "&" do nome não quebra os parâmetros.
    expect(link).not.toContain("João & Cia");
  });

  it("copia pela área de transferência; sem ela, pelo execCommand", async () => {
    const writeText = vi.fn(async () => {});
    expect(await copiarTexto("oi", { clipboard: { writeText } })).toBe(true);
    expect(writeText).toHaveBeenCalledWith("oi");

    const execCommand = vi.fn(() => true);
    const documento = {
      body: document.body,
      createElement: (tag) => document.createElement(tag),
      execCommand,
    };
    const negado = {
      writeText: vi.fn(async () => Promise.reject(new Error())),
    };
    expect(await copiarTexto("oi", { clipboard: negado, documento })).toBe(
      true,
    );
    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(document.querySelector("textarea")).toBeNull();

    expect(await copiarTexto("oi", { clipboard: null, documento: {} })).toBe(
      false,
    );
  });
});

const GRUPOS = [
  {
    codigo: "usuario",
    nome: "Usuário",
    niveis: {
      dashboard: "leitor",
      analises: "leitor",
      nucleo: "leitor",
      calendario: "leitor",
      aprovados: "leitor",
      entrevistas: "leitor",
      recursos: "leitor",
      importacao: "leitor",
      paineis: "leitor",
      configuracoes: "sem_acesso",
      acessos: "sem_acesso",
    },
  },
  {
    codigo: "coordenador",
    nome: "Coordenador",
    niveis: {
      dashboard: "leitor",
      nucleo: "editor",
      calendario: "editor",
      acessos: "editor",
    },
  },
  { codigo: "admin", nome: "Administrador", admin_global: true, niveis: {} },
  { codigo: "vazio", nome: "Sem nada", niveis: {} },
];

describe("grupo em uma frase", () => {
  it("lê os níveis do grupo", () => {
    expect(explicacaoDoGrupo(GRUPOS[0])).toBe(
      "Leitura: vê tudo, não altera nada.",
    );
    expect(explicacaoDoGrupo(GRUPOS[1])).toBe(
      "Edição: altera editais e cronograma; o resto só vê. Gerencia os acessos da coordenação.",
    );
    expect(explicacaoDoGrupo(GRUPOS[2])).toBe(
      "Administrador: vê e altera tudo, em todas as áreas.",
    );
    expect(explicacaoDoGrupo(GRUPOS[3])).toBe(
      "Sem acesso: não vê nenhuma página.",
    );
    expect(
      explicacaoDoGrupo({ niveis: { dashboard: "leitor", nucleo: "leitor" } }),
    ).toBe("Leitura: vê visão geral e editais, não altera nada.");
    expect(explicacaoDoGrupo(null)).toBe("");
  });
});

const area = (nivel) => ({
  nivel,
  origem: "excecao",
  nivel_grupo: "sem_acesso",
  revisao: 0,
});
const ADMIN = {
  id: "a1",
  nome: "Conta Admin",
  email: "adm@agenciasus.org.br",
  grupo: "admin",
  coordenacao: null,
  revisao_conta: "t0",
  admin_global: true,
  ativo: true,
  areas_efetivas: ["saude-indigena", "sede"],
  permissoes: {
    "area:saude-indigena": area("sem_acesso"),
    "area:sede": area("sem_acesso"),
  },
};
const MATRIZ = {
  usuarios: [ADMIN],
  grupos: GRUPOS,
  areas: [
    { id: "saude-indigena", titulo: "Saúde Indígena" },
    { id: "sede", titulo: "Sede" },
  ],
  coordenacoes: [{ codigo: "norte", nome: "Norte", area: "saude-indigena" }],
};

describe("trava: ninguém fica sem área", () => {
  it("regra pura", () => {
    expect(
      ficariaSemArea({
        adminGlobal: false,
        coordenacao: null,
        areasMarcadas: [],
      }),
    ).toBe(true);
    expect(
      ficariaSemArea({
        adminGlobal: true,
        coordenacao: null,
        areasMarcadas: [],
      }),
    ).toBe(false);
    expect(
      ficariaSemArea({
        adminGlobal: false,
        coordenacao: "norte",
        areasMarcadas: [],
      }),
    ).toBe(false);
    expect(
      ficariaSemArea({
        adminGlobal: false,
        coordenacao: null,
        areasMarcadas: ["sede"],
      }),
    ).toBe(false);
  });

  it("administrador que vira Usuário sem área trava; marcar a área libera", () => {
    let rascunho = new Map();
    expect(linhaFicariaSemArea(ADMIN, rascunho, MATRIZ)).toBe(false);
    rascunho = registrarNoRascunho(rascunho, ADMIN, ALVO_GRUPO, "usuario");
    expect(linhaFicariaSemArea(ADMIN, rascunho, MATRIZ)).toBe(true);
    expect(pessoasSemAreaNoRascunho(rascunho, MATRIZ).map((u) => u.id)).toEqual(
      ["a1"],
    );
    expect(areasDaLinha(ADMIN, rascunho, MATRIZ)).toEqual({
      todas: false,
      ids: [],
    });
    rascunho = registrarNoRascunho(rascunho, ADMIN, "area:sede", "leitor");
    expect(pessoasSemAreaNoRascunho(rascunho, MATRIZ)).toEqual([]);
    expect(areasDaLinha(ADMIN, rascunho, MATRIZ).ids).toEqual(["sede"]);
  });

  it("coordenação no rascunho também resolve; inativa não conta", () => {
    let rascunho = registrarNoRascunho(new Map(), ADMIN, ALVO_GRUPO, "usuario");
    rascunho = registrarNoRascunho(rascunho, ADMIN, "#coordenacao", "norte");
    expect(linhaFicariaSemArea(ADMIN, rascunho, MATRIZ)).toBe(false);
    expect(areasDaLinha(ADMIN, rascunho, MATRIZ).ids).toEqual([
      "saude-indigena",
    ]);
    const inativa = { ...ADMIN, ativo: false };
    expect(
      linhaFicariaSemArea(
        inativa,
        registrarNoRascunho(new Map(), inativa, ALVO_GRUPO, "usuario"),
        MATRIZ,
      ),
    ).toBe(false);
  });

  it("sem alteração, a coluna usa o que o banco calculou", () => {
    expect(areasDaLinha(ADMIN, new Map(), MATRIZ)).toEqual({
      todas: true,
      ids: [],
    });
    const pessoa = { ...ADMIN, grupo: "usuario", admin_global: false };
    expect(areasDaLinha(pessoa, new Map(), MATRIZ).ids).toEqual([
      "saude-indigena",
      "sede",
    ]);
  });
});
