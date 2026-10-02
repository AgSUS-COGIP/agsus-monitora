/*
  O MAPA DE PROJETOS NA VISÃO GERAL (legado)

  Saúde Indígena, SEDE e Projetos usam a mesma Visão geral (React,
  src/modulos/visao-geral/), com os editais da área atual. O mapa é da área:
  o da Saúde Indígena é React (src/modulos/mapa-saude-indigena/), a SEDE não
  tem, e o de Projetos é este — a marcação no `index.html`
  (`#mapaDaVisaoGeral`), que a Visão geral só mostra em Projetos:

  - `criarMapaDosMunicipios`: o Leaflet em `#mapaDosProjetos`, com o fundo,
    os contornos e as dicas/popups que não saem do mapa do módulo React
    (`leaflet.js`), o botão "Brasil" e a legenda;
  - `desenharMunicipiosDaArea`: os lugares das vagas de todos os
    projetos no mapa nacional, um ponto por lugar na cor do projeto, e a lista
    "Municípios por vagas" (mesmo formato de "Territórios por vagas"), com
    filtro por projeto e agrupamento por projeto;
  - `desenharLegendaDosMunicipios`: a legenda do mapa com a cor de cada
    projeto presente.

  Tudo montado com nós do DOM (texto por textContent), sem HTML em string.
  Lógica pura em `src/lib/visao-geral-da-area.js`; coordenadas em
  `src/lib/coordenadas-dos-municipios.js`; cores em `health-map-workspace.css`
  (séries do design system).

  CUSTO DE REDE: um pedido por área, pequeno (uma linha por lugar), guardado
  por CACHE_TTL_MS. Reabrir a página, filtrar ou trocar de área e voltar não
  repete o pedido enquanto o cache está fresco; trocar o filtro de projeto
  só redesenha. O banco ainda sem a função (PGRST202) não é erro da página: a
  lista diz que falta a atualização do banco e o resto segue normal.
*/

import { BRASIL_BOUNDS } from "../lib/brasil-bounds.js";
import { opcoesDoPopup } from "../lib/dica-dentro-do-mapa.js";
import { exigirSessao } from "../lib/sessao.js";
import {
  gruposPorProjeto,
  municipiosDaResposta,
  plural,
  pontosDosMunicipios,
  projetosDosMunicipios,
  resultadoDoMunicipio,
  resumoDoLugar,
  textoDasVagas,
} from "../lib/visao-geral-da-area.js";
import {
  adicionarFundo,
  criarMapa,
  desenharContornos,
  observarTamanho,
  podeFlutuar,
} from "../modulos/mapa-saude-indigena/leaflet.js";
import { legendaComecaAberta } from "../lib/mapa-saude-indigena/formas.js";

export const RPC_DOS_MUNICIPIOS = "listar_municipios_das_vagas_da_area";
export const CACHE_TTL_MS = 5 * 60_000;

const fmt = (valor) => Number(valor || 0).toLocaleString("pt-BR");

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

// ── Peças do DOM ─────────────────────────────────────────────────────────

/* Elemento com classe e filhos (nós ou texto). */
function el(documento, tag, classe = "", ...filhos) {
  const elemento = documento.createElement(tag);
  if (classe) elemento.className = classe;
  for (const filho of filhos) {
    if (filho === null || filho === undefined || filho === "") continue;
    elemento.append(filho);
  }
  return elemento;
}

/* A bolinha com a cor do projeto (série do design system). */
function corDoProjeto(documento, serie) {
  const cor = el(
    documento,
    "span",
    `mapa-projeto__cor mapa-projeto__cor--${serie || 0}`,
  );
  cor.setAttribute("aria-hidden", "true");
  return cor;
}

function vazio(documento, icone, titulo, texto) {
  const caixa = el(documento, "div", "health-map-empty");
  const simbolo = el(documento, "i", `fa-solid ${icone}`);
  simbolo.setAttribute("aria-hidden", "true");
  caixa.append(
    simbolo,
    el(documento, "strong", "", titulo),
    el(documento, "span", "", texto),
  );
  return caixa;
}

// ── Lista "Municípios por vagas" ─────────────────────────────────────────

/*
  Filtro e agrupamento escolhidos na lista. Ficam enquanto a página vive:
  trocar de área e voltar mantém a escolha (projeto que sumiu volta a "todos").
*/
const escolha = { projeto: "", agrupar: false };

/*
  Mesma linha de ranking de "Territórios por vagas": posição, nome, detalhes
  e vagas à direita. Os detalhes começam pelos projetos do lugar (cor e
  nome). A barra é o resultado das análises: a parte aprovada entre aprovados
  e reprovados (o resto da barra, em vermelho claro, são os reprovados); o
  percentual escrito ao lado não deixa a leitura só na cor.
*/
function linhaDoLugar(documento, ponto, indice, posicao) {
  const { candidatos, aprovados, reprovados } = ponto;
  const vagasPublicadas = textoDasVagas({
    vagas: ponto.vagasEdital,
    cadastroReserva: ponto.cadastroReserva,
  });
  const resultado = resultadoDoMunicipio(ponto);

  const projetos = el(documento, "span", "mapa-projeto__lista");
  for (const projeto of ponto.projetos) {
    projetos.append(
      el(
        documento,
        "span",
        "mapa-projeto__nome",
        corDoProjeto(documento, projeto.serie),
        projeto.nome,
      ),
    );
  }
  const meta = [
    vagasPublicadas && ponto.vagasEdital === null ? vagasPublicadas : "",
    plural(candidatos, "candidato", "candidatos"),
    aprovados || reprovados
      ? `${plural(aprovados, "aprovado", "aprovados")} · ${plural(reprovados, "reprovado", "reprovados")}`
      : "",
    ponto.coordenadas ? "" : "sem coordenada no mapa",
  ]
    .filter(Boolean)
    .join(" · ");

  const corpo = el(
    documento,
    "span",
    "health-map-unit__corpo",
    el(documento, "strong", "", ponto.rotulo),
    ponto.projetos.length ? projetos : "",
    el(documento, "small", "", meta),
  );
  if (resultado) {
    const preenchimento = el(documento, "i", "");
    preenchimento.style.width = `${resultado.pct}%`;
    const barra = el(
      documento,
      "span",
      "health-map-unit__barra",
      preenchimento,
    );
    barra.setAttribute("aria-hidden", "true");
    corpo.append(
      el(
        documento,
        "span",
        "health-map-unit__preench is-resultado",
        barra,
        el(
          documento,
          "span",
          "health-map-unit__pct",
          `${resultado.pct}% aprovados`,
        ),
      ),
    );
  }

  const tamanho = ponto.tamanho ?? ponto.vagas;
  const vagas = el(documento, "span", "health-map-unit__vagas");
  if (tamanho) {
    vagas.append(
      el(documento, "b", "", fmt(tamanho)),
      ` vaga${tamanho === 1 ? "" : "s"}`,
    );
  } else if (ponto.cadastroReserva) {
    vagas.append(el(documento, "b", "", "CR"));
    vagas.title = "Cadastro reserva";
  } else {
    vagas.append(el(documento, "b", "", "0"), " vagas");
  }

  const rank = el(documento, "span", "health-map-unit__rank", String(posicao));
  rank.setAttribute("aria-hidden", "true");

  const botao = el(
    documento,
    "button",
    `health-map-unit health-map-unit--ranking${tamanho ? "" : " is-sem-vagas"}`,
    rank,
    corpo,
    vagas,
  );
  botao.type = "button";
  botao.dataset.municipio = String(indice);
  botao.disabled = !ponto.coordenadas;
  botao.setAttribute(
    "aria-label",
    [
      ponto.rotulo,
      ponto.projetos.map((projeto) => projeto.nome).join(", "),
      vagasPublicadas ||
        (ponto.vagas ? plural(ponto.vagas, "vaga", "vagas") : ""),
      plural(candidatos, "candidato", "candidatos"),
      resultado ? `${resultado.pct}% aprovados` : "",
    ]
      .filter(Boolean)
      .join(", "),
  );
  return botao;
}

/* Projeto e "Agrupar por projeto", no alto da lista (só com dois ou mais projetos). */
function filtrosDaLista(documento, projetos, aoMudar) {
  const seletor = el(documento, "select", "mapa-projetos__seletor");
  seletor.name = "projeto-do-mapa";
  seletor.append(el(documento, "option", "", "Todos os projetos"));
  seletor.firstChild.value = "";
  for (const projeto of projetos) {
    const opcao = el(
      documento,
      "option",
      "",
      `${projeto.nome} (${projeto.lugares})`,
    );
    opcao.value = projeto.nome;
    seletor.append(opcao);
  }
  seletor.value = escolha.projeto;
  seletor.addEventListener("change", () => {
    escolha.projeto = seletor.value;
    aoMudar("projeto");
  });

  const agrupar = el(documento, "input", "");
  agrupar.type = "checkbox";
  agrupar.name = "agrupar-por-projeto";
  agrupar.checked = escolha.agrupar;
  agrupar.addEventListener("change", () => {
    escolha.agrupar = agrupar.checked;
    aoMudar("agrupar");
  });

  return el(
    documento,
    "div",
    "mapa-projetos__filtros",
    el(
      documento,
      "label",
      "mapa-projetos__campo",
      el(documento, "span", "", "Projeto"),
      seletor,
    ),
    el(
      documento,
      "label",
      "mapa-projetos__agrupar",
      agrupar,
      el(documento, "span", "", "Agrupar por projeto"),
    ),
  );
}

export function desenharListaDeMunicipios(
  lista,
  pontos,
  {
    erro = "",
    indisponivel = false,
    aoEscolher,
    projetos = [],
    aoMudarFiltro,
  } = {},
) {
  if (!lista) return;
  const documento = lista.ownerDocument;
  if (indisponivel) {
    lista.replaceChildren(
      vazio(
        documento,
        "fa-database",
        "Municípios ainda indisponíveis",
        "Depende de uma atualização do banco.",
      ),
    );
    return;
  }
  if (erro) {
    lista.replaceChildren(
      vazio(
        documento,
        "fa-triangle-exclamation",
        "Não foi possível carregar os municípios",
        "Tente de novo em Atualizar dados.",
      ),
    );
    return;
  }
  const filtros =
    projetos.length > 1 && aoMudarFiltro
      ? filtrosDaLista(documento, projetos, aoMudarFiltro)
      : null;
  if (!pontos.length) {
    lista.replaceChildren(
      ...[
        filtros,
        vazio(
          documento,
          "fa-map-location-dot",
          "Nenhum município nas vagas da área",
          "Os lugares vêm dos editais e do nome das vagas.",
        ),
      ].filter(Boolean),
    );
    return;
  }

  const indiceDe = new Map(pontos.map((ponto, indice) => [ponto, indice]));
  const filhos = filtros ? [filtros] : [];
  if (escolha.agrupar) {
    for (const grupo of gruposPorProjeto(pontos)) {
      const cabecalho = el(
        documento,
        "div",
        "mapa-projetos__grupo",
        corDoProjeto(documento, grupo.serie),
        el(documento, "strong", "", grupo.nome),
        el(
          documento,
          "span",
          "",
          plural(grupo.pontos.length, "lugar", "lugares"),
        ),
      );
      cabecalho.setAttribute("role", "heading");
      cabecalho.setAttribute("aria-level", "4");
      filhos.push(cabecalho);
      grupo.pontos.forEach((ponto, posicao) =>
        filhos.push(
          linhaDoLugar(documento, ponto, indiceDe.get(ponto), posicao + 1),
        ),
      );
    }
  } else {
    pontos.forEach((ponto, indice) =>
      filhos.push(linhaDoLugar(documento, ponto, indice, indice + 1)),
    );
  }
  lista.replaceChildren(...filhos);
  lista.querySelectorAll("[data-municipio]").forEach((botao) => {
    botao.addEventListener("click", () =>
      aoEscolher?.(pontos[Number(botao.dataset.municipio)]),
    );
  });
}

// ── Mapa ─────────────────────────────────────────────────────────────────

/* O conteúdo do popup (e da dica) do lugar: título, editais e contagens. */
function resumoNoDom(documento, ponto) {
  const resumo = resumoDoLugar(ponto);
  const caixa = el(
    documento,
    "div",
    "mapa-projetos__popup",
    el(documento, "strong", "mapa-projetos__popup-titulo", resumo.titulo),
  );
  for (const edital of resumo.editais) {
    caixa.append(
      el(
        documento,
        "div",
        "mapa-projetos__popup-edital",
        corDoProjeto(documento, edital.serie),
        el(documento, "b", "", edital.projeto),
        edital.texto ? ` · ${edital.texto}` : "",
      ),
    );
  }
  for (const linha of resumo.linhas)
    caixa.append(el(documento, "div", "", linha));
  return caixa;
}

/*
  A legenda do mapa nacional em Projetos (corpo da caixa recolhível): a cor
  de cada projeto do último desenho, o que o tamanho quer dizer e o contorno
  dos lugares com mais de um projeto.
*/
let projetosDaLegenda = [];

export function desenharLegendaDosMunicipios(corpo) {
  if (!corpo) return;
  const documento = corpo.ownerDocument;
  const itens = projetosDaLegenda.map((projeto) =>
    el(
      documento,
      "div",
      "mapa-projetos__legenda-item",
      corDoProjeto(documento, projeto.serie),
      projeto.nome,
    ),
  );
  const tamanho = el(
    documento,
    "div",
    "mapa-projetos__legenda-item",
    "tamanho = nº de vagas",
  );
  const varios = el(
    documento,
    "div",
    "mapa-projetos__legenda-item",
    el(documento, "span", "mapa-projeto__cor mapa-projeto__cor--varios"),
    "mais de um projeto",
  );
  varios.firstChild.setAttribute("aria-hidden", "true");
  corpo.replaceChildren(...itens, tamanho, varios);
}

/*
  Desenha os lugares da área em `camada` (a dos DSEIs, já limpa pelo legado),
  a lista ao lado e as contagens. Assíncrona só na primeira vez de cada área
  (depois, cache). `aindaVale()` diz se a página ainda quer este desenho — a
  área ou o mapa podem ter mudado enquanto a resposta vinha. Trocar o filtro
  de projeto na lista redesenha com os mesmos dados e reenquadra.
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
  flutua = podeFlutuar,
  aoDesenhar = () => {},
}) {
  if (!L || !mapa || !camada || !carregador) return;
  if (!carregador.emCache(area)) {
    if (conta) {
      conta.textContent = "…";
      conta.setAttribute("aria-label", "Carregando");
    }
    lista?.replaceChildren(
      vazio(
        lista.ownerDocument,
        "fa-map-location-dot",
        "Carregando os municípios",
        "Dos editais e das vagas da área.",
      ),
    );
  }
  const { municipios, indisponivel, erro } = await carregador.carregar(area);
  if (!aindaVale()) return;

  const projetos = projetosDosMunicipios(municipios);
  if (!projetos.some((projeto) => projeto.nome === escolha.projeto))
    escolha.projeto = "";
  projetosDaLegenda = projetos;

  const pintar = (reenquadrar) => {
    const pontos = pontosDosMunicipios(municipios, {
      projeto: escolha.projeto,
    });
    const noMapa = pontos.filter((ponto) => ponto.coordenadas);
    const marcadores = new Map();
    camada.clearLayers();
    for (const ponto of noMapa) {
      const marcador = L.circleMarker(ponto.coordenadas, {
        radius: ponto.raio,
        weight: 2,
        fillOpacity: 0.78,
        className: `marcador-de-projeto marcador-de-projeto--${ponto.serie}${ponto.variosProjetos ? " is-varios-projetos" : ""}`,
      });
      const documento = lista?.ownerDocument ?? document;
      if (flutua())
        marcador.bindTooltip(resumoNoDom(documento, ponto), {
          direction: "top",
        });
      marcador.bindPopup(resumoNoDom(documento, ponto), opcoesDoPopup());
      camada.addLayer(marcador);
      marcadores.set(ponto.chave ?? ponto.municipioUf, marcador);
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
      projetos,
      aoMudarFiltro: (oQue) => {
        if (!aindaVale()) return;
        pintar(oQue === "projeto");
        const campo =
          oQue === "projeto"
            ? lista?.querySelector(".mapa-projetos__seletor")
            : lista?.querySelector(".mapa-projetos__agrupar input");
        campo?.focus();
      },
      aoEscolher: (ponto) => {
        const marcador = marcadores.get(ponto?.chave ?? ponto?.municipioUf);
        if (!marcador) return;
        mapa.setView(ponto.coordenadas, Math.max(mapa.getZoom(), 7), {
          animate: true,
        });
        marcador.openPopup();
      },
    });

    if (!reenquadrar) return;
    try {
      if (noMapa.length) {
        mapa.fitBounds(
          L.latLngBounds(noMapa.map((ponto) => ponto.coordenadas)),
          {
            padding: [60, 60],
            maxZoom: 7,
            animate: false,
          },
        );
      } else if (limitesDoBrasil) {
        mapa.fitBounds(limitesDoBrasil, { animate: false });
      }
    } catch {
      // Mapa ainda sem tamanho (página escondida): o próximo desenho enquadra.
    }
  };

  pintar(enquadrar);
  aoDesenhar();
}

/*
  O Leaflet do mapa de Projetos, criado uma vez (na primeira abertura da
  Visão geral em Projetos). É o mapa do módulo React (`criarMapa`: dicas e
  popups que não saem do mapa, zoom em quartos), com o fundo com recurso e os
  contornos; os limites, o zoom e o Mapa/Satélite são do `map-guard.js` e do
  `map-base-layer-switcher.js`. O bloco fica escondido fora de Projetos e o mapa continua
  montado: ao reaparecer com tamanho, `aoAparecer` redesenha e reenquadra (o
  enquadramento feito escondido usa a medida zero).

  `legenda` é o `<details>` da legenda (aberto no computador, fechado no
  celular); `botaoBrasil`, o "Brasil" do cabeçalho.
*/
export function criarMapaDosMunicipios({
  L,
  elemento,
  legenda = null,
  botaoBrasil = null,
  largura = globalThis.innerWidth,
  aoAparecer = () => {},
}) {
  if (!L || !elemento) return null;
  const mapa = criarMapa(L, elemento);
  const limitesDoBrasil = L.latLngBounds(BRASIL_BOUNDS[0], BRASIL_BOUNDS[1]);
  mapa.fitBounds(limitesDoBrasil);
  adicionarFundo(L, mapa, elemento);
  desenharContornos(L, L.layerGroup().addTo(mapa), "nacional");
  const camada = L.layerGroup().addTo(mapa);
  observarTamanho(mapa, elemento, { aoAparecer });

  if (legenda) legenda.open = legendaComecaAberta(largura);
  botaoBrasil?.addEventListener("click", () => {
    try {
      mapa.stop?.();
      mapa.fitBounds(limitesDoBrasil, { animate: false });
    } catch {
      // mapa sem tamanho
    }
  });
  return {
    mapa,
    camada,
    limitesDoBrasil,
    corpoDaLegenda: legenda?.querySelector("[data-legenda-dos-municipios]"),
  };
}
