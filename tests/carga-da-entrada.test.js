import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  A carga da entrada: o comportamento da carga (consultas em paralelo, cópia da
  sessão, "Atualizar dados", Realtime) está em tests/app/carga.test.js e o dos
  painéis externos em tests/app/paineis-externos.test.js. Aqui fica o contrato
  com a sessão (src/app/sessao.js): a ordem dos ganchos e quem apaga a cópia.
*/

const ligacao = readFileSync("src/app/sistema.js", "utf8");
const sessao = readFileSync("src/app/sessao.js", "utf8");

const semComentarios = (fonte) =>
  fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** Corpo de uma função de topo da ligação com a sessão. */
function funcao(cabecalho) {
  const inicio = ligacao.indexOf(cabecalho);
  expect(inicio, cabecalho).toBeGreaterThan(-1);
  const resto = ligacao.slice(inicio + cabecalho.length);
  const fim = resto.search(/\n(async )?function /);
  return semComentarios(cabecalho + resto.slice(0, fim < 0 ? undefined : fim));
}

/** Corpo de uma função de src/app/sessao.js (até a próxima do mesmo nível). */
function funcaoDaSessao(cabecalho) {
  const inicio = sessao.indexOf(cabecalho);
  expect(inicio, cabecalho).toBeGreaterThan(-1);
  const resto = sessao.slice(inicio + cabecalho.length);
  const fim = resto.search(/\n {2}(async )?function /);
  return semComentarios(cabecalho + resto.slice(0, fim < 0 ? undefined : fim));
}

/*
  O gancho `aoVerificar` (prepararEntrada) liga o skeleton e começa a ler a
  cópia ANTES da consulta do perfil, para as duas correrem juntas.
*/
describe("cópia da sessão na entrada", () => {
  it("lê a cópia junto com o perfil, não depois", () => {
    expect(funcao("function prepararEntrada()")).toContain(
      "carga.prepararEntrada()",
    );
    const abrir = funcaoDaSessao("async function abrirSessao(");
    expect(abrir.indexOf('chamar("aoVerificar"')).toBeGreaterThan(-1);
    expect(abrir.indexOf('chamar("aoVerificar"')).toBeLessThan(
      abrir.indexOf("await carregarPerfil()"),
    );
  });

  it("só abre (e usa a cópia) depois de confirmar o perfil", () => {
    const abrir = funcaoDaSessao("async function abrirSessao(");
    expect(abrir.indexOf("await carregarPerfil()")).toBeLessThan(
      abrir.indexOf('chamar("abrir"'),
    );
    expect(funcao("async function abrirSistema(")).toContain(
      "await carga.carregarEntrada()",
    );
  });

  it("sem acesso, apaga a cópia", () => {
    expect(funcao("function ficarSemAcesso()")).toContain(
      "carga.apagarCopia()",
    );
  });

  /*
    `limparAutenticacaoLocal` roda a cada clique em "Entrar com Google". Se
    apagasse a cópia, ela nunca seria usada; quem apaga é o "Voltar ao login".
  */
  it('"Voltar ao login" apaga a cópia; entrar com Google não', () => {
    expect(ligacao).toContain("aoLimparSessao: () => carga.apagarCopia()");
    expect(funcaoDaSessao("async function limparSessao()")).toContain(
      'chamar("aoLimparSessao")',
    );
    expect(
      funcaoDaSessao("async function limparAutenticacaoLocal()"),
    ).not.toContain("aoLimparSessao");
  });
});

describe("sem tela de carregamento na entrada", () => {
  it.each(["async function abrirSistema(", "function prepararEntrada()"])(
    "%s não abre a tela de carregamento",
    (cabecalho) => {
      expect(funcao(cabecalho)).not.toContain("mostrarCarregamento(");
    },
  );

  it("a sessão do app não abre a tela de carregamento", () => {
    expect(semComentarios(sessao)).not.toContain("loader(");
  });

  it("a entrada liga o skeleton antes do perfil", () => {
    expect(funcao("function prepararEntrada()")).toContain(
      "mostrarEsqueleto(navegacao.telaGuardada())",
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
});

describe("cada consulta sai para a rede na hora", () => {
  /*
    A consulta do Supabase só dispara quando alguém chama `then`. Sem o
    `Promise.resolve` (em `iniciarConsultas`, src/app/carga.js), ela ficaria
    parada até o `await` da sua carga e a entrada voltaria a ser sequencial.
  */
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
