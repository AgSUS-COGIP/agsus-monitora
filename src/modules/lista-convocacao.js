/*
  Lista de convocação.

  Duas telas do mesmo assunto, e por isso um controlador só:

    - a aba "Lista de convocação" do formulário do edital, onde se escolhe o
      MODELO de regras e se informa quantas vagas imediatas cada vaga tem;
    - a aba "Lista de convocação" da página, que mostra a ordem de chamada que
      sai desses números.

  Vive dentro do controlador da lista de aprovados e lê os MESMOS candidatos em
  memória. É o que faz as duas abas andarem juntas sem sincronização nenhuma:
  mudar o status de alguém chama o `refresh` de lá, o array é substituído, e
  ambas as tabelas são redesenhadas. Lista inativa idem — a trava vem de
  `lista_ativa`, que é campo do candidato.

  O MODELO É PARTILHADO, E ISSO TEM DOIS LADOS

  Cinco dos oito editais da AgSUS que foram lidos têm regras idênticas. Apontar
  todos para o mesmo modelo faz uma correção valer para todos — e faz um
  descuido valer para todos também. Daí o editor mostrar, antes de salvar,
  quantos editais usam aquele modelo, e oferecer "Duplicar" como saída natural
  para quem quer mudar só o seu.

  O QUE SE GUARDA É A ENTRADA

  O edital dá percentuais, não quantidades. O formulário pede o percentual (no
  modelo) e o TOTAL de vagas imediatas (na vaga); o quadro por categoria é
  derivado na hora por `derivarQuadro`. Corrigir um percentual reordena as
  convocações de imediato, o que guardar o derivado não faria.

  O cálculo da ordem não está aqui: está em `lib/lista-convocacao-rules.js`, sem
  DOM nem rede, que é onde as regras ficam testáveis.
*/

import {
  canChangeCandidateStatus,
  canImportApprovedList,
} from "../lib/access-roles.js";
import { canEditCandidateStatus } from "../lib/lista-aprovados-rules.js";
import {
  ARREDONDAMENTOS,
  COTAS_MULTIPLAS,
  DISTRIBUICOES,
  MODELOS_DE_REFERENCIA,
  categoriasDeReserva,
  modeloDeReferencia,
  lerModalidade,
  lerTermos,
  modeloEmBranco,
  normalizarModelo,
  normalizarTexto,
  rotuloDaCategoria,
  siglaDaCategoria,
} from "../lib/modelo-de-convocacao.js";
import {
  derivarQuadro,
  montarListaDeConvocacao,
  normalizarQuadro,
  quadroVazio,
  resumirConvocacao,
  totalDoQuadro,
} from "../lib/lista-convocacao-rules.js";
import { paginateApprovedCandidates } from "../lib/lista-aprovados-rules.js";
import { ativarMultiSelectBusca } from "./multi-select-busca.js";

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

const DEFAULT_PAGE_SIZE = 50;
const SEM_STATUS = "__sem_status__";

function formatScore(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(
    number,
  );
}

/** Percentual como o edital o escreve: "25%", "2,5%" — nunca "25.00%". */
function formatarTaxa(valor) {
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(
    Number(valor) || 0,
  )}%`;
}

function statusClass(status) {
  if (status === "Contratado") return "success";
  if (status === "Desistente" || status === "Documentação Rejeitada")
    return "danger";
  if (status === "Migração") return "info";
  if (status === "Fim de Fila") return "warning";
  return "neutral";
}

/* "1ª", "2ª" — feminino, porque o que se numera é a vaga. */
const ordinalFeminino = (numero) => `${numero}ª`;

/** Resumo legível de um quadro: "AC 6 · PP 3 · PCD 1". */
function resumirQuadro(quadro, modelo) {
  return modelo.categorias
    .filter((categoria) => (quadro[categoria.id] || 0) > 0)
    .map((categoria) => `${categoria.sigla} ${quadro[categoria.id]}`)
    .join(" · ");
}

function lerInteiro(valor) {
  const numero = Math.floor(Number(valor));
  return Number.isFinite(numero) && numero > 0 ? numero : 0;
}

function lerTaxa(valor) {
  const numero = Number(String(valor).replace(",", "."));
  if (!Number.isFinite(numero) || numero <= 0) return 0;
  return Math.min(numero, 100);
}

/** Identificador estável a partir do rótulo, para categoria nova. */
function idPeloRotulo(rotulo) {
  return normalizarTexto(rotulo).replace(/ /g, "_") || "categoria";
}

export function createListaConvocacaoController(deps = {}) {
  const sb = deps.supabase || null;
  const toast = deps.toast || ((mensagem) => console.info(mensagem));
  const loader = deps.loader || (() => {});
  const getProfile = deps.getProfile || (() => null);
  const getCandidates = deps.getCandidates || (() => []);
  const getLists = deps.getLists || (() => []);
  const openStatusModal = deps.openStatusModal || (() => {});
  const onSaved = deps.onSaved || (async () => {});

  const state = {
    /** modelo_id → modelo normalizado, com `editais` (quantos o usam). */
    modelos: new Map(),
    /** edital_id → { proporcionalidade, modeloId, padraoImediata, vagas }. */
    configs: new Map(),
    abaDaPagina: "aprovados",
    abaDoModal: "arquivo",
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    /** Rascunho do formulário do edital, enquanto o modal está aberto. */
    formulario: null,
    /** Rascunho do modelo em edição, enquanto o editor está aberto. */
    editor: null,
  };

  const profile = () => getProfile() || null;
  const $ = (id) => document.getElementById(id);

  // ── Configuração vinda do banco ────────────────────────────────────────

  function modeloPorId(id) {
    return state.modelos.get(String(id || "")) || null;
  }

  /*
    Sem modelo escolhido vale um modelo em branco: só ampla concorrência,
    nenhuma reserva. As vagas que o gestor digitou continuam a existir e saem
    todas como ampla — dizer "cadastro de reserva" esconderia vagas que ele
    afirmou ter, e inventar categorias seria pior ainda.
  */
  function modeloDoEdital(editalId) {
    const config = state.configs.get(String(editalId));
    return modeloPorId(config?.modeloId) || modeloEmBranco();
  }

  /*
    A regra de precedência num sítio só:

      quadro manual da vaga  >  derivado do total da vaga  >  derivado do padrão
  */
  function obterConfiguracao(editalId, codigoVaga) {
    const config = state.configs.get(String(editalId));
    const modelo = modeloDoEdital(editalId);
    if (!config)
      return { proporcionalidade: true, quadro: quadroVazio(modelo), modelo };
    const vaga = config.vagas.get(text(codigoVaga));
    const quadro = vaga?.manual
      ? normalizarQuadro(vaga.quadro, modelo)
      : derivarQuadro(vaga ? vaga.imediatas : config.padraoImediata, modelo);
    return { proporcionalidade: config.proporcionalidade, quadro, modelo };
  }

  async function carregarConfiguracoes() {
    if (!sb) return;
    const [modelos, configs] = await Promise.all([
      sb.rpc("listar_modelos_convocacao"),
      sb.rpc("listar_configuracao_convocacao"),
    ]);
    if (modelos.error || configs.error) {
      /*
        Um aviso, não um erro que interrompa: sem configuração a aba mostra tudo
        como cadastro de reserva, e a lista de aprovados — a razão de a tela
        existir — continua inteira.
      */
      console.warn(
        "Configuração de convocação indisponível:",
        modelos.error || configs.error,
      );
      return;
    }

    state.modelos = new Map(
      (Array.isArray(modelos.data) ? modelos.data : []).map((linha) => [
        String(linha.modelo_id),
        {
          ...normalizarModelo({
            id: linha.modelo_id,
            nome: linha.nome,
            distribuicao: linha.distribuicao,
            cotaMultipla: linha.cota_multipla,
            categorias: (Array.isArray(linha.categorias)
              ? linha.categorias
              : []
            ).map((categoria) => ({
              ...categoria,
              termos: lerTermos(categoria.termos),
              posicoes: lerTermos(categoria.posicoes).map(Number),
              cascata: lerTermos(categoria.cascata),
            })),
          }),
          editais: Number(linha.editais) || 0,
        },
      ]),
    );

    state.configs = new Map(
      (Array.isArray(configs.data) ? configs.data : []).map((linha) => [
        String(linha.edital_id),
        {
          proporcionalidade: linha.proporcionalidade !== false,
          modeloId: linha.modelo_id ? String(linha.modelo_id) : "",
          padraoImediata: Number(linha.padrao_imediata) || 0,
          vagas: new Map(
            (Array.isArray(linha.vagas) ? linha.vagas : []).map((vaga) => [
              text(vaga.codigo_vaga),
              {
                cargo: text(vaga.cargo),
                imediatas: Number(vaga.imediatas) || 0,
                manual: vaga.manual === true,
                quadro:
                  vaga.quadro && typeof vaga.quadro === "object"
                    ? vaga.quadro
                    : {},
              },
            ]),
          ),
        },
      ]),
    );
  }

  // ── Abas ───────────────────────────────────────────────────────────────

  function mostrarAbaDaPagina(nome) {
    state.abaDaPagina = nome;
    document.querySelectorAll("[data-approved-tab]").forEach((botao) => {
      const ativo = botao.dataset.approvedTab === nome;
      botao.classList.toggle("active", ativo);
      botao.setAttribute("aria-selected", ativo ? "true" : "false");
    });
    $("approvedPanelAprovados")?.classList.toggle(
      "hidden",
      nome !== "aprovados",
    );
    $("approvedPanelConvocacao")?.classList.toggle(
      "hidden",
      nome !== "convocacao",
    );
    /*
      O contador e o botão de sub judice do cabeçalho falam da lista de
      aprovados. Deixá-los visíveis na outra aba prometeria uma ação que não
      pertence àquela tabela.
    */
    $("approvedHeadActions")?.classList.toggle("hidden", nome !== "aprovados");
    if (nome === "convocacao") renderPagina();
  }

  function mostrarAbaDoModal(nome) {
    state.abaDoModal = nome;
    document.querySelectorAll("[data-import-tab]").forEach((botao) => {
      const ativo = botao.dataset.importTab === nome;
      botao.classList.toggle("active", ativo);
      botao.setAttribute("aria-selected", ativo ? "true" : "false");
    });
    $("approvedImportPanelArquivo")?.classList.toggle(
      "hidden",
      nome !== "arquivo",
    );
    $("approvedImportPanelConvocacao")?.classList.toggle(
      "hidden",
      nome !== "convocacao",
    );
  }

  // ── Formulário do edital ───────────────────────────────────────────────

  /*
    As vagas do formulário saem da lista importada, não de um cadastro à parte:
    o código da vaga só existe porque algum candidato o declarou. Vaga guardada
    cujo código sumiu do XLSX novo continua na lista, marcada, para que o gestor
    decida apagá-la em vez de a perder em silêncio.
  */
  function vagasDoEdital(editalId) {
    const porCodigo = new Map();
    getCandidates()
      .filter((linha) => String(linha.edital_id) === String(editalId))
      .forEach((linha) => {
        const codigo = text(linha.codigo_vaga);
        if (!codigo) return;
        if (!porCodigo.has(codigo))
          porCodigo.set(codigo, {
            codigo,
            cargo: text(linha.cargo),
            na_lista: true,
            total: 0,
          });
        porCodigo.get(codigo).total += 1;
      });

    state.configs.get(String(editalId))?.vagas.forEach((guardada, codigo) => {
      if (porCodigo.has(codigo)) return;
      porCodigo.set(codigo, {
        codigo,
        cargo: guardada.cargo || "",
        na_lista: false,
        total: 0,
      });
    });

    return [...porCodigo.values()].sort(
      (a, b) =>
        a.cargo.localeCompare(b.cargo, "pt-BR") ||
        a.codigo.localeCompare(b.codigo, "pt-BR", { numeric: true }),
    );
  }

  function abrirFormulario(editalId) {
    const config = state.configs.get(String(editalId));
    state.editor = null;
    state.formulario = {
      editalId: String(editalId || ""),
      proporcionalidade: config ? config.proporcionalidade : true,
      modeloId: config?.modeloId || "",
      padraoImediata: config ? config.padraoImediata : 0,
      vagas: vagasDoEdital(editalId).map((vaga) => {
        const guardada = config?.vagas.get(vaga.codigo);
        return {
          ...vaga,
          imediatas: guardada
            ? guardada.imediatas
            : (config?.padraoImediata ?? 0),
          manual: guardada?.manual === true,
          quadro: { ...(guardada?.quadro || {}) },
        };
      }),
    };
    mostrarAbaDoModal("arquivo");
    renderFormulario();
  }

  function podeEditarFormulario() {
    return canImportApprovedList(profile());
  }

  /** O modelo escolhido no formulário, ou um em branco. */
  function modeloDoFormulario() {
    return modeloPorId(state.formulario?.modeloId) || modeloEmBranco();
  }

  /** Quadro que vale para a linha: o manual, ou o derivado do percentual. */
  function quadroDaVaga(vaga, modelo) {
    return vaga.manual
      ? normalizarQuadro(vaga.quadro, modelo)
      : derivarQuadro(vaga.imediatas, modelo);
  }

  function celulaDoQuadro(vaga, modelo) {
    if (vaga.manual) {
      return modelo.categorias
        .map(
          (categoria) =>
            `<label class="convocacao-quadro-campo">
              <span>${esc(categoria.sigla)}</span>
              <input type="number" min="0" step="1" inputmode="numeric"
                value="${esc(String(vaga.quadro[categoria.id] ?? 0))}"
                data-convocacao-vaga-cota="${attr(categoria.id)}"
                aria-label="${attr(`${categoria.rotulo} da vaga ${vaga.codigo}`)}" />
            </label>`,
        )
        .join("");
    }
    const resumo = resumirQuadro(quadroDaVaga(vaga, modelo), modelo);
    return resumo
      ? `<span class="convocacao-quadro-derivado">${esc(resumo)}</span>`
      : '<span class="convocacao-quadro-derivado vazio">Cadastro de reserva</span>';
  }

  function renderSeletorDeModelo() {
    const form = state.formulario;
    const select = $("convocacaoModelo");
    if (!select || !form) return;
    const modelos = [...state.modelos.values()].sort((a, b) =>
      a.nome.localeCompare(b.nome, "pt-BR"),
    );
    select.innerHTML = [
      '<option value="">— sem modelo —</option>',
      ...modelos.map(
        (modelo) =>
          `<option value="${attr(modelo.id)}"${modelo.id === form.modeloId ? " selected" : ""}>${esc(modelo.nome)}</option>`,
      ),
    ].join("");
    select.disabled = !podeEditarFormulario();

    const resumo = $("convocacaoModeloResumo");
    const modelo = modeloPorId(form.modeloId);
    if (resumo) {
      if (!modelo) {
        resumo.textContent =
          "Sem modelo escolhido: não há cota nenhuma, e as vagas imediatas saem todas como ampla concorrência.";
        resumo.classList.remove("compartilhado");
      } else {
        const reservas = categoriasDeReserva(modelo)
          .map(
            (categoria) =>
              `${categoria.sigla} ${formatarTaxa(categoria.percentual)}`,
          )
          .join(" · ");
        const usos =
          modelo.editais > 1
            ? ` · usado por ${modelo.editais} editais — editar muda todos`
            : "";
        resumo.textContent = `${reservas || "Sem reservas"}${usos}`;
        resumo.classList.toggle("compartilhado", modelo.editais > 1);
      }
    }

    const editar = $("convocacaoEditarModelo");
    if (editar) {
      editar.disabled = !modelo || !podeEditarFormulario();
      editar.classList.toggle("hidden", !podeEditarFormulario());
    }
    $("convocacaoNovoModelo")?.classList.toggle(
      "hidden",
      !podeEditarFormulario(),
    );
  }

  function renderFormulario() {
    const form = state.formulario;
    if (!form) return;
    const editavel = podeEditarFormulario();
    const modelo = modeloDoFormulario();
    /*
      Sem modelo escolhido o quadro tem uma coluna só — a ampla —, e oferecer a
      sobrescrita manual daria um único campo "AC" que não distribui nada. A
      caixa fica desligada, dizendo o que falta fazer antes.
    */
    const semReservas = categoriasDeReserva(modelo).length === 0;

    document
      .querySelectorAll('input[name="convocacaoTipo"]')
      .forEach((radio) => {
        radio.checked =
          (radio.value === "com") === Boolean(form.proporcionalidade);
        radio.disabled = !editavel;
      });

    renderSeletorDeModelo();
    renderEditorDeModelo();

    const padrao = $("convocacaoPadraoImediata");
    if (padrao) {
      padrao.value = String(form.padraoImediata ?? 0);
      padrao.disabled = !editavel;
    }

    const cabecalho = $("convocacaoVagasHead");
    if (cabecalho)
      cabecalho.innerHTML = `<tr>
        <th>Vaga</th>
        <th class="num">Imediatas</th>
        <th>Quadro de vagas</th>
        <th class="num">Manual</th>
      </tr>`;

    const corpo = $("convocacaoVagasRows");
    if (corpo)
      corpo.innerHTML = form.vagas.length
        ? form.vagas
            .map(
              (vaga) => `<tr data-convocacao-vaga="${attr(vaga.codigo)}">
          <td>
            <div class="approved-name">
              <strong>${esc(vaga.codigo)}</strong>
              <small>${esc(vaga.cargo || "Cargo não identificado")}${
                vaga.na_lista
                  ? ` · ${vaga.total} candidato${vaga.total === 1 ? "" : "s"}`
                  : " · fora da lista atual"
              }</small>
            </div>
          </td>
          <td class="num">
            <input type="number" min="0" step="1" inputmode="numeric"
              value="${esc(String(vaga.imediatas ?? 0))}"
              data-convocacao-imediatas
              aria-label="${attr(`Vagas imediatas da vaga ${vaga.codigo}`)}" />
          </td>
          <td class="convocacao-quadro-celula">${celulaDoQuadro(vaga, modelo)}</td>
          <td class="num">
            <input type="checkbox" data-convocacao-manual ${vaga.manual ? "checked" : ""}
              ${semReservas ? "disabled" : ""}
              title="${attr(
                semReservas
                  ? "Escolha um modelo de regras para poder distribuir as vagas por cota."
                  : "Editar à mão o quadro desta vaga",
              )}"
              aria-label="${attr(`Editar à mão o quadro da vaga ${vaga.codigo}`)}" />
          </td>
        </tr>`,
            )
            .join("")
        : `<tr><td colspan="4" class="approved-empty">Importe a lista de aprovados para que as vagas apareçam aqui.</td></tr>`;

    const resumo = $("convocacaoVagasResumo");
    if (resumo)
      resumo.textContent = `${form.vagas.length} vaga${form.vagas.length === 1 ? "" : "s"}`;

    // Sem proporcionalidade não há reserva a distribuir; o quadro sai da frente.
    $("convocacaoQuadro")?.classList.toggle("hidden", !form.proporcionalidade);

    /*
      As vagas só entram em cena depois de haver regra: o quadro de cada uma é
      DERIVADO do modelo, e pedir números antes disso mostra um resultado que
      vai mudar assim que o modelo for escolhido. Enquanto o editor está aberto
      elas também saem da frente — é uma tarefa de cada vez, e o quadro
      desenhado a partir de um modelo ainda por salvar seria mentira.
    */
    const editandoModelo = Boolean(state.editor);
    const semModelo = !modeloPorId(form.modeloId);
    const bloqueado = editandoModelo || semModelo;
    $("convocacaoVagasBloco")?.classList.toggle("hidden", bloqueado);
    const bloqueio = $("convocacaoVagasBloqueadas");
    if (bloqueio) {
      bloqueio.classList.toggle("hidden", !bloqueado);
      bloqueio.textContent = editandoModelo
        ? "Termine o modelo primeiro: salve ou cancele, e as vagas do edital voltam."
        : "Escolha um modelo de regras acima, ou crie um, para informar as vagas de cada uma.";
    }

    $("convocacaoVagasRows")
      ?.querySelectorAll("input")
      .forEach((input) => {
        if (!editavel) input.disabled = true;
      });

    const salvar = $("convocacaoSalvar");
    if (salvar) salvar.classList.toggle("hidden", !editavel);
    const nota = $("convocacaoPermissionNote");
    if (nota)
      nota.textContent = editavel
        ? "O modelo e as vagas valem para o edital e sobrevivem à substituição do XLSX."
        : "Sem permissão para configurar a convocação deste edital.";
    const aplicar = $("convocacaoAplicarPadrao");
    if (aplicar) aplicar.classList.toggle("hidden", !editavel);
  }

  // ── Editor do modelo ───────────────────────────────────────────────────

  function abrirEditor(modelo, { novo = false } = {}) {
    state.editor = {
      novo,
      // Cópia profunda: enquanto o editor está aberto, o modelo guardado
      // continua a valer para a tabela de vagas ao lado.
      modelo: normalizarModelo(JSON.parse(JSON.stringify(modelo))),
      editais: novo ? 0 : (modeloPorId(modelo.id)?.editais ?? 0),
    };
    if (novo) state.editor.modelo.id = "";
    renderFormulario();
  }

  function fecharEditor() {
    state.editor = null;
    // `renderFormulario` e não só o editor: o bloco das vagas volta com ele.
    renderFormulario();
  }

  /*
    A ajuda da opção escolhida fica VISÍVEL, e não num `title` que ninguém
    descobre: são decisões que o rótulo sozinho não explica, e o preço de errar
    é uma convocação inteira calculada de outro jeito. Trocar a opção redesenha
    o editor, então o texto acompanha.
  */
  function campoSelecao(id, lista, valor, rotulo) {
    const escolhida = lista.find((item) => item.id === valor) || lista[0];
    return `<label class="convocacao-editor-campo">
      <span>${esc(rotulo)}</span>
      <select data-convocacao-modelo="${attr(id)}">
        ${lista
          .map(
            (item) =>
              `<option value="${attr(item.id)}"${item.id === valor ? " selected" : ""}>${esc(item.rotulo)}</option>`,
          )
          .join("")}
      </select>
      <small class="convocacao-editor-ajuda">${esc(escolhida?.ajuda || "")}</small>
    </label>`;
  }

  function cartaoDaCategoria(categoria, modelo) {
    /*
      As marcadas vêm primeiro, na ordem da cascata; as outras a seguir, na
      ordem do modelo. Sem isto, a lista mostrava "2º PP" antes de "1º IND" — o
      número dizia a ordem e a disposição dizia outra coisa.
    */
    const outras = modelo.categorias
      .filter((item) => item.id !== categoria.id && !item.ampla)
      .sort((a, b) => {
        const posA = categoria.cascata.indexOf(a.id);
        const posB = categoria.cascata.indexOf(b.id);
        if (posA >= 0 && posB >= 0) return posA - posB;
        if (posA >= 0 || posB >= 0) return posA >= 0 ? -1 : 1;
        return a.ordem - b.ordem;
      });
    const posicaoFixa = modelo.distribuicao === "posicao_fixa";
    return `<div class="convocacao-categoria" data-convocacao-categoria="${attr(categoria.id)}">
      <div class="convocacao-categoria-topo">
        <input class="convocacao-categoria-rotulo" type="text" value="${attr(categoria.rotulo)}"
          data-convocacao-cat="rotulo" aria-label="Nome da categoria" />
        <input class="convocacao-categoria-sigla" type="text" maxlength="10" value="${attr(categoria.sigla)}"
          data-convocacao-cat="sigla" aria-label="Sigla" />
        ${
          categoria.ampla
            ? '<span class="convocacao-categoria-tag">recebe o resto</span>'
            : `<label class="convocacao-categoria-taxa">
                <input type="number" min="0" max="100" step="0.01" inputmode="decimal"
                  value="${esc(String(categoria.percentual))}" data-convocacao-cat="percentual"
                  aria-label="Percentual reservado" /><span>%</span>
              </label>
              <button class="btn icon red" type="button" data-convocacao-remover-categoria
                title="Remover categoria"><i class="fa-solid fa-trash"></i></button>`
        }
      </div>
      <label class="convocacao-editor-campo largo">
        <span>Reconhece por <small>termos separados por ponto e vírgula; termine em <code>*</code> para alcançar as flexões</small></span>
        <input type="text" value="${attr(categoria.termos.join("; "))}" data-convocacao-cat="termos" />
      </label>
      ${
        categoria.ampla
          ? ""
          : `<div class="convocacao-categoria-avancado">
        <label class="convocacao-editor-campo">
          <span>Arredondamento</span>
          <select data-convocacao-cat="arredondamento">
            ${ARREDONDAMENTOS.map(
              (item) =>
                `<option value="${attr(item.id)}"${item.id === categoria.arredondamento ? " selected" : ""}>${esc(item.rotulo)}</option>`,
            ).join("")}
          </select>
        </label>
        <label class="convocacao-editor-campo estreito">
          <span>Teto (%)</span>
          <input type="number" min="0" max="100" step="0.01" value="${esc(String(categoria.teto))}"
            data-convocacao-cat="teto" />
        </label>
        <label class="convocacao-editor-campo estreito">
          <span>Mín. de vagas <small>para esta reserva valer</small></span>
          <input type="number" min="0" step="1" value="${esc(String(categoria.minimo))}"
            data-convocacao-cat="minimo" />
        </label>
        ${
          posicaoFixa
            ? `<label class="convocacao-editor-campo estreito">
                <span>Posições</span>
                <input type="text" value="${attr(categoria.posicoes.join("; "))}"
                  data-convocacao-cat="posicoes" placeholder="3; 8" />
              </label>
              <label class="convocacao-editor-campo estreito">
                <span>A cada</span>
                <input type="number" min="0" step="1" value="${esc(String(categoria.intervalo))}"
                  data-convocacao-cat="intervalo" />
              </label>`
            : ""
        }
        <label class="convocacao-editor-campo larga">
          <span>Se ficar sem candidato, tenta nesta ordem</span>
          <span class="convocacao-cascata">
            ${
              outras.length
                ? outras
                    .map((item) => {
                      // A posição na cascata é o que decide quem vem primeiro;
                      // mostrá-la é a única forma de a ordem ser escolhida, e
                      // não apenas o resultado da ordem em que se clicou.
                      const posicao = categoria.cascata.indexOf(item.id);
                      return `<label class="convocacao-cascata-item${posicao >= 0 ? " marcada" : ""}">
                          <input type="checkbox" data-convocacao-cascata="${attr(item.id)}"
                            ${posicao >= 0 ? "checked" : ""} />
                          ${posicao >= 0 ? `<span class="convocacao-cascata-ordem">${posicao + 1}º</span>` : ""}
                          ${esc(item.sigla)}
                        </label>`;
                    })
                    .join("")
                : '<em class="convocacao-cascata-vazia">nenhuma outra reserva</em>'
            }
          </span>
          <small class="convocacao-editor-ajuda">A vaga não se divide: tenta a 1ª; só se ela também não tiver candidato é que passa à 2ª. A ampla concorrência é sempre o último destino, e não precisa de ser marcada.</small>
        </label>
        ${
          modelo.cotaMultipla === "acumula_com_acumulavel"
            ? `<label class="convocacao-editor-campo estreito">
                <span>Acumulável</span>
                <input type="checkbox" data-convocacao-cat="acumulavel" ${categoria.acumulavel ? "checked" : ""} />
              </label>`
            : ""
        }
      </div>`
      }
    </div>`;
  }

  function renderEditorDeModelo() {
    const area = $("convocacaoEditorModelo");
    if (!area) return;
    const editor = state.editor;
    area.classList.toggle("hidden", !editor);
    if (!editor) {
      area.innerHTML = "";
      return;
    }
    const modelo = editor.modelo;

    area.innerHTML = `
      <div class="convocacao-editor-head">
        ${
          /*
            Modelo novo começa de um dos conjuntos de regras já lidos, e não de
            uma folha em branco: são quatro formatos distintos entre os dezasseis
            editais da AgSUS analisados, e reescrever um deles à mão convida ao
            erro. Só aparece na criação — trocar a base de um modelo em uso
            apagaria o que já está configurado.
          */
          editor.novo
            ? `<div class="convocacao-editor-base">
                <span>Começar de</span>
                ${MODELOS_DE_REFERENCIA.map(
                  (referencia) =>
                    `<button class="btn outline" type="button" data-convocacao-base="${attr(referencia.id)}">${esc(referencia.nome)}</button>`,
                ).join("")}
                <button class="btn outline" type="button" data-convocacao-base="">Em branco</button>
              </div>`
            : ""
        }
        <label class="convocacao-editor-campo largo">
          <span>Nome do modelo</span>
          <input type="text" value="${attr(modelo.nome)}" data-convocacao-modelo="nome"
            placeholder="Ex.: Lei 15.142/2025 — 25/3/2 e 5% PCD" />
        </label>
        ${
          editor.editais > 1
            ? `<p class="convocacao-editor-aviso"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
                Este modelo é usado por ${editor.editais} editais. Salvar muda a convocação de todos —
                use <strong>Duplicar</strong> para mudar só este.</p>`
            : ""
        }
      </div>
      <div class="convocacao-editor-linha">
        ${campoSelecao("distribuicao", DISTRIBUICOES, modelo.distribuicao, "Como as vagas de cota entram na ordem")}
        ${campoSelecao("cotaMultipla", COTAS_MULTIPLAS, modelo.cotaMultipla, "Quem declarou duas cotas pode ocupar vaga das duas?")}
      </div>
      ${
        /*
          A regra de acumulação depende de haver uma categoria marcada como
          acumulável. Sem nenhuma, ela degrada em silêncio para "só a de maior
          percentual" — e o gestor ficaria a achar que configurou o 91/2026.
        */
        modelo.cotaMultipla === "acumula_com_acumulavel" &&
        !modelo.categorias.some((categoria) => categoria.acumulavel)
          ? `<p class="convocacao-editor-aviso"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
              Nenhuma categoria está marcada como <strong>acumulável</strong>. Enquanto isso, quem declarar
              duas cotas vai valer só a de maior percentual. Marque a caixa "Acumulável" na ficha da cota
              que pode somar-se às outras — nos editais da AgSUS, a de PCD.</p>`
          : ""
      }
      <div class="convocacao-categorias">
        ${modelo.categorias.map((categoria) => cartaoDaCategoria(categoria, modelo)).join("")}
      </div>
      <div class="convocacao-editor-acoes">
        <button id="convocacaoAdicionarCategoria" class="btn outline" type="button">
          <i class="fa-solid fa-plus" aria-hidden="true"></i> Categoria
        </button>
        <span class="approved-action-spacer"></span>
        ${
          editor.novo || !modelo.id
            ? ""
            : '<button id="convocacaoDuplicarModelo" class="btn secondary" type="button"><i class="fa-solid fa-copy"></i> Duplicar</button>'
        }
        ${
          editor.novo || !modelo.id
            ? ""
            : '<button id="convocacaoRemoverModelo" class="btn red" type="button"><i class="fa-solid fa-trash"></i> Remover</button>'
        }
        <button id="convocacaoCancelarModelo" class="btn secondary" type="button">Cancelar</button>
        <button id="convocacaoSalvarModelo" class="btn green" type="button">
          <i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> Salvar modelo
        </button>
      </div>
    `;
  }

  function categoriaDoEditor(elemento) {
    const cartao = elemento?.closest("[data-convocacao-categoria]");
    if (!cartao || !state.editor) return null;
    return (
      state.editor.modelo.categorias.find(
        (categoria) => categoria.id === cartao.dataset.convocacaoCategoria,
      ) || null
    );
  }

  function adicionarCategoria() {
    if (!state.editor) return;
    const modelo = state.editor.modelo;
    let base = "nova_reserva";
    let id = base;
    let sufixo = 2;
    while (modelo.categorias.some((categoria) => categoria.id === id)) {
      id = `${base}_${sufixo}`;
      sufixo += 1;
    }
    modelo.categorias.push({
      id,
      rotulo: "Nova reserva",
      sigla: "NR",
      ampla: false,
      acumulavel: false,
      percentual: 0,
      arredondamento: "meio_acima",
      teto: 0,
      minimo: 0,
      termos: [],
      posicoes: [],
      intervalo: 0,
      cascata: [],
      ordem: modelo.categorias.length,
    });
    renderEditorDeModelo();
  }

  async function salvarModelo() {
    const editor = state.editor;
    if (!editor || !sb) return;
    const modelo = editor.modelo;
    if (!text(modelo.nome)) return toast("Dê um nome ao modelo.", "warn");

    /*
      Os ids das categorias acompanham o rótulo só enquanto a categoria é nova.
      Renomear "Quilombola" depois de o modelo estar em uso não pode trocar o
      id: ele é a chave da cascata e do quadro manual já gravado.
    */
    modelo.categorias.forEach((categoria) => {
      if (categoria.id.startsWith("nova_reserva"))
        categoria.id = idPeloRotulo(categoria.rotulo);
    });

    const soma = categoriasDeReserva(modelo).reduce(
      (total, categoria) => total + categoria.percentual,
      0,
    );
    if (soma > 100)
      return toast(
        `Os percentuais de reserva somam ${formatarTaxa(soma)}. A soma não pode passar de 100%.`,
        "warn",
      );

    loader(true, "Lista de convocação", "Salvando o modelo de regras...", 60);
    const { data, error } = await sb.rpc("salvar_modelo_convocacao", {
      p_modelo: {
        id: modelo.id || null,
        nome: modelo.nome,
        distribuicao: modelo.distribuicao,
        cotaMultipla: modelo.cotaMultipla,
        categorias: modelo.categorias.map((categoria, indice) => ({
          id: categoria.id,
          rotulo: categoria.rotulo,
          sigla: categoria.sigla,
          ampla: categoria.ampla,
          acumulavel: categoria.acumulavel,
          percentual: categoria.percentual,
          arredondamento: categoria.arredondamento,
          teto: categoria.teto,
          minimo: categoria.minimo,
          termos: categoria.termos.join("; "),
          posicoes: categoria.posicoes.join("; "),
          intervalo: categoria.intervalo,
          cascata: categoria.cascata.join("; "),
          ordem: indice,
        })),
      },
    });
    loader(false);
    if (error)
      return toast(
        `Erro ao salvar o modelo: ${error.message || error}`,
        "error",
      );

    const novoId = String(data?.modelo_id || modelo.id || "");
    await carregarConfiguracoes();
    if (state.formulario) state.formulario.modeloId = novoId;
    state.editor = null;
    toast("Modelo salvo.");
    renderFormulario();
    renderPagina();
  }

  async function removerModelo() {
    const editor = state.editor;
    if (!editor?.modelo.id || !sb) return;
    const aviso =
      editor.editais > 0
        ? `Remover "${editor.modelo.nome}"? ${editor.editais} edital(is) ficarão sem regra de convocação.`
        : `Remover "${editor.modelo.nome}"?`;
    if (!window.confirm(aviso)) return;

    loader(true, "Lista de convocação", "Removendo o modelo...", 60);
    const { error } = await sb.rpc("remover_modelo_convocacao", {
      p_modelo_id: editor.modelo.id,
    });
    loader(false);
    if (error)
      return toast(
        `Erro ao remover o modelo: ${error.message || error}`,
        "error",
      );
    await carregarConfiguracoes();
    if (state.formulario?.modeloId === editor.modelo.id)
      state.formulario.modeloId = "";
    state.editor = null;
    toast("Modelo removido.");
    renderFormulario();
    renderPagina();
  }

  // ── Vagas do edital ────────────────────────────────────────────────────

  function vagaDaLinha(linha) {
    return state.formulario?.vagas.find(
      (item) => item.codigo === linha?.dataset.convocacaoVaga,
    );
  }

  /*
    Redesenha só a célula do quadro da linha tocada. Chamar `renderFormulario`
    inteiro a cada tecla digitada num campo de número tiraria o foco do campo, e
    quem estivesse a escrever "12" acabaria com "1".
  */
  function atualizarQuadroDaLinha(linha) {
    const vaga = vagaDaLinha(linha);
    const celula = linha?.querySelector(".convocacao-quadro-celula");
    if (!vaga || !celula || vaga.manual) return;
    celula.innerHTML = celulaDoQuadro(vaga, modeloDoFormulario());
  }

  function aplicarPadraoAsVagas() {
    const form = state.formulario;
    if (!form || !podeEditarFormulario()) return;
    form.vagas.forEach((vaga) => {
      vaga.imediatas = form.padraoImediata;
    });
    renderFormulario();
    toast("Total aplicado a todas as vagas. Falta salvar.");
  }

  async function salvarFormulario() {
    const form = state.formulario;
    if (!form || !sb) return;
    if (!podeEditarFormulario())
      return toast("Sem permissão para configurar a convocação.", "warn");

    loader(true, "Lista de convocação", "Salvando as vagas do edital...", 60);
    const { error } = await sb.rpc("salvar_configuracao_convocacao", {
      p_edital_id: form.editalId,
      p_proporcionalidade: form.proporcionalidade,
      p_modelo_id: form.modeloId || null,
      p_padrao_imediata: form.padraoImediata,
      p_vagas: form.vagas.map((vaga) => ({
        codigo_vaga: vaga.codigo,
        cargo: vaga.cargo || null,
        imediatas: vaga.imediatas,
        manual: vaga.manual,
        quadro: vaga.quadro || {},
      })),
    });
    loader(false);
    if (error)
      return toast(
        `Erro ao salvar a convocação: ${error.message || error}`,
        "error",
      );

    toast("Convocação salva.");
    await carregarConfiguracoes();
    renderPagina();
    await onSaved();
  }

  // ── Aba da página ──────────────────────────────────────────────────────

  const filtros = { edital: null, cargo: null, status: null };
  let filtrosProntos = false;

  const renderComFiltro = () => {
    state.page = 1;
    renderPagina();
  };

  function garantirFiltros() {
    if (filtrosProntos) return filtros;
    if (!$("convocacaoFilterEdital")) return filtros;
    filtrosProntos = true;
    filtros.edital = ativarMultiSelectBusca("convocacaoFilterEdital", {
      placeholder: "Todos os editais",
      onChange: () => {
        preencherFiltros();
        renderComFiltro();
      },
    });
    filtros.cargo = ativarMultiSelectBusca("convocacaoFilterCargo", {
      placeholder: "Todos os cargos",
      onChange: renderComFiltro,
    });
    filtros.status = ativarMultiSelectBusca("convocacaoFilterStatus", {
      placeholder: "Todos os status",
      onChange: renderComFiltro,
    });
    return filtros;
  }

  function preencherFiltros() {
    const controles = garantirFiltros();
    if (!controles.edital || !controles.cargo) return;
    const editais = [
      ...new Map(
        getLists().map((row) => [String(row.edital_id), row]),
      ).values(),
    ].sort(
      (a, b) =>
        text(a.edital).localeCompare(text(b.edital), "pt-BR") ||
        text(a.unidade).localeCompare(text(b.unidade), "pt-BR"),
    );
    controles.edital.definirOpcoes(
      editais.map((row) => ({
        value: String(row.edital_id),
        label: [text(row.edital) || "Edital", text(row.unidade)]
          .filter(Boolean)
          .join(" · "),
      })),
    );
    const escolhidos = controles.edital.obterSelecionados();
    const noEscopo = escolhidos.length
      ? getCandidates().filter((row) =>
          escolhidos.includes(String(row.edital_id)),
        )
      : getCandidates();
    controles.cargo.definirOpcoes(
      [...new Set(noEscopo.map((row) => text(row.cargo)).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b, "pt-BR"),
      ),
    );
  }

  /*
    Edital e cargo recortam ANTES do cálculo: cada vaga é uma convocação
    independente, então tirar as outras do caminho não mexe na ordem de nenhuma.
    Status é filtro de exibição e entra DEPOIS — recortar por ele antes tiraria
    da fila o desistente que o cálculo precisa de ver para saltar.
  */
  function gruposVisiveis() {
    const controles = garantirFiltros();
    const editais = controles.edital?.obterSelecionados() || [];
    const cargos = controles.cargo?.obterSelecionados() || [];
    const candidatos = getCandidates().filter((row) => {
      if (editais.length && !editais.includes(String(row.edital_id)))
        return false;
      if (cargos.length && !cargos.includes(text(row.cargo))) return false;
      return true;
    });
    return montarListaDeConvocacao(candidatos, obterConfiguracao);
  }

  /*
    Devolve um teste de status já resolvido. A lista de escolhas é lida uma vez
    por desenho, e não por linha: `obterSelecionados` copia o array, e copiá-lo
    milhares de vezes para responder sempre o mesmo era o preço de um `filter`
    escrito à toa.
  */
  function filtroDeStatus() {
    const escolhidos = garantirFiltros().status?.obterSelecionados() || [];
    if (!escolhidos.length) return () => true;
    return (candidato) => {
      const status = text(candidato?.status);
      return escolhidos.some((escolha) =>
        escolha === SEM_STATUS ? !status : escolha === status,
      );
    };
  }

  /*
    A tabela é plana para poder paginar; o cabeçalho de cada vaga é reinserido
    no desenho, sempre que o grupo muda dentro da página. Paginar por grupo
    deixaria uma página com 3 linhas e outra com 400.
  */
  function linhasPlanas(grupos) {
    const passaNoStatus = filtroDeStatus();
    const linhas = [];
    grupos.forEach((grupo) => {
      [...grupo.linhas, ...grupo.foraDaFila].forEach((linha) => {
        if (!passaNoStatus(linha.candidato)) return;
        linhas.push({ grupo, linha });
      });
    });
    return linhas;
  }

  function rotuloDaVaga(grupo, linha) {
    if (!linha.posicao)
      return '<span class="convocacao-vaga fora">Fora da fila</span>';
    if (!grupo.proporcionalidade) {
      return linha.imediata
        ? `<span class="convocacao-vaga imediata">${ordinalFeminino(linha.posicao)} · Vaga imediata</span>`
        : '<span class="convocacao-vaga reserva">Cadastro de reserva</span>';
    }
    const categoria = esc(rotuloDaCategoria(grupo.modelo, linha.categoria));
    const reversao = linha.categoriaReservada
      ? `<small class="convocacao-reversao">Vaga de ${esc(rotuloDaCategoria(grupo.modelo, linha.categoriaReservada))} sem candidato</small>`
      : "";
    return linha.imediata
      ? `<span class="convocacao-vaga imediata">${ordinalFeminino(linha.posicao)} · ${categoria}</span>${reversao}`
      : `<span class="convocacao-vaga reserva">Reserva · ${categoria}</span>${reversao}`;
  }

  /*
    A coluna mostra o que a pessoa DECLAROU, e não a reserva em que acabou por
    concorrer: são coisas diferentes desde que a regra de cota múltipla entrou
    no cálculo. Quem declarou duas vê as duas siglas, com a que vale em
    destaque — sem isso, a lista pareceria ter perdido uma das cotas da pessoa.
  */
  function rotuloDaModalidade(candidato, linha, modelo) {
    const declarada = text(candidato.modalidade);
    if (!declarada)
      return '<span class="convocacao-modalidade vazia">Não declarada</span>';
    const reconhecida = lerModalidade(declarada, modelo).reconhecida;
    const reservas = linha.reservas || [];
    const efetivas = linha.reservasEfetivas || [];
    const siglas = reservas
      .map((id) =>
        efetivas.includes(id) && reservas.length > 1
          ? `<strong>${esc(siglaDaCategoria(modelo, id))}</strong>`
          : esc(siglaDaCategoria(modelo, id)),
      )
      .join(" · ");
    const multipla =
      reservas.length > 1 && efetivas.length < reservas.length
        ? `<small class="convocacao-multipla">Concorre só na de maior percentual</small>`
        : "";
    return `<div class="convocacao-modalidade">
      <span>${esc(declarada)}</span>
      ${siglas ? `<small class="convocacao-siglas">${siglas}</small>` : ""}
      ${multipla}
      ${reconhecida ? "" : '<small class="convocacao-alerta"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> Termo não reconhecido — disputa só a ampla</small>'}
    </div>`;
  }

  function renderKpis(grupos) {
    const resumo = resumirConvocacao(grupos);
    const valores = {
      convocacaoKpiVagas: resumo.vagas,
      convocacaoKpiImediatas: resumo.imediatas,
      convocacaoKpiConvocaveis: resumo.convocaveis,
      convocacaoKpiReserva: resumo.reserva,
      convocacaoKpiForaDaFila: resumo.foraDaFila,
    };
    Object.entries(valores).forEach(([id, valor]) => {
      const elemento = $(id);
      if (elemento) elemento.textContent = String(valor);
    });
  }

  function renderPaginacao({ total, page, totalPages, from, to }) {
    const barra = $("convocacaoPaginacao");
    if (!barra) return;
    barra.hidden = totalPages <= 1;
    if (barra.hidden) return;
    const info = $("convocacaoPaginacaoInfo");
    if (info) info.textContent = `Mostrando ${from}–${to} de ${total} linhas`;
    const atual = $("convocacaoPaginaAtual");
    if (atual) atual.textContent = `Página ${page} de ${totalPages}`;
    const anterior = $("convocacaoPagePrev");
    if (anterior) anterior.disabled = page <= 1;
    const proxima = $("convocacaoPageNext");
    if (proxima) proxima.disabled = page >= totalPages;
    const tamanho = $("convocacaoPageSize");
    if (tamanho && Number(tamanho.value) !== state.pageSize)
      tamanho.value = String(state.pageSize);
  }

  /*
    O bloco por vaga: o texto descritivo ("Enfermeiro · UBS Móvel Itatiaia/RJ —
    4 vagas imediatas…") vem SEMPRE antes do cabeçalho de colunas daquela vaga,
    e não misturado como uma linha entre candidatos. Cada vaga tem o seu
    próprio <table>, com o seu próprio <thead> — é isso que o coloca antes do
    cabeçalho, em vez de depois dele.
  */
  function cabecalhoDoGrupo(grupo) {
    const quadro = grupo.proporcionalidade
      ? resumirQuadro(grupo.quadro, grupo.modelo)
      : "";
    const imediatas = grupo.totalImediatas
      ? `${grupo.totalImediatas} vaga${grupo.totalImediatas === 1 ? "" : "s"} imediata${grupo.totalImediatas === 1 ? "" : "s"}${quadro ? ` (${quadro})` : ""}`
      : "Sem vaga imediata — cadastro de reserva";
    const tipo = grupo.proporcionalidade ? "" : " · sem proporcionalidade";
    return `<div class="convocacao-grupo">
      <div class="convocacao-grupo-copy">
        <strong>${esc(grupo.codigoVaga || "Sem código de vaga")} · ${esc(grupo.cargo || "Cargo não informado")}</strong>
        <small>${esc(grupo.edital || "Edital")}${grupo.unidade ? ` · ${esc(grupo.unidade)}` : ""} — ${esc(imediatas)}${esc(tipo)}</small>
      </div>
    </div>`;
  }

  function linhaDoCandidato(grupo, linha) {
    const candidato = linha.candidato;
    const status = text(candidato.status);
    const podeStatus = canEditCandidateStatus(profile(), candidato);
    const inativa = !candidato.lista_ativa;
    const acao = podeStatus
      ? `<button class="btn icon outline" type="button" data-convocacao-action="status" data-candidate-id="${attr(candidato.candidato_id)}" title="Alterar status"><i class="fa-solid fa-pen"></i></button>`
      : inativa && canChangeCandidateStatus(profile())
        ? `<button class="btn icon outline" type="button" disabled title="Lista inativa"><i class="fa-solid fa-lock"></i></button>`
        : `<span class="approved-no-action">—</span>`;
    return `<tr class="${linha.imediata ? "convocacao-linha-imediata" : ""}${linha.posicao ? "" : " convocacao-linha-fora"}">
      <td class="num">${linha.posicao ?? "—"}</td>
      <td class="num">${candidato.classificacao ?? "—"}</td>
      <td>${rotuloDaVaga(grupo, linha)}</td>
      <td><div class="approved-name"><strong>${esc(candidato.nome)}</strong>${candidato.sub_judice ? '<span class="approved-tag subjudice">SUB JUDICE</span>' : ""}<small>${esc(candidato.edital || "")}${inativa ? " · Lista inativa" : ""}</small></div></td>
      <td class="num">${esc(formatScore(candidato.nota))}</td>
      <td>${rotuloDaModalidade(candidato, linha, grupo.modelo)}</td>
      <td><span class="approved-status ${statusClass(status)}">${esc(status || "Sem status")}</span></td>
      <td class="approved-actions">${acao}</td>
    </tr>`;
  }

  /*
    Ordem e Classificação geral são coisas diferentes, e mostrar as duas lado a
    lado é o ponto: Ordem é a posição que o cálculo de convocação deu; Classi-
    ficação geral é o número que veio pronto no XLSX importado, antes de
    qualquer cota entrar em jogo. Uma pessoa pode ter Ordem 2 e Classificação 5
    porque foi chamada mais cedo por conta de uma reserva.
  */
  function tabelaDoGrupo(grupo, linhas) {
    return `${cabecalhoDoGrupo(grupo)}
    <table class="approved-table convocacao-table">
      <thead>
        <tr>
          <th class="num">Ordem</th>
          <th class="num">Classificação geral</th>
          <th>Vaga da convocação</th>
          <th>Nome</th>
          <th class="num">Nota</th>
          <th>Modalidade declarada</th>
          <th>Status</th>
          <th style="text-align:center">Ações</th>
        </tr>
      </thead>
      <tbody>
        ${linhas.map((linha) => linhaDoCandidato(grupo, linha)).join("")}
      </tbody>
    </table>`;
  }

  function renderPagina() {
    const corpo = $("convocacaoRows");
    if (!corpo) return;
    preencherFiltros();
    const grupos = gruposVisiveis();
    renderKpis(grupos);

    const todas = linhasPlanas(grupos);
    const pagina = paginateApprovedCandidates(
      todas,
      state.page,
      state.pageSize,
    );
    state.page = pagina.page;
    renderPaginacao(pagina);

    if (!pagina.rows.length) {
      corpo.innerHTML = `<p class="approved-empty">Nenhum candidato encontrado para os filtros selecionados.</p>`;
      return;
    }

    /*
      As linhas da página já vêm agrupadas por vaga — `linhasPlanas` percorre
      um grupo de cada vez —, então basta juntar as consecutivas do mesmo
      grupo. Cada bloco vira um <table> com o seu próprio cabeçalho.
    */
    const blocos = [];
    pagina.rows.forEach(({ grupo, linha }) => {
      const ultimo = blocos.at(-1);
      if (ultimo && ultimo.grupo === grupo) ultimo.linhas.push(linha);
      else blocos.push({ grupo, linhas: [linha] });
    });

    corpo.innerHTML = blocos
      .map(({ grupo, linhas }) => tabelaDoGrupo(grupo, linhas))
      .join("");
  }

  // ── Ligações ───────────────────────────────────────────────────────────

  function ligarEditor() {
    const area = $("convocacaoEditorModelo");
    if (!area) return;

    area.addEventListener("input", (evento) => {
      const editor = state.editor;
      if (!editor) return;
      const campoModelo = evento.target.closest("[data-convocacao-modelo]");
      if (campoModelo) {
        // Só restam campos de texto no nível do modelo: nome e as escolhas.
        editor.modelo[campoModelo.dataset.convocacaoModelo] = campoModelo.value;
        return;
      }
      const categoria = categoriaDoEditor(evento.target);
      const campoCategoria = evento.target.closest("[data-convocacao-cat]");
      if (!categoria || !campoCategoria) return;
      const chave = campoCategoria.dataset.convocacaoCat;
      if (chave === "percentual" || chave === "teto")
        categoria[chave] = lerTaxa(campoCategoria.value);
      else if (chave === "intervalo" || chave === "minimo")
        categoria[chave] = lerInteiro(campoCategoria.value);
      else if (chave === "termos")
        categoria.termos = lerTermos(campoCategoria.value);
      else if (chave === "posicoes")
        categoria.posicoes = lerTermos(campoCategoria.value)
          .map(lerInteiro)
          .filter(Boolean)
          .sort((a, b) => a - b);
      else categoria[chave] = campoCategoria.value;
    });

    /*
      `change` e não `input` para o que muda a FORMA do editor: trocar a
      distribuição faz aparecer ou sumir os campos de posição, e redesenhar a
      cada tecla num campo de texto tiraria o foco de quem escreve.
    */
    area.addEventListener("change", (evento) => {
      const editor = state.editor;
      if (!editor) return;
      const campoModelo = evento.target.closest("[data-convocacao-modelo]");
      if (campoModelo && campoModelo.tagName === "SELECT") {
        editor.modelo[campoModelo.dataset.convocacaoModelo] = campoModelo.value;
        renderEditorDeModelo();
        return;
      }
      const categoria = categoriaDoEditor(evento.target);
      if (!categoria) return;
      const cascata = evento.target.closest("[data-convocacao-cascata]");
      if (cascata) {
        const destino = cascata.dataset.convocacaoCascata;
        categoria.cascata = cascata.checked
          ? [...categoria.cascata.filter((id) => id !== destino), destino]
          : categoria.cascata.filter((id) => id !== destino);
        renderEditorDeModelo();
        return;
      }
      const campoCategoria = evento.target.closest("[data-convocacao-cat]");
      if (!campoCategoria) return;
      if (campoCategoria.dataset.convocacaoCat === "acumulavel") {
        categoria.acumulavel = campoCategoria.checked;
        // Redesenha para o aviso de "nenhuma categoria acumulável" sair assim
        // que a primeira for marcada.
        renderEditorDeModelo();
      } else if (campoCategoria.tagName === "SELECT")
        categoria[campoCategoria.dataset.convocacaoCat] = campoCategoria.value;
    });

    area.addEventListener("click", (evento) => {
      const editor = state.editor;
      if (!editor) return;
      if (evento.target.closest("[data-convocacao-remover-categoria]")) {
        const categoria = categoriaDoEditor(evento.target);
        if (!categoria) return;
        editor.modelo.categorias = editor.modelo.categorias.filter(
          (item) => item !== categoria,
        );
        // A cascata das outras não pode apontar para o que deixou de existir.
        editor.modelo.categorias.forEach((item) => {
          item.cascata = item.cascata.filter((id) => id !== categoria.id);
        });
        renderEditorDeModelo();
        return;
      }
      const base = evento.target.closest("[data-convocacao-base]");
      if (base) {
        const escolhido = base.dataset.convocacaoBase;
        const partida = escolhido
          ? modeloDeReferencia(escolhido)
          : modeloEmBranco();
        // O nome já digitado sobrevive à troca de base: é do edital, não da regra.
        return abrirEditor(
          { ...partida, id: "", nome: editor.modelo.nome },
          { novo: true },
        );
      }
      if (evento.target.closest("#convocacaoAdicionarCategoria"))
        return adicionarCategoria();
      if (evento.target.closest("#convocacaoCancelarModelo"))
        return fecharEditor();
      if (evento.target.closest("#convocacaoSalvarModelo"))
        return void salvarModelo();
      if (evento.target.closest("#convocacaoRemoverModelo"))
        return void removerModelo();
      if (evento.target.closest("#convocacaoDuplicarModelo")) {
        abrirEditor(
          { ...editor.modelo, id: "", nome: `${editor.modelo.nome} (cópia)` },
          { novo: true },
        );
        toast("Cópia aberta. Salve para criar o modelo novo.");
      }
    });
  }

  function bind() {
    garantirFiltros();

    document.querySelectorAll("[data-approved-tab]").forEach((botao) => {
      botao.addEventListener("click", () =>
        mostrarAbaDaPagina(botao.dataset.approvedTab),
      );
    });
    document.querySelectorAll("[data-import-tab]").forEach((botao) => {
      botao.addEventListener("click", () =>
        mostrarAbaDoModal(botao.dataset.importTab),
      );
    });

    document
      .querySelectorAll('input[name="convocacaoTipo"]')
      .forEach((radio) => {
        radio.addEventListener("change", () => {
          if (!state.formulario) return;
          state.formulario.proporcionalidade = radio.value === "com";
          renderFormulario();
        });
      });

    $("convocacaoModelo")?.addEventListener("change", (evento) => {
      if (!state.formulario) return;
      state.formulario.modeloId = evento.target.value;
      state.editor = null;
      renderFormulario();
    });

    $("convocacaoEditarModelo")?.addEventListener("click", () => {
      const modelo = modeloPorId(state.formulario?.modeloId);
      if (modelo) abrirEditor(modelo);
    });

    $("convocacaoNovoModelo")?.addEventListener("click", () => {
      /*
        Abre já no formato mais comum — sete dos dezasseis editais lidos usam
        este —, e o editor oferece os outros três logo acima do nome.
      */
      abrirEditor(modeloDeReferencia("lei-15142-2025"), { novo: true });
    });

    ligarEditor();

    $("convocacaoPadraoImediata")?.addEventListener("input", (evento) => {
      if (!state.formulario) return;
      state.formulario.padraoImediata = lerInteiro(evento.target.value);
    });

    $("convocacaoVagasRows")?.addEventListener("input", (evento) => {
      if (!state.formulario) return;
      const linha = evento.target.closest("[data-convocacao-vaga]");
      const vaga = vagaDaLinha(linha);
      if (!vaga) return;

      if (evento.target.matches("[data-convocacao-imediatas]")) {
        vaga.imediatas = lerInteiro(evento.target.value);
        atualizarQuadroDaLinha(linha);
        return;
      }
      const cota = evento.target.closest("[data-convocacao-vaga-cota]");
      if (cota)
        vaga.quadro[cota.dataset.convocacaoVagaCota] = lerInteiro(cota.value);
    });

    /*
      A troca de manual redesenha a linha inteira, porque a célula passa de
      texto para um campo por categoria. Ao ligar, o quadro derivado é copiado
      para os campos: começar do zero faria a vaga perder as vagas que já tinha.
    */
    $("convocacaoVagasRows")?.addEventListener("change", (evento) => {
      if (!evento.target.matches("[data-convocacao-manual]")) return;
      const linha = evento.target.closest("[data-convocacao-vaga]");
      const vaga = vagaDaLinha(linha);
      if (!vaga) return;
      const ligando = evento.target.checked;
      if (ligando && totalDoQuadro(vaga.quadro) === 0)
        vaga.quadro = quadroDaVaga(vaga, modeloDoFormulario());
      vaga.manual = ligando;
      renderFormulario();
    });

    $("convocacaoAplicarPadrao")?.addEventListener(
      "click",
      aplicarPadraoAsVagas,
    );
    $("convocacaoSalvar")?.addEventListener(
      "click",
      () => void salvarFormulario(),
    );

    $("convocacaoRows")?.addEventListener("click", (evento) => {
      const botao = evento.target.closest('[data-convocacao-action="status"]');
      if (!botao) return;
      openStatusModal(botao.dataset.candidateId);
    });

    const irParaPagina = (destino) => {
      const alvo = paginateApprovedCandidates(
        linhasPlanas(gruposVisiveis()),
        destino,
        state.pageSize,
      ).page;
      if (alvo === state.page) return;
      state.page = alvo;
      renderPagina();
      $("convocacaoRows")
        ?.closest(".table-wrap")
        ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    };
    $("convocacaoPagePrev")?.addEventListener("click", () =>
      irParaPagina(state.page - 1),
    );
    $("convocacaoPageNext")?.addEventListener("click", () =>
      irParaPagina(state.page + 1),
    );
    $("convocacaoPageSize")?.addEventListener("change", (evento) => {
      const valor = Number(evento.target.value);
      if (!Number.isFinite(valor) || valor <= 0) return;
      state.pageSize = valor;
      state.page = 1;
      renderPagina();
    });
  }

  bind();

  return {
    state,
    carregarConfiguracoes,
    abrirFormulario,
    render: renderPagina,
    mostrarAbaDaPagina,
    mostrarAbaDoModal,
    obterConfiguracao,
    modeloDoEdital,
  };
}
