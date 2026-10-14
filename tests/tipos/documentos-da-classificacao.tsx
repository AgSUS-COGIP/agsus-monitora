import {
  gerarXlsx,
  instantaneoDaLista,
} from "../../src/lib/classificacao/exportacao.ts";
import { classificar } from "../../src/lib/classificacao/motor.ts";
import { documentoOficial } from "../../src/lib/classificacao/documento-sei.ts";
import {
  corrida,
  gerarDocxOficial,
  pacoteDocx,
} from "../../src/lib/classificacao/documento-docx.ts";
import type {
  DocumentoOficial,
  LogoDoDocumento,
} from "../../src/lib/classificacao/tipos-dos-documentos.ts";

const retrato = instantaneoDaLista(classificar({}));
const doc: DocumentoOficial = documentoOficial(retrato);
const logo: LogoDoDocumento = {
  bytes: new Uint8Array(),
  largura: 100,
  altura: 50,
};
const bytes: Uint8Array = gerarDocxOficial(doc, { logo });
void bytes;
gerarXlsx([
  {
    nome: "Classificação",
    linhas: [
      ["Nome", "Nota"],
      ["Ana", 12.5],
    ],
  },
]);
pacoteDocx({ nome: "Resultado", documento: "<xml/>" });
// @ts-expect-error Células da planilha não recebem objetos arbitrários.
gerarXlsx([{ nome: "Lista", linhas: [[{}]] }]);
// @ts-expect-error A corrida recebe tamanho numérico em meios pontos.
corrida("Título", { tamanho: "24" });
// @ts-expect-error O pacote exige o XML do corpo do documento.
pacoteDocx({ nome: "Resultado" });
// @ts-expect-error Os bytes da imagem são binários.
const imagemInvalida: LogoDoDocumento = {
  bytes: "png",
  largura: 100,
  altura: 50,
};
void imagemInvalida;
