/*
  Anexos do edital em PDF → cronograma e quadro de vagas, sem DOM.

  Quem lê o PDF é a função Python `/api/anexos-do-edital` (pdfplumber). Aqui
  fica o que o formulário faz com a resposta: juntar mais de um PDF (Projetos
  publica cada anexo num arquivo), transformar o Anexo I em etapas do editor e
  o Anexo II nas linhas que `salvar_quadro_de_vagas` grava.

  A tela é `src/componentes/nucleo/importar-anexos.jsx`.
*/

import { novaEtapa } from "./cronograma-do-edital.js";

const txt = (valor) => String(valor ?? "").trim();

export const ENDERECO_ANEXOS = "/api/anexos-do-edital";
export const LIMITE_DO_PDF = 4 * 1024 * 1024;

/** Número do edital sem zeros à esquerda: "091/2026" → "91/2026". */
export function numeroDoEdital(texto) {
  const m = txt(texto).match(/(\d{1,4})\s*\/\s*(\d{4})/);
  return m ? `${Number(m[1])}/${m[2]}` : "";
}

/** Por que o arquivo não pode ir (ou "" se pode). */
export function problemaDoArquivo(arquivo) {
  if (!arquivo) return "Escolha o PDF de anexos.";
  const ehPdf =
    arquivo.type === "application/pdf" || /\.pdf$/i.test(arquivo.name || "");
  if (!ehPdf) return `${arquivo.name}: não é PDF.`;
  if (arquivo.size > LIMITE_DO_PDF) return `${arquivo.name}: maior que 4 MB.`;
  return "";
}

/**
 * Manda um PDF à função Python. Devolve a resposta dela com `arquivo`, ou
 * lança Error com a mensagem para a tela.
 */
export async function lerAnexoNoServidor(
  arquivo,
  { token, buscar = fetch } = {},
) {
  const problema = problemaDoArquivo(arquivo);
  if (problema) throw new Error(problema);
  let resposta;
  try {
    resposta = await buscar(ENDERECO_ANEXOS, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/pdf",
      },
      body: arquivo,
    });
  } catch {
    throw new Error("Não consegui falar com o leitor de PDF.");
  }
  if (resposta.status === 404)
    throw new Error(
      "O leitor de PDF só existe na versão publicada (Vercel), não neste ambiente.",
    );
  const corpo = await resposta.json().catch(() => ({}));
  if (!resposta.ok)
    throw new Error(corpo?.erro || `Falha ao ler ${arquivo.name}.`);
  return { ...corpo, arquivo: arquivo.name };
}

/**
 * Junta as respostas de um ou mais PDFs: o primeiro cronograma encontrado, as
 * linhas de quadro de todos (na ordem dos arquivos), as modalidades sem
 * repetir e os avisos que continuam valendo depois de juntar.
 */
export function juntarAnexos(resultados) {
  const lista = (resultados || []).filter(Boolean);
  const comCronograma = lista.find((r) => r.cronograma?.length);
  const comQuadro = lista.filter((r) => r.vagas?.length);
  const modalidades = [];
  for (const r of comQuadro)
    for (const m of r.modalidades || [])
      if (!modalidades.includes(m)) modalidades.push(m);
  const avisos = [];
  if (!comCronograma) avisos.push("Nenhum PDF trouxe o cronograma (Anexo I).");
  else if (comCronograma.cronograma.some((e) => !e.data_inicio))
    avisos.push(
      "Algumas etapas vieram sem data reconhecível; confira antes de salvar.",
    );
  if (!comQuadro.length) avisos.push("Nenhum PDF trouxe o quadro de vagas.");
  return {
    edital: lista.map((r) => numeroDoEdital(r.edital)).find(Boolean) || "",
    unidade: lista.map((r) => txt(r.unidade)).find(Boolean) || "",
    arquivos: lista.map((r) => r.arquivo).filter(Boolean),
    cronograma: comCronograma?.cronograma || [],
    arquivoDoCronograma: comCronograma?.arquivo || "",
    vagas: comQuadro.flatMap((r) => r.vagas),
    arquivoDoQuadro: comQuadro.map((r) => r.arquivo).join(", "),
    modalidades,
    avisos,
  };
}

/** Etapas do editor a partir do Anexo I (origem PDF). */
export function etapasDoAnexo(cronograma) {
  return (cronograma || []).map((e, indice) =>
    novaEtapa(
      {
        atividade: e.atividade,
        data_inicio: e.data_inicio,
        data_fim: e.data_fim || e.data_inicio,
        origem: "PDF",
        observacao: e.data_inicio ? "" : `No PDF: ${txt(e.texto_datas)}`,
      },
      indice + 1,
    ),
  );
}

/** O que `salvar_quadro_de_vagas` recebe. */
export function quadroParaSalvar(juntado) {
  return {
    origem: "PDF",
    arquivo: txt(juntado?.arquivoDoQuadro).slice(0, 300),
    linhas: (juntado?.vagas || []).map((v) => ({
      cargo: txt(v.cargo),
      lotacao: txt(v.lotacao),
      modalidades: v.modalidades || {},
      vagas_imediatas: Number(v.vagas_imediatas) || 0,
      cadastro_reserva: Boolean(v.cadastro_reserva),
    })),
  };
}

/** Totais para a frase de resumo do quadro. */
export function resumoDoQuadro(linhas) {
  const lista = linhas || [];
  return {
    linhas: lista.length,
    cargos: new Set(lista.map((v) => txt(v.cargo).toLowerCase())).size,
    imediatas: lista.reduce((s, v) => s + (Number(v.vagas_imediatas) || 0), 0),
    soCadastroReserva: lista.filter(
      (v) => !Number(v.vagas_imediatas) && v.cadastro_reserva,
    ).length,
  };
}

/** Célula de modalidade: número, "CR" ou "—". */
export function textoDaModalidade(valor, cadastroReserva) {
  if (valor === null || valor === undefined || valor === "")
    return cadastroReserva ? "CR" : "—";
  return String(valor);
}

/**
 * Aviso quando o PDF é de outro edital que o do formulário. Sem número de um
 * dos lados, não avisa.
 */
export function editalDiferente(numeroDoFormulario, numeroDoPdf) {
  const a = numeroDoEdital(numeroDoFormulario);
  const b = numeroDoEdital(numeroDoPdf);
  return Boolean(a && b && a !== b);
}
