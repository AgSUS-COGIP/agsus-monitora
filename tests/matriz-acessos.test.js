// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { mountAccessMatrix } from "../src/modules/matriz-acessos.js";

const payload = () => ({
  usuarios: [
    {
      id: "u1",
      user_id: "self",
      email: "self@example.org",
      nome: "Eu",
      permissoes: { nucleo: { nivel: "admin", revisao: 1 } },
    },
    {
      id: "u2",
      user_id: "other",
      email: "other@example.org",
      nome: '<img onerror="alert(1)">',
      permissoes: { nucleo: { nivel: "leitor", revisao: 2 } },
    },
  ],
  paineis: [],
  historico: [],
  total: 2,
});
let dispose;
afterEach(() => {
  dispose?.();
  document.body.innerHTML = "";
});
describe("matriz de acessos", () => {
  it("gerencia a conta pela matriz e bloqueia a ação enquanto há permissões pendentes", async () => {
    document.body.innerHTML = '<div id="matrix"></div>';
    const root = document.getElementById("matrix");
    const onManageAccount = vi.fn();
    dispose = await mountAccessMatrix(root, {
      sb: { rpc: vi.fn(async () => ({ data: payload() })) },
      currentUser: { id: "self" },
      onManageAccount,
    });
    expect(root.querySelector('[data-manage-account="u1"]')).toBeNull();
    root.querySelector('[data-manage-account="u2"]').click();
    expect(onManageAccount).toHaveBeenCalledWith(payload().usuarios[1]);
    const select = root.querySelector(
      'select[data-user="u2"][data-resource="nucleo"]',
    );
    select.value = "editor";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    const button = root.querySelector('[data-manage-account="u2"]');
    expect(button.disabled).toBe(true);
    button.click();
    expect(onManageAccount).toHaveBeenCalledTimes(1);
  });
  it("bloqueia o próprio usuário, escapa conteúdo e salva somente após revisão e motivo", async () => {
    document.body.innerHTML = '<div id="matrix"></div>';
    const root = document.getElementById("matrix");
    const rpc = vi.fn(async (name) => ({
      data: name === "obter_matriz_acessos" ? payload() : { alteradas: 1 },
      error: null,
    }));
    dispose = await mountAccessMatrix(root, {
      sb: { rpc },
      currentUser: { id: "self" },
    });
    expect(root.querySelector('select[data-user="u1"]').disabled).toBe(true);
    expect(root.querySelector("img")).toBeNull();
    const select = root.querySelector(
      'select[data-user="u2"][data-resource="nucleo"]',
    );
    select.value = "editor";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(root.textContent).toContain("alterações para revisar");
    root.querySelector('[name="motivo"]').value = "Responsável pela equipe";
    root
      .querySelector("[data-save]")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await vi.waitFor(() =>
      expect(rpc).toHaveBeenCalledWith("salvar_matriz_acessos", {
        p_alteracoes: [
          { usuario_id: "u2", recurso: "nucleo", nivel: "editor", revisao: 2 },
        ],
        p_motivo: "Responsável pela equipe",
      }),
    );
    await vi.waitFor(() =>
      expect(root.textContent).toContain("1 permissões salvas"),
    );
  });
  it("mantém alterações quando o banco recusa por conflito", async () => {
    document.body.innerHTML = '<div id="matrix"></div>';
    const root = document.getElementById("matrix");
    const rpc = vi.fn(async (name) =>
      name === "obter_matriz_acessos"
        ? { data: payload() }
        : { error: { message: "Permissão alterada por outro administrador" } },
    );
    dispose = await mountAccessMatrix(root, {
      sb: { rpc },
      currentUser: { id: "self" },
    });
    const select = root.querySelector(
      'select[data-user="u2"][data-resource="nucleo"]',
    );
    select.value = "sem_acesso";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    root.querySelector('[name="motivo"]').value = "Mudança de equipe";
    root
      .querySelector("[data-save]")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await vi.waitFor(() =>
      expect(root.textContent).toContain("alterações continuam pendentes"),
    );
    expect(
      root.querySelector('select[data-user="u2"][data-resource="nucleo"]')
        .value,
    ).toBe("sem_acesso");
  });
});
