const state = { activeKey: "", opening: false };
const txt = (value) => String(value ?? "").trim();
const norm = (value) =>
  txt(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ");

function encodedKey(button) {
  const match = txt(button?.getAttribute("onclick")).match(
    /toggleDetails\('([^']+)'\)/,
  );
  return match ? match[1] : "";
}

function decodedKey(encoded) {
  try {
    return decodeURIComponent(encoded || "");
  } catch {
    return encoded || "";
  }
}

function rowsPerPage() {
  const value = Number(document.getElementById("rowsPerPage")?.value || 50);
  return Number.isFinite(value) && value > 0 ? value : 50;
}

function pageForKey(encoded) {
  const parts = decodedKey(encoded).split("|");
  const globalIndex = Number(parts[parts.length - 1]);
  return Number.isFinite(globalIndex)
    ? Math.floor(globalIndex / rowsPerPage()) + 1
    : 1;
}

function findButton(key) {
  return (
    [
      ...document.querySelectorAll(
        '#tableBody button[onclick*="toggleDetails"]',
      ),
    ].find((button) => encodedKey(button) === key) || null
  );
}

function ensureStyles() {
  if (document.getElementById("analisesDrawerControllerStyles")) return;
  const style = document.createElement("style");
  style.id = "analisesDrawerControllerStyles";
  style.textContent = `
    .analises-drawer-summary{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
    .analises-drawer-summary span{display:inline-flex;align-items:center;gap:6px;padding:6px 9px;border-radius:999px;background:var(--card2);border:1px solid var(--line);font-size:11px;font-weight:800;color:var(--muted)}
    .analises-drawer-summary .status{background:color-mix(in srgb,var(--blue2) 8%,var(--card));color:var(--strong)}
    .analises-detail-section-grid .kv[data-empty="true"]{display:none!important}
    .analises-detail-section[data-section="result"] .kv:first-child{background:color-mix(in srgb,var(--blue2) 7%,var(--card));border-color:color-mix(in srgb,var(--blue2) 20%,var(--line))}
    .analises-detail-section[data-section="result"] .kv:first-child .kv-value{font-size:22px;font-weight:900;color:var(--strong)}
    .analises-drawer-context strong{line-height:1.35}
  `;
  document.head.appendChild(style);
}

function ensureDrawer() {
  let backdrop = document.getElementById("analisesDetailDrawer");
  if (backdrop) return backdrop;
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
          <div class="analises-drawer-summary" id="analisesDrawerSummary"></div>
        </div>
        <button type="button" class="analises-drawer-close" aria-label="Fechar detalhamento"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div class="analises-drawer-context" id="analisesDrawerContext"></div>
      <div id="analisesDrawerBody"></div>
    </aside>`;
  document.body.appendChild(backdrop);
  return backdrop;
}

function sectionFor(label) {
  const key = norm(label);
  if (["etapa", "data da analise", "validacao", "janela oficial"].includes(key))
    return {
      key: "status",
      title: "Situação da análise",
      icon: "fa-circle-check",
    };
  if (["nota final", "modalidade"].includes(key))
    return { key: "result", title: "Resultado", icon: "fa-chart-simple" };
  return {
    key: "score",
    title: "Composição da pontuação",
    icon: "fa-list-check",
  };
}

function makeSection(def) {
  const section = document.createElement("section");
  section.className = "analises-detail-section";
  section.dataset.section = def.key;
  section.innerHTML = `<div class="analises-detail-section-head"><i class="fa-solid ${def.icon}"></i><span>${def.title}</span></div><div class="analises-detail-section-grid"></div>`;
  return section;
}

function visibleValue(value) {
  const cleaned = txt(value);
  return (
    cleaned && !["-", "--", "Não informado", "Sem informação"].includes(cleaned)
  );
}

function contextItems(row) {
  const cells = [...(row?.querySelectorAll("td") || [])];
  return [
    ["Grupo", txt(cells[0]?.textContent)],
    ["Unidade", txt(cells[1]?.textContent)],
    ["Edital", txt(cells[2]?.textContent)],
    ["Código da vaga", txt(cells[3]?.textContent)],
    [
      "Vaga",
      txt(
        cells[4]?.querySelector(".primary-text")?.textContent ||
          cells[4]?.textContent,
      ),
    ],
  ].filter(([, value]) => visibleValue(value));
}

function buildDrawerContent(row, detailRow) {
  const backdrop = ensureDrawer();
  const cells = [...(row?.querySelectorAll("td") || [])];
  const candidate =
    txt(
      cells[5]?.querySelector(".primary-text")?.textContent ||
        cells[5]?.textContent,
    ) || "Registro da análise";
  const responsible =
    txt(cells[5]?.querySelector(".secondary-text")?.textContent) ||
    "Sem responsável";
  const status = txt(cells[6]?.textContent) || "Pendente";
  const source = detailRow?.querySelector(".detail-shell");
  const body = backdrop.querySelector("#analisesDrawerBody");

  backdrop.querySelector("#analisesDrawerTitle").textContent = candidate;
  backdrop.querySelector("#analisesDrawerSummary").innerHTML = `
    <span class="status"><i class="fa-solid fa-circle-info"></i>${status}</span>
    <span><i class="fa-solid fa-user-check"></i>${responsible}</span>`;
  backdrop.querySelector("#analisesDrawerContext").innerHTML = contextItems(row)
    .map(
      ([label, value]) =>
        `<div><small>${label}</small><strong>${value}</strong></div>`,
    )
    .join("");
  body.replaceChildren();

  if (!source) {
    body.innerHTML =
      '<div class="empty">Não foi possível montar o detalhamento deste registro.</div>';
    return;
  }

  const shell = document.createElement("div");
  shell.className = "detail-shell";
  const sections = new Map();
  [...source.querySelectorAll(":scope > .detail-grid > .kv")].forEach(
    (item) => {
      const clone = item.cloneNode(true);
      const label = txt(clone.querySelector(".kv-label")?.textContent);
      const value = txt(clone.querySelector(".kv-value")?.textContent);
      if (!visibleValue(value)) return;
      const def = sectionFor(label);
      if (!sections.has(def.key)) {
        const section = makeSection(def);
        sections.set(def.key, section);
        shell.appendChild(section);
      }
      sections
        .get(def.key)
        .querySelector(".analises-detail-section-grid")
        .appendChild(clone);
    },
  );

  const actions = source.querySelector(".detail-actions")?.cloneNode(true);
  actions?.querySelectorAll(".mini-chip").forEach((el) => el.remove());
  actions?.querySelectorAll("a").forEach((link) => {
    if (!/^https?:\/\//i.test(txt(link.getAttribute("href")))) link.remove();
  });
  if (actions?.children.length) shell.insertBefore(actions, shell.firstChild);

  const analysisText = txt(source.querySelector(".analysis-text")?.textContent);
  if (analysisText && analysisText !== "Sem análise registrada.") {
    const analysisSection = document.createElement("section");
    analysisSection.className = "analises-detail-section";
    analysisSection.innerHTML = `<div class="analises-detail-section-head"><i class="fa-solid fa-file-lines"></i><span>Parecer da análise</span></div><div class="analises-detail-analysis"></div>`;
    analysisSection.querySelector(".analises-detail-analysis").textContent =
      analysisText;
    shell.appendChild(analysisSection);
  }

  body.appendChild(shell);
}

function waitForDetail(key, attempts = 0) {
  return new Promise((resolve) => {
    const check = () => {
      const button = findButton(key);
      const row = button?.closest("tr") || null;
      const detailRow = row?.nextElementSibling?.classList?.contains(
        "detail-row",
      )
        ? row.nextElementSibling
        : null;
      if (detailRow || attempts >= 40) {
        resolve({ button, row, detailRow });
        return;
      }
      attempts += 1;
      window.setTimeout(check, 20);
    };
    check();
  });
}

function showDrawer() {
  const backdrop = ensureDrawer();
  backdrop.hidden = false;
  document.body.style.overflow = "hidden";
  backdrop.querySelector(".analises-drawer-close")?.focus();
}

function closeDrawer() {
  const backdrop = document.getElementById("analisesDetailDrawer");
  if (!backdrop || backdrop.hidden) return;
  backdrop.hidden = true;
  document.body.style.overflow = "";
  const button = findButton(state.activeKey);
  state.activeKey = "";
  button?.focus();
}

async function openDetail(button) {
  if (state.opening) return;
  const key = encodedKey(button);
  if (!key || typeof window.toggleDetails !== "function") return;

  state.opening = true;
  state.activeKey = key;
  const originalRow = button.closest("tr")?.cloneNode(true) || null;
  const savedTable = window.analisesInfiniteTable?.snapshot?.() || null;
  const targetPage = pageForKey(key);
  let detailWasOpened = false;

  try {
    if (typeof window.goPage === "function") window.goPage(targetPage);
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    window.toggleDetails(key);
    detailWasOpened = true;

    const result = await waitForDetail(key);
    buildDrawerContent(result.row || originalRow, result.detailRow);
    showDrawer();
  } catch (error) {
    console.error("Falha ao abrir detalhamento de análises:", error);
    const backdrop = ensureDrawer();
    backdrop.querySelector("#analisesDrawerTitle").textContent =
      "Detalhamento indisponível";
    backdrop.querySelector("#analisesDrawerSummary").innerHTML = "";
    backdrop.querySelector("#analisesDrawerContext").innerHTML = "";
    backdrop.querySelector("#analisesDrawerBody").innerHTML =
      '<div class="empty">Não foi possível abrir este registro. Tente novamente.</div>';
    showDrawer();
  } finally {
    if (detailWasOpened) {
      const currentButton = findButton(key);
      if (currentButton?.getAttribute("aria-expanded") === "true")
        window.toggleDetails(key);
    }
    window.analisesInfiniteTable?.restore?.(savedTable);
    state.opening = false;
  }
}

ensureStyles();
document.addEventListener(
  "click",
  (event) => {
    const closeButton = event.target?.closest?.(
      "#analisesDetailDrawer .analises-drawer-close",
    );
    const backdrop = event.target?.matches?.("#analisesDetailDrawer")
      ? event.target
      : null;
    if (closeButton || backdrop) {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeDrawer();
      return;
    }
    const button = event.target?.closest?.(
      '#tableBody button[onclick*="toggleDetails"]',
    );
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openDetail(button);
  },
  true,
);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeDrawer();
});
