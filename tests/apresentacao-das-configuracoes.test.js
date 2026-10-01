import { beforeEach, describe, expect, it } from "vitest";
import {
  DICAS_DOS_CAMPOS,
  GRUPOS_POR_SECAO,
  primeiroDominio,
  tomDoAviso,
  urlDeImagem,
} from "../src/lib/apresentacao-das-configuracoes.js";
import { SECAO_POR_CAMPO } from "../src/modules/config-secoes.js";
import {
  atualizarPrevias,
  instalarApresentacaoDasConfiguracoes,
} from "../src/modules/config-apresentacao.js";

describe("regras da apresentação", () => {
  it("todo campo de grupo existe no mapa de seções e está na seção do grupo", () => {
    for (const [secao, grupos] of Object.entries(GRUPOS_POR_SECAO))
      for (const grupo of grupos)
        for (const campo of grupo.campos)
          expect(SECAO_POR_CAMPO[campo], campo).toBe(secao);
  });

  it("aviso: cada tipo tem tom, ícone e rótulo; desconhecido vira informação", () => {
    expect(tomDoAviso("danger")).toMatchObject({
      tom: "danger",
      rotulo: "Crítico",
    });
    expect(tomDoAviso("warning").tom).toBe("warning");
    expect(tomDoAviso("xyz").tom).toBe("info");
  });

  it("imagem só de caminho do site ou http(s)", () => {
    expect(urlDeImagem("/assets/logo.png")).toBe("/assets/logo.png");
    expect(urlDeImagem("https://x.org/l.png")).toBe("https://x.org/l.png");
    expect(urlDeImagem("javascript:alert(1)")).toBe("");
    expect(urlDeImagem("data:image/png;base64,AAA")).toBe("");
    expect(urlDeImagem("//outro.site/l.png")).toBe("");
  });

  it("primeiro domínio da lista", () => {
    expect(primeiroDominio(" @AgenciaSUS.org.br, agsus.org.br")).toBe(
      "agenciasus.org.br",
    );
  });

  it("Painéis externos e Operação saíram do legado (são React)", () => {
    expect(Object.keys(GRUPOS_POR_SECAO)).toEqual(["inicio", "acesso"]);
    expect(DICAS_DOS_CAMPOS).not.toHaveProperty("cfgRealtimeEnabled");
  });
});

function montarPagina() {
  document.body.innerHTML = `
    <section id="page-config">
      <article class="config-secao" data-secao="inicio">
        <header class="config-secao__cabecalho"></header>
        <div class="config-secao__corpo form-grid">
          <div class="form-row"><label for="cfgPageTitle">Título</label><input id="cfgPageTitle" value="Painel"></div>
          <div class="form-row"><label for="cfgBroadcastType">Tipo</label>
            <select id="cfgBroadcastType"><option value="info">Info</option><option value="danger">Crítico</option></select></div>
          <div class="form-row"><label for="cfgBroadcastMsg">Mensagem</label><input id="cfgBroadcastMsg" value=""></div>
          <div class="form-row" style="display: none"><label for="cfgFilterTitle">Filtros</label><input id="cfgFilterTitle"></div>
        </div>
      </article>
    </section>`;
}

describe("montagem na página", () => {
  beforeEach(montarPagina);

  it("agrupa os mesmos campos, põe a dica e esconde grupo sem campo visível", () => {
    const campo = document.getElementById("cfgBroadcastMsg");
    expect(instalarApresentacaoDasConfiguracoes(document)).toBe(true);
    expect(document.getElementById("cfgBroadcastMsg")).toBe(campo);
    expect(campo.closest('.config-grupo[data-grupo="aviso"]')).not.toBeNull();
    expect(
      document.querySelector('.config-grupo[data-grupo="filtros"]').hidden,
    ).toBe(true);
    const dica = document.querySelector(
      'label[for="cfgBroadcastMsg"] + .config-dica',
    );
    expect(dica.dataset.dica).toMatch(/em branco/);
    expect(campo.getAttribute("aria-describedby")).toBe("cfgBroadcastMsgDica");
    expect(instalarApresentacaoDasConfiguracoes(document)).toBe(false);
  });

  it("a prévia acompanha o que se digita, como texto (nada de HTML)", async () => {
    instalarApresentacaoDasConfiguracoes(document);
    const previa = () => document.querySelector(".config-previa__conteudo");
    expect(previa().textContent).toContain("Sem aviso no topo");
    document.getElementById("cfgBroadcastType").value = "danger";
    document.getElementById("cfgBroadcastMsg").value =
      "<img src=x onerror=alert(1)>Manutenção às 18h";
    atualizarPrevias(document);
    expect(
      previa().querySelector('.previa-aviso[data-tom="danger"]').textContent,
    ).toContain("Crítico: <img src=x");
    expect(previa().querySelector("img")).toBeNull();
    expect(previa().textContent).toContain("Painel");
  });
});
