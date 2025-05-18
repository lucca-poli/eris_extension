# eris_extension

# State logic

- Inserir Botão <-- (isUser && noButton)
    - Requisita auditável <-- (!isAuditable && !lastMessageIsRequest)
    - Aceita/Nega <-- (!isAuditable && lastMessageIsRequest && !lastMessageAuthorIsMe)
    - EncerraAuditável <-- (isAuditable)
    - 'Do nothing' (auditável já requisitado) <-- (!isAuditable && lastMessageIsRequest && lastMessageAuthorIsMe)
    - Atualizar chats auditáveis (instanciado) <-- (aceitei chat auditável (trivial)) || (!isAuditable && lastMessageIsAccepted)
    - Atualizar chats auditáveis (terminado) <-- (encerrei chat auditável (trivial)) || (isAuditable && lastMessageIsEnd)
- Mandar ultima(s) mensagem para o backend <-- (isAuditable)

Insiro o botão. (tenho registro na classe se botão existe ou não). Se chat existe (botão):
Vou coletar todos os boleanos que preciso a cada iteração do loop
Atualizo o botão e mando mensagens pro back processar se preciso

# Refinement Pool
- Retirar o counter do state (porque só ta sendo utilizado pra puxar todas as mensagens no fim da conversa)
- consertar o initBlock quando for printar os logs
- Mudar o AuditableChat pra ser só uma coletanea de funções estáticas para calcular os blocos, assinar, conferir, etc. Isso pode ser feito porque todo o estado tá nas mensagens.
- Adicionar a seed por conversa auditavel na memoria. Posso adicionar como propriedade junto com o counter e o messageId e mandar pros logs no fim da conversa.
- Criar 2 tipos de mensagem. Um sendo a mensagem que eu crio e vou botar um hash em seguida e a outra sendo a que vem do whatsapp
- Mudar os auditable chats pro disco ao invés da RAM
- Fazer logger
- Adicionar path no tsconfig

# Bugs

- Quando da refresh o inject_api.js da pau, tem que abrir uma nova guia do whatsapp
- Eu não consigo receber aceite de mensagem sem o chat estar aberto, porque ele não fica registrado como idle. Instanciar um novo chat na memoria como idle, atualizar, e se continuar como idle, deletar. No passado eu fiz a condição pra criar ter um oldState || stateChanged
- Se ficar muito tempo sem mexer no browser ele fica como idle e a api storage para de funcionar, então se o usuario receber uma mensagem de requisição, aceite, deny ou end isso não fica registrado
- O cara pode só apagar a conversa até um request anterior e aceitar, botar um timeout pra cada request

# Architural decisions

- Ignoring possibility of a message not correctly processed (por agora eu ignorei a fila de processamento de mensagens)
