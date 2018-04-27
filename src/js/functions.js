/*jshint esversion:6*/
/*jslint devel: true */
var timer;
const WRITE_INTERVAL = 10000; 

function rerendaring() {
	const fs = require('fs');
	const Config = require('electron-config');
  let config = new Config();
	
	let md = document.querySelector("#tsumiqiita-editor").value;
	document.querySelector("#preview").innerHTML = marked(md); // jshint ignore:line
	try {		
		clearTimeout(timer);
		timer = setInterval(writeMarkdownFile, WRITE_INTERVAL);
	} catch(err) {
		alert("exception!\n\n"+err);
		return false;
	}
}

function writeMarkdownFile () {
	let currentFile = config.get('CURRENT_FILE');
	if (currentFile !== undefined ) {
		if (currentFile.length > 0) {
			let filePath = currentFile.replace(/\\/g, "\\\\");
			fs.writeFileSync(filePath, md);
			clearInterval(timer);
		}
	}
}

function rendering(path) {
  const fs = require('fs');

	fs.readFile(path, (error, text) => {
    if (error !== null) {
//      alert('error : ' + error);
      return;
    }
    document.querySelector("#preview").innerHTML = marked(text.toString()); // jshint ignore:line
    document.querySelector("#tsumiqiita-editor").value = text.toString();

		const Config = require('electron-config');
		let config = new Config();
		
		config.set('CURRENT_FILE', path);
  });
}

function init() {
	const Config = require('electron-config');
  let config = new Config();
	
	let targetDir = config.get('TARGET_DIR');
	if (targetDir === undefined) {targetDir = "";}
  if (targetDir === "undefined") {targetDir = "";}
	if (targetDir.length === 0) {
		targetDir = "フォルダを選択してください";
	} else {
		updateFileListPain(targetDir);	
	}
	document.getElementById('target-dir').innerHTML = targetDir;

	let currentFile = config.get('CURRENT_FILE');
	if (currentFile !== undefined ) {
		if (currentFile.length > 0) {
			let filePath = currentFile.replace(/\\/g, "\\\\");
			rendering(filePath);
		}
	}

	document.querySelector('#input').value = config.get("TOKEN");
}

function selectTargetDir() {
	const Dialog = require('electron').remote.dialog;
	
	Dialog.showOpenDialog(null, {
		properties: ['openDirectory'],
		title: 'フォルダの選択',
		defaultPath: '.'
	}, (folderNames) => {
		const Config = require('electron-config');
		let config = new Config();
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
			let target = dir + path.sep + file;
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
				"  <input type='radio' class='files-item-radio' name='filename' id='"+fileName+"' onclick='rendering(\""+filePath+"\")'><label for='"+fileName+"' class='files-item-label'>"+fileName+"</label>\n" +
				"</div>\n";
		}

		document.getElementById('files').innerHTML = fileListHtml;
  });
}

function setToken() {
	const Config = require('electron-config');
  const config = new Config();

	config.set("TOKEN", document.querySelector('#input').value);
}

function post() {
	const Config = require('electron-config');
	const config = new Config();
	
	require('isomorphic-fetch');
	const Qiita = require('qiita-js');
	Qiita.setToken(config.get("TOKEN"));
	Qiita.setEndpoint('https://qiita.com/api/v2/items');
		
	const path = require('path');
  const fs = require('fs');

	let p = config.get("CURRENT_FILE");
	let file = p.split(path.sep);
	let filename = file[file.length-1];
	let markdown = fs.readFileSync(p, 'utf-8');

	let title = filename.replace(/(\.md)+$/,"");
	
	var options = {
		"body": markdown,
		"private": true,
		"tags": [
			{
				"name": "TsumiQiita",
				"versions": [
					"1.0.0"
				]
			}
		],
		"title": title
	};

	//execution　api
	Qiita.Resources.Item.create_item(options).then(function(res){
		console.log(res);
		if (parseInt(res.statusCode, 10) >= 400) {
			document.querySelector('#ok-dialog').showModal();
		} else {
			document.querySelector('#ng-dialog').showModal();
		}
	});
}

function createArticle() {
	const Dialog = require('electron').remote.dialog;
	const fs = require('fs');
	
	Dialog.showSaveDialog(null, {
		title: '新規作成',
		defaultPath: '.',
		filters: [
				{name: 'Markdownファイル', extensions: ['md']},
		]
	}, (savedFiles) => {
		const Config = require('electron-config');
		let config = new Config();

		try {
			fs.writeFileSync(savedFiles, "");
			config.set('CURRENT_FILE', savedFiles);
			updateFileListPain(config.get('TARGET_DIR'));
			rendering(savedFiles);
			document.querySelector("#nav-input").checked = false;
		} catch(err) {
			alert("exception!\n\n"+err);
			return false;	
		}
	});
}