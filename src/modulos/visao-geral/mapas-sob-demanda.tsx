import { erroParaATela } from "../../lib/erro-na-tela.ts";
import type { ComponentProps, ComponentType } from "react";
import { useEffect, useSyncExternalStore } from "react";
import { importarComRecarga } from "../../lib/importar-com-recarga.ts";
import { carregarLeaflet } from "../mapa-saude-indigena/carregar-leaflet.ts";
import { Carregando, ErroAoCarregar } from "../../ui/index.ts";

/*
  Os mapas da Visão geral (Saúde Indígena e Projetos) saem do pacote
  principal: o código deles e o Leaflet (CDN, `carregarLeaflet`) só baixam
  quando um mapa monta. Até lá, "Carregando…" no lugar do mapa; falhou, o
  aviso com "Tentar novamente". Depois de carregado, desenha na hora.
*/

type MapaSI =
  typeof import("../mapa-saude-indigena/mapa-saude-indigena.tsx").MapaSaudeIndigena;
type MapaProjetos =
  typeof import("../mapa-de-projetos/mapa-de-projetos.tsx").MapaDeProjetos;

export interface OpcoesDaCarga {
  /** Baixa o Leaflet e instala as guardas (nos testes, o falso já em `L`). */
  leaflet?: () => Promise<void>;
}

interface EstadoDaCarga<C> {
  componente: C | null;
  erro: unknown;
}

function sobDemanda<C>(importar: () => Promise<C>) {
  const baixar = importarComRecarga(importar);
  let estado: EstadoDaCarga<C> = { componente: null, erro: null };
  let pedido: Promise<void> | null = null;
  const ouvintes = new Set<() => void>();
  const definir = (novo: EstadoDaCarga<C>) => {
    estado = novo;
    ouvintes.forEach((ouvinte) => ouvinte());
  };
  const carregar = ({ leaflet = carregarLeaflet }: OpcoesDaCarga = {}) => {
    pedido ??= Promise.all([leaflet(), baixar()]).then(
      ([, componente]) => definir({ componente, erro: null }),
      (erro: unknown) => {
        pedido = null;
        definir({ componente: null, erro });
      },
    );
    return pedido;
  };
  const assinar = (ouvinte: () => void) => {
    ouvintes.add(ouvinte);
    return () => {
      ouvintes.delete(ouvinte);
    };
  };
  return { carregar, assinar, obter: () => estado };
}

const mapaSI = sobDemanda<MapaSI>(() =>
  import("../mapa-saude-indigena/mapa-saude-indigena.tsx").then(
    (modulo) => modulo.MapaSaudeIndigena,
  ),
);
const mapaProjetos = sobDemanda<MapaProjetos>(() =>
  import("../mapa-de-projetos/mapa-de-projetos.tsx").then(
    (modulo) => modulo.MapaDeProjetos,
  ),
);

/** Baixa os dois mapas (e o Leaflet) antes de montar: pré-carga e testes. */
export function carregarMapasDaVisaoGeral(opcoes: OpcoesDaCarga = {}) {
  return Promise.all([mapaSI.carregar(opcoes), mapaProjetos.carregar(opcoes)]);
}

function usarMapa<C>(carga: ReturnType<typeof sobDemanda<C>>) {
  const { componente, erro } = useSyncExternalStore(carga.assinar, carga.obter);
  useEffect(() => {
    if (!componente && !erro) void carga.carregar();
  }, [carga, componente, erro]);
  return { componente, erro, tentar: () => void carga.carregar() };
}

function MapaSobDemanda<P extends object>({
  carga,
  props,
}: {
  carga: ReturnType<typeof sobDemanda<ComponentType<P>>>;
  props: P;
}) {
  const { componente: Mapa, erro, tentar } = usarMapa(carga);
  if (Mapa) return <Mapa {...props} />;
  if (erro)
    return (
      <ErroAoCarregar
        oQue="o mapa"
        mensagem={erroParaATela(erro)}
        aoTentar={tentar}
      />
    );
  return <Carregando />;
}

export function MapaSaudeIndigena(props: ComponentProps<MapaSI>) {
  return <MapaSobDemanda carga={mapaSI} props={props} />;
}

export function MapaDeProjetos(props: ComponentProps<MapaProjetos>) {
  return <MapaSobDemanda carga={mapaProjetos} props={props} />;
}
