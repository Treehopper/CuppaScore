<script lang="ts">
  import type { DomainSettingsDto } from '@cuplog/api';
  import LanguagePicker from '../components/LanguagePicker.svelte';
  import PageHeader from '../components/PageHeader.svelte';
  import ThemePicker from '../components/ThemePicker.svelte';
  import { fmtDateTime } from '../i18n/format';
  import { t } from '../i18n/i18n.svelte';
  import { api } from '../lib/api';
  import { BREW_METHODS, OUTLIER_METHODS, RATING_LEVELS } from '../lib/domain';
  import { showError } from '../lib/errors';
  import { query } from '../lib/query.svelte';

  const settings = query(() => api().getSettings(), ['settings']);

  async function save(patch: Partial<DomainSettingsDto>): Promise<void> {
    try {
      await api().updateSettings(patch);
    } catch (e) {
      showError(e);
    }
  }

  function toggleMethod(s: DomainSettingsDto, m: (typeof BREW_METHODS)[number], on: boolean): void {
    const next = on ? [...s.ownedMethods, m] : s.ownedMethods.filter((x) => x !== m);
    void save({ ownedMethods: BREW_METHODS.filter((x) => next.includes(x)) });
  }
</script>

<PageHeader title={t('settings.title')} />

<div class="stack">
  <section class="card stack" aria-labelledby="s-appearance">
    <h2 id="s-appearance">{t('settings.appearance')}</h2>
    <LanguagePicker showPseudo={import.meta.env.DEV || location.search.includes('pseudo')} />
    <ThemePicker />
  </section>

  {#if settings.data}
    {@const s = settings.data}
    <section class="card" aria-labelledby="s-brewing">
      <h2 id="s-brewing">{t('settings.brewing')}</h2>
      <fieldset>
        <legend class="label">{t('settings.ownedMethods')}</legend>
        <div class="methods">
          {#each BREW_METHODS as m (m)}
            <label class="check">
              <input
                type="checkbox"
                checked={s.ownedMethods.includes(m)}
                onchange={(e) => toggleMethod(s, m, e.currentTarget.checked)}
              />
              {t(`brew.${m}`)}
            </label>
          {/each}
        </div>
        <p class="small muted">{t('settings.ownedMethodsHint')}</p>
      </fieldset>

      <div class="field">
        <span id="default-level">{t('settings.defaultLevel')}</span>
        <div class="segmented" role="radiogroup" aria-labelledby="default-level">
          {#each RATING_LEVELS as l (l)}
            <button type="button" role="radio" aria-checked={s.defaultLevel === l} onclick={() => save({ defaultLevel: l })}>
              {t(`level.${l}`)}
            </button>
          {/each}
        </div>
      </div>
    </section>

    <details class="card">
      <summary><h2>{t('settings.advanced')}</h2></summary>
      <label class="field">
        <span>{t('settings.halfLife')}: <strong>{t('settings.halfLifeValue', { days: s.halfLifeDays })}</strong></span>
        <input
          type="range"
          min="7"
          max="365"
          step="1"
          value={s.halfLifeDays}
          onchange={(e) => save({ halfLifeDays: Number(e.currentTarget.value) })}
        />
      </label>
      <label class="field">
        <span>{t('settings.outlierMethod')}</span>
        <select value={s.outlierMethod} onchange={(e) => save({ outlierMethod: e.currentTarget.value as DomainSettingsDto['outlierMethod'] })}>
          {#each OUTLIER_METHODS as o (o)}<option value={o}>{t(`settings.outlier.${o}`)}</option>{/each}
        </select>
      </label>
      <fieldset>
        <legend class="label">{t('settings.weights')}</legend>
        <div class="row">
          {#each RATING_LEVELS as l (l)}
            <label class="field">
              <span>{t(`level.${l}`)}</span>
              <input
                type="number"
                inputmode="decimal"
                min="0"
                max="5"
                step="0.1"
                value={s.confidence[l]}
                onchange={(e) => {
                  const v = Number(e.currentTarget.value);
                  if (Number.isFinite(v)) void save({ confidence: { ...s.confidence, [l]: v } });
                }}
              />
            </label>
          {/each}
        </div>
      </fieldset>
    </details>
  {/if}

  <section class="card" aria-labelledby="s-about" data-testid="about">
    <h2 id="s-about">{t('settings.about')}</h2>
    <p>{t('settings.version', { version: __APP_VERSION__.slice(0, 12) })}</p>
    <p class="muted small">{t('settings.built', { date: fmtDateTime(__BUILD_TIME__) })}</p>
  </section>
</div>

<style>
  fieldset {
    border: none;
    padding: 0;
    margin: 0 0 var(--gap);
  }
  .methods {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(8.5rem, 1fr));
    column-gap: 0.75rem;
  }
  summary {
    cursor: pointer;
    list-style-position: inside;
  }
  summary h2 {
    display: inline;
  }
  details[open] summary {
    margin-bottom: var(--gap);
  }
</style>
