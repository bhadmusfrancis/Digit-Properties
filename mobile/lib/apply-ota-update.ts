import { useEffect } from 'react';
import * as Updates from 'expo-updates';

/** Download and apply a published EAS Update on launch (skipped in Expo Go / dev). */
export function useApplyOtaUpdate() {
  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) return;
    let cancelled = false;
    (async () => {
      try {
        const check = await Updates.checkForUpdateAsync();
        if (!check.isAvailable || cancelled) return;
        const fetched = await Updates.fetchUpdateAsync();
        if (fetched.isNew && !cancelled) {
          await Updates.reloadAsync();
        }
      } catch (e) {
        console.warn('[updates] check failed', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
}
