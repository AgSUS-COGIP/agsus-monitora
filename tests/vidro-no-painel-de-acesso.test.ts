import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ESTILO_SOLIDO,
  ESTILO_VIDRO,
  avaliarCor,
  normalizarEstilo,
} from "../src/lib/contraste.ts";
import { mapearBrandingPublico } from "../src/lib/access-branding-publico.ts";
import { aplicarEstiloDoPainel } from "../src/app/entrada/marca.ts";

/*
  O PAINEL DE VIDRO DA TELA DE ACESSO (pedido de 12/11/2026)

  Configurações › Tela de acesso › Estilo do painel: sólido (padrão) ou vidro.
  A chave `auth_access_painel_estilo` chega antes do login pela função pública
  (migration 20261112180000), vai para o cache da marca e vira a classe
  `login-panel-vidro` no #loginScreen. Desde 13/11/2026 o vidro não tem cor:
  o texto vai direto sobre a arte, que o sistema não mede.
*/

const RAIZ = path.resolve(import.meta.dirname, "..");
const NOME = "20261112180000_vidro_no_painel_de_acesso";
const ler = (relativo: string) =>
  fs.readFileSync(path.join(RAIZ, relativo), "utf8").replace(/\r\n/g, "\n");

/* O corpo entre `as $$` e `$$;` da função criada no arquivo. */
function corpoDaFuncao(sql: string): string {
  const inicio = sql.indexOf(
    "create or replace function public.obter_branding_acesso_publico()",
  );
  expect(inicio).toBeGreaterThan(-1);
  const abre = sql.indexOf("as $$", inicio) + "as $$".length;
  return sql.slice(abre, sql.indexOf("$$;", abre));
}

const md5 = (texto: string) => createHash("md5").update(texto).digest("hex");

describe("migration 20261112180000: a chave do estilo na leitura pública", () => {
  const migration = ler(`supabase/migrations/${NOME}.sql`);
  const ensaio = ler(`supabase/ensaios/${NOME}.sql`);
  const rollback = ler(`supabase/rollback/${NOME}.sql`);
  const retrato = ler("supabase/esquema-atual.sql");
  /* O retrato (supabase/esquema-atual.sql) já tem a migration aplicada (12/11/2026). */
  const retratado = (() => {
    const inicio = retrato.indexOf(
      "CREATE FUNCTION public.obter_branding_acesso_publico()",
    );
    const abre = retrato.indexOf("AS $$", inicio) + "AS $$".length;
    return retrato.slice(abre, retrato.indexOf("$$;", abre));
  })();
  const novo = corpoDaFuncao(migration);
  const vigente = corpoDaFuncao(rollback);

  it("o retrato mostra a função como a migration a deixou", () => {
    expect(retratado).toBe(novo);
  });

  it("só acrescenta a chave nova à lista fixa", () => {
    expect(novo).toBe(
      vigente.replace(
        "    'auth_access_texto_modo'\n",
        "    'auth_access_texto_modo',\n    'auth_access_painel_estilo'\n",
      ),
    );
  });

  it("as guardas usam o md5 do corpo de antes e do de depois", () => {
    expect(migration).toContain(`is distinct from '${md5(vigente)}'`);
    expect(migration).toContain(`if v_md5 = '${md5(novo)}'`);
    expect(rollback).toContain(`is distinct from '${md5(novo)}'`);
    expect(ensaio).toContain(`is distinct from '${md5(vigente)}'`);
    expect(ensaio).toContain(`is distinct from '${md5(novo)}'`);
  });

  /*
    O corpo vigente no banco foi gravado com CRLF (12/11/2026): o md5 do
    prosrc com `
` nunca bateria com o do retrato. A primeira versão da
    guarda parou o ensaio por isso, sem gravar nada.
  */
  it("as guardas comparam o corpo sem \r (o banco o guarda com CRLF)", () => {
    for (const sql of [migration, ensaio, rollback]) {
      expect(sql).not.toMatch(/md5\(\(select prosrc/);
      expect(sql).toContain(
        "md5(replace((select prosrc from pg_proc where oid = to_regprocedure('public.obter_branding_acesso_publico()')), chr(13), ''))",
      );
    }
  });

  it("o ensaio aplica o mesmo corpo e termina em rollback; o rollback volta ao de antes", () => {
    expect(corpoDaFuncao(ensaio)).toBe(novo);
    expect(ensaio.trimEnd().endsWith("rollback;")).toBe(true);
    for (const sql of [migration, ensaio, rollback]) {
      expect(sql).toContain("security definer");
      expect(sql).toContain("set search_path to ''");
    }
  });
});

describe("o estilo do painel", () => {
  it("normaliza: só 'vidro' é vidro", () => {
    expect(normalizarEstilo("vidro")).toBe(ESTILO_VIDRO);
    expect(normalizarEstilo(" VIDRO ")).toBe(ESTILO_VIDRO);
    for (const valor of ["", "solido", "outro", null, undefined]) {
      expect(normalizarEstilo(valor)).toBe(ESTILO_SOLIDO);
    }
  });

  it("chega antes do login pela leitura pública", () => {
    expect(
      mapearBrandingPublico({
        auth_access_panel_color: "#12403f",
        auth_access_painel_estilo: "vidro",
      }),
    ).toEqual({ panelColor: "#12403f", painelEstilo: "vidro" });
  });

  it("vira a classe login-panel-vidro e sai dela", () => {
    const tela = document.createElement("section");
    aplicarEstiloDoPainel(tela, "vidro");
    expect(tela.classList.contains("login-panel-vidro")).toBe(true);
    aplicarEstiloDoPainel(tela, "solido");
    expect(tela.classList.contains("login-panel-vidro")).toBe(false);
  });

  it("o primeiro quadro aplica a classe guardada, sem esperar o JavaScript", () => {
    const html = ler("index.html");
    expect(html).toContain(
      'window.__agsusPainelVidro = marca.painelEstilo === "vidro";',
    );
    expect(html).toContain('.classList.add("login-panel-vidro");');
  });

  it("o vidro não tem cor e recua para o painel sólido", () => {
    const css = ler("src/styles/platform-shell.css");
    const bloco = css.slice(
      css.indexOf(".login-screen.login-panel-vidro .login-outer {"),
      css.indexOf(".login-screen.login-panel-vidro .login-card {"),
    );
    expect(bloco).not.toContain("--login-panel-color");
    expect(css).toContain("@media (prefers-reduced-transparency: reduce)");
    expect(css).toContain(
      "background: var(--login-panel-color, var(--color-bg-subtle));",
    );
  });
});

describe("contraste do vidro", () => {
  /*
    13/11/2026: "vidro mesmo, sem cor". Nem tinta, nem brilho branco, nem
    realce de saturação: o vidro se vê pela borda clara e pelo realce de luz.
  */
  it("vidro de verdade: sem tinta, brilho, saturação nem desfoque; só a borda", () => {
    const css = ler("src/styles/platform-shell.css");
    const bloco = css.slice(
      css.indexOf(".login-screen.login-panel-vidro .login-outer {"),
      css.indexOf(".login-screen.login-panel-vidro .login-card {"),
    );
    expect(bloco).toContain("background: transparent;");
    expect(bloco).not.toContain("linear-gradient");
    expect(bloco).not.toContain("saturate");
    expect(bloco).toContain("backdrop-filter: none;");
    expect(bloco).not.toContain("blur(");
    expect(bloco).toContain(
      "border-color: color-mix(in srgb, var(--brilho-do-vidro)",
    );
    expect(bloco).toContain(
      "inset 0 1px 0 color-mix(in srgb, var(--brilho-do-vidro)",
    );
  });

  it("no vidro o contraste não é garantido, e o aviso diz que arte combina", () => {
    const escuro = avaliarCor("#002f2f", "auto", "vidro");
    expect(escuro?.passa).toBe(false);
    expect(escuro?.mensagem).toContain("texto claro");
    expect(escuro?.mensagem).toContain("precisa ser escura");
    expect(escuro?.mensagem).toContain("painel sólido");
    const claro = avaliarCor("#f2f2f2", "auto", "vidro");
    expect(claro?.mensagem).toContain("precisa ser clara");
  });

  it("no sólido a cor continua medida como antes", () => {
    const solido = avaliarCor("#002f2f", "auto", "solido");
    expect(solido?.passa).toBe(true);
    expect(solido?.mensagem).toContain("Acima do mínimo");
    expect(avaliarCor("#8fb3d9", "claro", "solido")?.passa).toBe(false);
  });
});
