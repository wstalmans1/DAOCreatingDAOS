try {
  const moduleUrl = new URL('./verifyBlockscout.ts', import.meta.url)
  const { runBlockscoutVerification } = await import(moduleUrl.href)
  await runBlockscoutVerification()
} catch (error) {
  console.error(error)
  process.exit(1)
}
