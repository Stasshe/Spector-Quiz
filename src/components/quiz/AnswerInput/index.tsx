import { useState, FormEvent, useRef, useEffect } from 'react';
import { Quiz } from '@/types/quiz';
import { FaPaperPlane, FaWifi, FaExclamationTriangle, FaClock } from 'react-icons/fa';
import LatexRenderer from '@/components/latex/LatexRenderer';
import { useQuiz } from '@/context/QuizContext';
import { TIMING } from '@/config/quizConfig';

interface AnswerInputProps {
  quiz: Quiz | null;
  onSubmit: (answer: string) => void | Promise<void>;
  onTimeout?: () => void; // タイムアウト時のコールバック
}

export default function AnswerInput({ quiz, onSubmit, onTimeout }: AnswerInputProps) {
  const [answer, setAnswer] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastSubmitTime, setLastSubmitTime] = useState(0);
  const [submitAttempts, setSubmitAttempts] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIMING.ANSWER_TIMEOUT / 1000); // 秒単位
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [isTimeUp, setIsTimeUp] = useState(false); // 時間切れ状態
  const submitTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const networkCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const answerTimerRef = useRef<NodeJS.Timeout | null>(null);

  // クイズコンテキストから解答権の状態を取得
  const { hasAnsweringRight } = useQuiz();

  // 回答権を取得した時にタイマーを開始
  useEffect(() => {
    if (hasAnsweringRight && !isTimerActive) {
      console.log('回答権を取得 - タイマーを開始します');
      setIsTimerActive(true);
      setIsTimeUp(false); // 時間切れ状態をリセット
      setTimeLeft(TIMING.ANSWER_TIMEOUT / 1000);
      
      // 1秒ごとにカウントダウン
      const timer = setInterval(() => {
        setTimeLeft(prevTime => {
          const newTime = prevTime - 1;
          
          // 残り3秒以下でバイブレーション（モバイルデバイスの場合）
          if (newTime <= 3 && newTime > 0) {
            if ('vibrate' in navigator) {
              navigator.vibrate(100); // 100ms のバイブレーション
            }
          }
          
          // 時間切れの場合
          if (newTime <= 0) {
            console.log('回答制限時間切れ - 強制的に不正解処理');
            clearInterval(timer);
            setIsTimerActive(false);
            setIsTimeUp(true); // 時間切れ状態を設定
            
            // 最終警告バイブレーション
            if ('vibrate' in navigator) {
              navigator.vibrate([200, 100, 200]); // 長めのパターン
            }
            
            // 時間切れの場合、空の回答で強制送信（不正解扱い）
            if (onTimeout) {
              onTimeout();
            } else {
              // フォールバック: 空の回答を送信
              onSubmit('');
            }
            
            return 0;
          }
          
          return newTime;
        });
      }, 1000);
      
      answerTimerRef.current = timer;
    } else if (!hasAnsweringRight && isTimerActive) {
      // 回答権を失った場合はタイマーを停止
      console.log('回答権を失った - タイマーを停止します');
      setIsTimerActive(false);
      if (answerTimerRef.current) {
        clearInterval(answerTimerRef.current);
        answerTimerRef.current = null;
      }
    }

    return () => {
      if (answerTimerRef.current) {
        clearInterval(answerTimerRef.current);
        answerTimerRef.current = null;
      }
    };
  }, [hasAnsweringRight, isTimerActive, onTimeout, onSubmit]);

  // コンポーネントがアンマウントされる時のクリーンアップ
  useEffect(() => {
    return () => {
      if (answerTimerRef.current) {
        clearInterval(answerTimerRef.current);
      }
    };
  }, []);

  // ネットワーク状況を監視
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // オンライン復帰時に遅延リセット
      if (networkCheckTimeoutRef.current) {
        clearTimeout(networkCheckTimeoutRef.current);
      }
      networkCheckTimeoutRef.current = setTimeout(() => {
        setSubmitAttempts(0);
      }, 3000); // 3秒後にリセット
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (submitTimeoutRef.current) clearTimeout(submitTimeoutRef.current);
      if (networkCheckTimeoutRef.current) clearTimeout(networkCheckTimeoutRef.current);
    };
  }, []);

  // スパム防止とネットワーク状況を考慮した送信制御
  const canSubmit = () => {
    const now = Date.now();
    const timeSinceLastSubmit = now - lastSubmitTime;
    
    // ネットワークがオフラインの場合は送信を制限（ただし警告表示）
    if (!isOnline) {
      return false;
    }

    // 送信中の場合は制限（連続送信防止）
    if (isSubmitting) {
      return false;
    }

    // 回答権を持っている場合は制限を緩和
    if (hasAnsweringRight) {
      // 回答権があるユーザーは基本的に送信可能
      // ただし、極端な連続クリック（100ms以内）は防ぐ
      if (timeSinceLastSubmit < 100) {
        return false;
      }
      return true;
    }

    // 回答権がない場合は従来通りの制限を適用
    // 連続送信制限（0.1秒以内の連続送信を防ぐ）
    if (timeSinceLastSubmit < 100) {
      setSubmitAttempts(prev => prev + 1);
      return false;
    }

    // 極端な大量送信を検出（10秒以内に10回以上）
    if (submitAttempts >= 10) {
      return false;
    }

    return true;
  };

  const handleSubmit = async (e?: FormEvent) => {
    if (e) e.preventDefault();

    if (!answer.trim()) return; // 空の回答は送信しない

    if (!canSubmit()) {
      console.warn('送信が制限されています');
      return;
    }

    // タイマーを停止
    if (answerTimerRef.current) {
      clearInterval(answerTimerRef.current);
      answerTimerRef.current = null;
    }
    setIsTimerActive(false);

    setIsSubmitting(true);
    setLastSubmitTime(Date.now());

    try {
      await onSubmit(answer);
      setAnswer('');
      setSubmitAttempts(0); // 成功時はリセット
    } catch (error) {
      console.error('送信エラー:', error);
      // ネットワークエラーの可能性を考慮してリトライ可能状態を維持
    } finally {
      // 送信状態を適切な時間後にリセット
      submitTimeoutRef.current = setTimeout(() => {
        setIsSubmitting(false);
      }, 500);
    }
  };

  // 選択式の場合の選択肢クリック処理
  const handleChoiceClick = async (choice: string) => {
    if (!canSubmit()) {
      console.warn('送信が制限されています');
      return;
    }

    // タイマーを停止
    if (answerTimerRef.current) {
      clearInterval(answerTimerRef.current);
      answerTimerRef.current = null;
    }
    setIsTimerActive(false);

    setIsSubmitting(true);
    setLastSubmitTime(Date.now());

    try {
      await onSubmit(choice);
      setSubmitAttempts(0); // 成功時はリセット
    } catch (error) {
      console.error('送信エラー:', error);
    } finally {
      submitTimeoutRef.current = setTimeout(() => {
        setIsSubmitting(false);
      }, 500);
    }
  };

  if (!quiz) return null;

  // 送信制限状態の表示メッセージ
  const getStatusMessage = () => {
    if (!isOnline) {
      return {
        text: 'ネットワークに接続されていません',
        icon: <FaWifi className="mr-2" />,
        color: 'text-red-600 bg-red-50 border-red-200'
      };
    }
    // 回答権がない場合のみ送信制限メッセージを表示
    if (!hasAnsweringRight && submitAttempts >= 10) {
      return {
        text: '送信回数制限に達しました。しばらくお待ちください',
        icon: <FaExclamationTriangle className="mr-2" />,
        color: 'text-orange-600 bg-orange-50 border-orange-200'
      };
    }
    if (isSubmitting) {
      return {
        text: '送信中...',
        icon: null,
        color: 'text-blue-600 bg-blue-50 border-blue-200'
      };
    }
    if (isTimeUp) {
      return {
        text: '時間切れです！',
        icon: <FaClock className="mr-2" />,
        color: 'text-red-600 bg-red-50 border-red-200'
      };
    }
    return null;
  };

  const statusMessage = getStatusMessage();

  return (
    <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
      <div className="mb-4">
        <h3 className="font-bold text-yellow-800">回答してください</h3>
        <div className="flex items-center justify-between mt-2">
          {/* ネットワーク状況の表示 */}
          <div className="flex items-center text-sm">
            <FaWifi className={`mr-2 ${isOnline ? 'text-green-500' : 'text-red-500'}`} />
            <span className={isOnline ? 'text-green-600' : 'text-red-600'}>
              {isOnline ? 'オンライン' : 'オフライン'}
            </span>
          </div>
          {/* 回答制限時間の表示 */}
          {hasAnsweringRight && isTimerActive ? (
            <div className="flex flex-col space-y-2">
              <div className={`text-sm font-bold flex items-center ${timeLeft <= 3 ? 'text-red-600 animate-pulse' : 'text-yellow-700'}`}>
                <FaClock className="mr-1" />
                残り時間: {timeLeft}秒
              </div>
              {/* タイマープログレスバー */}
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-1000 ease-linear ${
                    timeLeft <= 3 ? 'bg-red-500' : timeLeft <= 5 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ 
                    width: `${(timeLeft / (TIMING.ANSWER_TIMEOUT / 1000)) * 100}%` 
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="text-sm text-yellow-700">
              <span className="font-medium">制限時間: {TIMING.ANSWER_TIMEOUT / 1000}秒</span>
            </div>
          )}
        </div>
      </div>

      {/* 状態メッセージの表示 */}
      {statusMessage && (
        <div className={`mb-4 p-3 rounded-md border flex items-center ${statusMessage.color}`}>
          {statusMessage.icon}
          {statusMessage.text}
        </div>
      )}

      {quiz.type === 'multiple_choice' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {quiz.choices.map((choice, index) => (
            <button
              key={index}
              onClick={() => handleChoiceClick(choice)}
              disabled={!canSubmit()}
              className={`border border-yellow-300 bg-white rounded-md p-3 text-left focus:outline-none focus:ring-2 focus:ring-yellow-500 transition-all duration-200 ${
                !canSubmit() 
                  ? 'opacity-50 cursor-not-allowed bg-gray-100' 
                  : 'hover:bg-yellow-100 cursor-pointer'
              }`}
            >
              <div className="flex items-start">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-yellow-200 text-yellow-800 font-medium text-sm mr-3 flex-shrink-0">
                  {String.fromCharCode(65 + index)}
                </span>
                <LatexRenderer text={choice} />
              </div>
            </button>
          ))}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex">
          <input
            type="text"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            disabled={!canSubmit()}
            className={`flex-grow px-4 py-2 border border-yellow-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-yellow-500 ${
              !canSubmit() ? 'opacity-50 bg-gray-100' : ''
            }`}
            placeholder="回答を入力..."
            autoFocus
          />
          <button
            type="submit"
            disabled={!canSubmit()}
            className={`px-4 py-2 rounded-r-md transition-colors ${
              !canSubmit()
                ? 'bg-gray-400 cursor-not-allowed text-gray-600'
                : 'bg-yellow-500 hover:bg-yellow-600 text-white'
            }`}
          >
            <FaPaperPlane />
          </button>
        </form>
      )}
    </div>
  );
}
