'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { LivenessCamera } from '@/components/verification/LivenessCamera';
import { IdDocumentCamera } from '@/components/verification/IdDocumentCamera';
import { ID_TYPES } from '@/lib/constants';

const ID_TYPE_OPTIONS = [
  { value: ID_TYPES.DRIVERS_LICENSE, label: "Driver's License" },
  { value: ID_TYPES.NATIONAL_ID, label: 'National ID card' },
  { value: ID_TYPES.VOTERS_CARD, label: 'Voters Card' },
  { value: ID_TYPES.INTERNATIONAL_PASSPORT, label: 'International passport' },
] as const;

const VERIFICATION_TYPES = [
  { value: 'registered_agent', label: 'Registered Agent' },
  { value: 'registered_developer', label: 'Registered Developer' },
] as const;

const COMPANY_POSITIONS = [
  'Agent',
  'Senior Agent',
  'Team Lead',
  'Director',
  'CEO',
  'Marketing Manager',
  'Project Manager',
  'Other',
];

type UserMe = {
  name: string;
  email: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  dateOfBirth?: string | null;
  address?: string;
  phone?: string;
  image?: string;
  role?: string;
  companyPosition?: string;
  phoneVerifiedAt?: string;
  livenessVerifiedAt?: string;
  identityVerifiedAt?: string;
  idFrontUrl?: string;
  idBackUrl?: string;
  idScannedData?: { firstName?: string; middleName?: string; lastName?: string; dateOfBirth?: string };
  canChangeProfilePicture?: boolean;
};

type VerificationRequestItem = {
  _id: string;
  type: string;
  status: string;
  documentUrls: string[];
  companyPosition?: string;
  rejectionReason?: string;
  createdAt: string;
  reviewedAt?: string;
};

type IdUploadResult = {
  scanned: { firstName: string; middleName: string; lastName: string; dateOfBirth: string; expiryDate?: string } | null;
  rawOcrPreview?: string;
};

export default function ProfilePage() {
  const [user, setUser] = useState<UserMe | null>(null);
  const [requests, setRequests] = useState<VerificationRequestItem[]>([]);
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [companyPosition, setCompanyPosition] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<'success' | 'error' | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const livenessSectionRef = useRef<HTMLElement>(null);

  const [phoneForVerify, setPhoneForVerify] = useState('');
  const [code, setCode] = useState('');
  const [phoneCodeSent, setPhoneCodeSent] = useState(false);
  const [phoneSending, setPhoneSending] = useState(false);
  const [phoneConfirming, setPhoneConfirming] = useState(false);
  const [phoneMessage, setPhoneMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showLivenessCamera, setShowLivenessCamera] = useState(false);
  const [livenessUploading, setLivenessUploading] = useState(false);
  const [livenessMessage, setLivenessMessage] = useState<string | null>(null);

  const [idFrontFile, setIdFrontFile] = useState<File | null>(null);
  const [idBackFile, setIdBackFile] = useState<File | null>(null);
  const [idType, setIdType] = useState<string>(ID_TYPES.DRIVERS_LICENSE);
  const [showIdCamera, setShowIdCamera] = useState<'front' | 'back' | null>(null);
  const [idUploading, setIdUploading] = useState(false);
  const [idUploadResult, setIdUploadResult] = useState<IdUploadResult | null>(null);
  const [idConfirming, setIdConfirming] = useState(false);
  const [idConsentSaving, setIdConsentSaving] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [requestType, setRequestType] = useState<string>('registered_agent');
  const [requestCompanyPosition, setRequestCompanyPosition] = useState('');
  const [requestMessage, setRequestMessage] = useState('');
  const [docFiles, setDocFiles] = useState<File[]>([]);

  function fetchUserAndRequests() {
    return Promise.all([
      fetch('/api/me', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)),
      fetch('/api/verification/request', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([me, list]) => {
        if (me) {
          setUser(me);
          // Pre-fill name parts from social login when first/last are missing
          const first = (me.firstName ?? '').trim();
          const last = (me.lastName ?? '').trim();
          const fullName = (me.name ?? '').trim();
          if (!first && !last && fullName) {
            const parts = fullName.split(/\s+/).filter(Boolean);
            setFirstName(parts[0] ?? '');
            setLastName(parts.slice(1).join(' ') ?? '');
            setMiddleName(me.middleName ?? '');
          } else {
            setFirstName(me.firstName ?? '');
            setMiddleName(me.middleName ?? '');
            setLastName(me.lastName ?? '');
          }
          setDateOfBirth(me.dateOfBirth ?? '');
          setAddress(me.address ?? '');
          setPhone(me.phone ?? '');
          setEmail(me.email ?? '');
          setCompanyPosition(me.companyPosition ?? '');
          setPhoneForVerify(me.phone ?? '');
        }
        if (Array.isArray(list)) setRequests(list);
      })
      .catch(() => {});
  }

  useEffect(() => {
    setLoading(true);
    fetchUserAndRequests().finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onFocus = () => fetchUserAndRequests();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const effectiveFirst = ((firstName || user?.firstName) ?? '').trim();
  const effectiveMiddle = ((middleName || user?.middleName) ?? '').trim();
  const effectiveLast = ((lastName || user?.lastName) ?? '').trim();
  const effectiveDob = ((dateOfBirth || user?.dateOfBirth) ?? '').trim();
  const effectivePhone = ((phone || user?.phone) ?? '').trim();
  const effectiveAddress = ((address || user?.address) ?? '').trim();
  const profileComplete =
    !!user &&
    !!effectiveFirst &&
    !!effectiveLast &&
    !!effectiveDob &&
    !!effectivePhone &&
    !!effectiveAddress;

  const identityOk = !!user?.identityVerifiedAt;
  const livenessOk = !!user?.livenessVerifiedAt;
  const phoneOk = !!user?.phoneVerifiedAt;
  /** Verified Individual = ID + Liveness + Phone. Profile (name, DOB, address) locks once ID is verified; phone editable until verified. */
  const verificationComplete = !!(identityOk && livenessOk && phoneOk);
  const canEditNameDobAddress = !identityOk;
  const canEditPhone = !phoneOk;
  const canSaveProfile = canEditNameDobAddress || canEditPhone;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSaveProfile) return;
    setSaving(true);
    setMessage(null);
    try {
      const body: Record<string, unknown> = {};
      if (canEditNameDobAddress) {
        const name = [firstName.trim(), middleName.trim(), lastName.trim()].filter(Boolean).join(' ') || undefined;
        body.firstName = firstName.trim();
        body.middleName = middleName.trim();
        body.lastName = lastName.trim();
        body.dateOfBirth = dateOfBirth.trim() || undefined;
        body.address = address.trim();
        body.name = name || undefined;
      }
      if (canEditPhone) body.phone = phone.trim();
      if (
        (user?.role === 'registered_agent' || user?.role === 'registered_developer') &&
        companyPosition !== undefined
      ) {
        body.companyPosition = companyPosition.trim() || undefined;
      }
      const res = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setMessage('success');
        const data = await res.json();
        setUser((u) => (u ? { ...u, ...data } : null));
        setFirstName(data.firstName ?? '');
        setMiddleName(data.middleName ?? '');
        setLastName(data.lastName ?? '');
        setDateOfBirth(typeof data.dateOfBirth === 'string' ? data.dateOfBirth : (data.dateOfBirth ?? ''));
        setAddress(data.address ?? '');
        setPhone(data.phone ?? '');
        const refetch = await fetch('/api/me', { cache: 'no-store' });
        if (refetch.ok) {
          const fresh = await refetch.json();
          setUser(fresh);
          setFirstName(fresh.firstName ?? '');
          setMiddleName(fresh.middleName ?? '');
          setLastName(fresh.lastName ?? '');
          setDateOfBirth(typeof fresh.dateOfBirth === 'string' ? fresh.dateOfBirth : (fresh.dateOfBirth ?? ''));
          setAddress(fresh.address ?? '');
          setPhone(fresh.phone ?? '');
        }
      } else {
        const data = await res.json();
        setMessage(data.error || 'error');
      }
    } catch {
      setMessage('error');
    }
    setSaving(false);
  }

  async function handleProfileImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user?.canChangeProfilePicture) return;
    if (!file.type.startsWith('image/')) {
      setMessage('error');
      return;
    }
    setImageUploading(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.set('file', file);
      formData.set('folder', 'verification');
      const up = await fetch('/api/upload', { method: 'POST', body: formData });
      const upData = await up.json();
      if (!up.ok || !upData.url) {
        setMessage(upData.error || 'Upload failed');
        setImageUploading(false);
        return;
      }
      const res = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: upData.url }),
      });
      if (res.ok) {
        const data = await res.json();
        setUser((u) => (u ? { ...u, image: data.image } : null));
        setMessage('success');
      } else {
        setMessage('error');
      }
    } catch {
      setMessage('error');
    }
    setImageUploading(false);
    e.target.value = '';
  }

  async function handleIdUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!idFrontFile || !idBackFile) {
      setSubmitError('Please capture both front and back of your ID.');
      return;
    }
    setIdUploading(true);
    setSubmitError(null);
    setIdUploadResult(null);
    try {
      const formData = new FormData();
      formData.set('idFront', idFrontFile);
      formData.set('idBack', idBackFile);
      const res = await fetch('/api/me/id-upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok) {
        setIdUploadResult({
          scanned: data.scanned ?? null,
          rawOcrPreview: data.rawOcrPreview,
        });
      } else {
        setSubmitError(data.error || 'Upload failed');
      }
    } catch {
      setSubmitError('Upload failed');
    }
    setIdUploading(false);
  }

  async function handleIdConfirm() {
    if (!idFrontFile || !idBackFile) {
      setSubmitError('Both ID front and back are required. Capture both and try again.');
      return;
    }
    setIdConfirming(true);
    setSubmitError(null);
    try {
      const formData = new FormData();
      formData.set('idFront', idFrontFile);
      formData.set('idBack', idBackFile);
      formData.set('idType', idType);
      formData.set('expiryDate', idUploadResult?.scanned?.expiryDate ?? '');
      const res = await fetch('/api/me/id-confirm', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok) {
        setIdUploadResult(null);
        setIdFrontFile(null);
        setIdBackFile(null);
        const refetch = await fetch('/api/me', { cache: 'no-store' });
        if (refetch.ok) {
          const me = await refetch.json();
          setUser(me);
          setTimeout(() => livenessSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
        } else {
          setUser((u) => (u ? { ...u, identityVerifiedAt: new Date().toISOString() } : null));
          setTimeout(() => livenessSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
        }
      } else {
        setSubmitError(data.error || 'Failed');
      }
    } catch {
      setSubmitError('Failed');
    }
    setIdConfirming(false);
  }

  async function handleUseScannedData() {
    const scanned = idUploadResult?.scanned;
    if (!scanned || !idFrontFile || !idBackFile) {
      setSubmitError('Both ID front and back are required. Capture both and try again.');
      return;
    }
    setIdConsentSaving(true);
    setSubmitError(null);
    try {
      const formData = new FormData();
      formData.set('idFront', idFrontFile);
      formData.set('idBack', idBackFile);
      formData.set('idType', idType);
      formData.set('expiryDate', scanned.expiryDate ?? '');
      formData.set('firstName', scanned.firstName ?? '');
      formData.set('middleName', scanned.middleName ?? '');
      formData.set('lastName', scanned.lastName ?? '');
      formData.set('dateOfBirth', scanned.dateOfBirth ?? '');
      const res = await fetch('/api/me/id-consent', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok) {
        setIdUploadResult(null);
        setIdFrontFile(null);
        setIdBackFile(null);
        const refetch = await fetch('/api/me', { cache: 'no-store' });
        if (refetch.ok) {
          const me = await refetch.json();
          setUser(me);
          setFirstName(me.firstName ?? '');
          setMiddleName(me.middleName ?? '');
          setLastName(me.lastName ?? '');
          setDateOfBirth(typeof me.dateOfBirth === 'string' ? me.dateOfBirth : (me.dateOfBirth ?? ''));
          setTimeout(() => livenessSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
        } else {
          setUser((u) => (u ? { ...u, identityVerifiedAt: new Date().toISOString() } : null));
          setTimeout(() => livenessSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
        }
      } else {
        setSubmitError(data.error || 'Failed');
      }
    } catch {
      setSubmitError('Failed');
    }
    setIdConsentSaving(false);
  }

  function normalizeForCompare(s: string) {
    return s.toLowerCase().replace(/\s+/g, ' ').trim();
  }
  function dobForCompare(d: string) {
    const parsed = d.replace(/\D/g, '');
    if (parsed.length >= 8) return parsed.slice(0, 8);
    return d;
  }
  const scannedMatches =
    idUploadResult?.scanned &&
    user &&
    normalizeForCompare(idUploadResult.scanned.firstName || '') === normalizeForCompare(user.firstName || '') &&
    normalizeForCompare(idUploadResult.scanned.middleName || '') === normalizeForCompare(user.middleName || '') &&
    normalizeForCompare(idUploadResult.scanned.lastName || '') === normalizeForCompare(user.lastName || '') &&
    dobForCompare(idUploadResult.scanned.dateOfBirth || '') === dobForCompare(user.dateOfBirth || '');

  const scannedExpiry = idUploadResult?.scanned?.expiryDate;
  const isIdExpired = Boolean(scannedExpiry && new Date(scannedExpiry) < new Date());

  async function handleSendPhone() {
    if (!phoneForVerify.trim()) return;
    setPhoneSending(true);
    setPhoneMessage(null);
    try {
      const res = await fetch('/api/me/verify-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneForVerify.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setPhoneMessage(data.message || 'Code sent. Enter it below.');
        setPhoneCodeSent(true);
        setCode('');
        setPhone(phoneForVerify.trim());
        setUser((u) => (u ? { ...u, phone: phoneForVerify.trim() } : null));
      } else {
        setPhoneMessage(data.error || 'Failed to send');
      }
    } catch {
      setPhoneMessage('Request failed');
    }
    setPhoneSending(false);
  }

  async function handleConfirmPhone() {
    if (!code.trim()) return;
    setPhoneConfirming(true);
    setPhoneMessage(null);
    try {
      const res = await fetch('/api/me/confirm-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.replace(/\D/g, '') }),
      });
      const data = await res.json();
      if (res.ok) {
        setPhoneMessage('Phone verified.');
        setUser((u) => (u ? { ...u, phoneVerifiedAt: new Date().toISOString() } : null));
        setPhoneCodeSent(false);
        setCode('');
      } else {
        setPhoneMessage(data.error || 'Invalid code');
      }
    } catch {
      setPhoneMessage('Request failed');
    }
    setPhoneConfirming(false);
  }

  async function handleLivenessSuccess(imageUrl: string) {
    setLivenessUploading(true);
    setLivenessMessage(null);
    setShowLivenessCamera(false);
    try {
      const res = await fetch('/api/me/liveness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl }),
      });
      const data = await res.json();
      if (res.ok) {
        setLivenessMessage('Liveness verified. This is now your profile picture.');
        setUser((u) => (u ? { ...u, livenessVerifiedAt: new Date().toISOString() } : null));
      } else {
        setLivenessMessage(data.error || 'Verification failed');
      }
    } catch {
      setLivenessMessage('Request failed');
    }
    setLivenessUploading(false);
  }

  async function handleSubmitRequest(e: React.FormEvent) {
    e.preventDefault();
    const needsPosition = requestType === 'registered_agent' || requestType === 'registered_developer';
    if (needsPosition && !requestCompanyPosition.trim()) {
      setSubmitError('Position in company is required for Agent/Developer.');
      return;
    }
    if (docFiles.length < 1) {
      setSubmitError('Upload at least one document (file upload only, no links).');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const urls: string[] = [];
      for (const file of docFiles) {
        const formData = new FormData();
        formData.set('file', file);
        formData.set('folder', 'verification');
        const up = await fetch('/api/upload', { method: 'POST', body: formData });
        const upData = await up.json();
        if (!up.ok || !upData.url) {
          setSubmitError(upData.error || 'Document upload failed');
          setSubmitting(false);
          return;
        }
        urls.push(upData.url);
      }
      const res = await fetch('/api/verification/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: requestType,
          documentUrls: urls,
          companyPosition: needsPosition ? requestCompanyPosition.trim() : undefined,
          message: requestMessage.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setRequests((prev) => [data, ...prev]);
        setDocFiles([]);
        setRequestMessage('');
      } else {
        setSubmitError(data.error || 'Submit failed');
      }
    } catch {
      setSubmitError('Request failed');
    }
    setSubmitting(false);
  }

  if (loading || !user) {
    return (
      <div>
        <p className="text-gray-500">Loading profile...</p>
      </div>
    );
  }

  const canChangePicture = user.canChangeProfilePicture === true;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Profile & Verification</h2>
        <p className="mt-1 text-sm text-gray-500">
          Verify your phone anytime (independent). For Verified Individual: complete profile → ID → Liveness (sent to admin). Then apply for Registered Agent/Developer.
        </p>
      </div>

      {!phoneOk && (
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm" aria-label="Verify phone">
          <h3 className="text-base font-semibold text-gray-900">Verify your phone</h3>
          <p className="mt-1 text-sm text-gray-500">
            {!phoneCodeSent
              ? 'Add your Nigerian number below (or in your profile first). We’ll send a 6-digit code via SMS or WhatsApp.'
              : `Code sent to ${phoneForVerify || 'your number'}. Enter it below.`}
          </p>
          <div className="mt-4">
            {!phoneCodeSent ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <input
                  type="tel"
                  value={phoneForVerify}
                  onChange={(e) => setPhoneForVerify(e.target.value)}
                  placeholder="08012345678 or +2348012345678"
                  className="input max-w-xs flex-1 font-mono"
                  inputMode="tel"
                  autoComplete="tel"
                  aria-label="Phone number"
                />
                <button
                  type="button"
                  onClick={handleSendPhone}
                  disabled={phoneSending || !phoneForVerify.trim()}
                  className="btn-primary shrink-0"
                >
                  {phoneSending ? 'Sending…' : 'Send code'}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="input max-w-[8rem] font-mono text-lg tracking-widest"
                  maxLength={6}
                  aria-label="Verification code"
                />
                <button
                  type="button"
                  onClick={handleConfirmPhone}
                  disabled={phoneConfirming || code.replace(/\D/g, '').length < 6}
                  className="btn-primary shrink-0"
                >
                  {phoneConfirming ? 'Verifying…' : 'Verify'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPhoneCodeSent(false);
                    setCode('');
                    setPhoneMessage(null);
                  }}
                  className="text-sm text-primary-600 hover:underline shrink-0"
                >
                  Use a different number
                </button>
              </div>
            )}
          </div>
          {phoneMessage && (
            <p
              className={`mt-3 text-sm ${
                phoneMessage.startsWith('Phone verified') ? 'text-green-600' : phoneMessage.startsWith('Invalid') || phoneMessage.startsWith('Failed') ? 'text-red-600' : 'text-gray-700'
              }`}
            >
              {phoneMessage}
            </p>
          )}
        </section>
      )}

      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm" aria-label="Verification checklist">
        <h3 className="font-medium text-gray-900">Checklist (Verified Individual)</h3>
        <ul className="mt-3 space-y-2 text-sm" role="list">
          <li className="flex items-center gap-2">
            {phoneOk ? <span className="text-green-600">✓</span> : <span className="text-amber-600">○</span>}
            <span>Phone verified</span>
            {!phoneOk && <span className="text-gray-500">— independent, do anytime</span>}
          </li>
          <li className="flex items-center gap-2">
            {profileComplete ? <span className="text-green-600">✓</span> : <span className="text-amber-600">○</span>}
            Step 1: Profile (Surname / Last name, First name, DOB, Phone, Address)
          </li>
          <li className="flex items-center gap-2">
            {identityOk ? <span className="text-green-600">✓</span> : <span className="text-amber-600">○</span>}
            Step 2: ID document (upload front & back, then confirm) — profile locked after this
          </li>
          <li className="flex items-center gap-2">
            {livenessOk ? <span className="text-green-600">✓</span> : <span className="text-amber-600">○</span>}
            Step 3: Liveness (camera) — then sent to admin for approval
          </li>
          <li className="flex items-center gap-2">
            <span className="text-gray-400">→</span>
            Apply for Registered Agent / Developer (after Verified Individual complete)
          </li>
        </ul>
      </section>

      <form onSubmit={handleSubmit} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="font-medium text-gray-900">Your information</h3>
        {identityOk && (
          <p className="mt-1 text-sm text-amber-700">
            ID verified. Name, date of birth and address can no longer be edited. You can still update phone until it is verified. Profile picture can be changed after upgrading to Registered Agent or Developer.
          </p>
        )}
        {verificationComplete && (
          <p className="mt-1 text-sm text-green-700">
            Verified Individual complete. You can apply for Registered Agent or Developer below.
          </p>
        )}
        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Profile picture (optional)</label>
            <p className="mt-1 text-xs text-gray-500">
              Not required before verification. If you don’t add one, it will be set from your liveness photo.
            </p>
            <div className="relative mt-2 h-24 w-24 overflow-hidden rounded-full bg-gray-100">
              <Image
                src={livenessOk && user.image ? user.image : '/avatar-guest.svg'}
                alt="Profile"
                fill
                className={livenessOk && user.image ? 'object-cover' : 'object-contain p-4'}
                unoptimized
              />
            </div>
            <div className="mt-2">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleProfileImageChange}
                className="sr-only"
                aria-label="Upload new profile picture"
              />
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                disabled={imageUploading}
                className="btn-secondary text-sm"
              >
                {imageUploading ? 'Uploading…' : 'Upload new photo'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">First name</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                disabled={!canEditNameDobAddress}
                className="input mt-1 w-full disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="First name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Middle name</label>
              <input
                type="text"
                value={middleName}
                onChange={(e) => setMiddleName(e.target.value)}
                disabled={!canEditNameDobAddress}
                className="input mt-1 w-full disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="Middle name (optional)"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Last name (surname)</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                disabled={!canEditNameDobAddress}
                className="input mt-1 w-full disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="Surname / family name"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Date of birth</label>
            <input
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              disabled={!canEditNameDobAddress}
              className="input mt-1 w-full disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={!canEditPhone}
              placeholder="+234..."
              className="input mt-1 w-full disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            {user.phoneVerifiedAt && <p className="mt-1 text-xs text-green-600">Phone verified</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Office address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              disabled={!canEditNameDobAddress}
              placeholder="Full address"
              className="input mt-1 w-full disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input type="email" value={email} disabled className="input mt-1 w-full bg-gray-50" />
          </div>
          {(user.role === 'registered_agent' || user.role === 'registered_developer') && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Position in company</label>
              <input
                type="text"
                value={companyPosition}
                onChange={(e) => setCompanyPosition(e.target.value)}
                placeholder="e.g. Agent, Director"
                className="input mt-1 w-full"
              />
            </div>
          )}
        </div>
        {message === 'success' && <p className="mt-3 text-sm text-green-600">Profile updated.</p>}
        {(message === 'error' || (message && message !== 'success')) && (
          <p className="mt-3 text-sm text-red-600">{message}</p>
        )}
        {canSaveProfile && (
          <button type="submit" disabled={saving} className="btn-primary mt-4">
            {saving ? 'Saving...' : 'Save profile'}
          </button>
        )}
      </form>

      {!profileComplete && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <h3 className="font-medium text-gray-900">Step 1: Complete your information above</h3>
          <p className="mt-1 text-sm text-gray-700">
            Fill Surname (last name), First name, Date of birth, Phone and Office address, then Save profile. Then you can proceed to ID upload.
          </p>
        </section>
      )}

      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="font-medium text-gray-900">Step 2: ID document</h3>
        {!profileComplete ? (
          <p className="mt-1 text-sm text-amber-700">
            Complete Step 1 (your information above) and save, then return here to upload your ID.
          </p>
        ) : !identityOk ? (
          <>
          <p className="mt-1 text-sm text-gray-500">
            Use your device camera to take pictures of both sides of your ID. Scan the front and back; your document is only saved after you compare and confirm or consent below.
          </p>
          <form onSubmit={handleIdUpload} className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Type of ID</label>
              <select
                value={idType}
                onChange={(e) => setIdType(e.target.value)}
                className="mt-1 block w-full max-w-xs rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                {ID_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">ID front (required)</label>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowIdCamera('front')}
                  className="btn-primary"
                >
                  {idFrontFile ? 'Retake front' : 'Capture ID front (camera)'}
                </button>
                {idFrontFile && (
                  <span className="text-sm text-green-600">Front captured</span>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">ID back (required)</label>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowIdCamera('back')}
                  className="btn-secondary"
                >
                  {idBackFile ? 'Retake back' : 'Capture ID back (camera)'}
                </button>
                {idBackFile && (
                  <span className="text-sm text-green-600">Back captured</span>
                )}
              </div>
            </div>
            <button type="submit" disabled={!idFrontFile || !idBackFile || idUploading} className="btn-primary">
              {idUploading ? 'Uploading…' : 'Upload ID'}
            </button>
          </form>
          {showIdCamera && (
            <IdDocumentCamera
              side={showIdCamera}
              onCapture={(file) => {
                if (showIdCamera === 'front') setIdFrontFile(file);
                else setIdBackFile(file);
                setShowIdCamera(null);
              }}
              onCancel={() => setShowIdCamera(null)}
            />
          )}
          {idUploadResult && (
            <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm font-medium text-gray-900">ID uploaded. Compare and continue</p>
              <p className="mt-1 text-xs text-gray-500">
                Check detected ID data against your profile before confirming or consenting.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Detected on uploaded ID
                  </h4>
                  <p className="mt-0.5 text-xs text-gray-400">Format: Surname (last name), First name (Middle name)</p>
                  {idUploadResult.scanned ? (
                    <dl className="mt-2 space-y-1 text-sm">
                      <div>
                        <dt className="text-gray-500">Surname (last name)</dt>
                        <dd className="font-medium text-gray-900">{idUploadResult.scanned.lastName || '—'}</dd>
                      </div>
                      <div>
                        <dt className="text-gray-500">First name</dt>
                        <dd className="font-medium text-gray-900">{idUploadResult.scanned.firstName || '—'}</dd>
                      </div>
                      <div>
                        <dt className="text-gray-500">Middle name</dt>
                        <dd className="font-medium text-gray-900">{idUploadResult.scanned.middleName || '—'}</dd>
                      </div>
                      <div>
                        <dt className="text-gray-500">Date of birth</dt>
                        <dd className="font-medium text-gray-900">{idUploadResult.scanned.dateOfBirth || '—'}</dd>
                      </div>
                      {idUploadResult.scanned.expiryDate ? (
                        <div>
                          <dt className="text-gray-500">Expiry date</dt>
                          <dd className={`font-medium ${isIdExpired ? 'text-red-600' : 'text-gray-900'}`}>
                            {idUploadResult.scanned.expiryDate}
                            {isIdExpired && ' (expired)'}
                          </dd>
                        </div>
                      ) : null}
                    </dl>
                  ) : (
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">No data detected from this ID image.</p>
                      <p className="mt-1 text-xs text-gray-400">What OCR read:</p>
                      <pre className="mt-1 max-h-28 overflow-auto rounded bg-gray-100 p-2 text-xs text-gray-700 whitespace-pre-wrap break-words">
                        {idUploadResult.rawOcrPreview?.trim() || '(nothing — try a clearer photo or different image)'}
                      </pre>
                    </div>
                  )}
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Your profile
                  </h4>
                  <dl className="mt-2 space-y-1 text-sm">
                    <div>
                      <dt className="text-gray-500">Surname (last name)</dt>
                      <dd className="font-medium text-gray-900">{effectiveLast || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">First name</dt>
                      <dd className="font-medium text-gray-900">{effectiveFirst || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Middle name</dt>
                      <dd className="font-medium text-gray-900">{effectiveMiddle || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Date of birth</dt>
                      <dd className="font-medium text-gray-900">{effectiveDob || '—'}</dd>
                    </div>
                  </dl>
                </div>
              </div>
              <div className="mt-4 border-t border-gray-200 pt-4">
                {isIdExpired ? (
                  <p className="text-sm text-red-700">
                    This ID has expired. Please use a valid, unexpired ID and upload both front and back again.
                  </p>
                ) : idUploadResult.scanned ? (
                  scannedMatches ? (
                    <>
                      <p className="text-sm text-green-700">Detected ID matches your profile. Confirm to proceed.</p>
                      <button
                        type="button"
                        onClick={handleIdConfirm}
                        disabled={idConfirming}
                        className="btn-primary mt-3"
                      >
                        {idConfirming ? '…' : 'Confirm and proceed to Liveness'}
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-amber-700">
                        Detected ID does not match your profile. Use scanned data to save it and proceed.
                      </p>
                      <button
                        type="button"
                        onClick={handleUseScannedData}
                        disabled={idConsentSaving}
                        className="btn-secondary mt-2"
                      >
                        {idConsentSaving ? '…' : 'Use scanned data and proceed'}
                      </button>
                    </>
                  )
                ) : (
                  <p className="text-sm text-amber-700">
                    Detection required. Upload a clearer image of your ID so we can detect your name and date of birth before you proceed. You cannot continue without detected data.
                  </p>
                )}
              </div>
            </div>
          )}
          </>
        ) : (
          <p className="mt-1 text-sm text-green-600">ID document verified.</p>
        )}
      </section>

      {identityOk && !livenessOk && (
        <section ref={livenessSectionRef} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="font-medium text-gray-900">Step 3: Liveness (face verification)</h3>
          <p className="mt-1 text-sm text-gray-500">
            Use your device camera. Centre your face, then blink, turn head, smile. The final photo will be your profile picture until you become a Registered Agent or Developer.
          </p>
          {!showLivenessCamera ? (
            <button
              type="button"
              onClick={() => setShowLivenessCamera(true)}
              disabled={livenessUploading}
              className="btn-primary mt-3"
            >
              {livenessUploading ? 'Verifying…' : 'Start Liveness'}
            </button>
          ) : (
            <div className="mt-4">
              <LivenessCamera
                onSuccess={handleLivenessSuccess}
                onCancel={() => setShowLivenessCamera(false)}
                onError={(msg) => setLivenessMessage(msg)}
                isUploading={livenessUploading}
              />
            </div>
          )}
          {livenessMessage && <p className="mt-2 text-sm text-gray-700">{livenessMessage}</p>}
        </section>
      )}

      {verificationComplete && (
        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="font-medium text-gray-900">Apply for Registered Agent / Developer</h3>
          <p className="mt-1 text-sm text-gray-500">
            Verified Individual complete. Upload documents, choose type, and submit to apply for Registered Agent or Developer.
          </p>
          <form onSubmit={handleSubmitRequest} className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Type</label>
              <select
                value={requestType}
                onChange={(e) => setRequestType(e.target.value)}
                className="input mt-1 w-full max-w-xs"
              >
                {VERIFICATION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            {(requestType === 'registered_agent' || requestType === 'registered_developer') && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Position in company</label>
                <select
                  value={requestCompanyPosition}
                  onChange={(e) => setRequestCompanyPosition(e.target.value)}
                  className="input mt-1 w-full max-w-xs"
                >
                  <option value="">Select…</option>
                  {COMPANY_POSITIONS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700">Documents (upload from your device)</label>
              <p className="mt-1 text-xs text-gray-500">
                Select files from your device only. Do not paste links or URLs.
              </p>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={(e) => setDocFiles((prev) => [...prev, ...Array.from(e.target.files ?? [])])}
                className="input mt-2 block w-full text-sm"
                aria-label="Choose document files from your device"
              />
              {docFiles.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm text-gray-600">
                  {docFiles.map((f, i) => (
                    <li key={i} className="flex items-center gap-2">
                      {f.name}
                      <button
                        type="button"
                        onClick={() => setDocFiles((p) => p.filter((_, j) => j !== i))}
                        className="text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Message (optional)</label>
              <textarea
                value={requestMessage}
                onChange={(e) => setRequestMessage(e.target.value)}
                rows={2}
                className="input mt-1 w-full"
                placeholder="Note for reviewer"
              />
            </div>
            {submitError && <p className="text-sm text-red-600">{submitError}</p>}
            <button type="submit" disabled={submitting || docFiles.length < 1} className="btn-primary">
              {submitting ? 'Submitting…' : 'Submit request'}
            </button>
          </form>
        </section>
      )}

      {requests.length > 0 && (
        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="font-medium text-gray-900">Your verification requests</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {requests.map((r) => (
              <li key={r._id} className="flex flex-wrap items-center gap-2">
                <span className="font-medium">
                  {r.type === 'verified_individual'
                    ? 'Verified Individual'
                    : r.type === 'registered_agent'
                      ? 'Registered Agent'
                      : 'Registered Developer'}
                </span>
                <span
                  className={
                    r.status === 'approved'
                      ? 'text-green-600'
                      : r.status === 'rejected'
                        ? 'text-red-600'
                        : 'text-amber-600'
                  }
                >
                  {r.status}
                </span>
                {r.rejectionReason && <span className="text-gray-500">— {r.rejectionReason}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {submitError && !idUploadResult && (
        <p className="text-sm text-red-600">{submitError}</p>
      )}

      <p>
        <Link href="/dashboard" className="text-sm text-primary-600 hover:underline">
          ← Dashboard
        </Link>
      </p>
    </div>
  );
}
