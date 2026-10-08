import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditorDeCoordenadas } from "../../src/modulos/mapa-saude-indigena/editor-de-coordenadas.jsx";
import { MapaSaudeIndigena } from "../../src/modulos/mapa-saude-indigena/mapa-saude-indigena.jsx";
import { clicar, digitar } from "../componentes/interacoes.js";
import { criarLeafletFalso } from "./leaflet-falso.js";

const RPC_SALVAR = "salvar_coordenada_mapa_saude_indigena";
const RPC_DESFAZER = "desfazer_coordenada_mapa_saude_indigena";
const RPC_PENDENCIAS = "listar_pendencias_coordenada_mapa_saude_indigena";
const RPC_HISTORICO = "listar_historico_coordenada_mapa_saude_indigena";

const lmap = {
  dsei: [
    {
      k: "A",
      n: "Distrito A",
      lat: -10,
      lon: -50,
      ufs: ["MT"],
      polos: [
        { n: "Polo A", cod: 7, lat: -11, lon: -51 },
        { n: "Polo B", cod: 8, lat: -12, lon: -52 },
      ],
    },
  ],
};
const redeCnes = {
  rede: { A: { u: [["UBSI C", "123", -13, -53, "PORTO REAL", "MT"]] } },
};
const pendenciaDoPoloA = () => ({
  fonte: "lmap",
  tipo: "polo",
  dsei: "A",
  codigo: "7",
  nome: "Polo A",
  municipio: "Lugar Nenhum/MT",
  motivo_tipo: "FONTES_DIVERGEM",
  motivo: "fontes admissíveis não concordam",
  conferido: false,
  candidatos: [
    { f: "IBGE", n: "Aldeia A", lat: -12, lon: -51, ti: "TI A" },
    { f: "CNES", n: "POLO BASE A", lat: -11.1, lon: -51 },
  ],
});
const historicoDoPoloA = () => [
  {
    id: 5,
    em: "2026-10-02T15:00:00Z",
    por: "Ana Admin",
    acao: "CORRECAO",
    latitude_anterior: -10.5,
    longitude_anterior: -51,
    latitude: -11,
    longitude: -51,
    motivo: "Ajuste pelo endereço do CNES",
    conferido: false,
    desfeito: false,
  },
];
const admin = { ativo: true, perfil: "admin", admin_global: true };
const gestor = { ativo: true, perfil: "edital_gestor", admin_global: false };

let host, raiz, leaflet, mapa, props, respostas;
beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  raiz = createRoot(host);
  leaflet = criarLeafletFalso();
  mapa = leaflet.L.map(document.createElement("div"), {});
  const original = leaflet.L.marker;
  leaflet.L.marker = (...args) => {
    const pin = original(...args);
    pin.getLatLng = () => ({ lat: pin.latlng[0], lng: pin.latlng[1] });
    return pin;
  };
  respostas = {
    [RPC_PENDENCIAS]: () => ({ data: [pendenciaDoPoloA()], error: null }),
    [RPC_HISTORICO]: () => ({ data: historicoDoPoloA(), error: null }),
    [RPC_SALVAR]: (args) => ({
      data: { lmap, rede_cnes: redeCnes, conferido: !!args.p_conferido },
      error: null,
    }),
    [RPC_DESFAZER]: () => ({
      data: { lmap, rede_cnes: redeCnes, conferido: false },
      error: null,
    }),
  };
  props = {
    L: leaflet.L,
    mapa,
    lmap,
    redeCnes,
    dsei: "A",
    perfil: admin,
    supabase: {
      rpc: vi.fn(async (nome, args) => respostas[nome](args)),
    },
    aoAtualizarMapa: vi.fn(),
  };
});
afterEach(async () => {
  await act(async () => raiz.unmount());
  host.remove();
  delete globalThis.L;
});

const esperar = () =>
  act(async () => {
    await new Promise((resolver) => setTimeout(resolver, 0));
  });
async function renderizar(atual = props) {
  await act(async () => raiz.render(createElement(EditorDeCoordenadas, atual)));
  await esperar();
}
const botao = (texto) =>
  [...host.querySelectorAll("button")].find((b) => b.textContent === texto);
const itens = () =>
  [...host.querySelectorAll(".mapa-si-coordenadas__nome")].map(
    (e) => e.textContent,
  );
const item = (nome) =>
  [...host.querySelectorAll(".mapa-si-coordenadas__item")].find(
    (b) => b.querySelector(".mapa-si-coordenadas__nome").textContent === nome,
  );
const caixaPendentes = () =>
  host.querySelector('.mapa-si-coordenadas__caixa input[type="checkbox"]');
const contagem = () =>
  host.querySelector(".mapa-si-coordenadas__contagem").textContent;
const chamadas = (nome) =>
  props.supabase.rpc.mock.calls.filter(([n]) => n === nome);

describe("editor de coordenadas: respostas malformadas", () => {
  it("descarta pendências sem registro e candidatos sem posição sem derrubar o editor", async () => {
    respostas[RPC_PENDENCIAS] = () => ({
      data: [null, [], { ...pendenciaDoPoloA(), motivo: {}, candidatos: {} }],
      error: null,
    });
    await renderizar();
    await escolher("Polo · Polo A");
    expect(host.querySelector('[aria-label="Correção"]')).not.toBeNull();
    expect(host.textContent).toContain("Sem posição candidata.");
  });
  it("não oferece desfazer uma alteração antiga quando a mais recente é inválida", async () => {
    respostas[RPC_HISTORICO] = () => ({
      data: [null, ...historicoDoPoloA()],
      error: null,
    });
    await renderizar();
    await escolher("Polo · Polo A");
    expect(host.textContent).toContain("Sem alterações.");
    expect(botao("Desfazer última alteração")).toBeUndefined();
  });
  it("exibe erro e não atualiza o mapa quando a gravação devolve uma resposta inválida", async () => {
    respostas[RPC_SALVAR] = () => ({ data: { latitude: [] }, error: null });
    await renderizar();
    await escolher("Polo · Polo A");
    await digitar(latitude(), "-12");
    await digitar(motivo(), "Ajuste conforme fonte oficial");
    await clicar(botao("Salvar coordenada"));
    await clicar(botao("Confirmar correção"));
    await esperar();
    expect(chamadas(RPC_SALVAR)).toHaveLength(1);
    expect(props.aoAtualizarMapa).not.toHaveBeenCalled();
    expect(host.querySelector('[role="alert"]').textContent).toContain(
      "Resposta inválida ao salvar coordenada.",
    );
    expect(host.textContent).not.toContain("Coordenada salva.");
  });
});
const campoDeTexto = (rotulo) =>
  [...host.querySelectorAll("textarea")].find(
    (t) =>
      t.closest(".ui-campo").querySelector("label").textContent ===
      `${rotulo} *`,
  );
const motivo = () => campoDeTexto("Motivo e fonte da correção");
const latitude = () => host.querySelectorAll("input[inputmode]")[0];
async function escolher(nome) {
  await clicar(item(nome));
  await esperar();
}

describe("editor de coordenadas: permissão e prévia", () => {
  it("oculta edição de não-admin, não lê pendências e retira pin ao perder permissão", async () => {
    await renderizar({
      ...props,
      perfil: { perfil: "admin", admin_global: false },
    });
    expect(host.textContent).toBe("");
    expect(props.supabase.rpc).not.toHaveBeenCalled();
    await renderizar();
    await escolher("Polo · Polo A");
    expect([...mapa.camadas].filter((c) => c.opcoes.draggable)).toHaveLength(1);
    await renderizar({ ...props, perfil: { perfil: "usuario" } });
    expect(host.textContent).toBe("");
    expect([...mapa.camadas].filter((c) => c.opcoes.draggable)).toHaveLength(0);
  });

  it("o Gestor também edita: lê as pendências e escolhe o ponto; leitor não", async () => {
    await renderizar({ ...props, perfil: gestor });
    expect(chamadas(RPC_PENDENCIAS)).toHaveLength(1);
    await escolher("Polo · Polo A");
    expect([...mapa.camadas].filter((c) => c.opcoes.draggable)).toHaveLength(1);
    await renderizar({ ...props, perfil: { ativo: true, perfil: "leitor" } });
    expect(host.textContent).toBe("");
  });

  it("arrasta só o pin de prévia, desfaz sem gravar e exige confirmação antes de salvar", async () => {
    await renderizar();
    await escolher("Polo · Polo A");
    const pin = [...mapa.camadas].find((c) => c.opcoes.draggable);
    await act(async () => {
      pin.setLatLng([-12, -52]);
      pin.fire("dragend");
    });
    expect(lmap.dsei[0].polos[0].lat).toBe(-11);
    expect(latitude().value).toBe("-12.000000");
    await clicar(botao("Desfazer prévia"));
    expect(pin.latlng).toEqual([-11, -51]);
    expect(chamadas(RPC_SALVAR)).toHaveLength(0);
    await digitar(latitude(), "-12,5");
    await digitar(motivo(), "Ajuste conforme fonte oficial");
    await clicar(botao("Salvar coordenada"));
    expect(chamadas(RPC_SALVAR)).toHaveLength(0);
    await clicar(botao("Confirmar correção"));
    expect(props.supabase.rpc).toHaveBeenCalledWith(
      RPC_SALVAR,
      expect.objectContaining({
        p_latitude: -12.5,
        p_longitude: -51,
        p_latitude_anterior: -11,
        p_longitude_anterior: -51,
        p_conferido: false,
        p_alvo: expect.objectContaining({
          tipo: "polo",
          indice: 0,
          nome: "Polo A",
          codigo: "7",
        }),
      }),
    );
    expect(props.aoAtualizarMapa).toHaveBeenCalledWith(
      expect.objectContaining({ lmap, rede_cnes: redeCnes }),
    );
    expect(host.textContent).toContain("Coordenada salva.");
    expect(contagem()).toBe("1 pendente");
  });

  it("preserva prévia e comunica conflito sem anunciar sucesso", async () => {
    respostas[RPC_SALVAR] = () => ({
      error: {
        message: "Coordenada alterada por outra pessoa. Atualize o mapa.",
      },
    });
    await renderizar();
    await escolher("Polo · Polo A");
    await digitar(latitude(), "-12");
    await digitar(motivo(), "Nova fonte oficial consultada");
    await clicar(botao("Salvar coordenada"));
    await clicar(botao("Confirmar correção"));
    expect(host.querySelector('[role="alert"]').textContent).toContain(
      "outra pessoa",
    );
    expect(props.aoAtualizarMapa).not.toHaveBeenCalled();
    expect(latitude().value).toBe("-12");
  });

  it("não tem os parágrafos de instrução genérica nem o select antigo", async () => {
    await renderizar();
    await escolher("Polo · Polo A");
    expect(host.textContent).not.toMatch(/Escolha um ponto para ajustar/);
    expect(host.textContent).not.toMatch(/Arraste o pin de prévia/);
    expect(host.querySelector("select")).toBeNull();
  });
});

describe("editor de coordenadas: fila", () => {
  it("começa em Só pendentes com a contagem e mostra todos ao desligar, por DSEI", async () => {
    await renderizar();
    expect(chamadas(RPC_PENDENCIAS)).toHaveLength(1);
    expect(caixaPendentes().checked).toBe(true);
    expect(contagem()).toBe("1 pendente");
    expect(itens()).toEqual(["Polo · Polo A"]);
    // A aldeia sugerida está a 111 km: provável erro, com o resumo na fila.
    expect(item("Polo · Polo A").textContent).toContain("Provável erro");
    expect(item("Polo · Polo A").textContent).toContain(
      "aldeia Aldeia A a 111 km (IBGE)",
    );
    await clicar(caixaPendentes());
    expect(itens()).toEqual([
      "Polo · Polo A",
      "Polo · Polo B",
      "Sede · Distrito A",
      "Unidade CNES · UBSI C",
    ]);
    expect(contagem()).toBe("1 pendente");
  });

  it("busca por CNES, município e nome, sem acento nem caixa", async () => {
    await renderizar();
    await clicar(caixaPendentes());
    const busca = host.querySelector('input[type="search"]');
    await digitar(busca, "123");
    expect(itens()).toEqual(["Unidade CNES · UBSI C"]);
    await digitar(busca, "pórto real");
    expect(itens()).toEqual(["Unidade CNES · UBSI C"]);
    await digitar(busca, "polo b");
    expect(itens()).toEqual(["Polo · Polo B"]);
    await digitar(busca, "nada disso");
    expect(itens()).toEqual([]);
    expect(host.textContent).toContain("Nenhum ponto.");
  });

  it("ao escolher, enquadra o ponto e a sugestão mais provável, desenhadas no mapa", async () => {
    await renderizar();
    await escolher("Polo · Polo A");
    expect(item("Polo · Polo A").getAttribute("aria-pressed")).toBe("true");
    const voo = mapa.chamadas.filter((c) => c[0] === "flyToBounds").at(-1);
    expect(JSON.stringify(voo[1])).toContain("-11");
    expect(JSON.stringify(voo[1])).toContain("-12");
    expect(host.querySelector("[data-melhor] .ui-selo").textContent).toBe(
      "Mais provável",
    );
  });

  it("filtra por gravidade e desliga o filtro ao clicar de novo", async () => {
    await renderizar();
    const erro = host.querySelector('[data-nivel="erro"]');
    expect(erro.textContent).toContain("1");
    expect(host.querySelector('[data-nivel="confirmar"]').disabled).toBe(true);
    await clicar(erro);
    expect(erro.getAttribute("aria-pressed")).toBe("true");
    expect(itens()).toEqual(["Polo · Polo A"]);
    await clicar(erro);
    expect(erro.getAttribute("aria-pressed")).toBe("false");
  });

  it("avisa quando as pendências não carregam e a lista completa continua", async () => {
    respostas[RPC_PENDENCIAS] = () => ({ error: { message: "Sem rede." } });
    await renderizar();
    expect(host.querySelector('[role="alert"]').textContent).toBe("Sem rede.");
    await clicar(caixaPendentes());
    expect(itens()).toHaveLength(4);
  });
});

describe("editor de coordenadas: conferido", () => {
  it("confere sem mudar a posição: confirma, grava com p_conferido e some de Só pendentes", async () => {
    await renderizar();
    await escolher("Polo · Polo A");
    await digitar(motivo(), "Confirmado com a equipe do DSEI");
    await clicar(botao("Conferido"));
    expect(chamadas(RPC_SALVAR)).toHaveLength(0);
    expect(host.textContent).toContain(
      "Confirme que a posição atual de Polo · Polo A está certa.",
    );
    await clicar(botao("Confirmar conferência"));
    expect(props.supabase.rpc).toHaveBeenCalledWith(
      RPC_SALVAR,
      expect.objectContaining({
        p_latitude: -11,
        p_longitude: -51,
        p_latitude_anterior: -11,
        p_longitude_anterior: -51,
        p_conferido: true,
      }),
    );
    await esperar();
    expect(host.textContent).toContain("Ponto conferido.");
    expect(contagem()).toBe("0 pendentes");
    expect(itens()).toEqual([]);
    expect(host.textContent).toContain("Nenhum ponto pendente.");
    expect(
      host.querySelector(".mapa-si-coordenadas__escolhido").textContent,
    ).toContain("Conferido");
    expect(botao("Conferido")).toBeUndefined();
    expect(chamadas(RPC_HISTORICO).length).toBeGreaterThan(1);
  });

  it("confere com nova posição e exige motivo", async () => {
    await renderizar();
    await escolher("Polo · Polo A");
    await digitar(latitude(), "-11,2");
    await clicar(botao("Conferido"));
    expect(host.querySelector('[role="alert"]').textContent).toContain(
      "motivo",
    );
    await digitar(motivo(), "Aldeia confirmada na Funai");
    await clicar(botao("Conferido"));
    expect(host.textContent).toContain(
      "Confirme a nova posição e a conferência de Polo · Polo A.",
    );
    await clicar(botao("Confirmar conferência"));
    expect(props.supabase.rpc).toHaveBeenCalledWith(
      RPC_SALVAR,
      expect.objectContaining({ p_latitude: -11.2, p_conferido: true }),
    );
  });

  it("ponto sem pendência não tem Conferido nem sugestões", async () => {
    await renderizar();
    await clicar(caixaPendentes());
    await escolher("Polo · Polo B");
    expect(botao("Conferido")).toBeUndefined();
    expect(host.querySelector('[aria-label="Sugestões"]')).toBeNull();
  });
});

describe("editor de coordenadas: sugestões", () => {
  it("lista candidatos com a distância e Usar esta preenche a prévia sem gravar", async () => {
    await renderizar();
    await escolher("Polo · Polo A");
    const sugestoes = host.querySelector('[aria-label="Sugestões"]');
    expect(sugestoes.textContent).toContain("fontes admissíveis não concordam");
    const linhas = [...sugestoes.querySelectorAll("li")].map(
      (l) => l.textContent,
    );
    // A mais provável (a aldeia) vem primeiro; depois o CNES.
    expect(linhas[0]).toContain("Mais provável");
    expect(linhas[0]).toContain("Aldeia · IBGE");
    expect(linhas[0]).toContain("TI A");
    expect(linhas[1]).toContain("CNES/DATASUS");
    expect(linhas[1]).toContain("11 km da atual");
    await clicar(sugestoes.querySelector("button"));
    expect(latitude().value).toBe("-12.000000");
    const pin = [...mapa.camadas].find((c) => c.opcoes.draggable);
    expect(pin.latlng).toEqual([-12, -51]);
    expect(chamadas(RPC_SALVAR)).toHaveLength(0);
  });

  it("a dica do círculo é texto: nome de base externa não vira HTML", async () => {
    respostas[RPC_PENDENCIAS] = () => {
      const pendencia = pendenciaDoPoloA();
      pendencia.candidatos[0].n = '<img src=x onerror="alert(1)">';
      return { data: [pendencia], error: null };
    };
    await renderizar();
    await escolher("Polo · Polo A");
    const circulos = [...mapa.camadas]
      .flatMap((c) => [...(c.camadas || [])])
      .filter((c) => c.tipo === "circleMarker");
    expect(circulos.length).toBeGreaterThan(0);
    for (const c of circulos) expect(typeof c.dica).not.toBe("string");
    const dicas = circulos.map((c) => c.dica.textContent).join(" ");
    expect(dicas).toContain('<img src=x onerror="alert(1)">');
  });
});

describe("editor de coordenadas: histórico e desfazer", () => {
  it("mostra quem, quando, de → para e motivo", async () => {
    await renderizar();
    await escolher("Polo · Polo A");
    expect(chamadas(RPC_HISTORICO).at(-1)[1]).toEqual({
      p_alvo: expect.objectContaining({ nome: "Polo A", codigo: "7" }),
      p_limite: 5,
    });
    const bloco = host.querySelector('[aria-label="Histórico do ponto"]');
    expect(bloco.textContent).toContain("Correção");
    expect(bloco.textContent).toContain("Ana Admin");
    expect(bloco.textContent).toContain("02/10/2026");
    expect(bloco.textContent).toContain(
      "-10.500000, -51.000000 → -11.000000, -51.000000",
    );
    expect(bloco.textContent).toContain("Ajuste pelo endereço do CNES");
  });

  it("desfaz a última alteração com motivo e recarrega o histórico", async () => {
    await renderizar();
    await escolher("Polo · Polo A");
    const leiturasAntes = chamadas(RPC_HISTORICO).length;
    await clicar(botao("Desfazer última alteração"));
    await digitar(campoDeTexto("Motivo do desfazer"), "curto");
    await clicar(botao("Confirmar desfazer"));
    expect(chamadas(RPC_DESFAZER)).toHaveLength(0);
    expect(host.textContent).toContain("mínimo de 10 caracteres");
    await digitar(
      campoDeTexto("Motivo do desfazer"),
      "Correção feita no ponto errado",
    );
    await clicar(botao("Confirmar desfazer"));
    expect(props.supabase.rpc).toHaveBeenCalledWith(RPC_DESFAZER, {
      p_historico: 5,
      p_motivo: "Correção feita no ponto errado",
    });
    await esperar();
    expect(props.aoAtualizarMapa).toHaveBeenCalled();
    expect(host.textContent).toContain("Alteração desfeita.");
    expect(chamadas(RPC_HISTORICO).length).toBeGreaterThan(leiturasAntes);
  });

  it("não oferece desfazer de um desfazer nem de alteração já desfeita", async () => {
    respostas[RPC_HISTORICO] = () => ({
      data: [
        { ...historicoDoPoloA()[0], id: 6, acao: "DESFAZER", desfaz: 5 },
        { ...historicoDoPoloA()[0], desfeito: true },
      ],
      error: null,
    });
    await renderizar();
    await escolher("Polo · Polo A");
    expect(host.textContent).toContain("(desfeita)");
    expect(botao("Desfazer última alteração")).toBeUndefined();
  });
});

describe("entrada do editor no mapa", () => {
  it("mostra Coordenadas para admin e Gestor nos mapas nacional e do distrito", async () => {
    globalThis.L = leaflet.L;
    const renderMapa = async (perfil, dseiSelecionado) =>
      act(async () =>
        raiz.render(
          createElement(MapaSaudeIndigena, {
            lmap,
            redeCnes: {},
            perfil,
            dseiSelecionado,
          }),
        ),
      );
    await renderMapa({ perfil: "usuario" }, "A");
    expect(botao("Coordenadas")).toBeUndefined();
    await renderMapa(admin, "A");
    expect(host.querySelector(".mapa-si-painel--dsei").textContent).toContain(
      "Coordenadas",
    );
    await renderMapa(admin, null);
    expect(
      host.querySelector(".mapa-si-painel--nacional").textContent,
    ).toContain("Coordenadas");
    await renderMapa(gestor, "A");
    expect(host.querySelector(".mapa-si-painel--dsei").textContent).toContain(
      "Coordenadas",
    );
    await renderMapa(gestor, null);
    expect(
      host.querySelector(".mapa-si-painel--nacional").textContent,
    ).toContain("Coordenadas");
    await renderMapa({ ativo: true, perfil: "leitor" }, null);
    expect(botao("Coordenadas")).toBeUndefined();
  });
});
