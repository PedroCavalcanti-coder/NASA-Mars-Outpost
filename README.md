# Mars Outpost

Jogo educativo **cooperativo** (1 a 4 jogadores, direto no navegador) de gerenciamento e sobrevivência de uma
base humana em Marte. Criado para o desafio **Build a Junior Astronaut Mission Trainer** do NASA Space Apps
Challenge, no hackathon de Fortaleza.

> Projeto independente, sem endosso nem parceria oficial da NASA.

## Estado do projeto

| Parte | Situação |
| --- | --- |
| Site (home, centro, suporte) | ✅ pronto |
| Jogador temporário (sem login) e mundos de até 4 jogadores | ✅ pronto |
| API, Socket.IO e banco de dados (Neon) | ✅ pronto |
| Jogar (pop-up de apelido) e cena 3D da base | ✅ pronto: sorteia 1 das 8 bases |
| Jogo: simulação, mundos, papéis, eventos | 🚧 próxima etapa |

Esta base é o alicerce: o jogo se encaixa nela usando o mesmo jogador temporário e o mesmo WebSocket.

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

## Dados da NASA (para os jurados)

Arquivo curado e embutido (sem API ao vivo): explosões solares reais do **DONKI**, doses de radiação
medidas pelo **RAD do Curiosity**, locais reais das bases (**Mars Trek**) e fotos com ID do Photojournal.
No jogo, tudo aparece no painel **"Dados da NASA"**. Explicação completa, em inglês, em
[`docs/NASA_DATA.md`](docs/NASA_DATA.md).

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
  server/              API + Socket.IO
    src/worlds/        Jogador temporário, vínculos jogador<->mundo, salvamento
    src/realtime/      Socket.IO do jogo (salas, simulação)
    src/db/            Schema Drizzle, cliente Neon, migrações
    drizzle/           Migrações SQL
packages/
  shared/              Tipos, constantes e protocolo
  sim/                 Simulação do jogo
Assets/                Modelos 3D, animações e arquivos do Blender (fonte única)
scripts/               gen-jwt-secret.mjs
```

## Jogador temporário e mundos

Não há login nem cadastro. Ao aceitar o cookie de salvamento, o servidor cria um **jogador** (id aleatório + o
último apelido usado) e entrega ao navegador uma chave `HttpOnly`; no banco só o HMAC dela é guardado. O jogador
é **temporário**: cada partida renova a validade e, sem jogar por 30 dias, ele some junto com os vínculos.

- Ao entrar num mundo, o jogador fica **vinculado** a ele para sempre (enquanto existir).
- Até **4 jogadores** compartilham o mesmo mundo; um quinto não entra.
- Cada jogador guarda até **5 mundos**. Passando disso, o mais antigo sai só da lista **dele**.
- Apagar um mundo (ou perdê-lo pelo limite) remove só o vínculo de quem o fez; quem continua vinculado mantém o
  mundo. **Sem nenhum vínculo restante, o mundo é apagado.**
- Recusar/revogar o cookie apaga o jogador e os vínculos.

## Jogar sem conta e as 8 bases

O botão **Jogar** da home abre um pop-up pedindo só o apelido (guardado na aba do navegador, nunca enviado ao
servidor) e leva a `/jogar`. A cada partida o jogo **sorteia uma das 8 bases** (Jezero, Utopia, Gale, Olympus,
Valles, Hellas, Elysium, Arcadia), com terreno, estufas, painéis solares, nave e antena animada. Dá para girar,
mover e aproximar a câmera, mostrar ou ocultar os telhados e sortear outra base. As regras do jogo entram nessa
cena na próxima etapa.

Os modelos ficam em `Assets/` (pastas `bases` e `modelos`). O Vite os serve de lá em `/assets/…` e os inclui no
build, sem duplicar arquivos; `.blend`, scripts e modelos brutos nunca vão para o site. O `.gitignore` ignora
`*.glb`: **para o deploy funcionar, os GLB precisam estar no repositório** (ou ser fornecidos no build).

## Segurança

**Cookies e CSRF.** A chave do jogador fica em cookie `httpOnly`, `Secure` em produção e `SameSite`. Requisições que
alteram dados rejeitam `Origin` desconhecida.

**Abuso.** Limite de requisições por IP, cabeçalhos do Helmet com CSP, corpo de requisição limitado e logs que nunca
registram cookies.

## API

Todas as rotas ficam em `/api`. Erros seguem `{ "error": "mensagem" }`.

| Método e rota | Descrição |
| --- | --- |
| `POST /worlds/consent` · `DELETE /worlds/consent` | Cria/renova o jogador e o cookie / apaga o jogador |
| `GET /worlds/recent` | Mundos vinculados ao jogador (até 5) |
| `DELETE /worlds/:code` | Remove o vínculo do jogador com o mundo |
| `POST /worlds/check-nickname` | O apelido está livre na sala? |
| `GET /health` | Saúde do servidor e do banco |

O jogo roda no namespace Socket.IO `/game` (`apps/server/src/realtime/game.ts`).
