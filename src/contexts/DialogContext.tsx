import {
    createContext,
    useContext,
    useState,
    useCallback,
} from '@wordpress/element';

export const DIALOG_TYPES = {
    CONFIRM: 'confirm',
    LOADING: 'loading',
    SUCCESS: 'success',
    ERROR:   'error',
    INFO:    'info',
} as const;

export type DialogType = typeof DIALOG_TYPES[keyof typeof DIALOG_TYPES];

export interface DialogState {
    open:         boolean;
    type:         DialogType;
    title:        string;
    content:      string;
    confirmLabel: string | null;
    cancelLabel:  string | null;
    onConfirm:    (() => void) | null;
    onCancel:     (() => void) | null;
    autoClose:    number | null;
}

export type OpenDialogOptions = Partial<Omit<DialogState, 'open'>>;

interface DialogContextValue {
    dialog:      DialogState;
    openDialog:  (options?: OpenDialogOptions) => void;
    updateDialog:(options: Partial<DialogState>) => void;
    closeDialog: () => void;
    resetDialog: () => void;
}

const initialState: DialogState = {
    open:         false,
    type:         DIALOG_TYPES.CONFIRM,
    title:        '',
    content:      '',
    confirmLabel: null,
    cancelLabel:  null,
    onConfirm:    null,
    onCancel:     null,
    autoClose:    null,
};

const DialogContext = createContext<DialogContextValue | null>(null);

type DialogProviderProps = {
    children?: JSX.Element;
};

export function DialogProvider({ children }: DialogProviderProps): JSX.Element {
    const [dialog, setDialog] = useState<DialogState>(initialState);

    const openDialog = useCallback((options: OpenDialogOptions = {}) => {
        setDialog({ ...initialState, ...options, open: true });
    }, []);

    const updateDialog = useCallback((options: Partial<DialogState>) => {
        setDialog((prev) => ({ ...prev, ...options }));
    }, []);

    const closeDialog = useCallback(() => {
        setDialog((prev) => ({ ...prev, open: false }));
    }, []);

    const resetDialog = useCallback(() => {
        setDialog(initialState);
    }, []);

    return (
        <DialogContext.Provider value={{ dialog, openDialog, updateDialog, closeDialog, resetDialog }}>
            {children}
        </DialogContext.Provider>
    );
}

export function useDialog(): DialogContextValue {
    const context = useContext(DialogContext);
    if (!context) {
        throw new Error('useDialog must be used within a DialogProvider');
    }
    return context;
}