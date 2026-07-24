export function numberFromPtBr(value){
  return Number(String(value || "0").replace(/\./g, "")) || 0;
}

export function parseAnalisesRowsFragment(html){
  if(!html) return [];

  const table = document.createElement("table");
  const body = document.createElement("tbody");
  table.appendChild(body);
  body.innerHTML = String(html);

  return [...body.rows].filter(row => {
    if(row.classList.contains("detail-row")) return false;
    if(row.querySelector("td.empty")) return false;
    return !/Nenhum registro encontrado/i.test(row.textContent || "");
  });
}

export function isValidAnalisesRowsFragment(html){
  return parseAnalisesRowsFragment(html).length > 0;
}
