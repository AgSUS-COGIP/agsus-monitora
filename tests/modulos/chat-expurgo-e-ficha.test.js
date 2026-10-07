import { describe, expect, it, vi } from "vitest";
import {
  contagensDaLimpeza,
  normalizarRetencao,
  oQueOZerarApaga,
} from "../../src/lib/retencao-do-chat.js";
import { criarEstadoDasMensagensDoChat } from "../../src/modulos/configuracoes/estado-das-mensagens-do-chat.js";
import {
  compartilharNoChat,
  EVENTO_COMPARTILHAR,
  irParaLink,
} from "../../src/modulos/chat/ponte.js";

/*
  As pontas da v2 do chat fora do painel: o expurgo dos arquivos que a
  retenção e o "Zerar" puseram na fila (Configurações › Mensagens (chat), só
  o administrador global; o Storage só apaga pela API) e o cartão da ficha
  da avaliação documental (Compartilhar esta ficha e o "Abrir" que leva à
  ficha pela Fila). Códigos CV-n.m: docs/historias-de-usuario/chat.md.
*/

const EDITAL = "00000000-0000-4000-a000-0000000ed001";
const FICHA = "00000000-0000-4000-a000-0000000f1001";
const CAMINHO = (n) =>
  `00000000-0000-4000-a000-0000000000c1/00000000-0000-4000-a000-00000000000${n}.pdf`;

function bancoFalso({
  fila = [CAMINHO(1), CAMINHO(2)],
  removerFalha = null,
} = {}) {
  const removidos = [];
  let pendentes = [...fila];
  const bucket = {
    remove: vi.fn(async (caminhos) => {
      if (removerFalha) return { data: null, error: removerFalha };
      removidos.push(...caminhos);
      return { data: caminhos, error: null };
    }),
  };
  return {
    removidos,
    bucket,
    storage: { from: vi.fn(() => bucket) },
    rpc: vi.fn(async (nome, argumentos) => {
      if (nome === "obter_retencao_chat")
        return {
          data: {
            mensagens: 3,
            anexos: 0,
            expurgo_pendente: pendentes.length,
            historico: [],
          },
          error: null,
        };
      if (nome === "preparar_expurgo_anexos_chat")
        return {
          data: { caminhos: pendentes, pendentes: pendentes.length },
          error: null,
        };
      if (nome === "confirmar_expurgo_anexos_chat") {
        const saem = argumentos.p_caminhos.filter((c) => removidos.includes(c));
        pendentes = pendentes.filter((c) => !saem.includes(c));
        return {
          data: { confirmados: saem.length, pendentes: pendentes.length },
          error: null,
        };
      }
      return { data: null, error: { message: `sem ${nome}` } };
    }),
  };
}

describe("CV-1.10 — expurgo dos arquivos da fila", () => {
  it("ao ler com fila: remove pela API do Storage (bucket chat-anexos) e confirma no banco", async () => {
    const banco = bancoFalso();
    const estado = criarEstadoDasMensagensDoChat({ supabase: banco });
    await estado.carregar();
    await vi.waitFor(() =>
      expect(banco.rpc).toHaveBeenCalledWith("confirmar_expurgo_anexos_chat", {
        p_caminhos: [CAMINHO(1), CAMINHO(2)],
      }),
    );
    expect(banco.storage.from).toHaveBeenCalledWith("chat-anexos");
    expect(banco.removidos).toEqual([CAMINHO(1), CAMINHO(2)]);
    await vi.waitFor(() =>
      expect(estado.obter().dados.expurgoPendente).toBe(0),
    );
  });

  it("se o Storage recusa, não confirma nada (fica para a próxima vez)", async () => {
    const banco = bancoFalso({ removerFalha: { message: "negado" } });
    const estado = criarEstadoDasMensagensDoChat({ supabase: banco });
    expect(await estado.expurgarAnexos()).toBe(0);
    expect(banco.rpc).not.toHaveBeenCalledWith(
      "confirmar_expurgo_anexos_chat",
      expect.anything(),
    );
  });

  it("sem fila, não chama o Storage", async () => {
    const banco = bancoFalso({ fila: [] });
    const estado = criarEstadoDasMensagensDoChat({ supabase: banco });
    await estado.carregar();
    expect(banco.rpc).not.toHaveBeenCalledWith(
      "preparar_expurgo_anexos_chat",
      undefined,
    );
    expect(banco.bucket.remove).not.toHaveBeenCalled();
  });

  it("contagens com anexos (seção e histórico, sem nome nem caminho)", () => {
    const dados = normalizarRetencao({
      mensagens: 4,
      reacoes: 1,
      anexos: 2,
      expurgo_pendente: 1,
    });
    expect(dados.anexos).toBe(2);
    expect(dados.expurgoPendente).toBe(1);
    expect(oQueOZerarApaga(dados)).toEqual([
      "4 mensagens",
      "1 reação",
      "2 anexos",
    ]);
    expect(
      contagensDaLimpeza({ mensagens: 2, reacoes: 0, anexos: 1, conversas: 0 }),
    ).toBe("2 mensagens · 1 anexo");
  });
});

describe("CV-6.3 — a ficha da avaliação documental pelo cartão", () => {
  it("Compartilhar esta ficha avisa o chat com o link conferido", () => {
    const ouvinte = vi.fn();
    document.addEventListener(EVENTO_COMPARTILHAR, ouvinte);
    expect(
      compartilharNoChat({
        view: "avaliacao-documental",
        area: "saude-indigena",
        edital: { id: EDITAL, titulo: "93/2026" },
        ficha: { id: FICHA, codigo: "123456" },
      }),
    ).toBe(true);
    expect(ouvinte.mock.calls[0][0].detail.link.rotulo).toBe(
      "Candidato 123456 · Avaliação documental · Saúde Indígena · Edital 93/2026",
    );
    expect(compartilharNoChat({ view: "https://x.invalid" })).toBe(false);
    document.removeEventListener(EVENTO_COMPARTILHAR, ouvinte);
  });

  it("Abrir: navega, escolhe o edital na Fila e abre a ficha (o banco confere a permissão)", async () => {
    const estado = {
      editalId: "",
      mudarVisao: vi.fn(),
      obter() {
        return { editalId: this.editalId };
      },
      escolherEdital: vi.fn(async function (id) {
        estado.editalId = id;
      }),
    };
    const fila = {
      editalId: "",
      obter() {
        return {
          editalId: this.editalId,
          dados: { candidatos: [{ codigo: "777", ficha: { id: FICHA } }] },
        };
      },
      carregar: vi.fn(async (id) => {
        fila.editalId = id;
      }),
      abrir: vi.fn(async () => true),
    };
    const janela = {
      navigate: vi.fn(),
      avaliacaoDocumentalController: { estado, fila },
    };
    expect(
      irParaLink(
        {
          view: "avaliacao-documental",
          edital: { id: EDITAL, titulo: "93/2026" },
          ficha: { codigo: "777" },
        },
        { janela, documento: document },
      ),
    ).toBe(true);
    expect(janela.navigate).toHaveBeenCalledWith("avaliacao-documental");
    await vi.waitFor(() => expect(fila.abrir).toHaveBeenCalledWith(FICHA));
    expect(estado.mudarVisao).toHaveBeenCalledWith("fila");
    expect(estado.escolherEdital).toHaveBeenCalledWith(EDITAL);
    expect(fila.carregar).toHaveBeenCalledWith(EDITAL);
  });
});
