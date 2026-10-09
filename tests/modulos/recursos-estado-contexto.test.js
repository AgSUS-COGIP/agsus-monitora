import { describe, expect, it, vi } from "vitest";
import { criarEstadoDosRecursos } from "../../src/modulos/recursos/estado.ts";
const adiar = () => {
  let resolver;
  const promessa = new Promise((r) => {
    resolver = r;
  });
  return { promessa, resolver };
};
const dados = {
  edital_id: "e1",
  origem: "entrevista",
  analista: "",
  processo_sei: "",
  observacao: "",
  fora_analise: true,
  analise_id: null,
  permitir_duplicado: false,
  nome_informado: "Ana",
};

describe("Recursos após trocar área ou sessão", () => {
  it("um pedido antigo de ajuste não bloqueia nem libera o pedido da nova área", async () => {
    const antiga = adiar();
    const nova = adiar();
    let numero = 0;
    const supabase = {
      rpc: vi.fn((nome) =>
        nome === "obter_ajustes_pontuacao_recurso"
          ? ++numero === 1
            ? antiga.promessa
            : nova.promessa
          : Promise.resolve({ data: { recursos: [] }, error: null }),
      ),
    };
    const e = criarEstadoDosRecursos({ supabase });
    await e.carregar("a");
    const primeiro = e.carregarAjustes("r1");
    await e.carregar("b");
    const segundo = e.carregarAjustes("r1");
    expect(numero).toBe(2);
    antiga.resolver({ data: { versoes: [{ id: "antiga" }] }, error: null });
    await primeiro;
    await e.carregarAjustes("r1");
    expect(numero).toBe(2);
    nova.resolver({ data: { versoes: [{ id: "nova" }] }, error: null });
    await segundo;
    expect(e.obter().ajustes.get("r1").versoes).toEqual([{ id: "nova" }]);
  });
  it("ignora detalhe, ajuste, prévia e modelos da área anterior", async () => {
    const espera = adiar();
    const supabase = {
      rpc: vi.fn((nome) =>
        nome === "get_recursos_da_area"
          ? Promise.resolve({ data: { recursos: [] }, error: null })
          : espera.promessa,
      ),
    };
    const e = criarEstadoDosRecursos({ supabase });
    await e.carregar("a");
    const consultas = [
      e.carregarDetalhe("r1"),
      e.carregarAjustes("r1"),
      e.carregarDadosDaPrevia("r1"),
      e.carregarModelos(),
    ];
    await e.carregar("b");
    espera.resolver({
      data: { observacao: "Dados da outra área", versoes: [{ id: "v1" }] },
      error: null,
    });
    await Promise.all(consultas);
    expect(e.obter().area).toBe("b");
    expect(e.obter().detalhes.size).toBe(0);
    expect(e.obter().ajustes.size).toBe(0);
    expect(e.obter().previas.size).toBe(0);
    expect(e.obter().modelosAdmin).toBeNull();
  });
  it.each([null, { message: "Erro antigo", code: "40001" }])(
    "escrita antiga não fecha formulário, avisa ou libera ação nova (erro: %j)",
    async (error) => {
      const antiga = adiar();
      const nova = adiar();
      let numero = 0;
      const toast = vi.fn();
      const supabase = {
        rpc: vi.fn((nome) =>
          nome === "salvar_recurso_candidato"
            ? ++numero === 1
              ? antiga.promessa
              : nova.promessa
            : Promise.resolve({ data: { recursos: [] }, error: null }),
        ),
      };
      const e = criarEstadoDosRecursos({ supabase, toast });
      await e.carregar("a");
      const primeiro = e.salvar(dados);
      await e.carregar("b");
      e.abrirNovo();
      const segundo = e.salvar(dados);
      const formulario = e.obter().formulario;
      antiga.resolver({ data: { id: "antigo", nu: 1 }, error });
      expect(await primeiro).toBeNull();
      expect(e.obter().formulario).toBe(formulario);
      expect(e.obter().acao?.tipo).toBe("salvar");
      expect(toast).not.toHaveBeenCalled();
      nova.resolver({ data: { id: "novo", nu: 2 }, error: null });
      expect(await segundo).toMatchObject({ ok: true, id: "novo" });
      expect(e.obter().acao).toBeNull();
      expect(toast).toHaveBeenCalledTimes(1);
    },
  );
  it("troca de usuário descarta a resposta de uma gravação em curso", async () => {
    const espera = adiar();
    let aoMudar;
    const toast = vi.fn();
    const supabase = {
      auth: {
        onAuthStateChange: (fn) => {
          aoMudar = fn;
        },
      },
      rpc: vi.fn((nome) =>
        nome === "salvar_recurso_candidato"
          ? espera.promessa
          : Promise.resolve({ data: { recursos: [] }, error: null }),
      ),
    };
    const e = criarEstadoDosRecursos({ supabase, toast });
    aoMudar("SIGNED_IN", { user: { id: "u1" } });
    await e.carregar("a");
    const gravacao = e.salvar(dados);
    aoMudar("SIGNED_IN", { user: { id: "u2" } });
    espera.resolver({ data: { id: "antigo" }, error: null });
    expect(await gravacao).toBeNull();
    expect(e.obter().dados).toBeNull();
    expect(toast).not.toHaveBeenCalled();
  });
  it("não registra um upload antigo nem inicia download após mudança de área", async () => {
    const envio = adiar();
    const assinatura = adiar();
    const abrirUrl = vi.fn();
    const toast = vi.fn();
    const bucket = {
      upload: vi.fn(() => envio.promessa),
      createSignedUrl: vi.fn(() => assinatura.promessa),
    };
    const supabase = {
      storage: { from: () => bucket },
      rpc: vi.fn((nome) =>
        Promise.resolve({
          data:
            nome === "registrar_download_anexo_recurso"
              ? { caminho: "a/r1/a.pdf", nome: "a.pdf" }
              : { recursos: [] },
          error: null,
        }),
      ),
    };
    const e = criarEstadoDosRecursos({ supabase, toast, abrirUrl });
    await e.carregar("a");
    const upload = e.enviarAnexo(
      "r1",
      new File(["PDF"], "a.pdf", { type: "application/pdf" }),
      "documento",
    );
    await e.carregar("b");
    envio.resolver({ error: null });
    expect(await upload).toBeNull();
    expect(
      supabase.rpc.mock.calls.some(
        ([nome]) => nome === "registrar_anexo_recurso",
      ),
    ).toBe(false);
    const download = e.baixarAnexo({ id: "an1" });
    await vi.waitFor(() => expect(bucket.createSignedUrl).toHaveBeenCalled());
    await e.carregar("c");
    assinatura.resolver({
      data: { signedUrl: "https://exemplo.test/anexo" },
      error: null,
    });
    expect(await download).toBeNull();
    expect(abrirUrl).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
  });
});
