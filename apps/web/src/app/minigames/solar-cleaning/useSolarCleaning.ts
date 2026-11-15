import { guideProgress } from '../../../game/guide/events';
import { useEffect, useRef } from 'react';
import { BrushAudio } from './BrushAudio';
import { type BrushPoint, CleaningSurface } from './cleaningSurface';

const WIDTH = 650;
const HEIGHT = 396;
const RADIUS = 43;
const COLUMNS = 163;
const ROWS = 99;
const INITIAL_SWIPES = [
  {
    path: 'M160 97C227 158 202 212 258 254S374 297 338 354 275 387 311 430 434 466 423 574',
    width: 151,
  },
  { path: 'M149 195C182 236 175 293 205 328', width: 82 },
];

/** The dust is a single persistent bitmap; input never rerenders React or grows SVG paths. */
function paintDust(canvas: HTMLCanvasElement) {
  const scale = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(WIDTH * scale);
  canvas.height = Math.round(HEIGHT * scale);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D unavailable');
  context.scale(scale, scale);
  const gradient = context.createLinearGradient(0, 0, WIDTH * 0.7, HEIGHT);
  gradient.addColorStop(0, '#efb077');
  gradient.addColorStop(0.55, '#ce8252');
  gradient.addColorStop(1, '#aa573a');
  context.fillStyle = gradient;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  context.strokeStyle = '#8d594229';
  context.lineWidth = 2;
  context.beginPath();
  for (let x = 65; x < WIDTH; x += 65) {
    context.moveTo(x, 0);
    context.lineTo(x, HEIGHT);
  }
  for (let y = 64; y < HEIGHT; y += 66) {
    context.moveTo(0, y);
    context.lineTo(WIDTH, y);
  }
  context.stroke();
  // Seeded grains keep replay deterministic and avoid a repeating tiled texture.
  let seed = 147;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 1600; i++) {
    context.fillStyle = i % 3 ? '#f9cf9d66' : '#793d294d';
    context.beginPath();
    context.ellipse(
      random() * WIDTH,
      random() * HEIGHT,
      0.3 + random() * 1.7,
      0.3 + random(),
      random() * Math.PI,
      0,
      Math.PI * 2,
    );
    context.fill();
  }
  context.globalCompositeOperation = 'destination-out';
  context.save();
  context.translate(-146, -142);
  context.lineCap = 'round';
  context.strokeStyle = '#000';
  for (const swipe of INITIAL_SWIPES) {
    context.lineWidth = swipe.width;
    context.stroke(new Path2D(swipe.path));
  }
  context.restore();
  context.strokeStyle = '#000';
  context.fillStyle = '#000';
  context.lineWidth = RADIUS * 2;
  context.lineCap = 'round';
  context.lineJoin = 'round';

  // Read pixels once, at a tiny resolution, to match the real initial dust mask.
  const sample = document.createElement('canvas');
  sample.width = COLUMNS;
  sample.height = ROWS;
  const sampling = sample.getContext('2d', { willReadFrequently: true });
  if (!sampling) throw new Error('Canvas 2D unavailable');
  sampling.drawImage(canvas, 0, 0, COLUMNS, ROWS);
  const pixels = sampling.getImageData(0, 0, COLUMNS, ROWS).data;
  const coverage = new Uint8Array(COLUMNS * ROWS);
  for (let i = 0; i < coverage.length; i++) coverage[i] = (pixels[i * 4 + 3] ?? 0) > 127 ? 1 : 0;
  return { context, surface: new CleaningSurface(WIDTH, HEIGHT, COLUMNS, ROWS, coverage) };
}

type Sample = { clientX: number; clientY: number; down: boolean; start?: boolean };
type Particle = { x: number; y: number; dx: number; dy: number; born: number };

export function useSolarCleaning(onComplete: () => void) {
  const svg = useRef<SVGSVGElement>(null);
  const panel = useRef<SVGGElement>(null);
  const brush = useRef<SVGGElement>(null);
  const dust = useRef<HTMLCanvasElement>(null);
  const particles = useRef<SVGGElement>(null);

  useEffect(() => {
    const element = svg.current;
    const panelElement = panel.current;
    const brushElement = brush.current;
    const canvas = dust.current;
    const particleElements = particles.current?.children;
    if (!element || !panelElement || !brushElement || !canvas || !particleElements) return;
    const { context, surface } = paintDust(canvas);
    const sound = new BrushAudio();
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    let activePointer: number | null = null;
    let previous: BrushPoint | null = null;
    let position = { x: 660, y: 470 };
    let keyboardDown = false;
    let done = false;
    let frame = 0;
    let nextParticle = 0;
    let queue: Sample[] = [];
    const motes: (Particle | null)[] = Array.from({ length: particleElements.length }, () => null);

    const moveBrush = () => {
      brushElement.setAttribute(
        'transform',
        `translate(${position.x} ${position.y}) rotate(20) scale(.65) translate(0 -105)`,
      );
    };
    moveBrush();

    const clean = (from: BrushPoint, to: BrushPoint, now: number) => {
      if (done) return;
      const a = { x: from.x - 146, y: from.y - 142 };
      const b = { x: to.x - 146, y: to.y - 142 };
      context.beginPath();
      context.moveTo(a.x, a.y);
      // Canvas doesn't stroke a zero-length segment; a tap still cleans a full stamp.
      if (a.x === b.x && a.y === b.y) {
        context.arc(b.x, b.y, RADIUS, 0, Math.PI * 2);
        context.fill();
      } else {
        context.lineTo(b.x, b.y);
        context.stroke();
      }
      const removed = surface.sweep(a, b, RADIUS);
      if (removed) guideProgress();
      if (removed && (activePointer !== null || keyboardDown)) sound.contact();
      if (removed && !reducedMotion.matches) {
        for (let i = 0; i < 3; i++) {
          motes[nextParticle] = {
            x: to.x + (i - 1) * 14,
            y: to.y,
            dx: (i - 1) * 38,
            dy: -30 - i * 15,
            born: now,
          };
          nextParticle = (nextParticle + 1) % motes.length;
        }
      }
      if (surface.complete) {
        sound.stop();
        done = true;
        element.dataset.complete = 'true';
        onComplete();
      }
    };

    const render = (now: number) => {
      frame = 0;
      const matrix = queue.length ? panelElement.getScreenCTM()?.inverse() : null;
      if (matrix)
        for (const sample of queue) {
          const point = new DOMPoint(sample.clientX, sample.clientY).matrixTransform(matrix);
          position = { x: point.x, y: point.y };
          if (sample.start) previous = null;
          if (sample.down) clean(previous ?? position, position, now);
          previous = sample.down ? position : null;
        }
      queue = [];
      moveBrush();
      let animating = false;
      for (let i = 0; i < motes.length; i++) {
        const mote = motes[i];
        const circle = particleElements[i];
        if (!circle) continue;
        const age = mote ? (now - mote.born) / 1000 : 1;
        if (!mote || age >= 0.45 || reducedMotion.matches) {
          circle.setAttribute('opacity', '0');
          motes[i] = null;
          continue;
        }
        circle.setAttribute('cx', String(mote.x + mote.dx * age));
        circle.setAttribute('cy', String(mote.y + mote.dy * age + age * age * 22));
        circle.setAttribute('opacity', String((1 - age / 0.45) * 0.65));
        animating = true;
      }
      if (animating) frame = requestAnimationFrame(render);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(render);
    };
    const enqueue = (event: PointerEvent, start = false) => {
      const samples = event.getCoalescedEvents?.();
      for (const sample of samples?.length ? samples : [event]) {
        queue.push({
          clientX: sample.clientX,
          clientY: sample.clientY,
          down: activePointer !== null,
          start,
        });
        start = false;
      }
      // Pointer rates vary enormously. Bound pending work without dropping the endpoint.
      if (queue.length > 128) {
        const stride = Math.ceil((queue.length - 2) / 126);
        queue = queue.filter((_, i) => i === 0 || i === queue.length - 1 || i % stride === 0);
      }
      schedule();
    };
    const down = (event: PointerEvent) => {
      if (activePointer !== null || !event.isPrimary || event.button !== 0 || done) return;
      event.preventDefault();
      element.focus({ preventScroll: true });
      sound.unlock();
      activePointer = event.pointerId;
      element.setPointerCapture(event.pointerId);
      element.dataset.brushing = 'true';
      enqueue(event, true);
    };
    const move = (event: PointerEvent) => {
      if (!event.isPrimary || (activePointer !== null && activePointer !== event.pointerId)) return;
      enqueue(event);
    };
    const stop = () => {
      sound.stop();
      if (activePointer !== null && element.hasPointerCapture(activePointer))
        element.releasePointerCapture(activePointer);
      activePointer = null;
      keyboardDown = false;
      delete element.dataset.brushing;
    };
    const up = (event: PointerEvent) => {
      if (event.pointerId !== activePointer) return;
      enqueue(event);
      stop();
    };
    const cancel = (event: PointerEvent) => {
      if (event.pointerId === activePointer) stop();
    };
    const keyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        event.preventDefault();
        sound.unlock();
        if (!keyboardDown && !done) {
          keyboardDown = true;
          clean(position, position, performance.now());
          schedule();
        }
      }
      const direction = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
      }[event.key];
      if (!direction) return;
      event.preventDefault();
      const from = position;
      const inverse = panelElement.getScreenCTM()?.inverse();
      if (!inverse) return;
      const dx = (direction[0] ?? 0) * 24;
      const dy = (direction[1] ?? 0) * 24;
      position = {
        x: Math.max(146, Math.min(796, position.x + inverse.a * dx + inverse.c * dy)),
        y: Math.max(142, Math.min(538, position.y + inverse.b * dx + inverse.d * dy)),
      };
      if (keyboardDown) clean(from, position, performance.now());
      moveBrush();
      schedule();
    };
    const keyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') stop();
    };
    const visibility = () => {
      if (document.hidden) {
        stop();
        queue = [];
        cancelAnimationFrame(frame);
        frame = 0;
      }
    };
    element.addEventListener('pointerdown', down);
    element.addEventListener('pointermove', move);
    element.addEventListener('pointerup', up);
    element.addEventListener('pointercancel', cancel);
    element.addEventListener('lostpointercapture', cancel);
    element.addEventListener('keydown', keyDown);
    element.addEventListener('keyup', keyUp);
    element.addEventListener('blur', stop);
    window.addEventListener('blur', stop);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      element.removeEventListener('pointerdown', down);
      element.removeEventListener('pointermove', move);
      element.removeEventListener('pointerup', up);
      element.removeEventListener('pointercancel', cancel);
      element.removeEventListener('lostpointercapture', cancel);
      element.removeEventListener('keydown', keyDown);
      element.removeEventListener('keyup', keyUp);
      element.removeEventListener('blur', stop);
      window.removeEventListener('blur', stop);
      document.removeEventListener('visibilitychange', visibility);
      stop();
      cancelAnimationFrame(frame);
      sound.dispose();
    };
  }, [onComplete]);

  return { svg, panel, brush, dust, particles };
}
