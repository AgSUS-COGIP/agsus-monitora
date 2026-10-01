import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  SECAO_POR_BLOCO,
  SECOES,
  abrirSecaoDeConfiguracao,
  definirSecoesPermitidas,
  organizarConfiguracoesEmSecoes,
  EVENTO_SECAO_ABERTA,
  secaoAtualDeConfiguracao,
} from "../src/modules/config-secoes.js";

const html = readFileSync("index.html", "utf8");
const main = readFileSync("src/main.js", "utf8");
const modulo = readFileSync("src/modules/config-secoes.js", "utf8");

/*
  A página era um formulário corrido: um card com 47 campos e três subtítulos
  soltos. Agora tem as mesmas sete seções do SIGAV, mais Módulos e abas e
  Status das atualizações (só admin global). O conteúdo de cada seção é
  React (src/componentes/configuracoes/ e as ilhas de Acessos, Módulos e
  Status); este módulo cria o esqueleto das seções, move os blocos das ilhas
  e controla a seção aberta.
*/
describe("as seções (as sete do SIGAV + Módulos e abas + Status das atualizações)", () => {
  it("são exatamente essas, nessa ordem", () => {
    expect(SECOES.map((s) => s.rotulo)).toEqual([
      "Marca",
      "Página inicial",
      "Tela de acesso",
      "Aparência",
      "Painéis externos",
      "Operação",
      "Acessos",
      "Módulos e abas",
      "Status das atualizações",
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

describe("o mapa dos blocos", () => {
  it("aponta todo bloco para uma seção que existe", () => {
    const ids = new Set(SECOES.map((s) => s.id));
    for (const [bloco, secao] of Object.entries(SECAO_POR_BLOCO))
      expect(ids, `${bloco} aponta para "${secao}"`).toContain(secao);
  });

  /*
    Cada bloco precisa existir no index.html: sem ele a seção abre vazia (foi
    o que um merge fez com `saudeDasCargasApp`, em 01/10/2026).
  */
  it("todo bloco das seções existe no index.html", () => {
    for (const bloco of Object.keys(SECAO_POR_BLOCO)) {
      expect(html, `index.html sem o bloco #${bloco}`).toContain(
        `id="${bloco}"`,
      );
    }
  });

  it("o formulário legado saiu: nenhum campo cfg* em Configurações", () => {
    const inicio = html.indexOf('id="page-config"');
    const bloco = html.slice(
      inicio,
      html.indexOf("</section>", html.indexOf('id="saudeDasCargasApp"')),
    );
    expect(bloco).not.toMatch(/id="cfg/);
    expect(bloco).not.toContain("config-main-card");
  });
});

describe("organizar cria as seções e move os blocos", () => {
  const montarPagina = () => {
    document.body.innerHTML = `
      <section id="page-config">
        <div class="admin-grid">
          <div id="acessosApp" class="full" data-acessos><input id="buscaDeAcessos" /></div>
          <div id="modulosApp" class="full" data-modulos></div>
        </div>
      </section>`;
  };

  beforeEach(montarPagina);

  it("cria as nove seções, com o corpo das seções React vazio", () => {
    expect(organizarConfiguracoesEmSecoes(document)).toBe(true);
    expect(document.querySelectorAll(".config-secao")).toHaveLength(9);
    for (const secao of [
      "marca",
      "inicio",
      "acesso",
      "aparencia",
      "recursos",
      "operacao",
    ])
      expect(
        document.querySelector(
          `.config-secao[data-secao="${secao}"] .config-secao__corpo`,
        ).children,
        secao,
      ).toHaveLength(0);
    // O cabeçalho é da moldura React, um só para a página.
    expect(document.querySelector(".config-secao__cabecalho")).toBeNull();
  });

  /* Mover não recria: o que a ilha já desenhou (e digitou) continua. */
  it("blocos inteiros vão para a seção certa, o mesmo nó", () => {
    const busca = document.getElementById("buscaDeAcessos");
    busca.value = "ana";
    organizarConfiguracoesEmSecoes(document);
    expect(
      document
        .querySelector('.config-secao[data-secao="acessos"]')
        .contains(document.getElementById("acessosApp")),
    ).toBe(true);
    expect(
      document
        .querySelector('.config-secao[data-secao="modulos"]')
        .contains(document.getElementById("modulosApp")),
    ).toBe(true);
    expect(document.getElementById("buscaDeAcessos")).toBe(busca);
    expect(busca.value).toBe("ana");
  });

  /*
    A grade antiga só some se de facto esvaziou. Escondê-la às cegas apagaria
    da tela o que tivesse ficado para trás.
  */
  it("a grade antiga só é escondida quando não resta conteúdo nela", () => {
    organizarConfiguracoesEmSecoes(document);
    expect(document.querySelector("#page-config .admin-grid").hidden).toBe(
      true,
    );

    montarPagina();
    const sobra = document.createElement("input");
    sobra.id = "sobraSemSecao";
    document.querySelector("#page-config .admin-grid").appendChild(sobra);
    organizarConfiguracoesEmSecoes(document);
    expect(document.querySelector("#page-config .admin-grid").hidden).toBe(
      false,
    );
  });

  it("não organiza duas vezes", () => {
    expect(organizarConfiguracoesEmSecoes(document)).toBe(true);
    expect(organizarConfiguracoesEmSecoes(document)).toBe(false);
    expect(document.querySelectorAll(".config-secao")).toHaveLength(9);
  });
});

/*
  As seções são as páginas da área Administração do menu lateral
  (`src/lib/menu-lateral.js`). O menu navega até Configurações e chama
  `abrirSecaoDeConfiguracao`; quem marca o item ativo é o próprio menu, testado
  em `tests/componentes/barra-lateral.test.js`.
*/
describe("as seções como páginas de Administração", () => {
  beforeEach(() => {
    document.body.className = "";
    document.body.innerHTML =
      '<section id="page-config" class="page"><div class="admin-grid"><div id="acessosApp"><input id="buscaDeAcessos" value="AgSUS"></div></div></section>';
    organizarConfiguracoesEmSecoes(document);
  });
  afterEach(() => {
    delete window.acessosController;
    delete window.modulosController;
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
    const campo = document.getElementById("buscaDeAcessos");
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
    expect(document.getElementById("buscaDeAcessos")).toBe(campo);
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

  it("cada troca de seção avisa a moldura React (cabeçalho e barra de salvar)", () => {
    const abertas = [];
    const ouvir = (evento) => abertas.push(evento.detail.secao);
    document.addEventListener(EVENTO_SECAO_ABERTA, ouvir);
    abrirSecaoDeConfiguracao(document, "acessos");
    abrirSecaoDeConfiguracao(document, "marca");
    document.removeEventListener(EVENTO_SECAO_ABERTA, ouvir);
    expect(abertas).toEqual(["acessos", "marca"]);
  });

  it("Módulos e abas carrega a própria tela e pergunta antes de sair com pendência", () => {
    let cargas = 0;
    let deixa = false;
    window.modulosController = {
      render: () => {
        cargas += 1;
      },
      confirmarSaida: () => deixa,
    };
    expect(abrirSecaoDeConfiguracao(document, "modulos")).toBe(true);
    expect(cargas).toBe(1);
    expect(abrirSecaoDeConfiguracao(document, "marca")).toBe(false);
    expect(secaoAtualDeConfiguracao(document)).toBe("modulos");
    deixa = true;
    expect(abrirSecaoDeConfiguracao(document, "marca")).toBe(true);
  });
});

describe("integração no arranque", () => {
  it("organiza as seções antes de montar a moldura React (os portais)", () => {
    expect(main.indexOf("organizarConfiguracoesEmSecoes()")).toBeGreaterThan(
      -1,
    );
    expect(main.indexOf("organizarConfiguracoesEmSecoes()")).toBeLessThan(
      main.indexOf("montarConfiguracoes()"),
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
*/
describe("um navegador só", () => {
  it("o arquivo da barra antiga não é mais instalado", () => {
    expect(main).not.toContain("config-page-enhancements");
    expect(main).not.toContain("removerNavegadorAntigo");
  });
});

/*
  As seções que publicam pela barra fixa são React: o legado não tem mais a
  marcação delas nem os módulos que as montavam.
*/
describe("as seções do formulário saíram do legado", () => {
  it("o index.html não tem a marcação antiga e os módulos antigos não são instalados", () => {
    for (const id of [
      "panelAdmin",
      "cfgRealtimeEnabled",
      "cfgAccessHeartbeatMinutos",
      "cfgCogipVersao",
      "cfgAppVersionCurrent",
      "cfgMonitId",
      "cfgCnesJson",
      "cnesImportResumo",
      "cfgPageTitle",
      "cfgAccessGreeting",
      "cfgAccessPanelColor",
    ])
      expect(html, id).not.toContain(`id="${id}"`);
    expect(modulo).not.toContain("esconderAgrupadoresVazios");
    expect(modulo).not.toContain("SECAO_POR_CAMPO");
    expect(main).not.toContain("config-apresentacao.js");
    expect(main).not.toContain("aviso-de-contraste");
  });
});
