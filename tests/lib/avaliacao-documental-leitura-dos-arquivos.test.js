import { describe, expect, it } from "vitest";
import {
  aceitarItemCorrigido,
  aceitarItemLido,
  alertasResumidos,
  anexoEhImagem,
  linhaAceita,
  linhaParaCorrigir,
  linkDaMiniatura,
  textoDaLinha,
  aceitarTodosSemAlerta,
  alertasDoArquivo,
  desfazerDecisaoLida,
  estadoDoItemLido,
  itensParaConferir,
  leituraDoAnexo,
  leiturasDaFicha,
  linhaDoItemLido,
  recusarItemLido,
  rotuloDaRecusa,
  textoDoItemLido,
} from "../../src/lib/avaliacao-documental/leitura-dos-arquivos.ts";

/*
  O que o robô leu dos arquivos, na ficha: a leitura vem pronta do Python
  (tests/python/test_leitura_de_arquivos.py testa a interpretação); aqui só a
  validação do que a RPC devolve, o texto de cada item e as decisões do
  avaliador no lançamento (aceitar vira linha com do_arquivo; recusar fica em
  recusas_lidas com o motivo; desfazer volta a pendente).
*/
const CURSOS = { codigo: "CURSOS", tipo: "CURSOS" };
const EXPERIENCIA = {
  codigo: "EXPERIENCIA",
  tipo: "VINCULOS",
  categorias: [{ codigo: "AREA_OU_SUS" }],
};
const FORMACAO = { codigo: "FORMACAO", tipo: "TITULOS" };
const ANEXO = {
  resposta: "8019889",
  pergunta: "555",
  arquivo: 1,
  link: "https://corporate.empregare.com/Company/VacancyTests/GetViewerLogArquivo?arquivo=a.pdf&nome=Case",
  nome: "a.pdf",
};
const curso = (curso, horas, alertas = []) => ({
  tipo: "CURSO",
  curso,
  horas,
  instituicao: "Fiocruz MS",
  conclusao: "2023-05-12",
  pagina: 1,
  alertas,
});
const LEITURA = {
  resposta: "8019889",
  pergunta: "555",
  arquivo: 1,
  situacao: "LIDO",
  metodo: "TEXTO",
  documento: "CERTIFICADO",
  paginas: 11,
  nome_confere: true,
  cpf_confere: null,
  itens: [
    curso("Enfrentamento das Arboviroses", 145),
    curso("Saúde Indígena", 60),
    curso("Primeiros Socorros", 20, [
      {
        codigo: "HORAS_ABAIXO_MINIMO",
        texto: "20 h, abaixo do mínimo de 40 h do edital",
      },
    ]),
  ],
  alertas: [],
  resumo: "3 certificados · 145 h, 60 h, 20 h · nome confere",
};

describe("leituras da ficha", () => {
  it("valida o que a RPC devolve e acha a leitura do anexo", () => {
    const leituras = leiturasDaFicha([
      LEITURA,
      { ...LEITURA, resposta: "x" },
      { ...LEITURA, situacao: "TALVEZ" },
      {
        ...LEITURA,
        pergunta: "556",
        itens: [{ tipo: "OUTRA" }, curso("X", 1)],
      },
    ]);
    expect(leituras).toHaveLength(2);
    expect(leituras[1].itens).toHaveLength(1);
    expect(leituraDoAnexo(leituras, ANEXO)?.resumo).toBe(LEITURA.resumo);
    expect(leituraDoAnexo(leituras, { ...ANEXO, arquivo: 2 })).toBeNull();
    expect(leiturasDaFicha(null)).toEqual([]);
  });

  it("o item lido numa linha, sem calcular nada", () => {
    expect(textoDoItemLido(LEITURA.itens[0])).toBe(
      "Enfrentamento das Arboviroses · 145 h · Fiocruz MS · 2023",
    );
    expect(
      textoDoItemLido({
        tipo: "VINCULO",
        empregador: "Hospital Regional",
        cargo: "Enfermeira",
        inicio: "2018-02-01",
        fim: "2020-01-31",
        carga_semanal: 40,
        dias: 730,
      }),
    ).toBe(
      "Hospital Regional · Enfermeira · 01/02/2018 a 31/01/2020 · 40 h/sem · 730 dias",
    );
    expect(
      textoDoItemLido({
        tipo: "VINCULO",
        empregador: "Prefeitura",
        inicio: "2020-03-01",
        fim: null,
        atual: true,
        dias: 2000,
      }),
    ).toBe("Prefeitura · 01/03/2020 a atual · 2.000 dias até hoje");
    expect(
      textoDoItemLido({
        tipo: "VINCULO",
        empregador: "Prefeitura",
        cargo: "Técnico de enfermagem",
        inicio: "2020-03-01",
        fim: null,
        atual: true,
        dias: 2000,
        dias_ate: "2025-08-21",
      }),
    ).toBe(
      "Prefeitura · Técnico de enfermagem · 01/03/2020 a atual · 2.000 dias até 21/08/2025",
    );
    expect(
      textoDoItemLido({
        tipo: "TITULO",
        titulo: "MESTRADO",
        curso: "Saúde Coletiva",
        data: "2019-12-10",
      }),
    ).toBe("Mestrado · Saúde Coletiva · 2019");
  });

  it("os itens do bloco para conferir, com a chave e os alertas do arquivo", () => {
    const leitura = {
      ...LEITURA,
      alertas: [{ codigo: "NOME_DIVERGENTE", texto: "O nome não aparece" }],
    };
    const itens = itensParaConferir(CURSOS, leiturasDaFicha([leitura]), [
      ANEXO,
    ]);
    expect(itens.map((i) => i.chave)).toEqual([
      "8019889:555:1:0",
      "8019889:555:1:1",
      "8019889:555:1:2",
    ]);
    expect(itens[0].alertas.map((a) => a.codigo)).toEqual(["NOME_DIVERGENTE"]);
    expect(itens[2].alertas.map((a) => a.codigo)).toEqual([
      "NOME_DIVERGENTE",
      "HORAS_ABAIXO_MINIMO",
    ]);
    expect(alertasDoArquivo(leitura)).toBe("O nome não aparece");
    // Bloco de outro tipo e leitura ilegível: nada para conferir.
    expect(
      itensParaConferir(EXPERIENCIA, leiturasDaFicha([LEITURA]), [ANEXO]),
    ).toEqual([]);
    expect(
      itensParaConferir(
        CURSOS,
        leiturasDaFicha([{ ...LEITURA, situacao: "ILEGIVEL" }]),
        [ANEXO],
      ),
    ).toEqual([]);
  });

  it("a linha que o item vira ao aceitar", () => {
    expect(linhaDoItemLido(CURSOS, LEITURA.itens[0], "1:2:1:0")).toEqual({
      nome: "Enfrentamento das Arboviroses",
      horas: 145,
      aceito: true,
      do_arquivo: "1:2:1:0",
    });
    expect(
      linhaDoItemLido(
        EXPERIENCIA,
        {
          tipo: "VINCULO",
          empregador: "Hospital",
          cargo: "Enfermeira",
          inicio: "2018-02-01",
          fim: null,
          atual: true,
        },
        "1:2:1:0",
      ),
    ).toEqual({
      empregador: "Hospital · Enfermeira",
      categoria: "AREA_OU_SUS",
      inicio: "2018-02-01",
      fim: "",
      aceito: true,
      do_arquivo: "1:2:1:0",
    });
    expect(
      linhaDoItemLido(
        FORMACAO,
        {
          tipo: "TITULO",
          titulo: "MESTRADO",
          curso: "Saúde",
          instituicao: "UF",
        },
        "1:2:1:0",
      ),
    ).toEqual({
      titulo: "MESTRADO",
      nome: "Saúde · UF",
      aceito: true,
      do_arquivo: "1:2:1:0",
    });
    expect(
      linhaDoItemLido(FORMACAO, { tipo: "TITULO", titulo: "OUTRO" }, "1:2:1:0"),
    ).toBeNull();
    expect(linhaDoItemLido(CURSOS, { tipo: "VINCULO" }, "1:2:1:0")).toBeNull();
  });
});

describe("decisões do avaliador no lançamento", () => {
  const itens = itensParaConferir(CURSOS, leiturasDaFicha([LEITURA]), [ANEXO]);
  const vazio = {
    nivel: "superior",
    cursos: [{ nome: "", horas: "", aceito: true }],
  };

  it("aceitar vira linha (no lugar da linha vazia) e recusar guarda o motivo", () => {
    let l = aceitarItemLido(vazio, CURSOS, itens[0]);
    expect(l.cursos).toEqual([
      {
        nome: "Enfrentamento das Arboviroses",
        horas: 145,
        aceito: true,
        do_arquivo: "8019889:555:1:0",
      },
    ]);
    expect(estadoDoItemLido(l, CURSOS, itens[0].chave)).toBe("ACEITO");
    // Aceitar de novo não duplica.
    expect(aceitarItemLido(l, CURSOS, itens[0]).cursos).toHaveLength(1);
    l = recusarItemLido(l, CURSOS, itens[2].chave, "CARGA_NAO_COMPROVADA");
    expect(l.recusas_lidas).toEqual({
      "8019889:555:1:2": { motivo: "CARGA_NAO_COMPROVADA" },
    });
    expect(estadoDoItemLido(l, CURSOS, itens[2].chave)).toBe("RECUSADO");
    expect(estadoDoItemLido(l, CURSOS, itens[1].chave)).toBe("PENDENTE");
    // Recusar o aceito tira a linha; aceitar o recusado tira a recusa.
    l = recusarItemLido(l, CURSOS, itens[0].chave, "FORA_DA_AREA");
    expect(l.cursos).toEqual([]);
    l = aceitarItemLido(l, CURSOS, itens[2]);
    expect(Object.keys(l.recusas_lidas)).toEqual(["8019889:555:1:0"]);
    // Desfazer volta a pendente (e some com recusas_lidas vazio).
    l = desfazerDecisaoLida(
      desfazerDecisaoLida(l, CURSOS, itens[0].chave),
      CURSOS,
      itens[2].chave,
    );
    expect(l.recusas_lidas).toBeUndefined();
    expect(l.cursos).toEqual([]);
    // O lançamento de entrada não muda.
    expect(vazio.cursos).toHaveLength(1);
  });

  it("motivo fora da lista não grava; o outro… guarda o texto como foi digitado", () => {
    expect(recusarItemLido(vazio, CURSOS, itens[0].chave, "PORQUE_SIM")).toBe(
      vazio,
    );
    const l = recusarItemLido(
      vazio,
      CURSOS,
      itens[0].chave,
      "OUTRO",
      "certificado repetido ",
    );
    expect(l.recusas_lidas[itens[0].chave]).toEqual({
      motivo: "OUTRO",
      texto: "certificado repetido ",
    });
    expect(rotuloDaRecusa(l.recusas_lidas[itens[0].chave])).toBe(
      "certificado repetido",
    );
    expect(rotuloDaRecusa({ motivo: "FORA_DA_AREA" })).toBe(
      "fora da área da vaga",
    );
  });

  it("aceitar todos sem alerta deixa o item com alerta para o avaliador", () => {
    const l = aceitarTodosSemAlerta(
      { nivel: "superior", cursos: [] },
      CURSOS,
      itens,
    );
    expect(l.cursos.map((c) => c.horas)).toEqual([145, 60]);
    expect(estadoDoItemLido(l, CURSOS, itens[2].chave)).toBe("PENDENTE");
  });
});

describe("corrigir o item lido, alertas resumidos e foto", () => {
  const VINCULO = {
    tipo: "VINCULO",
    empregador: "Instituto de Saúde",
    cargo: "Enfermeiro",
    inicio: "2024-02-01",
    fim: null,
    atual: true,
    dias: 984,
  };
  const leitura = { ...LEITURA, pergunta: "912", itens: [VINCULO] };
  const [item] = itensParaConferir(EXPERIENCIA, leiturasDaFicha([leitura]), [
    { ...ANEXO, pergunta: "912" },
  ]);

  it("o atual com emissão vira fim; sem emissão, o fim fica em branco e o texto diz até hoje", () => {
    expect(
      linhaDoItemLido(
        EXPERIENCIA,
        { ...VINCULO, dias_ate: "2025-08-21" },
        "1:2:1:0",
      ).fim,
    ).toBe("2025-08-21");
    expect(linhaDoItemLido(EXPERIENCIA, VINCULO, "1:2:1:0").fim).toBe("");
    expect(textoDoItemLido(VINCULO)).toContain("984 dias até hoje");
  });

  it("aceitar com a correção: a linha corrigida no lugar, marcada corrigido; sem mudança, sem a marca", () => {
    const base = {
      nivel: "superior",
      vinculos: [{ empregador: "", inicio: "", fim: "", aceito: true }],
      recusas_lidas: { [item.chave]: { motivo: "ILEGIVEL" } },
    };
    const linha = linhaParaCorrigir(EXPERIENCIA, item.item, item.chave);
    const corrigido = aceitarItemCorrigido(base, EXPERIENCIA, item, {
      ...linha,
      fim: "2026-10-13",
    });
    // A linha vazia aberta sai; a recusa do item também.
    expect(corrigido.vinculos).toEqual([
      {
        empregador: "Instituto de Saúde · Enfermeiro",
        categoria: "AREA_OU_SUS",
        inicio: "2024-02-01",
        fim: "2026-10-13",
        aceito: true,
        do_arquivo: item.chave,
        corrigido: true,
      },
    ]);
    expect(corrigido.recusas_lidas).toBeUndefined();
    expect(estadoDoItemLido(corrigido, EXPERIENCIA, item.chave)).toBe("ACEITO");
    expect(linhaAceita(corrigido, EXPERIENCIA, item.chave).corrigido).toBe(
      true,
    );
    // Corrigir de novo troca a mesma linha (não duplica).
    const outra = aceitarItemCorrigido(corrigido, EXPERIENCIA, item, {
      ...linha,
      fim: "2026-01-31",
    });
    expect(outra.vinculos).toHaveLength(1);
    expect(outra.vinculos[0].fim).toBe("2026-01-31");
    // Sem mudar nada em relação ao lido: aceito sem a marca.
    const igual = aceitarItemCorrigido(
      { vinculos: [] },
      EXPERIENCIA,
      item,
      linha,
    );
    expect(igual.vinculos[0].corrigido).toBeUndefined();
    expect(textoDaLinha("vinculos", corrigido.vinculos[0])).toBe(
      "Instituto de Saúde · Enfermeiro · 01/02/2024 a 13/10/2026",
    );
  });

  it("título não classificado: o Corrigir abre com o título padrão do nível", () => {
    expect(
      linhaParaCorrigir(
        FORMACAO,
        { tipo: "TITULO", titulo: null, curso: "Saúde", instituicao: "UF" },
        "1:2:1:0",
        "MESTRADO",
      ),
    ).toEqual({
      titulo: "MESTRADO",
      nome: "Saúde · UF",
      aceito: true,
      do_arquivo: "1:2:1:0",
    });
  });

  it("no máximo um alerta visível: o que impede primeiro; os leves em cinza; atual e concomitante não são alerta", () => {
    const a = (codigo) => ({ codigo, texto: codigo });
    expect(
      alertasResumidos([
        a("SEM_EMPREGADOR"),
        a("NOME_DIVERGENTE"),
        a("DATA_FUTURA"),
      ]),
    ).toEqual({
      principal: a("NOME_DIVERGENTE"),
      grave: true,
      outros: [a("SEM_EMPREGADOR"), a("DATA_FUTURA")],
      concomitante: false,
    });
    expect(alertasResumidos([a("SEM_EMPREGADOR")])).toMatchObject({
      principal: a("SEM_EMPREGADOR"),
      grave: false,
      outros: [],
    });
    expect(
      alertasResumidos([a("SEM_DATA_FIM"), a("PERIODO_CONCOMITANTE")]),
    ).toEqual({
      principal: null,
      grave: false,
      outros: [],
      concomitante: true,
    });
    // O mesmo empregador repetido é laranja.
    expect(alertasResumidos([a("PERIODO_SOBREPOSTO")]).grave).toBe(true);
  });

  it("foto: ícone pelo nome; miniatura só com link https direto da imagem (não o visualizador da Empregare)", () => {
    expect(anexoEhImagem("carteira.JPG")).toBe(true);
    expect(anexoEhImagem("diploma.pdf")).toBe(false);
    expect(linkDaMiniatura(ANEXO.link)).toBeNull();
    expect(
      linkDaMiniatura(
        "https://corporate.empregare.com/Company/VacancyTests/GetViewerLogArquivo?arquivo=foto.jpg",
      ),
    ).toBeNull();
    expect(linkDaMiniatura("https://arquivos.exemplo.org/foto.png")).toBe(
      "https://arquivos.exemplo.org/foto.png",
    );
    expect(linkDaMiniatura("http://arquivos.exemplo.org/foto.png")).toBeNull();
  });
});
