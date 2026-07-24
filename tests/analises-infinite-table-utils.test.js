import { describe, expect, it } from "vitest";
import {
  isValidAnalisesRowsFragment,
  numberFromPtBr,
  parseAnalisesRowsFragment
} from "../src/analises/analises-infinite-table-utils.js";

describe("analises-infinite-table-utils", () => {
  it("interpreta números formatados em pt-BR", () => {
    expect(numberFromPtBr("6.092")).toBe(6092);
    expect(numberFromPtBr("25")).toBe(25);
  });

  it("reconhece fragmentos HTML compostos diretamente por linhas de tabela", () => {
    const html = `
      <tr><td>Saúde Indígena</td><td>Candidato A</td></tr>
      <tr><td>Saúde Indígena</td><td>Candidato B</td></tr>
    `;

    expect(isValidAnalisesRowsFragment(html)).toBe(true);
    expect(parseAnalisesRowsFragment(html)).toHaveLength(2);
  });

  it("ignora linhas de detalhe ao contar registros", () => {
    const html = `
      <tr><td>Saúde Indígena</td><td>Candidato A</td></tr>
      <tr class="detail-row"><td colspan="8">Detalhes</td></tr>
    `;

    expect(parseAnalisesRowsFragment(html)).toHaveLength(1);
  });

  it("rejeita fragmentos vazios ou com mensagem de ausência", () => {
    expect(isValidAnalisesRowsFragment("")).toBe(false);
    expect(isValidAnalisesRowsFragment('<tr><td class="empty">Nenhum registro encontrado.</td></tr>')).toBe(false);
  });
});
