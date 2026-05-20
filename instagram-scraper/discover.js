/**
 * DACH Creator Discovery Pipeline
 *
 * Stufe 1: Hashtag-Discovery -> Liste unique Authors
 * Stufe 2: Profile-Enrichment (Follower, Bio, Verifizierung)
 * Stufe 3: Mechanisches Scoring nach SOP-Kriterien (soweit aus Daten erkennbar)
 *
 * Output: shortlist.json + shortlist.csv
 */
import { ApifyClient } from 'apify-client';
import { writeFileSync } from 'node:fs';

const token = process.env.APIFY_TOKEN;
if (!token) {
    console.error('Missing APIFY_TOKEN. Run: export APIFY_TOKEN="..."');
    process.exit(1);
}

const client = new ApifyClient({ token });
const ACTOR_ID = 'shu8hvrXbJbY3Eb9W'; // apify/instagram-scraper

// --- KONFIGURATION ---
// DACH-spezifische Hashtags für Business / Online-Marketing
const HASHTAGS = ['unternehmer', 'onlinebusiness', 'selbststaendig', 'agentur'];
const POSTS_PER_HASHTAG = 80;        // -> Discovery: 4 * 80 = 320 results (~$0.86)
const MAX_PROFILES_TO_ENRICH = 120;  // -> Profile-Details (~$0.32)
// Gesamtkosten erste Runde: ~$1.20

// Filter-Schwellen
const MIN_FOLLOWERS = 3_000;
const MAX_FOLLOWERS = 250_000;
const MIN_ENGAGEMENT_RATE = 0.015; // 1.5% – konservativ

const GERMAN_MARKERS = [
    'deutschland', 'österreich', 'schweiz', 'germany', 'austria',
    'berlin', 'münchen', 'wien', 'zürich', 'hamburg', 'köln', 'frankfurt',
    '🇩🇪', '🇦🇹', '🇨🇭', 'dach',
];
const GERMAN_WORDS = [
    ' für ', ' und ', ' dein ', ' deine ', ' wir ', ' ich ', ' mehr ',
    'unternehmer', 'gründer', 'selbständig', 'selbstständig',
    'coach', 'mentor', 'berater', 'beratung',
];
const FUNNEL_RED_FLAGS = [
    'masterclass', 'academy', 'akademie', 'mentoring-programm',
    'high-ticket-coaching', 'mastermind',
]; // Hinweise auf bereits existierendes Premium-Produkt (Kriterium 2 = HARD NO)

// --- HELPERS ---
const isLikelyGerman = (bio = '') => {
    const b = bio.toLowerCase();
    if (GERMAN_MARKERS.some((m) => b.includes(m))) return true;
    const germanHits = GERMAN_WORDS.filter((w) => b.includes(w)).length;
    return germanHits >= 2;
};

const hasFunnelRedFlag = (bio = '') => {
    const b = bio.toLowerCase();
    return FUNNEL_RED_FLAGS.some((m) => b.includes(m));
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- STUFE 1: DISCOVERY ---
console.log(`\n[1/3] Discovery via Hashtag-URLs: ${HASHTAGS.join(', ')}`);
const hashtagUrls = HASHTAGS.map((h) => `https://www.instagram.com/explore/tags/${h}/`);
const discoveryInput = {
    resultsType: 'posts',
    directUrls: hashtagUrls,
    resultsLimit: POSTS_PER_HASHTAG,
    addParentData: false,
};
const discoveryRun = await client.actor(ACTOR_ID).call(discoveryInput);
const { items: posts } = await client
    .dataset(discoveryRun.defaultDatasetId)
    .listItems();
console.log(`  -> ${posts.length} posts gefunden`);

// Unique authors aggregieren
const authorMap = new Map();
for (const p of posts) {
    const u = p.ownerUsername || p.owner?.username;
    if (!u) continue;
    const entry = authorMap.get(u) || {
        username: u,
        fullName: p.ownerFullName || p.owner?.full_name || '',
        postsSeen: 0,
        likesSum: 0,
        commentsSum: 0,
        hashtagsHit: new Set(),
    };
    entry.postsSeen += 1;
    entry.likesSum += p.likesCount || 0;
    entry.commentsSum += p.commentsCount || 0;
    if (p.hashtags) p.hashtags.forEach((h) => entry.hashtagsHit.add(h));
    authorMap.set(u, entry);
}
console.log(`  -> ${authorMap.size} unique authors`);

// Top-Kandidaten nach Posts-Volumen (Indikator für Aktivität in der Nische)
const topAuthors = [...authorMap.values()]
    .sort((a, b) => b.postsSeen - a.postsSeen)
    .slice(0, MAX_PROFILES_TO_ENRICH);
console.log(`  -> Enrichment für Top ${topAuthors.length} Profile`);

// --- STUFE 2: PROFILE-ENRICHMENT ---
console.log(`\n[2/3] Profile-Details abrufen ...`);
const profileUrls = topAuthors.map((a) => `https://www.instagram.com/${a.username}/`);
const enrichInput = {
    resultsType: 'details',
    directUrls: profileUrls,
    resultsLimit: 1,
    addParentData: false,
};
const enrichRun = await client.actor(ACTOR_ID).call(enrichInput);
const { items: profiles } = await client
    .dataset(enrichRun.defaultDatasetId)
    .listItems();
console.log(`  -> ${profiles.length} Profile angereichert`);

const profileByUsername = new Map(profiles.map((p) => [p.username, p]));

// --- STUFE 3: SCORING ---
console.log(`\n[3/3] Scoring & Filterung ...`);
const scored = [];
for (const author of topAuthors) {
    const prof = profileByUsername.get(author.username);
    if (!prof) continue;

    const followers = prof.followersCount ?? 0;
    const bio = prof.biography || '';
    const verified = prof.verified || false;
    const isBusiness = prof.isBusinessAccount || false;
    const externalUrl = prof.externalUrl || '';
    const postsCount = prof.postsCount || 0;

    // Engagement-Rate (aus den Hashtag-Posts dieser Author)
    const avgLikes = author.likesSum / Math.max(author.postsSeen, 1);
    const avgComments = author.commentsSum / Math.max(author.postsSeen, 1);
    const engagementRate = followers > 0 ? (avgLikes + avgComments) / followers : 0;

    // Hard filters
    const reasons = [];
    if (followers < MIN_FOLLOWERS) reasons.push(`followers<${MIN_FOLLOWERS}`);
    if (followers > MAX_FOLLOWERS) reasons.push(`followers>${MAX_FOLLOWERS} (zu groß, vermutlich schon monetarisiert)`);
    if (!isLikelyGerman(bio)) reasons.push('bio nicht erkennbar deutsch');
    if (engagementRate < MIN_ENGAGEMENT_RATE && followers > 5000) reasons.push(`ER<${(MIN_ENGAGEMENT_RATE * 100).toFixed(1)}%`);
    if (hasFunnelRedFlag(bio)) reasons.push('Funnel-Red-Flag in Bio (vermutlich Krit. 2 verletzt)');

    const status = reasons.length === 0 ? 'GREEN' : reasons.length <= 1 ? 'YELLOW' : 'RED';

    // Score (0-100), nur mechanisch
    let score = 0;
    if (followers >= 5_000 && followers <= 100_000) score += 25; // Sweet-Spot
    else if (followers > 100_000 && followers <= 250_000) score += 15;
    else if (followers >= 3_000) score += 10;
    if (engagementRate >= 0.05) score += 30;
    else if (engagementRate >= 0.03) score += 20;
    else if (engagementRate >= MIN_ENGAGEMENT_RATE) score += 10;
    if (isLikelyGerman(bio)) score += 15;
    if (externalUrl) score += 10; // hat überhaupt einen Link -> baut Funnel auf
    if (postsCount >= 50) score += 10; // konsistent aktiv
    if (!hasFunnelRedFlag(bio)) score += 10; // Lücke vorhanden

    scored.push({
        username: author.username,
        fullName: prof.fullName || author.fullName,
        url: `https://www.instagram.com/${author.username}/`,
        followers,
        postsCount,
        verified,
        isBusiness,
        bio: bio.replace(/\n/g, ' ').slice(0, 200),
        externalUrl,
        avgLikes: Math.round(avgLikes),
        avgComments: Math.round(avgComments),
        engagementRate: +(engagementRate * 100).toFixed(2),
        hashtagsHit: [...author.hashtagsHit].slice(0, 5),
        status,
        score,
        disqualifiers: reasons,
    });
}

scored.sort((a, b) => b.score - a.score);

// Output
writeFileSync('shortlist.json', JSON.stringify(scored, null, 2));

const csvHeader = ['username', 'fullName', 'url', 'followers', 'engagementRate%', 'avgLikes', 'avgComments', 'verified', 'externalUrl', 'status', 'score', 'disqualifiers', 'bio'];
const csvRows = scored.map((s) => [
    s.username,
    `"${(s.fullName || '').replace(/"/g, "'")}"`,
    s.url,
    s.followers,
    s.engagementRate,
    s.avgLikes,
    s.avgComments,
    s.verified,
    s.externalUrl,
    s.status,
    s.score,
    `"${s.disqualifiers.join('; ')}"`,
    `"${(s.bio || '').replace(/"/g, "'")}"`,
].join(','));
writeFileSync('shortlist.csv', [csvHeader.join(','), ...csvRows].join('\n'));

const greens = scored.filter((s) => s.status === 'GREEN');
const yellows = scored.filter((s) => s.status === 'YELLOW');
console.log(`\nErgebnis:`);
console.log(`  GREEN (alle Filter ok):  ${greens.length}`);
console.log(`  YELLOW (1 Schwäche):     ${yellows.length}`);
console.log(`  RED (mehrfach raus):     ${scored.length - greens.length - yellows.length}`);
console.log(`\nTop 10 GREEN/YELLOW nach Score:`);
[...greens, ...yellows].slice(0, 10).forEach((s, i) => {
    console.log(`  ${i + 1}. @${s.username} | ${s.followers.toLocaleString()} Foll. | ER ${s.engagementRate}% | Score ${s.score} | ${s.status}`);
});
console.log(`\nVollständig in shortlist.json / shortlist.csv`);
