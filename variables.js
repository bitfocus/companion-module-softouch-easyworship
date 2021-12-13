exports = module.exports = function () {
	var self = this;

	self.setVariableDefinitions( [
		{
			label: 'Controls the Logo button color state. 0 = Normal, 1 = Pressed',
			name: 'Logo'
		},
		{
			label: 'Controls the Black button color state. 0 = Normal, 1 = Pressed',
			name: 'Black'
		},
		{
			label: 'Controls the Clear button color state. 0 = Normal, 1 = Pressed',
			name: 'Clear'
		},
		{
			label: 'Controls the Live Preview status button color state. 0 = Off, 1 = On',
			name: 'Clear'
		}
	] );
};