import { ParticipantInfo } from '@/types/user';
import { FaCrown, FaUser } from 'react-icons/fa';

interface ParticipantListProps {
  participants: { [userId: string]: ParticipantInfo };
  leaderId: string;
}

export default function ParticipantList({ participants, leaderId }: ParticipantListProps) {
  // 参加者をスコア順に並べ替え
  const sortedParticipants = Object.entries(participants)
    .map(([userId, participant]) => ({
      userId,
      ...participant
    }))
    .sort((a, b) => b.score - a.score);

  return (
    <div className="space-y-3">
      {sortedParticipants.length === 0 ? (
        <p className="text-gray-500 text-center italic">参加者がいません</p>
      ) : (
        sortedParticipants.map((participant) => (
          <div key={participant.userId} className="flex items-center justify-between p-2 rounded-md hover:bg-gray-50">
            <div className="flex items-center">
              <div className="bg-indigo-100 p-2 rounded-full mr-3">
                <FaUser className="text-indigo-600" />
              </div>
              <div>
                <div className="flex items-center">
                  <span className="font-medium">{participant.username}</span>
                  {participant.userId === leaderId && (
                    <FaCrown className="ml-1 text-yellow-500" title="ルームリーダー" />
                  )}
                </div>
                <div className="text-xs text-gray-500">
                  スコア: {participant.score}
                </div>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
