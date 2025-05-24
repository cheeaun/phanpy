export const supportsBrowserTranslator =
  'LanguageDetector' in self && 'Translator' in self;

// https://developer.chrome.com/docs/ai/language-detection
export let langDetector;
if (supportsBrowserTranslator) {
  (async () => {
    try {
      const availability = await LanguageDetector.availability();
      if (availability === 'unavailable') {
        // The language detector isn't usable.
        return;
      }
      if (availability === 'available') {
        // The language detector can immediately be used.
        langDetector = await LanguageDetector.create();
      } else {
        // The language detector can be used after model download.
        langDetector = await LanguageDetector.create({
          monitor(m) {
            m.addEventListener('downloadprogress', (e) => {
              console.log(`Detector: Downloaded ${e.loaded * 100}%`);
            });
          },
        });
        await langDetector.ready;
      }
    } catch (e) {
      console.error(e);
    }
  })();
}

// https://developer.chrome.com/docs/ai/translator-api
export const translate = async (text, source, target) => {
  let detectedSourceLanguage;
  const originalSource = source;
  if (source === 'auto') {
    try {
      const results = await langDetector.detect(text);
      source = results[0].detectedLanguage;
      detectedSourceLanguage = source;
    } catch (e) {
      console.error(e);
      return {
        error: e,
      };
    }
  }
  const groupLabel = `💬 BROWSER TRANSLATE ${text}`;
  console.groupCollapsed(groupLabel);
  console.log(originalSource, detectedSourceLanguage, target);
  try {
    const translatorCapabilities = await Translator.availability({
      sourceLanguage: source,
      targetLanguage: target,
    });
    // Note: Translator.availability() returns 'unavailable', 'downloadable', 'downloading', or 'available'.
    if (translatorCapabilities === 'unavailable') {
      console.groupEnd(groupLabel);
      return {
        error: `Unsupported language pair: ${source} -> ${target}`,
      };
    }
    let translator;
    if (translatorCapabilities === 'available') {
      translator = await Translator.create({
        sourceLanguage: source,
        targetLanguage: target,
      });
    } else {
      translator = await Translator.create({
        sourceLanguage: source,
        targetLanguage: target,
        monitor(m) {
          m.addEventListener('downloadprogress', (e) => {
            console.log(
              `Translate ${source} -> ${target}: Downloaded ${e.loaded * 100}%`,
            );
          });
        },
      });
      await translator.ready;
    }

    const content = await translator.translate(text);
    console.log(content);
    console.groupEnd(groupLabel);

    return {
      content,
      detectedSourceLanguage,
      provider: 'browser',
    };
  } catch (e) {
    console.groupEnd(groupLabel);
    console.error(e);
    return {
      error: e,
    };
  }
};
