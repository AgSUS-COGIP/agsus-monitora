import {
  Suspense,
  lazy,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
} from "react";
import type { Moldura } from "../moldura.ts";
import { ErrorBoundary } from "../ErrorBoundary.tsx";
import { usarPecasDoApp } from "../contexto-do-app.ts";
import { PessoasOnline } from "../../componentes/pessoas-online/pessoas-online.tsx";
import { AvisoDeVersao } from "../../componentes/aviso-de-versao/aviso-de-versao.tsx";
import { EncerramentoDoEdital } from "../../modulos/encerramento-do-edital/encerramento-do-edital.tsx";
import {
  MarcaDeSeloNoAvatar,
  SelosDoEdital,
} from "../../modulos/encerramento-do-edital/selos-do-edital.tsx";
import {
  BuscaGlobal,
  avisarEscolha,
} from "../../componentes/busca-global/busca-global.tsx";

/*
  As partes da casca que dependem do sistema e da sessão (antes, ilhas React
  montadas por fora, cada uma com o próprio `createRoot`). Agora são filhas
  da raiz (src/app/raiz.tsx): leem o estado pelas `pecas` do contexto do app
  e cada uma tem o próprio ErrorBoundary — um erro numa não derruba a casca.

  Sem as peças (a casca desenhada sozinha num teste), nada aparece aqui.
*/

/** Pessoas online, no cabeçalho (estado: src/app/presenca.ts). */
export function PessoasOnlineDoApp() {
  const pecas = usarPecasDoApp();
  if (!pecas) return null;
  return (
    <ErrorBoundary nome="Pessoas online">
      <PessoasOnline presenca={pecas.presenca} />
    </ErrorBoundary>
  );
}

/** A faixa de versão nova no topo (estado: src/app/aviso-de-versao.ts). */
export function AvisoDeVersaoDoApp() {
  const pecas = usarPecasDoApp();
  if (!pecas) return null;
  return (
    <ErrorBoundary nome="Aviso de versão nova">
      <AvisoDeVersao aviso={pecas.avisoDeVersao} />
    </ErrorBoundary>
  );
}

/** A tela de encerramento do edital (src/modulos/encerramento-do-edital/). */
export function EncerramentoDoEditalDoApp() {
  const pecas = usarPecasDoApp();
  if (!pecas) return null;
  return (
    <ErrorBoundary nome="Encerramento do edital">
      <EncerramentoDoEdital estado={pecas.encerramento} />
    </ErrorBoundary>
  );
}

/** Os selos de editais, no menu da conta. */
export function SelosDoEditalDoApp() {
  const pecas = usarPecasDoApp();
  if (!pecas) return null;
  return (
    <ErrorBoundary nome="Selos do edital">
      <SelosDoEdital estado={pecas.encerramento} />
    </ErrorBoundary>
  );
}

/** A marca de selo no avatar da conta. */
export function SeloNoAvatarDoApp() {
  const pecas = usarPecasDoApp();
  if (!pecas) return null;
  return (
    <ErrorBoundary nome="Selo no avatar">
      <MarcaDeSeloNoAvatar estado={pecas.encerramento} />
    </ErrorBoundary>
  );
}

/*
  A Aya (src/modulos/aya/): a arara flutuante e o painel de conversa. Fora do
  pacote principal (com os tours, ~110 kB): só baixa quando o app abre (a
  sessão abrindo ou conectada) — a tela de acesso não a carrega. Depois de
  baixada, fica montada (sair e entrar de novo não a baixa outra vez).
*/
const AyaPreguicosa = lazy(() =>
  import("../../modulos/aya/aya.tsx").then((m) => ({ default: m.Aya })),
);

export function AyaDoApp() {
  const pecas = usarPecasDoApp();
  if (!pecas) return null;
  return <AyaQuandoAbrir appAberto={pecas.appAberto} />;
}

function AyaQuandoAbrir({
  appAberto,
}: {
  appAberto: NonNullable<ReturnType<typeof usarPecasDoApp>>["appAberto"];
}) {
  const aberto = useSyncExternalStore(
    appAberto.assinar,
    appAberto.obter,
    appAberto.obter,
  );
  // Uma vez pedida, fica: sair e entrar de novo não a baixa outra vez.
  const [pedida, definirPedida] = useState(aberto);
  if (aberto && !pedida) definirPedida(true);
  if (!aberto && !pedida) return null;
  return (
    <ErrorBoundary nome="Aya">
      <Suspense fallback={null}>
        <AyaPreguicosa />
      </Suspense>
    </ErrorBoundary>
  );
}

/*
  Busca global (Ctrl+K / Cmd+K): só abre com usuário conectado. O diálogo vai
  por portal para o fim do body (Modal de src/ui/).
*/
export function BuscaGlobalDoApp() {
  const pecas = usarPecasDoApp();
  if (!pecas) return null;
  return (
    <ErrorBoundary nome="Busca global">
      <BuscaGlobal
        estaConectado={pecas.estaConectado}
        aoEscolher={avisarEscolha}
      />
    </ErrorBoundary>
  );
}

/*
  A moldura (src/app/moldura.ts) na página: enquanto a casca existe, o estado
  da barra, do tema e da tela cheia vira as classes de `body`/`html`, e a
  largura, o tema de outra aba e a tela cheia do navegador são
  acompanhados. Desmontou (ou o StrictMode remontou): desliga e liga de novo.
*/
export function MolduraNaPagina() {
  const moldura = usarPecasDoApp()?.moldura;
  useLayoutEffect(() => moldura?.ligarNaPagina(), [moldura]);
  return null;
}

type EstadoDaMolduraNaCasca = Pick<
  ReturnType<Moldura["obter"]>,
  "telaCheiaDoApp" | "telaCheiaDoNavegador" | "relatorio"
>;
const ESTADO_SEM_MOLDURA: EstadoDaMolduraNaCasca = Object.freeze({
  telaCheiaDoApp: false,
  telaCheiaDoNavegador: false,
  relatorio: null,
});
const assinarNada = () => () => {};
const semMoldura = (): EstadoDaMolduraNaCasca => ESTADO_SEM_MOLDURA;

function usarMoldura(): EstadoDaMolduraNaCasca {
  const moldura = usarPecasDoApp()?.moldura;
  return useSyncExternalStore<EstadoDaMolduraNaCasca>(
    moldura?.assinar ?? assinarNada,
    moldura?.obter ?? semMoldura,
    moldura?.obter ?? semMoldura,
  );
}

/** O ícone do item "Tela cheia" no menu da conta. */
export function IconeDaTelaCheia() {
  const { telaCheiaDoApp, telaCheiaDoNavegador } = usarMoldura();
  const cheia = telaCheiaDoApp || telaCheiaDoNavegador;
  return (
    <i
      id="fullscreenActionIcon"
      className={cheia ? "fa-solid fa-compress" : "fa-solid fa-expand"}
      aria-hidden="true"
    ></i>
  );
}

/*
  O cabeçalho do relatório em PDF (`exportPDF`): só na impressão
  (`.print-only`), no topo do conteúdo, com o recorte da Visão geral.
*/
export function CabecalhoDoRelatorio() {
  const { relatorio: r } = usarMoldura();
  if (!r) return null;
  const numero = (valor: number) => Number(valor || 0).toLocaleString("pt-BR");
  return (
    <div id="printReportHeader" className="print-only">
      <div
        style={{
          padding: "0 0 12px",
          borderBottom: "2px solid #003b70",
          marginBottom: 14,
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 700, color: "#003b70" }}>
          {r.titulo}
        </div>
        <div style={{ fontSize: 12, color: "#444", marginTop: 2 }}>
          {`Relatório de processos seletivos · gerado em ${r.geradoEm}`}
        </div>
        <div style={{ fontSize: 11, color: "#555", marginTop: 6 }}>
          <b>Filtros:</b> {r.filtros}
        </div>
        <div
          style={{
            fontSize: 12,
            color: "#222",
            marginTop: 8,
            display: "flex",
            gap: 18,
            flexWrap: "wrap",
          }}
        >
          <span>
            <b>{numero(r.processos)}</b> processos
          </span>
          <span>
            <b>{numero(r.vagas)}</b> vagas previstas
          </span>
          <span>
            <b>{numero(r.contratados)}</b> contratações
          </span>
          <span style={{ color: "#a3322b" }}>
            <b>{numero(r.ociosas)}</b> {`ociosas (${r.pctOciosas}%)`}
          </span>
        </div>
      </div>
    </div>
  );
}
