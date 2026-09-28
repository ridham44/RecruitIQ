import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { adminApi } from '../../services/admin.js';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import CompanyForm from './CompanyForm.jsx';
import SetupLinkNotice from './SetupLinkNotice.jsx';

// Build plan P1 — onboard a Recruitment Company and invite its owner.
export default function CompanyNewPage() {
  const navigate = useNavigate();
  const [result, setResult] = useState(null);

  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/admin/companies" className="mb-4 inline-flex min-h-[44px] items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Companies
      </Link>
      <h2 className="mb-6 text-xl font-semibold text-slate-900">Add company</h2>

      {result ? (
        <div className="space-y-4">
          <SetupLinkNotice email={result.company.owner?.email} link={result.setupLink} />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link to={`/admin/companies/${result.company.id}`} className="sm:flex-1">
              <Button className="w-full">View {result.company.name}</Button>
            </Link>
            <Button variant="secondary" className="w-full sm:flex-1" onClick={() => setResult(null)}>
              Add another company
            </Button>
          </div>
        </div>
      ) : (
        <Card className="p-4 sm:p-6">
          <CompanyForm
            withOwnerEmail
            submitLabel="Create company & send invite"
            onSubmit={async (payload) => setResult(await adminApi.createCompany(payload))}
            onCancel={() => navigate('/admin/companies')}
          />
        </Card>
      )}
    </div>
  );
}
