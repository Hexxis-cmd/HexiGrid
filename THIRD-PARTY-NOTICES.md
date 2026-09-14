# Third-party notices

HexiGrid includes a browser bundle of [WebLLM](https://github.com/mlc-ai/web-llm), version 0.2.85, under the Apache License 2.0. The bundled runtime is used only when a user chooses an on-device browser model. Model weights and WebAssembly libraries are downloaded directly by WebLLM from the model sources declared by its bundled registry and are cached by the user's browser.

The complete WebLLM license text is available in the installed package at `node_modules/@mlc-ai/web-llm/LICENSE` and in the WebLLM source repository. HexiGrid's source remains under the license in [LICENSE.md](LICENSE.md).
