/**
 * Biohacking Discovery (DACH).
 * Hashtag-Scrape -> unique authors -> profile-Enrichment -> filter (20k+, deutsch, biohacking).
 */
import { ApifyClient } from 'apify-client';
import { writeFileSync } from 'node:fs';

const token = process.env.APIFY_TOKEN;
if (!token) { console.error('Missing APIFY_TOKEN'); process.exit(1); }

const client = new ApifyClient({ token });
const ACTOR_ID = 'shu8hvrXbJbY3Eb9W';

// Biohacking-Hashtags: Mix aus international (where DACH creators sit) + DACH-spezifisch
const HASHTAGS = [
    'biohacking',          // Haupt-Hub, international
    'biohacker',           // ditto
    'intervallfasten',     // DACH-spezifisch
    'langlebigkeit',       // DACH-spezifisch
    'leistungsoptimierung', // DACH-spezifisch
    'darmgesundheit',      // DACH, sehr populär
];
const POSTS_PER_HASHTAG = 100;
const MIN_FOLLOWERS = 20_000;
const MAX_FOLLOWERS = 1_000_000;

// --- STUFE 1: Discovery ---
console.log(`[1/3] Hashtag-Scrape: ${HASHTAGS.join(', ')}`);
const hashtagUrls = HASHTAGS.map((h) => `https://www.instagram.com/explore/tags/${h}/`);
const discoveryRun = await client.actor(ACTOR_ID).call({
    resultsType: 'posts',
    directUrls: hashtagUrls,
    resultsLimit: POSTS_PER_HASHTAG,
    addParentData: false,
});
const { items: posts } = await client.dataset(discoveryRun.defaultDatasetId).listItems();
console.log(`  -> ${posts.length} posts`);

const authorMap = new Map();
for (const p of posts) {
    const u = p.ownerUsername || p.owner?.username;
    if (!u) continue;
    const entry = authorMap.get(u) || { username: u, postsSeen: 0 };
    entry.postsSeen += 1;
    authorMap.set(u, entry);
}
console.log(`  -> ${authorMap.size} unique authors`);

const topAuthors = [...authorMap.values()]
    .sort((a, b) => b.postsSeen - a.postsSeen)
    .slice(0, 200);

// --- STUFE 2: Enrichment ---
console.log(`[2/3] Enriching ${topAuthors.length} profiles ...`);
const profileUrls = topAuthors.map((a) => `https://www.instagram.com/${a.username}/`);
const enrichRun = await client.actor(ACTOR_ID).call({
    resultsType: 'details',
    directUrls: profileUrls,
    resultsLimit: 1,
    addParentData: false,
});
const { items: profiles } = await client.dataset(enrichRun.defaultDatasetId).listItems();
console.log(`  -> ${profiles.length} profile details`);

// --- STUFE 3: Filter & Score ---
const GERMAN_LOC = [
    'deutschland', 'österreich', 'schweiz', 'germany', 'austria', 'switzerland',
    'berlin', 'münchen', 'wien', 'zürich', 'hamburg', 'köln', 'frankfurt',
    'düsseldorf', 'stuttgart', 'graz', 'salzburg', 'basel', 'bern',
    'dubai', 'mallorca', '🇩🇪', '🇦🇹', '🇨🇭',
];
const GERMAN_WORDS = [
    ' für ', ' und ', ' die ', ' der ', ' das ', ' ich ', ' du ', ' mit ',
    ' dein ', ' deine ', ' mehr ', ' nicht ', ' aber ', ' oder ', ' wenn ',
    'gesundheit', 'energie', 'körper', 'leistung', 'gehirn', 'schlaf',
    'ernährung', 'training', 'leben', 'verbessern', 'optimieren',
];
const BIOHACK_KEYWORDS = [
    'biohack', 'longevity', 'langlebigkeit', 'leistungsoptimierung',
    'gesundheit', 'health', 'energie', 'energy', 'performance',
    'schlaf', 'sleep', 'ernährung', 'nutrition', 'fasten', 'fasting',
    'darm', 'gut health', 'mitochondri', 'hormone', 'vagus', 'breathwork',
    'kälte', 'cold exposure', 'eisbaden', 'sauna', 'oxygen', 'red light',
    'nervensystem', 'nervous system', 'recovery', 'regeneration',
    'supplement', 'nootropic', 'anti-aging', 'antiaging',
];

const lower = (s = '') => (s || '').toLowerCase();
const isGerman = (bio) => {
    const b = lower(bio);
    const locHits = GERMAN_LOC.filter((m) => b.includes(m)).length;
    const wordHits = GERMAN_WORDS.filter((m) => b.includes(m)).length;
    const hasDiacritics = /[äöüß]/i.test(bio);
    return locHits > 0 || wordHits >= 2 || hasDiacritics;
};
const hasBiohackingSignal = (bio) => {
    const b = lower(bio);
    return BIOHACK_KEYWORDS.filter((m) => b.includes(m)).length >= 1;
};

const scored = [];
for (const p of profiles) {
    const followers = p.followersCount || 0;
    const bio = p.biography || '';
    if (followers < MIN_FOLLOWERS) continue;       // Hard filter: 20k+
    if (followers > MAX_FOLLOWERS) continue;
    if (!isGerman(bio)) continue;                  // Hard filter: DACH
    if (!hasBiohackingSignal(bio)) continue;       // Hard filter: tatsächlich Biohacking

    const latest = (p.latestPosts || []).slice(0, 12);
    const avgLikes = latest.length ? latest.reduce((s, x) => s + (x.likesCount || 0), 0) / latest.length : 0;
    const avgComments = latest.length ? latest.reduce((s, x) => s + (x.commentsCount || 0), 0) / latest.length : 0;
    const er = followers > 0 ? (avgLikes + avgComments) / followers : 0;

    const bioKeywordMatches = BIOHACK_KEYWORDS.filter((m) => lower(bio).includes(m));
    const dachLocMatches = GERMAN_LOC.filter((m) => lower(bio).includes(m));
    const externalUrl = p.externalUrl || '';
    const fullBlob = lower(bio);

    // Funnel signal
    const hasFunnelRedFlag = /mastermind|akademie|academy|inner circle|high ticket/.test(fullBlob);
    const hasLeadMagnet = /(freebie|gratis|kostenlos|guide|cheat sheet)/.test(fullBlob);

    // Score
    let score = 0;
    if (followers >= 20_000 && followers <= 100_000) score += 25;     // Sweet-Spot
    else if (followers <= 250_000) score += 18;
    else if (followers <= 500_000) score += 10;
    else score += 5;
    if (er >= 0.05) score += 30;
    else if (er >= 0.03) score += 22;
    else if (er >= 0.015) score += 12;
    else if (er >= 0.005) score += 5;
    score += Math.min(bioKeywordMatches.length * 4, 20);
    if (dachLocMatches.length > 0) score += 5;
    if (externalUrl) score += 5;
    if (hasLeadMagnet) score += 5;
    if (hasFunnelRedFlag) score -= 15;

    scored.push({
        username: p.username,
        full_name: p.fullName || '',
        profile_url: `https://www.instagram.com/${p.username}/`,
        followers,
        posts_count: p.postsCount || 0,
        verified: !!p.verified,
        external_url: externalUrl,
        bio: (bio || '').replace(/\n/g, ' ').slice(0, 250),
        avg_likes: Math.round(avgLikes),
        avg_comments: Math.round(avgComments),
        engagement_rate_pct: +(er * 100).toFixed(2),
        biohacking_keywords: bioKeywordMatches.slice(0, 6).join('|'),
        dach_signals: dachLocMatches.join('|'),
        has_lead_magnet: hasLeadMagnet,
        has_funnel_red_flag: hasFunnelRedFlag,
        score,
    });
}

scored.sort((a, b) => b.score - a.score);

writeFileSync('biohacking.json', JSON.stringify(scored, null, 2));
const headers = scored[0] ? Object.keys(scored[0]) : [];
const csvEscape = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
};
writeFileSync('biohacking.csv', [
    headers.join(','),
    ...scored.map((r) => headers.map((h) => csvEscape(r[h])).join(',')),
].join('\n'));

console.log(`\n[3/3] ${scored.length} Kandidaten >=20k Followers, DACH, Biohacking`);
console.log(`Top 15 by score:`);
scored.slice(0, 15).forEach((s, i) => {
    console.log(`  ${(i + 1).toString().padStart(2)}. @${s.username.padEnd(28)} ${s.followers.toString().padStart(7)} foll | ER ${s.engagement_rate_pct.toFixed(2)}% | score ${s.score} | ${s.full_name}`);
});
console.log(`\nFiles: biohacking.csv, biohacking.json`);
