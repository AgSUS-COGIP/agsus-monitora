import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  DESFOQUE_DO_VIDRO_EM_PX,
  avaliarCor,
  normalizarCorNoVidro,
  normalizarDesfoqueDoVidro,
  porcentagemDaCorNoVidro,
} from "../src/lib/contraste.ts";
import { mapearBrandingPublico } from "../src/lib/access-branding-publico.ts";
import {
  guardarMarca,
  lerMarcaGuardada,
  limparMarcaGuardada,
} from "../src/lib/access-branding-cache.ts";
import {
  aplicarAjusteDoVidro,
  definirMarcaDaConfiguracao,
} from "../src/app/entrada/marca.ts";
import { CAMPOS_DAS_SECOES } from "../src/lib/publicacao-de-configuracoes.ts";

/*
  A COR E O DESFOQUE DO VIDRO, EM CONFIGURAÇÕES (pedido de 13/11/2026)

  O vidro da tela de acesso mudou quatro vezes no mesmo dia, cada uma com
  código. Agora a cor no vidro (0% a 90% da cor do painel) e o desfoque da arte
  (nenhum, leve ou forte) se escolhem em Configurações › Aparência. As chaves
  `auth_access_vidro_cor` e `auth_access_vidro_desfoque` chegam antes do login
  pela leitura pública (migration 20261113150000), vão para o cache da marca e
  viram `--vidro-cor` e `--vidro-desfoque` no #loginScreen.
*/

const RAIZ = path.resolve(import.meta.dirname, "..");
const NOME = "20261113150000_vidro_ajustavel_no_painel_de_acesso";
const ler = (relativo: string) =>
  fs.readFileSync(path.join(RAIZ, relativo), "utf8").replace(/\r\n/g, "\n");
const md5 = (texto: string) => createHash("md5").update(texto).digest("hex");

function corpoDaFuncao(sql: string): string {
  const inicio = sql.indexOf(
    "create or replace function public.obter_branding_acesso_publico()",
  );
  expect(inicio).toBeGreaterThan(-1);
  const abre = sql.indexOf("as $$", inicio) + "as $$".length;
  return sql.slice(abre, sql.indexOf("$$;", abre));
}

describe("migration 20261113150000: a cor e o desfoque na leitura pública", () => {
  const migration = ler(`supabase/migrations/${NOME}.sql`);
  const ensaio = ler(`supabase/ensaios/${NOME}.sql`);
  const rollback = ler(`supabase/rollback/${NOME}.sql`);
  const novo = corpoDaFuncao(migration);
  const vigente = corpoDaFuncao(rollback);

  it("só acrescenta as duas chaves à lista fixa", () => {
    expect(novo).toBe(
      vigente.replace(
        "    'auth_access_painel_estilo'\n",
        "    'auth_access_painel_estilo',\n    'auth_access_vidro_cor',\n    'auth_access_vidro_desfoque'\n",
      ),
    );
  });

  it("o retrato mostra o corpo de antes ou o desta migration", () => {
    const retrato = ler("supabase/esquema-atual.sql");
    const inicio = retrato.indexOf(
      "CREATE FUNCTION public.obter_branding_acesso_publico()",
    );
    const abre = retrato.indexOf("AS $$", inicio) + "AS $$".length;
    const retratado = retrato.slice(abre, retrato.indexOf("$$;", abre));
    expect([vigente, novo]).toContain(retratado);
  });

  it("as guardas usam o md5 do corpo de antes e do de depois, sem CR", () => {
    expect(migration).toContain(`is distinct from '${md5(vigente)}'`);
    expect(migration).toContain(`if v_md5 = '${md5(novo)}'`);
    expect(rollback).toContain(`is distinct from '${md5(novo)}'`);
    expect(ensaio).toContain(`is distinct from '${md5(vigente)}'`);
    expect(ensaio).toContain(`is distinct from '${md5(novo)}'`);
    for (const sql of [migration, ensaio, rollback])
      expect(sql).toContain("chr(13), ''))");
  });

  it("o ensaio aplica o mesmo corpo e termina em rollback", () => {
    expect(corpoDaFuncao(ensaio)).toBe(novo);
    expect(ensaio.trimEnd().endsWith("rollback;")).toBe(true);
    for (const sql of [migration, ensaio, rollback]) {
      expect(sql).toContain("security definer");
      expect(sql).toContain("set search_path to ''");
    }
  });
});

describe("os valores", () => {
  it("cor no vidro: 0 a 90, de 10 em 10; o resto vira 0", () => {
    expect(porcentagemDaCorNoVidro("40")).toBe(40);
    expect(porcentagemDaCorNoVidro(" 90 ")).toBe(90);
    for (const valor of ["45", "100", "-10", "", null, "abc"])
      expect(porcentagemDaCorNoVidro(valor)).toBe(0);
    expect(normalizarCorNoVidro("70")).toBe("70");
    expect(normalizarCorNoVidro("75")).toBe("0");
  });

  it("desfoque: nenhum, leve ou forte; o resto vira nenhum", () => {
    expect(normalizarDesfoqueDoVidro(" Leve ")).toBe("leve");
    expect(normalizarDesfoqueDoVidro("forte")).toBe("forte");
    expect(normalizarDesfoqueDoVidro("muito")).toBe("nenhum");
    expect(DESFOQUE_DO_VIDRO_EM_PX).toEqual({ nenhum: 0, leve: 8, forte: 18 });
  });

  it("os dois campos estão em Aparência, com as opções", () => {
    const campos = CAMPOS_DAS_SECOES.aparencia;
    const cor = campos.find((c) => c.chave === "auth_access_vidro_cor");
    const desfoque = campos.find(
      (c) => c.chave === "auth_access_vidro_desfoque",
    );
    expect(cor?.opcoes?.map(([valor]) => valor)).toEqual([
      "0",
      "10",
      "20",
      "30",
      "40",
      "50",
      "60",
      "70",
      "80",
      "90",
    ]);
    expect(desfoque?.opcoes?.map(([valor]) => valor)).toEqual([
      "nenhum",
      "leve",
      "forte",
    ]);
  });
});

describe("contraste com cor no vidro", () => {
  it("com cor, mede no pior trecho da arte, na proporção escolhida", () => {
    const setenta = avaliarCor("#002f2f", "claro", "vidro", "70");
    expect(setenta?.passa).toBe(true);
    expect(setenta?.mensagem).toContain("70% da cor");
    const quarenta = avaliarCor("#002f2f", "claro", "vidro", "40");
    expect(quarenta?.passa).toBe(false);
    expect(quarenta?.mensagem).toContain("Mais cor no vidro");
    expect(quarenta?.razao ?? 0).toBeLessThan(setenta?.razao ?? 0);
  });

  it("sem cor, o aviso de sempre: a arte decide", () => {
    const puro = avaliarCor("#002f2f", "claro", "vidro", "0");
    expect(puro?.passa).toBe(false);
    expect(puro?.mensagem).toContain("No vidro o painel fica sem cor");
  });

  it("no sólido, a cor no vidro não muda nada", () => {
    expect(avaliarCor("#002f2f", "auto", "solido", "40")).toEqual(
      avaliarCor("#002f2f", "auto", "solido"),
    );
  });
});

describe("a tela de acesso", () => {
  afterEach(() => {
    limparMarcaGuardada();
    for (const nome of ["--vidro-cor", "--vidro-desfoque"])
      document.documentElement.style.removeProperty(nome);
    document.body.innerHTML = "";
  });

  it("a leitura pública traz as duas chaves para o cache", () => {
    expect(
      mapearBrandingPublico({
        auth_access_vidro_cor: "30",
        auth_access_vidro_desfoque: "forte",
      }),
    ).toEqual({ vidroCor: "30", vidroDesfoque: "forte" });
  });

  it("vira --vidro-cor e --vidro-desfoque no #loginScreen", () => {
    const tela = document.createElement("section");
    aplicarAjusteDoVidro(tela, "40", "leve");
    expect(tela.style.getPropertyValue("--vidro-cor")).toBe("40%");
    expect(tela.style.getPropertyValue("--vidro-desfoque")).toBe("8px");
  });

  it("a configuração do banco aplica e guarda os dois", () => {
    const tela = document.createElement("section");
    tela.id = "loginScreen";
    document.body.append(tela);
    definirMarcaDaConfiguracao({
      valores: {
        auth_access_vidro_cor: "60",
        auth_access_vidro_desfoque: "forte",
      },
      carregou: true,
      chaves: new Set(["auth_access_vidro_cor", "auth_access_vidro_desfoque"]),
    });
    expect(tela.style.getPropertyValue("--vidro-cor")).toBe("60%");
    expect(tela.style.getPropertyValue("--vidro-desfoque")).toBe("18px");
    expect(lerMarcaGuardada()).toMatchObject({
      vidroCor: "60",
      vidroDesfoque: "forte",
    });
  });

  /* O script clássico do <head>, que aplica a marca antes do primeiro paint. */
  const html = ler("index.html");
  function rodarScriptDoHead() {
    const inicio = html.indexOf("(function aplicarMarcaAntesDoPrimeiroPaint");
    new Function(html.slice(inicio, html.indexOf("</script>", inicio)))();
  }

  it("o primeiro quadro aplica a cor e o desfoque guardados", () => {
    guardarMarca({ vidroCor: "40", vidroDesfoque: "leve" });
    rodarScriptDoHead();
    const raiz = document.documentElement.style;
    expect(raiz.getPropertyValue("--vidro-cor")).toBe("40%");
    expect(raiz.getPropertyValue("--vidro-desfoque")).toBe("8px");
  });

  it("valor fora da lista não entra no CSS do primeiro quadro", () => {
    guardarMarca({ vidroCor: "45", vidroDesfoque: "muito" });
    rodarScriptDoHead();
    const raiz = document.documentElement.style;
    expect(raiz.getPropertyValue("--vidro-cor")).toBe("");
    expect(raiz.getPropertyValue("--vidro-desfoque")).toBe("");
  });

  it("a tabela de desfoque do <head> é a de contraste.ts", () => {
    const tabela = html.match(/var desfoques = (\{[^}]*\});/)?.[1] ?? "{}";
    expect(new Function(`return ${tabela};`)()).toEqual(
      DESFOQUE_DO_VIDRO_EM_PX,
    );
  });
});
