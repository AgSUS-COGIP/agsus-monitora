import type { ReactNode } from "react";
import type { MapaNacional } from "../../lib/tipos-do-mapa.ts";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { folgaDoEnquadramento } from "../../lib/editor-de-coordenadas.ts";
import { classes } from "../../ui/index.js";
import { remedir } from "../mapa-saude-indigena/leaflet.ts";
import { travarRolagemDaPagina } from "../mapa-saude-indigena/tela-cheia.tsx";
import { usarUltimo } from "../mapa-saude-indigena/usar-ultimo.ts";
import { CAMPOS_E_JANELAS } from "../mapa-saude-indigena/volta-ao-brasil.ts";

/*
  O MODO DE EDIÇÃO DE COORDENADAS, comum aos mapas da Visão geral (Saúde
  Indígena, no Brasil e no DSEI, e Projetos).

  "Coordenadas" leva o painel do mapa para a tela inteira, como a tela cheia
  (tela-cheia.jsx: acima do cabeçalho, a página não rola): o mapa ocupa tudo e
  o editor flutua num painel à direita (no celular, numa folha embaixo), com
  rolagem própria. "Recolher editor" deixa só uma faixa estreita — o editor
  continua montado (ponto escolhido, prévia e motivo ficam). Esc sai, menos
  num campo (o Esc fica com o campo) ou com uma janela aberta; sai antes da
  volta do DSEI ao Brasil e da tela cheia (ouvinte na captura da `window`,
  que vem antes da do
  `document`, e `preventDefault`). Fechar volta ao layout de sempre. Ao entrar
  e ao sair, o Leaflet remede mantendo o centro; o mapa do Brasil deixa de
  reenquadrar sozinho ao mudar de tamanho (`pegar`), para não tirar o ponto da
  tela.

  `areaLivre()` mede, na hora do enquadramento, o que o painel cobre do mapa
  e devolve os paddings do Leaflet (`folgaDoEnquadramento`); `versaoDaArea`
  muda quando o painel recolhe ou abre, para o editor trazer o pin de volta à
  área livre.
*/
export function usarModoDeEdicao({
  mapa,
  permitido = true,
  pegar,
}: {
  mapa?: MapaNacional | null;
  permitido?: boolean;
  pegar?: () => void;
} = {}) {
  const [editando, definirEditando] = useState(false);
  const [recolhido, definirRecolhido] = useState(false);
  const [versaoDaArea, definirVersaoDaArea] = useState(0);
  const refDoPainel = useRef<HTMLElement | null>(null);
  const chamadas = usarUltimo({ pegar });

  // Sem permissão (ou com o mapa escondido) o modo sai junto.
  if (editando && !permitido) {
    definirEditando(false);
    definirRecolhido(false);
  }
  const ativo = editando && permitido;

  const fechar = useCallback(() => {
    definirEditando(false);
    definirRecolhido(false);
  }, []);
  const alternar = useCallback(() => {
    definirEditando((atual) => !atual);
    definirRecolhido(false);
  }, []);
  const alternarRecolhido = useCallback(() => {
    definirRecolhido((atual) => !atual);
    definirVersaoDaArea((v) => v + 1);
  }, []);

  useEffect(() => {
    if (!ativo) return undefined;
    chamadas.current.pegar?.();
    const soltar = travarRolagemDaPagina();
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key !== "Escape" || evento.defaultPrevented) return;
      if (evento.altKey || evento.ctrlKey || evento.metaKey || evento.shiftKey)
        return;
      if (
        evento.target instanceof Element &&
        evento.target.closest(CAMPOS_E_JANELAS)
      ) {
        /*
          Num campo do editor o Esc é do campo (a busca limpa): não chega à
          tela cheia nem à volta do DSEI, que tirariam o painel do lugar.
        */
        if (evento.target.closest(".mapa-si-editor")) evento.stopPropagation();
        return;
      }
      if (document.querySelector('[aria-modal="true"], dialog[open]')) return;
      evento.preventDefault();
      fechar();
    };
    window.addEventListener("keydown", aoTeclar, true);
    return () => {
      soltar();
      window.removeEventListener("keydown", aoTeclar, true);
    };
  }, [ativo, fechar, chamadas]);

  // Entrou ou saiu: o conteiner mudou de tamanho no mesmo quadro.
  const anterior = useRef(ativo);
  useLayoutEffect(() => {
    if (anterior.current === ativo) return;
    anterior.current = ativo;
    remedir(mapa);
  }, [mapa, ativo]);

  const areaLivre = useCallback(() => {
    const conteiner = mapa?.getContainer?.();
    const painel = refDoPainel.current;
    return folgaDoEnquadramento(
      conteiner?.getBoundingClientRect?.(),
      painel?.getBoundingClientRect?.(),
    );
  }, [mapa]);

  return {
    editando: ativo,
    alternar,
    fechar,
    recolhido,
    alternarRecolhido,
    refDoPainel,
    areaLivre,
    versaoDaArea,
  };
}

/* O botão que recolhe e abre o painel do editor (no topo do editor e na faixa). */
export type ModoDeEdicao = ReturnType<typeof usarModoDeEdicao>;

export function BotaoDeRecolher({
  modo,
  idDoConteudo,
}: {
  modo: ModoDeEdicao;
  idDoConteudo: string;
}) {
  return (
    <button
      type="button"
      className="btn small mapa-si-editor__recolher"
      aria-expanded={!modo.recolhido}
      aria-controls={idDoConteudo}
      onClick={modo.alternarRecolhido}
    >
      {modo.recolhido ? "Abrir editor" : "Recolher editor"}
    </button>
  );
}

/*
  O painel flutuante do editor. Recolhido, mostra só a faixa com "Abrir
  editor"; o conteúdo fica montado e escondido. O botão de recolher do painel
  aberto vai no topo do editor (`botaoDeRecolher` do EditorDeCoordenadas).
*/
export function PainelDoEditor({
  id,
  rotulo,
  modo,
  children,
}: {
  id: string;
  rotulo: string;
  modo: ModoDeEdicao;
  children: ReactNode;
}) {
  const idDoConteudo = `${id}-conteudo`;
  return (
    <aside
      ref={modo.refDoPainel}
      id={id}
      className={classes(
        "mapa-si-editor",
        modo.recolhido && "mapa-si-editor--recolhido",
      )}
      aria-label={rotulo}
    >
      {modo.recolhido ? (
        <BotaoDeRecolher modo={modo} idDoConteudo={idDoConteudo} />
      ) : null}
      <div
        id={idDoConteudo}
        className="mapa-si-editor__conteudo"
        hidden={modo.recolhido}
      >
        {children}
      </div>
    </aside>
  );
}
