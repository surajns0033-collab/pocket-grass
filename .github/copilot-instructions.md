# Pocket Grass

A Node server that asks Gemma to finish one outdoor noticing sentence, then turns the page into a timer.

- Local model: `onnx-community/gemma-3-270m-it-ONNX` through Transformers.js.
- Hosted model: DigitalOcean Gradient serverless inference, model id `gemma-4-31B-it`.
- Weather, optional: Open-Meteo. Storm, snow, or high wind skips the model.
- Do not send outing notes off the device. They stay in localStorage.
- Keep the screen the short part. Do not add a chat thread.
- Unit tests live in `test/card.test.js` and must stay free of model downloads.
