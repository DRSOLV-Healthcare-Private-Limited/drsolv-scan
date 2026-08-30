import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  fetchBystander, requestAccess, verifyAccess, fetchFull,
  type BystanderProfile, type FullProfile,
} from './api';

const NAVY = '#0a2540';
const EMERGENCY_NUMBERS = [
  { label: 'National Emergency', num: '112' },
  { label: 'Ambulance', num: '108' },
  { label: 'Medical', num: '102' },
];

type Gate = 'card' | 'request' | 'otp' | 'full';

export default function ScanPage() {
  const { token } = useParams<{ token: string }>();
  const [profile, setProfile] = useState<BystanderProfile | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'notfound' | 'error'>('loading');

  // doctor-gate state
  const [gate, setGate] = useState<Gate>('card');
  const [accessorPhone, setAccessorPhone] = useState('');
  const [regNumber, setRegNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [gateMsg, setGateMsg] = useState('');
  const [gateErr, setGateErr] = useState('');
  const [session, setSession] = useState('');
  const [full, setFull] = useState<FullProfile | null>(null);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!token || token === 'invalid') { setStatus('notfound'); return; }
    fetchBystander(token)
      .then((p) => { setProfile(p); setStatus('ok'); })
      .catch((e) => setStatus(e.message === 'notfound' ? 'notfound' : 'error'));
  }, [token]);

  // session countdown — when it hits zero, drop back to the bystander card
  useEffect(() => {
    if (gate !== 'full' || remaining <= 0) return;
    const t = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(t);
          setGate('card'); setFull(null); setSession('');
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [gate, remaining]);

  async function doRequest() {
    setGateErr(''); setBusy(true);
    try {
      const msg = await requestAccess(token!, accessorPhone.trim(), regNumber.trim());
      setGateMsg(msg); setGate('otp');
    } catch (e: any) { setGateErr(e.message || 'Could not request access'); }
    finally { setBusy(false); }
  }

  async function doVerify() {
    setGateErr(''); setBusy(true);
    try {
      const { session: s, expiresInSeconds } = await verifyAccess(token!, otp.trim());
      setSession(s);
      const data = await fetchFull(token!, s);
      setFull(data);
      setRemaining(expiresInSeconds);
      setGate('full');
    } catch (e: any) { setGateErr(e.message || 'Verification failed'); }
    finally { setBusy(false); }
  }

  if (status === 'loading') return <Screen><div className="animate-pulse text-slate-400 text-sm">Loading emergency profile...</div></Screen>;
  if (status === 'notfound') return <Screen><NotFound /><EmergencyBar /></Screen>;
  if (status === 'error' || !profile) return <Screen><LoadError /><EmergencyBar /></Screen>;

  // FULL doctor view
  if (gate === 'full' && full) {
    return (
      <Screen>
        <div className="w-full max-w-md">
          <div className="rounded-t-3xl px-6 py-3 text-white text-center flex items-center justify-between" style={{ background: NAVY }}>
            <span className="text-xs uppercase tracking-widest opacity-80">Full Medical Record</span>
            <span className="text-xs font-mono bg-white/15 rounded px-2 py-0.5">{fmt(remaining)}</span>
          </div>
          <div className="rounded-b-3xl bg-white shadow-lg border border-slate-100 px-6 py-6 space-y-4">
            <div className="flex items-center gap-4">
              {full.photoUrl
                ? <img src={full.photoUrl} alt="" className="h-16 w-16 rounded-xl object-cover border border-slate-100" />
                : <div className="h-16 w-16 rounded-xl bg-slate-100" />}
              <div>
                <h1 className="text-xl font-bold" style={{ color: NAVY }}>{full.fullName}</h1>
                <p className="text-sm text-slate-500">{[full.age ? full.age + ' yrs' : null, full.gender].filter(Boolean).join(' \u00b7 ')}</p>
              </div>
              <span className="ml-auto text-2xl font-black text-red-600">{full.bloodGroup}</span>
            </div>

            <Detail label="Phone" value={full.phone} />
            <Detail label="Languages" value={full.languages} />
            {full.vitals && <Detail label="Weight / Height" value={[full.vitals.weight && full.vitals.weight + ' kg', full.vitals.height && full.vitals.height + ' cm'].filter(Boolean).join('  ') } />}

            <div className="pt-2 border-t border-slate-100">
              <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Medical history</p>
              <div className="space-y-1.5">
                {full.medicalHistory && Object.entries(full.medicalHistory)
                  .filter(([, v]) => v && String(v).trim())
                  .map(([k, v]) => <Detail key={k} label={pretty(k)} value={String(v)} />)}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <Detail label="Emergency contact" value={`${full.emergencyContact?.name ?? ''} (${full.emergencyContact?.relation ?? ''}) \u00b7 ${full.emergencyContact?.phone ?? ''}`} />
            </div>
          </div>
          <p className="mt-3 text-center text-xs text-slate-400">This access is logged. Record closes when the timer ends.</p>
        </div>
      </Screen>
    );
  }

  // REQUEST access form
  if (gate === 'request') {
    return (
      <Screen>
        <GateCard title="Healthcare professional access" onBack={() => setGate('card')}>
          <p className="text-sm text-slate-500">A one-time code will be sent to the cardholder's registered phone. Ask them to share it with you.</p>
          <label className="block">
            <span className="text-xs font-medium text-slate-500">Your phone number</span>
            <input inputMode="numeric" value={accessorPhone} onChange={(e) => setAccessorPhone(e.target.value.replace(/\D/g, ''))} className={inp} placeholder="10-digit number" />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-500">Medical registration number</span>
            <input value={regNumber} onChange={(e) => setRegNumber(e.target.value)} className={inp} placeholder="Registration no." />
          </label>
          {gateErr && <p className="text-sm text-red-600">{gateErr}</p>}
          <button onClick={doRequest} disabled={busy || accessorPhone.length < 10} className={btn}>
            {busy ? 'Sending...' : 'Send access code to cardholder'}
          </button>
        </GateCard>
      </Screen>
    );
  }

  // OTP entry
  if (gate === 'otp') {
    return (
      <Screen>
        <GateCard title="Enter access code" onBack={() => setGate('request')}>
          <p className="text-sm text-slate-500">{gateMsg}</p>
          <input inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
            className={inp + ' text-center text-2xl tracking-[0.4em] font-semibold'} placeholder="------" />
          {gateErr && <p className="text-sm text-red-600">{gateErr}</p>}
          <button onClick={doVerify} disabled={busy || otp.length < 4} className={btn}>
            {busy ? 'Verifying...' : 'View full record'}
          </button>
        </GateCard>
      </Screen>
    );
  }

  // BYSTANDER card (default)
  const ec = profile.emergencyContact || {};
  return (
    <Screen>
      <div className="w-full max-w-md">
        <div className="rounded-t-3xl px-6 py-4 text-white text-center" style={{ background: NAVY }}>
          <p className="text-xs uppercase tracking-widest opacity-80">DRSOLV Emergency Profile</p>
        </div>
        <div className="rounded-b-3xl bg-white shadow-lg border border-slate-100 px-6 py-6">
          <div className="flex flex-col items-center">
            {profile.photoUrl
              ? <img src={profile.photoUrl} alt="" className="h-28 w-28 rounded-2xl object-cover border-2 border-slate-100 shadow" />
              : <div className="h-28 w-28 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-300 text-4xl">?</div>}
            <h1 className="mt-3 text-2xl font-bold" style={{ color: NAVY }}>{profile.fullName || 'Unknown'}</h1>
            <p className="text-sm text-slate-500">{[profile.age ? profile.age + ' yrs' : null, profile.gender].filter(Boolean).join(' \u00b7 ')}</p>
          </div>
          {profile.bloodGroup && (
            <div className="mt-5 rounded-2xl bg-red-50 border border-red-100 py-4 text-center">
              <p className="text-xs uppercase tracking-wide text-red-400">Blood Group</p>
              <p className="text-4xl font-black text-red-600 leading-tight">{profile.bloodGroup}</p>
            </div>
          )}
          {ec.phone && (
            <a href={`tel:${ec.phone}`} className="mt-4 flex items-center justify-between rounded-2xl border border-slate-200 px-5 py-4 hover:bg-slate-50 transition">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Emergency Contact</p>
                <p className="text-base font-semibold" style={{ color: NAVY }}>{ec.name || 'Contact'}</p>
                {ec.relation && <p className="text-xs text-slate-500">{ec.relation}</p>}
              </div>
              <span className="flex items-center gap-2 rounded-xl px-4 py-2 text-white text-sm font-semibold" style={{ background: NAVY }}>
                <span dangerouslySetInnerHTML={{ __html: '&#128222;' }} /> Call
              </span>
            </a>
          )}
        </div>

        <EmergencyBar />

        <button onClick={() => { setGate('request'); setGateErr(''); }} className="mt-4 w-full rounded-2xl border-2 border-[#0a2540] py-3 text-center text-base font-semibold text-[#0a2540] hover:bg-[#0a2540] hover:text-white transition">
          Healthcare professional? View full medical record
        </button>
      </div>
    </Screen>
  );
}

function Detail({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-slate-400">{label}</span>
      <span className="text-right font-medium" style={{ color: NAVY }}>{value}</span>
    </div>
  );
}

function GateCard({ title, onBack, children }: { title: string; onBack: () => void; children: React.ReactNode }) {
  return (
    <div className="w-full max-w-md">
      <div className="rounded-3xl bg-white shadow-lg border border-slate-100 px-6 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold" style={{ color: NAVY }}>{title}</h2>
          <button onClick={onBack} className="text-xs text-slate-400 hover:text-slate-600">Back</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function NotFound() {
  return <div className="text-center"><p className="text-lg font-semibold" style={{ color: NAVY }}>Profile not found</p><p className="mt-1 text-sm text-slate-500">This code is not linked to an active DRSOLV profile.</p></div>;
}
function LoadError() {
  return <div className="text-center"><p className="text-lg font-semibold" style={{ color: NAVY }}>Could not load profile</p><p className="mt-1 text-sm text-slate-500">Please try again, or call emergency services now.</p></div>;
}

function Screen({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4" style={{ background: 'linear-gradient(160deg,#eef3fb,#f8fafc)' }}>{children}</div>;
}

function EmergencyBar() {
  return (
    <div className="mt-4 w-full max-w-md">
      <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">Call emergency services</p>
      <div className="grid grid-cols-3 gap-2">
        {EMERGENCY_NUMBERS.map((e) => (
          <a key={e.num} href={`tel:${e.num}`} className="flex flex-col items-center rounded-2xl bg-red-600 py-3 text-white shadow hover:bg-red-700 transition">
            <span className="text-2xl font-black leading-none">{e.num}</span>
            <span className="mt-1 text-[10px] uppercase tracking-wide opacity-90">{e.label}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

function fmt(s: number) { const m = Math.floor(s / 60); const r = s % 60; return `${m}:${r.toString().padStart(2, '0')}`; }
function pretty(k: string) {
  const map: Record<string, string> = {
    chiefComplaint: 'Chief complaint', drugTreatment: 'Drug / treatment',
    smoking: 'Smoking', alcohol: 'Alcohol', diet: 'Diet', sleep: 'Sleep', menstrual: 'Menstrual',
    allergies: 'Allergies', conditions: 'Conditions', medications: 'Medications', surgeries: 'Surgeries',
  };
  return map[k] || k.charAt(0).toUpperCase() + k.slice(1);
}

const inp = 'mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#6991d6]';
const btn = 'w-full rounded-xl py-3 text-sm font-semibold text-white shadow disabled:opacity-40 bg-[#0a2540]';
