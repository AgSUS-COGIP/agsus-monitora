import type {
  EstadoDosAvisos,
  ClienteDosAvisos,
  SnapshotDosAvisos,
  FiltroDosAvisos,
  ConsultaDeCasos,
  ExportacaoDeCasos,
  Caso,
} from "./tipos.ts";
/*
  Estado dos avisos de conferência, fora do React: a última leitura de
  `listar_avisos_conferencia_se_mudou` (área e módulo opcionais; migration
  20261015000000), já normalizada por src/lib/avisos-de-conferencia.ts, e o
  "ignorar" com motivo (`ignorar_aviso_conferencia`). A tela lê com
  `useSyncExternalStore`.

  Cada recorte (área × módulo) lido nesta página fica na memória com a versão
  que o banco mandou: o selo de cada tela é montado de novo a cada visita, e a
  releitura manda a versão; sem mudança (os avisos mudam uma vez por dia, no
  "Rodar agora" e no "ignorar"), o banco responde só `{ inalterado: true }`
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
  termoDeBusca,
} from "../../lib/avisos-de-conferencia.ts";
import { respostaInalterada, versaoDoPacote } from "../../lib/cache-de-payload";
import { comTempoLimite, mensagemDeFalha } from "../../lib/falha-de-rede";

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

/* Recorte → a última lista lida e a versão dela (só nesta página). */
const memoria = new Map<
  string,
  { lista: SnapshotDosAvisos["lista"]; versao: string }
>();
const chaveDoRecorte = ({ area, modulo }: FiltroDosAvisos) =>
  `${area || ""}|${modulo || ""}`;

/** Só para os testes: esquece as listas guardadas na memória. */
export function esquecerAvisosGuardados() {
  memoria.clear();
}

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
    ignorando: null,
    erroAoIgnorar: "",
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

  async function ignorar(id: string, motivo: string) {
    if (!supabase) return false;
    publicar({ ignorando: id, erroAoIgnorar: "" });
    try {
      const { error } = await comTempoLimite(
        supabase.rpc("ignorar_aviso_conferencia", {
          p_id: id,
          p_motivo: String(motivo || "").trim(),
        }),
        20000,
      );
      if (error) {
        publicar({
          ignorando: null,
          erroAoIgnorar: error.message || "Não foi possível ignorar o aviso.",
        });
        return false;
      }
    } catch (falha) {
      publicar({ ignorando: null, erroAoIgnorar: mensagemDeFalha(falha) });
      return false;
    }
    publicar({ ignorando: null });
    await carregar(filtro);
    return true;
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
    ignorar,
    listarCasos,
    todosOsCasos,
    exportarCasos,
  };
}
