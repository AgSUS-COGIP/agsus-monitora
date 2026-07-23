const state = {
  activeKey: ""
};

const txt = value => String(value ?? "").trim();

function encodedKey(button){
  const inline = txt(button?.getAttribute("onclick"));
  const match = inline.match(/toggleDetails\('([^']+)'\)/);
  return match ? match[1] : "";
}

function findButton(key){
  return [...document.querySelectorAll('#tableBody button[onclick*="toggleDetails"]')]
    .find(button => encodedKey(button) === key) || null;
}

function ensureDrawer(){
  let backdrop = document.getElementById("analisesDetailDrawer");
  if(backdrop) return backdrop;

  backdrop = document.createElement("div");
  backdrop.id = "analisesDetailDrawer";
  backdrop.className = "analises-drawer-backdrop";
  backdrop.hidden = true;
  backdrop.innerHTML = `
    <aside class="analises-drawer" role="dialog" aria-modal="true" aria-labelledby="analisesDrawerTitle">
      <div class="analises-drawer-head">
        <div>
          <span class="eyebrow">Detalhamento do candidato</span>
          <h2 id="analisesDrawerTitle">Registro da análise</h2>
        </div>
        <button type="button" class="analises-drawer-close" aria-label="Fechar detalhamento">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
      <div class="analises-drawer-context" id="analisesDrawerContext"></div>
      <div id="analisesDrawerBody"></div>
    </aside>`;

  document.body.appendChild(backdrop);
  return backdrop;
}

function contextItems(cells){
  return [
    ["Grupo", cells[0]],
    ["Unidade", cells[1]],
    ["Edital", cells[2]],
    ["Código da vaga", cells[3]],
    ["Vaga", cells[4]],
    ["Status", cells[6]]
  ].filter(([, value]) => Boolean(value));
}

function populateDrawer(button, detailRow){
  const backdrop = ensureDrawer();
  const row = button?.closest("tr");
  const cells = [...(row?.querySelectorAll("td") || [])].map(cell => txt(cell.textContent));
  const candidate = cells[5] || "Registro da análise";
  const detail = detailRow?.querySelector(".detail-shell")?.cloneNode(true);

  backdrop.querySelector("#analisesDrawerTitle").textContent = candidate;
  backdrop.querySelector("#analisesDrawerContext").innerHTML = contextItems(cells)
    .map(([label, value]) => `<div><small>${label}</small><strong>${value}</strong></div>`)
    .join("");

  const body = backdrop.querySelector("#analisesDrawerBody");
  body.replaceChildren();

  if(detail){
    detail.querySelectorAll(".mini-chip").forEach(chip => chip.remove());
    detail.querySelectorAll("a").forEach(link => {
      const href = txt(link.getAttribute("href"));
      if(!/^https?:\/\//i.test(href)) link.remove();
    });
    body.appendChild(detail);
  }else{
    body.innerHTML = '<div class="empty">Não foi possível montar o detalhamento deste registro.</div>';
  }

  backdrop.hidden = false;
  document.body.style.overflow = "hidden";
  backdrop.querySelector(".analises-drawer-close")?.focus();
}

function closeDrawer(){
  const backdrop = document.getElementById("analisesDetailDrawer");
  if(!backdrop || backdrop.hidden) return;

  backdrop.hidden = true;
  document.body.style.overflow = "";
  const button = findButton(state.activeKey);
  state.activeKey = "";
  button?.focus();
}

function openDetail(button){
  const key = encodedKey(button);
  if(!key || typeof window.toggleDetails !== "function") return;

  state.activeKey = key;
  window.toggleDetails(key);

  window.setTimeout(() => {
    const currentButton = findButton(key);
    const detailRow = currentButton?.closest("tr")?.nextElementSibling;
    populateDrawer(currentButton, detailRow);
    window.toggleDetails(key);
  }, 0);
}

document.addEventListener("click", event => {
  const closeButton = event.target?.closest?.("#analisesDetailDrawer .analises-drawer-close");
  const backdrop = event.target?.matches?.("#analisesDetailDrawer") ? event.target : null;
  if(closeButton || backdrop){
    event.preventDefault();
    event.stopImmediatePropagation();
    closeDrawer();
    return;
  }

  const button = event.target?.closest?.('#tableBody button[onclick*="toggleDetails"]');
  if(!button) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  openDetail(button);
}, true);

document.addEventListener("keydown", event => {
  if(event.key === "Escape") closeDrawer();
});
