// @vitest-environment happy-dom
import { act, Suspense, useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const calls: string[] = [];
vi.mock('../../store/gameplay', () => ({
  gameplayCommand: vi.fn(async (payload: { type: string }) => {
    calls.push(payload.type);
    return {
      ok: true,
      operationId: '1',
      generation: 'g',
      revision: 1,
      attempt: payload.type === 'start' ? { id: 'att-1', seq: 0 } : undefined,
    };
  }),
}));
// minigame que conclui e fecha no mesmo instante (como o console, o MOXIE, a água…)
vi.mock('./missions/StationConsoleGame', () => ({
  default: ({ onComplete, onClose }: { onComplete: (r: { quality: number }) => void; onClose: () => void }) => {
    useEffect(() => {
      onComplete({ quality: 1 });
      onClose();
    }, [onComplete, onClose]);
    return null;
  },
}));

import ServerMinigame from './ServerMinigame';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Harness({ onComplete }: { onComplete: () => void }) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <Suspense fallback={null}>
      <ServerMinigame
        request={{ kind: 'station', mission: 'lab_analysis', title: 'Lab', hint: '' }}
        viewer={null}
        onClose={() => setOpen(false)}
        onComplete={onComplete}
      />
    </Suspense>
  );
}

describe('ServerMinigame', () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    calls.length = 0;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('minigame que fecha logo após concluir NÃO cancela a tarefa (a missão é registrada)', async () => {
    const onComplete = vi.fn();
    await act(async () => {
      root.render(<Harness onComplete={onComplete} />);
    });
    for (let i = 0; i < 20 && !onComplete.mock.calls.length; i++)
      await act(async () => {
        await new Promise((r) => setTimeout(r, 10));
      });
    expect(calls).toEqual(['start', 'actions', 'finish']);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
