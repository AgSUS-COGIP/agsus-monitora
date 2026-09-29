import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  SECAO_PADRAO,
  SECAO_POR_BLOCO,
  SECAO_POR_CAMPO,
  SECOES,
  abrirSecaoDeConfiguracao,
  definirSecoesPermitidas,
  organizarConfiguracoesEmSecoes,
  anexarNaSecao,
  secaoAtualDeConfiguracao,
  secaoDoCampo,
} from "../src/modules/config-secoes.js";

const html = readFileSync("index.html", "utf8");
const main = readFileSync("src/main.js", "utf8");
const modulo = readFileSync("src/modules/config-secoes.js", "utf8");

/*
  A página era um formulário corrido: um card com 47 campos e três subtítulos
  soltos. Agora tem as mesmas sete seções do SIGAV, com navegador e busca.

  O ponto delicado não é o desenho, é não quebrar o salvamento: os 45 campos têm
  `id` fixo, de que dependem `saveAdminSettings`, o `FIELD_MAP` da governança,
  `applyConfigToUi`, o aviso de contraste e a validação. Por isso o módulo
  **move** os nós existentes em vez de reescrever o HTML — os mesmos elementos,
  com os mesmos `id` e os mesmos listeners.
*/
describe("as sete seções do SIGAV", () => {
  it("são exatamente essas, nessa ordem", () => {
    expect(SECOES.map((s) => s.rotulo)).toEqual([
      "Marca",
      "Página inicial",
      "Tela de acesso",
      "Aparência",
      "Painéis externos",
      "Operação",
      "Acessos",
    ]);
  });

  it("cada uma tem ícone e descrição", () => {
    for (const secao of SECOES) {
      expect(secao.icone, `${secao.rotulo} sem ícone`).toMatch(/^fa-/);
      expect(
        secao.descricao.length,
        `${secao.rotulo} sem descrição`,
      ).toBeGreaterThan(20);
    }
  });
});

describe("o mapa de campos", () => {
  /*
    Os campos do Monitora não são os do SIGAV — há KPIs, filtros e painéis
    externos que lá não existem. Este mapa é a única tradução, e um campo sem
    entrada cai em "Operação" em vez de sumir da tela.
  */
  it("aponta todo campo para uma seção que existe", () => {
    const ids = new Set(SECOES.map((s) => s.id));
    for (const [campo, secao] of Object.entries(SECAO_POR_CAMPO)) {
      expect(ids, `${campo} aponta para "${secao}", que não existe`).toContain(
        secao,
      );
    }
    for (const [bloco, secao] of Object.entries(SECAO_POR_BLOCO)) {
      expect(ids, `${bloco} aponta para "${secao}"`).toContain(secao);
    }
    expect(ids).toContain(SECAO_PADRAO);
  });

  it("um campo desconhecido cai no padrão, não no vazio", () => {
    expect(secaoDoCampo("cfgInventadoAgora")).toBe(SECAO_PADRAO);
  });

  /*
    Tripwire: se alguém acrescentar um campo ao formulário e esquecer o mapa,
    ele vai parar em "Operação" sem ninguém notar. Este teste nomeia os que
    ainda não foram classificados de propósito.
  */
  it("todo campo do formulário está classificado explicitamente", () => {
    const inicio = html.indexOf('id="page-config"');
    const bloco = html.slice(
      inicio,
      html.indexOf('<section id="page-', inicio + 10),
    );
    const naoMapeados = [
      ...bloco.matchAll(
        /<div class="form-row[^>]*>[\s\S]{0,400}?id="(cfg[A-Za-z0-9]+)"/g,
      ),
    ]
      .map((m) => m[1])
      .filter((id) => !(id in SECAO_POR_CAMPO));
    expect(naoMapeados).toEqual([]);
  });
});

describe("organizar move sem destruir", () => {
  const montarPagina = () => {
    document.body.innerHTML = `
      <section id="page-config">
        <div class="admin-grid">
          <div class="admin-card">
            <div class="form-grid">
              <div class="form-row"><label>Título</label><input id="cfgTitle" value="AgSUS" /></div>
              <div class="form-row"><label>KPI vagas</label><input id="cfgKpiVagas" value="Vagas" /></div>
              <div class="form-row"><label>Cor</label><input id="cfgAccessPanelColor" type="color" /></div>
              <div class="form-row"><label>Heartbeat</label><input id="cfgAccessHeartbeatMinutos" value="5" /></div>
            </div>
          </div>
          <div class="card"><div id="panelAdmin"></div></div>
          <div class="card"><div id="accessMonitorCard"></div></div>
        </div>
      </section>`;
  };

  beforeEach(montarPagina);

  it("cria as sete seções e distribui os campos", () => {
    expect(organizarConfiguracoesEmSecoes(document)).toBe(true);
    expect(document.querySelectorAll(".config-secao")).toHaveLength(7);
    expect(
      document
        .querySelector('.config-secao[data-secao="marca"]')
        .contains(document.getElementById("cfgTitle")),
    ).toBe(true);
    expect(
      document
        .querySelector('.config-secao[data-secao="inicio"]')
        .contains(document.getElementById("cfgKpiVagas")),
    ).toBe(true);
    expect(
      document
        .querySelector('.config-secao[data-secao="aparencia"]')
        .contains(document.getElementById("cfgAccessPanelColor")),
    ).toBe(true);
  });

  /*
    O que faz a reorganização ser segura: mover não recria. Se o elemento fosse
    reconstruído, o valor digitado e os listeners iriam junto com ele.
  */
  it("preserva o mesmo nó, com valor e listener", () => {
    const antes = document.getElementById("cfgTitle");
    let ouviu = 0;
    antes.addEventListener("input", () => (ouviu += 1));
    antes.value = "digitado";

    organizarConfiguracoesEmSecoes(document);

    const depois = document.getElementById("cfgTitle");
    expect(depois).toBe(antes);
    expect(depois.value).toBe("digitado");
    depois.dispatchEvent(new Event("input"));
    expect(ouviu).toBe(1);
  });

  it("nenhum campo fica fora de uma seção", () => {
    organizarConfiguracoesEmSecoes(document);
    const fora = [
      ...document.querySelectorAll('#page-config [id^="cfg"]'),
    ].filter((e) => !e.closest(".config-secao"));
    expect(fora.map((e) => e.id)).toEqual([]);
  });

  it("blocos inteiros vão para a seção certa", () => {
    organizarConfiguracoesEmSecoes(document);
    expect(
      document
        .querySelector('.config-secao[data-secao="recursos"]')
        .contains(document.getElementById("panelAdmin")),
    ).toBe(true);
    expect(
      document
        .querySelector('.config-secao[data-secao="acessos"]')
        .contains(document.getElementById("accessMonitorCard")),
    ).toBe(true);
  });

  /*
    A grade antiga só some se de facto esvaziou. Escondê-la às cegas apagaria
    da tela qualquer campo que o mapa tivesse deixado para trás.
  */
  it("a grade antiga só é escondida quando não resta campo nela", () => {
    organizarConfiguracoesEmSecoes(document);
    expect(document.querySelector("#page-config .admin-grid").hidden).toBe(
      true,
    );

    montarPagina();
    const sobra = document.createElement("input");
    sobra.id = "sobraNaoMapeada";
    document.querySelector("#page-config .admin-grid").appendChild(sobra);
    organizarConfiguracoesEmSecoes(document);
    expect(document.querySelector("#page-config .admin-grid").hidden).toBe(
      false,
    );
  });

  it("não organiza duas vezes", () => {
    expect(organizarConfiguracoesEmSecoes(document)).toBe(true);
    expect(organizarConfiguracoesEmSecoes(document)).toBe(false);
    expect(document.querySelectorAll(".config-secao")).toHaveLength(7);
  });
});

/*
  As sete seções são as páginas da área Administração do menu lateral
  (`src/lib/menu-lateral.js`). O menu navega até Configurações e chama
  `abrirSecaoDeConfiguracao`; quem marca o item ativo é o próprio menu, testado
  em `tests/componentes/barra-lateral.test.js`.
*/
describe("as seções como páginas de Administração", () => {
  beforeEach(() => {
    document.body.className = "";
    document.body.innerHTML =
      '<section id="page-config" class="page"><div class="admin-grid"><div class="form-row"><input id="cfgTitle" value="AgSUS"></div></div></section>';
    organizarConfiguracoesEmSecoes(document);
  });
  afterEach(() => {
    delete window.acessosController;
  });

  it("não cria navegador próprio: quem navega é o menu lateral", () => {
    expect(document.querySelector(".config-nav")).toBeNull();
    expect(document.getElementById("configBuscaSecao")).toBeNull();
    expect(modulo).not.toContain("configSubmenu");
    expect(modulo).not.toContain("insertAdjacentHTML");
  });

  it("começa em Marca e informa a seção aberta", () => {
    expect(secaoAtualDeConfiguracao(document)).toBe("marca");
    expect(
      document.querySelector('.config-secao[data-secao="marca"]').hidden,
    ).toBe(false);
  });

  it("troca a seção sem recriar campos nem perder valores pendentes", () => {
    const campo = document.getElementById("cfgTitle");
    campo.value = "Rascunho";

    expect(abrirSecaoDeConfiguracao(document, "acessos")).toBe(true);
    expect(secaoAtualDeConfiguracao(document)).toBe("acessos");
    expect(
      document.querySelector('.config-secao[data-secao="acessos"]').hidden,
    ).toBe(false);
    expect(
      document.querySelector('.config-secao[data-secao="marca"]').hidden,
    ).toBe(true);

    abrirSecaoDeConfiguracao(document, "marca");
    expect(document.getElementById("cfgTitle")).toBe(campo);
    expect(campo.value).toBe("Rascunho");
  });

  it("recusa seção que não existe e não muda a aberta", () => {
    expect(abrirSecaoDeConfiguracao(document, "inexistente")).toBe(false);
    expect(secaoAtualDeConfiguracao(document)).toBe("marca");
  });

  it("Acessos carrega a tela React de acessos; as outras, não", () => {
    let cargas = 0;
    window.acessosController = {
      render: () => {
        cargas += 1;
      },
      confirmarSaida: () => true,
    };
    abrirSecaoDeConfiguracao(document, "operacao");
    expect(cargas).toBe(0);
    abrirSecaoDeConfiguracao(document, "acessos");
    expect(cargas).toBe(1);
  });

  it("sair de Acessos com alteração não salva recusada fica em Acessos", () => {
    window.acessosController = { render() {}, confirmarSaida: () => false };
    abrirSecaoDeConfiguracao(document, "acessos");
    expect(abrirSecaoDeConfiguracao(document, "marca")).toBe(false);
    expect(secaoAtualDeConfiguracao(document)).toBe("acessos");
  });

  it("só abre as seções permitidas; a aberta proibida cede à primeira permitida", () => {
    definirSecoesPermitidas(document, ["acessos"]);
    expect(secaoAtualDeConfiguracao(document)).toBe("acessos");
    expect(abrirSecaoDeConfiguracao(document, "marca")).toBe(false);
    expect(secaoAtualDeConfiguracao(document)).toBe("acessos");
  });

  it("em Acessos o botão fixo de salvar configurações some", () => {
    const barra = document.createElement("div");
    barra.className = "config-sticky-actions";
    document.getElementById("page-config").appendChild(barra);
    abrirSecaoDeConfiguracao(document, "acessos");
    expect(barra.hidden).toBe(true);
    abrirSecaoDeConfiguracao(document, "marca");
    expect(barra.hidden).toBe(false);
  });
});

describe("integração no arranque", () => {
  /*
    A barra lateral injeta os próprios campos em Configurações. Organizar antes
    disso deixaria esses campos na grade antiga — foi o que aconteceu na
    primeira tentativa, com nove campos órfãos.
  */
  it("organiza depois de a barra lateral injetar os campos dela", () => {
    expect(main.indexOf("organizarConfiguracoesEmSecoes()")).toBeGreaterThan(
      main.indexOf("initSidebarBranding()"),
    );
  });

  it("o módulo não reescreve markup, move nós", () => {
    expect(modulo).toContain("appendChild");
    expect(modulo).not.toMatch(/innerHTML\s*=\s*""/);
  });
});

/*
  Um navegador só: a barra antiga de config-page-enhancements.js (cinco abas,
  busca e contador) saiu junto com o arquivo; o navegador é o menu de seções.
  Blocos que nascem depois da organização entram numa seção por anexarNaSecao.
*/
describe("um navegador só", () => {
  it("o arquivo da barra antiga não é mais instalado", () => {
    expect(main).not.toContain("config-page-enhancements");
    expect(main).not.toContain("removerNavegadorAntigo");
  });

  it("anexarNaSecao põe o bloco no corpo da seção pedida", () => {
    document.body.innerHTML = `
      <section id="page-config">
        <div class="admin-grid"><div class="admin-card"><div class="form-grid">
          <div class="form-row"><label>Título</label><input id="cfgTitle" /></div>
        </div></div></div>
      </section>`;
    organizarConfiguracoesEmSecoes(document);
    const bloco = document.createElement("div");
    expect(anexarNaSecao(document, "operacao", bloco)).toBe(true);
    expect(bloco.closest('.config-secao[data-secao="operacao"]')).toBeTruthy();
    expect(bloco.closest("[hidden]:not(.config-secao)")).toBeNull();
  });

  it("sem seções, devolve false e não mexe no bloco", () => {
    document.body.innerHTML = '<section id="page-config"></section>';
    const bloco = document.createElement("div");
    expect(anexarNaSecao(document, "operacao", bloco)).toBe(false);
    expect(bloco.parentNode).toBeNull();
  });
});

describe("agrupadores que ficam vazios depois de distribuir", () => {
  it("escondem-se (título órfão e caixa sem campos); com campo, continuam", async () => {
    const { esconderAgrupadoresVazios } =
      await import("../src/modules/config-secoes.js");
    document.body.innerHTML = `
      <div id="raiz">
        <div class="admin-card card config-main-card" id="orfao">
          <div class="config-card-title"><h3>Aviso global</h3></div>
          <div class="form-grid"><details id="vazia"><summary>Avançado técnico</summary></details></div>
        </div>
        <div class="admin-card card config-main-card" id="cheio">
          <div class="config-card-title"><h3>Com campo</h3></div>
          <div class="form-grid"><details id="cheia"><summary>X</summary><input id="c"></details></div>
        </div>
      </div>`;
    expect(esconderAgrupadoresVazios(document.getElementById("raiz"))).toBe(2);
    expect(document.querySelector("#orfao .config-card-title").hidden).toBe(
      true,
    );
    expect(document.getElementById("vazia").hidden).toBe(true);
    expect(document.querySelector("#cheio .config-card-title").hidden).toBe(
      false,
    );
    expect(document.getElementById("cheia").hidden).toBe(false);
  });
});

describe("campos técnicos ficam em Operação", () => {
  it("o Realtime do monitoramento não cai na seção de painéis externos", () => {
    document.body.innerHTML = `
      <section id="page-config" class="page active">
        <div class="admin-grid">
          <div class="form-row"><select id="cfgRealtimeEnabled"></select></div>
        </div>
      </section>`;
    organizarConfiguracoesEmSecoes(document);
    const secao = document
      .getElementById("cfgRealtimeEnabled")
      .closest(".config-secao");
    expect(secao.dataset.secao).toBe("operacao");
  });
});
