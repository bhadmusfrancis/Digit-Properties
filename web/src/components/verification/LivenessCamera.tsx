'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { flushSync } from 'react-dom';
import type { FaceResult } from '@/lib/liveness-detection';
import {
  checkFaceCentred,
  getCentreReadiness,
  getEyeEAR,
  updateBlinkState,
  updateHeadTurnState,
  getHeadTurnPhase,
  checkSmile,
} from '@/lib/liveness-detection';

// Model weights from @vladmandic/face-api package (tfjs 4.x compatible)
const MODELS_BASE = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model';

const STEPS = [
  {
    id: 'centre',
    title: 'Centre your face',
    instruction:
      'Position your face inside the oval. Keep your face straight and fully visible. We’ll continue automatically when you’re centred.',
  },
  {
    id: 'blink',
    title: 'Blink twice',
    instruction: 'Blink your eyes naturally twice. A green indicator will show only when a blink is detected.',
  },
  {
    id: 'turn',
    title: 'Turn your head',
    instruction: 'Follow the labels: turn RIGHT first, back to centre, then turn LEFT, then back to centre. Green highlights show your progress.',
  },
  {
    id: 'smile',
    title: 'Smile',
    instruction: 'Give a natural smile and keep looking at the camera. We’ll capture your photo automatically.',
  },
  {
    id: 'capture',
    title: 'Capturing...',
    instruction: 'Stay still. We will capture your photo in a moment.',
  },
] as const;

type Props = {
  onSuccess: (imageUrl: string) => void;
  onCancel: () => void;
  onError?: (message: string) => void;
  isUploading?: boolean;
};

export function LivenessCamera({ onSuccess, onCancel, onError, isUploading }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const faceApiRef = useRef<typeof import('@vladmandic/face-api') | null>(null);
  const modelsLoadedRef = useRef(false);
  const [modelsReady, setModelsReady] = useState(false);

  const [stepIndex, setStepIndex] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [stepStartCountdown, setStepStartCountdown] = useState<number | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [instructionKey, setInstructionKey] = useState(0);
  const [retryKey, setRetryKey] = useState(0);
  const [stepSuccess, setStepSuccess] = useState(false);
  const [faceDetectedHint, setFaceDetectedHint] = useState(false);
  const [glowProgress, setGlowProgress] = useState(0);
  const [faceFocused, setFaceFocused] = useState(false);
  const [headTurnPhase, setHeadTurnPhase] = useState<'left' | 'centre' | 'right' | null>(null);
  const [holdStillCountdown, setHoldStillCountdown] = useState<number | null>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const lastGlowRef = useRef(0);
  const holdCountdownStartedRef = useRef(false);
  const stepStartCountdownRef = useRef(0);
  const captureInProgressRef = useRef(false);
  const captureRetryIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  stepStartCountdownRef.current = stepStartCountdown ?? 0;

  const step = STEPS[stepIndex];
  const isCaptureStep = step?.id === 'capture';
  const activeStepNumber = isCaptureStep ? 4 : stepIndex + 1;
  const showHoldStill = (step?.id === 'centre' || step?.id === 'smile') && faceFocused && glowProgress >= 0.5;

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    setCameraError(null);
    navigator.mediaDevices
      .getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      })
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
        if (mounted) {
          const msg =
            err?.name === 'NotAllowedError'
              ? 'Camera access was denied. Please allow camera access and try again.'
              : err?.message?.toString() || 'Could not access camera.';
          setCameraError(msg);
          onError?.(msg);
        }
      });
    return () => {
      mounted = false;
      stopCamera();
    };
  }, [onError, stopCamera]);

  useEffect(() => {
    let cancelled = false;
    modelsLoadedRef.current = false;
    setModelsReady(false);
    setModelsError(null);
    Promise.all([
      import('@tensorflow/tfjs'),
      import('@vladmandic/face-api'),
    ])
      .then(([tf, faceapi]) => {
        if (cancelled) return;
        faceApiRef.current = faceapi;
        // Ensure TensorFlow.js backend is ready before loading face-api models
        return (tf as typeof import('@tensorflow/tfjs')).ready?.() ?? Promise.resolve();
      })
      .then(() => {
        if (cancelled || !faceApiRef.current) return;
        const faceapi = faceApiRef.current;
        return faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_BASE).then(() => {
          if (cancelled) return;
          return faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_BASE);
        });
      })
      .then(() => {
        if (!cancelled) {
          modelsLoadedRef.current = true;
          setModelsReady(true);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          const msg = err?.message?.toString() || 'Could not load face detection models.';
          setModelsError(msg);
          onError?.(msg);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [onError, retryKey]);

  const blinkStateRef = useRef({ count: 0, wasClosed: false });
  const headTurnStateRef = useRef({ step: 0, lastPhase: '' });
  const headTurnPhaseStableRef = useRef<{ phase: 'left' | 'centre' | 'right'; count: number }>({ phase: 'centre', count: 0 });
  const lastConfirmedPhaseRef = useRef<string | null>(null);
  const turnStableFramesRef = useRef(0);
  const stableFramesRef = useRef(0);
  const STABLE_FRAMES_NEEDED = 25;
  const STABLE_TURN_FRAMES_NEEDED = 12;
  /** Frames the face must hold in each turn phase (right/centre/left/centre) before we count it */
  const PHASE_STABLE_FRAMES = 12;
  const advanceRef = useRef(false);
  const faceDetectedHintRef = useRef(false);

  function setGlowIfChanged(value: number) {
    const v = Math.max(0, Math.min(1, value));
    if (Math.abs(v - lastGlowRef.current) >= 0.06 || v === 0 || v === 1) {
      lastGlowRef.current = v;
      setGlowProgress(v);
    }
  }

  useEffect(() => {
    stableFramesRef.current = 0;
    setFaceDetectedHint(false);
    setGlowProgress(0);
    setFaceFocused(false);
    setHoldStillCountdown(null);
    lastGlowRef.current = 0;
    holdCountdownStartedRef.current = false;
    if (step?.id === 'blink') blinkStateRef.current = { count: 0, wasClosed: false };
    if (step?.id === 'turn') {
      headTurnStateRef.current = { step: 0, lastPhase: '' };
      headTurnPhaseStableRef.current = { phase: 'centre', count: 0 };
      lastConfirmedPhaseRef.current = null;
      turnStableFramesRef.current = 0;
      setHeadTurnPhase(null);
    }
    if (step?.id === 'blink' || step?.id === 'turn' || step?.id === 'smile') {
      setStepStartCountdown(3);
    }
  }, [step?.id]);

  useEffect(() => {
    if (stepStartCountdown === null || stepStartCountdown <= 0) return;
    const t = setInterval(() => {
      setStepStartCountdown((c) => (c === null || c <= 1 ? null : c - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [stepStartCountdown]);

  useEffect(() => {
    if (!showHoldStill || holdCountdownStartedRef.current) return;
    holdCountdownStartedRef.current = true;
    setHoldStillCountdown(3);
    const interval = setInterval(() => {
      setHoldStillCountdown((c) => {
        if (c === null || c <= 1) {
          clearInterval(interval);
          return null;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [showHoldStill]);

  useEffect(() => {
    if (!stepSuccess) return;
    const t = setTimeout(() => setStepSuccess(false), 1200);
    return () => clearTimeout(t);
  }, [stepSuccess]);

  useEffect(() => {
    if (!videoRef.current || !faceApiRef.current || !modelsReady || isCaptureStep) return;
    const video = videoRef.current;
    const faceapi = faceApiRef.current;

    let rafId: number;
    const runDetection = async () => {
      if (stepStartCountdownRef.current > 0 && (step?.id === 'blink' || step?.id === 'turn' || step?.id === 'smile')) {
        rafId = requestAnimationFrame(runDetection);
        return;
      }
      if (!video.videoWidth || !video.videoHeight || video.readyState < 2) {
        lastGlowRef.current = 0;
        flushSync(() => {
          setGlowProgress(0);
          setFaceFocused(false);
          setHeadTurnPhase(null);
          setHoldStillCountdown(null);
        });
        holdCountdownStartedRef.current = false;
        rafId = requestAnimationFrame(runDetection);
        return;
      }
      try {
        const opts = new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.1 });
        const result = await faceapi
          .detectSingleFace(video, opts)
          .withFaceLandmarks();
        if (!result) {
          stableFramesRef.current = 0;
          blinkStateRef.current = { count: 0, wasClosed: false };
          lastGlowRef.current = 0;
          turnStableFramesRef.current = 0;
          flushSync(() => {
            setGlowProgress(0);
            setFaceFocused(false);
            setHeadTurnPhase(null);
            setFaceDetectedHint(false);
            setHoldStillCountdown(null);
          });
          holdCountdownStartedRef.current = false;
          rafId = requestAnimationFrame(runDetection);
          return;
        }

        const detection = result.detection as { box: { x: number; y: number; width: number; height: number } };
        const lm = result.landmarks as unknown as { positions?: Array<{ x: number; y: number }> };
        const box = detection.box;
        let positions = Array.isArray(lm?.positions) ? lm.positions : [];
        if (positions.length > 0 && typeof (positions[0] as { x?: number; y?: number }).x === 'number') {
          positions = positions as Array<{ x: number; y: number }>;
        } else if (lm && typeof (lm as { getLeftEye?: () => unknown[] }).getLeftEye === 'function') {
          const g = lm as {
            getJawOutline: () => Array<{ x: number; y: number }>;
            getLeftEyeBrow: () => Array<{ x: number; y: number }>;
            getRightEyeBrow: () => Array<{ x: number; y: number }>;
            getNose: () => Array<{ x: number; y: number }>;
            getLeftEye: () => Array<{ x: number; y: number }>;
            getRightEye: () => Array<{ x: number; y: number }>;
            getMouth: () => Array<{ x: number; y: number }>;
          };
          positions = [...g.getJawOutline(), ...g.getLeftEyeBrow(), ...g.getRightEyeBrow(), ...g.getNose(), ...g.getLeftEye(), ...g.getRightEye(), ...g.getMouth()];
        }
        if (positions.length < 48) {
          lastGlowRef.current = 0;
          turnStableFramesRef.current = 0;
          flushSync(() => {
            setGlowProgress(0);
            setFaceFocused(false);
            setHeadTurnPhase(null);
            setFaceDetectedHint(false);
            setHoldStillCountdown(null);
          });
          holdCountdownStartedRef.current = false;
          rafId = requestAnimationFrame(runDetection);
          return;
        }
        const plainPositions = positions.map((p) => ({ x: Number((p as { x: number }).x), y: Number((p as { y: number }).y) }));
        const faceResult: FaceResult = {
          box: { x: box.x, y: box.y, width: box.width, height: box.height },
          landmarks: { positions: plainPositions },
        };
        const w = video.videoWidth;
        const h = video.videoHeight;

        const inPosition = checkFaceCentred(faceResult, w, h);

        // When countdown would disappear = face stopped focusing: clear countdown and force green off
        if (!inPosition) {
          lastGlowRef.current = 0;
          flushSync(() => {
            setGlowProgress(0);
            setFaceFocused(false);
            setHoldStillCountdown(null);
          });
          holdCountdownStartedRef.current = false;
        } else {
          setFaceFocused(true);
        }

        if (step?.id === 'centre' && inPosition) {
          {
            if (faceDetectedHintRef.current) {
              faceDetectedHintRef.current = false;
              setFaceDetectedHint(false);
            }
            stableFramesRef.current += 1;
            setGlowIfChanged(0.5 + 0.5 * (stableFramesRef.current / STABLE_FRAMES_NEEDED));
            if (stableFramesRef.current >= STABLE_FRAMES_NEEDED && !advanceRef.current) {
              advanceRef.current = true;
              // Capture at "centre your head" stage for admin review
              const v = videoRef.current;
              if (v?.videoWidth && v?.videoHeight) {
                const canvas = document.createElement('canvas');
                canvas.width = v.videoWidth;
                canvas.height = v.videoHeight;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  ctx.drawImage(v, 0, 0);
                  canvas.toBlob(
                    (blob) => {
                      if (!blob) return;
                      const fd = new FormData();
                      fd.set('file', blob, 'liveness-centre.jpg');
                      fd.set('folder', 'liveness');
                      fetch('/api/upload', { method: 'POST', body: fd })
                        .then((r) => r.json())
                        .then((data) => {
                          if (data?.url) {
                            fetch('/api/me/liveness-centre', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ imageUrl: data.url }),
                            }).catch(() => {});
                          }
                        })
                        .catch(() => {});
                    },
                    'image/jpeg',
                    0.92
                  );
                }
              }
              setStepSuccess(true);
              setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
              setInstructionKey((k) => k + 1);
              stableFramesRef.current = 0;
              setTimeout(() => { advanceRef.current = false; }, 500);
            }
          }
        } else if (step?.id === 'centre') {
          stableFramesRef.current = 0;
          if (!faceDetectedHintRef.current) {
            faceDetectedHintRef.current = true;
            setFaceDetectedHint(true);
          }
        } else if (step?.id === 'blink') {
          if (!inPosition) {
            setGlowIfChanged(0);
          } else {
            const ear = getEyeEAR(faceResult.landmarks);
            const count = updateBlinkState(ear, blinkStateRef.current);
            setGlowIfChanged(count / 2);
          }
          const count = blinkStateRef.current.count;
          if (count >= 2 && !advanceRef.current) {
            advanceRef.current = true;
            blinkStateRef.current = { count: 0, wasClosed: false };
            setStepSuccess(true);
            setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
            setInstructionKey((k) => k + 1);
            setTimeout(() => { advanceRef.current = false; }, 500);
          }
        } else if (step?.id === 'turn') {
          const phase = getHeadTurnPhase(faceResult.box, w);
          setHeadTurnPhase(phase);
          // Require face to hold each phase for PHASE_STABLE_FRAMES before we count it (stops noise from advancing)
          const stable = headTurnPhaseStableRef.current;
          if (stable.phase === phase) {
            stable.count += 1;
          } else {
            headTurnPhaseStableRef.current = { phase, count: 1 };
          }
          const stableCount = headTurnPhaseStableRef.current.count;
          let done = false;
          if (stableCount >= PHASE_STABLE_FRAMES) {
            const confirmedPhase = headTurnPhaseStableRef.current.phase;
            if (confirmedPhase !== lastConfirmedPhaseRef.current) {
              lastConfirmedPhaseRef.current = confirmedPhase;
              done = updateHeadTurnState(confirmedPhase, headTurnStateRef.current);
            } else {
              done = headTurnStateRef.current.step >= 5;
            }
          }
          // Only require face in oval when back at centre for the final hold
          const centreHold = done && phase === 'centre' && inPosition;
          if (centreHold) {
            turnStableFramesRef.current += 1;
            if (turnStableFramesRef.current >= STABLE_TURN_FRAMES_NEEDED && !advanceRef.current) {
              advanceRef.current = true;
              headTurnStateRef.current = { step: 0, lastPhase: '' };
              headTurnPhaseStableRef.current = { phase: 'centre', count: 0 };
              lastConfirmedPhaseRef.current = null;
              turnStableFramesRef.current = 0;
              setStepSuccess(true);
              setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
              setInstructionKey((k) => k + 1);
              setTimeout(() => { advanceRef.current = false; }, 500);
            }
          } else {
            turnStableFramesRef.current = 0;
          }
        } else if (step?.id === 'smile') {
          if (!inPosition) {
            stableFramesRef.current = 0;
            setGlowIfChanged(0);
          } else if (checkSmile(faceResult.landmarks)) {
            stableFramesRef.current += 1;
            setGlowIfChanged(stableFramesRef.current / STABLE_FRAMES_NEEDED);
            if (stableFramesRef.current >= STABLE_FRAMES_NEEDED && !advanceRef.current) {
              advanceRef.current = true;
              setStepSuccess(true);
              setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
              setInstructionKey((k) => k + 1);
              stableFramesRef.current = 0;
              setTimeout(() => { advanceRef.current = false; }, 500);
            }
          } else {
            stableFramesRef.current = 0;
            setGlowIfChanged(0);
          }
        }
      } catch {
        lastGlowRef.current = 0;
        turnStableFramesRef.current = 0;
        flushSync(() => {
          setGlowProgress(0);
          setFaceFocused(false);
          setHeadTurnPhase(null);
          setHoldStillCountdown(null);
        });
        holdCountdownStartedRef.current = false;
      }
      rafId = requestAnimationFrame(runDetection);
    };
    rafId = requestAnimationFrame(runDetection);
    return () => cancelAnimationFrame(rafId);
  }, [step?.id, isCaptureStep, modelsReady]);

  useEffect(() => {
    if (!isCaptureStep || !streamRef.current || !videoRef.current) return;
    setCaptureError(null);
    setCountdown(3);
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c === null || c <= 1) {
          clearInterval(interval);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isCaptureStep]);

  useEffect(() => {
    if (countdown !== 0 || !videoRef.current || !faceApiRef.current || !modelsReady) return;
    if (captureInProgressRef.current) return;
    const video = videoRef.current;
    const faceapi = faceApiRef.current;

    captureInProgressRef.current = true;
    setCaptureError(null);

    (async () => {
      try {
        const opts = new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.3 });
        const result = await faceapi.detectSingleFace(video, opts).withFaceLandmarks();
        if (!result) {
          setCaptureError('No face detected. Hold still — we\'ll try again in 3 seconds.');
          setCountdown(3);
          if (captureRetryIntervalRef.current) clearInterval(captureRetryIntervalRef.current);
          captureRetryIntervalRef.current = setInterval(() => {
            setCountdown((c) => {
              if (c === null || c <= 1) {
                if (captureRetryIntervalRef.current) clearInterval(captureRetryIntervalRef.current);
                captureRetryIntervalRef.current = null;
                return 0;
              }
              return c - 1;
            });
          }, 1000);
          captureInProgressRef.current = false;
          return;
        }
        const lm = result.landmarks as unknown as { positions?: Array<{ x: number; y: number }> };
        const positions = Array.isArray(lm?.positions) ? lm.positions : [];
        if (positions.length < 48) {
          setCaptureError('Face not fully visible. Hold still — we\'ll try again in 3 seconds.');
          setCountdown(3);
          if (captureRetryIntervalRef.current) clearInterval(captureRetryIntervalRef.current);
          captureRetryIntervalRef.current = setInterval(() => {
            setCountdown((c) => {
              if (c === null || c <= 1) {
                if (captureRetryIntervalRef.current) clearInterval(captureRetryIntervalRef.current);
                captureRetryIntervalRef.current = null;
                return 0;
              }
              return c - 1;
            });
          }, 1000);
          captureInProgressRef.current = false;
          return;
        }

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          captureInProgressRef.current = false;
          onError?.('Capture failed');
          return;
        }
        ctx.drawImage(video, 0, 0);
        canvas.toBlob(
          (blob) => {
            captureInProgressRef.current = false;
            if (!blob) return;
            stopCamera();
            const formData = new FormData();
            formData.set('file', blob, 'liveness.jpg');
            formData.set('folder', 'liveness');
            fetch('/api/upload', { method: 'POST', body: formData })
              .then((r) => r.json())
              .then((data) => {
                if (data.url) onSuccess(data.url);
                else onError?.(data.error || 'Upload failed');
              })
              .catch(() => onError?.('Upload failed'));
          },
          'image/jpeg',
          0.92
        );
      } catch {
        captureInProgressRef.current = false;
        setCaptureError('Face check failed. We\'ll try again in 3 seconds.');
        setCountdown(3);
        if (captureRetryIntervalRef.current) clearInterval(captureRetryIntervalRef.current);
        captureRetryIntervalRef.current = setInterval(() => {
          setCountdown((c) => {
            if (c === null || c <= 1) {
              if (captureRetryIntervalRef.current) clearInterval(captureRetryIntervalRef.current);
              captureRetryIntervalRef.current = null;
              return 0;
            }
            return c - 1;
          });
        }, 1000);
      }
    })();
  }, [countdown, onSuccess, onError, stopCamera, modelsReady]);

  useEffect(() => {
    return () => {
      if (captureRetryIntervalRef.current) clearInterval(captureRetryIntervalRef.current);
      captureRetryIntervalRef.current = null;
    };
  }, [isCaptureStep]);

  if (cameraError) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
        <p className="text-amber-800">{cameraError}</p>
        <button
          type="button"
          onClick={onCancel}
          className="mt-4 rounded-md bg-amber-200 px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-300"
        >
          Close
        </button>
      </div>
    );
  }

  if (modelsError) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
        <p className="text-amber-800">Face detection could not be loaded. Please try again.</p>
        <p className="mt-1 text-sm text-amber-700">Models load from the network; slow or restricted connections may fail.</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => {
              setModelsError(null);
              setRetryKey((k) => k + 1);
            }}
            className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
          >
            Retry
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md bg-amber-200 px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-300"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-900 p-4 shadow-lg" role="region" aria-label="Biometric liveness verification">
      <p className="mb-3 text-center text-xs font-medium uppercase tracking-wide text-gray-400">
        Device camera only · Identity proofing
      </p>

      <div className="relative mx-auto aspect-[4/3] max-w-md overflow-hidden rounded-lg bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="h-full w-full object-cover"
          style={{ transform: 'scaleX(-1)' }}
          aria-label="Live camera feed for face verification"
        />
        {/* Instruction bar at top – visible while looking at camera */}
        <div className="absolute top-0 left-0 right-0 bg-black/75 px-3 py-2.5 text-center pointer-events-none z-10" aria-live="polite">
          <p className="text-white font-semibold text-sm leading-tight">{step?.title}</p>
          <p className="text-white/95 text-xs mt-1 leading-snug max-w-md mx-auto">{step?.instruction}</p>
        </div>
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          aria-hidden
        >
          <div
            className="w-[52%] h-[72%] rounded-full border-4 border-white/90 border-dashed transition-shadow duration-200"
            style={{
                boxShadow: [
                'inset 0 0 0 2px rgba(255,255,255,0.4)',
                step?.id !== 'turn' && faceFocused && glowProgress > 0
                  ? `0 0 ${20 + 45 * glowProgress}px ${8 + 24 * glowProgress}px rgba(16, 185, 129, ${0.35 + 0.6 * glowProgress})`
                  : 'none',
                step?.id !== 'turn' && faceFocused && glowProgress > 0.3 ? `0 0 ${60 + 60 * glowProgress}px ${20 + 30 * glowProgress}px rgba(16, 185, 129, ${0.15 + 0.35 * glowProgress})` : 'none',
              ].filter(Boolean).join(', '),
            }}
          />
        </div>
        {/* Call-to-action labels around the face */}
        {step?.id === 'centre' && (
          <div className="absolute left-0 right-0 bottom-[22%] text-center pointer-events-none z-10">
            <span className="inline-block rounded-lg bg-black/60 px-3 py-1.5 text-xs font-medium text-white">Keep your face in the oval</span>
          </div>
        )}
        {step?.id === 'blink' && (
          <div className="absolute left-0 right-0 bottom-[22%] text-center pointer-events-none z-10">
            <span className="inline-block rounded-lg bg-black/60 px-3 py-1.5 text-xs font-medium text-white">Blink twice naturally</span>
          </div>
        )}
        {step?.id === 'turn' && (
          <>
            <div className="absolute left-2 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 pointer-events-none z-10">
              <span className={`rounded-lg px-2.5 py-1.5 text-xs font-bold uppercase tracking-wide ${headTurnPhase === 'left' ? 'bg-emerald-500 text-white' : 'bg-black/60 text-white'}`}>
                Turn right
              </span>
              <span className="text-[10px] text-white/80">← face this way</span>
            </div>
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 pointer-events-none z-10">
              <span className={`rounded-lg px-2.5 py-1.5 text-xs font-bold uppercase tracking-wide ${headTurnPhase === 'right' ? 'bg-emerald-500 text-white' : 'bg-black/60 text-white'}`}>
                Turn left
              </span>
              <span className="text-[10px] text-white/80">face this way →</span>
            </div>
            <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-4 pointer-events-none z-10" aria-hidden>
              <span
                className={`h-3 w-12 rounded-full transition-all duration-200 ${
                  headTurnPhase === 'left' ? 'bg-emerald-500 shadow-lg shadow-emerald-500/50 scale-110' : 'bg-white/30'
                }`}
                title="Turn left"
              />
              <span
                className={`h-3 w-12 rounded-full transition-all duration-200 ${
                  headTurnPhase === 'centre' ? 'bg-emerald-500 shadow-lg shadow-emerald-500/50 scale-110' : 'bg-white/30'
                }`}
                title="Centre"
              />
              <span
                className={`h-3 w-12 rounded-full transition-all duration-200 ${
                  headTurnPhase === 'right' ? 'bg-emerald-500 shadow-lg shadow-emerald-500/50 scale-110' : 'bg-white/30'
                }`}
                title="Turn right"
              />
            </div>
          </>
        )}
        {step?.id === 'smile' && (
          <div className="absolute left-0 right-0 bottom-[22%] text-center pointer-events-none z-10">
            <span className="inline-block rounded-lg bg-black/60 px-3 py-1.5 text-xs font-medium text-white">Smile and hold</span>
          </div>
        )}
        {stepStartCountdown !== null && stepStartCountdown > 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 pointer-events-none" aria-live="assertive">
            <p className="text-lg font-semibold text-white drop-shadow-md">Get ready</p>
            <span className="mt-2 text-5xl font-bold text-white drop-shadow-md">{stepStartCountdown}</span>
          </div>
        )}
        {holdStillCountdown !== null && holdStillCountdown > 0 && !isCaptureStep && stepStartCountdown === null && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 pointer-events-none" aria-live="assertive">
            <p className="text-lg font-semibold text-white drop-shadow-md">Hold still</p>
            <span className="mt-2 text-5xl font-bold text-emerald-300 drop-shadow-md">{holdStillCountdown}</span>
          </div>
        )}
        {stepSuccess && !isCaptureStep && (
          <div className="absolute inset-0 flex items-center justify-center bg-emerald-500/25 pointer-events-none" aria-live="polite">
            <span className="rounded-full bg-emerald-500 px-5 py-2.5 text-xl font-semibold text-white shadow-xl ring-4 ring-emerald-300/50">✓ Done</span>
          </div>
        )}
        {isCaptureStep && countdown !== null && countdown > 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 pointer-events-none">
            <p className="text-xl font-semibold text-white drop-shadow-md">Hold still — capturing in</p>
            <span className="mt-3 text-7xl font-bold text-white drop-shadow-lg" aria-live="assertive">{countdown}</span>
          </div>
        )}
      </div>

      <div className="mt-4 flex justify-center gap-2" aria-label="Progress">
        {[1, 2, 3, 4].map((n) => (
          <span
            key={n}
            className={`h-2 w-8 rounded-full transition-colors ${
              n < activeStepNumber ? 'bg-emerald-500' : n === activeStepNumber ? 'bg-white' : 'bg-gray-600'
            }`}
            aria-hidden="true"
          />
        ))}
      </div>

      <div className="mt-4 rounded-lg bg-white/95 p-3 text-gray-900 shadow-inner">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Step {activeStepNumber} of 4</p>
        <p className="mt-0.5 font-medium text-gray-900" aria-live="polite" key={instructionKey}>
          {step?.title}
        </p>
        <p className="mt-0.5 text-sm text-gray-600">
          {step?.instruction}
        </p>
        {showHoldStill && (
          <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200">
            {holdStillCountdown !== null && holdStillCountdown > 0 ? `Hold still: ${holdStillCountdown}…` : 'Hold still — keep your position'}
          </p>
        )}
        {step?.id === 'centre' && !faceFocused && (
          <p className="mt-2 text-sm text-gray-500">Look at the camera so we can detect your face. No green glow until you’re in position.</p>
        )}
        {faceDetectedHint && step?.id === 'centre' && (
          <p className="mt-2 text-sm text-amber-700">Move slightly to centre your face in the oval.</p>
        )}
        {!modelsReady && !modelsError && (
          <p className="mt-2 text-xs text-gray-500">Loading face detection...</p>
        )}
        {isCaptureStep && countdown === 0 && !captureError && (
          <p className="mt-2 text-sm text-primary-600">
            {isUploading ? 'Uploading and verifying...' : 'Preparing...'}
          </p>
        )}
        {isCaptureStep && captureError && (
          <p className="mt-2 text-sm text-amber-700 font-medium" role="alert">
            {captureError}
          </p>
        )}
      </div>

      <div className="mt-3 flex justify-between items-center">
        <button
          type="button"
          onClick={() => {
            stopCamera();
            onCancel();
          }}
          className="text-sm text-gray-400 hover:text-white"
        >
          Cancel
        </button>
        <p className="text-xs text-gray-500">
          Step {activeStepNumber} of 4 · Continues automatically
        </p>
      </div>
    </div>
  );
}
