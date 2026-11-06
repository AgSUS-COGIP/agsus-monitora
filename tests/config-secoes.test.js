import { readFileSync } from "node:fs";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SECOES } from "../src/modulos/configuracoes/secoes.ts";
import { criarNavegacao } from "../src/app/navegacao.ts";
import { montarTelasNoTeste } from "./app/telas-no-teste.js";
import { htmlDaPagina } from "./pagina-montada.ts";

const html = htmlDaPagina();
const main = readFileSync("src/main.ts", "utf8");
const modulo = readFileSync("src/modulos/configuracoes/secoes.ts", "utf8");

/*
  A página era um formulário corrido: um card com 47 campos e três subtítulos
  soltos. Agora tem as mesmas sete seções do SIGAV, mais Módulos e abas e
  Status das atualizações e Automação (só admin global). O conteúdo de cada seção é
  React (src/modulos/configuracoes/ e as telas de Acessos, Módulos e abas,
  Status e Automação), e cada seção é uma rota.
*/
describe("as seções (as sete do SIGAV + Módulos e abas + Status das atualizações + Automação)", () => {
  it("são exatamente essas, nessa ordem", () => {
    expect(SECOES.map((s) => s.rotulo)).toEqual([
      "Marca",
      "Página inicial",
      "Tela de acesso",
      "Aparência",
      "Comemorações",
      "Acessos",
      "Painéis externos",
      "Módulos e abas",
      "Operação",
      "Status das atualizações",
      "Automação",
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

/*
  As seções são rotas (/administracao/configuracoes/<seção>): a página
  (src/app/telas.tsx) desenha um <article class="config-secao"> por seção e
  os blocos das quatro com tela própria; a navegação (src/app/navegacao.ts)
  escolhe a aberta pelas permissões do perfil.
*/
const BLOCOS = {
  acessosApp: "acessos",
  modulosApp: "modulos",
  saudeDasCargasApp: "cargas",
  automacaoApp: "automacao",
};

describe("a página das seções", () => {
  it("cada seção tem o seu article, e os quatro blocos com tela própria estão dentro dela", () => {
    const pagina = document.createElement("div");
    pagina.innerHTML = html.slice(
      html.indexOf('<section id="page-config"'),
      html.indexOf('<section id="page-sem-acesso"'),
    );
    expect(
      [...pagina.querySelectorAll(".config-secao")].map((a) => a.dataset.secao),
    ).toEqual(SECOES.map((s) => s.id));
    for (const [bloco, secao] of Object.entries(BLOCOS)) {
      const artigo = pagina
        .querySelector(`#${bloco}`)
        ?.closest(".config-secao");
      expect(artigo?.dataset.secao, `#${bloco}`).toBe(secao);
    }
  });

  it("o formulário legado saiu: nenhum campo cfg* em Configurações", () => {
    const inicio = html.indexOf('id="page-config"');
    const bloco = html.slice(inicio, html.indexOf('id="page-sem-acesso"'));
    expect(bloco).not.toMatch(/id="cfg/);
    expect(bloco).not.toContain("config-main-card");
    expect(bloco).not.toContain("admin-grid");
  });
});

const ADMIN = { id: "a", ativo: true, perfil: "admin", admin_global: true };
// Admin global sem Configurações: só a seção Acessos.
const SO_ACESSOS = { ...ADMIN, permissoes: { configuracoes: "sem_acesso" } };

describe("as seções como rotas de Administração", () => {
  let montado = null;
  let acessos;

  function abrir({ perfil = ADMIN } = {}) {
    acessos = {
      render: vi.fn(),
      confirmarSaida: vi.fn(() => true),
      conteudo: createElement("input", { id: "buscaDeAcessos" }),
    };
    const navegacao = criarNavegacao({
      janela: { location: { reload: vi.fn() } },
      obterPerfil: () => perfil,
      confirmarSaida: () => true,
      aplicarAtualizacao: () => false,
    });
    montado = montarTelasNoTeste(navegacao, {
      config: {},
      "secao:acessos": acessos,
      "secao:modulos": { confirmarSaida: () => true },
    });
    montado.navegacao.montarMenu();
    return montado.navegacao;
  }

  const visivel = () =>
    [...document.querySelectorAll(".config-secao:not([hidden])")].map(
      (a) => a.dataset.secao,
    );
  const endereco = () => location.pathname;

  beforeEach(() => {
    document.body.innerHTML = '<main id="conteudoPrincipal"></main>';
    history.replaceState(null, "", "/");
  });
  afterEach(() => {
    montado?.desmontar();
    montado = null;
  });

  it("abre na primeira seção permitida, com ela no endereço", () => {
    const navegacao = abrir();
    navegacao.irPara("config");
    expect(navegacao.obter().secao).toBe("marca");
    expect(visivel()).toEqual(["marca"]);
    expect(endereco()).toBe("/administracao/configuracoes/marca");
    expect(document.getElementById("page-config").dataset.subgrupo).toBe(
      "marca",
    );
  });

  it("trocar de seção troca o article à vista e o endereço; Acessos relê a cada abertura", () => {
    const navegacao = abrir();
    navegacao.irPara("config");
    expect(navegacao.abrirSecao("acessos")).toBe(true);
    expect(visivel()).toEqual(["acessos"]);
    expect(endereco()).toBe("/administracao/configuracoes/acessos");
    expect(acessos.render).toHaveBeenCalledTimes(1);
    navegacao.abrirSecao("operacao");
    expect(acessos.render).toHaveBeenCalledTimes(1);
    navegacao.abrirSecao("acessos");
    expect(acessos.render).toHaveBeenCalledTimes(2);
  });

  it("a seção visitada continua montada: o rascunho fica", () => {
    const navegacao = abrir();
    navegacao.irPara("config");
    navegacao.abrirSecao("acessos");
    const campo = document.getElementById("buscaDeAcessos");
    campo.value = "Rascunho";
    navegacao.abrirSecao("marca");
    navegacao.abrirSecao("acessos");
    expect(document.getElementById("buscaDeAcessos")).toBe(campo);
    expect(campo.value).toBe("Rascunho");
  });

  it("recusa seção que não existe e não muda a aberta", () => {
    const navegacao = abrir();
    navegacao.irPara("config");
    expect(navegacao.abrirSecao("inexistente")).toBe(false);
    expect(navegacao.obter().secao).toBe("marca");
  });

  it("sair de Acessos com alteração não salva recusada fica em Acessos", () => {
    const navegacao = abrir();
    navegacao.irPara("config");
    navegacao.abrirSecao("acessos");
    acessos.confirmarSaida.mockReturnValue(false);
    expect(navegacao.abrirSecao("marca")).toBe(false);
    expect(navegacao.obter().secao).toBe("acessos");
    expect(visivel()).toEqual(["acessos"]);
  });

  it("só abre as seções permitidas; o endereço de uma proibida cai na primeira permitida", () => {
    history.replaceState(null, "", "/administracao/configuracoes/marca");
    const navegacao = abrir({ perfil: SO_ACESSOS });
    navegacao.abrirEntrada();
    expect(navegacao.obter().secao).toBe("acessos");
    expect(endereco()).toBe("/administracao/configuracoes/acessos");
    expect(navegacao.abrirSecao("marca")).toBe(false);
    expect(navegacao.obter().secao).toBe("acessos");
  });

  it("de outra página, abrir a seção abre Configurações já nela", () => {
    const navegacao = abrir();
    navegacao.irPara("nucleo");
    expect(navegacao.abrirSecao("acessos")).toBe(true);
    expect(navegacao.obter()).toMatchObject({
      view: "config",
      secao: "acessos",
    });
    expect(acessos.render).toHaveBeenCalledTimes(1);
  });
});

describe("integração no arranque", () => {
  it("nada de mover blocos pelo DOM nem de controlador em window", () => {
    expect(main).not.toContain("organizarConfiguracoesEmSecoes");
    expect(main).not.toMatch(/window\.\w+Controller\s*=/);
    expect(modulo).not.toContain("appendChild");
    expect(modulo).not.toContain("document");
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
