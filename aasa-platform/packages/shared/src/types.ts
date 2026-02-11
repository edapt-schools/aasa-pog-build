/**
 * Shared TypeScript types for AASA District Intelligence Platform
 * Used across API and Web packages
 */

// =============================================================================
// District Types
// =============================================================================

export interface District {
  id: string
  ncesId: string | null
  name: string
  state: string
  city: string | null
  county: string | null
  enrollment: number | null
  gradesServed: string | null
  localeCode: string | null
  frplPercent: string | null
  minorityPercent: string | null
  websiteDomain: string | null
  superintendentName: string | null
  superintendentEmail: string | null
  phone: string | null
  address: string | null
  lastScrapedAt: string | null
  scrapeStatus: string | null
  scrapeError: string | null
  createdAt: string
  updatedAt: string
}

export interface DistrictDocument {
  id: string
  ncesId: string
  documentUrl: string
  documentType: string
  documentTitle: string | null
  documentCategory: string | null
  extractedText: string | null
  textLength: number | null
  extractionMethod: string | null
  pageDepth: number | null
  discoveredAt: string | null
  lastCrawledAt: string | null
  contentHash: string | null
}

export interface DistrictKeywordScores {
  id: string
  ncesId: string
  readinessScore: string | null
  alignmentScore: string | null
  activationScore: string | null
  brandingScore: string | null
  totalScore: string | null
  outreachTier: string | null
  keywordMatches: Record<string, unknown> | null
  documentsAnalyzed: number | null
  scoredAt: string | null
  updatedAt: string | null
}

// =============================================================================
// API Request/Response Types
// =============================================================================

export interface ListDistrictsParams {
  // Pagination
  limit?: number
  offset?: number

  // Filters
  state?: string[] // Multi-select
  enrollmentMin?: number
  enrollmentMax?: number
  outreachTier?: string[] // ['tier1', 'tier2', 'tier3']
  hasSuperintendent?: boolean
  frplMin?: number // Free/Reduced Lunch % minimum (0-100)
  frplMax?: number // Free/Reduced Lunch % maximum (0-100)
  minorityMin?: number // Minority % minimum (0-100)
  minorityMax?: number // Minority % maximum (0-100)
  localeType?: string[] // ['city', 'suburb', 'town', 'rural']

  // Keyword score filters (min thresholds)
  readinessScoreMin?: number
  alignmentScoreMin?: number
  activationScoreMin?: number
  brandingScoreMin?: number

  // Search
  search?: string // Name search
}

export interface ListDistrictsResponse {
  data: District[]
  pagination: {
    total: number
    limit: number
    offset: number
    hasMore: boolean
  }
}

export interface DistrictDetailResponse {
  district: District
  keywordScores: DistrictKeywordScores | null
  documentCount: number
}

export interface DistrictDocumentsResponse {
  data: DistrictDocument[]
  total: number
}

// =============================================================================
// Search Types
// =============================================================================

export interface SemanticSearchParams {
  query: string
  limit?: number
  state?: string
  distanceThreshold?: number
  documentTypes?: string[] // Filter by document type
  dateFrom?: string // ISO date string - filter documents crawled after this date
  dateTo?: string // ISO date string - filter documents crawled before this date
}

export interface SemanticSearchResult {
  document: DistrictDocument
  district: District
  chunkText: string
  distance: number
  relevanceScore: number
}

export interface SemanticSearchResponse {
  results: SemanticSearchResult[]
  query: string
  total: number
}

// =============================================================================
// Similar Documents Types
// =============================================================================

export interface SimilarDocument {
  document: DistrictDocument
  district: District
  similarity: number // 0-1, higher is more similar
}

export interface SimilarDocumentsResponse {
  results: SimilarDocument[]
  sourceDocumentId: string
  total: number
}

// =============================================================================
// Keyword Evidence Types
// =============================================================================

export interface KeywordExcerpt {
  documentId: string
  documentType: string
  text: string
  keywords: string[]
}

export interface CategoryEvidence {
  score: number | null
  keywordsFound: string[]
  totalMentions: number
  documents: KeywordExcerpt[]
}

export interface KeywordEvidenceResponse {
  ncesId: string
  districtName: string
  readiness: CategoryEvidence | null
  alignment: CategoryEvidence | null
  activation: CategoryEvidence | null
  branding: CategoryEvidence | null
  totalScore: number | null
  scoredAt: string | null
}

// =============================================================================
// Search Filter Types
// =============================================================================

export interface SearchFilters {
  documentType?: string[] // Multi-select document types
  dateFrom?: string // ISO date string
  dateTo?: string // ISO date string
  state?: string // Single state filter for cross-district search
}

// =============================================================================
// Error Types
// =============================================================================

export interface APIError {
  error: string
  message?: string
  code?: string
}

// =============================================================================
// Insights Types (Phase 4)
// =============================================================================

export interface InsightsOverviewResponse {
  totalDistricts: number
  superintendentCoverage: { count: number; percent: number }
  documentStats: { totalDocuments: number }
  averageScores: {
    readiness: number
    alignment: number
    activation: number
    branding: number
    total: number
  }
  tierDistribution: { tier1: number; tier2: number; tier3: number }
  lastUpdated: string
}

export interface StateStats {
  stateCode: string
  stateName: string
  totalDistricts: number
  superintendentCount: number
  superintendentCoverage: number
  avgTotalScore: number
  tier1Count: number
  tier2Count: number
  tier3Count: number
  documentsCount: number
}

export interface StatesResponse {
  states: StateStats[]
}

export interface StateDetailResponse {
  stateCode: string
  stateName: string
  totalDistricts: number
  superintendentCoverage: { count: number; percent: number }
  scoreStats: {
    averageScores: {
      readiness: number
      alignment: number
      activation: number
      branding: number
    }
    tierDistribution: { tier1: number; tier2: number; tier3: number }
  }
  topDistricts: Array<{
    ncesId: string
    name: string
    totalScore: number
    tier: string
  }>
  documentsCount: number
}

export interface TrendingKeyword {
  keyword: string
  category: 'readiness' | 'alignment' | 'activation' | 'branding'
  currentCount: number
  changePercent: number
  trend: 'up' | 'down' | 'stable'
}

export interface TrendingResponse {
  period: string
  keywords: TrendingKeyword[]
}

// =============================================================================
// AI Command Center Types (vNext)
// =============================================================================

export type ConfidenceBand = 'high' | 'medium' | 'low'

export interface SignalContribution {
  signal: string
  category: 'readiness' | 'alignment' | 'activation' | 'branding' | 'semantic' | 'eligibility' | 'engagement'
  weight: number
  reason?: string
}

export interface DistrictWhyDetails {
  ncesId: string
  confidence: number
  confidenceBand: ConfidenceBand
  summary: string
  topSignals: SignalContribution[]
  sourceExcerpts: Array<{
    documentUrl?: string | null
    keyword: string
    excerpt: string
  }>
  dampeners?: Array<{
    signal: string
    impact: number
    reason: string
  }>
}

export interface LeadCommandFilters {
  states?: string[]
  minTotalScore?: number
  minReadinessScore?: number
  minActivationScore?: number
  limit?: number
  excludeNcesIds?: string[]
}

export interface EngagementEvent {
  ncesId: string
  eventType:
    | 'email_sent'
    | 'call_made'
    | 'meeting_booked'
    | 'meeting_held'
    | 'proposal_sent'
    | 'won'
    | 'lost'
  happenedAt: string
}

export interface EngagementSignals {
  events: EngagementEvent[]
  suppressionDays?: number
}

export interface GrantCriteria {
  frplMin?: number
  minorityMin?: number
  enrollmentMin?: number
  enrollmentMax?: number
  states?: string[]
  requiredKeywords?: string[]
  preferredKeywords?: string[]
}

export interface CommandAttachment {
  filename: string
  mimeType: string
  textContent: string
}

export type CommandIntent =
  | 'next_hottest_uncontacted'
  | 'grant_match'
  | 'district_search'
  | 'lead_search'
  | 'insights_briefing'
  | 'unknown'

export interface CommandRequest {
  prompt: string
  attachment?: CommandAttachment
  leadFilters?: LeadCommandFilters
  engagementSignals?: EngagementSignals
  grantCriteria?: GrantCriteria
  confidenceThreshold?: number
}

export interface CommandDistrictResult {
  district: District
  score: {
    total: number
    readiness: number
    alignment: number
    activation: number
    branding: number
    composite: number
  }
  why: DistrictWhyDetails
  actions: {
    openDistrictSite?: string | null
    email?: string | null
    ncesId: string | null
  }
}

export interface CommandResponse {
  intent: CommandIntent
  confidenceThreshold: number
  explanation: string
  grantCriteria?: GrantCriteria
  districts: CommandDistrictResult[]
  generatedAt: string
}
