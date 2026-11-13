import { useEffect, useState } from 'react'
import { Alert, Button, Card, Input, PageHeader, Select, TextArea } from '../../components/ui'
import { useTheme, type ThemeMode } from '../../context/ThemeContext'
import { api } from '../../services/api'
import type { SystemSettings } from '../../types'

export default function AdminSettings() {
  const { theme, setTheme } = useTheme()
  const [settings, setSettings] = useState<SystemSettings | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    api<{ settings: SystemSettings }>('/admin/settings')
      .then((d) => setSettings(d.settings))
      .catch(() => setMessage('Could not load settings.'))
  }, [])

  if (!settings) return null

  const save = async () => {
    await api('/admin/settings', { method: 'PUT', json: settings })
    setMessage('Settings saved to the database.')
  }

  return (
    <div>
      <PageHeader title="System Settings" subtitle="Configure registration, uploads and privacy notice." />
      {message && (
        <div className="mb-4">
          <Alert tone="success">{message}</Alert>
        </div>
      )}
      <div className="mb-4 max-w-xl">
        <Card title="Appearance">
          <p className="mb-3 text-sm text-slate-500">Personal theme for this device (does not affect other users).</p>
          <Select label="Theme" value={theme} onChange={(e) => setTheme(e.target.value as ThemeMode)}>
            <option value="system">System default</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </Select>
        </Card>
      </div>
      <Card>
        <div className="max-w-xl space-y-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.allowRegistration}
              onChange={(e) => setSettings({ ...settings, allowRegistration: e.target.checked })}
            />
            Allow client registration
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.emailNotifications}
              onChange={(e) => setSettings({ ...settings, emailNotifications: e.target.checked })}
            />
            Enable email notifications
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.maintenanceMode}
              onChange={(e) => setSettings({ ...settings, maintenanceMode: e.target.checked })}
            />
            Maintenance mode
          </label>
          <Input
            label="Max upload size (MB)"
            type="number"
            min={1}
            value={settings.maxUploadMb}
            onChange={(e) => setSettings({ ...settings, maxUploadMb: Number(e.target.value) })}
          />
          <TextArea
            label="Privacy notice"
            rows={5}
            value={settings.privacyNotice}
            onChange={(e) => setSettings({ ...settings, privacyNotice: e.target.value })}
          />
          <Button onClick={save}>Save settings</Button>
        </div>
      </Card>
    </div>
  )
}
