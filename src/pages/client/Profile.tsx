import { useEffect, useState } from 'react'
import { Alert, Button, Card, Input, PageHeader, PasswordInput, Select } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useTheme, type ThemeMode } from '../../context/ThemeContext'
import { changeClientPassword } from '../../services/authService'
import { getClient, updateClientProfile } from '../../services/clientService'
import type { ClientProfile, EmploymentStatus, MaritalStatus } from '../../types'
import { maskIdNumber } from '../../utils/saId'
import { formatDate } from '../../utils/format'

export default function ClientProfile() {
  const { user } = useAuth()
  const { theme, setTheme } = useTheme()
  const [client, setClient] = useState<ClientProfile | null>(null)
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' })

  useEffect(() => {
    if (!user) return
    getClient(user.id).then((c) => setClient(c || null))
  }, [user])

  if (!client) return null

  const saveProfile = async () => {
    await updateClientProfile(client.id, {
      phone: client.phone,
      address: client.address,
      province: client.province,
      municipality: client.municipality,
      maritalStatus: client.maritalStatus,
      employmentStatus: client.employmentStatus,
      notificationPrefs: client.notificationPrefs,
    })
    setMessage({ tone: 'success', text: 'Profile updated.' })
  }

  const savePassword = async () => {
    if (passwords.next !== passwords.confirm) {
      setMessage({ tone: 'error', text: 'New passwords do not match.' })
      return
    }
    const result = await changeClientPassword(client.id, passwords.current, passwords.next)
    if (!result.ok) {
      setMessage({ tone: 'error', text: result.error })
      return
    }
    setPasswords({ current: '', next: '', confirm: '' })
    setMessage({ tone: 'success', text: 'Password changed.' })
  }

  return (
    <div>
      <PageHeader title="My Profile" subtitle="Manage your personal information and preferences." />
      {message && (
        <div className="mb-4">
          <Alert tone={message.tone}>{message.text}</Alert>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Personal information">
          <div className="grid gap-4">
            <Input label="Full Name" value={client.firstName} disabled />
            <Input label="Surname" value={client.surname} disabled />
            <Input label="Username" value={client.username} disabled />
            <Input label="Email" value={client.email} disabled />
            <Input label="ID Number" value={maskIdNumber(client.idNumber)} disabled />
            <Input label="Account ID" value={client.accountId} disabled />
            <Input label="Registered" value={formatDate(client.registeredAt)} disabled />
            <Input label="Phone" value={client.phone || ''} onChange={(e) => setClient({ ...client, phone: e.target.value })} />
            <Input label="Address" value={client.address || ''} onChange={(e) => setClient({ ...client, address: e.target.value })} />
            <Input label="Province" value={client.province || ''} onChange={(e) => setClient({ ...client, province: e.target.value })} />
            <Input
              label="Municipality"
              value={client.municipality || ''}
              onChange={(e) => setClient({ ...client, municipality: e.target.value })}
            />
            <Select
              label="Marital Status"
              value={client.maritalStatus || ''}
              onChange={(e) => setClient({ ...client, maritalStatus: e.target.value as MaritalStatus })}
            >
              <option value="">Select</option>
              {['Single', 'Married', 'Divorced', 'Widowed'].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
            <Select
              label="Employment Status"
              value={client.employmentStatus || ''}
              onChange={(e) => setClient({ ...client, employmentStatus: e.target.value as EmploymentStatus })}
            >
              <option value="">Select</option>
              {[
                'Permanently Employed',
                'Temporarily Employed',
                'Self-Employed',
                'Unemployed',
                'Commission-Based Income',
              ].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
            <Button onClick={saveProfile}>Save profile</Button>
          </div>
        </Card>
        <div className="space-y-6">
          <Card title="Change password">
            <div className="space-y-4">
              <PasswordInput
                label="Current Password"
                value={passwords.current}
                onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
              />
              <PasswordInput
                label="New Password"
                value={passwords.next}
                onChange={(e) => setPasswords({ ...passwords, next: e.target.value })}
              />
              <PasswordInput
                label="Confirm Password"
                value={passwords.confirm}
                onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
              />
              <Button onClick={savePassword}>Update password</Button>
            </div>
          </Card>
          <Card title="Notification preferences">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={client.notificationPrefs.inApp}
                onChange={(e) =>
                  setClient({
                    ...client,
                    notificationPrefs: { ...client.notificationPrefs, inApp: e.target.checked },
                  })
                }
              />
              In-app notifications
            </label>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={client.notificationPrefs.email}
                onChange={(e) =>
                  setClient({
                    ...client,
                    notificationPrefs: { ...client.notificationPrefs, email: e.target.checked },
                  })
                }
              />
              Email notifications (simulated)
            </label>
            <Button className="mt-4" onClick={saveProfile}>
              Save preferences
            </Button>
          </Card>
          <Card title="Appearance">
            <p className="mb-3 text-sm text-slate-500">Choose how iHOPED looks on this device.</p>
            <Select
              label="Theme"
              value={theme}
              onChange={(e) => setTheme(e.target.value as ThemeMode)}
            >
              <option value="system">System default</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </Select>
          </Card>
        </div>
      </div>
    </div>
  )
}
