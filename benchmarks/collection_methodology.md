# O que eu quero coletar por dado?
## Mensagens próprias
- usar o on("chat.ack_update")
- cada dado tem um id da mensagem
- cada momento de status, então o momento de envio na UI (relogio), o recebimento no server do zap (certinho cinza), o recebimento em um dos aparelhos da pessoa (certinho duplo cinza). O visto pela pessoa é irrelevante pro envio da mensagem.
- a classe da mensagem, que pode ack, AtD, ou auditavel
- classe de ser enviada ou recebida
- a memoria por mensagem
- a memoria bruta dos metadados

## Memoria
Pra coleta de memoria, pegar do socket.
Para cada mensagem, usar como referencia o maior pacote ou a soma dos top 3 maiores pacotes enviados numa janela de tempo de 1 segundo de desvio padrao em relação ao tempo reportado pelo wajs.
Para não poluir as medições, espaçar o envio de cada mensagem em 5 segundos.
