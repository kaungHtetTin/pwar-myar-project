const serverUrl = process.env.MKPOS_SERVER_URL
  || 'https://www.pwarmyar.com/public';

(async () => {
  try {
    const response = await fetch(`${serverUrl.replace(/\/$/, '')}/api/health`, {
      headers: { Accept: 'application/json' },
    });
    const payload = await response.json().catch(() => null);
    console.log(JSON.stringify({ status: response.status, payload }));
    process.exitCode = response.ok && payload?.ok ? 0 : 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
})();
