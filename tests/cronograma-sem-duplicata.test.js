import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const app = readFileSync("src/modules/legacy-app.js", "utf8");
const detalhes = readFileSync("src/modules/health-status-details.js", "utf8");

const semComentarios = (fonte) =>
  fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const CRONOGRAMA = [
  "cronograma_automatico",
  "cronograma_percentual",
  "cronograma_atividade_atual",
  "cronograma_proxima_atividade",
  "cronograma_proxima_data",
  "cronograma_dias_para_proxima",
];

/*
  `monitoramento_indigena` é uma view: junta a tabela base com o estado calculado
  do cronograma. As seis colunas de `CRONOGRAMA` só existem aí, não na tabela.
  Apontar esta consulta para a tabela base compila, passa no lint e só quebra em
  produção, com "column ... does not exist".

  O `throw` existe por isso. Antes, se o nome não fosse encontrado, a busca
  devolvia uma lista vazia em silêncio e o teste acusava "faltam as seis colunas
  de cronograma" — mandando quem investiga para o lado errado.
*/
const TABELA_MONITORAMENTO = '.from("monitoramento_indigena")';

function colunasDoSelect(fonte) {
  const i = fonte.indexOf(TABELA_MONITORAMENTO);
  if (i < 0)
    throw new Error(
      `Consulta ${TABELA_MONITORAMENTO} não encontrada na fonte. A tabela foi renomeada?`,
    );
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
  O servidor não era o gargalo.

  Medido no Supabase principal em 09/09/2026: a view inteira devolve as 94
  linhas em 31.2 ms, com 2141 shared hit blocks e 0 reads. As 94 execuções de
  `get_monitoramento_cronograma_estado` custam ~0.307 ms cada.

  O atraso visível estava no navegador: a tabela era desenhada pela requisição
  principal, que não pedia nenhuma coluna de cronograma, e o badge de cada linha
  só nascia quando uma **segunda leitura completa da mesma view** voltava. Nesse
  intervalo cada linha exibia "Carregando cronograma...".
*/
describe("uma leitura só do monitoramento", () => {
  it("a requisição principal traz as seis colunas de cronograma", () => {
    const colunas = colunasDoSelect(app);
    expect(colunas.length).toBeGreaterThan(30);
    for (const coluna of CRONOGRAMA) {
      expect(colunas, `${coluna} ausente da carga principal`).toContain(coluna);
    }
  });

  it("a carga principal publica as linhas para quem precisar", () => {
    expect(semComentarios(app)).toContain(
      'new CustomEvent("agsus:monitoramento-carregado", { detail: { rows } })',
    );
  });

  it("os detalhes consomem o evento em vez de reler", () => {
    const codigo = semComentarios(detalhes);
    expect(codigo).toContain(
      'window.addEventListener("agsus:monitoramento-carregado"',
    );
    expect(codigo).toContain("aplicarLinhasDeMonitoramento(linhas)");
  });

  /*
    A leitura própria continua existindo como contingência — numa página que não
    roda a carga principal —, mas não pode disparar junto com o arranque.
  */
  it("a leitura de contingência só corre se o evento não vier", () => {
    const bloco = detalhes.slice(
      detalhes.indexOf("const sb = client();"),
      detalhes.indexOf('document.addEventListener("click", handleClick)'),
    );
    expect(bloco).toContain(
      "if (!state.recebeuPorEvento) void loadOperationalRows()",
    );
    expect(bloco).toContain("setTimeout");
  });

  /*
    O refetch a cada foco relia as 94 linhas sempre que a pessoa voltava para a
    aba, e os badges sumiam durante a releitura.
  */
  it("não relê a view a cada foco da janela", () => {
    const codigo = semComentarios(detalhes);
    expect(codigo).not.toMatch(
      /addEventListener\(\s*["']focus["'][\s\S]{0,160}loadOperationalRows/,
    );
  });

  it("só resta uma releitura, e é depois de salvar um cronograma", () => {
    const codigo = semComentarios(detalhes);
    const chamadas = (codigo.match(/void loadOperationalRows\(\)/g) || [])
      .length;
    expect(chamadas).toBe(2); // a contingência do arranque e a de após salvar
    expect(codigo).toMatch(
      /agsus:nucleo-cronograma-saved[\s\S]{0,120}loadOperationalRows/,
    );
  });

  /*
    Antes, das 21 colunas pedidas pela segunda requisição, 15 eram cópia exata
    da primeira. Com as seis de cronograma na principal, não sobra motivo para a
    segunda no caminho normal.
  */
  it("nenhuma coluna usada pelos badges falta na carga principal", () => {
    const colunas = new Set(colunasDoSelect(app));
    for (const usada of [
      "cronograma_automatico",
      "cronograma_dias_para_proxima",
      "cronograma_proxima_atividade",
      "status",
      "unidade",
      "edital",
    ]) {
      expect(colunas, `${usada} é lida por urgencyMeta/rowData`).toContain(
        usada,
      );
    }
  });
});
