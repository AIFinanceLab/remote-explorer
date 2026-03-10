import express from 'express';
import { WebSocketServer } from 'ws';
import * as pty from 'node-pty';
import os from 'os';
import http from 'http';
import cors from 'cors';

const app = express();
app.use(cors());

// HTTPサーバーの構築
const server = http.createServer(app);

// WebSocketサーバーの構築（HTTPサーバーにアタッチ）
const wss = new WebSocketServer({ server });

const shell = os.platform() === 'win32' ? 'powershell.exe' : process.env.SHELL || 'zsh';

wss.on('connection', (ws) => {
  console.log('Client connected to terminal');

  // node-ptyでシェルプロセスを起動
  const ptyProcess = pty.spawn(shell, [], {
    name: 'xterm-color',
    cols: 80,
    rows: 30,
    cwd: process.env.HOME,
    env: process.env
  });

  // PTYからの出力をWebSocket経由でクライアントに送信
  ptyProcess.onData((data) => {
    ws.send(data);
  });

  // クライアントからの入力をPTYに書き込む
  ws.on('message', (message) => {
    // クライアントからのメッセージがバイナリやBufferで来る可能性も考慮
    ptyProcess.write(message.toString());
  });

  // クライアント切断時にPTYプロセスを終了
  ws.on('close', () => {
    console.log('Client disconnected');
    ptyProcess.kill();
  });
});

const PORT = 8080;
server.listen(PORT, () => {
  console.log(`[Terminal Server] Listening on http://localhost:${PORT}`);
  console.log(`[Terminal Server] WebSocket endpoint ws://localhost:${PORT}`);
});
