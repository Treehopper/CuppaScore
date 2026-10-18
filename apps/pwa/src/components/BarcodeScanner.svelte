<script lang="ts">
  import { normaliseGtin } from '@cuplog/api';
  import { onDestroy } from 'svelte';
  import { t } from '../i18n/i18n.svelte';
  import { cameraSupported, createDetector, type Detector } from '../lib/barcode';
  import Icon from './Icon.svelte';

  /** "Scan barcode" button + camera dialog (A2). Calls `onresult` with a validated GTIN. */
  let { onresult }: { onresult: (gtin: string) => void } = $props();

  let dialog = $state<HTMLDialogElement>();
  let video = $state<HTMLVideoElement>();
  let status = $state<'idle' | 'starting' | 'scanning' | 'denied' | 'failed'>('idle');
  let stream: MediaStream | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let detector: Detector | null = null;

  async function open(): Promise<void> {
    dialog?.showModal();
    status = 'starting';
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      if (!video) return stop();
      video.srcObject = stream;
      await video.play();
      detector ??= await createDetector();
      status = 'scanning';
      void tick();
    } catch (e) {
      status = e instanceof DOMException && e.name === 'NotAllowedError' ? 'denied' : 'failed';
      console.warn('barcode scanner', e);
      stopStream();
    }
  }

  async function tick(): Promise<void> {
    if (status !== 'scanning' || !video || !detector) return;
    try {
      for (const r of await detector.detect(video)) {
        const gtin = normaliseGtin(r.rawValue);
        if (gtin) {
          close();
          onresult(gtin);
          return;
        }
      }
    } catch {
      // a frame that can't be read yet (video not ready); keep trying
    }
    timer = setTimeout(tick, 200);
  }

  function stopStream(): void {
    clearTimeout(timer);
    for (const tr of stream?.getTracks() ?? []) tr.stop();
    stream = null;
  }

  function stop(): void {
    stopStream();
    status = 'idle';
  }

  function close(): void {
    stop();
    dialog?.close();
  }

  onDestroy(stopStream);
</script>

{#if cameraSupported()}
  <button type="button" class="scan" onclick={open} data-testid="scan-barcode">
    <Icon name="barcode" />{t('barcode.scan')}
  </button>
  <dialog bind:this={dialog} class="scanner" aria-labelledby="scan-title" onclose={stop}>
    <div class="stack">
      <div class="head">
        <h2 id="scan-title">{t('barcode.title')}</h2>
        <button type="button" class="btn-ghost icon-btn" onclick={close} aria-label={t('common.close')}><Icon name="close" /></button>
      </div>
      <video bind:this={video} playsinline muted></video>
      <p class="small muted" role="status">
        {#if status === 'denied'}{t('barcode.denied')}{:else if status === 'failed'}{t('barcode.failed')}{:else}{t('barcode.hint')}{/if}
      </p>
    </div>
  </dialog>
{/if}

<style>
  .scan {
    margin-bottom: var(--gap);
  }
  .scanner {
    width: min(100vw - 2rem, 28rem);
    padding: 1rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--text);
  }
  .scanner::backdrop {
    background: rgb(0 0 0 / 0.6);
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .head h2 {
    margin: 0;
  }
  video {
    width: 100%;
    aspect-ratio: 4 / 3;
    object-fit: cover;
    border-radius: var(--radius-sm);
    background: #000;
  }
</style>
