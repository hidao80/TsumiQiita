# インストール方法

1. gitをインストール (<https://git-scm.com/downloads>)
1. bunをインストール (<https://bun.com/>)
    ```sh
    ## for macOS and Linux
    curl -fsSL https://bun.com/install | bash

    ## for Windows
    powershell -c "irm bun.com/install.ps1 | iex"
    ```
1. リポジトリのインストール
    ```sh
    git clone https://github.com/hidao80/TsumiQiita.git
    cd TsumiQiita/src
    bun i
    bun run build
    ```
