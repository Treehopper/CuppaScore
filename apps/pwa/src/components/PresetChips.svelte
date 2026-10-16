<script lang="ts">
  import type { PresetView } from '@cuplog/api';
  import { t } from '../i18n/i18n.svelte';
  import { api } from '../lib/api';
  import { showError } from '../lib/errors';
  import Icon from './Icon.svelte';

  /** The top presets as big one-tap chips, best first (README §4.5); the active one can be pinned. */
  let {
    presets,
    activeKey,
    label,
    onpick,
  }: {
    presets: PresetView[];
    activeKey: string | null;
    label: (p: PresetView) => string;
    onpick: (p: PresetView) => void;
  } = $props();

  async function togglePin(p: PresetView): Promise<void> {
    try {
      await api().setPresetPinned(p.preset.key, !p.preset.pinned);
    } catch (e) {
      showError(e);
    }
  }
</script>

{#if presets.length}
  <section aria-label={t('log.presets')}>
    <ul class="list presets">
      {#each presets as p (p.preset.key)}
        <li class="preset-row">
          <button
            type="button"
            class="preset"
            aria-pressed={p.preset.key === activeKey}
            onclick={() => onpick(p)}
            data-testid="preset-chip"
          >
            <span class="dot" aria-hidden="true"></span>
            <span class="name">{label(p)}</span>
          </button>
          {#if p.preset.key === activeKey || p.preset.pinned}
            <button
              type="button"
              class="btn-ghost icon-btn pin"
              class:on={p.preset.pinned}
              aria-label={p.preset.pinned ? t('log.unpin') : t('log.pin')}
              aria-pressed={p.preset.pinned}
              onclick={() => togglePin(p)}><Icon name="pin" size={20} /></button
            >
          {/if}
        </li>
      {/each}
    </ul>
  </section>
{/if}

<style>
  .presets {
    gap: 0.4rem;
  }
  .preset-row {
    display: flex;
    gap: 0.25rem;
    align-items: center;
  }
  .preset {
    flex: 1;
    justify-content: flex-start;
    text-align: left;
    min-height: 3rem;
    border-radius: var(--radius);
  }
  .preset[aria-pressed='true'] {
    border: 2px solid var(--accent);
    font-weight: 600;
  }
  .dot {
    flex-shrink: 0;
    width: 0.9rem;
    height: 0.9rem;
    border-radius: 50%;
    border: 2px solid var(--accent);
  }
  .preset[aria-pressed='true'] .dot {
    background: var(--accent);
  }
  .name {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .pin {
    color: var(--muted);
  }
  .pin.on {
    color: var(--accent);
  }
</style>
