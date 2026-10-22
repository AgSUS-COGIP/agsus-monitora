import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const nome = "20261022160000_reabrir_fichas_em_revisao.sql";
const migration = readFileSync(`supabase/migrations/${nome}`, "utf8");
const rollback = readFileSync(`supabase/rollback/${nome}`, "utf8");
const ensaio = readFileSync(`supabase/ensaios/${nome}`, "utf8");
const tela = readFileSync("src/modulos/avaliacao-documental/ficha/ficha.jsx", "utf8");

describe("reabrir fichas em revisão", () => {
  it("só aceita fichas concluídas ou em revisão com a mesma autorização e controle de versão", () => {
    expect(migration).toContain("not in ('CONCLUIDA', 'REVISAR')");
    expect(migration).toContain('private."FC_EXIGIR_COORD_FICHAS"');
    expect(migration).toContain("using errcode = 'PT409'");
    expect(migration).toContain('private."FC_MOTIVO_REABERTURA"');
  });
  it("preserva a análise e registra o status real anterior no histórico", () => {
    expect(migration).toContain(
      `when coalesce("CO_USUARIO_RESPONSAVEL", "CO_USUARIO_CONCLUSAO") is null then 'PENDENTE'`,
    );
    expect(migration).not.toContain('"TP_SITUACAO" = "NU_VERSAO"');
    expect(migration).toContain(`'REABRIR', v_f."TP_SITUACAO"`);
    expect(migration).not.toContain('"DS_LANCAMENTO" =');
    expect(migration).not.toContain('"VL_NOTA_FINAL" =');
    expect(migration).not.toContain('"DS_RESULTADO" =');
  });
  it("tela só oferece a reabertura em revisão para coordenador", () => {
    expect(tela).toContain('st.dados.papel === "COORDENADOR"');
    expect(tela).toContain('st.dados.ficha.situacao === "REVISAR"');
  });
  it("inclui rollback e ensaio transacional sem confirmar mudanças", () => {
    expect(rollback).toContain("Só a ficha concluída se reabre.");
    expect(ensaio).toContain("rollback;");
    expect(ensaio).not.toMatch(/\ncommit;/);
  });
});
