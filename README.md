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
- Passar o armazenamento de conversas para o cliente (localmente)
    - Adicionar botão para apagar todos os chats no popup para fins de debug
- Fazer logger
- Adicionar path no tsconfig

# Bugs

- Se ficar muito tempo sem mexer no browser ele fica como idle e a api storage para de funcionar, então se o usuario receber uma mensagem de requisição, aceite, deny ou end isso não fica registrado
- O cara pode só apagar a conversa até um request anterior e aceitar, botar um timeout pra cada request

# Architural decisions

- Ignoring possibility of a message not correctly processed (por agora eu ignorei a fila de processamento de mensagens)
