import { readFileSync } from "node:fs";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ModeloDoEspelhoDeNota } from "../../src/modulos/avaliacao-documental/modelo-do-espelho.tsx";
import { clicar, digitar, esperar, teclar } from "../componentes/interacoes.ts";

/*
  O editor do modelo do espelho (issue #588): cabeçalho institucional à vista,
  seções com nome, foco e teclado (Ctrl+S, "Inserir {candidato}", ir ao campo
  com erro), rótulos e descrições ligados aos campos, só leitura para quem não
  coordena, "Imprimir exemplo" e o CSS responsivo e só com tokens (o tema
  escuro vem deles). Dados fictícios.
*/

type Argumentos = Record<string, unknown>;

let raiz: Root | null = null;
let lugar: HTMLDivElement | null = null;
afterEach(() => {
  act(() => raiz?.unmount());
  lugar?.remove();
  raiz = null;
});

function rpcFalso({ podeEditar = true } = {}) {
  return vi.fn(async (nome: string, args: Argumentos) => {
    if (nome === "obter_modelo_espelho_nota")
      return {
        versao: 4,
        textos: {},
        atualizado_em: "2026-11-12T12:00:00Z",
        atualizado_por: "Coordenação Fictícia",
        pode_editar: podeEditar,
      };
    if (nome === "salvar_modelo_espelho_nota")
      return {
        versao: Number(args.p_versao_atual) + 1,
        textos: args.p_textos,
        atualizado_em: "2026-11-12T12:05:00Z",
        atualizado_por: "Coordenação Fictícia",
        pode_editar: true,
      };
    throw new Error(`rpc inesperada ${nome}`);
  });
}

async function montar(
  rpc: ReturnType<typeof rpcFalso>,
  imprimir: (html: string) => void = () => {},
) {
  lugar = document.createElement("div");
  document.body.append(lugar);
  const r = createRoot(lugar);
  raiz = r;
  await act(async () => {
    r.render(
      createElement(ModeloDoEspelhoDeNota, {
        editalId: "e900",
        rpc,
        aoFechar: () => {},
        marca: () => ({ cabecalho: "AGÊNCIA FICTÍCIA\nRua de Exemplo, 0" }),
        imprimir,
      }),
    );
  });
  await esperar();
}

const campo = <T extends HTMLElement = HTMLInputElement>(chave: string) => {
  const el = document.querySelector<T>(`[data-campo='${chave}']`);
  if (!el) throw new Error(`campo ${chave} não encontrado`);
  return el;
};
const botao = (acao: string) =>
  document.querySelector<HTMLButtonElement>(`[data-acao='${acao}']`);
const previa = () =>
  document.querySelector(".avd-modelo-espelho-folha")?.getAttribute("srcdoc") ??
  "";

describe("editor do espelho: estrutura e acessibilidade", () => {
  it("mostra o cabeçalho institucional de Configurações, só para leitura", async () => {
    await montar(rpcFalso());
    const timbrado = document.querySelector("[data-secao='timbrado']");
    expect(timbrado?.getAttribute("aria-labelledby")).toBeTruthy();
    expect(
      [...(timbrado?.querySelectorAll("p") ?? [])].map((p) => p.textContent),
    ).toEqual(["AGÊNCIA FICTÍCIA", "Rua de Exemplo, 0"]);
    expect(timbrado?.querySelector("input, textarea")).toBeNull();
    expect(previa()).toContain("AGÊNCIA FICTÍCIA");
  });

  it("seções nomeadas, e todo campo tem rótulo e descrição ligados", async () => {
    await montar(rpcFalso());
    const legendas = [...document.querySelectorAll("fieldset legend")].map(
      (l) => l.textContent,
    );
    expect(legendas).toEqual([
      "Título e abertura",
      "Nomes dos quadros",
      "Notas",
      "Textos fixos e rodapé",
    ]);
    const controles = document.querySelectorAll<
      HTMLInputElement | HTMLTextAreaElement
    >(".avd-modelo-espelho-campos input, .avd-modelo-espelho-campos textarea");
    expect(controles.length).toBe(14);
    const rotulos = [...document.querySelectorAll("label")];
    for (const c of controles) {
      const rotulado =
        c.closest("label") || rotulos.some((l) => c.id && l.htmlFor === c.id);
      expect(rotulado, c.dataset.campo).toBeTruthy();
      const descrito = c.getAttribute("aria-describedby");
      if (descrito)
        expect(
          document.getElementById(descrito),
          c.dataset.campo,
        ).not.toBeNull();
    }
    // A abertura (texto longo) mostra o contador; a saudação, a dica do marcador.
    const abertura = campo<HTMLTextAreaElement>("abertura");
    const dica = document.getElementById(
      abertura.getAttribute("aria-describedby") ?? "",
    );
    expect(dica?.textContent).toMatch(/\d+ de 2\.000 caracteres/);
    expect(
      document.getElementById(
        campo("saudacao").getAttribute("aria-describedby") ?? "",
      )?.textContent,
    ).toContain("{candidato} vira o nome do candidato.");
    expect(campo("titulo").required).toBe(true);
    expect(campo("subtitulo").required).toBe(false);
  });

  it("prévia: seção com título, modelo por radiogroup e iframe com título e sem script", async () => {
    await montar(rpcFalso());
    const secao = document.querySelector(".avd-modelo-espelho-previa");
    const titulo = document.getElementById(
      secao?.getAttribute("aria-labelledby") ?? "",
    );
    expect(titulo?.textContent).toBe("Prévia do documento");
    expect(
      secao?.querySelector("[role='radiogroup']")?.getAttribute("aria-label"),
    ).toBe("Modelo da prévia");
    const iframe = secao?.querySelector("iframe");
    expect(iframe?.getAttribute("title")).toContain("com pontos");
    expect(iframe?.getAttribute("sandbox")).toBe("allow-same-origin");
    // Setas trocam o modelo (Segmentado) e o título do quadro acompanha.
    const marcado = secao?.querySelector("[role='radio'][aria-checked='true']");
    if (!marcado) throw new Error("sem opção marcada");
    await teclar(marcado, "ArrowRight");
    expect(iframe?.getAttribute("title")).toContain("eliminado");
    expect(previa()).toContain('data-modelo="ELIMINADO"');
  });
});

describe("editor do espelho: teclado e foco", () => {
  it("Ctrl+S salva quando há mudança válida", async () => {
    const rpc = rpcFalso();
    await montar(rpc);
    const titulo = campo("titulo");
    await teclar(titulo, "s", { ctrlKey: true });
    expect(rpc).toHaveBeenCalledTimes(1); // nada mudou: não salva
    expect(document.body.textContent).toContain("Textos padrão");

    await digitar(titulo, "Espelho fictício");
    expect(document.body.textContent).toContain("Alterações não salvas");
    await teclar(titulo, "s", { ctrlKey: true });
    await esperar();
    expect(rpc).toHaveBeenLastCalledWith("salvar_modelo_espelho_nota", {
      p_edital: "e900",
      p_textos: { titulo: "Espelho fictício" },
      p_versao_atual: 4,
    });
    expect(document.body.textContent).toContain("Modelo salvo (versão 5)");
  });

  it("Inserir {candidato} põe o marcador onde está o cursor", async () => {
    await montar(rpcFalso());
    const saudacao = campo("saudacao");
    await digitar(saudacao, "Olá, !");
    saudacao.setSelectionRange(5, 5);
    await clicar(botao("inserir-candidato-saudacao"));
    expect(saudacao.value).toBe("Olá, {candidato}!");
    expect(previa()).toContain("Olá, <strong>Maria Exemplo da Silva</strong>!");
    expect(botao("inserir-candidato-titulo")).toBeNull();
  });

  it("o resumo de erros leva o foco ao primeiro campo inválido", async () => {
    await montar(rpcFalso());
    await digitar(campo("secao_notas"), "");
    await digitar(campo("titulo"), "");
    const ir = botao("modelo-espelho-ir-ao-erro");
    expect(ir?.textContent).toContain("2 campos com erro");
    expect(botao("modelo-espelho-salvar")?.disabled).toBe(true);
    await clicar(ir);
    expect(document.activeElement).toBe(campo("titulo"));
    expect(campo("titulo").getAttribute("aria-invalid")).toBe("true");
  });

  it("Imprimir exemplo manda a folha da prévia para a impressão", async () => {
    const imprimir = vi.fn();
    await montar(rpcFalso(), imprimir);
    await clicar(botao("modelo-espelho-imprimir"));
    expect(imprimir).toHaveBeenCalledWith(previa());
    expect(imprimir.mock.calls[0]?.[0]).toContain("@page { size: A4;");
  });

  it("quem não coordena só lê: campos travados, sem salvar nem inserir", async () => {
    await montar(rpcFalso({ podeEditar: false }));
    expect(campo("titulo").disabled).toBe(true);
    expect(botao("modelo-espelho-salvar")).toBeNull();
    expect(botao("inserir-candidato-saudacao")).toBeNull();
    expect(document.body.textContent).toContain("Somente leitura");
  });
});

describe("editor do espelho: CSS responsivo e só com tokens", () => {
  const css = readFileSync(
    "src/modulos/avaliacao-documental/espelho-editor.css",
    "utf8",
  ).replace(/\/\*[\s\S]*?\*\//g, "");

  it("duas colunas na tela larga, uma na estreita, prévia fixa ao rolar", () => {
    expect(css).toMatch(
      /@media \(min-width: 1000px\) \{\s*\.avd-modelo-espelho-corpo \{\s*grid-template-columns: minmax\(320px, 5fr\) minmax\(0, 7fr\);/,
    );
    expect(css).toMatch(
      /\.avd-modelo-espelho-corpo \{[^}]*grid-template-columns: minmax\(0, 1fr\);/,
    );
    expect(css).toContain("position: sticky;");
    expect(css).toContain("@container (max-width: 640px)");
  });

  it("cores só por token (tema escuro), foco visível e sem !important nem #id", () => {
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
    expect(css).not.toContain("!important");
    expect(css).not.toMatch(/(^|[\s,{])#[a-z]/im);
    expect(css).toContain("outline: 2px solid var(--focus-ring)");
    expect(css).toContain("prefers-reduced-motion: no-preference");
  });

  it("o CSS do editor mora num lugar só", () => {
    const daTela = readFileSync(
      "src/modulos/avaliacao-documental/avaliacao-documental.css",
      "utf8",
    );
    expect(daTela).not.toContain(".avd-modelo-espelho");
  });
});
