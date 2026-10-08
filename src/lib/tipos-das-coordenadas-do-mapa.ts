import type { PontoDoEditor } from "./tipos-do-editor-de-coordenadas.ts";

export interface AlvoDaCoordenadaIndigena {
  fonte: "lmap" | "rede_cnes";
  tipo: "sede" | "polo" | "casai" | "u" | "c" | "nac";
  dsei: string | null;
  indice: number;
  codigo: string | null;
  nome: string;
}
export interface PontoEditavelIndigena extends PontoDoEditor {
  alvo: AlvoDaCoordenadaIndigena;
  localidade: string;
}
