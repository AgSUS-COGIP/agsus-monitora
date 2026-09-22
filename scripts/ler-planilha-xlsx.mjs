import { readFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";

/*
  Leitor mínimo de xlsx. Lê pelo DIRETÓRIO CENTRAL do zip, não pelos cabeçalhos
  locais: quando o ficheiro é escrito em fluxo, o cabeçalho local traz tamanho
  zero e o tamanho real só existe no diretório central.
*/
export function lerPlanilhaXlsx(caminho) {
  const buf = readFileSync(caminho);

  const fimCd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (fimCd < 0) throw new Error("não parece um zip");
  const totalEntradas = buf.readUInt16LE(fimCd + 10);
  let p = buf.readUInt32LE(fimCd + 16);

  const partes = new Map();
  for (let n = 0; n < totalEntradas; n += 1) {
    const metodo = buf.readUInt16LE(p + 10);
    const comprimido = buf.readUInt32LE(p + 20);
    const nlen = buf.readUInt16LE(p + 28);
    const elen = buf.readUInt16LE(p + 30);
    const clen = buf.readUInt16LE(p + 32);
    const nome = buf.slice(p + 46, p + 46 + nlen).toString();
    const deslocamento = buf.readUInt32LE(p + 42);

    const nlenLocal = buf.readUInt16LE(deslocamento + 26);
    const elenLocal = buf.readUInt16LE(deslocamento + 28);
    const inicio = deslocamento + 30 + nlenLocal + elenLocal;
    const dados = buf.slice(inicio, inicio + comprimido);
    partes.set(nome, metodo === 8 ? inflateRawSync(dados) : dados);

    p += 46 + nlen + elen + clen;
  }

  const decodificar = (texto) =>
    texto
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, "&");

  const textos = [];
  const ss = partes.get("xl/sharedStrings.xml")?.toString("utf8") || "";
  for (const item of ss.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
    textos.push(
      decodificar(
        [...item[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)]
          .map((m) => m[1])
          .join(""),
      ),
    );
  }

  const folhas = {};
  for (const [nome, dados] of partes) {
    if (!/^xl\/worksheets\/sheet\d+\.xml$/.test(nome)) continue;
    const xml = dados.toString("utf8");
    const linhas = [];
    for (const linha of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
      const celulas = {};
      for (const c of linha[1].matchAll(
        /<c r="([A-Z]+)\d+"([^>]*)>([\s\S]*?)<\/c>/g,
      )) {
        const tipo = /t="([^"]+)"/.exec(c[2])?.[1];
        if (tipo === "inlineStr") {
          const t = /<t[^>]*>([\s\S]*?)<\/t>/.exec(c[3])?.[1];
          if (t != null) celulas[c[1]] = decodificar(t);
          continue;
        }
        const bruto = /<v>([\s\S]*?)<\/v>/.exec(c[3])?.[1];
        if (bruto == null) continue;
        celulas[c[1]] = tipo === "s" ? (textos[Number(bruto)] ?? "") : bruto;
      }
      linhas.push(celulas);
    }
    folhas[nome] = linhas;
  }
  return folhas;
}
