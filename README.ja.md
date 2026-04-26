<sub>🌐 <a href="README.md">English</a> · <a href="README.zh-CN.md">简体中文</a> · <b>日本語</b> · <a href="README.ko.md">한국어</a></sub>

<div align="center">

# BetterAINote 🎙️

> *「複数のサービスに散らばった録音を、自分で管理できる安全なワークスペースへ。」*

<a href="https://github.com/MapleEve/BetterAINote/actions/workflows/ci.yml">
  <img src="https://img.shields.io/github/actions/workflow/status/MapleEve/BetterAINote/ci.yml?branch=main&style=flat-square" alt="CI" />
</a>
<a href="https://github.com/MapleEve/BetterAINote/releases">
  <img src="https://img.shields.io/badge/Release-0.6.0--preview-lightgrey?style=flat-square" alt="Release status" />
</a>
<a href="./docs/DEPLOYMENT.md">
  <img src="https://img.shields.io/badge/Self--hosting-first-blue?style=flat-square" alt="Self-hosting first" />
</a>
<a href="./LICENSE">
  <img src="https://img.shields.io/badge/License-Free%20Personal%20%C2%B7%20Commercial%20Ask-orange?style=flat-square" alt="License" />
</a>

<br>

DingTalk / A1、TicNote、Plaud、Feishu Minutes、iFLYTEK iFlyrec などの録音を、1 つのローカルワークスペースに集約します。<br>
録音、文字起こし、話者レビュー、AI タイトル、ソースレポート、検索用メタデータは、まず自分のデプロイ環境に置かれます。<br>
現在のバージョンは `0.6.0-preview` です。セルフホスト優先で、npm パッケージや公開 Docker イメージは配布していません。

<br>

[Quickstart](#はじめかた) · [Data sources](./docs/DATA_SOURCES.md) · [API](./docs/API.md) · [Deployment](./docs/DEPLOYMENT.md) · [Privacy](./docs/PRIVACY.md) · [Security](./SECURITY.md)

</div>

---

## こんな課題に向いています

> 会議録音が複数のベンダー画面に散らばり、タイトルもダウンロード方法もばらばら。1 つの会議を探すだけで複数サイトを行き来している。

> 文字起こし、リネーム、話者整理に別々のツールを使っていて、認証情報・音声・データベース・ログがどこに残るのか見えにくい。

BetterAINote はこの問題を解決します。**複数ソースの録音をプライベートなワークスペースに取り込み、同期、保存、私有文字起こし、話者レビュー、AI リネーム、検索準備をローカルデータ中心で扱います。**

---

## 想定ユーザー

- DingTalk / A1、TicNote、Plaud、Feishu Minutes、iFLYTEK iFlyrec などを使っている人。
- 録音ライブラリ、SQLite データベース、サービス認証情報、音声アーカイブを自分のマシンやサーバーに置きたい人。
- VoScript などの私有文字起こしサービスを使い、すべてを外部クラウドに流したくないチーム。
- まずセルフホスト基盤を作り、その後にワークフローや AI Agent を接続したい開発者。

BetterAINote は独立したプロジェクトです。Plaud は対応ソースの 1 つであり、プロダクトの中心ではありません。

---

## 現在の状態

| 項目 | 状態 |
| --- | --- |
| フェーズ | `preview`。セルフホスト利用者と早期フィードバック向け |
| リリース | `0.6.0-preview` が preview baseline。安定版、npm パッケージ、公開 Docker イメージは未公開 |
| パッケージ | `package.json` は `private: true` のまま |
| デプロイ | 自分で管理するローカルマシン、ホームサーバー、私有サーバー、コンテナ環境 |
| 互換性 | 初回安定版までは API、provider 機能、設定項目が変わる可能性があります |

---

## はじめかた

```bash
pnpm install
cp .env.example .env.local
pnpm db:migrate
pnpm dev
```

`http://localhost:3001` を開き、最初の管理者アカウントを作成してから設定します。

- `Data Sources`: 録音ソースを接続。
- `VoScript`: 私有文字起こしサービス URL と API key を設定。
- `Transcription`: 共通の文字起こし設定。
- `AI Rename`: タイトル生成とソースへの書き戻し設定。
- `Sync` / `Playback` / `Display`: 同期、再生、表示の設定。

`.env.local`、データベース、音声アーカイブ、ログイン状態のスクリーンショット、実際の認証情報はコミットしないでください。

---

## 主な機能

- 複数ソースの録音を 1 つのローカルライブラリに集約。
- VoScript などの私有文字起こしサービスと連携。
- 文字起こし、話者レビュー、再利用可能な話者プロフィールを管理。
- core / library / transcripts / voiceprints / words / search の SQLite 分割 baseline。
- 録音、文字起こし、話者、タグを対象にした再構築可能な検索 sidecar。
- UI とトラブルシューティング向けに、サニタイズされた source report を表示。

---

## 対応ソース

| ソース | 現在の利用者向け説明 |
| --- | --- |
| DingTalk / A1 | 設定された認証情報でアクセス可能な録音を同期します。詳細、音声、要約はアカウント権限に依存します。 |
| TicNote | 中国 / 国際リージョンに対応。録音同期、取得可能な音声の保存、設定時のタイトル書き戻しを扱います。 |
| Plaud | 録音ソースとして対応。録音同期、取得可能な音声の保存、設定時のタイトル書き戻しを扱います。 |
| Feishu Minutes | 権限がある場合、ソースメタデータ、文字起こし、要約を確認または同期できます。 |
| iFLYTEK iFlyrec | 文字起こし記録の取り込みと確認が中心です。音声と書き戻しはソース側の提供内容に依存します。 |

詳細は [Data Sources](./docs/DATA_SOURCES.md) を参照してください。

---

## プライバシーと安全性

BetterAINote には録音タイトル、ソース記録、文字起こし、話者名、音声ファイル、認証情報、サービスキーが含まれる可能性があります。私有インフラとして扱ってください。

- SQLite ファイルと `LOCAL_STORAGE_PATH` には機密性の高い録音・文字起こしデータが含まれる可能性があります。
- Provider 認証情報、VoScript 認証情報、AI タイトルサービスキー、セッション状態は私有デプロイ内に留めてください。
- 公開 Issue、PR、スクリーンショット、ログは必ずサニタイズしてください。
- cookie、bearer token、組織 / ユーザー / 録音 ID、会議内容、キャプチャファイル、完全な環境ファイル、ローカル私有パスを公開しないでください。

---

## ドキュメント

| トピック | English | 简体中文 | 日本語 | 한국어 |
| --- | --- | --- | --- | --- |
| 概要 | [README.md](./README.md) | [README.zh-CN.md](./README.zh-CN.md) | [README.ja.md](./README.ja.md) | [README.ko.md](./README.ko.md) |
| API | [docs/API.md](./docs/API.md) | [docs/API.md](./docs/API.md) | [docs/API.md](./docs/API.md) | [docs/API.md](./docs/API.md) |
| データソース | [docs/DATA_SOURCES.md](./docs/DATA_SOURCES.md) | [docs/DATA_SOURCES.md](./docs/DATA_SOURCES.md) | [docs/DATA_SOURCES.md](./docs/DATA_SOURCES.md) | [docs/DATA_SOURCES.md](./docs/DATA_SOURCES.md) |
| デプロイ | [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) | [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) | [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) | [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) |

---

## License

個人利用は無料です。商用利用には事前の書面許可が必要です。

BetterAINote は **Apache License 2.0 に追加された BetterAINote Additional Terms** の下で提供されます。標準の Apache-2.0 SPDX ライセンスそのものではありません。詳細は [LICENSE](./LICENSE) を確認してください。
