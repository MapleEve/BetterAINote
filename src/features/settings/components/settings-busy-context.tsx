"use client";

import * as React from "react";

export interface SettingsBusyContextValue {
    isSettingsBusy: boolean;
    setSettingsSectionBusy: (section: string, busy: boolean) => void;
}

const noop = () => {};

const SettingsBusyContext = React.createContext<SettingsBusyContextValue>({
    isSettingsBusy: false,
    setSettingsSectionBusy: noop,
});

export function SettingsBusyProvider({
    children,
    value,
}: {
    children: React.ReactNode;
    value: SettingsBusyContextValue;
}) {
    return (
        <SettingsBusyContext.Provider value={value}>
            {children}
        </SettingsBusyContext.Provider>
    );
}

export function useSettingsBusyContext() {
    return React.useContext(SettingsBusyContext);
}

export function useSettingsSectionBusy(section: string, busy: boolean) {
    const { setSettingsSectionBusy } = useSettingsBusyContext();

    React.useEffect(() => {
        setSettingsSectionBusy(section, busy);

        return () => {
            setSettingsSectionBusy(section, false);
        };
    }, [busy, section, setSettingsSectionBusy]);
}
