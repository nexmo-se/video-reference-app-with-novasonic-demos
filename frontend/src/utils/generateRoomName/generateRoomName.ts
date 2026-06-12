const meetingTopics = [
  'advice',
  'account-review',
  'budget-planning',
  'cashflow-check',
  'credit-guidance',
  'debt-strategy',
  'deposit-review',
  'estate-planning',
  'expense-review',
  'financial-checkup',
  'financial-plan',
  'goal-planning',
  'insurance-review',
  'investment-plan',
  'loan-options',
  'mortgage-review',
  'portfolio-review',
  'rate-review',
  'refinance-options',
  'retirement-plan',
  'risk-review',
  'savings-plan',
  'tax-planning',
  'wealth-planning',
];

const adjectives: Array<string> = [
  'assured',
  'balanced',
  'confident',
  'dependable',
  'focused',
  'future-ready',
  'guided',
  'informed',
  'insightful',
  'prudent',
  'secure',
  'steady',
  'strategic',
  'supported',
  'trusted',
  'wise',
];

const pickRandom = (arr: Array<string>) => arr[Math.floor(Math.random() * arr.length)];

/**
 * Generates a random room name with the schema `adjective`-`meeting-topic`.
 * @returns {string} - A randomized room name
 */
export default (): string => `${pickRandom(adjectives)}-${pickRandom(meetingTopics)}`;
