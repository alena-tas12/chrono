const ev = require('../main/emotionVocabulary');

const tests = [
  { name: 'Basic anger', input: "I'm angry" },
  { name: 'Grief + gratitude combo', input: "I feel grief but also grateful" },
  { name: 'Intensity (furious)', input: "I'm absolutely furious and enraged" },
  { name: 'Bittersweet nuanced', input: "it's bittersweet, full of nostalgia" },
  { name: 'happy + nervous', input: "I'm really happy but nervous" },
  { name: 'Love + fear', input: "I feel love and fear at the same time" },
  { name: 'No emotion', input: "Let me check the calendar" },
  { name: 'Multi-word phrase', input: "I'm experiencing emotional exhaustion" },
  { name: 'Excitement + anxiety', input: "so excited but anxious about it" },
  { name: 'Intensity amplifier', input: "I'm a bit sad today" },
];

let passed = 0;
let failed = 0;

for (const t of tests) {
  try {
    const result = ev.detect(t.input);
    const summary = ev.summarize(t.input);
    console.log(`\n[${t.name}]`);
    console.log('  Input:', t.input);
    console.log('  Labels:', result.labels.join(', ') || '(none)');
    console.log('  Intensity:', result.intensity || 'null');
    console.log('  Combinations:', result.combinations.map(c => c.join(' + ')).join(' | ') || '(none)');
    console.log('  Summary:', summary || 'null');
    console.log('  hasEmotion:', result.hasEmotion);
    passed++;
  } catch (err) {
    console.error(`FAILED [${t.name}]:`, err.message);
    failed++;
  }
}

const vocab = ev.getVocabulary();
console.log('\n=== VOCABULARY STATS ===');
console.log('Total labels:', vocab.totalLabels);
console.log('Core:', vocab.core.length);
console.log('Positive:', vocab.positive.length);
console.log('Negative:', vocab.negative.length);
console.log('Social:', vocab.social.length);
console.log('Nuanced:', vocab.nuanced.length);
console.log('Intensity dimensions:', Object.keys(vocab.intensityScale).length);
console.log('Known combinations:', vocab.knownCombinations.length);

console.log('\n=== RESULTS ===');
console.log(`Passed: ${passed} / ${passed + failed}`);
