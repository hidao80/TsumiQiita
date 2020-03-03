/*jshint esversion:6*/
var timer;
const WRITE_INTERVAL = 3000;
const hljs = require('highlight.js');
const Config = require('electron-store');
const config = new Config();

function $(name) {
  return document.querySelector(name);
}

function fileNameEncode(name) {
  return name.replace(".", "_");
}

function getBody(md) {
  return md.match(/(-{3,}[\s\S])([\s\S.]*?)(-{3,}[\s\S])([\s\S.]*)/)[4];
}

function getHeader(md) {
  return md.match(/(-{3,}[\s\S])([\s\S.]*?)(-{3,}[\s\S])([\s\S.]*)/)[2];
}

function writeMarkdownFile() {
  const currentFile = config.get('CURRENT_FILE');
  const md = $("#tsumiqiita-editor").value;

  if (currentFile !== undefined) {
    if (currentFile.length > 0) {
      const fs = require('fs');
      const filePath = currentFile.replace(/\\/g, "/");
      fs.writeFileSync(filePath, md);
      clearInterval(timer);
      $("#title").style.fontStyle = "normal";
    }
  }
}

function rendaring() {
  const it = require('markdown-it')('commonmark', {
    langPrefix: "hljs language-",
    highlight: (str, lang) => {
      var filename = '';
      if (lang && lang.indexOf(":") >= 1) {
        var sp = lang.split(":");
        lang = sp[0];
        filename = sp[1];
      }

      var header = "";
      var style = "style='margin-top:3px;'";
      if (filename) {
        header = "<div class='code-lang'>" + filename + "</div>";
        style = "";
      }

      var codeBlockHTML;
      if (lang) {
        try {
          codeBlockHTML = '<pre style="margin:0;"><code>' + hljs.highlight(lang, str).value + '</code></pre>';
        }
        catch (e) {
          codeBlockHTML = '<pre style="padding:8px;"><code>' + require("escape-html")(str) + '</code></pre>';
        }
      } else {
        codeBlockHTML = '<pre style="padding:8px;"><code>' + require("escape-html")(str) + '</code></pre>';
      }

      return "<div class='code-frame highlight' " + style + "'>" +
        header +
        "<div class='highlight'>" + codeBlockHTML + "</div>" +
        "</div>"
        ;
    },
  }).enable(['table', 'strikethrough']).use(require('markdown-it-checkbox'));
  const md = $("#tsumiqiita-editor").value;
  $("#preview").innerHTML = it.render(getBody(md));

  var myDivEl = document.getElementById("preview");
  var anchorsInMyDiv = myDivEl.querySelectorAll("a");
  anchorsInMyDiv.forEach(s => s.setAttribute("target", "_blank"));
}

function openMarkdownFile(path) {
  const fs = require('fs');
  fs.readFile(path, (error, text) => {
    if (error !== null) {
      return;
    }
    $("#tsumiqiita-editor").value = text.toString();

    rendaring();

    config.set('CURRENT_FILE', path);
  });
}

function autoSave() {
  try {
    $("#title").style.fontStyle = "italic";
    clearTimeout(timer);
    timer = setInterval(writeMarkdownFile, WRITE_INTERVAL);
  } catch (err) {
    return false;
  }
}

function setScrollSync() {
  const p = $('#preview');
  const e = $('#tsumiqiita-editor');

  e.onscroll = () => {
    let rate = e.scrollTop / e.scrollHeight;
    p.scrollTop = p.scrollHeight * rate;
  };
}


// ファイルリストを取得。mdファイルのみ。
function updateFileListPain(dir, givinefileName) {
  const fs = require('fs');
  const path = require('path');

  if (dir.length === 0) { return; }
  fs.readdir(dir, (err, files) => {
    if (err) { throw err; }
    let fileList = [];
    files.filter((file) => {
      const target = dir + path.sep + file;
      return fs.statSync(target).isFile() && /.*\.md$/.test(target); //絞り込み
    }).forEach((file) => {
      fileList.push(file);
    });

    // 画面に反映
    let fileListHtml = "";
    for (let fileName of fileList) {
      let filePath = dir + path.sep + fileName;
      let attrChecked = "";
      filePath = filePath.replace(/\\{1,}/g, "\\\\");
      if (givinefileName === fileName) {
        attrChecked = " checked=true";
      }
      fileListHtml += "<div class='files-item-div'>\n" +
        "  <input type='radio' class='files-item-radio' name='fileName' id='" + fileNameEncode(fileName) + "' onclick='openMarkdownFile(\"" + filePath + "\")'" + attrChecked + "><label for='" + fileNameEncode(fileName) + "' class='files-item-label'>" + fileName + "</label>\n" +
        "</div>\n";
    }

    $('#files').innerHTML = fileListHtml;
  });
}

function init_FileList(fileName) {
  let targetDir = config.get('TARGET_DIR');
  if (targetDir === undefined) { targetDir = ""; }
  else if (targetDir === "undefined") { targetDir = ""; }
  else if (targetDir.length === 0) { targetDir = "フォルダを選択してください"; }
  else { updateFileListPain(targetDir, fileName); }

  $('#target-dir').innerHTML = targetDir;
}

function init_LastOpenFile() {
  const currentFile = config.get('CURRENT_FILE');
  if (currentFile !== undefined) {
    if (currentFile.length > 0) {
      const filePath = currentFile.replace(/\\/g, "/");
      openMarkdownFile(filePath);

      return require('path').basename(currentFile);
    }
  }
  return null;
}

function init() {
  init_FileList(init_LastOpenFile());

  $('#input').value = config.get("TOKEN");

  setScrollSync();
  hljs.initHighlightingOnLoad();
}

function selectTargetDir() {
  const Dialog = require('electron').remote.dialog;

  Dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: 'フォルダの選択',
    defaultPath: '.'
  }, (folderNames) => {
    config.set('TARGET_DIR', folderNames[0]);
    $('#target-dir').innerHTML = folderNames[0];

    updateFileListPain(folderNames[0], "");
  });
}

function setToken() {
  config.set("TOKEN", $('#input').value);
}

function getTags() {
  const tags = $("#tsumiqiita-editor").value.split("\n")[0].trim().split(" ");
  let ret = [];

  for (let i = 0; i < tags.length && i < 5; i++) {
    let tmp = tags[i].split(":");
    if (tmp.length < 2) {
      ret.push({ "name": tmp[0] });
    } else {
      ret.push({ "name": tmp[0], "versions": [tmp[1]] });
    }
  }
  return ret;
}

/**
 * @param {object[]} tags
 */
function createTagsObject(tags) {
  if (JSON.stringify(tags) == JSON.stringify([""])) return undefined;

  let array = [];
  let tag =  "";
  for (const obj of tags) {
    tag = obj.split(":");
    if (tag.length >= 2) {
      array.push({
        "name": tag[0],
        "versions": [ tag[1] ]
      });
    } else {
      array.push({
        "name": tag[0]
      });
    }
  }
  return array;
}

function post() {
  const fs = require('fs');
  require('isomorphic-fetch');
  const token = config.get("TOKEN");
  const p = config.get("CURRENT_FILE");
  const text = fs.readFileSync(p, 'utf-8');
  const request = require('request');

  if (token === undefined) {
    $('#message').innerText = "トークンがセットされていません"
    $('#msg-dialog').showModal();
    return;
  }	

  const options = {
    url: "https://qiita.com/api/v2/items",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + token
    },
    json: {}
  };

  const textHeader = getHeader(text);
  options.json["body"] = getBody(text);

  let item = "";
  let label = ""
  for (const line of textHeader.split('\n')) {
    if (line.trim().length > 0) {
      item = line.split(":");
      label = item[0].trim();
      switch (label) {
        case "coediting":
        case "private":
        case "tweet":
          options.json[label] = (item[1].trim() === 'true');
          break;
        case "group_url_name":
        case "title":
          options.json[label] = item[1].trim();
          break;
        case "tags":
          options.json[label] = createTagsObject(line.slice(line.indexOf(":")+1).trim().split(" "));
          break;
      }
    }
  }

  if (!options.json["title"]) {
    $('#message').innerText = "タイトルが入力されていません"
    $('#msg-dialog').showModal();
    return;
  }
  if (options.json["tags"] === undefined) {
    $('#message').innerText = "タグが入力されていません"
    $('#msg-dialog').showModal();
    return;
  }

  request(options, (error, response) => {
    $('#message').innerText = "限定公開されました！"
    if (response.statusCode != 201) {
      $('#message').innerText = "投稿に失敗しました…\n・タグが6つ以上あるかもしれません\n・正しいトークンがセットされていないかもしれません"
    }
    $('#msg-dialog').showModal();
  });
}

function createArticle() {
  const Dialog = require('electron').remote.dialog;

  Dialog.showSaveDialog({
    title: '新規作成',
    defaultPath: '.',
    filters: [
      { name: 'Markdownファイル', extensions: ['md'] },
    ]
  }, (savedFile) => {
    try {
      if (savedFile !== undefined && savedFile !== "") {
        const fs = require('fs');
        fs.writeFileSync(savedFile, "");
        console.log(savedFile);
        config.set('CURRENT_FILE', savedFile);
        updateFileListPain(config.get('TARGET_DIR'), require('path').basename(savedFile));
        openMarkdownFile(savedFile);
      }
    } catch (err) {
      return false;
    }
  });
}

function OnTabKey( e, obj ){
    // タブキーが押された時以外は即リターン
    if( e.keyCode!=9 ){ return; }
  
    // タブキーを押したときのデフォルトの挙動を止める
    e.preventDefault();
  
    // 現在のカーソルの位置と、カーソルの左右の文字列を取得しておく
    var cursorPosition = obj.selectionStart;
    var cursorLeft     = obj.value.substr( 0, cursorPosition );
    var cursorRight    = obj.value.substr( cursorPosition, obj.value.length );
  
    // テキストエリアの中身を、
    // 「取得しておいたカーソルの左側」+「タブ」+「取得しておいたカーソルの右側」
    // という状態にする。
    obj.value = cursorLeft+"\t"+cursorRight;
  
    // カーソルの位置を入力したタブの後ろにする
    obj.selectionEnd = cursorPosition+1;
}
