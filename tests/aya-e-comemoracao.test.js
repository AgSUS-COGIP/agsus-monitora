// @vitest-environment node
import { bloco } from "./apoio/bloco.ts";
import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  criarAleatorio,
  paletaDosFogos,
  alfaDoRastro,
  APOTEOSE,
  avancarShow,
  brasa,
  brilhoDaParticula,
  centelhas,
  corDaParticula,
  criarShow,
  duracaoDoFormato,
  estourar,
  fatorDeSaida,
  FORMATOS,
  FORMATOS_DA_APOTEOSE,
  FORMATOS_DA_RAJADA,
  FORMATOS_DO_FINAL,
  fumacaDoEstouro,
  INTENSIDADES,
  intensidadeDoShow,
  lancarFoguete,
  LIMITE_DE_PARTICULAS,
  MARCO,
  moverFoguete,
  moverParticula,
  NOMES_DOS_FORMATOS,
  planejarShow,
  RAJADA,
  showAcabou,
  TOKENS_DAS_AREAS,
} from "../src/lib/comemoracao/fogos.ts";
import {
  arrastoDoConfete,
  batidaDoCoracao,
  brilhoDoMotor,
  desenharParticulas,
  envelopeDaChuva,
  lotesDaPeca,
  moverParticulaDoMotor,
  nascerLote,
  PICO_DA_CHUVA,
  suavizar,
  tamanhoNaProfundidade,
} from "../src/lib/comemoracao/particulas-do-motor.ts";
import {
  avancarCena,
  criarCena,
  cenaAcabou,
  CONFETE_DA_AYA,
  componentesDoEfeito,
  desenharParticulasDoMotor,
  DURACAO_PADRAO_MS,
  EFEITOS,
  efeitoChamaAya,
  efeitoComVeu,
  nivelDaIntensidade,
  normalizarDuracao,
  particulasDaCena,
} from "../src/lib/comemoracao/motor-de-efeitos.ts";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  compilarVerbetes,
  gerarModulo,
} from "../scripts/compilar-conhecimento-aya.mjs";
import { VERBETES_AYA } from "../src/modules/aya-conhecimento-gerado.js";
import { PERGUNTA_DO_INDICADOR } from "../src/lib/visao-geral/o-que-significa.ts";
import {
  consumirPerguntaParaAAya,
  perguntarParaAAya,
} from "../src/app/pergunta-para-a-aya.ts";
import {
  responderAya,
  buscarNaBase,
  LIMIAR_CONFIANTE,
  LIMIAR_INCERTO,
} from "../src/lib/aya/busca-da-aya.ts";
import {
  AYA_SOURCE_CATALOG,
  curatedAnswerForQuestion,
  officialSourcesForQuestion,
} from "../src/modules/aya-knowledge.ts";
import {
  esquecerConversa,
  lerConversa,
  limitarConversa,
  salvarConversa,
} from "../src/modules/aya-memoria.ts";
import {
  acaoDaAya,
  blocosDoTexto,
  caracteresRevelados,
  duracaoDaRevelacao,
  paginaDaAya,
  SECOES_DA_AYA,
  VIEWS_DA_AYA,
} from "../src/lib/aya/aya-paginas.ts";
import {
  ABAS_DO_MENU,
  AREAS_DO_SISTEMA,
  nomeDaArea,
} from "../src/lib/navegacao/menu-lateral.ts";
import { SECOES } from "../src/modulos/configuracoes/secoes.ts";
import {
  montarChamado,
  dataDeBrasilia,
  EMAIL_DO_SUPORTE_PADRAO,
  emailDoSuporte,
  emailValido,
  LIMITE_DO_CORPO,
  pedeSuporte,
  semDadosPessoais,
} from "../src/lib/aya/chamado-da-aya.ts";
import {
  comPassoDaTrilha,
  comTrilhaConcluida,
  PAGINAS_COM_TOUR,
  passoParaRetomar,
  posicaoDoBalao,
  progressoDasTrilhas,
  rotuloDoPasso,
  rotuloDoProgresso,
  tourDaPagina,
  trilhasDoPerfil,
  chaveDoTour,
  convitesFeitos,
  deveConvidar,
  geometriaDoHolofote,
  MARGEM_DO_HOLOFOTE,
} from "../src/lib/aya/aya-tours.ts";
import {
  bordaEncostada,
  ehBordaDaAya,
  ENCOSTO_PX,
  lerPosicaoDaAya,
  passoDaSeta,
  posicaoNaJanela,
  PASSO_DO_TECLADO_PX,
} from "../src/lib/aya/borda-da-aya.ts";
import {
  duracaoSAoDigitar,
  alteracoesDasComemoracoes,
  analisesConcluidasNoDia,
  CATALOGO_DE_MARCOS,
  CHAVE_DA_PREFERENCIA_PESSOAL,
  CHAVE_DAS_COMEMORACOES,
  comemoracoesPessoaisLigadas,
  configuracaoDasComemoracoes,
  contratadosDoEdital,
  decidirComemoracao,
  definirConfiguracaoDasComemoracoes,
  duracaoMsDasOpcoes,
  errosDaConfiguracao,
  estadoDosPersonalizados,
  guardarPreferenciaPessoal,
  hojeComoChave,
  maiorPersonalizado,
  marcoSoComAviso,
  mensagemDoPersonalizado,
  normalizarConfiguracao,
  normalizarDuracaoS,
  novoPersonalizado,
  opcoesDoMarco,
  personalizadosAlcancados,
  reservarEfeitoDoDia,
  CHAVE_DO_EFEITO_DO_DIA,
  serializarConfiguracao,
} from "../src/lib/comemoracao/catalogo-de-comemoracoes.ts";
import {
  buildChanges,
  CAMPOS_DAS_SECOES,
  errosDasSecoes,
  normalizarValoresCarregados,
  camposDaSecao,
} from "../src/lib/configuracoes/publicacao-de-configuracoes.ts";
import {
  intencaoDeConversa,
  textoDaConversa,
} from "../src/lib/aya/conversa-da-aya.ts";
import {
  cargasQuePedemAtencao,
  contarAnalises,
  contarEntrevistas,
  contarSelecao,
  responderComDados,
} from "../src/lib/aya/dados-da-aya.ts";
import {
  consumirPedidoDeFiltro,
  pedirFiltro,
} from "../src/app/pedido-de-filtro.ts";
import {
  filtrosDosAprovados,
  filtrosDaSelecao,
  filtrosDasAnalises,
  filtrosDeEntrevistas,
  filtrosDeRecursos,
  opcoesDoEdital,
} from "../src/lib/aya/filtro-da-aya.ts";
import { SEM_STATUS } from "../src/lib/aprovados/lista-aprovados-rules.ts";
import {
  CHAVE_DO_SOM,
  guardarSom,
  opacidadeDoVeu,
  podeTocarSom,
  pontoDaSoltura,
  posicaoDaAya,
  somDoEstouro,
  somLigado,
  trajetoDaAya,
  VOO_DA_AYA,
  DANCA_DA_AYA,
  dancaDaAya,
  posicaoNaDanca,
} from "../src/lib/comemoracao/fogos-cena.ts";
import {
  AJUSTE_DA_QUALIDADE,
  criarMedidor,
  QUADRO_IGNORADO_MS,
  QUADROS_PARA_DECIDIR,
  registrarQuadro,
} from "../src/modulos/comemoracao/desempenho.ts";
import {
  criarSom,
  JANELA_DAS_VOZES,
  VOZES_SIMULTANEAS,
} from "../src/modulos/comemoracao/som.ts";
import {
  ajustarPontos,
  caixaDaForma,
  contornoDaEstrela,
  contornoDoCoracao,
  FONTE_DE_PONTOS,
  normalizarForma,
  passoParaCaber,
  pontosDaForma,
  pontosDaImagem,
  pontosDoTextoNaFonte,
  reduzirPontos,
  tracoDoCheck,
} from "../src/lib/comemoracao/fogos-formas.ts";
import { DURACAO_DOS_FOGOS_MS } from "../src/lib/comemoracao/comemoracao.ts";
import {
  acaoDaIntencao,
  extrairEntidades,
  mesmoEdital,
  numeroDoEdital,
  reconhecerIntencao,
  textoDaIntencao,
} from "../src/lib/aya/intencoes-da-aya.ts";
import { criarFontesDaAya } from "../src/modulos/aya/fontes.ts";
import {
  comPerguntaSemResposta,
  LIMITE_DE_PERGUNTAS,
  limparPergunta,
  perguntasGuardadas,
  textoDasPerguntas,
} from "../src/lib/aya/perguntas-sem-resposta.ts";
import {
  acaoDaPergunta,
  explicarPermissao,
} from "../src/lib/aya/permissoes-da-aya.ts";
import {
  LIMITE_POR_BLOCO,
  chaveDoVisto,
  horaEmBrasilia,
  lerResumoDoDia,
  ondeDoItem,
  primeiroNome,
  quandoDoItem,
  recortarBloco,
  saudacao,
  semDemanda,
  tituloDoResumo,
  totalDoResumo,
} from "../src/lib/resumo-do-dia/resumo-do-dia.ts";
import {
  SINONIMOS,
  distancia,
  palavrasDe,
  radical,
  singular,
  termosDe,
  toleranciaPara,
} from "../src/lib/aya/termos-da-aya.ts";

bloco("animacoes-coreografadas", () => {
  /*
  As animações do motor (src/lib/comemoracao/particulas-do-motor.ts): roteiro em três
  atos (abertura, clímax, dispersão), níveis com diferença clara, confete em
  3D (o ar segura a folhinha de chapa), profundidade e desenho das de longe
  primeiro. Sorteio sempre com criarAleatorio(n).
*/

  const tela = { largura: 1280, altura: 720, escala: 1 };
  const cenaParaNascer = (semente = 1) => ({
    ...tela,
    aleatorio: criarAleatorio(semente),
    paleta: paletaDosFogos(),
  });
  const total = (lotes) => lotes.reduce((s, l) => s + l.quantos, 0);

  describe("animações coreografadas", () => {
    it("as curvas: suave nas pontas e a chuva abre, chega ao clímax e rareia", () => {
      expect(suavizar(0)).toBe(0);
      expect(suavizar(1)).toBe(1);
      expect(suavizar(0.5)).toBeCloseTo(0.5);
      expect(envelopeDaChuva(PICO_DA_CHUVA)).toBeCloseTo(1);
      expect(envelopeDaChuva(0)).toBeLessThan(envelopeDaChuva(0.3));
      expect(envelopeDaChuva(0.7)).toBeLessThan(envelopeDaChuva(PICO_DA_CHUVA));
      expect(envelopeDaChuva(1)).toBeLessThan(envelopeDaChuva(0.7));
      expect(envelopeDaChuva(1)).toBeGreaterThan(0);
      for (let u = 0; u <= 1; u += 0.05) {
        expect(envelopeDaChuva(u)).toBeGreaterThan(0);
        expect(envelopeDaChuva(u)).toBeLessThanOrEqual(1);
      }
    });

    it("confete: abertura nos canhões, clímax no chafariz e a chuva que rareia", () => {
      const lotes = lotesDaPeca("confete", { duracao: 6, quantidade: 1 });
      expect(lotes.filter((l) => l.t < 0.1).map((l) => l.origem)).toEqual([
        "canhao-esquerdo",
        "canhao-direito",
      ]);
      const chafariz = lotes.find((l) => l.origem === "chafariz");
      expect(chafariz.t).toBeCloseTo(6 * PICO_DA_CHUVA);
      const chuva = lotes.filter((l) => l.origem === "topo");
      const perto = (t) =>
        chuva
          .filter((l) => Math.abs(l.t - t) < 0.5)
          .reduce((s, l) => s + l.quantos, 0);
      expect(perto(6 * PICO_DA_CHUVA)).toBeGreaterThan(perto(4.2));
      expect(Math.max(...chuva.map((l) => l.t))).toBeLessThanOrEqual(6 - 1.6);
    });

    it("Suave, Normal e Festa: o roteiro muda, não só a quantidade", () => {
      const de = (nivel, quantidade) =>
        lotesDaPeca("confete", { duracao: 6, quantidade, nivel });
      const suave = de("suave", 0.55);
      const normal = de("normal", 1);
      const festa = de("festa", 1.7);
      // Suave: sem clímax; Festa: mais ondas de canhão que o Normal.
      expect(suave.some((l) => l.origem === "chafariz")).toBe(false);
      expect(normal.some((l) => l.origem === "chafariz")).toBe(true);
      const canhoes = (lotes) =>
        lotes.filter((l) => l.origem.startsWith("canhao")).length;
      expect(canhoes(festa)).toBeGreaterThan(canhoes(normal));
      expect(total(normal)).toBeGreaterThan(total(suave) * 1.6);
      expect(total(festa)).toBeGreaterThan(total(normal) * 1.6);
      // Estrelas: o Normal tem chuva de meteoros no clímax; o Festa, duas.
      const meteoros = (nivel) =>
        lotesDaPeca("estrelas", { duracao: 6, quantidade: 1, nivel }).filter(
          (l) => l.peca === "cometa" && l.quantos >= 5,
        ).length;
      expect(meteoros("suave")).toBe(0);
      expect(meteoros("normal")).toBe(1);
      expect(meteoros("festa")).toBe(2);
      // Corações e balões: o clímax é uma onda própria (fora do Suave).
      for (const [peca, origem] of [
        ["coracoes", "chafariz"],
        ["baloes", "onda"],
      ]) {
        expect(
          lotesDaPeca(peca, { duracao: 6, quantidade: 1, nivel: "suave" }).some(
            (l) => l.origem === origem,
          ),
        ).toBe(false);
        expect(
          lotesDaPeca(peca, { duracao: 6, quantidade: 1 }).some(
            (l) => l.origem === origem,
          ),
        ).toBe(true);
      }
    });

    it("confete em 3D: de chapa, o ar segura e ele cai mais devagar que de lado", () => {
      expect(arrastoDoConfete(0, 0)).toBeCloseTo(1.55);
      expect(arrastoDoConfete(Math.PI / 2, 0)).toBeCloseTo(0.45);
      const [modelo] = nascerLote(cenaParaNascer(3), {
        t: 0,
        peca: "confete",
        quantos: 1,
        origem: "topo",
      });
      const cair = (fase) => {
        const p = {
          ...modelo,
          fase,
          giroY: 0,
          vfase: 0,
          vgiroY: 0,
          vrot: 0,
          balanco: 0,
          vx: 0,
          vy: 50,
          y: 0,
          vida: 10,
          vidaMax: 10,
        };
        for (let i = 0; i < 120; i += 1) moverParticulaDoMotor(p, 1 / 60, tela);
        return p.y;
      };
      expect(cair(Math.PI / 2)).toBeGreaterThan(cair(0) * 1.3);
      // Duas viradas (fase e giroY) e o metálico existem no confete.
      expect(typeof modelo.giroY).toBe("number");
      expect(typeof modelo.metalico).toBe("boolean");
    });

    it("profundidade: as de longe são menores e mais apagadas e são desenhadas primeiro", () => {
      expect(tamanhoNaProfundidade(0)).toBeLessThan(tamanhoNaProfundidade(1));
      const base = { idade: 1, vida: 3, vidaMax: 4, tipo: "confete" };
      expect(brilhoDoMotor({ ...base, z: 0 })).toBeLessThan(
        brilhoDoMotor({ ...base, z: 1 }),
      );
      const particulas = nascerLote(cenaParaNascer(5), {
        t: 0,
        peca: "estrela",
        quantos: 40,
        origem: "topo",
      }).map((p) => ({ ...p, idade: 0.5, y: 100 }));
      const ordem = [];
      const contexto = new Proxy(
        {},
        {
          get: (_, chave) =>
            chave === "translate"
              ? (x) => ordem.push(particulas.find((p) => p.x === x).z)
              : () => {},
          set: () => true,
        },
      );
      desenharParticulas(contexto, particulas);
      const virada = ordem.findIndex((z) => z >= 0.5);
      expect(virada).toBeGreaterThan(0);
      expect(ordem.slice(0, virada).every((z) => z < 0.5)).toBe(true);
      expect(ordem.slice(virada).every((z) => z >= 0.5)).toBe(true);
    });

    it("o coração bate tum-tum e a qualidade baixa corta brilhos e sombras", () => {
      expect(batidaDoCoracao(0.08)).toBeCloseTo(1, 1);
      expect(batidaDoCoracao(0.3)).toBeGreaterThan(0.5);
      expect(batidaDoCoracao(0.7)).toBeLessThan(0.05);
      expect(batidaDoCoracao(1.1 + 0.08)).toBeCloseTo(batidaDoCoracao(0.08));
      const contar = (qualidade) => {
        const cena = criarCena({
          ...tela,
          efeito: "baloes",
          aleatorio: criarAleatorio(4),
        });
        for (let i = 0; i < 120; i += 1) avancarCena(cena, 1 / 60);
        let ellipses = 0;
        const contexto = new Proxy(
          {},
          {
            get: (_, chave) =>
              chave === "ellipse" ? () => (ellipses += 1) : () => {},
            set: () => true,
          },
        );
        desenharParticulas(contexto, cena.particulas, { qualidade });
        return ellipses;
      };
      expect(contar(2)).toBeGreaterThan(contar(0));
    });
  });
});

bloco("aya-conhecimento-md", () => {
  const resposta = (question) =>
    responderAya({ question, section: "dashboard", area: "saude-indigena" })
      .answer;

  /* Compila uma pasta de exemplo com um só documento. */
  function compilarExemplo(conteudo) {
    const pasta = mkdtempSync(join(tmpdir(), "aya-base-"));
    try {
      writeFileSync(join(pasta, "exemplo.md"), conteudo);
      return compilarVerbetes(pasta);
    } finally {
      rmSync(pasta, { recursive: true, force: true });
    }
  }

  describe("base de conhecimento em docs/aya", () => {
    it("não tem verbete malformado", () => {
      const { problemas } = compilarVerbetes();
      expect(problemas).toEqual([]);
    });

    /*
    O módulo gerado é o que o código lê. Se alguém editar um `.md` e não rodar
    `npm run aya:conhecimento`, a Aya responde com a base velha e nada avisa.
    Este teste é o aviso.
  */
    it("o módulo gerado está em dia com os .md", async () => {
      const { verbetes } = compilarVerbetes();
      const esperado = await gerarModulo({ verbetes });
      const atual = readFileSync(
        "src/modules/aya-conhecimento-gerado.js",
        "utf8",
      ).replace(/\r\n/g, "\n");
      expect(atual.trim()).toBe(esperado.trim());
    });

    it("todo verbete tem perguntas, resposta e fonte", () => {
      const incompletos = VERBETES_AYA.filter(
        (verbete) =>
          !verbete.perguntas.length || !verbete.resposta || !verbete.fonte,
      ).map((verbete) => verbete.titulo);
      expect(incompletos).toEqual([]);
    });

    it("não guarda mais assuntos gerais (plantas, carros, futebol, remédios)", () => {
      const arquivos = new Set(VERBETES_AYA.map((verbete) => verbete.arquivo));
      expect(arquivos.has("06-assuntos-gerais.md")).toBe(false);
      const texto = VERBETES_AYA.map((v) => v.resposta).join(" ");
      expect(texto).not.toMatch(/futebol|impedimento|fotoss[ií]ntese/i);
    });
  });

  describe("compilador da base", () => {
    it("acusa verbete sem perguntas, mesmo que só tenha fato", () => {
      const { problemas } = compilarExemplo(
        "# Exemplo\n\n## Sem gatilho\n\n**fato:** Algo.\n**fonte:** interface do Yeendé\n",
      );
      expect(problemas).toEqual([
        "exemplo.md › Sem gatilho: não tem perguntas que o disparem",
      ]);
    });

    it("acusa a mesma pergunta em dois verbetes, como a busca a vê", () => {
      const { problemas } = compilarExemplo(
        [
          "# Exemplo",
          "## Um",
          "**perguntas:** lista de aprovados",
          "**resposta:** Um.",
          "**fonte:** interface do Yeendé",
          "## Dois",
          "**perguntas:** as listas dos aprovados",
          "**resposta:** Dois.",
          "**fonte:** interface do Yeendé",
        ].join("\n\n"),
      );
      expect(problemas).toHaveLength(1);
      expect(problemas[0]).toContain('"Um" e "Dois"');
    });

    it("aceita variações da mesma pergunta no mesmo verbete", () => {
      const { problemas } = compilarExemplo(
        "## Edital\n\n**perguntas:** edital | editais\n**resposta:** Edital.\n**fonte:** interface do Yeendé\n",
      );
      expect(problemas).toEqual([]);
    });
  });

  describe("verbetes que só tinham fato agora têm perguntas", () => {
    it("responde pelos gatilhos novos", () => {
      expect(resposta("por que 36 pontos no mapa?")).toContain("não 36 DSEIs");
      expect(resposta("cores da tabela")).toContain("vermelho");
      expect(resposta("como comparar territórios?")).toContain("comparar");
      expect(resposta("base geoespacial da Funai")).toContain("atualização");
      expect(resposta("plano nacional de saúde")).toContain("2024-2027");
    });
  });

  describe("saúde indígena pela busca", () => {
    it("responde perguntas inteiras da base", () => {
      expect(resposta("quem atende nas aldeias?")).toContain("EMSI");
      expect(resposta("quantas casai existem?")).toContain("70 CASAIs");
      expect(
        resposta("qual a diferença entre dsei e terra indígena?"),
      ).toContain("Não são a mesma coisa");
    });

    it("deixa pergunta factual sobre a tela fora das definições", () => {
      for (const pergunta of [
        "quantas vagas ociosas o DSEI tem?",
        "quantos editais aparecem aqui?",
      ])
        expect(resposta(pergunta)).toContain("Não encontrei esse número");
    });

    it("responde o distrito pelo nome, não a definição genérica de DSEI", () => {
      for (const pergunta of [
        "Dsei alagoas",
        "Diga mais sobre o DSEI Alagoas",
        "dsei al/se",
      ]) {
        const texto = resposta(pergunta);
        expect(texto).toContain("Maceió");
        expect(texto).toContain("13.480");
      }
      expect(resposta("dsei vale do javari")).toContain("Atalaia do Norte");
    });

    it("mantém a resposta composta quando há duas perguntas juntas", () => {
      const texto = resposta(
        "Quantas aldeias tem no DSEI Alagoas? Diga mais sobre o povo Kariri-Xocó",
      );
      expect(texto).toContain("30 aldeias");
      expect(texto).toContain("Ouricuri");
    });

    it("responde PNASPI, CONDISI, conselho local e as três instâncias", () => {
      expect(resposta("o que é a PNASPI?")).toContain("Portaria 254");
      expect(resposta("o que é CONDISI?")).toContain("paritária");
      expect(resposta("o que é CONDISI?")).toContain("deliberativo");
      expect(resposta("o que é conselho local?")).toContain("consultivo");
      expect(resposta("quais são os conselhos da saúde indígena?")).toContain(
        "FPCONDISI",
      );
    });

    it("responde a lista dos 34 DSEIs", () => {
      const texto = resposta("quais são os 34 DSEIs?");
      for (const nome of ["Yanomami", "Vale do Javari", "Parintins", "Xavante"])
        expect(texto).toContain(nome);
    });
  });
});

bloco("aya-knowledge", () => {
  const responder = (question) =>
    responderAya({ question, section: "dashboard", area: "saude-indigena" });
  const resposta = (question) => responder(question).answer;

  describe("fontes oficiais da Aya", () => {
    it("associa CASAI às fontes do Ministério da Saúde", () => {
      const sources = officialSourcesForQuestion("O que é CASAI?");
      expect(sources.map((source) => source.id)).toEqual(["casai", "sesai"]);
      expect(sources[0].url).toMatch(
        /^https:\/\/.*gov\.br|^https:\/\/bvsms\.saude\.gov\.br/,
      );
    });

    it("associa aldeias e Terras Indígenas à Funai", () => {
      const aldeias = officialSourcesForQuestion(
        "Quais aldeias indígenas existem no Brasil?",
      );
      const terras = officialSourcesForQuestion("O que é uma Terra Indígena?");

      expect(aldeias).toContainEqual(AYA_SOURCE_CATALOG.funai);
      expect(terras).toContainEqual(AYA_SOURCE_CATALOG.funai);
    });

    it("anexa PDSI AL/SE e Funai às perguntas específicas", () => {
      const ids = officialSourcesForQuestion(
        "Quantas aldeias tem no DSEI Alagoas e quem são os Kariri-Xocó?",
      ).map((source) => source.id);

      expect(ids).toContain("pdsi-al-se");
      expect(ids).toContain("funai-kariri-xoco");
      expect(ids).toContain("dsei");
      expect(ids).toContain("sesai");
      expect(ids).toContain("funai");
    });

    it("não cita mais fontes de assuntos fora do Yeendé", () => {
      expect(AYA_SOURCE_CATALOG).not.toHaveProperty("anvisaMedicamentos");
      expect(AYA_SOURCE_CATALOG).not.toHaveProperty("ifab");
      expect(officialSourcesForQuestion("O que é medicamento?")).toEqual([]);
    });
  });

  describe("resposta composta do DSEI Alagoas e Sergipe", () => {
    it("responde as duas perguntas num enunciado só", () => {
      const answer = curatedAnswerForQuestion(
        "Quantas aldeias tem no DSEI Alagoas? Diga mais sobre o povo Kariri-Xocó",
      );

      expect(answer).toContain("30 aldeias");
      expect(answer).toContain("base de 2023");
      expect(answer).toContain("2.509 pessoas");
      expect(answer).toContain("Ouricuri");
    });

    it("deixa a pergunta simples para a busca na base", () => {
      expect(curatedAnswerForQuestion("o que é o DSEI Alagoas?")).toBe("");
      expect(resposta("o que é o DSEI Alagoas?")).toContain("Maceió");
    });
  });

  describe("base institucional pela busca", () => {
    it("responde a criação da Funai com a fonte institucional", () => {
      const resultado = responder("Quando Criou a Funai ?");
      expect(resultado.answer).toContain("5 de dezembro de 1967");
      expect(resultado.answer).toContain("Lei nº 5.371");
      expect(resultado.sources).toContainEqual(
        AYA_SOURCE_CATALOG.funaiInstitucional,
      );
    });

    it("define vaga ociosa, contratados e taxa de ociosidade", () => {
      expect(resposta("O que significa uma vaga ociosa?")).toContain(
        "sem contratação",
      );
      expect(resposta("o que é taxa de ociosidade?")).toContain(
        "Ociosas dividido pelo total de Vagas",
      );
      expect(resposta("o que é contratados?")).toContain(
        "preenchida por contratação",
      );
    });

    it("não troca pergunta factual pela definição", () => {
      expect(resposta("quantas vagas ociosas o DSEI tem?")).toContain(
        "Não encontrei esse número",
      );
      expect(resposta("quantas vagas o SUS tem aqui?")).toContain(
        "Não encontrei esse número",
      );
    });

    it("nega que Yeendé seja sigla, sem contradição", () => {
      const answer = resposta("O que significa Yeendé? É uma sigla?");
      expect(answer).toContain("Não é uma sigla");
      expect(answer).not.toMatch(/É uma sigla que/);
    });

    it("expande AgSUS, SESAI, SIASI e SUS corretamente", () => {
      expect(resposta("o que é a AgSUS?")).toContain(
        "Agência Brasileira de Apoio à Gestão do Sistema Único de Saúde",
      );
      expect(resposta("o que é SESAI?")).toContain(
        "Secretaria Especial de Saúde Indígena",
      );
      expect(resposta("o que é o SIASI?")).toContain(
        "Sistema de Informação da Atenção à Saúde Indígena",
      );
      const sus = resposta("o que é o SUS ?");
      expect(sus).toContain("Sistema Único de Saúde");
      expect(sus).toContain("1988");
      expect(resposta("o que é o SasiSUS?")).toContain("Subsistema");
    });
  });
});

bloco("aya-memoria", () => {
  function janelaComArmazenamento() {
    const dados = new Map();
    return {
      sessionStorage: {
        getItem: (k) => (dados.has(k) ? dados.get(k) : null),
        setItem: (k, v) => dados.set(k, String(v)),
        removeItem: (k) => dados.delete(k),
      },
    };
  }

  describe("memória de conversa da Aya", () => {
    let win;
    beforeEach(() => {
      win = janelaComArmazenamento();
    });

    it("sobrevive ao recarregamento, que é o problema que motivou isto", () => {
      salvarConversa(
        [
          { role: "user", content: "Dsei alagoas" },
          { role: "assistant", content: "O DSEI AL/SE tem sede em Maceió." },
        ],
        win,
      );
      expect(lerConversa(win)).toEqual([
        { role: "user", content: "Dsei alagoas" },
        { role: "assistant", content: "O DSEI AL/SE tem sede em Maceió." },
      ]);
    });

    it("recomeçar apaga de verdade", () => {
      salvarConversa([{ role: "user", content: "oi" }], win);
      esquecerConversa(win);
      expect(lerConversa(win)).toEqual([]);
    });

    it("descarta turno malformado em vez de propagá-lo", () => {
      const limpa = limitarConversa([
        { role: "user", content: "válido" },
        { role: "system", content: "papel que não existe aqui" },
        { role: "assistant", content: "   " },
        { role: "assistant" },
        null,
      ]);
      expect(limpa).toEqual([{ role: "user", content: "válido" }]);
    });

    it("corta pelos mais antigos e mantém os recentes", () => {
      const muitos = Array.from({ length: 60 }, (_, i) => ({
        role: i % 2 ? "assistant" : "user",
        content: `turno ${i}`,
      }));
      const limitada = limitarConversa(muitos);
      expect(limitada.length).toBeLessThanOrEqual(40);
      expect(limitada.at(-1).content).toBe("turno 59");
    });

    it("uma resposta gigante não apaga a conversa inteira", () => {
      const limitada = limitarConversa([
        { role: "user", content: "pergunta" },
        { role: "assistant", content: "x".repeat(9000) },
      ]);
      expect(limitada.length).toBeGreaterThan(0);
    });

    /*
    Janela anônima, cota estourada ou armazenamento bloqueado por política não
    podem derrubar o painel: a Aya perde a memória e segue funcionando.
  */
    it("aguenta armazenamento indisponível", () => {
      const semArmazenamento = {
        get sessionStorage() {
          throw new Error("bloqueado");
        },
      };
      expect(() => lerConversa(semArmazenamento)).not.toThrow();
      expect(lerConversa(semArmazenamento)).toEqual([]);
      expect(
        salvarConversa([{ role: "user", content: "a" }], semArmazenamento),
      ).toBe(false);
      expect(() => esquecerConversa(semArmazenamento)).not.toThrow();
    });

    it("conteúdo corrompido não quebra a leitura", () => {
      win.sessionStorage.setItem("agsus_aya_conversa_v1", "{isso não é json");
      expect(lerConversa(win)).toEqual([]);
    });
  });
});

bloco("aya-paginas", () => {
  /*
  A interface não tem texto explicativo: quem explica é a Aya. Estes testes
  garantem que nenhuma página do menu nem seção de Configurações fica sem
  verbete, e que nenhuma sugestão do painel cai no "não sei".
*/

  const AREAS = AREAS_DO_SISTEMA.map((area) => area.id);

  /* A resposta, ou "" quando a Aya pede outra pergunta ou foge do tema. */
  function respostaDaBase(question, local = {}) {
    const resultado = responderAya({ question, ...local });
    return resultado.oferecerChamado ||
      /foge do que eu sei/.test(resultado.answer)
      ? ""
      : resultado.answer;
  }

  describe("um verbete por página e por seção", () => {
    it("a Aya conhece as mesmas páginas do menu, na mesma ordem", () => {
      expect(VIEWS_DA_AYA).toEqual(ABAS_DO_MENU.map((aba) => aba.view));
    });

    it("a Aya conhece as mesmas seções de Configurações", () => {
      expect(Object.keys(SECOES_DA_AYA)).toEqual(SECOES.map((s) => s.id));
      for (const secao of SECOES)
        expect(SECOES_DA_AYA[secao.id].nome).toBe(secao.rotulo);
    });

    it.each(ABAS_DO_MENU.map((aba) => [aba.rotulo]))(
      "responde para que serve a página %s",
      (rotulo) => {
        const resposta = respostaDaBase(`Para que serve ${rotulo}?`);
        expect(resposta).not.toBe("");
        expect(resposta).toContain(rotulo);
      },
    );

    it.each(SECOES.map((secao) => [secao.rotulo]))(
      "responde para que serve a seção %s",
      (rotulo) => {
        const resposta = respostaDaBase(`Para que serve ${rotulo}?`);
        expect(resposta).not.toBe("");
        expect(resposta).toContain(rotulo);
      },
    );
  });

  describe("sugestões do painel", () => {
    const locais = [
      ...VIEWS_DA_AYA.flatMap((view) =>
        AREAS.map((area) => ({ view, area, nomeDaArea: nomeDaArea(area) })),
      ),
      ...SECOES.map((secao) => ({ view: "config", secao: secao.id })),
      { view: "config" },
      { view: "panel:externo", titulo: "Painel" },
    ];
    const todas = locais.map((local) => paginaDaAya(local));

    it("toda página tem de 2 a 5 sugestões", () => {
      for (const pagina of todas) {
        expect(pagina.sugestoes.length).toBeGreaterThanOrEqual(2);
        expect(pagina.sugestoes.length).toBeLessThanOrEqual(5);
      }
    });

    it("toda sugestão tem resposta da base, na própria página", () => {
      const semResposta = locais
        .flatMap((local) =>
          paginaDaAya(local).sugestoes.map((s) => ({ local, s })),
        )
        .filter(
          ({ local, s }) =>
            !respostaDaBase(s.pergunta, {
              section: local.view,
              title: local.titulo,
              area: local.area,
              secao: local.secao,
            }),
        )
        .map(({ s }) => s.pergunta);
      expect(semResposta).toEqual([]);
    });

    it("o rótulo do botão é curto e diferente da pergunta enviada", () => {
      for (const s of todas.flatMap((pagina) => pagina.sugestoes)) {
        expect(s.rotulo.length).toBeLessThanOrEqual(24);
        expect(s.pergunta).not.toBe(s.rotulo);
      }
    });
  });

  describe("página e área atuais", () => {
    it("põe a área no nome das páginas do menu", () => {
      expect(
        paginaDaAya({ view: "recursos", area: "sede", nomeDaArea: "SEDE" })
          .nome,
      ).toBe("Painel de recursos · SEDE");
    });

    it("a Visão geral de cada área fala do mapa certo", () => {
      const si = paginaDaAya({
        view: "dashboard",
        area: "saude-indigena",
        nomeDaArea: "Saúde Indígena",
      });
      const projetos = paginaDaAya({
        view: "dashboard",
        area: "projetos",
        nomeDaArea: "Projetos",
      });
      const sede = paginaDaAya({
        view: "dashboard",
        area: "sede",
        nomeDaArea: "SEDE",
      });
      expect(si.intro).toContain("DSEIs");
      expect(projetos.intro).toContain("projetos");
      expect(projetos.intro).not.toContain("DSEI");
      expect(sede.intro).not.toContain("mapa");
      expect(sede.intro).not.toContain("Saúde Indígena");
      expect(sede.nome).toBe("Visão geral · SEDE");
    });

    it("dá a seção de Configurações e a página genérica", () => {
      expect(paginaDaAya({ view: "config", secao: "acessos" }).nome).toBe(
        "Configurações › Acessos",
      );
      expect(paginaDaAya({ view: "panel:x", titulo: "Painel X" }).nome).toBe(
        "Painel X",
      );
    });

    it("o Painel de recursos explica os números; Analisar recursos, o fluxo", () => {
      expect(paginaDaAya({ view: "recursos" }).intro).toBe(
        "Posso explicar os indicadores, as pendências, os prazos e o fluxo do parecer jurídico.",
      );
      expect(paginaDaAya({ view: "analisar-recursos" }).intro).toBe(
        "Posso explicar como registrar, enviar ao parecer, decidir, responder e ajustar a pontuação.",
      );
    });
  });

  describe("ações das respostas", () => {
    it("só navega dentro do app", () => {
      expect(acaoDaAya("recursos")).toMatchObject({
        rotulo: "Abrir Painel de recursos",
        view: "recursos",
      });
      expect(acaoDaAya("analisar-recursos")).toMatchObject({
        rotulo: "Abrir Recursos",
        view: "analisar-recursos",
      });
      expect(acaoDaAya("config:acessos")).toMatchObject({
        rotulo: "Ir para Configurações › Acessos",
        view: "config",
        secao: "acessos",
      });
      expect(acaoDaAya("https://exemplo.com")).toBeNull();
    });

    it("todo `abrir` dos verbetes é uma ação conhecida", () => {
      for (const verbete of VERBETES_AYA.filter((v) => v.abrir))
        expect(acaoDaAya(verbete.abrir)).not.toBeNull();
    });

    it("a resposta da base traz a ação do verbete", () => {
      expect(responderAya({ question: "Como dar acesso a alguém?" }).acao).toBe(
        "config:acessos",
      );
      expect(responderAya({ question: "oi" }).acao).toBeUndefined();
    });
  });

  describe("texto da resposta", () => {
    it("vira parágrafos e listas, sem HTML", () => {
      expect(
        blocosDoTexto("Primeiro.\ncontinua\n\n- um\n- dois\n\n1. a\n2) b"),
      ).toEqual([
        { tipo: "paragrafo", itens: ["Primeiro. continua"] },
        { tipo: "lista", itens: ["um", "dois"] },
        { tipo: "numerada", itens: ["a", "b"] },
      ]);
      expect(blocosDoTexto("<b>oi</b>")).toEqual([
        { tipo: "paragrafo", itens: ["<b>oi</b>"] },
      ]);
    });

    it("revela aos poucos, de 650 ms a 3,4 s", () => {
      expect(duracaoDaRevelacao("")).toBe(0);
      expect(duracaoDaRevelacao("abc")).toBe(650);
      expect(duracaoDaRevelacao("x".repeat(1000))).toBe(3400);
      expect(caracteresRevelados("abcdef", 0)).toBe(1);
      expect(caracteresRevelados("abcdef", 10000)).toBe(6);
    });
  });
});

bloco("aya-respostas-chave", () => {
  /*
  Perguntas-chave sobre as regras que saíram das telas. A resposta é direta
  (verbete de docs/aya, pela busca) e tem de dizer a regra certa.
*/
  const resposta = (pergunta) => responderAya({ question: pergunta }).answer;

  describe("respostas sobre as regras do sistema", () => {
    it("quem pode decidir um recurso", () => {
      for (const pergunta of [
        "Quem pode decidir um recurso?",
        "quem decide o recurso?",
        "Quem pode deferir?",
      ]) {
        const texto = resposta(pergunta);
        expect(texto).toContain("Parecer jurídico");
        expect(texto).toContain("Jurídico");
      }
      expect(resposta("Quem pode decidir um recurso?")).toContain("não decide");
    });

    it("por que um edital não aparece em Conduzir entrevistas", () => {
      const texto = resposta(
        "Por que um edital não aparece em Conduzir entrevistas?",
      );
      expect(texto).toContain("7 dias");
      expect(texto).toContain("15 dias");
      expect(texto).toContain("administrador global");
      expect(texto).toContain("sem parecer");
    });

    it("de onde vêm os KPIs da Visão geral", () => {
      const texto = resposta("De onde vêm os KPIs da Visão geral?");
      expect(texto).toContain("10h de Brasília");
      expect(texto).toContain("Seleção");
      expect(texto).toContain("cadastro do edital");
    });

    it("como dar acesso a alguém", () => {
      const texto = resposta("Como dar acesso a alguém?");
      expect(texto).toContain("Adicionar pessoa");
      expect(texto).toContain("O link sozinho não dá acesso");
      expect(texto).toContain("e-mail convidado");
    });

    it("vagas imediatas: quadro do edital, depois a Convocação, depois a regra (sem número manual)", () => {
      const texto = resposta("De onde vêm as vagas imediatas?");
      expect(texto).toContain("não se digitam mais à mão");
      const quadro = texto.indexOf("quadro de vagas do edital");
      const convocacao = texto.indexOf("Lista de aprovados › Convocação");
      const regra = texto.indexOf("percentuais da regra");
      expect(quadro).toBeGreaterThan(-1);
      expect(quadro).toBeLessThan(convocacao);
      expect(convocacao).toBeLessThan(regra);
    });

    it("escopo das análises e manutenção de abas", () => {
      expect(resposta("O que é o escopo Ativo, Inativo e Todos?")).toContain(
        "editais encerrados",
      );
      expect(
        resposta("O que acontece quando uma aba fica em manutenção?"),
      ).toContain("tela de manutenção");
    });

    it("aceita a pergunta com ou sem acento", () => {
      expect(resposta("O que é parecer juridico?")).toBe(
        resposta("O que é parecer jurídico?"),
      );
      expect(resposta("O que é parecer jurídico?")).toContain(
        "parecer jurídico",
      );
    });

    it("não sequestra pergunta factual sobre a tela", () => {
      expect(resposta("quantos recursos aparecem aqui?")).toContain(
        "Não encontrei esse número",
      );
      expect(resposta("quantas vagas ociosas o DSEI tem?")).toContain(
        "Não encontrei esse número",
      );
    });
  });
});

bloco("aya-sem-ia-local", () => {
  const responder = (question, extra = {}) =>
    responderAya({ question, section: "recursos", area: "sede", ...extra });

  describe("Aya sem máquina, sessão de IA ou túnel", () => {
    it("responde saudações e ajuda com sugestões da tela sem nenhuma requisição", () => {
      const fetch = vi.spyOn(globalThis, "fetch");
      try {
        for (const pergunta of ["oi", "oii", "ajuda", "o que você faz?"]) {
          const resultado = responder(pergunta);
          expect(resultado.answer).toContain("parecer jurídico");
          expect(resultado.sugestoes.length).toBeLessThanOrEqual(3);
        }
        expect(responder("Quem pode decidir um recurso?").answer).toContain(
          "Jurídico",
        );
        expect(
          responder("pergunta do Yeendé que não conheço").oferecerChamado,
        ).toBe(true);
        expect(fetch).not.toHaveBeenCalled();
      } finally {
        fetch.mockRestore();
      }
    });

    it("encontra a regra com sinônimo, sem acento e com erro de digitação", () => {
      for (const pergunta of [
        "quem decide uma contestação?",
        "quem pode decidir um recuro?",
        "quem decide um recurso",
        "quem decide uma contestacao",
      ]) {
        expect(responder(pergunta).answer).toContain("Parecer jurídico");
      }
      expect(responder("como funciona o processo seletivo?").answer).toContain(
        "edital",
      );
      expect(responder("O que é triagem?").answer).toContain("Triagem");
    });

    it("não inventa número nem transforma uma pergunta factual em definição", () => {
      expect(responder("quantos recursos aparecem aqui?").oferecerChamado).toBe(
        true,
      );
      const resultado = responder("quantos DSEIs aparecem?", {
        section: "dashboard",
        context: {
          territories: ["DSEI Xavante", "DSEI Manaus"],
          activeFilters: ["UF AM"],
        },
      });
      expect(resultado.answer).toContain("2 DSEIs");
      expect(resultado.answer).toContain("recorte");
      expect(
        responder("quantos DSEIs aparecem?", {
          context: {
            territories: ["Manaus", "Brasília"],
            mapSummary: "2 pontos",
          },
        }).answer,
      ).not.toContain("2 DSEIs");
      expect(
        responder("Como funcionam os filtros?", {
          section: "dashboard",
          context: { activeFilters: ["UF AM"] },
        }).answer,
      ).not.toMatch(/^Os filtros ativos/);
    });

    it("orienta perguntas fora do sistema e oferece temas da página", () => {
      for (const pergunta of [
        "qual a previsão do tempo?",
        "qual o placar de futebol?",
        "como cuidar de plantas?",
        "Qual a capital da França?",
      ]) {
        const resultado = responder(pergunta);
        expect(resultado.answer).toContain("Essa pergunta foge");
        expect(resultado.sources).toEqual([]);
        expect(resultado.sugestoes).toHaveLength(3);
      }
    });

    it("oferece no máximo três perguntas distintas na dúvida, cada uma respondível", () => {
      const resultado = responder("lista");
      expect(resultado.answer).toContain("Não encontrei exatamente isso");
      expect(resultado.oferecerChamado).toBe(true);
      expect(resultado.sugestoes.length).toBeLessThanOrEqual(3);
      expect(new Set(resultado.sugestoes.map((s) => s.pergunta)).size).toBe(
        resultado.sugestoes.length,
      );
      for (const s of resultado.sugestoes)
        expect(responder(s.pergunta).answer).not.toContain(
          "Não encontrei exatamente isso",
        );
    });

    it("prefere a página atual sem transformar empate em certeza", () => {
      const verbetes = [
        {
          titulo: "Indicadores dos editais",
          perguntas: ["indicadores"],
          resposta: "Editais",
          arquivo: "regras-dos-editais.md",
        },
        {
          titulo: "Indicadores dos recursos",
          perguntas: ["indicadores"],
          resposta: "Recursos",
          arquivo: "regras-dos-recursos.md",
        },
      ];
      expect(
        buscarNaBase("indicadores", { pagina: "recursos" }, verbetes).ranking[0]
          .verbete.resposta,
      ).toBe("Recursos");
      expect(
        buscarNaBase("indicadores", { pagina: "nucleo" }, verbetes).ranking[0]
          .verbete.resposta,
      ).toBe("Editais");
    });

    it("abre Gmail com conteúdo codificado e mantém alternativa mailto", () => {
      const chamado = montarChamado({
        email: "suporte@agenciasus.org.br",
        pergunta: "Como usar A&B?",
        resposta: "Use o menu.",
        pagina: "Recursos",
      });
      const url = new URL(chamado.href);
      expect(url.origin).toBe("https://mail.google.com");
      expect(url.searchParams.get("to")).toBe(chamado.para);
      expect(url.searchParams.get("su")).toBe(chamado.assunto);
      expect(url.searchParams.get("body")).toBe(chamado.corpo);
      expect(chamado.mailto).toMatch(
        /^mailto:suporte@agenciasus.org.br\?subject=/,
      );
    });
  });
});

bloco("aya-tours", () => {
  /*
  Os roteiros dos tours e das trilhas da Aya (src/lib/aya/aya-tours.ts): cada
  tela pedida tem tour, a Visão geral muda por área, as trilhas aparecem só
  para quem pode fazê-las, o progresso guardado é limpo e o balão fica
  sempre dentro da tela.
*/

  const perfil = (permissoes, extra = {}) => ({
    ativo: true,
    perfil: "usuario",
    admin_global: false,
    permissoes,
    ...extra,
  });

  const LEITOR_DE_TUDO = perfil({
    dashboard: "leitor",
    nucleo: "leitor",
    calendario: "leitor",
    analises: "leitor",
    aprovados: "leitor",
    entrevistas: "leitor",
    recursos: "leitor",
    selecao: "leitor",
  });

  const ids = (trilhas) => trilhas.map((t) => t.id);

  describe("tours das telas", () => {
    it("as telas pedidas têm tour", () => {
      for (const chave of [
        "dashboard",
        "nucleo",
        "calendario",
        "analises",
        "recursos",
        "entrevistas",
        "approved",
        "selecao",
        "classificacao",
        "conduzir-entrevistas",
        "conduzir-entrevistas:preparar",
        "classificacao:agenda",
        "classificacao:regra",
        "approved:convocacao",
        "config:marca",
        "config:inicio",
        "config:acesso",
        "config:aparencia",
        "config:recursos",
        "config:operacao",
        "config:modulos",
        "config:cargas",
        "config:acessos",
      ])
        expect(PAGINAS_COM_TOUR).toContain(chave);
    });

    it("textos curtos: título e no máximo duas frases", () => {
      for (const chave of PAGINAS_COM_TOUR) {
        const [view, resto] = chave.split(":");
        const tour = tourDaPagina({
          view,
          secao: view === "config" ? resto : "",
          aba: view === "config" ? "" : resto,
          area: "saude-indigena",
        });
        expect(tour.chave).toBe(chave);
        for (const p of tour.passos) {
          expect(p.titulo.length).toBeLessThanOrEqual(40);
          expect(p.texto.length).toBeLessThanOrEqual(160);
          expect(
            p.texto.split(/[.!?](\s|$)/).filter((f) => f.trim()).length,
          ).toBeLessThanOrEqual(3);
        }
      }
    });

    it("a Visão geral mostra o mapa da área (e nenhum na SEDE)", () => {
      const titulos = (area) =>
        tourDaPagina({ view: "dashboard", area }).passos.map((p) => p.titulo);
      // Na Saúde Indígena, o cartão que leva à página Mapa (que tem tour próprio).
      expect(titulos("saude-indigena")).toContain("Mapa");
      expect(titulos("saude-indigena")).not.toContain("Mapa em tela cheia");
      expect(
        tourDaPagina({ view: "mapa", area: "saude-indigena" }).passos.map(
          (p) => p.titulo,
        ),
      ).toContain("Mapa dos DSEIs");
      expect(titulos("projetos")).toContain("Mapa dos projetos");
      expect(titulos("sede").some((t) => t.startsWith("Mapa"))).toBe(false);
    });

    it("Configurações sem seção, ou tela sem tour, não tem tour", () => {
      expect(tourDaPagina({ view: "config", secao: "acessos" })).not.toBeNull();
      expect(tourDaPagina({ view: "config", secao: "marca" })).not.toBeNull();
      expect(tourDaPagina({ view: "config" })).toBeNull();
      expect(tourDaPagina({ view: "panel:x" })).toBeNull();
    });

    it("cada aba principal tem o próprio tour; aba sem tour usa o da tela", () => {
      expect(
        chaveDoTour({ view: "conduzir-entrevistas", aba: "preparar" }),
      ).toBe("conduzir-entrevistas:preparar");
      expect(chaveDoTour({ view: "conduzir-entrevistas", aba: "Fila" })).toBe(
        "conduzir-entrevistas",
      );
      // As visões antigas da tela de Entrevistas não têm mais tour próprio.
      expect(chaveDoTour({ view: "entrevistas", aba: "conduzir" })).toBe(
        "entrevistas",
      );
      expect(chaveDoTour({ view: "classificacao", aba: "regra" })).toBe(
        "classificacao:regra",
      );
      expect(chaveDoTour({ view: "approved", aba: "Convocação" })).toBe(
        "approved:convocacao",
      );
      expect(chaveDoTour({ view: "config", secao: "cargas", aba: "x" })).toBe(
        "config:cargas",
      );
    });

    it("o botão que o perfil não vê sai do tour", () => {
      const leitor = perfil({ ...LEITOR_DE_TUDO.permissoes });
      const editor = perfil({
        ...LEITOR_DE_TUDO.permissoes,
        recursos: "editor",
      });
      const titulos = (p) =>
        tourDaPagina({ view: "analisar-recursos", perfil: p }).passos.map(
          (x) => x.titulo,
        );
      expect(titulos(leitor)).not.toContain("Novo recurso");
      expect(titulos(editor)).toContain("Novo recurso");
      // Sem perfil (testes, legado), o tour não corta nada.
      expect(titulos(null)).toContain("Novo recurso");
    });

    it("a aba Convocação começa pela Central de convocações, só para quem vê as Entrevistas", () => {
      const titulos = (p) =>
        tourDaPagina({
          view: "approved",
          aba: "convocacao",
          perfil: p,
        }).passos.map((x) => x.titulo);
      expect(titulos(LEITOR_DE_TUDO)[0]).toBe("Convocações");
      expect(
        titulos(
          perfil({ ...LEITOR_DE_TUDO.permissoes, entrevistas: "sem_acesso" }),
        ),
      ).not.toContain("Convocações");
    });

    it("contador e convite da primeira visita", () => {
      expect(rotuloDoPasso(2, 9)).toBe("Passo 3 de 9");
      expect(convitesFeitos(["recursos", "recursos", 3, null])).toEqual([
        "recursos",
      ]);
      expect(convitesFeitos("x")).toEqual([]);
      expect(deveConvidar({ chave: "recursos", feitos: [] })).toBe(true);
      expect(deveConvidar({ chave: "recursos", feitos: ["recursos"] })).toBe(
        false,
      );
      expect(
        deveConvidar({ chave: "recursos", feitos: [], ocupado: true }),
      ).toBe(false);
      expect(deveConvidar({ chave: "", feitos: [] })).toBe(false);
    });

    it("todo data-tour usado nos roteiros existe num componente", () => {
      // Os roteiros ficam em src/lib/aya/tours/ (aya-tours.ts só reexporta).
      const fonte = readdirSync("src/lib/aya/tours")
        .map((nome) => readFileSync(join("src/lib/aya/tours", nome), "utf8"))
        .join("\n");
      // `t("nome")` monta o seletor [data-tour='nome'].
      const usados = [
        ...fonte.matchAll(/data-tour='([^']+)'/g),
        ...fonte.matchAll(/\bt\("([^"]+)"\)/g),
      ]
        .map((m) => m[1])
        .filter((id) => !id.includes("$"));
      expect(usados.length).toBeGreaterThan(0);
      const arquivos = [];
      const varrer = (pasta) => {
        for (const nome of readdirSync(pasta)) {
          const caminho = join(pasta, nome);
          if (statSync(caminho).isDirectory()) varrer(caminho);
          else if (/\.[jt]sx$/.test(caminho)) arquivos.push(caminho);
        }
      };
      varrer("src/modulos");
      varrer("src/componentes");
      const componentes = arquivos
        .map((a) => readFileSync(a, "utf8"))
        .join("\n");
      // O atributo vem escrito (data-tour="x"), pela prop dos componentes de
      // src/ui (tour="x") ou montado num modelo (data-tour={`prefixo-${…}`}).
      const prefixos = [
        ...componentes.matchAll(/data-tour"?[=:]\s*\{?`([a-z-]+)\$\{/g),
      ].map((m) => m[1]);
      for (const id of new Set(usados))
        expect(
          componentes.includes(`data-tour="${id}"`) ||
            componentes.includes(`tour="${id}"`) ||
            componentes.includes(`"data-tour": "${id}"`) ||
            componentes.includes(`? "${id}"`) ||
            componentes.includes(`: "${id}"`) ||
            prefixos.some((prefixo) => id.startsWith(prefixo)),
          id,
        ).toBe(true);
    });
  });

  describe("trilhas por permissão", () => {
    it("sem perfil ou inativo, nenhuma", () => {
      expect(trilhasDoPerfil(null)).toEqual([]);
      expect(trilhasDoPerfil({ ...LEITOR_DE_TUDO, ativo: false })).toEqual([]);
    });

    it("leitor: primeiros passos, edital ao aprovado e entrevista; sem recurso nem acessos", () => {
      expect(ids(trilhasDoPerfil(LEITOR_DE_TUDO))).toEqual([
        "primeiros-passos",
        "do-edital-ao-aprovado",
        "conduzir-entrevista",
      ]);
    });

    it("quem edita Recursos faz a trilha do recurso, com os passos de quem registra", () => {
      const trilha = trilhasDoPerfil(
        perfil({ ...LEITOR_DE_TUDO.permissoes, recursos: "editor" }),
      ).find((t) => t.id === "registrar-recurso");
      expect(trilha.passos.map((p) => p.titulo)).toContain("Registrar");
    });

    it("o jurídico faz a trilha do recurso sem os passos de quem registra", () => {
      const trilha = trilhasDoPerfil(
        perfil({
          ...LEITOR_DE_TUDO.permissoes,
          recursos_parecer: "editor",
        }),
      ).find((t) => t.id === "registrar-recurso");
      const titulos = trilha.passos.map((p) => p.titulo);
      expect(titulos).toContain("Decisão do jurídico");
      expect(titulos).not.toContain("Registrar");
    });

    it("convocar e emitir carta só para quem muda o status do candidato", () => {
      expect(ids(trilhasDoPerfil(LEITOR_DE_TUDO))).not.toContain(
        "convocar-e-emitir-carta",
      );
      const editor = perfil({
        ...LEITOR_DE_TUDO.permissoes,
        aprovados: "editor",
      });
      const trilha = trilhasDoPerfil(editor).find(
        (x) => x.id === "convocar-e-emitir-carta",
      );
      expect(trilha.passos.length).toBeGreaterThan(4);
      expect(trilha.passos.every((x) => x.pagina === "approved")).toBe(true);
    });

    it("dar acesso só para quem gerencia acessos", () => {
      expect(ids(trilhasDoPerfil(LEITOR_DE_TUDO))).not.toContain("dar-acesso");
      expect(
        ids(trilhasDoPerfil({ ...LEITOR_DE_TUDO, admin_global: true })),
      ).toContain("dar-acesso");
    });

    it("passo de página que o perfil não abre fica de fora", () => {
      const semAnalises = perfil({
        ...LEITOR_DE_TUDO.permissoes,
        analises: "sem_acesso",
      });
      const trilha = trilhasDoPerfil(semAnalises).find(
        (t) => t.id === "do-edital-ao-aprovado",
      );
      expect(trilha.passos.map((p) => p.pagina)).not.toContain("analises");
      expect(trilha.passos).toHaveLength(7);
    });
  });

  describe("progresso", () => {
    it("descarta o que não é trilha conhecida ou está estragado", () => {
      expect(progressoDasTrilhas(null)).toEqual({});
      expect(progressoDasTrilhas([1])).toEqual({});
      expect(
        progressoDasTrilhas({
          "primeiros-passos": { passo: 2, concluida: false },
          "dar-acesso": { passo: -3, concluida: "sim" },
          inventada: { passo: 1 },
        }),
      ).toEqual({
        "primeiros-passos": { passo: 2, concluida: false },
        "dar-acesso": { passo: 0, concluida: false },
      });
    });

    it("guarda o passo, conclui e diz onde retomar", () => {
      let p = comPassoDaTrilha({}, "primeiros-passos", 2);
      expect(rotuloDoProgresso(p["primeiros-passos"], 7)).toBe("3 de 7");
      expect(passoParaRetomar(p["primeiros-passos"], 7)).toBe(2);
      p = comTrilhaConcluida(p, "primeiros-passos");
      expect(rotuloDoProgresso(p["primeiros-passos"], 7)).toBe("Concluída");
      expect(passoParaRetomar(p["primeiros-passos"], 7)).toBe(0);
      expect(rotuloDoProgresso(undefined, 7)).toBe("7 passos");
      // A trilha encolheu (perdeu permissão): retoma no último passo que existe.
      expect(passoParaRetomar({ passo: 9, concluida: false }, 4)).toBe(3);
    });
  });

  describe("posição do balão", () => {
    const tela = { largura: 1200, altura: 800 };
    const balao = { largura: 300, altura: 150 };

    it("embaixo do elemento quando cabe, centralizado nele", () => {
      const pos = posicaoDoBalao({
        caixa: { top: 100, left: 500, width: 200, height: 50 },
        balao,
        tela,
      });
      expect(pos).toEqual({ modo: "baixo", top: 162, left: 450 });
    });

    it("em cima quando não cabe embaixo", () => {
      const pos = posicaoDoBalao({
        caixa: { top: 600, left: 500, width: 200, height: 150 },
        balao,
        tela,
      });
      expect(pos.modo).toBe("cima");
      expect(pos.top).toBe(600 - 150 - 12);
    });

    it("nunca sai da tela", () => {
      const pos = posicaoDoBalao({
        caixa: { top: 10, left: 1150, width: 40, height: 20 },
        balao,
        tela,
      });
      expect(pos.left).toBeLessThanOrEqual(1200 - 300 - 12);
      expect(pos.left).toBeGreaterThanOrEqual(12);
    });

    it("elemento enorme: no pé da tela, por cima", () => {
      const pos = posicaoDoBalao({
        caixa: { top: 0, left: 0, width: 1200, height: 800 },
        balao,
        tela,
      });
      expect(pos.modo).toBe("sobre");
      expect(pos.top).toBe(800 - 150 - 12);
    });

    it("sem elemento, no meio", () => {
      expect(posicaoDoBalao({ caixa: null, balao, tela })).toEqual({
        modo: "centro",
        top: 325,
        left: 450,
      });
    });

    it("celular: largura total, do lado oposto ao elemento", () => {
      const celular = { largura: 375, altura: 800 };
      expect(
        posicaoDoBalao({
          caixa: { top: 100, left: 0, width: 375, height: 80 },
          balao,
          tela: celular,
          celular: true,
        }),
      ).toEqual({ modo: "celular", lado: "baixo" });
      expect(
        posicaoDoBalao({
          caixa: { top: 600, left: 0, width: 375, height: 80 },
          balao,
          tela: celular,
          celular: true,
        }),
      ).toEqual({ modo: "celular", lado: "cima" });
    });
  });

  describe("holofote", () => {
    // O buraco entre as quatro faixas tem de ser exatamente o recorte (moldura).
    const buraco = ({ faixas }) => ({
      top: faixas[0].height,
      left: faixas[2].width,
      width: faixas[3].left - faixas[2].width,
      height: faixas[1].top - faixas[0].height,
    });

    it.each([
      [{ top: 120, left: 326, width: 174, height: 38 }],
      [{ top: 10.4, left: 0.6, width: 99.7, height: 20.2 }],
      [{ top: 300.5, left: 375.49, width: 124.51, height: 44.5 }],
    ])("moldura == área clara: %o", (retangulo) => {
      const g = geometriaDoHolofote(retangulo);
      expect(buraco(g)).toEqual(g.recorte);
      expect(g.faixas[2].top).toBe(g.recorte.top);
      expect(g.faixas[3].top).toBe(g.recorte.top);
      expect(g.faixas[2].height).toBe(g.recorte.height);
      expect(g.faixas[3].height).toBe(g.recorte.height);
    });

    it("a mesma folga dos quatro lados, em pixels inteiros", () => {
      const g = geometriaDoHolofote({
        top: 100,
        left: 50,
        width: 200,
        height: 40,
      });
      expect(g.recorte).toEqual({
        top: 100 - MARGEM_DO_HOLOFOTE,
        left: 50 - MARGEM_DO_HOLOFOTE,
        width: 200 + 2 * MARGEM_DO_HOLOFOTE,
        height: 40 + 2 * MARGEM_DO_HOLOFOTE,
      });
      expect(geometriaDoHolofote(null)).toBeNull();
    });

    it("elemento colado na borda: faixa de largura zero, nunca negativa", () => {
      const g = geometriaDoHolofote({ top: 2, left: 2, width: 10, height: 10 });
      expect(g.faixas[0].height).toBe(0);
      expect(g.faixas[2].width).toBe(0);
    });
  });
});

bloco("borda-da-aya", () => {
  /*
  A Aya escondida na borda (src/lib/aya/borda-da-aya.ts): qual borda vale ao
  soltar, as setas como alternativa ao arraste e a posição guardada.
*/

  const janela = {
    largura: 56,
    altura: 56,
    larguraDaJanela: 1000,
    alturaDaJanela: 700,
    margem: 8,
  };

  describe("bordaEncostada", () => {
    it("longe das bordas: não se esconde", () => {
      expect(bordaEncostada({ ...janela, left: 400, top: 300 })).toBeNull();
    });

    it("encostada (até ENCOSTO_PX do limite) ou empurrada além dele", () => {
      expect(
        bordaEncostada({ ...janela, left: 8 + ENCOSTO_PX, top: 300 }),
      ).toBe("esquerda");
      expect(
        bordaEncostada({ ...janela, left: 8 + ENCOSTO_PX + 1, top: 300 }),
      ).toBeNull();
      expect(bordaEncostada({ ...janela, left: -40, top: 300 })).toBe(
        "esquerda",
      );
      expect(bordaEncostada({ ...janela, left: 1000 - 8 - 56, top: 300 })).toBe(
        "direita",
      );
      expect(bordaEncostada({ ...janela, left: 400, top: 2 })).toBe("topo");
      expect(bordaEncostada({ ...janela, left: 400, top: 700 })).toBe("baixo");
    });

    it("no canto, vale a mais empurrada; no empate, a lateral", () => {
      expect(bordaEncostada({ ...janela, left: 8, top: -30 })).toBe("topo");
      expect(bordaEncostada({ ...janela, left: -30, top: 8 })).toBe("esquerda");
      expect(bordaEncostada({ ...janela, left: 8, top: 8 })).toBe("esquerda");
    });
  });

  describe("passoDaSeta", () => {
    it("as quatro setas; Shift anda quatro vezes mais; outras teclas, nada", () => {
      expect(passoDaSeta("ArrowLeft")).toEqual({
        dx: -PASSO_DO_TECLADO_PX,
        dy: 0,
      });
      expect(passoDaSeta("ArrowDown", true)).toEqual({
        dx: 0,
        dy: PASSO_DO_TECLADO_PX * 4,
      });
      expect(passoDaSeta("Enter")).toBeNull();
    });
  });

  describe("lerPosicaoDaAya", () => {
    it("lê posição e borda; ignora borda desconhecida e texto torto", () => {
      expect(lerPosicaoDaAya('{"left":10,"top":20}')).toEqual({
        left: 10,
        top: 20,
      });
      expect(lerPosicaoDaAya('{"left":10,"top":20,"borda":"direita"}')).toEqual(
        {
          left: 10,
          top: 20,
          borda: "direita",
        },
      );
      expect(lerPosicaoDaAya('{"left":10,"top":20,"borda":"meio"}')).toEqual({
        left: 10,
        top: 20,
      });
      expect(lerPosicaoDaAya('{"left":"x","top":20}')).toBeNull();
      expect(lerPosicaoDaAya("{")).toBeNull();
      expect(lerPosicaoDaAya(null)).toBeNull();
      expect(ehBordaDaAya("topo")).toBe(true);
      expect(ehBordaDaAya(3)).toBe(false);
    });
  });

  describe("posicaoNaJanela", () => {
    const medidas = {
      largura: 56,
      altura: 56,
      larguraDaJanela: 375,
      alturaDaJanela: 812,
      margem: 8,
    };

    it("dentro da janela, a posição guardada fica como está", () => {
      expect(posicaoNaJanela({ left: 100, top: 300 }, medidas)).toEqual({
        left: 100,
        top: 300,
      });
    });

    it("guardada numa tela maior, volta só o necessário para dentro", () => {
      expect(posicaoNaJanela({ left: 1800, top: 300 }, medidas)).toEqual({
        left: 311,
        top: 300,
      });
      expect(posicaoNaJanela({ left: -40, top: 2000 }, medidas)).toEqual({
        left: 8,
        top: 748,
      });
    });

    it("escondida na direita ou embaixo, acompanha a borda quando a janela muda", () => {
      expect(
        posicaoNaJanela({ left: 1856, top: 300, borda: "direita" }, medidas),
      ).toEqual({ left: 311, top: 300, borda: "direita" });
      expect(
        posicaoNaJanela(
          { left: 100, top: 400, borda: "baixo" },
          { ...medidas, alturaDaJanela: 1440 },
        ),
      ).toEqual({ left: 100, top: 1376, borda: "baixo" });
    });

    it("escondida no topo ou na esquerda, segue encostada na margem", () => {
      expect(
        posicaoNaJanela({ left: 200, top: 8, borda: "topo" }, medidas),
      ).toEqual({ left: 200, top: 8, borda: "topo" });
      expect(
        posicaoNaJanela({ left: 8, top: 900, borda: "esquerda" }, medidas),
      ).toEqual({ left: 8, top: 748, borda: "esquerda" });
    });
  });
});

bloco("busca-da-aya", () => {
  const responder = (question, extra = {}) =>
    responderAya({ question, section: "dashboard", area: "sede", ...extra });

  const FORA = "Essa pergunta foge do que eu sei";
  const DUVIDA = "Não encontrei exatamente isso. Você quis dizer…?";

  describe("sinônimos na busca", () => {
    it.each([
      ["o que é PSS?", "o edital é o instrumento"],
      ["o que é um certame?", "o edital é o instrumento"],
      ["o que é casa de apoio?", "Casa de Saúde Indígena"],
      ["o que é posto de saúde?", "Unidade Básica de Saúde Indígena"],
      ["o que é distrito sanitário especial indígena?", "34 no Brasil"],
      ["quem decide uma impugnação?", "Parecer jurídico"],
      // "Triagem" é a etapa do Processo seletivo (antiga Pré-classificação).
      ["o que é triagem?", "Triagem"],
    ])("%s", (pergunta, trecho) => {
      expect(responder(pergunta).answer).toContain(trecho);
    });
  });

  describe("radical simples na busca", () => {
    it("acha a mesma regra com convocação, convocar ou convocados", () => {
      const respostas = [
        "como funciona a convocação para entrevista?",
        "como convocar para entrevista?",
        "quem são os convocados para entrevista?",
      ].map(
        (pergunta) => responder(pergunta, { section: "entrevistas" }).answer,
      );
      for (const resposta of respostas) {
        expect(resposta).not.toContain(DUVIDA);
        expect(resposta).not.toContain(FORA);
      }
    });
  });

  describe("pontuação", () => {
    const base = [
      {
        titulo: "Prazo do recurso",
        perguntas: ["prazo do recurso"],
        resposta: "Prazo vem do cronograma.",
        arquivo: "regras-dos-recursos.md",
      },
      {
        titulo: "Tela de Recursos",
        perguntas: ["tela de recursos", "recursos"],
        resposta: "Recursos acompanha os recursos.",
        arquivo: "regras-dos-recursos.md",
      },
      {
        titulo: "Tela de Editais",
        perguntas: ["tela de editais", "editais"],
        resposta: "Editais mostra o prazo de cada edital.",
        arquivo: "regras-dos-editais.md",
      },
      {
        titulo: "DSEI",
        perguntas: ["dsei"],
        resposta: "DSEI é o distrito.",
        arquivo: "02-dsei-e-rede.md",
      },
      {
        titulo: "Mapa de DSEIs",
        perguntas: ["dsei no mapa"],
        resposta: "O mapa mostra os DSEIs.",
        arquivo: "regras-dos-mapas.md",
      },
    ];

    it("frase exata das perguntas vale a resposta certa", () => {
      const { ranking } = buscarNaBase("recursos", {}, base);
      expect(ranking[0].verbete.titulo).toBe("Tela de Recursos");
      expect(ranking[0].pontuacao).toBe(1);
    });

    it("pesa perguntas (3), título (2) e resposta (1)", () => {
      const { ranking } = buscarNaBase("prazo", {}, base);
      expect(ranking.map((r) => r.verbete.titulo)).toEqual([
        "Prazo do recurso",
        "Tela de Editais",
      ]);
    });

    it("termo raro vale mais que termo comum (IDF)", () => {
      const verbete = (titulo, pergunta) => ({
        titulo,
        perguntas: [pergunta],
        resposta: titulo,
        arquivo: "exemplo.md",
      });
      const regras = [
        verbete("Regra geral", "regra geral"),
        verbete("Regra da vaga", "regra da vaga"),
        verbete("Regra do edital", "regra do edital"),
        verbete("Prazo final", "prazo final"),
      ];
      const { ranking } = buscarNaBase("regra prazo", {}, regras);
      expect(ranking[0].verbete.titulo).toBe("Prazo final");
    });

    it("dá bônus multiplicativo à página aberta e à área", () => {
      const semPagina = buscarNaBase("mapa", {}, base).ranking[0].pontuacao;
      const naPagina = buscarNaBase("mapa", { pagina: "dashboard" }, base)
        .ranking[0].pontuacao;
      expect(naPagina).toBeGreaterThan(semPagina);
      const geral = buscarNaBase("distrito", {}, base).ranking;
      const naArea = buscarNaBase(
        "distrito",
        { area: "saude-indigena" },
        base,
      ).ranking;
      expect(naArea[0].bruta).toBeCloseTo(geral[0].bruta * 1.1);
    });

    it("frase exata ganha da página aberta", () => {
      const { ranking } = buscarNaBase("dsei", { pagina: "dashboard" }, base);
      expect(ranking[0].verbete.titulo).toBe("DSEI");
    });

    it("os limiares são 0,6 e 0,3", () => {
      expect(LIMIAR_CONFIANTE).toBe(0.6);
      expect(LIMIAR_INCERTO).toBe(0.3);
    });
  });

  describe("decisão pelos limiares", () => {
    it("responde a pergunta clara", () => {
      const resultado = responder("como dar acesso a alguém?");
      expect(resultado.answer).toContain("Adicionar pessoa");
      expect(resultado.acao).toBe("config:acessos");
      expect(resultado.oferecerChamado).toBeFalsy();
    });

    it("na dúvida, oferece até 3 opções respondíveis e o chamado", () => {
      const resultado = responder("lista");
      expect(resultado.answer).toBe(DUVIDA);
      expect(resultado.oferecerChamado).toBe(true);
      expect(resultado.sugestoes.length).toBeGreaterThan(1);
      expect(resultado.sugestoes.length).toBeLessThanOrEqual(3);
      for (const s of resultado.sugestoes) {
        expect(s.pergunta).toMatch(/^[A-Z].*\?$/);
        expect(responder(s.pergunta).answer).not.toBe(DUVIDA);
      }
    });

    it.each([
      "me conta uma piada",
      "Qual a capital da França?",
      "receita de bolo de cenoura",
      "como cuidar de plantas?",
      "qual o placar do futebol?",
    ])("%s está fora do escopo", (pergunta) => {
      const resultado = responder(pergunta);
      expect(resultado.answer).toContain(FORA);
      expect(resultado.answer).toMatch(/^Sou a Aya, do Yeendé/);
      expect(resultado.sugestoes).toHaveLength(3);
      expect(resultado.oferecerChamado).toBeFalsy();
    });

    it('"me conta uma piada" não casa com "Contas desativadas"', () => {
      const { ranking, desconhecidos, termos } =
        buscarNaBase("me conta uma piada");
      expect(desconhecidos * 2).toBeGreaterThanOrEqual(termos.length);
      expect(responder("me conta uma piada").answer).not.toContain("desativad");
      expect(ranking[0]?.pontuacao ?? 0).toBeLessThan(LIMIAR_CONFIANTE);
    });
  });

  describe("correção de digitação", () => {
    it.each([
      ["como funciona a entrevsita?", "entrevistas"],
      ["quem decide o recruso?", "recursos"],
      ["quem decide o rcurso?", "recursos"],
    ])("%s", (pergunta, section) => {
      const resultado = responder(pergunta, { section });
      expect(resultado.answer).not.toContain(FORA);
      expect(resultado.answer).not.toBe(DUVIDA);
    });

    it("corrige para um sinônimo (contestaçao → #recurso)", () => {
      expect(buscarNaBase("contestacoa").termos).toEqual(["#recurso"]);
      expect(buscarNaBase("certme").termos).toEqual(["#edital"]);
    });
  });

  describe("conversa", () => {
    it.each([
      ["obrigado", /^De nada!/],
      ["tchau", /^Até mais!/],
      ["o que posso perguntar?", /^Sou a Aya/],
      ["como te uso?", /^Sou a Aya/],
      ["e aí", /^Olá! Sou a Aya/],
      ["tudo bem?", /^Olá! Sou a Aya/],
    ])("%s", (pergunta, inicio) => {
      const resultado = responder(pergunta);
      expect(resultado.answer).toMatch(inicio);
      expect(resultado.provider).toBe("aya-conversa");
      expect(resultado.sugestoes.length).toBeGreaterThan(0);
    });

    it("saudação com pergunta responde a pergunta com a saudação na frente", () => {
      const resultado = responder("bom dia, como dar acesso?", {
        section: "config",
        secao: "acessos",
      });
      expect(resultado.answer).toMatch(/^Bom dia! /);
      expect(resultado.answer).toContain("Adicionar pessoa");
      expect(resultado.acao).toBe("config:acessos");
    });

    it("a saudação também abre o fora do escopo, que continua amigável", () => {
      expect(responder("boa tarde, me conta uma piada").answer).toMatch(
        /^Boa tarde! Sou a Aya, do Yeendé..*Essa pergunta foge/,
      );
    });
  });

  describe("Aya mais esperta", () => {
    it("duas perguntas numa só: uma resposta numerada para cada", () => {
      const r = responderAya({
        question: "Como dar acesso a alguém e quem pode decidir um recurso?",
        section: "recursos",
      });
      expect(r.answer).toMatch(/^1\. Como dar acesso: /);
      expect(r.answer).toContain("\n2. Quem pode decidir um recurso: ");
    });

    it.each([
      ["o que é CR?", /cadastro reserva/i],
      ["o que é PcD?", /pessoas com deficiência/i],
      ["como funciona o sub judice?", /sub judice/i],
      ["o que é a nota da ART?", /autodeclaração/i],
    ])("sigla do domínio: %s", (pergunta, esperado) => {
      expect(
        responderAya({ question: pergunta, section: "approved" }).answer,
      ).toMatch(esperado);
    });

    it("não entendi: sempre até três caminhos e o chamado, marcado como sem resposta", () => {
      const r = responderAya({
        question: "edital planilha xpto quadro foo",
        section: "nucleo",
      });
      if (r.semResposta && r.oferecerChamado) {
        expect(r.sugestoes.length).toBe(3);
      }
      const fora = responderAya({
        question: "me conta uma piada",
        section: "nucleo",
      });
      expect(fora.semResposta).toBe(true);
    });
  });
});

bloco("catalogo-de-comemoracoes", () => {
  /*
  O catálogo e a configuração das comemorações: os marcos que o código já
  comemora, o JSON publicado em TB_CONFIGURACAO (só o que difere do padrão),
  a decisão de mostrar (teste, preferência pessoal, marco desligado) e os
  marcos personalizados com dados do front.
*/

  const memoria = () => {
    const guardado = new Map();
    return {
      getItem: (k) => (guardado.has(k) ? guardado.get(k) : null),
      setItem: (k, v) => guardado.set(k, String(v)),
      removeItem: (k) => guardado.delete(k),
      guardado,
    };
  };

  describe("catálogo de marcos", () => {
    it("inventaria os marcos que o código comemora, cada um usado no seu lugar", () => {
      const ids = CATALOGO_DE_MARCOS.map((m) => m.id);
      expect(ids).toEqual([
        "edital-concluido",
        "edital-fechado",
        "fila-zerada",
        "vaga-pronta",
        "marco-do-ano",
        "acesso-liberado",
      ]);
      expect(new Set(ids).size).toBe(ids.length);
      // O id aparece no arquivo que dispara a comemoração.
      for (const marco of CATALOGO_DE_MARCOS) {
        const onde = readFileSync(marco.onde, "utf8");
        const lib = readFileSync("src/lib/comemoracao/comemoracao.ts", "utf8");
        expect(
          onde.includes(`"${marco.id}"`) || lib.includes(`"${marco.id}"`),
        ).toBe(true);
      }
    });

    it("o padrão: efeito só em quatro marcos; fila zerada e vaga pronta são só o aviso", () => {
      const config = normalizarConfiguracao("");
      const efeito = (id) => {
        const { efeito, intensidade } = opcoesDoMarco(config, id);
        return `${efeito}/${intensidade}`;
      };
      expect(efeito("edital-concluido")).toBe("fogos/festa");
      expect(efeito("edital-fechado")).toBe("estrelas/suave");
      expect(efeito("marco-do-ano")).toBe("fogos/normal");
      expect(efeito("acesso-liberado")).toBe("fogos/suave");
      expect(opcoesDoMarco(config, "vaga-pronta")).toMatchObject({
        ligado: true,
        som: false,
        publico: "quem-fez",
      });
      expect(
        CATALOGO_DE_MARCOS.filter((m) => m.soAviso).map((m) => m.id),
      ).toEqual(["fila-zerada", "vaga-pronta"]);
      expect(marcoSoComAviso("fila-zerada")).toBe(true);
      expect(marcoSoComAviso("edital-concluido")).toBe(false);
      // Personalizado (ou id que saiu do catálogo): só o aviso.
      expect(marcoSoComAviso("pessoal-1")).toBe(true);
      expect(marcoSoComAviso("meta-do-dia")).toBe(true);
      expect(opcoesDoMarco(config, "nao-existe")).toBeNull();
    });
  });

  describe("configuração publicada", () => {
    it("JSON quebrado, vazio ou com lixo vira o padrão; valores fora da faixa são corrigidos", () => {
      expect(serializarConfiguracao(normalizarConfiguracao("{quebrado"))).toBe(
        "",
      );
      expect(serializarConfiguracao(normalizarConfiguracao(null))).toBe("");
      const config = normalizarConfiguracao({
        marcos: {
          "edital-concluido": {
            efeito: "laser",
            intensidade: "nuclear",
            duracaoS: 99,
            publico: "area-online",
            mensagem: "x".repeat(400),
          },
          inventado: { ligado: false },
        },
      });
      const edital = opcoesDoMarco(config, "edital-concluido");
      expect(edital.efeito).toBe("fogos");
      expect(edital.intensidade).toBe("festa");
      expect(edital.duracaoS).toBe(15);
      // "Toda a área online" ainda não existe (sem tempo real por área).
      expect(edital.publico).toBe("quem-fez");
      expect(edital.mensagem).toHaveLength(160);
      expect(config.marcos.inventado).toBeUndefined();
    });

    it("configuração antiga: marcos que saíram são ignorados; marco só de aviso perde o efeito", () => {
      const antiga = JSON.stringify({
        marcos: {
          "meta-do-dia": { intensidade: "festa" },
          "fim-do-tour": { efeito: "confete" },
          "fim-da-trilha": { ligado: false },
          "fila-zerada": { efeito: "baloes", intensidade: "festa", som: true },
          "vaga-pronta": { ligado: false, mensagem: "Pronta" },
        },
        personalizados: [
          {
            id: "pessoal-1",
            nome: "Dia produtivo",
            tipo: "analises-no-dia",
            meta: 200,
            efeito: "fogos",
            intensidade: "festa",
          },
        ],
      });
      const config = normalizarConfiguracao(antiga);
      expect(Object.keys(config.marcos)).not.toContain("meta-do-dia");
      expect(Object.keys(config.marcos)).not.toContain("fim-do-tour");
      expect(opcoesDoMarco(config, "fila-zerada")).toMatchObject({
        efeito: "fogos",
        intensidade: "normal",
        som: false,
      });
      expect(config.personalizados[0].intensidade).toBe("normal");
      expect(JSON.parse(serializarConfiguracao(config))).toEqual({
        marcos: { "vaga-pronta": { ligado: false, mensagem: "Pronta" } },
        personalizados: [
          {
            id: "pessoal-1",
            nome: "Dia produtivo",
            tipo: "analises-no-dia",
            meta: 200,
          },
        ],
      });
      expect(alteracoesDasComemoracoes(antiga, antiga)).toEqual([]);
    });

    it("serializa só o que difere do padrão, estável, e volta igual", () => {
      const config = normalizarConfiguracao("");
      const mudada = {
        ...config,
        marcos: {
          ...config.marcos,
          "edital-concluido": {
            ...config.marcos["edital-concluido"],
            efeito: "confete",
            duracaoS: 8,
          },
          "marco-do-ano": { ...config.marcos["marco-do-ano"], ligado: false },
        },
      };
      const texto = serializarConfiguracao(mudada);
      expect(JSON.parse(texto)).toEqual({
        marcos: {
          "edital-concluido": { efeito: "confete", duracaoS: 8 },
          "marco-do-ano": { ligado: false },
        },
      });
      expect(serializarConfiguracao(normalizarConfiguracao(texto))).toBe(texto);
      expect(duracaoMsDasOpcoes({ duracaoS: 8 })).toBe(8000);
      expect(duracaoMsDasOpcoes({ duracaoS: null })).toBeNull();
    });

    it("duração em segundos: de 2 a 15, meio em meio; vazio é automática", () => {
      expect(normalizarDuracaoS("")).toBeNull();
      expect(normalizarDuracaoS("0")).toBeNull();
      expect(normalizarDuracaoS("1")).toBe(2);
      expect(normalizarDuracaoS("7,3")).toBe(7.5);
      expect(normalizarDuracaoS(40)).toBe(15);
    });

    it("marcos personalizados: validados, com id próprio e mensagem padrão", () => {
      const um = novoPersonalizado([]);
      const dois = novoPersonalizado([um], "analises-no-dia");
      expect(um.id).not.toBe(dois.id);
      const config = normalizarConfiguracao({
        personalizados: [
          { ...um, nome: "", edital: "" },
          { ...dois, nome: "Dia cheio", meta: 0 },
          { tipo: "desconhecido" },
        ],
      });
      expect(config.personalizados).toHaveLength(2);
      expect(errosDaConfiguracao(config)).toEqual([
        "Dê um nome ao marco personalizado 1.",
        "Marco personalizado 1: informe o número do edital.",
        "Dia cheio: a meta deve ser um número inteiro de 1 a 100.000.",
      ]);
      expect(
        mensagemDoPersonalizado({ ...um, edital: "012/2026", meta: 30 }),
      ).toBe("Edital 012/2026: 30 contratados.");
      expect(mensagemDoPersonalizado({ ...dois, meta: 1200 })).toBe(
        "1.200 análises concluídas hoje.",
      );
      expect(
        mensagemDoPersonalizado({ ...dois, meta: 50, mensagem: "Uau" }),
      ).toBe("Uau");
    });

    it("o registro guarda o que o app carregou", () => {
      definirConfiguracaoDasComemoracoes(
        JSON.stringify({ marcos: { "vaga-pronta": { ligado: false } } }),
      );
      expect(configuracaoDasComemoracoes().marcos["vaga-pronta"].ligado).toBe(
        false,
      );
      definirConfiguracaoDasComemoracoes("");
      expect(configuracaoDasComemoracoes().marcos["vaga-pronta"].ligado).toBe(
        true,
      );
    });
  });

  describe("decisão de mostrar", () => {
    const desligado = normalizarConfiguracao({
      marcos: { "fila-zerada": { ligado: false } },
    });

    it("marco desligado não aparece; o teste passa por cima", () => {
      expect(
        decidirComemoracao({ marco: "fila-zerada", config: desligado }).mostrar,
      ).toBe(false);
      expect(
        decidirComemoracao({
          marco: "fila-zerada",
          config: desligado,
          teste: true,
        }).mostrar,
      ).toBe(true);
      expect(
        decidirComemoracao({ marco: "edital-concluido", config: desligado })
          .mostrar,
      ).toBe(true);
    });

    it("a preferência pessoal desliga tudo, menos o teste; guardada neste navegador", () => {
      const armazenamento = memoria();
      expect(comemoracoesPessoaisLigadas(armazenamento)).toBe(true);
      guardarPreferenciaPessoal(armazenamento, false);
      expect(armazenamento.guardado.get(CHAVE_DA_PREFERENCIA_PESSOAL)).toBe(
        "1",
      );
      expect(comemoracoesPessoaisLigadas(armazenamento)).toBe(false);
      const pessoal = comemoracoesPessoaisLigadas(armazenamento);
      expect(
        decidirComemoracao({ marco: "edital-concluido", pessoal }).mostrar,
      ).toBe(false);
      expect(
        decidirComemoracao({ marco: "edital-concluido", pessoal, teste: true })
          .mostrar,
      ).toBe(true);
      guardarPreferenciaPessoal(armazenamento, true);
      expect(armazenamento.guardado.has(CHAVE_DA_PREFERENCIA_PESSOAL)).toBe(
        false,
      );
      // Armazenamento bloqueado: ligadas (o padrão), sem erro.
      const bloqueado = {
        getItem: () => {
          throw new Error("bloqueado");
        },
      };
      expect(comemoracoesPessoaisLigadas(bloqueado)).toBe(true);
    });
  });

  describe("marcos personalizados com dados do front", () => {
    const edital = {
      ...novoPersonalizado([]),
      id: "pessoal-1",
      nome: "Edital 12",
      edital: "012/2026",
      meta: 10,
    };
    const dia = {
      ...novoPersonalizado([edital], "analises-no-dia"),
      id: "pessoal-2",
      nome: "Dia",
      meta: 3,
    };

    it("conta contratados do edital e análises concluídas do dia", () => {
      const linhas = [
        { edital: "012/2026", contratados: 4 },
        { edital: " 012/2026 ", contratados: "5" },
        { edital: "013/2026", contratados: 50 },
        { edital: "012/2026", contratados: null },
      ];
      expect(contratadosDoEdital(linhas, "012/2026")).toBe(9);
      const analises = [
        { status_consolidado: "Apto", data_analise: "07/10/2026" },
        { status_consolidado: "Inapto", data_analise: "2026-10-07" },
        { status_consolidado: "Pendente", data_analise: "07/10/2026" },
        { status_consolidado: "Apto", data_analise: "06/10/2026" },
      ];
      expect(analisesConcluidasNoDia(analises, "2026-10-07")).toBe(2);
      expect(hojeComoChave(new Date(2026, 9, 7, 23, 0))).toBe("2026-10-07");
    });

    it("comemora a transição pela meta, uma vez; sem leitura anterior, nada", () => {
      const lista = [edital, dia];
      const antes = estadoDosPersonalizados(lista, "edital-contratados", {
        linhas: [{ edital: "012/2026", contratados: 9 }],
        dia: "2026-10-07",
      });
      expect(personalizadosAlcancados(null, antes, lista)).toEqual([]);
      const depois = estadoDosPersonalizados(lista, "edital-contratados", {
        linhas: [{ edital: "012/2026", contratados: 10 }],
        dia: "2026-10-07",
      });
      expect(personalizadosAlcancados(antes, depois, lista)).toEqual([edital]);
      expect(personalizadosAlcancados(depois, depois, lista)).toEqual([]);
      // Desligado: não comemora.
      expect(
        personalizadosAlcancados(antes, depois, [{ ...edital, ligado: false }]),
      ).toEqual([]);
    });

    it("vários alcançados na mesma leitura: só o maior", () => {
      const tres = [200, 400, 300].map((meta, i) => ({
        ...dia,
        id: `pessoal-${i + 10}`,
        meta,
      }));
      expect(maiorPersonalizado(tres)?.meta).toBe(400);
      expect(maiorPersonalizado([])).toBeNull();
    });

    it("no dia: recomeça a cada dia", () => {
      const lista = [dia];
      const ontem = { dia: "2026-10-06", valores: { "pessoal-2": 9 } };
      const hoje = { dia: "2026-10-07", valores: { "pessoal-2": 3 } };
      expect(personalizadosAlcancados(ontem, hoje, lista)).toEqual([dia]);
      const mesmoDia = { dia: "2026-10-07", valores: { "pessoal-2": 3 } };
      expect(personalizadosAlcancados(mesmoDia, hoje, lista)).toEqual([]);
    });
  });

  describe("publicação com histórico (mesma das outras seções)", () => {
    it("a chave entra nas seções, vazia por padrão, e valida os personalizados", () => {
      const campo = CAMPOS_DAS_SECOES.comemoracoes[0];
      expect(campo.chave).toBe(CHAVE_DAS_COMEMORACOES);
      expect(normalizarValoresCarregados({}).get(CHAVE_DAS_COMEMORACOES)).toBe(
        "",
      );
      const invalido = JSON.stringify({
        personalizados: [{ tipo: "analises-no-dia", nome: "", meta: 3 }],
      });
      const erros = errosDasSecoes(
        new Map([[CHAVE_DAS_COMEMORACOES, invalido]]),
      );
      expect(erros.get(CHAVE_DAS_COMEMORACOES)).toMatch(/Comemorações/);
    });

    it("a revisão mostra cada campo mudado, não o JSON", () => {
      const depois = JSON.stringify({
        marcos: { "edital-concluido": { efeito: "confete" } },
      });
      expect(alteracoesDasComemoracoes("", depois)).toEqual([
        {
          label: "Comemorações · Edital 100% analisado",
          field: "Efeito",
          before: "fogos",
          after: "confete",
        },
      ]);
      const mudancas = buildChanges(
        { configuracoes: [] },
        [{ chave: CHAVE_DAS_COMEMORACOES, valor: depois, descricao: "x" }],
        [],
      );
      expect(mudancas).toEqual([
        {
          entity: "Configuração",
          label: "Comemorações · Edital 100% analisado",
          field: "Efeito",
          before: "fogos",
          after: "confete",
        },
      ]);
    });
  });

  describe("preferência pessoal compartilhada com a mascote", () => {
    it('a chave e o formato que a arara lê: "1" = desligadas', async () => {
      const { CHAVE_COMEMORACOES_PESSOAIS } =
        await import("../src/lib/comemoracao/preferencia-de-comemoracoes.ts");
      expect(CHAVE_COMEMORACOES_PESSOAIS).toBe(
        "agsus_monitora_comemoracoes_desligadas",
      );
      expect(CHAVE_DA_PREFERENCIA_PESSOAL).toBe(CHAVE_COMEMORACOES_PESSOAIS);
      const armazenamento = memoria();
      armazenamento.setItem(CHAVE_COMEMORACOES_PESSOAIS, "1");
      expect(comemoracoesPessoaisLigadas(armazenamento)).toBe(false);
    });
  });

  describe("uma comemoração com efeito por dia", () => {
    it("a primeira do dia reserva o efeito; as seguintes, não; outro dia, de novo", () => {
      const armazenamento = memoria();
      expect(reservarEfeitoDoDia(armazenamento, "2026-11-17")).toBe(true);
      expect(armazenamento.guardado.get(CHAVE_DO_EFEITO_DO_DIA)).toBe(
        "2026-11-17",
      );
      expect(reservarEfeitoDoDia(armazenamento, "2026-11-17")).toBe(false);
      expect(reservarEfeitoDoDia(armazenamento, "2026-11-18")).toBe(true);
    });

    it("sem armazenamento (bloqueado, ausente), não há como contar: libera", () => {
      const bloqueado = {
        getItem: () => {
          throw new Error("bloqueado");
        },
        setItem: () => {},
      };
      expect(reservarEfeitoDoDia(bloqueado, "2026-11-17")).toBe(true);
      expect(reservarEfeitoDoDia(null, "2026-11-17")).toBe(true);
    });
  });

  describe("duração enquanto a pessoa digita", () => {
    it("meio digitado ou fora dos limites não aplica; vazio é automática", () => {
      expect(duracaoSAoDigitar("1")).toBeUndefined();
      expect(duracaoSAoDigitar("12")).toBe(12);
      expect(duracaoSAoDigitar("2,5")).toBe(2.5);
      expect(duracaoSAoDigitar("40")).toBeUndefined();
      expect(duracaoSAoDigitar("")).toBeNull();
    });
  });
});

bloco("chamado-da-aya", () => {
  /*
  "Abrir chamado" da Aya: um mailto: para o suporte, com assunto e corpo em
  texto puro, dentro do limite prático do mailto e sem dados pessoais de
  terceiros.
*/

  const QUANDO = new Date("2026-10-01T17:05:00Z"); // 14:05 em Brasília

  const base = {
    email: "suporte@agenciasus.org.br",
    pergunta: "Quem pode decidir um recurso?",
    resposta: "Só quem tem a permissão Parecer jurídico.",
    pagina: "Recursos",
    area: "SEDE",
    registro: "Edital 101/2026",
    versao: "Yeendé Web V2.9.35",
    quando: QUANDO,
  };

  describe("montagem do chamado", () => {
    it("assunto com página e área; corpo com pergunta, resposta e contexto", () => {
      const chamado = montarChamado(base);
      expect(chamado.para).toBe("suporte@agenciasus.org.br");
      expect(chamado.assunto).toBe("Yeendé · Chamado · Recursos · SEDE");
      expect(chamado.corpo).toContain(
        "Pergunta: Quem pode decidir um recurso?",
      );
      expect(chamado.corpo).toContain(
        "Resposta da Aya: Só quem tem a permissão Parecer jurídico.",
      );
      expect(chamado.corpo).toContain("Página: Recursos");
      expect(chamado.corpo).toContain("Área: SEDE");
      expect(chamado.corpo).toContain("Registro aberto: Edital 101/2026");
      expect(chamado.corpo).toContain(
        "Data e hora (Brasília): 01/10/2026 14:05",
      );
      expect(chamado.corpo).toContain("Versão: Yeendé Web V2.9.35");
      expect(chamado.corpo).toContain(
        "Descreva aqui o problema e anexe prints, se quiser:",
      );
      expect(chamado.corpo).not.toContain("Seção de Configurações");
    });

    it("codifica o mailto com CRLF (%0D%0A)", () => {
      const { mailto: href, assunto, corpo } = montarChamado(base);
      expect(href.startsWith("mailto:suporte@agenciasus.org.br?subject=")).toBe(
        true,
      );
      expect(href).toContain(`subject=${encodeURIComponent(assunto)}`);
      expect(href).toContain(`&body=${encodeURIComponent(corpo)}`);
      expect(href).toContain("%0D%0A");
      expect(corpo).toContain("\r\n");
      expect(href).not.toMatch(/[\s<>"]/);
    });

    it("leva a seção de Configurações quando houver", () => {
      const { corpo } = montarChamado({
        ...base,
        pagina: "Configurações › Acessos",
        area: "",
        secao: "Acessos",
      });
      expect(corpo).toContain("Seção de Configurações: Acessos");
      expect(corpo).toContain("Área: não informada");
    });

    it("corta a resposta com reticências para caber no limite", () => {
      const { corpo } = montarChamado({
        ...base,
        resposta: "ação é ".repeat(800),
      });
      expect(encodeURIComponent(corpo).length).toBeLessThanOrEqual(
        LIMITE_DO_CORPO,
      );
      expect(corpo).toMatch(/Resposta da Aya: .+…/);
      expect(corpo).toContain("Pergunta: Quem pode decidir um recurso?");
      expect(corpo).toContain("Versão: Yeendé Web V2.9.35");
    });

    it("corta também a pergunta, se só a resposta não bastar", () => {
      const { corpo } = montarChamado({
        ...base,
        pergunta: "pergunta ".repeat(500),
        resposta: "resposta ".repeat(500),
      });
      expect(encodeURIComponent(corpo).length).toBeLessThanOrEqual(
        LIMITE_DO_CORPO,
      );
      expect(corpo).toContain("Página: Recursos");
    });

    it("não leva e-mail nem CPF de terceiros", () => {
      const { corpo, href } = montarChamado({
        ...base,
        pergunta:
          "O candidato joao.silva@gmail.com, CPF 123.456.789-09, não aparece",
        resposta: "Confira 98765432100 na planilha.",
      });
      expect(corpo).not.toContain("joao.silva@gmail.com");
      expect(corpo).not.toContain("123.456.789-09");
      expect(corpo).not.toContain("98765432100");
      expect(corpo).toContain("[e-mail omitido]");
      expect(corpo).toContain("[CPF omitido]");
      expect(href).not.toContain(encodeURIComponent("joao.silva@gmail.com"));
      expect(corpo.toLowerCase()).not.toMatch(/token|bearer|senha/);
    });

    it("usa o endereço padrão quando o configurado é inválido", () => {
      expect(montarChamado({ ...base, email: "sem arroba" }).para).toBe(
        EMAIL_DO_SUPORTE_PADRAO,
      );
      expect(emailDoSuporte("")).toBe(
        "dados.recursoshumanos@agenciasus.org.br",
      );
    });
  });

  describe("peças do chamado", () => {
    it("valida e-mail", () => {
      expect(emailValido("dados.recursoshumanos@agenciasus.org.br")).toBe(true);
      expect(emailValido("nome@dominio")).toBe(false);
      expect(emailValido("nome @agenciasus.org.br")).toBe(false);
      expect(emailValido("")).toBe(false);
    });

    it("reconhece o pedido de suporte", () => {
      expect(pedeSuporte("Quero falar com o suporte")).toBe(true);
      expect(pedeSuporte("preciso abrir um chamado")).toBe(true);
      expect(pedeSuporte("Quem pode decidir um recurso?")).toBe(false);
    });

    it("formata a data de Brasília e mascara dados", () => {
      expect(dataDeBrasilia(QUANDO)).toBe("01/10/2026 14:05");
      expect(semDadosPessoais("a@b.com 111.222.333-44")).toBe(
        "[e-mail omitido] [CPF omitido]",
      );
    });
  });

  describe("e-mail do suporte em Configurações › Operação", () => {
    it("é um campo de Operação, com o padrão e validação de e-mail", () => {
      const campo = camposDaSecao("operacao").get("support_email");
      expect(campo).toMatchObject({
        rotulo: "E-mail do suporte",
        tipo: "email",
      });
      const valores = normalizarValoresCarregados({});
      expect(valores.get("support_email")).toBe(EMAIL_DO_SUPORTE_PADRAO);
      valores.set("support_email", "invalido");
      expect(errosDasSecoes(valores).get("support_email")).toContain(
        "e-mail válido",
      );
      valores.set("support_email", "suporte@agenciasus.org.br");
      expect(errosDasSecoes(valores).has("support_email")).toBe(false);
    });
  });
});

bloco("conversa-da-aya", () => {
  describe("intenções de conversa", () => {
    it.each([
      ["obrigado", "agradecimento"],
      ["Muito obrigada, Aya!", "agradecimento"],
      ["valeu", "agradecimento"],
      ["tchau", "despedida"],
      ["até mais", "despedida"],
      ["o que posso perguntar?", "ajuda"],
      ["O que eu posso perguntar?", "ajuda"],
      ["como te uso?", "ajuda"],
      ["ajuda", "ajuda"],
      ["o que você faz?", "ajuda"],
      ["e aí", "saudacao"],
      ["tudo bem?", "saudacao"],
      ["oi", "saudacao"],
      ["Boa tarde!", "saudacao"],
    ])("%s é %s, sem pergunta junto", (mensagem, intencao) => {
      const conversa = intencaoDeConversa(mensagem);
      expect(conversa.intencao).toBe(intencao);
      expect(conversa.resto).toBe("");
    });

    it("separa a saudação da pergunta", () => {
      expect(intencaoDeConversa("bom dia, como dar acesso?")).toEqual({
        intencao: "saudacao",
        saudacao: "Bom dia!",
        resto: "como dar acesso",
        pergunta: "como dar acesso",
      });
    });

    it("tira o agradecimento da pergunta, mas não o pedido de ajuda", () => {
      expect(
        intencaoDeConversa("obrigado! e quem decide o recurso?").pergunta,
      ).toBe("e quem decide o recurso");
      const ajuda = intencaoDeConversa("como funciona o processo seletivo?");
      expect(ajuda.resto).not.toBe("");
      expect(ajuda.pergunta).toBe("como funciona o processo seletivo");
    });

    it("não confunde palavra do Yeendé com conversa", () => {
      expect(intencaoDeConversa("quem pode decidir um recurso").intencao).toBe(
        "",
      );
      expect(intencaoDeConversa("oitiva").intencao).toBe("");
    });
  });

  describe("texto da conversa", () => {
    it("abre com a saudação e apresenta a página", () => {
      expect(
        textoDaConversa({
          intencao: "saudacao",
          saudacao: "Bom dia!",
          intro: "Posso explicar Recursos.",
        }),
      ).toBe(
        "Bom dia! Sou a Aya, assistente do Yeendé. Posso explicar Recursos.",
      );
    });

    it("agradece e se despede sem repetir a apresentação", () => {
      expect(
        textoDaConversa({ intencao: "agradecimento", intro: "x" }),
      ).toMatch(/^De nada!/);
      expect(textoDaConversa({ intencao: "despedida", intro: "x" })).toMatch(
        /^Até mais!/,
      );
    });

    it("explica o que a Aya faz quando pedem ajuda", () => {
      const texto = textoDaConversa({ intencao: "ajuda", intro: "Aqui é X." });
      expect(texto).toContain("editais");
      expect(texto).toContain("chamado");
      expect(texto).toMatch(/Aqui é X\.$/);
    });
  });
});

bloco("dados-da-aya", () => {
  /*
  As perguntas com número da Aya (src/lib/aya/dados-da-aya.ts): contas iguais às
  dos indicadores das telas, só leitura, respeitando a permissão do perfil
  antes de buscar, e nenhum nome na resposta.
*/

  const LINHAS = [
    {
      edital: "Edital 93/2026",
      status_consolidado: "Pendente",
      candidato: "Ana",
    },
    {
      edital: "Edital 93/2026",
      status_consolidado: "Pendente",
      candidato: "Bia",
    },
    {
      edital: "Edital 93/2026",
      status_consolidado: "Aprovado",
      candidato: "Caio",
    },
    {
      edital: "Edital 12/2026",
      status_consolidado: "Pendente",
      candidato: "Davi",
    },
  ];

  const perfil = (permissoes, extra = {}) => ({
    ativo: true,
    perfil: "usuario",
    admin_global: false,
    permissoes,
    ...extra,
  });
  const LEITOR = perfil({
    analises: "leitor",
    selecao: "leitor",
    entrevistas: "leitor",
    recursos: "leitor",
  });

  describe("contas", () => {
    it("análises do edital, com os mesmos KPIs da tela", () => {
      const n = contarAnalises(LINHAS, { edital: "93/2026" });
      expect([n.pendente, n.aprovado, n.total, n.vazio]).toEqual([
        2,
        1,
        3,
        false,
      ]);
      expect(contarAnalises(LINHAS, { edital: "1/2020" }).vazio).toBe(true);
    });

    it("convocado sem nota: sem nota final e não marcado como ausente", () => {
      const n = contarEntrevistas({
        entrevistas: [
          { edital: "93/2026", nota: null, compareceu: "" },
          { edital: "93/2026", nota: null, compareceu: "N" },
          { edital: "93/2026", nota: 15, compareceu: "S", parecer: "APTO" },
        ],
        aprovadosSemEntrevista: [{ edital: "93/2026" }],
      });
      expect([n.semNota, n.semEntrevista, n.aptos]).toEqual([1, 1, 1]);
    });

    it("funil da Seleção", () => {
      const n = contarSelecao([
        { edital: "5/2026", aprovados: 10, contratados: 4, inscritos: 100 },
        { edital: "6/2026", aprovados: 10, contratados: 6, inscritos: 50 },
      ]);
      expect([n.inscritos, n.contratados, n.taxa]).toEqual([150, 10, 0.5]);
    });
  });

  describe("responder com dados", () => {
    it("pergunta comum segue para a base (null)", async () => {
      expect(
        await responderComDados({
          pergunta: "o que é recurso?",
          perfil: LEITOR,
        }),
      ).toBeNull();
    });

    it("conta, responde só números e oferece Abrir com o filtro", async () => {
      const buscar = vi.fn(async () => ({ linhas: LINHAS }));
      const r = await responderComDados({
        pergunta: "quantas análises pendentes tem o 93/2026?",
        contexto: { view: "dashboard", area: "sede" },
        perfil: LEITOR,
        buscar,
      });
      expect(buscar).toHaveBeenCalledWith("analises", {
        area: "sede",
        cargaDe: undefined,
      });
      expect(r.answer).toBe(
        "Há 2 análises pendentes no edital 93/2026 na SEDE, de 3 no total.",
      );
      for (const nome of ["Ana", "Bia", "Caio", "Davi"])
        expect(r.answer).not.toContain(nome);
      expect(r.provider).toBe("monitora-dados");
      expect(r.acaoDados).toEqual({
        view: "analises",
        filtro: { edital: "93/2026", metrica: "pendente" },
      });
    });

    it("sem permissão da tela, não busca e diz por quê", async () => {
      const buscar = vi.fn();
      const r = await responderComDados({
        pergunta: "quantos recursos aguardando parecer?",
        perfil: perfil({ analises: "leitor" }),
        buscar,
      });
      expect(buscar).not.toHaveBeenCalled();
      expect(r.answer).toContain("não inclui Recursos");
    });

    it("Status das atualizações só para o administrador global", async () => {
      const buscar = vi.fn(async () => ({}));
      const r = await responderComDados({
        pergunta: "tem alguma carga atrasada?",
        perfil: LEITOR,
        buscar,
      });
      expect(buscar).not.toHaveBeenCalled();
      expect(r.answer).toContain("administrador global");
    });

    it("erro de acesso do banco vira 'sem acesso', sem dado", async () => {
      const r = await responderComDados({
        pergunta: "quantos inscritos?",
        contexto: { view: "selecao", area: "projetos" },
        perfil: LEITOR,
        buscar: async () => {
          throw { code: "42501", message: "permission denied" };
        },
      });
      expect(r.answer).toBe(
        "Seu acesso não deixa ver esses dados da Projetos.",
      );
    });

    it("edital que não está nos dados", async () => {
      const r = await responderComDados({
        pergunta: "quantas análises pendentes no 1/2020?",
        perfil: LEITOR,
        buscar: async () => ({ linhas: LINHAS }),
      });
      expect(r.answer).toContain("Não achei o edital 1/2020");
    });

    it("última carga pela fonte da pergunta", async () => {
      const buscar = vi.fn(async () => ({ em: "2026-10-05T12:00:00Z" }));
      const r = await responderComDados({
        pergunta: "quando foi a última carga das entrevistas?",
        contexto: { area: "saude-indigena" },
        perfil: LEITOR,
        buscar,
      });
      expect(buscar).toHaveBeenCalledWith("conferencia", {
        area: "saude-indigena",
        cargaDe: "entrevistas",
      });
      expect(r.answer).toContain("09:00");
    });
  });

  describe("pedido de filtro (Abrir)", () => {
    it("vale uma vez, só para a tela pedida e por pouco tempo", () => {
      pedirFiltro("analises", { edital: "93/2026" }, 1000);
      expect(consumirPedidoDeFiltro("recursos", 1000)).toBeNull();
      pedirFiltro("analises", { edital: "93/2026" }, 1000);
      expect(consumirPedidoDeFiltro("analises", 2000)).toEqual({
        edital: "93/2026",
      });
      expect(consumirPedidoDeFiltro("analises", 2000)).toBeNull();
      pedirFiltro("analises", { edital: "1/2026" }, 1000);
      expect(consumirPedidoDeFiltro("analises", 60_000)).toBeNull();
    });
  });

  describe("cargas que pedem atenção (pergunta 'alguma carga atrasada?')", () => {
    const AGORA = new Date("2026-10-01T12:00:00Z");
    const ha = (min) => new Date(AGORA.getTime() - min * 60000).toISOString();
    const execucao = (situacao, minAtras, extra = {}) => ({
      inicio: ha(minAtras + 1),
      fim: ha(minAtras),
      situacao,
      ...extra,
    });

    it("usa a visão simples da tela: conta as linhas e lista só as que pedem atenção", () => {
      const r = cargasQuePedemAtencao(
        {
          analises: [
            {
              origem: "apps_script_analises_incremental_v1",
              area: "saude-indigena",
              tipo: "INCREMENTAL",
              execucoes: [execucao("processado", 10)],
            },
            {
              origem: "apps_script_analises_projetos_incremental_v1",
              area: "projetos",
              tipo: "INCREMENTAL",
              execucoes: [execucao("erro", 5, { mensagem: "Timeout" })],
            },
          ],
        },
        AGORA,
      );
      expect(r.atrasadas).toEqual([
        "Análises curriculares · Projetos (falhou)",
      ]);
      expect(r.total).toBeGreaterThan(2);
    });

    it("sem dado nenhum não lança: responde com as linhas vazias da visão", () => {
      expect(() => cargasQuePedemAtencao(null, AGORA)).not.toThrow();
    });
  });
});

bloco("filtro-da-aya", () => {
  /*
  O "Abrir" das respostas com número da Aya vira os filtros de cada tela
  (src/lib/aya/filtro-da-aya.ts): o edital pelo número, a métrica pelo filtro
  do indicador; o que não casa fica como estava.
*/

  describe("filtro pedido pela Aya", () => {
    it("edital pelo número, em opções de objeto ou de texto", () => {
      expect(
        opcoesDoEdital(
          [
            { valor: "10", rotulo: "Edital 93/2026 · DSEI X" },
            { valor: "11", rotulo: "Edital 12/2026" },
          ],
          "93/2026",
        ),
      ).toEqual(["10"]);
      expect(opcoesDoEdital(["93/2025", "93/2026"], "93")).toEqual([
        "93/2025",
        "93/2026",
      ]);
      expect(opcoesDoEdital(["93/2026"], "")).toEqual([]);
    });

    it("Recursos: edital pelo id e o indicador", () => {
      const opcoes = { editais: [{ valor: "7", rotulo: "93/2026 · DSEI" }] };
      expect(
        filtrosDeRecursos(
          { edital: "", situacao: "", pendencia: "" },
          { edital: "93/2026", metrica: "atrasados" },
          opcoes,
        ),
      ).toEqual({ edital: "7", situacao: "", pendencia: "prazo_vencido" });
      expect(
        filtrosDeRecursos({ edital: "1" }, { edital: "5/2020" }, opcoes),
      ).toEqual({ edital: "1" });
    });

    it("Entrevistas e Seleção", () => {
      expect(
        filtrosDeEntrevistas(
          { edital: "", parecer: "" },
          { edital: "93/2026", metrica: "aptos" },
          { editais: [{ valor: "93/2026", rotulo: "93/2026" }] },
        ),
      ).toEqual({ edital: "93/2026", parecer: "APTO" });
      expect(
        filtrosDaSelecao(
          { editais: [], unidades: [] },
          { edital: "93/2026" },
          { editais: ["Edital 93/2026", "Edital 1/2026"] },
        ),
      ).toEqual({ editais: ["Edital 93/2026"], unidades: [] });
    });
  });

  describe("Análises", () => {
    it("editais pelo valor da linha e o KPI da métrica", () => {
      const linhas = [{ edital: "110/2026" }, { edital: "12/2026" }, {}];
      expect(
        filtrosDasAnalises(
          { edital: [], status: [] },
          { edital: "110/2026", metrica: "pendente" },
          linhas,
        ),
      ).toEqual({
        filtros: { edital: ["110/2026"], status: [] },
        kpi: "pendente",
      });
      expect(
        filtrosDasAnalises(
          { edital: ["x"] },
          { metrica: "total" },
          linhas,
          "revisar",
        ),
      ).toEqual({ filtros: { edital: ["x"] }, kpi: "revisar" });
    });
  });

  /*
    Um número da Visão geral abre a Lista de aprovados no edital, pelo id (o
    mesmo número pode estar em mais de uma unidade), com o status do número.
  */
  describe("Lista de aprovados pelo número da Visão geral", () => {
    const opcoes = [
      { valor: "uuid-a", rotulo: "80/2025 · DSEI Xingu" },
      { valor: "uuid-b", rotulo: "80/2025 · DSEI Yanomami" },
    ];

    it("o edital pelo id e Contratados como Contratado e Migração", () => {
      expect(
        filtrosDosAprovados(
          { editalId: "uuid-b", edital: "80/2025", metrica: "contratados" },
          opcoes,
        ),
      ).toEqual({ editalId: ["uuid-b"], status: ["Contratado", "Migração"] });
    });

    it("Aguardando chamada é Sem status; Aprovados, sem status", () => {
      expect(
        filtrosDosAprovados(
          { editalId: "uuid-a", metrica: "aguardandoChamada" },
          opcoes,
        )?.status,
      ).toEqual([SEM_STATUS]);
      expect(
        filtrosDosAprovados(
          { editalId: "uuid-a", metrica: "aprovados" },
          opcoes,
        )?.status,
      ).toEqual([]);
    });

    it("sem o id nas opções, o primeiro pelo número; sem nenhum, nada", () => {
      expect(
        filtrosDosAprovados({ editalId: "x", edital: "80/2025" }, opcoes)
          ?.editalId,
      ).toEqual(["uuid-a"]);
      expect(filtrosDosAprovados({ edital: "99/2026" }, opcoes)).toBeNull();
      expect(filtrosDosAprovados(null, opcoes)).toBeNull();
    });
  });
});

bloco("fogos-cena", () => {
  /* A cena dos fogos: o voo da Aya, o véu e a regra do som (sem DOM). */
  const tela = { largura: 1280, altura: 720 };

  function armazenamentoFalso() {
    const dados = new Map();
    return {
      getItem: (k) => (dados.has(k) ? dados.get(k) : null),
      setItem: (k, v) => dados.set(k, String(v)),
      removeItem: (k) => dados.delete(k),
    };
  }

  describe("o voo da Aya", () => {
    it("atravessa a tela da esquerda para a direita, entrando e saindo por fora", () => {
      const trajeto = trajetoDaAya(tela);
      const inicio = posicaoDaAya(trajeto, 0);
      const fim = posicaoDaAya(trajeto, trajeto.duracao);
      expect(inicio.x).toBeLessThan(0);
      expect(fim.x).toBeGreaterThan(tela.largura);
      expect(fim.y).toBeLessThan(inicio.y);
      // Sempre avançando para a direita.
      let antes = -Infinity;
      for (let t = 0; t <= trajeto.duracao; t += 0.05) {
        const { x } = posicaoDaAya(trajeto, t);
        expect(x).toBeGreaterThanOrEqual(antes);
        antes = x;
      }
      expect(posicaoDaAya(trajeto, -0.1)).toBeNull();
      expect(posicaoDaAya(trajeto, trajeto.duracao + 0.1)).toBeNull();
      expect(posicaoDaAya(null, 1)).toBeNull();
    });

    it("bate as asas (escala oscila) e inclina pouco", () => {
      const trajeto = trajetoDaAya(tela);
      const escalas = new Set();
      for (let t = 0.3; t < 1.8; t += 0.03) {
        const aya = posicaoDaAya(trajeto, t);
        escalas.add(aya.escalaY.toFixed(2));
        expect(Math.abs(aya.rotacao)).toBeLessThanOrEqual(0.52);
        expect(aya.escalaY).toBeGreaterThan(0.85);
        expect(aya.escalaY).toBeLessThanOrEqual(1);
      }
      expect(escalas.size).toBeGreaterThan(4);
      expect(posicaoDaAya(trajeto, 1).opacidade).toBe(1);
    });

    it("solta o foguete dentro da tela, logo abaixo dela; tamanho limitado", () => {
      const trajeto = trajetoDaAya(tela);
      const soltura = pontoDaSoltura(trajeto);
      const aya = posicaoDaAya(trajeto, VOO_DA_AYA.soltura);
      expect(soltura.x).toBeGreaterThan(0);
      expect(soltura.x).toBeLessThan(tela.largura);
      expect(soltura.y).toBeGreaterThan(aya.y);
      expect(trajeto.tamanho).toBeLessThanOrEqual(128);
      expect(trajetoDaAya({ largura: 320, altura: 400 }).tamanho).toBe(64);
    });
  });

  describe("véu", () => {
    it("entra, fica e sai antes do fim", () => {
      expect(opacidadeDoVeu(0, 5.5)).toBe(0);
      expect(opacidadeDoVeu(0.25, 5.5)).toBeCloseTo(0.5);
      expect(opacidadeDoVeu(2, 5.5)).toBe(1);
      expect(opacidadeDoVeu(5.5 - 0.35, 5.5)).toBeCloseTo(0.5);
      expect(opacidadeDoVeu(5.5, 5.5)).toBe(0);
    });
  });

  describe("som", () => {
    it("desligado por padrão; a escolha fica guardada", () => {
      const armazenamento = armazenamentoFalso();
      expect(somLigado(armazenamento)).toBe(false);
      expect(somLigado(null)).toBe(false);
      expect(guardarSom(armazenamento, true)).toBe(true);
      expect(armazenamento.getItem(CHAVE_DO_SOM)).toBe("1");
      expect(somLigado(armazenamento)).toBe(true);
      guardarSom(armazenamento, false);
      expect(somLigado(armazenamento)).toBe(false);
    });

    it("armazenamento bloqueado: mudo, sem erro", () => {
      const bloqueado = {
        getItem: () => {
          throw new Error("bloqueado");
        },
        setItem: () => {
          throw new Error("bloqueado");
        },
      };
      expect(somLigado(bloqueado)).toBe(false);
      expect(guardarSom(bloqueado, true)).toBe(false);
    });

    it("só toca ligado E depois de a pessoa interagir", () => {
      expect(podeTocarSom({ ligado: false, interagiu: true })).toBe(false);
      expect(podeTocarSom({ ligado: true, interagiu: false })).toBe(false);
      expect(podeTocarSom({ ligado: true, interagiu: true })).toBe(true);
    });

    it("o som de cada estouro: grave no marco, crepitar no glitter, estalo no resto", () => {
      expect(somDoEstouro({ papel: "marco", formato: "marco" }).tipo).toBe(
        "grave",
      );
      expect(somDoEstouro({ papel: "comum", formato: "glitter" }).tipo).toBe(
        "crepitar",
      );
      const final = somDoEstouro({ papel: "final", formato: "peonia" });
      const comum = somDoEstouro({ papel: "comum", formato: "peonia" });
      expect(final.tipo).toBe("estalo");
      expect(final.volume).toBeLessThan(comum.volume);
      expect(somDoEstouro().tipo).toBe("estalo");
    });
  });
});

bloco("fogos-danca-e-som", () => {
  /*
  O que deixa os fogos mais divertidos, sem DOM: a dança da Aya no fim, o
  confete que ela solta (motor), o
  som sintetizado (com um áudio falso que registra os nós) e a queda
  automática de qualidade. Sorteio fixo.
*/
  const tela = { largura: 1280, altura: 720 };

  describe("a dança da Aya", () => {
    const trajeto = trajetoDaAya(tela);

    it("começa depois do voo, termina antes do fim e solta o confete no meio", () => {
      for (const duracao of [5, 5.5, 6, 15]) {
        const danca = dancaDaAya(trajeto, { ...tela, duracao });
        expect(danca.inicio).toBeGreaterThan(trajeto.inicio + trajeto.duracao);
        expect(danca.inicio + danca.duracao).toBeLessThan(duracao);
        expect(danca.duracao).toBeLessThanOrEqual(DANCA_DA_AYA.maxima + 1e-9);
        expect(danca.confete).toBeGreaterThan(danca.inicio + DANCA_DA_AYA.giro);
        expect(danca.confete).toBeLessThan(danca.inicio + danca.duracao);
        // No canto de baixo, à esquerda, sem sair da tela.
        expect(danca.x).toBeLessThan(tela.largura * 0.3);
        expect(danca.y + danca.tamanho / 2).toBeLessThanOrEqual(tela.altura);
      }
      // Show curto demais (ou sem o voo): sem dança.
      expect(dancaDaAya(trajeto, { ...tela, duracao: 4 })).toBeNull();
      expect(dancaDaAya(null, { ...tela, duracao: 6 })).toBeNull();
    });

    it("sobe do pé da tela, pula no ritmo, dá uma cambalhota inteira e desce", () => {
      const danca = dancaDaAya(trajeto, { ...tela, duracao: 6 });
      const em = (s) => posicaoNaDanca(danca, danca.inicio + s);
      expect(posicaoNaDanca(danca, danca.inicio - 0.01)).toBeNull();
      expect(posicaoNaDanca(danca, danca.inicio + danca.duracao + 0.01)).toBe(
        null,
      );
      // Entra de baixo e aparece aos poucos.
      expect(em(0).y).toBeGreaterThan(em(DANCA_DA_AYA.entrada).y);
      expect(em(0).opacidade).toBe(0);
      // Pulinhos: a altura varia no ritmo.
      const alturas = new Set();
      for (let s = 0.4; s < DANCA_DA_AYA.cambalhota; s += 0.05)
        alturas.add(Math.round(em(s).y));
      expect(alturas.size).toBeGreaterThan(4);
      // A cambalhota: uma volta inteira (para trás), no alto.
      const { cambalhota, giro } = DANCA_DA_AYA;
      expect(em(cambalhota).rotacao).toBeCloseTo(0, 6);
      expect(em(cambalhota + giro / 2).rotacao).toBeCloseTo(-Math.PI, 6);
      expect(em(cambalhota + giro).rotacao).toBeCloseTo(-2 * Math.PI, 6);
      expect(em(cambalhota + giro / 2).y).toBeLessThan(
        danca.y - danca.tamanho * 0.5,
      );
      // Sai descendo, apagando.
      const fim = danca.duracao;
      expect(em(fim).opacidade).toBe(0);
      expect(em(fim).y).toBeGreaterThan(danca.y + danca.tamanho * 0.5);
    });
  });

  describe("o som de cada evento", () => {
    it("assobio no lançamento (com a subida), pop na rajada e no confete, grave no marco", () => {
      const assobio = somDoEstouro({
        tipo: "lancamento",
        papel: "comum",
        subida: 0.9,
      });
      expect(assobio).toEqual({ tipo: "assobio", volume: 0.35, duracao: 0.9 });
      // Subida absurda é limitada.
      expect(somDoEstouro({ tipo: "lancamento", subida: 9 }).duracao).toBe(1.6);
      expect(somDoEstouro({ tipo: "confete", papel: "aya" }).tipo).toBe("pop");
      expect(somDoEstouro({ tipo: "estouro", papel: "rajada" }).tipo).toBe(
        "pop",
      );
      expect(somDoEstouro({ tipo: "estouro", papel: "marco" }).tipo).toBe(
        "grave",
      );
      expect(
        somDoEstouro({ tipo: "estouro", papel: "comum", formato: "crepitante" })
          .tipo,
      ).toBe("crepitar");
      // A apoteose, muitos juntos: mais baixo que o grande final.
      const apoteose = somDoEstouro({ papel: "apoteose", formato: "peonia" });
      const final = somDoEstouro({ papel: "final", formato: "peonia" });
      expect(apoteose.tipo).toBe("estalo");
      expect(apoteose.volume).toBeLessThan(final.volume);
    });
  });

  describe("o confete da Aya (motor)", () => {
    it("a cena dos fogos com a Aya dançando usa o motor e o confete sai dela", () => {
      const cena = criarCena({
        ...tela,
        efeito: "fogos",
        intensidade: "festa",
        aleatorio: criarAleatorio(4),
      });
      expect(cena.lotes).toHaveLength(0);
      expect(cena.usaMotor).toBe(true);
      const { danca } = cena.show;
      let primeiroConfete = null;
      while (!cenaAcabou(cena)) {
        avancarCena(cena, 1 / 60);
        if (!primeiroConfete && cena.particulas.length)
          primeiroConfete = {
            t: cena.t,
            // Cópias: as partículas continuam andando depois.
            particulas: cena.particulas.map((p) => ({ ...p })),
          };
      }
      expect(primeiroConfete.t).toBeGreaterThanOrEqual(danca.confete);
      expect(primeiroConfete.t).toBeLessThan(danca.confete + 0.05);
      expect(
        primeiroConfete.particulas.every((p) => p.tipo === "confete"),
      ).toBe(true);
      expect(primeiroConfete.particulas.length).toBeGreaterThan(
        CONFETE_DA_AYA * 0.8,
      );
      // Saem perto dela e para cima.
      for (const p of primeiroConfete.particulas) {
        expect(Math.abs(p.x - danca.x)).toBeLessThan(40);
        expect(p.vy).toBeLessThan(0);
      }
      // Sem a Aya (o "combinado" chama a mascote) e no Suave: sem dança.
      expect(
        criarCena({ ...tela, efeito: "fogos", intensidade: "suave" }).usaMotor,
      ).toBe(false);
      expect(
        criarCena({ ...tela, efeito: "fogos", comAya: false }).usaMotor,
      ).toBe(false);
      // O confete respeita o teto do motor.
      const apertada = criarCena({
        ...tela,
        efeito: "fogos",
        intensidade: "festa",
        limite: 10,
        aleatorio: criarAleatorio(4),
      });
      let maximo = 0;
      while (!cenaAcabou(apertada)) {
        avancarCena(apertada, 1 / 60);
        maximo = Math.max(maximo, apertada.particulas.length);
      }
      expect(maximo).toBe(10);
    });
  });

  describe("desempenho: a qualidade cai sozinha", () => {
    it("a 60 fps fica tudo; abaixo de ~45 fps por um tempo, cai um nível de cada vez e não volta", () => {
      const rapido = criarMedidor();
      for (let i = 0; i < 300; i += 1) registrarQuadro(rapido, 16.7);
      expect(rapido.qualidade).toBe(2);

      const lento = criarMedidor();
      const quedas = [];
      for (let i = 0; i < 200; i += 1)
        if (registrarQuadro(lento, 40)) quedas.push(i);
      expect(quedas).toHaveLength(2);
      expect(quedas[0]).toBeGreaterThanOrEqual(QUADROS_PARA_DECIDIR - 1);
      expect(lento.qualidade).toBe(0);
      // Fica no nível mais baixo, mesmo se melhorar.
      for (let i = 0; i < 300; i += 1) registrarQuadro(lento, 10);
      expect(lento.qualidade).toBe(0);
      expect(AJUSTE_DA_QUALIDADE[0].particulas).toBeLessThan(
        AJUSTE_DA_QUALIDADE[1].particulas,
      );
    });

    it("pausa (aba voltando, depurador) e quadro zerado não contam como lentidão", () => {
      const medidor = criarMedidor();
      for (let i = 0; i < 100; i += 1) {
        registrarQuadro(medidor, QUADRO_IGNORADO_MS + 1);
        registrarQuadro(medidor, 0);
      }
      expect(medidor.qualidade).toBe(2);
      expect(medidor.quadros).toBe(0);
    });
  });

  describe("o som sintetizado", () => {
    /* Áudio falso: registra cada nó criado e o relógio anda à mão. */
    function audioFalso() {
      const nos = [];
      const parametro = () => ({
        value: 0,
        setValueAtTime() {},
        exponentialRampToValueAtTime() {},
      });
      const no = (tipo) => {
        const n = {
          tipo,
          gain: parametro(),
          frequency: parametro(),
          Q: parametro(),
          delayTime: parametro(),
          playbackRate: parametro(),
          connect() {},
          start() {},
          stop() {},
        };
        nos.push(n);
        return n;
      };
      class Audio {
        constructor() {
          this.sampleRate = 8000;
          this.currentTime = 0;
          this.destination = no("destino");
        }
        createGain = () => no("ganho");
        createOscillator = () => no("oscilador");
        createBufferSource = () => no("fonte");
        createBiquadFilter = () => no("filtro");
        createDelay = () => no("atraso");
        createBuffer = (_, tamanho) => {
          const dados = new Float32Array(tamanho);
          return { getChannelData: () => dados };
        };
        resume() {}
        close() {}
      }
      let audio = null;
      const janela = {
        AudioContext: class extends Audio {
          constructor() {
            super();
            audio = this;
          }
        },
        localStorage: { getItem: () => "1", setItem() {}, removeItem() {} },
        navigator: { userActivation: { hasBeenActive: true } },
      };
      return { janela, nos, audio: () => audio };
    }

    it("estouro, assobio, crepitar e pop com ruído filtrado e envelopes; o eco nasce uma vez", () => {
      const { janela, nos } = audioFalso();
      const som = criarSom(janela);
      for (const tipo of ["estalo", "grave", "assobio", "crepitar", "pop"])
        expect(som.tocar({ tipo, volume: 0.5, duracao: 0.8 })).toBe(true);
      const contar = (tipo) => nos.filter((n) => n.tipo === tipo).length;
      expect(contar("filtro")).toBeGreaterThan(8);
      expect(contar("oscilador")).toBeGreaterThan(5);
      expect(contar("fonte")).toBeGreaterThan(5);
      // O eco (atraso com realimentação): um só para o áudio inteiro.
      expect(contar("atraso")).toBe(1);
    });

    it("muitos estouros juntos não empilham vozes (o grave passa)", () => {
      const { janela, audio } = audioFalso();
      const som = criarSom(janela);
      const tocados = Array.from({ length: 20 }, () =>
        som.tocar({ tipo: "estalo", volume: 0.5 }),
      );
      expect(tocados.filter(Boolean)).toHaveLength(VOZES_SIMULTANEAS);
      expect(som.tocar({ tipo: "grave", volume: 0.9 })).toBe(true);
      // Passada a janela, volta a tocar.
      audio().currentTime = JANELA_DAS_VOZES + 0.01;
      expect(som.tocar({ tipo: "estalo", volume: 0.5 })).toBe(true);
    });
  });
});

bloco("fogos-formas", () => {
  /*
  O marco desenhado no céu: forma → pontos-alvo. Sem sorteio (as formas são
  determinísticas) e sem canvas (a imagem do texto é montada à mão).
*/
  const tela = { largura: 1280, altura: 720 };
  const dentro = (pontos, { cx, cy, larguraMax, alturaMax }) =>
    pontos.every(
      (p) =>
        Math.abs(p.x - cx) <= larguraMax / 2 + 1e-6 &&
        Math.abs(p.y - cy) <= alturaMax / 2 + 1e-6,
    );

  /* Uma imagem RGBA com um retângulo opaco em [x0, x1) × [y0, y1). */
  function imagemComRetangulo(largura, altura, [x0, y0, x1, y1]) {
    const data = new Uint8ClampedArray(largura * altura * 4);
    for (let y = y0; y < y1; y += 1)
      for (let x = x0; x < x1; x += 1) data[(y * largura + x) * 4 + 3] = 255;
    return { data, width: largura, height: altura };
  }

  describe("formas pedidas", () => {
    it("normaliza: coração, estrela, visto e texto curto; o resto, sem forma", () => {
      expect(normalizarForma("coracao")).toEqual({ tipo: "coracao" });
      expect(normalizarForma({ tipo: "estrela" })).toEqual({ tipo: "estrela" });
      expect(normalizarForma({ tipo: "numero", texto: " 2.500 " })).toEqual({
        tipo: "texto",
        texto: "2.500",
      });
      expect(normalizarForma({ tipo: "texto", texto: "123456789" }).texto).toBe(
        "12345678",
      );
      expect(normalizarForma("foguete")).toBeNull();
      expect(normalizarForma({ tipo: "numero", texto: "" })).toBeNull();
      expect(normalizarForma(null)).toBeNull();
      expect(pontosDaForma("foguete", tela)).toEqual([]);
    });
  });

  describe("contornos", () => {
    it("coração: simétrico, mais largo em cima, com a ponta embaixo", () => {
      const pontos = contornoDoCoracao(200);
      expect(pontos).toHaveLength(200);
      const xs = pontos.map((p) => p.x);
      const ys = pontos.map((p) => p.y);
      expect(Math.max(...xs)).toBeCloseTo(-Math.min(...xs), 2);
      // A ponta (y máximo, para baixo) fica no meio.
      const ponta = pontos.reduce((a, b) => (b.y > a.y ? b : a));
      expect(Math.abs(ponta.x)).toBeLessThan(0.05);
      // O "vão" entre os dois lóbulos: no meio, o ponto mais alto fica abaixo dos lóbulos.
      const noMeio = pontos.filter((p) => Math.abs(p.x) < 0.05);
      expect(Math.min(...noMeio.map((p) => p.y))).toBeGreaterThan(
        Math.min(...ys),
      );
    });

    it("estrela: cinco pontas, uma para cima, pontos igualmente espaçados", () => {
      const pontos = contornoDaEstrela(100);
      expect(pontos).toHaveLength(100);
      const topo = pontos.reduce((a, b) => (b.y < a.y ? b : a));
      expect(topo.x).toBeCloseTo(0, 6);
      expect(topo.y).toBeCloseTo(-1, 6);
      const raios = pontos.map((p) => Math.hypot(p.x, p.y));
      expect(Math.max(...raios)).toBeCloseTo(1, 6);
      expect(Math.min(...raios)).toBeGreaterThan(0.4);
      // Pontas: máximos locais do raio.
      const pontas = raios.filter(
        (r, i) =>
          r > raios[(i + 99) % 100] && r >= raios[(i + 1) % 100] && r > 0.95,
      );
      expect(pontas).toHaveLength(5);
      const distancias = pontos.map((p, i) => {
        const q = pontos[(i + 1) % 100];
        return Math.hypot(q.x - p.x, q.y - p.y);
      });
      expect(Math.max(...distancias) - Math.min(...distancias)).toBeLessThan(
        0.02,
      );
    });

    it("visto: três traços paralelos, descendo e subindo à direita", () => {
      const pontos = tracoDoCheck(90);
      expect(pontos).toHaveLength(90);
      const fundo = pontos.reduce((a, b) => (b.y > a.y ? b : a));
      const esquerda = pontos.reduce((a, b) => (b.x < a.x ? b : a));
      const direita = pontos.reduce((a, b) => (b.x > a.x ? b : a));
      expect(fundo.x).toBeGreaterThan(esquerda.x);
      expect(fundo.x).toBeLessThan(direita.x);
      // A haste direita sobe mais que a esquerda.
      expect(direita.y).toBeLessThan(esquerda.y);
    });
  });

  describe("texto", () => {
    it("pontos de uma imagem: só onde é opaco, a cada `passo`", () => {
      const imagem = imagemComRetangulo(40, 20, [10, 4, 30, 16]);
      const pontos = pontosDaImagem(imagem, { passo: 4 });
      expect(pontos.length).toBeGreaterThan(0);
      expect(
        pontos.every((p) => p.x >= 10 && p.x < 30 && p.y >= 4 && p.y < 16),
      ).toBe(true);
      expect(pontosDaImagem(null)).toEqual([]);
      // O passo da grade dá no máximo a quantidade pedida.
      const grande = imagemComRetangulo(400, 200, [0, 0, 400, 200]);
      const passo = passoParaCaber(grande, 300);
      expect(pontosDaImagem(grande, { passo }).length).toBeLessThanOrEqual(300);
      expect(pontosDaImagem(grande, { passo }).length).toBeGreaterThan(150);
    });

    it("número: da imagem do canvas quando há, da fonte de pontos quando não há", () => {
      const largura = 300;
      const imagem = imagemComRetangulo(largura, 100, [20, 20, 280, 80]);
      const daImagem = pontosDaForma(
        { tipo: "numero", texto: "1.000" },
        { ...tela, quantidade: 120, amostrarTexto: () => imagem },
      );
      expect(daImagem.length).toBeGreaterThan(40);
      expect(daImagem.length).toBeLessThanOrEqual(120);
      expect(dentro(daImagem, caixaDaForma(tela))).toBe(true);

      // Sem canvas (ou se ele falhar): a fonte 5×7 dá conta do número.
      const daFonte = pontosDaForma(
        { tipo: "numero", texto: "2.500" },
        {
          ...tela,
          quantidade: 400,
          amostrarTexto: () => {
            throw new Error("sem canvas");
          },
        },
      );
      expect(daFonte).toHaveLength(pontosDoTextoNaFonte("2.500").length);
      expect(dentro(daFonte, caixaDaForma(tela))).toBe(true);
    });

    it("a fonte de pontos tem os dígitos e separadores, e o texto cresce para a direita", () => {
      for (const c of "0123456789.,%+")
        expect(FONTE_DE_PONTOS[c]).toHaveLength(7);
      const um = pontosDoTextoNaFonte("1");
      const mil = pontosDoTextoNaFonte("1.000");
      expect(um).toHaveLength(
        FONTE_DE_PONTOS[1].join("").replace(/0/g, "").length * 4,
      );
      expect(Math.max(...mil.map((p) => p.x))).toBeGreaterThan(
        Math.max(...um.map((p) => p.x)) * 3,
      );
    });
  });

  describe("ajuste à tela", () => {
    it("cabe na caixa sem distorcer e fica centrado", () => {
      const quadrado = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 0, y: 10 },
        { x: 10, y: 10 },
      ];
      const ajustado = ajustarPontos(quadrado, {
        cx: 100,
        cy: 50,
        larguraMax: 200,
        alturaMax: 40,
      });
      const xs = ajustado.map((p) => p.x);
      const ys = ajustado.map((p) => p.y);
      expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(40);
      expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(40);
      expect((Math.max(...xs) + Math.min(...xs)) / 2).toBeCloseTo(100);
      expect(
        ajustarPontos([], { cx: 0, cy: 0, larguraMax: 1, alturaMax: 1 }),
      ).toEqual([]);
    });

    it("reduz sem sorteio, espaçado", () => {
      const lista = Array.from({ length: 100 }, (_, i) => ({ x: i, y: 0 }));
      expect(reduzirPontos(lista, 10).map((p) => p.x)).toEqual([
        0, 10, 20, 30, 40, 50, 60, 70, 80, 90,
      ]);
      expect(reduzirPontos(lista, 500)).toBe(lista);
    });

    it("coração, estrela e visto na tela: dentro da caixa, abaixo do aviso do topo", () => {
      const caixa = caixaDaForma(tela);
      expect(caixa.cy - caixa.alturaMax / 2).toBeGreaterThan(140);
      for (const forma of ["coracao", "estrela", "check"]) {
        const pontos = pontosDaForma(forma, { ...tela, quantidade: 300 });
        expect(pontos.length).toBeGreaterThan(40);
        expect(pontos.length).toBeLessThanOrEqual(300 * 1.4);
        expect(dentro(pontos, { ...caixa, larguraMax: caixa.larguraMax })).toBe(
          true,
        );
      }
      // Tela de celular: continua dentro da largura.
      const celular = { largura: 375, altura: 700 };
      const pontos = pontosDaForma("coracao", celular);
      expect(pontos.every((p) => p.x > 0 && p.x < celular.largura)).toBe(true);
    });
  });
});

bloco("fogos", () => {
  /*
  Tudo com sorteio fixo (criarAleatorio): nada aqui depende de Math.random.
*/
  const tela = { largura: 1280, altura: 720 };
  const pontosDeTeste = Array.from({ length: 40 }, (_, i) => ({
    x: 500 + i * 7,
    y: 280 + (i % 5) * 6,
  }));

  /* Roda o show até acabar; devolve o máximo de partículas e os quadros. */
  function rodar(show, limiteDeQuadros = 1000) {
    let maximo = 0;
    let quadros = 0;
    while (!showAcabou(show) && quadros < limiteDeQuadros) {
      avancarShow(show, 1 / 60);
      maximo = Math.max(maximo, show.particulas.length);
      quadros += 1;
    }
    return { maximo, quadros };
  }

  describe("roteiro do show", () => {
    it("as durações ficam entre 5 e 6 s e o padrão é DURACAO_DOS_FOGOS_MS", () => {
      for (const { duracaoMs, final } of Object.values(INTENSIDADES)) {
        expect(duracaoMs).toBeGreaterThanOrEqual(5000);
        expect(duracaoMs).toBeLessThanOrEqual(6000);
        expect(final).toBeGreaterThanOrEqual(6);
        expect(final).toBeLessThanOrEqual(8);
      }
      expect(INTENSIDADES.cheio.duracaoMs).toBe(DURACAO_DOS_FOGOS_MS);
      expect(intensidadeDoShow("inexistente")).toBe(INTENSIDADES.cheio);
    });

    it("estouros comuns escalonados, espalhados, variados e ordenados pelo lançamento", () => {
      for (let semente = 1; semente <= 20; semente += 1) {
        const planos = planejarShow({
          ...tela,
          aleatorio: criarAleatorio(semente),
        });
        const duracao = DURACAO_DOS_FOGOS_MS / 1000;
        const lancamentos = planos.map((p) => p.lancamento);
        expect([...lancamentos].sort((a, b) => a - b)).toEqual(lancamentos);
        const comuns = planos.filter((p) => p.papel === "comum");
        expect(comuns).toHaveLength(INTENSIDADES.cheio.explosoes);
        for (const p of planos) {
          expect(p.lancamento).toBeGreaterThanOrEqual(0);
          expect(p.lancamento).toBeLessThan(p.estouro);
          expect(p.yAlvo).toBeLessThan(tela.altura * 0.62);
          expect(p.yBase).toBeGreaterThan(tela.altura);
          // As faíscas apagam antes do fim (a vida encurta se preciso).
          expect(
            p.estouro + duracaoDoFormato(p.formato) * p.vidaFator,
          ).toBeLessThanOrEqual(duracao + 1e-9);
        }
        const xs = comuns.map((p) => p.xAlvo);
        expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(
          tela.largura * 0.5,
        );
        expect(
          new Set(comuns.map((p) => p.formato)).size,
        ).toBeGreaterThanOrEqual(5);
      }
    });

    it("grande final: 6–8 estouros quase juntos nos últimos ~1,5 s, depois do marco", () => {
      for (const intensidade of Object.keys(INTENSIDADES)) {
        const planos = planejarShow({
          ...tela,
          intensidade,
          aleatorio: criarAleatorio(4),
        });
        const duracao = INTENSIDADES[intensidade].duracaoMs / 1000;
        const finais = planos.filter((p) => p.papel === "final");
        expect(finais).toHaveLength(INTENSIDADES[intensidade].final);
        const instantes = finais.map((p) => p.estouro);
        expect(Math.min(...instantes)).toBeGreaterThanOrEqual(duracao - 1.65);
        expect(Math.max(...instantes)).toBeLessThanOrEqual(duracao - 1.15);
        // Quase juntos: a salva inteira em menos de meio segundo.
        expect(Math.max(...instantes) - Math.min(...instantes)).toBeLessThan(
          0.5,
        );
        expect(finais.every((p) => FORMATOS_DO_FINAL.includes(p.formato))).toBe(
          true,
        );
        const [marco] = planos.filter((p) => p.papel === "marco");
        expect(marco.estouro).toBeLessThan(Math.min(...instantes));
        const comuns = planos.filter((p) => p.papel === "comum");
        expect(Math.max(...comuns.map((p) => p.estouro))).toBeLessThan(
          marco.estouro,
        );
      }
    });

    it("com forma, o marco estoura no centro dela e o final fica dos lados", () => {
      const planos = planejarShow({
        ...tela,
        pontos: pontosDeTeste,
        aleatorio: criarAleatorio(2),
      });
      const [marco] = planos.filter((p) => p.papel === "marco");
      expect(marco.formato).toBe("marco");
      expect(marco.pontos).toBe(pontosDeTeste);
      const cx = pontosDeTeste.reduce((s, p) => s + p.x, 0) / 40;
      expect(marco.xAlvo).toBeCloseTo(cx, 6);
      expect(marco.xBase).toBeCloseTo(cx, 6);
      expect(marco.fimDaForma).toBeCloseTo(
        DURACAO_DOS_FOGOS_MS / 1000 - MARCO.desfazAntes,
      );
      for (const p of planos.filter((q) => q.papel === "final"))
        expect(Math.abs(p.xAlvo / tela.largura - 0.5)).toBeGreaterThan(0.15);
      // Sem forma: um crisântemo grande no centro.
      const [semForma] = planejarShow({
        ...tela,
        aleatorio: criarAleatorio(2),
      }).filter((p) => p.papel === "marco");
      expect(semForma.formato).toBe("crisantemo");
      expect(semForma.xAlvo).toBe(tela.largura / 2);
    });

    it("com a Aya, o primeiro foguete nasce dela e é o primeiro a estourar", () => {
      const aya = trajetoDaAya(tela);
      const planos = planejarShow({
        ...tela,
        aya,
        aleatorio: criarAleatorio(5),
      });
      const daAya = planos.filter((p) => p.papel === "aya");
      expect(daAya).toHaveLength(1);
      const [plano] = daAya;
      const soltura = pontoDaSoltura(aya);
      expect(plano.lancamento).toBeCloseTo(aya.soltura, 9);
      expect(plano.xBase).toBeCloseTo(soltura.x, 9);
      expect(plano.yBase).toBeCloseTo(soltura.y, 9);
      expect(plano.yAlvo).toBeLessThan(plano.yBase);
      expect(Math.min(...planos.map((p) => p.estouro))).toBe(plano.estouro);
      // Sem a Aya, todo foguete sai do chão.
      expect(
        planejarShow({ ...tela, aleatorio: criarAleatorio(5) }).some(
          (p) => p.papel === "aya",
        ),
      ).toBe(false);
    });

    it("o foguete chega ao alvo no instante do estouro, desacelerando", () => {
      const [plano] = planejarShow({ ...tela, aleatorio: criarAleatorio(3) });
      const foguete = lancarFoguete(plano);
      const vyInicial = foguete.vy;
      expect(vyInicial).toBeLessThan(0);
      let chegou = false;
      let passos = 0;
      while (!chegou && passos < 1000) {
        chegou = moverFoguete(foguete, 1 / 60);
        passos += 1;
      }
      expect(foguete.x).toBeCloseTo(plano.xAlvo, 3);
      expect(foguete.y).toBeCloseTo(plano.yAlvo, 3);
      expect(Math.abs(foguete.vy)).toBeLessThan(Math.abs(vyInicial));
    });
  });

  describe("estouros e física", () => {
    const plano = { formato: "peonia", cor: "#f00", cor2: "#0f0" };
    const faiscas = (lista) => lista.filter((p) => p.tipo === "faisca");

    it("centenas de faíscas por estouro, com clarão, respeitando o teto", () => {
      const lista = estourar(plano, {
        x: 100,
        y: 100,
        aleatorio: criarAleatorio(1),
      });
      expect(faiscas(lista)).toHaveLength(FORMATOS.peonia.faiscas);
      expect(lista.filter((p) => p.tipo === "clarao")).toHaveLength(1);
      expect(new Set(faiscas(lista).map((p) => p.cor))).toEqual(
        new Set(["#f00", "#0f0"]),
      );
      const sorteio = criarAleatorio(2);
      expect(
        estourar(plano, { x: 0, y: 0, cabem: 30, aleatorio: sorteio }),
      ).toHaveLength(30);
      expect(
        estourar(plano, { x: 0, y: 0, cabem: 0, aleatorio: sorteio }),
      ).toHaveLength(0);
      expect(
        estourar(plano, { x: 0, y: 0, fator: 0.5, aleatorio: sorteio }).length,
      ).toBeLessThan(FORMATOS.peonia.faiscas);
    });

    it("todos os formatos estouram; o anel nunca passa do raio", () => {
      const sorteio = criarAleatorio(3);
      for (const formato of NOMES_DOS_FORMATOS) {
        const lista = estourar(
          { formato, cor: "#fff" },
          { x: 0, y: 0, aleatorio: sorteio },
        );
        expect(faiscas(lista).length).toBe(FORMATOS[formato].faiscas);
      }
      const anel = faiscas(
        estourar(
          { formato: "anel", cor: "#fff" },
          { x: 0, y: 0, aleatorio: () => 0.5 },
        ),
      );
      const forcas = anel.map((p) => Math.hypot(p.vx, p.vy));
      expect(Math.max(...forcas)).toBeLessThanOrEqual(330 * 0.95 * 1.06 + 1e-6);
      expect(Math.min(...forcas)).toBeLessThan(Math.max(...forcas) * 0.8);
    });

    it("kamuro: chuva dourada lenta e longa, que termina âmbar", () => {
      const paleta = paletaDosFogos();
      const [kamuro] = planejarShow({
        ...tela,
        intensidade: "festa",
        aleatorio: criarAleatorio(11),
      }).filter((p) => p.formato === "kamuro");
      expect(kamuro.cor).toBe(paleta.dourado);
      expect(kamuro.corFinal).toBe(paleta.ambar);
      const lista = faiscas(
        estourar(
          { formato: "kamuro", cor: "#ffd23f", corFinal: "#ffb627" },
          { x: 0, y: 0, aleatorio: criarAleatorio(1) },
        ),
      );
      const peonia = faiscas(
        estourar(plano, { x: 0, y: 0, aleatorio: criarAleatorio(1) }),
      );
      const media = (l, f) => l.reduce((s, p) => s + f(p), 0) / l.length;
      expect(media(lista, (p) => p.vida)).toBeGreaterThan(
        media(peonia, (p) => p.vida) * 1.8,
      );
      expect(media(lista, (p) => p.gravidade)).toBeLessThan(
        media(peonia, (p) => p.gravidade) * 0.5,
      );
      expect(lista.every((p) => p.rastro >= 2.5)).toBe(true);
    });

    it("glitter: faíscas que piscam num ritmo próprio, sem sorteio", () => {
      const [faisca] = faiscas(
        estourar(
          { formato: "glitter", cor: "#fff" },
          { x: 0, y: 0, aleatorio: criarAleatorio(4) },
        ),
      );
      expect(faisca.pisca).toBeGreaterThanOrEqual(FORMATOS.glitter.pisca[0]);
      expect(faisca.pisca).toBeLessThanOrEqual(FORMATOS.glitter.pisca[1]);
      const brilhos = new Set();
      const p = { ...faisca, vida: faisca.vidaMax, vidaMax: faisca.vidaMax };
      for (let i = 0; i < 30; i += 1) {
        p.vida = faisca.vidaMax * (1 - i / 60);
        // O sorteio não muda nada: a piscada vem do tempo.
        const b = brilhoDaParticula(p, () => 0);
        expect(b).toBe(brilhoDaParticula(p, () => 0.99));
        brilhos.add(b > 0.5 ? "acesa" : "apagada");
      }
      expect(brilhos).toEqual(new Set(["acesa", "apagada"]));
    });

    it("palmeira: poucos braços grossos, igualmente espaçados, que soltam brasas", () => {
      const lista = faiscas(
        estourar(
          { formato: "palmeira", cor: "#ffd23f" },
          { x: 0, y: 0, fator: 0.5, aleatorio: criarAleatorio(6) },
        ),
      );
      // Não encolhe em tela pequena: são os braços.
      expect(lista).toHaveLength(FORMATOS.palmeira.faiscas);
      expect(lista.every((p) => p.tamanho >= 3 && p.emite > 0)).toBe(true);
      const angulos = lista
        .map((p) => Math.atan2(p.vy, p.vx))
        .sort((a, b) => a - b);
      const vaos = angulos.map(
        (a, i) =>
          (angulos[(i + 1) % angulos.length] - a + Math.PI * 2) % (Math.PI * 2),
      );
      const esperado = (Math.PI * 2) / lista.length;
      for (const vao of vaos)
        expect(Math.abs(vao - esperado)).toBeLessThan(0.2);

      // Num show, os braços deixam brasas pelo caminho.
      const show = criarShow({ ...tela, aleatorio: criarAleatorio(1) });
      show.planos = [];
      show.particulas = lista.map((p) => ({ ...p, x: 600, y: 200 }));
      for (let i = 0; i < 30; i += 1) avancarShow(show, 1 / 60);
      expect(show.particulas.length).toBeGreaterThan(lista.length);
    });

    it("bomba dupla: estoura em dois tempos", () => {
      const lista = estourar(
        { formato: "bombaDupla", cor: "#f00", cor2: "#0ff", estouro: 1 },
        { x: 300, y: 200, aleatorio: criarAleatorio(7) },
      );
      const [semente] = lista.filter((p) => p.tipo === "semente");
      expect(semente.vida).toBeCloseTo(FORMATOS.bombaDupla.segundo.atraso);
      expect(semente.plano.formato).toBe("peonia");
      expect(semente.plano.cor).toBe("#0ff");
      expect(brilhoDaParticula(semente)).toBe(0);
      const show = criarShow({ ...tela, aleatorio: criarAleatorio(1) });
      show.planos = [];
      show.particulas = lista;
      let segundo = null;
      for (let i = 0; i < 40 && !segundo; i += 1) {
        avancarShow(show, 1 / 60);
        segundo = show.eventos.find((e) => e.formato === "peonia");
      }
      expect(segundo).toMatchObject({ x: 300, y: 200 });
      expect(show.t).toBeGreaterThanOrEqual(FORMATOS.bombaDupla.segundo.atraso);
      expect(
        show.particulas.filter((p) => p.cor === "#0ff").length,
      ).toBeGreaterThan(100);
    });

    it("o marco: as faíscas convergem para os pontos, brilham ali e depois caem", () => {
      const lista = estourar(
        {
          formato: "marco",
          cor: "#ffd23f",
          cor2: "#fff6dc",
          estouro: 3,
          fimDaForma: 4.8,
          pontos: pontosDeTeste,
        },
        { x: 640, y: 300, aleatorio: criarAleatorio(8) },
      );
      const alvos = lista.filter((p) => p.tipo === "alvo");
      expect(alvos).toHaveLength(pontosDeTeste.length);
      expect(lista.some((p) => p.tipo === "faisca")).toBe(true);
      // Ainda no centro; depois da convergência, em cima de cada ponto.
      expect(alvos[0].x).toBe(640);
      for (let i = 0; i < 60; i += 1)
        alvos.forEach((p) => moverParticula(p, 1 / 60));
      alvos.forEach((p, i) => {
        expect(p.x).toBeCloseTo(pontosDeTeste[i].x, 6);
        expect(p.y).toBeCloseTo(pontosDeTeste[i].y, 6);
        expect(brilhoDaParticula(p)).toBeGreaterThan(0.6);
      });
      // Passa do fim da forma: cai.
      for (let i = 0; i < 50; i += 1)
        alvos.forEach((p) => moverParticula(p, 1 / 60));
      expect(alvos[0].y).toBeGreaterThan(pontosDeTeste[0].y);
      // Cabe no teto.
      expect(
        estourar(
          { formato: "marco", cor: "#fff", estouro: 0, pontos: pontosDeTeste },
          { x: 0, y: 0, cabem: 11, aleatorio: criarAleatorio(1) },
        ).length,
      ).toBeLessThanOrEqual(11);
    });

    it("fumaça: nuvens tênues que crescem e sobem", () => {
      const nuvens = fumacaDoEstouro(
        { x: 0, y: 0 },
        { cor: "#9aa6bd", aleatorio: criarAleatorio(9) },
      );
      expect(nuvens.length).toBeGreaterThanOrEqual(3);
      const [n] = nuvens;
      const tamanho = n.tamanho;
      const y = n.y;
      for (let i = 0; i < 60; i += 1) moverParticula(n, 1 / 60);
      expect(n.tamanho).toBeGreaterThan(tamanho);
      expect(n.y).toBeLessThan(y + 10);
      expect(brilhoDaParticula(n)).toBeLessThan(0.1);
      expect(fumacaDoEstouro({ x: 0, y: 0 }, { cabem: 0 })).toHaveLength(0);
    });

    it("gravidade puxa para baixo, atrito freia e a vida acaba", () => {
      const p = {
        x: 0,
        y: 0,
        vx: 100,
        vy: 0,
        atrito: 2,
        gravidade: 240,
        vida: 0.1,
        vidaMax: 1,
      };
      expect(moverParticula(p, 0.05)).toBe(true);
      expect(p.vx).toBeLessThan(100);
      expect(p.vy).toBeGreaterThan(0);
      expect(p.y).toBeGreaterThan(0);
      expect(moverParticula(p, 0.06)).toBe(false);
    });

    it("brilho: apaga no fim, cintila na segunda metade; crisântemo e kamuro mudam de cor", () => {
      expect(brilhoDaParticula({ vida: 1, vidaMax: 1 })).toBe(1);
      expect(brilhoDaParticula({ vida: 0, vidaMax: 1 })).toBe(0);
      const cintila = { vida: 0.3, vidaMax: 1, cintila: true };
      expect(brilhoDaParticula(cintila, () => 0.1)).toBeLessThan(
        brilhoDaParticula(cintila, () => 0.9),
      );
      const c = { cor: "#f00", corFinal: "#fd0", vida: 0.9, vidaMax: 1 };
      expect(corDaParticula(c)).toBe("#f00");
      c.vida = 0.2;
      expect(corDaParticula(c)).toBe("#fd0");
    });

    it("estalinho solta centelhas curtas; brasas caem do foguete", () => {
      const c = centelhas(
        { x: 5, y: 5 },
        { cor: "#fff", aleatorio: criarAleatorio(2) },
      );
      expect(c.length).toBeGreaterThanOrEqual(2);
      expect(c.every((p) => p.vidaMax <= 0.22 && p.tipo === "centelha")).toBe(
        true,
      );
      expect(centelhas({ x: 0, y: 0 }, { cabem: 0 })).toHaveLength(0);
      const b = brasa(
        { x: 1, y: 2 },
        { cor: "#fd0", aleatorio: criarAleatorio(3) },
      );
      expect(b.vy).toBeGreaterThan(0);
    });

    it("rastro e saída dependem do tempo, não da taxa de quadros", () => {
      expect(alfaDoRastro(0)).toBe(0);
      const doisQuadros = 1 - (1 - alfaDoRastro(1 / 120)) ** 2;
      expect(doisQuadros).toBeCloseTo(alfaDoRastro(1 / 60), 6);
      expect(fatorDeSaida(0, 4)).toBe(1);
      expect(fatorDeSaida(3.8, 4)).toBeCloseTo(0.5);
      expect(fatorDeSaida(4, 4)).toBe(0);
    });
  });

  describe("paleta", () => {
    it("tokens da marca + dourado e branco; luz somada nos dois temas (o véu escurece)", () => {
      const tokens = {
        "--brand-primary": " #70cfff ",
        "--series-2": "#d95f2b",
      };
      const escuro = paletaDosFogos((n) => tokens[n], { escuro: true });
      expect(escuro.cores).toEqual(
        expect.arrayContaining(["#70cfff", "#d95f2b", "#ffd23f", "#fff6dc"]),
      );
      expect(escuro.composicao).toBe("lighter");
      const claro = paletaDosFogos((n) => tokens[n], { escuro: false });
      expect(claro.composicao).toBe("lighter");
      // No claro, os tokens são escuros: entram cores vivas.
      expect(claro.cores.length).toBeGreaterThan(escuro.cores.length);
      expect(claro.fumaca).not.toBe(escuro.fumaca);
    });

    it("sem tokens (ou leitura que falha), a paleta reserva", () => {
      const p = paletaDosFogos(() => {
        throw new Error("x");
      });
      expect(p.cores.length).toBeGreaterThan(3);
    });
  });

  describe("o show inteiro", () => {
    it("estoura tudo (com o marco), nunca passa do teto e acaba sozinho na duração", () => {
      const show = criarShow({
        ...tela,
        intensidade: "festa",
        comAya: true,
        forma: "coracao",
        aleatorio: criarAleatorio(7),
      });
      const { maximo } = rodar(show);
      const { explosoes, final, duracaoMs, rajadas, tiros, apoteose } =
        INTENSIDADES.festa;
      // Comuns, rajadas, o marco, o grande final e a apoteose: todos estouram.
      expect(show.estouros).toBe(
        explosoes + rajadas * tiros + 1 + final + apoteose,
      );
      expect(maximo).toBeGreaterThan(300);
      expect(maximo).toBeLessThanOrEqual(LIMITE_DE_PARTICULAS);
      expect(show.t).toBeLessThanOrEqual(duracaoMs / 1000 + 1e-9);
      expect(show.pontos.length).toBeGreaterThan(30);
      expect(show.aya).not.toBeNull();
    });

    it("os eventos de estouro saem um por estouro, com formato e papel", () => {
      const show = criarShow({ ...tela, aleatorio: criarAleatorio(12) });
      const eventos = [];
      while (!showAcabou(show)) {
        avancarShow(show, 1 / 60);
        eventos.push(...show.eventos.splice(0));
      }
      const estouros = eventos.filter((e) => e.tipo === "estouro");
      expect(estouros.filter((e) => e.papel === "marco")).toHaveLength(1);
      expect(estouros.filter((e) => e.papel === "final")).toHaveLength(
        INTENSIDADES.cheio.final,
      );
      expect(estouros.filter((e) => e.papel === "apoteose")).toHaveLength(
        INTENSIDADES.cheio.apoteose,
      );
      // Um por foguete, mais o segundo tempo de cada bomba dupla.
      expect(estouros).toHaveLength(
        show.estouros +
          show.planos.filter((p) => p.formato === "bombaDupla").length,
      );
      expect(eventos.every((e) => typeof e.formato === "string")).toBe(true);
      // Os foguetes que assobiam avisam o lançamento (o som), com a subida;
      // o marco sempre assobia.
      const lancamentos = eventos.filter((e) => e.tipo === "lancamento");
      expect(lancamentos.length).toBeGreaterThan(1);
      expect(lancamentos.filter((e) => e.papel === "marco")).toHaveLength(1);
      expect(lancamentos.every((e) => e.subida > 0)).toBe(true);
      expect(lancamentos.length).toBeLessThan(estouros.length / 2);
    });

    it("o teto baixo corta faíscas, e passo enorme (aba voltando) é limitado", () => {
      const show = criarShow({
        ...tela,
        limite: 200,
        aleatorio: criarAleatorio(1),
      });
      for (let i = 0; i < 300; i += 1) {
        avancarShow(show, 1 / 60);
        expect(show.particulas.length).toBeLessThanOrEqual(200);
      }
      const t = show.t;
      avancarShow(show, 30);
      expect(show.t - t).toBeCloseTo(1 / 20);
      avancarShow(show, 0);
      expect(show.t - t).toBeCloseTo(1 / 20);
    });
  });

  describe("formatos novos: coração, estrela, cometa e crepitante", () => {
    const faiscas = (lista) => lista.filter((p) => p.tipo === "faisca");
    const forcas = (lista) => lista.map((p) => Math.hypot(p.vx, p.vy));

    it("coração: as faíscas desenham o coração em pé (a ponta para baixo)", () => {
      const lista = faiscas(
        estourar(
          { formato: "coracao", cor: "#f0a" },
          { x: 0, y: 0, aleatorio: () => 0.5 },
        ),
      );
      expect(lista).toHaveLength(FORMATOS.coracao.faiscas);
      // Não é uma esfera: a força varia com o contorno.
      expect(Math.min(...forcas(lista))).toBeLessThan(
        Math.max(...forcas(lista)) * 0.5,
      );
      // A ponta (a faísca mais para baixo) fica no meio; os lóbulos, dos lados.
      const ponta = lista.reduce((a, b) => (b.vy > a.vy ? b : a));
      expect(Math.abs(ponta.vx)).toBeLessThan(ponta.vy * 0.25);
      const esquerda = lista.filter((p) => p.vx < -1).length;
      const direita = lista.filter((p) => p.vx > 1).length;
      expect(Math.abs(esquerda - direita)).toBeLessThan(lista.length * 0.1);
      // Pouco peso: a forma não desaba antes de apagar.
      expect(FORMATOS.coracao.peso).toBeLessThan(0.5);
    });

    it("estrela: cinco pontas (a força alterna entre ponta e vale)", () => {
      const lista = faiscas(
        estourar(
          { formato: "estrela", cor: "#fd0" },
          { x: 0, y: 0, aleatorio: () => 0.5 },
        ),
      );
      expect(lista).toHaveLength(FORMATOS.estrela.faiscas);
      const f = forcas(lista);
      const maior = Math.max(...f);
      expect(Math.min(...f)).toBeLessThan(maior * 0.6);
      // Picos de força no contorno: as cinco pontas.
      const picos = f.filter(
        (v, i) =>
          v > f[(i - 1 + f.length) % f.length] &&
          v >= f[(i + 1) % f.length] &&
          v > maior * 0.9,
      );
      expect(picos).toHaveLength(5);
    });

    it("cometa: poucos riscos grossos que soltam brasas da própria cor", () => {
      const lista = faiscas(
        estourar(
          { formato: "cometa", cor: "#4fdcff" },
          { x: 0, y: 0, fator: 0.5, aleatorio: criarAleatorio(2) },
        ),
      );
      // Como a palmeira, não encolhe em tela pequena.
      expect(lista).toHaveLength(FORMATOS.cometa.faiscas);
      expect(lista.every((p) => p.tamanho >= 3 && p.emite > 0)).toBe(true);
      expect(lista.every((p) => p.brasa === "#4fdcff")).toBe(true);
      const show = criarShow({ ...tela, aleatorio: criarAleatorio(1) });
      show.planos = [];
      show.particulas = lista.map((p) => ({ ...p, x: 600, y: 200 }));
      for (let i = 0; i < 30; i += 1) avancarShow(show, 1 / 60);
      const brasas = show.particulas.slice(lista.length);
      expect(brasas.length).toBeGreaterThan(5);
      expect(brasas.every((p) => p.cor === "#4fdcff")).toBe(true);
    });

    it("crepitante: o crisântemo cujas pontas cintilam e estalam", () => {
      const lista = faiscas(
        estourar(
          { formato: "crepitante", cor: "#fff" },
          { x: 0, y: 0, aleatorio: criarAleatorio(3) },
        ),
      );
      expect(lista).toHaveLength(FORMATOS.crepitante.faiscas);
      expect(lista.every((p) => p.estala && p.cintila)).toBe(true);
    });

    it("brilho: no fim da vida a faísca pisca como brasa; cheia de vida, não", () => {
      const fim = { tipo: "faisca", vida: 0.1, vidaMax: 1 };
      expect(brilhoDaParticula(fim, () => 0.1)).toBeLessThan(
        brilhoDaParticula(fim, () => 0.9),
      );
      const nova = { tipo: "faisca", vida: 0.9, vidaMax: 1 };
      expect(brilhoDaParticula(nova, () => 0.1)).toBe(
        brilhoDaParticula(nova, () => 0.9),
      );
    });
  });

  describe("rajadas e apoteose", () => {
    it("rajadas: tiros pequenos em leque, do mesmo ponto, um atrás do outro, antes do marco", () => {
      for (const intensidade of Object.keys(INTENSIDADES)) {
        const { rajadas, tiros } = INTENSIDADES[intensidade];
        const planos = planejarShow({
          ...tela,
          intensidade,
          aleatorio: criarAleatorio(3),
        });
        const daRajada = planos.filter((p) => p.papel === "rajada");
        expect(daRajada).toHaveLength(rajadas * tiros);
        const [marco] = planos.filter((p) => p.papel === "marco");
        const porBase = new Map();
        for (const p of daRajada)
          porBase.set(p.xBase, [...(porBase.get(p.xBase) || []), p]);
        expect(porBase.size).toBe(rajadas);
        for (const grupo of porBase.values()) {
          expect(grupo).toHaveLength(tiros);
          const instantes = grupo.map((p) => p.estouro).sort((a, b) => a - b);
          for (let k = 1; k < instantes.length; k += 1)
            expect(instantes[k] - instantes[k - 1]).toBeCloseTo(
              RAJADA.intervalo,
              9,
            );
          // Em leque: cada tiro num lugar; o mesmo formato na rajada inteira.
          expect(new Set(grupo.map((p) => p.xAlvo)).size).toBe(tiros);
          expect(new Set(grupo.map((p) => p.formato)).size).toBe(1);
          expect(FORMATOS_DA_RAJADA).toContain(grupo[0].formato);
          expect(grupo.every((p) => p.porte === RAJADA.porte)).toBe(true);
          expect(Math.max(...instantes)).toBeLessThan(marco.estouro);
        }
      }
      // A rajada estoura menor.
      const cheio = estourar(
        { formato: "peonia", cor: "#fff" },
        { x: 0, y: 0, aleatorio: criarAleatorio(1) },
      );
      const pequeno = estourar(
        { formato: "peonia", cor: "#fff", porte: RAJADA.porte },
        { x: 0, y: 0, aleatorio: criarAleatorio(1) },
      );
      expect(pequeno.length).toBeLessThan(cheio.length * 0.6);
    });

    it("apoteose: depois do grande final, estouros quase juntos no alto, de ponta a ponta", () => {
      for (const intensidade of Object.keys(INTENSIDADES)) {
        const duracao = INTENSIDADES[intensidade].duracaoMs / 1000;
        const planos = planejarShow({
          ...tela,
          intensidade,
          aleatorio: criarAleatorio(8),
        });
        const apoteose = planos.filter((p) => p.papel === "apoteose");
        expect(apoteose).toHaveLength(INTENSIDADES[intensidade].apoteose);
        if (!apoteose.length) continue;
        const finais = planos.filter((p) => p.papel === "final");
        const instantes = apoteose.map((p) => p.estouro);
        expect(Math.min(...instantes)).toBeGreaterThan(
          Math.max(...finais.map((p) => p.estouro)),
        );
        expect(Math.max(...instantes)).toBeLessThanOrEqual(
          duracao - APOTEOSE.estouraAntes + APOTEOSE.janela,
        );
        expect(apoteose.every((p) => p.yAlvo <= tela.altura * 0.3)).toBe(true);
        expect(
          apoteose.every((p) => FORMATOS_DA_APOTEOSE.includes(p.formato)),
        ).toBe(true);
        const xs = apoteose.map((p) => p.xAlvo);
        // De ponta a ponta: com três, ao menos 0,84 × 1,6 / 3 da largura.
        expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(
          tela.largura * 0.44,
        );
      }
    });
  });

  describe("a Aya dança no fim e solta confete", () => {
    it("no Normal e no Festa (com a Aya), um evento de confete, uma vez, de onde ela dança", () => {
      for (const intensidade of ["cheio", "festa"]) {
        const show = criarShow({
          ...tela,
          intensidade,
          comAya: true,
          aleatorio: criarAleatorio(3),
        });
        expect(show.danca).not.toBeNull();
        const confetes = [];
        while (!showAcabou(show)) {
          avancarShow(show, 1 / 60);
          for (const e of show.eventos.splice(0))
            if (e.tipo === "confete") confetes.push(e);
        }
        expect(confetes).toHaveLength(1);
        expect(confetes[0].x).toBe(show.danca.x);
        expect(confetes[0].y).toBeLessThan(show.danca.y);
      }
      // No Suave, e sem a Aya, sem dança.
      expect(
        criarShow({ ...tela, intensidade: "pequeno", comAya: true }).danca,
      ).toBeNull();
      expect(criarShow({ ...tela, intensidade: "festa" }).danca).toBeNull();
    });
  });

  describe("paleta da área", () => {
    it("a cor da área (token do tema) entra primeiro na paleta e fica à mão", () => {
      const tokens = {
        "--brand-primary": "#0f5db7",
        "--state-info": "#2b7de9",
        "--state-success": "#1f9d55",
      };
      const ler = (nome) => tokens[nome] || "";
      const sede = paletaDosFogos(ler, { area: "sede" });
      expect(TOKENS_DAS_AREAS.sede).toBe("--state-info");
      expect(sede.area).toBe("#2b7de9");
      expect(sede.cores[0]).toBe("#2b7de9");
      expect(paletaDosFogos(ler, { area: "saude-indigena" }).area).toBe(
        "#1f9d55",
      );
      // Área sem token ou desconhecida: a paleta de sempre.
      expect(paletaDosFogos(ler, { area: "projetos" }).area).toBeNull();
      expect(paletaDosFogos(ler, { area: "outra" }).area).toBeNull();
      expect(paletaDosFogos(ler).cores).toEqual(
        paletaDosFogos(ler, { area: "outra" }).cores,
      );
      // Coração e estrela saem na cor da área.
      const planos = planejarShow({
        ...tela,
        intensidade: "festa",
        paleta: sede,
        aleatorio: criarAleatorio(9),
      }).filter((p) => p.formato === "coracao" || p.formato === "estrela");
      expect(planos.length).toBeGreaterThan(0);
      expect(planos.every((p) => p.cor === "#2b7de9")).toBe(true);
    });
  });
});

bloco("intencoes-da-aya", () => {
  /*
  O catálogo de perguntas com número da Aya (src/lib/aya/intencoes-da-aya.ts):
  reconhece a intenção e as entidades (edital, área, métrica), deixa as
  perguntas de "o que é" para a base e escreve a resposta só com números.
*/

  const resumo = (pergunta, contexto = { view: "selecao", area: "sede" }) => {
    const r = reconhecerIntencao(pergunta, contexto);
    return r && [r.id, r.metrica?.id || r.tipo, r.entidades.edital || ""];
  };

  describe("entidades", () => {
    it.each([
      ["quantas pendentes no 93/2026?", "93/2026"],
      ["edital 93-2026", "93/2026"],
      ["nº 7/26", "7/2026"],
      ["edital 12 de 2026", "12/2026"],
      ["sem edital", ""],
    ])("%s → %s", (texto, esperado) => {
      expect(numeroDoEdital(texto)).toBe(esperado);
    });

    it("edital sem ano casa com qualquer ano; com ano, só com ele", () => {
      expect(mesmoEdital("Edital nº 93/2026 - Médico", "93")).toBe(true);
      expect(mesmoEdital("93/2025", "93/2026")).toBe(false);
      expect(mesmoEdital("Edital 93/2026", "93/2026")).toBe(true);
      expect(mesmoEdital("qualquer", "")).toBe(true);
    });

    it("área da pergunta vence a da tela; o edital da tela completa", () => {
      expect(
        extrairEntidades("quantos inscritos na SEDE?", {
          area: "saude-indigena",
          edital: "Edital 5/2026",
        }),
      ).toEqual({
        edital: "5/2026",
        editalExplicito: false,
        area: "sede",
        areaExplicita: true,
      });
    });
  });

  describe("reconhecer a intenção", () => {
    it.each([
      [
        "quantas análises pendentes tem o 93/2026?",
        ["analises", "pendente", "93/2026"],
      ],
      [
        "quantos recursos aguardando parecer?",
        ["recursos", "aguardandoParecer", ""],
      ],
      ["quantos recursos vencidos", ["recursos", "atrasados", ""]],
      ["quantos convocados sem nota?", ["entrevistas", "semNota", ""]],
      [
        "qual a taxa de contratação do edital 12/2026?",
        ["selecao", "taxa", "12/2026"],
      ],
      ["quantos inscritos?", ["selecao", "inscritos", ""]],
      [
        "quantas reprovadas no edital 5 de 2026",
        ["analises", "reprovado", "5/2026"],
      ],
      ["quando foi a última carga da Seleção?", ["ultima-carga", "carga", ""]],
      ["tem alguma carga atrasada?", ["cargas", "atrasos", ""]],
      ["tem aviso de conferência aqui?", ["conferencias", "conferencia", ""]],
    ])("%s", (pergunta, esperado) => {
      expect(resumo(pergunta)).toEqual(esperado);
    });

    it("sem módulo dito, usa a tela aberta", () => {
      expect(
        resumo("quantos aprovados tem aqui?", { view: "analises" }),
      ).toEqual(["analises", "aprovado", ""]);
    });

    it("pergunta de explicação ou da tela não é intenção de dado", () => {
      for (const pergunta of [
        "o que é análise pendente?",
        "como funciona o recurso?",
        "quantos DSEIs aparecem?",
        "o que tem nesta tela?",
        "quantos filtros estão ativos?",
      ])
        expect(
          reconhecerIntencao(pergunta, { view: "analises" }),
          pergunta,
        ).toBeNull();
    });
  });

  describe("resposta", () => {
    it("só número, com o recorte e o total", () => {
      const intencao = reconhecerIntencao(
        "quantas análises pendentes tem o 93/2026?",
        {
          area: "sede",
        },
      );
      expect(textoDaIntencao(intencao, { valor: 12, total: 40 })).toBe(
        "Há 12 análises pendentes no edital 93/2026 na SEDE, de 40 no total.",
      );
      expect(textoDaIntencao(intencao, { valor: 1, total: 1 })).toContain(
        "1 análise pendente",
      );
    });

    it("o botão Abrir leva à tela com o edital e a métrica", () => {
      const intencao = reconhecerIntencao(
        "quantas análises pendentes tem o 93/2026?",
      );
      expect(acaoDaIntencao(intencao)).toEqual({
        view: "analises",
        filtro: { edital: "93/2026", metrica: "pendente" },
      });
    });

    it("taxa em porcentagem e carga com data de Brasília", () => {
      const taxa = reconhecerIntencao("qual a taxa de contratação?", {
        view: "selecao",
      });
      expect(
        textoDaIntencao(taxa, { valor: 25, contratados: 5, aprovados: 20 }),
      ).toBe("A taxa de contratação é 25% (5 contratados de 20 aprovados).");
      const carga = reconhecerIntencao("quando foi a última carga da seleção?");
      expect(textoDaIntencao(carga, { em: "2026-10-05T13:05:00Z" })).toContain(
        "05/10/2026, 10:05",
      );
      expect(textoDaIntencao(carga, { em: null })).toContain("Não achei");
    });
  });
});

bloco("modulos/aya-fontes-troca-de-usuario", () => {
  /*
  A Aya guarda os números por um minuto. A chave não tinha a pessoa: depois
  de trocar de conta na mesma aba, a pessoa B via os números lidos com a
  permissão da pessoa A.
*/
  function supabaseComAuth() {
    let aoMudar = () => {};
    let leitura = 0;
    return {
      entrar: (id) => aoMudar("SIGNED_IN", id ? { user: { id } } : null),
      rpc: vi.fn(async () => ({
        data: [`leitura-${(leitura += 1)}`],
        error: null,
      })),
      auth: {
        onAuthStateChange: (funcao) => {
          aoMudar = funcao;
          return { data: { subscription: { unsubscribe: () => {} } } };
        },
      },
    };
  }

  const ler = (fontes) =>
    fontes.buscar("conferencia", { area: "saude-indigena", cargaDe: "x" });

  describe("fontes da Aya: troca de conta", () => {
    it("outra conta na mesma aba não reaproveita o que a anterior leu", async () => {
      const supabase = supabaseComAuth();
      const fontes = criarFontesDaAya({
        supabase,
        telaJaAberta: () => undefined,
      });
      supabase.entrar("pessoa-a");
      expect(await ler(fontes)).toEqual({ em: "leitura-1" });
      expect(await ler(fontes)).toEqual({ em: "leitura-1" });

      supabase.entrar("pessoa-b");
      expect(await ler(fontes)).toEqual({ em: "leitura-2" });
      expect(supabase.rpc).toHaveBeenCalledTimes(2);
    });

    it("a leitura da conta anterior que chega depois da troca não fica guardada", async () => {
      const supabase = supabaseComAuth();
      let entregar;
      supabase.rpc.mockImplementationOnce(
        () => new Promise((resolver) => (entregar = resolver)),
      );
      const fontes = criarFontesDaAya({
        supabase,
        telaJaAberta: () => undefined,
      });
      supabase.entrar("pessoa-a");
      const daPessoaA = ler(fontes);
      await Promise.resolve();
      supabase.entrar("pessoa-b");
      entregar({ data: ["da-pessoa-a"], error: null });
      await daPessoaA;

      expect(await ler(fontes)).toEqual({ em: "leitura-1" });
    });

    it("o mesmo usuário (renovação do token) mantém o guardado", async () => {
      const supabase = supabaseComAuth();
      const fontes = criarFontesDaAya({
        supabase,
        telaJaAberta: () => undefined,
      });
      supabase.entrar("pessoa-a");
      await ler(fontes);
      supabase.entrar("pessoa-a");
      await ler(fontes);
      expect(supabase.rpc).toHaveBeenCalledTimes(1);
    });
  });
});

bloco("modulos/aya-fontes", () => {
  /*
  De onde a Aya conta as análises (src/modulos/aya/fontes.ts): os editais em
  situação Ativo, como no banco — o pacote "ativo" do painel e o
  "desativadas" (análises de edital ativo que saíram da planilha). Caso do
  teste real de 05/10: 110/2026 com 841 análises, 8 pendentes, todas
  desativadas; contar só o pacote "ativo" dava "0 de 833".
*/

  const COLUNAS = [
    "id",
    "unidade",
    "edital",
    "candidato",
    "status_consolidado",
  ];

  function pacote(prefixo, quantas, status) {
    return {
      columns: COLUNAS,
      rows: Array.from({ length: quantas }, (_, i) => [
        `${prefixo}-${i}`,
        "DSEI X",
        "110/2026",
        `Pessoa ${prefixo} ${i}`,
        status(i),
      ]),
    };
  }

  const PACOTES = {
    ativo: pacote("a", 833, (i) => (i % 2 ? "Aprovado" : "Reprovado")),
    desativadas: pacote("d", 8, () => "Pendente"),
  };

  const supabaseFalso = () => ({
    rpc: vi.fn(async (nome, argumentos) => {
      if (nome !== "get_analises_dashboard_payload_v2_se_mudou")
        return { data: null, error: { message: "inesperada" } };
      return { data: [PACOTES[argumentos.p_scope]], error: null };
    }),
  });

  const ADMIN = {
    ativo: true,
    perfil: "admin",
    admin_global: true,
    permissoes: { analises: "admin" },
  };

  describe("fonte das análises", () => {
    it("junta os pacotes ativo e desativadas, marcando as desativadas", async () => {
      const supabase = supabaseFalso();
      const fontes = criarFontesDaAya({
        supabase,
        telaJaAberta: () => undefined,
      });
      const { linhas } = await fontes.buscar("analises", {
        area: "saude-indigena",
      });
      expect(linhas).toHaveLength(841);
      expect(linhas.filter((l) => l.__desativada)).toHaveLength(8);
      expect(supabase.rpc.mock.calls.map((c) => c[1].p_scope).sort()).toEqual([
        "ativo",
        "desativadas",
      ]);
    });

    it("110/2026: 8 pendentes de 841, dizendo que estão desativadas", async () => {
      const fontes = criarFontesDaAya({
        supabase: supabaseFalso(),
        telaJaAberta: () => undefined,
      });
      const r = await responderComDados({
        pergunta: "quantas análises pendentes tem o 110/2026?",
        contexto: { view: "dashboard", area: "saude-indigena" },
        perfil: ADMIN,
        buscar: fontes.buscar,
      });
      expect(r.answer).toBe(
        "Há 8 análises pendentes no edital 110/2026 na Saúde Indígena, de 841 no total. 8 delas saíram da planilha (desativadas) e só aparecem na tela com a situação Todos.",
      );
      expect(r.answer).not.toContain("Pessoa");
    });
  });
});

bloco("motor-de-efeitos", () => {
  /*
  O motor de efeitos das comemorações: cenas repetíveis com semente fixa,
  teto de partículas, fim dentro da duração e a mistura dos efeitos.
  Sorteio sempre com criarAleatorio(n).
*/

  const tela = { largura: 1280, altura: 720 };

  /* Roda a cena a 60 fps até acabar; devolve quantos quadros e o pico. */
  function rodar(cena, limite = 2000) {
    let quadros = 0;
    let pico = 0;
    while (!cenaAcabou(cena) && quadros < limite) {
      avancarCena(cena, 1 / 60);
      pico = Math.max(pico, cena.particulas.length);
      quadros += 1;
    }
    return { quadros, pico };
  }

  const retrato = (cena) =>
    cena.particulas
      .slice(0, 20)
      .map((p) => [
        p.tipo,
        Math.round(p.x * 100),
        Math.round(p.y * 100),
        p.cor,
      ]);

  describe("motor de efeitos", () => {
    it("a mesma semente e os mesmos passos dão a mesma cena", () => {
      for (const efeito of EFEITOS) {
        const a = criarCena({ ...tela, efeito, aleatorio: criarAleatorio(7) });
        const b = criarCena({ ...tela, efeito, aleatorio: criarAleatorio(7) });
        for (let i = 0; i < 90; i += 1) {
          avancarCena(a, 1 / 60);
          avancarCena(b, 1 / 60);
        }
        expect(retrato(a)).toEqual(retrato(b));
        expect(particulasDaCena(a)).toBe(particulasDaCena(b));
      }
    });

    it("cada efeito acaba dentro da duração e não deixa nada na tela", () => {
      for (const efeito of EFEITOS) {
        const cena = criarCena({
          ...tela,
          efeito,
          duracaoMs: 4000,
          aleatorio: criarAleatorio(3),
        });
        const { quadros } = rodar(cena);
        expect(cenaAcabou(cena)).toBe(true);
        expect(quadros).toBeLessThanOrEqual(Math.ceil(4 * 60) + 2);
      }
    });

    it("nunca passa do teto de partículas", () => {
      const cena = criarCena({
        ...tela,
        efeito: "confete",
        intensidade: "festa",
        limite: 120,
        aleatorio: criarAleatorio(1),
      });
      const { pico } = rodar(cena);
      expect(pico).toBeLessThanOrEqual(120);
      expect(pico).toBeGreaterThan(0);
    });

    it("festa solta mais que suave", () => {
      const contar = (intensidade) => {
        const cena = criarCena({
          ...tela,
          efeito: "confete",
          intensidade,
          aleatorio: criarAleatorio(2),
        });
        return rodar(cena).pico;
      };
      expect(contar("festa")).toBeGreaterThan(contar("suave"));
    });

    it("efeitos e peças: combinado mistura fogos, confete e serpentina; a Aya só chama a mascote", () => {
      expect(componentesDoEfeito("combinado")).toEqual([
        "fogos",
        "confete",
        "serpentina",
      ]);
      expect(componentesDoEfeito("aya")).toEqual([]);
      expect(componentesDoEfeito("inexistente")).toEqual(["fogos"]);
      expect(efeitoChamaAya("aya")).toBe(true);
      expect(efeitoChamaAya("combinado")).toBe(true);
      expect(efeitoChamaAya("fogos")).toBe(false);
      expect(efeitoComVeu("estrelas")).toBe(true);
      expect(efeitoComVeu("confete")).toBe(false);
      const combinado = criarCena({
        ...tela,
        efeito: "combinado",
        aleatorio: criarAleatorio(4),
      });
      expect(combinado.show).not.toBeNull();
      expect(new Set(combinado.lotes.map((l) => l.peca))).toEqual(
        new Set(["confete", "serpentina"]),
      );
      const aya = criarCena({ ...tela, efeito: "aya" });
      expect(aya.show).toBeNull();
      expect(aya.lotes).toHaveLength(0);
      expect(aya.chamaAya).toBe(true);
    });

    it("intensidades novas e os nomes antigos dos fogos", () => {
      expect(nivelDaIntensidade("suave")).toBe("suave");
      expect(nivelDaIntensidade("pequeno")).toBe("suave");
      expect(nivelDaIntensidade("cheio")).toBe("normal");
      expect(nivelDaIntensidade("fogos")).toBe("normal");
      expect(nivelDaIntensidade("festa")).toBe("festa");
      expect(nivelDaIntensidade("?")).toBe("normal");
      const antigo = criarCena({ ...tela, intensidade: "fogos" });
      expect(antigo.show.duracao).toBe(INTENSIDADES.fogos.duracaoMs / 1000);
    });

    it("duração: limitada; nos fogos, mais tempo = mais estouros", () => {
      expect(normalizarDuracao(null)).toBeNull();
      expect(normalizarDuracao("x")).toBeNull();
      expect(normalizarDuracao(500)).toBe(2000);
      expect(normalizarDuracao(99000)).toBe(15000);
      expect(criarCena({ ...tela, efeito: "confete" }).duracao).toBe(
        DURACAO_PADRAO_MS / 1000,
      );
      const curto = criarCena({
        ...tela,
        duracaoMs: 6000,
        aleatorio: criarAleatorio(5),
      });
      const longo = criarCena({
        ...tela,
        duracaoMs: 12000,
        aleatorio: criarAleatorio(5),
      });
      expect(longo.duracao).toBe(12);
      const comuns = (cena) =>
        cena.show.planos.filter((p) => p.papel === "comum").length;
      expect(comuns(longo)).toBeGreaterThan(comuns(curto));
      // Fogos nunca abaixo de 4 s (o roteiro precisa do tempo).
      expect(criarCena({ ...tela, duracaoMs: 2000 }).duracao).toBe(4);
    });

    it("canhões de confete tocam um estalo; os eventos dos fogos passam para a cena", () => {
      const cena = criarCena({
        ...tela,
        efeito: "combinado",
        aleatorio: criarAleatorio(6),
      });
      const eventos = [];
      for (let i = 0; i < 300; i += 1) {
        avancarCena(cena, 1 / 60);
        eventos.push(...cena.eventos.splice(0));
      }
      expect(eventos.some((e) => e.papel === "canhao")).toBe(true);
      expect(
        eventos.some((e) => e.papel === "comum" || e.papel === "aya"),
      ).toBe(true);
    });

    it("o desenho usa só o contexto recebido e cada tipo de partícula aparece", () => {
      const chamadas = {};
      const contexto = new Proxy(
        {},
        {
          get:
            (_, chave) =>
            (...args) => {
              chamadas[chave] = (chamadas[chave] || 0) + 1;
              return args;
            },
          set: () => true,
        },
      );
      const tipos = new Set();
      for (const efeito of [
        "confete",
        "serpentina",
        "estrelas",
        "coracoes",
        "baloes",
      ]) {
        const cena = criarCena({
          ...tela,
          efeito,
          aleatorio: criarAleatorio(8),
        });
        for (let i = 0; i < 40; i += 1) avancarCena(cena, 1 / 60);
        cena.particulas.forEach((p) => tipos.add(p.tipo));
        desenharParticulasDoMotor(contexto, cena);
      }
      expect(tipos).toEqual(
        new Set([
          "confete",
          "serpentina",
          "cometa",
          "estrela",
          "coracao",
          "balao",
        ]),
      );
      expect(chamadas.fillRect).toBeGreaterThan(0);
      expect(chamadas.bezierCurveTo).toBeGreaterThan(0);
      expect(chamadas.ellipse).toBeGreaterThan(0);
      expect(chamadas.stroke).toBeGreaterThan(0);
      expect(chamadas.save).toBe(chamadas.restore);
    });

    it("fogos em camadas: o miolo do pistilo é mais lento e da segunda cor", () => {
      const paleta = paletaDosFogos();
      const lista = estourar(
        { formato: "pistilo", cor: "#f00", cor2: "#0ff" },
        { x: 0, y: 0, aleatorio: criarAleatorio(9) },
      ).filter((p) => p.tipo === "faisca");
      expect(lista).toHaveLength(FORMATOS.pistilo.faiscas);
      const miolo = lista.filter((p) => p.cor === "#0ff");
      const casca = lista.filter((p) => p.cor === "#f00");
      expect(miolo.length).toBe(
        Math.round(FORMATOS.pistilo.faiscas * FORMATOS.pistilo.nucleo),
      );
      const velocidade = (ps) =>
        ps.reduce((s, p) => s + Math.hypot(p.vx, p.vy), 0) / ps.length;
      expect(velocidade(miolo)).toBeLessThan(velocidade(casca) * 0.6);
      expect(paleta.cores.length).toBeGreaterThan(2);
    });
  });
});

bloco("perguntas-sem-resposta", () => {
  /*
  As perguntas que a Aya não resolveu, guardadas sem dado pessoal para o
  administrador melhorar a base (src/lib/aya/perguntas-sem-resposta.ts).
*/

  describe("sem dado pessoal", () => {
    it("tira e-mail, CPF, telefone e números longos; o edital fica", () => {
      expect(
        limparPergunta(
          "o recurso de joao@agenciasus.org.br, CPF 123.456.789-09, tel (61) 99999-1234, inscrição 4455667, edital 93/2026",
        ),
      ).toBe(
        "o recurso de [e-mail], CPF [número], tel [número], inscrição [número], edital 93/2026",
      );
    });

    it("corta em 200 caracteres e junta os espaços", () => {
      expect(limparPergunta(`a   b\n${"x".repeat(300)}`)).toHaveLength(200);
    });
  });

  describe("lista", () => {
    it("sem repetir a mesma pergunta na mesma página, até o limite", () => {
      let lista = [];
      lista = comPerguntaSemResposta(lista, { pergunta: "oi?", pagina: "x" });
      lista = comPerguntaSemResposta(lista, { pergunta: "oi?", pagina: "x" });
      lista = comPerguntaSemResposta(lista, { pergunta: "", pagina: "x" });
      expect(lista).toHaveLength(1);
      for (let i = 0; i < LIMITE_DE_PERGUNTAS + 5; i += 1)
        lista = comPerguntaSemResposta(lista, {
          pergunta: `p${i}`,
          pagina: "y",
        });
      expect(lista).toHaveLength(LIMITE_DE_PERGUNTAS);
    });

    it("descarta o que está estragado e copia uma por linha", () => {
      const lista = perguntasGuardadas([
        null,
        { pergunta: 3 },
        {
          pergunta: "como zerar?",
          pagina: "config:mensagens",
          motivo: "nao-entendeu",
          quando: "2026-10-05T10:00:00Z",
        },
      ]);
      expect(lista).toHaveLength(1);
      expect(textoDasPerguntas(lista)).toBe(
        "- como zerar? (config:mensagens; não entendi; 2026-10-05)",
      );
      expect(perguntasGuardadas("x")).toEqual([]);
    });
  });
});

bloco("permissoes-da-aya", () => {
  /*
  "Não aparece o botão": a Aya explica a permissão que falta para o perfil de
  quem pergunta (src/lib/aya/permissoes-da-aya.ts), com as mesmas regras de
  src/lib/acessos/access-roles.ts que escondem o botão.
*/

  const perfil = (permissoes, extra = {}) => ({
    ativo: true,
    perfil: "usuario",
    admin_global: false,
    permissoes,
    ...extra,
  });
  const LEITOR = perfil({ recursos: "leitor", aprovados: "leitor" });
  const EDITOR = perfil({ recursos: "editor", aprovados: "editor" });

  describe("qual ação", () => {
    it.each([
      ["não aparece o botão de novo recurso", "novo-recurso"],
      ["por que não consigo deferir o recurso?", "decidir-recurso"],
      ["cadê o botão de emitir a carta?", "status-do-candidato"],
      ["não consigo dar acesso", "dar-acesso"],
      ["quem pode liberar o edital fora da janela?", "liberar-entrevista"],
      ["botão rodar agora sumiu", "rodar-agora"],
    ])("%s → %s", (pergunta, id) => {
      expect(acaoDaPergunta(pergunta)?.id).toBe(id);
    });

    it("pergunta que não é de permissão fica de fora", () => {
      expect(acaoDaPergunta("como registrar um recurso?")).toBeNull();
      expect(
        acaoDaPergunta(
          "por que um edital não aparece em Conduzir entrevistas?",
        ),
      ).toBeNull();
    });
  });

  describe("resposta para o perfil", () => {
    it("quem não pode: diz a permissão que falta e quem libera", () => {
      const r = explicarPermissao(
        "não aparece o botão de novo recurso",
        LEITOR,
      );
      expect(r.answer).toContain("não tem permissão para registrar recursos");
      expect(r.answer).toContain("nível Editor em Recursos");
      expect(r.answer).toContain("Configurações › Acessos");
    });

    it("quem pode: diz onde fica e o que conferir", () => {
      const r = explicarPermissao(
        "não aparece o botão de novo recurso",
        EDITOR,
      );
      expect(r.answer).toContain("pode registrar recursos");
      expect(r.answer).toContain("topo de Analisar recursos");
      expect(r.acao).toBe("analisar-recursos");
    });

    it("sem perfil, quem responde é a base", () => {
      expect(
        explicarPermissao("quem pode decidir um recurso?", null),
      ).toBeNull();
    });

    it("a busca usa o perfil antes da base", () => {
      const r = responderAya({
        question: "não aparece o botão de novo recurso",
        section: "recursos",
        perfil: LEITOR,
      });
      expect(r.provider).toBe("monitora-perfil");
      expect(r.answer).toContain("nível Editor em Recursos");
    });
  });
});

bloco("resumo-do-dia", () => {
  const BRUTO = {
    data: "2026-09-15",
    perfil: "p1",
    nome: "Ana Souza",
    responsavel: true,
    editais: ["e1", 2, null],
    demandas: ["d1"],
    hoje: [
      {
        tipo: "etapa",
        id: "c1",
        titulo: "Prazo de recurso",
        edital: "10/2026",
        unidade: "DSEI X",
        marco: "inicio",
        data: "2026-09-15",
      },
      { tipo: "etapa", id: "", titulo: "sem id", data: "2026-09-15" },
    ],
    proximos: [],
    atrasadas: [
      {
        tipo: "demanda",
        id: "d1",
        titulo: "Relatório",
        data_fim: "2026-09-10",
        marco: "fim",
        data: "2026-09-10",
        pode_concluir: true,
      },
    ],
  };

  describe("leitura do resumo do dia", () => {
    it("lê a resposta, descarta itens sem id e dá a cor do tipo", () => {
      const resumo = lerResumoDoDia(BRUTO);
      expect(resumo).toMatchObject({
        perfil: "p1",
        responsavel: true,
        editais: ["e1", "2"],
        mostrarAoEntrar: true,
      });
      expect(resumo.hoje).toHaveLength(1);
      expect(resumo.hoje[0]).toMatchObject({
        cor: "rosa",
        rotuloDoTipo: "Recursos",
      });
      expect(resumo.atrasadas[0]).toMatchObject({
        cor: "demanda",
        rotuloDoTipo: "Demanda interna",
        podeConcluir: true,
      });
      expect(totalDoResumo(resumo)).toBe(2);
      expect(lerResumoDoDia({})).toBeNull();
      expect(
        lerResumoDoDia({ ...BRUTO, mostrar_ao_entrar: false }).mostrarAoEntrar,
      ).toBe(false);
    });

    it("textos de cada linha", () => {
      const resumo = lerResumoDoDia(BRUTO);
      expect(quandoDoItem(resumo.hoje[0], "hoje")).toBe("começa 15/09");
      expect(quandoDoItem(resumo.atrasadas[0], "atrasadas")).toBe(
        "venceu 10/09",
      );
      expect(ondeDoItem(resumo.hoje[0])).toBe("10/2026 · DSEI X");
      expect(ondeDoItem(resumo.atrasadas[0])).toBe("Demanda interna");
    });

    it("concluir tira a demanda de todos os blocos", () => {
      const resumo = semDemanda(lerResumoDoDia(BRUTO), "d1");
      expect(resumo.atrasadas).toEqual([]);
      expect(totalDoResumo(resumo)).toBe(1);
    });

    it("até cinco por bloco e 'e mais N'", () => {
      const lista = Array.from(
        { length: 8 },
        () => lerResumoDoDia(BRUTO).hoje[0],
      );
      expect(recortarBloco(lista).visiveis).toHaveLength(LIMITE_POR_BLOCO);
      expect(recortarBloco(lista).mais).toBe(3);
      expect(recortarBloco(lista.slice(0, 2)).mais).toBe(0);
    });
  });

  describe("saudação pela hora de Brasília", () => {
    it("bom dia, boa tarde, boa noite", () => {
      expect(horaEmBrasilia(new Date("2026-09-15T13:00:00Z"))).toBe(10);
      expect(saudacao(new Date("2026-09-15T13:00:00Z"))).toBe("Bom dia");
      expect(saudacao(new Date("2026-09-15T17:00:00Z"))).toBe("Boa tarde");
      expect(saudacao(new Date("2026-09-15T23:30:00Z"))).toBe("Boa noite");
      // 01h UTC ainda é noite do dia anterior em Brasília.
      expect(saudacao(new Date("2026-09-16T01:00:00Z"))).toBe("Boa noite");
    });

    it("título com o primeiro nome", () => {
      expect(primeiroNome("  Ana Maria Souza ")).toBe("Ana");
      expect(
        tituloDoResumo("Ana Souza", new Date("2026-09-15T13:00:00Z")),
      ).toBe("Bom dia, Ana — seus editais hoje");
      expect(tituloDoResumo("", new Date("2026-09-15T17:00:00Z"))).toBe(
        "Boa tarde — seus editais hoje",
      );
    });

    it("visto por pessoa e dia", () => {
      expect(chaveDoVisto("p1", "2026-09-15")).toBe(
        "agsus:resumo-do-dia:visto:p1:2026-09-15",
      );
    });
  });
});

bloco("termos-da-aya", () => {
  describe("sinônimos em grupos", () => {
    it("tem os 26 grupos do domínio, com as siglas do processo seletivo", () => {
      expect(Object.keys(SINONIMOS)).toEqual([
        "edital",
        "vaga",
        "candidato",
        "aprovado",
        "recurso",
        "entrevista",
        "analise",
        "acesso",
        "dsei",
        "polo",
        "ubsi",
        "casai",
        "cronograma",
        "convocacao",
        "contratacao",
        "chamado",
        "indicador",
        "parecer",
        "art",
        "lote",
        "reserva",
        "ampla",
        "negro",
        "cotaindigena",
        "pcd",
        "subjudice",
      ]);
    });

    it.each([
      ["edital", "PSS", "certame", "processo seletivo", "processos seletivos"],
      ["vaga", "cargo", "cargos", "vagas"],
      ["cadastro reserva", "CR", "cadastro de reserva"],
      ["negro", "PP", "pretos e pardos", "cota racial"],
      ["pcd", "PcD", "pessoa com deficiência", "pessoas com deficiência"],
      ["subjudice", "sub judice", "decisão judicial", "liminar"],
      ["art", "ART", "nota da ART", "autodeclaração"],
      ["candidato", "inscrito", "inscritos", "candidatas"],
      ["aprovado", "classificado", "aprovadas", "classificados"],
      ["recurso", "contestação", "impugnação", "contestar", "recorrer"],
      ["entrevista", "banca", "entrevistador"],
      ["análise", "currículo", "análise curricular"],
      ["acesso", "permissão", "login", "permissões"],
      ["DSEI", "distrito", "distrito sanitário especial indígena", "DSEIs"],
      ["polo base", "polos base", "polo"],
      ["UBSI", "posto", "posto de saúde", "unidade básica de saúde indígena"],
      ["CASAI", "casa de apoio", "CASAIs", "casa de saúde indígena"],
      ["cronograma", "calendário", "calendários"],
      ["convocação", "convocar", "convocados"],
      ["contratação", "admissão", "contratados"],
      ["chamado", "suporte", "ticket"],
      ["indicador", "KPI", "KPIs", "métrica"],
      ["parecer", "jurídico", "parecer jurídico"],
    ])("%s e as variações viram um conceito só", (...formas) => {
      const conceitos = formas.map((forma) => termosDe(forma));
      for (const termos of conceitos) expect(termos).toEqual(conceitos[0]);
      expect(conceitos[0][0]).toMatch(/^#/);
    });

    it("vale para expressões de várias palavras no meio da frase", () => {
      expect(termosDe("como abrir um processo seletivo novo")).toEqual([
        "abr",
        "#edital",
        "nov",
      ]);
      expect(termosDe("onde fica a casa de apoio")).toEqual(["#casai"]);
      // "posto de trabalho" é vaga; "posto" sozinho é UBSI.
      expect(termosDe("posto de trabalho")).toEqual(["#vaga"]);
      expect(termosDe("posto")).toEqual(["#ubsi"]);
    });

    it("compara no singular: aprovado não é aprovação", () => {
      expect(termosDe("aprovados")).toEqual(["#aprovado"]);
      expect(termosDe("aprovação")).not.toEqual(["#aprovado"]);
      expect(termosDe("classificação")).not.toEqual(["#aprovado"]);
    });
  });

  describe("radical simples", () => {
    it("tira plural e sufixos comuns", () => {
      expect(singular("editais")).toBe("edital");
      expect(singular("convocacoes")).toBe("convocacao");
      expect(singular("casais")).toBe("casai");
      expect(singular("dseis")).toBe("dsei");
      expect(singular("pss")).toBe("pss");
      expect(radical("desativadas")).toBe(radical("desativar"));
      expect(radical("publicado")).toBe(radical("publicar"));
      expect(radical("prazos")).toBe("praz");
    });

    it("convocação, convocar e convocados dão no mesmo termo", () => {
      const termos = ["convocação", "convocar", "convocados", "convocadas"].map(
        (p) => termosDe(p),
      );
      for (const t of termos) expect(t).toEqual(termos[0]);
    });

    it("tira stopwords, mas guarda não, sem e quem", () => {
      expect(palavrasDe("Como é que eu faço para ver o edital?")).toEqual([
        "ver",
        "edital",
      ]);
      expect(palavrasDe("não contratados sem inscritos")).toEqual([
        "nao",
        "contratado",
        "sem",
        "inscrito",
      ]);
      expect(palavrasDe("quem decide")).toEqual(["quem", "decide"]);
    });
  });

  describe("distância de digitação", () => {
    it("conta a transposição como um erro só", () => {
      expect(distancia("entrevsita", "entrevista")).toBe(1);
      expect(distancia("rcurso", "recurso")).toBe(1);
      expect(distancia("recruso", "recurso")).toBe(1);
      expect(distancia("edital", "edital")).toBe(0);
    });

    it("para cedo quando passa do teto", () => {
      expect(distancia("abc", "xyzuvw", 1)).toBe(2);
    });

    it("aceita mais erros em palavras longas", () => {
      expect(toleranciaPara("pss")).toBe(0);
      expect(toleranciaPara("prazo")).toBe(1);
      expect(toleranciaPara("entrevista")).toBe(2);
    });
  });
});

bloco("visao-geral/o-que-significa", () => {
  /*
    Revisão de 17/11/2026: o ⓘ de cada indicador da Visão geral manda à Aya
    a pergunta exata do verbete daquele número; a resposta vem da base, não
    de um texto na tela. A pergunta guardada vale uma vez só.
  */
  it("cada pergunta do ⓘ cai no verbete do próprio indicador", () => {
    const titulo = {
      vagas: "Vagas imediatas (indicador)",
      contratadas: "Contratadas (indicador)",
      emSelecao: "Em seleção (indicador)",
      ociosas: "Ociosas (indicador)",
      alemDasVagas: "Contratações além das vagas imediatas (indicador)",
      inscritos: "Inscritos (indicador)",
    };
    for (const [chave, pergunta] of Object.entries(PERGUNTA_DO_INDICADOR)) {
      const [primeiro] = buscarNaBase(
        pergunta,
        { pagina: "dashboard" },
        VERBETES_AYA,
      ).ranking;
      expect(primeiro.verbete.titulo).toBe(titulo[chave]);
      expect(primeiro.pontuacao).toBeGreaterThanOrEqual(LIMIAR_CONFIANTE);
    }
  });

  it("a pergunta deixada para a Aya vale uma vez e expira", () => {
    perguntarParaAAya("o que significa ociosas na visao geral", 1000);
    expect(consumirPerguntaParaAAya(2000)).toBe(
      "o que significa ociosas na visao geral",
    );
    expect(consumirPerguntaParaAAya(2000)).toBeNull();
    perguntarParaAAya("o que significa inscritos na visao geral", 1000);
    expect(consumirPerguntaParaAAya(1000 + 16_000)).toBeNull();
    perguntarParaAAya("   ");
    expect(consumirPerguntaParaAAya()).toBeNull();
  });
});
