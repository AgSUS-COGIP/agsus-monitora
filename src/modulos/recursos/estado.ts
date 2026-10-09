import type {
  OpcoesDoEstadoDosRecursos,
  SnapshotDosRecursos,
  RpcDosRecursos,
  RegistroDosRecursos,
  ErroDosRecursos,
  AcaoDoParecer,
  AcaoDaResposta,
} from "./tipos-do-estado.ts";
import type {
  DadosDoRecurso,
  IdentificadorDoRecurso as Id,
  RecursoDoPainel,
  OrigemDoRecurso,
  EtapaDoRecurso,
} from "../../lib/tipos-dos-recursos.ts";
import {
  normalizarDadosDosRecursos,
  normalizarDetalheDoRecurso,
  normalizarCandidatosDosRecursos,
  normalizarDadosDosModelos,
  objetoDosRecursos,
  metadadosDaRpcDosRecursos,
} from "../../lib/dados-dos-recursos.ts";
import { dadosParaSalvar } from "../../lib/recursos-dos-candidatos.ts";
type DocumentoDaResposta = { id: Id; texto_final: string; revisao?: number };
/*
  Estado da tela de Recursos (`#page-recursos`), fora do React: o que o banco
  devolve para a área atual do app, o recurso aberto na gaveta
  (com o detalhe e o histórico), o formulário aberto e as ações que escrevem
  no banco. Os componentes leem com `useSyncExternalStore`. Este arquivo não
  importa React.

  Tudo passa por RPC (supabase/migrations/20260929120000_recursos.sql):
  `get_recursos_da_area` numa chamada só (json), o detalhe sob demanda, a
  busca do candidato nas análises do edital e as três escritas. O banco confere
  permissão e área em todas; `pode_editar` vem dele. A resposta escrita, os
  anexos (bucket privado `recursos-anexos`, com URL assinada depois do registro
  do download) e os modelos de resposta são de
  20260929230000_recursos_modelos_anexos_respostas.sql; o fluxo do parecer
  jurídico (`transicionar_recurso_candidato`, `pode_decidir`), de
  20261001170000_recursos_parecer_juridico.sql. O ajuste da pontuação no
  recurso deferido (versões, prévia com os dados da Classificação, propor,
  aprovar e cancelar), de 20261005130000_recurso_ajusta_pontuacao.sql.

  Sem tela de carregamento: antes da primeira carga o painel é o skeleton
  (`carregado` falso); uma falha nela vira `erroAoCarregar`, com "Tentar
  novamente". Sessão vencida (o cliente Supabase do app sem sessão):
  `semSessao`. Outro usuário entrou na mesma aba: tudo volta ao início (nada
  do anterior fica na tela). Uma ação por vez (`executar`): o botão dela
  mostra o rótulo, os outros ficam desativados.
*/
import { hojeEmBrasilia } from "../../lib/cronograma-do-edital.js";
import { csvDosRecursos } from "../../lib/recursos-dos-candidatos.ts";
import {
  BUCKET_DOS_ANEXOS,
  caminhoDoAnexo,
  validarArquivoDoAnexo,
  VALIDADE_DO_DOWNLOAD,
} from "../../lib/anexos-do-recurso.js";
import {
  gerarDocx,
  MIME_DOCX,
  montarPaginaDeImpressao,
  nomeDoDocumento,
} from "../../lib/documento-da-resposta.js";
import { dadosDoModelo } from "../../lib/modelos-de-resposta.ts";

export const MENSAGEM_SEM_SESSAO =
  "Sessão não localizada. Entre de novo no MONITORA.";

const ESTADO_INICIAL: Readonly<SnapshotDosRecursos> = Object.freeze({
  area: "",
  dados: null,
  carregado: false,
  erroAoCarregar: "",
  semSessao: false,
  atualizando: false,
  carregadoEm: 0,
  /** A ação em curso, `{ tipo, rotulo }`, ou `null`. */
  acao: null,
  /** id do recurso aberto na gaveta, ou `null`. */
  gaveta: null,
  /** id → detalhe (`get_recurso_candidato_detalhe`) ou `{ erro }`. */
  detalhes: new Map(),
  /** id → `obter_ajustes_pontuacao_recurso` ou `{ erro }`. */
  ajustes: new Map(),
  /** id → dados da Classificação para a prévia (`obter_dados_previa_ajuste`) ou `{ erro }`. */
  previas: new Map(),
  /** `{ modo: "novo" | "edicao", id, abertura }` ou `null`. */
  formulario: null,
  /** Gaveta "Modelos de resposta" (administração) aberta. */
  modelosAbertos: false,
  /** `listar_modelos_resposta_recurso` ou `{ erro }`; `null` antes de pedir. */
  modelosAdmin: null,
  /*
    Comemorações ligadas (a situação do sistema que o app leu na entrada;
    o controlador relê a cada abertura da tela):
    mostra o selo "No prazo" / "Fora do prazo" nos recursos decididos.
  */
  comemoracoes: false,
});

const mensagemDe = (erro: unknown) =>
  String(objetoDosRecursos(erro).message || erro || "erro desconhecido");

function mensagemDaCarga(erro: ErroDosRecursos | null) {
  if (erro?.code === "PGRST202")
    return "A aba Recursos ainda não foi publicada no banco.";
  if (erro?.code === "42501")
    return "Seu acesso não inclui os recursos desta área.";
  return mensagemDe(erro);
}

function baixarNoNavegador(conteudo: string, nome: string) {
  const arquivo = new Blob([conteudo], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(arquivo);
  const ancora = document.createElement("a");
  ancora.href = url;
  ancora.download = nome;
  ancora.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function baixarBlobNoNavegador(arquivo: Blob, nome: string) {
  const url = URL.createObjectURL(arquivo);
  const ancora = document.createElement("a");
  ancora.href = url;
  ancora.download = nome;
  ancora.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/*
  A URL assinada é pedida com `download` (o Storage responde como anexo): o
  navegador baixa sem sair da tela. Sem aba nova: depois das esperas do banco
  o clique já não conta como da pessoa, e o bloqueador de pop-up barraria.
*/
function baixarPeloEndereco(url: string) {
  const ancora = document.createElement("a");
  ancora.href = url;
  ancora.rel = "noopener noreferrer";
  ancora.click();
}

/*
  Impressão (e "Salvar como PDF") por um iframe escondido: a página é montada
  com elementos e texto (documento-da-resposta.js), sem HTML.
*/
function imprimirNoNavegador(texto: string, titulo: string) {
  const quadro = document.createElement("iframe");
  quadro.setAttribute("aria-hidden", "true");
  quadro.tabIndex = -1;
  quadro.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.append(quadro);
  const janela = quadro.contentWindow;
  if (!janela || !quadro.contentDocument) {
    quadro.remove();
    return;
  }
  montarPaginaDeImpressao(quadro.contentDocument, texto, { titulo });
  janela.addEventListener?.(
    "afterprint",
    () => setTimeout(() => quadro.remove(), 500),
    { once: true },
  );
  janela.focus?.();
  janela.print?.();
  setTimeout(() => quadro.remove(), 60_000);
}

function novoUuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function criarEstadoDosRecursos({
  supabase = null,
  toast = (mensagem: string) => console.info(mensagem),
  baixar = baixarNoNavegador,
  baixarArquivo = baixarBlobNoNavegador,
  abrirUrl = baixarPeloEndereco,
  imprimir = imprimirNoNavegador,
  novoId = novoUuid,
  agora = () => Date.now(),
}: OpcoesDoEstadoDosRecursos = {}) {
  let estado: SnapshotDosRecursos = ESTADO_INICIAL;
  let geracao = 0;
  let aberturas = 0;
  let pedido = 0;
  const ouvintes = new Set<() => void>();
  const ajustesPedidos = new Set<Id>();

  function publicar(mudancas: Partial<SnapshotDosRecursos>) {
    estado = { ...estado, ...mudancas };
    for (const ouvinte of ouvintes) ouvinte();
  }

  async function executar<T>(
    tipo: string,
    rotulo: string,
    fazer: (vigente: () => boolean) => Promise<T>,
  ) {
    if (estado.acao) return null;
    const minhaGeracao = geracao;
    const vigente = () => minhaGeracao === geracao;
    publicar({ acao: { tipo, rotulo } });
    try {
      const resultado = await fazer(vigente);
      return vigente() ? resultado : null;
    } catch (erro) {
      if (!vigente()) return null;
      throw erro;
    } finally {
      if (vigente()) publicar({ acao: null });
    }
  }

  /*
    Outro usuário na mesma aba (ou saiu da conta): o que era do anterior sai e
    um pedido em curso deixa de valer. A próxima abertura da tela recarrega.
  */
  function reiniciar() {
    pedido += 1;
    geracao += 1;
    ajustesPedidos.clear();
    publicar({
      ...ESTADO_INICIAL,
      detalhes: new Map(),
      ajustes: new Map(),
      previas: new Map(),
    });
  }
  let identidade: string | null | undefined;
  supabase?.auth?.onAuthStateChange?.((_evento, sessao) => {
    const atual = sessao?.user?.id || null;
    if (atual === identidade) return;
    // O primeiro aviso da página só registra quem é; não há o que limpar.
    if (identidade !== undefined || !atual) reiniciar();
    identidade = atual;
  });

  function cliente() {
    if (!supabase) throw new Error("Sem conexão com o banco.");
    return supabase;
  }
  function storage() {
    const armazenamento = cliente().storage;
    if (!armazenamento) throw new Error("Sem conexão com o Storage.");
    return armazenamento;
  }
  async function rpc(
    nome: RpcDosRecursos,
    argumentos?: Record<string, unknown>,
  ) {
    const { data, error } = await cliente().rpc(nome, argumentos);
    const bruto = objetoDosRecursos(error);
    const erro: ErroDosRecursos | null = error
      ? {
          message: mensagemDe(error),
          code: typeof bruto.code === "string" ? bruto.code : undefined,
          hint: typeof bruto.hint === "string" ? bruto.hint : undefined,
        }
      : null;
    return { data: metadadosDaRpcDosRecursos(data), error: erro, bruto: data };
  }
  const banco = { rpc };

  // ── Leitura ─────────────────────────────────────────────────────────────

  /*
    Troca de área descarta o que era da outra (skeleton de novo); na mesma
    área, a tela fica e a releitura corre por trás. Resposta de um pedido
    antigo (a área mudou no meio) é ignorada. O recurso aberto (na gaveta ou
    na edição) guarda o detalhe, o ajuste e a prévia até a releitura deles
    chegar: o que a pessoa está digitando não some.
  */
  async function carregar(area = estado.area) {
    if (!area) return false;
    const meu = ++pedido;
    if (area !== estado.area) {
      geracao += 1;
      ajustesPedidos.clear();
      publicar({
        ...ESTADO_INICIAL,
        area,
        detalhes: new Map(),
        ajustes: new Map(),
        previas: new Map(),
        comemoracoes: estado.comemoracoes,
      });
    } else {
      publicar({ atualizando: true, erroAoCarregar: "" });
    }
    if (!supabase) {
      publicar({
        erroAoCarregar: "Sem conexão com o banco.",
        atualizando: false,
      });
      return false;
    }
    // Aberto fora do MONITORA (ou com a sessão vencida): sem sessão, nada a pedir.
    if (supabase.auth?.getSession) {
      const { data: sessao } = await supabase.auth.getSession();
      if (meu !== pedido) return false;
      if (!sessao?.session) {
        publicar({
          erroAoCarregar: MENSAGEM_SEM_SESSAO,
          semSessao: true,
          atualizando: false,
        });
        return false;
      }
    }
    const { data, error } = await banco.rpc("get_recursos_da_area", {
      p_area: area,
    });
    if (meu !== pedido) return false;
    if (error) {
      const mensagem = mensagemDaCarga(error);
      if (estado.carregado) {
        publicar({ atualizando: false });
        toast(`Não foi possível atualizar os recursos: ${mensagem}`, "error");
      } else publicar({ erroAoCarregar: mensagem, atualizando: false });
      return false;
    }
    const abertos = [estado.gaveta, estado.formulario?.id].filter(
      (id): id is Id => id !== null && id !== undefined,
    );
    const soDosAbertos = <T>(mapa: Map<Id, T>) =>
      new Map([...mapa].filter(([id]) => abertos.includes(id)));
    publicar({
      dados: normalizarDadosDosRecursos(data),
      carregado: true,
      erroAoCarregar: "",
      atualizando: false,
      carregadoEm: agora(),
      detalhes: soDosAbertos(estado.detalhes),
      ajustes: soDosAbertos(estado.ajustes),
      previas: soDosAbertos(estado.previas),
    });
    for (const id of new Set(abertos)) {
      void carregarDetalhe(id);
      if (estado.ajustes.has(id)) void carregarAjustes(id);
      if (estado.previas.has(id)) void lerDadosDaPrevia(id, { manter: true });
    }
    return true;
  }

  async function carregarDetalhe(id: Id) {
    const minhaGeracao = geracao;
    const { data, error } = await banco.rpc("get_recurso_candidato_detalhe", {
      p_id: id,
    });
    if (minhaGeracao !== geracao) return null;
    const detalhes = new Map(estado.detalhes);
    detalhes.set(
      id,
      error ? { erro: mensagemDe(error) } : normalizarDetalheDoRecurso(data),
    );
    publicar({ detalhes });
  }

  /* Sem o detalhe, ou com a leitura anterior em erro, pede de novo. */
  function garantirDetalhe(id: Id) {
    const detalhe = estado.detalhes.get(id);
    if (!detalhe || detalhe.erro) void carregarDetalhe(id);
  }

  function abrirGaveta(id: Id) {
    publicar({ gaveta: id });
    garantirDetalhe(id);
  }

  const fecharGaveta = () => publicar({ gaveta: null });

  function abrirNovo() {
    aberturas += 1;
    publicar({ formulario: { modo: "novo", id: null, abertura: aberturas } });
  }

  function abrirEdicao(id: Id) {
    aberturas += 1;
    publicar({ formulario: { modo: "edicao", id, abertura: aberturas } });
    garantirDetalhe(id);
  }

  const fecharFormulario = () => publicar({ formulario: null });

  /** Candidatos das análises do edital; lança se o banco recusar. */
  async function buscarCandidatos(editalId: Id, busca: string) {
    const { data, error } = await cliente().rpc("buscar_candidatos_recurso", {
      p_edital_id: editalId,
      p_busca: busca,
    });
    if (error) throw new Error(mensagemDe(error));
    return normalizarCandidatosDosRecursos(data);
  }

  // ── Escrita ─────────────────────────────────────────────────────────────

  /*
    `{ ok: true, id }`, `{ duplicado: nº }` (o banco achou outro em análise e
    a pessoa ainda não confirmou) ou `{ erro }`.
  */
  function salvar(dados: ReturnType<typeof dadosParaSalvar>) {
    const edicao = "id" in dados && Boolean(dados.id);
    return executar("salvar", "Salvando…", async (vigente) => {
      const { data, error } = await banco.rpc("salvar_recurso_candidato", {
        p_dados: dados,
      });
      if (!vigente()) return null;
      if (error) {
        if (error.code === "23505") {
          const numero = Number(String(error.hint || "").split(":")[1]);
          return { duplicado: Number.isFinite(numero) ? numero : true };
        }
        const mensagem =
          error.code === "40001"
            ? "Outra pessoa alterou este recurso. Recarregue e tente de novo."
            : mensagemDe(error);
        toast(`Não foi possível salvar: ${mensagem}`, "error");
        return { erro: mensagem };
      }
      toast(
        edicao
          ? `Recurso nº ${data?.nu ?? ""} atualizado.`
          : `Recurso nº ${data?.nu ?? ""} cadastrado.`,
        "ok",
      );
      publicar({ formulario: null });
      await carregar();
      return { ok: true, id: data?.id };
    });
  }

  /* A etapa entra na tela assim que o banco confirma; o histórico é relido. */
  function marcarEtapa<E extends EtapaDoRecurso>(
    id: Id,
    etapa: E,
    campo: `${NoInfer<E>}_em`,
    feita: boolean,
  ) {
    return executar(`etapa:${id}:${etapa}`, "Salvando…", async (vigente) => {
      const { data, error } = await banco.rpc("marcar_etapa_recurso", {
        p_id: id,
        p_etapa: etapa,
        p_feita: feita,
      });
      if (!vigente()) return null;
      if (error) {
        toast(`Não foi possível marcar a etapa: ${mensagemDe(error)}`, "error");
        return false;
      }
      if (estado.dados) {
        const recursos = estado.dados.recursos.map((r) =>
          r.id === id
            ? {
                ...r,
                [campo]: data?.em ?? null,
                revisao: data?.revisao ?? r.revisao,
              }
            : r,
        );
        publicar({ dados: { ...estado.dados, recursos } });
      }
      void carregarDetalhe(id);
      return true;
    });
  }

  function excluir(id: Id, motivo: string) {
    return executar("excluir", "Excluindo…", async (vigente) => {
      const { error } = await banco.rpc("excluir_recurso_candidato", {
        p_id: id,
        p_motivo: motivo,
      });
      if (!vigente()) return null;
      if (error) {
        toast(`Não foi possível excluir: ${mensagemDe(error)}`, "error");
        return false;
      }
      toast("Recurso excluído.", "ok");
      publicar({ gaveta: null, formulario: null });
      await carregar();
      return true;
    });
  }

  // ── Parecer jurídico (20261001170000) ──────────────────────────────────

  const AVISO_DO_PARECER = {
    enviar_parecer: "Recurso enviado para parecer jurídico.",
    deferir: "Recurso deferido.",
    deferir_parcialmente: "Recurso deferido parcialmente.",
    indeferir: "Recurso indeferido.",
    devolver: "Recurso devolvido para ajuste.",
    reabrir: "Decisão reaberta.",
  };

  /*
    Enviar para parecer, decidir, devolver ou reabrir. O banco confere quem
    pode (recursos_parecer) e a revisão; a aba é relida inteira (situação,
    KPIs e o detalhe da gaveta).
  */
  function transicionarRecurso(
    recurso: DadosDoRecurso,
    acao: AcaoDoParecer,
    texto = "",
  ) {
    return executar(`parecer:${acao}`, "Salvando…", async (vigente) => {
      const { error } = await banco.rpc("transicionar_recurso_candidato", {
        p_id: recurso.id,
        p_acao: acao,
        p_revisao: recurso.revisao,
        p_texto: String(texto || "").trim() || null,
      });
      if (!vigente()) return null;
      if (error) {
        const mensagem =
          error.code === "40001"
            ? "Outra pessoa alterou este recurso. Recarregue e tente de novo."
            : mensagemDe(error);
        toast(`Não foi possível concluir: ${mensagem}`, "error");
        return false;
      }
      toast(AVISO_DO_PARECER[acao] || "Recurso atualizado.", "ok");
      await carregar();
      return true;
    });
  }

  // ── Ajuste da pontuação (20261005130000) ──────────────────────────────

  function guardarAjustes(id: Id, valor: RegistroDosRecursos) {
    const ajustes = new Map(estado.ajustes);
    ajustes.set(id, valor);
    publicar({ ajustes });
  }

  /* As versões do ajuste do recurso (e quem pode propor/aprovar); um pedido por vez. */
  async function carregarAjustes(id: Id) {
    const minhaGeracao = geracao;
    if (ajustesPedidos.has(id)) return;
    ajustesPedidos.add(id);
    try {
      const { data, error } = await banco.rpc(
        "obter_ajustes_pontuacao_recurso",
        {
          p_recurso: id,
        },
      );
      if (minhaGeracao !== geracao) return null;
      guardarAjustes(id, error ? { erro: mensagemDe(error) } : data || {});
    } finally {
      if (minhaGeracao === geracao) ajustesPedidos.delete(id);
    }
  }

  /*
    Lê os dados da prévia. `manter` (a releitura da aba): uma falha deixa os
    dados que já estavam na tela.
  */
  async function lerDadosDaPrevia(id: Id, { manter = false } = {}) {
    const minhaGeracao = geracao;
    const { data, error } = await banco.rpc("obter_dados_previa_ajuste", {
      p_recurso: id,
    });
    if (minhaGeracao !== geracao) return null;
    const guardado = estado.previas.get(id);
    if (error && manter && guardado && !guardado.erro) return null;
    const previas = new Map(estado.previas);
    previas.set(id, error ? { erro: mensagemDe(error) } : data || {});
    publicar({ previas });
    return error ? null : data || {};
  }

  /*
    O que o motor da Classificação precisa para a prévia (só o parecer
    jurídico lê). Guardado por recurso (o aberto é relido a cada carga da
    aba); `forcar` relê (a aprovação recalcula com os dados de agora).
  */
  async function carregarDadosDaPrevia(id: Id, { forcar = false } = {}) {
    const guardado = estado.previas.get(id);
    if (guardado && !guardado.erro && !forcar) return guardado;
    if (guardado) {
      // A prévia antiga sai da tela enquanto a nova não chega.
      const limpas = new Map(estado.previas);
      limpas.delete(id);
      publicar({ previas: limpas });
    }
    return lerDadosDaPrevia(id);
  }

  const AVISO_DO_AJUSTE = {
    propor: "Ajuste da pontuação proposto.",
    aprovar: "Ajuste da pontuação aprovado: já vale na Classificação.",
    cancelar: "Ajuste da pontuação cancelado.",
  };

  /*
    Propor, aprovar ou cancelar. O banco confere quem pode (recursos_parecer)
    e a situação do recurso. Aprovar e cancelar mudam o recurso (a marca
    "mudou a classificação" e a revisão): a aba é relida inteira.
  */
  function escreverAjuste(
    recurso: DadosDoRecurso,
    acao: "propor" | "aprovar" | "cancelar",
    chamar: () => ReturnType<typeof banco.rpc>,
  ) {
    return executar(`ajuste:${acao}`, "Salvando…", async (vigente) => {
      const { data, error } = await chamar();
      if (!vigente()) return null;
      if (error) {
        toast(`Não foi possível concluir: ${mensagemDe(error)}`, "error");
        return false;
      }
      toast(AVISO_DO_AJUSTE[acao], "ok");
      if (acao === "propor") {
        guardarAjustes(recurso.id, data || {});
        await carregarDetalhe(recurso.id);
      } else await carregar();
      return true;
    });
  }

  const proporAjuste = (recurso: DadosDoRecurso, dados: RegistroDosRecursos) =>
    escreverAjuste(recurso, "propor", () =>
      banco.rpc("propor_ajuste_pontuacao", {
        p_recurso: recurso.id,
        p_dados: dados,
      }),
    );
  const aprovarAjuste = (
    recurso: DadosDoRecurso,
    ajusteId: Id,
    previa: RegistroDosRecursos,
  ) =>
    escreverAjuste(recurso, "aprovar", () =>
      banco.rpc("aprovar_ajuste_pontuacao", {
        p_ajuste: ajusteId,
        p_previa: previa,
      }),
    );
  const cancelarAjuste = (
    recurso: DadosDoRecurso,
    ajusteId: Id,
    motivo: string,
  ) =>
    escreverAjuste(recurso, "cancelar", () =>
      banco.rpc("cancelar_ajuste_pontuacao", {
        p_ajuste: ajusteId,
        p_motivo: String(motivo || "").trim(),
      }),
    );

  function exportarCsv(
    recursos: readonly RecursoDoPainel[],
    origens: readonly OrigemDoRecurso[],
  ) {
    const dia = hojeEmBrasilia(new Date(agora()));
    baixar(
      csvDosRecursos(recursos, origens),
      `recursos-${estado.area}-${dia}.csv`,
    );
  }

  // ── Resposta ao candidato (20260929230000) ─────────────────────────────

  /* O que a resposta ou um anexo muda no recurso, direto na lista da aba. */
  function atualizarRecursoNaLista(
    id: Id,
    mudar: (recurso: DadosDoRecurso) => Partial<DadosDoRecurso>,
  ) {
    if (!estado.dados) return;
    const recursos = estado.dados.recursos.map((r) =>
      r.id === id ? { ...r, ...mudar(r) } : r,
    );
    publicar({ dados: { ...estado.dados, recursos } });
  }

  const mensagemDaEscrita = (erro: ErroDosRecursos | null) =>
    erro?.code === "40001"
      ? "Outra pessoa alterou esta resposta. Recarregue e tente de novo."
      : mensagemDe(erro);

  /** Rascunho da resposta: `{ ok, id, revisao }` ou `{ erro }`. */
  function salvarResposta(recursoId: Id, dados: RegistroDosRecursos) {
    return executar("resposta:salvar", "Salvando…", async (vigente) => {
      const { data, error } = await banco.rpc("salvar_resposta_recurso", {
        p_dados: { recurso_id: recursoId, ...dados },
      });
      if (!vigente()) return null;
      if (error) {
        const mensagem = mensagemDaEscrita(error);
        toast(`Não foi possível salvar a resposta: ${mensagem}`, "error");
        return { erro: mensagem };
      }
      toast("Rascunho da resposta salvo.", "ok");
      atualizarRecursoNaLista(recursoId, () => ({
        resposta_estado: data?.estado || "rascunho",
      }));
      await carregarDetalhe(recursoId);
      return { ok: true, id: data?.id, revisao: data?.revisao };
    });
  }

  const AVISO_DA_TRANSICAO = {
    enviar_revisao: "Resposta enviada para revisão.",
    aprovar: "Resposta aprovada.",
    devolver: "Resposta devolvida para ajuste.",
    reabrir: "Resposta reaberta para edição.",
    marcar_enviada: "Resposta marcada como enviada ao candidato.",
  };

  /*
    Enviar para revisão, aprovar, devolver, reabrir ou marcar enviada. Marcar
    enviada também marca a etapa do recurso (e muda a revisão dele): a aba é
    relida inteira.
  */
  function transicionarResposta(
    recursoId: Id,
    resposta: Pick<DocumentoDaResposta, "id" | "revisao">,
    acao: AcaoDaResposta,
    comentario = "",
  ) {
    return executar(`resposta:${acao}`, "Salvando…", async (vigente) => {
      const { data, error } = await banco.rpc("transicionar_resposta_recurso", {
        p_resposta_id: resposta.id,
        p_acao: acao,
        p_revisao: resposta.revisao,
        p_comentario: String(comentario || "").trim() || null,
      });
      if (!vigente()) return null;
      if (error) {
        toast(
          `Não foi possível concluir: ${mensagemDaEscrita(error)}`,
          "error",
        );
        return false;
      }
      toast(AVISO_DA_TRANSICAO[acao] || "Resposta atualizada.", "ok");
      if (acao === "marcar_enviada") await carregar();
      else {
        atualizarRecursoNaLista(recursoId, () => ({
          resposta_estado: data?.estado,
        }));
        await carregarDetalhe(recursoId);
      }
      return true;
    });
  }

  // ── Anexos ──────────────────────────────────────────────────────────────

  const somarAnexos = (id: Id, quantos: number) =>
    atualizarRecursoNaLista(id, (r) => ({
      qt_anexos: Math.max(0, (Number(r.qt_anexos) || 0) + quantos),
    }));

  /* Envia ao bucket (caminho da área e do recurso) e registra no banco. */
  async function enviarERegistrar(
    recursoId: Id,
    arquivo: File,
    tipo: string,
    mime: string,
    respostaId: Id | null,
    vigente: () => boolean,
  ) {
    const caminho = caminhoDoAnexo(
      estado.area,
      recursoId,
      novoId(),
      arquivo.name,
    );
    const envio = await storage()
      .from(BUCKET_DOS_ANEXOS)
      .upload(caminho, arquivo, { contentType: mime, upsert: false });
    if (!vigente()) return;
    if (envio.error) throw new Error(mensagemDe(envio.error));
    const { error } = await banco.rpc("registrar_anexo_recurso", {
      p_recurso_id: recursoId,
      p_tipo: tipo,
      p_nome: arquivo.name,
      p_caminho: caminho,
      p_resposta_id: respostaId,
    });
    if (error) throw new Error(mensagemDe(error));
  }

  function enviarAnexo(recursoId: Id, arquivo: File, tipo: string) {
    const validacao = validarArquivoDoAnexo(arquivo);
    const mime = validacao.mime;
    if (validacao.erro || !mime) {
      toast(validacao.erro || "Tipo de arquivo não aceito.", "warn");
      return Promise.resolve(false);
    }
    return executar("anexo:enviar", "Enviando…", async (vigente) => {
      try {
        await enviarERegistrar(recursoId, arquivo, tipo, mime, null, vigente);
      } catch (erro) {
        if (!vigente()) return null;
        toast(`Não foi possível anexar: ${mensagemDe(erro)}`, "error");
        return false;
      }
      if (!vigente()) return null;
      toast("Arquivo anexado.", "ok");
      somarAnexos(recursoId, 1);
      await carregarDetalhe(recursoId);
      return true;
    });
  }

  function arquivarAnexo(recursoId: Id, anexoId: Id, motivo: string) {
    return executar(
      `anexo:arquivar:${anexoId}`,
      "Arquivando…",
      async (vigente) => {
        const { data, error } = await banco.rpc("arquivar_anexo_recurso", {
          p_anexo_id: anexoId,
          p_motivo: motivo,
        });
        if (!vigente()) return null;
        if (error) {
          toast(`Não foi possível arquivar: ${mensagemDe(error)}`, "error");
          return false;
        }
        toast("Anexo arquivado. O arquivo continua guardado.", "ok");
        if (data?.alterou !== false) somarAnexos(recursoId, -1);
        await carregarDetalhe(recursoId);
        return true;
      },
    );
  }

  /*
    O banco registra o download e devolve o caminho; só então o Storage aceita
    gerar a URL assinada (a política de leitura procura esse registro), que
    vale 60 segundos.
  */
  function baixarAnexo(anexo: { id: Id }) {
    return executar(`anexo:baixar:${anexo.id}`, "Abrindo…", async (vigente) => {
      const { data, error } = await banco.rpc(
        "registrar_download_anexo_recurso",
        {
          p_anexo_id: anexo.id,
        },
      );
      if (!vigente()) return null;
      if (error || !data?.caminho) {
        toast(
          `Não foi possível baixar: ${mensagemDe(error || "anexo sem caminho")}`,
          "error",
        );
        return false;
      }
      const assinada = await storage()
        .from(BUCKET_DOS_ANEXOS)
        .createSignedUrl(data.caminho, VALIDADE_DO_DOWNLOAD, {
          download: data.nome || true,
        });
      if (!vigente()) return null;
      if (assinada.error || !assinada.data?.signedUrl) {
        toast(
          `Não foi possível baixar: ${mensagemDe(assinada.error || "sem endereço")}`,
          "error",
        );
        return false;
      }
      abrirUrl(assinada.data.signedUrl);
      return true;
    });
  }

  // ── Documento da resposta ──────────────────────────────────────────────

  const tituloDoDocumento = (recurso: DadosDoRecurso) =>
    `Resposta ao recurso nº ${recurso.nu ?? ""}`.trim();
  const docxDaResposta = (
    recurso: DadosDoRecurso,
    resposta: DocumentoDaResposta,
  ) =>
    gerarDocx(resposta.texto_final, {
      titulo: tituloDoDocumento(recurso),
      quando: new Date(agora()),
    });

  /** Página de impressão: o navegador imprime ou salva em PDF. */
  function imprimirResposta(
    recurso: DadosDoRecurso,
    resposta: DocumentoDaResposta,
  ) {
    imprimir(resposta.texto_final, nomeDoDocumento(recurso));
  }

  function baixarDocx(recurso: DadosDoRecurso, resposta: DocumentoDaResposta) {
    baixarArquivo(
      new Blob([docxDaResposta(recurso, resposta)], { type: MIME_DOCX }),
      `${nomeDoDocumento(recurso)}.docx`,
    );
  }

  /** O .docx da resposta vira anexo do recurso (tipo "resposta"). */
  function anexarDocx(recurso: DadosDoRecurso, resposta: DocumentoDaResposta) {
    return executar("anexo:documento", "Anexando…", async (vigente) => {
      const arquivo = new File(
        [docxDaResposta(recurso, resposta)],
        `${nomeDoDocumento(recurso)}.docx`,
        { type: MIME_DOCX },
      );
      try {
        await enviarERegistrar(
          recurso.id,
          arquivo,
          "resposta",
          MIME_DOCX,
          resposta.id,
          vigente,
        );
      } catch (erro) {
        if (!vigente()) return null;
        toast(
          `Não foi possível anexar o documento: ${mensagemDe(erro)}`,
          "error",
        );
        return false;
      }
      if (!vigente()) return null;
      toast("Documento da resposta anexado ao recurso.", "ok");
      somarAnexos(recurso.id, 1);
      await carregarDetalhe(recurso.id);
      return true;
    });
  }

  // ── Modelos de resposta (administração) ────────────────────────────────

  async function carregarModelos() {
    const minhaGeracao = geracao;
    const { data, error } = await banco.rpc("listar_modelos_resposta_recurso");
    if (minhaGeracao !== geracao) return null;
    publicar({
      modelosAdmin: error
        ? normalizarDadosDosModelos({ erro: mensagemDe(error) })
        : normalizarDadosDosModelos(data),
    });
  }

  function abrirModelos() {
    publicar({ modelosAbertos: true, modelosAdmin: null });
    void carregarModelos();
  }

  const fecharModelos = () => publicar({ modelosAbertos: false });

  /* Salvar cria a versão seguinte; a aba é relida (os modelos da gaveta). */
  function salvarModelo(rascunho: {
    id?: Id | null;
    versao?: number | null;
    nome: string;
    situacao: string;
    origem: string;
    area: string;
    corpo: string;
  }) {
    return executar("modelo:salvar", "Salvando…", async (vigente) => {
      const { data, error } = await banco.rpc(
        "salvar_modelo_resposta_recurso",
        {
          p_dados: dadosDoModelo(rascunho),
        },
      );
      if (!vigente()) return null;
      if (error) {
        const mensagem =
          error.code === "40001"
            ? "Outra pessoa alterou este modelo. Recarregue e tente de novo."
            : mensagemDe(error);
        toast(`Não foi possível salvar o modelo: ${mensagem}`, "error");
        return { erro: mensagem };
      }
      toast(
        data?.criou_versao === false
          ? "Nada mudou no modelo."
          : `Modelo salvo (versão ${data?.versao ?? 1}).`,
        "ok",
      );
      await carregarModelos();
      if (vigente()) void carregar();
      return { ok: true, id: data?.id, versao: data?.versao };
    });
  }

  function arquivarModelo(id: Id, motivo: string) {
    return executar(`modelo:arquivar:${id}`, "Arquivando…", async (vigente) => {
      const { error } = await banco.rpc("arquivar_modelo_resposta_recurso", {
        p_modelo_id: id,
        p_motivo: motivo,
      });
      if (!vigente()) return null;
      if (error) {
        toast(`Não foi possível arquivar: ${mensagemDe(error)}`, "error");
        return false;
      }
      toast("Modelo arquivado.", "ok");
      await carregarModelos();
      if (vigente()) void carregar();
      return true;
    });
  }

  return {
    transicionarRecurso,
    carregarAjustes,
    carregarDadosDaPrevia,
    proporAjuste,
    aprovarAjuste,
    cancelarAjuste,
    salvarResposta,
    transicionarResposta,
    enviarAnexo,
    arquivarAnexo,
    baixarAnexo,
    imprimirResposta,
    baixarDocx,
    anexarDocx,
    abrirModelos,
    fecharModelos,
    carregarModelos,
    salvarModelo,
    arquivarModelo,
    assinar(ouvinte: () => void) {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
    obter: () => estado,
    carregar,
    carregarDetalhe,
    abrirGaveta,
    fecharGaveta,
    abrirNovo,
    abrirEdicao,
    fecharFormulario,
    buscarCandidatos,
    salvar,
    marcarEtapa,
    excluir,
    exportarCsv,
    reiniciar,
    definirComemoracoes: (ligadas: boolean) =>
      publicar({ comemoracoes: ligadas === true }),
  };
}
