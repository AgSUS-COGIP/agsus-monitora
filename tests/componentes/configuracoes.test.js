import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { montarConfiguracoes } from "../../src/componentes/configuracoes/configuracoes.jsx";
import { criarEstadoDasConfiguracoes } from "../../src/componentes/configuracoes/estado.js";
import { normalizarValoresCarregados } from "../../src/lib/publicacao-de-configuracoes.js";
import {
  abrirSecaoDeConfiguracao,
  organizarConfiguracoesEmSecoes,
} from "../../src/modules/config-secoes.js";
import { clicar, digitar, esperar, teclar } from "./interacoes.js";

/*
  Moldura React de Configurações (src/componentes/configuracoes/): o
  cabeçalho da seção aberta, a barra fixa de salvar, a publicação com motivo,
  o histórico com restauração e a seção Marca. Pedidos de 29/09 e 30/09:
  - o cabeçalho é o da seção (nome e descrição), sem "Ajustes do sistema";
  - na seção Acessos, a barra fixa e o Ctrl+S não publicam Configurações;
  - "não salvo" só vale para os campos das seções e os painéis (busca e
    matriz de acessos, não);
  - falha de rede: mensagem clara e botões de volta (publicar, histórico,
    restaurar);
  - o histórico fica na seção Operação;
  - a revisão lê `configuracoes` do snapshot e, sem mudança, não acusa nada.
*/

const SEM_SERVIDOR =
  "Não foi possível falar com o servidor. Verifique a conexão e tente de novo.";

// O que já está publicado: a tela carregada é igual ao banco.
const PUBLICADO = {
  auth_google_enabled: "true",
  auth_access_texto_modo: "auto",
  broadcast_type: "info",
  feature_realtime_monitoramento: "true",
  access_heartbeat_minutos: "5",
  page_title: "Saúde Indígena",
  cogip_nome: "COGIP",
  footer_text: "AgSUS",
};
// O banco igual à tela: as chaves que faltam vêm com o padrão que a tela mostra.
const snapshotIgual = () => ({
  configuracoes: [...normalizarValoresCarregados(PUBLICADO)].map(
    ([chave, valor]) => ({
      chave,
      valor,
    }),
  ),
  paineis: [],
});

let cliente;
let controlador;
let alertar;
let recarregar;

async function montar({ secao = "marca", confirmar = () => true } = {}) {
  document.body.innerHTML = `
    <section id="page-config" class="page active">
      <div id="configuracoesApp" data-configuracoes></div>
      <div class="admin-grid">
        <div id="acessosApp" class="full" data-acessos>
          <input id="buscaDeAcessos" type="search" />
        </div>
        <div class="admin-card card config-main-card"><div class="form-grid">
          <div class="form-row"><label>Outro</label><input id="campoSolto" /></div>
        </div></div>
      </div>
    </section>`;
  organizarConfiguracoesEmSecoes(document);
  abrirSecaoDeConfiguracao(document, secao);
  alertar = vi.fn();
  recarregar = vi.fn();
  const estado = criarEstadoDasConfiguracoes({
    supabase: () => cliente,
    confirmar,
    alertar,
    recarregar,
  });
  await act(async () => {
    controlador = montarConfiguracoes({ estado });
  });
  await act(async () => estado.definirValoresCarregados(PUBLICADO));
  await esperar();
  return estado;
}

const $ = (id) => document.getElementById(id);
const barra = () => document.querySelector(".config-barra");
const salvar = () => document.querySelector(".config-barra__salvar");
const sujo = () =>
  Boolean(document.querySelector(".config-cabecalho__pendente"));
const tituloDoDialogo = () => $("configGovernanceTitle")?.textContent;
const ctrlS = () => teclar(document, "s", { ctrlKey: true });

/* Digita num campo que não é da tela React (busca de acessos, campo solto). */
async function digitarForaDoReact(id, valor) {
  await act(async () => {
    const campo = $(id);
    campo.value = valor;
    campo.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

beforeEach(() => {
  cliente = {
    rpc: vi.fn(async (nome) => ({
      data: nome === "get_configuracoes_historico" ? [] : snapshotIgual(),
      error: null,
    })),
  };
});
afterEach(async () => {
  await act(async () => controlador?.raiz?.unmount());
  controlador = null;
  document.body.innerHTML = "";
});

describe("cabeçalho da seção", () => {
  it("mostra só o nome da seção aberta, sem descrição nem cabeçalho repetido", async () => {
    await montar();
    const cabecalho = document.querySelector(".config-cabecalho");
    expect(cabecalho.querySelector("h2").textContent).toBe("Marca");
    expect(cabecalho.querySelector("p")).toBeNull();
    expect(cabecalho.textContent).not.toContain(
      "Nomes, versão e identidade que aparecem em todo o sistema.",
    );
    expect(document.body.textContent).not.toContain("Ajustes do sistema");
    expect(document.querySelector(".config-secao__cabecalho")).toBeNull();
    // O mesmo ícone do item no menu lateral.
    expect(
      cabecalho.querySelector(".config-cabecalho__icone svg").dataset.icone,
    ).toBe("type");
  });

  it("acompanha a troca de seção", async () => {
    await montar();
    await act(async () => abrirSecaoDeConfiguracao(document, "operacao"));
    expect(document.querySelector(".config-cabecalho h2").textContent).toBe(
      "Operação",
    );
  });
});

describe("barra fixa", () => {
  it("o ícone da situação é um tile próprio, fora do texto", async () => {
    await montar();
    const icone = document.querySelector(".config-barra__icone");
    expect(icone.classList).toContain("config-barra__icone--limpo");
    expect(icone.closest(".config-barra__texto")).toBeNull();
    expect(icone.querySelector("svg").dataset.icone).toBe("circle-check");
    expect(barra().textContent).toContain("Nenhuma alteração pendente");
  });
});

describe("controle de 'não salvo'", () => {
  it("só os campos das seções marcam a página", async () => {
    await montar();
    await digitarForaDoReact("buscaDeAcessos", "ana");
    await digitarForaDoReact("campoSolto", "x");
    expect(sujo()).toBe(false);
    expect(salvar().disabled).toBe(true);
    await digitar($("configInicio-pageTitle"), "Novo título");
    expect(sujo()).toBe(true);
    expect(salvar().disabled).toBe(false);
    expect(
      document.querySelector(".config-barra__icone svg").dataset.icone,
    ).toBe("pencil");
  });

  it("um campo da Marca marca a página; voltar ao valor publicado desmarca", async () => {
    await montar();
    const nome = $("configMarca-cogipNome");
    expect(nome.value).toBe("COGIP");
    await digitar(nome, "Equipe nova");
    expect(sujo()).toBe(true);
    await digitar(nome, "COGIP");
    expect(sujo()).toBe(false);
  });

  it("sair com alteração pergunta; recusado, fica; aceito, descarta", async () => {
    const estado = await montar();
    expect(estado.confirmarSaida(() => false)).toBe(true);
    await digitar($("configMarca-footerText"), "Outro rodapé");
    expect(estado.confirmarSaida(() => false)).toBe(false);
    expect(sujo()).toBe(true);
    await act(async () => expect(estado.confirmarSaida(() => true)).toBe(true));
    expect(sujo()).toBe(false);
    expect($("configMarca-footerText").value).toBe("AgSUS");
  });
});

describe("seção Acessos", () => {
  it("a barra fixa some e o Ctrl+S não publica Configurações", async () => {
    await montar({ secao: "acessos" });
    expect(barra()).toBeNull();
    await digitar($("configInicio-pageTitle"), "Mudou em outra seção");
    cliente.rpc.mockClear();
    await ctrlS();
    expect(cliente.rpc).not.toHaveBeenCalled();
    expect(tituloDoDialogo()).toBeUndefined();
  });

  it("fora de Acessos, o Ctrl+S abre a revisão", async () => {
    await montar();
    expect(barra()).not.toBeNull();
    await digitar($("configInicio-pageTitle"), "Título novo");
    await ctrlS();
    await esperar();
    expect(tituloDoDialogo()).toBe("Revisar publicação");
  });
});

describe("revisão da publicação", () => {
  it("sem mudança real, nada a publicar (lê `configuracoes` do snapshot)", async () => {
    const estado = await montar();
    await esperar(() => estado.revisar());
    expect(tituloDoDialogo()).toBe("Nenhuma alteração");
  });

  it("uma mudança da Marca aparece sozinha, com o valor de antes", async () => {
    await montar();
    await digitar($("configMarca-cogipNome"), "Equipe nova");
    await clicar(salvar());
    await esperar();
    const linhas = document.querySelectorAll(".config-change-row");
    expect(linhas).toHaveLength(1);
    expect(linhas[0].textContent).toContain("COGIP");
    expect(linhas[0].textContent).toContain("Equipe nova");
  });

  it("URL inválida no logo da equipe: não publica e aponta o campo", async () => {
    await montar();
    await digitar($("configMarca-cogipLogoUrl"), "javascript:alert(1)");
    cliente.rpc.mockClear();
    await clicar(salvar());
    expect(cliente.rpc).not.toHaveBeenCalled();
    expect(tituloDoDialogo()).toBe("Corrigir configurações");
    expect($("configMarca-cogipLogoUrl").getAttribute("aria-invalid")).toBe(
      "true",
    );
    expect(document.querySelector(".config-validation-summary")).not.toBeNull();
  });

  it("publica a Marca e os campos legados numa chamada, com motivo", async () => {
    await montar();
    await digitar($("configMarca-cogipNome"), "Equipe nova");
    await clicar(salvar());
    await esperar();
    cliente.rpc.mockResolvedValue({
      data: { ok: true, total_alteracoes: 1 },
      error: null,
    });
    // Sem motivo, não envia.
    await clicar(
      [...document.querySelectorAll(".config-governance-footer .btn")].at(-1),
    );
    expect(cliente.rpc).not.toHaveBeenCalledWith(
      "salvar_configuracoes_e_paineis_v2",
      expect.anything(),
    );
    await digitar($("configPublishReason"), "Troca da equipe");
    await clicar(
      [...document.querySelectorAll(".config-governance-footer .btn")].at(-1),
    );
    await esperar();
    const chamada = cliente.rpc.mock.calls.find(
      ([nome]) => nome === "salvar_configuracoes_e_paineis_v2",
    );
    expect(chamada[1].p_motivo).toBe("Troca da equipe");
    const linhas = new Map(
      chamada[1].p_config_rows.map((l) => [l.chave, l.valor]),
    );
    expect(linhas.get("cogip_nome")).toBe("Equipe nova");
    expect(linhas.get("page_title")).toBe("Saúde Indígena");
    expect(alertar).toHaveBeenCalled();
    expect(recarregar).toHaveBeenCalled();
  });
});

describe("falha de rede", () => {
  it("ao preparar: mensagem clara e o botão volta a 'Salvar alterações'", async () => {
    await montar();
    await digitar($("configInicio-pageTitle"), "Título novo");
    cliente.rpc.mockRejectedValue(new TypeError("Failed to fetch"));
    await clicar(salvar());
    await esperar();
    expect(
      document.querySelector(".config-governance-body").textContent,
    ).toContain(SEM_SERVIDOR);
    expect(salvar().textContent).toContain("Salvar alterações");
    expect(salvar().disabled).toBe(false);
  });

  it("ao publicar: erro no diálogo e 'Tentar novamente' habilitado", async () => {
    await montar();
    await digitar($("configInicio-pageTitle"), "Título novo");
    await clicar(salvar());
    await esperar();
    cliente.rpc.mockResolvedValue({
      data: null,
      error: { message: "TypeError: Failed to fetch" },
    });
    await digitar($("configPublishReason"), "Ajuste");
    const publicar = () =>
      [...document.querySelectorAll(".config-governance-footer .btn")].at(-1);
    await clicar(publicar());
    await esperar();
    expect(
      document.querySelector(".config-governance-body").textContent,
    ).toContain(SEM_SERVIDOR);
    expect(publicar().disabled).toBe(false);
    expect(publicar().textContent).toContain("Tentar novamente");
    expect(sujo()).toBe(true);
    expect(recarregar).not.toHaveBeenCalled();
  });

  it("histórico e restauração: mensagem clara, sem 'Carregando…' nem botão preso", async () => {
    cliente.rpc.mockImplementation(async (nome) =>
      nome === "get_configuracoes_historico"
        ? {
            data: [
              {
                id: "v1",
                acao: "salvar",
                motivo: "m",
                alteracoes: [],
                total_alteracoes: 1,
              },
            ],
            error: null,
          }
        : { data: snapshotIgual(), error: null },
    );
    await montar({ secao: "operacao" });
    await esperar();
    cliente.rpc.mockRejectedValue(new TypeError("Failed to fetch"));
    const cartao = $("configHistoryCard");
    await clicar(
      [...cartao.querySelectorAll(".btn")].find((b) =>
        b.textContent.includes("Restaurar"),
      ),
    );
    await digitar($("configRestoreReason"), "Voltar");
    const restaurar = () =>
      [...document.querySelectorAll(".config-governance-footer .btn")].at(-1);
    await clicar(restaurar());
    await esperar();
    expect(
      document.querySelector(".config-governance-body").textContent,
    ).toContain(SEM_SERVIDOR);
    expect(restaurar().disabled).toBe(false);

    await clicar(document.querySelector('[aria-label="Fechar"]'));
    await clicar(
      [...cartao.querySelectorAll(".btn")].find((b) =>
        b.textContent.includes("Atualizar"),
      ),
    );
    await esperar();
    expect(cartao.textContent).toContain(SEM_SERVIDOR);
    expect(cartao.textContent).not.toContain("Carregando");
  });
});

describe("histórico de configurações", () => {
  it("fica na seção Operação, fora da grade antiga escondida", async () => {
    await montar({ secao: "operacao" });
    const cartao = $("configHistoryCard");
    expect(cartao.closest('.config-secao[data-secao="operacao"]')).toBeTruthy();
    expect(cartao.closest(".admin-grid")).toBeNull();
  });
});
