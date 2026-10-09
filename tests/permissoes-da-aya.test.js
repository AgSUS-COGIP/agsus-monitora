import { describe, expect, it } from "vitest";
import {
  acaoDaPergunta,
  explicarPermissao,
} from "../src/lib/permissoes-da-aya.js";
import { responderAya } from "../src/lib/busca-da-aya.js";

/*
  "Não aparece o botão": a Aya explica a permissão que falta para o perfil de
  quem pergunta (src/lib/permissoes-da-aya.js), com as mesmas regras de
  src/lib/access-roles.js que escondem o botão.
*/

const perfil = (permissoes, extra = {}) => ({
  ativo: true,
  perfil: "usuario",
  admin_global: false,
  permissoes,
  ...extra,
});
const LEITOR = perfil({ recursos: "leitor", aprovados: "leitor" });
const EDITOR = perfil({ recursos: "editor", aprovados: "editor" });

describe("qual ação", () => {
  it.each([
    ["não aparece o botão de novo recurso", "novo-recurso"],
    ["por que não consigo deferir o recurso?", "decidir-recurso"],
    ["cadê o botão de emitir a carta?", "status-do-candidato"],
    ["não consigo dar acesso", "dar-acesso"],
    ["quem pode liberar o edital fora da janela?", "liberar-entrevista"],
    ["botão rodar agora sumiu", "rodar-agora"],
  ])("%s → %s", (pergunta, id) => {
    expect(acaoDaPergunta(pergunta)?.id).toBe(id);
  });

  it("pergunta que não é de permissão fica de fora", () => {
    expect(acaoDaPergunta("como registrar um recurso?")).toBeNull();
    expect(
      acaoDaPergunta("por que um edital não aparece em Conduzir entrevistas?"),
    ).toBeNull();
  });
});

describe("resposta para o perfil", () => {
  it("quem não pode: diz a permissão que falta e quem libera", () => {
    const r = explicarPermissao("não aparece o botão de novo recurso", LEITOR);
    expect(r.answer).toContain("não tem permissão para registrar recursos");
    expect(r.answer).toContain("nível Editor em Recursos");
    expect(r.answer).toContain("Configurações › Acessos");
  });

  it("quem pode: diz onde fica e o que conferir", () => {
    const r = explicarPermissao("não aparece o botão de novo recurso", EDITOR);
    expect(r.answer).toContain("pode registrar recursos");
    expect(r.answer).toContain("topo de Analisar recursos");
    expect(r.acao).toBe("analisar-recursos");
  });

  it("sem perfil, quem responde é a base", () => {
    expect(explicarPermissao("quem pode decidir um recurso?", null)).toBeNull();
  });

  it("a busca usa o perfil antes da base", () => {
    const r = responderAya({
      question: "não aparece o botão de novo recurso",
      section: "recursos",
      perfil: LEITOR,
    });
    expect(r.provider).toBe("monitora-perfil");
    expect(r.answer).toContain("nível Editor em Recursos");
  });
});
