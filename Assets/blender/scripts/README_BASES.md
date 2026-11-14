# Bases, móveis e plantas (Blender)

Gerado a partir do kit modular `MarsOutpost_Modular.blend` (grade de 4 m, origem no canto −X/−Y,
portas `E1`, `N0`… em cada cômodo).

| Arquivo | O que faz |
| --- | --- |
| `lib_kit.py` | Utilitários: materiais `M_*`, primitivas low-poly, coleções |
| `moveis.py` | 23 móveis/equipamentos/veículo + canteiro de batata em 4 estágios (vazio, broto, crescida, colheita) |
| `layouts.py` | As 8 plantas de base (Python puro). `python layouts.py` valida e desenha em ASCII |
| `bases.py` | Módulo **Garagem**, mobília de cada cômodo, corredores automáticos, exterior e exportação |
| `build_all.py` | Roda tudo no arquivo aberto e exporta para `apps/web/public/assets/bases/` |

## Regenerar

1. Abra `MarsOutpost_Modular.blend` (ou `MarsOutpost_Bases.blend`, que já contém o resultado).
2. Scripting → abra `build_all.py` → Run Script (ou `build_all(export=True)`).
3. Comprima: `npx gltf-transform meshopt <base>.glb <base>.glb` (o jogo usa o MeshoptDecoder).
4. `node scripts/gen-bases.mjs` para atualizar `packages/shared/src/bases.generated.ts`.

## Regras das plantas

- Essenciais em todas: Habitação, Suporte de vida, Central de energia, Estufa, Comunicações, Armazém.
- Corredores ligam portas que se olham na mesma linha com o caminho livre; portas sem corredor viram
  saídas externas (com rampa).
- No jogo, 1 tile (4 m) = 1 célula da grade (escala 0,75). Telhados (`*_Telhado`) ficam ocultos
  para a vista em corte; os canteiros (`*_Batata_*`) são trocados pelo estágio do cultivo.
