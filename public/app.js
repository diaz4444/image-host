const dropzone = document.querySelector('#dropzone');
const fileInput = document.querySelector('#file-input');
const statusNode = document.querySelector('#upload-status');
const libraryList = document.querySelector('#library-list');
const countNode = document.querySelector('#image-count');
const toast = document.querySelector('#toast');
let toastTimer;
let allowDelete = false;
let adminToken = '';

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(timestamp) {
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(timestamp));
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 2600);
}

function setStatus(message, type = '') {
  statusNode.textContent = message;
  statusNode.className = `upload-status ${type}`.trim();
}

function icon(name) {
  const icons = {
    copy: '<svg viewBox="0 0 24 24" fill="none"><rect x="8" y="8" width="11" height="11" rx="1.5" stroke="currentColor" stroke-width="1.7"/><path d="M16 8V6.5A1.5 1.5 0 0 0 14.5 5h-7A1.5 1.5 0 0 0 6 6.5v7A1.5 1.5 0 0 0 7.5 15H8" stroke="currentColor" stroke-width="1.7"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none"><path d="M5 7h14M10 11v6M14 11v6M8 7l.7-2h6.6l.7 2m-10 0 .8 12h8.4l.8-12" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };
  return icons[name] || '';
}

function renderImages(images) {
  countNode.textContent = images.length;
  if (!images.length) {
    libraryList.innerHTML = '<div class="empty-state">图片库还是空的，上传第一张图片吧。</div>';
    return;
  }
  libraryList.innerHTML = images.map((image, index) => `
    <article class="image-row" style="animation-delay: ${index * 45}ms">
      <a class="thumb-wrap" href="${image.url}" target="_blank" rel="noopener" aria-label="打开 ${image.name}"><img src="${image.url}" alt="${image.name}" loading="lazy" /></a>
      <div class="image-details">
        <p class="image-name">${image.name}</p>
        <a class="image-link" href="${image.url}" target="_blank" rel="noopener">${image.url}</a>
        <div class="image-size">${formatBytes(image.size)} · ${formatDate(image.createdAt)}</div>
      </div>
      <div class="row-actions">
        <button class="icon-button" data-copy="${image.url}" title="复制链接" aria-label="复制链接">${icon('copy')}</button>
        ${allowDelete ? `<button class="icon-button danger" data-delete="${image.id}" title="删除图片" aria-label="删除图片">${icon('trash')}</button>` : ''}
      </div>
    </article>`).join('');
}

async function loadImages() {
  try {
    const response = await fetch('/api/images');
    if (!response.ok) throw new Error('读取失败');
    renderImages((await response.json()).images);
  } catch {
    libraryList.innerHTML = '<div class="empty-state">无法连接服务端，请确认图床服务仍在运行。</div>';
  }
}

async function loadConfig() {
  try {
    const response = await fetch('/api/config');
    if (response.ok) allowDelete = Boolean((await response.json()).allowDelete);
  } catch {
    allowDelete = false;
  }
}

function fileToPng(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      image.onerror = () => reject(new Error('图片无法读取'));
      image.src = reader.result;
    };
    reader.onerror = () => reject(new Error('文件无法读取'));
    reader.readAsDataURL(file);
  });
}

async function upload(file) {
  if (!file || !file.type.startsWith('image/')) {
    setStatus('请选择图片文件。', 'error');
    return;
  }
  if (file.size > 20 * 1024 * 1024) {
    setStatus('图片不能超过 20 MB。', 'error');
    return;
  }
  setStatus('正在转换并上传…');
  try {
    const data = await fileToPng(file);
    const response = await fetch('/api/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || '上传失败');
    setStatus('上传完成，链接已经加入图片库。', 'success');
    await loadImages();
    await copyText(result.url);
    showToast('PNG 链接已复制');
  } catch (error) {
    setStatus(error.message || '上传失败，请重试。', 'error');
  } finally {
    fileInput.value = '';
  }
}

async function copyText(value) {
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const input = document.createElement('textarea');
  input.value = value;
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.appendChild(input);
  input.select();
  document.execCommand('copy');
  input.remove();
}

fileInput.addEventListener('change', () => upload(fileInput.files[0]));
['dragenter', 'dragover'].forEach((eventName) => dropzone.addEventListener(eventName, (event) => {
  event.preventDefault();
  dropzone.classList.add('is-dragging');
}));
['dragleave', 'drop'].forEach((eventName) => dropzone.addEventListener(eventName, (event) => {
  event.preventDefault();
  dropzone.classList.remove('is-dragging');
}));
dropzone.addEventListener('drop', (event) => upload(event.dataTransfer.files[0]));

libraryList.addEventListener('click', async (event) => {
  const copyButton = event.target.closest('[data-copy]');
  if (copyButton) {
    try {
      await copyText(copyButton.dataset.copy);
      showToast('链接已复制');
    } catch {
      showToast('复制失败，请手动选择链接');
    }
    return;
  }
  const deleteButton = event.target.closest('[data-delete]');
  if (deleteButton && window.confirm('确定删除这张图片吗？')) {
    if (!adminToken) adminToken = window.prompt('请输入管理令牌') || '';
    if (!adminToken) return;
    const response = await fetch(`/api/images/${deleteButton.dataset.delete}`, { method: 'DELETE', headers: { 'x-admin-token': adminToken } });
    if (response.ok) {
      showToast('图片已删除');
      loadImages();
    } else {
      adminToken = '';
      showToast('删除失败');
    }
  }
});

Promise.all([loadConfig(), loadImages()]);
