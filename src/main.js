// --- State Management ---
let state = {
  token: localStorage.getItem('gh_token') || '',
  repo: localStorage.getItem('gh_repo') || 'AIFinanceLab/workspace',
  password: localStorage.getItem('access_password') || '',
  isLoggedIn: false,
  currentPath: '',
  currentObjectURL: null,
  serverUrl: localStorage.getItem('re_server_url') || '',
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
  btnXPost: document.getElementById('btn-x-post')
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
    const response = await fetch(`https://api.github.com/repos/${state.repo}/contents/${path}`, {
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
  renderTree(data, dom.fileList);
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
    if (data.encoding === 'base64') {
      const decoded = decodeBase64(data.content);
      dom.previewBody.innerHTML = `<pre>${decoded}</pre>`;
    } else {
      dom.previewBody.innerHTML = '<div style="color: var(--text-dim)">このファイルタイプは表示できません。</div>';
    }
  } catch (err) {
    dom.previewBody.innerHTML = '<div style="color: #ef4444">エラー: ' + err.message + '</div>';
  }
}

function decodeBase64(str) {
  return decodeURIComponent(escape(atob(str.replace(/\s/g, ''))));
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

init();
