export type ListingUploadResult = { url: string; public_id: string; type: 'image' | 'video' };

/**
 * Upload to `/api/upload` with optional progress (XHR). Honors cookies for session.
 */
export function uploadListingMediaFile(
  file: File,
  options?: {
    onProgress?: (p: { loaded: number; total: number }) => void;
    signal?: AbortSignal;
  }
): Promise<ListingUploadResult> {
  return new Promise((resolve, reject) => {
    if (options?.signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }

    const xhr = new XMLHttpRequest();
    const fd = new FormData();
    fd.append('file', file);

    const onAbort = () => xhr.abort();

    options?.signal?.addEventListener('abort', onAbort);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) options?.onProgress?.({ loaded: e.loaded, total: e.total });
    };

    const cleanup = () => options?.signal?.removeEventListener('abort', onAbort);

    xhr.onload = () => {
      cleanup();
      let data: { url?: string; public_id?: string; type?: string; error?: string };
      try {
        data = JSON.parse(xhr.responseText || '{}') as typeof data;
      } catch {
        reject(new Error('Upload failed'));
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300 && data.url && data.public_id) {
        resolve({
          url: data.url,
          public_id: data.public_id,
          type: data.type === 'video' ? 'video' : 'image',
        });
        return;
      }
      reject(new Error(typeof data.error === 'string' ? data.error : 'Upload failed'));
    };

    xhr.onerror = () => {
      cleanup();
      reject(new Error('Network error'));
    };

    xhr.onabort = () => {
      cleanup();
      reject(new DOMException('Aborted', 'AbortError'));
    };

    xhr.open('POST', '/api/upload');
    xhr.send(fd);
  });
}
