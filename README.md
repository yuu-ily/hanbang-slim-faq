# 韓国漢方 Hanbang Slim｜FAQサイト

LINEで配布するためのFAQ閲覧用Webアプリです。

## 機能
- FAQ一覧表示・カテゴリ絞り込み・キーワード検索
- 管理者ログイン（パスワードのみ）でFAQ・カテゴリの追加/削除
- Vercel上のサーバーレス関数が裏でGitHubに自動コミット

## デプロイ方法（Vercel）

1. https://vercel.com にGitHubアカウントでサインアップ
2. 「Add New → Project」→ `yuu-ily/hanbang-slim-faq` をImport
3. **Environment Variables** に以下を設定：

   | Key | Value |
   |---|---|
   | `ADMIN_PASSWORD` | `hanbangslim2026` |
   | `GITHUB_TOKEN` | `ghp_xxxx...`（fine-grained PAT、`contents:write` 権限） |
   | `GITHUB_OWNER` | `yuu-ily` |
   | `GITHUB_REPO` | `hanbang-slim-faq` |
   | `GITHUB_BRANCH` | `main` |

4. Deployをクリック → 数十秒でURL発行

### GitHubトークン作成手順（管理者本人のみ・1回きり）
1. https://github.com/settings/tokens?type=beta → **Generate new token**
2. **Repository access**: `hanbang-slim-faq` のみ
3. **Permissions → Repository → Contents**: `Read and write`
4. 生成された `ghp_...` をVercelの `GITHUB_TOKEN` に貼り付け

## 管理画面の使い方
- 公開URL末尾に `?admin` を付けるか、画面右下のシールドアイコンをクリック
- パスワードを入力するだけでFAQ追加・削除が可能
- 変更は自動でGitHubにコミット＆即時サイトに反映
