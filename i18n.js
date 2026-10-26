const i18n = {
  zh: {
    enterPattern: '输入图案密码',
    setPattern: '设置图案密码',
    drawPattern: '请绘制解锁图案',
    confirmPattern: '请再次绘制确认',
    patternTooShort: '至少连接4个点',
    patternMismatch: '两次图案不一致，请重试',
    patternSet: '图案密码已设置',
    wrongPattern: '图案错误，请重试',
    albums: '相册',
    allPhotos: '所有照片',
    select: '选择',
    cancel: '取消',
    delete: '删除',
    move: '移动',
    import: '导入',
    newAlbum: '新建相册',
    albumName: '相册名称',
    create: '创建',
    noMedia: '暂无照片或视频',
    selected: '已选择',
    crop: '裁剪',
    done: '完成',
    changePattern: '修改图案密码',
    about: '关于',
    export: '导出选中',
    moveTo: '移动到相册',
    successDelete: '已删除',
    successMove: '已移动',
    successImport: '导入成功',
    successCrop: '裁剪完成',
    confirmDelete: '确定删除选中的项目？',
    video: '视频',
    photos: '张照片',
    items: '项',
    back: '返回',
    language: '语言',
    aboutText: '离线相册 · 支持图案锁 · 可添加到主屏幕',
  },
  en: {
    enterPattern: 'Enter Pattern',
    setPattern: 'Set Pattern Lock',
    drawPattern: 'Draw an unlock pattern',
    confirmPattern: 'Draw again to confirm',
    patternTooShort: 'Connect at least 4 dots',
    patternMismatch: 'Patterns do not match',
    patternSet: 'Pattern set successfully',
    wrongPattern: 'Wrong pattern, try again',
    albums: 'Albums',
    allPhotos: 'All Photos',
    select: 'Select',
    cancel: 'Cancel',
    delete: 'Delete',
    move: 'Move',
    import: 'Import',
    newAlbum: 'New Album',
    albumName: 'Album Name',
    create: 'Create',
    noMedia: 'No Photos or Videos',
    selected: 'selected',
    crop: 'Crop',
    done: 'Done',
    changePattern: 'Change Pattern',
    about: 'About',
    export: 'Export Selected',
    moveTo: 'Move to Album',
    successDelete: 'Deleted',
    successMove: 'Moved',
    successImport: 'Imported',
    successCrop: 'Cropped',
    confirmDelete: 'Delete selected items?',
    video: 'Video',
    photos: 'photos',
    items: 'items',
    back: 'Back',
    language: 'Language',
    aboutText: 'Offline Photos · Pattern Lock · Add to Home Screen',
  }
};

let currentLang = localStorage.getItem('lang') || (navigator.language.startsWith('zh') ? 'zh' : 'en');

function t(key) {
  return i18n[currentLang][key] || i18n.en[key] || key;
}

function setLang(lang) {
  currentLang = lang;
  localStorage.setItem('lang', lang);
  updateUITexts();
}

function toggleLang() {
  setLang(currentLang === 'zh' ? 'en' : 'zh');
}

function updateUITexts() {
  // Will be called by app after DOM ready
  const map = {
    'lock-title': 'enterPattern',
    'setup-title': 'setPattern',
    'setup-hint': 'drawPattern',
    'header-title': 'albums',
    'btn-select': 'select',
    'empty-text': 'noMedia',
    'btn-import-empty': 'import',
    'new-album-title': 'newAlbum',
    'new-album-name': null, // placeholder
    'new-album-cancel': 'cancel',
    'new-album-create': 'create',
    'move-title': 'moveTo',
    'move-cancel': 'cancel',
    'btn-delete': 'delete',
    'btn-move': 'move',
    'viewer-crop': 'crop',
    'crop-cancel': 'cancel',
    'crop-done': 'done',
    'menu-export': 'export',
    'menu-change-pass': 'changePattern',
    'menu-about': 'about',
  };

  for (const [id, key] of Object.entries(map)) {
    const el = document.getElementById(id);
    if (!el || !key) continue;
    if (el.tagName === 'INPUT') {
      el.placeholder = t(key);
    } else {
      el.textContent = t(key);
    }
  }

  // Special
  const nameInput = document.getElementById('new-album-name');
  if (nameInput) nameInput.placeholder = t('albumName');

  const navLabels = document.querySelectorAll('.nav-label');
  if (navLabels[0]) navLabels[0].textContent = t('import');
  if (navLabels[1]) navLabels[1].textContent = t('albums');

  // Update selection count if visible
  if (window.app && window.app.updateSelectionUI) {
    window.app.updateSelectionUI();
  }
}
