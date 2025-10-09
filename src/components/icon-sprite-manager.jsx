import { createContext } from 'preact';
import { memo } from 'preact/compat';
import { useCallback, useContext, useState } from 'preact/hooks';

const IconSpriteContext = createContext();

export const ICON_NAMESPACE = 'sprite-icon';

export function IconSpriteProvider({ children }) {
  const [loadedIcons, setLoadedIcons] = useState(new Set());
  const [iconData, setIconData] = useState({});

  const loadIcon = useCallback(
    async (iconName) => {
      if (loadedIcons.has(iconName)) {
        return;
      }

      try {
        const { ICONS } = await import('./ICONS');
        const iconBlock = ICONS[iconName];

        if (!iconBlock) {
          console.warn(`Icon ${iconName} not found`);
          return;
        }

        let iconModule;
        if (Array.isArray(iconBlock)) {
          iconModule = iconBlock[0];
        } else if (typeof iconBlock === 'object') {
          iconModule = iconBlock.module;
        } else {
          iconModule = iconBlock;
        }

        const iconResult = await iconModule();
        const iconDataResult = iconResult.default;

        setIconData((prev) => ({ ...prev, [iconName]: iconDataResult }));
        setLoadedIcons((prev) => new Set([...prev, iconName]));
      } catch (error) {
        console.warn(`Failed to load icon ${iconName}:`, error);
      }
    },
    [loadedIcons],
  );

  const isIconLoaded = useCallback(
    (iconName) => loadedIcons.has(iconName),
    [loadedIcons],
  );

  const contextValue = {
    loadIcon,
    isIconLoaded,
    loadedIcons,
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
  const { loadedIcons, iconData } = useIconSprite();

  if (loadedIcons.size === 0) {
    return null;
  }

  return (
    <svg style={{ display: 'none' }} aria-hidden="true">
      <defs>
        {Array.from(loadedIcons).map((iconName) => {
          const data = iconData[iconName];
          if (!data) return null;
          return <Symbol key={iconName} iconName={iconName} data={data} />;
        })}
      </defs>
    </svg>
  );
}

const Symbol = memo(
  function ({ iconName, data }) {
    return (
      <symbol
        id={`${ICON_NAMESPACE}-${iconName}`}
        viewBox={`0 0 ${data.width} ${data.height}`}
        dangerouslySetInnerHTML={{ __html: data.body }}
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
