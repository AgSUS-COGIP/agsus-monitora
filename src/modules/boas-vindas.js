import {
  chaveDoDia,
  editaisComEtapaNaSemana,
  primeiroNome,
  resumoDoDia,
  saudacao,
} from "../lib/boas-vindas.js";
import {
  assinarDadosDoMonitoramento,
  linhasDaArea,
  obterDadosDoMonitoramento,
} from "../componentes/dados-do-monitoramento.js";
import { escapeHtml } from "../lib/sanitize.js";
import "../styles/boas-vindas.css";

/*
  Boas-vindas no topo da Visão geral (a mesma página nas três áreas).

  Aparece quando o perfil e os editais já chegaram. Fechar (×) esconde até o
  fim do dia: guarda-se a data em localStorage, e amanhã ela volta. Sem
  armazenamento (janela privada), fecha só nesta visita.
  A conta é dos editais da área atual, e "Ver cronograma" abre o Cronograma
  dela. Fechar numa área fecha em todas, até amanhã.
*/
const CHAVE_FECHADA = "agsus_monitora_boas_vindas_fechada";

function fechadaHoje() {
  try {
    return localStorage.getItem(CHAVE_FECHADA) === chaveDoDia();
  } catch {
    return false;
  }
}

function lembrarFechada() {
  try {
    localStorage.setItem(CHAVE_FECHADA, chaveDoDia());
  } catch {
    // Sem armazenamento: some agora e volta na próxima visita.
  }
}

/* Abre o Cronograma da área pelo item do menu. */
function abrirCronogramaDaArea(area) {
  document
    .querySelector(`.menu-item[data-view="calendario"][data-area="${area}"]`)
    ?.click();
}

export function initBoasVindas({
  raiz = document.getElementById("boasVindas"),
  obterPerfil = () => window.getMonitoraProfile?.(),
  agora = () => new Date(),
} = {}) {
  if (!raiz) return () => {};
  let fechada = fechadaHoje();

  const desenhar = () => {
    const perfil = obterPerfil();
    const { linhas, carregado, areaAtual } = obterDadosDoMonitoramento();
    if (fechada || !perfil || !carregado) {
      raiz.hidden = true;
      return;
    }
    const nome = primeiroNome(perfil.nome || perfil.email?.split("@")[0]);
    const quantidade = editaisComEtapaNaSemana(
      linhasDaArea(linhas, areaAtual),
      agora(),
    );
    const titulo = [saudacao(agora().getHours()), nome]
      .filter(Boolean)
      .join(", ");
    raiz.innerHTML = `
      <div class="boas-vindas__texto">
        <strong>${escapeHtml(titulo)}</strong>
        <span>${escapeHtml(resumoDoDia(quantidade))}</span>
      </div>
      ${quantidade ? '<button type="button" class="boas-vindas__acao" data-boas-vindas="cronograma">Ver cronograma</button>' : ""}
      <button type="button" class="boas-vindas__fechar" data-boas-vindas="fechar" aria-label="Fechar mensagem de boas-vindas">×</button>`;
    raiz.hidden = false;
  };

  raiz.addEventListener("click", (evento) => {
    const alvo = evento.target.closest("[data-boas-vindas]");
    if (!alvo) return;
    if (alvo.dataset.boasVindas === "cronograma")
      abrirCronogramaDaArea(obterDadosDoMonitoramento().areaAtual);
    if (alvo.dataset.boasVindas === "fechar") {
      fechada = true;
      lembrarFechada();
      desenhar();
    }
  });

  desenhar();
  return assinarDadosDoMonitoramento(desenhar);
}
