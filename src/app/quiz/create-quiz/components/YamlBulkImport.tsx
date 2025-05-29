'use client';

import { FC, useState } from 'react';
import { FaFileImport, FaSpinner } from 'react-icons/fa';
import yaml from 'js-yaml';
import { Quiz, QuizType } from '@/types/quiz';


interface YamlBulkImportProps {
  onImport: (quizzes: Omit<Quiz, 'quizId' | 'createdAt'>[]) => void;
  genre: string;
  createdBy: string;
}

interface YamlQuiz {
  title: string;
  question: string;
  type: string;
  choices?: string[];
  correctAnswer: string;
  acceptableAnswers?: string[];
  explanation?: string;
}

interface YamlUnit {
  title?: string;
  description?: string;
  quizzes: YamlQuiz[];
}

interface ValidationError {
  quizIndex: number;
  quizTitle: string;
  errors: string[];
}

interface ImportResult {
  successCount: number;
  errorCount: number;
  validationErrors: ValidationError[];
  processedQuizzes: Omit<Quiz, 'quizId' | 'createdAt'>[];
}

const YamlBulkImport: FC<YamlBulkImportProps> = ({
  onImport,
  genre,
  createdBy
}) => {
  const [yamlText, setYamlText] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showExample, setShowExample] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  // 個別クイズのバリデーション
  const validateQuiz = (yamlQuiz: any, index: number): string[] => {
    const errors: string[] = [];

    // 基本的な必須フィールドのチェック
    if (!yamlQuiz || typeof yamlQuiz !== 'object') {
      errors.push('クイズデータが正しい形式ではありません');
      return errors;
    }

    // タイトルの検証
    if (!yamlQuiz.title || typeof yamlQuiz.title !== 'string' || !yamlQuiz.title.trim()) {
      errors.push(String(index),'番目のクイズでタイトルが入力されていません');
    } else {
      if (yamlQuiz.title.length > 50) {
        errors.push(String(index),'番目のクイズでエラー,タイトルは50文字以内で入力してください');
      }
    }

    // 問題文の検証
    if (!yamlQuiz.question || typeof yamlQuiz.question !== 'string' || !yamlQuiz.question.trim()) {
      errors.push(String(index),'番目のクイズでエラー,問題文が入力されていません');
    } else {
      if (yamlQuiz.question.length > 100) {
        errors.push(String(index),'番目のクイズでエラー,問題文は100文字以内で入力してください');
      }
    }

    // 正解の検証
    if (!yamlQuiz.correctAnswer || typeof yamlQuiz.correctAnswer !== 'string' || !yamlQuiz.correctAnswer.trim()) {
      errors.push(String(index),'番目のクイズでエラー,正解が入力されていません');
    } else {
      if (yamlQuiz.correctAnswer.length > 30) {
        errors.push(String(index),'番目のクイズでエラー,正解は30文字以内で入力してください');
      }
    }

    // タイプの検証
    const validTypes = ['multiple_choice', 'input'];
    if (!yamlQuiz.type || !validTypes.includes(yamlQuiz.type)) {
      errors.push(`${String(index)}番目のクイズでエラー,問題タイプが無効です。使用可能なタイプ: ${validTypes.join(', ')}`);
    }

    // 選択式問題の場合の追加検証
    if (yamlQuiz.type === 'multiple_choice') {
      if (!yamlQuiz.choices || !Array.isArray(yamlQuiz.choices)) {
        errors.push(String(index),'番目のクイズでエラー,選択式問題には選択肢（choices）が必要です');
      } else {
        if (yamlQuiz.choices.length < 3) {
          errors.push(String(index),'番目のクイズでエラー,選択肢は最低3つ必要です');
        }
        if (yamlQuiz.choices.length > 5) {
          errors.push(String(index),'番目のクイズでエラー,選択肢は最大5つまでです');
        }

        // 選択肢が全て入力されているかチェック
        const emptyChoices = yamlQuiz.choices.filter((choice: any, i: number) => 
          !choice || typeof choice !== 'string' || !choice.trim()
        );
        if (emptyChoices.length > 0) {
          errors.push(String(index),'番目のクイズでエラー,全ての選択肢を入力してください');
        }

        // 選択肢の長さチェック
        yamlQuiz.choices.forEach((choice: any, i: number) => {
          if (typeof choice === 'string' && choice.length > 100) {
            errors.push(`${String(index)}番目のクイズでエラー,選択肢${i + 1}は100文字以内で入力してください`);
          }
        });

        // 正解が選択肢に含まれているかチェック（テキストまたはインデックス）
        if (yamlQuiz.correctAnswer && yamlQuiz.choices) {
          const isValidAnswer = yamlQuiz.choices.includes(yamlQuiz.correctAnswer) || 
            (/^\d+$/.test(yamlQuiz.correctAnswer) && 
             parseInt(yamlQuiz.correctAnswer) >= 0 && 
             parseInt(yamlQuiz.correctAnswer) < yamlQuiz.choices.length);
          
          if (!isValidAnswer) {
            errors.push(String(index),'番目のクイズでエラー,正解が選択肢に含まれていません（選択肢のテキストまたは0から始まるインデックス番号を指定してください）');
          }
        }

        // 選択肢の重複チェック
        const trimmedChoices = yamlQuiz.choices
          .map((choice: any) => typeof choice === 'string' ? choice.trim().toLowerCase() : '')
          .filter((choice: string) => choice !== '');
        const uniqueChoices = new Set(trimmedChoices);
        if (uniqueChoices.size !== trimmedChoices.length) {
          errors.push(String(index),'番目のクイズでエラー,選択肢に重複があります');
        }
      }
    }

    // 入力式問題の場合の追加検証
    if (yamlQuiz.type === 'input') {
      // 許容回答の検証
      if (yamlQuiz.acceptableAnswers && !Array.isArray(yamlQuiz.acceptableAnswers)) {
        errors.push('許容回答（acceptableAnswers）は配列である必要があります');
      } else if (yamlQuiz.acceptableAnswers) {
        // 許容回答の各項目をチェック
        yamlQuiz.acceptableAnswers.forEach((answer: any, i: number) => {
          if (typeof answer !== 'string') {
            errors.push(`${String(index)}番目のクイズでエラー,許容回答${i + 1}は文字列である必要があります`);
          } else if (answer.length > 200) {
            errors.push(`${String(index)}番目のクイズでエラー,許容回答${i + 1}は200文字以内で入力してください`);
          }
        });
      }
    }

    // 解説の検証（オプション）
    if (yamlQuiz.explanation && typeof yamlQuiz.explanation === 'string') {
      if (yamlQuiz.explanation.length > 500) {
        errors.push(`${String(index)}番目のクイズでエラー,解説は500文字以内で入力してください`);
      }
    }

    return errors;
  };
  const processYaml = () => {
    if (!yamlText.trim()) {
      setErrorMessage('YAMLテキストが入力されていません');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    setImportResult(null);

    try {
      // YAMLをJavaScriptオブジェクトに変換
      const parsedData = yaml.load(yamlText) as YamlUnit;

      if (!parsedData || typeof parsedData !== 'object') {
        throw new Error('有効なYAMLフォーマットではありません');
      }

      if (!parsedData.quizzes || !Array.isArray(parsedData.quizzes) || parsedData.quizzes.length === 0) {
        throw new Error('クイズが見つかりませんでした。YAMLフォーマットを確認してください');
      }

      // 全てのクイズをバリデーションし、エラーがあるものをスキップ
      const processedQuizzes: Omit<Quiz, 'quizId' | 'createdAt'>[] = [];
      const validationErrors: ValidationError[] = [];
      let successCount = 0;
      let errorCount = 0;

      parsedData.quizzes.forEach((yamlQuiz, index) => {
        const errors = validateQuiz(yamlQuiz, index);
        
        if (errors.length > 0) {
          // エラーがある場合は記録してスキップ
          errorCount++;
          validationErrors.push({
            quizIndex: index + 1,
            quizTitle: yamlQuiz?.title || `問題 ${index + 1}`,
            errors
          });
        } else {
          // エラーがない場合は処理して追加
          try {
            const quizType: QuizType = (yamlQuiz.type === 'multiple_choice' || yamlQuiz.type === 'input') 
              ? yamlQuiz.type 
              : 'input';

            // correctAnswerがインデックス番号の場合、実際の選択肢テキストに変換
            let correctAnswer = yamlQuiz.correctAnswer;
            if (yamlQuiz.type === 'multiple_choice' && yamlQuiz.choices) {
              // 数字のみの文字列かつ有効なインデックスの場合
              if (/^\d+$/.test(yamlQuiz.correctAnswer)) {
                const index = parseInt(yamlQuiz.correctAnswer);
                if (index >= 0 && index < yamlQuiz.choices.length) {
                  correctAnswer = yamlQuiz.choices[index];
                }
              }
            }

            processedQuizzes.push({
              title: yamlQuiz.title,
              question: yamlQuiz.question,
              type: quizType,
              choices: yamlQuiz.choices || [],
              correctAnswer: correctAnswer,
              acceptableAnswers: yamlQuiz.acceptableAnswers || [],
              explanation: yamlQuiz.explanation || '',
              genre,
              createdBy,
              useCount: 0,
              correctCount: 0
            });
            successCount++;
          } catch (conversionError) {
            // 変換エラーが発生した場合
            errorCount++;
            validationErrors.push({
              quizIndex: index + 1,
              quizTitle: yamlQuiz?.title || `問題 ${index + 1}`,
              errors: [`データ変換エラー: ${conversionError instanceof Error ? conversionError.message : '不明なエラー'}`]
            });
          }
        }
      });

      // インポート結果を設定
      const result: ImportResult = {
        successCount,
        errorCount,
        validationErrors,
        processedQuizzes
      };
      setImportResult(result);

      // 成功した問題がある場合のみコールバック関数を呼び出し
      if (processedQuizzes.length > 0) {
        onImport(processedQuizzes);
        setYamlText(''); // 入力欄をクリア
      }

      // エラーがある場合は自動的にエラー詳細を表示
      if (validationErrors.length > 0) {
        setShowErrors(true);
      }

    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(`YAMLの処理中にエラーが発生しました: ${error.message}`);
      } else {
        setErrorMessage('YAMLの処理中に不明なエラーが発生しました');
      }
    } finally {
      setLoading(false);
    }
  };

  const exampleYaml = `# クイズユニット一括インポート例
# このYAMLフォーマットを使用して、複数のクイズを一度にインポートできます。
# 選択肢の数は3~5つまで。
# correctAnswerは選択肢のテキストまたは0から始まるインデックス番号で指定できます。
quizzes:
  - title: 日本の首都
    question: 日本の首都はどこですか？
    type: multiple_choice
    choices:
      - 大阪
      - 東京
      - 京都
    correctAnswer: 東京
    explanation: 東京都は1868年に日本の首都となりました。

  - title: G7加盟国
    question: 次のうちG7（主要国首脳会議）加盟国はどれですか？
    type: multiple_choice
    choices:
      - カナダ
      - ロシア
      - 中国
      - オーストラリア
      - インド
    correctAnswer: 0
    explanation: G7加盟国は、アメリカ、日本、イギリス、フランス、ドイツ、イタリア、カナダの7か国です。（正解は0番目の「カナダ」）

  - title: 富士山の高さ
    question: 富士山の標高は何メートルですか？
    type: input
    correctAnswer: 3776
    acceptableAnswers:
      - "3,776"
      - "約3800"
    explanation: 富士山の正確な標高は3,776メートルです。
    `;

  return (
    <div className="border border-gray-200 rounded-lg p-6 mb-6">
      <h2 className="text-xl font-semibold mb-4">YAML一括インポート</h2>
      
      <p className="text-sm text-gray-600 mb-4">
        YAMLフォーマットを使用して、複数のクイズを一度にインポートできます。
        <button 
          className="text-indigo-600 hover:text-indigo-800 ml-2 underline"
          onClick={() => setShowExample(!showExample)}
        >
          {showExample ? '例を隠す' : '例を見る'}
        </button>
      </p>

      {showExample && (
        <div className="bg-gray-50 p-6 rounded-lg mb-6">
          <h3 className="font-medium mb-3">YAMLフォーマット例:</h3>
          <pre className="text-sm overflow-auto whitespace-pre-wrap bg-gray-100 p-4 rounded max-h-64">
            {exampleYaml}
          </pre>
        </div>
      )}
      
      {errorMessage && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-lg mb-4">
          <p>{errorMessage}</p>
        </div>
      )}

      {importResult && (
        <div className="mb-4">
          {/* インポート結果サマリー */}
          <div className={`border-l-4 p-4 rounded-lg mb-4 ${
            importResult.errorCount === 0 
              ? 'bg-green-50 border-green-500 text-green-700'
              : importResult.successCount > 0
                ? 'bg-yellow-50 border-yellow-500 text-yellow-700'
                : 'bg-red-50 border-red-500 text-red-700'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">
                  インポート完了: {importResult.successCount}件成功
                  {importResult.errorCount > 0 && `, ${importResult.errorCount}件エラー`}
                </p>
                {importResult.successCount > 0 && (
                  <p className="text-sm mt-1">
                    {importResult.successCount}件の問題が正常にインポートされました。
                  </p>
                )}
              </div>
              {importResult.errorCount > 0 && (
                <button
                  onClick={() => setShowErrors(!showErrors)}
                  className="text-sm underline hover:no-underline"
                >
                  {showErrors ? 'エラー詳細を隠す' : 'エラー詳細を表示'}
                </button>
              )}
            </div>
          </div>

          {/* エラー詳細（折りたたみ可能） */}
          {showErrors && importResult.validationErrors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <h4 className="font-medium text-red-800 mb-3">エラー詳細</h4>
              <div className="space-y-3">
                {importResult.validationErrors.map((error, index) => (
                  <div key={index} className="bg-white border border-red-200 rounded p-3">
                    <h5 className="font-medium text-red-700 mb-2">
                      問題 {error.quizIndex}: {error.quizTitle}
                    </h5>
                    <ul className="list-disc list-inside text-sm text-red-600 space-y-1">
                      {error.errors.map((errorMsg, errorIndex) => (
                        <li key={errorIndex}>{errorMsg}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
                <p className="text-sm text-blue-700">
                  <strong>ヒント:</strong> エラーがある問題は自動的にスキップされ、正常な問題のみがインポートされます。
                  上記のエラーを修正してから再度インポートしてください。
                </p>
              </div>
            </div>
          )}
        </div>
      )}
      
      <div className="mb-4">
        <textarea
          className="form-textarea font-mono text-sm"
          value={yamlText}
          onChange={(e) => setYamlText(e.target.value)}
          placeholder="YAMLフォーマットでクイズを入力..."
          rows={15}
          style={{ minHeight: '400px' }}
        ></textarea>
      </div>
      
      <div className="flex justify-end">
        <button
          type="button"
          onClick={processYaml}
          className="btn-primary flex items-center"
          disabled={loading || !yamlText.trim()}
        >
          {loading ? (
            <>
              <FaSpinner className="animate-spin mr-2" /> 処理中...
            </>
          ) : (
            <>
              <FaFileImport className="mr-2" /> インポート
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default YamlBulkImport;
