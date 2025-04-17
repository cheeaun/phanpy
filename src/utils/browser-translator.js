export const supportsBrowserTranslator =
  'ai' in self && 'translator' in self.ai;

// https://developer.chrome.com/docs/ai/language-detection
export let langDetector;
if (supportsBrowserTranslator) {
  (async () => {
    try {
      const languageDetectorCapabilities =
        await self.ai.languageDetector.capabilities();
      const canDetect = languageDetectorCapabilities.capabilities;
      if (canDetect === 'no') {
        // The language detector isn't usable.
        // return;
      }
      if (canDetect === 'readily') {
        // The language detector can immediately be used.
        langDetector = await self.ai.languageDetector.create();
      } else {
        // The language detector can be used after model download.
        langDetector = await self.ai.languageDetector.create({
          monitor(m) {
            m.addEventListener('downloadprogress', (e) => {
              console.log(
                `Detector: Downloaded ${e.loaded} of ${e.total} bytes.`,
              );
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
  console.groupCollapsed(
    '💬 BROWSER TRANSLATE',
    originalSource,
    detectedSourceLanguage,
    target,
  );
  console.log(text);
  try {
    const translatorCapabilities = await self.ai.translator.capabilities();
    const canTranslate = translatorCapabilities.languagePairAvailable(
      source,
      target,
    );
    if (canTranslate === 'no') {
      console.groupEnd();
      return {
        error: `Unsupported language pair: ${source} -> ${target}`,
      };
    }
    let translator;
    if (canTranslate === 'readily') {
      translator = await self.ai.translator.create({
        sourceLanguage: source,
        targetLanguage: target,
      });
    } else {
      translator = await self.ai.translator.create({
        sourceLanguage: source,
        targetLanguage: target,
        monitor(m) {
          m.addEventListener('downloadprogress', (e) => {
            console.log(
              `Translate ${source} -> ${target}: Downloaded ${e.loaded} of ${e.total} bytes.`,
            );
          });
        },
      });
    }

    const content = await translator.translate(text);
    console.log(content);
    console.groupEnd();

    return {
      content,
      detectedSourceLanguage,
      provider: 'browser',
    };
  } catch (e) {
    console.groupEnd();
    console.error(e);
    return {
      error: e,
    };
  }
};
