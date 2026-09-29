import { describe, expect, it } from "vitest";
import {
  crc32,
  documentoXml,
  escaparXml,
  gerarDocx,
  linhasDoTexto,
  montarPaginaDeImpressao,
  nomeDoDocumento,
  zipSemCompressao,
} from "../src/lib/documento-da-resposta.js";

/*
  O documento da resposta sem dependência: o .docx é um ZIP "stored" com o
  mínimo do formato, e o texto entra escapado; a página de impressão é
  montada com textContent (nada de HTML vindo do texto).
*/

/* Lê um ZIP sem compressão pelos cabeçalhos locais: nome → bytes. */
function lerZip(bytes) {
  const vista = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const arquivos = new Map();
  let p = 0;
  while (vista.getUint32(p, true) === 0x04034b50) {
    expect(vista.getUint16(p + 8, true)).toBe(0); // stored
    const crc = vista.getUint32(p + 14, true);
    const tamanho = vista.getUint32(p + 18, true);
    const nomeTamanho = vista.getUint16(p + 26, true);
    const nome = new TextDecoder().decode(
      bytes.slice(p + 30, p + 30 + nomeTamanho),
    );
    const dados = bytes.slice(
      p + 30 + nomeTamanho,
      p + 30 + nomeTamanho + tamanho,
    );
    expect(crc32(dados)).toBe(crc);
    arquivos.set(nome, new TextDecoder().decode(dados));
    p += 30 + nomeTamanho + tamanho;
  }
  // Diretório central e fim do arquivo.
  expect(vista.getUint32(p, true)).toBe(0x02014b50);
  const fim = bytes.length - 22;
  expect(vista.getUint32(fim, true)).toBe(0x06054b50);
  expect(vista.getUint16(fim + 10, true)).toBe(arquivos.size);
  expect(vista.getUint32(fim + 16, true)).toBe(p);
  return arquivos;
}

describe("docx", () => {
  it("CRC-32 do padrão", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });

  it("tem as partes mínimas e o texto em parágrafos, título em negrito", () => {
    const bytes = gerarDocx("RESPOSTA A RECURSO\n\nPrezada Ana,\nDeferido.", {
      titulo: "Resposta ao recurso nº 7",
      quando: new Date(2026, 8, 29, 10, 30),
    });
    const partes = lerZip(bytes);
    expect([...partes.keys()]).toEqual([
      "[Content_Types].xml",
      "_rels/.rels",
      "docProps/core.xml",
      "word/document.xml",
    ]);
    const documento = partes.get("word/document.xml");
    expect(documento.match(/<w:p>|<w:p\/>/g)).toHaveLength(4);
    expect(documento).toContain(
      '<w:b/></w:rPr><w:t xml:space="preserve">RESPOSTA A RECURSO</w:t>',
    );
    expect(documento).toContain(">Prezada Ana,</w:t>");
    expect(partes.get("docProps/core.xml")).toContain(
      "<dc:title>Resposta ao recurso nº 7</dc:title>",
    );
    expect(partes.get("[Content_Types].xml")).toContain(
      'PartName="/word/document.xml"',
    );
  });

  it("escapa o texto para XML e tira caracteres de controle", () => {
    expect(escaparXml(`a & b < c > "d" 'e'\u0001`)).toBe(
      "a &amp; b &lt; c &gt; &quot;d&quot; &apos;e&apos;",
    );
    const xml = documentoXml("Título\n<script>alert(1)</script> & </w:t>");
    expect(xml).not.toContain("<script>");
    expect(xml).toContain(
      "&lt;script&gt;alert(1)&lt;/script&gt; &amp; &lt;/w:t&gt;",
    );
    // Continua um XML bem formado.
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    expect(doc.getElementsByTagName("parsererror")).toHaveLength(0);
  });

  it("zip com nomes UTF-8 e conteúdo binário", () => {
    const partes = lerZip(
      zipSemCompressao([
        { nome: "ç.txt", conteudo: "olá" },
        { nome: "b.bin", conteudo: new Uint8Array([1, 2, 3]) },
      ]),
    );
    expect(partes.get("ç.txt")).toBe("olá");
    expect(partes.has("b.bin")).toBe(true);
  });

  it("nome do arquivo com o nº e o candidato, sem acento", () => {
    expect(nomeDoDocumento({ nu: 12, candidato: "Ana Ribeiro Ç. Souza" })).toBe(
      "resposta-recurso-12-ana-ribeiro-c-souza",
    );
    expect(linhasDoTexto("a\r\nb\rc")).toEqual(["a", "b", "c"]);
  });
});

describe("página de impressão", () => {
  it("um parágrafo por linha, como texto; o título vira o nome sugerido do PDF", () => {
    const documento = document.implementation.createHTMLDocument("x");
    montarPaginaDeImpressao(
      documento,
      "RESPOSTA\n\n<img src=x onerror=alert(1)> Prezada",
      { titulo: "resposta-recurso-7" },
    );
    expect(documento.title).toBe("resposta-recurso-7");
    const paragrafos = [...documento.body.querySelectorAll("p")];
    expect(paragrafos.map((p) => p.className)).toEqual(["titulo", "vazio", ""]);
    expect(paragrafos[2].textContent).toBe(
      "<img src=x onerror=alert(1)> Prezada",
    );
    expect(documento.querySelector("img")).toBeNull();
    expect(documento.head.querySelector("style").textContent).toContain(
      "@page",
    );
  });
});
