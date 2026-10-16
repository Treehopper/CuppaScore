<script lang="ts">
  import Icon from '../../components/Icon.svelte';
  import PageHeader from '../../components/PageHeader.svelte';
  import { t } from '../../i18n/i18n.svelte';
  import { api } from '../../lib/api';
  import { prefs, type LogMode } from '../../lib/prefs.svelte';
  import { query } from '../../lib/query.svelte';
  import { router } from '../../lib/router.svelte';
  import CafeLog from './CafeLog.svelte';
  import HomeLog from './HomeLog.svelte';

  // ?mode=home|cafe (manifest shortcuts, venue list) wins over the remembered mode
  const mode = $derived<LogMode>(
    router.current.query.mode === 'cafe' || router.current.query.mode === 'home'
      ? (router.current.query.mode as LogMode)
      : prefs.value.lastMode,
  );

  function setMode(m: LogMode): void {
    prefs.set('lastMode', m);
    if (router.current.query.mode) router.go('/log', { replace: true });
  }

  const settings = query(() => api().getSettings(), ['settings']);
  const defaultLevel = $derived(settings.data?.defaultLevel ?? 'stars');
</script>

<PageHeader title={t('log.title')}>
  {#snippet actions()}
    <a class="btn btn-ghost" href="#/ratings">{t('log.history')}</a>
  {/snippet}
</PageHeader>

<div class="stack">
  <div class="segmented" role="radiogroup" aria-label={t('log.mode')}>
    <button type="button" role="radio" aria-checked={mode === 'home'} onclick={() => setMode('home')}>
      <Icon name="home" size={20} />{t('source.home')}
    </button>
    <button type="button" role="radio" aria-checked={mode === 'cafe'} onclick={() => setMode('cafe')}>
      <Icon name="store" size={20} />{t('source.cafe')}
    </button>
  </div>

  {#if mode === 'cafe'}
    {#key router.current.query.venue}<CafeLog {defaultLevel} />{/key}
  {:else}
    <HomeLog {defaultLevel} />
  {/if}
</div>
