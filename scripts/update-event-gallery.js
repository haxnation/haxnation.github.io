const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const EVENTS_PATH = path.join(ROOT, 'mumbai-chapter/events.json');
const MANUAL_PATH = path.join(__dirname, 'event-gallery.manual.json');
const OUTPUT_PATH = path.join(ROOT, 'mumbai-chapter/event-gallery.json');

const SHOWCASE_URL = 'https://www.linkedin.com/showcase/haxnation-meetups-mumbai/posts/';
const MAX_SCROLLS = 40;
const STABLE_LIMIT = 4;
const MAX_IMAGES_PER_EVENT = 12;

function slugFromUrl(url) {
    const match = String(url || '').match(/luma\.com\/([A-Za-z0-9]+)/i);
    return match ? match[1].toLowerCase() : null;
}

function keysInText(text, validKeys) {
    const found = new Set();
    const urls = String(text || '').match(/luma\.com\/([A-Za-z0-9]+)/gi) || [];
    urls.forEach(u => found.add(u.split('/').pop().toLowerCase()));
    const tags = String(text || '').match(/#[A-Za-z0-9]+/g) || [];
    tags.forEach(t => found.add(t.slice(1).toLowerCase()));
    return [...found].filter(k => validKeys.has(k));
}

async function scrapeLinkedIn(validKeys) {
    const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    try {
        const page = await browser.newPage({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36',
            viewport: { width: 1280, height: 900 }
        });
        await page.goto(SHOWCASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForSelector('article[data-activity-urn]', { timeout: 30000 });

        let previous = 0;
        let stable = 0;
        for (let i = 0; i < MAX_SCROLLS; i++) {
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await page.waitForTimeout(1200);
            const count = await page.locator('article[data-activity-urn]').count();
            if (count === previous) {
                stable++;
                if (stable >= STABLE_LIMIT) break;
            } else {
                stable = 0;
                previous = count;
            }
        }

        console.log(`Loaded ${previous} posts from the public showcase feed.`);

        const posts = await page.evaluate(() => {
            return [...document.querySelectorAll('article[data-activity-urn]')].map(article => {
                const wrapper = article.closest('[data-id="entire-feed-card-link"]');
                const link = wrapper ? wrapper.querySelector('a[data-id="main-feed-card__full-link"]') : null;
                const images = [...article.querySelectorAll('img')]
                    .map(img => img.getAttribute('data-delayed-url') || img.src || '')
                    .filter(url => /media\.licdn\.com\/dms\/image/.test(url) && /\/(feedshare|articleshare)/i.test(url));
                return {
                    urn: article.getAttribute('data-activity-urn'),
                    text: article.innerText || '',
                    url: link ? link.href : '',
                    images
                };
            });
        });

        const grouped = {};
        posts.forEach(post => {
            keysInText(post.text, validKeys).forEach(key => {
                const bucket = grouped[key] || (grouped[key] = []);
                post.images.forEach(url => {
                    if (bucket.length < MAX_IMAGES_PER_EVENT && !bucket.some(item => item.url === url)) {
                        bucket.push({ url, post: post.url || post.urn });
                    }
                });
            });
        });
        return grouped;
    } finally {
        await browser.close();
    }
}

function loadManual() {
    if (!fs.existsSync(MANUAL_PATH)) return {};
    const data = JSON.parse(fs.readFileSync(MANUAL_PATH, 'utf-8'));
    const result = {};
    Object.entries(data).forEach(([key, entries]) => {
        result[key.toLowerCase()] = entries.map(entry => {
            if (typeof entry === 'string') return { url: entry, post: '' };
            return { url: entry.url || '', post: entry.post || '' };
        }).filter(item => item.url);
    });
    return result;
}

async function main() {
    const events = JSON.parse(fs.readFileSync(EVENTS_PATH, 'utf-8'));
    const validKeys = new Set(
        events.map(ev => slugFromUrl(ev.luma_url)).filter(Boolean)
    );

    let scraped = {};
    try {
        scraped = await scrapeLinkedIn(validKeys);
    } catch (err) {
        console.warn(`LinkedIn scrape failed, continuing with manual entries only: ${err.message}`);
    }

    const manual = loadManual();
    const merged = {};
    [...new Set([...Object.keys(manual), ...Object.keys(scraped)])].forEach(key => {
        const items = [];
        const seen = new Set();
        [...(manual[key] || []), ...(scraped[key] || [])].forEach(item => {
            if (item.url && !seen.has(item.url) && items.length < MAX_IMAGES_PER_EVENT) {
                seen.add(item.url);
                items.push(item);
            }
        });
        if (items.length) merged[key] = items;
    });

    const output = {};
    for (const key of Object.keys(merged).sort()) {
        output[key] = merged[key].map(item => item.url);
        console.log(`${key}: ${output[key].length} image link(s)`);
    }

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2) + '\n');
    console.log(`Wrote ${Object.keys(output).length} event galleries to ${OUTPUT_PATH}.`);
}

main().catch(err => {
    console.error('Error updating event gallery:', err);
    process.exit(1);
});
