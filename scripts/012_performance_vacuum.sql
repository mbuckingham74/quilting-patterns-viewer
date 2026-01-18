-- Performance: VACUUM and ANALYZE
-- Date: 2026-01-17
-- Description: Clean up dead rows and update statistics
--
-- Run this AFTER the security migration.
-- These commands cannot be run inside a transaction.

-- Clean dead rows and update statistics on tables with bloat
VACUUM ANALYZE patterns;
VACUUM ANALYZE pattern_keywords;
VACUUM ANALYZE orientation_analysis;
VACUUM ANALYZE upload_logs;
VACUUM ANALYZE profiles;

-- Full vacuum on pattern_similarities if needed (locks table, use during low traffic)
-- VACUUM FULL ANALYZE pattern_similarities;
