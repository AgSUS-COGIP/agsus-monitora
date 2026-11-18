// @vitest-environment jsdom
import { bloco } from "./apoio/bloco.ts";
import { readFileSync } from "node:fs";
import { describe, expect, it, afterEach, vi, beforeEach } from "vitest";
import { avisoGlobal } from "../src/lib/base/aviso-global";
import { htmlDaPagina } from "./pagina-montada.ts";
import {
  act,
  createElement,
  StrictMode,
  createElement as h,
  useState,
} from "react";
import { montarTela, montarPortaisNoTeste } from "./montar-tela.ts";
import { criarAutomacao } from "../src/modulos/automacao/automacao.tsx";
import { clicar, digitar, esperar } from "./componentes/interacoes.ts";
import {
  AVISO_DO_PAINEL_CARREGANDO,
  AVISO_DO_PAINEL_ERRO,
  AVISO_DO_PAINEL_PRONTO,
  DEMORA_DO_PAINEL_MS,
  ESPERA_MAXIMA_DO_PAINEL_MS,
  origensParaPreconectar,
  rotuloDoCarregamento,
  servicoDoPainel,
} from "../src/lib/paineis/carregamento-do-painel.ts";
import { acompanharCarregamentoDoPainel } from "../src/modulos/paineis-externos/carregamento-do-painel.tsx";
import { createRoot } from "react-dom/client";
import { EVENTO_EDITAL_CONCLUIDO } from "../src/lib/encerramento-do-edital/encerramento-do-edital.ts";
import { EncerramentoDoEdital } from "../src/modulos/encerramento-do-edital/encerramento-do-edital.tsx";
import { criarEstadoDoEncerramento } from "../src/modulos/encerramento-do-edital/estado.ts";
import {
  MarcaDeSeloNoAvatar,
  SelosDoEdital,
} from "../src/modulos/encerramento-do-edital/selos-do-edital.tsx";
import {
  erroDoNomeDaVersao,
  nomeDaVersaoNaLista,
  nomeParaGravar,
  normalizarNomeDaVersao,
  partesDaVersao,
  rotuloDaVersao,
  rotuloDaVersaoNaLista,
  sugerirNomeDaVersao,
  trechoDoMotivo,
} from "../src/lib/base/nome-da-versao.ts";
import {
  CampoNomeDaVersao,
  NomeDaVersao,
  nomeDoCampo,
  RenomearVersao,
} from "../src/ui/index.ts";

bloco("aviso-global", () => {
  describe("aviso global", () => {
    it("fica oculto quando não há mensagem configurada", () => {
      expect(avisoGlobal({ mensagem: "", tipo: "info" }).visivel).toBe(false);
      expect(avisoGlobal({}).visivel).toBe(false);
    });

    it("trata mensagem só de espaços como ausência de aviso", () => {
      expect(avisoGlobal({ mensagem: "   " }).visivel).toBe(false);
    });

    it("aparece com a mensagem aparada quando há texto", () => {
      const aviso = avisoGlobal({ mensagem: "  Manutenção às 18h  " });
      expect(aviso.visivel).toBe(true);
      expect(aviso.mensagem).toBe("Manutenção às 18h");
    });

    it("traduz os três tipos para as variantes de .alert", () => {
      const classe = (tipo) => avisoGlobal({ mensagem: "x", tipo }).classe;
      expect(classe("info")).toBe("alert broadcast-bar");
      expect(classe("warning")).toBe("alert broadcast-bar warn");
      expect(classe("danger")).toBe("alert broadcast-bar error");
    });

    it("aceita o tipo em qualquer caixa e com espaços", () => {
      expect(avisoGlobal({ mensagem: "x", tipo: " DANGER " }).classe).toBe(
        "alert broadcast-bar error",
      );
    });

    /*
    Se o tipo vier fora da lista — chave editada à mão no banco, valor de uma
    versão futura — a mensagem ainda precisa aparecer. Errar a cor é menos grave
    que engolir o recado.
  */
    it("mostra o aviso mesmo com tipo desconhecido", () => {
      const aviso = avisoGlobal({ mensagem: "Atenção", tipo: "roxo" });
      expect(aviso.visivel).toBe(true);
      expect(aviso.classe).toBe("alert broadcast-bar");
    });

    it("não quebra com valores que não são texto", () => {
      expect(avisoGlobal({ mensagem: null, tipo: null }).visivel).toBe(false);
      expect(avisoGlobal({ mensagem: 42, tipo: 7 }).mensagem).toBe("42");
    });
  });

  describe("ligação do aviso global com a interface", () => {
    const html = htmlDaPagina();
    const app = readFileSync("src/app/configuracao.ts", "utf8");

    it("tem no HTML o elemento que recebe o aviso", () => {
      expect(html).toContain('id="broadcastBar"');
      expect(html).toContain('role="status"');
    });

    /*
    A posição importa: a barra de offline é `position: fixed` no topo. Se o aviso
    também fosse fixo, um cobriria o outro exatamente quando os dois importam.
  */
    it("posiciona o aviso entre o cabeçalho e o conteúdo", () => {
      const depoisDoCabecalho =
        html.indexOf("broadcastBar") > html.indexOf("</header>");
      const antesDoConteudo =
        html.indexOf("broadcastBar") < html.indexOf('<div class="content">');
      expect(depoisDoCabecalho && antesDoConteudo).toBe(true);
    });

    /*
    Este é o teste que pega a regressão original: o aviso era gravado e relido no
    formulário, mas nada o aplicava à interface.
  */
    it("aplica o aviso sempre que a configuração é aplicada", () => {
      const aplica = app.slice(
        app.indexOf("function aplicarNaTela() {"),
        app.indexOf("const consulta = () =>"),
      );
      expect(aplica).toContain("aplicarAvisoGlobal()");
    });

    it("escreve o aviso como texto, nunca como marcação", () => {
      const fn = app.slice(
        app.indexOf("function aplicarAvisoGlobal() {"),
        app.indexOf("function aplicarNaTela() {"),
      );
      expect(fn).toContain("barra.textContent =");
      expect(fn).not.toMatch(/.innerHTMLs*=/);
    });
  });
});

bloco("modulos/automacao", () => {
  /*
  Configurações › Automação (20261022190000): só o administrador global vê;
  cada chave mostra estado, última e próxima execução e quem mudou; ligar e
  desligar pede motivo de verdade (15 a 500 caracteres, 3 palavras, sem
  teclado batido; 20261103213000) e vai por alterar_chave_da_automacao; as
  recusas do banco aparecem em português; a função que falta é dita.
*/

  const ADMIN = { id: "u", ativo: true, admin_global: true };
  const COMUM = { id: "c", ativo: true, admin_global: false };

  const CHAVES = (entrevistasLigada = false) => ({
    schema_version: 1,
    gerado_em: "2026-10-22T14:00:00Z",
    cron_disponivel: true,
    chaves: [
      {
        chave: "entrevistas",
        nome: "Entrevistas",
        ligada: entrevistasLigada,
        motivo: entrevistasLigada
          ? "Volta da carga de hora em hora"
          : "Já estava desligada no pg_cron, pausa de propósito desde 16/10/2026",
        em: "2026-10-22T13:00:00Z",
        por: "Gestão da Informação de Pessoal",
        tarefas: [
          {
            nome: "agsus_robo_sincronizar_entrevistas",
            agenda: "5 * * * *",
            ativa: entrevistasLigada,
            ultima: { inicio: "2026-10-16T10:05:00Z", situacao: "succeeded" },
          },
        ],
      },
      {
        chave: "conferencias",
        nome: "Conferências",
        ligada: true,
        motivo: "Estado inicial (migração 20261022190000).",
        em: "2026-10-22T13:00:00Z",
        por: null,
        tarefas: [
          // Parada direto no banco com a chave ligada.
          {
            nome: "agsus_robo_conferencias",
            agenda: "0 9 * * *",
            ativa: false,
            ultima: null,
          },
        ],
      },
    ],
    sem_chave: [
      {
        nome: "agsus_robo_conferir_disparos",
        agenda: "*/5 * * * *",
        ativa: true,
      },
    ],
    historico: [
      {
        chave: "entrevistas",
        ligada: false,
        motivo: "Já estava desligada no pg_cron",
        em: "2026-10-22T13:00:00Z",
        por: "Gestão da Informação de Pessoal",
        tarefas: [],
      },
    ],
  });

  let raiz;
  let controlador;

  async function montar({ perfil = ADMIN, rpc } = {}) {
    raiz = document.createElement("div");
    document.body.append(raiz);
    const supabase = {
      rpc: vi.fn(
        rpc ||
          (async (nome) =>
            nome === "obter_chaves_da_automacao"
              ? { data: CHAVES(), error: null }
              : {
                  data: null,
                  error: { code: "XX000", message: "inesperado" },
                }),
      ),
    };
    const toast = vi.fn();
    await act(async () => {
      controlador = montarTela(criarAutomacao, "", {
        secao: raiz,
        supabase,
        getProfile: () => perfil,
        toast,
      });
    });
    await act(async () => {
      await controlador.render();
    });
    await esperar();
    return { supabase, toast };
  }

  const linha = (chave) => raiz.querySelector(`[data-chave="${chave}"]`);
  const botao = (onde, texto) =>
    [...onde.querySelectorAll("button")].find(
      (b) => b.textContent.trim() === texto,
    );

  afterEach(() => {
    act(() => controlador?.raiz?.unmount());
    raiz?.remove();
    document.body.innerHTML = "";
  });

  describe("Configurações › Automação", () => {
    it("lista as chaves com estado, última, próxima, quem mudou e o histórico", async () => {
      await montar();
      const entrevistas = linha("entrevistas");
      expect(entrevistas.textContent).toContain("Desligada pelo administrador");
      expect(entrevistas.textContent).toContain(
        "Não roda enquanto estiver desligada",
      );
      expect(entrevistas.textContent).toContain(
        "Gestão da Informação de Pessoal",
      );
      expect(entrevistas.textContent).toContain(
        "pausa de propósito desde 16/10/2026",
      );
      expect(entrevistas.textContent).toContain("concluída");
      expect(botao(entrevistas, "Ligar")).toBeTruthy();
      const conferencias = linha("conferencias");
      expect(conferencias.textContent).toContain("Ligada");
      expect(conferencias.textContent).toContain(
        "Parada direto no banco: agsus_robo_conferencias.",
      );
      expect(raiz.textContent).toContain("Sempre ligadas");
      expect(raiz.textContent).toContain("agsus_robo_conferir_disparos");
      expect(raiz.textContent).toContain("Histórico");
    });

    it("o cálculo pelo Python ligado com a Classificação em Python desligada avisa que não tem efeito", async () => {
      const dados = CHAVES();
      dados.chaves.push(
        {
          chave: "classificacao",
          nome: "Classificação em Python",
          ligada: false,
          motivo: "Pausa do Python",
          tarefas: [],
        },
        {
          chave: "classificacao_calculo",
          nome: "Gerar listas pelo Python",
          ligada: true,
          motivo: "Depois da publicação do 114/2026",
          tarefas: [],
        },
      );
      await montar({
        rpc: async (nome) =>
          nome === "obter_chaves_da_automacao"
            ? { data: dados, error: null }
            : { data: null, error: { code: "XX000", message: "inesperado" } },
      });
      expect(linha("classificacao_calculo").textContent).toContain(
        'Sem efeito enquanto "Classificação em Python" estiver desligada',
      );
      expect(linha("classificacao").textContent).not.toContain("Sem efeito");
    });

    it("ligar pede motivo de verdade (mostra a regra) e manda a chave ao banco", async () => {
      const { supabase, toast } = await montar({
        rpc: async (nome) =>
          nome === "obter_chaves_da_automacao"
            ? { data: CHAVES(), error: null }
            : { data: CHAVES(true), error: null },
      });
      await clicar(botao(linha("entrevistas"), "Ligar"));
      const campo = raiz.querySelector("#automacaoMotivo-entrevistas");
      expect(raiz.textContent).toContain(
        "Uma frase com pelo menos 15 caracteres e 3 palavras.",
      );
      for (const lixo of ["curto", "sadasdsadsadasdas", "testegcgbgfbg"]) {
        await digitar(campo, lixo);
        await clicar(botao(linha("entrevistas"), "Ligar"));
        expect(raiz.textContent).toContain(
          "Escreva o motivo numa frase de verdade.",
        );
      }
      expect(supabase.rpc).not.toHaveBeenCalledWith(
        "alterar_chave_da_automacao",
        expect.anything(),
      );

      await digitar(campo, "  Volta da carga de hora em hora  ");
      await clicar(botao(linha("entrevistas"), "Ligar"));
      await esperar();
      expect(supabase.rpc).toHaveBeenCalledWith("alterar_chave_da_automacao", {
        p_chave: "entrevistas",
        p_ligar: true,
        p_motivo: "Volta da carga de hora em hora",
      });
      expect(linha("entrevistas").textContent).toContain("Ligada");
      expect(raiz.querySelector("#automacaoMotivo-entrevistas")).toBeNull();
      expect(toast).toHaveBeenCalledWith("Entrevistas: automação ligada.");
    });

    it("desligar: a recusa do banco aparece em português e relê no 55000", async () => {
      let leituras = 0;
      await montar({
        rpc: async (nome) => {
          if (nome === "obter_chaves_da_automacao") {
            leituras += 1;
            return { data: CHAVES(), error: null };
          }
          return {
            data: null,
            error: { code: "55000", message: "já desligada" },
          };
        },
      });
      await clicar(botao(linha("conferencias"), "Desligar"));
      await digitar(
        raiz.querySelector("#automacaoMotivo-conferencias"),
        "Conferências em revisão",
      );
      await clicar(botao(linha("conferencias"), "Desligar"));
      await esperar();
      expect(raiz.textContent).toContain(
        "Outra pessoa já mudou esta automação.",
      );
      expect(leituras).toBe(2);
    });

    it("quem não é administrador global não vê nem consulta", async () => {
      const { supabase } = await montar({ perfil: COMUM });
      expect(raiz.textContent).toContain(
        "Só o administrador global liga e desliga a automação.",
      );
      expect(supabase.rpc).not.toHaveBeenCalled();
    });

    it("sem a função no banco, diz qual migration falta", async () => {
      await montar({
        rpc: async () => ({
          data: null,
          error: { code: "PGRST202", message: "not found" },
        }),
      });
      expect(raiz.textContent).toContain("20261022190000");
    });
  });
});

bloco("modulos/carregamento-do-painel", () => {
  /*
  A cobertura do painel externo (src/modulos/paineis-externos/): o que está
  carregando até o `load` do iframe, a demora aos 20 s com "Abrir em nova
  aba" e o erro.
*/

  globalThis.IS_REACT_ACT_ENVIRONMENT = true;

  const LOOKER =
    "https://datastudio.google.com/embed/reporting/55b4277a/page/14ECG";

  describe("regras do carregamento do painel", () => {
    it("o nome do serviço sai do endereço", () => {
      expect(servicoDoPainel(LOOKER)).toBe("Looker Studio");
      expect(
        servicoDoPainel("https://lookerstudio.google.com/embed/reporting/x"),
      ).toBe("Looker Studio");
      expect(servicoDoPainel("https://app.powerbi.com/view?r=x")).toBe(
        "Power BI",
      );
      expect(servicoDoPainel("https://bi.exemplo/rh")).toBeNull();
      expect(servicoDoPainel("javascript:alert(1)")).toBeNull();
    });

    it("o rótulo diz o serviço quando o conhece", () => {
      expect(rotuloDoCarregamento(LOOKER)).toBe(
        "Carregando o painel do Looker Studio…",
      );
      expect(rotuloDoCarregamento("https://bi.exemplo/rh")).toBe(
        "Carregando o painel…",
      );
    });

    it("pré-conexão: a origem do painel e, no Looker Studio, as estáticas do Google", () => {
      expect(origensParaPreconectar(LOOKER)).toEqual([
        "https://datastudio.google.com",
        "https://www.gstatic.com",
        "https://fonts.googleapis.com",
        "https://fonts.gstatic.com",
      ]);
      expect(origensParaPreconectar("https://bi.exemplo/rh?x=1")).toEqual([
        "https://bi.exemplo",
      ]);
      expect(origensParaPreconectar("")).toEqual([]);
      expect(origensParaPreconectar("ftp://x")).toEqual([]);
    });
  });

  describe("cobertura do painel externo", () => {
    let holder;
    let quadro;
    let desmontar;
    let desmontarPortais;
    const cobertura = () => holder.querySelector(".carregamento-do-painel");
    const texto = () => cobertura()?.textContent ?? "";
    const avancar = async (ms) => {
      await act(async () => {
        vi.advanceTimersByTime(ms);
      });
    };
    const disparar = async (alvo, evento) => {
      await act(async () => {
        alvo.dispatchEvent(evento);
      });
    };
    const avisar = (tipo, source = quadro.contentWindow) =>
      disparar(window, new MessageEvent("message", { data: { tipo }, source }));
    const montar = (opcoes = {}) => {
      act(() => {
        desmontar = acompanharCarregamentoDoPainel(holder, {
          endereco: LOOKER,
          ...opcoes,
        });
      });
    };

    beforeEach(() => {
      vi.useFakeTimers();
      holder = document.createElement("div");
      holder.className = "external-panel";
      quadro = document.createElement("iframe");
      holder.append(quadro);
      document.body.replaceChildren(holder);
      // A cobertura é um portal da raiz do app (src/app/portais-avulsos.tsx).
      desmontarPortais = montarPortaisNoTeste();
    });

    afterEach(() => {
      act(() => desmontar?.());
      desmontarPortais();
      vi.useRealTimers();
    });

    it("mostra o que está carregando, com o giro, até o load do iframe", async () => {
      montar();
      expect(cobertura()).not.toBeNull();
      expect(texto()).toContain("Carregando o painel do Looker Studio…");
      expect(cobertura().querySelector("[role='status']")).not.toBeNull();
      expect(cobertura().querySelector(".botao-girando")).not.toBeNull();
      expect(texto()).not.toContain("demorando");
      await disparar(quadro, new Event("load"));
      // Folga para o painel dizer que ainda está a carregar os dados.
      await avancar(300);
      expect(cobertura().classList).toContain("carregamento-do-painel--saindo");
      await avancar(200);
      expect(cobertura()).toBeNull();
      // O iframe fica: as próximas aberturas são na hora.
      expect(holder.querySelector("iframe")).toBe(quadro);
    });

    it("aos 20 s avisa a demora, com Abrir em nova aba e Tentar novamente", async () => {
      const aoTentarDeNovo = vi.fn();
      montar({ aoTentarDeNovo });
      await avancar(DEMORA_DO_PAINEL_MS - 1);
      expect(texto()).not.toContain("Está demorando mais que o normal");
      await avancar(1);
      expect(texto()).toContain("Carregando o painel do Looker Studio…");
      expect(texto()).toContain("Está demorando mais que o normal.");
      const link = [...cobertura().querySelectorAll("a")].find(
        (a) => a.textContent === "Abrir em nova aba",
      );
      expect(link.href).toBe(LOOKER);
      expect(link.target).toBe("_blank");
      expect(link.rel).toBe("noopener noreferrer");
      const tentar = [...cobertura().querySelectorAll("button")].find(
        (b) => b.textContent === "Tentar novamente",
      );
      await act(async () => tentar.click());
      expect(aoTentarDeNovo).toHaveBeenCalledOnce();
      // Carregou depois da demora: sai do mesmo jeito.
      await disparar(quadro, new Event("load"));
      await avancar(300);
      await avancar(200);
      expect(cobertura()).toBeNull();
    });

    it("carregou antes da demora: o aviso não aparece depois", async () => {
      montar();
      await disparar(quadro, new Event("load"));
      await avancar(300);
      await avancar(200);
      expect(cobertura()).toBeNull();
      await avancar(30_000);
      expect(holder.textContent).not.toContain("demorando");
    });

    it("erro do iframe: a mensagem e as saídas, sem o giro", async () => {
      montar({ aoTentarDeNovo: () => {} });
      await disparar(quadro, new Event("error"));
      expect(cobertura().querySelector("[role='alert']")).not.toBeNull();
      expect(texto()).toContain("Não foi possível carregar o painel.");
      expect(texto()).toContain("Abrir em nova aba");
      expect(texto()).toContain("Tentar novamente");
      expect(cobertura().querySelector(".botao-girando")).toBeNull();
      // A demora não troca o erro de volta.
      await avancar(DEMORA_DO_PAINEL_MS);
      expect(texto()).toContain("Não foi possível carregar o painel.");
    });

    it("sem conexão: o erro", async () => {
      montar();
      await disparar(window, new Event("offline"));
      expect(texto()).toContain("Não foi possível carregar o painel.");
    });

    describe("painel que avisa (Apps Script)", () => {
      const saindo = () =>
        cobertura()?.classList.contains("carregamento-do-painel--saindo");

      it("avisou que está a carregar: a cobertura fica até o pronto", async () => {
        montar();
        await avisar(AVISO_DO_PAINEL_CARREGANDO);
        await disparar(quadro, new Event("load"));
        await avancar(5_000);
        expect(saindo()).toBe(false);
        await avisar(AVISO_DO_PAINEL_PRONTO);
        expect(saindo()).toBe(true);
      });

      it("o aviso de erro do painel mostra o erro", async () => {
        montar();
        await avisar(AVISO_DO_PAINEL_ERRO);
        expect(texto()).toContain("Não foi possível carregar o painel.");
      });

      it("aceita o aviso de um iframe dentro do iframe", async () => {
        const interno = quadro.contentDocument.createElement("iframe");
        quadro.contentDocument.body.append(interno);
        montar();
        await avisar(AVISO_DO_PAINEL_PRONTO, interno.contentWindow);
        expect(saindo()).toBe(true);
      });

      it("ignora aviso que não veio deste painel", async () => {
        const outro = document.createElement("iframe");
        document.body.append(outro);
        montar();
        await avisar(AVISO_DO_PAINEL_PRONTO, outro.contentWindow);
        await avisar(AVISO_DO_PAINEL_PRONTO, null);
        expect(saindo()).toBe(false);
      });

      it("avisou e travou: a cobertura sai depois da espera máxima", async () => {
        montar();
        await avisar(AVISO_DO_PAINEL_CARREGANDO);
        await disparar(quadro, new Event("load"));
        await avancar(ESPERA_MAXIMA_DO_PAINEL_MS - 1_000);
        expect(saindo()).toBe(false);
        await avancar(1_000);
        expect(saindo()).toBe(true);
      });
    });

    it("descartado antes de carregar: a cobertura sai com o quadro", () => {
      montar();
      act(() => desmontar());
      expect(cobertura()).toBeNull();
      expect(holder.querySelector(".carregamento-do-painel-raiz")).toBeNull();
    });

    it("sem iframe (painel em manutenção ou sem endereço), não cobre nada", () => {
      holder.replaceChildren();
      montar();
      expect(cobertura()).toBeNull();
    });

    it("o app liga a cobertura ao criar o iframe do painel", () => {
      const paineis = readFileSync("src/app/paineis-externos.ts", "utf8");
      const inicio = paineis.indexOf("function montarQuadro(holder");
      const corpo = paineis.slice(
        inicio,
        paineis.indexOf("function removerQuadro(", inicio),
      );
      expect(
        corpo.indexOf("acompanharCarregamentoDoPainel(holder"),
      ).toBeGreaterThan(corpo.indexOf('createElement("iframe")'));
    });
  });
});

bloco("modulos/encerramento-do-edital", () => {
  /*
  Tela de encerramento do edital: abre uma vez (o visto vai ao banco), com os
  totais e só a parte de quem vê; fogos do catálogo uma vez, nenhum para quem
  já viu o edital zerar, os próprios para quem fechou. Selos no perfil. Sem
  edital encerrado (ou sem a RPC), nada aparece.
*/

  const edital = (parte = {}) => ({
    id: "e114",
    edital: "114/2026",
    numero: "114/2026",
    area: "projetos",
    concluido_em: "2026-10-22T18:00:00Z",
    inscritos: 7726,
    fichas: 1512,
    dias: 9,
    visto: false,
    minha: {
      fichas: 50,
      percentual: 3.3,
      melhor_dia: { dia: "2026-10-21", qt: 20 },
      fechou: false,
    },
    ...parte,
  });

  /* O banco de mentira: depois do visto, a leitura já diz visto. */
  function clienteFalso(resposta) {
    const chamadas = [];
    const vistos = new Set();
    return {
      chamadas,
      rpc: vi.fn(async (nome, argumentos) => {
        chamadas.push([nome, argumentos]);
        if (nome === "marcar_encerramento_visto") {
          vistos.add(argumentos.p_edital);
          return { data: true, error: null };
        }
        const editais = resposta.data?.editais;
        return Array.isArray(editais)
          ? {
              ...resposta,
              data: {
                editais: editais.map((e) =>
                  vistos.has(e.id) ? { ...e, visto: true } : e,
                ),
              },
            }
          : resposta;
      }),
    };
  }

  let raizes = [];
  const hosts = [];

  async function montar(componente) {
    const host = document.createElement("div");
    document.body.append(host);
    hosts.push(host);
    const raiz = createRoot(host);
    raizes.push(raiz);
    await act(async () => {
      raiz.render(createElement(StrictMode, null, componente));
    });
    return host;
  }

  afterEach(() => {
    act(() => raizes.forEach((r) => r.unmount()));
    hosts.splice(0).forEach((h) => h.remove());
    raizes = [];
  });

  const tela = () => document.querySelector(".encerramento");

  describe("tela de encerramento", () => {
    it("sem edital encerrado, ou sem a RPC no banco, nada aparece", async () => {
      for (const resposta of [
        { data: { editais: [] }, error: null },
        { data: null, error: { code: "PGRST202" } },
      ]) {
        const cliente = clienteFalso(resposta);
        const estado = criarEstadoDoEncerramento({
          cliente: () => cliente,
          ligadas: () => true,
        });
        const comemorar = vi.fn();
        await montar(
          createElement(EncerramentoDoEdital, { estado, comemorar }),
        );
        await act(() => estado.verificar());
        expect(tela()).toBeNull();
        expect(comemorar).not.toHaveBeenCalled();
      }
    });

    it("abre uma vez com totais e só a parte de quem vê; fechar grava o visto", async () => {
      const cliente = clienteFalso({
        data: { editais: [edital()] },
        error: null,
      });
      const estado = criarEstadoDoEncerramento({
        cliente: () => cliente,
        ligadas: () => true,
      });
      const comemorar = vi.fn();
      await montar(createElement(EncerramentoDoEdital, { estado, comemorar }));
      await act(() => estado.verificar());

      const t = tela();
      expect(t.querySelector("h2").textContent).toBe(
        "Edital 114/2026 concluído",
      );
      const kpis = [...t.querySelectorAll(".ui-kpi")].map((k) => k.textContent);
      expect(kpis).toEqual([
        "Inscritos7.726",
        "Fichas analisadas1.512",
        "Dias de análise9",
      ]);
      expect(t.textContent).toContain("Obrigado, equipe.");
      const minha = [...t.querySelectorAll(".encerramento-minha dd")].map(
        (d) => d.textContent,
      );
      expect(minha).toEqual(["50", "3,3%", "21/10 · 20 fichas"]);
      expect(t.querySelector(".encerramento-fechou")).toBeNull();
      // Fogos do marco, uma vez (mesmo com o StrictMode).
      expect(comemorar).toHaveBeenCalledTimes(1);
      expect(comemorar).toHaveBeenCalledWith({
        marco: "edital-concluido",
        forma: "coracao",
        texto: "Edital 114/2026 concluído.",
      });

      await act(async () =>
        clicar(t.querySelector(".encerramento-acoes .btn")),
      );
      expect(tela()).toBeNull();
      expect(cliente.chamadas).toContainEqual([
        "marcar_encerramento_visto",
        { p_edital: "e114" },
      ]);
      // Visto: não abre de novo.
      await act(() => estado.verificar());
      expect(estado.obter().aberto).toBeNull();
    });

    it("uma leitura que já estava a caminho não reabre o que a pessoa fechou", async () => {
      let soltarLeitura;
      const resposta = { data: { editais: [edital()] }, error: null };
      const cliente = {
        chamadas: [],
        rpc: vi.fn(async (nome) => {
          cliente.chamadas.push(nome);
          if (nome === "marcar_encerramento_visto")
            return { data: null, error: { message: "fora do ar" } };
          if (cliente.chamadas.filter((n) => n === nome).length === 1)
            return resposta;
          // A segunda leitura demora e volta com o visto ainda não gravado.
          return new Promise((ok) => {
            soltarLeitura = () => ok(resposta);
          });
        }),
      };
      const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
      const estado = criarEstadoDoEncerramento({
        cliente: () => cliente,
        ligadas: () => true,
      });
      await estado.verificar();
      expect(estado.obter().aberto?.id).toBe("e114");
      const leitura = estado.verificar();
      await estado.fechar();
      // O erro do visto vai para o console (a tela volta na próxima entrada).
      expect(aviso).toHaveBeenCalled();
      soltarLeitura();
      await leitura;
      expect(estado.obter().aberto).toBeNull();
      // Nem uma leitura nova reabre nesta página.
      const nova = estado.verificar();
      soltarLeitura();
      await nova;
      expect(estado.obter().aberto).toBeNull();
      expect(estado.obter().encerramentos[0].visto).toBe(true);
      aviso.mockRestore();
    });

    it("já visto (outro navegador, dia seguinte): não abre", async () => {
      const cliente = clienteFalso({
        data: { editais: [edital({ visto: true })] },
        error: null,
      });
      const estado = criarEstadoDoEncerramento({
        cliente: () => cliente,
        ligadas: () => true,
      });
      await montar(
        createElement(EncerramentoDoEdital, { estado, comemorar: vi.fn() }),
      );
      await act(() => estado.verificar());
      expect(tela()).toBeNull();
      expect(estado.obter().encerramentos).toHaveLength(1);
    });

    it("comemorações desligadas no sistema: não abre nem marca", async () => {
      const cliente = clienteFalso({
        data: { editais: [edital()] },
        error: null,
      });
      const estado = criarEstadoDoEncerramento({
        cliente: () => cliente,
        ligadas: () => false,
      });
      await montar(
        createElement(EncerramentoDoEdital, { estado, comemorar: vi.fn() }),
      );
      await act(() => estado.verificar());
      expect(tela()).toBeNull();
      expect(cliente.chamadas.map((c) => c[0])).toEqual([
        "obter_encerramentos_do_edital",
      ]);
    });

    it("quem viu o edital zerar na tela de Análises não ganha os fogos de novo", async () => {
      const cliente = clienteFalso({
        data: { editais: [edital()] },
        error: null,
      });
      const estado = criarEstadoDoEncerramento({
        cliente: () => cliente,
        ligadas: () => true,
      });
      const desligar = estado.acompanhar(window);
      const comemorar = vi.fn();
      await montar(createElement(EncerramentoDoEdital, { estado, comemorar }));
      await act(async () => {
        window.dispatchEvent(
          new CustomEvent(EVENTO_EDITAL_CONCLUIDO, {
            detail: { editais: ["114/2026"] },
          }),
        );
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(tela()).not.toBeNull();
      expect(comemorar).not.toHaveBeenCalled();
      desligar();
    });

    it("quem fechou: título e animação própria", async () => {
      const cliente = clienteFalso({
        data: {
          editais: [
            edital({ minha: { fichas: 2, percentual: 0.1, fechou: true } }),
          ],
        },
        error: null,
      });
      const estado = criarEstadoDoEncerramento({
        cliente: () => cliente,
        ligadas: () => true,
      });
      const comemorar = vi.fn();
      await montar(createElement(EncerramentoDoEdital, { estado, comemorar }));
      await act(() => estado.verificar());
      expect(tela().querySelector(".encerramento-fechou").textContent).toBe(
        "Você fechou o 114",
      );
      expect(comemorar).toHaveBeenCalledWith(
        expect.objectContaining({ marco: "edital-fechado", forma: "estrela" }),
      );
    });
  });

  describe("selos do edital", () => {
    it("um selo por edital encerrado; quem fechou leva o título; marca no avatar", async () => {
      const cliente = clienteFalso({
        data: {
          editais: [
            edital({ visto: true }),
            edital({
              id: "e93",
              numero: "93/2026",
              concluido_em: "2026-11-01",
              visto: true,
              minha: { fichas: 1, fechou: true },
            }),
          ],
        },
        error: null,
      });
      const estado = criarEstadoDoEncerramento({ cliente: () => cliente });
      const lista = await montar(createElement(SelosDoEdital, { estado }));
      const avatar = await montar(
        createElement(MarcaDeSeloNoAvatar, { estado }),
      );
      expect(lista.textContent).toBe("");
      expect(avatar.textContent).toBe("");
      await act(() => estado.verificar());
      expect(
        [...lista.querySelectorAll(".selo-do-edital")].map(
          (s) => s.textContent,
        ),
      ).toEqual(["114/2026", "93/2026fechou o 93"]);
      expect(
        avatar
          .querySelector(".selo-no-avatar-marca")
          .getAttribute("aria-label"),
      ).toBe("Você fechou o edital 93");
      // Saiu da sessão: nada fica.
      act(() => estado.esquecer());
      expect(lista.querySelector(".selo-do-edital")).toBeNull();
    });
  });
});

bloco("nome-da-versao", () => {
  /*
  O nome das versões das regras (avaliação documental, classificação e
  roteiro): exibição "Nome · v7" / "Versão 7", a sugestão do campo ao salvar e
  o diálogo de renomear (só o nome, com motivo).
*/

  describe("exibição: nome em destaque, número discreto", () => {
    it("com nome: 'Nome · v7'; sem nome: 'Versão 7'", () => {
      expect(rotuloDaVersao({ versao: 7, nome: "Decisão CORES" })).toBe(
        "Decisão CORES · v7",
      );
      expect(rotuloDaVersao({ versao: 7, nome: null })).toBe("Versão 7");
      expect(rotuloDaVersao({ versao: 7, nome: "   " })).toBe("Versão 7");
      expect(rotuloDaVersao({ versao: "3" })).toBe("Versão 3");
      expect(rotuloDaVersao(null)).toBe("");
      expect(partesDaVersao({ versao: 2, nome: "Banca" })).toEqual({
        nome: "Banca",
        numero: "v2",
      });
      expect(partesDaVersao({ versao: 2 })).toEqual({
        nome: null,
        numero: "Versão 2",
      });
    });

    it("acha o nome pelo número no histórico (versões antigas sem nome continuam)", () => {
      const versoes = [
        { versao: 3, nome: "Decisão CORES" },
        { versao: 2, nome: null },
        { versao: 1 },
      ];
      expect(nomeDaVersaoNaLista(versoes, 3)).toBe("Decisão CORES");
      expect(nomeDaVersaoNaLista(versoes, 2)).toBeNull();
      expect(rotuloDaVersaoNaLista(versoes, "3")).toBe("Decisão CORES · v3");
      expect(rotuloDaVersaoNaLista(versoes, 1)).toBe("Versão 1");
      expect(rotuloDaVersaoNaLista(null, 5)).toBe("Versão 5");
    });
  });

  describe("nome: validação e o que vai para o banco", () => {
    it("3 a 80 caracteres, espaços normalizados; vazio = sem nome", () => {
      expect(normalizarNomeDaVersao("  Regra   do  edital ")).toBe(
        "Regra do edital",
      );
      expect(erroDoNomeDaVersao("")).toBe("");
      expect(erroDoNomeDaVersao("ab")).toBe("De 3 a 80 caracteres.");
      expect(erroDoNomeDaVersao("x".repeat(81))).toBe("De 3 a 80 caracteres.");
      expect(erroDoNomeDaVersao("abc")).toBe("");
      expect(nomeParaGravar("   ")).toBeNull();
      expect(nomeParaGravar(" Decisão  CORES ")).toBe("Decisão CORES");
      expect(nomeDoCampo(null, "Sugestão")).toBe("Sugestão");
      expect(nomeDoCampo("", "Sugestão")).toBe("");
    });
  });

  describe("sugestão automática", () => {
    it("edital + começo do motivo, com a inicial minúscula (menos sigla)", () => {
      expect(
        sugerirNomeDaVersao({
          tipo: "regra",
          edital: "93/2026",
          motivo: "Decisão CORES de 07/10: aceitar o diploma estrangeiro",
        }),
      ).toBe("Regra do edital 93/2026 – decisão CORES de 07/10");
      expect(trechoDoMotivo("CORES decidiu manter o corte. Outra frase")).toBe(
        "CORES decidiu manter o corte",
      );
      expect(
        sugerirNomeDaVersao({
          tipo: "classificacao",
          edital: "93/2026",
          motivo: "",
        }),
      ).toBe("Classificação do edital 93/2026");
      expect(sugerirNomeDaVersao({ tipo: "regra" })).toBe("Regra da avaliação");
    });

    it("roteiro: o nome dele e a data; nunca passa de 80", () => {
      expect(
        sugerirNomeDaVersao({
          tipo: "roteiro",
          roteiro: "Entrevista individual",
          data: new Date("2026-10-08T15:00:00Z"),
        }),
      ).toBe("Entrevista individual – 08/10/2026");
      const longa = sugerirNomeDaVersao({
        tipo: "regra",
        edital: "93/2026",
        motivo: "palavra ".repeat(40),
      });
      expect(longa.length).toBeLessThanOrEqual(80);
      expect(erroDoNomeDaVersao(longa)).toBe("");
      const roteiroLongo = sugerirNomeDaVersao({
        tipo: "roteiro",
        roteiro: "Roteiro ".repeat(20),
        data: new Date(),
      });
      expect(roteiroLongo.length).toBeLessThanOrEqual(80);
    });
  });

  let raiz = null;
  async function montar(elemento) {
    document.body.innerHTML = `<div id="raiz"></div>`;
    await act(async () => {
      raiz = createRoot(document.getElementById("raiz"));
      raiz.render(elemento);
    });
  }
  afterEach(async () => {
    await act(async () => raiz?.unmount());
    raiz = null;
    document.body.innerHTML = "";
  });

  describe("componentes", () => {
    it("NomeDaVersao: nome forte e número discreto; trocas no título", async () => {
      await montar(
        h("div", null, [
          h(NomeDaVersao, {
            key: 1,
            versao: 7,
            nome: "Decisão CORES",
            trocas: [
              { de: "Antigo", para: "Decisão CORES", motivo: "Mais claro" },
            ],
          }),
          h(NomeDaVersao, { key: 2, versao: 2 }),
        ]),
      );
      const [com, sem] = document.querySelectorAll(".ui-nome-da-versao");
      expect(com.querySelector("strong").textContent).toBe("Decisão CORES");
      expect(com.querySelector(".ui-nome-da-versao-numero").textContent).toBe(
        "· v7",
      );
      expect(com.querySelector("[data-trocas]").title).toContain("“Antigo”");
      expect(sem.textContent).toBe("Versão 2");
      expect(sem.querySelector(".ui-nome-da-versao-numero")).toBeNull();
    });

    it("CampoNomeDaVersao: vem com a sugestão e aceita edição", async () => {
      function Teste() {
        const [valor, setValor] = useState(null);
        return h("div", null, [
          h(CampoNomeDaVersao, {
            key: "c",
            valor,
            sugestao: "Regra do edital 93/2026",
            aoMudar: setValor,
            mostrarErro: true,
          }),
          h(
            "output",
            { key: "o" },
            nomeDoCampo(valor, "Regra do edital 93/2026"),
          ),
        ]);
      }
      await montar(h(Teste));
      const campo = document.querySelector("[data-campo='nome-da-versao']");
      expect(campo.value).toBe("Regra do edital 93/2026");
      await digitar(campo, "ab");
      expect(document.querySelector(".ui-campo-erro").textContent).toContain(
        "De 3 a 80",
      );
      await digitar(campo, "Decisão CORES");
      expect(document.querySelector("output").textContent).toBe(
        "Decisão CORES",
      );
      expect(document.querySelector(".ui-campo-erro")).toBeNull();
    });

    it("RenomearVersao: pede motivo, recusa nome igual e manda só nome e motivo", async () => {
      const aoRenomear = vi.fn(async () => ({ ok: true }));
      await montar(
        h(RenomearVersao, { versao: 3, nome: "Antigo", aoRenomear }),
      );
      await clicar(document.querySelector("[data-acao='renomear-versao']"));
      const [nome, motivo] = document.querySelectorAll(".modal input");
      expect(nome.value).toBe("Antigo");
      await clicar(
        document.querySelector("[data-acao='salvar-nome-da-versao']"),
      );
      expect(aoRenomear).not.toHaveBeenCalled();
      expect(document.body.textContent).toContain("O nome não mudou.");
      expect(document.body.textContent).toContain("De 10 a 500 caracteres.");
      await digitar(nome, "  Decisão   CORES ");
      await digitar(motivo, "Nome mais claro para a banca");
      await clicar(
        document.querySelector("[data-acao='salvar-nome-da-versao']"),
      );
      expect(aoRenomear).toHaveBeenCalledWith(
        "Decisão CORES",
        "Nome mais claro para a banca",
      );
      expect(document.querySelector(".modal")).toBeNull();
    });

    it("RenomearVersao: nome vazio tira o nome; erro do banco fica no diálogo", async () => {
      const aoRenomear = vi.fn(async () => ({
        ok: false,
        erro: "Sem permissão",
      }));
      await montar(
        h(RenomearVersao, { versao: 3, nome: "Antigo", aoRenomear }),
      );
      await clicar(document.querySelector("[data-acao='renomear-versao']"));
      const [nome, motivo] = document.querySelectorAll(".modal input");
      await digitar(nome, "");
      await digitar(motivo, "Volta a ficar sem nome");
      await clicar(
        document.querySelector("[data-acao='salvar-nome-da-versao']"),
      );
      expect(aoRenomear).toHaveBeenCalledWith(null, "Volta a ficar sem nome");
      expect(document.querySelector(".modal").textContent).toContain(
        "Sem permissão",
      );
    });
  });
});
