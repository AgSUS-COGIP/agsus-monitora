import { describe, expect, it } from "vitest";
import {
  TELA_SEM_ACESSO,
  bloqueioDaTela,
  codigoDoPainel,
  ehPainelExterno,
  telaDeEntrada,
  telaInicialDoSistema,
  telaPermitida,
} from "../src/lib/navegacao";

/* Regras puras da navegação (src/lib/navegacao.ts). */

const paineisDe = (...codigos) => ({
  podeAbrir: (codigo) => codigos.includes(codigo),
  primeiro: () => (codigos.length ? { codigo: codigos[0] } : null),
});
const SEM_PAINEIS = paineisDe();

const comMatriz = (permissoes) => ({ id: "p", ativo: true, permissoes });
const GESTOR = { id: "g", ativo: true, perfil: "edital_gestor" };

describe("painel externo", () => {
  it("lê o código de panel:<codigo>", () => {
    expect(codigoDoPainel("panel:selecao")).toBe("selecao");
    expect(codigoDoPainel("panel:a:b")).toBe("a");
    expect(codigoDoPainel("dashboard")).toBe("");
    expect(ehPainelExterno("panel:x")).toBe(true);
    expect(ehPainelExterno(null)).toBe(false);
  });
});

describe("bloqueioDaTela", () => {
  it("avisa com o texto da tela quando o perfil não pode", () => {
    const perfil = comMatriz({ nucleo: "leitor" });
    expect(bloqueioDaTela("dashboard", perfil, SEM_PAINEIS)).toBe(
      "Sem permissão para Saúde Indígena.",
    );
    expect(bloqueioDaTela("nucleo", perfil, SEM_PAINEIS)).toBe("");
    expect(bloqueioDaTela("config", perfil, SEM_PAINEIS)).toBe(
      "Sem permissão para Configurações.",
    );
    expect(bloqueioDaTela("recursos", perfil, SEM_PAINEIS)).toBe(
      "Sem permissão para Recursos.",
    );
  });

  it("Triagem exige recurso próprio, não permissão do Painel da Seleção", () => {
    const somentePainel = comMatriz({
      selecao: "editor",
      avaliacao_documental: "sem_acesso",
    });
    expect(bloqueioDaTela("selecao", somentePainel, SEM_PAINEIS)).toBe("");
    expect(telaPermitida("selecao", somentePainel, SEM_PAINEIS)).toBe(true);
    expect(
      bloqueioDaTela("pre-classificacao", somentePainel, SEM_PAINEIS),
    ).toBe("Sem permissão para a Triagem.");
    expect(telaPermitida("pre-classificacao", somentePainel, SEM_PAINEIS)).toBe(
      false,
    );

    const avaliador = comMatriz({
      selecao: "sem_acesso",
      avaliacao_documental: "leitor",
    });
    expect(bloqueioDaTela("pre-classificacao", avaliador, SEM_PAINEIS)).toBe(
      "",
    );
    expect(telaPermitida("pre-classificacao", avaliador, SEM_PAINEIS)).toBe(
      true,
    );
    expect(telaPermitida("selecao", avaliador, SEM_PAINEIS)).toBe(false);
    // O papel por edital continua obrigatório na RPC e no componente:
    // esta checagem concede apenas a rota, não a operação.
  });

  it("tela que não existe é bloqueada com aviso (antes ficava em branco)", () => {
    expect(bloqueioDaTela("chat", GESTOR, SEM_PAINEIS)).toBe(
      'A tela "chat" não existe.',
    );
    expect(bloqueioDaTela(TELA_SEM_ACESSO, GESTOR, SEM_PAINEIS)).toBe("");
  });

  it("Cronograma: com matriz, o módulo calendario; sem matriz, o de Editais", () => {
    expect(
      bloqueioDaTela(
        "calendario",
        comMatriz({ nucleo: "leitor" }),
        SEM_PAINEIS,
      ),
    ).toBe("Sem permissão para o Cronograma.");
    expect(
      bloqueioDaTela(
        "calendario",
        comMatriz({ calendario: "leitor" }),
        SEM_PAINEIS,
      ),
    ).toBe("");
    expect(bloqueioDaTela("calendario", GESTOR, SEM_PAINEIS)).toBe("");
  });

  it("painel externo segue os painéis liberados", () => {
    expect(bloqueioDaTela("panel:bi", GESTOR, paineisDe("bi"))).toBe("");
    expect(bloqueioDaTela("panel:outro", GESTOR, paineisDe("bi"))).toBe(
      "Sem permissão para este painel externo ou painel inativo.",
    );
  });

  it("tela sem regra própria não bloqueia", () => {
    expect(bloqueioDaTela(TELA_SEM_ACESSO, null, SEM_PAINEIS)).toBe("");
  });
});

describe("telaPermitida", () => {
  it("usa as páginas do perfil e os painéis", () => {
    const perfil = comMatriz({ dashboard: "leitor" });
    expect(telaPermitida("dashboard", perfil, SEM_PAINEIS)).toBe(true);
    expect(telaPermitida("nucleo", perfil, SEM_PAINEIS)).toBe(false);
    expect(telaPermitida("panel:bi", perfil, paineisDe("bi"))).toBe(true);
    expect(telaPermitida("", perfil, SEM_PAINEIS)).toBe(false);
    expect(telaPermitida("desconhecida", perfil, SEM_PAINEIS)).toBe(false);
  });
});

describe("telaInicialDoSistema e telaDeEntrada", () => {
  it("segue a ordem das telas do sistema", () => {
    expect(telaInicialDoSistema(GESTOR, SEM_PAINEIS)).toBe("dashboard");
    expect(
      telaInicialDoSistema(comMatriz({ recursos: "leitor" }), SEM_PAINEIS),
    ).toBe("recursos");
  });

  it("sem tela do sistema: o primeiro painel, ou sem-acesso", () => {
    const perfil = comMatriz({});
    expect(telaInicialDoSistema(perfil, paineisDe("bi"))).toBe("panel:bi");
    expect(telaInicialDoSistema(perfil, SEM_PAINEIS)).toBe(TELA_SEM_ACESSO);
  });

  it("reabre a tela guardada, se permitida e se não for painel", () => {
    const perfil = comMatriz({ dashboard: "leitor", nucleo: "leitor" });
    expect(telaDeEntrada("nucleo", perfil, SEM_PAINEIS)).toBe("nucleo");
    expect(telaDeEntrada("config", perfil, SEM_PAINEIS)).toBe("dashboard");
    expect(telaDeEntrada("panel:bi", perfil, paineisDe("bi"))).toBe(
      "dashboard",
    );
    expect(telaDeEntrada("", perfil, SEM_PAINEIS)).toBe("dashboard");
  });
});
