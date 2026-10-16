import type { CupLogApi } from '@cuplog/api';
import { t } from '../i18n/i18n.svelte';
import { api } from './api';
import { showError } from './errors';
import { storagePersistence } from './storage.svelte';
import { toasts } from './toast.svelte';

export type LogCmd = Parameters<CupLogApi['logRating']>[0];

/** Saves a cup and offers Undo (README §9.2); returns false when saving failed. */
export async function logCup(cmd: LogCmd): Promise<boolean> {
  try {
    const r = await api().logRating(cmd);
    if (navigator.vibrate) navigator.vibrate(15);
    void storagePersistence.ensure();
    toasts.show(t('log.saved'), {
      action: {
        label: t('common.undo'),
        run: async () => {
          await api().deleteRating(r.id);
          toasts.show(t('log.undone'));
        },
      },
    });
    return true;
  } catch (e) {
    showError(e);
    return false;
  }
}
