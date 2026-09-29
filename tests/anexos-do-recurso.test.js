import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ACEITA_NO_SELETOR,
  BUCKET_DOS_ANEXOS,
  caminhoDoAnexo,
  LIMITE_DO_ANEXO,
  nomeSeguroDoAnexo,
  tamanhoLegivel,
  TIPOS_DE_ANEXO,
  TIPOS_DE_ARQUIVO,
  tipoDoArquivo,
  validarArquivoDoAnexo,
} from "../src/lib/anexos-do-recurso.js";

/*
  Anexos do recurso: o caminho que as políticas do Storage leem, a validação
  antes do envio e a coerência com o bucket e as políticas da migration
  (ensaiadas em produção, begin…rollback: editor envia, leitor e outra área
  não; ninguém lê sem registrar o download; ninguém sobrescreve nem apaga).
*/
const MIGRATION = readFileSync(
  "supabase/migrations/20260929230000_recursos_modelos_anexos_respostas.sql",
  "utf8",
).replace(/\r\n/g, "\n");

const RECURSO = "527c2b8c-7744-4a4b-bc06-108f6683297b";
const ID = "0b8f5e0e-1c1d-4f55-9a55-2b7c3c9d2a10";
const arquivo = (name, size, type = "") => ({ name, size, type });

/* O que `storage.foldername(name)` devolve: as pastas, sem o arquivo. */
const pastas = (caminho) => caminho.split("/").slice(0, -1);

describe("caminho no bucket", () => {
  it("é <área>/<recurso>/<uuid>-<nome seguro>, com duas pastas", () => {
    const caminho = caminhoDoAnexo(
      "saude-indigena",
      RECURSO,
      ID,
      "Recurso Ana Ribeiro (final).pdf",
    );
    expect(caminho).toBe(
      `saude-indigena/${RECURSO}/${ID}-Recurso-Ana-Ribeiro-final.pdf`,
    );
    expect(pastas(caminho)).toEqual(["saude-indigena", RECURSO]);
  });

  it("nome sem acento, barra nem ponto-ponto; longo é cortado mantendo a extensão", () => {
    expect(nomeSeguroDoAnexo("Documentação/../x.PDF")).toBe(
      "Documentacao.-x.PDF",
    );
    expect(nomeSeguroDoAnexo("../../etc/passwd")).toBe("etc-passwd");
    expect(nomeSeguroDoAnexo("../../etc/passwd")).not.toContain("..");
    expect(nomeSeguroDoAnexo("../../etc/passwd")).not.toContain("/");
    expect(nomeSeguroDoAnexo("   ")).toBe("arquivo");
    const longo = nomeSeguroDoAnexo(`${"a".repeat(300)}.docx`);
    expect(longo.length).toBe(120);
    expect(longo.endsWith(".docx")).toBe(true);
  });

  it("o caminho nunca ganha pasta a mais, mesmo com barra no nome", () => {
    for (const nome of ["a/b/c.pdf", "..\\..\\x.pdf", "/abs.pdf", "a%2Fb.pdf"])
      expect(pastas(caminhoDoAnexo("sede", RECURSO, ID, nome))).toEqual([
        "sede",
        RECURSO,
      ]);
  });

  it("recusa área ou ids fora do formato", () => {
    expect(() => caminhoDoAnexo("../sede", RECURSO, ID, "a.pdf")).toThrow();
    expect(() => caminhoDoAnexo("sede", "r1", ID, "a.pdf")).toThrow();
    expect(() => caminhoDoAnexo("sede", RECURSO, "x/y", "a.pdf")).toThrow();
  });
});

describe("validação do arquivo", () => {
  it("aceita os seis tipos, pela extensão (o navegador às vezes não diz o tipo)", () => {
    for (const nome of [
      "a.pdf",
      "a.docx",
      "a.doc",
      "a.jpg",
      "a.jpeg",
      "a.png",
      "a.odt",
    ])
      expect(validarArquivoDoAnexo(arquivo(nome, 10)).mime, nome).toBeTruthy();
    expect(validarArquivoDoAnexo(arquivo("a.odt", 10)).mime).toBe(
      "application/vnd.oasis.opendocument.text",
    );
  });

  it("recusa outro tipo, extensão que contradiz o tipo, vazio e acima de 20 MB", () => {
    expect(validarArquivoDoAnexo(arquivo("a.exe", 10)).erro).toMatch(
      /não aceito/,
    );
    expect(
      validarArquivoDoAnexo(arquivo("a.pdf", 10, "image/png")).erro,
    ).toMatch(/não aceito/);
    expect(
      tipoDoArquivo(arquivo("a.pdf", 10, "application/octet-stream")).mime,
    ).toBe("application/pdf");
    expect(validarArquivoDoAnexo(arquivo("a.pdf", 0)).erro).toMatch(/vazio/);
    expect(validarArquivoDoAnexo(arquivo("a.pdf", LIMITE_DO_ANEXO)).mime).toBe(
      "application/pdf",
    );
    expect(
      validarArquivoDoAnexo(arquivo("a.pdf", LIMITE_DO_ANEXO + 1)).erro,
    ).toMatch(/20 MB/);
    expect(validarArquivoDoAnexo(null).erro).toBe("Escolha o arquivo.");
  });

  it("seletor e tamanho legível", () => {
    expect(ACEITA_NO_SELETOR).toBe(".pdf,.docx,.doc,.jpg,.jpeg,.png,.odt");
    expect(tamanhoLegivel(512)).toBe("512 B");
    expect(tamanhoLegivel(2048)).toBe("2 KB");
    expect(tamanhoLegivel(5.5 * 1024 * 1024)).toBe("5,5 MB");
  });
});

describe("coerência com a migration", () => {
  it("o bucket é privado, com o limite e os tipos daqui", () => {
    const bucket = MIGRATION.match(
      /insert into storage\.buckets[\s\S]*?values \(\s*'([^']+)', '[^']+', (false|true), (\d+),\s*array\[([\s\S]*?)\]::text\[\]/,
    );
    expect(bucket[1]).toBe(BUCKET_DOS_ANEXOS);
    expect(bucket[2]).toBe("false");
    expect(Number(bucket[3])).toBe(LIMITE_DO_ANEXO);
    expect([...bucket[4].matchAll(/'([^']+)'/g)].map((m) => m[1])).toEqual(
      TIPOS_DE_ARQUIVO.map((t) => t.mime),
    );
  });

  it("os tipos de anexo são os do CHECK", () => {
    const check = MIGRATION.match(
      /"CK_ANEXORECURSO_TPANEXO" check \("TP_ANEXO" in \(([^)]*)\)\)/,
    )[1];
    expect([...check.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort()).toEqual(
      TIPOS_DE_ANEXO.map((t) => t.id).sort(),
    );
  });

  it("políticas: insert com editor, select só com download registrado; sem update nem delete", () => {
    const politicas = [
      ...MIGRATION.matchAll(
        /create policy (\w+) on storage\.objects\nfor (\w+) to authenticated/g,
      ),
    ].map((m) => [m[1], m[2]]);
    expect(politicas).toEqual([
      ["recursos_anexos_storage_select", "select"],
      ["recursos_anexos_storage_insert", "insert"],
    ]);
    expect(MIGRATION).toContain(`private."FC_PODE_ANEXO_RECURSO"(name, 2)`);
    expect(MIGRATION).toContain(`private."FC_PODE_BAIXAR_ANEXO_RECURSO"(name)`);
    expect(MIGRATION).toMatch(
      /h\."TP_ACAO" = 'download'[\s\S]*?h\."CO_USUARIO" = \(select auth\.uid\(\)\)[\s\S]*?interval '5 minutes'/,
    );
    expect(MIGRATION).not.toMatch(/for (update|delete) to authenticated/);
    // A regra de caminho da política é a do front: duas pastas, área e recurso.
    expect(MIGRATION).toContain(
      "cardinality(storage.foldername(p_caminho)) = 2",
    );
    expect(MIGRATION).toContain(
      `r."CO_RECURSO_CANDIDATO"::text = (storage.foldername(p_caminho))[2]`,
    );
    expect(MIGRATION).toContain(
      `m."CO_AREA" = (storage.foldername(p_caminho))[1]`,
    );
  });

  it("o registro lê tamanho, tipo e dono do Storage, não do navegador", () => {
    const inicio = MIGRATION.indexOf(
      "create function public.registrar_anexo_recurso(",
    );
    const corpo = MIGRATION.slice(
      inicio,
      MIGRATION.indexOf("$function$;", inicio),
    );
    expect(corpo).toContain("o.metadata->>'size'");
    expect(corpo).toContain("o.metadata->>'mimetype'");
    expect(corpo).toContain("v_dono is distinct from v_uid::text");
  });
});
