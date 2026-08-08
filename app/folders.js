document.addEventListener('DOMContentLoaded', () => {
    const FOLDERS_STORE_NAME = 'folders';
    const FOLDER_ARTISTS_STORE_NAME = 'folder_artists';

    const boardsContainer = document.getElementById('boards-container');
    const backToBoardsBtn = document.getElementById('back-to-boards-btn');
    const folderViewHeader = document.getElementById('folder-view-header');
    const folderViewTitle = document.getElementById('folder-view-title');
    const folderViewCount = document.getElementById('folder-view-count');
    const boardsCounter = document.getElementById('boards-counter');
    const boardModal = document.getElementById('board-selection-modal');
    const boardModalCloseBtn = document.getElementById('board-modal-close');
    const boardSelectionList = document.getElementById('board-selection-list');
    const newBoardInput = document.getElementById('new-board-input');
    const newBoardBtn = document.getElementById('new-board-btn');
    const boardSearchInput = document.getElementById('board-search-input');
    const newBoardBtnContainer = document.getElementById('new-board-btn-container');
    const createBoardLabelBox = document.getElementById('create-board-label-box');
    const createBoardInputBox = document.getElementById('create-board-input-box');
    
    const detailsSaveBtn = document.getElementById('details-save-board-btn');
    const quicklookSaveBtn = document.getElementById('quicklook-save-board-btn');

    const boardDropdown = document.getElementById('board-selection-dropdown');
    const boardOverlay = document.getElementById('board-selection-overlay');

    let folders = [];
    let folderArtists = new Map();
    let activeFolderId = null;
    let targetArtistIdForSave = null;
    let db;

    function initFolders() {
        db = window.appGlobals.db;
        if (!db) {
            console.error("Database not initialized for folders.");
            return Promise.resolve();
        }
        return loadDataAndRender();
    }

    async function loadDataAndRender() {
        await loadFolders();
        await loadFolderArtists();
        updateBoardsCounter();
        // If we are currently on the boards tab, render it immediately
        if (window.appGlobals.currentView === 'boards') {
            renderBoards();
        }
    }

    function loadFolders() {
        return new Promise(resolve => {
            const tx = db.transaction(FOLDERS_STORE_NAME, 'readonly');
            const store = tx.objectStore(FOLDERS_STORE_NAME);
            const req = store.getAll();
            req.onsuccess = () => {
                folders = req.result.sort((a, b) => a.name.localeCompare(b.name));
                resolve();
            };
        });
    }

    function loadFolderArtists() {
        return new Promise(resolve => {
            folderArtists.clear();
            const tx = db.transaction(FOLDER_ARTISTS_STORE_NAME, 'readonly');
            const store = tx.objectStore(FOLDER_ARTISTS_STORE_NAME);
            const req = store.getAll();
            req.onsuccess = () => {
                req.result.forEach(item => {
                    folderArtists.set(item.folderId, item.artistIds);
                });
                resolve();
            };
        });
    }

    function getUnsortedArtistIds() {
        const favorites = window.appGlobals.favorites || new Map();
        return new Set(Array.from(favorites.keys()).map(id => String(id)));
    }

    function updateBoardsCounter() {
        if (boardsCounter) {
            boardsCounter.textContent = folders.length.toLocaleString('en-US');
        }
    }

    function renderBoards(searchTerm = '', sortType = 'name', sortDirection = 'asc') {
        if (!boardsContainer) return;
        boardsContainer.innerHTML = '';

        const term = searchTerm.toLowerCase().trim();

        // 1. Favorites Board
        const unsortedSet = getUnsortedArtistIds();
        const unsortedCount = unsortedSet.size;
        
        let renderedCount = 0;

        if (!term || 'favorites'.includes(term) || 'unsorted'.includes(term)) {
            const unsortedIds = Array.from(unsortedSet);
            // sort by newest
            unsortedIds.sort((a, b) => (window.appGlobals.favorites.get(b) || 0) - (window.appGlobals.favorites.get(a) || 0));
            
            const unsortedEl = createBoardCard('unsorted', 'Favorites', unsortedCount, unsortedIds);
            boardsContainer.appendChild(unsortedEl);
            renderedCount++;
        }

        let sortedFolders = [...folders];
        if (sortType === 'name') {
            sortedFolders.sort((a, b) => {
                const cmp = a.name.localeCompare(b.name);
                return sortDirection === 'asc' ? cmp : -cmp;
            });
        } else if (sortType === 'date') {
            sortedFolders.sort((a, b) => {
                const cmp = a.created - b.created;
                return sortDirection === 'asc' ? cmp : -cmp;
            });
        } else if (sortType === 'works' || sortType === 'rank') {
            sortedFolders.sort((a, b) => {
                const countA = (folderArtists.get(a.id) || []).length;
                const countB = (folderArtists.get(b.id) || []).length;
                return sortDirection === 'asc' ? countA - countB : countB - countA;
            });
        }

        // 2. Custom Boards
        sortedFolders.forEach(folder => {
            if (term && !folder.name.toLowerCase().includes(term)) return;
            const items = folderArtists.get(folder.id) || [];
            // sort by newest
            const sortedItems = [...items].sort((a, b) => (b.added || 0) - (a.added || 0)).map(item => (item && typeof item === 'object' && item.id !== undefined) ? item.id : item);
            const folderEl = createBoardCard(folder.id, folder.name, items.length, sortedItems);
            boardsContainer.appendChild(folderEl);
            renderedCount++;
        });

        // 3. Empty State
        if (renderedCount === 0) {
            boardsContainer.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: var(--text-muted);">
                    <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity: 0.5; margin-bottom: 16px;">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="12" y1="8" x2="12" y2="16"></line>
                        <line x1="8" y1="12" x2="16" y2="12"></line>
                    </svg>
                    <h3 style="margin-bottom: 8px; color: var(--text);">No boards found</h3>
                    <p>Save an artist to a board to create your first one, or adjust your search.</p>
                </div>
            `;
        }
    }

    function getArtistImage(artistId) {
        const allItems = window.appGlobals.allItems || [];
        const artistData = allItems.find(item => String(item.id) === String(artistId));
        return artistData ? artistData.image : null;
    }

    function renameFolder(id, newName) {
        if (!newName || !newName.trim()) return;
        const name = newName.trim();
        const folder = folders.find(f => f.id === id);
        if (!folder) return;

        folder.name = name;
        folders.sort((a, b) => a.name.localeCompare(b.name));

        const tx = db.transaction(FOLDERS_STORE_NAME, 'readwrite');
        tx.objectStore(FOLDERS_STORE_NAME).put(folder);

        tx.oncomplete = () => {
            if (window.appGlobals.showToast) {
                window.appGlobals.showToast(`Renamed board to "${name}"`);
            }
            if (window.appGlobals.currentView === 'boards' || window.appGlobals.currentView === 'folder') {
                window.appGlobals.renderView();
            }
        };
    }

    function deleteFolder(id) {
        const folder = folders.find(f => f.id === id);
        const folderName = folder ? folder.name : 'Board';

        const idx = folders.findIndex(f => f.id === id);
        if (idx !== -1) folders.splice(idx, 1);
        folderArtists.delete(id);

        const tx = db.transaction([FOLDERS_STORE_NAME, FOLDER_ARTISTS_STORE_NAME], 'readwrite');
        tx.objectStore(FOLDERS_STORE_NAME).delete(id);
        tx.objectStore(FOLDER_ARTISTS_STORE_NAME).delete(id);

        tx.oncomplete = () => {
            updateBoardsCounter();
            if (window.appGlobals.showToast) {
                window.appGlobals.showToast(`Deleted board "${folderName}"`);
            }
            window.location.hash = '#/boards';
            window.appGlobals.currentView = 'boards';
            const renameBtn = document.getElementById('rename-board-btn');
            const deleteBtn = document.getElementById('delete-board-btn');
            if (renameBtn) renameBtn.style.display = 'none';
            if (deleteBtn) deleteBtn.style.display = 'none';
            if (backToBoardsBtn) backToBoardsBtn.style.display = 'none';
            if (folderViewHeader) folderViewHeader.classList.add('hidden');
            activeFolderId = null;
            window.appGlobals.renderView();
        };
    }

    function showCustomRenameModal(id, currentName) {
        const modal = document.getElementById('custom-board-modal');
        const title = document.getElementById('custom-modal-title');
        const desc = document.getElementById('custom-modal-desc');
        const input = document.getElementById('custom-modal-input');
        const cancelBtn = document.getElementById('custom-modal-cancel');
        const confirmBtn = document.getElementById('custom-modal-confirm');

        if (!modal) return;
        title.textContent = 'Rename Board';
        desc.style.display = 'none';
        input.style.display = 'block';
        input.value = currentName || '';
        confirmBtn.textContent = 'Save';

        modal.classList.remove('hidden');
        modal.style.display = 'flex';
        input.focus();
        input.select();

        const close = () => {
            modal.style.display = 'none';
            cleanup();
        };

        const onConfirm = () => {
            const val = input.value.trim();
            if (val) {
                renameFolder(id, val);
            }
            close();
        };

        const onKeyDown = (e) => {
            if (e.key === 'Enter') onConfirm();
            if (e.key === 'Escape') close();
        };

        const cleanup = () => {
            cancelBtn.removeEventListener('click', close);
            confirmBtn.removeEventListener('click', onConfirm);
            input.removeEventListener('keydown', onKeyDown);
        };

        cancelBtn.addEventListener('click', close);
        confirmBtn.addEventListener('click', onConfirm);
        input.addEventListener('keydown', onKeyDown);
    }

    function showCustomDeleteModal(id, folderName) {
        const modal = document.getElementById('custom-board-modal');
        const title = document.getElementById('custom-modal-title');
        const desc = document.getElementById('custom-modal-desc');
        const input = document.getElementById('custom-modal-input');
        const cancelBtn = document.getElementById('custom-modal-cancel');
        const confirmBtn = document.getElementById('custom-modal-confirm');

        if (!modal) return;
        title.textContent = 'Delete Board';
        desc.textContent = `Are you sure you want to delete "${folderName}"? All saved styles in this board will remain in your explorer.`;
        desc.style.display = 'block';
        input.style.display = 'none';
        confirmBtn.textContent = 'Delete';
        confirmBtn.className = 'site-modal-btn danger';
        cancelBtn.className = 'site-modal-btn';

        modal.style.display = 'flex';

        const close = () => {
            modal.style.display = 'none';
            cleanup();
        };

        const onConfirm = () => {
            deleteFolder(id);
            close();
        };

        const onKeyDown = (e) => {
            if (e.key === 'Escape') close();
        };

        const cleanup = () => {
            cancelBtn.removeEventListener('click', close);
            confirmBtn.removeEventListener('click', onConfirm);
            window.removeEventListener('keydown', onKeyDown);
        };

        cancelBtn.addEventListener('click', close);
        confirmBtn.addEventListener('click', onConfirm);
        window.addEventListener('keydown', onKeyDown);
    }

    function createBoardCard(id, name, count, artistIds) {
        const card = document.createElement('div');
        card.className = 'board-card';
        card.style.position = 'relative';

        card.addEventListener('click', () => {
            openFolderView(id);
        });

        if (id !== 'unsorted') {
            const menuBtn = document.createElement('button');
            menuBtn.className = 'board-card-menu-btn';
            menuBtn.innerHTML = '&#8942;'; // Vertical ellipsis
            menuBtn.title = 'Board Options';

            menuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                
                const existingPopover = document.getElementById('active-card-popover');
                if (existingPopover) existingPopover.remove();

                const popover = document.createElement('div');
                popover.id = 'active-card-popover';
                popover.className = 'site-popover-menu';

                const renameOpt = document.createElement('div');
                renameOpt.className = 'site-popover-item';
                renameOpt.textContent = 'Rename';
                renameOpt.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    popover.remove();
                    showCustomRenameModal(id, name);
                });

                const deleteOpt = document.createElement('div');
                deleteOpt.className = 'site-popover-item danger';
                deleteOpt.textContent = 'Delete';
                deleteOpt.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    popover.remove();
                    showCustomDeleteModal(id, name);
                });

                popover.appendChild(renameOpt);
                popover.appendChild(deleteOpt);
                card.appendChild(popover);

                const closePopover = (ev) => {
                    if (!popover.contains(ev.target)) {
                        popover.remove();
                        document.removeEventListener('click', closePopover);
                    }
                };
                setTimeout(() => document.addEventListener('click', closePopover), 0);
            });
            card.appendChild(menuBtn);
        }

        // Get up to 3 images for the card stack
        const images = [];
        for (let i = 0; i < artistIds.length; i++) {
            if (images.length >= 3) break;
            const img = getArtistImage(artistIds[i]);
            if (img) images.push(img);
        }

        const collage = document.createElement('div');
        collage.className = `board-collage board-collage-stack-${images.length}`;

        if (images.length === 0) {
            collage.innerHTML = '<span>Empty</span>';
        } else if (images.length === 1) {
            const img = document.createElement('img');
            img.src = images[0];
            img.className = 'stack-img stack-img-center';
            img.decoding = 'async';
            collage.appendChild(img);
        } else if (images.length === 2) {
            const imgBack = document.createElement('img');
            imgBack.src = images[1];
            imgBack.className = 'stack-img stack-img-right-fan';
            imgBack.decoding = 'async';
            collage.appendChild(imgBack);

            const imgFront = document.createElement('img');
            imgFront.src = images[0];
            imgFront.className = 'stack-img stack-img-left-fan';
            imgFront.decoding = 'async';
            collage.appendChild(imgFront);
        } else {
            const imgLeft = document.createElement('img');
            imgLeft.src = images[1];
            imgLeft.className = 'stack-img stack-img-left';
            imgLeft.decoding = 'async';
            collage.appendChild(imgLeft);

            const imgRight = document.createElement('img');
            imgRight.src = images[2];
            imgRight.className = 'stack-img stack-img-right';
            imgRight.decoding = 'async';
            collage.appendChild(imgRight);

            const imgCenter = document.createElement('img');
            imgCenter.src = images[0];
            imgCenter.className = 'stack-img stack-img-center';
            imgCenter.decoding = 'async';
            collage.appendChild(imgCenter);
        }

        card.appendChild(collage);

        const title = document.createElement('div');
        title.className = 'board-title';
        title.textContent = name;
        card.appendChild(title);

        const meta = document.createElement('div');
        meta.className = 'board-meta';
        meta.textContent = `${count} style${count !== 1 ? 's' : ''}`;
        card.appendChild(meta);

        return card;
    }

    function openFolderView(id) {
        activeFolderId = id;
        window.appGlobals.currentView = 'folder';
        window.location.hash = '#/folder/' + id;
        
        const txtExportContainer = document.getElementById('txt-export-container');
        const favoritesControlsWrapper = document.getElementById('favorites-controls-wrapper');
        const tabBoards = document.getElementById('tab-boards');
        const renameBtn = document.getElementById('rename-board-btn');
        const deleteBtn = document.getElementById('delete-board-btn');
        
        if (txtExportContainer) txtExportContainer.style.display = 'flex';
        if (favoritesControlsWrapper) favoritesControlsWrapper.style.display = 'flex';
        if (folderViewHeader) folderViewHeader.classList.remove('hidden');
        if (folderViewTitle) folderViewTitle.textContent = id === 'unsorted'
            ? 'Favorites'
            : (folders.find(folder => folder.id === id)?.name || 'Board');
        if (folderViewCount) {
            const count = id === 'unsorted'
                ? getUnsortedArtistIds().size
                : (folderArtists.get(id) || []).length;
            folderViewCount.textContent = `${count} ${count === 1 ? 'style' : 'styles'}`;
        }
        if (backToBoardsBtn) backToBoardsBtn.style.display = 'inline-flex';
        if (renameBtn) renameBtn.style.display = id === 'unsorted' ? 'none' : 'inline-block';
        if (deleteBtn) deleteBtn.style.display = id === 'unsorted' ? 'none' : 'inline-block';
        if (tabBoards && window.appGlobals.setActiveTab) window.appGlobals.setActiveTab(tabBoards);
        
        window.appGlobals.renderView();
    }

    function closeFolderView() {
        activeFolderId = null;
        if (folderViewHeader) folderViewHeader.classList.add('hidden');
        if (backToBoardsBtn) backToBoardsBtn.style.display = 'none';
        if (renameBoardBtn) renameBoardBtn.style.display = 'none';
        if (deleteBoardBtn) deleteBoardBtn.style.display = 'none';
    }

    function getActiveFolderItemIds() {
        if (activeFolderId === 'unsorted') {
            return getUnsortedArtistIds();
        }
        const items = folderArtists.get(activeFolderId) || [];
        const set = new Set();
        items.forEach(item => {
            const idVal = (item && typeof item === 'object' && item.id !== undefined) ? item.id : item;
            if (idVal !== undefined && idVal !== null) {
                set.add(idVal);
                set.add(String(idVal));
                if (!isNaN(idVal)) set.add(Number(idVal));
            }
        });
        return set;
    }

    // Dropdown logic
    function showBoardSelectionDropdown(artistId, buttonElement) {
        if (!boardDropdown || !boardOverlay) return;
        targetArtistIdForSave = artistId;
        
        // Compute position
        const rect = buttonElement.getBoundingClientRect();
        boardDropdown.style.top = (rect.bottom + 8) + 'px';
        
        // align right or left depending on space
        if (rect.left + 260 > window.innerWidth) {
            boardDropdown.style.left = Math.max(10, rect.right - 260) + 'px';
        } else {
            boardDropdown.style.left = rect.left + 'px';
        }
        
        boardDropdown.classList.remove('hidden');
        boardOverlay.style.display = 'block';
        
        renderBoardSelectionList('');
        if (boardSearchInput) boardSearchInput.value = '';
        hideCreateInput();
    }

    function closeBoardDropdown() {
        if (boardDropdown) boardDropdown.classList.add('hidden');
        if (boardOverlay) boardOverlay.style.display = 'none';
        targetArtistIdForSave = null;
    }

    if (boardOverlay) {
        boardOverlay.addEventListener('click', closeBoardDropdown);
    }

    if (boardSearchInput) {
        boardSearchInput.addEventListener('input', (e) => {
            renderBoardSelectionList(e.target.value);
            if (e.target.value.trim() !== '') {
                showCreateInput(e.target.value.trim());
            } else {
                hideCreateInput();
            }
        });
    }

    function showCreateInput(val = '') {
        if (createBoardLabelBox) createBoardLabelBox.style.display = 'none';
        if (createBoardInputBox) createBoardInputBox.classList.remove('hidden');
        if (newBoardInput) {
            newBoardInput.value = val;
            newBoardInput.focus();
        }
    }

    function hideCreateInput() {
        if (createBoardLabelBox) createBoardLabelBox.style.display = 'flex';
        if (createBoardInputBox) createBoardInputBox.classList.add('hidden');
    }

    if (newBoardBtnContainer) {
        newBoardBtnContainer.addEventListener('click', (e) => {
            if (e.target === newBoardBtn || e.target === newBoardInput) return;
            showCreateInput(boardSearchInput ? boardSearchInput.value : '');
        });
    }

    function renderBoardSelectionList(searchTerm = '') {
        if (!boardSelectionList) return;
        boardSelectionList.innerHTML = '';
        const term = searchTerm.toLowerCase().trim();

        if (!term || 'favorites'.includes(term) || 'unsorted'.includes(term)) {
            // Favorites (remove from folder)
            const unsortedCard = createModalBoardCard('unsorted', 'Favorites');
            boardSelectionList.appendChild(unsortedCard);
        }

        folders.forEach(folder => {
            if (term && !folder.name.toLowerCase().includes(term)) return;
            const card = createModalBoardCard(folder.id, folder.name);
            boardSelectionList.appendChild(card);
        });
    }

    function createModalBoardCard(id, name) {
        const card = document.createElement('div');
        card.style.cursor = 'pointer';
        card.style.display = 'flex';
        card.style.alignItems = 'center';
        card.style.padding = '8px 12px';
        card.style.borderRadius = '4px';
        card.style.transition = 'background 0.2s';
        
        card.addEventListener('mouseover', () => card.style.background = 'rgba(255,255,255,0.1)');
        card.addEventListener('mouseout', () => card.style.background = 'transparent');
        
        // Match Pinterest style by adding a small image/icon
        const items = id === 'unsorted' ? [] : (folderArtists.get(id) || []);
        const firstArtistId = items.length > 0 ? items[items.length - 1].id : null;
        let imgSrc = null;
        if (firstArtistId) imgSrc = getArtistImage(firstArtistId);

        const imgDiv = document.createElement('div');
        imgDiv.style.width = '36px';
        imgDiv.style.height = '36px';
        imgDiv.style.marginRight = '12px';
        imgDiv.style.borderRadius = '6px';
        imgDiv.style.overflow = 'hidden';
        imgDiv.style.display = 'flex';
        imgDiv.style.alignItems = 'center';
        imgDiv.style.justifyContent = 'center';
        imgDiv.style.background = 'rgba(255,255,255,0.05)';
        
        if (imgSrc) {
            const img = document.createElement('img');
            img.src = imgSrc;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            imgDiv.appendChild(img);
        } else {
            imgDiv.innerHTML = '<span style="color: var(--text-muted); font-size: 10px;">Empty</span>';
        }
        card.appendChild(imgDiv);

        const title = document.createElement('div');
        title.style.fontWeight = '500';
        title.style.fontSize = '14px';
        title.style.flex = '1';
        title.textContent = name;
        card.appendChild(title);

        const isSaved = id !== 'unsorted' && items.some(i => String(i.id) === String(targetArtistIdForSave));
        if (isSaved) {
            const checkIcon = document.createElement('div');
            checkIcon.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--text)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
            card.appendChild(checkIcon);
        }

        card.addEventListener('click', () => {
            if (targetArtistIdForSave) {
                if (id === 'unsorted') {
                    removeArtistFromAllFolders(targetArtistIdForSave);
                } else {
                    if (isSaved) {
                        removeArtistFromFolder(id, targetArtistIdForSave);
                    } else {
                        addArtistToFolder(id, targetArtistIdForSave);
                    }
                }
                closeBoardDropdown();
            }
        });

        return card;
    }

    function addArtistToFolder(folderId, artistId) {
        const tx = db.transaction(FOLDER_ARTISTS_STORE_NAME, 'readwrite');
        const folderArtistsStore = tx.objectStore(FOLDER_ARTISTS_STORE_NAME);

        // Add to new folder
        const items = folderArtists.get(folderId) || [];
        if (!items.some(i => String(i.id) === String(artistId))) {
            items.push({ id: artistId, added: Date.now() });
            folderArtists.set(folderId, items);
            folderArtistsStore.put({ folderId, artistIds: items });
        }
        
        tx.oncomplete = () => {
            if (window.appGlobals.currentView === 'boards' || window.appGlobals.currentView === 'folder') {
                window.appGlobals.renderView();
            }
            updateBoardsCounter();
            
            // Show toast notification
            const folder = folders.find(f => f.id === folderId);
            const artistItem = window.appGlobals.allItems.find(a => String(a.id) === String(artistId));
            const artistName = artistItem ? artistItem.artist : 'Artist';
            if (folder && window.appGlobals.showToast) {
                window.appGlobals.showToast(`Saved ${artistName} to ${folder.name}`);
            }
        };
    }

    function createFolder(name) {
        const id = 'folder_' + Date.now();
        const newFolder = { id, name, created: Date.now() };
        
        folders.push(newFolder);
        folders.sort((a, b) => a.name.localeCompare(b.name));
        
        const stores = [FOLDERS_STORE_NAME];
        if (targetArtistIdForSave) {
            stores.push(FOLDER_ARTISTS_STORE_NAME);
        }
        
        const tx = db.transaction(stores, 'readwrite');
        tx.objectStore(FOLDERS_STORE_NAME).put(newFolder);
        
        if (targetArtistIdForSave) {
            const folderArtistsStore = tx.objectStore(FOLDER_ARTISTS_STORE_NAME);
            const items = [{ id: targetArtistIdForSave, added: Date.now() }];
            folderArtists.set(id, items);
            folderArtistsStore.put({ folderId: id, artistIds: items });
            
            closeBoardDropdown();
        }
        
        tx.oncomplete = () => {
            updateBoardsCounter();
            if (window.appGlobals.currentView === 'boards' || window.appGlobals.currentView === 'folder') {
                window.appGlobals.renderView();
            }
            if (targetArtistIdForSave && window.appGlobals.showToast) {
                const artistItem = window.appGlobals.allItems.find(a => String(a.id) === String(targetArtistIdForSave));
                const artistName = artistItem ? artistItem.artist : 'Artist';
                window.appGlobals.showToast(`Saved ${artistName} to ${name}`);
            }
        };
        
        return id;
    }

    if (newBoardBtn) {
        newBoardBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const name = newBoardInput.value.trim();
            if (name) {
                createFolder(name);
            }
        });
    }

    function removeArtistFromAllFolders(artistId) {
        let changed = false;
        let folderName = '';
        const tx = db.transaction(FOLDER_ARTISTS_STORE_NAME, 'readwrite');
        const store = tx.objectStore(FOLDER_ARTISTS_STORE_NAME);
        
        for (const [folderId, items] of folderArtists.entries()) {
            const idx = items.findIndex(item => item.id === artistId);
            if (idx !== -1) {
                items.splice(idx, 1);
                store.put({ folderId, artistIds: items });
                changed = true;
                const f = folders.find(f => f.id === folderId);
                if (f) folderName = f.name;
            }
        }

        tx.oncomplete = () => {
            if (changed) {
                const artistItem = window.appGlobals.allItems.find(a => String(a.id) === String(artistId));
                const artistName = artistItem ? artistItem.artist : 'Artist';
                window.appGlobals.showToast(`Removed ${artistName} from ${folderName || 'board'}`);
                if (window.appGlobals.currentView === 'folder' || window.appGlobals.currentView === 'boards') {
                    window.appGlobals.renderView();
                }
            }
        };
    }

    function removeArtistFromFolder(folderId, artistId) {
        const tx = db.transaction(FOLDER_ARTISTS_STORE_NAME, 'readwrite');
        const folderArtistsStore = tx.objectStore(FOLDER_ARTISTS_STORE_NAME);

        const items = folderArtists.get(folderId) || [];
        const idx = items.findIndex(i => i.id === artistId);
        if (idx !== -1) {
            items.splice(idx, 1);
            folderArtists.set(folderId, items);
            folderArtistsStore.put({ folderId, artistIds: items });
        }
        
        tx.oncomplete = () => {
            if (window.appGlobals.currentView === 'boards' || window.appGlobals.currentView === 'folder') {
                window.appGlobals.renderView();
            }
            updateBoardsCounter();
            
            const folder = folders.find(f => f.id === folderId);
            const artistItem = window.appGlobals.allItems.find(a => String(a.id) === String(artistId));
            const artistName = artistItem ? artistItem.artist : 'Artist';
            if (folder && window.appGlobals.showToast) {
                window.appGlobals.showToast(`Removed ${artistName} from ${folder.name}`);
            }
        };
    }

    if (detailsSaveBtn) {
        detailsSaveBtn.addEventListener('click', (e) => {
            const hash = window.location.hash;
            if (hash.startsWith('#/artist/')) {
                const encodedArtistName = hash.replace('#/artist/', '');
                const artistName = decodeURIComponent(encodedArtistName);
                const allItems = window.appGlobals.allItems || [];
                const artistItem = allItems.find(item => item.artist === artistName);
                if (artistItem) {
                    showBoardSelectionDropdown(artistItem.id, detailsSaveBtn);
                }
            }
        });
    }

    if (quicklookSaveBtn) {
        quicklookSaveBtn.addEventListener('click', (e) => {
            const nameEl = document.getElementById('quicklook-artist-name');
            if (nameEl) {
                const artistName = nameEl.textContent;
                const allItems = window.appGlobals.allItems || [];
                const artistItem = allItems.find(item => item.artist === artistName);
                if (artistItem) {
                    showBoardSelectionDropdown(artistItem.id, quicklookSaveBtn);
                }
            }
        });
    }

    const renameBoardBtn = document.getElementById('rename-board-btn');
    const deleteBoardBtn = document.getElementById('delete-board-btn');

    if (renameBoardBtn) {
        renameBoardBtn.addEventListener('click', () => {
            if (!activeFolderId || activeFolderId === 'unsorted') return;
            const folder = folders.find(f => f.id === activeFolderId);
            const currentName = folder ? folder.name : '';
            showCustomRenameModal(activeFolderId, currentName);
        });
    }

    if (deleteBoardBtn) {
        deleteBoardBtn.addEventListener('click', () => {
            if (!activeFolderId || activeFolderId === 'unsorted') return;
            const folder = folders.find(f => f.id === activeFolderId);
            const name = folder ? folder.name : 'this board';
            showCustomDeleteModal(activeFolderId, name);
        });
    }

    backToBoardsBtn.addEventListener('click', () => {
        window.location.hash = '#/boards';
        if (folderViewHeader) folderViewHeader.classList.add('hidden');
        if (renameBoardBtn) renameBoardBtn.style.display = 'none';
        if (deleteBoardBtn) deleteBoardBtn.style.display = 'none';
        activeFolderId = null;
    });

    window.foldersAPI = {
        initFolders,
        renderBoards,
        getActiveFolderItemIds,
        getActiveFolderId: () => activeFolderId,
        getFolderName: (id) => {
            if (id === 'unsorted') return 'Favorites';
            const f = folders.find(item => item.id === id);
            return f ? f.name : 'Board';
        },
        openFolderView: (id) => {
            window.appGlobals.currentView = 'folder';
            openFolderView(id);
        },
        closeFolderView,
        getAllFolders: () => folders,
        getFolderArtists: () => folderArtists
    };
});
