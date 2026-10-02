import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const app = readFileSync("src/modules/legacy-app.js", "utf8");
const sessao = readFileSync("src/app/sessao.js", "utf8");

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
  ["carregarCatalogoDeAbas", "abas"],
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

/** Corpo de uma função de src/app/sessao.js (até a próxima do mesmo nível). */
function funcaoDaSessao(cabecalho) {
  const inicio = sessao.indexOf(cabecalho);
  expect(inicio, cabecalho).toBeGreaterThan(-1);
  const resto = sessao.slice(inicio + cabecalho.length);
  const fim = resto.search(/\n {2}(async )?function /);
  return semComentarios(cabecalho + resto.slice(0, fim < 0 ? undefined : fim));
}

/*
  O perfil é da sessão do app (src/app/sessao.js); a cópia e a carga, do
  legado. O gancho `aoVerificar` (prepararEntrada) liga o skeleton e começa a
  ler a cópia ANTES da consulta do perfil, para as duas correrem juntas.
*/
describe("cópia da sessão na entrada", () => {
  const entrada = () => funcao("async function loadInitialData()");

  it("lê a cópia junto com o perfil, não depois", () => {
    expect(funcao("function prepararEntrada()")).toContain(
      "copiaEmLeitura = lerCopiaDaSessao()",
    );
    const abrir = funcaoDaSessao("async function abrirSessao(");
    expect(abrir.indexOf('chamar("aoVerificar"')).toBeGreaterThan(-1);
    expect(abrir.indexOf('chamar("aoVerificar"')).toBeLessThan(
      abrir.indexOf("await carregarPerfil()"),
    );
    expect(entrada()).toContain("copiaEmLeitura || lerCopiaDaSessao()");
  });

  it("só abre (e usa a cópia) depois de confirmar o perfil", () => {
    const abrir = funcaoDaSessao("async function abrirSessao(");
    expect(abrir.indexOf("await carregarPerfil()")).toBeLessThan(
      abrir.indexOf('chamar("abrir"'),
    );
    expect(entrada()).toContain("copiaServe(");
  });

  it("sem acesso, apaga a cópia", () => {
    expect(funcao("function ficarSemAcesso()")).toContain(
      "apagarCopiaDaSessao()",
    );
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
    `limparAutenticacaoLocal` roda a cada clique em "Entrar com Google". Se
    apagasse a cópia, ela nunca seria usada; quem apaga é o "Voltar ao login".
  */
  it('"Voltar ao login" apaga a cópia; entrar com Google não', () => {
    expect(app).toContain("aoLimparSessao: () => apagarCopiaDaSessao()");
    expect(funcaoDaSessao("async function limparSessao()")).toContain(
      'chamar("aoLimparSessao")',
    );
    expect(
      funcaoDaSessao("async function limparAutenticacaoLocal()"),
    ).not.toContain("aoLimparSessao");
  });
});

describe("sem tela de carregamento na entrada e ao atualizar", () => {
  it.each([
    "async function loadInitialData()",
    "async function refreshData()",
    "async function abrirSistema(",
    "function prepararEntrada()",
    "async function loadData(options = {})",
  ])("%s não abre a tela de carregamento", (cabecalho) => {
    expect(funcao(cabecalho)).not.toContain("loader(");
  });

  it("a sessão do app não abre a tela de carregamento", () => {
    expect(semComentarios(sessao)).not.toContain("loader(");
  });

  it("a entrada liga o skeleton antes do perfil e o desliga depois de abrir", () => {
    expect(funcao("function prepararEntrada()")).toContain(
      "mostrarEsqueleto(storedView())",
    );
    const fonte = funcao("async function loadInitialData()");
    expect(fonte.indexOf("navigate(startView())")).toBeLessThan(
      fonte.lastIndexOf("esconderEsqueleto()"),
    );
  });

  it.each(["function limparEstadoDeslogado()", "function encerrarEspera()"])(
    "%s desliga o skeleton",
    (cabecalho) => {
      expect(funcao(cabecalho)).toContain("esconderEsqueleto()");
    },
  );

  it("sem acesso, a espera acaba", () => {
    expect(funcao("function ficarSemAcesso()")).toContain("encerrarEspera()");
  });

  it("aconteça o que acontecer, a entrada encerra a espera", () => {
    const entrar = funcaoDaSessao("async function entrar(");
    const final = entrar.slice(entrar.indexOf("} finally {"));
    expect(final).toContain('chamar("encerrarEspera")');
  });

  it("sessão guardada que expirou dá lugar ao login", () => {
    const fonte = funcaoDaSessao("async function iniciar()");
    const semSessao = fonte.slice(fonte.lastIndexOf("await entrar("));
    expect(semSessao).toContain('chamar("encerrarEspera")');
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
