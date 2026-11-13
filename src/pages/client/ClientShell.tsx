import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faBell,
  faCircleQuestion,
  faClipboardList,
  faFileAlt,
  faFolderOpen,
  faGaugeHigh,
  faPlus,
  faUser,
} from '@fortawesome/free-solid-svg-icons'
import { DashboardLayout } from '../../layouts/DashboardLayout'

const items = [
  { to: '/client', label: 'Dashboard', icon: <FontAwesomeIcon icon={faGaugeHigh} />, end: true, section: 'Main' },
  {
    to: '/client/applications/new',
    label: 'Start New Housing Application',
    icon: <FontAwesomeIcon icon={faPlus} />,
    matchPaths: ['/client/applications/new', '/client/applications/upload', '/client/applications/form'],
  },
  {
    to: '/client/applications',
    label: 'My Applications',
    icon: <FontAwesomeIcon icon={faClipboardList} />,
    end: true,
  },
  { to: '/client/status', label: 'Application Status', icon: <FontAwesomeIcon icon={faFileAlt} /> },
  { to: '/client/documents', label: 'Required Documents', icon: <FontAwesomeIcon icon={faFolderOpen} /> },
  { to: '/client/notifications', label: 'Notifications', icon: <FontAwesomeIcon icon={faBell} />, dividerAfter: true },
  { to: '/client/profile', label: 'My Profile', icon: <FontAwesomeIcon icon={faUser} /> },
  { to: '/client/help', label: 'Help and Support', icon: <FontAwesomeIcon icon={faCircleQuestion} /> },
]

export default function ClientShell() {
  return <DashboardLayout items={items} basePath="/client" />
}
