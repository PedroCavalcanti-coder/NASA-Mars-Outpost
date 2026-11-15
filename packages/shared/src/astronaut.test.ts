import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  ACCESSORY_IDS,
  DEFAULT_SUIT,
  MAX_ACCESSORIES,
  normalizeSuit,
  randomSuit,
  SUIT_PRESETS,
} from './astronaut';
import { GAME_EMOTES } from './game';
import { DUO_GESTURE_IDS, DUO_GESTURES, duoPartnerPosition, EMOTE_ANIMATIONS } from './gestures';

describe('normalizeSuit', () => {
  it('trajes antigos (só cores) continuam válidos e ganham os campos novos', () => {
    const old = {
      version: 1,
      helmet: 'sky',
      vest: 'mint',
      suit: 'ice',
      gloves: 'graphite',
      boots: 'orange',
      backpack: 'station',
    };
    const s = normalizeSuit(old);
    expect(s.helmet).toBe('sky');
    expect(s.boots).toBe('orange');
    expect(s.accessories).toEqual([]);
    expect(s.marks).toEqual({});
  });

  it('descarta ids inválidos e duplicados e limita a quantidade', () => {
    const s = normalizeSuit({
      accessories: ['cracha', 'cracha', 'nada', 7, ...ACCESSORY_IDS],
      marks: { ombro: 3, peito: 99, capacete: 'x', mochila: 1.5, outro: 2 },
    });
    expect(s.accessories[0]).toBe('cracha');
    expect(new Set(s.accessories).size).toBe(s.accessories.length);
    expect(s.accessories.length).toBeLessThanOrEqual(MAX_ACCESSORIES);
    expect(s.marks).toEqual({ ombro: 3 });
  });

  it('lixo vira o traje padrão e não compartilha referências', () => {
    expect(normalizeSuit(null)).toEqual(DEFAULT_SUIT);
    expect(normalizeSuit({ accessories: 'x', marks: [1] })).toEqual(DEFAULT_SUIT);
    const a = normalizeSuit({});
    a.accessories.push('cracha');
    a.marks.peito = 2;
    expect(DEFAULT_SUIT.accessories).toEqual([]);
    expect(DEFAULT_SUIT.marks).toEqual({});
  });

  it('randomSuit e as predefinições são estáveis na normalização', () => {
    for (let i = 0; i < 20; i++) {
      const r = randomSuit();
      expect(normalizeSuit(r)).toEqual(r);
    }
    for (const p of SUIT_PRESETS) expect(normalizeSuit(p.suit)).toEqual(p.suit);
  });
});

/** Lê os nomes das animações direto do GLB (cabeçalho JSON do contêiner). */
function glbAnimationNames(): string[] {
  const path = fileURLToPath(new URL('../../../Assets/modelos/astronaut_v2.glb', import.meta.url));
  const buf = readFileSync(path);
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8')) as {
    animations?: { name: string }[];
  };
  return (json.animations ?? []).map((a) => a.name);
}

describe('EMOTE_ANIMATIONS', () => {
  const clips = glbAnimationNames();

  it('tem uma entrada por emoji, na mesma ordem (o servidor valida pelo índice)', () => {
    expect(EMOTE_ANIMATIONS.map((e) => e.emoji)).toEqual([...GAME_EMOTES]);
    expect(GAME_EMOTES.slice(0, 8)).toEqual(['😀', '😂', '👍', '👋', '❤️', '😮', '🎉', '🚀']);
  });

  it('todo clipe listado existe no GLB v2', () => {
    for (const e of EMOTE_ANIMATIONS) expect(clips, e.clip).toContain(e.clip);
    for (const id of DUO_GESTURE_IDS) expect(clips, id).toContain(DUO_GESTURES[id].clip);
    for (const base of ['Idle', 'Walk', 'Work']) expect(clips).toContain(base);
  });

  it('expressões ficam nas 8 células do atlas', () => {
    for (const e of EMOTE_ANIMATIONS) expect(e.expression).toBeGreaterThanOrEqual(0);
    for (const e of EMOTE_ANIMATIONS) expect(e.expression).toBeLessThan(8);
  });
});

describe('duoPartnerPosition', () => {
  it('fica à frente de quem convidou, na distância da tabela', () => {
    const p = duoPartnerPosition('handshake', 0, 0, 0);
    expect(p.z).toBeGreaterThan(0);
    expect(Math.hypot(p.x, p.z)).toBeCloseTo(Math.hypot(0.92, 0.78) * 0.75, 5);
  });
});
