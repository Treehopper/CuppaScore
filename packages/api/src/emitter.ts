import type { Topic, Unsubscribe } from './api';

export class TopicEmitter {
  readonly #subs = new Map<Topic, Set<() => void>>();

  subscribe(topic: Topic, cb: () => void): Unsubscribe {
    let set = this.#subs.get(topic);
    if (!set) this.#subs.set(topic, (set = new Set()));
    set.add(cb);
    return () => set.delete(cb);
  }

  emit(topics: readonly Topic[]): void {
    const seen = new Set<() => void>();
    for (const t of topics)
      for (const cb of this.#subs.get(t) ?? [])
        if (!seen.has(cb)) {
          seen.add(cb);
          cb();
        }
  }
}
