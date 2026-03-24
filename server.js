const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { exec } = require('child_process');
const os = require('os');

const app = express();
const PORT = 3001;

// ワークスペース全体をエクスプローラーのルートにする
const BASE_DIR = path.resolve(__dirname, '../../'); 
// フロントエンドのビルド成果物の場所
const WEB_DIST_DIR = path.resolve(__dirname, './dist');

const FORBIDDEN_PATTERNS = [".env", ".git", ".DS_Store", "node_modules", "key"];

app.use(cors());
app.use(express.json());

// 1. 本番用ビルド成果物 (dist) を優先的に配信
app.use(express.static(WEB_DIST_DIR));

// ローカルIPアドレスを取得するヘルパー
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// 安全なパスかチェック
function isSafe(filePath) {
  const relative = path.relative(BASE_DIR, filePath);
  if (relative.startsWith('..')) return false;
  return !FORBIDDEN_PATTERNS.some(pattern => filePath.includes(pattern));
}

// 接続情報エンドポイント
app.get('/api/info', (req, res) => {
  res.json({
    local_url: `http://localhost:${PORT}`,
    network_url: `http://${getLocalIP()}:${PORT}`,
    workspace_root: BASE_DIR
  });
});

// ディレクトリツリーの取得
app.get('/api/tree', (req, res) => {
  const targetDir = req.query.path ? path.join(BASE_DIR, req.query.path) : BASE_DIR;
  if (!isSafe(targetDir)) return res.status(403).json({ error: 'Access restricted' });

  try {
    const items = fs.readdirSync(targetDir, { withFileTypes: true })
      .filter(item => isSafe(item.name))
      .map(item => ({
        name: item.name,
        path: path.relative(BASE_DIR, path.join(targetDir, item.name)),
        isDirectory: item.isDirectory()
      }));
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// ファイル内容の取得
app.get('/api/content', (req, res) => {
  const filePath = path.join(BASE_DIR, req.query.path);
  if (!isSafe(filePath) || !fs.statSync(filePath).isFile()) return res.status(403).send('Denied');

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    res.json({
      name: path.basename(filePath),
      content,
      language: path.extname(filePath).slice(1) || 'text'
    });
  } catch (err) {
    res.status(500).send('Error');
  }
});

// X (Twitter) への投稿実行 (ASYNC MODEL to avoid Timeouts)
app.post('/api/x-post', (req, res) => {
  const { path: relativePath, dryRun } = req.body;
  let filePath = path.join(BASE_DIR, relativePath);

  console.log(`[HTTP POST] /api/x-post (ASYNC): relativePath=${relativePath}, dryRun=${dryRun}`);

  if (!isSafe(filePath)) {
    return res.status(403).json({ error: 'Access restricted' });
  }

  // If it's a directory, find post.md first, then fall back to any .md
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    const files = fs.readdirSync(filePath);
    const mdFile = files.find(f => f === 'post.md') || files.find(f => f.endsWith('.md'));
    if (mdFile) {
      filePath = path.join(filePath, mdFile);
      console.log(`[INFO] Folder detected, using: ${mdFile}`);
    }
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found locally' });
  }

  const scriptPath = '/Users/kenta/.openclaw/workspace/workers/x-poster/scripts/applescript_post.py';
  const command = `python3 "${scriptPath}" "${filePath}" ${dryRun ? '--dry-run' : ''}`;

  console.log(`[EXECUTE (BG)] ${command}`);

  res.json({
    message: 'Post initiated in background. Please wait ~60s for the video to process.',
    status: 'pending'
  });

  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`[BG EXEC ERROR] Code: ${error.code}`);
    } else {
      console.log(`[+] Post Task Completed for: ${relativePath}`);
    }
  });
});

// 削除処理：ドラフトフォルダを削除
app.post('/api/x-delete', (req, res) => {
  const { path: relativePath } = req.body;
  const targetPath = path.join(BASE_DIR, relativePath);

  if (!isSafe(targetPath)) {
    return res.status(403).json({ error: 'Invalid path' });
  }

  try {
    const isDir = fs.statSync(targetPath).isDirectory();
    const rmFlag = isDir ? '-r' : '';
    const command = `git rm ${rmFlag} "${targetPath}" && git commit -m "chore: delete ${path.basename(targetPath)}" && git push`;
    exec(command, { cwd: BASE_DIR }, (error) => {
      if (error) {
        // Fallback
        if (isDir) {
          fs.rmSync(targetPath, { recursive: true });
        } else {
          fs.unlinkSync(targetPath);
        }
        res.json({ message: 'Deleted (fallback)' });
      } else {
        res.json({ message: 'Deleted & Pushed' });
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal Error', details: err.message });
  }
});

// 移動処理：drafts から posted へ
app.post('/api/x-move-to-posted', (req, res) => {
  const { path: relativePath } = req.body;
  const sourcePath = path.join(BASE_DIR, relativePath);

  if (!isSafe(sourcePath)) {
    return res.status(403).json({ error: 'Invalid path' });
  }

  const destRelativePath = relativePath.replace('workers/x-poster/drafts', 'workers/x-poster/posted');
  const destPath = path.join(BASE_DIR, destRelativePath);
  const destDir = path.dirname(destPath);

  try {
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

    const command = `git mv "${sourcePath}" "${destPath}" && git commit -m "chore: move ${path.basename(sourcePath)} to posted" && git push`;

    exec(command, { cwd: BASE_DIR }, (error) => {
      if (error) {
        fs.renameSync(sourcePath, destPath);
        res.json({ message: 'Moved (fallback to fs.rename)' });
      } else {
        res.json({ message: 'Moved & Pushed' });
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal Error', details: err.message });
  }
});

// 2. SPAフォールバック：すべての非APIリクエストを index.html に向ける
app.get('*', (req, res) => {
  res.sendFile(path.join(WEB_DIST_DIR, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Stable Remote Explorer is live!`);
  console.log(`Local Access: http://localhost:${PORT}`);
  console.log(`Network Access: http://${getLocalIP()}:${PORT}\n`);
});
