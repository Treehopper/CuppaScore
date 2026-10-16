<script lang="ts">
  import { t } from '../i18n/i18n.svelte';
  import { api } from '../lib/api';
  import { CAFE_MILKS, CUP_SIZES } from '../lib/domain';
  import type { CafeForm } from '../lib/logForm';
  import { query } from '../lib/query.svelte';

  /** Café "details ▾" (README §9.2): milk, size, bean (if known) and price. */
  let { form, onchange }: { form: CafeForm; onchange: (f: CafeForm) => void } = $props();

  const products = query(() => api().listProducts(), ['products']);
  const set = <K extends keyof CafeForm>(k: K, v: CafeForm[K]): void => onchange({ ...form, [k]: v });
</script>

<details class="disclosure" data-testid="cafe-details">
  <summary>{t('log.cafeDetails')}</summary>
  <div class="stack">
    <div class="row">
      <label class="field">
        <span>{t('brewField.milk')}</span>
        <select value={form.milk} onchange={(e) => set('milk', e.currentTarget.value as CafeForm['milk'])}>
          {#each CAFE_MILKS as m (m)}
            <option value={m}>{t(`milk.${m}`)}</option>
          {/each}
        </select>
      </label>
      <label class="field">
        <span>{t('log.size')}</span>
        <select value={form.size} onchange={(e) => set('size', e.currentTarget.value as CafeForm['size'])}>
          {#each CUP_SIZES as s (s)}
            <option value={s}>{t(`size.${s}`)}</option>
          {/each}
        </select>
      </label>
    </div>
    <label class="field">
      <span>{t('log.bean')}</span>
      <select value={form.bean} onchange={(e) => set('bean', e.currentTarget.value)}>
        <option value="unknown">{t('log.beanUnknown')}</option>
        <option value="house">{t('log.beanHouse')}</option>
        {#each products.data ?? [] as p (p.product.id)}
          <option value={p.product.id}>{p.product.roaster} – {p.product.name}</option>
        {/each}
      </select>
    </label>
    <label class="field">
      <span>{t('bag.priceEur')}</span>
      <input inputmode="decimal" value={form.price} oninput={(e) => set('price', e.currentTarget.value)} />
    </label>
  </div>
</details>
