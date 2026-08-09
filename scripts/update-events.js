const fs = require('fs');
const path = require('path');

const EVENTS_JSON_PATH = path.join(__dirname, '../mumbai-chapter/events.json');
const LUMA_API_URL = 'https://api.luma.com/user/profile/events?username=usr-HkDJKoqznvMGZuW';

function formatAddress(geo) {
    if (!geo) return 'TBA';
    
    const placeName = geo.address || (geo.full_address ? geo.full_address.split(',')[0].trim() : '');
    const city = geo.city || '';
    
    let area = '';
    if (geo.short_address) {
        const parts = geo.short_address.split(',').map(s => s.trim());
        if (parts.length >= 2) {
            if (parts[parts.length - 1] === city) {
                area = parts[parts.length - 2];
            } else {
                area = parts[parts.length - 1];
            }
        }
    }
    
    const components = [];
    if (placeName) components.push(placeName);
    if (area && area !== placeName && area !== city) components.push(area);
    if (city && city !== placeName) components.push(city);
    
    return components.length > 0 ? components.join(', ') : (geo.full_address || geo.short_address || 'TBA');
}

async function main() {
    try {
        console.log('Fetching events from Luma API...');
        const lumaRes = await fetch(LUMA_API_URL);
        if (!lumaRes.ok) {
            throw new Error(`Failed to fetch Luma API: ${lumaRes.status}`);
        }
        const lumaData = await lumaRes.json();

        // Extract and format events
        let allLumaEvents = [];
        if (lumaData.events_hosting) allLumaEvents = allLumaEvents.concat(lumaData.events_hosting);
        if (lumaData.events_past) allLumaEvents = allLumaEvents.concat(lumaData.events_past);
        if (lumaData.events_together) allLumaEvents = allLumaEvents.concat(lumaData.events_together);

        console.log(`Found ${allLumaEvents.length} events from Luma.`);

        const newEvents = allLumaEvents.map(item => {
            const ev = item.event;
            const startDate = new Date(ev.start_at);
            const endDate = ev.end_at ? new Date(ev.end_at) : startDate;

            const dateStr = startDate.toLocaleDateString('en-GB', {
                timeZone: 'Asia/Kolkata',
                day: '2-digit',
                month: 'long',
                year: 'numeric'
            });

            const timeStr = `${startDate.toLocaleTimeString('en-US', {
                timeZone: 'Asia/Kolkata',
                hour: '2-digit',
                minute: '2-digit'
            })} - ${endDate.toLocaleTimeString('en-US', {
                timeZone: 'Asia/Kolkata',
                hour: '2-digit',
                minute: '2-digit'
            })}`;

            return {
                id: item.api_id,
                title: ev.name,
                date: dateStr,
                time: timeStr,
                location: formatAddress(ev.geo_address_info),
                description: ev.description || '',
                image: ev.cover_url || '',
                raw_date: ev.start_at,
                luma_url: ev.url ? `https://luma.com/${ev.url}` : '',
                blog: '',
                youtube: ''
            };
        });

        // Read existing events
        let existingEvents = [];
        if (fs.existsSync(EVENTS_JSON_PATH)) {
            const fileContent = fs.readFileSync(EVENTS_JSON_PATH, 'utf-8');
            if (fileContent.trim()) {
                existingEvents = JSON.parse(fileContent);
                console.log(`Loaded ${existingEvents.length} existing events.`);
            }
        }

        // Merge and Sort
        const eventMap = new Map();
        
        // Add existing events to map
        existingEvents.forEach(ev => {
            if (ev.id) eventMap.set(ev.id, ev);
        });

        // Override with new events (update existing or add new)
        newEvents.forEach(ev => {
            const existing = eventMap.get(ev.id);
            if (existing) {
                ev.blog = existing.blog || '';
                ev.youtube = existing.youtube || '';
            }
            eventMap.set(ev.id, ev);
        });

        // Convert back to array and sort by date descending (newest first)
        const mergedEvents = Array.from(eventMap.values());
        mergedEvents.sort((a, b) => {
            const dateA = a.raw_date ? new Date(a.raw_date) : new Date(0);
            const dateB = b.raw_date ? new Date(b.raw_date) : new Date(0);
            return dateB - dateA; // Descending
        });

        // Write back to file
        fs.writeFileSync(EVENTS_JSON_PATH, JSON.stringify(mergedEvents, null, 2));
        console.log(`Successfully saved ${mergedEvents.length} events to ${EVENTS_JSON_PATH}.`);

    } catch (err) {
        console.error('Error updating events:', err);
        process.exit(1);
    }
}

main();
