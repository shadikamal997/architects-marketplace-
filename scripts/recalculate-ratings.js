#!/usr/bin/env node

/**
 * ADMIN SCRIPT: Recalculate All Design Ratings
 * 
 * Purpose: Fix any rating inconsistencies by recalculating from reviews
 * 
 * Use cases:
 * - After manual data changes
 * - After data import
 * - To fix any drift over time
 * - One-time data integrity check
 * 
 * Safe to run multiple times - idempotent operation
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function recalculateDesignRatings() {
  log('\n╔════════════════════════════════════════════════╗', 'cyan');
  log('║   RECALCULATE ALL DESIGN RATINGS               ║', 'cyan');
  log('║   Data Integrity & Aggregation Fix             ║', 'cyan');
  log('╚════════════════════════════════════════════════╝\n', 'cyan');

  try {
    // Step 1: Get all designs
    log('📊 Fetching all designs...', 'blue');
    const designs = await prisma.design.findMany({
      select: {
        id: true,
        title: true,
        averageRating: true,
        reviewCount: true,
      },
    });

    log(`Found ${designs.length} designs to process\n`, 'blue');

    if (designs.length === 0) {
      log(' No designs found. Nothing to do.\n', 'green');
      return;
    }

    // Step 2: Process each design
    let updatedCount = 0;
    let unchangedCount = 0;
    let errors = 0;

    for (let i = 0; i < designs.length; i++) {
      const design = designs[i];
      const progress = `[${i + 1}/${designs.length}]`;

      try {
        // Calculate stats from reviews
        const stats = await prisma.review.aggregate({
          where: {
            designId: design.id,
            status: 'PUBLISHED',
          },
          _avg: {
            rating: true,
          },
          _count: true,
        });

        const newAvgRating = stats._avg.rating 
          ? Math.round(stats._avg.rating * 10) / 10 
          : 0;
        const newReviewCount = stats._count;

        // Check if update needed
        if (
          design.averageRating !== newAvgRating ||
          design.reviewCount !== newReviewCount
        ) {
          // Update design
          await prisma.design.update({
            where: { id: design.id },
            data: {
              averageRating: newAvgRating,
              reviewCount: newReviewCount,
            },
          });

          log(
            `${progress}  UPDATED: "${design.title}" | ` +
            `Rating: ${design.averageRating} → ${newAvgRating} | ` +
            `Count: ${design.reviewCount} → ${newReviewCount}`,
            'green'
          );
          updatedCount++;
        } else {
          log(
            `${progress}  OK: "${design.title}" | ` +
            `Rating: ${design.averageRating} | Reviews: ${design.reviewCount}`,
            'gray'
          );
          unchangedCount++;
        }
      } catch (error) {
        log(
          `${progress} ✗ ERROR: "${design.title}" - ${error.message}`,
          'red'
        );
        errors++;
      }
    }

    // Step 3: Summary
    log('\n' + '═'.repeat(50), 'cyan');
    log('SUMMARY', 'cyan');
    log('═'.repeat(50), 'cyan');
    log(`Total Designs:     ${designs.length}`, 'blue');
    log(`Updated:           ${updatedCount}`, 'green');
    log(`Already Correct:   ${unchangedCount}`, 'gray');
    if (errors > 0) {
      log(`Errors:            ${errors}`, 'red');
    }
    log('═'.repeat(50) + '\n', 'cyan');

    if (updatedCount > 0) {
      log(` Successfully recalculated ratings for ${updatedCount} designs`, 'green');
    } else {
      log(' All design ratings are already up-to-date!', 'green');
    }

    if (errors > 0) {
      log(`  ${errors} errors occurred. Review the output above.`, 'yellow');
    }

  } catch (error) {
    log('\n✗ Fatal error:', 'red');
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run script
recalculateDesignRatings()
  .then(() => {
    log('\n Script completed successfully\n', 'green');
    process.exit(0);
  })
  .catch((error) => {
    log('\n✗ Script failed\n', 'red');
    console.error(error);
    process.exit(1);
  });
