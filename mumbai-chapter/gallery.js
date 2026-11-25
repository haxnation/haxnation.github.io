(function () {
    'use strict';

    let galleries = {};
    let readyPromise = null;

    function load() {
        if (!readyPromise) {
            readyPromise = fetch('/mumbai-chapter/event-gallery.json')
                .then(res => res.ok ? res.json() : {})
                .then(data => { galleries = (data && typeof data === 'object') ? data : {}; })
                .catch(() => { galleries = {}; });
        }
        return readyPromise;
    }

    function keyFor(event) {
        if (!event) return null;
        if (event.id && Array.isArray(galleries[event.id])) return event.id;
        const match = String(event.luma_url || '').match(/luma\.com\/([A-Za-z0-9]+)/i);
        const slug = match && match[1].toLowerCase();
        return (slug && Array.isArray(galleries[slug])) ? slug : null;
    }

    function slidesFor(event) {
        const key = keyFor(event);
        return key ? galleries[key] : [];
    }

    function imageHtml(event, posterHtml) {
        const slides = slidesFor(event);
        if (!slides.length) return posterHtml;

        const encoded = JSON.stringify(slides).replace(/&/g, '&amp;').replace(/'/g, '&#39;');
        const nav = slides.length > 1 ? `
            <button type="button" aria-label="Previous photo"
                class="hax-gallery-prev absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-white border-2 border-ink shadow-[2px_2px_0_0_#0b0b0b] font-black text-lg leading-none hover:bg-cyan">&#8249;</button>
            <button type="button" aria-label="Next photo"
                class="hax-gallery-next absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-white border-2 border-ink shadow-[2px_2px_0_0_#0b0b0b] font-black text-lg leading-none hover:bg-cyan">&#8250;</button>` : '';

        return `<div class="hax-gallery" data-slides='${encoded}' data-index="0">
            <img src="${slides[0]}" alt="Event photos"
                class="hax-gallery-image w-full aspect-square object-cover filter grayscale hover:grayscale-0 transition-all duration-300">
            ${nav}
        </div>`;
    }

    document.addEventListener('click', event => {
        const target = event.target;
        if (!target || !target.closest) return;
        const control = target.closest('.hax-gallery-prev, .hax-gallery-next');
        if (!control) return;

        const gallery = control.closest('.hax-gallery');
        if (!gallery) return;

        let slides;
        try { slides = JSON.parse(gallery.dataset.slides); } catch (e) { return; }
        if (!slides.length) return;

        event.preventDefault();
        const index = (Number(gallery.dataset.index || 0) + (control.classList.contains('hax-gallery-next') ? 1 : -1) + slides.length) % slides.length;
        gallery.dataset.index = index;
        const image = gallery.querySelector('.hax-gallery-image');
        if (image) image.src = slides[index];
    });

    window.HaxGallery = { ready: load, slidesFor, imageHtml };
})();
