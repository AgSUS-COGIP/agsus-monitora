import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { COLUNAS_DO_MONITORAMENTO } from "../src/app/carga.js";

const CRONOGRAMA = [
  "cronograma_automatico",
  "cronograma_percentual",
  "cronograma_atividade_atual",
  "cronograma_proxima_atividade",
  "cronograma_proxima_data",
  "cronograma_dias_para_proxima",
];

/*
  A consulta nomeia a TABELA, mas quem responde é a view.

  As seis colunas de `CRONOGRAMA` não existem em `TB_MONITORAMENTO_INDIGENA` —
  são calculadas em `VW_MONITORAMENTO_INDIGENA_OPERACIONAL`. O que faz isto
  funcionar é `monitoramento-operational-transport.js`, que intercepta o cliente
  Supabase e desvia os `select` da tabela para a view, deixando as escritas na
  tabela. Ler o `.from()` aqui e concluir que falta coluna é o erro natural, e a
  razão de este comentário existir.
*/
function colunasDoSelect(fonte) {
  const i = fonte.indexOf('.from("TB_MONITORAMENTO_INDIGENA")');
  if (i < 0) return [];
  const sel = fonte.indexOf(".select(", i);
  const a = fonte.indexOf('"', sel);
  const b = fonte.indexOf('"', a + 1);
  return fonte
    .slice(a + 1, b)
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
}

/*
  O servidor não era o gargalo (medido em 09/09/2026: a view inteira em 31 ms).
  O atraso estava no navegador: a tabela era desenhada pela requisição
  principal, sem as colunas de cronograma, e o selo de cada linha só nascia
  quando uma SEGUNDA leitura completa da mesma view voltava
  (`health-status-details.js`, que saiu com a Visão geral em React). Hoje há uma
  leitura só: a da carga principal, que a Visão geral lê de
  dados-do-monitoramento.js.
*/
describe("uma leitura só do monitoramento", () => {
  it("a requisição principal traz as seis colunas de cronograma", () => {
    const colunas = COLUNAS_DO_MONITORAMENTO.split(",");
    expect(colunas.length).toBeGreaterThan(30);
    for (const coluna of CRONOGRAMA) {
      expect(colunas, `${coluna} ausente da carga principal`).toContain(coluna);
    }
  });

  it("nenhuma coluna usada pela tabela e pelos detalhes falta na carga principal", () => {
    const colunas = new Set(COLUNAS_DO_MONITORAMENTO.split(","));
    for (const usada of [
      ...CRONOGRAMA,
      "status",
      "unidade",
      "edital",
      "link_edital",
      "responsavel",
      "observacoes",
    ]) {
      expect(colunas, `${usada} é lida por src/lib/visao-geral.js`).toContain(
        usada,
      );
    }
  });

  it("a Visão geral não relê a view por conta própria", () => {
    const pasta = "src/modulos/visao-geral";
    for (const arquivo of readdirSync(pasta)) {
      const fonte = readFileSync(`${pasta}/${arquivo}`, "utf8");
      expect(fonte, arquivo).not.toContain('.from("TB_');
    }
  });
});
