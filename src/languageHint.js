function detectLanguageHint(text = "") {
  const arabicChars = (text.match(/[\u0600-\u06ff]/g) || []).length;
  const latinChars = (text.match(/[A-Za-z]/g) || []).length;

  if (arabicChars > 0 && latinChars > 0) return "mixed Arabic and English";
  if (arabicChars > 0) return "Jordanian colloquial Arabic";
  return "English";
}

module.exports = { detectLanguageHint };
