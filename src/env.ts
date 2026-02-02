import dotenv from 'dotenv';

// Load environment variables FIRST
dotenv.config({ path: '.env' }); // Load .env first
const envFile = process.env.NODE_ENV === 'staging' ? '.env.staging' : '.env';
dotenv.config({ path: envFile });

export {};