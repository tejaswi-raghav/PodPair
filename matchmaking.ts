// webrtc/matchmaking.ts
// Background matchmaking via Socket.io
// Runs a periodic sweep to catch users who joined the queue
// but didn't immediately find a match via the HTTP endpoint.

import { Server } from 'socket.io';
import { redis, dequeue } from '../utils/redis';
import { prisma } from '../utils/prisma';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

const TOPICS = ['tech', 'relationships', 'fitness', 'travel', 'philosophy', 'career', 'random'];
const MOODS = ['DEEP', 'FUN', 'DEBATE', 'CASUAL'] as const;

// Sweep interval — check for matchable pairs every 3 seconds
const SWEEP_INTERVAL_MS = 3000;

export function registerMatchHandlers(io: Server): void {
  // Sweep all topic+mood combinations for pending pairs
  setInterval(async () => {
    for (const topic of TOPICS) {
      for (const mood of MOODS) {
        try {
          const pair = await dequeue(topic, mood);
          if (pair.length < 2) continue;

          const [userAId, userBId] = pair;
          logger.info(`Match found: ${userAId} ↔ ${userBId} [${topic}/${mood}]`);

          const match = await prisma.match.create({
            data: {
              userAId,
              userBId,
              topic,
              mood,
              status: 'ACTIVE',
              session: {
                create: {
                  userAId,
                  userBId,
                  topic,
                  mood,
                  roomToken: uuidv4(),
                  status: 'WAITING',
                },
              },
            },
            include: { session: true },
          });

          // Remove DB queue entries
          await prisma.matchQueue.deleteMany({
            where: { userId: { in: [userAId, userBId] } },
          });

          const session = match.session!;

          // Push match events to both users' personal rooms
          const payload = {
            matchId: match.id,
            sessionId: session.id,
            roomToken: session.roomToken,
            topic,
            mood,
          };

          io.to(`user:${userAId}`).emit('match:found', { ...payload, partnerId: userBId });
          io.to(`user:${userBId}`).emit('match:found', { ...payload, partnerId: userAId });
        } catch (err) {
          logger.error(`Matchmaking sweep error [${topic}/${mood}]:`, err);
        }
      }
    }
  }, SWEEP_INTERVAL_MS);

  logger.info('Matchmaking sweep started');
}
