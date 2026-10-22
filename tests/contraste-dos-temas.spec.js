import { expect, test } from "@playwright/test";

/*
  Contraste das peças comuns nos dois temas (e com a barra lateral clara ou
  escura), medido no navegador com a cascata inteira aplicada.

  Por que existe: no tema escuro, o balão das mensagens próprias do chat ficou
  quase branco com texto claro — os tokens oficiais `--color-*` não tinham
  valor escuro. `tests/cores-so-por-token.test.js` guarda a origem (cor literal
  nova, token sem valor escuro); este guarda o resultado na tela: monta uma
  vitrine com os pares de cor do sistema (botões, alertas, selos, campo,
  tabela, superfícies e estados oficiais) e mede a razão WCAG de cada texto
  contra o fundo efetivo (compondo as transparências dos ancestrais).

  Sem Supabase, como `aviso-global.spec.js`: a tela de acesso é dispensada pelo
  DOM; o que está sob teste é a folha de estilos, não a autenticação.
*/

const TEXTO = 4.5;

async function revelarShell(page) {
  await page.evaluate(() => {
    document.getElementById("loginScreen")?.classList.add("hidden");
    document.getElementById("appScreen")?.classList.remove("hidden");
    document.body.classList.remove("config-loading");
  });
}

async function aplicarTema(page, { escuro, barra }) {
  await page.evaluate(
    ({ escuro, barra }) => {
      const raiz = document.documentElement;
      raiz.setAttribute("data-theme", escuro ? "dark" : "");
      document.body.classList.toggle("dark-mode", escuro);
      raiz.style.setProperty("--sidebar-custom-bg", barra.cor);
      document.body.classList.toggle("sidebar-theme-dark", barra.escura);
    },
    { escuro, barra },
  );
}

/* A vitrine: cada peça com texto, no conteúdo do app (dentro de `.app`). */
const VITRINE = `
  <section class="card" data-vitrine>
    <button class="btn" data-peca="botão primário">Salvar</button>
    <button class="btn primary small" data-peca="botão primário pequeno">Registrar</button>
    <button class="btn secondary" data-peca="botão secundário">Filtrar</button>
    <button class="btn red" data-peca="botão vermelho">Excluir</button>
    <button class="btn ghost" data-peca="botão fantasma">Cancelar</button>
    <div class="alert" data-peca="alerta">Recado</div>
    <div class="alert ok" data-peca="alerta ok">Tudo certo</div>
    <div class="alert error" data-peca="alerta erro">Falhou</div>
    <div class="alert warn" data-peca="alerta atenção">Atenção</div>
    <span class="chip red" data-peca="selo vermelho">Vencido</span>
    <span class="chip green" data-peca="selo verde">Concluído</span>
    <span class="chip blue" data-peca="selo azul">Em análise</span>
    <span class="chip cyan" data-peca="selo ciano">Projeto</span>
    <span class="chip yellow" data-peca="selo amarelo">Pendente</span>
    <span class="chip gray" data-peca="selo cinza">Rascunho</span>
    <label data-peca="rótulo">Nome<input data-peca="campo" value="Maria" /></label>
    <a class="link" href="#" data-peca="link">Abrir</a>
    <table><thead><tr><th data-peca="cabeçalho de tabela">Edital</th></tr></thead>
      <tbody><tr><td data-peca="célula">001/2026</td></tr></tbody></table>
    <span class="ui-contagem" data-peca="contagem">3</span>
    <p style="background: var(--color-bg-selected); color: var(--color-text-primary)" data-peca="selecionado">Selecionado</p>
    <p style="background: var(--color-bg-selected); color: var(--text-primary)" data-peca="oficial com apelido (o defeito do chat)">Mensagem própria</p>
    <p style="background: var(--color-action-secondary); color: var(--color-action-secondary-text)" data-peca="ação secundária oficial">Secundário</p>
    <p style="background: var(--color-action-primary); color: var(--color-text-inverse)" data-peca="ação primária oficial">Primário</p>
    <p style="background: var(--color-action-danger); color: var(--color-text-inverse)" data-peca="perigo oficial">Perigo</p>
    <p style="background: var(--color-bg-subtle); color: var(--color-text-secondary)" data-peca="texto secundário oficial">Secundário</p>
    <p style="color: var(--color-text-brand)" data-peca="texto da marca">Marca</p>
    <p style="color: var(--color-text-link)" data-peca="link oficial">Link</p>
    <p style="background: var(--color-status-success-bg); color: var(--color-status-success-text)" data-peca="sucesso oficial">Sucesso</p>
    <p style="background: var(--color-status-warning-bg); color: var(--color-status-warning-text)" data-peca="atenção oficial">Atenção</p>
    <p style="background: var(--color-status-danger-bg); color: var(--color-status-danger-text)" data-peca="perigo de estado oficial">Perigo</p>
    <p style="background: var(--color-status-info-bg); color: var(--color-status-info-text)" data-peca="informação oficial">Info</p>
    <p style="background: var(--state-neutral); color: var(--text-inverse)" data-peca="neutro sólido">Início</p>
  </section>`;

async function montarVitrine(page) {
  await page.evaluate((html) => {
    const destino =
      document.querySelector("#appScreen .content") ||
      document.querySelector("#appScreen main") ||
      document.getElementById("appScreen");
    destino.querySelector("[data-vitrine]")?.remove();
    destino.insertAdjacentHTML("afterbegin", html);
  }, VITRINE);
}

/* Razão WCAG do texto de cada peça contra o fundo efetivo. */
async function medirPecas(page, seletor) {
  return page.evaluate((seletor) => {
    const canais = (cor) => {
      const m = cor.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const [r, g, b, a = 1] = m[1]
        .split(/[ ,/]+/)
        .filter(Boolean)
        .map(Number);
      return { r, g, b, a };
    };
    const sobre = (cima, baixo) => ({
      r: cima.r * cima.a + baixo.r * (1 - cima.a),
      g: cima.g * cima.a + baixo.g * (1 - cima.a),
      b: cima.b * cima.a + baixo.b * (1 - cima.a),
      a: 1,
    });
    const fundo = (el) => {
      const camadas = [];
      for (let no = el; no; no = no.parentElement) {
        const c = canais(getComputedStyle(no).backgroundColor);
        if (c && c.a > 0) camadas.push(c);
        if (c && c.a >= 1) break;
      }
      let cor = { r: 255, g: 255, b: 255, a: 1 };
      for (const camada of camadas.reverse()) cor = sobre(camada, cor);
      return cor;
    };
    const lum = ({ r, g, b }) => {
      const f = (v) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    return [...document.querySelectorAll(seletor)]
      .filter((el) => el.getClientRects().length)
      .map((el) => {
        const estilo = getComputedStyle(el);
        const atras = fundo(el);
        const texto = sobre(canais(estilo.color), atras);
        const [a, b] = [lum(texto), lum(atras)];
        return {
          peca: el.dataset.peca || el.className || el.tagName,
          razao: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
        };
      });
  }, seletor);
}

const CASOS = [
  {
    nome: "claro, barra clara",
    escuro: false,
    barra: { cor: "#ffffff", escura: false },
  },
  {
    nome: "claro, barra escura",
    escuro: false,
    barra: { cor: "#0b2a4a", escura: true },
  },
  {
    nome: "escuro, barra clara",
    escuro: true,
    barra: { cor: "#e8f0fe", escura: false },
  },
  {
    nome: "escuro, barra escura",
    escuro: true,
    barra: { cor: "#0b2a4a", escura: true },
  },
];

test.describe("contraste nos dois temas", () => {
  for (const caso of CASOS) {
    test(`peças comuns legíveis (${caso.nome})`, async ({ page }) => {
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await revelarShell(page);
      await aplicarTema(page, caso);
      await montarVitrine(page);

      const medidas = await medirPecas(page, "[data-vitrine] [data-peca]");
      expect(medidas.length).toBeGreaterThan(25);
      const ilegiveis = medidas
        .filter((m) => m.razao < TEXTO)
        .map((m) => `${m.peca}: ${m.razao.toFixed(2)}:1`);
      expect(ilegiveis, `abaixo de ${TEXTO}:1`).toEqual([]);
    });

    test(`barra lateral legível (${caso.nome})`, async ({ page }) => {
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await revelarShell(page);
      await aplicarTema(page, caso);

      const medidas = await medirPecas(
        page,
        ".sidebar .side-brand-copy strong, .sidebar .side-version",
      );
      const ilegiveis = medidas
        .filter((m) => m.razao < TEXTO)
        .map((m) => `${m.peca}: ${m.razao.toFixed(2)}:1`);
      expect(ilegiveis).toEqual([]);
    });
  }

  /*
    A tela de acesso tem paleta própria, clara nos dois temas: o aviso de erro
    dela não pode herdar os tokens escuros (saía rosa-claro sobre rosa-claro).
  */
  test("aviso da tela de acesso legível com a página no escuro", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => {
      document.documentElement.setAttribute("data-theme", "dark");
      const cartao = document.querySelector("#loginScreen .login-card");
      cartao.insertAdjacentHTML(
        "beforeend",
        '<div class="alert error" data-peca="erro do login">Falhou</div>' +
          '<div class="alert warn" data-peca="atenção do login">Atenção</div>',
      );
    });
    const medidas = await medirPecas(page, "#loginScreen [data-peca]");
    expect(medidas.length).toBe(2);
    expect(medidas.filter((m) => m.razao < TEXTO).map((m) => m.peca)).toEqual(
      [],
    );
  });
});
