import config from '../config/index.js';

// Voice abstraction. STT/TTS are provider-optional. Returns capability flags so the
// frontend can disable voice features gracefully when no provider is configured.

// Speech-to-Text: accepts an audio buffer + mime, returns transcript.
export async function transcribeAudio(audioBuffer, { mime = 'audio/webm', language } = {}) {
  const provider = config.voice.sttProvider;
  const key = config.voice.sttApiKey;
  if (!provider || provider === 'browser') {
    return { success: false, code: 'NOT_CONFIGURED', message: 'Speech-to-text provider not configured.' };
  }
  if (!key) return { success: false, code: 'NOT_CONFIGURED', message: `No API key for ${provider}.` };

  const form = new FormData();
  form.append('file', new Blob([audioBuffer], { type: mime }), 'audio.webm');
  form.append('model', 'whisper-large-v3');
  if (language) form.append('language', language);

  try {
    const url = provider === 'groq'
      ? 'https://api.groq.com/openai/v1/audio/transcriptions'
      : provider === 'assemblyai'
        ? 'https://api.assemblyai.com/v2/upload'
        : 'https://api.openai.com/v1/audio/transcriptions';
    const res = await fetch(url, {
      method: 'POST',
      headers: provider === 'assemblyai'
        ? { Authorization: key }
        : { Authorization: `Bearer ${key}` },
      body: form,
    });
    if (!res.ok) return { success: false, code: 'PROVIDER_ERROR', message: `Voice provider returned ${res.status}` };
    const data = await res.json();
    return { success: true, transcript: data.text?.trim() || '' };
  } catch (err) {
    return { success: false, code: 'NETWORK', message: err.message };
  }
}

// Text-to-Speech: returns base64 audio + mime. Returns empty capability if no provider.
export async function synthesizeSpeech(text) {
  const provider = config.voice.ttsProvider;
  const key = config.voice.ttsApiKey;
  if (!provider || provider === 'browser') return { success: false, code: 'NOT_CONFIGURED', message: 'Text-to-speech provider not configured.' };
  if (!key) return { success: false, code: 'NOT_CONFIGURED', message: `No API key for ${provider}.` };

  try {
    if (provider === 'elevenlabs') {
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${config.voice[provider].voiceId || '21m00Tcm4TlvDq8ikWAM'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'xi-api-key': key },
        body: JSON.stringify({ text, model_id: config.voice[provider].model || 'eleven_multilingual_v2' }),
      });
      if (!res.ok) return { success: false, code: 'PROVIDER_ERROR', message: `TTS provider returned ${res.status}` };
      const buf = Buffer.from(await res.arrayBuffer());
      return { success: true, audio: buf.toString('base64'), mime: 'audio/mpeg' };
    }
    return { success: false, code: 'UNSUPPORTED', message: `TTS provider ${provider} not implemented server-side; use client-side browser speech.` };
  } catch (err) {
    return { success: false, code: 'NETWORK', message: err.message };
  }
}

// Capability manifest for the frontend
export function getVoiceCapabilities() {
  const sttProvider = config.voice.sttProvider;
  const ttsProvider = config.voice.ttsProvider;
  return {
    stt: { provider: sttProvider, hasKey: Boolean(config.voice.sttApiKey), available: sttProvider !== 'browser' && Boolean(config.voice.sttApiKey) },
    tts: { provider: ttsProvider, hasKey: Boolean(config.voice.ttsApiKey), available: ttsProvider !== 'browser' && Boolean(config.voice.ttsApiKey) },
    // Browser speech synthesis is always available client-side for TTS
    browserTTS: true,
  };
}
