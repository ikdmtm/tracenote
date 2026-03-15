# TraceNote - MVP Spec

## 目的
- 位置情報から「滞在点」を自動生成し、行動（食事/トレ/移動等）を推定して日記化する
- 入力負担を極小にし、修正は「行動ラベル」「場所名」だけで完結

## 非目的
- ルートの高精度トラッキング（徒歩ログ等）
- サーバーでの長期ログ解析（基本ローカル）

## Monetization (MVP)
- Free: 広告あり
- Subscription: 広告オフ
※MVPでは課金差分を最小にし、実装は広告表示ON/OFF切替を中心にする。

## データ方針
- 基本ローカル保存（SQLite）
- LLM解析は1日1回まとめて実行（ユーザー操作 or 自動実行）
- 共有は画像カード（座標/住所は表示しない）
- エクスポート：JSON/CSV（座標含めるかは将来オプション化。MVPではOFF固定でもOK）

## 位置情報収集（MVP）
- Expoの背景位置更新 + 端末内の滞在推定で "Visit相当" を生成
- 通常：低頻度・低精度でイベント収集
- 必要時：イベント受信直後に短時間だけ精度アップ（最大30秒）

推奨値（固定）
- Home判定レンジ：0:00–6:00
- 滞在最小時間：20分
- 同一地点マージ半径：150m
- 精度アップ：requestLocation(単発) → 精度悪ければ最大30秒高精度、または accuracy<=80m で停止

## 滞在点（Stay）生成
入力：RawEvent（時刻, lat/lng, accuracy, source）
出力：Stay（start, end, center, confidence, place?, activity?）

ロジック（簡略）
- 連続点を時間順に見て、速度が低い/距離が小さい区間をクラスタ化
- 20分以上継続したクラスタをStayとして確定
- 150m以内は同一Stayにマージ

## Places（カテゴリ推定）
- デフォ：Overpass APIで近傍のamenityを取得し、restaurant/gym/station等にマップ
- キャッシュ：同一中心座標（丸め）で結果を保存し、日内は再問い合わせしない

## 行動推定（初期ルール）
- 飲食：placeカテゴリ=restaurant/cafe + 時刻帯(11-14 or 18-21) + 20-120分
- トレ：placeカテゴリ=gym + 30-180分
- それ以外：移動/作業/その他（要確認になることがある）

## 要確認フラグ（簡易）
- 条件例：place不明 OR accuracy>200m OR 滞在が短い/長すぎる など
- UI：Stayカードに「要確認」チップ + 候補ラベル（1タップ）

## 日記生成
### 日付区切り
- ユーザーの「活動終了時刻」（デフォ24:00）
- 1日の範囲： [前日 活動終了時刻, 当日 活動終了時刻)

### LLMの役割
- 端末内：滞在点生成、カテゴリ推定、行動推定、要確認付与
- LLM：文章化（読みやすい日記）と、要確認の質問化
※LLMに推理をさせない（断定しない）。確定/推定/不明を明示して渡す。

### トークン上限と精度（重要）
- 「入力/出力を短く制限しない」方針
- ただし、コンテキスト上限ギリギリは精度が落ちやすく、失敗も増えるため、
  送信前にトークン見積もりを行い、十分な余裕（reserve）を常に確保する。

推奨ポリシー（固定）
- reserve: max(1024 tokens, 15% of model context)
- safe threshold: 入力が max_context * 0.80 を超えたら分割
- max_output_tokens: (max_context - input_tokens - reserve) を上限として動的に設定
  ※短くするためではなく「余裕を確保して失敗しない」ため

### 分割戦略（必要時のみ）
- まず1日分を1発で試す
- 入力が safe threshold を超えた場合のみ、時間帯で分割して処理
  例：morning / afternoon / evening / late-night（活動終了時刻基準）
- 手順：
  1) 各チャンク → “出来事の箇条書きログ” を生成（情報落ちしにくい形式）
  2) 箇条書きログを結合して最終日記を生成

### 入力フォーマット（短く固定）
- RawEvent（位置点列）はLLMに渡さない
- LLMへ渡すのは Stay/Move ブロックのみ（座標なし）
- 形式は「1行=1ブロック」の行ログ形式（JSONより短くなる傾向）

例：
[08:10-08:55] stay place=home activity=preparing conf=0.95 review=0
[08:55-09:30] move mode=train conf=0.63 review=1
[12:05-12:55] stay place=cafe activity=meal conf=0.82 review=0

### 出力（制限しないが構造は固定）
- タイトル
- 本文（自由）
- ハイライト（3点）
- 要確認（最大3件を推奨。0件でもOK）

## 共有
- ShareCard（画像）を生成してSNS共有
- Homeは必ずマスク（場所名は「自宅」・地名も非表示）

## 修正UI
- Stayの「行動ラベル」「場所名」を編集
- 編集結果は以後の推定に軽く反映（同じplaceカテゴリに優先度）

## 画面
- Home：今日の概要 + 生成/共有/修正導線
- Timeline：RawEvent/Stay一覧
- Diary：日記表示 + Share
- EditStay：ラベル/場所名編集
- Settings：活動終了時刻、Home再学習(リセット)、サブスク状態（広告ON/OFF）
- Export：JSON/CSV書き出し + 共有

## DB（SQLite）
- raw_events(id, ts, lat, lng, acc, source)
- stays(id, start_ts, end_ts, lat, lng, radius_m, place_json, activity, confidence, needs_review, user_place_name)
- diary_entries(id, day_key, title, body, highlights_json, share_text)
- settings(key, value)