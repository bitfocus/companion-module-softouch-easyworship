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
		]

		// Sort alphabetically so the dropdown order is stable across sessions.
		// Without this, servers appear in mDNS discovery order, which varies
		// and confuses techs who expect "Sanctuary" to stay in the same slot.
		const sortedServers = instance.ezw.slice().sort((a, b) => a.localeCompare(b))

		// Dropdown is rebuilt each time the config panel opens — Companion
		// calls getConfigFields() on demand, so instance.ezw just needs to
		// be current at that moment. base 1.x has no push API for this.
		const dropdown = {
			type: 'dropdown',
			label: 'Available EasyWorship Servers',
			width: 6,
			id: 'EWServers',
			default: '',
			allowCustom: false,
			choices: [
				{ id: '', label: 'Select a server...' },
				...sortedServers.map(server => ({
					id: server,
					label: server,
				})),
			],
		}

		fields.push(dropdown)
		return fields
	},
}
