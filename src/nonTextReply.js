function voiceReply(languageHint = "Arabic") {
  if (languageHint === "English") {
    return "Could you write your question as text? That way I can answer you clearly.";
  }

  return "ممكن تكتبلي سؤالك نص؟ هيكون أوضح وأقدر أساعدك بسرعة.";
}

function isAudioLike(value) {
  if (!value) return false;

  if (typeof value === "string") {
    return /audio|voice|voicenote|voice_note|ogg|mp3|m4a|wav/i.test(value);
  }

  if (Array.isArray(value)) {
    return value.some(isAudioLike);
  }

  if (typeof value === "object") {
    return Object.entries(value).some(([key, nested]) => {
      if (/type|mime|contentType|mediaType|attachmentType/i.test(key) && isAudioLike(nested)) return true;
      if (/audio|voice/i.test(key)) return Boolean(nested);
      return isAudioLike(nested);
    });
  }

  return false;
}

module.exports = { isAudioLike, voiceReply };
