export type Collectible =
  "yeti" | "cat" | "ghost" | "spider" | "astronaut" | "bandit";
export type Phase =
  | "aiming"
  | "lowering"
  | "closing"
  | "lifting"
  | "carrying"
  | "releasing"
  | "returning";
export interface Prize {
  id: string;
  name: string;
  character?: Collectible;
  color?: string;
  image?: string;
  message?: string;
  url?: string;
}
export interface ClawOptions {
  container?: HTMLElement | string;
  placement?: "embedded" | "launcher";
  preset?: "cherry" | "midnight" | "mint";
  accent?: string;
  title?: string;
  difficulty?: "relaxed" | "challenging";
  prizeCount?: number;
  prizes?: Prize[];
  sound?: boolean;
  rememberCollection?: boolean;
  storageKey?: string;
  maxDPR?: number;
  maxFPS?: number;
  reducedMotion?: "respect" | "ignore";
  zIndex?: number;
  onWin?: (prize: Readonly<Prize>) => void;
}
export interface Config extends Required<
  Omit<ClawOptions, "container" | "onWin">
> {
  container?: HTMLElement | string;
  onWin?: (prize: Readonly<Prize>) => void;
}
export interface ClawState {
  phase: Phase;
  paused: boolean;
  ready: boolean;
  aim: { x: number; z: number };
  claw: { x: number; y: number; z: number };
  heldPrize: string | null;
  collection: string[];
  attempts: number;
  wins: number;
  prizes: { id: string; x: number; y: number; z: number }[];
}
export interface ClawEvent {
  type: "ready" | "phase" | "grab" | "slip" | "win" | "reset" | "error";
  phase: Phase;
  prize?: Readonly<Prize>;
  message?: string;
}
export interface ClawController {
  move(x: number, z: number): void;
  grab(): boolean;
  shuffle(): void;
  reset(): void;
  pause(): void;
  resume(): void;
  open(): void;
  close(): void;
  update(options: Partial<ClawOptions>): void;
  getState(): ClawState;
  on(listener: (event: ClawEvent) => void): () => void;
  destroy(): void;
}
