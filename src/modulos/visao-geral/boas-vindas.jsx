import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  assinarDadosDoMonitoramento,
  linhasDaArea,
  obterDadosDoMonitoramento,
} from "../../componentes/dados-do-monitoramento.js";
import {
  chaveDoDia,
  editaisComEtapaNaSemana,
  primeiroNome,
  resumoDoDia,
  saudacao,
} from "../../lib/boas-vindas.js";
import {
  chaveDoMarco,
  gravarArmazenamento,
  lerArmazenamento,
  mensagemDoMarcoDoAno,
  proximoEstadoDoMarco,
} from "../../lib/comemoracao.js";
import { nomeDaArea } from "../../lib/menu-lateral.js";
import { lerMarcosDaArea } from "./marcos.js";

/*
  O topo da Visão geral (a mesma página nas três áreas), antes do resto:

  - Boas-vindas: aparece quando o perfil e os editais já chegaram. Fechar (×)
    esconde até o fim do dia (a data fica no navegador; sem armazenamento,
    fecha só nesta visita) e vale para as três áreas. A conta é dos editais
    da área atual com etapa na semana; "Ver cronograma" abre o Cronograma da
    área pelo item do menu.
  - Marcos do ano: "🎉 A equipe da Saúde Indígena passou de 7.500 análises
    concluídas em 2026!", num card igual, com ×. Números só da equipe
    (obter_marcos_da_area), nunca de uma pessoa; uma leitura por área e por
    pessoa em cada entrada, só com as comemorações ligadas. A regra (linha de
    base na primeira vez, marco novo contra o guardado, uma vez por marco) é
    de src/lib/comemoracao.js. Qualquer falha: o card não aparece.
*/

const CHAVE_FECHADA = "agsus_monitora_boas_vindas_fechada";

function fechadaHoje(agora) {
  try {
    return localStorage.getItem(CHAVE_FECHADA) === chaveDoDia(agora());
  } catch {
    return false;
  }
}

function lembrarFechada(agora) {
  try {
    localStorage.setItem(CHAVE_FECHADA, chaveDoDia(agora()));
  } catch {
    // Sem armazenamento: some agora e volta na próxima visita.
  }
}

/* Abre o Cronograma da área pelo item do menu (troca a área e a tela). */
function abrirCronogramaDaArea(area) {
  document
    .querySelector(`.menu-item[data-view="calendario"][data-area="${area}"]`)
    ?.click();
}

const usarDados = () =>
  useSyncExternalStore(assinarDadosDoMonitoramento, obterDadosDoMonitoramento);

export function BoasVindas({ obterPerfil, agora }) {
  const { linhas, carregado, areaAtual } = usarDados();
  const [fechada, setFechada] = useState(() => fechadaHoje(agora));
  const perfil = obterPerfil();
  if (fechada || !perfil || !carregado) return null;

  const nome = primeiroNome(perfil.nome || perfil.email?.split("@")[0]);
  const quantidade = editaisComEtapaNaSemana(
    linhasDaArea(linhas, areaAtual),
    agora(),
  );
  const titulo = [saudacao(agora().getHours()), nome]
    .filter(Boolean)
    .join(", ");
  return (
    <div className="boas-vindas" role="status" aria-live="polite">
      <div className="boas-vindas__texto">
        <strong>{titulo}</strong>
        <span>{resumoDoDia(quantidade)}</span>
      </div>
      {quantidade ? (
        <button
          type="button"
          className="boas-vindas__acao"
          data-boas-vindas="cronograma"
          onClick={() => abrirCronogramaDaArea(areaAtual)}
        >
          Ver cronograma
        </button>
      ) : null}
      <button
        type="button"
        className="boas-vindas__fechar"
        data-boas-vindas="fechar"
        aria-label="Fechar mensagem de boas-vindas"
        onClick={() => {
          lembrarFechada(agora);
          setFechada(true);
        }}
      >
        ×
      </button>
    </div>
  );
}

export function MarcosDoAno({
  obterPerfil,
  supabase,
  comemoracoesLigadas,
  armazenamento = globalThis.window?.localStorage,
}) {
  const { carregado, areaAtual } = usarDados();
  const [mensagem, setMensagem] = useState(null);
  const consultadas = useRef(new Set());
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
      setMensagem({
        area,
        texto: mensagemDoMarcoDoAno({
          nomeDaArea: nomeDaArea(area),
          marco: novo,
          ano: estado.ano,
        }),
      });
    })().catch((erro) => console.warn("Marcos do ano indisponíveis:", erro));
  }, [pode, usuarioId, areaAtual, supabase, armazenamento]);

  if (!pode || !mensagem || mensagem.area !== areaAtual) return null;
  return (
    <div className="boas-vindas marcos-do-ano" role="status" aria-live="polite">
      <div className="boas-vindas__texto">
        <strong>{mensagem.texto}</strong>
      </div>
      <button
        type="button"
        className="boas-vindas__fechar"
        aria-label="Fechar marco da equipe"
        onClick={() => setMensagem(null)}
      >
        ×
      </button>
    </div>
  );
}
