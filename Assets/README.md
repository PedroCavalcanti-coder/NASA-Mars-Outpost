# NASA Mars Outpost — Pacote 3D (`Assets/`)

Todos os modelos, animações, texturas, arquivos do Blender e scripts geradores do jogo **Mars Outpost**
(jogo educativo de colônia em Marte, three.js). Este arquivo é escrito para **pessoas e para IAs**:
a Parte 4 diz exatamente como uma IA deve usar o pacote sem adivinhar nada.

> Origem: exportado do projeto de desenvolvimento (pasta `NASA - Mars Output`) pelo script
> `ferramentas/export-assets.mjs`. Os GLBs são gerados por scripts do Blender (`blender/scripts/`),
> não modelados à mão arquivo a arquivo. Este pacote **não registra nem afirma datas de criação**.

---

## 1. Estrutura

```
Assets/
├─ README.md                 ← você está aqui
├─ catalog.json              ← FONTE DA VERDADE: cada GLB com nós, ossos, clipes, materiais, texturas
├─ modelos/                  ← modelos prontos para o jogo (meshopt)
│   ├─ astronaut.glb         astronauta: esqueleto, rosto, 7 clipes
│   ├─ rover.glb             veículo pilotado (6 rodas)
│   ├─ rover_remoto.glb      veículo remoto (6 rodas + câmera)
│   └─ habitat, greenhouse, lab, moxie, water_recycler, battery_bank, solar_array, antenna,
│      weather_station, ice_extractor, water_tank, oxygen_tank, cargo_pallet, props   (equipamentos antigos)
├─ bases/
│   ├─ base_<id>.glb/.json   8 bases (jezero, utopia, gale, olympus, valles, hellas, elysium, arcadia)
│   ├─ plantas.glb           17 modelos de planta (3 culturas × estágios)
│   ├─ terreno.glb           chão com montanhas + rochas
│   ├─ sonda.glb             sonda de perfuração
│   └─ thumb_<id>.jpg        miniaturas das bases
├─ texturas/
│   ├─ embutidas/            imagens extraídas dos GLBs (logos, piso, poeira dos painéis, rostos)
│   └─ jogo/                 texturas soltas usadas pelo site (inclui `normal/` se existir)
├─ modelos-brutos/           GLBs originais dos equipamentos antes de otimizar
├─ blender/
│   ├─ arquivos/             .blend (bases, astronauta, terreno, kit original, galeria)
│   └─ scripts/              .py que geram tudo + README do Blender
└─ ferramentas/              scripts Node de auditoria, build e export
```

## 2. Inventário e animações

Detalhes completos (nós, ossos, materiais, polígonos): **`catalog.json`**. Resumo:

| Arquivo | Clipes (nome exato) | Notas |
| --- | --- | --- |
| `modelos/astronaut.glb` | `Idle` `Walk` `Work` `Wave` `Clean` `Plant` `Harvest` | esqueleto de 7 ossos; nó `face` (rosto); ferramentas `tool_*` na mão |
| `modelos/rover.glb` | `Drive` | `Roda_0..5`, `rover_body`; 1 volta de roda por segundo |
| `modelos/rover_remoto.glb` | `Drive` `Scan` | `Roda_0..5`, `cabeca_camera` varre no `Scan` |
| `bases/base_<id>.glb` | `Scan_*` (prato da antena), `Porta_*_Abrir` | ver nomes na seção 3 |
| `bases/plantas.glb` | — | `PLANTA_Batata_0..5`, `PLANTA_Alface_0..4`, `PLANTA_Tomate_0..5` |
| `bases/terreno.glb` | — | `GAME_Terreno` + `GAME_Rocha_Grande_NN` |
| `bases/sonda.glb` | — | `KIT_Sonda_Perfuracao` |

**Quando cada clipe do astronauta toca:** andando → `Walk`; manutenção de painel solar → `Clean`
(com `tool_cleaning`); cultivo em andamento → `Plant`; cultivo pronto → `Harvest` (com `tool_harvest`);
demais tarefas → `Work`; parado/dormindo → `Idle`; comemoração → `Wave`.

**Expressões do rosto (atlas 1024×256, 4×2 células):** 0 feliz · 1 empolgado · 2 neutro · 3 cansado ·
4 preocupado · 5 dormindo · 6 surpreso · 7 piscada.

**Poeira dos painéis solares (atlas de 5 células):** 0 limpo · 1–3 intermediários · 4 totalmente empoeirado.

**Culturas (hidroponia):** Batata (6 estágios) · Alface (5) · Tomate (6). Último estágio = colheita.

## 3. Convenções (obrigatórias)

- **Eixos:** os GLBs já estão em Y para cima. **A frente de personagens e veículos aponta para +Z.**
  Para virar na direção do movimento: `obj.rotation.y = Math.atan2(dx, dz)`.
- **Escala:** modelos em **metros**. Bases, veículos e terreno entram na cena com `scale = 0.75`
  (1 tile de base = 4 m = 1 célula do jogo = 3 unidades).
- **Origem:** peças que giram têm origem no eixo; veículos/personagens no chão, no centro.
- **Nomes que o código procura — não renomear:**

| Nome (ou final do nome) | Para quê |
| --- | --- |
| `*_Telhado` | telhado que some quando o astronauta entra |
| `*_Batata_<n>_<Estágio>_<k>` (nó **vazio**) | marcador de canteiro: troque por um estágio de `plantas.glb` |
| `*_Nave`, `*_Pad` | nave e plataforma de pouso |
| `<Comodo>_<n>_<Lado>_PortaGaragem_FolhaInf/Sup` | portas de garagem: Inf desce 2,31 m, Sup sobe 0,45 m (eixo Y local) |
| `*_Antena_Prato` | prato da antena (animação `Scan_*`) |
| `*_Solar_NN` + material `M_Solar_Poeira` | painel solar e camada de poeira |
| `Roda_0..5`, `rover_body`, `cabeca_camera` | peças dos veículos |
| `face`, `task_tool`, `tool_<tipo>` | rosto e ferramentas do astronauta |
| `color_helmet/vest/suit/gloves/boots/backpack` | partes do traje (a cor muda por material) |
| `GAME_Terreno`, `GAME_Rocha_*` | chão e rochas |

- **JSON da base** (`base_<id>.json`): `rooms` (id, tipo, tile, tamanho, portas), `corridors`, `pad`,
  `solar` (posição de cada painel), `bay` (garagem: `crew`/`auto` com `path`, `heading`, `door`, `exit`).
  Posições em **tiles**; no jogo `x = tx − cx`, `y = −(ty − cy)`.

## 4. COMO UMA IA DEVE USAR ESTE PACOTE

Siga a ordem. Não invente nomes de nós ou de clipes: leia `catalog.json`.

### Passo 1 — Descobrir o que existe
```js
const catalog = await (await fetch('catalog.json')).json();
const astro = catalog.itens.find(i => i.arquivo === 'modelos/astronaut.glb');
astro.animacoes;   // [{nome:'Idle', duracaoSeg:3.04, canais:21}, ...]
astro.nosNomeados; // nomes de nós reais
astro.esqueleto;   // ossos
```

### Passo 2 — Carregar (three.js)
```js
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder); // OBRIGATÓRIO: os GLBs usam meshopt
const gltf = await loader.loadAsync('modelos/astronaut.glb');
const root = cloneSkinned(gltf.scene);              // OBRIGATÓRIO para modelos com esqueleto (cada instância)
const mixer = new THREE.AnimationMixer(root);
const play = (nome) => mixer.clipAction(THREE.AnimationClip.findByName(gltf.animations, nome)).reset().play();
play('Idle');                                       // a cada quadro: mixer.update(dt)
```
Troca suave: `anteriorAction.crossFadeTo(novaAction, 0.25, false)`.

### Passo 3 — Receitas
- **Veículo andando:** toque `Drive` com `timeScale = velocidade / (2π · 0.5 · escala)`; pause ao parar. `rover_remoto`: toque `Scan` parado.
- **Rosto:** clone a textura do material de `face` para cada astronauta (`tex = mat.map.clone()`),
  `tex.repeat.set(0.25, 0.5)`, `mat.map = mat.emissiveMap = tex`, `mat.polygonOffset = true`,
  e a expressão `i` é `tex.offset.set((i % 4) * 0.25, Math.floor(i / 4) * 0.5)`.
- **Plantas:** carregue `plantas.glb`; para cada marcador de canteiro, crie um grupo na mesma posição
  e adicione os estágios da cultura (`PLANTA_<Cultura>_<n>_*`); mostre só um: o último estágio =
  pronto para colher (use `Harvest`), os anteriores `Plant`.
- **Poeira dos painéis:** para cada nó `*_Solar_NN`, ache a malha com material `M_Solar_Poeira`;
  clone o material 5 vezes com `map.repeat = (1/5, 1)` e `offset.x = estágio/5`; estágio 0 → `mesh.visible = false`.
- **Porta de garagem:** guarde `y` inicial; `FolhaInf.position.y = y0 − 2.31·k`, `FolhaSup.position.y = y0 + 0.45·k`, `k` de 0 a 1.
- **Antena:** toque a animação cujo nome começa com `Scan` no `scene` da base.
- **Terreno:** carregue `terreno.glb`, escala 0.75; `GAME_Terreno` é o chão (faça raycast para a altura); rochas projetam sombra.
- **Base:** carregue `base_<id>.glb` + `.json`; escala 0.75; posicione com o centro da planta.
- **Normal map extra:** o jogo aplica detalhe triplanar (sem UV); PNGs próprios em `texturas/jogo/normal/{terreno,rocha,casco}.png` o substituem.

### Passo 4 — Regras para a IA
1. **Não renomeie** nós, clipes ou materiais da tabela da seção 3.
2. **Não edite os `.glb`** direto: edite o script em `blender/scripts/` e regenere (seção 5).
3. Modelos com esqueleto: **sempre** `SkeletonUtils.clone`; textura/material por instância se mudar por personagem.
4. Não use `Object3D.clone()` em modelo com esqueleto; não ignore o `MeshoptDecoder`.
5. Antes de entregar: `node ferramentas/audit-models.mjs` (polígonos e duplicatas) e olhe o `catalog.json`.
6. Orçamento: módulo ≤ 2 mil tris, equipamento ≤ 700, astronauta ≈ 2 mil, terreno ≈ 60 mil. Logos, juntas e painéis finos vão em **textura**, não em geometria.
7. Se um nome pedido não existir no catálogo, **pergunte ou crie** (não finja que existe).

## 5. Regenerar tudo (precisa do Blender 5.x e Node 22+)

```bash
# bases (8) + dedup/poda/webp/meshopt + JSON
node ferramentas/build-bases.mjs
# astronauta, rovers, plantas, terreno (cada um escreve o GLB no caminho do projeto)
blender -b blender/arquivos/MarsOutpost_Bases.blend --python blender/scripts/rover_animado.py
blender -b blender/arquivos/MarsOutpost_Bases.blend --python blender/scripts/rover_remoto.py
blender -b blender/arquivos/MarsOutpost_Bases.blend --python blender/scripts/plantas_estagios.py
blender -b --python blender/scripts/astronauta_animado.py
blender -b --python blender/scripts/terreno_marte.py
npx gltf-transform meshopt arquivo.glb arquivo.glb   # comprimir depois de exportar
```
Os scripts assumem a estrutura do repositório de desenvolvimento (`apps/web/public/assets`, `assets-src/`).
Para usar fora dele, ajuste as constantes `REPO`/`OUT` no topo de cada `.py`.

## 6. Exportar um modelo novo do Blender para o three.js
1. Frente em **−Y**, escala aplicada (1 unidade = 1 m), origem no chão (ou no eixo se girar).
2. Animações: Action → faixa **NLA** com o nome do clipe; primeiro = último quadro; 24 fps.
3. `File → Export → glTF 2.0 (.glb)`: *Selected Objects*, *+Y Up*, *Apply Modifiers*, *Vertex Color: Active*, animação em *NLA Tracks*.
4. `gltf-transform meshopt`, salve em `modelos/` e confira com `audit-models.mjs`.

## 7. Limites conhecidos
- Os modelos antigos de equipamento (`habitat`, `lab`…) têm estilo diferente das bases e são pouco usados.
- As portas `Porta_*_Abrir` das bases existem como animação, mas o jogo só anima as de garagem (por código).
- Texturas embutidas das bases estão em WebP; use um navegador/loader que suporte `EXT_texture_webp` (three.js suporta).
- Os `.blend` de bases só são sincronizados se `exportar_bases.py` for rodado; os GLBs são o resultado final.

## 8. Git
`NASA-Mars-Outpost/.gitignore` ignora `*.glb`, `*.blend` e `docs/`. Esta pasta existe **localmente**;
`.png`, `.json` e `.py` não são ignorados e poderiam ser enviados por engano com `git add .`.
Decida antes se `Assets/` entra no repositório (e ajuste o `.gitignore` de acordo).
