import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ESTILO_SOLIDO,
  ESTILO_VIDRO,
  OPACIDADE_DO_VIDRO,
  avaliarCor,
  misturar,
  normalizarEstilo,
} from "../src/lib/contraste.ts";
import { mapearBrandingPublico } from "../src/lib/access-branding-publico.ts";
import { aplicarEstiloDoPainel } from "../src/app/entrada/marca.ts";

/*
  O PAINEL DE VIDRO DA TELA DE ACESSO (pedido de 12/11/2026)

  Configurações › Tela de acesso › Estilo do painel: sólido (padrão) ou vidro.
  A chave `auth_access_painel_estilo` chega antes do login pela função pública
  (migration 20261112180000), vai para o cache da marca e vira a classe
  `login-panel-vidro` no #loginScreen. O contraste do vidro é medido no pior
  trecho possível da arte: a cor misturada ao branco e ao preto.
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
  const vigente = (() => {
    const inicio = retrato.indexOf(
      "CREATE FUNCTION public.obter_branding_acesso_publico()",
    );
    const abre = retrato.indexOf("AS $$", inicio) + "AS $$".length;
    return retrato.slice(abre, retrato.indexOf("$$;", abre));
  })();
  const novo = corpoDaFuncao(migration);

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

  it("o ensaio aplica o mesmo corpo e termina em rollback; o rollback volta ao de antes", () => {
    expect(corpoDaFuncao(ensaio)).toBe(novo);
    expect(ensaio.trimEnd().endsWith("rollback;")).toBe(true);
    expect(corpoDaFuncao(rollback)).toBe(vigente);
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

  it("o CSS usa a mesma opacidade da conta e recua para sólido", () => {
    const css = ler("src/styles/platform-shell.css");
    const porcento = `${Math.round(OPACIDADE_DO_VIDRO * 100)}%`;
    expect(css).toContain(
      `var(--login-panel-color, var(--color-bg-subtle)) ${porcento},`,
    );
    expect(css).toContain("@media (prefers-reduced-transparency: reduce)");
    expect(css).toContain("@supports not (backdrop-filter: blur(1px))");
  });
});

describe("contraste do vidro", () => {
  it("mistura como o color-mix do CSS", () => {
    expect(misturar("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(misturar("#12403f", "#12403f", OPACIDADE_DO_VIDRO)).toBe("#12403f");
  });

  it("um painel escuro passa no vidro, medido no pior trecho", () => {
    const solido = avaliarCor("#12403f", "auto", "solido");
    const vidro = avaliarCor("#12403f", "auto", "vidro");
    expect(vidro?.passa).toBe(true);
    expect(vidro!.razao).toBeLessThan(solido!.razao);
    expect(vidro?.mensagem).toContain("vidro");
  });

  it("uma cor que passa sólida pode reprovar no vidro, e o aviso diz", () => {
    const solido = avaliarCor("#3a6ea5", "auto", "solido");
    const vidro = avaliarCor("#3a6ea5", "auto", "vidro");
    expect(solido?.passa).toBe(true);
    expect(vidro?.passa).toBe(false);
    expect(vidro?.mensagem).toContain("painel sólido");
  });
});
