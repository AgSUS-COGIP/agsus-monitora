/*
  "O que significa": um botão ⓘ numa tela (os indicadores da Visão geral)
  abre a Aya já com a pergunta sobre aquele número, e ela responde da base de
  conhecimento (docs/aya/). A tela deixa aqui a pergunta
  (`perguntarParaAAya`); a Aya, que chega sob demanda, pega a pergunta uma vez
  só (`usarPerguntaParaAAya`), abre o painel e envia. Sem DOM e sem evento do
  navegador, como o pedido de filtro (pedido-de-filtro.ts): um valor guardado,
  com validade curta, para uma pergunta velha não aparecer numa abertura
  qualquer. A explicação fica na Aya, não na tela (textos-da-interface).
*/
import { useEffect, useSyncExternalStore } from "react";

const VALIDADE_MS = 15 * 1000;

let pedido: { pergunta: string; em: number } | null = null;
let versao = 0;
const ouvintes = new Set<() => void>();

/** Deixa a pergunta para a Aya (a última vale). */
export function perguntarParaAAya(
  pergunta: unknown,
  agora: number = Date.now(),
): void {
  const texto = String(pergunta ?? "").trim();
  if (!texto) return;
  pedido = { pergunta: texto, em: agora };
  versao += 1;
  for (const ouvinte of ouvintes) ouvinte();
}

/**
  Só abre a Aya, sem pergunta: o botão da Aya no cabeçalho
  (src/app/casca/topo.tsx). Ela pega o pedido como uma pergunta vazia.
*/
export function abrirAAya(agora: number = Date.now()): void {
  pedido = { pergunta: "", em: agora };
  versao += 1;
  for (const ouvinte of ouvintes) ouvinte();
}

/**
  A pergunta pendente (e ela some): `""` quando o pedido é só abrir, `null`
  se não há pedido ou passou da validade.
*/
export function consumirPerguntaParaAAya(
  agora: number = Date.now(),
): string | null {
  if (!pedido) return null;
  const { pergunta, em } = pedido;
  pedido = null;
  return agora - em <= VALIDADE_MS ? pergunta : null;
}

function assinar(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}
const obterVersao = () => versao;

/**
  Na Aya: a cada pedido novo (ou o pendente ao montar), `responder(pergunta)`
  uma vez; `""` é só abrir.
*/
export function usarPerguntaParaAAya(
  responder: (pergunta: string) => void,
): void {
  const atual = useSyncExternalStore(assinar, obterVersao, obterVersao);
  useEffect(() => {
    const pergunta = consumirPerguntaParaAAya();
    if (pergunta !== null) responder(pergunta);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `responder` muda a cada desenho; só a pergunta nova dispara.
  }, [atual]);
}
