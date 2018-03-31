function Rendering(path) {
  const fs = require('fs');

	fs.readFile(path, (error, text) => {
    if (error != null) {
      alert('error : ' + error);
      return;
    }
    document.getElementById("content").innerHTML = marked(text.toString());
  });
}

// ファイルリストを取得。mdファイルのみ。
function UpdateFileListPain(dir) {
	let fs = require('fs');
  if (dir.length == 0) retrun;
	fs.readdir(dir, function(err, files){
		if (err) throw err;
		var fileList = [];
		files.filter(function(file){
      let regexp = new RegExp(dir + '/.*\.md$');
      let target = dir +"/"+ file;
			return fs.statSync(target).isFile() && regexp.test(target); //絞り込み
		}).forEach(function (file) {
				fileList.push(file);
		});

    // 画面に反映
		let fileListHtml = "";
		for(let fileName of fileList) {
			fileListHtml += "<div class='files-item-div'>\n"
				+ "  <input type='radio' class='files-item-radio' name='filename' id='"+fileName+"' onclick='Rendering(\""+dir+"\/"+fileName+"\")'><label for='"+fileName+"' class='files-item-label'>"+fileName+"</label>\n"
				+ "</div>\n";
		}      
		document.getElementById('files').innerHTML = fileListHtml;
  });
}