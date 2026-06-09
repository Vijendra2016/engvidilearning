export interface AnalysisResult {
  fluencyScore: number
  wpm: number | null
  fluencyFeedback: string
  pronunciationTips: Array<{ word: string; phonetic: string; tip: string }>
  improvements: string[]
}

type PronunciationEntry = { phonetic: string; tip: string }

const PRONUNCIATION_DICT: Record<string, PronunciationEntry> = {
  // Silent letters
  clothes:     { phonetic: 'KLOHZ',         tip: 'Only 1 syllable — the "th" is silent. Rhymes with "goes". Not "KLOTHS".' },
  island:      { phonetic: 'EYE-land',       tip: 'The "s" is completely silent. Not "IZ-land".' },
  subtle:      { phonetic: 'SUT-ul',         tip: 'The "b" is silent. Not "SUB-tul".' },
  knee:        { phonetic: 'NEE',            tip: 'The "k" is silent. Rhymes with "see".' },
  know:        { phonetic: 'NOH',            tip: 'The "k" is silent. Identical to "no".' },
  wrap:        { phonetic: 'RAP',            tip: 'The "w" is silent. Rhymes with "cap".' },
  listen:      { phonetic: 'LIS-en',         tip: 'The "t" is completely silent. Not "lis-TEN".' },
  often:       { phonetic: 'OF-en',          tip: 'Traditionally the "t" is silent. "OF-ten" is now accepted but sounds formal.' },
  castle:      { phonetic: 'KAS-ul',         tip: 'The "t" is silent. Not "KAS-tul".' },
  // Reduced syllables
  comfortable: { phonetic: 'KUMF-ter-bul',   tip: '3 syllables, not 4. "com-FOR-ta-ble" sounds unnatural — merge the middle.' },
  interesting: { phonetic: 'IN-trest-ing',   tip: '3 syllables in natural speech. "in-TER-est-ing" (4) sounds stiff.' },
  different:   { phonetic: 'DIF-rent',       tip: '2 syllables in spoken English. "DIF-er-ent" sounds overly careful.' },
  probably:    { phonetic: 'PROB-uh-blee',   tip: 'In fast speech: "PROB-lee" (2 syllables). Both are fine.' },
  vegetable:   { phonetic: 'VEJ-tuh-bul',    tip: '3 syllables — the middle "e" disappears. Not "VEJ-uh-tuh-bul".' },
  temperature: { phonetic: 'TEM-pra-cher',   tip: '3 syllables in natural speech. "TEM-per-a-ture" (4) sounds stilted.' },
  library:     { phonetic: 'LY-brehr-ee',    tip: 'Both "r"s must be said. "LI-berry" is a very common mistake.' },
  february:    { phonetic: 'FEB-roo-ehr-ee', tip: 'Both Rs should be clear. In fast speech the first is often dropped — acceptable.' },
  // TH sounds (very common non-native issue)
  think:       { phonetic: 'θɪŋk',           tip: 'Unvoiced "th" — tongue tip lightly between teeth, push air without buzzing. Don\'t substitute "t" or "d".' },
  three:       { phonetic: 'θriː',           tip: '"th" + "r" together is very hard. Practise each separately, then combine. Don\'t say "tree".' },
  through:     { phonetic: 'θruː',           tip: '1 syllable — rhymes with "blue". Not "th-roo-gh" (2 syllables).' },
  though:      { phonetic: 'ðoh',            tip: 'Voiced "th" (vocal cords vibrate). "gh" is silent. Rhymes with "go".' },
  thought:     { phonetic: 'θɔːt',           tip: 'Unvoiced "th". "gh" is silent. Rhymes with "fought".' },
  throughout:  { phonetic: 'θruː-AWT',       tip: '2 syllables. Unvoiced "th". Second part rhymes with "out".' },
  although:    { phonetic: 'ol-THOH',        tip: 'Voiced "th" (vibrates). "gh" is silent.' },
  // GH = F words
  enough:      { phonetic: 'ih-NUF',         tip: '"gh" sounds like "f". Stress on 2nd syllable. Not "ee-NOFF".' },
  rough:       { phonetic: 'RUF',            tip: '"gh" sounds like "f". Rhymes with "stuff".' },
  tough:       { phonetic: 'TUF',            tip: '"gh" sounds like "f". Rhymes with "stuff".' },
  // World/girl/work — the tricky ɜː vowel
  world:       { phonetic: 'WURLD',          tip: '"or" sounds like "ur". One of the hardest words for non-native speakers. Not "wort" or "wold".' },
  girl:        { phonetic: 'GURL',           tip: '"ir" sounds like "ur". Not "geel" or "grill".' },
  work:        { phonetic: 'WURK',           tip: '"or" sounds like "ur". Rhymes with "murk".' },
  word:        { phonetic: 'WURD',           tip: '"or" sounds like "ur". Rhymes with "heard".' },
  // Word-stress traps
  application: { phonetic: 'ap-lih-KAY-shun', tip: 'Stress on the 3rd syllable "KAY". 4 syllables total.' },
  technology:  { phonetic: 'tek-NOL-uh-jee', tip: 'Stress on 2nd syllable. Not "TECH-nol-ogy".' },
  experience:  { phonetic: 'ik-SPEER-ee-ens', tip: 'Stress on 2nd syllable. 4 syllables. Not "EX-peri-ence".' },
  pronunciation:{ phonetic: 'pruh-NUN-see-AY-shun', tip: '"NUN" (not "NOUN") in the middle. 5 syllables. Stress on "AY".' },
  specific:    { phonetic: 'spuh-SIF-ik',    tip: 'Stress on 2nd syllable. Not "SPE-cif-ic".' },
  important:   { phonetic: 'im-POR-tunt',    tip: 'Stress on 2nd syllable. Final "t" often disappears in fast speech.' },
  develop:     { phonetic: 'dih-VEL-up',     tip: 'Stress on 2nd syllable. Ends in "-up", not "-op".' },
  especially:  { phonetic: 'ih-SPESH-uh-lee', tip: 'Starts with "ih-" not "ex-". Very common mistake. 4 syllables.' },
  environment: { phonetic: 'en-VY-ern-ment', tip: 'Stress on 2nd syllable. The middle "on" is usually swallowed.' },
  // Tricky individual words
  recipe:      { phonetic: 'RES-uh-pee',     tip: 'The final "e" IS pronounced (unlike most English words). 3 syllables.' },
  colleague:   { phonetic: 'KOL-eeg',        tip: 'Only 2 syllables. "gue" = silent g + long "ee".' },
  vehicle:     { phonetic: 'VEE-uh-kul',     tip: '3 syllables. The "h" is often silent in American English.' },
  wednesday:   { phonetic: 'WENZ-dee',       tip: 'The "d" in "Wednes" is silent. "WED-nes-day" sounds unnatural.' },
  breakfast:   { phonetic: 'BREK-fust',      tip: '"ea" sounds like "e" in "bed". Second syllable is reduced to "fust".' },
  suite:       { phonetic: 'SWEET',          tip: 'Rhymes with "sweet", NOT "suit" (SOOT). Completely different words.' },
  question:    { phonetic: 'KWES-chun',      tip: '"tion" sounds like "chun", not "tee-on". Not "KWES-tee-on".' },
  the:         { phonetic: 'ðə / ðiː',       tip: '"thuh" before consonants ("the book"), "thee" before vowels ("the apple"). Never "da" or "ze".' },
}

const CONNECTORS = [
  'however', 'therefore', 'furthermore', 'because', 'although', 'whereas',
  'consequently', 'in addition', 'for example', 'for instance', 'in contrast',
  'despite', 'since', 'while', 'moreover', 'nevertheless', 'on the other hand',
  'in fact', 'as a result', 'in conclusion', 'which means', 'in other words',
]

export function analyzeTranscript(text: string, elapsedSeconds: number): AnalysisResult {
  const rawWords = text.trim().split(/\s+/).filter(Boolean)
  const wordCount = rawWords.length

  const wpm = elapsedSeconds >= 10
    ? Math.round((wordCount / elapsedSeconds) * 60)
    : null

  // Sentence analysis
  const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.split(/\s+/).length >= 2)
  const sentenceCount = Math.max(1, sentences.length)
  const avgWords = wordCount / sentenceCount

  // Vocabulary variety — content words only (length > 3 to skip "the", "and", etc.)
  const lowerWords = rawWords.map(w => w.toLowerCase().replace(/[^a-z']/g, ''))
  const contentWords = lowerWords.filter(w => w.length > 3)
  const uniqueContent = new Set(contentWords)
  const vocabRatio = contentWords.length > 0 ? uniqueContent.size / contentWords.length : 0

  // Discourse connectors
  const lowerText = text.toLowerCase()
  const usedConnectors = CONNECTORS.filter(c => lowerText.includes(c))

  // Fluency score (2–9)
  let score = 4
  if (wpm !== null) {
    if (wpm >= 100 && wpm <= 185) score += 2
    else if (wpm >= 70 && wpm <= 220) score += 1
  } else {
    score += 1 // benefit of doubt when no timing
  }
  if (avgWords >= 7 && avgWords <= 22) score += 1
  if (vocabRatio >= 0.55) score += 1
  else if (vocabRatio >= 0.4) score += 0.5
  if (usedConnectors.length >= 2) score += 1
  else if (usedConnectors.length === 1) score += 0.5
  score = Math.round(Math.min(9, Math.max(2, score)))

  // Fluency feedback
  const parts: string[] = []
  if (wpm !== null) {
    if (wpm < 90) parts.push(`Your pace is slow (${wpm} wpm) — native speakers typically speak at 130–170 wpm.`)
    else if (wpm > 200) parts.push(`You are speaking fast (${wpm} wpm). A slightly slower pace will improve clarity and naturalness.`)
    else parts.push(`Your speaking pace (${wpm} wpm) is in a natural, native-speaker range.`)
  }
  if (avgWords < 6) parts.push('Your sentences are short — try connecting ideas into longer, more flowing phrases.')
  else if (avgWords > 25) parts.push('Your sentences are very long. Breaking them up will improve clarity.')
  else parts.push('Your sentence length sounds natural.')
  if (vocabRatio < 0.4 && wordCount > 30) {
    parts.push('You repeat several words often — a wider vocabulary range will make your speech richer.')
  }
  const fluencyFeedback = parts.slice(0, 2).join(' ')

  // Pronunciation tips — scan transcript for known-difficult words
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

  // Improvements — rule-based, specific to what we measured
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
    improvements.push('In natural English, words link and reduce: "want to" → "wanna", "have to" → "hafta", "a lot of" → "alotta". Practise these reductions consciously.')
  }
  if (improvements.length < 3) {
    improvements.push('Record yourself for 2 minutes daily and listen back critically. Conscious self-correction is the fastest path to real pronunciation improvement.')
  }

  return {
    fluencyScore: score,
    wpm,
    fluencyFeedback,
    pronunciationTips,
    improvements: improvements.slice(0, 3),
  }
}
