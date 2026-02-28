'use client';

import { useRef, useState } from 'react';

type TrendImageUploadProps = {
  imageUrl: string;
  onImageUrlChange: (url: string) => void;
  disabled?: boolean;
};

/** Single image upload to Cloudinary (folder: trends). Use for trend post featured image. */
export function TrendImageUpload({ imageUrl, onImageUrlChange, disabled }: TrendImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError('');
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('folder', 'trends');
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      const data = await res.json();
      if (data.url) {
        onImageUrlChange(data.url);
      } else {
        setUploadError(data.error || 'Upload failed');
      }
    } catch {
      setUploadError('Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  const isCloudinary = imageUrl.includes('res.cloudinary.com');

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">Featured image (Cloudinary)</label>
      <p className="text-xs text-gray-500">Upload a content-relevant image. It will be stored on Cloudinary for consistent delivery.</p>
      {imageUrl ? (
        <div className="flex flex-wrap items-start gap-4">
          <div className="relative h-32 w-48 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
            <img src={imageUrl} alt="Preview" className="h-full w-full object-cover" />
          </div>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => onImageUrlChange('')}
              disabled={disabled}
              className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Remove image
            </button>
            {!disabled && (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className="rounded border border-primary-300 bg-primary-50 px-3 py-1.5 text-sm text-primary-700 hover:bg-primary-100 disabled:opacity-50"
              >
                {uploading ? 'Uploading…' : 'Replace image'}
              </button>
            )}
          </div>
          {!isCloudinary && imageUrl && (
            <p className="text-xs text-amber-700">This URL is not from Cloudinary. For uniform media, upload a new image above.</p>
          )}
        </div>
      ) : (
        <div>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={onFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || uploading}
            className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm font-medium text-gray-600 hover:border-primary-400 hover:bg-primary-50/50 hover:text-primary-700 disabled:opacity-50"
          >
            {uploading ? 'Uploading…' : 'Upload image (JPEG, PNG, WebP — max 10MB)'}
          </button>
        </div>
      )}
      {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}
    </div>
  );
}
