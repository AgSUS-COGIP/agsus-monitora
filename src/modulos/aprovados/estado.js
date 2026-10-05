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

  Os candidatos vêm só da área atual do menu (`areaAtual`, de
  `dados-do-monitoramento.js`): trocar de área e abrir a página busca os da
  área nova. A primeira abertura de uma área mostra a cópia guardada no
  navegador (IndexedDB, regras em `lib/cache-de-payload.js`) e pergunta ao
  banco, por trás, se a `versao` dela ainda vale — o banco calcula a versão dos
  próprios dados a cada chamada e só manda o pacote de novo se ela mudou. A
  releitura depois de uma escrita nunca usa a cópia: vai ao banco, que devolve
  os dados com a escrita (ver a migration 20260929190000).
*/

/*
  Versão da cópia guardada: o endereço do bundle traz o hash do conteúdo, e
  cada publicação invalida as cópias antigas sozinha.
*/
const VERSAO_DA_COPIA = `1:${import.meta.url}`;

import { readApprovedWorkbook } from "../../lib/aprovados-import.js";
import {
  LISTA_DE_APROVADOS,
  expandirCandidatosCompactos,
  pacoteInalterado,
} from "../../lib/candidatos-aprovados-compactos.js";
import {
  criarCacheDePayload,
  revalidarPayload,
} from "../../lib/cache-de-payload.js";
import { armazenamentoDePayload } from "../../modules/cache-de-payload-indexeddb.js";
import { obterDadosDoMonitoramento } from "../../componentes/dados-do-monitoramento.js";
import {
  canAlterarPorDecisaoJudicial,
  canImportApprovedList,
  canManageSubJudice,
  canReplaceApprovedList,
  canViewCore,
} from "../../lib/access-roles.js";
import {
  canAlterarCandidatoSubJudice,
  canDesfazerAlteracaoSubJudice,
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
import { motivoValido } from "../../lib/publicacao-de-aprovados.js";
import { irParaLink } from "../chat/ponte.js";
import {
  anexosPorCandidato,
  arquivoEmBase64,
  pdfDoBase64,
  problemaDosAnexos,
} from "../../lib/anexos-do-candidato.js";

const BUCKET = PLANILHAS.listaAprovadosImportada.bucket;
const LIMITE_DO_XLSX = 10 * 1024 * 1024;
const TIPO_DO_XLSX =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const text = (value) => String(value ?? "").trim();
const mensagemDe = (erro) => erro?.message || erro;

/* Nota digitada ("87,5" ou "87.5"): número maior ou igual a zero, ou nulo. */
function lerNota(valor) {
  const bruto = text(valor).replace(",", ".");
  if (!bruto) return null;
  const nota = Number(bruto);
  return Number.isFinite(nota) && nota >= 0 ? nota : null;
}

const ESTADO_INICIAL = Object.freeze({
  candidatos: Object.freeze([]),
  /** candidato_id → anexos (PDF) dele. */
  anexos: new Map(),
  listas: Object.freeze([]),
  carregado: false,
  /** Quando a última carga chegou (ISO), para a data discreta do topo. */
  carregadoEm: "",
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
      { tipo: "sub-judice", aba?: "novo" | "aprovado", candidatoId? }
      { tipo: "listas", editalId, rotulo }
  */
  modal: null,
  /*
    A situação do edital do modal de listas (obter_publicacao_lista_aprovados):
    a origem da lista vigente, o resultado final da Classificação e o
    histórico das publicações. { editalId, carregando, dados }.
  */
  publicacao: null,
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
  armazenamento = armazenamentoDePayload,
  areaAtual = () => obterDadosDoMonitoramento().areaAtual,
} = {}) {
  let estado = ESTADO_INICIAL;
  let aberturas = 0;
  let mudancasLocais = 0;
  /* A área dos candidatos na tela e a `versao` do banco para eles. */
  let areaCarregada = "";
  let versaoCarregada = null;
  const ouvintes = new Set();
  const copias = criarCacheDePayload({
    armazenamento,
    versao: VERSAO_DA_COPIA,
    tipo: LISTA_DE_APROVADOS,
  });

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

  const contextoDaCopia = (area) => ({
    usuarioId: text(perfil()?.user_id),
    area,
  });

  /*
    Uma chamada só, da área. `versao` é a dos dados que a tela já tem: se o
    banco disser que continua valendo, volta `{ inalterado: true }` e nada
    trafega. O banco de antes da migration 20260929190000 não conhece
    `p_area` (PGRST202): a função sem argumentos devolve todas as áreas no
    formato 1, e a tela recorta pela área como sempre.
  */
  async function pedirPacote(area, versao) {
    const resposta = await supabase.rpc(
      "listar_candidatos_aprovados_compacto",
      { p_area: area, p_versao: versao },
    );
    if (resposta.error?.code !== "PGRST202") return resposta;
    return supabase.rpc("listar_candidatos_aprovados_compacto");
  }

  /*
    Os candidatos da área. `usarCopia`: a primeira abertura da área devolve a
    cópia guardada na hora (`guardado`), e quem chama a revalida por trás.
    Fora disso (releitura depois de uma escrita), vai sempre ao banco.
  */
  async function buscarCandidatos(area, { usarCopia }) {
    const contexto = contextoDaCopia(area);
    const guardado = usarCopia ? await copias.ler(contexto) : null;
    if (guardado)
      return {
        data: expandirCandidatosCompactos(guardado),
        error: null,
        versao: guardado.versao,
        guardado,
      };
    const versaoDaTela =
      !usarCopia && area === areaCarregada ? versaoCarregada : null;
    const { data, error } = await pedirPacote(area, versaoDaTela);
    if (error) return { data: null, error };
    if (pacoteInalterado(data)) return { inalterado: true, error: null };
    void copias.guardar(contexto, data);
    return {
      data: expandirCandidatosCompactos(data),
      error: null,
      versao: typeof data?.versao === "string" ? data.versao : null,
    };
  }

  /*
    A cópia já está na tela: pergunta ao banco se ela vale. Mudou, entra a
    nova — a menos que a área tenha mudado ou uma escrita local tenha chegado
    no meio (ela dispara a própria releitura). Sem acesso à área (42501/22023),
    as cópias saem e a lista fica vazia.
  */
  function revalidarCopia(area, guardado) {
    const contexto = contextoDaCopia(area);
    const mudancas = mudancasLocais;
    const aindaVale = () =>
      area === areaCarregada && mudancas === mudancasLocais;
    return revalidarPayload({
      guardado,
      buscar: async () => {
        const { data, error } = await pedirPacote(area, guardado.versao);
        if (error) throw error;
        return data;
      },
      mudou: (_, novo) => !pacoteInalterado(novo),
      guardar: (novo) =>
        pacoteInalterado(novo) ? null : copias.guardar(contexto, novo),
      aoMudar: (novo) => {
        if (!aindaVale()) return;
        versaoCarregada = typeof novo?.versao === "string" ? novo.versao : null;
        publicar({ candidatos: expandirCandidatosCompactos(novo) });
      },
      aoPerderAcesso: (erro) => {
        if (area !== areaCarregada) return;
        versaoCarregada = null;
        publicar({ candidatos: [] });
        toast(
          `Erro ao carregar lista de aprovados: ${mensagemDe(erro)}`,
          "error",
        );
      },
      apagarTudo: () => copias.apagarTudo(),
    });
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
    const area = text(areaAtual());
    /*
      Outra área: a tela volta ao skeleton em vez de mostrar os candidatos da
      área anterior (que o recorte por área esconderia, parecendo lista vazia).
      A cópia guardada só serve aqui, e na primeira carga.
    */
    const outraArea = area !== areaCarregada;
    const usarCopia = !emSegundoPlano && (outraArea || !estado.carregado);
    if (outraArea && estado.carregado) publicar({ carregado: false });
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
          ? buscarCandidatos(area, { usarCopia })
          : Promise.resolve({ data: [], error: null, versao: null }),
        lerConfiguracoes(),
        lerAnexos().catch(() => null),
      ]);
    } catch (erro) {
      resultados = [{ error: erro }, { error: null }, null, null];
    }
    const [listas, candidatos, configuracao, anexos] = resultados;
    if (emSegundoPlano && versao !== mudancasLocais) return false;
    // A área mudou enquanto a carga corria: a carga da área nova é que vale.
    if (text(areaAtual()) !== area) return false;
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
    areaCarregada = area;
    // Inalterado: a versão e os candidatos da tela continuam os mesmos.
    if (!candidatos.inalterado) versaoCarregada = candidatos.versao ?? null;
    publicar({
      listas: Array.isArray(listas.data) ? listas.data : [],
      ...(candidatos.inalterado
        ? {}
        : {
            candidatos: Array.isArray(candidatos.data) ? candidatos.data : [],
          }),
      carregado: true,
      carregadoEm: new Date().toISOString(),
      perfil: perfil(),
      ...(configuracao || {}),
      ...(anexos ? { anexos } : {}),
    });
    avisar("agsus:listas-aprovados-loaded", { lists: estado.listas });
    if (candidatos.guardado) void revalidarCopia(area, candidatos.guardado);
    return true;
  }

  /*
    Chamada a cada abertura da página. As permissões dependem do perfil, que o
    legado troca sem avisar; republicá-lo aqui redesenha a tela com o de agora.
    Trocar de área no menu abre a página de novo: os candidatos são da área.
  */
  async function garantirCarregado() {
    if (!estado.carregado || text(areaAtual()) !== areaCarregada)
      return carregar();
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
    if (
      !canManageSubJudice(perfil()) &&
      !canAlterarPorDecisaoJudicial(perfil())
    ) {
      toast("Sem permissão para incluir sub judice.", "warn");
      return;
    }
    if (!estado.listas.some((item) => item.ativo)) {
      toast("Não há lista ativa para receber sub judice.", "warn");
      return;
    }
    abrir({ tipo: "sub-judice" });
  }

  function abrirAlteracaoJudicial(candidatoId) {
    const candidato = candidatoPorId(candidatoId);
    if (!candidato || !canAlterarCandidatoSubJudice(perfil(), candidato)) {
      toast(
        candidato?.lista_ativa === false
          ? "A lista está inativa."
          : "Só o admin altera nota ou modalidade por decisão judicial.",
        "warn",
      );
      return;
    }
    // O mesmo formulário do sub judice, na aba do candidato já aprovado.
    abrir({
      tipo: "sub-judice",
      aba: "aprovado",
      candidatoId: String(candidatoId),
    });
  }

  async function abrirListasDoEdital(editalId, rotulo = "") {
    if (!canImportApprovedList(perfil())) {
      toast("Sem permissão para gerir lista de aprovados.", "warn");
      return;
    }
    if (!estado.carregado || text(areaAtual()) !== areaCarregada)
      await carregar();
    abrir({ tipo: "listas", editalId: String(editalId || ""), rotulo });
    void carregarPublicacao(editalId);
  }

  /*
    De onde vem a lista do edital e se a Classificação já tem o resultado
    final (migration 20261005160000). Antes da migration (PGRST202) ou sem
    acesso, o modal segue só com o XLSX.
  */
  async function carregarPublicacao(editalId) {
    const id = String(editalId || "");
    if (!supabase || !id) return null;
    publicar({ publicacao: { editalId: id, carregando: true, dados: null } });
    let dados = null;
    try {
      const resposta = await supabase.rpc("obter_publicacao_lista_aprovados", {
        p_edital: id,
        p_com_candidatos: false,
      });
      if (resposta.error) throw resposta.error;
      dados = resposta.data || null;
    } catch (erro) {
      if (erro?.code !== "PGRST202")
        console.warn("Origem da lista de aprovados indisponível:", erro);
    }
    if (estado.publicacao?.editalId !== id) return null;
    publicar({ publicacao: { editalId: id, carregando: false, dados } });
    return dados;
  }

  /* "Publicar da Classificação": a tela da Classificação, no edital. */
  function irParaClassificacao(editalId, titulo = "") {
    fecharModal();
    const foi = irParaLink({
      view: "classificacao",
      edital: { id: String(editalId || ""), titulo },
    });
    // Edital sem id de monitoramento válido: a tela, sem o edital escolhido.
    if (!foi) window.navigate?.("classificacao");
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
    const nota = lerNota(campos.nota);
    if (!editalId || !cargo || !nome || nota === null) {
      toast("Preencha edital, cargo, nome e uma nota válida.", "warn");
      return false;
    }
    return executar("sub-judice", "Incluindo…", async () => {
      const { error } = await supabase.rpc("incluir_sub_judice", {
        p_edital_id: editalId,
        p_cargo: cargo,
        p_nome: nome,
        p_nota: nota,
        p_modalidade: text(campos.modalidade) || null,
        p_processo: text(campos.processo) || null,
        p_observacao: text(campos.observacao) || null,
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

  /*
    Decisão judicial sobre quem já está na lista: nota e/ou modalidade novas.
    O banco guarda o resultado publicado na primeira alteração, marca sub
    judice e refaz a classificação; a releitura traz as posições novas.
  */
  async function alterarSubJudice(candidatoId, campos) {
    const candidato = candidatoPorId(candidatoId);
    if (!candidato || !canAlterarCandidatoSubJudice(perfil(), candidato))
      return false;
    const notaDigitada = text(campos.nota);
    const nota = lerNota(notaDigitada);
    if (notaDigitada && nota === null) {
      toast("Informe uma nota válida.", "warn");
      return false;
    }
    const modalidade = text(campos.modalidade);
    const mudouNota = nota !== null && nota !== Number(candidato.nota);
    const mudouModalidade =
      Boolean(modalidade) && modalidade !== text(candidato.modalidade);
    if (!mudouNota && !mudouModalidade) {
      toast("Informe uma nota ou modalidade diferente da atual.", "warn");
      return false;
    }
    return executar("alteracao-judicial", "Salvando…", async () => {
      const { error } = await supabase.rpc("alterar_candidato_sub_judice", {
        p_candidato_id: candidato.candidato_id,
        p_nota: mudouNota ? nota : null,
        p_modalidade: mudouModalidade ? modalidade : null,
        p_processo: text(campos.processo) || null,
        p_observacao: text(campos.observacao) || null,
      });
      if (error) {
        toast(`Erro ao registrar a decisão: ${mensagemDe(error)}`, "error");
        return false;
      }
      fecharModal();
      toast("Decisão judicial registrada e classificação refeita.");
      await carregar();
      return true;
    });
  }

  /* A decisão caiu: volta à nota, modalidade e classificação do resultado publicado. */
  async function desfazerAlteracaoSubJudice(candidatoId, observacao = "") {
    const candidato = candidatoPorId(candidatoId);
    if (!candidato || !canDesfazerAlteracaoSubJudice(perfil(), candidato))
      return false;
    if (
      !confirmar(
        `Desfazer a alteração judicial de ${candidato.nome}? A nota e a modalidade voltam às do resultado publicado e a classificação é refeita.`,
      )
    )
      return false;
    return executar("desfazer-alteracao-judicial", "Desfazendo…", async () => {
      const { error } = await supabase.rpc("desfazer_alteracao_sub_judice", {
        p_candidato_id: candidato.candidato_id,
        p_observacao: text(observacao) || null,
      });
      if (error) {
        toast(`Erro ao desfazer a alteração: ${mensagemDe(error)}`, "error");
        return false;
      }
      fecharModal();
      toast("Alteração judicial desfeita.");
      await carregar();
      return true;
    });
  }

  // ── Listas (XLSX) ──────────────────────────────────────────────────────

  async function importarLista({ editalId, arquivo, ativo, motivo = "" }) {
    const atual = listaDoEdital(editalId);
    if (atual && !canReplaceApprovedList(perfil())) {
      toast("Somente admin pode substituir uma lista existente.", "warn");
      return false;
    }
    const daClassificacao =
      text(atual?.origem).toUpperCase() === "CLASSIFICACAO";
    if (daClassificacao && !motivoValido(motivo)) {
      toast(
        "A lista vigente foi publicada da Classificação: informe o motivo (3 a 500 caracteres) para trocá-la pela planilha.",
        "warn",
      );
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
        p_motivo: daClassificacao ? text(motivo) : null,
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
    abrirAlteracaoJudicial,
    abrirListasDoEdital,
    carregarPublicacao,
    irParaClassificacao,
    fecharModal,
    salvarStatus,
    abrirAnexo,
    removerAnexo,
    incluirSubJudice,
    removerSubJudice,
    alterarSubJudice,
    desfazerAlteracaoSubJudice,
    importarLista,
    definirListaAtiva,
    removerLista,
    baixarArquivoAtual,
    salvarModelo,
    removerModelo,
    salvarConfiguracao,
  };
}
