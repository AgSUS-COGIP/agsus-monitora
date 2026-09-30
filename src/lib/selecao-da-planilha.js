/*
  ABA "RESULTADO" (PLANILHA "AUDITORIA") -> LINHAS DA CARGA DA SELEÇÃO

  Transforma os valores da aba Resultado (como a API do Google Sheets os
  devolve: textos formatados em pt-BR, primeira linha de cabeçalho) nas linhas
  que `public.sincronizar_selecao` espera. Quem chama é
  `scripts/sincronizar-selecao.mjs`.

  Só estas colunas entram (as letras são as de hoje; a leitura é pelo nome do
  cabeçalho, para não quebrar se alguém inserir uma coluna):
    A Vaga · B Edital · C Nome da Unidade · F Inscritos · G Aptos para analise ·
    H Cancelados · I Reprovados por não finalizar o questionário ·
    J Eliminados por nota · K Reprovados na Análise · L Triados ·
    P Total de Eliminados · T Observação · U Nome do cargo ·
    V Total convocados para entrevista
  W, X e Y (aprovados, contratados, não contratados) não vêm daqui: saem da
  lista de aprovados, no banco (get_selecao_da_area).

  Números vêm formatados ("1.234", "732,00", "-1"): viram inteiros; vazio é
  nulo. Editais de outras bancas trazem o nome do cargo na coluna A e só
  inscritos e eliminados — não é erro. Linha repetida (mesmo edital e vaga)
  entra uma vez.
*/
import { normalizarCabecalho } from "./entrevistas-da-planilha.js";

const COLUNAS = Object.freeze({
  vaga: ["VAGA"],
  edital: ["EDITAL"],
  unidade: ["NOME DA UNIDADE"],
  inscritos: ["INSCRITOS"],
  aptos: ["APTOS PARA ANALISE"],
  cancelados: ["CANCELADOS"],
  reprovados_questionario: ["REPROVADOS POR NAO FINALIZAR O QUESTIONARIO"],
  eliminados_nota: ["ELIMINADOS POR NOTA"],
  reprovados_analise: ["REPROVADOS NA ANALISE"],
  triados: ["TRIADOS"],
  total_eliminados: ["TOTAL DE ELIMINADOS"],
  observacao: ["OBSERVACAO"],
  cargo: ["NOME DO CARGO"],
  convocados: ["TOTAL CONVOCADOS PARA ENTREVISTA"],
});

const OBRIGATORIAS = Object.freeze(["vaga", "edital", "inscritos"]);

export const CAMPOS_NUMERICOS = Object.freeze([
  "inscritos",
  "aptos",
  "cancelados",
  "reprovados_questionario",
  "eliminados_nota",
  "reprovados_analise",
  "triados",
  "total_eliminados",
  "convocados",
]);

const texto = (valor) =>
  String(valor ?? "")
    .replace(/\s+/g, " ")
    .trim();

/* Só nome exato: "TRIADOS" não pode pegar "TRIADOS SEGUNDA EXTRACAO". */
function acharColuna(cabecalho, nomes) {
  const alvos = nomes.map(normalizarCabecalho);
  return cabecalho.findIndex((c) => alvos.includes(c));
}

/** "1.234" → 1234; "732,00" → 732; "-1" → -1; "" ou texto → null. */
export function inteiroPtBr(valor) {
  const limpo = texto(valor).replace(/\./g, "").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(limpo)) return null;
  return Math.round(Number(limpo));
}

/** "06/2026 (sanitarista)" → "6/2026"; sem número, o texto sem acento. */
export function chaveDoEdital(edital) {
  const m = texto(edital).match(/(\d{1,4})\s*\/\s*(\d{4})/);
  if (m) return `${Number(m[1])}/${m[2]}`;
  return texto(edital)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Chave da linha, a mesma regra do banco: edital | código da vaga (ou cargo). */
export function chaveDaVaga(edital, vaga) {
  const v = texto(vaga);
  const parteDaVaga = /^\d{1,20}$/.test(v)
    ? v
    : `cargo:${v
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()}`;
  return `${chaveDoEdital(edital)}|${parteDaVaga}`;
}

/** Linhas para `sincronizar_selecao` a partir da matriz da aba Resultado. */
export function linhasDaAbaResultado(valores) {
  if (!Array.isArray(valores) || valores.length < 2) return [];

  const cabecalho = (valores[0] || []).map(normalizarCabecalho);
  const idx = Object.fromEntries(
    Object.entries(COLUNAS).map(([campo, nomes]) => [
      campo,
      acharColuna(cabecalho, nomes),
    ]),
  );
  const faltando = OBRIGATORIAS.filter((campo) => idx[campo] < 0);
  if (faltando.length) {
    throw new Error(
      `Coluna obrigatória não encontrada na aba Resultado: ${faltando.join(", ")}`,
    );
  }

  // A API corta as células vazias do fim de cada linha: índice ausente é "".
  const celula = (linha, i) => (i < 0 ? "" : texto(linha[i]));

  /*
    Mesma chave: cópia idêntica entra uma vez (a aba tem linhas duplicadas);
    com números diferentes é outra vaga de mesmo nome (outras bancas, sem
    código) e entra com `repeticao` 2, 3… — o banco põe "#2" na chave.
  */
  const porChave = new Map();
  const saida = [];
  let copias = 0;
  for (const linha of valores.slice(1)) {
    if (!Array.isArray(linha)) continue;
    const vaga = celula(linha, idx.vaga);
    const edital = celula(linha, idx.edital);
    if (!vaga || !edital) continue;

    const registro = {
      edital,
      vaga,
      unidade: celula(linha, idx.unidade),
      cargo: celula(linha, idx.cargo),
      observacao: celula(linha, idx.observacao),
    };
    for (const campo of CAMPOS_NUMERICOS)
      registro[campo] = inteiroPtBr(celula(linha, idx[campo]));

    const chave = chaveDaVaga(edital, vaga);
    const mesmas = porChave.get(chave) || [];
    const assinatura = JSON.stringify(registro);
    if (mesmas.includes(assinatura)) {
      copias += 1;
      continue;
    }
    mesmas.push(assinatura);
    porChave.set(chave, mesmas);
    registro.repeticao = mesmas.length;
    saida.push(registro);
  }
  Object.defineProperty(saida, "copias", { value: copias });
  return saida;
}
