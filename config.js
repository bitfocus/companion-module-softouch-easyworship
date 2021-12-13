exports = module.exports = function () {
	var self = this;

	var fields = [
		{
			type: 'textinput',
			id: 'ClientName',
			label: 'Remote Name',
			width: 6,
			value: self.config.ClientName
		},
		{
			type: 'text',
			id: 'CurrentEWServer',
			label: 'Currently Controlling',
			width: 6,
			value: self.config.EWServer
		}
	];

	var dropdown = {
		type: 'dropdown',
		label: 'Available EasyWorship Servers',
		width: 6,
		id: 'EWServers',
		default: 1,
		choices: []
	};

	// Refactor to use the more stable computer name as the id.
	for (let i = 1; i <= self.ezw.length; i++) {
		dropdown['choices'].push(JSON.parse('{"id": "' + self.ezw[i - 1] + '", "label": "' + self.ezw[i - 1] + '"}'));
	}

	fields.push(dropdown);

	return fields;
};