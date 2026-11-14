# Mars Outpost

Jogo educativo **cooperativo** (1 a 4 jogadores, direto no navegador) de gerenciamento e sobrevivência de uma
base humana em Marte. Criado para o desafio **Build a Junior Astronaut Mission Trainer** do NASA Space Apps
Challenge, no hackathon de Fortaleza.

> Projeto independente, sem endosso nem parceria oficial da NASA.

## Estado do projeto

| Parte | Situação |
| --- | --- |
| Site (home, contas, central do jogador) | ✅ pronto |
| Cadastro, login, sessões, recuperação de senha | ✅ pronto |
| Amigos (pedidos, presença online) e mensagens em tempo real | ✅ pronto |
| API, Socket.IO e banco de dados (Neon) | ✅ pronto |
| Jogo: simulação, mundos, papéis, eventos | 🚧 próxima etapa |
| Cena 3D da base | 🚧 próxima etapa |

Esta base é o alicerce: o jogo se encaixa nela usando a mesma conta, os mesmos amigos e o mesmo WebSocket.

## O jogo

Uma equipe administra uma base em Marte durante uma campanha de **15 sóis** (3 ciclos de 5 dias). Os jogadores
distribuem tarefas, constroem instalações, equilibram recursos vitais, fazem pesquisa e respondem a eventos que
ameaçam ou favorecem a missão. Quem joga **administra a base**, não controla um astronauta em terceira pessoa.

- **Recursos vitais:** oxigênio, água, alimentos, energia, proteção contra radiação e saúde da tripulação.
- **Quatro papéis cooperativos:** Comandante, Engenheiro de sistemas, Cientista e Suporte à vida. Os papéis
  organizam responsabilidades, mas não impedem ninguém de ajudar.
- **Decisões** individuais, compartilhadas (votação) e críticas.
- **Aprendizagem:** os conceitos (poeira, atmosfera rarefeita, reciclagem de água, ciclo dia/noite dos painéis
  solares) aparecem como consequência das escolhas, com fichas explicativas e tutorial progressivo.
- **Avaliação em cinco dimensões:** sobrevivência, sustentabilidade, ciência, eficiência operacional e colaboração.

O jogo é uma abstração educativa: não dimensiona uma base real em Marte.

## Stack

| Camada | Escolha |
| --- | --- |
| Monorepo | npm workspaces (`apps/*`, `packages/*`) |
| Linguagem | TypeScript (strict), tipos compartilhados entre site e servidor |
| Site | React 19 + Vite + React Router + Zustand |
| Servidor | Node 22+ e Fastify 5 |
| Tempo real | Socket.IO 4 (WebSocket), eventos tipados |
| Banco | PostgreSQL no **Neon** com Drizzle ORM |
| Validação | Zod 4, compartilhado entre site e servidor |
| Qualidade | Biome (lint + formatação) e Vitest |

## Como rodar

Requisitos: **Node 22 ou superior** (veja `.nvmrc`) e um banco PostgreSQL no [Neon](https://neon.tech).

```bash
npm install
cp .env.example .env      # depois preencha DATABASE_URL e JWT_SECRET
npm run secret:jwt        # imprime uma linha JWT_SECRET=... para colar no .env
npm run db:migrate        # cria as tabelas (schema "outpost")
npm run dev               # servidor em :3001 e site em :5173
```

Abra **http://localhost:5173**.

### Variáveis de ambiente (`.env`)

| Variável | Obrigatória | Descrição |
| --- | --- | --- |
| `DATABASE_URL` | sim | Connection string do Neon (`postgresql://…?sslmode=require`) |
| `JWT_SECRET` | sim | Segredo-mestre, mínimo 32 caracteres. Gere com `npm run secret:jwt` |
| `PORT` | não | Porta do servidor (padrão `3001`) |
| `WEB_ORIGIN` | não | Origem(ns) do site, separadas por vírgula (padrão `http://localhost:5173`) |
| `TRUST_PROXY` | não | `true` atrás de proxy/CDN, para ler o IP real |
| `COOKIE_SAMESITE` | não | `lax` (padrão), `strict` ou `none` (só com site e API em domínios diferentes, exige HTTPS) |

O `.env` nunca vai para o Git. **Não troque o `JWT_SECRET` depois de ter usuários:** dele derivam a chave que
cifra os tokens e o *pepper* das senhas, então trocá-lo desconecta todo mundo e invalida as senhas cadastradas.

### Scripts

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor e site com hot reload |
| `npm run build` | Build do site (`apps/web/dist`) |
| `npm run build:server` | Bundle do servidor (`apps/server/dist`) |
| `npm start` | Produção: um único processo serve site, API e WebSocket |
| `npm test` | Testes unitários (Vitest) |
| `npm run smoke` | Teste ponta a ponta contra o servidor local (veja abaixo) |
| `npm run typecheck` | Checagem de tipos em todos os pacotes |
| `npm run lint` / `npm run format` | Biome |
| `npm run db:generate` | Gera migração SQL após mudar `apps/server/src/db/schema.ts` |
| `npm run db:migrate` | Aplica as migrações no banco |
| `npm run db:check` | Testa a conexão e lista as tabelas |
| `npm run secret:jwt` | Gera um `JWT_SECRET` forte |

O `npm run smoke` exige `npm run dev:server` ativo. Ele cria usuários descartáveis (`zt_*`), exercita cadastro,
bloqueio de conta, CSRF, amigos, mensagens, rotação de tokens e troca de senha, e **apaga os usuários** no fim.

## Estrutura

```text
apps/
  web/                 Site (React + Vite)
    src/app/pages/     Home, Login, Cadastro, Central, Amigos, Mensagens, Perfil
    src/store/         Zustand: sessão (auth) e tempo real (realtime)
    src/net/           Cliente HTTP (com renovação automática de sessão) e Socket.IO
    src/ui/            Botão, campos, avatar, toasts, logo
  server/              API + Socket.IO
    src/security/      Senhas (scrypt), tokens (JWE), derivação de chaves
    src/auth/          Cadastro, login, sessões, redefinição de senha
    src/friends/       Pedidos de amizade, busca por apelido
    src/messages/      Mensagens diretas entre amigos
    src/realtime/      Socket.IO, presença online
    src/db/            Schema Drizzle, cliente Neon, migrações
    drizzle/           Migrações SQL geradas
packages/
  shared/              Tipos, constantes, schemas Zod e protocolo do socket
  sim/                 Simulação do jogo (esqueleto, a ser preenchido)
scripts/               gen-jwt-secret.mjs, smoke.mjs
```

## Segurança

**Senhas.** HMAC-SHA512 com *pepper* e depois **scrypt** (N=2¹⁵, r=8, p=1, sal aleatório por senha), comparação
em tempo constante. Os parâmetros ficam no hash, então dá para endurecê-los e rehashear no próximo login. Para
e-mails inexistentes o login gasta o mesmo tempo de uma senha errada (sem enumeração de contas por timing).

**Token de acesso criptografado.** O token de acesso é um JWT **criptografado (JWE, `dir` + `A256GCM`)**, não só
assinado: quem o intercepta não lê o usuário nem a sessão, e a tag do AES-GCM garante a integridade. Valida emissor,
público, tipo e expiração (15 minutos). As chaves vêm do `JWT_SECRET` por HKDF-SHA256, uma para cada finalidade.

**Sessões e refresh tokens.** Cada login é uma sessão no banco, com um refresh token opaco de 256 bits guardado
apenas como HMAC. O refresh **gira a cada uso**; reapresentar um token antigo fora de uma janela de 15 segundos
(duas abas renovando juntas) é tratado como roubo e **revoga a sessão inteira**. O usuário vê e encerra seus
dispositivos no perfil. Trocar ou redefinir a senha derruba as outras sessões e desconecta os sockets delas na hora.

**Cookies e CSRF.** Os tokens ficam em cookies `httpOnly`, `Secure` em produção e `SameSite` (nunca no
`localStorage`). Requisições que alteram dados rejeitam `Origin` desconhecida.

**Abuso.** Limite de requisições por IP (generoso, porque muita gente divide a mesma rede em eventos), bloqueio
de 15 minutos da conta após 5 senhas erradas, cabeçalhos do Helmet com CSP, corpo de requisição limitado e logs que
nunca registram cookies ou tokens.

**Recuperação de senha.** Token aleatório de 256 bits, uso único, válido por 1 hora, guardado só como HMAC. A
resposta é sempre a mesma exista ou não o e-mail.

**WebSocket.** O socket se autentica com um *ticket* de 60 segundos obtido pela API (funciona mesmo com site e API
em domínios diferentes) e é derrubado quando a sessão é revogada.

**Privacidade.** O e-mail é visível só para o dono da conta. Os amigos se encontram por **apelido** único.

> Ainda não há envio de e-mail. Em desenvolvimento, o link de redefinição de senha aparece no console do servidor.
> Para produção, implemente `sendMail` em `apps/server/src/mailer.ts` (Resend ou SMTP).

## API

Todas as rotas ficam em `/api`. Erros seguem `{ "error": "mensagem", "fields": { "campo": "mensagem" } }`.

| Método e rota | Descrição |
| --- | --- |
| `POST /auth/register` · `POST /auth/login` | Cria conta / entra |
| `POST /auth/refresh` · `POST /auth/logout` | Renova a sessão / sai |
| `GET /auth/me` · `PATCH /auth/me` | Usuário atual / altera o nome |
| `POST /auth/change-password` | Troca a senha (derruba os outros dispositivos) |
| `POST /auth/forgot-password` · `POST /auth/reset-password` | Recuperação de senha |
| `GET /auth/sessions` · `DELETE /auth/sessions/:id` | Dispositivos conectados |
| `POST /auth/socket-ticket` | Ingresso de 60 s para abrir o WebSocket |
| `GET /friends` · `POST /friends` | Lista de amigos e pedidos / envia pedido por apelido |
| `POST /friends/:id/accept` · `DELETE /friends/:id` | Aceita / recusa, cancela ou desfaz |
| `GET /users/search?q=` | Busca por apelido (sem expor e-mail) |
| `GET /messages/unread` · `GET /messages/:userId` · `POST /messages/:userId/read` | Mensagens diretas |
| `GET /health` | Saúde do servidor e do banco |

### Eventos do Socket.IO

Definidos e tipados em `packages/shared/src/protocol.ts`.

| Servidor → cliente | Quando |
| --- | --- |
| `presence:list`, `presence:update` | Amigos online / um amigo entrou ou saiu |
| `friend:request`, `friend:accepted`, `friend:removed` | Mudanças na lista de amigos |
| `dm:message`, `dm:read` | Mensagem recebida / amigo leu a conversa |
| `session:revoked` | A sessão foi encerrada: o site volta ao login |

| Cliente → servidor | Descrição |
| --- | --- |
| `dm:send` | Envia mensagem a um amigo (com *ack*; limite de 10 a cada 10 s) |
| `dm:read` | Marca a conversa como lida |

## Banco de dados

As tabelas vivem no schema `outpost` do PostgreSQL (`users`, `sessions`, `password_resets`, `friendships`,
`direct_messages`), com o controle de migrações em `outpost.__migrations`. Elas não interferem nas tabelas do
schema `public` de protótipos anteriores que dividem o mesmo banco Neon.

## Deploy

O servidor mantém conexões WebSocket, então precisa de um **processo Node persistente** (Render, Railway, Fly.io…).
Funções serverless da Vercel não servem para ele.

1. `npm ci && npm run build && npm run build:server`, depois `npm start`.
2. Defina `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV=production` e `WEB_ORIGIN` (e `TRUST_PROXY=true` atrás de proxy).
3. As migrações rodam sozinhas na inicialização.
4. Com o site em outro domínio (ex.: Vercel), defina no build do site `VITE_API_URL` e `VITE_SOCKET_URL` com a URL
   do servidor, e no servidor `COOKIE_SAMESITE=none`. Para evitar cookies entre domínios, sirva tudo do mesmo
   domínio: em produção o próprio servidor entrega o site.
5. O estado de presença fica em memória, então use uma única instância (ou o adapter Redis do Socket.IO ao escalar).

## Roteiro

A campanha jogável completa é o objetivo da próxima fase:

1. Simulação de recursos e tripulação (`packages/sim`, determinística e testável).
2. Mundos compartilhados de até 4 jogadores, com convite entre amigos e persistência.
3. Papéis, construção de instalações e tarefas.
4. Eventos, votações e velocidade do tempo compartilhada.
5. Pesquisa e logística (duas janelas de carga).
6. Relatórios diário e final, tutorial progressivo e interface educativa.
7. Cena 3D isométrica low-poly da base (Three.js).

## Créditos

Projeto da equipe do hackathon NASA Space Apps de Fortaleza. A arte do site é original (SVG), sem logotipos nem
material da NASA.
