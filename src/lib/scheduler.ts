import cron, { ScheduledTask } from "node-cron";
import { syncAllFundsNav } from "./scraper";

const globalForScheduler = globalThis as unknown as {
  __navWatcherCronTask?: ScheduledTask;
  __navWatcherCronStartedAt?: string;
  __navWatcherLastCronRunAt?: string;
};

export const CRON_SCHEDULE = "0 0 * * *";
export const CRON_TIMEZONE = "Asia/Dhaka";

export function initDailyNavScheduler() {
  // On Vercel serverless, scheduled runs are triggered externally at midnight 12:00 AM Asia/Dhaka (18:00 UTC)
  if (process.env.VERCEL) {
    return {
      active: true,
      schedule: CRON_SCHEDULE,
      timezone: CRON_TIMEZONE,
      startedAt: globalForScheduler.__navWatcherCronStartedAt || new Date().toISOString(),
      lastCronRunAt: globalForScheduler.__navWatcherLastCronRunAt || null,
    };
  }

  if (globalForScheduler.__navWatcherCronTask) {
    return {
      active: true,
      schedule: CRON_SCHEDULE,
      timezone: CRON_TIMEZONE,
      startedAt: globalForScheduler.__navWatcherCronStartedAt,
      lastCronRunAt: globalForScheduler.__navWatcherLastCronRunAt || null,
    };
  }

  const task = cron.schedule(
    CRON_SCHEDULE,
    async () => {
      const nowIso = new Date().toISOString();
      globalForScheduler.__navWatcherLastCronRunAt = nowIso;
      console.log(
        `[NAV Watcher Cron] Executing scheduled daily NAV scrape at ${nowIso} (Midnight 12:00 AM Asia/Dhaka)...`
      );
      try {
        const res = await syncAllFundsNav({ trigger: "CRON_MIDNIGHT_DHAKA" });
        console.log(
          `[NAV Watcher Cron] Completed daily NAV sync:`,
          res.results.map((r) => `${r.fundId}=${r.nav} (${r.sourceUsed})`).join(", ")
        );
      } catch (err) {
        console.error("[NAV Watcher Cron] Error during scheduled NAV sync:", err);
      }
    },
    {
      scheduled: true,
      timezone: CRON_TIMEZONE,
    }
  );

  globalForScheduler.__navWatcherCronTask = task;
  globalForScheduler.__navWatcherCronStartedAt = new Date().toISOString();

  console.log(
    `[NAV Watcher Cron] Scheduled daily NAV scraper for "${CRON_SCHEDULE}" (${CRON_TIMEZONE} / Midnight 12:00 AM / 18:00 UTC)`
  );

  return {
    active: true,
    schedule: CRON_SCHEDULE,
    timezone: CRON_TIMEZONE,
    startedAt: globalForScheduler.__navWatcherCronStartedAt,
    lastCronRunAt: globalForScheduler.__navWatcherLastCronRunAt || null,
  };
}

export function getSchedulerStatus() {
  return {
    active: Boolean(process.env.VERCEL || globalForScheduler.__navWatcherCronTask),
    schedule: CRON_SCHEDULE,
    description: "Every day at midnight 12:00 AM Asia/Dhaka (18:00 UTC)",
    timezone: CRON_TIMEZONE,
    startedAt: globalForScheduler.__navWatcherCronStartedAt || null,
    lastCronRunAt: globalForScheduler.__navWatcherLastCronRunAt || null,
  };
}
