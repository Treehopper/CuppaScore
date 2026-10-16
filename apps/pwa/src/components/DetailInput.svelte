<script lang="ts">
  import { t } from '../i18n/i18n.svelte';
  import { FLAVOUR_TAGS, PROFILE_ATTRS, WISHES } from '../lib/domain';
  import type { DetailState } from '../lib/logForm';
  import Icon from './Icon.svelte';

  /** Detail level extras (README §4.3 advanced): strength, profile + wish, flavour tags. */
  let { value = $bindable() }: { value: DetailState } = $props();
  const uid = $props.id();

  type Attr = (typeof PROFILE_ATTRS)[number];
  type Wish = (typeof WISHES)[number];
  const WISH_ICON = { more: 'up', justRight: 'equal', less: 'down' } as const;
  const SCALE = [1, 2, 3, 4, 5] as const;

  function setProfile(a: Attr, n: number): void {
    if (value.profile[a] === n) delete value.profile[a];
    else value.profile[a] = n;
  }

  function setWish(a: Attr, w: Wish): void {
    if (value.wish[a] === w) delete value.wish[a];
    else value.wish[a] = w;
  }

  function toggleTag(tag: (typeof FLAVOUR_TAGS)[number]): void {
    value.tags = value.tags.includes(tag) ? value.tags.filter((x) => x !== tag) : [...value.tags, tag];
  }
</script>

<div class="stack" data-testid="detail-input">
  <div class="field">
    <span id="{uid}-strength">{t('attr.strength')}</span>
    <div class="scale" role="radiogroup" aria-labelledby="{uid}-strength">
      {#each SCALE as n (n)}
        <button
          type="button"
          role="radio"
          aria-checked={value.strength === n}
          onclick={() => (value.strength = value.strength === n ? null : n)}>{n}</button
        >
      {/each}
    </div>
  </div>

  <div class="field">
    <span>{t('log.profile')}</span>
    <ul class="list profile">
      {#each PROFILE_ATTRS as a (a)}
        <li class="attr">
          <span class="name" id="{uid}-{a}">{t(`attr.${a}`)}</span>
          <div class="scale" role="radiogroup" aria-labelledby="{uid}-{a}">
            {#each SCALE as n (n)}
              <button
                type="button"
                role="radio"
                aria-label={`${t(`attr.${a}`)} ${n}`}
                aria-checked={value.profile[a] === n}
                onclick={() => setProfile(a, n)}>{n}</button
              >
            {/each}
          </div>
          <div class="wish" role="group" aria-label={t('log.wishFor', { attr: t(`attr.${a}`) })}>
            {#each WISHES as w (w)}
              <button
                type="button"
                class="btn-ghost"
                aria-label={t(`wish.${w}`)}
                aria-pressed={value.wish[a] === w}
                onclick={() => setWish(a, w)}><Icon name={WISH_ICON[w]} size={18} /></button
              >
            {/each}
          </div>
        </li>
      {/each}
    </ul>
  </div>

  <div class="field">
    <span id="{uid}-tags">{t('log.flavours')}</span>
    <div class="chips" role="group" aria-labelledby="{uid}-tags">
      {#each FLAVOUR_TAGS as tag (tag)}
        <button type="button" class="chip" aria-pressed={value.tags.includes(tag)} onclick={() => toggleTag(tag)}
          >{t(`flavour.${tag}`)}</button
        >
      {/each}
    </div>
  </div>
</div>

<style>
  .scale {
    display: flex;
    gap: 0.25rem;
  }
  .scale > button {
    flex: 1;
    min-width: 2.4rem;
    min-height: 2.4rem;
    padding: 0;
    font-variant-numeric: tabular-nums;
  }
  .scale > button[aria-checked='true'] {
    background: var(--accent);
    color: var(--on-accent);
    border-color: var(--accent);
  }
  .profile {
    gap: 0.6rem;
  }
  .attr {
    display: grid;
    grid-template-columns: 1fr auto;
    grid-template-areas: 'name wish' 'scale scale';
    gap: 0.25rem 0.5rem;
    align-items: center;
  }
  .attr .name {
    grid-area: name;
    font-size: 0.9rem;
  }
  .attr .scale {
    grid-area: scale;
  }
  .wish {
    grid-area: wish;
    display: flex;
    gap: 0.15rem;
  }
  .wish > button {
    min-width: 2.4rem;
    min-height: 2rem;
    padding: 0;
    color: var(--muted);
  }
  .wish > button[aria-pressed='true'] {
    color: var(--on-accent);
    background: var(--accent);
  }
</style>
