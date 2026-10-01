import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { montarConfiguracoes } from "../../src/componentes/configuracoes/configuracoes.jsx";
import { criarEstadoDasConfiguracoes } from "../../src/componentes/configuracoes/estado.js";
import { normalizarValoresCarregados } from "../../src/lib/publicacao-de-configuracoes.js";
import {
  abrirSecaoDeConfiguracao,
  organizarConfiguracoesEmSecoes,
} from "../../src/modules/config-secoes.js";
import { clicar, digitar, escolher, esperar } from "./interacoes.js";

/*
  Configurações › Painéis externos e Operação em React (01/10). Antes, a
  tabela de painéis era montada com innerHTML (config-ui.js) e os campos de
  Operação eram `cfg*` do index.html; a publicação lia tudo do DOM. Agora o
  legado publica os valores (loadConfig) e os painéis (loadPanels) no estado,
  e a publicação manda o mesmo `p_config_rows`/`p_paineis` de antes.
*/

const PUBLICADO = {
  auth_google_enabled: "true",
  auth_access_texto_modo: "auto",
  broadcast_type: "info",
  page_title: "Saúde Indígena",
  feature_realtime_monitoramento: "true",
  access_heartbeat_minutos: "5",
  cogip_versao: "V.2.7.3",
  app_version_current: "MONITORA Web V2.9.35",
};

// Como `loadPanels` lê a TB_PAINEL_EXTERNO.
const PAINEIS = [
  {
    id: "p1",
    codigo: "recursos",
    titulo: "Recursos",
    icone: "fa-file",
    url: "https://recursos.agenciasus.org.br",
    ordem: 1,
    ativo: true,
    em_manutencao: false,
    tipo_abertura: "iframe",
  },
  {
    id: "p2",
    codigo: "bi",
    titulo: "BI",
    icone: "fa-chart",
    url: "",
    ordem: 2,
    ativo: false,
    em_manutencao: false,
    tipo_abertura: "iframe",
  },
];

const snapshot = () => ({
  // O banco igual à tela: as chaves que faltam vêm com o padrão que a tela mostra.
  configuracoes: [...normalizarValoresCarregados(PUBLICADO)].map(
    ([chave, valor]) => ({
      chave,
      valor,
    }),
  ),
  paineis: PAINEIS.map((painel) => ({ ...painel })),
});

const VERSAO = {
  id: "v1",
  acao: "salvar",
  motivo: "Painel em manutenção",
  alteracoes: [
    {
      entidade: "painel",
      rotulo: "Recursos",
      campo: "Manutenção",
      antes: false,
      depois: true,
    },
  ],
  total_alteracoes: 1,
};

let cliente;
let controlador;
let recarregar;

async function montar({ secao = "recursos", config = PUBLICADO } = {}) {
  document.body.innerHTML = `
    <section id="page-config" class="page active">
      <div id="configuracoesApp" data-configuracoes></div>
      <div class="admin-grid">
      </div>
    </section>`;
  organizarConfiguracoesEmSecoes(document);
  abrirSecaoDeConfiguracao(document, secao);
  recarregar = vi.fn();
  const estado = criarEstadoDasConfiguracoes({
    supabase: () => cliente,
    confirmar: () => true,
    alertar: vi.fn(),
    recarregar,
  });
  await act(async () => {
    controlador = montarConfiguracoes({ estado });
  });
  await act(async () => {
    estado.definirValoresCarregados(config);
    estado.definirPaineisCarregados(PAINEIS);
  });
  await esperar();
  return estado;
}

const $ = (id) => document.getElementById(id);
const salvar = () => document.querySelector(".config-barra__salvar");
const sujo = () =>
  Boolean(document.querySelector(".config-cabecalho__pendente"));
const tituloDoDialogo = () => $("configGovernanceTitle")?.textContent;
const botaoFinal = () =>
  [...document.querySelectorAll(".config-governance-footer .btn")].at(-1);
const secao = (id) =>
  document.querySelector(`.config-secao[data-secao="${id}"]`);

async function publicar(motivo = "Ajuste") {
  await clicar(salvar());
  await esperar();
  expect(tituloDoDialogo()).toBe("Revisar publicação");
  await digitar($("configPublishReason"), motivo);
  await clicar(botaoFinal());
  await esperar();
  return cliente.rpc.mock.calls.find(
    ([nome]) => nome === "salvar_configuracoes_e_paineis_v2",
  )?.[1];
}

beforeEach(() => {
  cliente = {
    rpc: vi.fn(async (nome) => {
      if (nome === "get_configuracoes_historico")
        return { data: [VERSAO], error: null };
      if (nome === "get_configuracoes_snapshot")
        return { data: snapshot(), error: null };
      return { data: { ok: true, total_alteracoes: 1 }, error: null };
    }),
  };
});
afterEach(async () => {
  await act(async () => controlador?.raiz?.unmount());
  controlador = null;
  document.body.innerHTML = "";
});

describe("Painéis externos", () => {
  it("lista os painéis carregados, com selo e resumo, dentro da seção", async () => {
    await montar();
    const tabela = secao("recursos").querySelector(".painel-externo-tabela");
    expect(tabela).not.toBeNull();
    expect($("configPainel-0-titulo").value).toBe("Recursos");
    expect($("configPainel-0-url").value).toBe(
      "https://recursos.agenciasus.org.br",
    );
    expect($("configPainel-0-ativo").value).toBe("true");
    expect($("configPainel-1-ativo").value).toBe("false");
    expect($("configPainel-1-manutencao").value).toBe("false");
    expect(tabela.textContent).toContain("Código: bi");
    const selos = [...tabela.querySelectorAll(".config-status")].map(
      (selo) => selo.textContent,
    );
    expect(selos).toEqual(["Ativo", "Inativo"]);
    const resumo = secao("recursos").querySelector(".previa-recursos");
    expect(resumo.textContent).toContain("2 painéis externos");
    // Sem as frases explicativas do legado.
    expect(secao("recursos").textContent).not.toContain("Salvar alterações");
    expect(secao("recursos").textContent).not.toContain("Título, endereço");
  });

  it("sem painel cadastrado, diz que não há; recarregar a lista redesenha", async () => {
    const estado = await montar();
    await act(async () => estado.definirPaineisCarregados([]));
    expect(secao("recursos").textContent).toContain(
      "Nenhum painel externo cadastrado.",
    );
    expect(secao("recursos").querySelector("table")).toBeNull();
    await act(async () =>
      estado.definirPaineisCarregados([
        ...PAINEIS,
        { id: "p3", codigo: "novo", titulo: "Novo", ativo: true, url: "" },
      ]),
    );
    expect(secao("recursos").querySelectorAll("tbody tr")).toHaveLength(3);
    expect(secao("recursos").textContent).toContain("Sem URL");
  });

  it("editar marca a página; voltar ao valor carregado desmarca", async () => {
    await montar();
    await digitar($("configPainel-0-titulo"), "Recursos novos");
    expect(sujo()).toBe(true);
    expect(salvar().disabled).toBe(false);
    await digitar($("configPainel-0-titulo"), "Recursos");
    expect(sujo()).toBe(false);
    await escolher($("configPainel-0-manutencao"), "true");
    expect(sujo()).toBe(true);
    expect(
      secao("recursos").querySelector("tbody tr .config-status").textContent,
    ).toBe("Manutenção");
  });

  it("endereço inválido não publica e aponta o campo", async () => {
    await montar();
    await digitar($("configPainel-0-url"), "ftp://recursos");
    cliente.rpc.mockClear();
    await clicar(salvar());
    expect(cliente.rpc).not.toHaveBeenCalled();
    expect(tituloDoDialogo()).toBe("Corrigir configurações");
    expect($("configPainel-0-url").getAttribute("aria-invalid")).toBe("true");
    expect(document.body.textContent).toContain(
      "URL inválida no campo Endereço do painel Recursos: use https:// ou http://.",
    );
    // Corrigir tira a marca do campo.
    await clicar(document.querySelector('[aria-label="Fechar"]'));
    await digitar($("configPainel-0-url"), "https://recursos.org");
    expect($("configPainel-0-url").getAttribute("aria-invalid")).toBeNull();
  });

  it("painel ativo sem endereço não publica", async () => {
    await montar();
    await escolher($("configPainel-1-ativo"), "true");
    await clicar(salvar());
    expect(tituloDoDialogo()).toBe("Corrigir configurações");
    expect(document.body.textContent).toContain(
      "Painéis ativos precisam de uma URL configurada.",
    );
  });

  it("publica p_paineis no formato de antes, com a revisão do que mudou", async () => {
    await montar();
    await digitar($("configPainel-0-url"), "https://novo.agenciasus.org.br");
    await escolher($("configPainel-1-manutencao"), "true");
    await clicar(salvar());
    await esperar();
    const linhas = [...document.querySelectorAll(".config-change-row")].map(
      (linha) => linha.textContent,
    );
    expect(linhas).toHaveLength(2);
    expect(linhas[0]).toContain("Painel");
    expect(linhas[0]).toContain("https://novo.agenciasus.org.br");
    expect(linhas[1]).toContain("Manutenção");
    await digitar($("configPublishReason"), "Novo endereço");
    await clicar(botaoFinal());
    await esperar();
    const chamada = cliente.rpc.mock.calls.find(
      ([nome]) => nome === "salvar_configuracoes_e_paineis_v2",
    )[1];
    expect(chamada.p_paineis).toEqual([
      {
        id: "p1",
        titulo: "Recursos",
        url: "https://novo.agenciasus.org.br",
        ativo: true,
        em_manutencao: false,
      },
      { id: "p2", titulo: "BI", url: "", ativo: false, em_manutencao: true },
    ]);
    expect(chamada.p_motivo).toBe("Novo endereço");
    expect(recarregar).toHaveBeenCalled();
  });
});

describe("Operação", () => {
  it("mostra os valores carregados, normalizados como no legado", async () => {
    await montar({
      secao: "operacao",
      config: {
        ...PUBLICADO,
        feature_realtime_monitoramento: "não",
        access_heartbeat_minutos: undefined,
      },
    });
    const corpo = secao("operacao");
    expect(corpo.contains($("configOperacao-cogipVersao"))).toBe(true);
    expect($("configOperacao-cogipVersao").value).toBe("V.2.7.3");
    expect($("configOperacao-appVersionCurrent").value).toBe(
      "MONITORA Web V2.9.35",
    );
    expect($("configOperacao-featureRealtimeMonitoramento").value).toBe(
      "false",
    );
    expect($("configOperacao-accessHeartbeatMinutos").value).toBe("5");
    // O histórico continua na seção, depois dos campos.
    expect(corpo.contains($("configHistoryCard"))).toBe(true);
    // Sem o cartão informativo do CNES.
    expect(corpo.textContent).not.toContain("CNES");
  });

  it("heartbeat fora de 1–60 não publica", async () => {
    await montar({ secao: "operacao" });
    await digitar($("configOperacao-accessHeartbeatMinutos"), "61");
    cliente.rpc.mockClear();
    await clicar(salvar());
    expect(cliente.rpc).not.toHaveBeenCalledWith("get_configuracoes_snapshot");
    expect(tituloDoDialogo()).toBe("Corrigir configurações");
    expect(
      $("configOperacao-accessHeartbeatMinutos").getAttribute("aria-invalid"),
    ).toBe("true");
    expect(document.body.textContent).toContain(
      "O heartbeat deve ser um número inteiro entre 1 e 60.",
    );
  });

  it("publica os campos de Operação em p_config_rows, sem monit_id", async () => {
    await montar({ secao: "operacao" });
    await escolher($("configOperacao-featureRealtimeMonitoramento"), "false");
    await digitar($("configOperacao-accessHeartbeatMinutos"), "10");
    await digitar($("configOperacao-cogipVersao"), "V.3.0.0");
    const chamada = await publicar("Operação");
    const linhas = new Map(chamada.p_config_rows.map((l) => [l.chave, l]));
    expect(linhas.get("feature_realtime_monitoramento").valor).toBe("false");
    expect(linhas.get("access_heartbeat_minutos").valor).toBe("10");
    expect(linhas.get("cogip_versao")).toEqual({
      chave: "cogip_versao",
      valor: "V.3.0.0",
      descricao: "Versão do sistema",
    });
    expect(linhas.get("app_version_current").valor).toBe(
      "MONITORA Web V2.9.35",
    );
    expect(linhas.has("monit_id")).toBe(false);
    // Os painéis viajam juntos, sem mudança.
    expect(chamada.p_paineis.map((p) => p.id)).toEqual(["p1", "p2"]);
  });

  it("sem mudança real, nada a publicar", async () => {
    const estado = await montar({ secao: "operacao" });
    await esperar(() => estado.revisar());
    expect(tituloDoDialogo()).toBe("Nenhuma alteração");
  });
});

describe("restaurar versão", () => {
  it("chama a RPC, descarta o rascunho e a recarga repõe os campos", async () => {
    const estado = await montar({ secao: "operacao" });
    await digitar($("configOperacao-cogipVersao"), "rascunho");
    await escolher($("configPainel-0-manutencao"), "true");
    await esperar();
    const cartao = $("configHistoryCard");
    await clicar(
      [...cartao.querySelectorAll(".btn")].find((b) =>
        b.textContent.includes("Restaurar"),
      ),
    );
    expect(tituloDoDialogo()).toBe("Restaurar versão");
    await digitar($("configRestoreReason"), "Voltar");
    await clicar(botaoFinal());
    await esperar();
    expect(cliente.rpc).toHaveBeenCalledWith("restaurar_configuracoes_versao", {
      p_versao_id: "v1",
      p_motivo: "Voltar",
    });
    expect(recarregar).toHaveBeenCalled();
    expect(sujo()).toBe(false);
    expect($("configOperacao-cogipVersao").value).toBe("V.2.7.3");
    expect($("configPainel-0-manutencao").value).toBe("false");

    // A página recarrega: loadConfig e loadPanels publicam os valores restaurados.
    await act(async () => {
      estado.definirValoresCarregados({ ...PUBLICADO, cogip_versao: "V.1" });
      estado.definirPaineisCarregados([
        { ...PAINEIS[0], em_manutencao: true },
        PAINEIS[1],
      ]);
    });
    expect($("configOperacao-cogipVersao").value).toBe("V.1");
    expect($("configPainel-0-manutencao").value).toBe("true");
    expect(sujo()).toBe(false);
  });
});
