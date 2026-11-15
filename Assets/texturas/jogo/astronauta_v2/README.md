# Astronauta v2 — personalização, marcas, rostos e gestos

Modelo novo do astronauta (no `.blend`: coleções `GAL_astronauta2_*`, ao lado da galeria antiga).
**GLB pronto:** `Assets/modelos/astronaut_v2.glb` (gerado por `ast2_export.py`, já com os nomes do jogo).
Texturas trocáveis publicadas em `Assets/modelos/astronauta_v2/`.
Para integrar ao jogo, veja `PROMPT_INTEGRACAO_IA.md`.
Gerado pelos scripts de `Assets/blender/scripts/astronauta_v2/`.

- **Corpo:** 7.130 faces + 200 do rosto (≈ 7,3 mil)
- **Esqueleto:** 21 ossos
- **Animações:** as 4 animações antigas mais 16 gestos novos.

## 1. Peças tingíveis (sistema de cores do jogo)

Cada peça tem **material próprio**. O jogo troca a cor do material inteiro, então peças que compartilham material mudariam juntas.

| Objeto no Blender | Nome no GLB (para o jogo) | Parte (`SUIT_PARTS`) | Família de textura |
| --- | --- | --- | --- |
| `AST2_color_helmet` | `color_helmet` | helmet (casco do capacete) | casco |
| `AST2_color_suit` | `color_suit` | suit (traje, ombreiras, mangas, pernas) | tecido |
| `AST2_color_vest` | `color_vest` | vest (colar, cinto, placa do peito) | tecido |
| `AST2_color_gloves` | `color_gloves` | gloves | tecido |
| `AST2_color_boots` | `color_boots` | boots | casco |
| `AST2_color_backpack` | `color_backpack` | backpack (mochila + rádio) | casco |
| `AST2_static` | `static_body` | — fixo: visor, juntas pretas, painel, rebites, fios, solas | — |
| `AST2_face` | `face` (material **`M_Rosto`**) | — rosto LED | atlas de rostos |

> Na exportação, renomeie `AST2_color_*` → `color_*`, `AST2_static` → `static_body`, `AST2_face` → `face`, e o material `M_Rosto_LED` → `M_Rosto`.
> No Blender eles têm prefixo porque os nomes originais pertencem ao modelo antigo.

## 2. Texturas por cor (`cores/`)

Para cada uma das 12 cores de `SUIT_COLORS` existem duas texturas 512×512 que repetem sem emenda. Os detalhes vêm pintados no próprio tom da cor (sulcos levemente mais saturados; em cores escuras, os detalhes clareiam):

- `tecido_<cor>.png`: trama, ripstop e costura tracejada (traje, colete, luvas)
- `casco_<cor>.png`: placas, sulcos com brilho, rebites e arranhões leves (capacete, botas, mochila)
- `tecido_neutro.png` / `casco_neutro.png`: cinza claro, para continuar usando o tingimento atual (`material.color`)

Cores: `ice, station, graphite, deep_blue, sky, mint, orange, yellow, coral, oxide, lilac, pink`.

**Uso no jogo (sugestão):** em `applySuit`, troque `material.map` pela textura `<família>_<cor>` da peça e deixe `material.color` em branco. As malhas já têm UV (projeção cúbica, 1 repetição a cada 0,5 m).
Para manter o comportamento atual, use as texturas `*_neutro` e continue tingindo com `material.color`.

## 3. Marcas / emblemas (`emblemas.png`, atlas 4×2 de 256 px)

| Célula | Marca | Célula | Marca |
| --- | --- | --- | --- |
| 0 | Missão Marte (planeta com anel) | 4 | Botânica (folha) |
| 1 | Foguete | 5 | Engenharia (chave) |
| 2 | Estrela | 6 | Medicina (cruz) |
| 3 | Olympus Mons | 7 | Ciência (frasco) |

Trocar de marca: `texture.repeat = (0.25, 0.5)` e `texture.offset = ((célula % 4) * 0.25, célula < 4 ? 0.5 : 0)`.
As 4 últimas combinam com as tarefas do jogo (botânica, engenharia, medicina, ciência).

Lugares prontos (decalques com UV na célula 0): `acc_emblema_ombro` (os dois ombros), `acc_emblema_peito`, `acc_emblema_capacete`, `acc_emblema_mochila`.

## 4. Acessórios 3D opcionais (`acc_*`)

Cada acessório é um objeto separado, preso ao esqueleto. Basta mostrar ou esconder no jogo. Para que um acessório siga a cor de uma peça, coloque-o como filho do nó `color_<peça>` correspondente.

| Objeto | Descrição | Segue a cor de |
| --- | --- | --- |
| `acc_lanterna_capacete` | lanterna no topo do capacete | helmet |
| `acc_antena_parabolica` | mini parabólica na mochila | backpack |
| `acc_tanques_oxigenio` | dois tanques nas costas | backpack |
| `acc_joelheiras` | joelheiras com rebite | suit |
| `acc_bolsas_cinto` | bolsas nas laterais do cinto | vest |
| `acc_cracha` | plaquinha de nome no peito | — |
| `acc_luzes_ombro` | luzes no alto das ombreiras | — |
| `acc_emblema_*` | decalques de marca (ver seção 3) | — |

## 5. Rosto LED (`rostos_led.png`, atlas 4×2, mesma ordem do rosto antigo)

`0 feliz · 1 empolgado · 2 neutro ("O o" da referência) · 3 cansado · 4 preocupado · 5 dormindo · 6 surpreso · 7 piscada`

O esquema de UV é igual ao do rosto antigo. O código atual (`repeat 0.25×0.5`, troca por `offset`) continua funcionando.

## 6. Gestos e emotes (ações no GLB)

| Clipe | Gesto | Emoji / pedido | Rosto sugerido |
| --- | --- | --- | --- |
| `Emote_Silly` | careta, mãos no capacete | 😜 | 7 piscada |
| `Emote_Laugh` | risada, mãos na barriga | 😂 | 1 empolgado |
| `Emote_ThumbsUp` | joinha | 👍 / like | 7 piscada |
| `Emote_ThumbsDown` | polegar para baixo | deslike | 4 preocupado |
| `Emote_Clap` | palmas | 👏 | 1 empolgado |
| `Emote_Heart` | coração com as mãos sobre o capacete | ❤️ | 0 feliz |
| `Emote_Surprised` | pulo para trás, mãos no capacete | 😮 | 6 surpreso |
| `Emote_Celebrate` | pulos com punhos para cima | 🎉 | 1 empolgado |
| `Emote_Rocket` | agacha, decola girando e pousa | 🚀 | 1 empolgado |
| `Emote_Bye` | tchau | tchau | 0 feliz |
| `Emote_Point` | apontar | apontar | 2 neutro |
| `Emote_Dance` | dança (loop) | dançar | 0 feliz |
| `Duo_HighFive` | "toca aqui" | com outro jogador | 1 empolgado |
| `Duo_Handshake` | aperto de mão | com outro jogador | 0 feliz |
| `Duo_FistBump` | soquinho (+ "explosão") | com outro jogador | 7 piscada |
| `Duo_Hug` | abraço | com outro jogador | 0 feliz |

**Gestos em dupla:** os dois jogadores tocam o mesmo clipe, de frente um para o outro. Para as mãos se encontrarem, posicione o parceiro assim (medidas no espaço do primeiro jogador):

| Clipe | Distância à frente | Deslocamento lateral |
| --- | --- | --- |
| `Duo_HighFive` | 0,98 m | 0,78 m |
| `Duo_Handshake` | 0,92 m | 0,78 m |
| `Duo_FistBump` | 1,00 m | 0,78 m |
| `Duo_Hug` | 0,60 m | 0,36 m (cabeças lado a lado, não de frente) |

A mão usada é a do osso `*_L`.

## 7. Esqueleto (21 ossos)

- **Tronco e cabeça:** `root`, `torso`, `head`
- **Braços (por lado):** `arm`, `forearm`, `hand`, `thumb`, `index`, `fingers`
- **Pernas (por lado):** `leg`, `shin`, `foot`

Os ossos `root/torso/head/arm_*/leg_*` têm a mesma orientação do esqueleto antigo, por isso `Idle/Walk/Work/Wave` foram reaproveitadas (`AST2_Idle`, `AST2_Walk`, …).
`thumb`/`index`/`fingers` permitem fazer punho, joinha e apontar.
