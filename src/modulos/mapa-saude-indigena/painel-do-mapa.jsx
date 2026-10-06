import { useEffect, useReducer, useRef, useState } from "react";
import { EstadoVazio, classes } from "../../ui/index.js";
import { BotaoDeRecolher } from "../editor-de-coordenadas/modo-de-edicao.jsx";
import { criarMapaDoBrasil, remedir, voltarAoBrasil } from "./leaflet.js";
import { usarUltimo } from "./usar-ultimo.js";

/*
  O PAINEL DO MAPA NACIONAL, comum aos mapas da Visão geral: o da Saúde
  Indígena (mapa-nacional.jsx) e o de Projetos (src/modulos/mapa-de-projetos/).
  As regras são as mesmas; muda só o que vai no mapa e na lista.

  - `usarMapaDoBrasil`: cria o mapa uma vez (`criarMapaDoBrasil`: Brasil,
    fundo, contornos, observador de tamanho), refaz o enquadramento quando ele
    aparece ou muda de tamanho sem a pessoa ter mexido, e remede ao voltar a
    aparecer ou ao entrar/sair da tela cheia.
  - `TopoDoMapa`: título, contagem e os controles "Coordenadas" (quem pode
    editar), "Brasil" e o que o pai passar (Tela cheia, que some no modo de
    edição).
  - `MolduraDoMapa`: o contêiner do Leaflet (ou o aviso sem conexão) e a
    legenda flutuante por cima.
  - `ListaDoMapa`: a lista lateral ("Territórios por vagas", "Municípios por
    vagas"), com o total, o esqueleto enquanto carrega e o vazio.
  - `propsDoEditor`: o que o editor de coordenadas recebe do modo de edição.
*/

/*
  `aoCriar(mapa)` monta as camadas do pai e devolve o que ele quer guardar
  (com `parar()` opcional, chamado antes do `remove`); fica em `camadas`,
  junto do `pegar`/`soltar` do `criarMapaDoBrasil`. `emVoo` (ref) suspende o
  reenquadramento enquanto o mapa voa.
*/
export function usarMapaDoBrasil(
  L,
  { aoCriar, emVoo, visivel = true, telaCheia = false } = {},
) {
  const refDoMapa = useRef(null);
  const [mapa, definirMapa] = useState(null);
  const camadas = useRef(null);
  const ultimoEnquadramento = useRef("");
  // Quantas vezes o enquadramento teve de ser refeito (apareceu, mudou de tamanho).
  const [aparecimentos, aparecer] = useReducer((n) => n + 1, 0);
  const chamadas = usarUltimo({ aoCriar });

  // Cria o mapa uma vez; o StrictMode desfaz e refaz, e o `remove` limpa tudo.
  useEffect(() => {
    const elemento = refDoMapa.current;
    if (!L || !elemento) return undefined;
    /*
      Criado escondido (antes do login, noutra tela) o enquadramento usa a
      medida zero: ao aparecer, enquadra de novo. Também ao mudar de tamanho
      (tela cheia, barra lateral), se a pessoa não mexeu no mapa.
    */
    const {
      mapa: novo,
      pegar,
      soltar,
      parar,
    } = criarMapaDoBrasil(L, elemento, {
      aoReenquadrar: () => {
        if (emVoo?.current) return;
        ultimoEnquadramento.current = "";
        aparecer();
      },
    });
    const doPai = chamadas.current.aoCriar?.(novo) || {};
    camadas.current = { ...doPai, pegar, soltar };
    ultimoEnquadramento.current = "";
    definirMapa(novo);
    return () => {
      parar();
      doPai.parar?.();
      novo.remove();
      camadas.current = null;
      definirMapa(null);
    };
    // `emVoo` é um ref estável; `aoCriar` vem do ref `chamadas`.
  }, [L]);

  // Voltou a aparecer, ou mudou para tela cheia: o Leaflet remede.
  useEffect(() => {
    if (!mapa || !visivel) return undefined;
    const quadro = requestAnimationFrame(() => remedir(mapa));
    return () => cancelAnimationFrame(quadro);
  }, [mapa, visivel, telaCheia]);

  return { refDoMapa, mapa, camadas, ultimoEnquadramento, aparecimentos };
}

export function TopoDoMapa({
  L,
  mapa,
  camadas,
  idDoMapa,
  titulo,
  contagem,
  podeEditar,
  modo,
  idDoPainel,
  acoes,
}) {
  return (
    <header className="mapa-si-painel__topo">
      <div className="mapa-si-painel__titulos">
        <h2 className="ui-titulo" id={`${idDoMapa}-titulo`}>
          {titulo}
        </h2>
        <span className="mapa-si-painel__contagem">{contagem}</span>
      </div>
      <div
        className="mapa-si-painel__acoes"
        role="group"
        aria-label="Controles do mapa"
      >
        {podeEditar ? (
          <button
            type="button"
            className="btn small"
            aria-pressed={modo.editando}
            aria-expanded={modo.editando}
            aria-controls={idDoPainel}
            title={modo.editando ? "Sair da edição (Esc)" : undefined}
            onClick={modo.alternar}
          >
            Coordenadas
          </button>
        ) : null}
        <button
          type="button"
          className="btn small"
          onClick={() => {
            voltarAoBrasil(L, mapa);
            camadas.current?.soltar();
          }}
          disabled={!mapa}
          title="Voltar à visão do Brasil inteiro"
          data-tour="visao-geral-mapa-brasil"
        >
          Brasil
        </button>
        {modo.editando ? null : acoes}
      </div>
    </header>
  );
}

export function MolduraDoMapa({ L, refDoMapa, idDoMapa, rotulo, children }) {
  return (
    <div className="mapa-si-moldura">
      {L ? (
        <div
          ref={refDoMapa}
          id={idDoMapa}
          className="mapa-si-mapa"
          role="img"
          aria-label={rotulo}
        />
      ) : (
        <EstadoVazio className="ui-vazio mapa-si-sem-mapa">
          Mapa indisponível sem conexão: o fundo geográfico precisa de internet.
        </EstadoVazio>
      )}
      {children}
    </div>
  );
}

/*
  A lista lateral. `id` é o do painel (o "Coordenadas" o controla);
  `idDoTitulo` nomeia a lista. `vazio` aparece quando não carrega e não há
  `children`; `antes` vem entre o topo e os itens (os filtros de Projetos).
*/
export function ListaDoMapa({
  refDaLista,
  id,
  idDoTitulo,
  titulo,
  total,
  carregando,
  vazio,
  antes = null,
  children,
}) {
  return (
    <aside
      ref={refDaLista}
      className="mapa-si-lista"
      id={id}
      aria-labelledby={idDoTitulo}
    >
      <div className="mapa-si-lista__topo">
        <span id={idDoTitulo}>{titulo}</span>
        <b>{carregando ? "…" : Number(total || 0).toLocaleString("pt-BR")}</b>
      </div>
      {carregando ? null : antes}
      {carregando ? (
        <div className="ui-esqueleto mapa-si-lista__esqueleto" />
      ) : (
        children || <EstadoVazio>{vazio}</EstadoVazio>
      )}
    </aside>
  );
}

/* O que o editor de coordenadas de cada mapa recebe do modo de edição. */
export function propsDoEditor(modo, idDoPainel) {
  return {
    aoFechar: modo.fechar,
    areaLivre: modo.areaLivre,
    versaoDaArea: modo.versaoDaArea,
    botaoDeRecolher: (
      <BotaoDeRecolher modo={modo} idDoConteudo={`${idDoPainel}-conteudo`} />
    ),
  };
}

/* As classes do painel nacional (o modo de edição o leva à tela inteira). */
export const classesDoPainel = (modo) =>
  classes(
    "ui-card mapa-si-painel mapa-si-painel--nacional",
    modo.editando && "mapa-si-painel--editando",
  );
