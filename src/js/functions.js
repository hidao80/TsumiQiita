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

function withoutTags(md) {
	return md.replace(/^.*\n/, "");
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
	$("#preview").innerHTML = it.render(withoutTags(md));

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

function post() {
	const fs = require('fs');
	require('isomorphic-fetch');
	const Qiita = require('qiita-js');
	Qiita.setToken(config.get("TOKEN"));
	Qiita.setEndpoint('https://qiita.com');

	const path = require('path');

	const p = config.get("CURRENT_FILE");
	const file = p.split(path.sep);
	const fileName = file[file.length - 1];
	const markdown = withoutTags(fs.readFileSync(p, 'utf-8'));
	const title = fileName.replace(/(\.md)+$/, "");

	var options = {
		"body": markdown,
		"private": true,
		"tags": getTags(),
		"title": title
	};

	//execution　api
	Qiita.Resources.Item.create_item(options).then(function (res) {
		if (res.message !== undefined) {
			$('#ng-dialog').showModal();
		} else {
			$('#ok-dialog').showModal();
		}
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
			alert("exception!\n\n" + err);
			return false;
		}
	});
}
