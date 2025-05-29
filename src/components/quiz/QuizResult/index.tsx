import { Quiz } from '@/types/quiz';
import { ParticipantInfo } from '@/types/user';
import LatexRenderer from '@/components/latex/LatexRenderer';
import { FaCheck, FaTimes } from 'react-icons/fa';

interface QuizResultProps {
  isCorrect: boolean;
  quiz: Quiz | null;
  answererId: string;
  participants: { [userId: string]: ParticipantInfo };
}

export default function QuizResult({ isCorrect, quiz, answererId, participants }: QuizResultProps) {
  if (!quiz) return null;

  const answererName = participants[answererId]?.username || '不明なプレイヤー';

  return (
    <div className={`mt-4 p-3 rounded-md max-h-96 overflow-y-auto ${isCorrect ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
      <div className="flex items-start mb-3">
        <div className={`flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0 mr-3 ${isCorrect ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
          {isCorrect ? <FaCheck size={16} /> : <FaTimes size={16} />}
        </div>
        <div>
          <h3 className={`font-bold text-base ${isCorrect ? 'text-green-800' : 'text-red-800'}`}>
            {isCorrect ? '正解！' : '不正解...'}
          </h3>
          <p className="text-gray-600 text-sm">
            {answererName} さんは{isCorrect ? '正解' : '不正解'}でした
          </p>
        </div>
      </div>

      {/* 正解・不正解に関わらず正解と解説を表示 */}
      <>
        <div className="mb-3">
          <div className="font-medium mb-1 text-sm">正解:</div>
          <div className="bg-white p-2 rounded-md border border-gray-200 text-sm">
            <LatexRenderer text={quiz.correctAnswer} />
          </div>
        </div>

        {quiz.type === 'input' && quiz.acceptableAnswers && quiz.acceptableAnswers.length > 0 && (
          <div className="mb-3">
            <div className="font-medium mb-1 text-sm">許容される他の回答:</div>
            <div className="bg-white p-2 rounded-md border border-gray-200 text-sm">
              <LatexRenderer text={quiz.acceptableAnswers.join('、 ')} />
            </div>
          </div>
        )}

        {quiz.explanation && (
          <div>
            <div className="font-medium mb-1 text-sm">解説:</div>
            <div className="bg-white p-2 rounded-md border border-gray-200 text-gray-700 text-sm leading-relaxed">
              <LatexRenderer text={quiz.explanation} />
            </div>
          </div>
        )}
      </>
    </div>
  );
}
