# One Sky, Many Stories — Cinematic Web Edition

全20場面の英語絵本。Luna、Leo、Noahが、一つの星団をめぐる日本、ギリシャ、ニュージーランドの物語を語る。全20場面に描き下ろした縦の挿絵を使う。横持ちやPCでは、中央の一列に同じ縦絵と英文が続く。iPhone 16の縦持ち（393 × 852 CSS px）を基準に設計した。

[絵本の最初から読む](https://belltreetech.github.io/one-sky-many-stories/) · [第5場面「Subaru」を開く](https://belltreetech.github.io/one-sky-many-stories/#scene-05) · [スマートフォンの冒頭画面](docs/screenshots/iphone-01.webp) · [デスクトップの冒頭画面](docs/screenshots/desktop-opening.webp) · [公式スキルの導入記録](docs/tooling.md)

## 読み聞かせる

リンクを開き、端末を縦に持って指で下へ送る。空や人物と英文が一緒に流れ、途中で止めると、好きなだけ絵を眺めながら声に出して読める。直前の英文をもう一度読むには上へ戻す。Safariの「戻る」や再読み込みでは読んでいた箇所に戻る。表紙のリンクを新しいタブで開けば冒頭から、場面のリンクを開けばその場面から読める。場面リンクから表紙まで戻って再読み込みすると、表紙のURLで読み始められる。

第7場面では祖母の問いとルナの答えの間に、六つの星を探せる縦絵がある。第8場面ではレオの望遠鏡の先に淡い星が広がる。第11場面はルナの問いから七姉妹の姿を通り、レオの答えへ続く。[全20場面の演出表](specs/portrait-edition/spec.md)

全20場面で、指の送りに合わせて絵の中のものが動く。「Subaru」では夜の縁側に桜の花びらが舞い、第7場面ではルナが数える六つの星が一つずつ光る。第12場面では下へ送るほどレオの青い本が閉じ、逆に送ると同じ角度まで開く。指が止まると紙の端と表紙の照り返しだけが短く揺れる。端末で「視差効果を減らす」を有効にすると静止した挿絵で読める。[六つの星](https://belltreetech.github.io/one-sky-many-stories/#scene-07)・[レオが本を閉じる場面](https://belltreetech.github.io/one-sky-many-stories/#scene-12)・[Matarikiの食卓](https://belltreetech.github.io/one-sky-many-stories/#scene-17)

## 起動

Node.js 22.12以降とnpmを使う。CIのNodeは24。依存関係のバージョンはロックファイルに固定してある。

```sh
npm ci
npm run dev -- --host 127.0.0.1
```

Viteが表示する `/one-sky-many-stories/` のURLを開く。本番ビルドを手元で読むには次を実行する。

```sh
npm run build
npm run preview -- --host 127.0.0.1 --port 4181 --strictPort
```

この設定の閲覧先は [このMacのローカルプレビュー](http://127.0.0.1:4181/one-sky-many-stories/)。Webサーバーは静的ファイルを返す。認証、データベース、APIキーは不要。書体も同じ配信元から読み込む。

## 原本と抽出

指定版PDFのSHA-256は `e0f32267d89fa515a7ee29605a0b1174ae3c1d4a4a3ba2dbc8b0eb0ae5fb05aa`。PDFは既存の絵本制作フォルダ側で保管する。通常のビルドとテストには、コミット済みの英文・挿絵を使用する。

[抽出スクリプト](scripts/extract_pdf.py) はPyMuPDFでページごとの埋め込みJPEGを取り出す。紙面の本文欄の位置とフォントサイズから英文を抽出し、折り返した行をつなぐ。Popplerの `pdftotext` と `pdfimages` で別途取り出した本文、ページ番号、画像寸法と照合する。引用符、アポストロフィ、三点リーダー、Shōnagon・Māori・Papatūānuku の長音記号まで照合対象になる。

- [story.json](src/data/story.json) に20場面の本文、順序、章、画像の相対パス、寸法、英語の代替説明がある。章名と代替説明はWeb版の編集情報。
- [原寸のWebP](public/art/) は3ページ目が1671 × 940 px、残る19ページが1672 × 940 px。合計7,621,822バイト。20枚のJPEG原データも今回の作業環境の `.private/pdf-originals/` に保存した。Popplerが抽出したJPEGとも20枚すべてバイト一致した。
- [背景用素材](public/atmosphere/) は各場面の色を保つ小さなぼかし画像と、1ページ目の原画から切り出した星空。
- [縦版の挿絵](public/portrait/) は原作の人物・小道具・画風を参照し、内蔵ImageGenで場面ごとに再生成したWebP。望遠鏡の中に見える星団は独立した一枚。祖母を思い出す前の夜空と、七姉妹が現れる前の無人の丘も用意した。元の縦絵と同じ座標に重ね、スクロールに合わせて祖母や姉妹が浮かぶ。

再抽出にはPython 3.10以降とPopplerのコマンドが必要。以下はプロジェクト直下からの実行例。

```sh
python3 -m venv .private/extract-env
.private/extract-env/bin/python -m pip install -r scripts/requirements.txt
.private/extract-env/bin/python scripts/extract_pdf.py \
  ../one_sky_many_stories/output/One_Sky_Many_Stories.pdf \
  --originals-dir .private/pdf-originals
```

## 表示とアニメーションの構成

各場面は独立したHTMLセクション。画面の向きにかかわらず縦原画を同じ比率で表示する。スクロールを止めるとその位置で読める。本文は選択・コピーできる。幅の広い画面では、中央の絵の下端に英文が重なる。縦原画を取得できない場合は、同じ絵から書き出した幅360ピクセルのプレビューを表示する。

| 担当 | 実装 | 動作 |
|---|---|---|
| Scene Renderer | [SceneRenderer.tsx](src/components/SceneRenderer.tsx) | 全景・背景・見出し・英文を配置。近い場面だけに画像URLを割り当てる。 |
| Scroll Controller | [scrollController.ts](src/engine/scrollController.ts) | ネイティブスクロールの中央にある場面を追跡。回転やSafariの文字拡大では直前の段落または絵の位置を保つ。 |
| Animation Timeline | [portraitTimeline.ts](src/engine/portraitTimeline.ts) | 画面内の場面にGSAP ScrollTriggerを設定し、外れたら解除。カメラが全景の範囲内でゆっくり動く。 |
| Typography Reveal | [typographyReveal.ts](src/engine/typographyReveal.ts) | 発見の場面の原文を問いと答えに分ける。途中に置いた絵を指で送ると次の文が見える。 |
| Particle Engine | [ParticleEngine.tsx](src/engine/ParticleEngine.tsx) | 今読んでいる絵のCanvas 1枚で星を明滅させる。描画解像度と更新頻度に上限を設け、動作軽減時・非表示タブでは停止。 |
| Scene Transition | [sceneTransition.ts](src/engine/sceneTransition.ts) | スクロール量から、思い出や神話の像が原画に重なる濃度を求める。上方向・下方向とも同じスクロール位置に同期。 |

[挿絵の細部の配置](src/data/illustrationMotion.ts)は、原画を基準に手・衣服・水面・光の位置と動く範囲を指定する。[レオの本](src/engine/leoBook.ts)は原画の両手の位置に合わせた小さな画像を使う。追加の描画は画面付近の原寸の挿絵が読み込まれたときに有効になり、縮小プレビューや動作軽減時は静止画が見える。

縦版の[演出設定](src/data/portrait.ts)は場面ごとの注視点、カメラの進み方、発見の場面にある英文の区切りを定める。[縦版タイムライン](src/engine/portraitTimeline.ts)は現在のスクロール位置から望遠鏡の視野や神話への移行を描く。原文は [story.json](src/data/story.json) に一度だけ保持する。セーフエリアには `viewport-fit=cover` と `env(safe-area-inset-*)`、表示高には `svh`・`dvh` を使う。本文は拡大に合わせて改行し、必要な高さまで場面が伸びる。

タイトルのCormorant Garamond、章名のCinzel、本文のLoraをローカルWOFF2で配信する。インストールした各書体のSIL Open Font Licenseを確認し、ビルド時に各ライセンスを `dist/licenses/` へコピーする。GSAPおよびReact関連の通知も同梱する。

## ブラウザ検証

```sh
npm run typecheck
npm run build
npx --no-install playwright install chromium webkit
npm test
```

テストにはPython 3も使う。Playwrightが一時静的サーバーを127.0.0.1:4182で起動し、実際の `dist/` を `/one-sky-many-stories/` にマウントする。スクリーンショットと失敗時のトレースは、それぞれ `artifacts/webtoon-qa/screenshots/` と `artifacts/webtoon-qa/test-results/` に出力する。

### 挿絵の動きと慣性スクロールの検証

2026年11月27日、iOS 26.5のiPhone 16シミュレーターでSafariを開き、「Subaru」から「The Seven Sisters」へ、続いて「Matariki」へ向かう同じフリックを、旧版とアドレスバー修正版（`index-Dnzcs1Ob.js`）で各6回試した。Safariのアドレスバーが収納される間、旧版は画面の先頭への移動と元位置への復帰を計18組実行し、指を離して97〜105 CSS pxで止まった。改訂版では位置の書き戻しが0回になり、321〜432 CSS pxを約2.1〜2.2秒かけて減速した。動画の同一フレームで英文と絵の目印を追い、改訂版の測定範囲で両者の移動量の差は最大3 CSS pxだった。改訂版の動作中の描画コールバック間隔は中央値17 ms、最大53 ms。物理端末でのフレーム間隔と発熱は未測定。

書体の読み込み完了と次の送りが重なった場合にも、iPad相当のWebKitで位置が書き戻され、逆送りが取り消されることを確認した。再計測を、画面内の固定されていない各場面の範囲に限定した。Webフォントを遅らせて送る回帰試験では、iPhone・iPad相当のWebKitとChromiumのすべてで修正前に書き戻しを検出し、修正後は0回だった。

再計測版（`index-D8hyX5VS.js`）でも同じ6回のフリックを行った。指を離したあと333〜412 CSS pxを2.10〜2.15秒かけて進み、位置の書き戻しは0回だった。動作中に記録した598回の描画コールバックの間隔は中央値17 ms、最大21 msだった。iPad相当のWebKitでは、書体の読み込みと逆送りが重なる時刻を変えて17条件を試し、すべてで同じ段落を1,154 CSS px往復できた。望遠鏡の読み込みと本の画面端の修正を含む配布候補（`index-BqmZpLbL.js`）では、同じ6回すべてで位置の書き戻しがなく、333〜338 CSS pxを2.098〜2.115秒で減速した。

393 × 852のWebKitで全20場面のスクリーンショットを確認した。第7場面では六つの星がそれぞれ画面内で光り、第12場面では同じ位置へ逆送りすると同じ開き方に戻った。原画の両手を基準に5点を比較し、開いたときと途中のどちらでも手の色が原画と一致した。閉じ終えると上に重ねる絵の画素数はゼロになる。[全20場面の検査](tests/illustration-motion.spec.ts)・[本の描画と再読の検査](tests/leo-book.spec.ts)・[アドレスバーの回帰検査](tests/inertia.spec.ts)

### 縦画面の映画演出版

冒頭ではルナの手元のランタンから三人のいる丘へ画角が開く。指で送るとすぐに読み進められる。「Subaru」の雪の山里、レオの本の中の尾根、ノアが語る夜明け前の湖、結末の谷には、それぞれ専用の縦原画を使った。20場面の英語はHTMLで表示し、三つの問いと答えを含む23箇所を順にも逆にも読める。

カットは `src/components/CinematicShot.tsx`、絵に重ねる動きは `HillsideMotion.tsx`、`MythMotion.tsx`、`MatarikiMotion.tsx` で管理する。視野に入った場面だけに動く層を置き、カメラはブラウザのスクロール位置に従う。iOSの「視差効果を減らす」設定では縦原画と英文を静止画で読める。新しいカットと雲の素材は内蔵ImageGenで制作し、WebPに変換した。[制作仕様](specs/portrait-edition/spec.md#映画の画角と遠景)

11月27日の制作版 `07f7ec8` は型検査・配布ビルドと168件のPlaywright試験に合格した。iPhone 16相当の393 × 852、iPad WebKit、デスクトップChromiumで、六つの星の実際の発光、スロー回線で届いた絵、文字拡大、逆送り、結末の遠景を確認した。ローカルで配布する114ファイルを照合し、20場面の実画面を検収した。

別に、iOS 26.5のiPhone 16シミュレーターのSafariで、第8・12場面から各3回指を離すフリックを行った。慣性による移動は333〜336 CSS px。動いている間に測った英文と絵の枠の移動量の差は全6回で0 CSS pxだった。各試行の `requestAnimationFrame` 間隔の95パーセンタイルは17 ms、最大は28 ms。物理iPhone上のフレーム表示や発熱は未測定。

### 連続縦読み版の検証

11月27日朝の公開版 `657f277` では、第5場面「Subaru」のリンクを開き、表紙まで戻ってから再読み込みしても、表紙から読み続けられた。iOS 26.5のiPhone 16シミュレーター上のSafariで確認した。公開URLのPlaywright検査は102件すべて合格し、配信された全100ファイルが本番ビルドとバイト単位で一致した。[第5場面を開く](https://belltreetech.github.io/one-sky-many-stories/#scene-05)・[Safariと画像の通信復帰の検証記録](docs/portrait-qa.md#2026年11月27日朝の公開版-657f277)

第5場面「Subaru」は横長のウィンドウでも992 × 1586の縦原画を表示する。横長の728 × 570、デスクトップの1440 × 900、iPhoneの393 × 852で同じ絵を確認した。[第5場面のiPhone表示](docs/screenshots/subaru-iphone.webp)・[横長ウィンドウでの表示](docs/screenshots/subaru-wide.webp)

2026年11月27日に、縦版 `f8c220b` の公開を確認した。GitHub Pagesから取得した100ファイルが検査済みビルドとバイト単位で一致した。公開URLに対するPlaywright試験は99件すべて合格し、9種類の画面サイズで全20枚の縦構図を確認した。公開URLをiPhone 16のSafariシミュレーターで開き、第5場面を縦持ち、横持ち、再び縦持ちの順で読んだ。星団、ルナの指先、祖母が一枚の縦絵に収まる。[Safariで見た公開版](docs/screenshots/subaru-safari.jpg)・[公開時の検査とデプロイ](https://github.com/BelltreeTech/one-sky-many-stories/actions/runs/45856134250)

2026年11月26日の公開版 `7e8d673` をiOS 26.5のiPhone 16とiPad Airのシミュレーター上のSafariで開き、全20場面を結末まで通読した。分かれて現れる台詞も含め、23箇所の英語が原本と一致した。公開版のPlaywright検査は69件すべて成功し、配布した80ファイルは本番ビルドとバイト単位で一致した。端末別の画面写真、逆読み、文字拡大、動きの軽減、通信復帰の結果と再現方法を記録した。[縦版の検証記録](docs/portrait-qa.md)・[公開ワークフローの実行結果](https://github.com/BelltreeTech/one-sky-many-stories/actions/runs/45839999428)

### Foundation版の検証記録

以下の数値は縦版に着手する前のFoundation版の記録。2026年11月26日のmacOSで、iPhone 16相当のWebKit 27.2（393 × 852、DPR 3）とChromium 159（1440 × 900）を実際に起動した。各5件、合計10件が合格した。

| 確認対象 | 最終結果 |
|---|---|
| 原文と全20枚 | 独立抽出した照合用データ、story.json、実際のHTML本文がページ順に一致。全WebPをブラウザでデコードし、寸法・MIME・サブパスを確認。 |
| スクロールと拡大 | 最終場面への移動、逆戻り、画面高の切り替え、本文の200%拡大で現在位置と可読性を確認。基準画面で横方向のはみ出しなし。 |
| 動作とリソース | スクロールで実際のカメラ変形が変わる。遠い画像は解放され、戻ると読める。動作軽減のオン・オフでCanvasが停止・再開。2D Canvasを使えない状態でも結末まで読める。 |
| 読みやすさ | iPhone用の20枚とデスクトップ冒頭の1枚を目視。空と人物の構図、文字の欠け、本文と背景を確認。静止した各読書位置で、本文色と各行直下の背景740,849画素を比較した最小コントラスト比は9.55:1（18場面目）。 |
| 配信 | 全フォントをローカルで取得。外部オリジンへのアクセス、コンソールエラー、ページ例外、HTTPエラーを検出しなかった。最終の配布物は57ファイル、約8.2 MB。 |

初回の実画面検査で、画面高変更後の演出位置、明るいノートの上の本文、デスクトップ版の星空の継ぎ目を修正し、再撮影した。コントラストの実測は通常モーションでスクロールを止めた状態の結果。実機iPhoneのSafari、Dynamic Islandの物理的な見え方、長時間読書時の発熱・消費電力は未検証。

## GitHub ActionsとPages

縦版の開発用ブランチは `feature/portrait-cinematic-edition`。Foundation版は `feature/foundation`。[CI](.github/workflows/ci.yml) がpush・PR時に依存関係の復元、型検査、ビルド、WebKit／Chromium試験を実行する。[Pagesワークフロー](.github/workflows/pages.yml) はmainから手動で起動し、同じ検査を通過した配布物をデプロイする。2本のワークフローはactionlintでも検査した。

公開先は [BelltreeTech の GitHub Pages](https://belltreetech.github.io/one-sky-many-stories/)。このリポジトリではPagesのビルド元を **GitHub Actions** に設定している。更新版を公開するにはmainから **Publish GitHub Pages** を実行する。通常のプロジェクトサイトではリポジトリ名からbase pathを決める。ドメイン直下用のローカルビルドには `VITE_BASE_PATH=/ npm run build` が使える。[Viteの静的デプロイ](https://vite.dev/guide/static-deploy.html#github-pages)

[配布物の検査](scripts/package-site.mjs) が絵・背景・フォント・JS・CSS・アイコン・ライセンスを確認する。原本PDF、原JPEG、制作スキル、スクリーンショットは配布対象外。GitHub上での検査とデプロイの履歴は [Actions](https://github.com/BelltreeTech/one-sky-many-stories/actions/workflows/pages.yml) に残る。
