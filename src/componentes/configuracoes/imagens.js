/*
  Imagens de Configurações › Aparência, fora do React: a arte de fundo da
  tela de acesso e a logo da barra lateral, com as galerias do armazenamento
  (bucket `platform-assets`). Este arquivo não importa React; as RPCs ficam
  aqui (o check:rpc-contract só lê `.js`).

  As duas imagens seguem regras diferentes, as mesmas de antes da migração:

    Arte de fundo   aplicada NA HORA (enviar, usar uma guardada, restaurar o
                    padrão): `definir_fundo_acesso_monitora` grava, o estado
                    das Configurações passa a ter o valor publicado e o legado
                    repinta a tela de acesso (evento EVENTO_FUNDO_DO_ACESSO).
    Logo da barra   envio guarda o arquivo, mas a ESCOLHA fica no rascunho e só
                    vale com "Salvar alterações" (chave `ui_sidebar_logo_url`).

  A arte ou a logo em uso não pode ser apagada: apagá-la deixaria a chave
  apontando para um arquivo que não existe (e o cache de marca de cada
  navegador continuaria a pedi-lo).
*/

import {
  ACCESS_BACKGROUND_BUCKET,
  ACCESS_BACKGROUND_FOLDER,
  createAccessBackgroundPath,
  validateAccessBackgroundFile,
} from "../../lib/access-background-storage.js";
import { DEFAULT_ACCESS_BRANDING } from "../../lib/access-branding.js";
import { mensagemDeFalha } from "../../lib/falha-de-rede.js";
import {
  CHAVE_DO_LOGO_DA_BARRA,
  LOGO_PADRAO_DA_BARRA,
  PASTA_DOS_LOGOS_DA_BARRA,
  caminhoDoNovoLogoDaBarra,
  ehImagemGuardada,
  ehLogoDaBarraGuardada,
  logoDaBarraSegura,
} from "../../lib/marca-da-barra-lateral.js";

const RPC_FUNDO_DO_ACESSO = "definir_fundo_acesso_monitora";

/* Disparado em `document` quando a arte de fundo é gravada: { url, caminho }. */
export const EVENTO_FUNDO_DO_ACESSO = "agsus:fundo-do-acesso-definido";

const GALERIA_VAZIA = Object.freeze({ status: "idle", itens: [] });

const ESTADO_INICIAL = Object.freeze({
  /** Artes guardadas: { status, itens: [{ caminho, nome, url }] }. */
  fundos: GALERIA_VAZIA,
  /** Uma ação da arte em andamento ("enviar", "restaurar", "usar", "apagar"). */
  fundoOcupado: "",
  /** Logos guardadas: { status, itens: [{ caminho, nome, url }] }. */
  logos: GALERIA_VAZIA,
  logoOcupado: "",
  /** Resultado da última ação da logo: { texto, tom: "sucesso" | "erro" }. */
  avisoDoLogo: null,
});

export function criarImagensDaAparencia({
  supabase = () => null,
  configuracoes,
  documento = globalThis.document,
  avisar = (mensagem, tipo) =>
    globalThis.window?.monitoraToast?.(mensagem, tipo),
  confirmar = (mensagem) => window.confirm(mensagem),
} = {}) {
  let estado = ESTADO_INICIAL;
  const ouvintes = new Set();

  function publicar(mudancas) {
    estado = { ...estado, ...mudancas };
    for (const ouvinte of ouvintes) ouvinte();
  }

  const armazenamento = () =>
    supabase()?.storage?.from(ACCESS_BACKGROUND_BUCKET);
  const urlPublica = (caminho) =>
    armazenamento()?.getPublicUrl(caminho).data.publicUrl || "";

  async function listar(pasta, aceita) {
    const { data, error } = await armazenamento().list(pasta, {
      limit: 60,
      sortBy: { column: "created_at", order: "desc" },
    });
    if (error) throw error;
    return (data || [])
      .filter((item) => aceita(item.name))
      .map((item) => {
        const caminho = `${pasta}/${item.name}`;
        return { caminho, nome: item.name, url: urlPublica(caminho) };
      });
  }

  async function carregarGaleria(campo, pasta, aceita) {
    if (!armazenamento()) return;
    publicar({ [campo]: { ...estado[campo], status: "loading" } });
    try {
      publicar({
        [campo]: { status: "ready", itens: await listar(pasta, aceita) },
      });
    } catch {
      // Sem a lista, a galeria some (como antes); enviar e restaurar continuam.
      publicar({ [campo]: { status: "error", itens: [] } });
    }
  }

  const carregarFundos = () =>
    carregarGaleria("fundos", ACCESS_BACKGROUND_FOLDER, ehImagemGuardada);
  const carregarLogos = () =>
    carregarGaleria("logos", PASTA_DOS_LOGOS_DA_BARRA, ehLogoDaBarraGuardada);

  /** As duas galerias (ao abrir a seção Aparência). */
  async function carregar() {
    await Promise.all([carregarFundos(), carregarLogos()]);
  }

  // ── Arte de fundo da tela de acesso (aplicada na hora) ───────────────────

  async function gravarFundo(url, caminho) {
    const { data, error } = await supabase().rpc(RPC_FUNDO_DO_ACESSO, {
      p_url: url || null,
      p_caminho: caminho || null,
    });
    if (error) throw error;
    const gravado = {
      url: data?.url || DEFAULT_ACCESS_BRANDING.backgroundUrl,
      caminho: data?.caminho || "",
    };
    configuracoes.definirValoresPublicados({
      auth_access_background_url: gravado.url,
      auth_access_background_path: gravado.caminho,
    });
    const Evento = documento.defaultView?.CustomEvent || globalThis.CustomEvent;
    documento.dispatchEvent(
      new Evento(EVENTO_FUNDO_DO_ACESSO, { detail: gravado }),
    );
  }

  async function acaoDoFundo(acao, executar, sucesso, falha) {
    if (estado.fundoOcupado || !supabase()) return false;
    publicar({ fundoOcupado: acao });
    try {
      await executar();
      await carregarFundos();
      avisar(sucesso);
      return true;
    } catch (erro) {
      avisar(`${falha}: ${mensagemDeFalha(erro)}`, "error");
      return false;
    } finally {
      publicar({ fundoOcupado: "" });
    }
  }

  async function enviarFundo(arquivo) {
    const invalido = validateAccessBackgroundFile(arquivo);
    if (invalido) {
      avisar(invalido, "warn");
      return false;
    }
    return acaoDoFundo(
      "enviar",
      async () => {
        const caminho = createAccessBackgroundPath(arquivo);
        const { error } = await armazenamento().upload(caminho, arquivo, {
          cacheControl: "31536000",
          contentType: arquivo.type,
          upsert: false,
        });
        if (error) throw error;
        try {
          await gravarFundo(urlPublica(caminho), caminho);
        } catch (erro) {
          // Não gravou: o arquivo enviado não fica órfão no armazenamento.
          await armazenamento().remove([caminho]);
          throw erro;
        }
      },
      "Imagem guardada e aplicada à tela de acesso.",
      "Não foi possível guardar a imagem",
    );
  }

  const restaurarFundo = () =>
    acaoDoFundo(
      "restaurar",
      () => gravarFundo(null, null),
      "Arte institucional padrão restaurada.",
      "Não foi possível restaurar a arte",
    );

  const usarFundo = ({ caminho, url }) =>
    acaoDoFundo(
      "usar",
      () => gravarFundo(url, caminho),
      "Arte aplicada à tela de acesso.",
      "Não foi possível aplicar a arte",
    );

  async function apagarFundo({ caminho, nome }) {
    const emUso = String(
      configuracoes.obter().valores.get("auth_access_background_path") ?? "",
    ).trim();
    if (emUso && emUso === caminho) {
      avisar(
        "Esta arte está em uso. Escolha outra ou restaure o padrão antes de apagar.",
        "warn",
      );
      return false;
    }
    if (
      !confirmar(
        `Apagar definitivamente a arte "${nome}"? Esta ação não pode ser desfeita.`,
      )
    )
      return false;
    return acaoDoFundo(
      "apagar",
      async () => {
        const { error } = await armazenamento().remove([caminho]);
        if (error) throw error;
      },
      "Arte apagada.",
      "Não foi possível apagar a arte",
    );
  }

  // ── Logo da barra lateral (a escolha vai no rascunho) ────────────────────

  const logoEscolhida = () =>
    logoDaBarraSegura(configuracoes.valor(CHAVE_DO_LOGO_DA_BARRA));

  function escolherLogo(url, texto) {
    configuracoes.mudarCampo(CHAVE_DO_LOGO_DA_BARRA, logoDaBarraSegura(url));
    publicar({ avisoDoLogo: { texto, tom: "sucesso" } });
  }

  const usarLogo = ({ url }) =>
    escolherLogo(
      url,
      "Logo selecionada. Clique em Salvar alterações para publicar.",
    );

  const restaurarLogo = () =>
    escolherLogo(
      LOGO_PADRAO_DA_BARRA,
      "Logo padrão selecionada. Clique em Salvar alterações para publicar.",
    );

  async function acaoDoLogo(acao, executar) {
    if (estado.logoOcupado) return false;
    if (!armazenamento()) {
      publicar({
        avisoDoLogo: {
          texto:
            "Não foi possível conectar ao armazenamento para enviar a logo.",
          tom: "erro",
        },
      });
      return false;
    }
    publicar({ logoOcupado: acao, avisoDoLogo: null });
    try {
      await executar();
      return true;
    } catch (erro) {
      const verbo = acao === "apagar" ? "apagar" : "enviar";
      publicar({
        avisoDoLogo: {
          texto: `Não foi possível ${verbo} a logo: ${mensagemDeFalha(erro)}`,
          tom: "erro",
        },
      });
      return false;
    } finally {
      publicar({ logoOcupado: "" });
    }
  }

  async function enviarLogo(arquivo) {
    const invalido = validateAccessBackgroundFile(arquivo);
    if (invalido) {
      publicar({ avisoDoLogo: { texto: invalido, tom: "erro" } });
      return false;
    }
    return acaoDoLogo("enviar", async () => {
      const caminho = caminhoDoNovoLogoDaBarra(arquivo);
      const { error } = await armazenamento().upload(caminho, arquivo, {
        cacheControl: "31536000",
        contentType: arquivo.type,
        upsert: false,
      });
      if (error) throw error;
      await carregarLogos();
      escolherLogo(
        urlPublica(caminho),
        "Logo enviada. Clique em Salvar alterações para publicar a escolha.",
      );
    });
  }

  async function apagarLogo({ caminho, nome, url }) {
    if (logoDaBarraSegura(url) === logoEscolhida()) {
      publicar({
        avisoDoLogo: {
          texto:
            "Esta logo está selecionada. Escolha outra ou restaure o padrão antes de apagar.",
          tom: "erro",
        },
      });
      return false;
    }
    if (!confirmar(`Apagar definitivamente a logo "${nome}"?`)) return false;
    return acaoDoLogo("apagar", async () => {
      const { error } = await armazenamento().remove([caminho]);
      if (error) throw error;
      await carregarLogos();
      publicar({
        avisoDoLogo: {
          texto: "Logo apagada do armazenamento.",
          tom: "sucesso",
        },
      });
    });
  }

  return {
    obter: () => estado,
    assinar(ouvinte) {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
    carregar,
    enviarFundo,
    restaurarFundo,
    usarFundo,
    apagarFundo,
    enviarLogo,
    usarLogo,
    restaurarLogo,
    apagarLogo,
  };
}
