/*
  A VISÃO GERAL DE CADA ÁREA — O QUE MUDA NA PÁGINA DA SAÚDE INDÍGENA

  Saúde Indígena, SEDE e Projetos usam a mesma Visão geral (`#page-dashboard`,
  `legacy-app.js`), com os editais da área atual. Este módulo faz o que é de
  cada área, sem que o legado cresça:

  - `aplicarAreaNaVisaoGeral`: marca a página com o mapa da área
    (`data-mapa-da-area`: `dsei`, `municipios` ou `nenhum`) e troca os textos
    do bloco "Visão nacional". O CSS (`health-map-workspace.css`) esconde o
    bloco na SEDE e, em Projetos, o que é só da Saúde Indígena (painel do
    DSEI, "Calor", "Terras Indígenas");
  - `desenharMunicipiosDaArea`: em Projetos, os pontos dos municípios das
    vagas no mapa nacional e a lista "Municípios por vagas", no mesmo formato
    de "Territórios por vagas".

  Lógica pura em `src/lib/visao-geral-da-area.js`; coordenadas em
  `src/lib/coordenadas-dos-municipios.js`.

  CUSTO DE REDE: um pedido por área, pequeno (uma linha por município),
  guardado por CACHE_TTL_MS. Reabrir a página, filtrar ou trocar de área e
  voltar não repete o pedido enquanto o cache está fresco. O banco ainda sem a
  função (PGRST202) não é erro da página: a lista diz que falta a atualização
  do banco e o resto segue normal.
*/

import { escapeHtml } from "../lib/sanitize.js";
import { exigirSessao } from "../lib/sessao.js";
import {
  MAPA_DOS_DSEIS,
  mapaDaVisaoGeral,
  municipiosDaResposta,
  plural,
  pontosDosMunicipios,
  resultadoDoMunicipio,
  textosDoMapa,
} from "../lib/visao-geral-da-area.js";

export const RPC_DOS_MUNICIPIOS = "listar_municipios_das_vagas_da_area";
export const CACHE_TTL_MS = 5 * 60_000;

const fmt = (valor) => Number(valor || 0).toLocaleString("pt-BR");

// ── Textos e marcação da página ──────────────────────────────────────────

/* Troca o texto que vem depois do ícone (`<i>`) sem recriar o ícone. */
function trocarTextoDepoisDoIcone(elemento, novo) {
  if (!elemento) return;
  if (elemento.textContent.replace(/\s+/g, " ").trim() === novo) return;
  for (const no of [...elemento.childNodes]) {
    if (no.nodeType === 3) no.remove();
  }
  elemento.append(elemento.ownerDocument.createTextNode(` ${novo}`));
}

function trocarTexto(elemento, novo) {
  if (elemento && elemento.textContent !== novo) elemento.textContent = novo;
}

/*
  Marca a página com o mapa da área e põe os textos do bloco do mapa. Na
  Saúde Indígena os textos são os do `index.html` (nada muda); ao voltar de
  outra área, eles voltam.
*/
export function aplicarAreaNaVisaoGeral(pagina, area) {
  if (!pagina) return "";
  const mapa = mapaDaVisaoGeral(area);
  pagina.dataset.mapaDaArea = mapa || "nenhum";
  const textos = textosDoMapa(mapa || MAPA_DOS_DSEIS);
  const mestre = pagina.querySelector(".health-map-pane--master");
  pagina
    .querySelector(".health-map-workspace")
    ?.setAttribute("aria-label", textos.area);
  trocarTexto(
    mestre?.querySelector(".health-map-pane__header h3"),
    textos.titulo,
  );
  pagina.querySelector("#map")?.setAttribute("aria-label", textos.mapa);
  const painel = pagina.querySelector(".health-map-brasil-painel");
  painel?.setAttribute("aria-label", textos.lista);
  trocarTextoDepoisDoIcone(
    painel?.querySelector(".health-map-units__header > span"),
    textos.lista,
  );
  trocarTextoDepoisDoIcone(
    mestre?.querySelector(".health-map-pane__hint"),
    textos.dica,
  );
  return mapa;
}

// ── Carga dos municípios ─────────────────────────────────────────────────

/*
  Resultado: `{ municipios, indisponivel, erro }`. Um pedido por área de cada
  vez; o resultado fica guardado por CACHE_TTL_MS (erro não fica).
*/
export function criarCarregadorDeMunicipios({
  obterSupabase = () => null,
  relogio = () => Date.now(),
} = {}) {
  const guardados = new Map();
  const emVoo = new Map();

  const emCache = (area) => {
    const guardado = guardados.get(area);
    return guardado && relogio() - guardado.em < CACHE_TTL_MS
      ? guardado.resultado
      : null;
  };

  async function buscar(area) {
    const supabase = obterSupabase();
    if (!supabase)
      return { municipios: [], indisponivel: false, erro: "Sem conexão." };
    try {
      await exigirSessao(supabase);
      const { data, error } = await supabase.rpc(RPC_DOS_MUNICIPIOS, {
        p_area: area,
      });
      if (error?.code === "PGRST202")
        return { municipios: [], indisponivel: true, erro: "" };
      if (error) throw error;
      const resultado = {
        municipios: municipiosDaResposta(data),
        indisponivel: false,
        erro: "",
      };
      guardados.set(area, { em: relogio(), resultado });
      return resultado;
    } catch (erro) {
      return {
        municipios: [],
        indisponivel: false,
        erro: erro?.message || "Não foi possível carregar os municípios.",
      };
    }
  }

  return {
    emCache,
    carregar(area) {
      const guardado = emCache(area);
      if (guardado) return Promise.resolve(guardado);
      if (!emVoo.has(area)) {
        emVoo.set(
          area,
          buscar(area).finally(() => emVoo.delete(area)),
        );
      }
      return emVoo.get(area);
    },
  };
}

// ── Lista "Municípios por vagas" ─────────────────────────────────────────

function vazio(icone, titulo, texto) {
  return `<div class="health-map-empty"><i class="fa-solid ${icone}"></i><strong>${escapeHtml(titulo)}</strong><span>${escapeHtml(texto)}</span></div>`;
}

/*
  Mesma linha de ranking de "Territórios por vagas": posição, nome, detalhes
  e vagas à direita. A barra é o resultado das análises: a parte aprovada
  entre aprovados e reprovados (o resto da barra, em vermelho claro, são os
  reprovados); o percentual escrito ao lado não deixa a leitura só na cor.
*/
function linhaDoMunicipio(ponto, indice) {
  const { municipioUf, vagas, candidatos, aprovados, reprovados } = ponto;
  const meta = [
    plural(candidatos, "candidato", "candidatos"),
    plural(aprovados, "aprovado", "aprovados"),
    plural(reprovados, "reprovado", "reprovados"),
    ponto.coordenadas ? "" : "sem coordenada no mapa",
  ]
    .filter(Boolean)
    .join(" · ");
  const resultado = resultadoDoMunicipio(ponto);
  const barra = resultado
    ? `<span class="health-map-unit__preench is-resultado"><span class="health-map-unit__barra" aria-hidden="true"><i style="width:${resultado.pct}%"></i></span><span class="health-map-unit__pct">${resultado.pct}% aprovados</span></span>`
    : "";
  const rotulo = `${municipioUf}: ${plural(vagas, "vaga", "vagas")}, ${plural(candidatos, "candidato", "candidatos")}${resultado ? `, ${resultado.pct}% aprovados` : ""}`;
  return `<button class="health-map-unit health-map-unit--ranking${vagas ? "" : " is-sem-vagas"}" type="button" data-municipio="${indice}" aria-label="${escapeHtml(rotulo)}"${ponto.coordenadas ? "" : " disabled"}>
        <span class="health-map-unit__rank" aria-hidden="true">${indice + 1}</span>
        <span class="health-map-unit__corpo">
          <strong>${escapeHtml(municipioUf)}</strong>
          <small>${escapeHtml(meta)}</small>
          ${barra}
        </span>
        <span class="health-map-unit__vagas"><b>${fmt(vagas)}</b> vaga${vagas === 1 ? "" : "s"}</span>
      </button>`;
}

export function desenharListaDeMunicipios(
  lista,
  pontos,
  { erro = "", indisponivel = false, aoEscolher } = {},
) {
  if (!lista) return;
  if (indisponivel) {
    lista.innerHTML = vazio(
      "fa-database",
      "Municípios ainda indisponíveis",
      "Depende de uma atualização do banco.",
    );
    return;
  }
  if (erro) {
    lista.innerHTML = vazio(
      "fa-triangle-exclamation",
      "Não foi possível carregar os municípios",
      "Tente de novo em Atualizar dados.",
    );
    return;
  }
  if (!pontos.length) {
    lista.innerHTML = vazio(
      "fa-map-location-dot",
      "Nenhum município nas vagas da área",
      "Os municípios vêm do nome das vagas nas análises curriculares.",
    );
    return;
  }
  lista.innerHTML = pontos.map(linhaDoMunicipio).join("");
  lista.querySelectorAll("[data-municipio]").forEach((botao) => {
    botao.addEventListener("click", () =>
      aoEscolher?.(pontos[Number(botao.dataset.municipio)]),
    );
  });
}

// ── Mapa ─────────────────────────────────────────────────────────────────

function resumoDoMunicipio(ponto) {
  const resultado = resultadoDoMunicipio(ponto);
  return [
    `<b>${escapeHtml(ponto.municipioUf)}</b>`,
    `Vagas: ${fmt(ponto.vagas)}`,
    `Candidatos: ${fmt(ponto.candidatos)}`,
    `Aprovados: ${fmt(ponto.aprovados)} · Reprovados: ${fmt(ponto.reprovados)}`,
    resultado ? `${resultado.pct}% aprovados entre os analisados` : "",
  ]
    .filter(Boolean)
    .join("<br>");
}

/* A legenda do mapa nacional em Projetos (corpo da caixa recolhível). */
export function legendaDosMunicipios() {
  const ponto =
    '<span style="width:12px;height:12px;border-radius:50%;background:#0b8f58;border:1.5px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.15);display:inline-block;vertical-align:middle;margin-right:6px;"></span>';
  return `${ponto}município das vagas (tamanho = nº de vagas)`;
}

/*
  Desenha os municípios da área em `camada` (a dos DSEIs, já limpa pelo
  legado), a lista ao lado e as contagens. Assíncrona só na primeira vez de
  cada área (depois, cache). `aindaVale()` diz se a página ainda quer este
  desenho — a área ou o mapa podem ter mudado enquanto a resposta vinha.
*/
export async function desenharMunicipiosDaArea({
  L,
  mapa,
  camada,
  area,
  carregador,
  lista,
  conta,
  contador,
  enquadrar = true,
  limitesDoBrasil = null,
  aindaVale = () => true,
  podeFlutuar = () => true,
}) {
  if (!L || !mapa || !camada || !carregador) return;
  if (!carregador.emCache(area)) {
    if (conta) {
      conta.textContent = "…";
      conta.setAttribute("aria-label", "Carregando");
    }
    if (lista)
      lista.innerHTML = vazio(
        "fa-map-location-dot",
        "Carregando os municípios",
        "Das vagas nas análises curriculares.",
      );
  }
  const { municipios, indisponivel, erro } = await carregador.carregar(area);
  if (!aindaVale()) return;

  const pontos = pontosDosMunicipios(municipios);
  const noMapa = pontos.filter((ponto) => ponto.coordenadas);
  const marcadores = new Map();
  camada.clearLayers();
  for (const ponto of noMapa) {
    const marcador = L.circleMarker(ponto.coordenadas, {
      radius: ponto.raio,
      color: "#f2b705",
      weight: 3,
      fillColor: "#0b8f58",
      fillOpacity: 0.7,
    });
    if (podeFlutuar())
      marcador.bindTooltip(resumoDoMunicipio(ponto), { direction: "top" });
    marcador.bindPopup(resumoDoMunicipio(ponto));
    camada.addLayer(marcador);
    marcadores.set(ponto.municipioUf, marcador);
  }

  if (conta) {
    conta.textContent = fmt(pontos.length);
    conta.removeAttribute("aria-label");
  }
  if (contador)
    contador.textContent = plural(pontos.length, "município", "municípios");

  desenharListaDeMunicipios(lista, pontos, {
    erro,
    indisponivel,
    aoEscolher: (ponto) => {
      const marcador = marcadores.get(ponto?.municipioUf);
      if (!marcador) return;
      mapa.setView(ponto.coordenadas, Math.max(mapa.getZoom(), 7), {
        animate: true,
      });
      marcador.openPopup();
    },
  });

  if (!enquadrar) return;
  try {
    if (noMapa.length) {
      mapa.fitBounds(L.latLngBounds(noMapa.map((ponto) => ponto.coordenadas)), {
        padding: [60, 60],
        maxZoom: 7,
        animate: false,
      });
    } else if (limitesDoBrasil) {
      mapa.fitBounds(limitesDoBrasil, { animate: false });
    }
  } catch {
    // Mapa ainda sem tamanho (página escondida): o próximo desenho enquadra.
  }
}
