// --- State Management ---
let state = {
  token: localStorage.getItem('gh_token') || '',
  repo: localStorage.getItem('gh_repo') || '',
  password: localStorage.getItem('access_password') || '',
  isLoggedIn: false,
  currentPath: ''
};

const dom = {
  hero: document.getElementById('hero'),
  explorer: document.getElementById('explorer-view'),
  fileList: document.getElementById('file-list'),
  breadcrumb: document.getElementById('breadcrumb'),
  dockItems: document.querySelectorAll('.dock-item'),
  settingsModal: document.getElementById('settings-modal'),
  loginModal: document.getElementById('login-modal'),
  inputToken: document.getElementById('input-token'),
  inputRepo: document.getElementById('input-repo'),
  inputPassword: document.getElementById('input-password'),
  inputLoginPassword: document.getElementById('input-login-password')
};

// --- Initialization ---
function init() {
  if (state.password) {
    showModal('login-modal');
  } else if (state.token && state.repo) {
    state.isLoggedIn = true;
    showView('explorer');
    loadFiles('');
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

// --- Data Fetching ---
async function loadFiles(path) {
  if (!state.token || !state.repo) {
    alert('設定からGitHubトークンとリポジトリを指定してください。');
    showModal('settings-modal');
    return;
  }

  state.currentPath = path;
  updateBreadcrumb(path);
  dom.fileList.innerHTML = '<li class="file-item">Loading...</li>';

  try {
    const response = await fetch(`https://api.github.com/repos/${state.repo}/contents/${path}`, {
      headers: {
        'Authorization': `token ${state.token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!response.ok) throw new Error('API Error: ' + response.statusText);

    const data = await response.json();
    renderFiles(data);
  } catch (err) {
    dom.fileList.innerHTML = `<li class="file-item" style="color: #ef4444">${err.message}</li>`;
  }
}

function renderFiles(files) {
  dom.fileList.innerHTML = '';

  // Sort: Directories first
  files.sort((a, b) => (b.type === 'dir' ? 1 : -1) - (a.type === 'dir' ? 1 : -1));

  files.forEach(file => {
    const li = document.createElement('li');
    li.className = 'file-item';
    const icon = file.type === 'dir' ? '📁' : '📄';

    li.innerHTML = `
      <span class="icon">${icon}</span>
      <span class="name">${file.name}</span>
    `;

    li.onclick = () => {
      if (file.type === 'dir') {
        loadFiles(file.path);
      } else {
        window.open(file.html_url, '_blank');
      }
    };

    dom.fileList.appendChild(li);
  });
}

function updateBreadcrumb(path) {
  const parts = path.split('/').filter(p => p);
  dom.breadcrumb.innerHTML = '<span data-path="">root</span>';

  let currentAccumulatedPath = '';
  parts.forEach(part => {
    currentAccumulatedPath += (currentAccumulatedPath ? '/' : '') + part;
    const span = document.createElement('span');
    span.innerHTML = ` / ${part}`;
    span.dataset.path = currentAccumulatedPath;
    span.onclick = () => loadFiles(span.dataset.path);
    dom.breadcrumb.appendChild(span);
  });

  dom.breadcrumb.querySelector('span').onclick = () => loadFiles('');
}

// --- Event Listeners ---
document.getElementById('dock-home').onclick = () => showView('home');
document.getElementById('dock-files').onclick = () => {
  if (state.isLoggedIn || !state.password) {
    showView('explorer');
    loadFiles(state.currentPath);
  } else {
    showModal('login-modal');
  }
};
document.getElementById('dock-settings').onclick = () => {
  dom.inputToken.value = state.token;
  dom.inputRepo.value = state.repo;
  dom.inputPassword.value = state.password;
  showModal('settings-modal');
};

document.getElementById('btn-settings-close').onclick = () => closeModal('settings-modal');
document.getElementById('btn-settings-save').onclick = () => {
  state.token = dom.inputToken.value;
  state.repo = dom.inputRepo.value;
  state.password = dom.inputPassword.value;

  localStorage.setItem('gh_token', state.token);
  localStorage.setItem('gh_repo', state.repo);
  localStorage.setItem('access_password', state.password);

  closeModal('settings-modal');
  if (state.token && state.repo) {
    state.isLoggedIn = true;
    showView('explorer');
    loadFiles('');
  }
};

document.getElementById('btn-login-submit').onclick = () => {
  if (dom.inputLoginPassword.value === state.password) {
    state.isLoggedIn = true;
    closeModal('login-modal');
    showView('explorer');
    loadFiles('');
  } else {
    alert('パスワードが違います。');
  }
};

init();
