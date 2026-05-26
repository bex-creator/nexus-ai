// Classic web-worker loading script - Fixed CDN URL
importScripts('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.0/dist/transformers.js');

const { pipeline, env, TextStreamer } = self.transformers;

env.allowLocalModels = false;

// Optimize CPU threading profile for Chromebooks
env.backends.onnx.wasm.numThreads = 1;

// Fully bypass complex optimizations to prevent memory-related crashes
env.backends.onnx.session_options = {
    graphOptimizationLevel: 'none', // Fixed: Changed 'disabled' to 'none'
    enableCpuMemArena: false,       
    enableMemPattern: false,        
    executionMode: 'sequential'     
};

let aiPipeline = null;
let lastProgressSent = 0; 

self.onmessage = async function(e) {
    const { action, payload } = e.data;

    if (action === 'load') {
        try {
            // Safely check for WebGPU availability in the worker context
            const deviceToUse = (typeof navigator !== 'undefined' && navigator.gpu) ? 'webgpu' : 'wasm';
            const modelPath = payload?.model || 'onnx-community/Qwen2.5-0.5B-Instruct';

            aiPipeline = await pipeline('text-generation', modelPath, {
                device: deviceToUse,
                dtype: 'q4',
                progress_callback: (data) => {
                    const now = Date.now();
                    // Throttle updates to prevent Chromium main-thread blocking
                    if (now - lastProgressSent > 100 || data.status === 'done' || data.status === 'initiate') {
                        self.postMessage({ action: 'progress', data });
                        lastProgressSent = now;
                    }
                }
            });
            self.postMessage({ action: 'ready', device: deviceToUse, model: modelPath });
        } catch (err) {
            self.postMessage({ action: 'error', error: err.message || String(err) });
        }
    }

    if (action === 'generate') {
        if (!aiPipeline) {
            self.postMessage({ action: 'error', error: 'Nexus engine missing initialization.' });
            return;
        }

        try {
            const streamer = new TextStreamer(aiPipeline.tokenizer, {
                skip_prompt: true,
                callback_function: (token) => {
                    self.postMessage({ action: 'token', token });
                }
            });

            const results = await aiPipeline(payload.chatHistory, {
                max_new_tokens: 512,
                do_sample: false, 
                streamer: streamer
            });

            let answer = "";
            const genText = results[0].generated_text;
            if (Array.isArray(genText)) {
                answer = genText[genText.length - 1].content;
            } else if (typeof genText === 'string') {
                answer = genText;
            }

            self.postMessage({ action: 'complete', answer });
        } catch (err) {
            self.postMessage({ action: 'error', error: err.message || String(err) });
        }
    }
};
