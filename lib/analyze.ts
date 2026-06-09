export interface Scores {
  vocabulary: number
  grammar: number | null      // null = grammar check not run yet
  fluency: number
  pronunciation: number | null // null = no segment confidence data
  confidence: number | null
}

export interface GrammarMatchInput {
  offset: number
  length: number
  message: string
  replacements: { value: string }[]
}

export interface AnalysisResult {
  scores: Scores
  wpm: number | null
  fluencyFeedback: string
  fillerWords: Array<{ word: string; count: number }>
  topRepeatedWords: Array<{ word: string; count: number }>
  pronunciationTips: Array<{ word: string; phonetic: string; tip: string }>
  improvements: string[]
}

type PronunciationEntry = { phonetic: string; tip: string }

const PRONUNCIATION_DICT: Record<string, PronunciationEntry> = {
  // Silent letters
  clothes:      { phonetic: 'KLOHZ',           tip: 'Only 1 syllable — "th" is silent. Rhymes with "goes". Not "KLOTHS".' },
  island:       { phonetic: 'EYE-land',         tip: 'The "s" is completely silent. Not "IZ-land".' },
  subtle:       { phonetic: 'SUT-ul',           tip: 'The "b" is silent. Not "SUB-tul".' },
  knee:         { phonetic: 'NEE',              tip: 'The "k" is silent. Rhymes with "see".' },
  know:         { phonetic: 'NOH',              tip: 'The "k" is silent. Identical to "no".' },
  wrap:         { phonetic: 'RAP',              tip: 'The "w" is silent. Rhymes with "cap".' },
  listen:       { phonetic: 'LIS-en',           tip: 'The "t" is completely silent. Not "lis-TEN".' },
  often:        { phonetic: 'OF-en',            tip: 'Traditionally the "t" is silent. "OF-ten" is now accepted but sounds formal.' },
  castle:       { phonetic: 'KAS-ul',           tip: 'The "t" is silent. Not "KAS-tul".' },
  // Reduced syllables
  comfortable:  { phonetic: 'KUMF-ter-bul',     tip: '3 syllables, not 4. "com-FOR-ta-ble" sounds unnatural — merge the middle.' },
  interesting:  { phonetic: 'IN-trest-ing',     tip: '3 syllables in natural speech. "in-TER-est-ing" (4) sounds stiff.' },
  different:    { phonetic: 'DIF-rent',         tip: '2 syllables in spoken English. "DIF-er-ent" sounds overly careful.' },
  probably:     { phonetic: 'PROB-uh-blee',     tip: 'In fast speech: "PROB-lee" (2 syllables). Both are fine.' },
  vegetable:    { phonetic: 'VEJ-tuh-bul',      tip: '3 syllables — the middle "e" disappears. Not "VEJ-uh-tuh-bul".' },
  temperature:  { phonetic: 'TEM-pra-cher',     tip: '3 syllables in natural speech. "TEM-per-a-ture" (4) sounds stilted.' },
  library:      { phonetic: 'LY-brehr-ee',      tip: 'Both "r"s must be said. "LI-berry" is a very common mistake.' },
  february:     { phonetic: 'FEB-roo-ehr-ee',   tip: 'Both Rs should be clear. In fast speech the first is often dropped — acceptable.' },
  // TH sounds
  think:        { phonetic: 'θɪŋk',             tip: 'Unvoiced "th" — tongue lightly between teeth, push air without buzzing. Don\'t say "tink" or "dink".' },
  three:        { phonetic: 'θriː',             tip: '"th" + "r" together is hard. Practise each separately, then combine. Don\'t say "tree".' },
  through:      { phonetic: 'θruː',             tip: '1 syllable — rhymes with "blue". Not "th-roo-gh" (2 syllables).' },
  though:       { phonetic: 'ðoh',              tip: 'Voiced "th" (vocal cords vibrate). "gh" is silent. Rhymes with "go".' },
  thought:      { phonetic: 'θɔːt',             tip: 'Unvoiced "th". "gh" is silent. Rhymes with "fought".' },
  throughout:   { phonetic: 'θruː-AWT',         tip: '2 syllables. Unvoiced "th". Second part rhymes with "out".' },
  although:     { phonetic: 'ol-THOH',          tip: 'Voiced "th" (vibrates). "gh" is silent.' },
  // GH = F words
  enough:       { phonetic: 'ih-NUF',           tip: '"gh" sounds like "f". Stress on 2nd syllable. Not "ee-NOFF".' },
  rough:        { phonetic: 'RUF',              tip: '"gh" sounds like "f". Rhymes with "stuff".' },
  tough:        { phonetic: 'TUF',              tip: '"gh" sounds like "f". Rhymes with "stuff".' },
  // The ɜː vowel (world/girl/work)
  world:        { phonetic: 'WURLD',            tip: '"or" sounds like "ur". One of the hardest English words. Not "wort" or "wold".' },
  girl:         { phonetic: 'GURL',             tip: '"ir" sounds like "ur". Not "geel" or "grill".' },
  work:         { phonetic: 'WURK',             tip: '"or" sounds like "ur". Rhymes with "murk".' },
  word:         { phonetic: 'WURD',             tip: '"or" sounds like "ur". Rhymes with "heard".' },
  // Word-stress traps
  application:  { phonetic: 'ap-lih-KAY-shun',  tip: 'Stress on the 3rd syllable "KAY". 4 syllables total.' },
  technology:   { phonetic: 'tek-NOL-uh-jee',   tip: 'Stress on 2nd syllable. Not "TECH-nol-ogy".' },
  experience:   { phonetic: 'ik-SPEER-ee-ens',  tip: 'Stress on 2nd syllable. 4 syllables. Not "EX-peri-ence".' },
  pronunciation:{ phonetic: 'pruh-NUN-see-AY-shun', tip: '"NUN" (not "NOUN") in the middle. 5 syllables. Stress on "AY".' },
  specific:     { phonetic: 'spuh-SIF-ik',      tip: 'Stress on 2nd syllable. Not "SPE-cif-ic".' },
  important:    { phonetic: 'im-POR-tunt',      tip: 'Stress on 2nd syllable. Final "t" often disappears in fast speech.' },
  develop:      { phonetic: 'dih-VEL-up',       tip: 'Stress on 2nd syllable. Ends in "-up", not "-op".' },
  especially:   { phonetic: 'ih-SPESH-uh-lee',  tip: 'Starts with "ih-" not "ex-". Very common mistake. 4 syllables.' },
  environment:  { phonetic: 'en-VY-ern-ment',   tip: 'Stress on 2nd syllable. The middle "on" is usually swallowed.' },
  // Tricky individual words
  recipe:       { phonetic: 'RES-uh-pee',       tip: 'The final "e" IS pronounced (unlike most English words). 3 syllables.' },
  colleague:    { phonetic: 'KOL-eeg',          tip: 'Only 2 syllables. "gue" = silent g + long "ee".' },
  vehicle:      { phonetic: 'VEE-uh-kul',       tip: '3 syllables. The "h" is often silent in American English.' },
  wednesday:    { phonetic: 'WENZ-dee',         tip: 'The "d" in "Wednes" is silent. "WED-nes-day" sounds unnatural.' },
  breakfast:    { phonetic: 'BREK-fust',        tip: '"ea" sounds like "e" in "bed". Second syllable is reduced to "fust".' },
  suite:        { phonetic: 'SWEET',            tip: 'Rhymes with "sweet", NOT "suit" (SOOT). Completely different words.' },
  question:     { phonetic: 'KWES-chun',        tip: '"tion" sounds like "chun", not "tee-on". Not "KWES-tee-on".' },
  the:          { phonetic: 'ðə / ðiː',         tip: '"thuh" before consonants ("the book"), "thee" before vowels ("the apple"). Never "da" or "ze".' },
}

const CONNECTORS = [
  'however', 'therefore', 'furthermore', 'because', 'although', 'whereas',
  'consequently', 'in addition', 'for example', 'for instance', 'in contrast',
  'despite', 'since', 'while', 'moreover', 'nevertheless', 'on the other hand',
  'in fact', 'as a result', 'in conclusion', 'which means', 'in other words',
]

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does',
  'did', 'will', 'would', 'could', 'should', 'may', 'might', 'shall', 'can', 'must',
  'this', 'that', 'these', 'those', 'it', 'its', 'they', 'them', 'their', 'there',
  'i', 'me', 'my', 'mine', 'myself', 'we', 'our', 'ours', 'you', 'your', 'yours',
  'he', 'she', 'him', 'her', 'his', 'hers', 'who', 'which', 'what', 'how', 'when',
  'where', 'why', 'not', 'no', 'so', 'if', 'as', 'by', 'from', 'up', 'about', 'into',
  'through', 'then', 'than', 'too', 'also', 'very', 'really', 'quite', 'just', 'even',
  'still', 'get', 'got', 'go', 'going', 'come', 'make', 'made', 'know', 'think',
  'say', 'said', 'like', 'want', 'need', 'see', 'look', 'use', 'take', 'keep', 'put',
  'time', 'way', 'more', 'some', 'all', 'one', 'two', 'any', 'only', 'new',
  'well', 'right', 'okay', 'ok', 'yeah', 'yes', 'now', 'here', 'there', 'back',
])

const FILLER_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\byou know\b/g,  label: 'you know' },
  { pattern: /\bi mean\b/g,    label: 'i mean' },
  { pattern: /\bkind of\b/g,   label: 'kind of' },
  { pattern: /\bsort of\b/g,   label: 'sort of' },
  { pattern: /\byou see\b/g,   label: 'you see' },
  { pattern: /\bbasically\b/g, label: 'basically' },
  { pattern: /\bliterally\b/g, label: 'literally' },
  { pattern: /\bactually\b/g,  label: 'actually' },
  { pattern: /\bright\b/g,     label: 'right' },
  { pattern: /\blike\b/g,      label: 'like' },
  { pattern: /\bjust\b/g,      label: 'just' },
  { pattern: /\bwell\b/g,      label: 'well' },
  { pattern: /\bokay\b/g,      label: 'okay' },
]

export function analyzeTranscript(
  text: string,
  elapsedSeconds: number,
  opts: {
    segments?: Array<{ confidence: number }>
    grammarMatches?: GrammarMatchInput[]
  } = {}
): AnalysisResult {
  const { segments = [], grammarMatches } = opts

  const rawWords = text.trim().split(/\s+/).filter(Boolean)
  const wordCount = rawWords.length

  const wpm = elapsedSeconds >= 10
    ? Math.round((wordCount / elapsedSeconds) * 60)
    : null

  // Sentence analysis
  const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.split(/\s+/).length >= 2)
  const sentenceCount = Math.max(1, sentences.length)
  const avgWords = wordCount / sentenceCount

  const lowerWords = rawWords.map(w => w.toLowerCase().replace(/[^a-z']/g, ''))
  const contentWords = lowerWords.filter(w => w.length > 3)
  const uniqueContent = new Set(contentWords)
  const vocabRatio = contentWords.length > 0 ? uniqueContent.size / contentWords.length : 0
  const lowerText = text.toLowerCase()
  const usedConnectors = CONNECTORS.filter(c => lowerText.includes(c))

  const avgConfidence = segments.length > 0
    ? segments.reduce((sum, s) => sum + s.confidence, 0) / segments.length
    : null

  // ── SCORES ────────────────────────────────────────────────────────

  // Vocabulary: word variety + word sophistication — connectors excluded (they belong to Fluency)
  // avgMeaningfulLen = average length of non-stopword content words; proxy for lexical complexity
  const meaningfulWords = lowerWords.filter(w => {
    const clean = w.replace(/[^a-z]/g, '')
    return clean.length > 3 && !STOPWORDS.has(clean)
  })
  const avgMeaningfulLen = meaningfulWords.length > 0
    ? meaningfulWords.reduce((s, w) => s + w.length, 0) / meaningfulWords.length
    : 0
  let vocabScore = 2
  if (vocabRatio >= 0.80) vocabScore += 4
  else if (vocabRatio >= 0.65) vocabScore += 3
  else if (vocabRatio >= 0.50) vocabScore += 2
  else if (vocabRatio >= 0.35) vocabScore += 1
  if (avgMeaningfulLen >= 8.0) vocabScore += 4
  else if (avgMeaningfulLen >= 6.5) vocabScore += 3
  else if (avgMeaningfulLen >= 5.0) vocabScore += 2
  else if (avgMeaningfulLen >= 4.0) vocabScore += 1
  const vocabularyScore = Math.round(Math.min(10, Math.max(2, vocabScore)))

  // Grammar: from LanguageTool matches (null when not run yet)
  const grammarScore: number | null = grammarMatches !== undefined
    ? Math.round(Math.max(2, Math.min(10, 10 - (grammarMatches.length / wordCount) * 100 * 1.5)))
    : null

  // Fluency: pace + sentence structure + connectors (connectors are exclusive to this score)
  let fluencyScore = 2
  if (wpm !== null) {
    if (wpm >= 110 && wpm <= 180) fluencyScore += 3
    else if (wpm >= 80 && wpm <= 200) fluencyScore += 2
    else if (wpm >= 60) fluencyScore += 1
  } else {
    fluencyScore += 1
  }
  if (avgWords >= 8 && avgWords <= 22) fluencyScore += 2
  else if (avgWords >= 6 && avgWords <= 28) fluencyScore += 1
  if (usedConnectors.length >= 3) fluencyScore += 2
  else if (usedConnectors.length >= 1) fluencyScore += 1
  fluencyScore = Math.round(Math.min(9, Math.max(2, fluencyScore)))

  // Pronunciation: average quality — how clearly each word was spoken (avgConfidence)
  const pronunciationScore: number | null = avgConfidence !== null
    ? Math.round(Math.max(2, Math.min(9, (avgConfidence - 0.6) / 0.4 * 6 + 3)))
    : null

  // Confidence: DISTINCT from Pronunciation
  //   Pronunciation = AVERAGE quality across all segments
  //   Confidence    = CONSISTENCY (% of high-quality segments) + assertive pace + sustained speech
  // Example: 90% clear, 10% very mumbled → high Pronunciation, lower Confidence
  let confidenceScore: number | null = null
  if (segments.length > 0) {
    const highConfCount = segments.filter(s => s.confidence >= 0.8).length
    const consistencyRatio = highConfCount / segments.length
    let c = 2
    if (consistencyRatio >= 0.85) c += 3
    else if (consistencyRatio >= 0.65) c += 2
    else if (consistencyRatio >= 0.45) c += 1
    if (wpm !== null && wpm >= 100 && wpm <= 185) c += 2
    else if (wpm !== null && wpm >= 70) c += 1
    if (avgWords >= 9) c += 2
    else if (avgWords >= 6) c += 1
    if (wordCount >= 80) c += 1
    confidenceScore = Math.round(Math.min(9, Math.max(2, c)))
  }

  // ── FLUENCY FEEDBACK ──────────────────────────────────────────────
  const parts: string[] = []
  if (wpm !== null) {
    if (wpm < 90) parts.push(`Your pace is slow (${wpm} wpm) — native speakers typically speak at 130–170 wpm.`)
    else if (wpm > 200) parts.push(`You are speaking fast (${wpm} wpm). A slightly slower pace will improve clarity.`)
    else parts.push(`Your speaking pace (${wpm} wpm) is in a natural, native-speaker range.`)
  }
  if (avgWords < 6) parts.push('Your sentences are short — try connecting ideas into longer, more flowing phrases.')
  else if (avgWords > 25) parts.push('Your sentences are very long. Breaking them up will improve clarity.')
  else parts.push('Your sentence length sounds natural.')
  if (vocabRatio < 0.4 && wordCount > 30) parts.push('You repeat several words often — a wider vocabulary range will make your speech richer.')
  const fluencyFeedback = parts.slice(0, 2).join(' ')

  // ── FILLER WORDS ──────────────────────────────────────────────────
  const fillerWords = FILLER_PATTERNS
    .map(({ pattern, label }) => ({
      word: label,
      count: (lowerText.match(pattern) ?? []).length,
    }))
    .filter(f => f.count > 0)
    .sort((a, b) => b.count - a.count)

  // ── TOP REPEATED WORDS ────────────────────────────────────────────
  const wordCounts = new Map<string, number>()
  for (const w of lowerWords) {
    const clean = w.replace(/[^a-z]/g, '')
    if (clean.length > 2 && !STOPWORDS.has(clean)) {
      wordCounts.set(clean, (wordCounts.get(clean) ?? 0) + 1)
    }
  }
  const topRepeatedWords = Array.from(wordCounts.entries())
    .filter(([, count]) => count > 1)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([word, count]) => ({ word, count }))

  // ── PRONUNCIATION TIPS ────────────────────────────────────────────
  const seen = new Set<string>()
  const pronunciationTips: AnalysisResult['pronunciationTips'] = []
  for (const w of lowerWords) {
    const clean = w.replace(/[^a-z]/g, '')
    if (clean && !seen.has(clean) && PRONUNCIATION_DICT[clean]) {
      seen.add(clean)
      pronunciationTips.push({ word: clean, ...PRONUNCIATION_DICT[clean] })
      if (pronunciationTips.length >= 4) break
    }
  }

  // ── IMPROVEMENTS ──────────────────────────────────────────────────
  const improvements: string[] = []
  if (wpm !== null && wpm < 100) {
    improvements.push('Practice reading aloud and time yourself. Build up to 130 wpm — your brain will naturally produce faster, more fluid speech.')
  }
  if (usedConnectors.length === 0) {
    improvements.push('Link ideas with discourse markers: "however", "because of this", "which means that", "for example". They make speech sound organised and native-like.')
  }
  if (vocabRatio < 0.45 && wordCount > 30) {
    improvements.push('You repeat the same words often. Before recording, brainstorm 2 synonyms for the words you use most.')
  }
  if (avgWords < 6) {
    improvements.push('Practice speaking in longer connected sentences. Instead of "It was good. I liked it." try "I really liked it because it felt natural and easy to follow."')
  }
  if (improvements.length < 3) {
    improvements.push('Shadow native speakers: find a 30-second clip, listen once, then speak along matching their exact rhythm, stress, and intonation. Repeat 5 times.')
  }
  if (improvements.length < 3) {
    improvements.push('In natural English, words link and reduce: "want to" → "wanna", "have to" → "hafta". Practise these reductions consciously.')
  }
  if (improvements.length < 3) {
    improvements.push('Record yourself for 2 minutes daily and listen back critically. Conscious self-correction is the fastest path to real improvement.')
  }

  return {
    scores: { vocabulary: vocabularyScore, grammar: grammarScore, fluency: fluencyScore, pronunciation: pronunciationScore, confidence: confidenceScore },
    wpm,
    fluencyFeedback,
    fillerWords,
    topRepeatedWords,
    pronunciationTips,
    improvements: improvements.slice(0, 3),
  }
}
