import { useEffect, useRef, useState } from "react";
import { ENDERECO_RODAR_CARGA } from "../lib/robos-de-carga.js";
import { exigirSessao } from "../lib/sessao.js";
import { getSupabaseClient } from "../lib/supabaseClient.js";
import { Icone } from "./icone.jsx";

const INTERVALO_MS = 15000;
const LIMITE_MS = 15 * 60000;

/** O token do GitHub permanece no servidor. A permissão vem do GET autenticado. */
export function AtualizacaoDoDashboard({
  robo,
  aoRecarregar,
  desativado = false,
  supabase = getSupabaseClient(),
  buscar = fetch,
}) {
  const [permitido, setPermitido] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const ultima = useRef(null);
  const acompanhamento = useRef(null);
  const recarregar = useRef(aoRecarregar);
  recarregar.current = aoRecarregar;
  const ativo = useRef(false);
  const enviando = useRef(false);

  async function pedir(metodo) {
    const sessao = await exigirSessao(supabase);
    const resposta = await buscar(
      metodo === "GET"
        ? `${ENDERECO_RODAR_CARGA}?robo=${robo}`
        : ENDERECO_RODAR_CARGA,
      {
        method: metodo,
        headers: {
          Authorization: `Bearer ${sessao.access_token}`,
          ...(metodo === "POST" ? { "Content-Type": "application/json" } : {}),
        },
        ...(metodo === "POST" ? { body: JSON.stringify({ robo }) } : {}),
        signal: AbortSignal.timeout(20000),
      },
    );
    const corpo = await resposta.json().catch(() => ({}));
    return { resposta, corpo };
  }
  // O efeito usa a identidade do módulo e suas dependências de rede; callbacks
  // da tela são lidos por ref, sem reiniciar o acompanhamento a cada render.
  useEffect(() => {
    ativo.current = true;
    let cancelado = false;
    let timer;
    async function consultar() {
      try {
        const { resposta, corpo } = await pedir("GET");
        if (cancelado || enviando.current) return;
        if (resposta.status === 403 || resposta.status === 401) {
          setPermitido(false);
          acompanhamento.current = null;
          setOcupado(false);
          return;
        }
        if (!resposta.ok)
          throw new Error(
            corpo.erro || "Não foi possível consultar a sincronização.",
          );
        setPermitido(true);
        const situacao = corpo.robos?.[robo];
        ultima.current = situacao?.ultima || null;
        if (situacao?.rodando && !acompanhamento.current) {
          acompanhamento.current = { idAnterior: null, inicio: Date.now() };
        }
        const pedido = acompanhamento.current;
        if (pedido) {
          setOcupado(true);
          const execucao = situacao?.ultima;
          // Não confundir o sucesso anterior com o pedido que ainda entra na fila.
          if (
            execucao?.id &&
            execucao.id !== pedido.idAnterior &&
            execucao.status === "completed"
          ) {
            acompanhamento.current = null;
            setOcupado(false);
            if (execucao.conclusao === "success") {
              setMensagem("Sincronização concluída. Recarregando o painel.");
              recarregar.current?.();
            } else {
              setMensagem(
                "A sincronização não foi concluída. Tente novamente ou consulte o responsável.",
              );
            }
          } else if (Date.now() - pedido.inicio > LIMITE_MS) {
            acompanhamento.current = null;
            setOcupado(Boolean(situacao?.rodando));
            setMensagem(
              "A atualização está demorando. Consulte o responsável antes de tentar novamente.",
            );
          } else {
            setMensagem(
              situacao?.rodando
                ? "Sincronização em andamento…"
                : "Atualização solicitada. Aguardando a execução…",
            );
          }
        } else {
          setOcupado(Boolean(situacao?.rodando));
        }
      } catch (erro) {
        if (!cancelado)
          setMensagem(
            erro.message || "Não foi possível consultar a sincronização.",
          );
      } finally {
        if (!cancelado) timer = setTimeout(consultar, INTERVALO_MS);
      }
    }
    void consultar();
    return () => {
      cancelado = true;
      ativo.current = false;
      clearTimeout(timer);
    };
    // pedir é definido com as dependências abaixo e não precisa reiniciar na renderização.
  }, [robo, supabase, buscar]);

  async function atualizar() {
    if (acompanhamento.current || ocupado || permitido !== true || desativado)
      return;
    acompanhamento.current = {
      idAnterior: ultima.current?.id || null,
      inicio: Date.now(),
    };
    setOcupado(true);
    setMensagem("Solicitando atualização…");
    enviando.current = true;
    try {
      const { resposta, corpo } = await pedir("POST");
      if (!ativo.current) return;
      if (resposta.status === 202 || resposta.status === 409) {
        if (resposta.status === 409)
          if (acompanhamento.current) acompanhamento.current.idAnterior = null;
        setMensagem(
          resposta.status === 409
            ? "Atualização já em andamento…"
            : "Atualização solicitada. Aguardando a execução…",
        );
        return;
      }
      acompanhamento.current = null;
      setOcupado(false);
      setMensagem(corpo.erro || "Não foi possível solicitar a atualização.");
      if (resposta.status === 403 || resposta.status === 401)
        setPermitido(false);
    } catch {
      if (ativo.current) {
        // A requisição pode ter chegado ao servidor. Continuar consultando evita
        // novo disparo e permite observar a execução mesmo se a resposta se perdeu.
        setMensagem(
          "Não foi possível confirmar o pedido. Verificando a execução…",
        );
      }
    } finally {
      enviando.current = false;
    }
  }

  return (
    <>
      {permitido !== false ? (
        <button
          type="button"
          className="btn secondary"
          data-acao="sincronizar"
          disabled={desativado || permitido !== true || ocupado}
          onClick={atualizar}
        >
          <Icone nome="refresh-cw" tamanho={14} />{" "}
          {ocupado ? "Atualizando…" : "Atualizar dados"}
        </button>
      ) : null}
      <button
        type="button"
        className="btn secondary"
        data-acao="atualizar"
        data-recarregar-painel=""
        disabled={desativado || ocupado}
        onClick={aoRecarregar}
      >
        Recarregar painel
      </button>
      {mensagem ? (
        <span role="status" aria-live="polite">
          {mensagem}
        </span>
      ) : null}
    </>
  );
}
