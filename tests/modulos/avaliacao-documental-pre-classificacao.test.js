import { readFileSync } from "node:fs";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { contadoresDaPreClassificacao } from "../../src/lib/avaliacao-documental/tela-da-pre-classificacao.ts";
import {
  definirAreaAtual,
  redefinirDadosDoMonitoramento,
} from "../../src/componentes/dados-do-monitoramento.ts";
import { montarAvaliacaoDocumental } from "../../src/modulos/avaliacao-documental/avaliacao-documental.tsx";
import { criarEstadoDaPreClassificacao } from "../../src/modulos/avaliacao-documental/estado-da-pre-classificacao.ts";
import {
  linhasDaPreInteira,
  motivosDasLinhas,
  resumoDaPreInteira,
} from "../../src/lib/avaliacao-documental/paginas-da-pre-classificacao.ts";
import {
  clicar,
  digitar,
  escolher,
  esperar,
} from "../componentes/interacoes.js";

/*
  A aba Triagem da Avaliação documental (fase F2): lê o que o job
  Python gravou (obter_pre_classificacao), mostra os contadores, a linha de
  corte, a divergência ART × declarada e os eliminados; a coordenação pede o
  recálculo (RPC disparar_robo com o edital), muda o tamanho do lote por
  vaga (versão nova da regra) e registra/exporta as listas PROVISORIA e LOTE.
  Códigos AM-4.x, AM-5.x e AM-16.x de docs/historias-de-usuario/analises-no-monitora.md.
*/

const { regras } = JSON.parse(
  readFileSync(
    "tests/fixtures/avaliacao-documental/casos-de-pontuacao.json",
    "utf8",
  ),
);
const PROJ = regras["PROJ26-CURRICULAR"];
const CONFIG = {
  ...PROJ,
  lote: { ...PROJ.lote, base: "MULTIPLO_VAGAS", publica_reposicao: true },
};

const regraSalva = (versao, configuracao = CONFIG, situacao = "CONFERIDA") => ({
  versao,
  situacao,
  modelo_origem: "PROJ26-CURRICULAR",
  configuracao,
  atualizado_em: "2026-10-06T12:00:00Z",
  por: "Gestora",
  versoes: [
    {
      versao,
      em: "2026-10-06T12:00:00Z",
      por: "Gestora",
      motivo: "",
      configuracao,
    },
  ],
});

const inscrito = (codigo, extra) => ({
  id: `id-${codigo}`,
  vaga: "179698",
  codigo,
  nome: `Pessoa ${codigo}`,
  situacao: "RANQUEADO",
  motivo: null,
  art: 20,
  nota: 20,
  origem_nota: "ART",
  declarada: null,
  divergente: false,
  modalidade: "AC",
  posicao: null,
  lote: null,
  motivo_entrada: null,
  ...extra,
});

const PRE = (regra, pode = true, extra = {}) => ({
  schema_version: 1,
  edital: {
    id: "e93",
    edital: "93/2026",
    unidade: "Boa Vista",
    area: "projetos",
    rotulo: "93/2026",
  },
  papel: pode ? "COORDENADOR" : null,
  pode_coordenar: pode,
  pode_registrar_lista: pode,
  pode_publicar_lista: pode,
  regra: regra
    ? {
        versao: regra.versao,
        situacao: regra.situacao,
        configuracao: regra.configuracao,
      }
    : null,
  regra_classificacao: { versao: 1, configuracao: {} },
  em_andamento: false,
  ultima_execucao: {
    id: "precl-1",
    inicio: "2026-10-06T12:00:00Z",
    fim: "2026-10-06T12:01:00Z",
    situacao: "CONCLUIDA",
    disparo: "ROBO",
    edital: { edital: "e93", situacao: "PROCESSADO" },
  },
  vagas: [
    {
      codigo: "179698",
      candidatos_empregare: 5,
      cargo: "Técnico de Segurança do Trabalho",
      lotacao: "Boa Vista",
      vagas_imediatas: 1,
      cadastro_reserva: true,
      inscritos: 5,
      eliminados: 1,
      ranqueados: 4,
      no_lote: 2,
      tamanho: 2,
      descricao: "1 × (1 + CR) = 2",
      art_corte: 24,
      divergencias: 1,
      avisos: ["FORA_DO_LOTE_ACIMA_DO_CORTE"],
    },
    {
      codigo: "180231",
      candidatos_empregare: 7,
      inscritos: null,
      tamanho: null,
      avisos: [],
    },
  ],
  candidatos: [
    inscrito("7000001", {
      situacao: "NO_LOTE",
      posicao: 1,
      art: 26,
      nota: 26,
      lote: 1,
      motivo_entrada: "Lote inicial",
    }),
    inscrito("7000003", {
      situacao: "NO_LOTE",
      posicao: 2,
      art: 24,
      nota: 24,
      lote: 2,
      declarada: 10,
      divergente: true,
      motivo_entrada: "Entrou no lugar de 7000009 (Cancelou a inscrição)",
    }),
    inscrito("7000004", { posicao: 3, art: 22, nota: 22 }),
    inscrito("7000005", { posicao: 4, art: 18, nota: 18 }),
    inscrito("7000009", {
      situacao: "ELIMINADO",
      motivo: "Cancelou a inscrição",
      art: 29,
      nota: 29,
    }),
  ],
  listas: [],
  ...extra,
});

/*
  O banco em partes (20261029120000), tirado da mesma triagem
  inteira: o resumo da abertura, as vagas, as listas, as páginas de cada
  vaga (cursor = deslocamento) e a conferência dos comunicados marcados.
*/
function partesDoBanco(atual) {
  return {
    obter_resumo_pre_classificacao: () => {
      const {
        vagas: _vagas,
        listas: _listas,
        lotes: _lotes,
        regra_classificacao: _rc,
        ...cabecalho
      } = resumoDaPreInteira(atual());
      // Os totais do edital, como o banco soma do instantâneo.
      const c = contadoresDaPreClassificacao(atual());
      return {
        ...cabecalho,
        congelamento: null,
        totais: {
          inscritos: c.inscritos,
          eliminados: c.eliminados,
          ranqueados: c.ranqueados,
          no_lote: c.noLote,
          no_lote_regra: c.noLotePelaRegra,
          no_lote_decisao: c.noLotePorDecisao,
          tamanho: c.tamanho,
          divergencias: c.divergencias,
          vagas_sem_pre: c.vagasSemPreClassificacao,
        },
      };
    },
    obter_vagas_pre_classificacao: () => ({
      vagas: resumoDaPreInteira(atual()).vagas,
    }),
    obter_listas_pre_classificacao: () => {
      const r = resumoDaPreInteira(atual());
      return {
        listas: r.listas,
        lotes: r.lotes,
        regra_classificacao: r.regra_classificacao,
      };
    },
    listar_pre_classificacao: ({
      p_vaga,
      p_grupo,
      p_busca,
      p_apos,
      p_limite,
      p_motivo,
    }) => {
      const recorte = {
        vaga: p_vaga,
        grupo: p_grupo,
        busca: p_busca ?? "",
      };
      const todos = linhasDaPreInteira(atual(), {
        ...recorte,
        motivo: p_motivo ?? "",
      });
      const inicio = p_apos ?? 0;
      const por_vaga = {};
      for (const c of todos) por_vaga[c.vaga] = (por_vaga[c.vaga] ?? 0) + 1;
      return {
        candidatos: todos.slice(inicio, inicio + p_limite),
        proximo: inicio + p_limite < todos.length ? inicio + p_limite : null,
        total: todos.length,
        por_vaga,
        ...(p_grupo === "ELIMINADOS"
          ? {
              por_motivo: motivosDasLinhas(
                linhasDaPreInteira(atual(), recorte),
              ),
            }
          : {}),
      };
    },
    conferir_eliminados_pre_classificacao: ({ p_chaves }) => ({
      candidatos: atual().candidatos.filter((c) =>
        p_chaves.includes(`${c.vaga}|${c.codigo}`),
      ),
      vagas: atual().vagas,
    }),
  };
}

/* Responde a leitura inteira e as partes com esta triagem; o resto, como antes. */
const comPre = (pre, normal) => {
  const partes = {
    obter_pre_classificacao: () => pre,
    ...partesDoBanco(() => pre),
  };
  return async (nome, args) =>
    partes[nome]
      ? { data: partes[nome](args), error: null }
      : normal(nome, args);
};
const ausente = () => ({
  data: null,
  error: { code: "PGRST202", message: "Could not find the function" },
});
const chamadasDe = (rpc, nome) =>
  rpc.mock.calls.filter(([n]) => n === nome).map(([, a]) => a);
const esperarBusca = () =>
  act(async () => new Promise((r) => setTimeout(r, 350)));

function supabaseFalso({
  pode = true,
  situacao = "CONFERIDA",
  pre,
  disparo = "ACEITO",
} = {}) {
  let regra = regraSalva(2, CONFIG, situacao);
  /* A regra própria da Triagem (20261029160000): a seção tirada da regra acima. */
  let triagem = {
    versao: 1,
    situacao,
    configuracao: { formato: 1, lote: CONFIG.lote },
    versoes: [{ versao: 1, nome: null }],
  };
  const respostas = {
    obter_regra_triagem: () => ({
      pode_coordenar: pode,
      papel: pode ? "COORDENADOR" : null,
      regra: triagem,
    }),
    salvar_regra_triagem: ({ p_configuracao, p_versao_atual }) => {
      triagem = {
        versao: p_versao_atual + 1,
        situacao: "CONFERIR",
        configuracao: p_configuracao,
        versoes: [],
      };
      return { regra: triagem };
    },
    disparar_robo: () => 61,
    situacao_do_disparo_robo: () => ({ disparo: 61, situacao: disparo }),
    listar_editais_avaliacao: () => ({
      area: "projetos",
      editais: [
        {
          id: "e93",
          edital: "93/2026",
          unidade: "Boa Vista",
          ativo: true,
          versao_regra: regra.versao,
        },
      ],
    }),
    obter_regra_analise: () => ({
      edital: { id: "e93", edital: "93/2026", area: "projetos" },
      papel: pode ? "COORDENADOR" : null,
      pode_coordenar: pode,
      origem: "PLANILHA",
      regra,
      modelos: [],
      nota_minima: { nota_minima: 15 },
      aldeias: { quantidade: 0 },
      fichas_concluidas: 0,
    }),
    obter_equipe_edital: () => ({
      papel: null,
      pode_coordenar: pode,
      gestores: [],
      equipe: [],
      pessoas: [],
      vagas: [],
    }),
    obter_pre_classificacao: () => pre ?? PRE(regra, pode),
    ...partesDoBanco(() => pre ?? PRE(regra, pode)),
    salvar_regra_analise: ({ p_configuracao, p_versao_atual }) => {
      regra = regraSalva(p_versao_atual + 1, p_configuracao, "CONFERIR");
      return { regra, fichas_afetadas: [] };
    },
    registrar_lista_pre_classificacao: ({ p_tipo, p_lote }) => ({
      lista: { id: `lista-${p_tipo}`, tipo: p_tipo },
      resultado: {
        schema: 1,
        tipo: p_tipo,
        lote: p_lote,
        edital: { id: "e93", edital: "Edital 93/2026", unidade: "Boa Vista" },
        casas: 1,
        modalidades: [],
        vagas: [
          {
            chave: "179698",
            codigo: "179698",
            cabecalho:
              "VAGA 179698 - Técnico de Segurança do Trabalho - 1 vaga + CR",
            geral: [
              {
                posicao: 1,
                nome: "Pessoa 7000001",
                nota: 26,
                modalidades: ["AC"],
              },
              {
                posicao: 2,
                nome: "Pessoa 7000003",
                nota: 24,
                modalidades: ["AC"],
              },
            ],
            listas: {},
            eliminados:
              p_tipo === "PROVISORIA"
                ? [
                    {
                      nome: "Pessoa 7000009",
                      motivo: "Cancelou a inscrição",
                      detalhe: "",
                    },
                  ]
                : [],
          },
        ],
        totais: { elegiveis: 2, eliminados: 1 },
      },
    }),
  };
  return {
    rpc: vi.fn(async (nome, args) => ({
      data: respostas[nome]?.(args) ?? null,
      error: null,
    })),
    auth: {
      getSession: async () => ({
        data: { session: { user: { id: "u" }, access_token: "t" } },
      }),
    },
  };
}

let secao;
let painel;
const toast = vi.fn();
/* As releituras do acompanhamento do Recalcular: o teste as roda à mão. */
let agendados = [];
const agendar = (fn) => agendados.push(fn);
const rodarAgendado = () =>
  act(async () => {
    await agendados.shift()();
  });

async function montar(supabase) {
  secao = document.createElement("section");
  secao.id = "page-avaliacao-documental";
  secao.className = "page active";
  document.body.append(secao);
  await act(async () => {
    painel = montarAvaliacaoDocumental({
      supabase,
      toast,
      agendar,
    });
  });
  await act(async () => void painel.render());
  await esperar();
  await escolher(secao.querySelector(".avd-edital select"), "e93");
  await esperar();
  const aba = abaDaPre();
  // Quem não coordena não tem a aba (abre na Fila).
  if (aba) await clicar(aba);
  await esperar();
}
const abaDaPre = () =>
  [...secao.querySelectorAll("button")].find(
    (b) =>
      b.textContent.includes("Triagem") ||
      b.textContent.includes("Abrir triagem"),
  );
const botao = (texto) =>
  [...secao.querySelectorAll("button")].find((b) =>
    b.textContent.trim().startsWith(texto),
  );
/* A tela da Triagem em abas: Resumo, Por vaga, Eliminados, Listas oficiais. */
async function abrirAba(id) {
  await clicar(secao.querySelector(`.avd-pre [data-aba='${id}']`));
  await esperar();
}
/* Na aba Por vaga, abre a vaga (as listas dela só carregam aberta). */
async function abrirVaga(codigo) {
  if (!secao.querySelector(".avd-pre-vagas")) await abrirAba("vagas");
  const vaga = secao.querySelector(`[data-vaga-recolhida='${codigo}']`);
  await act(async () => {
    vaga.open = true;
    vaga.dispatchEvent(new Event("toggle"));
  });
  await esperar();
  return secao.querySelector(`[data-vaga='${codigo}']`);
}
/* Uma ação do menu "Ações" (abre o menu se estiver fechado). */
async function itemDoMenu(acao) {
  if (!secao.querySelector(".avd-pre [role='menu']"))
    await clicar(secao.querySelector(".avd-pre [data-acao='abrir-menu']"));
  return secao.querySelector(`[role='menuitem'][data-acao='${acao}']`);
}
/* Recalcular: escolher no menu e confirmar. */
async function pedirRecalculo() {
  await clicar(await itemDoMenu("recalcular"));
  await clicar(secao.querySelector("[data-acao='confirmar-recalcular']"));
}

beforeEach(() => {
  redefinirDadosDoMonitoramento();
  definirAreaAtual("projetos");
});
afterEach(async () => {
  await act(async () => painel?.raiz?.unmount());
  secao?.remove();
  document.body.innerHTML = "";
  redefinirDadosDoMonitoramento();
  toast.mockClear();
  agendados = [];
});

describe("Triagem (AM-4)", () => {
  it("AM-4.4: contadores, linha de corte, divergência e eliminados à parte", async () => {
    const supabase = supabaseFalso();
    await montar(supabase);
    // A tela abre só com o Resumo: nem vagas, nem listas, nem linhas.
    expect(supabase.rpc).toHaveBeenCalledWith(
      "obter_resumo_pre_classificacao",
      {
        p_edital: "e93",
      },
    );
    expect(
      secao.querySelector(".avd-pre [aria-selected='true']").dataset.aba,
    ).toBe("resumo");
    expect(
      chamadasDe(supabase.rpc, "obter_vagas_pre_classificacao"),
    ).toHaveLength(0);
    expect(
      chamadasDe(supabase.rpc, "obter_listas_pre_classificacao"),
    ).toHaveLength(0);
    expect(chamadasDe(supabase.rpc, "listar_pre_classificacao")).toHaveLength(
      0,
    );
    expect(chamadasDe(supabase.rpc, "obter_pre_classificacao")).toHaveLength(0);
    expect(
      chamadasDe(supabase.rpc, "obter_pre_classificacao_se_mudou"),
    ).toHaveLength(0);
    // A trava vem no resumo: nada de chamada à parte.
    expect(
      chamadasDe(supabase.rpc, "obter_congelamento_inscricoes"),
    ).toHaveLength(0);
    const kpis = secao.querySelector(".ui-kpis").textContent;
    expect(kpis).toContain("Inscritos5");
    expect(kpis).toContain("Eliminados1");
    expect(kpis).toContain("2 de 2");
    // ART × recalculada vira indicador na faixa, com o atalho para os casos.
    expect(
      secao.querySelector("[data-acao='ver-divergencias']").textContent,
    ).toContain("1 com ART × recalculada");
    // Por vaga: a parte das vagas só agora; cada vaga com os números à vista.
    await abrirAba("vagas");
    expect(
      chamadasDe(supabase.rpc, "obter_vagas_pre_classificacao"),
    ).toHaveLength(1);
    expect(
      secao.querySelector("[data-vaga-recolhida='179698'] summary").textContent,
    ).toContain("5 inscritos · 1 eliminados");
    expect(chamadasDe(supabase.rpc, "listar_pre_classificacao")).toHaveLength(
      0,
    );
    const vaga = await abrirVaga("179698");
    // As linhas de cada vaga vêm 50 por vez, só com a vaga aberta.
    expect(chamadasDe(supabase.rpc, "listar_pre_classificacao")).toContainEqual(
      {
        p_edital: "e93",
        p_vaga: "179698",
        p_grupo: "CLASSIFICADOS",
        p_busca: null,
        p_apos: null,
        p_limite: 50,
      },
    );
    expect(vaga.textContent).toContain(
      "VAGA 179698 - Técnico de Segurança do Trabalho - Boa Vista - 1 vaga + CR",
    );
    expect(vaga.textContent).toContain("linha de corte 24");
    const linhas = [...vaga.querySelectorAll("tbody tr")].map(
      (tr) => tr.dataset.candidato || tr.textContent,
    );
    expect(linhas.slice(0, 5)).toEqual([
      "7000001",
      "7000003",
      "Linha de corte",
      "7000004",
      "7000005",
    ]);
    expect(
      vaga.querySelector("[data-candidato='7000003']").textContent,
    ).toContain("diverge");
    // Os eliminados só são lidos quando o grupo abre.
    expect(
      chamadasDe(supabase.rpc, "listar_pre_classificacao").some(
        (a) => a.p_grupo === "ELIMINADOS",
      ),
    ).toBe(false);
    const grupo = vaga.querySelector(".avd-eliminados");
    await act(async () => {
      grupo.open = true;
      grupo.dispatchEvent(new Event("toggle"));
    });
    await esperar();
    expect(grupo.textContent).toContain("Cancelou a inscrição");
    // Os eliminados rolam dentro do cartão, como o lote (a tabela solta
    // herdava min-width 1180px de app.css e a página rolava de lado).
    expect(
      vaga.querySelector(".avd-eliminados .ui-tabela-rolagem > table"),
    ).not.toBeNull();
    expect(vaga.textContent).toContain(
      "Fora do lote com nota acima da linha de corte",
    );
    expect(
      secao.querySelector("[data-vaga-recolhida='180231']").textContent,
    ).toContain("ainda sem triagem");
    // Listas oficiais: a parte só ao abrir a aba.
    await abrirAba("listas");
    expect(
      chamadasDe(supabase.rpc, "obter_listas_pre_classificacao"),
    ).toHaveLength(1);
  });

  it("Recalcular pede o job só do edital; leitor não vê o botão", async () => {
    const supabase = supabaseFalso();
    await montar(supabase);
    // O menu pede confirmação antes de disparar.
    await clicar(await itemDoMenu("recalcular"));
    expect(chamadasDe(supabase.rpc, "disparar_robo")).toHaveLength(0);
    expect(
      secao.querySelector("[aria-label='Confirmar o recálculo']").textContent,
    ).toContain("Recalcular a triagem de");
    await clicar(secao.querySelector("[data-acao='confirmar-recalcular']"));
    await esperar();
    expect(supabase.rpc).toHaveBeenCalledWith("disparar_robo", {
      p_robo: "pre_classificacao",
      p_inputs: { editais: ["e93"] },
    });
    expect((await itemDoMenu("recalcular")).textContent).toBe(
      "Recalcular (pedido enviado)",
    );
    await act(async () => painel.raiz.unmount());
    secao.remove();
    // Quem não coordena nem tem a aba Triagem (nem a lê do banco).
    const leitor = supabaseFalso({ pode: false });
    await montar(leitor);
    expect(abaDaPre()).toBeUndefined();
    expect(secao.querySelector("[data-acao='abrir-menu']")).toBeNull();
    expect(secao.querySelector("[data-acao='recalcular']")).toBeNull();
    expect(secao.querySelector(".avd-vaga input")).toBeNull();
    expect(
      leitor.rpc.mock.calls.some(([n]) =>
        n.startsWith("obter_pre_classificacao"),
      ),
    ).toBe(false);
  });

  it("Atualizar e a reabertura da tela relêem a triagem da aba aberta", async () => {
    const supabase = supabaseFalso();
    await montar(supabase);
    const kpis = () => secao.querySelector(".ui-kpis").textContent;
    expect(kpis()).toContain("Inscritos5");
    const normal = supabase.rpc.getMockImplementation();
    const comInscritos = (n) => {
      const pre = PRE(regraSalva(2));
      pre.vagas[0] = { ...pre.vagas[0], inscritos: n };
      supabase.rpc.mockImplementation(comPre(pre, normal));
    };
    comInscritos(9);
    await clicar(secao.querySelector("[data-acao='atualizar']"));
    await esperar();
    expect(kpis()).toContain("Inscritos9");
    // Voltar à tela pelo menu ou "Atualizar dados" do app chamam render().
    comInscritos(11);
    await act(async () => void painel.render());
    await esperar();
    expect(kpis()).toContain("Inscritos11");
  });

  it("Recalcular que falha diz por quê e o botão volta", async () => {
    const supabase = supabaseFalso();
    await montar(supabase);
    supabase.rpc.mockImplementationOnce(async () => ({
      data: null,
      error: {
        code: "42501",
        message: "Só a coordenação da avaliação do edital recalcula a triagem.",
      },
    }));
    await pedirRecalculo();
    await esperar();
    expect(secao.querySelector("[role='alert']").textContent).toBe(
      "Recálculo não pedido: Só a coordenação da avaliação do edital recalcula a triagem.",
    );
    expect((await itemDoMenu("recalcular")).textContent).toBe("Recalcular");
    expect((await itemDoMenu("recalcular")).disabled).toBe(false);
    expect(toast).toHaveBeenLastCalledWith(
      "Recálculo não pedido: Só a coordenação da avaliação do edital recalcula a triagem.",
      "error",
    );

    supabase.rpc.mockImplementationOnce(async () => {
      throw new TypeError("Failed to fetch");
    });
    await pedirRecalculo();
    await esperar();
    expect(secao.querySelector("[role='alert']").textContent).toMatch(
      /^Recálculo não pedido: /,
    );
    expect((await itemDoMenu("recalcular")).disabled).toBe(false);
    expect(agendados).toHaveLength(0);
  });

  it("Recalcular com a chave do cofre vencida: diz o que fazer e o botão volta", async () => {
    const supabase = supabaseFalso({ disparo: "SEM_TOKEN" });
    await montar(supabase);
    await pedirRecalculo();
    await esperar();
    expect(supabase.rpc).toHaveBeenCalledWith("disparar_robo", {
      p_robo: "pre_classificacao",
      p_inputs: { editais: ["e93"] },
    });
    // A conferência do pedido (3 s) vem antes das releituras.
    await rodarAgendado();
    await esperar();
    expect(supabase.rpc).toHaveBeenCalledWith("situacao_do_disparo_robo", {
      p_disparo: 61,
    });
    expect(secao.querySelector("[role='alert']").textContent).toBe(
      "Recálculo não pedido: A chave de disparo dos robôs expirou ou foi recusada; um administrador precisa trocá-la no cofre (Vault) com o nome github_disparo_robos.",
    );
    expect((await itemDoMenu("recalcular")).disabled).toBe(false);
  });

  it("Recalcular pedido avisa e relê sozinho até a execução terminar", async () => {
    const supabase = supabaseFalso();
    await montar(supabase);
    await pedirRecalculo();
    await esperar();
    expect(secao.querySelector("[role='status']").textContent).toMatch(
      /^Recálculo pedido às \d\d:\d\d\. A lista atualiza sozinha quando terminar\.$/,
    );
    // A conferência do pedido (o GitHub aceitou) e a primeira releitura.
    expect(agendados).toHaveLength(2);
    await rodarAgendado();
    expect(secao.querySelector("[role='alert']")).toBeNull();
    expect(agendados).toHaveLength(1);

    const normal = supabase.rpc.getMockImplementation();
    const responder = (pre) =>
      supabase.rpc.mockImplementation(comPre(pre, normal));
    // 1ª releitura: o job está rodando.
    responder(PRE(regraSalva(2), true, { em_andamento: true }));
    await rodarAgendado();
    expect((await itemDoMenu("recalcular")).textContent).toBe(
      "Recalcular (rodando…)",
    );
    expect(agendados).toHaveLength(1);
    // 2ª releitura: terminou, com a execução nova e os números novos.
    const nova = PRE(regraSalva(2), true, {
      ultima_execucao: {
        id: "precl-2",
        inicio: "2026-10-06T13:00:00Z",
        fim: "2026-10-06T13:01:00Z",
        situacao: "CONCLUIDA",
        disparo: "TELA",
        edital: { edital: "e93", situacao: "PROCESSADO" },
      },
    });
    nova.vagas[0] = { ...nova.vagas[0], inscritos: 9 };
    responder(nova);
    await rodarAgendado();
    expect(agendados).toHaveLength(0);
    expect(secao.querySelector(".ui-kpis").textContent).toContain("Inscritos9");
    expect(secao.querySelector("[role='status']").textContent).toMatch(
      /^Triagem recalculada às \d\d:\d\d\.$/,
    );
    expect((await itemDoMenu("recalcular")).textContent).toBe("Recalcular");
    expect(toast).toHaveBeenLastCalledWith(
      expect.stringMatching(/^Triagem recalculada/),
      "success",
    );
  });

  it("regra não conferida trava o Recalcular e diz o que fazer", async () => {
    await montar(supabaseFalso({ situacao: "CONFERIR" }));
    expect((await itemDoMenu("recalcular")).disabled).toBe(true);
    expect(secao.textContent).toContain(
      "Confira a regra da Triagem (Editais › Regras da Triagem) para recalcular.",
    );
  });

  it("edital sem regra conferida na última execução vira aviso", async () => {
    const supabase = supabaseFalso();
    const regra = regraSalva(2);
    const pre = PRE(regra, true, {
      ultima_execucao: {
        id: "x",
        inicio: "2026-10-06T12:00:00Z",
        situacao: "CONCLUIDA",
        edital: { situacao: "SEM_REGRA" },
      },
    });
    await montar({
      ...supabase,
      rpc: vi.fn(comPre(pre, (nome, args) => supabase.rpc(nome, args))),
    });
    expect(secao.textContent).toContain("Edital sem regra conferida");
  });
});

describe("lote por vaga (AM-5.0)", () => {
  it("o tamanho editado vira versão nova da regra da Triagem com motivo", async () => {
    const supabase = supabaseFalso();
    await montar(supabase);
    await abrirVaga("179698");
    const campo = secao.querySelector(
      "[data-vaga='179698'] input[type='number']",
    );
    expect(campo.placeholder).toBe("6");
    await digitar(campo, "4");
    expect(secao.querySelector("[data-acao='salvar-tamanhos']").disabled).toBe(
      true,
    );
    await digitar(
      secao.querySelector("[aria-label='Salvar os tamanhos do lote'] input"),
      "Lote do 93 definido pela coordenação",
    );
    await clicar(secao.querySelector("[data-acao='salvar-tamanhos']"));
    await esperar();
    const chamada = supabase.rpc.mock.calls.find(
      ([nome]) => nome === "salvar_regra_triagem",
    );
    expect(chamada[1].p_configuracao.lote.por_vaga).toEqual({ 179698: 4 });
    expect(chamada[1].p_configuracao.formato).toBe(1);
    expect(chamada[1].p_motivo).toBe("Lote do 93 definido pela coordenação");
    expect(chamada[1].p_versao_atual).toBe(1);
    // A regra da análise não é mais tocada pela Triagem.
    expect(
      supabase.rpc.mock.calls.some(([nome]) => nome === "salvar_regra_analise"),
    ).toBe(false);
  });
});

describe("listas PROVISORIA e LOTE (AM-16)", () => {
  it("registra a Provisória e o lote de cada reposição e exporta pelo gerador da Classificação", async () => {
    const supabase = supabaseFalso();
    await montar(supabase);
    await abrirAba("listas");
    await clicar(botao("Registrar"));
    await esperar();
    expect(supabase.rpc).toHaveBeenCalledWith(
      "registrar_lista_pre_classificacao",
      {
        p_edital: "e93",
        p_tipo: "PROVISORIA",
        p_lote: null,
      },
    );
    // publica_reposicao: o lote inicial e a reposição 2 aparecem para registrar.
    expect(botao("Registrar o lote inicial (1)")).toBeTruthy();
    await clicar(botao("Registrar a reposição 2 (1)"));
    await esperar();
    expect(supabase.rpc).toHaveBeenCalledWith(
      "registrar_lista_pre_classificacao",
      {
        p_edital: "e93",
        p_tipo: "LOTE",
        p_lote: 2,
      },
    );
    expect(botao("Copiar para o SEI")).toBeTruthy();
    expect(botao("Eliminados: DOCX")).toBeTruthy();
  });
});

describe("inclusão no lote por decisão da coordenação", () => {
  const COM_DECISAO = (pode = true) => {
    const base = PRE(regraSalva(2), pode);
    return {
      ...base,
      vagas: [
        { ...base.vagas[0], no_lote: 3, no_lote_regra: 2, no_lote_decisao: 1 },
        base.vagas[1],
      ],
      candidatos: base.candidatos.map((c) =>
        c.codigo === "7000005"
          ? {
              ...c,
              situacao: "NO_LOTE",
              lote: 2,
              entrada: "DECISAO",
              motivo_entrada: "Critério CORES",
              decisao: {
                motivo: "Critério CORES",
                por: "Gestora",
                em: "2026-10-07T12:00:00Z",
                situacao_regra: "RANQUEADO",
              },
            }
          : c.codigo === "7000009"
            ? { ...c, motivo_codigo: "CANCELADO" }
            : c,
      ),
    };
  };
  const comRespostas = (pre, extras) => {
    const supabase = supabaseFalso({ pre });
    const original = supabase.rpc.getMockImplementation();
    supabase.rpc.mockImplementation(async (nome, args) =>
      extras[nome] ? extras[nome](args) : original(nome, args),
    );
    return supabase;
  };

  it('mostra o selo "Decisão: Critério CORES" e "N pela regra + M por decisão"; inclui com a sugestão do motivo', async () => {
    const incluir = vi.fn(() => ({
      data: { incluidos: 1, fichas_criadas: 1 },
      error: null,
    }));
    const supabase = comRespostas(COM_DECISAO(), {
      incluir_no_lote_por_decisao: incluir,
    });
    await montar(supabase);
    expect(secao.querySelector(".ui-kpis").textContent).toContain(
      "2 de 2 pela regra + 1 por decisão",
    );
    const vaga = await abrirVaga("179698");
    expect(vaga.querySelector("[data-lote-da-vaga]").textContent).toContain(
      "Lote: 2 de 2 pela regra + 1 por decisão",
    );
    const linha = vaga.querySelector("[data-candidato='7000005']");
    expect(linha.querySelector(".avd-selo-decisao").textContent).toBe(
      "Decisão: Critério CORES",
    );
    expect(linha.querySelector(".avd-selo-decisao").title).toContain(
      "Por Gestora",
    );

    await clicar(vaga.querySelector("[data-acao='incluir-por-decisao']"));
    const opcoes = [
      ...document.querySelectorAll(
        "table[aria-label='Candidatos fora do lote pela regra'] tbody tr",
      ),
    ].map((tr) => tr.dataset.candidato);
    expect(opcoes).toEqual(["7000004", "7000009"]);
    const motivo = document.querySelector("input[list='avdMotivosDaDecisao']");
    expect(motivo.value).toBe("Critério CORES");
    const confirmar = document.querySelector(
      "[data-acao='confirmar-incluir-por-decisao']",
    );
    expect(confirmar.disabled).toBe(true);
    await clicar(document.querySelector("input[aria-label='Incluir 7000009']"));
    await clicar(confirmar);
    await esperar();
    expect(incluir).toHaveBeenCalledWith({
      p_edital: "e93",
      p_codigos: ["7000009"],
      p_motivo: "Critério CORES",
      p_vaga: "179698",
    });
    expect(toast).toHaveBeenCalledWith(
      "1 candidato incluído no lote por decisão da coordenação.",
      "success",
    );
  });

  it("revoga com motivo; a ficha concluída o banco recusa e a tela diz por quê", async () => {
    const revogar = vi.fn(() => ({
      data: null,
      error: {
        code: "22023",
        message:
          "O candidato 7000005 já tem a ficha concluída: a decisão não se revoga.",
      },
    }));
    await montar(
      comRespostas(COM_DECISAO(), { revogar_decisao_lote: revogar }),
    );
    await abrirVaga("179698");
    const linha = () => secao.querySelector("[data-candidato='7000005']");
    await clicar(linha().querySelector("[data-acao='abrir-revogar-decisao']"));
    const campo = linha().querySelector("[data-revogar='7000005'] input");
    await digitar(campo, "curto");
    expect(
      linha().querySelector("[data-acao='revogar-decisao']").disabled,
    ).toBe(true);
    await digitar(campo, "Decisão registrada por engano");
    await clicar(linha().querySelector("[data-acao='revogar-decisao']"));
    await esperar();
    expect(revogar).toHaveBeenCalledWith({
      p_edital: "e93",
      p_codigos: ["7000005"],
      p_motivo: "Decisão registrada por engano",
      p_vaga: "179698",
    });
    expect(linha().textContent).toContain("ficha concluída");
  });

  it("quem não coordena não vê a aba, nem incluir nem revogar", async () => {
    await montar(supabaseFalso({ pode: false, pre: COM_DECISAO(false) }));
    expect(abaDaPre()).toBeUndefined();
    expect(secao.querySelector("[data-vaga='179698']")).toBeNull();
    expect(secao.querySelector("[data-acao='incluir-por-decisao']")).toBeNull();
    expect(
      secao.querySelector("[data-acao='abrir-revogar-decisao']"),
    ).toBeNull();
  });
});

describe("estado da triagem: voltar à aba não relê", () => {
  it("relê só com outro edital, outra versão da regra ou depois de 5 minutos", async () => {
    let agora = new Date("2026-10-15T12:00:00Z");
    const rpc = vi.fn(async (nome) => ({
      data: nome === "obter_resumo_pre_classificacao" ? { vagas: [] } : null,
      error: null,
    }));
    const pre = criarEstadoDaPreClassificacao({
      supabase: { rpc },
      agora: () => agora,
    });
    const leituras = () =>
      rpc.mock.calls.filter(([n]) => n === "obter_resumo_pre_classificacao")
        .length;
    await pre.garantirCarregado("e1", "2");
    await pre.garantirCarregado("e1", "2");
    expect(leituras()).toBe(1);
    await pre.garantirCarregado("e1", "3");
    expect(leituras()).toBe(2);
    await pre.garantirCarregado("e2", "3");
    expect(leituras()).toBe(3);
    agora = new Date(agora.getTime() + 5 * 60 * 1000);
    await pre.garantirCarregado("e2", "3");
    expect(leituras()).toBe(4);
    await pre.carregar();
    expect(leituras()).toBe(5);
  });
});

describe("Triagem por versão (20261014230000), banco sem as partes (antes de 20261029120000)", () => {
  /* Um banco com a leitura por versão e a situação leve, sem o resumo nem as páginas. */
  function bancoNovo() {
    const estado = {
      versao: "v1",
      execucao: { id: "precl-1", situacao: "CONCLUIDA" },
      andamento: false,
    };
    const pacote = () => ({
      schema_version: 1,
      em_andamento: estado.andamento,
      ultima_execucao: estado.execucao,
      vagas: [{ codigo: "179698", inscritos: 2 }],
      versao: estado.versao,
      candidatos_em_colunas: {
        colunas: ["codigo", "situacao", "vaga"],
        dicionarios: { situacao: ["NO_LOTE"], vaga: ["179698"] },
        linhas: [
          ["7000001", 0, 0],
          ["7000003", 0, 0],
        ],
      },
    });
    const rpc = vi.fn(async (nome, args) => {
      if (nome === "obter_pre_classificacao_se_mudou")
        return {
          data:
            args.p_versao === estado.versao
              ? { inalterado: true, versao: estado.versao }
              : pacote(),
          error: null,
        };
      if (nome === "obter_situacao_pre_classificacao")
        return {
          data: {
            em_andamento: estado.andamento,
            ultima_execucao: estado.execucao,
          },
          error: null,
        };
      if (nome === "disparar_robo") return { data: 61, error: null };
      if (
        nome.endsWith("_pre_classificacao") &&
        nome !== "obter_situacao_pre_classificacao"
      )
        return ausente();
      return { data: null, error: null };
    });
    return { estado, rpc };
  }
  const chamadas = (rpc, nome) =>
    rpc.mock.calls.filter(([n]) => n === nome).map(([, a]) => a);

  it("refaz os inscritos das colunas; a releitura sem mudança manda a versão e fica com o que tem", async () => {
    const { rpc } = bancoNovo();
    const pre = criarEstadoDaPreClassificacao({
      supabase: { rpc },
      copias: null,
    });
    await pre.carregar("e1");
    const dados = pre.obter().dados;
    // O resumo sai da leitura inteira; as páginas, dela também.
    expect(dados.candidatos).toBeUndefined();
    expect(dados.lotes).toEqual([]);
    const pagina = await pre.listar({ vaga: "179698", grupo: "CLASSIFICADOS" });
    expect(pagina.linhas.map((c) => c.codigo)).toEqual(["7000001", "7000003"]);
    expect(pagina.total).toBe(2);
    await pre.carregar("e1");
    expect(chamadas(rpc, "obter_pre_classificacao_se_mudou")).toEqual([
      { p_edital: "e1", p_versao: null },
      { p_edital: "e1", p_versao: "v1" },
    ]);
    expect(pre.obter().dados).toEqual(dados);
    expect(chamadas(rpc, "obter_pre_classificacao")).toHaveLength(0);
    // Banco sem as partes: depois da primeira recusa, a página vem da leitura guardada.
    expect(chamadas(rpc, "listar_pre_classificacao")).toHaveLength(0);
  });

  it("Recalcular acompanha pela situação leve e relê o pacote só no fim", async () => {
    const { estado, rpc } = bancoNovo();
    const fila = [];
    const pre = criarEstadoDaPreClassificacao({
      supabase: { rpc },
      copias: null,
      toast: () => {},
      agendar: (fn) => fila.push(fn),
    });
    await pre.carregar("e1");
    await pre.recalcular();
    // A conferência do pedido e a primeira volta do acompanhamento.
    await fila.shift()();
    estado.andamento = true;
    estado.versao = "v2";
    await fila.shift()();
    expect(pre.obter().dados.em_andamento).toBe(true);
    await fila.shift()();
    estado.andamento = false;
    estado.execucao = { id: "precl-2", situacao: "CONCLUIDA", fim: null };
    estado.versao = "v3";
    await fila.shift()();
    expect(fila).toHaveLength(0);
    expect(chamadas(rpc, "obter_situacao_pre_classificacao")).toHaveLength(3);
    // Uma leitura ao abrir e uma no fim: nenhuma a cada volta.
    expect(chamadas(rpc, "obter_pre_classificacao_se_mudou")).toEqual([
      { p_edital: "e1", p_versao: null },
      { p_edital: "e1", p_versao: "v1" },
    ]);
    expect(pre.obter().dados.ultima_execucao.id).toBe("precl-2");
    expect(pre.obter().aviso.texto).toMatch(/^Triagem recalculada/);
  });
});

describe("aba Eliminados da Triagem", () => {
  it("busca e filtra no banco (vaga e motivo), marca o filtro e imprime conferindo só os marcados", async () => {
    const base = PRE(regraSalva(2));
    const supabase = supabaseFalso({
      pre: {
        ...base,
        candidatos: base.candidatos.map((c) =>
          c.codigo === "7000009" ? { ...c, motivo_codigo: "CANCELADO" } : c,
        ),
      },
    });
    await montar(supabase);
    await abrirAba("eliminados");
    // A lista é a do edital todo, 50 por vez, com as opções de motivo.
    expect(chamadasDe(supabase.rpc, "listar_pre_classificacao")).toContainEqual(
      {
        p_edital: "e93",
        p_vaga: null,
        p_grupo: "ELIMINADOS",
        p_busca: null,
        p_apos: null,
        p_limite: 50,
      },
    );
    const motivos = [
      ...secao.querySelectorAll(
        "[data-acao='filtro-motivo-eliminados'] option",
      ),
    ].map((o) => o.textContent);
    expect(motivos).toEqual(["Todos os motivos", "Cancelou a inscrição (1)"]);
    expect(secao.querySelector("[data-acao='comunicados-zip']").disabled).toBe(
      true,
    );
    await escolher(
      secao.querySelector("[data-acao='filtro-motivo-eliminados']"),
      secao.querySelector(
        "[data-acao='filtro-motivo-eliminados'] option:last-child",
      ).value,
    );
    await esperar();
    expect(
      chamadasDe(supabase.rpc, "listar_pre_classificacao").some(
        (a) => a.p_grupo === "ELIMINADOS" && a.p_motivo,
      ),
    ).toBe(true);
    await digitar(
      secao.querySelector("[data-acao='buscar-espelho-eliminado']"),
      "pessoa 7000009",
    );
    await esperar();
    expect(
      chamadasDe(supabase.rpc, "listar_pre_classificacao").some(
        (a) => a.p_grupo === "ELIMINADOS" && a.p_busca === "pessoa 7000009",
      ),
    ).toBe(true);
    await clicar(secao.querySelector("[data-acao='comunicados-marcar-busca']"));
    await esperar();
    expect(
      secao.querySelector("[data-acao='comunicados-marcados']").textContent,
    ).toBe("1 marcado(s)");
    expect(
      secao.querySelector(
        "[data-candidato='7000009'] [data-acao='marcar-comunicado']",
      ).checked,
    ).toBe(true);
    expect(secao.querySelector("[data-acao='comunicados-pdf']").disabled).toBe(
      false,
    );
    await clicar(secao.querySelector("[data-acao='comunicados-imprimir']"));
    await esperar();
    // Confere só os marcados, como estão agora (nunca a triagem inteira).
    expect(
      chamadasDe(supabase.rpc, "conferir_eliminados_pre_classificacao"),
    ).toEqual([{ p_edital: "e93", p_chaves: ["179698|7000009"] }]);
    expect(chamadasDe(supabase.rpc, "obter_pre_classificacao")).toHaveLength(0);
    expect(secao.textContent).toContain(
      "1 comunicado no documento para imprimir.",
    );
  });

  it("a marcação vale nas duas abas: marcar na vaga aparece em Eliminados", async () => {
    const supabase = supabaseFalso();
    await montar(supabase);
    const vaga = await abrirVaga("179698");
    const grupo = vaga.querySelector(".avd-eliminados");
    await act(async () => {
      grupo.open = true;
      grupo.dispatchEvent(new Event("toggle"));
    });
    await esperar();
    await clicar(
      vaga.querySelector(
        "[data-candidato='7000009'] [data-acao='marcar-comunicado']",
      ),
    );
    await abrirAba("eliminados");
    expect(
      secao.querySelector("[data-acao='comunicados-marcados']").textContent,
    ).toBe("1 marcado(s)");
  });
});

describe("caixa marcar todos no cabeçalho dos eliminados", () => {
  it("na aba Eliminados, marca e desmarca todos do filtro (não só a página)", async () => {
    const supabase = supabaseFalso();
    await montar(supabase);
    await abrirAba("eliminados");
    await digitar(
      secao.querySelector("[data-acao='buscar-espelho-eliminado']"),
      "pessoa 7000009",
    );
    await esperar();
    const todos = () =>
      secao.querySelector(
        "[data-aba-da-triagem='eliminados'] [data-acao='marcar-todos-eliminados']",
      );
    expect(todos().dataset.estado).toBe("nenhuma");
    await clicar(todos());
    await esperar();
    expect(chamadasDe(supabase.rpc, "listar_pre_classificacao")).toContainEqual(
      expect.objectContaining({
        p_vaga: null,
        p_grupo: "ELIMINADOS",
        p_busca: "pessoa 7000009",
        p_limite: 500,
      }),
    );
    expect(
      secao.querySelector("[data-acao='comunicados-marcados']").textContent,
    ).toBe("1 marcado(s)");
    expect(todos().checked).toBe(true);
    await clicar(todos());
    expect(
      secao.querySelector("[data-acao='comunicados-marcados']").textContent,
    ).toBe("0 marcado(s)");
  });

  it("na aba Por vaga, a caixa da vaga marca os eliminados da vaga", async () => {
    const supabase = supabaseFalso();
    await montar(supabase);
    const vaga = await abrirVaga("179698");
    const grupo = vaga.querySelector(".avd-eliminados");
    await act(async () => {
      grupo.open = true;
      grupo.dispatchEvent(new Event("toggle"));
    });
    await esperar();
    await clicar(vaga.querySelector("[data-acao='marcar-todos-eliminados']"));
    await esperar();
    expect(chamadasDe(supabase.rpc, "listar_pre_classificacao")).toContainEqual(
      expect.objectContaining({ p_vaga: "179698", p_grupo: "ELIMINADOS" }),
    );
    await abrirAba("eliminados");
    expect(
      secao.querySelector("[data-acao='comunicados-marcados']").textContent,
    ).toBe("1 marcado(s)");
  });
});

describe("menu Ações da Triagem", () => {
  it("só quem coordena tem o menu; Recalcular espera a confirmação e Cancelar não dispara", async () => {
    const supabase = supabaseFalso();
    await montar(supabase);
    await clicar(await itemDoMenu("recalcular"));
    await clicar(botao("Cancelar"));
    expect(chamadasDe(supabase.rpc, "disparar_robo")).toHaveLength(0);
    expect(
      secao.querySelector("[data-acao='confirmar-recalcular']"),
    ).toBeNull();
  });
});
