class GeminiRecorderWorklet extends AudioWorkletProcessor {
    process(inputs) {
        const inputChannel = inputs[0]?.[0];
        if (!inputChannel) return true;

        this.port.postMessage(inputChannel);
        return true;
    }
}

registerProcessor("gemini-recorder-worklet", GeminiRecorderWorklet);
