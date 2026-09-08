const PROMPTS = [
  "Tell me about a memorable trip you've taken.",
  'Describe your ideal weekend.',
  'Tell me about someone who has influenced you.',
  "What's a hobby or activity you enjoy, and why?",
  'Describe a place that feels special to you.',
  'Tell me about a recent meal or gathering with people you care about.',
  "What's something you're looking forward to?",
  'Describe your morning routine.',
  "Tell me about a TV show, movie, or book you've enjoyed recently.",
  'What is on your to do list for this week?',
];

export function pickPrompt(): string {
  return PROMPTS[Math.floor(Math.random() * PROMPTS.length)];
}
