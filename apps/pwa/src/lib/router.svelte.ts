import { parseHash, type Route } from './route';

class Router {
  current = $state<Route>(parseHash(typeof location === 'undefined' ? '' : location.hash));

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('hashchange', () => {
        this.current = parseHash(location.hash);
      });
    }
  }

  go(path: string, opts: { replace?: boolean } = {}): void {
    const hash = `#${path}`;
    if (opts.replace) {
      history.replaceState(history.state, '', hash);
      this.current = parseHash(hash);
    } else {
      location.hash = path;
    }
  }
}

export const router = new Router();

export function href(path: string): string {
  return `#${path}`;
}
