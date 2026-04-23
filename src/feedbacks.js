/**
 * Boolean feedbacks that drive button highlighting on the Stream Deck.
 * When a feedback returns true, the button's style changes (typically
 * a highlight color) to show the tech that the feature is active.
 *
 * These reflect EasyWorship's authoritative state, not optimistic local state.
 */
function getFeedbacks(instance) {
    return {
        is_logo: {
            type: 'boolean',
            label: 'Logo Active',
            description: 'Highlights when the Logo overlay is displayed in EasyWorship',
            options: [],
            callback: () => {
                return instance.EZWLogo === 1;
            },
        },
        is_black: {
            type: 'boolean',
            label: 'Black Active',
            description: 'Highlights when the Black screen overlay is displayed in EasyWorship',
            options: [],
            callback: () => {
                return instance.EZWBlack === 1;
            },
        },
        is_clear: {
            type: 'boolean',
            label: 'Clear Active',
            description: 'Highlights when the Clear overlay is active in EasyWorship',
            options: [],
            callback: () => {
                return instance.EZWClear === 1;
            },
        },
        is_livepreview: {
            type: 'boolean',
            label: 'Live Preview Active',
            description: 'Highlights when Live Preview is enabled in EasyWorship',
            options: [],
            callback: () => {
                return instance.EZWLivePreview === 1;
            },
        },
        is_connected: {
            type: 'boolean',
            label: 'Connected & Paired',
            description: 'Highlights when the module is connected and paired with EasyWorship — use this to show connection status at a glance',
            options: [],
            callback: () => {
                return instance.paired === true;
            },
        },
        // Used by presets for buttons that don't need state highlighting
        // (navigation, playback, etc). Explicit false prevents Companion
        // from showing unexpected highlight behavior.
        is_none: {
            type: 'boolean',
            label: 'No Highlight',
            description: 'Never highlights — used for buttons without state feedback',
            options: [],
            callback: () => {
                return false;
            },
        },
    };
}

module.exports = { getFeedbacks };
