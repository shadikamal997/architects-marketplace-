/**
 * CommonJS wrapper for TypeScript auth routes
 * This allows server.js (CommonJS) to load the TS routes via tsx/register
 */

// Register tsx to handle TypeScript imports
require('tsx/cjs');

// Import the TypeScript routes and export the default
const authRoutes = require('./auth.routes.ts');
module.exports = authRoutes.default || authRoutes;
