import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const app = readFileSync("src/modules/legacy-app.js", "utf8");

const semComentarios = (fonte) =>
  fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** Corpo da função, do cabeçalho até a próxima função de topo. */
function funcao(cabecalho) {
  const inicio = app.indexOf(cabecalho);
  expect(inicio, cabecalho).toBeGreaterThan(-1);
  const resto = app.slice(inicio + cabecalho.length);
  const fim = resto.search(/\n(async )?function /);
  return semComentarios(cabecalho + resto.slice(0, fim));
}

const CONSULTAS = [
  ["loadConfig", "config"],
  ["loadPanels", "paineis"],
  ["loadMapaConfig", "mapa"],
  ["loadUnidades", "unidades"],
  ["loadData", "monitoramento"],
];

describe("painéis externos só carregam quando abertos", () => {
  it("a entrada não cria mais o iframe de todos os painéis", () => {
    expect(app).not.toContain("warmExternalPanels");
    expect(app).not.toContain("externalPanelsWarmed");
  });

  it("o iframe nasce na primeira abertura do painel", () => {
    expect(funcao("function openPanel(code)")).toContain(
      "buildExternalPanel(holder, panel)",
    );
  });

  it("atualizar descarta os painéis já abertos para recarregarem", () => {
    expect(funcao("async function refreshData()")).toContain(
      'document.querySelectorAll(".external-panel").forEach((el) => el.remove())',
    );
  });
});

/*
  Na entrada, cada `load*` recebe `fonte`: a cópia da sessão, quando serve, ou as
  consultas já disparadas. No "Atualizar dados", sempre as consultas.
*/
describe.each([
  ["entrada", "async function loadInitialData()", "fonte"],
  ["atualizar dados", "async function refreshData()", "consultas"],
])("consultas em paralelo: %s", (_, cabecalho, origem) => {
  const corpo = () => funcao(cabecalho);

  it("dispara todas as consultas antes da primeira espera", () => {
    const fonte = corpo();
    const disparo = fonte.indexOf("iniciarConsultasDaSessao()");
    expect(disparo).toBeGreaterThan(-1);
    expect(disparo).toBeLessThan(fonte.indexOf("await loadConfig("));
  });

  it.each(CONSULTAS)("%s usa a consulta já disparada", (carga, chave) => {
    expect(corpo()).toMatch(
      new RegExp(`${carga}\\(\\{[^}]*consulta: ${origem}\\.${chave}`),
    );
  });

  it("não tem pausa fixa", () => {
    expect(corpo()).not.toContain("sleep(");
  });
});

describe("cópia da sessão na entrada", () => {
  const entrada = () => funcao("async function loadInitialData()");

  it("lê a cópia junto com o perfil, não depois", () => {
    const fonte = entrada();
    expect(fonte.indexOf("lerCopiaDaSessao()")).toBeGreaterThan(-1);
    expect(fonte.indexOf("lerCopiaDaSessao()")).toBeLessThan(
      fonte.indexOf("await loadProfile()"),
    );
  });

  it("só abre pela cópia depois de confirmar o perfil", () => {
    const fonte = entrada();
    expect(fonte.indexOf("await loadProfile()")).toBeLessThan(
      fonte.indexOf("copiaServe("),
    );
  });

  it("sem acesso, apaga a cópia", () => {
    const fonte = entrada();
    const semAcesso = fonte.slice(
      fonte.indexOf("if (!profileOk)"),
      fonte.indexOf("return false;"),
    );
    expect(semAcesso).toContain("apagarCopiaDaSessao()");
  });

  it("apaga a cópia de outra pessoa", () => {
    expect(entrada()).toMatch(
      /copia\.usuarioId !== sessao\.usuarioId\)\s*void apagarCopiaDaSessao\(\)/,
    );
  });

  it("depois de abrir, atualiza por trás com as consultas reais", () => {
    expect(entrada()).toContain("atualizarCopiaDaSessao(sessao, consultas,");
  });

  /*
    `clearLocalAuthState` roda a cada clique em "Entrar com Google". Se apagasse
    a cópia, ela nunca seria usada; quem apaga é o "Limpar sessão".
  */
  it('"Limpar sessão" apaga a cópia; entrar com Google não', () => {
    expect(funcao("async function returnToLogin()")).toContain(
      "apagarCopiaDaSessao()",
    );
    expect(funcao("async function clearLocalAuthState()")).not.toContain(
      "apagarCopiaDaSessao",
    );
  });
});

describe("sem tela de carregamento na entrada e ao atualizar", () => {
  it.each([
    "async function loadInitialData()",
    "async function refreshData()",
    "async function handleOAuthCodeCallback()",
    "async function boot()",
    "async function loadData(options = {})",
  ])("%s não abre a tela de carregamento", (cabecalho) => {
    expect(funcao(cabecalho)).not.toContain("loader(");
  });

  it("a entrada liga o skeleton antes do perfil e o desliga depois de abrir", () => {
    const fonte = funcao("async function loadInitialData()");
    expect(fonte.indexOf("mostrarEsqueleto(storedView())")).toBeLessThan(
      fonte.indexOf("await loadProfile()"),
    );
    expect(fonte.indexOf("navigate(startView())")).toBeLessThan(
      fonte.lastIndexOf("esconderEsqueleto()"),
    );
  });

  it.each([
    "function resetSignedOutState(",
    "async function showAccessRequestState()",
    "function forceAccessRequestFallback(",
    "async function handleSignedInSession(",
  ])("%s desliga o skeleton", (cabecalho) => {
    expect(funcao(cabecalho)).toContain("esconderEsqueleto()");
  });

  it("sessão guardada que expirou dá lugar ao login", () => {
    const fonte = funcao("async function boot()");
    const semSessao = fonte.slice(fonte.lastIndexOf("} else {"));
    expect(semSessao).toContain("esconderEsqueleto()");
  });

  it("atualizar marca a barra e sempre a desmarca", () => {
    const fonte = funcao("async function refreshData()");
    expect(fonte).toContain("marcarAtualizacao(true)");
    const final = fonte.slice(fonte.indexOf("} finally {"));
    expect(final).toContain("marcarAtualizacao(false)");
  });
});

describe("cada consulta sai para a rede na hora", () => {
  /*
    A consulta do Supabase só dispara quando alguém chama `then`. Sem o
    `Promise.resolve`, ela ficaria parada até o `await` do seu `load*` e a
    entrada voltaria a ser sequencial.
  */
  it("iniciarConsultasDaSessao resolve cada consulta ao criá-la", () => {
    const fonte = funcao("function iniciarConsultasDaSessao()");
    for (const consulta of [
      "consultaDeConfiguracao",
      "consultaDePaineis",
      "consultaDoMapa",
      "consultaDeUnidades",
    ])
      expect(fonte).toContain(`iniciar(${consulta}())`);
    expect(fonte).toContain("consultaDoMonitoramento()");
  });

  it("a consulta preguiçosa começa ao passar por Promise.resolve", async () => {
    let chamadas = 0;
    const consulta = {
      then(resolver) {
        chamadas += 1;
        resolver("ok");
      },
    };
    const disparada = Promise.resolve(consulta);
    await null;
    expect(chamadas).toBe(1);
    await expect(disparada).resolves.toBe("ok");
    expect(chamadas).toBe(1);
  });
});
