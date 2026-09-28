import { Building2, Users } from 'lucide-react';
import DashboardLayout from './DashboardLayout.jsx';

// Build plan P1 — Platform Admin area. Reuses the shared dashboard shell
// (sidebar on desktop, bottom tab bar on mobile).
const navItems = [
  { to: '/admin/companies', label: 'Companies', icon: Building2 },
  { to: '/admin/users', label: 'Users', icon: Users },
];

export default function AdminLayout() {
  return <DashboardLayout navItems={navItems} />;
}
