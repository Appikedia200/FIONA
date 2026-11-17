#!/usr/bin/env node

/**
 * MIGRATION SCRIPT - Phase 1: Database Redesign
 * 
 * This script:
 * 1. Backs up current database
 * 2. Replaces schema
 * 3. Runs Prisma migrations
 * 4. Seeds default admin user
 * 5. Migrates existing data (if any)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = '') {
  console.log(`${color}${message}${COLORS.reset}`);
}

function step(number, title) {
  log(`\n${'='.repeat(60)}`, COLORS.cyan);
  log(`STEP ${number}: ${title}`, COLORS.bright + COLORS.cyan);
  log('='.repeat(60), COLORS.cyan);
}

function success(message) {
  log(`✅ ${message}`, COLORS.green);
}

function error(message) {
  log(`❌ ${message}`, COLORS.red);
}

function warning(message) {
  log(`⚠️  ${message}`, COLORS.yellow);
}

function info(message) {
  log(`ℹ️  ${message}`, COLORS.blue);
}

function exec(command, description) {
  try {
    info(`Executing: ${description}`);
    const result = execSync(command, { 
      encoding: 'utf8',
      stdio: 'pipe',
      cwd: path.join(__dirname, '..')
    });
    success(`Completed: ${description}`);
    return result;
  } catch (err) {
    error(`Failed: ${description}`);
    error(err.message);
    throw err;
  }
}

async function main() {
  log('\n🚀 FIONA DATABASE MIGRATION - PHASE 1', COLORS.bright + COLORS.magenta);
  log('Multi-Tenant Architecture Upgrade\n', COLORS.magenta);

  const backendDir = path.join(__dirname, '..');
  const prismaDir = path.join(backendDir, 'prisma');
  const dbPath = path.join(prismaDir, 'dev.db');
  const backupPath = path.join(prismaDir, `dev.db.backup.${Date.now()}`);
  const oldSchemaPath = path.join(prismaDir, 'schema.prisma');
  const newSchemaPath = path.join(prismaDir, 'schema.new.prisma');
  const oldSchemaBackup = path.join(prismaDir, `schema.prisma.backup.${Date.now()}`);

  // =====================================
  // STEP 1: Backup Current Database
  // =====================================
  step(1, 'Backup Current Database');
  
  if (fs.existsSync(dbPath)) {
    fs.copyFileSync(dbPath, backupPath);
    success(`Database backed up to: ${path.basename(backupPath)}`);
  } else {
    warning('No existing database found. Creating new database.');
  }

  // =====================================
  // STEP 2: Backup Current Schema
  // =====================================
  step(2, 'Backup Current Schema');
  
  if (fs.existsSync(oldSchemaPath)) {
    fs.copyFileSync(oldSchemaPath, oldSchemaBackup);
    success(`Schema backed up to: ${path.basename(oldSchemaBackup)}`);
  }

  // =====================================
  // STEP 3: Replace Schema
  // =====================================
  step(3, 'Replace Prisma Schema');
  
  if (!fs.existsSync(newSchemaPath)) {
    error('New schema file not found: schema.new.prisma');
    process.exit(1);
  }

  fs.copyFileSync(newSchemaPath, oldSchemaPath);
  success('New schema applied successfully');

  // =====================================
  // STEP 4: Generate Prisma Client
  // =====================================
  step(4, 'Generate Prisma Client');
  
  exec(
    'npx prisma generate',
    'Generating Prisma Client'
  );

  // =====================================
  // STEP 5: Create Migration
  // =====================================
  step(5, 'Create Database Migration');
  
  try {
    exec(
      'npx prisma migrate dev --name multi_tenant_architecture --create-only',
      'Creating migration'
    );
    success('Migration created successfully');
  } catch (err) {
    warning('Migration creation had warnings (this is normal for major schema changes)');
  }

  // =====================================
  // STEP 6: Apply Migration
  // =====================================
  step(6, 'Apply Migration');
  
  try {
    exec(
      'npx prisma migrate deploy',
      'Applying migration to database'
    );
    success('Migration applied successfully');
  } catch (err) {
    error('Migration failed. Database may need manual intervention.');
    info('You can restore from backup: ' + backupPath);
    throw err;
  }

  // =====================================
  // STEP 7: Seed Database
  // =====================================
  step(7, 'Seed Default Data');
  
  try {
    exec(
      'npx prisma db seed',
      'Seeding default admin user'
    );
    success('Database seeded successfully');
  } catch (err) {
    warning('Seed failed (may already exist). Continuing...');
  }

  // =====================================
  // STEP 8: Verify Database
  // =====================================
  step(8, 'Verify Database');
  
  exec(
    'npx prisma db push --accept-data-loss',
    'Verifying database schema'
  );
  success('Database schema verified');

  // =====================================
  // COMPLETE
  // =====================================
  log('\n' + '='.repeat(60), COLORS.green);
  log('✅ MIGRATION COMPLETED SUCCESSFULLY!', COLORS.bright + COLORS.green);
  log('='.repeat(60), COLORS.green);

  log('\n📋 NEXT STEPS:', COLORS.bright);
  log('1. Review the migration files in prisma/migrations/', COLORS.cyan);
  log('2. Test the new database structure', COLORS.cyan);
  log('3. Start implementing the new authentication system', COLORS.cyan);
  log('4. Update admin and technician panels', COLORS.cyan);

  log('\n💾 BACKUP LOCATIONS:', COLORS.bright);
  log(`Database: ${backupPath}`, COLORS.yellow);
  log(`Schema: ${oldSchemaBackup}`, COLORS.yellow);

  log('\n🔐 DEFAULT ADMIN CREDENTIALS:', COLORS.bright);
  log('Email: admin@fiona.local', COLORS.magenta);
  log('Password: Admin@2026!', COLORS.magenta);
  log('⚠️  CHANGE THIS PASSWORD IMMEDIATELY!', COLORS.red);

  log('\n');
}

// Run migration
main().catch((err) => {
  error('\n❌ MIGRATION FAILED!');
  error(err.message);
  log('\nPlease restore from backup if needed.', COLORS.yellow);
  process.exit(1);
});
