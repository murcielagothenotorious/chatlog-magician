import { createKumoToastManager } from '@cloudflare/kumo/components/toast';

// Module-scope manager shared between the React island (Toasty viewport)
// and legacy classic scripts, which dispatch via window.__kumoToast.
export const toastManager = createKumoToastManager();
