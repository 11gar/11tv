import type { MouseButton, VolumeAction } from '@11tv/shared';
import koffi from 'koffi';
import type { Logger } from '../log';
import { NullInputDriver, type InputDriver } from './input-driver';

// Constantes de winuser.h
const INPUT_MOUSE = 0;
const INPUT_KEYBOARD = 1;
const MOUSEEVENTF_MOVE = 0x0001;
const MOUSEEVENTF_LEFTDOWN = 0x0002;
const MOUSEEVENTF_LEFTUP = 0x0004;
const MOUSEEVENTF_RIGHTDOWN = 0x0008;
const MOUSEEVENTF_RIGHTUP = 0x0010;
const MOUSEEVENTF_WHEEL = 0x0800;
const KEYEVENTF_KEYUP = 0x0002;
const KEYEVENTF_EXTENDEDKEY = 0x0001;

const VOLUME_KEYS: Record<VolumeAction, number> = {
  mute: 0xad, // VK_VOLUME_MUTE
  down: 0xae, // VK_VOLUME_DOWN
  up: 0xaf, // VK_VOLUME_UP
};

const BUTTON_FLAGS: Record<MouseButton, [down: number, up: number]> = {
  left: [MOUSEEVENTF_LEFTDOWN, MOUSEEVENTF_LEFTUP],
  right: [MOUSEEVENTF_RIGHTDOWN, MOUSEEVENTF_RIGHTUP],
};

interface MouseInput {
  dx: number;
  dy: number;
  mouseData: number;
  dwFlags: number;
}

interface KeyboardInput {
  wVk: number;
  dwFlags: number;
}

type SendFn = (input: { type: number; u: { mi?: object; ki?: object } }) => number;

function bindSendInput(): SendFn {
  const MOUSEINPUT = koffi.struct('MOUSEINPUT', {
    dx: 'long',
    dy: 'long',
    mouseData: 'uint32',
    dwFlags: 'uint32',
    time: 'uint32',
    dwExtraInfo: 'uintptr_t',
  });
  const KEYBDINPUT = koffi.struct('KEYBDINPUT', {
    wVk: 'uint16',
    wScan: 'uint16',
    dwFlags: 'uint32',
    time: 'uint32',
    dwExtraInfo: 'uintptr_t',
  });
  const HARDWAREINPUT = koffi.struct('HARDWAREINPUT', {
    uMsg: 'uint32',
    wParamL: 'uint16',
    wParamH: 'uint16',
  });
  const INPUT = koffi.struct('INPUT', {
    type: 'uint32',
    u: koffi.union('INPUT_UNION', { mi: MOUSEINPUT, ki: KEYBDINPUT, hi: HARDWAREINPUT }),
  });

  const user32 = koffi.load('user32.dll');
  const sendInput = user32.func(
    'uint32 __stdcall SendInput(uint32 cInputs, INPUT *pInputs, int cbSize)',
  );
  const size = koffi.sizeof(INPUT);
  return (input) => sendInput(1, input, size) as number;
}

/**
 * Souris et volume par SendInput (user32.dll), appelé via koffi : pas de compilation native.
 * Le serveur doit tourner dans la session de l'utilisateur (pas en service Windows).
 */
export class Win32InputDriver implements InputDriver {
  readonly available = true;

  constructor(
    private readonly send: SendFn,
    private readonly log: Logger,
  ) {}

  moveMouse(dx: number, dy: number): void {
    this.mouse({ dx, dy, mouseData: 0, dwFlags: MOUSEEVENTF_MOVE });
  }

  click(button: MouseButton): void {
    const [down, up] = BUTTON_FLAGS[button];
    this.mouse({ dx: 0, dy: 0, mouseData: 0, dwFlags: down });
    this.mouse({ dx: 0, dy: 0, mouseData: 0, dwFlags: up });
  }

  scroll(delta: number): void {
    // mouseData est un DWORD : une valeur négative s'écrit en complément à deux.
    this.mouse({ dx: 0, dy: 0, mouseData: Math.trunc(delta) >>> 0, dwFlags: MOUSEEVENTF_WHEEL });
  }

  volume(action: VolumeAction): void {
    const wVk = VOLUME_KEYS[action];
    this.keyboard({ wVk, dwFlags: KEYEVENTF_EXTENDEDKEY });
    this.keyboard({ wVk, dwFlags: KEYEVENTF_EXTENDEDKEY | KEYEVENTF_KEYUP });
  }

  private mouse(mi: MouseInput): void {
    this.dispatch({ type: INPUT_MOUSE, u: { mi: { ...mi, time: 0, dwExtraInfo: 0 } } });
  }

  private keyboard(ki: KeyboardInput): void {
    this.dispatch({
      type: INPUT_KEYBOARD,
      u: { ki: { ...ki, wScan: 0, time: 0, dwExtraInfo: 0 } },
    });
  }

  private dispatch(input: Parameters<SendFn>[0]): void {
    // 0 événement injecté : bloqué par l'UIPI (fenêtre au premier plan plus privilégiée)
    // ou session verrouillée.
    if (this.send(input) === 0) this.log.warn('SendInput a refusé l’événement');
  }
}

export function createInputDriver(log: Logger): InputDriver {
  if (process.platform !== 'win32') return new NullInputDriver();
  try {
    return new Win32InputDriver(bindSendInput(), log);
  } catch (err) {
    log.error({ err }, 'Pilote souris indisponible, trackpad et volume désactivés');
    return new NullInputDriver();
  }
}
