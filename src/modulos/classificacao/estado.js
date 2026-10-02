/*
  Estado da tela de Classificação (`#page-classificacao`), fora do React. Os
  componentes leem com `useSyncExternalStore`. Este arquivo não importa React.

  RPCs (supabase/migrations/20261002150000_classificacao.sql; contrato em
  src/lib/rpc-contrato.js):
    listar_editais_classificacao(p_area)     os editais da área atual
    obter_classificacao_do_edital(p_edital)  regra, quadro, análises,
                                             entrevistas, listas e desempates
    salvar_regra_classificacao(...)          nova versão da regra
    registrar_lista_classificacao(...)       "Gerar": retrato + hash do banco
    publicar_lista_classificacao(p_lista)
    obter_lista_classificacao(p_lista)       retrato de uma geração anterior
    registrar_desempate_classificacao(...)   sorteio ou decisão manual

  A conta é do motor puro (src/lib/classificacao/motor.js), feita no
  componente a partir de `dados`; aqui só a carga, a gravação e a exportação.

  Sessão: o cliente Supabase único do app. Outro usuário na mesma aba: tudo
  volta ao início.
*/
import { MIME_DOCX } from "../../lib/documento-da-resposta.js";
import {
  documentoDaLista,
  gerarDocxDaLista,
  gerarXlsxDaLista,
  instantaneoDaLista,
  MIME_XLSX,
  montarPaginaDaLista,
  nomeDoArquivo,
} from "../../lib/classificacao/exportacao.js";
import { normalizarRegra } from "../../lib/classificacao/regra.js";
import {
  comTempoLimite,
  ehFalhaDeConexao,
  mensagemDeFalha,
} from "../../lib/falha-de-rede.js";

/* As RPCs (src/lib/rpc-contrato.js); chamadas por `rpc()`, com tempo limite. */
const RPC_LISTAR_EDITAIS = "listar_editais_classificacao";
const RPC_OBTER_EDITAL = "obter_classificacao_do_edital";
const RPC_SALVAR_REGRA = "salvar_regra_classificacao";
const RPC_REGISTRAR_LISTA = "registrar_lista_classificacao";
const RPC_PUBLICAR_LISTA = "publicar_lista_classificacao";
const RPC_OBTER_LISTA = "obter_lista_classificacao";
const RPC_REGISTRAR_DESEMPATE = "registrar_desempate_classificacao";

export const MENSAGEM_SEM_ACESSO = "Sem acesso à Classificação";
const TEMPO_LIMITE_MS = 45000;

const ESTADO_INICIAL = Object.freeze({
  area: "",
  editais: [],
  podeEditar: false,
  carregado: false,
  carregandoEditais: false,
  erroAoCarregar: "",
  semAcesso: false,
  editalId: "",
  dados: null,
  carregandoEdital: false,
  erroDoEdital: "",
  salvando: false,
  gerando: false,
});

function mensagemDoBanco(erro) {
  if (erro?.code === "PGRST202")
    return "A aba Classificação ainda não foi publicada no banco.";
  if (erro?.code === "42501")
    return "Seu acesso não inclui a classificação desta área ou deste edital.";
  if (erro?.code === "40001")
    return erro.message || "A regra mudou desde que você abriu; recarregue.";
  if (ehFalhaDeConexao(erro)) return mensagemDeFalha(erro);
  return erro?.message || mensagemDeFalha(erro);
}

function baixarNoNavegador(bytes, nome, tipo) {
  const arquivo = new Blob([bytes], { type: tipo });
  const url = URL.createObjectURL(arquivo);
  const ancora = document.createElement("a");
  ancora.href = url;
  ancora.download = nome;
  ancora.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* Impressão ("Salvar como PDF") por um iframe escondido, montado com elementos e texto. */
function imprimirNoNavegador(doc) {
  const quadro = document.createElement("iframe");
  quadro.setAttribute("aria-hidden", "true");
  quadro.tabIndex = -1;
  quadro.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.append(quadro);
  montarPaginaDaLista(quadro.contentDocument, doc);
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

export function criarEstadoDaClassificacao({
  supabase = null,
  toast = (mensagem) => console.info(mensagem),
  baixar = baixarNoNavegador,
  imprimir = imprimirNoNavegador,
  tempoLimiteMs = TEMPO_LIMITE_MS,
} = {}) {
  let estado = ESTADO_INICIAL;
  let pedidoDosEditais = 0;
  let pedidoDoEdital = 0;
  const ouvintes = new Set();

  function publicar(mudancas) {
    estado = { ...estado, ...mudancas };
    for (const ouvinte of ouvintes) ouvinte();
  }

  function reiniciar() {
    pedidoDosEditais += 1;
    pedidoDoEdital += 1;
    publicar(ESTADO_INICIAL);
  }
  let identidade;
  supabase?.auth?.onAuthStateChange?.((_evento, sessao) => {
    const atual = sessao?.user?.id || null;
    if (atual === identidade) return;
    if (identidade !== undefined || !atual) reiniciar();
    identidade = atual;
  });

  async function rpc(nome, argumentos) {
    if (!supabase) throw new Error("Sem conexão com o banco.");
    const { data, error } = await comTempoLimite(
      supabase.rpc(nome, argumentos),
      tempoLimiteMs,
    );
    if (error) throw error;
    return data;
  }

  /* Os editais da área. Troca de área recomeça do zero. */
  async function carregar(area = estado.area) {
    if (!area) return false;
    const meu = ++pedidoDosEditais;
    if (area !== estado.area) {
      pedidoDoEdital += 1;
      publicar({ ...ESTADO_INICIAL, area, carregandoEditais: true });
    } else publicar({ carregandoEditais: true, erroAoCarregar: "" });
    try {
      const dados = await rpc(RPC_LISTAR_EDITAIS, { p_area: area });
      if (meu !== pedidoDosEditais) return false;
      const editais = Array.isArray(dados?.editais) ? dados.editais : [];
      const escolhido = editais.some((e) => e.id === estado.editalId)
        ? estado.editalId
        : "";
      publicar({
        editais,
        podeEditar: Boolean(dados?.pode_editar),
        carregado: true,
        carregandoEditais: false,
        semAcesso: false,
        erroAoCarregar: "",
        editalId: escolhido,
      });
      if (escolhido) void escolherEdital(escolhido);
      return true;
    } catch (erro) {
      if (meu !== pedidoDosEditais) return false;
      publicar({
        carregandoEditais: false,
        carregado: estado.carregado,
        semAcesso: erro?.code === "42501",
        erroAoCarregar: mensagemDoBanco(erro),
      });
      return false;
    }
  }

  /* O edital escolhido: tudo o que o motor precisa. */
  async function escolherEdital(id) {
    const meu = ++pedidoDoEdital;
    if (!id) {
      publicar({
        editalId: "",
        dados: null,
        carregandoEdital: false,
        erroDoEdital: "",
      });
      return false;
    }
    const outro = id !== estado.editalId;
    publicar({
      editalId: id,
      carregandoEdital: true,
      erroDoEdital: "",
      ...(outro ? { dados: null } : {}),
    });
    try {
      const dados = await rpc(RPC_OBTER_EDITAL, {
        p_edital: id,
      });
      if (meu !== pedidoDoEdital) return false;
      publicar({
        dados: dados || null,
        carregandoEdital: false,
        podeEditar: Boolean(dados?.pode_editar),
      });
      return true;
    } catch (erro) {
      if (meu !== pedidoDoEdital) return false;
      publicar({
        carregandoEdital: false,
        erroDoEdital: mensagemDoBanco(erro),
      });
      return false;
    }
  }

  const mudarDados = (mudar) => {
    if (!estado.dados) return;
    publicar({ dados: mudar(estado.dados) });
  };

  /* Salva a regra (nova versão). Devolve true/false; erro vira aviso. */
  async function salvarRegra(configuracao, motivo = "") {
    if (!estado.editalId || estado.salvando) return false;
    publicar({ salvando: true });
    try {
      const regra = await rpc(RPC_SALVAR_REGRA, {
        p_edital: estado.editalId,
        p_configuracao: normalizarRegra(configuracao),
        p_versao_atual: estado.dados?.regra?.versao ?? 0,
        p_motivo: motivo || null,
      });
      mudarDados((d) => ({ ...d, regra }));
      publicar({ salvando: false });
      toast(`Regra salva (versão ${regra?.versao ?? "—"}).`, "success");
      return true;
    } catch (erro) {
      publicar({ salvando: false });
      toast(
        `Não foi possível salvar a regra: ${mensagemDoBanco(erro)}`,
        "error",
      );
      return false;
    }
  }

  /* "Gerar": grava o retrato da lista com a versão da regra; o banco devolve o hash. */
  async function gerarLista(resultado) {
    const d = estado.dados;
    if (!d?.regra || estado.gerando) return null;
    publicar({ gerando: true });
    try {
      const retrato = instantaneoDaLista(resultado, {
        edital: d.edital,
        regra: d.regra.configuracao,
        versao: d.regra.versao,
      });
      const registro = await rpc(RPC_REGISTRAR_LISTA, {
        p_edital: estado.editalId,
        p_tipo: resultado.tipo,
        p_versao: d.regra.versao,
        p_resultado: retrato,
      });
      const registrado = { ...registro, retrato };
      mudarDados((atual) => ({
        ...atual,
        listas: [registro, ...(atual.listas || [])],
      }));
      publicar({ gerando: false });
      toast("Lista gerada e registrada.", "success");
      return registrado;
    } catch (erro) {
      publicar({ gerando: false });
      toast(
        `Não foi possível gerar a lista: ${mensagemDoBanco(erro)}`,
        "error",
      );
      return null;
    }
  }

  async function publicarLista(id) {
    try {
      const registro = await rpc(RPC_PUBLICAR_LISTA, {
        p_lista: id,
      });
      mudarDados((d) => ({
        ...d,
        listas: (d.listas || []).map((l) => (l.id === id ? registro : l)),
      }));
      toast("Lista marcada como publicada.", "success");
      return registro;
    } catch (erro) {
      toast(`Não foi possível publicar: ${mensagemDoBanco(erro)}`, "error");
      return null;
    }
  }

  /* O retrato de uma geração (para exportar de novo). */
  async function obterLista(id) {
    try {
      const dados = await rpc(RPC_OBTER_LISTA, { p_lista: id });
      return dados?.resultado
        ? { ...dados.lista, retrato: dados.resultado }
        : null;
    } catch (erro) {
      toast(
        `Não foi possível abrir a lista: ${mensagemDoBanco(erro)}`,
        "error",
      );
      return null;
    }
  }

  /* Sorteio (semente vazia = do servidor) ou decisão manual. */
  async function registrarDesempate(dados) {
    try {
      const registro = await rpc(RPC_REGISTRAR_DESEMPATE, {
        p_edital: estado.editalId,
        p_dados: dados,
      });
      mudarDados((d) => ({
        ...d,
        desempates: [
          ...(d.desempates || []).filter((x) => x.chave !== registro.chave),
          registro,
        ],
      }));
      toast(
        registro.metodo === "SORTEIO"
          ? "Sorteio registrado."
          : "Decisão registrada.",
        "success",
      );
      return registro;
    } catch (erro) {
      toast(`Não foi possível registrar: ${mensagemDoBanco(erro)}`, "error");
      return null;
    }
  }

  /*
    Exporta uma lista registrada: formato pdf | docx | xlsx; lista = todas |
    geral | código da modalidade | eliminados; fase = PRELIMINAR | FINAL (o
    título da publicação; null = o padrão da etapa).
  */
  function exportar(registrado, formato, lista = "todas", fase = null) {
    if (!registrado?.retrato) return false;
    const { retrato } = registrado;
    const nome = nomeDoArquivo(retrato, lista);
    if (formato === "xlsx") {
      baixar(gerarXlsxDaLista(retrato), `${nome}.xlsx`, MIME_XLSX);
      return true;
    }
    const doc = documentoDaLista(retrato, {
      lista,
      registro: registrado,
      fase,
    });
    if (formato === "docx")
      baixar(gerarDocxDaLista(doc), `${nome}.docx`, MIME_DOCX);
    else imprimir(doc);
    return true;
  }

  /*
    Gancho da fase 2: ler a regra do PDF do edital (como o quadro de vagas é
    lido do PDF de anexos). Ainda não existe; a tela não mostra o botão.
  */
  async function importarRegraDoEdital() {
    return null;
  }

  return {
    obter: () => estado,
    assinar(ouvinte) {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
    carregar,
    escolherEdital,
    salvarRegra,
    gerarLista,
    publicarLista,
    obterLista,
    registrarDesempate,
    exportar,
    importarRegraDoEdital,
    reiniciar,
  };
}
