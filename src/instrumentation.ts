export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initDailyNavScheduler } = await import("./lib/scheduler");
    initDailyNavScheduler();
  }
}

