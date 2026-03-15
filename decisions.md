# Decisions

## Core
- アプリ名：TraceNote（仮）
- iOS優先、Expo + EASで進める
- 位置情報はAlways（価値提示後に要求）
- "Visits相当"はExpo標準の背景位置 + 端末内滞在推定でMVP実装
- Home判定：0-6時の最頻出滞在クラスタ
- Home判定はデータ蓄積まで保留（未確定時はマスク対象なし）
- 共有は画像（座標/住所は表示しない、Homeは強制マスク）
- MVPでは日別サマリー（テンプレートベース、LLM不要）を「日記」として提供
- LLM日記生成は将来のオプション機能として残置
- 取れなかった日は記録なし（テンプレは出さない）
- 修正UIは「行動ラベル」「場所名」「写真の追加/除外」
- PlacesはOverpass（OSM）をデフォ、キャッシュ必須

## Navigation
- BottomTab: Home / Timeline / Settings（3タブ）
- Stack: Home→Diary→Share, Home→EditStay, Timeline→Diary, Timeline→EditStay, Settings→Export
- Home = 今日のライブビュー（Stayカード + サマリー導線）、Timeline = 過去含む全履歴
- Timeline から過去日の Diary に遷移可能

## Background Location
- timeInterval: 180000 (3分)
- distanceFilter: 50m
- accuracy: Accuracy.Balanced
- 精度アップ: requestLocation(単発) → accuracy<=80mなら採用、悪ければ最大30秒高精度

## Photos（写真紐づけ）
- expo-media-library でカメラロールの写真メタデータを取得
- Stayの時間帯 ± 5分マージン + GPS 500m以内で自動マッチ
- 各Stay最大10枚まで（時刻順）
- パーミッションは位置情報の後に別途リクエスト（同時に2つ要求しない）
- 拒否されてもアプリは通常動作（写真なし）
- LLMには写真枚数のみ渡す（写真データは送らない）
- DB: stay_photos テーブルで管理

## LLM（将来のオプション機能）
- MVPではLLMを使用しない（日別サマリーで十分）
- コードは `src/core/diary/` に残置、将来有効化可能
- モデル候補: GPT-4o-mini（コスト/品質バランス最適）
- APIキー管理: サーバープロキシ経由（キーはサーバー側保持）

## Daily Summary（MVP）
- Diary画面 = 日別サマリー（テンプレートベース）
- 統計ヘッダー（滞在数、合計時間、写真枚数）
- Stayカード一覧（写真付き）
- Home / Timeline からStay有無でリンク表示

## Monetization (MVP)
- Free: 広告あり
- Subscription: 広告オフ
- 広告SDK: react-native-google-mobile-ads (AdMob)
- サブスク: react-native-purchases (RevenueCat)
（MVPは広告ON/OFFの切替を中心に実装し、後で差分拡張できる形にする）

## Places / Overpass API
- キャッシュ: 永続保存（座標丸め値で検索）
- オフライン/エラー時: place=unknown, needs_review=true で進行
- 次回オンライン時にリトライ

## ShareCard
- フォーマット: Instagram Story (9:16, 1080x1920)
- レイアウト: 日付 + タイトル + ハイライト3点 + 代表写真（あれば）+ アプリロゴ
- 座標/住所は非表示、Homeは「自宅」表記

## Token / Context policy（将来のLLM有効化時に適用）
- 入出力を短く縛らない
- ただしコンテキスト上限ギリギリは精度劣化・失敗が増えるため、
  送信前にトークン見積もりを行い、reserveを確保する
- 入力が safe threshold（80%）超なら自動分割（時間帯分割→チャンク要約→結合）
