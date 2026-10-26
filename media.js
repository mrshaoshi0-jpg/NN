async function generateThumbnail(file, maxSize = 400) {
  if (file.type.startsWith('image/')) {
    return generateImageThumb(file, maxSize);
  } else if (file.type.startsWith('video/')) {
    return generateVideoThumb(file, maxSize);
  }
  return null;
}

function generateImageThumb(file, maxSize) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        if (w > h) {
          if (w > maxSize) { h = h * maxSize / w; w = maxSize; }
        } else {
          if (h > maxSize) { w = w * maxSize / h; h = maxSize; }
        }
        canvas.width = Math.max(1, Math.round(w));
        canvas.height = Math.max(1, Math.round(h));
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(url);
          resolve(blob);
        }, 'image/jpeg', 0.82);
      } catch (e) {
        URL.revokeObjectURL(url);
        resolve(null);
      }
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

function generateVideoThumb(file, maxSize) {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    let settled = false;

    const finish = (blob) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      try { URL.revokeObjectURL(url); } catch (e) {}
      try { video.pause(); video.removeAttribute('src'); video.load(); } catch (e) {}
      resolve(blob || null);
    };

    // Longer timeout for iOS
    const timeoutId = setTimeout(() => finish(null), 6000);

    video.muted = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.preload = 'auto';
    video.crossOrigin = 'anonymous';

    const tryCapture = () => {
      if (settled) return;
      try {
        if (video.videoWidth < 2 || video.videoHeight < 2) {
          // Not ready yet
          return false;
        }
        const canvas = document.createElement('canvas');
        let w = video.videoWidth;
        let h = video.videoHeight;
        if (w > h) {
          if (w > maxSize) { h *= maxSize / w; w = maxSize; }
        } else {
          if (h > maxSize) { w *= maxSize / h; h = maxSize; }
        }
        canvas.width = Math.max(1, Math.round(w));
        canvas.height = Math.max(1, Math.round(h));
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        // Check if frame is mostly black (common on iOS first frame)
        const sample = ctx.getImageData(0, 0, Math.min(10, canvas.width), Math.min(10, canvas.height)).data;
        let dark = 0;
        for (let i = 0; i < sample.length; i += 4) {
          if (sample[i] < 20 && sample[i+1] < 20 && sample[i+2] < 20) dark++;
        }
        if (dark > 20) {
          // Too dark, try later
          return false;
        }
        canvas.toBlob((blob) => finish(blob), 'image/jpeg', 0.82);
        return true;
      } catch (e) {
        return false;
      }
    };

    const seekAndCapture = (time) => {
      try {
        if (video.readyState >= 2) {
          video.currentTime = Math.min(time, (video.duration || 1) - 0.05);
        }
      } catch (e) {}
    };

    video.addEventListener('loadedmetadata', () => {
      // Start trying from a small offset
      seekAndCapture(0.25);
    });

    video.addEventListener('seeked', () => {
      if (tryCapture()) return;
      // If dark or failed, try another time
      setTimeout(() => {
        if (!settled) {
          seekAndCapture(1.0);
          setTimeout(() => {
            if (!settled) tryCapture() || finish(null);
          }, 400);
        }
      }, 200);
    });

    video.addEventListener('loadeddata', () => {
      setTimeout(() => {
        if (!settled && !tryCapture()) {
          seekAndCapture(0.1);
        }
      }, 100);
    });

    video.addEventListener('error', () => finish(null));

    video.src = url;

    // Kick iOS decoder
    const playPromise = video.play();
    if (playPromise && typeof playPromise.then === 'function') {
      playPromise.then(() => {
        setTimeout(() => { try { video.pause(); } catch(e){} }, 50);
      }).catch(() => {});
    }
  });
}

function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

async function getVideoDuration(file) {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    let done = false;
    const finish = (v) => {
      if (done) return;
      done = true;
      try { URL.revokeObjectURL(url); } catch(e){}
      resolve(v || 0);
    };
    video.preload = 'metadata';
    video.onloadedmetadata = () => finish(video.duration);
    video.onerror = () => finish(0);
    setTimeout(() => finish(0), 4000);
    video.src = url;
  });
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

window.mediaUtils = {
  generateThumbnail,
  formatDuration,
  getVideoDuration,
  uid
};
