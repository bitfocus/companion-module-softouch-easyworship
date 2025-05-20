module.exports = {
	getConfigFields(instance) {
		const fields = [
			{
				type: 'textinput',
				id: 'ClientName',
				label: 'Remote Name',
				width: 6,
				value: instance.config.ClientName,
			},
			{
				type: 'static-text',
				id: 'CurrentEWServer',
				label: 'Currently Controlling',
				width: 6,
				value: instance.config.EWServer,
			},
		];

		const dropdown = {
			type: 'dropdown',
			label: 'Available EasyWorship Servers',
			width: 6,
			id: 'EWServers',
			default: 1,
			choices: instance.ezw.map(server => ({
                id: server,
                label: server,
            })),
		}

		fields.push(dropdown);
		return fields;
	}
}