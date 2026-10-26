import type {
  AgrupamentoDaCarta,
  CandidatoDaCarta,
  DocumentoDasCartas,
  EmissaoDaCarta,
  ModeloDaCarta,
  OpcoesDasCartas,
  OpcoesDoEstadoDaCarta,
  PedidoDeEmissao,
  RascunhoDaCarta,
  ResultadoDaEmissao,
  SaidaDaCarta,
  SnapshotDaCarta,
  HistoricoDaCarta,
} from "../../../lib/tipos-da-carta.ts";
import {
  idConfirmadoDaCarta,
  MENSAGEM_CONFIRMACAO_DA_CARTA,
  objetoDaCarta,
  cartasDoHistorico,
  resultadoDeMarcar,
} from "../../../lib/dados-da-carta.ts";
/*
  Estado da carta de convocação, fora do React: os modelos da área (com as
  versões), o histórico de cartas de cada candidato e as ações — salvar o
  modelo (nova versão), inativar/reativar, emitir (Copiar para o SEI, DOCX,
  PDF) registrando a emissão uma vez por carta, e marcar os candidatos como
  Convocado. As regras são de src/lib/carta-de-convocacao.ts e o documento, de
  src/lib/carta-de-convocacao-documento.ts (o mesmo modelo do documento
  oficial da Classificação). Criado pelo estado da Lista de aprovados
  (`estado.carta`), que dá a área, o perfil e a marcação de convocados.
  Este arquivo não importa React.
*/

import { MIME_DOCX } from "../../../lib/documento-da-resposta.js";
import { CABECALHO_PADRAO } from "../../../lib/cabecalho-dos-documentos.js";
import { canChangeCandidateStatus } from "../../../lib/access-roles.ts";
import { ehConflitoDeVersao } from "../../../lib/conflito-de-versao.ts";
import {
  assinaturaDaEmissao,
  camposParaRegistrar,
  conteudoParaSalvar,
  hojeEmBrasilia,
  lerModelosDoBanco,
  validarEmissao,
  validarModelo,
} from "../../../lib/carta-de-convocacao.ts";
import {
  gerarDocxDasCartas,
  gerarZipDasCartas,
  htmlParaSei,
  montarCartas,
  nomeDeArquivo,
  paginaDaPrevia,
  soACarta,
  textoParaSei,
} from "../../../lib/carta-de-convocacao-documento.ts";
import { LOGO_PADRAO_DA_BARRA } from "../../../lib/marca-da-barra-lateral.js";

const texto = (valor: unknown) => String(valor ?? "").trim();
const mensagemDe = (erro: unknown) =>
  erro instanceof Error
    ? erro.message
    : erro && typeof erro === "object" && "message" in erro
      ? texto(erro.message) || texto(erro)
      : texto(erro);

const ESTADO_INICIAL: SnapshotDaCarta = Object.freeze({
  /** A área dos modelos carregados. */
  area: "",
  modelos: Object.freeze([]),
  podeEditar: false,
  carregando: false,
  carregado: false,
  erro: "",
  /** candidato_id → { carregando, dataConvocacao, cartas, erro }. */
  historicos: new Map(),
  /** A ação em curso, `{ tipo, rotulo }`, ou `null`. Uma por vez. */
  acao: null,
});

export function criarEstadoDaCarta({
  supabase = null,
  toast = (mensagem) => console.info(mensagem),
  perfil = () => null,
  areaAtual = () => "",
  baixar = () => {},
  imprimir = () => {},
  copiar = async () => "",
  carregarLogo = async () => null,
  cabecalho = () => CABECALHO_PADRAO,
  enderecoDoLogo = LOGO_PADRAO_DA_BARRA,
  hoje = () => hojeEmBrasilia(),
  marcarConvocados = async () => null,
}: OpcoesDoEstadoDaCarta = {}) {
  const cliente = () => {
    if (!supabase) throw new Error("Conexão da carta indisponível.");
    return supabase;
  };
  let estado = ESTADO_INICIAL;
  const ouvintes = new Set<() => void>();
  /* Emissões já registradas nesta sessão: assinatura → carta_id. */
  const registradas = new Map<string, string | null>();
  /* Só a leitura de modelos mais recente mexe em `carregando`. */
  let pedidoDosModelos = 0;

  function publicar(mudancas: Partial<SnapshotDaCarta>) {
    estado = { ...estado, ...mudancas };
    for (const ouvinte of ouvintes) ouvinte();
  }

  async function executar<T>(
    tipo: string,
    rotulo: string,
    fazer: () => Promise<T>,
  ): Promise<T | false> {
    if (estado.acao) return false;
    publicar({ acao: { tipo, rotulo } });
    try {
      return await fazer();
    } finally {
      publicar({ acao: null });
    }
  }

  const podeEmitir = () => canChangeCandidateStatus(perfil());

  function marca() {
    let valor = "";
    try {
      valor = texto(cabecalho());
    } catch {
      valor = "";
    }
    return { cabecalho: valor || CABECALHO_PADRAO, logo: enderecoDoLogo };
  }

  // ── Modelos ────────────────────────────────────────────────────────────

  async function carregarModelos({ forcar = false } = {}) {
    const area = texto(areaAtual());
    if (!supabase || !area) return false;
    if (!forcar && estado.carregado && estado.area === area) return true;
    const meu = ++pedidoDosModelos;
    publicar({ carregando: true, erro: "" });
    const { data, error } = await cliente().rpc(
      "listar_modelos_carta_convocacao",
      { p_area: area },
    );
    if (meu !== pedidoDosModelos) return false;
    // A área mudou durante a leitura: descarta a resposta sem travar a carga.
    if (texto(areaAtual()) !== area) {
      publicar({ carregando: false });
      return false;
    }
    if (error) {
      publicar({ carregando: false, erro: String(mensagemDe(error)) });
      return false;
    }
    let dados;
    try {
      dados = lerModelosDoBanco(data);
    } catch (erro) {
      publicar({ carregando: false, erro: mensagemDe(erro) });
      return false;
    }
    const { modelos, podeEditar } = dados;
    publicar({
      area,
      modelos,
      podeEditar,
      carregando: false,
      carregado: true,
    });
    return true;
  }

  /**
   * Cria (modelo nulo) ou grava a próxima versão. Devolve o id do modelo, ou
   * "" quando não salvou (a tela mantém o rascunho).
   */
  async function salvarModelo(
    rascunho: RascunhoDaCarta,
    modelo: ModeloDaCarta | null = null,
  ) {
    const { erros } = validarModelo(rascunho, {
      versaoAtual: modelo?.versao || 0,
    });
    if (erros.length) {
      toast(erros[0] ?? "Verifique os campos da carta.", "warn");
      return "";
    }
    const resultado = await executar(
      "salvar-modelo-carta",
      "Salvando…",
      async () => {
        const { data, error } = await cliente().rpc(
          "salvar_modelo_carta_convocacao",
          {
            p_modelo: modelo?.id || null,
            p_area: modelo?.area || texto(areaAtual()),
            p_edital: modelo ? null : texto(rascunho.editalId) || null,
            p_conteudo: conteudoParaSalvar(rascunho),
            p_versao_atual: modelo?.versao ?? null,
            p_motivo: texto(rascunho.motivo) || null,
          },
        );
        if (error) {
          toast(
            ehConflitoDeVersao(objetoDaCarta(error))
              ? "Outra pessoa salvou este modelo enquanto você editava. Reabra para ver a versão nova."
              : `Erro ao salvar o modelo: ${mensagemDe(error)}`,
            "error",
          );
          return "";
        }
        toast(
          modelo
            ? `Modelo salvo (versão ${objetoDaCarta(data).versao ?? modelo.versao + 1}).`
            : "Modelo criado.",
        );
        return texto(objetoDaCarta(data).modelo_id) || modelo?.id || "";
      },
    );
    if (resultado) await carregarModelos({ forcar: true });
    return resultado || "";
  }

  async function definirAtivo(
    modelo: ModeloDaCarta,
    ativo: boolean,
    motivo: string,
  ) {
    if (texto(motivo).length < 3) {
      toast("Informe o motivo (3 a 500 caracteres).", "warn");
      return false;
    }
    const feito = await executar(
      "situacao-modelo-carta",
      "Salvando…",
      async () => {
        const { error } = await cliente().rpc("definir_modelo_carta_ativo", {
          p_modelo: modelo.id,
          p_ativo: ativo,
          p_motivo: texto(motivo),
        });
        if (error) {
          toast(
            `Erro ao mudar a situação do modelo: ${mensagemDe(error)}`,
            "error",
          );
          return false;
        }
        toast(ativo ? "Modelo reativado." : "Modelo inativado.");
        return true;
      },
    );
    if (feito) await carregarModelos({ forcar: true });
    return feito;
  }

  // ── Emissão ────────────────────────────────────────────────────────────

  /** O documento das cartas (para a prévia e para as saídas). */
  function documento({ modelo, candidatos, emissao }: OpcoesDasCartas) {
    if (!modelo) return null;
    return montarCartas({ modelo, candidatos, emissao, hoje: hoje() });
  }

  const paginaDe = (doc: DocumentoDasCartas | null) =>
    doc ? paginaDaPrevia(doc, marca()) : "";

  /*
    Registra a emissão uma vez por carta (assinatura): baixar o DOCX e depois
    imprimir o PDF da mesma carta não duplica o histórico.
  */
  async function registrar({
    modelo,
    candidatos,
    emissao,
    agrupamento,
    saida,
  }: {
    modelo: ModeloDaCarta;
    candidatos: readonly CandidatoDaCarta[];
    emissao: EmissaoDaCarta;
    agrupamento: AgrupamentoDaCarta;
    saida: SaidaDaCarta;
  }) {
    const assinatura = assinaturaDaEmissao({
      modeloId: modelo.id,
      versao: modelo.versao,
      candidatoIds: candidatos.map((c) => String(c.candidato_id)),
      agrupamento,
      emissao,
    });
    if (registradas.has(assinatura)) {
      const cartaId = registradas.get(assinatura);
      if (!cartaId) throw new Error(MENSAGEM_CONFIRMACAO_DA_CARTA);
      return { cartaId, nova: false };
    }
    const { data, error } = await cliente().rpc("registrar_carta_convocacao", {
      p_modelo: modelo.id,
      p_versao: modelo.versao,
      p_candidatos: candidatos.map((c) => c.candidato_id),
      p_agrupamento: agrupamento,
      p_saida: saida,
      p_campos: camposParaRegistrar(emissao),
    });
    if (error) throw error;
    // A chamada já foi enviada: uma confirmação incompleta não autoriza repeti-la.
    registradas.set(assinatura, null);
    const cartaId = idConfirmadoDaCarta(data);
    registradas.set(assinatura, cartaId);
    // O histórico dos candidatos desta carta muda.
    const historicos = new Map(estado.historicos);
    candidatos.forEach((c) => historicos.delete(String(c.candidato_id)));
    publicar({ historicos });
    return { cartaId, nova: true };
  }

  /**
   * Gera a saída e registra a emissão.
   *   saida        "SEI" | "DOCX" | "PDF"
   *   agrupamento  "UNICO" | "POR_CANDIDATO"
   *   indice       com POR_CANDIDATO e SEI, a carta copiada (uma de cada vez)
   * Devolve { cartaId, candidatos } da emissão registrada, ou null.
   */
  async function emitir({
    modelo,
    candidatos,
    emissao,
    agrupamento = "UNICO",
    saida,
    indice = 0,
  }: PedidoDeEmissao): Promise<ResultadoDaEmissao | null | false> {
    if (!podeEmitir()) {
      toast("Sem permissão para emitir a carta de convocação.", "warn");
      return null;
    }
    const { erros } = validarEmissao({
      modelo: modelo?.vigente,
      candidatos,
      emissao,
      hoje: hoje(),
    });
    if (erros.length) {
      toast(erros[0] ?? "Verifique os campos da carta.", "warn");
      return null;
    }
    if (!modelo) return null;
    const porCandidato = agrupamento === "POR_CANDIDATO";
    // Copiar "uma por candidato" leva uma carta por vez: a emissão é dela.
    const daEmissao =
      porCandidato && saida === "SEI"
        ? candidatos.filter((_c, i) => i === indice)
        : candidatos;
    const doc = documento({ modelo, candidatos: daEmissao, emissao });
    if (!doc?.cartas.length) return null;

    return executar(`emitir-${saida}`, "Gerando…", async () => {
      let registro;
      try {
        registro = await registrar({
          modelo,
          candidatos: daEmissao,
          emissao,
          agrupamento,
          saida,
        });
      } catch (erro) {
        toast(`Erro ao registrar a carta: ${mensagemDe(erro)}`, "error");
        return null;
      }
      if (saida === "SEI") {
        const resultado = await copiar({
          html: htmlParaSei(doc),
          texto: textoParaSei(doc),
        });
        if (resultado === "html")
          toast(
            "Copiado. No SEI, cole no editor do documento (Ctrl+V).",
            "success",
          );
        else if (resultado === "texto")
          toast(
            "Copiado só como texto: o navegador não liberou a formatação. Use o DOCX.",
            "warn",
          );
        else
          toast(
            "Não foi possível copiar. Libere a área de transferência ou use o DOCX.",
            "error",
          );
      } else if (saida === "DOCX") {
        const logo = await Promise.resolve()
          .then(() => carregarLogo())
          .catch(() => null);
        const opcoes = { cabecalho: marca().cabecalho, logo };
        if (porCandidato && doc.cartas.length > 1)
          baixar(
            new Blob([gerarZipDasCartas(doc, opcoes)], {
              type: "application/zip",
            }),
            `${nomeDeArquivo(doc.nome)}.zip`,
          );
        else
          baixar(
            new Blob([gerarDocxDasCartas(doc, opcoes)], { type: MIME_DOCX }),
            `${nomeDeArquivo(doc.nome)}.docx`,
          );
      } else imprimir(paginaDe(doc));
      return {
        cartaId: registro.cartaId,
        candidatos: daEmissao,
        nova: registro.nova,
      };
    });
  }

  /** Marca os candidatos da carta como Convocado (pelo estado da lista). */
  async function marcar(
    candidatos: readonly CandidatoDaCarta[],
    data: string,
    cartaId: string,
  ) {
    return resultadoDeMarcar(
      await marcarConvocados(
        candidatos.map((c) => c.candidato_id),
        data,
        cartaId,
      ),
    );
  }

  // ── Histórico do candidato ─────────────────────────────────────────────

  async function carregarHistorico(
    candidatoId: unknown,
    { forcar = false } = {},
  ) {
    const id = String(candidatoId ?? "");
    if (!supabase || !id) return;
    const atual = estado.historicos.get(id);
    if (atual && !forcar && (atual.carregando || !atual.erro)) return;
    const inicio = new Map(estado.historicos);
    inicio.set(id, {
      carregando: true,
      cartas: atual?.cartas || [],
      dataConvocacao: "",
      erro: "",
    });
    publicar({ historicos: inicio });
    let resultado: HistoricoDaCarta;
    try {
      const { data, error } = await cliente().rpc(
        "listar_cartas_do_candidato",
        { p_candidato: id },
      );
      if (error) throw error;
      const dados = objetoDaCarta(data);
      resultado = {
        carregando: false,
        erro: "",
        dataConvocacao: texto(dados.data_convocacao),
        cartas: cartasDoHistorico(dados.cartas),
      };
    } catch (erro) {
      resultado = {
        carregando: false,
        cartas: [],
        dataConvocacao: "",
        erro: mensagemDe(erro),
      };
    }
    const historicos = new Map(estado.historicos);
    historicos.set(id, resultado);
    publicar({ historicos });
  }

  return {
    assinar(ouvinte: () => void) {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
    obter: () => estado,
    podeEmitir,
    carregarModelos,
    salvarModelo,
    definirAtivo,
    documento,
    paginaDe,
    soACarta,
    emitir,
    marcar,
    carregarHistorico,
    hoje,
  };
}
