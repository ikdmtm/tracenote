# Decisions

## Core
- アプリ名：TraceNote（仮）
- iOS優先、Expo + EASで進める
- 位置情報はAlways（価値提示後に要求）
- "Visits相当"はExpo標準の背景位置 + 端末内滞在推定でMVP実装
- Home判定：0-6時の最頻出滞在クラスタ
- Home判定はデータ蓄積まで保留（未確定時はマスク対象なし）
- 共有は画像（座標/住所は表示しない、Homeは強制マスク）
- 日記生成は1日1回まとめてLLM解析
- 取れなかった日は記録なし（テンプレは出さない）
- 修正UIは「行動ラベル」「場所名」に限定
- PlacesはOverpass（OSM）をデフォ、キャッシュ必須

## Navigation
- BottomTab: Home / Timeline / Settings（3タブ）
- Stack: Home→Diary→Share, Home→EditStay, Timeline→EditStay, Settings→Export
- Home = 今日のライブビュー（Stayカード + 日記導線）、Timeline = 過去含む全履歴

## Background Location
- timeInterval: 180000 (3分)
- distanceFilter: 50m
- accuracy: Accuracy.Balanced
- 精度アップ: requestLocation(単発) → accuracy<=80mなら採用、悪ければ最大30秒高精度

## LLM
- モデル: GPT-4o-mini（コスト/品質バランス最適）
- APIキー管理: サーバープロキシ経由（キーはサーバー側保持）
- 呼び出し: 1日1回（自動 + 手動）
- Free/Subscriptionで差なし（LLMは全ユーザー利用可能）
- コスト推定: ~$0.0005/user/day

## Diary Generation Trigger
- 自動: 翌日の設定時刻（デフォルト07:00）に前日分を生成
- 手動: Homeの「日記を生成」ボタン（再生成・定時前の確認用）

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
- レイアウト: 日付 + タイトル + ハイライト3点 + アプリロゴ
- 座標/住所は非表示、Homeは「自宅」表記

## Token / Context policy
- 入出力を短く縛らない
- ただしコンテキスト上限ギリギリは精度劣化・失敗が増えるため、
  送信前にトークン見積もりを行い、reserveを確保する
- 入力が safe threshold（80%）超なら自動分割（時間帯分割→チャンク要約→結合）
