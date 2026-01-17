import { createServiceClient } from '@/lib/supabase/server'
import { logError } from '@/lib/errors'

// Action type constants for type safety
export const ActivityAction = {
  USER_APPROVE: 'user.approve',
  USER_REJECT: 'user.reject',
  USER_REVOKE: 'user.revoke',
  PATTERN_DELETE: 'pattern.delete',
  PATTERN_UPDATE: 'pattern.update',
  PATTERN_TRANSFORM: 'pattern.transform',
  PATTERN_KEYWORD_ADD: 'pattern.keyword_add',
  PATTERN_KEYWORD_REMOVE: 'pattern.keyword_remove',
  KEYWORD_CREATE: 'keyword.create',
  KEYWORD_UPDATE: 'keyword.update',
  KEYWORD_DELETE: 'keyword.delete',
  KEYWORD_MERGE: 'keyword.merge',
  ORIENTATION_REVIEW: 'orientation.review',
  BATCH_UPLOAD: 'batch.upload',
  BATCH_COMMIT: 'batch.commit',
  BATCH_CANCEL: 'batch.cancel',
  BATCH_KEYWORDS: 'batch.keywords',
  DUPLICATE_REVIEW: 'duplicate.review',
  THUMBNAILS_REPROCESS: 'thumbnails.reprocess',
} as const

export type ActivityActionType = (typeof ActivityAction)[keyof typeof ActivityAction]

export type TargetType = 'user' | 'pattern' | 'keyword' | 'batch'

interface LogActivityParams {
  adminId: string
  action: ActivityActionType
  targetType: TargetType
  targetId?: string | number
  description: string
  details?: Record<string, unknown>
}

/**
 * Log an admin activity to the audit trail.
 * Non-blocking - errors are logged but don't affect the main operation.
 */
export async function logAdminActivity({
  adminId,
  action,
  targetType,
  targetId,
  description,
  details = {},
}: LogActivityParams): Promise<void> {
  try {
    const serviceClient = createServiceClient()

    await serviceClient.from('admin_activity_log').insert({
      admin_id: adminId,
      action_type: action,
      target_type: targetType,
      target_id: targetId?.toString() ?? null,
      description,
      details,
    })
  } catch (error) {
    // Log error but don't throw - activity logging should never break main flow
    logError(error, { action, targetType, targetId })
  }
}
