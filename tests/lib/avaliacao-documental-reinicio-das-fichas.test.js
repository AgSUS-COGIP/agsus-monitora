import { describe, expect, it } from "vitest";
import {
  erroDoMotivoDoPedido,
  lerReinicio,
  mensagemDoErroDoReinicio,
  modoDoReinicio,
  numeroConfere,
  pedidoParaAprovar,
  textoDoEventoDoReinicio,
  textoDoImpacto,
} from "../../src/lib/avaliacao-documental/reinicio-das-fichas.ts";

/*
  Regras da tela do reinício das fichas com dois administradores
  (20261022210000): leitura da resposta, o que a gaveta oferece, o número
  digitado e o motivo do pedido.
*/

const impacto = (extra = {}) => ({
  concluidas: 1509,
  em_analise: 12,
  com_lancamento: 10,
  iniciadas: 1530,
  exige_aprovacao: true,
  ...extra,
});
const pedido = (extra = {}) => ({
  id: 3,
  situacao: "PENDENTE",
  vencido: false,
  motivo: "Regra errada no edital inteiro",
  por: "Beto",
  meu: false,
  em: "2026-10-22T12:00:00Z",
  validade: "2026-10-23T12:00:00Z",
  impacto: { concluidas: 1509, em_analise: 12, iniciadas: 1530 },
  ...extra,
});

describe("lerReinicio", () => {
  it("lê o impacto, o pedido e o histórico", () => {
    const r = lerReinicio({
      numero: "114/2026",
      impacto: impacto(),
      bloqueio: null,
      pedido: pedido(),
      historico: [
        {
          pedido: 3,
          tipo: "PEDIR",
          em: "2026-10-22T12:00:00Z",
          por: "Beto",
          motivo: "x",
        },
        {
          pedido: 2,
          tipo: "EXECUTAR",
          em: "2026-10-21T12:00:00Z",
          por: "Ana",
          reiniciadas: 40,
        },
        { pedido: 1, tipo: "OUTRO" },
      ],
    });
    expect(r.numero).toBe("114/2026");
    expect(r.impacto).toEqual({
      concluidas: 1509,
      emAnalise: 12,
      comLancamento: 10,
      iniciadas: 1530,
      exigeAprovacao: true,
    });
    expect(r.pedido?.id).toBe(3);
    expect(r.pedido?.em).toBeInstanceOf(Date);
    expect(r.historico.map((h) => h.tipo)).toEqual(["PEDIR", "EXECUTAR"]);
    expect(r.historico[1].reiniciadas).toBe(40);
  });

  it("entrada vazia ou pedido que não está pendente vira sem pedido", () => {
    expect(lerReinicio(null).pedido).toBeNull();
    expect(
      lerReinicio({ pedido: pedido({ situacao: "EXECUTADO" }) }).pedido,
    ).toBeNull();
    expect(lerReinicio("lixo").impacto.exigeAprovacao).toBe(false);
  });
});

describe("modoDoReinicio e pedidoParaAprovar", () => {
  const ler = (extra) =>
    lerReinicio({ numero: "114/2026", impacto: impacto(), ...extra });

  it("bloqueio vence tudo (congelado ou encerrado)", () => {
    expect(
      modoDoReinicio(
        ler({
          bloqueio: "As inscrições deste edital estão congeladas.",
          pedido: pedido(),
        }),
      ),
    ).toBe("bloqueado");
  });

  it("pedido de outro: aprovar; meu: aguardando; vencido: pede de novo", () => {
    expect(modoDoReinicio(ler({ pedido: pedido() }))).toBe("aprovar");
    expect(pedidoParaAprovar(ler({ pedido: pedido() }))?.id).toBe(3);
    expect(modoDoReinicio(ler({ pedido: pedido({ meu: true }) }))).toBe(
      "aguardando",
    );
    expect(
      pedidoParaAprovar(ler({ pedido: pedido({ meu: true }) })),
    ).toBeNull();
    expect(modoDoReinicio(ler({ pedido: pedido({ vencido: true }) }))).toBe(
      "pedir",
    );
    expect(
      pedidoParaAprovar(ler({ pedido: pedido({ vencido: true }) })),
    ).toBeNull();
  });

  it("sem ficha trabalhada: direto; sem ficha iniciada: nada", () => {
    expect(
      modoDoReinicio(
        ler({
          impacto: impacto({
            concluidas: 0,
            com_lancamento: 0,
            exige_aprovacao: false,
          }),
        }),
      ),
    ).toBe("direto");
    expect(
      modoDoReinicio(
        ler({ impacto: impacto({ iniciadas: 0, exige_aprovacao: false }) }),
      ),
    ).toBe("nada");
  });
});

describe("numeroConfere", () => {
  it("aceita zeros à esquerda e espaços; recusa outro edital", () => {
    expect(numeroConfere("114/2026", "114/2026")).toBe(true);
    expect(numeroConfere(" 0114 / 2026 ", "114/2026")).toBe(true);
    expect(numeroConfere("114/2025", "114/2026")).toBe(false);
    expect(numeroConfere("14/2026", "114/2026")).toBe(false);
    expect(numeroConfere("", "114/2026")).toBe(false);
    expect(numeroConfere("", "")).toBe(false);
  });

  it("edital sem número: o nome, sem diferença de maiúsculas", () => {
    expect(numeroConfere("fcc", "FCC")).toBe(true);
    expect(numeroConfere("FC", "FCC")).toBe(false);
  });
});

describe("erroDoMotivoDoPedido", () => {
  it("pede de 10 a 1.000 caracteres e 3 palavras que pareçam texto", () => {
    expect(erroDoMotivoDoPedido("curto")).toBe("De 10 a 1.000 caracteres.");
    expect(erroDoMotivoDoPedido("x".repeat(1001))).toBe(
      "De 10 a 1.000 caracteres.",
    );
    expect(erroDoMotivoDoPedido("dsdfsdfsfsa fdfdfdf")).toBe(
      "Escreva o motivo com pelo menos 3 palavras.",
    );
    expect(erroDoMotivoDoPedido("testeeee do reinicio")).toBe(
      "Escreva o motivo com pelo menos 3 palavras.",
    );
    expect(erroDoMotivoDoPedido("A regra do edital estava errada")).toBe("");
  });
});

describe("textos", () => {
  it("impacto em pt-BR, com singular", () => {
    expect(textoDoImpacto(1509, 12)).toBe("1.509 concluídas e 12 em análise");
    expect(textoDoImpacto(1, 0)).toBe("1 concluída e 0 em análise");
  });

  it("evento do histórico", () => {
    const [executar, recusar] = lerReinicio({
      historico: [
        {
          pedido: 2,
          tipo: "EXECUTAR",
          em: "2026-10-22T15:00:00Z",
          por: "Ana",
          reiniciadas: 40,
        },
        {
          pedido: 1,
          tipo: "RECUSAR",
          em: "2026-10-22T15:00:00Z",
          por: "Beto",
          motivo: "Sem decisão da coordenação",
        },
      ],
    }).historico;
    expect(textoDoEventoDoReinicio(executar)).toMatch(
      /^Pedido 2 · Reiniciou em \d{2}\/\d{2} por Ana: 40 ficha\(s\)$/,
    );
    expect(textoDoEventoDoReinicio(recusar)).toMatch(
      /Recusou .* por Beto: Sem decisão da coordenação$/,
    );
  });

  it("erro do banco: a mensagem dele; função ausente: a migration", () => {
    expect(
      mensagemDoErroDoReinicio({
        code: "42501",
        message: "Você pediu este reinício.",
      }),
    ).toBe("Você pediu este reinício.");
    expect(mensagemDoErroDoReinicio({ code: "PGRST202" })).toContain(
      "20261022210000",
    );
    expect(mensagemDoErroDoReinicio(null)).toBe(
      "Não consegui concluir o reinício.",
    );
  });
});
