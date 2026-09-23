/*
  CATÁLOGO DAS PLANILHAS DO MONITORA

  Único lugar do código com link, caminho ou bucket de planilha. Quem consome uma
  planilha importa daqui; ninguém escreve o endereço de novo em outro arquivo.
  `tests/planilhas.test.js` falha se um link de planilha aparecer fora deste arquivo.

  Cada entrada diz o que a planilha é, onde ela mora e quem a usa (`usadaEm`), para
  que trocar um endereço seja editar uma linha aqui e nada mais.

  Duas planilhas não têm endereço fixo, e isso é do domínio, não uma lacuna:
  - a lista de aprovados importada existe uma por edital, no Storage do Supabase;
  - a planilha de origem de cada análise vem do banco, linha a linha
    (`origem_arquivo_id`). Aqui fica só a regra que transforma o id em link.
*/

const GOOGLE_SHEETS = "https://docs.google.com/spreadsheets/d/";

export const PLANILHAS = Object.freeze({
  modeloListaAprovados: Object.freeze({
    nome: "Modelo de importação da lista de aprovados",
    onde: "arquivo estático do build",
    url: "/assets/modelo-importacao-lista-aprovados.xlsx",
    nomeDoArquivo: "modelo-importacao-lista-aprovados.xlsx",
    arquivoNoRepositorio:
      "public/assets/modelo-importacao-lista-aprovados.xlsx",
    usadaEm: Object.freeze([
      "index.html (#approvedImportModelLink)",
      "src/modules/lista-aprovados.js",
    ]),
  }),

  listaAprovadosImportada: Object.freeze({
    nome: "Lista de aprovados importada (XLSX por edital)",
    onde: "Supabase Storage",
    bucket: "listas-aprovados",
    usadaEm: Object.freeze(["src/modules/lista-aprovados.js"]),
  }),

  origemDaAnalise: Object.freeze({
    nome: "Planilha de origem de cada análise (Google Sheets)",
    onde: "id por linha, no campo origem_arquivo_id da análise",
    usadaEm: Object.freeze(["src/analises/analises-app.js"]),
  }),

  lotacoes: Object.freeze({
    nome: "Planilha oficial de Lotações",
    onde: "Google Sheets",
    // PENDENTE: id da planilha (o trecho entre /d/ e /edit do link). Enquanto for
    // null, `scripts/validar-localizacoes.mjs` exige o caminho de um .xlsx local.
    // Para o download funcionar, a planilha precisa estar acessível por link.
    idGoogle: null,
    usadaEm: Object.freeze(["scripts/validar-localizacoes.mjs"]),
  }),
});

function idGoogleValido(id) {
  const limpo = String(id ?? "").trim();
  return /^[A-Za-z0-9_-]{10,}$/.test(limpo) ? limpo : "";
}

/** Link de edição de uma planilha do Google Sheets, ou "" se o id não servir. */
export function urlDaPlanilhaGoogle(id) {
  const limpo = idGoogleValido(id);
  return limpo ? `${GOOGLE_SHEETS}${limpo}/edit` : "";
}

/** Link que baixa a planilha do Google Sheets como .xlsx, ou "" se o id não servir. */
export function urlDeExportacaoXlsx(id) {
  const limpo = idGoogleValido(id);
  return limpo ? `${GOOGLE_SHEETS}${limpo}/export?format=xlsx` : "";
}
