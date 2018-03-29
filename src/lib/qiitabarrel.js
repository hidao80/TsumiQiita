function update() {
  document.getElementById("content").innerHTML = marked(document.getElementById("editor").value);
}
