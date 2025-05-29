import { ParticipantInfo } from '@/types/user';
import { FaTrophy } from 'react-icons/fa';

interface ScoreBoardProps {
  participants: { [userId: string]: ParticipantInfo };
  isHorizontal?: boolean;
}

export default function ScoreBoard({ participants, isHorizontal = false }: ScoreBoardProps) {
  // 参加者をスコア順に並べ替え
  const sortedParticipants = Object.entries(participants)
    .map(([userId, participant]) => ({
      userId,
      ...participant
    }))
    .sort((a, b) => (b.score || 0) - (a.score || 0));

  // 上位のランクに対応する色とアイコン
  const rankStyles = [
    { color: 'text-yellow-600', bgColor: 'bg-yellow-100', icon: <FaTrophy className="text-yellow-500" /> },
    { color: 'text-gray-600', bgColor: 'bg-gray-100', icon: <FaTrophy className="text-gray-400" /> },
    { color: 'text-amber-800', bgColor: 'bg-amber-100', icon: <FaTrophy className="text-amber-700" /> },
  ];

  if (isHorizontal) {
    // 横並び表示（全参加者を表示、必要に応じてスクロール）
    
    return (
      <div className="flex gap-2 justify-start overflow-x-auto pb-1">
        {sortedParticipants.length === 0 ? (
          <p className="text-gray-500 text-center italic w-full">参加者がいません</p>
        ) : (
          sortedParticipants.map((participant, index) => (
            <div
              key={participant.userId}
              className={`flex flex-col items-center p-2 rounded-lg min-w-[80px] flex-shrink-0 ${
                index < 3 ? rankStyles[index].bgColor : 'bg-gray-50'
              }`}
            >
              <div className="text-xs mb-1">
                {index < 3 ? rankStyles[index].icon : `${index + 1}位`}
              </div>
              <div className={`text-xs font-medium truncate max-w-[70px] text-center ${
                index < 3 ? rankStyles[index].color : 'text-gray-700'
              }`}>
                {participant.username || 'Unknown'}
              </div>
              <div className="text-sm font-bold mt-1">
                {participant.score || 0}
              </div>
            </div>
          ))
        )}
      </div>
    );
  }

  // 縦並び表示（元の表示方法）
  return (
    <div className="space-y-2">
      {sortedParticipants.length === 0 ? (
        <p className="text-gray-500 text-center italic">参加者がいません</p>
      ) : (
        sortedParticipants.map((participant, index) => (
          <div
            key={participant.userId}
            className={`flex items-center justify-between p-2 rounded-md ${
              index < 3 ? rankStyles[index].bgColor : 'hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center">
              <div className="w-6 text-center mr-2 font-medium">
                {index < 3 ? rankStyles[index].icon : index + 1}
              </div>
              <span className={`font-medium ${index < 3 ? rankStyles[index].color : ''}`}>
                {participant.username || 'Unknown'}
              </span>
            </div>
            <div className="font-bold">
              {participant.score || 0}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
