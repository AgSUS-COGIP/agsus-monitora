import { Suspense, lazy, useState, useSyncExternalStore } from "react";
import { ErrorBoundary } from "../ErrorBoundary.tsx";
import { carregarComemoracao } from "../comemoracao-sob-demanda.ts";
import { filaDeComemoracoes } from "../fila-de-comemoracoes.ts";
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
  As comemorações (aviso e efeito, src/modulos/comemoracao/): o desenho só
  baixa quando a primeira entra na fila (src/app/fila-de-comemoracoes.ts) e
  fica montado enquanto houver alguma. Não depende das peças do sistema: a
  liberação de acesso comemora na entrada.
*/
const ComemoracoesPreguicosas = lazy(() =>
  carregarComemoracao().then((m) => ({ default: m.Comemoracoes })),
);

export function ComemoracoesDoApp() {
  const fila = useSyncExternalStore(
    filaDeComemoracoes.assinar,
    filaDeComemoracoes.obter,
    filaDeComemoracoes.obter,
  );
  if (!fila.length) return null;
  return (
    <ErrorBoundary nome="as comemorações">
      <Suspense fallback={null}>
        <ComemoracoesPreguicosas />
      </Suspense>
    </ErrorBoundary>
  );
}
