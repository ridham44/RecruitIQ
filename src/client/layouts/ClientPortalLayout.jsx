import { Users } from 'lucide-react';
import DashboardLayout from './DashboardLayout.jsx';

// Build plan P8 — client HR portal: one section, the candidates shared with them.
const navItems = [{ to: '/client/candidates', label: 'Candidates', icon: Users }];

export default function ClientPortalLayout() {
  return <DashboardLayout navItems={navItems} />;
}
