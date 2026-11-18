// @vitest-environment node
import { bloco } from "./apoio/bloco.ts";
import fs, {
  readFileSync,
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
  existsSync,
  readdirSync,
} from "node:fs";
import vm from "node:vm";
import {
  describe,
  expect,
  it,
  afterEach,
  beforeEach,
  beforeAll,
  afterAll,
} from "vitest";
import { spawnSync, execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path, { basename, dirname, join, resolve } from "node:path";
import {
  compararComLinhaDeBase,
  contarDesvios,
  marcadoresInvalidos,
  TIPOS_DE_DESVIO,
} from "../scripts/check-acabamento-so-encolhe.mjs";
import {
  arquivosNovosNoLegado,
  JAVASCRIPT_PERMITIDO_NO_LEGADO,
  javascriptNoLegado,
  PASTAS_DO_LEGADO,
} from "../scripts/check-legado-so-encolhe.mjs";
import {
  compararMigrations,
  timestampDe,
} from "../scripts/check-migrations-timestamp-unico.mjs";
import { ehNomeDeRemendo } from "../scripts/check-no-new-patch-layers.mjs";
import {
  caminhoRegistado,
  classificar,
  escaparLiteral,
  ficheirosNoDisco,
  hashDoConteudo,
  timestampsRepetidos,
} from "../scripts/estado-das-migrations-nucleo.mjs";
import { resolver } from "./apoio/tokens-de-camada.ts";
import { ESLint } from "eslint";
import { request } from "node:http";
import { connect } from "node:net";
import { gunzipSync } from "node:zlib";
import {
  caminhoDoEstatico,
  criarServidor,
  lerCabecalhosDaVercel,
} from "../server/servidor.ts";
import { fonteDoApp } from "./fonte-do-app.ts";

bloco("apps-script-orquestrador-sem-permissao", () => {
  /*
  Orquestrador das análises (4-orquestrador-fato-supabase.gs), 11/11/2026: o
  gatilho da Saúde Indígena era de outra conta, que perdeu a autorização do
  script. Cada execução marcava o início do ciclo e só então falhava ao abrir a
  planilha; a janela de 20 minutos recomeçava e nada ia ao banco de 29/10 a
  11/11. Agora o gatilho sem acesso sai antes de tocar no estado.

  Os .gs não têm módulo: rodam num contexto do node:vm com dublês mínimos.
*/
  const PLANILHAS = ["saude-indigena", "projetos", "sede"];
  const ler = (p) =>
    readFileSync(`apps-script/${p}/4-orquestrador-fato-supabase.gs`, "utf8");

  function rodar(planilha, { comAcesso }) {
    const props = new Map();
    const logs = [];
    const chamadas = [];
    const ctx = vm.createContext({
      Logger: { log: (m) => logs.push(String(m)) },
      PropertiesService: {
        getScriptProperties: () => ({
          getProperty: (k) => (props.has(k) ? props.get(k) : null),
          setProperty: (k, v) => props.set(k, String(v)),
          deleteProperty: (k) => props.delete(k),
        }),
      },
      SpreadsheetApp: {
        getActiveSpreadsheet: () => {
          if (!comAcesso)
            throw new Error(
              "Você não tem permissão para chamar SpreadsheetApp.getActiveSpreadsheet.",
            );
          return {};
        },
      },
      ScriptApp: { getProjectTriggers: () => [] },
      Utilities: { getUuid: () => "ciclo-1" },
      // A FATO (no "Atualizar base") só é chamada quando o ciclo começa de fato.
      atualizarDimVagasESincronizar: () => {
        chamadas.push("FATO");
        throw new Error("FATO falhou no dublê");
      },
    });
    vm.runInContext(ler(planilha), ctx);
    const resultado = ctx.orquestrarFatoESupabaseAgendado();
    return { resultado, props, logs, chamadas };
  }

  describe.each(PLANILHAS)("orquestrador de %s", (planilha) => {
    it("gatilho sem acesso à planilha: não marca o ciclo nem chama a FATO", () => {
      const { resultado, props, chamadas, logs } = rodar(planilha, {
        comAcesso: false,
      });
      expect(resultado.sem_permissao).toBe(true);
      expect(chamadas).toEqual([]);
      expect(props.size).toBe(0);
      expect(logs.join("\n")).toContain("statusGatilhoFatoESupabase");
    });

    it("com acesso: o ciclo começa como antes (marca a janela e chama a FATO)", () => {
      const { resultado, props, chamadas } = rodar(planilha, {
        comAcesso: true,
      });
      expect(chamadas).toEqual(["FATO"]);
      expect(props.has("FATO_SUPABASE_ORQ_LAST_CYCLE_AT")).toBe(true);
      expect(resultado.phase).toBe("FATO_ERROR");
    });

    it("a conferência é a primeira coisa do handler", () => {
      const codigo = ler(planilha);
      const inicio = codigo.indexOf(
        "function orquestrarFatoESupabaseAgendado() {",
      );
      const guarda = codigo.indexOf("if (!temAcessoAPlanilhaOrq_())", inicio);
      const estado = codigo.indexOf("lerEstadoFatoSupabase_()", inicio);
      expect(guarda).toBeGreaterThan(inicio);
      expect(estado).toBeGreaterThan(guarda);
    });
  });
});

bloco("arquitetura-typescript", () => {
  const temporarios = [];

  afterEach(() => {
    for (const pasta of temporarios.splice(0)) {
      if (
        dirname(resolve(pasta)) !== resolve(tmpdir()) ||
        !basename(pasta).startsWith("monitora-arquitetura-ts-")
      ) {
        throw new Error("Diretório temporário fora da área de teste");
      }
      rmSync(pasta, { recursive: true, force: true });
    }
  });

  function verificar(script, extensao, fonte, contrato = {}) {
    const pasta = mkdtempSync(join(tmpdir(), "monitora-arquitetura-ts-"));
    temporarios.push(pasta);
    mkdirSync(join(pasta, "src/lib"), { recursive: true });
    writeFileSync(join(pasta, "package.json"), '{"type":"module"}');
    writeFileSync(
      join(pasta, "src/lib/rpc-contrato.ts"),
      `export const CONTRATO_RPC = ${JSON.stringify(contrato)};`,
    );
    writeFileSync(join(pasta, `src/tela.${extensao}`), fonte);
    const resultado = spawnSync(process.execPath, [resolve(script)], {
      cwd: pasta,
      encoding: "utf8",
    });
    if (resultado.error) throw resultado.error;
    return {
      codigo: resultado.status,
      saida: resultado.stdout + resultado.stderr,
    };
  }

  describe("arquitetura nos arquivos migrados", () => {
    it.each(["ts", "tsx"])("recusa RPC fora do contrato em %s", (extensao) => {
      const resultado = verificar(
        "scripts/check-rpc-contract.mjs",
        extensao,
        'cliente.rpc("rpc_sem_contrato");',
      );
      expect(resultado.codigo).toBe(1);
      expect(resultado.saida).toContain('RPC "rpc_sem_contrato"');
    });

    it.each(["ts", "tsx"])(
      "reconhece RPC declarada usada em %s",
      (extensao) => {
        const resultado = verificar(
          "scripts/check-rpc-contract.mjs",
          extensao,
          'cliente.rpc("listar_dados");',
          { listar_dados: {} },
        );
        expect(resultado.codigo).toBe(0);
        expect(resultado.saida).toContain("1 função(ões)");
      },
    );

    it.each(["jsx", "tsx"])(
      "recusa cliente de autenticação avulso em %s",
      (extensao) => {
        const resultado = verificar(
          "scripts/check-supabase-auth-architecture.mjs",
          extensao,
          'import { createClient } from "@supabase/supabase-js";',
        );
        expect(resultado.codigo).toBe(1);
        expect(resultado.saida).toContain(
          "cliente Supabase fora de lib/sessao/supabaseClient.ts",
        );
      },
    );
  });
});

bloco("atributo-hidden", () => {
  /*
  Regra `display` vencendo o atributo `hidden` causou, numa só revisão, quatro
  defeitos: filtros da Saúde Indígena abertos ao mesmo tempo, "Alterações não
  salvas" sempre visível, a grade antiga de Configurações sob as seções novas e
  as linhas filtradas de Editais continuando no celular. A regra global em
  app.css resolve todos; este teste impede que ela saia numa limpeza de CSS.
*/
  describe("o atributo hidden sempre esconde", () => {
    const app = readFileSync("src/styles/app.css", "utf8").replace(
      /\r\n/g,
      "\n",
    );

    it("app.css declara [hidden] com display none !important", () => {
      expect(app).toMatch(
        /\n\[hidden\] \{\n\s+display: none !important;(?: \/\*[^\n]*\*\/)?\n\}/,
      );
    });
  });
});

bloco("barras-fixas-no-celular", () => {
  /*
  O celular não tem mais menu preso ao pé da tela (o menu é a gaveta do ☰).
  Antes, o espaço dele era um recuo (--recuo-da-navegacao-inferior) que toda
  barra fixa ou presa ao pé somava, e o corpo da página reservava a altura
  dele no fim. Agora o conteúdo usa a altura toda: as barras do pé encostam
  no pé (ou na área segura do aparelho) e nada reserva espaço para o menu.

  E o link de pular: escondido por um "top" fixo, a segunda linha dele
  ("…principal") aparecia por cima do cabeçalho quando o texto quebrava.
*/
  const ler = (caminho) =>
    readFileSync(caminho, "utf8")
      .replace(/\r\n/g, "\n")
      .replace(/\/\*[\s\S]*?\*\//g, "");
  const bloco = (css, seletor) => {
    const i = css.indexOf(`${seletor} {`);
    expect(i, seletor).toBeGreaterThan(-1);
    return css.slice(i, css.indexOf("}", i));
  };

  describe("barras do pé no celular, sem menu inferior", () => {
    it("o menu inferior e o recuo dele saíram", () => {
      expect(existsSync("src/styles/mobile-bottom-navigation.css")).toBe(false);
      expect(existsSync("src/modules/mobile-bottom-navigation.js")).toBe(false);
      expect(ler("src/styles/tokens.css")).not.toContain(
        "--recuo-da-navegacao-inferior",
      );
      expect(ler("src/styles/mobile-app.css")).not.toContain(".mobile-app");
    });

    it("a barra de salvar e as outras barras do pé encostam no pé", () => {
      expect(bloco(ler("src/ui/ui.css"), ".ui-barra-de-salvar")).toContain(
        "bottom: 0;",
      );
      expect(
        bloco(
          ler("src/modulos/configuracoes/configuracoes.css"),
          ".config-barra",
        ),
      ).toContain("bottom: var(--space-4);");
      expect(
        bloco(
          ler("src/styles/connectivity-status.css"),
          ".connectivity-status",
        ),
      ).toContain("env(safe-area-inset-bottom");
      expect(
        bloco(ler("src/modulos/aya/tour/tour.css"), ".aya-oferta--balao"),
      ).toContain("bottom: calc(clamp(16px, 2vw, 24px) + 92px);");
      const aya = ler("src/modulos/aya/aya.css");
      const celular = aya.slice(aya.lastIndexOf("@media (max-width: 900px)"));
      expect(bloco(celular, "  .aya-arara")).toContain(
        "env(safe-area-inset-bottom",
      );
    });

    it("nenhum CSS reserva espaço no fim da página para um menu inferior", () => {
      for (const arquivo of [
        "src/styles/app.css",
        "src/styles/mobile-app.css",
        "src/styles/platform-shell.css",
      ]) {
        const css = ler(arquivo);
        expect(css, arquivo).not.toMatch(/navegacao-inferior|bottom-nav/);
      }
    });
  });

  describe("link de pular", () => {
    it("fica fora da tela pela própria altura, não por um top fixo", () => {
      const app = ler("src/styles/app.css");
      const link = bloco(app, ".skip-link");
      expect(link).not.toMatch(/top:\s*-/);
      expect(link).toContain("transform: translateY(-100%)");
      expect(link).toContain("max-width: calc(100vw - 16px)");
      expect(bloco(app, ".skip-link:focus")).toContain("transform: none");
    });
  });
});

bloco("camadas-acima-da-barra", () => {
  const ler = (caminho) => readFileSync(caminho, "utf8");
  const semComentarios = (fonte) => fonte.replace(/\/\*[\s\S]*?\*\//g, "");
  const app = semComentarios(ler("src/styles/app.css"));

  const valorDoToken = (nome) =>
    Number(app.match(new RegExp(`${nome}:\\s*(\\d+)`))?.[1]);

  /*
  A barra lateral subiu para cima do cabeçalho (`--z-sidebar`): o painel
  flutuante do menu e as dicas do trilho passam por cima do cabeçalho e do
  mapa. Quem precisa ficar acima da barra — o modal de
  busca, o link de pular, a faixa offline, o aviso de conectividade e o aviso
  de sessão — foi para os tokens de overlay. Antes, com a barra em 20, ficavam
  abaixo do cabeçalho sem ninguém notar.
*/
  describe("camadas acima da barra lateral", () => {
    it("cabeçalho < barra < popovers < overlays", () => {
      const cabecalho = valorDoToken("--z-header");
      const barra = valorDoToken("--z-sidebar");
      const popover = valorDoToken("--z-popover");
      const overlay = valorDoToken("--z-overlay");
      expect(cabecalho).toBe(10010);
      expect(barra).toBeGreaterThan(cabecalho);
      expect(popover).toBeGreaterThan(barra);
      expect(overlay).toBeGreaterThan(popover);
    });

    it("a barra fixa usa o token e não recorta o que sai da borda", () => {
      const i = app.indexOf("@media (min-width: 901px)");
      const bloco = app.slice(i, app.indexOf("}", i));
      expect(bloco).toContain("z-index: var(--z-sidebar)");
      expect(bloco).toContain("overflow: visible");
    });

    it("o que precisa ficar acima da barra usa os tokens de overlay", () => {
      expect(app).toMatch(
        /\.search-modal\s*\{[^}]*z-index:\s*var\(--z-overlay\)/,
      );
      expect(app).toMatch(/\.skip-link\s*\{[^}]*z-index:\s*var\(--z-toast\)/);
      expect(ler("src/styles/connectivity-status.css")).toMatch(
        /\.connectivity-status\s*\{[^}]*z-index:\s*var\(--z-toast\)/,
      );
      expect(ler("src/lib/sessao/session-lifecycle.ts")).toMatch(
        /#agsusSessionNotice\s*\{[^}]*z-index:\s*var\(--z-toast, 20050\)/,
      );
      expect(app).toMatch(/\.toast-box\s*\{[^}]*z-index:\s*var\(--z-toast\)/);
      expect(app).toMatch(/\.loader\s*\{[^}]*z-index:\s*var\(--z-loader\)/);
    });

    it("a barra travada não sobrescreve a camada com um número solto", () => {
      expect(app).not.toMatch(/body\.sidebar-locked \.sidebar\s*\{/);
    });
  });

  /*
  A arara da Aya fica acima do cabeçalho e da barra do celular, mas abaixo
  dos menus e popovers das telas: em 13/10/2026, a 10042, ela cobria os itens
  de "Ações da coordenação" na Fila da Avaliação documental.
*/
  describe("a Aya e os menus das telas", () => {
    // O z-index do primeiro bloco `<seletor> {` no começo de uma linha.
    const zDe = (caminho, seletor) => {
      const fonte = semComentarios(ler(caminho));
      const bloco = fonte.slice(fonte.indexOf(`\n${seletor} {`));
      return Number(bloco.match(/z-index:\s*(\d+)/)?.[1]);
    };
    const aya = zDe("src/modulos/aya/aya.css", ".aya");

    it("barra do celular (10036) < Aya < popover das telas", () => {
      expect(aya).toBeGreaterThan(10036);
      expect(aya).toBeLessThan(valorDoToken("--z-popover"));
    });

    it("o tour da Aya continua acima dela", () => {
      expect(zDe("src/modulos/aya/tour/tour.css", ".aya-tour")).toBeGreaterThan(
        aya,
      );
    });
  });
});

bloco("check-acabamento-so-encolhe", () => {
  /*
  O acabamento só encolhe: o número de desvios de token por arquivo (cor, raio,
  sombra, z-index, curva, !important…) nunca aumenta em relação à linha de
  base. Arquivo novo entra com limite zero. A norma é docs/design-system-agsus.md.
*/

  const SCRIPT = resolve("scripts/check-acabamento-so-encolhe.mjs");
  const css = (texto, caminho = "src/x.css") => contarDesvios(caminho, texto);

  describe("contarDesvios", () => {
    it("os tipos de desvio", () => {
      expect(TIPOS_DE_DESVIO).toEqual([
        "cor",
        "important",
        "zIndex",
        "raio",
        "sombra",
        "curva",
        "animaLayout",
        "blur",
      ]);
    });

    it("devolve todos os tipos, zerados quando não há desvio", () => {
      expect(css("a{color:var(--text)}")).toEqual({
        cor: 0,
        important: 0,
        zIndex: 0,
        raio: 0,
        sombra: 0,
        curva: 0,
        animaLayout: 0,
        blur: 0,
      });
    });

    it("cor: hex, rgb(), rgba() e hsl() contam; tokens.css não", () => {
      expect(css("a{color:#fff}").cor).toBe(1);
      expect(css("a{color:#ffffff80}").cor).toBe(1);
      expect(css("a{color:rgb(0 0 0)}").cor).toBe(1);
      expect(css("a{color:rgba(0,0,0,.5)}").cor).toBe(1);
      expect(css("a{color:hsl(10 10% 10%)}").cor).toBe(1);
      expect(contarDesvios("src/styles/tokens.css", "--c:#fff;").cor).toBe(0);
    });

    it("cor: conta uma por linha, e não conta var() nem comentário nem url()", () => {
      expect(css("a{\n color:#fff;\n background:#000;\n}").cor).toBe(2);
      expect(css("a{background:linear-gradient(#fff,#000)}").cor).toBe(1);
      expect(css("/* #fff */ a{background:url(#fff)}").cor).toBe(0);
      expect(css("/*\n  #fff e #000\n*/\na{color:var(--text)}").cor).toBe(0);
    });

    it("raio: 0, inherit, initial, unset e calc() com var() não contam; 999px sim", () => {
      for (const v of [
        "0",
        "0px",
        "inherit",
        "initial",
        "unset",
        "calc(var(--radius-lg) - 2px)",
      ])
        expect(css(`a{border-radius:${v}}`).raio, v).toBe(0);
      expect(css("a{border-radius:999px}").raio).toBe(1);
      expect(css("a{border-radius:9999px}").raio).toBe(1);
      expect(css("a{border-radius:0 0 8px 8px}").raio).toBe(1);
    });

    it("cor: seletor não conta; fallback de var() conta", () => {
      expect(css("#abc{color:var(--x)}").cor).toBe(0);
      expect(css("a[href='#abc']{margin:0}").cor).toBe(0);
      expect(css("#abc{color:#fff}").cor).toBe(1);
      expect(css("a{color:var(--x, #fff)}").cor).toBe(1);
      expect(
        css("a{\n background:linear-gradient(\n #fff,\n #000\n );\n}").cor,
      ).toBe(2);
    });

    it("z-index: número conta, var() não", () => {
      expect(css("a{z-index:3}").zIndex).toBe(1);
      expect(css("a{z-index:-1}").zIndex).toBe(1);
      expect(css("a{z-index:var(--z-toast)}").zIndex).toBe(0);
    });

    it("!important conta", () => {
      expect(css("a{color:var(--x)!important}").important).toBe(1);
      expect(css("a{color:var(--x) ! important}").important).toBe(1);
    });

    it("raio: valor fixo conta, var() não", () => {
      expect(css("a{border-radius:8px}").raio).toBe(1);
      expect(css("a{border-radius:var(--radius-lg)}").raio).toBe(0);
    });

    it("sombra: valor à mão conta; var() e none não", () => {
      expect(css("a{box-shadow:0 1px 2px rgba(0,0,0,.2)}").sombra).toBe(1);
      expect(css("a{box-shadow:var(--shadow-md)}").sombra).toBe(0);
      expect(css("a{box-shadow:none}").sombra).toBe(0);
    });

    it("curva: ease, linear e duração literal contam; tokens não", () => {
      expect(css("a{transition:opacity 120ms ease-in-out}").curva).toBe(1);
      expect(css("a{transition:opacity var(--duration-fast) ease}").curva).toBe(
        1,
      );
      expect(
        css("a{animation:giro var(--duration-slow) linear infinite}").curva,
      ).toBe(1);
      expect(css("a{transition:opacity .2s var(--ease-standard)}").curva).toBe(
        1,
      );
      expect(
        css("a{transition:opacity var(--duration-fast) var(--ease-standard)}")
          .curva,
      ).toBe(0);
    });

    it("curva: declaração em várias linhas conta uma vez", () => {
      expect(
        css("a{\n transition:\n  opacity 1s ease,\n  transform 1s ease;\n}")
          .curva,
      ).toBe(1);
    });

    it("animaLayout: transition que cita width, height, top, left ou all", () => {
      expect(
        css("a{transition:width var(--duration-fast) var(--ease-standard)}")
          .animaLayout,
      ).toBe(1);
      expect(
        css("a{transition:all var(--duration-fast) var(--ease-standard)}")
          .animaLayout,
      ).toBe(1);
      expect(
        css("a{transition:opacity var(--duration-fast) var(--ease-standard)}")
          .animaLayout,
      ).toBe(0);
      expect(
        css("a{transition:border-left-color var(--duration-fast)}").animaLayout,
      ).toBe(0);
    });

    it("blur: backdrop-filter só passa em bloco com position fixed ou sticky", () => {
      expect(css("a{backdrop-filter:blur(4px)}").blur).toBe(1);
      expect(css("a{position:relative;backdrop-filter:blur(4px)}").blur).toBe(
        1,
      );
      expect(css("a{position:fixed;backdrop-filter:blur(4px)}").blur).toBe(0);
      expect(css("a{backdrop-filter:blur(4px);position:sticky}").blur).toBe(0);
      expect(
        css(
          "@media (min-width:1px){a{backdrop-filter:blur(4px)}b{position:fixed}}",
        ).blur,
      ).toBe(1);
    });

    it("marcador com motivo isenta a linha", () => {
      expect(
        css(
          "a{border-radius:50% /* acabamento: permitido(raio) — círculo do avatar */}",
        ).raio,
      ).toBe(0);
      expect(
        css(
          "a{\n z-index:2; /* acabamento: permitido(zIndex) — local ao cartão */\n}",
        ).zIndex,
      ).toBe(0);
    });

    it("marcador sem motivo não isenta", () => {
      expect(
        css("a{border-radius:50% /* acabamento: permitido(raio) — */}").raio,
      ).toBe(1);
      expect(css("a{border-radius:50% /* acabamento: permitido */}").raio).toBe(
        1,
      );
      expect(
        css("a{border-radius:50% /* acabamento: permitido(raio) —   */}").raio,
      ).toBe(1);
    });

    it("o marcador é por tipo: sombra não isenta a cor da mesma linha", () => {
      expect(
        css(
          "a{\n box-shadow:0 4px 8px #000; /* acabamento: permitido(sombra) — composição */\n}",
        ),
      ).toMatchObject({ sombra: 0, cor: 1 });
      expect(
        css(
          "a{\n box-shadow:0 4px 8px #000; /* acabamento: permitido(cor,sombra) — composição */\n}",
        ),
      ).toMatchObject({ sombra: 0, cor: 0 });
      expect(
        css(
          "a{\n box-shadow:0 4px 8px #000; /* acabamento: permitido(cor , sombra) - composição */\n}",
        ),
      ).toMatchObject({ sombra: 0, cor: 0 });
    });

    it("marcador sem tipo ou com tipo desconhecido não isenta nada", () => {
      expect(
        css("a{\n border-radius:50%; /* acabamento: permitido — círculo */\n}")
          .raio,
      ).toBe(1);
      expect(
        css(
          "a{\n border-radius:50%; /* acabamento: permitido() — círculo */\n}",
        ).raio,
      ).toBe(1);
      expect(
        css(
          "a{\n border-radius:50%; /* acabamento: permitido(raio,cores) — círculo */\n}",
        ).raio,
      ).toBe(1);
      expect(
        marcadoresInvalidos(
          "a{\n z-index:2; /* acabamento: permitido — x */\n}",
        ),
      ).toEqual([
        { linha: 2, texto: "z-index:2; /* acabamento: permitido — x */" },
      ]);
      expect(
        marcadoresInvalidos(
          "a{ z-index:2; /* acabamento: permitido(zIndex) — x */ }",
        ),
      ).toEqual([]);
    });

    it("anel de foco (0 0 0 spread) e inset não contam como sombra; sombra com blur conta", () => {
      expect(css("a{box-shadow:0 0 0 3px var(--focus-ring)}").sombra).toBe(0);
      expect(
        css("a{box-shadow:0 0 0 2px var(--a, var(--b)), 0 0 0 3px red}").sombra,
      ).toBe(0);
      expect(css("a{box-shadow:inset 4px 0 0 var(--x)}").sombra).toBe(0);
      expect(css("a{box-shadow:0 0 0 1px red, var(--shadow-md)}").sombra).toBe(
        0,
      );
      expect(css("a{box-shadow:0 0 0 3px #fff}")).toMatchObject({
        sombra: 0,
        cor: 1,
      });
      expect(css("a{box-shadow:0 4px 12px rgba(0,0,0,.2)}").sombra).toBe(1);
      expect(css("a{box-shadow:0 0 8px 2px red}").sombra).toBe(1);
      expect(css("a{box-shadow:0 0 0 1px red, 0 8px 16px red}").sombra).toBe(1);
    });

    it("o marcador vale só para a linha dele", () => {
      expect(
        css(
          "a{\n border-radius:50%; /* acabamento: permitido(raio) — círculo */\n box-shadow:0 0 2px red;\n}",
        ),
      ).toMatchObject({ raio: 0, sombra: 1 });
    });

    it(".tsx: só conta cor dentro de literal de string", () => {
      const tsx = (texto) => contarDesvios("src/ui/x.tsx", texto);
      expect(tsx('style={{ color: "#fff" }}').cor).toBe(1);
      expect(tsx("const c = '#abc';").cor).toBe(1);
      expect(tsx("const c = `rgb(0 0 0)`;").cor).toBe(1);
      expect(tsx("// #fff").cor).toBe(0);
      expect(tsx("/* #fff */ const a = 1;").cor).toBe(0);
      expect(tsx("const a = 1; // cor '#fff'").cor).toBe(0);
      expect(tsx("const a = n & 0xfff;").cor).toBe(0);
      expect(tsx('style={{ color: "var(--text)" }}').cor).toBe(0);
    });

    it(".tsx: o marcador isenta e outros tipos não se aplicam", () => {
      const tsx = (texto) => contarDesvios("src/ui/x.tsx", texto);
      expect(
        tsx('const c = "#fff"; // acabamento: permitido(cor) — cor do mapa')
          .cor,
      ).toBe(0);
      expect(tsx('const c = "#fff"; // acabamento: permitido(cor) —').cor).toBe(
        1,
      );
      expect(tsx('const s = "z-index:3; border-radius:8px";')).toMatchObject({
        zIndex: 0,
        raio: 0,
      });
    });
  });

  describe("compararComLinhaDeBase", () => {
    const zerado = (parcial) => ({ ...parcial });

    it("só devolve as pioras, com antes e agora", () => {
      expect(
        compararComLinhaDeBase(
          { "a.css": zerado({ cor: 2, raio: 1 }) },
          { "a.css": zerado({ cor: 3, raio: 1 }) },
        ),
      ).toEqual([{ caminho: "a.css", tipo: "cor", antes: 2, agora: 3 }]);
    });

    it("ficar igual ou cair não é piora", () => {
      expect(
        compararComLinhaDeBase(
          { "a.css": { cor: 2, raio: 4 } },
          { "a.css": { cor: 2, raio: 1 } },
        ),
      ).toEqual([]);
    });

    it("arquivo novo tem limite zero", () => {
      expect(compararComLinhaDeBase({}, { "novo.css": { cor: 1 } })).toEqual([
        { caminho: "novo.css", tipo: "cor", antes: 0, agora: 1 },
      ]);
    });

    it("arquivo só na base (apagado) não acusa nada", () => {
      expect(compararComLinhaDeBase({ "velho.css": { cor: 5 } }, {})).toEqual(
        [],
      );
    });

    it("tipo que a base não lista tem limite zero", () => {
      expect(
        compararComLinhaDeBase(
          { "a.css": { cor: 1 } },
          { "a.css": { cor: 1, blur: 2 } },
        ),
      ).toEqual([{ caminho: "a.css", tipo: "blur", antes: 0, agora: 2 }]);
    });
  });

  describe("check-acabamento-so-encolhe.mjs num repositório de verdade", () => {
    let pasta;

    afterEach(() => {
      if (pasta) rmSync(pasta, { recursive: true, force: true });
      pasta = null;
    });

    const git = (...args) =>
      execFileSync(
        "git",
        ["-c", "user.name=Teste", "-c", "user.email=teste@exemplo", ...args],
        { cwd: pasta, stdio: "pipe" },
      );

    function escrever(caminho, texto) {
      const completo = join(pasta, caminho);
      mkdirSync(dirname(completo), { recursive: true });
      writeFileSync(completo, texto);
    }

    function rodar(...args) {
      return spawnSync(process.execPath, [SCRIPT, ...args], {
        cwd: pasta,
        encoding: "utf8",
      });
    }

    const BASE = "scripts/acabamento-linha-de-base.json";

    function repositorio() {
      pasta = mkdtempSync(join(tmpdir(), "acabamento-"));
      git("init", "-q", "-b", "main");
      escrever("src/a.css", "a{color:#fff;border-radius:8px}\n");
      git("add", ".");
    }

    it("--atualizar cria a linha de base e depois a verificação passa", () => {
      repositorio();
      const gravou = rodar("--atualizar");
      expect(gravou.status, gravou.stderr).toBe(0);
      expect(JSON.parse(readFileSync(join(pasta, BASE), "utf8"))).toEqual({
        "src/a.css": { cor: 1, raio: 1 },
      });
      const r = rodar();
      expect(r.status, r.stderr).toBe(0);
    });

    it("falha com a piora e aponta arquivo, tipo, antes e agora", () => {
      repositorio();
      rodar("--atualizar");
      escrever("src/a.css", "a{color:#fff;border-radius:8px;z-index:3}\n");
      escrever("src/novo.css", "b{color:#000}\n");
      git("add", ".");
      const r = rodar();
      expect(r.status).toBe(1);
      expect(r.stderr).toContain("src/a.css");
      expect(r.stderr).toContain("zIndex");
      expect(r.stderr).toContain("0 → 1");
      expect(r.stderr).toContain("src/novo.css");
      expect(r.stderr).toContain("docs/design-system-agsus.md");
    });

    it("--atualizar recusa gravar se algum número sobe", () => {
      repositorio();
      rodar("--atualizar");
      const antes = readFileSync(join(pasta, BASE), "utf8");
      escrever(
        "src/a.css",
        "a{\ncolor:#fff;\nbackground:#000;\nborder-radius:8px}\n",
      );
      const r = rodar("--atualizar");
      expect(r.status).toBe(1);
      expect(readFileSync(join(pasta, BASE), "utf8")).toBe(antes);
    });

    it("--atualizar baixa a linha de base quando o arquivo melhora", () => {
      repositorio();
      rodar("--atualizar");
      escrever("src/a.css", "a{color:var(--text)}\n");
      const r = rodar("--atualizar");
      expect(r.status, r.stderr).toBe(0);
      expect(JSON.parse(readFileSync(join(pasta, BASE), "utf8"))).toEqual({});
    });
  });
});

bloco("check-legado-so-encolhe", () => {
  /*
  O legado só encolhe: arquivo novo em src/modules/ ou src/analises/ (em
  relação à base) quebra o check:architecture. Editar e apagar podem.
*/

  const SCRIPT = resolve("scripts/check-legado-so-encolhe.mjs");

  describe("arquivosNovosNoLegado", () => {
    it("as pastas do legado são src/modules e src/analises", () => {
      expect(PASTAS_DO_LEGADO).toEqual(["src/modules/", "src/analises/"]);
    });

    it("acusa arquivo novo nas pastas do legado", () => {
      const antes = ["src/modules/a.js", "src/analises/b.js"];
      const agora = [
        "src/modules/a.js",
        "src/modules/novo.js",
        "src/analises/b.js",
        "src/analises/outro.css",
      ];
      expect(arquivosNovosNoLegado(antes, agora)).toEqual([
        "src/modules/novo.js",
        "src/analises/outro.css",
      ]);
    });

    it("aceita editar, apagar e criar fora do legado", () => {
      const antes = ["src/modules/a.js", "src/modules/b.js"];
      const agora = [
        "src/modules/a.js",
        "src/modulos/tela/tela.jsx",
        "src/ui/kpi.tsx",
        "src/componentes/x.jsx",
      ];
      expect(arquivosNovosNoLegado(antes, agora)).toEqual([]);
    });

    it("renomear dentro do legado conta como arquivo novo", () => {
      expect(
        arquivosNovosNoLegado(
          ["src/modules/velho.js"],
          ["src/modules/novo.js"],
        ),
      ).toEqual(["src/modules/novo.js"]);
    });

    it("migrar para TypeScript (o .js vira .ts) não é arquivo novo", () => {
      expect(
        arquivosNovosNoLegado(
          ["src/modules/a.js", "src/modules/b.jsx"],
          ["src/modules/a.ts", "src/modules/b.tsx"],
        ),
      ).toEqual([]);
    });

    it("o .ts ao lado do .js que continua, ou de outro nome, é arquivo novo", () => {
      expect(
        arquivosNovosNoLegado(
          ["src/modules/a.js", "src/modules/velho.js"],
          ["src/modules/a.js", "src/modules/a.ts", "src/modules/novo.ts"],
        ),
      ).toEqual(["src/modules/a.ts", "src/modules/novo.ts"]);
    });

    it("não confunde pasta com prefixo parecido", () => {
      expect(
        arquivosNovosNoLegado(
          [],
          ["src/modules-extra/a.js", "src/analisesx.js"],
        ),
      ).toEqual([]);
    });
  });

  /*
  O legado não tem mais JavaScript escrito à mão (03/11/2026): nenhum .js pode
  voltar a src/modules/ ou src/analises/, nem um que já existia na base. Só o
  conhecimento gerado da Aya fica.
*/
  describe("javascriptNoLegado", () => {
    it("só o gerado da Aya é permitido", () => {
      expect(JAVASCRIPT_PERMITIDO_NO_LEGADO).toEqual([
        "src/modules/aya-conhecimento-gerado.js",
      ]);
    });

    it("acusa .js, .jsx, .mjs e .cjs no legado, fora o gerado", () => {
      expect(
        javascriptNoLegado([
          "src/modules/aya-conhecimento-gerado.js",
          "src/modules/a.ts",
          "src/modules/b.js",
          "src/modules/c.jsx",
          "src/analises/d.mjs",
          "src/analises/e.cjs",
          "src/modules/f.css",
        ]),
      ).toEqual([
        "src/modules/b.js",
        "src/modules/c.jsx",
        "src/analises/d.mjs",
        "src/analises/e.cjs",
      ]);
    });

    it("JavaScript fora do legado não é com ele", () => {
      expect(
        javascriptNoLegado([
          "src/lib/contornos.js",
          "src/lib/rpc-contrato.js",
          "src/modules-extra/a.js",
        ]),
      ).toEqual([]);
    });

    it("o legado de verdade não tem JavaScript escrito à mão", () => {
      const arquivos = execFileSync(
        "git",
        ["ls-files", "--", "src/modules", "src/analises"],
        { encoding: "utf8" },
      )
        .split(/\r?\n/)
        .filter(Boolean)
        .filter((caminho) => existsSync(caminho));
      expect(javascriptNoLegado(arquivos)).toEqual([]);
    });
  });

  describe("check-legado-so-encolhe.mjs num repositório de verdade", () => {
    let pasta;

    afterEach(() => {
      if (pasta) rmSync(pasta, { recursive: true, force: true });
      pasta = null;
    });

    const git = (...args) =>
      execFileSync(
        "git",
        ["-c", "user.name=Teste", "-c", "user.email=teste@exemplo", ...args],
        { cwd: pasta, stdio: "pipe" },
      );

    function escrever(caminho, texto = "x\n") {
      const completo = join(pasta, caminho);
      mkdirSync(dirname(completo), { recursive: true });
      writeFileSync(completo, texto);
    }

    function rodar() {
      const env = { ...process.env };
      delete env.GITHUB_BASE_REF;
      return spawnSync(process.execPath, [SCRIPT], {
        cwd: pasta,
        env,
        encoding: "utf8",
      });
    }

    function repositorioComBase() {
      pasta = mkdtempSync(join(tmpdir(), "legado-"));
      git("init", "-q", "-b", "main");
      escrever("src/modules/existente.ts");
      escrever("src/analises/painel.css");
      git("add", ".");
      git("commit", "-q", "-m", "base");
      git("checkout", "-q", "-b", "feat");
    }

    it("falha com arquivo novo em src/modules", () => {
      repositorioComBase();
      escrever("src/modules/novo-modulo.ts");
      git("add", ".");
      git("commit", "-q", "-m", "novo");
      const r = rodar();
      expect(r.status).toBe(1);
      expect(r.stderr).toContain("src/modules/novo-modulo.ts");
    });

    it("falha com JavaScript no legado, mesmo um que já existia na base", () => {
      repositorioComBase();
      git("checkout", "-q", "main");
      escrever("src/modules/antigo.js");
      git("add", ".");
      git("commit", "-q", "-m", "base com js");
      git("checkout", "-q", "-B", "feat");
      escrever("src/modules/antigo.js", "editado\n");
      git("add", ".");
      git("commit", "-q", "-m", "edita o js");
      const r = rodar();
      expect(r.status).toBe(1);
      expect(r.stderr).toContain("JavaScript no legado");
      expect(r.stderr).toContain("src/modules/antigo.js");
    });

    it("o conhecimento gerado da Aya pode ficar em JavaScript", () => {
      repositorioComBase();
      git("checkout", "-q", "main");
      escrever("src/modules/aya-conhecimento-gerado.js");
      git("add", ".");
      git("commit", "-q", "-m", "gerado");
      git("checkout", "-q", "-B", "feat");
      escrever("src/modules/aya-conhecimento-gerado.js", "regerado\n");
      git("add", ".");
      git("commit", "-q", "-m", "regera");
      const r = rodar();
      expect(r.status, r.stderr).toBe(0);
    });

    it("a base andou e apagou um arquivo do legado: o ramo que ainda o tem passa", () => {
      repositorioComBase();
      git("checkout", "-q", "main");
      git("rm", "-q", "src/modules/existente.ts");
      git("commit", "-q", "-m", "a base apaga");
      git("checkout", "-q", "feat");
      escrever("src/modules/existente.ts", "editado no ramo\n");
      git("add", ".");
      git("commit", "-q", "-m", "edita");
      const r = rodar();
      expect(r.status, r.stderr).toBe(0);
    });

    it("passa editando e apagando no legado e criando em src/modulos", () => {
      repositorioComBase();
      escrever("src/modules/existente.ts", "mudou\n");
      git("rm", "-q", "src/analises/painel.css");
      escrever("src/modulos/tela/tela.jsx");
      git("add", ".");
      git("commit", "-q", "-m", "ok");
      const r = rodar();
      expect(r.status, r.stderr).toBe(0);
      expect(r.stdout).toContain("Legado sem arquivo novo");
    });
  });
});

bloco("check-migrations-timestamp-unico", () => {
  /*
  O passo do CI que barra, antes do merge, a migration nova com timestamp que
  a main já usa (o caso de 05/11/2026, 20261105190000).
*/

  const MAIN = [
    "20261105170000_leitura_da_api_de_editais.sql",
    "20261105190000_area_na_api.sql",
    "README.md",
  ];

  describe("timestamp das migrations do PR contra a main", () => {
    it("lê o timestamp só de migration .sql com prefixo", () => {
      expect(timestampDe("supabase/migrations/20261105190000_a.sql")).toBe(
        "20261105190000",
      );
      expect(timestampDe("README.md")).toBeNull();
      expect(timestampDe("20261105190000_a.txt")).toBeNull();
    });

    it("timestamp livre e depois da última da main passa sem aviso", () => {
      const resultado = compararMigrations(MAIN, [
        ...MAIN,
        "20261106100000_nova.sql",
      ]);
      expect(resultado).toEqual({
        novas: ["20261106100000_nova.sql"],
        erros: [],
        avisos: [],
      });
    });

    it("timestamp que a main já tem falha e manda renomear a nova", () => {
      const { erros } = compararMigrations(MAIN, [
        ...MAIN,
        "20261105190000_fontes_apos_leitura_da_api_de_editais.sql",
      ]);
      expect(erros).toHaveLength(1);
      expect(erros[0]).toContain("20261105190000_fontes_apos_leitura");
      expect(erros[0]).toContain("20261105190000_area_na_api.sql");
      expect(erros[0]).toMatch(/Renomeie a migration NOVA/);
    });

    it("duas novas do mesmo PR com o mesmo timestamp falham", () => {
      const { erros } = compararMigrations(MAIN, [
        ...MAIN,
        "20261106100000_a.sql",
        "20261106100000_b.sql",
      ]);
      expect(erros).toEqual([
        expect.stringContaining("20261106100000_a.sql, 20261106100000_b.sql"),
      ]);
    });

    it("timestamp livre mas anterior à última da main só avisa", () => {
      const { erros, avisos } = compararMigrations(MAIN, [
        ...MAIN,
        "20261105180000_no_meio.sql",
      ]);
      expect(erros).toEqual([]);
      expect(avisos).toEqual([
        expect.stringContaining("anterior à última migration da main"),
      ]);
    });

    it("migration da main apagada no PR só avisa (as aplicadas saem do repositório)", () => {
      const { erros, avisos } = compararMigrations(MAIN, [
        "20261105170000_leitura_da_api_de_editais.sql",
      ]);
      expect(erros).toEqual([]);
      expect(avisos).toEqual([
        expect.stringContaining(
          "1 migration(s) da main saíram neste PR (20261105190000_area_na_api.sql)",
        ),
      ]);
    });

    it("renomear mantendo o timestamp continua falhando", () => {
      const { erros } = compararMigrations(MAIN, [
        "20261105170000_leitura_da_api_de_editais.sql",
        "20261105190000_area_na_api_renomeada.sql",
      ]);
      expect(erros).toEqual([
        expect.stringContaining(
          "20261105190000_area_na_api_renomeada.sql: o timestamp 20261105190000 já existe na main",
        ),
      ]);
    });

    it("ramo atrasado: o que só a main tem não é novo nem apagado", () => {
      const inicio = ["20261105170000_leitura_da_api_de_editais.sql"];
      const resultado = compararMigrations(
        MAIN,
        [...inicio, "20261106100000_nova.sql"],
        inicio,
      );
      expect(resultado.erros).toEqual([]);
      expect(resultado.novas).toEqual(["20261106100000_nova.sql"]);
    });

    it("os repetidos antigos da main não contam contra o PR", () => {
      const main = [...MAIN, "20261105190000_fontes.sql"];
      expect(compararMigrations(main, main)).toEqual({
        novas: [],
        erros: [],
        avisos: [],
      });
    });
  });
});

bloco("check-no-new-patch-layers", () => {
  describe("sem novas camadas de remendo", () => {
    it("reconhece nomes de remendo", () => {
      for (const caminho of [
        "src/analises/analises-dark-mode-fix.js",
        "src/styles/system-ui-fixes.css",
        "src/modules/health-dashboard-refinements.js",
        "src/modules/config-page-enhancements.js",
        "src/analises/analises-active-cache-recovery.js",
        "src/styles/post-152-regression-fixes.css",
        "src/styles/post157-interface-tuning.css",
        "src/analises/analises-runtime-stability.js",
        "src/lib/hotfix.js",
      ]) {
        expect(ehNomeDeRemendo(caminho), caminho).toBe(true);
      }
    });

    it("não confunde nomes comuns", () => {
      for (const caminho of [
        "src/lib/prefixos.js",
        "src/lib/sufixo-do-edital.js",
        "src/modulos/mapa-saude-indigena/guarda-do-mapa.ts",
        "src/lib/paginas-em-paralelo.js",
        "src/componentes/modal.jsx",
        "src/lib/matriz-acessos.js",
        "src/lib/postos.js",
      ]) {
        expect(ehNomeDeRemendo(caminho), caminho).toBe(false);
      }
    });
  });
});

bloco("cores-das-series", () => {
  const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
  const tokens = ler("src/styles/tokens.css");

  /* Os --series-N de um bloco do tokens.css (do seletor até a chave que fecha). */
  function seriesDoBloco(seletor) {
    const inicio = tokens.indexOf(`${seletor} {`);
    const bloco = tokens.slice(inicio, tokens.indexOf("\n}", inicio));
    return Object.fromEntries(
      [...bloco.matchAll(/--series-(\d+):\s*(#[0-9a-f]{6})/gi)].map(
        ([, n, cor]) => [Number(n), cor.toLowerCase()],
      ),
    );
  }

  /*
  A paleta validada com a skill `dataviz` (luminosidade, croma, daltonismo e
  contraste ≥ 3:1 sobre #ffffff e #0e1e2e): azul, laranja, ciano, violeta,
  magenta e oliva, em ordem fixa. Trocar uma cor pede validar de novo.
*/
  const VALIDADA = {
    claro: {
      1: "#0f5db7",
      2: "#eb6834",
      3: "#0090bc",
      4: "#6d5efc",
      5: "#d55181",
      6: "#8a6d00",
    },
    escuro: {
      1: "#4f8ff0",
      2: "#d95f2b",
      3: "#1a9fc8",
      4: "#8e6cf2",
      5: "#d55181",
      6: "#a8861a",
    },
  };

  describe("cores das séries (gráficos e mapas)", () => {
    // Em 01/10/2026 o tema claro tinha três azuis e um cinza: os projetos do
    // mapa de Projetos ficavam com cores quase iguais.
    const claro = seriesDoBloco(":root");
    const escuro = seriesDoBloco('html[data-theme="dark"]');

    it("tema claro = paleta validada", () => {
      expect(claro).toEqual(VALIDADA.claro);
    });

    it("tema escuro = paleta validada (inclusive a 5)", () => {
      expect(escuro).toEqual(VALIDADA.escuro);
    });

    it("seis cores diferentes em cada tema", () => {
      expect(new Set(Object.values(claro)).size).toBe(6);
      expect(new Set(Object.values(escuro)).size).toBe(6);
    });
  });
});

bloco("cores-so-por-token", () => {
  /*
  Cor só por token (regras de ouro, docs/biblioteca/design-e-tokens.md; docs/design-system-agsus.md 3.6).

  Por que existe: no tema escuro, o balão das mensagens próprias do chat ficou
  quase branco com texto claro, e a auditoria de 08/10/2026 achou o mesmo
  defeito em outras telas. Duas causas, as duas cobertas aqui:

  1. Cor literal (#hex, rgb/rgba/hsl, white/black) no CSS ou no código fica
     igual nos dois temas. Toda cor literal que existia foi classificada em
     `tests/fixtures/cores-literais-permitidas.json`, com o motivo por arquivo
     (marca, mapa, papel, efeito, tela de acesso, dívida do tema escuro
     legado…). Cor literal NOVA — ou mais uma ocorrência de uma que já existe
     — quebra este teste: use um token de `src/styles/tokens.css`. Se a cor é
     de propósito fixa (logo, mapa, papel), acrescente-a à lista com o motivo.
     Ao remover cores, regenere a lista: `ATUALIZAR_CORES=1 npx vitest run
     tests/repositorio-e-banco.test.js (bloco cores-so-por-token)` (ela só encolhe).

  2. Token semântico oficial (`--color-*`) sem valor no tema escuro fica com a
     cor do claro. Todo `--color-*` semântico usado em `src/` precisa estar no
     bloco `html[data-theme="dark"]` de `tokens.css`. Os primitivos
     (`--color-blue-500`, `--color-neutral-0`…) não mudam com o tema, de
     propósito; usá-los direto só nos arquivos da lista (seção `primitivos`).
*/

  const RAIZ = path.resolve(import.meta.dirname, "..");
  const LISTA = path.join(
    RAIZ,
    "tests/fixtures/cores-literais-permitidas.json",
  );
  const EXTENSOES = /\.(css|js|jsx|ts|tsx)$/;
  // Gerados: os ícones (máscara SVG em data URI, a cor é a da máscara) e a base da AYA.
  const IGNORADOS = new Set([
    "src/styles/icones-lucide.css",
    "src/modules/aya-conhecimento-gerado.js",
  ]);

  function arquivosDoSrc(pasta = path.join(RAIZ, "src")) {
    return fs.readdirSync(pasta, { withFileTypes: true }).flatMap((item) => {
      const caminho = path.join(pasta, item.name);
      if (item.isDirectory()) return arquivosDoSrc(caminho);
      return EXTENSOES.test(item.name) ? [caminho] : [];
    });
  }

  function relativo(caminho) {
    return path.relative(RAIZ, caminho).split(path.sep).join("/");
  }

  /* Tira comentários (as razões de contraste citam hex nos comentários). */
  function semComentarios(texto, css) {
    const semBloco = texto.replace(/\/\*[\s\S]*?\*\//g, " ");
    return css ? semBloco : semBloco.replace(/(^|[\s;{}(),])\/\/[^\n]*/g, "$1");
  }

  const HEX =
    /(?<![&\w#])#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![0-9a-z_-])/gi;
  const FUNCAO = /\b(?:rgba?|hsla?)\(\s*[^)]*\)/gi;
  const NOME = /(?<![\w-])(?:white|black)(?![\w-])/gi;

  /** Cores literais de um arquivo: { "#fff": 2, "rgba(0,0,0,.5)": 1 }. */
  function coresLiterais(texto, css) {
    const limpo = semComentarios(texto.replace(/\r\n/g, "\n"), css);
    const contagem = {};
    const somar = (cor) => {
      const chave = cor.toLowerCase().replace(/\s+/g, "");
      contagem[chave] = (contagem[chave] || 0) + 1;
    };
    for (const m of limpo.matchAll(HEX)) somar(m[0]);
    for (const m of limpo.matchAll(FUNCAO)) {
      // rgba(var(--x)) e afins não são literais.
      if (!m[0].includes("var(")) somar(m[0]);
    }
    if (css) {
      // Só em valor de declaração (white-space e afins não casam pelo hífen).
      for (const linha of limpo.split("\n")) {
        const valor = linha.includes(":")
          ? linha.slice(linha.indexOf(":"))
          : "";
        for (const m of valor.matchAll(NOME)) somar(m[0]);
      }
    }
    return contagem;
  }

  const PRIMITIVO =
    /var\(\s*(--color-(?:blue|neutral|success|warning|danger)-\d+)\b/g;
  const SEMANTICO = /var\(\s*(--color-[a-z0-9-]+)/g;

  function lerLista() {
    return JSON.parse(fs.readFileSync(LISTA, "utf8"));
  }

  function levantamento() {
    const cores = {};
    const primitivos = {};
    const semanticos = new Set();
    for (const caminho of arquivosDoSrc()) {
      const rel = relativo(caminho);
      if (IGNORADOS.has(rel)) continue;
      const texto = fs.readFileSync(caminho, "utf8");
      const css = rel.endsWith(".css");
      if (rel !== "src/styles/tokens.css") {
        const achadas = coresLiterais(texto, css);
        if (Object.keys(achadas).length) cores[rel] = achadas;
        const limpo = semComentarios(texto, css);
        const usados = [...limpo.matchAll(PRIMITIVO)].map((m) => m[1]);
        if (usados.length) primitivos[rel] = [...new Set(usados)].sort();
        for (const m of limpo.matchAll(SEMANTICO)) semanticos.add(m[1]);
      }
    }
    return { cores, primitivos, semanticos };
  }

  function blocoEscuroDosTokens() {
    const tokens = fs.readFileSync(
      path.join(RAIZ, "src/styles/tokens.css"),
      "utf8",
    );
    const bloco = tokens.match(/html\[data-theme="dark"\]\s*\{([^}]*)\}/);
    if (!bloco) throw new Error("tokens.css sem bloco html[data-theme=dark]");
    return new Set(
      [...bloco[1].matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]),
    );
  }

  const { cores, primitivos, semanticos } = levantamento();

  if (process.env.ATUALIZAR_CORES === "1") {
    const atual = lerLista();
    const motivos = atual.motivos || {};
    const novo = {
      leia: atual.leia,
      motivos: Object.fromEntries(
        Object.keys(cores)
          .sort()
          .map((rel) => [rel, motivos[rel] || "SEM MOTIVO: classifique"]),
      ),
      cores: Object.fromEntries(
        Object.keys(cores)
          .sort()
          .map((k) => [k, cores[k]]),
      ),
      primitivos: Object.fromEntries(
        Object.keys(primitivos)
          .sort()
          .map((k) => [k, primitivos[k]]),
      ),
    };
    fs.writeFileSync(LISTA, `${JSON.stringify(novo, null, 2)}\n`);
  }

  describe("cor só por token", () => {
    const lista = lerLista();

    it("nenhuma cor literal nova fora da lista de exceções", () => {
      const novas = [];
      for (const [rel, achadas] of Object.entries(cores)) {
        const permitidas = lista.cores[rel] || {};
        for (const [cor, n] of Object.entries(achadas)) {
          const limite = permitidas[cor] || 0;
          if (n > limite)
            novas.push(`${rel}: ${cor} (${n}, permitido ${limite})`);
        }
      }
      expect(
        novas,
        "Cor literal nova: troque por um token de src/styles/tokens.css " +
          "(ou, se a cor é fixa de propósito, ponha-a na lista com o motivo).",
      ).toEqual([]);
    });

    it("todo arquivo da lista tem o motivo da exceção", () => {
      const semMotivo = Object.keys(lista.cores).filter(
        (rel) => !lista.motivos[rel] || lista.motivos[rel].startsWith("SEM"),
      );
      expect(semMotivo).toEqual([]);
    });

    it("todo --color-* semântico usado tem valor no tema escuro", () => {
      const escuro = blocoEscuroDosTokens();
      const primitivo = /^--color-(?:blue|neutral|success|warning|danger)-\d+$/;
      // A barra lateral tem cor própria (configurável), igual nos dois temas.
      const proprioDaBarra = /^--color-sidebar-/;
      const semEscuro = [...semanticos]
        .filter((nome) => !primitivo.test(nome) && !proprioDaBarra.test(nome))
        .filter((nome) => !escuro.has(nome))
        .sort();
      expect(
        semEscuro,
        'Dê valor a estes tokens em html[data-theme="dark"] (tokens.css).',
      ).toEqual([]);
    });

    it("primitivo de cor direto só nos arquivos da lista", () => {
      const novos = [];
      for (const [rel, usados] of Object.entries(primitivos)) {
        const permitidos = new Set(lista.primitivos[rel] || []);
        for (const nome of usados)
          if (!permitidos.has(nome)) novos.push(`${rel}: ${nome}`);
      }
      expect(
        novos,
        "Primitivo não muda no tema escuro: use o token semântico " +
          "(--color-text-brand, --color-action-primary, --state-*…).",
      ).toEqual([]);
    });

    it("acha cor literal e ignora comentário, entidade HTML e white-space", () => {
      expect(
        coresLiterais(
          "a { color: #FFF; white-space: nowrap; background: rgba(0, 0, 0, 0.5); }\n/* #123456 */",
          true,
        ),
      ).toEqual({ "#fff": 1, "rgba(0,0,0,0.5)": 1 });
      expect(coresLiterais('const a = "&#160;"; // #abcdef', false)).toEqual(
        {},
      );
      expect(coresLiterais("b { border: 1px solid white; }", true)).toEqual({
        white: 1,
      });
    });
  });
});

bloco("estado-das-migrations", () => {
  /*
  O QUE JÁ CORREU NO BANCO, E O QUE FALTA

  Este repositório tinha 25 migrations e 7 ficheiros de correção de dados, e
  nenhum sítio que dissesse quais deles já tinham corrido. `docs/banco-de-dados.md`
  reconhecia isso ao dizer que três ficheiros "não devem ser renomeados: já foram
  aplicados, e renomear quebraria o histórico de quem os aplicou" — histórico que
  não existia em lado nenhum além das pessoas.

  O custo foi medido: na revisão de setembro de 2026 a pergunta "preciso rodar
  algum SQL?" apareceu cinco vezes, e cada resposta exigiu puxar o payload do
  banco e comparar coordenada a coordenada. Treze scripts descartáveis para a
  mesma pergunta.

  A ideia é do SIGAV (`sigav."TB_MIGRACAO"`). O que não veio de lá é o modo de
  aplicar: aqui quem executa SQL é a equipa, e o que faltava era saber o estado.
*/
  const ficheiro = (caminho, hash) => ({
    caminho,
    hash,
    diretorio: caminho.split("/")[0],
  });
  const registo = (caminho, hash, aplicada = "2026-09-22") => ({
    caminho,
    hash,
    origem: "arquivo",
    aplicada,
  });

  describe("os quatro estados", () => {
    it("o que está no disco e não no banco está por aplicar", () => {
      const r = classificar([ficheiro("migrations/a.sql", "h1")], []);
      expect(r.pendentes.map((f) => f.caminho)).toEqual(["migrations/a.sql"]);
      expect(r.aplicados).toEqual([]);
    });

    it("o que bate em caminho e hash está aplicado", () => {
      const r = classificar(
        [ficheiro("migrations/a.sql", "h1")],
        [registo("migrations/a.sql", "h1")],
      );
      expect(r.aplicados).toHaveLength(1);
      expect(r.pendentes).toEqual([]);
    });

    /*
    O achado que só o hash encontra, e o mais perigoso: alguém corrige um erro
    de digitação numa migration já aplicada, o Git fica coerente, o banco não, e
    ninguém descobre até um ambiente novo nascer diferente.
  */
    it("mesmo caminho e hash diferente é divergência, não pendência", () => {
      const r = classificar(
        [ficheiro("migrations/a.sql", "h2")],
        [registo("migrations/a.sql", "h1")],
      );
      expect(r.divergentes).toHaveLength(1);
      expect(r.divergentes[0].registo.hash).toBe("h1");
      expect(r.pendentes).toEqual([]);
      expect(r.aplicados).toEqual([]);
    });

    /*
    Registado no banco e sem ficheiro no disco. Não é erro por si — o SIGAV
    apagou 181 migrations ao criar um baseline —, mas tem de ser visível.
  */
    it("o prefixo supabase/ do registro não vira órfão nem pendente", () => {
      expect(caminhoRegistado("supabase/migrations/a.sql")).toBe(
        "migrations/a.sql",
      );
      const r = classificar(
        [ficheiro("migrations/a.sql", "h1")],
        [registo("supabase/migrations/a.sql", "h1")],
      );
      expect(r.aplicados.map((f) => f.caminho)).toEqual(["migrations/a.sql"]);
      expect(r.pendentes).toEqual([]);
      expect(r.orfaos).toEqual([]);
    });

    it("registado sem ficheiro é órfão", () => {
      const r = classificar([], [registo("migrations/apagada.sql", "h1")]);
      expect(r.orfaos).toHaveLength(1);
      expect(r.pendentes).toEqual([]);
    });

    it("aguenta entrada vazia ou inválida", () => {
      for (const vazio of [undefined, null, "não é lista"]) {
        const r = classificar(vazio, vazio);
        expect(r.aplicados).toEqual([]);
        expect(r.pendentes).toEqual([]);
        expect(r.divergentes).toEqual([]);
        expect(r.orfaos).toEqual([]);
      }
    });

    it("não confunde ficheiros de mesmo nome em diretórios diferentes", () => {
      const r = classificar(
        [ficheiro("migrations/x.sql", "h1"), ficheiro("correcoes/x.sql", "h2")],
        [registo("migrations/x.sql", "h1")],
      );
      expect(r.aplicados.map((f) => f.caminho)).toEqual(["migrations/x.sql"]);
      expect(r.pendentes.map((f) => f.caminho)).toEqual(["correcoes/x.sql"]);
    });
  });

  /*
  supabase/migrations-historicas/ (20/10/2026): já aplicadas, perigosas se
  reaplicadas. O registro as guarda pelo caminho de origem "migrations/<x>".
*/
  describe("as históricas", () => {
    const historica = (nome, hash) => ({
      caminho: `migrations/${nome}`,
      arquivo: `migrations-historicas/${nome}`,
      diretorio: "migrations-historicas",
      historica: true,
      hash,
    });

    it("registrada pelo caminho antigo continua aplicada", () => {
      const r = classificar(
        [historica("velha.sql", "h1")],
        [registo("supabase/migrations/velha.sql", "h1")],
      );
      expect(r.aplicados.map((f) => f.arquivo)).toEqual([
        "migrations-historicas/velha.sql",
      ]);
      expect(r.orfaos).toEqual([]);
      expect(r.pendentes).toEqual([]);
    });

    it("sem registro não vira pendente", () => {
      const r = classificar([historica("velha.sql", "h1")], []);
      expect(r.pendentes).toEqual([]);
      expect(r.historicasSemRegistro.map((f) => f.arquivo)).toEqual([
        "migrations-historicas/velha.sql",
      ]);
    });

    it("o disco as lê com o caminho do registro", () => {
      // Uma pasta supabase/ de mentira: a de verdade fica vazia sem migration pendente.
      const raiz = mkdtempSync(join(tmpdir(), "estado-das-migrations-"));
      try {
        for (const pasta of ["migrations", "ensaios", "rollback"]) {
          mkdirSync(join(raiz, pasta));
          writeFileSync(
            join(
              raiz,
              pasta,
              "20261109180000_catalogo_dos_robos_e_chave_unica.sql",
            ),
            "begin; commit;",
          );
        }
        const noDisco = ficheirosNoDisco(raiz);
        expect(noDisco).toHaveLength(1);
        expect(noDisco[0]).toMatchObject({
          caminho:
            "migrations/20261109180000_catalogo_dos_robos_e_chave_unica.sql",
          historica: false,
        });
        // Só migrations/ (as pastas de legado saíram); ensaios e rollbacks não entram na conta.
        expect(noDisco.every((f) => f.diretorio === "migrations")).toBe(true);
      } finally {
        rmSync(raiz, { recursive: true, force: true });
      }
    });
  });

  describe("o hash", () => {
    it("muda com o conteúdo e não com o nome", () => {
      expect(hashDoConteudo("begin; commit;")).toBe(
        hashDoConteudo("begin; commit;"),
      );
      expect(hashDoConteudo("begin; commit;")).not.toBe(
        hashDoConteudo("begin;  commit;"),
      );
    });

    /*
    Um espaço a mais conta como mudança. É deliberado: o script não tem como
    saber se a diferença é de forma ou de efeito, e quem lê decide — há um modo
    próprio para reconhecer a mudança que foi só de forma.
  */
    it("é sensível a espaço em branco", () => {
      expect(hashDoConteudo("a \n")).not.toBe(hashDoConteudo("a\n"));
    });

    /*
    O "\r" não: vem do checkout (core.autocrlf no Windows), não do SQL. O
    registro do banco é o sha256 do arquivo sem "\r" (auditoria de 13/10/2026).
  */
    it("ignora o \\r do fim de linha (CRLF e LF dão o mesmo hash)", () => {
      expect(hashDoConteudo("a\r\nb\r\n")).toBe(hashDoConteudo("a\nb\n"));
      expect(hashDoConteudo(Buffer.from("a\r\n"))).toBe(
        "87428fc522803d31065e7bce3cf03fe475096631e5e07bbd7a0fde60c4cf25c7",
      );
    });
  });

  /*
  O caminho vem do disco. Nome de ficheiro com apóstrofo é raro e legal em quase
  todo sistema de ficheiros, e é a forma que uma injeção teria aqui.
*/
  describe("o literal que vai para o SQL", () => {
    it("dobra o apóstrofo", () => {
      expect(escaparLiteral("migrations/o'brien.sql")).toBe(
        "'migrations/o''brien.sql'",
      );
    });

    /*
    A propriedade que importa não é "não contém `';`" — `''` contém isso
    legitimamente, e foi assim que a primeira versão deste caso reprovou código
    correto. O que fecha um literal antes da hora é um apóstrofo ÍMPAR: depois
    de remover os pares, não pode sobrar nenhum.
  */
    it("não deixa escapar uma aspa solta", () => {
      const perigoso = "x'; drop table public.migracoes_aplicadas; --";
      const escapado = escaparLiteral(perigoso);
      expect(escapado.startsWith("'")).toBe(true);
      expect(escapado.endsWith("'")).toBe(true);
      expect(escapado.slice(1, -1).replace(/''/g, "")).not.toContain("'");
    });
  });

  describe("contra os ficheiros deste repositório", () => {
    const noDisco = ficheirosNoDisco("supabase");

    it("cada ficheiro tem caminho único", () => {
      const vistos = new Set(noDisco.map((f) => f.caminho));
      expect(vistos.size).toBe(noDisco.length);
    });

    /*
    Os pares repetidos de antes (já aplicados e registrados pelo caminho) saíram com as
    migrations antigas em 10/11/2026: nenhum par novo.
  */
    const REPETIDOS_CONHECIDOS = {};

    it("nenhum timestamp de migration repetido além dos já aplicados", () => {
      const nomes = noDisco
        .filter((f) => f.diretorio === "migrations")
        .map((f) => f.caminho);
      const repetidos = timestampsRepetidos(nomes);
      for (const [ts, lista] of Object.entries(repetidos)) {
        expect(
          REPETIDOS_CONHECIDOS[ts],
          `timestamp ${ts} repetido: ${lista.join(", ")} — renumere a migration nova`,
        ).toEqual(lista);
      }
    });

    it("acha o timestamp repetido", () => {
      expect(
        timestampsRepetidos([
          "migrations/20261013190000_a.sql",
          "migrations/20261013190000_b.sql",
          "migrations/20261013200000_c.sql",
          "migrations/sem_timestamp.sql",
        ]),
      ).toEqual({
        20261013190000: ["20261013190000_a.sql", "20261013190000_b.sql"],
      });
    });

    it("diretório ausente não é erro", () => {
      expect(() => ficheirosNoDisco("não-existe")).not.toThrow();
      expect(ficheirosNoDisco("não-existe")).toEqual([]);
    });
  });

  /*
  A tabela é ferramenta de operação, não superfície da aplicação: o navegador
  não a alcança, e nada no frontend deve passar a alcançá-la.
*/
  describe("a tabela não é exposta ao navegador", () => {
    it("nenhum módulo do frontend a menciona", () => {
      const procurar = (dir) =>
        readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
          e.isDirectory()
            ? procurar(`${dir}/${e.name}`)
            : e.name.endsWith(".js")
              ? [`${dir}/${e.name}`]
              : [],
        );
      for (const caminho of procurar("src")) {
        expect(
          readFileSync(caminho, "utf8"),
          `${caminho} menciona a tabela de migrations`,
        ).not.toContain("migracoes_aplicadas");
      }
    });
  });
});

bloco("fonte-geist", () => {
  const ler = (caminho) => readFileSync(caminho, "utf8");
  const cssDe = (pasta) =>
    readdirSync(pasta)
      .filter((nome) => nome.endsWith(".css"))
      .map((nome) => join(pasta, nome));

  /*
  A fonte do sistema passou de Inter para Geist, no app principal e em
  Análises, como fonte variável (um arquivo para 400–900), e chega às regras
  pelo token `--font-sans`, de `tokens.css`.

  13/11/2026: a Geist vinha do Google Fonts e só começava a baixar depois do
  CSS; a cada atualização o texto aparecia na fonte do sistema e trocava para
  a Geist (a tela de acesso "piscava"). Agora o próprio site a serve
  (public/fonts, com a licença OFL ao lado), pedida com preload no <head>, e
  a @font-face usa `font-display: optional` (nunca troca na frente de quem lê).
*/
  describe("fonte Geist no sistema todo", () => {
    it("o index.html pede a Geist do próprio site, antes do CSS, e não do Google Fonts", () => {
      const html = ler("index.html");
      const preload = html.indexOf('href="/fonts/geist-latin.woff2"');
      expect(preload).toBeGreaterThan(-1);
      const tag = html.slice(html.lastIndexOf("<link", preload), preload + 120);
      expect(tag).toContain('rel="preload"');
      expect(tag).toContain('as="font"');
      expect(tag).toContain("crossorigin");
      expect(preload).toBeLessThan(html.indexOf('href="/src/styles/app.css"'));
      expect(html).not.toContain("fonts.googleapis.com");
      expect(html).not.toContain("family=Inter");
    });

    it("o arquivo e a licença estão em public/fonts", () => {
      const arquivo = readFileSync("public/fonts/geist-latin.woff2");
      expect(arquivo.subarray(0, 4).toString("latin1")).toBe("wOF2");
      expect(ler("public/fonts/LICENSE-Geist.txt")).toContain(
        "SIL Open Font License, Version 1.1",
      );
    });

    it("a @font-face aponta o arquivo e não troca de fonte na frente de quem lê", () => {
      const tokens = ler("src/styles/tokens.css");
      const bloco = tokens.slice(tokens.indexOf("@font-face {"));
      const regra = bloco.slice(0, bloco.indexOf("}"));
      expect(regra).toContain('font-family: "Geist";');
      expect(regra).toContain("font-weight: 400 900;");
      expect(regra).toContain("font-display: optional;");
      expect(regra).toContain(
        'src: url("/fonts/geist-latin.woff2") format("woff2");',
      );
    });

    it("o token --font-sans começa pela Geist", () => {
      expect(ler("src/styles/tokens.css")).toMatch(/--font-sans:\s*"Geist",/);
    });

    it("tokens.css é o primeiro CSS dos pontos de entrada", () => {
      const primeiroCss = (fonte) =>
        fonte.match(/import\s+"([^"]+\.css)"/)?.[1];
      expect(primeiroCss(ler("src/main.ts"))).toBe("./styles/tokens.css");
    });

    it("o corpo do app usa o token", () => {
      expect(ler("src/styles/app.css")).toMatch(
        /body\s*\{[^}]*font-family:\s*var\(--font-sans,/,
      );
    });

    it("não sobra Inter em CSS, no aviso de sessão nem na página offline", () => {
      const arquivos = [
        ...cssDe("src/styles"),
        "src/lib/sessao/session-lifecycle.ts",
        "offline.html",
      ];
      const comInter = arquivos.filter((arquivo) =>
        /["',\s:]Inter["',;\s]/.test(ler(arquivo)),
      );
      expect(comInter).toEqual([]);
    });
  });
});

bloco("funai-geodata-proxy", () => {
  describe("cache das respostas do proxy da Funai", () => {
    function respostaFalsa() {
      const cabecalhos = {};
      return {
        cabecalhos,
        status() {
          return this;
        },
        setHeader(nome, valor) {
          cabecalhos[nome] = valor;
        },
        end() {},
      };
    }

    it("erro não vai para o cache compartilhado", async () => {
      const { default: handler } = await import("../api/funai-geodata.ts");
      const res = respostaFalsa();
      await handler(
        { method: "GET", headers: {}, query: { dataset: "x" } },
        res,
      );
      expect(res.cabecalhos["Cache-Control"]).toBe("no-store");
    });
  });

  /*
  A Funai deixou de publicar Funai:areas_dsei (502 a cada página, OPE-01 da
  auditoria de 09/11/2026): o proxy não oferece mais `dsei` e nem chega a
  chamar a Funai. O contorno dos DSEIs vem de public/data/contornos-dos-dseis.json.
*/
  describe("o proxy não pede mais o DSEI à Funai", () => {
    it("dataset=dsei responde 400 sem chamar a rede", async () => {
      const { default: handler } = await import("../api/funai-geodata.ts");
      const chamadas = [];
      const original = globalThis.fetch;
      globalThis.fetch = (...args) => {
        chamadas.push(args);
        return Promise.reject(new Error("não devia chamar"));
      };
      try {
        let status = 0;
        let corpo = "";
        const res = {
          status(s) {
            status = s;
            return this;
          },
          setHeader() {},
          end(texto) {
            corpo = texto;
          },
        };
        await handler(
          { method: "GET", headers: {}, query: { dataset: "dsei" } },
          res,
        );
        expect(status).toBe(400);
        expect(JSON.parse(corpo)).toEqual({ error: "invalid_dataset" });
        expect(chamadas).toHaveLength(0);
      } finally {
        globalThis.fetch = original;
      }
    });
  });

  /*
  Parâmetro vazio não vale como zero: `Number("")` é 0. Um `bbox` com a última
  coordenada vazia passava como recorte até a linha do Equador, e
  `maxFeatures=` pedia uma terra só — e essa resposta ia para o cache
  compartilhado.
*/
  describe("parâmetros vazios do recorte de terras", () => {
    async function pedir(query) {
      const { default: handler } = await import("../api/funai-geodata.ts");
      const pedidos = [];
      const original = globalThis.fetch;
      globalThis.fetch = async (url) => {
        pedidos.push(new URL(String(url)));
        return new Response(
          JSON.stringify({ type: "FeatureCollection", features: [] }),
        );
      };
      let status = 0;
      let corpo = "";
      const res = {
        status(s) {
          status = s;
          return this;
        },
        setHeader() {},
        end(texto) {
          corpo = texto;
        },
      };
      try {
        await handler(
          {
            method: "GET",
            headers: {},
            query: { dataset: "territories", ...query },
          },
          res,
        );
      } finally {
        globalThis.fetch = original;
      }
      return { status, corpo, pedido: pedidos[0] };
    }

    it.each(["-60,-10,-50,", ",-10,-50,0", "-60,,-50,0", "-60,-10, ,0"])(
      "bbox com coordenada vazia (%s) é recusado sem chamar a Funai",
      async (bbox) => {
        const { status, corpo, pedido } = await pedir({ bbox });
        expect(status).toBe(400);
        expect(JSON.parse(corpo)).toEqual({ error: "invalid_bbox" });
        expect(pedido).toBeUndefined();
      },
    );

    it("bbox completo segue para a Funai", async () => {
      const { status, pedido } = await pedir({ bbox: "-60,-10,-50,0" });
      expect(status).toBe(200);
      expect(pedido.searchParams.get("bbox")).toBe("-60,-10,-50,0,EPSG:4326");
    });

    it.each([undefined, "", " "])(
      "maxFeatures ausente ou vazio (%j) usa o padrão de 250",
      async (maxFeatures) => {
        const { pedido } = await pedir({ bbox: "-60,-10,-50,0", maxFeatures });
        expect(pedido.searchParams.get("maxFeatures")).toBe("250");
      },
    );

    it.each([
      ["120", "120"],
      ["9999", "500"],
      ["0", "1"],
      ["abc", "250"],
    ])("maxFeatures=%s vira %s", async (maxFeatures, esperado) => {
      const { pedido } = await pedir({ bbox: "-60,-10,-50,0", maxFeatures });
      expect(pedido.searchParams.get("maxFeatures")).toBe(esperado);
    });
  });
});

bloco("funcoes-da-vercel-leves", () => {
  const vercel = JSON.parse(readFileSync("vercel.json", "utf8"));
  const pyproject = readFileSync("pyproject.toml", "utf8");

  /*
  A conta Hobby da Vercel chegou a 100% de "Function Storage": cada deploy
  guarda o pacote de cada função. A função Python levava o repositório inteiro
  (supabase/, tests/, src/, docs/... ~37 MB) e Pillow + pypdfium2 (~27 MB) que
  a leitura do PDF não usa. Estes testes impedem que isso volte sem querer.
*/
  describe("funções da Vercel enxutas", () => {
    const funcoesPython = readdirSync("api").filter(
      (nome) => nome.endsWith(".py") && !nome.startsWith("_"),
    );

    it("toda função api/*.py deixa de fora o que não é api/", () => {
      expect(funcoesPython.length).toBeGreaterThan(0);
      for (const nome of funcoesPython) {
        const opcoes = vercel.functions?.[`api/${nome}`];
        expect(opcoes, `api/${nome} sem entrada em vercel.json`).toBeTruthy();
        expect(opcoes.excludeFiles).toBe("{!(api)/**,.*/**,*,api/!(*.py)}");
      }
    });

    it("as dependências vêm do pyproject.toml, sem requirements.txt na raiz", () => {
      // Com os dois, não fica claro qual a Vercel usa; o override só vale no pyproject.
      expect(existsSync("requirements.txt")).toBe(false);
      expect(pyproject).toMatch(/dependencies = \["pdfplumber==/);
    });

    it("Pillow e pypdfium2 ficam fora do pacote", () => {
      expect(pyproject).toContain(`"pillow; sys_platform == 'never'"`);
      expect(pyproject).toContain(`"pypdfium2; sys_platform == 'never'"`);
    });
  });

  /*
  O GeoServer da Funai não responde às funções em iad1 (EUA): todo pedido a
  /api/funai-geodata e /api/funai-wms voltava 502, e a camada de Terras
  Indígenas e DSEIs sumia do mapa. Do Brasil ele responde. A conta Hobby só
  aceita uma região, por isso ela vale para o projeto inteiro.
*/
  describe("região das funções", () => {
    it("as funções rodam em São Paulo (gru1), perto da Funai", () => {
      expect(vercel.regions).toEqual(["gru1"]);
    });
  });
});

bloco("guarda-de-mutation-observer", () => {
  const GUARDA = resolve("scripts/check-no-new-mutation-observer.mjs");

  /*
  Protege a correção de 10/09/2026.

  A guarda lia as linhas `+` do diff para decidir se havia observador novo. Isso
  confunde *usar* com *reescrever*: no #173 foi preciso passar o prettier em
  `analises-dark-mode-fix.js`, que nunca tinha sido formatado, e a reformatação
  reescreveu a linha de um observador que já existia. A linha reapareceu como
  adição e o Quality Gate reprovou um PR que não introduziu observador nenhum.

  A regra proíbe o número crescer, então é o número que se compara. Estes testes
  correm a guarda de verdade, num repositório descartável, porque o que interessa
  não é como o ficheiro está escrito — é o código de saída que ele devolve.
*/

  let repo;

  function git(...args) {
    return execFileSync("git", args, { cwd: repo, encoding: "utf8" });
  }

  function escrever(caminho, conteudo) {
    const destino = join(repo, caminho);
    mkdirSync(join(destino, ".."), { recursive: true });
    writeFileSync(destino, conteudo);
  }

  function commitar(mensagem) {
    git("add", "-A");
    git("commit", "-q", "-m", mensagem);
  }

  function correrGuarda() {
    // `GITHUB_BASE_REF` do CI apontaria para um `origin/` que não existe aqui.
    const { GITHUB_BASE_REF, ...ambiente } = process.env;
    try {
      const saida = execFileSync(process.execPath, [GUARDA], {
        cwd: repo,
        encoding: "utf8",
        env: ambiente,
        stdio: ["ignore", "pipe", "pipe"],
      });
      return { codigo: 0, texto: saida };
    } catch (erro) {
      return { codigo: erro.status, texto: `${erro.stdout}${erro.stderr}` };
    }
  }

  const COM_OBSERVADOR = `export function ligar(alvo) {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((m) => m.target);
  });
  observer.observe(alvo, { childList: true });
}
`;

  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), "guarda-mo-"));
    git("init", "-q", "-b", "main");
    git("config", "user.email", "teste@exemplo.org");
    git("config", "user.name", "Teste");
    git("config", "core.autocrlf", "false");
    git("config", "commit.gpgsign", "false");
    escrever("src/antigo.js", COM_OBSERVADOR);
    escrever("src/limpo.js", "export const nada = 1;\n");
    commitar("base");
    git("checkout", "-q", "-b", "trabalho");
  });

  afterEach(() => {
    rmSync(repo, { recursive: true, force: true });
  });

  describe("a guarda deixa passar o que não acrescenta observador", () => {
    it("um observador só reescrito continua sendo o mesmo observador", () => {
      escrever(
        "src/antigo.js",
        COM_OBSERVADOR.replace("(mutations)", "(listaDeMutacoes)").replace(
          "(m) => m.target",
          "(mutacao) => mutacao.target",
        ),
      );
      commitar("reformatar");

      // A prova de que este é o caso que reprovava antes: a linha do observador
      // aparece como adição no diff, tal e qual no #173.
      const adicoes = git("diff", "--unified=0", "main", "HEAD", "--", "src")
        .split(/\r?\n/)
        .filter((l) => l.startsWith("+") && l.includes("MutationObserver"));
      expect(adicoes).toHaveLength(1);

      expect(correrGuarda().codigo).toBe(0);
    });

    it("apagar um observador não reprova", () => {
      escrever("src/antigo.js", "export const nada = 1;\n");
      commitar("remover");
      const { codigo, texto } = correrGuarda();
      expect(codigo).toBe(0);
      expect(texto).toContain("0 uso(s)");
    });

    it("mexer fora de src/ não conta", () => {
      escrever("scripts/qualquer.js", COM_OBSERVADOR);
      commitar("fora de src");
      expect(correrGuarda().codigo).toBe(0);
    });
  });

  describe("a guarda continua reprovando uso novo de verdade", () => {
    it("num ficheiro novo", () => {
      escrever("src/novo.js", COM_OBSERVADOR);
      commitar("observador novo");
      const { codigo, texto } = correrGuarda();
      expect(codigo).toBe(1);
      expect(texto).toContain("src/novo.js: 0 -> 1");
    });

    it("num ficheiro que já tinha um", () => {
      escrever("src/antigo.js", COM_OBSERVADOR + COM_OBSERVADOR);
      commitar("segundo observador");
      const { codigo, texto } = correrGuarda();
      expect(codigo).toBe(1);
      expect(texto).toContain("src/antigo.js: 1 -> 2");
    });

    /*
    Comparar o total deixaria isto passar: um a menos aqui, um a mais ali, soma
    igual. É por ficheiro que se compara.
  */
    it("mesmo quando outro ficheiro perde um ao mesmo tempo", () => {
      escrever("src/antigo.js", "export const nada = 1;\n");
      escrever("src/limpo.js", COM_OBSERVADOR);
      commitar("trocar de sítio");
      const { codigo, texto } = correrGuarda();
      expect(codigo).toBe(1);
      expect(texto).toContain("src/limpo.js: 0 -> 1");
    });
  });
});

bloco("legenda-flutuante-nao-tapa-controles", () => {
  /*
  A legenda flutuante sobe do canto de baixo do mapa. A do Mapa DSEIs nasce
  aberta e é a mais alta ("Colorir por", seis faixas, "Sedes e CASAIs"): numa
  moldura baixa (celular, janela baixa) ela subia por cima do "+ −" e do
  seletor Mapa | Satélite | Mapa DSEIs. A altura passa a ter teto — a
  moldura menos os controles do canto de cima — e o corpo rola por dentro.
*/
  const css = readFileSync(
    "src/modulos/mapa-saude-indigena/mapa-saude-indigena.css",
    "utf8",
  );

  const regra = (seletor) => {
    const inicio = css.indexOf(`${seletor} {`);
    expect(inicio, `regra ${seletor}`).toBeGreaterThan(-1);
    return css.slice(inicio, css.indexOf("}", inicio));
  };

  describe("a legenda flutuante não tapa os controles do mapa", () => {
    it("tem teto de altura abaixo dos controles do canto de cima", () => {
      const legenda = regra(".mapa-si-legenda--flutuante");
      expect(legenda).toContain("bottom: var(--space-3)");
      expect(legenda).toMatch(
        /max-height:\s*calc\(100% - var\(--mapa-si-cantos-de-cima\)\)/,
      );
      expect(legenda).toContain("grid-template-rows: auto minmax(0, 1fr)");
    });

    it("o corpo rola por dentro; o botão 'Legenda' fica à vista", () => {
      const corpo = regra(
        ".mapa-si-legenda--flutuante .mapa-si-legenda__corpo",
      );
      expect(corpo).toContain("overflow-y: auto");
      expect(corpo).toContain("min-height: 0");
    });
  });
});

bloco("linha-do-tempo-vertical", () => {
  const css = readFileSync(
    "src/modulos/cronograma/cronograma.css",
    "utf8",
  ).replace(/\r\n/g, "\n");
  const bloco = (seletor) => {
    const inicio = css.indexOf(`${seletor} {`);
    return css.slice(inicio, css.indexOf("}", inicio));
  };

  describe("linha do tempo do edital (Cronograma)", () => {
    // Em 01/10/2026, na horizontal, a última etapa ficava cortada na borda do
    // cartão e os nomes longos quebravam em até 6 linhas.
    it("é vertical e rola dentro do cartão, sem faixa horizontal", () => {
      const lista = bloco(".cal-timeline");
      expect(lista).toContain("flex-direction: column");
      expect(lista).toContain("overflow-y: auto");
      expect(lista).not.toContain("overflow-x");
      expect(bloco(".cal-passo")).not.toMatch(/flex:\s*1 0/);
    });

    it("o ponto usa tokens (legível no tema escuro)", () => {
      expect(bloco(".cal-passo-marca")).not.toContain("#fff");
      expect(
        bloco('.cal-passo[data-situacao="futura"] .cal-passo-marca'),
      ).not.toContain("#cbd5e1");
    });
  });
});

bloco("map-base-layer-switcher", () => {
  const source = readFileSync("src/modules/map-base-layer-switcher.ts", "utf8");
  // Os mapas instalam as guardas quando o Leaflet chega (sob demanda).
  const carga = readFileSync(
    "src/modulos/mapa-saude-indigena/carregar-leaflet.ts",
    "utf8",
  );
  const css = readFileSync("src/styles/map-base-layer-switcher.css", "utf8");

  describe("seletor Mapa | Satélite", () => {
    it("usa World Imagery como camada satélite real", () => {
      expect(source).toContain("World_Imagery/MapServer/tile/{z}/{y}/{x}");
      expect(source).toContain("Esri, Maxar, Earthstar Geographics");
    });

    it("não depende de chave secreta no frontend", () => {
      expect(source).not.toMatch(/accessToken|apiKey|VITE_.*(?:MAP|ESRI)/i);
    });

    it("reconhece os provedores cartográficos atuais sem alterar o legado", () => {
      expect(source).toContain("tile.openstreetmap.org");
      expect(source).toContain("basemaps.cartocdn.com");
      expect(source).toContain("classifyBaseLayerUrl");
    });

    it("troca apenas tile layers e preserva overlays vetoriais", () => {
      expect(source).toContain("__agsusBaseMapKind");
      expect(source).toContain("map.eachLayer");
      expect(source).toContain("map.removeLayer(layer)");
      expect(source).not.toContain("clearLayers()");
    });

    it("volta ao mapa após quatro falhas consecutivas de tiles", () => {
      expect(source).toContain("SATELLITE_ERROR_LIMIT = 4");
      expect(source).toContain(
        "setBaseMapMode(L, map, MODE_MAP, { persist: true })",
      );
      expect(source).toContain("agsus:map-satellite-fallback");
    });

    it("expõe o estado por aria-pressed e rótulos legíveis", () => {
      expect(source).toContain('"Mapa"');
      expect(source).toContain('"Satélite"');
      expect(source).toContain("aria-pressed");
      expect(source).toContain('aria-label", "Camada de fundo do mapa"');
    });

    it("limita o mapa entre a escala nacional de 500 km e a aproximação de dezenas de metros", () => {
      expect(source).toContain("export const MAP_MIN_ZOOM = 4.5");
      expect(source).toContain("export const MAP_MAX_ZOOM = 19");
      expect(source).toContain("minZoom: MAP_MIN_ZOOM");
      expect(source).toContain("maxZoom: MAP_MAX_ZOOM");
      expect(source).toContain("map.setMinZoom?.(MAP_MIN_ZOOM)");
      expect(source).toContain("map.setMaxZoom?.(MAP_MAX_ZOOM)");
    });

    it("mantém fundo cartográfico e satélite nativos até o zoom 19", () => {
      expect(source).toContain("normalized.maxNativeZoom = nativeZoom");
      expect(source).toContain("maxZoom: MAP_MAX_ZOOM");
      expect(source).toContain("SATELLITE_MAX_NATIVE_ZOOM = 19");
      expect(source).toContain("maxNativeZoom: SATELLITE_MAX_NATIVE_ZOOM");
    });

    it("é instalado quando o Leaflet chega e carrega o CSS próprio", () => {
      expect(carga).toContain("fundo.installMapBaseLayerSwitcher();");
      // A guarda do mapa não envolve o Leaflet: `criarMapa` a liga.
      expect(carga).not.toContain("installLeafletMapGuard");
      expect(carga).toContain(
        'import("../../styles/map-base-layer-switcher.css")',
      );
      expect(carga).toContain(
        'import("../../modules/map-base-layer-switcher.ts")',
      );
    });

    it("mantém os dois botões utilizáveis em tela estreita e tema escuro", () => {
      expect(css).toContain("@media (max-width: 700px)");
      expect(css).toContain('[data-theme="dark"] .agsus-basemap-switcher');
      expect(css).toContain(".agsus-basemap-switcher__button:focus-visible");
    });
  });
});

bloco("map-zoom-guard-regression", () => {
  const guard = readFileSync(
    "src/modulos/mapa-saude-indigena/guarda-do-mapa.ts",
    "utf8",
  );
  const switcher = readFileSync(
    "src/modules/map-base-layer-switcher.ts",
    "utf8",
  );

  describe("faixa de zoom do mapa de Saude Indigena", () => {
    it("mantem guard e switcher no mesmo limite de 500 km", () => {
      expect(switcher).toContain("MAP_MIN_ZOOM = 4.5");
      expect(guard).toContain("HEALTH_MAP_MIN_ZOOM = 4.5");
      expect(guard).toContain("HEALTH_MAP_OVERVIEW_MAX_ZOOM = 4.5");
      expect(guard).not.toContain("originalSetMinZoom?.(3)");
      expect(guard).not.toContain("Math.min(requested, 3)");
    });

    it("pede imagem de satelite nativa ate o limite visual do mapa", () => {
      expect(switcher).toContain("SATELLITE_MAX_NATIVE_ZOOM = 19");
      expect(switcher).toContain("maxNativeZoom: SATELLITE_MAX_NATIVE_ZOOM");
      expect(switcher).toContain("MAP_MAX_ZOOM = 19");
    });
  });
});

bloco("migrations-pasta-limpa", () => {
  /*
  A PASTA DE MIGRATIONS SÓ TEM O QUE SE APLICA

  `supabase/migrations/` é a fila de schema: tudo ali é aplicável, em ordem de
  timestamp. As migrations já aplicadas saíram do repositório em 10/11/2026 (seguem
  no banco e no registro `public.migracoes_aplicadas`); a pasta guarda só as que
  ainda importam. Processo em `docs/biblioteca/banco-e-migrations.md`.
*/
  const MIGRATIONS = "supabase/migrations";
  // Sem migration pendente, a pasta some do Git (pasta vazia não é versionada).
  const nomes = existsSync(MIGRATIONS) ? readdirSync(MIGRATIONS) : [];
  const sql = nomes.filter((n) => n.toLowerCase().endsWith(".sql"));

  describe("supabase/migrations", () => {
    it("só tem .sql com timestamp de 14 dígitos", () => {
      const foraDoPadrao = nomes.filter(
        (n) => !/^\d{14}_[a-z0-9_]+\.sql$/.test(n),
      );
      expect(foraDoPadrao).toEqual([]);
    });

    it("toda migration tem rollback e ensaio com o mesmo nome", () => {
      for (const n of sql) {
        expect(existsSync(`supabase/rollback/${n}`), `rollback de ${n}`).toBe(
          true,
        );
        expect(existsSync(`supabase/ensaios/${n}`), `ensaio de ${n}`).toBe(
          true,
        );
      }
    });

    /*
    O acesso automático por domínio e o bridge da IA local foram decisões de
    nunca aplicar: nada os recria, nem com outro nome.
  */
    it("nada recria o acesso automático nem o bridge da Aya", () => {
      expect(
        sql.filter((n) => /acesso_basico|bridge_da_aya|bridge_aya/.test(n)),
      ).toEqual([]);
    });

    it("as pastas de legado não voltaram", () => {
      for (const pasta of [
        "supabase/migrations-historicas",
        "supabase/descartadas",
        "supabase/correcoes",
      ])
        expect(existsSync(pasta), pasta).toBe(false);
    });
  });
});

bloco("parabens-acima-do-cabecalho", () => {
  const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
  /* As camadas (`--z-*`) moram em app.css; `var(--z-…)` e `calc(var(--z-…) ± n)` viram número. */
  const app = ler("src/styles/app.css");
  const numero = (valor) => {
    if (!valor) return Number.NaN;
    try {
      return resolver(valor);
    } catch {
      return Number.NaN;
    }
  };
  /* O maior z-index entre os blocos do seletor (o mesmo seletor aparece em @media). */
  const zDoBloco = (css, seletor) => {
    let maior = Number.NaN;
    let inicio = css.indexOf(`${seletor} {`);
    while (inicio !== -1) {
      const bloco = css.slice(inicio, css.indexOf("}", inicio));
      const z = numero(/z-index:\s*([^;]+);/.exec(bloco)?.[1]?.trim());
      if (z && !(z <= maior)) maior = z;
      inicio = css.indexOf(`${seletor} {`, inicio + 1);
    }
    return maior;
  };

  describe("o aviso de parabéns fica visível", () => {
    // Em 01/10/2026 o aviso (z-index 10001) ficava atrás do cabeçalho (10030).
    const comemoracao = ler("src/styles/comemoracao.css");
    const zDoAviso = zDoBloco(comemoracao, ".comemoracao");

    it("acima do cabeçalho, da barra lateral e do menu da conta (com Pessoas online)", () => {
      // O cabeçalho: --z-header em app.css; no celular, 10030 (mobile-app.css).
      const cabecalho = Math.max(
        zDoBloco(app, ".top"),
        zDoBloco(ler("src/styles/mobile-app.css"), "  .app .top"),
      );
      // Pessoas online fica dentro do menu da conta desde 13/11/2026.
      const pessoasOnline = zDoBloco(
        ler("src/styles/platform-shell.css"),
        ".top-user-popover",
      );
      expect(cabecalho).toBeGreaterThan(0);
      expect(pessoasOnline).toBeGreaterThan(0);
      expect(zDoAviso).toBeGreaterThan(cabecalho);
      expect(zDoAviso).toBeGreaterThan(10036);
      expect(zDoAviso).toBeGreaterThan(pessoasOnline);
    });

    it("os fogos ficam logo abaixo do aviso", () => {
      const fogos = numero(
        /position: fixed;\s*inset: 0;\s*z-index:\s*([^;]+);/
          .exec(comemoracao)?.[1]
          ?.trim(),
      );
      expect(fogos).toBeLessThan(zDoAviso);
      expect(fogos).toBeGreaterThan(10036);
    });
  });
});

bloco("pos157-interface-tuning", () => {
  const css = readFileSync("src/styles/post157-interface-tuning.css", "utf8");
  const main = readFileSync("src/main.ts", "utf8");
  const telas = readFileSync("src/app/telas.tsx", "utf8");
  const mapGuard = readFileSync(
    "src/modulos/mapa-saude-indigena/guarda-do-mapa.ts",
    "utf8",
  );
  const sidebar = readFileSync(
    "src/componentes/barra-lateral/marca.ts",
    "utf8",
  );
  // A escolha da logo e da cor é de Configurações › Aparência (React).
  const marcaDaBarra = readFileSync(
    "src/lib/navegacao/marca-da-barra-lateral.ts",
    "utf8",
  );
  const imagens = readFileSync("src/modulos/configuracoes/imagens.ts", "utf8");
  const aparencia = readFileSync(
    "src/modulos/configuracoes/aparencia.tsx",
    "utf8",
  );
  const publicacao = readFileSync(
    "src/lib/configuracoes/publicacao-de-configuracoes.ts",
    "utf8",
  );
  const governance = readFileSync(
    "src/modulos/configuracoes/estado.ts",
    "utf8",
  );

  describe("primeiro paint da tela de login", () => {
    it("não usa mais os fallbacks roxos do legado", () => {
      expect(css).toContain(
        "background-color: var(--login-arte-cor, #eef4f8);",
      );
      expect(css).toContain("var(--login-panel-color, #ffffff)");
      expect(css).not.toContain("#4d2270");
      expect(css).not.toContain("#c296eb");
    });
  });

  /*
  A densidade do KPI saiu daqui. Este arquivo sobrepunha os KPIs da Visão geral
  com !important e chegou a deixar o rótulo com 9px. Hoje a Visão geral é React
  (src/modulos/visao-geral/) e o KPI é o card compacto de src/ui/ (`Kpi`,
  ui.css), com valores de tokens.css: rótulo em `caption` e valor em `metric`.
*/
  describe("densidade do dashboard Saúde Indígena", () => {
    const kpis = readFileSync("src/ui/ui.css", "utf8");

    it("não é mais sobrescrita aqui", () => {
      expect(css).not.toContain("#page-dashboard .kpi");
    });

    it("vem de tokens, com rótulo legível e sem zoom ou scale", () => {
      expect(kpis).toContain("font-size: var(--text-metric-sm);");
      // 12px (caption, o mínimo do Design System): em 13px o rótulo mais longo quebrava e esticava a fileira.
      expect(kpis).toContain("font-size: var(--text-caption);");
      expect(kpis).toContain("font-variant-numeric: tabular-nums;");
      expect(kpis).not.toMatch(/font-size:\s*(8|9|10)(\.\d)?px/);
      expect(kpis).not.toMatch(/font-weight:\s*(7|8|9)\d\d/);
      expect(kpis).not.toMatch(/\bzoom\s*:/);
      // O único scale permitido é o do botão pressionado (`.btn:active`), não o dos KPIs.
      const semOBotao = kpis.replace(
        /\.btn:active:not\(:disabled\)\s*\{[^}]*\}/,
        "",
      );
      expect(semOBotao).not.toMatch(/transform:\s*scale\(/);
    });

    it("tokens.css entra antes de qualquer outro CSS", () => {
      const primeiroCss = main.match(/import "(\.\/styles\/[^"]+\.css)"/)[1];
      expect(primeiroCss).toBe("./styles/tokens.css");
    });
  });

  describe("overview inicial dos mapas", () => {
    it("usa o tamanho real do card e respeita o limite nacional de 500 km", () => {
      expect(mapGuard).toContain("map.__agsusOverviewMode = true");
      expect(mapGuard).toContain("HEALTH_MAP_OVERVIEW_MAX_ZOOM = 4.5");
      expect(mapGuard).toContain("maxZoom: HEALTH_MAP_OVERVIEW_MAX_ZOOM");
      // A folga cobre a maior bolha (src/lib/mapas/enquadramento-do-brasil.ts).
      expect(mapGuard).toContain("padding: folgaDoBrasil");
      expect(mapGuard).toContain("isBrazilOverviewBounds");
    });

    it("invalida o tamanho antes de reenquadrar o Brasil", () => {
      const fit = mapGuard.slice(
        mapGuard.indexOf("const fitBrazilOverview"),
        mapGuard.indexOf('map.on("resize"'),
      );
      expect(fit).toContain("invalidateSize");
      expect(fit).toContain("originalFitBounds(viewBounds");
    });

    it("recalcula o enquadramento quando o card muda de tamanho", () => {
      expect(mapGuard).toContain('map.on("resize"');
      expect(mapGuard).toContain("requestAnimationFrame(fitBrazilOverview)");
    });
  });

  describe("branding independente da sidebar", () => {
    it("usa chaves próprias", () => {
      expect(marcaDaBarra).toContain('"ui_sidebar_logo_url"');
      expect(marcaDaBarra).toContain('"ui_sidebar_background_color"');
      expect(sidebar).toContain("CHAVE_DO_LOGO_DA_BARRA");
      expect(sidebar).toContain("CHAVE_DA_COR_DA_BARRA");
    });

    it("deriva contraste da cor escolhida", () => {
      expect(sidebar).toContain("needsLightForeground(corAtual)");
      expect(sidebar).toContain("sidebar-theme-dark");
    });

    it("oferece upload de logo como o gestor de fundo do login", () => {
      expect(aparencia).toContain('type="file"');
      expect(aparencia).toContain("Escolher imagem");
      expect(imagens).toContain("validateAccessBackgroundFile");
      expect(imagens).toContain(".storage?.from(ACCESS_BACKGROUND_BUCKET)");
      expect(imagens).toContain("PASTA_DOS_LOGOS_DA_BARRA");
      expect(imagens).toContain("carregarLogos");
    });

    it("mantém upload da logo dentro da pasta branding já autorizada", () => {
      expect(marcaDaBarra).toContain(
        "export const PASTA_DOS_LOGOS_DA_BARRA = `${ACCESS_BACKGROUND_FOLDER}/sidebar`",
      );
      expect(imagens).toContain("ACCESS_BACKGROUND_BUCKET");
    });

    it("permite restaurar padrão e apagar logos não selecionadas", () => {
      expect(imagens).toContain("restaurarLogo");
      expect(imagens).toContain("apagarLogo");
      expect(aparencia).toContain("Restaurar padrão");
    });

    it("não embrulha window.saveAdminSettings", () => {
      expect(sidebar).not.toMatch(/window\.saveAdminSettings\s*=/);
    });

    it("não deduz sucesso pelo texto do toast", () => {
      const codigo = sidebar
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      expect(codigo).not.toContain("toastBox");
      expect(codigo).not.toMatch(/configura[cç][oõ]es salvas/i);
    });

    it("não faz uma segunda chamada à RPC de configuração", () => {
      const codigo = sidebar
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      expect(codigo).not.toContain("salvar_configuracoes_e_paineis");
    });

    it("as chaves entram no mesmo p_config_rows da publicação", () => {
      expect(publicacao).toContain('"ui_sidebar_logo_url"');
      expect(publicacao).toContain('"ui_sidebar_background_color"');
      expect(governance).toContain(
        "linhasDasSecoes(valoresAtuais(), [...estado.rascunho.keys()]);",
      );
    });

    it("não relê a configuração: logo e cor vêm da leitura da entrada", () => {
      // O Supabase emite SIGNED_IN a cada volta da aba; a leitura própria era ~2.700/dia.
      expect(sidebar).not.toContain('.from("TB_CONFIGURACAO")');
      expect(sidebar).not.toContain("onAuthStateChange");
      expect(sidebar).toContain("export function aplicarMarcaDaConfiguracao");
      const configuracao = readFileSync("src/app/configuracao.ts", "utf8");
      expect(configuracao).toContain("pintarBarra(valores)");
    });

    it("a marca padrão vale antes da moldura de Configurações", () => {
      // A marca padrão vale antes da raiz (que desenha a barra); a moldura de
      // Configurações é rota e baixa sob demanda (src/app/telas.tsx).
      expect(main.indexOf("aplicarMarcaDaBarraLateral();")).toBeGreaterThan(-1);
      expect(main.indexOf("aplicarMarcaDaBarraLateral();")).toBeLessThan(
        main.indexOf("montarRaiz({"),
      );
      expect(telas).toMatch(
        /config: \{\s*carregar: \(\) =>\s*import\("..\/modulos\/configuracoes\/configuracoes\.tsx"\)/,
      );
    });
  });

  describe("o reenquadramento não descarta o zoom da pessoa", () => {
    /*
    A verificação continua existindo, mas mudou de lugar: saiu de dentro do
    handler de `resize` e virou `emOverview()`, porque o `ResizeObserver` que
    passou a decidir o enquadramento inicial precisa fazer a mesma pergunta.
    Uma função, dois chamadores.
  */
    it("confere o zoom corrente, não só a bandeira", () => {
      const derivado = mapGuard.slice(
        mapGuard.indexOf("function emOverview"),
        mapGuard.indexOf("function observarTamanhoDoCard"),
      );
      expect(derivado).toContain("map.__agsusOverviewMode");
      expect(derivado).toContain("getZoom");
      expect(derivado).toContain("HEALTH_MAP_OVERVIEW_MAX_ZOOM");
    });

    it("o handler de resize consulta esse estado derivado", () => {
      const handler = mapGuard.slice(
        mapGuard.indexOf('map.on("resize"'),
        mapGuard.indexOf('map.on("drag move zoomend'),
      );
      expect(handler).toContain(
        "if (enquadramentoProprio || !emOverview(map)) return;",
      );
    });
  });
});

bloco("proporcoes-das-telas", () => {
  /*
  Proporções das telas (varredura a 1366px e a 390px). O jsdom não mede
  layout, então o teste garante, no CSS de origem, as propriedades que fazem
  cada correção funcionar: KPIs da mesma altura com rótulo em até duas linhas,
  nomes de Acessos com reticências, cartões da galeria sem estouro e o botão
  Restaurar da Operação na linha de baixo no celular.
*/

  const ler = (caminho) => readFileSync(caminho, "utf8").replace(/\r\n/g, "\n");
  const semComentarios = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");

  /** Declarações de todos os blocos cujo seletor (na lista) é exatamente `seletor`. */
  function regra(css, seletor) {
    const alvo = seletor.replace(/\s+/g, " ").trim();
    const declaracoes = {};
    for (const [, seletores, corpo] of semComentarios(css).matchAll(
      /([^{}]+)\{([^{}]*)\}/g,
    )) {
      const lista = seletores
        .split(",")
        .map((s) => s.replace(/\s+/g, " ").trim());
      if (!lista.includes(alvo)) continue;
      for (const linha of corpo.split(";")) {
        const i = linha.indexOf(":");
        if (i > 0)
          declaracoes[linha.slice(0, i).trim()] = linha.slice(i + 1).trim();
      }
    }
    return declaracoes;
  }

  const esperaDuasLinhas = (declaracoes) => {
    expect(declaracoes.display).toBe("-webkit-box");
    expect(declaracoes["-webkit-box-orient"]).toBe("vertical");
    expect(declaracoes["-webkit-line-clamp"]).toBe("2");
    expect(declaracoes["line-clamp"]).toBe("2");
    expect(declaracoes.overflow).toBe("hidden");
    expect(declaracoes["min-width"]).toBe("0");
  };

  describe("KPIs: mesma altura, rótulo em até duas linhas", () => {
    it("Kpi de src/ui (Análises, Recursos, Seleção, Entrevistas, prévia da Página inicial)", () => {
      const css = ler("src/ui/ui.css");
      expect(regra(css, ".ui-kpis")["grid-auto-rows"]).toBe("1fr");
      expect(regra(css, ".ui-kpi")["min-height"]).toBe("78px");
      esperaDuasLinhas(regra(css, ".ui-kpi-texto"));
      expect(regra(css, ".ui-kpi-valor")["margin-top"]).toBe("auto");

      const jsx = ler("src/ui/kpi.tsx");
      expect(jsx).toContain('className="ui-kpi-texto"');
      expect(jsx).toContain(
        'title={typeof rotulo === "string" ? rotulo : undefined}',
      );
    });

    it("nenhum módulo troca a grade de KPIs por linhas de altura livre", () => {
      for (const caminho of [
        "src/modulos/entrevistas/entrevistas.css",
        "src/modulos/recursos/recursos.css",
        "src/modulos/selecao/selecao.css",
        "src/modulos/editais/editais.css",
        "src/modulos/cronograma/cronograma.css",
        "src/modulos/aprovados/aprovados.css",
        "src/modulos/aprovados/convocacao.css",
      ])
        expect(semComentarios(ler(caminho))).not.toMatch(/grid-auto-rows/);
    });

    it("Editais e Lista de aprovados usam o Kpi de src/ui (sem KPI próprio)", () => {
      for (const caminho of [
        "src/modulos/editais/painel-operacional.tsx",
        "src/modulos/aprovados/aba-aprovados.tsx",
        "src/modulos/aprovados/aba-convocacao.tsx",
      ]) {
        const jsx = ler(caminho);
        expect(jsx, caminho).toContain("<GradeDeKpis");
        expect(jsx, caminho).toContain("<Kpi");
      }
    });
  });

  describe("Acessos: nomes longos com reticências", () => {
    const css = ler("src/modulos/acessos/acessos.css");

    it("o nome da pessoa (botão e, nas contas desativadas, o strong) para em reticências", () => {
      for (const seletor of [
        ".acessos-nome",
        ".acessos-pessoa-textos > strong",
      ]) {
        const d = regra(css, seletor);
        expect(d.display).toBe("block");
        expect(d["max-width"]).toBe("100%");
        expect(d.overflow).toBe("hidden");
        expect(d["text-overflow"]).toBe("ellipsis");
        expect(d["white-space"]).toBe("nowrap");
      }
      expect(regra(css, ".acessos-pessoa")["min-width"]).toBe("0");
      expect(regra(css, ".acessos-pessoa-textos")["min-width"]).toBe("0");
    });

    it("o nome inteiro fica no title", () => {
      const usuarios = ler("src/modulos/acessos/aba-usuarios.tsx");
      expect(usuarios).toContain(
        "titulo={`Abrir o acesso de ${usuario.nome || usuario.email}`}",
      );
      expect(usuarios).toContain(
        "title={nomeDaCoordenacao || coordenacao || undefined}",
      );
      expect(ler("src/modulos/acessos/contas-desativadas.tsx")).toContain(
        "<strong title={conta.nome || conta.email}>",
      );
    });
  });

  describe("Aparência: cartões da galeria", () => {
    const css = ler("src/modulos/configuracoes/configuracoes.css");

    it("o cartão prende a coluna à própria largura e não estica a miniatura", () => {
      const cartao = regra(css, ".config-galeria__cartao");
      expect(cartao["grid-template-columns"]).toBe("minmax(0, 1fr)");
      expect(cartao["align-content"]).toBe("start");
      expect(regra(css, ".config-galeria__miniatura").width).toBe("100%");
      expect(
        regra(
          css,
          '.config-galeria__grade[data-formato="paisagem"] .config-galeria__miniatura',
        )["aspect-ratio"],
      ).toBe("16 / 9");
    });

    it("cartões iguais na grade", () => {
      expect(regra(css, ".config-galeria__grade")["grid-auto-rows"]).toBe(
        "1fr",
      );
    });
  });

  describe("Operação: botão Restaurar do histórico", () => {
    it("leva a classe que o põe na linha de baixo, na largura toda, no celular", () => {
      expect(ler("src/modulos/configuracoes/configuracoes.tsx")).toContain(
        'className="btn secondary config-history-restore"',
      );
      const css = ler("src/modulos/configuracoes/configuracoes.css");
      const d = regra(css, ".config-history-restore");
      expect(d["grid-column"]).toBe("1/-1");
      expect(d["justify-self"]).toBe("stretch");
    });
  });
});

bloco("sem-html-cru", () => {
  /*
  A regra `no-restricted-syntax` do eslint.config.js barra HTML montado a
  partir de texto no front (porta de XSS). Estes casos garantem que ela pega
  cada forma e não acusa o jeito certo (JSX, textContent, createElement).
*/
  const eslint = new ESLint({ cwd: process.cwd() });

  async function erros(codigo, arquivo) {
    const [resultado] = await eslint.lintText(codigo, { filePath: arquivo });
    return resultado.messages
      .filter((m) => m.ruleId === "no-restricted-syntax")
      .map((m) => m.message);
  }

  /*
  O primeiro lint carrega a config e os plugins (3,9 s sozinho; mais de 15 s
  com a suíte em carga). Aquecer aqui tira essa partida do primeiro caso, que
  passa a medir só a regra.
*/
  beforeAll(
    () => eslint.lintText("", { filePath: "src/modules/aquecimento.js" }),
    60_000,
  );

  describe("sem HTML cru no front", () => {
    it.each([
      ["innerHTML", "el.innerHTML = nome;"],
      ["outerHTML", "el.outerHTML = nome;"],
      ["srcdoc", "quadro.srcdoc = nome;"],
      ["innerHTML +=", "el.innerHTML += nome;"],
      ["insertAdjacentHTML", 'el.insertAdjacentHTML("beforeend", nome);'],
      ["createContextualFragment", "faixa.createContextualFragment(nome);"],
      ["document.write", "document.write(nome);"],
    ])("barra %s", async (_, codigo) => {
      const mensagens = await erros(
        `export function f(el, quadro, faixa, nome) { ${codigo} }`,
        "src/modules/exemplo-sem-html-cru.js",
      );
      expect(mensagens).toHaveLength(1);
    });

    it("barra dangerouslySetInnerHTML no JSX e em objeto de props", async () => {
      const mensagens = await erros(
        [
          "export const A = ({ t }) => <p dangerouslySetInnerHTML={{ __html: t }} />;",
          "export const props = (t) => ({ dangerouslySetInnerHTML: { __html: t } });",
        ].join("\n"),
        "src/componentes/exemplo-sem-html-cru.jsx",
      );
      expect(mensagens).toHaveLength(2);
    });

    it("aceita texto como filho, textContent e createElement", async () => {
      const mensagens = await erros(
        [
          "export const A = ({ t }) => <p>{t}</p>;",
          "export function f(el, t) {",
          '  const s = document.createElement("span");',
          "  s.textContent = t;",
          "  el.append(s);",
          "  navigator.clipboard.write([]);",
          "}",
        ].join("\n"),
        "src/componentes/exemplo-sem-html-cru.jsx",
      );
      expect(mensagens).toEqual([]);
    });
  });
});

bloco("servidor", () => {
  /*
  Contrato do servidor web, herdado do antigo MonitoraRoutesTest.php do Laravel:
  páginas idênticas ao build, callback sem cache, nada fora da lista é entregue,
  sem escrita e com rota de saúde. Soma o que o Laravel não fazia: `/data/*.json`
  (o mapa depende dele) e cabeçalhos iguais aos da Vercel.

  Usa `node:http` e não `fetch`: o `fetch` global está bloqueado nos testes
  (tests/setup/rede-bloqueada.ts), e aqui a conversa é só com 127.0.0.1.
*/

  const PAGINAS = {
    "index.html":
      '<!doctype html><title>Yeendé</title><script src="/assets/main-AbCd1234.js"></script>',
    "auth/callback.html": "<!doctype html><title>Callback</title>",
  };

  let dist;
  let servidor;
  let base;

  function pedir(caminho, { method = "GET", headers = {} } = {}) {
    return new Promise((ok, falha) => {
      const req = request(`${base}${caminho}`, { method, headers }, (res) => {
        const partes = [];
        res.on("data", (parte) => partes.push(parte));
        res.on("end", () =>
          ok({
            status: res.statusCode,
            headers: res.headers,
            corpo: Buffer.concat(partes),
          }),
        );
      });
      req.on("error", falha);
      req.end();
    });
  }

  beforeAll(async () => {
    dist = mkdtempSync(join(tmpdir(), "monitora-dist-"));
    for (const [arquivo, conteudo] of Object.entries(PAGINAS)) {
      mkdirSync(join(dist, arquivo, ".."), { recursive: true });
      writeFileSync(join(dist, arquivo), conteudo);
    }
    mkdirSync(join(dist, "assets"));
    mkdirSync(join(dist, "data"));
    mkdirSync(join(dist, "icons"));
    writeFileSync(
      join(dist, "assets", "main-AbCd1234.js"),
      "console.log('ok');",
    );
    writeFileSync(join(dist, "assets", "agsus-logo.webp"), "webp");
    writeFileSync(
      join(dist, "data", "terras-indigenas.json"),
      JSON.stringify({ terras: "x".repeat(4000) }),
    );
    writeFileSync(
      join(dist, "sw.js"),
      "self.addEventListener('fetch', () => {});",
    );
    writeFileSync(join(dist, ".env"), "SEGREDO=1");
    writeFileSync(join(dist, "CLAUDE.md"), "interno");
    writeFileSync(join(dist, "assets", ".escondido"), "x");

    const cabecalhos = lerCabecalhosDaVercel(
      resolve(process.cwd(), "vercel.json"),
    );
    servidor = criarServidor({ dist, cabecalhos });
    await new Promise((pronto) => servidor.listen(0, "127.0.0.1", pronto));
    base = `http://127.0.0.1:${servidor.address().port}`;
  });

  afterAll(async () => {
    await new Promise((fim) => servidor.close(fim));
    rmSync(dist, { recursive: true, force: true });
  });

  describe("servidor web do Yeendé", () => {
    it.each([
      ["/", "index.html"],
      ["/index.html", "index.html"],
      ["/auth/callback", "auth/callback.html"],
      ["/auth/callback.html", "auth/callback.html"],
    ])("entrega %s idêntica ao build (%s)", async (url, arquivo) => {
      const res = await pedir(url);
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toBe("text/html; charset=UTF-8");
      expect(res.headers["x-content-type-options"]).toBe("nosniff");
      expect(res.headers["referrer-policy"]).toBe(
        "strict-origin-when-cross-origin",
      );
      expect(res.corpo.toString()).toBe(PAGINAS[arquivo]);
    });

    it.each([
      "/saude-indigena/visao-geral",
      "/sede/cronograma",
      "/projetos/classificacao/0b7c9a52-2d55-4c4e-9f7a-1c3d5e7f9a1b",
      "/paineis/bi-rh",
      "/administracao/configuracoes/acessos",
      "/sede/editais/0b7c9a52/regras/classificacao",
      "/sem-acesso",
    ])(
      "rota do app %s entrega o index.html (link direto e F5)",
      async (url) => {
        const res = await pedir(url);
        expect(res.status).toBe(200);
        expect(res.headers["content-type"]).toBe("text/html; charset=UTF-8");
        expect(res.corpo.toString()).toBe(PAGINAS["index.html"]);
      },
    );

    it("não deixa o callback ir para cache", async () => {
      const res = await pedir("/auth/callback");
      expect(res.headers["cache-control"]).toContain("no-store");
      expect(res.headers.pragma).toBe("no-cache");
      expect(res.headers["set-cookie"]).toBeUndefined();
    });

    it("usa os mesmos cabeçalhos de segurança da Vercel", async () => {
      const res = await pedir("/");
      const { globais } = lerCabecalhosDaVercel(
        resolve(process.cwd(), "vercel.json"),
      );
      for (const [nome, valor] of globais) {
        if (nome.toLowerCase() === "strict-transport-security") continue;
        expect(res.headers[nome.toLowerCase()]).toBe(valor);
      }
    });

    it("só manda HSTS quando a conexão chegou por HTTPS", async () => {
      expect(
        (await pedir("/")).headers["strict-transport-security"],
      ).toBeUndefined();
      const viaProxy = await pedir("/", {
        headers: { "X-Forwarded-Proto": "https" },
      });
      expect(viaProxy.headers["strict-transport-security"]).toMatch(
        /max-age=31536000/,
      );
    });

    it.each([
      "/.env",
      "/CLAUDE.md",
      "/assets/.escondido",
      "/package.json",
      "/server/servidor.ts",
      "/unknown",
      "/recursos",
      "/recursos.html",
      "/analises",
      "/analises.html",
      "/entrevistas",
      "/entrevistas.html",
      "/selecao",
      "/selecao.html",
      "/assets/",
      "/icons/",
      "/assets/../.env",
      "/assets/%2e%2e/.env",
      "/data/%2e%2e%2f.env",
      "/assets/..%5c.env",
      "/sede",
      "/sede/.env",
      "/sede/editais/x/regras/triagem/mais",
      "/outra-area/editais",
    ])("não entrega %s", async (caminho) => {
      expect((await pedir(caminho)).status).toBe(404);
    });

    it("recusa escrita nas páginas", async () => {
      const res = await pedir("/index.html", { method: "POST" });
      expect(res.status).toBe(405);
      expect(res.headers.allow).toBe("GET, HEAD");
    });

    it("responde 400 a um alvo que não vira URL, sem derrubar o processo", async () => {
      // `new URL("//[", base)` lança: antes, a exceção escapava do handler e
      // encerrava o servidor inteiro com uma única requisição.
      const resposta = await new Promise((ok, falha) => {
        const { port } = servidor.address();
        const socket = connect(port, "127.0.0.1", () =>
          socket.write(
            "GET //[ HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n",
          ),
        );
        let texto = "";
        socket.on("data", (parte) => (texto += parte));
        socket.on("end", () => ok(texto));
        socket.on("error", falha);
      });
      expect(resposta).toMatch(/^HTTP\/1\.1 400/);
      expect((await pedir("/up")).status).toBe(200);
    });

    it("responde à rota de saúde", async () => {
      const res = await pedir("/up");
      expect(res.status).toBe(200);
      expect(res.corpo.toString()).toBe("ok");
    });

    it("entrega /data, que o mapa carrega, comprimido quando o navegador aceita", async () => {
      const res = await pedir("/data/terras-indigenas.json", {
        headers: { "Accept-Encoding": "gzip" },
      });
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toBe(
        "application/json; charset=utf-8",
      );
      expect(res.headers["content-encoding"]).toBe("gzip");
      expect(JSON.parse(gunzipSync(res.corpo).toString()).terras).toHaveLength(
        4000,
      );
    });

    it("guarda para sempre só o que tem hash no nome", async () => {
      expect(
        (await pedir("/assets/main-AbCd1234.js")).headers["cache-control"],
      ).toContain("immutable");
      expect(
        (await pedir("/assets/agsus-logo.webp")).headers["cache-control"],
      ).toBe("no-cache");
      expect((await pedir("/sw.js")).headers["cache-control"]).toBe("no-cache");
    });

    it("responde 304 quando o navegador já tem a versão atual", async () => {
      const primeira = await pedir("/sw.js");
      const segunda = await pedir("/sw.js", {
        headers: { "If-None-Match": primeira.headers.etag },
      });
      expect(segunda.status).toBe(304);
    });

    it("devolve 503, e não 404, quando o build ainda não existe", async () => {
      const vazio = mkdtempSync(join(tmpdir(), "monitora-vazio-"));
      const semBuild = criarServidor({
        dist: vazio,
        cabecalhos: { globais: [], porRota: new Map() },
      });
      await new Promise((pronto) => semBuild.listen(0, "127.0.0.1", pronto));
      const anterior = base;
      base = `http://127.0.0.1:${semBuild.address().port}`;
      try {
        expect((await pedir("/")).status).toBe(503);
      } finally {
        base = anterior;
        await new Promise((fim) => semBuild.close(fim));
        rmSync(vazio, { recursive: true, force: true });
      }
    });
  });

  describe("caminhoDoEstatico", () => {
    it("aceita só pastas e arquivos da lista, sem sair do dist", () => {
      const d = resolve("dist-falso");
      expect(caminhoDoEstatico(d, "/assets/a.js")).toBe(
        resolve(d, "assets", "a.js"),
      );
      expect(caminhoDoEstatico(d, "/manifest.webmanifest")).toBe(
        resolve(d, "manifest.webmanifest"),
      );
      for (const ruim of [
        "/",
        "/index.html",
        "/auth/callback.html",
        "/assets",
        "/x/a.js",
        "/%zz",
        "/assets/a%00.js",
      ]) {
        expect(caminhoDoEstatico(d, ruim)).toBeNull();
      }
    });
  });
});

bloco("shell-invariants", () => {
  const html = readFileSync("index.html", "utf8");
  const app = fonteDoApp();

  describe("platform shell invariants", () => {
    it("remove o modo executivo da interface e do runtime", () => {
      expect(html).not.toContain("executiveModeBtn");
      expect(app).not.toContain("toggleExecutiveMode");
      expect(app).not.toContain("feature_modo_executivo");
    });

    it("mantém painéis no shell sem redirecionamento de página", () => {
      const paineis = readFileSync("src/app/paineis-externos.ts", "utf8");
      const openPanel = paineis.slice(
        paineis.indexOf("function mostrar(codigo"),
        paineis.indexOf("function descartar(codigo"),
      );
      expect(openPanel).not.toContain("window.location.assign");
      expect(openPanel).not.toContain('classList.add("external-clean")');
      expect(openPanel).toContain('classList.remove("external-clean")');
    });

    /*
    Este teste travava o contrário do que se quer hoje.

    `auth_access_logo_url` é a marca da tela de **login**. Enquanto
    `applyConfigToUi()` a empurrava também para `#sideLogo`, escolher uma logo
    para a barra lateral não sobrevivia ao carregamento das configurações — a do
    login voltava por cima. A barra lateral passou a ter chave própria
    (`ui_sidebar_logo_url`) e um dono só, `src/componentes/barra-lateral/marca.ts`.

    O que continua garantido: a marca do login segue normalizada onde ela
    pertence, e a barra lateral não volta a ser sequestrada por ela.
  */
    it("normaliza a marca oficial na tela de acesso", () => {
      const marca = readFileSync("src/app/entrada/marca.ts", "utf8");
      expect(marca).toContain("normalizeAccessLogoUrl(logoDoBanco)");
    });

    it("não deixa a marca do login mandar na sidebar", () => {
      const applyConfig = readFileSync("src/app/configuracao.ts", "utf8");
      expect(applyConfig).not.toContain('"sideLogo"');
    });
  });
});

bloco("vercel-so-constroi-main", () => {
  const vercel = JSON.parse(readFileSync("vercel.json", "utf8"));

  /*
  O comando roda no `sh` da Vercel. No Windows fora do Git Bash (PowerShell)
  não há `sh` no PATH: sem ele, a falha de abrir o processo virava "saída 1"
  e os testes de "pula" caíam sem defeito nenhum. Aí eles são pulados; no CI
  (Linux) sempre rodam.
*/
  const temSh = (() => {
    try {
      execFileSync("sh", ["-c", "exit 0"], { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  })();

  /*
  A conta chegou ao limite de build da Vercel construindo preview de cada
  branch. Como o CI do GitHub já roda build, smoke e a suíte inteira, o preview
  era o item mais caro e o menos necessário.

  A semântica do ignoreCommand é invertida e não perdoa: código de saída 0 PULA
  o build, diferente de zero CONSTRÓI. Inverter a condição sem perceber
  desligaria a produção em vez dos previews, e o sintoma seria o site parar de
  atualizar — coisa que ninguém liga ao vercel.json de imediato.
*/
  describe("a Vercel só constrói a main", () => {
    it("o comando está declarado e cabe no limite do schema", () => {
      expect(typeof vercel.ignoreCommand).toBe("string");
      expect(vercel.ignoreCommand.length).toBeLessThanOrEqual(256);
    });

    function saidaPara(ref) {
      try {
        execFileSync("sh", ["-c", vercel.ignoreCommand], {
          env: { ...process.env, VERCEL_GIT_COMMIT_REF: ref },
          stdio: "ignore",
        });
        return 0;
      } catch (erro) {
        return erro.status ?? 1;
      }
    }

    it.skipIf(!temSh)("constrói a main", () => {
      expect(saidaPara("main")).not.toBe(0);
    });

    it.skipIf(!temSh)("pula qualquer outra branch", () => {
      for (const ref of [
        "fix/alguma-coisa",
        "Permissões",
        "develop",
        "main-antiga",
        "feature/main",
      ]) {
        expect(saidaPara(ref)).toBe(0);
      }
    });

    it.skipIf(!temSh)("não confunde branch cujo nome contém main", () => {
      expect(saidaPara("mainline")).toBe(0);
      expect(saidaPara("hotfix/main")).toBe(0);
    });
  });
});

bloco("verificadores-de-contrato", () => {
  const estatico = readFileSync("scripts/check-rpc-contract.mjs", "utf8");
  const contraBanco = readFileSync("scripts/check-rpc-contract-db.mjs", "utf8");
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));

  /*
  Os comentários destes ficheiros descrevem o erro corrigido e citam `/rest/v1/`,
  `Bearer` e `VITE_` para explicá-lo. Verificar o texto cru acusaria a própria
  explicação; o que interessa é o código.
*/
  const semComentarios = (fonte) =>
    fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  const estaticoCodigo = semComentarios(estatico);
  const contraBancoCodigo = semComentarios(contraBanco);

  /*
  Protege a correção de 08/09/2026.

  A primeira versão da verificação lia a especificação OpenAPI do PostgREST com a
  chave publicável e concluía dali quais RPCs existem. O OpenAPI, porém, reflete
  os privilégios da role que pergunta: com `anon`, 21 das 22 funções existentes
  ficam invisíveis porque são de `authenticated`. Ligada ao build, essa
  verificação derrubaria tudo acusando ausência de funções que existem.
*/
  describe("verificação estática do contrato", () => {
    it("não faz rede nem lê credencial", () => {
      expect(estaticoCodigo).not.toMatch(/fetch\s*\(/);
      expect(estaticoCodigo).not.toMatch(/process\.env\.[A-Z_]*SUPABASE/);
      expect(estaticoCodigo).not.toMatch(/apikey/i);
    });

    it("é a única verificação de contrato presa ao build", () => {
      expect(pkg.scripts.build).toContain("check:rpc-contract");
      expect(pkg.scripts.build).not.toContain("check:rpc-contract:db");
    });
  });

  describe("verificação contra o banco", () => {
    it("existe como comando próprio, fora do build", () => {
      expect(pkg.scripts["check:rpc-contract:db"]).toBeTruthy();
    });

    it("não lê nenhuma variável VITE_, que iria para o bundle", () => {
      const leituras = [
        ...contraBancoCodigo.matchAll(/process\.env\.([A-Z0-9_]+)/g),
      ].map((m) => m[1]);
      expect(leituras.length).toBeGreaterThan(0);
      for (const nome of leituras) {
        expect(
          nome,
          `${nome} não pode ser origem de credencial de servidor`,
        ).not.toMatch(/^VITE_/);
      }
    });

    /*
    A chave publicável não é token de usuário autenticado. Usá-la como cabeçalho
    de autorização para tentar enxergar RPCs de `authenticated` seria tratar chave
    pública como credencial privilegiada — o erro original, com outra roupa.
  */
    it("não consulta o PostgREST nem usa chave pública como credencial", () => {
      expect(contraBancoCodigo).not.toMatch(/rest\/v1/);
      expect(contraBancoCodigo).not.toMatch(/Bearer/);
      expect(contraBancoCodigo).not.toMatch(/apikey/i);
    });

    it("consulta o catálogo do PostgreSQL em sessão somente-leitura", () => {
      expect(contraBancoCodigo).toContain("pg_proc");
      expect(contraBancoCodigo).toContain(
        "set session characteristics as transaction read only",
      );
    });

    it("depende de pg apenas como dependência de desenvolvimento", () => {
      expect(pkg.devDependencies?.pg).toBeTruthy();
      expect(pkg.dependencies?.pg).toBeUndefined();
    });
  });

  /*
  Os três scripts que falam com o banco partilham a mesma regra: credencial de
  servidor, nunca uma variável `VITE_*` — tudo com esse prefixo entra no bundle
  Vite e viaja para o navegador de quem abre a página.
*/
  describe("scripts que falam com o banco", () => {
    const scripts = [
      "scripts/check-rpc-contract-db.mjs",
      "scripts/validar-migration-recusar.mjs",
      "scripts/capturar-baseline-rpcs.mjs",
      "scripts/medir-cronograma.mjs",
    ];

    it("nenhum lê variável VITE_", () => {
      for (const caminho of scripts) {
        const codigo = semComentarios(readFileSync(caminho, "utf8"));
        const leituras = [
          ...codigo.matchAll(/process\.env\.([A-Z0-9_]+)/g),
        ].map((m) => m[1]);
        expect(leituras.length, `${caminho} não lê ambiente`).toBeGreaterThan(
          0,
        );
        for (const nome of leituras) {
          expect(nome, `${caminho} lê ${nome}`).not.toMatch(/^VITE_/);
        }
      }
    });

    it("nenhum é importado pelo frontend", () => {
      const fontes = readdirSync("src", { recursive: true })
        .filter((n) => String(n).endsWith(".js"))
        .map((n) => readFileSync(join("src", String(n)), "utf8"))
        .join(String.fromCharCode(10));
      for (const caminho of scripts) {
        expect(fontes, `${caminho} alcançado pelo frontend`).not.toContain(
          caminho.split("/").pop(),
        );
      }
    });

    /*
    Chamar a RPC de recusa é escrever. A validação só pode fazê-lo dentro de
    transação revertida — se um `begin` deixar de ter `rollback`, o teste cai.
  */
    it("a validação da recusa reverte toda transação que abre", () => {
      const codigo = semComentarios(
        readFileSync("scripts/validar-migration-recusar.mjs", "utf8"),
      );
      const aberturas = (codigo.match(/query\("begin"\)/g) || []).length;
      const revertidas = (codigo.match(/query\("rollback"\)/g) || []).length;
      expect(aberturas).toBeGreaterThan(0);
      expect(revertidas).toBe(aberturas);
      expect(codigo).not.toMatch(/query\("commit"\)/);
    });

    /*
    O texto do ficheiro gerado menciona `drop function` ao descrever o rollback,
    e procurar a palavra solta acusaria essa menção. O que importa é o que o
    script manda executar: cada `cliente.query(` precisa começar por leitura.
  */
    it("a captura de linha de base só executa leitura", () => {
      const codigo = semComentarios(
        readFileSync("scripts/capturar-baseline-rpcs.mjs", "utf8"),
      );
      expect(codigo).toContain(
        "set session characteristics as transaction read only",
      );

      const comandos = codigo
        .split("cliente.query(")
        .slice(1)
        .map((trecho) =>
          trecho
            .replace(/^[\s`"']+/, "")
            .slice(0, 60)
            .toLowerCase(),
        );

      expect(comandos.length).toBeGreaterThan(0);
      for (const comando of comandos) {
        expect(
          comando.startsWith("select") ||
            comando.startsWith("set session characteristics"),
          `comando que não é leitura: ${comando}`,
        ).toBe(true);
      }
    });
  });

  /*
  Numa template literal, `\b` é o caractere de retrocesso, não a âncora de
  palavra. `new RegExp(`\b${nome}\b`)` compila um padrão que procura bytes de
  controle e nunca casa — silenciosamente.

  Não é hipótese: foi assim que `check-rpc-contract-db.mjs` reprovou a assinatura
  de `recusar_solicitacao_acesso` na primeira execução contra um Postgres real,
  com a assinatura visivelmente correta na própria mensagem de erro. O ESLint não
  vê: `no-control-regex` só olha literais de expressão regular.
*/
  describe("expressões regulares montadas em template literal", () => {
    const ficheiros = readdirSync("scripts")
      .filter((n) => n.endsWith(".mjs"))
      .map((n) => ({
        nome: n,
        fonte: readFileSync(join("scripts", n), "utf8"),
      }));

    it("usam String.raw quando incluem barra invertida", () => {
      for (const { nome, fonte } of ficheiros) {
        const montagens = [
          ...semComentarios(fonte).matchAll(
            /new RegExp\(\s*(String\.raw)?`([^`]*)`/g,
          ),
        ];
        for (const [, cru, padrao] of montagens) {
          if (!padrao.includes("\\")) continue;
          expect(
            cru,
            `${nome}: RegExp com barra invertida sem String.raw — "${padrao}"`,
          ).toBe("String.raw");
        }
      }
    });
  });

  describe("reutilização de servidor no Playwright", () => {
    const config = readFileSync("playwright.config.js", "utf8");

    /*
    Reutilizar servidor já em execução produziu um verde falso: um preview antigo
    servia build anterior, e a suíte passou contra HTML que não existia mais.
  */
    it("não reutiliza servidor por padrão", () => {
      expect(config).not.toContain("reuseExistingServer: !process.env.CI");
      expect(config).toMatch(
        /reuseExistingServer:\s*process\.env\.PLAYWRIGHT_REUSE_SERVER === "1"/,
      );
    });

    /* Pelo mesmo motivo: servir um dist/ antigo só quando se pede (o CI, logo após o build). */
    it("refaz o build por padrão", () => {
      expect(config).toMatch(
        /process\.env\.PLAYWRIGHT_DIST_PRONTO === "1"\s*\?\s*""\s*:\s*"npm run build && "/,
      );
    });
  });

  /*
  A suíte não pode voltar a depender da ausência de ambiente para não falar com
  produção. Foi assim que um teste começou a chamar o Supabase real: bastou
  existir um `.env.local`, porque o Vitest carrega as variáveis pelo Vite.
*/
  describe("segurança dos testes", () => {
    const configVitest = readFileSync("vitest.config.js", "utf8");
    const guarda = readFileSync("tests/setup/rede-bloqueada.ts", "utf8");

    it("a rede é bloqueada por omissão em toda a suíte", () => {
      expect(configVitest).toContain("setupFiles");
      expect(configVitest).toContain("tests/setup/rede-bloqueada.ts");
    });

    it("o bloqueio nomeia a URL em vez de falhar em silêncio", () => {
      expect(guarda).toContain("Teste tentou falar com a rede");
      expect(guarda).toContain("beforeEach");
      expect(guarda).toContain("afterEach");
    });

    /*
    O que importa é o que o git carrega, não o que existe no disco. A versão
    anterior listava o diretório, então punia quem seguisse o README — que manda
    criar `.env.local` — mesmo com o ficheiro devidamente ignorado. Perguntar ao
    git verifica a promessa que o nome do teste faz.
  */
    it("nenhum ficheiro de ambiente está versionado", () => {
      const rastreados = execFileSync("git", ["ls-files", "-z"], {
        encoding: "utf8",
      })
        .split("\0")
        .filter((nome) => /^\.env/.test(nome) && nome !== ".env.example");
      expect(rastreados).toEqual([]);
    });

    it("o .gitignore cobre os ficheiros de ambiente locais", () => {
      const ignorados = readFileSync(".gitignore", "utf8");
      expect(ignorados).toMatch(/^\.env$/m);
      expect(ignorados).toMatch(/^\.env\.\*$/m);
      expect(ignorados).toMatch(/^!\.env\.example$/m);
    });
  });
});
