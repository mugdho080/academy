export interface ResumeExperience {
  role: string
  organization?: string
  dates?: string
  duties?: string[]
}

export interface ResumeEducation {
  qualification?: string
  degree?: string
  institution?: string
  school?: string
  year?: string
  dates?: string
}

export interface ResumeDraft {
  personal_name?: string
  contact_email?: string
  contact_phone?: string
  contact_address?: string
  target_role?: string
  summary?: string
  skills?: string[]
  experience?: ResumeExperience[]
  education?: ResumeEducation[]
  certificates?: Array<string | { title?: string; name?: string }>
  availability?: string
  references?: string
}

export interface RoutineItem {
  time_of_day?: string
  title: string
  description?: string
  icon?: string
  order_index?: number
}

export interface RoutineDraft {
  routine_type?: string
  wake_time?: string
  bedtime?: string
  items?: RoutineItem[]
}

const RESUME_STEPS = new Set([
  'welcome',
  'personal_details',
  'contact_details',
  'target_role',
  'summary',
  'skills',
  'experience',
  'education',
  'certificates',
  'availability',
  'references',
  'preview',
])

const ROUTINE_STEPS = new Set([
  'welcome',
  'routine_type',
  'wake_time',
  'bedtime',
  'morning',
  'activities',
  'meals',
  'evening',
  'review',
  'preview',
])

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function cleanString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}

function splitList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') return cleanString(item)
        const objectItem = asObject(item)
        return cleanString(objectItem.title) ?? cleanString(objectItem.name) ?? cleanString(objectItem.text)
      })
      .filter((item): item is string => Boolean(item))
  }

  const text = cleanString(value)
  if (!text) return []

  return text
    .split(/\n|,|;|•|-/)
    .map((part) => part.trim())
    .filter(Boolean)
}

function mergeDefined<T extends object>(base: T, patch: Partial<T>): T {
  const next = { ...base }
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) {
      next[key as keyof T] = value as T[keyof T]
    }
  }
  return next
}

export function normalizeResumeDraft(input: unknown): ResumeDraft {
  const raw = asObject(input)
  const contact = asObject(raw.contact)

  const experienceSource = raw.experience ?? raw.experience_details ?? raw.work_experience
  const educationSource = raw.education ?? raw.education_training
  const certificateSource = raw.certificates ?? raw.licenses

  const experience = Array.isArray(experienceSource)
    ? experienceSource.map((item) => {
      const rawItem = asObject(item)
      return {
        role: cleanString(rawItem.role) ?? cleanString(rawItem.title) ?? cleanString(rawItem.job_title) ?? 'Experience',
        organization: cleanString(rawItem.organization) ?? cleanString(rawItem.company) ?? cleanString(rawItem.workplace),
        dates: cleanString(rawItem.dates) ?? cleanString(rawItem.date_range),
        duties: splitList(rawItem.duties ?? rawItem.description ?? rawItem.details),
      }
    }).filter((item) => item.role || item.organization || item.duties?.length)
    : splitList(experienceSource).map((item) => ({ role: item }))

  const education = Array.isArray(educationSource)
    ? educationSource.map((item) => {
      const rawItem = asObject(item)
      return {
        qualification: cleanString(rawItem.qualification) ?? cleanString(rawItem.degree) ?? cleanString(rawItem.course),
        institution: cleanString(rawItem.institution) ?? cleanString(rawItem.school) ?? cleanString(rawItem.provider),
        year: cleanString(rawItem.year),
        dates: cleanString(rawItem.dates),
      }
    }).filter((item) => item.qualification || item.institution)
    : splitList(educationSource).map((item) => ({ qualification: item }))

  return {
    personal_name: cleanString(raw.personal_name) ?? cleanString(raw.name) ?? cleanString(raw.full_name),
    contact_email: cleanString(raw.contact_email) ?? cleanString(raw.email) ?? cleanString(contact.email),
    contact_phone: cleanString(raw.contact_phone) ?? cleanString(raw.phone) ?? cleanString(contact.phone),
    contact_address: cleanString(raw.contact_address) ?? cleanString(raw.suburb) ?? cleanString(raw.address) ?? cleanString(contact.address),
    target_role: cleanString(raw.target_role) ?? cleanString(raw.role_goal),
    summary: cleanString(raw.summary) ?? cleanString(raw.professional_summary),
    skills: splitList(raw.skills),
    experience,
    education,
    certificates: splitList(certificateSource),
    availability: cleanString(raw.availability),
    references: cleanString(raw.references),
  }
}

export function mergeResumeDraft(base: unknown, patch: unknown): ResumeDraft {
  return mergeDefined(normalizeResumeDraft(base), normalizeResumeDraft(patch))
}

export function normalizeRoutineDraft(input: unknown): RoutineDraft {
  const raw = asObject(input)
  const itemSource = raw.items ?? raw.activities ?? raw.steps
  const items: RoutineItem[] = Array.isArray(itemSource)
    ? itemSource.map((item, index) => {
      const rawItem = asObject(item)
      const title = cleanString(rawItem.title) ?? cleanString(rawItem.activity) ?? cleanString(rawItem.name)
      if (!title) return null
      const normalizedItem: RoutineItem = {
        time_of_day: cleanString(rawItem.time_of_day) ?? cleanString(rawItem.time) ?? cleanString(rawItem.when),
        title,
        description: cleanString(rawItem.description) ?? cleanString(rawItem.notes),
        icon: cleanString(rawItem.icon),
        order_index: Number.isFinite(Number(rawItem.order_index)) ? Number(rawItem.order_index) : index,
      }
      return normalizedItem
    }).filter((item): item is RoutineItem => Boolean(item))
    : splitList(itemSource).map((title, index) => ({ title, order_index: index }))

  return {
    routine_type: cleanString(raw.routine_type) ?? cleanString(raw.type),
    wake_time: cleanString(raw.wake_time),
    bedtime: cleanString(raw.bedtime),
    items,
  }
}

export function mergeRoutineDraft(base: unknown, patch: unknown): RoutineDraft {
  const normalizedBase = normalizeRoutineDraft(base)
  const normalizedPatch = normalizeRoutineDraft(patch)
  return mergeDefined(normalizedBase, normalizedPatch)
}

export function normalizeResumeStep(step: unknown): string {
  const value = cleanString(step)
  return value && RESUME_STEPS.has(value) ? value : 'preview'
}

export function normalizeRoutineStep(step: unknown): string {
  const value = cleanString(step)
  return value && ROUTINE_STEPS.has(value) ? value : 'preview'
}

export function isResumeReady(draft: ResumeDraft, step?: string): boolean {
  return step === 'preview' || Boolean(draft.personal_name && (draft.skills?.length || draft.experience?.length || draft.education?.length || draft.summary))
}

export function isRoutineReady(draft: RoutineDraft, step?: string): boolean {
  return step === 'preview' || Boolean(draft.items && draft.items.length >= 2)
}
