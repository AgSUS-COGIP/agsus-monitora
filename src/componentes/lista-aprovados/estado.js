/*
  Estado da Lista de Aprovados, fora do React: os candidatos, as listas e a
  configuração de convocação que o banco devolve, qual modal está aberto, e as
  ações que escrevem no banco. Os componentes leem com `useSyncExternalStore`;
  o legado chega aqui pelo controlador de `lista-aprovados.jsx`
  (`window.aprovadosController`). Este arquivo não importa React.

  As duas abas da página — aprovados e convocação — leem os MESMOS candidatos.
  É o que as faz andarem juntas sem sincronização nenhuma: mudar o status de
  alguém recarrega o estado, o array é substituído, e as duas tabelas são
  redesenhadas. Lista inativa idem — a trava vem de `lista_ativa`, que é campo
  do candidato.

  O que é só da tela (filtros, página, aba, rascunho do formulário) fica nos
  componentes.
*/

import { readApprovedWorkbook } from "../../lib/aprovados-import.js";
import {
  canImportApprovedList,
  canManageSubJudice,
  canReplaceApprovedList,
  canViewCore,
} from "../../lib/access-roles.js";
import {
  canEditCandidateStatus,
  canEditSubJudice,
  nomeDeArquivoSeguro,
  statusNeedsMatricula,
} from "../../lib/lista-aprovados-rules.js";
import {
  argumentosDaConfiguracao,
  fixarIdsNovos,
  formatarTaxa,
  lerConfiguracoesDoBanco,
  lerModelosDoBanco,
  modeloParaSalvar,
  somaDasReservas,
} from "../../lib/configuracao-de-convocacao.js";
import { PLANILHAS } from "../../lib/planilhas.js";

const BUCKET = PLANILHAS.listaAprovadosImportada.bucket;
const CANDIDATES_PAGE_SIZE = 1000;
const LIMITE_DO_XLSX = 10 * 1024 * 1024;
const TIPO_DO_XLSX =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const text = (value) => String(value ?? "").trim();
const mensagemDe = (erro) => erro?.message || erro;

const ESTADO_INICIAL = Object.freeze({
  candidatos: Object.freeze([]),
  listas: Object.freeze([]),
  carregado: false,
  /** modelo_id → modelo normalizado, com `editais` (quantos o usam). */
  modelos: new Map(),
  /** edital_id → { proporcionalidade, modeloId, padraoImediata, vagas }. */
  configs: new Map(),
  perfil: null,
  /*
    O modal aberto, ou `null`. `abertura` muda a cada abertura: o componente
    usa-a como `key`, e reabrir o mesmo modal começa de um rascunho limpo.
      { tipo: "status", candidatoId }
      { tipo: "sub-judice" }
      { tipo: "listas", editalId, rotulo }
  */
  modal: null,
});

function uuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function baixarNoNavegador(arquivo, nome) {
  const url = URL.createObjectURL(arquivo);
  const ancora = document.createElement("a");
  ancora.href = url;
  ancora.download = nome;
  ancora.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function criarEstadoDaListaDeAprovados({
  supabase = null,
  toast = (mensagem) => console.info(mensagem),
  loader = () => {},
  getProfile = () => null,
  confirmar = (mensagem) => window.confirm(mensagem),
  baixar = baixarNoNavegador,
  lerPlanilha = readApprovedWorkbook,
} = {}) {
  let estado = ESTADO_INICIAL;
  let aberturas = 0;
  const ouvintes = new Set();

  function publicar(mudancas) {
    estado = { ...estado, ...mudancas };
    for (const ouvinte of ouvintes) ouvinte();
  }

  const perfil = () => getProfile() || null;
  const candidatoPorId = (id) =>
    estado.candidatos.find((row) => String(row.candidato_id) === String(id));
  const listaDoEdital = (editalId) =>
    estado.listas.find((row) => String(row.edital_id) === String(editalId));

  function avisar(nome, detail) {
    document.dispatchEvent(new CustomEvent(nome, { detail }));
  }

  // ── Leitura ────────────────────────────────────────────────────────────

  async function buscarTodosOsCandidatos() {
    const rows = [];
    let from = 0;
    while (true) {
      const result = await supabase
        .rpc("listar_candidatos_aprovados")
        .range(from, from + CANDIDATES_PAGE_SIZE - 1);
      if (result.error) return { data: rows, error: result.error };
      const batch = Array.isArray(result.data) ? result.data : [];
      rows.push(...batch);
      if (batch.length < CANDIDATES_PAGE_SIZE) break;
      from += CANDIDATES_PAGE_SIZE;
    }
    return { data: rows, error: null };
  }

  async function lerConfiguracoes() {
    const [modelos, configs] = await Promise.all([
      supabase.rpc("listar_modelos_convocacao"),
      supabase.rpc("listar_configuracao_convocacao"),
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
      return null;
    }
    return {
      modelos: lerModelosDoBanco(modelos.data),
      configs: lerConfiguracoesDoBanco(configs.data),
    };
  }

  async function carregarConfiguracoes() {
    if (!supabase) return;
    const lidas = await lerConfiguracoes();
    if (lidas) publicar(lidas);
  }

  async function carregar({ comLoader = true } = {}) {
    if (!supabase) return false;
    if (comLoader)
      loader(true, "Lista de aprovados", "Carregando candidatos...", 55);
    let resultados;
    try {
      /*
        A configuração de convocação vai no mesmo lote: ela é lida a cada desenho
        da aba e pedi-la à parte adiaria a primeira ordem de convocação por uma
        ida à rede, com a tabela já na tela a dizer "cadastro de reserva".
      */
      resultados = await Promise.all([
        supabase.rpc("listar_listas_aprovados"),
        canViewCore(perfil())
          ? buscarTodosOsCandidatos()
          : Promise.resolve({ data: [], error: null }),
        lerConfiguracoes(),
      ]);
    } catch (erro) {
      resultados = [{ error: erro }, { error: null }, null];
    } finally {
      if (comLoader) loader(false);
    }
    const [listas, candidatos, configuracao] = resultados;
    const error = listas.error || candidatos.error;
    if (error) {
      toast(
        `Erro ao carregar lista de aprovados: ${mensagemDe(error)}`,
        "error",
      );
      return false;
    }
    publicar({
      listas: Array.isArray(listas.data) ? listas.data : [],
      candidatos: Array.isArray(candidatos.data) ? candidatos.data : [],
      carregado: true,
      perfil: perfil(),
      ...(configuracao || {}),
    });
    avisar("agsus:listas-aprovados-loaded", { lists: estado.listas });
    return true;
  }

  /*
    Chamada a cada abertura da página. As permissões dependem do perfil, que o
    legado troca sem avisar; republicá-lo aqui redesenha a tela com o de agora.
  */
  async function garantirCarregado() {
    if (!estado.carregado) return carregar();
    publicar({ perfil: perfil() });
    return true;
  }

  // ── Modais ─────────────────────────────────────────────────────────────

  function abrir(modal) {
    aberturas += 1;
    publicar({ modal: { ...modal, abertura: aberturas }, perfil: perfil() });
  }

  function fecharModal() {
    if (estado.modal) publicar({ modal: null });
  }

  function abrirStatus(candidatoId) {
    const candidato = candidatoPorId(candidatoId);
    if (!candidato || !canEditCandidateStatus(perfil(), candidato)) {
      toast(
        candidato?.lista_ativa === false
          ? "A lista está inativa."
          : "Sem permissão para alterar o status.",
        "warn",
      );
      return;
    }
    abrir({ tipo: "status", candidatoId: String(candidatoId) });
  }

  function abrirSubJudice() {
    if (!canManageSubJudice(perfil())) {
      toast("Sem permissão para incluir sub judice.", "warn");
      return;
    }
    if (!estado.listas.some((item) => item.ativo)) {
      toast("Não há lista ativa para receber sub judice.", "warn");
      return;
    }
    abrir({ tipo: "sub-judice" });
  }

  async function abrirListasDoEdital(editalId, rotulo = "") {
    if (!canImportApprovedList(perfil())) {
      toast("Sem permissão para gerir lista de aprovados.", "warn");
      return;
    }
    if (!estado.carregado) await carregar({ comLoader: false });
    abrir({ tipo: "listas", editalId: String(editalId || ""), rotulo });
  }

  // ── Candidatos ─────────────────────────────────────────────────────────

  async function salvarStatus(candidatoId, campos) {
    const candidato = candidatoPorId(candidatoId);
    if (!candidato || !canEditCandidateStatus(perfil(), candidato))
      return false;
    const status = text(campos.status);
    const processo = text(campos.processo);
    const matricula = text(campos.matricula);
    if (statusNeedsMatricula(status) && !matricula) {
      toast("Informe a matrícula para Contratado ou Migração.", "warn");
      return false;
    }
    loader(true, "Lista de aprovados", "Salvando status do candidato...", 65);
    const { error } = await supabase.rpc("alterar_status_candidato_aprovado", {
      p_candidato_id: candidato.candidato_id,
      p_status: status || null,
      p_processo_sei: processo || null,
      p_matricula: matricula || null,
    });
    loader(false);
    if (error) {
      toast(`Erro ao alterar status: ${mensagemDe(error)}`, "error");
      return false;
    }
    fecharModal();
    toast("Status do candidato atualizado.");
    await carregar({ comLoader: false });
    return true;
  }

  async function incluirSubJudice(campos) {
    const editalId = text(campos.editalId);
    const cargo = text(campos.cargo);
    const nome = text(campos.nome);
    const nota = Number(text(campos.nota).replace(",", "."));
    if (!editalId || !cargo || !nome || !Number.isFinite(nota) || nota < 0) {
      toast("Preencha edital, cargo, nome e uma nota válida.", "warn");
      return false;
    }
    loader(true, "Sub judice", "Incluindo candidato...", 65);
    const { error } = await supabase.rpc("incluir_sub_judice", {
      p_edital_id: editalId,
      p_cargo: cargo,
      p_nome: nome,
      p_nota: nota,
    });
    loader(false);
    if (error) {
      toast(`Erro ao incluir sub judice: ${mensagemDe(error)}`, "error");
      return false;
    }
    fecharModal();
    toast("Candidato sub judice incluído.");
    await carregar({ comLoader: false });
    return true;
  }

  async function removerSubJudice(candidatoId) {
    const candidato = candidatoPorId(candidatoId);
    if (!candidato || !canEditSubJudice(perfil(), candidato)) return false;
    if (
      !confirmar(
        `Remover ${candidato.nome} da lista como sub judice? O histórico será preservado.`,
      )
    )
      return false;
    loader(true, "Sub judice", "Removendo candidato...", 60);
    const { error } = await supabase.rpc("remover_sub_judice", {
      p_candidato_id: candidato.candidato_id,
    });
    loader(false);
    if (error) {
      toast(`Erro ao remover sub judice: ${mensagemDe(error)}`, "error");
      return false;
    }
    toast("Sub judice removido da lista vigente.");
    await carregar({ comLoader: false });
    return true;
  }

  // ── Listas (XLSX) ──────────────────────────────────────────────────────

  async function importarLista({ editalId, arquivo, ativo }) {
    const atual = listaDoEdital(editalId);
    if (atual && !canReplaceApprovedList(perfil())) {
      toast("Somente admin pode substituir uma lista existente.", "warn");
      return false;
    }
    if (!arquivo) {
      toast("Selecione o arquivo XLSX.", "warn");
      return false;
    }
    if (arquivo.size > LIMITE_DO_XLSX) {
      toast("O XLSX deve ter no máximo 10 MB.", "warn");
      return false;
    }
    let candidatos;
    try {
      loader(true, "Lista de aprovados", "Validando o XLSX...", 25);
      candidatos = await lerPlanilha(arquivo);
    } catch (erro) {
      loader(false);
      toast(`Arquivo inválido: ${mensagemDe(erro)}`, "error");
      return false;
    }
    const caminho = `${editalId}/${Date.now()}-${uuid()}-${nomeDeArquivoSeguro(arquivo.name)}`;
    loader(
      true,
      "Lista de aprovados",
      `Enviando ${candidatos.length} candidato(s)...`,
      55,
    );
    const envio = await supabase.storage
      .from(BUCKET)
      .upload(caminho, arquivo, { contentType: TIPO_DO_XLSX, upsert: false });
    if (envio.error) {
      loader(false);
      toast(`Erro ao anexar XLSX: ${mensagemDe(envio.error)}`, "error");
      return false;
    }
    const { error } = await supabase.rpc("importar_lista_aprovados", {
      p_edital_id: editalId,
      p_ativo: ativo,
      p_arquivo_nome: arquivo.name,
      p_arquivo_path: caminho,
      p_candidatos: candidatos,
      p_substituir: Boolean(atual),
    });
    loader(false);
    if (error) {
      toast(`Erro ao importar lista: ${mensagemDe(error)}`, "error");
      return false;
    }
    fecharModal();
    toast(`${candidatos.length} candidato(s) importados com sucesso.`);
    await carregar({ comLoader: false });
    avisar("agsus:listas-aprovados-changed");
    return true;
  }

  async function definirListaAtiva({ editalId, ativo }) {
    const lista = listaDoEdital(editalId);
    if (!lista) return false;
    loader(
      true,
      "Lista de aprovados",
      ativo ? "Ativando lista..." : "Inativando lista...",
      60,
    );
    const { error } = await supabase.rpc("definir_lista_aprovados_ativa", {
      p_lista_id: lista.lista_id,
      p_ativo: ativo,
    });
    loader(false);
    if (error) {
      toast(`Erro ao alterar a lista: ${mensagemDe(error)}`, "error");
      return false;
    }
    toast(
      ativo
        ? "Lista ativada."
        : "Lista inativada. Os candidatos ficaram bloqueados para alteração.",
    );
    await carregar({ comLoader: false });
    return true;
  }

  async function removerLista(editalId) {
    const lista = listaDoEdital(editalId);
    if (!lista || !canReplaceApprovedList(perfil())) return false;
    if (
      !confirmar(
        "Remover a lista vigente deste edital? Os dados permanecerão preservados no histórico.",
      )
    )
      return false;
    loader(true, "Lista de aprovados", "Arquivando lista vigente...", 60);
    const { error } = await supabase.rpc("remover_lista_aprovados", {
      p_lista_id: lista.lista_id,
    });
    loader(false);
    if (error) {
      toast(`Erro ao remover lista: ${mensagemDe(error)}`, "error");
      return false;
    }
    toast("Lista removida da visão vigente. O histórico foi preservado.");
    await carregar({ comLoader: false });
    avisar("agsus:listas-aprovados-changed");
    return true;
  }

  async function baixarArquivoAtual(editalId) {
    const lista = listaDoEdital(editalId);
    if (!lista?.arquivo_path) return;
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .download(lista.arquivo_path);
    if (error) {
      toast(`Erro ao baixar XLSX: ${mensagemDe(error)}`, "error");
      return;
    }
    baixar(data, lista.arquivo_nome || "lista-aprovados.xlsx");
  }

  // ── Convocação ─────────────────────────────────────────────────────────

  /** Devolve o id do modelo salvo, ou `null` se não salvou. */
  async function salvarModelo(modelo) {
    if (!supabase) return null;
    if (!text(modelo.nome)) {
      toast("Dê um nome ao modelo.", "warn");
      return null;
    }
    const pronto = fixarIdsNovos(modelo);
    const soma = somaDasReservas(pronto);
    if (soma > 100) {
      toast(
        `Os percentuais de reserva somam ${formatarTaxa(soma)}. A soma não pode passar de 100%.`,
        "warn",
      );
      return null;
    }
    loader(true, "Lista de convocação", "Salvando o modelo de regras...", 60);
    const { data, error } = await supabase.rpc("salvar_modelo_convocacao", {
      p_modelo: modeloParaSalvar(pronto),
    });
    loader(false);
    if (error) {
      toast(`Erro ao salvar o modelo: ${mensagemDe(error)}`, "error");
      return null;
    }
    await carregarConfiguracoes();
    toast("Modelo salvo.");
    return String(data?.modelo_id || pronto.id || "");
  }

  async function removerModelo(modelo, editais = 0) {
    if (!modelo?.id || !supabase) return false;
    const aviso =
      editais > 0
        ? `Remover "${modelo.nome}"? ${editais} edital(is) ficarão sem regra de convocação.`
        : `Remover "${modelo.nome}"?`;
    if (!confirmar(aviso)) return false;
    loader(true, "Lista de convocação", "Removendo o modelo...", 60);
    const { error } = await supabase.rpc("remover_modelo_convocacao", {
      p_modelo_id: modelo.id,
    });
    loader(false);
    if (error) {
      toast(`Erro ao remover o modelo: ${mensagemDe(error)}`, "error");
      return false;
    }
    await carregarConfiguracoes();
    toast("Modelo removido.");
    return true;
  }

  async function salvarConfiguracao(formulario) {
    if (!formulario || !supabase) return false;
    if (!canImportApprovedList(perfil())) {
      toast("Sem permissão para configurar a convocação.", "warn");
      return false;
    }
    loader(true, "Lista de convocação", "Salvando as vagas do edital...", 60);
    const { error } = await supabase.rpc(
      "salvar_configuracao_convocacao",
      argumentosDaConfiguracao(formulario),
    );
    loader(false);
    if (error) {
      toast(`Erro ao salvar a convocação: ${mensagemDe(error)}`, "error");
      return false;
    }
    toast("Convocação salva.");
    // Recarrega tudo: a ordem de convocação da página depende destas vagas.
    await carregar({ comLoader: false });
    return true;
  }

  return {
    assinar(ouvinte) {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
    obter: () => estado,
    /* O aviso do app, para o que a tela diz sem passar pelo banco. */
    toast,
    carregar,
    carregarConfiguracoes,
    garantirCarregado,
    abrirStatus,
    abrirSubJudice,
    abrirListasDoEdital,
    fecharModal,
    salvarStatus,
    incluirSubJudice,
    removerSubJudice,
    importarLista,
    definirListaAtiva,
    removerLista,
    baixarArquivoAtual,
    salvarModelo,
    removerModelo,
    salvarConfiguracao,
  };
}
