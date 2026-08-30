const RAW = import.meta.env.VITE_API_BASE as string;
const BASE = RAW.endsWith('/') ? RAW : RAW + '/';

export interface EmergencyContact { name?: string; relation?: string; phone?: string; }

export interface BystanderProfile {
  fullName?: string;
  age?: number;
  gender?: string;
  bloodGroup?: string;
  photoUrl?: string;
  emergencyContact?: EmergencyContact;
}

export interface FullProfile extends BystanderProfile {
  dob?: string;
  phone?: string;
  languages?: string;
  vitals?: Record<string, string>;
  medicalHistory?: Record<string, string>;
  enrolledByStation?: string;
  createdAt?: string;
}

export async function fetchBystander(token: string): Promise<BystanderProfile | null> {
  const res = await fetch(BASE + 'scan/' + encodeURIComponent(token));
  if (res.status === 404) throw new Error('notfound');
  if (!res.ok) throw new Error('error');
  const data = await res.json();
  return data.profile ?? null;
}

export async function requestAccess(token: string, accessorPhone: string, regNumber: string): Promise<string> {
  const res = await fetch(BASE + 'scan/' + encodeURIComponent(token) + '/request-access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessorPhone, regNumber }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Could not request access');
  return data.message as string;
}

export interface VerifyResult { session: string; expiresInSeconds: number; }

export async function verifyAccess(token: string, otp: string): Promise<VerifyResult> {
  const res = await fetch(BASE + 'scan/' + encodeURIComponent(token) + '/verify-access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ otp }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Verification failed');
  return { session: data.session, expiresInSeconds: data.expiresInSeconds ?? 180 };
}

export async function fetchFull(token: string, session: string): Promise<FullProfile | null> {
  const res = await fetch(BASE + 'scan/' + encodeURIComponent(token) + '/full', {
    headers: { Authorization: `Bearer ${session}` },
  });
  if (res.status === 401) throw new Error('expired');
  if (!res.ok) throw new Error('error');
  const data = await res.json();
  return data.profile ?? null;
}
