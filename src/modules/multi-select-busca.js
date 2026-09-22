/*
  Select com busca e escolha múltipla.

  Enriquece um `<select>` que já está no HTML em vez de substituí-lo: o nativo
  continua no DOM como fonte de verdade (vira `multiple`, fica escondido e tem
  as suas `option` marcadas), e por cima é desenhado um menu com campo de busca
  e caixas de seleção. Manter o estado no select nativo evita um segundo lugar
  onde a seleção poderia divergir e deixa o componente inspecionável em teste.

  O padrão vem da tela de Análises (`src/analises/analises-app.js`), onde estava
  preso ao estado daquele arquivo. Aqui foi extraído para ser reaproveitável.
*/

const escMap = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#039;",
};
const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => escMap[char]);
const attr = (value) => esc(value).replaceAll("`", "&#096;");
const text = (value) => String(value ?? "").trim();

/*
  Busca sem acento e sem caixa: quem procura "migracao" espera encontrar
  "Migração".
*/
const norm = (value) =>
  text(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");

const compara = (a, b) =>
  String(a ?? "").localeCompare(String(b ?? ""), "pt-BR", { numeric: true });

const instancias = new Set();
let fechamentoGlobalInstalado = false;

/*
  Um único par de listeners no documento fecha qualquer menu aberto. Registar um
  par por instância faria o custo crescer com o número de filtros na tela.
*/
function instalarFechamentoGlobal() {
  if (fechamentoGlobalInstalado) return;
  fechamentoGlobalInstalado = true;
  document.addEventListener("click", (evento) => {
    instancias.forEach((instancia) => {
      if (!instancia.raiz.contains(evento.target)) instancia.fechar();
    });
  });
  document.addEventListener("keydown", (evento) => {
    if (evento.key !== "Escape") return;
    instancias.forEach((instancia) => {
      if (!instancia.aberto()) return;
      instancia.fechar();
      instancia.gatilho.focus();
    });
  });
}

function normalizarOpcoes(lista) {
  return (lista || [])
    .map((item) =>
      typeof item === "object" && item !== null
        ? {
            value: text(item.value),
            label: text(item.label) || text(item.value),
          }
        : { value: text(item), label: text(item) },
    )
    .filter((item) => item.value);
}

/*
  Lê as `option` já escritas no HTML. A de valor vazio ("Todos os editais") não
  é uma escolha, é o rótulo de "nenhum filtro" — vira o placeholder do gatilho.
*/
function lerOpcoesDoSelect(select) {
  const opcoes = [];
  let placeholder = "";
  [...select.options].forEach((option) => {
    if (!text(option.value)) {
      placeholder = placeholder || text(option.textContent);
      return;
    }
    opcoes.push({ value: text(option.value), label: text(option.textContent) });
  });
  return { opcoes, placeholder };
}

/**
 * Transforma um `<select>` num campo de múltipla escolha com busca.
 *
 * @param {HTMLSelectElement|string} alvo Elemento ou id do select.
 * @param {{placeholder?: string, onChange?: (valores: string[]) => void}} config
 * @returns {{
 *   definirOpcoes: (lista: Array<string|{value: string, label: string}>) => void,
 *   obterSelecionados: () => string[],
 *   definirSelecionados: (valores: string[]) => void,
 *   fechar: () => void,
 * }|null} `null` se o alvo não existir ou já tiver sido ativado.
 */
export function ativarMultiSelectBusca(alvo, config = {}) {
  const select =
    typeof alvo === "string" ? document.getElementById(alvo) : alvo || null;
  if (!select || select.dataset.multiSelectBusca === "on") return null;
  select.dataset.multiSelectBusca = "on";

  const lido = lerOpcoesDoSelect(select);
  const estado = {
    opcoes: lido.opcoes,
    selecionados: [],
    busca: "",
    placeholder: text(config.placeholder) || lido.placeholder || "Todos",
  };

  select.multiple = true;
  select.classList.add("multi-select-native");
  select.setAttribute("aria-hidden", "true");
  select.tabIndex = -1;

  const raiz = document.createElement("div");
  raiz.className = "multi-select";
  raiz.innerHTML = `
    <button type="button" class="multi-select-trigger" aria-haspopup="listbox" aria-expanded="false">
      <span class="multi-select-label"></span>
      <span class="multi-select-count" hidden>0</span>
      <i class="fa-solid fa-chevron-down" aria-hidden="true"></i>
    </button>
    <div class="multi-select-menu" hidden>
      <input type="search" class="multi-select-search" placeholder="Buscar..." autocomplete="off" aria-label="Buscar opções">
      <div class="multi-select-actions">
        <button type="button" class="multi-select-link" data-acao="visiveis">Selecionar visíveis</button>
        <button type="button" class="multi-select-link" data-acao="limpar">Limpar</button>
      </div>
      <div class="multi-select-options" role="listbox" aria-multiselectable="true"></div>
    </div>`;
  select.insertAdjacentElement("afterend", raiz);

  const gatilho = raiz.querySelector(".multi-select-trigger");
  const rotulo = raiz.querySelector(".multi-select-label");
  const contagem = raiz.querySelector(".multi-select-count");
  const menu = raiz.querySelector(".multi-select-menu");
  const busca = raiz.querySelector(".multi-select-search");
  const listaOpcoes = raiz.querySelector(".multi-select-options");

  // O `<label>` da linha aponta para o select escondido; redireciona o clique.
  const etiqueta = select.closest(".form-row")?.querySelector("label");
  if (etiqueta) etiqueta.addEventListener("click", () => gatilho.focus());

  const aberto = () => !menu.hidden;

  function fechar() {
    menu.hidden = true;
    gatilho.setAttribute("aria-expanded", "false");
  }

  function abrir() {
    instancias.forEach((outra) => {
      if (outra.raiz !== raiz) outra.fechar();
    });
    menu.hidden = false;
    gatilho.setAttribute("aria-expanded", "true");
    setTimeout(() => busca.focus(), 0);
  }

  function alternar() {
    if (aberto()) fechar();
    else abrir();
  }

  function rotuloDe(valor) {
    return estado.opcoes.find((opcao) => opcao.value === valor)?.label || valor;
  }

  function visiveis() {
    const termo = norm(estado.busca);
    if (!termo) return estado.opcoes;
    return estado.opcoes.filter(
      (opcao) =>
        norm(opcao.label).includes(termo) || norm(opcao.value).includes(termo),
    );
  }

  /*
    Espelha a seleção nas `option` do select nativo. Sem isto o select escondido
    ficaria a mentir sobre o estado para qualquer código (ou teste) que o leia.
  */
  function sincronizarNativo() {
    const escolhidos = new Set(estado.selecionados);
    [...select.options].forEach((option) => {
      option.selected = escolhidos.has(text(option.value));
    });
  }

  function desenharGatilho() {
    const escolhidos = estado.selecionados;
    rotulo.textContent = !escolhidos.length
      ? estado.placeholder
      : escolhidos.length <= 2
        ? escolhidos.map(rotuloDe).join(", ")
        : `${escolhidos.length} selecionados`;
    rotulo.title = escolhidos.length ? escolhidos.map(rotuloDe).join(", ") : "";
    contagem.hidden = !escolhidos.length;
    contagem.textContent = String(escolhidos.length);
    raiz.classList.toggle("is-filled", Boolean(escolhidos.length));
  }

  function desenharOpcoes() {
    const escolhidos = new Set(estado.selecionados);
    const lista = visiveis();
    if (!lista.length) {
      listaOpcoes.innerHTML = `<div class="multi-select-empty">Nenhuma opção encontrada.</div>`;
      return;
    }
    listaOpcoes.innerHTML = lista
      .map((opcao) => {
        const marcado = escolhidos.has(opcao.value);
        return `<label class="multi-select-option" role="option" aria-selected="${marcado}" title="${attr(opcao.label)}"><input type="checkbox" value="${attr(opcao.value)}"${marcado ? " checked" : ""}><span>${esc(opcao.label)}</span></label>`;
      })
      .join("");
  }

  function desenhar() {
    desenharGatilho();
    desenharOpcoes();
  }

  function aplicar() {
    sincronizarNativo();
    desenhar();
    config.onChange?.([...estado.selecionados]);
  }

  function ordenar(valores) {
    return [...new Set(valores)].sort((a, b) =>
      compara(rotuloDe(a), rotuloDe(b)),
    );
  }

  function moverFoco(indice) {
    const itens = [...listaOpcoes.querySelectorAll(".multi-select-option")];
    if (!itens.length) return;
    const alvoIndice = Math.max(0, Math.min(indice, itens.length - 1));
    itens.forEach((item) => item.classList.remove("is-active"));
    itens[alvoIndice].classList.add("is-active");
    itens[alvoIndice].querySelector("input")?.focus();
  }

  gatilho.addEventListener("click", (evento) => {
    evento.stopPropagation();
    alternar();
  });
  gatilho.addEventListener("keydown", (evento) => {
    if (evento.key !== "ArrowDown") return;
    evento.preventDefault();
    if (!aberto()) abrir();
    setTimeout(() => moverFoco(0), 0);
  });

  busca.addEventListener("click", (evento) => evento.stopPropagation());
  busca.addEventListener("input", (evento) => {
    estado.busca = evento.target.value || "";
    desenharOpcoes();
  });
  busca.addEventListener("keydown", (evento) => {
    if (evento.key !== "ArrowDown") return;
    evento.preventDefault();
    moverFoco(0);
  });

  raiz
    .querySelector('[data-acao="visiveis"]')
    .addEventListener("click", (evento) => {
      evento.stopPropagation();
      estado.selecionados = ordenar([
        ...estado.selecionados,
        ...visiveis().map((opcao) => opcao.value),
      ]);
      aplicar();
    });
  raiz
    .querySelector('[data-acao="limpar"]')
    .addEventListener("click", (evento) => {
      evento.stopPropagation();
      estado.selecionados = [];
      aplicar();
    });

  listaOpcoes.addEventListener("change", (evento) => {
    const input = evento.target;
    if (!(input instanceof HTMLInputElement)) return;
    const valor = text(input.value);
    estado.selecionados = input.checked
      ? ordenar([...estado.selecionados, valor])
      : estado.selecionados.filter((item) => item !== valor);
    aplicar();
  });
  listaOpcoes.addEventListener("keydown", (evento) => {
    if (evento.key !== "ArrowDown" && evento.key !== "ArrowUp") return;
    const itens = [...listaOpcoes.querySelectorAll(".multi-select-option")];
    const atual = itens.indexOf(evento.target.closest(".multi-select-option"));
    evento.preventDefault();
    if (evento.key === "ArrowDown") moverFoco(atual + 1);
    else if (atual <= 0) busca.focus();
    else moverFoco(atual - 1);
  });

  const instancia = { raiz, gatilho, fechar, aberto };
  instancias.add(instancia);
  instalarFechamentoGlobal();
  desenhar();

  return {
    /*
      Troca as opções mantendo o que continua a existir: ao filtrar por edital,
      a lista de cargos encolhe, e cargos escolhidos que sumiram não podem
      continuar a filtrar — ficariam a esconder linhas sem aparecer na tela.

      A poda não dispara `onChange`: quem troca as opções é quem já está a
      redesenhar a tela, e avisá-lo de volta abriria um ciclo.
    */
    definirOpcoes(lista) {
      estado.opcoes = normalizarOpcoes(lista);
      const disponiveis = new Set(estado.opcoes.map((opcao) => opcao.value));
      estado.selecionados = estado.selecionados.filter((valor) =>
        disponiveis.has(valor),
      );
      select.innerHTML = estado.opcoes
        .map(
          (opcao) =>
            `<option value="${attr(opcao.value)}">${esc(opcao.label)}</option>`,
        )
        .join("");
      sincronizarNativo();
      desenhar();
    },
    obterSelecionados: () => [...estado.selecionados],
    definirSelecionados(valores) {
      const disponiveis = new Set(estado.opcoes.map((opcao) => opcao.value));
      estado.selecionados = ordenar(
        (valores || []).map(text).filter((valor) => disponiveis.has(valor)),
      );
      sincronizarNativo();
      desenhar();
    },
    fechar,
  };
}
