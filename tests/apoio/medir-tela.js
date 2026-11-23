/*
  A medição da auditoria visual (tests/auditoria-visual.spec.js): uma função
  que roda dentro da página (`page.evaluate(medirTela, opcoes)`) e devolve o
  que está fora da norma (docs/design-system-agsus.md, seções 4, 5, 16 e 17):

  - rolagem horizontal da página e quem a causa;
  - elemento que passa do pai, conteúdo cortado e texto com reticências;
  - alvo de toque menor que 44 × 44 px (só quando `toque` é verdadeiro);
  - fonte fora da escala de `--text-*` e peso fora de 400/500/600;
  - margin, padding e gap fora da escala de `--space-*`;
  - cor calculada que não é o valor de nenhum token de cor;
  - botão, selo, cartão, tabela e campo feitos à mão onde existe o de src/ui/.

  Cada achado vem com a "assinatura" do elemento (tag e as duas primeiras
  classes) e, para os mais repetidos, a regra CSS que deu o valor: é por ela
  que se corrige na fonte, uma vez. A função não pode usar nada de fora dela
  (o Playwright a serializa).
*/

export function medirTela({ toque, limiteDeOrigens = 60 }) {
  const vw = window.innerWidth;
  const ESCALA_DE_FONTE = [12, 13, 14, 16, 18, 20, 22, 28, 36];
  const ESCALA_DE_ESPACO = [0, 2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80];
  const PESOS = ["400", "500", "600"];
  /* Classes dos componentes da norma: src/ui/ (`ui-*`) e as do DS 11 no legado. */
  const CLASSE_DE_COMPONENTE =
    /^(ui-|btn$|btn-|card$|table-card$|modal$|modal-card$|chip$|alert$)/;
  /* O que não se mede: mapa, gráfico, ícones e a própria marca. */
  const FORA =
    "svg, canvas, iframe, .leaflet-container, .leaflet-pane, .sr-only, [aria-hidden='true'] *, script, style, noscript, template";

  const achados = {
    rolagem: null,
    transbordaPai: [],
    cortado: [],
    reticencias: [],
    toque: [],
    fonte: [],
    peso: [],
    espaco: [],
    cor: [],
    feitoAMao: [],
  };

  const assinatura = (el) => {
    const classes = [...el.classList]
      .filter((c) => !/^(is-|has-|active|aberto|ativo|show)/.test(c))
      .slice(0, 2);
    const id = el.id && !classes.length ? `#${el.id}` : "";
    return `${el.tagName.toLowerCase()}${id}${classes.map((c) => `.${c}`).join("")}`;
  };
  const caminho = (el) => {
    const partes = [];
    let atual = el;
    for (let i = 0; atual && atual !== document.body && i < 4; i += 1) {
      partes.unshift(assinatura(atual));
      atual = atual.parentElement;
    }
    return partes.join(" > ");
  };
  const textoCurto = (el) =>
    (el.innerText || el.value || el.getAttribute("aria-label") || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 50);

  const px = (valor) => Number.parseFloat(valor) || 0;
  const naEscala = (valor, escala) =>
    escala.some((v) => Math.abs(Math.abs(valor) - v) <= 0.5);

  /* Visível e com tamanho: o resto não aparece na tela. */
  const visiveis = [...document.body.querySelectorAll("*")].filter((el) => {
    if (el.closest(FORA)) return false;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== "hidden" && cs.display !== "none";
  });
  const estilos = new Map(visiveis.map((el) => [el, getComputedStyle(el)]));
  const caixas = new Map(
    visiveis.map((el) => [el, el.getBoundingClientRect()]),
  );
  const estilo = (el) => estilos.get(el) || getComputedStyle(el);
  const caixa = (el) => caixas.get(el) || el.getBoundingClientRect();
  /* Fora da janela, de lado (gaveta fechada, menu recolhido), não se mede. */
  const todos = visiveis.filter((el) => {
    const r = caixa(el);
    return r.right > 0 && r.left < vw;
  });

  /*
    Onde está: "camada" (modal, gaveta, diálogo), "tela" (o conteúdo da
    página, em .main .content) ou "moldura" (barra lateral, cabeçalho,
    avisos, Aya): a moldura se repete em todas as telas e se corrige uma vez.
  */
  const regiao = (el) => {
    if (el.closest(".modal.show, .ui-gaveta, [role=dialog], [aria-modal=true]"))
      return "camada";
    if (el.closest(".main .content")) return "tela";
    return "moldura";
  };

  /* Um ancestral que recorta (overflow ≠ visible) esconde o que passa dele. */
  const recortadoPorAncestral = (el) => {
    for (
      let p = el.parentElement;
      p && p !== document.body;
      p = p.parentElement
    ) {
      const cs = getComputedStyle(p);
      if (cs.overflowX !== "visible" || cs.position === "fixed") return true;
    }
    return false;
  };
  const posicaoSolta = (cs) =>
    cs.position === "absolute" || cs.position === "fixed";

  /*
    1. Rolagem horizontal. O `body` tem `overflow-x: hidden` (app.css): quando
    algo passa da janela, a página não rola, e o que sobra fica cortado, fora
    de alcance. Conta-se o elemento que começa dentro da janela e termina fora
    dela sem nenhum ancestral (além de html e body) que o recorte, além do
    `scrollWidth` da página.
  */
  const larguraDaPagina = document.documentElement.scrollWidth;
  const alem = visiveis.filter((el) => {
    const r = caixa(el);
    if (r.right <= vw + 1 || r.left >= vw - 1) return false;
    if (estilo(el).position === "fixed") return false;
    return !recortadoPorAncestral(el);
  });
  if (alem.length || larguraDaPagina > vw + 1) {
    const conjunto = new Set(alem);
    // O culpado é o primeiro da cadeia: o pai dele ainda cabe.
    const culpados = alem
      .filter((el) => !conjunto.has(el.parentElement))
      .slice(0, 8)
      .map((el) => ({
        el: assinatura(el),
        caminho: caminho(el),
        regiao: regiao(el),
        direita: Math.round(caixa(el).right),
      }));
    const direita = Math.max(
      larguraDaPagina,
      ...alem.map((el) => Math.round(caixa(el).right)),
    );
    achados.rolagem = {
      largura: direita,
      janela: vw,
      // Sem largura a mais no documento: cortado sem rolagem possível.
      escondidaPeloBody: larguraDaPagina <= vw + 1,
      culpados,
    };
  }

  for (const el of todos) {
    const cs = estilo(el);
    const r = caixa(el);
    const pai = el.parentElement;

    // 2a. Passa do pai (em fluxo, pai sem recorte): o pai não segura o filho.
    if (
      pai &&
      pai !== document.body &&
      !posicaoSolta(cs) &&
      cs.display !== "inline"
    ) {
      const csPai = estilo(pai);
      const rp = caixa(pai);
      if (
        csPai.overflowX === "visible" &&
        csPai.display !== "inline" &&
        r.width > 0 &&
        r.right > rp.right + 2 &&
        rp.width > 0
      )
        achados.transbordaPai.push({
          el: assinatura(el),
          regiao: regiao(el),
          pai: assinatura(pai),
          excesso: Math.round(r.right - rp.right),
        });
    }

    // 2b. Conteúdo cortado: recorta (hidden/clip) e o conteúdo é mais largo.
    const recorta = cs.overflowX === "hidden" || cs.overflowX === "clip";
    // Menos de 16px de largura é rótulo escondido de propósito (barra recolhida).
    if (
      recorta &&
      el.scrollWidth > el.clientWidth + 1 &&
      el.clientWidth >= 16 &&
      px(cs.opacity) > 0
    ) {
      const comReticencias = cs.textOverflow === "ellipsis";
      const temTextoInteiro =
        el.hasAttribute("title") ||
        el.closest("[title]") !== null ||
        el.hasAttribute("aria-label");
      (comReticencias ? achados.reticencias : achados.cortado).push({
        el: assinatura(el),
        regiao: regiao(el),
        caminho: caminho(el),
        texto: textoCurto(el),
        // Reticências sem `title` escondem o texto de quem não tem mouse.
        intencional: comReticencias && temTextoInteiro,
      });
    }

    // 4. Fonte e peso, só em quem tem texto próprio.
    const textoProprio = [...el.childNodes].some(
      (n) => n.nodeType === 3 && n.textContent.trim(),
    );
    if (textoProprio) {
      const tamanho = px(cs.fontSize);
      if (!naEscala(tamanho, ESCALA_DE_FONTE))
        achados.fonte.push({
          el: assinatura(el),
          regiao: regiao(el),
          valor: `${+tamanho.toFixed(2)}px`,
        });
      const peso = String(cs.fontWeight);
      if (!PESOS.includes(peso))
        achados.peso.push({
          el: assinatura(el),
          regiao: regiao(el),
          valor: peso,
        });
    }

    // 5. Espaçamentos. Margens laterais iguais são centralização (auto).
    const lados = ["Top", "Right", "Bottom", "Left"];
    const margemAuto =
      cs.marginLeft === cs.marginRight &&
      px(cs.marginLeft) > 0 &&
      cs.display === "block";
    for (const lado of lados) {
      if (!(margemAuto && (lado === "Left" || lado === "Right"))) {
        const m = px(cs[`margin${lado}`]);
        if (!naEscala(m, ESCALA_DE_ESPACO))
          achados.espaco.push({
            el: assinatura(el),
            regiao: regiao(el),
            prop: `margin-${lado.toLowerCase()}`,
            valor: `${+m.toFixed(2)}px`,
          });
      }
      const p = px(cs[`padding${lado}`]);
      if (!naEscala(p, ESCALA_DE_ESPACO))
        achados.espaco.push({
          el: assinatura(el),
          regiao: regiao(el),
          prop: `padding-${lado.toLowerCase()}`,
          valor: `${+p.toFixed(2)}px`,
        });
    }
    if (/flex|grid/.test(cs.display))
      for (const [prop, valor] of [
        ["row-gap", cs.rowGap],
        ["column-gap", cs.columnGap],
      ])
        if (valor !== "normal" && !naEscala(px(valor), ESCALA_DE_ESPACO))
          achados.espaco.push({
            el: assinatura(el),
            regiao: regiao(el),
            prop,
            valor: `${+px(valor).toFixed(2)}px`,
          });
  }

  // 3. Alvos de toque: controles com menos de 44 × 44 px.
  if (toque) {
    const controles = document.querySelectorAll(
      "a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab], [role=checkbox], [role=switch], [role=menuitem], [role=option]",
    );
    for (const el of controles) {
      if (el.closest(FORA) && !el.closest(".leaflet-control")) continue;
      if (el.disabled) continue;
      // A caixa de marcar dentro do rótulo conta pelo rótulo.
      const alvo =
        el.matches("input[type=checkbox], input[type=radio]") &&
        el.closest("label")
          ? el.closest("label")
          : el;
      const r = alvo.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || r.right <= 0 || r.left >= vw)
        continue;
      const cs = getComputedStyle(alvo);
      if (cs.visibility === "hidden" || px(cs.opacity) === 0) continue;
      // Link dentro de frase é exceção da WCAG 2.5.8.
      if (el.tagName === "A" && cs.display === "inline" && el.closest("p, li"))
        continue;
      if (r.width < 43.5 || r.height < 43.5)
        achados.toque.push({
          el: assinatura(alvo),
          regiao: regiao(alvo),
          caminho: caminho(alvo),
          tamanho: `${Math.round(r.width)}×${Math.round(r.height)}`,
          texto: textoCurto(el),
        });
    }
  }

  // 6. Cores: o valor calculado de cada token de cor, no tema da página.
  const nomesDeToken = new Set();
  const lerRegras = (regras) => {
    for (const regra of regras) {
      if (regra.cssRules) lerRegras(regra.cssRules);
      if (regra.style)
        for (let i = 0; i < regra.style.length; i += 1) {
          const nome = regra.style[i];
          if (nome.startsWith("--")) nomesDeToken.add(nome);
        }
    }
  };
  for (const folha of document.styleSheets) {
    try {
      lerRegras(folha.cssRules);
    } catch {
      /* folha de outra origem: não se lê */
    }
  }
  const sonda = document.createElement("i");
  const fundoDaSonda = document.createElement("b");
  fundoDaSonda.style.color = "rgb(1, 2, 3)";
  fundoDaSonda.appendChild(sonda);
  document.body.appendChild(fundoDaSonda);
  const coresDeToken = new Set();
  const listaDeToken = [];
  /* `rgb()`/`rgba()` e `color(srgb …)` (o que o color-mix calcula). */
  const rgba = (texto) => {
    const srgb = texto.match(/color\(srgb ([^)]+)\)/);
    if (srgb) {
      const [r, g, b, a = "1"] = srgb[1].split(/[ /]+/).filter(Boolean);
      return [+r * 255, +g * 255, +b * 255, +a];
    }
    const m = texto.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const [r, g, b, a = "1"] = m[1].split(/[ ,/]+/).filter(Boolean);
    return [+r, +g, +b, +a];
  };
  for (const nome of nomesDeToken) {
    sonda.style.color = "";
    sonda.style.color = `var(${nome})`;
    const valor = getComputedStyle(sonda).color;
    if (valor === "rgb(1, 2, 3)") continue;
    coresDeToken.add(valor);
    const canais = rgba(valor);
    if (canais) listaDeToken.push(canais);
  }
  fundoDaSonda.remove();
  const perto = (valor) => {
    const c = rgba(valor);
    if (!c) return false;
    // Mesmo tom com outra transparência (color-mix com transparent) também é derivada.
    return listaDeToken.some(
      (t) =>
        (Math.abs(t[3] - c[3]) < 0.05 || t[3] === 1) &&
        Math.abs(t[0] - c[0]) <= 8 &&
        Math.abs(t[1] - c[1]) <= 8 &&
        Math.abs(t[2] - c[2]) <= 8,
    );
  };
  const transparente = (valor) =>
    valor === "transparent" ||
    /rgba\([^)]*,\s*0\)$/.test(valor) ||
    / \/ 0\)$/.test(valor);
  /* A cor da barra lateral vem de Configurações → Aparência (exceção aceita). */
  const corDaBarra = (el) =>
    el.closest("#sidebar, .sidebar, aside.nav, nav#nav") !== null;
  const conferirCor = (el, prop, valor) => {
    if (!valor || transparente(valor) || coresDeToken.has(valor)) return;
    achados.cor.push({
      el: assinatura(el),
      regiao: regiao(el),
      prop,
      valor,
      derivada: perto(valor),
      barra: corDaBarra(el),
    });
  };
  for (const el of todos) {
    const cs = estilo(el);
    const textoProprio = [...el.childNodes].some(
      (n) => n.nodeType === 3 && n.textContent.trim(),
    );
    if (textoProprio) conferirCor(el, "color", cs.color);
    conferirCor(el, "background-color", cs.backgroundColor);
    for (const lado of ["Top", "Right", "Bottom", "Left"])
      if (
        px(cs[`border${lado}Width`]) > 0 &&
        cs[`border${lado}Style`] !== "none"
      ) {
        conferirCor(el, "border-color", cs[`border${lado}Color`]);
        break;
      }
  }

  // 7. Componentes feitos à mão onde existe o de src/ui/.
  const temClasseDeComponente = (el) =>
    [...el.classList].some((c) => CLASSE_DE_COMPONENTE.test(c));
  const dentroDeComponente = (el, seletor) => el.closest(seletor) !== null;
  const pintado = (cs) =>
    !transparente(cs.backgroundColor) ||
    (px(cs.borderTopWidth) > 0 &&
      cs.borderTopStyle !== "none" &&
      !transparente(cs.borderTopColor));
  for (const el of todos) {
    const cs = estilo(el);
    const r = caixa(el);
    const tag = el.tagName;
    let tipo = "";
    if (
      (tag === "BUTTON" ||
        el.getAttribute("role") === "button" ||
        (tag === "A" && pintado(cs))) &&
      pintado(cs) &&
      !temClasseDeComponente(el) &&
      !dentroDeComponente(
        el,
        ".leaflet-control, .ui-segmentado, .ui-abas, .ui-menu",
      )
    )
      tipo = "botão";
    else if (
      tag === "TABLE" &&
      !el.matches(".ui-tabela") &&
      !dentroDeComponente(el, ".ui-tabela, .ui-tabela-rolagem, .table-card")
    )
      tipo = "tabela";
    else if (
      (tag === "SELECT" ||
        el.matches(
          "input[type=search], input[type=text], input:not([type])",
        )) &&
      !dentroDeComponente(
        el,
        ".ui-campo, .ui-filtros, .ui-barra-busca, .ui-barra-da-lista, .ui-tabela-busca, .ui-popover, .modal",
      )
    )
      tipo = "campo";
    else if (
      /inline/.test(cs.display) &&
      r.height <= 30 &&
      r.width < 220 &&
      !transparente(cs.backgroundColor) &&
      px(cs.borderTopLeftRadius) >= Math.min(8, r.height / 2) &&
      el.innerText?.trim() &&
      !el.matches("a, button, input, select, label") &&
      !temClasseDeComponente(el) &&
      !dentroDeComponente(el, ".ui-selo, .ui-chip, .chip, button, a")
    )
      tipo = "selo";
    else if (
      /block|flex|grid/.test(cs.display) &&
      !/inline/.test(cs.display) &&
      r.width >= 120 &&
      r.height >= 56 &&
      px(cs.borderTopLeftRadius) >= 8 &&
      !transparente(cs.backgroundColor) &&
      px(cs.borderTopWidth) > 0 &&
      !temClasseDeComponente(el) &&
      // Linha de tabela no modo cartão (≤ 900px) é o padrão de mobile-table-cards.css.
      !el.matches(
        "button, a, input, select, textarea, dialog, header, nav, aside, body, main, tr, td, th",
      ) &&
      !dentroDeComponente(el.parentElement || el, ".leaflet-control")
    )
      tipo = "cartão";
    if (tipo)
      achados.feitoAMao.push({
        tipo,
        el: assinatura(el),
        regiao: regiao(el),
        caminho: caminho(el),
      });
  }

  // A regra CSS de onde vem o valor, para os achados mais repetidos.
  const regrasPlanas = [];
  const achatar = (regras, condicao) => {
    for (const regra of regras) {
      if (regra.type === CSSRule.MEDIA_RULE) {
        if (window.matchMedia(regra.media.mediaText).matches)
          achatar(regra.cssRules, condicao);
      } else if (
        regra.type === CSSRule.SUPPORTS_RULE ||
        regra.cssRules?.length
      ) {
        if (regra.selectorText === undefined) achatar(regra.cssRules, condicao);
        else regrasPlanas.push(regra);
      } else if (regra.selectorText) regrasPlanas.push(regra);
    }
  };
  for (const folha of document.styleSheets) {
    try {
      achatar(folha.cssRules);
    } catch {
      /* outra origem */
    }
  }
  const PROP_DO_ACHADO = {
    fonte: () => ["font-size", "font", "font-size"],
    peso: () => ["font-weight", "font", "font-weight"],
    espaco: (a) => {
      const [tipo] = a.prop.split("-");
      return [
        a.prop,
        tipo === "row" || tipo === "column" ? "gap" : tipo,
        a.prop,
      ];
    },
    cor: (a) =>
      a.prop === "color"
        ? ["color", "color", "color"]
        : a.prop === "background-color"
          ? ["background-color", "background", "background-color"]
          : [
              "border-color",
              "border",
              "border-top-color",
              "border-right",
              "border-bottom",
              "border-left",
              "border-top",
              "border-right-color",
              "border-bottom-color",
              "border-left-color",
            ],
  };
  const exemplo = new Map();
  for (const tipo of Object.keys(PROP_DO_ACHADO)) {
    const contagem = new Map();
    for (const a of achados[tipo]) {
      const chave = `${a.el}|${a.prop || tipo}|${a.valor}`;
      contagem.set(chave, (contagem.get(chave) || 0) + 1);
    }
    const maisRepetidos = [...contagem.entries()]
      .sort((x, y) => y[1] - x[1])
      .slice(0, limiteDeOrigens)
      .map(([chave]) => chave);
    for (const chave of maisRepetidos) exemplo.set(`${tipo}:${chave}`, null);
  }
  const elementoDe = new Map();
  for (const el of todos) {
    const a = assinatura(el);
    if (!elementoDe.has(a)) elementoDe.set(a, el);
  }
  const origemDe = (el, props) => {
    if (props.some((p) => el.style.getPropertyValue(p)))
      return "style em linha (React)";
    /* A última que casa, em ordem do documento; com `!important`, a última
       importante (a especificidade não entra: é uma pista, não o cálculo). */
    let achada = "";
    let importante = "";
    for (const regra of regrasPlanas) {
      const define = props.filter((p) => regra.style.getPropertyValue(p));
      if (!define.length) continue;
      try {
        if (!el.matches(regra.selectorText)) continue;
      } catch {
        continue; // seletor que o matches não aceita
      }
      achada = regra.selectorText;
      if (
        define.some((p) => regra.style.getPropertyPriority(p) === "important")
      )
        importante = regra.selectorText;
    }
    if (importante) achada = `${importante} (!important)`;
    return achada || "padrão do navegador ou herdado";
  };
  for (const tipo of Object.keys(PROP_DO_ACHADO))
    for (const a of achados[tipo]) {
      const chave = `${tipo}:${a.el}|${a.prop || tipo}|${a.valor}`;
      if (!exemplo.has(chave)) continue;
      if (exemplo.get(chave) === null) {
        const el = elementoDe.get(a.el);
        exemplo.set(chave, el ? origemDe(el, PROP_DO_ACHADO[tipo](a)) : "");
      }
      a.origem = exemplo.get(chave);
    }

  return {
    janela: vw,
    elementos: todos.length,
    achados,
  };
}
