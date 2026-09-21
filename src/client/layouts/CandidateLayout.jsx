import { LayoutDashboard, Search, FileText, User } from 'lucide-react';
import DashboardLayout from './DashboardLayout.jsx';

const navItems = [
  { to: '/candidate/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/candidate/jobs', label: 'Find Jobs', icon: Search },
  { to: '/candidate/applications', label: 'My Applications', icon: FileText },
  { to: '/candidate/profile', label: 'Profile', icon: User },
];

export default function CandidateLayout() {
  return <DashboardLayout navItems={navItems} />;
}
