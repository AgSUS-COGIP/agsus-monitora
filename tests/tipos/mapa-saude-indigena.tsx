import type {
  DseiDoMapa,
  RegistroDoDsei,
  PropsDoMapaSaudeIndigena,
} from "../../src/lib/mapa-saude-indigena/tipos.ts";
import { MapaSaudeIndigena } from "../../src/modulos/mapa-saude-indigena/mapa-saude-indigena.tsx";
import { configuracaoDoMapa } from "../../src/lib/mapa-saude-indigena/dados-do-mapa.ts";
const dados: unknown = {};
const distritos: DseiDoMapa[] = configuracaoDoMapa(dados).dsei;
const props: PropsDoMapaSaudeIndigena = {
  lmap: dados,
  redeCnes: dados,
  aoEscolherDsei(dsei) {
    const chave: string = dsei.k;
    void chave;
  },
  aoEscolherUnidade(unidade) {
    const latitude: number = unidade.lat;
    void latitude;
  },
};
const mapa = <MapaSaudeIndigena {...props} />;
const unidade: Pick<RegistroDoDsei, "lat" | "lon"> = {
  // @ts-expect-error Uma unidade desenhada já tem coordenada numérica.
  lat: "-12",
  lon: -50,
};
const invalido: PropsDoMapaSaudeIndigena = {
  ...props,
  // @ts-expect-error O callback recebe um distrito completo, não sua chave isolada.
  aoEscolherDsei: (chave: string) => void chave,
};
void [distritos, mapa, unidade, invalido];
