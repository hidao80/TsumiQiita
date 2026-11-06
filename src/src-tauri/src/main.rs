// リリースビルドでWindowsのコンソールウィンドウを出さない
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tsumiqiita_lib::run();
}
