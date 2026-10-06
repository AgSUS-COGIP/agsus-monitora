import {
  CHAVE_PENDENTE,
  chaveDaDesativacao,
  chaveDoUsuario,
  mensagemDaComemoracao,
  oQuePodeUsar,
  tipoDeComemoracao,
} from "../lib/acesso-liberado.js";
import {
  gravarArmazenamento as gravar,
  lerArmazenamento as ler,
} from "../lib/comemoracao.js";
import { comemorar } from "./comemoracao.js";

/*
  "Parabéns, Ana! Seu acesso ao MONITORA foi liberado." (ou "Bem-vindo(a) de
  volta…" na reativação), com o que a pessoa pode usar agora. Regra em
  src/lib/acesso-liberado.js; os fogos e o aviso são os de todas as
  comemorações (src/modules/comemoracao.js), que respeitam
  prefers-reduced-motion. Armazenamento sempre em try/catch (janela privada,
  bloqueado): sem ele, as marcas não ficam e a regra da primeira entrada ainda
  limita a um dia.

  Com as comemorações desligadas (Configurações › Módulos e abas), as marcas
  são consumidas do mesmo jeito, mas nada aparece.
*/

/**
 * Depois de abrir o app: comemora se for a hora e apaga/grava as marcas.
 * Devolve o tipo mostrado ("liberado" | "reativado") ou null.
 */
export function comemorarAcessoLiberado({
  usuario,
  perfil,
  ligadas = true,
  doc = globalThis.document,
  janela = globalThis.window,
  agora = Date.now(),
} = {}) {
  const usuarioId = usuario?.id;
  const pedidoLiberado = ler(janela?.sessionStorage, CHAVE_PENDENTE) === "1";
  gravar(janela?.sessionStorage, CHAVE_PENDENTE, null);
  const estavaDesativada = Boolean(
    usuarioId && ler(janela?.localStorage, chaveDaDesativacao(usuarioId)),
  );
  const tipo = tipoDeComemoracao({
    usuarioId,
    estavaDesativada,
    jaComemorou: Boolean(ler(janela?.localStorage, chaveDoUsuario(usuarioId))),
    pedidoLiberado,
    contaCriadaEm: usuario?.created_at,
    perfilCriadoEm: perfil?.created_at,
    agora,
  });
  if (!tipo || !doc?.body) return null;
  gravar(janela?.localStorage, chaveDaDesativacao(usuarioId), null);
  gravar(
    janela?.localStorage,
    chaveDoUsuario(usuarioId),
    new Date(agora).toISOString(),
  );
  if (!ligadas) return null;
  comemorar({
    texto: mensagemDaComemoracao(
      tipo,
      perfil?.nome,
      usuario?.email || perfil?.email,
    ),
    itens: oQuePodeUsar(perfil),
    tituloDosItens: "O que você já pode usar:",
    doc,
    janela,
  });
  return tipo;
}
