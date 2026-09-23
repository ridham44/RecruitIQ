import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapPin, Upload, CheckCircle2 } from 'lucide-react';
import { jobsApi } from '../../services/jobs.js';
import { applicationsApi } from '../../services/applications.js';
import { resumesApi } from '../../services/resumes.js';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import LoadingState from '../../components/ui/LoadingState.jsx';
import ErrorState from '../../components/ui/ErrorState.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';

export default function JobDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [resumes, setResumes] = useState([]);
  const [existingApplication, setExistingApplication] = useState(null);
  const [selectedResumeId, setSelectedResumeId] = useState('');
  const [error, setError] = useState('');
  const [applying, setApplying] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = () => {
    setError('');
    Promise.all([jobsApi.get(id), resumesApi.list(), applicationsApi.listMine()])
      .then(([jobRes, resumeRes, appsRes]) => {
        setJob(jobRes.job);
        setResumes(resumeRes.resumes);
        if (resumeRes.resumes[0]) setSelectedResumeId(resumeRes.resumes[0].id);
        setExistingApplication(appsRes.applications.find((a) => a.jobId === id) || null);
      })
      .catch((err) => setError(err.message));
  };

  useEffect(load, [id]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const { resume } = await resumesApi.upload(file);
      setResumes((prev) => [resume, ...prev]);
      setSelectedResumeId(resume.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleApply = async () => {
    if (!selectedResumeId) {
      setError('Upload or select a resume before applying');
      return;
    }
    setApplying(true);
    setError('');
    try {
      const { application } = await applicationsApi.apply({ jobId: id, resumeId: selectedResumeId });
      setExistingApplication(application);
    } catch (err) {
      setError(err.message);
    } finally {
      setApplying(false);
    }
  };

  if (error && !job) return <ErrorState message={error} onRetry={load} />;
  if (!job) return <LoadingState />;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-slate-900">{job.title}</h2>
        <p className="text-sm text-slate-500">{job.company?.name}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
          {job.location && (
            <span className="flex items-center gap-1">
              <MapPin className="h-4 w-4" /> {job.location}
            </span>
          )}
          <span>·</span>
          <span>{job.employmentType.replace('_', ' ')}</span>
          <span>·</span>
          <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
            {job.workMode || 'On-site'}
          </span>
          <span className="inline-flex items-center rounded-md bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">
            {job.jobLevel || 'Mid'} Level
          </span>
          <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
            {job.openings || 1} {job.openings === 1 ? 'opening' : 'openings'}
          </span>
        </div>
      </div>

      {/* Highlights bar */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-sm">
          <p className="text-xs font-medium text-slate-400">Work Mode</p>
          <p className="mt-0.5 font-semibold text-slate-800">{job.workMode || 'On-site'}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-sm">
          <p className="text-xs font-medium text-slate-400">Openings</p>
          <p className="mt-0.5 font-semibold text-slate-800">{job.openings || 1}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-sm">
          <p className="text-xs font-medium text-slate-400">Salary Range</p>
          <p className="mt-0.5 font-semibold text-slate-800">{job.salaryRange || 'Not disclosed'}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-sm">
          <p className="text-xs font-medium text-slate-400">Notice Period</p>
          <p className="mt-0.5 font-semibold text-slate-800">{job.noticePeriod || 'Negotiable'}</p>
        </div>
      </div>

      <Card className="mb-6 p-6">
        <h3 className="mb-2 font-semibold text-slate-900">Description</h3>
        <p className="whitespace-pre-wrap text-sm text-slate-600">{job.description}</p>
      </Card>

      <div className="mb-6 grid gap-6 sm:grid-cols-2">
        <Card className="p-6">
          <h3 className="mb-3 font-semibold text-slate-900">Experience</h3>
          <p className="text-sm text-slate-600">
            {job.minimumExperience}+ years{job.maximumExperience ? ` – up to ${job.maximumExperience} years` : ''}
          </p>
        </Card>
        <Card className="p-6">
          <h3 className="mb-3 font-semibold text-slate-900">Education</h3>
          <p className="text-sm text-slate-600">
            {job.educationRequirements?.length ? job.educationRequirements.join(', ') : 'No specific requirement'}
          </p>
        </Card>
      </div>

      <Card className="mb-6 p-6">
        <h3 className="mb-3 font-semibold text-slate-900">Required skills</h3>
        <div className="flex flex-wrap gap-2">
          {job.requiredSkills?.map((skill) => (
            <span key={skill} className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
              {skill}
            </span>
          ))}
          {!job.requiredSkills?.length && <p className="text-sm text-slate-400">None specified</p>}
        </div>

        {job.preferredSkills?.length > 0 && (
          <>
            <h3 className="mb-3 mt-5 font-semibold text-slate-900">Preferred skills</h3>
            <div className="flex flex-wrap gap-2">
              {job.preferredSkills.map((skill) => (
                <span key={skill} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                  {skill}
                </span>
              ))}
            </div>
          </>
        )}

        {job.languagesRequired?.length > 0 && (
          <>
            <h3 className="mb-3 mt-5 font-semibold text-slate-900">Languages required</h3>
            <div className="flex flex-wrap gap-2">
              {job.languagesRequired.map((lang) => (
                <span key={lang} className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                  {lang}
                </span>
              ))}
            </div>
          </>
        )}

        {job.certifications?.length > 0 && (
          <>
            <h3 className="mb-3 mt-5 font-semibold text-slate-900">Certifications</h3>
            <div className="flex flex-wrap gap-2">
              {job.certifications.map((cert) => (
                <span key={cert} className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                  {cert}
                </span>
              ))}
            </div>
          </>
        )}
      </Card>

      <Card className="p-6">
        {existingApplication ? (
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            <div>
              <p className="font-medium text-slate-900">You've applied to this job</p>
              <div className="mt-1">
                <StatusBadge status={existingApplication.status} />
              </div>
            </div>
            <Button variant="secondary" className="ml-auto" onClick={() => navigate(`/candidate/applications/${existingApplication.id}`)}>
              View application
            </Button>
          </div>
        ) : (
          <div>
            <h3 className="mb-3 font-semibold text-slate-900">Apply to this job</h3>
            {resumes.length > 0 && (
              <div className="mb-3 space-y-2">
                {resumes.map((resume) => (
                  <label key={resume.id} className="flex items-center gap-2 rounded-lg border border-slate-200 p-3 text-sm">
                    <input
                      type="radio"
                      name="resume"
                      checked={selectedResumeId === resume.id}
                      onChange={() => setSelectedResumeId(resume.id)}
                    />
                    {resume.fileName}
                  </label>
                ))}
              </div>
            )}
            <label className="mb-4 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 py-4 text-sm text-slate-500 hover:border-brand-400 hover:text-brand-600">
              <Upload className="h-4 w-4" />
              {uploading ? 'Uploading…' : 'Upload a new resume (PDF or DOCX)'}
              <input type="file" accept=".pdf,.docx" className="hidden" onChange={handleUpload} disabled={uploading} />
            </label>
            {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
            <Button onClick={handleApply} loading={applying} className="w-full" disabled={!selectedResumeId}>
              Apply now
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
