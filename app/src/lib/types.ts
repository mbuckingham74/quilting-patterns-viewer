export interface Pattern {
  id: number
  file_name: string | null
  file_extension: string | null
  file_size: number | null
  author: string | null
  author_url: string | null
  author_notes: string | null
  notes: string | null
  thumbnail_url: string | null
  pattern_file_url: string | null
  created_at: string
}

export interface Keyword {
  id: number
  value: string
}

export interface PatternKeyword {
  pattern_id: number
  keyword_id: number
}

export interface KeywordGroup {
  id: number
  name: string
}

export interface PatternWithKeywords extends Pattern {
  keywords: Keyword[]
}

export interface PaginatedResponse<T> {
  data: T[]
  count: number
  page: number
  pageSize: number
  totalPages: number
}

export interface FilterOptions {
  search?: string
  keywords?: number[]
  fileExtensions?: string[]
  author?: string
}

export interface UserFavorite {
  id: number
  user_id: string
  pattern_id: number
  created_at: string
}

export interface SavedSearch {
  id: number
  user_id: string
  query: string
  name: string | null
  created_at: string
}

export interface UserFavoriteWithPattern extends UserFavorite {
  patterns: Pattern
}

export interface Profile {
  id: string
  email: string
  display_name: string | null
  is_approved: boolean
  is_admin: boolean
  approved_by: string | null
  approved_at: string | null
  created_at: string
}

// Admin emails that get auto-approved
export const ADMIN_EMAILS = [
  'michael.buckingham74@gmail.com',
  'pamncharlie@gmail.com',
]
