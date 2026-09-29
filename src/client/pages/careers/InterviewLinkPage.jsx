import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Video, Mic, Wifi, Clock3, Mail, MessageSquare, CircleCheck, CircleAlert, Copy, Check } from 'lucide-react';
import { api, setInterviewSession } from '../../services/api.js';
import CareersShell from './CareersShell.jsx';
import InterviewRoomPage from '../candidate/InterviewRoomPage.jsx';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import LoadingState from '../../components/ui/LoadingState.jsx';

const linkApi = {
  get: (token) => api.get(`/public/interviews/${token}`),
  session: (token) => api.post(`/public/interviews/${token}/session`),
  send: (token, channel) => api.post(`/public/interviews/${token}/send`, { channel }),
};

const formatDate = (d) =>
  new Date(d).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

// Build plan P5 (§9) — /interview/:token: the instant interview link.
// Pre-check → "Start now" (exchanges the link for a session scoped to this
// interview and opens the existing interview room) or "Send me the link".
export default function InterviewLinkPage() {
  const { token } = useParams();
  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);
  const [inRoom, setInRoom] = useState(null); // interviewId once joined
  const [sendState, setSendState] = useState({});
  const [copied, setCopied] = useState(false);

  const load = () => {
    setError('');
    linkApi
      .get(token)
      .then(setInfo)
      .catch((err) => setError(err.message));
  };

  useEffect(load, [token]);

  const start = async () => {
    setJoining(true);
    setError('');
    try {
      const s = await linkApi.session(token);
      setInterviewSession({ token: s.sessionToken, interviewId: s.interviewId });
      setInRoom(s.interviewId);
    } catch (err) {
      setError(err.message);
      load();
    } finally {
      setJoining(false);
    }
  };

  const send = async (channel) => {
    setSendState({ [channel]: 'sending' });
    try {
      const r = await linkApi.send(token, channel);
      setSendState({ [channel]: `Sent to ${r.to}` });
    } catch (err) {
      setSendState({ [channel]: err.message, error: true });
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  if (inRoom) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6">
        <InterviewRoomPage
          interviewIdOverride={inRoom}
          doneLabel="Close"
          onDone={() => {
            setInterviewSession(null);
            setInRoom(null);
            load();
          }}
        />
      </div>
    );
  }

  if (!info && !error) {
    return (
      <CareersShell narrow>
        <LoadingState label="Opening your interview…" />
      </CareersShell>
    );
  }

  if (!info) {
    return (
      <CareersShell narrow>
        <Card className="p-6 text-center sm:p-8">
          <CircleAlert className="mx-auto mb-3 h-10 w-10 text-slate-400" />
          <h1 className="text-lg font-semibold text-slate-900">This link can't be opened</h1>
          <p className="mt-2 text-sm text-slate-600">{error}</p>
          <Link to="/auth/login" className="mt-5 inline-block">
            <Button variant="secondary">Log in to your account</Button>
          </Link>
        </Card>
      </CareersShell>
    );
  }

  const company = { name: info.company.name, logoUrl: info.company.logoUrl };

  if (!info.canJoin) {
    const done = info.reason === 'INTERVIEW_COMPLETED';
    return (
      <CareersShell company={company} narrow>
        <Card className="p-6 text-center sm:p-8">
          {done ? (
            <CircleCheck className="mx-auto mb-3 h-10 w-10 text-emerald-600" />
          ) : (
            <CircleAlert className="mx-auto mb-3 h-10 w-10 text-amber-500" />
          )}
          <h1 className="text-lg font-semibold text-slate-900">{done ? 'Interview complete' : 'This link is no longer active'}</h1>
          <p className="mt-2 text-sm text-slate-600">{info.message}</p>
          <p className="mt-1 text-xs text-slate-400">
            {info.job.title} · {info.company.name}
          </p>
        </Card>
      </CareersShell>
    );
  }

  return (
    <CareersShell company={company} narrow>
      <Card className="p-4 sm:p-6">
        <p className="text-sm text-slate-500">Hi {info.candidateName},</p>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">Your interview for {info.job.title}</h1>
        <p className="mt-1 text-sm text-slate-500">
          An AI interviewer from {info.company.name} will ask you questions by voice.
          {info.expiresAt && ` This link works until ${formatDate(info.expiresAt)}.`}
        </p>

        <ul className="my-5 grid grid-cols-1 gap-2 text-sm text-slate-700 sm:grid-cols-2">
          {[
            [Video, 'Camera on, face clearly visible'],
            [Mic, 'Microphone allowed, quiet room'],
            [Wifi, 'Stable internet connection'],
            [Clock3, 'About 20–30 minutes'],
          ].map(([Icon, text]) => (
            <li key={text} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
              <Icon className="h-4 w-4 shrink-0 text-brand-600" /> {text}
            </li>
          ))}
        </ul>

        {info.status === 'IN_PROGRESS' && (
          <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">You started this interview earlier — you can continue where you left off.</p>
        )}
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

        <Button onClick={start} loading={joining} className="w-full sm:w-auto">
          {info.status === 'IN_PROGRESS' ? 'Continue interview' : 'Start interview now'}
        </Button>
        <p className="mt-2 text-xs text-slate-400">You'll check your camera and microphone before the interview begins.</p>
      </Card>

      <Card className="mt-4 p-4 sm:p-6">
        <h2 className="text-sm font-semibold text-slate-900">Not ready yet?</h2>
        <p className="mt-1 text-sm text-slate-500">Send yourself this link and come back any time before it expires.</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Button variant="secondary" loading={sendState.email === 'sending'} onClick={() => send('email')} className="w-full sm:w-auto">
            <Mail className="h-4 w-4" /> Email me ({info.channels.email})
          </Button>
          {info.channels.sms && (
            <Button variant="secondary" loading={sendState.sms === 'sending'} onClick={() => send('sms')} className="w-full sm:w-auto">
              <MessageSquare className="h-4 w-4" /> Text me ({info.channels.sms})
            </Button>
          )}
          <Button variant="ghost" onClick={copy} className="w-full sm:w-auto">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? 'Copied' : 'Copy link'}
          </Button>
        </div>
        {Object.entries(sendState)
          .filter(([k, v]) => k !== 'error' && v !== 'sending')
          .map(([k, v]) => (
            <p key={k} className={`mt-2 text-sm ${sendState.error ? 'text-red-600' : 'text-emerald-700'}`}>
              {v}
            </p>
          ))}
      </Card>
    </CareersShell>
  );
}
