export type ListingUploadResult = { url: string; public_id: string; type: 'image' | 'video' };

type SignatureResponse = {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  resourceType: 'image' | 'video';
};

/**
 * Listing photos/videos upload directly to Cloudinary with a server-issued signature.
 * Avoids ~4.5MB serverless request body limits (e.g. Vercel) while keeping auth + size checks on `/api/upload/signature`.
 */
export function uploadListingMediaFile(
  file: File,
  options?: {
    onProgress?: (p: { loaded: number; total: number }) => void;
    signal?: AbortSignal;
    /** Cloudinary folder; default `listings`. */
    folder?: string;
  }
): Promise<ListingUploadResult> {
  return new Promise((resolve, reject) => {
    if (options?.signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }

    const folder = options?.folder ?? 'listings';

    (async () => {
      let sig: SignatureResponse;
      try {
        const sigRes = await fetch('/api/upload/signature', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            folder,
            fileName: file.name,
            mimeType: file.type || '',
            fileSize: file.size,
          }),
          signal: options?.signal,
        });

        let sigJson: (SignatureResponse & { error?: string }) | Record<string, unknown> = {};
        try {
          sigJson = (await sigRes.json()) as typeof sigJson;
        } catch {
          /* empty */
        }

        if (!sigRes.ok) {
          const err =
            typeof (sigJson as { error?: string }).error === 'string'
              ? (sigJson as { error: string }).error
              : 'Upload not allowed';
          throw new Error(err);
        }

        sig = sigJson as SignatureResponse;
        if (
          !sig.cloudName ||
          !sig.apiKey ||
          sig.timestamp == null ||
          !sig.signature ||
          !sig.folder ||
          !sig.resourceType
        ) {
          throw new Error('Upload not configured');
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') {
          reject(e);
          return;
        }
        reject(e instanceof Error ? e : new Error('Upload failed'));
        return;
      }

      const uploadUrl = `https://api.cloudinary.com/v1_1/${encodeURIComponent(sig.cloudName)}/${sig.resourceType}/upload`;

      const xhr = new XMLHttpRequest();
      const fd = new FormData();
      fd.append('file', file);
      fd.append('api_key', sig.apiKey);
      fd.append('timestamp', String(sig.timestamp));
      fd.append('signature', sig.signature);
      fd.append('folder', sig.folder);

      const onAbort = () => xhr.abort();
      options?.signal?.addEventListener('abort', onAbort);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) options?.onProgress?.({ loaded: e.loaded, total: e.total });
      };

      xhr.onload = () => {
        options?.signal?.removeEventListener('abort', onAbort);
        type CloudinaryOk = { secure_url?: string; public_id?: string; resource_type?: string };
        type CloudinaryErr = { error?: { message?: string } };
        let data: CloudinaryOk & CloudinaryErr;
        try {
          data = JSON.parse(xhr.responseText || '{}') as CloudinaryOk & CloudinaryErr;
        } catch {
          reject(
            new Error(
              !xhr.responseText?.trim()
                ? 'Upload failed (empty response from Cloudinary).'
                : 'Upload failed (invalid response from Cloudinary).'
            )
          );
          return;
        }

        if (xhr.status >= 200 && xhr.status < 300 && data.secure_url && data.public_id) {
          const kind: 'image' | 'video' =
            data.resource_type === 'video' || sig.resourceType === 'video' ? 'video' : 'image';
          resolve({
            url: data.secure_url,
            public_id: data.public_id,
            type: kind,
          });
          return;
        }

        const cloudMsg =
          typeof data.error?.message === 'string' ? data.error.message : `HTTP ${xhr.status}`;
        reject(new Error(cloudMsg));
      };

      xhr.onerror = () => {
        options?.signal?.removeEventListener('abort', onAbort);
        reject(new Error('Network error'));
      };

      xhr.onabort = () => {
        options?.signal?.removeEventListener('abort', onAbort);
        reject(new DOMException('Aborted', 'AbortError'));
      };

      xhr.open('POST', uploadUrl);
      xhr.send(fd);
    })();
  });
}
