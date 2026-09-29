// import { LayoutDashboard, Briefcase } from 'lucide-react';
import { LayoutDashboard, Briefcase, UserCog } from 'lucide-react';
import DashboardLayout from './DashboardLayout.jsx';
import { usePermissions } from '../hooks/usePermissions.js';

const navItems = [
  { to: '/company/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/company/jobs', label: 'Jobs', icon: Briefcase },
  // Build plan P2 — only for the owner / recruiters with MANAGE_RECRUITERS.
  { to: '/company/recruiters', label: 'Recruiters', icon: UserCog, permission: 'MANAGE_RECRUITERS' },
];

export default function CompanyLayout() {
  // return <DashboardLayout navItems={navItems} />;
  const { can } = usePermissions();
  return <DashboardLayout navItems={navItems.filter((item) => !item.permission || can(item.permission))} />;
}
