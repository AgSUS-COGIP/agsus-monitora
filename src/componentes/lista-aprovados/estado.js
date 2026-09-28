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

  Status e anexos entram na tela assim que o banco confirma (`aplicarLocal`):
  esperar a releitura dos milhares de candidatos deixava a linha antiga por
  segundos, como se nada tivesse sido salvo. A releitura corre depois, sem
  travar os botões, e é descartada se outra mudança local chegou no meio.

  Sem tela de carregamento: antes da primeira carga a página desenha skeleton
  (`carregado` falso), e uma falha nela vira `erroAoCarregar`, com "Tentar de
  novo". As ações passam por `executar`: `acao` diz qual está em curso, o botão
  dela mostra o rótulo e os outros ficam desativados até terminar.
*/

import { readApprovedWorkbook } from "../../lib/aprovados-import.js";
import { buscarTodasAsPaginas } from "../../lib/paginas-em-paralelo.js";
import { expandirCandidatosCompactos } from "../../lib/candidatos-aprovados-compactos.js";
import {
  canImportApprovedList,
  canManageSubJudice,
  canReplaceApprovedList,
  canViewCore,
} from "../../lib/access-roles.js";
import {
  canEditCandidateAttachments,
  canEditCandidateStatus,
  canEditSubJudice,
  nomeDeArquivoSeguro,
  statusNeedsMatricula,
  statusTravado,
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
import {
  anexosPorCandidato,
  arquivoEmBase64,
  pdfDoBase64,
  problemaDosAnexos,
} from "../../lib/anexos-do-candidato.js";

const BUCKET = PLANILHAS.listaAprovadosImportada.bucket;
const CANDIDATES_PAGE_SIZE = 1000;
const LIMITE_DO_XLSX = 10 * 1024 * 1024;
const TIPO_DO_XLSX =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const text = (value) => String(value ?? "").trim();
const mensagemDe = (erro) => erro?.message || erro;

const ESTADO_INICIAL = Object.freeze({
  candidatos: Object.freeze([]),
  /** candidato_id → anexos (PDF) dele. */
  anexos: new Map(),
  listas: Object.freeze([]),
  carregado: false,
  /** A primeira carga falhou: a página mostra o erro e "Tentar de novo". */
  erroAoCarregar: "",
  /** A ação em curso, `{ tipo, rotulo }`, ou `null`. Uma por vez. */
  acao: null,
  /** modelo_id → modelo normalizado, com `editais` (quantos o usam). */
  modelos: new Map(),
  /** edital_id → { proporcionalidade, modeloId, padraoImediata, vagas }. */
  configs: new Map(),
  perfil: null,
  /*
    O modal aberto, ou `null`. `abertura` muda a cada abertura: o componente
    usa-a como `key`, e reabrir o mesmo modal começa de um rascunho limpo.
      { tipo: "status", candidatoId }
      { tipo: "anexos", candidatoId }
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

/*
  A aba abre na hora do clique (depois do `await` o navegador a bloquearia como
  popup) e recebe o endereço assinado quando ele chega.
*/
function abrirEmNovaAba() {
  const janela = window.open("", "_blank");
  return {
    mostrar(url) {
      if (!janela) {
        window.open(url, "_blank", "noopener");
        return;
      }
      janela.opener = null;
      janela.location.href = url;
    },
    fechar: () => janela?.close(),
  };
}

export function criarEstadoDaListaDeAprovados({
  supabase = null,
  toast = (mensagem) => console.info(mensagem),
  getProfile = () => null,
  confirmar = (mensagem) => window.confirm(mensagem),
  baixar = baixarNoNavegador,
  lerPlanilha = readApprovedWorkbook,
  novaAba = abrirEmNovaAba,
} = {}) {
  let estado = ESTADO_INICIAL;
  let aberturas = 0;
  let mudancasLocais = 0;
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

  /*
    Uma ação por vez. `fazer` recebe `rotular`, para trocar o rótulo no meio
    (a importação valida o XLSX e depois envia). Com outra ação em curso, não
    faz nada: os botões já estão desativados, isto só fecha a porta.
  */
  async function executar(tipo, rotulo, fazer) {
    if (estado.acao) return false;
    publicar({ acao: { tipo, rotulo } });
    try {
      return await fazer((novo) => publicar({ acao: { tipo, rotulo: novo } }));
    } finally {
      publicar({ acao: null });
    }
  }

  // ── Leitura ────────────────────────────────────────────────────────────

  /*
    Uma chamada só: em páginas, o banco refazia a lista inteira (≈20 mil
    candidatos) a cada uma das ~16 páginas. As páginas em paralelo ficam só
    como reserva, para o banco que ainda não tem a função compacta.
  */
  async function buscarTodosOsCandidatos() {
    const compacto = await supabase.rpc("listar_candidatos_aprovados_compacto");
    if (!compacto.error)
      return { data: expandirCandidatosCompactos(compacto.data), error: null };
    if (compacto.error.code !== "PGRST202") return compacto;
    return buscarPorPaginas();
  }

  // Páginas em paralelo: em sequência eram 16 pedidos de ~750 ms (12 s).
  function buscarPorPaginas() {
    return buscarTodasAsPaginas(
      (inicio, fim, { contar }) =>
        supabase
          .rpc(
            "listar_candidatos_aprovados",
            {},
            contar ? { count: "exact" } : undefined,
          )
          .range(inicio, fim),
      { tamanho: CANDIDATES_PAGE_SIZE, concorrencia: 6 },
    );
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

  /*
    Os anexos, como a configuração, não interrompem a carga: sem eles a lista
    aparece e o botão de anexos fica vazio.
  */
  async function lerAnexos() {
    if (!canViewCore(perfil())) return new Map();
    const { data, error } = await supabase.rpc(
      "listar_anexos_candidatos_aprovados",
    );
    if (error) {
      console.warn("Anexos dos candidatos indisponíveis:", error);
      return null;
    }
    return anexosPorCandidato(data);
  }

  async function carregarConfiguracoes() {
    if (!supabase) return;
    const lidas = await lerConfiguracoes();
    if (lidas) publicar(lidas);
  }

  /** Publica o que o banco acabou de confirmar, sem esperar a releitura. */
  function aplicarLocal(mudancas) {
    mudancasLocais += 1;
    publicar(mudancas);
  }

  /*
    `emSegundoPlano`: a releitura depois de uma mudança já aplicada na tela.
    Se outra mudança local chegou enquanto ela corria, os dados dela são mais
    velhos que a tela — e a mudança nova dispara a própria releitura.
  */
  async function carregar({ emSegundoPlano = false } = {}) {
    if (!supabase) return false;
    const versao = mudancasLocais;
    if (estado.erroAoCarregar) publicar({ erroAoCarregar: "" });
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
        lerAnexos().catch(() => null),
      ]);
    } catch (erro) {
      resultados = [{ error: erro }, { error: null }, null, null];
    }
    const [listas, candidatos, configuracao, anexos] = resultados;
    if (emSegundoPlano && versao !== mudancasLocais) return false;
    const error = listas.error || candidatos.error;
    if (error) {
      toast(
        `Erro ao carregar lista de aprovados: ${mensagemDe(error)}`,
        "error",
      );
      // Recarga depois de uma ação: os dados de antes continuam na tela.
      if (!estado.carregado)
        publicar({ erroAoCarregar: String(mensagemDe(error)) });
      return false;
    }
    publicar({
      listas: Array.isArray(listas.data) ? listas.data : [],
      candidatos: Array.isArray(candidatos.data) ? candidatos.data : [],
      carregado: true,
      perfil: perfil(),
      ...(configuracao || {}),
      ...(anexos ? { anexos } : {}),
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
          : candidato && statusTravado(perfil(), candidato)
            ? "O status já foi definido. Só o admin pode alterá-lo."
            : "Sem permissão para alterar o status.",
        "warn",
      );
      return;
    }
    abrir({ tipo: "status", candidatoId: String(candidatoId) });
  }

  function abrirAnexos(candidatoId) {
    if (!candidatoPorId(candidatoId)) return;
    abrir({ tipo: "anexos", candidatoId: String(candidatoId) });
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
    if (!estado.carregado) await carregar();
    abrir({ tipo: "listas", editalId: String(editalId || ""), rotulo });
  }

  // ── Candidatos ─────────────────────────────────────────────────────────

  const anexosDe = (candidatoId) =>
    estado.anexos.get(String(candidatoId)) || [];

  function comAnexos(candidatoId, anexos) {
    const mapa = new Map(estado.anexos);
    if (anexos.length) mapa.set(String(candidatoId), anexos);
    else mapa.delete(String(candidatoId));
    return mapa;
  }

  const comCandidato = (atualizado) =>
    estado.candidatos.map((row) =>
      String(row.candidato_id) === String(atualizado.candidato_id)
        ? atualizado
        : row,
    );

  /*
    Um arquivo por vez: o PDF vai em base64 e o banco grava em bytea, na mesma
    chamada que confere o limite de 5 e a lista ativa. Devolve os anexos
    registrados e a mensagem de cada arquivo que não entrou.
  */
  async function enviarAnexos(candidato, arquivos, rotular) {
    const falhas = [];
    const novos = [];
    for (const [indice, arquivo] of arquivos.entries()) {
      rotular(`Enviando anexo ${indice + 1} de ${arquivos.length}…`);
      let base64;
      try {
        base64 = await arquivoEmBase64(arquivo);
      } catch (erro) {
        falhas.push(`${arquivo.name}: ${mensagemDe(erro)}`);
        continue;
      }
      const { data, error } = await supabase.rpc(
        "registrar_anexo_candidato_aprovado",
        {
          p_candidato_id: candidato.candidato_id,
          p_arquivo_nome: arquivo.name,
          p_arquivo_base64: base64,
        },
      );
      if (error || !data?.anexo_id) {
        falhas.push(`${arquivo.name}: ${mensagemDe(error) || "sem resposta"}`);
        continue;
      }
      novos.push({
        anexo_id: data.anexo_id,
        candidato_id: candidato.candidato_id,
        arquivo_nome: arquivo.name,
        tamanho: arquivo.size,
        incluido_em: new Date().toISOString(),
      });
    }
    return { falhas, novos };
  }

  async function salvarStatus(candidatoId, campos) {
    const candidato = candidatoPorId(candidatoId);
    if (!candidato || !canEditCandidateStatus(perfil(), candidato))
      return false;
    const status = text(campos.status);
    const processo = text(campos.processo);
    const matricula = text(campos.matricula);
    const arquivos = Array.from(campos.anexos ?? []);
    if (arquivos.length && !canEditCandidateAttachments(perfil(), candidato)) {
      toast("Somente admin pode anexar documentos.", "warn");
      return false;
    }
    if (statusNeedsMatricula(status) && !matricula) {
      toast("Informe a matrícula para Contratado ou Migração.", "warn");
      return false;
    }
    const problema = problemaDosAnexos(
      arquivos,
      anexosDe(candidato.candidato_id).length,
    );
    if (problema) {
      toast(problema, "warn");
      return false;
    }
    const salvo = await executar("status", "Salvando…", async (rotular) => {
      const { error } = await supabase.rpc(
        "alterar_status_candidato_aprovado",
        {
          p_candidato_id: candidato.candidato_id,
          p_status: status || null,
          p_processo_sei: processo || null,
          p_matricula: matricula || null,
        },
      );
      if (error) {
        toast(`Erro ao alterar status: ${mensagemDe(error)}`, "error");
        return false;
      }
      const { falhas, novos } = arquivos.length
        ? await enviarAnexos(candidato, arquivos, rotular)
        : { falhas: [], novos: [] };
      // Como o banco gravou: matrícula só fica para Contratado e Migração.
      aplicarLocal({
        candidatos: comCandidato({
          ...candidato,
          status: status || null,
          processo_sei: processo || null,
          matricula: statusNeedsMatricula(status) ? matricula : null,
        }),
        anexos: comAnexos(candidato.candidato_id, [
          ...anexosDe(candidato.candidato_id),
          ...novos,
        ]),
      });
      fecharModal();
      if (falhas.length)
        toast(
          `Status atualizado, mas ${falhas.length} anexo(s) não foram enviados. ${falhas.join(" · ")}`,
          "error",
        );
      else
        toast(
          arquivos.length
            ? `Status atualizado e ${arquivos.length} anexo(s) enviados.`
            : "Status do candidato atualizado.",
        );
      return true;
    });
    if (salvo) void carregar({ emSegundoPlano: true });
    return salvo;
  }

  /*
    O PDF vem do banco em base64 e abre numa aba nova por um endereço `blob:`,
    que é liberado um minuto depois (a aba já o carregou).
  */
  async function abrirAnexo(anexo) {
    if (!anexo?.anexo_id) return;
    const aba = novaAba();
    const { data, error } = await supabase.rpc(
      "baixar_anexo_candidato_aprovado",
      { p_anexo_id: anexo.anexo_id },
    );
    if (error || !data?.arquivo_base64) {
      aba.fechar();
      toast(
        `Erro ao abrir o anexo: ${mensagemDe(error) || "arquivo vazio"}`,
        "error",
      );
      return;
    }
    const url = URL.createObjectURL(pdfDoBase64(data.arquivo_base64));
    aba.mostrar(url);
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  async function removerAnexo(anexo) {
    const candidato = candidatoPorId(anexo?.candidato_id);
    if (!candidato || !canEditCandidateAttachments(perfil(), candidato))
      return false;
    if (!confirmar(`Remover o anexo "${anexo.arquivo_nome}"?`)) return false;
    const removido = await executar(
      `remover-anexo:${anexo.anexo_id}`,
      "Removendo…",
      async () => {
        // O arquivo está na linha: apagá-la apaga o PDF junto.
        const { error } = await supabase.rpc(
          "remover_anexo_candidato_aprovado",
          { p_anexo_id: anexo.anexo_id },
        );
        if (error) {
          toast(`Erro ao remover o anexo: ${mensagemDe(error)}`, "error");
          return false;
        }
        aplicarLocal({
          anexos: comAnexos(
            candidato.candidato_id,
            anexosDe(candidato.candidato_id).filter(
              (item) => item.anexo_id !== anexo.anexo_id,
            ),
          ),
        });
        toast("Anexo removido.");
        return true;
      },
    );
    if (removido) void carregar({ emSegundoPlano: true });
    return removido;
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
    return executar("sub-judice", "Incluindo…", async () => {
      const { error } = await supabase.rpc("incluir_sub_judice", {
        p_edital_id: editalId,
        p_cargo: cargo,
        p_nome: nome,
        p_nota: nota,
      });
      if (error) {
        toast(`Erro ao incluir sub judice: ${mensagemDe(error)}`, "error");
        return false;
      }
      fecharModal();
      toast("Candidato sub judice incluído.");
      await carregar();
      return true;
    });
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
    return executar(
      `remover-sub-judice:${candidato.candidato_id}`,
      "Removendo…",
      async () => {
        const { error } = await supabase.rpc("remover_sub_judice", {
          p_candidato_id: candidato.candidato_id,
        });
        if (error) {
          toast(`Erro ao remover sub judice: ${mensagemDe(error)}`, "error");
          return false;
        }
        toast("Sub judice removido da lista vigente.");
        await carregar();
        return true;
      },
    );
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
    return executar("importar", "Validando o XLSX…", async (rotular) => {
      let candidatos;
      try {
        candidatos = await lerPlanilha(arquivo);
      } catch (erro) {
        toast(`Arquivo inválido: ${mensagemDe(erro)}`, "error");
        return false;
      }
      const caminho = `${editalId}/${Date.now()}-${uuid()}-${nomeDeArquivoSeguro(arquivo.name)}`;
      rotular(`Enviando ${candidatos.length} candidato(s)…`);
      const envio = await supabase.storage
        .from(BUCKET)
        .upload(caminho, arquivo, { contentType: TIPO_DO_XLSX, upsert: false });
      if (envio.error) {
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
      if (error) {
        toast(`Erro ao importar lista: ${mensagemDe(error)}`, "error");
        return false;
      }
      fecharModal();
      toast(`${candidatos.length} candidato(s) importados com sucesso.`);
      await carregar();
      avisar("agsus:listas-aprovados-changed");
      return true;
    });
  }

  async function definirListaAtiva({ editalId, ativo }) {
    const lista = listaDoEdital(editalId);
    if (!lista) return false;
    return executar(
      "lista-ativa",
      ativo ? "Ativando…" : "Inativando…",
      async () => {
        const { error } = await supabase.rpc("definir_lista_aprovados_ativa", {
          p_lista_id: lista.lista_id,
          p_ativo: ativo,
        });
        if (error) {
          toast(`Erro ao alterar a lista: ${mensagemDe(error)}`, "error");
          return false;
        }
        toast(
          ativo
            ? "Lista ativada."
            : "Lista inativada. Os candidatos ficaram bloqueados para alteração.",
        );
        await carregar();
        return true;
      },
    );
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
    return executar("remover-lista", "Arquivando…", async () => {
      const { error } = await supabase.rpc("remover_lista_aprovados", {
        p_lista_id: lista.lista_id,
      });
      if (error) {
        toast(`Erro ao remover lista: ${mensagemDe(error)}`, "error");
        return false;
      }
      toast("Lista removida da visão vigente. O histórico foi preservado.");
      await carregar();
      avisar("agsus:listas-aprovados-changed");
      return true;
    });
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
    const salvo = await executar("salvar-modelo", "Salvando…", async () => {
      const { data, error } = await supabase.rpc("salvar_modelo_convocacao", {
        p_modelo: modeloParaSalvar(pronto),
      });
      if (error) {
        toast(`Erro ao salvar o modelo: ${mensagemDe(error)}`, "error");
        return null;
      }
      await carregarConfiguracoes();
      toast("Modelo salvo.");
      return String(data?.modelo_id || pronto.id || "");
    });
    return salvo || null;
  }

  async function removerModelo(modelo, editais = 0) {
    if (!modelo?.id || !supabase) return false;
    const aviso =
      editais > 0
        ? `Remover "${modelo.nome}"? ${editais} edital(is) ficarão sem regra de convocação.`
        : `Remover "${modelo.nome}"?`;
    if (!confirmar(aviso)) return false;
    return executar("remover-modelo", "Removendo…", async () => {
      const { error } = await supabase.rpc("remover_modelo_convocacao", {
        p_modelo_id: modelo.id,
      });
      if (error) {
        toast(`Erro ao remover o modelo: ${mensagemDe(error)}`, "error");
        return false;
      }
      await carregarConfiguracoes();
      toast("Modelo removido.");
      return true;
    });
  }

  async function salvarConfiguracao(formulario) {
    if (!formulario || !supabase) return false;
    if (!canImportApprovedList(perfil())) {
      toast("Sem permissão para configurar a convocação.", "warn");
      return false;
    }
    return executar("salvar-configuracao", "Salvando…", async () => {
      const { error } = await supabase.rpc(
        "salvar_configuracao_convocacao",
        argumentosDaConfiguracao(formulario),
      );
      if (error) {
        toast(`Erro ao salvar a convocação: ${mensagemDe(error)}`, "error");
        return false;
      }
      toast("Convocação salva.");
      // Recarrega tudo: a ordem de convocação da página depende destas vagas.
      await carregar();
      return true;
    });
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
    abrirAnexos,
    abrirSubJudice,
    abrirListasDoEdital,
    fecharModal,
    salvarStatus,
    abrirAnexo,
    removerAnexo,
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
