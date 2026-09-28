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
import { AREA_SAUDE_INDIGENA } from "../lib/responsavel-do-edital.js";
import { escapeHtml } from "../lib/sanitize.js";
import "../styles/boas-vindas.css";

/*
  Boas-vindas no topo da Visão geral da Saúde Indígena.

  Aparece quando o perfil e os editais já chegaram. Fechar (×) esconde até o
  fim do dia: guarda-se a data em localStorage, e amanhã ela volta. Sem
  armazenamento (janela privada), fecha só nesta visita.

  A Visão geral da SEDE e a de Projetos (React, em
  `src/componentes/visao-geral-da-area/`) mostram a mesma mensagem com as
  funções exportadas daqui: fechar numa área fecha em todas, até amanhã.
*/
const CHAVE_FECHADA = "agsus_monitora_boas_vindas_fechada";

export function boasVindasFechadaHoje() {
  try {
    return localStorage.getItem(CHAVE_FECHADA) === chaveDoDia();
  } catch {
    return false;
  }
}

export function lembrarBoasVindasFechada() {
  try {
    localStorage.setItem(CHAVE_FECHADA, chaveDoDia());
  } catch {
    // Sem armazenamento: some agora e volta na próxima visita.
  }
}

/* Abre o Cronograma da área pelo item do menu, que também troca a área atual. */
export function abrirCronogramaDaArea(area = AREA_SAUDE_INDIGENA) {
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
  let fechada = boasVindasFechadaHoje();

  const desenhar = () => {
    const perfil = obterPerfil();
    const { linhas, carregado } = obterDadosDoMonitoramento();
    if (fechada || !perfil || !carregado) {
      raiz.hidden = true;
      return;
    }
    const nome = primeiroNome(perfil.nome || perfil.email?.split("@")[0]);
    const quantidade = editaisComEtapaNaSemana(
      linhasDaArea(linhas, AREA_SAUDE_INDIGENA),
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
      abrirCronogramaDaArea(AREA_SAUDE_INDIGENA);
    if (alvo.dataset.boasVindas === "fechar") {
      fechada = true;
      lembrarBoasVindasFechada();
      desenhar();
    }
  });

  desenhar();
  return assinarDadosDoMonitoramento(desenhar);
}
