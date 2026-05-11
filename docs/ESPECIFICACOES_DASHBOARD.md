# Especificações Funcionais do Dashboard de Eventos

Este documento detalha o comportamento, regras de negócios e *edge cases* das ações disponíveis no dashboard de gestão de eventos, servindo como guia acionável para o time de desenvolvimento.

---

## CONSOLE DE ENTRADAS & VENDAS

### [1] BUSCAR INGRESSO/NOME

*   **Comportamento esperado:**
    *   **O que filtra:** Nome do comprador, e-mail, número/ID do ingresso, e número/nome da mesa.
    *   **Acionamento:** Busca em tempo real usando *debounce* (ex: 300ms a 500ms) após a última tecla pressionada. Permite feedback imediato sem sobrecarregar o backend.
    *   **Estado Vazio (Empty State):** Se não houver resultados, exibir uma ilustração minimalista (dark theme) e mensagem clara: "Nenhum ingresso encontrado para '[termo]'. Verifique possíveis erros de digitação."
    *   **Histórico:** Mostrar as últimas 3-5 buscas recentes em um *dropdown* ao focar no campo.
*   **Regras de negócio e validações:** Minimizar *case sensitivity* (ignorar maiúsculas/minúsculas) e acentos (*fuzzy search* parcial).
*   **Permissões:** Disponível para operadores e administradores.
*   **Registro em log (Auditoria):** Não. Consultas de pesquisa gerais não geram log para evitar poluição.
*   **Edge cases:** Digitação muito rápida (resolvido por debounce); caracteres especiais; espaços em branco acidentais no início/fim (fazer *trim* da string).

### [2] BOTÃO DE FILTRO

*   **Comportamento esperado:**
    *   **Abertura:** Clique abre um popover/dropdown imediatamente abaixo do ícone (sem bloquear a tela como modal).
    *   **Opções:** 
        *   Status: Todos, Confirmado, Aguardando, Cancelado.
        *   Tipo: Todos, Pista, VIP, Mesa, Cortesia.
    *   **Estado padrão:** Todos os filtros vêm desmarcados ("Todos"). Os filtros são aplicados assim que marcados (checkbox/radio).
    *   **Limpeza:** Botão claro de "Limpar Filtros" no rodapé ou cabeçalho do popover.
    *   **Feedback visual:** Quando há filtros ativos, o ícone de funil deve ganhar um *badge* ou ponto dourado (`#D4A017`), e uma linha de *tags* (pílulas) abaixo da busca (ex: "Status: Confirmado [x]") deve aparecer.
*   **Permissões:** Admin e Operador.
*   **Registro em log:** Não.

### [3] BOTÃO "VISUALIZAR" (Tabela)

*   **Comportamento esperado:**
    *   **Abertura:** Abre um *Drawer* (painel deslizante) pela direita, cobrindo cerca de 30-40% da tela. Mantém o contexto da lista por trás (overlay escuro a 50%).
    *   **Informações:** 
        *   Cabeçalho: Nome, E-mail, ID do Pedido.
        *   Status atual (badge grande).
        *   Detalhes Financeiros: Valor pago, data da compra, método (Cartão/PIX).
        *   Histórico do Ingresso: "Comprado" -> "Aprovado" -> "Check-in realizado (23:15 por [Operador])".
        *   QR Code do ingresso (caso precise escanear ou reenviar).
    *   **Ações In-Drawer:** 
        *   Se CONFIRMADO/AGUARDANDO: "Registrar Check-in Manual" (destaque), "Reenviar Ingresso" (email/zap), "Transferir Titularidade" (mudar nome/email).
        *   Se CANCELADO: Botões de check-in inativos/ocultos. Apenas exibir motivo e data do cancelamento.
*   **Regras de negócio:** 
    *   Só permitir Transferência de Titularidade até X horas antes do evento ou de acordo com nível de permissão.
*   **Permissões:** 
    *   Visualizar: Operador e Admin.
    *   Transferir Titularidade/Cancelar: Apenas Admin (ou Operador Master).
    *   Check-in/Reenviar: Operador e Admin.
*   **Registro em log:** 
    *   Sim: Clicar não gera log, mas *executar ações* dentro do Drawer gera: "Check-in manual de [Nome] por [Usuário]", "Ingresso [ID] transferido de [A] para [B] por [Admin]".

### [4] BOTÃO "CARREGAR MAIS OPERAÇÕES"

*   **Comportamento esperado:**
    *   **Tipo de carregamento:** Estilo *Load More* explícito via botão no final da tabela para ter mais controle e não perder o footer da tela (em oposição ao scroll infinito automático, que no desktop pode ser incômodo). Na versão mobile, pode ser Scroll Infinito automático.
    *   **Lote:** Carregar de 20 a 50 registros por vez.
    *   **Scroll:** Manter a posição exata onde o usuário está e adicionar as linhas abaixo (sem saltos de tela).
    *   **Estados:** Ao clicar, o botão troca texto para "Carregando..." com um spinner suave.
*   **Permissões:** Admin e Operador.
*   **Edge cases:** Acabaram os registros (sumir botão ou trocar para "Todos os registros carregados"). Erro de rede (mostrar "Falha ao carregar. Tentar novamente").

---

## ATIVIDADE LOG

### [5] BOTÃO "VER HISTÓRICO COMPLETO"

*   **Comportamento esperado:**
    *   **Abertura:** Abre uma nova página (rota separada, ex: `/evento/[id]/log`) ou tela inteira, dada a quantidade de dados pesados.
    *   **Funcionalidades:** Tabela completa com paginação (ex: 50 itens/página), filtros (Data/Hora, Agente, Tipo de Evento) e barra de busca.
    *   **Exportação:** Botão "Exportar Relatório" (Excel/CSV) essencial para auditoria e prestação de contas.
*   **Permissões:** 
    *   **Administrador/Owner:** Vê TUDO (sistema, vendas, marketing, todos os operadores).
    *   **Operador Normal:** Visualiza apenas seus próprios check-ins e ações, ou não tem acesso à tela.
*   **Registro em log:** "Admin exportou log de atividades" (O ato de exportar deve gerar uma tag de segurança).
*   **Edge cases:** Limite de exportação (ex: "Muitos dados para exportar de uma vez, filtre um período menor", se passar de 10k linhas).

---

## AÇÕES RÁPIDAS

### [6] BOTÃO "LISTA PDF"

*   **Comportamento esperado:**
    *   **Acionamento:** Clique abre um modal curto de configurações antes da ação. Ex: "Selecione o que deseja incluir: ( ) VIPs, ( ) Pista, ( ) Status Financeiro".
    *   **Entrega:** Download imediato em uma nova aba usando *Blob*. Processamento com *loading state* no botão. 
    *   **Formato do PDF:** Orientação Paisagem (melhor para tabelas). Estilo limpo. Cabeçalho com logo do evento, data de extração, nome de quem gerou e contagem total do lado direito.
*   **Permissões:** Apenas Administrador.
*   **Registro em log:** **Sim.** "Lista de convidados exportada em PDF por [Admin]".
*   **Edge cases:** Se não houver ingressos na categoria solicitada, bloquear o download; se o arquivo for muito pesado (>1000 páginas), acionar via Job *backend* e mandar por e-mail com a mensagem "Preparando arquivo, será enviado em breve".

### [7] BOTÃO "AVISO A TODOS"

*   **Comportamento esperado:**
    *   **Abertura:** Modal ou Drawer focado em Criação de Mensagem.
    *   **Fluxo:** 
        1. **Público:** Dropdown para escolher 'Todos Confirmados', 'Apenas VIP/Mesa', 'Pendentes'.
        2. **Canal:** Checkboxes (E-mail e/ou WhatsApp).
        3. **Editor:** Título, corpo. Botões variáveis tipo `{nome_primeiro}`, `{qr_code_link}`.
        4. **Prévia:** Mostra um *preview* visual mockado (card de como chegará no email/celular).
        5. **Envio:** Confirmação de segurança: "Disparar mensagem para X contatos - Confirmar" e exige digitação de texto "CONFIRMAR" se a base for muito grande.
*   **Permissões:** Exclusivo de Administrador/Marketing.
*   **Registro em log:** **Sim.** Grave: "Comunicado em massa enviado para [X] pessoas por [Admin]. Tipo: [Assunto do email]".
*   **Edge cases:** Usuários com base *opt-out*. Envio interrompido (precisa mostrar erro parcial no disparo / retry). Limitar para evitar re-envio acidental spam. Exibir "Aguarde Y minutos entre disparos" por evento/nível da conta.

### [8] BOTÃO "PAUSAR VENDAS DE EMERGÊNCIA"

*   **Comportamento esperado:**
    *   **O que faz:** Bloqueia a criação de *novos* pedidos imediatamente no site de vendas. O evento aparece como "Vendas Pausadas".
    *   **Abertura:** Modal central com *OVERLAY* extremamente denso, possivelmente fundo vermelho vibrante transparente. Exige digitação: "Digite PAUSAR VENDAS para confirmar".
    *   **Checkouts em andamento:** Pessoas com itens no carrinho que *já iniciaram* o processo mantêm seus itens se o timer não tiver expirado (regra técnica, ou pode varrer e expulsar via WebSocket). Recomenda-se manter as de carrinho, bloqueando a entrada de novos compradores.
    *   **Estado Posterior:** O botão do dashboard então vira "RETOMAR VENDAS" com design verde neon brilhante e uma barra vermelha persistente na tela dizendo: "⚠️ VENDAS ATUALMENTE PAUSADAS".
*   **Permissões:** Estritamente OWNER (Dono da conta master) ou Admins com permissão *Super*.
*   **Registro em log:** **Sim.** Alerta crítico. "VENDAS PAUSADAS DE EMERGÊNCIA por [Admin]".
*   **Notificação Subsequente:** Todo o staff logado no sistema pode/deve receber notificação de "Vendas Pausadas pelo Adm".

---

## ALERTA INTELIGENTE

### [9] BOTÃO "AJUSTAR LOTES"

*   **Comportamento esperado:**
    *   **Acionamento:** Clique abre Drawer "Gestão de Lotes" focado especificamente no lote engatilhado no alerta.
    *   **Ações no form:** Permite alterar *Quantidade Disponível*, *Preço*, e *Virada Agendada*.
    *   **Reflexo:** Ao salvar mudanças com o botão "Publicar Imediatamente", refletem em tempo real (via WebSocket ou invalidação de cache) na ponta do comprador. 
    *   **Outros tipos de alerta baseados na referência (Ra.co / Dice):**
        *   **"Baixa de vendas:"** "Vendas caíram 50% vs semana passada. Sugestão: Disparar promoção / lote relâmpago".
        *   **"Pico de acessos:"** "Mais de 300 pessoas na página agora. Considere antecipar virada de lote".
        *   **"Gargalo no Check-in (para o Operador):"** "Alerta de Fila: Portaria Principal com alta demora média (3 mins por pessoa). Aloque staff".
*   **Permissões:** Administrador Financeiro / Owner.
*   **Registro em log:** **Sim.** "Lote VIP modificado: Preço R$ 100 -> R$ 120 e Qtd 50 -> 60. Autor: [Admin]".
*   **Edge cases:** Alterar quantidade de ingressos em lote para número *menor* do que o que já foi vendido até agora (travar campo de input de acordo com o total já em uso ou em carrinho). Validar conflito de lotes subjacentes ativos ao mesmo tempo no mesmo tipo.
