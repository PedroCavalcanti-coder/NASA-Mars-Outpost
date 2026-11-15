# Prompt — integrar o Astronauta v2 ao Mars Outpost

> Cole o texto abaixo para a IA que vai programar. Ele parte do estado atual do repositório.

---

Você vai integrar o **novo modelo do astronauta (v2)** ao jogo Mars Outpost (monorepo: `apps/web` em React + three.js, `apps/server` em Socket.IO e `packages/shared` com os tipos comuns). O modelo, as texturas e as animações já estão prontos. Sua tarefa é ligá-los aos sistemas do jogo **sem quebrar** o que já funciona. Trabalhe em etapas pequenas, com testes, e rode `typecheck`, `lint` e os testes existentes ao fim de cada etapa.

## 0. Leia antes de começar

- `Assets/texturas/jogo/astronauta_v2/README.md`: especificação completa (peças, texturas, marcas, rostos, clipes, distâncias dos gestos em dupla).
- Código atual relevante:
  - `apps/web/src/game/AstronautActor.ts`: carrega `/assets/modelos/astronaut.glb`, `applySuit` (tinge `color_${part}` via `material.color`), `crossfadeTo`, tarefas (`Clean`/`Plant`/`Harvest` com `tool_*`), `EmoteBubble`.
  - `apps/web/src/game/runtime/astronautPreview.ts`: prévia do traje; procura o material `M_Rosto` e aplica `repeat (0.25, 0.5)`.
  - `apps/web/src/app/components/astronaut/SuitModal.tsx` e `SuitPreview.tsx`: tela de personalização.
  - `packages/shared/src/astronaut.ts`: `SUIT_COLORS`, `SUIT_PARTS`, `SuitConfig`, `DEFAULT_SUIT`, `normalizeSuit`, `randomSuit`.
  - `packages/shared/src/game.ts`: `GAME_EMOTES = ['😀','😂','👍','👋','❤️','😮','🎉','🚀']` e os eventos `player:emote`.
  - `apps/server/src/realtime/game.ts`: valida `player:emote` (índice inteiro, limite de 1 por ~0,9 s) e repassa para a sala.
  - `apps/web/src/game/BaseViewer.ts` (`sendEmote`, `showEmote`), `apps/web/src/game/MultiplayerRoom.ts` (`onEmote`, `sendEmote`), `apps/web/src/app/pages/Game.tsx` (`pickEmote`), `apps/web/src/app/components/hud/panels/ChatPanel.tsx` (grade "Enviar Reação Rápida").
  - `apps/web/vite.config.ts`: publica só `Assets/bases` e `Assets/modelos` em `/assets/...`.

## 1. Arquivos novos (já existem; não regenere)

- `Assets/modelos/astronaut_v2.glb` (publicado em `/assets/modelos/astronaut_v2.glb`, ~2,4 MB):
  - **Nós:** `astronaut_root` › `astronaut_rig` (21 ossos).
  - **Malhas com skin:** `color_helmet`, `color_suit`, `color_vest`, `color_gloves`, `color_boots`, `color_backpack`, `static_body`, `face` (material `M_Rosto`).
  - **Acessórios `acc_*`:** `acc_lanterna_capacete`, `acc_antena_parabolica`, `acc_tanques_oxigenio`, `acc_joelheiras`, `acc_bolsas_cinto`, `acc_cracha`, `acc_luzes_ombro`, `acc_emblema_ombro`, `acc_emblema_peito`, `acc_emblema_capacete`, `acc_emblema_mochila`.
  - **Ossos:** `root, torso, head` e, para cada lado `_L/_R`: `arm, forearm, hand, thumb, index, fingers, leg, shin, foot`.
  - **Clipes:**
    - Antigos: `Idle, Walk, Work, Wave`.
    - Emotes: `Emote_Silly, Emote_Laugh, Emote_ThumbsUp, Emote_ThumbsDown, Emote_Clap, Emote_Heart, Emote_Surprised, Emote_Celebrate, Emote_Rocket, Emote_Bye, Emote_Point, Emote_Dance`.
    - Em dupla: `Duo_HighFive, Duo_Handshake, Duo_FistBump, Duo_Hug`.
  - **Triângulos:** o corpo tem ~15,3 mil e os acessórios ~4,2 mil (o GLB antigo tinha ~2,3 mil).
- `Assets/modelos/astronauta_v2/` (publicado em `/assets/modelos/astronauta_v2/...`):
  - `cores/tecido_<cor>.png`, `cores/casco_<cor>.png`: 12 cores + `*_neutro`, 512×512, repetíveis.
  - `emblemas.png`: atlas 4×2 de marcas.
  - `rostos_led.png`: atlas 4×2 de expressões, já embutido no GLB.
- O GLB é regenerado no Blender por `Assets/blender/scripts/astronauta_v2/ast2_export.py` (não precisa rodar).

## 2. Trocar o modelo, com alternância segura

1. Crie uma constante única de URL do modelo (por exemplo, em `packages/shared` ou num módulo `apps/web/src/game/astronautModel.ts`) e use-a em `AstronautActor.ts` e `astronautPreview.ts`. Hoje as duas URLs estão duplicadas.
2. Aponte para `astronaut_v2.glb`, mas mantenha uma flag (`USE_ASTRONAUT_V2 = true`) para voltar ao antigo se algo quebrar.
3. **Clipes de tarefa:** o v2 **não tem** `Clean`, `Plant`, `Harvest` nem os objetos `tool_*` (o pedido foi tirar os objetos da mão).
   - Em `startTask`, se o clipe não existir em `this.actions`, use `Work`.
   - `crossfadeTo` hoje retorna em silêncio quando o clipe falta e o personagem fica parado no clipe anterior. Corrija com um fallback explícito.
   - Mantenha a lógica de `tool_*` tolerante a ausência (já é: o mapa só fica vazio).
4. **Acessórios:** esconda todos os nós `acc_*` ao carregar (`visible = false`). Eles só aparecem conforme a personalização (seção 4).
5. **Desempenho:** como o v2 tem ~6× mais triângulos, avalie com vários jogadores. Se necessário, crie um LOD simples (por exemplo, esconder `acc_*` e `face` além de N metros, ou reduzir a resolução das sombras).

## 3. Cores com textura (paleta que combina com os detalhes)

Hoje `applySuit` faz `material.color.set(hex)`. No v2 **cada peça tem material próprio** (não compartilhe instâncias entre peças nem entre jogadores: clone o material por ator).

1. Para cada peça de `SUIT_PARTS`, use a família de textura:
   - `helmet`, `boots`, `backpack` → `casco`;
   - `suit`, `vest`, `gloves` → `tecido`.
2. Carregue `/assets/modelos/astronauta_v2/cores/<familia>_<colorId>.png` com um cache compartilhado (`TextureLoader`):
   - `colorSpace = SRGBColorSpace`
   - `wrapS = wrapT = RepeatWrapping`
   - `flipY = false`, para ficar igual às texturas do glTF
   - `anisotropy` moderada
3. Aplique `material.map = textura` e `material.color.set('#ffffff')`. As malhas já têm UV para isso (projeção cúbica, uma repetição a cada 0,5 m).
4. **Fallback** (textura ainda carregando ou erro): use `<familia>_neutro.png` com `material.color.set(hex)`, que é o comportamento atual.
5. Aplique a mesma lógica em `SuitPreview`/`astronautPreview` e no `SuitModal`, para que a prévia mostre exatamente o que aparece no jogo.
6. Os acessórios que seguem a cor de uma peça usam a mesma textura e cor da peça:
   - `acc_lanterna_capacete` → helmet
   - `acc_antena_parabolica`, `acc_tanques_oxigenio` → backpack
   - `acc_joelheiras` → suit
   - `acc_bolsas_cinto` → vest
   - os outros têm material fixo.

## 4. Personalização: acessórios e marcas

1. Estenda `SuitConfig` em `packages/shared/src/astronaut.ts` **com compatibilidade retroativa**:
   - `accessories: AccessoryId[]`: ids sem o prefixo `acc_`, por exemplo `'lanterna_capacete'`.
   - `marks: Partial<Record<MarkSlot, MarkId | null>>`, com `MarkSlot = 'ombro' | 'peito' | 'capacete' | 'mochila'` e `MarkId` de 0 a 7.
   - Exporte as listas (`ACCESSORY_IDS`, `MARK_SLOTS`, `MARKS` com nome em pt-BR) para servidor e cliente usarem a mesma fonte.
2. Atualize `normalizeSuit`:
   - campos ausentes ou inválidos → `accessories: []` e `marks: {}`;
   - descarte ids desconhecidos e duplicados;
   - limite a quantidade de acessórios.
   - Atualize também `randomSuit` e `SUIT_PRESETS` se fizer sentido. Garanta que trajes salvos antigos continuam válidos (escreva teste).
3. O servidor deve aceitar só valores normalizados (veja onde o traje é recebido e salvo em `apps/server`, e os testes de segurança em `apps/server/src/security/security.test.ts`).
4. **Marcas (atlas 4×2):**
   - Células: `0 Missão Marte, 1 Foguete, 2 Estrela, 3 Olympus Mons, 4 Botânica, 5 Engenharia, 6 Medicina, 7 Ciência`.
   - Cada decalque já vem com UV apontando para uma célula base: ombro=0, peito=4, capacete=1, mochila=2.
   - Para mostrar a marca `t` num decalque com célula base `b`, clone a textura do material daquele decalque e defina `offset.x = ((t%4) - (b%4)) * 0.25` e `offset.y = (row(t) - row(b)) * 0.5`, com `row(c) = c < 4 ? 0 : 1`.
   - Confirme visualmente o sentido de `offset.y` (glTF, `flipY = false`); se a linha sair trocada, inverta o sinal.
   - O nó `acc_emblema_<slot>` fica visível só quando aquele slot tem marca.
5. **UI (`SuitModal`):** adicione, além das cores:
   - uma seção "Acessórios", com liga/desliga por item e miniatura ou ícone;
   - uma seção "Marcas", com um seletor por lugar mostrando as 8 marcas recortadas de `emblemas.png`.
   - Mantenha o padrão visual do modal atual (setas, `suit-part-row`, "Sortear combinação").

## 5. Rosto LED com expressões

O atlas de `M_Rosto` tem 8 células: `0 feliz, 1 empolgado, 2 neutro, 3 cansado, 4 preocupado, 5 dormindo, 6 surpreso, 7 piscada`.
UV igual ao do rosto antigo: `repeat (0.25, 0.5)`, célula `c` em `offset (c%4 * 0.25, c<4 ? 0 : 0.5)`. Confira com a prévia, que hoje mostra a célula 0 com `offset (0,0)`.

1. Em `AstronautActor`, clone a textura (`map` e `emissiveMap`) do material `M_Rosto` por ator e exponha `setExpression(index)`.
2. **Expressão padrão:** `0`, com `7 piscada` aleatória curta a cada 3–6 s. Use `5 dormindo` durante o descanso/sono, se o sistema de sobrevivência indicar, e `3 cansado` quando a moral ou o descanso estiverem baixos (veja os sistemas de sobrevivência já existentes na branch).
3. Durante um emote, use a expressão sugerida na tabela da seção 6 e volte ao normal quando o clipe terminar.

## 6. Emotes e gestos (reações rápidas)

Mapeamento da grade atual `GAME_EMOTES` (índices 0–7; **não mude a ordem**, pois o servidor valida por índice):

| Índice | Emoji | Clipe | Expressão |
| --- | --- | --- | --- |
| 0 | 😀 | `Emote_Silly` | 7 |
| 1 | 😂 | `Emote_Laugh` | 1 |
| 2 | 👍 | `Emote_ThumbsUp` | 7 |
| 3 | 👋 | `Emote_Bye` | 0 |
| 4 | ❤️ | `Emote_Heart` | 0 |
| 5 | 😮 | `Emote_Surprised` | 6 |
| 6 | 🎉 | `Emote_Celebrate` | 1 |
| 7 | 🚀 | `Emote_Rocket` | 1 |

Novos gestos, acrescentados **no fim** de `GAME_EMOTES` (ou numa lista paralela `GAME_GESTURES`, se preferir separar ícone e clipe):

| Gesto | Clipe | Expressão |
| --- | --- | --- |
| 👎 Deslike | `Emote_ThumbsDown` | 4 |
| 👏 Palmas | `Emote_Clap` | 1 |
| 👉 Apontar | `Emote_Point` | 2 |
| 💃 Dançar | `Emote_Dance` | 0 (loop por ~4 s) |

1. Crie em `packages/shared` uma tabela única `EMOTE_ANIMATIONS: { emoji, clip, expression, loop?, seconds? }[]`, usada pelo cliente.
   - Valide no teste que todo `clip` listado existe no GLB. Leia os nomes de `Assets/texturas/jogo/astronauta_v2/README.md` ou crie um teste que abre o GLB.
2. Em `AstronautActor`, crie `playEmote(index)`:
   - toca o clipe uma vez (`LoopOnce`, `clampWhenFinished`), com crossfade de entrada e de saída;
   - mantém o balão de emoji atual (`EmoteBubble`);
   - não interrompe tarefas em andamento;
   - é cancelado se o jogador andar;
   - **não** toca dentro do rover (lá continua só o balão).
3. Ligue ao fluxo existente:
   - local: `BaseViewer.sendEmote` → `showEmote` → `actor.playEmote(index)`;
   - remoto: `MultiplayerRoom.onEmote` → mesmo caminho.
   - O servidor continua validando por índice: só ajuste o limite se `GAME_EMOTES` crescer (o código já usa `GAME_EMOTES.length`).
4. Na UI (`ChatPanel` e no painel circular, se houver), mostre os novos gestos.

## 7. Gestos em dupla (com outro jogador)

Clipes: `Duo_HighFive` (toca aqui), `Duo_Handshake` (aperto de mão), `Duo_FistBump` (soquinho), `Duo_Hug` (abraço).
Os dois jogadores tocam **o mesmo clipe**, de frente um para o outro. A mão usada é a do osso `*_L`.

Posição do parceiro no espaço local de quem iniciou (frente = direção em que ele olha; lateral = para a direita dele, eixo do osso `_L`):

| Clipe | Frente | Lateral |
| --- | --- | --- |
| `Duo_HighFive` | 0,98 m | 0,78 m |
| `Duo_Handshake` | 0,92 m | 0,78 m |
| `Duo_FistBump` | 1,00 m | 0,78 m |
| `Duo_Hug` | 0,60 m | 0,36 m (cabeças lado a lado) |

1. **Protocolo** (em `packages/shared/src/game.ts`, com validação no servidor):
   - `gesture:invite { gesture, targetId }` → o servidor confere:
     - que os dois estão na mesma sala, a pé (fora do rover) e a ≤ 2,5 m um do outro;
     - um limite de ~1 convite por 3 s;
     - que o gesture é um valor da lista.
   - O alvo recebe o convite e mostra um botão "Aceitar" por ~5 s.
   - `gesture:accept { fromId }` → o servidor emite `gesture:start { a, b, gesture, at }` para a sala.
   - Não aceite texto livre nem ids que não estão na sala.
2. **Cliente, ao receber `gesture:start`:**
   - os dois atores giram para se encarar e deslizam suavemente (~0,25 s) até a posição da tabela, com o jogador `b` posicionado em relação a `a`;
   - os dois tocam o clipe ao mesmo tempo, com a expressão da seção 6 (high five/soquinho 1, aperto 0, abraço 0);
   - o movimento fica bloqueado até o clipe terminar;
   - respeite colisões do `BaseGrid` (se a posição alvo for inválida, cancele com uma mensagem amigável).
3. **Interface:** mostre os gestos em dupla quando houver um jogador perto, por exemplo um anel extra no painel de reações, ou ao clicar no astronauta do outro jogador.
4. **Modo offline** (`MultiplayerRoom` com `mode !== 'online'`): esconda os gestos em dupla.

## 8. Testes e verificação

- Testes unitários:
  - `normalizeSuit` (trajes antigos, ids inválidos, duplicados);
  - tabela `EMOTE_ANIMATIONS` (todo clipe existe; índices estáveis);
  - validação do servidor para `gesture:*` (distância, limite de taxa, ids fora da sala), no estilo de `security.test.ts`.
- Verificação manual no navegador:
  - personalizar cores e conferir que as texturas aparecem no jogo e na prévia;
  - ligar acessórios e marcas;
  - enviar cada reação;
  - fazer os 4 gestos em dupla com duas abas;
  - confirmar que tarefas (limpar, plantar, colher) caem em `Work` sem travar.
- Não remova `astronaut.glb` antigo até tudo acima passar.
