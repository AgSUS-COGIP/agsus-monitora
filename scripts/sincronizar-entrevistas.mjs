/*
  SINCRONIZAR ENTREVISTAS: PLANILHA -> SUPABASE

  Lê a aba Entrevistados da planilha "[dash] entrevistados" com a conta de
  serviço do Google (API do Sheets, só leitura) e envia para o banco pelas
  mesmas RPCs que o Apps Script usava: `sincronizar_entrevistas` em lotes de
  500 e `finalizar_sync_entrevistas` no fim. As tabelas (TB_ENTREVISTA,
  TB_ENTREVISTA_NOTA, TL_SYNC_ENTREVISTA) não mudam; muda só quem as alimenta.
  Roda todo dia às 9h pelo GitHub Actions (.github/workflows/sincronizar-entrevistas.yml).

  Onde está a planilha: `PLANILHAS.entrevistados` em src/lib/planilhas.js.
  Como a aba vira linhas: src/lib/entrevistas-da-planilha.js.
  Credenciais e variáveis: scripts/carga-de-planilha.mjs.
  Guia para quem for operar: docs/sincronizacao-das-planilhas.md.

  Uso
    node scripts/sincronizar-entrevistas.mjs --seco    só lê a planilha e mostra o resumo
    node scripts/sincronizar-entrevistas.mjs           lê e grava no banco
    node scripts/sincronizar-entrevistas.mjs --forcar  aceita carga com menos da metade
                                                       das linhas ativas (confira antes)

  Saída: 0 concluída; 1 erro; 2 carga recusada pelo banco (menos da metade das
  linhas ativas — nada foi desativado).
*/
import { randomUUID } from "node:crypto";
import { PLANILHAS } from "../src/lib/planilhas.js";
import {
  emLotes,
  identificadorDaCarga,
  linhasDaAbaEntrevistados,
} from "../src/lib/entrevistas-da-planilha.js";
import {
  argumentos,
  carregarEnvLocal,
  chamarRpc,
  configuracaoDoSupabase,
  contaDeServico,
  lerAba,
  resumir,
  rodar,
  tokenDoGoogle,
} from "./carga-de-planilha.mjs";

const TAMANHO_DO_LOTE = 500;
const TITULO = "Entrevistas: planilha → MONITORA";

async function principal() {
  const { seco, forcar } = argumentos();
  carregarEnvLocal();
  const conta = contaDeServico();
  const supabase = seco
    ? null
    : configuracaoDoSupabase("Sincronizar entrevistas");

  const token = await tokenDoGoogle(conta);
  const valores = await lerAba(token, conta, PLANILHAS.entrevistados);
  const linhas = linhasDaAbaEntrevistados(valores);
  if (!linhas.length) {
    throw new Error(
      `A aba "${PLANILHAS.entrevistados.aba}" não tem linhas para enviar.`,
    );
  }

  if (seco) {
    const comCodigo = linhas.filter((l) => l.codigo).length;
    const comNotas = linhas.filter((l) => l.notas.length).length;
    resumir(TITULO, [
      "Modo seco: nada foi enviado ao banco.",
      `Linhas na aba (com cabeçalho): ${valores.length}`,
      `Linhas válidas para enviar: ${linhas.length}`,
      `Com código do candidato: ${comCodigo} · com notas por critério: ${comNotas}`,
      `Lotes de ${TAMANHO_DO_LOTE}: ${emLotes(linhas, TAMANHO_DO_LOTE).length}`,
    ]);
    return 0;
  }

  const sync = identificadorDaCarga(new Date(), randomUUID());
  const area = PLANILHAS.entrevistados.area;
  let gravadas = 0;
  for (const lote of emLotes(linhas, TAMANHO_DO_LOTE)) {
    const r = await chamarRpc(supabase, "sincronizar_entrevistas", {
      p_sync: sync,
      p_area: area,
      p_linhas: lote,
    });
    gravadas += Number(r?.gravadas || 0);
  }

  const fim = await chamarRpc(supabase, "finalizar_sync_entrevistas", {
    p_sync: sync,
    p_area: area,
    p_forcar: forcar,
  });

  if (fim?.situacao !== "CONCLUIDA") {
    resumir(TITULO, [
      `Carga ${sync} RECUSADA: a planilha trouxe ${fim?.linhas} linhas e o banco tem ${fim?.ativas} ativas (menos da metade).`,
      "Nada foi desativado. Confira a aba Entrevistados; se estiver certa, rode de novo com --forcar.",
    ]);
    return 2;
  }

  resumir(TITULO, [
    `Carga ${sync} concluída${forcar ? " (com forçar)" : ""}.`,
    `Linhas lidas: ${linhas.length} · gravadas: ${gravadas}`,
    `Ligadas à análise curricular: ${fim.ligadas_analise}`,
    `Sem análise encontrada: ${fim.sem_analise}`,
    `Sem edital cadastrado: ${fim.sem_edital}`,
    `Saíram da planilha (desativadas): ${fim.desativadas}`,
  ]);
  return 0;
}

rodar(principal);
