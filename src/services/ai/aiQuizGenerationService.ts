import { db } from '@/config/firebase';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Timestamp, collection, doc, runTransaction } from 'firebase/firestore';
import * as yaml from 'js-yaml';
import { QUIZ_UNIT } from '@/config/quizConfig';

// AI生成クイズのインターフェース
interface AIGeneratedQuiz {
  title: string;
  question: string;
  type: 'multiple_choice' | 'input';
  choices?: string[];
  correctAnswer: string;
  acceptableAnswers?: string[];
  explanation?: string;
}

interface AIQuizUnit {
  title: string;
  description?: string;
  quizzes: AIGeneratedQuiz[];
}

export class AIQuizGenerationService {
  private static getGenAI() {
    const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!API_KEY) {
      throw new Error('NEXT_PUBLIC_GEMINI_API_KEY環境変数が設定されていません');
    }
    return new GoogleGenerativeAI(API_KEY);
  }

  private static getModel() {
    return this.getGenAI().getGenerativeModel({ model: 'gemini-1.5-flash' });
  }

  /**
   * Gemini APIを使ってクイズを生成する
   */
  static async generateQuizzes(
    topic: string,
    count: number = QUIZ_UNIT.MAX_QUESTIONS_PER_UNIT,
    questionType: 'mixed' | 'multiple_choice' | 'input' = 'mixed'
  ): Promise<AIQuizUnit> {
    try {
      console.log(`[AIQuizGeneration] クイズ生成開始: ${topic}, 問題数: ${count}`);

      const prompt = this.createPrompt(topic, count, questionType);
      
      const model = this.getModel();
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      console.log('[AIQuizGeneration] Gemini APIレスポンス受信');

      // YAMLをパースして検証
      const parsedData = yaml.load(text) as AIQuizUnit;
      const validatedData = this.validateAndFixQuizData(parsedData, topic);

      console.log(`[AIQuizGeneration] クイズ生成完了: ${validatedData.quizzes.length}問`);
      return validatedData;

    } catch (error) {
      console.error('[AIQuizGeneration] エラー:', error);
      
      // エラーの詳細情報を取得
      let errorMessage = 'クイズ生成中にエラーが発生しました';
      let shouldUseFallback = false;
      
      if (error && typeof error === 'object' && 'message' in error) {
        const errorMsg = error.message as string;
        if (errorMsg.includes('API key') || errorMsg.includes('invalid')) {
          errorMessage = 'APIキーが無効または設定されていません。管理者に連絡してください。';
        } else if (errorMsg.includes('404') || errorMsg.includes('not found') || errorMsg.includes('models/gemini-1.5-flash')) {
          errorMessage = 'AIモデルが利用できません。フォールバック機能を使用します。';
          shouldUseFallback = true;
        } else if (errorMsg.includes('quota') || errorMsg.includes('limit')) {
          errorMessage = 'API利用制限に達しています。フォールバック機能を使用します。';
          shouldUseFallback = true;
        } else {
          errorMessage = `AI生成エラー: ${errorMsg}`;
          shouldUseFallback = true;
        }
      } else {
        shouldUseFallback = true;
      }
      
      // フォールバック機能を使用する場合
      if (shouldUseFallback) {
        console.log('[AIQuizGeneration] フォールバック機能を使用してクイズを生成します');
        return this.createFallbackQuizzes(topic, count);
      }
      
      // カスタムエラーをスローして呼び出し元に詳細を伝える
      throw new Error(errorMessage);
    }
  }

  /**
   * プロンプトを作成
   */
  private static createPrompt(
    topic: string,
    count: number,
    questionType: 'mixed' | 'multiple_choice' | 'input'
  ): string {

    const typeDescription: Record<'mixed' | 'multiple_choice' | 'input', string> = {
      mixed: '選択肢問題と記述問題を混合',
      multiple_choice: '選択肢問題のみ',
      input: '記述問題のみ'
    };

    return `
あなたは教育コンテンツの専門家です。「${topic}」に関するクイズを10問作成してください。
難易度は、中堅国公立から難関私立大学入試くらいです。
高校生向けです。中学生で習うような簡単すぎる内容が入らないように注意してください。
カタカナの読み方は、十分に注意して、教科書と同じになるようにしてください。
explanationは長過ぎないように。短くても良いです。長い場合は"で囲ってください。
選択肢の数は3~5つまで。
【要求仕様】
- 問題形式: ${typeDescription[questionType]}
- 出力形式: YAML形式で厳密に従うこと

【YAML形式の例】
\`\`\`yaml
title: ${topic}クイズ
description: ${topic}に関する基礎から応用までの問題集
quizzes:
  - title: 問題のタイトル
    question: 問題文をここに記載
    type: multiple_choice
    choices:
      - 選択肢1
      - 選択肢2
      - 選択肢3
      - 選択肢4
    correctAnswer: 選択肢2
    explanation: 解説文をここに記載

  - title: 記述問題のタイトル
    question: 記述問題の問題文
    type: input
    correctAnswer: 正解
    acceptableAnswers:
      - 別解1
      - 別解2
    explanation: 解説文
\`\`\`

【重要な制約】
1. 選択肢問題は必ず3〜5つの選択肢を用意
2. correctAnswerは選択肢のテキストと完全一致させる
3. 記述問題の場合、acceptableAnswersで表記揺れを考慮
4. 全ての問題に解説を付ける
5. 事実に基づいた正確な内容のみ
6. YAMLの構文エラーがないよう注意

上記の仕様に従って、${topic}に関する10問のクイズをYAML形式で生成してください。\`\`\`yaml と \`\`\` は不要です。直接YAMLを出力してください。
`;
  }

  /**
   * 生成されたクイズデータを検証・修正
   */
  private static validateAndFixQuizData(data: any, topic: string): AIQuizUnit {
    if (!data || typeof data !== 'object') {
      throw new Error('無効なデータ形式');
    }

    // 基本構造の検証・修正
    const result: AIQuizUnit = {
      title: data.title || `${topic}クイズ`,
      description: data.description || `${topic}に関するクイズ集`,
      quizzes: []
    };

    if (!data.quizzes || !Array.isArray(data.quizzes)) {
      throw new Error('クイズデータが見つかりません');
    }

    // 各クイズの検証・修正
    data.quizzes.forEach((quiz: any, index: number) => {
      try {
        const validatedQuiz = this.validateSingleQuiz(quiz, index);
        result.quizzes.push(validatedQuiz);
      } catch (error) {
        console.warn(`[AIQuizGeneration] クイズ${index + 1}をスキップ:`, error);
      }
    });

    if (result.quizzes.length === 0) {
      throw new Error('有効なクイズが生成されませんでした');
    }

    return result;
  }

  /**
   * 単一クイズの検証
   */
  private static validateSingleQuiz(quiz: any, index: number): AIGeneratedQuiz {
    const errors: string[] = [];

    // 必須フィールドの検証
    if (!quiz.title || typeof quiz.title !== 'string') {
      errors.push('タイトルが無効');
    }
    if (!quiz.question || typeof quiz.question !== 'string') {
      errors.push('問題文が無効');
    }
    if (!quiz.type || !['multiple_choice', 'input'].includes(quiz.type)) {
      errors.push('問題タイプが無効');
    }
    if (!quiz.correctAnswer) {
      errors.push('正解が無効');
    }

    // 選択肢問題の検証
    if (quiz.type === 'multiple_choice') {
      if (!quiz.choices || !Array.isArray(quiz.choices) || quiz.choices.length < 3) {
        errors.push('選択肢が不足');
      }
      
      // 正解が選択肢に含まれているかチェック
      if (quiz.choices && !quiz.choices.includes(quiz.correctAnswer)) {
        // インデックス指定の場合もチェック
        const index = parseInt(quiz.correctAnswer);
        if (isNaN(index) || index < 0 || index >= quiz.choices.length) {
          errors.push('正解が選択肢に含まれていない');
        } else {
          quiz.correctAnswer = quiz.choices[index];
        }
      }
    }

    if (errors.length > 0) {
      throw new Error(`問題${index + 1}: ${errors.join(', ')}`);
    }

    return {
      title: quiz.title.slice(0, 50), // 長さ制限
      question: quiz.question.slice(0, 500), // 長さ制限
      type: quiz.type,
      choices: quiz.type === 'multiple_choice' ? quiz.choices : undefined,
      correctAnswer: String(quiz.correctAnswer).slice(0, 100),
      acceptableAnswers: quiz.acceptableAnswers || [],
      explanation: quiz.explanation || ''
    };
  }

  /**
   * フォールバック用の基本クイズ
   */
  private static createFallbackQuizzes(topic: string, count: number): AIQuizUnit {
    const fallbackQuizzes: AIGeneratedQuiz[] = [];
    
    for (let i = 1; i <= Math.min(count, 3); i++) {
      fallbackQuizzes.push({
        title: `${topic}の基礎問題${i}`,
        question: `${topic}に関する基本的な問題です。`,
        type: 'input',
        correctAnswer: `${topic}`,
        acceptableAnswers: [],
        explanation: `${topic}に関する基本的な知識です。`
      });
    }

    return {
      title: `${topic}フォールバッククイズ`,
      description: `${topic}に関する基本的なクイズ（AI生成失敗時のフォールバック）`,
      quizzes: fallbackQuizzes
    };
  }

  /**
   * 生成したクイズをFirestoreに保存
   */
  static async saveGeneratedQuizUnit(
    aiQuizUnit: AIQuizUnit,
    genreId: string,
    createdBy: string,
    unitName: string
  ): Promise<string> {
    try {
      console.log(`[AIQuizGeneration] Firestoreに保存開始: ${genreId}/${unitName}`);

      const unitId = await runTransaction(db, async (transaction) => {
        // 単元ドキュメントを作成
        const unitRef = doc(collection(db, 'genres', genreId, 'official_quiz_units'));
        const unitData = {
          title: unitName,
          description: aiQuizUnit.description,
          genre: genreId,
          createdBy: createdBy,
          createdAt: Timestamp.now(),
          quizCount: aiQuizUnit.quizzes.length,
          useCount: 0,
          isPublic: true
        };

        transaction.set(unitRef, unitData);

        // 各クイズを保存
        aiQuizUnit.quizzes.forEach((quiz, index) => {
          const quizRef = doc(collection(db, 'genres', genreId, 'official_quiz_units', unitRef.id, 'quizzes'));
          const quizData = {
            title: quiz.title,
            question: quiz.question,
            type: quiz.type,
            choices: quiz.choices || [],
            correctAnswer: quiz.correctAnswer,
            acceptableAnswers: quiz.acceptableAnswers || [],
            explanation: quiz.explanation || '',
            genre: genreId,
            createdBy: createdBy,
            createdAt: Timestamp.now(),
            useCount: 0,
            correctCount: 0
          };

          transaction.set(quizRef, quizData);
        });

        return unitRef.id;
      });

      console.log(`[AIQuizGeneration] 保存完了: unitId=${unitId}`);
      return unitId;

    } catch (error) {
      console.error('[AIQuizGeneration] 保存エラー:', error);
      throw new Error('生成したクイズの保存に失敗しました');
    }
  }
}
