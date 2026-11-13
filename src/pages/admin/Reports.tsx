import { useEffect, useMemo, useState } from 'react'
import { Button, Card, PageHeader, Select } from '../../components/ui'
import { getAllApplications } from '../../services/applicationService'
import { getAllClients } from '../../services/clientService'
import { getAllDocuments } from '../../services/documentService'
import type { ClientProfile, HousingApplication, UploadedDocument } from '../../types'
import { downloadTextFile, toCsv } from '../../utils/format'

export default function AdminReports() {
  const [apps, setApps] = useState<HousingApplication[]>([])
  const [clients, setClients] = useState<ClientProfile[]>([])
  const [docs, setDocs] = useState<UploadedDocument[]>([])
  const [report, setReport] = useState('applications')

  useEffect(() => {
    ;(async () => {
      setApps(await getAllApplications())
      setClients(await getAllClients())
      setDocs(await getAllDocuments())
    })()
  }, [])

  const rows = useMemo(() => {
    switch (report) {
      case 'clients':
        return clients.map((c) => ({
          accountId: c.accountId,
          name: `${c.firstName} ${c.surname}`,
          email: c.email,
          province: c.province || '',
          active: c.active,
          registeredAt: c.registeredAt,
        }))
      case 'approved':
        return apps
          .filter((a) => a.status === 'Approved')
          .map((a) => ({ reference: a.referenceNumber, province: a.preferredProvince, municipality: a.preferredMunicipality }))
      case 'rejected':
        return apps
          .filter((a) => a.status === 'Rejected')
          .map((a) => ({ reference: a.referenceNumber, reason: a.rejectionReason || '' }))
      case 'awaiting':
        return apps
          .filter((a) => ['Submitted', 'Under Review'].includes(a.status))
          .map((a) => ({ reference: a.referenceNumber, status: a.status }))
      case 'documents':
        return docs.map((d) => ({ file: d.fileName, status: d.status, clientId: d.clientId }))
      case 'province':
        return Object.entries(
          apps.reduce<Record<string, number>>((acc, a) => {
            acc[a.preferredProvince] = (acc[a.preferredProvince] || 0) + 1
            return acc
          }, {}),
        ).map(([province, total]) => ({ province, total }))
      case 'employment':
        return Object.entries(
          clients.reduce<Record<string, number>>((acc, c) => {
            const key = c.employmentStatus || 'Unknown'
            acc[key] = (acc[key] || 0) + 1
            return acc
          }, {}),
        ).map(([employmentStatus, total]) => ({ employmentStatus, total }))
      default:
        return apps.map((a) => ({
          reference: a.referenceNumber,
          status: a.status,
          province: a.preferredProvince,
          municipality: a.preferredMunicipality,
          submittedAt: a.submittedAt || '',
        }))
    }
  }, [report, apps, clients, docs])

  const exportCsv = () => {
    downloadTextFile(`ihoped-${report}.csv`, toCsv(rows), 'text/csv')
  }

  const exportPdf = () => {
    const html = `<html><head><title>iHOPED Report</title></head><body><h1>iHOPED ${report} report</h1><pre>${toCsv(rows)}</pre></body></html>`
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(html)
    w.document.close()
    w.print()
  }

  return (
    <div>
      <PageHeader
        title="Reports and Analytics"
        subtitle="Generate operational reports and export to CSV or printable PDF."
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={exportCsv}>
              Export Excel/CSV
            </Button>
            <Button onClick={exportPdf}>Export PDF</Button>
          </div>
        }
      />
      <Card>
        <div className="mb-4 max-w-md">
          <Select label="Report type" value={report} onChange={(e) => setReport(e.target.value)}>
            <option value="clients">Registered clients</option>
            <option value="applications">Applications received</option>
            <option value="approved">Applications approved</option>
            <option value="rejected">Applications rejected</option>
            <option value="awaiting">Applications awaiting review</option>
            <option value="documents">Outstanding / uploaded documents</option>
            <option value="province">Applications by province</option>
            <option value="employment">Clients by employment status</option>
          </Select>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-100 text-slate-500">
              <tr>
                {rows[0] &&
                  Object.keys(rows[0]).map((h) => (
                    <th key={h} className="px-3 py-3 font-medium capitalize">
                      {h}
                    </th>
                  ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={idx} className="border-b border-slate-50">
                  {Object.values(row).map((v, i) => (
                    <td key={i} className="px-3 py-3">
                      {String(v)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
