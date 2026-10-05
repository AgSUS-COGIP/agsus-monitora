/*
  SINCRONIZAR SELEÇÃO: PLANILHA "AUDITORIA" -> SUPABASE

  Lê a aba Resultado da planilha "Auditoria" (uma linha por vaga: o funil da
  seleção) com a conta de serviço do Google e grava em TB_SELECAO_VAGA pelas
  RPCs `sincronizar_selecao` (lotes de 500) e `finalizar_sync_selecao` (liga o
  edital, acerta a área, desativa o que saiu). A aba Seleção do MONITORA lê
  com `get_selecao_da_area`, que calcula na hora os convocados (TB_ENTREVISTA)
  e aprovados/contratados (lista de aprovados).
  Roda de hora em hora (7h–19h) pelo GitHub Actions (.github/workflows/sincronizar-selecao.yml).

  Onde está a planilha: `PLANILHAS.auditoriaDaSelecao` em src/lib/planilhas.js.
  Como a aba vira linhas: src/lib/selecao-da-planilha.js.
  Credenciais e variáveis: scripts/carga-de-planilha.mjs.
  Guia para quem for operar: docs/sincronizacao-das-planilhas.md.

  Uso
    node scripts/sincronizar-selecao.mjs --seco    só lê a planilha e mostra o resumo
    node scripts/sincronizar-selecao.mjs           lê e grava no banco
    node scripts/sincronizar-selecao.mjs --forcar  aceita carga com menos da metade
                                                   das linhas ativas (confira antes)

  Saída: 0 concluída; 1 erro; 2 carga recusada pelo banco (menos da metade das
  linhas ativas — nada foi desativado).
*/
import { randomUUID } from "node:crypto";
import { PLANILHAS } from "../src/lib/planilhas.js";
import {
  emLotes,
  identificadorDaCarga,
} from "../src/lib/entrevistas-da-planilha.js";
import { linhasDaAbaResultado } from "../src/lib/selecao-da-planilha.js";
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
const TITULO = "Seleção: planilha Auditoria → MONITORA";

async function principal() {
  const { seco, forcar } = argumentos();
  carregarEnvLocal();
  const conta = contaDeServico();
  const supabase = seco ? null : configuracaoDoSupabase("Sincronizar seleção");

  const token = await tokenDoGoogle(conta);
  const valores = await lerAba(token, conta, PLANILHAS.auditoriaDaSelecao);
  const linhas = linhasDaAbaResultado(valores);
  if (!linhas.length) {
    throw new Error(
      `A aba "${PLANILHAS.auditoriaDaSelecao.aba}" não tem linhas para enviar.`,
    );
  }

  if (seco) {
    const outrasBancas = linhas.filter((l) => !/^\d+$/.test(l.vaga)).length;
    const mesmoNome = linhas.filter((l) => l.repeticao > 1).length;
    const comConvocados = linhas.filter((l) => l.convocados > 0).length;
    resumir(TITULO, [
      "Modo seco: nada foi enviado ao banco.",
      `Linhas na aba (com cabeçalho): ${valores.length}`,
      `Vagas para enviar: ${linhas.length} · cópias idênticas na aba (entram uma vez): ${linhas.copias}`,
      `Outras bancas (cargo no lugar do código da vaga): ${outrasBancas} · vagas de mesmo nome com números diferentes: ${mesmoNome}`,
      `Com convocados na planilha (V > 0): ${comConvocados}`,
      `Lotes de ${TAMANHO_DO_LOTE}: ${emLotes(linhas, TAMANHO_DO_LOTE).length}`,
    ]);
    return 0;
  }

  const sync = identificadorDaCarga(new Date(), randomUUID());
  let gravadas = 0;
  for (const lote of emLotes(linhas, TAMANHO_DO_LOTE)) {
    const r = await chamarRpc(supabase, "sincronizar_selecao", {
      p_sync: sync,
      p_linhas: lote,
    });
    gravadas += Number(r?.gravadas || 0);
  }

  const fim = await chamarRpc(supabase, "finalizar_sync_selecao", {
    p_sync: sync,
    p_forcar: forcar,
  });

  if (fim?.situacao !== "CONCLUIDA") {
    resumir(TITULO, [
      `Carga ${sync} RECUSADA: a planilha trouxe ${fim?.linhas} vagas e o banco tem ${fim?.ativas} ativas (menos da metade).`,
      "Nada foi desativado. Confira a aba Resultado; se estiver certa, rode de novo com --forcar.",
    ]);
    return 2;
  }

  resumir(TITULO, [
    `Carga ${sync} concluída${forcar ? " (com forçar)" : ""}.`,
    `Vagas lidas: ${linhas.length} · gravadas: ${gravadas}`,
    `Sem edital cadastrado: ${fim.sem_edital}`,
    `Saíram da planilha (desativadas): ${fim.desativadas}`,
  ]);
  return 0;
}

rodar(principal);
