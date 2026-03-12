export interface Entity {
  id: string;
  name: string;
  tier: 'self' | number;
  searchQueries: string[];
  website: string;
}

export interface Article {
  id: string;
  entity_id: string;
  entity_name: string;
  title: string;
  link: string;
  source: string;
  pub_date: string;
  snippet: string;
  sentiment_score: number;
  sentiment_label: 'positive' | 'neutral' | 'negative';
  alerted: boolean;
  priority: boolean;
  created_at: string;
  search_query: string;
}

export interface FinancialArticle {
  id: string;
  title: string;
  link: string;
  source_name: string;
  source_domain: string;
  pub_date: string;
  snippet: string;
  sentiment_score: number;
  sentiment_label: 'positive' | 'neutral' | 'negative';
  created_at: string;
  search_query: string;
}

export interface FinancialNewsSource {
  name: string;
  domain: string;
  searchTerms: string[];
}

export const FINANCIAL_NEWS_SOURCES: FinancialNewsSource[] = [
  { name: 'Bloomberg', domain: 'bloomberg.com', searchTerms: ['finance', 'markets'] },
  { name: 'Reuters', domain: 'reuters.com', searchTerms: ['finance', 'markets', 'economy'] },
  { name: 'CNBC', domain: 'cnbc.com', searchTerms: ['finance', 'markets', 'economy'] },
  { name: 'Yahoo Finance', domain: 'finance.yahoo.com', searchTerms: ['finance', 'markets'] },
  { name: 'MarketWatch', domain: 'marketwatch.com', searchTerms: ['markets', 'economy'] },
  { name: 'Wall Street Journal', domain: 'wsj.com', searchTerms: ['finance', 'markets'] },
  { name: 'Financial Times', domain: 'ft.com', searchTerms: ['finance', 'markets'] },
  { name: 'Seeking Alpha', domain: 'seekingalpha.com', searchTerms: ['investing', 'markets'] },
  { name: "Barron's", domain: 'barrons.com', searchTerms: ['markets', 'investing'] },
  { name: 'Forbes', domain: 'forbes.com', searchTerms: ['finance', 'investing'] },
  { name: 'Investopedia', domain: 'investopedia.com', searchTerms: ['markets', 'economy'] },
  { name: 'Benzinga', domain: 'benzinga.com', searchTerms: ['markets', 'trading'] },
  { name: 'Business Insider', domain: 'businessinsider.com', searchTerms: ['finance', 'markets'] },
  { name: 'Motley Fool', domain: 'fool.com', searchTerms: ['investing', 'stocks'] },
  { name: 'The Economist', domain: 'economist.com', searchTerms: ['economy', 'finance'] },
];

export interface AumAssetClass {
  name: string;
  amount_billions: number;
}

export interface AumEntry {
  entity_id: string;
  entity_name: string;
  aum_billions: number;
  as_of_date: string;
  source: string;
  notes: string;
  updated_at: string;
  discretionary_billions?: number;
  non_discretionary_billions?: number;
  asset_classes?: AumAssetClass[];
}

export interface SecFiling {
  id: string;
  entity_names: string[];
  filing_type: string;
  filed_date: string;
  company_name: string;
  file_number: string;
  document_url: string;
  description: string;
  keyword_hits: Record<string, number>;
  risk_level: 'critical' | 'warning' | 'monitor' | 'info';
  risk_score: number;
  period_ending: string;
  cik: string;
  accession_number: string;
  sic_code: string;
  top_words?: string[];
  created_at: string;
}

export interface PredictionMarket {
  id: string;
  question: string;
  probability: number;
  volume: number;
  end_date: string;
  source: 'polymarket';
  category: string;
  url: string;
  last_updated: string;
}

export interface GovEvent {
  id: string;
  title: string;
  description: string;
  event_date: string;
  event_time: string | null;
  source: string;
  category: string;
  link: string;
  created_at: string;
}

export interface CrawlLogEntry {
  crawl_type: string;
  entity_id: string | null;
  articles_found: number;
  status: string;
  error_message: string | null;
  started_at: string;
  finished_at: string;
}

export interface CustomEntity extends Entity {
  custom: true;
  added_at: string;
}

export interface DailyBrief {
  generated_at: string;
  market_sentiment: {
    avg_score: number;
    trend: 'improving' | 'stable' | 'declining';
    positive_pct: number;
    neutral_pct: number;
    negative_pct: number;
    total_articles: number;
    prev_avg_score: number;
  };
  top_stories: Array<{
    title: string;
    link: string;
    entity_name: string;
    sentiment_label: string;
    pub_date: string;
    reason: string;
  }>;
  risk_alerts: Array<{
    company_name: string;
    filing_type: string;
    risk_level: string;
    risk_score: number;
    filed_date: string;
    document_url: string;
    description: string;
  }>;
  prediction_movers: Array<{
    question: string;
    probability: number;
    volume: number;
    category: string;
    url: string;
  }>;
  upcoming_events: Array<{
    title: string;
    event_date: string;
    category: string;
    link: string;
  }>;
  competitor_activity: Array<{
    entity_id: string;
    entity_name: string;
    article_count: number;
    top_headline: string;
    top_link: string;
  }>;
  key_themes: Array<{
    theme: string;
    count: number;
  }>;
}

export const SELF: Entity = {
  id: 'dobbs-group',
  name: 'The Dobbs Group',
  tier: 'self',
  searchQueries: [
    '"Dobbs Group" Graystone',
    '"Craig Dobbs" "Morgan Stanley"',
    '"Dobbs Group" "institutional consulting"',
    '"Graystone Consulting" "Dobbs"',
  ],
  website: 'https://graystone.morganstanley.com/the-dobbs-group',
};

export const COMPETITORS: Entity[] = [
  {
    id: 'nepc',
    name: 'NEPC',
    tier: 1,
    searchQueries: ['"NEPC" investment consulting', '"NEPC" institutional'],
    website: 'https://www.nepc.com',
  },
  {
    id: 'mercer',
    name: 'Mercer Investment Consulting',
    tier: 1,
    searchQueries: ['"Mercer" investment consulting', '"Mercer" institutional advisory'],
    website: 'https://www.mercer.com',
  },
  {
    id: 'callan',
    name: 'Callan Associates',
    tier: 1,
    searchQueries: ['"Callan Associates" consulting', '"Callan" institutional investment'],
    website: 'https://www.callan.com',
  },
  {
    id: 'cambridge',
    name: 'Cambridge Associates',
    tier: 1,
    searchQueries: ['"Cambridge Associates"', '"Cambridge Associates" endowment'],
    website: 'https://www.cambridgeassociates.com',
  },
  {
    id: 'meketa',
    name: 'Meketa Investment Group',
    tier: 1,
    searchQueries: ['"Meketa Investment Group"', '"Meketa" consulting'],
    website: 'https://www.meketa.com',
  },
  {
    id: 'wilshire',
    name: 'Wilshire Associates',
    tier: 1,
    searchQueries: ['"Wilshire Associates"', '"Wilshire" advisory'],
    website: 'https://www.wilshire.com',
  },
  {
    id: 'marquette',
    name: 'Marquette Associates',
    tier: 1,
    searchQueries: ['"Marquette Associates"'],
    website: 'https://www.marquetteassociates.com',
  },
  {
    id: 'captrust',
    name: 'CAPTRUST',
    tier: 2,
    searchQueries: ['"CAPTRUST" advisory', '"CAPTRUST" retirement'],
    website: 'https://www.captrust.com',
  },
  {
    id: 'jpmorgan',
    name: 'J.P. Morgan Asset Management',
    tier: 2,
    searchQueries: ['"J.P. Morgan Asset Management"', '"JP Morgan" institutional'],
    website: 'https://am.jpmorgan.com',
  },
  {
    id: 'ubs',
    name: 'UBS Institutional Consulting',
    tier: 2,
    searchQueries: ['"UBS" institutional consulting', '"UBS" wealth advisory'],
    website: 'https://www.ubs.com',
  },
  {
    id: 'william-blair',
    name: 'William Blair',
    tier: 2,
    searchQueries: ['"William Blair" wealth management', '"William Blair" advisory'],
    website: 'https://www.williamblair.com',
  },
  {
    id: 'sageview',
    name: 'SageView Advisory Group',
    tier: 2,
    searchQueries: ['"SageView Advisory"', '"SageView" retirement'],
    website: 'https://www.sageviewadvisory.com',
  },
];

export const ALL_ENTITIES: Entity[] = [SELF, ...COMPETITORS];

export const PRIORITY_KEYWORDS: string[] = [
  'interest rate', 'federal reserve', 'fed funds', 'rate cut',
  'rate hike', 'rate increase', 'rate decrease', 'monetary policy',
  'fomc', 'basis points', 'fed pivot', 'rate decision',
  'fed meeting', 'rate hold', 'quantitative tightening',
];

// Severity-weighted keywords for SEC filing analysis
// Weight: critical=3, warning=2, monitor=1
export const SEC_KEYWORD_CATEGORIES: Record<string, { keywords: string[]; weight: number }> = {
  critical: {
    weight: 3,
    keywords: [
      'enforcement', 'fraud', 'penalty', 'sanction', 'cease and desist',
      'disgorgement', 'insider trading', 'violation', 'criminal',
      'whistleblower', 'revocation', 'barred', 'suspension',
    ],
  },
  warning: {
    weight: 2,
    keywords: [
      'investigation', 'material weakness', 'deficiency', 'settlement',
      'arbitration', 'conflict of interest', 'breach', 'restatement',
      'adverse', 'litigation', 'class action', 'subpoena',
      'regulatory action', 'consent order',
    ],
  },
  monitor: {
    weight: 1,
    keywords: [
      'risk', 'fiduciary', 'compliance', 'audit', 'custody',
      'best execution', 'advisory fee', 'proxy', 'material change',
      'governance', 'disclosure', 'amendment', 'corrective action',
      'remediation', 'oversight',
    ],
  },
};

// Flat list for backward compat
export const SEC_KEYWORDS: string[] = Object.values(SEC_KEYWORD_CATEGORIES)
  .flatMap(c => c.keywords);

// Filing type explanations relevant to institutional consulting
export const FILING_TYPE_INFO: Record<string, { label: string; description: string }> = {
  'ADV': { label: 'Adviser Registration', description: 'Investment adviser registration — shows AUM, fees, conflicts, disciplinary history' },
  'ADV-W': { label: 'Adviser Withdrawal', description: 'Investment adviser deregistration' },
  '10-K': { label: 'Annual Report', description: 'Comprehensive annual financial report with audited statements' },
  '10-Q': { label: 'Quarterly Report', description: 'Quarterly financial update with unaudited financials' },
  '8-K': { label: 'Current Report', description: 'Major event disclosure — leadership changes, M&A, material agreements' },
  '13F': { label: 'Holdings Report', description: 'Quarterly institutional holdings disclosure ($100M+ managers)' },
  'S-1': { label: 'IPO Registration', description: 'Initial public offering registration statement' },
  'DEF 14A': { label: 'Proxy Statement', description: 'Annual meeting proxy — exec compensation, board info, proposals' },
  'N-CSR': { label: 'Fund Annual Report', description: 'Certified shareholder report for registered investment companies' },
  '4': { label: 'Insider Trade', description: 'Changes in beneficial ownership by insiders' },
  'SC 13D': { label: 'Beneficial Ownership', description: 'Ownership above 5% with activist intent' },
  'SC 13G': { label: 'Passive Ownership', description: 'Passive ownership above 5%' },
};

// SIC code descriptions for common financial industry codes
export const SIC_DESCRIPTIONS: Record<string, string> = {
  '6020': 'Commercial Banking',
  '6021': 'National Commercial Banks',
  '6022': 'State Commercial Banks',
  '6035': 'Savings Institutions',
  '6099': 'Financial Services',
  '6141': 'Personal Credit',
  '6153': 'Short-Term Business Credit',
  '6159': 'Federal Loan Agencies',
  '6162': 'Mortgage Bankers',
  '6199': 'Finance Services',
  '6200': 'Security & Commodity Brokers',
  '6211': 'Security Brokers & Dealers',
  '6282': 'Investment Advice',
  '6311': 'Fire, Marine & Casualty Insurance',
  '6321': 'Health Insurance',
  '6399': 'Insurance',
  '6500': 'Real Estate',
  '6726': 'Investment Offices',
  '6770': 'Blank Checks',
};

export const PREDICTION_KEYWORDS: string[] = [
  'Federal Reserve', 'interest rate', 'SEC', 'oil price',
  'inflation', 'GDP', 'unemployment', 'rate cut', 'rate hike',
  'FOMC', 'recession', 'tariff',
];

export const SEED_AUM_DATA: AumEntry[] = [
  { entity_id: 'nepc', entity_name: 'NEPC', aum_billions: 1600, as_of_date: '2024-12-31', source: 'ADV filing', notes: 'Regulatory assets under advisement', updated_at: '2025-01-01T00:00:00Z',
    discretionary_billions: 45, non_discretionary_billions: 1555,
    asset_classes: [{ name: 'Equities', amount_billions: 560 }, { name: 'Fixed Income', amount_billions: 400 }, { name: 'Alternatives', amount_billions: 320 }, { name: 'Real Assets', amount_billions: 160 }, { name: 'Cash & Other', amount_billions: 160 }] },
  { entity_id: 'mercer', entity_name: 'Mercer Investment Consulting', aum_billions: 370, as_of_date: '2024-12-31', source: 'Public disclosure', notes: '', updated_at: '2025-01-01T00:00:00Z',
    discretionary_billions: 220, non_discretionary_billions: 150,
    asset_classes: [{ name: 'Equities', amount_billions: 130 }, { name: 'Fixed Income', amount_billions: 100 }, { name: 'Alternatives', amount_billions: 85 }, { name: 'Real Assets', amount_billions: 35 }, { name: 'Cash & Other', amount_billions: 20 }] },
  { entity_id: 'callan', entity_name: 'Callan Associates', aum_billions: 4000, as_of_date: '2024-12-31', source: 'Company website', notes: 'Advisory assets', updated_at: '2025-01-01T00:00:00Z',
    discretionary_billions: 60, non_discretionary_billions: 3940,
    asset_classes: [{ name: 'Equities', amount_billions: 1400 }, { name: 'Fixed Income', amount_billions: 1000 }, { name: 'Alternatives', amount_billions: 800 }, { name: 'Real Assets', amount_billions: 480 }, { name: 'Cash & Other', amount_billions: 320 }] },
  { entity_id: 'cambridge', entity_name: 'Cambridge Associates', aum_billions: 500, as_of_date: '2024-12-31', source: 'Public estimate', notes: '', updated_at: '2025-01-01T00:00:00Z',
    discretionary_billions: 300, non_discretionary_billions: 200,
    asset_classes: [{ name: 'Equities', amount_billions: 175 }, { name: 'Fixed Income', amount_billions: 75 }, { name: 'Alternatives', amount_billions: 175 }, { name: 'Real Assets', amount_billions: 50 }, { name: 'Cash & Other', amount_billions: 25 }] },
  { entity_id: 'meketa', entity_name: 'Meketa Investment Group', aum_billions: 1800, as_of_date: '2024-12-31', source: 'ADV filing', notes: 'Regulatory AUA', updated_at: '2025-01-01T00:00:00Z',
    discretionary_billions: 30, non_discretionary_billions: 1770,
    asset_classes: [{ name: 'Equities', amount_billions: 630 }, { name: 'Fixed Income', amount_billions: 450 }, { name: 'Alternatives', amount_billions: 360 }, { name: 'Real Assets', amount_billions: 216 }, { name: 'Cash & Other', amount_billions: 144 }] },
  { entity_id: 'wilshire', entity_name: 'Wilshire Associates', aum_billions: 1200, as_of_date: '2024-12-31', source: 'ADV filing', notes: '', updated_at: '2025-01-01T00:00:00Z',
    discretionary_billions: 80, non_discretionary_billions: 1120,
    asset_classes: [{ name: 'Equities', amount_billions: 420 }, { name: 'Fixed Income', amount_billions: 300 }, { name: 'Alternatives', amount_billions: 240 }, { name: 'Real Assets', amount_billions: 144 }, { name: 'Cash & Other', amount_billions: 96 }] },
  { entity_id: 'marquette', entity_name: 'Marquette Associates', aum_billions: 350, as_of_date: '2024-12-31', source: 'Company website', notes: '', updated_at: '2025-01-01T00:00:00Z',
    discretionary_billions: 15, non_discretionary_billions: 335,
    asset_classes: [{ name: 'Equities', amount_billions: 140 }, { name: 'Fixed Income', amount_billions: 88 }, { name: 'Alternatives', amount_billions: 70 }, { name: 'Real Assets', amount_billions: 35 }, { name: 'Cash & Other', amount_billions: 17 }] },
  { entity_id: 'captrust', entity_name: 'CAPTRUST', aum_billions: 850, as_of_date: '2024-12-31', source: 'Press release', notes: 'Total advisory assets', updated_at: '2025-01-01T00:00:00Z',
    discretionary_billions: 600, non_discretionary_billions: 250,
    asset_classes: [{ name: 'Equities', amount_billions: 340 }, { name: 'Fixed Income', amount_billions: 213 }, { name: 'Alternatives', amount_billions: 128 }, { name: 'Real Assets', amount_billions: 85 }, { name: 'Cash & Other', amount_billions: 84 }] },
  { entity_id: 'jpmorgan', entity_name: 'J.P. Morgan Asset Management', aum_billions: 3400, as_of_date: '2024-12-31', source: 'Quarterly report', notes: 'Global AUM', updated_at: '2025-01-01T00:00:00Z',
    discretionary_billions: 2800, non_discretionary_billions: 600,
    asset_classes: [{ name: 'Equities', amount_billions: 1020 }, { name: 'Fixed Income', amount_billions: 850 }, { name: 'Alternatives', amount_billions: 680 }, { name: 'Real Assets', amount_billions: 510 }, { name: 'Cash & Other', amount_billions: 340 }] },
  { entity_id: 'ubs', entity_name: 'UBS Institutional Consulting', aum_billions: 4000, as_of_date: '2024-12-31', source: 'Annual report', notes: 'Invested assets, global', updated_at: '2025-01-01T00:00:00Z',
    discretionary_billions: 2400, non_discretionary_billions: 1600,
    asset_classes: [{ name: 'Equities', amount_billions: 1400 }, { name: 'Fixed Income', amount_billions: 1000 }, { name: 'Alternatives', amount_billions: 800 }, { name: 'Real Assets', amount_billions: 440 }, { name: 'Cash & Other', amount_billions: 360 }] },
  { entity_id: 'william-blair', entity_name: 'William Blair', aum_billions: 70, as_of_date: '2024-12-31', source: 'ADV filing', notes: '', updated_at: '2025-01-01T00:00:00Z',
    discretionary_billions: 62, non_discretionary_billions: 8,
    asset_classes: [{ name: 'Equities', amount_billions: 42 }, { name: 'Fixed Income', amount_billions: 14 }, { name: 'Alternatives', amount_billions: 7 }, { name: 'Cash & Other', amount_billions: 7 }] },
  { entity_id: 'sageview', entity_name: 'SageView Advisory Group', aum_billions: 250, as_of_date: '2024-12-31', source: 'Company website', notes: '', updated_at: '2025-01-01T00:00:00Z',
    discretionary_billions: 180, non_discretionary_billions: 70,
    asset_classes: [{ name: 'Equities', amount_billions: 100 }, { name: 'Fixed Income', amount_billions: 63 }, { name: 'Alternatives', amount_billions: 50 }, { name: 'Real Assets', amount_billions: 25 }, { name: 'Cash & Other', amount_billions: 12 }] },
];

// ── Market Indicators (FRED + Fear & Greed) ────────────────

export interface FredSeriesPoint {
  date: string;
  value: number;
}

export interface FredSeries {
  series_id: string;
  label: string;
  unit: string;
  latest_value: number;
  latest_date: string;
  data_points: FredSeriesPoint[];
}

export interface FearGreedData {
  score: number;
  rating: string; // 'Extreme Fear' | 'Fear' | 'Neutral' | 'Greed' | 'Extreme Greed'
  previous_close: number;
  one_week_ago: number;
  one_month_ago: number;
  one_year_ago: number;
  updated_at: string;
}

export interface MarketIndicators {
  fred_series: FredSeries[];
  fear_greed: FearGreedData | null;
  yield_spread: number | null; // 10Y - 2Y
  updated_at: string;
}

// ── Alpha Vantage Sentiment ─────────────────────────────────

export interface SentimentSnapshot {
  topic: string;
  score: number; // -1 to 1
  label: string; // Bearish, Somewhat-Bearish, Neutral, Somewhat-Bullish, Bullish
  article_count: number;
  top_headlines: Array<{ title: string; url: string; sentiment: number }>;
  fetched_at: string;
}

export interface AggregatedSentiment {
  composite_score: number;
  composite_label: string;
  topics: SentimentSnapshot[];
  updated_at: string;
}

// ── 13F Holdings ───────────────────────────────────────────

export interface Holding13F {
  issuer: string;
  cusip: string;
  value_thousands: number;
  shares: number;
  share_type: string; // SH, PRN, etc
}

export interface Filing13F {
  entity_name: string;
  cik: string;
  period: string; // e.g., '2024-12-31'
  filed_date: string;
  accession_number: string;
  holdings: Holding13F[];
  total_value_thousands: number;
}

export interface HoldingChange {
  issuer: string;
  cusip: string;
  current_value: number;
  previous_value: number;
  change_pct: number;
  change_type: 'new' | 'increased' | 'decreased' | 'sold' | 'unchanged';
  current_shares: number;
  previous_shares: number;
}

export interface HoldingsComparison {
  entity_name: string;
  current_period: string;
  previous_period: string;
  changes: HoldingChange[];
  total_current: number;
  total_previous: number;
}

// ── FINRA BrokerCheck ──────────────────────────────────────

export interface FinraAlert {
  id: string;
  firm_name: string;
  crd_number: string;
  action_type: string; // 'disciplinary' | 'arbitration' | 'regulatory'
  severity: 'critical' | 'warning' | 'info';
  summary: string;
  date: string;
  source_url: string;
  created_at: string;
}
