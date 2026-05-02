// prisma/seed.ts
// Development seed data — creates sample users and a published recording
// Run with: npx ts-node prisma/seed.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create two sample users
  const alice = await prisma.user.upsert({
    where: { firebaseUid: 'seed-firebase-alice' },
    update: {},
    create: {
      firebaseUid: 'seed-firebase-alice',
      email: 'alice@example.com',
      name: 'Alice Chen',
      ageRange: 'AGE_23_27',
      bio: 'Tech enthusiast & philosophy nerd. Always up for a deep conversation.',
      interests: ['tech', 'philosophy', 'career', 'creativity'],
      reputationScore: 4.8,
      totalSessions: 12,
    },
  });

  const bob = await prisma.user.upsert({
    where: { firebaseUid: 'seed-firebase-bob' },
    update: {},
    create: {
      firebaseUid: 'seed-firebase-bob',
      email: 'bob@example.com',
      name: 'Bob Mwangi',
      ageRange: 'AGE_28_32',
      bio: 'Startup founder. Love debating ideas that matter.',
      interests: ['career', 'tech', 'relationships', 'fitness'],
      reputationScore: 4.5,
      totalSessions: 8,
    },
  });

  // Create a match
  const match = await prisma.match.create({
    data: {
      userAId: alice.id,
      userBId: bob.id,
      topic: 'tech',
      mood: 'DEEP',
      status: 'COMPLETED',
      session: {
        create: {
          userAId: alice.id,
          userBId: bob.id,
          topic: 'tech',
          mood: 'DEEP',
          status: 'COMPLETED',
          roomToken: 'seed-room-token-001',
          startedAt: new Date(Date.now() - 25 * 60 * 1000),
          endedAt: new Date(),
          durationSec: 1500,
        },
      },
    },
    include: { session: true },
  });

  // Create a published recording for the feed
  await prisma.recording.create({
    data: {
      sessionId: match.session!.id,
      title: 'AI and the future of meaningful work',
      description: 'Alice and Bob explore whether AI will liberate us or leave us purposeless.',
      tags: ['tech', 'philosophy', 'career'],
      storageKey: 'recordings/seed/sample.webm',
      storageUrl: 'https://sample-videos.com/video321/mp4/240/big_buck_bunny_240p_1mb.mp4',
      durationSec: 1500,
      sizeBytes: BigInt(45_000_000),
      isPublic: true,
      viewCount: 142,
      publishedAt: new Date(),
      participants: {
        create: [
          { userId: alice.id, hasConsented: true },
          { userId: bob.id, hasConsented: true },
        ],
      },
    },
  });

  // Create ratings
  await prisma.rating.createMany({
    data: [
      {
        sessionId: match.session!.id,
        raterId: alice.id,
        rateeId: bob.id,
        score: 5,
        isFlagged: false,
      },
      {
        sessionId: match.session!.id,
        raterId: bob.id,
        rateeId: alice.id,
        score: 5,
        isFlagged: false,
      },
    ],
    skipDuplicates: true,
  });

  console.log('✅ Seed complete');
  console.log(`   Alice: ${alice.id}`);
  console.log(`   Bob:   ${bob.id}`);
  console.log(`   Match: ${match.id}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
