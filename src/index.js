/*jshint esversion:6*/
const electron = require('electron');
const {shell, ipcMain, dialog} = require('electron');
let app = electron.app;
let BrowserWindow = electron.BrowserWindow;

let mainWindow = null;
app.on('ready', () => {
  // mainWindowを作成（windowの大きさや、Kioskモードにするかどうかなどもここで定義できる）
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  // Electronに表示するhtmlを絶対パスで指定（相対パスだと動かない）
  mainWindow.loadURL('file://' + __dirname + '/index.html');

  mainWindow.webContents.on('new-window', (event, url) => {
    event.preventDefault();
    shell.openExternal(url);
  });

  // ChromiumのDevツールを開く
  //mainWindow.webContents.openDevTools();

  const { Menu } = require('electron');
  const menuTemplate = [];
  
  if (process.platform === 'darwin') {
    menuTemplate.push({
      label: 'Edit',
      submenu: [
        {role: 'undo'},
        {role: 'redo'},
        {type: 'separator'},
        {role: 'cut'},
        {role: 'copy'},
        {role: 'paste'},
        {role: 'pasteandmatchstyle'},
        {role: 'delete'},
        {role: 'selectall'}
      ]
    })

    const applicationMenu = Menu.buildFromTemplate(menuTemplate)
    Menu.setApplicationMenu(applicationMenu)
  }  
});

app.on("window-all-closed", function () {
  app.quit();
});

ipcMain.handle('select-target-dir', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'フォルダの選択',
    defaultPath: '.'
  });
  return result.canceled ? undefined : result.filePaths[0];
});

ipcMain.handle('create-article', async () => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '新規作成',
    defaultPath: '.',
    filters: [
      { name: 'Markdownファイル', extensions: ['md'] },
    ]
  });
  return result.canceled ? undefined : result.filePath;
});

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, argv, workingDirectory) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}
