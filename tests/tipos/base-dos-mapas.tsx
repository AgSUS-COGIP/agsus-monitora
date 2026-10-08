import {
  usarMapaDoBrasil,
  ListaDoMapa,
} from "../../src/modulos/mapa-saude-indigena/painel-do-mapa.tsx";
import { usarTelaCheia } from "../../src/modulos/mapa-saude-indigena/tela-cheia.tsx";
import { usarUltimo } from "../../src/modulos/mapa-saude-indigena/usar-ultimo.ts";
import { usarVoltaDoDsei } from "../../src/modulos/mapa-saude-indigena/volta-ao-brasil.ts";
import type { VoltaDoDsei } from "../../src/modulos/mapa-saude-indigena/tipos-do-painel.ts";

export function ContratosDaBaseDosMapas() {
  const painel = usarMapaDoBrasil(null, {
    aoCriar: () => ({ pontos: new Map<string, number>() }),
  });
  painel.camadas.current?.pontos.set("A", 1);
  painel.camadas.current?.pegar();
  painel.mapa?.remove();
  const [telaCheia, botao] = usarTelaCheia();
  const ativa: boolean = telaCheia;
  const ultimo = usarUltimo({ distrito: "A" });
  // @ts-expect-error A referência preserva o tipo do valor mais recente.
  ultimo.current.distrito = 1;
  // @ts-expect-error A camada preserva o tipo dos pontos fornecidos pelo mapa.
  painel.camadas.current?.pontos.set("A", "um");
  // @ts-expect-error Cada mapa precisa fornecer o construtor das suas camadas.
  usarMapaDoBrasil(null, {});
  const [volta, pedirVolta] = usarVoltaDoDsei({ k: "A", lat: "-12", lon: -50 });
  pedirVolta();
  const partida: VoltaDoDsei["partida"] = volta?.partida ?? null;
  void [partida, ativa];
  const props: Parameters<typeof ListaDoMapa>[0] = {
    id: "lista",
    idDoTitulo: "titulo",
    titulo: "Territórios",
    total: 3,
    // @ts-expect-error Carregamento tem estado booleano.
    carregando: "sim",
    vazio: "Sem territórios.",
  };
  return <ListaDoMapa {...props}>{botao}</ListaDoMapa>;
}
