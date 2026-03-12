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

export interface AumEntry {
  entity_id: string;
  entity_name: string;
  aum_billions: number;
  as_of_date: string;
  source: string;
  notes: string;
  updated_at: string;
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
  { entity_id: 'nepc', entity_name: 'NEPC', aum_billions: 1600, as_of_date: '2024-12-31', source: 'ADV filing', notes: 'Regulatory assets under advisement', updated_at: '2025-01-01T00:00:00Z' },
  { entity_id: 'mercer', entity_name: 'Mercer Investment Consulting', aum_billions: 370, as_of_date: '2024-12-31', source: 'Public disclosure', notes: '', updated_at: '2025-01-01T00:00:00Z' },
  { entity_id: 'callan', entity_name: 'Callan Associates', aum_billions: 4000, as_of_date: '2024-12-31', source: 'Company website', notes: 'Advisory assets', updated_at: '2025-01-01T00:00:00Z' },
  { entity_id: 'cambridge', entity_name: 'Cambridge Associates', aum_billions: 500, as_of_date: '2024-12-31', source: 'Public estimate', notes: '', updated_at: '2025-01-01T00:00:00Z' },
  { entity_id: 'meketa', entity_name: 'Meketa Investment Group', aum_billions: 1800, as_of_date: '2024-12-31', source: 'ADV filing', notes: 'Regulatory AUA', updated_at: '2025-01-01T00:00:00Z' },
  { entity_id: 'wilshire', entity_name: 'Wilshire Associates', aum_billions: 1200, as_of_date: '2024-12-31', source: 'ADV filing', notes: '', updated_at: '2025-01-01T00:00:00Z' },
  { entity_id: 'marquette', entity_name: 'Marquette Associates', aum_billions: 350, as_of_date: '2024-12-31', source: 'Company website', notes: '', updated_at: '2025-01-01T00:00:00Z' },
  { entity_id: 'captrust', entity_name: 'CAPTRUST', aum_billions: 850, as_of_date: '2024-12-31', source: 'Press release', notes: 'Total advisory assets', updated_at: '2025-01-01T00:00:00Z' },
  { entity_id: 'jpmorgan', entity_name: 'J.P. Morgan Asset Management', aum_billions: 3400, as_of_date: '2024-12-31', source: 'Quarterly report', notes: 'Global AUM', updated_at: '2025-01-01T00:00:00Z' },
  { entity_id: 'ubs', entity_name: 'UBS Institutional Consulting', aum_billions: 4000, as_of_date: '2024-12-31', source: 'Annual report', notes: 'Invested assets, global', updated_at: '2025-01-01T00:00:00Z' },
  { entity_id: 'william-blair', entity_name: 'William Blair', aum_billions: 70, as_of_date: '2024-12-31', source: 'ADV filing', notes: '', updated_at: '2025-01-01T00:00:00Z' },
  { entity_id: 'sageview', entity_name: 'SageView Advisory Group', aum_billions: 250, as_of_date: '2024-12-31', source: 'Company website', notes: '', updated_at: '2025-01-01T00:00:00Z' },
];
