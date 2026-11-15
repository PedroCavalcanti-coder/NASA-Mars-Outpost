# Progresso: servidor como fonte da verdade

A implementação está em andamento e ainda não está pronta para entrega. Há mudanças anteriores de outra sessão no workspace, especialmente no movimento; elas foram preservadas e não devem ser atribuídas a esta tarefa.

## Feito nesta tarefa

- Criei contratos de gameplay em `@mars/shared`: versão independente, comandos discriminados, identificador de operação e geração da sala, snapshots, atualizações com revisão, tentativas e save v3.
- Transferi para `@mars/sim` regras de operações, missões, sondagem, pontuação, votação e eventos. Criei um estado de simulação com recursos fracionários, relógio, pausas, integridade, painel de missões, cotas, agenda de eventos e estados pessoais.
- Implementei um controlador por sala no servidor, com passos de 100 ms, publicação agrupada, integração com a posição do sistema de movimento, registro de operações e rejeição dos antigos eventos de conclusão de missão enviados pelo cliente.
- Adicionei lógica oficial para tentativas de consoles, sondagem, solo, painéis, filtro, estufa e envio de pesquisa; também foram iniciadas as ações de plantio, colheita, rochas, estações e reparos. A interface de atividades foi adaptada para enviar ações em vez de pontuações e recompensas prontas.
- Adicionei processamento de oxigênio pessoal, exposição ao frio e socorro no núcleo do servidor. Iniciei a projeção desses dados e da campanha nos stores do navegador.
- Implementei a estrutura de decisões de eventos no servidor, com escolha, votação, prazo e sorteio do resultado. Adicionei cotas compartilhadas para MOXIE, água e bancada.
- Iniciei migração e normalização de saves v3, limite de tamanho em UTF-8, autosave e serialização das gravações por sala. Criei um script para gerar posições oficiais de alvos a partir dos modelos das bases.
- Removi o sistema de sono, seu painel, votação e evento de rede; removi a restauração da campanha pelo armazenamento da aba. O campo de movimento chamado `sleeping` continua como bloqueio genérico e ainda precisa de integração final.

## Verificação e pendências

- `npm run typecheck` passou na última execução.
- A suíte completa teve 273 testes aprovados e 18 falhas em quatro arquivos: integração das salas, sanitização de saves, cliente multiplayer e efeitos de recompensa da HUD. Algumas expectativas usam o protocolo antigo; as falhas precisam ser analisadas individualmente, pois também podem revelar regressões reais.
- A implementação precisa de revisão e conclusão antes de ser considerada funcional: coleta cooperativa, validação de todos os minigames, retransmissões e concorrência, pausas sobrepostas, desconexão e reconexão, restauração, filas limitadas e gravações concorrentes.
- Ainda faltam os testes específicos do novo protocolo com clientes Socket.IO reais, builds de web e servidor, e as medições de CPU, memória, tráfego e event loop para 1, 100 e 500 salas previstas no plano.
