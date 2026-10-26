(function () {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const state = {
    unlocked: false,
    currentAlbumId: null, // null = albums list, 'all' or album id
    selectMode: false,
    selected: new Set(),
    mediaList: [],
    albums: [],
    viewerIndex: 0,
    patternSetupStep: 0, // 0: first draw, 1: confirm
    tempPattern: null,
  };

  let patternLock = null;
  let setupLock = null;

  // ========== Init ==========
  async function init() {
    await db.open();
    updateUITexts();

    // Ensure default "All Photos" concept (we use albumId 'all' virtually)
    const hasPattern = await db.getMeta('pattern');
    if (!hasPattern) {
      showSetup();
    } else {
      showLock();
    }

    bindEvents();
  }

  function showSetup() {
    $('#setup-screen').classList.remove('hidden');
    $('#lock-screen').classList.add('hidden');
    $('#app').classList.add('hidden');
    $('#setup-hint').textContent = t('drawPattern');
    setupLock = new PatternLock('#setup-pattern-container', {
      onComplete: onSetupPattern
    });
  }

  function showLock() {
    $('#lock-screen').classList.remove('hidden');
    $('#setup-screen').classList.add('hidden');
    $('#app').classList.add('hidden');
    $('#lock-title').textContent = t('enterPattern');
    $('#lock-hint').textContent = currentLang === 'zh' ? '请在下方九个点上滑动绘制图案' : 'Draw the pattern on the dots below';
    if (patternLock) patternLock.destroy();
    patternLock = new PatternLock('#pattern-container', {
      onComplete: onUnlockPattern
    });
  }

  async function onSetupPattern(pattern) {
    if (pattern.length < 4) {
      $('#setup-hint').textContent = t('patternTooShort');
      setupLock.showError();
      setTimeout(() => {
        setupLock.clear();
        $('#setup-hint').textContent = t('drawPattern');
      }, 800);
      return;
    }

    if (state.patternSetupStep === 0) {
      state.tempPattern = pattern.join('-');
      state.patternSetupStep = 1;
      $('#setup-hint').textContent = t('confirmPattern');
      setupLock.showSuccess();
      setTimeout(() => {
        setupLock.clear();
      }, 400);
    } else {
      const confirm = pattern.join('-');
      if (confirm === state.tempPattern) {
        await db.setMeta('pattern', confirm);
        setupLock.showSuccess();
        toast(t('patternSet'));
        setTimeout(() => {
          $('#setup-screen').classList.add('hidden');
          enterApp();
        }, 600);
      } else {
        $('#setup-hint').textContent = t('patternMismatch');
        setupLock.showError();
        state.patternSetupStep = 0;
        state.tempPattern = null;
        setTimeout(() => {
          setupLock.clear();
          $('#setup-hint').textContent = t('drawPattern');
        }, 800);
      }
    }
  }

  async function onUnlockPattern(pattern) {
    const saved = await db.getMeta('pattern');
    if (pattern.join('-') === saved) {
      patternLock.showSuccess();
      setTimeout(() => {
        $('#lock-screen').classList.add('hidden');
        enterApp();
      }, 300);
    } else {
      $('#lock-hint').textContent = t('wrongPattern');
      patternLock.showError();
      setTimeout(() => {
        patternLock.clear();
        $('#lock-hint').textContent = '';
      }, 700);
    }
  }

  async function enterApp() {
    state.unlocked = true;
    $('#app').classList.remove('hidden');
    await loadAlbums();
    showAlbumsView();
  }

  // ========== Albums ==========
  async function loadAlbums() {
    state.albums = await db.getAllAlbums();
    renderAlbums();
  }

  function renderAlbums() {
    const grid = $('#albums-grid');
    grid.innerHTML = '';

    // All Photos card
    const allCard = createAlbumCard({
      id: 'all',
      name: t('allPhotos'),
      isVirtual: true
    });
    grid.appendChild(allCard);

    state.albums.forEach(album => {
      grid.appendChild(createAlbumCard(album));
    });
  }

  function createAlbumCard(album) {
    const card = document.createElement('div');
    card.className = 'album-card';
    card.dataset.id = album.id;

    const coverWrap = document.createElement('div');
    coverWrap.className = 'album-cover placeholder';
    coverWrap.textContent = '📷';

    // Load cover async
    (async () => {
      const coverMedia = await db.getCover(album.id === 'all' ? 'all' : album.id);
      if (coverMedia && coverMedia.thumb) {
        const img = document.createElement('img');
        img.className = 'album-cover';
        img.src = URL.createObjectURL(coverMedia.thumb);
        // ObjectURLs cleaned on unload; fine for typical album sizes
        coverWrap.replaceWith(img);
      }
    })();

    const info = document.createElement('div');
    info.className = 'album-info';
    const name = document.createElement('div');
    name.className = 'album-name';
    name.textContent = album.name || t('allPhotos');
    const count = document.createElement('div');
    count.className = 'album-count';
    count.textContent = '...';

    db.countMedia(album.id === 'all' ? 'all' : album.id).then(c => {
      count.textContent = `${c} ${t('items')}`;
    });

    info.appendChild(name);
    info.appendChild(count);
    card.appendChild(coverWrap);
    card.appendChild(info);

    card.addEventListener('click', () => openAlbum(album.id));

    // Long press to delete album (not for virtual "all")
    if (album.id !== 'all') {
      let pressTimer = null;
      const startPress = (e) => {
        pressTimer = setTimeout(async () => {
          pressTimer = null;
          const ok = confirm(
            (currentLang === 'zh' ? '确定删除相册「' : 'Delete album "') +
            (album.name || '') +
            (currentLang === 'zh' ? '」？\n相册内的照片/视频也会被删除。' : '"?\nMedia inside will also be deleted.')
          );
          if (!ok) return;
          try {
            // Delete all media in this album first
            const mediaList = await db.getMediaByAlbum(album.id);
            if (mediaList.length) {
              await db.deleteMedia(mediaList.map(m => m.id));
            }
            await db.deleteAlbum(album.id);
            toast(currentLang === 'zh' ? '相册已删除' : 'Album deleted');
            await loadAlbums();
          } catch (err) {
            console.error(err);
            toast(currentLang === 'zh' ? '删除失败' : 'Delete failed');
          }
        }, 600);
      };
      const cancelPress = () => {
        if (pressTimer) {
          clearTimeout(pressTimer);
          pressTimer = null;
        }
      };
      card.addEventListener('touchstart', startPress, { passive: true });
      card.addEventListener('touchend', cancelPress);
      card.addEventListener('touchmove', cancelPress);
      card.addEventListener('mousedown', startPress);
      card.addEventListener('mouseup', cancelPress);
      card.addEventListener('mouseleave', cancelPress);
    }

    return card;
  }

  async function openAlbum(id) {
    state.currentAlbumId = id;
    state.selectMode = false;
    state.selected.clear();
    updateSelectionUI();

    $('#albums-view').classList.add('hidden');
    $('#media-view').classList.remove('hidden');
    $('#btn-back').classList.remove('hidden');
    $('#btn-new-album').classList.add('hidden');

    const album = id === 'all' ? { name: t('allPhotos') } : await db.getAlbum(id);
    $('#header-title').textContent = album ? album.name : t('albums');

    await loadMedia(id);
  }

  function showAlbumsView() {
    state.currentAlbumId = null;
    state.selectMode = false;
    state.selected.clear();
    $('#media-view').classList.add('hidden');
    $('#albums-view').classList.remove('hidden');
    $('#btn-back').classList.add('hidden');
    $('#btn-new-album').classList.remove('hidden');
    $('#header-title').textContent = t('albums');
    $('#selection-bar').classList.add('hidden');
    loadAlbums();
  }

  // ========== Media ==========
  async function loadMedia(albumId) {
    state.mediaList = await db.getMediaByAlbum(albumId);
    renderMedia();
  }

  function renderMedia() {
    const grid = $('#media-grid');
    const empty = $('#empty-state');
    grid.innerHTML = '';

    if (state.mediaList.length === 0) {
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');

    state.mediaList.forEach((item, index) => {
      const el = document.createElement('div');
      el.className = 'media-item';
      el.dataset.id = item.id;
      el.dataset.index = index;

      if (item.thumb) {
        const img = document.createElement('img');
        img.src = URL.createObjectURL(item.thumb);
        img.loading = 'lazy';
        el.appendChild(img);
      } else {
        // Fallback placeholder + try regenerate for video in background
        const ph = document.createElement('div');
        ph.style.cssText = 'width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#3A3A3C;font-size:32px;';
        ph.textContent = item.type === 'video' ? '🎬' : '🖼️';
        el.appendChild(ph);

        if (item.type === 'video' && item.blob) {
          // Lazy regenerate thumbnail
          mediaUtils.generateThumbnail(item.blob).then(async (thumb) => {
            if (thumb) {
              item.thumb = thumb;
              await db.saveMedia(item);
              const newImg = document.createElement('img');
              newImg.src = URL.createObjectURL(thumb);
              newImg.loading = 'lazy';
              ph.replaceWith(newImg);
            }
          }).catch(() => {});
        }
      }

      if (item.type === 'video') {
        const badge = document.createElement('div');
        badge.className = 'video-badge';
        badge.innerHTML = `▶ ${mediaUtils.formatDuration(item.duration)}`;
        el.appendChild(badge);
      }

      const check = document.createElement('div');
      check.className = 'check';
      check.textContent = '✓';
      el.appendChild(check);

      if (state.selected.has(item.id)) {
        el.classList.add('selected');
      }

      el.addEventListener('click', (e) => {
        if (state.selectMode) {
          toggleSelect(item.id, el);
        } else {
          openViewer(index);
        }
      });

      // Long press for select
      let pressTimer;
      el.addEventListener('touchstart', () => {
        pressTimer = setTimeout(() => {
          if (!state.selectMode) {
            enterSelectMode();
            toggleSelect(item.id, el);
          }
        }, 500);
      }, { passive: true });
      el.addEventListener('touchend', () => clearTimeout(pressTimer));
      el.addEventListener('touchmove', () => clearTimeout(pressTimer));

      grid.appendChild(el);
    });
  }

  function toggleSelect(id, el) {
    if (state.selected.has(id)) {
      state.selected.delete(id);
      el.classList.remove('selected');
    } else {
      state.selected.add(id);
      el.classList.add('selected');
    }
    updateSelectionUI();
  }

  function enterSelectMode() {
    state.selectMode = true;
    $('#btn-select').textContent = t('cancel');
    $('#selection-bar').classList.remove('hidden');
    updateSelectionUI();
  }

  function exitSelectMode() {
    state.selectMode = false;
    state.selected.clear();
    $('#btn-select').textContent = t('select');
    $('#selection-bar').classList.add('hidden');
    $$('.media-item.selected').forEach(el => el.classList.remove('selected'));
    updateSelectionUI();
  }

  function updateSelectionUI() {
    const count = state.selected.size;
    $('#selection-count').textContent = `${count} ${t('selected')}`;
    $('#btn-delete').disabled = count === 0;
    $('#btn-move').disabled = count === 0;
  }

  // ========== Import ==========
  async function handleFiles(files) {
    if (!files.length) return;
    toast((currentLang === 'zh' ? '正在导入...' : 'Importing...') + ' (' + files.length + ')');

    let targetAlbum = state.currentAlbumId && state.currentAlbumId !== 'all'
      ? state.currentAlbumId
      : null;

    if (!targetAlbum) {
      const recents = state.albums.find(a => a.name === 'Recents' || a.name === '最近项目');
      if (recents) {
        targetAlbum = recents.id;
      } else {
        const a = { id: mediaUtils.uid(), name: currentLang === 'zh' ? '最近项目' : 'Recents', created: Date.now() };
        await db.saveAlbum(a);
        targetAlbum = a.id;
        state.albums.unshift(a);
      }
    }

    let successCount = 0;
    for (const file of files) {
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) continue;
      try {
        const isVideo = file.type.startsWith('video/');
        const thumb = await mediaUtils.generateThumbnail(file);
        let duration = 0;
        if (isVideo) {
          duration = await mediaUtils.getVideoDuration(file);
        }

        const item = {
          id: mediaUtils.uid(),
          albumId: targetAlbum,
          type: isVideo ? 'video' : 'image',
          name: file.name,
          created: file.lastModified || Date.now(),
          size: file.size,
          mime: file.type,
          duration,
          blob: file,
          thumb: thumb
        };
        await db.saveMedia(item);
        successCount++;
      } catch (err) {
        console.warn('Import failed for', file.name, err);
      }
    }

    toast(t('successImport') + ' (' + successCount + ')');
    if (state.currentAlbumId) {
      await loadMedia(state.currentAlbumId);
    } else {
      await loadAlbums();
    }
  }

  // ========== Viewer ==========
  function openViewer(index) {
    state.viewerIndex = index;
    const item = state.mediaList[index];
    if (!item) return;

    $('#viewer').classList.remove('hidden');
    $('#viewer-counter').textContent = `${index + 1} / ${state.mediaList.length}`;

    const img = $('#viewer-image');
    const video = $('#viewer-video');
    img.classList.add('hidden');
    video.classList.add('hidden');
    video.pause();
    video.removeAttribute('src');

    if (item.type === 'image') {
      img.src = URL.createObjectURL(item.blob);
      img.classList.remove('hidden');
      // Reset zoom
      img.style.transform = 'scale(1) translate(0,0)';
      setupPinchZoom(img);
      $('#viewer-crop').classList.remove('hidden');
    } else {
      video.src = URL.createObjectURL(item.blob);
      video.classList.remove('hidden');
      $('#viewer-crop').classList.add('hidden');
    }
  }

  function closeViewer() {
    $('#viewer').classList.add('hidden');
    const img = $('#viewer-image');
    const video = $('#viewer-video');
    if (img.src) URL.revokeObjectURL(img.src);
    if (video.src) URL.revokeObjectURL(video.src);
    img.src = '';
    video.src = '';
    video.pause();
  }

  function viewerNav(dir) {
    const next = state.viewerIndex + dir;
    if (next < 0 || next >= state.mediaList.length) return;
    // Clean previous
    const img = $('#viewer-image');
    const video = $('#viewer-video');
    if (img.src) URL.revokeObjectURL(img.src);
    if (video.src) URL.revokeObjectURL(video.src);
    openViewer(next);
  }

  // Simple pinch zoom for image
  function setupPinchZoom(img) {
    let scale = 1;
    let lastScale = 1;
    let startDist = 0;
    let originX = 0, originY = 0;
    let translateX = 0, translateY = 0;
    let startX = 0, startY = 0;
    let isPanning = false;

    const apply = () => {
      img.style.transform = `scale(${scale}) translate(${translateX / scale}px, ${translateY / scale}px)`;
    };

    img.ontouchstart = (e) => {
      if (e.touches.length === 2) {
        startDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        lastScale = scale;
      } else if (e.touches.length === 1 && scale > 1) {
        isPanning = true;
        startX = e.touches[0].clientX - translateX;
        startY = e.touches[0].clientY - translateY;
      }
    };

    img.ontouchmove = (e) => {
      e.preventDefault();
      if (e.touches.length === 2) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        scale = Math.min(Math.max(lastScale * (dist / startDist), 1), 5);
        apply();
      } else if (e.touches.length === 1 && isPanning) {
        translateX = e.touches[0].clientX - startX;
        translateY = e.touches[0].clientY - startY;
        apply();
      }
    };

    img.ontouchend = () => {
      isPanning = false;
      if (scale < 1.05) {
        scale = 1;
        translateX = 0;
        translateY = 0;
        apply();
      }
    };
  }

  // ========== Crop ==========
  let cropState = { item: null, img: null, scale: 1, offsetX: 0, offsetY: 0 };

  async function openCrop() {
    const item = state.mediaList[state.viewerIndex];
    if (!item || item.type !== 'image') return;

    cropState.item = item;
    const modal = $('#crop-modal');
    modal.classList.remove('hidden');

    const canvas = $('#crop-canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.src = URL.createObjectURL(item.blob);
    await new Promise(r => img.onload = r);

    // Fit to screen
    const maxW = window.innerWidth;
    const maxH = window.innerHeight - 100;
    let w = img.width;
    let h = img.height;
    const ratio = Math.min(maxW / w, maxH / h, 1);
    w *= ratio;
    h *= ratio;
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(img, 0, 0, w, h);
    cropState.img = img;
    cropState.displayW = w;
    cropState.displayH = h;
    cropState.naturalW = img.width;
    cropState.naturalH = img.height;

    // Default crop box centered square
    const box = $('#crop-box');
    const size = Math.min(w, h) * 0.8;
    box.style.width = size + 'px';
    box.style.height = size + 'px';
    box.style.left = ((window.innerWidth - size) / 2) + 'px';
    box.style.top = ((window.innerHeight - 100 - size) / 2 + 50) + 'px';

    // Simple drag for crop box (basic)
    makeCropBoxDraggable(box);
  }

  function makeCropBoxDraggable(box) {
    let startX, startY, startLeft, startTop;
    box.ontouchstart = (e) => {
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      startLeft = parseFloat(box.style.left);
      startTop = parseFloat(box.style.top);
    };
    box.ontouchmove = (e) => {
      e.preventDefault();
      const t = e.touches[0];
      box.style.left = (startLeft + t.clientX - startX) + 'px';
      box.style.top = (startTop + t.clientY - startY) + 'px';
    };
  }

  async function applyCrop() {
    const box = $('#crop-box');
    const canvas = $('#crop-canvas');
    const rect = canvas.getBoundingClientRect();
    const boxRect = box.getBoundingClientRect();

    // Relative to canvas
    const scaleX = cropState.naturalW / cropState.displayW;
    const scaleY = cropState.naturalH / cropState.displayH;

    const x = (boxRect.left - rect.left) * scaleX;
    const y = (boxRect.top - rect.top) * scaleY;
    const w = boxRect.width * scaleX;
    const h = boxRect.height * scaleY;

    const out = document.createElement('canvas');
    out.width = Math.max(1, Math.round(w));
    out.height = Math.max(1, Math.round(h));
    const ctx = out.getContext('2d');
    ctx.drawImage(cropState.img, x, y, w, h, 0, 0, out.width, out.height);

    const blob = await new Promise(r => out.toBlob(r, 'image/jpeg', 0.92));
    const thumb = await mediaUtils.generateThumbnail(new File([blob], 'crop.jpg', { type: 'image/jpeg' }));

    // Update media
    const item = cropState.item;
    item.blob = blob;
    item.thumb = thumb;
    item.size = blob.size;
    await db.saveMedia(item);

    // Refresh
    await loadMedia(state.currentAlbumId);
    closeCrop();
    closeViewer();
    toast(t('successCrop'));
  }

  function closeCrop() {
    $('#crop-modal').classList.add('hidden');
    if (cropState.img) URL.revokeObjectURL(cropState.img.src);
    cropState = {};
  }

  // ========== Actions ==========
  async function deleteSelected() {
    if (state.selected.size === 0) return;
    if (!confirm(t('confirmDelete'))) return;
    await db.deleteMedia([...state.selected]);
    toast(t('successDelete'));
    exitSelectMode();
    await loadMedia(state.currentAlbumId);
    if (state.currentAlbumId === null) loadAlbums();
  }

  async function showMoveModal() {
    if (state.selected.size === 0) return;
    const list = $('#move-album-list');
    list.innerHTML = '';
    state.albums.forEach(album => {
      const item = document.createElement('div');
      item.className = 'move-item';
      item.innerHTML = `<div class="album-cover placeholder" style="width:48px;height:48px;font-size:24px;display:flex;align-items:center;justify-content:center;background:var(--separator);border-radius:6px;">📁</div>
        <span>${album.name}</span>`;
      item.onclick = async () => {
        for (const id of state.selected) {
          const media = await db.getMedia(id);
          if (media) {
            media.albumId = album.id;
            await db.saveMedia(media);
          }
        }
        toast(t('successMove'));
        $('#move-modal').classList.add('hidden');
        exitSelectMode();
        await loadMedia(state.currentAlbumId);
      };
      list.appendChild(item);
    });
    $('#move-modal').classList.remove('hidden');
  }

  async function createAlbum() {
    const name = $('#new-album-name').value.trim();
    if (!name) return;
    const album = {
      id: mediaUtils.uid(),
      name,
      created: Date.now()
    };
    await db.saveAlbum(album);
    $('#new-album-modal').classList.add('hidden');
    $('#new-album-name').value = '';
    await loadAlbums();
  }

  // ========== Events ==========
  function bindEvents() {
    $('#btn-back').onclick = showAlbumsView;
    $('#btn-select').onclick = () => {
      if (state.selectMode) exitSelectMode();
      else enterSelectMode();
    };
    $('#btn-lang').onclick = () => {
      toggleLang();
      // Refresh current view titles
      if (state.currentAlbumId === null) {
        $('#header-title').textContent = t('albums');
        renderAlbums();
      } else {
        // keep album name
      }
    };
    $('#btn-import').onclick = () => $('#file-input').click();
    $('#btn-import-empty').onclick = () => $('#file-input').click();
    $('#file-input').onchange = (e) => {
      handleFiles([...e.target.files]);
      e.target.value = '';
    };
    $('#btn-new-album').onclick = () => {
      $('#new-album-modal').classList.remove('hidden');
      $('#new-album-name').focus();
    };
    $('#new-album-cancel').onclick = () => $('#new-album-modal').classList.add('hidden');
    $('#new-album-create').onclick = createAlbum;
    $('#btn-delete').onclick = deleteSelected;
    $('#btn-move').onclick = showMoveModal;
    $('#move-cancel').onclick = () => $('#move-modal').classList.add('hidden');

    $('#viewer-close').onclick = closeViewer;
    $('#viewer-prev').onclick = () => viewerNav(-1);
    $('#viewer-next').onclick = () => viewerNav(1);
    $('#viewer-crop').onclick = openCrop;
    $('#crop-cancel').onclick = closeCrop;
    $('#crop-done').onclick = applyCrop;

    $('#btn-more').onclick = (e) => {
      e.stopPropagation();
      $('#more-menu').classList.toggle('hidden');
    };
    document.addEventListener('click', () => $('#more-menu').classList.add('hidden'));

    $('#menu-change-pass').onclick = async () => {
      if (confirm(currentLang === 'zh' ? '确定要重新设置图案密码？' : 'Reset pattern lock?')) {
        await db.setMeta('pattern', null);
        location.reload();
      }
    };
    $('#menu-about').onclick = () => {
      alert(t('aboutText') + '\n\nGitHub Pages Offline PWA');
    };

    // Recovery: reset pattern from lock screen
    const resetBtn = document.getElementById('lock-reset');
    if (resetBtn) {
      resetBtn.onclick = async () => {
        if (confirm(currentLang === 'zh' ? '确定清除图案密码并重新设置？' : 'Clear pattern and set a new one?')) {
          await db.setMeta('pattern', null);
          location.reload();
        }
      };
    }

    // Prevent zoom on double tap etc
    document.addEventListener('gesturestart', e => e.preventDefault());
  }

  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 2200);
  }

  // Expose for i18n
  window.app = { updateSelectionUI, state };

  // Start
  init();
})();
