import 'temml/dist/Temml-Local.css';

import { useLingui } from '@lingui/react/macro';
import { useCallback, useState } from 'preact/hooks';

import showToast from '../utils/show-toast';

import Icon from './icon';

// Follow https://mathstodon.xyz/about
// > You can use LaTeX in toots here! Use \( and \) for inline, and \[ and \] for display mode.
const DELIMITERS_PATTERNS = [
  // '\\$\\$[\\s\\S]*?\\$\\$', // $$...$$
  '\\\\\\[[\\s\\S]*?\\\\\\]', // \[...\]
  '\\\\\\([\\s\\S]*?\\\\\\)', // \(...\)
  // '\\\\begin\\{(?:equation\\*?|align\\*?|alignat\\*?|gather\\*?|CD)\\}[\\s\\S]*?\\\\end\\{(?:equation\\*?|align\\*?|alignat\\*?|gather\\*?|CD)\\}', // AMS environments
  // '\\\\(?:ref|eqref)\\{[^}]*\\}', // \ref{...}, \eqref{...}
];
const DELIMITERS_REGEX = new RegExp(DELIMITERS_PATTERNS.join('|'), 'g');

function cleanDOMForTemml(dom) {
  // Define start and end delimiter patterns
  const START_DELIMITERS = ['\\\\\\[', '\\\\\\(']; // \[ and \(
  const startRegex = new RegExp(`(${START_DELIMITERS.join('|')})`);

  // Walk through all text nodes
  const walker = document.createTreeWalker(dom, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  let node;
  while ((node = walker.nextNode())) {
    textNodes.push(node);
  }

  for (const textNode of textNodes) {
    const text = textNode.textContent;
    const startMatch = text.match(startRegex);

    if (!startMatch) continue; // No start delimiter in this text node

    // Find the matching end delimiter
    const startDelimiter = startMatch[0];
    const endDelimiter = startDelimiter === '\\[' ? '\\]' : '\\)';

    // Collect nodes from start delimiter until end delimiter
    const nodesToCombine = [textNode];
    let currentNode = textNode;
    let foundEnd = false;
    let combinedText = text;

    // Check if end delimiter is in the same text node
    if (text.includes(endDelimiter)) {
      foundEnd = true;
    } else {
      // Look through sibling nodes
      while (currentNode.nextSibling && !foundEnd) {
        const nextSibling = currentNode.nextSibling;

        if (nextSibling.nodeType === Node.TEXT_NODE) {
          nodesToCombine.push(nextSibling);
          combinedText += nextSibling.textContent;
          if (nextSibling.textContent.includes(endDelimiter)) {
            foundEnd = true;
          }
        } else if (
          nextSibling.nodeType === Node.ELEMENT_NODE &&
          nextSibling.tagName === 'BR'
        ) {
          nodesToCombine.push(nextSibling);
          combinedText += '\n';
        } else {
          // Found a non-BR element, stop and don't process
          break;
        }

        currentNode = nextSibling;
      }
    }

    // Only process if we found the end delimiter and have nodes to combine
    if (foundEnd && nodesToCombine.length > 1) {
      // Replace the first text node with combined text
      textNode.textContent = combinedText;

      // Remove the other nodes
      for (let i = 1; i < nodesToCombine.length; i++) {
        nodesToCombine[i].remove();
      }
    }
  }
}

const MathBlock = ({ content, contentRef, onRevert }) => {
  DELIMITERS_REGEX.lastIndex = 0; // Reset index to prevent g trap
  const hasLatexContent = DELIMITERS_REGEX.test(content);

  if (!hasLatexContent) return null;

  const { t } = useLingui();
  const [mathRendered, setMathRendered] = useState(false);
  const toggleMathRendering = useCallback(
    async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (mathRendered) {
        // Revert to original content by refreshing PostContent
        setMathRendered(false);
        onRevert();
      } else {
        // Render math
        try {
          // This needs global because the codebase inside temml is calling a function from global.temml 🤦‍♂️
          const temml =
            window.temml || (window.temml = (await import('temml'))?.default);

          cleanDOMForTemml(contentRef.current);
          const originalContentRefHTML = contentRef.current.innerHTML;
          temml.renderMathInElement(contentRef.current, {
            fences: '(', // This should sync with DELIMITERS_REGEX
            annotate: true,
            throwOnError: true,
            errorCallback: (err) => {
              console.warn('Failed to render LaTeX:', err);
            },
          });

          const hasMath = contentRef.current.querySelector('math');
          const htmlChanged =
            contentRef.current.innerHTML !== originalContentRefHTML;
          if (hasMath && htmlChanged) {
            setMathRendered(true);
          } else {
            showToast(t`Unable to format math`);
            setMathRendered(false);
            onRevert(); // Revert because DOM modified by cleanDOMForTemml
          }
        } catch (e) {
          console.error('Failed to LaTeX:', e);
        }
      }
    },
    [mathRendered],
  );

  return (
    <div class="math-block">
      <Icon icon="formula" size="s" /> <span>{t`Math expressions found.`}</span>{' '}
      <button type="button" class="light small" onClick={toggleMathRendering}>
        {mathRendered
          ? t({
              comment:
                'Action to switch from rendered math back to raw (LaTeX) markup',
              message: 'Show markup',
            })
          : t({
              comment:
                'Action to render math expressions from raw (LaTeX) markup',
              message: 'Format math',
            })}
      </button>
    </div>
  );
};

export default MathBlock;
