/*
  As vagas de um edital para a classificação: o código da vaga (das análises)
  ligado à linha do quadro de vagas do edital (TB_QUADRO_VAGA_EDITAL, ligação
  feita no banco por private."FC_QUADRO_DA_VAGA"), com as vagas imediatas por
  modalidade e o cabeçalho no padrão das publicações:

    VAGA 169681 - Cirurgião Dentista - Área de abrangência DSEI Xingu - DSEI Xingu - 3 vagas (2 AC + 1 Pretos e Pardos + CR)

  Toda linha do quadro aparece, mesmo sem candidato (a publicação lista todas
  as vagas, com "Não houve candidatos aptos.").

  As vagas por modalidade vêm, nesta ordem: do quadro do edital (quando traz a
  divisão), da configuração de convocação do edital (Lista de aprovados ›
  Convocação) ou dos percentuais da regra — estas duas pela MESMA conta da
  convocação (`derivarQuadro`; ver convocacao-do-edital.js).
*/
import { codigosDaModalidade, semAcento } from "./catalogo.js";
import {
  modeloDaRegra,
  vagasDaConvocacao,
  vagasPelaConta,
} from "./convocacao-do-edital.js";
import { numeroBR } from "./numeros.js";
import { normalizarRegra } from "./regra.js";

const texto = (valor) => String(valor ?? "").trim();

/** As vagas por modalidade de uma linha do quadro: `{ AC: 2, PP: 1 }` (null = só CR). */
export function vagasDoQuadroPorModalidade(modalidades) {
  const saida = {};
  let explicitas = false;
  for (const [nome, valor] of Object.entries(modalidades || {})) {
    const codigo = codigosDaModalidade(nome)[0];
    if (!codigo) continue;
    const n = numeroBR(valor);
    if (n !== null) explicitas = true;
    saida[codigo] = (saida[codigo] || 0) + (n ?? 0);
  }
  return explicitas ? saida : null;
}

function arredondarCota(valor, modo) {
  if (modo === "PARA_CIMA") return Math.ceil(valor - 1e-9);
  if (modo === "PARA_BAIXO") return Math.floor(valor + 1e-9);
  return Math.floor(valor + 0.5 + 1e-9);
}

/*
  Vagas por modalidade quando o quadro só traz o total: a reserva pelos
  percentuais da regra (só com o mínimo de vagas da regra), o resto na ampla —
  pela conta da convocação (`derivarQuadro`). Só "fração para baixo", que a
  convocação não tem, usa a conta daqui.
*/
export function vagasPelosPercentuais(total, regra) {
  const r = normalizarRegra(regra);
  const modelo = modeloDaRegra(r);
  if (modelo) return limparZeros(vagasPelaConta(total, modelo));
  const saida = { AC: total };
  if (!total || total < Math.max(1, r.cotas.minimo_vagas_reserva)) return saida;
  for (const m of r.modalidades) {
    if (m.codigo === "AC" || !m.percentual) continue;
    const n = arredondarCota((total * m.percentual) / 100, m.arredondamento);
    if (n > 0) {
      saida[m.codigo] = n;
      saida.AC -= n;
    }
  }
  saida.AC = Math.max(0, saida.AC);
  return saida;
}

function limparZeros(vagas) {
  return Object.fromEntries(
    Object.entries(vagas).filter(([codigo, n]) => codigo === "AC" || n > 0),
  );
}

function nomeDaModalidade(codigo, regra) {
  if (codigo === "AC") return "AC";
  return regra.modalidades.find((m) => m.codigo === codigo)?.nome || codigo;
}

/** "3 vagas (2 AC + 1 Pretos e pardos + CR)" ou "Cadastro Reserva". */
export function textoDasVagas(vaga, regraBruta) {
  const regra = normalizarRegra(regraBruta);
  const total = vaga.total ?? null;
  if (total === null) return "";
  if (!total) return "Cadastro Reserva";
  const partes = Object.entries(vaga.porModalidade || {})
    .filter(([, n]) => n > 0)
    .map(([codigo, n]) => `${n} ${nomeDaModalidade(codigo, regra)}`);
  if (vaga.cadastroReserva) partes.push("CR");
  return `${total} ${total === 1 ? "vaga" : "vagas"}${partes.length ? ` (${partes.join(" + ")})` : ""}`;
}

/** O cabeçalho da vaga na publicação. */
export function cabecalhoDaVaga(vaga, regra, unidade = "") {
  const partes = [
    vaga.codigo ? `VAGA ${vaga.codigo}` : "VAGA",
    vaga.cargo,
    vaga.lotacao,
    unidade && !semAcento(vaga.lotacao).includes(semAcento(unidade))
      ? unidade
      : "",
    textoDasVagas(vaga, regra),
  ].filter((parte) => texto(parte));
  return partes.join(" - ");
}

/**
 * As vagas do edital: uma por código de vaga das análises (com a linha do
 * quadro que a maioria dos candidatos daquela vaga liga) e uma por linha do
 * quadro sem candidato. Ordem: código da vaga, depois a ordem do quadro.
 */
export function montarVagas({
  candidatos = [],
  quadro = [],
  regra,
  unidade = "",
  convocacao = null,
}) {
  const r = normalizarRegra(regra);
  const linhas = new Map((quadro || []).map((q) => [String(q.id), q]));
  const porCodigo = new Map();
  for (const c of candidatos) {
    const codigo = texto(c.vaga);
    if (!codigo) continue;
    if (!porCodigo.has(codigo))
      porCodigo.set(codigo, { cargos: new Map(), quadros: new Map() });
    const v = porCodigo.get(codigo);
    const cargo = texto(c.cargo);
    if (cargo) v.cargos.set(cargo, (v.cargos.get(cargo) || 0) + 1);
    const q = c.quadroId ? String(c.quadroId) : "";
    if (q) v.quadros.set(q, (v.quadros.get(q) || 0) + 1);
  }
  const maisComum = (mapa) =>
    [...mapa.entries()].sort(
      (a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1),
    )[0]?.[0] || "";

  const usados = new Set();
  const vagas = [];
  const completar = (base, linha) => {
    const daConvocacao = base.codigo
      ? vagasDaConvocacao(convocacao, base.codigo)
      : null;
    if (!linha) {
      if (daConvocacao)
        return {
          ...base,
          total: daConvocacao.total,
          porModalidade: daConvocacao.porModalidade,
          cadastroReserva: false,
          semQuadro: false,
          origemDasVagas: "CONVOCACAO",
        };
      return {
        ...base,
        total: null,
        porModalidade: null,
        cadastroReserva: false,
        semQuadro: true,
        origemDasVagas: null,
      };
    }
    usados.add(String(linha.id));
    const total = Math.max(0, Math.trunc(numeroBR(linha.vagas_imediatas) ?? 0));
    const explicitas = vagasDoQuadroPorModalidade(linha.modalidades);
    // A configuração de convocação só vale se fala do mesmo total de vagas.
    const convocacaoCasa = daConvocacao && daConvocacao.total === total;
    return {
      ...base,
      cargo: texto(linha.cargo) || base.cargo,
      lotacao: texto(linha.lotacao),
      quadroId: String(linha.id),
      ordemQuadro: numeroBR(linha.ordem) ?? 0,
      total,
      porModalidade:
        explicitas ||
        (convocacaoCasa
          ? daConvocacao.porModalidade
          : vagasPelosPercentuais(total, r)),
      cadastroReserva: Boolean(linha.cadastro_reserva),
      semQuadro: false,
      origemDasVagas: explicitas
        ? "QUADRO"
        : convocacaoCasa
          ? "CONVOCACAO"
          : "REGRA",
      totalNaConvocacao:
        daConvocacao && !convocacaoCasa ? daConvocacao.total : null,
    };
  };

  for (const [codigo, v] of [...porCodigo.entries()].sort((a, b) =>
    a[0].localeCompare(b[0], "pt-BR", { numeric: true }),
  )) {
    const linha = linhas.get(maisComum(v.quadros));
    vagas.push(
      completar(
        { chave: codigo, codigo, cargo: maisComum(v.cargos), lotacao: "" },
        linha,
      ),
    );
  }
  for (const linha of [...linhas.values()].sort(
    (a, b) => (numeroBR(a.ordem) ?? 0) - (numeroBR(b.ordem) ?? 0),
  )) {
    if (usados.has(String(linha.id))) continue;
    vagas.push(
      completar(
        {
          chave: `quadro:${linha.id}`,
          codigo: "",
          cargo: texto(linha.cargo),
          lotacao: "",
        },
        linha,
      ),
    );
  }
  return vagas.map((v) => ({
    ...v,
    cabecalho: cabecalhoDaVaga(v, r, unidade),
  }));
}

/** O nível da vaga (superior, técnico…) pela regra e, sem ela, pela categoria. */
export function nivelDaVaga({ cargo = "", categoria = "" }, regra) {
  const r = normalizarRegra(regra);
  const c = semAcento(cargo);
  // O cargo COMEÇA com o termo ("Técnico de Enfermagem"; "Analista Técnico" não é técnico).
  const achado = r.documental.niveis_por_cargo.find(
    (n) => n.termo && c.trim().startsWith(semAcento(n.termo).trim()),
  );
  if (achado) return achado.nivel;
  const cat = semAcento(categoria);
  if (/superior/.test(cat)) return "superior";
  if (/tecnic/.test(cat)) return "tecnico";
  if (/medio/.test(cat)) return "medio";
  if (/fundamental/.test(cat)) return "fundamental";
  return r.documental.nivel_padrao || null;
}
