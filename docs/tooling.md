# 制作支援用の公式スキル

2026年11月26日に、Codex がこのチャットに提示したスキル、Mac の導入先、プラグイン検索結果、開発元の公開 Git リポジトリを照合した。ImageGen は既に利用できた。新しく必要なものは、このリポジトリの `.agents/skills/` に配置した。各ファイルは固定リビジョンの Git blob とバイト照合している。スキルは開発時の資料で、ブラウザの実行には使わない。[Codex のスキル配置仕様](https://developers.openai.com/codex/skills/)

| 対象 | 導入結果と今回の利用範囲 |
| --- | --- |
| OpenAI Build Web Apps | 公式プラグイン v0.1.2 のうち `frontend-app-builder` と `frontend-testing-debugging` をプロジェクトに導入。既存のローカルカタログにこのプラグインは見当たらなかった。公式 manifest は MIT を指定している。実装・画面検査に必要な2つのスキルと付随資料を採用し、プラグイン全体のグローバル登録は行っていない。[公式ソースと manifest](https://github.com/openai/plugins/tree/981b02c0c44058b595f3b4180002c3ae3c806d40/plugins/build-web-apps) |
| GreenSock GSAP AI Skills | React 制作に対応する `gsap-core`、`gsap-timeline`、`gsap-scrolltrigger`、`gsap-react`、`gsap-performance`、`gsap-utils`、`gsap-plugins` の7本をプロジェクトに導入。配布元の MIT ライセンスを同梱。ブラウザ側の GSAP パッケージには同パッケージのライセンスが適用される。[公式スキル](https://github.com/greensock/gsap-skills/tree/aed9cfd3277740755f6bfc1155c7aa645403b760/skills)・[スキルの LICENSE](https://github.com/greensock/gsap-skills/blob/aed9cfd3277740755f6bfc1155c7aa645403b760/LICENSE) |
| OpenAI Playwright | 公式 `playwright` をプロジェクトに導入。対話的な CLI 操作の資料と Apache-2.0 の LICENSE・NOTICE を同梱。反復するブラウザ試験はアプリ側の Playwright Test と lockfile を使う。[公式スキル](https://github.com/openai/skills/tree/49f948faa9258a0c61caceaf225e179651397431/skills/.curated/playwright)・[Playwright のデバイスエミュレーション](https://playwright.dev/docs/emulation) |
| OpenAI ImageGen | Codex のシステムスキル `imagegen` をこのセッションで確認。既存の導入をそのまま利用できる。v0.1 の素材は原本PDFの挿絵を使った。[公式スキル](https://github.com/openai/skills/tree/49f948faa9258a0c61caceaf225e179651397431/skills/.system/imagegen) |

## 画面づくりと検証

- Web 版の視覚資料は支給された完成絵本。新しい画像の生成を伴うコンセプト作成手順は、今回の依頼の対象外とした。
- テストスキルが指定する `Browser` プラグインと `browser` スキルは、このチャットで利用可能な一覧に登場しなかった。スキルが案内する通常の Playwright でブラウザを起動できる。主対象は 393 × 852 CSS px の WebKit。実機 Safari のハードウェア性能やアドレスバーの挙動は別途実機で確認する。[公式テストスキル](https://github.com/openai/plugins/blob/981b02c0c44058b595f3b4180002c3ae3c806d40/plugins/build-web-apps/skills/frontend-testing-debugging/SKILL.md)
- ScrollTrigger、タイムライン、React のマウント解除時のクリーンアップを扱う公式資料を同梱した。ブラウザのネイティブスクロールと、動きを減らすユーザー設定を前提にする。[ScrollTrigger リファレンス](https://gsap.com/docs/v3/Plugins/ScrollTrigger/)

Codex でこのリポジトリを開くと、各スキルの入口は `.agents/skills/<名前>/SKILL.md` にある。今回確認したのは配布元、既存カタログ、ファイル配置と内容の一致まで。すでに起動中のチャットに新しいスキルが自動追加されたかは検証していない。
