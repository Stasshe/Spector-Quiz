import { ParticipantInfo } from '@/types/user';
import { FaTrophy } from 'react-icons/fa';

interface ScoreBoardProps {
  participants: { [userId: string]: ParticipantInfo };
}

export default function ScoreBoard({ participants }: ScoreBoardProps) {
  // 参加者をスコア順に並べ替え
  const sortedParticipants = Object.entries(participants)
    .map(([userId, participant]) => ({
      userId,
      ...participant
    }))
    .sort((a, b) => b.score - a.score);

  // 上位のランクに対応する色とアイコン
  const rankStyles = [
    { color: 'text-yellow-600', bgColor: 'bg-yellow-100', icon: <FaTrophy className="text-yellow-500" /> },
    { color: 'text-gray-600', bgColor: 'bg-gray-100', icon: <FaTrophy className="text-gray-400" /> },
    { color: 'text-amber-800', bgColor: 'bg-amber-100', icon: <FaTrophy className="text-amber-700" /> },
  ];

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
                {participant.username}
              </span>
            </div>
            <div className="font-bold">
              {participant.score}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
