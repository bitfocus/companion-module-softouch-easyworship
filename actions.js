exports = module.exports = function () {
	var self = this;

	self.system.emit('instance_actions', self.id, {
		'logo': {
			label: 'Logo Command',
			options: [
				{
					type: 'dropdown',
					id: 'id_logo',
					label: 'Command:',
					tooltip: 'Toggle the Logo screen',
					default: 0,
					choices: [
						{ id: '0', label: 'Not used' }
					  ]
				}			
			]			
		},
		'black': {
			label: 'Black Command',
			options: [
				{
					type: 'dropdown',
					id: 'id_black',
					label: 'Command:',
					tooltip: 'Toggle the Black screen',
					default: 0,
					choices: [
						{ id: '0', label: 'Not used' }
					  ]
				}			
			]
		},
		'clear': {
			label: 'Clear Command',
			options: [
				{
					type: 'dropdown',
					id: 'id_clear',
					label: 'Command:',
					tooltip: 'Toggle the Clear screen',
					default: 0,
					choices: [
						{ id: '0', label: 'Not used' }
					  ]
				}			
			]
		},
		'prevslide': {
			label: 'Slide Previous Command',
			options: [
				{
					type: 'dropdown',
					id: 'id_prevslide',
					label: 'Command:',
					tooltip: 'Goto the previous slide',
					default: 0,
					choices: [
						{ id: '0', label: 'Not used' }
					  ]
				}			
			]
		},
		'nextslide': {
			label: 'Slide Next Command',
			options: [
				{
					type: 'dropdown',
					id: 'id_nextslide',
					label: 'Command:',
					tooltip: 'Goto the next slide',
					default: 0,
					choices: [
						{ id: '0', label: 'Not used' }
					  ]
				}			
			]
		},
		'play': {
			label: 'Play Command',
			options: [
				{
					type: 'dropdown',
					id: 'id_play',
					label: 'Command:',
					tooltip: 'Play the media',
					default: 0,
					choices: [
						{ id: '0', label: 'Not used' }
					  ]
				}			
			]
		},
		'pause': {
			label: 'Pause Command',
			options: [
				{
					type: 'dropdown',
					id: 'id_pause',
					label: 'Command:',
					tooltip: 'Pause the media',
					default: 0,
					choices: [
						{ id: '0', label: 'Not used' }
					  ]
				}			
			]
		},
		'toggle': {
			label: 'Toggle Command',
			options: [
				{
					type: 'dropdown',
					id: 'id_toggle',
					label: 'Command:',
					tooltip: 'Toggle Play/Pause for the media',
					default: 0,
					choices: [
						{ id: '0', label: 'Not used' }
					  ]
				}			
			]
		},
		'prevsched': {
			label: 'Schedule Previous Command',
			options: [
				{
					type: 'dropdown',
					id: 'id_prevsched',
					label: 'Command:',
					tooltip: 'Goto the previous schedule',
					default: 0,
					choices: [
						{ id: '0', label: 'Not used' }
					  ]
				}			
			]
		},
		'nextsched': {
			label: 'Schedule Next Command',
			options: [
				{
					type: 'dropdown',
					id: 'id_nextsched',
					label: 'Command:',
					tooltip: 'Goto the next schedule',
					default: 0,
					choices: [
						{ id: '0', label: 'Not used' }
					  ]
				}			
			]
		},
		'prevbuild': {
			label: 'Build Previous Command',
			options: [
				{
					type: 'dropdown',
					id: 'id_prevbuild',
					label: 'Command:',
					tooltip: 'Goto the previous build',
					default: 0,
					choices: [
						{ id: '0', label: 'Not used' }
					  ]
				}			
			]
		},
		'nextbuild': {
			label: 'Build Next Command',
			options: [
				{
					type: 'dropdown',
					id: 'id_nextbuild',
					label: 'Command:',
					tooltip: 'Goto the next build',
					default: 0,
					choices: [
						{ id: '0', label: 'Not used' }
					  ]
				}			
			]
		},
		'presstart': {
			label: 'Presentation Start Command',
			options: [
				{
					type: 'dropdown',
					id: 'id_presstart',
					label: 'Command:',
					tooltip: 'Goto the presentation start',
					default: 0,
					choices: [
						{ id: '0', label: 'Not used' }
					  ]
				}			
			]
		},
		'slidestart': {
			label: 'Slide Start Command',
			options: [
				{
					type: 'dropdown',
					id: 'id_slidestart',
					label: 'Command:',
					tooltip: 'Goto the slide start',
					default: 0,
					choices: [
						{ id: '0', label: 'Not used' }
					  ]
				}			
			]
		},
		'connectezw': {
			label: 'Connect to EasyWorship',
			options: [
				{
					type: 'dropdown',
					id: 'id_connectezw',
					label: 'Command:',
					tooltip: 'Connect to EasyWorship',
					default: 0,
					choices: [
						{ id: '0', label: 'Not used' }
					  ]
				}			
			]
		},
		'gotoslide' : {
			label: 'Goto Slide',
			options: [
				{
					type: 'number',
					min: 1,
					id: 'id_gotoslide',
					label: 'Go to slide:',
					tooltip: 'Enter the number of the slide to go to.',
					width: 6,
					required: true
				}
			]
		},
		'gotoschedule' : {
			label: 'Goto Schedule',
			options: [
				{
					type: 'number',
					min: 1,
					id: 'id_gotoschedule',
					label: 'Go to schedule:',
					tooltip: 'Enter the schedule number to go to.',
					width: 6,
					required: true
				}
			]
		}
	});
};