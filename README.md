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
- Trocar o SendMessage por ChatMessage
- Mudar a arquitetura de processamento de menssagens e do estado do chat para algo discreto (por meio de eventos)
    - Usar evento de chat ativo ao inves de loop
    - Salvar o estado de todo chat que não for normal
- Fazer logger
- Passar o armazenamento de conversas para o cliente (localmente)
- Adicionar path no tsconfig

# Bugs

- Se o request não ficar como enviado ele não fica como sendo a ultima mensagem, então um usuário pode clicar várias vezes no botão de requisitar e fica meio paia
- Conversa não vira auditável se o outro lado aceitar
- O cara pode só apagar a conversa até um request anterior e aceitar, botar um timeout pra cada request

# Architural decisions

- Ignoring possibility of a message not correctly processed (por agora eu ignorei a fila de processamento de mensagens)
