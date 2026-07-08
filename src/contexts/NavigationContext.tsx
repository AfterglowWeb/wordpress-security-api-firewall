import { createContext, useContext, useState } from '@wordpress/element';
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

export function NavigationProvider( { children }: NavigationProviderProps ): JSX.Element {
    const panels = parseLocalizedPanels();
    const firstKey = panels[ 0 ]?.key ?? 'auth';

    const [ panel, setPanel ] = useState<PanelKey>( firstKey );
    const [ panelParams, setPanelParams ] = useState<Record<string, string> | null>( null );

    function navigateGuarded( key: PanelKey, params?: Record<string, string> ): void {
        if ( panels.some( ( p ) => p.key === key ) ) {
            setPanelParams( params ?? null );
            setPanel( key );
        }
    }

    function consumePanelParams(): Record<string, string> | null {
        const current = panelParams;
        setPanelParams( null );
        return current;
    }

    const menuItems = buildMenuItems( panels );

    return (
        <NavigationContext.Provider value={ { panel, setPanel, panels, menuItems, navigateGuarded, panelParams, consumePanelParams } }>
            { children }
        </NavigationContext.Provider>
    );
}

export function useNavigation(): NavigationContextValue {
    const ctx = useContext( NavigationContext );

    if ( ! ctx ) {
        throw new Error( 'useNavigation must be used within NavigationProvider' );
    }

    return ctx;
}