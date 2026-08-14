// Supabase persistence for the margin calculator. Untyped client because
// these tables are not yet in the generated Database types (run
// sync-supabase-types.sh to regenerate).
import { createClient } from '@supabase/supabase-js'
import {
  DEFAULT_SETTINGS,
  type MarginDeal,
  type MarginSettings,
  type StageSnapshot,
} from '@/lib/margin-calc'

const sb = createClient(
  process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || 'placeholder-key',
  { auth: { autoRefreshToken: false, persistSession: false } }
)

function rowToDeal(r: any): MarginDeal {
  return {
    id: r.id,
    projectCode: r.project_code,
    roleTitle: r.role_title ?? '',
    client: r.client ?? '',
    contractor: r.contractor ?? '',
    engagementType: r.engagement_type,
    workerLocation: r.worker_location ?? 'domestic',
    stage: r.stage,
    estimate: (r.estimate as StageSnapshot) ?? null,
    placed: (r.placed as StageSnapshot) ?? null,
    actual: (r.actual as StageSnapshot) ?? null,
    notes: r.notes ?? '',
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

export async function loadDeals(): Promise<MarginDeal[]> {
  const { data, error } = await sb
    .from('margin_deals')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw new Error(`Margin deals load failed: ${error.message}`)
  return (data || []).map(rowToDeal)
}

export async function saveDeal(deal: MarginDeal, editor: string): Promise<void> {
  const { error } = await sb.from('margin_deals').upsert({
    id: deal.id,
    project_code: deal.projectCode,
    role_title: deal.roleTitle,
    client: deal.client,
    contractor: deal.contractor,
    engagement_type: deal.engagementType,
    worker_location: deal.workerLocation,
    stage: deal.stage,
    estimate: deal.estimate,
    placed: deal.placed,
    actual: deal.actual,
    notes: deal.notes,
    updated_by: editor,
    updated_at: new Date().toISOString(),
  })
  if (error) throw new Error(`Margin deal save failed: ${error.message}`)
}

export async function deleteDeal(id: string): Promise<void> {
  const { error } = await sb.from('margin_deals').delete().eq('id', id)
  if (error) throw new Error(`Margin deal delete failed: ${error.message}`)
}

// Merge stored settings over defaults so adding a new setting later never
// breaks an existing saved row.
export async function loadSettings(): Promise<MarginSettings> {
  const { data, error } = await sb
    .from('margin_settings')
    .select('data')
    .eq('id', 'default')
    .maybeSingle()
  if (error) throw new Error(`Margin settings load failed: ${error.message}`)
  const merged = { ...DEFAULT_SETTINGS, ...((data?.data as Partial<MarginSettings>) || {}) }
  // Search teams changed shape (opaque weeklyCost -> per-member hours); fall
  // back to defaults if a stored row predates the member breakdown.
  if (
    !Array.isArray(merged.searchTeams) ||
    merged.searchTeams.some((t: any) => !Array.isArray(t?.members))
  ) {
    merged.searchTeams = DEFAULT_SETTINGS.searchTeams
  }
  return merged
}

export async function saveSettings(settings: MarginSettings, editor: string): Promise<void> {
  const { error } = await sb.from('margin_settings').upsert({
    id: 'default',
    data: settings,
    updated_by: editor,
    updated_at: new Date().toISOString(),
  })
  if (error) throw new Error(`Margin settings save failed: ${error.message}`)
}
