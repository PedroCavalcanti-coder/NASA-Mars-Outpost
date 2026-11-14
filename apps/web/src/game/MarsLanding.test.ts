import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { type LandingAudioEvent, MarsLanding } from './MarsLanding';

for (const reduced of [false, true]) {
  describe(`landing audio (reduced motion: ${reduced})`, () => {
    it('plays the parachute once during parachute deployment and stops descent at touchdown', () => {
      const events: LandingAudioEvent[] = [];
      const landing = new MarsLanding(new THREE.Group(), new THREE.Group(), (e) => events.push(e));
      const camera = new THREE.PerspectiveCamera();
      const duration = reduced ? 4 : 11;
      try {
        for (const progress of [0, 0.1, 0.28, 0.32])
          landing.update(progress * duration, camera, reduced);
        expect(events).toEqual(['falling']);
        landing.update(0.34 * duration, camera, reduced);
        landing.update(0.5 * duration, camera, reduced);
        expect(events).toEqual(['falling', 'parachute']);
        landing.update(0.83 * duration, camera, reduced);
        landing.update(duration, camera, reduced);
        expect(events).toEqual(['falling', 'parachute', 'touchdown', 'decompression']);
      } finally {
        landing.dispose();
      }
    });
    it('does not play falling or parachute audio when skipped to the ground', () => {
      const events: LandingAudioEvent[] = [];
      const landing = new MarsLanding(new THREE.Group(), new THREE.Group(), (e) => events.push(e));
      try {
        landing.update(12, new THREE.PerspectiveCamera(), reduced);
        expect(events).toEqual(['touchdown']);
      } finally {
        landing.dispose();
      }
    });
  });
}
