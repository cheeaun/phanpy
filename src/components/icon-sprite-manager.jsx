import { createContext } from 'preact';
import { memo } from 'preact/compat';
import { useCallback, useContext, useState } from 'preact/hooks';

const IconSpriteContext = createContext();

export const ICON_NAMESPACE = 'sprite-icon';

const escapeAttr = (value) =>
  String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;');

// Simple solid-color icons only, no gradients/masks/patterns
function renderIconBody({ elements }) {
  return elements
    .map(({ tag, attributes }) => {
      const attrs = Object.entries(attributes)
        .map(([name, value]) => ` ${name}="${escapeAttr(value)}"`)
        .join('');
      return `<${tag}${attrs}/>`;
    })
    .join('');
}

export function IconSpriteProvider({ children }) {
  const [iconData, setIconData] = useState({});

  const registerIcon = useCallback((iconName, data) => {
    setIconData((prev) =>
      prev[iconName] ? prev : { ...prev, [iconName]: data },
    );
  }, []);

  const isIconRegistered = useCallback(
    (iconName) => !!iconData[iconName],
    [iconData],
  );

  const contextValue = {
    registerIcon,
    isIconRegistered,
    iconData,
  };

  return (
    <IconSpriteContext.Provider value={contextValue}>
      {children}
      <IconSprite />
    </IconSpriteContext.Provider>
  );
}

function IconSprite() {
  const { iconData } = useIconSprite();

  const iconNames = Object.keys(iconData);
  if (iconNames.length === 0) {
    return null;
  }

  return (
    <svg style={{ display: 'none' }} aria-hidden="true">
      <defs>
        {iconNames.map((iconName) => (
          <Symbol
            key={iconName}
            iconName={iconName}
            data={iconData[iconName]}
          />
        ))}
      </defs>
    </svg>
  );
}

const Symbol = memo(
  function ({ iconName, data }) {
    return (
      <symbol
        id={`${ICON_NAMESPACE}-${iconName}`}
        viewBox={data.viewBox}
        dangerouslySetInnerHTML={{ __html: renderIconBody(data) }}
      />
    );
  },
  (prevProps, nextProps) => {
    return prevProps.iconName === nextProps.iconName;
  },
);

export function useIconSprite() {
  const context = useContext(IconSpriteContext);
  if (!context) {
    throw new Error('useIconSprite must be used within IconSpriteProvider');
  }
  return context;
}
