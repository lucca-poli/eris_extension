# eris_extension

# TODO
- Comunicador interno
    - Implementar comunicar único que recebe estratégias de comunicação (window, chrome). Dependendo do from e to ele tem que saber que serviço ele vai usar e qual rota traçar se for mais de um. Acho que quem tem que guardar as rotas que faz é um método estático dos serviços, dai o messager pega as rotas de cada um e decide o caminho
    - Implementar response
- Passar pra TypeScript
- Fazer logger e botar no comunicador
- Implementar uma máquina de estados por chat privado. Por enquanto salvar o estado na RAM com um array de objetos no background. Só salvar se o estado for different de NORMAL_CHAT
