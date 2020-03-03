# インストール方法

1. gitをインストール (<https://git-scm.com/downloads>)
1. npmをインストール (<https://nodejs.org/ja/>)
1. npmを以下の手順で [npm v6.0.0](https://nodejs.org/ja/) 以上にアップデート
    ```sh
    ## for macOS and Linux
    sudo npm i -g npm

    ## for Windows
    npm i -g npm
    ```
1. リポジトリのインストール
    ```sh
    git clone https://github.com/hidao80/TsumiQiita.git
    cd TsumiQiita/src
    npm i
    npm run build
    ```
