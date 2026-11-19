import "./mapa.css";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useState, useSyncExternalStore } from "react";
import { criarEndereco } from "../../app/endereco.ts";
import type { Endereco } from "../../app/endereco.ts";
import {
  buscaDoEndereco,
  enderecoDaTela,
} from "../../app/filtros-no-endereco.ts";
import type { EsquemaDosFiltros } from "../../app/filtros-no-endereco.ts";
import type { JanelaDoApp } from "../../app/ir-para-tela.ts";
import { usarLojaNaUrl } from "../../app/usar-filtros-na-url.ts";
import { erroParaATela } from "../../lib/base/erro-na-tela.ts";
import {
  chaveDoDseiNoEndereco,
  dseiNoEndereco,
} from "../../lib/mapas/mapa-saude-indigena/aba-do-mapa.ts";
import { getSupabaseClient } from "../../lib/sessao/supabaseClient";
import {
  MAPA_DOS_DSEIS,
  mapaDaVisaoGeral,
} from "../../lib/visao-geral/visao-geral-da-area.ts";
import { Carregando, ErroAoCarregar, EstadoVazio } from "../../ui/index.ts";
import { carregarLeaflet } from "../mapa-saude-indigena/carregar-leaflet.ts";
import { MapaSaudeIndigenaComSigepsi } from "../mapa-saude-indigena/mapa-com-sigepsi.tsx";
import {
  buscarAcompanhamentoNoSupabase,
  estadoDaVisaoGeral,
} from "../visao-geral/estado.ts";
import type { EstadoDaVisaoGeral } from "../visao-geral/tipos.ts";

/*
  A ABA MAPA (view `mapa`, rota `/saude-indigena/mapa[/<dsei>]`)

  O mapa dos DSEIs saiu da Visão geral para uma página própria. É o mesmo
  componente (src/modulos/mapa-saude-indigena/, com o SIGEPSI por cima do
  `lmap` do banco), com a página toda para ele:

  - As linhas e o `lmap` vêm do estado da Visão geral (`estadoDaVisaoGeral`),
    com as mesmas contas (vagas reabertas descontadas pelo acompanhamento da
    área). Com o Mapa aberto, o estado calcula e pede o acompanhamento sem
    montar a Visão geral (`definirLidaPeloMapa`, src/app/pagina-aberta.ts).
    Os filtros da Visão geral não valem aqui: o mapa mostra a área inteira.
  - O DSEI aberto mora no endereço (`/saude-indigena/mapa/yanomami`): é um
    filtro da tela que fica no caminho (`campoNoCaminho`,
    src/lib/navegacao/rotas.ts). Abrir um DSEI empilha no histórico; o
    voltar do navegador volta ao Brasil. A loja do DSEI é da tela; a cada
    abertura (`render()`) ela relê o endereço, para um link de outra tela
    (o cartão do mapa na Visão geral) abrir o DSEI pedido.
  - O código do mapa e o Leaflet chegam com esta tela (sob demanda, fora da
    entrada).
*/

const ESQUEMA_DO_MAPA: EsquemaDosFiltros<"dsei"> = Object.freeze({
  dsei: { padrao: "", empilha: true },
});

/** O DSEI aberto (o pedaço do endereço), fora do React. */
export function criarLojaDoDsei() {
  let dsei = "";
  const ouvintes = new Set<() => void>();
  return {
    obter: () => dsei,
    definir(valor: unknown) {
      const novo = String(valor ?? "").trim();
      if (novo === dsei) return;
      dsei = novo;
      ouvintes.forEach((ouvinte) => ouvinte());
    },
    assinar(ouvinte: () => void) {
      ouvintes.add(ouvinte);
      return () => {
        ouvintes.delete(ouvinte);
      };
    },
  };
}
export type LojaDoDsei = ReturnType<typeof criarLojaDoDsei>;

/* O Leaflet (CDN) antes do mapa; falhou, "Tentar novamente". */
function usarLeaflet(carregar: () => Promise<void>) {
  const [situacao, definir] = useState<{ pronto: boolean; erro: unknown }>({
    pronto: false,
    erro: null,
  });
  const [tentativa, definirTentativa] = useState(0);
  useEffect(() => {
    let viva = true;
    carregar().then(
      () => {
        if (viva) definir({ pronto: true, erro: null });
      },
      (erro: unknown) => {
        if (viva) definir({ pronto: false, erro });
      },
    );
    return () => {
      viva = false;
    };
  }, [carregar, tentativa]);
  return {
    ...situacao,
    tentar() {
      definir({ pronto: false, erro: null });
      definirTentativa((n) => n + 1);
    },
  };
}

export interface PropsDaTelaDoMapa {
  estado: EstadoDaVisaoGeral;
  loja: LojaDoDsei;
  supabase: SupabaseClient | null;
  leaflet: () => Promise<void>;
  irPara: (view: string) => unknown;
  endereco?: Endereco | undefined;
}

export function TelaDoMapa({
  estado,
  loja,
  supabase,
  leaflet,
  irPara,
  endereco,
}: PropsDaTelaDoMapa) {
  const e = useSyncExternalStore(estado.assinar, estado.obter);
  const dsei = useSyncExternalStore(loja.assinar, loja.obter);
  const mudar = usarLojaNaUrl(
    ESQUEMA_DO_MAPA,
    { dsei },
    ({ dsei: pedido = "" }) => loja.definir(pedido),
    { tela: "mapa", ...(endereco ? { endereco } : {}) },
  );
  const { pronto, erro, tentar } = usarLeaflet(leaflet);

  if (mapaDaVisaoGeral(e.area) !== MAPA_DOS_DSEIS)
    return <EstadoVazio>O mapa é da área Saúde Indígena.</EstadoVazio>;

  let conteudo;
  if (erro)
    conteudo = (
      <ErroAoCarregar
        oQue="o mapa"
        mensagem={erroParaATela(erro)}
        aoTentar={tentar}
      />
    );
  else if (!pronto)
    conteudo = (
      <div className="mapa-tela-reserva">
        <Carregando />
      </div>
    );
  else
    conteudo = (
      <MapaSaudeIndigenaComSigepsi
        supabase={supabase}
        lmap={e.mapa?.lmap}
        linhas={e.linhasDaArea}
        filtroAtivo={false}
        dseiSelecionado={dsei ? chaveDoDseiNoEndereco(dsei) : null}
        aoEscolherDsei={(escolhido) =>
          mudar({ dsei: dseiNoEndereco(escolhido.k) })
        }
        aoSairDoDsei={() => mudar({ dsei: "" })}
        aoAbrirNaVisaoGeral={(unidades) => {
          // O DSEI na Visão geral é o filtro Unidade (as unidades dele).
          estado.definirFiltro("unidade", unidades);
          irPara("dashboard");
        }}
        aoFiltrarPorBusca={(busca) => {
          // A CASAI nacional: os editais dela, na tabela da Visão geral.
          estado.definirBusca(busca);
          irPara("dashboard");
        }}
      />
    );
  return (
    <div className="ui-tela mapa-tela" data-tour="mapa-saude-indigena">
      {conteudo}
    </div>
  );
}

export interface OpcoesDoMapa {
  estado?: EstadoDaVisaoGeral;
  supabase?: SupabaseClient | null;
  leaflet?: () => Promise<void>;
  endereco?: Endereco;
  irPara?: (view: string) => unknown;
  /** A Visão geral já entregou ao estado a busca do acompanhamento. */
  comAcompanhamento?: boolean;
}

/**
 * Cria a aba Mapa (rota `mapa`, src/app/telas.tsx, sob demanda). `render()`
 * a cada abertura relê o DSEI do endereço.
 */
export function criarMapa({
  estado = estadoDaVisaoGeral,
  supabase = getSupabaseClient(),
  leaflet = carregarLeaflet,
  endereco = criarEndereco(),
  irPara = (view) => (globalThis.window as JanelaDoApp)?.navigate?.(view),
  comAcompanhamento = false,
}: OpcoesDoMapa = {}) {
  // Aberto antes da Visão geral: as vagas precisam do acompanhamento da área.
  if (!comAcompanhamento && supabase)
    estado.definirBuscaDoAcompanhamento(
      buscarAcompanhamentoNoSupabase(supabase),
    );
  const loja = criarLojaDoDsei();
  function lerDoEndereco() {
    const local = endereco.obter();
    if (!enderecoDaTela(local, "mapa")) return;
    loja.definir(new URLSearchParams(buscaDoEndereco(local)).get("dsei") || "");
  }
  lerDoEndereco();
  return {
    estado,
    loja,
    nome: "o Mapa",
    conteudo: (
      <TelaDoMapa
        estado={estado}
        loja={loja}
        supabase={supabase}
        leaflet={leaflet}
        irPara={irPara}
        endereco={endereco}
      />
    ),
    render: lerDoEndereco,
  };
}
