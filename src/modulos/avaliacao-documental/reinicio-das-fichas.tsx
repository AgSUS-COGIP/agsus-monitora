import { useCallback, useEffect, useState } from "react";
import {
  erroDoMotivoDoPedido,
  lerReinicio,
  mensagemDoErroDoReinicio,
  modoDoReinicio,
  MOTIVO_DO_PEDIDO,
  numeroConfere,
  pedidoParaAprovar,
  RPC_APROVAR_REINICIO,
  RPC_CANCELAR_REINICIO,
  RPC_OBTER_REINICIO,
  RPC_PEDIR_REINICIO,
  RPC_RECUSAR_REINICIO,
  textoDoEventoDoReinicio,
  textoDoImpacto,
  type ReinicioDasFichas as Reinicio,
} from "../../lib/avaliacao-documental/reinicio-das-fichas.ts";
import { Aviso, Campo, Gaveta } from "../../ui/index.js";

/*
  Reinício das fichas do edital com dois administradores globais (migration
  20261022210000), só para o administrador global:
    - o aviso no alto da Fila: "Reinício pedido por X aguardando sua
      aprovação" (para outro administrador) ou o próprio pedido aguardando;
    - a gaveta aberta pelo menu "Pedir reinício das fichas" ou pelo aviso:
      pedir (motivo + número do edital + impacto), cancelar o próprio pedido,
      aprovar ou recusar o de outro (digitando o número), ou reiniciar direto
      quando nenhuma ficha foi trabalhada. Edital congelado ou encerrado: só a
      frase do bloqueio.
  Regras em src/lib/avaliacao-documental/reinicio-das-fichas.ts.
*/

type Rpc = (
  nome: string,
  argumentos: Record<string, unknown>,
) => Promise<unknown>;

type Resultado = { ok: boolean; erro?: string };

export type PropriedadesDoReinicio = {
  editalId: string;
  rpc: Rpc | null | undefined;
  admin: boolean;
  aberto: boolean;
  aoAbrir: () => void;
  aoFechar: () => void;
  /** Edital sem ficha trabalhada: a RPC antiga, com um administrador (a fila relê). */
  reiniciarDireto: (motivo: string) => Promise<Resultado>;
  /** Depois da aprovação que reiniciou: a fila relê e avisa. */
  aoReiniciar: (reiniciadas: number) => void;
};

const dataEHora = (d: Date | null) =>
  d
    ? d.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

export function ReinicioDasFichas({
  editalId,
  rpc,
  admin,
  aberto,
  aoAbrir,
  aoFechar,
  reiniciarDireto,
  aoReiniciar,
}: PropriedadesDoReinicio) {
  const [reinicio, setReinicio] = useState<Reinicio | null>(null);
  const [erroDaLeitura, setErroDaLeitura] = useState("");

  const ler = useCallback(async () => {
    if (!rpc || !editalId || !admin) return;
    try {
      setReinicio(
        lerReinicio(await rpc(RPC_OBTER_REINICIO, { p_edital: editalId })),
      );
      setErroDaLeitura("");
    } catch (e) {
      setReinicio(null);
      setErroDaLeitura(mensagemDoErroDoReinicio(e));
    }
  }, [rpc, editalId, admin]);

  useEffect(() => {
    setReinicio(null);
    setErroDaLeitura("");
    void ler();
  }, [ler]);
  // Ao abrir, relê: o impacto e o pedido podem ter mudado.
  useEffect(() => {
    if (aberto) void ler();
  }, [aberto, ler]);

  if (!admin) return null;
  const paraAprovar = pedidoParaAprovar(reinicio);
  const meu =
    reinicio?.pedido?.meu && !reinicio.pedido.vencido ? reinicio.pedido : null;

  return (
    <>
      {paraAprovar ? (
        <Aviso tom="warning" className="avd-reinicio-aviso">
          <span data-reinicio="aguardando-aprovacao">
            Reinício pedido por {paraAprovar.por || "outro administrador"}{" "}
            aguardando sua aprovação.
          </span>{" "}
          <button
            type="button"
            className="btn secondary small"
            data-acao="ver-pedido-de-reinicio"
            onClick={aoAbrir}
          >
            Ver pedido
          </button>
        </Aviso>
      ) : meu ? (
        <Aviso className="avd-reinicio-aviso">
          <span data-reinicio="meu-pedido">
            Seu pedido de reinício aguarda outro administrador.
          </span>{" "}
          <button
            type="button"
            className="btn secondary small"
            data-acao="ver-pedido-de-reinicio"
            onClick={aoAbrir}
          >
            Ver pedido
          </button>
        </Aviso>
      ) : null}
      {aberto ? (
        <GavetaDoReinicio
          reinicio={reinicio}
          erroDaLeitura={erroDaLeitura}
          editalId={editalId}
          rpc={rpc}
          aoFechar={aoFechar}
          aoMudar={setReinicio}
          reiniciarDireto={reiniciarDireto}
          aoReiniciar={aoReiniciar}
        />
      ) : null}
    </>
  );
}

function GavetaDoReinicio({
  reinicio,
  erroDaLeitura,
  editalId,
  rpc,
  aoFechar,
  aoMudar,
  reiniciarDireto,
  aoReiniciar,
}: {
  reinicio: Reinicio | null;
  erroDaLeitura: string;
  editalId: string;
  rpc: Rpc | null | undefined;
  aoFechar: () => void;
  aoMudar: (r: Reinicio) => void;
  reiniciarDireto: (motivo: string) => Promise<Resultado>;
  aoReiniciar: (reiniciadas: number) => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [numero, setNumero] = useState("");
  const [motivoDaRecusa, setMotivoDaRecusa] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const modo = reinicio ? modoDoReinicio(reinicio) : null;
  const pedido = reinicio?.pedido ?? null;
  const numeroOk = reinicio ? numeroConfere(numero, reinicio.numero) : false;
  const erroDoMotivo = motivo.trim() ? erroDoMotivoDoPedido(motivo) : "";
  const motivoOk = !erroDoMotivoDoPedido(motivo);
  const recusaOk = !motivoDaRecusa.trim() || motivoDaRecusa.trim().length >= 10;

  async function enviar(acao: () => Promise<void>) {
    setEnviando(true);
    setErro("");
    try {
      await acao();
    } catch (e) {
      setErro(mensagemDoErroDoReinicio(e));
    } finally {
      setEnviando(false);
    }
  }

  const chamar = async (nome: string, argumentos: Record<string, unknown>) => {
    if (!rpc) throw new Error("Sem conexão com o banco.");
    return rpc(nome, argumentos);
  };

  const pedir = () =>
    enviar(async () => {
      aoMudar(
        lerReinicio(
          await chamar(RPC_PEDIR_REINICIO, {
            p_edital: editalId,
            p_motivo: motivo.trim(),
            p_confirmacao: numero.trim(),
          }),
        ),
      );
      setMotivo("");
      setNumero("");
    });

  const cancelar = () =>
    enviar(async () => {
      aoMudar(
        lerReinicio(
          await chamar(RPC_CANCELAR_REINICIO, { p_pedido: pedido?.id }),
        ),
      );
    });

  const recusar = () =>
    enviar(async () => {
      aoMudar(
        lerReinicio(
          await chamar(RPC_RECUSAR_REINICIO, {
            p_pedido: pedido?.id,
            p_confirmacao: numero.trim(),
            p_motivo: motivoDaRecusa.trim() || null,
          }),
        ),
      );
      setNumero("");
      setMotivoDaRecusa("");
    });

  const aprovar = () =>
    enviar(async () => {
      const r = (await chamar(RPC_APROVAR_REINICIO, {
        p_pedido: pedido?.id,
        p_confirmacao: numero.trim(),
      })) as { resultado?: { reiniciadas?: number }; reinicio?: unknown };
      aoMudar(lerReinicio(r?.reinicio));
      aoReiniciar(Number(r?.resultado?.reiniciadas ?? 0));
      aoFechar();
    });

  const direto = () =>
    enviar(async () => {
      const r = await reiniciarDireto(motivo.trim());
      if (!r.ok) throw new Error(r.erro || "Não consegui reiniciar.");
      aoFechar();
    });

  const campoDoNumero = reinicio ? (
    <Campo
      rotulo={`Digite o número do edital (${reinicio.numero})`}
      obrigatorio
      erro={numero.trim() && !numeroOk ? "Não confere." : undefined}
    >
      <input
        type="text"
        value={numero}
        autoComplete="off"
        data-campo="numero-do-edital"
        onChange={(ev) => setNumero(ev.target.value)}
      />
    </Campo>
  ) : null;

  const campoDoMotivo = (
    <Campo rotulo="Motivo" obrigatorio erro={erroDoMotivo || undefined}>
      <textarea
        rows={3}
        maxLength={MOTIVO_DO_PEDIDO.maximo}
        value={motivo}
        data-foco-inicial
        data-campo="motivo-do-reinicio"
        onChange={(ev) => setMotivo(ev.target.value)}
      />
    </Campo>
  );

  return (
    <Gaveta
      tituloId="avdReinicioTitulo"
      titulo="Reiniciar as fichas do edital"
      resumo={reinicio?.numero || undefined}
      aoFechar={aoFechar}
      fecharAoClicarFora={false}
      tour="avd-fila-reinicio"
    >
      <div className="avd-gaveta-corpo" data-modo={modo || "carregando"}>
        {!reinicio ? (
          erroDaLeitura ? (
            <Aviso tom="danger" papel="alert">
              {erroDaLeitura}
            </Aviso>
          ) : (
            <p className="ui-texto-secundario">Carregando…</p>
          )
        ) : null}

        {reinicio && modo === "bloqueado" ? (
          <Aviso tom="danger" papel="alert">
            {reinicio.bloqueio}
          </Aviso>
        ) : null}

        {reinicio && modo === "nada" ? (
          <p className="ui-texto-secundario">
            Nenhuma ficha deste edital foi iniciada.
          </p>
        ) : null}

        {reinicio && modo === "direto" ? (
          <>
            <Aviso tom="warning">
              {reinicio.impacto.iniciadas} ficha(s) iniciada(s) voltam a
              Pendente, sem responsável. Nenhuma concluída.
            </Aviso>
            {campoDoMotivo}
            {campoDoNumero}
          </>
        ) : null}

        {reinicio && modo === "pedir" ? (
          <>
            <Aviso tom="danger" papel="status">
              <strong data-impacto>
                {textoDoImpacto(
                  reinicio.impacto.concluidas,
                  reinicio.impacto.emAnalise,
                )}
              </strong>{" "}
              voltam a Pendente, sem análise. Outro administrador global precisa
              aprovar em até 24 h.
            </Aviso>
            {campoDoMotivo}
            {campoDoNumero}
          </>
        ) : null}

        {reinicio && pedido && (modo === "aguardando" || modo === "aprovar") ? (
          <>
            <Aviso tom={modo === "aprovar" ? "danger" : undefined}>
              <span data-pedido>
                Pedido por {pedido.por || "administrador"} em{" "}
                {dataEHora(pedido.em)} · vale até {dataEHora(pedido.validade)}
              </span>
              <br />
              <strong data-impacto>
                No pedido: {textoDoImpacto(pedido.concluidas, pedido.emAnalise)}
              </strong>
              {modo === "aprovar" ? (
                <>
                  <br />
                  Agora:{" "}
                  {textoDoImpacto(
                    reinicio.impacto.concluidas,
                    reinicio.impacto.emAnalise,
                  )}
                </>
              ) : null}
            </Aviso>
            <p className="avd-reinicio-motivo" data-motivo-do-pedido>
              {pedido.motivo}
            </p>
            {modo === "aprovar" ? (
              <>
                {campoDoNumero}
                <Campo
                  rotulo="Motivo da recusa (opcional)"
                  erro={recusaOk ? undefined : "De 10 a 1.000 caracteres."}
                >
                  <input
                    type="text"
                    maxLength={MOTIVO_DO_PEDIDO.maximo}
                    value={motivoDaRecusa}
                    data-campo="motivo-da-recusa"
                    onChange={(ev) => setMotivoDaRecusa(ev.target.value)}
                  />
                </Campo>
              </>
            ) : null}
          </>
        ) : null}

        {erro ? (
          <Aviso tom="danger" papel="alert">
            {erro}
          </Aviso>
        ) : null}

        <div className="ui-acoes">
          <button
            type="button"
            className="btn secondary"
            onClick={aoFechar}
            disabled={enviando}
          >
            Fechar
          </button>
          {modo === "pedir" ? (
            <button
              type="button"
              className="btn danger"
              data-acao="pedir-reinicio"
              disabled={enviando || !motivoOk || !numeroOk}
              onClick={() => void pedir()}
            >
              {enviando ? "Gravando…" : "Pedir reinício"}
            </button>
          ) : null}
          {modo === "direto" ? (
            <button
              type="button"
              className="btn danger"
              data-acao="reiniciar-direto"
              disabled={enviando || !motivoOk || !numeroOk}
              onClick={() => void direto()}
            >
              {enviando ? "Reiniciando…" : "Reiniciar"}
            </button>
          ) : null}
          {modo === "aguardando" ? (
            <button
              type="button"
              className="btn secondary"
              data-acao="cancelar-pedido-de-reinicio"
              disabled={enviando}
              onClick={() => void cancelar()}
            >
              Cancelar pedido
            </button>
          ) : null}
          {modo === "aprovar" ? (
            <>
              <button
                type="button"
                className="btn secondary"
                data-acao="recusar-reinicio"
                disabled={enviando || !numeroOk || !recusaOk}
                onClick={() => void recusar()}
              >
                Recusar
              </button>
              <button
                type="button"
                className="btn danger"
                data-acao="aprovar-reinicio"
                disabled={enviando || !numeroOk}
                onClick={() => void aprovar()}
              >
                {enviando ? "Reiniciando…" : "Aprovar e reiniciar"}
              </button>
            </>
          ) : null}
        </div>

        {reinicio?.historico.length ? (
          <details className="avd-reinicio-historico">
            <summary>Histórico ({reinicio.historico.length})</summary>
            <ul>
              {reinicio.historico.map((h, i) => (
                <li key={`${h.pedido}-${h.tipo}-${i}`}>
                  {textoDoEventoDoReinicio(h)}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </Gaveta>
  );
}
