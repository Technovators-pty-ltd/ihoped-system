import type { SessionUser } from '../types'
import { api } from './api'
import { getApplicationsForClient } from './applicationService'
import {
  getDocumentUploadProgress,
  getMandatoryCategoriesForClient,
  refreshDocumentData,
} from './documentService'
import { getNotificationsFor } from './notificationService'

export interface ActionItem {
  id: string
  label: string
  to: string
  count?: number
}

export interface NavBadges {
  [path: string]: number
}

export async function getSidebarActions(user: SessionUser): Promise<{
  items: ActionItem[]
  badges: NavBadges
  total: number
}> {
  if (user.role === 'admin') {
    const stats = await api<{
      docsPending: number
      appsDocReview: number
      appsSubmitted: number
      appsUnderReview: number
    }>('/admin/actions')

    const items: ActionItem[] = []
    const badges: NavBadges = {}

    if (stats.docsPending > 0 || stats.appsDocReview > 0) {
      const count = stats.docsPending || stats.appsDocReview
      items.push({
        id: 'review-docs',
        label:
          stats.docsPending > 0
            ? `${stats.docsPending} document${stats.docsPending === 1 ? '' : 's'} waiting for review`
            : `${stats.appsDocReview} application${stats.appsDocReview === 1 ? '' : 's'} with documents under review`,
        to: '/admin/documents',
        count,
      })
      badges['/admin/documents'] = count
    }
    if (stats.appsSubmitted > 0) {
      items.push({
        id: 'new-apps',
        label: `${stats.appsSubmitted} new application${stats.appsSubmitted === 1 ? '' : 's'} to process`,
        to: '/admin/applications',
        count: stats.appsSubmitted,
      })
      badges['/admin/applications'] = (badges['/admin/applications'] || 0) + stats.appsSubmitted
    }
    if (stats.appsUnderReview > 0) {
      items.push({
        id: 'apps-review',
        label: `${stats.appsUnderReview} application${stats.appsUnderReview === 1 ? '' : 's'} currently under review`,
        to: '/admin/applications',
        count: stats.appsUnderReview,
      })
      badges['/admin/applications'] = (badges['/admin/applications'] || 0) + stats.appsUnderReview
    }

    return { items, badges, total: items.reduce((s, i) => s + (i.count || 1), 0) }
  }

  await refreshDocumentData(user.id)
  const apps = await getApplicationsForClient(user.id)
  const unread = (await getNotificationsFor(user.id)).filter((n) => !n.read).length
  const progress = getDocumentUploadProgress(user.id)
  const remainingDocs = Math.max(0, progress.mandatoryTotal - progress.mandatoryAttached)

  const items: ActionItem[] = []
  const badges: NavBadges = {}

  const awaitingDocs = apps.filter((a) => a.status === 'Awaiting Documents' || a.status === 'Documents Required')
  const underDocReview = apps.filter((a) => a.status === 'Documents Under Review')
  const formReady = apps.filter((a) => a.status === 'In Progress')

  if (awaitingDocs.length > 0 || remainingDocs > 0) {
    const count = remainingDocs || awaitingDocs.length
    items.push({
      id: 'attach-docs',
      label:
        remainingDocs > 0
          ? `${remainingDocs} mandatory document${remainingDocs === 1 ? '' : 's'} still to attach`
          : 'Documents need your attention',
      to: '/client/applications/new',
      count,
    })
    badges['/client/applications/new'] = count
  }

  if (underDocReview.length > 0) {
    items.push({
      id: 'docs-reviewing',
      label: `${underDocReview.length} application${underDocReview.length === 1 ? '' : 's'} waiting for document verification`,
      to: '/client/status',
      count: underDocReview.length,
    })
  }

  if (formReady.length > 0) {
    items.push({
      id: 'complete-form',
      label: `${formReady.length} application form${formReady.length === 1 ? '' : 's'} ready to complete`,
      to: `/client/applications/form?id=${formReady[0].id}`,
      count: formReady.length,
    })
    badges['/client/applications'] = formReady.length
    badges['/client/applications/new'] = formReady.length
  }

  const docs = (await apiDocs(user.id)).filter((d) =>
    ['Rejected', 'Resubmission Required'].includes(d.status) &&
    getMandatoryCategoriesForClient(user.id).some((c) => c.id === d.categoryId),
  )
  if (docs.length > 0) {
    items.push({
      id: 'rejected-docs',
      label: `${docs.length} document${docs.length === 1 ? '' : 's'} need resubmission`,
      to: '/client/applications/new',
      count: docs.length,
    })
    badges['/client/applications/new'] = (badges['/client/applications/new'] || 0) + docs.length
  }

  if (unread > 0) {
    items.push({
      id: 'unread',
      label: `${unread} unread notification${unread === 1 ? '' : 's'}`,
      to: '/client/notifications',
      count: unread,
    })
    badges['/client/notifications'] = unread
  }

  return { items, badges, total: items.reduce((s, i) => s + (i.count || 1), 0) }
}

async function apiDocs(clientId: string) {
  const { getClientDocuments } = await import('./documentService')
  return getClientDocuments(clientId)
}
