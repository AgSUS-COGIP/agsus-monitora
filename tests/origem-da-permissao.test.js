import { describe, expect, it } from "vitest";
import {
  ALVO_COORDENACAO,
  ALVO_GRUPO,
  alteracoesDoRascunho,
  celulaExibida,
  rebasearRascunho,
  registrarNoRascunho,
  resumoDoRascunho,
} from "../src/lib/matriz-de-acessos.js";

const usuario = {
  id: "u1",
  nome: "Ana",
  email: "ana@agenciasus.org.br",
  grupo: "usuario",
  coordenacao: null,
  revisao_conta: "t0",
  permissoes: {
    nucleo: { nivel: "leitor", origem: "grupo", nivel_grupo: "leitor", revisao: 0 },
    aprovados: { nivel: "editor", origem: "excecao", nivel_grupo: "leitor", revisao: 3 },
  },
};
const grupos = {
  usuario: { niveis: { nucleo: "leitor", aprovados: "leitor" } },
  edital_gestor: { niveis: { nucleo: "editor", aprovados: "leitor" } },
};

describe("grupo + permissão individual", () => {
  it("célula individual mostra o nível próprio e o do grupo", () => {
    expect(celulaExibida(usuario, "aprovados", new Map(), grupos)).toEqual({
      nivel: "editor",
      individual: true,
      nivelGrupo: "leitor",
      pendente: false,
    });
  });

  it("'Do grupo' grava null; em célula que já segue o grupo não gera alteração", () => {
    let rascunho = registrarNoRascunho(new Map(), usuario, "aprovados", null);
    expect(alteracoesDoRascunho(rascunho)).toEqual([
      { tipo: "nivel", usuario_id: "u1", recurso: "aprovados", nivel: null, revisao: 3 },
    ]);
    expect(celulaExibida(usuario, "aprovados", rascunho, grupos)).toMatchObject({
      nivel: "leitor",
      individual: false,
      pendente: true,
    });
    rascunho = registrarNoRascunho(new Map(), usuario, "nucleo", null);
    expect(rascunho.size).toBe(0);
  });

  it("escolher explicitamente o mesmo nível do grupo fixa uma permissão individual", () => {
    const rascunho = registrarNoRascunho(new Map(), usuario, "nucleo", "leitor");
    expect(celulaExibida(usuario, "nucleo", rascunho, grupos)).toMatchObject({ nivel: "leitor", individual: true });
  });

  it("voltar ao valor salvo apaga a entrada", () => {
    let rascunho = registrarNoRascunho(new Map(), usuario, "aprovados", "admin");
    expect(rascunho.size).toBe(1);
    rascunho = registrarNoRascunho(rascunho, usuario, "aprovados", "editor");
    expect(rascunho.size).toBe(0);
  });

  it("trocar o grupo no rascunho já muda as células que seguem o grupo", () => {
    const rascunho = registrarNoRascunho(new Map(), usuario, ALVO_GRUPO, "edital_gestor");
    expect(celulaExibida(usuario, "nucleo", rascunho, grupos).nivel).toBe("editor");
    expect(celulaExibida(usuario, "aprovados", rascunho, grupos).nivel).toBe("editor");
  });

  it("mudanças de conta vão antes dos níveis, com a revisão da conta", () => {
    let rascunho = registrarNoRascunho(new Map(), usuario, "nucleo", "editor");
    rascunho = registrarNoRascunho(rascunho, usuario, ALVO_COORDENACAO, "norte");
    rascunho = registrarNoRascunho(rascunho, usuario, ALVO_GRUPO, "edital_gestor");
    expect(alteracoesDoRascunho(rascunho).map((a) => a.tipo)).toEqual(["coordenacao", "grupo", "nivel"]);
    expect(alteracoesDoRascunho(rascunho)[1]).toEqual({
      tipo: "grupo",
      usuario_id: "u1",
      grupo: "edital_gestor",
      revisao: "t0",
    });
  });

  it("recusa nível que o módulo não aceita", () => {
    expect(() => registrarNoRascunho(new Map(), usuario, "configuracoes", "leitor")).toThrow("Nível inválido");
    expect(() => registrarNoRascunho(new Map(), usuario, "acessos", "admin")).toThrow("Nível inválido");
  });

  it("revisão agrupada por pessoa, com de → para", () => {
    const rascunho = registrarNoRascunho(new Map(), usuario, "aprovados", null);
    const [grupo] = resumoDoRascunho(rascunho);
    expect(grupo.usuario.email).toBe("ana@agenciasus.org.br");
    expect(grupo.itens[0]).toEqual({ rotulo: "Lista de aprovados", de: "Editor", para: "Do grupo (Leitor)" });
  });

  it("depois de um conflito, a alteração cuja base mudou sai; as outras ficam", () => {
    let rascunho = registrarNoRascunho(new Map(), usuario, "aprovados", "admin");
    rascunho = registrarNoRascunho(rascunho, usuario, "nucleo", "editor");
    const recarregado = {
      ...usuario,
      permissoes: {
        ...usuario.permissoes,
        aprovados: { nivel: "leitor", origem: "excecao", nivel_grupo: "leitor", revisao: 4 },
      },
    };
    const { rascunho: novo, conflitos } = rebasearRascunho(rascunho, [recarregado]);
    expect(conflitos).toEqual([{ usuario: { id: "u1", nome: "Ana", email: "ana@agenciasus.org.br" }, alvo: "aprovados" }]);
    expect([...novo.keys()]).toEqual(["u1/nucleo"]);
  });
});
