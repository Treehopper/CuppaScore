<script lang="ts">
  import { t } from '../i18n/i18n.svelte';
  import { prefs } from '../lib/prefs.svelte';
  import { DARK_THEMES, LIGHT_THEMES, THEMES, type ThemeChoice, type ThemeId } from '../themes/themes';

  const choices: ThemeChoice[] = ['system', ...THEMES];
</script>

<div class="stack" data-testid="theme-picker">
  <div class="swatches" role="radiogroup" aria-label={t('theme.label')}>
    {#each choices as c (c)}
      <button
        type="button"
        role="radio"
        class="swatch"
        aria-checked={prefs.value.theme === c}
        data-preview={c === 'system' ? undefined : c}
        onclick={() => prefs.set('theme', c)}
      >
        <span class="dot" aria-hidden="true"></span>
        {t(`theme.${c}`)}
      </button>
    {/each}
  </div>

  {#if prefs.value.theme === 'system'}
    <div class="row">
      <label class="field">
        <span>{t('theme.systemLight')}</span>
        <select
          value={prefs.value.systemLight}
          onchange={(e) => prefs.set('systemLight', e.currentTarget.value as ThemeId)}
        >
          {#each LIGHT_THEMES as th (th)}<option value={th}>{t(`theme.${th}`)}</option>{/each}
        </select>
      </label>
      <label class="field">
        <span>{t('theme.systemDark')}</span>
        <select value={prefs.value.systemDark} onchange={(e) => prefs.set('systemDark', e.currentTarget.value as ThemeId)}>
          {#each DARK_THEMES as th (th)}<option value={th}>{t(`theme.${th}`)}</option>{/each}
        </select>
      </label>
    </div>
  {/if}
</div>

<style>
  .swatches {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
    gap: 0.5rem;
  }
  .swatch {
    justify-content: flex-start;
    text-align: left;
  }
  .swatch[aria-checked='true'] {
    border: 2px solid var(--accent);
    font-weight: 600;
  }
  .dot {
    width: 1.1rem;
    height: 1.1rem;
    border-radius: 50%;
    border: 1px solid var(--border);
    background: conic-gradient(var(--bg) 0 50%, var(--accent) 0);
  }
  [data-preview='crema'] .dot {
    background: conic-gradient(#f7efe4 0 50%, #a0522d 0);
  }
  [data-preview='espresso'] .dot {
    background: conic-gradient(#1e1410 0 50%, #d4a373 0);
  }
  [data-preview='solarized-light'] .dot {
    background: conic-gradient(#fdf6e3 0 50%, #268bd2 0);
  }
  [data-preview='solarized-dark'] .dot {
    background: conic-gradient(#002b36 0 50%, #2aa198 0);
  }
</style>
