import { describe, expect, it } from 'vitest';
import { DeltaAccumulator, TrackpadGestures, accelerate, type GestureOutput } from './gestures';

function setup() {
  let now = 0;
  const events: string[] = [];
  let moved = { dx: 0, dy: 0 };
  let scrolled = 0;
  const out: GestureOutput = {
    move: (dx, dy) => {
      moved = { dx: moved.dx + dx, dy: moved.dy + dy };
    },
    click: (button) => events.push(`click ${button}`),
    scroll: (dy) => {
      scrolled += dy;
    },
  };
  const gestures = new TrackpadGestures(out, { tapMaxTravel: 10, tapMaxMs: 250 }, () => now);
  return {
    gestures,
    events,
    advance: (ms: number) => (now += ms),
    moved: () => moved,
    scrolled: () => scrolled,
  };
}

describe('TrackpadGestures', () => {
  it('un tap bref et immobile fait un clic gauche', () => {
    const t = setup();
    t.gestures.down(1, 100, 100);
    t.advance(80);
    t.gestures.move(1, 103, 101);
    t.gestures.up(1);
    expect(t.events).toEqual(['click left']);
  });

  it('un tap à deux doigts fait un clic droit', () => {
    const t = setup();
    t.gestures.down(1, 100, 100);
    t.gestures.down(2, 150, 100);
    t.advance(120);
    t.gestures.up(1);
    t.gestures.up(2);
    expect(t.events).toEqual(['click right']);
  });

  it('un glissement déplace le curseur sans cliquer', () => {
    const t = setup();
    t.gestures.down(1, 0, 0);
    t.gestures.move(1, 20, 0);
    t.gestures.move(1, 40, 10);
    t.gestures.up(1);
    expect(t.events).toEqual([]);
    expect(t.moved().dx).toBeGreaterThan(40);
    expect(t.moved().dy).toBeGreaterThan(0);
  });

  it('un appui long immobile ne clique pas', () => {
    const t = setup();
    t.gestures.down(1, 0, 0);
    t.advance(600);
    t.gestures.up(1);
    expect(t.events).toEqual([]);
  });

  it('deux doigts qui glissent font défiler, sans bouger le curseur', () => {
    const t = setup();
    t.gestures.down(1, 0, 0);
    t.gestures.down(2, 50, 0);
    t.gestures.move(1, 0, 30);
    t.gestures.move(2, 50, 30);
    t.gestures.up(1);
    // Le doigt restant ne doit pas déplacer le curseur.
    t.gestures.move(2, 80, 60);
    t.gestures.up(2);
    expect(t.scrolled()).toBe(30);
    expect(t.moved()).toEqual({ dx: 0, dy: 0 });
    expect(t.events).toEqual([]);
  });
});

describe('accelerate', () => {
  it('garde le sens et amplifie davantage les gestes rapides', () => {
    expect(accelerate(-2)).toBeLessThan(0);
    expect(accelerate(20) / 20).toBeGreaterThan(accelerate(2) / 2);
  });
});

describe('DeltaAccumulator', () => {
  it('n’émet que des pixels entiers et garde le reste', () => {
    const acc = new DeltaAccumulator();
    acc.add(0.6, -0.4);
    expect(acc.take()).toBeNull();
    acc.add(0.6, -0.8);
    expect(acc.take()).toEqual({ dx: 1, dy: -1 });
    acc.add(0.8, 0);
    expect(acc.take()).toEqual({ dx: 1, dy: 0 });
  });
});
