const { newPresentation, theme, OUTPUT, ensureOutputDirs } = require('./common');

const slides = Array.from({ length: 14 }, (_, i) =>
  require(`./slides/slide-${String(i + 1).padStart(2, '0')}`).createSlide
);

async function main() {
  const pres = newPresentation();
  slides.forEach((createSlide) => createSlide(pres, theme));
  ensureOutputDirs();
  await pres.writeFile({ fileName: OUTPUT });
  process.stdout.write(`${OUTPUT}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
