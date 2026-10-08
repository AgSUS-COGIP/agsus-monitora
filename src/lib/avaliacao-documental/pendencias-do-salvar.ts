/*
  O que falta para "Salvar como versão N" no passo 5 do assistente da regra,
  em itens que levam ao passo e ao campo. `impede`: o botão fica desabilitado
  enquanto houver um (motivo curto, nada mudou, nome inválido, erro da regra
  ou da classificação — os mesmos que o banco recusa). Os outros são para
  conferir e não impedem: pergunta sem ligação com a Empregare e requisito sem
  item do edital.
*/
import { ligacoesDaRegra, situacaoDaPergunta } from "./assistente-da-regra.ts";
import type { ColunasDaVaga, RegraAnalise } from "./tipos-da-regra.ts";

export type IdDoPasso =
  "partida" | "cardapio" | "perguntas" | "nota" | "conferir";

export type PendenciaDoSalvar = {
  texto: string;
  passo: IdDoPasso;
  /** Seletor do campo no passo (a tela rola e foca). */
  alvo?: string;
  impede: boolean;
};

export const MOTIVO_MINIMO = 10;

const aspas = (texto: string) => `“${texto}”`;
const css = (valor: string) => valor.replace(/["\\]/g, "\\$&");

/** Em que passo (e campo) se corrige um erro de validação da regra. */
export function lugarDoErro(erro: string): {
  passo: IdDoPasso;
  alvo?: string;
} {
  const texto = String(erro);
  if (texto.startsWith("Classificação:"))
    return { passo: "nota", alvo: "[data-tour='avd-assistente-desempate']" };
  if (/^Desempate da Provisória/.test(texto))
    return {
      passo: "nota",
      alvo: "[data-tour='avd-assistente-desempate-provisoria']",
    };
  if (
    /^(Nota declarada|Pergunta da experiência|Desempate pela experiência)/.test(
      texto,
    )
  )
    return { passo: "perguntas" };
  const bloco = /^Bloco \d+ \(([A-Z0-9_]+)\)/.exec(texto);
  if (bloco) {
    const codigo = css(bloco[1] ?? "");
    return /pergunta/i.test(texto)
      ? { passo: "perguntas", alvo: `[data-bloco="${codigo}"]` }
      : { passo: "cardapio", alvo: `[data-cartao="bloco:${codigo}"]` };
  }
  if (/^Eliminação automática/.test(texto))
    return { passo: "cardapio", alvo: `[data-cartao^="eliminacao:"]` };
  return { passo: "cardapio" };
}

export type EntradaDasPendencias = {
  regra: RegraAnalise | null;
  /** Erros da regra (validarRegraAnalise) e da classificação ("Classificação: …"). */
  erros: ReadonlyArray<string>;
  /** A regra ou a classificação mudou em relação à vigente. */
  mudou: boolean;
  /** Já existe versão vigente (sem ela, a primeira versão sempre "muda"). */
  temVigente: boolean;
  motivo: string;
  motivoObrigatorio: boolean;
  /** O erro do nome da versão ("" sem erro). */
  erroDoNome?: string;
  /** As colunas da última carga de cada vaga (para a ligação das perguntas). */
  vagas?: ReadonlyArray<ColunasDaVaga>;
};

/** A lista do que falta (primeiro o que impede), cada item com o passo e o campo. */
export function pendenciasDoSalvar({
  regra,
  erros,
  mudou,
  temVigente,
  motivo,
  motivoObrigatorio,
  erroDoNome = "",
  vagas = [],
}: EntradaDasPendencias): PendenciaDoSalvar[] {
  const lista: PendenciaDoSalvar[] = [];
  if (!regra) return lista;
  if (!mudou && temVigente)
    lista.push({
      texto: "Nenhuma mudança em relação à versão vigente",
      passo: "cardapio",
      impede: true,
    });
  if (mudou && motivoObrigatorio && motivo.trim().length < MOTIVO_MINIMO)
    lista.push({
      texto: `Escreva o motivo da alteração (mín. ${MOTIVO_MINIMO} caracteres)`,
      passo: "conferir",
      alvo: "[data-campo='motivo'] input",
      impede: true,
    });
  if (mudou && erroDoNome)
    lista.push({
      texto: `Nome da versão: ${erroDoNome.replace(/\.$/, "").toLowerCase()}`,
      passo: "conferir",
      alvo: "[data-campo='nome'] input",
      impede: true,
    });
  for (const erro of erros)
    lista.push({
      texto: erro.replace(/\.$/, ""),
      ...lugarDoErro(erro),
      impede: true,
    });

  // Para conferir (não impede).
  if (vagas.length)
    for (const l of ligacoesDaRegra(regra)) {
      if (l.grupo === "bloco") {
        const bloco = regra.blocos.find((b) => b.codigo === l.codigo);
        if (!bloco || bloco.tipo === "REGISTRO") continue;
      }
      const situacao = situacaoDaPergunta(l.pergunta, vagas).situacao;
      if (situacao === "vazia" || situacao === "nao_achou")
        lista.push({
          texto: `Pergunta de ${aspas(l.rotulo)} sem ligação com a Empregare`,
          passo: "perguntas",
          alvo: `[data-ligacao="${css(l.id)}"]`,
          impede: false,
        });
    }
  for (const b of regra.blocos)
    if (
      Object.values(b.efeitos ?? {}).includes("ELIMINA") &&
      !String(b.item_edital ?? "").trim()
    )
      lista.push({
        texto: `Requisito ${aspas(b.titulo || b.codigo)} sem item do edital`,
        passo: "cardapio",
        alvo: `[data-cartao="bloco:${css(b.codigo)}"]`,
        impede: false,
      });
  return lista;
}
