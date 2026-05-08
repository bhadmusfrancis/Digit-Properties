/**
 * Tiny client-side helper that lazily injects Paystack's inline checkout script
 * (`https://js.paystack.co/v1/inline.js`) and resumes a server-initialised
 * transaction by `accessCode`. Keeps the user on the current page.
 */

type PaystackPopAPI = {
  resumeTransaction: (
    accessCode: string,
    handlers?: {
      onSuccess?: (response: { reference: string; transaction?: string; status?: string }) => void;
      onCancel?: () => void;
      onError?: (err: { message?: string }) => void;
    }
  ) => void;
};

declare global {
  interface Window {
    PaystackPop?: PaystackPopAPI;
  }
}

let scriptPromise: Promise<PaystackPopAPI> | null = null;

function loadPaystackScript(): Promise<PaystackPopAPI> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Paystack inline can only run in the browser'));
  }
  if (window.PaystackPop) return Promise.resolve(window.PaystackPop);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<PaystackPopAPI>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-paystack-inline]');
    const onReady = () => {
      if (window.PaystackPop) resolve(window.PaystackPop);
      else reject(new Error('Paystack inline failed to initialise'));
    };
    if (existing) {
      if (window.PaystackPop) {
        resolve(window.PaystackPop);
        return;
      }
      existing.addEventListener('load', onReady, { once: true });
      existing.addEventListener('error', () => reject(new Error('Paystack script failed to load')), { once: true });
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://js.paystack.co/v1/inline.js';
    s.async = true;
    s.defer = true;
    s.dataset.paystackInline = '1';
    s.addEventListener('load', onReady, { once: true });
    s.addEventListener('error', () => {
      scriptPromise = null;
      reject(new Error('Paystack script failed to load'));
    }, { once: true });
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export type ResumeResult =
  | { status: 'success'; reference: string }
  | { status: 'cancel' }
  | { status: 'error'; message: string };

/** Resume an existing Paystack transaction (created via /transaction/initialize) inline. */
export async function resumePaystackInline(accessCode: string): Promise<ResumeResult> {
  const pop = await loadPaystackScript();
  return new Promise<ResumeResult>((resolve) => {
    let settled = false;
    const settle = (r: ResumeResult) => {
      if (!settled) {
        settled = true;
        resolve(r);
      }
    };
    try {
      pop.resumeTransaction(accessCode, {
        onSuccess: (resp) => settle({ status: 'success', reference: resp.reference }),
        onCancel: () => settle({ status: 'cancel' }),
        onError: (err) => settle({ status: 'error', message: err?.message || 'Payment error' }),
      });
    } catch (e) {
      settle({ status: 'error', message: e instanceof Error ? e.message : 'Failed to launch checkout' });
    }
  });
}
