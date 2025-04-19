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
- Refatorar o comunicador para injeções de scripts com a api scripting
- Capturar o Input e processar
- Mudar a arquitetura de processamento de menssagens para uma máquina de estados
    - Coletar as mensagens discretamente com .on("message") e salvar o estado de todo chat que não for normal
- Comunicador interno
    - Montar o from e to dentro da classe, de acordo com o dono, o protocolo e se é send ou listen
    - Implementar response
- Fazer logger e botar no comunicador
- Retirar o botão se chat auditável já foi requisitado
- Passar o armazenamento de conversas para o cliente (localmente)
- Adicionar path no tsconfig

# Bugs

- Se o request não ficar como enviado ele não fica como sendo a ultima mensagem, então um usuário pode clicar várias vezes no botão de requisitar e fica meio paia
- Conversa não vira auditável se o outro lado aceitar
- O cara pode só apagar a conversa até um request anterior e aceitar, botar um timeout pra cada request
