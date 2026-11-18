import type {
  EstadoDosAvisos,
  ClienteDosAvisos,
  SnapshotDosAvisos,
  FiltroDosAvisos,
  ConsultaDeCasos,
  ExportacaoDeCasos,
  Caso,
  NovaEvidencia,
  PessoaResponsavel,
  Tratamento,
} from "./tipos.ts";
/*
  Estado dos avisos de conferência, fora do React: a última leitura de
  `listar_avisos_conferencia_se_mudou` (área e módulo opcionais; migration
  20261015000000), já normalizada por src/lib/conferencias/avisos-de-conferencia.ts, e as
  ações da central de avisos (20261118120000): tratar (`tratar_aviso_conferencia`),
  atribuir responsável e prazo, juntar e retirar evidência; o histórico e os
  responsáveis possíveis são lidos na hora. A tela lê com `useSyncExternalStore`.

  Cada recorte (área × módulo) lido nesta página fica na memória com a versão
  que o banco mandou: o selo de cada tela é montado de novo a cada visita, e a
  releitura manda a versão; sem mudança (os avisos mudam uma vez por dia, no
  "Rodar agora" e nas ações da equipe), o banco responde só `{ inalterado: true }`
  em vez da lista inteira (~25 kB no recorte de tudo).

  Quem usa: o cartão "Avisos de conferência" de Configurações › Status das
  atualizações (todos os módulos) e o selo de cada tela (Análises,
  Entrevistas, Classificação, Lista de aprovados), recortado pela área.

  Os casos de cada aviso (`listar_casos_aviso_conferencia`) não ficam aqui:
  cada lista aberta guarda as páginas dela; aqui só a leitura, a leitura de
  todos (CSV) e o download.
*/
import {
  CASOS_POR_PAGINA,
  CASOS_POR_PAGINA_DO_CSV,
  csvDosCasos,
  juntarPaginasDeCasos,
  nomeDoCsvDosCasos,
  normalizarAvisos,
  normalizarCasos,
  normalizarHistorico,
  termoDeBusca,
} from "../../lib/conferencias/avisos-de-conferencia.ts";
import {
  respostaInalterada,
  versaoDoPacote,
} from "../../lib/carga/versao-do-pacote";
import { comTempoLimite, mensagemDeFalha } from "../../lib/carga/falha-de-rede";
import {
  esquecerAvisosGuardados,
  memoriaDosAvisos,
} from "./memoria-dos-avisos.ts";

function baixarNoNavegador(conteudo: string, nome: string) {
  // O BOM faz o Excel abrir em UTF-8.
  const arquivo = new Blob(["﻿" + conteudo], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(arquivo);
  const ancora = document.createElement("a");
  ancora.href = url;
  ancora.download = nome;
  ancora.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const RPC_DOS_AVISOS = "listar_avisos_conferencia_se_mudou";

/* Recorte → a última lista lida e a versão dela (só nesta página; a saída apaga). */
const memoria = memoriaDosAvisos;
const chaveDoRecorte = ({ area, modulo }: FiltroDosAvisos) =>
  `${area || ""}|${modulo || ""}`;

export { esquecerAvisosGuardados };

export function criarEstadoDosAvisos({
  supabase,
  baixar = baixarNoNavegador,
}: {
  supabase: ClienteDosAvisos | null;
  baixar?: (conteudo: string, nome: string) => void;
}): EstadoDosAvisos {
  let estado: SnapshotDosAvisos = {
    status: "idle",
    lista: null,
    erro: "",
    erroCodigo: "",
    agindo: null,
    erroDaAcao: "",
  };
  let pedido = 0;
  let filtro: FiltroDosAvisos = { area: null, modulo: null };
  const ouvintes = new Set<() => void>();
  const publicar = (mudancas: Partial<SnapshotDosAvisos>) => {
    estado = { ...estado, ...mudancas };
    for (const ouvinte of ouvintes) ouvinte();
  };

  async function carregar({
    area = null,
    modulo = null,
  }: FiltroDosAvisos = {}) {
    const anterior = filtro;
    filtro = { area: area || null, modulo: modulo || null };
    const meu = ++pedido;
    /* Outra área ou outro módulo: a lista anterior não vale para este
       recorte (o selo mostraria a contagem da área de antes se a leitura falhar). */
    const outroRecorte =
      anterior.area !== filtro.area || anterior.modulo !== filtro.modulo;
    if (outroRecorte) publicar({ lista: null });
    if (!supabase) {
      publicar({ status: "error", erro: "Sem conexão com o banco." });
      return;
    }
    const chave = chaveDoRecorte(filtro);
    const guardada = memoria.get(chave);
    // A lista guardada só volta depois que o banco confirma a versão (outra
    // pessoa pode ter entrado nesta aba e ver outro recorte).
    publicar({ status: "loading", erro: "", erroCodigo: "" });
    try {
      const { data, error } = await comTempoLimite(
        supabase.rpc(RPC_DOS_AVISOS, {
          p_area: filtro.area,
          p_modulo: filtro.modulo,
          p_versao: guardada?.versao ?? null,
        }),
        20000,
      );
      if (meu !== pedido) return;
      if (error) {
        publicar({
          status: "error",
          erro: error.message || "Não foi possível ler os avisos.",
          erroCodigo: error.code || "",
        });
        return;
      }
      if (guardada && respostaInalterada(data)) {
        publicar({ status: "ready", lista: guardada.lista });
        return;
      }
      const lista = normalizarAvisos(data);
      const versao = versaoDoPacote(data);
      if (versao) memoria.set(chave, { lista, versao });
      else memoria.delete(chave);
      publicar({ status: "ready", lista });
    } catch (falha) {
      if (meu !== pedido) return;
      publicar({ status: "error", erro: mensagemDeFalha(falha) });
    }
  }

  /*
    Uma ação da equipe num aviso: marca o aviso como "agindo", chama a RPC e,
    se deu certo, relê a lista (a versão do banco mudou). false com o erro em
    `erroDaAcao`.
  */
  async function agir(
    id: string,
    chamar: (cliente: ClienteDosAvisos) => PromiseLike<{
      error: { message?: string } | null;
    }>,
    falhou: string,
  ) {
    if (!supabase) return false;
    publicar({ agindo: id, erroDaAcao: "" });
    try {
      const { error } = await comTempoLimite(chamar(supabase), 20000);
      if (error) {
        publicar({ agindo: null, erroDaAcao: error.message || falhou });
        return false;
      }
    } catch (falha) {
      publicar({ agindo: null, erroDaAcao: mensagemDeFalha(falha) });
      return false;
    }
    publicar({ agindo: null });
    await carregar(filtro);
    return true;
  }

  const tratar = (id: string, tratamento: Tratamento, motivo: string) =>
    agir(
      id,
      (cliente) =>
        cliente.rpc("tratar_aviso_conferencia", {
          p_id: id,
          p_tratamento: tratamento,
          p_motivo: String(motivo || "").trim() || null,
        }),
      "Não foi possível mudar a situação do aviso.",
    );

  const atribuir = (
    id: string,
    responsavel: string | null,
    prazo: string | null,
  ) =>
    agir(
      id,
      (cliente) =>
        cliente.rpc("atribuir_aviso_conferencia", {
          p_id: id,
          p_responsavel: responsavel || null,
          p_prazo: responsavel ? prazo || null : null,
        }),
      "Não foi possível atribuir o aviso.",
    );

  const incluirEvidencia = (id: string, evidencia: NovaEvidencia) =>
    agir(
      id,
      (cliente) =>
        cliente.rpc("incluir_evidencia_aviso_conferencia", {
          p_id: id,
          p_tipo: evidencia.tipo,
          p_descricao: String(evidencia.descricao || "").trim(),
          p_url: String(evidencia.url || "").trim() || null,
          p_chave_caso: evidencia.chaveDoCaso || null,
        }),
      "Não foi possível juntar a evidência.",
    );

  const retirarEvidencia = (
    avisoId: string,
    evidenciaId: string,
    motivo: string,
  ) =>
    agir(
      avisoId,
      (cliente) =>
        cliente.rpc("retirar_evidencia_aviso_conferencia", {
          p_evidencia: evidenciaId,
          p_motivo: String(motivo || "").trim(),
        }),
      "Não foi possível retirar a evidência.",
    );

  /** Quem pode ser responsável pelo aviso (só o gestor lê). Lança o erro da RPC. */
  async function responsaveis(id: string): Promise<PessoaResponsavel[]> {
    if (!supabase) throw new Error("Sem conexão com o banco.");
    const { data, error } = await comTempoLimite(
      supabase.rpc("listar_responsaveis_aviso_conferencia", { p_id: id }),
      20000,
    );
    if (error) throw error;
    return (Array.isArray(data) ? data : []).flatMap((p: unknown) => {
      if (!p || typeof p !== "object") return [];
      const { id: pessoa, nome } = p as Record<string, unknown>;
      return typeof pessoa === "string" && typeof nome === "string"
        ? [{ id: pessoa, nome }]
        : [];
    });
  }

  /** O histórico e as evidências de um aviso. Lança o erro da RPC. */
  async function historico(id: string) {
    if (!supabase) throw new Error("Sem conexão com o banco.");
    const { data, error } = await comTempoLimite(
      supabase.rpc("listar_historico_aviso_conferencia", { p_id: id }),
      20000,
    );
    if (error) throw error;
    return normalizarHistorico(data);
  }

  /*
    Uma página de casos: de um aviso (`avisoId`) ou, com `busca`, de todos os
    avisos do recorte atual (área e módulo da última leitura). Devolve
    `{ total, casos }` normalizados; lança o erro da RPC.
  */
  async function listarCasos({
    avisoId = null,
    busca = "",
    limite = CASOS_POR_PAGINA,
    deslocamento = 0,
  }: ConsultaDeCasos = {}) {
    if (!supabase) throw new Error("Sem conexão com o banco.");
    const { data, error } = await comTempoLimite(
      supabase.rpc("listar_casos_aviso_conferencia", {
        p_aviso: avisoId || null,
        p_busca: termoDeBusca(busca) || null,
        p_area: avisoId ? null : filtro.area,
        p_modulo: avisoId ? null : filtro.modulo,
        p_limite: limite,
        p_deslocamento: deslocamento,
      }),
      20000,
    );
    if (error) throw error;
    return normalizarCasos(data);
  }

  /* Todos os casos (para o CSV), de 1000 em 1000. */
  async function todosOsCasos({
    avisoId = null,
    busca = "",
  }: ConsultaDeCasos = {}) {
    let casos: Caso[] = [];
    for (;;) {
      const pagina = await listarCasos({
        avisoId,
        busca,
        limite: CASOS_POR_PAGINA_DO_CSV,
        deslocamento: casos.length,
      });
      const antes = casos.length;
      casos = juntarPaginasDeCasos(casos, pagina.casos);
      if (casos.length === antes || casos.length >= pagina.total) return casos;
    }
  }

  /** Baixa o CSV dos casos de um aviso (ou da busca geral). true se baixou. */
  async function exportarCasos({
    aviso = null,
    busca = "",
  }: ExportacaoDeCasos = {}) {
    const casos = await todosOsCasos({ avisoId: aviso?.id || null, busca });
    if (!casos.length) return false;
    baixar(csvDosCasos(casos), nomeDoCsvDosCasos(aviso));
    return true;
  }

  return {
    assinar(ouvinte: () => void) {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
    obter: () => estado,
    carregar,
    tratar,
    atribuir,
    responsaveis,
    incluirEvidencia,
    retirarEvidencia,
    historico,
    listarCasos,
    todosOsCasos,
    exportarCasos,
  };
}
