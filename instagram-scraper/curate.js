/**
 * Curated DACH Business/Money/Coaching seed list -> Apify profile enrichment -> CSV.
 */
import { ApifyClient } from 'apify-client';
import { writeFileSync } from 'node:fs';

const token = process.env.APIFY_TOKEN;
if (!token) {
    console.error('Missing APIFY_TOKEN');
    process.exit(1);
}

const client = new ApifyClient({ token });
const ACTOR_ID = 'shu8hvrXbJbY3Eb9W';

// Curated seed list: DACH Business / Money / Coaching creators
// Quelle: persönliche Kenntnis + bekannte Marken-Namen im DACH-Coaching-Markt.
// Manche Handles sind Best-Guess; Apify gibt einfach leer zurück bei falschen.
const SEEDS = [
    // Business / Sales / Online-Marketing
    'dirkkreuter',
    'marcgalalofficial',
    'said.shiripour',
    'hermannscherer',
    'altmeyer.dejan',
    'pascalfeyh',
    'tim.gelhausen',
    'felixploetz',
    'christoph_magnussen',
    'alex_fischer_duesseldorf',
    'oliver.kahn.business',
    'fabian_tausch',
    'marcus_stein_official',
    'mike.warmeling',
    'patrickgreiner',
    'andreasbuhr',
    'oliverpott',
    'jensneubeck',
    'danielwagnerofficial',

    // Money / Finance / Investing
    'aktien_mit_kopf',
    'finanzfluss',
    'madamemoneypenny',
    'mrs.hedonista',
    'margarethehonisch',
    'finanzwesir',
    'jensrabe_official',
    'gerald.hoerhan',
    'jaredjamesfrey',
    'frankthelen',
    'carsten.maschmeyer',
    'finanzrocker',
    'finanztip',
    'natascha_wegelin',
    'thomas_kehl_offiziell',

    // Coaching / Mindset
    'laura.malina.seiler',
    'tobiasbeck',
    'christian.bischoff',
    'veronikapichl',
    'bodo.schaefer',
    'larspilawski',
    'mariusmatuschek',
    'chris_oliver_oechsler',
    'koljabarghoorn',
    'philipp.westermeyer',

    // Online Business / Skalieren
    'maximilian_zahn',
    'daniel_hoch_official',
    'robin_soeder',
    'tilo.bonow',
    'vladislav.melnik',
    'thomas_klussmann',
    'calvin_hollywood',
];

console.log(`Enriching ${SEEDS.length} curated DACH creators ...`);
const profileUrls = SEEDS.map((u) => `https://www.instagram.com/${u}/`);

const run = await client.actor(ACTOR_ID).call({
    resultsType: 'details',
    directUrls: profileUrls,
    resultsLimit: 1,
    addParentData: false,
});
const { items: profiles } = await client.dataset(run.defaultDatasetId).listItems();
console.log(`Got ${profiles.length} profiles back`);

// --- Scoring ---
const GERMAN_LOCATION_MARKERS = [
    'deutschland', 'österreich', 'schweiz', 'germany', 'austria', 'switzerland',
    'berlin', 'münchen', 'wien', 'zürich', 'hamburg', 'köln', 'frankfurt',
    'düsseldorf', 'stuttgart', 'graz', 'salzburg', 'basel', 'bern',
    'dubai', 'mallorca', 'marbella', 'zug',
    '🇩🇪', '🇦🇹', '🇨🇭',
];
const POS_BIO = [
    'coach', 'mentor', 'berater', 'trainer', 'speaker', 'founder', 'ceo', 'gründer', 'unternehmer',
    'skaliere', 'helfe', '6-stellig', '7-stellig', 'sechsstellig', 'siebenstellig',
    'umsatz', 'kunden', 'klienten',
    'kostenloses training', 'webinar', 'strategiegespräch', 'erstgespräch', 'termin buchen',
    'bekannt aus', 'forbes', 'faz', 'handelsblatt', 'ntv', 'autor', 'buch',
];
const NEG_BIO = [
    'travel', 'wanderlust', 'foodie', 'lifestyle blogger',
    'brand ambassador', 'collaborations welcome', 'paid partnerships',
    'teen', 'schüler', 'just for fun', 'hobby',
];
const FUNNEL_RED_FLAGS = [
    'mastermind', 'academy', 'akademie', 'mentoring-programm',
    'high ticket', 'inner circle',
];

const lower = (s = '') => (s || '').toLowerCase();
const countMatches = (bio, list) => list.filter((w) => lower(bio).includes(w));

const detectFunnelType = (url = '', bio = '') => {
    const u = lower(url);
    const b = lower(bio);
    if (!u) return { type: 'none', maturity: 0 };
    if (u.includes('linktr.ee') || u.includes('beacons.ai') || u.includes('linkin.bio')) {
        return { type: 'multi_link', maturity: 3 };
    }
    if (u.includes('calendly.com') || u.includes('koalendar.com') || u.includes('tidycal.com')) {
        return { type: 'one_to_one_call', maturity: 5 };
    }
    if (u.match(/webinar|training|masterclass|workshop/)) {
        return { type: 'webinar_funnel', maturity: 7 };
    }
    if (u.match(/school\.com|skool\.com|circle\.so/)) {
        return { type: 'community', maturity: 8 };
    }
    if (b.match(/freebie|gratis|cheat ?sheet|guide|kostenlos/)) {
        return { type: 'lead_magnet', maturity: 6 };
    }
    return { type: 'personal_brand', maturity: 4 };
};

const scored = profiles.map((p) => {
    const bio = p.biography || '';
    const fullBioBlob = `${bio} ${p.fullName || ''}`;
    const followers = p.followersCount || 0;
    const externalUrl = p.externalUrl || '';

    // Engagement from latestPosts
    const latest = (p.latestPosts || []).slice(0, 12);
    let avgLikes = 0, avgComments = 0, er = 0;
    if (latest.length) {
        avgLikes = latest.reduce((s, x) => s + (x.likesCount || 0), 0) / latest.length;
        avgComments = latest.reduce((s, x) => s + (x.commentsCount || 0), 0) / latest.length;
        er = followers > 0 ? (avgLikes + avgComments) / followers : 0;
    }

    const dachSignals = countMatches(fullBioBlob, GERMAN_LOCATION_MARKERS);
    const posMatches = countMatches(bio, POS_BIO);
    const negMatches = countMatches(bio, NEG_BIO);
    const funnel = detectFunnelType(externalUrl, bio);
    const hasFunnelRedFlag = FUNNEL_RED_FLAGS.some((w) => lower(bio).includes(w));

    // Klassifikation
    const reasons = [];
    if (followers < 2000) reasons.push('zu_klein');
    if (followers > 500000) reasons.push('zu_gross_vermutlich_schon_monetarisiert');
    if (negMatches.length >= 2) reasons.push('zu_viele_negativ_signale');
    if (er > 0 && er < 0.005 && followers > 5000) reasons.push('engagement_zu_niedrig');
    if (hasFunnelRedFlag) reasons.push('funnel_red_flag_in_bio');

    let status;
    if (reasons.length === 0 && posMatches.length >= 2 && (dachSignals.length > 0 || /ä|ö|ü|ß/.test(bio))) {
        status = 'GREEN';
    } else if (reasons.length <= 1) {
        status = 'YELLOW';
    } else {
        status = 'RED';
    }

    // Score
    let score = 0;
    if (followers >= 5_000 && followers <= 100_000) score += 25;
    else if (followers > 100_000 && followers <= 250_000) score += 18;
    else if (followers > 250_000 && followers <= 500_000) score += 10;
    else if (followers >= 2_000) score += 8;
    if (er >= 0.04) score += 25;
    else if (er >= 0.02) score += 18;
    else if (er >= 0.01) score += 10;
    else if (er > 0) score += 4;
    score += Math.min(posMatches.length * 4, 20);
    score -= negMatches.length * 5;
    if (funnel.maturity >= 5 && funnel.maturity <= 7) score += 10;     // Sweet-Spot
    if (hasFunnelRedFlag) score -= 15;                                  // bereits monetarisiert
    if (p.verified) score += 5;
    if (dachSignals.length > 0) score += 5;
    score = Math.max(0, Math.min(100, score));

    return {
        username: p.username,
        full_name: p.fullName || '',
        profile_url: `https://www.instagram.com/${p.username}/`,
        followers,
        posts_count: p.postsCount || 0,
        verified: !!p.verified,
        business_category: p.businessCategoryName || '',
        external_url: externalUrl,
        bio: (bio || '').replace(/\n/g, ' ').slice(0, 250),
        avg_likes: Math.round(avgLikes),
        avg_comments: Math.round(avgComments),
        engagement_rate_pct: +(er * 100).toFixed(2),
        latest_posts_sampled: latest.length,
        dach_signals: dachSignals.join('|'),
        positive_bio_matches: posMatches.join('|'),
        negative_bio_matches: negMatches.join('|'),
        funnel_type: funnel.type,
        funnel_maturity: funnel.maturity,
        has_funnel_red_flag: hasFunnelRedFlag,
        score,
        status,
        reasons: reasons.join(';'),
    };
});

scored.sort((a, b) => b.score - a.score);

writeFileSync('curated.json', JSON.stringify(scored, null, 2));

// CSV
const headers = Object.keys(scored[0] || {});
const csvEscape = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
};
const csv = [
    headers.join(','),
    ...scored.map((row) => headers.map((h) => csvEscape(row[h])).join(',')),
].join('\n');
writeFileSync('curated.csv', csv);

const greens = scored.filter((s) => s.status === 'GREEN');
const yellows = scored.filter((s) => s.status === 'YELLOW');
console.log(`\nResult: ${greens.length} GREEN, ${yellows.length} YELLOW, ${scored.length - greens.length - yellows.length} RED`);
console.log(`\nTop 15 by score:`);
scored.slice(0, 15).forEach((s, i) => {
    console.log(
        `  ${(i + 1).toString().padStart(2)}. ${s.status.padEnd(6)} @${s.username.padEnd(28)} ${s.followers.toLocaleString().padStart(8)} foll | ER ${s.engagement_rate_pct.toFixed(2)}% | score ${s.score}`,
    );
});
console.log(`\nFiles: curated.json, curated.csv`);
