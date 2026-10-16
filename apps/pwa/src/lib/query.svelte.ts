import type { Topic } from '@cuplog/api';
import { api } from './api';

/**
 * Reactive API query: re-runs when reactive values read synchronously inside `fn` change, and
 * whenever one of `topics` is emitted after a command. Must be created during component init.
 */
export class Query<T> {
  data = $state<T | undefined>(undefined);
  error = $state<unknown>(undefined);
  loading = $state(true);
  #seq = 0;

  constructor(fn: () => Promise<T>, topics: readonly Topic[] = []) {
    $effect(() => {
      const run = (): void => {
        const id = ++this.#seq;
        this.loading = true;
        fn().then(
          (v) => {
            if (id !== this.#seq) return;
            this.data = v;
            this.error = undefined;
            this.loading = false;
          },
          (e: unknown) => {
            if (id !== this.#seq) return;
            this.error = e;
            this.loading = false;
          },
        );
      };
      run();
      const offs = topics.map((tp) => api().subscribe(tp, run));
      return () => {
        this.#seq++;
        for (const off of offs) off();
      };
    });
  }
}

export function query<T>(fn: () => Promise<T>, topics: readonly Topic[] = []): Query<T> {
  return new Query(fn, topics);
}
