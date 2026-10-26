const DB_NAME = 'ios-photos-db';
const DB_VERSION = 1;

class PhotoDB {
  constructor() {
    this.db = null;
  }

  async open() {
    if (this.db) return this.db;
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('albums')) {
          const store = db.createObjectStore('albums', { keyPath: 'id' });
          store.createIndex('created', 'created');
        }
        if (!db.objectStoreNames.contains('media')) {
          const store = db.createObjectStore('media', { keyPath: 'id' });
          store.createIndex('albumId', 'albumId');
          store.createIndex('created', 'created');
        }
      };
      req.onsuccess = () => {
        this.db = req.result;
        resolve(this.db);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async getMeta(key) {
    await this.open();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('meta', 'readonly');
      const req = tx.objectStore('meta').get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : null);
      req.onerror = () => reject(req.error);
    });
  }

  async setMeta(key, value) {
    await this.open();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('meta', 'readwrite');
      tx.objectStore('meta').put({ key, value });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getAllAlbums() {
    await this.open();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('albums', 'readonly');
      const req = tx.objectStore('albums').getAll();
      req.onsuccess = () => {
        const list = req.result || [];
        list.sort((a, b) => b.created - a.created);
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async getAlbum(id) {
    await this.open();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('albums', 'readonly');
      const req = tx.objectStore('albums').get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async saveAlbum(album) {
    await this.open();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('albums', 'readwrite');
      tx.objectStore('albums').put(album);
      tx.oncomplete = () => resolve(album);
      tx.onerror = () => reject(tx.error);
    });
  }

  async deleteAlbum(id) {
    await this.open();
    // Also delete media in album? For now keep media, or move to All
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('albums', 'readwrite');
      tx.objectStore('albums').delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getMediaByAlbum(albumId) {
    await this.open();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('media', 'readonly');
      const store = tx.objectStore('media');
      let req;
      if (albumId === 'all') {
        req = store.getAll();
      } else {
        req = store.index('albumId').getAll(albumId);
      }
      req.onsuccess = () => {
        const list = req.result || [];
        list.sort((a, b) => b.created - a.created);
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async getMedia(id) {
    await this.open();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('media', 'readonly');
      const req = tx.objectStore('media').get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async saveMedia(item) {
    await this.open();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('media', 'readwrite');
      tx.objectStore('media').put(item);
      tx.oncomplete = () => resolve(item);
      tx.onerror = () => reject(tx.error);
    });
  }

  async deleteMedia(ids) {
    await this.open();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('media', 'readwrite');
      const store = tx.objectStore('media');
      ids.forEach(id => store.delete(id));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async countMedia(albumId) {
    const list = await this.getMediaByAlbum(albumId);
    return list.length;
  }

  async getCover(albumId) {
    const list = await this.getMediaByAlbum(albumId);
    return list[0] || null;
  }
}

window.db = new PhotoDB();
