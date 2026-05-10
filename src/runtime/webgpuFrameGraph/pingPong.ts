export type PingPongPair<T> = {
  read: T;
  write: T;
};

export function swapPingPong<T>(pair: PingPongPair<T>): PingPongPair<T> {
  return { read: pair.write, write: pair.read };
}

