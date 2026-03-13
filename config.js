/**
 * Configuration fields shown in the Companion module settings panel.
 * The server dropdown is dynamically populated as mDNS discovers
 * EasyWorship servers on the network.
 */
module.exports = {
	getConfigFields(instance) {
		const fields = [
			{
				type: 'textinput',
				id: 'ClientName',
				label: 'Remote Name',
				width: 6,
				default: 'Companion',
				// Restrict to safe characters — this name is sent to EW over TCP
				regex: '/^[a-zA-Z0-9 _\\-]{1,64}$/',
			},
			{
				type: 'static-text',
				id: 'CurrentEWServer',
				label: 'Currently Controlling',
				width: 6,
				value: instance.config.EWServer || 'None',
			},
		];

		// Dropdown is rebuilt each time config panel opens and when
		// updateConfigFields() is called after server discovery events
		const dropdown = {
			type: 'dropdown',
			label: 'Available EasyWorship Servers',
			width: 6,
			id: 'EWServers',
			default: '',
			allowCustom: false,
			choices: [
				{ id: '', label: 'Select a server...' },
				...instance.ezw.map(server => ({
					id: server,
					label: server,
				})),
			],
		}

		fields.push(dropdown);
		return fields;
	}
}
