import type { PropsDosMarcos } from "./tipos.ts";
import { useEffect, useRef, useSyncExternalStore } from "react";
import {
  assinarDadosDoMonitoramento,
  obterDadosDoMonitoramento,
} from "../../componentes/dados-do-monitoramento.ts";
import {
  chaveDoMarco,
  formaDoMarco,
  gravarArmazenamento,
  lerArmazenamento,
  mensagemDoMarcoDoAno,
  proximoEstadoDoMarco,
} from "../../lib/comemoracao.ts";
import { nomeDaArea } from "../../lib/navegacao/menu-lateral.ts";
import { comemorar } from "../../app/comemoracao-sob-demanda.ts";
import { lerMarcosDaArea } from "./marcos.ts";

/*
  Os marcos do ano da Visão geral (a saudação e a semana ficam no cabeçalho
  da tela, paineis.tsx, desde o layout A de 17/11/2026):

  - Marcos do ano: sem card na tela; só o aviso da comemoração ("Saúde
    Indígena: 7.500 análises concluídas em 2026.") com os fogos do marco (o
    número desenhado no céu). Números só da equipe (obter_marcos_da_area),
    nunca de uma pessoa; uma leitura por área e por pessoa em cada entrada,
    só com as comemorações ligadas. A regra (linha de base em silêncio na
    primeira vez, marco novo contra o guardado, uma vez por marco) é de
    src/lib/comemoracao.ts. Qualquer falha: nada aparece.
*/

const usarDados = () =>
  useSyncExternalStore(assinarDadosDoMonitoramento, obterDadosDoMonitoramento);

/* Não desenha nada: lê o marco do ano da área e solta a comemoração. */
export function MarcosDoAno({
  obterPerfil,
  supabase,
  comemoracoesLigadas,
  armazenamento = globalThis.window?.localStorage,
}: PropsDosMarcos) {
  const { carregado, areaAtual } = usarDados();
  const consultadas = useRef(new Set<string>());
  const montado = useRef(false);
  const perfil = obterPerfil();
  const usuarioId = String(perfil?.user_id || perfil?.id || "").trim();
  const ligadas = comemoracoesLigadas() === true;
  const pode = Boolean(perfil && carregado && ligadas && usuarioId);

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  useEffect(() => {
    if (!pode) return;
    const area = areaAtual;
    const chave = `${usuarioId}|${area}`;
    if (consultadas.current.has(chave)) return;
    consultadas.current.add(chave);
    (async () => {
      const { data, error } = await lerMarcosDaArea(supabase, area);
      if (error || !data) return;
      const chaveGuardada = chaveDoMarco("ano", usuarioId, area);
      let anterior = null;
      try {
        anterior = JSON.parse(
          lerArmazenamento(armazenamento, chaveGuardada) ?? "null",
        );
      } catch {
        anterior = null;
      }
      const { estado, novo } = proximoEstadoDoMarco(anterior, {
        ano: data.ano,
        quantidade: data.concluidas_no_ano,
      });
      const gravou = gravarArmazenamento(
        armazenamento,
        chaveGuardada,
        JSON.stringify(estado),
      );
      if (!gravou || !novo || !montado.current) return;
      // O aviso com o fato e os fogos do marco (o número desenhado no céu).
      void comemorar({
        texto: mensagemDoMarcoDoAno({
          nomeDaArea: nomeDaArea(area),
          marco: novo,
          ano: estado.ano,
        }),
        marco: "marco-do-ano",
        forma: formaDoMarco(novo),
      });
    })().catch((erro) => console.warn("Marcos do ano indisponíveis:", erro));
  }, [pode, usuarioId, areaAtual, supabase, armazenamento]);

  return null;
}
