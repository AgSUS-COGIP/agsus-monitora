import { getSupabaseClient } from "../lib/supabaseClient";
import {
  carregarCatalogoDeAbas,
  consultaDoCatalogoDeAbas,
} from "../modules/catalogo-de-abas.js";
import {
  carregarSituacaoDoSistema,
  consultaDaSituacaoDoSistema,
} from "../modules/situacao-dos-modulos.js";

/*
  O vigia do catálogo de abas: a página desligada fecha sem recarregar.

  A coordenação desliga abas por área (Configurações › Módulos e abas) para
  aliviar o banco — em 19/10/2026 o Supabase NANO saturou. O catálogo
  (`listar_abas_do_menu`) e a situação (`obter_situacao_do_sistema`) eram
  lidos só na entrada: quem já estava numa página desligada continuava nela,
  consultando o banco, até recarregar.

  Nenhuma chamada nova: a versão do catálogo vem de carona no sinal de
  presença (`registrar_presenca_monitora`, migration 20261019160000), que a
  tela já manda a cada 90 s com a aba visível, na troca de página e na volta
  da aba (src/app/presenca.js; com a aba oculta, nada). Só quando a versão
  muda o vigia relê o catálogo e a situação (duas leituras pequenas), remonta
  o menu e pede à navegação que reavalie a página aberta
  (`reavaliarTelaAtual`, src/app/navegacao.js): desligada (ou em manutenção,
  para quem não é administrador global) vira o aviso; religada, volta ao
  menu.

  A primeira versão recebida é a da entrada (o catálogo acabou de ser lido):
  só guarda. Resposta sem versão (banco sem a migration) não faz nada além de
  reavaliar a página com o catálogo que já existe. Falha ao reler mantém o
  menu como está e tenta de novo na próxima batida — uma falha de rede não
  devolve ao menu as abas desligadas.
*/

type Resposta = { data?: unknown; error?: { code?: string } | null };
type Cliente = unknown;

export interface DependenciasDoVigia {
  cliente?: () => Cliente;
  abas?: {
    consulta: (sb: Cliente) => Promise<Resposta>;
    carregar: (opcoes: { consulta: Promise<Resposta> }) => Promise<unknown>;
  };
  situacao?: {
    consulta: (sb: Cliente) => Promise<Resposta>;
    carregar: (opcoes: { consulta: Promise<Resposta> }) => Promise<unknown>;
  };
  navegacao: { montarMenu: () => void; reavaliarTelaAtual: () => void };
}

/* PostgREST: a função não existe (migration ainda não aplicada). Não é falha. */
const FUNCAO_AUSENTE = "PGRST202";

const falhou = (resposta: Resposta) =>
  Boolean(resposta?.error) && resposta.error?.code !== FUNCAO_AUSENTE;

/** A versão do catálogo na resposta da presença, ou `null`. */
export function versaoDaResposta(dados: unknown): string | null {
  if (!dados || typeof dados !== "object") return null;
  const versao = (dados as { versao_do_catalogo?: unknown }).versao_do_catalogo;
  return typeof versao === "string" && versao ? versao : null;
}

export function criarVigiaDoCatalogo({
  cliente = getSupabaseClient,
  abas = {
    consulta: consultaDoCatalogoDeAbas,
    carregar: carregarCatalogoDeAbas,
  },
  situacao = {
    consulta: consultaDaSituacaoDoSistema,
    carregar: carregarSituacaoDoSistema,
  },
  navegacao,
}: DependenciasDoVigia) {
  let versao: string | null = null;
  let releitura: Promise<boolean> | null = null;
  /* `esquecer` invalida a releitura que ainda estiver a caminho. */
  let rodada = 0;

  async function reler(nova: string) {
    const esta = rodada;
    const sb = cliente();
    const [doCatalogo, daSituacao] = await Promise.all([
      abas.consulta(sb),
      situacao.consulta(sb),
    ]);
    if (esta !== rodada) return false;
    if (falhou(doCatalogo) || falhou(daSituacao)) return false;
    await abas.carregar({ consulta: Promise.resolve(doCatalogo) });
    await situacao.carregar({ consulta: Promise.resolve(daSituacao) });
    if (esta !== rodada) return false;
    versao = nova;
    navegacao.montarMenu();
    navegacao.reavaliarTelaAtual();
    return true;
  }

  /**
   * A resposta da presença chegou. Devolve a releitura (ou `null`, quando não
   * precisou reler).
   */
  function aoRegistrarPresenca(dados: unknown): Promise<boolean> | null {
    const nova = versaoDaResposta(dados);
    if (!nova || versao === null || nova === versao) {
      if (nova && versao === null) versao = nova;
      // Sem mudança: a página que esperava salvar o trabalho pode fechar agora.
      navegacao.reavaliarTelaAtual();
      return null;
    }
    if (releitura) return releitura;
    const atual = reler(nova)
      .catch((erro) => {
        console.warn("Falha ao reler o catálogo de abas:", erro);
        return false;
      })
      .finally(() => {
        if (releitura === atual) releitura = null;
      });
    releitura = atual;
    return atual;
  }

  /** A pessoa saiu: a próxima entrada começa de novo. */
  function esquecer() {
    rodada += 1;
    versao = null;
    releitura = null;
  }

  return {
    aoRegistrarPresenca,
    esquecer,
    versao: () => versao,
  };
}
