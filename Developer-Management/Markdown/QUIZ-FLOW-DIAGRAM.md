# クイズシステム処理フロー詳細図

## 概要
リーダー/非リーダー × ローカル/DBの4つの要素における処理フローを詳細に図式化

## メイン処理フロー

```mermaid
graph TB
    subgraph "初期化フェーズ"
        A[ルーム参加] --> B{役割判定}
        B -->|リーダー| C[useLeader初期化]
        B -->|非リーダー| D[useQuizRoom初期化]
    end

    subgraph "リーダー側処理"
        C --> E[Firebase onSnapshot設定]
        E --> F[早押し監視開始]
        F --> G[ゲーム開始待機]
        
        G --> H[startGame関数実行]
        H --> I[ローカル: gameStarted = true]
        I --> J[DB: room.isStarted = true更新]
        J --> K[DB: currentQuestionIndex設定]
        K --> L[問題データ取得・表示]
        
        L --> M[タイマー開始]
        M --> N[早押し監視ループ]
        
        N --> O{早押し検出?}
        O -->|Yes| P[handleBuzzer実行]
        O -->|No| Q{タイムアウト?}
        
        P --> R[ローカル: answerStatus更新]
        R --> S[DB: currentAnswerer設定]
        S --> T[DB: answerStatus = 'answering']
        T --> U[解答入力待機]
        
        U --> V{解答提出?}
        V -->|Yes| W[handleAnswerSubmit]
        V -->|No| X{解答タイムアウト?}
        
        W --> Y[解答判定ロジック]
        Y --> Z{正解?}
        Z -->|Yes| AA[ローカル: 正解処理]
        Z -->|No| BB[ローカル: 不正解処理]
        
        AA --> CC[DB: score更新]
        BB --> DD[DB: answerStatus = 'revealed']
        CC --> EE[次問題へ進行判定]
        DD --> EE
        
        Q -->|Yes| FF[handleTimeout実行]
        X -->|Yes| FF
        FF --> GG[ローカル: タイムアウト処理]
        GG --> HH[DB: answerStatus = 'timeout']
        HH --> EE
        
        EE --> II{最終問題?}
        II -->|No| JJ[次の問題へ]
        II -->|Yes| KK[ゲーム終了処理]
        
        JJ --> LL[ローカル: currentQuestionIndex++]
        LL --> MM[DB: インデックス更新]
        MM --> L
        
        KK --> NN[ローカル: isGameFinished = true]
        NN --> OO[DB: ゲーム終了状態更新]
    end

    subgraph "非リーダー側処理"
        D --> PP[Firebase onSnapshot設定]
        PP --> QQ[ルーム状態監視開始]
        
        QQ --> RR{DB状態変更検出}
        RR -->|isStarted変更| SS[ローカル: ゲーム開始状態反映]
        RR -->|currentQuestionIndex変更| TT[ローカル: 問題表示更新]
        RR -->|answerStatus変更| UU[ローカル: UI状態更新]
        RR -->|currentAnswerer変更| VV[ローカル: 解答者表示更新]
        RR -->|scores変更| WW[ローカル: スコア表示更新]
        
        SS --> XX[UI: ゲーム画面表示]
        TT --> YY[UI: 新問題表示]
        UU --> ZZ{answerStatus値}
        VV --> AAA[UI: 解答者ハイライト]
        WW --> BBB[UI: スコアボード更新]
        
        ZZ -->|waiting| CCC[UI: 早押し可能状態]
        ZZ -->|answering| DDD[UI: 解答中表示]
        ZZ -->|revealed| EEE[UI: 解答結果表示]
        ZZ -->|timeout| FFF[UI: タイムアウト表示]
        
        CCC --> GGG[早押しボタン有効化]
        DDD --> HHH[早押しボタン無効化]
        EEE --> III[解答結果表示]
        FFF --> JJJ[タイムアウト表示]
        
        GGG --> KKK{早押し実行?}
        KKK -->|Yes| LLL[buzzIn関数実行]
        LLL --> MMM[ローカル: 早押し状態]
        MMM --> NNN[DB: buzzer配列に追加]
        
        XXX[解答入力可能判定]
        XXX --> YYY{自分が解答者?}
        YYY -->|Yes| ZZZ[解答入力フィールド有効]
        YYY -->|No| AAAA[解答入力フィールド無効]
        
        ZZZ --> BBBB[解答提出]
        BBBB --> CCCC[submitAnswer実行]
        CCCC --> DDDD[ローカル: 解答送信]
        DDDD --> EEEE[DB: answers配列に追加]
    end

    subgraph "共通DB監視処理"
        FFFF[Firebase onSnapshot] --> GGGG{変更検出}
        GGGG -->|room.isStarted| HHHH[ゲーム状態同期]
        GGGG -->|room.currentState| IIII[問題状態同期]
        GGGG -->|room.participants| JJJJ[参加者状態同期]
        GGGG -->|room.scores| KKKK[スコア同期]
        
        HHHH --> LLLL[全参加者への状態反映]
        IIII --> LLLL
        JJJJ --> LLLL
        KKKK --> LLLL
        
        LLLL --> MMMM[ローカル状態更新]
        MMMM --> NNNN[UI再レンダリング]
    end

    subgraph "エラーハンドリング"
        OOOO[DB書き込みエラー] --> PPPP[ローカル状態復旧]
        QQQQ[ネットワークエラー] --> RRRR[再接続処理]
        SSSS[同期エラー] --> TTTT[状態整合性チェック]
    end
```

## 詳細状態遷移図

```mermaid
stateDiagram-v2
    [*] --> Initializing : ルーム参加
    
    state "初期化" as Initializing {
        [*] --> RoleCheck : 役割確認
        RoleCheck --> LeaderInit : リーダー
        RoleCheck --> ParticipantInit : 非リーダー
        
        LeaderInit --> [*] : useLeader初期化完了
        ParticipantInit --> [*] : useQuizRoom初期化完了
    }
    
    Initializing --> Waiting : 初期化完了
    
    state "待機状態" as Waiting {
        [*] --> GameWaiting : ゲーム開始待機
        GameWaiting --> GameWaiting : 参加者状態更新
    }
    
    Waiting --> Playing : ゲーム開始
    
    state "プレイ中" as Playing {
        [*] --> QuestionDisplay : 問題表示
        
        state "問題表示" as QuestionDisplay {
            [*] --> TimerStart : タイマー開始
            TimerStart --> BuzzerWaiting : 早押し待機
            
            state "早押し待機" as BuzzerWaiting {
                [*] --> Monitoring : 監視開始
                Monitoring --> BuzzerPressed : 早押し検出
                Monitoring --> QuestionTimeout : 時間切れ
            }
        }
        
        QuestionDisplay --> Answering : 早押し成功
        
        state "解答中" as Answering {
            [*] --> InputWaiting : 入力待機
            InputWaiting --> AnswerSubmitted : 解答提出
            InputWaiting --> AnswerTimeout : 解答時間切れ
        }
        
        Answering --> Judging : 解答処理
        QuestionDisplay --> Judging : 問題タイムアウト
        
        state Judging {
            [*] --> AnswerCheck : 解答チェック
            AnswerCheck --> Correct : 正解判定
            AnswerCheck --> Incorrect : 不正解判定
            AnswerCheck --> Timeout : タイムアウト判定
            
            Correct --> ScoreUpdate : スコア更新
            Incorrect --> NextCheck : 次問題チェック
            Timeout --> NextCheck : 次問題チェック
            
            ScoreUpdate --> NextCheck : 更新完了
            
            NextCheck --> NextQuestion : 次問題あり
            NextCheck --> GameEnd : 最終問題
        }
        
        Judging --> QuestionDisplay : 次問題
        Judging --> [*] : ゲーム終了
    }
    
    Playing --> Finished : 全問題完了
    
    state "終了" as Finished {
        [*] --> ResultDisplay : 結果表示
        ResultDisplay --> Cleanup : クリーンアップ
        Cleanup --> [*]
    }
    
    Finished --> [*] : ルーム退出
```

## データフロー詳細図

```mermaid
graph LR
    subgraph "リーダー側ローカル状態"
        LA[gameStarted] --> LB[currentQuestionIndex]
        LB --> LC[currentState.answerStatus]
        LC --> LD[currentState.currentAnswerer]
        LD --> LE[buzzerQueue]
        LE --> LF[participants]
        LF --> LG[scores]
    end
    
    subgraph "Firebase Firestore"
        DB1[room.isStarted] --> DB2[room.currentQuestionIndex]
        DB2 --> DB3[room.currentState.answerStatus]
        DB3 --> DB4[room.currentState.currentAnswerer]
        DB4 --> DB5[room.currentState.buzzer]
        DB5 --> DB6[room.currentState.answers]
        DB6 --> DB7[room.currentState.isRevealed]
        DB7 --> DB8[room.participants]
        DB8 --> DB9[room.scores]
    end
    
    subgraph "非リーダー側ローカル状態"
        RA[isGameStarted] --> RB[currentQuestionIndex]
        RB --> RC[answerStatus]
        RC --> RD[currentAnswerer]
        RD --> RE[isMyTurn]
        RE --> RF[participants]
        RF --> RG[scores]
        RG --> RH[canBuzz]
    end
    
    subgraph "UI状態"
        UI1[問題表示] --> UI2[タイマー]
        UI2 --> UI3[早押しボタン]
        UI3 --> UI4[解答入力フィールド]
        UI4 --> UI5[参加者リスト]
        UI5 --> UI6[スコアボード]
        UI6 --> UI7[解答結果表示]
    end
    
    %% リーダー → DB
    LA -->|setRoom| DB1
    LB -->|updateCurrentQuestion| DB2
    LC -->|updateAnswerStatus| DB3
    LD -->|setCurrentAnswerer| DB4
    LE -->|updateBuzzer| DB5
    LG -->|updateScores| DB9
    
    %% DB → 非リーダー
    DB1 -->|onSnapshot| RA
    DB2 -->|onSnapshot| RB
    DB3 -->|onSnapshot| RC
    DB4 -->|onSnapshot| RD
    DB8 -->|onSnapshot| RF
    DB9 -->|onSnapshot| RG
    
    %% 非リーダー → DB
    RH -->|buzzIn| DB5
    RD -->|submitAnswer| DB6
    
    %% ローカル → UI
    RA --> UI1
    RB --> UI1
    RC --> UI2
    RC --> UI3
    RD --> UI4
    RF --> UI5
    RG --> UI6
    RC --> UI7
    
    %% 相互依存関係
    RC --> RH
    RD --> RE
    RE --> UI3
    RE --> UI4
```

## 処理タイミング詳細図

```mermaid
sequenceDiagram
    participant L as リーダー(ローカル)
    participant LDB as リーダー→DB
    participant DB as Firestore
    participant PDB as DB→非リーダー
    participant P as 非リーダー(ローカル)
    participant UI as 非リーダーUI
    
    Note over L,UI: ゲーム開始フェーズ
    L->>L: startGame()実行
    L->>L: gameStarted = true
    L->>LDB: room.isStarted = true
    LDB->>DB: Firestore書き込み
    DB->>PDB: onSnapshot発火
    PDB->>P: isGameStarted更新
    P->>UI: ゲーム画面表示
    
    Note over L,UI: 問題表示フェーズ
    L->>L: currentQuestionIndex++
    L->>LDB: room.currentQuestionIndex更新
    LDB->>DB: 問題インデックス書き込み
    DB->>PDB: onSnapshot発火
    PDB->>P: 問題データ取得
    P->>UI: 新問題表示
    
    L->>L: answerStatus = 'waiting'
    L->>LDB: room.currentState.answerStatus
    LDB->>DB: 状態書き込み
    DB->>PDB: onSnapshot発火
    PDB->>P: answerStatus更新
    P->>UI: 早押しボタン有効化
    
    Note over L,UI: 早押しフェーズ
    UI->>P: 早押しボタンクリック
    P->>P: buzzIn()実行
    P->>PDB: room.currentState.buzzer更新
    PDB->>DB: 早押し情報書き込み
    DB->>LDB: onSnapshot発火(リーダー)
    LDB->>L: buzzer配列更新検出
    L->>L: handleBuzzer()実行
    L->>L: currentAnswerer設定
    L->>L: answerStatus = 'answering'
    
    L->>LDB: currentAnswerer更新
    LDB->>DB: 解答者情報書き込み
    L->>LDB: answerStatus更新
    LDB->>DB: 状態書き込み
    
    DB->>PDB: onSnapshot発火
    PDB->>P: currentAnswerer更新
    PDB->>P: answerStatus更新
    P->>UI: 解答入力フィールド表示
    P->>UI: 早押しボタン無効化
    
    Note over L,UI: 解答フェーズ
    UI->>P: 解答入力・提出
    P->>P: submitAnswer()実行
    P->>PDB: room.currentState.answers更新
    PDB->>DB: 解答データ書き込み
    DB->>LDB: onSnapshot発火(リーダー)
    LDB->>L: answers配列更新検出
    L->>L: handleAnswerSubmit()実行
    L->>L: 解答判定処理
    
    alt 正解の場合
        L->>L: スコア更新処理
        L->>LDB: room.scores更新
        LDB->>DB: スコア書き込み
    else 不正解の場合
        L->>L: answerStatus = 'revealed'
        L->>LDB: 状態更新
        LDB->>DB: 状態書き込み
    end
    
    L->>L: isRevealed = true
    L->>LDB: room.currentState.isRevealed
    LDB->>DB: 結果表示状態書き込み
    
    DB->>PDB: onSnapshot発火
    PDB->>P: 全状態更新
    P->>UI: 解答結果表示
    P->>UI: スコアボード更新
    
    Note over L,UI: 次問題準備フェーズ
    L->>L: 3秒待機後次問題判定
    alt 次問題がある場合
        L->>L: currentQuestionIndex++
        Note over L,UI: 問題表示フェーズに戻る
    else 最終問題の場合
        L->>L: isGameFinished = true
        L->>LDB: ゲーム終了状態更新
        LDB->>DB: 終了状態書き込み
        DB->>PDB: onSnapshot発火
        PDB->>P: ゲーム終了状態更新
        P->>UI: 結果画面表示
    end
```

## エラーハンドリング・同期制御詳細図

```mermaid
graph TB
    subgraph "実際のエラー処理"
        SE1[DB書き込み失敗] --> SE2{エラー種別判定}
        SE2 -->|permission-denied| SE3[権限エラー処理]
        SE2 -->|ネットワークエラー| SE4[接続エラー処理]
        SE2 -->|その他| SE5[一般エラー処理]
        
        SE3 --> SE6[処理スキップ]
        SE4 --> SE7[エラーログ出力]
        SE5 --> SE8[フォールバック処理]
        
        SE6 --> SE9[ユーザー通知]
        SE7 --> SE10[処理継続]
        SE8 --> SE11[状態復旧]
    end
    
    subgraph "Firebase監視エラー"
        RT1[onSnapshot切断] --> RT2[エラーハンドラー]
        RT2 --> RT3[切断ログ出力]
        RT3 --> RT4[監視継続]
    end
    
    subgraph "早押し競合処理"
        CO1[同時早押し検出] --> CO2[タイムスタンプ順序]
        CO2 --> CO3[最初の解答者選択]
        CO3 --> CO4[他解答者キャンセル]
        CO4 --> CO5[解答権確定]
    end
    
    subgraph "実際のクリーンアップ"
        CL1[useEffect cleanup] --> CL2[onSnapshotリスナー解除]
        CL2 --> CL3[unsubscribeBuzzer実行]
        CL3 --> CL4[unsubscribeCorrect実行]
        CL4 --> CL5[リソース解放完了]
    end
```

## 実装されている最適化・監視詳細図

```mermaid
graph LR
    subgraph "実装されている書き込み最適化"
        WO1[writeMonitor.logOperation] --> WO2[Firestore書き込み監視]
        WO2 --> WO3[操作ログ記録]
        WO3 --> WO4[パフォーマンス追跡]
        
        WO5[updateDoc最小化] --> WO6[必要な時のみ更新]
        WO6 --> WO7[serverTimestamp使用]
    end
    
    subgraph "実装されているリソース管理"
        RM1[useEffect cleanup] --> RM2[unsubscribe関数]
        RM2 --> RM3[Firebaseリスナー解除]
        RM3 --> RM4[メモリリーク防止]
        
        RM5[Promise.allSettled] --> RM6[並列処理エラー回避]
        RM6 --> RM7[部分的失敗許容]
    end
    
    subgraph "実装されているエラー監視"
        EM1[console.log/error] --> EM2[詳細なログ出力]
        EM2 --> EM3[エラートレース]
        EM3 --> EM4[デバッグ支援]
        
        EM5[try-catch包括] --> EM6[エラー捕捉]
        EM6 --> EM7[フォールバック処理]
    end
    
    subgraph "実装されているタイムアウト制御"
        TO1[setTimeout管理] --> TO2[解答制限時間]
        TO2 --> TO3[次問題遅延]
        TO3 --> TO4[ルーム削除遅延]
        
        TO5[TIMING設定] --> TO6[設定可能な時間制御]
        TO6 --> TO7[ゲームフロー調整]
    end
```
