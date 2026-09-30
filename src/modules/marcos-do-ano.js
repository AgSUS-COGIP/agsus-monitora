import {
  chaveDoMarco,
  gravarArmazenamento,
  lerArmazenamento,
  mensagemDoMarcoDoAno,
  proximoEstadoDoMarco,
} from "../lib/comemoracao.js";
import { nomeDaArea } from "../lib/menu-lateral.js";
import { getSupabaseClient } from "../lib/supabaseClient.js";
import {
  assinarDadosDoMonitoramento,
  obterDadosDoMonitoramento,
} from "../componentes/dados-do-monitoramento.js";
import { situacaoDoSistema } from "./situacao-dos-modulos.js";
import "../styles/boas-vindas.css";

/*
  Marcos do ano na Visão geral: "🎉 A equipe da Saúde Indígena passou de
  7.500 análises concluídas em 2026!", num card discreto logo abaixo das
  boas-vindas (mesmo visual), com × para fechar. Números só da equipe
  (obter_marcos_da_area), nunca de uma pessoa.

  Uma leitura por área e por pessoa em cada entrada, só com as comemorações
  ligadas (situacaoDoSistema().comemoracoes). A regra — linha de base na
  primeira vez, marco novo contra o guardado, uma vez por marco — é de
  src/lib/comemoracao.js. Qualquer falha: o card simplesmente não aparece.
*/

const RPC_MARCOS_DA_AREA = "obter_marcos_da_area";

export function initMarcosDoAno({
  raiz = document.getElementById("marcosDoAno"),
  obterPerfil = () => window.getMonitoraProfile?.(),
  supabase = null,
  obterSituacao = situacaoDoSistema,
  armazenamento = globalThis.window?.localStorage,
} = {}) {
  if (!raiz) return () => {};
  const consultadas = new Set();
  let mensagem = "";
  let areaDaMensagem = "";

  const esconder = () => {
    raiz.hidden = true;
    raiz.replaceChildren();
  };

  function mostrar(texto) {
    const corpo = document.createElement("div");
    corpo.className = "boas-vindas__texto";
    const frase = document.createElement("strong");
    frase.textContent = texto;
    corpo.append(frase);
    const fechar = document.createElement("button");
    fechar.type = "button";
    fechar.className = "boas-vindas__fechar";
    fechar.setAttribute("aria-label", "Fechar marco da equipe");
    fechar.textContent = "×";
    fechar.addEventListener("click", () => {
      mensagem = "";
      esconder();
    });
    raiz.replaceChildren(corpo, fechar);
    raiz.hidden = false;
  }

  async function consultar(usuarioId, area) {
    const cliente = supabase || getSupabaseClient();
    const { data, error } = (await cliente?.rpc?.(RPC_MARCOS_DA_AREA, {
      p_area: area,
    })) || { error: new Error("Supabase indisponível.") };
    if (error || !data) return;
    const chave = chaveDoMarco("ano", usuarioId, area);
    let anterior = null;
    try {
      anterior = JSON.parse(lerArmazenamento(armazenamento, chave) ?? "null");
    } catch {
      anterior = null;
    }
    const { estado, novo } = proximoEstadoDoMarco(anterior, {
      ano: data.ano,
      quantidade: data.concluidas_no_ano,
    });
    const gravou = gravarArmazenamento(
      armazenamento,
      chave,
      JSON.stringify(estado),
    );
    if (!gravou || !novo) return;
    mensagem = mensagemDoMarcoDoAno({
      nomeDaArea: nomeDaArea(area),
      marco: novo,
      ano: estado.ano,
    });
    areaDaMensagem = area;
    desenhar();
  }

  function desenhar() {
    const perfil = obterPerfil();
    const { carregado, areaAtual } = obterDadosDoMonitoramento();
    const ligadas = obterSituacao()?.comemoracoes === true;
    const usuarioId = String(perfil?.user_id || perfil?.id || "").trim();
    if (!perfil || !carregado || !ligadas || !usuarioId) {
      esconder();
      return;
    }
    if (mensagem && areaDaMensagem === areaAtual) mostrar(mensagem);
    else esconder();
    const chave = `${usuarioId}|${areaAtual}`;
    if (consultadas.has(chave)) return;
    consultadas.add(chave);
    consultar(usuarioId, areaAtual).catch((erro) =>
      console.warn("Marcos do ano indisponíveis:", erro),
    );
  }

  desenhar();
  return assinarDadosDoMonitoramento(desenhar);
}
