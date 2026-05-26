// Global catch-all for hidden crashes that cause the worker to freeze silently
self.onerror = function(message, source, lineno, colno, error) {
    self.postMessage({ action: 'error', error: `Worker Crash: ${message} at line ${lineno}` });
};

self.onunhandledrejection = function(event) {
    self.postMessage({ action: 'error', error: `Uncaught Promise Freeze: ${event.reason}` });
};

// Load Transformers.js v3
importScripts('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.0/dist/transformers.js');

const { pipeline, env, TextStreamer } = self.transformers;

// Allow standard Hugging Face distribution downloads for personal networks
env.allowLocalModels = false;

// Optimize CPU threading profile strictly for Chromebook architectures
env.backends.onnx.wasm.numThreads = 1;
env.backends.onnx.session_options = {
    graphOptimizationLevel: 'none', 
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
            // FORCE WASM FALLBACK FIRST: If WebGPU is unstable on this Chromebook, 
            // allow the main UI thread to pass "forceWasm: true" to prevent hardware lockup.
            let deviceToUse = 'wasm';
            if (!payload?.forceWasm && typeof navigator !== 'undefined' && navigator.gpu) {
                deviceToUse = 'webgpu';
            }

            const modelPath = payload?.model || 'onnx-community/Qwen2.5-0.5B-Instruct';
            
            // Let the main thread know the worker is alive and starting execution
            self.postMessage({ action: 'progress', data: { status: 'initiate', message: `Initializing engine on ${deviceToUse}...` } });

            // In WebGPU mode, Transformers v3 prefers 'q4f16' or 'fp16'. For WASM, 'q4' or 'q8'.
            const dtypeToUse = (deviceToUse === 'webgpu') ? 'q4f16' : 'q4';

            aiPipeline = await pipeline('text-generation', modelPath, {
                device: deviceToUse,
                dtype: dtypeToUse,
                progress_callback: (data) => {
                    const now = Date.now();
                    if (now - lastProgressSent > 50 || data.status === 'done') {
                        self.postMessage({ action: 'progress', data });
                        lastProgressSent = now;
                    }
                }
            });
            
            self.postMessage({ action: 'ready', device: deviceToUse, model: modelPath });
        } catch (err) {
            self.postMessage({ action: 'error', error: `Pipeline Engine Error: ${err.message || String(err)}` });
        }
    }

    if (action === 'generate') {
        if (!aiPipeline) {
            self.postMessage({ action: 'error', error: 'Pipeline not initialized.' });
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
