exports = module.exports = function () {
	var self = this;

	const feedbacks = {};

	feedbacks['is_logo'] = {
		type: 'boolean',
		label: 'Logo Button State',
		description: 'Highlights the Logo Button based on the state in EasyWorship',
		options: [],
		callback: function (feedback) {
			return self.EZWLogo == 1;
		}
	};

	feedbacks['is_black'] = {
		type: 'boolean',
		label: 'Black Button State',
		description: 'Highlights the Black Button based on the state in EasyWorship',
		options: [],
		callback: function (feedback) {
			return self.EZWBlack == 1;
		}
	};

	feedbacks['is_clear'] = {
		type: 'boolean',
		label: 'Clear Button State',
		description: 'Highlights the Clear Button based on the state in EasyWorship',
		options: [],
		callback: function (feedback) {
			return self.EZWClear == 1;
		}
	};

	feedbacks['is_livepreview'] = {
		type: 'boolean',
		label: 'Live Preview Button State',
		description: 'Highlights the Live Button Preview based on the state in EasyWorship',
		options: [],
		callback: function (feedback) {
			return self.EZWLivePreview == 1;
		}
	};

	feedbacks['is_none'] = {
		type: 'boolean',
		label: 'Regular Button',
		description: 'A Regular EasyWorship Button',
		options: []
	};

	self.setFeedbackDefinitions(feedbacks);
};