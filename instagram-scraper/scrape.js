import { ApifyClient } from 'apify-client';
import { writeFileSync } from 'node:fs';

const token = process.env.APIFY_TOKEN;
if (!token) {
    console.error('Missing APIFY_TOKEN env var. Run: export APIFY_TOKEN="..."');
    process.exit(1);
}

const client = new ApifyClient({ token });

const input = {
    resultsType: 'posts',
    directUrls: ['https://www.instagram.com/humansofny/'],
    resultsLimit: 100,
    searchType: 'hashtag',
    searchLimit: 10,
    addParentData: false,
};

const run = await client.actor('shu8hvrXbJbY3Eb9W').call(input);
const { items } = await client.dataset(run.defaultDatasetId).listItems();

console.log(`Fetched ${items.length} items`);
writeFileSync('results.json', JSON.stringify(items, null, 2));
console.log('Saved to results.json');
