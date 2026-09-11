import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync("src/analises/index.html", "utf8");
const layout = readFileSync("src/analises/analises-filter-layout.js", "utf8");

/*
  O texto do painel descrevia o mecanismo interno, não o efeito.

  Dizia "Use estes filtros somente para reduzir o recorte já carregado. A base do
  Supabase não é alterada." — três problemas num parágrafo: "recorte já
  carregado" é vocabulário de implementação, "somente" soa como limitação, e
  "Supabase" é o nome do banco, que não diz nada a quem analisa currículos.

  O texto novo diz o que acontece na tela: os filtros refinam, e indicadores,
  gráficos e fila acompanham.

  São duas fontes porque `ensureStructure()` reescreve o `.hint` do HTML no
  arranque. A do HTML é a que aparece antes de o módulo correr; se as duas se
  separarem, a pessoa vê um texto e depois outro.
*/
const TEXTO =
  "Use os filtros para refinar as análises exibidas. Indicadores, gráficos e a fila são atualizados conforme o recorte selecionado.";

const semEspacos = (texto) => texto.replace(/\s+/g, " ");

describe("o texto do painel de filtros", () => {
  it("é o novo, no módulo que reescreve o hint", () => {
    expect(semEspacos(layout)).toContain(TEXTO);
  });

  it("é o mesmo no HTML, que é o que aparece antes do módulo", () => {
    expect(semEspacos(html)).toContain(TEXTO);
  });

  it("o texto antigo não sobrou em lugar nenhum", () => {
    for (const fonte of [html, layout]) {
      expect(semEspacos(fonte)).not.toContain(
        "Use estes filtros somente para reduzir o recorte já carregado",
      );
      expect(semEspacos(fonte)).not.toContain("não alteram a base no Supabase");
    }
  });
});

/*
  Supabase é o nome do banco. Aparecer na tela não ajuda ninguém a analisar
  currículos, e convida a pergunta errada quando algo falha.
*/
describe("nenhuma terminologia de Supabase visível ao usuário", () => {
  /*
    Só o texto que a pessoa lê. Atributos como `src` e `data-*` apontam para o
    serviço de verdade e não são copy — procurá-los acusaria a infraestrutura,
    não a interface.
  */
  const textoVisivel = (documento) =>
    documento
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<[^>]+>/g, " ");

  it("o HTML do painel não mostra a palavra", () => {
    expect(textoVisivel(html)).not.toMatch(/supabase/i);
  });

  /*
    No módulo, o que vai para a tela são as atribuições de `textContent` e
    `innerHTML`. O resto do ficheiro pode citar o banco num comentário sem
    problema — e cita.
  */
  it("o módulo não escreve a palavra na tela", () => {
    const escritas = [
      ...layout.matchAll(
        /\.(?:textContent|innerHTML)\s*=\s*([\s\S]{0,400}?);/g,
      ),
    ].map((m) => m[1]);
    expect(escritas.length).toBeGreaterThan(0);
    for (const escrita of escritas) {
      expect(escrita, `escreve Supabase na tela: ${escrita}`).not.toMatch(
        /supabase/i,
      );
    }
  });
});
