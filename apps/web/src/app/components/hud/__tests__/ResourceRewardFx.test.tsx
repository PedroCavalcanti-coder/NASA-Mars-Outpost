// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMission } from '../../../../store/mission';
import { ResourceRewardFx } from '../ResourceRewardFx';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('ResourceRewardFx', () => {
  let host: HTMLDivElement;
  let root: Root;
  const cancel = vi.fn();
  const animate = vi.fn(() => ({ cancel, onfinish: null }));

  beforeEach(() => {
    vi.useFakeTimers();
    animate.mockClear();
    cancel.mockClear();
    vi.spyOn(Element.prototype, 'animate').mockImplementation(animate as unknown as Element['animate']);
    useMission.getState().start(1);
    host = document.createElement('div');
    host.innerHTML = '<div data-resource-gauge="supplies"><svg class="hud-resource-gauge__icon"></svg></div>';
    document.body.appendChild(host);
    const mount = document.createElement('div');
    host.appendChild(mount);
    root = createRoot(mount);
    act(() => root.render(<ResourceRewardFx viewer={null} />));
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  const reward = (supplies: number) => useMission.getState().run({
    type: 'reward', tone: 'good', title: 'Colheita', text: 'Colheita concluída.', deltas: { supplies },
  });

  it('envia vários ícones ao anel e mostra o ganho real na chegada, respeitando o limite', () => {
    const { state } = useMission.getState();
    useMission.setState({ state: {
      ...state,
      resources: { ...state.resources, supplies: { value: 98, max: 100 } },
    } });
    reward(6);
    expect(document.querySelectorAll('.resource-reward-fx__icon')).toHaveLength(5);
    expect(document.querySelector('.resource-reward-fx__amount')).toBeNull();
    const options = (animate.mock.calls as unknown as [Keyframe[], KeyframeAnimationOptions][])[0]?.[1];
    expect(options?.easing).toBe('cubic-bezier(0.55, 0, 1, 0.45)');
    vi.advanceTimersByTime(1000);
    expect(document.querySelector('.resource-reward-fx__amount')?.textContent).toBe('+2');
  });

  it('ignora custos, recursos cheios e atualizações que não são recompensas de tasks', () => {
    reward(-2);
    const { state } = useMission.getState();
    useMission.setState({ state: {
      ...state,
      resources: { ...state.resources, supplies: { value: 100, max: 100 } },
    } });
    reward(6);
    useMission.setState({ feedback: { key: 999, deltas: { supplies: 5 } } });
    expect(animate).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('preserva recompensas consecutivas e limpa efeitos e timers ao reiniciar', () => {
    const { state } = useMission.getState();
    useMission.setState({ state: {
      ...state,
      resources: { ...state.resources, supplies: { value: 20, max: 100 } },
    } });
    reward(6);
    reward(6);
    expect(document.querySelectorAll('.resource-reward-fx__icon')).toHaveLength(12);
    useMission.getState().start(2);
    expect(document.querySelectorAll('.resource-reward-fx__icon')).toHaveLength(0);
    expect(cancel).toHaveBeenCalledTimes(12);
    expect(vi.getTimerCount()).toBe(0);
  });
});
