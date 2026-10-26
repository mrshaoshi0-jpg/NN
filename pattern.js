class PatternLock {
  constructor(container, options = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.onComplete = options.onComplete || (() => {});
    this.dots = [];
    this.pattern = [];
    this.lines = [];
    this.isDrawing = false;
    this.size = 280;
    this.dotPositions = [];
    this.init();
  }

  init() {
    this.container.innerHTML = '';
    this.container.classList.add('pattern-lock');
    this.container.style.width = this.size + 'px';
    this.container.style.height = this.size + 'px';

    const gap = this.size / 3;
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const idx = row * 3 + col + 1;
        const x = gap * col + gap / 2;
        const y = gap * row + gap / 2;
        this.dotPositions.push({ x, y, id: idx });

        const dot = document.createElement('div');
        dot.className = 'pattern-dot';
        dot.dataset.id = idx;
        dot.style.left = x + 'px';
        dot.style.top = y + 'px';
        this.container.appendChild(dot);
        this.dots.push(dot);
      }
    }

    this.container.addEventListener('touchstart', this.onStart.bind(this), { passive: false });
    this.container.addEventListener('touchmove', this.onMove.bind(this), { passive: false });
    this.container.addEventListener('touchend', this.onEnd.bind(this));
    this.container.addEventListener('mousedown', this.onStart.bind(this));
    this.container.addEventListener('mousemove', this.onMove.bind(this));
    this.container.addEventListener('mouseup', this.onEnd.bind(this));
    this.container.addEventListener('mouseleave', this.onEnd.bind(this));
  }

  getPos(e) {
    const rect = this.container.getBoundingClientRect();
    const touch = e.touches ? e.touches[0] : e;
    return {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top
    };
  }

  findDot(pos) {
    const threshold = 28;
    for (const p of this.dotPositions) {
      const dx = pos.x - p.x;
      const dy = pos.y - p.y;
      if (Math.sqrt(dx * dx + dy * dy) < threshold) {
        return p.id;
      }
    }
    return null;
  }

  onStart(e) {
    e.preventDefault();
    this.clear();
    this.isDrawing = true;
    const pos = this.getPos(e);
    const id = this.findDot(pos);
    if (id) this.addPoint(id);
  }

  onMove(e) {
    if (!this.isDrawing) return;
    e.preventDefault();
    const pos = this.getPos(e);
    const id = this.findDot(pos);
    if (id && !this.pattern.includes(id)) {
      // Optional: only allow adjacent (simple version allows any)
      this.addPoint(id);
    }
    this.drawTempLine(pos);
  }

  onEnd(e) {
    if (!this.isDrawing) return;
    this.isDrawing = false;
    this.removeTempLine();
    if (this.pattern.length >= 4) {
      this.onComplete(this.pattern.slice());
    } else if (this.pattern.length > 0) {
      this.showError();
      setTimeout(() => this.clear(), 600);
    }
  }

  addPoint(id) {
    this.pattern.push(id);
    const dot = this.dots[id - 1];
    dot.classList.add('active');
    if (this.pattern.length > 1) {
      this.drawLine(
        this.dotPositions[this.pattern[this.pattern.length - 2] - 1],
        this.dotPositions[id - 1]
      );
    }
  }

  drawLine(from, to) {
    const line = document.createElement('div');
    line.className = 'pattern-line';
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    line.style.width = len + 'px';
    line.style.left = from.x + 'px';
    line.style.top = from.y + 'px';
    line.style.transform = `rotate(${angle}deg)`;
    this.container.appendChild(line);
    this.lines.push(line);
  }

  drawTempLine(pos) {
    this.removeTempLine();
    if (this.pattern.length === 0) return;
    const from = this.dotPositions[this.pattern[this.pattern.length - 1] - 1];
    const line = document.createElement('div');
    line.className = 'pattern-line temp';
    line.id = 'temp-line';
    const dx = pos.x - from.x;
    const dy = pos.y - from.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    line.style.width = len + 'px';
    line.style.left = from.x + 'px';
    line.style.top = from.y + 'px';
    line.style.transform = `rotate(${angle}deg)`;
    this.container.appendChild(line);
  }

  removeTempLine() {
    const temp = document.getElementById('temp-line');
    if (temp) temp.remove();
  }

  clear() {
    this.pattern = [];
    this.lines.forEach(l => l.remove());
    this.lines = [];
    this.dots.forEach(d => {
      d.classList.remove('active', 'success', 'error');
    });
    this.removeTempLine();
  }

  showSuccess() {
    this.dots.forEach(d => {
      if (d.classList.contains('active')) d.classList.add('success');
    });
    this.lines.forEach(l => l.style.background = 'var(--green)');
  }

  showError() {
    this.dots.forEach(d => {
      if (d.classList.contains('active')) d.classList.add('error');
    });
    this.lines.forEach(l => l.style.background = 'var(--red)');
  }

  destroy() {
    this.container.innerHTML = '';
  }
}

window.PatternLock = PatternLock;
