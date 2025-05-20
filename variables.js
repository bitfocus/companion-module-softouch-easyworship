function getVariables() {
    return {
        definitions: [
            {
                variableId: 'Logo',
                name: 'Logo',
                description: 'Controls the Logo button color state. 0 = Normal, 1 = Pressed',
            },
            {
                variableId: 'Black',
                name: 'Black',
                description: 'Controls the Black button color state. 0 = Normal, 1 = Pressed',
            },
            {
                variableId: 'Clear',
                name: 'Clear',
                description: 'Controls the Clear button color state. 0 = Normal, 1 = Pressed',
            },
            {
                variableId: 'LivePreview',
                name: 'LivePreview',
                description: 'Controls the Live Preview status button color state. 0 = Off, 1 = On',
            },
        ],
        initialValues: {
            Logo: 0,
            Black: 0,
            Clear: 0,
            LivePreview: 0,
        },
    };
}

module.exports = { getVariables };