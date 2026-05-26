// Classic web-worker loading script
importScripts('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.0/dist/transformers.js');

const { pipeline, env, TextStreamer } = self.transformers;

// 1. BYPASS SCHOOL FIREWALLS
// Forces the engine to use a mirror instead of huggingface.co
env.allowLocalModels = false;
env.remoteHost = 'https://hf-mirror.com'; 

// Optimize CPU threading profile for Chromebooks
env.backends.onnx.wasm.numThreads = 1;

// Fully bypass complex optimizations to prevent memory-related crashes
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
            const deviceToUse = (typeof navigator !== 'undefined' && navigator.gpu) ? 'webgpu' : 'wasm';
            
            // Default to Qwen, but allow the main script to pass a ultra-low RAM model
            const modelPath = payload?.model || 'onnx-community/Qwen2.5-0.5B-Instruct';

            aiPipeline = await pipeline('text-generation', modelPath, {
                device: deviceToUse,
                dtype: 'q4',
                progress_callback: (data) => {
                    const now = Date.now();
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
