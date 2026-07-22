const EDITOR_ID = "cronogramaEditor";

function simplifyEditor() {
  const editor = document.getElementById(EDITOR_ID);
  if (!editor || editor.dataset.manualOnly === "true") return;

  editor.dataset.manualOnly = "true";

  const uploadBox = editor.querySelector(".cronograma-upload-box");
  uploadBox?.remove();

  const sourceGrid = editor.querySelector(".cronograma-source-grid");
  const actionsBox = editor.querySelector(".cronograma-actions-box");
  if (sourceGrid) sourceGrid.classList.add("cronograma-manual-source-grid");
  if (actionsBox) actionsBox.classList.add("cronograma-manual-actions");

  const heading = editor.querySelector(".cronograma-heading p");
  if (heading) {
    heading.textContent = "Cadastre as etapas manualmente ou use o modelo padrão. Status e etapa serão calculados pelas datas salvas.";
  }

  const exampleButton = document.getElementById("cronogramaExample");
  if (exampleButton) {
    exampleButton.title = "Criar as atividades padrão e preencher as datas em lote";
  }

  const tableWrap = editor.querySelector(".cronograma-table-wrap");
  if (tableWrap && !editor.querySelector(".cronograma-view-hint")) {
    tableWrap.insertAdjacentHTML(
      "beforebegin",
      `<div class="cronograma-view-hint">
        <i class="fa-solid fa-calendar-days" aria-hidden="true"></i>
        <span>Este é o cronograma oficial do edital. Para consultá-lo novamente, abra o edital pelo botão <strong>Editar</strong>.</span>
      </div>`
    );
  }
}

function installScopedObserver() {
  const modal = document.getElementById("editModal");
  if (!modal) return;

  const observer = new MutationObserver(() => simplifyEditor());
  observer.observe(modal, { childList:true, subtree:true });
  simplifyEditor();
}

export function initNucleoCronogramaManualOnly() {
  installScopedObserver();
}
