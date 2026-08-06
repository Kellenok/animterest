document.addEventListener('DOMContentLoaded', () => {
    const DEBUG_MODE = false;

    const galleryContainer = document.getElementById('gallery-container');
    const loader = document.getElementById('loader');
    const tabGallery = document.getElementById('tab-gallery');
    const tabFavorites = document.getElementById('tab-favorites');
    const searchInput = document.getElementById('search-input');
    const sortByNameBtn = document.getElementById('sort-by-name');
    const sortByWorksBtn = document.getElementById('sort-by-works');
    const sortByUniquenessBtn = document.getElementById('sort-by-uniqueness');
    const sortByRandomBtn = document.getElementById('sort-by-random');
    const sortByDateBtn = document.getElementById('sort-by-date');
    const scrollToTopBtn = document.getElementById('scroll-to-top');
    const gridSlider = document.getElementById('grid-slider');
    const controlsContainer = document.getElementById('controls-container');
    const favoritesControlsWrapper = document.getElementById('favorites-controls-wrapper');
    const styleCounter = document.getElementById('style-counter');
    const favoritesCounter = document.getElementById('favorites-counter');
    const txtExportContainer = document.getElementById('txt-export-container');
    const importFavoritesInput = document.getElementById('import-favorites-input');
    const jumpInput = document.getElementById('jump-input');
    const clearJumpBtn = document.getElementById('clear-jump-btn');
    const jumpControls = document.querySelector('.jump-controls');
    const searchWrapper = document.querySelector('.search-wrapper');
    const sortControls = document.querySelector('.sort-controls');
    const clearSearchBtn = document.getElementById('clear-search-btn');

    const viewGallery = document.getElementById('view-gallery');
    const viewArtist = document.getElementById('view-artist');
    const controlsContainerWrapper = document.getElementById('controls-container');
    const detailsBackBtn = document.getElementById('details-back-btn');
    const detailsImage = document.getElementById('details-image');
    const detailsArtistName = document.getElementById('details-artist-name');
    const detailsWorksCount = document.getElementById('details-works-count');
    const detailsCopyBtn = document.getElementById('details-copy-btn');
    const detailsFavoriteBtn = document.getElementById('details-favorite-btn');
    const detailsDanbooruLink = document.getElementById('details-danbooru-link');
    const detailsGelbooruLink = document.getElementById('details-gelbooru-link');
    const detailsGrid = document.getElementById('details-grid');
    const detailsHero = document.getElementById('details-hero');

    let currentDetailsItem = null;
    let similarArtistsObserver = null;
    let availableSimilarItems = [];
    let isSimilarItemsLoading = false;
    let similarData = null;

    let allItems = [];
    let itemsSortedByWorks = [];
    let favorites = new Map();
    let currentItems = [];
    let currentPage = 0;
    let startIndexOffset = 0;
    const itemsPerPage = 20;
    let searchTerm = '';
    let currentView = 'gallery';
    let lastGalleryScroll = 0;
    let sortType = 'name';
    let sortDirection = 'desc';
    let isLoading = false;
    let sortUpdateTimeout;
    let previousSortType = null;
    let previousSortDirection = null;
    let jumpTimeout;
    const SORT_TYPE_KEY = 'sortType';
    const SORT_DIRECTION_KEY = 'sortDirection';

    window.appGlobals = {
        get currentItems() { return currentItems; },
        get favorites() { return favorites; },
        get searchTerm() { return searchTerm; },
        get currentView() { return currentView; },
        get db() { return db; },
        get STORE_NAME() { return STORE_NAME; },
        toggleFavorite,
        showToast,
        renderView,
        updateVisibleFavorites
    };

    const isOnline = window.location.protocol.startsWith('http');
    const imageBasePath = isOnline
        ? 'https://huggingface.co/datasets/Kellenok/anima/resolve/main/'
        : '';

    let db;
    const DB_NAME = 'StyleGalleryDB';
    const STORE_NAME = 'favorites';

    // Initialize IndexedDB for local storage
    function initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, 4);

            request.onerror = () => {
                console.error('IndexedDB error:', request.error);
                reject('Error opening DB');
            };

            request.onsuccess = (event) => {
                db = event.target.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                if (db.objectStoreNames.contains(STORE_NAME)) {
                    db.deleteObjectStore(STORE_NAME);
                }

                const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                objectStore.createIndex('timestamp', 'timestamp', { unique: false });
            };
        });
    }

    // Load favorite items from DB to memory
    async function loadFavoritesFromDB() {
        return new Promise((resolve) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const objectStore = transaction.objectStore(STORE_NAME);
            const request = objectStore.getAll();
            request.onsuccess = () => {

                favorites = new Map(request.result.map(item => [item.id, item.timestamp]));
                resolve();
            };
        });
    }

    async function debug_checkImagePaths() {
        if (!DEBUG_MODE) return;

        console.log('%c[DEBUG] Запущена проверка путей к изображениям...', 'color: orange; font-weight: bold;');

        const totalItems = allItems.length;
        let foundCount = 0;
        const notFoundArtists = [];

        const checkImage = (item) => {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    foundCount++;
                    resolve();
                };
                img.onerror = () => {
                    notFoundArtists.push({ artist: item.artist, id: item.id, path: item.image });
                    resolve();
                };
                img.src = item.image;
            });
        };

        await Promise.all(allItems.map(item => checkImage(item)));

        const notFoundCount = notFoundArtists.length;
        console.log('%c[DEBUG] Проверка изображений завершена.', 'color: orange; font-weight: bold;');
        console.log(`- Всего проверено: ${totalItems}`);
        console.log(`- Найдено изображений: %c${foundCount}`, 'color: green;');
        console.log(`- Не найдено изображений: %c${notFoundCount}`, `color: ${notFoundCount > 0 ? 'red' : 'green'};`);

        if (notFoundCount > 0) {
            console.warn('[DEBUG] Список художников с отсутствующими изображениями:');
            console.table(notFoundArtists);
        }
    }
    // Construct a DOM card element containing artist data
    function createCard(item, forceGalleryAppearance = false) {
        const card = document.createElement('div');
        card.className = 'card';
        card.dataset.artist = item.artist;
        card.dataset.id = item.id;

        const isFavorited = favorites.has(item.id);

        const rankHTML = sortType === 'uniqueness' && item.uniquenessRank
            ? `<div class="uniqueness-rank" title="Uniqueness Rank">#${item.uniquenessRank}</div>`
            : '';

        let favButtonHTML;
        if (currentView === 'favorites' && !forceGalleryAppearance) {

            favButtonHTML = `
                <button 
                    class="favorite-button remove-favorite" 
                    aria-label="Remove from favorites"
                    title="Remove from favorites"
                >
                    ×
                </button>
            `;
        } else {

            favButtonHTML = `
                <button 
                    class="favorite-button ${isFavorited ? 'favorited' : ''}" 
                    aria-label="${isFavorited ? 'Remove from favorites' : 'Add to favorites'}"
                    title="${isFavorited ? 'Remove from favorites' : 'Add to favorites'}"
                >
                    
                </button>
            `;
        }

        card.innerHTML = `
            <div class="card__visual">
                <img class="card__image" src="${item.image}" alt="${item.artist}" loading="lazy" width="832" height="1216">
                <div class="works-count" title="Approximate number of training images for this artistic style">
                    ${item.worksCount.toLocaleString('en-US')}
                </div>
                ${rankHTML}
                ${favButtonHTML}
                <button class="info-button" aria-label="View artist details" title="View details">i</button>
            </div>
            <div class="card__info">
                <p class="card__artist">${item.artist}</p>
            </div>
        `;

        card.addEventListener('click', (e) => {
            if (!e.target.closest('.favorite-button') && !e.target.closest('.info-button')) {
                navigator.clipboard.writeText('@' + item.artist).then(() => {
                    showToast('Artist name copied to clipboard!');
                });
            }
        });

        const favButton = card.querySelector('.favorite-button');
        favButton.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleFavorite(item, favButton);
        });

        const infoButton = card.querySelector('.info-button');
        infoButton.addEventListener('click', (e) => {
            e.stopPropagation();

            window.location.hash = '#/artist/' + encodeURIComponent(item.artist);
        });

        return card;
    }

    // Fetch dataset and trigger the first render cycle
    async function loadInitialData() {
        try {

            if (typeof galleryData !== 'undefined' && allItems.length === 0) {

                allItems = galleryData.map(item => ({
                    artist: item.name,
                    image: `${imageBasePath}images/${item.p}/${item.id}.webp`,
                    worksCount: item.post_count,
                    id: item.id,
                    uniqueness_score: item.uniqueness_score
                }));

                itemsSortedByWorks = [...allItems].sort((a, b) => b.worksCount - a.worksCount);

                if (typeof similarArtistsData !== 'undefined') {
                    similarData = similarArtistsData;
                    console.log(`[OK] Loaded similarArtistsData (${Object.keys(similarData).length} artists)`);
                }
            }

            await debug_checkImagePaths();

            styleCounter.textContent = allItems.length.toLocaleString('en-US');

            await loadFavoritesFromDB();
            favoritesCounter.textContent = favorites.size.toLocaleString('en-US');
            renderView();
        } catch (error) {
            console.error('Failed to load gallery data:', error);
            galleryContainer.innerHTML = '<p style="text-align: center; grid-column: 1 / -1;">Failed to load data.</p>';
        }
    }

    // Filter, sort, and display the current grid view
    function renderView() {
        currentPage = 0;
        galleryContainer.innerHTML = '';

        updateSortButtonsUI();

        if (sortType === 'uniqueness') {
            galleryContainer.classList.add('uniqueness-view');
            jumpInput.placeholder = 'Jump to rank...';
        } else {
            galleryContainer.classList.remove('uniqueness-view');
            jumpInput.placeholder = 'Jump to count...';
        }

        galleryContainer.classList.toggle('favorites-view', currentView === 'favorites');

        const jumpToArtistId = localStorage.getItem('jumpToArtistId');
        if (jumpToArtistId && currentView === 'gallery') {

            let tempSortedItems = [...allItems];
            const tempDirection = sortDirection === 'asc' ? 1 : -1;
            if (sortType === 'name') {
                tempSortedItems.sort((a, b) => a.artist.localeCompare(b.artist) * tempDirection);
            } else if (sortType === 'works') {
                tempSortedItems.sort((a, b) => (a.worksCount - b.worksCount) * tempDirection);
            } else if (sortType === 'uniqueness') {
                tempSortedItems.sort((a, b) => (b.uniqueness_score || 0) - (a.uniqueness_score || 0));
            }

            const targetIndex = tempSortedItems.findIndex(item => item.id === jumpToArtistId);

            if (targetIndex !== -1) {

                startIndexOffset = targetIndex;
            }
        }

        window.scrollTo({ top: 0, behavior: 'instant' });

        let baseItems = [...allItems];
        if (currentView === 'favorites') {
            baseItems = baseItems.filter(item => favorites.has(item.id));
        }

        let sortedItems = [...baseItems];
        const direction = sortDirection === 'asc' ? 1 : -1;

        if (sortType === 'name') {
            sortedItems.sort((a, b) => a.artist.localeCompare(b.artist) * direction);
        } else if (sortType === 'works') {
            sortedItems.sort((a, b) => (a.worksCount - b.worksCount) * direction);
        } else if (sortType === 'uniqueness') {
            sortedItems.sort((a, b) => ((a.uniqueness_score || 0) - (b.uniqueness_score || 0)) * direction);
        } else if (sortType === 'date') {
            sortedItems.sort((a, b) => ((favorites.get(a.id) || 0) - (favorites.get(b.id) || 0)) * direction);
        } else if (sortType === 'random') {

            for (let i = sortedItems.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [sortedItems[i], sortedItems[j]] = [sortedItems[j], sortedItems[i]];
            }
        }

        sortedItems.forEach((item, index) => {
            if (sortType === 'uniqueness') {
                item.uniquenessRank = index + 1;
            } else {
                delete item.uniquenessRank;
            }
        });

        let filteredItems;
        if (searchTerm) {
            const normalizeStr = (str) => String(str).toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
            const normalizedSearchTerm = normalizeStr(searchTerm);
            
            filteredItems = sortedItems.filter(item =>
                normalizeStr(item.artist).includes(normalizedSearchTerm)
            );
        } else {
            filteredItems = sortedItems;
        }

        currentItems = filteredItems.slice(startIndexOffset);

        if (filteredItems.length === 0) {
            const p = document.createElement('p');
            p.style.textAlign = 'center';
            p.style.gridColumn = '1 / -1';

            if (currentView === 'favorites') {
                if (favorites.size > 0 && searchTerm) {
                    p.innerText = `No artists found for "${searchTerm}" in your favorites.`;
                } else {
                    p.innerText = 'You have no favorites yet.';
                }
            } else if (searchTerm) {
                p.innerText = `No artists found for "${searchTerm}".`;
            } else {

                p.innerText = 'No artists found.';
            }
            galleryContainer.appendChild(p);
            return;
        }

        virtualState = { startIndex: -1, endIndex: -1 };
        updateVirtualScroll();

        if (loader) {
            loader.style.display = 'none';
        }

        const targetJumpId = localStorage.getItem('jumpToArtistId');
        if (targetJumpId) {

            const targetIndex = currentItems.findIndex(item => item.id === targetJumpId);
            if (targetIndex !== -1) {
                setTimeout(() => {
                    const gridComputed = window.getComputedStyle(galleryContainer);
                    const columns = gridComputed.getPropertyValue('grid-template-columns').split(' ').length || 1;
                    const containerWidth = galleryContainer.clientWidth - (columns - 1) * 2;
                    const cardWidth = containerWidth / columns;
                    const cardHeight = (cardWidth * (1216 / 832)) + 40;
                    const targetRow = Math.floor(targetIndex / columns);
                    window.scrollTo(0, targetRow * cardHeight);
                }, 50);
            }
            localStorage.removeItem('jumpToArtistId');
        }
    }

    let virtualState = { startIndex: -1, endIndex: -1 };

    let isVirtualScrollPending = false;

    // Recalculate grid visibility to save DOM memory
    function updateVirtualScroll() {
        if (!currentItems || currentItems.length === 0 || currentView !== 'gallery' && currentView !== 'favorites') return;

        const gridComputed = window.getComputedStyle(galleryContainer);
        const columns = gridComputed.getPropertyValue('grid-template-columns').split(' ').length || 1;

        const containerWidth = galleryContainer.clientWidth - (columns - 1) * 2;
        const cardWidth = containerWidth / columns;
        const cardHeight = (cardWidth * (1216 / 832)) + 40;

        const scrollTop = window.scrollY;

        const rowsInView = Math.ceil(window.innerHeight / cardHeight);
        const startRow = Math.max(0, Math.floor((scrollTop - galleryContainer.offsetTop) / cardHeight) - 2);
        const endRow = startRow + rowsInView + 4;

        const startIndex = startRow * columns;
        let endIndex = endRow * columns;
        endIndex = Math.min(currentItems.length, endIndex);

        if (virtualState.startIndex === startIndex && virtualState.endIndex === endIndex) {
            return;
        }

        virtualState.startIndex = startIndex;
        virtualState.endIndex = endIndex;

        const totalRows = Math.ceil(currentItems.length / columns);
        const totalHeight = totalRows * cardHeight;

        const topPadding = startRow * cardHeight;
        const renderedRows = Math.ceil((endIndex - startIndex) / columns);

        const bottomPadding = Math.max(0, totalHeight - topPadding - (renderedRows * cardHeight));

        galleryContainer.innerHTML = '';

        if (topPadding > 0) {
            const topSpacer = document.createElement('div');
            topSpacer.style.gridColumn = '1 / -1';
            topSpacer.style.height = `${topPadding}px`;
            galleryContainer.appendChild(topSpacer);
        }

        for (let i = startIndex; i < endIndex; i++) {
            if (currentItems[i]) {
                const card = createCard(currentItems[i]);
                galleryContainer.appendChild(card);
            }
        }

        if (bottomPadding > 0) {
            const bottomSpacer = document.createElement('div');
            bottomSpacer.style.gridColumn = '1 / -1';
            bottomSpacer.style.height = `${bottomPadding}px`;
            galleryContainer.appendChild(bottomSpacer);
        }

        if (typeof keyboardFocusedIndex !== 'undefined' && keyboardFocusedIndex >= 0 && currentItems && currentItems[keyboardFocusedIndex]) {
            const activeId = String(currentItems[keyboardFocusedIndex].id);
            const activeCard = galleryContainer.querySelector(`.card[data-id="${activeId}"]`);
            if (activeCard) {
                activeCard.classList.add('keyboard-focus');
            }
        }
    }

    // Add or remove an artist from DB favorites and update UI
    function toggleFavorite(item, button) {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        if (favorites.has(item.id)) {
            store.delete(item.id);
            favorites.delete(item.id);
            favoritesCounter.textContent = favorites.size.toLocaleString('en-US');
            showToast(`Removed ${item.artist} from favorites`);
            if (button) {
                button.title = 'Add to favorites';
                button.setAttribute('aria-label', 'Add to favorites');
                button.classList.remove('favorited');
            }
        } else {
            const favItem = { id: item.id, timestamp: Date.now() };
            store.put(favItem);
            favorites.set(item.id, favItem.timestamp);
            favoritesCounter.textContent = favorites.size.toLocaleString('en-US');
            showToast(`Added ${item.artist} to favorites`);
            if (button) {
                button.title = 'Remove from favorites';
                button.setAttribute('aria-label', 'Remove from favorites');
                button.classList.add('favorited');
            }
        }

        // Update card favorite button in DOM if present
        const activeCard = document.querySelector(`.card[data-id="${item.id}"]`);
        if (activeCard) {
            const cardFavBtn = activeCard.querySelector('.favorite-button');
            if (cardFavBtn) {
                const isFav = favorites.has(item.id);
                cardFavBtn.classList.toggle('favorited', isFav);
                cardFavBtn.title = isFav ? 'Remove from favorites' : 'Add to favorites';
            }
        }

        // Update details page button if currently viewing this item
        if (typeof currentDetailsItem !== 'undefined' && currentDetailsItem && String(currentDetailsItem.id) === String(item.id)) {
            updateDetailsFavoriteButton(item.id);
        }

        // Update QuickLook button if QuickLook is open
        if (typeof isQuickLookOpen !== 'undefined' && isQuickLookOpen) {
            updateQuickLookFavUI();
        }

        if (currentView === 'favorites') {
            if (button) {
                const card = button.closest('.card');
                if (card) {
                    card.style.transition = 'opacity 0.15s ease, transform 0.15s ease, margin 0.15s ease, padding 0.15s ease, max-height 0.15s ease';
                    card.style.transform = 'scale(0.8)';
                    card.style.opacity = '0';
                    card.style.margin = '0';
                    card.style.padding = '0';
                    card.style.maxHeight = '0px';

                    card.addEventListener('transitionend', () => {
                        card.remove();

                        if (favorites.size === 0) {
                            galleryContainer.innerHTML = '<p style="text-align: center; grid-column: 1 / -1;">No favorites yet.</p>';
                        }
                    }, { once: true });
                }
            } else {
                renderView();
            }
        }

        updateVisibleFavorites();
    }

    function updateVisibleFavorites() {
        if (currentView !== 'gallery') return;

        const cards = galleryContainer.querySelectorAll('.card');
        cards.forEach(card => {
            const cardId = card.dataset.id;
            const favButton = card.querySelector('.favorite-button');
            if (cardId && favButton && !favButton.classList.contains('remove-favorite')) {
                const isFavorited = favorites.has(cardId);
                favButton.classList.toggle('favorited', isFavorited);
                const newTitle = isFavorited ? 'Remove from favorites' : 'Add to favorites';
                favButton.title = newTitle;
                favButton.setAttribute('aria-label', newTitle);
            }
        });
    }

    // Display a temporary notification popup
    function showToast(message) {
        const toast = document.getElementById('toast-notification');
        if (message) toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 2000);
    }

    function setActiveTab(activeTab) {
        const tabs = [tabGallery, tabFavorites];
        tabs.forEach(tab => tab.classList.remove('active'));
        activeTab.classList.add('active');
    }

    // Update the disabled styling of search and jump inputs depending on states
    function updateControlsState() {
        const isSearchingByName = searchInput.value.trim().length > 0;
        const isJumpingByCount = jumpInput.value.trim().length > 0;

        sortControls.classList.toggle('disabled', isJumpingByCount);

        jumpControls.classList.toggle('disabled', isSearchingByName);

        searchInput.parentElement.classList.toggle('disabled', isJumpingByCount);
    }

    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) {
            scrollToTopBtn.classList.add('visible');
        } else {
            scrollToTopBtn.classList.remove('visible');
        }

        if (!isVirtualScrollPending) {
            isVirtualScrollPending = true;
            window.requestAnimationFrame(() => {
                if (currentView === 'gallery' || currentView === 'favorites') {
                    updateVirtualScroll();
                }
                isVirtualScrollPending = false;
            });
        }
    });

    window.addEventListener('resize', debounce(() => {
        if (currentView === 'gallery' || currentView === 'favorites') {
            virtualState = { startIndex: -1, endIndex: -1 };
            updateVirtualScroll();
        }
    }, 200));

    scrollToTopBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    tabGallery.addEventListener('click', (e) => {
        e.preventDefault();
        if (currentView === 'gallery') return;
        setActiveTab(tabGallery);
        favoritesControlsWrapper.style.display = 'none';
        txtExportContainer.style.display = 'none';
        jumpControls.style.display = 'flex';
        sortControls.style.display = 'flex';
        sortByDateBtn.style.display = 'none';
        if (sortType === 'date') {
            sortType = 'name';
            sortDirection = 'asc';
            updateSortButtonsUI();
        }
        currentView = 'gallery';

        styleCounter.textContent = allItems.length.toLocaleString('en-US');

        renderView();

        if (searchInput.value) {
            searchInput.value = '';
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
    });

    tabFavorites.addEventListener('click', (e) => {
        e.preventDefault();
        if (currentView === 'favorites') return;
        setActiveTab(tabFavorites);
        favoritesControlsWrapper.style.display = 'flex';
        txtExportContainer.style.display = 'flex';
        jumpControls.style.display = 'flex';
        sortControls.style.display = 'flex';
        sortByDateBtn.style.display = 'inline-block';
        currentView = 'favorites';

        favoritesCounter.textContent = favorites.size.toLocaleString('en-US');

        startIndexOffset = 0;
        jumpInput.value = '';

        resetJumpState(false);

        if (searchInput.value) {
            searchInput.value = '';
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        }

        renderView();
    });

    const saveFavoritesBtn = document.getElementById('save-favorites-btn');
    const importFavoritesBtn = document.getElementById('import-favorites-btn');
    const exportTxtBtn = document.getElementById('export-txt-btn');

    importFavoritesBtn.addEventListener('click', () => {
        importFavoritesInput.click();
    });

    importFavoritesInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) {
            return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                let importedFavorites = [];
                let totalAttempted = 0;
                const content = e.target.result;
                
                try {
                    const data = JSON.parse(content);
                    if (data.favorites && Array.isArray(data.favorites)) {
                        importedFavorites = data.favorites;
                        totalAttempted = data.favorites.length;
                    } else if (data.favourites && Array.isArray(data.favourites)) {
                        const now = Date.now();
                        const normalizeName = (name) => String(name).toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
                        
                        data.favourites.forEach(nameOrId => {
                            const rawLine = String(nameOrId).trim().toLowerCase();
                            const normalizedLine = normalizeName(rawLine);
                            const artist = allItems.find(a => normalizeName(a.artist) === normalizedLine || String(a.id) === rawLine);
                            if (artist) {
                                importedFavorites.push({ id: String(artist.id), timestamp: now });
                            }
                        });
                        totalAttempted = data.favourites.length;
                        if (importedFavorites.length === 0 && data.favourites.length > 0) {
                            throw new Error('No matching artists found in JSON array');
                        }
                    } else {
                        throw new Error('Not a valid favorites JSON');
                    }
                } catch (jsonError) {
                    const lines = content.split(/\r?\n/).map(line => line.trim().toLowerCase()).filter(line => line);
                    const now = Date.now();
                    const normalizeName = (name) => String(name).toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
                    totalAttempted = lines.length;
                    
                    lines.forEach(rawLine => {
                        const normalizedLine = normalizeName(rawLine);
                        const artist = allItems.find(a => normalizeName(a.artist) === normalizedLine || String(a.id) === rawLine);
                        if (artist) {
                            importedFavorites.push({ id: String(artist.id), timestamp: now });
                        }
                    });
                    
                    if (importedFavorites.length === 0 && lines.length > 0) {
                        throw new Error('No matching artists found in text file');
                    }
                }

                let importedCount = 0;
                const transaction = db.transaction(STORE_NAME, 'readwrite');
                const store = transaction.objectStore(STORE_NAME);

                importedFavorites.forEach(fav => {
                    if (fav.id && fav.timestamp && !favorites.has(String(fav.id))) {
                        store.put({ id: String(fav.id), timestamp: fav.timestamp });
                        importedCount++;
                    }
                });

                await new Promise(resolve => transaction.oncomplete = resolve);
                await loadFavoritesFromDB();
                renderView();

                favoritesCounter.textContent = favorites.size.toLocaleString('en-US');
                showToast(`Imported ${importedCount}/${totalAttempted} artists`);

            } catch (error) {
                console.error('Error importing favorites:', error);
                showToast('Error: Could not import favorites. Invalid file or no matches.');
            } finally {

                importFavoritesInput.value = '';
            }
        };
        reader.readAsText(file);
    });

    saveFavoritesBtn.addEventListener('click', () => {
        if (favorites.size === 0) {
            showToast('You have no favorites to save.');
            return;
        }

        const favoritesToSave = Array.from(favorites.entries())
            .map(([id, timestamp]) => ({ id, timestamp }))
            .sort((a, b) => b.timestamp - a.timestamp);

        const exportData = {
            metadata: {
                appName: "Anima Style Explorer",
                exportDate: new Date().toISOString(),
                favoritesCount: favoritesToSave.length
            },
            favorites: favoritesToSave
        };

        const jsonString = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        const date = new Date().toISOString().slice(0, 10);
        a.download = `anima-style-favorites-${date}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast('Favorites exported to JSON file!');
    });

    exportTxtBtn.addEventListener('click', () => {
        if (favorites.size === 0) {
            showToast('You have no favorites to save.');
            return;
        }

        const sortedFavoriteIds = Array.from(favorites.entries())
            .sort(([, timestampA], [, timestampB]) => timestampB - timestampA)
            .map(([id]) => id);

        const artistNames = sortedFavoriteIds.map(id => {
            const artistData = allItems.find(item => item.id === id);
            return artistData ? artistData.artist : null;
        }).filter(Boolean);

        const textContent = artistNames.join('\n');
        const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        const date = new Date().toISOString().slice(0, 10);
        a.download = `anima-style-favorites-artists-${date}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    // Limit the execution rate of performance-heavy functions
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    const debouncedRenderView = debounce(() => {
        renderView();
    }, 250);

    searchInput.addEventListener('input', (e) => {
        const newSearchTerm = e.target.value.toLowerCase().trim();
        const isSearching = newSearchTerm.length > 0;
        clearSearchBtn.style.display = isSearching ? 'flex' : 'none';

        if (searchTerm.length > 0 && !isSearching) {
            startIndexOffset = 0;
        }

        searchTerm = newSearchTerm;
        updateControlsState();
        debouncedRenderView();
    });

    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';

        const event = new Event('input', { bubbles: true });
        searchInput.dispatchEvent(event);
    });

    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            if (window.location.hash.startsWith('#/artist/')) {
                window.location.hash = '';
            }
            if (window.innerWidth <= 992) {
                e.preventDefault();
                e.target.blur();
            }
        }
    });

    // Handle numeric search to jump exactly to a specific rank or works count
    function handleJump(isReset = false) {
        const targetValue = parseInt(jumpInput.value, 10);
        if (isReset || !jumpInput.value) {
            resetJumpState();
            return;
        }

        if (sortType === 'uniqueness') {
            const targetRank = targetValue;
            if (isNaN(targetRank) || targetRank < 1) {
                resetJumpState();
                return;
            }
            if (targetRank > allItems.length) {
                galleryContainer.innerHTML = `<p style="text-align: center; grid-column: 1 / -1;">Rank not found. The highest rank is ${allItems.length.toLocaleString('en-US')}.</p>`;

                return;
            }

            startIndexOffset = Math.max(0, targetRank - 1);

            renderView();
        } else {

            const targetWorksCount = targetValue;

            if (previousSortType === null) {
                previousSortType = sortType;
                previousSortDirection = sortDirection;
            }

            let contextItems = itemsSortedByWorks;
            if (currentView === 'favorites') {
                contextItems = itemsSortedByWorks.filter(item => favorites.has(item.id));
            }

            const foundIndex = contextItems.findIndex(item => item.worksCount <= targetWorksCount);

            if (foundIndex === -1) {
                showToast('No artists found with that many works or less.');
                return;
            }

            searchInput.value = '';
            searchTerm = '';
            updateControlsState();

            startIndexOffset = foundIndex;

            sortType = 'works';
            sortDirection = 'desc';
            renderView();
        }

        if (window.innerWidth <= 992) {
            jumpInput.blur();
        }
    }

    function resetJumpState(shouldRender = true) {
        startIndexOffset = 0;

        if (sortType === 'uniqueness') {
            previousSortType = null;
        }

        if (previousSortType !== null) {
            sortType = previousSortType;
            sortDirection = previousSortDirection;
            previousSortType = null;
            previousSortDirection = null;
        }

        updateSortButtonsUI();
        updateControlsState();

        jumpInput.value = '';
        if (shouldRender) {
            renderView();
        }

        if (!jumpInput.value) {
            clearJumpBtn.style.display = 'none';
        }
    }

    jumpInput.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            return;
        }
        if (e.key === 'Enter') {
            clearTimeout(jumpTimeout);
            handleJump();
        }
    });

    jumpInput.addEventListener('input', () => {

        if (jumpInput.value) {
            clearJumpBtn.style.display = 'flex';
        } else {

            resetJumpState();
        }

        updateControlsState();

        clearTimeout(jumpTimeout);
        if (jumpInput.value.trim()) {
            jumpTimeout = setTimeout(() => handleJump(), 800);
        }
    });

    clearJumpBtn.addEventListener('click', () => resetJumpState());

    // Handle single-page application routing (e.g. #/artist/Name)
    function handleHashChange() {
        const hash = window.location.hash;

        if (hash.startsWith('#/artist/')) {

            if (viewArtist.classList.contains('hidden')) {
                lastGalleryScroll = window.scrollY;
            }

            const encodedArtistName = hash.replace('#/artist/', '');
            const artistName = decodeURIComponent(encodedArtistName);
            const artistItem = allItems.find(item => item.artist === artistName);

            if (artistItem) {
                renderArtistView(artistItem);
            } else {
                window.location.hash = '';
            }
        } else {

            viewArtist.classList.add('hidden');
            viewGallery.classList.remove('hidden');
            controlsContainerWrapper.style.display = '';

            if (hash === '#/favorites') {
                if (currentView !== 'favorites') tabFavorites.click();
            } else {
                if (currentView !== 'gallery') tabGallery.click();
            }

            if (lastGalleryScroll > 0) {
                setTimeout(() => {
                    window.scrollTo({ top: lastGalleryScroll, behavior: 'instant' });
                    lastGalleryScroll = 0;
                }, 50);
            }
        }
    }

    window.addEventListener('resize', () => {
        updateDetailsLayout();
    });

    function updateDetailsLayout() {
        if (viewArtist.classList.contains('hidden')) return;

        const isMobile = window.innerWidth <= 600;
        const infoPanel = detailsGrid.querySelector('.details-info-panel');

        if (isMobile) {

            detailsGrid.style.gridTemplateColumns = '';
            detailsGrid.style.display = '';
            detailsGrid.style.flexDirection = '';

            detailsHero.style.gridColumn = '1 / -1';
            detailsHero.style.gridRow = 'auto';
            detailsHero.style.paddingRight = '0';

            infoPanel.style.gridColumn = '1 / -1';
            infoPanel.style.gridRow = 'auto';
            infoPanel.style.maxWidth = 'none';
            infoPanel.style.padding = '16px 0';
        } else {

            detailsGrid.style.display = 'grid';
            detailsGrid.style.flexDirection = '';

            const gridComputedStyle = getComputedStyle(detailsGrid);
            const totalCols = gridComputedStyle.gridTemplateColumns.split(' ').length || 7;
            const gridWidth = detailsGrid.clientWidth;
            const gap = 2;
            const colWidth = (gridWidth - (totalCols - 1) * gap) / totalCols;

            const heroCols = 2;

            const cardVisualHeight = colWidth * (1216 / 832) + 30;
            const heroImageHeight = (heroCols * colWidth + (heroCols - 1) * gap) * (1216 / 832);
            const heroRows = Math.max(2, Math.ceil(heroImageHeight / (cardVisualHeight + gap)));

            detailsGrid.style.setProperty('--detail-hero-cols', heroCols);
            detailsGrid.style.setProperty('--detail-hero-rows', heroRows);
            detailsGrid.style.setProperty('--detail-info-cols', Math.min(3, Math.max(1, totalCols - heroCols)));

            detailsHero.style.gridColumn = '';
            detailsHero.style.gridRow = '';
            detailsHero.style.paddingRight = '16px';
            infoPanel.style.gridColumn = `${heroCols + 1} / -1`;
            infoPanel.style.gridRow = `1 / ${heroRows}`;
            infoPanel.style.maxWidth = '360px';
            infoPanel.style.padding = '4px 0';
        }
    }

    // Render the artist details page including hero image and similar artists
    function renderArtistView(item) {
        currentDetailsItem = item;
        detailsFocusedIndex = -1;

        viewGallery.classList.add('hidden');
        controlsContainerWrapper.style.display = 'none';
        viewArtist.classList.remove('hidden');

        detailsImage.src = item.image;
        detailsArtistName.textContent = item.artist;
        detailsWorksCount.textContent = item.worksCount.toLocaleString('en-US');

        updateDetailsFavoriteButton(item.id);

        let formattedName = item.artist.replace(/\\/g, '').replace(/ /g, '_');
        const linkTag = encodeURIComponent(formattedName);
        detailsDanbooruLink.href = `https://danbooru.donmai.us/posts?tags=${linkTag}`;
        detailsGelbooruLink.href = `https://gelbooru.com/index.php?page=post&s=list&tags=${linkTag}`;

        updateDetailsLayout();

        if (similarArtistsObserver) {
            similarArtistsObserver.disconnect();
        }

        const itemId = String(item.id);

        function renderSimilarArtistsBlock() {
            let hasData = false;

            if (window.similarArtistsCache && window.similarArtistsCache[itemId]) {
                hasData = true;
            }

            console.log('[DEBUG] similarData exists in cache:', hasData, '| itemId:', itemId);
            if (hasData) {

                const similarIds = window.similarArtistsCache[itemId];
                const idToItem = new Map(allItems.map(i => [String(i.id), i]));
                availableSimilarItems = similarIds
                    .map(id => idToItem.get(String(id)))
                    .filter(i => i != null);

            } else {
                availableSimilarItems = [];
            }

            const existingCards = detailsGrid.querySelectorAll('.card, #similar-observer-sentinel, .loading-spinner');
            existingCards.forEach(c => c.remove());

            isSimilarItemsLoading = false;
            loadMoreSimilarArtists(24);

            if (window.innerWidth > 600) {
                const gridComputedStyle = getComputedStyle(detailsGrid);
                const totalCols = gridComputedStyle.gridTemplateColumns.split(' ').length || 7;
                const heroCols = parseInt(detailsGrid.style.getPropertyValue('--detail-hero-cols') || '2', 10);
                const sideCardCount = totalCols - heroCols;

                const allCards = detailsGrid.querySelectorAll('.card');
                for (let i = 0; i < Math.min(sideCardCount, allCards.length); i++) {
                    allCards[i].classList.add('side-card');
                }
            }

            setupSimilarArtistsObserver();
        }

        window.handleSimilarData = function (loadedItemId, similarIds) {

            if (!window.similarArtistsCache) {
                window.similarArtistsCache = {};
            }
            window.similarArtistsCache[loadedItemId] = similarIds;

            const oldScript = document.getElementById(`similar-chunk-${loadedItemId}`);
            if (oldScript) {
                oldScript.remove();
            }

            if (!viewArtist.classList.contains('hidden') && currentDetailsItem && String(currentDetailsItem.id) === loadedItemId) {
                renderSimilarArtistsBlock();
            }
        };

        if (window.similarArtistsCache && window.similarArtistsCache[itemId]) {
            renderSimilarArtistsBlock();
        } else {

            availableSimilarItems = [];

            const existingCards = detailsGrid.querySelectorAll('.card, #similar-observer-sentinel, .loading-spinner');
            existingCards.forEach(c => c.remove());

            const spinner = document.createElement('div');
            spinner.className = 'loading-spinner';
            spinner.style.gridColumn = '1 / -1';
            spinner.style.padding = '40px';
            spinner.style.textAlign = 'center';
            spinner.style.fontSize = '1.2rem';
            spinner.style.color = 'var(--text-secondary)';
            spinner.textContent = 'Loading similar artists...';
            detailsGrid.appendChild(spinner);

            const scriptId = `similar-chunk-${itemId}`;
            if (!document.getElementById(scriptId)) {
                const script = document.createElement('script');
                script.id = scriptId;
                script.src = `app/similar/${itemId}.js`;
                script.onerror = () => {
                    spinner.textContent = 'No similar artists found.';

                    window.handleSimilarData(itemId, []);
                };
                document.body.appendChild(script);
            }
        }

        window.scrollTo({ top: 0, behavior: 'instant' });
    }

    function closeArtistDetails() {
        if (window.history.length > 1) {
            window.history.back();
        } else {
            window.location.hash = '';
        }
    }

    function updateDetailsFavoriteButton(itemId) {
        const isFavorited = favorites.has(itemId);
        if (isFavorited) {
            detailsFavoriteBtn.classList.add('active');
            detailsFavoriteBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                </svg>
                Unfavorite <span class="hotkey-hint">(F)</span>
            `;
            detailsFavoriteBtn.style.color = '#ff4b4b';
        } else {
            detailsFavoriteBtn.classList.remove('active');
            detailsFavoriteBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                </svg>
                Favorite <span class="hotkey-hint">(F)</span>
            `;
            detailsFavoriteBtn.style.color = '';
        }
    }

    // Lazy load similar artists into the details grid
    function loadMoreSimilarArtists(count) {
        if (isSimilarItemsLoading || availableSimilarItems.length === 0) return;
        isSimilarItemsLoading = true;

        const itemsToAdd = availableSimilarItems.splice(0, count);

        const oldSentinel = document.getElementById('similar-observer-sentinel');
        if (oldSentinel) oldSentinel.remove();

        itemsToAdd.forEach(item => {
            const card = createCard(item, true);
            detailsGrid.appendChild(card);
        });

        if (availableSimilarItems.length > 0) {
            const sentinel = document.createElement('div');
            sentinel.id = 'similar-observer-sentinel';
            sentinel.style.height = '10px';
            sentinel.style.gridColumn = '1 / -1';
            detailsGrid.appendChild(sentinel);

            if (similarArtistsObserver) {
                similarArtistsObserver.observe(sentinel);
            }
        }

        isSimilarItemsLoading = false;
    }

    function setupSimilarArtistsObserver() {
        const options = {
            root: null,
            rootMargin: '200px',
            threshold: 0
        };

        similarArtistsObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    loadMoreSimilarArtists(6);
                }
            });
        }, options);

        const sentinel = document.getElementById('similar-observer-sentinel');
        if (sentinel) {
            similarArtistsObserver.observe(sentinel);
        }
    }

    window.addEventListener('hashchange', handleHashChange);

    detailsBackBtn.addEventListener('click', closeArtistDetails);

    detailsCopyBtn.addEventListener('click', () => {
        if (currentDetailsItem) {
            navigator.clipboard.writeText('@' + currentDetailsItem.artist).then(() => {
                showToast('Artist name copied to clipboard!');
            });
        }
    });

    detailsFavoriteBtn.addEventListener('click', () => {
        if (currentDetailsItem) {

            const cards = document.querySelectorAll('.card');
            let mainFavBtn = null;
            cards.forEach(card => {
                if (card.dataset.id === String(currentDetailsItem.id)) {
                    mainFavBtn = card.querySelector('.favorite-button');
                }
            });

            if (mainFavBtn) {
                toggleFavorite(currentDetailsItem, mainFavBtn);
            } else {

                toggleFavorite(currentDetailsItem, document.createElement('button'));
            }

            updateDetailsFavoriteButton(currentDetailsItem.id);
        }
    });

    let hoveredItem = null;
    let isQuickLookOpen = false;
    let quickLookCurrentItem = null;

    document.addEventListener('mouseover', (e) => {
        const card = e.target.closest('.card');
        if (card && card.dataset.id && typeof allItems !== 'undefined') {
            const id = card.dataset.id;
            hoveredItem = allItems.find(item => String(item.id) === id);
        }
    });

    document.addEventListener('mouseout', (e) => {
        if (e.target.closest('.card')) {
            hoveredItem = null;
        }
    });

    function updateQuickLookFavUI() {
        if (!quickLookCurrentItem) return;
        const favBtn = document.getElementById('quicklook-fav-btn');
        const favText = document.getElementById('quicklook-fav-text');
        if (favBtn && favText) {
            const isFavorited = favorites.has(quickLookCurrentItem.id);
            favBtn.classList.toggle('active', isFavorited);
            favText.textContent = isFavorited ? 'Unfavorite' : 'Favorite';
        }
    }

    function openQuickLook(item) {
        if (!item) return;
        quickLookCurrentItem = item;
        const modal = document.getElementById('quicklook-modal');
        const img = document.getElementById('quicklook-image');
        const name = document.getElementById('quicklook-artist-name');

        if (modal && img && name) {
            img.src = item.image;
            name.textContent = item.artist;
            updateQuickLookFavUI();
            modal.classList.add('visible');
            isQuickLookOpen = true;
        }
    }

    function updateQuickLookItem(item) {
        if (!item) return;
        quickLookCurrentItem = item;
        const img = document.getElementById('quicklook-image');
        const name = document.getElementById('quicklook-artist-name');
        if (img && name) {
            img.src = item.image;
            name.textContent = item.artist;
            updateQuickLookFavUI();
        }
    }

    function closeQuickLook() {
        const modal = document.getElementById('quicklook-modal');
        if (modal) {
            modal.classList.remove('visible');
            isQuickLookOpen = false;
            quickLookCurrentItem = null;
        }
    }

    const quicklookCloseBtn = document.getElementById('quicklook-close-btn');
    if (quicklookCloseBtn) {
        quicklookCloseBtn.addEventListener('click', closeQuickLook);
    }
    const quicklookFavBtn = document.getElementById('quicklook-fav-btn');
    if (quicklookFavBtn) {
        quicklookFavBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (quickLookCurrentItem) {
                toggleFavorite(quickLookCurrentItem);
                updateQuickLookFavUI();
            }
        });
    }
    const quicklookCopyBtn = document.getElementById('quicklook-copy-btn');
    if (quicklookCopyBtn) {
        quicklookCopyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (quickLookCurrentItem) {
                navigator.clipboard.writeText(quickLookCurrentItem.artist).then(() => {
                    showToast(`Copied ${quickLookCurrentItem.artist} to clipboard`);
                });
            }
        });
    }
    const quicklookDetailsBtn = document.getElementById('quicklook-details-btn');
    if (quicklookDetailsBtn) {
        quicklookDetailsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (quickLookCurrentItem) {
                const artistToOpen = quickLookCurrentItem.artist;
                closeQuickLook();
                window.location.hash = `#/artist/${encodeURIComponent(artistToOpen)}`;
            }
        });
    }
    const quicklookModal = document.getElementById('quicklook-modal');
    if (quicklookModal) {
        quicklookModal.addEventListener('click', (e) => {
            if (e.target === quicklookModal || e.target.classList.contains('swipe-container')) {
                closeQuickLook();
            }
        });
    }

    document.addEventListener('keydown', (e) => {
        if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
            if (e.code === 'Escape') e.target.blur();
            return;
        }

        const isArtistView = window.location.hash.startsWith('#/artist/');

        if (isQuickLookOpen) {
            if (e.code === 'Space' || e.code === 'Escape') {
                e.preventDefault();
                closeQuickLook();
                return;
            }
            if (e.code === 'KeyF' && quickLookCurrentItem) {
                toggleFavorite(quickLookCurrentItem);
                return;
            }
            if (e.code === 'KeyC' && quickLookCurrentItem) {
                navigator.clipboard.writeText(quickLookCurrentItem.artist).then(() => {
                    showToast(`Copied ${quickLookCurrentItem.artist} to clipboard`);
                });
                return;
            }
            if (e.code === 'Enter' && quickLookCurrentItem) {
                const artistToOpen = quickLookCurrentItem.artist;
                closeQuickLook();
                window.location.hash = `#/artist/${encodeURIComponent(artistToOpen)}`;
                return;
            }
        }

        if (e.code === 'Space') {
            e.preventDefault();
            if (isQuickLookOpen) {
                closeQuickLook();
                return;
            }

            let targetItem = null;

            // 1st Priority: Keyboard selection
            if (isArtistView) {
                if (typeof detailsFocusedIndex !== 'undefined' && detailsFocusedIndex >= 0) {
                    const cards = detailsGrid.querySelectorAll('.card');
                    if (cards[detailsFocusedIndex]) {
                        const id = cards[detailsFocusedIndex].dataset.id;
                        targetItem = allItems.find(item => String(item.id) === id);
                    }
                }
            } else {
                if (typeof keyboardFocusedIndex !== 'undefined' && keyboardFocusedIndex >= 0 && currentItems && currentItems[keyboardFocusedIndex]) {
                    targetItem = currentItems[keyboardFocusedIndex];
                }
            }

            // 2nd Priority: Mouse hover
            if (!targetItem) {
                targetItem = hoveredItem;
            }

            // 3rd Priority: Hero artist (if on details page)
            if (!targetItem && isArtistView) {
                targetItem = currentDetailsItem;
            }

            if (targetItem) {
                openQuickLook(targetItem);
            }
            return;
        }

        if (e.code === 'Escape') {
            if (isQuickLookOpen) {
                closeQuickLook();
                return;
            }
            if (isArtistView) {
                closeArtistDetails();
            }
            return;
        }

        if (e.code === 'Slash') {
            e.preventDefault();
            searchInput.focus();
        }

        if (isArtistView) {
            if (e.code === 'KeyF' && currentDetailsItem) {
                const detailsFavBtn = document.getElementById('details-favorite-btn');
                if (detailsFavBtn) detailsFavBtn.click();
            }
            if (e.code === 'KeyC' && currentDetailsItem) {
                navigator.clipboard.writeText(currentDetailsItem.artist).then(() => {
                    showToast(`Copied ${currentDetailsItem.artist} to clipboard`);
                });
            }
        } else {
            // In gallery view, allow 'F' to like the currently keyboard-focused card
            if (e.code === 'KeyF' && typeof keyboardFocusedIndex !== 'undefined' && keyboardFocusedIndex >= 0 && currentItems && currentItems[keyboardFocusedIndex]) {
                const activeId = String(currentItems[keyboardFocusedIndex].id);
                const activeCard = galleryContainer.querySelector(`.card[data-id="${activeId}"]`);
                if (activeCard) {
                    const favBtn = activeCard.querySelector('.favorite-button');
                    if (favBtn) favBtn.click();
                }
            }
        }
    });

    // Update sorting buttons visually and sort direction state
    function updateSortButtonsUI() {

        [sortByNameBtn, sortByWorksBtn, sortByUniquenessBtn, sortByRandomBtn, sortByDateBtn].forEach(btn => {
            btn.classList.remove('active');
            const arrow = btn.querySelector('.sort-arrow');
            if (arrow) arrow.textContent = '';
        });

        updateControlsState();

        let activeBtn;
        if (sortType === 'name') {
            activeBtn = sortByNameBtn;
        } else if (sortType === 'works') {
            activeBtn = sortByWorksBtn;
        } else if (sortType === 'random') {
            activeBtn = sortByRandomBtn;
        } else if (sortType === 'date') {
            activeBtn = sortByDateBtn;
        } else {
            activeBtn = sortByUniquenessBtn;
        }

        const arrow = activeBtn.querySelector('.sort-arrow');
        activeBtn.classList.add('active');
        if (sortType !== 'random') {
            arrow.textContent = sortDirection === 'asc' ? '▲' : '▼';
        }
    }

    function handleSortClick(clickedType) {

        if (clickedType === 'uniqueness' && sortType !== 'uniqueness') {
            resetJumpState(false);

            if (searchInput.value !== '') {
                searchInput.value = '';
                searchTerm = '';
                clearSearchBtn.style.display = 'none';
            }
        }

        if (sortType === clickedType && clickedType !== 'random') {

            sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
        } else {

            sortType = clickedType;

            sortDirection = sortType === 'name' ? 'asc' : 'desc';
        }

        updateSortButtonsUI();

        clearTimeout(sortUpdateTimeout);
        sortUpdateTimeout = setTimeout(() => {
            localStorage.setItem(SORT_TYPE_KEY, sortType);
            localStorage.setItem(SORT_DIRECTION_KEY, sortDirection);
        }, 1000);

        startIndexOffset = 0;

        renderView();
    }

    sortByNameBtn.addEventListener('click', () => handleSortClick('name'));
    sortByWorksBtn.addEventListener('click', () => handleSortClick('works'));
    sortByUniquenessBtn.addEventListener('click', () => handleSortClick('uniqueness'));
    sortByRandomBtn.addEventListener('click', () => handleSortClick('random'));
    sortByDateBtn.addEventListener('click', () => handleSortClick('date'));

    let keyboardFocusedIndex = -1;

    function getGridColumnCount() {
        if (!galleryContainer.children.length) return 1;
        const computedStyle = window.getComputedStyle(galleryContainer);
        const gridCols = computedStyle.getPropertyValue('grid-template-columns');
        return gridCols.split(' ').length || 1;
    }

    function getFirstVisibleCardIndex() {
        if (!currentItems || !currentItems.length) return 0;
        const cards = galleryContainer.querySelectorAll('.card');
        for (let i = 0; i < cards.length; i++) {
            const rect = cards[i].getBoundingClientRect();
            if (rect.top >= 90 && rect.bottom <= (window.innerHeight || document.documentElement.clientHeight)) {
                const id = cards[i].dataset.id;
                const idx = currentItems.findIndex(item => String(item.id) === id);
                if (idx !== -1) return idx;
            }
        }
        if (cards.length > 0) {
            const id = cards[0].dataset.id;
            const idx = currentItems.findIndex(item => String(item.id) === id);
            if (idx !== -1) return idx;
        }
        return 0;
    }

    let detailsFocusedIndex = -1;

    function getDetailsGridColumnCount() {
        const computedStyle = window.getComputedStyle(detailsGrid);
        const gridCols = computedStyle.getPropertyValue('grid-template-columns');
        return gridCols.split(' ').length || 1;
    }

    function getFirstVisibleDetailsCardIndex(cards) {
        for (let i = 0; i < cards.length; i++) {
            const rect = cards[i].getBoundingClientRect();
            if (rect.top >= 0 && rect.bottom <= (window.innerHeight || document.documentElement.clientHeight)) {
                return i;
            }
        }
        return 0;
    }

    function ensureDetailsCardVisible(card) {
        if (!card) return;
        const rect = card.getBoundingClientRect();
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

        if (rect.top < 20) {
            window.scrollBy({ top: rect.top - 20, behavior: 'smooth' });
        } else if (rect.bottom > viewportHeight) {
            window.scrollBy({ top: rect.bottom - viewportHeight + 20, behavior: 'smooth' });
        }
    }

    let lastMouseX = -1;
    let lastMouseY = -1;
    document.addEventListener('mousemove', (e) => {
        // Ignore synthetic mousemove events triggered by scrolling
        if (e.clientX === lastMouseX && e.clientY === lastMouseY) return;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;

        if (keyboardFocusedIndex !== -1) {
            const cards = galleryContainer.querySelectorAll('.card');
            cards.forEach(c => c.classList.remove('keyboard-focus'));
            keyboardFocusedIndex = -1;
        }
        if (detailsFocusedIndex !== -1) {
            const cards = detailsGrid.querySelectorAll('.card');
            cards.forEach(c => c.classList.remove('keyboard-focus'));
            detailsFocusedIndex = -1;
        }
    });

    function scrollToFocusedItem() {
        if (keyboardFocusedIndex < 0 || !currentItems || !currentItems[keyboardFocusedIndex]) return;

        const gridComputed = window.getComputedStyle(galleryContainer);
        const columns = gridComputed.getPropertyValue('grid-template-columns').split(' ').length || 1;

        const containerWidth = galleryContainer.clientWidth - (columns - 1) * 2;
        const cardWidth = containerWidth / columns;
        const cardHeight = (cardWidth * (1216 / 832)) + 40;

        const itemRow = Math.floor(keyboardFocusedIndex / columns);
        const itemTop = galleryContainer.offsetTop + (itemRow * cardHeight);
        const itemBottom = itemTop + cardHeight;

        const headerHeight = 90;
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
        const currentScrollTop = window.scrollY;
        const currentScrollBottom = currentScrollTop + viewportHeight;

        let newScrollTop = currentScrollTop;

        if (itemTop < currentScrollTop + headerHeight) {
            newScrollTop = itemTop - headerHeight;
        } else if (itemBottom > currentScrollBottom) {
            newScrollTop = itemBottom - viewportHeight + 20;
        }

        if (Math.abs(newScrollTop - currentScrollTop) > 1) {
            window.scrollTo({ top: Math.max(0, newScrollTop), behavior: 'smooth' });
        }

        const activeId = String(currentItems[keyboardFocusedIndex].id);
        const cards = galleryContainer.querySelectorAll('.card');
        cards.forEach(c => c.classList.remove('keyboard-focus'));
        const activeCard = galleryContainer.querySelector(`.card[data-id="${activeId}"]`);
        if (activeCard) {
            activeCard.classList.add('keyboard-focus');
        }
    }

    function handleGridHotkeys(e) {
        if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

        if (e.ctrlKey || e.altKey || e.shiftKey || e.metaKey) return;

        const isArtistView = window.location.hash.startsWith('#/artist/');

        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
            e.preventDefault();

            if (isArtistView) {
                const cards = Array.from(detailsGrid.querySelectorAll('.card'));
                if (!cards.length) return;

                if (detailsFocusedIndex === -1 || !cards[detailsFocusedIndex]) {
                    detailsFocusedIndex = getFirstVisibleDetailsCardIndex(cards);
                } else {
                    cards[detailsFocusedIndex].classList.remove('keyboard-focus');
                    let cols = getDetailsGridColumnCount();

                    if (e.code === 'ArrowRight') detailsFocusedIndex++;
                    else if (e.code === 'ArrowLeft') detailsFocusedIndex--;
                    else if (e.code === 'ArrowDown') detailsFocusedIndex += cols;
                    else if (e.code === 'ArrowUp') detailsFocusedIndex -= cols;
                }

                if (detailsFocusedIndex < 0) detailsFocusedIndex = 0;
                if (detailsFocusedIndex >= cards.length) {
                    detailsFocusedIndex = cards.length - 1;
                    loadMoreSimilarArtists(6);
                }

                const targetCard = cards[detailsFocusedIndex];
                if (targetCard) {
                    targetCard.classList.add('keyboard-focus');
                    ensureDetailsCardVisible(targetCard);
                }

                if (isQuickLookOpen && cards[detailsFocusedIndex]) {
                    const id = cards[detailsFocusedIndex].dataset.id;
                    const activeItem = allItems.find(item => String(item.id) === id);
                    if (activeItem) updateQuickLookItem(activeItem);
                }
                return;
            } else {
                if (!currentItems || !currentItems.length) return;

                if (keyboardFocusedIndex === -1 || keyboardFocusedIndex >= currentItems.length) {
                    keyboardFocusedIndex = getFirstVisibleCardIndex();
                } else {
                    let cols = getGridColumnCount();
                    if (e.code === 'ArrowRight') keyboardFocusedIndex++;
                    else if (e.code === 'ArrowLeft') keyboardFocusedIndex--;
                    else if (e.code === 'ArrowDown') keyboardFocusedIndex += cols;
                    else if (e.code === 'ArrowUp') keyboardFocusedIndex -= cols;
                }

                if (keyboardFocusedIndex < 0) keyboardFocusedIndex = 0;
                if (keyboardFocusedIndex >= currentItems.length) {
                    keyboardFocusedIndex = currentItems.length - 1;
                }

                scrollToFocusedItem();

                if (isQuickLookOpen && currentItems[keyboardFocusedIndex]) {
                    updateQuickLookItem(currentItems[keyboardFocusedIndex]);
                }
                return;
            }
        }

        if (e.code === 'Enter') {
            if (isArtistView) {
                const cards = detailsGrid.querySelectorAll('.card');
                if (detailsFocusedIndex >= 0 && cards[detailsFocusedIndex]) {
                    const infoBtn = cards[detailsFocusedIndex].querySelector('.info-button');
                    if (infoBtn) infoBtn.click();
                    else cards[detailsFocusedIndex].click();
                }
            } else {
                if (keyboardFocusedIndex >= 0 && currentItems && currentItems[keyboardFocusedIndex]) {
                    const activeId = String(currentItems[keyboardFocusedIndex].id);
                    const activeCard = galleryContainer.querySelector(`.card[data-id="${activeId}"]`);
                    if (activeCard) {
                        const infoBtn = activeCard.querySelector('.info-button');
                        if (infoBtn) infoBtn.click();
                    }
                }
            }
            return;
        }

        const key = parseInt(e.key, 10);
        if (key >= 1 && key <= 5) {
            gridSlider.value = key;
            updateGridColumns(key);
            triggerGridSave(key);
        }
    }

    document.addEventListener('keydown', handleGridHotkeys);

    let gridUpdateTimeout;
    const GRID_COLUMN_KEY = 'gridColumnCount';

    function updateGridColumns(value) {

        const offset = 3 - value;
        document.documentElement.style.setProperty('--grid-offset', offset);
    }

    function triggerGridSave(value) {

        clearTimeout(gridUpdateTimeout);
        gridUpdateTimeout = setTimeout(() => {
            localStorage.setItem(GRID_COLUMN_KEY, value);

            setTimeout(checkAndLoadMoreIfContentDoesNotFillScreen, 100);
        }, 500);
    }

    gridSlider.addEventListener('input', (e) => {
        const value = e.target.value;
        updateGridColumns(value);
        triggerGridSave(value);
    });

    let savedSize = parseInt(localStorage.getItem(GRID_COLUMN_KEY) || '3', 10);

    if (savedSize < 1 || savedSize > 5) {
        savedSize = 3;
        localStorage.setItem(GRID_COLUMN_KEY, savedSize);
    }
    gridSlider.value = savedSize;
    updateGridColumns(savedSize);

    const savedSortType = localStorage.getItem(SORT_TYPE_KEY);
    const savedSortDirection = localStorage.getItem(SORT_DIRECTION_KEY);
    if (savedSortType && savedSortDirection) {
        sortType = savedSortType;
        sortDirection = savedSortDirection;
    }

    updateSortButtonsUI();

    initDB()
        .then(() => {
            loadInitialData().then(() => {

                handleHashChange();
            });
        })
        .catch(err => {
            console.error(err);
            galleryContainer.innerHTML = '<p style="text-align: center; grid-column: 1 / -1;">Failed to initialize database.</p>';
        });
});
