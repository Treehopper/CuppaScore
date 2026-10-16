<script lang="ts">
  import PageHeader from '../components/PageHeader.svelte';
  import { t } from '../i18n/i18n.svelte';
</script>

<PageHeader title={t('page.notFound')} />
<a href="#/log">{t('nav.log')}</a>
