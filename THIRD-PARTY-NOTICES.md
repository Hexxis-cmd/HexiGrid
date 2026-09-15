# Third-party notices

HexiGrid includes a browser bundle of [WebLLM](https://github.com/mlc-ai/web-llm), version 0.2.85, under the Apache License 2.0. The bundled runtime is used only when a user chooses an on-device browser model. Model weights and WebAssembly libraries are downloaded directly by WebLLM from the model sources declared by its bundled registry and are cached by the user's browser.

The complete WebLLM license text is available in the installed package at `node_modules/@mlc-ai/web-llm/LICENSE` and in the WebLLM source repository. HexiGrid's source remains under the license in [LICENSE.md](LICENSE.md).

HexiGrid also includes a locally built, lazy-loaded browser bundle of [Google model-viewer](https://github.com/google/model-viewer), version 4.3.1, and Three.js 0.183.0. Both are used only when an owner adds a GLB 3D agent avatar. model-viewer is available under Apache License 2.0 and Three.js under the MIT License; their complete license files are included in their installed npm packages.
