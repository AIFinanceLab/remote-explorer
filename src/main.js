// --- State Management ---
let state = {
  token: localStorage.getItem('gh_token') || '',
  repo: localStorage.getItem('gh_repo') || 'AIFinanceLab/workspace',
  password: localStorage.getItem('access_password') || '',
  isLoggedIn: false,
  currentPath: '',
  currentObjectURL: null,
  serverUrl: localStorage.getItem('re_server_url') || 'https://macbook-air.taild4f7f4.ts.net',
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
  
  // Posting UI
  posting: document.getElementById('posting-view'),
  draftList: document.getElementById('draft-list'),
  postedList: document.getElementById('posted-list'),
  postOverlay: document.getElementById('posting-preview-overlay'),
  postEditor: document.getElementById('post-editor'),
  postFilename: document.getElementById('posting-filename')
};

// --- Initialization ---
function init() {
  if (state.password && !state.isLoggedIn) {
    showModal('login-modal');
  } else if (state.token && state.repo) {
    state.isLoggedIn = true;
    showView('explorer');
    setDefaultBreadcrumb();
    loadRoot();
  }
}

// --- Navigation & Views ---
function setDefaultBreadcrumb() {
  dom.breadcrumb.innerHTML = `
    <span data-path="" style="cursor:pointer">root</span>
    <span style="color: var(--text-dim); margin: 0 4px;">/</span>
    <span data-path="artisans/x-poster/drafts" class="shortcut-btn" id="drafts-btn" title="ドラフトフォルダへジャンプ">📝 Drafts</span>
  `;
  // Re-attach click handler for root
  dom.breadcrumb.querySelector('[data-path=""]').onclick = () => {
    loadRoot();
    setDefaultBreadcrumb();
  };
  // Re-attach drafts click handler
  dom.breadcrumb.querySelector('#drafts-btn').onclick = async () => {
    const data = await githubFetch('artisans/x-poster/drafts');
    if (data) {
      setDraftsBreadcrumb();
      renderDraftsTree(data, dom.fileList);
    }
  };
}

function setDraftsBreadcrumb() {
  dom.breadcrumb.innerHTML = `
    <span data-path="" style="cursor:pointer">root</span>
    <span style="color: var(--text-dim); margin: 0 4px;">/</span>
    <span data-path="artisans/x-poster/drafts" class="shortcut-btn" id="drafts-btn" title="ドラフトフォルダへジャンプ">📝 Drafts</span>
  `;
  // Re-attach click handler for root
  dom.breadcrumb.querySelector('[data-path=""]').onclick = () => {
    loadRoot();
    setDefaultBreadcrumb();
  };
  // Re-attach drafts click handler
  dom.breadcrumb.querySelector('#drafts-btn').onclick = async () => {
    const data = await githubFetch('artisans/x-poster/drafts');
    if (data) {
      setDraftsBreadcrumb();
      renderDraftsTree(data, dom.fileList);
    }
  };
}

function showView(view) {
  dom.hero.style.display = view === 'home' ? 'block' : 'none';
  dom.explorer.style.display = view === 'explorer' ? 'block' : 'none';
  dom.posting.style.display = view === 'post' ? 'block' : 'none';

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
        'Accept': 'application/vnd.github.v3+json'
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
  renderDraftsTree(data, dom.fileList);
}

function renderTree(items, container) {
  container.innerHTML = '';

  // Sort: Directories first
  items.sort((a, b) => (b.type === 'dir' ? 1 : -1) - (a.type === 'dir' ? 1 : -1));

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

    itemEl.innerHTML = `
      ${arrow}
      <span class="icon">${icon}</span>
      <span class="name">${item.name}</span>
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
          renderTree(children, nextUl);
        }
      };
    } else {
      itemEl.onclick = (e) => {
        e.stopPropagation();
        previewFile(item);
      };
    }

    container.appendChild(li);
  });
}

function renderDraftsTree(items, container) {
  container.innerHTML = '';

  // Sort: Directories first
  items.sort((a, b) => (b.type === 'dir' ? 1 : -1) - (a.type === 'dir' ? 1 : -1));

  items.forEach(item => {
    const li = document.createElement('li');
    const isDir = item.type === 'dir';

    // Item container
    const itemEl = document.createElement('div');
    itemEl.className = 'file-item draft-item';

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

    // Action buttons for draft items (skip temp folder)
    const isTemp = item.name === 'temp';
    const actionBtns = isDir && !isTemp ? `
      <span class="draft-item-actions">
        <button class="action-btn post-btn" title="投稿" onclick="event.stopPropagation(); executePostingForItem('${item.path}')">🚀</button>
        <button class="action-btn posted-btn" title="ポスト済み" onclick="event.stopPropagation(); moveToPostedFolder('${item.path}','${item.name}')">📋</button>
        <button class="action-btn delete-btn" title="削除" onclick="event.stopPropagation(); deleteFolder('${item.path}','${item.name}')">🗑️</button>
      </span>
    ` : '';

    itemEl.innerHTML = `
      ${arrow}
      <span class="icon">${icon}</span>
      <span class="name">${item.name}</span>
      ${actionBtns}
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
          renderDraftsTree(children, nextUl);
        }
      };
    } else {
      itemEl.onclick = (e) => {
        e.stopPropagation();
        previewFile(item);
      };
    }

    container.appendChild(li);
  });
}

// Post a draft folder via AppleScript
async function executePostingForItem(folderPath) {
  let url = state.serverUrl;
  if (!url) {
    url = prompt('Backend Server URL:', state.serverUrl);
    if (!url) return;
    state.serverUrl = url;
  }

  // Find the first .md file in the folder to post
  let mdPath = folderPath;
  if (!folderPath.endsWith('.md')) {
    try {
      const items = await githubFetch(folderPath);
      const mdItem = items.find(i => i.name.endsWith('.md'));
      if (mdItem) mdPath = mdItem.path;
    } catch (e) {
      console.warn('Could not find md file in folder:', e);
    }
  }

  dom.loading.style.display = 'block';
  try {
    const res = await fetch(`${url}/api/x-post`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: mdPath, dryRun: false })
    });
    const data = await res.json();
    if (res.ok) {
      alert('投稿を開始しました（AppleScript）。完了までしばらくお待ちください。');
    } else {
      alert('投稿に失敗しました: ' + (data.details || data.error));
    }
  } catch (e) {
    alert('サーバーに接続できません: ' + e.message);
  } finally {
    dom.loading.style.display = 'none';
  }
}

// Move draft folder to posted
async function moveToPostedFolder(folderPath, folderName) {
  if (!confirm(`「${folderName}」を投稿済みフォルダへ移動しますか？`)) return;

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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: folderPath })
    });
    const data = await res.json();
    if (res.ok) {
      alert('移動しました。');
      const draftsData = await githubFetch('artisans/x-poster/drafts');
      if (draftsData) renderDraftsTree(draftsData, dom.fileList);
    } else {
      alert('移動に失敗しました: ' + (data.details || data.error));
    }
  } catch (e) {
    alert('サーバーに接続できません: ' + e.message);
  } finally {
    dom.loading.style.display = 'none';
  }
}

// Delete draft folder
async function deleteFolder(folderPath, folderName) {
  if (!confirm(`「${folderName}」を削除しますか？`)) return;

  let url = state.serverUrl;
  if (!url) {
    url = prompt('Backend Server URL:', state.serverUrl);
    if (!url) return;
    state.serverUrl = url;
  }

  dom.loading.style.display = 'block';
  try {
    const res = await fetch(`${url}/api/x-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: folderPath })
    });
    const data = await res.json();
    if (res.ok) {
      alert(`${folderName} を削除しました。`);
      const draftsData = await githubFetch('artisans/x-poster/drafts');
      if (draftsData) renderDraftsTree(draftsData, dom.fileList);
    } else {
      alert('削除に失敗しました: ' + (data.details || data.error));
    }
  } catch (e) {
    alert('サーバーに接続できません: ' + e.message);
  } finally {
    dom.loading.style.display = 'none';
  }
}

// --- Preview Logic ---
async function previewFile(file) {
  state.currentFile = file;
  dom.previewFilename.innerText = file.name;
  dom.previewBody.innerHTML = '<div style="color: var(--text-dim)">読み込み中...</div>';
  dom.previewOverlay.style.display = 'flex';

  // Show X-Post button if markdown
  if (file.name.endsWith('.md')) {
    dom.btnXPost.style.display = 'block';
  } else {
    dom.btnXPost.style.display = 'none';
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
          'Accept': 'application/vnd.github.v3.raw' // Important: Get raw bytes
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
document.getElementById('dock-post').onclick = () => {
  if (state.isLoggedIn || !state.password) {
    showView('post');
    loadDrafts();
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
      headers: { 'Content-Type': 'application/json' },
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

// --- Posting Logic ---
async function loadDrafts() {
  dom.draftList.innerHTML = '<p style="color: var(--text-dim)">ドラフトを検索中...</p>';
  dom.postedList.innerHTML = '<p style="color: var(--text-dim)">読み込み中...</p>';
  
  try {
    const fetchDir = async (dir) => {
      try {
        const items = await githubFetch(dir);
        let files = [];
        for (const item of items) {
          if (item.type === 'dir') {
            const subItems = await githubFetch(item.path);
            files = files.concat(subItems.filter(f => f.name.endsWith('.md')));
          } else if (item.name.endsWith('.md')) {
            files.push(item);
          }
        }
        return files;
      } catch (e) { return []; }
    };

    const drafts = await fetchDir('artisans/x-poster/drafts');
    const posted = await fetchDir('artisans/x-poster/posted');

    renderPostingList(drafts, dom.draftList, true);
    renderPostingList(posted, dom.postedList, false);
  } catch (err) {
    dom.draftList.innerHTML = `<p style="color: #ef4444">エラー: ${err.message}</p>`;
  }
}

function renderPostingList(files, container, isDraft) {
  if (files.length === 0) {
    container.innerHTML = `<p style="color: var(--text-dim)">見つかりませんでした。</p>`;
    return;
  }

  container.innerHTML = '';
  files.forEach(file => {
    const fileId = `file-${file.sha}`;
    const dateStr = extractDateFromPath(file.path);
    
    // Fallback title: parent folder name (e.g. 20260313_mirofish_spx_ai)
    const folderName = file.path.split('/').slice(-2, -1)[0] || file.name;

    const div = document.createElement('div');
    div.className = 'draft-item';
    if (!isDraft) div.classList.add('posted-item');

    div.innerHTML = `
      <div class="draft-info" id="${fileId}">
        <div class="draft-icon-area"></div>
        <div class="draft-name">
          <span class="title-text">${folderName}</span>
          <span class="draft-date">${dateStr}</span>
        </div>
      </div>
      <div class="row-actions">
        ${isDraft ? `
          <button class="row-btn post-btn" title="投稿">🚀</button>
          <button class="row-btn move-btn" title="完了">📦</button>
          <button class="row-btn delete-btn" title="削除">🗑️</button>
        ` : `
          <div class="posted-badge">配信済み</div>
        `}
      </div>
    `;

    // Row-wide click listener for info area
    const infoEl = div.querySelector('.draft-info');
    infoEl.onclick = (e) => {
      e.stopPropagation();
      openContentPreview(file);
    };

    if (isDraft) {
      div.querySelector('.post-btn').onclick = (e) => {
        e.stopPropagation();
        state.currentFile = file; // Set context
        executePosting(false); // Rocket 🚀 = Real Post
      };
      div.querySelector('.move-btn').onclick = (e) => {
        e.stopPropagation();
        moveToPosted(file);
      };
      div.querySelector('.delete-btn').onclick = (e) => {
        e.stopPropagation();
        deleteDraftFolder(file);
      };
    } else {
      div.onclick = () => openContentPreview(file);
    }

    container.appendChild(div);
    fetchAndSetTitle(file, fileId);
  });
}

async function openContentPreview(file) {
  previewFile(file);
}

function extractDateFromPath(filePath) {
  const match = filePath.match(/(\d{4})(\d{2})(\d{2})/);
  if (match) return `${match[1]}/${match[2]}/${match[3]}`;
  return '';
}

async function fetchAndSetTitle(file, domId) {
  try {
    const data = await githubFetch(file.path);
    if (data.content) {
      const content = decodeBase64(data.content);
      
      // Improved robust title extraction (YAML title: or # H1)
      let title = '';
      const fmMatch = content.match(/^\s*title:\s*(.*)$/m);
      if (fmMatch) {
        title = fmMatch[1].trim().replace(/^["']|["']$/g, '');
      } else {
        const h1Match = content.match(/^\s*#\s*(.*)$/m);
        if (h1Match) title = h1Match[1].trim();
      }

      if (title) {
        const infoEl = document.getElementById(domId);
        if (infoEl) {
          const textEl = infoEl.querySelector('.title-text');
          if (textEl) textEl.innerText = title;
          
          // Media icon extraction logic
          let icon = '📄';
          const mediaSection = content.match(/^\s*media:\s*([\s\S]*?)(?=\n\w|---|^\s*$|$)/m);
          if (mediaSection) {
            const mediaValue = mediaSection[1];
            if (mediaValue.match(/\.(mp4|mov|webm|avi|mkv)/i)) icon = '🎬';
            else if (mediaValue.match(/\.(jpg|jpeg|png|gif|svg|webp)/i)) icon = '🖼️';
          }
          const iconArea = infoEl.querySelector('.draft-icon-area');
          if (iconArea) iconArea.innerText = icon;
        }
      }
    }
  } catch (e) {
    console.warn('Metadata fetch failed for', file.path, e);
  }
}

async function moveToPosted(file) {
  // Get parent folder path (e.g. artisans/x-poster/drafts/20260316_soft_kill_system)
  const folderPath = file.path.replace(/\/[^/]+$/, '');
  const folderName = folderPath.split('/').pop();
  if (!confirm(`「${folderName}」を投稿済みフォルダへ移動しますか？`)) return;

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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: folderPath })
    });
    const data = await res.json();
    if (res.ok) {
      alert(`${folderName} を投稿済みに移動しました。`);
      loadDrafts(); // UIを再読み込み
    } else {
      alert('移動に失敗しました: ' + data.details);
    }
  } catch (e) {
    alert('サーバーに接続できません。');
  } finally {
    dom.loading.style.display = 'none';
  }
}

async function deleteDraftFolder(file) {
  // Get parent folder path (e.g. artisans/x-poster/drafts/20260316_soft_kill_system)
  const folderPath = file.path.replace(/\/[^/]+$/, '');
  const folderName = folderPath.split('/').pop();
  if (!confirm(`「${folderName}」フォルダごと削除しますか？`)) return;

  let url = state.serverUrl;
  if (!url) {
    url = prompt('Backend Server URL:', state.serverUrl);
    if (!url) return;
    state.serverUrl = url;
  }

  dom.loading.style.display = 'block';
  try {
    const res = await fetch(`${url}/api/x-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: folderPath })
    });
    const data = await res.json();
    if (res.ok) {
      alert(`${folderName} を削除しました。`);
      loadDrafts();
    } else {
      alert('削除に失敗しました: ' + (data.details || data.error));
    }
  } catch (e) {
    alert('サーバーに接続できません。');
  } finally {
    dom.loading.style.display = 'none';
  }
}

async function deleteFile(file) {
  let url = state.serverUrl;
  if (!url) {
    url = prompt('Backend Server URL:', state.serverUrl);
    if (!url) return;
    state.serverUrl = url;
  }

  dom.loading.style.display = 'block';
  try {
    const res = await fetch(`${url}/api/x-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: file.path })
    });
    const data = await res.json();
    if (res.ok) {
      alert(`${file.name} を削除しました。`);
      loadDrafts();
    } else {
      alert('削除に失敗しました: ' + (data.details || data.error));
    }
  } catch (e) {
    alert('サーバーに接続できません。');
  } finally {
    dom.loading.style.display = 'none';
  }
}

async function openDraftEditor(file) {
  state.currentFile = file;
  dom.postFilename.innerText = file.name;
  dom.postEditor.value = '読み込み中...';
  dom.postOverlay.style.display = 'flex';

  try {
    const data = await githubFetch(file.path);
    if (data.content) {
      dom.postEditor.value = decodeBase64(data.content);
    }
  } catch (err) {
    dom.postEditor.value = '読み込みに失敗しました: ' + err.message;
  }
}

document.getElementById('close-posting-preview').onclick = () => {
  dom.postOverlay.style.display = 'none';
};

async function executePosting(dryRun) {
  if (!state.currentFile || !state.currentFile.path) return;
  
  let url = state.serverUrl;
  if (!url) {
    url = prompt('Backend Server URL (Tailscale IP/Cloudflare):', state.serverUrl);
    if (!url) return;
    state.serverUrl = url;
    localStorage.setItem('re_server_url', url);
  }

  // Only confirm for Dry Run or if we want to be safe, but for Rocket button (dryRun=false), let's skip it if already confirmed or if user wants immediate.
  // Actually, per user request "Rocket button clicked -> Immediate post", we skip confirm here.
  // But wait, the rocket button handler calls executePosting(false).
  // Let's make it so it only confirms if it's NOT a direct rocket launch.
  
  /* 
  const confirmMsg = dryRun ? 'Dry Run を実行しますか？' : '本当に実投稿しますか？';
  if (!window.confirm(confirmMsg)) return;
  */

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
    alert(`投稿に失敗しました。\nURL: ${url}/api/x-post\nエラー: ${e.message}\n\n※HTTPS(GitHub Pages)からHTTPへのアクセスはブラウザにブロックされる場合があります。`);
  } finally {
    dom.loading.style.display = 'none';
  }
}

document.getElementById('btn-final-post').onclick = () => executePosting(false);
document.getElementById('btn-dry-post').onclick = () => executePosting(true);

// Expose functions to global scope for onclick handlers
window.executePostingForItem = executePostingForItem;
window.moveToPostedFolder = moveToPostedFolder;
window.deleteFolder = deleteFolder;
window.deleteDraftFolder = deleteDraftFolder;

init();
