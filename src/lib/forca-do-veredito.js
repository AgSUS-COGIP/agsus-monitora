/*
  QUAL DE DOIS VEREDITOS DE LOCALIZAÇÃO MOSTRAR

  Quando o polo da planilha e o registo do CNES se reconciliam, o mapa desenha
  um ponto e o popup tem lugar para um veredito. A regra era "vale o do polo,
  porque foi sobre as lotações que a auditoria correu" — e ela escolhe a pior
  das duas respostas.

  Medido no caso que apareceu no mapa:

      polo   KARAPOTO TERRA NOVA      indeterminado / uf_indeterminada
      CNES   I KARAPOTO TERRA NOVA    coerente / fonte_unica_no_municipio

  O popup dizia "não foi possível conferir" sobre um ponto que tinha sido
  conferido.

  A ordem NÃO é "mostrar a melhor notícia" — isso esconderia problema. É mostrar
  o que DIZ mais, e, entre dois que dizem, o mais grave:

      3  erro, conflito      há um problema, e ele nunca se esconde
      2  validada            foi confirmado por fonte independente
      1  coerente            não se achou contradição
      0  indeterminado       não se conseguiu olhar

  `indeterminado` é o único que não afirma nada, e por isso perde para qualquer
  outro. Entre os que afirmam, ganha o que pede atenção.

  Vive num ficheiro próprio porque `localizacoes-validadas.js` — a casa natural
  disto — já importa de `reconciliacao-unidades.js`, e a reconciliação é quem
  precisa da regra. Pôr a função em qualquer um dos dois fecharia um ciclo.
*/
export function forcaDoVeredito(veredicto) {
  const estado = veredicto?.estado;
  if (estado === "erro" || estado === "conflito") return 3;
  if (estado === "validada") return 2;
  if (estado === "coerente") return 1;
  return 0;
}

export function veredictoQuePrevalece(a, b) {
  if (!a) return b ?? null;
  if (!b) return a;
  /*
    Empate fica com o primeiro, que é o do polo. Entre dois vereditos que dizem
    o mesmo, a lotação é a fonte que a auditoria tomou como referência.
  */
  return forcaDoVeredito(b) > forcaDoVeredito(a) ? b : a;
}
