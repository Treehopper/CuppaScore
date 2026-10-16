export interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'error';
  action?: { label: string; run: () => void | Promise<void> };
}

/**
 * Transient messages, e.g. "Saved · Undo" (README §9.2). One at a time: the newest replaces the
 * previous one, so an Undo always refers to the latest action and the layout reserves room for one.
 */
class Toasts {
  items = $state<Toast[]>([]);
  #next = 1;

  show(text: string, opts: { kind?: Toast['kind']; action?: Toast['action']; ms?: number } = {}): number {
    const id = this.#next++;
    this.items = [{ id, text, kind: opts.kind ?? 'info', action: opts.action }];
    setTimeout(() => this.dismiss(id), opts.ms ?? (opts.action ? 6000 : 3000));
    return id;
  }

  dismiss(id: number): void {
    this.items = this.items.filter((x) => x.id !== id);
  }
}

export const toasts = new Toasts();
