// import { LayoutDashboard, Briefcase } from 'lucide-react';
import { LayoutDashboard, Briefcase, UserCog, Building, Inbox } from 'lucide-react';
import DashboardLayout from './DashboardLayout.jsx';
import { usePermissions } from '../hooks/usePermissions.js';

const navItems = [
  { to: '/company/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/company/jobs', label: 'Jobs', icon: Briefcase },
  // Build plan P3 — everyone on the company side (recruiters see assigned clients only).
  { to: '/company/clients', label: 'Companies', icon: Building },
  // Build plan P4 — CVs from the careers page (REVIEW_CANDIDATES).
  { to: '/company/cv-pool', label: 'CV pool', icon: Inbox, permission: 'REVIEW_CANDIDATES' },
  // Build plan P2 — only for the owner / recruiters with MANAGE_RECRUITERS.
  { to: '/company/recruiters', label: 'Agency recruiters', icon: UserCog, permission: 'MANAGE_RECRUITERS' },
];

export default function CompanyLayout() {
  // return <DashboardLayout navItems={navItems} />;
  const { can } = usePermissions();
  return <DashboardLayout navItems={navItems.filter((item) => !item.permission || can(item.permission))} />;
}
