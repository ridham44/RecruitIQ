import { LayoutDashboard, Briefcase } from 'lucide-react';
import DashboardLayout from './DashboardLayout.jsx';

const navItems = [
  { to: '/company/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/company/jobs', label: 'Jobs', icon: Briefcase },
];

export default function CompanyLayout() {
  return <DashboardLayout navItems={navItems} />;
}
