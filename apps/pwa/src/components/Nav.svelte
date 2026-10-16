<script lang="ts">
  import { t } from '../i18n/i18n.svelte';
  import { href, router } from '../lib/router.svelte';
  import Icon, { type IconName } from './Icon.svelte';

  const ITEMS: { path: string; key: string; icon: IconName; match: string[] }[] = [
    { path: '/log', key: 'nav.log', icon: 'cup', match: ['', 'log', 'ratings', 'venues'] },
    { path: '/bags', key: 'nav.bags', icon: 'bag', match: ['bags', 'products'] },
    { path: '/stats', key: 'nav.stats', icon: 'chart', match: ['stats'] },
    { path: '/discover', key: 'nav.discover', icon: 'compass', match: ['discover'] },
    { path: '/settings', key: 'nav.settings', icon: 'gear', match: ['settings', 'about'] },
  ];

  const section = $derived(router.current.segments[0] ?? '');
</script>

<nav aria-label="CupLog">
  {#each ITEMS as item (item.path)}
    <a href={href(item.path)} aria-current={item.match.includes(section) ? 'page' : undefined}>
      <Icon name={item.icon} />
      <span>{t(item.key)}</span>
    </a>
  {/each}
</nav>

<style>
  nav {
    position: fixed;
    inset: auto 0 0 0;
    z-index: 10;
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    background: var(--surface);
    border-top: 1px solid var(--border);
    padding: 0 env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
  }
  a {
    display: grid;
    justify-items: center;
    gap: 0.1rem;
    padding: 0.45rem 0.1rem 0.4rem;
    min-height: var(--nav-h);
    color: var(--muted);
    text-decoration: none;
    font-size: 0.7rem;
    overflow: hidden;
  }
  a span {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  a[aria-current='page'] {
    color: var(--text);
    font-weight: 600;
  }
  a[aria-current='page'] :global(svg) {
    color: var(--accent);
  }
</style>
