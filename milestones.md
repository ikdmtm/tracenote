# Milestones (Real-device gate)

## M0: Scaffold
- Expo TS scaffold / navigation / SQLite接続
- Settings: 活動終了時刻(デフォ24:00), 日記生成時刻(デフォ07:00)
Done:
- iOS実機起動、画面遷移OK

### M0 Breakdown
1. `npx create-expo-app` + TypeScript strict設定
2. expo-router導入、BottomTab(Home/Timeline/Settings) + Stack構成
3. expo-sqlite導入、DB初期化(raw_events, stays, diary_entries, settings)
4. Settingsで活動終了時刻・日記生成時刻を表示/変更
5. 各画面のプレースホルダー配置

## M1: Location capture (background)
- Always権限導線
- BG taskでRawEvent保存（低頻度）
- TimelineでRawEvent表示
Done:
- 実機で画面OFF/バックグラウンドでもイベントが入る（少なくてもOK）

## M2: Stay detection
- stays.ts（滞在推定）実装
- Stay一覧表示、20分滞在が取れる
Done:
- 半日使ってStayが数件できる

## M3: Places + activity inference + needs_review
- Overpassでカテゴリ推定（キャッシュ）
- 食事/トレの初期ルール
- 要確認チップ + 1タップ修正
Done:
- 飲食/ジムで概ね当たる、外れても修正が快適

## M4: Diary generation (LLM) + token safety
- 日ごとにまとめて入力を作る（Stay/Moveのみ、座標なし）
- サーバープロキシ経由でGPT-4o-mini呼び出し
- トークン見積もり（estimate）を実装
- safe threshold（80%）超なら自動分割（時間帯→チャンク要約→結合）
- max_output_tokensは「余裕確保のため」動的計算
- 自動生成（翌日07:00デフォ）+ 手動生成ボタン
Done:
- 普段は1発生成、忙しい日は自動分割しても破綻しない
- 上限ギリギリ運用にならない（reserve確保）

## M5: Share (image) + Home masking
- ShareCard画像化（9:16, 1080x1920）→共有
- Homeは必ずマスク（データ蓄積後に判定開始）
Done:
- SNS共有しても特定情報が出にくい

## M6: Export JSON/CSV
- 期間選択→JSON/CSV生成→ファイル共有
Done:
- PCに保存して開ける

## M7: Ads + Subscription (ad-off)
- react-native-google-mobile-ads (AdMob) 広告表示
- react-native-purchases (RevenueCat) サブスク
- サブスク状態で広告OFF
Done:
- 広告ON/OFFが安定して切り替わる（購入状態の復元含む）
