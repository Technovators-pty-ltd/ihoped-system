import { useEffect, useState } from 'react'
import { Alert, Button, Card, Input, PageHeader, TextArea } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { getDocumentCategories, updateDocumentCategories } from '../../services/documentService'
import type { DocumentCategory } from '../../types'
import { uid } from '../../utils/crypto'

export default function DocRequirements() {
  const { user } = useAuth()
  const [categories, setCategories] = useState<DocumentCategory[]>([])
  const [message, setMessage] = useState('')

  useEffect(() => {
    getDocumentCategories().then(setCategories)
  }, [])

  const update = (id: string, patch: Partial<DocumentCategory>) => {
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }

  const addCategory = () => {
    setCategories((prev) => [
      ...prev,
      {
        id: uid('doc'),
        title: 'New document requirement',
        description: 'Describe this document requirement.',
        mandatory: false,
        optional: true,
        enabled: true,
        certificationRequired: false,
      },
    ])
  }

  const save = async () => {
    if (!user) return
    await updateDocumentCategories(categories, user.id, user.name)
    setMessage('Document requirements saved. Client upload page will reflect these changes.')
  }

  return (
    <div>
      <PageHeader
        title="Document Requirements"
        subtitle="Configure mandatory, optional and conditional document categories."
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={addCategory}>
              Add category
            </Button>
            <Button onClick={save}>Save changes</Button>
          </div>
        }
      />
      {message && (
        <div className="mb-4">
          <Alert tone="success">{message}</Alert>
        </div>
      )}
      <div className="space-y-4">
        {categories.map((cat) => (
          <Card key={cat.id}>
            <div className="grid gap-4 md:grid-cols-2">
              <Input label="Title" value={cat.title} onChange={(e) => update(cat.id, { title: e.target.value })} />
              <TextArea
                label="Description"
                rows={2}
                value={cat.description}
                onChange={(e) => update(cat.id, { description: e.target.value })}
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={cat.enabled} onChange={(e) => update(cat.id, { enabled: e.target.checked })} />
                Enabled
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={cat.mandatory}
                  onChange={(e) => update(cat.id, { mandatory: e.target.checked, optional: !e.target.checked })}
                />
                Mandatory
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={cat.optional}
                  onChange={(e) => update(cat.id, { optional: e.target.checked, mandatory: !e.target.checked })}
                />
                Optional
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={cat.certificationRequired}
                  onChange={(e) => update(cat.id, { certificationRequired: e.target.checked })}
                />
                Certification required
              </label>
            </div>
            {cat.condition && (
              <p className="mt-3 text-xs text-slate-500">
                Conditional on {cat.condition.field}: {cat.condition.values.join(', ')}
              </p>
            )}
            <div className="mt-4">
              <Button
                variant="danger"
                onClick={() => setCategories((prev) => prev.filter((c) => c.id !== cat.id))}
              >
                Delete
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
