'use client';

import { useRef, useEffect, useState, useCallback } from 'react';

/** Aspect ratio of typical ID card (e.g. 85.6 × 53.98 mm ≈ 1.586). */
const ID_ASPECT = 1.58;
/** Frame width as fraction of video width (leave margin). */
const FRAME_WIDTH_RATIO = 0.88;

type Props = {
  side: 'front' | 'back';
  onCapture: (file: File) => void;
  onCancel: () => void;
};

export function IdDocumentCamera({ side, onCapture, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    setCameraError(null);
    const constraints: MediaStreamConstraints = {
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    };
    navigator.mediaDevices
      .getUserMedia(constraints)
      .catch(() =>
        navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        })
      )
      .then((stream) => {
        if (!mounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch((err) => {
        if (!mounted) return;
        if (err?.name === 'NotAllowedError') {
          setCameraError('Camera access was denied. Please allow camera to capture your ID.');
        } else if (err?.name === 'NotFoundError') {
          setCameraError('No camera found. Please use a device with a camera.');
        } else {
          setCameraError(err?.message || 'Could not start camera. Please try again.');
        }
      });
    return () => {
      mounted = false;
      stopCamera();
    };
  }, [stopCamera]);

  function capture() {
    const video = videoRef.current;
    if (!video || !streamRef.current || !video.videoWidth || capturing) return;

    setCapturing(true);
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const frameW = Math.floor(vw * FRAME_WIDTH_RATIO);
    const frameH = Math.floor(frameW / ID_ASPECT);
    const x = Math.floor((vw - frameW) / 2);
    const y = Math.floor((vh - frameH) / 2);

    const canvas = document.createElement('canvas');
    canvas.width = frameW;
    canvas.height = frameH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setCapturing(false);
      return;
    }
    ctx.drawImage(video, x, y, frameW, frameH, 0, 0, frameW, frameH);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setCapturing(false);
          return;
        }
        const file = new File(
          [blob],
          `id-${side}-${Date.now()}.jpg`,
          { type: 'image/jpeg' }
        );
        stopCamera();
        onCapture(file);
      },
      'image/jpeg',
      0.92
    );
  }

  const label = side === 'front' ? 'ID front' : 'ID back';

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="relative flex-1 flex items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="h-full w-full object-cover"
          style={{ transform: 'scaleX(-1)' }}
        />
        {!cameraError && (
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            aria-hidden
          >
            <div
              className="border-4 border-white/90 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]"
              style={{
                width: `${FRAME_WIDTH_RATIO * 100}%`,
                aspectRatio: String(ID_ASPECT),
              }}
            >
              <div className="absolute inset-0 rounded border-2 border-dashed border-amber-400/80" />
            </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-gray-900 text-white safe-area-pb">
        {cameraError ? (
          <div className="text-center">
            <p className="text-sm text-red-300">{cameraError}</p>
            <button
              type="button"
              onClick={onCancel}
              className="mt-4 px-4 py-2 rounded-lg bg-gray-700 text-white"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <p className="text-center text-sm text-gray-300 mb-4">
              Align your {label} within the frame. Use device camera only.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 rounded-lg bg-gray-700 text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={capture}
                disabled={capturing}
                className="px-6 py-2 rounded-lg bg-primary-600 text-white disabled:opacity-50"
              >
                {capturing ? 'Capturing…' : 'Capture'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
