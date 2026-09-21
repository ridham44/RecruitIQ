import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { applicationsApi } from '../../services/applications.js';
import Card from '../../components/ui/Card.jsx';
import LoadingState from '../../components/ui/LoadingState.jsx';
import ErrorState from '../../components/ui/ErrorState.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';
import ScoreRing from '../../components/ui/ScoreRing.jsx';

const STEPS = ['APPLIED', 'SCREENING', 'SHORTLISTED'];

export default function ApplicationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [application, setApplication] = useState(null);
  const [error, setError] = useState('');

  const load = () => {
    setError('');
    applicationsApi
      .getMine(id)
      .then((data) => setApplication(data.application))
      .catch((err) => setError(err.message));
  };

  useEffect(load, [id]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!application) return <LoadingState />;

  const { job, resume, screeningResult: result, status } = application;
  const isRejected = status === 'REJECTED';
  const currentStepIndex = STEPS.indexOf(status);

  return (
    <div className="mx-auto max-w-2xl">
      <button onClick={() => navigate(-1)} className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="mb-6">
        <h2 className="text-xl font-semibold text-slate-900">{job.title}</h2>
        <p className="text-sm text-slate-500">
          <Link to={`/candidate/jobs/${job.id}`} className="hover:text-brand-600">
            {job.company.name}
          </Link>
        </p>
      </div>

      <Card className="mb-6 p-6">
        <h3 className="mb-4 font-semibold text-slate-900">Application status</h3>
        {isRejected ? (
          <StatusBadge status="REJECTED" />
        ) : (
          <div className="flex items-center">
            {STEPS.map((step, idx) => (
              <div key={step} className="flex flex-1 items-center">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    idx <= currentStepIndex ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {idx + 1}
                </div>
                {idx < STEPS.length - 1 && (
                  <div className={`h-0.5 flex-1 ${idx < currentStepIndex ? 'bg-brand-600' : 'bg-slate-100'}`} />
                )}
              </div>
            ))}
          </div>
        )}
        <div className="mt-3">
          <StatusBadge status={status} />
        </div>
      </Card>

      {result?.status === 'COMPLETED' && (
        <Card className="mb-6 p-6">
          <div className="flex items-center gap-4">
            <ScoreRing score={result.overallScore} size={56} />
            <div>
              <p className="font-semibold text-slate-900">Your match score</p>
              <p className="text-sm text-slate-500">Based on skills, experience, and education alignment</p>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-6">
        <h3 className="mb-2 font-semibold text-slate-900">Resume submitted</h3>
        <p className="text-sm text-slate-600">{resume.fileName}</p>
      </Card>
    </div>
  );
}
