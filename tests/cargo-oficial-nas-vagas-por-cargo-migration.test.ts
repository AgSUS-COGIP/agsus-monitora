import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/*
  CARGO OFICIAL NAS VAGAS POR CARGO (migration 20261117130000)

  listar_vagas_por_cargo_da_visao_geral passa a devolver co_cargo nas vagas e
  no quadro, para a Visão geral comparar os cargos das vagas reabertas pelo
  cadastro oficial. Aqui, sem banco: o que muda, o que não pode afrouxar e se
  as guardas do md5 da migration e do rollback batem com os corpos escritos.
*/

const RAIZ = path.resolve(import.meta.dirname, "..");
const NOME = "20261117130000_cargo_oficial_nas_vagas_por_cargo";
const ler = (relativo: string) =>
  fs.readFileSync(path.join(RAIZ, relativo), "utf8").replace(/\r\n/g, "\n");

const migration = ler(`supabase/migrations/${NOME}.sql`);
const ensaio = ler(`supabase/ensaios/${NOME}.sql`);
const rollback = ler(`supabase/rollback/${NOME}.sql`);

/* O CREATE OR REPLACE da função e o corpo entre os $function$ (o prosrc). */
function funcao(sql: string) {
  const inicio = sql.indexOf(
    "CREATE OR REPLACE FUNCTION public.listar_vagas_por_cargo_da_visao_geral(",
  );
  expect(inicio).toBeGreaterThan(-1);
  const fim = sql.indexOf("$function$;", inicio);
  const texto = sql.slice(inicio, fim);
  return { texto, corpo: texto.slice(texto.indexOf("AS $function$") + 13) };
}
const md5 = (texto: string) => createHash("md5").update(texto).digest("hex");
const guardas = (sql: string) =>
  [...sql.matchAll(/is distinct from '([0-9a-f]{32})'/g)].map((m) => m[1]);

describe("migration 20261117130000", () => {
  const nova = funcao(migration);
  const antiga = funcao(rollback);

  it("vagas e quadro trazem co_cargo pela grafia, na área pedida", () => {
    expect(nova.corpo).toContain(
      `'co_cargo', private."FC_CARGO_DA_GRAFIA"(s."NO_CARGO", v_area)`,
    );
    expect(nova.corpo).toContain(
      `'co_cargo', private."FC_CARGO_DA_GRAFIA"(q."NO_CARGO", v_area)`,
    );
    expect(antiga.corpo).not.toContain("co_cargo");
  });

  it("o resto da função não afrouxa: sessão, recurso, área, recorte, sem dado pessoal", () => {
    expect(nova.texto).toContain("STABLE SECURITY DEFINER");
    expect(nova.texto).toContain("SET search_path TO ''");
    expect(nova.texto).toContain("SET statement_timeout TO '10s'");
    expect(nova.corpo).toContain("errcode = '28000'");
    expect(nova.corpo).toContain("private.pode_recurso('dashboard')");
    expect(nova.corpo).toContain('private."FC_AREAS_USUARIO"()');
    expect(nova.corpo).toContain('private."FC_EDITAIS_VISIVEIS"()');
    expect(nova.corpo).not.toMatch(/c\.nome|matricula|"DS_EMAIL|cpf/i);
    // Fora o co_cargo, o corpo é o de antes.
    expect(
      nova.corpo
        .split("\n")
        .filter(
          (l) => !l.includes("co_cargo") && !l.includes("-- O cargo oficial"),
        )
        .join("\n"),
    ).toBe(antiga.corpo);
  });

  it("as guardas batem: a migration espera o corpo antigo e o rollback, o novo", () => {
    expect(guardas(migration)).toEqual([md5(antiga.corpo)]);
    expect(guardas(rollback)).toEqual([md5(nova.corpo)]);
    expect(migration).toContain(
      "to_regprocedure('private.\"FC_CARGO_DA_GRAFIA\"(text,text)')",
    );
  });

  it("o ensaio aplica o mesmo corpo, confere o md5 novo e termina em rollback", () => {
    expect(funcao(ensaio).texto).toBe(nova.texto);
    expect(ensaio).toContain(`is distinct from '${md5(nova.corpo)}'`);
    expect(ensaio.trimEnd().endsWith("rollback;")).toBe(true);
    expect(ensaio).not.toMatch(/^commit;/m);
    expect(migration.trimEnd().endsWith("commit;")).toBe(true);
    expect(rollback.trimEnd().endsWith("commit;")).toBe(true);
  });
});
