import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clicar,
  digitar,
  escolher,
  esperar,
} from "../componentes/interacoes.js";
import { proximoEstado } from "../../src/lib/resposta-do-recurso.js";

/*
  A resposta ao candidato e os anexos, na gaveta do painel de recursos: modelo
  → prévia com os dados do recurso → rascunho → revisão (a autora não aprova;
  outra pessoa aprova) → documento (.docx, impressão, anexo) → enviada; os
  anexos (envio ao bucket + registro, download com URL assinada depois do
  registro); quem só lê não escreve; e os modelos de resposta da
  administração. O banco é um falso com estado, que segue as regras da
  migration no essencial.
*/

vi.mock("../../src/lib/chartjs-global.js", () => ({
  Chart: class {
    constructor(canvas, configuracao) {
      this.data = configuracao.data;
      this.options = configuracao.options;
    }
    update() {}
    destroy() {}
  },
}));

const { montarRecursos } =
  await import("../../src/modulos/recursos/recursos.jsx");

const RECURSO_ID = "527c2b8c-7744-4a4b-bc06-108f6683297b";
const AUTORA = "00000000-0000-4000-8000-0000000000a2";
const REVISOR = "00000000-0000-4000-8000-0000000000a3";
const MODELO = {
  id: "6f1d8a52-3b0e-4c11-9a51-000000000101",
  versao: 1,
  area: null,
  origem: "analise-curricular",
  situacao: "DEFERIDO",
  nome: "Deferido — Análise curricular",
  corpo:
    "RESPOSTA A RECURSO\n\nCandidato(a): {nome_candidato} ({codigo_candidato})\nEdital {edital}\n\nFundamentação:\n{fundamentacao}\n\nNota: {nota_anterior} → {nota_atual}.",
};
const OUTRO_MODELO = {
  ...MODELO,
  id: "6f1d8a52-3b0e-4c11-9a51-000000000201",
  origem: "entrevista",
  nome: "Deferido — Entrevista",
};

function criarServidor({
  podeEditar = true,
  podeDecidir = true,
  admin = false,
  resposta = null,
  anexos = [],
} = {}) {
  const servidor = {
    eu: AUTORA,
    resposta,
    anexos,
    objetos: [],
    recurso: {
      id: RECURSO_ID,
      nu: 7,
      edital_id: "e1",
      edital: "105/2026",
      unidade: "DSEI Litoral Sul",
      origem: "analise-curricular",
      analise_id: "a1",
      fora_analise: false,
      candidato: "Ana Ribeiro",
      codigo: "111",
      cargo: "Enfermeiro 40h",
      vaga: "V-10",
      nota_anterior: 50,
      nota_atual: 55,
      resultado_anterior: "Reprovado",
      resultado_atual: "Aprovado",
      analista: "Carla",
      situacao: "DEFERIDO",
      processo_sei: null,
      mudou_classificacao: false,
      download_empregare_em: null,
      processo_sei_em: null,
      upload_sei_em: null,
      resposta_candidato_em: null,
      decisao_em: "2026-09-25T12:00:00Z",
      criado_em: "2026-09-20T12:00:00Z",
      atualizado_em: "2026-09-20T12:00:00Z",
      revisao: 1,
    },
  };
  const payload = () => ({
    schema_version: 1,
    area: "saude-indigena",
    pode_editar: podeEditar,
    pode_decidir: podeDecidir,
    pode_administrar_modelos: admin,
    origens: [
      { id: "analise-curricular", rotulo: "Análise curricular", ativo: true },
      { id: "entrevista", rotulo: "Entrevista", ativo: true },
    ],
    editais: [],
    modelos: podeEditar ? [MODELO, OUTRO_MODELO] : [],
    recursos: [
      {
        ...servidor.recurso,
        resposta_estado: servidor.resposta?.estado || null,
        qt_anexos: servidor.anexos.filter((a) => a.ativo).length,
      },
    ],
    cronogramas: [],
  });
  const rpc = vi.fn(async (nome, args = {}) => {
    const r = servidor.resposta;
    switch (nome) {
      case "get_recursos_da_area":
        return { data: payload(), error: null };
      case "get_recurso_candidato_detalhe":
        return {
          data: {
            id: RECURSO_ID,
            eu: servidor.eu,
            observacao: "",
            etapas: {},
            historico: [],
            anexos: servidor.anexos,
            resposta: r && { ...r, historico: [] },
          },
          error: null,
        };
      case "salvar_resposta_recurso": {
        const d = args.p_dados;
        if (r && d.revisao !== r.revisao)
          return { data: null, error: { code: "40001", message: "revisão" } };
        servidor.resposta = {
          ...(r || { id: "resp1", passou_revisao: false, revisao: 0 }),
          estado: "rascunho",
          modelo_id: d.modelo_id,
          modelo_versao: d.modelo_versao,
          modelo_nome: MODELO.nome,
          modelo_corpo: MODELO.corpo,
          modelo_situacao: MODELO.situacao,
          modelo_vigente: true,
          fundamentacao: d.fundamentacao,
          texto_final: d.texto_final,
          autor_id: servidor.eu,
          autor: servidor.eu === AUTORA ? "Autora" : "Revisor",
          revisao: (r?.revisao || 0) + 1,
        };
        return {
          data: {
            id: "resp1",
            revisao: servidor.resposta.revisao,
            estado: "rascunho",
          },
          error: null,
        };
      }
      case "transicionar_resposta_recurso": {
        const novo = proximoEstado(r.estado, args.p_acao);
        if (!novo || args.p_revisao !== r.revisao)
          return { data: null, error: { code: "22023", message: "não vale" } };
        if (
          args.p_acao === "aprovar" &&
          r.passou_revisao &&
          servidor.eu === r.autor_id
        )
          return { data: null, error: { code: "42501", message: "autora" } };
        servidor.resposta = {
          ...r,
          estado: novo,
          revisao: r.revisao + 1,
          passou_revisao: r.passou_revisao || args.p_acao === "enviar_revisao",
          envio_revisao_por_id:
            args.p_acao === "enviar_revisao"
              ? servidor.eu
              : r.envio_revisao_por_id,
          revisor_id: ["aprovar", "devolver"].includes(args.p_acao)
            ? servidor.eu
            : r.revisor_id,
          comentario_revisao: args.p_comentario ?? r.comentario_revisao,
        };
        if (args.p_acao === "marcar_enviada")
          servidor.recurso.resposta_candidato_em = "2026-09-29T15:00:00Z";
        return {
          data: { id: r.id, estado: novo, revisao: servidor.resposta.revisao },
          error: null,
        };
      }
      case "registrar_anexo_recurso": {
        const objeto = servidor.objetos.find(
          (o) => o.caminho === args.p_caminho,
        );
        if (!objeto)
          return {
            data: null,
            error: { code: "P0002", message: "sem objeto" },
          };
        servidor.anexos = [
          {
            id: `anexo-${servidor.anexos.length + 1}`,
            tipo: args.p_tipo,
            nome: args.p_nome,
            bytes: objeto.arquivo.size,
            mime: objeto.contentType,
            ativo: true,
            resposta_id: args.p_resposta_id,
            incluido_em: "2026-09-29T15:00:00Z",
            incluido_por: "Autora",
          },
          ...servidor.anexos,
        ];
        return { data: { id: servidor.anexos[0].id }, error: null };
      }
      case "registrar_download_anexo_recurso": {
        const anexo = servidor.anexos.find((a) => a.id === args.p_anexo_id);
        servidor.downloads = (servidor.downloads || 0) + 1;
        return {
          data: {
            bucket: "recursos-anexos",
            caminho: anexo.caminho,
            nome: anexo.nome,
          },
          error: null,
        };
      }
      case "listar_modelos_resposta_recurso":
        return {
          data: {
            marcadores: [],
            areas: [{ id: "saude-indigena", rotulo: "Saúde Indígena" }],
            origens: [
              {
                id: "analise-curricular",
                rotulo: "Análise curricular",
                ativo: true,
              },
            ],
            modelos: [{ ...MODELO, ativo: true, em_uso: 2, versoes: [] }],
          },
          error: null,
        };
      case "salvar_modelo_resposta_recurso":
        return {
          data: { id: "novo-modelo", versao: 1, criou_versao: true },
          error: null,
        };
      default:
        return { data: null, error: null };
    }
  });
  const upload = vi.fn(async (caminho, arquivo, opcoes) => {
    servidor.objetos.push({
      caminho,
      arquivo,
      contentType: opcoes.contentType,
    });
    return { data: { path: caminho }, error: null };
  });
  const createSignedUrl = vi.fn(async (caminho) => ({
    data: { signedUrl: `https://storage.exemplo/assinada/${caminho}?token=t` },
    error: null,
  }));
  const from = vi.fn(() => ({ upload, createSignedUrl }));
  servidor.supabase = { rpc, storage: { from } };
  servidor.storage = { from, upload, createSignedUrl };
  return servidor;
}

let raiz;
let painel;
const toast = vi.fn();
const baixarArquivo = vi.fn();
const abrirUrl = vi.fn();
const imprimir = vi.fn();
let ids = 0;
const novoId = () =>
  `0b8f5e0e-1c1d-4f55-9a55-${String(++ids).padStart(12, "0")}`;

async function montar(servidor) {
  raiz = document.createElement("div");
  document.body.append(raiz);
  await act(async () => {
    painel = montarRecursos({
      secao: raiz,
      supabase: servidor.supabase,
      areaAtual: () => "saude-indigena",
      toast,
      baixarArquivo,
      abrirUrl,
      imprimir,
      novoId,
    });
  });
  // O legado abre a tela (navigate → render()).
  await act(async () => void painel.render());
  await esperar();
}

async function abrirGaveta() {
  await clicar(document.querySelector(".recursos-linha"));
  await esperar();
  await esperar();
}

const secao = (nome) =>
  document.querySelector(`.ui-secao[data-section="${nome}"]`);
const botaoEm = (onde, texto) =>
  [...(onde || document).querySelectorAll("button")].find((b) =>
    b.textContent.trim().startsWith(texto),
  );
/* As respostas em revisão, aprovadas e devolvidas são pendências (os KPIs delas saíram). */
const pendencia = (chave) =>
  Number.parseInt(
    document.querySelector(`.ui-pendencias [data-pendencia="${chave}"] small`)
      ?.textContent || "0",
    10,
  );

afterEach(async () => {
  await act(async () => painel?.raiz?.unmount());
  raiz?.remove();
  document.body.innerHTML = "";
  document.body.className = "";
  for (const f of [toast, baixarArquivo, abrirUrl, imprimir]) f.mockClear();
});

describe("resposta ao candidato", () => {
  it("modelo → prévia → rascunho → revisão → aprovação por outra pessoa → documento → enviada", async () => {
    const servidor = criarServidor();
    await montar(servidor);
    expect(pendencia("resposta_em_revisao")).toBe(0);
    await abrirGaveta();
    const resposta = secao("resposta");
    expect(resposta).not.toBeNull();

    // Recurso deferido: o modelo da origem já vem escolhido; o de entrevista não aparece.
    const modelo = resposta.querySelector('select[name="modelo"]');
    expect(modelo.value).toBe(`${MODELO.id}:1`);
    expect([...modelo.options].map((o) => o.textContent)).toEqual([
      "Escolha o modelo",
      "Deferido — Análise curricular",
    ]);
    const previa = () =>
      resposta.querySelector('[aria-label="Prévia da resposta"]').textContent;
    expect(previa()).toContain("Candidato(a): Ana Ribeiro (111)");
    expect(previa()).toContain("[não informado: Fundamentação]");
    expect(resposta.textContent).toContain(
      "Sem valor no recurso: Fundamentação",
    );

    await digitar(
      resposta.querySelector('textarea[name="fundamentacao"]'),
      "O diploma <b>foi</b> aceito.",
    );
    expect(previa()).toContain("O diploma <b>foi</b> aceito.");
    expect(previa()).toContain("Nota: 50 → 55.");
    expect(resposta.querySelector("b")).toBeNull();

    await clicar(botaoEm(resposta, "Salvar rascunho"));
    await esperar();
    const salvo = servidor.supabase.rpc.mock.calls.find(
      ([nome]) => nome === "salvar_resposta_recurso",
    )[1].p_dados;
    expect(salvo).toMatchObject({
      recurso_id: RECURSO_ID,
      modelo_id: MODELO.id,
      modelo_versao: 1,
      fundamentacao: "O diploma <b>foi</b> aceito.",
      revisao: null,
    });
    expect(salvo.texto_final).toContain(
      "Fundamentação:\nO diploma <b>foi</b> aceito.",
    );

    // Rascunho salvo: enviar para revisão (com confirmação).
    const secaoAtual = () => secao("resposta");
    expect(secaoAtual().textContent).toContain("Resposta: rascunho");
    await clicar(botaoEm(secaoAtual(), "Enviar para revisão"));
    await clicar(
      botaoEm(
        secaoAtual().querySelector(".recursos-confirmacao"),
        "Enviar para revisão",
      ),
    );
    await esperar();
    expect(servidor.supabase.rpc).toHaveBeenCalledWith(
      "transicionar_resposta_recurso",
      {
        p_resposta_id: "resp1",
        p_acao: "enviar_revisao",
        p_revisao: 1,
        p_comentario: null,
      },
    );
    expect(pendencia("resposta_em_revisao")).toBe(1);

    // Em revisão: sem editor de texto; a autora não aprova.
    expect(
      secaoAtual().querySelector('textarea[name="fundamentacao"]'),
    ).toBeNull();
    const aprovar = secaoAtual().querySelector('button[data-acao="aprovar"]');
    expect(aprovar.disabled).toBe(true);
    expect(aprovar.title).toMatch(/não pode aprová-la/);

    // Outra pessoa (o revisor) aprova, com comentário opcional.
    servidor.eu = REVISOR;
    await esperar(() => painel.estado.carregarDetalhe(RECURSO_ID));
    expect(
      secaoAtual().querySelector('button[data-acao="aprovar"]').disabled,
    ).toBe(false);
    await clicar(secaoAtual().querySelector('button[data-acao="aprovar"]'));
    await digitar(
      secaoAtual().querySelector('textarea[name="comentario"]'),
      "Ok.",
    );
    await clicar(
      botaoEm(secaoAtual().querySelector(".recursos-confirmacao"), "Aprovar"),
    );
    await esperar();
    expect(servidor.resposta.estado).toBe("aprovada");
    expect(pendencia("resposta_aprovada")).toBe(1);

    // Documento: .docx, impressão e anexo ao recurso.
    await clicar(botaoEm(secaoAtual(), "Baixar"));
    expect(baixarArquivo).toHaveBeenCalledTimes(1);
    const [blob, nome] = baixarArquivo.mock.calls[0];
    expect(nome).toBe("resposta-recurso-7-ana-ribeiro.docx");
    expect(blob.type).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    await clicar(botaoEm(secaoAtual(), "Imprimir / PDF"));
    expect(imprimir).toHaveBeenCalledWith(
      servidor.resposta.texto_final,
      "resposta-recurso-7-ana-ribeiro",
    );
    await clicar(botaoEm(secaoAtual(), "Anexar .docx ao recurso"));
    await esperar();
    expect(servidor.storage.from).toHaveBeenCalledWith("recursos-anexos");
    const [caminho, , opcoes] = servidor.storage.upload.mock.calls[0];
    expect(caminho).toMatch(
      new RegExp(
        `^saude-indigena/${RECURSO_ID}/0b8f5e0e-1c1d-4f55-9a55-\\d{12}-resposta-recurso-7-ana-ribeiro\\.docx$`,
      ),
    );
    expect(opcoes).toEqual({
      contentType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      upsert: false,
    });
    expect(servidor.anexos[0]).toMatchObject({
      tipo: "resposta",
      resposta_id: "resp1",
    });
    expect(secao("anexos").textContent).toContain(
      "resposta-recurso-7-ana-ribeiro.docx",
    );

    // Marcar enviada: confirma e relê a aba (a etapa do recurso foi marcada).
    const leituras = () =>
      servidor.supabase.rpc.mock.calls.filter(
        ([n]) => n === "get_recursos_da_area",
      ).length;
    const antes = leituras();
    await clicar(
      secaoAtual().querySelector('button[data-acao="marcar_enviada"]'),
    );
    expect(
      secaoAtual().querySelector(".recursos-confirmacao").textContent,
    ).toContain("Confirme que a resposta aprovada já foi enviada");
    await clicar(
      botaoEm(
        secaoAtual().querySelector(".recursos-confirmacao"),
        "Marcar resposta enviada",
      ),
    );
    await esperar();
    expect(servidor.resposta.estado).toBe("enviada");
    expect(leituras()).toBe(antes + 1);
    expect(
      document.querySelector(".recursos-linha .recursos-etapa-marca:last-child")
        .className,
    ).toContain("is-feita");
    expect(secaoAtual().querySelector("[data-acao]")).toBeNull();
    // O fluxo inteiro numa gaveta: com a suíte toda em paralelo, passa de 5 s.
  }, 30_000);

  it("devolvida: o comentário é obrigatório e o texto volta a ser editável", async () => {
    const servidor = criarServidor({
      resposta: {
        id: "resp1",
        estado: "em_revisao",
        revisao: 3,
        passou_revisao: true,
        autor_id: AUTORA,
        envio_revisao_por_id: AUTORA,
        modelo_id: MODELO.id,
        modelo_versao: 1,
        modelo_nome: MODELO.nome,
        modelo_corpo: MODELO.corpo,
        modelo_situacao: "DEFERIDO",
        modelo_vigente: true,
        fundamentacao: "x",
        texto_final: "Texto",
      },
    });
    servidor.eu = REVISOR;
    await montar(servidor);
    await abrirGaveta();
    await clicar(
      secao("resposta").querySelector('button[data-acao="devolver"]'),
    );
    const confirmar = botaoEm(
      secao("resposta").querySelector(".recursos-confirmacao"),
      "Devolver",
    );
    expect(confirmar.disabled).toBe(true);
    await digitar(
      secao("resposta").querySelector('textarea[name="comentario"]'),
      "Cite o item do edital.",
    );
    expect(confirmar.disabled).toBe(false);
    await clicar(confirmar);
    await esperar();
    expect(servidor.resposta.estado).toBe("devolvida");
    expect(pendencia("resposta_devolvida")).toBe(1);
    expect(secao("resposta").textContent).toContain(
      "Ajuste pedido na revisão: Cite o item do edital.",
    );
    expect(
      secao("resposta").querySelector('textarea[name="fundamentacao"]'),
    ).not.toBeNull();
  });
});

describe("anexos", () => {
  it("editor anexa: envia ao bucket no caminho da área e do recurso e registra", async () => {
    const servidor = criarServidor();
    await montar(servidor);
    await abrirGaveta();
    const anexos = secao("anexos");
    expect(anexos.textContent).toContain("Nenhum anexo.");
    const campo = anexos.querySelector('input[type="file"]');
    const grande = new File(["x"], "grande.pdf", { type: "application/pdf" });
    Object.defineProperty(grande, "size", { value: 21 * 1024 * 1024 });
    await act(async () => {
      Object.defineProperty(campo, "files", {
        value: [grande],
        configurable: true,
      });
      campo.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(anexos.textContent).toContain("O arquivo passa de 20 MB.");
    expect(botaoEm(anexos, "Anexar").disabled).toBe(true);

    const pdf = new File(["%PDF-1.7"], "Recurso da Ana.pdf", {
      type: "application/pdf",
    });
    await act(async () => {
      Object.defineProperty(campo, "files", {
        value: [pdf],
        configurable: true,
      });
      campo.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await escolher(
      anexos.querySelector('select[name="tipo"]'),
      "recurso_candidato",
    );
    await clicar(botaoEm(anexos, "Anexar"));
    await esperar();
    const [caminho, arquivo, opcoes] = servidor.storage.upload.mock.calls[0];
    expect(caminho).toMatch(
      new RegExp(
        `^saude-indigena/${RECURSO_ID}/[0-9a-f-]{36}-Recurso-da-Ana\\.pdf$`,
      ),
    );
    expect(arquivo).toBe(pdf);
    expect(opcoes).toEqual({ contentType: "application/pdf", upsert: false });
    expect(servidor.supabase.rpc).toHaveBeenCalledWith(
      "registrar_anexo_recurso",
      {
        p_recurso_id: RECURSO_ID,
        p_tipo: "recurso_candidato",
        p_nome: "Recurso da Ana.pdf",
        p_caminho: caminho,
        p_resposta_id: null,
      },
    );
    expect(secao("anexos").textContent).toContain("Recurso da Ana.pdf");
  });

  it("quem só lê: consulta a resposta e baixa (registro antes da URL assinada), sem escrever", async () => {
    const servidor = criarServidor({
      podeEditar: false,
      resposta: {
        id: "resp1",
        estado: "aprovada",
        revisao: 4,
        autor_id: AUTORA,
        modelo_id: MODELO.id,
        modelo_versao: 1,
        modelo_nome: MODELO.nome,
        modelo_situacao: "DEFERIDO",
        modelo_vigente: false,
        fundamentacao: "x",
        texto_final: "RESPOSTA\nTexto aprovado.",
      },
      anexos: [
        {
          id: "an1",
          tipo: "recurso_candidato",
          nome: "recurso.pdf",
          bytes: 2048,
          mime: "application/pdf",
          ativo: true,
          caminho: `saude-indigena/${RECURSO_ID}/x-recurso.pdf`,
        },
        {
          id: "an2",
          tipo: "outro",
          nome: "velho.pdf",
          bytes: 10,
          mime: "application/pdf",
          ativo: false,
          motivo_arquivamento: "duplicado",
        },
      ],
    });
    await montar(servidor);
    await abrirGaveta();
    const resposta = secao("resposta");
    expect(resposta.querySelector("textarea, select")).toBeNull();
    expect(resposta.querySelector("[data-acao]")).toBeNull();
    expect(
      resposta.querySelector('[aria-label="Texto final da resposta"]')
        .textContent,
    ).toBe("RESPOSTA\nTexto aprovado.");
    expect(resposta.textContent).toContain("(há versão mais nova)");
    expect(botaoEm(resposta, "Anexar .docx")).toBeUndefined();
    expect(botaoEm(resposta, "Imprimir / PDF")).toBeTruthy();

    const anexos = secao("anexos");
    expect(anexos.querySelector('input[type="file"]')).toBeNull();
    expect(botaoEm(anexos, "Arquivar")).toBeUndefined();
    // O arquivado aparece recolhido, sem "Baixar" para quem só lê.
    expect(anexos.querySelector("details").textContent).toContain(
      "1 arquivado",
    );
    expect(anexos.querySelector('[aria-label="Baixar velho.pdf"]')).toBeNull();

    await clicar(anexos.querySelector('[aria-label="Baixar recurso.pdf"]'));
    await esperar();
    const ordem = servidor.supabase.rpc.mock.invocationCallOrder.at(-1);
    expect(servidor.supabase.rpc).toHaveBeenLastCalledWith(
      "registrar_download_anexo_recurso",
      { p_anexo_id: "an1" },
    );
    expect(servidor.storage.createSignedUrl).toHaveBeenCalledWith(
      `saude-indigena/${RECURSO_ID}/x-recurso.pdf`,
      60,
      { download: "recurso.pdf" },
    );
    expect(
      servidor.storage.createSignedUrl.mock.invocationCallOrder[0],
    ).toBeGreaterThan(ordem);
    expect(abrirUrl).toHaveBeenCalledWith(
      `https://storage.exemplo/assinada/saude-indigena/${RECURSO_ID}/x-recurso.pdf?token=t`,
    );
  });
});

describe("modelos de resposta (administração)", () => {
  it("só o admin vê o botão; o novo modelo confere marcadores antes de salvar", async () => {
    const semAdmin = criarServidor();
    await montar(semAdmin);
    expect(document.querySelector('[data-acao="modelos"]')).toBeNull();
    await act(async () => painel.raiz.unmount());
    raiz.remove();

    const servidor = criarServidor({ admin: true });
    await montar(servidor);
    await clicar(document.querySelector('[data-acao="modelos"]'));
    await esperar();
    const gaveta = document.getElementById("recursosModelos");
    expect(gaveta.textContent).toContain("Deferido — Análise curricular");
    expect(gaveta.textContent).toContain("2 resposta(s)");

    await clicar(botaoEm(gaveta, "Novo modelo"));
    await digitar(
      gaveta.querySelector('input[name="nome"]'),
      "Indeferido — geral",
    );
    await escolher(
      gaveta.querySelector('select[name="situacao"]'),
      "INDEFERIDO",
    );
    await digitar(
      gaveta.querySelector('textarea[name="corpo"]'),
      "Prezado(a) {nome_candidato}, {nota_final}.",
    );
    await clicar(botaoEm(gaveta, "Salvar modelo"));
    expect(gaveta.textContent).toContain(
      "Marcador desconhecido: {nota_final}.",
    );
    expect(servidor.supabase.rpc).not.toHaveBeenCalledWith(
      "salvar_modelo_resposta_recurso",
      expect.anything(),
    );

    await digitar(
      gaveta.querySelector('textarea[name="corpo"]'),
      "Prezado(a) ",
    );
    await clicar(
      botaoEm(gaveta.querySelector(".recursos-marcadores"), "{nome_candidato}"),
    );
    await act(async () => new Promise((ok) => requestAnimationFrame(ok)));
    expect(gaveta.querySelector('textarea[name="corpo"]').value).toContain(
      "{nome_candidato}",
    );
    await digitar(
      gaveta.querySelector('textarea[name="corpo"]'),
      "Prezado(a) {nome_candidato}, o recurso foi indeferido. {fundamentacao}",
    );
    await clicar(botaoEm(gaveta, "Salvar modelo"));
    await esperar();
    expect(servidor.supabase.rpc).toHaveBeenCalledWith(
      "salvar_modelo_resposta_recurso",
      {
        p_dados: {
          nome: "Indeferido — geral",
          situacao: "INDEFERIDO",
          origem: null,
          area: null,
          corpo:
            "Prezado(a) {nome_candidato}, o recurso foi indeferido. {fundamentacao}",
        },
      },
    );
  });
});
