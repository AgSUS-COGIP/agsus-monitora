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
  ehAreaDoSistema,
  FLUTUANTE_FECHADO,
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
import { dicaDaManutencao } from "../../lib/situacao-dos-modulos.js";
import { marcarItemAtivoNoMenu } from "./estado.js";

/*
  O menu em áreas. O catálogo, a árvore e o estado do painel flutuante são
  lógica pura, em `src/lib/menu-lateral.js`; aqui fica o desenho.

  - Com mais de uma área, o topo é o SELETOR DE ÁREA ("Área: Projetos", com o
    ícone da área e a bolinha da cor dela) e, abaixo dele, só as páginas da
    área atual — no lugar das três áreas abertas uma sob a outra. Trocar de
    área chama `definirAreaAtual` e abre a mesma página na área nova, ou a
    primeira dela (`destinoAoTrocarDeArea`). Com uma área só, não há seletor:
    a área aparece como acordeão, como antes.
  - Expandida (e na gaveta do celular): Painéis e Administração são acordeões,
    e todos nascem abertos. O que se guarda é a lista dos que a pessoa fechou.
    Só a seta gira; a altura não anima (Design System AgSUS, 7.1).
  - Recolhida (acima de 900px), de cima para baixo: o seletor vira o ícone da
    área atual, com o anel e a bolinha da cor dela (dica "Área: <nome>"; o
    clique abre a lista das áreas); cada página da área atual é um ícone que
    navega num clique (`direto`, com a dica do nome e a página aberta em
    destaque); Painéis e Administração são um ícone cada, e o painel deles
    vira um flutuante `position: fixed` ao lado do trilho, com a pílula do
    nome em cima. O estado do flutuante (qual está aberto, e por quê) é o de
    `proximoFlutuante`: um por vez, `Esc` fecha, um clique não prende o painel.

  O DOM continua sendo contrato: `#nav`, `[data-view]`, `[data-secao]`,
  `[data-area]`, `data-rotulo`, `data-icone` e `aria-current` são lidos pelo
  menu inferior do celular, pelos ganchos do mapa (`[data-view="dashboard"]`)
  e pelos testes de ponta a ponta. As opções do seletor não têm `data-view`:
  não são páginas.

  Com `previa` (a prévia de Configurações › Marca), o menu é o mesmo, mas não
  grava as áreas fechadas nem avisa `EVENTO_MENU_ATUALIZADO`: quem espelha o
  menu é a barra de verdade.
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
  inline: quem a procura na janela na hora pega sempre a versão atual do
  legado, mesmo que ela seja trocada depois da montagem.
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
  ao seletor: posição alinhada ao ícone, ponteiro, foco e `Esc`. Com
  `soNoClique` (o seletor de área), apontar e focar não abrem o painel — só
  mostram a dica — e quem abre é o clique (ou Enter/Espaço).
*/
function usarGatilhoFlutuante({
  id,
  trilho,
  flutuante,
  despachar,
  espera,
  soNoClique = false,
}) {
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
      if (!trilho || soNoClique) return;
      if (evento.pointerType === "touch" || !temHover()) return;
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
      if (trilho && !soNoClique) despachar({ tipo: "focar", area: id });
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

/*
  Todo item mostra o ícone da página à esquerda do nome — o mesmo do trilho.
  Aba marcada como beta (`item.beta`, do catálogo) leva o selo "BETA" ao lado
  do nome.

  `direto`: no trilho, a página é um ícone que navega num clique. O nome (e o
  selo) saem de vista — continuam no nome do botão para o leitor de tela —, o
  beta vira um ponto no ícone e os dois aparecem na dica (`data-dica`) no
  ponteiro e no foco.

  Aba em manutenção (`item.manutencao`, do catálogo; ver
  `src/lib/situacao-dos-modulos.js`) leva a chave inglesa âmbar ao lado do
  nome, com a mensagem e a previsão na dica (`title`). A página continua no
  menu: quem abre vê a tela de manutenção (o administrador global entra).
*/
function IndicadorDeManutencao({ manutencao }) {
  if (!manutencao) return null;
  const dica = dicaDaManutencao(manutencao);
  return (
    <span className="menu-manutencao" title={dica} aria-label={dica}>
      <Icone nome="wrench" tamanho={14} />
    </span>
  );
}

function ItemDoMenu({ item, ativo, direto = false, aoEscolher }) {
  const dica = [
    item.rotulo,
    item.beta ? "BETA" : "",
    item.manutencao ? "em manutenção" : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <li>
      <button
        type="button"
        className={classes(
          "menu-item",
          ativo && "active",
          item.beta && "menu-item--beta",
          item.manutencao && "menu-item--manutencao",
        )}
        data-view={item.view}
        data-secao={item.secao}
        data-area={item.area}
        data-rotulo={item.rotulo}
        data-icone={item.icone}
        data-dica={direto ? dica : undefined}
        aria-current={ativo ? "page" : undefined}
        onClick={aoEscolher}
      >
        <Icone nome={item.icone} className="menu-item__icone" />
        <span className="menu-item__rotulo">{item.rotulo}</span>
        {item.beta ? <span className="menu-item__selo">BETA</span> : null}
        <IndicadorDeManutencao manutencao={item.manutencao} />
      </button>
    </li>
  );
}

function Area({
  area,
  aberta,
  atual,
  semCabecalho = false,
  direto = false,
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
  /*
    Direta (as páginas da área no trilho, cada uma um ícone), não há cabeçalho
    nem painel a abrir: ponteiro e foco não disparam o flutuante.
  */
  const semCabecalhoNemPainel = semCabecalho || direto;
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
        (aberta || semCabecalhoNemPainel) && "menu-area--aberta",
        atual && "menu-area--atual",
        flutuante && !direto && "menu-area--flutuante",
        semCabecalhoNemPainel && "menu-area--sem-cabecalho",
        direto && "menu-area--direta",
        area.id === AREA_DAS_CONFIGURACOES && "menu-area--administracao",
      )}
      data-area={area.id}
      data-tour={
        semCabecalho
          ? "barra-itens-da-area"
          : area.id === AREA_DAS_CONFIGURACOES
            ? "barra-administracao"
            : undefined
      }
      {...(direto ? {} : eventos)}
      onKeyDown={direto ? undefined : dispensarPorEsc}
    >
      {semCabecalhoNemPainel ? null : (
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
          <IndicadorDeManutencao manutencao={area.manutencao} />
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
              direto={direto}
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
  acordeão, sem sobrepor o menu); no trilho, é o ícone da própria área, com o
  anel e a bolinha da cor dela e a dica "Área: <nome>", e o clique abre a
  lista no painel flutuante. A cor nunca vai sozinha: o ícone e o nome dizem
  qual é a área.
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
      soNoClique: true,
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
      data-tour="barra-seletor-de-area"
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
        data-dica={trilho ? `Área: ${atual.rotulo}` : undefined}
        data-cor-da-area={atual.id}
      >
        <span className="menu-seletor__marca" aria-hidden="true">
          <Icone
            nome={atual.icone}
            className="menu-area__icone menu-seletor__icone"
          />
          <span className="menu-seletor__ponto" data-cor-da-area={atual.id} />
        </span>
        <span className="menu-area__rotulo menu-seletor__rotulo">
          <small>Área</small>
          <strong>{atual.rotulo}</strong>
        </span>
        <IndicadorDeManutencao manutencao={atual.manutencao} />
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
                  <IndicadorDeManutencao manutencao={area.manutencao} />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

export function Navegacao({ arvore, ativo, opcoes, trilho, previa = false }) {
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
    if (!previa) gravarAreasFechadas(proximas);
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
    if (previa) return;
    avisar(EVENTO_MENU_ATUALIZADO, {
      view: ativo.view,
      secao: secaoAtiva,
      area: areaAtual,
    });
  }, [arvore, ativo, secaoAtiva, areaAtual, previa]);

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
      // A seção pode recusar abrir (saída de Acessos com alteração não salva).
      if (
        paginaAtiva(item.view) &&
        opcoes.aoAbrirSecao?.(item.view, item.secao) !== false
      )
        marcarItemAtivoNoMenu(item.view, item.secao);
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

  /*
    No trilho, as páginas da área atual são ícones diretos (um clique navega);
    Painéis e Administração continuam agrupados, com o painel flutuante.
    Expandida, o seletor é o cabeçalho da área atual; com uma área só, ela é
    acordeão.
  */
  const conteudo = () => {
    if (!recorte.comSeletor) {
      return arvore.map((area) =>
        desenharArea(area, { direto: trilho && ehAreaDoSistema(area.id) }),
      );
    }
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
      desenharArea(recorte.grupoAtual, { semCabecalho: true, direto: trilho }),
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
        data-tour="barra-menu"
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
