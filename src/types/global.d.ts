// グローバル変数の型定義拡張

interface Window {
  /**
   * クイズルームページにいるかどうかを示すフラグ
   * `/quiz/room` ページでtrueに設定され、離れるとfalseになる
   * QuizRoomRedirectManagerとActiveQuizAlertModalで使用される
   */
  inQuizRoomPage: boolean;
  
  /**
   * 公式クイズであることを示すフラグ
   * 公式クイズではquizIdの扱いが異なるため特別処理が必要
   */
  isOfficialQuiz?: boolean;
  
  /**
   * 最後にクイズエラーが発生した時刻（タイムスタンプ）
   * エラー発生後の短時間内のリダイレクトを防止するために使用
   */
  quizErrorTimestamp?: number | null;
}
