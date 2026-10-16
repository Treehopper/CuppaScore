<script lang="ts">
  import PageHeader from '../components/PageHeader.svelte';
  import { t } from '../i18n/i18n.svelte';

  let { title }: { title: string } = $props();
</script>

<PageHeader {title} />
<p class="muted">{t('page.comingSoon')}</p>
