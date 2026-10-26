/*
  Quem responde por um edital: USI ou CORES.

  A escolha não é só um rótulo — decide de que catálogo vêm as unidades do
  formulário. A USI trabalha com os DSEI e CASAI de `TD_UNIDADE`; o CORES tem
  sete unidades próprias, que não estão naquela tabela e nem deveriam estar:
  `TD_UNIDADE` também alimenta o mapa da Saúde Indígena e os filtros de
  Análises, onde elas apareceriam fora de lugar.

  Por não estarem no catálogo, o edital do CORES grava só o nome da unidade —
  sem id_unidade, sigla ou tipo a que se ligar — e fica sem UF, porque estas
  unidades não pertencem a um estado (SEDE, Saúde nas Fronteiras).
*/

const text = (value) => String(value ?? "").trim();

/** Código da área em `TB_AREA`. */
export const AREA_SAUDE_INDIGENA = "saude-indigena";

export const RESPONSAVEL_USI = "USI";
export const RESPONSAVEL_CORES = "CORES";

export const RESPONSAVEIS_DE_EDITAL = Object.freeze([
  RESPONSAVEL_USI,
  RESPONSAVEL_CORES,
]);

export const UNIDADES_CORES = Object.freeze([
  "CCE",
  "MFC",
  "SEDE",
  "Rio Doce",
  "Projeto Agora Tem Especialistas Caminhoneiros",
  "Escritório Distrital e Regional",
  "Saúde nas Fronteiras",
]);

/**
 * Normaliza o que está gravado em `responsavel` para uma das opções do select.
 *
 * Editais anteriores a este campo virar seleção guardam um nome de pessoa.
 * Esse valor não é USI nem CORES, então devolve `""`: o select abre vazio e o
 * nome antigo só é substituído quando aquele edital for salvo de novo.
 */
export function normalizarResponsavel(valor) {
  const limpo = text(valor).toUpperCase();
  return RESPONSAVEIS_DE_EDITAL.includes(limpo) ? limpo : "";
}

export function ehResponsavelCores(valor) {
  return normalizarResponsavel(valor) === RESPONSAVEL_CORES;
}

/**
 * Unidades que o formulário deve oferecer para o responsável escolhido.
 *
 * @param {string} responsavel USI, CORES ou vazio.
 * @param {Array<object>} unidadesDoCatalogo Linhas de `TD_UNIDADE`.
 * @returns {Array<{nome_oficial: string, id_unidade: string, sigla: string, tipo: string, uf_sede: string}>}
 */
export function unidadesDoResponsavel(responsavel, unidadesDoCatalogo) {
  if (ehResponsavelCores(responsavel)) {
    return UNIDADES_CORES.map((nome) => ({
      nome_oficial: nome,
      id_unidade: "",
      sigla: "",
      tipo: "",
      uf_sede: "",
    }));
  }
  // Sem responsável escolhido vale o catálogo de sempre, como antes deste campo.
  return unidadesDoCatalogo || [];
}

const semAcento = (valor) =>
  text(valor).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const UNIDADES_CORES_NORMALIZADAS = new Set(UNIDADES_CORES.map(semAcento));

/**
 * O edital entra no painel da Saúde Indígena?
 *
 * O painel mostrava tudo o que está em `TB_MONITORAMENTO_INDIGENA`, inclusive
 * SEDE, MFC e as outras unidades do CORES. O responsável sozinho não basta:
 * `20260922120000_editais_existentes_como_usi.sql` marcou todos os editais
 * antigos como USI, os do CORES inclusive. Por isso a unidade também decide —
 * uma unidade do catálogo do CORES nunca é da Saúde Indígena.
 *
 * Desde 25/09/2026 o banco sabe a área (`CO_AREA`, calculada pela mesma regra
 * em `private."FC_AREA_EDITAL"`) e ela manda. A regra local fica só para
 * linhas sem a coluna — cache offline gravado antes da mudança.
 *
 * Quem não é admin já recebe do banco só editais das suas áreas; este filtro é
 * o do painel da Saúde Indígena, que também vale para o admin.
 */
export function ehEditalDaSaudeIndigena(edital) {
  if (edital?.CO_AREA) return edital.CO_AREA === AREA_SAUDE_INDIGENA;
  if (ehResponsavelCores(edital?.responsavel)) return false;
  return !UNIDADES_CORES_NORMALIZADAS.has(semAcento(edital?.unidade));
}
