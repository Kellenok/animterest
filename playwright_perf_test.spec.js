const { test, expect } = require('@playwright/test');

test.describe('Performance Tests Before Optimizations', () => {
    test('Measure initial load, search, and page rendering performance', async ({ page }) => {

        console.log('--- STARTING PERFORMANCE TEST ---');

        page.on('console', msg => {
            if (msg.type() === 'error' || msg.type() === 'warning') console.log(`BROWSER ${msg.type().toUpperCase()}: ${msg.text()}`);
        });
        page.on('pageerror', exception => {
            console.log(`BROWSER UNCAUGHT EXCEPTION: ${exception}`);
        });

        // 1. Initial Load Time
        const startTime = Date.now();
        await page.goto('http://127.0.0.1:8080'); // Assuming local server

        // Wait for the gallery container to have cards (means the data is loaded and rendered)
        await page.waitForSelector('.card', { state: 'visible', timeout: 15000 });
        const loadTime = Date.now() - startTime;
        console.log(`Initial Load Time: ${loadTime}ms`);

        // Check how many cards are loaded initially
        const initialCardCount = await page.locator('.card').count();
        console.log(`Initial Cards Rendered: ${initialCardCount}`);

        // 2. Search Performance
        const searchInput = page.locator('#search-input');
        await searchInput.waitFor({ state: 'visible' });

        console.log('Typing search term "mona" ...');
        const searchStartTime = Date.now();
        await searchInput.fill('mona');

        // wait for DOM to reflect the change.
        // Assuming search results have fewer cards. We wait for network idle to ensure rendering finishes
        await page.waitForLoadState('networkidle');
        const searchTime = Date.now() - searchStartTime;

        const searchCardCount = await page.locator('.card').count();
        console.log(`Search Filtering Time: ${searchTime}ms`);
        console.log(`Cards Rendered after search: ${searchCardCount}`);

        // Clear search
        await page.locator('#clear-search-btn').click();
        await page.waitForLoadState('networkidle');

        // 3. Scroll Performance (Proxy for virtual scroll effectiveness)
        console.log('Scrolling down... (Simulating 3 interactions)');
        const scrollStartTime = Date.now();

        // Trigger scroll 3 times
        await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2));
        await page.waitForTimeout(500); // Give JS time to fire scroll event and load more

        await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2));
        await page.waitForTimeout(500);

        await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2));
        await page.waitForTimeout(500);

        const scrollRenderTime = Date.now() - scrollStartTime;
        const finalCardCount = await page.locator('.card').count();

        console.log(`Scroll Render Time (3 scrolls): ${scrollRenderTime}ms`);
        console.log(`Final Cards Rendered Output: ${finalCardCount}`);

        // 4. Artist Page Load (Testing Similar Artists loading)
        console.log('Navigating to Artist Page (Testing Similar Artists load)...');

        // Click on the info button of the first card to go to the artist page
        const firstArtistCard = page.locator('#gallery-container .card').first();
        const infoButton = firstArtistCard.locator('.info-button');

        const artistPageStartTime = Date.now();
        await infoButton.click();

        // Wait for the artist view to be visible
        await page.waitForSelector('#view-artist:not(.hidden)', { state: 'visible', timeout: 10000 });

        // Wait for the similar artist cards to populate in the details grid
        await page.waitForSelector('#details-grid .card', { state: 'visible', timeout: 15000 });

        // Ensure that network is idle before considering it fully loaded (mostly to wait for similar.json / similar.js execution if any)
        await page.waitForLoadState('networkidle');

        const artistPageLoadTime = Date.now() - artistPageStartTime;
        const similarArtistCount = await page.locator('#details-grid .card').count();

        console.log(`Artist Page & Similar Artists Load Time: ${artistPageLoadTime}ms`);
        console.log(`Similar Artists Cards Rendered: ${similarArtistCount}`);

        console.log('--- END OF PERFORMANCE TEST ---');
    });
});
