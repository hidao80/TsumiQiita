(function () {
  "use strict";

  var LANGS = ["en", "ja", "zh", "es", "ru"];
  var STORAGE_KEY = "tsumiqiita-lang";

  var META = {
    en: {
      title: "TsumiQiita - Stockpile your Qiita drafts locally",
      description: "An Electron desktop app for posting Markdown files to Qiita. Real-time preview, auto-save, tagging, and limited-share posts. Runs on Windows / macOS / Linux."
    },
    ja: {
      title: "TsumiQiita - 積みQiitaを解消するMarkdown下書きデスクトップアプリ",
      description: "MarkdownファイルをQiitaに投稿できるElectron製デスクトップアプリ。リアルタイムプレビュー、自動保存、タグ登録、限定共有投稿に対応。Windows / macOS / Linuxで動作。"
    },
    zh: {
      title: "TsumiQiita - 消解积压 Qiita 草稿的 Markdown 桌面应用",
      description: "可将 Markdown 文件发布到 Qiita 的 Electron 桌面应用。支持实时预览、自动保存、标签管理和限定公开发布。可在 Windows / macOS / Linux 上运行。"
    },
    es: {
      title: "TsumiQiita - Acumula tus borradores de Qiita localmente",
      description: "Una aplicación de escritorio Electron para publicar archivos Markdown en Qiita. Vista previa en tiempo real, guardado automático, etiquetado y publicaciones de acceso limitado. Funciona en Windows / macOS / Linux."
    },
    ru: {
      title: "TsumiQiita - Храните черновики Qiita локально",
      description: "Настольное приложение на Electron для публикации файлов Markdown в Qiita. Предпросмотр в реальном времени, автосохранение, теги и записи с ограниченным доступом. Работает на Windows / macOS / Linux."
    }
  };

  var ml = new MultilanguageJS({ languages: LANGS, defaultLanguage: "en" });

  function detectLanguage() {
    var saved = localStorage.getItem(STORAGE_KEY);
    if (saved && LANGS.indexOf(saved) !== -1) return saved;
    var nav = (navigator.language || "en").slice(0, 2).toLowerCase();
    return LANGS.indexOf(nav) !== -1 ? nav : "en";
  }

  function applyLanguage(lang) {
    ml.setLanguage(lang);
    document.documentElement.lang = lang;
    var meta = META[lang] || META.en;
    document.title = meta.title;
    var descTag = document.querySelector('meta[name="description"]');
    if (descTag) descTag.setAttribute("content", meta.description);
    localStorage.setItem(STORAGE_KEY, lang);
  }

  function initLanguage() {
    var lang = detectLanguage();
    var select = document.getElementById("lang-switcher");
    if (select) select.value = lang;
    applyLanguage(lang);
    if (select) {
      select.addEventListener("change", function () {
        applyLanguage(select.value);
      });
    }
  }

  function initCopyButtons() {
    var buttons = document.querySelectorAll(".copy-btn");
    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var targetId = btn.getAttribute("data-copy-target");
        var target = document.getElementById(targetId);
        if (!target) return;
        navigator.clipboard.writeText(target.textContent).then(function () {
          btn.classList.add("copied");
          setTimeout(function () {
            btn.classList.remove("copied");
          }, 1500);
        });
      });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initLanguage();
    initCopyButtons();
  });
})();
