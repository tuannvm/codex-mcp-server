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
  created_at: string;
  search_query: string;
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
