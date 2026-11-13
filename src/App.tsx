import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AuthLayout } from './layouts/AuthLayout'
import Landing from './pages/Landing'
import Login from './pages/auth/Login'
import ClientRegister from './pages/auth/ClientRegister'
import ForgotPassword from './pages/auth/ForgotPassword'
import ResetPassword from './pages/auth/ResetPassword'
import AdminChangePassword from './pages/auth/AdminChangePassword'
import ClientShell from './pages/client/ClientShell'
import ClientDashboard from './pages/client/Dashboard'
import StartApplication from './pages/client/StartApplication'
import ApplicationDocuments from './pages/client/ApplicationDocuments'
import SimpleApplicationForm from './pages/client/SimpleApplicationForm'
import MyApplications from './pages/client/MyApplications'
import ApplicationStatusPage from './pages/client/ApplicationStatus'
import ClientDocuments from './pages/client/Documents'
import ClientNotifications from './pages/client/Notifications'
import ClientProfile from './pages/client/Profile'
import HelpSupport from './pages/client/Help'
import AdminShell from './pages/admin/AdminShell'
import AdminDashboard from './pages/admin/Dashboard'
import AdminClients from './pages/admin/Clients'
import AdminApplications from './pages/admin/Applications'
import AdminDocuments from './pages/admin/Documents'
import AdminTracking from './pages/admin/Tracking'
import DocRequirements from './pages/admin/DocRequirements'
import AdminNotifications from './pages/admin/Notifications'
import AdminReports from './pages/admin/Reports'
import Administrators from './pages/admin/Administrators'
import AdminSettings from './pages/admin/Settings'
import AuditLogs from './pages/admin/AuditLogs'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />

          <Route element={<AuthLayout />}>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<ClientRegister />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
          </Route>

          <Route path="/admin/login" element={<Navigate to="/login" replace />} />

          <Route
            path="/client"
            element={
              <ProtectedRoute role="client">
                <ClientShell />
              </ProtectedRoute>
            }
          >
            <Route index element={<ClientDashboard />} />
            <Route path="applications/new" element={<StartApplication />} />
            <Route path="applications/upload" element={<ApplicationDocuments />} />
            <Route path="applications/form" element={<SimpleApplicationForm />} />
            <Route path="applications" element={<MyApplications />} />
            <Route path="status" element={<ApplicationStatusPage />} />
            <Route path="documents" element={<ClientDocuments />} />
            <Route path="notifications" element={<ClientNotifications />} />
            <Route path="profile" element={<ClientProfile />} />
            <Route path="help" element={<HelpSupport />} />
          </Route>

          <Route
            path="/admin"
            element={
              <ProtectedRoute role="admin">
                <AdminShell />
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="change-password" element={<AdminChangePassword />} />
            <Route path="clients" element={<AdminClients />} />
            <Route path="applications" element={<AdminApplications />} />
            <Route path="documents" element={<AdminDocuments />} />
            <Route path="tracking" element={<AdminTracking />} />
            <Route path="document-requirements" element={<DocRequirements />} />
            <Route path="notifications" element={<AdminNotifications />} />
            <Route path="reports" element={<AdminReports />} />
            <Route path="administrators" element={<Administrators />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="audit-logs" element={<AuditLogs />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
