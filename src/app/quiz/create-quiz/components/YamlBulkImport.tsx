'use client';

import { FC, useState } from 'react';
import { FaFileImport, FaSpinner } from 'react-icons/fa';
import yaml from 'js-yaml';
import { Quiz, QuizType } from '@/types/quiz';
import { QuizDifficulty } from '../create-types';

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
  difficulty?: number;
}

interface YamlUnit {
  title?: string;
  description?: string;
  quizzes: YamlQuiz[];
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

  // YAMLの解析と処理
  const processYaml = () => {
    if (!yamlText.trim()) {
      setErrorMessage('YAMLテキストが入力されていません');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      // YAMLをJavaScriptオブジェクトに変換
      const parsedData = yaml.load(yamlText) as YamlUnit;

      if (!parsedData || typeof parsedData !== 'object') {
        throw new Error('有効なYAMLフォーマットではありません');
      }

      if (!parsedData.quizzes || !Array.isArray(parsedData.quizzes) || parsedData.quizzes.length === 0) {
        throw new Error('クイズが見つかりませんでした。YAMLフォーマットを確認してください');
      }

      // クイズデータを変換
      const processedQuizzes: Omit<Quiz, 'quizId' | 'createdAt'>[] = parsedData.quizzes.map((yamlQuiz) => {
        // バリデーション
        if (!yamlQuiz.title) {
          throw new Error(`クイズにタイトルがありません: ${JSON.stringify(yamlQuiz).substring(0, 50)}...`);
        }
        if (!yamlQuiz.question) {
          throw new Error(`クイズ「${yamlQuiz.title}」に問題文がありません`);
        }
        if (!yamlQuiz.correctAnswer) {
          throw new Error(`クイズ「${yamlQuiz.title}」に正解がありません`);
        }

        const quizType: QuizType = (yamlQuiz.type === 'multiple_choice' || yamlQuiz.type === 'input') 
          ? yamlQuiz.type 
          : 'input';

        if (quizType === 'multiple_choice' && (!yamlQuiz.choices || yamlQuiz.choices.length < 2)) {
          throw new Error(`選択式クイズ「${yamlQuiz.title}」に選択肢が足りません`);
        }

        return {
          title: yamlQuiz.title,
          question: yamlQuiz.question,
          type: quizType,
          choices: yamlQuiz.choices || [],
          correctAnswer: yamlQuiz.correctAnswer,
          acceptableAnswers: yamlQuiz.acceptableAnswers || [],
          explanation: yamlQuiz.explanation || '',
          difficulty: (yamlQuiz.difficulty as QuizDifficulty) || 3,
          genre,
          createdBy,
          useCount: 0,
          correctCount: 0
        };
      });

      // 成功したらコールバック関数を呼び出し
      onImport(processedQuizzes);
      setYamlText(''); // 入力欄をクリア
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
quizzes:
  - title: 日本の首都
    question: 日本の首都はどこですか？
    type: multiple_choice
    choices:
      - 大阪
      - 東京
      - 京都
      - 名古屋
    correctAnswer: 東京
    explanation: 東京都は1868年に日本の首都となりました。
    difficulty: 1

  - title: 富士山の高さ
    question: 富士山の標高は何メートルですか？
    type: input
    correctAnswer: 3776
    acceptableAnswers:
      - "3,776"
      - "約3800"
    explanation: 富士山の正確な標高は3,776メートルです。
    difficulty: 3`;

  return (
    <div className="border border-gray-200 rounded-lg p-4 mb-6">
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
        <div className="bg-gray-50 p-4 rounded-lg mb-4">
          <h3 className="font-medium mb-2">YAMLフォーマット例:</h3>
          <pre className="text-xs overflow-auto whitespace-pre-wrap bg-gray-100 p-3 rounded">
            {exampleYaml}
          </pre>
        </div>
      )}
      
      {errorMessage && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-lg mb-4">
          <p>{errorMessage}</p>
        </div>
      )}
      
      <div className="mb-4">
        <textarea
          className="form-textarea font-mono text-sm"
          value={yamlText}
          onChange={(e) => setYamlText(e.target.value)}
          placeholder="YAMLフォーマットでクイズを入力..."
          rows={10}
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
