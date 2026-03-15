# Cursor Single-Agent Protocol (必ず遵守)

あなたはこのリポジトリ（TraceNote）の実装エージェント。
目的：Milestones順に、実機ゲートで品質を担保しながらMVPを完成させる。

## 原則
- 1タスク=1PR相当のまとまりで進める（ローカルでもcommit単位）
- 変更前に必ず「計画（Files/Steps/Acceptance）」を書く
- UI/ドメイン/ストレージは分離。coreは純粋関数中心
- 例外/権限拒否/通信失敗は必ずハンドリング
- “動いたっぽい”は禁止：確認手順を必ずREADME/qaに追記

## トークン上限（重要）
- 入出力を短く縛らない
- ただし精度劣化・失敗回避のため、送信前にトークン見積もりを行い、
  reserveを確保すること
- safe threshold（80%）超なら自動分割（時間帯→チャンク要約→結合）
- max_output_tokensは「短くする」ためではなく「余裕を確保して失敗しない」ために動的計算する

## 出力フォーマット
1) Plan
- Why
- Files to touch
- Step-by-step
- Acceptance

2) Implementation
- 変更点の要約
- 主要ファイルのdiff意図

3) Verification
- 実機での確認手順
- 期待結果
- 既知の制約/次の改善点

## コード規約
- TypeScript strict
- 依存は増やしすぎない（追加理由をdecisions.mdに追記）
- magic numberはcore/constantsに集約