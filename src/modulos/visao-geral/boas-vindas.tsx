import type { PropsDasBoasVindas, PropsDosMarcos } from "./tipos.ts";
import { useEffect, useRef, useSyncExternalStore } from "react";
import {
  assinarDadosDoMonitoramento,
  linhasDaArea,
  obterDadosDoMonitoramento,
} from "../../componentes/dados-do-monitoramento.ts";
import {
  editaisComEtapaNaSemana,
  primeiroNome,
  resumoDoDia,
  saudacao,
} from "../../lib/boas-vindas.ts";
import {
  chaveDoMarco,
  formaDoMarco,
  gravarArmazenamento,
  lerArmazenamento,
  mensagemDoMarcoDoAno,
  proximoEstadoDoMarco,
} from "../../lib/comemoracao.ts";
import { semTreinamento } from "../../lib/edital-de-treinamento.ts";
import { nomeDaArea } from "../../lib/menu-lateral.ts";
import { comemorar } from "../../app/comemoracao-sob-demanda.ts";
import { lerMarcosDaArea } from "./marcos.ts";
import { linhasDaResposta } from "../../lib/visao-geral.ts";

/*
  O topo da Visão geral (a mesma página nas três áreas), antes do resto:

  - Boas-vindas: aparece quando o perfil e os editais já chegaram, sem botão
    de fechar — é onde fica a conta dos editais da área atual com etapa na
    semana (o bloco "Próximos 7 dias" saiu por isso); "Ver cronograma" abre o
    Cronograma da área pelo item do menu.
  - Marcos do ano: sem card na tela; só o aviso da comemoração ("Saúde
    Indígena: 7.500 análises concluídas em 2026.") com os fogos do marco (o
    número desenhado no céu). Números só da equipe (obter_marcos_da_area),
    nunca de uma pessoa; uma leitura por área e por pessoa em cada entrada,
    só com as comemorações ligadas. A regra (linha de base em silêncio na
    primeira vez, marco novo contra o guardado, uma vez por marco) é de
    src/lib/comemoracao.ts. Qualquer falha: nada aparece.
*/

/* Abre o Cronograma da área pelo item do menu (troca a área e a tela). */
function abrirCronogramaDaArea(area: string) {
  document
    .querySelector<HTMLElement>(
      `.menu-item[data-view="calendario"][data-area="${area}"]`,
    )
    ?.click();
}

const usarDados = () =>
  useSyncExternalStore(assinarDadosDoMonitoramento, obterDadosDoMonitoramento);

export function BoasVindas({ obterPerfil, agora }: PropsDasBoasVindas) {
  const { linhas, carregado, areaAtual } = usarDados();
  const perfil = obterPerfil();
  if (!perfil || !carregado) return null;

  const nome = primeiroNome(perfil.nome || perfil.email?.split("@")[0]);
  const quantidade = editaisComEtapaNaSemana(
    semTreinamento(linhasDaArea(linhasDaResposta(linhas), areaAtual)),
    agora(),
  );
  const titulo = [saudacao(agora().getHours()), nome]
    .filter(Boolean)
    .join(", ");
  return (
    <div
      className="boas-vindas"
      role="status"
      aria-live="polite"
      data-tour="visao-geral-boas-vindas"
    >
      <div className="boas-vindas__texto">
        <strong>{titulo}</strong>
        <span>{resumoDoDia(quantidade)}</span>
      </div>
      {quantidade ? (
        <button
          type="button"
          className="boas-vindas__acao"
          data-boas-vindas="cronograma"
          data-tour="visao-geral-ver-cronograma"
          onClick={() => abrirCronogramaDaArea(areaAtual)}
        >
          Ver cronograma
        </button>
      ) : null}
    </div>
  );
}

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
