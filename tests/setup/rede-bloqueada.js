import { afterEach, beforeEach } from "vitest";

/*
  Nenhum teste unitário fala com a rede.

  Isto existe por causa de um acidente concreto: durante a validação de um
  preview criou-se um `.env.local` apontando para o Supabase de produção. O
  Vitest carrega as variáveis pelo Vite, de modo que `import.meta.env.VITE_*`
  passou a estar definida — e um teste que só verificava "uma falha não escreve
  no cache" começou a **chamar a produção de verdade**, receber a identidade real
  e gravá-la. O teste falhou, o que foi sorte: podia ter passado escrevendo em
  produção sem ninguém notar.

  A raiz não era o ficheiro: era o teste depender da **ausência** de ambiente
  para se comportar bem. Um teste assim engana — passa na máquina de quem não tem
  credencial e muda de comportamento na de quem tem.

  Aqui a rede é bloqueada por omissão. Quem precisa de uma resposta injecta o seu
  próprio `fetch` — como fazem os testes de branding público. Quem não injecta e
  tenta sair para a rede recebe um erro que **nomeia a URL**, em vez de alcançar
  silenciosamente o Supabase.
*/

const fetchOriginal = globalThis.fetch;

function urlDe(entrada) {
  if (typeof entrada === "string") return entrada;
  if (entrada instanceof URL) return entrada.href;
  return entrada?.url || "(desconhecida)";
}

beforeEach(() => {
  globalThis.fetch = (entrada) => {
    throw new Error(
      `Teste tentou falar com a rede: ${urlDe(entrada)}\n` +
        "Testes unitários não fazem chamadas reais. Injecte um `fetch` no teste " +
        "(veja tests/branding-publico.test.js) em vez de depender do ambiente.",
    );
  };
});

afterEach(() => {
  globalThis.fetch = fetchOriginal;
});
