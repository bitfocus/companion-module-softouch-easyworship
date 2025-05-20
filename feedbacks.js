function getFeedbacks(instance) {
    return {
        is_logo: {
            type: 'boolean',
            label: 'Logo Button State',
            description: 'Highlights the Logo Button based on the state in EasyWorship',
            options: [],
            callback: (feedback) => {
                return instance.EZWLogo === 1;
            },
        },
        is_black: {
            type: 'boolean',
            label: 'Black Button State',
            description: 'Highlights the Black Button based on the state in EasyWorship',
            options: [],
            callback: (feedback) => {
                return instance.EZWBlack === 1;
            },
        },
        is_clear: {
            type: 'boolean',
            label: 'Clear Button State',
            description: 'Highlights the Clear Button based on the state in EasyWorship',
            options: [],
            callback: (feedback) => {
                return instance.EZWClear === 1;
            },
        },
        is_livepreview: {
            type: 'boolean',
            label: 'Live Preview Button State',
            description: 'Highlights the Live Preview Button based on the state in EasyWorship',
            options: [],
            callback: (feedback) => {
                //instance.log('info', 'inside live preview callback');
                return instance.EZWLivePreview === 1;
            },
        },
        is_none: {
            type: 'boolean',
            label: 'Regular Button',
            description: 'A Regular EasyWorship Button',
            options: [],
        }
    };
}

module.exports = { getFeedbacks };