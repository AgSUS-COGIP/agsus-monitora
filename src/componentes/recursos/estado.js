/*
  Estado do painel de recursos (`recursos.html`), fora do React: o que o
  banco devolve para a área do painel (`?area=`), o recurso aberto na gaveta
  (com o detalhe e o histórico), o formulário aberto e as ações que escrevem
  no banco. Os componentes leem com `useSyncExternalStore`. Este arquivo não
  importa React.

  Tudo passa por RPC (supabase/migrations/20260929120000_recursos.sql):
  `get_recursos_da_area` numa chamada só (json), o detalhe sob demanda, a
  busca do candidato nas análises do edital e as três escritas. O banco confere
  permissão e área em todas; `pode_editar` vem dele. A resposta escrita, os
  anexos (bucket privado `recursos-anexos`, com URL assinada depois do registro
  do download) e os modelos de resposta são de
  20260929230000_recursos_modelos_anexos_respostas.sql.

  Sem tela de carregamento: antes da primeira carga o painel é o skeleton
  (`carregado` falso); uma falha nela vira `erroAoCarregar`, com "Tentar
  novamente". Sem sessão do Supabase Auth (painel aberto fora do MONITORA),
  `semSessao`. Uma ação por vez (`executar`): o botão dela mostra o rótulo, os
  outros ficam desativados.
*/
import { csvDosRecursos } from "../../lib/recursos-dos-candidatos.js";
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
import { dadosDoModelo } from "../../lib/modelos-de-resposta.js";

export const MENSAGEM_SEM_SESSAO =
  "Sessão não localizada. Abra este painel pelo menu do MONITORA para compartilhar a sessão do Supabase Auth.";

const ESTADO_INICIAL = Object.freeze({
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
  /** `{ modo: "novo" | "edicao", id, abertura }` ou `null`. */
  formulario: null,
  /** Gaveta "Modelos de resposta" (administração) aberta. */
  modelosAbertos: false,
  /** `listar_modelos_resposta_recurso` ou `{ erro }`; `null` antes de pedir. */
  modelosAdmin: null,
});

const mensagemDe = (erro) =>
  String(erro?.message || erro || "erro desconhecido");

function mensagemDaCarga(erro) {
  if (erro?.code === "PGRST202")
    return "A aba Recursos ainda não foi publicada no banco.";
  if (erro?.code === "42501")
    return "Seu acesso não inclui os recursos desta área.";
  return mensagemDe(erro);
}

function baixarNoNavegador(conteudo, nome) {
  const arquivo = new Blob([conteudo], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(arquivo);
  const ancora = document.createElement("a");
  ancora.href = url;
  ancora.download = nome;
  ancora.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function baixarBlobNoNavegador(arquivo, nome) {
  const url = URL.createObjectURL(arquivo);
  const ancora = document.createElement("a");
  ancora.href = url;
  ancora.download = nome;
  ancora.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* A URL assinada abre numa aba nova, sem dar acesso a esta (noopener). */
function abrirNoNavegador(url) {
  const ancora = document.createElement("a");
  ancora.href = url;
  ancora.target = "_blank";
  ancora.rel = "noopener noreferrer";
  ancora.click();
}

/*
  Impressão (e "Salvar como PDF") por um iframe escondido: a página é montada
  com elementos e texto (documento-da-resposta.js), sem HTML.
*/
function imprimirNoNavegador(texto, titulo) {
  const quadro = document.createElement("iframe");
  quadro.setAttribute("aria-hidden", "true");
  quadro.tabIndex = -1;
  quadro.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.append(quadro);
  montarPaginaDeImpressao(quadro.contentDocument, texto, { titulo });
  const janela = quadro.contentWindow;
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
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function criarEstadoDosRecursos({
  supabase = null,
  toast = (mensagem) => console.info(mensagem),
  baixar = baixarNoNavegador,
  baixarArquivo = baixarBlobNoNavegador,
  abrirUrl = abrirNoNavegador,
  imprimir = imprimirNoNavegador,
  novoId = novoUuid,
  agora = () => Date.now(),
} = {}) {
  let estado = ESTADO_INICIAL;
  let aberturas = 0;
  let pedido = 0;
  const ouvintes = new Set();

  function publicar(mudancas) {
    estado = { ...estado, ...mudancas };
    for (const ouvinte of ouvintes) ouvinte();
  }

  async function executar(tipo, rotulo, fazer) {
    if (estado.acao) return null;
    publicar({ acao: { tipo, rotulo } });
    try {
      return await fazer();
    } finally {
      publicar({ acao: null });
    }
  }

  // ── Leitura ─────────────────────────────────────────────────────────────

  /*
    Troca de área descarta o que era da outra (skeleton de novo); na mesma
    área, a tela fica e a releitura corre por trás. Resposta de um pedido
    antigo (a área mudou no meio) é ignorada.
  */
  async function carregar(area = estado.area) {
    if (!area) return false;
    const meu = ++pedido;
    if (area !== estado.area) {
      publicar({ ...ESTADO_INICIAL, area, detalhes: new Map() });
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
    const { data, error } = await supabase.rpc("get_recursos_da_area", {
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
    publicar({
      dados: data || {
        recursos: [],
        cronogramas: [],
        origens: [],
        editais: [],
      },
      carregado: true,
      erroAoCarregar: "",
      atualizando: false,
      carregadoEm: agora(),
      detalhes: new Map(),
    });
    if (estado.gaveta) void carregarDetalhe(estado.gaveta);
    return true;
  }

  async function carregarDetalhe(id) {
    const { data, error } = await supabase.rpc(
      "get_recurso_candidato_detalhe",
      { p_id: id },
    );
    const detalhes = new Map(estado.detalhes);
    detalhes.set(id, error ? { erro: mensagemDe(error) } : data || {});
    publicar({ detalhes });
  }

  function abrirGaveta(id) {
    publicar({ gaveta: id });
    if (!estado.detalhes.has(id)) void carregarDetalhe(id);
  }

  const fecharGaveta = () => publicar({ gaveta: null });

  function abrirNovo() {
    aberturas += 1;
    publicar({ formulario: { modo: "novo", id: null, abertura: aberturas } });
  }

  function abrirEdicao(id) {
    aberturas += 1;
    publicar({ formulario: { modo: "edicao", id, abertura: aberturas } });
    if (!estado.detalhes.has(id)) void carregarDetalhe(id);
  }

  const fecharFormulario = () => publicar({ formulario: null });

  /** Candidatos das análises do edital; lança se o banco recusar. */
  async function buscarCandidatos(editalId, busca) {
    const { data, error } = await supabase.rpc("buscar_candidatos_recurso", {
      p_edital_id: editalId,
      p_busca: busca,
    });
    if (error) throw new Error(mensagemDe(error));
    return Array.isArray(data) ? data : [];
  }

  // ── Escrita ─────────────────────────────────────────────────────────────

  /*
    `{ ok: true, id }`, `{ duplicado: nº }` (o banco achou outro em análise e
    a pessoa ainda não confirmou) ou `{ erro }`.
  */
  function salvar(dados) {
    const edicao = Boolean(dados.id);
    return executar("salvar", "Salvando…", async () => {
      const { data, error } = await supabase.rpc("salvar_recurso_candidato", {
        p_dados: dados,
      });
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
  function marcarEtapa(id, etapa, campo, feita) {
    return executar(`etapa:${id}:${etapa}`, "Salvando…", async () => {
      const { data, error } = await supabase.rpc("marcar_etapa_recurso", {
        p_id: id,
        p_etapa: etapa,
        p_feita: feita,
      });
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

  function excluir(id, motivo) {
    return executar("excluir", "Excluindo…", async () => {
      const { error } = await supabase.rpc("excluir_recurso_candidato", {
        p_id: id,
        p_motivo: motivo,
      });
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

  function exportarCsv(recursos, origens) {
    const dia = new Date(agora()).toISOString().slice(0, 10);
    baixar(
      csvDosRecursos(recursos, origens),
      `recursos-${estado.area}-${dia}.csv`,
    );
  }

  // ── Resposta ao candidato (20260929230000) ─────────────────────────────

  /* O que a resposta ou um anexo muda no recurso, direto na lista da aba. */
  function atualizarRecursoNaLista(id, mudar) {
    if (!estado.dados) return;
    const recursos = estado.dados.recursos.map((r) =>
      r.id === id ? { ...r, ...mudar(r) } : r,
    );
    publicar({ dados: { ...estado.dados, recursos } });
  }

  const mensagemDaEscrita = (erro) =>
    erro?.code === "40001"
      ? "Outra pessoa alterou esta resposta. Recarregue e tente de novo."
      : mensagemDe(erro);

  /** Rascunho da resposta: `{ ok, id, revisao }` ou `{ erro }`. */
  function salvarResposta(recursoId, dados) {
    return executar("resposta:salvar", "Salvando…", async () => {
      const { data, error } = await supabase.rpc("salvar_resposta_recurso", {
        p_dados: { recurso_id: recursoId, ...dados },
      });
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
  function transicionarResposta(recursoId, resposta, acao, comentario = "") {
    return executar(`resposta:${acao}`, "Salvando…", async () => {
      const { data, error } = await supabase.rpc(
        "transicionar_resposta_recurso",
        {
          p_resposta_id: resposta.id,
          p_acao: acao,
          p_revisao: resposta.revisao,
          p_comentario: String(comentario || "").trim() || null,
        },
      );
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

  const somarAnexos = (id, quantos) =>
    atualizarRecursoNaLista(id, (r) => ({
      qt_anexos: Math.max(0, (Number(r.qt_anexos) || 0) + quantos),
    }));

  /* Envia ao bucket (caminho da área e do recurso) e registra no banco. */
  async function enviarERegistrar(recursoId, arquivo, tipo, mime, respostaId) {
    const caminho = caminhoDoAnexo(
      estado.area,
      recursoId,
      novoId(),
      arquivo.name,
    );
    const envio = await supabase.storage
      .from(BUCKET_DOS_ANEXOS)
      .upload(caminho, arquivo, { contentType: mime, upsert: false });
    if (envio.error) throw new Error(mensagemDe(envio.error));
    const { error } = await supabase.rpc("registrar_anexo_recurso", {
      p_recurso_id: recursoId,
      p_tipo: tipo,
      p_nome: arquivo.name,
      p_caminho: caminho,
      p_resposta_id: respostaId,
    });
    if (error) throw new Error(mensagemDe(error));
  }

  function enviarAnexo(recursoId, arquivo, tipo) {
    const validacao = validarArquivoDoAnexo(arquivo);
    if (validacao.erro) {
      toast(validacao.erro, "warn");
      return Promise.resolve(false);
    }
    return executar("anexo:enviar", "Enviando…", async () => {
      try {
        await enviarERegistrar(recursoId, arquivo, tipo, validacao.mime, null);
      } catch (erro) {
        toast(`Não foi possível anexar: ${mensagemDe(erro)}`, "error");
        return false;
      }
      toast("Arquivo anexado.", "ok");
      somarAnexos(recursoId, 1);
      await carregarDetalhe(recursoId);
      return true;
    });
  }

  function arquivarAnexo(recursoId, anexoId, motivo) {
    return executar(`anexo:arquivar:${anexoId}`, "Arquivando…", async () => {
      const { data, error } = await supabase.rpc("arquivar_anexo_recurso", {
        p_anexo_id: anexoId,
        p_motivo: motivo,
      });
      if (error) {
        toast(`Não foi possível arquivar: ${mensagemDe(error)}`, "error");
        return false;
      }
      toast("Anexo arquivado. O arquivo continua guardado.", "ok");
      if (data?.alterou !== false) somarAnexos(recursoId, -1);
      await carregarDetalhe(recursoId);
      return true;
    });
  }

  /*
    O banco registra o download e devolve o caminho; só então o Storage aceita
    gerar a URL assinada (a política de leitura procura esse registro), que
    vale 60 segundos.
  */
  function baixarAnexo(anexo) {
    return executar(`anexo:baixar:${anexo.id}`, "Abrindo…", async () => {
      const { data, error } = await supabase.rpc(
        "registrar_download_anexo_recurso",
        { p_anexo_id: anexo.id },
      );
      if (error || !data?.caminho) {
        toast(
          `Não foi possível baixar: ${mensagemDe(error || "anexo sem caminho")}`,
          "error",
        );
        return false;
      }
      const assinada = await supabase.storage
        .from(BUCKET_DOS_ANEXOS)
        .createSignedUrl(data.caminho, VALIDADE_DO_DOWNLOAD, {
          download: data.nome || true,
        });
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

  const tituloDoDocumento = (recurso) =>
    `Resposta ao recurso nº ${recurso.nu ?? ""}`.trim();
  const docxDaResposta = (recurso, resposta) =>
    gerarDocx(resposta.texto_final, {
      titulo: tituloDoDocumento(recurso),
      quando: new Date(agora()),
    });

  /** Página de impressão: o navegador imprime ou salva em PDF. */
  function imprimirResposta(recurso, resposta) {
    imprimir(resposta.texto_final, nomeDoDocumento(recurso));
  }

  function baixarDocx(recurso, resposta) {
    baixarArquivo(
      new Blob([docxDaResposta(recurso, resposta)], { type: MIME_DOCX }),
      `${nomeDoDocumento(recurso)}.docx`,
    );
  }

  /** O .docx da resposta vira anexo do recurso (tipo "resposta"). */
  function anexarDocx(recurso, resposta) {
    return executar("anexo:documento", "Anexando…", async () => {
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
        );
      } catch (erro) {
        toast(
          `Não foi possível anexar o documento: ${mensagemDe(erro)}`,
          "error",
        );
        return false;
      }
      toast("Documento da resposta anexado ao recurso.", "ok");
      somarAnexos(recurso.id, 1);
      await carregarDetalhe(recurso.id);
      return true;
    });
  }

  // ── Modelos de resposta (administração) ────────────────────────────────

  async function carregarModelos() {
    const { data, error } = await supabase.rpc(
      "listar_modelos_resposta_recurso",
    );
    publicar({
      modelosAdmin: error
        ? { erro: mensagemDe(error) }
        : data || { modelos: [], areas: [], origens: [], marcadores: [] },
    });
  }

  function abrirModelos() {
    publicar({ modelosAbertos: true, modelosAdmin: null });
    void carregarModelos();
  }

  const fecharModelos = () => publicar({ modelosAbertos: false });

  /* Salvar cria a versão seguinte; a aba é relida (os modelos da gaveta). */
  function salvarModelo(rascunho) {
    return executar("modelo:salvar", "Salvando…", async () => {
      const { data, error } = await supabase.rpc(
        "salvar_modelo_resposta_recurso",
        { p_dados: dadosDoModelo(rascunho) },
      );
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
      void carregar();
      return { ok: true, id: data?.id, versao: data?.versao };
    });
  }

  function arquivarModelo(id, motivo) {
    return executar(`modelo:arquivar:${id}`, "Arquivando…", async () => {
      const { error } = await supabase.rpc("arquivar_modelo_resposta_recurso", {
        p_modelo_id: id,
        p_motivo: motivo,
      });
      if (error) {
        toast(`Não foi possível arquivar: ${mensagemDe(error)}`, "error");
        return false;
      }
      toast("Modelo arquivado.", "ok");
      await carregarModelos();
      void carregar();
      return true;
    });
  }

  return {
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
    assinar(ouvinte) {
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
  };
}
