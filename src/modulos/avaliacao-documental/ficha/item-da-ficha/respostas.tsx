/* Item da ficha: a resposta declarada e os arquivos (API pública em ../item-da-ficha.tsx). */

import { useState } from "react";
import { enunciadoCompleto } from "../../../../lib/avaliacao-documental/anexo-na-empregare.ts";
import { ehAnexo } from "../../../../lib/avaliacao-documental/ficha.ts";
import { arquivosDaPergunta } from "../../../../lib/avaliacao-documental/respostas-do-candidato.ts";
import type { ArquivoDoCandidato } from "../../../../lib/avaliacao-documental/respostas-do-candidato.ts";
import {
  anexoEhImagem,
  leituraDoAnexo,
  linkDaMiniatura,
} from "../../../../lib/avaliacao-documental/leitura-dos-arquivos.ts";
import type { LeituraDoArquivo } from "../../../../lib/avaliacao-documental/leitura-dos-arquivos.ts";
import { AnexoDeclarado, LinkDaEmpregare } from "../empregare.tsx";
import { LidoDoArquivo } from "../leitura-dos-arquivos.tsx";
import type { ContextoDaEmpregare, LinhaDeResposta } from "../tipos.ts";

/* ── A resposta declarada ─────────────────────────────────────────────── */

/*
  O ícone do arquivo: foto com link que abre a imagem direto vira miniatura
  (sem ela, ou se não carregar, o ícone de foto); os outros, o clipe.
*/
function IconeDoArquivo({ arquivo }: { arquivo: ArquivoDoCandidato }) {
  const [falhou, setFalhou] = useState(false);
  if (!anexoEhImagem(arquivo.nome))
    return <i className="fa-solid fa-paperclip" aria-hidden="true" />;
  const miniatura = linkDaMiniatura(arquivo.link);
  if (miniatura && !falhou)
    return (
      <img
        className="avd-ficha-miniatura"
        src={miniatura}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFalhou(true)}
      />
    );
  return <i className="fa-solid fa-image" aria-hidden="true" />;
}

/* Os arquivos da pergunta de anexo, cada um com o link direto e o nome. */
function ArquivosDaPergunta({
  arquivos,
  empregare,
  leituras,
}: {
  arquivos: ArquivoDoCandidato[];
  empregare: ContextoDaEmpregare;
  leituras: LeituraDoArquivo[];
}) {
  return (
    <ul className="avd-ficha-arquivos" aria-label="Arquivos enviados">
      {arquivos.map((a) => (
        <li key={a.link} className="avd-ficha-arquivo-lido">
          <a
            className="avd-ficha-arquivo"
            href={a.link}
            target="_blank"
            rel="noopener noreferrer"
            title={`Abrir ${a.nome} na Empregare`}
            data-imagem={anexoEhImagem(a.nome) || undefined}
            onClick={() =>
              void empregare.loja.registrarAcesso("ABRIR_EMPREGARE")
            }
          >
            <IconeDoArquivo arquivo={a} />
            <span>{a.nome}</span>
            <i
              className="fa-solid fa-arrow-up-right-from-square"
              aria-hidden="true"
            />
          </a>
          <LidoDoArquivo leitura={leituraDoAnexo(leituras, a)} />
        </li>
      ))}
    </ul>
  );
}

function RespostaDeclarada({
  linha,
  empregare,
  comLinkGeral,
  leituras,
}: {
  linha: LinhaDeResposta;
  empregare: ContextoDaEmpregare;
  leituras: LeituraDoArquivo[];
  /** Sem anexo no item: o "Abrir na Empregare" do candidato ao lado da resposta. */
  comLinkGeral?: boolean;
}) {
  const [inteiro, setInteiro] = useState(false);
  const completo = enunciadoCompleto(linha.coluna);
  const temMais = completo.length > linha.enunciado.length + 3;
  const anexo = ehAnexo(linha.texto);
  /*
    Os arquivos capturados da pergunta, cada um com o seu link — também quando
    a exportação traz "--" e a resposta lida tem arquivo nela.
  */
  const arquivos = arquivosDaPergunta(empregare.enderecos, linha.coluna);
  return (
    <div className="avd-ficha-resposta" data-anexo={anexo || undefined}>
      <p className="avd-ficha-pergunta">
        <span>{inteiro ? completo : linha.enunciado}</span>
        {temMais ? (
          <button
            type="button"
            className="avd-ficha-texto-completo"
            aria-expanded={inteiro}
            onClick={() => setInteiro(!inteiro)}
          >
            {inteiro ? "ver menos" : "ver texto completo"}
          </button>
        ) : null}
      </p>
      {arquivos.length ? (
        <ArquivosDaPergunta
          arquivos={arquivos}
          empregare={empregare}
          leituras={leituras}
        />
      ) : (
        <div className="avd-ficha-valor" data-anexo={anexo || undefined}>
          {anexo ? (
            <AnexoDeclarado
              empregare={empregare}
              coluna={linha.coluna}
              texto={linha.texto}
            />
          ) : (
            <>
              <strong className="avd-ficha-texto-declarado">
                {linha.texto || "Sem resposta"}
              </strong>
              {comLinkGeral ? (
                <LinkDaEmpregare
                  empregare={empregare}
                  rotulo="Abrir na Empregare"
                  className="btn secondary small avd-ficha-ver-candidato"
                />
              ) : null}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* "O que o candidato informou": as respostas das perguntas que a regra liga ao bloco. */
export function Respostas({
  linhas,
  empregare,
  leituras,
}: {
  linhas: LinhaDeResposta[];
  empregare: ContextoDaEmpregare;
  leituras: LeituraDoArquivo[];
}) {
  const algumAnexo = linhas.some((l) => ehAnexo(l.texto));
  return (
    <div className="avd-ficha-respostas" data-tour="avd-ficha-respostas">
      <p className="avd-ficha-informou">O que o candidato informou</p>
      {linhas.map((l, i) => (
        <RespostaDeclarada
          key={l.coluna}
          linha={l}
          empregare={empregare}
          comLinkGeral={!algumAnexo && i === 0}
          leituras={leituras}
        />
      ))}
    </div>
  );
}
