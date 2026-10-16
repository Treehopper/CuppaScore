<script lang="ts">
  import { LOCALES, PSEUDO_LOCALE } from '../i18n/core';
  import { t } from '../i18n/i18n.svelte';
  import { prefs } from '../lib/prefs.svelte';

  let { showPseudo = false }: { showPseudo?: boolean } = $props();

  const options = $derived([...LOCALES, ...(showPseudo ? [PSEUDO_LOCALE] : [])]);
</script>

<label class="field">
  <span>{t('language.label')}</span>
  <select
    data-testid="language-picker"
    value={prefs.value.language ?? ''}
    onchange={(e) => prefs.set('language', e.currentTarget.value || null)}
  >
    <option value="">{t('language.auto')}</option>
    {#each options as l (l)}
      <option value={l}>{t(`language.${l}`)}</option>
    {/each}
  </select>
</label>
