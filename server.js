const express = require('express');
const path = require('path');

const app = express();
const PORT = 3000;

// API endpoint for Firebase config
app.get('/api/firebase-config', (req, res) => {
  res.json({
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID,
    measurementId: process.env.FIREBASE_MEASUREMENT_ID
  });
});

const fs = require('fs');
const crypto = require('crypto');

// ファイルハッシュまたはサーバー起動時刻からBUILD_IDを動的生成
function getBuildId() {
  try {
    const swPath = path.join(__dirname, 'sw.js');
    const indexHtml = path.join(__dirname, 'index.html');
    const hash = crypto.createHash('md5');
    if (fs.existsSync(swPath)) hash.update(fs.readFileSync(swPath));
    if (fs.existsSync(indexHtml)) hash.update(fs.readFileSync(indexHtml));
    return hash.digest('hex').substring(0, 10);
  } catch (e) {
    return Date.now().toString(36);
  }
}

// sw.js 配信ルート (BUILD_IDを自動置換して配信。バージョンの上げ忘れを防止)
app.get('/sw.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Service-Worker-Allowed', '/');

  try {
    const swPath = path.join(__dirname, 'sw.js');
    let swContent = fs.readFileSync(swPath, 'utf8');
    const buildId = getBuildId();
    swContent = swContent.replace(
      /const BUILD_ID\s*=\s*['"][^'"]*['"];/,
      `const BUILD_ID = '${buildId}';`
    );
    res.send(swContent);
  } catch (err) {
    res.status(500).send('/* Error serving Service Worker */');
  }
});

// Serve static files from the current directory with optimized SW headers
app.use(express.static(__dirname, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('sw.js')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Service-Worker-Allowed', '/');
    }
  }
}));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on http://0.0.0.0:${PORT}`);
});
