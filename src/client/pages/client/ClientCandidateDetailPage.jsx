import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, FileText, Download } from 'lucide-react';
import { clientPortalApi } from '../../services/clientPortal.js';
import SubmissionPackage from '../../components/SubmissionPackage.jsx';
import Button from '../../components/ui/Button.jsx';
import LoadingState from '../../components/ui/LoadingState.jsx';
import ErrorState from '../../components/ui/ErrorState.jsx';
import SecondRoundPanel from '../../components/SecondRoundPanel.jsx';

// Build plan P8 — /client/candidates/:id: one shared candidate (opening it
// marks the submission Viewed for the recruiter).
export default function ClientCandidateDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [cvBusy, setCvBusy] = useState('');
  const [cvError, setCvError] = useState('');

  useEffect(() => {
    clientPortalApi
      .get(id)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [id]);

  const cv = async (download) => {
    setCvBusy(download ? 'download' : 'view');
    setCvError('');
    try {
      await clientPortalApi.openCv(id, { download, fileName: data.snapshot.cv?.fileName || 'cv' });
    } catch (err) {
      setCvError(err.message);
    } finally {
      setCvBusy('');
    }
  };

  if (error) return <ErrorState message={error} />;
  if (!data) return <LoadingState />;

  return (
    <div>
      <Link to="/client/candidates" className="mb-4 inline-flex min-h-[44px] items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Candidates
      </Link>
      {/* Second-round AI interview: request one, see round 2's result */}
      <SecondRoundPanel
        data={data}
        canRequest
        audience="hr"
        onRequest={async (payload) => {
          const res = await clientPortalApi.requestSecondRound(id, payload);
          setData(res);
          return res;
        }}
      />
      <SubmissionPackage
        snapshot={data.snapshot}
        cvActions={
          <>
            <Button variant="secondary" onClick={() => cv(false)} loading={cvBusy === 'view'} className="w-full sm:w-auto">
              <FileText className="h-4 w-4" /> View CV
            </Button>
            <Button variant="secondary" onClick={() => cv(true)} loading={cvBusy === 'download'} className="w-full sm:w-auto">
              <Download className="h-4 w-4" /> Download
            </Button>
          </>
        }
        footer={
          <>
            {cvError && <p className="mt-4 text-sm text-red-600">{cvError}</p>}
            <p className="mt-6 text-center text-xs text-slate-400">Shared on {new Date(data.submittedAt).toLocaleDateString()}</p>
          </>
        }
      />
    </div>
  );
}
