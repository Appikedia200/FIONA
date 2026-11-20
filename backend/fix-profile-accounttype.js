/**
 * Fix accountType for existing profiles based on email domain
 * Run with: node fix-profile-accounttype.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixProfileAccountTypes() {
  console.log('🔍 Checking profiles for accountType mismatches...\n');

  // Get all profiles
  const profiles = await prisma.profile.findMany({
    select: {
      id: true,
      email: true,
      accountType: true,
    },
  });

  console.log(`Found ${profiles.length} profiles to check\n`);

  let fixedCount = 0;
  let alreadyCorrect = 0;

  for (const profile of profiles) {
    const emailLower = profile.email.toLowerCase();
    const isGmail = emailLower.endsWith('@gmail.com') || emailLower.endsWith('@googlemail.com');
    const correctAccountType = isGmail ? 'GMAIL' : 'GSUITE';

    if (profile.accountType !== correctAccountType) {
      console.log(`❌ MISMATCH: ${profile.email}`);
      console.log(`   Current: ${profile.accountType} → Correct: ${correctAccountType}`);

      await prisma.profile.update({
        where: { id: profile.id },
        data: { accountType: correctAccountType },
      });

      console.log(`   ✅ Fixed!\n`);
      fixedCount++;
    } else {
      alreadyCorrect++;
    }
  }

  console.log('\n📊 Summary:');
  console.log(`   ✅ Already correct: ${alreadyCorrect}`);
  console.log(`   🔧 Fixed: ${fixedCount}`);
  console.log(`   📝 Total checked: ${profiles.length}`);

  await prisma.$disconnect();
}

fixProfileAccountTypes()
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
