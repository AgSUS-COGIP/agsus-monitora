import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import {
  SECAO_PADRAO,
  SECAO_POR_BLOCO,
  SECAO_POR_CAMPO,
  SECOES,
  organizarConfiguracoesEmSecoes,
  removerNavegadorAntigo,
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
      "Recursos",
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

describe("navegador e busca", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <section id="page-config">
        <div class="admin-grid"><div class="admin-card"><div class="form-grid">
          <div class="form-row"><label>Título</label><input id="cfgTitle" /></div>
          <div class="form-row"><label>Heartbeat de auditoria</label><input id="cfgAccessHeartbeatMinutos" /></div>
        </div></div></div>
      </section>`;
    organizarConfiguracoesEmSecoes(document);
  });

  const visiveis = () =>
    [...document.querySelectorAll(".config-secao")]
      .filter((s) => !s.hidden)
      .map((s) => s.dataset.secao);

  it("mostra tudo por padrão", () => {
    expect(visiveis()).toHaveLength(7);
    expect(document.getElementById("configContagemSecoes").textContent).toBe(
      "7 seções disponíveis",
    );
  });

  it("filtra por seção e concorda em número", () => {
    document.querySelector('[data-secao="marca"]').click();
    expect(visiveis()).toEqual(["marca"]);
    expect(document.getElementById("configContagemSecoes").textContent).toBe(
      "1 seção disponível",
    );
  });

  it("volta a mostrar tudo", () => {
    document.querySelector('[data-secao="marca"]').click();
    document.querySelector('[data-secao="tudo"]').click();
    expect(visiveis()).toHaveLength(7);
  });

  /*
    A busca olha o conteúdo da seção, não só o nome dela: procurar "heartbeat"
    tem de achar Operação, onde o campo está.
  */
  it("a busca encontra pelo conteúdo, não só pelo título", () => {
    const busca = document.getElementById("configBuscaSecao");
    busca.value = "heartbeat";
    busca.dispatchEvent(new Event("input"));
    expect(visiveis()).toEqual(["operacao"]);
  });

  it("o botão ativo acompanha a escolha", () => {
    document.querySelector('[data-secao="acessos"]').click();
    expect(
      document
        .querySelector('[data-secao="acessos"]')
        .classList.contains("is-active"),
    ).toBe(true);
    expect(
      document
        .querySelector('[data-secao="tudo"]')
        .classList.contains("is-active"),
    ).toBe(false);
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
  Regressão introduzida pelo #170: `config-page-enhancements.js` já montava a
  sua própria barra — cinco abas, um campo de busca e um contador — e eu
  acrescentei o navegador do SIGAV sem remover aquilo.

  Medido em produção: 5 abas antigas, duas buscas e dois contadores que se
  contradiziam, "1 seção disponível" no topo contra "7 seções disponíveis" ao
  lado. O "1" vinha de o filtro antigo classificar os `.admin-card` originais,
  que agora estão vazios e ocultos.
*/
describe("um navegador só", () => {
  const montarComBarraAntiga = () => {
    document.body.innerHTML = `
      <section id="page-config">
        <section id="configWorkspaceToolbar">
          <div class="config-workspace-heading">
            <h2>Configurações</h2>
            <div class="config-search-wrap"><input id="configWorkspaceSearch" /></div>
          </div>
          <div class="config-workspace-tabs">
            <button data-config-tab="all">Tudo</button>
            <button data-config-tab="access">Acessos</button>
          </div>
          <div class="config-workspace-meta">
            <span id="configWorkspaceResultCount">1 seção disponível</span>
            <span id="configWorkspaceDirtyTop" hidden>Alterações não salvas</span>
          </div>
          <div id="configValidationSummary" hidden></div>
        </section>
        <div class="admin-grid"><div class="admin-card"><div class="form-grid">
          <div class="form-row"><label>Título</label><input id="cfgTitle" /></div>
        </div></div></div>
      </section>`;
  };

  beforeEach(montarComBarraAntiga);

  it("remove abas, busca e contador antigos", () => {
    expect(removerNavegadorAntigo(document)).toBe(true);
    expect(document.querySelectorAll("[data-config-tab]")).toHaveLength(0);
    expect(document.getElementById("configWorkspaceSearch")).toBeNull();
    expect(document.getElementById("configWorkspaceResultCount")).toBeNull();
  });

  /*
    O que a barra antiga tem de único não pode ir junto: ela continua sendo a
    única dona do indicador de alterações e do resumo de validação.
  */
  it("preserva o que só a barra antiga oferece", () => {
    removerNavegadorAntigo(document);
    expect(document.querySelector(".config-workspace-heading")).toBeTruthy();
    expect(document.getElementById("configWorkspaceDirtyTop")).toBeTruthy();
    expect(document.getElementById("configValidationSummary")).toBeTruthy();
  });

  it("é inofensivo quando a barra antiga não existe", () => {
    document.body.innerHTML = '<section id="page-config"></section>';
    expect(removerNavegadorAntigo(document)).toBe(false);
  });

  it("sobra um contador só, o novo", () => {
    organizarConfiguracoesEmSecoes(document);
    removerNavegadorAntigo(document);
    const contadores = document.querySelectorAll(
      "#configWorkspaceResultCount, #configContagemSecoes",
    );
    expect(contadores).toHaveLength(1);
    expect(contadores[0].id).toBe("configContagemSecoes");
  });

  /*
    A barra antiga só existe depois de `initConfigPageEnhancements()` montá-la.
    Remover antes disso não encontraria nada — e ela voltaria em seguida.
  */
  it("a remoção corre depois de quem monta a barra antiga", () => {
    expect(main.indexOf("removerNavegadorAntigo()")).toBeGreaterThan(
      main.indexOf("initConfigPageEnhancements()"),
    );
  });
});
