const state = { activeKey: "" };
const txt = value => String(value ?? "").trim();
const norm = value => txt(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ");

function encodedKey(button){
  const match = txt(button?.getAttribute("onclick")).match(/toggleDetails\('([^']+)'\)/);
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
        <div><span class="eyebrow">Detalhamento do candidato</span><h2 id="analisesDrawerTitle">Registro da análise</h2></div>
        <button type="button" class="analises-drawer-close" aria-label="Fechar detalhamento"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div class="analises-drawer-context" id="analisesDrawerContext"></div>
      <div id="analisesDrawerBody"></div>
    </aside>`;
  document.body.appendChild(backdrop);
  return backdrop;
}

function sectionFor(label){
  const key = norm(label);
  if(["etapa","data da analise","validacao","janela oficial"].includes(key)) return { key:"status", title:"Situação da análise", icon:"fa-circle-check" };
  if(["nota final","modalidade"].includes(key)) return { key:"result", title:"Resultado", icon:"fa-chart-simple" };
  return { key:"score", title:"Composição da pontuação", icon:"fa-list-check" };
}

function makeSection(def){
  const section = document.createElement("section");
  section.className = "analises-detail-section";
  section.dataset.section = def.key;
  section.innerHTML = `<div class="analises-detail-section-head"><i class="fa-solid ${def.icon}"></i><span>${def.title}</span></div><div class="analises-detail-section-grid"></div>`;
  return section;
}

function contextItems(cells){
  return [["Grupo",cells[0]],["Unidade",cells[1]],["Edital",cells[2]],["Código da vaga",cells[3]],["Vaga",cells[4]],["Status",cells[6]]].filter(([,value])=>Boolean(value));
}

function buildDrawerContent(button, detailRow){
  const backdrop = ensureDrawer();
  const row = button?.closest("tr");
  const cells = [...(row?.querySelectorAll("td") || [])].map(cell => txt(cell.textContent));
  const candidate = cells[5] || "Registro da análise";
  const source = detailRow?.querySelector(".detail-shell");
  const body = backdrop.querySelector("#analisesDrawerBody");

  backdrop.querySelector("#analisesDrawerTitle").textContent = candidate;
  backdrop.querySelector("#analisesDrawerContext").innerHTML = contextItems(cells)
    .map(([label,value]) => `<div><small>${label}</small><strong>${value}</strong></div>`).join("");
  body.replaceChildren();

  if(!source){
    body.innerHTML = '<div class="empty">Não foi possível montar o detalhamento deste registro.</div>';
    return;
  }

  const shell = document.createElement("div");
  shell.className = "detail-shell";
  const sections = new Map();
  [...source.querySelectorAll(":scope > .detail-grid > .kv")].forEach(item => {
    const clone = item.cloneNode(true);
    const label = txt(clone.querySelector(".kv-label")?.textContent);
    const def = sectionFor(label);
    if(!sections.has(def.key)){
      const section = makeSection(def);
      sections.set(def.key, section);
      shell.appendChild(section);
    }
    sections.get(def.key).querySelector(".analises-detail-section-grid").appendChild(clone);
  });

  const actions = source.querySelector(".detail-actions")?.cloneNode(true);
  actions?.querySelectorAll(".mini-chip").forEach(el => el.remove());
  actions?.querySelectorAll("a").forEach(link => {
    if(!/^https?:\/\//i.test(txt(link.getAttribute("href")))) link.remove();
  });
  if(actions?.children.length) shell.insertBefore(actions, shell.firstChild);

  const analysisText = txt(source.querySelector(".analysis-text")?.textContent);
  const analysisSection = document.createElement("section");
  analysisSection.className = "analises-detail-section";
  analysisSection.innerHTML = `<div class="analises-detail-section-head"><i class="fa-solid fa-file-lines"></i><span>Parecer da análise</span></div><div class="analises-detail-analysis"></div>`;
  const analysisBody = analysisSection.querySelector(".analises-detail-analysis");
  analysisBody.textContent = analysisText || "Sem análise registrada.";
  if(!analysisText || analysisText === "Sem análise registrada.") analysisBody.classList.add("analises-detail-empty");
  shell.appendChild(analysisSection);
  body.appendChild(shell);
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
    buildDrawerContent(currentButton, detailRow);
    window.toggleDetails(key);
    const backdrop = ensureDrawer();
    backdrop.hidden = false;
    document.body.style.overflow = "hidden";
    backdrop.querySelector(".analises-drawer-close")?.focus();
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

document.addEventListener("keydown", event => { if(event.key === "Escape") closeDrawer(); });
