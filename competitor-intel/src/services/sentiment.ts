const NEGATIVE_WORDS = new Set([
  'lawsuit', 'sued', 'suing', 'fraud', 'scandal', 'investigation', 'investigated',
  'penalty', 'fine', 'fined', 'violation', 'misconduct', 'negligence', 'negligent',
  'complaint', 'complaints', 'accused', 'allegations', 'alleged', 'indicted',
  'charged', 'criminal', 'illegal', 'illicit', 'corrupt', 'corruption',
  'breach', 'breached', 'failure', 'failed', 'failing', 'bankrupt', 'bankruptcy',
  'default', 'defaulted', 'collapse', 'collapsed', 'crisis', 'trouble',
  'problematic', 'controversy', 'controversial', 'warning', 'risk', 'risky',
  'decline', 'declining', 'loss', 'losses', 'downturn', 'downgrade', 'downgraded',
  'worst', 'terrible', 'poor', 'weak', 'weakened', 'layoff', 'layoffs',
  'fired', 'terminated', 'resign', 'resigned', 'ousted', 'departure',
  'sec enforcement', 'finra action', 'regulatory action', 'cease and desist',
  'consent order', 'sanctions', 'sanctioned', 'suspended', 'suspension',
  'revoked', 'censured', 'censure', 'arbitration', 'settlement',
  'whistleblower', 'insider trading', 'market manipulation',
  'fiduciary breach', 'misrepresentation', 'undisclosed', 'conflict of interest',
  'disgruntled', 'dissatisfied', 'unhappy', 'disappointed', 'frustrating',
  'misleading', 'deceptive', 'unethical', 'unprofessional', 'incompetent',
  'underperform', 'underperformed', 'underperforming', 'subpar',
]);

const POSITIVE_WORDS = new Set([
  'award', 'awarded', 'recognized', 'recognition', 'honored', 'top',
  'best', 'leading', 'leader', 'excellent', 'outstanding', 'exceptional',
  'innovative', 'innovation', 'growth', 'growing', 'expanded', 'expansion',
  'record', 'success', 'successful', 'achievement', 'milestone', 'breakthrough',
  'partnership', 'collaboration', 'launch', 'launched', 'promoted', 'promotion',
  'hired', 'appointed', 'named', 'ranked', 'ranking', 'upgrade', 'upgraded',
  'outperform', 'outperformed', 'outperforming', 'returns', 'gains',
  'profit', 'profitable', 'revenue', 'dividend', 'yield',
  'fiduciary', 'trusted', 'trust', 'integrity', 'transparent', 'transparency',
  'compliant', 'compliance', 'sustainable', 'esg',
  'barrons', "barron's", 'top 100', 'top team', 'advisory excellence',
  'client satisfaction', 'five star', '5 star',
]);

const INTENSIFIERS = new Set([
  'very', 'extremely', 'highly', 'significantly', 'major', 'serious',
  'critical', 'severe', 'massive', 'huge', 'enormous',
]);

const NEGATORS = new Set([
  'not', 'no', 'never', 'neither', 'nor', 'hardly', 'barely',
  'without', "doesn't", "don't", "didn't", "won't", "isn't", "aren't",
]);

export function analyzeSentiment(text: string): { score: number; label: 'positive' | 'neutral' | 'negative' } {
  if (!text) return { score: 0, label: 'neutral' };

  const words = text.toLowerCase().replace(/[^\w\s'-]/g, ' ').split(/\s+/);
  let score = 0;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const prevWord = i > 0 ? words[i - 1] : '';
    const isNegated = NEGATORS.has(prevWord);
    const isIntensified = INTENSIFIERS.has(prevWord);
    const multiplier = isIntensified ? 1.5 : 1;

    if (NEGATIVE_WORDS.has(word)) {
      score += isNegated ? 1 * multiplier : -1 * multiplier;
    } else if (POSITIVE_WORDS.has(word)) {
      score += isNegated ? -1 * multiplier : 1 * multiplier;
    }

    if (i < words.length - 1) {
      const phrase = `${word} ${words[i + 1]}`;
      if (NEGATIVE_WORDS.has(phrase)) {
        score += isNegated ? 1.5 : -1.5;
      } else if (POSITIVE_WORDS.has(phrase)) {
        score += isNegated ? -1.5 : 1.5;
      }
    }
  }

  const normalizedScore = words.length > 0 ? score / Math.sqrt(words.length) : 0;

  let label: 'positive' | 'neutral' | 'negative';
  if (normalizedScore <= -0.15) label = 'negative';
  else if (normalizedScore >= 0.15) label = 'positive';
  else label = 'neutral';

  return {
    score: Math.round(normalizedScore * 100) / 100,
    label,
  };
}
