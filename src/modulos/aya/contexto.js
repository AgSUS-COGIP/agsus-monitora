/* Contexto já visível na tela; nenhuma consulta à rede. */
function compactText(value, maxLength = 180) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function uniqueTexts(values, limit = 10, maxLength = 180) {
  const seen = new Set();
  const output = [];
  for (const value of values) {
    const text = compactText(value, maxLength);
    const key = text.toLocaleLowerCase("pt-BR");
    if (!text || seen.has(key)) continue;
    seen.add(key);
    output.push(text);
    if (output.length >= limit) break;
  }
  return output;
}

function textOf(doc, selector, maxLength = 240) {
  return compactText(doc.querySelector(selector)?.textContent, maxLength);
}

function visibleTextList(doc, selector, limit = 10, maxLength = 220) {
  return uniqueTexts(
    Array.from(doc.querySelectorAll(selector))
      .filter((item) => !item.hidden)
      .map((item) => item.textContent),
    limit,
    maxLength,
  );
}

/*
  O edital aberto agora (formulário de Editais ou gaveta de outra tela), para a
  Aya saber de qual registro se fala. Só o número do edital ("101/2026"): o
  título de uma gaveta pode ser o nome de um candidato, e nome de terceiro não
  vai para o contexto.
*/
const NUMERO_DO_EDITAL = /\b\d{1,4}\/\d{4}\b/;

function editalAberto(doc) {
  const formulario = doc.querySelector("#editModal #mEdital");
  const doFormulario = compactText(formulario?.value, 40);
  if (doFormulario) return `Edital ${doFormulario}`;
  for (const topo of doc.querySelectorAll(".ui-gaveta-topo")) {
    const numero = String(topo.textContent || "").match(NUMERO_DO_EDITAL);
    if (numero) return `Edital ${numero[0]}`;
  }
  return "";
}

export function collectAyaPageContext(doc = document) {
  // "Territórios por vagas" do mapa da Saúde Indígena (src/modulos/mapa-saude-indigena/).
  const territories = uniqueTexts(
    Array.from(doc.querySelectorAll(".mapa-si-territorio")).map((item) => {
      const name = item.querySelector("strong")?.textContent || "";
      const detail = item.querySelector("small")?.textContent || "";
      const vacancies =
        item.querySelector(".mapa-si-territorio__vagas")?.textContent || "";
      return [name, vacancies, detail].filter(Boolean).join(" — ");
    }),
    34,
    240,
  );

  const dseis = territories.length
    ? territories
    : uniqueTexts(
        // Unidades do DSEI aberto (os municípios de Projetos são .mapa-si-territorio).
        Array.from(doc.querySelectorAll(".mapa-si-unidade")).map((item) => {
          const name = item.querySelector("strong")?.textContent || "";
          const detail = item.querySelector("small")?.textContent || "";
          return [name, detail].filter(Boolean).join(" — ");
        }),
        20,
        220,
      );

  const editais = uniqueTexts(
    Array.from(
      doc.querySelectorAll(
        ".visao-geral-tabela tbody tr, #nucleoTableBody tr, #nucleoRows tr, .nucleo-table tbody tr",
      ),
    ).map((row) => {
      const cells = Array.from(row.querySelectorAll("td"));
      return cells
        .slice(0, 5)
        .map((cell) => compactText(cell.textContent, 100))
        .filter(Boolean)
        .join(" — ");
    }),
    12,
    400,
  );

  const kpis = visibleTextList(doc, ".visao-geral-kpis .ui-kpi", 12, 180);

  const activeFilters = uniqueTexts(
    [...visibleTextList(doc, ".visao-geral-filtros .ui-chip", 12, 120)],
    12,
    180,
  );

  return {
    registroAberto: editalAberto(doc),
    pathname: doc.defaultView?.location?.pathname || "",
    pageTitle: compactText(doc.title, 160),
    mapSummary: textOf(doc, ".mapa-si-painel__contagem", 120),
    activeFilters,
    search: compactText(
      doc.querySelector(".visao-geral-tela .ui-tabela-busca")?.value,
      120,
    ),
    kpis,
    territories,
    dseis,
    editais,
  };
}
