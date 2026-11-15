import type { GameplayState } from '@mars/shared';
import * as THREE from 'three';
import { chime } from '../../lib/chime';
import { gameplayCommand } from '../../store/gameplay';
import type { AstronautActor } from '../AstronautActor';
import { ExpeditionFx } from './ExpeditionFx';
import { resetExpedition, useExpedition } from './store';

/** O que o controlador precisa do visualizador (assim o BaseViewer não conhece os detalhes). */
export interface ExpeditionHost {
  scene: THREE.Scene;
  camera: THREE.Camera;
  /** estado do jogo e id do jogador local (`null` fora de uma sala) */
  gameplay(): GameplayState | null | undefined;
  selfId(): string | undefined;
  rover(): { position: THREE.Vector3; heading: number } | null;
  remotePosition(id: string): THREE.Vector3 | null;
  groundY(x: number, z: number): number;
  notify(message: string, kind: 'ok' | 'error' | 'info'): void;
  fade(opacity: number, ms: number): void;
  /** a câmera deve pular direto para o novo ponto (teletransporte) */
  snapCamera(): void;
  /** mostra/esconde a base e tudo dela */
  setBaseVisible(visible: boolean): void;
  /** recalcula céu e luz (ao sair da neblina) */
  refreshAtmosphere(): void;
}

/** Expedição com o rover no cliente: neblina, radar, pegar a pedra, guardá-la e voltar. */
export class ExpeditionController {
  private fx: ExpeditionFx | null = null;
  private id: string | null = null;
  private member = false;
  private pickAt = 0;
  private pickHold = 0;
  private beepAt = 0;
  private hudAt = 0;

  constructor(private readonly host: ExpeditionHost) {}

  /** O jogador local está numa expedição agora? */
  get active() {
    return this.member;
  }

  update(dt: number, local: AstronautActor | null) {
    const host = this.host;
    const x = host.gameplay()?.expedition ?? null;
    const selfId = host.selfId();
    const member = Boolean(x && selfId && x.members.includes(selfId));
    const id = x?.id ?? null;
    if (id !== this.id || member !== this.member) {
      const was = this.member;
      this.id = id;
      this.member = member;
      if (member) this.enter();
      else if (was) this.leave();
    }
    const rover = host.rover();
    if (!x || !member || !selfId || !rover || !this.fx?.isActive) return;
    const onFoot = Boolean(local?.isRevealed && !local.inVehicle);
    this.fx.update(rover.position, rover.heading, onFoot ? local!.position : null);
    this.fx.syncRocks(
      x.rocks,
      (px, pz) => host.groundY(px, pz),
      (pid) => (pid === selfId ? local?.position : host.remotePosition(pid)) ?? null,
      performance.now() / 1000,
    );
    const now = performance.now();
    const mine = x.rocks.findIndex((r) => r.by === selfId && !r.loaded);
    const pickProgress = this.handlePickup(dt, now, x.rocks, mine, onFoot, local, rover.position);
    this.beep(now, x.rocks, mine, onFoot ? local!.position : rover.position, rover.position);
    // dados do radar e do relógio (10 vezes por segundo bastam)
    if (pickProgress > 0 || useExpedition.getState().pick > 0) useExpedition.setState({ pick: pickProgress });
    if (now - this.hudAt < 100) return;
    this.hudAt = now;
    const dir = new THREE.Vector3();
    host.camera.getWorldDirection(dir);
    const pos = onFoot ? local!.position : rover.position;
    useExpedition.setState({
      active: true,
      leftMs: Math.max(0, x.deadline - (host.gameplay()?.interactionMs ?? 0)),
      stamp: now,
      total: x.rocks.length,
      loaded: x.rocks.filter((r) => r.loaded).length,
      carrying: mine >= 0,
      inCar: !onFoot,
      me: { x: pos.x, z: pos.z, yaw: Math.atan2(dir.x, dir.z) },
      car: { x: rover.position.x, z: rover.position.z },
      rocks: x.rocks.filter((r) => !r.loaded).map((r) => ({ x: r.x, z: r.z, carried: Boolean(r.by) })),
    });
  }

  /** Pegar: ficar parado perto da pedra enche um círculo. Guardar: entrar no rover com ela. */
  private handlePickup(
    dt: number,
    now: number,
    rocks: readonly { x: number; z: number; by: string | null; loaded: boolean }[],
    mine: number,
    onFoot: boolean,
    local: AstronautActor | null,
    car: THREE.Vector3,
  ) {
    let progress = 0;
    if (onFoot && local && mine < 0) {
      const i = rocks.findIndex(
        (r) => !r.by && !r.loaded && Math.hypot(r.x - local.position.x, r.z - local.position.z) < 2.4,
      );
      if (i >= 0 && local.motion === 'idle') {
        this.pickHold += dt;
        progress = Math.min(1, this.pickHold / 1.4);
        if (progress >= 1 && now - this.pickAt > 900) {
          this.pickAt = now;
          this.pickHold = 0;
          void gameplayCommand({ type: 'expedition', op: 'pick', rock: i }).then((res) => {
            if (res.ok) this.host.notify('🪨 Pedra na mão! Entre no rover para guardá-la (você anda mais devagar).', 'ok');
            else this.host.notify(res.error, 'error');
          });
        }
      } else this.pickHold = 0;
    } else this.pickHold = 0;
    if (!onFoot && mine >= 0 && now - this.pickAt > 900) {
      this.pickAt = now;
      void gameplayCommand({ type: 'expedition', op: 'load' }).then((res) => {
        if (res.ok) this.host.notify('✅ Pedra guardada no rover!', 'ok');
        else this.host.notify(res.error, 'error');
      });
    }
    void car;
    return progress;
  }

  /** Bip do radar: quanto mais perto do alvo (pedra, ou o rover com a pedra na mão), mais rápido. */
  private beep(
    now: number,
    rocks: readonly { x: number; z: number; by: string | null; loaded: boolean }[],
    mine: number,
    here: THREE.Vector3,
    car: THREE.Vector3,
  ) {
    let best = Number.POSITIVE_INFINITY;
    if (mine >= 0) best = Math.hypot(car.x - here.x, car.z - here.z);
    else for (const r of rocks) if (!r.by && !r.loaded) best = Math.min(best, Math.hypot(r.x - here.x, r.z - here.z));
    if (Number.isFinite(best) && now - this.beepAt > Math.min(2200, Math.max(250, best * 30))) {
      this.beepAt = now;
      chime([best < 8 ? 1320 : 880], 0, 'sine', 0.05);
    }
  }

  private enter() {
    const host = this.host;
    this.fx ??= new ExpeditionFx(host.scene);
    host.snapCamera();
    // um clarão preto cobre o "teletransporte" para a região coberta de neblina
    host.fade(1, 220);
    window.setTimeout(() => {
      this.fx?.enable();
      host.setBaseVisible(false);
      host.fade(0, 900);
    }, 450);
    host.notify('🌫️ Neblina! Use o radar 📡 para achar 3 pedras 🪨 antes que o tempo acabe.', 'ok');
  }

  private leave() {
    const host = this.host;
    host.snapCamera();
    host.fade(1, 220);
    window.setTimeout(() => {
      this.fx?.disable();
      host.setBaseVisible(true);
      host.refreshAtmosphere();
      resetExpedition();
      host.fade(0, 900);
    }, 450);
    host.notify('🛰️ Voltando para a base…', 'info');
  }

  dispose() {
    this.fx?.dispose();
    resetExpedition();
  }
}
