import {
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Icone } from "../icone.jsx";
import {
  AREA_DAS_CONFIGURACOES,
  areaAberta,
  destinoAoTrocarDeArea,
  FLUTUANTE_FECHADO,
  ICONE_DO_SELETOR_DE_AREA,
  itemAtivoDaArvore,
  navegacaoTransborda,
  posicaoDoPainelFlutuante,
  proximoFlutuante,
  recortarArvorePorArea,
} from "../../lib/menu-lateral.js";
import {
  avisar,
  EVENTO_MENU_ATUALIZADO,
} from "../../lib/eventos-da-barra-lateral.js";
import {
  assinarDadosDoMonitoramento,
  definirAreaAtual,
  obterDadosDoMonitoramento,
} from "../dados-do-monitoramento.js";
import { marcarItemAtivoNoMenu } from "./estado.js";

/*
  O menu em áreas. O catálogo, a árvore e o estado do painel flutuante são
  lógica pura, em `src/lib/menu-lateral.js`; aqui fica o desenho.

  - Com mais de uma área, o topo é o SELETOR DE ÁREA ("Área: Projetos", com a
    bolinha da cor da área) e, abaixo dele, só as páginas da área atual — no
    lugar das três áreas abertas uma sob a outra. Trocar de área chama
    `definirAreaAtual` e abre a mesma página na área nova, ou a primeira dela
    (`destinoAoTrocarDeArea`). Com uma área só, não há seletor: a área aparece
    como acordeão, como antes.
  - Expandida (e na gaveta do celular): Painéis e Administração são acordeões,
    e todos nascem abertos. O que se guarda é a lista dos que a pessoa fechou.
    Só a seta gira; a altura não anima (Design System AgSUS, 7.1).
  - Recolhida (acima de 900px): cada grupo é um ícone, e o painel dele vira um
    flutuante `position: fixed` ao lado do trilho, com a pílula do nome em
    cima. O seletor de área também: o ícone de trocar, com a bolinha da área,
    abre a lista das áreas. O estado (qual está aberto, e por quê) é o de
    `proximoFlutuante`: um por vez, `Esc` fecha, um clique não prende o painel.

  O DOM continua sendo contrato: `#nav`, `[data-view]`, `[data-secao]`,
  `[data-area]`, `data-rotulo`, `data-icone` e `aria-current` são lidos pelo
  menu inferior do celular, pelos ganchos do mapa (`[data-view="dashboard"]`)
  e pelos testes de ponta a ponta. As opções do seletor não têm `data-view`:
  não são páginas.
*/

const CHAVE_AREAS_FECHADAS = "agsus_monitora_menu_areas_fechadas_v1";
const ESPERA_AO_SAIR = 150;
const ID_DO_SELETOR = "seletor-de-area";

function lerAreasFechadas() {
  try {
    const salvo = JSON.parse(
      window.localStorage.getItem(CHAVE_AREAS_FECHADAS) || "[]",
    );
    return new Set(Array.isArray(salvo) ? salvo.map(String) : []);
  } catch {
    return new Set();
  }
}

function gravarAreasFechadas(fechadas) {
  try {
    window.localStorage.setItem(
      CHAVE_AREAS_FECHADAS,
      JSON.stringify([...fechadas]),
    );
  } catch {
    // Sem armazenamento (janela privada, bloqueio): o menu só não lembra.
  }
}

const temHover = () => window.matchMedia?.("(hover: hover)").matches ?? true;
const classes = (...lista) => lista.filter(Boolean).join(" ");

/*
  Os itens chamam `window.navigate` na hora do clique, como fazia o `onclick`
  inline: `config-governance.js` (alterações não salvas) e `nielsen-shell-ux.js`
  embrulham essa função, e o embrulho só vale para quem a procura na janela.
*/
const navegarPelaJanela = (view) => window.navigate?.(view);
const paginaAtivaPadrao = (view) =>
  Boolean(
    document.getElementById(`page-${view}`)?.classList.contains("active"),
  );

/* Recolhida, a navegação só rola quando transborda (ver `platform-shell.css`). */
function usarTransbordo(refNavegacao, refNav) {
  const [transborda, definirTransborda] = useState(false);
  useLayoutEffect(() => {
    const navegacao = refNavegacao.current;
    if (!navegacao) return undefined;
    const medir = () =>
      definirTransborda(
        navegacaoTransborda(navegacao.scrollHeight, navegacao.clientHeight),
      );
    medir();
    if (typeof ResizeObserver !== "function") return undefined;
    const observador = new ResizeObserver(medir);
    observador.observe(navegacao);
    if (refNav.current) observador.observe(refNav.current);
    return () => observador.disconnect();
  }, [refNavegacao, refNav]);
  return transborda;
}

/*
  O comportamento de gatilho do painel flutuante no trilho, comum às áreas e
  ao seletor: posição alinhada ao ícone, ponteiro, foco e `Esc`.
*/
function usarGatilhoFlutuante({ id, trilho, flutuante, despachar, espera }) {
  const refSecao = useRef(null);
  const refCabecalho = useRef(null);
  const refPainel = useRef(null);

  // Aberto no trilho: o painel se alinha ao ícone e fica dentro da janela.
  useLayoutEffect(() => {
    if (!flutuante || !refCabecalho.current) return;
    const caixa = refCabecalho.current.getBoundingClientRect();
    const topo = posicaoDoPainelFlutuante({
      topoDoGatilho: caixa.top,
      alturaDoGatilho: caixa.height,
      alturaDoPainel: refPainel.current.offsetHeight,
      alturaDaJanela: window.innerHeight,
    });
    refSecao.current.style.setProperty("--menu-flutuante-topo", `${topo}px`);
  }, [flutuante]);

  const eventos = {
    onPointerEnter(evento) {
      if (!trilho || evento.pointerType === "touch" || !temHover()) return;
      window.clearTimeout(espera.current);
      despachar({ tipo: "apontar", area: id });
    },
    /* Sair com o ponteiro espera um instante: o caminho em diagonal até o painel raspa fora da área. */
    onPointerLeave(evento) {
      if (evento.pointerType === "touch") return;
      window.clearTimeout(espera.current);
      espera.current = window.setTimeout(
        () => despachar({ tipo: "desapontar", area: id }),
        ESPERA_AO_SAIR,
      );
    },
    onFocus() {
      if (trilho) despachar({ tipo: "focar", area: id });
    },
    onBlur(evento) {
      if (refSecao.current?.contains(evento.relatedTarget)) return;
      despachar({ tipo: "desfocar", area: id });
    },
  };

  const dispensarPorEsc = (evento) => {
    if (evento.key !== "Escape" || !trilho || !flutuante) return false;
    evento.preventDefault();
    despachar({ tipo: "dispensar", area: id });
    refCabecalho.current?.focus({ preventScroll: true });
    return true;
  };

  return { refSecao, refCabecalho, refPainel, eventos, dispensarPorEsc };
}

function ItemDoMenu({ item, ativo, aoEscolher }) {
  return (
    <li>
      <button
        type="button"
        className={classes("menu-item", ativo && "active")}
        data-view={item.view}
        data-secao={item.secao}
        data-area={item.area}
        data-rotulo={item.rotulo}
        data-icone={item.icone}
        aria-current={ativo ? "page" : undefined}
        onClick={aoEscolher}
      >
        <span className="menu-item__rotulo">{item.rotulo}</span>
      </button>
    </li>
  );
}

function Area({
  area,
  aberta,
  atual,
  semCabecalho = false,
  itemAtivo,
  trilho,
  flutuante,
  despachar,
  espera,
  aoAlternar,
  aoEscolher,
}) {
  const { refSecao, refCabecalho, refPainel, eventos, dispensarPorEsc } =
    usarGatilhoFlutuante({
      id: area.id,
      trilho,
      flutuante,
      despachar,
      espera,
    });
  const idDoPainel = `menuArea-${area.id}`;

  const aoClicarNoCabecalho = () => {
    if (trilho) despachar({ tipo: "alternar", area: area.id });
    else aoAlternar(area.id);
  };

  return (
    <section
      ref={refSecao}
      className={classes(
        "menu-area",
        (aberta || semCabecalho) && "menu-area--aberta",
        atual && "menu-area--atual",
        flutuante && "menu-area--flutuante",
        semCabecalho && "menu-area--sem-cabecalho",
        area.id === AREA_DAS_CONFIGURACOES && "menu-area--administracao",
      )}
      data-area={area.id}
      {...eventos}
      onKeyDown={dispensarPorEsc}
    >
      {semCabecalho ? null : (
        <button
          ref={refCabecalho}
          type="button"
          className="menu-area__cabecalho"
          onClick={aoClicarNoCabecalho}
          aria-expanded={trilho ? flutuante : aberta}
          aria-controls={idDoPainel}
        >
          <Icone nome={area.icone} className="menu-area__icone" />
          <span className="menu-area__rotulo">{area.rotulo}</span>
          <Icone nome="chevron-down" tamanho={16} className="menu-area__seta" />
        </button>
      )}
      <div ref={refPainel} className="menu-area__painel" id={idDoPainel}>
        <p className="menu-area__pilula" aria-hidden="true">
          {area.rotulo}
        </p>
        <ul className="menu-area__itens" aria-label={area.rotulo}>
          {area.itens.map((item) => (
            <ItemDoMenu
              key={`${item.view}|${item.secao ?? ""}`}
              item={item}
              ativo={item === itemAtivo}
              aoEscolher={() => aoEscolher(item, area.id, refCabecalho)}
            />
          ))}
        </ul>
      </div>
    </section>
  );
}

/*
  "Área: Projetos ▾". Expandida, abre a lista das áreas logo abaixo (como um
  acordeão, sem sobrepor o menu); no trilho, é um ícone com a bolinha da área,
  e a lista vira o painel flutuante.
*/
function SeletorDeArea({
  areas,
  atual,
  trilho,
  flutuante,
  despachar,
  espera,
  aoTrocar,
}) {
  const [aberto, definirAberto] = useState(false);
  const { refSecao, refCabecalho, refPainel, eventos, dispensarPorEsc } =
    usarGatilhoFlutuante({
      id: ID_DO_SELETOR,
      trilho,
      flutuante,
      despachar,
      espera,
    });
  const idDoPainel = "menuSeletorDeArea";

  useEffect(() => {
    if (trilho) definirAberto(false);
  }, [trilho]);

  const aoClicar = () => {
    if (trilho) despachar({ tipo: "alternar", area: ID_DO_SELETOR });
    else definirAberto((valor) => !valor);
  };

  const aoTeclar = (evento) => {
    if (dispensarPorEsc(evento)) return;
    if (evento.key === "Escape" && aberto) {
      evento.preventDefault();
      definirAberto(false);
      refCabecalho.current?.focus({ preventScroll: true });
    }
  };

  const escolher = (id) => {
    definirAberto(false);
    if (trilho) {
      despachar({ tipo: "dispensar", area: ID_DO_SELETOR });
      refCabecalho.current?.focus({ preventScroll: true });
    }
    aoTrocar(id);
  };

  return (
    <section
      ref={refSecao}
      className={classes(
        "menu-area",
        "menu-seletor",
        aberto && "menu-area--aberta",
        flutuante && "menu-area--flutuante",
      )}
      data-seletor-de-area={atual.id}
      {...eventos}
      onKeyDown={aoTeclar}
    >
      <button
        ref={refCabecalho}
        type="button"
        className="menu-area__cabecalho menu-seletor__botao"
        onClick={aoClicar}
        aria-expanded={trilho ? flutuante : aberto}
        aria-controls={idDoPainel}
        aria-label={`Área atual: ${atual.rotulo}. Trocar de área`}
      >
        <span className="menu-seletor__marca" aria-hidden="true">
          <Icone
            nome={ICONE_DO_SELETOR_DE_AREA}
            className="menu-area__icone menu-seletor__icone"
          />
          <span className="menu-seletor__ponto" data-cor-da-area={atual.id} />
        </span>
        <span className="menu-area__rotulo menu-seletor__rotulo">
          <small>Área</small>
          <strong>{atual.rotulo}</strong>
        </span>
        <Icone nome="chevron-down" tamanho={16} className="menu-area__seta" />
      </button>
      <div ref={refPainel} className="menu-area__painel" id={idDoPainel}>
        <p className="menu-area__pilula" aria-hidden="true">
          Trocar de área
        </p>
        <ul className="menu-area__itens" aria-label="Trocar de área">
          {areas.map((area) => {
            const ehAtual = area.id === atual.id;
            return (
              <li key={area.id}>
                <button
                  type="button"
                  className={classes(
                    "menu-item",
                    "menu-seletor__opcao",
                    ehAtual && "active",
                  )}
                  data-opcao-de-area={area.id}
                  aria-pressed={ehAtual}
                  onClick={() => escolher(area.id)}
                >
                  <span
                    className="menu-seletor__ponto"
                    data-cor-da-area={area.id}
                    aria-hidden="true"
                  />
                  <span className="menu-item__rotulo">{area.rotulo}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

export function Navegacao({ arvore, ativo, opcoes, trilho }) {
  const refNavegacao = useRef(null);
  const refNav = useRef(null);
  const espera = useRef(0);
  const transborda = usarTransbordo(refNavegacao, refNav);
  const [fechadas, definirFechadas] = useState(lerAreasFechadas);
  const [flutuante, despachar] = useReducer(
    proximoFlutuante,
    FLUTUANTE_FECHADO,
  );

  const areaAtual = useSyncExternalStore(
    assinarDadosDoMonitoramento,
    () => obterDadosDoMonitoramento().areaAtual,
  );
  const recorte = recortarArvorePorArea(arvore, areaAtual);
  const itemAtivo = itemAtivoDaArvore(
    arvore,
    ativo.view,
    ativo.secao,
    areaAtual,
  );
  const areaAtiva = itemAtivo?.area ?? null;

  const guardarFechadas = (proximas) => {
    gravarAreasFechadas(proximas);
    definirFechadas(proximas);
  };

  /*
    Abrir uma página abre a área dela, mesmo que a pessoa a tenha fechado.
    Depende só da página, não de `fechadas`: fechar a área da página aberta
    continua valendo até a próxima troca de página.
  */
  useEffect(() => {
    if (!areaAtiva || !fechadas.has(areaAtiva)) return;
    const proximas = new Set(fechadas);
    proximas.delete(areaAtiva);
    guardarFechadas(proximas);
  }, [areaAtiva, ativo.view, ativo.secao]);

  /*
    Depois de o DOM refletir o menu e a página ativa, avisa quem o espelha. A
    área atual entra: o menu do celular mostra as páginas dela.
  */
  const secaoAtiva = itemAtivo?.item.secao ?? null;
  useEffect(() => {
    avisar(EVENTO_MENU_ATUALIZADO, {
      view: ativo.view,
      secao: secaoAtiva,
      area: areaAtual,
    });
  }, [arvore, ativo, secaoAtiva, areaAtual]);

  useEffect(() => {
    if (!trilho) despachar({ tipo: "fechar" });
  }, [trilho]);

  // Com um painel aberto, clique fora, rolagem da navegação e resize fecham.
  useEffect(() => {
    if (!flutuante.aberta) return undefined;
    const fechar = () => despachar({ tipo: "fechar" });
    const aoApertar = (evento) => {
      if (!refNav.current?.contains(evento.target)) fechar();
    };
    const navegacao = refNavegacao.current;
    document.addEventListener("pointerdown", aoApertar, true);
    navegacao?.addEventListener("scroll", fechar, { passive: true });
    window.addEventListener("resize", fechar, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", aoApertar, true);
      navegacao?.removeEventListener("scroll", fechar);
      window.removeEventListener("resize", fechar);
    };
  }, [flutuante.aberta]);

  useEffect(() => () => window.clearTimeout(espera.current), []);

  const alternarArea = (id) => {
    const proximas = new Set(fechadas);
    if (proximas.has(id)) proximas.delete(id);
    else proximas.add(id);
    guardarFechadas(proximas);
  };

  const escolher = (item, area, refCabecalho) => {
    const navegar = opcoes.navegar ?? navegarPelaJanela;
    const paginaAtiva = opcoes.paginaAtiva ?? paginaAtivaPadrao;
    // A área vem antes da navegação: a página abre já recortada por ela.
    if (item.area) definirAreaAtual(item.area);

    if (item.secao) {
      /*
        Trocar de seção dentro de Configurações não recarrega a página: só
        navega quando ela ainda não está aberta. Se a navegação foi barrada
        (uma confirmação recusada), a seção não abre.
      */
      if (!paginaAtiva(item.view)) navegar(item.view);
      if (paginaAtiva(item.view)) {
        opcoes.aoAbrirSecao?.(item.view, item.secao);
        marcarItemAtivoNoMenu(item.view, item.secao);
      }
    } else {
      navegar(item.view);
    }

    if (!trilho) return;
    despachar({ tipo: "dispensar", area });
    // O item some com o painel; o foco volta para o ícone, que continua à vista.
    refCabecalho?.current?.focus({ preventScroll: true });
  };

  /*
    Trocar de área: a área vem antes da navegação (a página abre recortada),
    e a página é a mesma, se a área nova a tem, ou a primeira dela.
  */
  const trocarDeArea = (id) => {
    const destino = destinoAoTrocarDeArea(arvore, id, ativo.view);
    definirAreaAtual(id);
    if (destino) (opcoes.navegar ?? navegarPelaJanela)(destino.view);
  };

  const desenharArea = (area, extras = {}) => (
    <Area
      key={area.id}
      area={area}
      aberta={areaAberta(fechadas, area.id)}
      atual={area.id === areaAtiva}
      itemAtivo={itemAtivo?.item ?? null}
      trilho={trilho}
      flutuante={flutuante.aberta === area.id}
      despachar={despachar}
      espera={espera}
      aoAlternar={alternarArea}
      aoEscolher={escolher}
      {...extras}
    />
  );

  const conteudo = () => {
    if (!recorte.comSeletor) return arvore.map((area) => desenharArea(area));
    return [
      <SeletorDeArea
        key={ID_DO_SELETOR}
        areas={recorte.areas}
        atual={recorte.grupoAtual}
        trilho={trilho}
        flutuante={flutuante.aberta === ID_DO_SELETOR}
        despachar={despachar}
        espera={espera}
        aoTrocar={trocarDeArea}
      />,
      // Expandida, o seletor é o cabeçalho da área; no trilho, a área mantém o ícone.
      desenharArea(recorte.grupoAtual, { semCabecalho: !trilho }),
      ...recorte.demais.map((area) => desenharArea(area)),
    ];
  };

  return (
    <div
      ref={refNavegacao}
      className={classes("side-navigation", transborda && "transborda")}
    >
      <nav
        id="nav"
        ref={refNav}
        className="menu-lateral"
        aria-label="Áreas do sistema"
      >
        {arvore.length === 0 ? (
          // Só depois do primeiro `buildNav`: antes dele não há o que avisar.
          opcoes.textoVazio ? (
            <div className="alert warn">{opcoes.textoVazio}</div>
          ) : null
        ) : (
          conteudo()
        )}
      </nav>
    </div>
  );
}
