/*jshint esversion:6*/
var timer;
const WRITE_INTERVAL = 3000; 
const hljs = require('highlight.js');
const Config = require('electron-config');
const config = new Config();

function withoutTags(md) {
	return md.replace(RegExp(/^.*\n/, "y"), "");
}

function writeMarkdownFile () {
	const currentFile = config.get('CURRENT_FILE');
	const md = document.querySelector("#tsumiqiita-editor").value;

	if (currentFile !== undefined ) {
		if (currentFile.length > 0) {
			const fs = require('fs');
			const filePath = currentFile.replace(/\\/g, "\\\\");
			fs.writeFileSync(filePath, md);
			clearInterval(timer);
			document.querySelector("#title").style.fontStyle = "normal";
		}
	}
}

function rendaring() {
	const it = require('markdown-it')({
		langPrefix: "hljs language-",
		highlight: (str, lang) => {
			if (lang && hljs.getLanguage(lang)) {
				try {
					return hljs.highlight(lang, str).value;
				} catch (__) {}
			}
			return ''; 
		}
	});
	const md = document.querySelector("#tsumiqiita-editor").value;
	document.querySelector("#preview").innerHTML = withoutTags(it.render(md));
}

function openMarkdownFile(path) {
	const fs = require('fs');
	fs.readFile(path, (error, text) => {
    if (error !== null) {
      return;
    }
    document.querySelector("#tsumiqiita-editor").value = text.toString();

	rendaring();

	config.set('CURRENT_FILE', path);
  });
}

function autoSave() {
	try {
		document.querySelector("#title").style.fontStyle = "italic";
		clearTimeout(timer);
		timer = setInterval(writeMarkdownFile, WRITE_INTERVAL);
	} catch(err) {
		alert("exception!\n\n"+err);
		return false;
	}
}

function setScrollSync() {
	const p = document.querySelector('#preview');
	const e = document.querySelector('#tsumiqiita-editor');
	
	p.onscroll = () => {e.scrollTop = p.scrollTop;};
	e.onscroll = () => {p.scrollTop = e.scrollTop;};
}

function init() {
	let targetDir = config.get('TARGET_DIR');
	if (targetDir === undefined) { targetDir = ""; }
	else if (targetDir === "undefined") { targetDir = ""; }
	else if (targetDir.length === 0) { targetDir = "フォルダを選択してください"; }
	else { updateFileListPain(targetDir); }

	document.getElementById('target-dir').innerHTML = targetDir;

	const currentFile = config.get('CURRENT_FILE');
	if (currentFile !== undefined ) {
		if (currentFile.length > 0) {
			const filePath = currentFile.replace(/\\/g, "\\\\");
			openMarkdownFile(filePath);
		}
	}

	document.querySelector('#input').value = config.get("TOKEN");

	setScrollSync();
	hljs.initHighlightingOnLoad();
}

function selectTargetDir() {
	const Dialog = require('electron').remote.dialog;
	
	Dialog.showOpenDialog(null, {
		properties: ['openDirectory'],
		title: 'フォルダの選択',
		defaultPath: '.'
	}, (folderNames) => {
		config.set('TARGET_DIR', folderNames[0]);
		document.getElementById('target-dir').innerHTML = folderNames[0];

		updateFileListPain(folderNames[0]);
	});
}

// ファイルリストを取得。mdファイルのみ。
function updateFileListPain(dir) {
	const fs = require('fs');
	const path = require('path');

	if (dir.length === 0) {return;}
	fs.readdir(dir, (err, files) => {
		if (err) {throw err;}
		let fileList = [];
		files.filter( (file) => {
			const target = dir + path.sep + file;
			return fs.statSync(target).isFile() && /.*\.md$/.test(target); //絞り込み
		}).forEach( (file) => {
				fileList.push(file);
		});

	    // 画面に反映
		let fileListHtml = "";
		for(let fileName of fileList) {
			let filePath = dir + path.sep + fileName;
			filePath = filePath.replace(/\\/g, "\\\\");
			fileListHtml += "<div class='files-item-div'>\n" +
				"  <input type='radio' class='files-item-radio' name='filename' id='"+fileName+"' onclick='openMarkdownFile(\""+filePath+"\")'><label for='"+fileName+"' class='files-item-label'>"+fileName+"</label>\n" +
				"</div>\n";
		}

		document.getElementById('files').innerHTML = fileListHtml;
  });
}

function setToken() {
	config.set("TOKEN", document.querySelector('#input').value);
}

function getTags() {
	const tags = document.querySelector("#tsumiqiita-editor").value.split("\n")[0].trim().split(" ");
	let ret = [];
	
	for(let i = 0; i < tags.length; i++) {
		let tmp = tags[i].split(":");
		if (tmp.length < 2) {
			ret.push({"name":tmp[0]});
		} else {
			ret.push({"name":tmp[0], "versions": [tmp[1]]});
		}
	}
	console.log(JSON.stringify(ret));
	return ret;
}

function post() {
	const fs = require('fs');
	require('isomorphic-fetch');
	const Qiita = require('qiita-js');
	Qiita.setToken(config.get("TOKEN"));
	Qiita.setEndpoint('https://qiita.com');
		
	const path = require('path');

	const p = config.get("CURRENT_FILE");
	const file = p.split(path.sep);
	const filename = file[file.length-1];
	const markdown = withoutTags(fs.readFileSync(p, 'utf-8'));
	const title = filename.replace(/(\.md)+$/,"");

	var options = {
		"body": markdown,
		"private": true,
		"tags": getTags(),
		"title": title
	};

	//execution　api
	Qiita.Resources.Item.create_item(options).then(function(res){
//		console.log(res);
		if (res.message !== undefined) {
			document.querySelector('#ng-dialog').showModal();
		} else {
			document.querySelector('#ok-dialog').showModal();
		}
	});
}

function createArticle() {
	const Dialog = require('electron').remote.dialog;
	
	Dialog.showSaveDialog(null, {
		title: '新規作成',
		defaultPath: '.',
		filters: [
				{name: 'Markdownファイル', extensions: ['md']},
		]
	}, (savedFiles) => {
		try {
			const fs = require('fs');
			fs.writeFileSync(savedFiles, "");
			config.set('CURRENT_FILE', savedFiles);
			updateFileListPain(config.get('TARGET_DIR'));
			openMarkdownFile(savedFiles);
			document.querySelector("#nav-input").checked = false;
		} catch(err) {
			alert("exception!\n\n"+err);
			return false;	
		}
	});
}
