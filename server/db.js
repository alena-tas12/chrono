const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

// Load environment variables
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
    connectionString,
    connectionTimeoutMillis: 5000
});

const adapter = new PrismaPg(pool);

// Initialize Prisma Client with driver adapter
const prisma = new PrismaClient({
    adapter,
    log: ['error', 'warn']
});

module.exports = prisma;
