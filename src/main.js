// --- State Management ---
let state = {
  token: localStorage.getItem('gh_token') || '',
  repo: localStorage.getItem('gh_repo') || 'AIFinanceLab/workspace',
  password: localStorage.getItem('access_password') || '',
  isLoggedIn: false,
  currentPath: '',
  currentObjectURL: null,
  serverUrl: localStorage.getItem('re_server_url') || 'http://macbook-air.taild4f7f4.ts.net:3001',
  currentFile: null
};

const dom = {
  hero: document.getElementById('hero'),
  explorer: document.getElementById('explorer-view'),
  fileList: document.getElementById('file-list'),
  breadcrumb: document.getElementById('breadcrumb'),
  dockItems: document.querySelectorAll('.dock-item'),
  settingsModal: document.getElementById('settings-modal'),
  loginModal: document.getElementById('login-modal'),
  previewOverlay: document.getElementById('preview-overlay'),
  previewFilename: document.getElementById('preview-filename'),
  previewBody: document.getElementById('preview-body'),
  loading: document.getElementById('loading-indicator'),
  inputToken: document.getElementById('input-token'),
  inputRepo: document.getElementById('input-repo'),
  inputPassword: document.getElementById('input-password'),
  inputLoginPassword: document.getElementById('input-login-password'),
  inputServerUrl: document.getElementById('input-server-url'),
  btnXPost: document.getElementById('btn-x-post'),
  btnMovePosted: document.getElementById('btn-move-posted')
};

// --- Initialization ---
function init() {
  if (state.password && !state.isLoggedIn) {
    showModal('login-modal');
  } else if (state.token && state.repo) {
    state.isLoggedIn = true;
    showView('explorer');
    loadRoot();
  }
}

// --- Navigation & Views ---
function showView(view) {
  dom.hero.style.display = view === 'home' ? 'block' : 'none';
  dom.explorer.style.display = view === 'explorer' ? 'block' : 'none';

  dom.dockItems.forEach(item => item.classList.remove('active'));
  document.getElementById(`dock-${view === 'explorer' ? 'files' : view}`).classList.add('active');
}

function showModal(id) {
  document.getElementById(id).style.display = 'flex';
}

function closeModal(id) {
  document.getElementById(id).style.display = 'none';
}

// --- GitHub API Logic ---
async function githubFetch(path) {
  dom.loading.style.display = 'block';
  try {
    // Cache buster to ensure we get the latest content (important for YAML changes)
    const cb = `t=${Date.now()}`;
    const url = `https://api.github.com/repos/${state.repo}/contents/${path}${path.includes('?') ? '&' : '?'}${cb}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `token ${state.token}`,
        'Accept': 'application/vnd.github.v3+json',
        
      }
    });

    if (!response.ok) throw new Error('GitHub API Error: ' + response.statusText);
    return await response.json();
  } finally {
    dom.loading.style.display = 'none';
  }
}

async function loadRoot() {
  const data = await githubFetch('');
  renderTree(data, dom.fileList);
  // Auto-expand x-poster/drafts folder
  autoExpandPath('artisans/x-poster/drafts');
}

// Auto-expand a folder path on page load
async function autoExpandPath(targetPath) {
  const parts = targetPath.split('/').filter(Boolean);
  let container = dom.fileList;
  
  for (const part of parts) {
    await new Promise(r => setTimeout(r, 100)); // wait for render
    const items = container.querySelectorAll(':scope > li');
    for (const li of items) {
      const itemEl = li.querySelector('.file-item');
      if (!itemEl) continue;
      const nameEl = itemEl.querySelector('.name');
      if (nameEl && nameEl.textContent === part) {
        const itemDiv = itemEl;
        const nestedUl = li.querySelector('.nested-list');
        if (nestedUl && itemDiv.classList.contains('file-item')) {
          itemDiv.classList.add('expanded');
          nestedUl.style.display = 'block';
          if (nestedUl.children.length === 0) {
            const path = parts.slice(0, parts.indexOf(part) + 1).join('/');
            const children = await githubFetch(path);
            renderTree(children, nestedUl, path);
          }
          container = nestedUl;
          break;
        }
      }
    }
  }
}

function renderTree(items, container, currentPath = '') {
  container.innerHTML = '';

  // Sort: Directories first
  items.sort((a, b) => (b.type === 'dir' ? 1 : -1) - (a.type === 'dir' ? 1 : -1));

  const isDraftsFolder = currentPath.includes('artisans/x-poster/drafts');
  const isPostedFolder = currentPath.includes('artisans/x-poster/posted');

  items.forEach(item => {
    const li = document.createElement('li');
    const isDir = item.type === 'dir';

    // Item container
    const itemEl = document.createElement('div');
    itemEl.className = 'file-item';

    const arrow = isDir ? '<span class="folder-arrow">▶</span>' : '<span class="folder-arrow"></span>';
    
    let icon = isDir ? '📁' : '📄';
    if (!isDir) {
      const ext = item.name.split('.').pop().toLowerCase();
      if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp'].includes(ext)) {
        icon = '🖼️';
      } else if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) {
        icon = '🎬';
      }
    }

    // Action buttons for drafts folder
    let actionsHtml = '';
    if (!isDir && item.name.endsWith('.md')) {
      if (isDraftsFolder) {
        actionsHtml = `
          <div class="row-actions">
            <button class="row-btn post-btn" title="投稿">🚀</button>
            <button class="row-btn move-btn" title="完了">📦</button>
          </div>
        `;
      } else if (isPostedFolder) {
        actionsHtml = `
          <div class="row-actions">
            <div class="posted-badge">配信済み</div>
          </div>
        `;
      }
    }

    itemEl.innerHTML = `
      ${arrow}
      <span class="icon">${icon}</span>
      <span class="name">${item.name}</span>
      ${actionsHtml}
    `;

    li.appendChild(itemEl);

    if (isDir) {
      // Create nested list for children
      const nextUl = document.createElement('ul');
      nextUl.className = 'nested-list';
      li.appendChild(nextUl);

      itemEl.onclick = async (e) => {
        e.stopPropagation();
        const isExpanded = itemEl.classList.toggle('expanded');
        nextUl.style.display = isExpanded ? 'block' : 'none';

        // Load children if not already loaded
        if (isExpanded && nextUl.children.length === 0) {
          const children = await githubFetch(item.path);
          renderTree(children, nextUl, item.path);
        }
      };
    } else {
      itemEl.onclick = (e) => {
        e.stopPropagation();
        previewFile(item);
      };
    }

    // Attach action handlers for draft files
    if (!isDir && isDraftsFolder && item.name.endsWith('.md')) {
      li.querySelector('.post-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        state.currentFile = item;
        executePosting(false);
      });
      li.querySelector('.move-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        moveToPosted(item);
      });
    }

    container.appendChild(li);
  });
}

// --- Preview Logic ---
async function previewFile(file) {
  state.currentFile = file;
  dom.previewFilename.innerText = file.name;
  dom.previewBody.innerHTML = '<div style="color: var(--text-dim)">読み込み中...</div>';
  dom.previewOverlay.style.display = 'flex';

  // Show appropriate action buttons based on folder location
  const isDraft = file.path.includes('artisans/x-poster/drafts');
  const isPosted = file.path.includes('artisans/x-poster/posted');
  
  if (file.name.endsWith('.md') && isDraft) {
    dom.btnXPost.innerText = '🚀 投稿';
    dom.btnXPost.style.display = 'block';
    dom.btnXPost.disabled = false;
    dom.btnXPost.style.opacity = '1';
    dom.btnMovePosted.style.display = 'block';
  } else if (file.name.endsWith('.md') && isPosted) {
    dom.btnXPost.innerText = '✅ 配信済み';
    dom.btnXPost.style.display = 'block';
    dom.btnXPost.disabled = true;
    dom.btnXPost.style.opacity = '0.5';
    dom.btnMovePosted.style.display = 'none';
  } else {
    dom.btnXPost.style.display = 'none';
    dom.btnMovePosted.style.display = 'none';
  }

  // Cleanup old object URL
  if (state.currentObjectURL) {
    URL.revokeObjectURL(state.currentObjectURL);
    state.currentObjectURL = null;
  }

  const ext = file.name.split('.').pop().toLowerCase();
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp'].includes(ext);
  const isVideo = ['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext);

  try {
    if (isImage || isVideo) {
      // Fetch media as blob with auth headers
      const response = await fetch(`https://api.github.com/repos/${state.repo}/contents/${file.path}`, {
        headers: {
          'Authorization': `token ${state.token}`,
          'Accept': 'application/vnd.github.v3.raw', // Important: Get raw bytes
          
        }
      });

      if (!response.ok) throw new Error('Failed to fetch media: ' + response.statusText);
      const blob = await response.blob();
      state.currentObjectURL = URL.createObjectURL(blob);

      if (isImage) {
        dom.previewBody.innerHTML = `<img src="${state.currentObjectURL}" alt="${file.name}">`;
      } else {
        dom.previewBody.innerHTML = `
          <video controls autoplay name="media">
            <source src="${state.currentObjectURL}" type="video/${ext === 'mov' ? 'mp4' : ext}">
            お使いのブラウザは動画タグをサポートしていません。
          </video>`;
      }
      return;
    }

    // Handle text files (JSON API)
    const data = await githubFetch(file.path);
    if (data.content) {
      let decoded = decodeBase64(data.content);
      
      // Clean display for markdown: Strip YAML frontmatter in preview
      if (file.name.endsWith('.md')) {
        decoded = decoded.replace(/^---\s*[\s\S]*?---\s*/, '').trim();
      }

      dom.previewBody.innerHTML = `<pre>${decoded}</pre>`;
    } else {
      dom.previewBody.innerHTML = '<div style="color: var(--text-dim)">このファイルタイプは表示できません。</div>';
    }
  } catch (err) {
    dom.previewBody.innerHTML = '<div style="color: #ef4444">エラー: ' + err.message + '</div>';
  }
}

function decodeBase64(str) {
  try {
    // Robust decoding for UTF-8 (Japanese)
    const binStr = atob(str.replace(/\s/g, ''));
    const bytes = new Uint8Array(binStr.length);
    for (let i = 0; i < binStr.length; i++) {
      bytes[i] = binStr.charCodeAt(i);
    }
    return new TextDecoder('utf-8').decode(bytes);
  } catch (e) {
    // Fallback logic
    return decodeURIComponent(escape(atob(str.replace(/\s/g, ''))));
  }
}

// --- Event Listeners ---
document.getElementById('dock-home').onclick = () => showView('home');
document.getElementById('dock-files').onclick = () => {
  if (state.isLoggedIn || !state.password) {
    showView('explorer');
    if (dom.fileList.children.length === 0) loadRoot();
  } else {
    showModal('login-modal');
  }
};
document.getElementById('dock-settings').onclick = () => {
  dom.inputToken.value = state.token;
  dom.inputRepo.value = state.repo;
  dom.inputPassword.value = state.password;
  dom.inputServerUrl.value = state.serverUrl;
  showModal('settings-modal');
};

document.getElementById('btn-settings-close').onclick = () => closeModal('settings-modal');
document.getElementById('btn-settings-save').onclick = () => {
  state.token = dom.inputToken.value;
  state.repo = dom.inputRepo.value;
  state.password = dom.inputPassword.value;
  state.serverUrl = dom.inputServerUrl.value;

  localStorage.setItem('gh_token', state.token);
  localStorage.setItem('gh_repo', state.repo);
  localStorage.setItem('access_password', state.password);
  localStorage.setItem('re_server_url', state.serverUrl);

  closeModal('settings-modal');
  if (state.token && state.repo) {
    state.isLoggedIn = true;
    showView('explorer');
    loadRoot();
  }
};

document.getElementById('btn-login-submit').onclick = () => {
  if (dom.inputLoginPassword.value === state.password) {
    state.isLoggedIn = true;
    closeModal('login-modal');
    showView('explorer');
    loadRoot();
  } else {
    alert('パスワードが違います。');
  }
};

document.getElementById('close-preview').onclick = () => {
  dom.previewOverlay.style.display = 'none';
  dom.btnXPost.style.display = 'none';
  if (state.currentObjectURL) {
    URL.revokeObjectURL(state.currentObjectURL);
    state.currentObjectURL = null;
  }
};

dom.btnXPost.onclick = async () => {
  if (!state.currentFile || !state.currentFile.path) { alert('ファイルパスが不明です'); return; }
  
  let url = state.serverUrl;
  if (!url) {
    url = prompt('Backend Server URL (Cloudflare/IP):', state.serverUrl);
    if (!url) return;
    state.serverUrl = url;
    localStorage.setItem('re_server_url', url);
  }

  const dryRun = !window.confirm('本当に実投稿しますか？（キャンセルで Dry Run 実行）');
  dom.loading.style.display = 'block';
  
  try {
    const res = await fetch(`${url}/api/x-post`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        
      },
      body: JSON.stringify({ path: state.currentFile.path, dryRun })
    });
    const data = await res.json();
    alert(`${data.message}${dryRun ? ' (Dry Run)' : ''}\n${data.output || data.error || ''}`);
  } catch (e) {
    alert('投稿に失敗しました。サーバーURLとCORS設定を確認してください。');
  } finally {
    dom.loading.style.display = 'none';
  }
};

dom.btnMovePosted.onclick = async () => {
  if (!state.currentFile || !state.currentFile.path) { alert('ファイルパスが不明です'); return; }
  if (!window.confirm(`「${state.currentFile.name}」を投稿済みフォルダへ移動しますか？`)) return;
  
  let url = state.serverUrl;
  if (!url) {
    url = prompt('Backend Server URL:', state.serverUrl);
    if (!url) return;
    state.serverUrl = url;
    localStorage.setItem('re_server_url', url);
  }

  dom.loading.style.display = 'block';
  try {
    const res = await fetch(`${url}/api/x-move-to-posted`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        
      },
      body: JSON.stringify({ path: state.currentFile.path })
    });
    const data = await res.json();
    if (res.ok) {
      alert('移動しました。GitHub Actions による更新まで少し時間がかかる場合があります。');
      dom.previewOverlay.style.display = 'none';
      loadRoot();
    } else {
      alert('移動に失敗しました: ' + data.details);
    }
  } catch (e) {
    alert('サーバーに接続できません。');
  } finally {
    dom.loading.style.display = 'none';
  }
};

// --- Move to Posted ---
async function moveToPosted(file) {
  if (!window.confirm(`「${file.name}」を投稿済みフォルダへ移動しますか？`)) return;
  
  let url = state.serverUrl;
  if (!url) {
    url = prompt('Backend Server URL:', state.serverUrl);
    if (!url) return;
    state.serverUrl = url;
  }

  dom.loading.style.display = 'block';
  try {
    const res = await fetch(`${url}/api/x-move-to-posted`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        
      },
      body: JSON.stringify({ path: file.path })
    });
    const data = await res.json();
    if (res.ok) {
      alert('移動しました。GitHub Actions による更新まで少し時間がかかる場合があります。');
      loadRoot();
    } else {
      alert('移動に失敗しました: ' + data.details);
    }
  } catch (e) {
    alert('サーバーに接続できません。');
  } finally {
    dom.loading.style.display = 'none';
  }
}

function extractDateFromPath(filePath) {
  const match = filePath.match(/(\d{4})(\d{2})(\d{2})/);
  if (match) return `${match[1]}/${match[2]}/${match[3]}`;
  return '';
}

// --- Execute Posting ---
async function executePosting(dryRun) {
  if (!state.currentFile || !state.currentFile.path) return;
  
  let url = state.serverUrl;
  if (!url) {
    url = prompt('Backend Server URL (Tailscale IP/Cloudflare):', state.serverUrl);
    if (!url) return;
    state.serverUrl = url;
    localStorage.setItem('re_server_url', url);
  }

  dom.loading.style.display = 'block';
  try {
    const res = await fetch(`${url}/api/x-post`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: state.currentFile.path, dryRun })
    });
    
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.details || errData.error || `HTTP ${res.status}`);
    }

    const data = await res.json();
    alert(`[${dryRun ? 'Dry Run' : 'Success'}] ${data.message}\n${data.output || ''}`);
  } catch (e) {
    console.error('X-Post Error:', e);
    alert(`投稿に失敗しました。\nURL: ${url}/api/x-post\nエラー: ${e.message}`);
  } finally {
    dom.loading.style.display = 'none';
  }
}

init();
