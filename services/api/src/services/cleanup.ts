import { prisma } from '../db';
import { config } from '../config';
import { logger } from '../utils/logger';

export async function cleanupOldData() {
    try {
        const now = new Date();

        // Cleanup AppLogs
        if (config.retention.appLogsDays > 0) {
            const logsCutoff = new Date(now.getTime() - config.retention.appLogsDays * 24 * 60 * 60 * 1000);
            const logsResult = await prisma.appLog.deleteMany({
                where: {
                    timestamp: {
                        lt: logsCutoff,
                    },
                },
            });
            if (logsResult.count > 0) {
                logger.info(`Cleaned up ${logsResult.count} old AppLogs`, { cutoff: logsCutoff.toISOString() });
            }
        }

        // Cleanup MetricSnapshots
        if (config.retention.metricSnapshotsDays > 0) {
            const metricsCutoff = new Date(now.getTime() - config.retention.metricSnapshotsDays * 24 * 60 * 60 * 1000);
            const metricsResult = await prisma.metricSnapshot.deleteMany({
                where: {
                    timestamp: {
                        lt: metricsCutoff,
                    },
                },
            });
            if (metricsResult.count > 0) {
                logger.info(`Cleaned up ${metricsResult.count} old MetricSnapshots`, { cutoff: metricsCutoff.toISOString() });
            }
        }
    } catch (error) {
        logger.error('Failed to cleanup old data', { error });
    }
}
