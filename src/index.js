const electron = require('electron');
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;

let mainWindow = null;
app.on('ready', () => {
  // mainWindowを作成（windowの大きさや、Kioskモードにするかどうかなどもここで定義できる）
  mainWindow = new BrowserWindow({width: 1000, height: 800});
  // Electronに表示するhtmlを絶対パスで指定（相対パスだと動かない）
  mainWindow.loadURL('file://' + __dirname + '/index.html');

  // ChromiumのDevツールを開く
  mainWindow.webContents.openDevTools();
});

app.on("window-all-closed", function () {
  if (process.platform !== "darwin") {
    app.quit();
  }
});