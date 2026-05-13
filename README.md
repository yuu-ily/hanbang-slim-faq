# 韓国漢方 Hanbang Slim｜FAQサイト

LINEで配布するためのFAQ閲覧用Webアプリです。

## 機能
- FAQ一覧表示・カテゴリ絞り込み・キーワード検索
- 管理者ログインでFAQ・カテゴリの追加/削除（変更はこのリポジトリに自動コミット）
- バックエンド不要・GitHub Pagesで無料運用

## 管理者の使い方
1. サイト右下のシールドアイコンをクリック（または `?admin` をURLに付与）
2. 管理者パスワード＋GitHubアクセストークンを入力
3. FAQを追加/削除 → 自動で `data/faqs.json` にコミットされます

### GitHubアクセストークンの作り方
https://github.com/settings/tokens にアクセス → Generate new token (classic) → `repo` 権限のみ付与 → 生成された `ghp_...` をコピーして管理画面に1回だけ入力（ブラウザに保存されます）。
