export interface TranscriptionResult {
  markdown: string;
  data: any;
}

export async function transcribeAudio(audioFile: File, audioType: string = 'meeting', model: string = 'gemini-3.1-pro-preview'): Promise<TranscriptionResult> {
  const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks (to stay well below 32MB Nginx limit safely)
  const totalChunks = Math.ceil(audioFile.size / CHUNK_SIZE);

  if (totalChunks <= 1) {
    // If small file, just use the single upload endpoint
    const formData = new FormData();
    formData.append('audio', audioFile);
    formData.append('audioType', audioType);
    formData.append('model', model);

    const response = await fetch('/api/transcribe', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => null);
      throw new Error(errData?.error || 'Failed to transcribe audio');
    }

    return await response.json();
  }

  // Large file handling
  // Start upload session
  const startRes = await fetch('/api/upload/start', { method: 'POST' });
  if (!startRes.ok) {
    throw new Error('Failed to start upload session');
  }
  const { uploadId } = await startRes.json();

  // Upload chunks sequentially
  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, audioFile.size);
    const chunk = audioFile.slice(start, end);

    const chunkFormData = new FormData();
    chunkFormData.append('uploadId', uploadId);
    chunkFormData.append('chunk', chunk);

    const chunkRes = await fetch('/api/upload/chunk', {
      method: 'POST',
      body: chunkFormData,
    });

    if (!chunkRes.ok) {
      throw new Error(`Failed to upload chunk ${i + 1}/${totalChunks}`);
    }
  }

  // Finish upload and transcribe
  const finishRes = await fetch('/api/upload/finish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      uploadId,
      mimetype: audioFile.type || 'audio/webm',
      originalname: audioFile.name,
      audioType,
      model,
    }),
  });

  if (!finishRes.ok) {
    const errData = await finishRes.json().catch(() => null);
    throw new Error(errData?.error || 'Failed to transcribe large audio file');
  }

  return await finishRes.json();
}

export async function summarizeText(text: string, language: string = 'English', model: string = 'gemini-3.1-pro-preview'): Promise<string> {
  const response = await fetch('/api/summarize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, language, model }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => null);
    throw new Error(errData?.error || 'Failed to summarize text');
  }

  const data = await response.json();
  return data.text;
}
