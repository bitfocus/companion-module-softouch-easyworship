/**
 * Variables expose EasyWorship state to the Companion expression system.
 * Users can reference these in button text (e.g., $(softouch-easyworship:Connected))
 * or in triggers to automate actions based on state changes.
 */
function getVariables() {
    return {
        definitions: [
            {
                variableId: 'Logo',
                name: 'Logo',
                description: 'Logo overlay state. 0 = Off, 1 = On',
            },
            {
                variableId: 'Black',
                name: 'Black',
                description: 'Black screen overlay state. 0 = Off, 1 = On',
            },
            {
                variableId: 'Clear',
                name: 'Clear',
                description: 'Clear overlay state. 0 = Off, 1 = On',
            },
            {
                variableId: 'LivePreview',
                name: 'LivePreview',
                description: 'Live Preview state. 0 = Off, 1 = On',
            },
            {
                variableId: 'Connected',
                name: 'Connected',
                description: 'Connection and pairing status. 0 = Disconnected, 1 = Connected & Paired',
            },
        ],
        initialValues: {
            Logo: 0,
            Black: 0,
            Clear: 0,
            LivePreview: 0,
            Connected: 0,
        },
    };
}

module.exports = { getVariables };
