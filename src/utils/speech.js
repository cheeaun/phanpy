export const supportsTTS = 'speechSynthesis' in window;

export function speak(text, lang) {
  if (!supportsTTS) return;
  try {
    if (speechSynthesis.speaking) {
      speechSynthesis.cancel();
    }
    const utterance = new SpeechSynthesisUtterance(text);
    if (lang) utterance.lang = lang;
    speechSynthesis.speak(utterance);
  } catch (e) {
    alert(e);
  }
}
