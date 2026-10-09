"""
LEITURA AUTOMÁTICA DOS ARQUIVOS da Avaliação documental.

O robô (scripts/robo-empregare/leitura_de_arquivos.py, workflow
leitura-de-arquivos.yml) baixa cada anexo do questionário da Empregare para
uma pasta temporária, chama `ler_documento` e grava o resultado pela RPC
gravar_leituras_de_arquivos (migration 20261009220000). O arquivo é apagado em
seguida; nada do texto do documento é guardado — só o que a ficha precisa para
AJUDAR o avaliador (quem decide é ele):

    texto        normalização e datas (biblioteca padrão)
    extracao     o texto de cada página: PDF com texto (pdfplumber), PDF
                 escaneado e imagem (OCR, Tesseract em português), DOCX e TXT
    pessoas      o nome do candidato aparece? o CPF do documento é o dele
                 (só o booleano: o CPF chega como hash com sal da execução)?
    certificados cursos: curso, carga horária, instituição e conclusão, um por
                 certificado (um PDF pode ter vários)
    diplomas     titulação: graduação, especialização, mestrado, doutorado…
    experiencia  vínculos: empregador, cargo, início, fim (ou atual), carga
                 semanal e dias (CTPS, declaração, contrato, certidão, holerite)
    identidade   identidade e registro em conselho: o tipo do documento
    classificacao o tipo do documento sem item (comprovante de residência,
                 título de eleitor, histórico escolar, certidão, registro…)
    leitura      `ler_documento`: junta tudo, gera os alertas e o resumo

Os módulos de interpretação são só biblioteca padrão; pdfplumber, Pillow e
pytesseract entram só em `extracao`, importados na hora (o robô instala:
scripts/robo-empregare/requirements.txt). Testes: tests/python/test_leitura_de_arquivos.py
(PDFs e imagens sintéticos, nunca documento real).
"""

# Mudou a interpretação → suba a versão: o robô relê o que foi lido com versão anterior.
VERSAO_DO_EXTRATOR = "2026.10.3"
