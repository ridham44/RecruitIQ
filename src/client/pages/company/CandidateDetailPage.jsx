import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Mail, Phone, MapPin, ThumbsUp, ThumbsDown } from 'lucide-react';
import { applicationsApi } from '../../services/applications.js';
import { screeningApi } from '../../services/screening.js';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import LoadingState from '../../components/ui/LoadingState.jsx';
import ErrorState from '../../components/ui/ErrorState.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';
import ScoreRing from '../../components/ui/ScoreRing.jsx';

export default function CandidateDetailPage() {
  const { id: jobId, candidateId } = useParams();
  const navigate = useNavigate();
  const [application, setApplication] = useState(null);
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);

  const load = () => {
    setError('');
    applicationsApi
      .getCandidateDetail(jobId, candidateId)
      .then((data) => setApplication(data.application))
      .catch((err) => setError(err.message));
  };

  useEffect(load, [jobId, candidateId]);

  const handleRunScreening = async () => {
    setRunning(true);
    setError('');
    try {
      await screeningApi.runForApplication(application.id);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  };

  if (error && !application) return <ErrorState message={error} onRetry={load} />;
  if (!application) return <LoadingState />;

  const { candidate, resume, screeningResult: result } = application;
  const parsed = resume?.parsedData;

  return (
    <div className="mx-auto max-w-4xl">
      <button
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-slate-900">{candidate.fullName}</h2>
            <StatusBadge status={application.status} />
          </div>
          <div className="mt-1 flex flex-wrap gap-4 text-sm text-slate-500">
            {candidate.phone && (
              <span className="flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" /> {candidate.phone}
              </span>
            )}
            {candidate.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> {candidate.location}
              </span>
            )}
          </div>
        </div>
        {result?.status !== 'COMPLETED' && (
          <Button onClick={handleRunScreening} loading={running} className="w-full sm:w-auto">
            <Sparkles className="h-4 w-4" /> Run AI Screening
          </Button>
        )}
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {result?.status === 'COMPLETED' && (
        <Card className="mb-6 p-6">
          <div className="mb-4 flex items-center gap-4">
            <ScoreRing score={result.overallScore} size={64} />
            <div>
              <p className="font-semibold text-slate-900">Overall match score</p>
              <p className="text-sm text-slate-500">AI model: {result.aiModel}</p>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-3 gap-4 text-center">
            <SubScore label="Skills" score={result.skillMatchScore} />
            <SubScore label="Experience" score={result.experienceMatchScore} />
            <SubScore label="Education" score={result.educationMatchScore} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <h4 className="mb-2 flex items-center gap-1 text-sm font-semibold text-emerald-700">
                <ThumbsUp className="h-4 w-4" /> Matched skills
              </h4>
              <TagList items={result.matchedSkills} tone="emerald" />
            </div>
            <div>
              <h4 className="mb-2 flex items-center gap-1 text-sm font-semibold text-red-700">
                <ThumbsDown className="h-4 w-4" /> Missing skills
              </h4>
              <TagList items={result.missingSkills} tone="red" />
            </div>
          </div>

          {result.strengths?.length > 0 && (
            <div className="mt-4">
              <h4 className="mb-1 text-sm font-semibold text-slate-900">Strengths</h4>
              <ul className="list-inside list-disc text-sm text-slate-600">
                {result.strengths.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          )}

          {result.concerns?.length > 0 && (
            <div className="mt-4">
              <h4 className="mb-1 text-sm font-semibold text-slate-900">Concerns</h4>
              <ul className="list-inside list-disc text-sm text-slate-600">
                {result.concerns.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          )}

          {result.reasoning && (
            <div className="mt-4 rounded-lg bg-slate-50 p-4">
              <h4 className="mb-1 text-sm font-semibold text-slate-900">AI reasoning</h4>
              <p className="text-sm text-slate-600">{result.reasoning}</p>
            </div>
          )}
        </Card>
      )}

      {result?.status === 'FAILED' && (
        <Card className="mb-6 p-6">
          <p className="text-sm text-red-600">Screening failed: {result.errorMessage}</p>
        </Card>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        <Card className="p-6">
          <h3 className="mb-3 font-semibold text-slate-900">Skills</h3>
          <TagList items={parsed?.skills || candidate.skills} tone="brand" />
        </Card>
        <Card className="p-6">
          <h3 className="mb-3 font-semibold text-slate-900">Experience</h3>
          {parsed?.experience?.length ? (
            <ul className="space-y-2 text-sm text-slate-600">
              {parsed.experience.map((exp, idx) => (
                <li key={idx}>
                  <span className="font-medium text-slate-900">{exp.role}</span> at {exp.company} ({exp.duration})
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-400">No experience data extracted</p>
          )}
        </Card>
      </div>

      <Card className="mt-6 p-6">
        <h3 className="mb-3 font-semibold text-slate-900">Education</h3>
        {candidate.degree || candidate.university || candidate.college || candidate.latestSpi ? (
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {candidate.degree && (
              <div>
                <dt className="text-xs text-slate-400">Degree</dt>
                <dd className="text-slate-800">{candidate.degree}</dd>
              </div>
            )}
            {candidate.university && (
              <div>
                <dt className="text-xs text-slate-400">University</dt>
                <dd className="text-slate-800">{candidate.university}</dd>
              </div>
            )}
            {candidate.college && (
              <div>
                <dt className="text-xs text-slate-400">College / Institute</dt>
                <dd className="text-slate-800">{candidate.college}</dd>
              </div>
            )}
            {candidate.latestSpi != null && (
              <div>
                <dt className="text-xs text-slate-400">{candidate.academicStatus === 'ONGOING' ? 'Latest SPI' : 'Final SPI'}</dt>
                <dd className="text-slate-800">
                  {candidate.latestSpi}
                  {candidate.academicStatus === 'ONGOING' && candidate.currentSemester ? ` (Semester ${candidate.currentSemester})` : ''}
                </dd>
              </div>
            )}
          </dl>
        ) : (
          <p className="text-sm text-slate-400">No academic information provided</p>
        )}
      </Card>

      <Card className="mt-6 p-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Resume</h3>
          <span className="text-xs text-slate-400">{resume?.fileName}</span>
        </div>
        <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-xs text-slate-600">
          {resume?.rawText || 'No resume text available'}
        </pre>
      </Card>
    </div>
  );
}

function SubScore({ label, score }) {
  return (
    <div className="rounded-lg bg-slate-50 py-3">
      <p className="text-lg font-semibold text-slate-900">{Math.round(score)}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

function TagList({ items, tone }) {
  if (!items?.length) return <p className="text-sm text-slate-400">None</p>;
  const cls = { emerald: 'bg-emerald-50 text-emerald-700', red: 'bg-red-50 text-red-700', brand: 'bg-brand-50 text-brand-700' }[tone];
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span key={item} className={`rounded-full px-2.5 py-1 text-xs font-medium ${cls}`}>
          {item}
        </span>
      ))}
    </div>
  );
}
