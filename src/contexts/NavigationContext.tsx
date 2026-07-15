import { createContext, useContext, useState, useEffect, useCallback } from '@wordpress/element';
import type { PanelKey, PanelDefinition } from '@app-types/navigation';
import { parseLocalizedPanels } from '@app-utils/parseLocalizedPanels';
import { buildMenuItems } from '@app-utils/buildMenuItems';
import type { MenuItem } from '@app-utils/buildMenuItems';

type NavigationContextValue = {
    panel: PanelKey;
    setPanel: ( panel: PanelKey ) => void;
    panels: PanelDefinition[];
    menuItems: MenuItem[];
    navigateGuarded: ( key: PanelKey, params?: Record<string, string> ) => void;
    panelParams: Record<string, string> | null;
    consumePanelParams: () => Record<string, string> | null;
};

const NavigationContext = createContext<NavigationContextValue | undefined>( undefined );

type NavigationProviderProps = {
    children?: JSX.Element;
};

// Get the current panel from URL search params
function getPanelFromURL(defaultPanel: PanelKey): PanelKey {
    if (typeof window === 'undefined') {
        return defaultPanel;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get('tab');
    
    // If no tab parameter or empty, return default
    if (!tab) {
        return defaultPanel;
    }

    return tab as PanelKey;
}

// Get query parameters from URL
function getQueryParams(): Record<string, string> {
    if (typeof window === 'undefined') {
        return {};
    }

    const urlParams = new URLSearchParams(window.location.search);
    const params: Record<string, string> = {};
    
    for (const [key, value] of urlParams.entries()) {
        if (key !== 'tab') { // 'tab' is reserved for the panel key
            params[key] = value;
        }
    }
    
    return params;
}

// Update URL without reloading the page
function updateURL(panelKey: PanelKey, params?: Record<string, string>): void {
    if (typeof window === 'undefined') {
        return;
    }

    const url = new URL(window.location.href);
    
    // Set the tab parameter
    url.searchParams.set('tab', panelKey);
    
    // Add additional parameters
    if (params) {
        for (const [key, value] of Object.entries(params)) {
            if (value !== undefined && value !== null) {
                url.searchParams.set(key, value);
            }
        }
    }
    
    // Use replaceState to avoid adding to browser history
    window.history.replaceState(null, '', url.toString());
}

export function NavigationProvider({ children }: NavigationProviderProps): JSX.Element {
    const panels = parseLocalizedPanels();
    const firstKey = panels[0]?.key ?? 'auth';

    // Initialize panel from URL
    const [panel, setPanel] = useState<PanelKey>(() => {
        const urlPanel = getPanelFromURL(firstKey);
        // Validate that the panel exists
        return panels.some((p) => p.key === urlPanel) ? urlPanel : firstKey;
    });

    const [panelParams, setPanelParams] = useState<Record<string, string> | null>(() => {
        // Initialize params from URL
        const params = getQueryParams();
        return Object.keys(params).length > 0 ? params : null;
    });

    // Update URL when panel changes
    useEffect(() => {
        const params = panelParams || {};
        updateURL(panel, params);
    }, [panel, panelParams]);

    // Listen for popstate (browser back/forward)
    useEffect(() => {
        const handlePopState = () => {
            const urlPanel = getPanelFromURL(firstKey);
            const params = getQueryParams();
            
            if (panels.some((p) => p.key === urlPanel) && urlPanel !== panel) {
                setPanel(urlPanel);
            }
            
            if (Object.keys(params).length > 0) {
                setPanelParams(params);
            } else {
                setPanelParams(null);
            }
        };

        if (typeof window !== 'undefined') {
            window.addEventListener('popstate', handlePopState);
            return () => {
                window.removeEventListener('popstate', handlePopState);
            };
        }
    }, [panel, firstKey, panels]);

    function navigateGuarded(key: PanelKey, params?: Record<string, string>): void {
        if (panels.some((p) => p.key === key)) {
            setPanelParams(params ?? null);
            setPanel(key);
        }
    }

    function consumePanelParams(): Record<string, string> | null {
        const current = panelParams;
        setPanelParams(null);
        return current;
    }

    const menuItems = buildMenuItems(panels);

    return (
        <NavigationContext.Provider
            value={{
                panel,
                setPanel,
                panels,
                menuItems,
                navigateGuarded,
                panelParams,
                consumePanelParams,
            }}
        >
            {children}
        </NavigationContext.Provider>
    );
}

export function useNavigation(): NavigationContextValue {
    const ctx = useContext(NavigationContext);

    if (!ctx) {
        throw new Error('useNavigation must be used within NavigationProvider');
    }

    return ctx;
}