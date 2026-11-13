import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faBell,
  faChartPie,
  faClipboardCheck,
  faCogs,
  faFileAlt,
  faFolderOpen,
  faGaugeHigh,
  faListCheck,
  faScroll,
  faUserShield,
  faUsers,
} from '@fortawesome/free-solid-svg-icons'
import { DashboardLayout } from '../../layouts/DashboardLayout'

const items = [
  { to: '/admin', label: 'Dashboard', icon: <FontAwesomeIcon icon={faGaugeHigh} />, section: 'Main' },
  { to: '/admin/clients', label: 'Manage Clients', icon: <FontAwesomeIcon icon={faUsers} /> },
  { to: '/admin/applications', label: 'Manage Applications', icon: <FontAwesomeIcon icon={faClipboardCheck} /> },
  { to: '/admin/documents', label: 'Review Documents', icon: <FontAwesomeIcon icon={faFolderOpen} /> },
  { to: '/admin/tracking', label: 'Application Tracking', icon: <FontAwesomeIcon icon={faListCheck} /> },
  { to: '/admin/document-requirements', label: 'Document Requirements', icon: <FontAwesomeIcon icon={faFileAlt} /> },
  { to: '/admin/notifications', label: 'Notifications', icon: <FontAwesomeIcon icon={faBell} />, dividerAfter: true },
  { to: '/admin/reports', label: 'Reports and Analytics', icon: <FontAwesomeIcon icon={faChartPie} /> },

  { to: '/admin/administrators', label: 'Administrator Accounts', icon: <FontAwesomeIcon icon={faUserShield} /> },
  { to: '/admin/settings', label: 'System Settings', icon: <FontAwesomeIcon icon={faCogs} /> },
  { to: '/admin/audit-logs', label: 'Audit Logs', icon: <FontAwesomeIcon icon={faScroll} /> },
]

export default function AdminShell() {
  return <DashboardLayout items={items} basePath="/admin" />
}
